import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SingleStrategy } from '../../../src/core/strategies/SingleStrategy';
import type { RetryResult } from '../../../src/core/types';

vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
}));

vi.mock('../../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn(),
}));

import { buildProviderRequest } from '../../../src/core/providerRequest';
import { retryRequest } from '../../../src/core/RetryHandler';

describe('SingleStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute() method', () => {
    it('should throw Error("No targets provided") when targets array is empty', async () => {
      const strategy = new SingleStrategy();
      const targets: Array<Record<string, unknown>> = [];
      const params = { messages: [] };

      await expect(strategy.execute(targets, params)).rejects.toThrow('No targets provided');
    });

    it('should use the single target when only one target is provided', async () => {
      const strategy = new SingleStrategy();
      const targets = [
        {
          provider: 'anthropic',
          apiKey: 'test-key-anthropic',
          overrideParams: { model: 'claude-3' },
        },
      ];
      const params = { messages: [{ role: 'user', content: 'hello' }] };

      const mockTransformResult = {
        body: { model: 'claude-3', messages: params.messages },
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-key-anthropic' },
        url: 'https://api.anthropic.com/v1/messages',
      };
      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockTransformResult);

      const mockRetryResult: RetryResult = {
        success: true,
        response: { status: 200, data: { id: 'msg_123' } },
      };
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetryResult);

      const result = await strategy.execute(targets, params);

      expect(buildProviderRequest).toHaveBeenCalledTimes(1);
      expect(buildProviderRequest).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3' }),
        'anthropic',
        targets[0],
        expect.anything(),
      );
      expect(result.provider).toBe('anthropic');
      expect(result.success).toBe(true);
    });

    it('should ignore all targets except the first when multiple targets are provided', async () => {
      const strategy = new SingleStrategy();
      const targets = [
        { provider: 'openai', apiKey: 'key-1' },
        { provider: 'anthropic', apiKey: 'key-2' },
        { provider: 'vertex-ai', apiKey: 'key-3' },
      ];
      const params = { messages: [] };

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: { 'Content-Type': 'application/json' },
        url: 'https://api.openai.com/v1/chat/completions',
      });

      const mockRetryResult: RetryResult = { success: true, response: {} };
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetryResult);

      await strategy.execute(targets, params);

      expect(buildProviderRequest).toHaveBeenCalledTimes(1);
      expect(buildProviderRequest).toHaveBeenCalledWith(
        expect.anything(),
        'openai',
        targets[0],
        expect.anything(),
      );
    });

    describe('Provider extraction', () => {
      it('should use target.provider when provided', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'anthropic', apiKey: 'test-key' }];
        const params = { messages: [] };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        const result = await strategy.execute(targets, params);

        expect(result.provider).toBe('anthropic');
        expect(buildProviderRequest).toHaveBeenCalledWith(
          expect.anything(),
          'anthropic',
          expect.anything(),
          expect.anything(),
        );
      });

      it('should default to "openai" when target.provider is not provided', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ apiKey: 'test-key' }];
        const params = { messages: [] };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        const result = await strategy.execute(targets, params);

        expect(result.provider).toBe('openai');
        expect(buildProviderRequest).toHaveBeenCalledWith(
          expect.anything(),
          'openai',
          expect.anything(),
          expect.anything(),
        );
      });
    });

    describe('overrideParams merging', () => {
      it('should merge target.overrideParams with params', async () => {
        const strategy = new SingleStrategy();
        const targets = [
          {
            provider: 'openai',
            apiKey: 'test-key',
            overrideParams: { model: 'gpt-4o', temperature: 0.7 },
          },
        ];
        const params = {
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 100,
        };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params);

        expect(buildProviderRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: params.messages,
            max_tokens: 100,
            model: 'gpt-4o',
            temperature: 0.7,
          }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });

      it('target.overrideParams should override same-named properties in params', async () => {
        const strategy = new SingleStrategy();
        const targets = [
          {
            provider: 'openai',
            apiKey: 'test-key',
            overrideParams: { model: 'gpt-4o' },
          },
        ];
        const params = {
          model: 'gpt-3.5-turbo',
          messages: [],
        };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params);

        expect(buildProviderRequest).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'gpt-4o' }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });
    });
  });

  describe('tryTarget() method (tested indirectly via execute)', () => {
    it('should return success: true when retryRequest succeeds', async () => {
      const strategy = new SingleStrategy();
      const targets = [{ provider: 'openai', apiKey: 'test-key' }];
      const params = { messages: [] };

      const mockRetryResult: RetryResult = {
        success: true,
        response: {
          status: 200,
          data: { id: 'chatcmpl_123', choices: [] },
        },
      };
      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.openai.com/v1/chat/completions',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetryResult);

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockRetryResult.response);
      expect(result.error).toBeUndefined();
    });

    it('should return success: false when retryRequest fails', async () => {
      const strategy = new SingleStrategy();
      const targets = [{ provider: 'openai', apiKey: 'test-key' }];
      const params = { messages: [] };

      const mockRetryResult: RetryResult = {
        success: false,
        response: { status: 500, data: { error: 'Internal Server Error' } },
        error: 'HTTP 500',
      };
      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.openai.com/v1/chat/completions',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetryResult);

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(false);
      expect(result.response).toEqual(mockRetryResult.response);
      expect(result.error).toBe('HTTP 500');
    });

    describe('Retry Config passing', () => {
      it('should use the provided retryConfig', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'openai', apiKey: 'test-key' }];
        const params = { messages: [] };
        const retryConfig = { attempts: 5, onStatusCodes: [429, 500, 503] };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params, retryConfig);

        expect(retryRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          retryConfig,
          undefined,
        );
      });

      it('should use target.retry when retryConfig is not provided', async () => {
        const strategy = new SingleStrategy();
        const targetRetry = { attempts: 3, onStatusCodes: [429, 500] };
        const targets = [{ provider: 'openai', apiKey: 'test-key', retry: targetRetry }];
        const params = { messages: [] };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params);

        expect(retryRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          targetRetry,
          undefined,
        );
      });

      it('should use undefined when neither retryConfig nor target.retry is provided', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'openai', apiKey: 'test-key' }];
        const params = { messages: [] };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params);

        expect(retryRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          undefined,
          undefined,
        );
      });

      it('target.retry should take precedence over global retryConfig (child overrides parent)', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'openai', apiKey: 'test-key', retry: { attempts: 2 } }];
        const params = { messages: [] };
        const retryConfig = { attempts: 10, onStatusCodes: [500] };

        (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params, retryConfig);

        // Nested strategy model: target-level retry is more specific than global retryConfig, should take precedence
        expect(retryRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          { attempts: 2 },
          undefined,
        );
      });
    });
  });
});
