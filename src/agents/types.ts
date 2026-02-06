export const SANDBOX_TIMEOUT = 60_000 * 60;

export type Framework = "nextjs" | "angular" | "react" | "vue" | "svelte";
export type DatabaseProvider = "none" | "drizzle-neon" | "convex";

export interface AgentState {
  summary: string;
  files: Record<string, string>;
  selectedFramework?: Framework;
  selectedDatabase?: DatabaseProvider;
  summaryRetryCount: number;
}

export interface AgentRunInput {
  projectId: string;
  value: string;
  model?: ModelId;
  userId?: string;
  provider?: AgentProvider;
}

export interface AgentRunResult {
  url: string;
  title: string;
  files: Record<string, string>;
  summary: string;
  sandboxId: string;
  framework: Framework;
  databaseProvider?: DatabaseProvider;
}

export type AgentProvider = "api";

export const MODEL_CONFIGS = {
  "anthropic/claude-haiku-4.5": {
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and efficient for most coding tasks",
    temperature: 0.7,
    supportsFrequencyPenalty: true,
    frequencyPenalty: 0.5,
    supportsSubagents: false,
    isSpeedOptimized: false,
    isClaudeCode: false,
    maxTokens: undefined,
  },
  "openai/gpt-5.1-codex": {
    name: "GPT-5.1 Codex",
    provider: "openai",
    description: "OpenAI's flagship model for complex tasks",
    temperature: 0.7,
    supportsFrequencyPenalty: true,
    frequencyPenalty: 0.5,
    supportsSubagents: false,
    isSpeedOptimized: false,
    isClaudeCode: false,
    maxTokens: undefined,
  },
  "zai-glm-4.7": {
    name: "Z-AI GLM 4.7",
    provider: "cerebras",
    description: "Ultra-fast inference with subagent research capabilities via Cerebras",
    temperature: 0.7,
    supportsFrequencyPenalty: false,
    supportsSubagents: true,
    isSpeedOptimized: true,
    isClaudeCode: false,
    maxTokens: 4096,
  },
  "moonshotai/kimi-k2.5": {
    name: "Kimi K2.5",
    provider: "moonshot",
    description: "Specialized for coding tasks",
    temperature: 0.7,
    supportsFrequencyPenalty: true,
    frequencyPenalty: 0.5,
    supportsSubagents: false,
    isSpeedOptimized: false,
    isClaudeCode: false,
    maxTokens: undefined,
  },
  "google/gemini-3-pro-preview": {
    name: "Gemini 3 Pro",
    provider: "google",
    description:
      "Google's most intelligent model with state-of-the-art reasoning",
    temperature: 0.7,
    supportsFrequencyPenalty: false,
    supportsSubagents: false,
    isSpeedOptimized: false,
    isClaudeCode: false,
    maxTokens: undefined,
  },
  "morph/morph-v3-large": {
    name: "Morph V3 Large",
    provider: "openrouter",
    description: "Fast research subagent for documentation lookup and web search",
    temperature: 0.5,
    supportsFrequencyPenalty: false,
    supportsSubagents: false,
    isSpeedOptimized: true,
    isClaudeCode: false,
    maxTokens: 2048,
    isSubagentOnly: true,
  },
} as const;

export type ModelId = keyof typeof MODEL_CONFIGS | "auto";

export function selectModelForTask(
  prompt: string,
  framework?: Framework
): keyof typeof MODEL_CONFIGS {
  const promptLength = prompt.length;
  const lowercasePrompt = prompt.toLowerCase();
  
  const defaultModel: keyof typeof MODEL_CONFIGS = "zai-glm-4.7";

  const enterpriseComplexityPatterns = [
    "enterprise architecture",
    "multi-tenant",
    "distributed system",
    "microservices",
    "kubernetes",
    "advanced authentication",
    "complex authorization",
    "large-scale migration",
  ];

  const requiresEnterpriseModel = enterpriseComplexityPatterns.some((pattern) =>
    lowercasePrompt.includes(pattern)
  );

  const isVeryLongPrompt = promptLength > 2000;
  const userExplicitlyRequestsGPT = lowercasePrompt.includes("gpt-5") || lowercasePrompt.includes("gpt5");
  const userExplicitlyRequestsGemini = lowercasePrompt.includes("gemini");
  const userExplicitlyRequestsKimi = lowercasePrompt.includes("kimi");

  if (requiresEnterpriseModel || isVeryLongPrompt) {
    return "anthropic/claude-haiku-4.5";
  }

  if (userExplicitlyRequestsGPT) {
    return "openai/gpt-5.1-codex";
  }

  if (userExplicitlyRequestsGemini) {
    return "google/gemini-3-pro-preview";
  }

  if (userExplicitlyRequestsKimi) {
    return "moonshotai/kimi-k2.5";
  }

  return defaultModel;
}

export function frameworkToConvexEnum(
  framework: Framework
): "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE" {
  const mapping: Record<
    Framework,
    "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE"
  > = {
    nextjs: "NEXTJS",
    angular: "ANGULAR",
    react: "REACT",
    vue: "VUE",
    svelte: "SVELTE",
  };
  return mapping[framework];
}

export function databaseProviderToConvexEnum(
  provider: DatabaseProvider
): "NONE" | "DRIZZLE_NEON" | "CONVEX" {
  const mapping: Record<DatabaseProvider, "NONE" | "DRIZZLE_NEON" | "CONVEX"> = {
    none: "NONE",
    "drizzle-neon": "DRIZZLE_NEON",
    convex: "CONVEX",
  };
  return mapping[provider];
}
