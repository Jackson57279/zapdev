import { createOpenAI } from '@ai-sdk/openai';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error(
    'Missing required environment variable: OPENROUTER_API_KEY\n' +
    'Please set OPENROUTER_API_KEY in your .env file or environment variables.\n' +
    'You can obtain an API key from https://openrouter.ai/keys'
  );
}

export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://zapdev.app',
    'X-Title': 'Zapdev',
  },
});

export const MODEL_CONFIGS = {
  'auto': {
    id: 'openrouter/auto',
    temperature: 0.7,
    maxTokens: 8000,
  },
  'anthropic/claude-haiku-4.5': {
    id: 'anthropic/claude-3-5-haiku',
    temperature: 0.7,
    maxTokens: 8000,
  },
  'google/gemini-2.5-flash-lite': {
    id: 'google/gemini-2.0-flash-exp:free',
    temperature: 0.7,
    maxTokens: 8000,
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    temperature: 0.7,
    maxTokens: 8000,
  },
} as const;

export type ModelId = keyof typeof MODEL_CONFIGS;

export function getModel(modelId: ModelId) {
  const config = MODEL_CONFIGS[modelId] || MODEL_CONFIGS['auto'];
  return openrouter(config.id);
}
