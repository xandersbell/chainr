# Chainr

> Unified LLM gateway SDK with priority-based fallback and load balancing for TypeScript/Node.js

**Status**: ✅ Phase 1 & 2 Complete — 158 tests passing, production ready

## Features

- **Priority-based Fallback**: Automatic failover across multiple LLM providers
- **Weighted Load Balancing**: Distribute traffic across providers based on weights
- **Zero External Dependencies**: Pure fetch-based, no runtime deps
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)
- **TypeScript First**: Full type safety, strict mode enabled
- **158 Unit Tests**: Comprehensive coverage of core functionality

## Supported Providers

| Provider | Status | API Style |
|----------|--------|-----------|
| OpenAI | ✅ | Direct passthrough |
| Anthropic | ✅ | Messages API |
| Google Vertex AI | ✅ | REST API |
| OpenRouter | ✅ | OpenAI-compatible |

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

## API Reference

### Chainr Config

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
}
```

## Architecture

```
src/
├── index.ts                    # SDK entry point
├── globals.ts                  # Provider constants (OPEN_AI, ANTHROPIC, etc.)
├── types/
│   └── requestBody.ts          # Type definitions (Params, Options, etc.)
└── core/
    ├── Router.ts               # Main Chainr class
    ├── types.ts                # Core types (ChatCompletionResponse, StrategyResult, etc.)
    ├── transformRequest.ts     # Provider request transform (4 providers)
    ├── transformResponse.ts    # Provider response transform (4 providers)
    ├── RetryHandler.ts         # Exponential backoff retry
    └── strategies/
        ├── FallbackStrategy.ts  # Priority-based failover
        ├── LoadBalanceStrategy.ts # Weighted load distribution
        ├── SingleStrategy.ts    # Single provider
        └── index.ts            # Strategy exports
```

## Testing

```bash
npm test          # Run all tests
npm run test:watch # Watch mode
```

**Test Coverage**: 158 tests across 8 test files

| Test File | Tests | Coverage |
|-----------|-------|----------|
| transformRequest.test.ts | 51 | 4 providers + alias + system extraction |
| transformResponse.test.ts | 26 | success/error paths |
| RetryHandler.test.ts | 23 | retry logic + backoff |
| FallbackStrategy.test.ts | 12 | fallback behavior |
| LoadBalanceStrategy.test.ts | 9 | weight selection |
| SingleStrategy.test.ts | 13 | single target |
| Router.test.ts | 12 | full pipeline |
| real-http.test.ts | 12 | real HTTP integration (optional) |

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

## License

MIT - See [LICENSE](./LICENSE)