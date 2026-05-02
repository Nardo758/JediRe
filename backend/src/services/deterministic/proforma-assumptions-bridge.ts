/**
 * proforma-assumptions-bridge.ts
 *
 * Translates the financial-model-engine's `ProFormaAssumptions` envelope
 * (the frontend/LLM-facing schema with nested objects) into the flat
 * `ModelAssumptions` struct required by the deterministic runner.
 *
 * This is the W1/W3 bridge from the F9 wiring spec: it allows the server to
 * run `runModel()` + `runIntegrityChecks()` immediately after the LLM returns,
 * before the result is committed to the database.
 *
 * Key field transformations:
 *  - financing.term/amortization (years) → term/amort (months)
 *  - expenses[k].amount (total $/yr) → *PerUnit ($/unit/yr) via division
 *  - expenses.management_fee.amount (total $/yr) → managementFee (fraction of EGI)
 *  - revenue.stabilizedOccupancy → vacancyY1 = vacancyStab = 1 - stabilizedOccupancy
 *  - revenue.collectionLoss → badDebt (concessions default 0)
 *  - waterfall.equityContribution split by lpShare/gpShare → lpEquity/gpEquity
 *  - waterfall.hurdles[0..2] → promoteTiers / promoteSplits tuples
 */

import type { ProFormaAssumptions } from '../financial-model-engine.service';
import type { CollisionEntry, ModelAssumptions } from './deterministic-model-runner';
import type { ProFormaYear1Seed, LayeredValue } from '../document-extraction/types';

// §4.3 thresholds for collision detection
const COLLISION_MATERIAL_PCT = 0.10;
const COLLISION_CRITICAL_PCT = 0.25;

type EvidenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Map LayeredValue.resolution to a confidence level. */
function resolutionToConfidence(resolution: LayeredValue<number>['resolution']): EvidenceConfidence {
  switch (resolution) {
    case 't12':
    case 'rent_roll':
    case 'tax_bill':
    case 'override':
      return 'HIGH';
    case 'box_score':
    case 'aged_ar':
    case 'om':
    case 'platform':
      return 'MEDIUM';
    case 'platform_fallback':
    default:
      return 'LOW';
  }
}

/** Map LayeredValue.resolution to a human-readable source label. */
function resolutionToSource(resolution: LayeredValue<number>['resolution']): string {
  const map: Record<string, string> = {
    t12: 'T12',
    rent_roll: 'Rent Roll',
    tax_bill: 'Tax Bill',
    box_score: 'Box Score',
    aged_ar: 'Aged AR',
    om: 'Offering Memorandum',
    override: 'Analyst Override',
    platform: 'Platform Baseline',
    platform_fallback: 'Platform Fallback',
  };
  return map[resolution] ?? resolution;
}

/** Detect source collisions for a single LayeredValue (spec §4.3). */
function detectCollisionsForField(
  fieldName: string,
  lv: LayeredValue<number>,
  selectedSource: string,
): CollisionEntry[] {
  const entries: CollisionEntry[] = [];
  const sources: Array<{ key: keyof LayeredValue<number>; label: string }> = [
    { key: 't12', label: 'T12' },
    { key: 'rent_roll', label: 'Rent Roll' },
    { key: 'tax_bill', label: 'Tax Bill' },
  ];

  const resolved = lv.resolved;
  if (resolved == null) return entries;

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = lv[sources[i].key as keyof LayeredValue<number>] as number | null | undefined;
      const b = lv[sources[j].key as keyof LayeredValue<number>] as number | null | undefined;
      if (a == null || b == null) continue;
      const delta = Math.abs(a - b);
      const base = Math.max(Math.abs(a), Math.abs(b), 1);
      const pct = delta / base;
      if (pct < COLLISION_MATERIAL_PCT) continue;
      const magnitude: CollisionEntry['magnitude'] = pct >= COLLISION_CRITICAL_PCT ? 'critical' : 'material';
      entries.push({
        field: fieldName,
        magnitude,
        sourceA_value: a,
        sourceB_value: b,
        delta,
        selectedSource,
        reason: `${sources[i].label} reports ${a.toFixed(0)} vs ${sources[j].label} reports ${b.toFixed(0)} (${(pct * 100).toFixed(1)}% diff)`,
        narrative: `${fieldName} ${magnitude} disagreement between ${sources[i].label} and ${sources[j].label}. ` +
          `Model uses ${selectedSource} value. Investigate source discrepancy before finalising underwriting.`,
      });
    }
  }
  return entries;
}

/**
 * Extract evidence hints and collision entries from a ProFormaYear1Seed.
 * Called in buildModel() after fetching deal_assumptions.year1 from DB.
 */
export function buildEvidenceHintsFromSeed(seed: ProFormaYear1Seed): {
  hints: NonNullable<ModelAssumptions['_evidenceHints']>;
  collisions: CollisionEntry[];
} {
  const hints: NonNullable<ModelAssumptions['_evidenceHints']> = {};
  const collisions: CollisionEntry[] = [];

  const addHint = (
    key: string,
    lv: LayeredValue<number> | undefined,
    extraReasoning?: string,
  ): void => {
    if (!lv || lv.resolved == null) return;
    const source = resolutionToSource(lv.resolution);
    const confidence = resolutionToConfidence(lv.resolution);
    hints[key] = {
      source,
      confidence,
      reasoning: extraReasoning ?? `Resolved from ${source} (resolution: ${lv.resolution}).`,
    };
    collisions.push(...detectCollisionsForField(key, lv, source));
  };

  // Revenue fields
  addHint('noi', seed.noi, seed.noi?.resolution != null
    ? `Year-1 NOI resolved from ${resolutionToSource(seed.noi.resolution)}.`
    : undefined);
  addHint('gpr', seed.gpr);
  addHint('egi', seed.egi);
  addHint('net_rental_income', seed.net_rental_income);
  addHint('vacancy_pct', seed.vacancy_pct);
  addHint('loss_to_lease_pct', seed.loss_to_lease_pct);
  addHint('concessions_pct', seed.concessions_pct);
  addHint('bad_debt_pct', seed.bad_debt_pct);
  addHint('other_income_per_unit', seed.other_income_per_unit);
  // Expense fields
  addHint('real_estate_tax', seed.real_estate_tax);
  addHint('insurance', seed.insurance);
  addHint('management_fee_pct', seed.management_fee_pct);
  addHint('payroll', seed.payroll);
  addHint('repairs_maintenance', seed.repairs_maintenance);
  addHint('utilities', seed.utilities);
  addHint('contract_services', seed.contract_services);
  addHint('turnover', seed.turnover);
  addHint('g_and_a', seed.g_and_a);
  addHint('total_opex', seed.total_opex);

  return { hints, collisions };
}

/**
 * Map a `ProFormaAssumptions` envelope to the flat `ModelAssumptions` struct.
 *
 * All fields are derived from plain scalar values — `LayeredValue<T>` wrappers
 * are not expected here because `ProFormaAssumptions` carries resolved scalars.
 * (The seeder's `LayeredValue` metadata stays in `ProFormaYear1Seed`; by the
 * time the engine service receives `ProFormaAssumptions`, values are already
 * resolved to numbers.)
 */
/**
 * Safely extract a numeric scalar from a value that may be a plain number OR
 * a `LayeredValue<number>` wrapper (i.e. `{ resolved: number; ... }`).
 *
 * This protects the bridge from accidentally receiving un-resolved LayeredValue
 * envelopes from upstream callers that forget to call resolve() first.
 */
function toNumber(v: unknown, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number') return isFinite(v) ? v : fallback;
  if (typeof v === 'object') {
    const lv = v as Record<string, unknown>;
    if (typeof lv['resolved'] === 'number' && isFinite(lv['resolved'] as number)) {
      return lv['resolved'] as number;
    }
    if (typeof lv['override'] === 'number' && isFinite(lv['override'] as number)) {
      return lv['override'] as number;
    }
  }
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

export function mapProFormaAssumptionsToModelAssumptions(
  a: ProFormaAssumptions
): ModelAssumptions {
  const units = toNumber(a.dealInfo?.totalUnits, 1) || 1;
  const totalSF = toNumber(a.dealInfo?.netRentableSF, 0);
  const avgUnitSf = units > 0 && totalSF > 0 ? totalSF / units : 800;

  // ── Market / in-place rent ────────────────────────────────────────────────
  let marketRent = 0;
  let inPlaceRent = 0;
  if (a.unitMix && a.unitMix.length > 0) {
    const totalUnitsInMix = a.unitMix.reduce((s, u) => s + u.units, 0) || units;
    marketRent = a.unitMix.reduce((s, u) => s + u.marketRent * u.units, 0) / totalUnitsInMix;
    inPlaceRent = a.unitMix.reduce((s, u) => s + u.inPlaceRent * u.units, 0) / totalUnitsInMix;
  }
  if (marketRent <= 0) marketRent = 1500;
  if (inPlaceRent <= 0) inPlaceRent = marketRent;

  // ── Purchase / closing costs ─────────────────────────────────────────────
  const purchasePrice = toNumber(a.acquisition?.purchasePrice, 0);
  const closingCostsTotal = a.acquisition.closingCosts
    ? Object.values(a.acquisition.closingCosts).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
    : 0;
  const closingCostsPct = purchasePrice > 0 ? closingCostsTotal / purchasePrice : 0.01;

  // ── Florida flags ─────────────────────────────────────────────────────────
  const isFlorida = a.dealInfo.state?.toUpperCase() === 'FL';

  // ── CapEx budget ─────────────────────────────────────────────────────────
  const capexLineTotal = (a.capex.lineItems || []).reduce((s, i) => s + (i.amount || 0), 0);
  const capexBudget = capexLineTotal * (1 + (a.capex.contingencyPct || 0.10));

  // ── Revenue ──────────────────────────────────────────────────────────────
  const rentGrowth: number[] = Array.isArray(a.revenue.rentGrowth)
    ? [...a.revenue.rentGrowth]
    : [0.03, 0.03, 0.03, 0.03, 0.03];
  // Ensure enough years
  while (rentGrowth.length < a.holdPeriod + 1) {
    rentGrowth.push(rentGrowth[rentGrowth.length - 1] || 0.03);
  }

  const lossToLease = a.revenue.lossToLease ?? 0.03;
  const stabilizedOccupancy = a.revenue.stabilizedOccupancy ?? 0.93;
  const vacancyStab = Math.max(0, 1 - stabilizedOccupancy);
  const vacancyY1 = vacancyStab; // conservative: start at stabilized vacancy
  const badDebt = a.revenue.collectionLoss ?? 0.01;
  const concessions = 0; // ProFormaAssumptions does not carry a concessions scalar

  // Other income: sum perUnitMonth × penetration × 12 months → annual per unit
  let otherIncomePerUnit = 0;
  if (a.revenue.otherIncome) {
    for (const oi of Object.values(a.revenue.otherIncome)) {
      if (oi && typeof oi === 'object') {
        otherIncomePerUnit += (oi.perUnitMonth ?? 0) * (oi.penetration ?? 1.0) * 12;
      }
    }
  }

  // ── Expenses ─────────────────────────────────────────────────────────────
  const exp = a.expenses || {};

  const getExpAmt = (key: string): number => {
    const e = exp[key];
    if (!e) return 0;
    return e.amount ?? 0;
  };

  const getExpGrowth = (key: string): number => {
    const e = exp[key];
    if (!e) return 0.03;
    const gr = e.growthRate ?? 0.03;
    return gr > 1 ? gr / 100 : gr;
  };

  const payrollPerUnit = getExpAmt('payroll') / units;
  const maintenancePerUnit = getExpAmt('repairs_maintenance') / units;
  const contractServicesPerUnit = getExpAmt('contract_services') / units;
  const marketingPerUnit = getExpAmt('marketing') / units;
  const utilitiesPerUnit = getExpAmt('utilities') / units;
  const adminPerUnit = getExpAmt('g_and_a') / units;
  const insurancePerUnit = getExpAmt('insurance') / units;

  // Replacement reserves: prefer explicit expense line, fall back to capex.reservesPerUnit
  const replacementReserves =
    getExpAmt('replacement_reserves') > 0
      ? getExpAmt('replacement_reserves') / units
      : (a.capex.reservesPerUnit ?? 250);

  // Management fee: expressed as a fraction of EGI in the runner.
  // Compute from the expense amount or default to 5%.
  const mgmtAmt = getExpAmt('management_fee');
  let managementFee = 0.05; // default 5%
  if (mgmtAmt > 0) {
    // Estimate EGI from Y1 GPR × stabilizedOccupancy as a denominator proxy
    const estGPR = units * marketRent * 12;
    const estEGI = estGPR * stabilizedOccupancy;
    managementFee = estEGI > 0 ? mgmtAmt / estEGI : 0.05;
    // Clamp to reasonable range
    if (managementFee < 0.01 || managementFee > 0.15) managementFee = 0.05;
  }

  // Expense growth: use average of all expense growthRates
  const expGrowthRates = Object.keys(exp).map(k => getExpGrowth(k)).filter(r => r > 0);
  const expenseGrowth = expGrowthRates.length > 0
    ? expGrowthRates.reduce((s, r) => s + r, 0) / expGrowthRates.length
    : 0.03;

  // ── Financing ─────────────────────────────────────────────────────────────
  const loanAmount = toNumber(a.financing?.loanAmount, 0);
  const ltv = purchasePrice > 0 ? loanAmount / purchasePrice : 0;
  // financing.term and financing.amortization are in YEARS; runner expects MONTHS
  const termMonths = (toNumber(a.financing?.term, 5)) * 12;
  const amortMonths = (toNumber(a.financing?.amortization, 30)) * 12;
  const ioPeriod = toNumber(a.financing?.ioPeriod, 0); // already in months
  const rate = toNumber(a.financing?.interestRate, 0.065) || 0.065;
  const originationFeePct = toNumber(a.financing?.originationFee, 0.01) || 0.01;

  // ── Disposition ───────────────────────────────────────────────────────────
  const exitCap = toNumber(a.disposition?.exitCapRate, 0.065) || 0.065;
  const saleCosts = toNumber(a.disposition?.sellingCosts, 0.02) || 0.02;

  // ── Waterfall ─────────────────────────────────────────────────────────────
  const equity = toNumber(a.waterfall?.equityContribution, 0) || (purchasePrice - loanAmount);
  const lpShare = toNumber(a.waterfall?.lpShare, 0.99) || 0.99;
  const gpShare = toNumber(a.waterfall?.gpShare, 0.01) || 0.01;
  const lpEquity = equity * lpShare;
  const gpEquity = equity * gpShare;

  const hurdles = a.waterfall.hurdles || [];
  const preferredReturn = hurdles[0]?.hurdleRate ?? 0.08;
  const promoteTiers: [number, number, number] = [
    hurdles[0]?.hurdleRate ?? 0.08,
    hurdles[1]?.hurdleRate ?? 0.12,
    hurdles[2]?.hurdleRate ?? 0.15,
  ];
  const promoteSplits: [number, number, number] = [
    hurdles[0]?.promoteToGP ?? 0.20,
    hurdles[1]?.promoteToGP ?? 0.30,
    hurdles[2]?.promoteToGP ?? 0.50,
  ];

  return {
    units,
    avgUnitSf,
    marketRent,
    inPlaceRent,
    purchasePrice,
    closingCostsPct,
    isFlorida,
    docStampsPct: 0,
    intangibleTaxPct: 0,
    titleInsurancePct: 0,
    capexBudget,
    rentGrowth,
    lossToLease,
    vacancyY1,
    vacancyStab,
    concessions,
    badDebt,
    otherIncomePerUnit,
    expenseGrowth,
    payrollPerUnit,
    maintenancePerUnit,
    contractServicesPerUnit,
    marketingPerUnit,
    utilitiesPerUnit,
    adminPerUnit,
    insurancePerUnit,
    managementFee,
    replacementReserves,
    loanAmount,
    ltv,
    term: termMonths,
    amort: amortMonths,
    ioPeriod,
    rate,
    originationFeePct,
    prepayPenalty: a.financing.prepayPenalty ?? 0,
    exitCap,
    saleCosts,
    holdYears: a.holdPeriod || 5,
    lpEquity,
    gpEquity,
    preferredReturn,
    promoteTiers,
    promoteSplits,
    dealType: a.modelType || 'existing',
  };
}

/**
 * Coerce a `FinancialModelResult` (LLM output) into a partial `ModelResults`-
 * shaped object. This is a literal field-to-field coercion: every scalar KPI
 * field that exists in both interfaces is mapped directly; fields present only
 * in `ModelResults` (e.g. detailed amortisation schedule, tax arrays, etc.)
 * are stubbed with safe-zero / empty-array values so the returned object
 * satisfies the `ModelResults` shape contract without crashing downstream code.
 *
 * PRIMARY USE CASE: pass the returned object to `runIntegrityChecks()` to
 * validate the LLM's own arithmetic against the same invariant suite that the
 * deterministic runner uses. This surfaces arithmetic errors in the LLM output
 * independently of the deterministic runner numbers.
 *
 * NOTE: because `FinancialModelResult.annualCashFlow` uses different field
 * names from `ModelResults.annualCashFlow` (e.g. `noi` vs `noi`, but
 * `effectiveGrossRevenue` vs `effectiveGrossIncome`), the cash-flow rows are
 * mapped on a best-effort basis.  Use the deterministic runner's own results
 * for integrity checks when possible.
 */
export function coerceFinancialModelResultToModelResultsShape(
  llm: import('../financial-model-engine.service').FinancialModelResult,
): import('./deterministic-model-runner').ModelResults {
  const annualCashFlow = (llm.annualCashFlow ?? []).map((row, i) => ({
    year: row.year ?? i + 1,
    grossPotentialRent: row.potentialRent ?? 0,
    lossToLease: row.lossToLease ?? 0,
    vacancy: row.vacancy ?? 0,
    concessions: 0,
    badDebt: row.collectionLoss ?? 0,
    baseRevenue: row.netRentalIncome ?? 0,
    otherIncome: row.otherIncome ?? 0,
    effectiveGrossIncome: row.effectiveGrossRevenue ?? 0,
    payroll: row.operatingExpenses?.payroll ?? 0,
    maintenance: row.operatingExpenses?.repairs_maintenance ?? 0,
    contractServices: row.operatingExpenses?.contract_services ?? 0,
    marketing: row.operatingExpenses?.marketing ?? 0,
    utilities: row.operatingExpenses?.utilities ?? 0,
    admin: row.operatingExpenses?.g_and_a ?? 0,
    insurance: row.operatingExpenses?.insurance ?? 0,
    propertyTax: row.operatingExpenses?.real_estate_tax ?? 0,
    managementFee: row.operatingExpenses?.management_fee ?? 0,
    replacementReserves: row.replacementReserves ?? 0,
    totalExpenses: row.totalExpenses ?? 0,
    noi: row.noi ?? 0,
    annualInterest: 0,
    annualPrincipal: 0,
    debtService: row.debtService ?? 0,
    preTaxCashFlow: row.beforeTaxCashFlow ?? row.leveredCashFlow ?? 0,
    dscr: llm.summary?.dscr?.[i] ?? null,
    occupancy: 1 - (row.vacancy ?? 0) / Math.max(row.potentialRent ?? 1, 1),
  }));

  const dscrByYear = llm.summary?.dscr ?? [];
  const noiByYear = (llm.annualCashFlow ?? []).map(r => r.noi ?? 0);
  const cashOnCashByYear = llm.summary?.cashOnCash ?? [];

  return {
    summary: {
      purchasePrice: 0,
      loanAmount: llm.debtMetrics?.loanAmount ?? 0,
      totalEquity: llm.summary?.totalEquity ?? 0,
      noiYear1: llm.summary?.noiYear1 ?? 0,
      goingInCapRate: llm.summary?.purchaseCapRate ?? 0,
      exitCapRate: 0,
      irr: llm.summary?.irr ?? null,
      equityMultiple: llm.summary?.equityMultiple ?? null,
      avgCoC: cashOnCashByYear.length > 0
        ? cashOnCashByYear.reduce((a, b) => a + b, 0) / cashOnCashByYear.length
        : null,
      lpIrr: null,
      gpIrr: null,
      lpEquityMultiple: null,
      gpEquityMultiple: null,
      loanBalanceAtExit: 0,
      cashOnCashByYear,
      dscrByYear,
      noiByYear,
      egiByYear: [],
      debtServiceCoverageByYear: dscrByYear,
      debtYieldByYear: [],
      stabilizedCapRate: null,
      unleveredIrr: null,
      yieldOnCost: { untrended: 0, trended: 0 },
      totalProfit: 0,
      lpCoC: null,
      gpCoC: null,
      lpTotalDistributions: 0,
      lpProfit: 0,
      gpTotalDistributions: 0,
      gpPromoteEarned: 0,
    },
    annualCashFlow: annualCashFlow.map(row => ({
      ...row,
      cfads: row.preTaxCashFlow,
      debtYield: null,
      capRateOnCost: null,
      isExitYear: false,
    })),
    sourcesAndUses: {
      sources: Object.entries(llm.sourcesAndUses?.sources ?? {}).map(([label, amount]) => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label, amount, pct: 0, source: 'equity' })),
      uses: Object.entries(llm.sourcesAndUses?.uses ?? {}).map(([label, amount]) => ({ id: label.toLowerCase().replace(/\s+/g, '-'), label, amount, pct: 0, source: 'acquisition' })),
      totalSources: Object.values(llm.sourcesAndUses?.sources ?? {}).reduce((a, b) => a + b, 0),
      totalUses: Object.values(llm.sourcesAndUses?.uses ?? {}).reduce((a, b) => a + b, 0),
      delta: 0,
      balanced: false,
      benchmarks: { totalCostPerUnit: 0, debtPct: 0, equityPct: 0, capexPerUnit: 0 },
    },
    disposition: {
      stabilizedNOI: 0,
      grossSalePrice: llm.summary?.exitValue ?? 0,
      saleCosts: 0,
      netSaleProceeds: llm.summary?.netProceeds ?? 0,
      loanBalance: 0,
      equityProceeds: 0,
      dispositionDocStamps: 0,
      exitYear: 0,
    },
    debtMetrics: {
      coverage: { dscrMin: null, dscrAvg: null, dscrY1: null, dscrAtStabilization: null, debtYieldMin: null, debtYieldY1: null, breakEvenOccupancy: null, dscrStressedMinus10PctNOI: null },
      structural: { loanAmount: llm.debtMetrics?.loanAmount ?? 0, rate: 0, termMonths: 0, amortMonths: 0, ioPeriodMonths: 0, originationFee: 0, loanType: 'unknown' },
      leverage: { ltvAtClose: 0, ltvAtMaturity: 0, positiveLeverage: false, spreadOverCapRateBps: 0 },
      stress: { dscrAt10PctNOIDecline: null, breakEvenOccupancy: null },
    },
    valuation: {
      perUnit: { goingIn: 0, atExit: 0 },
      perSF: { netRentable: 0 },
      multiples: { grm: null, nim: null, opexRatio: null, capRate: llm.summary?.purchaseCapRate ?? 0, yieldOnCost: null },
    },
    sensitivityAnalysis: { matrix: { exitCapAxis: [], rentGrowthAxis: [], irrGrid: [], emGrid: [] } },
    stressScenarios: [],
    waterfallDistributions: [],
    capital: {
      amortizationSchedule: [],
      loanBalanceByYear: [],
      debtServiceByYear: [],
      debtYieldByYear: [],
      tranches: [],
      metrics: { totalCost: 0, totalEquity: 0, totalDebt: 0, equityPct: 0, debtPct: 0, capexPerUnit: 0 },
    },
    taxes: { reTax: { perYear: [], assessedValues: [] }, transferTax: { acquisition: 0, disposition: 0, refi: 0 } },
    projections: [],
    integrityChecks: [],
    reasoning: { derivationLog: [], walkthrough: '', collisionReport: [] },
    evidence: { confidence_distribution: { high: 0, medium: 0, low: 0 }, fields: [] },
    meta: { modelVersion: 'llm-coerced', runner: 'coerceFinancialModelResultToModelResultsShape', computedAt: new Date().toISOString() },
  } as import('./deterministic-model-runner').ModelResults;
}

/**
 * Coerce a `FinancialModelResult` (LLM output) into a `ModelResults`-shaped
 * object so the deterministic runner's integrity checks can be run against the
 * LLM's own numbers.
 *
 * This is a best-effort mapping: fields that exist in `FinancialModelResult`
 * are mapped directly; fields only available from the deterministic runner are
 * stubbed with safe-zero values. The caller should run `runIntegrityChecks`
 * on the result of `runModel()` (deterministic), not on this coerced object —
 * this helper is for cross-checking key summary KPIs only.
 *
 * Named cross-check comparisons (returned alongside) highlight material
 * divergence between what the LLM computed and what the deterministic runner
 * computes for the same inputs.
 */
export interface LLMVsDeterministicDivergence {
  field: string;
  llmValue: number | null;
  deterministicValue: number | null;
  deltaAbsolute: number;
  deltaPct: number | null;
  material: boolean;
}

const MATERIAL_PCT_THRESHOLD = 0.10; // 10% relative divergence is flagged

export function crossCheckLLMVsDeterministic(
  llm: FinancialModelResultShape,
  det: ModelResultsShape,
): LLMVsDeterministicDivergence[] {
  const divergences: LLMVsDeterministicDivergence[] = [];

  const compare = (
    field: string,
    llmVal: number | null | undefined,
    detVal: number | null | undefined,
  ): void => {
    const l = llmVal ?? null;
    const d = detVal ?? null;
    if (l === null && d === null) return;
    const deltaAbs = Math.abs((l ?? 0) - (d ?? 0));
    const base = Math.abs(d ?? l ?? 0);
    const deltaPct = base > 0.001 ? deltaAbs / base : null;
    divergences.push({
      field,
      llmValue: l,
      deterministicValue: d,
      deltaAbsolute: deltaAbs,
      deltaPct,
      material: deltaPct !== null ? deltaPct > MATERIAL_PCT_THRESHOLD : deltaAbs > 1000,
    });
  };

  compare('summary.irr', llm.summary?.irr, det.summary?.irr);
  compare('summary.equityMultiple', llm.summary?.equityMultiple, det.summary?.equityMultiple);
  compare('summary.noiYear1', llm.summary?.noiYear1, det.summary?.noiYear1);
  compare('summary.purchaseCapRate', llm.summary?.purchaseCapRate, det.summary?.goingInCapRate);
  compare('summary.exitValue', llm.summary?.exitValue, det.disposition?.grossSalePrice);
  compare('summary.netProceeds', llm.summary?.netProceeds, det.disposition?.netSaleProceeds);
  compare('summary.totalEquity', llm.summary?.totalEquity, det.summary?.totalEquity);
  compare('debtMetrics.dscr', llm.debtMetrics?.dscr, det.summary?.dscrByYear?.[0]);

  return divergences;
}

// Minimal shape aliases to avoid deep circular imports
type FinancialModelResultShape = {
  summary?: {
    irr?: number | null;
    equityMultiple?: number | null;
    noiYear1?: number | null;
    purchaseCapRate?: number | null;
    exitValue?: number | null;
    netProceeds?: number | null;
    totalEquity?: number | null;
  };
  debtMetrics?: { dscr?: number | null };
};

type ModelResultsShape = {
  summary?: {
    irr?: number | null;
    equityMultiple?: number | null;
    noiYear1?: number | null;
    goingInCapRate?: number | null;
    totalEquity?: number | null;
    dscrByYear?: number[];
  };
  disposition?: {
    grossSalePrice?: number | null;
    netSaleProceeds?: number | null;
  };
};
