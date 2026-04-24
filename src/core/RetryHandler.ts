import type { RetryResult, RetryResultForStream } from './types';
import { MAX_RETRY_LIMIT_MS } from '../globals';

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
const BASE_DELAY_MS = 100;

/**
 * retry-after header 优先级（对齐 Portkey）
 * retry-after-ms / x-ms-retry-after-ms 值为毫秒
 * retry-after 值为秒
 */
const RETRY_AFTER_HEADERS = ['retry-after-ms', 'x-ms-retry-after-ms', 'retry-after'];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_LIMIT_MS);
}

/**
 * 从响应头中解析 retry-after 等待时间（毫秒）
 * 返回 undefined 表示没有 retry-after 头
 */
function parseRetryAfter(headers: Headers): number | undefined {
  for (const headerName of RETRY_AFTER_HEADERS) {
    const value = headers.get(headerName);
    if (value) {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isNaN(parsed) || parsed <= 0) continue;
      // retry-after 头的值是秒，需要转换为毫秒
      return headerName === 'retry-after' ? parsed * 1000 : parsed;
    }
  }
  return undefined;
}

export async function fetchWithTimeout(
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
  // retry-after 总预算（对齐 Portkey 的 remainingRetryTimeout）
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
          // retry-after 超出预算，放弃重试
          break;
        }
        remainingRetryBudget -= delay;
        await sleep(delay);
      }
    } catch (error) {
      // ConnectTimeoutError → 当 host 不可达时，包装为 503 让 fallback/retry 正常处理
      if (
        error instanceof TypeError &&
        error.cause instanceof Error &&
        (error.cause as Error).name === 'ConnectTimeoutError'
      ) {
        lastResponse = { status: 503, data: { error: { message: error.message, type: 'connect_timeout' } } };
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
  timeoutMs: number = 60000
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
      // ConnectTimeoutError → 当 host 不可达时，包装为 503 让 fallback/retry 正常处理
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
 * 智能延迟计算：优先使用 provider 返回的 retry-after，否则用指数退避
 * 返回 null 表示 retry-after 超出预算，应放弃重试
 */
function getSmartDelay(
  attempt: number,
  response: Response,
  remainingBudget: number
): number | null {
  // 仅在 429 时尝试读取 retry-after
  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers);
    if (retryAfter !== undefined) {
      // 单次等待超过总预算上限，或超出剩余预算 → 放弃
      if (retryAfter >= MAX_RETRY_LIMIT_MS || retryAfter > remainingBudget) {
        return null;
      }
      return retryAfter;
    }
  }
  // 没有 retry-after 头，使用指数退避
  return getRetryDelay(attempt);
}
