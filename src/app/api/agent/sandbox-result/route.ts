import { NextRequest, NextResponse } from "next/server";
import { resolveRequest } from "@/lib/sandbox-bridge";
import type { SandboxResponse } from "@/lib/sandbox-adapter";

/**
 * POST /api/agent/sandbox-result
 *
 * Called by the client after executing a sandbox request in WebContainer.
 * The client sends the result, which resolves the server-side Promise
 * that the agent is waiting on.
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

    const resolved = resolveRequest(sandboxId, response);

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
