# Chainr 重构：决策与思路记录

> 本文档记录 Portkey 风格 per-provider 目录结构重构过程中的思考、决策和问题。

**创建时间**: 2026-04-24
**最后更新**: 2026-04-24

---

## 1. 为什么要重构

### 1.1 原始问题

| 问题 | 说明 |
|------|------|
| 单一巨型 switch 文件 | `transformRequest.ts` 1717 行，难以维护 |
| 添加 provider 繁琐 | 需要修改核心文件，违反开闭原则 |
| Portkey 代码无法复用 | 每次同步 Portkey 改动需要大量重写 |
| 52 个 provider 实际大部分是 passthrough | 声称支持很多 provider，实际很多没有完整实现 |

### 1.2 重构目标

1. **完全对齐 Portkey 结构** - 每个 provider 独立目录 + 独立文件
2. **直接复用 Portkey 代码** - 用 `cp` 命令直接从 Portkey 复制文件
3. **保持 API 兼容** - 对外接口不变，用户无感知
4. **最小改造** - 只改必要的适配代码，不重写

---

## 2. Portkey 的架构分析

### 2.1 Portkey 的 per-provider 结构

```
src/providers/{provider}/
├── api.ts              # baseURL、auth 方式、endpoint 构建
├── chatComplete.ts     # 请求/响应转换逻辑
├── complete.ts         # completions 端点（部分 provider 有）
├── embed.ts           # embeddings（如果有）
├── index.ts           # 配置导出
├── types.ts           # 类型定义
├── utils.ts           # 工具函数（部分 provider 有）
└── [其他].ts          # provider 特有功能
```

### 2.2 Portkey 的 Provider 注册表

```typescript
// src/providers/index.ts
import OpenAIConfig from './openai';
import AnthropicConfig from './anthropic';
// ...

const Providers: Record<string, ProviderConfig> = {
  openai: OpenAIConfig,
  anthropic: AnthropicConfig,
  // ...
};

export default Providers;
```

### 2.3 Chainr 当前的问题

Chainr 当前使用巨型 switch 语句：
- `transformRequest.ts` - 1700+ 行，包含所有 provider 的请求转换
- `transformResponse.ts` - 包含所有 provider 的响应转换
- 添加新 provider 需要修改核心文件

### 2.4 决策：为什么不直接用 Portkey 的 Router

Portkey 的 Router 使用动态导入：
```typescript
const { default: Provider } = await import(`../providers/${provider}/index.js`);
```

Chainr 的问题是这个动态导入是异步的，而 Chainr 的 Router 架构是同步的。

**替代方案**：使用静态导入 + 注册表

---

## 3. 核心决策

### 3.1 静态导入 vs 动态导入

| 方案 | 优点 | 缺点 |
|------|------|------|
| 动态 import | 懒加载，按需加载 | 异步，需要 async/await |
| 静态 import | 同步，立即可用 | 打包体积大 |

**决策**: 使用静态导入 + 注册表

**理由**:
1. Chainr Router 架构是同步的，改造为异步成本高
2. Chainr 目标是零外部依赖，动态 import 的额外复杂度不必要
3. Portkey 的静态导入方案可用：`Providers[provider]`

### 3.2 目录结构 vs 单文件注册表

| 方案 | 优点 | 缺点 |
|------|------|------|
| 每 provider 一个目录 | 与 Portkey 一致性好，便于同步 | 文件数量多 |
| 单一 index.ts 放所有配置 | 文件少 | 与 Portkey 偏离 |

**决策**: 保持 Portkey 的 per-provider 目录结构

**理由**: 用户要求与 Portkey 对齐，cp 命令可直接复用

### 3.3 transformRequest.ts 的去留

| 选项 | 处理方式 |
|------|----------|
| 完全移除 | Provider 配置接管一切 |
| 保留作为 fallback | 某些简单 provider 仍走 switch |
| 完全保留 | 新结构作为补充 |

**决策**: Provider 结构成熟后，移除 transformRequest.ts 中的重复 case

**当前状态**: transformRequest.ts 仍在使用，providers 目录未被接入

---

## 4. 实施过程中的问题

### 4.1 复制 providers 时的问题

**问题**: Portkey 的 provider/index.ts 引用了大量被排除的文件

```typescript
// openai/index.ts 引用了这些（被 rsync --exclude 排除的）：
import { OpenAIImageGenerateConfig } from './imageGenerate';       // ❌ 不存在
import { OpenAICreateSpeechConfig } from './createSpeech';           // ❌ 不存在
import { OpenAICreateTranscriptionResponseTransform } from './createTranscription';  // ❌ 不存在
// ... 更多
```

**解决方案**: 需要清理每个 provider/index.ts 中的无效 import

### 4.2 Hono Context 依赖

Portkey 使用 Hono 框架，其 Context 对象贯穿整个请求流程。Chainr 是纯 fetch 实现。

**需要移除的 import**:
```typescript
import { Context } from 'hono';
import { Environment } from 'hono';
```

**替代方案**: 使用 `process.env` 或传入的配置对象

### 4.3 Bedrock 的 @smithy/signature-v4

Bedrock 使用 AWS 签名，Portkey 用 `@smithy/signature-v4`。Chainr 已有 `src/core/awsSigV4.ts`。

**决策**: 重写 Bedrock 相关文件，使用现有的 awsSigV4.ts

---

## 5. 架构设计决策

### 5.1 Provider 配置接口

```typescript
// src/providers/types.ts
export interface ProviderAPIConfig {
  getBaseURL: (params: {
    providerOptions: Record<string, unknown>;
    gatewayRequestBody?: Params;
  }) => string;

  headers: (args: {
    providerOptions: Record<string, unknown>;
    transformedRequestBody: Record<string, unknown>;
    transformedRequestUrl: string;
    gatewayRequestBody?: Params;
  }) => Record<string, string>;

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

### 5.2 注册表设计

```typescript
// src/providers/index.ts
import OpenAIConfig from './openai';
import AnthropicConfig from './anthropic';
// ... 静态导入所有 provider

const Providers: Record<string, ProviderConfig> = {
  openai: OpenAIConfig,
  anthropic: AnthropicConfig,
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

### 5.3 Router 集成方式

策略文件（FallbackStrategy 等）通过 `getProviderConfig(provider)` 获取 provider 配置，而不是直接调用 transformRequest.ts 的 switch。

---

## 6. 已知问题与后续工作

### 6.1 当前阻塞项

1. **Provider index.ts 清理** - 移除对不存在文件的引用
2. **types.ts / errors.ts / index.ts** - 三个核心文件不存在
3. **Bedrock 适配** - 移除 @smithy，改用 awsSigV4.ts
4. **Hono 依赖清理** - 移除所有 Context import
5. **Router 集成** - 策略文件需要使用新的 providers 结构

### 6.2 风险

| 风险 | 评估 |
|------|------|
| 文档失实 | 高 - 多个 Phase 标记完成但实际未完成 |
| 构建假象 | 高 - build 通过但 providers 未被导入 |
| 迁移复杂度 | 高 - 需要重写 Router 和所有 Strategy 文件的请求转换逻辑 |

### 6.3 建议的后续步骤

1. **Phase 3-8 并行化**: 创建 types.ts, errors.ts, index.ts 并行进行
2. **批量清理**: 使用 sed/grep 批量清理无效 import
3. **增量验证**: 每清理一个 provider 就验证一次 build

---

## 7. 关键洞察

### 7.1 为什么之前的重构失败了

1. **虚假进度**: 文档标记完成但实际未做
2. **Build 假象**: providers 目录存在但未被导入，build 总是通过
3. **缺少集成**: 复制 providers 和实际使用是两回事

### 7.2 正确的重构姿势

1. **先验证再标记完成**: 每个 phase 完成后立即测试
2. **集成优先**: 先让一个 provider 工作，再批量复制
3. **保持工作状态**: 不允许"部分完成"状态存在太久

### 7.3 Portkey 架构的教训

Portkey 使用动态导入是因为其 Router 本身就是异步的。Chainr 的同步架构决定了我们必须使用静态导入注册表方案。

这不是"简化"，而是"适配"。

---

## 8. 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/providers/` | 已创建 | 70 个 provider 目录已复制 |
| `src/providers/types.ts` | 不存在 | 需要创建 |
| `src/providers/errors.ts` | 不存在 | 需要创建 |
| `src/providers/index.ts` | 不存在 | 需要创建 |
| `src/core/transformRequest.ts` | 存在 | 仍在使用，未改造 |
| `src/core/transformResponse.ts` | 存在 | 仍在使用，未改造 |

---

## 9. 参考资料

- [Portkey AI Gateway](https://github.com/portkey-ai/gateway) - 源项目
- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - 实施计划文档
- `src/core/transformRequest.ts` - 当前实现（待替换）
- `src/core/transformResponse.ts` - 当前实现（待替换）
