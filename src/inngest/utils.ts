import { Sandbox } from "@e2b/code-interpreter";
import { AgentResult, Message, TextMessage } from "@inngest/agent-kit";

import { SANDBOX_TIMEOUT } from "./types";

const SANDBOX_CACHE = new Map<string, Sandbox>();
const CACHE_EXPIRY = 5 * 60 * 1000;

const clearCacheEntry = (sandboxId: string) => {
  setTimeout(() => {
    SANDBOX_CACHE.delete(sandboxId);
  }, CACHE_EXPIRY);
};

export async function getSandbox(sandboxId: string) {
  const cached = SANDBOX_CACHE.get(sandboxId);
  if (cached) {
    return cached;
  }
  
  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY,
    });
    await sandbox.setTimeout(SANDBOX_TIMEOUT);
    
    SANDBOX_CACHE.set(sandboxId, sandbox);
    clearCacheEntry(sandboxId);
    
    return sandbox;
  } catch (error) {
    console.error("[ERROR] Failed to connect to E2B sandbox:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`E2B sandbox connection failed: ${errorMessage}`);
  }
}

export async function readFilesFromSandbox(
  sandbox: Sandbox,
  files: string[]
): Promise<{ path: string; content: string }[]> {
  try {
    return await Promise.all(
      files.map(async (file) => ({
        path: file,
        content: await sandbox.files.read(file),
      }))
    );
  } catch (error) {
    console.error("[ERROR] Failed to read files from sandbox:", error);
    return [];
  }
}

export function lastAssistantTextMessageContent(result: AgentResult) {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role === "assistant",
  );

  const message = result.output[lastAssistantTextMessageIndex] as
    | TextMessage
    | undefined;

  return message?.content
    ? typeof message.content === "string"
      ? message.content
      : message.content.map((c) => c.text).join("")
    : undefined;
}

export const parseAgentOutput = (value?: Message[]) => {
  if (!value || value.length === 0) {
    return "Fragment";
  }

  const output = value[0];

  if (output.type !== "text") {
    return "Fragment";
  }

  if (Array.isArray(output.content)) {
    return output.content.map((txt) => (typeof txt === "string" ? txt : txt.text ?? "")).join("")
  } else {
    return output.content
  }
};
