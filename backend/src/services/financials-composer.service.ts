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

  // 4. Load per-deal flag: use_unit_mix_for_gpr (controls whether revenue rows draw from unit mix)
  let useUnitMixForGpr = false;
  try {
    const flagRes = await pool.query(
      `SELECT per_year_overrides FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    const pyOvs = flagRes.rows[0]?.per_year_overrides ?? {};
    useUnitMixForGpr = pyOvs?.['da:use_unit_mix_for_gpr']?.value === true;
  } catch {
    useUnitMixForGpr = false;
  }

  // 4a. Pre-compute unit mix derived revenue items (used by both buildOSRows and buildRentRollSummary)
  const unitMixDerived = computeUnitMixDerived(rentRollRows);

  // 5. Build operating statement rows
  const year1Rows: OSRow[] = buildOSRows(year1Data, totalUnits, purchasePrice, rentRollRows, unitMixDerived, useUnitMixForGpr);

  // 6. Build integrity checks
  const integrityChecks: IntegrityCheck[] = buildIntegrityChecks(year1Data, totalUnits, year1Rows);

  // 7. Build unit economics
  const unitEconomics = buildUnitEconomics(year1Rows, totalUnits);

  // 8. Build valuation snapshot
  const valuationSnapshot = buildValuationSnapshot(purchasePrice, totalUnits, year1Rows, deal);

  // 9. Build rent roll summary
  const rentRollSummary = buildRentRollSummary(rentRollRows, totalUnits, unitMixDerived, useUnitMixForGpr);

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
    },
  };
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

  // ─── Revenue ────────────────────────────────────────────────────────────────
  // Mirrors Projections REVENUE block. When useUnitMixForGpr is on AND the unit
  // mix has the relevant data, we resolve from unit mix; otherwise fall back to
  // year1 platform values. Source field signals provenance to the UI.

  // Platform-side values (year1 JSONB shape)
  const platformGpr           = y1.gpr ?? null;
  const platformVacancyPct    = y1.vacancyPct ?? y1.vacancy_pct ?? null;
  const platformVacancyLoss   = y1.vacancyLoss ?? (platformGpr != null && platformVacancyPct != null ? platformGpr * platformVacancyPct : (y1.vacancy ?? null));
  const platformL2L           = y1.lossToLease ?? (platformGpr != null && y1.lossToLeasePct != null ? platformGpr * y1.lossToLeasePct : (platformGpr != null && y1.loss_to_lease_pct != null ? platformGpr * y1.loss_to_lease_pct : null));
  const platformConcessions   = y1.concessions ?? (platformGpr != null && (y1.concessionsPct ?? y1.concessions_pct) != null ? platformGpr * (y1.concessionsPct ?? y1.concessions_pct) : null);
  const platformBadDebt       = y1.badDebt ?? (platformGpr != null && (y1.badDebtPct ?? y1.bad_debt_pct) != null ? platformGpr * (y1.badDebtPct ?? y1.bad_debt_pct) : null);
  const platformNRU           = y1.nru ?? y1.nonRevenueUnits ?? (platformGpr != null && (y1.nonRevenueUnitsPct ?? y1.non_revenue_units_pct) != null ? platformGpr * (y1.nonRevenueUnitsPct ?? y1.non_revenue_units_pct) : null);
  const platformOtherIncome   = y1.otherIncome ?? null;

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
  const nruPick   = chooseSource<number>(null, platformNRU);  // no per-type non-revenue flag in unit mix yet
  const otherPick = chooseSource<number>(null, platformOtherIncome);

  // Bad Debt: per spec, sourced from T-12 or Rent Roll (never unit mix).
  // year1.badDebtSource is set by the proforma seeder when the value originated
  // from a parsed T-12 or rent roll. Fall back to 'platform' (don't mislabel).
  const badDebtSource: string = (typeof y1.badDebtSource === 'string' && (y1.badDebtSource === 't12' || y1.badDebtSource === 'rent_roll'))
    ? y1.badDebtSource
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
  const egi = y1.egi ?? y1.effectiveGrossIncome
    ?? (nri != null ? nri + (otherPick.resolved ?? 0) : null);

  addRow('gpr',                'Gross Potential Rent',       gprPick.resolved,    { isSubtotal: true, source: gprPick.source, platform: platformGpr, rentRoll: um.gprFromUnitMix });
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

  // Expenses
  addRow('total_opex', 'Total Operating Expenses', null, { isSubtotal: true });
  addRow('real_estate_taxes', 'Real Estate Taxes', y1.realEstateTaxes ?? null);
  addRow('insurance', 'Insurance', y1.insurance ?? null);
  addRow('utilities', 'Utilities', y1.utilities ?? null);
  addRow('repairs_maintenance', 'Repairs & Maintenance', y1.repairsMaintenance ?? null);
  addRow('management', 'Management', y1.management ?? null);
  addRow('payroll', 'Payroll', y1.payroll ?? null);
  addRow('marketing', 'Marketing', y1.marketing ?? null);
  addRow('other_opex', 'Other OpEx', y1.otherOpEx ?? null);
  addRow('total_opex_sum', 'Total OpEx', y1.totalOpEx ?? null, { isSubtotal: true });

  // NOI
  addRow('noi', 'Net Operating Income', y1.noi ?? y1.netOperatingIncome ?? null, { isSubtotal: true });

  // Debt
  addRow('debt_service', 'Debt Service', y1.debtService ?? null);
  addRow('pre_tax_cash_flow', 'Pre-Tax Cash Flow', y1.preTaxCashFlow ?? null, { isSubtotal: true });

  return rows;
}

// ── Helper: Integrity checks ─────────────────────────────────────────────────

function buildIntegrityChecks(y1: any, _totalUnits: number, rows: OSRow[]): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (!y1) {
    checks.push({
      id: 'proforma_seeded',
      status: 'warn',
      message: 'No proforma data seeded — add deal assumptions or trigger auto-seed.',
    });
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
  const weightedOcc = totalUnitsInMix > 0
    ? unitMix.reduce((s, u) => s + (u.occupancyPct ?? 0) * u.count, 0) / totalUnitsInMix
    : null;

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
  _totalUnits: number,
  derived: UnitMixDerived,
  useUnitMixForGpr: boolean
): any | null {
  if (!rentRollRows || rentRollRows.length === 0) return null;
  return {
    unitMix: derived.unitMix,
    avgInPlaceRent: derived.avgInPlaceRent,
    weightedOccupancyPct: derived.weightedOccupancyPct,
    gprFromUnitMix: derived.gprFromUnitMix,
    vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
    lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
    concessionsFromUnitMix: derived.concessionsFromUnitMix,
    useUnitMixForGpr,
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
