import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TargetConfig } from '../../src/core/types';
import type { InheritedConfig } from '../../src/core/tryTarget';
import {
  isNestedTarget,
  buildInheritedConfig,
  tryLeafTargetStream,
  createStreamForProvider,
} from '../../src/core/tryTarget';

vi.mock('../../src/core/providerRequest', () => ({
  buildProviderRequest: vi.fn().mockResolvedValue({
    body: { model: 'gpt-4', messages: [] },
    headers: { 'content-type': 'application/json' },
    url: 'https://api.openai.com/v1/chat/completions',
  }),
}));

vi.mock('../../src/core/RetryHandler', () => ({
  retryRequestForStream: vi.fn(),
}));

vi.mock('../../src/core/transformAnthropicStream', () => ({
  createAnthropicStream: vi.fn().mockReturnValue(new ReadableStream()),
  isAnthropicProvider: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/core/transformGoogleStream', () => ({
  createGoogleStream: vi.fn().mockReturnValue(new ReadableStream()),
  isGoogleProvider: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/core/transformCohereStream', () => ({
  createCohereStream: vi.fn().mockReturnValue(new ReadableStream()),
  isCohereProvider: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/core/transformBedrockStream', () => ({
  createBedrockStream: vi.fn().mockReturnValue(new ReadableStream()),
  isBedrockProvider: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/core/transformBytezStream', () => ({
  createBytezStream: vi.fn().mockReturnValue(new ReadableStream()),
  isBytezProvider: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/core/transformOpenAIStream', () => ({
  createOpenAIStream: vi.fn().mockReturnValue(new ReadableStream()),
  isOpenAICompatibleProvider: vi.fn().mockReturnValue(false),
}));

import { retryRequestForStream } from '../../src/core/RetryHandler';
import { createAnthropicStream, isAnthropicProvider } from '../../src/core/transformAnthropicStream';
import { createGoogleStream, isGoogleProvider } from '../../src/core/transformGoogleStream';
import { createCohereStream, isCohereProvider } from '../../src/core/transformCohereStream';
import { createBedrockStream, isBedrockProvider } from '../../src/core/transformBedrockStream';
import { createBytezStream, isBytezProvider } from '../../src/core/transformBytezStream';
import { createOpenAIStream, isOpenAICompatibleProvider } from '../../src/core/transformOpenAIStream';

describe('tryTarget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isNestedTarget', () => {
    it('returns true for nested target with strategy and targets', () => {
      const target: TargetConfig = {
        strategy: 'fallback',
        targets: [
          { provider: 'openai', api_key: 'key-1' },
          { provider: 'anthropic', api_key: 'key-2' },
        ],
      };
      expect(isNestedTarget(target)).toBe(true);
    });

    it('returns true for loadbalance nested target', () => {
      const target: TargetConfig = {
        strategy: 'loadbalance',
        targets: [
          { provider: 'openai', api_key: 'key-1', weight: 0.7 },
          { provider: 'openai', api_key: 'key-2', weight: 0.3 },
        ],
      };
      expect(isNestedTarget(target)).toBe(true);
    });

    it('returns false for leaf target (provider only)', () => {
      const target: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
      };
      expect(isNestedTarget(target)).toBe(false);
    });

    it('returns false for leaf target with all options', () => {
      const target: TargetConfig = {
        provider: 'anthropic',
        apiKey: 'key-1',
        overrideParams: { model: 'claude-3-5-sonnet' },
        retry: { attempts: 3 },
      };
      expect(isNestedTarget(target)).toBe(false);
    });

    it('returns false if targets is empty array', () => {
      const target = { strategy: 'fallback', targets: [] } as unknown as TargetConfig;
      expect(isNestedTarget(target)).toBe(false);
    });

    it('returns false if strategy is missing even with targets array', () => {
      const target = { targets: [{ provider: 'openai', api_key: 'key' }] } as unknown as TargetConfig;
      expect(isNestedTarget(target)).toBe(false);
    });
  });

  describe('buildInheritedConfig', () => {
    it('merges overrideParams with child overriding parent', () => {
      const parent: InheritedConfig = {
        overrideParams: { model: 'gpt-4', temperature: 0.7 },
      };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
        overrideParams: { temperature: 0.9 },
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.overrideParams).toEqual({ model: 'gpt-4', temperature: 0.9 });
    });

    it('child retry takes priority over parent retry', () => {
      const parent: InheritedConfig = {
        retry: { attempts: 3, onStatusCodes: [429, 500] },
      };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
        retry: { attempts: 1 },
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.retry).toEqual({ attempts: 1 });
    });

    it('uses parent retry when child has no retry', () => {
      const parent: InheritedConfig = {
        retry: { attempts: 3, onStatusCodes: [429] },
      };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.retry).toEqual({ attempts: 3, onStatusCodes: [429] });
    });

    it('child timeout takes priority over parent timeout', () => {
      const parent: InheritedConfig = { timeout: 30000 };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
        timeout: 5000,
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.timeout).toBe(5000);
    });

    it('uses parent timeout when child has no timeout', () => {
      const parent: InheritedConfig = { timeout: 30000 };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.timeout).toBe(30000);
    });

    it('inherits endpoint from parent config', () => {
      const parent: InheritedConfig = {
        endpoint: 'embed',
        overrideParams: { model: 'text-embedding-3' },
      };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.endpoint).toBe('embed');
    });

    it('child cannot override endpoint', () => {
      const parent: InheritedConfig = { endpoint: 'chatComplete' };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'key-1',
        // @ts-expect-error - intentionally testing that child endpoint is ignored
        endpoint: 'embed',
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.endpoint).toBe('chatComplete');
    });

    it('child apiKey overrides parent apiKey (via overrideParams)', () => {
      const parent: InheritedConfig = {
        overrideParams: { apiKey: 'parent-key' },
      };
      const child: TargetConfig = {
        provider: 'openai',
        api_key: 'child-key',
        overrideParams: { apiKey: 'child-key' },
      };
      const result = buildInheritedConfig(child, parent);
      expect(result.overrideParams).toEqual({ apiKey: 'child-key' });
    });
  });

  describe('createStreamForProvider', () => {
    it('routes to createAnthropicStream for anthropic provider', () => {
      isAnthropicProvider.mockReturnValue(true);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'anthropic');
      expect(createAnthropicStream).toHaveBeenCalledWith(mockResponse, 'anthropic');
    });

    it('routes to createGoogleStream for google provider', () => {
      isGoogleProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'google');
      expect(createGoogleStream).toHaveBeenCalledWith(mockResponse, 'google');
    });

    it('routes to createGoogleStream for vertex-ai provider', () => {
      isGoogleProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'vertex-ai');
      expect(createGoogleStream).toHaveBeenCalledWith(mockResponse, 'vertex-ai');
    });

    it('routes to createCohereStream for cohere provider', () => {
      isCohereProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      isGoogleProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'cohere');
      expect(createCohereStream).toHaveBeenCalledWith(mockResponse, 'cohere');
    });

    it('routes to createBedrockStream for bedrock provider', () => {
      isBedrockProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      isGoogleProvider.mockReturnValue(false);
      isCohereProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'bedrock');
      expect(createBedrockStream).toHaveBeenCalledWith(mockResponse, 'bedrock');
    });

    it('routes to createBytezStream for bytez provider', () => {
      isBytezProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      isGoogleProvider.mockReturnValue(false);
      isCohereProvider.mockReturnValue(false);
      isBedrockProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'bytez');
      expect(createBytezStream).toHaveBeenCalledWith(mockResponse, 'bytez');
    });

    it('routes to createOpenAIStream for openai provider', () => {
      isOpenAICompatibleProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      isGoogleProvider.mockReturnValue(false);
      isCohereProvider.mockReturnValue(false);
      isBedrockProvider.mockReturnValue(false);
      isBytezProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'openai');
      expect(createOpenAIStream).toHaveBeenCalledWith(mockResponse, 'openai');
    });

    it('falls back to createOpenAIStream for unknown provider', () => {
      isOpenAICompatibleProvider.mockReturnValue(true);
      isAnthropicProvider.mockReturnValue(false);
      isGoogleProvider.mockReturnValue(false);
      isCohereProvider.mockReturnValue(false);
      isBedrockProvider.mockReturnValue(false);
      isBytezProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'some-unknown-provider');
      expect(createOpenAIStream).toHaveBeenCalledWith(mockResponse, 'some-unknown-provider');
    });

    it('priority: anthropic before google (correct order)', () => {
      isAnthropicProvider.mockReturnValue(true);
      isGoogleProvider.mockReturnValue(true);
      isCohereProvider.mockReturnValue(false);
      isBedrockProvider.mockReturnValue(false);
      isBytezProvider.mockReturnValue(false);
      isOpenAICompatibleProvider.mockReturnValue(false);
      const mockResponse = { ok: true } as unknown as Response;
      createStreamForProvider(mockResponse, 'anthropic');
      expect(createAnthropicStream).toHaveBeenCalled();
      expect(createGoogleStream).not.toHaveBeenCalled();
    });
  });
});