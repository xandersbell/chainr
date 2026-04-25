/**
 * retry-after header support test
 * Verify RetryHandler correctly parses retry-after / retry-after-ms / x-ms-retry-after-ms
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryRequest } from '../../src/core/RetryHandler';

describe('retry-after header support', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    // Speed up test: mock setTimeout so sleep returns immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeResponse(status: number, headers: Record<string, string> = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(headers),
      json: () => Promise.resolve({ error: `HTTP ${status}` }),
    };
  }

  it('uses retry-after-ms header value as wait time when 429 response has it', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after-ms': '500' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // advance fake timer to complete sleep
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses x-ms-retry-after-ms header value when 429 response has it', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'x-ms-retry-after-ms': '300' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    await vi.advanceTimersByTimeAsync(300);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('converts retry-after header (seconds) to milliseconds when 429 response has it', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // retry-after: 2 → 2000ms
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retry-after-ms takes priority over retry-after', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, {
        'retry-after-ms': '100',
        'retry-after': '10', // 10s = 10000ms, but should be ignored
      }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // should use 100ms instead of 10000ms
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
  });

  it('gives up retry when retry-after exceeds 60s budget', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '120' })); // 120s > 60s

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 3, onStatusCodes: [429] }
    );

    // no waiting needed, should give up immediately
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.success).toBe(false);
    // only called once, no retry
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('non-429 status codes ignore retry-after and use exponential backoff', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(500, { 'retry-after-ms': '100' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [500] }
    );

    // exponential backoff first attempt: 100ms (BASE_DELAY_MS * 2^0)
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('gives up when cumulative retry-after across multiple 429s exceeds budget', async () => {
    fetchSpy
.mockResolvedValueOnce(makeResponse(429, { 'retry-after': '30' })) // 30s
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '40' })); // 40s, cumulative 70s > 60s

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 3, onStatusCodes: [429] }
    );

    // wait first: 30s
    await vi.advanceTimersByTimeAsync(30000);
    // second: 40s > remaining 30s, give up
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to exponential backoff when retry-after value is invalid', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': 'invalid' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // fallback to exponential backoff: 100ms
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
