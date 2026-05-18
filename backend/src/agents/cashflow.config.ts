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
import { DeepSeekMeteringAdapter } from './runtime/DeepSeekMeteringAdapter';
import { BudgetEnforcer } from './runtime/BudgetEnforcer';
import { DEFAULT_BUDGET_CAPS } from './config/budget';
import { query } from '../database/connection';
import type { AgentConfig } from './runtime/types';
import { cashflowPostProcess } from './cashflow.postprocess';
import { normalizeEvidence } from './utils/evidenceNormalizer';

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
import { writeEvidenceRowsTool } from './tools/write_evidence_rows';
import { requestWalkthroughNarrativeTool } from './tools/request_walkthrough_narrative';

import { fetchArchiveAssumptionDistributionTool } from './tools/fetch_archive_assumption_distribution';
import { fetchArchiveAchievementVsAssumptionTool } from './tools/fetch_archive_achievement_vs_assumption';
import { fetchLineItemBenchmarksTool } from './tools/fetch_line_item_benchmarks';
import { fetchMarketTrendsTool } from './tools/fetch_market_trends';
import { fetchLearningAdjustmentsTool } from './tools/fetch_learning_adjustments';
import { fetchDebtAssumptionsTool } from './tools/fetch_debt_assumptions';
import { runRefiTestTool } from './tools/run_refi_test';
import { fetchCompSetTool } from './tools/fetch_comp_set';
import { fetchDispositionLearningsTool } from './tools/fetch_disposition_learnings';
import { fetchDataMatrixTool } from './tools/fetch_data_matrix';
import { fetchProximityContextTool } from './tools/fetch_proximity_context';
import { fetchMarketEventsTool } from './tools/fetch_market_events';
import { fetchBacktestContextTool } from './tools/fetch_backtest_context';
import { fetchDataLibraryCompsTool } from './tools/fetch_data_library_comps';
import { fetchTaxIntelTool } from './tools/fetch_tax_intel';
import { evaluatePlausibilityTool } from './tools/evaluate_plausibility';
import { goalSeekTargetIrrTool } from './tools/goal_seek_target_irr';
import { optimizeCapitalStructureTool } from './tools/optimize_capital_structure';
import { fetchAnchorGrowthRatesTool } from './tools/fetch_anchor_growth_rates';
import { fetchCountyTaxRulesTool } from './tools/fetch_county_tax_rules';
import { fetchOperatorStanceTool } from './tools/fetch_operator_stance';
import { fetchUnitMixTool } from './tools/fetch_unit_mix';
import { generateRoadmapTool } from './tools/generate_roadmap';

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

/**
 * Canonical evidence shape produced by evidenceNormalizer.ts.
 * This is the authoritative output schema for proforma_fields[*].evidence after
 * the post-processor normalizer runs. The legacy EvidenceSchema (above) is kept
 * for the write_evidence_rows tool input validation only.
 */
export const CanonicalEvidenceSchema = z.object({
  source_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  source_label: z.string(),
  source_doc_ref: z.string().nullable().optional(),
  source_doc_excerpt: z.string().nullable().optional(),
  data_points: z.array(z.object({
    key: z.string(),
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
  })).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  derivation_chain: z.array(z.string()).optional(),
  collision_with_broker: z.object({
    broker_value: z.number(),
    agent_value: z.number(),
    delta_pct: z.number(),
    severity: z.enum(['minor', 'material', 'major']),
    narrative: z.string(),
  }).nullable().optional(),
});

const ProformaFieldSchema = z.object({
  value: z.union([z.number(), z.string(), z.null()]),
  source: z.string(),
  // Defense-in-depth: z.preprocess coerces string/malformed evidence to
  // CanonicalEvidence at Zod parse time. cashflowPostProcess also runs
  // normalizeProformaFields before this parse() call, but if that step
  // is skipped (DB failure, early-catch, etc.) this preprocess guarantees
  // the schema never rejects on a string evidence field.
  evidence: z.preprocess(
    (val) => {
      try {
        return normalizeEvidence(val as Parameters<typeof normalizeEvidence>[0], 'schema_preprocess', null).evidence;
      } catch {
        return val;
      }
    },
    CanonicalEvidenceSchema,
  ),
  archive_percentile: z.number().min(0).max(100).nullable().optional().describe(
    'Where this assumption falls in the archive distribution (0=P10, 50=P50, 100=P90). Null if < 5 samples.'
  ),
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
  // ── Capital Structure Optimization result (from optimize_capital_structure tool) ──
  // Persisted as proforma.capital_structure.optimization in agent_runs.output.
  proforma: z.object({
    capital_structure: z.object({
      optimization: z.object({
        primary_metric: z.enum(['irr', 'cash_on_cash', 'stabilized_value', 'profit_at_exit']),
        optimal_ltv: z.number().nullable(),
        optimal_debt_amount: z.number().nullable(),
        optimal_rate: z.number(),
        resulting_dscr_min: z.number().nullable(),
        resulting_breakeven_occ: z.number().nullable(),
        primary_metric_value: z.number().nullable(),
        evidence_narrative: z.string(),
        constraints_binding: z.array(z.string()),
        confidence: z.enum(['high', 'medium', 'low']),
        infeasible: z.boolean(),
        infeasibility_reason: z.string().nullable(),
        equity_at_optimal: z.number().nullable(),
        gp_equity: z.number().nullable(),
        lp_equity: z.number().nullable(),
      }).optional(),
    }).optional(),
  }).optional().describe('Structured proforma outputs including capital structure optimization'),
  // ── Optional run metadata (inngest handler + backward compat) ──
  investment_rating: z.enum(['strong', 'adequate', 'marginal', 'weak']).nullable().optional(),
  has_t12_data: z.boolean().optional(),
  has_rent_roll: z.boolean().optional(),
  fields_written: z.array(z.string()).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  snapshot_id: z.string().nullable().optional(),
  // ── Evidence normalizer telemetry ──
  evidence_normalization_summary: z.object({
    total_fields: z.number(),
    fields_repaired: z.number(),
    fields_clean: z.number(),
    repair_breakdown: z.record(z.string(), z.number()),
    repaired_field_paths: z.array(z.string()),
  }).optional(),
  // ── Value-add GPR diagnostics (written by postprocessor; optional — non-value-add runs omit these) ──
  value_add_gpr_validation: z.object({
    is_value_add_context: z.boolean(),
    floor_plans_found: z.array(z.string()),
    missing_slots: z.array(z.object({
      floor_plan_id: z.string(),
      missing: z.array(z.string()),
      note: z.string().optional(),
    })),
    complete: z.boolean(),
    dual_comp_set: z.object({
      baseline_called: z.boolean(),
      renovation_ceiling_called: z.boolean(),
      compliant: z.boolean(),
      missing_roles: z.array(z.string()),
    }).optional(),
    confidence_rationale_gaps: z.array(z.string()).optional(),
  }).optional(),
  value_add_gpr_capture_rate_collision: z.object({
    floor_plan_count: z.number().int(),
    track_record_recommended_capture_rate: z.number(),
    threshold: z.number(),
    note: z.string(),
  }).optional(),
  value_add_gpr_assertion_inconsistencies: z.array(z.object({
    floor_plan_id: z.string(),
    agent_post_reno_target_rent: z.number(),
    comp_ceiling_at_percentile: z.number(),
    deviation_pct: z.number(),
    note: z.string(),
  })).optional(),
  value_add_gpr_confidence_rationale_gaps: z.array(z.string()).optional(),
  // ── Role-aware summary framing (Task #878) ──
  // Describes the analysis from the perspective of the requesting user's platform role.
  // Sponsor: full deal context. LP: return-focused, pref coverage, distribution schedule.
  // Lender: DSCR, LTV, debt service coverage, exit-cap stress.
  role_framing: z.object({
    sponsor: z.string().describe('Sponsor/GP-oriented 1-2 sentence synthesis'),
    lp: z.string().describe('LP-oriented 1-2 sentence synthesis focusing on preferred return and IRR'),
    lender: z.string().describe('Lender-oriented 1-2 sentence synthesis focusing on DSCR and LTV coverage'),
  }).optional(),
  // ── Pro Forma Math Engine v1.1 correction report ──
  math_correction_report: z.object({
    passed: z.boolean(),
    was_corrected: z.boolean(),
    summary: z.object({
      total_critical: z.number().int().nonnegative(),
      total_major: z.number().int().nonnegative(),
      total_minor: z.number().int().nonnegative(),
      breakdown_aggregate_mismatches: z.number().int().nonnegative(),
    }),
    // Per-path hierarchical resolution details (source priority decision + reconciliation status).
    // Consumed by Task #805 Other Income Reconciliation Badge UI.
    hierarchical_resolutions: z.record(z.string(), z.object({
      resolved_value: z.number(),
      resolution_source: z.string(),
      resolution_method: z.enum(['breakdown_sum', 'aggregate', 'fallback']),
      breakdown_sum: z.number().optional(),
      aggregate_value: z.number().optional(),
      reconciliation_delta: z.number().optional(),
      reconciliation_delta_pct: z.number().optional(),
      reconciliation_status: z.enum(['no_conflict', 'within_tolerance', 'minor_mismatch', 'major_mismatch']),
    })).optional(),
  }).optional(),
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
  const category  = String(dealRow.deal_category ?? '').toLowerCase();
  const raw       = String(dealRow.project_type ?? dealRow.deal_type ?? dealRow.property_type ?? '').toLowerCase();
  const thesis    = String(dealRow.investment_thesis ?? '').toLowerCase();
  const combined  = `${raw} ${category} ${thesis}`;

  if (combined.includes('redevelopment') || combined.includes('conversion')) return 'redevelopment';
  if (combined.includes('development') && !combined.includes('re')) return 'development';
  if (combined.includes('value') || combined.includes('rehab') || combined.includes('renovation')) return 'value-add';
  if (combined.includes('lease') || combined.includes('stabiliz') || combined.includes('delivery')) return 'lease-up';

  // Heuristic: recently built deals in the pipeline are typically lease-up acquisitions.
  // "Pipeline" is the pre-acquisition category; if the property is ≤8 years old it is
  // almost certainly still in its lease-up absorption window.
  if (category === 'pipeline') {
    const yearBuilt   = Number(dealRow.year_built ?? 0);
    const currentYear = new Date().getFullYear();
    if (yearBuilt > 0 && yearBuilt >= currentYear - 8) return 'lease-up';
  }

  return 'existing';
}

/** Returns permitted trigger modes for a given user tier. */
export function getAllowedTriggerModes(tier: string): string[] {
  const t = tier.toLowerCase();
  if (t === 'scout') return ['manual'];
  if (t === 'basic') return ['manual', 'event-driven'];  // Allow basic tier for dev/testing
  if (t === 'operator') return ['manual', 'event-driven'];
  if (t === 'professional') return ['manual', 'event-driven'];
  if (t === 'enterprise') return ['manual', 'event-driven', 'weekly-refresh'];
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
export async function buildCompositePrompt(
  dealRow: Record<string, unknown>,
  dealId?: string
): Promise<string> {
  // Augment dealRow with deal_category, year_built, and investment_thesis when not
  // already present.  Both call sites (inngest + REST route) may only pass a subset
  // of fields, so we self-heal by fetching the missing ones from the DB.
  const effectiveId = dealId ?? String(dealRow.deal_id ?? dealRow.id ?? '');
  let enriched = { ...dealRow };
  if (effectiveId && !dealRow.deal_category) {
    try {
      const r = await query(
        `SELECT d.deal_category,
                COALESCE(
                  p.year_built,
                  NULLIF(d.deal_data->'broker_claims'->'property'->>'yearBuilt','')::int,
                  NULLIF(d.deal_data->'broker_claims'->'property'->>'year_built','')::int
                ) AS year_built,
                d.deal_data->'broker_claims'->>'investmentThesis' AS investment_thesis
         FROM deals d
         LEFT JOIN properties p ON p.deal_id = d.id
         WHERE d.id = $1
         LIMIT 1`,
        [effectiveId]
      );
      if (r.rows[0]) enriched = { ...enriched, ...r.rows[0] };
    } catch (_) { /* non-fatal — classification falls back to 'existing' */ }
  }

  const dealType = resolveProjectType(enriched);
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

  const capitalStructureInstruction = `

## Capital Structure Optimization (Required Step)

After calling compute_proforma and establishing noi_year1 and purchase_price, you MUST call
optimize_capital_structure. This is not optional — every cashflow agent run must include a
capital structure optimization pass.

Parameters to pass:
- noi_year1: stabilized Year-1 NOI from compute_proforma result (annual $)
- purchase_price: deal purchase price from assumptions
- hold_years: deal hold period in years (default 5)
- exit_cap_rate: exit cap rate (from deal data or platform default 0.055)
- debt_rate: current interest rate from deal assumptions or _capital_structure_defaults.debt_rate
- amortization_years: amortization schedule (default 30)
- io_period_months: IO period (default 0)
- noi_growth_rate: projected NOI growth rate (default 0.03)
- deal_strategy: the deal's investment strategy exactly as classified (e.g., "value-add", "stabilized", "development", "flip", "lease-up", "redevelopment")
- gpr_year1: Gross Potential Rent Year-1 from compute_proforma (for break-even occupancy)
- selling_costs_pct: deal selling costs pct (default 0.02)

Strategy → primary metric mapping is deterministic (the tool handles this automatically):
  value-add, redevelopment, redevelopment_full → Levered IRR
  existing, stabilized, redevelopment_partial   → Year-1 Cash-on-Cash
  lease-up, development                         → Stabilized Value
  flip                                          → Profit at Exit

Include the full optimize_capital_structure output in your response nested as:
  proforma.capital_structure.optimization
(i.e., the top-level "proforma" key, then "capital_structure", then "optimization")
`;

  const combined = variantPrompt
    ? `${corePrompt}\n\n## Deal-Type Addendum (${dealType})\n${variantPrompt}`
    : corePrompt;

  return `${combined}${capitalStructureInstruction}`;
}

// ── Agent config ──────────────────────────────────────────────────

export const CASHFLOW_AGENT_CONFIG: AgentConfig = {
  agentId: 'cashflow',
  agentVersion: '3.4.0',
  promptVersion: 'cashflow-v8.1-capital-structure',
  postProcess: cashflowPostProcess,
  tools: [
    // Tier 1: Deal documents
    fetchT12Tool,
    fetchRentRollTool,
    // Canonical floor-plan-level source — includes sponsor overrides from Unit Mix tab
    fetchUnitMixTool,
    fetchAssumptionsTool,
    // Tier 2: Portfolio actuals
    fetchOwnedAssetActualsTool,
    fetchOwnedAssetOpexRatiosTool,
    // Tier 3: Platform intelligence
    // For value-add GPR, call fetchPeerCompNOIMetrics TWICE:
    //   call 1 — comp_role: 'baseline'           (current-state comps → current market rent)
    //   call 2 — comp_role: 'renovation_ceiling' (newer/renovated comps → post-reno rent ceiling)
    // See system.ts "GPR Investigation — Value-Add Deals" section for full protocol.
    fetchPeerCompNOIMetricsTool,
    fetchJurisdictionTaxForecastTool,
    fetchJurisdictionInsuranceForecastTool,
    fetchM35EventForecastTool,
    // Archive & benchmarks
    fetchArchiveAssumptionDistributionTool,
    fetchArchiveAchievementVsAssumptionTool,
    fetchLineItemBenchmarksTool,
    fetchMarketTrendsTool,
    // Self-learning
    fetchLearningAdjustmentsTool,
    // Lifecycle tools (debt, comps, exits)
    fetchDebtAssumptionsTool,
    runRefiTestTool,
    fetchCompSetTool,
    fetchDispositionLearningsTool,
    // Primary context assembler — all 9 data layers in one call
    fetchDataMatrixTool,
    // Individual spatial tools — kept for single-layer edge cases
    fetchProximityContextTool,
    fetchMarketEventsTool,
    fetchBacktestContextTool,
    fetchDataLibraryCompsTool,  // Data Library comps for market rent, expenses, cap rates
    fetchTaxIntelTool,          // Property tax math (millage, transfer tax, reassessment)
    // M36 Sigma (plausibility + goal-seeking)
    evaluatePlausibilityTool,
    goalSeekTargetIrrTool,
    // Capital Structure Optimization — call after compute_proforma
    optimizeCapitalStructureTool,
    // M36 Proforma Anchor Growth Rates (line-item macro anchoring)
    fetchAnchorGrowthRatesTool,
    fetchCountyTaxRulesTool,
    // OperatorStance — meta-layer modulating agent discretion (call after fetch_data_matrix)
    fetchOperatorStanceTool,
    // read_gmail_thread is intentionally NOT registered here — it belongs to the deal-intake
    // pipeline (email-intake.function.ts / Inngest), not the underwriting agent. Registering
    // it in the cashflow config would expose Gmail credentials to an unintended call surface.
    // Analysis & output
    detectCollisionTool,
    computeProformaTool,
    writeProjectionTool,
    writeEvidenceRowsTool,
    writeUnderwritingTool,
    requestWalkthroughNarrativeTool,
    // Roadmap Mode — value-creation action plan (call after context tools)
    generateRoadmapTool,
  ],
  outputSchema: CashflowOutputSchema,
  budgetCaps: DEFAULT_BUDGET_CAPS.cashflow,
  modelName: 'deepseek-chat',
  firstToolCall: 'fetch_data_matrix',  // Force first step to fetch deal context
  capabilities: ['read:all', 'write:deal_context'],
};

// ── Singleton runtime ─────────────────────────────────────────────

export const cashflowRuntime = new AgentRuntime(
  CASHFLOW_AGENT_CONFIG,
  new DeepSeekMeteringAdapter(),
  new BudgetEnforcer()
);
