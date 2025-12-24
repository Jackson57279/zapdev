export type ModelId =
  | "auto"
  | "anthropic/claude-haiku-4.5"
  | "google/gemini-3-pro"
  | "openai/gpt-5.1-codex"
  | "zai/glm-4.6"
  | "alibaba/qwen3-max";

export const MODEL_CONFIGS = {
  "auto": {
    name: "Auto",
    description: "Automatically selects the best model for the task",
  },
  "anthropic/claude-haiku-4.5": {
    name: "Claude Haiku 4.5",
    description: "Fast and efficient",
  },
  "google/gemini-3-pro": {
    name: "Gemini 3 Pro",
    description: "Google's most intelligent model with state-of-the-art reasoning",
  },
  "openai/gpt-5.1-codex": {
    name: "GPT-5.1 Codex",
    description: "OpenAI's flagship model for complex tasks",
  },
  "zai/glm-4.6": {
    name: "Zai GLM 4.6",
    description: "Ultra-fast inference for speed-critical tasks",
  },
  "alibaba/qwen3-max": {
    name: "Qwen 3 Max",
    description: "Specialized for coding tasks",
  },
} as const;

