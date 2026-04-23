import { describe, it, expect } from 'vitest';
import { transformResponse, transformNomicEmbedResponse, transformJinaEmbedResponse, transformVoyageEmbedResponse, transformSegmindImageResponse, transformRecraftImageResponse, transformStabilityImageResponse, transformMeshyResponse, transformTripo3DResponse } from '../../src/core/transformResponse';
import { OPEN_AI, ANTHROPIC, GOOGLE_VERTEX_AI, OPENROUTER } from '../../src/globals';
import type { ChatCompletionResponse, ErrorResponse, EmbedResponse, ImageGenerateResponse, Model3DGenerateResponse } from '../../src/core/types';

describe('transformResponse', () => {
  // ============================================
  // OpenAI / OpenRouter (pass-through)
  // ============================================
  describe('OpenAI / OpenRouter (pass-through)', () => {
    it('should return ChatCompletionResponse unchanged when status is 200', () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const rawResponse = { status: 200, data: mockResponse };
      const result = transformResponse(rawResponse, OPEN_AI) as ChatCompletionResponse;

      expect(result).toEqual(mockResponse);
    });

    it('should work with raw data object (no status wrapper)', () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1677652289,
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hi there!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 3,
          total_tokens: 11,
        },
      };

      const result = transformResponse(mockResponse, OPENROUTER) as ChatCompletionResponse;

      expect(result).toEqual(mockResponse);
    });

    it('should return ErrorResponse for error in body with status 200', () => {
      const rawResponse = {
        status: 200,
        data: {
          error: {
            message: 'Invalid API key',
            type: 'authentication_error',
            param: null,
            code: null,
          },
        },
      };

      const result = transformResponse(rawResponse, OPEN_AI) as ErrorResponse;

      expect(result.error.message).toBe('Invalid API key');
      expect(result.error.type).toBe('authentication_error');
      expect(result.error.provider).toBe(OPEN_AI);
      expect(result.error.code).toBe('200');
    });
  });

  // ============================================
  // Anthropic Transform
  // ============================================
  describe('Anthropic Transform', () => {
    it('should transform id from response.id', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-123',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hello!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.id).toBe('anthropic-msg-123');
    });

    it('should transform model from response.model', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-456',
          model: 'claude-3-opus-20240229',
          content: [{ type: 'text', text: 'Response content' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.model).toBe('claude-3-opus-20240229');
    });

    it('should transform content from response.content[0].text', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-789',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Anthropic response text' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.choices[0].message.content).toBe('Anthropic response text');
    });

    it('should transform finish_reason from response.stop_reason', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-001',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Content' }],
          stop_reason: 'max_tokens',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.choices[0].finish_reason).toBe('max_tokens');
    });

    it('should transform usage.prompt_tokens from response.usage.input_tokens', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-002',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Content' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.usage.prompt_tokens).toBe(100);
    });

    it('should transform usage.completion_tokens from response.usage.output_tokens', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-003',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Content' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 75 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.usage.completion_tokens).toBe(75);
    });

    it('should set usage.total_tokens as sum of input + output', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-004',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Content' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.usage.total_tokens).toBe(150);
    });

    it('should handle missing usage fields gracefully', () => {
      const rawResponse = {
        status: 200,
        data: {
          id: 'anthropic-msg-005',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Content' }],
          stop_reason: 'end_turn',
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;

      expect(result.usage.prompt_tokens).toBe(0);
      expect(result.usage.completion_tokens).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });
  });

  // ============================================
  // Vertex AI Transform
  // ============================================
  describe('Vertex AI Transform', () => {
    it('should generate id as vertex-{timestamp}', () => {
      const rawResponse = {
        status: 200,
        data: {
          modelVersion: 'claude-3-5-sonnet@20241022',
          candidates: [
            {
              content: [
                {
                  parts: [{ text: 'Hello!' }],
                },
              ],
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        },
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;

      expect(result.id).toMatch(/^vertex-\d+$/);
    });

    it('should transform model from response.modelVersion', () => {
      const rawResponse = {
        status: 200,
        data: {
          modelVersion: 'claude-3-5-sonnet@20241022',
          candidates: [
            {
              content: [
                {
                  parts: [{ text: 'Hello!' }],
                },
              ],
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        },
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;

      expect(result.model).toBe('claude-3-5-sonnet@20241022');
    });

    it('should transform content from response.candidates[0].content[0].parts[0].text', () => {
      const rawResponse = {
        status: 200,
        data: {
          modelVersion: 'claude-3-5-sonnet@20241022',
          candidates: [
            {
              content: [
                {
                  parts: [{ text: 'Vertex AI response text' }],
                },
              ],
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        },
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;

      expect(result.choices[0].message.content).toBe('Vertex AI response text');
    });

    it('should transform finish_reason from response.candidates[0].finishReason', () => {
      const rawResponse = {
        status: 200,
        data: {
          modelVersion: 'claude-3-5-sonnet@20241022',
          candidates: [
            {
              content: [
                {
                  parts: [{ text: 'Hello!' }],
                },
              ],
              finishReason: 'MAX_TOKENS',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        },
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;

      expect(result.choices[0].finish_reason).toBe('MAX_TOKENS');
    });

    it('should transform usage from response.usageMetadata', () => {
      const rawResponse = {
        status: 200,
        data: {
          modelVersion: 'claude-3-5-sonnet@20241022',
          candidates: [
            {
              content: [
                {
                  parts: [{ text: 'Hello!' }],
                },
              ],
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
        },
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;

      expect(result.usage.prompt_tokens).toBe(100);
      expect(result.usage.completion_tokens).toBe(50);
      expect(result.usage.total_tokens).toBe(150);
    });

    it('should handle missing usageMetadata fields gracefully', () => {
      const rawResponse = {
        status: 200,
        data: {
          modelVersion: 'claude-3-5-sonnet@20241022',
          candidates: [
            {
              content: [
                {
                  parts: [{ text: 'Hello!' }],
                },
              ],
              finishReason: 'STOP',
            },
          ],
        },
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;

      expect(result.usage.prompt_tokens).toBe(0);
      expect(result.usage.completion_tokens).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });
  });

  // ============================================
  // Error Responses
  // ============================================
  describe('Error Responses', () => {
    it('should return ErrorResponse with provider for 4xx status codes', () => {
      const rawResponse = {
        status: 400,
        data: {
          error: {
            message: 'Bad request',
            type: 'invalid_request_error',
            param: null,
            code: null,
          },
        },
      };

      const result = transformResponse(rawResponse, OPEN_AI) as ErrorResponse;

      expect(result.error.message).toBe('Bad request');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.provider).toBe(OPEN_AI);
      expect(result.error.code).toBe('400');
    });

    it('should return ErrorResponse with provider for 5xx status codes', () => {
      const rawResponse = {
        status: 500,
        data: {
          error: {
            message: 'Internal server error',
            type: 'server_error',
            param: null,
            code: null,
          },
        },
      };

      const result = transformResponse(rawResponse, OPEN_AI) as ErrorResponse;

      expect(result.error.message).toBe('Internal server error');
      expect(result.error.type).toBe('server_error');
      expect(result.error.provider).toBe(OPEN_AI);
      expect(result.error.code).toBe('500');
    });

    it('should default error type to provider_error when not specified', () => {
      const rawResponse = {
        status: 429,
        data: {
          error: {
            message: 'Rate limit exceeded',
            param: null,
            code: null,
          },
        },
      };

      const result = transformResponse(rawResponse, ANTHROPIC) as ErrorResponse;

      expect(result.error.message).toBe('Rate limit exceeded');
      expect(result.error.type).toBe('provider_error');
      expect(result.error.provider).toBe(ANTHROPIC);
    });

    it('should handle error without error field (generic message)', () => {
      const rawResponse = {
        status: 503,
        data: {},
      };

      const result = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ErrorResponse;

      expect(result.error.message).toBe('Unknown error');
      expect(result.error.type).toBe('provider_error');
      expect(result.error.provider).toBe(GOOGLE_VERTEX_AI);
    });

    it('should include status code in error code', () => {
      const rawResponse = {
        status: 401,
        data: {},
      };

      const result = transformResponse(rawResponse, OPENROUTER) as ErrorResponse;

      expect(result.error.code).toBe('401');
    });
  });

  // ============================================
  // Status 204
  // ============================================
  describe('Status 204', () => {
    it('should return empty ChatCompletionResponse with all zeros', () => {
      const rawResponse = { status: 204 };

      const result = transformResponse(rawResponse, OPEN_AI) as ChatCompletionResponse;

      expect(result.id).toBe('');
      expect(result.object).toBe('chat.completion');
      expect(result.created).toBe(0);
      expect(result.model).toBe('');
      expect(result.choices).toEqual([]);
      expect(result.usage.prompt_tokens).toBe(0);
      expect(result.usage.completion_tokens).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });

    it('should work for any provider with status 204', () => {
      const rawResponse = { status: 204 };

      const resultAnthropic = transformResponse(rawResponse, ANTHROPIC) as ChatCompletionResponse;
      const resultVertex = transformResponse(rawResponse, GOOGLE_VERTEX_AI) as ChatCompletionResponse;
      const resultOpenRouter = transformResponse(rawResponse, OPENROUTER) as ChatCompletionResponse;

      expect(resultAnthropic.usage.total_tokens).toBe(0);
      expect(resultVertex.usage.total_tokens).toBe(0);
      expect(resultOpenRouter.usage.total_tokens).toBe(0);
    });
  });

  // ============================================
  // Default provider behavior
  // ============================================
  describe('Default provider behavior', () => {
    it('should return data as ChatCompletionResponse for unknown provider', () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-unknown',
        object: 'chat.completion',
        created: 1677652288,
        model: 'unknown-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      const rawResponse = { status: 200, data: mockResponse };
      const result = transformResponse(rawResponse, 'unknown-provider') as ChatCompletionResponse;

      expect(result).toEqual(mockResponse);
    });

    it('should generate provider_error for unknown provider with error status', () => {
      const rawResponse = {
        status: 500,
        data: {},
      };

      const result = transformResponse(rawResponse, 'unknown-provider') as ErrorResponse;

      expect(result.error.type).toBe('provider_error');
      expect(result.error.provider).toBe('unknown-provider');
    });
  });

  describe('Embeddings Response Transforms', () => {
    describe('Nomic Embeddings', () => {
      it('should transform Nomic embeddings response', () => {
        const rawResponse = {
          data: [
            { embedding: [0.1, 0.2, 0.3], index: 0 },
            { embedding: [0.4, 0.5, 0.6], index: 1 },
          ],
          model: 'nomic-embed-text-v1.5',
          usage: { prompt_tokens: 10, total_tokens: 20 },
        };

        const result = transformNomicEmbedResponse(rawResponse) as EmbedResponse;

        expect(result.provider).toBe('nomic');
        expect(result.model).toBe('nomic-embed-text-v1.5');
        expect(result.data).toHaveLength(2);
        expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
        expect(result.data[1].embedding).toEqual([0.4, 0.5, 0.6]);
      });
    });

    describe('Jina Embeddings', () => {
      it('should transform Jina embeddings response', () => {
        const rawResponse = {
          data: [
            { embedding: [0.1, 0.2], index: 0 },
          ],
          model: 'jina-embeddings-v4',
          usage: { prompt_tokens: 5, total_tokens: 10 },
        };

        const result = transformJinaEmbedResponse(rawResponse) as EmbedResponse;

        expect(result.provider).toBe('jina');
        expect(result.model).toBe('jina-embeddings-v4');
        expect(result.data[0].embedding).toEqual([0.1, 0.2]);
      });
    });

    describe('Voyage Embeddings', () => {
      it('should transform Voyage embeddings response', () => {
        const rawResponse = {
          data: [
            { embedding: [0.9, 0.8, 0.7], index: 0 },
          ],
          model: 'voyage-3-lite',
          usage: { prompt_tokens: 3, total_tokens: 6 },
        };

        const result = transformVoyageEmbedResponse(rawResponse) as EmbedResponse;

        expect(result.provider).toBe('voyage');
        expect(result.model).toBe('voyage-3-lite');
        expect(result.data[0].embedding).toEqual([0.9, 0.8, 0.7]);
      });
    });
  });

  describe('Image Generation Response Transforms', () => {
    describe('Segmind', () => {
      it('should transform Segmind image response', () => {
        const rawResponse = {
          image: 'base64encodedimage',
          seed: 12345,
        };

        const result = transformSegmindImageResponse(rawResponse) as ImageGenerateResponse;

        expect(result.provider).toBe('segmind');
        expect(result.data[0].b64_json).toBe('base64encodedimage');
      });
    });

    describe('Recraft', () => {
      it('should transform Recraft image response', () => {
        const rawResponse = {
          url: 'https://example.com/image.png',
          revised_prompt: 'a beautiful sunset over ocean',
        };

        const result = transformRecraftImageResponse(rawResponse) as ImageGenerateResponse;

        expect(result.provider).toBe('recraft-ai');
        expect(result.data[0].url).toBe('https://example.com/image.png');
        expect(result.data[0].revised_prompt).toBe('a beautiful sunset over ocean');
      });
    });

    describe('Stability AI', () => {
      it('should transform Stability AI image response', () => {
        const rawResponse = {
          artifacts: [
            { base64: 'abc123', finishReason: 'SUCCESS' },
            { base64: 'def456', finishReason: 'SUCCESS' },
          ],
        };

        const result = transformStabilityImageResponse(rawResponse) as ImageGenerateResponse;

        expect(result.provider).toBe('stability-ai');
        expect(result.data).toHaveLength(2);
        expect(result.data[0].b64_json).toBe('abc123');
        expect(result.data[1].b64_json).toBe('def456');
      });
    });
  });

  describe('3D Generation Response Transforms', () => {
    describe('Meshy', () => {
      it('should transform Meshy 3D response', () => {
        const rawResponse = {
          id: 'task-123',
          status: 'completed',
          model_url: 'https://example.com/model.glb',
        };

        const result = transformMeshyResponse(rawResponse) as Model3DGenerateResponse;

        expect(result.provider).toBe('meshy');
        expect(result.task_id).toBe('task-123');
        expect(result.status).toBe('completed');
        expect(result.model_url).toBe('https://example.com/model.glb');
      });

      it('should handle pending status', () => {
        const rawResponse = {
          id: 'task-456',
          status: 'pending',
        };

        const result = transformMeshyResponse(rawResponse) as Model3DGenerateResponse;

        expect(result.status).toBe('pending');
        expect(result.model_url).toBeUndefined();
      });
    });

    describe('Tripo3D', () => {
      it('should transform Tripo3D response', () => {
        const rawResponse = {
          id: 'tripo-task-789',
          status: 'completed',
          result: { model_url: 'https://example.com/tripo.glb' },
        };

        const result = transformTripo3DResponse(rawResponse) as Model3DGenerateResponse;

        expect(result.provider).toBe('tripo3d');
        expect(result.task_id).toBe('tripo-task-789');
        expect(result.status).toBe('completed');
        expect(result.model_url).toBe('https://example.com/tripo.glb');
      });
    });
  });
});
