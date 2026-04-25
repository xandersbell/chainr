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
    it('returns success=true and response when fetch returns ok=true (200-299)', async () => {
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

    it('response includes status code and parsed JSON data', async () => {
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
    it('retries attempts times on 429 then returns failure', async () => {
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

    it('retry interval uses exponential backoff: delay = 100ms * 2^attempt', async () => {
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

    it('returns success=false and error="HTTP 429" after max retries', async () => {
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
    it('500 error retries 3 times then returns failure', async () => {
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

    it('502 error retries 3 times then returns failure', async () => {
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

    it('503 error retries 3 times then returns failure', async () => {
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

    it('504 error retries 3 times then returns failure', async () => {
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
    it('400 returns failure immediately without retry', async () => {
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

    it('401 returns failure immediately without retry', async () => {
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

    it('404 returns failure immediately without retry', async () => {
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
    it('retries with exponential backoff on network error', async () => {
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

    it('returns network error message after max retries', async () => {
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

    it('converts non-Error objects to string', async () => {
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
    it('default attempts is 3', async () => {
      const mockResponse429 = createErrorResponse(429);
      const fetchMock = vi.fn().mockResolvedValue(mockResponse429);
      vi.stubGlobal('fetch', fetchMock);

      const promise = retryRequest('https://api.example.com/test', { method: 'GET' });

      await vi.runAllTimersAsync();
      await promise;

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('default retry status codes are [429, 500, 502, 503, 504]', async () => {
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

    it('default timeout is 30000ms', async () => {
      const mockResponse = createSuccessResponse(200, { success: true });
      const fetchMock = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', fetchMock);

      const result = await retryRequest('https://api.example.com/test', { method: 'GET' });

      expect(result.success).toBe(true);
    });
  });

  describe('Response Parsing', () => {
    it('data is empty object when JSON parsing fails', async () => {
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

    it('successfully parses JSON response', async () => {
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
    it('custom attempts overrides default value', async () => {
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

    it('custom onStatusCodes overrides default retry status codes', async () => {
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

    it('custom timeoutMs works correctly', async () => {
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
