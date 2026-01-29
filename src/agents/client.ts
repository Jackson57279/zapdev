import { createOpenAI } from "@ai-sdk/openai";
import { createCerebras } from "@ai-sdk/cerebras";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "ai";
import Anthropic from "@anthropic-ai/sdk";

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    "HTTP-Referer": "https://zapdev.link",
    "X-Title": "ZapDev",
  },
});

export const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY || "",
});

export const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY || "",
});

// Creates an Anthropic client using an OAuth Bearer token
// The token is passed as an Authorization header instead of apiKey
export function createClaudeCodeClientWithToken(accessToken: string): Anthropic {
  return new Anthropic({ 
    // For OAuth tokens, we use defaultHeaders to set Authorization: Bearer
    // The apiKey field is still required by the SDK but the Authorization header takes precedence
    apiKey: accessToken,
    defaultHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
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
// Using latest model aliases for stability
const CLAUDE_CODE_MODEL_MAP: Record<string, string> = {
  "claude-code": "claude-3-5-haiku-latest",
  "claude-code-sonnet": "claude-3-5-sonnet-latest",
  "claude-code-opus": "claude-3-opus-latest",
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
  return CLAUDE_CODE_MODEL_MAP[modelId] ?? "claude-3-5-haiku-20241022";
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
  return {
    chat: (modelId: string) => openrouter(modelId),
  };
}
