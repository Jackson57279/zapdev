import type { Framework } from "./types";
import type {
  SandboxBackend,
  SandboxBackendType,
  SandboxCapabilities,
  CommandResult,
  CommandOptions,
  ProcessHandle,
} from "./sandbox";

let instanceCounter = 0;

export class MemoryBackend implements SandboxBackend {
  private files: Map<string, string> = new Map();
  private _id: string;
  private _framework: Framework;
  private _active: boolean = true;

  readonly type: SandboxBackendType = "memory" as SandboxBackendType;
  
  readonly capabilities: SandboxCapabilities = {
    supportsNode: false,
    supportsPython: false,
    supportsBash: false,
    supportsBackgroundProcesses: false,
    persistsOnRefresh: false,
    maxFileSizeMB: 10,
  };

  constructor(framework: Framework) {
    this._id = `memory-${Date.now()}-${++instanceCounter}`;
    this._framework = framework;
    console.log(`[Memory] Backend created: ${this._id}`);
  }

  get id(): string {
    return this._id;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    this.files.set(normalizedPath, content);
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      await this.writeFile(path, content);
    }
  }

  async readFile(path: string): Promise<string | null> {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    return this.files.get(normalizedPath) ?? null;
  }

  async readFiles(paths: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const path of paths) {
      const content = await this.readFile(path);
      if (content !== null) {
        result[path] = content;
      }
    }
    return result;
  }

  async listFiles(directory?: string): Promise<string[]> {
    const allPaths = Array.from(this.files.keys());
    if (!directory) {
      return allPaths;
    }
    const normalizedDir = directory.startsWith("/") ? directory.slice(1) : directory;
    return allPaths.filter(p => p.startsWith(normalizedDir));
  }

  async deleteFile(path: string): Promise<void> {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    this.files.delete(normalizedPath);
  }

  async runCommand(command: string, _options?: CommandOptions): Promise<CommandResult> {
    console.log(`[Memory] Command deferred to client WebContainer: ${command}`);
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };
  }

  async spawnProcess(_command: string, _args?: string[]): Promise<ProcessHandle> {
    return {
      pid: `memory-${Date.now()}`,
      kill: async () => {},
      onExit: (_callback: (code: number) => void) => {},
    };
  }

  async getServerUrl(_port: number): Promise<string | null> {
    return null;
  }

  async startDevServer(_framework: Framework): Promise<string> {
    console.log(`[Memory] Dev server deferred to client WebContainer`);
    return "webcontainer://pending";
  }

  async dispose(): Promise<void> {
    this._active = false;
    this.files.clear();
    console.log(`[Memory] Backend disposed: ${this._id}`);
  }

  isActive(): boolean {
    return this._active;
  }

  getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, content] of this.files.entries()) {
      result[path] = content;
    }
    return result;
  }

  getFileCount(): number {
    return this.files.size;
  }
}

export async function createMemoryBackend(framework: Framework): Promise<SandboxBackend> {
  return new MemoryBackend(framework);
}
