/**
 * Valuation Grid Service — Multi-Method Price Triangulation
 * Task #1370, Dispatch 2 | Task #1415 Comp-Anchored Cap Rate
 *
 * Runs 6 active valuation methods (V0.1) + 4 placeholder methods (V1.0)
 * against a subject deal and reconciles them into a recommended price range.
 *
 * Active V0.1 methods:
 *   1. Cap Rate × NOI          — bottom-up income capitalisation (archive benchmarks)
 *   1b. Comp-Anchored Cap Rate — implied cap rates from market sale comps + staleness weighting
 *   2. Per-Unit Benchmark      — archive_assumption_benchmarks PPU cohort
 *   3. Sales Comp PPU          — CompSetService transaction comps
 *   3b. Sales Comp PSF         — conditional on sqft coverage
 *   4. Operator Override       — manual, always available
 *   5. Replacement Cost        — ReplacementCostServiceV2 (BLS PPI + permits)
 *
 * Placeholder V1.0 methods:
 *   6. GRM  — blocked on gross_rent_annual field coverage
 *   7. GIM  — blocked on gross_income_annual field coverage
 *   8. DCF  — blocked on Phase 2 full derivation logic
 */

import { Pool } from 'pg';
import { compSetService } from '../saleComps/compSet.service';
import { getReplacementCostServiceV2, type ReplacementCostInput } from '../inflation/replacement-cost-v2.service';
import { SubjectPopulationService, type SubjectCompletenessResult } from '../subject-population.service';
import { propertySalesService } from '../property-entity/property-sales.service';
import { shouldUseNewPath, shouldRunShadow, VALUATION_COMPS_FLAG } from '../property-entity/phase3-flags';
import { phase3ShadowService } from '../property-entity/phase3-shadow.service';
import { getFieldValue, getFieldValues } from '../field-access/get-field-value.service';
import { logger } from '../../utils/logger';
import {
  rankComps,
  resolveStrategy,
  type InvestmentStrategy,
  type CompCandidate,
  type SubjectProperty as CompScoringSubject,
} from './comp-relevance-scoring.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MethodId =
  | 'cap_rate_noi'
  | 'comp_anchored_cap_rate'
  | 'per_unit_benchmark'
  | 'sales_comp_ppu'
  | 'sales_comp_psf'
  | 'operator_override'
  | 'replacement_cost'
  | 'grm'
  | 'gim'
  | 'dcf';

export type MethodStatus = 'active' | 'insufficient' | 'placeholder';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export type MethodDirection = 'bottom_up' | 'top_down' | 'cost' | 'income' | 'manual';
export type ConvergenceSignal = 'CONVERGENT' | 'MODERATE' | 'DIVERGENT';

export interface EvidenceLine {
  label: string;
  value: string;
  source?: string;
}

export interface ValuationMethod {
  id: MethodId;
  label: string;
  direction: MethodDirection;
  status: MethodStatus;
  placeholderVersion?: string;
  confidence: ConfidenceLevel;
  indicatedValueP25: number | null;
  indicatedValueP50: number | null;
  indicatedValueP75: number | null;
  indicatedPPU: number | null;
  indicatedPSF: number | null;
  compCount?: number;
  sampleSize?: number;
  /** Task #1417 (6.2) — Number of comps older than MAX_COMP_AGE_MONTHS in the pool */
  staleCompCount?: number;
  /** Task #1417 (6.2) — Cap rate spread P75-P25 in basis points (comp-anchored method only) */
  capRateSpreadBps?: number;
  /** Wave B — number of comps removed by relevance scoring (score < RELEVANCE_MIN_SCORE). */
  relevanceFilteredCount?: number;
  sourceProvenance: string;
  evidenceTrail: EvidenceLine[];
  warningFlags: string[];
}

export interface GapAnalysisItem {
  methodA: MethodId;
  methodB: MethodId;
  labelA: string;
  labelB: string;
  deltaPct: number;
  driverText: string;
  severity: 'info' | 'watch' | 'alert';
}

export interface SubjectProperty {
  units: number | null;
  totalSF: number | null;
  purchasePrice: number | null;
  noi: number | null;
  noiSource: string;
  /** CF-07: EGI resolved via canonical getFieldValue chain (net_rental_income + other_income). */
  egi: number | null;
  egiSource: string;
  /** CF-08: GPR Year-1 resolved via canonical getFieldValue chain. */
  gpr: number | null;
  gprSource: string;
  /** CF-09: Total OpEx Year-1 resolved via canonical getFieldValue chain. */
  totalOpex: number | null;
  totalOpexSource: string;
  /** CF-10: Exit cap rate resolved via canonical getFieldValue chain (B3 migration). */
  exitCap: number | null;
  exitCapSource: string;
  /** CF-11: Hold period years resolved via canonical getFieldValue chain (B3 migration). */
  holdPeriodYears: number | null;
  holdPeriodYearsSource: string;
  assetClass: string | null;
  /** Year built from properties row — used as a factor in comp relevance scoring. */
  yearBuilt: number | null;
  /** Number of stories from properties row — used as an optional PSF comp similarity filter. */
  stories: number | null;
  city: string;
  state: string;
  submarket: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ValuationGridResult {
  dealId: string;
  computedAt: string;
  subject: SubjectProperty;
  subjectCompleteness: SubjectCompletenessResult;
  methods: ValuationMethod[];
  reconciliation: {
    convergenceScore: number;
    convergenceSignal: ConvergenceSignal;
    convergenceText: string;
    reconciledValue: number | null;
    reconciledPPU: number | null;
    reconciledPSF: number | null;
    recommendedPriceLow: number | null;
    recommendedPriceHigh: number | null;
    gapAnalysis: GapAnalysisItem[];
    activeMethodCount: number;
    /** Task #1417 (6.3) — Overall valuation confidence propagated from method mix */
    valuationConfidence: ConfidenceLevel;
    /** Human-readable explanation e.g. "8 comps, cap rate spread: 145bps" */
    valuationConfidenceText: string;
  };
}

// ── Task #1417: Comp override types ──────────────────────────────────────────

/** Tracks a single operator override action with provenance for audit. */
export interface OverrideEvent {
  compId: string;
  action: 'exclude' | 'include' | 'add';
  source: 'operator_override';
  at: string;
}

export interface CompCriteria {
  radiusMiles: number;
  maxAgeMonths: number;
  minUnits: number;
  maxUnits: number;
  /** Vintage band lower bound (inclusive). 0 = no filter. */
  minYearBuilt: number;
  /** Vintage band upper bound (inclusive). 9999 = no filter. */
  maxYearBuilt: number;
  propertyClasses: string[];
  /** Comp IDs the operator has explicitly removed from scoring. */
  excludedCompIds: string[];
  /** Comp IDs the operator has manually added from the broader candidate pool. */
  customIncludedCompIds: string[];
  /** Immutable audit log of all operator override actions (newest last). */
  overrideEvents: OverrideEvent[];
}

export type StalenessLabel = 'fresh' | 'aging' | 'seasoned' | 'stale';

export interface CompReviewItem {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  units: number | null;
  year_built: number | null;
  asset_class: string | null;
  sale_date: string | null;
  sale_price: number | null;
  price_per_unit: number | null;
  implied_cap_rate: number | null;
  distance_miles: number | null;
  source: string;
  relevance_score: number | null;
  relevance_tier: string | null;
  age_months: number;
  staleness_label: StalenessLabel;
  staleness_weight: number;
  /** Whether operator has excluded this comp from scoring. */
  excluded: boolean;
  /** Whether this comp was manually added by the operator (not in system comp set). */
  manually_added: boolean;
}

export interface CompReviewResult {
  dealId: string;
  criteria: CompCriteria;
  /** Active and operator-excluded comps from the system comp set, filtered by criteria. */
  comps: CompReviewItem[];
  /** Additional comps from market_sale_comps within 1.5× radius but NOT in the comp set. */
  additionalCandidates: CompReviewItem[];
  totalCandidates: number;
  staleCount: number;
  excludedCount: number;
}

// ── Task #1417 (6.2): Staleness thresholds ────────────────────────────────────
//
// Comps are bucketed by age from today to their sale_date:
//   fresh    : ≤12 months  → weight 1.00 (full)
//   aging    : 12-24 months → weight 0.85
//   seasoned : 24-36 months → weight 0.70
//   stale    : >MAX_COMP_AGE_MONTHS months → weight 0.50, flagged with ⚠
//
// MAX_COMP_AGE_MONTHS is the threshold at which a comp is considered "stale"
// (i.e. still included in synthesis but explicitly flagged). This is configurable
// per-deal via deal_assumptions.comp_criteria.maxAgeMonths; the default below
// is used when no operator preference is set.

const MAX_COMP_AGE_MONTHS_DEFAULT = 36;
// Minimum relevance score to include a comp in active scoring (M1 tier threshold).
// Comps below this threshold are available as additional candidates in the Comp
// Review panel but are excluded from cap rate and PPU synthesis.
const RELEVANCE_MIN_SCORE = 0.25;
// Wide retrieval horizon for comp-set generation — deliberately broader than the operator's
// maxAgeMonths staleness threshold so that aged comps are RETAINED in the set and
// downweighted by stalenessWeight() rather than hard-excluded at the SQL level.
// 120 months (10 years) accommodates markets with thin transaction volume (e.g. Jacksonville)
// where the nearest comps may be 5–8 years old. Staleness weighting (weight=0.5 for stale)
// applies the quality penalty without hard-excluding otherwise-valid data points.
const COMP_RETRIEVAL_HORIZON_MONTHS = 120;

function stalenessLabel(ageMonths: number, maxAgeMonths: number): 'fresh' | 'aging' | 'seasoned' | 'stale' {
  if (ageMonths <= 12) return 'fresh';
  if (ageMonths <= 24) return 'aging';
  if (ageMonths <= maxAgeMonths) return 'seasoned';
  return 'stale';
}

/**
 * Task #1417 (6.2): Staleness weight uses `maxAgeMonths` as the stale threshold so that
 * the haircut is consistent with the staleness label. Comps beyond `maxAgeMonths` always
 * receive the 0.50× haircut, regardless of whether that threshold is 24, 36, or 48 months.
 * The fresh/aging/seasoned breakpoints (12mo / 24mo) are domain-anchored and remain fixed.
 */
function stalenessWeight(ageMonths: number, maxAgeMonths: number = MAX_COMP_AGE_MONTHS_DEFAULT): number {
  if (ageMonths > maxAgeMonths) return 0.50;   // stale — beyond operator threshold
  if (ageMonths > 24) return 0.70;              // seasoned
  if (ageMonths > 12) return 0.85;              // aging
  return 1.00;                                   // fresh
}

// ── Confidence weight map ─────────────────────────────────────────────────────

const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INSUFFICIENT: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(v: number | null): string {
  if (v == null) return '—';
  return v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPPU(v: number | null): string {
  if (v == null) return '—';
  return `$${Math.round(v).toLocaleString('en-US')}/unit`;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function safeFloat(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ValuationGridService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Compute the full valuation grid for a deal.
   *
   * @param options.asOf  Backtest / as-of mode: restrict all comp and market
   *   queries to data dated strictly before this date.  When set the comp
   *   service runs in dry-run mode (no DB persist) and stored comp sets are
   *   bypassed in favour of freshly-generated as-of filtered sets.
   */
  async compute(dealId: string, options?: { asOf?: Date }): Promise<ValuationGridResult> {
    const asOf = options?.asOf;
    const populationSvc = new SubjectPopulationService(this.pool);

    // D-DEAL-3: Run completeness gate in parallel with subject property fetch.
    // The gate result is attached to the response so the UI can surface
    // actionable missing-field prompts instead of a generic error.
    // Task #1417 (6.1): Also fetch comp_criteria so operator overrides propagate into scoring.
    // Wave B: Also fetch deal investment strategy for strategy-aware relevance scoring.
    const [subject, subjectCompleteness, compCriteria, investmentStrategy] = await Promise.all([
      this.getSubjectProperty(dealId),
      populationSvc.checkSubjectCompleteness(dealId, 'valuation_grid'),
      this.getCompCriteria(dealId),
      this.getDealInvestmentStrategy(dealId),
    ]);

    const methods: ValuationMethod[] = [];

    // D-DEAL-3 gate: skip unit-dependent methods when the unit count is missing
    // so each method surfaces a targeted prompt instead of a generic INSUFFICIENT.
    // Methods that do not require units (cap-rate-NOI, replacement-cost) always run.
    const noUnits = subject.units == null;
    const unitFieldMeta = subjectCompleteness.missingFields.find(f => f.field === 'units');
    const unitGateMsg = unitFieldMeta?.suggestion
      ?? 'Upload an Offering Memorandum or enter the unit count in deal details.';

    // Task #1505: Pre-fetch the shared comp set ONCE before dispatching the parallel
    // valuation methods. Previously, computeCompAnchoredCapRate and computeSalesCompPPU
    // each independently called getCompSetByDeal + generateCompSet inside Promise.all.
    // When no stored comp set existed, both INSERTed a new sale_comp_sets row
    // simultaneously; the second insert completed before the first's members were
    // committed, leaving a ghost row (comp_count=N, 0 actual members in the join
    // table). Serialising the lookup/generation here guarantees at most one
    // INSERT per compute() call and eliminates the race entirely.
    let sharedCompSet: any = null;
    try {
      if (!asOf) {
        sharedCompSet = await compSetService.getCompSetByDeal(dealId);
      }
      if (!sharedCompSet || sharedCompSet.comp_count === 0 || !sharedCompSet.comps || sharedCompSet.comps.length === 0) {
        sharedCompSet = await compSetService.generateCompSet({
          deal_id: dealId,
          radius_miles: compCriteria.radiusMiles,
          date_range_months: COMP_RETRIEVAL_HORIZON_MONTHS,
          min_units: compCriteria.minUnits > 0 ? compCriteria.minUnits : undefined,
          max_units: compCriteria.maxUnits < 9999 ? compCriteria.maxUnits : undefined,
          property_classes: compCriteria.propertyClasses?.length ? compCriteria.propertyClasses : undefined,
          vintage_range: (compCriteria.minYearBuilt > 0 || compCriteria.maxYearBuilt < 9999)
            ? [compCriteria.minYearBuilt, compCriteria.maxYearBuilt] : undefined,
          ...(asOf ? { as_of: asOf, dry_run: true } : {}),
        });
      }
    } catch {
      // silent — comp set may fail without lat/lon; each method handles null gracefully
    }

    const [
      m1,
      m1b,
      m2,
      m3,
      m5,
    ] = await Promise.all([
      this.computeCapRateNOI(subject, asOf),
      this.computeCompAnchoredCapRate(dealId, subject, compCriteria, asOf, sharedCompSet, investmentStrategy),
      noUnits
        ? Promise.resolve(this.insufficientMethod(
            'per_unit_benchmark', 'Per-Unit Benchmark', 'top_down',
            unitGateMsg,
            ['Missing subject field: unit count']))
        : this.computePerUnitBenchmark(subject, asOf),
      noUnits
        ? Promise.resolve(this.insufficientMethod(
            'sales_comp_ppu', 'Sales Comp PPU', 'top_down',
            unitGateMsg,
            ['Missing subject field: unit count']))
        : this.computeSalesCompPPU(dealId, subject, compCriteria, asOf, sharedCompSet, investmentStrategy),
      this.computeReplacementCost(subject),
    ]);

    methods.push(m1);
    methods.push(m1b);
    methods.push(m2);
    methods.push(m3);

    // PSF sub-method — only if subject has sqft and comp PSF is meaningful
    const m3b = this.computeSalesCompPSF(m3, subject);
    if (m3b) methods.push(m3b);

    // Method 4 — Operator Override — always appended (may be INSUFFICIENT if not set)
    const m4 = await this.computeOperatorOverride(dealId, subject);
    methods.push(m4);

    methods.push(m5);

    // GRM / GIM — activated (CF-08 / CF-07): subject GPR and EGI now flow via
    // canonical getFieldValue chain.  When market_sale_comps carries
    // gross_rent_annual / gross_income_annual, the comp-pool median multiplier
    // is used to produce a market-anchored indicated value (Task #1568).
    const [mGrm, mGim] = await Promise.all([
      this.computeGRM(dealId, subject, compCriteria, asOf),
      this.computeGIM(dealId, subject, compCriteria, asOf),
    ]);
    methods.push(mGrm);
    methods.push(mGim);
    methods.push(this.placeholder('dcf', 'DCF — Discounted Cash Flow', 'income'));

    const reconciliation = this.reconcile(methods, subject);

    return {
      dealId,
      computedAt: new Date().toISOString(),
      subject,
      subjectCompleteness,
      methods,
      reconciliation,
    };
  }

  // ── Subject property ────────────────────────────────────────────────────────
  //
  // D-DEAL-1 (Task #1405 / Wave A diagnosis):
  // The join `properties p ON p.deal_id = d.id` returns NULL for any deal that
  // was not seeded with a matching properties row at intake. As of Wave A, only
  // 464 Bishop (deal_id 3f32276f-aacd-4da3-b306-317c5109b403) has a linked row.
  // All other deals get NULL from the LEFT JOIN, which causes p.units, p.building_sf,
  // p.building_class, and p.submarket_id to be NULL. The service handles this
  // gracefully — NULL subject fields degrade individual methods to 'insufficient'
  // but never throw. Fix path: Task #1422 (deal creation auto-links properties row).
  //
  // Column names confirmed correct: p.building_class (not asset_class) and
  // p.submarket_id (not submarket) — aliased to match SubjectProperty type fields.

  private async getSubjectProperty(dealId: string): Promise<SubjectProperty> {
    // Fetch property + deal fields.
    // NOI, EGI, GPR, total_opex, exit_cap, hold_period_years are resolved via
    // getFieldValues (canonical path).
    // CF-01: NOI              — override > Engine A formula (EGI − total_opex) > agent > seeder resolved
    // CF-07: EGI              — override > Engine A formula (NRI + other_income) > agent > seeder resolved
    // CF-08: GPR              — override > agent > seeder resolved (leaf field, no Engine A formula)
    // CF-09: totalOpex        — override > agent > seeder resolved (leaf field)
    // CF-10: exitCap          — override > agent > seeder resolved (leaf field, B3 migration)
    // CF-11: holdPeriodYears  — override > agent > seeder resolved (leaf field, B3 migration)
    //
    // Shadow comparison (canary pattern): the SQL query also fetches raw
    // da.year1->'<field>'->>'resolved' so we can log when the canonical
    // getFieldValue path disagrees with the stored value.
    // This validates the migration before any old-read code is cut over.
    const [result, fvs] = await Promise.all([
      this.pool.query(
        `SELECT
           d.id,
           COALESCE(p.city, d.city, d.address, '')  AS city,
           COALESCE(p.state_code, '')               AS state,
           p.units,
           p.building_sf                            AS total_sf,
           p.latitude,
           p.longitude,
           p.building_class                          AS asset_class,
           p.year_built,
           p.stories,
           p.submarket_id                            AS submarket,
           p.acquisition_price                      AS purchase_price,
           da.valuation_override_lv                 AS valuation_override_lv,
           -- Shadow-comparison: stored seeder-resolved values for all migrated fields.
           -- Used to detect divergence between the canonical getFieldValue chain and
           -- the stale seed. Logged but not used as the canonical source.
           (da.year1->'egi'->>'resolved')::numeric           AS shadow_egi_stored,
           (da.year1->'gpr'->>'resolved')::numeric           AS shadow_gpr_stored,
           (da.year1->'total_opex'->>'resolved')::numeric    AS shadow_topex_stored,
           (da.year1->'exit_cap'->>'resolved')::numeric      AS shadow_exit_cap_stored,
           (da.year1->'hold_period_years'->>'resolved')::numeric AS shadow_hold_period_stored
         FROM deals d
         LEFT JOIN properties p ON p.deal_id = d.id
         LEFT JOIN deal_assumptions da ON da.deal_id = d.id
         WHERE d.id = $1::uuid
         LIMIT 1`,
        [dealId]
      ),
      // Batch-resolve all six fields in one SQL round-trip.
      getFieldValues(this.pool, dealId, ['noi', 'egi', 'gpr', 'total_opex', 'exit_cap', 'hold_period_years'], 1),
    ]);

    const row = result.rows[0];
    if (!row) throw new Error(`Deal ${dealId} not found`);

    // ── NOI (CF-01) ─────────────────────────────────────────────────────────
    const noiFv = fvs['noi'];
    let noi: number | null = null;
    let noiSource = 'none';
    if (noiFv?.resolved != null && noiFv.resolved > 0) {
      noi       = noiFv.resolved;
      noiSource = noiFv.source ?? 'proforma_year1';
    }

    // ── EGI (CF-07) ─────────────────────────────────────────────────────────
    const egiFv = fvs['egi'];
    let egi: number | null = null;
    let egiSource = 'none';
    if (egiFv?.resolved != null && egiFv.resolved > 0) {
      egi       = egiFv.resolved;
      egiSource = egiFv.source ?? 'proforma_year1';
    }

    // ── GPR (CF-08) ─────────────────────────────────────────────────────────
    const gprFv = fvs['gpr'];
    let gpr: number | null = null;
    let gprSource = 'none';
    if (gprFv?.resolved != null && gprFv.resolved > 0) {
      gpr       = gprFv.resolved;
      gprSource = gprFv.source ?? 'proforma_year1';
    }

    // ── Total OpEx (CF-09) ───────────────────────────────────────────────────
    const topexFv = fvs['total_opex'];
    let totalOpex: number | null = null;
    let totalOpexSource = 'none';
    if (topexFv?.resolved != null && topexFv.resolved > 0) {
      totalOpex       = topexFv.resolved;
      totalOpexSource = topexFv.source ?? 'proforma_year1';
    }

    // ── Exit Cap Rate (CF-10) ────────────────────────────────────────────────
    // B3 migration: was ⚠️ Deferred (da.year1->'exit_cap'->>'resolved' raw SQL).
    // Now resolved via canonical getFieldValue chain (override > agent > seeder stored).
    const exitCapFv = fvs['exit_cap'];
    let exitCap: number | null = null;
    let exitCapSource = 'none';
    if (exitCapFv?.resolved != null && exitCapFv.resolved > 0) {
      exitCap       = exitCapFv.resolved;
      exitCapSource = exitCapFv.source ?? 'proforma_year1';
    }

    // ── Hold Period Years (CF-11) ────────────────────────────────────────────
    // B3 migration: was ⚠️ Deferred (da.year1->'hold_period_years'->>'resolved' raw SQL).
    // Now resolved via canonical getFieldValue chain (override > agent > seeder stored).
    const holdFv = fvs['hold_period_years'];
    let holdPeriodYears: number | null = null;
    let holdPeriodYearsSource = 'none';
    if (holdFv?.resolved != null && holdFv.resolved > 0) {
      holdPeriodYears       = holdFv.resolved;
      holdPeriodYearsSource = holdFv.source ?? 'proforma_year1';
    }

    // ── Shadow comparison: log when canonical diverges from stored seed ──────
    // This runs during the canary period so we can confirm getFieldValue
    // agrees with stored values before fully cutting over.
    this._logShadowDivergence(dealId, 'egi', egi, safeFloat(row.shadow_egi_stored, 0) || null);
    this._logShadowDivergence(dealId, 'gpr', gpr, safeFloat(row.shadow_gpr_stored, 0) || null);
    this._logShadowDivergence(dealId, 'total_opex', totalOpex, safeFloat(row.shadow_topex_stored, 0) || null);
    this._logShadowDivergence(dealId, 'exit_cap', exitCap, safeFloat(row.shadow_exit_cap_stored, 0) || null);
    this._logShadowDivergence(dealId, 'hold_period_years', holdPeriodYears, safeFloat(row.shadow_hold_period_stored, 0) || null);

    return {
      units: row.units ? safeFloat(row.units) : null,
      totalSF: row.total_sf ? safeFloat(row.total_sf) : null,
      purchasePrice: row.purchase_price ? safeFloat(row.purchase_price) : null,
      noi,
      noiSource,
      egi,
      egiSource,
      gpr,
      gprSource,
      totalOpex,
      totalOpexSource,
      exitCap,
      exitCapSource,
      holdPeriodYears,
      holdPeriodYearsSource,
      assetClass: row.asset_class || null,
      yearBuilt: row.year_built ? parseInt(String(row.year_built), 10) : null,
      stories: row.stories ? parseInt(String(row.stories), 10) : null,
      city: row.city || '',
      state: row.state || '',
      submarket: row.submarket || null,
      latitude: row.latitude ? safeFloat(row.latitude) : null,
      longitude: row.longitude ? safeFloat(row.longitude) : null,
    };
  }

  /**
   * Fetch the deal's investment strategy from deal_assumptions for strategy-aware
   * comp relevance scoring. Returns 'stabilized' when no strategy is set.
   */
  private async getDealInvestmentStrategy(dealId: string): Promise<InvestmentStrategy> {
    try {
      const res = await this.pool.query(
        `SELECT da.investment_strategy_lv->>'resolved' AS strategy
         FROM deal_assumptions da
         WHERE da.deal_id = $1::uuid
         LIMIT 1`,
        [dealId]
      );
      if (res.rows.length > 0 && res.rows[0].strategy) {
        return resolveStrategy(res.rows[0].strategy);
      }
    } catch {
      // non-fatal — default to stabilized
    }
    return 'stabilized';
  }

  /**
   * Apply relevance scoring to a comp pool using the six-factor engine.
   *
   * Maps raw comp set items (CompSetService format) to CompCandidate,
   * calls rankComps, merges scores back onto the original comp objects,
   * then splits into:
   *   - scoredComps   — all comps with relevance_score + relevance_tier attached
   *   - filteredComps — comps with relevance_score >= RELEVANCE_MIN_SCORE (M1+)
   *   - relevanceFilteredCount — number removed by threshold
   *
   * Custom-added comp IDs (operator explicit adds) bypass the threshold so
   * they are always included in filteredComps regardless of score.
   */
  private _applyRelevanceScoring(
    comps: any[],
    subject: SubjectProperty,
    strategy: InvestmentStrategy,
    customIncludedIds?: Set<string>,
  ): { scoredComps: any[]; filteredComps: any[]; relevanceFilteredCount: number } {
    if (comps.length === 0) {
      return { scoredComps: [], filteredComps: [], relevanceFilteredCount: 0 };
    }

    const scoringSubject: CompScoringSubject = {
      units: subject.units,
      year_built: subject.yearBuilt,
      asset_class: subject.assetClass,
    };

    const candidates: Array<CompCandidate & { _original: any }> = comps.map(c => ({
      id: String(c.id),
      units: c.units != null ? parseInt(String(c.units)) : null,
      year_built: c.year_built != null ? parseInt(String(c.year_built)) : null,
      asset_class: (c.property_class ?? c.asset_class ?? null) as string | null,
      sale_date: c.recording_date ?? c.sale_date ?? null,
      distance_miles: c.distance_miles != null ? parseFloat(String(c.distance_miles)) : null,
      source: (c.source ?? null) as string | null,
      _original: c,
    }));

    const { ranked } = rankComps(scoringSubject, candidates, strategy);

    const scoredComps = ranked.map(({ comp, relevance_score, relevance_tier }) => ({
      ...(comp as any)._original,
      relevance_score,
      relevance_tier,
    }));

    const filteredComps = scoredComps.filter(c =>
      (customIncludedIds?.has(String(c.id))) || c.relevance_score >= RELEVANCE_MIN_SCORE
    );

    return {
      scoredComps,
      filteredComps,
      relevanceFilteredCount: scoredComps.length - filteredComps.length,
    };
  }

  /**
   * Shadow-comparison log helper (canary migration pattern).
   *
   * Logs at 'info' when the canonical getFieldValue path (canonicalVal) differs
   * materially from the stored seeder resolved value (storedVal).  A >1% relative
   * difference qualifies as material for income fields.
   *
   * Remove this method and all _logShadowDivergence calls once the canary period
   * has confirmed the canonical path is correct for all live deals.
   */
  private _logShadowDivergence(
    dealId: string,
    field: string,
    canonicalVal: number | null,
    storedVal: number | null,
  ): void {
    if (canonicalVal == null || storedVal == null) return;
    if (storedVal === 0) return;
    const relDelta = Math.abs(canonicalVal - storedVal) / Math.abs(storedVal);
    if (relDelta > 0.01) {
      logger.info('[valuation-grid] shadow-divergence', {
        dealId, field,
        canonical: canonicalVal,
        stored: storedVal,
        relDeltaPct: +(relDelta * 100).toFixed(2),
      });
    }
  }

  // ── Method 1: Cap Rate × NOI ─────────────────────────────────────────────

  private async computeCapRateNOI(subject: SubjectProperty, asOf?: Date): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'cap_rate_noi';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.noi) {
      return this.insufficientMethod(
        METHOD_ID,
        'Cap Rate × NOI',
        'bottom_up',
        'No NOI available — add proforma assumptions or upload a T12 rent roll.',
        []
      );
    }

    // Query cap rate distribution from archive benchmarks.
    // When asOf is set (backtest mode), restrict to benchmarks with as_of <= asOf
    // so no post-acquisition benchmark data influences the historical valuation.
    const params: unknown[] = [];
    let whereClauses = [`assumption_name = 'cap_rate'`];

    if (subject.assetClass) {
      params.push(subject.assetClass);
      whereClauses.push(`(asset_class = $${params.length} OR asset_class IS NULL)`);
    } else {
      whereClauses.push(`asset_class IS NULL`);
    }

    if (subject.submarket) {
      params.push(subject.submarket);
      whereClauses.push(`(submarket_id = $${params.length} OR submarket_id IS NULL)`);
    }

    if (asOf) {
      params.push(asOf);
      whereClauses.push(`as_of <= $${params.length}`);
    }

    const capQuery = await this.pool.query(
      `SELECT p25, p50, p75, n_samples, as_of, submarket_id
       FROM archive_assumption_benchmarks
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY
         (CASE WHEN submarket_id IS NOT NULL THEN 0 ELSE 1 END),
         as_of DESC
       LIMIT 1`,
      params
    );

    let capP25: number, capP50: number, capP75: number, nSamples: number;
    let sourceText: string;

    if (capQuery.rows.length > 0 && capQuery.rows[0].p50 != null) {
      const row = capQuery.rows[0];
      capP25 = safeFloat(row.p25, 0.045);
      capP50 = safeFloat(row.p50, 0.055);
      capP75 = safeFloat(row.p75, 0.065);
      nSamples = safeFloat(row.n_samples, 0);
      const scope = row.submarket_id ? `${row.submarket_id} submarket` : `${subject.city} market`;
      sourceText = `Archive benchmark — ${scope} (n=${nSamples}, as of ${row.as_of?.toISOString?.()?.slice(0, 10) ?? 'unknown'})`;

      if (nSamples < 5) {
        warnings.push(`Very thin archive sample (n=${nSamples}) — cap rate range is unreliable for this cohort.`);
      } else if (nSamples < 10) {
        warnings.push(`Sparse archive sample (n=${nSamples}) — treat cap rate range with caution.`);
      }
    } else {
      // Market defaults for FL/GA/TX primary — conservative placeholder
      const defaults = this.defaultCapRatesByMarket(subject.state, subject.city);
      capP25 = defaults.p25;
      capP50 = defaults.p50;
      capP75 = defaults.p75;
      nSamples = 0;
      sourceText = `Market default cap rates for ${subject.city}, ${subject.state} (no archive data yet)`;
      warnings.push('No archive cap rate data for this cohort — using market defaults. Confidence LOW.');
    }

    // Indicated values: V = NOI / cap_rate
    // Higher cap → lower value; lower cap → higher value
    const noi = subject.noi!;
    const valP25 = noi / capP75;  // low end: high cap
    const valP50 = noi / capP50;
    const valP75 = noi / capP25;  // high end: low cap

    const ppu50 = subject.units ? valP50 / subject.units : null;
    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;

    evidence.push(
      { label: 'Stabilized NOI', value: fmt$(noi), source: subject.noiSource },
      { label: 'Cap Rate P25', value: `${(capP25 * 100).toFixed(2)}%`, source: 'archive_assumption_benchmarks' },
      { label: 'Cap Rate P50', value: `${(capP50 * 100).toFixed(2)}%`, source: 'archive_assumption_benchmarks' },
      { label: 'Cap Rate P75', value: `${(capP75 * 100).toFixed(2)}%`, source: 'archive_assumption_benchmarks' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    const confidence = this.archiveConfidence(nSamples, subject.state, subject.city);

    return {
      id: METHOD_ID,
      label: 'Cap Rate × NOI',
      direction: 'bottom_up',
      status: 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: ppu50,
      indicatedPSF: psf50,
      sampleSize: nSamples,
      sourceProvenance: sourceText,
      evidenceTrail: evidence,
      warningFlags: warnings,
    };
  }

  // ── Method 1b: Comp-Anchored Cap Rate ────────────────────────────────────
  //
  // Derives a cap rate band directly from market sale comp implied cap rates.
  // Comps that carry cap_rate from market_sale_comps are used as-is; comps
  // without cap_rate get a synthesized rate: (avg_rent × units × 12 × occ ×
  // (1 - opex_ratio)) / sale_price using the subject's city/state market
  // snapshot as the rent/occ proxy. Each data point is weighted by recency
  // (staleness haircut: 0-12mo = 1.0, 12-24mo = 0.85, 24-36mo = 0.70,
  // 36+ = 0.50). A weighted-percentile computation yields P25/P50/P75 cap
  // rates, and value = subject.noi / cap_rate_P50 (same NOI source as M1).

  private async getMarketSnapshotForSynthesis(
    city: string,
    state: string,
    asOf?: Date
  ): Promise<{ avgRent: number; avgOccupancy: number } | null> {
    try {
      const params: unknown[] = [city, state];
      let asOfClause = '';
      if (asOf) {
        params.push(asOf);
        asOfClause = `AND (snapshot_date IS NULL OR snapshot_date <= $${params.length})`;
      }
      const res = await this.pool.query(
        `SELECT avg_rent_studio, avg_rent_1br, avg_rent_2br, avg_rent_3br, avg_occupancy
         FROM apartment_market_snapshots
         WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2) ${asOfClause}
         ORDER BY snapshot_date DESC NULLS LAST, id DESC
         LIMIT 1`,
        params
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const rentCols = [row.avg_rent_studio, row.avg_rent_1br, row.avg_rent_2br, row.avg_rent_3br]
        .map(v => safeFloat(v, 0))
        .filter(v => v > 0);
      const avgRent = rentCols.length > 0
        ? rentCols.reduce((a, b) => a + b, 0) / rentCols.length
        : 0;
      const avgOccupancy = safeFloat(row.avg_occupancy, 0);
      return { avgRent: avgRent > 0 ? avgRent : 0, avgOccupancy: avgOccupancy > 0 ? avgOccupancy : 0 };
    } catch {
      return null;
    }
  }

  private async computeCompAnchoredCapRate(
    dealId: string,
    subject: SubjectProperty,
    criteria: CompCriteria,
    asOf?: Date,
    sharedCompSet?: any,
    strategy: InvestmentStrategy = 'stabilized'
  ): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'comp_anchored_cap_rate';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.noi) {
      return this.insufficientMethod(
        METHOD_ID,
        'Comp-Anchored Cap Rate',
        'bottom_up',
        'No NOI available — add proforma assumptions or upload a T12 rent roll.',
        []
      );
    }

    // Phase 5 — Property_sales path (behind VALUATION_COMPS_FLAG)
    // When the feature flag is active, try property_sales.implied_cap_rate (pre-synthesized
    // from property_operating_data) as the primary source for the cap rate distribution.
    // Falls through to the existing CompSetService path if insufficient data.
    //
    // canary/true: Phase 5 path serves
    // shadow:      legacy path serves; Phase 5 is queried AFTER legacy completes and the
    //              results are compared (true old vs new) before being logged
    const valuationCompsFlag = VALUATION_COMPS_FLAG();
    if (!asOf && subject.latitude && subject.longitude && shouldUseNewPath(valuationCompsFlag)) {
      try {
        // Market distribution uses a wider radius than deal-specific comp selection
        // (at least 25 miles so metro comps reach all intown subjects — e.g. south-Atlanta
        // deals reaching Cobb County comps at ~18 miles) and omits unit-count filters
        // since property_sales properties often lack unit data — the distribution is a
        // market reference, not a targeted comp selection.
        const marketRadiusMiles = Math.max(criteria.radiusMiles, 25);
        const distribution = await propertySalesService.getMarketCapRateDistribution({
          lat: subject.latitude,
          lng: subject.longitude,
          radiusMiles: marketRadiusMiles,
          monthsBack: criteria.maxAgeMonths ?? MAX_COMP_AGE_MONTHS_DEFAULT,
        });

        // Shadow mode: log what the new path would produce, then fall through to old path.
        if (shouldRunShadow(valuationCompsFlag) && !shouldUseNewPath(valuationCompsFlag)) {
          await phase3ShadowService.logBatch('valuation_comps', dealId, {
            'comp_anchored_cap_rate.new_path_active': {
              old: null,
              new: distribution && distribution.n >= 3 ? 'active' : 'insufficient',
            },
            'comp_anchored_cap_rate.new_path_n': {
              old: null,
              new: distribution?.n ?? 0,
            },
            'comp_anchored_cap_rate.new_path_p50': {
              old: null,
              new: distribution?.p50 ?? null,
            },
          });
          // Fall through to old path — shadow does not serve
        } else if (distribution && distribution.n >= 3) {
          // Serving mode (flag=true or canary): return the new path result
          const noi = subject.noi!;
          const valP25 = noi / distribution.p75;
          const valP50 = noi / distribution.p50;
          const valP75 = noi / distribution.p25;
          const ppu50 = subject.units ? valP50 / subject.units : null;
          const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;
          const capRateSpreadBps = Math.round((distribution.p75 - distribution.p25) * 10000);
          const confidence: ConfidenceLevel =
            distribution.n >= 10 ? 'HIGH'
            : distribution.n >= 5  ? 'MEDIUM'
            : 'LOW';

          const fmtCapPs5 = (v: number) => `${(v * 100).toFixed(2)}%`;

          // Count Georgia county-recorded comps (source=county_recorded) for shadow-log
          // confirmation that Gwinnett/DeKalb/Cobb/Fulton ingest is populating the pool.
          const georgiaSources = distribution.sources.filter(
            (s: any) => (s.source ?? '') === 'county_recorded'
          );
          const georgiaCount = georgiaSources.length;

          const ps5evidence: EvidenceLine[] = [
            { label: 'Stabilized NOI', value: fmt$(noi), source: subject.noiSource },
            { label: 'Comp Pool (property_sales)', value: `${distribution.n} comps with implied cap rate` },
            { label: 'Georgia county_recorded', value: `${georgiaCount} of ${distribution.n} comps`, source: 'property_sales' },
            { label: 'Implied Cap P25', value: fmtCapPs5(distribution.p25), source: 'property_sales' },
            { label: 'Implied Cap P50', value: fmtCapPs5(distribution.p50), source: 'property_sales' },
            { label: 'Implied Cap P75', value: fmtCapPs5(distribution.p75), source: 'property_sales' },
            { label: 'Indicated Value P50', value: fmt$(valP50) },
          ];
          for (const s of distribution.sources) {
            ps5evidence.push({
              label: `Comp: ${s.saleId.slice(0, 8)}…`,
              value: `${fmtCapPs5(s.impliedCapRate)} | ${s.saleDate} | ${s.distanceMiles.toFixed(2)}mi`,
              source: 'property_sales',
            });
          }

          return {
            id: METHOD_ID,
            label: 'Comp-Anchored Cap Rate',
            direction: 'bottom_up',
            status: 'active',
            confidence,
            indicatedValueP25: valP25,
            indicatedValueP50: valP50,
            indicatedValueP75: valP75,
            indicatedPPU: ppu50,
            indicatedPSF: psf50,
            compCount: distribution.n,
            staleCompCount: 0,
            capRateSpreadBps,
            sourceProvenance: `${distribution.n} property_sales implied cap rates (Phase 5 — synthesized from operating data; ${georgiaCount} Georgia county_recorded)`,
            evidenceTrail: ps5evidence,
            warningFlags: distribution.n < 5
              ? [`Thin comp pool from property_sales (n=${distribution.n}) — consider widening radius.`]
              : [],
          };
        }
      } catch {
        // Phase 5 path failed silently — fall through to legacy CompSetService path
      }
    }

    // Legacy CompSetService path — wrapped in IIFE so the result is captured for
    // the shadow comparison block below. All early returns inside resolve legacyResult.
    const legacyResult = await (async (): Promise<ValuationMethod> => {

    // Pull comp set (reuse existing set or generate on-the-fly with persisted criteria)
    // In backtest (asOf) mode: skip stored comp sets entirely — they contain
    // present-day data with no as-of guarantee — and generate a fresh set with
    // the as_of upper bound + dry_run (no DB persist).
    //
    // Task #1505: Use the pre-fetched sharedCompSet from compute() when available.
    // This avoids a duplicate INSERT race: both this method and computeSalesCompPPU
    // previously ran getCompSetByDeal + generateCompSet inside Promise.all, causing
    // two simultaneous INSERTs when no stored set existed — the second could complete
    // before the first's members were committed, leaving a ghost row.
    // Fall back to individual fetch/generate only when called outside of compute()
    // (e.g., direct API routes or scripts that bypass the shared pre-fetch).
    let compSet: any = sharedCompSet ?? null;
    if (!compSet || compSet.comp_count === 0 || !compSet.comps || compSet.comps.length === 0) {
      try {
        if (!asOf) {
          compSet = await compSetService.getCompSetByDeal(dealId);
        }
        if (!compSet || compSet.comp_count === 0 || !compSet.comps || compSet.comps.length === 0) {
          compSet = await compSetService.generateCompSet({
            deal_id: dealId,
            radius_miles: criteria.radiusMiles,
            date_range_months: COMP_RETRIEVAL_HORIZON_MONTHS,
            min_units: criteria.minUnits > 0 ? criteria.minUnits : undefined,
            max_units: criteria.maxUnits < 9999 ? criteria.maxUnits : undefined,
            property_classes: criteria.propertyClasses?.length ? criteria.propertyClasses : undefined,
            vintage_range: (criteria.minYearBuilt > 0 || criteria.maxYearBuilt < 9999)
              ? [criteria.minYearBuilt, criteria.maxYearBuilt] : undefined,
            ...(asOf ? { as_of: asOf, dry_run: true } : {}),
          });
        }
      } catch {
        // silent — comp set may fail without lat/lon
      }
    }

    if (!compSet || !compSet.comps || compSet.comps.length === 0) {
      return this.insufficientMethod(
        METHOD_ID,
        'Comp-Anchored Cap Rate',
        'bottom_up',
        'No sale comps available — comp set needed to derive market cap rate.',
        []
      );
    }

    // Task #1417 (6.1): Apply operator criteria as post-filters on the comp set
    // This ensures the panel and scoring use the same comp universe.
    const excludedSet = new Set<string>(criteria.excludedCompIds ?? []);

    // (a) Fetch any manually-added comps from market_sale_comps and append.
    //     Security: apply the same costar_upload / deal_id visibility guard used elsewhere.
    if (criteria.customIncludedCompIds.length > 0) {
      try {
        const customIds = criteria.customIncludedCompIds.filter(id => !compSet.comps.some((c: any) => String(c.id) === id));
        if (customIds.length > 0) {
          const customResult = await this.pool.query(
            `SELECT id, sale_date AS recording_date, address AS property_address,
                    units, sqft AS building_sf, year_built, asset_class AS property_class,
                    sale_price AS derived_sale_price, price_per_unit, price_per_sqft AS price_per_sf,
                    cap_rate AS implied_cap_rate, buyer, source, source_labels
             FROM market_sale_comps
             WHERE id = ANY($1::uuid[])
               AND (source != 'costar_upload' OR deal_id = $2::uuid OR deal_id IS NULL)`,
            [customIds, dealId]
          );
          const customComps = customResult.rows.map((r: any) => ({
            id: r.id,
            recording_date: r.recording_date,
            property_address: r.property_address,
            units: r.units ? parseInt(String(r.units)) : null,
            building_sf: r.building_sf ? parseFloat(String(r.building_sf)) : null,
            year_built: r.year_built,
            property_class: r.property_class ?? 'B',
            derived_sale_price: r.derived_sale_price ? parseFloat(String(r.derived_sale_price)) : 0,
            price_per_unit: r.price_per_unit ? parseFloat(String(r.price_per_unit)) : 0,
            price_per_sf: r.price_per_sf ? parseFloat(String(r.price_per_sf)) : 0,
            implied_cap_rate: r.implied_cap_rate ? parseFloat(String(r.implied_cap_rate)) : null,
            grantee_name: r.buyer ?? '',
            buyer_type: '',
            holding_period_months: null,
            distance_miles: 0,
            source: r.source ?? 'manual',
            source_labels: r.source_labels ?? null,
            relevance_tier: 'C2',
          }));
          compSet = { ...compSet, comps: [...compSet.comps, ...customComps] };
        }
      } catch {
        // non-fatal — custom add fails silently
      }
    }

    // (b) Apply operator exclusions
    const effectiveComps = compSet.comps.filter((c: any) => !excludedSet.has(String(c.id)));
    if (excludedSet.size > 0 && effectiveComps.length < compSet.comps.length) {
      const removedCount = compSet.comps.length - effectiveComps.length;
      warnings.push(`${removedCount} comp${removedCount !== 1 ? 's' : ''} excluded by operator override.`);
    }

    // (c) Apply unit count, vintage band, and class filters.
    //     Custom-added comp IDs bypass criteria — operator explicitly requested them.
    const customSet = new Set<string>(criteria.customIncludedCompIds ?? []);
    const allClasses = ['A', 'B', 'C', 'D'];
    const classFilter = criteria.propertyClasses ?? allClasses;
    const applyClassFilter = classFilter.length > 0 && classFilter.length < allClasses.length;
    const criteriaComps = effectiveComps.filter((c: any) => {
      if (customSet.has(String(c.id))) return true;  // operator-added: always include
      const u = c.units != null ? parseInt(String(c.units)) : null;
      if (u != null) {
        if (criteria.minUnits > 0 && u < criteria.minUnits) return false;
        if (criteria.maxUnits < 9999 && u > criteria.maxUnits) return false;
      }
      const yb = c.year_built != null ? parseInt(String(c.year_built)) : null;
      if (yb != null) {
        if ((criteria.minYearBuilt ?? 0) > 0 && yb < criteria.minYearBuilt) return false;
        if ((criteria.maxYearBuilt ?? 9999) < 9999 && yb > criteria.maxYearBuilt) return false;
      }
      if (applyClassFilter) {
        const pc = (c.property_class ?? c.asset_class ?? '').toUpperCase();
        if (pc && !classFilter.map(s => s.toUpperCase()).includes(pc)) return false;
      }
      return true;
    });

    if (criteriaComps.length === 0) {
      return this.insufficientMethod(
        METHOD_ID,
        'Comp-Anchored Cap Rate',
        'bottom_up',
        criteriaComps.length === 0 && effectiveComps.length > 0
          ? 'All comps filtered by unit count or property class criteria. Adjust criteria in Comp Review.'
          : 'All comps excluded by operator. Re-include comps in the Comp Review panel.',
        warnings
      );
    }

    // Wave B: Apply relevance scoring. Score every criteria-passing comp against
    // the subject, assign relevance_tier + relevance_score, then filter to M1+
    // (score >= RELEVANCE_MIN_SCORE = 0.25) for active cap-rate synthesis.
    // Custom-added comps bypass the threshold (operator explicitly requested them).
    const { filteredComps: relevanceComps, relevanceFilteredCount: capRateRelevanceRemovedCount } =
      this._applyRelevanceScoring(criteriaComps, subject, strategy, customSet);

    const activeCapRateComps = relevanceComps.length > 0 ? relevanceComps : criteriaComps;
    if (relevanceComps.length === 0 && criteriaComps.length > 0) {
      warnings.push(
        `All ${criteriaComps.length} criteria-passing comps scored below the relevance threshold ` +
        `(M2 tier). Using full criteria set for synthesis.`
      );
    } else if (capRateRelevanceRemovedCount > 0) {
      warnings.push(
        `${capRateRelevanceRemovedCount} comp${capRateRelevanceRemovedCount !== 1 ? 's' : ''} below ` +
        `relevance threshold (M2 tier) excluded from cap-rate synthesis.`
      );
    }

    compSet = { ...compSet, comps: activeCapRateComps };

    // Market snapshot for synthesis of comps without cap_rate
    const snap = await this.getMarketSnapshotForSynthesis(subject.city, subject.state, asOf);
    const snapAvgRent = snap?.avgRent ?? 1250;
    const snapAvgOcc  = snap?.avgOccupancy && snap.avgOccupancy > 0 ? snap.avgOccupancy : 0.93;
    const SYNTH_OPEX  = 0.42;

    // Quality-tier multipliers: C1 (primary, arm's-length, close) → M2 (peripheral)
    const TIER_FACTOR: Record<string, number> = { C1: 1.00, C2: 0.80, M1: 0.60, M2: 0.40 };

    // Use asOf as the reference point for staleness so historical backtests
    // score comp recency relative to the acquisition date, not today.
    const now = asOf ? asOf.getTime() : Date.now();
    // Task #1417 (6.2): Use operator-configured max age (default 36 months)
    const maxCompAgeMonths = criteria.maxAgeMonths ?? MAX_COMP_AGE_MONTHS_DEFAULT;

    interface WeightedCap {
      rate: number;
      weight: number;
      synthesized: boolean;
      tier: string;
      sw: number;
      tierFactor: number;
      label: string;
      ageMonths: number;
    }
    const weightedCaps: WeightedCap[] = [];
    let directCount = 0;
    let synthesizedCount = 0;
    let staleCount = 0;

    for (const comp of compSet.comps) {
      const saleDate = comp.recording_date ? new Date(comp.recording_date).getTime() : 0;
      const ageMonths = saleDate > 0 ? (now - saleDate) / (1000 * 60 * 60 * 24 * 30.44) : 999;

      // Staleness weight (Task #1417 6.2 — uses maxAgeMonths from operator criteria)
      const sw = stalenessWeight(ageMonths, maxCompAgeMonths);
      if (stalenessLabel(ageMonths, maxCompAgeMonths) === 'stale') staleCount++;

      // Quality-tier weight from comp relevance scoring (C1 > C2 > M1 > M2)
      const tier: string = (comp as any).relevance_tier ?? 'M2';
      const tierFactor = TIER_FACTOR[tier] ?? 0.40;
      const weight = sw * tierFactor;

      let capRate: number;
      let synthesized = false;

      const rawCapRate = safeFloat(comp.implied_cap_rate, 0);
      if (rawCapRate > 0) {
        capRate = rawCapRate;
        directCount++;
      } else {
        // Synthesize: NOI = avgRent × units × 12 × occupancy × (1 - opexRatio)
        const compUnits = safeFloat(comp.units, 0);
        const salePrice = safeFloat(comp.derived_sale_price, 0);
        if (compUnits <= 0 || salePrice <= 0) continue;
        const synthNOI = snapAvgRent * compUnits * 12 * snapAvgOcc * (1 - SYNTH_OPEX);
        capRate = synthNOI / salePrice;
        synthesized = true;
        synthesizedCount++;
      }

      // Sanity bounds: 2% – 20%
      if (capRate < 0.02 || capRate > 0.20) continue;

      const compLabel = (comp as any).property_address ?? comp.id ?? 'unknown';
      weightedCaps.push({ rate: capRate, weight, synthesized, tier, sw, tierFactor, label: compLabel, ageMonths });
    }

    // Minimum 3 valid data points required for a reliable cap rate band
    if (weightedCaps.length < 3) {
      return this.insufficientMethod(
        METHOD_ID,
        'Comp-Anchored Cap Rate',
        'bottom_up',
        `Insufficient cap rate data from comp set (${weightedCaps.length} valid data points — need ≥3).`,
        synthesizedCount > 0
          ? [`${synthesizedCount} of ${compSet.comps.length} comps had no reported cap rate and were synthesized using market averages (avg_rent=$${snapAvgRent.toFixed(0)}, occ=${(snapAvgOcc * 100).toFixed(0)}%).`]
          : []
      );
    }

    // Weighted percentile helper (weight = staleness × tier factor)
    const sorted = [...weightedCaps].sort((a, b) => a.rate - b.rate);
    const totalWeight = sorted.reduce((s, x) => s + x.weight, 0);
    const weightedPercentile = (p: number): number => {
      const target = p * totalWeight;
      let cumWeight = 0;
      for (const item of sorted) {
        cumWeight += item.weight;
        if (cumWeight >= target) return item.rate;
      }
      return sorted[sorted.length - 1].rate;
    };

    const capP25 = weightedPercentile(0.25);
    const capP50 = weightedPercentile(0.50);
    const capP75 = weightedPercentile(0.75);

    // Value = NOI / cap_rate  (higher cap → lower value)
    const noi = subject.noi!;
    const valP25 = noi / capP75;
    const valP50 = noi / capP50;
    const valP75 = noi / capP25;

    const ppu50 = subject.units ? valP50 / subject.units : null;
    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;

    const n = weightedCaps.length;
    const fmtCap = (v: number) => `${(v * 100).toFixed(2)}%`;

    // Aggregate evidence lines
    evidence.push(
      { label: 'Stabilized NOI', value: fmt$(noi), source: subject.noiSource },
      { label: 'Comp Pool', value: `${n} data points (${directCount} direct, ${synthesizedCount} synthesized)` },
      { label: 'Implied Cap P25', value: fmtCap(capP25), source: 'market_sale_comps' },
      { label: 'Implied Cap P50', value: fmtCap(capP50), source: 'market_sale_comps' },
      { label: 'Implied Cap P75', value: fmtCap(capP75), source: 'market_sale_comps' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    // Per-comp detail: implied cap rate, composite weight, tier (for UI breakdown + audit)
    for (const wc of sorted) {
      const slabel = stalenessLabel(wc.ageMonths, maxCompAgeMonths);
      evidence.push({
        label: `Comp: ${wc.label}`,
        value: `${fmtCap(wc.rate)} | wt=${wc.weight.toFixed(2)} (stale=${wc.sw.toFixed(2)}×tier=${wc.tierFactor.toFixed(2)}) | ${wc.synthesized ? 'synthesized' : 'direct'} | ${wc.tier} | ${slabel}${slabel === 'stale' ? ' ⚠' : ''}`,
        source: 'market_sale_comps',
      });
    }

    // Staleness warnings (Task #1417 6.2)
    if (staleCount > 0) {
      const pct = Math.round(staleCount / n * 100);
      warnings.push(
        `${staleCount} of ${n} comps (${pct}%) are older than ${maxCompAgeMonths} months and flagged as stale. ` +
        `These receive a 50% weight haircut in cap rate synthesis.`
      );
    }
    if (synthesizedCount > 0) {
      warnings.push(
        `${synthesizedCount} of ${n} data points were synthesized (no reported cap rate). ` +
        `Synthesis used market avg rent $${snapAvgRent.toFixed(0)}/mo and ${(snapAvgOcc * 100).toFixed(0)}% occupancy — verify against actuals.`
      );
    }
    if (n < 5) {
      warnings.push(`Thin comp pool (n=${n}) — cap rate band may not represent the submarket. Consider widening radius.`);
    }

    // Cap rate spread in basis points (P75 - P25)
    const capRateSpreadBps = Math.round((capP75 - capP25) * 10000);

    // Confidence: base on direct-cap-rate count (synthesized penalised, tier-weighted)
    const effectiveN = directCount + synthesizedCount * 0.5;
    const confidence: ConfidenceLevel =
      effectiveN >= 10 ? this.compConfidence(n, subject.state, subject.city)
      : effectiveN >= 5  ? 'MEDIUM'
      : effectiveN >= 3  ? 'LOW'
      : 'INSUFFICIENT';

    return {
      id: METHOD_ID,
      label: 'Comp-Anchored Cap Rate',
      direction: 'bottom_up',
      status: confidence === 'INSUFFICIENT' ? 'insufficient' : 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: ppu50,
      indicatedPSF: psf50,
      compCount: n,
      staleCompCount: staleCount,
      capRateSpreadBps,
      relevanceFilteredCount: capRateRelevanceRemovedCount,
      sourceProvenance: `${n} sale comp implied cap rates (${directCount} direct, ${synthesizedCount} synthesized)`,
      evidenceTrail: evidence,
      warningFlags: warnings,
    };
    })(); // end legacy IIFE

    // Shadow: legacy has already served — now fire-and-forget Phase 5 query and log
    // true old (legacy cap rate) vs new (property_sales cap rate) for divergence analysis.
    if (!asOf && subject.latitude && subject.longitude && shouldRunShadow(valuationCompsFlag)) {
      const subjectNoi = subject.noi;
      propertySalesService.getMarketCapRateDistribution({
        lat: subject.latitude,
        lng: subject.longitude,
        radiusMiles: Math.max(criteria.radiusMiles, 25),
        monthsBack: criteria.maxAgeMonths ?? MAX_COMP_AGE_MONTHS_DEFAULT,
        // Unit filters intentionally omitted: property_sales properties lack units data
        // (same treatment as the active Phase 5 path at line ~675).
      }).then(dist => {
        const legacyCapP50 = subjectNoi && legacyResult.indicatedValueP50
          ? subjectNoi / legacyResult.indicatedValueP50
          : null;
        return phase3ShadowService.logBatch('valuation_comps', dealId, {
          p50_cap_rate:  { old: legacyCapP50,                    new: dist?.p50  ?? null },
          comp_count:    { old: legacyResult.compCount ?? null,  new: dist?.n    ?? null },
          method_status: { old: legacyResult.status,             new: dist && dist.n >= 3 ? 'active' : 'insufficient' },
        });
      }).catch(() => {});
    }

    return legacyResult;
  }

  // ── Method 2: Per-Unit Benchmark ─────────────────────────────────────────

  private async computePerUnitBenchmark(subject: SubjectProperty, asOf?: Date): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'per_unit_benchmark';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.units) {
      return this.insufficientMethod(
        METHOD_ID,
        'Per-Unit Benchmark',
        'top_down',
        'Unit count not available for this deal.',
        []
      );
    }

    const params: unknown[] = ['price_per_unit'];
    const whereClauses: string[] = [`assumption_name = $1`];

    if (subject.assetClass) {
      params.push(subject.assetClass);
      whereClauses.push(`(asset_class = $${params.length} OR asset_class IS NULL)`);
    }

    if (subject.submarket) {
      params.push(subject.submarket);
      whereClauses.push(`(submarket_id = $${params.length} OR submarket_id IS NULL)`);
    }

    if (asOf) {
      params.push(asOf);
      whereClauses.push(`as_of <= $${params.length}`);
    }

    const benchmarkQuery = await this.pool.query(
      `SELECT p25, p50, p75, n_samples, as_of, submarket_id
       FROM archive_assumption_benchmarks
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY
         (CASE WHEN submarket_id IS NOT NULL THEN 0 ELSE 1 END),
         as_of DESC
       LIMIT 1`,
      params
    );

    if (benchmarkQuery.rows.length === 0 || benchmarkQuery.rows[0].p50 == null) {
      return this.insufficientMethod(
        METHOD_ID,
        'Per-Unit Benchmark',
        'top_down',
        `No archive PPU data for ${subject.assetClass || 'multifamily'} in ${subject.city}. Data accumulates as platform deals close.`,
        []
      );
    }

    const row = benchmarkQuery.rows[0];
    const p25 = safeFloat(row.p25);
    const p50 = safeFloat(row.p50);
    const p75 = safeFloat(row.p75);
    const n = safeFloat(row.n_samples);

    const valP25 = p25 * subject.units;
    const valP50 = p50 * subject.units;
    const valP75 = p75 * subject.units;

    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;
    const scope = row.submarket_id ? `${row.submarket_id} submarket` : `${subject.city} market`;

    if (n < 5) {
      warnings.push(`Very sparse archive (n=${n}) — per-unit benchmark is indicative only.`);
    } else if (n < 10) {
      warnings.push(`Sparse archive sample (n=${n}, ${scope}) — use with caution.`);
    }

    evidence.push(
      { label: 'Archive PPU P25', value: fmtPPU(p25), source: 'archive_assumption_benchmarks' },
      { label: 'Archive PPU P50', value: fmtPPU(p50), source: 'archive_assumption_benchmarks' },
      { label: 'Archive PPU P75', value: fmtPPU(p75), source: 'archive_assumption_benchmarks' },
      { label: 'Sample Size', value: `n=${n}` },
      { label: 'As Of', value: row.as_of?.toISOString?.()?.slice(0, 10) ?? 'unknown' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    const confidence = this.archiveConfidence(n, subject.state, subject.city);

    return {
      id: METHOD_ID,
      label: 'Per-Unit Benchmark',
      direction: 'top_down',
      status: confidence === 'INSUFFICIENT' ? 'insufficient' : 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: p50,
      indicatedPSF: psf50,
      sampleSize: n,
      sourceProvenance: `Archive benchmark — ${scope} (n=${n})`,
      evidenceTrail: evidence,
      warningFlags: warnings,
    };
  }

  // ── Method 3: Sales Comp PPU ──────────────────────────────────────────────

  private async computeSalesCompPPU(
    dealId: string,
    subject: SubjectProperty,
    criteria: CompCriteria,
    asOf?: Date,
    sharedCompSet?: any,
    strategy: InvestmentStrategy = 'stabilized'
  ): Promise<ValuationMethod & { _compSetRaw?: any }> {
    const METHOD_ID: MethodId = 'sales_comp_ppu';
    const warnings: string[] = [];
    const evidence: EvidenceLine[] = [];

    if (!subject.units) {
      return {
        ...this.insufficientMethod(
          METHOD_ID,
          'Sales Comp PPU',
          'top_down',
          'Unit count not available — cannot derive value from PPU comps.',
          []
        ),
        _compSetRaw: null,
      };
    }

    if (!subject.latitude || !subject.longitude) {
      warnings.push('Property coordinates not available — comp set uses city-level filter (less precise).');
    }

    // In backtest (asOf) mode: bypass stored comp sets (no as-of guarantee) and
    // generate a fresh as-of filtered set in dry-run mode (no DB persist).
    //
    // Task #1505: Use the pre-fetched sharedCompSet from compute() when available.
    // See computeCompAnchoredCapRate for the full race-condition explanation.
    // Fall back to individual fetch/generate only when called outside of compute().
    let compSet: any = sharedCompSet ?? null;
    if (!compSet || compSet.comp_count === 0 || !compSet.comps || compSet.comps.length === 0) {
      try {
        if (!asOf) {
          compSet = await compSetService.getCompSetByDeal(dealId);
        }
        if (!compSet || compSet.comp_count === 0 || !compSet.comps || compSet.comps.length === 0) {
          compSet = await compSetService.generateCompSet({
            deal_id: dealId,
            radius_miles: criteria.radiusMiles,
            date_range_months: COMP_RETRIEVAL_HORIZON_MONTHS,
            min_units: criteria.minUnits > 0 ? criteria.minUnits : undefined,
            max_units: criteria.maxUnits < 9999 ? criteria.maxUnits : undefined,
            property_classes: criteria.propertyClasses?.length ? criteria.propertyClasses : undefined,
            vintage_range: (criteria.minYearBuilt > 0 || criteria.maxYearBuilt < 9999)
              ? [criteria.minYearBuilt, criteria.maxYearBuilt] : undefined,
            ...(asOf ? { as_of: asOf, dry_run: true } : {}),
          });
        }
      } catch {
        // Silent fail — comp set generation may fail if no lat/lon
      }
    }

    if (!compSet || compSet.comp_count === 0) {
      return {
        ...this.insufficientMethod(
          METHOD_ID,
          'Sales Comp PPU',
          'top_down',
          'No sale comps available within search radius. Widen radius or add comps manually.',
          []
        ),
        _compSetRaw: null,
      };
    }

    // Task #1417 (6.1): Merge any manually-added comps (customIncludedCompIds) into the
    // comp set before the criteria filter chain — mirrors computeCompAnchoredCapRate logic.
    if (criteria.customIncludedCompIds.length > 0) {
      try {
        const ppuCustomIds = criteria.customIncludedCompIds.filter(
          id => !compSet.comps.some((c: any) => String(c.id) === id)
        );
        if (ppuCustomIds.length > 0) {
          const ppuCustomResult = await this.pool.query(
            `SELECT id, sale_date AS recording_date, address AS property_address,
                    units, sqft AS building_sf, year_built, asset_class AS property_class,
                    sale_price AS derived_sale_price, price_per_unit, price_per_sqft AS price_per_sf,
                    cap_rate AS implied_cap_rate, buyer, source
             FROM market_sale_comps
             WHERE id = ANY($1::uuid[])
               AND (source != 'costar_upload' OR deal_id = $2::uuid OR deal_id IS NULL)`,
            [ppuCustomIds, dealId]
          );
          const ppuCustomComps = ppuCustomResult.rows.map((r: any) => ({
            id: r.id,
            recording_date: r.recording_date,
            property_address: r.property_address,
            units: r.units ? parseInt(String(r.units)) : null,
            building_sf: r.building_sf ? parseFloat(String(r.building_sf)) : null,
            year_built: r.year_built,
            property_class: r.property_class ?? 'B',
            derived_sale_price: r.derived_sale_price ? parseFloat(String(r.derived_sale_price)) : 0,
            price_per_unit: r.price_per_unit ? parseFloat(String(r.price_per_unit)) : 0,
            price_per_sf: r.price_per_sf ? parseFloat(String(r.price_per_sf)) : 0,
            implied_cap_rate: r.implied_cap_rate ? parseFloat(String(r.implied_cap_rate)) : null,
            grantee_name: r.buyer ?? '',
            buyer_type: '',
            holding_period_months: null,
            distance_miles: 0,
            source: r.source ?? 'manual',
            relevance_tier: 'C2',
          }));
          compSet = { ...compSet, comps: [...compSet.comps, ...ppuCustomComps] };
        }
      } catch {
        // non-fatal
      }
    }

    // Task #1417 (6.1): Apply operator criteria to comp set before PPU synthesis.
    // Custom-added comp IDs bypass criteria — operator explicitly requested them.
    // This mirrors the same filter chain used in computeCompAnchoredCapRate to ensure
    // the panel and both scoring methods use an identical comp universe.
    if (compSet.comps && compSet.comps.length > 0) {
      const excludedSet = new Set<string>(criteria.excludedCompIds ?? []);
      const ppuCustomSet = new Set<string>(criteria.customIncludedCompIds ?? []);
      const allClassesPPU = ['A', 'B', 'C', 'D'];
      const classFilterPPU = criteria.propertyClasses ?? allClassesPPU;
      const applyClassFilterPPU = classFilterPPU.length > 0 && classFilterPPU.length < allClassesPPU.length;

      const filteredComps = compSet.comps.filter((c: any) => {
        if (excludedSet.has(String(c.id))) return false;
        if (ppuCustomSet.has(String(c.id))) return true;  // operator-added: always include
        const u = c.units != null ? parseInt(String(c.units)) : null;
        if (u != null) {
          if (criteria.minUnits > 0 && u < criteria.minUnits) return false;
          if (criteria.maxUnits < 9999 && u > criteria.maxUnits) return false;
        }
        const yb = c.year_built != null ? parseInt(String(c.year_built)) : null;
        if (yb != null) {
          if ((criteria.minYearBuilt ?? 0) > 0 && yb < criteria.minYearBuilt) return false;
          if ((criteria.maxYearBuilt ?? 9999) < 9999 && yb > criteria.maxYearBuilt) return false;
        }
        if (applyClassFilterPPU) {
          const pc = (c.property_class ?? c.asset_class ?? '').toUpperCase();
          if (pc && !classFilterPPU.map(s => s.toUpperCase()).includes(pc)) return false;
        }
        return true;
      });

      const removedCount = compSet.comps.length - filteredComps.length;
      if (removedCount > 0) {
        warnings.push(`${removedCount} comp${removedCount !== 1 ? 's' : ''} removed by operator criteria (exclusions, units, or class filter).`);
      }
      if (removedCount > 0 || filteredComps.length < compSet.comps.length) {
        compSet = { ...compSet, comps: filteredComps };
      }
    }

    // Wave B: Apply relevance scoring to the criteria-filtered comp pool.
    // Scores each comp against the subject using six factors (distance, recency,
    // class, size, vintage, data quality), then filters to M1+ comps for PPU synthesis.
    let ppuRelevanceRemovedCount = 0;
    if (compSet.comps && compSet.comps.length > 0) {
      const ppuCustomSet = new Set<string>(criteria.customIncludedCompIds ?? []);
      const { filteredComps: relevancePPUComps, relevanceFilteredCount } =
        this._applyRelevanceScoring(compSet.comps, subject, strategy, ppuCustomSet);

      ppuRelevanceRemovedCount = relevanceFilteredCount;
      const activePPUComps = relevancePPUComps.length > 0 ? relevancePPUComps : compSet.comps;

      if (relevancePPUComps.length === 0 && compSet.comps.length > 0) {
        warnings.push(
          `All ${compSet.comps.length} criteria-passing comps scored below the relevance threshold. Using full set.`
        );
      } else if (ppuRelevanceRemovedCount > 0) {
        warnings.push(
          `${ppuRelevanceRemovedCount} comp${ppuRelevanceRemovedCount !== 1 ? 's' : ''} below relevance threshold (M2) excluded from PPU synthesis.`
        );
      }

      // Recompute PPU stats from the relevance-filtered comp set
      const ppuValues = activePPUComps
        .map((c: any) => safeFloat(c.price_per_unit, 0))
        .filter((v: number) => v > 0)
        .sort((a: number, b: number) => a - b);

      if (ppuValues.length > 0) {
        const medianIdx = Math.floor(ppuValues.length / 2);
        const medianVal = ppuValues[medianIdx];
        const meanVal = ppuValues.reduce((s: number, v: number) => s + v, 0) / ppuValues.length;
        const stdDevVal = Math.sqrt(
          ppuValues.reduce((s: number, v: number) => s + (v - meanVal) ** 2, 0) / ppuValues.length
        );
        compSet = {
          ...compSet,
          comps: activePPUComps,
          comp_count: activePPUComps.length,
          median_price_per_unit: medianVal,
          std_dev_price_per_unit: stdDevVal,
          min_price_per_unit: ppuValues[0],
          max_price_per_unit: ppuValues[ppuValues.length - 1],
        };
      }
    }

    const medianPPU = safeFloat(compSet.median_price_per_unit);
    const stdDevPPU = safeFloat(compSet.std_dev_price_per_unit, medianPPU * 0.1);
    const compCount = safeFloat(compSet.comp_count);

    // P25/P75 via normal approximation (median ± 0.675σ)
    const ppuP25 = Math.max(0, medianPPU - 0.675 * stdDevPPU);
    const ppuP75 = medianPPU + 0.675 * stdDevPPU;

    const valP25 = ppuP25 * subject.units;
    const valP50 = medianPPU * subject.units;
    const valP75 = ppuP75 * subject.units;
    const psf50 = subject.totalSF ? valP50 / subject.totalSF : null;

    if (compCount < 5) {
      warnings.push(`Thin comp pool (n=${compCount}) — consider widening radius or vintage band.`);
    }
    if (!subject.submarket) {
      warnings.push('Submarket not assigned — comp set may include dissimilar-area transactions.');
    }

    evidence.push(
      { label: 'Comp Count', value: String(compCount) },
      { label: 'Median PPU', value: fmtPPU(medianPPU), source: 'market_sale_comps' },
      { label: 'PPU Range', value: `${fmtPPU(compSet.min_price_per_unit)} – ${fmtPPU(compSet.max_price_per_unit)}` },
      { label: 'Std Dev PPU', value: fmtPPU(stdDevPPU) },
      { label: 'Subject Percentile', value: compSet.subject_percentile != null ? `P${compSet.subject_percentile}` : '—' },
      { label: 'Indicated Value P50', value: fmt$(valP50) }
    );

    const confidence = this.compConfidence(compCount, subject.state, subject.city);

    return {
      id: METHOD_ID,
      label: 'Sales Comp PPU',
      direction: 'top_down',
      status: 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: medianPPU,
      indicatedPSF: psf50,
      compCount,
      relevanceFilteredCount: ppuRelevanceRemovedCount,
      sourceProvenance: `${compCount} market sale comps`,
      evidenceTrail: evidence,
      warningFlags: warnings,
      _compSetRaw: compSet,
    } as any;
  }

  // ── Method 3b: Sales Comp PSF ─────────────────────────────────────────────
  //
  // Computes PSF indicated value from individual comps that pass three gates:
  //   1. Sqft validity  — comp must have a plausible total_sf and SF/unit ratio
  //   2. Similarity     — year built ±20 yrs, unit count ×0.4–2.5, class match/adjacent
  //   3. Stories        — optional ±3 stories filter when both subject and comp have data
  //
  // The pre-aggregated median_price_per_sf stored on the comp set is NOT used here
  // because it is computed before any filtering and can be severely distorted by
  // comps with sparse or incorrect sqft data. Instead this method recomputes PSF
  // from each comp's derived_sale_price ÷ building_sf after the gates are applied.
  // Requires ≥3 valid comps; degrades to INSUFFICIENT otherwise.

  private computeSalesCompPSF(
    ppuMethod: ValuationMethod & { _compSetRaw?: any },
    subject: SubjectProperty
  ): ValuationMethod | null {
    if (!subject.totalSF) return null;

    const compSet = (ppuMethod as any)._compSetRaw;
    const comps: any[] = compSet?.comps ?? [];
    if (!compSet || comps.length === 0) return null;

    const warnings: string[] = [];
    let sqftExcluded = 0;
    let similarityExcluded = 0;
    let storiesExcluded = 0;

    // Class adjacency: a comp class must be the same as or one step away from subject.
    const CLASS_ADJACENT: Record<string, string[]> = {
      A: ['A', 'B'],
      B: ['A', 'B', 'C'],
      C: ['B', 'C', 'D'],
      D: ['C', 'D'],
    };

    const psfValues: number[] = [];

    for (const c of comps) {
      const salePrice = safeFloat(c.derived_sale_price, 0);
      const compSF    = safeFloat(c.building_sf, 0);

      // ── Gate 1: sqft validity ──────────────────────────────────────────────
      if (salePrice <= 0 || compSF <= 0) { sqftExcluded++; continue; }
      // Implausible total sqft: below 500 SF (single-family noise) or above 1M SF
      if (compSF < 500 || compSF > 1_000_000) { sqftExcluded++; continue; }

      const psf = salePrice / compSF;
      // Implausible PSF for multifamily (< $10 or > $5,000/SF)
      if (psf < 10 || psf > 5_000) { sqftExcluded++; continue; }

      // Implausible SF/unit ratio: < 200 SF/unit or > 2,500 SF/unit
      const compUnits = c.units != null ? parseInt(String(c.units), 10) : null;
      if (compUnits && compUnits > 0) {
        const sfPerUnit = compSF / compUnits;
        if (sfPerUnit < 200 || sfPerUnit > 2_500) { sqftExcluded++; continue; }
      }

      // ── Gate 2: similarity ─────────────────────────────────────────────────
      // Unit count: keep comps within [0.4×, 2.5×] of subject unit count
      if (subject.units && compUnits) {
        const ratio = compUnits / subject.units;
        if (ratio < 0.4 || ratio > 2.5) { similarityExcluded++; continue; }
      }

      // Year built: keep comps within ±20 years of subject
      const compYearBuilt = c.year_built != null ? parseInt(String(c.year_built), 10) : null;
      if (subject.yearBuilt && compYearBuilt) {
        if (Math.abs(compYearBuilt - subject.yearBuilt) > 20) { similarityExcluded++; continue; }
      }

      // Asset class: same class or one step adjacent (A↔B, B↔C, C↔D)
      const subjectClass = (subject.assetClass ?? '').toUpperCase().charAt(0);
      const compClass    = ((c.property_class ?? c.asset_class ?? '') as string).toUpperCase().charAt(0);
      if (subjectClass && compClass) {
        const allowed = CLASS_ADJACENT[subjectClass] ?? [subjectClass];
        if (!allowed.includes(compClass)) { similarityExcluded++; continue; }
      }

      // ── Gate 3: stories (optional) ─────────────────────────────────────────
      // Only applied when both subject and comp have stories data.
      const compStories    = c.stories != null ? parseInt(String(c.stories), 10) : null;
      const subjectStories = subject.stories;
      if (subjectStories && compStories) {
        if (Math.abs(compStories - subjectStories) > 3) { storiesExcluded++; continue; }
      }

      psfValues.push(psf);
    }

    if (sqftExcluded > 0) {
      warnings.push(`${sqftExcluded} comp${sqftExcluded !== 1 ? 's' : ''} excluded — missing or implausible sqft data.`);
    }
    if (similarityExcluded > 0) {
      warnings.push(`${similarityExcluded} comp${similarityExcluded !== 1 ? 's' : ''} excluded — outside size, vintage, or class similarity bands.`);
    }
    if (storiesExcluded > 0) {
      warnings.push(`${storiesExcluded} comp${storiesExcluded !== 1 ? 's' : ''} excluded — more than 3 stories different from subject.`);
    }

    // Require at least 3 PSF-valid comps to report a result
    if (psfValues.length < 3) {
      return {
        id: 'sales_comp_psf',
        label: 'Sales Comp PSF',
        direction: 'top_down',
        status: 'insufficient',
        confidence: 'INSUFFICIENT',
        indicatedValueP25: null,
        indicatedValueP50: null,
        indicatedValueP75: null,
        indicatedPPU: null,
        indicatedPSF: null,
        compCount: psfValues.length,
        sourceProvenance: 'Sales Comp PSF — insufficient sqft-valid comps',
        evidenceTrail: [
          { label: 'PSF-valid comps', value: String(psfValues.length) },
          { label: 'Status', value: `Need ≥3 comps with reliable sqft data; got ${psfValues.length}` },
        ],
        warningFlags: [
          ...warnings,
          `Only ${psfValues.length} comp${psfValues.length !== 1 ? 's' : ''} passed sqft and similarity gates — PSF method requires ≥3.`,
        ],
      };
    }

    // Compute median and empirical P25/P75 from filtered PSF values
    psfValues.sort((a, b) => a - b);
    const n         = psfValues.length;
    const medIdx    = Math.floor(n / 2);
    const medianPSF = n % 2 === 1
      ? psfValues[medIdx]
      : (psfValues[medIdx - 1] + psfValues[medIdx]) / 2;

    const p25PSF = psfValues[Math.max(0, Math.floor(n * 0.25))];
    const p75PSF = psfValues[Math.min(n - 1, Math.floor(n * 0.75))];

    const valP50 = medianPSF * subject.totalSF;
    const valP25 = p25PSF * subject.totalSF;
    const valP75 = p75PSF * subject.totalSF;
    const ppu    = subject.units ? valP50 / subject.units : null;

    const confidence = ppuMethod.confidence;

    return {
      id: 'sales_comp_psf',
      label: 'Sales Comp PSF',
      direction: 'top_down',
      status: 'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU: ppu,
      indicatedPSF: medianPSF,
      compCount: n,
      sourceProvenance: `${n} market sale comps (PSF, sqft-validated)`,
      evidenceTrail: [
        { label: 'PSF-valid comps', value: String(n), source: 'market_sale_comps' },
        { label: 'Median PSF', value: `$${medianPSF.toFixed(0)}/SF` },
        { label: 'PSF Range (P25–P75)', value: `$${p25PSF.toFixed(0)} – $${p75PSF.toFixed(0)}/SF` },
        { label: 'Subject Total SF', value: `${subject.totalSF.toLocaleString()} SF` },
        { label: 'Indicated Value P50', value: fmt$(valP50) },
      ],
      warningFlags: warnings,
    };
  }

  // ── Method 4: Operator Override ───────────────────────────────────────────

  private async computeOperatorOverride(
    dealId: string,
    subject: SubjectProperty
  ): Promise<ValuationMethod> {
    const result = await this.pool.query(
      `SELECT da.valuation_override_lv
       FROM deal_assumptions da
       WHERE da.deal_id = $1::uuid
       LIMIT 1`,
      [dealId]
    );

    const lv = result.rows[0]?.valuation_override_lv;
    const override = lv?.resolved ?? lv?.layers?.operator?.value ?? null;

    if (!override) {
      return this.insufficientMethod(
        'operator_override',
        'Operator Override',
        'manual',
        'No operator override set. Enter a value to anchor the reconciliation.',
        []
      );
    }

    const val = safeFloat(override);
    const ppu = subject.units ? val / subject.units : null;
    const psf = subject.totalSF ? val / subject.totalSF : null;

    return {
      id: 'operator_override',
      label: 'Operator Override',
      direction: 'manual',
      status: 'active',
      confidence: 'HIGH',
      indicatedValueP25: val,
      indicatedValueP50: val,
      indicatedValueP75: val,
      indicatedPPU: ppu,
      indicatedPSF: psf,
      sourceProvenance: 'Operator-entered value',
      evidenceTrail: [
        { label: 'Override Value', value: fmt$(val), source: 'operator' },
        ...(lv?.layers?.operator?.updatedAt
          ? [{ label: 'Set', value: new Date(lv.layers.operator.updatedAt).toLocaleDateString() }]
          : []),
      ],
      warningFlags: [],
    };
  }

  // ── Method 5: Replacement Cost ────────────────────────────────────────────

  private async computeReplacementCost(subject: SubjectProperty): Promise<ValuationMethod> {
    const METHOD_ID: MethodId = 'replacement_cost';
    const warnings: string[] = [];

    if (!subject.units || !subject.totalSF) {
      return this.insufficientMethod(
        METHOD_ID,
        'Replacement Cost',
        'cost',
        'Unit count and total SF required for replacement cost estimate.',
        []
      );
    }

    try {
      const rcService = getReplacementCostServiceV2(this.pool);
      const input: ReplacementCostInput = {
        units: subject.units,
        totalSF: subject.totalSF,
        city: subject.city,
        state: subject.state,
        assetClass: (subject.assetClass as any) || 'B',
      };

      const rc = await rcService.estimateReplacementCost(input);

      // Guard: if both the permit table and the data library contributed no real
      // data, the service falls back to a hardcoded $/SF default (185 class B,
      // 225 class A, 155 class C). That fabricated value inflates the reconciled
      // midpoint by 50–150%, poisoning every deal that lacks local permit data.
      // Return INSUFFICIENT rather than propagate a known-bad value.
      const hasRealPermitData = (rc.components?.permitBaseline?.sampleSize ?? 0) > 0;
      const hasDataLibraryData = (rc.costPerSF?.provenance ?? []).some(
        (p: { layer: string }) => p.layer === 'data_library'
      );
      const hasUserOverride = (rc.costPerSF?.provenance ?? []).some(
        (p: { layer: string }) => p.layer === 'user_override'
      );
      if (!hasRealPermitData && !hasDataLibraryData && !hasUserOverride) {
        return this.insufficientMethod(
          METHOD_ID,
          'Replacement Cost',
          'cost',
          'No local permit data available for this market. ' +
          'Upload cost data to the Data Library or install the building_permits table to enable this method.',
          []
        );
      }

      const cpsfVal = safeFloat(rc.costPerSF?.value, 0);
      const cpuVal = safeFloat(rc.costPerUnit?.value, 0);
      const totalCost = safeFloat(rc.totalCost?.value, 0);

      if (totalCost <= 0) throw new Error('Replacement cost estimate returned zero');

      // Add land value proxy (10–20% of improvement cost, typical multifamily)
      const landFraction = 0.15;
      const landValue = totalCost * landFraction;
      const indicatedValue = totalCost + landValue;

      const valP50 = indicatedValue;
      const valP25 = valP50 * 0.90;
      const valP75 = valP50 * 1.12;

      const ppu50 = valP50 / subject.units;
      const psf50 = valP50 / subject.totalSF;

      const confidence: ConfidenceLevel =
        rc.costPerSF?.confidence === 'high' ? 'HIGH'
        : rc.costPerSF?.confidence === 'medium' ? 'MEDIUM'
        : 'LOW';

      return {
        id: METHOD_ID,
        label: 'Replacement Cost',
        direction: 'cost',
        status: 'active',
        confidence,
        indicatedValueP25: valP25,
        indicatedValueP50: valP50,
        indicatedValueP75: valP75,
        indicatedPPU: ppu50,
        indicatedPSF: psf50,
        sourceProvenance: `ReplacementCostServiceV2 (${rc.costPerSF?.source ?? 'default'})`,
        evidenceTrail: [
          { label: 'Cost/SF', value: `$${cpsfVal.toFixed(0)}/SF`, source: rc.costPerSF?.source ?? 'estimate' },
          { label: 'Cost/Unit', value: `$${Math.round(cpuVal).toLocaleString()}/unit` },
          { label: 'Improvement Cost', value: fmt$(totalCost) },
          { label: 'Land Value (est.)', value: fmt$(landValue), source: 'flat 15% of improvements' },
          { label: 'Total Indicated', value: fmt$(indicatedValue) },
        ],
        warningFlags: warnings,
      };
    } catch (err: any) {
      return this.insufficientMethod(
        METHOD_ID,
        'Replacement Cost',
        'cost',
        `Replacement cost unavailable: ${err?.message ?? 'unknown error'}`,
        []
      );
    }
  }

  // ── Reconciliation engine ─────────────────────────────────────────────────

  private reconcile(
    methods: ValuationMethod[],
    subject: SubjectProperty
  ): ValuationGridResult['reconciliation'] {
    const activeMethods = methods.filter(
      m => m.status === 'active' && m.indicatedValueP50 != null && m.confidence !== 'INSUFFICIENT'
    );

    if (activeMethods.length === 0) {
      return {
        convergenceScore: 0,
        convergenceSignal: 'DIVERGENT',
        convergenceText: 'No active methods with sufficient data.',
        reconciledValue: null,
        reconciledPPU: null,
        reconciledPSF: null,
        recommendedPriceLow: null,
        recommendedPriceHigh: null,
        gapAnalysis: [],
        activeMethodCount: 0,
        valuationConfidence: 'INSUFFICIENT' as ConfidenceLevel,
        valuationConfidenceText: 'Insufficient data — no active valuation methods available.',
      };
    }

    const values = activeMethods.map(m => m.indicatedValueP50!);
    const mu = mean(values);
    const sd = stdDev(values);
    const convergenceScore = mu > 0 ? Math.max(0, 1 - sd / mu) : 0;

    const convergenceSignal: ConvergenceSignal =
      convergenceScore >= 0.90 ? 'CONVERGENT'
      : convergenceScore >= 0.80 ? 'MODERATE'
      : 'DIVERGENT';

    const spreadPct = mu > 0 ? ((sd * 2) / mu * 100).toFixed(0) : '—';
    const convergenceText =
      convergenceSignal === 'CONVERGENT'
        ? `Methods agree — P50 values within ${(100 - convergenceScore * 100).toFixed(0)}% of each other.`
        : convergenceSignal === 'MODERATE'
        ? `Methods show ${spreadPct}% spread — review gap analysis below.`
        : `High divergence (${spreadPct}% spread) — investigate drivers before committing to a price.`;

    // Confidence-weighted mean
    const totalWeight = activeMethods.reduce(
      (s, m) => s + CONFIDENCE_WEIGHT[m.confidence],
      0
    );
    const reconciledValue =
      totalWeight > 0
        ? activeMethods.reduce(
            (s, m) => s + m.indicatedValueP50! * CONFIDENCE_WEIGHT[m.confidence],
            0
          ) / totalWeight
        : mu;

    const reconciledPPU = subject.units ? reconciledValue / subject.units : null;
    const reconciledPSF = subject.totalSF ? reconciledValue / subject.totalSF : null;

    const recommendedPriceLow = Math.max(0, reconciledValue - 0.5 * sd);
    const recommendedPriceHigh = reconciledValue + 0.5 * sd;

    // Gap analysis: M1 vs M3 (main diagnostic pair) + M1b vs M1 (cap rate cross-check)
    const gapAnalysis: GapAnalysisItem[] = [];
    const m1 = activeMethods.find(m => m.id === 'cap_rate_noi');
    const m1b = activeMethods.find(m => m.id === 'comp_anchored_cap_rate');
    const m3 = activeMethods.find(m => m.id === 'sales_comp_ppu');
    const m2 = activeMethods.find(m => m.id === 'per_unit_benchmark');

    if (m1 && m3 && m3.indicatedValueP50) {
      const deltaPct = ((m1.indicatedValueP50! - m3.indicatedValueP50!) / m3.indicatedValueP50!) * 100;
      const absDelta = Math.abs(deltaPct);
      gapAnalysis.push({
        methodA: 'cap_rate_noi',
        methodB: 'sales_comp_ppu',
        labelA: 'Cap Rate × NOI',
        labelB: 'Sales Comp PPU',
        deltaPct,
        driverText: this.gapDriverText(m1, m3, subject, deltaPct),
        severity: absDelta < 10 ? 'info' : absDelta < 25 ? 'watch' : 'alert',
      });
    }

    // Comp-anchored cap rate vs archive-based cap rate — surfaces cap rate source divergence
    if (m1 && m1b && m1b.indicatedValueP50 && m1.indicatedValueP50) {
      const deltaPct = ((m1.indicatedValueP50! - m1b.indicatedValueP50!) / m1b.indicatedValueP50!) * 100;
      const absDelta = Math.abs(deltaPct);
      gapAnalysis.push({
        methodA: 'cap_rate_noi',
        methodB: 'comp_anchored_cap_rate',
        labelA: 'Cap Rate × NOI (Archive)',
        labelB: 'Comp-Anchored Cap Rate',
        deltaPct,
        driverText: `Archive benchmark (n=${m1.sampleSize ?? 0}) indicates ${fmt$(m1.indicatedValueP50)} vs comp-implied market cap rate (n=${m1b.compCount ?? 0} comps) at ${fmt$(m1b.indicatedValueP50)}. ` +
          (absDelta < 10 ? 'Rates converge — strong signal.' : absDelta < 25 ? 'Moderate divergence — review NOI margin vs market transactions.' : 'High divergence — investigate whether archive cap rates reflect current market conditions.'),
        severity: absDelta < 10 ? 'info' : absDelta < 25 ? 'watch' : 'alert',
      });
    }

    if (m2 && m3 && m3.indicatedValueP50) {
      const deltaPct = ((m2.indicatedValueP50! - m3.indicatedValueP50!) / m3.indicatedValueP50!) * 100;
      const absDelta = Math.abs(deltaPct);
      gapAnalysis.push({
        methodA: 'per_unit_benchmark',
        methodB: 'sales_comp_ppu',
        labelA: 'Per-Unit Benchmark',
        labelB: 'Sales Comp PPU',
        deltaPct,
        driverText: `Archive benchmark PPU (${fmtPPU(m2.indicatedPPU)}) vs comp set PPU (${fmtPPU(m3.indicatedPPU)}). Archive uses ${m2.sampleSize ?? 0} platform deals; comp set uses ${m3.compCount ?? 0} market transactions.`,
        severity: absDelta < 15 ? 'info' : absDelta < 30 ? 'watch' : 'alert',
      });
    }

    // ── Task #1417 (6.3): Valuation confidence propagation ───────────────────
    // Aggregate evidence from comp-based methods to derive an overall confidence
    // that reflects: comp count, tier quality, stale comp fraction, and cap rate spread.
    const valuationConfidence = this.computeValuationConfidence(activeMethods);
    const valuationConfidenceText = this.buildConfidenceText(activeMethods, valuationConfidence);

    return {
      convergenceScore,
      convergenceSignal,
      convergenceText,
      reconciledValue,
      reconciledPPU,
      reconciledPSF,
      recommendedPriceLow,
      recommendedPriceHigh,
      gapAnalysis,
      activeMethodCount: activeMethods.length,
      valuationConfidence,
      valuationConfidenceText,
    };
  }

  // ── Task #1417 (6.3): Confidence computation helpers ─────────────────────

  private computeValuationConfidence(activeMethods: ValuationMethod[]): ConfidenceLevel {
    if (activeMethods.length === 0) return 'INSUFFICIENT';

    // Use the minimum confidence across all active methods as the floor
    const confidenceLevels: ConfidenceLevel[] = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'];
    const minLevel = activeMethods.reduce<ConfidenceLevel>((worst, m) => {
      const wi = confidenceLevels.indexOf(worst);
      const mi = confidenceLevels.indexOf(m.confidence);
      return mi > wi ? m.confidence : worst;
    }, 'HIGH');

    let levelIdx = confidenceLevels.indexOf(minLevel);

    // Penalty: cap rate spread ≥ 300 bps → wider uncertainty → downgrade one level
    const compAnchoredMethod = activeMethods.find(m => m.id === 'comp_anchored_cap_rate');
    if (compAnchoredMethod?.capRateSpreadBps != null && compAnchoredMethod.capRateSpreadBps >= 300) {
      levelIdx = Math.min(levelIdx + 1, confidenceLevels.length - 1);
    }

    // Penalty: stale comp fraction ≥ 50% → downgrade one level
    const totalComps = compAnchoredMethod?.compCount ?? 0;
    const staleComps = compAnchoredMethod?.staleCompCount ?? 0;
    if (totalComps > 0 && staleComps / totalComps >= 0.5) {
      levelIdx = Math.min(levelIdx + 1, confidenceLevels.length - 1);
    }

    // Penalty: only 1 active method → downgrade one level (one method = low triangulation)
    if (activeMethods.length === 1) {
      levelIdx = Math.min(levelIdx + 1, confidenceLevels.length - 1);
    }

    return confidenceLevels[levelIdx];
  }

  private buildConfidenceText(activeMethods: ValuationMethod[], confidence: ConfidenceLevel): string {
    const parts: string[] = [];

    const compAnchoredMethod = activeMethods.find(m => m.id === 'comp_anchored_cap_rate');
    const salesCompPPU = activeMethods.find(m => m.id === 'sales_comp_ppu');

    const compCount = compAnchoredMethod?.compCount ?? salesCompPPU?.compCount ?? 0;
    if (compCount > 0) parts.push(`${compCount} comp${compCount !== 1 ? 's' : ''}`);

    if (compAnchoredMethod?.capRateSpreadBps != null) {
      parts.push(`cap rate spread: ${compAnchoredMethod.capRateSpreadBps}bps`);
    }

    const staleComps = compAnchoredMethod?.staleCompCount ?? 0;
    if (staleComps > 0) parts.push(`${staleComps} stale`);

    parts.push(`${activeMethods.length} method${activeMethods.length !== 1 ? 's' : ''}`);

    const detail = parts.join(', ');
    const label = {
      HIGH: 'Strong triangulation',
      MEDIUM: 'Moderate triangulation',
      LOW: 'Limited triangulation',
      INSUFFICIENT: 'Insufficient data',
    }[confidence];

    return `${label}${detail ? ` (${detail})` : ''}`;
  }

  // ── Gap analysis driver text ──────────────────────────────────────────────

  private gapDriverText(
    m1: ValuationMethod,
    m3: ValuationMethod,
    subject: SubjectProperty,
    deltaPct: number
  ): string {
    const dir = deltaPct > 0 ? 'above' : 'below';
    const absPct = Math.abs(deltaPct).toFixed(0);
    const ppuDiff = `Cap-rate method (${fmt$(m1.indicatedValueP50)}) is ${absPct}% ${dir} comp PPU (${fmt$(m3.indicatedValueP50)}).`;

    if (m1.sampleSize != null && m1.sampleSize < 10) {
      return `${ppuDiff} Cap rate derived from thin archive (n=${m1.sampleSize}) — widen to city-level for more data.`;
    }
    if (m3.compCount != null && m3.compCount < 5) {
      return `${ppuDiff} Comp pool is thin (n=${m3.compCount}) — transaction sample may not represent the submarket.`;
    }
    return `${ppuDiff} Review NOI margin and cap rate assumptions against comp set characteristics.`;
  }

  // ── GRM / GIM methods (CF-08 / CF-07) ───────────────────────────────────
  //
  // GRM: Gross Rent Multiplier = purchasePrice / GPR
  // GIM: Gross Income Multiplier = purchasePrice / EGI
  //
  // Phase 1 (this task): Subject's IMPLIED multiplier is computed and shown in
  // the evidence trail so operators can benchmark it against market multiples.
  // The method remains 'insufficient' because we have no comp GRM/GIM data yet
  // to derive a MARKET multiplier to apply to the subject's income.
  //
  // Phase 2 (future): when market_sale_comps carries gross_rent_annual /
  // gross_income_annual fields, the comp-pool median multiplier becomes available
  // and the method can produce an 'active' indicated value.
  //
  // GPR and EGI are resolved via the canonical getFieldValue chain (CF-08/CF-07):
  //   override > Engine A formula > agent > seeder stored resolved

  // ── GRM / GIM comp-pool query ─────────────────────────────────────────────
  //
  // Queries market_sale_comps for recent transactions that carry gross income
  // fields so we can compute market GRM / GIM distributions.
  // Uses a lat/lng bounding-box pre-filter (fast) followed by a Haversine
  // distance check.  Falls back to city+state when lat/lng is unavailable.

  private async fetchGrossIncomeComps(
    subject: SubjectProperty,
    criteria: CompCriteria,
    incomeField: 'gross_rent_annual' | 'gross_income_annual',
    asOf?: Date,
  ): Promise<Array<{ id: string; sale_price: number; income: number; units: number | null; sale_date: string }>> {
    const { latitude, longitude, city, state } = subject;
    const { radiusMiles, maxAgeMonths, excludedCompIds } = criteria;

    // Bounding box: 1° lat ≈ 69 mi; 1° lon ≈ 69 × cos(lat) mi
    const latDelta = radiusMiles / 69;
    const lonDelta = latitude != null
      ? radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180))
      : radiusMiles / 69;

    // Anchor age window to asOf (backtest) or wall-clock now (live)
    const ceiling = asOf ?? new Date();
    const cutoffDate = new Date(ceiling);
    cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths);

    const ceilingStr  = ceiling.toISOString().slice(0, 10);
    const cutoffStr   = cutoffDate.toISOString().slice(0, 10);

    let rows: any[];

    if (latitude != null && longitude != null) {
      const result = await this.pool.query(
        `SELECT
           id,
           sale_price::float8                     AS sale_price,
           ${incomeField}::float8                 AS income,
           units,
           sale_date::text                        AS sale_date,
           latitude::float8                       AS lat,
           longitude::float8                      AS lon
         FROM market_sale_comps
         WHERE sale_price > 0
           AND ${incomeField} > 0
           AND sale_date >= $1
           AND sale_date <= $2
           AND latitude  BETWEEN $3 AND $4
           AND longitude BETWEEN $5 AND $6
           AND ($7::uuid[] IS NULL OR id != ALL($7::uuid[]))
        `,
        [
          cutoffStr,
          ceilingStr,
          latitude - latDelta,
          latitude + latDelta,
          longitude - lonDelta,
          longitude + lonDelta,
          excludedCompIds.length ? excludedCompIds : null,
        ],
      );
      // Haversine distance check to keep only comps within radiusMiles
      rows = result.rows.filter(r => {
        const dLat = ((r.lat - latitude) * Math.PI) / 180;
        const dLon = ((r.lon - longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2
          + Math.cos((latitude * Math.PI) / 180)
          * Math.cos((r.lat * Math.PI) / 180)
          * Math.sin(dLon / 2) ** 2;
        const distMi = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return distMi <= radiusMiles;
      });
    } else {
      // Fallback: city + state match
      const result = await this.pool.query(
        `SELECT
           id,
           sale_price::float8   AS sale_price,
           ${incomeField}::float8 AS income,
           units,
           sale_date::text      AS sale_date
         FROM market_sale_comps
         WHERE sale_price > 0
           AND ${incomeField} > 0
           AND sale_date >= $1
           AND sale_date <= $2
           AND lower(city)  = lower($3)
           AND lower(state) = lower($4)
           AND ($5::uuid[] IS NULL OR id != ALL($5::uuid[]))
        `,
        [
          cutoffStr,
          ceilingStr,
          city,
          state,
          excludedCompIds.length ? excludedCompIds : null,
        ],
      );
      rows = result.rows;
    }

    return rows.map(r => ({
      id:        r.id,
      sale_price: safeFloat(r.sale_price),
      income:    safeFloat(r.income),
      units:     r.units != null ? safeFloat(r.units) : null,
      sale_date: r.sale_date ?? '',
    }));
  }

  // ── Percentile helper (simple, unweighted) ────────────────────────────────

  private pctile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  // ── GRM method ────────────────────────────────────────────────────────────

  private async computeGRM(
    dealId: string,
    subject: SubjectProperty,
    criteria: CompCriteria,
    asOf?: Date,
  ): Promise<ValuationMethod> {
    const { purchasePrice, gpr, gprSource } = subject;

    // Always compute the subject's implied GRM for the evidence trail
    const impliedGrm = (purchasePrice && gpr && gpr > 0)
      ? purchasePrice / gpr
      : null;

    if (!gpr || gpr <= 0) {
      return this.insufficientMethod(
        'grm',
        'GRM — Gross Rent Multiplier',
        'income',
        'GRM requires GPR (Year 1) — upload T-12 or rent roll.',
        ['GPR Year 1 not available — upload T-12 or rent roll'],
      );
    }

    // Attempt to fetch comp pool
    let comps: Awaited<ReturnType<typeof this.fetchGrossIncomeComps>> = [];
    try {
      comps = await this.fetchGrossIncomeComps(subject, criteria, 'gross_rent_annual', asOf);
    } catch (err) {
      logger.warn('GRM: comp fetch failed — falling back to insufficient', { err, dealId });
    }

    // Each comp's GRM = sale_price / gross_rent_annual
    const compGrms = comps
      .map(c => (c.income > 0 ? c.sale_price / c.income : null))
      .filter((v): v is number => v != null && isFinite(v) && v > 0);

    const MIN_COMPS = 3;

    if (compGrms.length < MIN_COMPS) {
      // Insufficient comp pool — return self-benchmarking view
      const trail: EvidenceLine[] = [
        { label: 'Gross Potential Rent (Y1)',  value: fmt$(gpr),           source: gprSource },
      ];
      if (purchasePrice) {
        trail.push({ label: 'Purchase Price',             value: fmt$(purchasePrice), source: 'deal_terms' });
      }
      if (impliedGrm != null) {
        trail.push({ label: 'Implied GRM (subject only)', value: `${impliedGrm.toFixed(2)}×` });
      }
      trail.push({ label: 'Market GRM source', value: `${compGrms.length} comp(s) found — need ≥${MIN_COMPS}` });

      return {
        id:              'grm',
        label:           'GRM — Gross Rent Multiplier',
        direction:       'income',
        status:          'insufficient',
        placeholderVersion: 'V1.0',
        confidence:      'INSUFFICIENT',
        indicatedValueP25: null,
        indicatedValueP50: null,
        indicatedValueP75: null,
        indicatedPPU:    null,
        indicatedPSF:    null,
        compCount:       compGrms.length,
        sourceProvenance: impliedGrm != null
          ? `Subject implied GRM: ${impliedGrm.toFixed(2)}×. Market comp pool has ${compGrms.length} comp(s) — need ≥${MIN_COMPS} with gross_rent_annual to produce market-anchored value.`
          : `Market comp pool has ${compGrms.length} comp(s) — need ≥${MIN_COMPS} with gross_rent_annual to produce market-anchored value.`,
        evidenceTrail: trail,
        warningFlags: [
          `Comp pool too thin (${compGrms.length}/${MIN_COMPS} required) — market-anchored GRM not available.`,
          ...(impliedGrm != null ? ['Implied GRM shown for self-benchmarking only.'] : []),
        ],
      };
    }

    // Compute GRM distribution
    compGrms.sort((a, b) => a - b);
    const grmP25 = this.pctile(compGrms, 0.25);
    const grmP50 = this.pctile(compGrms, 0.50);
    const grmP75 = this.pctile(compGrms, 0.75);

    // Indicated value = comp GRM × subject GPR
    // Higher GRM → higher value (no inversion needed, unlike cap rates)
    const valP25 = grmP25 * gpr;
    const valP50 = grmP50 * gpr;
    const valP75 = grmP75 * gpr;

    const ppu = subject.units && subject.units > 0 ? valP50 / subject.units : null;
    const psf = subject.totalSF && subject.totalSF > 0 ? valP50 / subject.totalSF : null;

    const confidence: ConfidenceLevel =
      compGrms.length >= 10 ? 'HIGH' :
      compGrms.length >= 5  ? 'MEDIUM' : 'LOW';

    const trail: EvidenceLine[] = [
      { label: 'Gross Potential Rent (Y1)',   value: fmt$(gpr),           source: gprSource },
      { label: 'Comp GRM P25',                value: `${grmP25.toFixed(2)}×` },
      { label: 'Comp GRM P50 (median)',        value: `${grmP50.toFixed(2)}×` },
      { label: 'Comp GRM P75',                value: `${grmP75.toFixed(2)}×` },
      { label: 'Indicated Value P50',          value: fmt$(valP50) },
      { label: 'Comp pool size',               value: `${compGrms.length} comps` },
    ];
    if (impliedGrm != null && purchasePrice) {
      trail.push({ label: 'Implied GRM (subject)',   value: `${impliedGrm.toFixed(2)}×` });
      trail.push({ label: 'Purchase Price',          value: fmt$(purchasePrice), source: 'deal_terms' });
    }

    return {
      id:                'grm',
      label:             'GRM — Gross Rent Multiplier',
      direction:         'income',
      status:            'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU:      ppu,
      indicatedPSF:      psf,
      compCount:         compGrms.length,
      sourceProvenance:  `Market GRM from ${compGrms.length} comp(s) in ${criteria.radiusMiles}mi radius (max ${criteria.maxAgeMonths}mo). Comp GRM P50: ${grmP50.toFixed(2)}× applied to subject GPR of ${fmt$(gpr)}.`,
      evidenceTrail:     trail,
      warningFlags:      [],
    };
  }

  // ── GIM method ────────────────────────────────────────────────────────────

  private async computeGIM(
    dealId: string,
    subject: SubjectProperty,
    criteria: CompCriteria,
    asOf?: Date,
  ): Promise<ValuationMethod> {
    const { purchasePrice, egi, egiSource } = subject;

    const impliedGim = (purchasePrice && egi && egi > 0)
      ? purchasePrice / egi
      : null;

    if (!egi || egi <= 0) {
      return this.insufficientMethod(
        'gim',
        'GIM — Gross Income Multiplier',
        'income',
        'GIM requires EGI (Year 1) — upload T-12 or rent roll.',
        ['EGI Year 1 not available — upload T-12 or rent roll'],
      );
    }

    let comps: Awaited<ReturnType<typeof this.fetchGrossIncomeComps>> = [];
    try {
      comps = await this.fetchGrossIncomeComps(subject, criteria, 'gross_income_annual', asOf);
    } catch (err) {
      logger.warn('GIM: comp fetch failed — falling back to insufficient', { err, dealId });
    }

    const compGims = comps
      .map(c => (c.income > 0 ? c.sale_price / c.income : null))
      .filter((v): v is number => v != null && isFinite(v) && v > 0);

    const MIN_COMPS = 3;

    if (compGims.length < MIN_COMPS) {
      const trail: EvidenceLine[] = [
        { label: 'Effective Gross Income (Y1)', value: fmt$(egi), source: egiSource },
      ];
      if (purchasePrice) {
        trail.push({ label: 'Purchase Price',            value: fmt$(purchasePrice), source: 'deal_terms' });
      }
      if (impliedGim != null) {
        trail.push({ label: 'Implied GIM (subject only)', value: `${impliedGim.toFixed(2)}×` });
      }
      trail.push({ label: 'Market GIM source', value: `${compGims.length} comp(s) found — need ≥${MIN_COMPS}` });

      return {
        id:              'gim',
        label:           'GIM — Gross Income Multiplier',
        direction:       'income',
        status:          'insufficient',
        placeholderVersion: 'V1.0',
        confidence:      'INSUFFICIENT',
        indicatedValueP25: null,
        indicatedValueP50: null,
        indicatedValueP75: null,
        indicatedPPU:    null,
        indicatedPSF:    null,
        compCount:       compGims.length,
        sourceProvenance: impliedGim != null
          ? `Subject implied GIM: ${impliedGim.toFixed(2)}×. Market comp pool has ${compGims.length} comp(s) — need ≥${MIN_COMPS} with gross_income_annual to produce market-anchored value.`
          : `Market comp pool has ${compGims.length} comp(s) — need ≥${MIN_COMPS} with gross_income_annual to produce market-anchored value.`,
        evidenceTrail: trail,
        warningFlags: [
          `Comp pool too thin (${compGims.length}/${MIN_COMPS} required) — market-anchored GIM not available.`,
          ...(impliedGim != null ? ['Implied GIM shown for self-benchmarking only.'] : []),
        ],
      };
    }

    compGims.sort((a, b) => a - b);
    const gimP25 = this.pctile(compGims, 0.25);
    const gimP50 = this.pctile(compGims, 0.50);
    const gimP75 = this.pctile(compGims, 0.75);

    const valP25 = gimP25 * egi;
    const valP50 = gimP50 * egi;
    const valP75 = gimP75 * egi;

    const ppu = subject.units && subject.units > 0 ? valP50 / subject.units : null;
    const psf = subject.totalSF && subject.totalSF > 0 ? valP50 / subject.totalSF : null;

    const confidence: ConfidenceLevel =
      compGims.length >= 10 ? 'HIGH' :
      compGims.length >= 5  ? 'MEDIUM' : 'LOW';

    const trail: EvidenceLine[] = [
      { label: 'Effective Gross Income (Y1)',  value: fmt$(egi),           source: egiSource },
      { label: 'Comp GIM P25',                 value: `${gimP25.toFixed(2)}×` },
      { label: 'Comp GIM P50 (median)',         value: `${gimP50.toFixed(2)}×` },
      { label: 'Comp GIM P75',                 value: `${gimP75.toFixed(2)}×` },
      { label: 'Indicated Value P50',           value: fmt$(valP50) },
      { label: 'Comp pool size',                value: `${compGims.length} comps` },
    ];
    if (impliedGim != null && purchasePrice) {
      trail.push({ label: 'Implied GIM (subject)',   value: `${impliedGim.toFixed(2)}×` });
      trail.push({ label: 'Purchase Price',          value: fmt$(purchasePrice), source: 'deal_terms' });
    }

    return {
      id:                'gim',
      label:             'GIM — Gross Income Multiplier',
      direction:         'income',
      status:            'active',
      confidence,
      indicatedValueP25: valP25,
      indicatedValueP50: valP50,
      indicatedValueP75: valP75,
      indicatedPPU:      ppu,
      indicatedPSF:      psf,
      compCount:         compGims.length,
      sourceProvenance:  `Market GIM from ${compGims.length} comp(s) in ${criteria.radiusMiles}mi radius (max ${criteria.maxAgeMonths}mo). Comp GIM P50: ${gimP50.toFixed(2)}× applied to subject EGI of ${fmt$(egi)}.`,
      evidenceTrail:     trail,
      warningFlags:      [],
    };
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  private insufficientMethod(
    id: MethodId,
    label: string,
    direction: MethodDirection,
    provenance: string,
    warnings: string[]
  ): ValuationMethod {
    return {
      id,
      label,
      direction,
      status: 'insufficient',
      confidence: 'INSUFFICIENT',
      indicatedValueP25: null,
      indicatedValueP50: null,
      indicatedValueP75: null,
      indicatedPPU: null,
      indicatedPSF: null,
      sourceProvenance: provenance,
      evidenceTrail: [],
      warningFlags: warnings,
    };
  }

  private placeholder(id: MethodId, label: string, direction: MethodDirection): ValuationMethod {
    const tooltips: Partial<Record<MethodId, string>> = {
      grm: 'GRM requires gross_rent_annual at time of sale — not yet captured in comp data. Coming V1.0.',
      gim: 'GIM requires gross income data from broker OMs. Coming V1.0.',
      dcf: 'DCF requires full rent/OpEx derivation logic from Phase 2. Coming V1.0.',
    };
    return {
      id,
      label,
      direction,
      status: 'placeholder',
      placeholderVersion: 'V1.0',
      confidence: 'INSUFFICIENT',
      indicatedValueP25: null,
      indicatedValueP50: null,
      indicatedValueP75: null,
      indicatedPPU: null,
      indicatedPSF: null,
      sourceProvenance: tooltips[id] ?? 'Coming V1.0',
      evidenceTrail: [],
      warningFlags: [],
    };
  }

  private archiveConfidence(n: number, state: string, city: string): ConfidenceLevel {
    const isPrimary = this.isPrimaryMarket(state, city);
    if (n >= 30) return isPrimary ? 'HIGH' : 'MEDIUM';
    if (n >= 10) return isPrimary ? 'MEDIUM' : 'LOW';
    if (n >= 5)  return 'LOW';
    return 'INSUFFICIENT';
  }

  private compConfidence(compCount: number, state: string, city: string): ConfidenceLevel {
    const isPrimary = this.isPrimaryMarket(state, city);
    if (compCount >= 10) return isPrimary ? 'HIGH' : 'MEDIUM';
    if (compCount >= 5)  return 'MEDIUM';
    if (compCount >= 2)  return 'LOW';
    return 'INSUFFICIENT';
  }

  private isPrimaryMarket(state: string, city: string): boolean {
    const cityLower = city.toLowerCase();
    const PRIMARY_FL = ['tampa', 'orlando', 'miami', 'jacksonville'];
    const PRIMARY_TX = ['dallas', 'fort worth', 'houston', 'austin'];
    const PRIMARY_GA = ['atlanta'];
    if (state === 'FL' && PRIMARY_FL.some(c => cityLower.includes(c))) return true;
    if (state === 'TX' && PRIMARY_TX.some(c => cityLower.includes(c))) return true;
    if (state === 'GA' && PRIMARY_GA.some(c => cityLower.includes(c))) return true;
    return false;
  }

  private defaultCapRatesByMarket(
    state: string,
    city: string
  ): { p25: number; p50: number; p75: number } {
    // Conservative market-knowledge defaults when no archive data
    // Florida multifamily historically tighter; Sun Belt generally 5–6%
    if (state === 'FL') return { p25: 0.045, p50: 0.052, p75: 0.060 };
    if (state === 'GA') return { p25: 0.050, p50: 0.057, p75: 0.065 };
    if (state === 'TX') return { p25: 0.048, p50: 0.055, p75: 0.063 };
    return { p25: 0.050, p50: 0.058, p75: 0.068 };
  }

  // ── Operator override persistence ─────────────────────────────────────────

  async saveOperatorOverride(
    dealId: string,
    value: number,
    rationale?: string
  ): Promise<void> {
    const lv = {
      resolved: value,
      layers: {
        operator: {
          value,
          rationale: rationale ?? null,
          updatedAt: new Date().toISOString(),
        },
      },
      resolvedFrom: 'operator',
      alertLevel: 'none',
    };

    await this.pool.query(
      `UPDATE deal_assumptions
       SET valuation_override_lv = $1::jsonb
       WHERE deal_id = $2::uuid`,
      [JSON.stringify(lv), dealId]
    );
  }

  // ── Task #1417 (6.1): Comp criteria persistence ──────────────────────────

  private readonly DEFAULT_CRITERIA: CompCriteria = {
    radiusMiles: 3.0,
    maxAgeMonths: MAX_COMP_AGE_MONTHS_DEFAULT,
    minUnits: 50,
    maxUnits: 500,
    minYearBuilt: 0,
    maxYearBuilt: 9999,
    propertyClasses: ['A', 'B', 'C'],
    excludedCompIds: [],
    customIncludedCompIds: [],
    overrideEvents: [],
  };

  private async getCompCriteria(dealId: string): Promise<CompCriteria> {
    const result = await this.pool.query(
      `SELECT comp_criteria FROM deal_assumptions WHERE deal_id = $1::uuid LIMIT 1`,
      [dealId]
    );
    const stored = result.rows[0]?.comp_criteria ?? null;
    if (!stored) return { ...this.DEFAULT_CRITERIA };
    return {
      ...this.DEFAULT_CRITERIA,
      ...stored,
      excludedCompIds: Array.isArray(stored.excludedCompIds) ? stored.excludedCompIds : [],
      customIncludedCompIds: Array.isArray(stored.customIncludedCompIds) ? stored.customIncludedCompIds : [],
      overrideEvents: Array.isArray(stored.overrideEvents) ? stored.overrideEvents : [],
    };
  }

  async updateCompCriteria(dealId: string, patch: Partial<CompCriteria>): Promise<CompCriteria> {
    const current = await this.getCompCriteria(dealId);
    const updated: CompCriteria = { ...current, ...patch };
    await this.pool.query(
      `UPDATE deal_assumptions
       SET comp_criteria = $1::jsonb
       WHERE deal_id = $2::uuid`,
      [JSON.stringify(updated), dealId]
    );
    // Task #1417 (6.1): When any selection-scope criteria change, regenerate the comp set
    // so that scoring methods immediately see the updated universe on the next compute.
    const selectionCriteriaChanged = (
      patch.radiusMiles !== undefined ||
      patch.maxAgeMonths !== undefined ||
      patch.minUnits !== undefined ||
      patch.maxUnits !== undefined ||
      patch.propertyClasses !== undefined
    );
    if (selectionCriteriaChanged) {
      try {
        const { CompSetService } = await import('../saleComps/compSet.service');
        const csvc = new CompSetService();
        await csvc.generateCompSet({
          deal_id: dealId,
          radius_miles: updated.radiusMiles,
          // Use wide retrieval horizon — maxAgeMonths is a staleness weight threshold,
          // not a hard SQL cutoff. Aged comps are downweighted, not excluded.
          date_range_months: COMP_RETRIEVAL_HORIZON_MONTHS,
          min_units: updated.minUnits > 0 ? updated.minUnits : undefined,
          max_units: updated.maxUnits < 9999 ? updated.maxUnits : undefined,
          property_classes: updated.propertyClasses?.length ? updated.propertyClasses : undefined,
          vintage_range: (updated.minYearBuilt > 0 || updated.maxYearBuilt < 9999)
            ? [updated.minYearBuilt, updated.maxYearBuilt]
            : undefined,
        });
      } catch {
        // non-fatal: comp-set regeneration silently fails if no subject coordinates
      }
    }
    return updated;
  }

  async excludeComp(dealId: string, compId: string): Promise<void> {
    const criteria = await this.getCompCriteria(dealId);
    if (!criteria.excludedCompIds.includes(compId)) {
      criteria.excludedCompIds.push(compId);
    }
    // Task #1417 (6.1): Record provenance for this override
    criteria.overrideEvents.push({
      compId,
      action: 'exclude',
      source: 'operator_override',
      at: new Date().toISOString(),
    });
    await this.pool.query(
      `UPDATE deal_assumptions SET comp_criteria = $1::jsonb WHERE deal_id = $2::uuid`,
      [JSON.stringify(criteria), dealId]
    );
  }

  async includeComp(dealId: string, compId: string): Promise<void> {
    const criteria = await this.getCompCriteria(dealId);
    criteria.excludedCompIds = criteria.excludedCompIds.filter(id => id !== compId);
    // Task #1417 (6.1): Record provenance
    criteria.overrideEvents.push({
      compId,
      action: 'include',
      source: 'operator_override',
      at: new Date().toISOString(),
    });
    await this.pool.query(
      `UPDATE deal_assumptions SET comp_criteria = $1::jsonb WHERE deal_id = $2::uuid`,
      [JSON.stringify(criteria), dealId]
    );
  }

  /**
   * Task #1417 (6.1): Manually add a comp from the broader candidate pool into the
   * active scoring set.  Stores its ID in `customIncludedCompIds` and appends an
   * `operator_override` provenance event.
   *
   * Security: verifies the comp exists and passes the same costar_upload visibility
   * guard used by the candidate query (restricted uploads only visible to their deal).
   */
  async addComp(dealId: string, compId: string): Promise<void> {
    // Security guard: ensure the comp is accessible to this deal
    const visibilityCheck = await this.pool.query(
      `SELECT id FROM market_sale_comps
       WHERE id = $1::uuid
         AND (source != 'costar_upload' OR deal_id = $2::uuid OR deal_id IS NULL)
       LIMIT 1`,
      [compId, dealId]
    );
    if (visibilityCheck.rows.length === 0) {
      throw new Error('Comp not found or not accessible for this deal.');
    }

    const criteria = await this.getCompCriteria(dealId);
    if (!criteria.customIncludedCompIds.includes(compId)) {
      criteria.customIncludedCompIds.push(compId);
    }
    // Remove from exclusion list if it was there
    criteria.excludedCompIds = criteria.excludedCompIds.filter(id => id !== compId);
    criteria.overrideEvents.push({
      compId,
      action: 'add',
      source: 'operator_override',
      at: new Date().toISOString(),
    });
    await this.pool.query(
      `UPDATE deal_assumptions SET comp_criteria = $1::jsonb WHERE deal_id = $2::uuid`,
      [JSON.stringify(criteria), dealId]
    );
  }

  // ── Task #1417 (6.1): Comp review listing ────────────────────────────────
  //
  // PRIMARY SOURCE: compSetService — exactly the same comp universe used by scoring.
  // SUPPLEMENTARY: market_sale_comps within 1.5× radius for "manual add" candidates.
  //
  // Key invariant: the `comps` list here and the `criteriaComps` in
  // computeCompAnchoredCapRate are derived from the same compSet, so operators always
  // see "why those comps" rather than a divergent SQL query.

  async listCompsForReview(dealId: string, asOf?: Date): Promise<CompReviewResult> {
    const compSetService = new (await import('../saleComps/compSet.service')).CompSetService();
    const criteria = await this.getCompCriteria(dealId);

    // 1. Use compSetService as the authoritative source for the scoring comp set
    let compSet = await compSetService.getCompSetByDeal(dealId);
    if (!compSet) {
      // Fall back to generating a comp set if none exists
      const subjectFallback = await this.pool.query(
        `SELECT p.latitude, p.longitude FROM deals d
         LEFT JOIN properties p ON p.deal_id = d.id WHERE d.id = $1::uuid LIMIT 1`,
        [dealId]
      );
      const sf = subjectFallback.rows[0];
      if (sf?.latitude && sf?.longitude) {
        try {
          compSet = await compSetService.generateCompSet({
            deal_id: dealId,
            radius_miles: criteria.radiusMiles,
            // Wide retrieval horizon — maxAgeMonths is a staleness weight threshold only
            date_range_months: COMP_RETRIEVAL_HORIZON_MONTHS,
            min_units: criteria.minUnits > 0 ? criteria.minUnits : undefined,
            max_units: criteria.maxUnits < 9999 ? criteria.maxUnits : undefined,
            property_classes: criteria.propertyClasses,
            vintage_range: (criteria.minYearBuilt > 0 || criteria.maxYearBuilt < 9999)
              ? [criteria.minYearBuilt, criteria.maxYearBuilt] : undefined,
          });
        } catch {
          compSet = null;
        }
      }
    }

    const now = asOf ? asOf.getTime() : Date.now();
    const excludedSet = new Set<string>(criteria.excludedCompIds);
    const customSet = new Set<string>(criteria.customIncludedCompIds);

    // Helper: convert a CompTransaction or raw row to a CompReviewItem
    const toReviewItem = (
      comp: any,
      opts: { excluded: boolean; manually_added: boolean }
    ): CompReviewItem => {
      const saleDate = comp.recording_date ?? comp.sale_date;
      const saleDateMs = saleDate ? new Date(saleDate).getTime() : 0;
      const ageMonths = saleDateMs > 0 ? (now - saleDateMs) / (1000 * 60 * 60 * 24 * 30.44) : 999;
      return {
        id: String(comp.id),
        address: comp.property_address ?? comp.address ?? '',
        city: comp.city ?? null,
        state: comp.state ?? null,
        units: comp.units != null ? parseInt(String(comp.units)) : null,
        year_built: comp.year_built != null ? parseInt(String(comp.year_built)) : null,
        asset_class: comp.property_class ?? comp.asset_class ?? null,
        sale_date: saleDate ? new Date(saleDate).toISOString().slice(0, 10) : null,
        sale_price: comp.derived_sale_price != null
          ? parseFloat(String(comp.derived_sale_price))
          : (comp.sale_price != null ? parseFloat(String(comp.sale_price)) : null),
        price_per_unit: comp.price_per_unit != null ? parseFloat(String(comp.price_per_unit)) : null,
        implied_cap_rate: comp.implied_cap_rate != null ? parseFloat(String(comp.implied_cap_rate)) : null,
        distance_miles: comp.distance_miles != null ? parseFloat(String(comp.distance_miles)) : null,
        source: comp.source ?? 'unknown',
        relevance_score: comp.relevance_score ?? null,
        relevance_tier: comp.relevance_tier ?? null,
        age_months: Math.round(ageMonths),
        // Task #1417 (6.2): staleness label and weight both use maxAgeMonths for consistency
        staleness_label: stalenessLabel(ageMonths, criteria.maxAgeMonths),
        staleness_weight: stalenessWeight(ageMonths, criteria.maxAgeMonths),
        excluded: opts.excluded,
        manually_added: opts.manually_added,
      };
    };

    // 2. Build the primary comp list from the scoring comp set.
    //    Operator-excluded comps are flagged but still shown so operators can re-include.
    //    Comps filtered out by criteria (units/vintage/class) are omitted from the panel
    //    entirely — they match what the scoring filter chain removes — and may surface as
    //    additionalCandidates if within the wider radius.
    //    There is deliberately NO age cutoff here; old comps remain visible with stale flag.
    const allClasses = ['A', 'B', 'C', 'D'];
    const classFilter = criteria.propertyClasses ?? allClasses;
    const applyClassFilter = classFilter.length > 0 && classFilter.length < allClasses.length;
    const matchesCriteria = (c: any): boolean => {
      const u = c.units != null ? parseInt(String(c.units)) : null;
      if (u != null) {
        if (criteria.minUnits > 0 && u < criteria.minUnits) return false;
        if (criteria.maxUnits < 9999 && u > criteria.maxUnits) return false;
      }
      const yb = c.year_built != null ? parseInt(String(c.year_built)) : null;
      if (yb != null) {
        if ((criteria.minYearBuilt ?? 0) > 0 && yb < criteria.minYearBuilt) return false;
        if ((criteria.maxYearBuilt ?? 9999) < 9999 && yb > criteria.maxYearBuilt) return false;
      }
      if (applyClassFilter) {
        const pc = (c.property_class ?? c.asset_class ?? '').toUpperCase();
        if (pc && !classFilter.map(s => s.toUpperCase()).includes(pc)) return false;
      }
      return true;
    };

    const activeCompIds = new Set<string>(compSet?.comps.map((c: any) => String(c.id)) ?? []);
    const effectiveSetComps = (compSet?.comps ?? []).filter((c: any) =>
      matchesCriteria(c) || customSet.has(String(c.id))  // custom-added comps always pass
    );
    const comps: CompReviewItem[] = effectiveSetComps.map((comp: any) =>
      toReviewItem(comp, {
        excluded: excludedSet.has(String(comp.id)),
        manually_added: customSet.has(String(comp.id)),
      })
    );

    // Task #1417 (6.1): Append manually-added comps that are NOT already in the comp set
    // so the panel always mirrors what goes into scoring (where customIncludedCompIds are merged).
    const missingCustomIds = criteria.customIncludedCompIds.filter(id => !activeCompIds.has(id));
    if (missingCustomIds.length > 0) {
      try {
        const customPanelResult = await this.pool.query(
          `SELECT id, sale_date AS recording_date, address AS property_address,
                  units, year_built, asset_class AS property_class,
                  sale_price AS derived_sale_price, price_per_unit,
                  cap_rate AS implied_cap_rate, source
           FROM market_sale_comps
           WHERE id = ANY($1::uuid[])
             AND (source != 'costar_upload' OR deal_id = $2::uuid OR deal_id IS NULL)`,
          [missingCustomIds, dealId]
        );
        for (const row of customPanelResult.rows) {
          comps.push(toReviewItem(row, { excluded: excludedSet.has(String(row.id)), manually_added: true }));
          activeCompIds.add(String(row.id)); // keep additionalCandidates distinct
        }
      } catch {
        // non-fatal
      }
    }

    // 3. Fetch additional candidates from market_sale_comps within 1.5× radius
    //    for the "manual add" pool — only comps NOT already in the comp set.
    let additionalCandidates: CompReviewItem[] = [];
    try {
      const subjectResult = await this.pool.query(
        `SELECT p.latitude, p.longitude FROM deals d
         LEFT JOIN properties p ON p.deal_id = d.id WHERE d.id = $1::uuid LIMIT 1`,
        [dealId]
      );
      const subject = subjectResult.rows[0];
      if (subject?.latitude && subject?.longitude) {
        const widerRadius = criteria.radiusMiles * 1.5;
        const candidateResult = await this.pool.query(
          `SELECT
             t.id, t.address AS property_address, t.city, t.state,
             t.units, t.year_built, t.asset_class AS property_class,
             t.sale_date AS recording_date, t.sale_price AS derived_sale_price,
             t.price_per_unit, t.cap_rate AS implied_cap_rate, t.source,
             ROUND((
               point(t.longitude::float, t.latitude::float)
               <@> point($2::float, $1::float)
             )::numeric, 3) AS distance_miles
           FROM market_sale_comps t
           WHERE t.property_type = 'multifamily'
             AND t.latitude IS NOT NULL AND t.longitude IS NOT NULL
             AND t.sale_price > 0
             AND (point(t.longitude::float, t.latitude::float) <@> point($2::float, $1::float)) <= $3
             AND (t.source != 'costar_upload' OR t.deal_id = $4::uuid OR t.deal_id IS NULL)
           ORDER BY (point(t.longitude::float, t.latitude::float) <@> point($2::float, $1::float)) ASC,
                    t.sale_date DESC
           LIMIT 150`,
          [subject.latitude, subject.longitude, widerRadius, dealId]
        );
        additionalCandidates = candidateResult.rows
          .filter((r: any) => !activeCompIds.has(String(r.id)))
          .map((r: any) => toReviewItem(r, { excluded: false, manually_added: false }));
      }
    } catch {
      // non-fatal — candidate query failure doesn't break the panel
    }

    const totalCandidates = comps.length + additionalCandidates.length;
    const staleCount = comps.filter(c => c.staleness_label === 'stale').length;
    const excludedCount = comps.filter(c => c.excluded).length;

    return {
      dealId,
      criteria,
      comps,
      additionalCandidates,
      totalCandidates,
      staleCount,
      excludedCount,
    };
  }
}
