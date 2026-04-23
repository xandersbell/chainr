import type { RetryResult } from './types';
import { MAX_RETRY_LIMIT_MS } from '../globals';

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
const BASE_DELAY_MS = 100;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_LIMIT_MS);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
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
  timeoutMs: number = 30000
): Promise<RetryResult> {
  const attempts = retryConfig?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
  const statusCodes = retryConfig?.onStatusCodes ?? DEFAULT_RETRY_STATUS_CODES;

  let lastResponse: Record<string, unknown> | undefined;
  let lastError: string | undefined;

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

      if (attempt < attempts - 1) {
        const delay = getRetryDelay(attempt);
        await sleep(delay);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
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