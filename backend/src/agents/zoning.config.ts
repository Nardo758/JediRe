/**
 * Zoning Agent — AgentRuntime configuration (Phase 4)
 *
 * Tools registered:
 *   fetch_parcel, fetch_zoning_code, fetch_municode,
 *   compute_envelope, write_zoning_analysis,
 *   web_search (gov-only allowlist — no fetch_webpage)
 *
 * Web search policy: gov-only allowlist (*.gov, municode.com, state regulator sites),
 * 7-day cache (zoning codes change slowly), max 3 searches per run.
 * fetch_webpage is not available to Zoning — gov sites are handled by
 * fetch_municode and fetch_zoning_code structured tools.
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

import { fetchParcelTool } from './tools/fetch_parcel';
import { fetchZoningCodeTool } from './tools/fetch_zoning_code';
import { fetchMunicodeTool } from './tools/fetch_municode';
import { computeEnvelopeTool } from './tools/compute_envelope';
import { writeZoningAnalysisTool } from './tools/write_zoning_analysis';
import { webSearchTool } from './tools/web_search';

// ── Output schema ─────────────────────────────────────────────────

export const ZoningOutputSchema = z.object({
  zoning_code: z.string().describe('Current zoning classification'),
  zoning_description: z.string().nullable().describe('Human-readable zoning name'),
  permitted_uses: z.array(z.string()).describe('By-right permitted uses'),
  max_far: z.number().nullable().describe('Maximum floor-area ratio'),
  max_height_ft: z.number().nullable().describe('Height limit in feet'),
  max_gfa_sqft: z.number().nullable().describe('Maximum buildable GFA in sq ft'),
  est_max_units: z.number().nullable().describe('Estimated maximum unit count'),
  entitlement_risk: z.enum(['low', 'medium', 'high']).nullable(),
  summary: z.string().describe('1-3 sentence zoning analysis summary'),
  confidence_score: z.number().min(0).max(1),
  completed_at: z.string(),
});

export type ZoningAgentOutput = z.infer<typeof ZoningOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────

export const ZONING_AGENT_CONFIG: AgentConfig = {
  agentId: 'zoning',
  agentVersion: '3.0.0',
  promptVersion: 'zoning-v3',
  tools: [
    fetchParcelTool,
    fetchZoningCodeTool,
    fetchMunicodeTool,
    computeEnvelopeTool,
    writeZoningAnalysisTool,
    webSearchTool,
  ],
  outputSchema: ZoningOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.zoning,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all', 'write:zoning_analysis', 'web:search'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const zoningRuntime = new AgentRuntime(
  ZONING_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
