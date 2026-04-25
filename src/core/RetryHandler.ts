import { MAX_RETRY_LIMIT_MS } from '../globals';
import type { RetryResult, RetryResultForStream } from './types';

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
const BASE_DELAY_MS = 100;

/**
 * Retry-after header priority (aligned with Portkey)
 * retry-after-ms / x-ms-retry-after-ms values are in milliseconds
 * retry-after values are in seconds
 */
const RETRY_AFTER_HEADERS = ['retry-after-ms', 'x-ms-retry-after-ms', 'retry-after'];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_RETRY_LIMIT_MS);
}

/**
 * Parse retry-after wait time from response headers (in milliseconds)
 * Returns undefined if no retry-after header is present
 */
function parseRetryAfter(headers: Headers): number | undefined {
  for (const headerName of RETRY_AFTER_HEADERS) {
    const value = headers.get(headerName);
    if (value) {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isNaN(parsed) || parsed <= 0) continue;
      // retry-after header value is in seconds, needs conversion to milliseconds
      return headerName === 'retry-after' ? parsed * 1000 : parsed;
    }
  }
  return undefined;
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function retryRequest(
  url: string,
  options: RequestInit,
  retryConfig?: { attempts?: number; onStatusCodes?: number[] },
  timeoutMs: number = 30000,
): Promise<RetryResult> {
  const attempts = retryConfig?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const statusCodes = retryConfig?.onStatusCodes ?? DEFAULT_RETRY_STATUS_CODES;

  let lastResponse: Record<string, unknown> | undefined;
  let lastError: string | undefined;
  // Total retry-after budget (aligned with Portkey's remainingRetryTimeout)
  let remainingRetryBudget = MAX_RETRY_LIMIT_MS;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      const data = await response.json().catch(() => ({}));
      lastResponse = { status: response.status, data };

      if (response.ok) {
        return { success: true, response: lastResponse };
      }

      const shouldRetry = statusCodes.includes(response.status);
      if (!shouldRetry) {
        return { success: false, response: lastResponse, error: `HTTP ${response.status}` };
      }

      lastError = `HTTP ${response.status}`;

      if (attempt < attempts - 1) {
        const delay = getSmartDelay(attempt, response, remainingRetryBudget);
        if (delay === null) {
          // retry-after exceeded budget, abort retry
          break;
        }
        remainingRetryBudget -= delay;
        await sleep(delay);
      }
    } catch (error) {
      // ConnectTimeoutError -> when host is unreachable, wrap as 503 so fallback/retry handles properly
      if (
        error instanceof TypeError &&
        error.cause instanceof Error &&
        (error.cause as Error).name === 'ConnectTimeoutError'
      ) {
        lastResponse = {
          status: 503,
          data: { error: { message: error.message, type: 'connect_timeout' } },
        };
        lastError = `ConnectTimeoutError: ${error.message}`;
      } else {
        lastError = error instanceof Error ? error.message : String(error);
      }
      if (attempt < attempts - 1) {
        const delay = getRetryDelay(attempt);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    response: lastResponse,
    error: lastError || 'Max retries exceeded',
  };
}

export async function retryRequestForStream(
  url: string,
  options: RequestInit,
  retryConfig?: { attempts?: number; onStatusCodes?: number[] },
  timeoutMs: number = 60000,
): Promise<RetryResultForStream> {
  const attempts = retryConfig?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const statusCodes = retryConfig?.onStatusCodes ?? DEFAULT_RETRY_STATUS_CODES;

  let lastError: string | undefined;
  let remainingRetryBudget = MAX_RETRY_LIMIT_MS;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (response.ok) {
        return { success: true, response };
      }

      const shouldRetry = statusCodes.includes(response.status);
      if (!shouldRetry) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      lastError = `HTTP ${response.status}`;

      if (attempt < attempts - 1) {
        const delay = getSmartDelay(attempt, response, remainingRetryBudget);
        if (delay === null) {
          break;
        }
        remainingRetryBudget -= delay;
        await sleep(delay);
      }
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.cause instanceof Error &&
        (error.cause as Error).name === 'ConnectTimeoutError'
      ) {
        lastError = `ConnectTimeoutError: ${error.message}`;
      } else {
        lastError = error instanceof Error ? error.message : String(error);
      }
      if (attempt < attempts - 1) {
        const delay = getRetryDelay(attempt);
        await sleep(delay);
      }
    }
  }

  return { success: false, error: lastError || 'Max retries exceeded' };
}

/**
 * Smart delay calculation: prefer provider's retry-after header, otherwise use exponential backoff
 * Returns null if retry-after exceeds budget, indicating retry should be abandoned
 */
function getSmartDelay(
  attempt: number,
  response: Response,
  remainingBudget: number,
): number | null {
  // Only attempt to read retry-after on 429
  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers);
    if (retryAfter !== undefined) {
      // Single wait exceeds total budget cap, or exceeds remaining budget -> abandon
      if (retryAfter >= MAX_RETRY_LIMIT_MS || retryAfter > remainingBudget) {
        return null;
      }
      return retryAfter;
    }
  }
  // No retry-after header, use exponential backoff
  return getRetryDelay(attempt);
}
