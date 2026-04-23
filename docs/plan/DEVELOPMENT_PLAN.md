# Chainr - Unified LLM Gateway SDK

> A TypeScript/Node.js SDK for routing LLM requests across multiple providers with priority-based fallback and load balancing.

**Status**: 🟡 Phase 1 In Progress — Core Foundation

---

## 0. Project Origin & Source Material

### Why This Project Exists

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
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)

### Target Users

- Firebase Cloud Functions developers (TypeScript)
- Node.js backend services needing multi-provider LLM routing
- Developers who want fallback without running a separate gateway service

### Source Code Source

> ⚠️ **Portkey AI Gateway (MIT License)** — Portkey's gateway is the primary source of truth for provider configs, transforms, and routing logic. Chainr adapts and extracts components from Portkey for use as an embeddable SDK.

**Portkey Repository**: `~/codebase/repos/portkey-ai-gateway`
- URL: https://github.com/Portkey-AI/gateway
- License: MIT (see [LICENSE_NOTICE](#license-notice))
- All copied/modified files retain their original MIT license

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

### Phase 1: Core Foundation ✅ In Progress

**Goal**: Project scaffolding + all Portkey source files copied

**Status**: ✅ Scaffolding complete | ✅ Portkey files copied | ⬜ Core Router unimplemented

**Deliverables**:
- [x] Project scaffolding (tsconfig, tsup, vitest, package.json)
- [x] Git repo initialized, GitHub remote configured
- [x] Portkey source files copied (46 files across providers, handlers, types, utils, errors, globals)
- [ ] Core Router class with fallback strategy
- [ ] Basic retry handler wrapper
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
```

### Phase 2: Multi-Provider Support

**Goal**: Support Anthropic and Google Vertex with full request/response transforms

**Deliverables**:
- [ ] Anthropic provider with request transform (chatComplete.ts)
- [ ] Anthropic SSE stream transform (streamGenerator.ts integration)
- [ ] Google Vertex provider with complex URL construction
- [ ] Response transformation layer (responseHandlers.ts adaptation)
- [ ] Integration tests with mock providers

### Phase 3: Load Balancing & Advanced Features

**Goal**: Complete feature parity with Portkey fallback/loadbalance

**Deliverables**:
- [ ] LoadBalanceStrategy with weighted random selection
- [ ] Nested strategy support (fallback + loadbalance combined)
- [ ] Sticky sessions (optional)
- [ ] Request timeout handling
- [ ] Configuration validation

### Phase 4: Firebase Integration & Polish

**Goal**: Production-ready with Firebase example

**Deliverables**:
- [ ] OpenRouter provider (already copied, needs integration)
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
