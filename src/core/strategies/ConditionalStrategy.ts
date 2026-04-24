/**
 * Conditional routing — MongoDB 风格条件路由
 * 根据请求参数和元数据匹配条件，选择对应的 target
 * 从 Portkey 的 conditionalRouter.ts 适配而来
 */
import type { Params } from '../../types/requestBody';
import type { endpointStrings } from '../../providers/types';
import type { StrategyResult, TargetConfig } from '../types';
import type { ChatCompletionChunk } from '../types/streaming';
import { executeTarget, executeTargetStream, type InheritedConfig } from '../tryTarget';

// MongoDB 风格查询对象
type Query = Record<string, unknown>;

/**
 * 条件路由上下文 — SDK 场景下只有 params（请求体）和 metadata（调用方传入）
 * 不包含 URL（SDK 没有 HTTP 路由层）
 */
export interface ConditionalContext {
  metadata?: Record<string, string>;
  params?: Record<string, unknown>;
}

/**
 * 条件配置 — 每个条件包含查询表达式和匹配后的 target 名称
 */
export interface ConditionConfig {
  query: Query;
  then: string;
}

/**
 * 支持的比较和逻辑运算符
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
   * 非流式条件路由
   * 根据 conditions 匹配第一个满足条件的 target，未匹配则走 default
   */
  async execute(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings,
    conditions?: ConditionConfig[],
    defaultTarget?: string,
    metadata?: Record<string, string>
  ): Promise<StrategyResult> {
    const resolved = this.resolveTarget(targets, params, conditions, defaultTarget, metadata);
    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
    return executeTarget(resolved, params, inherited);
  }

  /**
   * 流式条件路由
   */
  async executeStream(
    targets: TargetConfig[],
    params: Params,
    retryConfig?: { attempts?: number; onStatusCodes?: number[] },
    timeoutMs?: number,
    endpoint?: endpointStrings,
    conditions?: ConditionConfig[],
    defaultTarget?: string,
    metadata?: Record<string, string>
  ): Promise<ReadableStream<ChatCompletionChunk>> {
    const resolved = this.resolveTarget(targets, params, conditions, defaultTarget, metadata);
    const inherited: InheritedConfig = { retry: retryConfig, timeout: timeoutMs, endpoint };
    return executeTargetStream(resolved, params, inherited);
  }

  /**
   * 条件匹配 — 遍历 conditions，返回第一个匹配的 target
   */
  private resolveTarget(
    targets: TargetConfig[],
    params: Params,
    conditions?: ConditionConfig[],
    defaultTarget?: string,
    metadata?: Record<string, string>
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

    // 所有条件都不匹配，走 default
    if (defaultTarget) {
      return this.findTarget(targets, defaultTarget);
    }

    throw new Error('Conditional routing did not resolve to any valid target');
  }

  /**
   * 递归评估查询表达式
   * 支持 $and/$or 逻辑组合，以及字段级比较运算符
   */
  private evaluateQuery(query: Query, context: ConditionalContext): boolean {
    for (const [key, value] of Object.entries(query)) {
      // 逻辑运算符 $or
      if (key === Operator.Or && Array.isArray(value)) {
        return value.some((sub: Query) => this.evaluateQuery(sub, context));
      }
      // 逻辑运算符 $and
      if (key === Operator.And && Array.isArray(value)) {
        return value.every((sub: Query) => this.evaluateQuery(sub, context));
      }

      // 字段比较 — 从上下文中取值
      const contextValue = this.getContextValue(key, context);

      if (typeof value === 'object' && value !== null) {
        // 运算符对象，如 { $gt: 100 }
        if (!this.evaluateOperator(value as Record<string, unknown>, contextValue)) {
          return false;
        }
      } else if (contextValue !== value) {
        // 直接相等比较
        return false;
      }
    }
    return true;
  }

  /**
   * 评估运算符表达式
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
   * 按名称查找 target
   */
  private findTarget(targets: TargetConfig[], name: string): TargetConfig {
    const target = targets.find(t => t.name === name);
    if (!target) {
      throw new Error(`Invalid target name in conditional routing: ${name}`);
    }
    return target;
  }

  /**
   * 从上下文中按点分路径取值
   * 支持 "params.model"、"metadata.user_id" 等路径
   */
  private getContextValue(key: string, context: ConditionalContext): unknown {
    const parts = key.split('.');
    if (parts.length < 2) return undefined;
    const root = parts[0] as keyof ConditionalContext;
    const field = parts.slice(1).join('.');
    const obj = context[root];
    if (!obj) return undefined;
    // 支持多级嵌套路径
    return field.split('.').reduce<unknown>(
      (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
      obj
    );
  }
}
