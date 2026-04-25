/**
 * 嵌套策略测试
 * 验证 fallback 内嵌 loadbalance、配置递归继承等场景
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
  retryRequestForStream: vi.fn(),
}));

vi.mock('../../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn(),
}));

import { FallbackStrategy } from '../../../src/core/strategies/FallbackStrategy';
import { LoadBalanceStrategy } from '../../../src/core/strategies/LoadBalanceStrategy';
import { SingleStrategy } from '../../../src/core/strategies/SingleStrategy';
import { retryRequest } from '../../../src/core/RetryHandler';
import { buildProviderRequest } from '../../../src/core/providerRequest';
import { Priorai } from '../../../src/core/Router';

describe('嵌套策略', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildProviderRequest).mockResolvedValue({
      body: { model: 'gpt-4o', messages: [] },
      headers: { 'Content-Type': 'application/json' },
      url: 'https://api.openai.com/v1/chat/completions',
    });
  });

  describe('fallback 内嵌 loadbalance', () => {
    it('第一个 loadbalance 组成功时直接返回', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: { id: 'lb-hit' } },
      });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          // 嵌套 loadbalance 组
          strategy: 'loadbalance' as const,
          targets: [
            { provider: 'openai', apiKey: 'key-1', weight: 1 },
            { provider: 'openai', apiKey: 'key-2', weight: 1 },
          ],
        },
        { provider: 'anthropic', apiKey: 'key-3' },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      // 只调用了一次（loadbalance 组内选了一个）
      expect(retryRequest).toHaveBeenCalledTimes(1);
    });

    it('loadbalance 组失败后 fallback 到下一个叶节点', async () => {
      vi.mocked(retryRequest)
        .mockResolvedValueOnce({ success: false, error: 'HTTP 500' })
        .mockResolvedValueOnce({
          success: true,
          response: { status: 200, data: { id: 'fallback-hit' } },
        });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          strategy: 'loadbalance' as const,
          targets: [
            { provider: 'openai', apiKey: 'key-1', weight: 1 },
          ],
        },
        { provider: 'anthropic', apiKey: 'key-2' },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('anthropic');
      expect(retryRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadbalance 内嵌 fallback', () => {
    it('选中的 fallback 组内部按顺序尝试', async () => {
      vi.mocked(retryRequest)
        .mockResolvedValueOnce({ success: false, error: 'HTTP 500' })
        .mockResolvedValueOnce({
          success: true,
          response: { status: 200, data: { id: 'nested-fallback' } },
        });

      const strategy = new LoadBalanceStrategy();
      const targets = [
        {
          weight: 100, // 确保选中这个
          strategy: 'fallback' as const,
          targets: [
            { provider: 'openai', apiKey: 'key-1' },
            { provider: 'anthropic', apiKey: 'key-2' },
          ],
        },
        { provider: 'cohere', apiKey: 'key-3', weight: 0 },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('anthropic');
    });
  });

  describe('三层嵌套', () => {
    it('fallback → loadbalance → single 递归正确', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: { id: 'deep-nested' } },
      });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          strategy: 'loadbalance' as const,
          targets: [
            {
              weight: 100,
              strategy: 'single' as const,
              targets: [
                { provider: 'openai', apiKey: 'key-deep' },
              ],
            },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      const result = await strategy.execute(targets, params);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
    });
  });

  describe('配置继承', () => {
    it('overrideParams 从父级向下合并，子级覆盖父级', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          strategy: 'single' as const,
          overrideParams: { temperature: 0.5, top_p: 0.9 },
          targets: [
            {
              provider: 'openai',
              apiKey: 'key-1',
              overrideParams: { temperature: 0.8 }, // 覆盖父级的 temperature
            },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      // buildProviderRequest 应收到合并后的 params
      expect(buildProviderRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.8,  // 子级覆盖
          top_p: 0.9,        // 父级保留
        }),
        'openai',
        expect.anything(),
        expect.anything()
      );
    });

    it('retry 配置子级优先于父级', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          strategy: 'single' as const,
          retry: { attempts: 5, onStatusCodes: [500] },
          targets: [
            {
              provider: 'openai',
              apiKey: 'key-1',
              retry: { attempts: 2 }, // 子级覆盖
            },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { attempts: 2 }, // 子级的 retry
        undefined
      );
    });

    it('timeout 子级优先于父级', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          strategy: 'single' as const,
          timeout: 30000,
          targets: [
            {
              provider: 'openai',
              apiKey: 'key-1',
              timeout: 5000, // 子级覆盖
            },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        undefined,
        5000 // 子级的 timeout
      );
    });

    it('子级没有 timeout 时继承父级', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const strategy = new SingleStrategy();
      const targets = [
        {
          strategy: 'single' as const,
          timeout: 15000,
          targets: [
            { provider: 'openai', apiKey: 'key-1' },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        undefined,
        15000 // 继承父级
      );
    });
  });

  describe('Config 验证', () => {
    it('嵌套 target 有 strategy 但没有 targets 时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [
          { strategy: 'loadbalance' },
        ],
      })).toThrow('requires non-empty "targets" array');
    });

    it('嵌套 target 有 targets 但没有 strategy 时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [
          { targets: [{ provider: 'openai' }] },
        ],
      })).toThrow('missing "strategy" field');
    });

    it('嵌套 target 使用未知 strategy 时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [
          { strategy: 'roundrobin', targets: [{ provider: 'openai' }] },
        ],
      })).toThrow('unknown strategy: roundrobin');
    });

    it('合法的嵌套配置不抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [
          {
            strategy: 'loadbalance',
            targets: [
              { provider: 'openai', apiKey: 'key-1', weight: 3 },
              { provider: 'openai', apiKey: 'key-2', weight: 1 },
            ],
          },
          { provider: 'anthropic', apiKey: 'key-3' },
        ],
      })).not.toThrow();
    });
  });
});
