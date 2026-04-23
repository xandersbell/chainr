import { describe, it, expect } from 'vitest';
import { transformRequest } from '../../src/core/transformRequest';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER } from '../../src/globals';
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
});
