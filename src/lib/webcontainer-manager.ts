"use client";

/**
 * WebContainer Manager - Singleton instance manager with Convex backend storage
 * 
 * This module solves:
 * 1. DataCloneError - ensures all data passed to WebContainer is serializable
 * 2. Instance limits - singleton pattern with proper cleanup
 * 3. Backend storage - files are saved to/loaded from Convex
 */

import type { Id } from "@/convex/_generated/dataModel";

// WebContainer type definitions
export interface WebContainerInstance {
  fs: {
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string, encoding?: string) => Promise<string | Uint8Array>;
    readdir: (path: string) => Promise<string[]>;
  };
  spawn: (command: string, args?: string[], options?: { env?: Record<string, string> }) => Promise<WebContainerProcess>;
  teardown: () => Promise<void>;
  on: (event: "server-ready" | "error" | "preview-message", callback: (port: number | string, url?: string) => void) => void;
}

export interface WebContainerProcess {
  exit: Promise<number>;
  input: WritableStream<string>;
  output: ReadableStream<string>;
  kill: () => void;
  resize: (dimensions: { cols: number; rows: number }) => void;
}

// Global singleton state
interface WebContainerState {
  instance: WebContainerInstance | null;
  bootPromise: Promise<WebContainerInstance> | null;
  isBooting: boolean;
  referenceCount: number;
  lastUsedAt: number;
}

const globalState: WebContainerState = {
  instance: null,
  bootPromise: null,
  isBooting: false,
  referenceCount: 0,
  lastUsedAt: 0,
};

// Configuration
const MAX_BOOT_RETRIES = 3;
const BOOT_RETRY_DELAY_MS = 2000;
const INSTANCE_IDLE_TIMEOUT_MS = 300000; // 5 minutes
const INSTANCE_CHECK_INTERVAL_MS = 60000; // 1 minute

// Types
export type Framework = "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE";

export interface FileRecord {
  [path: string]: string;
}

// ============================================================================
// INSTANCE MANAGEMENT
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Boot WebContainer with singleton pattern and retry logic
 */
export async function getWebContainerInstance(): Promise<WebContainerInstance> {
  // If we have a running instance, use it
  if (globalState.instance) {
    globalState.referenceCount++;
    globalState.lastUsedAt = Date.now();
    return globalState.instance;
  }

  // If already booting, wait for that promise
  if (globalState.bootPromise) {
    const instance = await globalState.bootPromise;
    globalState.referenceCount++;
    globalState.lastUsedAt = Date.now();
    return instance;
  }

  // Start boot process
  globalState.isBooting = true;
  globalState.bootPromise = bootWithRetry();

  try {
    const instance = await globalState.bootPromise;
    globalState.instance = instance;
    globalState.referenceCount++;
    globalState.lastUsedAt = Date.now();
    return instance;
  } finally {
    globalState.isBooting = false;
    globalState.bootPromise = null;
  }
}

async function bootWithRetry(retries = MAX_BOOT_RETRIES): Promise<WebContainerInstance> {
  const { WebContainer } = await import("@webcontainer/api");
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[WebContainer] Boot attempt ${attempt}/${retries}...`);
      
      // Ensure clean state before booting
      if (globalState.instance) {
        try {
          await globalState.instance.teardown();
        } catch {
          // Ignore teardown errors
        }
        globalState.instance = null;
      }
      
      // Boot with COEP for cross-origin isolation
      const instance = await WebContainer.boot({ 
        coep: "require-corp",
      }) as unknown as WebContainerInstance;
      
      console.log(`[WebContainer] Boot successful on attempt ${attempt}`);
      return instance;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      
      if (errorMessage.includes("Unable to create more instances")) {
        console.warn(`[WebContainer] Instance limit on attempt ${attempt}`);
        
        if (attempt < retries) {
          const delay = BOOT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[WebContainer] Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      } else {
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error("Failed to boot WebContainer after maximum retries");
}

/**
 * Release a reference to the WebContainer instance
 * When all references are released, the instance can be cleaned up
 */
export async function releaseWebContainerInstance(force = false): Promise<void> {
  if (globalState.referenceCount > 0) {
    globalState.referenceCount--;
  }
  
  if (force || globalState.referenceCount === 0) {
    await teardownWebContainer();
  }
}

/**
 * Force teardown of WebContainer instance
 */
export async function teardownWebContainer(): Promise<void> {
  if (!globalState.instance) return;
  
  console.log("[WebContainer] Tearing down instance...");
  
  try {
    await globalState.instance.teardown();
    console.log("[WebContainer] Teardown complete");
  } catch (error) {
    console.error("[WebContainer] Teardown error:", error);
  } finally {
    globalState.instance = null;
    globalState.bootPromise = null;
    globalState.isBooting = false;
    globalState.referenceCount = 0;
  }
}

// ============================================================================
// FILE SERIALIZATION (Prevents DataCloneError)
// ============================================================================

/**
 * Serialize files for WebContainer - ensures all values are plain strings
 * This prevents DataCloneError when passing data to WebContainer
 */
export function serializeFilesForWebContainer(files: unknown): FileRecord {
  if (!files || typeof files !== "object") {
    return {};
  }
  
  const result: FileRecord = {};
  
  for (const [path, content] of Object.entries(files)) {
    // Skip non-string paths
    if (typeof path !== "string") continue;
    
    // Skip non-string content - convert to string if possible
    if (typeof content === "string") {
      result[path] = content;
    } else if (content === null || content === undefined) {
      result[path] = "";
    } else if (typeof content === "object") {
      // For objects, try to serialize as JSON, fallback to String()
      try {
        result[path] = JSON.stringify(content, null, 2);
      } catch {
        result[path] = String(content);
      }
    } else {
      result[path] = String(content);
    }
  }
  
  return result;
}

/**
 * Deep clone files to break any object references that might cause DataCloneError
 */
export function cloneFilesForTransfer(files: FileRecord): FileRecord {
  // Use structured clone for a clean copy, fallback to JSON
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(files);
    }
  } catch {
    // structuredClone failed, use JSON method
  }
  
  // JSON round-trip as fallback
  return JSON.parse(JSON.stringify(files));
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Write files to WebContainer filesystem
 */
export async function writeFilesToWebContainer(
  webcontainer: WebContainerInstance,
  files: FileRecord
): Promise<void> {
  // Serialize to prevent DataCloneError
  const serializedFiles = serializeFilesForWebContainer(files);
  const cleanFiles = cloneFilesForTransfer(serializedFiles);
  
  const entries = Object.entries(cleanFiles);
  
  for (const [filePath, contents] of entries) {
    // Skip invalid paths
    if (!filePath || typeof filePath !== "string") continue;
    
    const segments = filePath.split("/").filter(Boolean);
    if (segments.length === 0) continue;
    
    // Create directory if needed
    if (segments.length > 1) {
      const directoryPath = segments.slice(0, -1).join("/");
      try {
        await webcontainer.fs.mkdir(directoryPath, { recursive: true });
      } catch (mkdirError) {
        // Directory might already exist, continue
        console.debug(`[WebContainer] mkdir ${directoryPath}:`, mkdirError);
      }
    }
    
    // Write file - ensure content is string
    const content = typeof contents === "string" ? contents : String(contents ?? "");
    await webcontainer.fs.writeFile(filePath, content);
  }
}

/**
 * Read all files from WebContainer filesystem
 */
export async function readFilesFromWebContainer(
  webcontainer: WebContainerInstance,
  basePath = "."
): Promise<FileRecord> {
  const result: FileRecord = {};
  
  async function readDirRecursive(currentPath: string): Promise<void> {
    const entries = await webcontainer.fs.readdir(currentPath);
    
    for (const entry of entries) {
      // Skip common non-source directories
      if (entry === "node_modules" || entry === ".git") continue;
      
      const fullPath = currentPath === "." ? entry : `${currentPath}/${entry}`;
      
      try {
        // Try to read as file
        const content = await webcontainer.fs.readFile(fullPath, "utf-8");
        result[fullPath] = content as string;
      } catch {
        // It's a directory, recurse
        try {
          await readDirRecursive(fullPath);
        } catch (recurseError) {
          console.debug(`[WebContainer] Skip ${fullPath}:`, recurseError);
        }
      }
    }
  }
  
  await readDirRecursive(basePath);
  return result;
}

// ============================================================================
// VITE PROJECT BUILDER (For Next.js files)
// ============================================================================

const VITE_PACKAGE_JSON = JSON.stringify({
  name: "zapdev-preview",
  version: "1.0.0",
  type: "module",
  scripts: { dev: "vite --host --port 3000" },
  dependencies: {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.469.0",
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    "tailwind-merge": "^2.5.4",
  },
  devDependencies: {
    "@vitejs/plugin-react": "^4.3.4",
    vite: "^6.0.7",
    tailwindcss: "^3.4.17",
    autoprefixer: "^10.4.20",
    postcss: "^8.5.3",
  },
}, null, 2);

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'next/link': path.resolve(__dirname, '__stubs__/next-link.tsx'),
      'next/image': path.resolve(__dirname, '__stubs__/next-image.tsx'),
      'next/navigation': path.resolve(__dirname, '__stubs__/next-navigation.ts'),
      'next/headers': path.resolve(__dirname, '__stubs__/next-headers.ts'),
      'next/font/google': path.resolve(__dirname, '__stubs__/next-font.ts'),
    },
  },
})`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./**/*.{ts,tsx}", "!./node_modules/**"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}`;

const POSTCSS_CONFIG = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZapDev Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const SRC_MAIN_TSX = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '../app/page'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`;

const SRC_INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --ring: 212.7 26.8% 83.9%;
  }
}`;

const LIB_UTILS = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`;

// Next.js stubs
const STUB_NEXT_LINK = `import React from 'react'
export default function Link({ href, children, className, ...props }: any) {
  return <a href={href} className={className} {...props}>{children}</a>
}`;

const STUB_NEXT_IMAGE = `import React from 'react'
export default function Image({ src, alt, width, height, className, fill, ...props }: any) {
  return <img src={src} alt={alt || ''} width={fill ? '100%' : width} height={fill ? '100%' : height} className={className} style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined} {...props} />
}`;

const STUB_NEXT_NAVIGATION = `export const useRouter = () => ({ push: (_: string) => {}, replace: (_: string) => {}, back: () => {}, forward: () => {}, refresh: () => {} })
export const usePathname = () => "/"
export const useSearchParams = () => new URLSearchParams()
export const useParams = () => ({})
export const redirect = (_: string) => {}
export const notFound = () => {}`;

const STUB_NEXT_HEADERS = `export const headers = () => new Headers()
export const cookies = () => ({ get: (_: string) => null, getAll: () => [], set: () => {}, delete: () => {} })`;

const STUB_NEXT_FONT = `export const Inter = () => ({ className: '', style: {} })
export const Geist = () => ({ className: '', style: {} })
export const GeistMono = () => ({ className: '', style: {} })
export const Plus_Jakarta_Sans = () => ({ className: '', style: {} })
export const Space_Grotesk = () => ({ className: '', style: {} })`;

// Shadcn UI component stubs
const SHADCN_STUBS: FileRecord = {
  "components/ui/button.tsx": `import React from 'react'
import { cn } from '@/lib/utils'

const variants: Record<string, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
}
const sizes: Record<string, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild, children, ...props }, ref) => (
    <button ref={ref} className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', variants[variant], sizes[size], className)} {...props}>{children}</button>
  )
)
Button.displayName = 'Button'
export const buttonVariants = (opts: { variant?: string; size?: string; className?: string } = {}) =>
  cn('inline-flex items-center justify-center rounded-md text-sm font-medium', variants[opts.variant ?? 'default'], sizes[opts.size ?? 'default'], opts.className)`,

  "components/ui/card.tsx": `import React from 'react'
import { cn } from '@/lib/utils'

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
))
Card.displayName = 'Card'
export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
))
CardHeader.displayName = 'CardHeader'
export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'
export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'
export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
))
CardFooter.displayName = 'CardFooter'`,

  "components/ui/input.tsx": `import React from 'react'
import { cn } from '@/lib/utils'
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input ref={ref} type={type} className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />
))
Input.displayName = 'Input'`,

  "components/ui/label.tsx": `import React from 'react'
import { cn } from '@/lib/utils'
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />
))
Label.displayName = 'Label'`,
};

function isNextJsProject(files: FileRecord): boolean {
  return Object.keys(files).some(
    (f) =>
      f === "app/page.tsx" ||
      f === "app/page.ts" ||
      f === "app/layout.tsx" ||
      (f.startsWith("app/") && f.endsWith(".tsx"))
  );
}

function isNpmProject(files: FileRecord): boolean {
  return "package.json" in files;
}

function hasLocalServerEntry(files: FileRecord): boolean {
  return "server.mjs" in files || "server.js" in files;
}

/**
 * Build a complete Vite project from agent-generated Next.js files
 */
export function buildViteProjectFiles(agentFiles: FileRecord): FileRecord {
  const result: FileRecord = { ...agentFiles };

  // Core Vite setup
  if (!("package.json" in result)) result["package.json"] = VITE_PACKAGE_JSON;
  if (!("vite.config.ts" in result)) result["vite.config.ts"] = VITE_CONFIG;
  if (!("tailwind.config.js" in result)) result["tailwind.config.js"] = TAILWIND_CONFIG;
  if (!("postcss.config.js" in result)) result["postcss.config.js"] = POSTCSS_CONFIG;
  if (!("index.html" in result)) result["index.html"] = INDEX_HTML;
  if (!("src/main.tsx" in result)) result["src/main.tsx"] = SRC_MAIN_TSX;
  if (!("src/index.css" in result)) result["src/index.css"] = SRC_INDEX_CSS;
  if (!("lib/utils.ts" in result)) result["lib/utils.ts"] = LIB_UTILS;

  // Next.js stubs
  result["__stubs__/next-link.tsx"] = STUB_NEXT_LINK;
  result["__stubs__/next-image.tsx"] = STUB_NEXT_IMAGE;
  result["__stubs__/next-navigation.ts"] = STUB_NEXT_NAVIGATION;
  result["__stubs__/next-headers.ts"] = STUB_NEXT_HEADERS;
  result["__stubs__/next-font.ts"] = STUB_NEXT_FONT;

  // Inject Shadcn stubs only for files the agent didn't generate
  for (const [stubPath, stubContent] of Object.entries(SHADCN_STUBS)) {
    if (!(stubPath in result)) {
      result[stubPath] = stubContent;
    }
  }

  return result;
}

/**
 * Determine the project type and prepare files for WebContainer
 */
export function prepareProjectFiles(files: FileRecord): {
  files: FileRecord;
  isViteProject: boolean;
  isNpmProject: boolean;
  hasServerEntry: boolean;
} {
  if (Object.keys(files).length === 0) {
    // Empty placeholder
    return {
      files: {
        "server.mjs": `import { createServer } from "node:http"
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(\`<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><h2>ZapDev Preview Ready</h2><p>No files were generated yet.</p></body></html>\`)
})
server.listen(3000, () => console.log("ready"))
`,
      },
      isViteProject: false,
      isNpmProject: false,
      hasServerEntry: true,
    };
  }

  if (isNextJsProject(files)) {
    const viteFiles = buildViteProjectFiles(files);
    return {
      files: viteFiles,
      isViteProject: true,
      isNpmProject: true,
      hasServerEntry: false,
    };
  }

  return {
    files,
    isViteProject: "vite.config.ts" in files || "vite.config.js" in files,
    isNpmProject: isNpmProject(files),
    hasServerEntry: hasLocalServerEntry(files),
  };
}

// ============================================================================
// IDLE INSTANCE CLEANUP
// ============================================================================

// Start periodic cleanup check
if (typeof window !== "undefined") {
  setInterval(() => {
    if (
      globalState.instance &&
      globalState.referenceCount === 0 &&
      Date.now() - globalState.lastUsedAt > INSTANCE_IDLE_TIMEOUT_MS
    ) {
      console.log("[WebContainer] Cleaning up idle instance...");
      void teardownWebContainer();
    }
  }, INSTANCE_CHECK_INTERVAL_MS);
  
  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (globalState.instance) {
      void teardownWebContainer();
    }
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  isNextJsProject,
  isNpmProject,
  hasLocalServerEntry,
};
