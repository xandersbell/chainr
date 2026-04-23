# Chainr - Unified LLM Gateway SDK

> A TypeScript/Node.js SDK for routing LLM requests across multiple providers with priority-based fallback and load balancing.

**Status**: 🔴 Phase 1 Blocked — Core Router unimplemented

---

## 0. Business Requirements & Project Origin

### 0.1 Problem Statement

Building production LLM-powered applications exposes developers to four critical risks:

| Risk | Description | Impact |
|------|-------------|--------|
| **Provider Outage** | Single LLM provider (OpenAI, Anthropic, etc.) experiences downtime | Application returns errors or fails completely |
| **Rate Limit Exhaustion** | Individual API keys have strict TPM/RPM limits | Requests throttled, users see degraded performance |
| **Cost Overrun** | Different providers have different pricing; no way to route traffic to cheaper options | Unpredictable or excessive API costs |
| **Vendor Lock-in** | Code tightly coupled to a single provider's API format | Painful migration if provider changes pricing or reliability |

Additionally, each LLM provider uses a different request/response format:
- **OpenAI**: `messages[]`, `gpt-4o`, streaming SSE
- **Anthropic**: `messages[]` with `anthropic_version`, `/messages` endpoint, different streaming format
- **Google Vertex AI**: REST API with JWT auth, different model naming (`gemini-2.0-flash`)
- **OpenRouter**: OpenAI-compatible but with provider-specific model prefixes (`google/gemini-2.0-flash`)

Switching providers currently requires code changes across the entire application.

### 0.2 Business Requirements

Chainr must satisfy the following requirements:

**R1: Reliability — Automatic Failover**
- When the primary LLM provider returns 429 (rate limited) or 5xx (server error), the system must automatically attempt the next configured provider
- The failover must be transparent to the application — same API call, different underlying provider
- Retry logic must support configurable retry attempts and status code filters

**R2: Scalability — Load Distribution**
- Support distributing requests across multiple API keys from the same or different providers
- Weight-based selection: `weight: 0.7` means 70% of requests go to that target
- Single attempt per request in load-balance mode (no automatic fallback on failure)

**R3: Cost Optimization**
- Allow routing traffic to different providers based on pricing
- Support nested strategies: e.g., load-balance within a single provider (multiple keys) + fallback across providers

**R4: Unified API — Provider Abstraction**
- Developers use a single, OpenAI-compatible interface regardless of which provider handles the request
- Request/response transformation is handled internally
- Currently supported: OpenAI, Anthropic, Google Vertex AI, OpenRouter

**R5: Zero-Operations Deployment**
- No external gateway service to deploy or maintain
- Embed directly in application code via npm package
- Must work in Firebase Cloud Functions (Node.js 18+) without additional configuration

**R6: TypeScript-First**
- Written in TypeScript with full type safety
- No runtime type coercion or `any` leakage
- Strict mode enabled in tsconfig

### 0.3 Target Users

| User Profile | Primary Use Case | How Chainr Helps |
|---|---|---|
| **Firebase Cloud Functions Developer** | Serverless LLM calls with high availability requirements | Zero-dependency embed, Node.js 18+ native, no extra infra |
| **Node.js Backend Service** | REST API backend calling multiple LLM providers | One SDK init, unified `.chat.completions.create()` interface |
| **Cost-Sensitive Team** | Distribute traffic across cheap + expensive providers | Weighted load-balance routes traffic to cost-optimal provider |
| **Reliability-Critical App** | Cannot afford downtime from provider outages | Fallback chain: Primary → Secondary → Tertiary provider |

### 0.4 Core Value Proposition

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Instead of:                                             │
│    if (openai.fail) try anthropic;                      │
│    if (anthropic.fail) try vertex;                       │
│    parse openaiResponse();                               │
│    parse anthropicResponse();                            │
│    parse vertexResponse();                               │
│                                                          │
│  Chainr delivers:                                        │
│    const r = await chainr.chat.completions.create({...})│
│    // Transparent fallback + unified response format      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 0.5 Comparison with Alternatives

| Requirement | Chainr | Portkey (Hosted) | LiteLLM (Python) |
|-------------|--------|------------------|------------------|
| Deploy separately | ❌ No | ✅ Yes (cloud service) | ✅ Yes (Python service) |
| TypeScript SDK | ✅ Yes | ❌ HTTP API only | ❌ Python only |
| Firebase compatible | ✅ Yes | ❌ No | ❌ No |
| Data passes through third party | ❌ No | ✅ Yes | ⚠️ Through your deployment |
| Zero external runtime deps | ✅ Yes | ❌ Depends on Portkey | ❌ Depends on LiteLLM service |
| Weighted load balance | ✅ Yes | ✅ Yes | ✅ Yes |
| Nested strategies | ✅ Yes | ✅ Yes | ✅ Yes |

> 📊 Full feature matrix comparison (including @khanglvm/llm-router): see [Section 8 - Comparison with Alternatives](#8-comparison-with-alternatives)

### 0.6 Source Code Origin

> ⚠️ **Portkey AI Gateway (MIT License)** — Portkey's gateway is the primary source of truth for provider configs, transforms, and routing logic. Chainr adapts and extracts components from Portkey for use as an embeddable SDK.

**Portkey Repository**: `~/codebase/repos/portkey-ai-gateway`
- URL: https://github.com/Portkey-AI/gateway
- License: MIT (see [LICENSE_NOTICE](#license-notice))
- All copied/modified files retain their original MIT license
- Chainr is an independent implementation, not a fork or wrapper

---

## 1. Architecture Overview

### Directory Structure

```
chainr/
├── src/
│   ├── providers/                          # Provider API configs & transforms (copied from Portkey)
│   │   ├── types.ts                       # Shared provider type definitions
│   │   ├── index.ts                       # Provider registry
│   │   ├── utils.ts                       # Shared provider utilities
│   │   ├── finishReasonMap.ts             # Finish reason mapping
│   │   ├── utils/
│   │   │   └── finishReasonMap.ts        # (duplicate, consolidate later)
│   │   ├── openai/                        # OpenAI-compatible providers
│   │   │   ├── api.ts                    # BaseURL, headers, endpoints
│   │   │   ├── chatComplete.ts           # OpenAI → OpenAI passthrough
│   │   │   └── utils.ts
│   │   ├── anthropic/                     # Anthropic Messages API
│   │   │   ├── api.ts
│   │   │   └── chatComplete.ts           # OpenAI → Anthropic transform
│   │   ├── anthropic-base/               # Anthropic shared base utilities
│   │   │   ├── constants.ts
│   │   │   ├── messages.ts
│   │   │   ├── types.ts
│   │   │   └── utils/
│   │   │       └── streamGenerator.ts    # Anthropic SSE → OpenAI SSE transform
│   │   ├── google-vertex-ai/             # Google Vertex AI
│   │   │   ├── api.ts
│   │   │   ├── chatComplete.ts           # OpenAI → Vertex transform
│   │   │   └── utils.ts                  # JWT auth, parameter transforms
│   │   ├── openrouter/                   # OpenRouter (OpenAI-compatible)
│   │   │   ├── api.ts
│   │   │   ├── chatComplete.ts
│   │   │   └── utils.ts
│   │   └── open-ai-base/                 # Shared OpenAI-style provider utilities
│   │       ├── constants.ts
│   │       ├── createModelResponse.ts
│   │       ├── helpers.ts
│   │       └── index.ts
│   ├── handlers/                          # Request/response handlers (copied from Portkey)
│   │   ├── handlerUtils.ts               # tryTargetsRecursively, selectProviderByWeight
│   │   ├── retryHandler.ts               # Retry with exponential backoff
│   │   ├── streamHandler.ts              # SSE stream reading/handling
│   │   ├── responseHandlers.ts           # Response routing by content-type
│   │   └── services/
│   │       ├── requestContext.ts         # Request context management
│   │       └── providerContext.ts       # Provider header construction
│   ├── services/
│   │   └── conditionalRouter.ts          # Conditional routing logic
│   ├── types/                             # Type definitions (copied from Portkey)
│   │   ├── requestBody.ts               # Options, Params, Targets, StrategyModes
│   │   ├── messagesResponse.ts
│   │   ├── modelResponses.ts
│   │   ├── responseBody.ts
│   │   ├── shared.ts
│   │   ├── MessagesRequest.ts
│   │   └── MessagesStreamResponse.ts
│   ├── utils/                             # Utilities (copied from Portkey)
│   │   ├── misc.ts
│   │   ├── CryptoUtils.ts
│   │   └── env.ts
│   ├── middlewares/hooks/                 # Hook system types (copied from Portkey)
│   │   ├── globals.ts
│   │   └── types.ts
│   ├── errors/                            # Error classes (copied from Portkey)
│   │   ├── RouterError.ts
│   │   └── GatewayError.ts
│   ├── globals.ts                         # Constants (copied from Portkey)
│   ├── core/                              # Chainr core — TO BE IMPLEMENTED
│   │   ├── Router.ts                     # Main router class
│   │   ├── strategies/
│   │   │   ├── FallbackStrategy.ts
│   │   │   ├── LoadBalanceStrategy.ts
│   │   │   └── index.ts
│   │   ├── transformRequest.ts            # OpenAI → provider request transform
│   │   ├── transformResponse.ts           # Provider → OpenAI response transform
│   │   └── RetryHandler.ts               # Retry logic wrapper
│   └── index.ts                          # SDK entry point
├── tests/
│   ├── unit/
│   └── integration/
├── examples/
│   └── firebase-functions/
│       └── index.ts
├── docs/
│   └── PLAN/
│       └── DEVELOPMENT_PLAN.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── .gitignore
```

---

## 2. Feature Specification

### 2.1 Core Features

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
      strategy: 'loadbalance',
      targets: [
        { provider: 'google-vertexai', api_key: 'key1', weight: 0.5 },
        { provider: 'google-vertexai', api_key: 'key2', weight: 0.5 }
      ]
    },
    {
      strategy: 'fallback',
      targets: [
        { provider: 'openrouter', api_key: 'key3' },
        { provider: 'openai', api_key: 'key4' }
      ]
    }
  ]
}
```

### 2.2 Provider Support

| Provider | Status | API Style | Files (from Portkey) |
|----------|--------|-----------|----------------------|
| OpenAI | ✅ Copied | OpenAI compatible | `openai/api.ts`, `openai/chatComplete.ts` |
| Anthropic | ✅ Copied | Messages API | `anthropic/api.ts`, `anthropic/chatComplete.ts` |
| Google Vertex AI | ✅ Copied | REST API | `google-vertex-ai/api.ts`, `google-vertex-ai/chatComplete.ts` |
| OpenRouter | ✅ Copied | OpenAI compatible | `openrouter/api.ts`, `openrouter/chatComplete.ts` |
| OpenAI-like base | ✅ Copied | OpenAI compatible | `open-ai-base/*` (shared helpers) |

### 2.3 Error Handling

| Scenario | Behavior |
|----------|----------|
| 429 Rate Limited | Try next provider (fallback) or retry (single) |
| 500/502/503/504 | Try next provider (fallback) |
| 401 Unauthorized | Fail immediately (no retry) |
| 400 Bad Request | Fail immediately (no retry) |
| Network timeout | Retry up to N times, then next provider |

### 2.4 Retry Logic

- Configurable retry attempts per target
- Exponential backoff: `delay = base * 2^attempt`
- Respect `Retry-After` header when present
- Max retry timeout: 60 seconds

---

## 3. Source Code Sourcing (Portkey AI Gateway)

> All files are from `~/codebase/repos/portkey-ai-gateway` (MIT License)

### A. Provider API Configs ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/providers/openai/api.ts` | `src/providers/openai/api.ts` | BaseURL, headers, endpoint mapping |
| `src/providers/anthropic/api.ts` | `src/providers/anthropic/api.ts` | BaseURL, X-API-Key header, /messages endpoint |
| `src/providers/google-vertex-ai/api.ts` | `src/providers/google-vertex-ai/api.ts` | Project/location/endpoint mapping, JWT auth |
| `src/providers/openrouter/api.ts` | `src/providers/openrouter/api.ts` | OpenAI-compatible with custom base_url |
| `src/providers/open-ai-base/constants.ts` | `src/providers/open-ai-base/constants.ts` | OpenAI base constants |
| `src/providers/open-ai-base/helpers.ts` | `src/providers/open-ai-base/helpers.ts` | OpenAI base helpers |

### B. Provider Request Transforms ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/providers/openai/chatComplete.ts` | `src/providers/openai/chatComplete.ts` | OpenAI → OpenAI passthrough |
| `src/providers/anthropic/chatComplete.ts` | `src/providers/anthropic/chatComplete.ts` | OpenAI → Anthropic messages format transform |
| `src/providers/google-vertex-ai/chatComplete.ts` | `src/providers/google-vertex-ai/chatComplete.ts` | OpenAI → Vertex format transform |
| `src/providers/openrouter/chatComplete.ts` | `src/providers/openrouter/chatComplete.ts` | OpenAI → OpenRouter format + reasoning params |
| `src/providers/openrouter/utils.ts` | `src/providers/openrouter/utils.ts` | OpenRouter-specific utilities |

### C. Provider Response Transforms ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/providers/openai/utils.ts` | `src/providers/openai/utils.ts` | OpenAI error response transform |
| `src/providers/anthropic-base/utils/streamGenerator.ts` | `src/providers/anthropic-base/utils/streamGenerator.ts` | Anthropic SSE → OpenAI SSE transform |
| `src/providers/google-vertex-ai/utils.ts` | `src/providers/google-vertex-ai/utils.ts` | Vertex logprobs transform, tool parameter dereferencing |
| `src/providers/finishReasonMap.ts` | `src/providers/finishReasonMap.ts` | Provider-specific finish reason → OpenAI standard |
| `src/providers/utils/finishReasonMap.ts` | `src/providers/utils/finishReasonMap.ts` | (duplicate, consolidate later) |

### D. Core Handler Infrastructure ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/handlers/handlerUtils.ts` | `src/handlers/handlerUtils.ts` | `tryTargetsRecursively()` (fallback), `selectProviderByWeight()` (loadbalance), `constructRequest()`, `tryPost()` |
| `src/handlers/retryHandler.ts` | `src/handlers/retryHandler.ts` | `retryRequest()` — exponential backoff, Retry-After header |
| `src/handlers/streamHandler.ts` | `src/handlers/streamHandler.ts` | `readStream()` (SSE), `handleStreamingMode()` |
| `src/handlers/responseHandlers.ts` | `src/handlers/responseHandlers.ts` | `responseHandler()` — routes to transformer by content-type |
| `src/handlers/services/requestContext.ts` | `src/handlers/services/requestContext.ts` | Request context management |
| `src/handlers/services/providerContext.ts` | `src/handlers/services/providerContext.ts` | Provider header construction |

### E. Type Definitions ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/providers/types.ts` | `src/providers/types.ts` | `ProviderAPIConfig`, `ProviderConfig`, `endpointStrings` |
| `src/providers/index.ts` | `src/providers/index.ts` | Provider configs registry |
| `src/providers/utils.ts` | `src/providers/utils.ts` | `generateErrorResponse`, `generateInvalidProviderResponseError` |
| `src/types/requestBody.ts` | `src/types/requestBody.ts` | `Options`, `Params`, `Targets`, `StrategyModes`, `RetrySettings`, `Tool`, `ToolCall` |
| `src/types/messagesResponse.ts` | `src/types/messagesResponse.ts` | Anthropic Messages API response types |
| `src/types/modelResponses.ts` | `src/types/modelResponses.ts` | Model response types |
| `src/types/responseBody.ts` | `src/types/responseBody.ts` | Generic response body types |
| `src/types/shared.ts` | `src/types/shared.ts` | Shared type utilities |
| `src/types/MessagesRequest.ts` | `src/types/MessagesRequest.ts` | Anthropic Messages API request |
| `src/types/MessagesStreamResponse.ts` | `src/types/MessagesStreamResponse.ts` | Anthropic stream response |
| `src/globals.ts` | `src/globals.ts` | `POWERED_BY`, `MAX_RETRY_LIMIT_MS`, `POSSIBLE_RETRY_STATUS_HEADERS`, provider constants |
| `src/middlewares/hooks/globals.ts` | `src/middlewares/hooks/globals.ts` | Hook-related constants |
| `src/middlewares/hooks/types.ts` | `src/middlewares/hooks/types.ts` | `HookType`, hook span types |

### F. Utilities & Services ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/utils/misc.ts` | `src/utils/misc.ts` | General utilities |
| `src/utils/CryptoUtils.ts` | `src/utils/CryptoUtils.ts` | Crypto utilities |
| `src/utils/env.ts` | `src/utils/env.ts` | Environment utilities |
| `src/services/conditionalRouter.ts` | `src/services/conditionalRouter.ts` | Conditional routing logic ($eq, $in, $regex, $and, $or) |

### G. Error Classes ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/errors/RouterError.ts` | `src/RouterError.ts` | Router-specific error class |
| `src/errors/GatewayError.ts` | `src/GatewayError.ts` | Gateway error class |

### H. Anthropic Base (Shared) ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/providers/anthropic-base/constants.ts` | `src/providers/anthropic-base/constants.ts` | Anthropic constants |
| `src/providers/anthropic-base/messages.ts` | `src/providers/anthropic-base/messages.ts` | Anthropic messages config |
| `src/providers/anthropic-base/types.ts` | `src/providers/anthropic-base/types.ts` | Anthropic base types |
| `src/providers/anthropic-base/utils/streamGenerator.ts` | `src/providers/anthropic-base/utils/streamGenerator.ts` | Stream generation utilities |

### I. OpenAI Base (Shared) ✅ Copied

| Source File | Dest File | Purpose |
|-------------|-----------|---------|
| `src/providers/open-ai-base/createModelResponse.ts` | `src/providers/open-ai-base/createModelResponse.ts` | Model response creation |
| `src/providers/open-ai-base/index.ts` | `src/providers/open-ai-base/index.ts` | OpenAI base index |

### Components NOT Copied (Intentionally Omitted)

- `src/handlers/chatCompletionsHandler.ts` — Hono HTTP handler, coupled to Cloudflare Workers
- `src/handlers/messagesHandler.ts` — Hono HTTP handler
- `src/middlewares/` (other than hooks) — Middleware pipeline, CF Workers specific
- `plugins/` — Plugin system (guardrails, observability)
- `src/providers/*/index.ts` (per-provider) — Re-exported by provider, not needed
- `src/types/inputList.ts` — Not needed for core functionality
- `src/types/embedRequestBody.ts` — Embeddings not in scope for Phase 1

---

## 4. Implementation Phases

### Phase 1: Core Foundation 🔴 Blocked

**Goal**: Project scaffolding + all Portkey source files copied + Core Router implemented

**Status**:
- ✅ Scaffolding complete
- ✅ Portkey source files copied (47 files, 0 TS errors)
- ❌ `tsup.config.ts` missing — build blocked
- ❌ Core Router unimplemented — **BLOCKING ALL**

**Deliverables**:
- [x] Project scaffolding (tsconfig, vitest, package.json)
- [x] Git repo initialized, GitHub remote configured
- [x] Portkey source files copied (47 files across providers, handlers, types, utils, errors, globals)
- [x] TypeScript diagnostics clean (0 errors)
- [ ] `tsup.config.ts` created
- [ ] `src/core/Router.ts` implemented
- [ ] `FallbackStrategy` implemented
- [ ] `LoadBalanceStrategy` implemented
- [ ] `transformRequest.ts` implemented
- [ ] `transformResponse.ts` implemented
- [ ] Unit tests for core routing

**Remaining Files to Implement**:
```
src/core/
├── Router.ts              # Main entry point
├── strategies/
│   ├── FallbackStrategy.ts
│   ├── LoadBalanceStrategy.ts
│   └── index.ts
├── transformRequest.ts    # OpenAI body → provider-specific body
├── transformResponse.ts   # Provider response → OpenAI body
└── RetryHandler.ts        # Retry logic wrapper

tsup.config.ts            # Build config (MISSING)
```

### Phase 2: Multi-Provider Support ⬜ Not Started

**Goal**: Support Anthropic and Google Vertex with full request/response transforms

**Note**: Provider files (chatComplete.ts, api.ts) are already copied from Portkey. Phase 2 focuses on integration into Router.

**Deliverables**:
- [ ] Anthropic provider integration (chatComplete.ts already copied)
- [ ] Anthropic SSE stream transform (streamGenerator.ts already copied)
- [ ] Google Vertex provider integration (chatComplete.ts already copied)
- [ ] Response transformation layer (responseHandlers.ts already copied)
- [ ] Integration tests with mock providers

### Phase 3: Load Balancing & Advanced Features ⬜ Not Started

**Goal**: Complete feature parity with Portkey fallback/loadbalance

**Deliverables**:
- [ ] LoadBalanceStrategy with weighted random selection
- [ ] Nested strategy support (fallback + loadbalance combined)
- [ ] Sticky sessions (optional)
- [ ] Request timeout handling
- [ ] Configuration validation

### Phase 4: Firebase Integration & Polish ⬜ Not Started

**Goal**: Production-ready with Firebase example

**Deliverables**:
- [ ] OpenRouter provider integration (files already copied)
- [ ] Firebase Functions example
- [ ] Comprehensive README
- [ ] Performance benchmarks
- [ ] Error handling edge cases

---

## 5. API Design

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
  return callLLM(target);
});
```

---

## 6. Testing Strategy

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
- **msw** or **nock**: HTTP mocking
- **@faker-js/faker**: Test data generation

---

## 7. Dependencies

### Production
- `typescript` (peer dependency)
- No external runtime dependencies (pure fetch-based)

### Development
- `vitest`: Testing
- `tsup`: Build (esbuild-based)
- `prettier`: Formatting
- `eslint`: Linting
- `@types/node`: Node.js types
- `async-retry`: Retry logic (used by retryHandler.ts — check if we bundle or inline)

---

## 8. Comparison with Alternatives

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

## 9. Risks & Mitigations

### Risk 1: Portkey License Compatibility
- **Risk**: Modifying and distributing Portkey code requires maintaining MIT license
- **Mitigation**: All copied files retain MIT license. LICENSE_NOTICE added to attribute source.

### Risk 2: Maintenance Burden
- **Risk**: Adapting Portkey code creates ongoing maintenance when Portkey updates
- **Mitigation**: Create clear adaptation layer, minimize modifications to copied files

### Risk 3: Provider API Changes
- **Risk**: Provider API changes break transforms
- **Mitigation**: Version locks on provider configs, test against real providers

### Risk 4: Hono/CF Workers Coupling
- **Risk**: Portkey handler code is tightly coupled to Hono and Cloudflare Workers
- **Mitigation**: Extract only the pure TypeScript logic (transforms, routing), discard HTTP layer

---

## 10. License Notice

> Portkey AI Gateway source code is used under the terms of the MIT License.
> Portkey AI Gateway is Copyright (c) 2023 Portkey AI, Inc. and available at https://github.com/Portkey-AI/gateway

```
MIT License

Copyright (c) 2023 Portkey AI, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 11. Success Metrics

### Current Baseline (as of 2026-04-23)
- [x] Project scaffolding complete
- [x] Portkey source files copied (47 files)
- [x] TypeScript diagnostics clean (0 errors)
- [ ] Phase 1: Router class + basic fallback implemented
- [ ] Phase 1: Unit tests passing
- [ ] Phase 2: Anthropic + Vertex transforms working end-to-end
- [ ] Phase 2: Integration tests passing
- [ ] Phase 3: LoadBalance + nested strategies working
- [ ] Phase 4: Firebase Functions example deployed
- [ ] Firebase Functions example working
- [ ] OpenAI passthrough latency < 5ms overhead
- [ ] Fallback switch < 100ms
- [ ] Zero runtime dependencies in bundle
