/**
 * Chainr - Unified LLM Gateway SDK
 * 
 * A TypeScript/Node.js SDK for routing LLM requests across multiple providers
 * with priority-based fallback and load balancing.
 * 
 * @see https://github.com/xandersbell/chainr
 */

export { Chainr } from './core/Router';
export { FallbackStrategy } from './core/strategies/FallbackStrategy';
export { LoadBalanceStrategy } from './core/strategies/LoadBalanceStrategy';
export * from './providers/types';
