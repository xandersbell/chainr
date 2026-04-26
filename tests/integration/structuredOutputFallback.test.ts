import { describe, expect, it } from 'vitest';
import {
  buildProviderRequest,
  transformProviderResponse,
} from '../../src/core/providerRequest';

// Shared OpenAI-format params with json_schema response_format
const SIMPLE_SCHEMA = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
  },
  required: ['name', 'age'],
};

const BASE_PARAMS = {
  model: 'gpt-4o',
  messages: [{ role: 'user' as const, content: 'Return a Person JSON' }],
  max_tokens: 256,
  response_format: {
    type: 'json_schema' as const,
    json_schema: {
      name: 'Person',
      schema: SIMPLE_SCHEMA,
    },
  },
};

// Structured JSON content returned by all providers
const STRUCTURED_CONTENT = '{"name":"Alice","age":30}';

// Complex nested schema for Test 4
const COMPLEX_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        zip: { type: 'string' },
        country: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
      required: ['street', 'city'],
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          value: { type: 'number' },
        },
        required: ['subject', 'value'],
      },
    },
    metadata: {
      anyOf: [
        {
          type: 'object',
          properties: {
            source: { type: 'string' },
          },
        },
        { type: 'null' },
      ],
    },
  },
  required: ['id', 'name', 'status', 'tags'],
};

describe('Structured Output — Request Transform Consistency', () => {
  it('OpenAI: response_format passes through as-is', async () => {
    const result = await buildProviderRequest(
      BASE_PARAMS,
      'openai',
      { provider: 'openai', apiKey: 'test-key' },
      'chatComplete',
    );

    expect(result.body.response_format).toEqual(BASE_PARAMS.response_format);
  });

  it('Anthropic: response_format maps to output_config with json_schema format', async () => {
    const result = await buildProviderRequest(
      { ...BASE_PARAMS, model: 'claude-sonnet-4-20250514' },
      'anthropic',
      { provider: 'anthropic', apiKey: 'test-key' },
      'chatComplete',
    );

    // Anthropic output_config.format contains the schema without the name wrapper
    expect(result.body.output_config).toEqual({
      format: {
        type: 'json_schema',
        schema: SIMPLE_SCHEMA,
      },
    });
    // response_format should NOT appear in the Anthropic body
    expect(result.body.response_format).toBeUndefined();
  });

  it('Google AI Studio: response_format maps to generationConfig', async () => {
    const result = await buildProviderRequest(
      { ...BASE_PARAMS, model: 'gemini-2.0-flash' },
      'google',
      { provider: 'google', apiKey: 'test-key' },
      'chatComplete',
    );

    expect(result.body.generationConfig).toBeDefined();
    expect(result.body.generationConfig.responseMimeType).toBe('application/json');
    expect(result.body.generationConfig.responseJsonSchema).toEqual(SIMPLE_SCHEMA);
    // response_format should NOT appear in the Google body
    expect(result.body.response_format).toBeUndefined();
  });

  // Vertex AI request transform is skipped because headers() attempts
  // Google auth token retrieval which requires real credentials.
  // The response transform (which shares the same generationConfig logic)
  // is tested in the response transform suite below.
});

describe('Structured Output — Response Transform Consistency', () => {
  it('OpenAI: response passes through with correct fields', () => {
    const openaiResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [
        {
          message: { role: 'assistant', content: STRUCTURED_CONTENT },
          finish_reason: 'stop',
          index: 0,
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };

    const result = transformProviderResponse(
      openaiResponse,
      'openai',
      'chatComplete',
      200,
    ) as any;

    expect(result.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    expect(result.choices[0].finish_reason).toBe('stop');
    expect(result.choices[0].message.role).toBe('assistant');
  });

  it('Anthropic: response normalizes to OpenAI format', () => {
    const anthropicResponse = {
      status: 200,
      data: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: STRUCTURED_CONTENT }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const result = transformProviderResponse(
      anthropicResponse,
      'anthropic',
      'chatComplete',
      200,
    ) as any;

    expect(result.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    // strictOpenAiCompliance is false, so raw stop_reason is returned
    expect(result.choices[0].finish_reason).toBe('end_turn');
    expect(result.choices[0].message.role).toBe('assistant');
  });

  it('Google AI Studio: response normalizes to OpenAI format', () => {
    const googleResponse = {
      status: 200,
      data: {
        modelVersion: 'gemini-2.0-flash',
        candidates: [
          {
            content: {
              parts: [{ text: STRUCTURED_CONTENT }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      },
    };

    const result = transformProviderResponse(
      googleResponse,
      'google',
      'chatComplete',
      200,
    ) as any;

    expect(result.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    // strictOpenAiCompliance is false, so raw finishReason is returned
    expect(result.choices[0].finish_reason).toBe('STOP');
    expect(result.choices[0].message.role).toBe('assistant');
  });

  // Provider registry key for Vertex AI is 'vertex-ai' (not 'google-vertex-ai')
  it('Google Vertex AI: response normalizes to OpenAI format (gemini model)', () => {
    const vertexResponse = {
      status: 200,
      data: {
        modelVersion: 'gemini-2.0-flash',
        candidates: [
          {
            content: {
              parts: [{ text: STRUCTURED_CONTENT }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      },
    };

    const result = transformProviderResponse(
      vertexResponse,
      'vertex-ai',
      'chatComplete',
      200,
      {},
      'gemini-2.0-flash',
    ) as any;

    expect(result.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    expect(result.choices[0].finish_reason).toBe('STOP');
    expect(result.choices[0].message.role).toBe('assistant');
    expect(result.provider).toBe('vertex-ai');
  });

  it('All providers produce identical structured content', () => {
    const openaiResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [
        {
          message: { role: 'assistant', content: STRUCTURED_CONTENT },
          finish_reason: 'stop',
          index: 0,
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };

    const anthropicResponse = {
      status: 200,
      data: {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: STRUCTURED_CONTENT }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const googleResponse = {
      status: 200,
      data: {
        modelVersion: 'gemini-2.0-flash',
        candidates: [
          {
            content: {
              parts: [{ text: STRUCTURED_CONTENT }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      },
    };

    const openaiResult = transformProviderResponse(
      openaiResponse, 'openai', 'chatComplete', 200,
    ) as any;
    const anthropicResult = transformProviderResponse(
      anthropicResponse, 'anthropic', 'chatComplete', 200,
    ) as any;
    const googleResult = transformProviderResponse(
      googleResponse, 'google', 'chatComplete', 200,
    ) as any;
    const vertexResult = transformProviderResponse(
      googleResponse, 'vertex-ai', 'chatComplete', 200, {}, 'gemini-2.0-flash',
    ) as any;

    // All providers produce the same structured content
    expect(openaiResult.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    expect(anthropicResult.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    expect(googleResult.choices[0].message.content).toBe(STRUCTURED_CONTENT);
    expect(vertexResult.choices[0].message.content).toBe(STRUCTURED_CONTENT);

    // All have assistant role
    expect(openaiResult.choices[0].message.role).toBe('assistant');
    expect(anthropicResult.choices[0].message.role).toBe('assistant');
    expect(googleResult.choices[0].message.role).toBe('assistant');
    expect(vertexResult.choices[0].message.role).toBe('assistant');
  });
});

describe('Structured Output — Complex Schema Request Transform', () => {
  const complexParams = {
    model: 'gpt-4o',
    messages: [{ role: 'user' as const, content: 'Return a complex object' }],
    max_tokens: 512,
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'ComplexObject',
        schema: COMPLEX_SCHEMA,
      },
    },
  };

  it('OpenAI: complex schema passes through as-is', async () => {
    const result = await buildProviderRequest(
      complexParams,
      'openai',
      { provider: 'openai', apiKey: 'test-key' },
      'chatComplete',
    );

    expect(result.body.response_format).toEqual(complexParams.response_format);
    const schema = result.body.response_format.json_schema.schema;
    expect(schema.properties.address.type).toBe('object');
    expect(schema.properties.tags.type).toBe('array');
    expect(schema.properties.status.enum).toEqual(['active', 'inactive', 'pending']);
    expect(schema.properties.metadata.anyOf).toBeDefined();
  });

  it('Anthropic: complex schema maps to output_config.format', async () => {
    const result = await buildProviderRequest(
      { ...complexParams, model: 'claude-sonnet-4-20250514' },
      'anthropic',
      { provider: 'anthropic', apiKey: 'test-key' },
      'chatComplete',
    );

    const format = result.body.output_config?.format;
    expect(format).toBeDefined();
    expect(format.type).toBe('json_schema');
    expect(format.schema).toEqual(COMPLEX_SCHEMA);
    // Nested objects preserved
    expect(format.schema.properties.address.properties.country.anyOf).toEqual([
      { type: 'string' },
      { type: 'null' },
    ]);
    // Arrays preserved
    expect(format.schema.properties.scores.items.properties.subject.type).toBe('string');
    // Enum preserved
    expect(format.schema.properties.status.enum).toEqual(['active', 'inactive', 'pending']);
  });

  it('Google AI Studio: complex schema maps to generationConfig', async () => {
    const result = await buildProviderRequest(
      { ...complexParams, model: 'gemini-2.0-flash' },
      'google',
      { provider: 'google', apiKey: 'test-key' },
      'chatComplete',
    );

    const genConfig = result.body.generationConfig;
    expect(genConfig.responseMimeType).toBe('application/json');
    expect(genConfig.responseJsonSchema).toEqual(COMPLEX_SCHEMA);
    // Verify nested structures survived the transform
    expect(genConfig.responseJsonSchema.properties.address.type).toBe('object');
    expect(genConfig.responseJsonSchema.properties.tags.items.type).toBe('string');
    expect(genConfig.responseJsonSchema.properties.metadata.anyOf).toBeDefined();
    expect(genConfig.responseJsonSchema.required).toEqual(['id', 'name', 'status', 'tags']);
  });
});

// Simulate weighted load balancing: regardless of which provider is selected,
// the structured output request/response transforms produce consistent results
describe('Structured Output: Weighted Load Balancing Consistency', () => {
  const providers = [
    {
      name: 'openai',
      target: { provider: 'openai', apiKey: 'test-key' },
      mockResponse: {
        status: 200,
        data: {
          id: 'chatcmpl-lb',
          object: 'chat.completion',
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: STRUCTURED_CONTENT },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
        },
      },
    },
    {
      name: 'anthropic',
      target: { provider: 'anthropic', apiKey: 'test-key' },
      mockResponse: {
        status: 200,
        data: {
          id: 'msg_lb',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          content: [{ type: 'text', text: STRUCTURED_CONTENT }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      },
    },
    {
      name: 'google',
      target: { provider: 'google', apiKey: 'test-key' },
      mockResponse: {
        status: 200,
        data: {
          candidates: [
            {
              content: {
                parts: [{ text: STRUCTURED_CONTENT }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: 25,
            totalTokenCount: 75,
          },
        },
      },
    },
  ];

  it('all providers produce identical structured content regardless of weight selection', () => {
    const results = providers.map((p) => {
      const response = transformProviderResponse(
        p.mockResponse,
        p.name,
        'chatComplete',
        200,
        {},
      ) as any;
      return {
        provider: p.name,
        content: response.choices[0].message.content,
        role: response.choices[0].message.role,
        finishReason: response.choices[0].finish_reason,
      };
    });

    // All providers should produce the same content (the core guarantee)
    const contents = new Set(results.map((r) => r.content));
    expect(contents.size).toBe(1);
    expect(contents.has(STRUCTURED_CONTENT)).toBe(true);

    // All should have assistant role
    results.forEach((r) => {
      expect(r.role).toBe('assistant');
    });

    // finish_reason varies by provider in non-strict mode:
    // OpenAI: 'stop', Anthropic: 'end_turn', Google: 'stop'
    // In strict mode (strictOpenAiCompliance=true), all normalize to 'stop'
    // transformProviderResponse uses non-strict by default
    expect(results.find((r) => r.provider === 'openai')!.finishReason).toBe('stop');
    expect(results.find((r) => r.provider === 'anthropic')!.finishReason).toBe('end_turn');
    expect(results.find((r) => r.provider === 'google')!.finishReason).toBe('STOP');
  });

  it('parsed JSON from any provider is structurally identical', () => {
    const parsed = providers.map((p) => {
      const response = transformProviderResponse(
        p.mockResponse,
        p.name,
        'chatComplete',
        200,
        {},
      ) as any;
      return JSON.parse(response.choices[0].message.content);
    });

    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i]).toEqual(parsed[0]);
    }
  });
});
