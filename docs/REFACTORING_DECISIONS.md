# Chainr 重构：架构决策与实施方案

> 核心策略：直接采用 Portkey 的文件结构和代码，仅剥离外部依赖（Hono、@smithy）。
> 不做不必要的创新，不重新发明轮子。

**创建时间**: 2026-04-24
**最后更新**: 2026-04-24 13:08 EEST
**状态**: 📋 方案已确定，待实施

---

## 1. 核心原则

**一句话总结**：Portkey 能用的结构和文件，我们直接用。只做依赖剥离，不做架构重设计。

| 原则 | 说明 |
|------|------|
| **直接复用** | Portkey 的 provider 文件直接使用，不重写 |
| **最小改造** | 只改必须改的：剥离 Hono Context、替换 @smithy |
| **结构对齐** | 目录结构、文件命名、导出模式完全对齐 Portkey |
| **桥接文件** | 创建 `types.ts`、`utils.ts`、`index.ts` 三个桥接文件，提供 Portkey providers 所需的类型和工具函数 |

---

## 2. 当前状态

### 2.1 已完成

- 70 个 provider 目录已从 Portkey 复制到 `src/providers/`
- 排除了不需要的文件（Batch、Finetune、File、upload 等）
- 核心代码（`src/core/`）正常工作，370 个测试通过
- Build 通过（tsup 只打包 `src/index.ts` 引用链）

### 2.2 未完成（providers 是死代码）

| 缺失项 | 说明 |
|--------|------|
| `src/providers/types.ts` | 不存在。70 个 provider 都 import 它 |
| `src/providers/utils.ts` | 不存在。多个 provider 依赖 `generateErrorResponse` 等函数 |
| `src/providers/index.ts` | 不存在。Provider 注册表，连接 providers 和 Router |
| Hono 依赖 | 3 个文件仍 import `Context from 'hono'` |
| @smithy 依赖 | 1 个文件（bedrock/utils.ts）依赖 `@smithy/signature-v4` |
| Provider index.ts 清理 | 部分 provider 的 index.ts 引用了被排除的文件（imageGenerate、createSpeech 等） |
| Router 集成 | Strategy 文件仍使用 `transformRequest.ts` 的 switch，未接入 providers |

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

### 3.2 需要剥离的外部依赖（4 个文件）

| 文件 | 依赖 | 处理方式 |
|------|------|----------|
| `src/providers/bedrock/api.ts` | `import { Context } from 'hono'` | 移除 Context 参数，改用 providerOptions 传入 |
| `src/providers/bedrock/utils.ts` | `@smithy/signature-v4` | 替换为 `src/core/awsSigV4.ts` |
| `src/providers/google-vertex-ai/utils.ts` | `import { Context } from 'hono'` | 移除 Context 参数 |

> 注意：Hono 的 `Context` 在 Portkey 中用于读取环境变量和请求头。
> Chainr 中这些信息通过 `providerOptions` 对象传入，不需要 Hono。

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

### Phase 2：剥离 Hono 和 @smithy

逐个修改 4 个文件：
1. `bedrock/api.ts` — 移除 `Context` 参数，从 providerOptions 读取 AWS 配置
2. `bedrock/utils.ts` — 替换 `@smithy/signature-v4` 为 `src/core/awsSigV4.ts`
3. `google-vertex-ai/utils.ts` — 移除 `Context` 参数

**验证**：`grep -r "from 'hono'" src/providers/` 和 `grep -r "@smithy" src/providers/` 均无结果。

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

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 清理 index.ts 无效引用工作量大 | 逐个 provider 审查，不用脚本批量改 |
| Bedrock @smithy 替换可能影响签名 | Chainr 已有经过测试的 `awsSigV4.ts` |
| 注册表导入 70 个 provider 影响打包体积 | tsup tree-shaking 会处理；或后续按需改为动态导入 |
| 现有 370 测试可能因 Router 改造失败 | Phase 4 分步进行，每步验证测试 |

---

## 7. 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/providers/types.ts` | ⬜ 待创建 | 从 Portkey 复制 + 最小修改 |
| `src/providers/utils.ts` | ⬜ 待创建 | 从 Portkey 复制 + 最小修改 |
| `src/providers/index.ts` | ⬜ 待创建 | 静态注册表 |
| `src/providers/bedrock/api.ts` | ⬜ 待修改 | 剥离 Hono Context |
| `src/providers/bedrock/utils.ts` | ⬜ 待修改 | 替换 @smithy → awsSigV4.ts |
| `src/providers/google-vertex-ai/utils.ts` | ⬜ 待修改 | 剥离 Hono Context |
| `src/providers/*/index.ts` | ⬜ 待清理 | 删除无效 import |
| `src/core/transformRequest.ts` | ⬜ 待精简 | Phase 5 渐进替换 |
| `src/core/transformResponse.ts` | ⬜ 待精简 | Phase 5 渐进替换 |
