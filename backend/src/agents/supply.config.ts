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
import { fetchDataMatrixTool } from './tools/fetch_data_matrix';
import { webSearchTool } from './tools/web_search';
import { fetchWebpageTool } from './tools/fetch_webpage';
import { fetchDataLibraryCompsTool } from './tools/fetch_data_library_comps';

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
  agentVersion: '2.1.0',
  promptVersion: 'supply-v4',
  tools: [
    fetchPermitsTool,
    fetchCostarPipelineTool,
    fetchSubmarketDeliveriesTool,
    writeSupplyAnalysisTool,
    // Full context assembler — market events, employer moves, and spatial context
    fetchDataMatrixTool,
    fetchDataLibraryCompsTool,  // Data Library comps for rent/expense benchmarks
    webSearchTool,              // Gov APIs, permit portals, listing sites for gap-filling
    fetchWebpageTool,           // Pull full content from search result URLs
  ],
  outputSchema: SupplyOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.supply,
  modelName: 'deepseek-chat',
  capabilities: ['read:all', 'write:deal_context', 'web:search'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const supplyRuntime = new AgentRuntime(
  SUPPLY_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
