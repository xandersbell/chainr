import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSSEData, isStreamDone } from '../../../src/core/sseParser';

describe('sseParser', () => {
  describe('parseSSEData', () => {
    it('returns null for DONE signal', () => {
      expect(parseSSEData('[DONE]')).toBe(null);
    });

    it('parses data prefix format', () => {
      const result = parseSSEData('data: {"id":"test"}');
      expect(result).toEqual({ id: 'test' });
    });

    it('parses raw JSON without data prefix', () => {
      const result = parseSSEData('{"id":"test","content":"hello"}');
      expect(result).toEqual({ id: 'test', content: 'hello' });
    });

    it('handles whitespace trimming', () => {
      const result = parseSSEData('  data: {"id":"test"}  ');
      expect(result).toEqual({ id: 'test' });
    });

    it('parses complex chunk structure', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      };
      const result = parseSSEData(JSON.stringify(chunk));
      expect(result).toEqual(chunk);
    });
  });

  describe('isStreamDone', () => {
    it('returns true for DONE signal', () => {
      expect(isStreamDone('[DONE]')).toBe(true);
    });

    it('returns false for data content', () => {
      expect(isStreamDone('data: {"id":"test"}')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isStreamDone('')).toBe(false);
    });

    it('returns false for partial data', () => {
      expect(isStreamDone('data: {"part')).toBe(false);
    });
  });
});

describe('parseSSEStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('yields chunks split by double newline pattern', async () => {
    const chunks: string[] = [];
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content":"Hello"}\n\ndata: {"content":"World"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    } as any;

    const iterator = (async function*() {
      let buffer = '';
      const decoder = new TextDecoder();
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await mockReader.read();
        if (done) {
          if (buffer.length > 0) {
            yield buffer;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.split('\n\n').length > 1) {
          const parts = buffer.split('\n\n');
          const lastPart = parts.pop() ?? '';

          for (const part of parts) {
            if (part.length > 0) {
              if (isFirstChunk) {
                isFirstChunk = false;
                await new Promise(resolve => setTimeout(resolve, 25));
              }
              yield part;
            }
          }

          buffer = lastPart;
        }
      }
    })();

    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain('Hello');
    expect(chunks[1]).toContain('World');
  });

  it('handles empty chunks gracefully', async () => {
    const chunks: string[] = [];
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('\n\ndata: {"content":"Hello"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    } as any;

    const iterator = (async function*() {
      let buffer = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await mockReader.read();
        if (done) {
          if (buffer.length > 0) {
            yield buffer;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.split('\n\n').length > 1) {
          const parts = buffer.split('\n\n');
          const lastPart = parts.pop() ?? '';

          for (const part of parts) {
            if (part.length > 0) {
              yield part;
            }
          }

          buffer = lastPart;
        }
      }
    })();

    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('Hello');
  });

  it('handles DONE signal correctly', async () => {
    const chunks: string[] = [];
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content":"Hello"}\n\ndata: [DONE]\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    } as any;

    const iterator = (async function*() {
      let buffer = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await mockReader.read();
        if (done) {
          if (buffer.length > 0) {
            yield buffer;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.split('\n\n').length > 1) {
          const parts = buffer.split('\n\n');
          const lastPart = parts.pop() ?? '';

          for (const part of parts) {
            if (part.length > 0) {
              if (!part.includes('[DONE]')) {
                yield part;
              }
            }
          }

          buffer = lastPart;
        }
      }
    })();

    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('Hello');
  });

  it('handles partial data across multiple reads', async () => {
    const chunks: string[] = [];
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content":"Hel') })
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('lo"}\n\ndata: {"content":"World"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    } as any;

    const iterator = (async function*() {
      let buffer = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await mockReader.read();
        if (done) {
          if (buffer.length > 0) {
            yield buffer;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.split('\n\n').length > 1) {
          const parts = buffer.split('\n\n');
          const lastPart = parts.pop() ?? '';

          for (const part of parts) {
            if (part.length > 0) {
              yield part;
            }
          }

          buffer = lastPart;
        }
      }
    })();

    for await (const chunk of iterator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
  });

  it('uses transform function when provided', async () => {
    const transformed: string[] = [];
    const transformFn = (chunk: string) => `transformed:${chunk}`;

    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"content":"Hello"}\n\n') })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    } as any;

    const iterator = (async function*() {
      let buffer = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await mockReader.read();
        if (done) {
          if (buffer.length > 0 && transformFn) {
            yield transformFn(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.split('\n\n').length > 1) {
          const parts = buffer.split('\n\n');
          const lastPart = parts.pop() ?? '';

          for (const part of parts) {
            if (part.length > 0 && transformFn) {
              yield transformFn(part);
            }
          }

          buffer = lastPart;
        }
      }
    })();

    for await (const chunk of iterator) {
      transformed.push(chunk);
    }

    expect(transformed.length).toBe(1);
    expect(transformed[0]).toBe('transformed:data: {"content":"Hello"}');
  });
});