import { describe, expect, it, vi } from 'vitest';
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
  describe('targets validation', () => {
    it('throws error when targets is empty array', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [],
          }),
      ).toThrow('At least one target is required');
    });

    it('throws error when targets is undefined', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: undefined as unknown as Array<Record<string, unknown>>,
          }),
      ).toThrow('At least one target is required');
    });

    it('throws error when target is missing provider field', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [{ apiKey: 'test' }],
          }),
      ).toThrow('must have a "provider" field');
    });

    it('throws error when one of multiple targets is missing provider', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [{ provider: 'openai', apiKey: 'key1' }, { apiKey: 'key2' }],
          }),
      ).toThrow('must have a "provider" field');
    });

    it('valid targets do not throw error', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'fallback',
            targets: [{ provider: 'openai', apiKey: 'key1' }],
          }),
      ).not.toThrow();
    });
  });

  describe('timeout validation', () => {
    it('throws error when timeout is negative', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            timeout: -1000,
          }),
      ).toThrow('timeout must be a positive number (milliseconds)');
    });

    it('throws error when timeout is 0', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            timeout: 0,
          }),
      ).toThrow('timeout must be a positive number (milliseconds)');
    });

    it('throws error when timeout is a string', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            timeout: '5000' as unknown as number,
          }),
      ).toThrow('timeout must be a positive number (milliseconds)');
    });

    it('timeout as positive number does not throw', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            timeout: 5000,
          }),
      ).not.toThrow();
    });

    it('timeout not set does not throw', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
          }),
      ).not.toThrow();
    });
  });

  describe('retry validation', () => {
    it('retry.attempts being 0 throws error', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            retry: { attempts: 0, onStatusCodes: [429] },
          }),
      ).toThrow('retry.attempts must be a positive integer');
    });

    it('retry.attempts being negative throws error', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            retry: { attempts: -1, onStatusCodes: [429] },
          }),
      ).toThrow('retry.attempts must be a positive integer');
    });

    it('valid retry does not throw', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'single',
            targets: [{ provider: 'openai' }],
            retry: { attempts: 3, onStatusCodes: [429, 500] },
          }),
      ).not.toThrow();
    });
  });

  describe('strategy validation', () => {
    it('unknown strategy throws error', () => {
      expect(
        () =>
          new Priorai({
            strategy: 'roundrobin' as PrioraiConfig['strategy'],
            targets: [{ provider: 'openai' }],
          }),
      ).toThrow('Unknown strategy mode: roundrobin');
    });
  });
});
