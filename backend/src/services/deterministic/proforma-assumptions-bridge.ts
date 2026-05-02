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
import type { ModelAssumptions } from './deterministic-model-runner';

/**
 * Map a `ProFormaAssumptions` envelope to the flat `ModelAssumptions` struct.
 *
 * All fields are derived from plain scalar values — `LayeredValue<T>` wrappers
 * are not expected here because `ProFormaAssumptions` carries resolved scalars.
 * (The seeder's `LayeredValue` metadata stays in `ProFormaYear1Seed`; by the
 * time the engine service receives `ProFormaAssumptions`, values are already
 * resolved to numbers.)
 */
export function mapProFormaAssumptionsToModelAssumptions(
  a: ProFormaAssumptions
): ModelAssumptions {
  const units = a.dealInfo.totalUnits || 1;
  const totalSF = a.dealInfo.netRentableSF || 0;
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
  const purchasePrice = a.acquisition.purchasePrice || 0;
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
  const loanAmount = a.financing.loanAmount || 0;
  const ltv = purchasePrice > 0 ? loanAmount / purchasePrice : 0;
  // financing.term and financing.amortization are in YEARS; runner expects MONTHS
  const termMonths = (a.financing.term || 5) * 12;
  const amortMonths = (a.financing.amortization || 30) * 12;
  const ioPeriod = a.financing.ioPeriod || 0; // already in months
  const rate = a.financing.interestRate || 0.065;
  const originationFeePct = a.financing.originationFee || 0.01;

  // ── Disposition ───────────────────────────────────────────────────────────
  const exitCap = a.disposition.exitCapRate || 0.065;
  const saleCosts = a.disposition.sellingCosts || 0.02;

  // ── Waterfall ─────────────────────────────────────────────────────────────
  const equity = a.waterfall.equityContribution || (purchasePrice - loanAmount);
  const lpShare = a.waterfall.lpShare ?? 0.99;
  const gpShare = a.waterfall.gpShare ?? 0.01;
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
