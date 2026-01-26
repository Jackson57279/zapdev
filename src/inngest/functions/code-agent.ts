import { inngest, agentChannel } from "../client";
import { runCodeAgent, type StreamEvent } from "@/agents/code-agent";
import type { CodeAgentRunRequestedData } from "../types";

export const runCodeAgentFunction = inngest.createFunction(
  {
    id: "code-agent-run",
    name: "Code Agent Run",
    retries: 3,
    concurrency: { limit: 10 },
  },
  { event: "code-agent/run.requested" },
  async ({ event, step, publish }) => {
    const { runId, projectId, value, model } = event.data as CodeAgentRunRequestedData;

    console.log("[Inngest] Starting code-agent run:", { runId, projectId, model });

    const result = await step.run("execute-agent", async () => {
      let lastEvent: StreamEvent | null = null;

      for await (const streamEvent of runCodeAgent({
        projectId,
        value,
        model: model || "auto",
      })) {
        await publish(
          agentChannel(runId).event({
            type: streamEvent.type,
            data: streamEvent.data,
            timestamp: streamEvent.timestamp,
          })
        );

        lastEvent = streamEvent;

        if (streamEvent.type === "error") {
          throw new Error(String(streamEvent.data));
        }
      }

      if (lastEvent?.type === "complete") {
        return lastEvent.data as {
          url: string;
          title: string;
          files: Record<string, string>;
          summary: string;
          sandboxId: string;
          framework: string;
        };
      }

      throw new Error("Agent run did not complete successfully");
    });

    return { runId, ...result };
  }
);

export const inngestFunctions = [runCodeAgentFunction];
