# Chainr - Unified LLM Gateway SDK

> A TypeScript/Node.js SDK for routing LLM requests across multiple providers with priority-based fallback and load balancing.

**Status**: 🟢 Phase 1 Complete — Core implementation done (2026-04-23)

---

## 0. Business Requirements & Project Origin

### 0.1 Problem Statement

Building production LLM-powered applications exposes developers to four critical risks:

| Risk | Description | Impact |
|------|-------------|--------|
| **Provider Outage** | Single LLM provider experiences downtime | Application returns errors or fails completely |
| **Rate Limit Exhaustion** | Individual API keys have strict TPM/RPM limits | Requests throttled, users see degraded performance |
| **Cost Overrun** | Different providers have different pricing | Unpredictable or excessive API costs |
| **Vendor Lock-in** | Code tightly coupled to a single provider's API format | Painful migration if provider changes |

### 0.2 Business Requirements

**R1: Reliability — Automatic Failover**: When primary provider returns 429/5xx, automatically attempt next configured provider.

**R2: Scalability — Load Distribution**: Weight-based selection (70% to target A, 30% to target B).

**R3: Cost Optimization**: Route traffic to different providers based on pricing.

**R4: Unified API**: Single OpenAI-compatible interface regardless of underlying provider.

**R5: Zero-Operations Deployment**: No external gateway service, embed via npm package.

**R6: TypeScript-First**: Full type safety, no `any` leakage.

### 0.3 Target Users

| User Profile | Primary Use Case | How Chainr Helps |
|---|---|---|
| **Firebase Cloud Functions Developer** | Serverless LLM calls with high availability | Zero-dep embed, Node.js 18+ native |
| **Node.js Backend Service** | REST API backend calling multiple LLM providers | One SDK init, unified interface |
| **Cost-Sensitive Team** | Distribute traffic across cheap + expensive providers | Weighted load-balance |
| **Reliability-Critical App** | Cannot afford downtime from provider outages | Fallback chain |

### 0.4 Core Value Proposition

```
Instead of:
  if (openai.fail) try anthropic;
  if (anthropic.fail) try vertex;
  parse openaiResponse();
  parse anthropicResponse();
  parse vertexResponse();

Chainr delivers:
  const r = await chainr.chat.completions.create({...})
  // Transparent fallback + unified response format
```

### 0.5 Comparison with Alternatives

| Requirement | Chainr | Portkey (Hosted) | LiteLLM (Python) |
|-------------|--------|------------------|------------------|
| TypeScript SDK | ✅ | ❌ | ❌ |
| Embeddable | ✅ | ❌ | ❌ |
| Firebase compatible | ✅ | ❌ | ❌ |
| Zero external runtime deps | ✅ | ❌ | ❌ |
| Weighted load balance | ✅ | ✅ | ✅ |
| Nested strategies | ✅ | ✅ | ✅ |

---

## 1. Architecture Overview

### Current Directory Structure

```
chainr/
├── src/
│   ├── index.ts                    # SDK entry point
│   ├── globals.ts                  # Provider constants
│   ├── types/
│   │   └── requestBody.ts          # Type definitions
│   └── core/
│       ├── Router.ts               # Main Chainr class
│       ├── types.ts                # Core types
│       ├── transformRequest.ts      # Provider request transform
│       ├── transformResponse.ts    # Provider response transform
│       ├── RetryHandler.ts          # Exponential backoff retry
│       └── strategies/
│           ├── FallbackStrategy.ts
│           ├── LoadBalanceStrategy.ts
│           ├── SingleStrategy.ts
│           └── index.ts
├── tests/
├── docs/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## 2. Feature Specification

### 2.1 Core Features (Phase 1 Complete)

#### F1: Priority-based Fallback ✅

**Behavior**:
1. Try provider 1 with api_key
2. On 429/5xx error, try provider 2
3. Continue until success or all providers exhausted
4. Return error from last attempt

#### F2: Weighted Load Balancing ✅

**Behavior**:
1. Calculate cumulative weights
2. Generate random value within total weight
3. Select provider based on weight ranges
4. Single attempt (no auto-fallback on failure)

#### F3: Single Strategy ✅

Uses a single provider without fallback.

### 2.2 Provider Support

| Provider | Status | Transform |
|----------|--------|-----------|
| OpenAI | ✅ | Direct passthrough |
| Anthropic | ✅ | OpenAI → Anthropic Messages API |
| Google Vertex AI | ✅ | OpenAI → Vertex REST API |
| OpenRouter | ✅ | OpenAI-compatible passthrough |

### 2.3 Error Handling

| Scenario | Behavior |
|----------|----------|
| 429 Rate Limited | Try next provider (fallback) or retry (single) |
| 500/502/503/504 | Try next provider (fallback) |
| 401 Unauthorized | Fail immediately |
| Network timeout | Retry up to N times, then next provider |

### 2.4 Retry Logic

- Configurable retry attempts per target
- Exponential backoff: `delay = 100ms * 2^attempt`
- Max retry timeout: 60 seconds
- No external dependencies (pure fetch-based)

---

## 3. Implementation Phases

### Phase 1: Core Foundation 🟢 COMPLETE

**Completed**:
- [x] Project scaffolding (tsconfig, vitest, tsup, package.json)
- [x] Chainr Router class with `chat.completions.create()` API
- [x] FallbackStrategy implemented
- [x] LoadBalanceStrategy implemented
- [x] SingleStrategy implemented
- [x] RetryHandler with exponential backoff
- [x] transformRequest for 4 providers
- [x] transformResponse for 4 providers
- [x] TypeScript 0 errors
- [x] Build success (ESM + CJS)

**Status**: Git commit `8f414fb` pushed

### Phase 2: Testing & Validation ⬜ Not Started

**Goal**: Unit tests with mocked fetch, integration validation

**Deliverables**:
- [ ] Unit tests for FallbackStrategy
- [ ] Unit tests for LoadBalanceStrategy
- [ ] Unit tests for transformRequest
- [ ] Unit tests for transformResponse
- [ ] Integration test with mocked providers

### Phase 3: Advanced Features ⬜ Not Started

**Goal**: Nested strategies, conditional routing

**Deliverables**:
- [ ] Nested strategy support (fallback + loadbalance combined)
- [ ] Request timeout handling
- [ ] Configuration validation

### Phase 4: Firebase Integration ⬜ Not Started

**Goal**: Production-ready with Firebase example

**Deliverables**:
- [ ] Firebase Functions example
- [ ] Performance benchmarks
- [ ] Error handling edge cases

---

## 4. API Design

### Main Entry Point

```typescript
import { Chainr } from 'chainr';

const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    {
      provider: 'openai',
      api_key: 'sk-xxx',
      retry: { attempts: 2, onStatusCodes: [429, 503] }
    },
    {
      provider: 'anthropic',
      api_key: process.env.ANTHROPIC_API_KEY
    }
  ]
});

const response = await chainr.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Direct Strategy Usage

```typescript
import { FallbackStrategy, LoadBalanceStrategy, SingleStrategy } from 'chainr';

const strategy = new FallbackStrategy();
const result = await strategy.execute(targets, params, retryConfig);
```

---

## 5. Testing Strategy

### Unit Tests (Phase 2)
- Router initialization and validation
- Strategy selection logic
- Weight calculation for load balance
- Retry logic and backoff

### Integration Tests (Phase 2)
- Fallback: Verify sequential attempts
- LoadBalance: Verify weight distribution
- Error propagation: Verify correct error returned
- Timeout handling

### Test Tools
- **vitest**: Test runner
- **vi.mock()**: HTTP mocking (fetch)

---

## 6. Dependencies

### Production
- `typescript` (peer dependency)
- No external runtime dependencies (pure fetch-based)

### Development
- `vitest`: Testing
- `tsup`: Build (esbuild-based)
- `typescript`: Type checking

---

## 7. Success Metrics

### Phase 1 Complete (2026-04-23)
- [x] Project scaffolding complete
- [x] Chainr Router class implemented
- [x] All 3 strategies implemented
- [x] TypeScript 0 errors
- [x] Build success (ESM + CJS)
- [x] Git push to main

### Remaining
- [ ] Phase 2: Unit tests passing
- [ ] Phase 2: Integration tests passing
- [ ] Phase 3: LoadBalance + nested strategies working
- [ ] Phase 4: Firebase Functions example deployed

---

## 8. License

MIT - See [LICENSE](./LICENSE)

Chainr is an independent implementation inspired by Portkey AI Gateway (MIT License).