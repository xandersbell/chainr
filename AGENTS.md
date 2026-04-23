# AGENTS.md — Chainr

Unified LLM gateway SDK with priority-based fallback and weighted load balancing for TypeScript/Node.js.

---

## 项目状态

- **状态**: ✅ Production Ready
- **测试**: 278 tests passing
- **Streaming**: 51 providers
- **依赖**: Zero external deps (pure fetch)

---

## 技术栈

- **语言**: TypeScript (strict mode)
- **构建**: tsup
- **测试**: Vitest
- **运行时**: Node.js 18+ / Firebase Cloud Functions

---

## 开发命令

```bash
npm test          # 运行所有测试
npm run test:watch # watch 模式
npm run build      # 构建 (tsup → dist/)
```

---

## 核心架构

### 入口
- `src/index.ts` — SDK 导出

### 核心模块 (`src/core/`)

| 文件 | 作用 |
|------|------|
| `Router.ts` | 主类 Chainr，接收请求并选择 strategy |
| `RetryHandler.ts` | 指数退避重试 |
| `transformRequest.ts` | 13 个 provider 的请求转换 |
| `transformResponse.ts` | 响应转换 |
| `streamUtils.ts` | 40+ provider 的 streaming 工具 |
| `sseParser.ts` | SSE 解析 |
| `transform*Stream.ts` | 各 provider 的流式响应转换 |

### Strategy 模式 (`src/core/strategies/`)

| 文件 | 作用 |
|------|------|
| `FallbackStrategy.ts` | 按优先级尝试，失败则回退 |
| `LoadBalanceStrategy.ts` | 按 weight 权重分发 |
| `SingleStrategy.ts` | 单 provider |

### 类型定义 (`src/types/`)

- `requestBody.ts` — `Params`, `Options`, `Message` 等

---

## Provider 注册

Provider key 在 `src/globals.ts` 中定义。

---

## 添加新 Provider 的流程

### 1. 请求转换（如果需要）

在 `src/core/transformRequest.ts` 中添加 provider 的 `transform` 函数。

### 2. Streaming 转换（如果需要）

在 `src/core/` 下创建 `transform<Provider>Stream.ts`，或添加到 `streamUtils.ts`。

### 3. Provider Key

在 `src/globals.ts` 的 `PROVIDER_URLS` 或相关常量中添加 provider 标识。

### 4. 测试

在 `tests/` 下添加对应的 test 文件。

---

## 测试结构

```
tests/
├── transformRequest.test.ts      # 67 tests, 13 providers
├── transformResponse.test.ts     # 26 tests
├── streaming/
│   ├── types.test.ts             # 18 tests, 51 providers
│   ├── streamUtils.test.ts       # 16 tests
│   ├── sseParser.test.ts         # 14 tests
│   └── transform*Stream.test.ts
├── RetryHandler.test.ts          # 23 tests
├── strategies/
│   ├── FallbackStrategy.test.ts   # 12 tests
│   ├── LoadBalanceStrategy.test.ts # 9 tests
│   └── SingleStrategy.test.ts    # 13 tests
├── Router.test.ts
└── real-http.test.ts             # 集成测试
```

---

## 常见任务

### 新增 Provider 的请求转换

```typescript
// src/core/transformRequest.ts
export const providerTransform: ProviderTransform = {
  // transform function
};
```

### 新增 Provider 的 Streaming 转换

```typescript
// src/core/transformProviderStream.ts
export function transformProviderStream(/* ... */) {
  // 处理 provider 特定的 SSE 格式
}
```

### 添加测试

```typescript
// tests/transformProvider.test.ts
import { describe, it, expect } from 'vitest';
// ...
```

---

## Provider 列表（51 个）

### Core (10)
OpenAI, Anthropic, Vertex AI, OpenRouter, Together AI, Perplexity, Groq, DeepSeek, Mistral AI, Cohere

### Azure (2)
Azure OpenAI, Azure AI Inference

### Chinese/Asian (4)
DashScope, Zhipu AI, LingYi, Moonshot

### xAI (1)
x-ai (Grok)

### Infrastructure (6)
Lambda, Bedrock, SageMaker, Oracle, OVHcloud

### GPU Cloud (12)
HuggingFace, Anyscale, Fireworks AI, Workers AI, DeepInfra, Predibase, SambaNova, Cerebras, Nebius, Hyperbolic, Modal, Replicate

### Emerging (16)
302.AI, AI21 (Jamba), AI6, Bytez, CometAPI, DeepBricks, Featherless AI, GitHub Models, Inference Net, IOIntelligence, Kluster AI, Lepton, Lemonfox AI, Matter AI, NextBit, Novita AI, nScale, Owl AI, SiliconFlow, Stability AI, Triton, Upstage (Solar)

---

## 相关文档

- 完整 API 文档: `README.md`
- Provider 差距分析: `wiki/sources/20260424_portkey-chainr-provider-gap.md`
