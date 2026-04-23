# Chainr

> Unified LLM gateway SDK with priority-based fallback and load balancing for TypeScript/Node.js

**Status**: ✅ Production Ready — 278 tests passing, 51 streaming providers

## Features

- **Priority-based Fallback**: Automatic failover across multiple LLM providers
- **Weighted Load Balancing**: Distribute traffic across providers based on weights
- **Zero External Dependencies**: Pure fetch-based, no runtime deps
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)
- **TypeScript First**: Full type safety, strict mode enabled
- **278 Unit Tests**: Comprehensive coverage of core functionality

## Supported Providers

### Streaming Providers (51 total)

Chainr supports streaming for 51 providers via OpenAI-compatible passthrough or dedicated transforms.

#### Core Providers (10)
| Provider | Status | API Style |
|---------|--------|----------|
| OpenAI | ✅ | Direct passthrough |
| Anthropic | ✅ | Messages API |
| Google Vertex AI | ✅ | REST API |
| OpenRouter | ✅ | OpenAI-compatible |
| Together AI | ✅ | OpenAI-compatible |
| Perplexity AI | ✅ | OpenAI-compatible |
| Groq | ✅ | OpenAI-compatible |
| DeepSeek | ✅ | OpenAI-compatible |
| Mistral AI | ✅ | OpenAI-compatible |
| Cohere | ✅ | OpenAI-compatible |

#### Azure Providers (2)
| Provider | Status | API Style |
|---------|--------|----------|
| Azure OpenAI | ✅ | API Key + Azure URL format |
| Azure AI Inference | ✅ | Foundry URL + Bearer token |

#### Chinese/Asian Providers (4)
| Provider | Status | API Style |
|---------|--------|----------|
| DashScope (Alibaba) | ✅ | OpenAI-compatible |
| Zhipu AI | ✅ | OpenAI-compatible |
| LingYi (01.AI) | ✅ | OpenAI-compatible |
| Moonshot | ✅ | OpenAI-compatible |

#### xAI & Specialized (1)
| Provider | Status | API Style |
|---------|--------|----------|
| x-ai (Grok) | ✅ | OpenAI-compatible |

#### Infrastructure Providers (6)
| Provider | Status | API Style |
|---------|--------|----------|
| AWS Lambda | ✅ | OpenAI-compatible |
| AWS Bedrock | ✅ | OpenAI-compatible |
| AWS SageMaker | ✅ | OpenAI-compatible |
| Google Cloud (Vertex) | ✅ | REST API |
| Oracle AI | ✅ | OpenAI-compatible |
| OVHcloud | ✅ | OpenAI-compatible |

#### GPU Cloud & AI Platforms (12)
| Provider | Status | API Style |
|---------|--------|----------|
| Hugging Face | ✅ | OpenAI-compatible |
| Anyscale | ✅ | OpenAI-compatible |
| Fireworks AI | ✅ | OpenAI-compatible |
| Workers AI (Cloudflare) | ✅ | OpenAI-compatible |
| DeepInfra | ✅ | OpenAI-compatible |
| Predibase | ✅ | OpenAI-compatible |
| SambaNova | ✅ | OpenAI-compatible |
| Cerebras | ✅ | OpenAI-compatible |
| Nebius | ✅ | OpenAI-compatible |
| Hyperbolic | ✅ | OpenAI-compatible |
| Modal Labs | ✅ | OpenAI-compatible |
| Replicate | ✅ | OpenAI-compatible |

#### Emerging & Specialized AI (16)
| Provider | Status | API Style |
|---------|--------|----------|
| 302.AI | ✅ | OpenAI-compatible |
| AI21 (Jamba) | ✅ | OpenAI-compatible |
| AI6 | ✅ | OpenAI-compatible |
| Bytez | ✅ | Space-separated streaming |
| CometAPI | ✅ | OpenAI-compatible |
| DeepBricks | ✅ | OpenAI-compatible |
| Featherless AI | ✅ | OpenAI-compatible |
| GitHub Models | ✅ | `/inference/chat/completions` |
| Inference Net | ✅ | OpenAI-compatible |
| IOIntelligence | ✅ | OpenAI-compatible |
| Kluster AI | ✅ | OpenAI-compatible |
| Lepton | ✅ | OpenAI-compatible |
| Lemonfox AI | ✅ | OpenAI-compatible |
| Matter AI | ✅ | OpenAI-compatible |
| NextBit | ✅ | OpenAI-compatible |
| Novita AI | ✅ | OpenAI-compatible |
| nScale | ✅ | OpenAI-compatible |
| Owl AI | ✅ | OpenAI-compatible |
| SiliconFlow | ✅ | OpenAI-compatible |
| Stability AI | ✅ | OpenAI-compatible |
| Triton | ✅ | OpenAI-compatible |
| Upstage (Solar) | ✅ | OpenAI-compatible |

#### Request Transform Only (Non-streaming compatible)
| Provider | Status | Notes |
|---------|--------|-------|
| Google AI (Gemini) | ✅ | REST API via Vertex |

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
    // Provider-specific options
    azureResourceName?: string;
    azureDeploymentId?: string;
    azureApiVersion?: string;
    vertexProjectId?: string;
    vertexRegion?: string;
  }>;
  retry?: { attempts: number; onStatusCodes: number[] };
}

type Provider =
  // Core (10)
  | 'openai' | 'anthropic' | 'vertex-ai' | 'openrouter'
  | 'together-ai' | 'perplexity' | 'groq' | 'deepseek'
  | 'mistral-ai' | 'cohere'
  // Azure (2)
  | 'azure-openai' | 'azure-ai'
  // Chinese/Asian (4)
  | 'dashscope' | 'zhipu' | 'lingyi' | 'moonshot'
  // xAI (1)
  | 'x-ai'
  // Infrastructure (6)
  | 'lambda' | 'bedrock' | 'sagemaker' | 'oracle' | 'ovhcloud'
  // GPU Cloud (12)
  | 'huggingface' | 'anyscale' | 'fireworks-ai' | 'workers-ai'
  | 'deepinfra' | 'predibase' | 'sambanova' | 'cerebras'
  | 'nebius' | 'hyperbolic' | 'modal' | 'replicate'
  // Emerging (16)
  | '302ai' | 'ai21' | 'ai6' | 'bytez' | 'cometapi'
  | 'deepbricks' | 'featherless-ai' | 'github' | 'inference-net'
  | 'iointelligence' | 'kluster-ai' | 'lepton' | 'lemonfox-ai'
  | 'matterai' | 'nextbit' | 'novita-ai' | 'nscale'
  | 'siliconflow' | 'stability-ai' | 'triton' | 'upstage';
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
├── globals.ts                  # Provider constants
├── types/
│   └── requestBody.ts        # Type definitions (Params, Options, etc.)
└── core/
    ├── Router.ts              # Main Chainr class
    ├── types.ts               # Core types
    ├── transformRequest.ts    # Provider request transform (13 providers)
    ├── transformResponse.ts   # Provider response transform
    ├── streamUtils.ts         # Streaming utilities (40+ providers)
    ├── types/
    │   └── streaming.ts       # Streaming types (51 providers)
    ├── sseParser.ts          # SSE parsing utilities
    ├── transformOpenAIStream.ts
    ├── transformAnthropicStream.ts
    ├── transformGoogleStream.ts
    ├── transformCohereStream.ts
    ├── transformBedrockStream.ts
    ├── transformBytezStream.ts
    ├── RetryHandler.ts        # Exponential backoff retry
    └── strategies/
        ├── FallbackStrategy.ts
        ├── LoadBalanceStrategy.ts
        ├── SingleStrategy.ts
        └── index.ts
```

## Testing

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

**Test Coverage**: 278 tests across 13 test files

| Test File | Tests | Coverage |
|-----------|-------|----------|
| transformRequest.test.ts | 67 | 13 providers + filters |
| transformResponse.test.ts | 26 | success/error paths |
| streaming/types.test.ts | 18 | streaming types + 51 providers |
| streaming/streamUtils.test.ts | 16 | split patterns |
| streaming/sseParser.test.ts | 14 | SSE parsing |
| streaming/transformOpenAIStream.test.ts | 16 | passthrough streaming |
| streaming/transformAnthropicStream.test.ts | 11 | Anthropic streaming |
| RetryHandler.test.ts | 23 | retry logic + backoff |
| FallbackStrategy.test.ts | 12 | fallback behavior |
| LoadBalanceStrategy.test.ts | 9 | weight selection |
| SingleStrategy.test.ts | 13 | single target |
| Router.test.ts + real-http.test.ts | 24 | integration |
| strategies/*.test.ts | 39 | strategy behaviors |

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

Chainr supports streaming via SSE (Server-Sent Events) for 51 providers:

- **OpenAI-compatible passthrough**: Most providers use standard OpenAI SSE format
- **Dedicated transforms**: Anthropic, Google, Cohere, Bedrock, Bytez have custom transforms
- **Split pattern detection**: Automatically handles different SSE delimiter patterns (`\n\n`, `\r\n\r\n`, `\n`, `\r\n`, ` `)

## License

MIT - See [LICENSE](./LICENSE)
