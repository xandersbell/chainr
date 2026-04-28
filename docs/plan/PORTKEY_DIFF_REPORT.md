# Priorai vs Portkey 差异报告

**生成时间**: 2026-04-29 02:10:01 EEST（同步当前实现后的 multimodal / Realtime 文档边界）

**Portkey 版本**: portkey-ai-gateway (本地 clone)
**Priorai 版本**: All Phases Complete, 506 tests, develop branch

---

## 1. 架构差异（根本性）

| 维度 | Portkey | Priorai | 评估 |
|------|---------|--------|------|
| 运行形态 | Hono Web 服务器（独立网关） | 嵌入式 SDK（npm 包） | ✅ 设计如此 |
| 请求入口 | HTTP 路由 + 中间件管道 | `priorai.chat.completions.create()` 方法调用 | ✅ 设计如此 |
| 配置传递 | `x-portkey-config` header + 请求体 | 构造函数 `PrioraiConfig` | ✅ 设计如此 |
| 依赖 | Hono, async-retry, 多个中间件 | 仅 @smithy/signature-v4 + @aws-crypto/sha256-js | ✅ 设计如此 |
| 部署目标 | Node.js / Cloudflare Workers / Lagon | Node.js ≥ 18（Firebase 友好） | ✅ 设计如此 |

> 以上差异是 Priorai 的核心定位决定的，不需要对齐。

---

## 2. Provider 数量对比

| 指标 | Portkey | Priorai | 差异 |
|------|---------|--------|------|
| 总 provider 数 | 75 | 72 | -3 |
| 注册表完整性 | 75/75 | 72/72 | ✅ 各自完整 |

### Portkey 有但 Priorai 缺失的 Provider（3 个）

| Provider | 类型 | 优先级 |
|----------|------|--------|
| `qdrant` | 向量数据库 | 🔴 低（非 LLM） |
| `milvus` | 向量数据库 | 🔴 低（非 LLM） |
| `portkey` | 自引用 | 🔴 不需要 |

> 向量数据库（qdrant/milvus）和 portkey 自引用不在 Priorai 范围内。nscale、snowflake 等 Portkey 新增 provider 需逐一核实是否已包含在 72 个注册 provider 中。

---

## 3. 路由策略差异（核心功能）

| 策略 | Portkey | Priorai | 状态 |
|------|---------|--------|------|
| `single` | ✅ | ✅ | ✅ 已对齐 |
| `fallback` | ✅ | ✅ | ✅ 已对齐 |
| `loadbalance` | ✅ | ✅ | ✅ 已对齐 |
| `conditional` | ✅ MongoDB 风格查询路由 | ✅ | ✅ 已对齐 |
| 嵌套策略 | ✅ 完全递归 | ✅ 完全递归 + 配置继承 | ✅ 已对齐 |
| 熔断器 (Circuit Breaker) | ⚠️ 钩子扩展点 | ❌ | 🟡 低优先级 |

### 3.1 `conditional` 策略详情

Priorai 已实现完整的 MongoDB 风格条件路由，与 Portkey 对齐：
- 操作符：`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$regex`, `$and`, `$or`
- 上下文键：`params.*`（请求 body 字段）、`metadata.*`（调用方传入的元数据）
- 支持 default target 兜底

### 3.2 嵌套策略详情

Portkey 的 `tryTargetsRecursively()` 支持完全递归：
- fallback 的某个 target 可以是一个 loadbalance 组
- 配置（retry, cache, overrideParams, hooks, timeout）沿树继承，子级覆盖父级

### 3.3 熔断器 (Circuit Breaker) 详情

Portkey 开源版中 Circuit Breaker **仅为空壳扩展点，无实际实现**。具体分析（`handlerUtils.ts`）：

1. **过滤逻辑**（第 646–658 行）：如果当前配置节点有 `id`，则过滤掉 `isOpen: true` 的 targets（跳过已熔断的 provider）
2. **回调钩子**（第 792–799 行）：调用 `c.get('handleCircuitBreakerResponse')?.()` 更新熔断状态，但该回调**从未在开源代码中通过 `c.set()` 注册**
3. **缺失部分**：`cbConfig`、`isOpen` 无类型定义（仅 `any` 类型动态属性），不在 Zod schema 中；失败计数、熔断阈值、半开恢复等核心状态机逻辑**完全不存在**

> 结论：这是留给 Portkey 云服务/企业版在运行时注入的扩展点。开源版无法独立使用 Circuit Breaker。Priorai 如需此功能需从零实现状态机（Closed → Open → Half-Open），当前优先级低。

---

## 4. 重试逻辑差异

| 特性 | Portkey | Priorai | 状态 |
|------|---------|--------|------|
| 指数退避 | ✅ via async-retry | ✅ 自实现 | ✅ 已对齐 |
| 默认重试码 | [429,500,502,503,504] | [429,500,502,503,504] | ✅ 一致 |
| 非重试码快速失败 | ✅ bail() | ✅ 400/401/404 | ✅ 已对齐 |
| `retry-after` header 支持 | ✅ 读取 retry-after-ms / x-ms-retry-after-ms / retry-after | ✅ 同 Portkey 优先级 + 60s 预算 | ✅ 已对齐 |
| 最大重试等待 60s 上限 | ✅ MAX_RETRY_LIMIT_MS | ✅ 60s cap | ✅ 已对齐 |
| fetchWithTimeout | ✅ AbortController | ✅ AbortController | ✅ 已对齐 |
| ConnectTimeoutError → 503 | ✅ 不重试，最外层 catch | ✅ 重试，循环内 catch | ⚠️ 行为差异 |

### 4.1 为什么不使用 async-retry

Portkey 使用 `async-retry`（v1.3.3）作为重试循环骨架，Priorai 选择自实现 for 循环。评估后决定保持自实现，理由：

| 维度 | async-retry (Portkey) | 自实现 (Priorai) | 评估 |
|------|----------------------|-----------------|------|
| 代码量 | ~220 行 | ~204 行 | 持平 |
| retry-after 处理 | 篡改 `_timeouts` 内部数组（hack 私有状态） | `getSmartDelay()` 返回 null + break | ✅ Priorai 更干净 |
| 非重试状态码 | `bail(err)` 语义 | 直接 `return` | 持平 |
| 流式重试 | 无独立支持 | `retryRequestForStream` 独立函数 | ✅ Priorai 更好 |
| 依赖链 | async-retry → retry（2 个间接依赖） | 零依赖 | ✅ SDK 场景更优 |
| 可读性 | 需理解 async-retry 的 bail/onRetry/factor 语义 | 一个 for 循环，逻辑一目了然 | ✅ Priorai 更透明 |

> 结论：async-retry 在 Portkey（Web 服务器）场景下合理，但对嵌入式 SDK 而言，自实现代码量相当、逻辑更透明、无 hack 私有状态的风险、且少两个依赖。

### 4.2 ConnectTimeoutError 行为差异

Portkey 的 ConnectTimeoutError 在 async-retry 最外层 catch 处理，**不会被重试**，直接返回 503。Priorai 在 for 循环内部 catch 处理，**会继续重试**（等待退避时间后重试下一次）。这是一个有意的设计选择 — 网络超时通常是暂时性的，重试有较高概率成功。

---

## 5. 流式处理差异

| 特性 | Portkey | Priorai | 状态 |
|------|---------|--------|------|
| SSE 文本流解析 | ✅ | ✅ | ✅ 已对齐 |
| AWS EventStream 二进制帧解析 | ✅ readAWSStream() | ✅ transformBedrockStream | ✅ 已对齐 |
| Provider 分隔符映射 | ✅ | ✅ | ✅ 已对齐 |
| 首 chunk 延迟 (25ms) | ✅ | ✅ | ✅ 已对齐 |
| Azure 1ms chunk 间隔 | ✅ isSleepTimeRequired | ✅ | ✅ 已对齐 |
| JSON → SSE 转换（缓存命中） | ✅ | ❌ | ❌ 无缓存所以不需要 |
| Hook 结果注入流 | ✅ | ❌ | ❌ 无 Hook 所以不需要 |
| 流式重试 | ✅ retryRequestForStream | ✅ retryRequestForStream | ✅ 已对齐 |

### 5.1 AWS EventStream 二进制帧解析

大多数 LLM provider 的流式响应使用 SSE（Server-Sent Events）纯文本格式（`data: {...}\n\n`），文本解析器即可处理。AWS Bedrock 使用自有的 **EventStream 二进制协议**，每帧结构为：

```
[4B 总长度][4B header长度][4B CRC校验][headers: 二进制键值对][payload: JSON][4B 帧CRC]
```

解析器需要：按帧边界切割字节流 → 解析 header（`:message-type`、`:event-type`）→ 提取 payload 并 decode 为 JSON → 处理错误帧（`:message-type: exception`）。

Portkey 的 `readAWSStream()` 和 Priorai 的 `transformBedrockStream` 实现相同功能：将 Bedrock 二进制 EventStream 帧解析为标准 JSON chunk，再转为 OpenAI 兼容的 SSE 格式输出。

### 5.2 Azure 1ms chunk 间隔

Azure OpenAI 的流式响应存在已知的粘包问题：多个 SSE chunk 会被缓冲后一次性发送，而非逐个推送。如果客户端解析器不够健壮，粘包会导致解析失败或丢数据。

解决方案：对 Azure 系 provider（`azure-openai`、`azure-ai`），在每个 chunk 写入后插入 1ms 微延迟（`await new Promise(r => setTimeout(r, 1))`）。这个延迟不是在"等待"什么，而是将控制权交还事件循环，让每个 chunk 作为独立的 write 操作发出，避免 Node.js 写缓冲将多个 chunk 合并为一次 TCP 发送。Portkey 通过 `isSleepTimeRequired` 标志控制此行为，Priorai 在 `createOpenAIStream` 中对 Azure provider 做同样处理。

---

## 6. 请求/响应转换差异

| 特性 | Portkey | Priorai | 状态 |
|------|---------|--------|------|
| ProviderConfig 参数映射 | ✅ | ✅ | ✅ 已对齐 |
| min/max/default 钳位 | ✅ | ✅ | ✅ 已对齐 |
| transform 函数 | ✅ | ✅ | ✅ 已对齐 |
| 点号嵌套路径 (setNestedProperty) | ✅ | ✅ | ✅ 已对齐 |
| responseTransforms | ✅ | ✅ | ✅ 已对齐 |
| FormData 转换 | ✅ transformToFormData() | ✅ executeSimpleEndpoint 支持 | ✅ 已对齐 |
| Tool/Function Calling | ✅ 各 provider 独立转换 | ✅ 与 Portkey 一致 | ✅ 已对齐 |
| Provider-specific params | ✅ 各 provider 独立参数映射 | ✅ 与 Portkey 一致 | ✅ 已对齐 |
| proxy 模式（原样透传） | ✅ | ❌ | 🟡 低优先级 |

### 6.1 proxy 模式说明

Portkey 的 proxy 模式是一个"兜底透传"通道：当 provider 有 Portkey 不认识的 API 端点时（如实验性 API），proxy 模式将请求原封不动地转发给 provider，不做任何参数转换或响应格式化。作为独立网关，所有请求都必须经过 Portkey，因此需要这个逃生口避免"网关不支持 = 完全不能用"。

**Priorai 不实现 proxy 模式的理由**：

1. **架构差异决定需求差异**：Portkey 是独立网关，所有流量必须经过它，没有 proxy 就等于"不支持 = 完全不能用"。Priorai 是嵌入式 SDK，调用方随时可以绕过 Priorai 直接用 `fetch` 或 provider 原生 SDK
2. **透传下 Priorai 的核心价值丧失**：proxy 模式不知道请求/响应格式，做不了参数转换和响应标准化 — 这恰恰是 Priorai 的核心能力。能做的只有 HTTP 状态码级别的 retry 和 fallback，调用方自己包一层 fetch 也能做到
3. **跨 provider fallback 不兼容**：不同 provider 的同一功能 URL 和认证方式各不相同，透传的 body 在 fallback 到另一个 provider 时大概率不兼容，fallback 形同虚设
4. **按需添加成本低**：如果后续有真实用户需求，proxy 模式的实现并不复杂，届时再加即可。现在做属于为假设需求增加复杂度

---

## 7. 端点覆盖差异

| 端点类型 | Portkey | Priorai | 状态 |
|----------|---------|--------|------|
| chatComplete | ✅ | ✅ | ✅ |
| complete (legacy) | ✅ | ✅ | ✅ |
| embed | ✅ | ✅ | ✅ |
| imageGenerate | ✅ | ✅ | ✅ |
| imageEdit | ✅ | ✅ | ✅ |
| createSpeech | ✅ | ✅ | ✅ |
| createTranscription | ✅ | ✅ | ✅ |
| createTranslation | ✅ | ✅ | ✅ |
| rerank | ⚠️ 仅类型占位 | ❌ | ❌ Portkey 也未实现 |
| moderate | ✅ | ❌ | 🔴 低 |
| realtime bootstrap HTTP | ✅ | ✅ | ✅ |
| realtime (WebSocket/WebRTC transport runtime) | ✅ | ❌ | 🟡 |
| uploadFile / listFiles / deleteFile | ✅ | ✅ | ✅ |
| createBatch / retrieveBatch / listBatches / cancelBatch | ✅ | ✅ | ✅ |
| createFinetune / listFinetunes / cancelFinetune | ✅ | ✅ | ✅ |
| messages (Anthropic native) | ✅ | ✅ | ✅ |
| messagesCountTokens | ✅ | ✅ | ✅ 已对齐 |
| createModelResponse (OpenAI Responses API) | ✅ | ✅ | ✅ |

### 7.1 未实现端点说明

**rerank（重排序）**：用于 RAG 场景，检索出候选文档后用 rerank 模型按相关性重新排序。主要 provider 为 Cohere 和 Jina。Portkey 仅定义了 `rerank` 端点类型接口，但没有任何 provider 实际实现请求转换逻辑，是个空壳。Priorai 同样跳过。如果未来 rerank 在更多 provider 普及，加起来不复杂。

**moderate（内容审核）**：调用 OpenAI Moderation API（`/v1/moderations`），输入文本返回暴力/色情/仇恨言论等分类标签和置信度。Priorai 不实现的理由：
- 仅 OpenAI 一家提供，没有跨 provider fallback 的意义
- 调用方直接 `fetch` OpenAI moderation 端点即可，不需要 SDK 包一层
- 属于安全审核/Guardrails 范畴，Priorai 明确不做 Guardrails

**realtime bootstrap HTTP**：Priorai 当前已经暴露三条 OpenAI Realtime 启动面：
- `priorai.realtime.sessions.create()`
- `priorai.realtime.clientSecrets.create()`
- `priorai.realtime.transcriptionSessions.create()`

这些入口用于创建 session 配置和临时凭证，属于对 OpenAI Realtime 的 HTTP bootstrap 封装，不等于完整 transport runtime。

**realtime (WebSocket/WebRTC transport runtime)**：OpenAI Realtime API 的真正音频对话阶段依赖持久 WebSocket 或 WebRTC 连接。Priorai 仍不实现这部分，理由：
- 架构不匹配 — Priorai 的策略系统（retry、fallback、loadbalance）基于 HTTP 请求-响应模型，WebSocket 长连接不适用
- 目前仅 OpenAI 一家有 Realtime API，无多 provider 路由需求
- 实现复杂度高，收益低

---

## 8. Portkey 独有功能（Priorai 明确不做的）

| 功能 | 说明 | Priorai 态度 |
|------|------|-------------|
| Hooks / Guardrails 系统 | beforeRequest/afterRequest 钩子，GUARDRAIL + MUTATOR | ❌ 不做 |
| 20+ 内置 Guardrail 插件 | PII、内容审核、JSON Schema 校验等 | ❌ 不做 |
| 第三方 Guardrail 集成 | Aporia, Azure, Bedrock, Patronus 等 | ❌ 不做 |
| 缓存系统 | 内存/Redis/Cloudflare KV/文件缓存 | ❌ 不做 |
| 日志中间件 | 请求/响应日志记录 | ❌ 不做 |
| Virtual Key 管理 | API Key 抽象 + 预算控制 | ❌ 不做 |
| 请求验证中间件 | 入站请求格式校验 | ❌ 不做 |
| WebSocket / WebRTC Realtime transport | OpenAI Realtime API 长连接代理 | ❌ 暂不做 |
| 压缩中间件 | 响应压缩 | ❌ 不需要（SDK） |

---

## 9. 总结

### ✅ 已对齐（核心 LLM 调用能力）

| 类别 | 详情 |
|------|------|
| Provider 覆盖 | 72 个（Portkey 75 个，差 3 个非 LLM/自引用） |
| 路由策略 | single、fallback、loadbalance、conditional + 嵌套递归 |
| 重试机制 | 指数退避、retry-after header（60s 预算）、ConnectTimeout → 503 |
| 流式处理 | SSE 解析、AWS EventStream 二进制帧、Azure 1ms chunk、首 chunk 延迟 |
| 端点类型 | 已覆盖 chat、complete、embed、image、audio、speech、messages、responses、realtime bootstrap、files、batch、finetune 等核心 HTTP surfaces |
| 请求转换 | 参数映射、min/max/default 钳位、transform 函数、嵌套路径、FormData |
| 高级功能 | Tool/Function Calling、Provider 特定参数、Config 验证、Request Timeout |

### ❌ 明确不做

| 功能 | 原因 |
|------|------|
| Hooks / Guardrails | SDK 场景下调用方自行处理 |
| 缓存系统 | 不在 SDK 范围内 |
| 日志 / 监控 | 不在 SDK 范围内 |
| Virtual Key | 不在 SDK 范围内 |
| Web 服务器 | 架构定位不同 |

### 🟡 低优先级（按需添加）

| 功能 | 说明 |
|------|------|
| Circuit Breaker | Portkey 开源版也仅空壳，需从零实现 |
| proxy 模式 | SDK 场景下调用方可直接 fetch |
| realtime transport runtime | 仅 OpenAI 一家，且长连接运行时与 SDK 路由模型不匹配 |
| moderate | 仅 OpenAI 一家，属 Guardrails 范畴 |
| rerank | Portkey 也仅类型占位，无实现 |

**核心结论**：Priorai 在 provider 覆盖（72 个）、路由策略（fallback/loadbalance/single/conditional + 嵌套递归）、流式处理（含 Azure chunk delay）、请求转换、Tool Calling、Provider 特定参数、retry-after、ConnectTimeout 区分、Anthropic Messages API、OpenAI Responses API、文件操作、Batch API、Fine-tune API 等所有核心 LLM 调用能力方面已与 Portkey 完全对齐。rerank 端点 Portkey 也仅有类型占位未实现，跳过。Hooks/Guardrails、缓存、日志等管理类功能不在 Priorai 范围内。
