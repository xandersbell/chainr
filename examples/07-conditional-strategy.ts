/**
 * Example: Conditional Strategy
 *
 * Route requests to different providers based on request parameters.
 * Uses MongoDB-style query expressions for condition matching.
 *
 * Run: npx tsx examples/07-conditional-strategy.ts
 * Requires: OPENAI_API_KEY and ANTHROPIC_API_KEY environment variables
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

const config: PrioraiConfig = {
  strategy: 'conditional',
  targets: [
    {
      name: 'openai-target',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    },
    {
      name: 'anthropic-target',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  ],
  conditions: [
    {
      // Route to Anthropic when model starts with "claude"
      query: { 'params.model': { $regex: '^claude' } },
      then: 'anthropic-target',
    },
    {
      // Route to OpenAI when max_tokens > 1000 (long-form generation)
      query: { 'params.max_tokens': { $gt: 1000 } },
      then: 'openai-target',
    },
  ],
  // Default target when no condition matches
  conditionalDefault: 'openai-target',
};

async function main() {
  const priorai = new Priorai(config);

  // This request matches the "claude" regex → routes to Anthropic
  console.log('--- Request 1: Claude model → Anthropic ---');
  const r1 = await priorai.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
    max_tokens: 10,
  });
  console.log('Response:', r1.choices[0].message.content);

  // This request doesn't match any condition → falls back to OpenAI (default)
  console.log('\n--- Request 2: GPT model → OpenAI (default) ---');
  const r2 = await priorai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
    max_tokens: 10,
  });
  console.log('Response:', r2.choices[0].message.content);
}

main().catch(console.error);
