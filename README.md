# Chainr

> Unified LLM gateway SDK with priority-based fallback and load balancing for TypeScript/Node.js

**⚠️ Status**: In Planning - Not yet implemented

## Features

- **Priority-based Fallback**: Automatic failover across multiple LLM providers
- **Weighted Load Balancing**: Distribute traffic across providers based on weights
- **Nested Strategies**: Combine fallback and load balance in flexible configurations
- **Zero External Dependencies**: No required external services
- **Firebase Compatible**: Works in Firebase Cloud Functions (Node.js 18+)

## Quick Start

```typescript
import { Chainr } from 'chainr';

const chainr = new Chainr({
  strategy: 'fallback',
  targets: [
    {
      provider: 'google-vertexai',
      vertex_project_id: 'my-project',
      vertex_region: 'us-central1',
      override_params: { model: 'gemini-2.0-flash' }
    },
    {
      provider: 'openrouter',
      api_key: process.env.OPENROUTER_API_KEY,
      override_params: { model: 'google/gemini-2.0-flash' }
    },
    {
      provider: 'openai',
      api_key: process.env.RELAY_API_KEY,
      base_url: 'https://api.relay.com/v1',
      override_params: { model: 'gpt-4o' }
    }
  ]
});

// Unified OpenAI-compatible call
const response = await chainr.chat.completions.create({
  model: 'gemini-2.0-flash',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## License

MIT - See [LICENSE](./LICENSE)
