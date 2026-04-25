/**
 * Conditional routing strategy tests
 * Verify MongoDB-style query operators and condition matching logic
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConditionConfig } from '../../../src/core/strategies/ConditionalStrategy';
import { ConditionalStrategy } from '../../../src/core/strategies/ConditionalStrategy';
import type { TargetConfig } from '../../../src/core/types';
import type { Params } from '../../../src/types/requestBody';

// Mock tryTarget module to avoid actual HTTP requests
vi.mock('../../../src/core/tryTarget', () => ({
  executeTarget: vi.fn().mockResolvedValue({
    success: true,
    response: { status: 200, data: { id: 'test' } },
    provider: 'openai',
  }),
  executeTargetStream: vi.fn().mockResolvedValue(new ReadableStream()),
  buildInheritedConfig: vi.fn((_target: any, parent: any) => parent),
  isNestedTarget: vi.fn(() => false),
  tryLeafTarget: vi.fn(),
  tryLeafTargetStream: vi.fn(),
}));

const { executeTarget, executeTargetStream } = await import('../../../src/core/tryTarget');

describe('ConditionalStrategy', () => {
  let strategy: ConditionalStrategy;

  const targets: TargetConfig[] = [
    { name: 'openai-target', provider: 'openai', apiKey: 'key-1' },
    { name: 'anthropic-target', provider: 'anthropic', apiKey: 'key-2' },
    { name: 'deepseek-target', provider: 'deepseek', apiKey: 'key-3' },
  ];

  const baseParams: Params = {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hello' }],
  };

  beforeEach(() => {
    strategy = new ConditionalStrategy();
    vi.clearAllMocks();
  });

  describe('basic condition matching', () => {
    it('$eq — exact match on model field', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $eq: 'gpt-4o' } }, then: 'openai-target' },
        {
          query: { 'params.model': { $eq: 'claude-sonnet-4-20250514' } },
          then: 'anthropic-target',
        },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);

      expect(executeTarget).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object),
      );
    });

    it('direct value matching (no operator)', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'deepseek-chat' }, then: 'deepseek-target' },
        { query: { 'params.model': 'gpt-4o' }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);

      // First condition does not match, second matches
      expect(executeTarget).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object),
      );
    });

    it('$ne — not equal', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $ne: 'gpt-4o' } }, then: 'anthropic-target' },
        { query: { 'params.model': { $ne: 'claude-sonnet-4-20250514' } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);

      // First condition model !== 'gpt-4o' is false, skip
      // Second condition model !== 'claude-sonnet-4-20250514' is true
      expect(executeTarget).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object),
      );
    });
  });

  describe('numeric comparison operators', () => {
    const paramsWithTemp: Params = {
      ...baseParams,
      temperature: 0.8,
    };

    it('$gt — greater than', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.temperature': { $gt: 0.5 } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, paramsWithTemp, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], paramsWithTemp, expect.any(Object));
    });

    it('$lte — less than or equal', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.temperature': { $lte: 0.5 } }, then: 'anthropic-target' },
        { query: { 'params.temperature': { $lte: 0.8 } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, paramsWithTemp, undefined, undefined, undefined, conditions);
      // 0.8 <= 0.5 false, 0.8 <= 0.8 true
      expect(executeTarget).toHaveBeenCalledWith(targets[0], paramsWithTemp, expect.any(Object));
    });
  });

  describe('set operators', () => {
    it('$in — value in array', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $in: ['gpt-4o', 'gpt-4o-mini'] } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });

    it('$nin — value not in array', async () => {
      const conditions: ConditionConfig[] = [
        {
          query: { 'params.model': { $nin: ['gpt-4o', 'gpt-4o-mini'] } },
          then: 'anthropic-target',
        },
        {
          query: { 'params.model': { $nin: ['claude-sonnet-4-20250514'] } },
          then: 'openai-target',
        },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      // gpt-4o is in $nin list → false, second condition matches
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });
  });

  describe('regex operators', () => {
    it('$regex — regex match', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $regex: '^gpt-' } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });

    it('$regex — skip when no match', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $regex: '^claude-' } }, then: 'anthropic-target' },
        { query: { 'params.model': { $regex: '^gpt-' } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });
  });

  describe('logical operators', () => {
    it('$and — all conditions satisfied', async () => {
      const paramsWithTemp: Params = { ...baseParams, temperature: 0.8 };
      const conditions: ConditionConfig[] = [
        {
          query: {
            $and: [{ 'params.model': { $regex: '^gpt-' } }, { 'params.temperature': { $gt: 0.5 } }],
          },
          then: 'openai-target',
        },
      ];

      await strategy.execute(targets, paramsWithTemp, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], paramsWithTemp, expect.any(Object));
    });

    it('$or — any condition satisfied', async () => {
      const conditions: ConditionConfig[] = [
        {
          query: {
            $or: [{ 'params.model': 'claude-sonnet-4-20250514' }, { 'params.model': 'gpt-4o' }],
          },
          then: 'openai-target',
        },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });
  });

  describe('metadata context', () => {
    it('routes based on metadata field', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'metadata.region': 'us-east' }, then: 'openai-target' },
        { query: { 'metadata.region': 'eu-west' }, then: 'anthropic-target' },
      ];

      await strategy.execute(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
        undefined,
        { region: 'eu-west' },
      );

      expect(executeTarget).toHaveBeenCalledWith(targets[1], baseParams, expect.any(Object));
    });
  });

  describe('default target', () => {
    it('falls back to default when no conditions match', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'nonexistent-model' }, then: 'anthropic-target' },
      ];

      await strategy.execute(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
        'openai-target',
      );

      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });

    it('throws error when no default and no conditions match', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'nonexistent-model' }, then: 'anthropic-target' },
      ];

      await expect(
        strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions),
      ).rejects.toThrow('Conditional routing did not resolve to any valid target');
    });
  });

  describe('error handling', () => {
    it('throws error when no conditions provided', async () => {
      await expect(strategy.execute(targets, baseParams)).rejects.toThrow(
        'No conditions provided for conditional routing',
      );
    });

    it('throws error when target name does not exist', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'gpt-4o' }, then: 'nonexistent-target' },
      ];

      await expect(
        strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions),
      ).rejects.toThrow('Invalid target name in conditional routing: nonexistent-target');
    });
  });

  describe('streaming', () => {
    it('executeStream calls executeTargetStream and returns a stream', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'gpt-4o' }, then: 'openai-target' },
      ];

      const result = strategy.executeStream(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
      );

      expect(executeTargetStream).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Promise);
    });

    it('executeStream calls executeTargetStream and returns a stream', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'gpt-4o' }, then: 'openai-target' },
      ];

      const result = strategy.executeStream(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
      );

      expect(executeTargetStream).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Promise);
    });

    it('executeStream passes retry and timeout config', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'gpt-4o' }, then: 'openai-target' },
      ];
      const retryConfig = { attempts: 3, onStatusCodes: [429, 500] };
      const timeoutMs = 15000;

      await strategy.executeStream(
        targets,
        baseParams,
        retryConfig,
        timeoutMs,
        undefined,
        conditions,
      );

      expect(executeTargetStream).toHaveBeenCalledWith(
        targets[0],
        baseParams,
        expect.objectContaining({
          retry: retryConfig,
          timeout: timeoutMs,
        }),
      );
    });

    it('executeStream falls back to default target when no conditions match', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'nonexistent-model' }, then: 'anthropic-target' },
      ];

      await strategy.executeStream(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
        'openai-target', // default
      );

      expect(executeTargetStream).toHaveBeenCalledWith(
        targets[0], // openai-target as default
        baseParams,
        expect.any(Object),
      );
    });

    it('executeStream throws when no conditions and no default', async () => {
      await expect(
        strategy.executeStream(targets, baseParams),
      ).rejects.toThrow('No conditions provided for conditional routing');
    });

    it('executeStream with $eq condition resolves to correct target', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $eq: 'gpt-4o' } }, then: 'openai-target' },
      ];

      await strategy.executeStream(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
      );

      expect(executeTargetStream).toHaveBeenCalledWith(
        targets[0],
        baseParams,
        expect.any(Object),
      );
    });

    it('executeStream with numeric $gt condition resolves correctly', async () => {
      const paramsWithTemp: Params = {
        ...baseParams,
        temperature: 0.9,
      };
      const conditions: ConditionConfig[] = [
        { query: { 'params.temperature': { $gt: 0.7 } }, then: 'openai-target' },
      ];

      await strategy.executeStream(
        targets,
        paramsWithTemp,
        undefined,
        undefined,
        undefined,
        conditions,
      );

      expect(executeTargetStream).toHaveBeenCalledWith(
        targets[0],
        paramsWithTemp,
        expect.any(Object),
      );
    });

    it('executeStream with metadata routing', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'metadata.streaming': 'true' }, then: 'openai-target' },
      ];
      const metadata = { streaming: 'true' };

      await strategy.executeStream(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
        undefined,
        metadata,
      );

      expect(executeTargetStream).toHaveBeenCalledWith(
        targets[0],
        baseParams,
        expect.any(Object),
      );
    });

    it('executeStream uses first matching condition', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'gpt-4o' }, then: 'openai-target' },
        { query: { 'params.model': 'deepseek-chat' }, then: 'deepseek-target' },
      ];

      await strategy.executeStream(
        targets,
        baseParams,
        undefined,
        undefined,
        undefined,
        conditions,
      );

      // First matching condition wins
      expect(executeTargetStream).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object),
      );
    });
  });
});
