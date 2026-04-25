/**
 * Example: Single Provider
 *
 * The simplest usage — route all requests to one provider.
 *
 * Run: npx tsx examples/01-single-provider.ts
 * Requires: OPENAI_API_KEY environment variable
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

const config: PrioraiConfig = {
  strategy: 'single',
  targets: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    },
  ],
};

async function main() {
  const priorai = new Priorai(config);

  const response = await priorai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is 2 + 2?' },
    ],
    max_tokens: 50,
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('Model:', response.model);
  console.log('Tokens:', response.usage);
}

main().catch(console.error);
