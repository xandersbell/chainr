/**
 * Nested strategy tests
 * Verify fallback-within-loadbalance, config recursive inheritance, etc.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
  retryRequestForStream: vi.fn(),
}));

vi.mock('../../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn(),
}));

import { buildProviderRequest } from '../../../src/core/providerRequest';
import { retryRequest } from '../../../src/core/RetryHandler';
import { Priorai } from '../../../src/core/Router';
import { FallbackStrategy } from '../../../src/core/strategies/FallbackStrategy';
import { LoadBalanceStrategy } from '../../../src/core/strategies/LoadBalanceStrategy';
import { SingleStrategy } from '../../../src/core/strategies/SingleStrategy';

describe('Nested strategies', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildProviderRequest).mockResolvedValue({
      body: { model: 'gpt-4o', messages: [] },
      headers: { 'Content-Type': 'application/json' },
      url: 'https://api.openai.com/v1/chat/completions',
    });
  });

  describe('fallback with embedded loadbalance', () => {
    it('returns immediately when first loadbalance group succeeds', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: { id: 'lb-hit' } },
      });

      const strategy = new FallbackStrategy();
      const targets = [
        {
          // nested loadbalance group
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
      // called only once (loadbalance group selected one)
      expect(retryRequest).toHaveBeenCalledTimes(1);
    });

    it('falls back to next leaf node when loadbalance group fails', async () => {
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
          targets: [{ provider: 'openai', apiKey: 'key-1', weight: 1 }],
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

  describe('loadbalance with embedded fallback', () => {
    it('selected fallback group tries targets in order', async () => {
      vi.mocked(retryRequest)
        .mockResolvedValueOnce({ success: false, error: 'HTTP 500' })
        .mockResolvedValueOnce({
          success: true,
          response: { status: 200, data: { id: 'nested-fallback' } },
        });

      const strategy = new LoadBalanceStrategy();
      const targets = [
        {
          weight: 100, // ensure this is selected
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

  describe('Three-level nesting', () => {
    it('fallback -> loadbalance -> single recursion works correctly', async () => {
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
              targets: [{ provider: 'openai', apiKey: 'key-deep' }],
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

  describe('Config inheritance', () => {
    it('overrideParams merges top-down, child overrides parent', async () => {
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
              overrideParams: { temperature: 0.8 }, // override parent's temperature
            },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      // buildProviderRequest should receive merged params
      expect(buildProviderRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0.8, // child overrides
          top_p: 0.9, // parent preserved
        }),
        'openai',
        expect.anything(),
        expect.anything(),
      );
    });

    it('retry config child takes priority over parent', async () => {
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
              retry: { attempts: 2 }, // child overrides
            },
          ],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { attempts: 2 }, // child's retry
        undefined,
      );
    });

    it('timeout child takes priority over parent', async () => {
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
              timeout: 5000, // child overrides
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
        5000, // child's timeout
      );
    });

    it('inherits parent timeout when child has no timeout', async () => {
      vi.mocked(retryRequest).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const strategy = new SingleStrategy();
      const targets = [
        {
          strategy: 'single' as const,
          timeout: 15000,
          targets: [{ provider: 'openai', apiKey: 'key-1' }],
        },
      ];
      const params = { model: 'gpt-4o', messages: [] };

      await strategy.execute(targets, params);

      expect(retryRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        undefined,
        15000, // inherit from parent
      );
    });
  });

  describe('Config validation', () => {
    it('throws when nested target has strategy but no targets', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [{ strategy: 'loadbalance' }],
          }),
      ).toThrow('requires non-empty "targets" array');
    });

    it('throws when nested target has targets but no strategy', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [{ targets: [{ provider: 'openai' }] }],
          }),
      ).toThrow('missing "strategy" field');
    });

    it('throws when nested target uses unknown strategy', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [{ strategy: 'roundrobin', targets: [{ provider: 'openai' }] }],
          }),
      ).toThrow('unknown strategy: roundrobin');
    });

    it('valid nested config does not throw', () => {
      expect(
        () =>
          new Priorai({
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
          }),
      ).not.toThrow();
    });
  });
});
