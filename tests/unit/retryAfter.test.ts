/**
 * retry-after header 支持测试
 * 验证 RetryHandler 正确解析 retry-after / retry-after-ms / x-ms-retry-after-ms
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryRequest } from '../../src/core/RetryHandler';

describe('retry-after header 支持', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    // 加速测试：mock setTimeout 让 sleep 立即返回
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

  it('429 响应带 retry-after-ms 头时使用该值作为等待时间', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after-ms': '500' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // 推进 fake timer 让 sleep 完成
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('429 响应带 x-ms-retry-after-ms 头时使用该值', async () => {
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

  it('429 响应带 retry-after 头（秒）时转换为毫秒', async () => {
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

  it('retry-after-ms 优先于 retry-after', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, {
        'retry-after-ms': '100',
        'retry-after': '10', // 10s = 10000ms，但应被忽略
      }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // 应使用 100ms 而非 10000ms
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
  });

  it('retry-after 超过 60s 预算时放弃重试', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '120' })); // 120s > 60s

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 3, onStatusCodes: [429] }
    );

    // 不需要等待，应立即放弃
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.success).toBe(false);
    // 只调用了一次，没有重试
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('非 429 状态码不读取 retry-after，使用指数退避', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(500, { 'retry-after-ms': '100' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [500] }
    );

    // 指数退避第一次：100ms (BASE_DELAY_MS * 2^0)
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('多次 429 累计 retry-after 超出预算时放弃', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '30' }))  // 30s
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': '40' })); // 40s，累计 70s > 60s

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 3, onStatusCodes: [429] }
    );

    // 第一次等 30s
    await vi.advanceTimersByTimeAsync(30000);
    // 第二次 40s > 剩余 30s，放弃
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retry-after 值无效时回退到指数退避', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { 'retry-after': 'invalid' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = retryRequest(
      'https://api.example.com/v1/chat',
      { method: 'POST', headers: {}, body: '{}' },
      { attempts: 2, onStatusCodes: [429] }
    );

    // 回退到指数退避：100ms
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
