import { Sandbox } from "@e2b/code-interpreter";
import { SANDBOX_TIMEOUT, type Framework } from "./types";

const SANDBOX_CACHE = new Map<string, Sandbox>();
const PROJECT_SANDBOX_MAP = new Map<string, string>();
const CACHE_EXPIRY_MS = 10 * 60 * 1000;

const clearCacheEntry = (sandboxId: string) => {
  setTimeout(() => {
    SANDBOX_CACHE.delete(sandboxId);
  }, CACHE_EXPIRY_MS);
};

async function waitForSandboxReady(sandbox: Sandbox, maxAttempts = 15): Promise<void> {
  console.log("[DEBUG] Waiting for sandbox runtime to initialize...");

  // Use shell commands only - no Python kernel dependency
  // This is faster and more reliable since shell is ready before Python
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check shell is working and /home/user directory exists
      const result = await sandbox.commands.run('test -d /home/user && echo "ready"', {
        timeoutMs: 5000
      });

      if (result.exitCode === 0 && result.stdout.includes("ready")) {
        console.log(`[DEBUG] Sandbox ready after ${attempt} attempt(s)`);
        return;
      }

      // Exit code != 0 means /home/user doesn't exist yet
      if (attempt <= 3) {
        console.log(`[DEBUG] Sandbox not ready (attempt ${attempt}/${maxAttempts}): waiting for filesystem`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code || (error as any)?.status;
      const isPortNotReady =
        errorMsg.includes('port is not open') ||
        errorMsg.includes('502') ||
        errorCode === 502 ||
        errorMsg.includes('ECONNREFUSED');

      if (attempt <= 3 || isPortNotReady) {
        console.log(`[DEBUG] Sandbox not ready (attempt ${attempt}/${maxAttempts}): ${isPortNotReady ? 'port initializing' : errorMsg}`);
      }
    }

    if (attempt < maxAttempts) {
      // Progressive delay: 1s -> 1.5s -> 2s, capped at 3s
      const delay = Math.min(1000 + (attempt * 200), 3000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we get here, sandbox never became ready - throw error
  const errorMessage = `E2B sandbox failed to initialize after ${maxAttempts} attempts. Please try again.`;
  console.error("[ERROR]", errorMessage);
  throw new Error(errorMessage);
}

export async function getSandbox(sandboxId: string): Promise<Sandbox> {
  const cached = SANDBOX_CACHE.get(sandboxId);
  if (cached) {
    return cached;
  }

  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    await sandbox.setTimeout(SANDBOX_TIMEOUT);

    // Verify sandbox is responsive before caching (use fewer attempts for reconnection)
    await waitForSandboxReady(sandbox, 10);

    SANDBOX_CACHE.set(sandboxId, sandbox);
    clearCacheEntry(sandboxId);

    console.log(`[DEBUG] Connected to sandbox ${sandboxId}`);
    return sandbox;
  } catch (error) {
    console.error("[ERROR] Failed to connect to E2B sandbox:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`E2B sandbox connection failed: ${errorMessage}`);
  }
}

export async function getOrCreateSandboxForProject(
  projectId: string,
  framework: Framework
): Promise<Sandbox> {
  const existingSandboxId = PROJECT_SANDBOX_MAP.get(projectId);
  
  if (existingSandboxId) {
    try {
      const sandbox = await getSandbox(existingSandboxId);
      console.log(`[DEBUG] Reusing existing sandbox ${existingSandboxId} for project ${projectId}`);
      return sandbox;
    } catch {
      PROJECT_SANDBOX_MAP.delete(projectId);
    }
  }
  
  const sandbox = await createSandbox(framework);
  PROJECT_SANDBOX_MAP.set(projectId, sandbox.sandboxId);
  return sandbox;
}

export async function createSandbox(framework: Framework): Promise<Sandbox> {
  try {
    const templateName = getE2BTemplate(framework);
    console.log(`[DEBUG] Creating sandbox with template: ${templateName}`);

    const sandbox = await Sandbox.create(templateName, {
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: SANDBOX_TIMEOUT,
    });

    console.log("[DEBUG] Sandbox created:", sandbox.sandboxId);
    await sandbox.setTimeout(SANDBOX_TIMEOUT);

    // Wait for sandbox to be fully ready before returning
    await waitForSandboxReady(sandbox);

    SANDBOX_CACHE.set(sandbox.sandboxId, sandbox);
    clearCacheEntry(sandbox.sandboxId);

    return sandbox;
  } catch (error) {
    console.error("[ERROR] Failed to create E2B sandbox:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`E2B sandbox creation failed: ${errorMessage}`);
  }
}

// Command execution using shell (no Python kernel dependency)
export async function runCodeCommand(
  sandbox: Sandbox,
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  console.log("[DEBUG] Running command:", command);

  try {
    // Run command directly in shell with timeout
    const result = await sandbox.commands.run(`cd /home/user && ${command}`, {
      timeoutMs: 120000, // 2 minute timeout for build commands
    });

    console.log("[DEBUG] Command completed:", {
      exitCode: result.exitCode,
      stdoutLength: result.stdout?.length || 0,
      stderrLength: result.stderr?.length || 0,
    });

    if (result.exitCode !== 0 && result.stderr) {
      console.log("[ERROR] Command failed:", result.stderr.substring(0, 300));
    }

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode,
    };
  } catch (error) {
    console.error("[ERROR] Command execution exception:", error);
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    };
  }
}

// Write files using native E2B files API (no Python kernel dependency)
export async function writeFilesBatch(
  sandbox: Sandbox,
  files: Record<string, string>
): Promise<void> {
  const entries = Object.entries(files);
  if (entries.length === 0) {
    console.log("[DEBUG] No files to write");
    return;
  }

  console.log("[DEBUG] Writing", entries.length, "files using native API");

  // Create directories first using shell commands (fast and reliable)
  const dirs = new Set<string>();
  for (const [path] of entries) {
    const fullPath = path.startsWith('/') ? path : `/home/user/${path}`;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir && dir !== '/home/user') {
      dirs.add(dir);
    }
  }

  if (dirs.size > 0) {
    const mkdirCmd = `mkdir -p ${Array.from(dirs).map(d => `"${d}"`).join(' ')}`;
    try {
      await sandbox.commands.run(mkdirCmd, { timeoutMs: 10000 });
    } catch (error) {
      console.warn("[WARN] mkdir failed, continuing anyway:", error);
    }
  }

  // Write files using native E2B files API
  const writePromises = entries.map(async ([path, content]) => {
    const fullPath = path.startsWith('/') ? path : `/home/user/${path}`;
    try {
      await sandbox.files.write(fullPath, content);
      console.log(`[DEBUG] Written: ${path}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to write ${path}: ${errorMsg}`);
    }
  });

  try {
    // Add timeout wrapper for file writes (30 seconds total)
    const allWritesPromise = Promise.all(writePromises);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("File write operation timed out after 30 seconds")), 30000)
    );

    await Promise.race([allWritesPromise, timeoutPromise]);
    console.log("[INFO] Batch file write completed successfully");
  } catch (error) {
    console.error("[ERROR] Batch file write failed:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write files: ${errorMsg}`);
  }
}

// Fast build check using Python subprocess
export async function runBuildCheck(
  sandbox: Sandbox
): Promise<string | null> {
  try {
    console.log("[DEBUG] Running build check...");

    const result = await runCodeCommand(sandbox, "npm run build");
    const output = result.stdout + result.stderr;

    if (result.exitCode === 127) {
      console.warn("[WARN] Build script not found, skipping");
      return null;
    }

    if (result.exitCode !== 0) {
      console.log(`[ERROR] Build failed with exit code: ${result.exitCode}`);
      console.log("[ERROR] Build output:", output.substring(0, 1000));
      return `Build failed (exit code ${result.exitCode}):\n${output}`;
    }

    console.log("[INFO] Build check passed");
    return null;
  } catch (error) {
    console.error("[ERROR] Build check exception:", error);
    return `Build check error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Clean .next directory using shell command (no Python dependency)
export async function cleanNextDirectory(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.commands.run("rm -rf /home/user/.next", { timeoutMs: 10000 });
  } catch (error) {
    console.warn("[WARN] Failed to clean .next directory:", error);
  }
}

// List files using shell find command (no Python dependency)
export async function listFiles(
  sandbox: Sandbox,
  directory: string = "/home/user"
): Promise<string[]> {
  try {
    const excludes = "node_modules .git .next dist build";
    const excludeArgs = excludes.split(' ').map(d => `-not -path '*/${d}/*'`).join(' ');
    const cmd = `find "${directory}" -type f ${excludeArgs} 2>/dev/null | sed 's|^${directory}/||'`;

    const result = await sandbox.commands.run(cmd, { timeoutMs: 15000 });
    if (result.exitCode !== 0 || !result.stdout) {
      return [];
    }

    return result.stdout.trim().split('\n').filter(f => f.length > 0);
  } catch (error) {
    console.warn("[WARN] Failed to list files:", error);
    return [];
  }
}

// Read file using native E2B files API (no Python kernel dependency)
export async function readFileFast(
  sandbox: Sandbox,
  path: string
): Promise<string | null> {
  try {
    const fullPath = path.startsWith('/') ? path : `/home/user/${path}`;
    const content = await sandbox.files.read(fullPath);
    return typeof content === 'string' ? content : null;
  } catch (error) {
    console.warn(`[WARN] Failed to read ${path}:`, error);
    return null;
  }
}

export function getE2BTemplate(framework: Framework): string {
  switch (framework) {
    case "nextjs": return "zapdev";
    case "angular": return "zapdev-angular";
    case "react": return "zapdev-react";
    case "vue": return "zapdev-vue";
    case "svelte": return "zapdev-svelte";
    default: return "zapdev";
  }
}

export function getFrameworkPort(framework: Framework): number {
  switch (framework) {
    case "nextjs": return 3000;
    case "angular": return 4200;
    case "react":
    case "vue":
    case "svelte": return 5173;
    default: return 3000;
  }
}

export function getDevServerCommand(framework: Framework): string {
  switch (framework) {
    case "nextjs": return "npm run dev";
    case "angular": return "npm run start -- --host 0.0.0.0 --port 4200";
    case "react":
    case "vue":
    case "svelte": return "npm run dev -- --host 0.0.0.0 --port 5173";
    default: return "npm run dev";
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 500;
const FILE_READ_TIMEOUT_MS = 5000;

const ALLOWED_WORKSPACE_PATHS = ["/home/user", "."];

export const isValidFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== "string") return false;
  const normalizedPath = filePath.trim();
  if (normalizedPath.length === 0 || normalizedPath.length > 4096) return false;
  if (normalizedPath.includes("..")) return false;
  if (normalizedPath.includes("\0") || normalizedPath.includes("\n") || normalizedPath.includes("\r")) return false;
  
  const isInWorkspace = ALLOWED_WORKSPACE_PATHS.some(
    (basePath) => normalizedPath === basePath || 
                   normalizedPath.startsWith(`${basePath}/`) || 
                   normalizedPath.startsWith(`./`)
  );
  
  return isInWorkspace || normalizedPath.startsWith("/home/user/") || !normalizedPath.startsWith("/");
};

export const readFileWithTimeout = async (
  sandbox: Sandbox,
  filePath: string,
  timeoutMs: number = FILE_READ_TIMEOUT_MS
): Promise<string | null> => {
  if (!isValidFilePath(filePath)) return null;
  try {
    const readPromise = sandbox.files.read(filePath);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const content = await Promise.race([readPromise, timeoutPromise]);
    if (content === null) return null;
    if (typeof content === "string" && content.length > MAX_FILE_SIZE) return null;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
};

export const readFilesInBatches = async (
  sandbox: Sandbox,
  filePaths: string[],
  batchSize: number = 50
): Promise<Record<string, string>> => {
  const allFilesMap: Record<string, string> = {};
  const validFilePaths = filePaths.filter(isValidFilePath).slice(0, MAX_FILE_COUNT);
  
  for (let i = 0; i < validFilePaths.length; i += batchSize) {
    const batch = validFilePaths.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const content = await readFileWithTimeout(sandbox, filePath);
        return { filePath, content };
      })
    );
    for (const { filePath, content } of batchResults) {
      if (content !== null) allFilesMap[filePath] = content;
    }
  }
  
  return allFilesMap;
};

export const getFindCommand = (framework: Framework): string => {
  const ignorePatterns = ["node_modules", ".git", "dist", "build"];
  if (framework === "nextjs") ignorePatterns.push(".next");
  if (framework === "svelte") ignorePatterns.push(".svelte-kit");
  
  return `find /home/user -type f -not -path '*/${ignorePatterns.join('/* -not -path */')}/*' 2>/dev/null`;
};

// Skipping lint check for speed (as requested)
export const runLintCheck = async (_sandboxId: string): Promise<null> => null;

export const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i, /\[ERROR\]/i, /ERROR/, /Failed\b/i, /failure\b/i,
  /Exception\b/i, /SyntaxError/i, /TypeError/i, /ReferenceError/i,
  /Module not found/i, /Cannot find module/i, /Build failed/i, /Compilation error/i,
];

export const shouldTriggerAutoFix = (message?: string): boolean => {
  if (!message) return false;
  return AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

type SandboxWithHost = Sandbox & { getHost?: (port: number) => string | undefined };

export async function getSandboxUrl(sandbox: Sandbox, framework: Framework): Promise<string> {
  const port = getFrameworkPort(framework);
  
  if (typeof (sandbox as SandboxWithHost).getHost === "function") {
    try {
      const host = (sandbox as SandboxWithHost).getHost!(port);
      if (host && host.length > 0) {
        const url = host.startsWith("http") ? host : `https://${host}`;
        return url;
      }
    } catch {}
  }
  
  return `https://${port}-${sandbox.sandboxId}.e2b.dev`;
}

export async function startDevServer(sandbox: Sandbox, framework: Framework): Promise<string> {
  const port = getFrameworkPort(framework);
  const devCommand = getDevServerCommand(framework);

  console.log(`[INFO] Starting dev server for ${framework} on port ${port}...`);
  console.log(`[DEBUG] Dev command: ${devCommand}`);

  try {
    sandbox.commands.run(devCommand, { background: true });
    console.log("[DEBUG] Dev server started in background");
  } catch (error) {
    console.error("[ERROR] Failed to start dev server:", error);
    throw new Error(`Failed to start dev server: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("[DEBUG] Waiting for dev server to be ready...");
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const result = await runCodeCommand(sandbox, `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`);
      if (result.stdout.trim() === "200") {
        const readyTime = (i + 1) * 0.5;
        console.log(`[INFO] Dev server ready after ${readyTime}s`);
        return getSandboxUrl(sandbox, framework);
      }
    } catch (error) {
      console.log(`[DEBUG] Ping attempt ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.warn("[WARN] Dev server did not respond within 30s, using fallback URL");
  try {
    return getSandboxUrl(sandbox, framework);
  } catch (error) {
    console.error("[ERROR] Failed to get sandbox URL:", error);
    throw new Error(`Failed to get sandbox URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}
