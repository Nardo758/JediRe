/**
 * Unified Orchestrator
 * 
 * Single brain for all channels (Web, Twilio, Telegram, Mobile).
 * Routes queries to specialists, synthesizes responses, calculates JEDI scores.
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

export { UnifiedOrchestrator, unifiedOrchestrator } from './unified-orchestrator';
export { IntentClassifier, type ExtractedIntent } from './intent-classifier';
export { AgentDelegator, type DelegationResult } from './agent-delegator';
export { ResponseSynthesizer } from './response-synthesizer';
export type { OrchestratorRequest, OrchestratorResponse, ChatPlatform } from './unified-orchestrator';
