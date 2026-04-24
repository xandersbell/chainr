# Chainr - Unified LLM Gateway SDK

> A TypeScript/Node.js SDK for routing LLM requests across multiple providers with priority-based fallback and load balancing.

**Status**: 🟢 Phase 3B Complete — **209 tests passing**, 0 TS errors, nested strategies + retry-after (2026-04-24)

**Last Updated**: 2026-04-24 18:21 EEST — Phase 3B 完成，嵌套策略 + retry-after header 支持

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

### 0.5 Why This Project Exists

| Requirement | Chainr | Portkey (Hosted) | LiteLLM (Python) |
|-------------|--------|------------------|------------------|
| TypeScript SDK | ✅ | ❌ | ❌ |
| Embeddable (npm package) | ✅ | ❌ (独立托管服务) | ✅ (但需要自建) |
| Firebase compatible | ✅ | ❌ | ❌ |
| Zero external runtime deps | ✅ | ❌ | ❌ |
| Weighted load balance | ✅ | ✅ | ✅ |
| **不做面板管理** | ✅ | ❌ | ❌ |
| **不做托管中转** | ✅ | ❌ | ❌ |

**核心定位**：Portkey 的多 LLM provider 集成能力，但不需要它的面板管理和托管中转功能。

---

## 1. Architecture Overview

### Current Directory Structure

```
chainr/
├── src/
│   ├── index.ts                    # SDK entry point
│   ├── globals.ts                  # Provider constants
│   ├── types/
│   │   └── requestBody.ts         # Type definitions (Params, Options)
│   ├── providers/                  # 68 provider directories (Portkey-aligned)
│   │   ├── index.ts               # Static provider registry
│   │   ├── types.ts               # ProviderConfig / ProviderAPIConfig types
│   │   ├── utils.ts               # Provider utilities
│   │   └── ... (68 provider dirs)
│   └── core/
│       ├── Router.ts               # Main Chainr class + validateConfig
│       ├── types.ts                # Core types (ChainrConfig, StrategyResult)
│       ├── providerRequest.ts     # buildProviderRequest + transformProviderResponse
│       ├── tryTarget.ts              # 核心递归调度（嵌套策略 + 配置继承）
│       ├── RetryHandler.ts         # Exponential backoff retry + fetchWithTimeout + retry-after
│       ├── transformBedrockStream.ts # Bedrock streaming
│       ├── transformOpenAIStream.ts # OpenAI streaming
│       ├── transformAnthropicStream.ts
│       ├── transformGoogleStream.ts
│       ├── transformCohereStream.ts
│       ├── transformBytezStream.ts
│       ├── streamUtils.ts          # Streaming utilities
│       ├── sseParser.ts            # SSE parsing
│       └── strategies/
│           ├── FallbackStrategy.ts
│           ├── LoadBalanceStrategy.ts
│           └── SingleStrategy.ts
├── tests/
├── docs/
├── package.json
└── README.md
```

---

## 2. Feature Specification

### 2.1 Core Features

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
- **retry-after header 支持**: 429 响应时优先读取 `retry-after-ms` > `x-ms-retry-after-ms` > `retry-after`
- **预算机制**: 累计 retry-after 超过 60s 时放弃重试

#### F5: Nested Strategies ✅

- 策略可递归嵌套（fallback 内嵌 loadbalance，loadbalance 内嵌 fallback 等）
- 配置继承：overrideParams 合并（父级铺底，子级覆盖），retry/timeout 子级优先
- 通过 `tryTarget.ts` 统一调度，消除策略类间的代码重复

---

## 3. Provider Support Comparison

### 3.1 Portkey Providers (完整列表)

| Provider | Chat Completions | Embeddings | Images | Audio | 3D | Streaming | Tool Support |
|----------|-----------------|------------|--------|-------|-----|-----------|--------------|
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Anthropic** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Google Vertex AI** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **OpenRouter** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Together AI** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Perplexity AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Groq** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **DeepSeek** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Mistral AI** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Cohere** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Azure OpenAI** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Azure AI Inference** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **GitHub Models** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **AWS Bedrock** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **AWS SageMaker** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **AWS Lambda** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **AI21** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Cohere** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Hugging Face** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Fireworks AI** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Workers AI** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Anyscale** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Predibase** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SambaNova** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Cerebras** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Nebius** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **DeepInfra** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Modal Labs** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Replicate** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Lepton** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **OVHcloud** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Oracle AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **DashScope (Alibaba)** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Zhipu AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **LingYi (01.AI)** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Moonshot** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **x-ai (Grok)** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Novita AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SiliconFlow** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **LemonFox AI** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **DeepBricks** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Hyperbolic** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **302.AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Bytez** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **CometAPI** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Featherless AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Inference Net** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **IOIntelligence** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Kluster AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Matter AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **NextBit** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Stability AI** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Triton** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Upstage (Solar)** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **AI Badgr** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cortex** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Krutrim** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **NCompass** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Ollama** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Palm (Google)** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Reka AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Z-AI** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **MonsterAPI** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Nomic** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Jina** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Voyage** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Segmind** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Recraft AI** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Meshy** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Tripo 3D** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 3.2 Chainr vs Portkey 功能映射分析

#### 已实现 (✅)

| 功能 | Portkey | Chainr | 状态 |
|------|---------|--------|------|
| OpenAI chat completions | ✅ | ✅ | ✅ |
| Anthropic chat completions | ✅ | ✅ | ✅ |
| Google Vertex AI chat | ✅ | ✅ | ✅ |
| OpenRouter chat | ✅ | ✅ | ✅ |
| Together AI chat | ✅ | ✅ | ✅ |
| Perplexity chat | ✅ | ✅ | ✅ |
| Groq chat | ✅ | ✅ | ✅ |
| DeepSeek chat | ✅ | ✅ | ✅ |
| Mistral AI chat | ✅ | ✅ | ✅ |
| Cohere chat | ✅ | ✅ | ✅ |
| Azure OpenAI | ✅ | ✅ | ✅ |
| Azure AI Inference | ✅ | ✅ | ✅ |
| GitHub Models | ✅ | ✅ | ✅ |
| AWS Bedrock chat | ✅ | ✅ | ✅ (刚完成) |
| AWS Bedrock embeddings | ✅ | ✅ | ✅ |
| AWS Bedrock streaming | ✅ | ✅ | ✅ |
| AI21 chat | ✅ | ✅ | ✅ (passthrough) |
| Reka AI chat | ✅ | ✅ | ✅ |
| Z-AI chat | ✅ | ✅ | ✅ |
| Embeddings (OpenAI) | ✅ | ✅ | ✅ |
| Embeddings (Cohere) | ✅ | ✅ | ✅ |
| Embeddings (Google) | ✅ | ✅ | ✅ |
| Embeddings (Vertex) | ✅ | ✅ | ✅ |
| Embeddings (Workers AI) | ✅ | ✅ | ✅ |
| Embeddings (SiliconFlow) | ✅ | ✅ | ✅ |
| Embeddings (AI21) | ✅ | ✅ | ✅ |
| Embeddings (Mistral) | ✅ | ✅ | ✅ |
| Embeddings (Together) | ✅ | ✅ | ✅ |
| Embeddings (Anyscale) | ✅ | ✅ | ✅ |
| Embeddings (Fireworks) | ✅ | ✅ | ✅ |
| Images (Segmind) | ✅ | ✅ | ✅ |
| Images (Recraft) | ✅ | ✅ | ✅ |
| Images (Stability) | ✅ | ✅ | ✅ |
| Images (Google Vertex) | ✅ | ✅ | ✅ |
| Images (Workers AI) | ✅ | ✅ | ✅ |
| Images (DeepBricks) | ✅ | ✅ | ✅ |
| Images (Hyperbolic) | ✅ | ✅ | ✅ |
| Images (NScale) | ✅ | ✅ | ✅ |
| Images (LemonFox) | ✅ | ✅ | ✅ |
| 3D (Meshy) | ✅ | ✅ | ✅ |
| 3D (Tripo) | ✅ | ✅ | ✅ |
| Audio (OpenAI Whisper) | ✅ | ✅ | ✅ |
| Audio (LemonFox) | ✅ | ✅ | ✅ |
| Audio (Lepton) | ✅ | ✅ | ✅ |
| Translation (OpenAI) | ✅ | ✅ | ✅ |
| Translation (LemonFox) | ✅ | ✅ | ✅ |
| Translation (Azure) | ✅ | ✅ | ✅ |
| Speech (OpenAI TTS) | ✅ | ✅ | ✅ |
| Speech (Azure) | ✅ | ✅ | ✅ |
| Streaming transforms | ✅ | ✅ | ✅ |
| Retry with backoff | ✅ | ✅ | ✅ |
| Fallback strategy | ✅ | ✅ | ✅ |
| Load balance strategy | ✅ | ✅ | ✅ |
| Single strategy | ✅ | ✅ | ✅ |

#### 缺失或部分实现 (⚠️)

| 功能 | Portkey | Chainr | 状态 | 说明 |
|------|---------|--------|------|------|
| **Tool Support (Function Calling)** | ✅ | ⚠️ | 部分 | 仅基本实现，Bedrock toolConfig 未完整支持 |
| **Provider-specific params** | ✅ | ⚠️ | 部分 | DeepSeek thinking, Cohere reasoning_effort 已实现，其他缺失 |
| **Guardrail Config** | ✅ | ❌ | 缺失 | Bedrock 特有功能 |
| **Additional model request fields** | ✅ | ❌ | 缺失 | Bedrock 特有 |
| **Performance config** | ✅ | ❌ | 缺失 | Bedrock 特有 |
| **Anthropic-specific (thinking, beta)** | ✅ | ⚠️ | 部分 | 仅 thinking 传参，beta headers 缺失 |
| **Cohere-specific (freq/presence penalty)** | ✅ | ⚠️ | 部分 | reasoning_effort 已支持，其他未测试 |
| **AI21-specific (count penalty)** | ✅ | ❌ | 缺失 | 未实现 |
| **Mistral-specific params** | ✅ | ❌ | 缺失 | 未测试 |
| **Streaming: OpenAI passthrough** | ✅ | ✅ | ✅ | 52 个 provider |
| **Streaming: Anthropic** | ✅ | ✅ | ✅ | 已实现 |
| **Streaming: Google** | ✅ | ✅ | ✅ | 已实现 |
| **Streaming: Cohere** | ✅ | ✅ | ✅ | 已实现 |
| **Streaming: Bedrock** | ✅ | ✅ | ✅ | 已实现 |
| **Streaming: Bytez** | ✅ | ✅ | ✅ | 已实现 |
| **Nested Strategies** | ✅ | ✅ | ✅ | Phase 3B 完成，完全递归 + 配置继承 |
| **retry-after header** | ✅ | ✅ | ✅ | retry-after-ms / x-ms-retry-after-ms / retry-after |
| **Request Timeout** | ✅ | ✅ | ✅ | config.timeout 传入所有路径 |
| **Config Validation** | ✅ | ✅ | ✅ | targets/provider/timeout/retry 验证 |

---

## 4. Implementation Phases

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

### Phase 2: Provider Expansion 🟢 COMPLETE

**Completed** (2026-04-24):
- [x] 扩展至 50+ providers
- [x] Dedicated transforms for 16 providers
- [x] OpenAI-compatible URL mapping for 52 providers
- [x] Embeddings transforms (12 providers)
- [x] Image generation transforms (9 providers)
- [x] Audio transcription transforms (3 providers)
- [x] Translation transforms (3 providers)
- [x] Speech synthesis transforms (2 providers)
- [x] 3D generation transforms (2 providers)
- [x] Streaming transforms (8 providers)
- [x] All 370 tests pass
- [ ] ~~TypeScript 0 errors~~ — **✅ 0 TS errors** (2026-04-24 15:52 EEST)
- [x] Build succeeds (tsup bundles only active code, `src/providers/` not imported)

> **⚠️ 注意**: `src/providers/` 目录从 Portkey 复制了 70 个 provider 目录。桥接文件（types.ts、utils.ts）和注册表（index.ts）已创建。Hono 依赖已全部剥离。67 个 provider 已注册到静态注册表。

### Phase 2.5: Provider Integration 🟢 COMPLETE

**Completed** (2026-04-24):
- [x] Phase 1：桥接文件（types.ts、utils.ts、finishReasonMap.ts、embedRequestBody.ts、GatewayError.ts、env.ts）
- [x] Phase 2：Hono 依赖全部剥离，awsSigV4.ts 删除，改用 @smithy/signature-v4
- [x] Phase 3：17 个 provider 的 75 个无效 import 清理
- [x] Phase 4：Provider 注册表（68 个 provider）+ providerRequest.ts 集成层
- [x] Phase 5：删除 transformRequest.ts + transformResponse.ts，Strategy/Router 全部接入注册表
- [x] 178 tests passing

### Phase 3: Advanced Features 🟡 IN PROGRESS

**Goal**: Nested strategies, conditional routing, tool support

**Completed** (2026-04-24):
- [x] Request timeout handling (config.timeout → Strategy → fetchWithTimeout)
- [x] Configuration validation (targets/provider/timeout/retry)
- [x] Nested strategy support (fallback + loadbalance 递归嵌套，配置继承)
- [x] retry-after header 支持 (retry-after-ms / x-ms-retry-after-ms / retry-after + 60s 预算)

**Deliverables**:
- [x] Request timeout handling
- [x] Configuration validation
- [x] Nested strategy support (fallback + loadbalance combined)
- [x] retry-after header support
- [ ] **Tool support (function calling) - 完整实现**
- [ ] **Provider-specific params - 完整对齐**
- [ ] Conditional routing (MongoDB-style query routing)

### Phase 4: Firebase Integration ⬜ TODO

**Goal**: Production-ready with Firebase example

**Deliverables**:
- [ ] Firebase Functions example
- [ ] Performance benchmarks
- [ ] Error handling edge cases

---

## 5. TODO List - 完整对齐 Portkey

### 5.1 高优先级 (推理相关，必须实现)

#### Tool Support (Function Calling) - ⚠️ 部分实现

**现状**:
- OpenAI: ✅ 完整支持
- Anthropic: ✅ 完整支持
- 其他 provider: ❌ 未测试/未实现

**需要实现**:
- [ ] Azure OpenAI tool support
- [ ] Azure AI Inference tool support
- [ ] Google Vertex AI tool support
- [ ] OpenRouter tool support
- [ ] Together AI tool support
- [ ] Perplexity tool support
- [ ] Groq tool support
- [ ] DeepSeek tool support
- [ ] Mistral AI tool support
- [ ] Cohere tool support
- [ ] Bedrock toolConfig (完整实现)
  - [ ] toolSpec with name, description, inputSchema
  - [ ] toolChoice (any, auto, tool name)
  - [ ] cachePoint for tools
- [ ] Reka AI tool support

#### Provider-Specific Parameters - ⚠️ 部分实现

**需要实现**:

Anthropic-specific:
- [ ] anthropic_version header
- [ ] anthropic_beta header
- [ ] top_k (via additionalModelRequestFields)

Cohere-specific:
- [ ] frequency_penalty
- [ ] presence_penalty
- [ ] logit_bias
- [ ] n (num_generations)
- [ ] top_k

AI21-specific:
- [ ] frequency_penalty / presence_penalty / countPenalty

Bedrock-specific (完整):
- [ ] additionalModelRequestFields
- [ ] additionalModelResponseFieldPaths
- [ ] guardrailConfig / guardrail_config
- [ ] performance_config
- [ ] anthropic_version
- [ ] user
- [ ] thinking (Claude extended thinking)
- [ ] anthropic_beta

Mistral-specific:
- [ ] safe_prompt

Google-specific:
- [ ] safety_settings
- [ ] cached_reference

#### Streaming - ✅ 基本完成

**需要测试**:
- [ ] Hugging Face streaming
- [ ] Workers AI streaming
- [ ] DeepInfra streaming
- [ ] Predibase streaming
- [ ] SambaNova streaming
- [ ] Novita AI streaming
- [ ] SiliconFlow streaming
- [ ] MonsterAPI streaming

### 5.2 中优先级 (增强功能)

#### Configuration & Validation
- [x] Request timeout handling
- [x] Config validation (required fields)
- [ ] Retry config validation

#### Nested Strategies
- [x] Fallback + LoadBalance 组合（递归嵌套）
- [x] 配置继承（overrideParams 合并，retry/timeout 子级优先）
- [ ] Conditional routing rules (MongoDB-style query routing)

### 5.3 低优先级 (生态集成)

#### Provider Aliases
- [ ] google-vertexai → vertex-ai
- [ ] azure-openai → azure-openai
- [ ] 其他 Portkey 支持的别名

#### Error Handling Alignment
- [ ] Portkey error format → Chainr error mapping
- [ ] Provider-specific error codes

---

## 6. Testing Strategy

### Current Test Coverage (209 tests ✅)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| streaming/types.test.ts | 26 | OPENAI_COMPATIBLE_PROVIDERS |
| RetryHandler.test.ts | 23 | retry logic |
| streaming/streamUtils.test.ts | 16 | split patterns |
| streaming/transformOpenAIStream.test.ts | 16 | passthrough streaming |
| configValidation.test.ts | 14 | config validation |
| providerRequest.test.ts | 14 | buildProviderRequest + transformProviderResponse |
| streaming/sseParser.test.ts | 14 | SSE parsing |
| strategies/SingleStrategy.test.ts | 13 | single strategy |
| strategies/FallbackStrategy.test.ts | 12 | fallback strategy |
| strategies/nestedStrategy.test.ts | 12 | 嵌套策略 + 配置继承 |
| Router.test.ts | 12 | Router 集成 |
| real-http.test.ts | 12 | real HTTP 集成 |
| streaming/transformAnthropicStream.test.ts | 11 | Anthropic streaming |
| strategies/LoadBalanceStrategy.test.ts | 9 | load balance strategy |
| retryAfter.test.ts | 8 | retry-after header 解析 + 预算 |
| timeout.test.ts | 3 | timeout 传递 |

### Missing Tests

| Feature | Priority | Notes |
|---------|----------|-------|
| Bedrock chat completions transform | HIGH | Need unit tests |
| Bedrock streaming transform | HIGH | Need unit tests |
| Tool support transforms | HIGH | Need unit tests |
| Provider-specific params | MEDIUM | Need unit tests |

---

## 7. API Design

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

### AWS Bedrock Usage

```typescript
const chainr = new Chainr({
  strategy: 'single',
  targets: [{
    provider: 'bedrock',
    awsAccessKeyId: 'AKIA...',
    awsSecretAccessKey: '...',
    awsSessionToken: '...', // optional for temp creds
    awsRegion: 'us-east-1',
    overrideParams: { model: 'us.anthropic.claude-v2' }
  }]
});
```

---

## 8. Success Metrics

### Phase 1 Complete ✅
- [x] Project scaffolding complete
- [x] Chainr Router class implemented
- [x] All 3 strategies implemented
- [x] TypeScript 0 errors
- [x] Build success (ESM + CJS)

### Phase 2 Complete ✅ (2026-04-24)
- [x] 370 tests passing
- [x] 50+ providers supported
- [x] Embeddings, Images, Audio, Translation, Speech, 3D
- [x] Streaming transforms for 8 providers
- [x] AWS Bedrock complete support with SigV4 signing
- [x] Git push to main

### Phase 3A Complete ✅ (2026-04-24)
- [x] 195 tests passing
- [x] Config validation (targets/provider/timeout/retry)
- [x] Request timeout (config.timeout → all fetch paths)

### Phase 3B Complete ✅ (2026-04-24)
- [x] 209 tests passing
- [x] Nested strategies (recursive fallback + loadbalance + config inheritance)
- [x] retry-after header support (retry-after-ms / x-ms-retry-after-ms / retry-after + 60s budget)

### Remaining
- [ ] Phase 3C: Tool support (function calling) complete
- [ ] Phase 3D: Provider-specific params alignment
- [ ] Phase 3E: Conditional routing
- [ ] Phase 4: Anthropic Messages API + OpenAI Responses API
- [ ] Phase 5: Firebase Functions example

---

## 9. Dependencies

### Production
- `@smithy/signature-v4`: AWS SigV4 签名（Bedrock/SageMaker 需要）
- `@aws-crypto/sha256-js`: SHA256 哈希（@smithy 依赖）

### Development
- `vitest`: Testing
- `tsup`: Build (esbuild-based)
- `typescript`: Type checking
- `biome`: Linting + formatting

---

## 10. License

MIT - See [LICENSE](./LICENSE)

Chainr is an independent implementation.
