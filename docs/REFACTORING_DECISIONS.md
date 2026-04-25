# Priorai 重构：架构决策与实施方案

> 核心策略：完全对齐 Portkey 的 Provider 架构，剥离 Hono 框架依赖。
> 成熟的外部依赖（如 AWS SDK）直接使用，不重新发明轮子。

**创建时间**: 2026-04-24
**最后更新**: 2026-04-24 16:49 EEST
**状态**: ✅ Phase 5 已完成 — TS 0 错误，195 测试通过，68 个 provider 已注册，transformRequest.ts + transformResponse.ts 已删除

---

## 1. 核心原则

**一句话总结**：完全采用 Portkey 的 Provider 架构（ProviderConfig 参数映射 + api.ts URL/headers + ResponseTransform），彻底替换 Priorai 早期的手写 switch-case 实现。

| 原则 | 说明 |
|------|------|
| **架构对齐** | 请求构建流程完全对齐 Portkey：ProviderConfig → api.ts → ResponseTransform |
| **直接复用** | Portkey 的 provider 文件直接使用，不重写 |
| **最小改造** | 只改必须改的：剥离 Hono Context（SDK 不需要 Web 框架） |
| **桥接文件** | `types.ts`、`utils.ts`、`index.ts` 三个桥接文件提供 Portkey providers 所需的类型和工具函数 |

---

## 2. Portkey 请求流程分析

Portkey 的完整调用链（Priorai 需要对齐的目标架构）：

```
Request
  → tryTargetsRecursively()           // 遍历 targets，支持 fallback/loadbalance
    → tryPost()                       // 对单个 target 发起请求
      → transformToProviderRequest()  // 用 ProviderConfig 映射参数
      → getBaseURL() + getEndpoint()  // 从 api.ts 构建 URL
      → headers()                     // 从 api.ts 构建 headers
      → fetch()                       // 发请求
      → responseTransform()           // 用 provider 的 ResponseTransform 转换响应
```

关键点：**Portkey 没有集中式的 switch-case 文件**。每个 provider 目录自包含：
- `api.ts` — `ProviderAPIConfig`：getBaseURL、getEndpoint、headers
- `chatComplete.ts` — `ProviderConfig`：参数映射 + `ChatCompletionResponseTransform`
- `embed.ts` — embedding 参数映射 + 响应转换
- `index.ts` — 导出 `ProviderConfigs`，注册所有 endpoint 的配置

---

## 3. 当前状态

### 3.1 已完成（Phase 1-5）

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 桥接文件（types.ts、utils.ts、finishReasonMap.ts、embedRequestBody.ts、GatewayError.ts、env.ts） | ✅ |
| Phase 2 | Hono 依赖全部剥离，awsSigV4.ts 删除，改用 @smithy/signature-v4 | ✅ |
| Phase 3 | 17 个 provider 的 75 个无效 import 清理 | ✅ |
| Phase 4 | Provider 注册表（68 个 provider）+ providerRequest.ts 集成层 | ✅ |
| TS 清零 | Options/Params/endpointStrings 扩展，50+ provider 文件类型修复 | ✅ |
| Phase 5 | 删除 transformRequest.ts + transformResponse.ts，Strategy/Router 全部接入注册表 | ✅ |

- 68 个 provider 已注册到 `src/providers/index.ts`
- `buildProviderRequest()` 支持多 endpoint（chatComplete、embed、imageGenerate、createTranscription、createSpeech、createTranslation）
- `transformProviderResponse()` 使用 provider 注册表的 responseTransforms
- 3 个 Strategy 文件 + Router 全部使用 `buildProviderRequest()`
- `transformRequest.ts`（1719 行）和 `transformResponse.ts`（396 行）已删除
- TS 错误：**0**
- 测试：195 个通过

### 3.2 待完成

| 缺失项 | 说明 |
|--------|------|
| Streaming transform 替换 | 8 个 `transform*Stream.ts` 文件可被 provider 的 `stream-chatComplete` responseTransform 替代（可选优化） |

---

## 4. Phase 5 实施方案：彻底替换 transformRequest/Response

### 4.1 目标架构

```
Router
  → Strategy.execute(targets, params)
    → buildProviderRequest(params, provider, target, endpoint)
      → Providers[provider].api.getBaseURL()     // URL
      → Providers[provider].api.getEndpoint()     // endpoint path
      → Providers[provider].api.headers()         // headers
      → transformUsingProviderConfig(config, params) // body
    → fetch(url, { headers, body })
    → transformProviderResponse(response, provider, endpoint)
      → Providers[provider].responseTransforms[endpoint]()
```

### 4.2 需要做的事

#### Step 1：扩展 `buildProviderRequest` 支持多 endpoint

当前 `buildProviderRequest()` 硬编码了 `chatComplete`。需要接受 `endpoint` 参数，支持 `embed`、`imageGenerate`、`createTranscription`、`createSpeech`、`createTranslation` 等。

#### Step 2：创建 `transformProviderResponse` 函数

从注册表获取 provider 的 `responseTransforms[endpoint]`，调用对应的转换函数。对齐 Portkey 的 `responseHandler()` 逻辑。

#### Step 3：修改 Strategy 文件

将 `transformRequest()` 调用替换为 `buildProviderRequest()`。3 个 Strategy 文件各有 2 处调用（tryTarget + tryTargetStream），共 6 处。

#### Step 4：修改 Router

Router 中的 `executeEmbeddings`、`executeImageGeneration` 等方法不再调用 `transformEmbedRequest` 等函数，改为调用 `buildProviderRequest(params, provider, target, 'embed')` 等。

#### Step 5：删除 transformRequest.ts 和 transformResponse.ts

当所有路径都走注册表后，这两个文件可以完全删除。

#### Step 6：streaming 响应转换

Portkey 的 streaming 也走 `responseTransforms['stream-chatComplete']`。Priorai 当前的 8 个 `transform*Stream.ts` 文件需要评估是否可以被 provider 的 stream transform 替代。

### 4.3 不做的事

- 不改 Strategy 类的 fallback/loadbalance/single 设计 — 这是 Priorai 自己的路由层
- 不改 RetryHandler — 重试逻辑独立于请求构建
- 不改 provider 目录下的任何文件 — 它们已经是 Portkey 格式

---

## 5. 关键决策

### 5.1 静态导入 vs 动态导入

**决策**：静态导入 + 注册表

Portkey 使用动态 `await import()` 加载 provider。Priorai 使用静态导入注册表 `Providers[provider]`。
理由：SDK 嵌入场景下，静态导入更简单可靠，tsup tree-shaking 处理体积。

### 5.2 transformRequest.ts 的去留

**决策**：完全删除，不做渐进替换

~~旧决策：渐进替换，保留 default case 作为 OpenAI-compatible fallback。~~

新决策（2026-04-24）：`transformRequest.ts` 的 66 个 switch case 全部被 68 个 provider 的 ProviderConfig + api.ts 替代。OpenAI-compatible providers 在 Portkey 中也有各自的 provider 目录（大多数 chatComplete 配置直接复用 OpenAI 的），不需要 default case。

### 5.3 transformResponse.ts 的去留

**决策**：完全删除

每个 provider 目录下已有 `ChatCompletionResponseTransform`、`EmbedResponseTransform` 等函数。创建统一的 `transformProviderResponse()` 从注册表调用即可。

### 5.4 为什么不自己设计抽象层

**决策**：不设计，直接用 Portkey 的

Portkey 的 `ProviderAPIConfig`/`ProviderConfig`/`ProviderConfigs` 类型体系已被 70+ provider 验证。唯一的适配点是剥离 Hono Context（用 providerOptions 替代）。

### 5.5 依赖策略

**决策**：成熟的外部依赖直接用，不执着于零依赖

- `@smithy/signature-v4` + `@aws-crypto/sha256-js` → AWS 官方签名库
- Hono → 必须剥离（Web 框架不属于 SDK 场景）
- 判断标准：该依赖在 SDK 嵌入场景下是否合理

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 注册表 provider 的 ResponseTransform 输出格式与旧 transformResponse 不一致 | 逐个 provider 对比测试，确保输出格式一致 |
| Streaming transform 替换复杂度高 | 可分阶段：先替换非 streaming，再替换 streaming |
| 删除 transformRequest.ts 后 embed/image/audio 路径断裂 | 先确保 buildProviderRequest 支持所有 endpoint 再删除 |
| 384 个现有测试可能因架构替换失败 | 每步验证测试，保持绿色 |

---

## 7. 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/providers/types.ts` | ✅ 已创建 | 从 Portkey 复制 + 适配，含 endpointStrings 扩展 |
| `src/providers/utils.ts` | ✅ 已创建 | 从 Portkey 复制 + 适配 |
| `src/providers/utils/finishReasonMap.ts` | ✅ 已创建 | finish reason 映射 |
| `src/types/requestBody.ts` | ✅ 已扩展 | Options（49 字段）、Params（18 字段）、类型导出 |
| `src/types/embedRequestBody.ts` | ✅ 已创建 | embedding 请求类型 |
| `src/errors/GatewayError.ts` | ✅ 已创建 | 错误类 |
| `src/utils/env.ts` | ✅ 已创建 | 替代 Hono env() |
| `src/globals.ts` | ✅ 已对齐 | 对齐 Portkey 常量 + CONTENT_TYPES + MIME 映射 |
| `src/providers/index.ts` | ✅ 已创建 | 68 个 provider 静态注册表 |
| `src/providers/*/index.ts` | ✅ 已清理 | 17 个 provider 的 75 个无效 import 已删除 |
| `src/core/providerRequest.ts` | ✅ 已完成 | 多 endpoint 请求构建 + transformProviderResponse 响应转换 |
| `src/core/awsSigV4.ts` | ✅ 已删除 | 被 bedrock/utils.ts (@smithy) 替代 |
| `src/core/transformRequest.ts` | ✅ 已删除 | 1719 行 switch-case，被 provider 注册表完全替代 |
| `src/core/transformResponse.ts` | ✅ 已删除 | 396 行，被 provider ResponseTransform 替代 |
| `src/core/transform*Stream.ts` (8 个) | ⬜ 待评估 | 可被 provider stream transform 替代（可选优化） |
