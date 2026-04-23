# Chainr - Unified LLM Gateway SDK

> A TypeScript/Node.js SDK for routing LLM requests across multiple providers with priority-based fallback and load balancing.

**Status**: 🟢 Phase 1 & 2 Complete — **184 tests passing** (2026-04-23 23:30)

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
│       ├── transformRequest.ts     # Provider request transform
│       ├── transformResponse.ts    # Provider response transform
│       ├── RetryHandler.ts         # Exponential backoff retry
│       └── strategies/
│           ├── FallbackStrategy.ts
│           ├── LoadBalanceStrategy.ts
│           ├── SingleStrategy.ts
│           └── index.ts
├── tests/
│   ├── setup.ts                    # Shared mock utilities
│   ├── unit/
│   │   ├── transformRequest.test.ts  (40 tests)
│   │   ├── transformResponse.test.ts (26 tests)
│   │   ├── RetryHandler.test.ts      (23 tests)
│   │   └── strategies/
│   │       ├── FallbackStrategy.test.ts  (12 tests)
│   │       ├── LoadBalanceStrategy.test.ts (9 tests)
│   │       └── SingleStrategy.test.ts     (13 tests)
│   └── integration/
│       └── Router.test.ts          (12 tests)
├── docs/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

---

## 2. Feature Specification

### 2.1 Core Features (Phase 1 & 2 Complete ✅)

#### F1: Priority-based Fallback ✅

**Behavior**:
1. Try provider 1 with api_key
2. On 429/5xx error, retry with exponential backoff
3. If retries exhausted, try provider 2
4. Continue until success or all providers exhausted
5. Return error from last attempt

#### F2: Weighted Load Balancing ✅

**Behavior**:
1. Calculate cumulative weights (normalize missing weights to 1)
2. Generate random value within total weight
3. Select provider based on weight ranges
4. Single attempt (no auto-fallback on failure)

#### F3: Single Strategy ✅

Uses a single provider without fallback.

#### F4: Retry Logic ✅

- Configurable retry attempts per target or global
- Exponential backoff: `delay = 100ms * 2^attempt`
- Max retry timeout: 60 seconds
- Retryable status codes: [429, 500, 502, 503, 504]
- Non-retryable: 400, 401, 404 (fail immediately)

### 2.2 Provider Support (10 Providers ✅)

| Provider | Status | Transform |
|----------|--------|-----------|
| OpenAI | ✅ | Direct passthrough |
| Anthropic | ✅ | OpenAI → Anthropic Messages API |
| Google Vertex AI | ✅ | OpenAI → Vertex REST API |
| OpenRouter | ✅ | OpenAI-compatible passthrough |
| Together AI | ✅ | OpenAI-compatible passthrough |
| Perplexity AI | ✅ | OpenAI-compatible passthrough |
| Groq | ✅ | OpenAI-compatible passthrough |
| DeepSeek | ✅ | OpenAI-compatible passthrough + thinking mode |
| Mistral AI | ✅ | OpenAI-compatible passthrough |
| Cohere | ✅ | OpenAI-compatible passthrough + reasoning_effort |

### 2.3 Error Handling

| Scenario | Behavior |
|----------|----------|
| 429 Rate Limited | Retry with backoff, then fallback (fallback mode) |
| 500/502/503/504 | Retry with backoff, then fallback |
| 401 Unauthorized | Fail immediately |
| 400 Bad Request | Fail immediately |
| Network error | Retry with backoff, then next provider |

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

**Git Commit**: `8f414fb`

### Phase 2: Testing & Validation 🟢 COMPLETE

**Completed** (2026-04-23):
- [x] vitest.config.ts with TypeScript and coverage settings
- [x] tests/setup.ts with shared mock utilities
- [x] transformRequest.test.ts (40 tests) - all 4 providers
- [x] transformResponse.test.ts (26 tests) - success/error paths
- [x] RetryHandler.test.ts (23 tests) - retry logic
- [x] FallbackStrategy.test.ts (12 tests)
- [x] LoadBalanceStrategy.test.ts (9 tests)
- [x] SingleStrategy.test.ts (13 tests)
- [x] Router.test.ts (12 tests) - full pipeline
- [x] All 135 tests pass
- [x] TypeScript 0 errors
- [x] Build succeeds

**Bugs Fixed**:
1. `transformResponse.ts` - status 200 with error body now correctly returns ErrorResponse
2. `RetryHandler.ts` - HTTP errors now properly set lastError before retry loop

**Git Commit**: `09fae26`

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
      apiKey: 'sk-xxx',
      retry: { attempts: 2, onStatusCodes: [429, 503] }
    },
    {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY
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

### Test Coverage (184 tests ✅)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| transformRequest.test.ts | 77 | 10 providers + filterParams + system extraction |
| transformResponse.test.ts | 26 | success/error paths, all providers |
| RetryHandler.test.ts | 23 | retry logic, exponential backoff |
| FallbackStrategy.test.ts | 12 | fallback behavior |
| LoadBalanceStrategy.test.ts | 9 | weight-based selection |
| SingleStrategy.test.ts | 13 | single target usage |
| Router.test.ts | 12 | full pipeline integration |
| real-http.test.ts | 12 | real HTTP integration tests |

**Total: 184 tests passing**

### Test Tools
- **vitest**: Test runner
- **vi.mock()**: HTTP mocking (fetch), strategy mocking
- **vi.spyOn()**: Math.random control for load balance tests

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

### Phase 1 Complete ✅
- [x] Project scaffolding complete
- [x] Chainr Router class implemented
- [x] All 3 strategies implemented
- [x] TypeScript 0 errors
- [x] Build success (ESM + CJS)
- [x] Git push to main

### Phase 2 Complete ✅ (2026-04-23 23:30)
- [x] All 184 tests passing
- [x] transformRequest coverage complete (10 providers)
- [x] transformResponse coverage complete
- [x] RetryHandler coverage complete
- [x] Strategy coverage complete
- [x] Router integration tests complete
- [x] 2 bugs fixed during testing
- [x] Added 6 new providers (Together AI, Perplexity, Groq, DeepSeek, Mistral AI, Cohere)
- [x] Git push to main

### Remaining
- [ ] Phase 3: Nested strategies
- [ ] Phase 4: Firebase Functions example deployed

---

## 8. License

MIT - See [LICENSE](./LICENSE)

Chainr is an independent implementation.