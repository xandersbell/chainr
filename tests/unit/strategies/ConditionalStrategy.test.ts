/**
 * Conditional routing 条件路由测试
 * 验证 MongoDB 风格查询运算符和条件匹配逻辑
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConditionalStrategy } from '../../../src/core/strategies/ConditionalStrategy';
import type { ConditionConfig } from '../../../src/core/strategies/ConditionalStrategy';
import type { TargetConfig } from '../../../src/core/types';
import type { Params } from '../../../src/types/requestBody';

// mock tryTarget 模块，避免实际发起 HTTP 请求
vi.mock('../../../src/core/tryTarget', () => ({
  executeTarget: vi.fn().mockResolvedValue({
    success: true,
    response: { status: 200, data: { id: 'test' } },
    provider: 'openai',
  }),
  executeTargetStream: vi.fn().mockResolvedValue(
    new ReadableStream()
  ),
  buildInheritedConfig: vi.fn((target: any, parent: any) => parent),
  isNestedTarget: vi.fn(() => false),
  tryLeafTarget: vi.fn(),
  tryLeafTargetStream: vi.fn(),
}));

const { executeTarget } = await import('../../../src/core/tryTarget');

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

  describe('基本条件匹配', () => {
    it('$eq — 精确匹配 model 字段', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $eq: 'gpt-4o' } }, then: 'openai-target' },
        { query: { 'params.model': { $eq: 'claude-sonnet-4-20250514' } }, then: 'anthropic-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);

      expect(executeTarget).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object)
      );
    });

    it('直接值匹配（无运算符）', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'deepseek-chat' }, then: 'deepseek-target' },
        { query: { 'params.model': 'gpt-4o' }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);

      // 第一个条件不匹配，第二个匹配
      expect(executeTarget).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object)
      );
    });

    it('$ne — 不等于', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $ne: 'gpt-4o' } }, then: 'anthropic-target' },
        { query: { 'params.model': { $ne: 'claude-sonnet-4-20250514' } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);

      // 第一个条件 model !== 'gpt-4o' 为 false，跳过
      // 第二个条件 model !== 'claude-sonnet-4-20250514' 为 true
      expect(executeTarget).toHaveBeenCalledWith(
        targets[0], // openai-target
        baseParams,
        expect.any(Object)
      );
    });
  });

  describe('数值比较运算符', () => {
    const paramsWithTemp: Params = {
      ...baseParams,
      temperature: 0.8,
    };

    it('$gt — 大于', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.temperature': { $gt: 0.5 } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, paramsWithTemp, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], paramsWithTemp, expect.any(Object));
    });

    it('$lte — 小于等于', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.temperature': { $lte: 0.5 } }, then: 'anthropic-target' },
        { query: { 'params.temperature': { $lte: 0.8 } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, paramsWithTemp, undefined, undefined, undefined, conditions);
      // 0.8 <= 0.5 false, 0.8 <= 0.8 true
      expect(executeTarget).toHaveBeenCalledWith(targets[0], paramsWithTemp, expect.any(Object));
    });
  });

  describe('集合运算符', () => {
    it('$in — 值在数组中', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $in: ['gpt-4o', 'gpt-4o-mini'] } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });

    it('$nin — 值不在数组中', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $nin: ['gpt-4o', 'gpt-4o-mini'] } }, then: 'anthropic-target' },
        { query: { 'params.model': { $nin: ['claude-sonnet-4-20250514'] } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      // gpt-4o 在 $nin 列表中 → false，第二个条件匹配
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });
  });

  describe('正则运算符', () => {
    it('$regex — 正则匹配', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $regex: '^gpt-' } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });

    it('$regex — 不匹配时跳过', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': { $regex: '^claude-' } }, then: 'anthropic-target' },
        { query: { 'params.model': { $regex: '^gpt-' } }, then: 'openai-target' },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });
  });

  describe('逻辑运算符', () => {
    it('$and — 所有条件都满足', async () => {
      const paramsWithTemp: Params = { ...baseParams, temperature: 0.8 };
      const conditions: ConditionConfig[] = [
        {
          query: {
            $and: [
              { 'params.model': { $regex: '^gpt-' } },
              { 'params.temperature': { $gt: 0.5 } },
            ],
          },
          then: 'openai-target',
        },
      ];

      await strategy.execute(targets, paramsWithTemp, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], paramsWithTemp, expect.any(Object));
    });

    it('$or — 任一条件满足', async () => {
      const conditions: ConditionConfig[] = [
        {
          query: {
            $or: [
              { 'params.model': 'claude-sonnet-4-20250514' },
              { 'params.model': 'gpt-4o' },
            ],
          },
          then: 'openai-target',
        },
      ];

      await strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions);
      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });
  });

  describe('metadata 上下文', () => {
    it('根据 metadata 字段路由', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'metadata.region': 'us-east' }, then: 'openai-target' },
        { query: { 'metadata.region': 'eu-west' }, then: 'anthropic-target' },
      ];

      await strategy.execute(
        targets, baseParams, undefined, undefined, undefined,
        conditions, undefined, { region: 'eu-west' }
      );

      expect(executeTarget).toHaveBeenCalledWith(targets[1], baseParams, expect.any(Object));
    });
  });

  describe('default target', () => {
    it('所有条件不匹配时走 default', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'nonexistent-model' }, then: 'anthropic-target' },
      ];

      await strategy.execute(
        targets, baseParams, undefined, undefined, undefined,
        conditions, 'openai-target'
      );

      expect(executeTarget).toHaveBeenCalledWith(targets[0], baseParams, expect.any(Object));
    });

    it('无 default 且无匹配时抛出错误', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'nonexistent-model' }, then: 'anthropic-target' },
      ];

      await expect(
        strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions)
      ).rejects.toThrow('Conditional routing did not resolve to any valid target');
    });
  });

  describe('错误处理', () => {
    it('无 conditions 时抛出错误', async () => {
      await expect(
        strategy.execute(targets, baseParams)
      ).rejects.toThrow('No conditions provided for conditional routing');
    });

    it('target name 不存在时抛出错误', async () => {
      const conditions: ConditionConfig[] = [
        { query: { 'params.model': 'gpt-4o' }, then: 'nonexistent-target' },
      ];

      await expect(
        strategy.execute(targets, baseParams, undefined, undefined, undefined, conditions)
      ).rejects.toThrow('Invalid target name in conditional routing: nonexistent-target');
    });
  });
});
