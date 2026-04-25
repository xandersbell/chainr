/**
 * Example: Streaming Chat Completion
 *
 * Stream tokens as they arrive instead of waiting for the full response.
 * Works with any provider that supports streaming.
 *
 * Run: npx tsx examples/06-streaming.ts
 * Requires: OPENAI_API_KEY environment variable
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';
import type { ChatCompletionChunk } from '../src/core/types/streaming';

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

  const stream = (await priorai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Write a haiku about programming.' }],
    stream: true,
    max_tokens: 100,
  })) as ReadableStream<ChatCompletionChunk>;

  const reader = stream.getReader();

  process.stdout.write('Response: ');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // value is a ChatCompletionChunk — extract the delta content
    const content = value.choices?.[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }

  console.log('\n\nStream complete.');
}

main().catch(console.error);
