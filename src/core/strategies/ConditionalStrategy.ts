/**
 * Conditional routing — MongoDB-style conditional routing
 * Match conditions based on request params and metadata, then select the corresponding target
 * Adapted from Portkey's conditionalRouter.ts
 */

import type { endpointStrings } from '../../providers/types';
import type { Params } from '../../types/requestBody';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';

// MongoDB-style query object
type Query = Record<string, unknown>;

/**
 * Conditional routing context — in SDK scenarios only params (request body) and metadata (caller-provided)
 * No URL (SDK has no HTTP routing layer)
 */
export interface ConditionalContext {
  metadata?: Record<string, string>;
  params?: Record<string, unknown>;
}

/**
 * Condition config — each condition contains a query expression and the target name to use on match
 */
export interface ConditionConfig {
  query: Query;
  then: string;
}

/**
 * Supported comparison and logical operators
 */
enum Operator {
  Equal = '$eq',
  NotEqual = '$ne',
  GreaterThan = '$gt',
  GreaterThanOrEqual = '$gte',
  LessThan = '$lt',
  LessThanOrEqual = '$lte',
  In = '$in',
  NotIn = '$nin',
  Regex = '$regex',
  And = '$and',
  Or = '$or',
}

export class ConditionalStrategy {
  /**
   * Non-streaming conditional routing
   * Match the first condition to select a target; fall back to default if none match
   */
  async execute(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings,
    conditions?: ConditionConfig[],
    defaultTarget?: string,
    metadata?: Record<string, string>,
  ): Promise<StrategyResult> {
    const resolved = this.resolveTarget(targets, params, conditions, defaultTarget, metadata);
    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
    return executeTarget(resolved, params, inherited);
  }

  /**
   * Streaming conditional routing
   */
  async executeStream(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings,
    conditions?: ConditionConfig[],
    defaultTarget?: string,
    metadata?: Record<string, string>,
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    const resolved = this.resolveTarget(targets, params, conditions, defaultTarget, metadata);
    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
    return executeTargetStream(resolved, params, inherited);
  }

  /**
   * Condition matching — iterate conditions, return the first matched target
   */
  private resolveTarget(
    targets: TargetConfig[],
    params: Params,
    conditions?: ConditionConfig[],
    defaultTarget?: string,
    metadata?: Record<string, string>,
  ): TargetConfig {
    if (!conditions || conditions.length === 0) {
      throw new Error('No conditions provided for conditional routing');
    }

    const context: ConditionalContext = {
      metadata,
      params: params as unknown as Record<string, unknown>,
    };

    for (const condition of conditions) {
      if (this.evaluateQuery(condition.query, context)) {
        return this.findTarget(targets, condition.then);
      }
    }

    // No condition matched, fall back to default
    if (defaultTarget) {
      return this.findTarget(targets, defaultTarget);
    }

    throw new Error('Conditional routing did not resolve to any valid target');
  }

  /**
   * Recursively evaluate a query expression
   * Supports $and/$or logical combinators and field-level comparison operators
   */
  private evaluateQuery(query: Query, context: ConditionalContext): boolean {
    for (const [key, value] of Object.entries(query)) {
      // Logical operator $or
      if (key === Operator.Or && Array.isArray(value)) {
        return value.some((sub: Query) => this.evaluateQuery(sub, context));
      }
      // Logical operator $and
      if (key === Operator.And && Array.isArray(value)) {
        return value.every((sub: Query) => this.evaluateQuery(sub, context));
      }

      // Field comparison — retrieve value from context
      const contextValue = this.getContextValue(key, context);

      if (typeof value === 'object' && value !== null) {
        // Operator object, e.g. { $gt: 100 }
        if (!this.evaluateOperator(value as Record<string, unknown>, contextValue)) {
          return false;
        }
      } else if (contextValue !== value) {
        // Direct equality comparison
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate an operator expression
   */
  private evaluateOperator(operator: Record<string, unknown>, value: unknown): boolean {
    for (const [op, compareValue] of Object.entries(operator)) {
      switch (op) {
        case Operator.Equal:
          if (value !== compareValue) return false;
          break;
        case Operator.NotEqual:
          if (value === compareValue) return false;
          break;
        case Operator.GreaterThan:
          if (!(parseFloat(String(value)) > parseFloat(String(compareValue)))) return false;
          break;
        case Operator.GreaterThanOrEqual:
          if (!(parseFloat(String(value)) >= parseFloat(String(compareValue)))) return false;
          break;
        case Operator.LessThan:
          if (!(parseFloat(String(value)) < parseFloat(String(compareValue)))) return false;
          break;
        case Operator.LessThanOrEqual:
          if (!(parseFloat(String(value)) <= parseFloat(String(compareValue)))) return false;
          break;
        case Operator.In:
          if (!Array.isArray(compareValue) || !compareValue.includes(value)) return false;
          break;
        case Operator.NotIn:
          if (!Array.isArray(compareValue) || compareValue.includes(value)) return false;
          break;
        case Operator.Regex:
          try {
            return new RegExp(String(compareValue)).test(String(value));
          } catch {
            return false;
          }
        default:
          throw new Error(`Unsupported operator in conditional routing: ${op}`);
      }
    }
    return true;
  }

  /**
   * Find a target by name
   */
  private findTarget(targets: TargetConfig[], name: string): TargetConfig {
    const target = targets.find((t) => t.name === name);
    if (!target) {
      throw new Error(`Invalid target name in conditional routing: ${name}`);
    }
    return target;
  }

  /**
   * Retrieve a value from context by dot-separated path
   * Supports paths like "params.model", "metadata.user_id", etc.
   */
  private getContextValue(key: string, context: ConditionalContext): unknown {
    const parts = key.split('.');
    if (parts.length < 2) return undefined;
    const root = parts[0] as keyof ConditionalContext;
    const field = parts.slice(1).join('.');
    const obj = context[root];
    if (!obj) return undefined;
    // Support multi-level nested paths
    return field
      .split('.')
      .reduce<unknown>(
        (acc, part) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
        obj,
      );
  }
}
