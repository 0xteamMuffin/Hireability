/**
 * Retry utilities for handling rate limits and transient errors
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
};

/**
 * Sleep for a specified duration
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check if an error is a rate limit error (429)
 */
export const isRateLimitError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; message?: string; code?: number };
    return (
      err.status === 429 ||
      err.code === 429 ||
      (err.message?.includes('429') ?? false) ||
      (err.message?.toLowerCase().includes('quota') ?? false) ||
      (err.message?.toLowerCase().includes('rate') ?? false)
    );
  }
  return false;
};

/**
 * Check if an error is a transient error that might succeed on retry
 */
export const isTransientError = (error: unknown): boolean => {
  if (isRateLimitError(error)) return true;

  if (error && typeof error === 'object') {
    const err = error as { status?: number; code?: string; message?: string };

    if (err.status && err.status >= 500 && err.status < 600) return true;
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true;
    if (err.message?.includes('network') ?? false) return true;
  }
  return false;
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export const calculateDelay = (attempt: number, config: RetryConfig): number => {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const maxDelay = config.maxDelayMs || 30000;
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  const jitter = cappedDelay * 0.25 * Math.random();
  return cappedDelay + jitter;
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const shouldRetry = finalConfig.shouldRetry || isTransientError;

  let lastError: unknown;

  for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (shouldRetry(error) && attempt < finalConfig.maxRetries - 1) {
        const delay = calculateDelay(attempt, finalConfig);
        console.log(
          `[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries} failed, retrying in ${Math.round(delay)}ms`,
        );
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  throw lastError;
}

/**
 * Execute a function with retry logic and a fallback value
 */
export async function withRetryAndFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T),
  config: Partial<RetryConfig> = {},
): Promise<T> {
  try {
    return await withRetry(fn, config);
  } catch (error) {
    console.error('[Retry] All attempts failed, using fallback:', error);
    return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
  }
}
