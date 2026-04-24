# Chainr 重构实施文档

> 将 Chainr 从单一巨型 switch 文件重构为 Portkey 风格的 per-provider 目录结构

**Date**: 2026-04-24
**Status**: 🔄 In Progress（发现文档严重失实，重置进度）
**Breaking Change**: 是（但保持 API 兼容）
**核心策略**: 直接 cp Portkey 文件，批量改造适配

## ⚠️ 2026-04-24 进度重置说明

**Oracle 验证发现**：文档中 Phase 3-11 的完成状态为虚假描述，实际大量工作未完成。

| 问题 | 说明 |
|------|------|
| Phase 2 | 文档说 78 个，实际复制了 70 个 provider 目录 |
| Phase 3 | 文档说"路径兼容无需修改"，**实际**大量 provider/index.ts 引用不存在的文件 |
| Phase 4 | 文档说 `chainrTypes.ts` 已创建，**实际**不存在 |
| Phase 5 | 文档说 Bedrock 已适配，**实际**未做任何修改 |
| Phase 6 | 文档说 Hono 依赖已清理，**实际**未做任何修改 |
| Phase 7 | 文档说 `errors.ts` 已存在，**实际**不存在 |
| Phase 8 | 文档说 `providers/index.ts` 已存在，**实际**不存在 |
| Phase 9-10 | 文档标记"可选"，**实际**是阻塞项（Router 完全没有引用 providers） |
| Phase 11 | Build 通过是因为 providers 目录**未被任何代码导入**，非真正完成 |

**当前状态**：providers 目录已复制（70 个），但结构不完整（缺 types.ts/errors.ts/index.ts），且未被 Chainr 接入。8 个文件仍引用 Hono 框架。1151 个 TS 编译错误。

## 执行进度

| Phase | Status | 说明 |
|-------|--------|------|
| Phase 1: 创建目录 | ✅ 完成 | `src/providers/` 已创建 |
| Phase 2: 复制 providers | ✅ 完成 | 70 个目录已复制 (rsync with exclusions) |
| Phase 3: 路径检查 | 🔄 进行中 | 大部分 provider/index.ts 引用了不存在的文件（batch/finetune/file 等被排除的） |
| Phase 4: Provider types | ⬜ 待开始 | `src/providers/types.ts` 不存在，需创建 |
| Phase 5: Bedrock 处理 | ⬜ 待开始 | 需移除 @smithy，使用 awsSigV4.ts |
| Phase 6: 清理 Hono 依赖 | ⬜ 待开始 | 需清理所有 Context import |
| Phase 7: GatewayError 处理 | ⬜ 待开始 | `src/providers/errors.ts` 不存在，需创建 |
| Phase 8: 创建注册表 | ⬜ 待开始 | `src/providers/index.ts` 不存在，需创建 |
| Phase 9: Router 改造 | ⬜ 待开始 | **必须**：Fallback/LoadBalance/SingleStrategy 需使用新 providers |
| Phase 10: 清理旧代码 | ⬜ 待开始 | transformRequest.ts 的 switch case 需移除或重构 |
| Phase 11: 测试验证 | 🔄 待验证 | 需完整测试验证新结构 |

### 已修复的文件

> ⚠️ 以下为之前会话的记录，**未经验证**

| 文件 | 计划修复内容 | 实际状态 |
|------|-------------|---------|
| `src/providers/types.ts` | 移除 Hono Context | ❌ 不存在 |
| `src/providers/errors.ts` | ChainrError 类 | ❌ 不存在 |
| `src/providers/bedrock/api.ts` | 移除 Context | ❌ 未修改 |
| `src/providers/bedrock/utils.ts` | 改用 awsSigV4.ts | ❌ 未修改 |
| `src/providers/google-vertex-ai/utils.ts` | 移除 Context | ❌ 未修改 |
| `src/providers/google-vertex-ai/api.ts` | 移除 Context | ❌ 未修改 |
| `src/providers/azure-openai/api.ts` | 替换 Environment | ❌ 未修改 |
| `src/providers/azure-ai-inference/api.ts` | 替换 Environment | ❌ 未修改 |
| `src/providers/sagemaker/api.ts` | 移除 Hono env | ❌ 未修改 |

### 已解决的问题

> ⚠️ 以下为之前会话的记录，**未经验证**

1. ❌ **Hono Context 依赖** - 未清理（Provider index.ts 中仍有 Hono import）
2. ❌ **@smithy/signature-v4** - 未替换
3. ❌ **GatewayError** - 未替换
4. ⚠️ **所有 370 测试通过** - 基于旧代码，新结构未验证

---

## 1. 背景与目标

### 1.1 当前问题

| 问题 | 说明 |
|------|------|
| **单文件过大** | `transformRequest.ts` 1717 行，难以维护 |
| **添加 provider 繁琐** | 需要修改核心文件，违反开闭原则 |
| **Portkey 代码无法直接复用** | 需要大量重写才能同步 Portkey 的改动 |
| **35 个 provider 只是 passthrough** | 声称 52 个，实际很多没有完整实现 |

### 1.2 重构目标

1. **完全对齐 Portkey 结构** - 每个 provider 独立目录 + 独立文件
2. **直接复用 Portkey 代码** - 用 `cp` 命令直接从 Portkey 复制文件
3. **保持 API 兼容** - 对外接口不变，用户无感知
4. **最小改造** - 只改必要的适配代码，不重写

---

## 2. Portkey 目录结构分析

### 2.1 每个 Provider 的标准文件

```
src/providers/{provider}/
├── api.ts              # baseURL、auth 方式、endpoint 构建
├── chatComplete.ts     # 请求/响应转换逻辑
├── complete.ts         # completions 端点（部分 provider 有）
├── embed.ts           # embeddings（如果有）
├── index.ts           # 配置导出
├── types.ts           # 类型定义
├── utils.ts           # 工具函数（部分 provider 有）
└── [其他].ts          # provider 特有功能 (batch, file 等)
```

### 2.2 需要排除的文件类型

以下功能 Chainr 不需要，复制时跳过：

| 文件类型 | 说明 | 处理 |
|---------|------|------|
| `*Batch*.ts` | 批处理相关 | **跳过** |
| `*Finetune*.ts` | 微调相关 | **跳过** |
| `*File*.ts` | 文件管理相关 | **跳过** |
| `upload*.ts` | 上传相关 | **跳过** |
| `list*.ts` | 列表相关 | **跳过** |
| `retrieve*.ts` | 获取详情相关 | **跳过** |
| `delete*.ts` | 删除相关 | **跳过** |
| `cancel*.ts` | 取消相关 | **跳过** |
| `countTokens.ts` | Token 计数 | **跳过** |
| `createSpeech.ts` | TTS | **跳过** |
| `createTranscription.ts` | Whisper | **跳过** |
| `createTranslation.ts` | 翻译 | **跳过** |
| `imageGenerate.ts` | 图像生成 | **跳过** (Chainr 用独立目录) |

### 2.3 核心必需文件

| 文件 | 说明 | 是否必需 |
|------|------|---------|
| `api.ts` | URL、headers、endpoint 构建 | ✅ 必须 |
| `chatComplete.ts` | 请求/响应转换 | ✅ 必须 |
| `index.ts` | 导出 provider 配置 | ✅ 必须 |
| `types.ts` | 类型定义 | ✅ 必须 |
| `embed.ts` | embeddings | ⚠️ 如果 provider 支持 |
| `utils.ts` | 工具函数 | ⚠️ 如果有复杂逻辑 |

### 2.4 需要改造的 Provider

| Provider | 关键改造点 |
|-----------|-----------|
| **bedrock** | `api.ts` 用 Hono Context → 需移除；`utils.ts` 用 `@smithy/signature-v4` → 需替换为我们的实现 |
| **vertex-ai** | 基本可以直接用 |
| **anthropic** | 基本可以直接用 |
| **cohere** | 基本可以直接用 |
| **openai** | 基本可以直接用 |
| **deepseek** | 基本可以直接用 |
| **其他** | 基本可以直接用 |

---

## 3. 目标目录结构

```
src/
├── index.ts                    # SDK 入口（不变）
├── globals.ts                  # Provider 常量（保留）
├── types/
│   └── requestBody.ts         # 类型定义（不变）
└── providers/                  # NEW: per-provider 目录
    ├── index.ts                # Provider 注册表
    ├── types.ts                # 通用 provider 类型
    ├── utils.ts                # 通用工具函数
    ├── openai/
    │   ├── api.ts
    │   ├── chatComplete.ts
    │   ├── embed.ts
    │   └── index.ts
    ├── anthropic/
    ├── bedrock/
    ├── vertex-ai/
    ├── cohere/
    ├── deepseek/
    ├── mistral-ai/
    ├── azure-openai/
    ├── azure-ai/
    ├── github/
    ├── openrouter/
    ├── together-ai/
    ├── perplexity/
    ├── groq/
    └── ... (其他 provider)
```

---

## 4. 批量复制脚本

### 4.1 复制单个 Provider 的命令模板

```bash
# 复制 provider 目录（排除不需要的文件）
rsync -av --exclude='*Batch*' --exclude='*Finetune*' --exclude='*File*' \
  --exclude='upload*' --exclude='list*' --exclude='retrieve*' \
  --exclude='delete*' --exclude='cancel*' --exclude='countTokens*' \
  --exclude='createSpeech*' --exclude='createTranscription*' \
  --exclude='createTranslation*' --exclude='imageGenerate*' \
  /Users/neo/codebase/repos/portkey-ai-gateway/src/providers/{provider}/ \
  /Users/neo/codebase/xab/chainr/src/providers/{provider}/
```

### 4.2 批量复制所有 Provider

```bash
# 复制所有 provider（需要后续清理）
for provider in openai anthropic bedrock vertex-ai cohere deepseek mistral-ai \
  azure-openai azure-ai github openrouter together-ai perplexity groq \
  huggingface fireworks-ai workers-ai anyscale predibase sambanova cerebras \
  nebius deepinfra modal replicate lepton ollama palm novita-ai siliconflow \
  lemonfox-ai deepbricks hyperbolic monsterapi 302ai bytez cometapi \
  featherless-ai inference-net iointelligence kluster-ai matterai nextbit \
  stability-ai triton upstage aibadgr cortex krutrim ncompass reka-ai z-ai; do

  rsync -av --exclude='*Batch*' --exclude='*Finetune*' --exclude='*File*' \
    --exclude='upload*' --exclude='list*' --exclude='retrieve*' \
    --exclude='delete*' --exclude='cancel*' --exclude='countTokens*' \
    --exclude='createSpeech*' --exclude='createTranscription*' \
    --exclude='createTranslation*' --exclude='imageGenerate*' \
    /Users/neo/codebase/repos/portkey-ai-gateway/src/providers/${provider}/ \
    /Users/neo/codebase/xab/chainr/src/providers/${provider}/

  echo "Copied ${provider}"
done
```

---

## 5. 批量路径替换

### 5.1 Import 路径修正

Portkey 路径 → Chainr 路径：

| Portkey 路径 | Chainr 路径 | 说明 |
|-------------|-------------|------|
| `../../globals` | `../../globals` | 相同（globals 在项目根） |
| `../../types/requestBody` | `../types/requestBody` | 目录层级不同 |
| `../types` | `./types` | 相对路径调整 |
| `../../errors/GatewayError` | **删除** | Chainr 没有这个 |

### 5.2 批量替换命令

```bash
# 在 src/providers 目录下批量替换
cd /Users/neo/codebase/xab/chainr/src/providers

# 替换 globals 路径
find . -name "*.ts" -exec sed -i '' 's|../../globals|../../globals|g' {} \;

# 替换 requestBody 路径
find . -name "*.ts" -exec sed -i '' 's|../../types/requestBody|../types/requestBody|g' {} \;

# 替换 types 路径
find . -name "*.ts" -exec sed -i '' 's|../types|./types|g' {} \;

# 删除 GatewayError import
find . -name "*.ts" -exec sed -i '' 's|import { GatewayError } from.*||g' {} \;

# 删除 Context import (Hono)
find . -name "*.ts" -exec sed -i '' 's|import { Context } from.*||g' {} \;
```

---

## 6. 核心文件改造

### 6.1 Chainr Provider 通用接口

```typescript
// src/providers/types.ts
export interface ProviderAPIConfig {
  getBaseURL: (params: {
    providerOptions: Record<string, unknown>;
    gatewayRequestBody?: Params;
  }) => string | Promise<string>;

  headers: (args: {
    providerOptions: Record<string, unknown>;
    transformedRequestBody: Record<string, unknown>;
    transformedRequestUrl: string;
    gatewayRequestBody?: Params;
  }) => Record<string, string> | Promise<Record<string, string>>;

  getEndpoint: (args: {
    fn: string;
    gatewayRequestBodyJSON: Params;
    gatewayRequestURL: string;
  }) => string;
}

export interface ProviderConfig {
  chatComplete: Record<string, any>;
  api: ProviderAPIConfig;
  responseTransforms?: {
    chatComplete?: (response: any, status: number, headers: Headers) => any;
    'stream-chatComplete'?: (chunk: string, ...args: any[]) => string;
  };
}
```

### 6.2 Bedrock 特殊处理

Bedrock 的 `api.ts` 需要完全重写，移除 Hono Context 依赖：

```typescript
// src/providers/bedrock/api.ts (Chainr 版本)
import { ProviderAPIConfig } from '../types';
import { generateAWSHeaders, getAwsEndpointDomain, getBedrockModelWithoutRegion } from './utils';

const BedrockAPIConfig: ProviderAPIConfig = {
  getBaseURL: ({ providerOptions }) => {
    const region = (providerOptions.awsRegion as string) || 'us-east-1';
    return `https://bedrock-runtime.${region}.${getAwsEndpointDomain()}`;
  },

  headers: async ({ providerOptions, transformedRequestBody, transformedRequestUrl }) => {
    const region = (providerOptions.awsRegion as string) || 'us-east-1';
    return generateAWSHeaders(
      JSON.stringify(transformedRequestBody),
      { 'content-type': 'application/json' },
      transformedRequestUrl,
      'POST',
      region,
      providerOptions.awsAccessKeyId as string,
      providerOptions.awsSecretAccessKey as string,
      providerOptions.awsSessionToken as string | undefined
    );
  },

  getEndpoint: ({ fn, gatewayRequestBodyJSON }) => {
    const model = gatewayRequestBodyJSON.model || '';
    const modelWithoutRegion = getBedrockModelWithoutRegion(model);

    if (fn === 'chatComplete') {
      return `/model/${encodeURIComponent(modelWithoutRegion)}/converse`;
    }
    // ...
  },
};

export default BedrockAPIConfig;
```

### 6.3 Provider 注册表

```typescript
// src/providers/index.ts
import OpenAIConfig from './openai';
import AnthropicConfig from './anthropic';
import BedrockConfig from './bedrock';
// ... 其他 import

const Providers: Record<string, ProviderConfig> = {
  openai: OpenAIConfig,
  anthropic: AnthropicConfig,
  bedrock: BedrockConfig,
  // ...
};

export default Providers;

export function getProviderConfig(provider: string): ProviderConfig {
  const config = Providers[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return config;
}
```

---

## 7. 迁移步骤

### Phase 1: 创建 providers 目录骨架

```bash
cd /Users/neo/codebase/xab/chainr
mkdir -p src/providers
```

### Phase 2: 批量复制所有 Provider

```bash
# 复制所有 75+ providers
for provider in openai anthropic bedrock vertex-ai cohere deepseek mistral-ai \
  azure-openai azure-ai github openrouter together-ai perplexity groq \
  huggingface fireworks-ai workers-ai anyscale predibase sambanova cerebras \
  nebius deepinfra modal replicate lepton ollama palm novita-ai siliconflow \
  lemonfox-ai deepbricks hyperbolic monsterapi 302ai bytez cometapi \
  featherless-ai inference-net iointelligence kluster-ai matterai nextbit \
  stability-ai triton upstage aibadgr cortex krutrim ncompass reka-ai z-ai \
  ai21 nomic jina voyage segmind recraft-ai stability-ai meshy tripo3d; do

  rsync -av --exclude='*Batch*' --exclude='*Finetune*' --exclude='*File*' \
    --exclude='upload*' --exclude='list*' --exclude='retrieve*' \
    --exclude='delete*' --exclude='cancel*' --exclude='countTokens*' \
    --exclude='createSpeech*' --exclude='createTranscription*' \
    --exclude='createTranslation*' --exclude='imageGenerate*' \
    /Users/neo/codebase/repos/portkey-ai-gateway/src/providers/${provider}/ \
    src/providers/${provider}/

  echo "Copied ${provider}"
done
```

### Phase 3: 批量路径替换

```bash
cd src/providers

# 路径修正
find . -name "*.ts" -exec sed -i '' 's|../../globals|../../globals|g' {} \;
find . -name "*.ts" -exec sed -i '' 's|../../types/requestBody|../types/requestBody|g' {} \;
find . -name "*.ts" -exec sed -i '' 's|../types|./types|g' {} \;

# 删除 Portkey 特有 import
find . -name "*.ts" -exec sed -i '' 's|import { GatewayError } from.*||g' {} \;
find . -name "*.ts" -exec sed -i '' 's|import { Context } from.*||g' {} \;
find . -name "*.ts" -exec sed -i '' 's|import Context from.*||g' {} \;
```

### Phase 4: 特殊 Provider 改造

#### 4.1 Bedrock - 重写 api.ts 和 utils.ts

```bash
# 删除原 Bedrock api.ts，重新创建
rm src/providers/bedrock/api.ts
# 创建 Chainr 版本的 api.ts（用我们已实现的 awsSigV4.ts）
```

#### 4.2 Vertex AI - 检查 api.ts

```bash
# Vertex AI 可能需要调整 getEndpoint
cat src/providers/vertex-ai/api.ts
```

### Phase 5: 创建注册表

```bash
# 创建 src/providers/index.ts
# 导入所有 provider 的 index.ts
```

### Phase 6: Router 改造

改造 `src/core/strategies/FallbackStrategy.ts` 等使用新的 provider 注册表。

### Phase 7: 清理旧代码

```bash
# 删除旧的 transformRequest.ts 中的 provider case（保留 default）
# 删除旧的 transformResponse.ts 中的 provider 函数（保留 default）
```

### Phase 8: 测试验证

```bash
npm test
npm run build
```

---

## 8. 实施检查清单

### Phase 1: 目录创建
- [ ] `src/providers/` 目录创建

### Phase 2: 批量复制
- [ ] 所有 75+ providers 复制完成
- [ ] 不需要的文件已排除

### Phase 3: 路径替换
- [ ] globals 路径正确
- [ ] requestBody 路径正确
- [ ] types 路径正确
- [ ] Portkey 特有 import 已删除

### Phase 4: 特殊改造
- [ ] Bedrock api.ts 重写
- [ ] Bedrock utils.ts 适配（移除 @smithy）
- [ ] 其他 provider 的特殊处理

### Phase 5: 注册表
- [ ] `src/providers/index.ts` 创建
- [ ] 所有 provider 正确导入

### Phase 6: Router 改造
- [ ] FallbackStrategy 使用新注册表
- [ ] LoadBalanceStrategy 使用新注册表
- [ ] SingleStrategy 使用新注册表

### Phase 7: 清理
- [ ] 旧 switch case 已删除
- [ ] 旧 response 函数已删除
- [ ] OPENAI_COMPATIBLE_URLS 保留作为 fallback

### Phase 8: 验证
- [ ] 所有测试通过
- [ ] 构建成功
- [ ] API 兼容性验证

---

## 9. 预期结果

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| 最大文件行数 | 1717 (transformRequest.ts) | ~200 (per file) |
| Provider 实现 | 16 专用 + 35 passthrough | 75+ 全部专用 |
| 添加新 provider | 修改核心文件 | 新建目录 + cp |
| Portkey 代码复用 | 需要重写 | 直接 cp |
| 测试覆盖 | 370 tests | 450+ tests |

---

## 10. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 批量复制出错 | 分批执行，每批验证 |
| 路径替换不完整 | 逐个检查 import 语句 |
| Bedrock 签名失效 | 使用已验证的 awsSigV4.ts |
| 测试失败 | 分阶段验证，每阶段运行测试 |

---

## 11. 实施时间估算

| Phase | 工作量 | 风险 |
|-------|--------|------|
| Phase 1: 目录创建 | 5min | 低 |
| Phase 2: 批量复制 | 30min | 低 |
| Phase 3: 路径替换 | 20min | 中 |
| Phase 4: 特殊改造 | 1h | 中 |
| Phase 5: 注册表 | 30min | 中 |
| Phase 6: Router 改造 | 2h | 高 |
| Phase 7: 清理旧代码 | 1h | 中 |
| Phase 8: 测试验证 | 1h | 低 |
| **总计** | **~7h** | - |
