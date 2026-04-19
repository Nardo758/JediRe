/**
 * JEDI RE — Agent Platform Runtime Types
 *
 * These interfaces are used by all Layer 1 agents (Research, Zoning, Supply,
 * CashFlow, Commentary). See AGENT_PLATFORM_SPEC.md for the full specification.
 *
 * Three layers in the system:
 *   Layer 1 — Agents (5): AgentRuntime instances with service accounts
 *   Layer 2 — Routing Specialists (10): Intent labels, not agents
 *   Layer 3 — Analyst Personas (16): System-prompt variants
 */

import { z } from 'zod';

// ── Agent identity ────────────────────────────────────────────────────────────

export type AgentId =
  | 'research'
  | 'zoning'
  | 'supply'
  | 'cashflow'
  | 'commentary';

export type ModelName =
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5-20251001';

// ── Budget enforcement ────────────────────────────────────────────────────────

export interface BudgetCaps {
  maxTokensPerRun: number;
  maxCostUsdPerRun: number;
  maxStepsPerRun: number;
  maxCostUsdPerDealPerDay: number;
  maxCostUsdPerUserPerMonth: number;
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

// ── Run context ───────────────────────────────────────────────────────────────

export interface RunContext {
  dealId?: string;
  userId?: string;
  triggeredBy: 'user' | 'event' | 'cron';
  triggerContext?: Record<string, unknown>;
  correlationId?: string;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  requiresCapability: string;
  execute: (input: TInput, ctx: RunContext) => Promise<TOutput>;
}

// ── Agent configuration ───────────────────────────────────────────────────────

export interface AgentConfig {
  agentId: AgentId;
  agentVersion: string;
  promptVersion: string;
  tools: ToolDefinition[];
  outputSchema: z.ZodSchema;
  budgetCaps: BudgetCaps;
  modelName: ModelName;
  /** Capability strings for this agent, e.g. ['read:all', 'write:deal_context'].
   *  Used by AgentRuntime.executeTool() to enforce requiresCapability at runtime.
   *  Supports wildcard: 'read:all' grants any 'read:*' capability.
   */
  capabilities: string[];
}

// ── Run tracking ──────────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'aborted'
  | 'budget_exceeded';

export type StepType = 'prompt' | 'tool_call' | 'tool_result' | 'output';

export type TriggerBucket = 'user' | 'event' | 'cron';

export interface AgentRun {
  id: string;
  agent_id: string;
  agent_version: string;
  prompt_version: string;
  deal_id?: string;
  triggered_by: TriggerBucket;
  trigger_context?: Record<string, unknown>;
  user_id?: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface AgentRunStep {
  id: string;
  agent_run_id: string;
  step_index: number;
  step_type: StepType;
  tool_name?: string;
  payload: Record<string, unknown>;
  tokens_in?: number;
  tokens_out?: number;
  duration_ms?: number;
  created_at: string;
}

// ── Loop result ───────────────────────────────────────────────────────────────

export interface LoopResult {
  content: Record<string, unknown>;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

// ── Metering ──────────────────────────────────────────────────────────────────

export interface MeteringMetadata {
  actor_type: 'human' | 'agent';
  actor_id: string;
  agent_run_id?: string;
  deal_id?: string;
  user_id?: string;
  triggered_by?: TriggerBucket;
}
