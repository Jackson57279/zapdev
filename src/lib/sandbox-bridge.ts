import type { SandboxRequest, SandboxResponse } from "@/lib/sandbox-adapter";

/**
 * Sandbox Bridge — in-memory store for pending sandbox requests.
 *
 * Architecture:
 * 1. Agent (server) calls adapter.runCommand() → DeferredSandboxAdapter.sendRequest()
 * 2. sendRequest calls createPendingRequest() which stores a Promise resolver
 * 3. The request is yielded as an SSE event to the client
 * 4. Client executes in WebContainer and POSTs result to /api/agent/sandbox-result
 * 5. POST handler calls resolveRequest() which resolves the stored Promise
 * 6. Agent continues with the result
 */

interface PendingRequest {
  resolve: (response: SandboxResponse) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

/**
 * Map of sandboxId → Map of requestId → PendingRequest
 */
const pending = new Map<string, Map<string, PendingRequest>>();

/** Timeout for pending requests (2 minutes). */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Register a pending sandbox request.
 * Returns a Promise that resolves when the client sends the response.
 */
export function createPendingRequest(
  sandboxId: string,
  requestId: string
): Promise<SandboxResponse> {
  if (!pending.has(sandboxId)) {
    pending.set(sandboxId, new Map());
  }

  return new Promise<SandboxResponse>((resolve, reject) => {
    const sandboxPending = pending.get(sandboxId)!;
    
    // Set up timeout
    const timer = setTimeout(() => {
      sandboxPending.delete(requestId);
      if (sandboxPending.size === 0) pending.delete(sandboxId);
      reject(new Error(`Sandbox request ${requestId} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
    }, REQUEST_TIMEOUT_MS);

    sandboxPending.set(requestId, {
      resolve: (response) => {
        clearTimeout(timer);
        sandboxPending.delete(requestId);
        if (sandboxPending.size === 0) pending.delete(sandboxId);
        resolve(response);
      },
      reject: (error) => {
        clearTimeout(timer);
        sandboxPending.delete(requestId);
        if (sandboxPending.size === 0) pending.delete(sandboxId);
        reject(error);
      },
      createdAt: Date.now(),
    });
  });
}

/**
 * Resolve a pending sandbox request with the client's response.
 * Returns true if the request was found and resolved, false otherwise.
 */
export function resolveRequest(
  sandboxId: string,
  response: SandboxResponse
): boolean {
  const sandboxPending = pending.get(sandboxId);
  if (!sandboxPending) return false;

  const entry = sandboxPending.get(response.requestId);
  if (!entry) return false;

  entry.resolve(response);
  return true;
}

/**
 * Reject all pending requests for a sandbox (e.g., on disconnect).
 */
export function rejectAllForSandbox(sandboxId: string, reason: string): void {
  const sandboxPending = pending.get(sandboxId);
  if (!sandboxPending) return;

  for (const [, entry] of sandboxPending) {
    entry.reject(new Error(reason));
  }
  pending.delete(sandboxId);
}

/**
 * Check if there are any pending requests for a sandbox.
 */
export function hasPendingRequests(sandboxId: string): boolean {
  return (pending.get(sandboxId)?.size ?? 0) > 0;
}
