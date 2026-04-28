Updated: 2026-04-29 01:55:42 EEST

# Integration Test Guide

## 1. 当前测试形态

Priorai 当前有三类与集成相关的测试文件：

| 文件 | 形态 | 说明 |
|------|------|------|
| `tests/integration/Router.test.ts` | mock 集成测试 | 验证 Router、策略分发、请求构造与 endpoint 选择 |
| `tests/integration/structuredOutputFallback.test.ts` | mock 集成测试 | 验证结构化输出的跨 provider fallback |
| `tests/integration/real-http.test.ts` | 真实 HTTP 测试 | 使用真实 provider 凭证发请求；缺少凭证时自动跳过 |

仓库当前没有单独的 MSW 测试层，也不需要额外安装 `msw` 才能运行现有测试。

## 2. 运行方式

### 2.1 运行全部测试

```bash
npm test
```

### 2.2 只跑 integration 目录

```bash
npx vitest run tests/integration
```

### 2.3 只跑真实 HTTP 测试

```bash
npx vitest run tests/integration/real-http.test.ts
```

## 3. 真实 HTTP 测试所需环境变量

按 `tests/integration/real-http.test.ts` 当前实现，常见变量如下：

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export VERTEX_API_KEY="..."
export VERTEX_PROJECT_ID="my-project"
export OPENROUTER_API_KEY="sk-or-..."
```

缺少对应变量时，测试会打印跳过原因并直接返回，不会报失败。

## 4. 当前已覆盖的重点能力

### 4.1 Responses API

- `priorai.responses.create()` 已接入策略系统。
- `tests/integration/Router.test.ts` 已覆盖 `createModelResponse` 路由入口。
- OpenAI `input_image` 原生 shape 会按当前请求体透传。

### 4.2 Realtime

- 当前只覆盖 bootstrap HTTP surfaces：
  - `priorai.realtime.sessions.create()`
  - `priorai.realtime.clientSecrets.create()`
  - `priorai.realtime.transcriptionSessions.create()`
- 这些测试验证 endpoint 名称、URL、headers、body 是否正确。
- 当前不测试也不承诺 WebSocket / WebRTC transport runtime，因为 SDK 没有封装这一层。

### 4.3 Multimodal 边界

- Chat Completions 支持 OpenAI / Azure OpenAI 原生 `input_audio`。
- Responses API 当前不支持 `input_audio`，测试会明确断言拒绝。
- Azure OpenAI `responses.create()` 当前要求 `apiVersion: 'v1'`。
- Azure OpenAI `input_image` 只接受 `image_url`（HTTPS URL 或 data URL），不接受 `file_id`。

## 5. 推荐验证命令

文档相关收口时，至少应跑下面这些测试：

```bash
npx vitest run tests/unit/multimodalCapabilities.test.ts tests/unit/providerRequest.test.ts tests/integration/Router.test.ts
```

如果要做真实 provider 验证，再单独运行：

```bash
npx vitest run tests/integration/real-http.test.ts
```

## 6. 安全注意事项

1. 不要把真实 API Key 写入仓库。
2. 真实 HTTP 测试应优先使用单独测试凭证，避免误耗生产配额。
3. `real-http.test.ts` 会真实调用外部 provider，运行前先确认费用和速率限制。

## 7. 相关文件

- `tests/integration/Router.test.ts`
- `tests/integration/structuredOutputFallback.test.ts`
- `tests/integration/real-http.test.ts`
- `tests/unit/multimodalCapabilities.test.ts`
- `tests/unit/providerRequest.test.ts`
