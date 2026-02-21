import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, value, model, runSource } = body as {
      projectId?: unknown;
      value?: unknown;
      model?: unknown;
      runSource?: unknown;
    };

    console.log("[Agent Run] Received request:", {
      projectId,
      valueLength: typeof value === "string" ? value.length : 0,
      model,
      runSource,
      timestamp: new Date().toISOString(),
    });

    if (typeof projectId !== "string" || projectId.trim().length === 0 || typeof value !== "string" || value.trim().length === 0) {
      console.error("[Agent Run] Missing required fields:", {
        hasProjectId: typeof projectId === "string" && projectId.trim().length > 0,
        hasValue: typeof value === "string" && value.trim().length > 0,
      });
      return NextResponse.json(
        { error: "Missing required fields: projectId and value" },
        { status: 400 }
      );
    }

    const normalizedRunSource =
      runSource === "webcontainer" || runSource === "e2b" ? runSource : "e2b";

    await inngest.send({
      name: normalizedRunSource === "webcontainer" ? "agent/code-webcontainer.run" : "agent/code-agent-kit.run",
      data: {
        projectId,
        value,
        model: typeof model === "string" && model.trim().length > 0 ? model : undefined,
      },
    });

    return NextResponse.json(
      {
        accepted: true,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Agent Run] Failed to process request:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
