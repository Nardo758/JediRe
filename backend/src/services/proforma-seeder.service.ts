import { Pool } from 'pg';
import type { LayeredValue, ProFormaYear1Seed } from './document-extraction/types';
import { logger } from '../utils/logger';

// ProForma Seeder: merges extraction capsules into ProFormaYear1Seed (deal_assumptions.year1).
// Priority: override > field-specific source > platform fallback. Idempotent.

interface PlatformBaseline {
  gpr_per_unit_per_month: number | null;
  vacancy_pct: number | null;
  concessions_pct: number | null;
  bad_debt_pct: number | null;
  opex_per_unit_annual: {
    payroll: number | null;
    r_and_m: number | null;
    turnover: number | null;
    contract_services: number | null;
    marketing: number | null;
    g_and_a: number | null;
    utilities: number | null;
    insurance: number | null;
  };
  management_fee_pct_egi: number | null;
}

type Resolution =
  | 'platform' | 't12' | 'rent_roll' | 'tax_bill' | 'box_score' | 'aged_ar' | 'om'
  | 'override' | 'platform_fallback';

interface Capsule {
  [key: string]: unknown;
}

function num(obj: Capsule | null | undefined, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === 'number' ? v : null;
}

function obj(o: Capsule | null | undefined, key: string): Capsule | null {
  if (!o) return null;
  const v = o[key];
  return v && typeof v === 'object' ? v as Capsule : null;
}

interface ExistingSeed {
  [key: string]: LayeredValue<number> | Record<string, unknown> | unknown;
}

interface DealRow {
  name?: string;
  city?: string;
  state_code?: string;
  state?: string;
  target_units?: number;
}

const now = () => new Date().toISOString();

// ─── Platform Baseline Lookup ─────────────────────────────────────────────────
// Industry-standard Class-B multifamily per-unit-per-year OpEx benchmarks
// (2024 edition). Sources: NMHC / NAA Survey of Operating Income & Expenses
// 2023-2024; CoStar market analytics.

interface OpExNorms {
  payroll: number;
  r_and_m: number;
  turnover: number;
  contract_services: number;
  marketing: number;
  g_and_a: number;
  utilities: number;
  insurance: number;
}

const BASE_OPEX_NORMS_PER_UNIT: OpExNorms = {
  payroll:           1400,
  r_and_m:            550,
  turnover:           200,
  contract_services:  200,
  marketing:          200,
  g_and_a:            200,
  utilities:          900,
  insurance:          300,
};

const BASE_VACANCY_PCT      = 0.07;   // 7 % stabilised Class-B
const BASE_CONCESSIONS_PCT  = 0.02;   // 2 %
const BASE_BAD_DEBT_PCT     = 0.01;   // 1 %
const BASE_MGMT_FEE_PCT_EGI = 0.045;  // 4.5 % of EGI

// National median rent fallback (Class B, 2024) used when no snapshot data
// exists for the deal's city or state.
const NATIONAL_MEDIAN_RENT_PER_UNIT_PER_MONTH = 1400;

// Per-state multipliers — only states with significant divergence from the
// national average are listed; all others receive 1.0.
const STATE_ADJUSTMENTS: Record<string, Partial<Record<keyof OpExNorms, number>>> = {
  FL: { insurance: 1.50, utilities: 1.10 },
  TX: { insurance: 1.20, utilities: 1.05 },
  CA: { insurance: 1.35, payroll: 1.45, utilities: 1.15 },
  NY: { insurance: 1.40, payroll: 1.50, utilities: 1.20 },
  NJ: { insurance: 1.30, payroll: 1.35 },
  CO: { insurance: 1.10 },
  AZ: { utilities: 1.10 },
};

function applyStateAdjustments(base: OpExNorms, stateCode: string | null | undefined): OpExNorms {
  const adj = STATE_ADJUSTMENTS[(stateCode ?? '').toUpperCase()] ?? {};
  return {
    payroll:           Math.round(base.payroll           * (adj.payroll           ?? 1)),
    r_and_m:           Math.round(base.r_and_m           * (adj.r_and_m           ?? 1)),
    turnover:          Math.round(base.turnover          * (adj.turnover          ?? 1)),
    contract_services: Math.round(base.contract_services * (adj.contract_services ?? 1)),
    marketing:         Math.round(base.marketing         * (adj.marketing         ?? 1)),
    g_and_a:           Math.round(base.g_and_a           * (adj.g_and_a           ?? 1)),
    utilities:         Math.round(base.utilities         * (adj.utilities         ?? 1)),
    insurance:         Math.round(base.insurance         * (adj.insurance         ?? 1)),
  };
}

/**
 * Resolve real platform baseline data for a deal's city/state.
 *
 * Hierarchy:
 *   1. apartment_market_snapshots — exact city+state match (most recent snapshot)
 *      → provides avg_rent (gpr per unit/mo), avg_occupancy, concession_rate
 *   2. apartment_market_snapshots — state-wide average across all cities in state
 *      → only used for avg_rent if city match found nothing
 *   3. Pure static industry norms (state-adjusted) — always populates OpEx and
 *      any revenue fields not resolved by 1 or 2
 *
 * All fields are always returned non-null (static norms fill any gaps).
 */
async function lookupPlatformBaseline(
  pool: Pool,
  city: string | null | undefined,
  stateCode: string | null | undefined,
): Promise<PlatformBaseline> {
  const norms = applyStateAdjustments(BASE_OPEX_NORMS_PER_UNIT, stateCode);

  let gprPerUnitPerMonth: number | null = null;
  let vacancyPct: number = BASE_VACANCY_PCT;
  let concessionsPct: number = BASE_CONCESSIONS_PCT;

  try {
    if (city && stateCode) {
      // 1. Exact city + state match
      const citySnap = await pool.query<{
        avg_rent: string | null;
        avg_occupancy: string | null;
        concession_rate: string | null;
      }>(
        `SELECT avg_rent, avg_occupancy, concession_rate
           FROM apartment_market_snapshots
          WHERE LOWER(city) = LOWER($1) AND LOWER(state) = LOWER($2)
          ORDER BY snapshot_date DESC
          LIMIT 1`,
        [city, stateCode]
      );
      if (citySnap.rows.length > 0) {
        const row = citySnap.rows[0];
        if (row.avg_rent != null) gprPerUnitPerMonth = parseFloat(row.avg_rent);
        if (row.avg_occupancy != null) {
          const occ = parseFloat(row.avg_occupancy);
          // avg_occupancy is stored as a proportion (0–1, e.g. 0.94 = 94%)
          // Guard against percentage-scale values from other data sources.
          if (occ > 0) vacancyPct = Math.max(0, occ > 1 ? 1 - occ / 100 : 1 - occ);
        }
        if (row.concession_rate != null) {
          const cr = parseFloat(row.concession_rate);
          // concession_rate stored as proportion (0–1); guard against %-scale
          if (cr > 0) concessionsPct = cr > 1 ? cr / 100 : cr;
        }
      }
    }

    // 2. State-level avg_rent fallback if city gave nothing
    if (gprPerUnitPerMonth == null && stateCode) {
      const stateSnap = await pool.query<{ avg_rent: string | null }>(
        `SELECT AVG(avg_rent::numeric)::text AS avg_rent
           FROM apartment_market_snapshots
          WHERE LOWER(state) = LOWER($1) AND avg_rent IS NOT NULL`,
        [stateCode]
      );
      const sr = stateSnap.rows[0];
      if (sr?.avg_rent != null) gprPerUnitPerMonth = parseFloat(sr.avg_rent);
    }

  } catch (err) {
    // Non-fatal — static norms are still returned
    console.warn('[proforma-seeder] lookupPlatformBaseline: snapshot query failed, using static norms:', (err as Error).message);
  }

  // National median fallback — outside try/catch so it fires even on query
  // failure and guarantees gpr_per_unit_per_month is never null.
  if (gprPerUnitPerMonth == null) {
    gprPerUnitPerMonth = NATIONAL_MEDIAN_RENT_PER_UNIT_PER_MONTH;
  }

  return {
    gpr_per_unit_per_month: gprPerUnitPerMonth,
    vacancy_pct:            vacancyPct,
    concessions_pct:        concessionsPct,
    bad_debt_pct:           BASE_BAD_DEBT_PCT,
    opex_per_unit_annual: {
      payroll:           norms.payroll,
      r_and_m:           norms.r_and_m,
      turnover:          norms.turnover,
      contract_services: norms.contract_services,
      marketing:         norms.marketing,
      g_and_a:           norms.g_and_a,
      utilities:         norms.utilities,
      insurance:         norms.insurance,
    },
    management_fee_pct_egi: BASE_MGMT_FEE_PCT_EGI,
  };
}

/**
 * Patterns that identify GL labels which must NOT be summed into custom opex.
 * Covers: revenue lines, rollup/subtotal rows, and below-the-line items.
 * Hoisted to module level so the invariant test suite can import and exercise
 * it directly without mocking the full seed pipeline.
 *
 * S1-01 gap patches (2026-05-08):
 *   /\brental\s+revenue\b/i       — "Multifamily Rental Revenue Net" missed by
 *                                    prior /rental\s+income/ pattern
 *   /\bnet\s+(loss|profit)\b/i    — "Net Loss/Profit" P&L rollup row
 *   /\bincome\s*$/i               — any GL label ending with "Income"
 *                                    (Administrative Income, Storage Income, etc.)
 *   /\breserve[\s_-]+replacement\b/i — "Reserve Replacement" word-order variant;
 *                                    prior pattern only matched "Replacement Reserve"
 *
 * S1-01 follow-up patches (2026-05-09 — verified live-DB residuals after
 * forceReseed:true exposed three remaining label variants the original
 * patterns could not match):
 *   /\bnet[\s(]+(loss|profit)/i   — "NET (LOSS) / PROFIT" — open-paren
 *                                    separator after "net" defeated \s+ (LOSS)
 *   /\bnet\s+income\b/i           — "Net Income (Loss)" — does not end with
 *                                    "income" so \bincome\s*$ misses it
 *   /\brevenue\s+share\b/i        — "Revenue Share Contract" — revenue-side
 *                                    item in property GLs; exclude by name
 *   /\bincome\s*\(/i              — "Storage Income (multifamily only)" —
 *                                    parenthesized qualifier after "income"
 *                                    defeats the end-anchored \bincome\s*$
 */
export const EXCLUDE_FROM_CUSTOM_OPEX: RegExp[] = [
  // Revenue lines
  /\b(gross\s+potential|gross\s+scheduled|market)\s+rent\b/i,
  /\b(effective\s+gross|collected)\s+(income|rent|revenue)\b/i,
  /\b(rental|other)\s+income\b/i,
  /\brental\s+revenue\b/i,
  /\brevenue\s+share\b/i,
  /\b(net\s+rental|nri)\b/i,
  /\bloss\s+to\s+lease\b/i,
  /\bvacancy\s+(loss)?\b/i,
  /\bconcession/i,
  /\bbad\s+debt\b/i,
  /\bincome\s*$/i,
  /\bincome\s*\(/i,
  /\bnet\s+income\b/i,
  // Rollup / subtotal rows
  /^total\s+/i,
  /\btotal\s+(income|revenue|expenses?|opex|operating)\b/i,
  /\b(net\s+)?operating\s+income/i,
  /\bnoi\b/i,
  /\bcontrollable\s+operating/i,
  /\b(sub)?total\b/i,
  /\bnet\s+(loss|profit)\b/i,
  /\bnet[\s(]+(loss|profit)/i,
  // Below-the-line (non-operating)
  /\bdebt\s+service/i,
  /\binterest\s+expense/i,
  /\bmortgage\b/i,
  /\bloan\s+(payment|principal)/i,
  /\bdepreciation\b/i,
  /\bamortization\b/i,
  /\bcapital\s+(expenditure|reserve|improvement)/i,
  /\bcapex\b/i,
  /\breplacement\s+reserve/i,
  /\breserve[\s_-]+replacement\b/i,
  /\bnon[\s-]?operating/i,
  /\bcash\s+flow/i,
  /\b(before|after)\s+tax/i,
];

/** Returns true when a raw GL label should be excluded from the custom opex bucket. */
export const isExcludedFromOpex = (label: string): boolean =>
  EXCLUDE_FROM_CUSTOM_OPEX.some(pattern => pattern.test(label));

/**
 * Field-name → priority map shared between the initial seed (`resolve()` inside
 * `buildSeed`) and the override-clear fallback (`applyUserOverride`). Keep
 * these in one place so the two code paths can never drift apart.
 */
const FIELD_PRIORITIES: Record<string, Resolution[]> = {
  gpr: ['t12', 'rent_roll'],
  loss_to_lease_pct: ['t12', 'rent_roll'],
  vacancy_pct: ['rent_roll', 't12'],
  concessions_pct: ['t12', 'rent_roll'],
  bad_debt_pct: ['t12'],
  non_revenue_units_pct: ['t12'],
  other_income_total: ['rent_roll', 't12', 'om'],
  other_income_per_unit: ['rent_roll', 't12', 'om'],
  real_estate_tax: ['tax_bill', 't12'],
  management_fee_pct: ['t12'],
  insurance: ['t12'],
};

/**
 * Revenue / NOI fields where a 0 value from any source is treated as "missing"
 * rather than a real measurement. This handles the lease-up edge case where a
 * rent roll legitimately reports `gpr_monthly = 0` even when the T-12 contains
 * the real GPR — the priority walker should fall through to the next source
 * instead of resolving to zero.
 */
const SKIP_ZERO_FIELDS = new Set<string>([
  'gpr',
  'egi',
  'noi',
  'net_rental_income',
  'other_income_total',
  'other_income_per_unit',
  'total_opex',
]);

/**
 * Re-resolve a LayeredValue in place after its `override` has been cleared.
 * Walks `FIELD_PRIORITIES[fieldName]` (or the supplied fallback) honouring
 * SKIP_ZERO_FIELDS, exactly the way `resolve()` does at seed time. Extracted
 * so the seed-time and override-clear paths share one implementation and
 * can be exercised by the same test matrix.
 *
 * Mutates `field.resolved` and `field.resolution`. Does not touch
 * `updated_at` / `updated_by` — callers own those.
 */
export function reResolveClearedLayeredValue(
  field: LayeredValue<number>,
  fieldName: string,
  fallbackPriority: Resolution[] = ['rent_roll', 't12', 'tax_bill', 'box_score', 'aged_ar', 'om']
): void {
  const priorityOrder = FIELD_PRIORITIES[fieldName] ?? fallbackPriority;
  const shouldSkipZero = SKIP_ZERO_FIELDS.has(fieldName);
  field.resolution = 'platform_fallback';
  field.resolved = field.platform ?? null;
  for (const src of priorityOrder) {
    const srcVal = (field as unknown as Record<string, number | null>)[src];
    if (srcVal != null && (!shouldSkipZero || srcVal !== 0)) {
      field.resolved = srcVal;
      field.resolution = src as LayeredValue<number>['resolution'];
      break;
    }
  }
}

// Exposed for tests. Module-internal callers continue to use the names directly.
export { FIELD_PRIORITIES, SKIP_ZERO_FIELDS, resolve as resolveForTest, recomputeDerived };

/**
 * Resolve a layered value following priority rules. Honors existing user override.
 */
function resolve(
  fieldName: string,
  platform: number | null,
  options: {
    t12?: number | null;
    rent_roll?: number | null;
    tax_bill?: number | null;
    box_score?: number | null;
    aged_ar?: number | null;
    om?: number | null;
    existingOverride?: number | null;
    /**
     * Optional inline priority. If omitted, falls back to FIELD_PRIORITIES[fieldName]
     * so the seed-time path and override-clear path stay in lockstep. Pass an
     * explicit value only for fields that are not in FIELD_PRIORITIES (e.g.
     * other_income_breakdown.* and per-line opex categories).
     */
    priority?: Resolution[];
    scenarios?: Record<string, number>;
    warning?: string;
  }
): LayeredValue<number> {
  const priority = options.priority ?? FIELD_PRIORITIES[fieldName] ?? [];
  const lv: LayeredValue<number> = {
    platform,
    t12: options.t12 ?? null,
    rent_roll: options.rent_roll ?? null,
    tax_bill: options.tax_bill ?? null,
    box_score: options.box_score ?? null,
    aged_ar: options.aged_ar ?? null,
    om: options.om ?? null,
    override: options.existingOverride ?? null,
    resolved: null,
    resolution: 'platform_fallback',
    updated_at: now(),
  };
  if (options.scenarios) lv.scenarios = options.scenarios;
  if (options.warning) lv.warning = options.warning;

  // Override always wins
  if (lv.override != null) {
    lv.resolved = lv.override;
    lv.resolution = 'override';
    return lv;
  }

  // Walk priority list
  // Skip zero values for revenue/NOI fields (extraction edge case: lease-up
  // rent roll has gpr_monthly: 0 even when T12 has real GPR)
  const shouldSkipZero = SKIP_ZERO_FIELDS.has(fieldName);

  for (const src of priority) {
    const v = (lv as unknown as Record<string, number | null>)[src];
    if (v != null && (!shouldSkipZero || v !== 0)) {
      lv.resolved = v;
      lv.resolution = src as LayeredValue<number>['resolution'];
      return lv;
    }
  }

  // Final fallback
  if (platform != null) {
    lv.resolved = platform;
    lv.resolution = 'platform_fallback';
  }
  return lv;
}

/**
 * Build the ProForma Year-1 seed from all available extraction sources.
 * Preserves user overrides if existingSeed contains them.
 */
function buildSeed(
  totalUnits: number,
  platform: PlatformBaseline,
  t12Capsule: Capsule | null,
  rrCapsule: Capsule | null,
  taxBillCapsule: Capsule | null,
  omCapsule: Capsule | null,
  existingSeed: ExistingSeed | null,
  bpCapsule: Record<string, unknown> | null = null
): ProFormaYear1Seed {
  const ex = existingSeed || {} as ExistingSeed;

  // ── Broker proforma values (om layer) ────────────────────────────────────
  const bpNum = (k: string): number | null => {
    const v = bpCapsule?.[k];
    return typeof v === 'number' && isFinite(v) ? v : null;
  };
  const bpVacPct    = bpNum('stabilizedVacancy');
  const bpLtlPct    = bpNum('lossToLease');
  const bpConcPct   = bpNum('concessionsPct');
  const bpBdPct     = bpNum('badDebtPct');
  const bpMgmtPct   = bpNum('managementFeePct');
  const bpResPerUt  = bpNum('replacementReservesPerUnit');
  const bpNOI       = bpNum('yearOneNOI') ?? bpNum('stabilizedNOI');
  const bpGpr       = bpNum('stabilizedGpr');
  const bpPayroll   = bpNum('payrollAnnual');
  const bpInsur     = bpNum('insuranceAnnual');
  const bpUtils     = bpNum('utilitiesAnnual');
  const bpRM        = bpNum('repairsMaintenanceAnnual');
  const bpTurnover  = bpNum('turnoverAnnual');
  const bpMktg      = bpNum('marketingAnnual');
  const bpGA        = bpNum('gAndAAnnual');
  const bpContract  = bpNum('contractServicesAnnual');
  const bpTax       = bpNum('realEstateTaxesAnnual');
  const bpReserves  = bpResPerUt != null && totalUnits > 0 ? bpResPerUt * totalUnits : null;
  const getOverride = (fieldName: string): number | null => {
    const parts = fieldName.split('.');
    let current: unknown = ex;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[part];
    }
    if (current && typeof current === 'object' && 'override' in current) {
      const lv = current as LayeredValue<number> & { override_source?: string | null; om?: number | null };
      // F-010 contamination guard: if override_source is absent (pre-operator-tag era,
      // before Task #832 added 'operator' stamping) AND override exactly equals the om
      // slot, this is a legacy OM-to-override write from a historical code path.
      // Returning null lets the priority resolver fall through to t12/platform and
      // allows the cashflow agent to write its value on the next run.
      // Real operator overrides are always stamped override_source='operator' by the
      // current applyUserOverride, so this guard never touches legitimate overrides.
      if (
        (lv.override_source == null) &&
        lv.override != null &&
        lv.om != null &&
        lv.override === lv.om
      ) {
        return null;
      }
      return lv.override ?? null;
    }
    return null;
  };

  const months = 12;

  // ───────── REVENUE ─────────
  const gpr_t12 = num(t12Capsule, 'gpr');
  const gpr_rr_m = num(rrCapsule, 'gpr_monthly');
  const gpr_rr = gpr_rr_m != null ? gpr_rr_m * months : null;
  const gpr_platform = (platform.gpr_per_unit_per_month != null && totalUnits > 0)
    ? platform.gpr_per_unit_per_month * totalUnits * months
    : null;

  // Priority comes from FIELD_PRIORITIES so the seed and override-clear paths
  // stay in lockstep. T12 wins over rent roll for GPR because rent rolls often
  // report gpr_monthly=0 for lease-up properties even when T12 has real GPR.
  const gpr = resolve('gpr', gpr_platform, {
    t12: gpr_t12, rent_roll: gpr_rr, om: bpGpr,
    existingOverride: getOverride('gpr'),
  });

  const t12gpr = num(t12Capsule, 'gpr') ?? 0;
  const ltl_t12 = t12gpr > 0 ? Math.abs(num(t12Capsule, 'loss_to_lease') ?? 0) / t12gpr : null;
  const ltl_rr = num(rrCapsule, 'loss_to_lease_pct');
  const lossToLeasePct = resolve('loss_to_lease_pct', null, {
    t12: ltl_t12, rent_roll: ltl_rr,
    om: bpLtlPct,
    existingOverride: getOverride('loss_to_lease_pct'),
  });

  const vac_t12 = t12gpr > 0 ? Math.abs(num(t12Capsule, 'vacancy_loss') ?? 0) / t12gpr : null;
  const vac_rr = rrCapsule ? 1 - (num(rrCapsule, 'occupancy_by_unit_pct') ?? 1) : null;
  const vacancyPct = resolve('vacancy_pct', platform.vacancy_pct, {
    t12: vac_t12, rent_roll: vac_rr,
    om: bpVacPct,
    existingOverride: getOverride('vacancy_pct'),
  });

  const concObj = obj(t12Capsule, 'concessions');
  const concRaw = concObj ? (num(concObj, 'total') ?? 0) : (num(t12Capsule, 'concessions') ?? 0);
  const conc_t12 = t12gpr > 0 ? Math.abs(concRaw) / t12gpr : null;
  const rrGprM = num(rrCapsule, 'gpr_monthly') ?? 0;
  const rrOIM = obj(rrCapsule, 'other_income_monthly');
  const conc_rr = rrGprM > 0
    ? Math.abs(num(rrOIM, 'concessions_other') ?? 0) / rrGprM
    : null;
  const concessionsPct = resolve('concessions_pct', platform.concessions_pct, {
    t12: conc_t12, rent_roll: conc_rr,
    om: bpConcPct,
    existingOverride: getOverride('concessions_pct'),
  });

  const t12egi = num(t12Capsule, 'egi') ?? 0;
  const bdObj = obj(t12Capsule, 'bad_debt');
  const bdRaw = bdObj ? (num(bdObj, 'net') ?? 0) : (num(t12Capsule, 'bad_debt') ?? 0);
  // v31 spec: bad debt is a deduction from rental income (GPR), not from EGI.
  // Use GPR as the basis so the rate represents "% of gross rent uncollected".
  // Task #672.
  const bd_t12 = t12gpr > 0 ? Math.abs(bdRaw) / t12gpr : null;
  const badDebtPct = resolve('bad_debt_pct', platform.bad_debt_pct, {
    t12: bd_t12,
    om: bpBdPct,
    existingOverride: getOverride('bad_debt_pct'),
  });

  const nru_t12 = t12gpr > 0
    ? Math.abs(num(t12Capsule, 'non_revenue_units') ?? 0) / t12gpr
    : null;
  const nonRevenueUnitsPct = resolve('non_revenue_units_pct', null, {
    t12: nru_t12,
    existingOverride: getOverride('non_revenue_units_pct'),
  });

  const t12OI = obj(t12Capsule, 'other_income');
  const other_t12 = num(t12OI, 'total');
  const rrOIMObj = obj(rrCapsule, 'other_income_monthly');
  const other_rr = rrOIMObj
    ? Object.values(rrOIMObj)
        .filter((v): v is number => typeof v === 'number' && v > 0)
        .reduce((s, v) => s + v, 0) * months
    : null;
  // OM: per-category MONTHLY $ from broker proforma. Sum to deal-wide annual
  // for the rollup; per-category values feed the breakdown resolver below.
  const omOI = obj(omCapsule, 'other_income_monthly');
  const omAnnual = (key: string): number | null => {
    const v = num(omOI, key);
    return v != null ? v * months : null;
  };
  const other_om = omOI
    ? Object.values(omOI)
        .filter((v): v is number => typeof v === 'number' && v > 0)
        .reduce((s, v) => s + v, 0) * months
    : null;
  const otherIncomeTotal = resolve('other_income_total', null, {
    t12: other_t12, rent_roll: other_rr, om: other_om,
    existingOverride: getOverride('other_income_total'),
    priority: ['rent_roll', 't12', 'om'],
  });

  // Per-unit other income
  const otherIncomePerUnit = resolve('other_income_per_unit', null, {
    t12: other_t12 != null && totalUnits > 0 ? other_t12 / totalUnits : null,
    rent_roll: other_rr != null && totalUnits > 0 ? other_rr / totalUnits : null,
    om: other_om != null && totalUnits > 0 ? other_om / totalUnits : null,
    existingOverride: getOverride('other_income_per_unit'),
    priority: ['rent_roll', 't12', 'om'],
  });

  const oi = rrOIMObj;
  // Per-category ancillary lines (parking, pet, storage, laundry, rubs, fees,
  // insurance_admin, other) are positive-by-design revenue buckets. When the
  // rent-roll reports 0 or a negative value for one of them, that almost
  // always means the property manager doesn't track the line at the unit
  // level (or a write-off / concession is leaking into the bucket) — NOT
  // that the property earned $0 from it. Coerce ≤0 to null so the resolver
  // falls through to OM. Task #519 (464 Bishop fix).
  const oiAnnual = (key: string) => {
    const v = num(oi, key);
    if (v == null || v <= 0) return null;
    return v * months;
  };
  // Per-category priority: prefer rent-roll truth, fall back to OM broker
  // pro-forma (T-12 has no per-category breakdown — only an aggregate).
  const CAT_PRIORITY: Resolution[] = ['rent_roll', 'om'];
  const otherIncomeBreakdown = {
    parking: resolve('other_income_breakdown.parking', null, {
      rent_roll: oiAnnual('parking'), om: omAnnual('parking'),
      existingOverride: getOverride('other_income_breakdown.parking'),
      priority: CAT_PRIORITY,
    }),
    pet: resolve('other_income_breakdown.pet', null, {
      rent_roll: oiAnnual('pet_rent'), om: omAnnual('pet'),
      existingOverride: getOverride('other_income_breakdown.pet'),
      priority: CAT_PRIORITY,
    }),
    storage: resolve('other_income_breakdown.storage', null, {
      rent_roll: oiAnnual('storage'), om: omAnnual('storage'),
      existingOverride: getOverride('other_income_breakdown.storage'),
      priority: CAT_PRIORITY,
    }),
    laundry: resolve('other_income_breakdown.laundry', null, {
      om: omAnnual('laundry'),
      existingOverride: getOverride('other_income_breakdown.laundry'),
      priority: ['om'],
    }),
    rubs: resolve('other_income_breakdown.rubs', null, {
      rent_roll: oiAnnual('rubs'), om: omAnnual('rubs'),
      existingOverride: getOverride('other_income_breakdown.rubs'),
      priority: CAT_PRIORITY,
    }),
    fees: resolve('other_income_breakdown.fees', null, {
      rent_roll: oiAnnual('fees'), om: omAnnual('fees'),
      existingOverride: getOverride('other_income_breakdown.fees'),
      priority: CAT_PRIORITY,
    }),
    insurance_admin: resolve('other_income_breakdown.insurance_admin', null, {
      rent_roll: oiAnnual('insurance_admin'), om: omAnnual('insurance_admin'),
      existingOverride: getOverride('other_income_breakdown.insurance_admin'),
      priority: CAT_PRIORITY,
    }),
    other: resolve('other_income_breakdown.other', null, {
      rent_roll: oiAnnual('other'), om: omAnnual('other'),
      existingOverride: getOverride('other_income_breakdown.other'),
      priority: CAT_PRIORITY,
    }),
  };

  // T-12 fallback: T-12 publishes only an aggregate "other income" — no
  // per-category breakdown. When neither RR nor OM produced any per-category
  // data (every bucket resolved to null/0) but T-12 carries a positive total,
  // route that aggregate into the `other` bucket so EGI/NOI preserve T-12
  // truth instead of silently dropping ancillary income from the proforma.
  // Task #519 (post-review #2 fix).
  const t12AnnualTotal = other_t12 != null ? other_t12 * (months / 12) : null;
  const breakdownHasAnyData = Object.values(otherIncomeBreakdown)
    .some(lv => lv.resolved != null && lv.resolved !== 0);
  if (!breakdownHasAnyData && t12AnnualTotal != null && t12AnnualTotal !== 0
      && otherIncomeBreakdown.other.resolution !== 'override') {
    const merged: LayeredValue<number> = {
      ...otherIncomeBreakdown.other,
      t12: t12AnnualTotal,
      resolved: t12AnnualTotal,
      resolution: 't12',
      updated_at: now(),
    };
    otherIncomeBreakdown.other = merged;
  }

  // Preserve user-added ancillary lines verbatim across re-seeds. These are
  // managed via dedicated CRUD endpoints, NOT extraction — buildSeed only
  // copies them through. Task #519.
  const userLines = Array.isArray(ex.other_income_user_lines)
    ? (ex.other_income_user_lines as ProFormaYear1Seed['other_income_user_lines'])
    : undefined;

  // ───────── OPEX (T12 primary; platform fallback; broker om layer) ─────────
  const t12Opex = obj(t12Capsule, 'opex');
  const opexFromT12 = (
    t12Field: string,
    fieldName: string,
    platformValue: number | null = null,
    omVal: number | null = null
  ): LayeredValue<number> => {
    const t12Val = num(t12Opex, t12Field);
    return resolve(fieldName, platformValue, {
      t12: t12Val,
      om: omVal,
      existingOverride: getOverride(fieldName),
      priority: ['t12'],
    });
  };

  const platformOpEx = (perUnit: number | null) =>
    perUnit != null && totalUnits > 0 ? perUnit * totalUnits : null;

  const payroll = opexFromT12('payroll', 'payroll', platformOpEx(platform.opex_per_unit_annual.payroll), bpPayroll);
  const repairsMaintenance = opexFromT12('r_and_m', 'repairs_maintenance', platformOpEx(platform.opex_per_unit_annual.r_and_m), bpRM);
  const turnover = opexFromT12('turnover', 'turnover', platformOpEx(platform.opex_per_unit_annual.turnover), bpTurnover);
  const amenities = opexFromT12('amenities', 'amenities', null);
  const contractServices = opexFromT12('contract', 'contract_services', platformOpEx(platform.opex_per_unit_annual.contract_services), bpContract);
  const marketing = opexFromT12('marketing', 'marketing', platformOpEx(platform.opex_per_unit_annual.marketing), bpMktg);
  const office = opexFromT12('office', 'office', null);
  const gAndA = opexFromT12('g_and_a', 'g_and_a', platformOpEx(platform.opex_per_unit_annual.g_and_a), bpGA);
  const hoaDues = opexFromT12('hoa_dues', 'hoa_dues', null);
  const utilities = opexFromT12('utilities', 'utilities', platformOpEx(platform.opex_per_unit_annual.utilities), bpUtils);

  // Utility sub-lines — T12 parser aggregates all utilities into the compound
  // `utilities` field, so these are null from T12 today. They exist so users
  // can override individual utility types; when any has a resolved value,
  // total_opex uses their sum instead of the compound field. Task #672.
  const waterSewer = opexFromT12('water_sewer', 'water_sewer', null);
  const electric   = opexFromT12('electric',    'electric',    null);
  const gasFuel    = opexFromT12('gas_fuel',    'gas_fuel',    null);
  // Landscaping — T12 parser maps this to contract_services; null from T12.
  // Seeded so users can split it out manually. Task #672.
  const landscaping = opexFromT12('landscaping', 'landscaping', null);

  const personalPropTax = opexFromT12('personal_property_tax', 'personal_property_tax', null);

  // ───────── CUSTOM LINE ITEMS (unrecognized GL rows captured by parser) ─────────
  // Keys are sanitized description labels prefixed with "custom_opex_".
  // They are included in total_opex_resolved so NOI is accurate.
  // IMPORTANT: We filter out revenue lines, rollup/subtotal rows, and below-the-line
  // items (debt service, interest) that the parser didn't categorize but are NOT opex.
  const rawCustomItems = (t12Opex?.custom_line_items ?? {}) as Record<string, number>;
  const sanitizeKey = (label: string) =>
    'custom_opex_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  
  const customOpexItems: Record<string, LayeredValue<number>> = {};
  let excludedCustomTotal = 0;
  const excludedLabels: string[] = [];
  
  for (const [label, amount] of Object.entries(rawCustomItems)) {
    if (typeof amount !== 'number' || Math.abs(amount) < 1) continue;
    
    // Filter out non-opex items
    if (isExcludedFromOpex(label)) {
      excludedCustomTotal += amount;
      excludedLabels.push(label);
      continue;
    }
    
    const key = sanitizeKey(label);
    const existingOverride = getOverride(key);
    customOpexItems[key] = resolve(key, null, {
      t12: amount,
      existingOverride,
      priority: ['t12'],
    });
    (customOpexItems[key] as unknown as Record<string, unknown>)._label = label;
  }
  
  // Log excluded items for debugging (only if significant)
  if (excludedLabels.length > 0 && Math.abs(excludedCustomTotal) > 10000) {
    console.log(`[proforma-seeder] Excluded ${excludedLabels.length} non-opex custom items totaling $${Math.round(excludedCustomTotal).toLocaleString()}: ${excludedLabels.slice(0, 5).join(', ')}${excludedLabels.length > 5 ? '...' : ''}`);
  }

  const mgmt_t12_pct = t12egi > 0 ? (num(t12Opex, 'mgmt_fee') ?? 0) / t12egi : null;
  const mgmtFeePct = resolve('management_fee_pct', platform.management_fee_pct_egi, {
    t12: mgmt_t12_pct,
    om: bpMgmtPct,
    existingOverride: getOverride('management_fee_pct'),
  });

  const insurancePlatform = platformOpEx(platform.opex_per_unit_annual.insurance);
  const t12Ins = num(t12Opex, 'insurance');
  const insurance = resolve('insurance', insurancePlatform, {
    t12: t12Ins,
    om: bpInsur,
    existingOverride: getOverride('insurance'),
    warning: (t12Ins == null && t12Capsule != null)
      ? 'No property insurance line in T12 — using platform baseline. Confirm with insurance binder.'
      : undefined,
  });

  // Real estate tax — tax bill scenarios
  let realEstateTax: LayeredValue<number>;
  if (taxBillCapsule) {
    const scenarios: Record<string, number> = {};
    const billCurrent = num(taxBillCapsule, 'annual_tax_current') ?? num(taxBillCapsule, 'totalAnnualTax') ?? 0;
    const billUnappealed = num(taxBillCapsule, 'annual_tax_unappealed') ?? billCurrent;
    const appealStatus = taxBillCapsule.appeal_status ?? taxBillCapsule.appealStatus;
    if (appealStatus === 'pending') {
      scenarios.appeal_settled_at_current = billCurrent;
      scenarios.appeal_lost_unappealed = billUnappealed;
    }
    realEstateTax = resolve('real_estate_tax', null, {
      tax_bill: billCurrent,
      t12: num(t12Opex, 'real_estate_tax'),
      om: bpTax,
      existingOverride: getOverride('real_estate_tax'),
      scenarios,
      warning: appealStatus === 'pending'
        ? `Tax bill under appeal. Base case $${Math.round(billCurrent).toLocaleString()}; downside if lost: $${Math.round(billUnappealed).toLocaleString()}.`
        : undefined,
    });
    // IC-04 tie-break: when |t12 − tax_bill| / tax_bill > 0.15, prefer T-12.
    // Override always wins (already handled inside resolve()), so only apply
    // when current resolution is 'tax_bill'. The assessor bill is often a
    // pre-reassessment figure that understates true carry; T-12 reflects what
    // the seller actually paid.
    if (
      realEstateTax.resolution === 'tax_bill' &&
      realEstateTax.t12 != null &&
      realEstateTax.tax_bill != null &&
      realEstateTax.tax_bill !== 0 &&
      Math.abs((realEstateTax.t12 - realEstateTax.tax_bill) / realEstateTax.tax_bill) > 0.15
    ) {
      realEstateTax.resolved = realEstateTax.t12;
      realEstateTax.resolution = 't12';
    }
  } else {
    realEstateTax = opexFromT12('real_estate_tax', 'real_estate_tax', null, bpTax);
  }

  // ── Preserve tax-engine platform slot ────────────────────────────────────
  // proforma-adjustment.service.ts writes taxService.forecast()'s Year 1 RE tax
  // to deal_assumptions.year1.real_estate_tax.platform (fire-and-forget).
  // When the seeder runs on a deal that already has that persisted value, carry
  // it forward into the new seed so the proforma PLATFORM column stays populated.
  // The existing user override / t12 / tax_bill resolution is not disturbed.
  {
    const exTaxPlatform = (() => {
      const exField = (ex as Record<string, unknown>).real_estate_tax;
      if (!exField || typeof exField !== 'object') return null;
      const v = (exField as Record<string, unknown>).platform;
      return typeof v === 'number' && isFinite(v) ? v : null;
    })();
    if (exTaxPlatform != null && realEstateTax.platform == null) {
      realEstateTax.platform = exTaxPlatform;
      // Promote to resolved only when no higher-priority source already won.
      const HIGH_PRIORITY = new Set(['override', 't12', 'tax_bill', 'rent_roll', 'box_score']);
      if (!realEstateTax.resolution || !HIGH_PRIORITY.has(realEstateTax.resolution as string)) {
        realEstateTax.resolved   = exTaxPlatform;
        realEstateTax.resolution = 'platform';
      }
    }
  }

  // ───────── DERIVED FIELDS ─────────
  // v31 spec: bad debt is deducted from gross rental income, not from EGI.
  // NRI = GPR × (1 − ltl − vacancy − concessions − nru − bad_debt).
  // EGI = NRI + Other Income (no further bad-debt adjustment). Task #672.
  const gprResolved = gpr.resolved ?? 0;
  const nri_resolved = gprResolved
    - gprResolved * (lossToLeasePct.resolved ?? 0)
    - gprResolved * (vacancyPct.resolved ?? 0)
    - gprResolved * (concessionsPct.resolved ?? 0)
    - gprResolved * (nonRevenueUnitsPct.resolved ?? 0)
    - gprResolved * (badDebtPct.resolved ?? 0);

  // Platform computation for derived rows — mirrors the resolved formula but
  // uses the .platform slot from each component. Null-coalesces to 0 so that
  // partially-populated baselines still produce a meaningful aggregate.
  const gprPlatform = gpr.platform ?? 0;
  const nri_platform = gprPlatform > 0
    ? gprPlatform
      - gprPlatform * (lossToLeasePct.platform ?? 0)
      - gprPlatform * (vacancyPct.platform ?? 0)
      - gprPlatform * (concessionsPct.platform ?? 0)
      - gprPlatform * (nonRevenueUnitsPct.platform ?? 0)
      - gprPlatform * (badDebtPct.platform ?? BASE_BAD_DEBT_PCT)
    : null;

  const netRentalIncome: LayeredValue<number> = {
    platform: nri_platform, override: null,
    resolved: nri_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  // EGI uses the SUM of per-category breakdown + user-added lines, NOT the
  // aggregate `otherIncomeTotal` LayeredValue. Per-category resolution may
  // mix RR + OM and produce a different total than any single source's
  // headline figure — using the sum preserves provenance fidelity. Task #519.
  const breakdownSum = Object.values(otherIncomeBreakdown)
    .reduce((s, lv) => s + (lv.resolved ?? 0), 0);
  const userLinesAnnual = (userLines ?? [])
    .reduce((s, l) => s + (Number.isFinite(l.monthly) ? l.monthly * 12 : 0), 0);
  const otherIncomeForEgi = breakdownSum + userLinesAnnual;
  const egi_resolved = nri_resolved + otherIncomeForEgi;

  // Sync the per-unit aggregate from the breakdown so the F11 main "Other
  // Income" row (which the composer renders as `other_income_per_unit ×
  // units × 12`) matches the per-category resolution shown in the expansion
  // panel. Without this, the main row picks the raw RR/OM/T-12 aggregate
  // (e.g. RR's partial sum across only the lines that have data) and
  // diverges from the actual breakdown total. Preserve a user override.
  // Task #519 (composer/seeder parity for F11 main row).
  if (totalUnits > 0 && otherIncomePerUnit.resolution !== 'override') {
    otherIncomePerUnit.resolved = otherIncomeForEgi / totalUnits / months;
    otherIncomePerUnit.updated_at = now();
  }
  // Bad debt is now applied to NRI (not EGI), so EGI = NRI + Other Income.
  // No further bad-debt deduction here. Task #672.
  const egi_platform = nri_platform;

  const egi: LayeredValue<number> = {
    platform: egi_platform, override: null,
    resolved: egi_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  const mgmtFeeDollar = egi_resolved * (mgmtFeePct.resolved ?? 0);

  const customOpexTotal = Object.values(customOpexItems).reduce((s, lv) => s + (lv.resolved ?? 0), 0);

  // Utility contribution: when any sub-line (water_sewer/electric/gas_fuel) has
  // been explicitly resolved (non-null), use their sum in place of the compound
  // `utilities` field so user-level splits flow into NOI.
  // Null-check (not > 0) so an explicit override of $0 still takes effect.
  // Fall back to `utilities` (T12 aggregate) only when all sub-lines are null.
  // Task #672.
  const anyUtilSubResolved =
    waterSewer.resolved != null ||
    electric.resolved   != null ||
    gasFuel.resolved    != null;
  const utilContrib = anyUtilSubResolved
    ? (waterSewer.resolved ?? 0) + (electric.resolved ?? 0) + (gasFuel.resolved ?? 0)
    : (utilities.resolved ?? 0);

  const total_opex_resolved =
    (payroll.resolved ?? 0) + (repairsMaintenance.resolved ?? 0) + (turnover.resolved ?? 0) +
    (amenities.resolved ?? 0) + (contractServices.resolved ?? 0) + (marketing.resolved ?? 0) +
    (office.resolved ?? 0) + (gAndA.resolved ?? 0) + (hoaDues.resolved ?? 0) +
    utilContrib + mgmtFeeDollar + (realEstateTax.resolved ?? 0) +
    (personalPropTax.resolved ?? 0) + (insurance.resolved ?? 0) +
    (landscaping.resolved ?? 0) + customOpexTotal;

  // Platform total_opex: sum of per-line platform slots.
  // Management fee platform = egi_platform × mgmtFeePct.platform.
  // Custom opex lines and utility sub-lines have no platform baseline;
  // compound utilities platform is used as the proxy. Task #672.
  const mgmtFeeDollarPlatform = egi_platform != null
    ? egi_platform * (mgmtFeePct.platform ?? 0)
    : 0;
  const total_opex_platform = (
    (payroll.platform ?? 0) + (repairsMaintenance.platform ?? 0) + (turnover.platform ?? 0) +
    (amenities.platform ?? 0) + (contractServices.platform ?? 0) + (marketing.platform ?? 0) +
    (office.platform ?? 0) + (gAndA.platform ?? 0) + (hoaDues.platform ?? 0) +
    (utilities.platform ?? 0) + mgmtFeeDollarPlatform + (realEstateTax.platform ?? 0) +
    (personalPropTax.platform ?? 0) + (insurance.platform ?? 0)
  ) || null;

  const totalOpex: LayeredValue<number> = {
    platform: total_opex_platform, override: null,
    resolved: total_opex_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  const noi_resolved = egi_resolved - total_opex_resolved;
  const noi_platform = egi_platform != null && total_opex_platform != null
    ? egi_platform - total_opex_platform
    : null;

  const noi: LayeredValue<number> = {
    platform: noi_platform, override: null,
    om: bpNOI,
    resolved: noi_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  const replacementReserves: LayeredValue<number> = resolve('replacement_reserves', null, {
    t12: num(t12Opex, 'replacement_reserves'),
    om: bpReserves,
    existingOverride: getOverride('replacement_reserves'),
    priority: ['t12', 'om'],
  });

  return {
    gpr,
    loss_to_lease_pct: lossToLeasePct,
    vacancy_pct: vacancyPct,
    concessions_pct: concessionsPct,
    bad_debt_pct: badDebtPct,
    non_revenue_units_pct: nonRevenueUnitsPct,
    net_rental_income: netRentalIncome,
    other_income_per_unit: otherIncomePerUnit,
    other_income_breakdown: otherIncomeBreakdown,
    other_income_user_lines: userLines,
    egi,
    payroll,
    repairs_maintenance: repairsMaintenance,
    turnover,
    amenities,
    contract_services: contractServices,
    marketing,
    office,
    g_and_a: gAndA,
    hoa_dues: hoaDues,
    utilities,
    water_sewer: waterSewer,
    electric,
    gas_fuel: gasFuel,
    landscaping,
    management_fee_pct: mgmtFeePct,
    insurance,
    real_estate_tax: realEstateTax,
    personal_property_tax: personalPropTax,
    replacement_reserves: replacementReserves,
    total_opex: totalOpex,
    noi,
    noi_per_unit: {
      platform: noi_platform != null && totalUnits > 0 ? noi_platform / totalUnits : null,
      override: null,
      resolved: totalUnits > 0 ? noi_resolved / totalUnits : null,
      resolution: 'platform_fallback',
      updated_at: now(),
    },
    source_docs: {
      t12_doc_id: (t12Capsule?.document_id as string) ?? undefined,
      rent_roll_doc_id: (rrCapsule?.document_id as string) ?? undefined,
      tax_bill_doc_id: (taxBillCapsule?.document_id as string) ?? undefined,
      om_doc_id: (omCapsule?.document_id as string) ?? undefined,
    },
    _unit_count: totalUnits,
    last_seeded_at: now(),
    // Custom (previously unrecognized) GL line items from T12
    ...customOpexItems,
  };
}

/**
 * Emit a structured JSON log after seedProFormaYear1 completes.
 * Stdout-only — no DB write. Consumed by the Data Quality Agent (Task #691)
 * as the primary signal for SEED_PLUMBING findings.
 *
 * Opex field naming note: extraction_t12.opex uses abbreviated keys that map to
 * ProFormaYear1Seed fields as follows:
 *   opex.contract       → contract_services.t12
 *   opex.r_and_m        → repairs_maintenance.t12
 *   opex.mgmt_fee       → management_fee_pct.t12 (as % of EGI)
 *   opex.real_estate_tax → real_estate_tax.t12
 */
function emitSeedObservabilityLog(
  dealId: string,
  capsule: Capsule,
  seed: ProFormaYear1Seed
): void {
  const uploaded_sources: string[] = [];
  if (capsule.extraction_om)        uploaded_sources.push('om');
  if (capsule.extraction_t12)       uploaded_sources.push('t12');
  if (capsule.extraction_rent_roll) uploaded_sources.push('rent_roll');
  if (capsule.extraction_tax_bill)  uploaded_sources.push('tax_bill');

  type TrackedField = { field: keyof ProFormaYear1Seed; slots: string[] };
  const TRACKED: TrackedField[] = [
    { field: 'gpr',             slots: ['om', 't12', 'rent_roll', 'platform'] },
    { field: 'real_estate_tax', slots: ['om', 't12', 'tax_bill',  'platform'] },
    { field: 'contract_services', slots: ['om', 't12', 'platform'] },
    { field: 'vacancy_pct',     slots: ['t12', 'rent_roll', 'platform'] },
    { field: 'payroll',         slots: ['t12', 'platform'] },
  ];

  const SOURCE_SLOT_MAP: Record<string, Array<{ field: string; slot: string }>> = {
    om: [
      { field: 'gpr',             slot: 'om' },
      { field: 'real_estate_tax', slot: 'om' },
      { field: 'contract_services', slot: 'om' },
    ],
    t12: [
      { field: 'gpr',             slot: 't12' },
      { field: 'real_estate_tax', slot: 't12' },
      { field: 'contract_services', slot: 't12' },
      { field: 'vacancy_pct',     slot: 't12' },
      { field: 'payroll',         slot: 't12' },
    ],
    rent_roll: [
      { field: 'gpr',         slot: 'rent_roll' },
      { field: 'vacancy_pct', slot: 'rent_roll' },
    ],
    tax_bill: [
      { field: 'real_estate_tax', slot: 'tax_bill' },
    ],
  };

  const year1_slot_population: Record<string, Record<string, string>> = {};
  for (const { field, slots } of TRACKED) {
    const lv = seed[field] as (LayeredValue<number> & Record<string, unknown>) | undefined;
    if (!lv) continue;
    year1_slot_population[field as string] = {};
    for (const slot of slots) {
      const val = lv[slot] as number | null | undefined;
      year1_slot_population[field as string][slot] = val != null ? 'populated' : 'null';
    }
  }

  type Gap = { field: string; slot: string; expected: string; actual: string; uploaded_source: string };
  const expected_vs_actual_gaps: Gap[] = [];
  for (const source of uploaded_sources) {
    for (const { field, slot } of (SOURCE_SLOT_MAP[source] ?? [])) {
      if (year1_slot_population[field]?.[slot] === 'null') {
        expected_vs_actual_gaps.push({
          field, slot, expected: 'populated', actual: 'null', uploaded_source: source,
        });
      }
    }
  }

  const entry: Record<string, unknown> = {
    event: 'seed.complete',
    deal_id: dealId,
    timestamp: new Date().toISOString(),
    uploaded_sources,
    year1_slot_population,
  };
  if (expected_vs_actual_gaps.length > 0) {
    entry.expected_vs_actual_gaps = expected_vs_actual_gaps;
  }
  logger.info('seed.complete', entry);
}

/**
 * Public entry point: re-seed the deal's ProForma Year-1 assumptions.
 * Called by data-router after every successful extraction.
 */
export async function seedProFormaYear1(
  pool: Pool,
  dealId: string
): Promise<{ seeded: boolean; fields_seeded: number; warnings: string[]; resolved_noi: number | null }> {
  const warnings: string[] = [];

  try {
    // Load deal + capsule (city + state_code needed for platform baseline lookup)
    const dealResult = await pool.query(
      `SELECT id, target_units, deal_data, city, state_code FROM deals WHERE id = $1`,
      [dealId]
    );
    if (dealResult.rows.length === 0) {
      return { seeded: false, fields_seeded: 0, warnings: ['Deal not found'], resolved_noi: null };
    }
    const deal = dealResult.rows[0];
    const capsule: Capsule = (typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data) : deal.deal_data) || {};

    const t12Capsule = obj(capsule, 'extraction_t12');
    const rrCapsule = obj(capsule, 'extraction_rent_roll');
    const taxBillCapsule = obj(capsule, 'extraction_tax_bill');
    const omCapsule = obj(capsule, 'extraction_om');

    if (!t12Capsule && !rrCapsule && !taxBillCapsule && !omCapsule) {
      return { seeded: false, fields_seeded: 0, warnings: ['No extraction sources available'], resolved_noi: null };
    }

    const totalUnits = num(rrCapsule, 'total_units') ?? deal.target_units ?? 0;

    // Resolve platform baseline from market snapshot + state-calibrated industry norms.
    // Provides non-null values for every platform slot so benchmarkPosition can render.
    const platform: PlatformBaseline = await lookupPlatformBaseline(
      pool,
      deal.city as string | null,
      deal.state_code as string | null,
    );

    // P0 fix: load existingSeed preferring the active scenario year1.
    // The scenario is the canonical write target for the cashflow agent, so its
    // year1 contains the most up-to-date agent sub-keys. Reading from
    // deal_assumptions can miss those values when the seeder runs after an agent
    // write (the trigger syncs scenario→deal_assumptions, but an older seeder run
    // may have overwrote deal_assumptions in the interim).
    // P0 fix (Task #869): read active scenario first.
    // Error policy: failures are logged at ERROR; the seeder falls back to
    // deal_assumptions so the build-seed step does not crash, but the
    // empty activeScenId means the scenario write path is skipped and the
    // legacy deal_assumptions path is used instead — preserving correctness
    // at the cost of not updating the scenario. This is surfaced in logs.
    type ActiveScenRow = { id: string; year1: unknown };
    type ActiveScenResult = { rows: ActiveScenRow[] };
    const EMPTY_SCEN_RESULT: ActiveScenResult = { rows: [] };

    const activeScenRes = await pool.query<ActiveScenRow>(
      `SELECT id, year1 FROM deal_underwriting_scenarios
        WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL LIMIT 1`,
      [dealId]
    ).catch((err: unknown) => {
      logger.error('[seeder][P0] scenario row query failed; will fall back to deal_assumptions write', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return EMPTY_SCEN_RESULT;
    });
    const activeScenId: string | null = activeScenRes.rows[0]?.id ?? null;

    type ExistingRow = { year1: unknown };
    const existing = await pool.query<ExistingRow>(
      `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    ).catch((err: unknown) => {
      logger.error('[seeder][P0] deal_assumptions year1 query failed', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return { rows: [] as ExistingRow[] };
    });

    // Prefer scenario year1 (has agent sub-keys); fall back to deal_assumptions.
    const rawExistingSeed = activeScenRes.rows[0]?.year1 ?? existing.rows[0]?.year1 ?? null;
    const existingSeed = rawExistingSeed
      ? (typeof rawExistingSeed === 'string' ? JSON.parse(rawExistingSeed) : rawExistingSeed)
      : null;

    const bcRaw = capsule?.broker_claims;
    const bcObj = bcRaw && typeof bcRaw === 'object' ? bcRaw as Record<string, unknown> : null;
    const bpRaw = bcObj?.proforma;
    const bpProforma = bpRaw && typeof bpRaw === 'object' ? bpRaw as Record<string, unknown> : null;
    const seed = buildSeed(totalUnits, platform, t12Capsule, rrCapsule, taxBillCapsule, omCapsule, existingSeed, bpProforma);

    // Task #838 — Re-apply Cashflow Agent sub-keys after re-seed.
    //
    // buildSeed preserves operator overrides (via getOverride()) but has no
    // equivalent for agent-written values.  Without this step, uploading a new
    // document would silently erase every AI analysis result (resolution='agent')
    // from the 16 AGENT_FIELD_TO_YEAR1 fields.
    //
    // Rules:
    //   1. Only re-apply when existingSeed[field].resolution === 'agent'
    //      (the agent was the winning source before the re-seed).
    //   2. Skip re-application if the newly-built field already has a live
    //      operator override — override beats agent.
    //   3. For agent-created fields that buildSeed never produces
    //      (management_fee_dollars, vacancy_loss_dollars, bad_debt_dollars,
    //      other_income_dollars): copy the entire LayeredValue so these fields
    //      are not silently dropped from the JSONB on every re-seed.
    if (existingSeed) {
      const seedRecord = seed as unknown as Record<string, unknown>;
      for (const [fieldKey, rawLv] of Object.entries(existingSeed as Record<string, unknown>)) {
        if (!rawLv || typeof rawLv !== 'object') continue;
        const lv = rawLv as Record<string, unknown>;
        const agentVal = lv.agent;
        if (
          agentVal === null || agentVal === undefined ||
          typeof agentVal !== 'number' || !isFinite(agentVal as number) ||
          lv.resolution !== 'agent'
        ) {
          continue;
        }

        const newField = seedRecord[fieldKey];
        if (newField !== null && newField !== undefined && typeof newField === 'object') {
          // Field exists in the new seed: re-apply agent sub-key only if no
          // operator override is winning (override === non-null finite number).
          const newLv = newField as Record<string, unknown>;
          const hasOperatorOverride =
            newLv.override !== null &&
            newLv.override !== undefined &&
            typeof newLv.override === 'number' &&
            isFinite(newLv.override as number);
          if (!hasOperatorOverride) {
            newLv.agent      = agentVal;
            newLv.resolved   = agentVal;
            newLv.resolution = 'agent';
          }
        } else if (newField === undefined) {
          // Agent-created field not produced by buildSeed — copy verbatim so
          // it survives the re-seed write without being dropped.
          seedRecord[fieldKey] = { ...lv };
        }
      }
    }

    // F-010 write-path guard: validate seed before DB write. If any field
    // slipped through getOverride() with override === om AND no override_source,
    // auto-heal here so contaminated data can NEVER reach the database.
    // This is a defense-in-depth layer — getOverride() should have already
    // returned null for such fields; if this fires it indicates a code regression.
    for (const [field, value] of Object.entries(seed)) {
      if (!value || typeof value !== 'object' || !('override' in value)) continue;
      const lv = value as Record<string, unknown>;
      if (
        lv.override != null &&
        lv.om != null &&
        lv.override === lv.om &&
        (lv.override_source == null || lv.override_source === undefined)
      ) {
        console.error(
          `[F-010 write-guard] BUG: contaminated override in field "${field}" for deal ${dealId}.` +
          ` override=${lv.override} equals om=${lv.om} with no override_source.` +
          ` Auto-healing: clearing override and re-resolving from t12/platform.`
        );
        lv.override = null;
        // Re-resolve following the standard priority: t12 → om → platform → null.
        // om is included so OM-only fields (no t12) still resolve to a sensible
        // value rather than being downgraded to platform_fallback incorrectly.
        if ('t12' in lv && lv.t12 != null) {
          lv.resolved = lv.t12;
          lv.resolution = 't12';
        } else if ('om' in lv && lv.om != null) {
          lv.resolved = lv.om;
          lv.resolution = 'om';
        } else if ('platform' in lv && lv.platform != null) {
          lv.resolved = lv.platform;
          lv.resolution = 'platform_fallback';
        } else {
          lv.resolved = null;
          lv.resolution = 'platform_fallback';
        }
        warnings.push(`F-010 auto-healed: ${field} (override was equal to om with no source)`);
      }
    }

    // Surface warnings from any layered value
    for (const [k, v] of Object.entries(seed)) {
      if (v && typeof v === 'object' && 'warning' in v && (v as Record<string, unknown>).warning) {
        warnings.push(`${k}: ${(v as Record<string, unknown>).warning}`);
      }
    }

    // P0 fix: write year1 to the active scenario when one exists.
    // The trigger (trg_sync_underwriting_scenario) propagates the change to
    // deal_assumptions.year1 automatically, so all existing readers remain correct.
    // For deals without an active scenario, write directly to deal_assumptions.
    //
    // SCENARIO PATH: atomic extraction-layer sub-key merge via SQL.
    //
    // Only the document-sourced slots (t12, om, rent_roll, tax_bill, box_score,
    // aged_ar, platform, warning) are written from the new seed.  Sub-keys owned
    // by the cashflow agent (agent, resolved, resolution, override, override_source,
    // updated_by, updated_at) are NEVER in the extractionDelta and are therefore
    // preserved from the DB's current year1 value — by construction.
    //
    // Atomicity / lost-update guarantee
    // ─────────────────────────────────
    // PostgreSQL evaluates all expressions in a SET clause against the
    // PRE-UPDATE row.  The `year1` references inside the SQL below therefore
    // always read the value that was committed to the DB at the moment this
    // statement executes — INCLUDING any concurrent agent write that completed
    // after our earlier SELECT but before this UPDATE.  No application-level
    // read-merge-write is performed; the merge happens entirely inside the DB.
    //
    // The four agent-only fields (bad_debt_dollars, vacancy_loss_dollars,
    // other_income_dollars, management_fee_dollars) exist only in the DB's
    // year1; they are not in extractionDelta or seedJson, so they are
    // preserved by the jsonb_object_agg over jsonb_each(year1) in Step 1.
    // Build the extraction-only delta — only document-sourced sub-keys.
    // Agent-protected sub-keys (agent, resolved, resolution, override,
    // override_source, updated_by, updated_at) are never included here, so
    // they are always preserved by DB-level field merges in both paths below.
    const EXTRACTION_SUBKEYS = new Set([
      't12', 'om', 'rent_roll', 'tax_bill', 'box_score', 'aged_ar', 'platform', 'warning',
    ]);
    const extractionDelta: Record<string, Record<string, unknown>> = {};
    for (const [fieldKey, seedValue] of Object.entries(seed as unknown as Record<string, unknown>)) {
      if (!seedValue || typeof seedValue !== 'object') continue; // skip scalars
      const seedLv = seedValue as Record<string, unknown>;
      const extractionOnly: Record<string, unknown> = {};
      for (const sk of EXTRACTION_SUBKEYS) {
        if (sk in seedLv) extractionOnly[sk] = seedLv[sk];
      }
      if (Object.keys(extractionOnly).length > 0) extractionDelta[fieldKey] = extractionOnly;
    }

    if (activeScenId) {
      // Step B: atomic SQL merge.
      //
      // $2 = extractionDelta  — {field: {t12:.., om:.., platform:..}, ...}
      //   For EXISTING fields: value || ($2->key) merges only extraction
      //   sub-keys into the DB field; agent/resolved/resolution/override
      //   remain untouched because they are not present in $2.
      //
      // $3 = full seed JSON — used only for NEW fields (those absent from
      //   the DB year1).  For new fields the agent has never written values
      //   yet, so the full seed LayeredValue (with resolved/resolution from
      //   buildSeed) is the correct initial state.
      await pool.query(
        `UPDATE deal_underwriting_scenarios
            SET year1 = (
              -- Step 1: iterate existing fields; merge extraction delta into
              -- each field that appears in $2, leave others untouched.
              -- COALESCE guards against jsonb_object_agg returning NULL when
              -- year1 is empty ({}) or has no rows — NULL || jsonb = NULL,
              -- which would wipe year1 on the first seed of a new scenario.
              COALESCE(
                (SELECT jsonb_object_agg(
                  key,
                  CASE
                    WHEN $2::jsonb ? key
                    THEN value || ($2::jsonb->key)
                    ELSE value
                  END
                )
                FROM jsonb_each(COALESCE(year1, '{}')) j(key, value))
              , '{}'::jsonb)
            ) || (
              -- Step 2: add new fields that do not yet exist in year1 at all.
              -- Uses the full seed LayeredValue (resolved+resolution included).
              SELECT COALESCE(jsonb_object_agg(dk, dv), '{}'::jsonb)
              FROM jsonb_each($3::jsonb) jd(dk, dv)
              WHERE NOT (COALESCE(year1, '{}') ? dk)
            ),
            updated_at = NOW()
          WHERE id = $1`,
        [activeScenId, JSON.stringify(extractionDelta), JSON.stringify(seed)]
      );
      // Keep deal_assumptions metadata columns (non-year1) in sync separately.
      // The trigger trg_sync_underwriting_scenario handles year1 mirroring on
      // scenario UPDATEs, but only if a deal_assumptions row already exists —
      // trigger fires UPDATE with no target if the row is missing, leaving
      // year1 = NULL on the subsequent INSERT.  To guard this edge case
      // (active scenario exists, deal_assumptions row does not yet exist),
      // we populate year1 from the current scenario seed on INSERT only.
      // ON CONFLICT (row already exists) leaves year1 untouched — the trigger
      // already fired before this statement and has synced the correct value.
      await pool.query(
        `INSERT INTO deal_assumptions
           (deal_id, total_units, vacancy_pct, other_income_per_unit,
            source_type, source_date, year1, created_at, updated_at)
         VALUES ($1, $2, $3, COALESCE($4::numeric, 50),
                 'platform_seeded', NOW(), $5::jsonb, NOW(), NOW())
         ON CONFLICT (deal_id) DO UPDATE SET
           total_units            = EXCLUDED.total_units,
           vacancy_pct            = EXCLUDED.vacancy_pct,
           other_income_per_unit  = EXCLUDED.other_income_per_unit,
           source_type            = 'platform_seeded',
           source_date            = NOW(),
           updated_at             = NOW()
           -- year1 intentionally excluded: trigger already synced it from
           -- the scenario UPDATE above; overwriting from seed would clobber
           -- agent sub-keys that the trigger just mirrored.`,
        [
          dealId,
          seed._unit_count,
          seed.vacancy_pct?.resolved != null ? Math.round(seed.vacancy_pct.resolved * 10000) / 100 : null,
          seed.other_income_per_unit?.resolved,
          JSON.stringify(seed),
        ]
      );
    } else {
      // No active scenario — write year1 directly to deal_assumptions (legacy path).
      //
      // LEGACY PATH: same atomic extraction-layer sub-key merge as the scenario
      // path above, applied directly to deal_assumptions.
      //
      // $1 = dealId
      // $2 = full seed JSON  — used for the INSERT values and for NEW fields in
      //        the ON CONFLICT merge (fields that do not yet exist in year1).
      // $3 = extractionDelta — used for EXISTING fields: only document-sourced
      //        sub-keys (t12, om, rent_roll, ...) are merged in; agent/resolved/
      //        resolution/override sub-keys are never present here and are
      //        therefore preserved by the DB-level jsonb_object_agg merge.
      // $4 = total_units, $5 = vacancy_pct, $6 = other_income_per_unit
      await pool.query(
        `INSERT INTO deal_assumptions
           (deal_id, year1, total_units, vacancy_pct, other_income_per_unit,
            source_type, source_date, created_at, updated_at)
         VALUES ($1, $2::jsonb, $4, $5,
                 COALESCE($6::numeric, 50),
                 'platform_seeded', NOW(), NOW(), NOW())
         ON CONFLICT (deal_id) DO UPDATE SET
           year1 = (
             -- Step 1: iterate existing fields; merge extraction delta into
             -- each field that appears in $3, leave others (including agent-
             -- written fields like real_estate_tax with resolution='agent')
             -- completely untouched.
             COALESCE(
               (SELECT jsonb_object_agg(
                 key,
                 CASE
                   WHEN $3::jsonb ? key
                   THEN value || ($3::jsonb->key)
                   ELSE value
                 END
               )
               FROM jsonb_each(COALESCE(deal_assumptions.year1, '{}')) j(key, value))
             , '{}'::jsonb)
           ) || (
             -- Step 2: add new fields that do not yet exist in year1.
             -- Uses the full seed LayeredValue (agent has never written here yet).
             SELECT COALESCE(jsonb_object_agg(dk, dv), '{}'::jsonb)
             FROM jsonb_each($2::jsonb) jd(dk, dv)
             WHERE NOT (COALESCE(deal_assumptions.year1, '{}') ? dk)
           ),
           total_units            = EXCLUDED.total_units,
           vacancy_pct            = EXCLUDED.vacancy_pct,
           other_income_per_unit  = EXCLUDED.other_income_per_unit,
           source_type            = 'platform_seeded',
           source_date            = NOW(),
           updated_at             = NOW()`,
        [
          dealId,
          JSON.stringify(seed),
          JSON.stringify(extractionDelta),
          seed._unit_count,
          seed.vacancy_pct?.resolved != null ? Math.round(seed.vacancy_pct.resolved * 10000) / 100 : null,
          seed.other_income_per_unit?.resolved,
        ]
      );
    }

    const fieldsSeeded = Object.values(seed).filter(
      (v: unknown) => v && typeof v === 'object' && 'resolved' in v && (v as LayeredValue<number>).resolved != null
    ).length;

    // Structured observability log — stdout only, no DB write.
    // Consumed by the Data Quality Agent (Task #691) as the primary signal
    // for SEED_PLUMBING findings (source uploaded but slot null).
    emitSeedObservabilityLog(dealId, capsule, seed);

    return {
      seeded: true,
      fields_seeded: fieldsSeeded,
      warnings,
      resolved_noi: seed.noi?.resolved ?? null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[seedProFormaYear1] error:', msg, stack);
    return {
      seeded: false,
      fields_seeded: 0,
      warnings: [`Seeder error: ${msg}`],
      resolved_noi: null,
    };
  }
}


/**
 * Seed sensible capital structure defaults for a deal.
 *
 * Writes ten platform-layer fields into deal_assumptions.year1 under the
 * `_capital_structure_defaults` key (does NOT overwrite operator overrides).
 * Fetches the current DGS10 rate from FRED and adds 200 bps CRE spread to
 * derive debt_rate; falls back to 6.5% if FRED is unavailable.
 *
 * Safe to call on any deal regardless of extraction capsule availability.
 * Idempotent — repeating the call only refreshes the platform rate.
 */
export async function seedCapitalStructureDefaults(
  pool: Pool,
  dealId: string,
): Promise<{ seeded: boolean; debt_rate: number; warnings: string[] }> {
  const warnings: string[] = [];
  const CRE_SPREAD_BPS = 200;
  const FALLBACK_DEBT_RATE = 0.065;
  const DEFAULT_AMORTIZATION = 30;
  const DEFAULT_LOAN_TERM = 5;
  // Rate cache TTL: 24 hours. Avoids a blocking FRED HTTP call on every
  // /financials request when defaults are already fresh.
  const RATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  let debtRate = FALLBACK_DEBT_RATE;

  // ── Check if recently seeded (rate cache) ──────────────────────────────────
  // If _capital_structure_defaults.seeded_at is within TTL, reuse the stored
  // debt_rate instead of calling FRED again.
  try {
    const staleCheck = await pool.query<{ debt_rate: string | null; seeded_at: string | null }>(
      `SELECT year1->'_capital_structure_defaults'->>'debt_rate' AS debt_rate,
              year1->'_capital_structure_defaults'->>'seeded_at' AS seeded_at
         FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    );
    const row = staleCheck.rows[0];
    if (row?.seeded_at && row?.debt_rate) {
      const ageMs = Date.now() - new Date(row.seeded_at).getTime();
      if (ageMs < RATE_CACHE_TTL_MS && !isNaN(parseFloat(row.debt_rate))) {
        // Defaults are fresh — skip FRED fetch; just re-seed with cached rate.
        debtRate = parseFloat(row.debt_rate);
        // Skip early here so we still re-write the LV block (idempotent).
      }
    }
  } catch {
    // Non-fatal — fall through to FRED fetch
  }

  // Only call FRED when cached rate is absent or stale
  if (debtRate === FALLBACK_DEBT_RATE) {
    try {
      const { FREDApiClient } = await import('../utils/fred-api.client');
      const fred = new FREDApiClient();
      const dgs10 = await fred.getLatest('DGS10');
      if (dgs10 && dgs10.value !== '.' && dgs10.value !== '') {
        const tenYear = parseFloat(dgs10.value);
        if (!isNaN(tenYear) && tenYear > 0) {
          debtRate = Math.round((tenYear / 100 + CRE_SPREAD_BPS / 10000) * 10000) / 10000;
        }
      }
    } catch (err) {
      warnings.push(`FRED unavailable — using fallback debt_rate ${FALLBACK_DEBT_RATE}`);
      logger.warn('[seedCapitalStructureDefaults] FRED fetch failed, using fallback', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const now = new Date().toISOString();

  // ── Canonical LayeredValue entries for capital structure fields ──────────
  // These are written at the 'platform' layer so F9's data quality audit can
  // see them and the proforma-adjustment service can resolve them as defaults.
  const canonicalLvFields: Record<string, unknown> = {
    ltv_pct: {
      resolved: 0.75,
      platform: 0.75,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    gp_equity_pct: {
      resolved: 0.10,
      platform: 0.10,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    lp_equity_pct: {
      resolved: 0.90,
      platform: 0.90,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    preferred_return_pct: {
      resolved: 0.08,
      platform: 0.08,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    gp_promote_pct: {
      resolved: 0.20,
      platform: 0.20,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    gp_promote_threshold_pct: {
      resolved: 0.08,
      platform: 0.08,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    gp_catchup_pct: {
      resolved: 0.50,
      platform: 0.50,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    debt_rate: {
      resolved: debtRate,
      platform: debtRate,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    amortization_years: {
      resolved: DEFAULT_AMORTIZATION,
      platform: DEFAULT_AMORTIZATION,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    io_period_months: {
      resolved: 0,
      platform: 0,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
    loan_term_years: {
      resolved: DEFAULT_LOAN_TERM,
      platform: DEFAULT_LOAN_TERM,
      broker: null,
      override: null,
      resolvedFrom: 'platform',
      alertLevel: 'ok',
    },
  };

  // ── Metadata block (supplemental, non-LayeredValue) ───────────────────────
  const defaults = {
    ...canonicalLvFields,
    _capital_structure_defaults: {
      ltv_pct:                  0.75,
      gp_equity_pct:            0.10,
      lp_equity_pct:            0.90,
      preferred_return_pct:     0.08,
      gp_promote_threshold_pct: 0.08,
      gp_promote_pct:           0.20,
      gp_catchup_pct:           0.50,
      amortization_years:       DEFAULT_AMORTIZATION,
      io_period_months:         0,
      loan_term_years:          DEFAULT_LOAN_TERM,
      debt_rate:                debtRate,
      seeded_at:                now,
      resolution:               'platform',
    },
  };

  try {
    // Non-destructive merge: defaults go first, existing year1 values overwrite
    // on top. This preserves any override-layer entries the user or Apply flow
    // has already written (e.g. ltv_pct.override set by PATCH /financials/override).
    const result = await pool.query(
      `UPDATE deal_assumptions
          SET year1      = $2::jsonb || COALESCE(year1, '{}'),
              updated_at = NOW()
        WHERE deal_id = $1`,
      [dealId, JSON.stringify(defaults)]
    );

    if ((result.rowCount ?? 0) === 0) {
      await pool.query(
        `INSERT INTO deal_assumptions (deal_id, year1, source_type, source_date, created_at, updated_at)
         VALUES ($1, $2::jsonb, 'platform_seeded', NOW(), NOW(), NOW())
         ON CONFLICT (deal_id) DO UPDATE
           SET year1      = $2::jsonb || COALESCE(deal_assumptions.year1, '{}'),
               updated_at = NOW()`,
        [dealId, JSON.stringify(defaults)]
      );
    }

    // ── Also write CS defaults to the active underwriting scenario ────────────
    // The trg_sync_underwriting_scenario trigger propagates scenario.year1 →
    // deal_assumptions.year1 on every agent write-back, clobbering any CS keys
    // we just wrote above. Writing to the scenario directly means the defaults
    // survive the sync trigger. Non-destructive merge: existing scenario values
    // (user overrides, agent values) always win over defaults.
    await pool.query(
      `UPDATE deal_underwriting_scenarios
          SET year1      = $2::jsonb || COALESCE(year1, '{}'),
              updated_at = NOW()
        WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [dealId, JSON.stringify(defaults)]
    ).catch(err =>
      logger.warn('[seedCapitalStructureDefaults] Scenario year1 write failed (non-fatal)', {
        dealId, error: err instanceof Error ? err.message : String(err),
      })
    );

    // ── Also write to deal_assumptions direct columns if currently NULL ──
    // This ensures composeCapitalStack reads live defaults from ltc/interest_rate
    // even before the Debt Advisor is opened for the first time.
    await pool.query(
      `UPDATE deal_assumptions
          SET interest_rate = COALESCE(interest_rate, $2),
              ltc           = COALESCE(ltc, $3),
              updated_at    = NOW()
        WHERE deal_id = $1`,
      [dealId, debtRate, 0.75]
    ).catch(err =>
      logger.warn('[seedCapitalStructureDefaults] Direct column update failed', {
        dealId, error: err instanceof Error ? err.message : String(err),
      })
    );

    logger.info('[seedCapitalStructureDefaults] Capital structure defaults seeded', {
      dealId, debtRate, ltv: 0.75,
    });

    return { seeded: true, debt_rate: debtRate, warnings };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[seedCapitalStructureDefaults] Failed to write defaults', { dealId, error: msg });
    return { seeded: false, debt_rate: debtRate, warnings: [...warnings, `Write failed: ${msg}`] };
  }
}

export async function ensureDealAssumptionsSeeded(
  pool: Pool,
  dealId: string,
  opts: { forceReseed?: boolean } = {}
): Promise<{ seeded: boolean; skipped: boolean; reason?: string }> {
  // Capital structure defaults are seeded unconditionally and awaited so that
  // the first getDealFinancials call sees them deterministically (no race).
  // FRED fetch is guarded internally with its own try/catch; this await
  // never throws to the caller.
  await seedCapitalStructureDefaults(pool, dealId).catch(err =>
    logger.warn('[ensureDealAssumptionsSeeded] seedCapitalStructureDefaults failed', {
      dealId, error: err instanceof Error ? err.message : String(err),
    })
  );

  // Check for an existing *proforma* seed, not just any year1 data.
  // seedCapitalStructureDefaults (called above) writes capital-structure keys
  // into year1 before this check runs. If we only test year1 != null, those
  // keys would satisfy the gate and prevent seedProFormaYear1 from ever running
  // on first-load deals with extraction capsules. We test for 'noi' (a key
  // written exclusively by seedProFormaYear1) as the proforma-seed sentinel.
  const existing = await pool.query(
    `SELECT year1->>'noi' IS NOT NULL AS has_proforma_seed
       FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
    [dealId]
  ).catch(() => ({ rows: [] }));

  const hasExistingSeed = existing.rows[0]?.has_proforma_seed === true
    || existing.rows[0]?.has_proforma_seed === 'true';

  if (hasExistingSeed && !opts.forceReseed) {
    return { seeded: false, skipped: true, reason: 'year1 already seeded' };
  }

  // Check deal has extraction data before attempting to seed
  const dealCheck = await pool.query(
    `SELECT id,
            deal_data->'extraction_t12' IS NOT NULL AS has_t12,
            deal_data->'extraction_rent_roll' IS NOT NULL AS has_rr,
            deal_data->'extraction_tax_bill' IS NOT NULL AS has_tax
       FROM deals WHERE id = $1`,
    [dealId]
  ).catch(() => ({ rows: [] }));

  const row = dealCheck.rows[0];
  if (!row) return { seeded: false, skipped: true, reason: 'deal not found' };

  if (!row.has_t12 && !row.has_rr && !row.has_tax) {
    return { seeded: false, skipped: true, reason: 'no extraction data available for deal' };
  }

  const result = await seedProFormaYear1(pool, dealId);
  return { seeded: result.seeded, skipped: false, reason: result.warnings.join('; ') || undefined };
}

/**
 * Apply a user override to a single field on the year1 seed.
 * Triggers a re-resolve so derived fields (NOI, EGI, Total OpEx) reflect the change.
 */
export async function applyUserOverride(
  pool: Pool,
  dealId: string,
  fieldPath: string,
  value: number | null,
  userId: string
): Promise<void> {
  // M40: prefer the active underwriting scenario as the source of year1.
  // Falls back to deal_assumptions for deals not yet bootstrapped by the migration.
  const scenarioRes = await pool.query(
    `SELECT id, year1 FROM deal_underwriting_scenarios
      WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
    [dealId]
  );
  const activeScenarioId: string | null = scenarioRes.rows[0]?.id ?? null;

  let rawYear1: unknown;
  if (activeScenarioId) {
    rawYear1 = scenarioRes.rows[0].year1;
  } else {
    const daRes = await pool.query(
      `SELECT year1 FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    if (daRes.rows.length === 0 || !daRes.rows[0].year1) {
      throw new Error('No year1 seed exists — upload at least one document first');
    }
    rawYear1 = daRes.rows[0].year1;
  }

  const seed = typeof rawYear1 === 'string' ? JSON.parse(rawYear1) : rawYear1;
  if (!seed) throw new Error('No year1 seed exists — upload at least one document first');

  const parts = fieldPath.split('.');
  let target: Record<string, unknown> = seed as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = target[parts[i]];
    if (next == null || typeof next !== 'object') throw new Error(`Field path invalid at "${parts[i]}"`);
    target = next as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1];
  let lv = target[lastKey];
  if (!lv || typeof lv !== 'object') {
    // Auto-wrap a bare scalar into a LayeredValue on first override.
    // Prevents pre-existing fields seeded as a raw number from rejecting
    // with a 400 when the user pencils an override in the Pro Forma tab.
    target[lastKey] = {
      broker: (typeof lv === 'number' ? lv : null),
      t12: null,
      rentRoll: null,
      platform: null,
      override: value,
      resolved: value,
      resolution: 'override',
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    lv = target[lastKey];
  }
  const field = lv as LayeredValue<number>;

  field.override = value;
  field.updated_at = new Date().toISOString();
  (field as LayeredValue<number> & { updated_by?: string }).updated_by = userId;
  // Stamp origin so agent write-back can distinguish deliberate operator
  // overrides from system-sourced values (e.g., seeder OM layer).
  // 'operator' = a human explicitly entered this value via the UI.
  // Use null (not undefined) for the clear case so JSON.stringify includes the
  // key in $4 and the SQL JSONB || merge explicitly removes the stale
  // 'operator' value from the DB rather than silently preserving it.
  (field as LayeredValue<number> & { override_source?: string | null }).override_source =
    value != null ? 'operator' : null;
  if (value != null) {
    field.resolved = value;
    field.resolution = 'override';
  } else {
    // Re-resolve using the same priority + skip-zero rules the initial seed uses,
    // so clearing an override on (e.g.) GPR falls back to T-12 instead of a
    // zero rent-roll value.
    reResolveClearedLayeredValue(field, fieldPath);
  }

  // Recompute derived fields (NOI, EGI, Total OpEx, NRI)
  recomputeDerived(seed);

  // ── Per-field jsonb merge-set (replaces full-replace UPDATE) ─────────────
  // The previous implementation did SET year1 = $full_seed which clobbered
  // agent sub-keys written by the Cashflow Agent for all 16 AGENT_FIELD_TO_YEAR1
  // fields on every operator save (finding P3-01 / Task #832).
  //
  // New strategy — two-layer merge:
  //
  // Layer A (top-level ||): derived fields (nri, egi, total_opex, noi, and
  //   optionally other_income_per_unit / noi_per_unit) are written as full
  //   field objects from the in-memory seed.  The agent NEVER writes to these
  //   fields so there is no race risk; their full objects already contain all
  //   DB-sourced sub-keys (the seed was read from DB at function entry).
  //
  // Layer B (jsonb_set sub-key merge): the operator-targeted field is updated
  //   at the sub-key level only (override, resolved, resolution, updated_at,
  //   updated_by, override_source).  All other sub-keys on that field —
  //   including any `agent` value written by the Cashflow Agent — are
  //   preserved from the DB's current value via the COALESCE(year1 #> path)
  //   read inside the SQL expression.
  //
  // In PostgreSQL, all `year1` references inside the SET expression read the
  // PRE-UPDATE column value, so the COALESCE correctly picks up any agent
  // sub-key written by a concurrent agent run that completed after our initial
  // SELECT but before this UPDATE.

  // Build derived-fields partial update (Layer A).
  const derivedUpdate: Record<string, unknown> = {};
  if (seed.net_rental_income) derivedUpdate.net_rental_income = seed.net_rental_income;
  if (seed.egi)               derivedUpdate.egi               = seed.egi;
  if (seed.total_opex)        derivedUpdate.total_opex        = seed.total_opex;
  if (seed.noi)               derivedUpdate.noi               = seed.noi;
  // other_income_per_unit: only if recomputeDerived touched it (resolution !== override)
  if (seed.other_income_per_unit && seed.other_income_per_unit.resolution !== 'override') {
    derivedUpdate.other_income_per_unit = seed.other_income_per_unit;
  }
  // noi_per_unit: optional field, only if present in seed
  if ((seed as Record<string, unknown>).noi_per_unit) {
    derivedUpdate.noi_per_unit = (seed as Record<string, unknown>).noi_per_unit;
  }
  // Remove target field from derivedUpdate if it overlaps (edge case: operator
  // targets a derived-field key directly).  Layer B will set it correctly.
  const rootKey = parts[0];
  delete derivedUpdate[rootKey];

  // Build target-field value (Layer B).
  // Use the full in-memory field object (not a sub-key delta).  This is safe
  // for two reasons:
  //   1. The in-memory field was loaded from DB then mutated — it already
  //      contains all DB-sourced sub-keys (t12, om, platform, broker, etc.)
  //      for the field.
  //   2. JSONB `||` (right supersedes left): `(db_field) || (field)`.  Only
  //      keys present in the right side win; any key in db_field that is NOT
  //      in the in-memory field is PRESERVED.  The agent sub-key (`agent`) is
  //      written exclusively by the Cashflow Agent — it is never set by the
  //      seeder or applyUserOverride — so it is not in `field` and survives.
  //
  // Scalar guard (code review requirement): legacy records may still have a
  // raw number (not an object) at the target field path.  `jsonb_typeof` is
  // used inside a CASE so that non-object DB values fall back to `'{}'::jsonb`
  // rather than causing an invalid merge.  The full in-memory `field` then
  // supplies a complete, well-formed LayeredValue for those legacy slots.
  const fieldForDb = field as unknown as Record<string, unknown>;

  // M40: write to the active underwriting scenario when available.
  // The DB trigger (trg_sync_underwriting_scenario) mirrors the change back to
  // deal_assumptions.year1 so all existing readers continue to see it.
  // Falls back to a direct deal_assumptions write for pre-migration deals.
  if (activeScenarioId) {
    await pool.query(
      `UPDATE deal_underwriting_scenarios
       SET year1 = jsonb_set(
         year1 || $3::jsonb,
         $2::text[],
         COALESCE(
           CASE jsonb_typeof(year1 #> $2::text[])
             WHEN 'object' THEN year1 #> $2::text[]
             ELSE NULL
           END,
           '{}'::jsonb
         ) || $4::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [activeScenarioId, parts, JSON.stringify(derivedUpdate), JSON.stringify(fieldForDb)]
    );
  } else {
    await pool.query(
      `UPDATE deal_assumptions
       SET year1 = jsonb_set(
         year1 || $3::jsonb,
         $2::text[],
         COALESCE(
           CASE jsonb_typeof(year1 #> $2::text[])
             WHEN 'object' THEN year1 #> $2::text[]
             ELSE NULL
           END,
           '{}'::jsonb
         ) || $4::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE deal_id = $1`,
      [dealId, parts, JSON.stringify(derivedUpdate), JSON.stringify(fieldForDb)]
    );
  }

  // ── Version snapshot ──────────────────────────────────────────────────────
  // Persist a deal version entry so the override is visible in the version
  // history / saved-versions panel.  Fire-and-catch: version save failures
  // must not roll back the operator's override.
  try {
    const { DealVersionsService } = await import('./proforma/deal-versions.service');
    const dvs = new DealVersionsService();
    await dvs.saveVersion({
      dealId,
      userId,
      snapshot:  seed as unknown as Record<string, unknown>,
      trigger:   'operator_override',
      note:      `operator_override:${fieldPath}`,
      divergences: [],
    });
  } catch (vErr) {
    logger.warn('applyUserOverride: version snapshot failed (non-fatal)', {
      dealId, fieldPath,
      error: vErr instanceof Error ? vErr.message : String(vErr),
    });
  }
}

/**
 * Recompute derived layered values in place. Called after any override.
 */
function r(field: LayeredValue<number> | undefined): number {
  return field?.resolved ?? 0;
}

function recomputeDerived(seed: ProFormaYear1Seed): void {
  const gpr = r(seed.gpr);
  const ltl = r(seed.loss_to_lease_pct);
  const vac = r(seed.vacancy_pct);
  const conc = r(seed.concessions_pct);
  const nru = r(seed.non_revenue_units_pct);
  const bd = r(seed.bad_debt_pct);
  const unitCount = seed._unit_count ?? 1;

  // Other income for EGI = sum of per-category breakdown resolved values
  // + sum of user-added monthly lines (×12). This replaces the old
  // `other_income_per_unit × units` shortcut so per-category overrides and
  // user lines flow into NOI without needing to re-derive per-unit. The
  // per-unit LayeredValue is then re-synced as a derived display value.
  // Task #519.
  const breakdownSum = seed.other_income_breakdown
    ? Object.values(seed.other_income_breakdown).reduce((s, lv) => s + (lv?.resolved ?? 0), 0)
    : 0;
  const _userLines = seed.other_income_user_lines;
  const userLinesAnnual = Array.isArray(_userLines)
    ? _userLines.reduce((s: number, l: { monthly?: unknown }) =>
        s + (Number.isFinite(l.monthly) ? (l.monthly as number) * 12 : 0), 0)
    : 0;
  const otherIncome = breakdownSum + userLinesAnnual;

  // v31 spec: bad debt folds into NRI (deducted from GPR), not from EGI.
  // NRI = GPR × (1 − ltl − vacancy − concessions − nru − bad_debt).
  // EGI = NRI + Other Income. Task #672.
  const nri = gpr - gpr * ltl - gpr * vac - gpr * conc - gpr * nru - gpr * bd;
  const egi = nri + otherIncome;
  const mgmtPct = r(seed.management_fee_pct);
  const mgmtDollar = egi * mgmtPct;

  // Sum dynamic custom_opex_* lines (added by buildSeed for non-canonical
  // T-12 expense rows) so user-line CRUD doesn't drift NOI by silently
  // dropping them from the opex total. Mirrors `total_opex_resolved` in
  // buildSeed.
  let customOpex = 0;
  for (const [k, v] of Object.entries(seed as Record<string, any>)) {
    if (k.startsWith('custom_opex_') && v && typeof v === 'object' && typeof v.resolved === 'number') {
      customOpex += v.resolved;
    }
  }

  // Utility contribution: when any sub-line (water_sewer/electric/gas_fuel) has
  // been explicitly resolved (non-null), use their sum in place of the compound
  // `utilities` field. Null-check (not > 0) so an explicit override of $0 still
  // takes effect. Falls back to compound `utilities` only when all sub-lines are
  // null. ProFormaYear1Seed already declares these as optional LayeredValues so
  // no cast is needed. Task #672.
  const anyUtilSubResolved =
    seed.water_sewer?.resolved != null ||
    seed.electric?.resolved    != null ||
    seed.gas_fuel?.resolved    != null;
  const utilContrib = anyUtilSubResolved
    ? r(seed.water_sewer) + r(seed.electric) + r(seed.gas_fuel)
    : r(seed.utilities);

  const opex =
    r(seed.payroll) + r(seed.repairs_maintenance) +
    r(seed.turnover) + r(seed.amenities) +
    r(seed.contract_services) + r(seed.marketing) +
    r(seed.office) + r(seed.g_and_a) +
    r(seed.hoa_dues) + utilContrib +
    mgmtDollar + r(seed.real_estate_tax) +
    r(seed.personal_property_tax) + r(seed.insurance) +
    r(seed.landscaping) + customOpex;

  const ts = new Date().toISOString();
  seed.net_rental_income.resolved = nri;
  seed.net_rental_income.updated_at = ts;
  seed.egi.resolved = egi;
  seed.egi.updated_at = ts;
  // Re-sync per-unit display value from the breakdown sum so the input field
  // visible in the UI stays consistent with the per-category source of truth.
  // Skip if the user has an explicit override on `other_income_per_unit` —
  // their direct edit must remain sticky and not be silently overwritten.
  if (seed.other_income_per_unit && unitCount > 0
      && seed.other_income_per_unit.resolution !== 'override') {
    seed.other_income_per_unit.resolved = otherIncome / unitCount;
    seed.other_income_per_unit.updated_at = ts;
  }
  seed.total_opex.resolved = opex;
  seed.total_opex.updated_at = ts;
  const noi = egi - opex;
  seed.noi.resolved = noi;
  seed.noi.updated_at = ts;
  // Re-sync derived per-unit NOI so the F11 panel + downstream consumers
  // stay consistent after user-line CRUD or any other layered override that
  // shifts the EGI / opex total.
  if ((seed as any).noi_per_unit && unitCount > 0) {
    (seed as any).noi_per_unit.resolved = noi / unitCount;
    (seed as any).noi_per_unit.updated_at = ts;
  }
}


/**
 * Convert the LayeredValue Year-1 seed into the `ProFormaAssumptions` shape
 * that `financialModelEngine.buildModel()` expects. Only resolved values
 * are surfaced to the model — provenance/scenarios stay in the seed.
 */
export function buildAssumptionsFromYear1Seed(year1: ProFormaYear1Seed, deal: DealRow | null): Record<string, unknown> {
  if (!year1) throw new Error('No year1 seed provided');
  const rv = (lv: LayeredValue<number> | undefined) => lv?.resolved ?? null;

  return {
    modelType: 'acquisition',
    dealInfo: {
      dealName: deal?.name ?? 'Untitled',
      city: deal?.city ?? null,
      state: deal?.state_code ?? deal?.state ?? null,
      totalUnits: deal?.target_units ?? null,
    },
    holdPeriod: 5,
    revenue: {
      gpr: rv(year1.gpr),
      lossToLease: rv(year1.loss_to_lease_pct),
      vacancy: rv(year1.vacancy_pct),
      concessions: rv(year1.concessions_pct),
      badDebt: rv(year1.bad_debt_pct),
      nonRevenueUnits: rv(year1.non_revenue_units_pct),
      otherIncome: (() => {
        const breakdownSum = year1.other_income_breakdown
          ? Object.values(year1.other_income_breakdown).reduce((s, lv) => s + (lv?.resolved ?? 0), 0)
          : 0;
        const userLinesAnnual = (year1.other_income_user_lines ?? [])
          .reduce((s, l) => s + (Number.isFinite(l.monthly) ? l.monthly * 12 : 0), 0);
        return breakdownSum + userLinesAnnual;
      })(),
      egi: rv(year1.egi),
    },
    opex: {
      payroll: rv(year1.payroll),
      repairsMaintenance: rv(year1.repairs_maintenance),
      turnover: rv(year1.turnover),
      amenities: rv(year1.amenities),
      contractServices: rv(year1.contract_services),
      marketing: rv(year1.marketing),
      office: rv(year1.office),
      gAndA: rv(year1.g_and_a),
      hoaDues: rv(year1.hoa_dues),
      utilities: rv(year1.utilities),
      managementFeePct: rv(year1.management_fee_pct),
      insurance: rv(year1.insurance),
      realEstateTax: rv(year1.real_estate_tax),
      personalPropertyTax: rv(year1.personal_property_tax),
      total: rv(year1.total_opex),
    },
    noi: rv(year1.noi),
    noiPerUnit: rv(year1.noi_per_unit),
    growthRates: {
      rent: 0.03,        // platform default, would be derived from M05 in production
      expenses: 0.025,
      tax: 0.04,
    },
    sources: year1.source_docs,
  };
}
