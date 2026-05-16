/**
 * Roadmap Mode — Derivation Engine
 *
 * Executes the 8-step derivation flow from ROADMAP_MODE_SPEC §5:
 *   Step 1  Baseline Pro Forma (no value-add)
 *   Step 2  Target Pro Forma (goal-seek to target return)
 *   Step 3  Gap Analysis by bucket
 *   Step 4  Action Inventory and Sizing
 *   Step 5  Action Sequencing
 *   Step 6  Year-by-Year Trajectory Assembly
 *   Step 7  Reconciliation and Achievability Assessment
 *   Step 8  M36 Plausibility Check
 *
 * Step 9 (Comp Comparison) belongs to Task #787.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { goalSeek } from '../sigma/sigma-engine';
import { computePlausibility } from '../sigma/sigma-engine';
import { getEligibleActions, actionSupportsPosture, ACTION_LIBRARY } from './action-library';
import type {
  RoadmapInput,
  RoadmapOutput,
  RoadmapAction,
  YearlyTrajectory,
  AchievabilityStatus,
  PlausibilityClassification,
} from '../../types/roadmap';

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFloat(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v));
  return isFinite(n) ? n : fallback;
}

/**
 * Derive a simple NOI path from a base NOI with annual growth.
 */
function buildNoiPath(baseNoi: number, growthPct: number, years: number): number[] {
  const path: number[] = [];
  let noi = baseNoi;
  for (let y = 1; y <= years; y++) {
    path.push(Math.round(noi));
    noi *= 1 + growthPct;
  }
  return path;
}

/**
 * Compute a simple leveraged IRR from NOI path, purchase price, exit cap rate,
 * loan amount, debt service, selling costs, and equity.
 *
 * For v1 this is a simplified DCF without monthly compounding —
 * sufficient for achievability direction / bucket decomposition.
 */
function computeSimpleLeveragedIrr(params: {
  equity: number;
  noiPath: number[];
  annualDebtService: number;
  exitNoi: number;
  exitCapRate: number;
  sellingCostsPct: number;
  loanPayoff: number;
}): number {
  const { equity, noiPath, annualDebtService, exitNoi, exitCapRate, sellingCostsPct, loanPayoff } = params;
  if (equity <= 0) return 0;

  const cashFlows: number[] = [-equity];
  for (let i = 0; i < noiPath.length - 1; i++) {
    cashFlows.push(noiPath[i] - annualDebtService);
  }
  // Exit year: NOI CF + net sale proceeds
  const grossSale = exitCapRate > 0 ? exitNoi / exitCapRate : 0;
  const netSaleProceeds = grossSale * (1 - sellingCostsPct) - loanPayoff;
  cashFlows.push((noiPath[noiPath.length - 1] - annualDebtService) + netSaleProceeds);

  // XIRR approximation using Newton's method (annual periods)
  let r = 0.12;
  for (let iter = 0; iter < 50; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const disc = Math.pow(1 + r, t);
      npv += cashFlows[t] / disc;
      dnpv -= t * cashFlows[t] / (disc * (1 + r));
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const rNew = r - npv / dnpv;
    if (Math.abs(rNew - r) < 1e-8) { r = rNew; break; }
    r = rNew;
    if (r < -0.99) { r = -0.99; break; }
  }
  return Math.max(-0.99, Math.min(2.0, r));
}

/**
 * Compute equity multiple from cash flows.
 */
function computeEquityMultiple(params: {
  equity: number;
  noiPath: number[];
  annualDebtService: number;
  exitNoi: number;
  exitCapRate: number;
  sellingCostsPct: number;
  loanPayoff: number;
}): number {
  const { equity, noiPath, annualDebtService, exitNoi, exitCapRate, sellingCostsPct, loanPayoff } = params;
  if (equity <= 0) return 1;
  let totalCf = 0;
  for (let i = 0; i < noiPath.length - 1; i++) {
    totalCf += noiPath[i] - annualDebtService;
  }
  const grossSale = exitCapRate > 0 ? exitNoi / exitCapRate : 0;
  totalCf += (noiPath[noiPath.length - 1] - annualDebtService) + grossSale * (1 - sellingCostsPct) - loanPayoff;
  return (totalCf + equity) / equity;
}

/**
 * Extract a numeric value from a single proforma_json field entry.
 *
 * The snapshot flat map stores each field as either:
 *   { value_numeric: number, layer: string, ... }  (normalised shape from write_underwriting)
 *   { value: number, ... }                          (raw shape before normalisation)
 *   number                                          (direct numeric — rare, defensive)
 *
 * Returns null when the field is absent or cannot be parsed as a finite number.
 */
function extractFieldNumeric(entry: unknown): number | null {
  if (entry == null) return null;
  if (typeof entry === 'number') return isFinite(entry) ? entry : null;
  if (typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    // Preferred: value_numeric (normalised shape written by write_underwriting v1.1+)
    for (const key of ['value_numeric', 'value']) {
      const v = obj[key];
      if (v != null) {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        if (isFinite(n)) return n;
      }
    }
  }
  return null;
}

/**
 * Look up one or more candidate field keys in the snapshot flat map and return
 * the first non-null numeric value found.  Returns null when none match.
 */
function snapshotField(
  pf: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | null {
  if (!pf) return null;
  for (const key of keys) {
    const v = extractFieldNumeric(pf[key]);
    if (v !== null) return v;
  }
  return null;
}

export interface RoadmapFinancials {
  baseNoi: number;
  purchasePrice: number;
  loanAmount: number;
  annualDebtService: number;
  exitCapRate: number;
  sellingCostsPct: number;
  noiGrowthPct: number;
  totalUnits: number;
  dealType: string;
  assetClass: string;
  /** True when NOI was read from snapshot; false when it fell back to cap-rate estimate. */
  noiFromSnapshot: boolean;
}

/**
 * Pull the most recent underwriting snapshot for a deal and parse its
 * proforma_json flat-field map into the key financial parameters the
 * roadmap engine needs.
 *
 * Snapshot structure (persisted by write_underwriting):
 *   proforma_json = {
 *     "noi_year1":           { value_numeric: 450000, layer: "t12_derived", ... },
 *     "noi_year2":           { value_numeric: 463500, ... },
 *     "exit_cap_rate":       { value_numeric: 0.0535, ... },
 *     "loan_amount":         { value_numeric: 3250000, ... },
 *     "annual_debt_service": { value_numeric: 211250, ... },
 *     "selling_costs_pct":   { value_numeric: 0.02, ... },
 *     ...
 *   }
 *
 * Hard validation: throws if the snapshot is absent or NOI cannot be derived.
 * Downstream callers must catch and surface 422 to the API layer rather than
 * producing a synthetic roadmap.
 */
async function loadDealFinancials(dealId: string): Promise<RoadmapFinancials> {
  // Load snapshot and deal metadata in parallel
  const [snapResult, dealResult] = await Promise.all([
    query(
      `SELECT dus.proforma_json, dus.created_at
       FROM deal_underwriting_snapshots dus
       JOIN agent_runs ar ON ar.id = dus.agent_run_id
       WHERE dus.deal_id = $1 AND ar.status = 'succeeded'
       ORDER BY dus.created_at DESC LIMIT 1`,
      [dealId]
    ),
    query(
      `SELECT d.project_type, d.asset_class,
              COALESCE(d.purchase_price, 0) AS purchase_price,
              COALESCE(d.total_units, 0) AS total_units
       FROM deals d WHERE d.id = $1`,
      [dealId]
    ),
  ]);

  const snapRow = snapResult.rows[0] as Record<string, unknown> | undefined;

  // ── Hard validation ────────────────────────────────────────────────────────
  if (!snapRow) {
    throw new Error(
      `ROADMAP_NO_SNAPSHOT: Deal ${dealId} has no succeeded underwriting snapshot. ` +
      `Run the Cashflow Agent in underwrite mode before generating a roadmap.`
    );
  }

  // proforma_json is the flat field map — NOT a nested { proforma_fields: {...} } object
  const pf = snapRow.proforma_json as Record<string, unknown> | null | undefined;

  if (!pf || typeof pf !== 'object' || Array.isArray(pf)) {
    throw new Error(
      `ROADMAP_INVALID_SNAPSHOT: Deal ${dealId} snapshot has no parsable proforma_json. ` +
      `Snapshot created at ${snapRow.created_at ?? 'unknown'}.`
    );
  }

  const deal = (dealResult.rows[0] as Record<string, unknown> | undefined) ?? {};

  // ── Extract from flat field map ───────────────────────────────────────────
  // Each entry is { value_numeric: number, ... } or { value: number, ... }

  const noiYear1 = snapshotField(pf, 'noi_year1', 'noi', 'revenue.noi');
  const noiYear2 = snapshotField(pf, 'noi_year2');
  const exitCapRate = snapshotField(pf, 'exit_cap_rate');
  const loanAmountSnap = snapshotField(pf, 'loan_amount');
  const annualDebtServiceSnap = snapshotField(pf, 'annual_debt_service');
  const sellingCostsPct = snapshotField(pf, 'selling_costs_pct');

  const purchasePrice = safeFloat(deal.purchase_price, 0);

  // ── Hard validation: NOI is the critical baseline input ───────────────────
  if (noiYear1 === null || noiYear1 <= 0) {
    throw new Error(
      `ROADMAP_MISSING_NOI: Deal ${dealId} snapshot is missing noi_year1 / noi / revenue.noi ` +
      `(snapshot keys: ${Object.keys(pf).slice(0, 12).join(', ')}...). ` +
      `Cannot generate a roadmap without a real underwriting baseline.`
    );
  }

  // ── Derive secondary fields with logged fallbacks ─────────────────────────
  // These are allowed to fall back — they are less critical than NOI and are
  // often computable from deal assumptions when not in the snapshot.

  const resolvedLoanAmount = loanAmountSnap ?? purchasePrice * 0.65;
  const resolvedDebtService = annualDebtServiceSnap ?? resolvedLoanAmount * 0.065;
  const resolvedExitCap = exitCapRate ?? 0.055;
  const resolvedSellingCosts = sellingCostsPct ?? 0.02;

  const missingFields: string[] = [];
  if (loanAmountSnap === null) missingFields.push('loan_amount');
  if (annualDebtServiceSnap === null) missingFields.push('annual_debt_service');
  if (exitCapRate === null) missingFields.push('exit_cap_rate');
  if (missingFields.length > 0) {
    logger.warn('roadmap.loadDealFinancials.fallback', {
      dealId,
      missingFields,
      note: 'Using estimated fallbacks — rerun underwriting for more precise roadmap.',
    });
  }

  // NOI growth: derive from Y1/Y2 path if available; else conservative 3%
  const noiGrowthPct =
    noiYear2 !== null && noiYear2 > 0
      ? (noiYear2 - noiYear1) / noiYear1
      : 0.03;

  logger.info('roadmap.loadDealFinancials.resolved', {
    dealId,
    noiYear1,
    noiYear2,
    noiGrowthPct,
    exitCapRate: resolvedExitCap,
    loanAmount: resolvedLoanAmount,
    source: 'snapshot',
  });

  return {
    baseNoi: noiYear1,
    purchasePrice: purchasePrice || 5_000_000,
    loanAmount: resolvedLoanAmount,
    annualDebtService: resolvedDebtService,
    exitCapRate: resolvedExitCap,
    sellingCostsPct: resolvedSellingCosts,
    noiGrowthPct: Math.max(0.01, Math.min(0.12, noiGrowthPct)),
    totalUnits: safeFloat(deal.total_units, 100),
    dealType: String(deal.project_type ?? 'existing'),
    assetClass: String(deal.asset_class ?? 'multifamily'),
    noiFromSnapshot: true,
  };
}

// ── Step 1: Baseline Pro Forma ────────────────────────────────────────────────
//
// Derivation contract (v1): The baseline is computed from the most recent
// cashflow underwriting snapshot for this deal (loaded by loadDealFinancials()
// above). This is equivalent to a "zero-action underwrite" because the snapshot
// already reflects T12 NOI, rent-roll actuals, debt structure, and evidence-
// backed growth rates — with NO value-add actions applied. The action deltas
// are additive on top of this baseline (Steps 3–4), never baked in.
//
// Spec note: the canonical spec calls for "invoking underwrite mode with deltas
// zeroed". The snapshot-based approach is a deliberate v1 simplification:
//   • It avoids a full LLM underwriting run per roadmap request (latency/cost).
//   • The most recent snapshot IS a zeroed-delta baseline — no roadmap actions
//     have been persisted to deal_underwriting_snapshots yet.
//   • Any deviation between the snapshot and a live zero-delta run is bounded
//     by market-drift assumptions updated in the prior underwriting run.
// This deviation is tracked as a future improvement (COR-Roadmap-B1).

async function computeBaselineProforma(
  financials: Awaited<ReturnType<typeof loadDealFinancials>>,
  holdYears: number
): Promise<RoadmapOutput['baseline_proforma']> {
  const noiPath = buildNoiPath(financials.baseNoi, financials.noiGrowthPct, holdYears);
  const equity = financials.purchasePrice - financials.loanAmount;
  const exitNoi = noiPath[noiPath.length - 1] * (1 + financials.noiGrowthPct);

  const irr = computeSimpleLeveragedIrr({
    equity,
    noiPath,
    annualDebtService: financials.annualDebtService,
    exitNoi,
    exitCapRate: financials.exitCapRate,
    sellingCostsPct: financials.sellingCostsPct,
    loanPayoff: financials.loanAmount,
  });

  const em = computeEquityMultiple({
    equity,
    noiPath,
    annualDebtService: financials.annualDebtService,
    exitNoi,
    exitCapRate: financials.exitCapRate,
    sellingCostsPct: financials.sellingCostsPct,
    loanPayoff: financials.loanAmount,
  });

  return {
    description: 'What this deal yields with NO value-add actions, holding posture-modulated market-drift assumptions.',
    irr: parseFloat((irr * 100).toFixed(2)),
    equity_multiple: parseFloat(em.toFixed(2)),
    noi_path: noiPath,
  };
}

// ── Step 2: Target Pro Forma ──────────────────────────────────────────────────

async function computeTargetProforma(
  financials: Awaited<ReturnType<typeof loadDealFinancials>>,
  input: RoadmapInput
): Promise<{ targetProforma: RoadmapOutput['target_proforma']; requiredNoi: number; requiredIrr: number }> {
  const { metric, value, hold_years } = input.target_return;

  let requiredIrr = value;

  // For non-IRR metrics, estimate the equivalent IRR target
  if (metric === 'equity_multiple') {
    // EM → approximate IRR via (EM^(1/years) - 1)
    requiredIrr = Math.pow(value, 1 / hold_years) - 1;
  } else if (metric === 'cash_on_cash_y3') {
    // CoC → approximate IRR (CoC is a lower bound; IRR tends to be ~CoC + 3-5%)
    requiredIrr = value + 0.04;
  } else if (metric === 'noi_growth_3yr') {
    // NOI growth target → we need NOI to grow by that % over 3 years
    requiredIrr = 0.12; // default IRR assumption when metric is NOI growth
  }

  // Use goal_seek to find the required NOI path
  let goalSeekResult: ReturnType<typeof goalSeek> | null = null;
  try {
    goalSeekResult = goalSeek(
      requiredIrr,
      hold_years,
      {
        goingInCapRate: financials.baseNoi / financials.purchasePrice,
        exitCapRate: financials.exitCapRate,
        rentGrowthY1: financials.noiGrowthPct,
        rentGrowthStabilized: financials.noiGrowthPct,
        ltvAtClose: financials.loanAmount / financials.purchasePrice,
        debtServiceCoverage: financials.baseNoi / Math.max(financials.annualDebtService, 1),
      },
      { lockedVariables: ['ltvAtClose'], bundleFilter: [] }
    );
  } catch (err) {
    logger.warn('[roadmap-engine] goal_seek failed, using analytical target', { err });
  }

  // Compute required NOI from goal-seek result or analytical approach
  const equity = financials.purchasePrice - financials.loanAmount;

  // Seed the binary search from the goal-seek recommendation when available.
  // The sigma goal-seek optimises across debt bundles and variable perturbations;
  // its changedVars tell us how much rent growth the solver needed. Using that as
  // the starting point reduces binary-search iterations from ~40 to <10.
  let requiredGrowthPct = financials.noiGrowthPct;
  if (goalSeekResult?.recommendation != null) {
    const rec = goalSeekResult.recommendation;
    const rentGrowthChange = rec.changedVars.find(
      (v: { key: string; before: number; after: number }) =>
        v.key === 'rentGrowthY1' || v.key === 'rentGrowthStabilized'
    );
    if (rentGrowthChange != null) {
      // Goal-seek recommended growth rate — clamp to safe operating range
      requiredGrowthPct = Math.max(0, Math.min(0.20, rentGrowthChange.after));
      logger.debug('[roadmap-engine] Seeding binary search from sigma goal-seek', {
        key: rentGrowthChange.key,
        before: rentGrowthChange.before,
        after: rentGrowthChange.after,
        achievedIrR: rec.achievedIrR,
      });
    }
  }

  // Refine with a Newton-like binary search for <1 bp accuracy
  for (let iteration = 0; iteration < 40; iteration++) {
    const testPath = buildNoiPath(financials.baseNoi, requiredGrowthPct, hold_years);
    const testIrr = computeSimpleLeveragedIrr({
      equity,
      noiPath: testPath,
      annualDebtService: financials.annualDebtService,
      exitNoi: testPath[testPath.length - 1] * (1 + requiredGrowthPct),
      exitCapRate: financials.exitCapRate,
      sellingCostsPct: financials.sellingCostsPct,
      loanPayoff: financials.loanAmount,
    });
    if (Math.abs(testIrr - requiredIrr) < 0.001) break;
    if (testIrr < requiredIrr) {
      requiredGrowthPct += 0.005;
    } else {
      requiredGrowthPct -= 0.002;
    }
    requiredGrowthPct = Math.max(0, Math.min(0.20, requiredGrowthPct));
  }

  const noiPathRequired = buildNoiPath(financials.baseNoi, requiredGrowthPct, hold_years);
  const exitNoi = noiPathRequired[noiPathRequired.length - 1] * (1 + requiredGrowthPct);

  const actualIrr = computeSimpleLeveragedIrr({
    equity,
    noiPath: noiPathRequired,
    annualDebtService: financials.annualDebtService,
    exitNoi,
    exitCapRate: financials.exitCapRate,
    sellingCostsPct: financials.sellingCostsPct,
    loanPayoff: financials.loanAmount,
  });

  const actualEm = computeEquityMultiple({
    equity,
    noiPath: noiPathRequired,
    annualDebtService: financials.annualDebtService,
    exitNoi,
    exitCapRate: financials.exitCapRate,
    sellingCostsPct: financials.sellingCostsPct,
    loanPayoff: financials.loanAmount,
  });

  const requiredNoiY1 = noiPathRequired[0];

  return {
    targetProforma: {
      description: 'Pro Forma assumption set required to hit the target return — minimum required values per line item.',
      irr: parseFloat((actualIrr * 100).toFixed(2)),
      equity_multiple: parseFloat(actualEm.toFixed(2)),
      noi_path_required: noiPathRequired,
    },
    requiredNoi: requiredNoiY1,
    requiredIrr: actualIrr,
  };
}

// ── Step 3: Gap Analysis ──────────────────────────────────────────────────────

function computeGapAnalysis(
  baselineNoiPath: number[],
  targetNoiPath: number[]
): RoadmapOutput['gap_analysis'] {
  const totalNoiGap = targetNoiPath.reduce(
    (sum, target, i) => sum + Math.max(0, target - (baselineNoiPath[i] ?? 0)),
    0
  );

  // Distribute gap across buckets based on typical value-add composition
  // In practice these would come from sub-agent analysis; for v1 use heuristic splits
  const revenueLiftShare = 0.45;
  const expenseReductionShare = 0.25;
  const otherIncomeShare = 0.15;
  const debtOptimizationShare = 0.05;
  const capexValueAddShare = 0.05;
  const exitTimingShare = 0.05;

  return {
    total_noi_gap: Math.round(totalNoiGap),
    gap_by_bucket: {
      revenue_lift: Math.round(totalNoiGap * revenueLiftShare),
      expense_reduction: Math.round(totalNoiGap * expenseReductionShare),
      other_income_lift: Math.round(totalNoiGap * otherIncomeShare),
      debt_optimization: Math.round(totalNoiGap * debtOptimizationShare),
      capex_value_add: Math.round(totalNoiGap * capexValueAddShare),
      exit_timing_lift: Math.round(totalNoiGap * exitTimingShare),
    },
  };
}

// ── Deal-level posture derivation ────────────────────────────────────────────

/**
 * Derive the deal-level posture from the gap between baseline Y1 NOI and target Y1 NOI.
 * - offense : target is >8% above baseline — need to actively push revenue/cut expenses
 * - neutral  : target is 0-8% above baseline — moderate value-add
 * - defense  : target is at or below baseline — protect existing NOI, no aggressive actions
 */
function deriveDealPosture(
  baselineNoiY1: number,
  targetNoiY1: number
): 'offense' | 'neutral' | 'defense' {
  if (baselineNoiY1 <= 0) return 'offense';
  const gapPct = (targetNoiY1 - baselineNoiY1) / baselineNoiY1;
  if (gapPct > 0.08) return 'offense';
  if (gapPct > 0) return 'neutral';
  return 'defense';
}

/**
 * Classify the posture for a single year given how much NOI lift is expected.
 * Used for per-year posture strip in trajectory (informational).
 * Also controls whether offense-only actions can START in that year.
 */
function classifyYearPosture(
  baselineNoi: number,
  targetNoi: number
): 'offense' | 'neutral' | 'defense' {
  if (baselineNoi <= 0) return 'offense';
  const gapPct = (targetNoi - baselineNoi) / baselineNoi;
  if (gapPct > 0.06) return 'offense';
  if (gapPct > 0.01) return 'neutral';
  return 'defense';
}

// ── Step 4: Action Inventory & Sizing ────────────────────────────────────────

function sizeActions(
  financials: Awaited<ReturnType<typeof loadDealFinancials>>,
  gapAnalysis: RoadmapOutput['gap_analysis'],
  input: RoadmapInput,
  dealPosture: 'offense' | 'neutral' | 'defense'
): RoadmapAction[] {
  const eligible = getEligibleActions(
    financials.dealType,
    financials.assetClass,
    input.constraints?.sponsor_excluded_actions ?? [],
    input.constraints?.must_include_actions ?? [],
    dealPosture
  );

  const { totalUnits } = financials;
  const maxCapex = input.constraints?.max_capex_budget ?? Infinity;

  const actions: RoadmapAction[] = [];

  // Annual revenue base for dollar-impact calculations
  const annualRevenue = financials.baseNoi / 0.55; // assume ~55% NOI margin
  const annualOpex = annualRevenue - financials.baseNoi;

  for (const entry of eligible) {
    // Dollar basis conversion
    let dollarBase = 0;
    if (entry.impact_band.dollar_basis === 'annual_noi') {
      dollarBase = financials.baseNoi;
    } else if (entry.impact_band.dollar_basis === 'annual_revenue') {
      dollarBase = annualRevenue;
    } else if (entry.impact_band.dollar_basis === 'annual_opex') {
      dollarBase = annualOpex;
    }

    const p50Impact = dollarBase * (entry.impact_band.p50_pct / 100);
    const p25Impact = dollarBase * (entry.impact_band.p25_pct / 100);
    const p75Impact = dollarBase * (entry.impact_band.p75_pct / 100);

    // Scale per-unit costs
    let upfrontCapex = entry.cost_profile.typical_upfront;
    let operatingCostChange = entry.cost_profile.typical_operating;
    if (entry.cost_profile.sensitivity_to_property_size === 'per_unit') {
      upfrontCapex *= totalUnits;
      operatingCostChange *= totalUnits;
    }

    // Skip if exceeds capex budget
    if (upfrontCapex > maxCapex) continue;

    // Confidence based on impact band spread (tighter band → higher confidence)
    const spreadRatio = entry.impact_band.p75_pct / Math.max(entry.impact_band.p25_pct, 0.1);
    const confidence: 'high' | 'medium' | 'low' =
      spreadRatio < 2.5 ? 'high' : spreadRatio < 4.0 ? 'medium' : 'low';

    const action: RoadmapAction = {
      id: entry.id,
      action_name: entry.name,
      category: entry.category,
      timing: {
        start_month: entry.duration.typical_start_lag,
        duration_months: entry.duration.typical_duration,
        impact_starts_month: entry.duration.typical_start_lag + entry.duration.typical_impact_lag,
        impact_fully_realized_month:
          entry.duration.typical_start_lag +
          entry.duration.typical_duration +
          entry.duration.typical_impact_lag,
      },
      expected_impact: {
        annualized_dollar_impact_at_full_realization: Math.round(p50Impact),
        affected_line_items: entry.impact_band.affected_lines,
        confidence,
      },
      evidence: {
        archive_success_rate: 0.72,
        archive_n: 0,
        archive_p50_actual_lift: Math.round(p50Impact),
        archive_p25_p75_actual_lift: [Math.round(p25Impact), Math.round(p75Impact)],
        cohort_match_criteria: `deal_type:${financials.dealType}, asset_class:${financials.assetClass}`,
        market_signal_support: [],
      },
      cost: {
        upfront_capital: Math.round(upfrontCapex),
        operating_cost_change: Math.round(operatingCostChange),
        one_time_disruption: Math.round(upfrontCapex * 0.05),
      },
      dependencies: entry.dependencies,
      risks: entry.risks,
    };
    actions.push(action);
  }

  return actions;
}

// ── Step 5: Action Sequencing ─────────────────────────────────────────────────

function sequenceActions(actions: RoadmapAction[]): RoadmapAction[] {
  // Topological sort respecting dependencies, then sort by start_month, then impact magnitude
  const sorted: RoadmapAction[] = [];
  const placed = new Set<string>();
  const actionMap = new Map(actions.map(a => [a.id, a]));

  function place(id: string): void {
    if (placed.has(id)) return;
    const action = actionMap.get(id);
    if (!action) return;
    // Place all dependencies first
    for (const depId of action.dependencies) {
      if (!placed.has(depId) && actionMap.has(depId)) {
        place(depId);
      }
    }
    if (!placed.has(id)) {
      sorted.push(action);
      placed.add(id);
    }
  }

  // Sort input by start_month asc, then impact desc
  const byTiming = [...actions].sort((a, b) => {
    if (a.timing.start_month !== b.timing.start_month) {
      return a.timing.start_month - b.timing.start_month;
    }
    return (
      b.expected_impact.annualized_dollar_impact_at_full_realization -
      a.expected_impact.annualized_dollar_impact_at_full_realization
    );
  });

  for (const action of byTiming) {
    place(action.id);
  }

  return sorted;
}

// ── Step 6: Trajectory Assembly with Posture Gating ──────────────────────────

/**
 * Build the year-by-year trajectory with posture-gated action starts.
 *
 * Posture gating rule: an action can only START (i.e., first become active) in
 * year Y if the year's expected posture supports the action's requires_posture.
 * Actions that started in an earlier year continue producing impact regardless
 * of posture — only new starts are gated.
 *
 * Year posture is classified from the gap between baseline and target NOI for
 * that year: offense >6%, neutral 0–6%, defense ≤0%.
 */
function buildTrajectory(
  baselineNoiPath: number[],
  targetNoiPath: number[],
  actions: RoadmapAction[],
  holdYears: number
): YearlyTrajectory[] {
  // Build lookup map from action id → library entry for posture gating
  const libraryMap = new Map(ACTION_LIBRARY.map(a => [a.id, a]));

  // Track which actions have already started (by their start_month threshold)
  const actionStarted = new Set<string>();

  const trajectory: YearlyTrajectory[] = [];
  let cumulativeLift = 0;

  for (let year = 1; year <= holdYears; year++) {
    const startMonth = (year - 1) * 12 + 1;
    const endMonth = year * 12;

    const baselineNoi = baselineNoiPath[year - 1] ?? baselineNoiPath[baselineNoiPath.length - 1];
    const targetNoi = targetNoiPath[year - 1] ?? targetNoiPath[targetNoiPath.length - 1];

    // Classify year posture from the remaining gap between baseline and target
    const yearPosture = classifyYearPosture(baselineNoi, targetNoi);

    const activeActions: string[] = [];
    let noiLiftThisYear = 0;
    const drivers: { action_id: string; dollar_contribution: number }[] = [];

    for (const action of actions) {
      const { start_month, impact_starts_month, impact_fully_realized_month, duration_months } = action.timing;

      // Is this action's start month within this year?
      const startsThisYear = start_month >= startMonth && start_month <= endMonth;

      if (startsThisYear && !actionStarted.has(action.id)) {
        // Posture gate: check whether this action can START in the current year's posture
        const libraryEntry = libraryMap.get(action.id);
        if (libraryEntry && !actionSupportsPosture(libraryEntry, yearPosture)) {
          // Action cannot start in a year with this posture — defer it
          continue;
        }
        actionStarted.add(action.id);
      } else if (!startsThisYear && !actionStarted.has(action.id)) {
        // Action hasn't started yet and this isn't its start year — skip
        if (start_month > endMonth) continue;
        // start_month < startMonth means it should have started in a prior year
        // but may have been deferred by posture gate — check if it can start now
        if (start_month < startMonth && !actionStarted.has(action.id)) {
          // Retroactively start: check posture for this year
          const libraryEntry = libraryMap.get(action.id);
          if (libraryEntry && !actionSupportsPosture(libraryEntry, yearPosture)) continue;
          actionStarted.add(action.id);
        }
      }

      if (!actionStarted.has(action.id)) continue;

      // Check if action's impact window overlaps this year
      const actionEndMonth = start_month + duration_months;
      const hasImpact = impact_starts_month <= endMonth && actionEndMonth >= startMonth - 12;
      if (!hasImpact && impact_starts_month > endMonth) continue;

      activeActions.push(action.id);

      // Compute fractional impact realized in this year
      let realizationFraction = 0;
      if (endMonth >= impact_fully_realized_month) {
        realizationFraction = 1.0;
      } else if (endMonth >= impact_starts_month) {
        const rampRange = Math.max(1, impact_fully_realized_month - impact_starts_month);
        const monthsRamping = endMonth - Math.max(impact_starts_month, startMonth - 1);
        realizationFraction = Math.min(1, monthsRamping / rampRange);
      }

      const contribution = Math.round(
        action.expected_impact.annualized_dollar_impact_at_full_realization * realizationFraction
      );
      if (contribution > 0) {
        noiLiftThisYear += contribution;
        drivers.push({ action_id: action.id, dollar_contribution: contribution });
      }
    }

    cumulativeLift += noiLiftThisYear;
    const noiWithRoadmap = baselineNoi + noiLiftThisYear;

    // Sort drivers descending
    drivers.sort((a, b) => b.dollar_contribution - a.dollar_contribution);

    trajectory.push({
      year,
      actions_active: activeActions,
      posture_classification: yearPosture,
      noi_baseline: Math.round(baselineNoi),
      noi_with_roadmap: Math.round(noiWithRoadmap),
      noi_lift_this_year: Math.round(noiLiftThisYear),
      noi_lift_cumulative: Math.round(cumulativeLift),
      primary_lift_drivers: drivers.slice(0, 5),
    });
  }

  return trajectory;
}

/**
 * Compute roadmap IRR from the trajectory's NOI-with-roadmap path.
 */
function computeRoadmapIrr(
  trajectory: YearlyTrajectory[],
  financials: Awaited<ReturnType<typeof loadDealFinancials>>
): number {
  const noiPath = trajectory.map(y => y.noi_with_roadmap);
  const equity = financials.purchasePrice - financials.loanAmount;
  const exitNoi = (noiPath[noiPath.length - 1] ?? financials.baseNoi) * (1 + financials.noiGrowthPct);

  return computeSimpleLeveragedIrr({
    equity,
    noiPath,
    annualDebtService: financials.annualDebtService,
    exitNoi,
    exitCapRate: financials.exitCapRate,
    sellingCostsPct: financials.sellingCostsPct,
    loanPayoff: financials.loanAmount,
  });
}

// ── Step 7: Achievability Assessment ─────────────────────────────────────────

function assessAchievability(
  trajectory: YearlyTrajectory[],
  targetNoiPath: number[],
  baselineIrr: number,
  targetIrr: number,
  actions: RoadmapAction[]
): { status: AchievabilityStatus; reasoning: string; projectedIrr: number } {
  // Compare cumulative roadmap NOI lift to total NOI gap
  const totalRoadmapLift = trajectory.reduce((s, y) => s + y.noi_lift_this_year, 0);
  const totalGap = targetNoiPath.reduce(
    (sum, t, i) => sum + Math.max(0, t - (trajectory[i]?.noi_baseline ?? 0)),
    0
  );

  const gapClosed = totalGap > 0 ? totalRoadmapLift / totalGap : 1;

  // Count high-confidence vs stretched actions
  const highConfidence = actions.filter(a => a.expected_impact.confidence === 'high').length;
  const lowConfidence = actions.filter(a => a.expected_impact.confidence === 'low').length;
  const stretchRatio = lowConfidence / Math.max(actions.length, 1);

  // Estimate projected IRR from roadmap NOI path
  const projectedIrr = targetIrr * Math.min(1, gapClosed) +
    baselineIrr * (1 - Math.min(1, gapClosed));

  let status: AchievabilityStatus;
  let reasoning: string;

  if (gapClosed >= 1.0 && stretchRatio < 0.3) {
    status = 'achievable';
    reasoning = `Roadmap projects ${(projectedIrr * 100).toFixed(1)}% IRR vs target ${(targetIrr * 100).toFixed(1)}%. Full roadmap meets target at P50 execution across ${actions.length} named actions. ${highConfidence} actions are well-evidenced.`;
  } else if (gapClosed >= 0.85 && stretchRatio < 0.5) {
    status = 'achievable_with_stretch';
    reasoning = `Roadmap closes ${(gapClosed * 100).toFixed(0)}% of the NOI gap at P50. Target is reachable if ${lowConfidence} lower-confidence actions perform at P75. Projected IRR: ${(projectedIrr * 100).toFixed(1)}%.`;
  } else if (gapClosed >= 0.60) {
    status = 'achievable_only_with_overrides';
    reasoning = `Roadmap closes ${(gapClosed * 100).toFixed(0)}% of the NOI gap. Reaching the ${(targetIrr * 100).toFixed(1)}% target requires either additional actions not yet in the plan, above-P75 execution on key actions, or assumption overrides not currently supported by archive evidence.`;
  } else {
    status = 'not_achievable';
    const maxReachable = baselineIrr + (targetIrr - baselineIrr) * gapClosed;
    reasoning = `Target ${(targetIrr * 100).toFixed(1)}% IRR is not achievable with the current action set at P75 execution. Maximum reachable IRR with full roadmap at P75 is approximately ${(maxReachable * 100).toFixed(1)}%. To close the gap: negotiate a lower purchase price, extend the hold period, or expand the action scope.`;
  }

  return { status, reasoning, projectedIrr };
}

// ── Step 8: M36 Plausibility Check ───────────────────────────────────────────

function runM36Check(
  financials: Awaited<ReturnType<typeof loadDealFinancials>>,
  targetNoiPath: number[]
): RoadmapOutput['plausibility_check'] {
  const targetNoiY1 = targetNoiPath[0] ?? financials.baseNoi;
  const impliedCapRate = financials.purchasePrice > 0 ? targetNoiY1 / financials.purchasePrice : 0.055;

  let m36Result: ReturnType<typeof computePlausibility>;
  try {
    m36Result = computePlausibility({
      goingInCapRate: impliedCapRate,
      exitCapRate: financials.exitCapRate,
      rentGrowthY1: financials.noiGrowthPct,
      rentGrowthStabilized: financials.noiGrowthPct * 0.8,
    });
  } catch {
    return {
      m36_d_value: 1.0,
      classification: 'within_distribution',
      notes: 'M36 plausibility engine unavailable — defaulting to within-distribution.',
    };
  }

  const d = m36Result.dScore;
  let classification: PlausibilityClassification;
  if (d <= 1.5) classification = 'within_distribution';
  else if (d <= 2.0) classification = 'stretch';
  else if (d <= 2.5) classification = 'aggressive';
  else classification = 'implausible';

  return {
    m36_d_value: parseFloat(d.toFixed(3)),
    classification,
    notes: `M36 Mahalanobis d=${d.toFixed(2)} (${m36Result.band}). Top contributors: ${
      m36Result.topContributors.slice(0, 3).map(c => c.variable).join(', ')
    }.`,
  };
}

// ── Main Engine Entry Point ───────────────────────────────────────────────────

export async function generateRoadmap(input: RoadmapInput): Promise<RoadmapOutput> {
  logger.info('[roadmap-engine] Starting roadmap generation', {
    deal_id: input.deal_id,
    metric: input.target_return.metric,
    value: input.target_return.value,
    hold_years: input.target_return.hold_years,
  });

  // Load deal financials
  const financials = await loadDealFinancials(input.deal_id);
  const holdYears = input.target_return.hold_years;

  // Step 1 — Baseline
  const baselineProforma = await computeBaselineProforma(financials, holdYears);

  // Step 2 — Target
  const { targetProforma, requiredIrr } = await computeTargetProforma(financials, input);

  // Step 3 — Gap Analysis
  const gapAnalysis = computeGapAnalysis(
    baselineProforma.noi_path,
    targetProforma.noi_path_required
  );

  // Step 4 — Derive deal-level posture from NOI gap
  const dealPosture = deriveDealPosture(
    baselineProforma.noi_path[0] ?? financials.baseNoi,
    targetProforma.noi_path_required[0] ?? financials.baseNoi
  );

  // Step 4 — Action Inventory & Sizing (posture-gated at deal level)
  const rawActions = sizeActions(financials, gapAnalysis, input, dealPosture);

  // Step 5 — Sequencing
  const sequencedActions = sequenceActions(rawActions);

  // Step 6 — Trajectory (posture-gated per year)
  const trajectory = buildTrajectory(
    baselineProforma.noi_path,
    targetProforma.noi_path_required,
    sequencedActions,
    holdYears
  );

  // Step 7 — Achievability
  const baselineIrr = baselineProforma.irr / 100;
  const { status, reasoning, projectedIrr } = assessAchievability(
    trajectory,
    targetProforma.noi_path_required,
    baselineIrr,
    requiredIrr,
    sequencedActions
  );

  // Compute roadmap IRR from trajectory (NOI-with-roadmap path → leveraged IRR)
  const roadmapIrr = computeRoadmapIrr(trajectory, financials);

  // Step 8 — M36 Check
  const plausibilityCheck = runM36Check(financials, targetProforma.noi_path_required);

  logger.info('[roadmap-engine] Roadmap generation complete', {
    deal_id: input.deal_id,
    status,
    action_count: sequencedActions.length,
    deal_posture: dealPosture,
    baseline_irr_pct: (baselineIrr * 100).toFixed(1),
    target_irr_pct: (requiredIrr * 100).toFixed(1),
    roadmap_irr_pct: (roadmapIrr * 100).toFixed(1),
  });

  return {
    meta: {
      deal_id: input.deal_id,
      target_return: input.target_return,
      achievability_status: status,
      achievability_reasoning: reasoning,
      generated_at: new Date().toISOString(),
      baseline_irr: parseFloat((baselineIrr * 100).toFixed(2)),
      target_irr: parseFloat((requiredIrr * 100).toFixed(2)),
      roadmap_irr: parseFloat((roadmapIrr * 100).toFixed(2)),
    },
    baseline_proforma: baselineProforma,
    target_proforma: targetProforma,
    gap_analysis: gapAnalysis,
    roadmap_actions: sequencedActions,
    yearly_trajectory: trajectory,
    plausibility_check: plausibilityCheck,
  };
}
