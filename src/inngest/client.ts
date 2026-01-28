import { Inngest, EventSchemas } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";
import { channel, topic } from "@inngest/realtime";
import type { InngestEvents } from "./types";

export const inngest = new Inngest({
  id: "zapdev",
  middleware: [realtimeMiddleware()],
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
});

export const agentChannel = channel((runId: string) => `agent:${runId}`)
  .addTopic(topic("status").type<{ type: "status"; data: string }>())
  .addTopic(topic("text").type<{ type: "text"; data: string }>())
  .addTopic(topic("tool-call").type<{ type: "tool-call"; data: { tool: string; args: unknown } }>())
  .addTopic(topic("tool-output").type<{ type: "tool-output"; data: { source: "stdout" | "stderr"; chunk: string } }>())
  .addTopic(topic("file-created").type<{ type: "file-created"; data: { path: string; content: string; size: number } }>())
  .addTopic(topic("file-updated").type<{ type: "file-updated"; data: { path: string; content: string; size: number } }>())
  .addTopic(topic("progress").type<{ type: "progress"; data: { stage: string; chunks?: number } }>())
  .addTopic(topic("files").type<{ type: "files"; data: Record<string, string> }>())
  .addTopic(topic("research-start").type<{ type: "research-start"; data: { taskType: string; query: string } }>())
  .addTopic(topic("research-complete").type<{ type: "research-complete"; data: { taskId: string; status: string; elapsedTime: number } }>())
  .addTopic(topic("time-budget").type<{ type: "time-budget"; data: { remaining: number; stage: string } }>())
  .addTopic(topic("error").type<{ type: "error"; data: string }>())
  .addTopic(
    topic("complete").type<{
      type: "complete";
      data: {
        url: string;
        title: string;
        files: Record<string, string>;
        summary: string;
        sandboxId: string;
        framework: string;
      };
    }>()
  )
  .addTopic(topic("event").type<{ type: string; data: unknown; timestamp?: number }>());
