import { describe, expect, it } from 'vitest';
import { buildAnthropicOutputConfig } from '../../src/providers/anthropic/chatComplete';
import type { Params } from '../../src/types/requestBody';

describe('buildAnthropicOutputConfig', () => {
  it('returns null when no response_format and no reasoning_effort', () => {
    const params = { messages: [], model: 'claude-3' } as Params;
    expect(buildAnthropicOutputConfig(params)).toBeNull();
  });

  it('returns null when response_format is a string', () => {
    const params = { response_format: 'text' } as unknown as Params;
    expect(buildAnthropicOutputConfig(params)).toBeNull();
  });

  it('returns null when response_format.type is json_object (not json_schema)', () => {
    const params = {
      response_format: { type: 'json_object' },
    } as Params;
    expect(buildAnthropicOutputConfig(params)).toBeNull();
  });

  it('maps json_schema to output_config.format with type json_schema', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };
    const params = {
      response_format: {
        type: 'json_schema',
        json_schema: { schema },
      },
    } as unknown as Params;

    const result = buildAnthropicOutputConfig(params);
    expect(result).toEqual({
      format: {
        type: 'json_schema',
        schema,
      },
    });
  });

  it('does not inject json_schema.name into the schema object', () => {
    const schema = { type: 'object', properties: {} };
    const params = {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'MySchema', schema },
      },
    } as unknown as Params;

    const result = buildAnthropicOutputConfig(params);
    // name 不应被注入到 schema 内部，Anthropic API 不需要
    expect(result?.format.schema.name).toBeUndefined();
    expect(result?.format.schema.type).toBe('object');
  });

  it('preserves schema structure without mutation when name is absent', () => {
    const schema = { type: 'object', properties: { id: { type: 'number' } } };
    const params = {
      response_format: {
        type: 'json_schema',
        json_schema: { schema },
      },
    } as unknown as Params;

    const result = buildAnthropicOutputConfig(params);
    expect(result?.format.schema).toEqual(schema);
  });

  it('maps reasoning_effort to output_config.effort', () => {
    const params = { reasoning_effort: 'high' } as Params;
    const result = buildAnthropicOutputConfig(params);
    expect(result).toEqual({ effort: 'high' });
  });

  it('returns both format and effort when json_schema and reasoning_effort are set', () => {
    const schema = { type: 'object', properties: {} };
    const params = {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'Combined', schema },
      },
      reasoning_effort: 'medium',
    } as unknown as Params;

    const result = buildAnthropicOutputConfig(params);
    expect(result).toEqual({
      format: {
        type: 'json_schema',
        schema: { type: 'object', properties: {} },
      },
      effort: 'medium',
    });
  });

  it('returns null when json_schema has no schema property', () => {
    const params = {
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'NoSchema' },
      },
    } as unknown as Params;

    expect(buildAnthropicOutputConfig(params)).toBeNull();
  });

  it('handles nested/complex schema objects correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            addresses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  street: { type: 'string' },
                  city: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['user'],
    };
    const params = {
      response_format: {
        type: 'json_schema',
        json_schema: { schema },
      },
    } as unknown as Params;

    const result = buildAnthropicOutputConfig(params);
    expect(result?.format.schema).toEqual(schema);
    expect(
      result?.format.schema.properties.user.properties.addresses.items.properties.city.type,
    ).toBe('string');
  });
});
