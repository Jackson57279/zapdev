import type { WebContainer } from "@webcontainer/api";
import type { Framework } from "@/agents/types";

// ---------------------------------------------------------------------------
// ISandboxAdapter — unified interface over sandbox backends
// ---------------------------------------------------------------------------

/**
 * Abstraction layer over sandbox implementations.
 *
 * Both implementations expose the same operations so the agent pipeline
 * (code-agent.ts, tools.ts) can work with either backend transparently.
 *
 * - `WebContainerAdapter`: Runs client-side in the browser
 * - `DeferredSandboxAdapter`: Used server-side, delegates to client via callbacks
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
// SandboxRequest / SandboxResponse — Protocol types for deferred execution
// ---------------------------------------------------------------------------

/**
 * Base request fields shared by all sandbox requests.
 */
interface BaseRequest {
  /** Unique identifier for this request, used to correlate responses. */
  id: string;
}

/**
 * Request to write multiple files into the sandbox.
 */
export interface WriteFilesRequest extends BaseRequest {
  type: "write-files";
  files: Record<string, string>;
}

/**
 * Request to read a single file from the sandbox.
 */
export interface ReadFileRequest extends BaseRequest {
  type: "read-file";
  path: string;
}

/**
 * Request to run a shell command in the sandbox.
 */
export interface RunCommandRequest extends BaseRequest {
  type: "run-command";
  command: string;
}

/**
 * Request to start the dev server for a given framework.
 */
export interface StartDevServerRequest extends BaseRequest {
  type: "start-dev-server";
  framework: string;
}

/**
 * Request to run a build check (npm run build).
 */
export interface BuildCheckRequest extends BaseRequest {
  type: "build-check";
}

/**
 * Request to get the preview URL for a running dev server.
 */
export interface GetPreviewUrlRequest extends BaseRequest {
  type: "get-preview-url";
  framework: string;
}

/**
 * Request to clean up sandbox resources.
 */
export interface CleanupRequest extends BaseRequest {
  type: "cleanup";
}

/**
 * Discriminated union of all sandbox request types.
 *
 * The agent sends these requests to the client via SSE events.
 * The client executes them in WebContainer and POSTs the result back.
 */
export type SandboxRequest =
  | WriteFilesRequest
  | ReadFileRequest
  | RunCommandRequest
  | StartDevServerRequest
  | BuildCheckRequest
  | GetPreviewUrlRequest
  | CleanupRequest;

/**
 * Response to a write-files request.
 */
export interface WriteFilesResponse {
  type: "write-files";
  requestId: string;
  success: true;
}

/**
 * Response to a read-file request.
 */
export interface ReadFileResponse {
  type: "read-file";
  requestId: string;
  content: string | null;
}

/**
 * Response to a run-command request.
 */
export interface RunCommandResponse {
  type: "run-command";
  requestId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Response to a start-dev-server request.
 */
export interface StartDevServerResponse {
  type: "start-dev-server";
  requestId: string;
  url: string;
}

/**
 * Response to a build-check request.
 */
export interface BuildCheckResponse {
  type: "build-check";
  requestId: string;
  /** Error output if build failed, null if successful. */
  error: string | null;
}

/**
 * Response to a get-preview-url request.
 */
export interface GetPreviewUrlResponse {
  type: "get-preview-url";
  requestId: string;
  url: string;
}

/**
 * Response to a cleanup request.
 */
export interface CleanupResponse {
  type: "cleanup";
  requestId: string;
  success: true;
}

/**
 * Error response for any request that failed.
 */
export interface ErrorResponse {
  type: "error";
  requestId: string;
  error: string;
}

/**
 * Discriminated union of all sandbox response types.
 *
 * The client sends these responses after executing sandbox requests.
 */
export type SandboxResponse =
  | WriteFilesResponse
  | ReadFileResponse
  | RunCommandResponse
  | StartDevServerResponse
  | BuildCheckResponse
  | GetPreviewUrlResponse
  | CleanupResponse
  | ErrorResponse;

// ---------------------------------------------------------------------------
// DeferredSandboxAdapter — delegates operations to client via callback
// ---------------------------------------------------------------------------

/**
 * Callback type for sending sandbox requests to the client.
 *
 * The agent runner provides this callback, which:
 * 1. Serializes the request as an SSE event
 * 2. Waits for the client to execute it in WebContainer
 * 3. Returns the response when the client POSTs it back
 */
export type SendRequestCallback = (
  request: SandboxRequest
) => Promise<SandboxResponse>;

/**
 * Generates a unique request ID.
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Adapter that delegates sandbox operations to the client via a callback.
 *
 * This adapter is used SERVER-SIDE by the agent. Each method creates a
 * request object and passes it to the `sendRequest` callback provided
 * at construction time.
 *
 * Architecture:
 * 1. Agent calls a method (e.g., `runCommand("npm run build")`)
 * 2. Method creates a `SandboxRequest` with unique ID
 * 3. Request is passed to `sendRequest` callback
 * 4. Callback yields SSE event to client
 * 5. Client executes request in WebContainer
 * 6. Client POSTs response back
 * 7. Callback resolves with the response
 * 8. Method extracts and returns the relevant data
 *
 * @example
 * ```typescript
 * const adapter = new DeferredSandboxAdapter(async (request) => {
 *   yield { type: "sandbox-request", data: request };
 *   return await waitForClientResponse(request.id);
 * });
 *
 * await adapter.runCommand("npm run build");
 * ```
 */
export class DeferredSandboxAdapter implements ISandboxAdapter {
  readonly id: string;
  private sendRequest: SendRequestCallback;

  constructor(sendRequest: SendRequestCallback) {
    this.sendRequest = sendRequest;
    this.id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  async writeFiles(files: Record<string, string>): Promise<void> {
    const request: WriteFilesRequest = {
      type: "write-files",
      id: generateRequestId(),
      files,
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
  }

  async readFile(path: string): Promise<string | null> {
    const request: ReadFileRequest = {
      type: "read-file",
      id: generateRequestId(),
      path,
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
    if (response.type !== "read-file") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return response.content;
  }

  async runCommand(command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    const request: RunCommandRequest = {
      type: "run-command",
      id: generateRequestId(),
      command,
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
    if (response.type !== "run-command") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return {
      stdout: response.stdout,
      stderr: response.stderr,
      exitCode: response.exitCode,
    };
  }

  async startDevServer(framework: Framework): Promise<string> {
    const request: StartDevServerRequest = {
      type: "start-dev-server",
      id: generateRequestId(),
      framework,
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
    if (response.type !== "start-dev-server") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return response.url;
  }

  async runBuildCheck(): Promise<string | null> {
    const request: BuildCheckRequest = {
      type: "build-check",
      id: generateRequestId(),
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
    if (response.type !== "build-check") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return response.error;
  }

  async getPreviewUrl(framework: Framework): Promise<string> {
    const request: GetPreviewUrlRequest = {
      type: "get-preview-url",
      id: generateRequestId(),
      framework,
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
    if (response.type !== "get-preview-url") {
      throw new Error(`Unexpected response type: ${response.type}`);
    }
    return response.url;
  }

  async cleanup(): Promise<void> {
    const request: CleanupRequest = {
      type: "cleanup",
      id: generateRequestId(),
    };
    const response = await this.sendRequest(request);
    if (response.type === "error") {
      throw new Error(response.error);
    }
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

/**
 * Options for creating a sandbox adapter.
 */
export interface CreateSandboxAdapterOptions {
  /**
   * Callback for sending sandbox requests to the client.
   * The callback receives a request object and must return a Promise
   * that resolves with the client's response.
   */
  sendRequest: SendRequestCallback;
}

/**
 * Create a DeferredSandboxAdapter with the provided callback.
 *
 * The adapter delegates all sandbox operations to the client via the
 * `sendRequest` callback. This is used server-side in the agent runner.
 *
 * @example
 * ```typescript
 * const adapter = await createSandboxAdapter({
 *   sendRequest: async (request) => {
 *     // Send request to client via SSE
 *     emitSSE({ type: "sandbox-request", data: request });
 *     // Wait for client response
 *     return await waitForResponse(request.id);
 *   },
 * });
 *
 * await adapter.writeFiles({ "src/App.tsx": "..." });
 * await adapter.runCommand("npm run build");
 * ```
 */
export async function createSandboxAdapter(
  options: CreateSandboxAdapterOptions
): Promise<ISandboxAdapter> {
  console.log("[SANDBOX] Creating DeferredSandboxAdapter");
  return new DeferredSandboxAdapter(options.sendRequest);
}
