# Chainr - Unified LLM Gateway SDK

> A TypeScript/Node.js SDK for routing LLM requests across multiple providers with priority-based fallback and load balancing.

**Status**: 🔴 In Planning

---

## 1. Project Overview

### Problem Statement

When building LLM-powered applications, developers face:
- **Provider reliability**: Single provider outages cause application failures
- **Rate limits**: Individual API keys have strict TPM/RPM limits
- **Cost optimization**: Different providers have different pricing
- **Format fragmentation**: Each provider has its own API format (OpenAI, Anthropic, Google Vertex, etc.)

### Solution

Chainr is an embeddable TypeScript SDK that provides:
- **Fallback routing**: Automatic failover to next provider on failure
- **Load balancing**: Distribute traffic across multiple keys/accounts
- **Request/Response transformation**: Unified OpenAI-compatible interface
- **Zero external dependencies**: No required external services

### Target Users

- Firebase Cloud Functions developers (TypeScript)
- Node.js backend services needing multi-provider LLM routing
- Developers who want fallback without running a separate gateway service

---

## 2. Core Architecture

### Directory Structure

```
chainr/
├── src/
│   ├── providers/
│   │   ├── types.ts                    # Shared provider type definitions
│   │   ├── openai/
│   │   │   ├── api.ts                  # OpenAI API config (URL/headers/endpoint)
│   │   │   └── chatComplete.ts         # OpenAI → OpenAI request transform
│   │   ├── anthropic/
│   │   │   ├── api.ts                  # Anthropic API config
│   │   │   └── chatComplete.ts         # OpenAI → Anthropic request transform
│   │   ├── google-vertex-ai/
│   │   │   ├── api.ts                  # Vertex AI API config
│   │   │   └── chatComplete.ts         # OpenAI → Vertex request transform
│   │   └── openrouter/
│   │       ├── api.ts                  # OpenRouter API config
│   │       └── chatComplete.ts         # OpenAI → OpenRouter request transform
│   ├── core/
│   │   ├── Router.ts                   # Main router class
│   │   ├── strategies/
│   │   │   ├── FallbackStrategy.ts     # Fallback (sequential) strategy
│   │   │   ├── LoadBalanceStrategy.ts  # Weighted load balance strategy
│   │   │   └── index.ts               # Strategy exports
│   │   ├── transformRequest.ts         # Request body transformation
│   │   ├── transformResponse.ts        # Response body transformation
│   │   └── RetryHandler.ts            # Retry logic with exponential backoff
│   ├── utils/
│   │   └── index.ts
│   └── index.ts                        # SDK entry point
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   ├── README.md
│   └── PLAN/
│       └── DEVELOPMENT_PLAN.md
└── examples/
    └── firebase-functions/
        └── index.ts
```

---

## 3. Feature Specification

### 3.1 Core Features

#### F1: Priority-based Fallback (Primary)

**Description**: Sequential failover across providers based on priority order.

**Behavior**:
1. Try provider 1 with api_key_1
2. On 429/5xx error, try provider 2
3. Continue until success or all providers exhausted
4. Return error from last attempt

**Config Example**:
```typescript
const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    {
      provider: 'google-vertexai',
      vertex_project_id: 'my-project',
      vertex_region: 'us-central1',
      override_params: { model: 'gemini-2.0-flash' }
    },
    {
      provider: 'openrouter',
      api_key: 'sk-or-xxx',
      override_params: { model: 'google/gemini-2.0-flash' }
    },
    {
      provider: 'openai',
      api_key: 'sk-xxx-relay',
      base_url: 'https://api.relay.com/v1',
      override_params: { model: 'gpt-4o' }
    }
  ]
});
```

#### F2: Weighted Load Balancing

**Description**: Distribute requests across multiple providers based on weights.

**Behavior**:
1. Calculate cumulative weights
2. Generate random value within total weight
3. Select provider based on weight ranges
4. Single attempt (no auto-fallback on failure)

**Config Example**:
```typescript
const chainr = new Chainr({
  strategy: 'loadbalance',
  targets: [
    { provider: 'openai', api_key: 'key1', weight: 0.7 },
    { provider: 'openai', api_key: 'key2', weight: 0.3 }
  ]
});
```

#### F3: Nested Strategies

**Description**: Combine fallback and load balance in nested configurations.

**Config Example**:
```typescript
{
  strategy: 'fallback',
  targets: [
    {
      // Primary: Vertex with load balance across multiple keys
      strategy: 'loadbalance',
      targets: [
        { provider: 'google-vertexai', api_key: 'key1', weight: 0.5 },
        { provider: 'google-vertexai', api_key: 'key2', weight: 0.5 }
      ]
    },
    {
      // Fallback: OpenRouter with sequential fallback
      strategy: 'fallback',
      targets: [
        { provider: 'openrouter', api_key: 'key3' },
        { provider: 'openai', api_key: 'key4' }
      ]
    }
  ]
}
```

### 3.2 Provider Support (Phase 1)

| Provider | Status | API Style |
|----------|--------|-----------|
| OpenAI | ✅ Planned | OpenAI compatible |
| Anthropic | ✅ Planned | Messages API |
| Google Vertex AI | ✅ Planned | REST API |
| OpenRouter | ✅ Planned | OpenAI compatible |

### 3.3 Error Handling

| Scenario | Behavior |
|----------|----------|
| 429 Rate Limited | Try next provider (fallback) or retry (single) |
| 500/502/503/504 | Try next provider (fallback) |
| 401 Unauthorized | Fail immediately (no retry) |
| 400 Bad Request | Fail immediately (no retry) |
| Network timeout | Retry up to N times, then next provider |

### 3.4 Retry Logic

- Configurable retry attempts per target
- Exponential backoff: `delay = base * 2^attempt`
- Respect `Retry-After` header when present
- Max retry timeout: 60 seconds

---

## 4. Source Code Sourcing

### From Portkey AI Gateway (MIT Licensed)

We will extract and adapt the following components from [Portkey-AI/gateway](https://github.com/Portkey-AI/gateway):

#### A. Provider API Config (src/providers/*/api.ts)

| File | Purpose | Extraction |
|------|---------|------------|
| `src/providers/openai/api.ts` | BaseURL, headers, endpoint mapping | ✅ Copy |
| `src/providers/anthropic/api.ts` | BaseURL, X-API-Key header, /messages endpoint | ✅ Copy |
| `src/providers/google-vertex-ai/api.ts` | Complex project/location/endpoint mapping | ✅ Copy |
| `src/providers/openrouter/api.ts` | OpenAI-compatible with custom base_url | ✅ Copy |

#### B. Provider Config - Request Transform (src/providers/*/chatComplete.ts)

| File | Purpose | Extraction |
|------|---------|------------|
| `src/providers/openai/chatComplete.ts` | OpenAI → OpenAI passthrough | ✅ Copy |
| `src/providers/anthropic/chatComplete.ts` | OpenAI messages → Anthropic messages format | ✅ Copy |
| `src/providers/anthropic-base/utils/streamGenerator.ts` | Anthropic SSE → OpenAI SSE transform | ✅ Copy |

#### C. Core Routing Logic

| File | Purpose | Extraction |
|------|---------|------------|
| `src/handlers/handlerUtils.ts` lines 476-833 | `tryTargetsRecursively()` fallback/loadbalance | ⚠️ Adapt |
| `src/handlers/retryHandler.ts` | Retry with exponential backoff | ✅ Copy |
| `src/services/transformToProviderRequest.ts` | Request body transformation | ⚠️ Adapt |
| `src/handlers/responseHandlers.ts` | Response routing | ⚠️ Adapt |

#### D. Type Definitions

| File | Purpose | Extraction |
|------|---------|------------|
| `src/providers/types.ts` | ProviderAPIConfig, ProviderConfig interfaces | ✅ Copy |
| `src/types/requestBody.ts` | Options, Params, Targets, StrategyModes | ✅ Copy |

### Components NOT to Extract

- Hono middleware pipeline (coupled to Cloudflare Workers)
- Plugin system (guardrails, observability)
- Logging integration
- Virtual key management

---

## 5. Implementation Phases

### Phase 1: Core Foundation (Week 1-2)

**Goal**: Basic fallback routing with OpenAI and one transform

**Deliverables**:
- [ ] Project scaffolding (tsconfig, tsup, vitest)
- [ ] Type definitions (copied from Portkey)
- [ ] OpenAI provider (passthrough, no transform)
- [ ] Basic Router class with fallback strategy
- [ ] Simple retry handler
- [ ] Unit tests for core routing

**Files**:
```
src/
├── types.ts                    # Core types
├── providers/openai/api.ts    # OpenAI API config
├── core/Router.ts             # Main router
├── core/FallbackStrategy.ts   # Fallback logic
└── core/RetryHandler.ts       # Retry logic
```

### Phase 2: Multi-Provider Support (Week 2-3)

**Goal**: Support Anthropic and Google Vertex with request transforms

**Deliverables**:
- [ ] Anthropic provider with request transform
- [ ] Anthropic SSE stream transform
- [ ] Google Vertex provider with complex URL construction
- [ ] Response transformation layer
- [ ] Integration tests with mock providers

**Files**:
```
src/providers/anthropic/
├── api.ts
└── chatComplete.ts
src/providers/google-vertex-ai/
├── api.ts
└── chatComplete.ts
src/core/transformRequest.ts
src/core/transformResponse.ts
```

### Phase 3: Load Balancing & Advanced Features (Week 3-4)

**Goal**: Complete feature parity with Portkey fallback/loadbalance

**Deliverables**:
- [ ] LoadBalanceStrategy
- [ ] Nested strategy support
- [ ] Sticky sessions (optional)
- [ ] Request timeout handling
- [ ] Configuration validation

### Phase 4: Firebase Integration & Polish (Week 4-5)

**Goal**: Production-ready with Firebase example

**Deliverables**:
- [ ] OpenRouter provider
- [ ] Firebase Functions example
- [ ] Comprehensive README
- [ ] Performance benchmarks
- [ ] Error handling edge cases

---

## 6. API Design

### Main Entry Point

```typescript
import { Chainr } from 'chainr';

const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    {
      provider: 'google-vertexai',
      vertex_project_id: 'my-project',
      vertex_region: 'us-central1',
      retry: { attempts: 2, on_status_codes: [429, 503] }
    },
    {
      provider: 'anthropic',
      api_key: process.env.ANTHROPIC_API_KEY
    }
  ]
});

// Unified OpenAI-compatible call
const response = await chainr.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Direct Strategy Usage

```typescript
import { FallbackStrategy, LoadBalanceStrategy } from 'chainr/strategies';

const strategy = new FallbackStrategy([
  { provider: 'openai', api_key: 'key1' },
  { provider: 'openai', api_key: 'key2' }
]);

await strategy.execute(async (target) => {
  // Call target.provider with target.api_key
  return callLLM(target);
});
```

---

## 7. Testing Strategy

### Unit Tests
- Router initialization and validation
- Strategy selection logic
- Weight calculation for load balance
- Retry logic and backoff

### Integration Tests (with mocked providers)
- Fallback: Verify sequential attempts
- LoadBalance: Verify weight distribution
- Error propagation: Verify correct error returned
- Timeout handling

### Test Tools
- **vitest**: Test runner
- **msw**: Mock Service Worker for HTTP mocking (or nock)
- **@faker-js/faker**: Test data generation

---

## 8. Dependencies

### Production
- `typescript` (peer dependency)
- No external runtime dependencies (pure fetch-based)

### Development
- `vitest`: Testing
- `tsup`: Build (esbuild-based)
- `prettier`: Formatting
- `eslint`: Linting
- `@types/node`: Node.js types

---

## 9. Comparison with Alternatives

| Feature | Chainr | Portkey (Hosted) | LiteLLM (Python) | @khanglvm/llm-router |
|---------|--------|------------------|-------------------|---------------------|
| TypeScript SDK | ✅ | ❌ | ❌ | ❌ |
| Embeddable | ✅ | ❌ | ❌ | ❌ |
| Firebase Compatible | ✅ | ❌ | ❌ | ❌ |
| Fallback Strategy | ✅ | ✅ | ✅ | ✅ |
| Load Balance | ✅ | ✅ | ✅ | ✅ |
| Nested Strategies | ✅ | ✅ | ✅ | ✅ |
| Open Source | ✅ | ✅ (Gateway) | ✅ | ✅ |
| Self-hosted | ✅ | ❌ | ✅ | ❌ |
| No External Service | ✅ | ❌ | ❌ | ❌ |

---

## 10. Risks & Mitigations

### Risk 1: Portkey License Compatibility
- **Risk**: Modifying and distributing Portkey code requires maintaining MIT license
- **Mitigation**: Clearly attribute Portkey in source, maintain MIT license

### Risk 2: Maintenance Burden
- **Risk**: Adapting Portkey code creates ongoing maintenance
- **Mitigation**: Create clear adaptation layer, minimize modifications

### Risk 3: Provider API Changes
- **Risk**: Provider API changes break transforms
- **Mitigation**: Version locks on provider configs, test against real providers

---

## 11. Success Metrics

- [ ] Phase 1 tests passing
- [ ] Firebase Functions example working
- [ ] OpenAI passthrough latency < 5ms overhead
- [ ] Fallback switch < 100ms
- [ ] Zero runtime dependencies in bundle
