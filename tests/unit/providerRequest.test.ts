import { describe, expect, it } from 'vitest';
import { buildProviderRequest, transformUsingProviderConfig } from '../../src/core/providerRequest';
import Providers from '../../src/providers';

describe('Provider Registry', () => {
  it('should have all expected providers registered', () => {
    const expectedProviders = [
      'openai',
      'anthropic',
      'cohere',
      'azure-openai',
      'azure-ai',
      'github',
      'vertex-ai',
      'together-ai',
      'perplexity-ai',
      'mistral-ai',
      'groq',
      'deepseek',
      'openrouter',
      'bedrock',
      'nomic',
      'jina',
      'voyage',
    ];
    for (const p of expectedProviders) {
      expect(Providers[p], `Provider ${p} should be registered`).toBeDefined();
    }
  });

  it('should have api config for each provider', () => {
    for (const [name, config] of Object.entries(Providers)) {
      expect(config.api, `Provider ${name} should have api config`).toBeDefined();
    }
  });

  it('should have chatComplete config for chat providers', () => {
    const chatProviders = [
      'openai',
      'anthropic',
      'cohere',
      'groq',
      'deepseek',
      'together-ai',
      'mistral-ai',
      'openrouter',
    ];
    for (const p of chatProviders) {
      const config = Providers[p];
      const hasChatComplete = config.chatComplete || config.getConfig;
      expect(hasChatComplete, `Provider ${p} should have chatComplete or getConfig`).toBeTruthy();
    }
  });
});

describe('transformUsingProviderConfig', () => {
  it('should map params using provider config', () => {
    const config = {
      model: { param: 'model', required: true, default: 'gpt-3.5-turbo' },
      messages: { param: 'messages' },
      temperature: { param: 'temperature', min: 0, max: 2 },
    };

    const result = transformUsingProviderConfig(
      config,
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], temperature: 0.7 },
      { provider: 'openai' },
    );

    expect(result.model).toBe('gpt-4o');
    expect(result.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(result.temperature).toBe(0.7);
  });

  it('should apply min/max constraints', () => {
    const config = {
      temperature: { param: 'temperature', min: 0, max: 2 },
    };

    const result = transformUsingProviderConfig(config, { temperature: 5 } as any, {
      provider: 'openai',
    });

    expect(result.temperature).toBe(2);
  });

  it('should use default for required missing params', () => {
    const config = {
      model: { param: 'model', required: true, default: 'gpt-3.5-turbo' },
    };

    const result = transformUsingProviderConfig(config, {} as any, { provider: 'openai' });

    expect(result.model).toBe('gpt-3.5-turbo');
  });

  it('should handle nested param paths', () => {
    const config = {
      temperature: { param: 'config.temperature' },
    };

    const result = transformUsingProviderConfig(config, { temperature: 0.5 } as any, {
      provider: 'test',
    });

    expect(result.config.temperature).toBe(0.5);
  });
});

describe('buildProviderRequest', () => {
  it('should build OpenAI request correctly', async () => {
    const result = await buildProviderRequest(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      },
      'openai',
      { provider: 'openai', apiKey: 'sk-test-key' },
    );

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(result!.headers['Authorization']).toBe('Bearer sk-test-key');
    expect(result!.body.model).toBe('gpt-4o');
    expect(result!.body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(result!.body.temperature).toBe(0.7);
  });

  it('should build Groq request correctly', async () => {
    const result = await buildProviderRequest(
      {
        model: 'llama-3.1-70b-versatile',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      'groq',
      { provider: 'groq', apiKey: 'gsk-test-key' },
    );

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(result!.headers['Authorization']).toBe('Bearer gsk-test-key');
    expect(result!.body.model).toBe('llama-3.1-70b-versatile');
  });

  it('should build Together AI request correctly', async () => {
    const result = await buildProviderRequest(
      {
        model: 'meta-llama/Llama-3-70b-chat-hf',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      'together-ai',
      { provider: 'together-ai', apiKey: 'tog-test-key' },
    );

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://api.together.xyz/v1/chat/completions');
    expect(result!.headers['Authorization']).toBe('Bearer tog-test-key');
  });

  it('should build DeepSeek request correctly', async () => {
    const result = await buildProviderRequest(
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      'deepseek',
      { provider: 'deepseek', apiKey: 'ds-test-key' },
    );

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(result!.headers['Authorization']).toBe('Bearer ds-test-key');
  });

  it('should throw for unknown provider', async () => {
    await expect(
      buildProviderRequest({ model: 'test', messages: [] }, 'nonexistent-provider', {
        provider: 'nonexistent',
      }),
    ).rejects.toThrow('Provider "nonexistent-provider" not found in registry');
  });

  it('should build Mistral AI request correctly', async () => {
    const result = await buildProviderRequest(
      {
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      'mistral-ai',
      { provider: 'mistral-ai', apiKey: 'mist-test-key' },
    );

    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(result!.headers['Authorization']).toBe('Bearer mist-test-key');
  });

  it('should include tools in request body when provided', async () => {
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];

    const result = await buildProviderRequest(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools,
      },
      'openai',
      { provider: 'openai', apiKey: 'sk-test' },
    );

    expect(result).not.toBeNull();
    expect(result!.body.tools).toEqual(tools);
  });
});
