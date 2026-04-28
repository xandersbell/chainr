# Priorai

Updated: 2026-04-29 01:15:10 EEST

Embeddable TypeScript SDK for routing LLM requests across multiple providers through a mostly OpenAI-compatible interface.

> Built on the shoulders of [Portkey AI Gateway](https://github.com/Portkey-ai/gateway) — Priorai keeps the provider routing and transformation core, strips dashboard and hosted gateway concerns, and packages the result as an application-side SDK.

**Status**: Portkey 2.0 sync complete, 72 providers in the registry, strict TypeScript, test-covered.

## Why Priorai

- Use one SDK instead of wiring every provider separately.
- Route across providers with `single`, `fallback`, `loadbalance`, or `conditional` strategies.
- Keep an OpenAI-style calling surface for the common paths.
- Normalize structured output across OpenAI, Anthropic, Google, and Bedrock.
- Apply multimodal routing rules explicitly instead of silently sending incompatible payloads.
- Keep provider-specific config at the target level, not hidden in global state.

## Installation

```bash
npm install priorai
```

Node.js `>=18` is required.

## How It Works

You configure a routing strategy and one or more targets. Each target is a concrete provider configuration with its own credentials, model defaults, and provider-specific options. After that, you call Priorai through a familiar SDK surface such as `chat.completions.create()`.

## Quick Start

```typescript
import { Priorai } from 'priorai';

const priorai = new Priorai({
  strategy: 'fallback',
  targets: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      overrideParams: { model: 'gpt-4o-mini' },
    },
    {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      overrideParams: { model: 'claude-sonnet-4-5-20250514' },
    },
  ],
});

const response = await priorai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
});

console.log(response.provider);
console.log(response.choices[0].message.content);
```

## Core Usage

### Chat Completions

This is the main entry point for most applications.

```typescript
const response = await priorai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are concise.' },
    { role: 'user', content: 'What is 2 + 2?' },
  ],
});
```

### Streaming

```typescript
const stream = await priorai.chat.completions.create({
  model: 'gpt-4o-mini',
  stream: true,
  messages: [{ role: 'user', content: 'Stream a short answer.' }],
});
```

### Structured Output

Priorai accepts OpenAI-style `response_format.json_schema` and translates it to the native provider format when possible.

```typescript
const response = await priorai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Generate a profile for Alice.' }],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'Person',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name', 'age'],
      },
    },
  },
});

const person = JSON.parse(response.choices[0].message.content!);
```

### Other SDK Surfaces

The current public SDK includes these primary surfaces:

- `priorai.chat.completions.create()`
- `priorai.embeddings.create()`
- `priorai.images.generate()`
- `priorai.images.edit()`
- `priorai.audio.transcribe()`
- `priorai.audio.translate()`
- `priorai.speech.create()`
- `priorai.messages.create()`
- `priorai.messages.countTokens()`
- `priorai.responses.create()`

It also exposes management-oriented helpers for `files`, `batches`, and `fineTuning`.

## Strategies

### `single`

Always use one target.

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [{ provider: 'openai', apiKey: process.env.OPENAI_API_KEY }],
});
```

### `fallback`

Try targets in order. This is the default recommendation when reliability matters.

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  targets: [
    { provider: 'openai', apiKey: process.env.OPENAI_API_KEY },
    { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY },
  ],
});
```

### `loadbalance`

Distribute traffic by weight.

```typescript
const priorai = new Priorai({
  strategy: 'loadbalance',
  targets: [
    { provider: 'openai', apiKey: process.env.OPENAI_API_KEY, weight: 0.7 },
    { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, weight: 0.3 },
  ],
});
```

### `conditional`

Route by request properties using named targets.

```typescript
const priorai = new Priorai({
  strategy: 'conditional',
  targets: [
    {
      name: 'openai-target',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    },
    {
      name: 'anthropic-target',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  ],
  conditions: [
    {
      query: { 'params.model': { $regex: '^claude' } },
      then: 'anthropic-target',
    },
  ],
  conditionalDefault: 'openai-target',
});
```

## Target Configuration

Each target is independent. That means `apiKey`, `customHost`, `overrideParams`, retry settings, and provider-specific fields all live on the target that needs them.

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  targets: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      customHost: 'https://my-proxy.example/v1/chat/completions',
      overrideParams: { model: 'gpt-4o' },
    },
    {
      provider: 'vertex-ai',
      vertexProjectId: 'my-project',
      vertexRegion: 'us-central1',
      apiKey: process.env.GOOGLE_ACCESS_TOKEN,
      overrideParams: { model: 'gemini-2.5-pro' },
    },
  ],
});
```

Provider-specific options such as `awsRegion`, `vertexProjectId`, `databricksWorkspace`, `azureResourceName`, and similar fields are passed through at the target level.

You can also split targets by capability when needed:

- `embedTargets`
- `imageTargets`
- `audioTargets`
- `speechTargets`
- `messagesTargets`
- `responsesTargets`

## Supported Providers

Priorai currently registers 72 providers. In the README, the focus stays on the providers most teams evaluate first:

- OpenAI
- Anthropic
- Google AI
- Google Vertex AI
- Azure OpenAI
- Azure AI Inference
- AWS Bedrock
- OpenRouter

For the full and current registry list, see [docs/PROVIDERS.md](docs/PROVIDERS.md).

That document also tracks the broader capability breakdown, including:

- Embeddings
- Image generation
- Audio transcription
- Speech synthesis
- Audio translation
- 3D generation

## Multimodal Routing

Priorai keeps multimodal behavior explicit. It only routes a request to targets that can represent the input shape being sent.

Examples:

- A `vertex-ai` target can accept image, audio, video, and document inputs on chat completions through the Gemini content-part mapping.
- Image, audio, and video inputs can be passed as HTTPS URLs, `gs://` URLs, or base64 data for `google` and `vertex-ai`, as long as `mime_type` is available for routed file inputs.
- `openai` and `azure-openai` only accept native OpenAI multimodal shapes. Chat Completions must use `image_url` or `file`; Responses must use `input_image` or `input_file`.
- A `video/mp4` HTTPS URL can route to Gemini-compatible targets or compatible OpenRouter targets.
- The same request will not silently fall back to OpenAI, Anthropic, or Bedrock if the provider cannot represent that media format.
- If fallback or load balancing reaches a target that does not support the requested endpoint or native shape, Priorai throws a clear error instead of silently rewriting the payload.
- OpenAI Responses audio input is not exposed here because the current official Responses API path does not support `input_audio`.
- Bedrock media routing is stricter and expects base64 bytes or `s3://` sources for supported cases.

For the full input shape and compatibility rules, see [docs/MULTIMODAL_INPUTS.md](docs/MULTIMODAL_INPUTS.md).

## Provider Examples

### AWS Bedrock

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [
    {
      provider: 'bedrock',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsSessionToken: process.env.AWS_SESSION_TOKEN,
      awsRegion: 'us-east-1',
      overrideParams: {
        model: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0',
      },
    },
  ],
});
```

### Azure OpenAI

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [
    {
      provider: 'azure-openai',
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      azureResourceName: 'your-resource',
      azureDeploymentId: 'gpt-4o',
      azureApiVersion: '2024-06-01',
    },
  ],
});
```

### Google Vertex AI

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [
    {
      provider: 'vertex-ai',
      vertexProjectId: 'your-project',
      vertexRegion: 'us-central1',
      apiKey: process.env.GOOGLE_ACCESS_TOKEN,
      overrideParams: { model: 'gemini-2.5-pro' },
    },
  ],
});
```

## Examples

Runnable examples live in [`examples/`](./examples/) and are indexed in [examples/README.md](examples/README.md).

- `01-single-provider.ts`
- `02-fallback-strategy.ts`
- `03-loadbalance-strategy.ts`
- `04-vertex-ai-adc.ts`
- `05-bedrock-sigv4.ts`
- `06-streaming.ts`
- `07-conditional-strategy.ts`
- `08-structured-output.ts`

Run one with:

```bash
npx tsx examples/01-single-provider.ts
```

## Retry And Timeout

Global timeout:

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  timeout: 15000,
  targets: [...],
});
```

Global retry policy:

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  retry: {
    attempts: 3,
    onStatusCodes: [429, 500, 502, 503, 504],
  },
  targets: [...],
});
```

Default timeout is `30000ms`. Retry behavior uses exponential backoff and is intended for transient failures such as `429` and `5xx`.

## Development

```bash
npm test
npm run typecheck
npm run build
```

The repository also includes a pre-commit hook script at `pre-commit.sh` for local linting on staged files.

## License

MIT. See [LICENSE](./LICENSE).
