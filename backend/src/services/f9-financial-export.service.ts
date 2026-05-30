/**
 * F9 Financial Export Service
 * Builds per-year projections and XLSX workbook for F9 Financial Engine exports.
 * Sheets: Pro Forma | Traffic Projection | Assumptions
 */

import * as XLSX from 'xlsx';
import type { DealFinancials } from './proforma-adjustment.service';
import { computeUserLineAnnual } from './proforma-seeder.service';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProjYearExport {
  year: number;
  gpr: number;
  vacancyLoss: number; lossToLease: number; concessions: number; badDebt: number; nru: number;
  nri: number; otherIncome: number; egi: number;
  payroll: number; repairs: number; turnover: number; contractSvc: number;
  marketing: number; utilities: number; gAndA: number; mgmtFee: number;
  insurance: number; reTaxes: number; reserves: number;
  totalOpex: number; noi: number;
  opMargin: number | null; noiPerUnit: number | null;
  interest: number; principal: number; annualDS: number;
  /** CapEx draw this year (total $). Sourced from user capexPerYear override or 40/35/25 fallback. */
  capexDraw: number;
  cfbt: number; netCF: number;
  coc: number | null; dscr: number | null; debtYield: number | null; occupancy: number | null;
  exitNoi: number | null; exitCap: number | null; grossSaleValue: number | null;
  sellingCosts: number | null; loanPayoff: number; netSaleProceeds: number | null;
  outstandingBalance: number;
  cumulativeEM: number | null;
}

// ─── Regime Bridge ──────────────────────────────────────────────────────────

interface RegimeFactors {
  turnoverMult: number;
  repairsMult: number;
  concessionsMult: number;
  marketingMult: number;
}

/**
 * Returns year-by-year regime multipliers for regime-sensitive line items.
 *
 * Value-add: elevated turnover/R&M/concessions during the renovation period, then drops
 * to stabilized (1.0) by the first post-renovation year.
 *
 * Lease-up / development: elevated marketing + suppressed turnover during the lease-up
 * period (new-lease first cycle), normalising afterward.
 *
 * Stabilized: all multipliers 1.0 — no adjustment to the Y1 Pro Forma base.
 *
 * Per-year per_year_overrides from the agent or user (pv.turnoverRatioOvr,
 * pv.repairsMultOvr, pv.concessionsPctOvr, pv.marketingMultOvr) take precedence over
 * these computed defaults and are applied in the main projection loop.
 */
function computeRegimeRamp(params: {
  yr: number;
  renovationPeriodYrs: number;
  leaseUpPeriodYrs: number;
  dealMode: 'value_add' | 'lease_up' | 'stabilized';
}): RegimeFactors {
  const { yr, renovationPeriodYrs, leaseUpPeriodYrs, dealMode } = params;
  const NEUTRAL: RegimeFactors = { turnoverMult: 1.0, repairsMult: 1.0, concessionsMult: 1.0, marketingMult: 1.0 };

  if (dealMode === 'value_add' && renovationPeriodYrs > 0) {
    if (yr <= renovationPeriodYrs) {
      // Progress 0→1 as we move through the renovation period.
      // Multipliers ramp down from peak (start of reno) toward transition-year levels.
      const t = renovationPeriodYrs > 1 ? (yr - 1) / (renovationPeriodYrs - 1) : 1;
      return {
        turnoverMult:    1.60 - 0.40 * t,  // 1.60 → 1.20: disruption-driven resident churn
        repairsMult:     1.25 - 0.15 * t,  // 1.25 → 1.10: deferred-maintenance catch-up
        concessionsMult: 1.40 - 0.30 * t,  // 1.40 → 1.10: retention concessions during reno
        marketingMult:   1.20 - 0.10 * t,  // 1.20 → 1.10: marketing for displaced-unit lease-up
      };
    }
    if (yr === renovationPeriodYrs + 1) {
      // First post-renovation year: slight turnover overhang as new leasing normalises.
      return { turnoverMult: 1.10, repairsMult: 1.0, concessionsMult: 1.0, marketingMult: 1.0 };
    }
    return NEUTRAL;
  }

  if (dealMode === 'lease_up' && leaseUpPeriodYrs > 0) {
    if (yr <= leaseUpPeriodYrs) {
      // Lease-up period: elevated marketing to fill units; near-zero turnover (first-cycle leases).
      const t = leaseUpPeriodYrs > 1 ? (yr - 1) / (leaseUpPeriodYrs - 1) : 1;
      return {
        turnoverMult:    0.20 + 0.40 * t,  // 0.20 → 0.60: first cohort, low churn
        repairsMult:     1.0,
        concessionsMult: 1.0,
        marketingMult:   1.75 - 0.55 * t,  // 1.75 → 1.20: aggressive initial lease-up marketing
      };
    }
    if (yr === leaseUpPeriodYrs + 1) {
      // First stabilised year after lease-up: turnover still below long-run rate.
      return { turnoverMult: 0.75, repairsMult: 1.0, concessionsMult: 1.0, marketingMult: 1.10 };
    }
    return NEUTRAL;
  }

  return NEUTRAL;
}

// ─── Projection builder ─────────────────────────────────────────────────────

export function buildProjectionsForExport(
  f: DealFinancials,
  holdYears: number,
): ProjYearExport[] {
  const { totalUnits, proforma, capitalStack, trafficProjection, assumptions } = f;

  const y1 = (field: string): number | null => {
    const row = proforma.year1.find(r => r.field === field);
    return row?.resolved ?? row?.platform ?? null;
  };
  const tyr = (yr: number) => trafficProjection?.yearly.find(t => t.year === yr);
  const pyr = (yr: number) => assumptions.perYear.find(p => p.year === yr);

  const loan = capitalStack.loanAmount ?? 0;
  const rate = capitalStack.interestRate ?? 0.07;
  const ioPeriodYrs = Math.max(0, Math.round((capitalStack.ioPeriodMonths ?? 0) / 12));
  const amortYrs = capitalStack.amortizationYears ?? 30;
  const monthlyRate = rate / 12;
  const numPmts = amortYrs * 12;
  const monthlyPayment =
    loan > 0 && monthlyRate > 0
      ? (loan * monthlyRate * Math.pow(1 + monthlyRate, numPmts)) /
        (Math.pow(1 + monthlyRate, numPmts) - 1)
      : loan > 0
        ? loan / numPmts
        : 0;

  // GPR Year 1: use resolvedAnnual from GPR decomposition (highest-fidelity)
  const gprY1 =
    assumptions.gprDecomposition?.resolvedAnnual ?? y1('gpr') ?? 0;
  const lossToLeasePctY1 = y1('loss_to_lease_pct') ?? 0;
  const concPctY1        = y1('concessions_pct') ?? 0;
  const badDebtPctY1     = y1('bad_debt_pct') ?? 0;
  const nruPctY1         = y1('non_revenue_units_pct') ?? 0;
  const otherIncY1       = y1('other_income_per_unit') ?? 0;

  // Adoption-ramp support (Task #1147): separate per-unit breakdown from user
  // lines so each projection year gets the correct ramped value.
  type AdoptionBlock = { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null | undefined;
  const _exportUserLines: Array<{ monthly: number; adoption?: AdoptionBlock }> =
    Array.isArray((f as any).otherIncomeUserLines) ? ((f as any).otherIncomeUserLines as Array<{ monthly: number; adoption?: AdoptionBlock }>) : [];
  let _computeULAExport: ((l: { monthly: number; adoption?: AdoptionBlock }, yi: number) => number) | null = null;
  const getULAExport = (l: { monthly: number; adoption?: AdoptionBlock }, yr0: number): number => {
    if (!_computeULAExport) {
      try { _computeULAExport = require('./proforma-seeder.service').computeUserLineAnnual; }
      catch { return (Number.isFinite(l.monthly) ? l.monthly : 0) * 12; }
    }
    return _computeULAExport!(l, yr0);
  };
  const userLinesTotalY1Export = _exportUserLines.reduce((s, l) => s + getULAExport(l, 0), 0);
  // breakdownOtherY1 = total annual other income Y1 minus user lines contribution (per unit/month breakdown)
  const totalOtherY1Export = otherIncY1 * totalUnits * 12;
  const breakdownOtherY1Export = totalOtherY1Export - userLinesTotalY1Export;
  const mgmtFeePctY1     = y1('management_fee_pct') ?? 0.05;
  const payrollY1        = y1('payroll') ?? 0;
  const repairsY1        = y1('repairs_maintenance') ?? 0;
  const turnoverY1       = y1('turnover') ?? 0;
  const contractY1       = y1('contract_services') ?? 0;
  const marketingY1      = y1('marketing') ?? 0;
  const utilitiesY1      = y1('utilities') ?? 0;
  const gAndAY1          = y1('g_and_a') ?? 0;
  const insuranceY1      = y1('insurance') ?? 0;
  const reTaxY1          = y1('real_estate_tax') ?? 0;
  const reservesRaw      = y1('replacement_reserves');
  // Export-path last-resort. Pattern C (three-tier age rule, system.ts) should always
  // populate replacement_reserves when the agent runs. If null here, derivation did not
  // produce a value for this deal (pre-Batch-1 underwriting or skipped derivation).
  // $350/unit = 10–25yr age band mid-point. NOT dead code — required for existing deals.
  // BUG-UTIL-01 (utilities double-count) is separate Wave 4 work; not addressed here.
  if (reservesRaw == null) {
    console.warn('[f9-export] replacement_reserves null; Pattern C derivation absent. Using $350/unit export fallback.');
  }
  const reservesY1       = reservesRaw ?? totalUnits * 350;

  let outstandingBalance = loan;
  let cumulativeCF = 0;
  const equityAtClose = capitalStack.equityAtClose ?? 0;
  const years: ProjYearExport[] = [];

  // Total CapEx budget for the 40/35/25 fallback schedule.
  // Priority: user-entered budget override (capexPerUnit $/unit → total $)
  //   → OM/broker layer from year1['capex'] (if OM parser stored it)
  //   → 0 (no draws — correct for deals with no capex budget at all).
  // The fallback schedule only fires when a budget exists AND the user has not
  // set explicit per-year draws (pv?.capexDraw). If the budget is 0, capexDraw
  // is 0 for all years — preserving existing behavior for non-capex deals.
  const capexPerUnitBudget = f.userOverrides['capexPerUnit']?.[1] ?? null;
  const capexTotalY1 = capexPerUnitBudget != null
    ? Math.round(capexPerUnitBudget * totalUnits)
    : (y1('capex') ?? 0);

  // Concession burn-off: accumulator tracks how much of Y1 concession has been
  // phased out. Each year's rate is read per-year (stepped) or flat (year-1-only),
  // falling back to assumptions.concessionBurnOffPct → 0.
  // This makes concession burn-off truly trajectory-sensitive (Section B).
  // TODO(agent): concessionBurnOffPct — agent integration out of scope here.
  let accumulatedBurnOff = 0; // grows each year; concessions = Y1 × max(0, 1 - accumulated)

  // ── Running bases for per-year override-aware compounding ─────────────────
  // Rule: when an operator override exists at year Y for field F, that overridden
  // value becomes the new compounding base for year Y+1 onward.  This prevents
  // discontinuities (e.g., payroll overridden to $300K at yr3 → yr4 = $300K × (1+g))
  // and mirrors the proforma-adjustment.service.ts projections loop exactly.
  let runGpr       = gprY1;
  let runOtherInc  = breakdownOtherY1Export; // annual $ excluding user adoption lines
  let runPayroll   = payrollY1;
  let runRepairs   = repairsY1;
  let runTurnover  = turnoverY1;
  let runContract  = contractY1;
  let runMarketing = marketingY1;
  let runUtilities = utilitiesY1;
  let runGAndA     = gAndAY1;
  let runInsurance = insuranceY1;
  let runReTax     = reTaxY1;
  let runReserves  = reservesY1;

  // ── Regime Bridge: deal-type-aware year-by-year trajectory ────────────────
  // Detect deal mode from M07 traffic signals — the most reliable automated source.
  // postRenoAbsorptionLagWks > 0  →  value-add renovation regime
  // leaseUp.weeksTo95 > 26        →  lease-up / development regime
  // Neither                       →  stabilised (no regime adjustment)
  const _postRenoLagWks = f.trafficProjection?.leasingSignals?.postRenoAbsorptionLagWks ?? 0;
  const _leaseUpWks     = f.trafficProjection?.leaseUp?.weeksTo95 ?? 0;
  const dealMode: 'value_add' | 'lease_up' | 'stabilized' =
    _postRenoLagWks > 0 ? 'value_add' :
    _leaseUpWks     > 26 ? 'lease_up'  :
    'stabilized';

  // Renovation period length: per_year_overrides scalar override wins; then M07 signal;
  // then default 2 years for value-add deals.  Capped at 3 to avoid distorting long holds.
  const renovationPeriodYrs: number = (() => {
    const ovr = f.userOverrides['renovation_period_years']?.[1];
    if (ovr != null && ovr > 0) return Math.min(3, Math.round(ovr));
    if (_postRenoLagWks > 0) return Math.min(3, Math.ceil(_postRenoLagWks / 52));
    return dealMode === 'value_add' ? 2 : 0;
  })();

  // Lease-up period length: M07 weeksTo95 converted to years, capped at 3.
  const leaseUpPeriodYrs: number =
    _leaseUpWks > 0 ? Math.min(3, Math.ceil(_leaseUpWks / 52)) : 0;

  for (let yr = 1; yr <= holdYears; yr++) {
    const tv = tyr(yr);
    const pv = pyr(yr);

    // Per-year override resolver: reads operator-saved dollar amounts from
    // per_year_overrides JSONB (surfaced here as f.userOverrides[field][yr]).
    // Keys are snake_case for Section 1/3 fields, matching the save path in
    // proforma-adjustment.service.ts (field `year1Key` → `year1Key:yrN`).
    const pyOvr = (field: string): number | null => {
      const v = f.userOverrides[field]?.[yr];
      return v != null ? v : null;
    };

    // Growth step applied TO this year (relative to year yr-1).
    // yr=1 → 0 (Y1 seeds are already the base; no growth applied to themselves).
    const rentStep = yr === 1 ? 0 : (pyr(yr - 1)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03);
    // TODO(M36): opexGrowthPct is a Section B trajectory driver — add to covariance matrix when M36 integrates.
    const opexStep = yr === 1 ? 0 : (f.userOverrides['growthOpexPct']?.[yr - 1] ?? assumptions.opexGrowthPct ?? 0.03);
    const insStep  = yr === 1 ? 0 : (f.userOverrides['growthInsurancePct']?.[yr - 1] ?? 0.035);

    // GPR: operator dollar override wins; else compound running base with rent step.
    const gprOvr = pyOvr('gpr');
    const gpr    = gprOvr != null ? Math.round(gprOvr) : Math.round(runGpr * (1 + rentStep));
    runGpr       = gpr;

    // Vacancy: per-year traffic data wins when available
    const vacPct      = tv?.vacancyPct ?? pv?.vacancyPct ?? y1('vacancy_pct') ?? 0.05;
    const vacancyLoss = Math.round(gpr * (vacPct ?? 0.05));
    const lossToLease = Math.round(gpr * lossToLeasePctY1);
    // ── Regime multipliers for this year ─────────────────────────────────────
    // computeRegimeRamp() provides deal-type defaults; per-year agent/user overrides win.
    const rf = computeRegimeRamp({ yr, renovationPeriodYrs, leaseUpPeriodYrs, dealMode });
    // Per-year agent/user overrides take precedence over computed regime defaults.
    const regTurnoverMult  = pv?.turnoverRatioOvr   ?? rf.turnoverMult;
    const regRepairsMult   = pv?.repairsMultOvr      ?? rf.repairsMult;
    const regMarketingMult = pv?.marketingMultOvr    ?? rf.marketingMult;

    // Concessions — three-path resolution:
    // 1. Agent/user per-year concessionsPct override → exact % of GPR, no burn-off applied
    // 2. Value-add regime → Y1 rate × regime concessionsMult (bypasses burn-off accumulator)
    // 3. Stabilised path → existing burn-off accumulator (preserves prior behaviour)
    const concessions = (() => {
      if (pv?.concessionsPctOvr != null) {
        return Math.round(gpr * pv.concessionsPctOvr);
      }
      if (dealMode === 'value_add' && renovationPeriodYrs > 0) {
        return Math.round(gpr * concPctY1 * rf.concessionsMult);
      }
      return Math.round(gpr * concPctY1 * Math.max(0, 1 - accumulatedBurnOff));
    })();
    // Advance the burn-off accumulator (affects path 3 next year).
    const burnOffThisYr = f.userOverrides['concessionBurnOffPct']?.[yr]
      ?? assumptions.concessionBurnOffPct
      ?? 0;
    accumulatedBurnOff = Math.min(1, accumulatedBurnOff + burnOffThisYr);
    const badDebt     = Math.round(gpr * badDebtPctY1);
    const nru         = Math.round(gpr * nruPctY1);
    const nri         = gpr - vacancyLoss - lossToLease - concessions - badDebt - nru;

    // Other income: grows with rent on the running base (adoption-ramp user lines unchanged).
    const userLinesThisYrExport = _exportUserLines.reduce((s, l) => s + getULAExport(l, yr - 1), 0);
    runOtherInc = runOtherInc * (1 + rentStep);
    const otherIncome = Math.round(runOtherInc + userLinesThisYrExport);
    const egi         = nri + otherIncome;

    // Expenses — override-aware running-base compounding.
    // Dollar-amount operator overrides always take priority; when present, the
    // overridden value becomes the new compounding base for subsequent years.
    // Regime multipliers (value-add / lease-up) are preserved and applied before
    // the growth step on lines where they were already active.
    const payrollOvr   = pyOvr('payroll');
    const payroll      = payrollOvr != null ? Math.round(payrollOvr) : Math.round(runPayroll * (1 + opexStep));
    runPayroll         = payroll;

    // Regime-sensitive lines: regime multiplier applied before the growth step so the
    // compounding base already reflects the regime adjustment each year.
    const repairsOvr   = pyOvr('repairs_maintenance');
    const repairs      = repairsOvr != null ? Math.round(repairsOvr) : Math.round(runRepairs * regRepairsMult * (1 + opexStep));
    runRepairs         = repairsOvr != null ? repairsOvr : runRepairs * (1 + opexStep);

    const turnoverOvr  = pyOvr('turnover');
    const turnover     = turnoverOvr != null ? Math.round(turnoverOvr) : Math.round(runTurnover * regTurnoverMult * (1 + opexStep));
    runTurnover        = turnoverOvr != null ? turnoverOvr : runTurnover * (1 + opexStep);

    const contractOvr  = pyOvr('contract_services');
    const contractSvc  = contractOvr != null ? Math.round(contractOvr) : Math.round(runContract * (1 + opexStep));
    runContract        = contractSvc;

    const marketingOvr = pyOvr('marketing');
    const marketing    = marketingOvr != null ? Math.round(marketingOvr) : Math.round(runMarketing * regMarketingMult * (1 + opexStep));
    runMarketing       = marketingOvr != null ? marketingOvr : runMarketing * (1 + opexStep);

    const utilitiesOvr = pyOvr('utilities');
    const utilities    = utilitiesOvr != null ? Math.round(utilitiesOvr) : Math.round(runUtilities * (1 + opexStep));
    runUtilities       = utilities;

    const gAndAOvr     = pyOvr('g_and_a');
    const gAndA        = gAndAOvr != null ? Math.round(gAndAOvr) : Math.round(runGAndA * (1 + opexStep));
    runGAndA           = gAndA;

    const mgmtFee      = Math.round(egi * (mgmtFeePctY1 ?? 0.05));

    const insuranceOvr = pyOvr('insurance');
    const insurance    = insuranceOvr != null ? Math.round(insuranceOvr) : Math.round(runInsurance * (1 + insStep));
    runInsurance       = insurance;

    const reTaxesOvr   = pyOvr('real_estate_tax');
    const reTaxes      = reTaxesOvr != null ? Math.round(reTaxesOvr) : Math.round(runReTax * (1 + opexStep));
    runReTax           = reTaxes;

    const reservesOvr  = pyOvr('replacement_reserves');
    const reserves     = reservesOvr != null ? Math.round(reservesOvr) : Math.round(runReserves * (1 + opexStep));
    runReserves        = reserves;

    const totalOpex  = payroll + repairs + turnover + contractSvc + marketing +
                       utilities + gAndA + mgmtFee + insurance + reTaxes + reserves;
    const noi        = egi - totalOpex;

    let interest = 0, principal = 0, annualDS = 0;
    if (loan > 0) {
      if (yr <= ioPeriodYrs || amortYrs === 0) {
        interest = Math.round(outstandingBalance * rate);
        principal = 0;
        annualDS  = interest;
      } else {
        let yi = 0, yp = 0;
        for (let m = 0; m < 12; m++) {
          const mi = outstandingBalance * monthlyRate;
          const mp = monthlyPayment - mi;
          yi += mi;
          yp += mp;
          outstandingBalance = Math.max(0, outstandingBalance - mp);
        }
        interest  = Math.round(yi);
        principal = Math.round(yp);
        annualDS  = interest + principal;
      }
    }

    // Per-year CapEx draw: read from assumptions.perYear[yr].capexDraw (populated by the
    // financials assembly from per_year_overrides['capexPerYear:yr{n}'], $/unit) → then
    // fall back to the 40/35/25 front-loaded schedule derived from Y1 total capex.
    // Falls back to 0 when no capex budget is set, preserving existing behavior.
    const capexDraw = (() => {
      if (pv?.capexDraw != null) return Math.round(pv.capexDraw * totalUnits);
      if (yr === 1) return Math.round(capexTotalY1 * 0.40);
      if (yr === 2) return Math.round(capexTotalY1 * 0.35);
      if (yr === 3) return Math.round(capexTotalY1 * 0.25);
      return 0;
    })();

    const cfbt  = noi - annualDS - capexDraw;
    const netCF = cfbt;
    cumulativeCF += netCF;

    const coc       = equityAtClose > 0 ? cfbt / equityAtClose : null;
    const dscr      = annualDS > 0 ? noi / annualDS : null;
    const debtYield = outstandingBalance > 0 ? noi / outstandingBalance : null;
    const occupancy = tv?.occupancyPct ?? (1 - (vacPct ?? 0.05));

    const exitCap =
      pv?.exitCapIfLastYear ??
      trafficProjection?.calibrated.exitCap ??
      assumptions.exitCap ??
      0.055;
    const exitNoi =
      Math.round(noi * (1 + (pyr(yr)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03)));
    const grossSaleValue =
      exitCap && exitCap > 0 ? Math.round(exitNoi / exitCap) : null;
    const sellingCosts   = grossSaleValue ? Math.round(grossSaleValue * 0.015) : null;
    const loanPayoff     = Math.round(outstandingBalance);
    const netSaleProceeds =
      grossSaleValue != null && sellingCosts != null
        ? grossSaleValue - sellingCosts - loanPayoff
        : null;

    const cumulativeEM =
      equityAtClose > 0 && netSaleProceeds != null
        ? (cumulativeCF + netSaleProceeds) / equityAtClose
        : null;

    years.push({
      year: yr,
      gpr, vacancyLoss, lossToLease, concessions, badDebt, nru,
      nri, otherIncome, egi,
      payroll, repairs, turnover, contractSvc, marketing, utilities,
      gAndA, mgmtFee, insurance, reTaxes, reserves,
      totalOpex, noi,
      opMargin:   egi > 0 ? noi / egi : null,
      noiPerUnit: totalUnits > 0 ? noi / totalUnits : null,
      interest, principal, annualDS,
      capexDraw,
      cfbt, netCF,
      coc, dscr, debtYield, occupancy,
      exitNoi, exitCap, grossSaleValue, sellingCosts, loanPayoff, netSaleProceeds,
      outstandingBalance,
      cumulativeEM,
    });
  }
  return years;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colLetter(col: number): string {
  let letter = '';
  let c = col + 1;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}

function addr(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function fmtDollar(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function setComment(ws: XLSX.WorkSheet, cellAddr: string, text: string): void {
  if (!ws[cellAddr]) return;
  if (!ws[cellAddr].c) ws[cellAddr].c = [];
  (ws[cellAddr].c as Array<{ a: string; t: string }>).push({ a: 'JediRE F9', t: text });
}

// ─── Cell style helpers ──────────────────────────────────────────────────
// Color semantics (standard Excel audit convention):
//   Black    = formula / derived row (computed from inputs)  (000000 bold)
//   Blue     = user override cell    (value differs from platform) (0070C0)
//   Green    = cross-sheet link      (sourced from M07 Traffic / another sheet) (00B050)

type CellStyle = {
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number; name?: string };
  fill?: { fgColor?: { rgb: string }; patternType?: string };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
  };
  alignment?: { horizontal?: string; vertical?: string };
  numFmt?: string;
};

function styleCell(ws: XLSX.WorkSheet, cellAddr: string, s: CellStyle): void {
  if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
  ws[cellAddr].s = s;
}

function styleRow(
  ws: XLSX.WorkSheet,
  rowIdx: number,
  numCols: number,
  s: CellStyle,
): void {
  for (let c = 0; c <= numCols; c++) {
    styleCell(ws, addr(rowIdx, c), s);
  }
}

// Styles
const S = {
  title:   { font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F1319' }, patternType: 'solid' } },
  header:  { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B2A4A' }, patternType: 'solid' }, alignment: { horizontal: 'center' } },
  section: { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: 'F5A623' } }, fill: { fgColor: { rgb: '0F1319' }, patternType: 'solid' }, border: { bottom: { style: 'thin', color: { rgb: '2A3A5A' } } } },
  formula:  { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '000000' } }, border: { top: { style: 'thin', color: { rgb: '2A3A5A' } }, bottom: { style: 'double', color: { rgb: '2A3A5A' } } } },
  override: { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '0070C0' } } },
  linked:   { font: { sz: 10, name: 'Calibri', color: { rgb: '00B050' } } },
  input:    { font: { sz: 10, name: 'Calibri', color: { rgb: '000000' } } },
} as const;

// ─── Sheet builders ──────────────────────────────────────────────────────────

// Row index constants (0-based array index → Excel row = idx + 1)
const R = {
  TITLE:    0,
  SUBTITLE: 1,
  HDRS:     3,
  GPR:      4,
  VAC:      5,
  LTL:      6,
  CONC:     7,
  BADDEBT:  8,
  NRU:      9,
  NRI:      10,
  OTH:      11,
  EGI:      12,
  // Row 13: empty
  // Row 14: EXPENSES section header (but we span it)
  PAYROLL:  15,
  REPAIRS:  16,
  TURNOVER: 17,
  CONTRACT: 18,
  MKTG:     19,
  UTIL:     20,
  GANDA:    21,
  MGMT:     22,
  INS:      23,
  RETAX:    24,
  RESV:     25,
  TOPEX:    26,
  // Row 27: empty
  NOI:      28,
  OPMARGIN: 29,
  NOIPU:    30,
  // Row 31: empty
  // Row 32: DEBT SERVICE header
  INTEREST: 33,
  PRINC:    34,
  TOTALDS:  35,
  CAPEX:    36,
  CFBT:     37,
  NETCF:    38,
  // Row 39: empty
  // Row 40: METRICS header
  COC:      41,
  DSCR:     42,
  DY:       43,
  OCC:      44,
  CEM:      45,
  // Row 46: empty
  // Row 47: EXIT header
  EXNOI:    48,
  EXCAP:    49,
  GROSSSALE:50,
  SELLING:  51,
  LOANPAY:  52,
  NETSALE:  53,
};

function buildProFormaSheet(
  f: DealFinancials,
  projs: ProjYearExport[],
  holdYears: number,
): XLSX.WorkSheet {
  const N = holdYears;
  const yearCols = Array.from({ length: N }, (_, i) => i + 1);

  // ── Per-line detail sub-rows (Task #1172 / #1204 / #1206) ───────────────
  // All user income lines (flat and ramping) get their own Excel row immediately
  // below the "Other Income" summary row. Ramping lines carry a confirmed/projected
  // suffix (Task #1206); flat lines show their name only (Task #1204).
  type UserLine = { label: string; monthly: number; confirmed?: boolean; note?: string; adoption?: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null };
  // Task #1206: confirmed lines (explicit flag or note containing "confirmed") get
  // "— RAMP (Confirmed)"; all others get "— RAMP (Projected)" so lenders can
  // distinguish executed contracts from best-case projections.
  const rampSuffix = (line: UserLine): string =>
    (line.confirmed === true || /confirmed/i.test(line.note ?? ''))
      ? '— RAMP (Confirmed)'
      : '— RAMP (Projected)';
  const allUserLines: UserLine[] = Array.isArray((f as any).otherIncomeUserLines) ? ((f as any).otherIncomeUserLines as UserLine[]) : [];
  const rampingLines = allUserLines.filter(l => l.adoption != null);
  const rampOffset   = allUserLines.length; // extra rows inserted between OTH and EGI (flat + ramping)

  // Build AoA — initialize with empty rows
  const totalRows = 55 + rampOffset;
  const aoa: (string | number | null)[][] = Array.from({ length: totalRows }, () => []);

  // Title
  aoa[R.TITLE] = [`Pro Forma  |  ${f.dealName}  |  ${f.totalUnits} Units`];
  aoa[R.SUBTITLE] = [`Hold Period: ${holdYears} Years  |  Generated: ${new Date().toLocaleDateString()}`];

  // Headers row
  aoa[R.HDRS] = ['OPERATING STATEMENT', ...yearCols.map(y => `YR ${y}`)];

  // Section label rows — rows after OTH are shifted by rampOffset
  aoa[13]                = [''];
  aoa[14 + rampOffset]   = ['EXPENSES'];
  aoa[27 + rampOffset]   = [''];
  aoa[31 + rampOffset]   = [''];
  aoa[32 + rampOffset]   = ['DEBT SERVICE'];
  aoa[36 + rampOffset]   = [''];
  aoa[39 + rampOffset]   = [''];
  aoa[40 + rampOffset]   = ['METRICS'];
  aoa[46 + rampOffset]   = [''];
  aoa[47 + rampOffset]   = ['EXIT / REVERSION'];

  type NumRow = [string, ...number[]];

  const mkRow = (
    label: string,
    key: keyof ProjYearExport,
  ): NumRow => [
    label,
    ...projs.map(p => (p[key] as number | null) ?? 0),
  ];

  // Income rows — R.OTH and above are not shifted
  aoa[R.GPR]     = mkRow('GROSS POTENTIAL RENT', 'gpr');
  aoa[R.VAC]     = mkRow('  Vacancy Loss', 'vacancyLoss');
  aoa[R.LTL]     = mkRow('  Loss to Lease', 'lossToLease');
  aoa[R.CONC]    = mkRow('  Concessions', 'concessions');
  aoa[R.BADDEBT] = mkRow('  Bad Debt / Collection Loss', 'badDebt');
  aoa[R.NRU]     = mkRow('  Non-Revenue Units', 'nru');
  aoa[R.NRI]     = mkRow('NET RENTAL INCOME', 'nri');
  aoa[R.OTH]     = mkRow('  Other Income', 'otherIncome');

  // Per-line detail rows immediately after Other Income (Task #1172 / #1204)
  // Ramping lines get a "— RAMP" suffix; flat lines show their name only.
  for (let li = 0; li < allUserLines.length; li++) {
    const line = allUserLines[li];
    const isRamping = line.adoption != null;
    aoa[R.OTH + 1 + li] = [
      isRamping ? `    ${line.label} ${rampSuffix(line)}` : `    ${line.label}`,
      ...projs.map((_, yi) =>
        isRamping
          ? Math.round(computeUserLineAnnual(line, yi))
          : Math.round(line.monthly * 12),
      ),
    ];
  }

  // All rows after OTH shifted by rampOffset
  aoa[R.EGI      + rampOffset] = mkRow('EFFECTIVE GROSS INCOME', 'egi');
  aoa[R.PAYROLL  + rampOffset] = mkRow('  Payroll / Personnel', 'payroll');
  aoa[R.REPAIRS  + rampOffset] = mkRow('  Repairs & Maintenance', 'repairs');
  aoa[R.TURNOVER + rampOffset] = mkRow('  Turnover / Make-Ready', 'turnover');
  aoa[R.CONTRACT + rampOffset] = mkRow('  Contract Services', 'contractSvc');
  aoa[R.MKTG     + rampOffset] = mkRow('  Marketing & Leasing', 'marketing');
  aoa[R.UTIL     + rampOffset] = mkRow('  Utilities', 'utilities');
  aoa[R.GANDA    + rampOffset] = mkRow('  G&A / Administrative', 'gAndA');
  aoa[R.MGMT     + rampOffset] = mkRow('  Management Fee', 'mgmtFee');
  aoa[R.INS      + rampOffset] = mkRow('  Insurance', 'insurance');
  aoa[R.RETAX    + rampOffset] = mkRow('  Real Estate Taxes', 'reTaxes');
  aoa[R.RESV     + rampOffset] = mkRow('  Replacement Reserves', 'reserves');
  aoa[R.TOPEX    + rampOffset] = mkRow('TOTAL OPERATING EXPENSES', 'totalOpex');
  aoa[R.NOI      + rampOffset] = mkRow('NET OPERATING INCOME', 'noi');
  aoa[R.OPMARGIN + rampOffset] = ['  Operating Margin %', ...projs.map(p => p.opMargin ?? 0)];
  aoa[R.NOIPU    + rampOffset] = ['  NOI / Unit', ...projs.map(p => p.noiPerUnit ?? 0)];
  aoa[R.INTEREST + rampOffset] = mkRow('  Interest', 'interest');
  aoa[R.PRINC    + rampOffset] = mkRow('  Principal Paydown', 'principal');
  aoa[R.TOTALDS  + rampOffset] = mkRow('TOTAL DEBT SERVICE', 'annualDS');
  aoa[R.CAPEX    + rampOffset] = mkRow('  (–) CapEx Draw', 'capexDraw');
  aoa[R.CFBT     + rampOffset] = mkRow('CASH FLOW BEFORE TAX', 'cfbt');
  aoa[R.NETCF    + rampOffset] = mkRow('  Net Cash Flow', 'netCF');
  aoa[R.COC      + rampOffset] = ['  Cash-on-Cash Return', ...projs.map(p => p.coc ?? 0)];
  aoa[R.DSCR     + rampOffset] = ['  DSCR', ...projs.map(p => p.dscr ?? 0)];
  aoa[R.DY       + rampOffset] = ['  Debt Yield', ...projs.map(p => p.debtYield ?? 0)];
  aoa[R.OCC      + rampOffset] = ['  Occupancy %', ...projs.map(p => p.occupancy ?? 0)];
  aoa[R.CEM      + rampOffset] = ['  Cumulative Equity Multiple', ...projs.map(p => p.cumulativeEM ?? 0)];
  aoa[R.EXNOI    + rampOffset] = mkRow('  Forward NOI (Exit)', 'exitNoi');
  aoa[R.EXCAP    + rampOffset] = ['  Exit Cap Rate', ...projs.map(p => p.exitCap ?? 0)];
  aoa[R.GROSSSALE+ rampOffset] = mkRow('  Gross Sale Value', 'grossSaleValue');
  aoa[R.SELLING  + rampOffset] = mkRow('  (–) Selling Costs (1.5%)', 'sellingCosts');
  aoa[R.LOANPAY  + rampOffset] = mkRow('  (–) Loan Payoff', 'loanPayoff');
  aoa[R.NETSALE  + rampOffset] = mkRow('NET SALE PROCEEDS', 'netSaleProceeds');

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Overlay formula cells (post-OTH rows shifted by rampOffset) ───────────
  for (let y = 0; y < N; y++) {
    const col = y + 1;         // col 0=A (labels), col 1=B (YR1)...
    const C   = colLetter(col);

    // NRI = GPR - VAC - LTL - CONC - BADDEBT - NRU (no shift — rows ≤ OTH)
    ws[addr(R.NRI, col)] = {
      t: 'n',
      f: `=${C}${R.GPR+1}-${C}${R.VAC+1}-${C}${R.LTL+1}-${C}${R.CONC+1}-${C}${R.BADDEBT+1}-${C}${R.NRU+1}`,
      v: projs[y].nri,
    };
    // EGI = NRI + OtherIncome (EGI shifted; OTH and NRI not shifted)
    ws[addr(R.EGI + rampOffset, col)] = {
      t: 'n',
      f: `=${C}${R.NRI+1}+${C}${R.OTH+1}`,
      v: projs[y].egi,
    };
    // Total OpEx = SUM(PAYROLL:RESV) — both bounds shifted
    ws[addr(R.TOPEX + rampOffset, col)] = {
      t: 'n',
      f: `=SUM(${C}${R.PAYROLL+rampOffset+1}:${C}${R.RESV+rampOffset+1})`,
      v: projs[y].totalOpex,
    };
    // NOI = EGI - TOPEX — both shifted
    ws[addr(R.NOI + rampOffset, col)] = {
      t: 'n',
      f: `=${C}${R.EGI+rampOffset+1}-${C}${R.TOPEX+rampOffset+1}`,
      v: projs[y].noi,
    };
    // Op Margin = NOI / EGI — both shifted
    ws[addr(R.OPMARGIN + rampOffset, col)] = {
      t: 'n',
      f: `=${C}${R.NOI+rampOffset+1}/${C}${R.EGI+rampOffset+1}`,
      v: projs[y].opMargin ?? 0,
      z: '0.00%',
    };
    // NOI/Unit = NOI / totalUnits
    if (f.totalUnits > 0) {
      ws[addr(R.NOIPU + rampOffset, col)] = {
        t: 'n',
        f: `=${C}${R.NOI+rampOffset+1}/${f.totalUnits}`,
        v: projs[y].noiPerUnit ?? 0,
      };
    }
    // Total DS = INTEREST + PRINC — both shifted
    ws[addr(R.TOTALDS + rampOffset, col)] = {
      t: 'n',
      f: `=${C}${R.INTEREST+rampOffset+1}+${C}${R.PRINC+rampOffset+1}`,
      v: projs[y].annualDS,
    };
    // CFBT = NOI - DS - CapEx Draw — all shifted
    ws[addr(R.CFBT + rampOffset, col)] = {
      t: 'n',
      f: `=${C}${R.NOI+rampOffset+1}-${C}${R.TOTALDS+rampOffset+1}-${C}${R.CAPEX+rampOffset+1}`,
      v: projs[y].cfbt,
    };
    // Net Sale Proceeds = GrossSale - Selling - LoanPayoff — all shifted
    ws[addr(R.NETSALE + rampOffset, col)] = {
      t: 'n',
      f: `=${C}${R.GROSSSALE+rampOffset+1}-${C}${R.SELLING+rampOffset+1}-${C}${R.LOANPAY+rampOffset+1}`,
      v: projs[y].netSaleProceeds ?? 0,
    };

    // ── Cross-sheet formula: Vacancy Loss references M07 Traffic Projection sheet ──
    // Traffic Projection data rows start at Excel row 5 (row index 4) for Year 1.
    // Column C (index 2) = Vacancy % in the Traffic Projection sheet.
    const tvYr = f.trafficProjection?.yearly.find(t => t.year === y + 1);
    if (tvYr?.vacancyPct != null) {
      const trafficVacRow = 4 + (y + 1);   // Excel row in Traffic sheet for Year (y+1)
      ws[addr(R.VAC, col)] = {
        t: 'n',
        // Vacancy Loss = GPR × vacancy % pulled from Traffic Projection sheet
        f: `=${C}${R.GPR + 1}*'Traffic Projection'!C${trafficVacRow}`,
        v: projs[y].vacancyLoss,
      };
    }

    // ── Layer metadata cell comments on GPR row ──────────────────────────
    const gpd = f.assumptions.gprDecomposition;
    if (gpd) {
      const gprCell = addr(R.GPR, col);
      const commentLines = [
        `GPR Layer Sources (Annual):`,
        `  Resolved:  ${fmtDollar(gpd.resolvedAnnual)} (${fmtDollar(gpd.resolvedPerUnitMo ? gpd.resolvedPerUnitMo * 12 / 12 : null)}/mo/unit)`,
        gpd.platformAnnual != null ? `  Platform: ${fmtDollar(gpd.platformAnnual)}` : null,
        gpd.brokerAnnual   != null ? `  Broker:   ${fmtDollar(gpd.brokerAnnual)}` : null,
        gpd.t12Annual      != null ? `  T12 Actual: ${fmtDollar(gpd.t12Annual)}` : null,
        gpd.rentRollAnnual != null ? `  Rent Roll: ${fmtDollar(gpd.rentRollAnnual)}` : null,
      ].filter((l): l is string => l !== null).join('\n');
      setComment(ws, gprCell, commentLines);
    }

    // ── Layer metadata comment on Vacancy row ────────────────────────────
    if (tvYr?.vacancyPct != null) {
      const vacCell = addr(R.VAC, col);
      setComment(ws, vacCell,
        `Vacancy Source: M07 Traffic Engine\n  Year ${y + 1} vacancy: ${fmtPct(tvYr.vacancyPct)}\n  Occupancy: ${fmtPct(tvYr.occupancyPct)}`,
      );
    }
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 36 },                                              // Label column (wider for ramp labels)
    ...Array.from({ length: N }, () => ({ wch: 14 })),       // Year columns
  ];

  // Set sheet range
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRows - 1, c: N },
  });

  // ── Apply cell styles (black=formula rows, blue=user overrides, green=cross-sheet M07 link) ──
  styleRow(ws, R.TITLE,   N, S.title);
  styleRow(ws, R.SUBTITLE, N, S.title);
  styleRow(ws, R.HDRS,    N, S.header);

  // Section headers (adjusted for rampOffset)
  for (const secRow of [14 + rampOffset, 32 + rampOffset, 40 + rampOffset, 47 + rampOffset]) {
    styleRow(ws, secRow, N, S.section);
  }
  styleCell(ws, addr(R.GPR, 0), S.section);

  // User-line detail rows (flat + ramping) — input style to distinguish from summary row
  for (let li = 0; li < allUserLines.length; li++) {
    for (let c = 0; c <= N; c++) {
      styleCell(ws, addr(R.OTH + 1 + li, c), S.input);
    }
  }

  // Formula/derived rows (black bold): NRI, EGI, TOPEX, NOI, TOTALDS, CFBT, NETSALE
  for (const fRow of [R.NRI, R.EGI + rampOffset, R.TOPEX + rampOffset, R.NOI + rampOffset, R.TOTALDS + rampOffset, R.CFBT + rampOffset, R.NETSALE + rampOffset]) {
    for (let c = 0; c <= N; c++) {
      styleCell(ws, addr(fRow, c), S.formula);
    }
  }

  // Cross-sheet linked rows (green): Vacancy cells sourced from M07 Traffic sheet
  for (let c = 1; c <= N; c++) {
    const yr = c;
    const tvYr = f.trafficProjection?.yearly.find(t => t.year === yr);
    if (tvYr?.vacancyPct != null) {
      styleCell(ws, addr(R.VAC, c), S.linked);
    }
  }

  // User override cells (blue): any cell where userOverrides[field][year] is set
  // Rows after OTH use rampOffset-adjusted indices
  const rowFieldMap: Record<number, string> = {
    [R.GPR]: 'gpr', [R.VAC]: 'vacancy_pct', [R.LTL]: 'loss_to_lease_pct',
    [R.CONC]: 'concessions_pct', [R.BADDEBT]: 'bad_debt_pct', [R.NRU]: 'non_revenue_units_pct',
    [R.OTH]: 'other_income_per_unit',
    [R.PAYROLL  + rampOffset]: 'payroll',
    [R.REPAIRS  + rampOffset]: 'repairs_maintenance',
    [R.TURNOVER + rampOffset]: 'turnover',
    [R.CONTRACT + rampOffset]: 'contract_services',
    [R.MKTG     + rampOffset]: 'marketing',
    [R.UTIL     + rampOffset]: 'utilities',
    [R.GANDA    + rampOffset]: 'g_and_a',
    [R.MGMT     + rampOffset]: 'management_fee_pct',
    [R.INS      + rampOffset]: 'insurance',
    [R.RETAX    + rampOffset]: 'real_estate_tax',
    [R.RESV     + rampOffset]: 'replacement_reserves',
  };
  for (const [rowStr, field] of Object.entries(rowFieldMap)) {
    const rowIdx = Number(rowStr);
    const fieldOverrides = f.userOverrides[field];
    if (!fieldOverrides) continue;
    for (let c = 1; c <= N; c++) {
      const yr = c;
      if (fieldOverrides[yr] != null) {
        styleCell(ws, addr(rowIdx, c), S.override);
      }
    }
  }

  return ws;
}

function buildTrafficSheet(f: DealFinancials, holdYears: number): XLSX.WorkSheet {
  const yearly = f.trafficProjection?.yearly ?? [];
  // T07 is a scalar from leasingSignals; repeated across all years to satisfy per-year column requirement
  const t07Scalar = f.trafficProjection?.leasingSignals?.t07LeaseUpWeeksTo95 ?? null;

  const aoa: (string | number | null)[][] = [
    ['Traffic Projection — M07 Engine', null, null, null, null, null, null, null, null],
    [`Deal: ${f.dealName}  |  ${f.totalUnits} Units  |  Hold: ${holdYears} Yrs  |  Generated: ${new Date().toLocaleDateString()}`],
    [],
    // T07 column added per-year (repeats scalar value; per-year trajectory not yet in M07 output)
    ['Year', 'Occupancy %', 'Vacancy %', 'Eff Rent/Mo', 'Rent Growth %',
     'T01 Weekly Tours', 'T05 Closing Ratio', 'T06 Weekly Leases', 'T07 Lease-Up Wks (to 95%)'],
    ...Array.from({ length: holdYears }, (_, i) => {
      const yr = i + 1;
      const tv = yearly.find(t => t.year === yr);
      return [
        yr,
        tv?.occupancyPct ?? null,
        tv?.vacancyPct   ?? null,
        tv?.effRent      ?? null,
        tv?.rentGrowthPct ?? null,
        tv?.t01WeeklyTours ?? null,
        tv?.t05ClosingRatio ?? null,
        tv?.t06WeeklyLeases ?? null,
        t07Scalar,   // scalar, repeated per year (trajectory data not available per-year)
      ];
    }),
    [],
    ['— Calibrated Signals —'],
    ['Last Calibrated', f.trafficProjection?.calibrated.lastCalibrated ?? '—'],
    ['Platform Vacancy', f.trafficProjection?.calibrated.vacancyPct ?? null],
    ['Platform Rent Growth', f.trafficProjection?.calibrated.rentGrowthPct ?? null],
    ['Platform Exit Cap', f.trafficProjection?.calibrated.exitCap ?? null],
    [],
    ['— Leasing Velocity —'],
    ['T01 Weekly Tours', f.trafficProjection?.leasingSignals?.t01WeeklyTours ?? null],
    ['T05 Closing Ratio', f.trafficProjection?.leasingSignals?.t05ClosingRatio ?? null],
    ['T06 Weekly Leases', f.trafficProjection?.leasingSignals?.t06WeeklyLeases ?? null],
    ['T07 Lease-Up to 95% (wks)', t07Scalar],
    ['Stabilized Occupancy', f.trafficProjection?.leasingSignals?.stabilizedOccupancyPct ?? null],
    ['Model Confidence', f.trafficProjection?.leasingSignals?.confidence != null
      ? `${f.trafficProjection.leasingSignals.confidence}%` : '—'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 24 },
  ];

  // ── Apply styles to traffic sheet ────────────────────────────────────────
  const numDataCols = 8;
  styleRow(ws, 0, numDataCols, S.title);
  styleRow(ws, 1, numDataCols, S.title);
  styleRow(ws, 3, numDataCols, S.header);

  return ws;
}

function buildAssumptionsSheet(f: DealFinancials): XLSX.WorkSheet {
  const cs  = f.capitalStack;
  const ass = f.assumptions;
  const gpd = ass.gprDecomposition;

  const aoa: (string | number | null)[][] = [
    [`Assumptions  |  ${f.dealName}  |  ${f.totalUnits} Units  |  ${new Date().toLocaleDateString()}`],
    [],
    ['GPR SOURCE DECOMPOSITION'],
    ['Source', 'Annual ($)', 'Per Unit / Mo ($)'],
    ['RESOLVED', gpd?.resolvedAnnual ?? null, gpd?.resolvedPerUnitMo ?? null],
    ['PLATFORM', gpd?.platformAnnual ?? null, gpd?.platformPerUnitMo ?? null],
    ['BROKER',   gpd?.brokerAnnual   ?? null, gpd?.brokerPerUnitMo   ?? null],
    ['T12 ACTUAL',gpd?.t12Annual     ?? null, gpd?.t12PerUnitMo      ?? null],
    ['RENT ROLL', gpd?.rentRollAnnual ?? null, null],
    [],
    ['CAPITAL STACK'],
    ['Purchase Price',    cs.purchasePrice    ?? null],
    ['Loan Amount',       cs.loanAmount       ?? null],
    ['Equity at Close',   cs.equityAtClose    ?? null],
    ['LTC %',             cs.ltcPct           ?? null],
    ['Interest Rate',     cs.interestRate     ?? null],
    ['IO Period (months)',cs.ioPeriodMonths   ?? null],
    ['Amortization (yrs)',cs.amortizationYears ?? null],
    ['DSCR Min',          cs.dscrMin          ?? null],
    ['Origination Fee %', cs.originationFeePct ?? null],
    ['Price Per Unit',    cs.pricePerUnit      ?? null],
    [],
    ['SECTION A — BASE YEAR (Document Sources)'],
    ['Hold Period (yrs)',           ass.holdYears],
    ['Exit Cap Rate',               ass.exitCap         ?? null],
    ['Rent Growth Year 1',          ass.rentGrowthYr1   ?? null],
    ['Rent Growth Stabilized',      ass.rentGrowthStabilized ?? null],
    [],
    ['SECTION B — TRAJECTORY (Y2+ Growth Rates)'],
    ['OpEx Growth % / yr',          ass.opexGrowthPct        ?? null],
    ['Concession Burn-Off % / yr',  ass.concessionBurnOffPct ?? null],
    [],
    ['PER-YEAR ASSUMPTIONS'],
    ['Year', 'Rent Growth %', 'Vacancy %', 'Exit Cap (if last yr)', 'CapEx Draw ($/unit)'],
    ...ass.perYear.map(p => [
      p.year,
      p.rentGrowthPct     ?? null,
      p.vacancyPct        ?? null,
      p.exitCapIfLastYear ?? null,
      p.capexDraw         ?? null,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
  return ws;
}

// ─── Projections sheet (separate tab: Year 1 cross-refs Pro Forma; Y2+ direct) ─

function buildProjectionsSheet(
  f: DealFinancials,
  projs: ProjYearExport[],
  holdYears: number,
): XLSX.WorkSheet {
  const N = holdYears;
  const yearCols = Array.from({ length: N }, (_, i) => i + 1);

  // Mirror the same user-line row logic as Pro Forma so row indices stay in sync
  // for cross-sheet formula references (Task #1172 / #1204 / #1206).
  type UserLine = { label: string; monthly: number; confirmed?: boolean; note?: string; adoption?: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null };
  const rampSuffix = (line: UserLine): string =>
    (line.confirmed === true || /confirmed/i.test(line.note ?? ''))
      ? '— RAMP (Confirmed)'
      : '— RAMP (Projected)';
  const allUserLines: UserLine[] = Array.isArray((f as any).otherIncomeUserLines) ? ((f as any).otherIncomeUserLines as UserLine[]) : [];
  const rampingLines = allUserLines.filter(l => l.adoption != null);
  const rampOffset   = allUserLines.length; // all user lines (flat + ramping) shift rows below OTH

  const totalRows = 55 + rampOffset;
  const aoa: (string | number | null)[][] = Array.from({ length: totalRows }, () => []);

  // Use same row layout as Pro Forma so column letters align for cross-sheet refs.
  // Year 1 key line items (GPR, EGI, NOI, TOPEX, CFBT) use ='Pro Forma'!B{row}
  // cross-sheet references rather than duplicated formulas.
  aoa[R.TITLE]    = [`Projections  |  ${f.dealName}  |  ${f.totalUnits} Units`];
  aoa[R.SUBTITLE] = [`Hold Period: ${holdYears} Years  |  Generated: ${new Date().toLocaleDateString()}`];
  aoa[R.HDRS]     = ['OPERATING STATEMENT', ...yearCols.map(y => `YR ${y}`)];

  const mkRow = (label: string, key: keyof ProjYearExport): (string | number | null)[] =>
    [label, ...projs.map(p => (p[key] as number | null) ?? null)];

  aoa[R.GPR]     = mkRow('Gross Potential Rent', 'gpr');
  aoa[R.VAC]     = mkRow('  (–) Vacancy Loss', 'vacancyLoss');
  aoa[R.LTL]     = mkRow('  (–) Loss to Lease', 'lossToLease');
  aoa[R.CONC]    = mkRow('  (–) Concessions', 'concessions');
  aoa[R.BADDEBT] = mkRow('  (–) Bad Debt', 'badDebt');
  aoa[R.NRU]     = mkRow('  (–) Non-Revenue Units', 'nru');
  aoa[R.NRI]     = mkRow('Net Rental Income', 'nri');
  aoa[R.OTH]     = mkRow('  Other Income', 'otherIncome');

  // Per-line detail rows (Task #1172 / #1204) — mirrors Pro Forma layout exactly
  // Flat lines included alongside ramping lines so row indices stay in sync.
  for (let li = 0; li < allUserLines.length; li++) {
    const line = allUserLines[li];
    const isRamping = line.adoption != null;
    aoa[R.OTH + 1 + li] = [
      isRamping ? `    ${line.label} ${rampSuffix(line)}` : `    ${line.label}`,
      ...projs.map((_, yi) =>
        isRamping
          ? Math.round(computeUserLineAnnual(line, yi))
          : Math.round(line.monthly * 12),
      ),
    ];
  }

  aoa[R.EGI      + rampOffset] = mkRow('EFFECTIVE GROSS INCOME', 'egi');
  aoa[14 + rampOffset]         = ['EXPENSES'];
  aoa[R.PAYROLL  + rampOffset] = mkRow('  Payroll & Benefits', 'payroll');
  aoa[R.REPAIRS  + rampOffset] = mkRow('  R&M / Make-Ready', 'repairs');
  aoa[R.TURNOVER + rampOffset] = mkRow('  Turnover / Make-Ready', 'turnover');
  aoa[R.CONTRACT + rampOffset] = mkRow('  Contract Services', 'contractSvc');
  aoa[R.MKTG     + rampOffset] = mkRow('  Marketing & Leasing', 'marketing');
  aoa[R.UTIL     + rampOffset] = mkRow('  Utilities', 'utilities');
  aoa[R.GANDA    + rampOffset] = mkRow('  G&A / Administrative', 'gAndA');
  aoa[R.MGMT     + rampOffset] = mkRow('  Management Fee', 'mgmtFee');
  aoa[R.INS      + rampOffset] = mkRow('  Insurance', 'insurance');
  aoa[R.RETAX    + rampOffset] = mkRow('  Real Estate Taxes', 'reTaxes');
  aoa[R.RESV     + rampOffset] = mkRow('  Replacement Reserves', 'reserves');
  aoa[R.TOPEX    + rampOffset] = mkRow('TOTAL OPERATING EXPENSES', 'totalOpex');
  aoa[R.NOI      + rampOffset] = mkRow('NET OPERATING INCOME', 'noi');
  aoa[R.INTEREST + rampOffset] = mkRow('  Interest', 'interest');
  aoa[R.PRINC    + rampOffset] = mkRow('  Principal Paydown', 'principal');
  aoa[R.TOTALDS  + rampOffset] = mkRow('TOTAL DEBT SERVICE', 'annualDS');
  aoa[R.CAPEX    + rampOffset] = mkRow('  (–) CapEx Draw', 'capexDraw');
  aoa[R.CFBT     + rampOffset] = mkRow('CASH FLOW BEFORE TAX', 'cfbt');
  aoa[R.NETCF    + rampOffset] = mkRow('  Net Cash Flow', 'netCF');

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Year 1 cross-sheet references for the 5 key line items ───────────────
  // 'Pro Forma' column B (col index 1) = Year 1. Row index +1 = Excel row number.
  // Rows after OTH use rampOffset-adjusted indices to match Pro Forma sheet.
  const Y1_COL = 'B';
  const crossRefRows: Array<[number, keyof ProjYearExport]> = [
    [R.GPR,                'gpr'],
    [R.EGI    + rampOffset, 'egi'],
    [R.NOI    + rampOffset, 'noi'],
    [R.TOPEX  + rampOffset, 'totalOpex'],
    [R.CFBT   + rampOffset, 'cfbt'],
  ];
  for (const [rowIdx, projKey] of crossRefRows) {
    ws[addr(rowIdx, 1)] = {
      t: 'n',
      f: `='Pro Forma'!${Y1_COL}${rowIdx + 1}`,
      v: (projs[0]?.[projKey] as number) ?? 0,
    };
  }

  // ── Y2-YN formula cells (same pattern as Pro Forma sheet, with rampOffset) ──
  for (let y = 1; y < N; y++) {    // y=0 is Year 1, already handled above
    const col = y + 1;
    const C   = colLetter(col);
    ws[addr(R.NRI,              col)] = { t: 'n', f: `=${C}${R.GPR+1}-${C}${R.VAC+1}-${C}${R.LTL+1}-${C}${R.CONC+1}-${C}${R.BADDEBT+1}-${C}${R.NRU+1}`, v: projs[y].nri };
    ws[addr(R.EGI + rampOffset, col)] = { t: 'n', f: `=${C}${R.NRI+1}+${C}${R.OTH+1}`, v: projs[y].egi };
    ws[addr(R.TOPEX+rampOffset, col)] = { t: 'n', f: `=SUM(${C}${R.PAYROLL+rampOffset+1}:${C}${R.RESV+rampOffset+1})`, v: projs[y].totalOpex };
    ws[addr(R.NOI + rampOffset, col)] = { t: 'n', f: `=${C}${R.EGI+rampOffset+1}-${C}${R.TOPEX+rampOffset+1}`, v: projs[y].noi };
    ws[addr(R.TOTALDS+rampOffset,col)]= { t: 'n', f: `=${C}${R.INTEREST+rampOffset+1}+${C}${R.PRINC+rampOffset+1}`, v: projs[y].annualDS };
    ws[addr(R.CFBT+rampOffset,  col)] = { t: 'n', f: `=${C}${R.NOI+rampOffset+1}-${C}${R.TOTALDS+rampOffset+1}-${C}${R.CAPEX+rampOffset+1}`, v: projs[y].cfbt };
  }

  ws['!cols'] = [{ wch: 36 }, ...Array.from({ length: N }, () => ({ wch: 14 }))];
  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: N } });
  return ws;
}

// ─── Main workbook builder ────────────────────────────────────────────────────

export function buildF9Workbook(f: DealFinancials, holdYears: number): XLSX.WorkBook {
  const projs = buildProjectionsForExport(f, holdYears);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildProFormaSheet(f, projs, holdYears), 'Pro Forma');
  XLSX.utils.book_append_sheet(wb, buildProjectionsSheet(f, projs, holdYears), 'Projections');
  XLSX.utils.book_append_sheet(wb, buildTrafficSheet(f, holdYears), 'Traffic Projection');
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(f), 'Assumptions');

  return wb;
}
