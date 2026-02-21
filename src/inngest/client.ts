import { EventSchemas, Inngest } from "inngest";

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

export const inngest = new Inngest({
  id: "zapdev",
  schemas: new EventSchemas().fromRecord<{
    "agent/code.run": CodeAgentRunEvent;
    "agent/code-agent-kit.run": AgentKitRunEvent;
  }>(),
});
