Updated: 2026-04-27 12:42:56 EEST

# Multimodal Inputs

Priorai keeps the OpenAI-compatible chat interface as the common entry point, but supports a small Priorai extension for provider-native multimodal files.

## Recommended Input Shape

Use `input_file` when the input is a media or document file that should be routed by MIME type.

```ts
await priorai.chat.completions.create({
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
        {
          type: 'text',
          text: 'Summarize this video.',
        },
      ],
    },
  ],
});
```

Base64 data is also supported:

```ts
{
  type: 'input_file',
  file: {
    data: 'BASE64_BYTES',
    mime_type: 'audio/mpeg',
  },
}
```

The older `file.file_url`, `file.file_data`, and `file.file_name` fields remain supported for compatibility. New code should prefer `url`, `data`, and `filename`.

`mime_type` is required for `input_file` routing when the input contains URL or base64 bytes. Provider `file_id` references do not require MIME type because the file metadata is owned by that provider. Priorai may infer a MIME type for legacy `image_url` data from `data:` URLs or URL pathnames, but general file routing should not rely on filenames or signed URLs. File names are only metadata.

## Compatibility Blocks

Priorai also accepts provider-compatible content blocks that are already used in the ecosystem:

```ts
{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
{ type: 'input_audio', input_audio: { data: 'BASE64_BYTES', format: 'mp3' } }
{ type: 'input_video', video_url: 'https://example.com/test.mp4', mime_type: 'video/mp4' }
```

`input_video` is treated as compatibility sugar for providers such as OpenRouter and is mapped to Gemini as file data. OpenAI official SDK types do not currently expose `input_video`.

## Provider Mapping

Gemini via `google` or `vertex-ai`:

- `input_file.file.url` maps to Gemini `fileData.fileUri`.
- `input_file.file.data` maps to Gemini `inlineData.data`.
- `image/*`, `audio/*`, `video/*`, and document MIME types are accepted when the source is HTTPS, GCS, or base64.
- `video_metadata` maps to Gemini `videoMetadata` when provided.

OpenAI:

- Image URL and base64 inputs are supported through the OpenAI-compatible image blocks.
- Chat Completions file input supports `file_data`, `file_id`, and `filename`.
- Responses file input supports `file_url`, but that is only available through the Responses endpoint.
- Video input is rejected before routing because OpenAI official SDK types do not expose a video input content block.

Anthropic:

- Image URL/base64 inputs map to Anthropic image blocks.
- PDF/text document URL/base64 inputs map to Anthropic document blocks.
- Audio and video inputs are rejected before routing.

Bedrock:

- Image, document, audio, and video blocks map to Bedrock Converse content blocks.
- Bedrock file sources must be base64 bytes or `s3://` locations.
- HTTPS file URLs are rejected before routing.
- Priorai does not download remote HTTPS files for Bedrock. That would require an explicit opt-in fetch layer because it changes timeout, size, cost, and security behavior.

OpenRouter:

- Image and video URL inputs are passed through in OpenRouter-compatible shape.
- Audio input is limited to base64 content.

## Routing Rule

Priorai performs a capability check before sending a request to a target. The check uses:

- Media kind: image, audio, video, document, or unknown.
- Source kind: HTTPS URL, GCS URL, S3 URL, base64, or file ID.
- Endpoint: chat completions, responses, or provider-specific endpoint.

Fallback and load balancing only use targets that can represent the requested input. For example, a `video/mp4` HTTPS URL can route to Gemini or OpenRouter, but will not fallback to OpenAI, Anthropic, or Bedrock.
