import { describe, expect, it } from 'vitest';
import {
  getUnsupportedMultimodalRequirement,
  inferMultimodalRequirements,
  targetSupportsMultimodalRequest,
} from '../../src/core/multimodalCapabilities';
import type { Params } from '../../src/types/requestBody';

const videoUrlParams: Params = {
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
};

describe('multimodal capability checks', () => {
  it('infers media kind and source kind from input_file content', () => {
    expect(inferMultimodalRequirements(videoUrlParams)).toEqual([
      {
        type: 'input_file',
        mediaKind: 'video',
        sourceKind: 'https-url',
        mimeType: 'video/mp4',
        needsExplicitMimeType: false,
      },
    ]);
  });

  it('allows Gemini targets to receive video URL input', () => {
    expect(targetSupportsMultimodalRequest({ provider: 'vertex-ai' }, videoUrlParams)).toBe(true);
    expect(targetSupportsMultimodalRequest({ provider: 'google' }, videoUrlParams)).toBe(true);
  });

  it('rejects OpenAI, Anthropic, and Bedrock for video HTTPS input', () => {
    expect(getUnsupportedMultimodalRequirement('openai', videoUrlParams)).toContain(
      'openai does not support video input from https-url',
    );
    expect(getUnsupportedMultimodalRequirement('anthropic', videoUrlParams)).toContain(
      'anthropic does not support video input from https-url',
    );
    expect(getUnsupportedMultimodalRequirement('bedrock', videoUrlParams)).toContain(
      'bedrock does not support video input from https-url',
    );
  });

  it('requires explicit MIME type for input_file routing', () => {
    const params: Params = {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              file: {
                url: 'https://example.com/download?id=123',
              },
            },
          ],
        },
      ],
    };

    expect(getUnsupportedMultimodalRequirement('vertex-ai', params)).toBe(
      'input_file requires an explicit MIME type for reliable multimodal routing',
    );
  });

  it('rejects OpenAI for input_video even when a MIME type is present', () => {
    const params: Params = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_video',
              video_url: 'https://example.com/test.mp4',
              mime_type: 'video/mp4',
            },
          ],
        },
      ],
    };

    expect(getUnsupportedMultimodalRequirement('openai', params)).toContain(
      'openai does not support video input from https-url',
    );
  });

  it('allows Bedrock video input from S3', () => {
    const params: Params = {
      model: 'anthropic.claude-3-5-sonnet',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              file: {
                url: 's3://bucket/test.mp4',
                mime_type: 'video/mp4',
              },
            },
          ],
        },
      ],
    };

    expect(targetSupportsMultimodalRequest({ provider: 'bedrock' }, params)).toBe(true);
  });
});
