import type { Sandbox } from "@e2b/code-interpreter";
import type { WebContainer } from "@webcontainer/api";
import type { Framework } from "@/agents/types";

// ---------------------------------------------------------------------------
// ISandboxAdapter — unified interface over E2B and WebContainer
// ---------------------------------------------------------------------------

/**
 * Abstraction layer over E2B sandboxes and WebContainers.
 *
 * Both implementations expose the same operations so the agent pipeline
 * (code-agent.ts, tools.ts) can work with either backend transparently.
 *
 * The factory `createSandboxAdapter()` checks the feature flag
 * `NEXT_PUBLIC_USE_WEBCONTAINERS` to decide which implementation to use.
 */
export interface ISandboxAdapter {
  /** Unique identifier for this sandbox instance. */
  readonly id: string;

  /** Write multiple files into the sandbox. */
  writeFiles(files: Record<string, string>): Promise<void>;

  /** Read a single file. Returns `null` if the file doesn't exist. */
  readFile(path: string): Promise<string | null>;

  /** Run a shell command and return stdout, stderr, and exit code. */
  runCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;

  /** Start the framework-specific dev server. Returns the preview URL. */
  startDevServer(framework: Framework): Promise<string>;

  /** Run `npm run build` and return error output, or `null` on success. */
  runBuildCheck(): Promise<string | null>;

  /** Get the preview URL for the running dev server. */
  getPreviewUrl(framework: Framework): Promise<string>;

  /** Clean up resources (kill processes, tear down sandbox). */
  cleanup(): Promise<void>;
}

// ---------------------------------------------------------------------------
// E2BSandboxAdapter — wraps existing sandbox-utils functions
// ---------------------------------------------------------------------------

/**
 * Adapter that delegates to the existing E2B sandbox-utils.ts functions.
 *
 * This is a thin wrapper that preserves 100% of the existing E2B behaviour.
 * When `NEXT_PUBLIC_USE_WEBCONTAINERS` is `false` (the default), this adapter
 * is used and the agent pipeline behaves identically to before.
 */
export class E2BSandboxAdapter implements ISandboxAdapter {
  readonly id: string;
  private sandbox: Sandbox;

  constructor(sandbox: Sandbox) {
    this.sandbox = sandbox;
    this.id = sandbox.sandboxId;
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    // Lazy import to avoid pulling E2B deps when using WebContainer
    const { writeFilesBatch } = await import("@/agents/sandbox-utils");
    await writeFilesBatch(this.sandbox, files);
  }

  async readFile(path: string): Promise<string | null> {
    const { readFileFast } = await import("@/agents/sandbox-utils");
    return readFileFast(this.sandbox, path);
  }

  async runCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    const { runCodeCommand } = await import("@/agents/sandbox-utils");
    return runCodeCommand(this.sandbox, command);
  }

  async startDevServer(framework: Framework): Promise<string> {
    const { startDevServer } = await import("@/agents/sandbox-utils");
    return startDevServer(this.sandbox, framework);
  }

  async runBuildCheck(): Promise<string | null> {
    const { runBuildCheck } = await import("@/agents/sandbox-utils");
    return runBuildCheck(this.sandbox);
  }

  async getPreviewUrl(framework: Framework): Promise<string> {
    const { getSandboxUrl } = await import("@/agents/sandbox-utils");
    return getSandboxUrl(this.sandbox, framework);
  }

  async cleanup(): Promise<void> {
    try {
      await this.sandbox.kill();
    } catch {
      // Sandbox may already be dead — ignore
    }
  }

  /** Expose the underlying E2B Sandbox for operations that need it directly. */
  getSandbox(): Sandbox {
    return this.sandbox;
  }
}

// ---------------------------------------------------------------------------
// WebContainerAdapter — delegates to webcontainer-*.ts modules
// ---------------------------------------------------------------------------

/**
 * Adapter that delegates to the WebContainer modules created in tasks 9-12.
 *
 * This runs in the browser. The agent pipeline on the server cannot use this
 * directly — it's intended for client-side build validation and preview.
 *
 * NOTE: In the hybrid architecture (Option C from the plan), the agent still
 * runs server-side. This adapter is used when the client-side preview engine
 * needs to perform sandbox-like operations (file mounting, build checks, etc.).
 */
export class WebContainerAdapter implements ISandboxAdapter {
  readonly id: string;
  private wc: WebContainer;

  constructor(wc: WebContainer) {
    this.wc = wc;
    this.id = `webcontainer-${Date.now()}`;
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    const { mountFiles } = await import("@/lib/webcontainer-sync");
    await mountFiles(this.wc, files);
  }

  async readFile(path: string): Promise<string | null> {
    try {
      // Normalise path — strip /home/user/ prefix if present
      let normalised = path;
      if (normalised.startsWith("/home/user/")) {
        normalised = normalised.slice("/home/user/".length);
      }
      if (normalised.startsWith("/")) {
        normalised = normalised.slice(1);
      }

      const content = await this.wc.fs.readFile(normalised, "utf-8");
      return content;
    } catch {
      return null;
    }
  }

  async runCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    // Parse command into cmd + args for WebContainer spawn
    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      const process = await this.wc.spawn(cmd, args);

      const chunks: string[] = [];
      const reader = process.output.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const exitCode = await process.exit;
      const output = chunks.join("");

      return {
        stdout: output,
        stderr: "", // WebContainer merges stdout/stderr into output
        exitCode,
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  async startDevServer(framework: Framework): Promise<string> {
    const { startDevServer } = await import("@/lib/webcontainer-process");
    const info = await startDevServer(this.wc, framework);
    return info.url;
  }

  async runBuildCheck(): Promise<string | null> {
    const { runBuildCheckCompat } = await import("@/lib/webcontainer-build");
    return runBuildCheckCompat(this.wc);
  }

  async getPreviewUrl(_framework: Framework): Promise<string> {
    // WebContainer URLs are provided by the server-ready event.
    // If the dev server is already running, we can't easily retrieve the URL
    // without re-listening. Return a placeholder that the UI can override.
    return `webcontainer://${this.id}`;
  }

  async cleanup(): Promise<void> {
    const { teardownWebContainer } = await import("@/lib/webcontainer");
    teardownWebContainer();
  }

  /** Expose the underlying WebContainer for operations that need it directly. */
  getWebContainer(): WebContainer {
    return this.wc;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateSandboxAdapterOptions {
  /** Override the feature flag. If not provided, reads NEXT_PUBLIC_USE_WEBCONTAINERS. */
  useWebContainers?: boolean;
}

/**
 * Create the appropriate sandbox adapter based on the feature flag.
 *
 * - `NEXT_PUBLIC_USE_WEBCONTAINERS=true` → WebContainerAdapter
 * - `NEXT_PUBLIC_USE_WEBCONTAINERS=false` (default) → E2BSandboxAdapter
 *
 * The E2B path creates a new sandbox via `createSandbox()`.
 * The WebContainer path boots the singleton via `getWebContainer()`.
 */
export async function createSandboxAdapter(
  framework: Framework,
  options?: CreateSandboxAdapterOptions
): Promise<ISandboxAdapter> {
  const isServer = typeof window === "undefined";
  const useWC =
    !isServer &&
    (options?.useWebContainers ??
      process.env.NEXT_PUBLIC_USE_WEBCONTAINERS === "true");

  if (useWC) {
    const { getWebContainer } = await import("@/lib/webcontainer");
    const wc = await getWebContainer();
    return new WebContainerAdapter(wc);
  }

  // Default: E2B (always used server-side, regardless of feature flag)
  const { createSandbox } = await import("@/agents/sandbox-utils");
  const sandbox = await createSandbox(framework);
  return new E2BSandboxAdapter(sandbox);
}
