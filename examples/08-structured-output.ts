/**
 * Example: Structured Output with Fallback
 *
 * Use response_format.json_schema to get structured JSON from any provider.
 * Priorai normalizes the schema format for each provider automatically —
 * you write one schema, it works across OpenAI, Anthropic, and Google.
 *
 * Run: npx tsx examples/08-structured-output.ts
 * Requires: OPENAI_API_KEY, ANTHROPIC_API_KEY, and GOOGLE_API_KEY environment variables
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

const config: PrioraiConfig = {
  strategy: 'fallback',
  targets: [
    {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    },
    {
      provider: 'google',
      apiKey: process.env.GOOGLE_API_KEY,
    },
    {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  ],
};

async function main() {
  const priorai = new Priorai(config);

  // One schema, works across all providers
  const response = await priorai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: 'Generate a person profile for Alice, age 30, who lives in Tokyo.',
      },
    ],
    max_tokens: 256,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'Person',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
            city: { type: 'string' },
            hobbies: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['name', 'age', 'city'],
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const person = JSON.parse(content!);

  console.log('Provider:', response.provider);
  console.log('Person:', person);
  console.log('Name:', person.name);
  console.log('Age:', person.age);
  console.log('City:', person.city);
}

main().catch(console.error);
