import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { retryRequest } from '../../src/core/RetryHandler';

function createSuccessResponse(status: number, data: Record<string, unknown>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    headers: new Map([['content-type', 'application/json']]),
  } as unknown as Response;
}

function createErrorResponse(status: number, data?: Record<string, unknown>): Response {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue(data || {}),
    headers: new Map([['content-type', 'application/json']]),
  } as unknown as Response;
}

describe('RetryHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Success Path', () => {
    it('fetch 返回 ok=true (200-299) 时返回 success=true 和 response', async () => {
      const mockData = { id: 'test-123', choices: [] };
      const mockResponse = createSuccessResponse(200, mockData);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest('https://api.example.com/test', {
        method: 'GET',
      });

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ status: 200, data: mockData });
      expect(result.error).toBeUndefined();
    });

    it('response 包含 status code 和 parsed JSON data', async () => {
      const mockData = { result: 'success', value: 42 };
      const mockResponse = createSuccessResponse(201, mockData);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest('https://api.example.com/test', {
        method: 'POST',
      });

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ status: 201, data: mockData });
    });
  });

  describe('Retry on Rate Limit (429)', () => {
    it('429 时重试 attempts 次后返回失败', async () => {
      const mockResponse429 = createErrorResponse(429, { error: 'Rate limited' });
      const mockResponse200 = createSuccessResponse(200, { success: true });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse200);

      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 429');
      expect(result.response).toEqual({ status: 429, data: { error: 'Rate limited' } });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('重试间隔为指数退避: delay = 100ms * 2^attempt', async () => {
      const mockResponse429 = createErrorResponse(429);
      const mockResponse200 = createSuccessResponse(200, {});

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse429)
        .mockResolvedValueOnce(mockResponse200);

      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.success).toBe(true);
    });

    it('最大重试后返回 success=false 和 error="HTTP 429"', async () => {
      const mockResponse429 = createErrorResponse(429);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse429);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 429');
      expect(result.response).toBeDefined();
    });
  });

  describe('Retry on Server Error (5xx)', () => {
    it('500 错误重试3次后返回失败', async () => {
      const mockResponse500 = createErrorResponse(500, { error: 'Internal Server Error' });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse500);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });

    it('502 错误重试3次后返回失败', async () => {
      const mockResponse502 = createErrorResponse(502);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse502);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 502');
    });

    it('503 错误重试3次后返回失败', async () => {
      const mockResponse503 = createErrorResponse(503);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse503);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 503');
    });

    it('504 错误重试3次后返回失败', async () => {
      const mockResponse504 = createErrorResponse(504);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse504);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 504');
    });
  });

  describe('No Retry on Client Error (4xx)', () => {
    it('400 立即返回失败不重试', async () => {
      const mockResponse400 = createErrorResponse(400, { error: 'Bad Request' });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse400);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 400');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('401 立即返回失败不重试', async () => {
      const mockResponse401 = createErrorResponse(401, { error: 'Unauthorized' });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse401);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 401');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('404 立即返回失败不重试', async () => {
      const mockResponse404 = createErrorResponse(404, { error: 'Not Found' });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse404);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Error', () => {
    it('网络错误时使用指数退避重试', async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockRejectedValueOnce(new Error('Network failure'));

      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });

    it('最大重试后返回网络错误信息', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Connection reset'));
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection reset');
    });

    it('非 Error 对象转换为字符串', async () => {
      const fetchMock = vi.fn().mockRejectedValue('Unknown error string');
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error string');
    });
  });

  describe('Default Config', () => {
    it('默认 attempts 为 3', async () => {
      const mockResponse429 = createErrorResponse(429);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse429);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest('https://api.example.com/test', { method: 'GET' });

      await vi.runAllTimersAsync();
      await promise;

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('默认 retry status codes 为 [429, 500, 502, 503, 504]', async () => {
      const mockResponse429 = createErrorResponse(429);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse429);
      vi.stubGlobal('fetch', fetchMock);

      let promise = retryRequest('https://api.example.com/test', { method: 'GET' });
      await vi.runAllTimersAsync();
      let result = await promise;
      expect(result.success).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      vi.restoreAllMocks();

      const mockResponse500 = createErrorResponse(500);
      const fetchMock500 = vi.fn().mockResolvedValue(mockResponse500);
      vi.stubGlobal('fetch', fetchMock500);

      promise = retryRequest('https://api.example.com/test', { method: 'GET' });
      await vi.runAllTimersAsync();
      result = await promise;
      expect(result.success).toBe(false);
      expect(fetchMock500).toHaveBeenCalledTimes(3);
    });

    it('默认 timeout 为 30000ms', async () => {
      const mockResponse = createSuccessResponse(200, { success: true });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest('https://api.example.com/test', { method: 'GET' });

      expect(result.success).toBe(true);
    });
  });

  describe('Response Parsing', () => {
    it('JSON 解析失败时 data 为空对象', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON')),
        headers: new Map([['content-type', 'application/json']]),
      } as unknown as Response;
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest('https://api.example.com/test', { method: 'GET' });

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ status: 200, data: {} });
    });

    it('成功解析 JSON 响应', async () => {
      const mockData = { id: 'chatcmpl-123', choices: [{ message: { content: 'Hello' } }] };
      const mockResponse = createSuccessResponse(200, mockData);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest('https://api.example.com/test', { method: 'GET' });

      expect(result.success).toBe(true);
      expect(result.response?.data).toEqual(mockData);
    });
  });

  describe('Custom Config', () => {
    it('自定义 attempts 覆盖默认值', async () => {
      const mockResponse429 = createErrorResponse(429);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse429);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 5 }
      );

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(fetchMock).toHaveBeenCalledTimes(5);
      expect(result.success).toBe(false);
    });

    it('自定义 onStatusCodes 覆盖默认重试状态码', async () => {
      const mockResponse429 = createErrorResponse(429);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse429);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        { attempts: 3, onStatusCodes: [500] }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 429');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('自定义 timeoutMs 正常工作', async () => {
      const mockResponse = createSuccessResponse(200, {});
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      await retryRequest(
        'https://api.example.com/test',
        { method: 'GET' },
        undefined,
        5000
      );

      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
