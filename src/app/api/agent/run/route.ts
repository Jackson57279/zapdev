import { NextRequest, NextResponse } from "next/server";
import { runCodeAgent, type StreamEvent } from "@/agents/code-agent";

const encoder = new TextEncoder();

function formatSSE(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, value, model } = body;

    console.log("[Agent Run] Received request:", {
      projectId,
      valueLength: value?.length || 0,
      model,
      timestamp: new Date().toISOString(),
    });

    if (!projectId || !value) {
      console.error("[Agent Run] Missing required fields:", {
        hasProjectId: !!projectId,
        hasValue: !!value,
      });
      return NextResponse.json(
        { error: "Missing required fields: projectId and value" },
        { status: 400 }
      );
    }

    const stream = new TransformStream<StreamEvent, Uint8Array>({
      transform(event, controller) {
        controller.enqueue(formatSSE(event));
      },
    });

    const writer = stream.writable.getWriter();

    (async () => {
      try {
        for await (const event of runCodeAgent({
          projectId,
          value,
          model: model || "auto",
        })) {
          await writer.write(event);
        }
      } catch (error) {
        console.error("[Agent Run] Error during execution:", error);
        const errorEvent: StreamEvent = {
          type: "error",
          data:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        };
        await writer.write(errorEvent);
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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

export const maxDuration = 300;
