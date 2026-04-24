import { describe, it, expect } from 'vitest';
import { transformRequest, transformEmbedRequest, transformImageRequest, transformAudioRequest, transformSpeechRequest } from '../../src/core/transformRequest';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER, NOMIC, JINA, VOYAGE, SEGMIND, RECRAFT_AI, STABILITY_AI, MESHY, TRIPO3D, COHERE, NSCALE, OPENAI_WHISPER_URL, OPENAI_TTS_URL, OPENAI_EMBED_URL, LEMONFOX, LEMONFOX_TRANSCRIBE_URL, LEMONFOX_IMAGE_URL, WORKERS_AI_EMBED_URL, WORKERS_AI_IMAGE_URL, SILICONFLOW_EMBED_URL, SILICONFLOW_IMAGE_URL, NSCALE_URL } from '../../src/globals';
import type { Params, Message, Tool, ToolChoice } from '../../src/types/requestBody';

function createMessages(content: string): Message[] {
  return [{ role: 'user', content }];
}

function createTool(name: string, description: string = 'A test function'): Tool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties: {} },
    },
  };
}

function createToolChoice(toolName: string): ToolChoice {
  return {
    type: 'function',
    function: { name: toolName },
  };
}

describe('transformRequest', () => {
  describe('OpenAI Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'gpt-4o',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'gpt-4o');
      expect(result.body).toHaveProperty('messages');
      expect(result.body.messages).toEqual(params.messages);
    });

    it('uses default model when none provided', () => {
      const params: Params = {
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'gpt-3.5-turbo');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'my-secret-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer my-secret-key');
    });

    it('headers contain OpenAI-Organization when set', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPEN_AI, {
        apiKey: 'test-key',
        openaiOrganization: 'org-123',
      });

      expect(result.headers).toHaveProperty('OpenAI-Organization', 'org-123');
    });

    it('headers contain OpenAI-Project when set', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPEN_AI, {
        apiKey: 'test-key',
        openaiProject: 'proj-456',
      });

      expect(result.headers).toHaveProperty('OpenAI-Project', 'proj-456');
    });

    it('uses correct OpenAI URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.openai.com/v1/chat/completions');
    });
  });

  describe('Anthropic Provider', () => {
    it('body contains model, messages, max_tokens', () => {
      const params: Params = {
        model: 'claude-3-5-sonnet-20241022',
        messages: createMessages('Hello'),
        max_tokens: 2048,
      };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'claude-3-5-sonnet-20241022');
      expect(result.body).toHaveProperty('messages');
      expect(result.body).toHaveProperty('max_tokens', 2048);
    });

    it('extracts system message from messages array', () => {
      const params: Params = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
      };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('system', 'You are a helpful assistant.');
      expect(result.body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('handles multiple system messages by joining with newlines', () => {
      const params: Params = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'System prompt 1' },
          { role: 'system', content: 'System prompt 2' },
          { role: 'user', content: 'Hello' },
        ],
      };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('system', 'System prompt 1\n\nSystem prompt 2');
      expect(result.body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('does not include system field when no system messages', () => {
      const params: Params = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
      };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.body).not.toHaveProperty('system');
      expect(result.body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('uses default model and max_tokens when not provided', () => {
      const params: Params = {
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'claude-3-5-sonnet-20241022');
      expect(result.body).toHaveProperty('max_tokens', 1024);
    });

    it('headers contain X-API-Key', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'anthropic-key' });

      expect(result.headers).toHaveProperty('X-API-Key', 'anthropic-key');
    });

    it('falls back to anthropicApiKey when apiKey not set', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, { anthropicApiKey: 'fallback-key' });

      expect(result.headers).toHaveProperty('X-API-Key', 'fallback-key');
    });

    it('headers contain anthropic-beta with default value', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.headers).toHaveProperty('anthropic-beta', 'messages-2023-12-15');
    });

    it('headers contain custom anthropic-beta when set', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, {
        apiKey: 'test-key',
        anthropicBeta: 'custom-beta-header',
      });

      expect(result.headers).toHaveProperty('anthropic-beta', 'custom-beta-header');
    });

    it('headers contain anthropic-version with default value', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.headers).toHaveProperty('anthropic-version', '2023-06-01');
    });

    it('headers contain custom anthropic-version when set', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, {
        apiKey: 'test-key',
        anthropicVersion: '2024-01-01',
      });

      expect(result.headers).toHaveProperty('anthropic-version', '2024-01-01');
    });

    it('uses correct Anthropic URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, ANTHROPIC, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.anthropic.com/v1/messages');
    });
  });

  describe('Vertex AI Provider', () => {
    it('body contains contents (transformed from messages)', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.body).toHaveProperty('contents');
      expect(result.body.contents).toEqual(params.messages);
    });

    it('does not include model in body when using Vertex', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.body).not.toHaveProperty('model');
    });

    it('URL contains projectId, region, and model', () => {
      const params: Params = {
        model: 'gemini-2.0-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project-id',
        vertexRegion: 'us-east1',
      });

      expect(result.url).toContain('us-east1-aiplatform.googleapis.com');
      expect(result.url).toContain('projects/my-project-id');
      expect(result.url).toContain('locations/us-east1');
      expect(result.url).toContain('publishers/google/models/gemini-2.0-flash');
      expect(result.url).toContain('generateContent');
    });

    it('uses default region when not provided', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.url).toContain('us-central1-aiplatform.googleapis.com');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'vertex-key',
        vertexProjectId: 'my-project',
      });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer vertex-key');
    });

    it('extracts system message as systemInstruction', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.body).toHaveProperty('systemInstruction');
      expect(result.body.systemInstruction).toEqual({
        parts: [{ text: 'You are a helpful assistant.' }],
      });
      expect(result.body.contents).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('adds generationConfig when temperature is set', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
        temperature: 0.9,
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.body).toHaveProperty('generationConfig');
      expect(result.body.generationConfig).toHaveProperty('temperature', 0.9);
    });

    it('adds generationConfig when max_tokens is set', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
        max_tokens: 1024,
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.body).toHaveProperty('generationConfig');
      expect(result.body.generationConfig).toHaveProperty('maxOutputTokens', 1024);
    });

    it('maps top_p to topP in generationConfig', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
        top_p: 0.95,
      };
      const result = transformRequest(params, GOOGLE_VERTEX_AI, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.body).toHaveProperty('generationConfig');
      expect(result.body.generationConfig).toHaveProperty('topP', 0.95);
    });
  });

  describe('Provider Aliases', () => {
    it('maps google-vertexai to vertex-ai', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'google-vertexai' as any, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.url).toContain('aiplatform.googleapis.com');
    });

    it('maps google-vertex-ai to vertex-ai', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'google-vertex-ai' as any, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.url).toContain('aiplatform.googleapis.com');
    });

    it('maps vertexai to vertex-ai', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'vertexai' as any, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.url).toContain('aiplatform.googleapis.com');
    });

    it('maps gcp-vertex to vertex-ai', () => {
      const params: Params = {
        model: 'gemini-1.5-flash',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'gcp-vertex' as any, {
        apiKey: 'test-key',
        vertexProjectId: 'my-project',
      });

      expect(result.url).toContain('aiplatform.googleapis.com');
    });
  });

  describe('OpenRouter Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'openrouter/auto',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'openrouter/auto');
      expect(result.body).toHaveProperty('messages');
      expect(result.body.messages).toEqual(params.messages);
    });

    it('uses default model when none provided', () => {
      const params: Params = {
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'openrouter/auto');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'or-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer or-key');
    });

    it('headers contain HTTP-Referer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.headers).toHaveProperty('HTTP-Referer', 'https://chainr.dev/');
    });

    it('headers contain X-OpenRouter-Title with chainr value', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.headers).toHaveProperty('X-OpenRouter-Title', 'chainr');
    });

    it('uses correct OpenRouter URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    });
  });

  describe('Default (Unknown Provider)', () => {
    it('returns params as body with empty URL', () => {
      const params: Params = {
        model: 'unknown-model',
        messages: createMessages('Hello'),
        temperature: 0.7,
      };
      const result = transformRequest(params, 'unknown-provider', {});

      expect(result.body).toEqual(params);
      expect(result.url).toBe('');
    });

    it('includes default Content-Type header', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'unknown-provider', {});

      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('filterParams', () => {
    it('includes temperature when defined', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        temperature: 0.9,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('temperature', 0.9);
    });

    it('includes top_p when defined', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        top_p: 0.95,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('top_p', 0.95);
    });

    it('includes max_tokens when defined', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        max_tokens: 500,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('max_tokens', 500);
    });

    it('includes stream when defined', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        stream: true,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('stream', true);
    });

    it('includes stop when defined as string', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        stop: 'STOP',
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('stop', 'STOP');
    });

    it('includes stop when defined as array', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        stop: ['STOP', 'END'],
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('stop', ['STOP', 'END']);
    });

    it('includes tools when defined', () => {
      const tools = [createTool('getWeather')];
      const params: Params = {
        messages: createMessages('Hello'),
        tools,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('tools');
      expect(result.body.tools).toEqual(tools);
    });

    it('includes tool_choice when defined', () => {
      const toolChoice = createToolChoice('getWeather');
      const params: Params = {
        messages: createMessages('Hello'),
        tool_choice: toolChoice,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('tool_choice');
      expect(result.body.tool_choice).toEqual(toolChoice);
    });

    it('does not include undefined values', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        temperature: undefined,
        top_p: undefined,
        max_tokens: undefined,
        stream: undefined,
        stop: undefined,
        tools: undefined,
        tool_choice: undefined,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).not.toHaveProperty('temperature');
      expect(result.body).not.toHaveProperty('top_p');
      expect(result.body).not.toHaveProperty('max_tokens');
      expect(result.body).not.toHaveProperty('stream');
      expect(result.body).not.toHaveProperty('stop');
      expect(result.body).not.toHaveProperty('tools');
      expect(result.body).not.toHaveProperty('tool_choice');
    });

    it('handles mixed defined/undefined params correctly', () => {
      const params: Params = {
        messages: createMessages('Hello'),
        temperature: 0.5,
        top_p: undefined,
        max_tokens: 100,
        stream: undefined,
      };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('temperature', 0.5);
      expect(result.body).not.toHaveProperty('top_p');
      expect(result.body).toHaveProperty('max_tokens', 100);
      expect(result.body).not.toHaveProperty('stream');
    });

    it('model stays at body root, not in filterParams', () => {
      const params: Params = {
        model: 'gpt-4o',
        messages: createMessages('Hello'),
        temperature: 0.7,
      };
      const result = transformRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'gpt-4o');
      expect(result.body).toHaveProperty('temperature', 0.7);
    });

    it('messages stays at body root, not in filterParams', () => {
      const messages = createMessages('Hello');
      const params: Params = {
        messages,
        temperature: 0.7,
      };
      const result = transformRequest(params, OPENROUTER, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('messages', messages);
      expect(result.body).toHaveProperty('temperature', 0.7);
    });
  });

  describe('Together AI Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'together-ai/llama-3-8b-instruct',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'together-ai/llama-3-8b-instruct');
      expect(result.body).toHaveProperty('messages');
    });

    it('uses default model when none provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'together-ai/llama-3-8b-instruct');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'together-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer together-key');
    });

    it('uses correct Together AI URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.together.ai/v1/chat/completions');
    });
  });

  describe('Perplexity AI Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'sonar',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'perplexity' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'sonar');
      expect(result.body).toHaveProperty('messages');
    });

    it('uses default model when none provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'perplexity' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'sonar');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'perplexity' as any, { apiKey: 'perplexity-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer perplexity-key');
    });

    it('uses correct Perplexity AI URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'perplexity' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.perplexity.ai/chat/completions');
    });
  });

  describe('Groq Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'llama-3.3-70b-versatile',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'groq' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'llama-3.3-70b-versatile');
      expect(result.body).toHaveProperty('messages');
    });

    it('uses default model when none provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'groq' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'llama-3.3-70b-versatile');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'groq' as any, { apiKey: 'groq-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer groq-key');
    });

    it('uses correct Groq URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'groq' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    });
  });

  describe('DeepSeek Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'deepseek-chat',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'deepseek' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'deepseek-chat');
      expect(result.body).toHaveProperty('messages');
    });

    it('uses default model when none provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'deepseek' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'deepseek-chat');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'deepseek' as any, { apiKey: 'deepseek-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer deepseek-key');
    });

    it('uses correct DeepSeek URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'deepseek' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.deepseek.com/chat/completions');
    });

    it('passes through thinking param when provided', () => {
      const params: Params = {
        model: 'deepseek-reasoner',
        messages: createMessages('Hello'),
        thinking: { type: 'enabled', budget_tokens: 1000 },
      };
      const result = transformRequest(params, 'deepseek' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('thinking');
      expect(result.body.thinking).toEqual({ type: 'enabled', budget_tokens: 1000 });
    });
  });

  describe('Mistral AI Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'mistral-medium-latest',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'mistral-ai' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'mistral-medium-latest');
      expect(result.body).toHaveProperty('messages');
    });

    it('uses default model when none provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'mistral-ai' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'mistral-medium-latest');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'mistral-ai' as any, { apiKey: 'mistral-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer mistral-key');
    });

    it('uses correct Mistral AI URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'mistral-ai' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.mistral.ai/v1/chat/completions');
    });
  });

  describe('Cohere Provider', () => {
    it('body contains model, messages, and filtered params', () => {
      const params: Params = {
        model: 'command-a-03-2025',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'cohere' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'command-a-03-2025');
      expect(result.body).toHaveProperty('messages');
    });

    it('uses default model when none provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'cohere' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'command-a-03-2025');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'cohere' as any, { apiKey: 'cohere-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer cohere-key');
    });

    it('uses correct Cohere URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'cohere' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.cohere.ai/compatibility/v2/chat');
    });

    it('passes through reasoning_effort param when provided', () => {
      const params: Params = {
        model: 'command-a-03-2025',
        messages: createMessages('Hello'),
        reasoning_effort: 'high',
      };
      const result = transformRequest(params, 'cohere' as any, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('reasoning_effort', 'high');
    });
  });

  describe('Azure OpenAI Provider', () => {
    it('body contains model and messages', () => {
      const params: Params = {
        model: 'gpt-4o',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'azure-openai' as any, {
        apiKey: 'azure-key',
        azureResourceName: 'my-resource',
        azureDeploymentId: 'gpt-4o',
        azureApiVersion: '2024-06-01',
      });

      expect(result.body).toHaveProperty('model', 'gpt-4o');
      expect(result.body).toHaveProperty('messages');
    });

    it('headers contain api-key instead of Authorization', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'azure-openai' as any, {
        apiKey: 'azure-secret-key',
        azureResourceName: 'my-resource',
        azureDeploymentId: 'gpt-4o',
      });

      expect(result.headers).toHaveProperty('api-key', 'azure-secret-key');
      expect(result.headers).not.toHaveProperty('Authorization');
    });

    it('uses correct Azure URL format', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'azure-openai' as any, {
        apiKey: 'azure-key',
        azureResourceName: 'my-resource',
        azureDeploymentId: 'gpt-4o',
        azureApiVersion: '2024-06-01',
      });

      expect(result.url).toBe('https://my-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-06-01');
    });

    it('uses default api-version when not provided', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'azure-openai' as any, {
        apiKey: 'azure-key',
        azureResourceName: 'my-resource',
        azureDeploymentId: 'gpt-4o',
      });

      expect(result.url).toContain('api-version=2024-06-01');
    });
  });

  describe('GitHub Models Provider', () => {
    it('body contains model and messages', () => {
      const params: Params = {
        model: 'openai/gpt-4o-mini',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'github' as any, { apiKey: 'github-pat' });

      expect(result.body).toHaveProperty('model', 'openai/gpt-4o-mini');
      expect(result.body).toHaveProperty('messages');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'github' as any, { apiKey: 'github-token' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer github-token');
    });

    it('headers contain GitHub-specific headers', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'github' as any, { apiKey: 'github-pat' });

      expect(result.headers).toHaveProperty('Accept', 'application/vnd.github+json');
      expect(result.headers).toHaveProperty('X-GitHub-Api-Version', '2026-03-10');
    });

    it('uses correct GitHub Models URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'github' as any, { apiKey: 'github-pat' });

      expect(result.url).toBe('https://models.github.ai/inference/chat/completions');
    });
  });

  describe('Azure AI Inference Provider', () => {
    it('body contains model and messages', () => {
      const params: Params = {
        model: 'meta-llama-3-1-70b-instruct',
        messages: createMessages('Hello'),
      };
      const result = transformRequest(params, 'azure-ai' as any, {
        apiKey: 'azure-ai-key',
        azureFoundryUrl: 'https://example.ml.azure.com/deployments/llama',
      });

      expect(result.body).toHaveProperty('model', 'meta-llama-3-1-70b-instruct');
      expect(result.body).toHaveProperty('messages');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'azure-ai' as any, {
        apiKey: 'azure-ai-key',
        azureFoundryUrl: 'https://example.ml.azure.com/deployments/llama',
      });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer azure-ai-key');
    });

    it('uses azureFoundryUrl as base URL', () => {
      const params: Params = { messages: createMessages('Hello') };
      const result = transformRequest(params, 'azure-ai' as any, {
        apiKey: 'azure-ai-key',
        azureFoundryUrl: 'https://example.ml.azure.com/deployments/llama',
      });

      expect(result.url).toBe('https://example.ml.azure.com/deployments/llama');
    });
  });

  describe('Nomic Embeddings Provider', () => {
    it('body contains input array and model', () => {
      const params: Params = {
        model: 'nomic-embed-text-v1.5',
        input: ['hello world', 'goodbye world'],
      };
      const result = transformRequest(params, NOMIC, { apiKey: 'nomic-key' });

      expect(result.body).toHaveProperty('input');
      expect(result.body.input).toEqual(['hello world', 'goodbye world']);
      expect(result.body).toHaveProperty('model', 'nomic-embed-text-v1.5');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { input: ['test'] };
      const result = transformRequest(params, NOMIC, { apiKey: 'nomic-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer nomic-secret');
    });

    it('uses correct Nomic URL', () => {
      const params: Params = { input: ['test'] };
      const result = transformRequest(params, NOMIC, { apiKey: 'key' });

      expect(result.url).toBe('https://api.nomic.ai/embedding/text');
    });

    it('includes task_type when provided', () => {
      const params: Params = { input: ['test'] };
      const result = transformRequest(params, NOMIC, {
        apiKey: 'key',
        taskType: 'search_document',
      });

      expect(result.body).toHaveProperty('task_type', 'search_document');
    });
  });

  describe('Jina Embeddings Provider', () => {
    it('body contains input and normalized', () => {
      const params: Params = {
        model: 'jina-embeddings-v4',
        input: 'hello world',
      };
      const result = transformRequest(params, JINA, { apiKey: 'jina-key' });

      expect(result.body).toHaveProperty('input', 'hello world');
      expect(result.body).toHaveProperty('normalized', true);
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { input: 'test' };
      const result = transformRequest(params, JINA, { apiKey: 'jina-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer jina-secret');
    });

    it('uses correct Jina URL', () => {
      const params: Params = { input: 'test' };
      const result = transformRequest(params, JINA, { apiKey: 'key' });

      expect(result.url).toBe('https://api.jina.ai/embeddings');
    });
  });

  describe('Voyage Embeddings Provider', () => {
    it('body contains input and model', () => {
      const params: Params = {
        model: 'voyage-3-lite',
        input: 'hello world',
      };
      const result = transformRequest(params, VOYAGE, { apiKey: 'voyage-key' });

      expect(result.body).toHaveProperty('input', 'hello world');
      expect(result.body).toHaveProperty('model', 'voyage-3-lite');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { input: 'test' };
      const result = transformRequest(params, VOYAGE, { apiKey: 'voyage-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer voyage-secret');
    });

    it('uses correct Voyage URL', () => {
      const params: Params = { input: 'test' };
      const result = transformRequest(params, VOYAGE, { apiKey: 'key' });

      expect(result.url).toBe('https://api.voyageai.com/v1/embeddings');
    });

    it('includes input_type when provided', () => {
      const params: Params = { input: 'test' };
      const result = transformRequest(params, VOYAGE, {
        apiKey: 'key',
        inputType: 'document',
      });

      expect(result.body).toHaveProperty('input_type', 'document');
    });

    it('includes output_dimension when provided', () => {
      const params: Params = { input: 'test' };
      const result = transformRequest(params, VOYAGE, {
        apiKey: 'key',
        outputDimension: 1024,
      });

      expect(result.body).toHaveProperty('output_dimension', 1024);
    });
  });

  describe('Segmind Image Generation Provider', () => {
    it('body contains prompt', () => {
      const params: Params = {
        prompt: 'a beautiful sunset',
      };
      const result = transformRequest(params, SEGMIND, { apiKey: 'segmind-key' });

      expect(result.body).toHaveProperty('prompt', 'a beautiful sunset');
    });

    it('headers contain x-api-key', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, SEGMIND, { apiKey: 'segmind-secret' });

      expect(result.headers).toHaveProperty('x-api-key', 'segmind-secret');
    });

    it('uses correct Segmind URL', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, SEGMIND, { apiKey: 'key' });

      expect(result.url).toBe('https://api.segmind.com/v1/image/sdxl');
    });

    it('transforms size to img_width and img_height', () => {
      const params: Params = { prompt: 'test', size: '1024x1024' };
      const result = transformRequest(params, SEGMIND, { apiKey: 'key' });

      expect(result.body).toHaveProperty('img_width', 1024);
      expect(result.body).toHaveProperty('img_height', 1024);
    });
  });

  describe('Recraft Image Generation Provider', () => {
    it('body contains prompt and response_format', () => {
      const params: Params = {
        prompt: 'a modern logo',
      };
      const result = transformRequest(params, RECRAFT_AI, { apiKey: 'recraft-key' });

      expect(result.body).toHaveProperty('prompt', 'a modern logo');
      expect(result.body).toHaveProperty('response_format', 'b64_json');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, RECRAFT_AI, { apiKey: 'recraft-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer recraft-secret');
    });

    it('uses correct Recraft URL', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, RECRAFT_AI, { apiKey: 'key' });

      expect(result.url).toBe('https://api.recraft.ai/v1/images/generation');
    });

    it('includes style_id when provided', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, RECRAFT_AI, {
        apiKey: 'key',
        styleId: 'vibrant',
      });

      expect(result.body).toHaveProperty('style_id', 'vibrant');
    });
  });

  describe('Stability AI Image Generation Provider', () => {
    it('body contains text_prompts array', () => {
      const params: Params = {
        prompt: 'a fantasy landscape',
      };
      const result = transformRequest(params, STABILITY_AI, { apiKey: 'stability-key' });

      expect(result.body).toHaveProperty('text_prompts');
      expect(result.body.text_prompts).toEqual([{ text: 'a fantasy landscape', weight: 1 }]);
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, STABILITY_AI, { apiKey: 'stability-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer stability-secret');
    });

    it('uses correct Stability AI URL with model', () => {
      const params: Params = { prompt: 'test', model: 'stable-diffusion-v1-6' };
      const result = transformRequest(params, STABILITY_AI, { apiKey: 'key' });

      expect(result.url).toBe('https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image');
    });

    it('transforms size to width and height', () => {
      const params: Params = { prompt: 'test', size: '512x512' };
      const result = transformRequest(params, STABILITY_AI, { apiKey: 'key' });

      expect(result.body).toHaveProperty('width', 512);
      expect(result.body).toHaveProperty('height', 512);
    });
  });

  describe('Meshy 3D Generation Provider', () => {
    it('body contains prompt and style_preset', () => {
      const params: Params = {
        prompt: 'a wooden chair',
      };
      const result = transformRequest(params, MESHY, { apiKey: 'meshy-key' });

      expect(result.body).toHaveProperty('prompt', 'a wooden chair');
      expect(result.body).toHaveProperty('style_preset', 'realistic');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, MESHY, { apiKey: 'meshy-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer meshy-secret');
    });

    it('uses text-to-3d endpoint by default', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, MESHY, { apiKey: 'key' });

      expect(result.url).toBe('https://api.meshy.ai/v1/text-to-3d');
    });

    it('uses image-to-3d endpoint when mode is image-to-3d', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, MESHY, {
        apiKey: 'key',
        mode: 'image-to-3d',
      });

      expect(result.url).toBe('https://api.meshy.ai/v1/image-to-3d');
    });
  });

  describe('Tripo3D Generation Provider', () => {
    it('body contains prompt and model', () => {
      const params: Params = {
        prompt: 'a detailed robot',
      };
      const result = transformRequest(params, TRIPO3D, { apiKey: 'tripo-key' });

      expect(result.body).toHaveProperty('prompt', 'a detailed robot');
      expect(result.body).toHaveProperty('model', 'tripo3d');
    });

    it('headers contain Authorization Bearer', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, TRIPO3D, { apiKey: 'tripo-secret' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer tripo-secret');
    });

    it('uses correct Tripo3D URL', () => {
      const params: Params = { prompt: 'test' };
      const result = transformRequest(params, TRIPO3D, { apiKey: 'key' });

      expect(result.url).toBe('https://api.tripo3d.ai/v1/tasks');
    });
  });

  describe('OpenAI-Compatible Default Case (Fallback)', () => {
    it('uses OPENAI_COMPATIBLE_URLS for known providers', () => {
      const params: Params = { messages: [{ role: 'user', content: 'hello' }] };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.together.ai/v1/chat/completions');
    });

    it('uses customHost when provided', () => {
      const params: Params = { messages: [{ role: 'user', content: 'hello' }] };
      const result = transformRequest(params, 'unknown-provider' as any, {
        apiKey: 'test-key',
        customHost: 'https://custom.example.com/v1/chat',
      });

      expect(result.url).toBe('https://custom.example.com/v1/chat');
    });

    it('uses urlToFetch when provided', () => {
      const params: Params = { messages: [{ role: 'user', content: 'hello' }] };
      const result = transformRequest(params, 'unknown-provider' as any, {
        apiKey: 'test-key',
        urlToFetch: 'https://custom.example.com/chat',
      });

      expect(result.url).toBe('https://custom.example.com/chat');
    });

    it('adds Authorization header with apiKey', () => {
      const params: Params = { messages: [{ role: 'user', content: 'hello' }] };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'my-secret-key' });

      expect(result.headers).toHaveProperty('Authorization', 'Bearer my-secret-key');
    });

    it('does not add Authorization header when no apiKey', () => {
      const params: Params = { messages: [{ role: 'user', content: 'hello' }] };
      const result = transformRequest(params, 'non-existent-provider' as any, {
        customHost: 'https://test.com',
      });

      expect(result.headers).not.toHaveProperty('Authorization');
    });

    it('preserves body params', () => {
      const params: Params = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.7,
      };
      const result = transformRequest(params, 'together-ai' as any, { apiKey: 'key' });

      expect(result.body).toHaveProperty('model', 'gpt-4');
      expect(result.body).toHaveProperty('temperature', 0.7);
    });

    it('urlToFetch takes precedence over customHost', () => {
      const params: Params = { messages: [{ role: 'user', content: 'hello' }] };
      const result = transformRequest(params, 'unknown-provider' as any, {
        apiKey: 'test-key',
        customHost: 'https://custom.example.com/v1',
        urlToFetch: 'https://urltopick.example.com/chat',
      });

      expect(result.url).toBe('https://urltopick.example.com/chat');
    });
  });
});

describe('transformEmbedRequest', () => {
  describe('OpenAI Embeddings', () => {
    it('should transform OpenAI embeddings request', () => {
      const params: Params = {
        model: 'text-embedding-3-small',
        input: 'Hello world',
      };
      const result = transformEmbedRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.url).toBe(OPENAI_EMBED_URL);
      expect(result.body).toHaveProperty('model', 'text-embedding-3-small');
      expect(result.body).toHaveProperty('input', 'Hello world');
      expect(result.headers['Authorization']).toBe('Bearer test-key');
    });

    it('should use default model when none provided', () => {
      const params: Params = { input: 'Test' };
      const result = transformEmbedRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'text-embedding-3-small');
    });

    it('should handle array input', () => {
      const params: Params = {
        input: ['Hello', 'World'],
      };
      const result = transformEmbedRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body.input).toEqual(['Hello', 'World']);
    });

    it('should include optional params', () => {
      const params: Params = {
        input: 'Test',
        user: 'user123',
        dimensions: 512,
        encoding_format: 'float',
      };
      const result = transformEmbedRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('user', 'user123');
      expect(result.body).toHaveProperty('dimensions', 512);
      expect(result.body).toHaveProperty('encoding_format', 'float');
    });
  });

  describe('Cohere Embeddings', () => {
    it('should transform Cohere embeddings request with texts array', () => {
      const params: Params = {
        model: 'embed-english-v3.0',
        input: ['Hello', 'World'],
      };
      const result = transformEmbedRequest(params, COHERE, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.cohere.ai/v2/embed');
      expect(result.body).toHaveProperty('model', 'embed-english-v3.0');
      expect(result.body).toHaveProperty('texts', ['Hello', 'World']);
      expect(result.headers['Authorization']).toBe('Bearer test-key');
    });

    it('should transform string input to array', () => {
      const params: Params = { input: 'Single text' };
      const result = transformEmbedRequest(params, COHERE, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('texts', ['Single text']);
    });
  });

  describe('Workers AI Embeddings', () => {
    it('should transform Workers AI embeddings request', () => {
      const params: Params = {
        input: ['Hello world'],
      };
      const result = transformEmbedRequest(params, 'workers-ai' as any, { apiKey: 'test-key', workersAiAccountId: 'account123' });

      expect(result.url).toContain(WORKERS_AI_EMBED_URL);
      expect(result.url).toContain('account123');
      expect(result.body).toHaveProperty('text', ['Hello world']);
    });
  });

  describe('SiliconFlow Embeddings', () => {
    it('should transform SiliconFlow embeddings request', () => {
      const params: Params = {
        model: 'BAAI/bge-base-zh-v1.5',
        input: ['Hello'],
      };
      const result = transformEmbedRequest(params, 'siliconflow' as any, { apiKey: 'test-key' });

      expect(result.url).toBe(SILICONFLOW_EMBED_URL);
      expect(result.body).toHaveProperty('model', 'BAAI/bge-base-zh-v1.5');
      expect(result.body).toHaveProperty('input', ['Hello']);
    });
  });
});

describe('transformImageRequest', () => {
  describe('OpenAI DALL-E', () => {
    it('should transform OpenAI DALL-E request', () => {
      const params: Params = {
        model: 'dall-e-3',
        prompt: 'A beautiful sunset',
      };
      const result = transformImageRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.url).toBe('https://api.openai.com/v1/images/generations');
      expect(result.body).toHaveProperty('model', 'dall-e-3');
      expect(result.body).toHaveProperty('prompt', 'A beautiful sunset');
      expect(result.headers['Authorization']).toBe('Bearer test-key');
    });

    it('should use default model when none provided', () => {
      const params: Params = { prompt: 'Test' };
      const result = transformImageRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'dall-e-3');
    });

    it('should include optional params', () => {
      const params: Params = {
        prompt: 'Test',
        n: 2,
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
        response_format: 'b64_json',
      };
      const result = transformImageRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('n', 2);
      expect(result.body).toHaveProperty('size', '1024x1024');
      expect(result.body).toHaveProperty('quality', 'hd');
      expect(result.body).toHaveProperty('style', 'vivid');
      expect(result.body).toHaveProperty('response_format', 'b64_json');
    });
  });

  describe('LemonFox Image', () => {
    it('should transform LemonFox image request', () => {
      const params: Params = {
        prompt: 'A cat',
      };
      const result = transformImageRequest(params, LEMONFOX, { apiKey: 'test-key' });

      expect(result.url).toBe(LEMONFOX_IMAGE_URL);
      expect(result.body).toHaveProperty('prompt', 'A cat');
    });
  });

  describe('Workers AI Image', () => {
    it('should transform Workers AI image request', () => {
      const params: Params = {
        prompt: 'A beautiful landscape',
      };
      const result = transformImageRequest(params, 'workers-ai' as any, { apiKey: 'test-key', workersAiAccountId: 'account123' });

      expect(result.url).toContain(WORKERS_AI_IMAGE_URL);
      expect(result.url).toContain('account123');
      expect(result.body).toHaveProperty('prompt', 'A beautiful landscape');
    });
  });

  describe('nscale Image', () => {
    it('should transform nscale image request', () => {
      const params: Params = {
        prompt: 'Futuristic city',
      };
      const result = transformImageRequest(params, NSCALE, { apiKey: 'test-key' });

      expect(result.url).toBe(NSCALE_URL);
      expect(result.body).toHaveProperty('prompt', 'Futuristic city');
    });
  });
});

describe('transformAudioRequest', () => {
  describe('OpenAI Whisper', () => {
    it('should transform OpenAI Whisper request with FormData', () => {
      const params: Params = {
        model: 'whisper-1',
        file: new Blob(['audio data'], { type: 'audio/mp3' }),
        language: 'en',
      };
      const result = transformAudioRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.url).toBe(OPENAI_WHISPER_URL);
      expect(result.isFormData).toBe(true);
      expect(result.body instanceof FormData).toBe(true);
      expect(result.headers['Authorization']).toBe('Bearer test-key');
    });

    it('should use default model when none provided', () => {
      const params: Params = {
        file: new Blob(['audio'], { type: 'audio/mp3' }),
      };
      const result = transformAudioRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.isFormData).toBe(true);
    });

    it('should include optional params', () => {
      const params: Params = {
        file: new Blob(['audio'], { type: 'audio/mp3' }),
        language: 'zh',
        prompt: 'Transcribe this',
        response_format: 'verbose_json',
        temperature: 0.5,
      };
      const result = transformAudioRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.isFormData).toBe(true);
    });
  });

  describe('LemonFox Transcription', () => {
    it('should transform LemonFox transcription request', () => {
      const params: Params = {
        model: 'whisper-1',
        file: new Blob(['audio data'], { type: 'audio/mp3' }),
      };
      const result = transformAudioRequest(params, LEMONFOX, { apiKey: 'test-key' });

      expect(result.url).toBe(LEMONFOX_TRANSCRIBE_URL);
      expect(result.isFormData).toBe(true);
      expect(result.headers['Authorization']).toBe('Bearer test-key');
    });
  });
});

describe('transformSpeechRequest', () => {
  describe('OpenAI TTS', () => {
    it('should transform OpenAI TTS request', () => {
      const params: Params = {
        model: 'tts-1',
        input: 'Hello, world!',
        voice: 'alloy',
      };
      const result = transformSpeechRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.url).toBe(OPENAI_TTS_URL);
      expect(result.body).toHaveProperty('model', 'tts-1');
      expect(result.body).toHaveProperty('input', 'Hello, world!');
      expect(result.body).toHaveProperty('voice', 'alloy');
      expect(result.headers['Authorization']).toBe('Bearer test-key');
    });

    it('should use default model and voice when none provided', () => {
      const params: Params = {
        input: 'Test speech',
      };
      const result = transformSpeechRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('model', 'tts-1');
      expect(result.body).toHaveProperty('voice', 'alloy');
    });

    it('should include optional params', () => {
      const params: Params = {
        input: 'Test',
        response_format: 'mp3',
        speed: 1.5,
      };
      const result = transformSpeechRequest(params, OPEN_AI, { apiKey: 'test-key' });

      expect(result.body).toHaveProperty('response_format', 'mp3');
      expect(result.body).toHaveProperty('speed', 1.5);
    });

    it('should support all voice options', () => {
      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

      voices.forEach(voice => {
        const params: Params = { input: 'Test', voice: voice as any };
        const result = transformSpeechRequest(params, OPEN_AI, { apiKey: 'test-key' });
        expect(result.body).toHaveProperty('voice', voice);
      });
    });
  });
});
