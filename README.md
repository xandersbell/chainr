# Chainr

> Unified LLM gateway SDK with priority-based fallback and load balancing for TypeScript/Node.js

**Status**: ✅ Phase 1 Complete — Core implementation done, ready for testing

## Features

- **Priority-based Fallback**: Automatic failover across multiple LLM providers
- **Weighted Load Balancing**: Distribute traffic across providers based on weights
- **Zero External Dependencies**: Pure fetch-based, no runtime deps
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)
- **TypeScript First**: Full type safety, strict mode enabled

## Supported Providers

| Provider | Status |
|----------|--------|
| OpenAI | ✅ |
| Anthropic | ✅ |
| Google Vertex AI | ✅ |
| OpenRouter | ✅ |

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
      api_key: process.env.OPENAI_API_KEY,
      override_params: { model: 'gpt-4o' }
    },
    {
      provider: 'anthropic',
      api_key: process.env.ANTHROPIC_API_KEY,
      override_params: { model: 'claude-3-5-sonnet-20241022' }
    },
    {
      provider: 'openrouter',
      api_key: process.env.OPENROUTER_API_KEY,
      override_params: { model: 'openrouter/auto' }
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
Tries targets in order, automatically fails over to next on error.

```typescript
const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    { provider: 'openai', api_key: 'primary-key', weight: 1 },
    { provider: 'openai', api_key: 'fallback-key', weight: 1 }
  ]
});
```

### Load Balance (Weighted)
Distributes requests based on weight values.

```typescript
const chainr = new Chainr({
  strategy: 'loadbalance',
  targets: [
    { provider: 'openai', api_key: 'key1', weight: 0.7 },
    { provider: 'openai', api_key: 'key2', weight: 0.3 }
  ]
});
```

### Single
Uses a single provider without fallback.

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [
    { provider: 'openai', api_key: 'my-key' }
  ]
});
```

## API Reference

### Chainr

```typescript
const chainr = new Chainr(config);
chainr.chat.completions.create(params);
```

### Config

```typescript
interface ChainrConfig {
  strategy: 'fallback' | 'loadbalance' | 'single';
  targets: Array<{
    provider: 'openai' | 'anthropic' | 'vertex-ai' | 'openrouter';
    apiKey?: string;
    weight?: number;
    retry?: { attempts: number; onStatusCodes: number[] };
    overrideParams?: Params;
  }>;
  retry?: { attempts: number; onStatusCodes: number[] };
}
```

## Architecture

```
src/
├── index.ts                 # SDK entry point
├── globals.ts              # Provider constants
├── types/
│   └── requestBody.ts       # Type definitions
└── core/
    ├── Router.ts           # Main Chainr class
    ├── types.ts            # Core types
    ├── transformRequest.ts # Provider request transform
    ├── transformResponse.ts# Provider response transform
    ├── RetryHandler.ts     # Exponential backoff retry
    └── strategies/
        ├── FallbackStrategy.ts
        ├── LoadBalanceStrategy.ts
        └── SingleStrategy.ts
```

## License

MIT - See [LICENSE](./LICENSE)