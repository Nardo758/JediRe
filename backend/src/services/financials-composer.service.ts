/**
 * financials-composer.service.ts
 *
 * Composes the full F9DealFinancials shape for the /api/v1/deals/:dealId/financials endpoint.
 * Queries multiple DB tables to populate operating statement rows, rent roll summary,
 * traffic projection, assumptions, capital stack, and other fields the frontend expects.
 */
import { Pool } from 'pg';

export interface OSRow {
  field: string;
  label: string;
  broker: number | null;
  platform: number | null;
  t12: number | null;
  rentRoll: number | null;
  taxBill: number | null;
  resolved: number | null;
  resolution: string | null;
  perUnit: number | null;
  source?: string | null;
  confidence?: number | null;
  benchmarkPosition: 'above' | 'below' | 'within' | null;
}

export interface IntegrityCheck {
  id: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: Record<string, unknown>;
}

export interface ComposedFinancials {
  dealId: string;
  dealName: string;
  totalUnits: number;
  proforma: {
    year1: OSRow[];
    integrityChecks: IntegrityCheck[];
    unitEconomics: Record<string, number | null>;
    valuationSnapshot: Record<string, unknown> | null;
  };
  returns: any;
  capitalStack: any;
  rentRollSummary: any;
  trafficProjection: any;
  assumptions: any;
  userOverrides: Record<string, any>;
  meta: { seeded: boolean; updatedAt: string | null };
  taxes: any;
  debt: any;
  sourcesUses: any;
  waterfall: any;
  projections: any;
  capital: any;
  /**
   * Raw `extraction_rent_roll` capsule payload when present. Carries
   * `units[]` (per-unit drill-down), `other_income_monthly` (real ancillary
   * breakdown), `expiration_curve` (deal-wide), and `floor_plan_mix` (with
   * per-floorplan expiration curves). The frontend uses this to render the
   * Ancillary panel and the Per-Unit drill-down without re-fetching.
   */
  extractionRentRoll: ExtractionRentRollPayload | null;
}

export interface ExtractionRentRollPayload {
  totalUnits: number | null;
  occupiedUnits: number | null;
  vacantUnits: number | null;
  asOfDate: string | null;
  sourceRef: string | null;
  otherIncomeMonthly: Record<string, number> | null;
  expirationCurve: Record<string, number> | null;
  floorPlanMix: Record<string, {
    count: number;
    avg_sqft: number;
    avg_market_rent: number;
    avg_effective_rent: number;
    occupancy_pct: number;
    expiration_curve?: Record<string, number>;
  }> | null;
  units: Array<Record<string, unknown>> | null;
}

export async function composeDealFinancials(
  pool: Pool,
  dealId: string,
  userId: string
): Promise<{ success: boolean; data: ComposedFinancials }> {
  // 1. Load deal row
  const dealRes = await pool.query(
    `SELECT id, name, deal_data, project_type, target_units,
            unit_count, city, state_code AS state
     FROM deals WHERE id = $1 AND user_id = $2`,
    [dealId, userId]
  );
  const deal = dealRes.rows[0];
  if (!deal) {
    throw new Error(`Deal ${dealId} not found or not accessible by user`);
  }
  const dealData = typeof deal.deal_data === 'object' && deal.deal_data ? deal.deal_data : {};
  const totalUnits = deal.target_units || deal.unit_count || (dealData?.units) || 0;
  const purchasePrice = dealData?.purchase_price || dealData?.asking_price || null;

  // 2. Load deal_assumptions (year1 proforma JSON)
  const assRes = await pool.query(
    `SELECT year1, source_type, source_date, updated_at FROM deal_assumptions WHERE deal_id = $1`,
    [dealId]
  );
  const year1Row = assRes.rows[0] ?? null;
  const year1Data = year1Row?.year1 ?? null;

  // 3. Load rent_roll rows (table may not exist)
  let rentRollRows: any[] = [];
  try {
    const rrRes = await pool.query(
      `SELECT type, count, avg_sqft, in_place_rent, market_rent,
              occupancy_pct, concession_pct
       FROM rent_roll WHERE deal_id = $1 ORDER BY type`,
      [dealId]
    );
    rentRollRows = rrRes.rows;
  } catch {
    // rent_roll table may not exist yet — graceful fallback
    rentRollRows = [];
  }

  // 3a. ALWAYS load `extraction_rent_roll` capsule when present, regardless
  // of whether SQL rent-roll rows exist. The UI consumes this payload
  // independently for ancillary income (other_income_monthly), per-unit
  // drill-down (units array), and expiration curves — even when SQL rows
  // win the unit-mix derivation tier. Without this decoupling, a deal that
  // has both legacy SQL rent_roll AND a fresh extraction would lose
  // ancillary/per-unit features in the UI.
  const extractionRentRoll = await loadExtractionRentRoll(pool, dealId);
  // Also load capsule aggregates when an extraction is present but its
  // `floor_plan_mix` is empty/malformed — in that case the extraction can
  // still hand us aggregates (otherIncomeMonthly, expirationCurve, totals)
  // but we need OM-level fallbacks to render the Default row. Without this,
  // an extraction with units:[] and {} floor_plan_mix would leave
  // derivationRows undefined and crash buildOSRows downstream.
  const extractionHasFloorPlanMix = !!(
    extractionRentRoll &&
    extractionRentRoll.floorPlanMix &&
    Object.keys(extractionRentRoll.floorPlanMix).length > 0
  );
  // Tier 3: OM-extracted per-floorplan unit mix. The OM parser writes a
  // multi-row table to `deals.deal_data.extraction_om.unit_mix` whenever the
  // broker published one. We use it ONLY when no rent-roll source upstream
  // produced floor plan rows — otherwise it would silently override real
  // rent-roll truth with broker marketing.
  const omUnitMix = (rentRollRows.length === 0 && !extractionHasFloorPlanMix)
    ? await loadOmUnitMix(pool, dealId)
    : null;
  const capsuleAggregates = (rentRollRows.length === 0 && !extractionHasFloorPlanMix && (!omUnitMix || omUnitMix.length === 0))
    ? await loadCapsuleAggregates(pool, dealId)
    : null;

  // 4. Load per-deal flag and per_year_overrides (controls GPR mode AND carries
  // per-row rent overrides written by PATCH /financials/override under keys
  // `da:unit_mix:<idx>:in_place_rent` / `da:unit_mix:<idx>:market_rent`).
  let useUnitMixForGpr = false;
  let pyOvs: Record<string, { value: unknown }> = {};
  try {
    const flagRes = await pool.query(
      `SELECT per_year_overrides FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    pyOvs = flagRes.rows[0]?.per_year_overrides ?? {};
    useUnitMixForGpr = pyOvs?.['da:use_unit_mix_for_gpr']?.value === true;
  } catch {
    useUnitMixForGpr = false;
  }

  const readUnitMixOverride = (idx: number) => ({
    inPlace: numOrNull(pyOvs?.[`da:unit_mix:${idx}:in_place_rent`]?.value),
    market:  numOrNull(pyOvs?.[`da:unit_mix:${idx}:market_rent`]?.value),
  });

  // Back-compat shorthand for the synthesized Default row (idx 0).
  const ovIdx0 = readUnitMixOverride(0);
  const ovInPlace = ovIdx0.inPlace;
  const ovMarket  = ovIdx0.market;

  // 4a. Pre-compute unit mix derived revenue items (used by both buildOSRows
  // and buildRentRollSummary). Tier ordering:
  //   1. legacy `rent_roll` SQL rows (multi-row, takes precedence)
  //   2. `extraction_rent_roll.floor_plan_mix` (multi-row, real per-floorplan)
  //   3. capsule single-row aggregate (OM averages)
  // Each tier is fed through the SAME derivation pipeline so revenue rows
  // resolved by `buildOSRows` (gpr/vacancy/loss-to-lease) cannot drift from
  // what the F9 Unit Mix tab displays.
  let derivationRows: any[];
  let extractionDerivationRows: any[] | null = null;
  let omDerivationRows: any[] | null = null;
  if (rentRollRows.length > 0) {
    derivationRows = rentRollRows;
  } else if (extractionRentRoll && extractionRentRoll.floorPlanMix && Object.keys(extractionRentRoll.floorPlanMix).length > 0) {
    extractionDerivationRows = extractionFloorPlanToRentRollRows(extractionRentRoll, readUnitMixOverride);
    derivationRows = extractionDerivationRows;
  } else if (omUnitMix && omUnitMix.length > 0) {
    omDerivationRows = omUnitMixToRentRollRows(omUnitMix, readUnitMixOverride);
    derivationRows = omDerivationRows;
  } else if (capsuleAggregates || ovInPlace != null || ovMarket != null) {
    derivationRows = [{
      type: 'Default',
      count: capsuleAggregates?.units ?? (totalUnits > 0 ? totalUnits : 0),
      avg_sqft: capsuleAggregates?.avgSf ?? null,
      // User overrides take precedence; otherwise capsule avgRent. Mirror to
      // the other column so loss-to-lease is zero (no phantom gap).
      in_place_rent: ovInPlace ?? capsuleAggregates?.avgRent ?? null,
      market_rent:   ovMarket  ?? ovInPlace ?? capsuleAggregates?.avgRent ?? null,
      occupancy_pct: capsuleAggregates?.occupancyPct ?? null,
      concession_pct: null,
    }];
  } else {
    derivationRows = [];
  }
  const unitMixDerived = computeUnitMixDerived(derivationRows);

  // Pass the same overrides to the summary builder so the Default row in the
  // Unit Mix tab reflects user edits even when no rent_roll row was inserted.
  // Only relevant when we actually fall back to the synthesized Default row
  // (no rent-roll, no extraction, no OM unit mix).
  const synthesizedOverrides = (rentRollRows.length === 0 && extractionDerivationRows == null && omDerivationRows == null)
    ? { inPlaceRent: ovInPlace, marketRent: ovMarket }
    : null;

  // 5. Build operating statement rows
  const year1Rows: OSRow[] = buildOSRows(year1Data, totalUnits, purchasePrice, rentRollRows, unitMixDerived, useUnitMixForGpr);

  // 6. Build integrity checks
  const integrityChecks: IntegrityCheck[] = buildIntegrityChecks(year1Data, totalUnits, year1Rows, dealData);

  // 7. Build unit economics
  const unitEconomics = buildUnitEconomics(year1Rows, totalUnits);

  // 8. Build valuation snapshot
  const valuationSnapshot = buildValuationSnapshot(purchasePrice, totalUnits, year1Rows, deal);

  // 9. Build rent roll summary
  const rentRollSummary = buildRentRollSummary(
    rentRollRows, totalUnits, unitMixDerived, useUnitMixForGpr,
    capsuleAggregates, synthesizedOverrides,
    extractionRentRoll, extractionDerivationRows,
    omDerivationRows,
  );

  // 10. Build traffic projection
  const trafficProjection = buildTrafficProjection();

  // 11. Build assumptions
  const assumptions = buildAssumptions(year1Data);

  // 12. Build capital stack
  const capitalStack = buildCapitalStack(purchasePrice, year1Data);

  return {
    success: true,
    data: {
      dealId,
      dealName: deal.name || 'Untitled Deal',
      totalUnits,
      proforma: {
        year1: year1Rows,
        integrityChecks,
        unitEconomics,
        valuationSnapshot,
      },
      returns: null,
      capitalStack,
      rentRollSummary,
      trafficProjection,
      assumptions,
      userOverrides: {},
      meta: {
        seeded: assRes.rows.length > 0,
        updatedAt: year1Row?.updated_at ?? null,
      },
      taxes: null,
      debt: null,
      sourcesUses: null,
      waterfall: null,
      projections: null,
      capital: null,
      extractionRentRoll,
    },
  };
}

/**
 * Convert `extraction_rent_roll.floor_plan_mix` (the multi-row real per-
 * floorplan output of the rent-roll parser) into the same row shape the
 * legacy `rent_roll` SQL table produces. Applies per-row overrides from
 * `per_year_overrides` (`da:unit_mix:<idx>:in_place_rent` / `:market_rent`).
 *
 * Rows are returned in stable name order so override indices remain stable
 * across reads (so an edit to "1BR/1BA" at idx 2 keeps targeting idx 2).
 */
function extractionFloorPlanToRentRollRows(
  extraction: ExtractionRentRollPayload,
  readOverride: (idx: number) => { inPlace: number | null; market: number | null },
): any[] {
  const fpEntries = Object.entries(extraction.floorPlanMix ?? {})
    .sort(([a], [b]) => a.localeCompare(b));
  return fpEntries.map(([type, fp], idx) => {
    const ov = readOverride(idx);
    return {
      type,
      count: fp.count ?? 0,
      avg_sqft: fp.avg_sqft ?? null,
      in_place_rent: ov.inPlace ?? (fp.avg_effective_rent > 0 ? fp.avg_effective_rent : null),
      market_rent:   ov.market  ?? (fp.avg_market_rent    > 0 ? fp.avg_market_rent    : null),
      occupancy_pct: fp.occupancy_pct ?? null,
      concession_pct: null,
      // Originals retained so the UI can display the pre-edit value in the
      // OVR badge / reset affordance.
      _originalInPlace: fp.avg_effective_rent > 0 ? fp.avg_effective_rent : null,
      _originalMarket:  fp.avg_market_rent    > 0 ? fp.avg_market_rent    : null,
      _inPlaceOverridden: ov.inPlace != null,
      _marketOverridden:  ov.market != null,
      _expirationCurve: fp.expiration_curve ?? null,
    };
  });
}

/**
 * Convert OM-published unit mix rows into the same rent_roll-row shape used
 * downstream by `computeUnitMixDerived` and `buildRentRollSummary`. Applies
 * per-row overrides from `per_year_overrides` so the user can edit OM-only
 * deals the same way they can edit rent-roll-backed deals.
 *
 * Rows are returned in stable name order so override indices remain stable
 * across reads (so an edit at idx 2 keeps targeting the same floor plan).
 */
function omUnitMixToRentRollRows(
  rows: Array<{ floorplan: string; count: number | null; avgSf: number | null; marketRent: number | null; inPlaceRent: number | null }>,
  readOverride: (idx: number) => { inPlace: number | null; market: number | null },
): any[] {
  const sorted = [...rows].sort((a, b) => a.floorplan.localeCompare(b.floorplan));
  return sorted.map((r, idx) => {
    const ov = readOverride(idx);
    const inPlaceOriginal = (r.inPlaceRent != null && r.inPlaceRent > 0) ? r.inPlaceRent : null;
    const marketOriginal  = (r.marketRent  != null && r.marketRent  > 0) ? r.marketRent  : null;
    return {
      type: r.floorplan,
      count: r.count ?? 0,
      avg_sqft: r.avgSf,
      // OM "in place" is the broker's published "current/avg" rent; when the
      // OM only published a single rent column, mirror it to in-place so the
      // tab shows a usable row instead of all nulls.
      in_place_rent: ov.inPlace ?? inPlaceOriginal ?? marketOriginal,
      market_rent:   ov.market  ?? marketOriginal  ?? inPlaceOriginal,
      occupancy_pct: null,
      concession_pct: null,
      _originalInPlace: inPlaceOriginal,
      _originalMarket: marketOriginal,
      _inPlaceOverridden: ov.inPlace != null,
      _marketOverridden:  ov.market  != null,
      _expirationCurve: null,
      _source: 'extraction_om',
    };
  });
}

// ── Helper: Build operating statement rows ───────────────────────────────────

function buildOSRows(
  y1: any,
  totalUnits: number,
  _purchasePrice: number | null,
  _rentRollRows: any[],
  unitMixDerived: UnitMixDerived,
  useUnitMixForGpr: boolean
): OSRow[] {
  const rows: OSRow[] = [];

  function addRow(
    field: string,
    label: string,
    resolved: number | null,
    opts?: {
      broker?: number | null;
      platform?: number | null;
      t12?: number | null;
      rentRoll?: number | null;
      taxBill?: number | null;
      source?: string;
      resolution?: string;
      isSubtotal?: boolean;
    }
  ) {
    const r: OSRow = {
      field,
      label,
      broker: opts?.broker ?? null,
      platform: opts?.platform ?? null,
      t12: opts?.t12 ?? null,
      rentRoll: opts?.rentRoll ?? null,
      taxBill: opts?.taxBill ?? null,
      resolved,
      resolution: opts?.resolution ?? (resolved != null ? 'proforma' : 'unseeded'),
      perUnit: totalUnits > 0 && resolved != null ? resolved / totalUnits : null,
      source: opts?.source ?? 'platform',
      confidence: resolved != null ? 0.5 : null,
      benchmarkPosition: null,
    };
    if (opts?.isSubtotal) {
      r.resolution = 'aggregated';
      r.source = 'computed';
    }
    rows.push(r);
  }

  if (!y1) {
    addRow('gpr', 'Gross Potential Rent', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('vacancy_loss', 'Vacancy Loss', null, { resolution: 'unseeded' });
    addRow('loss_to_lease', 'Loss to Lease', null, { resolution: 'unseeded' });
    addRow('concessions', 'Concessions', null, { resolution: 'unseeded' });
    addRow('bad_debt', 'Bad Debt / Collection Loss', null, { resolution: 'unseeded' });
    addRow('non_revenue_units', 'Non-Revenue Units', null, { resolution: 'unseeded' });
    addRow('net_rental_income', 'Net Rental Income', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('other_income', 'Other Income', null, { resolution: 'unseeded' });
    addRow('egi', 'Effective Gross Income', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('total_opex', 'Total Operating Expenses', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('real_estate_taxes', 'Real Estate Taxes', null, { resolution: 'unseeded' });
    addRow('insurance', 'Insurance', null, { resolution: 'unseeded' });
    addRow('utilities', 'Utilities', null, { resolution: 'unseeded' });
    addRow('repairs_maintenance', 'Repairs & Maintenance', null, { resolution: 'unseeded' });
    addRow('management', 'Management', null, { resolution: 'unseeded' });
    addRow('payroll', 'Payroll', null, { resolution: 'unseeded' });
    addRow('marketing', 'Marketing', null, { resolution: 'unseeded' });
    addRow('other_opex', 'Other OpEx', null, { resolution: 'unseeded' });
    addRow('total_opex_sum', 'Total OpEx', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('noi', 'Net Operating Income', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('debt_service', 'Debt Service', null, { resolution: 'unseeded' });
    addRow('pre_tax_cash_flow', 'Pre-Tax Cash Flow', null, { isSubtotal: true, resolution: 'unseeded' });
    return rows;
  }

  // ─── LayeredValue extraction ────────────────────────────────────────────────
  // year1 stores each field as { resolved, t12, om, rent_roll, tax_bill, platform, override, resolution }.
  // Helpers: lv() returns the LayeredValue object (or empty); res() the resolved number.
  type LV = {
    resolved?: number | null; t12?: number | null; om?: number | null;
    rent_roll?: number | null; tax_bill?: number | null; platform?: number | null;
    override?: number | null; resolution?: string;
  };
  function lv(key: string): LV {
    const v = y1?.[key];
    if (v && typeof v === 'object') return v as LV;
    if (typeof v === 'number') return { resolved: v };  // legacy plain-number fallback
    return {};
  }
  function res(key: string): number | null {
    const v = lv(key);
    return v.resolved ?? v.platform ?? null;
  }

  // ─── Revenue ────────────────────────────────────────────────────────────────
  // Mirrors Projections REVENUE block. When useUnitMixForGpr is on AND the unit
  // mix has the relevant data, we resolve from unit mix; otherwise fall back to
  // year1 platform values.

  // Convert percentage-of-GPR fields to dollar amounts
  const gprY1 = res('gpr');
  const pctToDollar = (pctKey: string): number | null => {
    const pct = res(pctKey);
    if (pct == null || gprY1 == null) return null;
    return gprY1 * pct;
  };

  const platformGpr           = gprY1;
  const platformVacancyLoss   = pctToDollar('vacancy_pct');
  const platformL2L           = pctToDollar('loss_to_lease_pct');
  const platformConcessions   = pctToDollar('concessions_pct');
  const platformBadDebt       = pctToDollar('bad_debt_pct');
  const platformNRU           = pctToDollar('non_revenue_units_pct');
  const totalUnitsForOI       = totalUnits || 0;
  const otherIncPerUnitMo     = res('other_income_per_unit');  // monthly per unit
  const platformOtherIncome   = otherIncPerUnitMo != null && totalUnitsForOI > 0
    ? otherIncPerUnitMo * totalUnitsForOI * 12
    : null;

  // Unit-mix-derived values (when available); chooseSource picks per row
  const um = unitMixDerived;
  const useUM = useUnitMixForGpr;

  function chooseSource<T>(umVal: T | null, platformVal: T | null): { resolved: T | null; source: string } {
    if (useUM && umVal != null) return { resolved: umVal, source: 'unit_mix' };
    return { resolved: platformVal, source: 'platform' };
  }

  const gprPick   = chooseSource(um.gprFromUnitMix, platformGpr);
  const vacPick   = chooseSource(um.vacancyLossFromUnitMix, platformVacancyLoss);
  const l2lPick   = chooseSource(um.lossToLeaseFromUnitMix, platformL2L);
  const concPick  = chooseSource(um.concessionsFromUnitMix, platformConcessions);
  const nruPick   = chooseSource<number>(null, platformNRU);
  const otherPick = chooseSource<number>(null, platformOtherIncome);

  // Bad Debt: per spec, T-12 or Rent Roll. Use the LayeredValue's resolution to
  // determine source honestly.
  const badDebtLV = lv('bad_debt_pct');
  const badDebtSource: string = badDebtLV.resolution === 't12' || badDebtLV.resolution === 'rent_roll'
    ? badDebtLV.resolution
    : 'platform';

  // Net Rental Income = GPR − Vacancy Loss − L2L − Concessions − Bad Debt − NRU
  const nri = (() => {
    if (gprPick.resolved == null) return null;
    return gprPick.resolved
      - (vacPick.resolved   ?? 0)
      - (l2lPick.resolved   ?? 0)
      - (concPick.resolved  ?? 0)
      - (platformBadDebt    ?? 0)
      - (nruPick.resolved   ?? 0);
  })();

  // EGI = NRI + Other Income (prefer year1 stored EGI when present)
  const egiY1 = res('egi');
  const egi = egiY1 ?? (nri != null ? nri + (otherPick.resolved ?? 0) : null);

  addRow('gpr',                'Gross Potential Rent',       gprPick.resolved,    { isSubtotal: true, source: gprPick.source, platform: platformGpr, rentRoll: um.gprFromUnitMix, t12: lv('gpr').t12 });
  addRow('vacancy_loss',       'Vacancy Loss',               vacPick.resolved,    { source: vacPick.source, platform: platformVacancyLoss, rentRoll: um.vacancyLossFromUnitMix });
  addRow('loss_to_lease',      'Loss to Lease',              l2lPick.resolved,    { source: l2lPick.source, platform: platformL2L, rentRoll: um.lossToLeaseFromUnitMix });
  addRow('concessions',        'Concessions',                concPick.resolved,   { source: concPick.source, platform: platformConcessions, rentRoll: um.concessionsFromUnitMix });
  addRow('bad_debt',           'Bad Debt / Collection Loss', platformBadDebt,     {
    source: badDebtSource,
    t12:      badDebtSource === 't12'       ? platformBadDebt : null,
    rentRoll: badDebtSource === 'rent_roll' ? platformBadDebt : null,
  });
  addRow('non_revenue_units',  'Non-Revenue Units',          nruPick.resolved,    { source: nruPick.source, platform: platformNRU });
  addRow('net_rental_income',  'Net Rental Income',          nri,                  { isSubtotal: true });
  addRow('other_income',       'Other Income',               otherPick.resolved,  { source: otherPick.source, platform: platformOtherIncome });
  addRow('egi',                'Effective Gross Income',     egi,                  { isSubtotal: true });

  // ─── Expenses (mirrors Projections EXPENSES section) ───────────────────────
  // Helper: emit an expense row pulling resolved + source columns from the LayeredValue.
  function addExpenseRow(field: string, label: string, key: string) {
    const v = lv(key);
    addRow(field, label, v.resolved ?? v.platform ?? null, {
      source:   v.resolution ?? 'platform',
      t12:      v.t12       ?? null,
      rentRoll: v.rent_roll ?? null,
      taxBill:  v.tax_bill  ?? null,
      platform: v.platform  ?? null,
    });
  }

  addExpenseRow('payroll',             'Payroll / Personnel',       'payroll');
  addExpenseRow('repairs_maintenance', 'Repairs & Maintenance',     'repairs_maintenance');
  addExpenseRow('turnover',            'Turnover / Make-Ready',     'turnover');
  addExpenseRow('contract_services',   'Contract Services',         'contract_services');
  addExpenseRow('marketing',           'Marketing & Leasing',       'marketing');
  addExpenseRow('utilities',           'Utilities',                 'utilities');
  addExpenseRow('g_and_a',             'G&A / Administrative',      'g_and_a');

  // Management Fee: stored as a percent of EGI in year1.management_fee_pct.
  // Convert to a dollar value using the EGI computed above so the row matches Projections.
  const mgmtPctLV = lv('management_fee_pct');
  const mgmtPct = mgmtPctLV.resolved ?? mgmtPctLV.platform ?? null;
  const mgmtFeeDollar = (mgmtPct != null && egi != null) ? mgmtPct * egi : null;
  addRow('management_fee', 'Management Fee', mgmtFeeDollar, {
    source:   mgmtPctLV.resolution ?? 'platform',
    t12:      mgmtPctLV.t12 != null && egi != null ? mgmtPctLV.t12 * egi : null,
    platform: mgmtPctLV.platform != null && egi != null ? mgmtPctLV.platform * egi : null,
  });

  addExpenseRow('insurance',            'Insurance',           'insurance');
  addExpenseRow('real_estate_taxes',    'Real Estate Taxes',   'real_estate_tax');
  addExpenseRow('replacement_reserves', 'Replacement Reserves','replacement_reserves');

  // Total OpEx — prefer stored value, otherwise sum the rows we just added
  // plus any custom_opex_* GL line items the seeder may have surfaced.
  const storedTotalOpex = res('total_opex');
  const summedOpex = (() => {
    const keys = ['payroll', 'repairs_maintenance', 'turnover', 'contract_services',
                  'marketing', 'utilities', 'g_and_a', 'insurance', 'real_estate_tax',
                  'replacement_reserves', 'amenities', 'office', 'hoa_dues',
                  'personal_property_tax'];
    let sum = 0; let any = false;
    for (const k of keys) {
      const v = res(k);
      if (v != null) { sum += v; any = true; }
    }
    if (mgmtFeeDollar != null) { sum += mgmtFeeDollar; any = true; }
    // Pull in any custom_opex_* GL items not in the canonical list
    if (y1 && typeof y1 === 'object') {
      for (const k of Object.keys(y1)) {
        if (k.startsWith('custom_opex_')) {
          const v = res(k);
          if (v != null) { sum += v; any = true; }
        }
      }
    }
    return any ? sum : null;
  })();
  addRow('total_opex', 'Total Operating Expenses',
    storedTotalOpex ?? summedOpex, { isSubtotal: true });

  // NOI
  const noiY1 = res('noi');
  const totalOpForNoi = storedTotalOpex ?? summedOpex;
  const computedNoi = (egi != null && totalOpForNoi != null) ? egi - totalOpForNoi : null;
  addRow('noi', 'Net Operating Income', noiY1 ?? computedNoi, { isSubtotal: true });

  // Debt (composer doesn't surface debt yet — leave nullable rows)
  addRow('debt_service',      'Debt Service',      null);
  addRow('pre_tax_cash_flow', 'Pre-Tax Cash Flow', null, { isSubtotal: true });

  return rows;
}

// ── Helper: Integrity checks ─────────────────────────────────────────────────

function buildIntegrityChecks(
  y1: any,
  _totalUnits: number,
  rows: OSRow[],
  dealData?: Record<string, any> | null,
): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (!y1) {
    // Check if extraction capsules exist — if none, this deal has never had
    // documents parsed and will always be empty until ingestion happens.
    const hasExtractionT12 = !!(dealData && dealData['extraction_t12']);
    const hasExtractionRR  = !!(dealData && dealData['extraction_rent_roll']);
    const hasExtractionTax = !!(dealData && dealData['extraction_tax_bill']);

    if (!hasExtractionT12 && !hasExtractionRR && !hasExtractionTax) {
      checks.push({
        id: 'seed_failed',
        status: 'error',
        message: 'No T-12, rent roll, or tax bill found for this deal — upload documents to populate the financial model.',
      });
    } else if (!hasExtractionT12 && !hasExtractionTax) {
      checks.push({
        id: 'seed_partial',
        status: 'warn',
        message: 'Rent roll found but no T-12 or tax bill — revenue assumptions will be populated but expenses may be incomplete.',
      });
    } else {
      checks.push({
        id: 'proforma_seeded',
        status: 'warn',
        message: 'No proforma data seeded — add deal assumptions or trigger auto-seed.',
      });
    }
  }

  const noiRow = rows.find(r => r.field === 'noi');
  if (noiRow && noiRow.resolved != null) {
    checks.push({
      id: 'noi_positive',
      status: noiRow.resolved > 0 ? 'ok' : 'warn',
      message: noiRow.resolved > 0
        ? 'NOI positive'
        : 'NOI is zero or negative — review revenue and expense assumptions.',
    });
  }

  return checks;
}

// ── Helper: Unit economics ───────────────────────────────────────────────────

function buildUnitEconomics(rows: OSRow[], totalUnits: number): Record<string, number | null> {
  const gprRow = rows.find(r => r.field === 'gpr');
  const egiRow = rows.find(r => r.field === 'egi');
  const opexRow = rows.find(r => r.field === 'total_opex_sum');
  const noiRow = rows.find(r => r.field === 'noi');
  const gpr = gprRow?.resolved ?? null;
  const egi = egiRow?.resolved ?? null;
  const opex = opexRow?.resolved ?? null;
  const noi = noiRow?.resolved ?? null;

  return {
    gprPerUnit: totalUnits > 0 && gpr != null ? gpr / totalUnits : null,
    egiPerUnit: totalUnits > 0 && egi != null ? egi / totalUnits : null,
    opexPerUnit: totalUnits > 0 && opex != null ? opex / totalUnits : null,
    noiPerUnit: totalUnits > 0 && noi != null ? noi / totalUnits : null,
    opexRatioPct: egi != null && egi > 0 && opex != null ? (opex / egi) * 100 : null,
    derivedVacancyPct: gpr != null && gpr > 0 && egi != null ? (gpr - egi) / gpr : null,
  };
}

// ── Helper: Valuation snapshot ───────────────────────────────────────────────

function buildValuationSnapshot(
  purchasePrice: number | null,
  totalUnits: number,
  rows: OSRow[],
  _deal: any
): Record<string, unknown> | null {
  if (!purchasePrice || purchasePrice <= 0) return null;

  const noiRow = rows.find(r => r.field === 'noi');
  const noi = noiRow?.resolved ?? null;
  const gprRow = rows.find(r => r.field === 'gpr');
  const gpr = gprRow?.resolved ?? null;

  return {
    pricePerUnit: totalUnits > 0 ? purchasePrice / totalUnits : null,
    pricePerSF: null,
    grm: gpr != null && gpr > 0 ? purchasePrice / gpr : null,
    gim: null,
    goingInCapT12: noi != null && noi > 0 ? (noi / purchasePrice) * 100 : null,
    priceToRC: null,
    rcPerUnit: null,
    buildArbitrageFlag: null,
    pricePerUnitSubmarketMedian: null,
    pricePerUnitPercentile: null,
    pricePerSFSubmarketMedian: null,
    pricePerSFPercentile: null,
    grmSubmarketMedian: null,
    grmPercentile: null,
    gimSubmarketMedian: null,
    gimPercentile: null,
    goingInCapSubmarketMedian: null,
    goingInCapPercentile: null,
  };
}

// ── Helper: Rent roll summary ────────────────────────────────────────────────

// ── Helper: Unit-mix derived revenue items (shared across composer paths) ────

interface UnitMixDerived {
  unitMix: Array<{
    type: string; count: number; avgSf: number | null;
    inPlaceRent: number | null; marketRent: number | null;
    occupancyPct: number | null; concessionPct: number | null;
  }>;
  totalUnitsInMix: number;
  avgInPlaceRent: number | null;
  weightedOccupancyPct: number | null;
  gprFromUnitMix: number | null;        // Σ marketRent × count × 12  (potential gross — Projections semantics)
  vacancyLossFromUnitMix: number | null; // gpr × (1 − weightedOccupancy)
  lossToLeaseFromUnitMix: number | null; // Σ max(0, marketRent − inPlaceRent) × count × 12
  concessionsFromUnitMix: number | null; // Σ marketRent × count × 12 × concessionPct
}

function computeUnitMixDerived(rentRollRows: any[]): UnitMixDerived {
  const empty: UnitMixDerived = {
    unitMix: [], totalUnitsInMix: 0, avgInPlaceRent: null, weightedOccupancyPct: null,
    gprFromUnitMix: null, vacancyLossFromUnitMix: null,
    lossToLeaseFromUnitMix: null, concessionsFromUnitMix: null,
  };
  if (!rentRollRows || rentRollRows.length === 0) return empty;

  const unitMix = rentRollRows.map(r => ({
    type: r.type || 'Unknown',
    count: r.count || 0,
    avgSf: r.avg_sqft ?? null,
    inPlaceRent: r.in_place_rent ?? null,
    marketRent: r.market_rent ?? null,
    occupancyPct: r.occupancy_pct ?? null,
    concessionPct: r.concession_pct ?? null,
  }));

  const totalUnitsInMix = unitMix.reduce((s, u) => s + u.count, 0);
  const weightedInPlace = totalUnitsInMix > 0
    ? unitMix.reduce((s, u) => s + (u.inPlaceRent ?? 0) * u.count, 0) / totalUnitsInMix
    : null;
  // Null-aware weighted occupancy. OM-derived rows intentionally have null
  // occupancy because brokers rarely publish per-floorplan vacancy. Treating
  // null as 0 here would silently propagate "100% vacant" through GPR
  // vacancy loss math, badly distorting Pro Forma. Skip null rows entirely
  // (excluded from both numerator and denominator); return null when no row
  // contributes — downstream `vacancyLossFromUnitMix` already null-checks.
  const weightedOcc = (() => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const u of unitMix) {
      if (u.occupancyPct == null) continue;
      weightedSum += u.occupancyPct * u.count;
      weightTotal += u.count;
    }
    if (weightTotal === 0) return null;
    return weightedSum / weightTotal;
  })();

  // GPR = potential annual rent at MARKET rates (matches Projections "Gross Potential Rent")
  const gprFromMix = unitMix.reduce((s, u) => {
    const rate = u.marketRent ?? u.inPlaceRent ?? 0;
    return s + rate * u.count * 12;
  }, 0);

  const vacancyLossFromUnitMix = (gprFromMix > 0 && weightedOcc != null)
    ? gprFromMix * (1 - weightedOcc)
    : null;

  const lossToLeaseFromUnitMix = unitMix.reduce((s, u) => {
    if (u.marketRent == null || u.inPlaceRent == null) return s;
    const gap = Math.max(0, u.marketRent - u.inPlaceRent);
    return s + gap * u.count * 12;
  }, 0);

  const concessionsFromUnitMix = unitMix.reduce((s, u) => {
    const rate = u.marketRent ?? u.inPlaceRent ?? 0;
    const cp = u.concessionPct ?? 0;
    return s + rate * u.count * 12 * cp;
  }, 0);

  return {
    unitMix,
    totalUnitsInMix,
    avgInPlaceRent: weightedInPlace,
    weightedOccupancyPct: weightedOcc,
    gprFromUnitMix: gprFromMix > 0 ? gprFromMix : null,
    vacancyLossFromUnitMix,
    lossToLeaseFromUnitMix: lossToLeaseFromUnitMix > 0 ? lossToLeaseFromUnitMix : null,
    concessionsFromUnitMix: concessionsFromUnitMix > 0 ? concessionsFromUnitMix : null,
  };
}

function buildRentRollSummary(
  rentRollRows: any[],
  totalUnits: number,
  derived: UnitMixDerived,
  useUnitMixForGpr: boolean,
  capsuleAggregates: CapsuleAggregates | null = null,
  synthesizedOverrides: { inPlaceRent: number | null; marketRent: number | null } | null = null,
  extractionRentRoll: ExtractionRentRollPayload | null = null,
  extractionDerivationRows: any[] | null = null,
  omDerivationRows: any[] | null = null,
): any | null {
  // Tier 2: extraction_rent_roll.floor_plan_mix (real per-floorplan rows).
  // Build the unit mix directly from the derivation rows so the OVR badge
  // (overridden + originalValue) and lease-expiration column have the data
  // they need on the frontend.
  // Tier 3: OM-published per-floorplan unit mix (extraction_om.unit_mix).
  // Used when no rent-roll source produced rows. Same column shape as the
  // rent-roll tier so the F9 Unit Mix tab renders identically — only the
  // source badge changes.
  if (omDerivationRows && omDerivationRows.length > 0) {
    const unitMix = omDerivationRows.map(r => ({
      type: r.type,
      count: r.count,
      avgSf: r.avg_sqft,
      inPlaceRent: r.in_place_rent,
      marketRent: r.market_rent,
      occupancyPct: r.occupancy_pct,
      concessionPct: r.concession_pct,
      inPlaceRentOriginal: r._originalInPlace ?? null,
      marketRentOriginal: r._originalMarket ?? null,
      inPlaceRentOverridden: r._inPlaceOverridden === true,
      marketRentOverridden:  r._marketOverridden === true,
      expirationCurve: null,
      source: 'extraction_om',
    }));
    return {
      unitMix,
      avgInPlaceRent: derived.avgInPlaceRent,
      weightedOccupancyPct: derived.weightedOccupancyPct,
      gprFromUnitMix: derived.gprFromUnitMix,
      vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
      lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
      concessionsFromUnitMix: derived.concessionsFromUnitMix,
      useUnitMixForGpr,
      expirationCurve: null,
      source: 'extraction_om',
    };
  }

  if (extractionDerivationRows && extractionDerivationRows.length > 0) {
    const unitMix = extractionDerivationRows.map(r => ({
      type: r.type,
      count: r.count,
      avgSf: r.avg_sqft,
      inPlaceRent: r.in_place_rent,
      marketRent: r.market_rent,
      occupancyPct: r.occupancy_pct,
      concessionPct: r.concession_pct,
      inPlaceRentOriginal: r._originalInPlace ?? null,
      marketRentOriginal: r._originalMarket ?? null,
      inPlaceRentOverridden: r._inPlaceOverridden === true,
      marketRentOverridden:  r._marketOverridden === true,
      expirationCurve: r._expirationCurve ?? null,
      source: 'extraction_rent_roll',
    }));
    return {
      unitMix,
      avgInPlaceRent: derived.avgInPlaceRent,
      weightedOccupancyPct: derived.weightedOccupancyPct,
      gprFromUnitMix: derived.gprFromUnitMix,
      vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
      lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
      concessionsFromUnitMix: derived.concessionsFromUnitMix,
      useUnitMixForGpr,
      expirationCurve: extractionRentRoll?.expirationCurve ?? null,
      source: 'extraction_rent_roll',
    };
  }
  if (!rentRollRows || rentRollRows.length === 0) {
    // Pick a unit count: prefer the deal's target_units; fall back to capsule.units
    const synthesizedCount = totalUnits > 0 ? totalUnits : (capsuleAggregates?.units ?? 0);
    if (synthesizedCount > 0) {
      // Synthesize a default unit mix row so the UnitMixTab renders with an editable row.
      // Layered values for the DISPLAYED row: user override (per_year_overrides) →
      // capsule aggregate → null. Both columns share the same fallback chain so the
      // Unit Mix tab and the OS derivation pipeline agree on what the row "is".
      const ovInPlace = synthesizedOverrides?.inPlaceRent ?? null;
      const ovMarket  = synthesizedOverrides?.marketRent  ?? null;
      const inPlaceRent = ovInPlace ?? capsuleAggregates?.avgRent ?? null;
      const marketRent  = ovMarket  ?? capsuleAggregates?.avgRent ?? null;
      const occupancyPct = capsuleAggregates?.occupancyPct ?? null;
      const avgSf = capsuleAggregates?.avgSf ?? null;
      // Mark the row as user-overridden when an explicit override exists so the
      // tab can render an "OVR" badge / reset affordance correctly.
      const inPlaceOverridden = ovInPlace != null;
      const marketOverridden  = ovMarket  != null;
      const defaultMix = [{
        type: 'Default',
        count: synthesizedCount,
        avgSf,
        inPlaceRent,
        marketRent,
        occupancyPct,
        concessionPct: null,
        inPlaceRentOriginal: capsuleAggregates?.avgRent ?? null,
        marketRentOriginal: capsuleAggregates?.avgRent ?? null,
        inPlaceRentOverridden: inPlaceOverridden,
        marketRentOverridden: marketOverridden,
        // Provenance: capsule when capsule had data, synthesized otherwise.
        source: capsuleAggregates ? 'capsule' : 'synthesized',
      }];
      // Use the SAME derivation outputs that buildOSRows consumes — derivationRows
      // was synthesized from the same overrides + capsule, so this guarantees the
      // Unit Mix tab metrics (gpr/vacancy/loss-to-lease) cannot drift from the
      // Pro Forma Operating Statement values. Falls back to single-row math only
      // when the derivation didn't produce a value (no unit count, all rents null).
      return {
        unitMix: defaultMix,
        avgInPlaceRent: derived.avgInPlaceRent ?? inPlaceRent,
        weightedOccupancyPct: derived.weightedOccupancyPct ?? occupancyPct,
        gprFromUnitMix: derived.gprFromUnitMix,
        vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
        lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
        concessionsFromUnitMix: derived.concessionsFromUnitMix,
        useUnitMixForGpr,
        // Top-level provenance mirrors the row's source so downstream
        // consumers (e.g. ProFormaSummaryTab badges, banners) can read
        // either field consistently.
        source: capsuleAggregates ? 'capsule' : 'synthesized',
      };
    }
    return null;
  }
  // Tier 1: legacy SQL `rent_roll` table — explicit source so downstream
  // provenance handling is uniform across all tiers.
  return {
    unitMix: derived.unitMix,
    avgInPlaceRent: derived.avgInPlaceRent,
    weightedOccupancyPct: derived.weightedOccupancyPct,
    gprFromUnitMix: derived.gprFromUnitMix,
    vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
    lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
    concessionsFromUnitMix: derived.concessionsFromUnitMix,
    useUnitMixForGpr,
    source: 'rent_roll',
  };
}

// ── Helper: Traffic projection (placeholder) ─────────────────────────────────

function buildTrafficProjection(): any {
  return {
    yearly: [],
    leaseUp: null,
    calibrated: {
      vacancyPct: null,
      rentGrowthPct: null,
      exitCap: null,
      lastCalibrated: null,
    },
    leasingSignals: null,
  };
}

// ── Helper: Assumptions ──────────────────────────────────────────────────────

function buildAssumptions(y1: any): any {
  const holdYears = y1?.holdYears ?? 10;
  return {
    holdYears,
    exitCap: y1?.exitCap ?? null,
    rentGrowthYr1: y1?.rentGrowthRate ?? null,
    rentGrowthStabilized: y1?.rentGrowthStabilized ?? null,
    perYear: Array.from({ length: holdYears }, (_, i) => ({
      year: i + 1,
      rentGrowthPct: i === 0 ? (y1?.rentGrowthRate ?? null) : (y1?.rentGrowthStabilized ?? null),
      vacancyPct: y1?.vacancy ?? null,
      exitCapIfLastYear: i === holdYears - 1 ? (y1?.exitCap ?? null) : null,
    })),
    gprDecomposition: y1?.gprDecomposition ?? null,
    narrative: y1?.narrative ?? null,
  };
}

// ── Helper: Capsule aggregates fallback ──────────────────────────────────────
// When no rent_roll rows exist, pull aggregates from deal_capsules.deal_data
// (sourced from OM extraction) so the synthesized Default unit-mix row carries
// real units / avg rent / occupancy / avg SF instead of all-null cells.

export interface CapsuleAggregates {
  units: number | null;
  avgRent: number | null;
  occupancyPct: number | null;
  avgSf: number | null;
}

/** Coerce occupancy that may arrive as a fraction (0.95) or a percent (95).
 *  Preserves a real 0 (fully vacant) — only `null`/`undefined`/non-finite/negative are dropped. */
function normalizeOccupancy(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : (raw != null ? Number(raw) : NaN);
  if (!Number.isFinite(n) || n < 0) return null;
  // Percentages > 1.5 are treated as percent; values ≤ 1.5 stay as fractions.
  const norm = n > 1.5 ? n / 100 : n;
  return Math.min(Math.max(norm, 0), 1);
}

function num(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : (raw != null ? Number(raw) : NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Like num() but accepts 0 and negative values; only nullish/non-finite return null.
// Used for user-edited override values where 0 (e.g. concession-driven free rent)
// is meaningful and must not be coerced away.
function numOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Load the `extraction_rent_roll` capsule payload (parsed rent-roll output).
 * This is the real per-floorplan mix + per-unit detail produced by the rent-
 * roll parser. Returns `null` when no rent roll has been processed for the
 * deal yet — callers should then fall back to capsule aggregates / OM data.
 */
export async function loadExtractionRentRoll(pool: Pool, dealId: string): Promise<ExtractionRentRollPayload | null> {
  // The rent-roll parser writes its output to `deals.deal_data.extraction_rent_roll`
  // via the data-router (see data-router.ts: persistRentRollExtraction). The
  // capsule (`deal_capsules`) only carries the capsule aggregates that are
  // computed from broker_claims + extraction_*; the per-unit rent roll is NOT
  // mirrored there. So we must read straight from the `deals` row.
  let dealRes;
  try {
    dealRes = await pool.query(
      `SELECT deal_data FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );
  } catch (err) {
    console.warn('[loadExtractionRentRoll] deals lookup failed for', dealId,
      err instanceof Error ? err.message : err);
    return null;
  }
  const dd = dealRes.rows[0]?.deal_data;
  if (!dd || typeof dd !== 'object') return null;
  const err = (dd.extraction_rent_roll && typeof dd.extraction_rent_roll === 'object')
    ? dd.extraction_rent_roll
    : null;
  if (!err) return null;
  // Treat the payload as present only when there's something usable
  // (a floor plan mix OR per-unit list OR aggregates).
  const fpm = (err.floor_plan_mix && typeof err.floor_plan_mix === 'object') ? err.floor_plan_mix : null;
  const units = Array.isArray(err.units) ? err.units : null;
  if (!fpm && !units && err.total_units == null) return null;
  return {
    totalUnits: typeof err.total_units === 'number' ? err.total_units : null,
    occupiedUnits: typeof err.occupied_units === 'number' ? err.occupied_units : null,
    vacantUnits: typeof err.vacant_units === 'number' ? err.vacant_units : null,
    asOfDate: typeof err.as_of_date === 'string' ? err.as_of_date : null,
    sourceRef: typeof err.source_ref === 'string' ? err.source_ref : null,
    otherIncomeMonthly: (err.other_income_monthly && typeof err.other_income_monthly === 'object')
      ? err.other_income_monthly : null,
    expirationCurve: (err.expiration_curve && typeof err.expiration_curve === 'object')
      ? err.expiration_curve : null,
    floorPlanMix: fpm,
    units,
  };
}

/**
 * Per-floorplan unit mix as the broker published it in the Offering Memo
 * (lives at `deals.deal_data.extraction_om.unit_mix`, written by the OM
 * parser via data-router.persistOMExtraction). Returns `null` when no OM
 * has been parsed or the OM didn't include a per-floorplan table.
 *
 * Schema (per row):
 *   { floorplan: string, count, avgSf, marketRent, inPlaceRent }
 */
export async function loadOmUnitMix(pool: Pool, dealId: string): Promise<Array<{
  floorplan: string;
  count: number | null;
  avgSf: number | null;
  marketRent: number | null;
  inPlaceRent: number | null;
}> | null> {
  let dealRes;
  try {
    dealRes = await pool.query(
      `SELECT deal_data FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );
  } catch (err) {
    console.warn('[loadOmUnitMix] deals lookup failed for', dealId,
      err instanceof Error ? err.message : err);
    return null;
  }
  const dd = dealRes.rows[0]?.deal_data;
  if (!dd || typeof dd !== 'object') return null;
  const om = (dd.extraction_om && typeof dd.extraction_om === 'object') ? dd.extraction_om : null;
  if (!om) return null;
  const arr = Array.isArray(om.unit_mix) ? om.unit_mix : null;
  if (!arr || arr.length === 0) return null;
  // Filter rows with at least a floor plan label and SOMETHING quantitative
  // — empty rows from a noisy parse would otherwise show up as all-null UI rows.
  const cleaned = arr
    .map((r: Record<string, unknown>) => ({
      floorplan: typeof r.floorplan === 'string' ? r.floorplan.trim() : '',
      count:       numOrNull(r.count),
      avgSf:       numOrNull(r.avgSf),
      marketRent:  numOrNull(r.marketRent),
      inPlaceRent: numOrNull(r.inPlaceRent),
    }))
    .filter(r => r.floorplan.length > 0 && (r.count != null || r.avgSf != null || r.marketRent != null || r.inPlaceRent != null));
  return cleaned.length > 0 ? cleaned : null;
}

export async function loadCapsuleAggregates(pool: Pool, dealId: string): Promise<CapsuleAggregates | null> {
  // Capsules are stored two ways in the wild:
  //   • shared-UUID: deal_capsules.id === deals.id (legacy / pre-bridge)
  //   • bridge:      deal_capsules.deal_data->>'deal_id' = deals.id (auto-created)
  // Try both so we work for either. id is uuid → cast to text for the param compare.
  let capRes;
  try {
    capRes = await pool.query(
      `SELECT deal_data
         FROM deal_capsules
        WHERE id::text = $1
           OR deal_data->>'deal_id' = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [dealId]
    );
  } catch (err) {
    console.warn('[loadCapsuleAggregates] capsule lookup failed for', dealId,
      err instanceof Error ? err.message : err);
    return null;
  }
  const dd = capRes.rows[0]?.deal_data;
  if (!dd || typeof dd !== 'object') return null;

  // OM extraction shape (from `pdf-extractor → broker_claims`):
  //   deal_data.broker_claims.property  → { units, avgUnitSF, netRentableSF, ... }
  //   deal_data.broker_claims.proforma  → { stabilizedVacancy, lossToLease, ... }
  // Older capsules sometimes also stash a flatter copy under `extraction_om.{property,proforma}`.
  const claims = (dd.broker_claims && typeof dd.broker_claims === 'object') ? dd.broker_claims : {};
  const om = (dd.extraction_om && typeof dd.extraction_om === 'object') ? dd.extraction_om : {};
  const property = (claims.property && typeof claims.property === 'object')
    ? claims.property
    : (om.property && typeof om.property === 'object' ? om.property : {});
  const proforma = (claims.proforma && typeof claims.proforma === 'object')
    ? claims.proforma
    : (om.proforma && typeof om.proforma === 'object' ? om.proforma : {});

  const units = num(dd.units) ?? num(dd.target_units) ?? num(property.units);

  const avgRent = num(dd.avg_rent) ?? num(claims.avg_rent) ?? num(proforma.avgRent);

  const occRaw = dd.occupancy ?? claims.occupancy ?? dd.broker_occupancy ?? null;
  let occupancyPct = normalizeOccupancy(occRaw);
  if (occupancyPct == null) {
    // Derive from stabilizedVacancy when present (e.g. 0.05 → 0.95)
    const vac = normalizeOccupancy(proforma.stabilizedVacancy);
    if (vac != null) occupancyPct = Math.max(0, 1 - vac);
  }

  const avgSf = num(property.avgUnitSF) ?? num(dd.avg_unit_sf);

  // If nothing usable was found, return null so the row stays all-null (matches old behavior).
  if (units == null && avgRent == null && occupancyPct == null && avgSf == null) {
    return null;
  }
  return { units, avgRent, occupancyPct, avgSf };
}

// ── Helper: Capital stack ────────────────────────────────────────────────────

function buildCapitalStack(purchasePrice: number | null, y1: any): any {
  return {
    purchasePrice,
    loanAmount: y1?.loanAmount ?? null,
    equityAtClose: y1?.equityAtClose ?? null,
    ltcPct: y1?.ltcPct ?? null,
    interestRate: y1?.interestRate ?? null,
    ioPeriodMonths: y1?.ioPeriodMonths ?? null,
    amortizationYears: y1?.amortizationYears ?? null,
    dscrMin: y1?.dscrMin ?? null,
    originationFeePct: y1?.originationFeePct ?? null,
    pricePerUnit: purchasePrice != null && purchasePrice > 0 ? purchasePrice : null,
  };
}
