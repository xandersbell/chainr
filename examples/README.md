# Examples

Runnable examples demonstrating Priorai's core features.

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
