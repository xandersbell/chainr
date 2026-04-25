/**
 * Example: AWS Bedrock with SigV4 Signing
 *
 * Uses AWS credentials for Bedrock API access with automatic SigV4 request signing.
 *
 * Run: npx tsx examples/05-bedrock-sigv4.ts
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and optionally AWS_SESSION_TOKEN
 */
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

const config: PrioraiConfig = {
  strategy: 'single',
  targets: [
    {
      provider: 'bedrock',
      // AWS credentials — picked up from environment or passed explicitly
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsSessionToken: process.env.AWS_SESSION_TOKEN,
      awsRegion: process.env.AWS_REGION ?? 'us-east-1',
    },
  ],
};

async function main() {
  const priorai = new Priorai(config);

  const response = await priorai.chat.completions.create({
    model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
    max_tokens: 10,
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('Model:', response.model);
  console.log('Tokens:', response.usage);
}

main().catch(console.error);
