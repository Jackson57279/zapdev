import { Sandbox } from "@e2b/code-interpreter";
import type { 
  SandboxBackend, 
  SandboxCapabilities, 
  CommandResult, 
  CommandOptions, 
  ProcessHandle 
} from "./sandbox";
import type { Framework } from "./types";
import { 
  getFrameworkPort, 
  getDevServerCommand, 
  isValidFilePath,
  shouldIncludeFile 
} from "./sandbox";
import { SANDBOX_TIMEOUT } from "./types";

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY = 10 * 60 * 1000;

function clearCacheEntry(sandboxId: string): void {
  setTimeout(() => {
    SANDBOX_CACHE.delete(sandboxId);
  }, CACHE_EXPIRY);
}

class E2BBackend implements SandboxBackend {
  private sandbox: Sandbox;
  private _framework: Framework;
  private _isActive: boolean = true;

  readonly type = "e2b" as const;
  readonly capabilities: SandboxCapabilities = {
    supportsNode: true,
    supportsPython: true,
    supportsBash: true,
    supportsBackgroundProcesses: true,
    persistsOnRefresh: true,
    maxFileSizeMB: 100,
  };

  constructor(sandbox: Sandbox, framework: Framework) {
    this.sandbox = sandbox;
    this._framework = framework;
  }

  get id(): string {
    return this.sandbox.sandboxId;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!isValidFilePath(path)) {
      throw new Error(`Invalid file path: ${path}`);
    }

    const fullPath = path.startsWith("/") ? path : `/home/user/${path}`;
    await this.sandbox.files.write(fullPath, content);
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    if (Object.keys(files).length === 0) return;

    const fileWrites = Object.entries(files).map(([path, content]) => {
      const fullPath = path.startsWith("/") ? path : `/home/user/${path}`;
      const escapedContent = content
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
      return `
dir_path = os.path.dirname("${fullPath}")
os.makedirs(dir_path, exist_ok=True)
with open("${fullPath}", "w") as f:
    f.write("${escapedContent}")`;
    }).join("\n");

    const pythonScript = `
import os
${fileWrites}
`;

    await this.sandbox.runCode(pythonScript);
  }

  async readFile(path: string): Promise<string | null> {
    if (!isValidFilePath(path)) {
      return null;
    }

    try {
      const fullPath = path.startsWith("/") ? path : `/home/user/${path}`;
      const content = await this.sandbox.files.read(fullPath);
      return typeof content === "string" ? content : null;
    } catch {
      return null;
    }
  }

  async readFiles(paths: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const validPaths = paths.filter(isValidFilePath);

    const batchSize = 50;
    for (let i = 0; i < validPaths.length; i += batchSize) {
      const batch = validPaths.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          const content = await this.readFile(filePath);
          return { filePath, content };
        })
      );
      for (const { filePath, content } of batchResults) {
        if (content !== null) {
          results[filePath] = content;
        }
      }
    }

    return results;
  }

  async listFiles(directory: string = "/home/user"): Promise<string[]> {
    const pythonScript = `
import os
import json

def list_files(path):
    files = []
    for root, dirs, filenames in os.walk(path):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.next', 'dist', 'build']]
        for filename in filenames:
            rel_path = os.path.relpath(os.path.join(root, filename), path)
            files.append(rel_path)
    return files

files = list_files("${directory}")
print(json.dumps(files))
`;

    const result = await this.sandbox.runCode(pythonScript);
    try {
      const files: string[] = JSON.parse(result.logs.stdout.join(""));
      return files.filter(shouldIncludeFile);
    } catch {
      return [];
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!isValidFilePath(path)) {
      throw new Error(`Invalid file path: ${path}`);
    }

    const fullPath = path.startsWith("/") ? path : `/home/user/${path}`;
    await this.runCommand(`rm -f "${fullPath}"`);
  }

  async runCommand(command: string, options: CommandOptions = {}): Promise<CommandResult> {
    const { onStdout, onStderr } = options;
    
    const buffers = { stdout: "", stderr: "" };

    try {
      const result = await this.sandbox.commands.run(command, {
        onStdout: (data: string) => {
          buffers.stdout += data;
          onStdout?.(data);
        },
        onStderr: (data: string) => {
          buffers.stderr += data;
          onStderr?.(data);
        },
      });

      return {
        stdout: result.stdout || buffers.stdout,
        stderr: result.stderr || buffers.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (error) {
      return {
        stdout: buffers.stdout,
        stderr: buffers.stderr + (error instanceof Error ? error.message : String(error)),
        exitCode: 1,
      };
    }
  }

  async spawnProcess(command: string, args: string[] = []): Promise<ProcessHandle> {
    const fullCommand = args.length > 0 ? `${command} ${args.join(" ")}` : command;
    
    this.sandbox.commands.run(fullCommand, { background: true });

    return {
      pid: `e2b_${Date.now()}`,
      kill: async () => {
        await this.runCommand(`pkill -f "${command}"`);
      },
      onExit: () => {
        // E2B background processes don't have exit callbacks
      },
    };
  }

  async getServerUrl(port: number): Promise<string | null> {
    type SandboxWithHost = Sandbox & { getHost?: (port: number) => string | undefined };
    
    if (typeof (this.sandbox as SandboxWithHost).getHost === "function") {
      try {
        const host = (this.sandbox as SandboxWithHost).getHost!(port);
        if (host && host.length > 0) {
          return host.startsWith("http") ? host : `https://${host}`;
        }
      } catch {
        // Fall through to default URL
      }
    }

    return `https://${port}-${this.sandbox.sandboxId}.e2b.dev`;
  }

  async startDevServer(framework: Framework): Promise<string> {
    const port = getFrameworkPort(framework);
    const devCommand = getDevServerCommand(framework);

    console.log(`[E2B] Starting dev server: ${devCommand}`);

    this.sandbox.commands.run(devCommand, { background: true });

    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const result = await this.runCommand(
          `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`
        );
        if (result.stdout.trim() === "200") {
          console.log(`[E2B] Dev server ready after ${(i + 1) * 0.5}s`);
          return (await this.getServerUrl(port)) ?? "";
        }
      } catch {
        // Server not ready yet
      }
    }

    console.warn("[E2B] Dev server did not respond, using fallback URL");
    return (await this.getServerUrl(port)) ?? "";
  }

  async dispose(): Promise<void> {
    this._isActive = false;
    SANDBOX_CACHE.delete(this.sandbox.sandboxId);
  }

  isActive(): boolean {
    return this._isActive;
  }
}

export async function createE2BBackend(framework: Framework): Promise<SandboxBackend> {
  try {
    console.log("[E2B] Creating sandbox...");
    const sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: SANDBOX_TIMEOUT,
    });

    console.log("[E2B] Sandbox created:", sandbox.sandboxId);
    await sandbox.setTimeout(SANDBOX_TIMEOUT);

    SANDBOX_CACHE.set(sandbox.sandboxId, sandbox);
    clearCacheEntry(sandbox.sandboxId);

    return new E2BBackend(sandbox, framework);
  } catch (error) {
    console.error("[E2B] Failed to create sandbox:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`E2B sandbox creation failed: ${errorMessage}`);
  }
}

export async function connectE2BBackend(
  sandboxId: string,
  framework: Framework
): Promise<SandboxBackend> {
  const cached = SANDBOX_CACHE.get(sandboxId);
  if (cached) {
    return new E2BBackend(cached, framework);
  }

  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    await sandbox.setTimeout(SANDBOX_TIMEOUT);

    SANDBOX_CACHE.set(sandboxId, sandbox);
    clearCacheEntry(sandboxId);

    return new E2BBackend(sandbox, framework);
  } catch (error) {
    console.error("[E2B] Failed to connect to sandbox:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`E2B sandbox connection failed: ${errorMessage}`);
  }
}

export async function runBuildCheck(backend: SandboxBackend): Promise<string | null> {
  try {
    console.log("[E2B] Running build check...");

    const result = await backend.runCommand("npm run build");
    const output = result.stdout + result.stderr;

    if (result.exitCode === 127) {
      console.warn("[E2B] Build script not found, skipping");
      return null;
    }

    if (result.exitCode !== 0) {
      console.log("[E2B] Build failed with exit code:", result.exitCode);
      if (/Error:|failed/i.test(output) && !/warning/i.test(output)) {
        return `Build failed:\n${output}`;
      }
    }

    console.log("[E2B] Build check passed");
    return null;
  } catch (error) {
    console.error("[E2B] Build check failed:", error);
    return null;
  }
}

export async function cleanNextDirectory(backend: SandboxBackend): Promise<void> {
  try {
    await backend.runCommand("rm -rf .next");
  } catch (error) {
    console.warn("[E2B] Failed to clean .next directory:", error);
  }
}
