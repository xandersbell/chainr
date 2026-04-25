# Priorai

> Unified LLM gateway SDK with priority-based fallback and weighted load balancing for TypeScript/Node.js

**Status**: 🟢 All Portkey 2.0 sync complete — 250 tests passing, 0 TS errors, 71 providers via registry

## Features

- **Priority-based Fallback**: Automatic failover across multiple LLM providers
- **Weighted Load Balancing**: Distribute traffic across providers based on weights
- **Provider Registry**: 71 providers via Portkey-aligned ProviderConfig architecture
- **Multi-API Support**: Chat completions, embeddings, image generation, audio transcription, speech synthesis, translation, 3D generation
- **Streaming**: SSE-based streaming with provider-specific transform pipelines
- **Config Validation**: Validates targets, provider, timeout, retry at construction
- **Request Timeout**: Configurable timeout for all fetch paths via `config.timeout`
- **Minimal Dependencies**: Only AWS SDK for Bedrock signing, everything else is pure fetch
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)
- **TypeScript First**: Full type safety, strict mode, 0 TS errors

## Installation

```bash
npm install priorai
```

## Quick Start

```typescript
import { Priorai } from 'priorai';

const priorai = new Priorai({
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
      overrideParams: { model: 'claude-sonnet-4-5-20250514' }
    }
  ]
});

const response = await priorai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Supported Providers (71)

All providers use the Portkey-aligned ProviderConfig registry (`src/providers/`). Each provider directory contains its own `api.ts` (URL/headers), `chatComplete.ts` (param mapping + response transform), and optional endpoint configs (embed, image, audio, etc.).

### Chat Completion Providers

| Provider | Streaming | Notes |
|----------|-----------|-------|
| OpenAI | ✅ | Direct passthrough |
| Anthropic | ✅ | Messages API, output_config, strict tools, thinking support |
| Google AI | ✅ | Gemini REST API, thinking (2.5/3.0+), thought signature |
| Google Vertex AI | ✅ | REST API, thinking (2.5/3.0+), thought signature |
| Azure OpenAI | ✅ | Azure URL format |
| Azure AI Inference | ✅ | Foundry URL |
| GitHub Models | ✅ | `/inference/chat` |
| AWS Bedrock | ✅ | SigV4 signing via @smithy, Converse API |
| Cohere | ✅ | Dedicated stream transform |
| Groq | ✅ | OpenAI-compatible |
| DeepSeek | ✅ | OpenAI-compatible, thinking support |
| Mistral AI | ✅ | OpenAI-compatible |
| Together AI | ✅ | OpenAI-compatible |
| OpenRouter | ✅ | OpenAI-compatible |
| Perplexity AI | ✅ | OpenAI-compatible |
| Fireworks AI | ✅ | OpenAI-compatible |
| Hugging Face | ✅ | OpenAI-compatible |
| Databricks | ✅ | OpenAI-compatible, workspace-based URL |
| Latitude | ✅ | OpenAI-compatible, developer→system role mapping |

And 52 more OpenAI-compatible providers including: DashScope, Zhipu, LingYi, Moonshot, x-ai, Lambda, SageMaker, Oracle, OVHcloud, Anyscale, Workers AI, DeepInfra, Predibase, SambaNova, Cerebras, Nebius, Hyperbolic, Modal, Replicate, SiliconFlow, LemonFox AI, DeepBricks, Featherless AI, Lepton, Novita AI, NCompass, 302.AI, AI21, Bytez, CometAPI, Inference Net, IOIntelligence, Kluster AI, Matter AI, NextBit, Stability AI, Triton, Upstage, AI Badgr, Cortex, Krutrim, Ollama, Palm, Reka AI, Z-AI, MonsterAPI, Nomic, Jina, Voyage, Meshy, Tripo3D, Segmind.

### Embeddings Providers (29)

| Provider | API |
|----------|-----|
| OpenAI | `api.openai.com/v1/embeddings` |
| Cohere | `api.cohere.ai/v2/embed` |
| Google AI | `generativelanguage.googleapis.com` |
| Google Vertex AI | `aiplatform.googleapis.com` |
| Azure OpenAI | Azure Embeddings |
| Azure AI Inference | Foundry Embeddings |
| AWS Bedrock | Bedrock Runtime |
| Mistral AI | `api.mistral.ai/v1/embeddings` |
| Together AI | `api.together.ai/v1/embeddings` |
| Fireworks AI | `api.fireworks.ai/v1/embeddings` |
| Workers AI | Cloudflare Workers AI |
| SiliconFlow | `api.siliconflow.cn/v1/embeddings` |
| AI21 | `api.ai21.com/v1/embeddings` |
| Anyscale | `api.endpoints.anyscale.com/v1/embeddings` |
| Nomic | `api.nomic.ai` |
| Jina | `api.jina.ai` |
| Voyage | `api.voyageai.com` |
| Databricks | Workspace embeddings |

And more: DashScope, Zhipu, Nebius, Ollama, Palm, Cortex, CometAPI, IOIntelligence, Kluster AI, Upstage, x-ai.

### Image Generation Providers (14)

| Provider | API |
|----------|-----|
| OpenAI DALL-E | `api.openai.com/v1/images/generations` |
| Azure OpenAI | Azure Image Generation |
| Azure AI Inference | Foundry Image Generation |
| AWS Bedrock | Bedrock Runtime |
| Google Vertex AI | `aiplatform.googleapis.com` |
| Segmind | `api.segmind.com` |
| Recraft AI | `api.recraft.ai` |
| Stability AI | `api.stability.ai` |
| Workers AI | Cloudflare Workers AI |
| SiliconFlow | `api.siliconflow.cn` |
| LemonFox AI | `api.lemonfox.ai` |
| DeepBricks | `api.deepbricks.io` |
| Hyperbolic | `api.hyperbolic.ai` |
| Fireworks AI | `api.fireworks.ai` |

### Audio / Speech / Translation / 3D

| Capability | Providers |
|------------|-----------|
| Audio Transcription | OpenAI Whisper, Groq, LemonFox AI, Lepton, Azure OpenAI |
| Speech Synthesis | OpenAI TTS, Azure OpenAI |
| Translation | OpenAI, LemonFox AI, Azure OpenAI |
| 3D Generation | Meshy, Tripo 3D |

## Strategies

### Fallback (Priority-based)
Tries targets in order, automatically fails over to next on error (429/5xx).

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  targets: [
    { provider: 'openai', apiKey: 'primary-key' },
    { provider: 'anthropic', apiKey: 'fallback-key' }
  ]
});
```

### Load Balance (Weighted)
Distributes requests based on weight values.

```typescript
const priorai = new Priorai({
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
const priorai = new Priorai({
  strategy: 'single',
  targets: [{ provider: 'openai', apiKey: 'my-key' }]
});
```

## Per-Target Configuration

Each target is independently configured — `apiKey`, `customHost`, and all provider-specific options are per-target, not global. This means you can mix providers, keys, and base URLs freely within a single strategy:

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  targets: [
    {
      provider: 'openai',
      apiKey: 'sk-primary-key',
      customHost: 'https://my-proxy.com/v1/chat/completions',
      overrideParams: { model: 'gpt-4o' }
    },
    {
      provider: 'openai',
      apiKey: 'sk-backup-key',
      // no customHost → uses default api.openai.com
      overrideParams: { model: 'gpt-4o-mini' }
    },
    {
      provider: 'anthropic',
      apiKey: 'ant-fallback-key',
      overrideParams: { model: 'claude-sonnet-4-5-20250514' }
    }
  ]
});
```

All fields from `TargetConfig` are passed through to the provider's `getBaseURL()` and `headers()` functions, so provider-specific options like `awsRegion`, `vertexProjectId`, `databricksWorkspace`, `azureResourceName`, etc. all work at the target level.

## Provider Configuration Examples

### AWS Bedrock

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [{
    provider: 'bedrock',
    awsAccessKeyId: 'AKIA...',
    awsSecretAccessKey: '...',
    awsSessionToken: '...', // optional
    awsRegion: 'us-east-1',
    overrideParams: { model: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0' }
  }]
});
```

### Azure OpenAI

```typescript
const priorai = new Priorai({
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

### Google Vertex AI

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [{
    provider: 'vertex-ai',
    vertexProjectId: 'your-project',
    vertexRegion: 'us-central1',
    apiKey: 'your-access-token',
    overrideParams: { model: 'gemini-2.5-pro' }
  }]
});
```

### Databricks

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [{
    provider: 'databricks',
    apiKey: 'your-databricks-token',
    databricksWorkspace: 'your-workspace',
    overrideParams: { model: 'databricks-meta-llama-3-1-70b-instruct' }
  }]
});
```

### Custom Host

```typescript
const priorai = new Priorai({
  strategy: 'single',
  targets: [{
    provider: 'openai',
    customHost: 'https://your-proxy.com/v1/chat/completions',
    apiKey: 'your-api-key'
  }]
});
```

## Architecture

```
src/
├── index.ts                    # SDK entry point
├── globals.ts                  # Provider constants
├── types/
│   └── requestBody.ts         # Type definitions (Params, Options)
├── providers/                  # 71 provider directories (Portkey-aligned)
│   ├── index.ts               # Static provider registry
│   ├── types.ts               # ProviderConfig / ProviderAPIConfig types
│   ├── utils.ts               # Provider utilities
│   ├── open-ai-base/          # Shared OpenAI-compatible base
│   ├── anthropic-base/        # Shared Anthropic base
│   ├── openai/                # api.ts + chatComplete.ts + embed.ts + ...
│   ├── anthropic/
│   ├── bedrock/               # Includes AWS SigV4 signing
│   ├── google-vertex-ai/
│   └── ... (71 total)
└── core/
    ├── Router.ts              # Main Priorai class
    ├── types.ts               # Core types
    ├── providerRequest.ts     # buildProviderRequest + transformProviderResponse
    ├── RetryHandler.ts        # Exponential backoff retry
    ├── streamUtils.ts         # SSE split patterns
    ├── sseParser.ts           # SSE parsing
    ├── transform*Stream.ts    # 6 streaming transforms
    └── strategies/
        ├── FallbackStrategy.ts
        ├── LoadBalanceStrategy.ts
        └── SingleStrategy.ts
```

### Request Flow

```
Priorai.chat.completions.create(params)
  → Strategy.execute(targets, params)
    → buildProviderRequest(params, provider, target, endpoint)
      → Providers[provider].api.getBaseURL()     // URL
      → Providers[provider].api.getEndpoint()     // endpoint path
      → Providers[provider].api.headers()         // headers
      → transformUsingProviderConfig(config, params) // body
    → fetch(url, { headers, body })
    → transformProviderResponse(response, provider, endpoint)
      → Providers[provider].responseTransforms[endpoint]()
```

## Timeout Configuration

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  targets: [...],
  timeout: 15000, // 15 seconds for all requests
});
```

Default: 30000ms (30s). Applied to all fetch paths including chat, embeddings, images, audio, speech, and translation.

## Retry Configuration

```typescript
const priorai = new Priorai({
  strategy: 'fallback',
  retry: { attempts: 3, onStatusCodes: [429, 500, 502, 503, 504] },
  targets: [...]
});
```

Default: 3 attempts, exponential backoff (100ms × 2^attempt), max 60s.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 429 Rate Limited | Retry with backoff, then fallback |
| 500/502/503/504 | Retry with backoff, then fallback |
| 401 Unauthorized | Fail immediately |

## Testing

```bash
npm test           # Run all tests (250 tests)
npm run test:watch # Watch mode
```

## Dependencies

### Production
- `@smithy/signature-v4`: AWS SigV4 signing (Bedrock/SageMaker)
- `@aws-crypto/sha256-js`: SHA256 hashing (@smithy dependency)

### Development
- `vitest`: Testing
- `tsup`: Build (esbuild-based, ESM + CJS)
- `typescript`: Type checking
- `biome`: Linting + formatting

## License

MIT - See [LICENSE](./LICENSE)
