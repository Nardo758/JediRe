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
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5-20251001'
  | 'deepseek-chat'
  | 'deepseek-reasoner';

/**
 * The LLM provider that services a model name.
 * Determined by model name prefix.
 */
export type LlmProvider = 'anthropic' | 'deepseek' | 'openai';

export function detectProvider(modelName: string): LlmProvider {
  if (modelName.startsWith('claude-')) return 'anthropic';
  if (modelName.startsWith('deepseek')) return 'deepseek';
  if (modelName.startsWith('gpt') || modelName.startsWith('o')) return 'openai';
  // default: treat unknown model names as anthropic for back-compat
  return 'anthropic';
}

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
  /** The AgentId of the agent executing this run.
   *  Stamped from AgentConfig.agentId by AgentRuntime before the loop.
   *  Tools use this for platformClient.as() identity instead of hardcoding. */
  agentId?: AgentId;
  triggeredBy: 'user' | 'event' | 'cron';
  triggerContext?: Record<string, unknown>;
  correlationId?: string;
  /**
   * Optional system prompt override — when set, AgentRuntime skips the prompt_versions
   * DB query and uses this string directly. Used by cashflow orchestration to inject
   * a deal-type-specific composite prompt (core + variant) without DB contention.
   */
  systemPromptOverride?: string;

  /**
   * Data preamble — a human-readable summary of extracted deal data
   * (T12, rent roll, OM, broker claims) that gets prepended to the
   * agent's system prompt before the prompt_versions DB loaded prompt.
   * This lets pipeline agents see actual deal-level data without
   * modifying their stored prompts.
   */
  dataPreamble?: string;

  /**
   * The requesting user's platform role (Task #878).
   * 'sponsor' | 'lp' | 'lender' — carried through the run so postProcess
   * can deterministically select the role-appropriate framing from the
   * three-variant role_framing output field and surface it as active_role_framing.
   * Defaults to 'sponsor' when not set.
   */
  platformRole?: string;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  requiresCapability?: string;
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
  /** Override the LLM provider for this agent (default: auto-detected from modelName) */
  provider?: LlmProvider;
  /**
   * Optional post-processing hook: runs after the model's final response but before
   * output schema validation. Receives the raw model output and the run context,
   * should return a (possibly enriched) object that matches the outputSchema.
   * Use for agents whose data is persisted via tool calls (e.g. Cashflow writes
   * proforma_fields via write_underwriting) so the runtime can aggregate results
   * from DB instead of requiring the model to echo back its own tool history.
   */
  postProcess?: (rawOutput: unknown, ctx: RunContext, runId: string) => Promise<Record<string, unknown>>;

  /**
   * Optional first-turn tool forcing — when set, the runtime passes
   * tool_choice: { type: "function", function: { name: firstToolCall } }
   * on the very first LLM request of the loop ONLY. This ensures deterministic
   * first-step behavior (e.g. Commentary must call fetch_data_matrix before
   * producing any output) without requiring fragile prompt engineering.
   *
   * After the first turn resolves, the loop reverts to auto tool selection.
   */
  firstToolCall?: string;
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
