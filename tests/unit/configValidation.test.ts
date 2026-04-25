import { describe, it, expect, vi } from 'vitest';
import type { PrioraiConfig } from '../../src/core/types';

vi.mock('../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn().mockResolvedValue({
    body: {},
    headers: {},
    url: 'https://api.openai.com/v1/chat/completions',
  }),
  transformProviderResponse: vi.fn().mockReturnValue({}),
}));

import { Priorai } from '../../src/core/Router';

describe('Config Validation', () => {
  describe('targets 验证', () => {
    it('targets 为空数组时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [],
      })).toThrow('At least one target is required');
    });

    it('targets 未定义时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: undefined as unknown as Array<Record<string, unknown>>,
      })).toThrow('At least one target is required');
    });

    it('target 缺少 provider 字段时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [{ apiKey: 'test' }],
      })).toThrow('must have a "provider" field');
    });

    it('多个 target 中有一个缺少 provider 时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [
          { provider: 'openai', apiKey: 'key1' },
          { apiKey: 'key2' },
        ],
      })).toThrow('must have a "provider" field');
    });

    it('合法 targets 不抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'fallback',
        targets: [{ provider: 'openai', apiKey: 'key1' }],
      })).not.toThrow();
    });
  });

  describe('timeout 验证', () => {
    it('timeout 为负数时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        timeout: -1000,
      })).toThrow('timeout must be a positive number (milliseconds)');
    });

    it('timeout 为 0 时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        timeout: 0,
      })).toThrow('timeout must be a positive number (milliseconds)');
    });

    it('timeout 为字符串时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        timeout: '5000' as unknown as number,
      })).toThrow('timeout must be a positive number (milliseconds)');
    });

    it('timeout 为正数时不抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        timeout: 5000,
      })).not.toThrow();
    });

    it('timeout 未设置时不抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
      })).not.toThrow();
    });
  });

  describe('retry 验证', () => {
    it('retry.attempts 为 0 时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        retry: { attempts: 0, onStatusCodes: [429] },
      })).toThrow('retry.attempts must be a positive integer');
    });

    it('retry.attempts 为负数时抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        retry: { attempts: -1, onStatusCodes: [429] },
      })).toThrow('retry.attempts must be a positive integer');
    });

    it('合法 retry 不抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'single',
        targets: [{ provider: 'openai' }],
        retry: { attempts: 3, onStatusCodes: [429, 500] },
      })).not.toThrow();
    });
  });

  describe('strategy 验证', () => {
    it('未知 strategy 抛出错误', () => {
      expect(() => new Priorai({
        strategy: 'roundrobin' as PrioraiConfig['strategy'],
        targets: [{ provider: 'openai' }],
      })).toThrow('Unknown strategy mode: roundrobin');
    });
  });
});
