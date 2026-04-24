import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FallbackStrategy } from '../../../src/core/strategies/FallbackStrategy';

vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
}));

vi.mock('../../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn(),
}));

import { retryRequest } from '../../../src/core/RetryHandler';
import { buildProviderRequest } from '../../../src/core/providerRequest';

const mockRetryResult = (overrides = {}) => ({
  success: false,
  response: undefined,
  error: undefined,
  ...overrides,
});

describe('FallbackStrategy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildProviderRequest).mockResolvedValue({
      body: { model: 'gpt-4o', messages: [] },
      headers: { 'Content-Type': 'application/json' },
      url: 'https://api.openai.com/v1/chat/completions',
    });
  });

  describe('execute()', () => {
    it('returns success when first target succeeds', async () => {
      vi.mocked(retryRequest).mockResolvedValue(
        mockRetryResult({ success: true, response: { status: 200, data: { id: 'test-123' } } })
      );

      const strategy = new FallbackStrategy();
      const targets = [
        { provider: 'openai', api_key: 'key-1' },
        { provider: 'anthropic', api_key: 'key-2' },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.response).toEqual({ status: 200, data: { id: 'test-123' } });
      expect(retryRequest).toHaveBeenCalledTimes(1);
    });

    it('falls back to second target when first fails', async () => {
      vi.mocked(retryRequest)
        .mockResolvedValueOnce(mockRetryResult({ success: false, error: 'HTTP 500' }))
        .mockResolvedValueOnce(mockRetryResult({ success: true, response: { status: 200, data: { id: 'test-456' } } }));

      const strategy = new FallbackStrategy();
      const targets = [
        { provider: 'openai', api_key: 'key-1' },
        { provider: 'anthropic', api_key: 'key-2' },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('anthropic');
      expect(result.response).toEqual({ status: 200, data: { id: 'test-456' } });
      expect(retryRequest).toHaveBeenCalledTimes(2);
    });

    it('returns failure when all targets fail', async () => {
      vi.mocked(retryRequest)
        .mockResolvedValueOnce(mockRetryResult({ success: false, error: 'HTTP 500' }))
        .mockResolvedValueOnce(mockRetryResult({ success: false, error: 'HTTP 502' }));

      const strategy = new FallbackStrategy();
      const targets = [
        { provider: 'openai', api_key: 'key-1' },
        { provider: 'anthropic', api_key: 'key-2' },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 502');
      expect(retryRequest).toHaveBeenCalledTimes(2);
    });

    it('throws error when targets array is empty', async () => {
      const strategy = new FallbackStrategy();
      const targets: Array<Record<string, unknown>> = [];
      const params = { model: 'gpt-4o', messages: [] };

      await expect(strategy.execute(targets, params)).rejects.toThrow('No targets provided');
    });

    it('uses target.provider when provided', async () => {
      vi.mocked(retryRequest).mockResolvedValue(mockRetryResult({ success: true }));

      const strategy = new FallbackStrategy();
      const targets = [{ provider: 'anthropic', api_key: 'key-1' }];
      const params = { model: 'claude-3', messages: [] };

      await strategy.execute(targets, params);

      expect(buildProviderRequest).toHaveBeenCalledWith(expect.anything(), 'anthropic', expect.anything());
    });

    it('defaults to openai when no provider specified', async () => {
      vi.mocked(retryRequest).mockResolvedValue(mockRetryResult({ success: true }));

      const strategy = new FallbackStrategy();
      const targets = [{ api_key: 'key-1' }];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      expect(buildProviderRequest).toHaveBeenCalledWith(expect.anything(), 'openai', expect.anything());
    });

    it('merges params with target.overrideParams', async () => {
      vi.mocked(retryRequest).mockResolvedValue(mockRetryResult({ success: true }));

      const strategy = new FallbackStrategy();
      const targets = [{
        provider: 'openai',
        api_key: 'key-1',
        overrideParams: { model: 'gpt-4o-mini', temperature: 0.7 },
      }];
      const params = { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] };

      await strategy.execute(targets, params);

      expect(buildProviderRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('tryTarget()', () => {
    it('returns success result when retryRequest succeeds', async () => {
      vi.mocked(retryRequest).mockResolvedValue(
        mockRetryResult({
          success: true,
          response: { status: 200, data: { id: 'chat-123' } },
        })
      );

      const strategy = new FallbackStrategy();
      const target = { provider: 'openai', api_key: 'key-1' };
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute([target], params);

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ status: 200, data: { id: 'chat-123' } });
    });

    it('returns failure when retryRequest returns error result', async () => {
      vi.mocked(retryRequest).mockResolvedValue(
        mockRetryResult({
          success: false,
          error: 'HTTP 429',
          response: { status: 429, data: { error: 'Rate limited' } },
        })
      );

      const strategy = new FallbackStrategy();
      const target = { provider: 'openai', api_key: 'key-1' };
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute([target], params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 429');
    });

    it('uses retryConfig when provided', async () => {
      vi.mocked(retryRequest).mockResolvedValue(mockRetryResult({ success: true }));

      const strategy = new FallbackStrategy();
      const target = { provider: 'openai', api_key: 'key-1' };
      const params = { model: 'gpt-4o', messages: [] };
      const retryConfig = { attempts: 5, onStatusCodes: [429, 500] };

      await strategy.execute([target], params, retryConfig);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        retryConfig,
        undefined
      );
    });

    it('uses target.retry when no retryConfig provided', async () => {
      vi.mocked(retryRequest).mockResolvedValue(mockRetryResult({ success: true }));

      const strategy = new FallbackStrategy();
      const target = {
        provider: 'openai',
        api_key: 'key-1',
        retry: { attempts: 2, onStatusCodes: [429] },
      };
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute([target], params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { attempts: 2, onStatusCodes: [429] },
        undefined
      );
    });

    it('passes undefined when no retry config available', async () => {
      vi.mocked(retryRequest).mockResolvedValue(mockRetryResult({ success: true }));

      const strategy = new FallbackStrategy();
      const target = { provider: 'openai', api_key: 'key-1' };
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute([target], params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        undefined,
        undefined
      );
    });
  });
});
