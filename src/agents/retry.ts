import * as Sentry from '@sentry/nextjs';

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryIf?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryIf: () => true,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      Sentry.addBreadcrumb({
        category: 'retry',
        message: `Attempt ${attempt}/${opts.maxAttempts} failed`,
        level: 'warning',
        data: {
          error: lastError.message,
          nextDelay: delay,
        },
      });

      if (attempt === opts.maxAttempts || !opts.retryIf(lastError)) {
        Sentry.captureException(lastError, {
          extra: {
            attempts: attempt,
            maxAttempts: opts.maxAttempts,
          },
          tags: { component: 'retry' },
        });
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

export const retryOnRateLimit = (error: Error): boolean => {
  return (
    error.message.includes('rate limit') ||
    error.message.includes('429') ||
    error.message.includes('too many requests')
  );
};

export const retryOnTimeout = (error: Error): boolean => {
  return error.message.includes('timeout') || error.message.includes('ETIMEDOUT');
};

export const retryOnTransient = (error: Error): boolean => {
  return (
    retryOnRateLimit(error) ||
    retryOnTimeout(error) ||
    error.message.includes('503') ||
    error.message.includes('502')
  );
};
