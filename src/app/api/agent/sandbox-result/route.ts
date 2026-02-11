import { NextRequest, NextResponse } from "next/server";
import { resolveRequest } from "@/lib/sandbox-bridge";
import { resolveSandboxResponse } from "@/agents/code-agent";
import type { SandboxResponse } from "@/lib/sandbox-adapter";

/**
 * POST /api/agent/sandbox-result
 *
 * Called by the client after executing a sandbox request in WebContainer.
 * The client sends the result, which resolves the server-side Promise
 * that the agent is waiting on.
 *
 * Tries both resolution paths:
 * 1. code-agent.ts PENDING_SANDBOX_REQUESTS (used by Inngest-driven agent runs)
 * 2. sandbox-bridge.ts pending map (used by direct/standalone sandbox operations)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sandboxId, response } = body as {
      sandboxId: string;
      response: SandboxResponse;
    };

    if (!sandboxId || !response || !response.requestId) {
      return NextResponse.json(
        { error: "Missing sandboxId or response with requestId" },
        { status: 400 }
      );
    }

    // Try the code-agent pending map first (Inngest agent runs),
    // then fall back to the sandbox-bridge map (standalone operations).
    const resolved =
      resolveSandboxResponse(sandboxId, response) ||
      resolveRequest(sandboxId, response);

    if (!resolved) {
      console.warn(
        `[sandbox-result] No pending request found for sandbox=${sandboxId} request=${response.requestId}`
      );
      return NextResponse.json(
        { error: "No pending request found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sandbox-result] Error processing result:", error);
    return NextResponse.json(
      { error: "Failed to process sandbox result" },
      { status: 500 }
    );
  }
}
