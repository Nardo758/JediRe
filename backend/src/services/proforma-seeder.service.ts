import { Pool } from 'pg';
import type { LayeredValue, ProFormaYear1Seed } from './document-extraction/types';

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
  const bpVacPct   = bpNum('stabilizedVacancy');
  const bpLtlPct   = bpNum('lossToLease');
  const bpConcPct  = bpNum('concessionsPct');
  const bpBdPct    = bpNum('badDebtPct');
  const bpMgmtPct  = bpNum('managementFeePct');
  const bpResPerUt = bpNum('replacementReservesPerUnit');
  const bpNOI      = bpNum('yearOneNOI') ?? bpNum('stabilizedNOI');
  const bpPayroll  = bpNum('payrollAnnual');
  const bpInsur    = bpNum('insuranceAnnual');
  const bpUtils    = bpNum('utilitiesAnnual');
  const bpRM       = bpNum('repairsMaintenanceAnnual');
  const bpTurnover = bpNum('turnoverAnnual');
  const bpMktg     = bpNum('marketingAnnual');
  const bpGA       = bpNum('gAndAAnnual');
  const bpReserves = bpResPerUt != null && totalUnits > 0 ? bpResPerUt * totalUnits : null;
  const getOverride = (fieldName: string): number | null => {
    const parts = fieldName.split('.');
    let current: unknown = ex;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[part];
    }
    if (current && typeof current === 'object' && 'override' in current) {
      return (current as LayeredValue<number>).override ?? null;
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
    t12: gpr_t12, rent_roll: gpr_rr,
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
  const bd_t12 = t12egi > 0 ? Math.abs(bdRaw) / t12egi : null;
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
  const contractServices = opexFromT12('contract', 'contract_services', platformOpEx(platform.opex_per_unit_annual.contract_services));
  const marketing = opexFromT12('marketing', 'marketing', platformOpEx(platform.opex_per_unit_annual.marketing), bpMktg);
  const office = opexFromT12('office', 'office', null);
  const gAndA = opexFromT12('g_and_a', 'g_and_a', platformOpEx(platform.opex_per_unit_annual.g_and_a), bpGA);
  const hoaDues = opexFromT12('hoa_dues', 'hoa_dues', null);
  const utilities = opexFromT12('utilities', 'utilities', platformOpEx(platform.opex_per_unit_annual.utilities), bpUtils);
  const personalPropTax = opexFromT12('personal_property_tax', 'personal_property_tax', null);

  // ───────── CUSTOM LINE ITEMS (unrecognized GL rows captured by parser) ─────────
  // Keys are sanitized description labels prefixed with "custom_opex_".
  // They are included in total_opex_resolved so NOI is accurate.
  // IMPORTANT: We filter out revenue lines, rollup/subtotal rows, and below-the-line
  // items (debt service, interest) that the parser didn't categorize but are NOT opex.
  const rawCustomItems = (t12Opex?.custom_line_items ?? {}) as Record<string, number>;
  const sanitizeKey = (label: string) =>
    'custom_opex_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  
  // Patterns to EXCLUDE from custom opex (revenue, rollups, below-the-line)
  const EXCLUDE_FROM_CUSTOM_OPEX: RegExp[] = [
    // Revenue lines and rollups
    /\b(gross\s+potential|gross\s+scheduled|market)\s+rent\b/i,
    /\b(effective\s+gross|collected)\s+(income|rent|revenue)\b/i,
    /\b(rental|other)\s+income\b/i,
    /\b(net\s+rental|nri)\b/i,
    /\bloss\s+to\s+lease\b/i,
    /\bvacancy\s+(loss)?\b/i,
    /\bconcession/i,
    /\bbad\s+debt\b/i,
    // Rollup/subtotal rows
    /^total\s+/i,
    /\btotal\s+(income|revenue|expenses?|opex|operating)\b/i,
    /\b(net\s+)?operating\s+income/i,
    /\bnoi\b/i,
    /\bcontrollable\s+operating/i,
    /\b(sub)?total\b/i,
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
    /\bnon[\s-]?operating/i,
    /\bcash\s+flow/i,
    /\b(before|after)\s+tax/i,
  ];
  
  const isExcludedFromOpex = (label: string): boolean => {
    return EXCLUDE_FROM_CUSTOM_OPEX.some(pattern => pattern.test(label));
  };
  
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
    realEstateTax = opexFromT12('real_estate_tax', 'real_estate_tax', null);
  }

  // ───────── DERIVED FIELDS ─────────
  const gprResolved = gpr.resolved ?? 0;
  const nri_resolved = gprResolved
    - gprResolved * (lossToLeasePct.resolved ?? 0)
    - gprResolved * (vacancyPct.resolved ?? 0)
    - gprResolved * (concessionsPct.resolved ?? 0)
    - gprResolved * (nonRevenueUnitsPct.resolved ?? 0);

  const netRentalIncome: LayeredValue<number> = {
    platform: null, override: null,
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
  const egi_after_bad_debt = egi_resolved * (1 - (badDebtPct.resolved ?? 0));

  const egi: LayeredValue<number> = {
    platform: null, override: null,
    resolved: egi_after_bad_debt,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  const mgmtFeeDollar = egi_after_bad_debt * (mgmtFeePct.resolved ?? 0);

  const customOpexTotal = Object.values(customOpexItems).reduce((s, lv) => s + (lv.resolved ?? 0), 0);

  const total_opex_resolved =
    (payroll.resolved ?? 0) + (repairsMaintenance.resolved ?? 0) + (turnover.resolved ?? 0) +
    (amenities.resolved ?? 0) + (contractServices.resolved ?? 0) + (marketing.resolved ?? 0) +
    (office.resolved ?? 0) + (gAndA.resolved ?? 0) + (hoaDues.resolved ?? 0) +
    (utilities.resolved ?? 0) + mgmtFeeDollar + (realEstateTax.resolved ?? 0) +
    (personalPropTax.resolved ?? 0) + (insurance.resolved ?? 0) + customOpexTotal;

  const totalOpex: LayeredValue<number> = {
    platform: null, override: null,
    resolved: total_opex_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  const noi_resolved = egi_after_bad_debt - total_opex_resolved;
  const noi: LayeredValue<number> = {
    platform: null, override: null,
    om: bpNOI,
    resolved: noi_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

  const replacementReserves: LayeredValue<number> = resolve('replacement_reserves', null, {
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
    management_fee_pct: mgmtFeePct,
    insurance,
    real_estate_tax: realEstateTax,
    personal_property_tax: personalPropTax,
    replacement_reserves: replacementReserves,
    total_opex: totalOpex,
    noi,
    noi_per_unit: {
      platform: null, override: null,
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
 * Public entry point: re-seed the deal's ProForma Year-1 assumptions.
 * Called by data-router after every successful extraction.
 */
export async function seedProFormaYear1(
  pool: Pool,
  dealId: string
): Promise<{ seeded: boolean; fields_seeded: number; warnings: string[]; resolved_noi: number | null }> {
  const warnings: string[] = [];

  try {
    // Load deal + capsule
    const dealResult = await pool.query(
      `SELECT id, target_units, deal_data FROM deals WHERE id = $1`,
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

    // TODO: real platform baseline from location-baseline service.
    // All-null fallback means seeder uses extraction values 1:1 when present.
    const platform: PlatformBaseline = {
      gpr_per_unit_per_month: null,
      vacancy_pct: null,
      concessions_pct: null,
      bad_debt_pct: null,
      opex_per_unit_annual: {
        payroll: null, r_and_m: null, turnover: null, contract_services: null,
        marketing: null, g_and_a: null, utilities: null, insurance: null,
      },
      management_fee_pct_egi: null,
    };

    // Load existing seed (preserves user overrides)
    const existing = await pool.query(
      `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    ).catch(() => ({ rows: [] }));
    const existingSeed = existing.rows[0]?.year1
      ? (typeof existing.rows[0].year1 === 'string'
          ? JSON.parse(existing.rows[0].year1)
          : existing.rows[0].year1)
      : null;

    const bcRaw = capsule?.broker_claims;
    const bcObj = bcRaw && typeof bcRaw === 'object' ? bcRaw as Record<string, unknown> : null;
    const bpRaw = bcObj?.proforma;
    const bpProforma = bpRaw && typeof bpRaw === 'object' ? bpRaw as Record<string, unknown> : null;
    const seed = buildSeed(totalUnits, platform, t12Capsule, rrCapsule, taxBillCapsule, omCapsule, existingSeed, bpProforma);

    // Surface warnings from any layered value
    for (const [k, v] of Object.entries(seed)) {
      if (v && typeof v === 'object' && 'warning' in v && (v as Record<string, unknown>).warning) {
        warnings.push(`${k}: ${(v as Record<string, unknown>).warning}`);
      }
    }

    // Upsert — write year1 JSONB and sync key fields to legacy columns
    await pool.query(
      `INSERT INTO deal_assumptions
         (deal_id, year1, total_units, vacancy_pct, other_income_per_unit,
          source_type, source_date, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, $4,
               COALESCE($5::numeric, 50),
               'platform_seeded', NOW(), NOW(), NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         year1 = EXCLUDED.year1,
         total_units = EXCLUDED.total_units,
         vacancy_pct = EXCLUDED.vacancy_pct,
         other_income_per_unit = EXCLUDED.other_income_per_unit,
         source_type = 'platform_seeded',
         source_date = NOW(),
         updated_at = NOW()`,
      [
        dealId,
        JSON.stringify(seed),
        seed._unit_count,
        seed.vacancy_pct?.resolved != null ? Math.round(seed.vacancy_pct.resolved * 10000) / 100 : null,
        seed.other_income_per_unit?.resolved
      ]
    );

    const fieldsSeeded = Object.values(seed).filter(
      (v: unknown) => v && typeof v === 'object' && 'resolved' in v && (v as LayeredValue<number>).resolved != null
    ).length;

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
 * Ensure deal_assumptions.year1 is seeded for a deal with extraction data.
 * Idempotent: if the row already exists with a non-null year1, skips re-seeding
 * unless forceReseed=true. Callers use this as a safety net so getDealFinancials
 * never returns null data for a deal that has extraction capsules.
 */
export async function ensureDealAssumptionsSeeded(
  pool: Pool,
  dealId: string,
  opts: { forceReseed?: boolean } = {}
): Promise<{ seeded: boolean; skipped: boolean; reason?: string }> {
  // Check for existing seed
  const existing = await pool.query(
    `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
    [dealId]
  ).catch(() => ({ rows: [] }));

  const hasExistingSeed = existing.rows[0]?.year1 != null;

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
  const result = await pool.query(
    `SELECT year1 FROM deal_assumptions WHERE deal_id = $1`,
    [dealId]
  );
  if (result.rows.length === 0 || !result.rows[0].year1) {
    throw new Error('No year1 seed exists — upload at least one document first');
  }

  const seed = typeof result.rows[0].year1 === 'string'
    ? JSON.parse(result.rows[0].year1)
    : result.rows[0].year1;

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

  await pool.query(
    `UPDATE deal_assumptions SET year1 = $2::jsonb, updated_at = NOW() WHERE deal_id = $1`,
    [dealId, JSON.stringify(seed)]
  );
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
  const userLinesAnnual = (seed.other_income_user_lines ?? [])
    .reduce((s, l) => s + (Number.isFinite(l.monthly) ? l.monthly * 12 : 0), 0);
  const otherIncome = breakdownSum + userLinesAnnual;

  const nri = gpr - gpr * ltl - gpr * vac - gpr * conc - gpr * nru;
  const egi_pre_bd = nri + otherIncome;
  const egi = egi_pre_bd * (1 - bd);
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

  const opex =
    r(seed.payroll) + r(seed.repairs_maintenance) +
    r(seed.turnover) + r(seed.amenities) +
    r(seed.contract_services) + r(seed.marketing) +
    r(seed.office) + r(seed.g_and_a) +
    r(seed.hoa_dues) + r(seed.utilities) +
    mgmtDollar + r(seed.real_estate_tax) +
    r(seed.personal_property_tax) + r(seed.insurance) +
    customOpex;

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
