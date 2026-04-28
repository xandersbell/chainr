Updated: 2026-04-29 02:10:01 EEST

# Multimodal Inputs

Priorai keeps the OpenAI-compatible chat interface as the common entry point, but multimodal inputs are not normalized into one private shape for every provider.

OpenAI and Azure OpenAI must receive native OpenAI content blocks. The Priorai `input_file` extension remains available for providers such as `google` and `vertex-ai` that need MIME-driven routing.

`google` and `vertex-ai` now have full Gemini-style multimodal chat input coverage in Priorai for image, audio, video, and document file parts.

## Priorai Extension Input Shape

Use `input_file` when the target provider family expects Priorai's MIME-driven routing layer, such as Gemini via `google` or `vertex-ai`.

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

## OpenAI And Azure OpenAI Native Shapes

OpenAI-compatible providers are strict:

- `chat.completions.create()` accepts native OpenAI `image_url`, `input_audio`, and `file` blocks.
- `responses.create()` accepts native OpenAI `input_image` and `input_file` blocks.
- Priorai does not rewrite `input_file` into OpenAI image or file blocks for `openai` or `azure-openai`.
- `file_id` is treated as a provider file reference only. It is not used to guess image semantics.
- Priorai currently rejects `input_audio` on `responses.create()` and keeps it out of the public `ResponseInputItem` union.
- Azure OpenAI `responses.create()` currently requires `apiVersion: 'v1'` because the standard `/openai/v1/responses` path is used.
- Azure OpenAI `responses.create()` accepts `input_image.image_url` as an HTTPS URL or a base64 data URL, but rejects `input_image.file_id`.

OpenAI chat example:

```ts
await priorai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: 'https://example.com/image.png',
            detail: 'high',
          },
        },
        {
          type: 'text',
          text: 'Describe this image.',
        },
      ],
    },
  ],
});
```

OpenAI chat audio example:

```ts
await priorai.chat.completions.create({
  model: 'gpt-4o-audio-preview',
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
});
```

OpenAI Responses example:

```ts
await priorai.responses.create({
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
        {
          type: 'input_text',
          text: 'Describe this image.',
        },
      ],
    },
  ],
});
```

Azure OpenAI Responses example:

```ts
await priorai.responses.create({
  model: 'gpt-4o',
  input: [
    {
      role: 'user',
      content: [
        {
          type: 'input_image',
          image_url: 'data:image/png;base64,AAAA',
          detail: 'high',
        },
      ],
    },
  ],
});
```

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
- `image_url` inputs map to Gemini image `fileData` or `inlineData`.
- OpenAI-style `input_audio` inputs map to Gemini audio `inlineData`.
- `input_video` and `video_url` inputs map to Gemini video `fileData` or `inlineData`.

In current code, `vertex-ai` multimodal chat input support includes:

| Input kind | Accepted forms | Vertex / Gemini mapping |
|------------|----------------|-------------------------|
| Image | `image_url`, `input_file` with `image/*` | `fileData` or `inlineData` |
| Audio | `input_audio`, `input_file` with `audio/*` | `inlineData` |
| Video | `input_video`, `video_url`, `input_file` with `video/*` | `fileData` or `inlineData` |
| Document | `input_file` with PDF/text/document MIME types | `fileData` or `inlineData` |

This is implemented in the Vertex chat transform layer and multimodal capability gate:

- `src/providers/google-vertex-ai/chatComplete.ts`
- `src/providers/google-vertex-ai/utils.ts`
- `src/core/multimodalCapabilities.ts`

OpenAI:

- Chat Completions must use native `image_url`, `input_audio`, and `file` blocks.
- Responses must use native `input_image` and `input_file` blocks.
- Priorai `input_file` extension is rejected for OpenAI and Azure OpenAI instead of being rewritten.
- Chat `file` content supports `file_data`, `file_id`, and `filename`.
- Responses `input_file` content supports `detail`, `file_data`, `file_id`, `file_url`, and `filename`.
- Chat `input_audio` content supports base64 audio with `wav` or `mp3` format.
- Responses `input_audio` is currently rejected by the Priorai adapter and is not part of the public `ResponseInputItem` union.
- Video input is rejected before routing because OpenAI official SDK types do not expose a video input content block.

Azure OpenAI:

- Follows the same native content-shape rules as OpenAI for Chat Completions, including `input_audio`.
- `responses.create()` uses `/openai/v1/responses` and requires `apiVersion: 'v1'`.
- `responses.create()` image input must use `input_image.image_url` with an HTTPS URL or a base64 data URL.
- Azure OpenAI `input_image.file_id` is not accepted in this adapter because the current Azure Responses guidance documents URL and data-URL image input, while file IDs are documented for `input_file` scenarios instead.
- Non-`v1` Azure API versions do not expose the standard Responses path in this adapter and will fail fast.

## Realtime Bootstrap

Priorai also exposes the OpenAI Realtime bootstrap HTTP endpoints:

- `priorai.realtime.sessions.create()`
- `priorai.realtime.clientSecrets.create()`
- `priorai.realtime.transcriptionSessions.create()`

These endpoints help create session configuration and ephemeral credentials for OpenAI Realtime clients. Priorai does not wrap the WebSocket or WebRTC transport runtime itself.

Current request-shape note:

- `priorai.realtime.sessions.create()` and `priorai.realtime.transcriptionSessions.create()` follow the current `/realtime/sessions` and `/realtime/transcription_sessions` bootstrap paths and send `OpenAI-Beta: assistants=v2`.
- `priorai.realtime.clientSecrets.create()` uses `/realtime/client_secrets` without that beta header in the current adapter.

Azure OpenAI Realtime transport bootstrapping is not exposed through these surfaces in the current adapter.

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

Fallback and load balancing only use targets that can represent the requested input and endpoint. For example, a `video/mp4` HTTPS URL can route to Gemini or OpenRouter, but will not fallback to OpenAI, Anthropic, or Bedrock.

If a strategy reaches a target that cannot support the requested OpenAI-native shape or endpoint, Priorai throws an explicit error instead of silently transforming the request into a different contract.
