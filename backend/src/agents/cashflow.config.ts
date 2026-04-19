/**
 * CashFlow Agent — AgentRuntime configuration (Phase 5: Evidence System)
 *
 * Tools registered:
 *   Tier 1: fetch_t12, fetch_rent_roll, fetch_assumptions
 *   Tier 2: fetch_owned_asset_actuals, fetch_owned_asset_opex_ratios
 *   Tier 3: fetch_peer_comp_noi_metrics, fetch_jurisdiction_tax_forecast,
 *            fetch_jurisdiction_insurance_forecast, fetch_m35_event_forecast
 *   Analysis: detect_collision
 *   Compute: compute_proforma
 *   Write: write_projection, write_underwriting, request_walkthrough_narrative
 *
 * Budget caps elevated for evidence-system depth:
 *   maxTokensPerRun: 800,000 | maxCostUsdPerRun: $8.00 | maxStepsPerRun: 35
 */

import { z } from 'zod';
import { AgentRuntime } from './runtime/AgentRuntime';
import { MeteringAdapter } from './runtime/MeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import { query } from '../database/connection';
import type { AgentConfig } from './runtime/types';

import { fetchT12Tool } from './tools/fetch_t12';
import { fetchRentRollTool } from './tools/fetch_rent_roll';
import { fetchAssumptionsTool } from './tools/fetch_assumptions';
import { computeProformaTool } from './tools/compute_proforma';
import { writeProjectionTool } from './tools/write_projection';
import { fetchOwnedAssetActualsTool } from './tools/fetch_owned_asset_actuals';
import { fetchOwnedAssetOpexRatiosTool } from './tools/fetch_owned_asset_opex_ratios';
import { fetchJurisdictionTaxForecastTool } from './tools/fetch_jurisdiction_tax_forecast';
import { fetchJurisdictionInsuranceForecastTool } from './tools/fetch_jurisdiction_insurance_forecast';
import { fetchPeerCompNOIMetricsTool } from './tools/fetch_peer_comp_noi_metrics';
import { fetchM35EventForecastTool } from './tools/fetch_m35_event_forecast';
import { detectCollisionTool } from './tools/detect_collision';
import { writeUnderwritingTool } from './tools/write_underwriting';
import { requestWalkthroughNarrativeTool } from './tools/request_walkthrough_narrative';

// ── Evidence-system output schema (v4) ──────────────────────────
//
// Extends the legacy proforma fields with optional evidence-map,
// collision-summary, and per-field underwriting tier metadata
// so the runtime's outputSchema.parse() accepts evidence-style outputs.

const CollisionSummarySchema = z.object({
  total_collisions: z.number().int().nonnegative(),
  severe: z.number().int().nonnegative(),
  material: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  fields_with_collision: z.array(z.string()),
}).optional();

const EvidenceSummaryEntrySchema = z.object({
  primary_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  confidence: z.enum(['high', 'medium', 'low']),
  source_count: z.number().int().nonnegative(),
  has_collision: z.boolean(),
}).optional();

export const CashflowOutputSchema = z.object({
  // ── Core proforma metrics ─────────────────────────────────────
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
  // ── Evidence-system fields (optional, populated when write_underwriting ran) ──
  /** Map of field_path → evidence summary for the F9 evidence panel. */
  evidence_map: z.record(z.string(), EvidenceSummaryEntrySchema).optional(),
  /** High-level collision report (agent vs. broker OM). */
  collision_summary: CollisionSummarySchema,
  /** IDs of persisted underwriting_evidence rows from this run. */
  underwriting_evidence_ids: z.array(z.string()).optional(),
  /** ID of the deal_underwriting_snapshots row, if written. */
  snapshot_id: z.string().nullable().optional(),
});

export type CashflowAgentOutput = z.infer<typeof CashflowOutputSchema>;

// ── Deal type → prompt_type mapping ───────────────────────────────

export type CashflowDealType =
  | 'existing'
  | 'value-add'
  | 'lease-up'
  | 'development'
  | 'redevelopment';

export const CASHFLOW_DEAL_TYPE_TO_PROMPT_TYPE: Record<CashflowDealType, string> = {
  existing: 'variant:existing',
  'value-add': 'variant:value-add',
  'lease-up': 'variant:lease-up',
  development: 'variant:development',
  redevelopment: 'variant:redevelopment',
};

/** Resolve deal type from deal context fields and property data. */
export function resolveProjectType(dealRow: Record<string, unknown>): CashflowDealType {
  const raw = String(dealRow.project_type ?? dealRow.deal_type ?? dealRow.property_type ?? '').toLowerCase();
  if (raw.includes('redevelopment') || raw.includes('conversion')) return 'redevelopment';
  if (raw.includes('development') && !raw.includes('re')) return 'development';
  if (raw.includes('value') || raw.includes('rehab') || raw.includes('renovation')) return 'value-add';
  if (raw.includes('lease') || raw.includes('stabiliz') || raw.includes('delivery')) return 'lease-up';
  return 'existing';
}

/** Returns permitted trigger modes for a given user tier. */
export function getAllowedTriggerModes(tier: string): string[] {
  const t = tier.toLowerCase();
  if (t === 'scout') return ['manual'];
  if (t === 'operator') return ['manual', 'event-driven'];
  if (t === 'principal') return ['manual', 'event-driven', 'weekly-refresh'];
  if (t === 'institutional') return ['manual', 'event-driven', 'weekly-refresh', 'portfolio-batch'];
  return ['manual'];
}

// ── Composite prompt builder ──────────────────────────────────────

/**
 * Load and compose the core cashflow system prompt with the deal-type variant.
 * Queries prompt_versions by prompt_type (not by active=true alone) to avoid
 * ambiguity when multiple prompt_types are active simultaneously.
 * Returns the concatenated text — or the core-only text if no variant is found.
 *
 * Used by both cashflow.inngest.ts (event-driven runs) and
 * cashflow-underwriting.routes.ts (manual REST-triggered runs).
 */
export async function buildCompositePrompt(dealRow: Record<string, unknown>): Promise<string> {
  const dealType = resolveProjectType(dealRow);
  const variantType = CASHFLOW_DEAL_TYPE_TO_PROMPT_TYPE[dealType];

  const coreRow = await query(
    `SELECT system_prompt FROM prompt_versions
     WHERE agent_id = 'cashflow' AND prompt_type = 'core' AND active = true
     ORDER BY created_at DESC LIMIT 1`
  );
  const corePrompt: string =
    coreRow.rows[0]?.system_prompt ??
    'You are the CashFlow Agent for JEDI RE. Analyze real estate data and return structured JSON.';

  const variantRow = await query(
    `SELECT system_prompt FROM prompt_versions
     WHERE agent_id = 'cashflow' AND prompt_type = $1 AND active = true
     ORDER BY created_at DESC LIMIT 1`,
    [variantType]
  );
  const variantPrompt: string = variantRow.rows[0]?.system_prompt ?? '';

  return variantPrompt
    ? `${corePrompt}\n\n## Deal-Type Addendum (${dealType})\n${variantPrompt}`
    : corePrompt;
}

// ── Agent config ──────────────────────────────────────────────────

export const CASHFLOW_AGENT_CONFIG: AgentConfig = {
  agentId: 'cashflow',
  agentVersion: '3.0.0',
  promptVersion: 'cashflow-v4-evidence',
  tools: [
    fetchT12Tool,
    fetchRentRollTool,
    fetchAssumptionsTool,
    fetchOwnedAssetActualsTool,
    fetchOwnedAssetOpexRatiosTool,
    fetchPeerCompNOIMetricsTool,
    fetchJurisdictionTaxForecastTool,
    fetchJurisdictionInsuranceForecastTool,
    fetchM35EventForecastTool,
    detectCollisionTool,
    computeProformaTool,
    writeProjectionTool,
    writeUnderwritingTool,
    requestWalkthroughNarrativeTool,
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
