import { createOpenAI } from "@ai-sdk/openai";

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

export const cerebras = createOpenAI({
  apiKey: process.env.CEREBRAS_API_KEY || "",
  baseURL: "https://api.cerebras.ai/v1",
});

export function getModel(modelId: string) {
  return openrouter(modelId);
}

export function getClientForModel(modelId: string) {
  return modelId === "z-ai/glm-4.7" ? cerebras : openrouter;
}
