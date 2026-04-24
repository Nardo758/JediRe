/**
 * Research Agent — AgentRuntime configuration (Phase 3)
 *
 * This module wires the Research Agent to the shared AgentRuntime,
 * registers all tools, and exports a singleton runtime instance.
 *
 * Prompt + output schema are loaded at runtime from prompt_versions
 * (seeded by research.seed.ts) rather than inlined here.
 *
 * Tools registered:
 *   fetch_parcel, fetch_costar_metrics, fetch_tax_bill,
 *   fetch_comps, fetch_ownership, write_dealcontext,
 *   web_search, fetch_webpage
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

import { fetchParcelTool } from './tools/fetch_parcel';
import { fetchCostarMetricsTool } from './tools/fetch_costar_metrics';
import { fetchTaxBillTool } from './tools/fetch_tax_bill';
import { fetchCompsTool } from './tools/fetch_comps';
import { fetchOwnershipTool } from './tools/fetch_ownership';
import { writeDealContextTool } from './tools/write_dealcontext';
import { webSearchTool } from './tools/web_search';
import { fetchWebpageTool } from './tools/fetch_webpage';
import { writeCompSetTool } from './tools/write_comp_set';
import { writeMarketCompsTool } from './tools/write_market_comps';
import { fetchProximityContextTool } from './tools/fetch_proximity_context';
import { fetchMarketEventsTool } from './tools/fetch_market_events';
import { fetchBacktestContextTool } from './tools/fetch_backtest_context';

// ── Citation schema (shared with commentary.config) ────────────────────────

export const CitationSchema = z.object({
  source_url: z.string(),
  retrieved_at: z.string(),
  influenced_fields: z.array(z.string()),
});

export type Citation = z.infer<typeof CitationSchema>;

// ── Output schema ─────────────────────────────────────────────────
// Must match the JSON schema seeded in prompt_versions for agent 'research'.
// Keys are dot-separated DealContext field paths written by write_dealcontext.

export const ResearchOutputSchema = z.object({
  summary: z.string().describe('1-3 sentence summary of key research findings'),
  confidence_score: z.number().min(0).max(1),
  fields_written: z.array(z.string()),
  completed_at: z.string(),
  citations: z.array(CitationSchema).optional().default([]),
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────

export const RESEARCH_AGENT_CONFIG: AgentConfig = {
  agentId: 'research',
  agentVersion: '3.0.0',
  promptVersion: 'research-v3',
  tools: [
    fetchParcelTool,
    fetchCostarMetricsTool,
    fetchTaxBillTool,
    fetchCompsTool,
    fetchOwnershipTool,
    writeDealContextTool,
    webSearchTool,
    fetchWebpageTool,
    // Lifecycle tools for market research
    writeCompSetTool,
    writeMarketCompsTool,
    // Spatial intelligence — proximity, events & historical validation
    fetchProximityContextTool,
    fetchMarketEventsTool,
    fetchBacktestContextTool,
  ],
  outputSchema: ResearchOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.research,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all', 'write:deal_context', 'web:search'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const researchRuntime = new AgentRuntime(
  RESEARCH_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
