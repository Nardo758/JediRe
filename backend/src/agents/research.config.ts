/**
 * Research Agent — AgentRuntime configuration (Phase 3)
 *
 * This module wires the Research Agent to the shared AgentRuntime,
 * registers all 6 spec-required tools, and exports a singleton
 * runtime instance for use by Inngest and the REST API.
 *
 * Prompt + output schema are loaded at runtime from prompt_versions
 * (seeded by research.seed.ts) rather than inlined here.
 *
 * Tools registered:
 *   fetch_parcel, fetch_costar_metrics, fetch_tax_bill,
 *   fetch_comps, fetch_ownership, write_dealcontext
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

// ── Output schema ─────────────────────────────────────────────────
// Must match the JSON schema seeded in prompt_versions for agent 'research'.
// Keys are dot-separated DealContext field paths written by write_dealcontext.

export const ResearchOutputSchema = z.object({
  /** Short human-readable summary of findings */
  summary: z.string().describe('1-3 sentence summary of key research findings'),
  /** Fraction of data sources that returned usable data, 0–1 */
  confidence_score: z.number().min(0).max(1),
  /** List of field_paths successfully written to deal_context_fields */
  fields_written: z.array(z.string()),
  /** ISO timestamp of completion */
  completed_at: z.string(),
});

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────

export const RESEARCH_AGENT_CONFIG: AgentConfig = {
  agentId: 'research',
  agentVersion: '2.0.0',
  promptVersion: 'research-v2',
  tools: [
    fetchParcelTool,
    fetchCostarMetricsTool,
    fetchTaxBillTool,
    fetchCompsTool,
    fetchOwnershipTool,
    writeDealContextTool,
  ],
  outputSchema: ResearchOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.research,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all', 'write:deal_context'],
};

// ── Singleton runtime ─────────────────────────────────────────────
// Shared across the process; no state stored here — all state is in the DB.

export const researchRuntime = new AgentRuntime(
  RESEARCH_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
