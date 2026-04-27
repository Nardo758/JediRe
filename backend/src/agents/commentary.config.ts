/**
 * Commentary Agent — AgentRuntime configuration (Phase 5)
 *
 * Autonomous market narrative agent. Generates commentary by first fetching
 * deal context via fetch_data_matrix (the same brain every other agent uses),
 * then producing structured output. No longer receives pre-built context —
 * the model calls the tool itself, consistent with Research/Supply/Cashflow.
 *
 * Tools:
 *   fetch_data_matrix   — primary data source (deal context, market signals)
 *   web_search          — fallback for current events verification
 *   fetch_webpage       — verify claims from web results
 *   fetch_*_summary     — lifecycle tools for operational commentary
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

import { webSearchTool } from './tools/web_search';
import { fetchWebpageTool } from './tools/fetch_webpage';
import { fetchDataMatrixTool } from './tools/fetch_data_matrix';
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
  agentVersion: '3.1.0',
  promptVersion: 'commentary-v6',
  tools: [
    fetchDataMatrixTool,
    webSearchTool,
    fetchWebpageTool,
    // Lifecycle tools for operational commentary
    fetchReforecastSummaryTool,
    fetchVarianceSummaryTool,
    fetchDispositionLearningsTool,
  ],
  outputSchema: CommentaryOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.commentary,
  modelName: 'deepseek-chat',
  capabilities: ['read:all', 'web:search', 'data:matrix'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const commentaryRuntime = new AgentRuntime(
  COMMENTARY_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
