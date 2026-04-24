# Chainr

> Unified LLM gateway SDK with priority-based fallback and weighted load balancing for TypeScript/Node.js

**Status**: 🟢 Production Ready — 362 tests passing, 16 dedicated transforms + 52 OpenAI-compatible providers

## Features

- **Priority-based Fallback**: Automatic failover across multiple LLM providers
- **Weighted Load Balancing**: Distribute traffic across providers based on weights
- **Zero External Dependencies**: Pure fetch-based, no runtime deps
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)
- **TypeScript First**: Full type safety, strict mode enabled
- **362 Unit Tests**: Comprehensive coverage of core functionality
- **Multi-API Support**: Chat completions, embeddings, image generation, audio transcription, speech synthesis, translation

## Supported Providers

### Chat Completion Providers

Chainr supports two categories of chat completion providers:

#### 1. Dedicated Transforms (16 providers)
These providers have custom request/response transforms:

| Provider | Transform | Streaming | API Style |
|----------|-----------|-----------|-----------|
| OpenAI | ✅ Full | ✅ Passthrough | Direct passthrough |
| Anthropic | ✅ Full | ✅ Dedicated | Messages API |
| Google Vertex AI | ✅ Full | ✅ Dedicated | REST API |
| OpenRouter | ✅ Full | ✅ Passthrough | OpenAI-compatible |
| Together AI | ✅ Full | ✅ Passthrough | OpenAI-compatible |
| Perplexity AI | ✅ Full | ✅ Passthrough | OpenAI-compatible |
| Groq | ✅ Full | ✅ Passthrough | OpenAI-compatible |
| DeepSeek | ✅ Full | ✅ Passthrough | OpenAI-compatible |
| Mistral AI | ✅ Full | ✅ Passthrough | OpenAI-compatible |
| Cohere | ✅ Full | ✅ Dedicated | Cohere API |
| Azure OpenAI | ✅ Full | ✅ Passthrough | Azure URL format |
| Azure AI Inference | ✅ Full | ✅ Passthrough | Foundry URL |
| GitHub Models | ✅ Full | ✅ Passthrough | `/inference/chat` |
| Nomic (Embeddings) | ✅ Full | — | Embeddings API |
| Jina (Embeddings) | ✅ Full | — | Embeddings API |
| Voyage (Embeddings) | ✅ Full | — | Embeddings API |

#### 2. OpenAI-Compatible Providers (52 total)
> These providers use standard OpenAI API format. They fall through to the default case in `transformRequest()` which uses the `OPENAI_COMPATIBLE_URLS` mapping table. Streaming uses standard OpenAI SSE passthrough.

**Core (10):**
| Provider | Notes |
|----------|-------|
| DashScope (Alibaba) | Chinese |
| Zhipu AI | Chinese |
| LingYi (01.AI) | Chinese |
| Moonshot | Chinese |
| x-ai (Grok) | — |
| Lambda | AWS |
| Bedrock | AWS (uses different auth) |
| SageMaker | AWS (custom endpoints) |
| Oracle AI | — |
| OVHcloud | — |

**GPU Cloud & AI Platforms (21):**
| Provider | Notes |
|----------|-------|
| Hugging Face | — |
| Anyscale | — |
| Fireworks AI | — |
| Workers AI (Cloudflare) | — |
| DeepInfra | — |
| Predibase | — |
| SambaNova | — |
| Cerebras | — |
| Nebius | — |
| Hyperbolic | — |
| Modal Labs | — |
| Replicate | — |
| SiliconFlow | Chinese |
| Lemonfox AI | — |
| DeepBricks | — |
| Featherless AI | — |
| Inference Net | — |
| IOIntelligence | — |
| Kluster AI | — |
| Matter AI | — |
| NextBit | — |

**Emerging & Specialized (21):**
| Provider | Notes |
|----------|-------|
| 302.AI | — |
| AI21 (Jamba) | — |
| AI6 | — |
| Bytez | Space-separated streaming |
| CometAPI | — |
| DeepBricks | — |
| Featherless AI | — |
| Lepton | — |
| Novita AI | — |
| nScale | — |
| Owl AI | — |
| Stability AI | — |
| Triton | — |
| Upstage (Solar) | — |
| AI Badgr | — |
| Cortex | — |
| Krutrim | — |
| NCompass | — |
| Ollama | Local |
| Palm | — |
| Reka AI | — |

### Image Generation Providers

| Provider | Status | API |
|----------|--------|-----|
| Segmind | ✅ | `api.segmind.com/v1/image/sdxl` |
| Recraft AI | ✅ | `api.recraft.ai/v1/images/generation` |
| Stability AI | ✅ | `api.stability.ai/v1/generation/*/text-to-image` |

### 3D Generation Providers

| Provider | Status | API |
|----------|--------|-----|
| Meshy | ✅ | `api.meshy.ai/v1/text-to-3d` or `/image-to-3d` |
| Tripo 3D | ✅ | `api.tripo3d.ai/v1/tasks` |

### Audio Transcription Providers

| Provider | Status | API |
|----------|--------|-----|
| OpenAI Whisper | ✅ | `api.openai.com/v1/audio/transcriptions` |
| LemonFox AI | ✅ | `api.lemonfox.ai/v1/audio/transcriptions` |
| Lepton | ✅ | `api.lepton.ai/v1/audio/transcriptions` |

### Speech Synthesis Providers

| Provider | Status | API |
|----------|--------|-----|
| OpenAI TTS | ✅ | `api.openai.com/v1/audio/speech` |

### Translation Providers

| Provider | Status | API |
|----------|--------|-----|
| OpenAI | ✅ | `api.openai.com/v1/audio/translations` |
| LemonFox AI | ✅ | `api.lemonfox.ai/v1/audio/translations` |

### Additional Embeddings Providers

| Provider | Status | API |
|----------|--------|-----|
| OpenAI Embeddings | ✅ | `api.openai.com/v1/embeddings` |
| Cohere | ✅ | `api.cohere.ai/v2/embed` |
| Workers AI | ✅ | Cloudflare Workers AI |
| SiliconFlow | ✅ | `api.siliconflow.cn/v1/embeddings` |
| AI21 | ✅ | `api.ai21.com/v1/embeddings` |
| Mistral AI | ✅ | `api.mistral.ai/v1/embeddings` |
| Together AI | ✅ | `api.together.ai/v1/embeddings` |
| Anyscale | ✅ | `api.endpoints.anyscale.com/v1/embeddings` |
| Fireworks AI | ✅ | `api.fireworks.ai/v1/embeddings` |

### Additional Image Generation Providers

| Provider | Status | API |
|----------|--------|-----|
| OpenAI DALL-E | ✅ | `api.openai.com/v1/images/generations` |
| LemonFox AI | ✅ | `api.lemonfox.ai/v1/images/generations` |
| Workers AI | ✅ | Cloudflare Workers AI |
| nscale | ✅ | `api.nscale.io` |
| DeepBricks | ✅ | `api.deepbricks.io/v1/images/generations` |
| Hyperbolic | ✅ | `api.hyperbolic.ai/v1/images/generations` |

## Installation

```bash
npm install chainr
```

## Quick Start

```typescript
import { Chainr } from 'chainr';

const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      overrideParams: { model: 'gpt-4o' }
    },
    {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      overrideParams: { model: 'claude-3-5-sonnet-20241022' }
    }
  ]
});

const response = await chainr.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Embeddings

```typescript
const chainr = new Chainr({
  strategy: 'fallback',
  embedTargets: [
    { provider: 'openai', apiKey: 'primary-key' },
    { provider: 'cohere', apiKey: 'fallback-key' }
  ]
});

const embedding = await chainr.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Hello, world!'
});
```

### Image Generation

```typescript
const chainr = new Chainr({
  strategy: 'fallback',
  imageTargets: [
    { provider: 'openai', apiKey: 'primary-key' },
    { provider: 'lemonfox-ai', apiKey: 'fallback-key' }
  ]
});

const image = await chainr.images.generate({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset over the ocean'
});
```

### Audio Transcription

```typescript
const chainr = new Chainr({
  strategy: 'single',
  audioTargets: [
    { provider: 'openai', apiKey: 'my-key' }
  ]
});

const transcription = await chainr.audio.transcribe({
  file: fs.readFileSync('audio.mp3'),
  model: 'whisper-1',
  language: 'en'
});
```

### Speech Synthesis

```typescript
const chainr = new Chainr({
  strategy: 'single',
  speechTargets: [
    { provider: 'openai', apiKey: 'my-key' }
  ]
});

const speech = await chainr.speech.create({
  model: 'tts-1',
  input: 'Hello, world!',
  voice: 'alloy'
});
```

## Strategies

### Fallback (Priority-based)
Tries targets in order, automatically fails over to next on error (429/5xx).

```typescript
const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    { provider: 'openai', apiKey: 'primary-key' },
    { provider: 'openai', apiKey: 'fallback-key' }
  ]
});
```

### Load Balance (Weighted)
Distributes requests based on weight values (0-1).

```typescript
const chainr = new Chainr({
  strategy: 'loadbalance',
  targets: [
    { provider: 'openai', apiKey: 'key1', weight: 0.7 },
    { provider: 'openai', apiKey: 'key2', weight: 0.3 }
  ]
});
```

### Single
Uses a single provider without fallback.

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [
    { provider: 'openai', apiKey: 'my-key' }
  ]
});
```

## Provider Configuration Examples

### Azure OpenAI

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [{
    provider: 'azure-openai',
    apiKey: 'your-azure-key',
    azureResourceName: 'your-resource',
    azureDeploymentId: 'gpt-4o',
    azureApiVersion: '2024-06-01'
  }]
});
```

### GitHub Models

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [{
    provider: 'github',
    apiKey: 'github-pat-with-models-scope'
  }]
});
```

### x-ai (Grok)

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [{
    provider: 'x-ai',
    apiKey: 'xai-api-key'
  }]
});
```

### AWS Bedrock

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [{
    provider: 'bedrock',
    apiKey: 'aws-access-key',
    // Additional AWS config...
  }]
});
```

### Custom Host (for OpenAI-compatible providers)

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [{
    provider: 'custom-provider',
    customHost: 'https://your-custom-provider.com/v1/chat/completions',
    apiKey: 'your-api-key'
  }]
});
```

## API Reference

### Chainr Config

```typescript
interface ChainrConfig {
  strategy: 'fallback' | 'loadbalance' | 'single';
  targets: Array<{
    provider: Provider;
    apiKey?: string;
    weight?: number;
    retry?: { attempts: number; onStatusCodes: number[] };
    overrideParams?: Params;
    customHost?: string;       // Custom URL for OpenAI-compatible providers
    urlToFetch?: string;       // Alternative to customHost
  }>;
  retry?: { attempts: number; onStatusCodes: number[] };
}

type Provider =
  // Dedicated transforms (16)
  | 'openai' | 'anthropic' | 'vertex-ai' | 'openrouter'
  | 'together-ai' | 'perplexity' | 'groq' | 'deepseek'
  | 'mistral-ai' | 'cohere' | 'azure-openai' | 'azure-ai'
  | 'github' | 'nomic' | 'jina' | 'voyage'
  // OpenAI-compatible (52) - see OPENAI_COMPATIBLE_PROVIDERS
  | 'dashscope' | 'zhipu' | 'lingyi' | 'moonshot' | 'x-ai'
  | 'lambda' | 'bedrock' | 'sagemaker' | 'oracle' | 'ovhcloud'
  | 'huggingface' | 'anyscale' | 'fireworks-ai' | 'workers-ai'
  | 'deepinfra' | 'predibase' | 'sambanova' | 'cerebras' | 'nebius'
  | 'hyperbolic' | 'modal' | 'replicate' | 'siliconflow' | 'lemonfox-ai'
  | 'deepbricks' | 'featherless-ai' | 'lepton' | 'novita-ai' | 'nscale'
  | '302ai' | 'ai21' | 'ai6' | 'bytez' | 'cometapi' | 'featherless-ai'
  | 'inference-net' | 'iointelligence' | 'kluster-ai' | 'matterai'
  | 'nextbit' | 'stability-ai' | 'triton' | 'upstage' | 'aibadgr'
  | 'cortex' | 'krutrim' | 'ncompass' | 'ollama' | 'palm' | 'reka-ai';
```

### Chat Completion Params

```typescript
interface Params {
  model?: string;
  messages?: Message[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: Tool[];
  tool_choice?: ToolChoice;
  // Provider-specific
  thinking?: { type: 'enabled'; budget_tokens: number }; // DeepSeek
  reasoning_effort?: string; // Cohere
}
```

## Architecture

```
src/
├── index.ts                    # SDK entry point
├── globals.ts                  # Provider constants + OPENAI_COMPATIBLE_URLS
├── types/
│   └── requestBody.ts        # Type definitions (Params, Options, etc.)
└── core/
    ├── Router.ts              # Main Chainr class
    ├── types.ts               # Core types
    ├── transformRequest.ts    # Request transforms (16 dedicated + default case)
    ├── transformResponse.ts   # Response transforms
    ├── RetryHandler.ts        # Exponential backoff retry
    ├── streamUtils.ts         # Split patterns for SSE
    ├── sseParser.ts           # SSE parsing utilities
    ├── types/streaming.ts     # OPENAI_COMPATIBLE_PROVIDERS (52 providers)
    ├── transformOpenAIStream.ts
    ├── transformAnthropicStream.ts
    ├── transformGoogleStream.ts
    ├── transformCohereStream.ts
    ├── transformBedrockStream.ts
    ├── transformBytezStream.ts
    └── strategies/
        ├── FallbackStrategy.ts
        ├── LoadBalanceStrategy.ts
        └── SingleStrategy.ts
```

## Testing

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

**Test Coverage**: 362 tests across 13 test files

| Test File | Tests | Coverage |
|-----------|-------|----------|
| transformRequest.test.ts | 162 | 16 dedicated + audio/speech/embed/image/translate transforms |
| transformResponse.test.ts | 35 | success/error + embeddings/image/3D |
| streaming/types.test.ts | 26 | OPENAI_COMPATIBLE_PROVIDERS |
| streaming/streamUtils.test.ts | 16 | split patterns |
| streaming/sseParser.test.ts | 14 | SSE parsing |
| streaming/transformOpenAIStream.test.ts | 16 | passthrough streaming |
| streaming/transformAnthropicStream.test.ts | 11 | Anthropic streaming |
| RetryHandler.test.ts | 23 | retry logic + backoff |
| strategies/*.test.ts | 34 | strategy behaviors |
| Router.test.ts + real-http.test.ts | 24 | integration |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 429 Rate Limited | Retry with backoff, then fallback to next provider |
| 500/502/503/504 | Retry with backoff, then fallback |
| 401 Unauthorized | Fail immediately |
| Network timeout | Retry up to N times (default: 3) |

## Retry Configuration

```typescript
const chainr = new Chainr({
  strategy: 'fallback',
  retry: { attempts: 3, onStatusCodes: [429, 500, 502, 503, 504] },
  targets: [...]
});
```

Default retry config: 3 attempts, exponential backoff (100ms * 2^attempt), max 60s.

## Streaming Support

- **OpenAI-compatible passthrough**: 52 providers use standard OpenAI SSE format
- **Dedicated transforms**: Anthropic, Google, Cohere, Bedrock, Bytez have custom transforms
- **Split pattern detection**: Automatically handles different SSE delimiter patterns

## License

MIT - See [LICENSE](./LICENSE)
