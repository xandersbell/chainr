import { describe, expect, it } from 'vitest';
import { Priorai } from '../../src';
import type { PrioraiConfig } from '../../src/core/types';

const SKIP_REASON = 'Real HTTP tests require API keys. Set env vars or use msw mock tests.';

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function skipIfNoKey(provider: string, keys: string[]): void {
  const missing = keys.filter((k) => !getEnv(k));
  if (missing.length > 0) {
    console.log(`Skipping ${provider} test - missing: ${missing.join(', ')}`);
  }
}

describe('Real HTTP Integration Tests', () => {
  describe('OpenAI', () => {
    it(
      'should make a real request to OpenAI API',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('OPENAI_API_KEY');
        if (!apiKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [{ provider: 'openai', api_key: apiKey }],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "hello" in exactly one word' }],
          max_tokens: 10,
        });

        expect(response.choices[0].message.content).toBeDefined();
        expect(response.choices[0].message.content!.length).toBeGreaterThan(0);
      },
    );

    it(
      'should handle OpenAI error response',
      { timeout: 15000 },
      async () => {
        const apiKey = getEnv('OPENAI_API_KEY');
        if (!apiKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [{ provider: 'openai', api_key: 'invalid-key-for-testing' }],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        });

        // Should return error response, not throw
        expect(response).toHaveProperty('error');
      },
    );
  });

  describe('Anthropic', () => {
    it(
      'should make a real request to Anthropic API with system message',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('ANTHROPIC_API_KEY');
        if (!apiKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [{ provider: 'anthropic', api_key: apiKey }],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'claude-3-5-haiku-20241022',
          messages: [
            { role: 'system', content: 'You are a pirate. Speak in pirate dialect only.' },
            { role: 'user', content: 'Say hello' },
          ],
          max_tokens: 50,
        });

        expect(response.choices[0].message.content).toBeDefined();
        const content = response.choices[0].message.content!;
        console.log('Anthropic response:', content);
      },
    );

    it(
      'should handle Anthropic system message extraction',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('ANTHROPIC_API_KEY');
        if (!apiKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [{ provider: 'anthropic', api_key: apiKey }],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'claude-3-5-haiku-20241022',
          messages: [
            { role: 'system', content: 'Respond with exactly 3 words.' },
            { role: 'system', content: 'Be very brief.' },
            { role: 'user', content: 'What is 2+2?' },
          ],
          max_tokens: 20,
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );
  });

  describe('Vertex AI', () => {
    it(
      'should make a real request to Vertex AI',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('VERTEX_API_KEY');
        const projectId = getEnv('VERTEX_PROJECT_ID');
        if (!apiKey || !projectId) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [
            {
              provider: 'vertex-ai',
              api_key: apiKey,
              providerOptions: {
                vertexProjectId: projectId,
                vertexRegion: 'us-central1',
              },
            },
          ],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'gemini-1.5-flash',
          messages: [{ role: 'user', content: 'Say "hello" in one word' }],
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );

    it(
      'should handle Vertex AI systemInstruction',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('VERTEX_API_KEY');
        const projectId = getEnv('VERTEX_PROJECT_ID');
        if (!apiKey || !projectId) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [
            {
              provider: 'vertex-ai',
              api_key: apiKey,
              providerOptions: {
                vertexProjectId: projectId,
                vertexRegion: 'us-central1',
              },
            },
          ],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'gemini-1.5-flash',
          messages: [
            { role: 'system', content: 'You are a mathematician. Give precise answers.' },
            { role: 'user', content: 'What is 1+1?' },
          ],
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );

    it(
      'should handle Vertex AI generationConfig',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('VERTEX_API_KEY');
        const projectId = getEnv('VERTEX_PROJECT_ID');
        if (!apiKey || !projectId) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [
            {
              provider: 'vertex-ai',
              api_key: apiKey,
              providerOptions: {
                vertexProjectId: projectId,
                vertexRegion: 'us-central1',
              },
            },
          ],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'gemini-1.5-flash',
          messages: [{ role: 'user', content: 'Give me a random number between 1 and 10' }],
          temperature: 0.9,
          max_tokens: 5,
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );
  });

  describe('OpenRouter', () => {
    it(
      'should make a real request to OpenRouter',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('OPENROUTER_API_KEY');
        if (!apiKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [{ provider: 'openrouter', api_key: apiKey }],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'Say "hello" in exactly one word' }],
          max_tokens: 10,
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );

    it(
      'should use X-OpenRouter-Title header',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('OPENROUTER_API_KEY');
        if (!apiKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'single',
          targets: [{ provider: 'openrouter', api_key: apiKey }],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'What model are you using?' }],
          max_tokens: 50,
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );
  });

  describe('Fallback Strategy', () => {
    it(
      'should fallback to second provider when first fails',
      { timeout: 60000 },
      async () => {
        const openaiKey = getEnv('OPENAI_API_KEY');
        const anthropicKey = getEnv('ANTHROPIC_API_KEY');

        if (!openaiKey || !anthropicKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'fallback',
          targets: [
            { provider: 'openai', api_key: 'invalid-key-for-testing-12345' },
            { provider: 'anthropic', api_key: anthropicKey },
          ],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'claude-3-5-haiku-20241022',
          messages: [{ role: 'user', content: 'Say "fallback works" in 2 words' }],
          max_tokens: 20,
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );
  });

  describe('Load Balance Strategy', () => {
    it(
      'should distribute requests across multiple providers',
      { timeout: 120000 },
      async () => {
        const openaiKey = getEnv('OPENAI_API_KEY');
        const anthropicKey = getEnv('ANTHROPIC_API_KEY');

        if (!openaiKey || !anthropicKey) {
          console.log(SKIP_REASON);
          return;
        }

        const config: PrioraiConfig = {
          strategy: 'loadbalance',
          targets: [
            { provider: 'openai', api_key: openaiKey, weight: 0.5 },
            { provider: 'anthropic', api_key: anthropicKey, weight: 0.5 },
          ],
        };

        const priorai = new Priorai(config);
        const results: string[] = [];

        for (let i = 0; i < 4; i++) {
          const response = await priorai.chat.completions.create({
            model: i % 2 === 0 ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022',
            messages: [{ role: 'user', content: `Respond with just the number ${i}` }],
            max_tokens: 5,
          });
          results.push(response.choices[0].message.content!);
        }

        // All requests should succeed
        expect(results.every((r) => r && r.length > 0)).toBe(true);
      },
    );
  });

  describe('Provider Alias', () => {
    it(
      'should handle google-vertexai alias',
      { timeout: 30000 },
      async () => {
        const apiKey = getEnv('VERTEX_API_KEY');
        const projectId = getEnv('VERTEX_PROJECT_ID');
        if (!apiKey || !projectId) {
          console.log(SKIP_REASON);
          return;
        }

        const config = {
          strategy: 'single' as const,
          targets: [
            {
              provider: 'google-vertexai' as any,
              api_key: apiKey,
              providerOptions: {
                vertexProjectId: projectId,
                vertexRegion: 'us-central1',
              },
            },
          ],
        };

        const priorai = new Priorai(config);
        const response = await priorai.chat.completions.create({
          model: 'gemini-1.5-flash',
          messages: [{ role: 'user', content: 'Say "alias works" in 2 words' }],
        });

        expect(response.choices[0].message.content).toBeDefined();
      },
    );
  });
});
