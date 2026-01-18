import type { Framework, ExpoPreviewMode } from "./types";

export type RuntimeType = "webcontainer" | "e2b";

export interface SandboxInterface {
  sandboxId: string;
  runtimeType: RuntimeType;
  files: {
    write: (path: string, content: string) => Promise<void>;
    read: (path: string) => Promise<string>;
    list: (path?: string) => Promise<string[]>;
  };
  commands: {
    run: (cmd: string, opts?: CommandOptions) => Promise<CommandResult>;
  };
  teardown: () => Promise<void>;
  onServerReady?: (callback: (port: number, url: string) => void) => void;
}

export interface CommandOptions {
  timeoutMs?: number;
  background?: boolean;
  cwd?: string;
  env?: Record<string, string>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface WebContainerBootOptions {
  workdirName?: string;
  forwardPreviewErrors?: boolean;
}

let webcontainerModule: typeof import("@webcontainer/api") | null = null;
let webcontainerInstance: InstanceType<typeof import("@webcontainer/api").WebContainer> | null = null;

async function getWebContainerModule() {
  if (!webcontainerModule) {
    webcontainerModule = await import("@webcontainer/api");
  }
  return webcontainerModule;
}

export function canUseWebContainers(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  
  try {
    return typeof SharedArrayBuffer !== "undefined" && crossOriginIsolated;
  } catch {
    return false;
  }
}

export async function createWebContainerSandbox(
  framework: Framework,
  options?: WebContainerBootOptions
): Promise<SandboxInterface> {
  const { WebContainer } = await getWebContainerModule();
  
  if (webcontainerInstance) {
    await webcontainerInstance.teardown();
    webcontainerInstance = null;
  }

  webcontainerInstance = await WebContainer.boot({
    workdirName: options?.workdirName ?? `zapdev-${Date.now()}`,
    forwardPreviewErrors: options?.forwardPreviewErrors ?? true,
  });

  const sandboxId = `wc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let serverReadyCallback: ((port: number, url: string) => void) | null = null;

  webcontainerInstance.on("server-ready", (port, url) => {
    console.log(`[WebContainer] Server ready at ${url} (port ${port})`);
    serverReadyCallback?.(port, url);
  });

  const sandbox: SandboxInterface = {
    sandboxId,
    runtimeType: "webcontainer",

    files: {
      write: async (path: string, content: string) => {
        const fullPath = path.startsWith("/") ? path : `/${path}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dir && dir !== "/") {
          await webcontainerInstance!.fs.mkdir(dir, { recursive: true });
        }
        await webcontainerInstance!.fs.writeFile(fullPath, content);
      },

      read: async (path: string) => {
        const fullPath = path.startsWith("/") ? path : `/${path}`;
        const content = await webcontainerInstance!.fs.readFile(fullPath, "utf-8");
        return content;
      },

      list: async (path?: string) => {
        const targetPath = path || "/";
        const entries = await webcontainerInstance!.fs.readdir(targetPath, { withFileTypes: true });
        return entries.map((entry) => (typeof entry === "string" ? entry : entry.name));
      },
    },

    commands: {
      run: async (cmd: string, opts?: CommandOptions) => {
        const parts = cmd.split(" ");
        const command = parts[0];
        const args = parts.slice(1);

        const process = await webcontainerInstance!.spawn(command, args, {
          cwd: opts?.cwd,
          env: opts?.env,
        });

        if (opts?.background) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }

        // Timeout handling: race between process exit and timeout
        const timeoutMs = opts?.timeoutMs ?? 300000; // Default 5 minutes
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs)
        );

        const exitCodePromise = process.exit.then((code: number) => code);
        const exitCode = await Promise.race([exitCodePromise, timeoutPromise]);

        let stdout = "";
        let stderr = "";

        const reader = process.output.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            stdout += value;
          }
        } finally {
          reader.releaseLock();
        }

        return { stdout, stderr, exitCode };
      },
    },

    teardown: async () => {
      if (webcontainerInstance) {
        await webcontainerInstance.teardown();
        webcontainerInstance = null;
      }
    },

    onServerReady: (callback) => {
      serverReadyCallback = callback;
    },
  };

  return sandbox;
}

export interface FileSystemTree {
  [name: string]: FileSystemNode;
}

export type FileSystemNode = FileNode | DirectoryNode;

export interface FileNode {
  file: {
    contents: string | Uint8Array;
  };
}

export interface DirectoryNode {
  directory: FileSystemTree;
}

export function filesToFileSystemTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [path, content] of Object.entries(files)) {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    const parts = normalizedPath.split("/");
    let current = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      const node = current[part];
      if ("directory" in node) {
        current = node.directory;
      }
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = {
      file: { contents: content },
    };
  }

  return tree;
}

export async function mountFiles(
  sandbox: SandboxInterface,
  files: Record<string, string>
): Promise<void> {
  if (sandbox.runtimeType !== "webcontainer") {
    // Use parallel writes for better performance (O(1) vs O(N) latency)
    const writePromises = Object.entries(files).map(async ([path, content]) => {
      await sandbox.files.write(path, content);
    });
    await Promise.all(writePromises);
    return;
  }

  const { WebContainer } = await getWebContainerModule();
  if (!webcontainerInstance) {
    throw new Error("WebContainer not initialized");
  }

  const tree = filesToFileSystemTree(files);
  await webcontainerInstance.mount(tree);
  console.log(`[WebContainer] Mounted ${Object.keys(files).length} files`);
}

export function getWebContainerDevCommand(framework: Framework, expoPreviewMode?: ExpoPreviewMode): string {
  switch (framework) {
    case "nextjs":
      return "npm run dev";
    case "angular":
      return "npm run start -- --host 0.0.0.0 --port 4200";
    case "react":
    case "vue":
    case "svelte":
      return "npm run dev -- --host 0.0.0.0";
    case "expo":
      if (expoPreviewMode === "web" || !expoPreviewMode) {
        return "npx expo start --web --port 8081";
      }
      return "npx expo start --web --port 8081";
    default:
      return "npm run dev";
  }
}

export function getWebContainerPort(framework: Framework): number {
  switch (framework) {
    case "nextjs":
      return 3000;
    case "angular":
      return 4200;
    case "react":
    case "vue":
    case "svelte":
      return 5173;
    case "expo":
      return 8081;
    default:
      return 3000;
  }
}

export async function startWebContainerDevServer(
  sandbox: SandboxInterface,
  framework: Framework
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Dev server startup timed out after 60 seconds"));
    }, 60000);

    sandbox.onServerReady?.((port, url) => {
      clearTimeout(timeout);
      console.log(`[WebContainer] Dev server ready at ${url}`);
      resolve(url);
    });

    const devCommand = getWebContainerDevCommand(framework);
    console.log(`[WebContainer] Starting dev server with: ${devCommand}`);

    sandbox.commands.run(devCommand, { background: true }).catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function installDependencies(sandbox: SandboxInterface): Promise<void> {
  console.log("[WebContainer] Installing dependencies...");
  const result = await sandbox.commands.run("npm install", { timeoutMs: 120000 });

  if (result.exitCode !== 0) {
    console.error("[WebContainer] npm install failed:", result.stderr || result.stdout);
    throw new Error(`npm install failed with exit code ${result.exitCode}`);
  }

  console.log("[WebContainer] Dependencies installed successfully");
}

export async function runWebContainerBuildCheck(sandbox: SandboxInterface): Promise<string | null> {
  console.log("[WebContainer] Running build check...");
  const result = await sandbox.commands.run("npm run build", { timeoutMs: 120000 });

  // Check for missing script by examining npm error output (exit code 1 = script missing, exit code 127 = command not found)
  const isMissingScript = result.exitCode === 1 && (result.stderr.includes("Missing script") || result.stdout.includes("Missing script"));

  if (isMissingScript) {
    console.warn("[WebContainer] Build script not found, skipping");
    return null;
  }

  if (result.exitCode !== 0) {
    const output = result.stdout + result.stderr;
    console.log(`[WebContainer] Build failed with exit code: ${result.exitCode}`);
    return `Build failed (exit code ${result.exitCode}):\n${output}`;
  }

  console.log("[WebContainer] Build check passed");
  return null;
}

export function getWebContainerSandboxUrl(sandboxId: string, framework: Framework): string {
  const port = getWebContainerPort(framework);
  return `http://localhost:${port}`;
}
