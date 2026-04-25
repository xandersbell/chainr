import { describe, expect, it } from 'vitest';
import { getFallbackChunkId, getSplitPattern } from '../../../src/core/streamUtils';

describe('streamUtils', () => {
  describe('getSplitPattern', () => {
    it('returns double newline for openai', () => {
      expect(getSplitPattern('openai')).toBe('\n\n');
    });

    it('returns double newline for openrouter', () => {
      expect(getSplitPattern('openrouter')).toBe('\n\n');
    });

    it('returns crlf for perplexity', () => {
      expect(getSplitPattern('perplexity')).toBe('\r\n\r\n');
    });

    it('returns crlf for vertex-ai', () => {
      expect(getSplitPattern('vertex-ai')).toBe('\r\n\r\n');
    });

    it('returns crlf for google', () => {
      expect(getSplitPattern('google')).toBe('\r\n');
    });

    it('returns crlf for anthropic /complete endpoint', () => {
      expect(getSplitPattern('anthropic', '/complete')).toBe('\r\n\r\n');
    });

    it('returns double newline for anthropic /v1/messages', () => {
      expect(getSplitPattern('anthropic', '/v1/messages')).toBe('\n\n');
    });

    it('returns double newline for Azure OpenAI', () => {
      expect(getSplitPattern('azure-openai')).toBe('\n\n');
    });

    it('returns double newline for x-ai', () => {
      expect(getSplitPattern('x-ai')).toBe('\n\n');
    });

    it('returns double newline for GitHub Models', () => {
      expect(getSplitPattern('github')).toBe('\n\n');
    });

    it('returns double newline for Azure AI Inference', () => {
      expect(getSplitPattern('azure-ai')).toBe('\n\n');
    });

    it('returns double newline for Bedrock', () => {
      expect(getSplitPattern('bedrock')).toBe('\n\n');
    });

    it('returns default double newline for unknown provider', () => {
      expect(getSplitPattern('unknown')).toBe('\n\n');
    });
  });

  describe('getFallbackChunkId', () => {
    it('returns string starting with provider name', () => {
      const id = getFallbackChunkId('openai');
      expect(id.startsWith('openai-')).toBe(true);
    });

    it('returns string starting with anthropic', () => {
      const id = getFallbackChunkId('anthropic');
      expect(id.startsWith('anthropic-')).toBe(true);
    });

    it('returns different format than input', () => {
      const id = getFallbackChunkId('openai');
      expect(id).toMatch(/^openai-\d+$/);
    });
  });
});
