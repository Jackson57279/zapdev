import { EventSchemas, Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";

type CodeAgentRunEvent = {
  data: {
    projectId: string;
    value: string;
    model?: string;
  };
};

type AgentKitRunEvent = {
  data: {
    projectId: string;
    value: string;
    model?: string;
    framework?: "nextjs" | "angular" | "react" | "vue" | "svelte";
  };
};

type WebContainerRunEvent = {
  data: {
    projectId: string;
    value: string;
    model?: string;
    framework?: "nextjs" | "angular" | "react" | "vue" | "svelte";
  };
};

export const inngest = new Inngest({
  id: "zapdev",
  middleware: [realtimeMiddleware()],
  schemas: new EventSchemas().fromRecord<{
    "agent/code.run": CodeAgentRunEvent;
    "agent/code-agent-kit.run": AgentKitRunEvent;
    "agent/code-webcontainer.run": WebContainerRunEvent;
  }>(),
});
