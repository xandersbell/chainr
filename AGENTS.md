# AGENTS.md — Chainr

LLM gateway SDK with priority-based fallback and weighted load balancing.

---

## 项目状态

| 维度 | 状态 |
|------|------|
| 测试 | 278 tests, 全部通过 |
| Provider | 10 个已实现 |
| Streaming | 部分实现（OpenAI、Anthropic、Google、Cohere） |
| Phase 1 & 2 | ✅ 完成 |
| Phase 3 (Nested Strategies) | ⬜ 未开始 |
| Phase 4 (Firebase) | ⬜ 未开始 |

**实际状态**: 核心功能（fallback/loadbalance/single + 10 provider）已完成并通过测试。但有已知 gap，Phase 3/4 未开始。

---

## 技术栈

- **语言**: TypeScript (strict mode)
- **测试**: Vitest
- **构建**: tsup
- **运行时**: Node.js 18+ / Firebase Cloud Functions
- **依赖**: 零外部运行时依赖（纯 fetch）

---

## 开发命令

```bash
npm test      # 运行所有测试 (278 tests)
npm run build # 构建到 dist/
```

---

## 核心架构

### 入口
- `src/index.ts` — SDK 导出（Chainr, Strategies, ChatCompletionChunk）

### Router (`src/core/Router.ts`)
主类，接收配置，执行 strategy，返回统一格式响应。

```typescript
const chainr = new Chainr({
  strategy: 'fallback', // 'fallback' | 'loadbalance' | 'single'
  targets: [...],
  retry?: { attempts: number; onStatusCodes: number[] }
});
```

### Strategies (`src/core/strategies/`)
| Strategy | 行为 |
|----------|------|
| FallbackStrategy | 顺序尝试，失败则回退 |
| LoadBalanceStrategy | 按 weight 权重分发，单次尝试 |
| SingleStrategy | 仅用第一个 target |

### Request Transform (`src/core/transformRequest.ts`)
将 OpenAI 格式请求转换为各 provider 格式。

**已实现 10 个 provider**:
- OpenAI — 直接透传
- Anthropic — 转换 Messages API 格式
- Vertex AI — 转换 REST API 格式
- OpenRouter, Together AI, Perplexity, Groq, DeepSeek, Mistral AI, Cohere — OpenAI-compatible 透传

### Response Transform (`src/core/transformResponse.ts`)
将各 provider 响应转换为统一 OpenAI 格式。

### Streaming (`src/core/`)
| 文件 | 作用 |
|------|------|
| `sseParser.ts` | SSE 解析 |
| `streamUtils.ts` | 流式工具 |
| `transformOpenAIStream.ts` | OpenAI 流式转换 |
| `transformAnthropicStream.ts` | Anthropic SSE → OpenAI |
| `transformGoogleStream.ts` | Google SSE → OpenAI |
| `transformCohereStream.ts` | Cohere SSE → OpenAI |
| `transformBedrockStream.ts` | Bedrock 流式转换 |
| `types/streaming.ts` | 流式类型定义 |

---

## 目录结构

```
src/
├── index.ts                 # SDK 导出
├── globals.ts               # 常量定义
├── types/
│   └── requestBody.ts       # Params, Message, Options
└── core/
    ├── Router.ts            # 主类
    ├── types.ts             # ChainrConfig, StrategyResult
    ├── transformRequest.ts  # 请求转换 (10 providers)
    ├── transformResponse.ts # 响应转换
    ├── RetryHandler.ts       # 指数退避重试
    ├── sseParser.ts          # SSE 解析
    ├── streamUtils.ts       # 流式工具
    ├── transform*Stream.ts   # 各 provider 流式转换
    └── strategies/
        ├── FallbackStrategy.ts
        ├── LoadBalanceStrategy.ts
        └── SingleStrategy.ts

tests/
├── setup.ts
├── unit/
│   ├── transformRequest.test.ts
│   ├── transformResponse.test.ts
│   ├── RetryHandler.test.ts
│   ├── strategies/
│   └── streaming/
└── integration/
    ├── Router.test.ts
    └── real-http.test.ts

docs/
├── phase1-evaluation.md     # 代码评估报告（含已知问题）
├── PROVIDER_EVALUATION*.md # Provider 支持分析
└── plan/DEVELOPMENT_PLAN.md # 开发计划
```

---

## 已知问题与限制

### Phase 3 未实现
| 问题 | 说明 | 影响 |
|------|------|------|
| Nested Strategies | 不支持策略嵌套 | 无法配置复杂拓扑 |
| Vertex AI GCP OAuth | 仅支持 API Key | GCP 生产环境无法使用 |

### Streaming 部分实现
- ✅ OpenAI: pass-through
- ✅ Anthropic: SSE → OpenAI
- ✅ Google: SSE → OpenAI
- ✅ Cohere: SSE → OpenAI
- ✅ OpenRouter: pass-through
- ❌ 其他 6 个 provider: 未测试/未实现

### Integration Test 限制
- `real-http.test.ts` 需要真实 API key，跳过而非真正请求
- 无 msw/nock HTTP mock 测试层

---

## 添加新 Provider

### 1. 请求转换 (`transformRequest.ts`)

在 switch 中添加 case，调用 transform 函数：

```typescript
case 'my-provider':
  return transformMyProviderRequest(params, opts);
```

实现 transform 函数，构造 `TransformResult`：

```typescript
function transformMyProviderRequest(params: Params, opts: Record<string, unknown>): TransformResult {
  return {
    url: 'https://api.myprovider.com/v1/chat/completions',
    headers: { 'Authorization': `Bearer ${opts.apiKey}` },
    body: { model: params.model, messages: params.messages, ... }
  };
}
```

### 2. 响应转换 (`transformResponse.ts`)

在 switch 中添加 case。

### 3. 常量定义 (`globals.ts`)

在 `VALID_PROVIDERS` 数组中添加 provider key。

### 4. 测试

在 `tests/unit/transformRequest.test.ts` 和 `transformResponse.test.ts` 中添加测试。

---

## 类型定义

### ChainrConfig (`src/core/types.ts`)
```typescript
interface ChainrConfig {
  strategy: 'fallback' | 'loadbalance' | 'single';
  targets: Array<{
    provider: string;
    apiKey?: string;
    weight?: number;
    retry?: { attempts: number; onStatusCodes: number[] };
    // Provider-specific options
    vertexProjectId?: string;
    vertexRegion?: string;
  }>;
  retry?: { attempts: number; onStatusCodes: number[] };
}
```

### Params (`src/types/requestBody.ts`)
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

---

## 相关文档

- `README.md` — 项目概述（声称 Production Ready，与 Phase 3/4 未开始矛盾）
- `docs/phase1-evaluation.md` — 代码评估报告，含 bug 修复记录
- `docs/PROVIDER_EVALUATION_COMPREHENSIVE.md` — Provider 支持详情
- `docs/plan/DEVELOPMENT_PLAN.md` — 开发计划，Phase 3/4 未开始
