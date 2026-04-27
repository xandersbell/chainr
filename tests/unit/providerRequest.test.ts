import { describe, expect, it } from 'vitest';
import {
  buildProviderRequest,
  transformProviderResponse,
  transformUsingProviderConfig,
} from '../../src/core/providerRequest';
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

  it('should map Google input_file video URL to Gemini fileData', async () => {
    const result = await buildProviderRequest(
      {
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
              { type: 'text', text: 'Summarize this video.' },
            ],
          },
        ],
      },
      'google',
      { provider: 'google', apiKey: 'gemini-test-key' },
    );

    expect(result.body.contents[0].parts).toEqual([
      {
        fileData: {
          fileUri: 'https://example.com/test.mp4',
          mimeType: 'video/mp4',
        },
      },
      { text: 'Summarize this video.' },
    ]);
  });

  it('should infer Google fileData MIME type from URL pathname when query string is present', async () => {
    const result = await buildProviderRequest(
      {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: 'https://example.com/assets/image.png?token=abc',
                },
              },
            ],
          },
        ],
      },
      'google',
      { provider: 'google', apiKey: 'gemini-test-key' },
    );

    expect(result.body.contents[0].parts).toEqual([
      {
        fileData: {
          fileUri: 'https://example.com/assets/image.png?token=abc',
          mimeType: 'image/png',
        },
      },
    ]);
  });

  it('should reject Bedrock HTTPS file URLs in the provider transform', async () => {
    await expect(
      buildProviderRequest(
        {
          model: 'anthropic.claude-3-5-sonnet',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_file',
                  file: {
                    url: 'https://example.com/test.pdf',
                    mime_type: 'application/pdf',
                  },
                },
              ],
            },
          ],
        },
        'bedrock',
        { provider: 'bedrock', apiKey: 'test-key' },
      ),
    ).rejects.toThrow('Bedrock file inputs require base64 data or an s3:// URL.');
  });

  it('should map Google input_file audio data to Gemini inlineData', async () => {
    const result = await buildProviderRequest(
      {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file: {
                  data: 'AAAA',
                  mime_type: 'audio/mpeg',
                },
              },
            ],
          },
        ],
      },
      'google',
      { provider: 'google', apiKey: 'gemini-test-key' },
    );

    expect(result.body.contents[0].parts).toEqual([
      {
        inlineData: {
          data: 'AAAA',
          mimeType: 'audio/mpeg',
        },
      },
    ]);
  });

  it('should normalize OpenAI input_file image URL to image_url content', async () => {
    const result = await buildProviderRequest(
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                file: {
                  url: 'https://example.com/image.png',
                  mime_type: 'image/png',
                },
              },
            ],
          },
        ],
      },
      'openai',
      { provider: 'openai', apiKey: 'sk-test-key' },
    );

    expect(result.body.messages[0].content).toEqual([
      {
        type: 'image_url',
        image_url: {
          url: 'https://example.com/image.png',
          mime_type: 'image/png',
        },
      },
    ]);
  });

  it('should normalize OpenRouter input_file video URL to input_video content', async () => {
    const result = await buildProviderRequest(
      {
        model: 'google/gemini-2.5-pro',
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
      'openrouter',
      { provider: 'openrouter', apiKey: 'or-test-key' },
    );

    expect(result.body.messages[0].content).toEqual([
      {
        type: 'input_video',
        video_url: 'https://example.com/test.mp4',
        mime_type: 'video/mp4',
      },
    ]);
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

describe('transformProviderResponse', () => {
  // --- Case 1: bare response body passthrough (branch 1 — no `data` key) ---
  it('bare response body passthrough', () => {
    const json = { id: 'chatcmpl-1', choices: [] };
    const result = transformProviderResponse(json, 'openai', 'chatComplete', 200, {}, undefined);
    // openai/chatComplete has a real transformFn, but since the json has no `data` key,
    // the transformFn is still called — we only verify passthrough when endpoint has no transformFn
    expect(result).toEqual({ id: 'chatcmpl-1', choices: [] });
  });

  // --- Case 2: { status, data } unwrap (branch 1 — has `data` key) ---
  it('{ status, data } unwrap', () => {
    const json = { status: 200, data: { id: 'chatcmpl-1', choices: [] } };
    const result = transformProviderResponse(json, 'openai', 'chatComplete', 200, {}, undefined);
    // The outer wrapper is stripped; what remains is passed to the transformFn
    expect(result).toEqual({ id: 'chatcmpl-1', choices: [] });
  });

  // --- Case 3: unknown provider passthrough (branch 2) ---
  it('unknown provider passthrough', () => {
    const json = { id: 'x', choices: [] };
    const result = transformProviderResponse(
      json,
      'unknown-provider',
      'chatComplete',
      200,
      {},
      undefined,
    );
    // No provider config found → passthrough immediately
    expect(result).toEqual({ id: 'x', choices: [] });
  });

  // --- Case 4: Vertex AI with requestModel routing (branch 3 — requestModel takes priority) ---
  it('Vertex AI with requestModel routing', () => {
    // requestModel 'gemini-2.5-pro' routes to google provider sub-config
    const json = { model: 'gemini-2.5-pro', choices: [] };
    const result = transformProviderResponse(
      json,
      'vertex-ai',
      'chatComplete',
      200,
      {},
      'gemini-2.5-pro',
    );
    // Vertex AI getConfig returns a google sub-config whose chatComplete transform adds a `provider` field
    // We verify the function returned something different from raw responseBody
    expect(result).toHaveProperty('provider');
  });

  // --- Case 5: Vertex AI with responseBody.model routing (branch 3 — fallback when no requestModel) ---
  it('Vertex AI with responseBody.model routing', () => {
    // No requestModel; getConfig reads model from responseBody
    const json = { model: 'gemini-2.0-flash', choices: [] };
    const result = transformProviderResponse(json, 'vertex-ai', 'chatComplete', 200, {}, undefined);
    // Routes via responseBody.model → google sub-config
    expect(result).toHaveProperty('provider');
  });

  // --- Case 6: endpoint without transformFn (branch 5) ---
  it('endpoint without transformFn passthrough', () => {
    // 'embed' endpoint exists for openai but has no responseTransforms entry
    const json = { id: 'emb-1', object: 'embedding', embedding: [0.1, 0.2] };
    const result = transformProviderResponse(json, 'openai', 'embed', 200, {}, undefined);
    // No transformFn for 'embed' → passthrough
    expect(result).toEqual({ id: 'emb-1', object: 'embedding', embedding: [0.1, 0.2] });
  });

  // --- Case 7: normal transform (branch 6) ---
  it('normal transform calls transformFn', () => {
    const json = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    const result = transformProviderResponse(json, 'openai', 'chatComplete', 200, {}, undefined);
    // OpenAI's chatComplete transformFn is called; it returns the response as-is for status 200
    expect(result).toEqual(json);
  });

  // --- Case 8: status != 200 still calls transformFn (branch 6 — status is passed through) ---
  it('status != 200 still calls transformFn', () => {
    const json = {
      id: 'chatcmpl-500',
      object: 'chat.completion',
      created: 1234567890,
      model: 'gpt-4o',
      error: { message: 'Internal server error', type: 'server_error', code: 'internal_error' },
    };
    const result = transformProviderResponse(json, 'openai', 'chatComplete', 500, {}, undefined);
    // OpenAI's transformFn still runs for non-200; it adds provider field and returns transformed
    expect(result).toHaveProperty('provider');
  });
});
