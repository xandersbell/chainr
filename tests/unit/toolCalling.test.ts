/**
 * Tool Calling 对齐测试
 * 验证各 provider 的 tools/tool_choice 请求转换和 tool_calls 响应透传
 */
import { describe, it, expect } from 'vitest';
import {
  DeepSeekChatCompleteConfig,
  DeepSeekChatCompleteResponseTransform,
  DeepSeekChatCompleteStreamChunkTransform,
} from '../../src/providers/deepseek/chatComplete';

// 简化版 transformUsingProviderConfig，避免 import 整个 Providers 注册表
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
        description: '获取天气',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    },
  ];

  describe('请求转换', () => {
    it('tools 参数正确透传', () => {
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolsPayload,
      });

      expect(result.tools).toEqual(toolsPayload);
    });

    it('tool_choice 参数正确透传', () => {
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolsPayload,
        tool_choice: 'auto',
      });

      expect(result.tool_choice).toBe('auto');
    });

    it('tool_choice 为对象时正确透传', () => {
      const toolChoice = { type: 'function', function: { name: 'get_weather' } };
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        tools: toolsPayload,
        tool_choice: toolChoice,
      });

      expect(result.tool_choice).toEqual(toolChoice);
    });

    it('不传 tools 时请求体中不包含 tools 字段', () => {
      const result = applyConfig(DeepSeekChatCompleteConfig, {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(result.tools).toBeUndefined();
      expect(result.tool_choice).toBeUndefined();
    });
  });

  describe('响应转换', () => {
    it('tool_calls 从响应中正确透传', () => {
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

    it('无 tool_calls 时响应中不包含该字段', () => {
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

  describe('流式响应', () => {
    it('流式 chunk 中 tool_calls delta 正确透传', () => {
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

    it('流式 chunk 无 tool_calls 时正常处理', () => {
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
