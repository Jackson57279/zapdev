/**
 * AI Provider Manager
 * 
 * Handles multi-model AI integration with support for:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * 
 * Based on open-lovable's provider detection and model selection patterns.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type CoreMessage } from 'ai';
import type { ModelId, ModelConfig } from './types';

// Re-export CoreMessage as Message for convenience
export type Message = CoreMessage;

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Check if we're using Vercel AI Gateway.
 */
const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

/**
 * Model configurations with capabilities and settings.
 */
export const MODEL_CONFIGS: Record<Exclude<ModelId, 'auto'>, ModelConfig> = {
  'anthropic/claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Latest Claude model for complex reasoning',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'anthropic/claude-haiku-4.5': {
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fast and efficient for most coding tasks',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'openai/gpt-5': {
    name: 'GPT-5',
    provider: 'openai',
    description: 'OpenAI flagship model with reasoning',
    maxTokens: 8192,
  },
  'openai/gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Fast GPT-4 variant',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'google/gemini-3-pro-preview': {
    name: 'Gemini 3 Pro (Preview)',
    provider: 'google',
    description: 'Google state-of-the-art reasoning',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'google/gemini-3-flash': {
    name: 'Gemini 3 Flash',
    provider: 'google',
    description: 'Ultra-fast inference for speed',
    temperature: 0.3,
    maxTokens: 8192,
    skipValidation: true,
  },
  'groq/llama-3.3-70b': {
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    description: 'Fast open-source model via Groq',
    temperature: 0.7,
    maxTokens: 8192,
  },
  'moonshotai/kimi-k2-instruct-0905': {
    name: 'Kimi K2 (Groq)',
    provider: 'groq',
    description: 'Fast inference via Groq',
    temperature: 0.7,
    maxTokens: 8192,
  },
};

/**
 * Default model to use.
 */
export const DEFAULT_MODEL: ModelId = 'anthropic/claude-haiku-4.5';

/**
 * Display names for models.
 */
export const MODEL_DISPLAY_NAMES: Record<ModelId, string> = {
  'auto': 'Auto (Smart Selection)',
  'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
  'anthropic/claude-haiku-4.5': 'Claude Haiku 4.5',
  'openai/gpt-5': 'GPT-5',
  'openai/gpt-4-turbo': 'GPT-4 Turbo',
  'google/gemini-3-pro-preview': 'Gemini 3 Pro',
  'google/gemini-3-flash': 'Gemini 3 Flash',
  'groq/llama-3.3-70b': 'Llama 3.3 70B',
  'moonshotai/kimi-k2-instruct-0905': 'Kimi K2',
};

// ============================================================================
// Provider Instances
// ============================================================================

/**
 * Get Anthropic provider instance.
 */
function getAnthropicProvider() {
  return createAnthropic({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    baseURL: isUsingAIGateway ? aiGatewayBaseURL : undefined,
  });
}

/**
 * Get OpenAI provider instance.
 */
function getOpenAIProvider() {
  return createOpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
    baseURL: isUsingAIGateway ? aiGatewayBaseURL : process.env.OPENAI_BASE_URL,
  });
}

/**
 * Get Google provider instance.
 */
function getGoogleProvider() {
  return createGoogleGenerativeAI({
    apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.GEMINI_API_KEY,
    baseURL: isUsingAIGateway ? aiGatewayBaseURL : undefined,
  });
}

/**
 * Get Groq provider instance (using OpenAI-compatible API).
 */
function getGroqProvider() {
  return createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

// ============================================================================
// Model Selection
// ============================================================================

/**
 * Get provider and model information for a model ID.
 */
export function getProviderAndModel(modelId: ModelId | string) {
  const normalizedModel = modelId as Exclude<ModelId, 'auto'>;
  const config = MODEL_CONFIGS[normalizedModel] || MODEL_CONFIGS['anthropic/claude-haiku-4.5'];
  
  const isAnthropic = modelId.startsWith('anthropic/');
  const isOpenAI = modelId.startsWith('openai/');
  const isGoogle = modelId.startsWith('google/');
  const isGroq = modelId.startsWith('groq/') || modelId.startsWith('moonshotai/');
  
  // Get the appropriate provider and model
  let model;
  if (isAnthropic) {
    const provider = getAnthropicProvider();
    const actualModel = modelId.replace('anthropic/', '');
    model = provider(actualModel);
  } else if (isOpenAI) {
    const provider = getOpenAIProvider();
    const actualModel = modelId.replace('openai/', '');
    model = provider(actualModel);
  } else if (isGoogle) {
    const provider = getGoogleProvider();
    const actualModel = modelId.replace('google/', '');
    model = provider(actualModel);
  } else if (isGroq) {
    const provider = getGroqProvider();
    model = provider(modelId);
  } else {
    // Default to Anthropic
    const provider = getAnthropicProvider();
    model = provider('claude-3-5-haiku-latest');
  }
  
  return {
    model,
    config,
    isAnthropic,
    isOpenAI,
    isGoogle,
    isGroq,
  };
}

/**
 * Auto-select model based on task complexity.
 */
export function selectModelForTask(
  prompt: string,
  framework?: string,
): Exclude<ModelId, 'auto'> {
  const promptLength = prompt.length;
  const lowercasePrompt = prompt.toLowerCase();
  let chosenModel: Exclude<ModelId, 'auto'> = 'anthropic/claude-haiku-4.5';
  
  // Complexity indicators
  const complexityIndicators = [
    'advanced', 'complex', 'sophisticated', 'enterprise',
    'architecture', 'performance', 'optimization', 'scalability',
    'authentication', 'authorization', 'database', 'api',
    'integration', 'deployment', 'security', 'testing',
  ];
  
  const hasComplexityIndicators = complexityIndicators.some(ind =>
    lowercasePrompt.includes(ind)
  );
  
  const isLongPrompt = promptLength > 500;
  const isVeryLongPrompt = promptLength > 1000;
  
  // Framework-specific selection
  if (framework === 'angular' && (hasComplexityIndicators || isLongPrompt)) {
    return 'anthropic/claude-sonnet-4';
  }
  
  // Coding-specific keywords
  const codingIndicators = ['refactor', 'optimize', 'debug', 'fix bug', 'improve code'];
  const hasCodingFocus = codingIndicators.some(ind => lowercasePrompt.includes(ind));
  
  if (hasCodingFocus && !isVeryLongPrompt) {
    chosenModel = 'anthropic/claude-haiku-4.5';
  }
  
  // Speed-critical tasks
  const speedIndicators = ['quick', 'fast', 'simple', 'basic', 'prototype'];
  const needsSpeed = speedIndicators.some(ind => lowercasePrompt.includes(ind));
  
  if (needsSpeed && !hasComplexityIndicators) {
    chosenModel = 'google/gemini-3-flash';
  }
  
  // Highly complex tasks
  if (hasComplexityIndicators || isVeryLongPrompt) {
    chosenModel = 'anthropic/claude-sonnet-4';
  }
  
  return chosenModel;
}

// ============================================================================
// Streaming API
// ============================================================================

export interface StreamOptions {
  model: ModelId | string;
  messages: CoreMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/**
 * Create a streaming text generation request.
 */
export async function createStreamingRequest(options: StreamOptions) {
  const {
    model: modelId,
    messages,
    systemPrompt,
    maxTokens = 8192,
    temperature,
    stopSequences = [],
  } = options;
  
  const { model, config, isOpenAI } = getProviderAndModel(modelId);
  
  // Build messages array
  const fullMessages: CoreMessage[] = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);
  
  // Build stream options
  const streamOptions: Parameters<typeof streamText>[0] = {
    model,
    messages: fullMessages,
    maxTokens,
  };
  
  // Add stop sequences if provided
  if (stopSequences.length > 0) {
    streamOptions.stopSequences = stopSequences;
  }
  
  // Add temperature for non-reasoning models
  if (!modelId.includes('gpt-5')) {
    streamOptions.temperature = temperature ?? config.temperature ?? 0.7;
  }
  
  // Add experimental options for OpenAI reasoning models
  // Note: providerOptions may not be supported in all AI SDK versions
  if (isOpenAI && modelId.includes('gpt-5')) {
    (streamOptions as Record<string, unknown>).providerOptions = {
      openai: {
        reasoningEffort: 'high',
      },
    };
  }
  
  return streamText(streamOptions);
}

/**
 * Retry streaming request with exponential backoff.
 */
export async function createStreamingRequestWithRetry(
  options: StreamOptions,
  maxRetries = 2,
): Promise<Awaited<ReturnType<typeof streamText>>> {
  let retryCount = 0;
  let lastError: Error | null = null;
  
  while (retryCount <= maxRetries) {
    try {
      return await createStreamingRequest(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const isRetryableError = 
        lastError.message.includes('Service unavailable') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('timeout');
      
      if (retryCount < maxRetries && isRetryableError) {
        retryCount++;
        console.log(`[AI Provider] Retrying in ${retryCount * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
        
        // Fallback to GPT-4 if Groq fails
        if (retryCount === maxRetries && options.model.includes('groq')) {
          console.log('[AI Provider] Falling back to GPT-4 Turbo');
          options.model = 'openai/gpt-4-turbo';
        }
      } else {
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a model ID is valid.
 */
export function isValidModelId(modelId: string): modelId is ModelId {
  if (modelId === 'auto') return true;
  return modelId in MODEL_CONFIGS;
}

/**
 * Get model configuration by ID.
 */
export function getModelConfig(modelId: ModelId): ModelConfig | undefined {
  if (modelId === 'auto') return undefined;
  return MODEL_CONFIGS[modelId];
}

/**
 * Get all available models.
 */
export function getAvailableModels(): Array<{ id: ModelId; name: string; description: string }> {
  return Object.entries(MODEL_CONFIGS).map(([id, config]) => ({
    id: id as ModelId,
    name: config.name,
    description: config.description,
  }));
}

/**
 * Check if AI Gateway is enabled.
 */
export function isAIGatewayEnabled(): boolean {
  return isUsingAIGateway;
}
