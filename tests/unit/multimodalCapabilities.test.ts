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
      'openai chatComplete does not accept provider-specific input_file content; use image_url or file',
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

  it('treats input_file data URLs as explicit MIME typed input', () => {
    const params: Params = {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              file: {
                data: 'data:image/png;base64,AAAA',
              },
            },
          ],
        },
      ],
    };

    expect(inferMultimodalRequirements(params)[0]).toMatchObject({
      mediaKind: 'image',
      sourceKind: 'base64',
      mimeType: 'image/png',
      needsExplicitMimeType: false,
    });
  });

  it('does not require explicit MIME type for provider file IDs', () => {
    const params: Params = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                file_id: 'file_123',
              },
            },
          ],
        },
      ],
    };

    expect(getUnsupportedMultimodalRequirement('openai', params)).toBeUndefined();
    expect(getUnsupportedMultimodalRequirement('azure-openai', params)).toBeUndefined();
    expect(getUnsupportedMultimodalRequirement('anthropic', params)).toContain(
      'anthropic does not support unknown input from file-id',
    );
  });

  it('rejects provider-specific input_file image content for OpenAI chat providers', () => {
    const params: Params = {
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
    };

    expect(getUnsupportedMultimodalRequirement('openai', params)).toBe(
      'openai chatComplete does not accept provider-specific input_file content; use image_url or file',
    );
    expect(getUnsupportedMultimodalRequirement('azure-openai', params)).toBe(
      'azure-openai chatComplete does not accept provider-specific input_file content; use image_url or file',
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

  it('allows OpenAI and Azure OpenAI chat input_audio content', () => {
    const params: Params = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: 'BASE64_AUDIO_BYTES',
                format: 'wav',
              },
            },
          ],
        },
      ],
    };

    expect(getUnsupportedMultimodalRequirement('openai', params)).toBeUndefined();
    expect(getUnsupportedMultimodalRequirement('azure-openai', params)).toBeUndefined();
    expect(getUnsupportedMultimodalRequirement('anthropic', params)).toContain(
      'anthropic does not support audio input from base64',
    );
  });

  it('infers image requirements from OpenAI responses input_image content', () => {
    const params: Params = {
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: 'https://example.com/image.png',
              detail: 'high',
            },
          ],
        },
      ],
    };

    expect(inferMultimodalRequirements(params)).toEqual([
      {
        type: 'input_image',
        mediaKind: 'image',
        sourceKind: 'https-url',
        mimeType: 'image/*',
      },
    ]);
  });

  it('infers base64 image requirements from OpenAI responses input_image content', () => {
    const params: Params = {
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: 'data:image/png;base64,AAAA',
              detail: 'low',
            },
          ],
        },
      ],
    };

    expect(inferMultimodalRequirements(params)).toEqual([
      {
        type: 'input_image',
        mediaKind: 'image',
        sourceKind: 'base64',
        mimeType: 'image/png',
      },
    ]);
  });

  it('infers file-id image requirements from OpenAI responses input_image content', () => {
    const params: Params = {
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              file_id: 'file_vision_123',
              detail: 'high',
            },
          ],
        },
      ],
    };

    expect(inferMultimodalRequirements(params)).toEqual([
      {
        type: 'input_image',
        mediaKind: 'image',
        sourceKind: 'file-id',
        mimeType: 'image/*',
      },
    ]);
  });

  it('rejects Azure OpenAI responses input_image file_id content', () => {
    const params: Params = {
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              file_id: 'file_vision_123',
              detail: 'high',
            },
          ],
        },
      ],
    };

    expect(
      getUnsupportedMultimodalRequirement('azure-openai', params, 'createModelResponse'),
    ).toBe('azure-openai createModelResponse input_image must use image_url with a URL or data URL');
  });

  it('rejects Priorai input_file image content for OpenAI responses providers', () => {
    const params: Params = {
      model: 'gpt-4o',
      input: [
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
    };

    expect(getUnsupportedMultimodalRequirement('openai', params, 'createModelResponse')).toBe(
      'openai createModelResponse input_file must use file_data, file_id, file_url, and filename',
    );
    expect(
      getUnsupportedMultimodalRequirement('azure-openai', params, 'createModelResponse'),
    ).toBe(
      'azure-openai createModelResponse input_file must use file_data, file_id, file_url, and filename',
    );
  });

  it('rejects input_audio content for OpenAI responses providers', () => {
    const params: Params = {
      model: 'gpt-4o',
      input: [
        {
          type: 'input_audio',
          input_audio: {
            data: 'BASE64_AUDIO_BYTES',
            format: 'wav',
          },
        },
      ] as any,
    };

    expect(getUnsupportedMultimodalRequirement('openai', params, 'createModelResponse')).toBe(
      'openai createModelResponse does not support input_audio content',
    );
    expect(
      getUnsupportedMultimodalRequirement('azure-openai', params, 'createModelResponse'),
    ).toBe('azure-openai createModelResponse does not support input_audio content');
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

  it('evaluates target override params before nested target capability checks', () => {
    const params: Params = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    };

    expect(
      targetSupportsMultimodalRequest(
        {
          strategy: 'loadbalance',
          overrideParams: videoUrlParams,
          targets: [{ provider: 'openai' }, { provider: 'vertex-ai' }],
        },
        params,
      ),
    ).toBe(true);
  });
});
