import { createOpenAI } from "@ai-sdk/openai";
import { createCerebras } from "@ai-sdk/cerebras";

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

export const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY || "",
});

export function getModel(modelId: string) {
  return openrouter(modelId);
}

export function getClientForModel(modelId: string) {
  return modelId === "zai-glm-4.7" ? cerebras : openrouter;
}
