/**
 * Vertex AI ADC 本地集成测试
 * 验证通过 ADC 自动认证调用 Gemini Flash
 *
 * 运行方式：npx tsx tests/local/vertex-adc-live.ts
 */
import { Priorai } from '../../src';
import type { PrioraiConfig } from '../../src/core/types';

async function main() {
  // 不传 api_key，完全依赖 ADC 自动发现
  // vertexRegion 设为 global，使用全局端点
  const config: PrioraiConfig = {
    strategy: 'single',
    targets: [{
      provider: 'vertex-ai',
      providerOptions: {
        vertexProjectId: 'project-049f7a4c-e603-4745-aaf',
        vertexRegion: 'global',
      },
    }],
  };

  const priorai = new Priorai(config);

  console.log('Sending request to Vertex AI via ADC...');
  console.log('Project: project-049f7a4c-e603-4745-aaf');
  console.log('Region: global');
  console.log('Model: gemini-flash-latest');
  console.log('---');

  try {
    const response = await priorai.chat.completions.create({
      model: 'gemini-flash-latest',
      messages: [{ role: 'user', content: 'Say "hello world" in exactly two words.' }],
      max_tokens: 20,
    });

    console.log('Response received:');
    console.log('Content:', response.choices[0].message.content);
    console.log('Model:', response.model);
    console.log('Usage:', response.usage);
    console.log('---');
    console.log('ADC authentication works!');
  } catch (error: any) {
    console.error('Request failed:');
    console.error('Status:', error.status ?? error.statusCode);
    console.error('Message:', error.message);
    if (error.response) {
      const text = typeof error.response === 'string'
        ? error.response
        : JSON.stringify(error.response, null, 2);
      console.error('Response body:', text);
    }
    process.exit(1);
  }
}

main();
