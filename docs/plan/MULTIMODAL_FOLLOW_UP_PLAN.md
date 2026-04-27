Updated: 2026-04-27 12:42:56 EEST

# 多模态后续计划

本文记录第一轮 capability-aware 多模态路由之后仍需处理的风险与演进方向。

## 延后处理

### 模型级能力矩阵

当前能力判断仍是 provider 级别，只能过滤明显不支持的组合。实际支持情况会受到模型、端点、区域、beta header、账号配置等因素影响。

后续方向：

- 增加可选的模型能力注册表，按 provider、endpoint、model pattern、media kind、source kind 建模。
- provider 级规则保留为默认 fallback，避免没有模型条目时完全失效。
- 允许调用方通过 target provider options 覆盖能力，用于支持刚发布的新模型。
- 不在没有测试和文档来源的情况下硬编码高波动模型列表。

## 剩余风险

### Responses API 多模态归一化

Chat Completions 和 Responses 的输入结构不同。当前多模态归一化明确只覆盖 `chatComplete`。

后续方向：

- 在启用 Responses 多模态路由前新增 `normalizeResponsesMultimodalParams`。
- Chat 的 `messages` 归一化和 Responses 的 `input` item 归一化必须分开实现。
- 如果某个 provider 只在 Responses endpoint 支持某种 source kind，错误 endpoint 应明确失败，不能隐式透传。

### Provider 侧文件引用

`file_id` 通常是 provider 侧资产引用，不适合跨 provider 自动 fallback。

后续方向：

- 将 `file_id` 视为同 provider 文件资产引用。
- 除非目标明确声明兼容同一文件存储，否则不要把 provider-specific `file_id` fallback 到其它 provider。
- Priorai 暴露上传 API 后，再补充 provider-specific 上传前置条件文档。

### 能力诊断

Load balance 在没有可用目标时已经返回 per-target 多模态能力原因。Fallback 目前仍主要返回最后一次执行错误。

后续方向：

- 在 fallback 全部耗尽时增加结构化能力诊断。
- 初期保持现有返回结构，把诊断报告嵌入 `error` 字段。
- 等 public error handling 稳定后，再考虑引入 typed SDK error。

### Payload 大小与传输限制

Base64 媒体可能超过 provider 限制、网关限制或运行时 JSON body 限制。

后续方向：

- 对 data URL 和 raw base64 字段增加可选的预检字节估算。
- 对大视频/音频优先推荐远程文件引用，前提是目标 provider 支持该 source kind。
- 对无法支持该 source kind 的目标，不要因为 payload size/provider limit 错误而盲目重试。

### Data URL 解析

当前 data URL 支持面向常见的 `data:<mime>;base64,<payload>` 形式。

后续方向：

- 在 provider transform 之前增加更严格的 data URL 校验。
- 对 malformed data URL 返回明确的调用方错误，而不是生成无效 provider payload。
- raw base64 只在 MIME 显式提供时继续支持。
