import type { ModelId } from "@/agents/types";

export interface CodeAgentRunRequestedData {
  runId: string;
  projectId: string;
  value: string;
  model?: ModelId | "auto";
}

export interface CodeAgentRunProgressData {
  runId: string;
  type: string;
  data: unknown;
  timestamp: number;
}

export interface CodeAgentRunCompleteData {
  runId: string;
  url: string;
  title: string;
  files: Record<string, string>;
  summary: string;
  sandboxId: string;
  framework: string;
}

export interface CodeAgentRunErrorData {
  runId: string;
  error: string;
}

export type InngestEvents = {
  "code-agent/run.requested": {
    data: CodeAgentRunRequestedData;
  };
  "code-agent/run.progress": {
    data: CodeAgentRunProgressData;
  };
  "code-agent/run.complete": {
    data: CodeAgentRunCompleteData;
  };
  "code-agent/run.error": {
    data: CodeAgentRunErrorData;
  };
};
