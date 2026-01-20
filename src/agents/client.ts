import { createOpenAI } from "@ai-sdk/openai";
import { createCerebras } from "@ai-sdk/cerebras";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "ai";
import Anthropic from "@anthropic-ai/sdk";

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

export const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY || "",
});

export const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY || "",
});

export function createClaudeCodeClientWithToken(accessToken: string): Anthropic {
  return new Anthropic({ apiKey: accessToken });
}

export function createAnthropicProviderWithToken(accessToken: string) {
  return createAnthropic({ apiKey: accessToken });
}

export function isClaudeCodeFeatureEnabled(): boolean {
  return process.env.CLAUDE_CODE_ENABLED === "true";
}

// Cerebras model IDs (direct API)
const CEREBRAS_MODELS = ["zai-glm-4.7"];
const GATEWAY_MODEL_ID_MAP: Record<string, string> = {
  "zai-glm-4.7": "zai/glm-4.7",
};

// Claude Code model IDs
const CLAUDE_CODE_MODELS = [
  "claude-code",
  "claude-code-sonnet",
  "claude-code-opus",
];

// Claude model mapping for Anthropic API
const CLAUDE_CODE_MODEL_MAP: Record<string, string> = {
  "claude-code": "claude-sonnet-4-20250514",
  "claude-code-sonnet": "claude-sonnet-4-20250514",
  "claude-code-opus": "claude-opus-4-20250514",
};

const getGatewayModelId = (modelId: string): string =>
  GATEWAY_MODEL_ID_MAP[modelId] ?? modelId;

export function isCerebrasModel(modelId: string): boolean {
  return CEREBRAS_MODELS.includes(modelId);
}

export function isClaudeCodeModel(modelId: string): boolean {
  return CLAUDE_CODE_MODELS.includes(modelId);
}

export function getClaudeCodeModelId(modelId: string): string {
  return CLAUDE_CODE_MODEL_MAP[modelId] ?? "claude-sonnet-4-20250514";
}

export interface ClientOptions {
  useGatewayFallback?: boolean;
  userAnthropicToken?: string;
}

export function getModel(
  modelId: string,
  options?: ClientOptions
) {
  if (isClaudeCodeModel(modelId)) {
    if (!options?.userAnthropicToken) {
      throw new Error("Claude Code requires user's Anthropic OAuth token");
    }
    const anthropicProvider = createAnthropicProviderWithToken(options.userAnthropicToken);
    const anthropicModelId = getClaudeCodeModelId(modelId);
    return anthropicProvider(anthropicModelId);
  }
  if (isCerebrasModel(modelId) && options?.useGatewayFallback) {
    return gateway(getGatewayModelId(modelId));
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
  if (isClaudeCodeModel(modelId)) {
    if (!options?.userAnthropicToken) {
      throw new Error("Claude Code requires user's Anthropic OAuth token");
    }
    const anthropicProvider = createAnthropicProviderWithToken(options.userAnthropicToken);
    const anthropicModelId = getClaudeCodeModelId(modelId);
    return {
      chat: (_modelId: string) => anthropicProvider(anthropicModelId),
    };
  }
  if (isCerebrasModel(modelId) && options?.useGatewayFallback) {
    const gatewayModelId = getGatewayModelId(modelId);
    return {
      chat: (_modelId: string) => gateway(gatewayModelId),
    };
  }
  if (isCerebrasModel(modelId)) {
    return {
      chat: (_modelId: string) => cerebras(modelId),
    };
  }
  return openrouter;
}
