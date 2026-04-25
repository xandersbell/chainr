# Portkey 2.0.0 分支 vs main 差异分析

**创建时间**: 2026-04-25 06:59 EEST
**最后更新**: 2026-04-25 07:44 EEST
**Portkey main**: v1.15.2+17 (351692fd) — Chainr 当前参考版本
**Portkey 2.0.0**: 分支 (8febc1dc) — Pre-Release，比 main 多 30 commits
**总变更**: 687 文件，+141,463 / -25,098 行
**Provider 层变更**: 212 文件，+10,308 / -1,870 行

---

## 一、与 Chainr 无关的变更（不迁移）

- 插件系统 (`plugins/`) — Lasso Security v3、Zscaler、Akto
- 服务器基础设施 — MCP Gateway、缓存、限流、熔断器
- 认证工具 (`awsAuth.ts`, `azureAuth.ts`, `gcpAuth.ts`) — Chainr 已有自己的方案
- `pricing.ts` — 约 40+ 个 provider 新增，用于网关计费，全部跳过
- Bedrock 凭证链重构（Web Identity/Pod Identity/ECS/IMDS）— 服务端部署场景
- `portkey` provider — Portkey 自身作为 provider（嵌套代理），不需要

---

## 二、需要同步的 Bug 修复（高优先级）

### 2.1 ✅ Anthropic — prompt_tokens 未包含缓存 token

非流式和流式响应中，`prompt_tokens` 只返回 `input_tokens`，没有加上 `cache_read_input_tokens` 和 `cache_creation_input_tokens`。

```typescript
// 修复前
prompt_tokens: input_tokens,
// 修复后
const promptTokens = input_tokens + (cache_read_input_tokens ?? 0) + (cache_creation_input_tokens ?? 0);
prompt_tokens: promptTokens,
```

### 2.2 ✅ Anthropic — `response?.usage` 缺少空值保护

```typescript
// 修复前 — usage 为 undefined 时抛异常
const { input_tokens = 0, ... } = response?.usage;
// 修复后
const { input_tokens = 0, ... } = response?.usage ?? {};
```

### 2.3 ✅ Anthropic — 流式 delta 缺少 `role: 'assistant'`

流式中间 chunk 的 delta 对象缺少 `role` 字段，影响 OpenAI 兼容性。

### 2.4 ✅ Google/Vertex — `content?.parts?` 可选链缺失（crash 级）

Gemini 在 `MALFORMED_FUNCTION_CALL`、`IMAGE_SAFETY` 等 finishReason 下返回空 content，不做可选链直接 crash。

```typescript
// 修复前
if (generation.content.parts[0]?.text) {
// 修复后
if (generation.content?.parts?.[0]?.text) {
```

### 2.5 ✅ Google/Vertex — `finishMessage` 兜底处理

content 为空但 `finishMessage` 有错误详情时，之前返回空响应。

### 2.6 ✅ Google/Vertex — tool message `output` → `content` 字段名修正

OpenAI tool message 转 Gemini `functionResponse` 时字段名错误，且不支持数组 content。

```typescript
// 修复前
response: { output: message.content ?? '' },
// 修复后
response: { content: message.content },
// + 数组 content 支持
```

### 2.7 ✅ Google/Vertex — `responseSchema` → `responseJsonSchema`

json_schema 处理方式变更，新版 Gemini API 支持原生 JSON Schema。

### 2.8 ✅ Google/Vertex — Schema 白名单机制

`recursivelyDeleteUnsupportedParameters` 从黑名单改为白名单，只保留 Vertex AI 支持的字段。新增 `type` 数组转 `anyOf` 处理。

### 2.9 ✅ Google/Vertex — completion_tokens 漏算 thinking tokens

```typescript
// 修复前
completion_tokens: candidatesTokenCount,
// 修复后
completion_tokens: candidatesTokenCount + thoughtsTokenCount,
```

### 2.10 ✅ Google/Vertex — 音频格式映射修正

`opus` 从错误的 `audio/ogg` 改为 `audio/opus`，新增 `pcm`、`aac`、`m4a` 等格式。

### 2.11 ✅ Google/Vertex — Schema 自引用处理

`derefer` 函数中自引用时从返回原始 node（含 $ref）改为返回 `{ type: 'object' }`。

### 2.12 ✅ Google/Vertex — Tool 参数处理顺序

先 transform 再 delete，而非先 delete 再 transform。

### 2.13 ✅ Bedrock — document block 缺少 name/citations/text source

messages.ts 中 document block 转换不完整。

### 2.14 ✅ Bedrock — 自动补 text block

缺少自动补充 text block 的逻辑。

### 2.15 ✅ Bedrock — thinking 流式判断修复

messages.ts 中 thinking 流式判断逻辑有误。

### 2.16 ✅ Bedrock — arguments 空值保护

chatComplete.ts 中 tool call arguments 缺少空值保护。

---

## 三、需要同步的新功能（中高优先级）

### 3.1 ✅ Anthropic — `strict` 参数透传（约束解码）

工具定义中新增 `strict?: boolean`，透传到 Anthropic API。

### 3.2 ✅ Anthropic — `output_config`（json_schema + reasoning_effort）

新增 `buildAnthropicOutputConfig()` 函数，将 `response_format` 和 `reasoning_effort` 映射到 Anthropic 的 `output_config`。

### 3.3 ✅ Anthropic — `max_tokens` 默认值 64000

### 3.4 ✅ Anthropic — `refusal` / `model_context_window_exceeded` 停止原因

### 3.5 ✅ Anthropic — `chunkPatternsToIgnore` 流式过滤扩展

### 3.6 ✅ Google/Vertex — Gemini 2.5 vs 3.0+ thinking 配置分化

Chainr 已实现：`params.thinking` → `thinking_config`（Gemini 2.5），`params.reasoning_effort` → `thinkingConfig.thinkingLevel`（Gemini 3.0+）。

`reasoning_effort` 根据模型版本使用不同配置格式：

```typescript
if (model?.includes('gemini-2.5')) {
  // thinking_config + thinking_budget
  generationConfig['thinking_config'] = {
    include_thoughts: true,
    thinking_budget: thinkingBudgetMap[params.reasoning_effort] ?? 8192,
  };
} else {
  // Gemini 3.0+: thinkingConfig + thinkingLevel
  generationConfig['thinkingConfig'] = { thinkingLevel: params.reasoning_effort };
}
```

### 3.7 ✅ Google/Vertex — Thought Signature（Gemini 3.0+ tool calling 必需）

Chainr 已实现：请求侧 `tool_call.function.thought_signature` → `part.thoughtSignature`，响应侧 `part.thoughtSignature` → `tool_call.function.thought_signature`（非严格模式）。

新增 `getThoughtSignature` 函数，为 3.0+ 模型自动注入 thought signature。

### 3.8 ✅ Google/Vertex — `media_resolution` 支持

Portkey 2.0 中未实现此功能，无需同步。

### 3.9 ✅ Google/Vertex — `cached_content` 参数透传

Portkey 2.0 中 `cached_content` 仅作为响应侧 `cachedContentTokenCount` 存在（Chainr 已有），无请求参数透传逻辑。

### 3.10 ⏭️ Bedrock — Anthropic Invoke API 直连路径

Portkey 2.0 中未实现，Anthropic 模型仍走 Converse API。无可同步代码，跳过。

Anthropic 模型不再走 Converse API 而是走原生 Invoke API，涉及 messages.ts、index.ts、api.ts 联动。

### 3.11 ⏭️ Bedrock — `output_config` 支持

Portkey 2.0 中未实现，utils.ts 中无 output_config 相关代码。跳过。

utils.ts 中新增 output_config 映射。

---

## 四、按需引入的功能（低优先级）

### 4.1 新增 Provider（3 个有价值的）

| Provider | 说明 |
|----------|------|
| `databricks` | OpenAI 兼容，轻量 |
| `latitude` | 独立转换逻辑 |
| `pinecone` | Rerank 端点 |

### 4.2 Rerank 端点（bedrock、cohere、jina、voyage）

独立功能，需要 `rerankRequestBody.ts` 配合。

### 4.3 类型扩展

- `types.ts` — `realtime` endpoint、`RequestTransforms`、`refusal` 完成原因
- `requestBody.ts` — `StickyConfig`、`media_resolution`、`vertexAuthType`

---

## 五、执行计划

**第一批（Bug 修复 — 必须做）**:
1. ✅ Anthropic token 计算修复 (2.1, 2.2, 2.3)
2. ✅ Google/Vertex 可选链 + finishMessage + tool message 修复 (2.4, 2.5, 2.6)
3. ✅ Google/Vertex schema 处理修复 (2.7, 2.8, 2.11, 2.12)
4. ✅ Google/Vertex token 计算 + 音频格式修复 (2.9, 2.10)
5. ✅ Bedrock bug 修复 (2.13, 2.14, 2.15, 2.16)

**第二批（新功能 — 应该做）**:
6. ✅ Anthropic 新功能 (3.1, 3.2, 3.3, 3.4, 3.5)
7. ✅ Google/Vertex Gemini 2.5/3.0+ 支持 (3.6, 3.7, 3.8, 3.9)
8. ⏭️ Bedrock Anthropic 直连 + output_config (3.10, 3.11) — Portkey 未实现，跳过

**第三批（按需 — 可以后做）**:
9. ⬜ 新 Provider (databricks, latitude, pinecone)
10. ⬜ Rerank 端点
11. ⬜ 类型扩展
