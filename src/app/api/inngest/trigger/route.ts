import { inngest } from "@/inngest/client";
import { getAgentEventName } from "@/lib/agent-mode";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, value, model, messageId, specMode, isSpecRevision, isFromApprovedSpec } = body;

    console.log("[Inngest Trigger] Received request:", {
      projectId,
      valueLength: value?.length || 0,
      model,
      specMode,
      isSpecRevision,
      isFromApprovedSpec,
      timestamp: new Date().toISOString(),
    });

    if (!projectId || !value) {
      console.error("[Inngest Trigger] Missing required fields:", {
        hasProjectId: !!projectId,
        hasValue: !!value,
      });
      return Response.json(
        { error: "Missing required fields: projectId and value" },
        { status: 400 }
      );
    }

    // Determine which event to trigger
    let eventName: string;
    
    // If spec mode is enabled and not from an approved spec, trigger spec planning
    if (specMode && !isFromApprovedSpec) {
      eventName = "spec-agent/run";
      console.log("[Inngest Trigger] Triggering spec planning mode");
    } else {
      // Normal code generation flow
      eventName = getAgentEventName();
    }

    console.log("[Inngest Trigger] Sending event:", {
      eventName,
      projectId,
      model: model || "auto",
    });

    await inngest.send({
      name: eventName,
      data: {
        value,
        projectId,
        messageId,
        model: model || "auto", // Default to "auto" if not specified
        isSpecRevision: isSpecRevision || false,
      },
    });

    console.log("[Inngest Trigger] Event sent successfully");
    return Response.json({ success: true });
  } catch (error) {
    console.error("[Inngest Trigger] Failed to trigger event:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return Response.json(
      { 
        error: "Failed to trigger event",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
