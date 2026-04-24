import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SingleStrategy } from '../../../src/core/strategies/SingleStrategy';
import type { RetryResult } from '../../../src/core/types';

vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
}));

vi.mock('../../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn(),
}));

import { retryRequest } from '../../../src/core/RetryHandler';
import { buildProviderRequest } from '../../../src/core/providerRequest';

describe('SingleStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute() 方法', () => {
    it('空 targets 数组应抛出 Error("No targets provided")', async () => {
      const strategy = new SingleStrategy();
      const targets: Array<Record<string, unknown>> = [];
      const params = { messages: [] };

      await expect(strategy.execute(targets, params)).rejects.toThrow(
        'No targets provided'
      );
    });

    it('单个 target 时应使用该 target', async () => {
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
        targets[0]
      );
      expect(result.provider).toBe('anthropic');
      expect(result.success).toBe(true);
    });

    it('多个 targets 时应忽略除第一个外的所有 targets', async () => {
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
        targets[0]
      );
    });

    describe('Provider 提取', () => {
      it('应使用 target.provider 当提供时', async () => {
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
          expect.anything()
        );
      });

      it('应默认使用 "openai" 当 target.provider 未提供时', async () => {
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
          expect.anything()
        );
      });
    });

    describe('overrideParams 合并', () => {
      it('应将 target.overrideParams 与 params 合并', async () => {
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
          expect.anything()
        );
      });

      it('target.overrideParams 应覆盖 params 中的同名属性', async () => {
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
          expect.anything()
        );
      });
    });
  });

  describe('tryTarget() 方法 (通过 execute 间接测试)', () => {
    it('retryRequest 成功时应返回 success: true', async () => {
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

    it('retryRequest 失败时应返回 success: false', async () => {
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

    describe('Retry Config 传递', () => {
      it('应使用传入的 retryConfig', async () => {
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
          undefined
        );
      });

      it('当未传入 retryConfig 时应使用 target.retry', async () => {
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
          undefined
        );
      });

      it('当两者都没有时应使用 undefined', async () => {
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
          undefined
        );
      });

      it('retryConfig 应优先于 target.retry', async () => {
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

        expect(retryRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          retryConfig,
          undefined
        );
      });
    });
  });
});
