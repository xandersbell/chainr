/**
 * Example: Fallback Strategy
 *
 * Try providers in order — if the first fails, fall back to the next.
 * Useful for high availability across different LLM providers.
 *
 * Run: npx tsx examples/02-fallback-strategy.ts
 * Requires: OPENAI_API_KEY and ANTHROPIC_API_KEY environment variables
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

const config: PrioraiConfig = {
  strategy: 'fallback',
  targets: [
    {
      // Primary: OpenAI
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      retry: { attempts: 2, onStatusCodes: [429, 500, 502, 503] },
    },
    {
      // Fallback: Anthropic
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      retry: { attempts: 2, onStatusCodes: [429, 500, 502, 503] },
    },
  ],
};

async function main() {
  const priorai = new Priorai(config);

  // If OpenAI is down or rate-limited, Anthropic takes over automatically
  const response = await priorai.chat.completions.create({
    model: 'gpt-4o-mini', // Each provider maps to its own model
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
    max_tokens: 10,
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('Provider:', response.provider);
}

main().catch(console.error);
