import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadBalanceStrategy } from '../../../src/core/strategies/LoadBalanceStrategy';

vi.mock('../../../src/core/RetryHandler', () => ({
  retryRequest: vi.fn(),
}));

vi.mock('../../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn(),
}));

import { buildProviderRequest } from '../../../src/core/providerRequest';
import { retryRequest } from '../../../src/core/RetryHandler';

describe('LoadBalanceStrategy', () => {
  let strategy: LoadBalanceStrategy;

  beforeEach(() => {
    strategy = new LoadBalanceStrategy();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute()', () => {
    it('should throw Error("No targets provided for load balance") when targets array is empty', async () => {
      await expect(strategy.execute([], { messages: [], model: 'test' })).rejects.toThrow(
        'No targets provided for load balance',
      );
    });
  });

  describe('selectByWeight()', () => {
    it('single target always returns that target', async () => {
      const targets = [{ provider: 'openai', weight: 1 }];
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });
      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.openai.com/v1/chat/completions',
      });

      const result = strategy.execute(targets, { messages: [], model: 'test' });
      expect(result).resolves.toBeDefined();
    });

    it('two equal-weight targets (50/50) - selects first when random=0.4', async () => {
      const targets = [
        { provider: 'openai', weight: 1 },
        { provider: 'anthropic', weight: 1 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.4);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.openai.com/v1/chat/completions',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, { messages: [], model: 'test' });
      expect(result.provider).toBe('openai');
    });

    it('selects only targets that support the requested multimodal input', async () => {
      const targets = [
        { provider: 'openai', weight: 100 },
        { provider: 'vertex-ai', weight: 1 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file: {
                  url: 'https://example.com/test.mp4',
                  mime_type: 'video/mp4',
                },
              },
            ],
          },
        ],
      });

      expect(result.provider).toBe('vertex-ai');
      expect(buildProviderRequest).toHaveBeenCalledWith(
        expect.anything(),
        'vertex-ai',
        expect.anything(),
        expect.anything(),
      );
    });

    it('filters targets using target override params before weighted selection', async () => {
      const targets = [
        {
          provider: 'openai',
          weight: 100,
          overrideParams: {
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_file',
                    file: {
                      url: 'https://example.com/test.mp4',
                      mime_type: 'video/mp4',
                    },
                  },
                ],
              },
            ],
          },
        },
        { provider: 'vertex-ai', weight: 1 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, {
        model: 'gemini-2.5-pro',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('vertex-ai');
    });

    it('throws when no target supports OpenAI responses vision input or endpoint', async () => {
      const targets = [{ provider: 'anthropic', weight: 1 }, { provider: 'vertex-ai', weight: 1 }];

      await expect(
        strategy.execute(
          targets,
          {
            model: 'gpt-4o',
            input: [
              {
                role: 'user',
                content: [
                  {
                    type: 'input_image',
                    image_url: 'https://example.com/image.png',
                  },
                ],
              },
            ],
          },
          undefined,
          undefined,
          'createModelResponse',
        ),
      ).rejects.toThrow(
        'No load balance targets support the requested multimodal input',
      );
    });

    it('two equal-weight targets (50/50) - selects second when random=0.6', async () => {
      const targets = [
        { provider: 'openai', weight: 1 },
        { provider: 'anthropic', weight: 1 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.6);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.anthropic.com/v1/messages',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, { messages: [], model: 'test' });
      expect(result.provider).toBe('anthropic');
    });

    it('target without weight property defaults to weight=1', async () => {
      const targets = [{ provider: 'openai' }, { provider: 'anthropic' }];
      vi.spyOn(Math, 'random').mockReturnValue(0.4);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.openai.com/v1/chat/completions',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, { messages: [], model: 'test' });
      expect(result.provider).toBe('openai');
    });

    it('70/30 weight distribution - selects first when random=0.5 (<0.7)', async () => {
      const targets = [
        { provider: 'openai', weight: 0.7 },
        { provider: 'anthropic', weight: 0.3 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.openai.com/v1/chat/completions',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, { messages: [], model: 'test' });
      expect(result.provider).toBe('openai');
    });

    it('70/30 weight distribution - selects second when random=0.8 (>0.7)', async () => {
      const targets = [
        { provider: 'openai', weight: 0.7 },
        { provider: 'anthropic', weight: 0.3 },
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.8);

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: {},
        headers: {},
        url: 'https://api.anthropic.com/v1/messages',
      });
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: { status: 200, data: {} },
      });

      const result = await strategy.execute(targets, { messages: [], model: 'test' });
      expect(result.provider).toBe('anthropic');
    });
  });

  describe('tryTarget()', () => {
    it('should return success=true when retryRequest succeeds', async () => {
      const target = { provider: 'openai', weight: 1 };
      const params = { messages: [], model: 'test' };

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: { model: 'test', messages: [] },
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        url: 'https://api.openai.com/v1/chat/completions',
      });

      const mockResponse = { status: 200, data: { id: 'test-123' } };
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        response: mockResponse,
      });

      const result = await strategy.execute([target], params);

      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockResponse);
      expect(result.provider).toBe('openai');
      expect(result.error).toBeUndefined();
    });

    it('should return success=false when retryRequest fails', async () => {
      const target = { provider: 'openai', weight: 1 };
      const params = { messages: [], model: 'test' };

      (buildProviderRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        body: { model: 'test', messages: [] },
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        url: 'https://api.openai.com/v1/chat/completions',
      });

      const mockResponse = { status: 429, data: { error: 'Rate limited' } };
      (retryRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        response: mockResponse,
        error: 'HTTP 429',
      });

      const result = await strategy.execute([target], params);

      expect(result.success).toBe(false);
      expect(result.response).toEqual(mockResponse);
      expect(result.provider).toBe('openai');
      expect(result.error).toBe('HTTP 429');
    });
  });
});
