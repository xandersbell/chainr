# Integration Test Guide - Real HTTP Testing

> 创建时间：2026-04-23
> 更新时间：2026-04-24 16:49 EEST
> 状态：✅ 真实 HTTP 测试已实现（tests/integration/real-http.test.ts）

---

## 1. 概述

本文档说明如何在 Priorai 项目中使用真实 API Key 进行集成测试。

**两种测试模式**：

| 模式 | 描述 | 需要 API Keys | 适用场景 |
|------|------|---------------|----------|
| **Unit Tests**（当前） | 使用 vi.mock() 模拟 HTTP 响应 | ❌ 不需要 | 快速开发、CI/CD |
| **Real Mode**（本文档） | 使用真实 Provider API | ✅ 需要 | 端到端验证、生产环境检查 |
| **MSW Mock**（待实现） | 使用 Mock Service Worker 模拟 | ❌ 不需要 | 更真实的 HTTP mock 测试 |

---

## 2. 前提条件

### 2.1 获取 API Keys

#### OpenAI
```bash
# https://platform.openai.com/api-keys
export OPENAI_API_KEY="sk-..."
```

#### Anthropic
```bash
# https://console.anthropic.com/settings/keys
export ANTHROPIC_API_KEY="sk-ant-..."
```

#### Google Vertex AI
```bash
# GCP Console -> IAM -> Service Accounts
export VERTEX_PROJECT_ID="my-project-123"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
# 或使用 API Key（不推荐生产环境）
export VERTEX_API_KEY="..."
```

#### OpenRouter
```bash
# https://openrouter.ai/keys
export OPENROUTER_API_KEY="sk-or-..."
```

### 2.2 安装依赖

```bash
npm install --save-dev msw
npm install --save-dev @types/node  # 用于 fetch 类型
```

---

## 3. 配置方式

### 3.1 环境变量文件

创建 `tests/integration/.env.test.local`：

```bash
# OpenAI
OPENAI_API_KEY=sk-test-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-test-...

# Vertex AI
VERTEX_PROJECT_ID=test-project
VERTEX_API_KEY=...

# OpenRouter
OPENROUTER_API_KEY=sk-or-test-...
```

**⚠️ 安全提醒**：
- `.env.test.local` 已在 `.gitignore` 中，不会提交到 git
- 绝不要把真实 keys 提交到代码仓库
- 测试完成后立即删除或清空文件

### 3.2 从环境变量读取

在测试文件中：

```typescript
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('Skipping real API test - OPENAI_API_KEY not set');
  return;
}
```

---

## 4. 测试场景

### 4.1 OpenAI 真实请求测试

```typescript
import { describe, it, expect } from 'vitest';
import { Priorai } from '../../src';

describe('OpenAI Real HTTP Tests', () => {
  it('should make a real request to OpenAI', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('Skipping - no OPENAI_API_KEY');
      return;
    }

    const priorai = new Priorai({
      strategy: 'single',
      targets: [{ provider: 'openai', apiKey }],
    });

    const response = await priorai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "hello" in one word' }],
      max_tokens: 10,
    });

    expect(response.choices[0].message.content).toBeDefined();
    console.log('OpenAI Response:', response.choices[0].message.content);
  });
});
```

### 4.2 Anthropic 真实请求测试

```typescript
describe('Anthropic Real HTTP Tests', () => {
  it('should make a real request with system message', async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('Skipping - no ANTHROPIC_API_KEY');
      return;
    }

    const priorai = new Priorai({
      strategy: 'single',
      targets: [{ provider: 'anthropic', apiKey }],
    });

    const response = await priorai.chat.completions.create({
      model: 'claude-3-5-haiku-20241022',
      messages: [
        { role: 'system', content: 'You are a pirate. Speak in pirate dialect.' },
        { role: 'user', content: 'Say hello' },
      ],
      max_tokens: 50,
    });

    expect(response.choices[0].message.content).toBeDefined();
    console.log('Anthropic Response:', response.choices[0].message.content);
  });
});
```

### 4.3 Vertex AI 真实请求测试

```typescript
describe('Vertex AI Real HTTP Tests', () => {
  it('should make a real request to Vertex AI', async () => {
    const projectId = process.env.VERTEX_PROJECT_ID;
    const apiKey = process.env.VERTEX_API_KEY;
    if (!projectId || !apiKey) {
      console.warn('Skipping - no VERTEX_PROJECT_ID or VERTEX_API_KEY');
      return;
    }

    const priorai = new Priorai({
      strategy: 'single',
      targets: [{
        provider: 'vertex-ai',
        apiKey,
        providerOptions: {
          vertexProjectId: projectId,
          vertexRegion: 'us-central1',
        },
      }],
    });

    const response = await priorai.chat.completions.create({
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: 'Say "hello" in one word' }],
    });

    expect(response.choices[0].message.content).toBeDefined();
    console.log('Vertex AI Response:', response.choices[0].message.content);
  });
});
```

### 4.4 Fallback 策略真实测试

```typescript
describe('Fallback Real HTTP Tests', () => {
  it('should fallback to second provider when first fails', async () => {
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // 使用一个无效的 key 来触发 fallback
    const priorai = new Priorai({
      strategy: 'fallback',
      targets: [
        { provider: 'openai', apiKey: 'invalid-key-for-testing' },
        { provider: 'anthropic', apiKey: anthropicKey || '' },
      ],
    });

    // 第一个 provider 会失败，应该 fallback 到第二个
    const response = await priorai.chat.completions.create({
      model: 'claude-3-5-haiku-20241022',
      messages: [{ role: 'user', content: 'Say "fallback works" in one word' }],
      max_tokens: 20,
    });

    expect(response.choices[0].message.content).toBeDefined();
    console.log('Fallback Response:', response.choices[0].message.content);
  }, { timeout: 30000 });
});
```

---

## 5. 运行测试

### 5.1 运行所有集成测试

```bash
npm run test:integration
```

### 5.2 只运行真实 HTTP 测试

```bash
npm run test:integration -- --grep "Real HTTP"
```

### 5.3 环境变量预设

```bash
# 一键设置所有环境变量（需要先创建 .env.test.local）
export $(cat tests/integration/.env.test.local | xargs) && npm run test:integration
```

---

## 6. 安全注意事项

### ⚠️ 重要提醒

1. **永远不要提交真实 API Keys**
   - `.env.test.local` 已在 `.gitignore`
   - 测试完成后立即清理

2. **使用测试账户**
   - 建议创建独立的测试用 API keys
   - 限制配额避免意外费用

3. **测试后清理**
   ```bash
   # 测试完成后清空敏感数据
   echo "" > tests/integration/.env.test.local
   ```

4. **CI/CD 处理**
   - GitHub Actions 可使用 Secrets
   - 本地测试使用 `.env.test.local`

---

## 7. 故障排除

### 7.1 401 Unauthorized

```
Error: Anthropic API returned 401
```

**解决**：
- 检查 API key 是否正确
- 确认 key 没有过期
- 检查 billing 是否开启

### 7.2 429 Rate Limit

```
Error: OpenAI API returned 429
```

**解决**：
- 减少测试频率
- 等待一段时间后重试
- 检查账户配额

### 7.3 Network Timeout

**解决**：
- 检查网络连接
- 增加 timeout 设置
- 确认防火墙没有阻止

---

## 8. 相关文件

- `tests/integration/Router.test.ts` - 当前集成测试（Mock）
- `tests/integration/.env.test.local` - 环境变量（不提交）
- `tests/setup.ts` - 测试公共设置

---

## 9. 下一步

1. ✅ Unit tests 已完成（vi.mock() 模式，195 tests）
2. ✅ real-http.test.ts 已实现（12 tests，自动 skip 无 key）
3. 🔲 当需要时，添加真实 API keys 到 `.env.test.local`
4. 🔲 运行真实 HTTP 测试验证端到端流程