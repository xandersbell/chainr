import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SingleStrategy } from '../../../src/core/strategies/SingleStrategy';
import type { RetryResult } from '../../../src/core/types';

// 模拟 RetryHandler 模块
vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
}));

// 模拟 transformRequest 模块
vi.mock('../../../src/core/transformRequest', () => ({
  transformRequest: vi.fn(),
}));

import { retryRequest } from '../../../src/core/RetryHandler';
import { transformRequest } from '../../../src/core/transformRequest';

describe('SingleStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute() 方法', () => {
    // 1. 空 targets 数组 - 抛出 Error('No targets provided')
    it('空 targets 数组应抛出 Error("No targets provided")', async () => {
      const strategy = new SingleStrategy();
      const targets: Array<Record<string, unknown>> = [];
      const params = { messages: [] };

      await expect(strategy.execute(targets, params)).rejects.toThrow(
        'No targets provided'
      );
    });

    // 2. 单个 target - 只使用第一个
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

      // Mock transformRequest 返回值
      const mockTransformResult = {
        body: { model: 'claude-3', messages: params.messages },
        headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-key-anthropic' },
        url: 'https://api.anthropic.com/v1/messages',
      };
      (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue(mockTransformResult);

      // Mock retryRequest 返回值
      const mockRetryResult: RetryResult = {
        success: true,
        response: { status: 200, data: { id: 'msg_123' } },
      };
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetryResult);

      const result = await strategy.execute(targets, params);

      // 验证只使用了第一个 target
      expect(transformRequest).toHaveBeenCalledTimes(1);
      expect(transformRequest).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-3' }),
        'anthropic',
        targets[0]
      );
      expect(result.provider).toBe('anthropic');
      expect(result.success).toBe(true);
    });

    // 3. 多个 targets - 忽略除第一个外的所有 targets
    it('多个 targets 时应忽略除第一个外的所有 targets', async () => {
      const strategy = new SingleStrategy();
      const targets = [
        { provider: 'openai', apiKey: 'key-1' },
        { provider: 'anthropic', apiKey: 'key-2' },
        { provider: 'vertex-ai', apiKey: 'key-3' },
      ];
      const params = { messages: [] };

      const mockTransformResult = {
        body: {},
        headers: { 'Content-Type': 'application/json' },
        url: 'https://api.openai.com/v1/chat/completions',
      };
      (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue(mockTransformResult);

      const mockRetryResult: RetryResult = { success: true, response: {} };
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockRetryResult);

      await strategy.execute(targets, params);

      // 验证 transformRequest 只被调用一次
      expect(transformRequest).toHaveBeenCalledTimes(1);
      // 验证 provider 是第一个 target 的 provider
      expect(transformRequest).toHaveBeenCalledWith(
        expect.anything(),
        'openai',
        targets[0]
      );
    });

    // 4. Provider 提取 - 使用 target.provider 或默认为 'openai'
    describe('Provider 提取', () => {
      it('应使用 target.provider 当提供时', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'anthropic', apiKey: 'test-key' }];
        const params = { messages: [] };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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
        expect(transformRequest).toHaveBeenCalledWith(
          expect.anything(),
          'anthropic',
          expect.anything()
        );
      });

      it('应默认使用 "openai" 当 target.provider 未提供时', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ apiKey: 'test-key' }]; // 没有 provider
        const params = { messages: [] };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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
        expect(transformRequest).toHaveBeenCalledWith(
          expect.anything(),
          'openai',
          expect.anything()
        );
      });
    });

    // 5. overrideParams 合并 - params 与 target.overrideParams 合并
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

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params);

        // 验证 transformRequest 被调用时合并了 params 和 overrideParams
        expect(transformRequest).toHaveBeenCalledWith(
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
            overrideParams: { model: 'gpt-4o' }, // 覆盖 params.model
          },
        ];
        const params = {
          model: 'gpt-3.5-turbo', // 将被覆盖
          messages: [],
        };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
          body: {},
          headers: {},
          url: '',
        });
        (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
          success: true,
          response: {},
        });

        await strategy.execute(targets, params);

        expect(transformRequest).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'gpt-4o' }),
          expect.anything(),
          expect.anything()
        );
      });
    });
  });

  describe('tryTarget() 方法 (通过 execute 间接测试)', () => {
    // 1. retryRequest 成功结果 - 返回 success: true
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
      (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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

    // 2. retryRequest 失败结果 - 返回 success: false
    it('retryRequest 失败时应返回 success: false', async () => {
      const strategy = new SingleStrategy();
      const targets = [{ provider: 'openai', apiKey: 'test-key' }];
      const params = { messages: [] };

      const mockRetryResult: RetryResult = {
        success: false,
        response: { status: 500, data: { error: 'Internal Server Error' } },
        error: 'HTTP 500',
      };
      (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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

    // 3. Retry config 传递 - 使用 retryConfig 或 target.retry
    describe('Retry Config 传递', () => {
      it('应使用传入的 retryConfig', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'openai', apiKey: 'test-key' }];
        const params = { messages: [] };
        const retryConfig = { attempts: 5, onStatusCodes: [429, 500, 503] };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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
          retryConfig
        );
      });

      it('当未传入 retryConfig 时应使用 target.retry', async () => {
        const strategy = new SingleStrategy();
        const targetRetry = { attempts: 3, onStatusCodes: [429, 500] };
        const targets = [{ provider: 'openai', apiKey: 'test-key', retry: targetRetry }];
        const params = { messages: [] };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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
          targetRetry
        );
      });

      it('当两者都没有时应使用 undefined', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'openai', apiKey: 'test-key' }];
        const params = { messages: [] };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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
          undefined
        );
      });

      it('retryConfig 应优先于 target.retry', async () => {
        const strategy = new SingleStrategy();
        const targets = [{ provider: 'openai', apiKey: 'test-key', retry: { attempts: 2 } }];
        const params = { messages: [] };
        const retryConfig = { attempts: 10, onStatusCodes: [500] };

        (transformRequest as ReturnType<typeof vi.fn>).mockReturnValue({
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
          retryConfig
        );
      });
    });
  });
});
