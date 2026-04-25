/**
 * Tool Calling alignment tests
 * Verify tools/tool_choice request transformation and tool_calls response passthrough across providers
 */
import { describe, it, expect } from 'vitest';
import {
  DeepSeekChatCompleteConfig,
  DeepSeekChatCompleteResponseTransform,
  DeepSeekChatCompleteStreamChunkTransform,
} from '../../src/providers/deepseek/chatComplete';

// Simplified transformUsingProviderConfig to avoid importing the entire Providers registry
function applyConfig(config: Record<string, any>, params: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key in config) {
    const paramConfig = config[key];
    if (key in params) {
      let value = params[key];
      if (paramConfig.transform) {
        value = paramConfig.transform(params, {});
      }
      result[paramConfig.param] = value;
    } else if (paramConfig.required && paramConfig.default !== undefined) {
      result[paramConfig.param] = paramConfig.default;
    }
  }
  return result;
}

describe('Tool Calling — DeepSeek', () => {
  const toolsPayload = [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'get weather',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    },
  ];

  describe('Request transformation', () => {
    it('tools param is correctly passed through', () => {
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolsPayload,
      });

      expect(result.tools).toEqual(toolsPayload);
    });

    it('tool_choice param is correctly passed through', () => {
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolsPayload,
        tool_choice: 'auto',
      });

      expect(result.tool_choice).toBe('auto');
    });

    it('tool_choice as object is correctly passed through', () => {
      const toolChoice = { type: 'function', function: { name: 'get_weather' } };
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolsPayload,
        tool_choice: toolChoice,
      });

      expect(result.tool_choice).toEqual(toolChoice);
    });

    it('when tools is not provided, request body does not include tools field', () => {
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(result.tools).toBeUndefined();
      expect(result.tool_choice).toBeUndefined();
    });
  });

  describe('Response transformation', () => {
    it('tool_calls are correctly passed through from response', () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1700000000,
        model: 'deepseek-chat' as const,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Beijing"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      const result = DeepSeekChatCompleteResponseTransform(
        mockResponse as any,
        200,
        new Headers(),
        false
      );

      expect(result).toHaveProperty('choices');
      const choices = (result as any).choices;
      expect(choices[0].message.tool_calls).toEqual([
        {
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"Beijing"}',
          },
        },
      ]);
    });

    it('when no tool_calls, response does not include the field', () => {
      const mockResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1700000000,
        model: 'deepseek-chat' as const,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      const result = DeepSeekChatCompleteResponseTransform(
        mockResponse as any,
        200,
        new Headers(),
        false
      );

      const choices = (result as any).choices;
      expect(choices[0].message.tool_calls).toBeUndefined();
    });
  });

  describe('Streaming response', () => {
    it('tool_calls delta in streaming chunk is correctly passed through', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-stream-1',
        object: 'chat.completion.chunk',
        created: 1700000000,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_abc123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      const result = DeepSeekChatCompleteStreamChunkTransform(
        `data: ${chunk}`,
        '',
        {},
        false,
        {} as any
      );

      const parsed = JSON.parse((result as string).replace('data: ', '').trim());
      expect(parsed.choices[0].delta.tool_calls).toEqual([
        {
          index: 0,
          id: 'call_abc123',
          type: 'function',
          function: { name: 'get_weather', arguments: '' },
        },
      ]);
    });

    it('streaming chunk without tool_calls is handled normally', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-stream-2',
        object: 'chat.completion.chunk',
        created: 1700000000,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      });

      const result = DeepSeekChatCompleteStreamChunkTransform(
        `data: ${chunk}`,
        '',
        {},
        false,
        {} as any
      );

      const parsed = JSON.parse((result as string).replace('data: ', '').trim());
      expect(parsed.choices[0].delta.content).toBe('Hello');
      expect(parsed.choices[0].delta.tool_calls).toBeUndefined();
    });
  });
});
