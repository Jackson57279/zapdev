import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import type { Framework } from "@/agents/types";

/**
 * WebContainer Process Management — npm install and dev server spawning.
 *
 * Mirrors the E2B sandbox-utils.ts patterns (startDevServer, getDevServerCommand,
 * getFrameworkPort) but targets the browser-side WebContainer runtime.
 */

/** Callback for streaming process output to the UI. */
export type ProcessOutputCallback = (data: string) => void;

/** Result of a completed process. */
export interface ProcessResult {
  exitCode: number;
  output: string;
}

/** Dev server info returned after startup. */
export interface DevServerInfo {
  /** The URL where the dev server can be reached (from WebContainer's server-ready event). */
  url: string;
  /** The port the server is listening on. */
  port: number;
  /** The spawned process handle — call `.kill()` to stop the server. */
  process: WebContainerProcess;
}

// ---------------------------------------------------------------------------
// Framework-specific configuration (mirrors sandbox-utils.ts)
// ---------------------------------------------------------------------------

function getFrameworkPort(framework: Framework): number {
  switch (framework) {
    case "nextjs":
      return 3000;
    case "angular":
      return 4200;
    case "react":
    case "vue":
    case "svelte":
      return 5173;
    default:
      return 3000;
  }
}

function getDevCommand(framework: Framework): { cmd: string; args: string[] } {
  switch (framework) {
    case "nextjs":
      return { cmd: "npm", args: ["run", "dev"] };
    case "angular":
      return { cmd: "npm", args: ["run", "start", "--", "--host", "0.0.0.0", "--port", "4200"] };
    case "react":
    case "vue":
    case "svelte":
      return { cmd: "npm", args: ["run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"] };
    default:
      return { cmd: "npm", args: ["run", "dev"] };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pipe a ReadableStream<string> into a callback, collecting all chunks.
 * Returns the concatenated output when the stream closes.
 */
async function collectOutput(
  stream: ReadableStream<string>,
  onData?: ProcessOutputCallback
): Promise<string> {
  const chunks: string[] = [];
  const reader = stream.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      onData?.(value);
    }
  } finally {
    reader.releaseLock();
  }

  return chunks.join("");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run `npm install` inside the WebContainer and wait for it to complete.
 *
 * @param wc - Booted WebContainer instance
 * @param onOutput - Optional callback to stream stdout/stderr to the UI
 * @returns The process result with exit code and full output
 */
export async function installDependencies(
  wc: WebContainer,
  onOutput?: ProcessOutputCallback
): Promise<ProcessResult> {
  console.log("[webcontainer-process] Running npm install...");

  const process = await wc.spawn("npm", ["install"]);

  // Collect output in background while we wait for exit
  const outputPromise = collectOutput(process.output, onOutput);
  const exitCode = await process.exit;
  const output = await outputPromise;

  if (exitCode !== 0) {
    console.error(
      `[webcontainer-process] npm install failed (exit ${exitCode}):`,
      output.slice(0, 500)
    );
  } else {
    console.log("[webcontainer-process] npm install completed successfully");
  }

  return { exitCode, output };
}

/**
 * Start the framework-specific dev server and wait for the `server-ready` event.
 *
 * The WebContainer emits `server-ready` when the server is listening and
 * ready to accept requests — no polling needed (unlike E2B's curl loop).
 *
 * @param wc - Booted WebContainer instance
 * @param framework - Which framework to start
 * @param onOutput - Optional callback to stream stdout/stderr to the UI
 * @param timeoutMs - How long to wait for server-ready (default: 60 000 ms)
 * @returns DevServerInfo with the preview URL, port, and process handle
 */
export async function startDevServer(
  wc: WebContainer,
  framework: Framework,
  onOutput?: ProcessOutputCallback,
  timeoutMs = 60_000
): Promise<DevServerInfo> {
  const expectedPort = getFrameworkPort(framework);
  const { cmd, args } = getDevCommand(framework);

  console.log(
    `[webcontainer-process] Starting dev server: ${cmd} ${args.join(" ")} (expecting port ${expectedPort})`
  );

  // Set up the server-ready listener BEFORE spawning so we don't miss the event
  const serverReady = new Promise<{ port: number; url: string }>(
    (resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(
          new Error(
            `Dev server did not become ready within ${timeoutMs / 1000}s`
          )
        );
      }, timeoutMs);

      const unsubscribe = wc.on("server-ready", (port, url) => {
        console.log(
          `[webcontainer-process] server-ready on port ${port}: ${url}`
        );
        clearTimeout(timer);
        unsubscribe();
        resolve({ port, url });
      });
    }
  );

  const process = await wc.spawn(cmd, args);

  // Stream output in background (don't await — server runs indefinitely)
  collectOutput(process.output, onOutput).catch(() => {
    // Stream closed when process exits — expected
  });

  const { port, url } = await serverReady;

  console.log(`[webcontainer-process] Dev server ready at ${url}`);

  return { url, port, process };
}

/**
 * Kill a running dev server process gracefully.
 */
export function killProcess(proc: WebContainerProcess): void {
  try {
    proc.kill();
    console.log("[webcontainer-process] Process killed");
  } catch (error) {
    console.warn("[webcontainer-process] Failed to kill process:", error);
  }
}
