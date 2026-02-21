import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, value, model } = body as {
      projectId?: unknown;
      value?: unknown;
      model?: unknown;
    };

    if (
      typeof projectId !== "string" ||
      projectId.trim().length === 0 ||
      typeof value !== "string" ||
      value.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields: projectId and value" },
        { status: 400 }
      );
    }

    await inngest.send({
      name: "agent/code-agent-kit.run",
      data: {
        projectId,
        value,
        model: typeof model === "string" && model.trim().length > 0 ? model : undefined,
      },
    });

    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    console.error("[Agent Run] Failed to process request:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
