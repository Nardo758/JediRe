/**
 * CashFlow Agent — AgentRuntime configuration (Phase 4)
 *
 * Tools registered:
 *   fetch_t12, fetch_rent_roll, fetch_assumptions,
 *   compute_proforma, write_projection
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import type { AgentConfig } from './runtime/types';

import { fetchT12Tool } from './tools/fetch_t12';
import { fetchRentRollTool } from './tools/fetch_rent_roll';
import { fetchAssumptionsTool } from './tools/fetch_assumptions';
import { computeProformaTool } from './tools/compute_proforma';
import { writeProjectionTool } from './tools/write_projection';

// ── Output schema ─────────────────────────────────────────────────

export const CashflowOutputSchema = z.object({
  purchase_price: z.number().nullable(),
  noi_year1: z.number().nullable(),
  year1_cap_rate_pct: z.number().nullable(),
  irr_pct: z.number().nullable(),
  avg_cash_on_cash_pct: z.number().nullable(),
  dscr_year1: z.number().nullable(),
  equity_invested: z.number().nullable(),
  exit_value: z.number().nullable(),
  investment_rating: z.enum(['strong', 'adequate', 'marginal', 'weak']).nullable(),
  summary: z.string().describe('2-4 sentence cashflow analysis summary'),
  has_t12_data: z.boolean(),
  has_rent_roll: z.boolean(),
  confidence_score: z.number().min(0).max(1),
  fields_written: z.array(z.string()),
  completed_at: z.string(),
});

export type CashflowAgentOutput = z.infer<typeof CashflowOutputSchema>;

// ── Agent config ──────────────────────────────────────────────────

export const CASHFLOW_AGENT_CONFIG: AgentConfig = {
  agentId: 'cashflow',
  agentVersion: '2.0.0',
  promptVersion: 'cashflow-v3',
  tools: [
    fetchT12Tool,
    fetchRentRollTool,
    fetchAssumptionsTool,
    computeProformaTool,
    writeProjectionTool,
  ],
  outputSchema: CashflowOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.cashflow,
  modelName: 'claude-haiku-4-5-20251001',
  capabilities: ['read:all', 'write:deal_context'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const cashflowRuntime = new AgentRuntime(
  CASHFLOW_AGENT_CONFIG,
  new MeteringAdapter(),
  new BudgetEnforcer()
);
