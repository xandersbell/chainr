# Chainr 重构：架构决策与实施方案

> 核心策略：直接采用 Portkey 的文件结构和代码，仅剥离 Hono 框架依赖。
> 成熟的外部依赖（如 AWS SDK）直接使用，不重新发明轮子。

**创建时间**: 2026-04-24
**最后更新**: 2026-04-24 15:52 EEST
**状态**: ✅ TS 错误清零（Phase 1-4 完成，所有 provider 文件类型安全）

---

## 1. 核心原则

**一句话总结**：Portkey 能用的结构和文件，我们直接用。只做依赖剥离，不做架构重设计。

| 原则 | 说明 |
|------|------|
| **直接复用** | Portkey 的 provider 文件直接使用，不重写 |
| **最小改造** | 只改必须改的：剥离 Hono Context（SDK 不需要 Web 框架） |
| **结构对齐** | 目录结构、文件命名、导出模式完全对齐 Portkey |
| **桥接文件** | 创建 `types.ts`、`utils.ts`、`index.ts` 三个桥接文件，提供 Portkey providers 所需的类型和工具函数 |

---

## 2. 当前状态

### 2.1 已完成

- 70 个 provider 目录已从 Portkey 复制到 `src/providers/`（+ google 目录补充复制）
- 排除了不需要的文件（Batch、Finetune、File、upload 等）
- 核心代码（`src/core/`）正常工作，370 个测试通过
- Build 通过（tsup 只打包 `src/index.ts` 引用链）
- ✅ Phase 1：桥接文件已创建（types.ts、utils.ts、utils/finishReasonMap.ts、embedRequestBody.ts、GatewayError.ts、env.ts）
- ✅ Phase 2：Hono 依赖已全部剥离，`awsSigV4.ts` 已删除
- ✅ Phase 3：17 个 provider 的 75 个无效 import 已清理
- ✅ Phase 4：注册表 `src/providers/index.ts` 已创建（67 个 provider），`providerRequest.ts` 集成层已实现
- ✅ `@smithy/signature-v4` + `@aws-crypto/sha256-js` 已安装为正式依赖
- ✅ 所有 strategy 文件已改用 `bedrock/utils.ts` 的 `generateAWSHeaders`
- TS 错误从 1279 降至 **0**
- 测试：384 个通过（370 原有 + 14 新增 provider 注册表/请求构建测试）

### 2.2 未完成

| 缺失项 | 说明 |
|--------|------|
| Router 集成 | Strategy 文件仍使用 `transformRequest.ts` 的 switch，未接入 `buildProviderRequest` |
| `transformRequest.ts` 精简 | Phase 5：渐进替换 switch case 为 provider 配置 |

---

## 3. 差距分析

### 3.1 需要创建的桥接文件（3 个）

#### `src/providers/types.ts`

Providers 实际 import 的类型（从代码中提取）：

```
ProviderAPIConfig    — api.ts 使用，定义 getBaseURL/headers/getEndpoint
ProviderConfig       — index.ts 使用，单个功能的参数映射配置
ProviderConfigs      — index.ts 使用，provider 的完整配置导出
ChatCompletionResponse — chatComplete.ts 使用，响应类型
CompletionResponse   — complete.ts 使用
ErrorResponse        — 错误响应类型
endpointStrings      — endpoint 路径字符串类型
ParameterConfig      — 参数映射配置
```

**策略**：直接从 Portkey 的 `src/providers/types.ts` 复制，删除 Chainr 不需要的类型（FinetuneRequest、Logprobs、BedrockMessagesParams 等可按需保留）。

#### `src/providers/utils.ts`

Providers 实际 import 的函数：

```
generateErrorResponse              — 生成标准错误响应
generateInvalidProviderResponseError — 生成无效响应错误
splitString                        — 字符串分割工具
```

**策略**：直接从 Portkey 的 `src/providers/utils.ts` 复制对应函数。

#### `src/providers/index.ts`

静态导入所有 provider 配置，导出注册表 `Record<string, ProviderConfigs>`。

**策略**：参考 Portkey 的 `src/providers/index.ts`，静态导入 70 个 provider。

### 3.2 需要剥离的 Hono 依赖（6 个文件）

| 文件 | 依赖 | 处理方式 |
|------|------|----------|
| `src/providers/bedrock/api.ts` | `import { Context } from 'hono'` | 移除 Context 参数，改用 providerOptions 传入 |
| `src/providers/bedrock/utils.ts` | `import { Context } from 'hono'` + `env(c)` | 移除 Context，用 `Environment()` 替代 `env(c)` |
| `src/providers/google-vertex-ai/utils.ts` | `import { Context } from 'hono'` + `env(c)` | 移除 Context，删除缓存相关代码 |
| `src/providers/azure-openai/api.ts` | `import { getRuntimeKey } from 'hono/adapter'` | ✅ 已完成 |
| `src/providers/azure-ai-inference/api.ts` | `import { getRuntimeKey } from 'hono/adapter'` | ✅ 已完成 |
| `src/providers/sagemaker/api.ts` | `import { env } from 'hono/adapter'` | ✅ 已完成 |

> `@smithy/signature-v4` 和 `@aws-crypto/sha256-js` 已安装为正式依赖，bedrock/utils.ts 保持 Portkey 原版用法。
> Hono 的 `Context` 在 Portkey 中用于读取环境变量和请求头。Chainr 中通过 `providerOptions` + `Environment()` 替代。

### 3.3 需要清理的无效 import

部分 provider 的 `index.ts` 引用了被 rsync --exclude 排除的文件：

```typescript
// 典型的无效引用（文件不存在）
import { OpenAIImageGenerateConfig } from './imageGenerate';
import { OpenAICreateSpeechConfig } from './createSpeech';
import { OpenAICreateTranscriptionConfig } from './createTranscription';
```

**策略**：逐个 provider 检查 index.ts，删除引用不存在文件的 import 和对应的配置项。不用脚本批量改，逐个审查。

---

## 4. 实施计划

### Phase 1：创建桥接文件（types.ts + utils.ts）

从 Portkey 复制 `src/providers/types.ts` 和 `src/providers/utils.ts`，做最小修改：
- 删除 Chainr 不需要的类型定义
- 确保导出的类型覆盖所有 provider 的 import 需求
- `utils.ts` 中如有 Hono 依赖也需剥离

**验证**：`npx tsc --noEmit` 错误数应大幅下降（当前 1151 个 provider 错误中大部分是缺少 types/utils 导致的）。

### Phase 2：剥离 Hono

逐个修改剩余 3 个文件（azure-openai、azure-ai-inference、sagemaker 已完成）：
1. `bedrock/api.ts` — 移除 `Context` 参数，从 providerOptions 读取 AWS 配置
2. `bedrock/utils.ts` — 移除 `Context` 和 `env(c)`，保留 `@smithy/signature-v4`（已安装）
3. `google-vertex-ai/utils.ts` — 移除 `Context` 参数，删除 Hono 缓存调用

同时删除 `src/core/awsSigV4.ts`，更新 core 代码中的 AWS 签名调用改用 bedrock/utils.ts 导出。

**验证**：`grep -r "from 'hono'" src/` 无结果。

### Phase 3：清理 provider index.ts 无效引用

逐个检查每个 provider 的 `index.ts`，删除引用不存在文件的 import 行和对应配置。

**验证**：`npx tsc --noEmit` 在 `src/providers/` 中的错误数应接近 0。

### Phase 4：创建注册表（index.ts）+ Router 集成

1. 创建 `src/providers/index.ts`，静态导入所有 provider
2. 修改 Strategy 文件，通过注册表获取 provider 配置
3. 逐步替换 `transformRequest.ts` 中的 switch case

**验证**：370 个现有测试仍然通过 + 新增 provider 注册表测试。

### Phase 5：清理旧代码

当所有 provider 通过新结构工作后：
- 删除 `transformRequest.ts` 中已被 provider 配置替代的 case
- 删除 `transformResponse.ts` 中已被 provider 配置替代的函数
- 保留 default case 作为 OpenAI-compatible fallback

---

## 5. 关键决策

### 5.1 静态导入 vs 动态导入

**决策**：静态导入 + 注册表

Portkey 使用 `await import(\`../providers/${provider}/index.js\`)` 动态导入。
Chainr 的 Router 架构是同步的，改造为异步成本高且不必要。
使用静态导入注册表 `Providers[provider]` 即可。

### 5.2 transformRequest.ts 的去留

**决策**：渐进替换

Phase 4 完成后，provider 配置接管请求/响应转换。
`transformRequest.ts` 中被替代的 case 逐步删除。
保留 default case 处理 OpenAI-compatible providers（52 个 passthrough provider）。

### 5.3 为什么不自己设计抽象层

**决策**：不设计，直接用 Portkey 的

Portkey 的 `ProviderAPIConfig`/`ProviderConfig`/`ProviderConfigs` 类型体系已经被 70+ provider 验证过。
自己设计新的抽象层 = 重新发明轮子 + 无法直接 cp Portkey 更新。
唯一的适配点是剥离 Hono Context（用 providerOptions 替代）。

### 5.4 依赖策略

**决策**：成熟的外部依赖直接用，不执着于零依赖

- `@smithy/signature-v4` + `@aws-crypto/sha256-js` → 直接使用 AWS 官方签名库
- Hono → 必须剥离（Web 框架不属于 SDK 场景）
- 判断标准：该依赖在 SDK 嵌入场景下是否合理

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 清理 index.ts 无效引用工作量大 | 逐个 provider 审查，不用脚本批量改 |
| 注册表导入 70 个 provider 影响打包体积 | tsup tree-shaking 会处理；或后续按需改为动态导入 |
| 现有 370 测试可能因 Router 改造失败 | Phase 4 分步进行，每步验证测试 |

---

## 7. 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/providers/types.ts` | ✅ 已创建 | 从 Portkey 复制 + 适配 |
| `src/providers/utils.ts` | ✅ 已创建 | 从 Portkey 复制 + 适配 |
| `src/providers/utils/finishReasonMap.ts` | ✅ 已创建 | finish reason 映射 |
| `src/types/embedRequestBody.ts` | ✅ 已创建 | embedding 请求类型 |
| `src/errors/GatewayError.ts` | ✅ 已创建 | 错误类 |
| `src/utils/env.ts` | ✅ 已创建 | 替代 Hono env() |
| `src/providers/google/` | ✅ 已复制 | 补充复制 google provider |
| `src/providers/azure-openai/api.ts` | ✅ 已修改 | Hono 已剥离 |
| `src/providers/azure-ai-inference/api.ts` | ✅ 已修改 | Hono 已剥离 |
| `src/providers/sagemaker/api.ts` | ✅ 已修改 | Hono 已剥离 |
| `src/providers/bedrock/api.ts` | ✅ 已修改 | Hono 已剥离 |
| `src/providers/bedrock/utils.ts` | ✅ 已修改 | Hono 已剥离（保留 @smithy） |
| `src/providers/google-vertex-ai/utils.ts` | ✅ 已修改 | Hono 已剥离 |
| `src/providers/index.ts` | ✅ 已创建 | 67 个 provider 静态注册表 |
| `src/providers/*/index.ts` | ✅ 已清理 | 17 个 provider 的 75 个无效 import 已删除 |
| `src/core/providerRequest.ts` | ✅ 已创建 | Portkey 风格的请求构建器 |
| `src/core/awsSigV4.ts` | ✅ 已删除 | 被 bedrock/utils.ts (@smithy) 替代 |
| `src/core/transformRequest.ts` | ⬜ 待精简 | Phase 5 渐进替换，已添加 perplexity/lemonfox 别名 |
| `src/core/transformResponse.ts` | ⬜ 待精简 | Phase 5 渐进替换 |
