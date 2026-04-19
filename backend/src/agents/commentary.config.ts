/**
 * Commentary Agent — AgentRuntime configuration (Phase 4)
 *
 * The Commentary agent generates market narrative, investment thesis, and
 * strategy scores. Output is written to the market_commentary table.
 * 24-hour cache is enforced via the cache_key column.
 *
 * Tools registered:
 *   (Commentary uses only the general LLM loop — no external tool calls.
 *    Data is supplied in the prompt via context fragments.)
 *
 * NOTE: The Commentary Agent does NOT use tool-calling — it's a pure
 * generation agent that receives pre-structured data via the system prompt
 * and outputs a complete JSON object in one turn.
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

// ── Output schema ─────────────────────────────────────────────────

const CommentarySectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  sentiment: z.enum(['bullish', 'neutral', 'bearish']),
});

export const CommentaryOutputSchema = z.object({
  entity_type: z.string(),
  entity_id: z.string(),
  entity_name: z.string(),
  market_narrative: CommentarySectionSchema,
  investment_thesis: z.object({
    recommendation: z.string(),
    points: z.array(z.object({
      icon: z.string(),
      color: z.enum(['green', 'amber', 'red']),
      text: z.string(),
    })),
  }),
  supply_narrative: CommentarySectionSchema,
  recommended_strategy: z.string(),
  jedi_score: z.number().min(0).max(100),
  arbitrage_flag: z.boolean(),
  arbitrage_delta: z.number(),
  summary: z.string(),
  confidence_score: z.number().min(0).max(1),
  completed_at: z.string(),
});

export type CommentaryAgentOutput = z.infer<typeof CommentaryOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────
// No tools — Commentary is a pure generation agent (single-turn LLM completion).

export const COMMENTARY_AGENT_CONFIG: AgentConfig = {
  agentId: 'commentary',
  agentVersion: '2.0.0',
  promptVersion: 'commentary-v2',
  tools: [],
  outputSchema: CommentaryOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.commentary,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const commentaryRuntime = new AgentRuntime(
  COMMENTARY_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
