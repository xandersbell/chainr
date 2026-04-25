/**
 * Example: Vertex AI with Application Default Credentials (ADC)
 *
 * No API key needed — uses Google Cloud ADC for authentication.
 * Works with `gcloud auth application-default login` or service account JSON.
 *
 * Run: npx tsx examples/04-vertex-ai-adc.ts
 * Requires: gcloud CLI configured with a default project, or GOOGLE_APPLICATION_CREDENTIALS set
 */
import { execSync } from 'node:child_process';
import { Priorai } from '../src';
import type { PrioraiConfig } from '../src/core/types';

// Auto-detect project from gcloud CLI
function getProjectId(): string {
  const projectId = execSync('gcloud config get-value project', { encoding: 'utf-8' }).trim();
  if (!projectId || projectId === '(unset)') {
    throw new Error('No default GCP project. Run: gcloud config set project <PROJECT_ID>');
  }
  return projectId;
}

async function main() {
  const projectId = getProjectId();

  const config: PrioraiConfig = {
    strategy: 'single',
    targets: [
      {
        provider: 'vertex-ai',
        // No apiKey — ADC handles authentication automatically
        providerOptions: {
          vertexProjectId: projectId,
          vertexRegion: 'global',
        },
      },
    ],
  };

  const priorai = new Priorai(config);

  console.log(`Sending request via Vertex AI ADC (project: ${projectId})...`);

  const response = await priorai.chat.completions.create({
    model: 'gemini-flash-latest',
    messages: [{ role: 'user', content: 'Say "hello world" in exactly two words.' }],
    max_tokens: 20,
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('Model:', response.model);
  console.log('Tokens:', response.usage);
}

main().catch(console.error);
