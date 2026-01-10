export const SANDBOX_TIMEOUT = 60_000 * 60;

export type Framework = "nextjs" | "angular" | "react" | "vue" | "svelte";

export interface AgentState {
  summary: string;
  files: Record<string, string>;
  selectedFramework?: Framework;
  summaryRetryCount: number;
}

export interface AgentRunInput {
  projectId: string;
  value: string;
  model?: ModelId;
  userId?: string;
}

export interface AgentRunResult {
  url: string;
  title: string;
  files: Record<string, string>;
  summary: string;
  sandboxId: string;
  framework: Framework;
}

export const MODEL_CONFIGS = {
  "anthropic/claude-haiku-4.5": {
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and efficient for most coding tasks",
    temperature: 0.7,
    supportsFrequencyPenalty: true,
    frequencyPenalty: 0.5,
  },
  "openai/gpt-5.1-codex": {
    name: "GPT-5.1 Codex",
    provider: "openai",
    description: "OpenAI's flagship model for complex tasks",
    temperature: 0.7,
    supportsFrequencyPenalty: true,
    frequencyPenalty: 0.5,
  },
  "zai-glm-4.7": {
    name: "Z-AI GLM 4.7",
    provider: "cerebras",
    description: "Ultra-fast inference for speed-critical tasks via Cerebras",
    temperature: 0.7,
    supportsFrequencyPenalty: false,
  },
  "moonshotai/kimi-k2-0905": {
    name: "Kimi K2",
    provider: "moonshot",
    description: "Specialized for coding tasks",
    temperature: 0.7,
    supportsFrequencyPenalty: true,
    frequencyPenalty: 0.5,
  },
  "google/gemini-3-pro-preview": {
    name: "Gemini 3 Pro",
    provider: "google",
    description:
      "Google's most intelligent model with state-of-the-art reasoning",
    temperature: 0.7,
    supportsFrequencyPenalty: false,
  },
} as const;

export type ModelId = keyof typeof MODEL_CONFIGS | "auto";

export function selectModelForTask(
  prompt: string,
  framework?: Framework
): keyof typeof MODEL_CONFIGS {
  const promptLength = prompt.length;
  const lowercasePrompt = prompt.toLowerCase();
  let chosenModel: keyof typeof MODEL_CONFIGS = "anthropic/claude-haiku-4.5";

  const complexityIndicators = [
    "advanced",
    "complex",
    "sophisticated",
    "enterprise",
    "architecture",
    "performance",
    "optimization",
    "scalability",
    "authentication",
    "authorization",
    "database",
    "api",
    "integration",
    "deployment",
    "security",
    "testing",
  ];

  const hasComplexityIndicators = complexityIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator)
  );

  const isLongPrompt = promptLength > 500;
  const isVeryLongPrompt = promptLength > 1000;

  if (framework === "angular" && (hasComplexityIndicators || isLongPrompt)) {
    return chosenModel;
  }

  const codingIndicators = [
    "refactor",
    "optimize",
    "debug",
    "fix bug",
    "improve code",
  ];
  const hasCodingFocus = codingIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator)
  );

  if (hasCodingFocus && !isVeryLongPrompt) {
    chosenModel = "moonshotai/kimi-k2-0905";
  }

  const speedIndicators = ["quick", "fast", "simple", "basic", "prototype"];
  const needsSpeed = speedIndicators.some((indicator) =>
    lowercasePrompt.includes(indicator)
  );

  if (needsSpeed && !hasComplexityIndicators) {
    chosenModel = "zai-glm-4.7";
  }

  if (hasComplexityIndicators || isVeryLongPrompt) {
    chosenModel = "anthropic/claude-haiku-4.5";
  }

  return chosenModel;
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
