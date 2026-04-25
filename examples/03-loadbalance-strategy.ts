/**
 * Example: Weighted Load Balancing
 *
 * Distribute requests across providers by weight.
 * 70% of traffic goes to OpenAI, 30% to Anthropic.
 *
 * Run: npx tsx examples/03-loadbalance-strategy.ts
 * Requires: OPENAI_API_KEY and ANTHROPIC_API_KEY environment variables
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

const config: PrioraiConfig = {
  strategy: 'loadbalance',
  targets: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      weight: 0.7,
    },
    {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      weight: 0.3,
    },
  ],
};

async function main() {
  const priorai = new Priorai(config);

  // Send 10 requests and observe the distribution
  const counts: Record<string, number> = {};

  for (let i = 0; i < 10; i++) {
    const response = await priorai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Say the number ${i}` }],
      max_tokens: 5,
    });

    const provider = response.provider ?? 'unknown';
    counts[provider] = (counts[provider] || 0) + 1;
    console.log(`Request ${i}: provider=${provider}, content=${response.choices[0].message.content}`);
  }

  console.log('\nDistribution:', counts);
}

main().catch(console.error);
