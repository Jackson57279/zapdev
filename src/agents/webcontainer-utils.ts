"use client";

import { WebContainer } from "@webcontainer/api";
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

let webContainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

async function getOrBootWebContainer(): Promise<WebContainer> {
  if (webContainerInstance) {
    return webContainerInstance;
  }

  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = WebContainer.boot().then((instance) => {
    webContainerInstance = instance;
    console.log("[WebContainer] Booted successfully");
    return instance;
  });

  return bootPromise;
}

class WebContainerBackend implements SandboxBackend {
  private container: WebContainer;
  private devServerProcess: { kill: () => void } | null = null;
  private _id: string;
  private _framework: Framework;
  private _isActive: boolean = true;
  private serverUrl: string | null = null;

  readonly type = "webcontainer" as const;
  readonly capabilities: SandboxCapabilities = {
    supportsNode: true,
    supportsPython: false,
    supportsBash: true,
    supportsBackgroundProcesses: true,
    persistsOnRefresh: false,
    maxFileSizeMB: 50,
  };

  constructor(container: WebContainer, framework: Framework) {
    this.container = container;
    this._framework = framework;
    this._id = `wc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  get id(): string {
    return this._id;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!isValidFilePath(path)) {
      throw new Error(`Invalid file path: ${path}`);
    }

    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    const parts = normalizedPath.split("/");
    
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join("/");
      await this.ensureDirectory(dirPath);
    }

    await this.container.fs.writeFile(normalizedPath, content);
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    const entries = Object.entries(files);
    
    const dirs = new Set<string>();
    for (const [path] of entries) {
      const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
      const parts = normalizedPath.split("/");
      if (parts.length > 1) {
        let dirPath = "";
        for (let i = 0; i < parts.length - 1; i++) {
          dirPath = dirPath ? `${dirPath}/${parts[i]}` : parts[i];
          dirs.add(dirPath);
        }
      }
    }
    
    const sortedDirs = Array.from(dirs).sort((a, b) => a.split("/").length - b.split("/").length);
    for (const dir of sortedDirs) {
      await this.ensureDirectory(dir);
    }
    
    await Promise.all(
      entries.map(async ([path, content]) => {
        const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
        await this.container.fs.writeFile(normalizedPath, content);
      })
    );
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await this.container.fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  async readFile(path: string): Promise<string | null> {
    if (!isValidFilePath(path)) {
      return null;
    }

    try {
      const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
      const content = await this.container.fs.readFile(normalizedPath, "utf-8");
      return content;
    } catch {
      return null;
    }
  }

  async readFiles(paths: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    await Promise.all(
      paths.filter(isValidFilePath).map(async (path) => {
        const content = await this.readFile(path);
        if (content !== null) {
          results[path] = content;
        }
      })
    );

    return results;
  }

  async listFiles(directory: string = "."): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dir: string, prefix: string = ""): Promise<void> => {
      try {
        const entries = await this.container.fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          
          if (!shouldIncludeFile(fullPath)) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(`${dir}/${entry.name}`, fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist or isn't readable
      }
    };

    await walk(directory);
    return files;
  }

  async deleteFile(path: string): Promise<void> {
    if (!isValidFilePath(path)) {
      throw new Error(`Invalid file path: ${path}`);
    }

    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    await this.container.fs.rm(normalizedPath);
  }

  async runCommand(command: string, options: CommandOptions = {}): Promise<CommandResult> {
    const { cwd, env, timeout = 60000, onStdout, onStderr } = options;
    
    const parts = command.split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);

    const process = await this.container.spawn(cmd, args, {
      cwd,
      env: env as Record<string, string>,
    });

    let stdout = "";
    let stderr = "";

    const stdoutReader = process.output.getReader();
    const stderrReader = process.exit;

    const readOutput = async (): Promise<void> => {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) break;
        const chunk = typeof value === "string" ? value : decoder.decode(value as Uint8Array);
        stdout += chunk;
        onStdout?.(chunk);
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Command timed out")), timeout);
    });

    try {
      await Promise.race([readOutput(), timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === "Command timed out") {
        process.kill();
        return { stdout, stderr, exitCode: 124 };
      }
      throw error;
    }

    const exitCode = await stderrReader;

    return { stdout, stderr, exitCode };
  }

  async spawnProcess(command: string, args: string[] = []): Promise<ProcessHandle> {
    const process = await this.container.spawn(command, args);
    
    let exitCallback: ((code: number) => void) | null = null;

    process.exit.then((code) => {
      exitCallback?.(code);
    });

    return {
      pid: `wc_${Date.now()}`,
      kill: async () => {
        process.kill();
      },
      onExit: (callback) => {
        exitCallback = callback;
      },
    };
  }

  async getServerUrl(port: number): Promise<string | null> {
    if (this.serverUrl) {
      return this.serverUrl;
    }

    return new Promise((resolve) => {
      const unsubscribe = this.container.on("server-ready", (readyPort, url) => {
        if (readyPort === port) {
          this.serverUrl = url;
          unsubscribe();
          resolve(url);
        }
      });

      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 30000);
    });
  }

  async startDevServer(framework: Framework): Promise<string> {
    const port = getFrameworkPort(framework);
    const command = getDevServerCommand(framework);
    
    console.log(`[WebContainer] Starting dev server: ${command}`);

    const parts = command.split(" ");
    const process = await this.container.spawn(parts[0], parts.slice(1));
    
    this.devServerProcess = {
      kill: () => process.kill(),
    };

    process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array);
          console.log(`[DevServer] ${text}`);
        },
      })
    );

    const url = await this.getServerUrl(port);
    
    if (!url) {
      throw new Error("Dev server failed to start within timeout");
    }

    return url;
  }

  async dispose(): Promise<void> {
    this._isActive = false;
    
    if (this.devServerProcess) {
      this.devServerProcess.kill();
      this.devServerProcess = null;
    }
  }

  isActive(): boolean {
    return this._isActive;
  }
}

export async function createWebContainerBackend(framework: Framework): Promise<SandboxBackend> {
  const container = await getOrBootWebContainer();
  return new WebContainerBackend(container, framework);
}

export async function teardownWebContainer(): Promise<void> {
  if (webContainerInstance) {
    await webContainerInstance.teardown();
    webContainerInstance = null;
    bootPromise = null;
  }
}
