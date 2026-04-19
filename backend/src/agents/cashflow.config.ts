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

// ── Evidence-system output schema (v4) ───────────────────────────
//
// Matches CASHFLOW_OUTPUT_SCHEMA (prompts/cashflow/output-schema.ts) exactly,
// so AgentRuntime.outputSchema.parse() accepts evidence-style JSON without errors.
// Optional legacy fields (investment_rating, has_t12_data, etc.) allow the
// inngest handler to extract run metadata without breaking the contract.

const DataPointSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  weight: z.number().min(0).max(1),
  notes: z.string().optional(),
});

const AlternativeSchema = z.object({
  source: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.union([z.number(), z.null()]).optional(),
  reason_rejected: z.string(),
});

const FieldCollisionSchema = z.object({
  field_path: z.string(),
  agent_value: z.union([z.number(), z.string(), z.null()]),
  broker_value: z.union([z.number(), z.string(), z.null()]),
  delta_pct: z.union([z.number(), z.null()]),
  magnitude: z.enum(['minor', 'material', 'severe']),
  direction: z.enum(['agent_higher', 'agent_lower', 'equal']),
  narrative: z.string(),
}).nullable().optional();

const EvidenceSchema = z.object({
  field_path: z.string(),
  primary_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
  data_points: z.array(DataPointSchema),
  alternatives: z.array(AlternativeSchema),
  collision: FieldCollisionSchema,
});

const ProformaFieldSchema = z.object({
  value: z.union([z.number(), z.string(), z.null()]),
  source: z.string(),
  evidence: EvidenceSchema,
});

export const CashflowOutputSchema = z.object({
  // ── Primary evidence structure (matches CASHFLOW_OUTPUT_SCHEMA prompt JSON) ─
  proforma_fields: z.record(z.string(), ProformaFieldSchema)
    .describe('Map of field_path → UnderwritingOutputField with full evidence chain'),
  collision_summary: z.object({
    minor_count: z.number().int().nonnegative(),
    material_count: z.number().int().nonnegative(),
    severe_count: z.number().int().nonnegative(),
  }),
  confidence_distribution: z.object({
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  }),
  tier_distribution: z.object({
    tier1: z.number().int().nonnegative(),
    tier2: z.number().int().nonnegative(),
    tier3: z.number().int().nonnegative(),
    tier4: z.number().int().nonnegative(),
  }),
  summary: z.string().describe('3-5 sentence synthesis of key findings'),
  completed_at: z.string(),
  // ── Optional run metadata (inngest handler + backward compat) ──
  investment_rating: z.enum(['strong', 'adequate', 'marginal', 'weak']).nullable().optional(),
  has_t12_data: z.boolean().optional(),
  has_rent_roll: z.boolean().optional(),
  fields_written: z.array(z.string()).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
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
