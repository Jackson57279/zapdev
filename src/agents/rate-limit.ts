/**
 * Rate limit handling utilities for AI API calls.
 * Implements exponential backoff with special handling for rate limit errors.
 */

const RATE_LIMIT_WAIT_MS = 60_000; // 60 seconds wait on rate limit
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1_000;

/**
 * Checks if an error is a rate limit error based on message patterns
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const rateLimitPatterns = [
    "rate limit",
    "rate_limit",
    "tokens per minute",
    "requests per minute",
    "too many requests",
    "429",
    "quota exceeded",
    "limit exceeded",
  ];

  return rateLimitPatterns.some(pattern => message.includes(pattern));
}

/**
 * Sleep for a specified duration with logging
 */
async function sleep(ms: number, reason: string): Promise<void> {
  console.log(`[RATE-LIMIT] Waiting ${ms / 1000}s: ${reason}`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps an async function with rate limit aware retry logic.
 * On rate limit errors, waits 60 seconds before retrying.
 * On other errors, uses exponential backoff.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: Error, waitMs: number) => void;
    context?: string;
  } = {}
): Promise<T> {
  const { maxRetries = MAX_RETRIES, onRetry, context = "API call" } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        console.error(`[RATE-LIMIT] ${context}: All ${maxRetries} attempts failed. Last error: ${lastError.message}`);
        throw lastError;
      }

      let waitMs: number;

      if (isRateLimitError(error)) {
        // Rate limit - wait 60 seconds
        waitMs = RATE_LIMIT_WAIT_MS;
        console.log(`[RATE-LIMIT] ${context}: Rate limit hit on attempt ${attempt}/${maxRetries}. Waiting 60s...`);
      } else {
        // Other error - exponential backoff
        waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[RATE-LIMIT] ${context}: Error on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs / 1000}s...`);
      }

      if (onRetry) {
        onRetry(attempt, lastError, waitMs);
      }

      await sleep(waitMs, `Retry attempt ${attempt + 1}/${maxRetries} for ${context}`);
    }
  }

  // This should never be reached due to the throw above, but TypeScript needs it
  throw lastError || new Error("Unexpected error in retry loop");
}

/**
 * Wraps an async generator with rate limit aware retry logic.
 * If the generator fails partway through, restarts from the beginning on retry.
 */
export async function* withRateLimitRetryGenerator<T>(
  createGenerator: () => AsyncGenerator<T>,
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: Error, waitMs: number) => void;
    context?: string;
  } = {}
): AsyncGenerator<T> {
  const { maxRetries = MAX_RETRIES, onRetry, context = "Stream" } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const generator = createGenerator();
      for await (const value of generator) {
        yield value;
      }
      // Successfully completed
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        console.error(`[RATE-LIMIT] ${context}: All ${maxRetries} attempts failed. Last error: ${lastError.message}`);
        throw lastError;
      }

      let waitMs: number;

      if (isRateLimitError(error)) {
        // Rate limit - wait 60 seconds
        waitMs = RATE_LIMIT_WAIT_MS;
        console.log(`[RATE-LIMIT] ${context}: Rate limit hit on attempt ${attempt}/${maxRetries}. Waiting 60s...`);
      } else {
        // Other error - exponential backoff
        waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[RATE-LIMIT] ${context}: Error on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs / 1000}s...`);
      }

      if (onRetry) {
        onRetry(attempt, lastError, waitMs);
      }

      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  // This should never be reached due to the throw above, but TypeScript needs it
  throw lastError || new Error("Unexpected error in retry loop");
}

export interface GatewayFallbackOptions {
  modelId: string;
  context?: string;
}

export async function* withGatewayFallbackGenerator<T>(
  createGenerator: (useGateway: boolean) => AsyncGenerator<T>,
  options: GatewayFallbackOptions
): AsyncGenerator<T> {
  const { modelId, context = "AI call" } = options;
  let triedGateway = false;
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const generator = createGenerator(triedGateway);
      for await (const value of generator) {
        yield value;
      }
      return;
    } catch (error) {
      const lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === MAX_ATTEMPTS || triedGateway) {
        console.error(`[GATEWAY-FALLBACK] ${context}: All ${MAX_ATTEMPTS} attempts failed. Last error: ${lastError.message}`);
        throw lastError;
      }

      if (isRateLimitError(error) && !triedGateway) {
        console.log(`[GATEWAY-FALLBACK] ${context}: Rate limit hit for ${modelId}. Switching to Vercel AI Gateway with Cerebras provider...`);
        triedGateway = true;
      } else if (isRateLimitError(error)) {
        const waitMs = RATE_LIMIT_WAIT_MS;
        console.log(`[GATEWAY-FALLBACK] ${context}: Gateway rate limit hit. Waiting ${waitMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[GATEWAY-FALLBACK] ${context}: Error: ${lastError.message}. Retrying in ${backoffMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error("Unexpected error in gateway fallback loop");
}
