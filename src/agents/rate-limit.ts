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
 * Checks if an error is a server error (5xx) that should be retried.
 * This includes AI provider 500 errors and validation errors from malformed responses.
 */
export function isServerError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const errorString = String(error).toLowerCase();
  
  const serverErrorPatterns = [
    "server error",
    "server_error",
    "status_code\":500",
    "status_code\": 500",
    "500",
    "502",
    "503",
    "504",
    "internal error",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "encountered a server error",
    "ai_typevalidationerror", // AI SDK validation error from malformed provider response
    "type validation failed",
  ];

  return serverErrorPatterns.some(pattern => 
    message.includes(pattern) || errorString.includes(pattern)
  );
}

/**
 * Checks if an error is retryable (either rate limit or server error)
 */
export function isRetryableError(error: unknown): boolean {
  return isRateLimitError(error) || isServerError(error);
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
      const canRetry = isRetryableError(error);

      if (attempt === maxRetries || !canRetry) {
        console.error(`[ERROR] ${context}: ${canRetry ? `All ${maxRetries} attempts failed` : "Non-retryable error"}. Error: ${lastError.message}`);
        throw lastError;
      }

      let waitMs: number;

      if (isRateLimitError(error)) {
        waitMs = RATE_LIMIT_WAIT_MS;
        console.log(`[RATE-LIMIT] ${context}: Rate limit hit on attempt ${attempt}/${maxRetries}. Waiting 60s...`);
      } else if (isServerError(error)) {
        waitMs = INITIAL_BACKOFF_MS * 2 * Math.pow(2, attempt - 1);
        console.log(`[SERVER-ERROR] ${context}: Server error on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs / 1000}s...`);
      } else {
        waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[ERROR] ${context}: Error on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs / 1000}s...`);
      }

      if (onRetry) {
        onRetry(attempt, lastError, waitMs);
      }

      await sleep(waitMs, `Retry attempt ${attempt + 1}/${maxRetries} for ${context}`);
    }
  }

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
      const canRetry = isRetryableError(error);

      if (attempt === maxRetries || !canRetry) {
        console.error(`[ERROR] ${context}: ${canRetry ? `All ${maxRetries} attempts failed` : "Non-retryable error"}. Error: ${lastError.message}`);
        throw lastError;
      }

      let waitMs: number;

      if (isRateLimitError(error)) {
        waitMs = RATE_LIMIT_WAIT_MS;
        console.log(`[RATE-LIMIT] ${context}: Rate limit hit on attempt ${attempt}/${maxRetries}. Waiting 60s...`);
      } else if (isServerError(error)) {
        waitMs = INITIAL_BACKOFF_MS * 2 * Math.pow(2, attempt - 1);
        console.log(`[SERVER-ERROR] ${context}: Server error on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs / 1000}s...`);
      } else {
        waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[ERROR] ${context}: Error on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${waitMs / 1000}s...`);
      }

      if (onRetry) {
        onRetry(attempt, lastError, waitMs);
      }

      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  throw lastError || new Error("Unexpected error in retry loop");
}
