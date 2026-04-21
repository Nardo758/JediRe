/**
 * Commentary Agent — AgentRuntime configuration (Phase 4)
 *
 * The Commentary agent generates market narrative, investment thesis, and
 * strategy scores. Output is written to the market_commentary table.
 * 24-hour cache is enforced via the cache_key column.
 *
 * Tools registered:
 *   web_search, fetch_webpage
 *   (Commentary remains primarily a generation agent receiving pre-structured
 *    data via the system prompt. Web search is used as a fallback only — e.g.
 *    to verify a recent employer announcement or confirm a news item.)
 *
 * NOTE: Commentary uses a single-turn LLM completion for its main output.
 * Web search tools fire only when the agent determines structured context is
 * insufficient, per the "structured first" search policy.
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

import { webSearchTool } from './tools/web_search';
import { fetchWebpageTool } from './tools/fetch_webpage';
import { CitationSchema } from './research.config';
import { fetchReforecastSummaryTool } from './tools/fetch_reforecast_summary';
import { fetchVarianceSummaryTool } from './tools/fetch_variance_summary';
import { fetchDispositionLearningsTool } from './tools/fetch_disposition_learnings';

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
  citations: z.array(CitationSchema).optional().default([]),
});

export type CommentaryAgentOutput = z.infer<typeof CommentaryOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────

export const COMMENTARY_AGENT_CONFIG: AgentConfig = {
  agentId: 'commentary',
  agentVersion: '3.0.0',
  promptVersion: 'commentary-v3',
  tools: [
    webSearchTool,
    fetchWebpageTool,
    // Lifecycle tools for operational commentary
    fetchReforecastSummaryTool,
    fetchVarianceSummaryTool,
    fetchDispositionLearningsTool,
  ],
  outputSchema: CommentaryOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.commentary,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all', 'web:search'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const commentaryRuntime = new AgentRuntime(
  COMMENTARY_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
