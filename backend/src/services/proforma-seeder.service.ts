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
    priority: Resolution[];
    scenarios?: Record<string, number>;
    warning?: string;
  }
): LayeredValue<number> {
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
  for (const src of options.priority) {
    const v = (lv as unknown as Record<string, number | null>)[src];
    if (v != null) {
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
  existingSeed: ExistingSeed | null
): ProFormaYear1Seed {
  const ex = existingSeed || {} as ExistingSeed;
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

  const gpr = resolve('gpr', gpr_platform, {
    t12: gpr_t12, rent_roll: gpr_rr,
    existingOverride: getOverride('gpr'),
    priority: ['rent_roll', 't12'],
  });

  const t12gpr = num(t12Capsule, 'gpr') ?? 0;
  const ltl_t12 = t12gpr > 0 ? Math.abs(num(t12Capsule, 'loss_to_lease') ?? 0) / t12gpr : null;
  const ltl_rr = num(rrCapsule, 'loss_to_lease_pct');
  const lossToLeasePct = resolve('loss_to_lease_pct', null, {
    t12: ltl_t12, rent_roll: ltl_rr,
    existingOverride: getOverride('loss_to_lease_pct'),
    priority: ['rent_roll', 't12'],
  });

  const vac_t12 = t12gpr > 0 ? Math.abs(num(t12Capsule, 'vacancy_loss') ?? 0) / t12gpr : null;
  const vac_rr = rrCapsule ? 1 - (num(rrCapsule, 'occupancy_by_unit_pct') ?? 1) : null;
  const vacancyPct = resolve('vacancy_pct', platform.vacancy_pct, {
    t12: vac_t12, rent_roll: vac_rr,
    existingOverride: getOverride('vacancy_pct'),
    priority: ['rent_roll', 't12'],
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
    existingOverride: getOverride('concessions_pct'),
    priority: ['t12', 'rent_roll'],
  });

  const t12egi = num(t12Capsule, 'egi') ?? 0;
  const bdObj = obj(t12Capsule, 'bad_debt');
  const bdRaw = bdObj ? (num(bdObj, 'net') ?? 0) : (num(t12Capsule, 'bad_debt') ?? 0);
  const bd_t12 = t12egi > 0 ? Math.abs(bdRaw) / t12egi : null;
  const badDebtPct = resolve('bad_debt_pct', platform.bad_debt_pct, {
    t12: bd_t12,
    existingOverride: getOverride('bad_debt_pct'),
    priority: ['t12'],
  });

  const nru_t12 = t12gpr > 0
    ? Math.abs(num(t12Capsule, 'non_revenue_units') ?? 0) / t12gpr
    : null;
  const nonRevenueUnitsPct = resolve('non_revenue_units_pct', null, {
    t12: nru_t12,
    existingOverride: getOverride('non_revenue_units_pct'),
    priority: ['t12'],
  });

  const t12OI = obj(t12Capsule, 'other_income');
  const other_t12 = num(t12OI, 'total');
  const rrOIMObj = obj(rrCapsule, 'other_income_monthly');
  const other_rr = rrOIMObj
    ? Object.values(rrOIMObj)
        .filter((v): v is number => typeof v === 'number' && v > 0)
        .reduce((s, v) => s + v, 0) * months
    : null;
  const otherIncomeTotal = resolve('other_income_total', null, {
    t12: other_t12, rent_roll: other_rr,
    existingOverride: getOverride('other_income_total'),
    priority: ['t12', 'rent_roll'],
  });

  // Per-unit other income
  const otherIncomePerUnit = resolve('other_income_per_unit', null, {
    t12: other_t12 != null && totalUnits > 0 ? other_t12 / totalUnits : null,
    rent_roll: other_rr != null && totalUnits > 0 ? other_rr / totalUnits : null,
    existingOverride: getOverride('other_income_per_unit'),
    priority: ['t12', 'rent_roll'],
  });

  const oi = rrOIMObj;
  const oiAnnual = (key: string) => {
    const v = num(oi, key);
    return v != null ? v * months : null;
  };
  const otherIncomeBreakdown = {
    parking: resolve('other_income_breakdown.parking', null, {
      rent_roll: oiAnnual('parking'),
      existingOverride: getOverride('other_income_breakdown.parking'),
      priority: ['rent_roll'],
    }),
    pet: resolve('other_income_breakdown.pet', null, {
      rent_roll: oiAnnual('pet_rent'),
      existingOverride: getOverride('other_income_breakdown.pet'),
      priority: ['rent_roll'],
    }),
    storage: resolve('other_income_breakdown.storage', null, {
      rent_roll: oiAnnual('storage'),
      existingOverride: getOverride('other_income_breakdown.storage'),
      priority: ['rent_roll'],
    }),
    laundry: resolve('other_income_breakdown.laundry', null, {
      existingOverride: getOverride('other_income_breakdown.laundry'),
      priority: [],
    }),
    rubs: resolve('other_income_breakdown.rubs', null, {
      rent_roll: oiAnnual('rubs'),
      existingOverride: getOverride('other_income_breakdown.rubs'),
      priority: ['rent_roll'],
    }),
    fees: resolve('other_income_breakdown.fees', null, {
      rent_roll: oiAnnual('fees'),
      existingOverride: getOverride('other_income_breakdown.fees'),
      priority: ['rent_roll'],
    }),
    insurance_admin: resolve('other_income_breakdown.insurance_admin', null, {
      rent_roll: oiAnnual('insurance_admin'),
      existingOverride: getOverride('other_income_breakdown.insurance_admin'),
      priority: ['rent_roll'],
    }),
    other: resolve('other_income_breakdown.other', null, {
      rent_roll: oiAnnual('other'),
      existingOverride: getOverride('other_income_breakdown.other'),
      priority: ['rent_roll'],
    }),
  };

  // ───────── OPEX (T12 primary; platform fallback) ─────────
  const t12Opex = obj(t12Capsule, 'opex');
  const opexFromT12 = (
    t12Field: string,
    fieldName: string,
    platformValue: number | null = null
  ): LayeredValue<number> => {
    const t12Val = num(t12Opex, t12Field);
    return resolve(fieldName, platformValue, {
      t12: t12Val,
      existingOverride: getOverride(fieldName),
      priority: ['t12'],
    });
  };

  const platformOpEx = (perUnit: number | null) =>
    perUnit != null && totalUnits > 0 ? perUnit * totalUnits : null;

  const payroll = opexFromT12('payroll', 'payroll', platformOpEx(platform.opex_per_unit_annual.payroll));
  const repairsMaintenance = opexFromT12('r_and_m', 'repairs_maintenance', platformOpEx(platform.opex_per_unit_annual.r_and_m));
  const turnover = opexFromT12('turnover', 'turnover', platformOpEx(platform.opex_per_unit_annual.turnover));
  const amenities = opexFromT12('amenities', 'amenities', null);
  const contractServices = opexFromT12('contract', 'contract_services', platformOpEx(platform.opex_per_unit_annual.contract_services));
  const marketing = opexFromT12('marketing', 'marketing', platformOpEx(platform.opex_per_unit_annual.marketing));
  const office = opexFromT12('office', 'office', null);
  const gAndA = opexFromT12('g_and_a', 'g_and_a', platformOpEx(platform.opex_per_unit_annual.g_and_a));
  const hoaDues = opexFromT12('hoa_dues', 'hoa_dues', null);
  const utilities = opexFromT12('utilities', 'utilities', platformOpEx(platform.opex_per_unit_annual.utilities));
  const personalPropTax = opexFromT12('personal_property_tax', 'personal_property_tax', null);

  // ───────── CUSTOM LINE ITEMS (unrecognized GL rows captured by parser) ─────────
  // Keys are sanitized description labels prefixed with "custom_opex_".
  // They are included in total_opex_resolved so NOI is accurate.
  const rawCustomItems = (t12Opex?.custom_line_items ?? {}) as Record<string, number>;
  const sanitizeKey = (label: string) =>
    'custom_opex_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  const customOpexItems: Record<string, LayeredValue<number>> = {};
  for (const [label, amount] of Object.entries(rawCustomItems)) {
    if (typeof amount !== 'number' || Math.abs(amount) < 1) continue;
    const key = sanitizeKey(label);
    const existingOverride = getOverride(key);
    customOpexItems[key] = resolve(key, null, {
      t12: amount,
      existingOverride,
      priority: ['t12'],
    });
    (customOpexItems[key] as unknown as Record<string, unknown>)._label = label;
  }

  const mgmt_t12_pct = t12egi > 0 ? (num(t12Opex, 'mgmt_fee') ?? 0) / t12egi : null;
  const mgmtFeePct = resolve('management_fee_pct', platform.management_fee_pct_egi, {
    t12: mgmt_t12_pct,
    existingOverride: getOverride('management_fee_pct'),
    priority: ['t12'],
  });

  const insurancePlatform = platformOpEx(platform.opex_per_unit_annual.insurance);
  const t12Ins = num(t12Opex, 'insurance');
  const insurance = resolve('insurance', insurancePlatform, {
    t12: t12Ins,
    existingOverride: getOverride('insurance'),
    priority: ['t12'],
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
      priority: ['tax_bill', 't12'],
      scenarios,
      warning: appealStatus === 'pending'
        ? `Tax bill under appeal. Base case $${Math.round(billCurrent).toLocaleString()}; downside if lost: $${Math.round(billUnappealed).toLocaleString()}.`
        : undefined,
    });
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

  const egi_resolved = nri_resolved + (otherIncomeTotal.resolved ?? 0);
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
    resolved: noi_resolved,
    resolution: 'platform_fallback',
    updated_at: now(),
  };

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

    if (!t12Capsule && !rrCapsule && !taxBillCapsule) {
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

    const seed = buildSeed(totalUnits, platform, t12Capsule, rrCapsule, taxBillCapsule, existingSeed);

    // Surface warnings from any layered value
    for (const [k, v] of Object.entries(seed)) {
      if (v && typeof v === 'object' && 'warning' in v && (v as Record<string, unknown>).warning) {
        warnings.push(`${k}: ${(v as Record<string, unknown>).warning}`);
      }
    }

    // Upsert
    await pool.query(
      `INSERT INTO deal_assumptions (deal_id, year1, source_type, source_date, created_at, updated_at)
       VALUES ($1, $2::jsonb, 'platform_seeded', NOW(), NOW(), NOW())
       ON CONFLICT (deal_id) DO UPDATE SET
         year1 = EXCLUDED.year1,
         source_type = 'platform_seeded',
         source_date = NOW(),
         updated_at = NOW()`,
      [dealId, JSON.stringify(seed)]
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
    return {
      seeded: false,
      fields_seeded: 0,
      warnings: [`Seeder error: ${err instanceof Error ? err.message : 'Unknown error'}`],
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
  const lv = target[lastKey];
  if (!lv || typeof lv !== 'object') {
    throw new Error(`Field "${fieldPath}" is not a layered value`);
  }
  const field = lv as LayeredValue<number>;

  field.override = value;
  field.updated_at = new Date().toISOString();
  (field as LayeredValue<number> & { updated_by?: string }).updated_by = userId;
  if (value != null) {
    field.resolved = value;
    field.resolution = 'override';
  } else {
    const fieldPriorities: Record<string, Resolution[]> = {
      gpr: ['rent_roll', 't12'],
      loss_to_lease_pct: ['rent_roll', 't12'],
      vacancy_pct: ['rent_roll', 't12'],
      concessions_pct: ['t12', 'rent_roll'],
      bad_debt_pct: ['t12'],
      non_revenue_units_pct: ['t12'],
      other_income_total: ['t12', 'rent_roll'],
      other_income_per_unit: ['t12', 'rent_roll'],
      real_estate_tax: ['tax_bill', 't12'],
      management_fee_pct: ['t12'],
      insurance: ['t12'],
    };
    const priorityOrder = fieldPriorities[fieldPath] ?? ['rent_roll', 't12', 'tax_bill', 'box_score', 'aged_ar', 'om'];
    field.resolution = 'platform_fallback';
    field.resolved = field.platform ?? null;
    for (const src of priorityOrder) {
      const srcVal = (field as unknown as Record<string, number | null>)[src];
      if (srcVal != null) {
        field.resolved = srcVal;
        field.resolution = src as LayeredValue<number>['resolution'];
        break;
      }
    }
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
  const otherIncome = seed.other_income_per_unit?.resolved != null
    ? seed.other_income_per_unit.resolved * unitCount
    : 0;

  const nri = gpr - gpr * ltl - gpr * vac - gpr * conc - gpr * nru;
  const egi_pre_bd = nri + otherIncome;
  const egi = egi_pre_bd * (1 - bd);
  const mgmtPct = r(seed.management_fee_pct);
  const mgmtDollar = egi * mgmtPct;

  const opex =
    r(seed.payroll) + r(seed.repairs_maintenance) +
    r(seed.turnover) + r(seed.amenities) +
    r(seed.contract_services) + r(seed.marketing) +
    r(seed.office) + r(seed.g_and_a) +
    r(seed.hoa_dues) + r(seed.utilities) +
    mgmtDollar + r(seed.real_estate_tax) +
    r(seed.personal_property_tax) + r(seed.insurance);

  const ts = new Date().toISOString();
  seed.net_rental_income.resolved = nri;
  seed.net_rental_income.updated_at = ts;
  seed.egi.resolved = egi;
  seed.egi.updated_at = ts;
  seed.total_opex.resolved = opex;
  seed.total_opex.updated_at = ts;
  seed.noi.resolved = egi - opex;
  seed.noi.updated_at = ts;
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
      otherIncome: rv(year1.other_income_per_unit) != null
        ? (rv(year1.other_income_per_unit) ?? 0) * (deal?.target_units ?? 0)
        : null,
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
