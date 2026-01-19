import { createOpenAI } from "@ai-sdk/openai";
import { createCerebras } from "@ai-sdk/cerebras";

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

export const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY || "",
});

// Cerebras model IDs
const CEREBRAS_MODELS = ["zai-glm-4.7"];

export function isCerebrasModel(modelId: string): boolean {
  return CEREBRAS_MODELS.includes(modelId);
}

export interface ClientOptions {
  useGatewayFallback?: boolean;
}

export function getModel(
  modelId: string,
  options?: ClientOptions
) {
  if (isCerebrasModel(modelId) && options?.useGatewayFallback) {
    return openrouter(modelId);
  }
  if (isCerebrasModel(modelId)) {
    return cerebras(modelId);
  }
  return openrouter(modelId);
}

export function getClientForModel(
  modelId: string,
  options?: ClientOptions
) {
  if (isCerebrasModel(modelId) && options?.useGatewayFallback) {
    return {
      chat: (_modelId: string) => openrouter(modelId),
    };
  }
  if (isCerebrasModel(modelId)) {
    return {
      chat: (_modelId: string) => cerebras(modelId),
    };
  }
  return openrouter;
}
