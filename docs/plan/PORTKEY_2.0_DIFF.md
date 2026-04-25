# Portkey 2.0.0 分支 vs main 差异分析

**创建时间**: 2026-04-25 06:59 EEST
**Portkey main**: v1.15.2+17 (351692fd) — Chainr 当前参考版本
**Portkey 2.0.0**: 分支 (8febc1dc) — Pre-Release，比 main 多 30 commits
**总变更**: 687 文件，+141,463 / -25,098 行
**Provider 层变更**: 212 文件，+10,308 / -1,870 行

---

## 一、与 Chainr 无关的变更（不迁移）

### 1.1 插件系统 (`plugins/`)
- Lasso Security v3 升级
- Zscaler AI Guard 新增
- Akto 安全插件新增
- Chainr 是嵌入式 SDK，不需要安全审计插件

### 1.2 服务器基础设施 (`src/services/`, `src/middlewares/`, `src/handlers/`, `src/mcp/`)
- MCP Gateway 功能
- 缓存、限流、熔断器 (`circuitBreaker.ts`, `rateLimiter.ts`, `cacheKeyTracker.ts`)
- 定价计算 (`pricing.ts`)
- 请求路由和中间件
- 这些是网关服务能力，SDK 不需要

### 1.3 认证工具 (`src/utils/awsAuth.ts`, `azureAuth.ts`, `gcpAuth.ts`)
- 独立的云认证实现
- Chainr 已有自己的认证方案

### 1.4 pricing.ts（几乎每个 provider 都新增了）
- 约 40+ 个 provider 新增了 `pricing.ts` 文件
- 用于网关层的成本追踪和计费
- Chainr 不做计费，全部跳过

---

## 二、可能有价值的 Provider 变更

### 2.1 新增 Provider（4 个）

| Provider | 文件 | 说明 | 建议 |
|----------|------|------|------|
| `databricks` | api.ts, index.ts | OpenAI 兼容，轻量 | ⬜ 按需引入 |
| `latitude` | api.ts, chatComplete.ts, index.ts, types.ts | 独立转换逻辑 | ⬜ 按需引入 |
| `pinecone` | api.ts, index.ts, rerank.ts, types.ts | Rerank 端点 | ⬜ 按需引入 |
| `portkey` | api.ts, createBatch.ts, createFinetune.ts, getBatchOutput.ts, index.ts, uploadFile.ts, utils.ts | Portkey 自身作为 provider（嵌套代理） | ❌ 不需要 |

### 2.2 新增 Rerank 端点支持

| Provider | 文件 | 行数 |
|----------|------|------|
| `bedrock` | rerank.ts | +125 |
| `cohere` | rerank.ts | +105 |
| `jina` | rerank.ts, types.ts | +156 |
| `voyage` | rerank.ts, types.ts | +161 |

- 需要 `src/types/rerankRequestBody.ts`（+72 行）配合
- **建议**: ⬜ Rerank 是独立功能，按需引入

### 2.3 重大重构 — Google/Vertex AI

```
google-vertex-ai/chatComplete.ts    | 538 ++++-----------  (大幅精简)
google-vertex-ai/utils.ts           | 316 +++++++--
google-vertex-ai/getBatchOutput.ts  | 257 +++++--
google/chatComplete.ts              | 264 +++++---
```

- chatComplete.ts 被大幅重构精简
- 新增大量测试：media-resolution、thought-signature、tool-message-content
- **建议**: ⚠️ 需要仔细评估，可能包含 bug 修复和新模型支持

### 2.4 Bedrock 大幅增强

```
bedrock/utils.ts       | 743 +++++++++++-------  (最大变更)
bedrock/messages.ts    | 185 +++--
bedrock/api.ts         | 106 ++-
bedrock/index.ts       |  54 +-
bedrock/types.ts       | 127 ++--
bedrock/chatComplete.ts|  48 +-
bedrock/uploadFile.ts  | 396 ++++++-----
```

- **建议**: ⚠️ 变更量最大，需要逐文件对比

### 2.5 Anthropic 工具增强

```
anthropic/chatComplete.ts  | 149 +++--
anthropic/__tests__/tool-transform.test.ts | +68 (新增)
```

- strict 参数透传到工具定义
- **建议**: ⬜ 小改动，可快速同步

### 2.6 Azure OpenAI 增强

```
azure-openai/utils.ts         | 143 ++--
azure-openai/api.ts           |  55 +-
azure-openai/imageEdit.ts     |  16 + (新增)
azure-openai/imageGenerate.ts |  22 +
azure-openai/getBatchOutput.ts|  92 ++-
```

- **建议**: ⬜ 按需评估

### 2.7 types.ts 大幅扩展

```
src/providers/types.ts | 240 ++++++-
src/types/requestBody.ts | 85 +-
```

- Provider 类型定义大幅扩展
- **建议**: ⚠️ 需要对比，可能影响接口兼容性

### 2.8 其他小改动

- `together-ai/chatComplete.ts` +98 行（较大增强）
- `open-ai-base/index.ts` +73 行
- `fireworks-ai/uploadFile.ts` +109 行
- `x-ai` 新增 imageGenerate
- `z-ai` 新增 imageGenerate
- 多个 provider 的 `chatComplete.ts` 有 4-10 行小修复

---

## 三、结论与建议

**2.0.0 的本质**: 把企业版功能（插件、MCP、计费、缓存、限流）合并到开源版。Provider 层的变更主要是：
1. 每个 provider 加了 `pricing.ts`（我们不需要）
2. 新增 rerank 端点（独立功能，按需引入）
3. Google/Vertex AI 和 Bedrock 有重大重构（需要仔细评估是否包含我们需要的修复）
4. 4 个新 provider（按需引入）

**优先级建议**:
1. ⚠️ 先对比 Google/Vertex AI 和 Bedrock 的重构，确认是否有 bug 修复或新模型支持
2. ⬜ Anthropic strict 工具参数 — 小改动，快速同步
3. ⬜ Rerank 端点 — 独立功能，需要时再加
4. ⬜ 新 Provider — 按需引入
