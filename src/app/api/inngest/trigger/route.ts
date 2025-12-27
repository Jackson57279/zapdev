import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, value, model, messageId, specMode, isSpecRevision, isFromApprovedSpec } = body;

    console.log("[Agent Trigger] Received request:", {
      projectId,
      valueLength: value?.length || 0,
      model,
      specMode,
      isSpecRevision,
      isFromApprovedSpec,
      timestamp: new Date().toISOString(),
    });

    if (!projectId || !value) {
      console.error("[Agent Trigger] Missing required fields:", {
        hasProjectId: !!projectId,
        hasValue: !!value,
      });
      return NextResponse.json(
        { error: "Missing required fields: projectId and value" },
        { status: 400 }
      );
    }

    const mode = specMode && !isFromApprovedSpec ? 'spec' : 'fast';

    console.log("[Agent Trigger] Calling agent with:", {
      projectId,
      model: model || "auto",
      mode,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Fire-and-forget: agent updates Convex directly, frontend subscribes to changes
    fetch(`${baseUrl}/api/agent/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        value,
        model: model || 'auto',
        mode,
        messageId,
        isSpecRevision: isSpecRevision || false,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        console.error("[Agent Trigger] Agent API returned error:", response.status);
        return;
      }

      // Consume the stream to ensure the agent runs to completion
      const reader = response.body?.getReader();
      if (reader) {
        try {
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        } catch (error) {
          console.error("[Agent Trigger] Stream reading error:", error);
        }
      }

      console.log("[Agent Trigger] Agent completed");
    }).catch((error) => {
      console.error("[Agent Trigger] Failed to call agent:", error);
    });

    console.log("[Agent Trigger] Request dispatched successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Agent Trigger] Failed to trigger agent:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { 
        error: "Failed to trigger agent",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
