/**
 * Supply Agent — AgentRuntime configuration (Phase 4)
 *
 * Tools registered:
 *   fetch_permits, fetch_costar_pipeline, fetch_submarket_deliveries,
 *   write_supply_analysis
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

import { fetchPermitsTool } from './tools/fetch_permits';
import { fetchCostarPipelineTool } from './tools/fetch_costar_pipeline';
import { fetchSubmarketDeliveriesTool } from './tools/fetch_submarket_deliveries';
import { writeSupplyAnalysisTool } from './tools/write_supply_analysis';

// ── Output schema ─────────────────────────────────────────────────

export const SupplyOutputSchema = z.object({
  city: z.string(),
  state_code: z.string(),
  under_construction_units: z.number().nullable(),
  deliveries_12mo: z.number().nullable(),
  absorption_rate: z.number().nullable(),
  months_of_supply: z.number().nullable(),
  pipeline_as_pct_of_stock: z.number().nullable(),
  demand_supply_ratio: z.number().nullable(),
  supply_risk_level: z.enum(['low', 'moderate', 'high', 'severe']).nullable(),
  summary: z.string().describe('2-4 sentence supply analysis summary'),
  confidence_score: z.number().min(0).max(1),
  fields_written: z.array(z.string()),
  completed_at: z.string(),
});

export type SupplyAgentOutput = z.infer<typeof SupplyOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────

export const SUPPLY_AGENT_CONFIG: AgentConfig = {
  agentId: 'supply',
  agentVersion: '2.0.0',
  promptVersion: 'supply-v2',
  tools: [
    fetchPermitsTool,
    fetchCostarPipelineTool,
    fetchSubmarketDeliveriesTool,
    writeSupplyAnalysisTool,
  ],
  outputSchema: SupplyOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.supply,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all', 'write:deal_context'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const supplyRuntime = new AgentRuntime(
  SUPPLY_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
