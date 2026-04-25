# Portkey v1.12.0 → HEAD 同步计划

**创建时间**: 2026-04-25 06:33 EEST
**Portkey 基线**: v1.12.0（Chainr 当前对齐版本）
**Portkey 目标**: HEAD（351692fd，v1.15.2 之后）
**状态**: ⬜ 待执行

---

## 一、Bug 修复（P0 — 影响正确性）

### 1.1 数值参数传 `0` 被忽略

**影响范围**: Google / Vertex AI / Bedrock
**问题**: `temperature`、`top_p`、`top_k`、`seed`、`top_logprobs` 的 falsy 检查使用 `if (value)`，当传入 `0` 时被跳过
**修复**: 改为 `!= null`（`value !== null && value !== undefined`）

涉及文件：
- `src/providers/google-vertex-ai/chatComplete.ts` — `transformGenerationConfig()`
- `src/providers/bedrock/utils.ts` — `transformAnthropicAdditionalModelRequestFields()`

**状态**: ⬜

### 1.2 Anthropic `tool_choice: 'none'` 未映射

**影响范围**: Anthropic 直连 / Bedrock / Vertex AI
**问题**: `tool_choice: 'none'` 没有映射为 `{ type: 'none' }`，导致 Anthropic 不识别
**修复**: 在 `chatComplete.ts` 的 tool_choice 转换中添加 `'none'` → `{ type: 'none' }` 映射

涉及文件：
- `src/providers/anthropic/chatComplete.ts`

**状态**: ⬜

### 1.3 Bedrock 流式 `tool_use` / `thinking` chunk 不完整

**影响范围**: Bedrock 流式响应
**问题**: `content_block_start` 事件中，`tool_use` 和 `thinking` 的 block start 使用空模板，缺少 `tool_use.id/name` 和 `thinking`/`redacted_thinking` 类型信息
**修复**: 正确填充 `content_block_start` 事件的完整字段；`message_start` 事件不再删除 `usage` 字段

涉及文件：
- `src/providers/bedrock/messages.ts`

**状态**: ⬜

### 1.4 Google/Vertex `functionResponse` 字段名变更

**影响范围**: Google / Vertex AI 的 Tool Calling
**问题**: Google API 规范变更，`functionResponse.response` 中的字段从 `content` 改为 `output`
**修复**: 更新 tool 消息转换中的字段名

涉及文件：
- `src/providers/google-vertex-ai/chatComplete.ts`

**状态**: ⬜

### 1.5 Bedrock `anthropic_beta` 逗号分隔支持

**影响范围**: Bedrock 上的 Anthropic 模型
**问题**: `anthropic_beta` header 不支持逗号分隔的多个 beta 值
**修复**: 从 `providerOptions.anthropicBeta` 优先读取，支持 split + trim 处理逗号分隔值

涉及文件：
- `src/providers/bedrock/utils.ts`

**状态**: ⬜

---

## 二、Provider 更新（P1 — 功能增强）

### 2.1 Cohere v2 API 迁移

**影响范围**: Cohere provider
**变更**: 完全重写，从 v1 API 迁移到 `/v2/chat`
- 消息格式从 `message` + `chat_history` 改为标准 `messages` 数组
- 新增完整的 `types.ts`，包含 v2 响应类型

涉及文件：
- `src/providers/cohere/chatComplete.ts` — 完全重写
- `src/providers/cohere/types.ts` — 新增

**状态**: ⬜

### 2.2 Vertex AI / Google 新功能

**变更**:
- `reasoning_effort` → `thinkingConfig.thinkingLevel` 映射（Gemini 3 Pro 思考模式）
- `image_config` → `imageConfig`（`aspectRatio`、`imageSize`）映射
- 新增 `transformInputAudioPart`：OpenAI `input_audio` 格式转 Vertex `inlineData`，含完整音频 MIME 映射（mp3/wav/opus/flac/pcm16/aac/m4a/mpeg/mp4/webm）
- 新增 `googleTools` 列表和 `transformGoogleTools` 函数：统一处理 `googleSearch`、`googleSearchRetrieval`、`computerUse`、`googleMaps` 等特殊工具
- `thought_signature` 在 tool_call 和响应中双向传递（Gemini 3 Pro 思考签名）
- `tool_choice` 的 `default` 改为函数，支持 Google Maps 工具的 `retrievalConfig` 注入
- `completionsStats` → `completionStats` 字段名修正（Batch API）
- `anthropic-beta` header 从 `providerOptions.anthropicBeta` 或请求体 `anthropic_beta` 读取并转发（Vertex 上的 Anthropic 模型）

涉及文件：
- `src/providers/google-vertex-ai/chatComplete.ts`
- `src/providers/google-vertex-ai/utils.ts`
- `src/providers/google-vertex-ai/api.ts`
- `src/providers/google-vertex-ai/transformGenerationConfig.ts`

**状态**: ⬜

### 2.3 Anthropic 增强

**变更**:
- `apiKey` 同时接受 `providerOptions.anthropicApiKey`（兼容 Claude Code 场景）
- `anthropic-beta` header 从只在 `chatComplete` 发送改为所有路由都发送
- 新增高级工具属性透传：`defer_loading`、`allowed_callers`、`input_examples`（Tool Search Tool beta）
- `system` 消息的 `cache_control` 正确传递
- 响应转换函数重构为工厂函数 `getAnthropicChatCompleteResponseTransform(provider)`，支持在 Azure/Vertex 复用时正确标注 provider 字段

涉及文件：
- `src/providers/anthropic/api.ts`
- `src/providers/anthropic/chatComplete.ts`

**状态**: ⬜

### 2.4 Bedrock 增强

**变更**:
- 新增 `awsAuthType: 'apiKey'` 支持，直接用 `Authorization: Bearer <key>` 跳过 SigV4 签名
- 所有 S3/bedrock 端点 URL 中的 `amazonaws.com` 改为可配置的 `AWS_ENDPOINT_DOMAIN`（支持私有云/GovCloud）
- `messagesCountTokens` 端点剥离 model 名称中的区域前缀（`us.`、`eu.` 等）
- 新增 `BedrockAnthropicMessageCountTokensConfig`：对 Anthropic 模型使用 `invokeModel` 接口而非 Converse API 计算 token

涉及文件：
- `src/providers/bedrock/api.ts`
- `src/providers/bedrock/utils.ts`
- `src/providers/bedrock/countTokens.ts` — 新增

**状态**: ⬜

### 2.5 Azure OpenAI 增强

**变更**:
- 新增 `azureAuthMode: 'workload'`（Workload Identity Federation，仅 Node.js 运行时）
- `azureEntraScope` 可自定义（之前硬编码为 `cognitiveservices.azure.com`）
- 新增 Azure v1 API 支持：`apiVersion: 'v1'` 时路由改为 `/v1/...` 而非 `/deployments/{id}/...`
- `azureExtraParams` 重命名为 `azureExtraParameters`

涉及文件：
- `src/providers/azure-openai/api.ts`
- `src/providers/azure-openai/utils.ts` — 新增

**状态**: ⬜

### 2.6 Azure AI Inference 增强

**变更**:
- 同步 Workload Identity 支持
- 自动检测 Anthropic 模型（URL 含 `anthropic`），自动注入 `anthropic-version` header 并切换认证方式为 `x-api-key`
- 新增 `messages` 端点支持

涉及文件：
- `src/providers/azure-ai-inference/api.ts`
- `src/providers/azure-ai-inference/messages.ts` — 新增

**状态**: ⬜

### 2.7 其他 Provider 小改动

| Provider | 变更 | 涉及文件 |
|----------|------|----------|
| Ollama | 新增 `thinking` 参数支持，映射为 `think: true/false` | `ollama/chatComplete.ts` |
| OpenRouter | 响应中透传 `reasoning_details` 字段 | `openrouter/chatComplete.ts` |
| Groq | 新增 `reasoning_effort` 参数透传 | `groq/chatComplete.ts` |
| open-ai-base | `chatCompleteParams` 直接展开 `OpenAIChatCompleteConfig`，避免参数遗漏 | `open-ai-base/chatComplete.ts` |

**状态**: ⬜

---

## 三、新增 Provider（P2 — 扩展覆盖）

### 3.1 Oracle OCI（复杂）

独立的 OCI 请求签名器实现，含 chat + streaming 支持。

涉及文件：
- `src/providers/oracle/` — 整个目录（api.ts、chatComplete.ts、utils.ts、types/）

**状态**: ⬜

### 3.2 轻量 OpenAI 兼容 Provider（6 个）

均为 OpenAI 兼容格式，复制 + 注册即可：

| Provider | 端点支持 | 复杂度 |
|----------|----------|--------|
| OVHcloud AI Endpoints | chat | 低 |
| IO Intelligence | chat + embed + model response | 低 |
| Modal Labs | chat + complete | 低 |
| MatterAI | chat | 低 |
| CometAPI | chat + embed | 低 |
| AI Badgr | chat | 低 |

**状态**: ⬜

---

## 四、不迁移的变更

| 变更 | 原因 |
|------|------|
| Crowdstrike AIDR Guardrail 插件 | Chainr 不做 Guardrails |
| `x-portkey-forward-headers` 防循环 | Chainr 不是网关，无此问题 |
| `constructConfigFromRequestHeaders` 新增 header 解析 | Chainr 不从 HTTP header 读配置 |
| 流式响应注入 hook 结果 chunk | Chainr 不做 Hooks |
| `GatewayError` 保留原始 HTTP status | Chainr 有自己的错误处理 |
| README 更新 | 文档类 |

---

## 五、执行顺序建议

1. **P0 Bug 修复**（1.1 → 1.5）— 影响正确性，优先级最高
2. **P1 核心 Provider 更新**（2.1 → 2.7）— 功能增强，按使用频率排序
3. **P2 新增 Provider**（3.1 → 3.2）— 扩展覆盖，最后处理
