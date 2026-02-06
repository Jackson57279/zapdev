import { NextRequest, NextResponse } from "next/server";
import { subscribe } from "@inngest/realtime";
import { inngest, agentChannel } from "@/inngest/client";
import type { StreamEvent } from "@/agents/code-agent";

const encoder = new TextEncoder();

function formatSSE(event: StreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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

    const runId = generateRunId();

    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();

    (async () => {
      let subscriptionStream: Awaited<ReturnType<typeof subscribe>> | null = null;
      let writerClosed = false;

      const safeWrite = async (data: Uint8Array) => {
        if (writerClosed) return;
        try {
          await writer.write(data);
        } catch {
          writerClosed = true;
        }
      };

      const safeClose = async () => {
        if (writerClosed) return;
        writerClosed = true;
        try {
          await writer.close();
        } catch {
          /* noop */
        }
      };

      try {
        await inngest.send({
          name: "code-agent/run.requested",
          data: {
            runId,
            projectId,
            value,
            model: model || "auto",
          },
        });

        console.log("[Agent Run] Triggered Inngest event:", { runId, projectId });

        subscriptionStream = await subscribe(
          {
            app: inngest,
            channel: agentChannel(runId),
            topics: ["event"],
          },
          async (message) => {
            const event = message.data as StreamEvent;
            await safeWrite(formatSSE(event));

            if (event.type === "complete" || event.type === "error") {
              await subscriptionStream?.cancel();
            }
          }
        );

        await subscriptionStream;
      } catch (error) {
        console.error("[Agent Run] Error during execution:", error);
        const errorEvent: StreamEvent = {
          type: "error",
          data:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        };
        await safeWrite(formatSSE(errorEvent));
      } finally {
        await subscriptionStream?.cancel();
        await safeClose();
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
