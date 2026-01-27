import type { WebContainer } from "@webcontainer/api";
import type { ProcessOutputCallback } from "./webcontainer-process";

/**
 * WebContainer Build Validation — client-side build & lint checks.
 *
 * Mirrors the E2B `runBuildCheck()` from sandbox-utils.ts (lines 236-262)
 * and the `AUTO_FIX_ERROR_PATTERNS` (lines 432-441) so the auto-fix loop
 * in code-agent.ts can consume errors in the same format.
 */

/** Timeout for build commands — matches E2B's 120s timeout. */
const BUILD_TIMEOUT_MS = 120_000;

/** Timeout for lint commands. */
const LINT_TIMEOUT_MS = 60_000;

/**
 * Error patterns that should trigger the auto-fix loop.
 * Identical to sandbox-utils.ts AUTO_FIX_ERROR_PATTERNS.
 */
export const AUTO_FIX_ERROR_PATTERNS = [
  /Error:/i,
  /\[ERROR\]/i,
  /ERROR/,
  /Failed\b/i,
  /failure\b/i,
  /Exception\b/i,
  /SyntaxError/i,
  /TypeError/i,
  /ReferenceError/i,
  /Module not found/i,
  /Cannot find module/i,
  /Build failed/i,
  /Compilation error/i,
];

/**
 * Check whether a message contains patterns that warrant an auto-fix attempt.
 */
export function shouldTriggerAutoFix(message?: string): boolean {
  if (!message) return false;
  return AUTO_FIX_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Structured result from a build or lint check. */
export interface BuildCheckResult {
  /** Whether the check passed (exit code 0). */
  success: boolean;
  /** Exit code of the process. */
  exitCode: number;
  /** Combined stdout + stderr output. */
  output: string;
  /**
   * Error string in the same format code-agent.ts expects from E2B's
   * `runBuildCheck()`: `null` on success, or
   * `"Build failed (exit code N):\n<output>"` on failure.
   */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Spawn a command, collect its output, and enforce a timeout.
 *
 * Returns `{ exitCode, output }`. On timeout the process is killed and
 * an exit code of 1 is returned with a timeout error message.
 */
async function runCommand(
  wc: WebContainer,
  cmd: string,
  args: string[],
  timeoutMs: number,
  onOutput?: ProcessOutputCallback
): Promise<{ exitCode: number; output: string }> {
  const process = await wc.spawn(cmd, args);

  const chunks: string[] = [];

  // Collect output in background
  const outputDone = (async () => {
    const reader = process.output.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        onOutput?.(value);
      }
    } finally {
      reader.releaseLock();
    }
  })();

  // Race between process exit and timeout
  const exitCode = await Promise.race([
    process.exit,
    new Promise<number>((resolve) => {
      setTimeout(() => {
        try {
          process.kill();
        } catch {
          // already exited
        }
        resolve(1);
        chunks.push(`\n[timeout] Process killed after ${timeoutMs / 1000}s\n`);
      }, timeoutMs);
    }),
  ]);

  // Wait for output stream to drain
  await outputDone.catch(() => {
    // Stream may close abruptly on kill — that's fine
  });

  return { exitCode, output: chunks.join("") };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run `npm run build` inside the WebContainer and return structured results.
 *
 * Return format is compatible with the E2B `runBuildCheck()` contract:
 * - Returns `{ error: null }` on success
 * - Returns `{ error: "Build failed (exit code N):\n<output>" }` on failure
 *
 * This allows code-agent.ts to consume the result identically regardless
 * of whether the build ran in E2B or WebContainer.
 *
 * @param wc - Booted WebContainer instance
 * @param onOutput - Optional callback to stream build output to the UI
 */
export async function runBuildCheck(
  wc: WebContainer,
  onOutput?: ProcessOutputCallback
): Promise<BuildCheckResult> {
  console.log("[webcontainer-build] Running build check...");

  try {
    const { exitCode, output } = await runCommand(
      wc,
      "npm",
      ["run", "build"],
      BUILD_TIMEOUT_MS,
      onOutput
    );

    if (exitCode === 127) {
      // Build script not found — skip (same as E2B behaviour)
      console.warn("[webcontainer-build] Build script not found, skipping");
      return { success: true, exitCode, output, error: null };
    }

    if (exitCode !== 0) {
      const errorMsg = `Build failed (exit code ${exitCode}):\n${output}`;
      console.error(
        `[webcontainer-build] ${errorMsg.slice(0, 500)}`
      );
      return { success: false, exitCode, output, error: errorMsg };
    }

    console.log("[webcontainer-build] Build check passed");
    return { success: true, exitCode, output, error: null };
  } catch (error) {
    const errorMsg = `Build check error: ${error instanceof Error ? error.message : String(error)}`;
    console.error("[webcontainer-build]", errorMsg);
    return { success: false, exitCode: 1, output: "", error: errorMsg };
  }
}

/**
 * Run `npm run lint` inside the WebContainer and return structured results.
 *
 * @param wc - Booted WebContainer instance
 * @param onOutput - Optional callback to stream lint output to the UI
 */
export async function runLintCheck(
  wc: WebContainer,
  onOutput?: ProcessOutputCallback
): Promise<BuildCheckResult> {
  console.log("[webcontainer-build] Running lint check...");

  try {
    const { exitCode, output } = await runCommand(
      wc,
      "npm",
      ["run", "lint"],
      LINT_TIMEOUT_MS,
      onOutput
    );

    if (exitCode === 127) {
      // Lint script not found — skip
      console.warn("[webcontainer-build] Lint script not found, skipping");
      return { success: true, exitCode, output, error: null };
    }

    if (exitCode !== 0) {
      const errorMsg = `Lint failed (exit code ${exitCode}):\n${output}`;
      console.error(
        `[webcontainer-build] ${errorMsg.slice(0, 500)}`
      );
      return { success: false, exitCode, output, error: errorMsg };
    }

    console.log("[webcontainer-build] Lint check passed");
    return { success: true, exitCode, output, error: null };
  } catch (error) {
    const errorMsg = `Lint check error: ${error instanceof Error ? error.message : String(error)}`;
    console.error("[webcontainer-build]", errorMsg);
    return { success: false, exitCode: 1, output: "", error: errorMsg };
  }
}

/**
 * Convenience: run build check and return just the error string (or null).
 *
 * This is a drop-in replacement for the E2B `runBuildCheck()` signature
 * which returns `string | null`.
 */
export async function runBuildCheckCompat(
  wc: WebContainer,
  onOutput?: ProcessOutputCallback
): Promise<string | null> {
  const result = await runBuildCheck(wc, onOutput);
  return result.error;
}
