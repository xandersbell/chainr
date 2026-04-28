Updated: 2026-04-29 02:10:01 EEST

# Examples

Runnable examples demonstrating Priorai's core features.

Current example coverage stays on the core routing surfaces. There is no bundled example yet for `responses.create()` multimodal input or Realtime transport, because the current Realtime support only exposes bootstrap HTTP surfaces and does not wrap the WebSocket or WebRTC runtime.

## Prerequisites

```bash
npm install
```

## Running

All examples use `tsx` for direct TypeScript execution:

```bash
npx tsx examples/01-single-provider.ts
```

## Examples

| File | Description | Required Env Vars |
|------|-------------|-------------------|
| `01-single-provider.ts` | Basic single provider usage | `OPENAI_API_KEY` |
| `02-fallback-strategy.ts` | Priority-based fallback across providers | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` |
| `03-loadbalance-strategy.ts` | Weighted load balancing | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` |
| `04-vertex-ai-adc.ts` | Google Vertex AI with ADC (no API key) | `gcloud` CLI configured |
| `05-bedrock-sigv4.ts` | AWS Bedrock with SigV4 signing | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `06-streaming.ts` | Streaming chat completion | `OPENAI_API_KEY` |
| `07-conditional-strategy.ts` | Conditional routing by request params | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` |
| `08-structured-output.ts` | Structured JSON output across providers | `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY` |
