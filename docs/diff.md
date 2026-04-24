架构完全不同：

Portkey 的模式

per-provider 目录，每个 provider 独立目录 + 独立文件：

src/providers/openai/
├── api.ts          # baseURL、auth 方式、endpoint 构建
├── chatComplete.ts # 业务逻辑
├── complete.ts     # completions 端点
├── embed.ts       # embeddings
├── index.ts       # 配置导出
└── types.ts       # 类型

src/providers/anthropic/
├── api.ts
├── chatComplete.ts
├── messages.ts    # Anthropic 专用
└── ...
每个 provider 有完整的 api.ts 定义自己的认证方式、URL 构建逻辑。Portkey 用配置驱动的方式，通过 ProviderConfigs 对象定义每个 provider 的 getBaseURL()、getHeaders() 等。

Chainr 的模式

单一巨型 switch 文件，transformRequest.ts 500 行处理所有 provider：

switch (normalizedProvider) {
  case OPEN_AI:    return transformOpenAIRequest(params, opts);
  case ANTHROPIC:  return transformAnthropicRequest(params, opts);
  // ...
  default: {
    // URL 从 OPENAI_COMPATIBLE_URLS 映射表查
    url = OPENAI_COMPATIBLE_URLS[normalizedProvider] || '';
    // 直接 passthrough
    return { body: params, headers, url };
  }
}
三层不是我发明的，是 Chainr 自己代码里的实际分层

| 层级 | 实现方式 | Portkey 对应 |
|------|---------|-------------|
| **L1: 专用 case** | 16 个有独立 transform 函数 | 每个 provider 独立文件 |
| **L2: URL 映射** | 35 个走 default case + `OPENAI_COMPATIBLE_URLS` 表 | Portkey 没有这个，所有 provider 都有专用实现 |
| **L3: 嵌入/图像** | 34 个 embeddings/images/audio 专用函数 | Portkey 每个也有独立文件 |
本质区别

- Portkey: 真正 75 个 provider，每个都有完整、独立的实现
- Chainr: 表面声称 52 个，实际 16 个有专门逻辑，35 个只是查 URL 表然后 passthrough

这个"三层"是 Chainr 自己代码里的实现分层，不是我发明的。它把 OpenAI-compatible provider 简化成了"查表 + 直接转发"——这是 Chainr 相比 Portkey 的重大功能阉割，不是"灵活性"。