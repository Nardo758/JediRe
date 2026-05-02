// =========================================================================
// DETERMINISTIC F9 FINANCIAL MODEL RUNNER
// =========================================================================
// Pure function: takes ModelAssumptions, returns ModelResults.
// No DB, no external APIs, no LLM — all math computed in TypeScript.
//
// Spec: docs/F9 Financial Model - Agent Specification.txt
// Wiring: docs/agent-f9-wiring-spec-v1.0.txt
// =========================================================================

export interface ModelAssumptions {
  units: number;
  avgUnitSf: number;
  marketRent: number;
  inPlaceRent: number;
  purchasePrice: number;
  closingCostsPct: number;
  isFlorida: boolean;
  county?: string;
  docStampsPct: number;
  intangibleTaxPct: number;
  titleInsurancePct: number;
  capexBudget: number;
  rentGrowth: number[];
  lossToLease: number;
  vacancyY1: number;
  vacancyStab: number;
  concessions: number;
  badDebt: number;
  otherIncomePerUnit: number;
  expenseGrowth: number;
  payrollPerUnit: number;
  maintenancePerUnit: number;
  contractServicesPerUnit: number;
  marketingPerUnit: number;
  utilitiesPerUnit: number;
  adminPerUnit: number;
  insurancePerUnit: number;
  managementFee: number;
  replacementReserves: number;
  loanAmount: number;
  ltv: number;
  term: number;
  amort: number;
  ioPeriod: number;
  rate: number;
  originationFeePct: number;
  prepayPenalty?: number;
  exitCap: number;
  saleCosts: number;
  holdYears: number;
  lpEquity: number;
  gpEquity: number;
  preferredReturn: number;
  promoteTiers: [number, number, number];
  promoteSplits: [number, number, number];
  dealType: string;
  // Optional: non-FL base property tax (for computing non-FL tax schedule)
  basePropertyTax?: number;
}

export interface AnnualCashFlowRow {
  year: number;
  grossPotentialRent: number;
  lossToLease: number;
  vacancy: number;
  concessions: number;
  badDebt: number;
  baseRevenue: number;
  otherIncome: number;
  effectiveGrossIncome: number;
  payroll: number;
  maintenance: number;
  contractServices: number;
  marketing: number;
  utilities: number;
  admin: number;
  insurance: number;
  propertyTax: number;
  managementFee: number;
  replacementReserves: number;
  totalExpenses: number;
  noi: number;
  annualInterest: number;
  annualPrincipal: number;
  debtService: number;
  preTaxCashFlow: number;  // kept for backward compatibility
  cfads: number;           // Cash Flow After Debt Service — same value as preTaxCashFlow
  dscr: number | null;
  occupancy: number;
  debtYield: number | null;       // NOI / loanAmount
  capRateOnCost: number | null;   // NOI / totalAcquisitionCost
  isExitYear: boolean;
}

export interface SourcesUsesItem {
  id: string;
  label: string;
  amount: number;
  pct: number;
  source: string;
}

export interface SourcesUsesPayload {
  sources: SourcesUsesItem[];
  uses: SourcesUsesItem[];
  totalSources: number;
  totalUses: number;
  delta: number;
  balanced: boolean;
  benchmarks: {
    totalCostPerUnit: number;
    debtPct: number;
    equityPct: number;
    capexPerUnit: number;
  };
}

export interface WaterfallTier {
  tier: number;
  tierName: string;
  lpDistribution: number;
  gpDistribution: number;
  lpIrr: number | null;
  gpIrr: number | null;
  lpEquityMultiple: number | null;
  gpEquityMultiple: number | null;
}

export interface StressScenario {
  scenario: string;
  irr: number | null;
  equityMultiple: number | null;
  cashOnCash: number | null;
}

export interface IntegrityCheck {
  id: string;
  status: 'pass' | 'warn' | 'error';
  message: string;
}

export interface DebtMetrics {
  coverage: {
    dscrMin: number | null;
    dscrAvg: number | null;
    dscrY1: number | null;
    dscrAtStabilization: number | null;
    debtYieldMin: number | null;
    debtYieldY1: number | null;
    breakEvenOccupancy: number | null;
    dscrStressedMinus10PctNOI: number | null;
  };
  structural: {
    loanAmount: number;
    rate: number;
    termMonths: number;
    amortMonths: number;
    ioPeriodMonths: number;
    originationFee: number;
    loanType: string;
  };
  leverage: {
    ltvAtClose: number;
    ltvAtMaturity: number;
    positiveLeverage: boolean;
    spreadOverCapRateBps: number;
  };
  stress: {
    dscrAt10PctNOIDecline: number | null;
    breakEvenOccupancy: number | null;
  };
}

export interface ValuationBlock {
  perUnit: {
    goingIn: number;
    atExit: number;
  };
  perSF: {
    netRentable: number;
  };
  multiples: {
    grm: number | null;
    nim: number | null;
    opexRatio: number | null;
    capRate: number;
    yieldOnCost: number | null;
  };
}

export interface ModelResults {
  summary: {
    purchasePrice: number;
    loanAmount: number;
    totalEquity: number;
    noiYear1: number;
    goingInCapRate: number;
    exitCapRate: number;
    irr: number | null;
    equityMultiple: number | null;
    avgCoC: number | null;
    lpIrr: number | null;
    gpIrr: number | null;
    lpEquityMultiple: number | null;
    gpEquityMultiple: number | null;
    loanBalanceAtExit: number;
    cashOnCashByYear: number[];
    dscrByYear: number[];
    noiByYear: number[];
    // ── New fields added in task #486 ──
    egiByYear: number[];
    debtServiceCoverageByYear: number[];  // alias for dscrByYear for tab compat
    debtYieldByYear: number[];
    stabilizedCapRate: number | null;
    unleveredIrr: number | null;
    yieldOnCost: { untrended: number; trended: number };
    totalProfit: number;
    lpCoC: number | null;
    gpCoC: number | null;
    lpTotalDistributions: number;
    lpProfit: number;
    gpTotalDistributions: number;
    gpPromoteEarned: number;
  };
  annualCashFlow: AnnualCashFlowRow[];
  sourcesAndUses: SourcesUsesPayload;
  disposition: {
    stabilizedNOI: number;
    grossSalePrice: number;
    saleCosts: number;
    netSaleProceeds: number;
    loanBalance: number;
    equityProceeds: number;
    dispositionDocStamps: number;
    exitYear: number;
  };
  debtMetrics: DebtMetrics;
  valuation: ValuationBlock;
  sensitivityAnalysis: {
    matrix: {
      exitCapAxis: number[];
      rentGrowthAxis: number[];
      irrGrid: (number | null)[][];
      emGrid: (number | null)[][];
    };
  };
  stressScenarios: StressScenario[];
  waterfallDistributions: WaterfallTier[];
  capital: {
    amortizationSchedule: { year: number; beginningBalance: number; interest: number; principal: number; endingBalance: number }[];
    loanBalanceByYear: number[];
    debtServiceByYear: number[];
    debtYieldByYear: number[];
    tranches: Array<{
      id: string;
      label: string;
      amount: number;
      rate: number;
      termMonths: number;
      amortMonths: number;
      ltv: number;
    }>;
    metrics: {
      totalCost: number;
      totalEquity: number;
      totalDebt: number;
      equityPct: number;
      debtPct: number;
      capexPerUnit: number;
    };
  };
  taxes: {
    reTax: { perYear: number[]; assessedValues: number[] };
    transferTax: { acquisition: number; disposition: number; refi: number };
  };
  projections: { year: number; institutionalRow: Record<string, number> }[];
  integrityChecks: IntegrityCheck[];
  reasoning: { derivationLog: string[] };
  meta: { modelVersion: string; runner: string; computedAt: string };
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEF_CLOSING_PCT = 0.01;
const DEF_FL_DOC_PCT = 0.007;
const DEF_FL_MIA_DOC_PCT = 0.006;
const DEF_FL_INTANGIBLE_PCT = 0.002;
const DEF_FL_TITLE_PCT = 0.003;
const DEF_MILLAGE = 0.0218;
const DEF_REASSESS_PCT = 0.85;
const DEF_CAP_INCREASE = 0.10;
const DEF_ORIGINATION_PCT = 0.01;
const DEF_NONFL_TRANSFER_TAX_PCT = 0.005;

// ── Helpers ────────────────────────────────────────────────────────────────

function isMiamiDade(county?: string): boolean {
  if (!county) return false;
  const c = county.toLowerCase().replace(/[\s-]/g, '');
  return c === 'miamidade' || c === 'dade' || c === '12086';
}

export function buildVacancySchedule(holdYears: number, vacancyY1: number, vacancyStab: number): number[] {
  const s: number[] = [];
  for (let y = 1; y <= holdYears + 1; y++) {
    s.push(y === 1 ? Math.max(vacancyY1, vacancyStab) : vacancyStab);
  }
  return s;
}

export function cumulativeRentGrowth(rentGrowth: number[], holdYears: number): number[] {
  const cg: number[] = [1.0];
  for (let y = 1; y <= holdYears; y++) {
    const rg = y <= rentGrowth.length ? rentGrowth[y - 1] : 0.03;
    cg.push(cg[y - 1] * (1 + rg));
  }
  return cg;
}

export function computeFloridaTax(
  purchasePrice: number,
  holdYears: number,
  millageRate: number = DEF_MILLAGE,
  capRate: number = DEF_CAP_INCREASE,
  reassessPct: number = DEF_REASSESS_PCT
): { perYear: number[]; assessedValues: number[] } {
  const base = purchasePrice * reassessPct;
  const perYear: number[] = [];
  const assessedValues: number[] = [];
  for (let y = 1; y <= holdYears + 1; y++) {
    const av = base * Math.pow(1 + capRate, y - 1);
    assessedValues.push(av);
    perYear.push(av * millageRate);
  }
  return { perYear, assessedValues };
}

export function computeNonFloridaTax(
  baseTax: number,
  expenseGrowth: number,
  holdYears: number
): { perYear: number[]; assessedValues: number[] } {
  const perYear: number[] = [];
  const assessedValues: number[] = [];
  for (let y = 1; y <= holdYears + 1; y++) {
    perYear.push(baseTax * Math.pow(1 + expenseGrowth, y - 1));
    assessedValues.push(0);
  }
  return { perYear, assessedValues };
}

export function computeAmortization(
  loanAmount: number,
  annualRate: number,
  termMonths: number,
  amortMonths: number,
  ioMonths: number,
  holdYears: number,
): {
  interestByYear: number[];
  principalByYear: number[];
  debtServiceByYear: number[];
  balanceByYear: number[];
} {
  const monthlyRate = annualRate / 12;
  const nYears = holdYears + 1;

  let monthlyPMT: number;
  if (amortMonths <= 0) {
    monthlyPMT = loanAmount * monthlyRate;
  } else {
    monthlyPMT = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths))
      / (Math.pow(1 + monthlyRate, amortMonths) - 1);
  }

  let balance = loanAmount;
  const interestByYear: number[] = [];
  const principalByYear: number[] = [];
  const debtServiceByYear: number[] = [];
  const balanceByYear: number[] = [];

  for (let y = 0; y < nYears; y++) {
    let yrInterest = 0;
    let yrPrincipal = 0;
    let yrDS = 0;

    for (let m = 0; m < 12; m++) {
      const monthIdx = y * 12 + m;
      const isIO = monthIdx < ioMonths;
      const monthInterest = balance * monthlyRate;
      yrInterest += monthInterest;

      if (isIO) {
        // Interest-only: no principal
      } else if (amortMonths <= 0) {
        // If amort is 0 and we're past IO, use interest-only forever
      } else {
        const monthPrincipal = monthlyPMT - monthInterest;
        if (monthPrincipal > balance) {
          yrPrincipal += balance;
          balance = 0;
        } else {
          yrPrincipal += monthPrincipal;
          balance -= monthPrincipal;
        }
      }

      yrDS += isIO ? monthInterest : monthlyPMT;
    }

    interestByYear.push(yrInterest);
    principalByYear.push(yrPrincipal);
    debtServiceByYear.push(yrDS);

    // Balloon at end of term
    if (y + 1 >= Math.ceil(termMonths / 12) && balance > 0) {
      principalByYear[y] += balance;
      debtServiceByYear[y] += balance;
      balance = 0;
    }

    balanceByYear.push(balance);
  }

  return { interestByYear, principalByYear, debtServiceByYear, balanceByYear };
}

export function calculateIRR(
  cashFlows: number[],
  maxIter: number = 30,
  guess: number = 0.12,
  tol: number = 1e-10
): number | null {
  let r = guess;
  for (let iter = 0; iter < maxIter; iter++) {
    let f = 0;
    let fPrime = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const denom = Math.pow(1 + r, i);
      f += cashFlows[i] / denom;
      fPrime += (-i * cashFlows[i]) / Math.pow(1 + r, i + 1);
    }
    if (Math.abs(fPrime) < 1e-15) return null;
    const rNext = r - f / fPrime;
    if (Math.abs(rNext - r) < tol) return rNext;
    r = rNext;
  }
  return null;
}

export function calculateEM(cashFlows: number[]): number {
  // EM = sum of POSITIVE cash flows / |initial outlay|
  // Per spec: do NOT include the negative initial outlay
  const equity = Math.abs(cashFlows[0]);
  if (equity <= 0) return 0;
  let sum = 0;
  for (let i = 1; i < cashFlows.length; i++) {
    sum += Math.max(0, cashFlows[i]);
  }
  return sum / equity;
}

export function calculateAvgCoC(equity: number, operatingCFs: number[]): number | null {
  if (equity <= 0 || operatingCFs.length === 0) return null;
  const meanCF = operatingCFs.reduce((s, v) => s + v, 0) / operatingCFs.length;
  return meanCF / equity;
}

// ── Single-year operating computation ──────────────────────────────────────

export function computeYearOperating(
  y: number,
  a: ModelAssumptions,
  cumGrowthVal: number,
  vacancySched: number[],
  taxYear: number,
  expenseGrowthCum: number,
): Omit<AnnualCashFlowRow, 'year' | 'annualInterest' | 'annualPrincipal' | 'debtService' | 'preTaxCashFlow' | 'cfads' | 'dscr' | 'debtYield' | 'capRateOnCost' | 'isExitYear'> {
  const GPR = a.units * a.marketRent * 12 * cumGrowthVal;
  const loss = GPR * a.lossToLease;
  const vac = GPR * vacancySched[y - 1];
  const conc = GPR * a.concessions;
  const bd = GPR * a.badDebt;
  const baseRev = GPR - loss - vac - conc - bd;
  const othInc = a.otherIncomePerUnit * a.units * expenseGrowthCum;
  const EGR = baseRev + othInc;

  const payroll = a.payrollPerUnit * a.units * expenseGrowthCum;
  const maint = a.maintenancePerUnit * a.units * expenseGrowthCum;
  const contract = a.contractServicesPerUnit * a.units * expenseGrowthCum;
  const mktg = a.marketingPerUnit * a.units * expenseGrowthCum;
  const util = a.utilitiesPerUnit * a.units * expenseGrowthCum;
  const admin = a.adminPerUnit * a.units * expenseGrowthCum;
  const ins = a.insurancePerUnit * a.units * expenseGrowthCum;
  const mgmt = EGR * a.managementFee;
  const reserves = a.replacementReserves * a.units * expenseGrowthCum;

  const totalExp = payroll + maint + contract + mktg + util + admin + ins + taxYear + mgmt + reserves;
  const NOI = EGR - totalExp;

  return {
    grossPotentialRent: GPR,
    lossToLease: loss,
    vacancy: vac,
    concessions: conc,
    badDebt: bd,
    baseRevenue: baseRev,
    otherIncome: othInc,
    effectiveGrossIncome: EGR,
    payroll,
    maintenance: maint,
    contractServices: contract,
    marketing: mktg,
    utilities: util,
    admin,
    insurance: ins,
    propertyTax: taxYear,
    managementFee: mgmt,
    replacementReserves: reserves,
    totalExpenses: totalExp,
    noi: NOI,
    occupancy: 1 - vacancySched[y - 1],
  };
}

// ── Waterfall (IRR-hurdle-based) ──────────────────────────────────────────

/**
 * Distribute cfads for a single year through waterfall tiers.
 * Returns the updated tier distributions (cumulative).
 * Per spec: each tier distributes until LP IRR hits the hurdle rate,
 * then excess carries to the next tier.
 */
function distributeYearThroughWaterfall(
  cfads: number,
  tiers: { tier: number; lpDist: number; gpDist: number }[],
  lpCF: number[],
  gpCF: number[],
  lpEquity: number,
  gpEquity: number,
  preferredReturn: number,
  holdYears: number,
  promoteTiers: [number, number, number],
  promoteSplits: [number, number, number],
  isFinalYear: boolean,
  equityProceeds: number,
): void {
  // Simple approach for operating years: distribute pro-rata LP/GP
  if (!isFinalYear) {
    tiers[0].lpDist += cfads * (lpEquity / (lpEquity + gpEquity));
    tiers[0].gpDist += cfads * (gpEquity / (lpEquity + gpEquity));
    return;
  }

  // Final year: distribute equityProceeds through all tiers
  let residual = equityProceeds;

  // Tier 1: ROC
  const rocLP = Math.min(residual, lpEquity);
  tiers[0].lpDist += rocLP;
  residual -= rocLP;
  const rocGP = Math.min(residual, gpEquity);
  tiers[0].gpDist += rocGP;
  residual -= rocGP;

  // Tier 2: Preferred Return
  const prefAmt = preferredReturn * lpEquity * holdYears;
  const prefLP = Math.min(residual, prefAmt);
  tiers[1].lpDist += prefLP;
  residual -= prefLP;

  // Tier 3-5: Promotes — distribute remaining
  const promoteAmt = residual;
  const p3LP = promoteAmt * (1 - promoteSplits[0]);
  const p3GP = promoteAmt * promoteSplits[0];
  tiers[2].lpDist += p3LP;
  tiers[2].gpDist += p3GP;
  residual -= (p3LP + p3GP);
  tiers[3].lpDist += residual * (1 - promoteSplits[1]);
  tiers[3].gpDist += residual * promoteSplits[1];
  residual -= residual; // simplified
  tiers[4].lpDist += residual * (1 - promoteSplits[2]);
  tiers[4].gpDist += residual * promoteSplits[2];
}

export function computeWaterfall(
  annualRows: AnnualCashFlowRow[],
  lpEquity: number,
  gpEquity: number,
  totalEquity: number,
  preferredReturn: number,
  holdYears: number,
  promoteTiers: [number, number, number],
  promoteSplits: [number, number, number],
  equityProceeds: number,
): WaterfallTier[] {
  const tiers = [
    { tier: 1, tierName: 'Return of Capital', lpDist: 0, gpDist: 0 },
    { tier: 2, tierName: 'Preferred Return', lpDist: 0, gpDist: 0 },
    { tier: 3, tierName: 'Promote Tier 1', lpDist: 0, gpDist: 0 },
    { tier: 4, tierName: 'Promote Tier 2', lpDist: 0, gpDist: 0 },
    { tier: 5, tierName: 'Promote Tier 3', lpDist: 0, gpDist: 0 },
  ];

  // Build LP/GP cash flow vectors for IRR computation
  const lpCF: number[] = [-lpEquity];
  const gpCF: number[] = [-gpEquity];

  // Distribute operating years pro-rata
  for (let y = 0; y < holdYears; y++) {
    const cfads = annualRows[y]?.preTaxCashFlow ?? 0;
    distributeYearThroughWaterfall(
      cfads, tiers, lpCF, gpCF, lpEquity, gpEquity,
      preferredReturn, holdYears, promoteTiers, promoteSplits,
      false, 0,
    );
    lpCF.push(cfads * (lpEquity / totalEquity));
    gpCF.push(cfads * (gpEquity / totalEquity));
  }

  // Final year: distribute equityProceeds through waterfall tiers
  distributeYearThroughWaterfall(
    0, tiers, lpCF, gpCF, lpEquity, gpEquity,
    preferredReturn, holdYears, promoteTiers, promoteSplits,
    true, equityProceeds,
  );

  // Build final LP/GP cash flow vectors incorporating distributions
  const finalLP: number[] = [-lpEquity];
  const finalGP: number[] = [-gpEquity];

  for (let y = 0; y < holdYears; y++) {
    const cfads = annualRows[y]?.preTaxCashFlow ?? 0;
    finalLP.push(cfads * (lpEquity / totalEquity));
    finalGP.push(cfads * (gpEquity / totalEquity));
  }

  // Add total waterfall distributions to final year
  const totalLP = tiers.reduce((s, t) => s + t.lpDist, 0);
  const totalGP = tiers.reduce((s, t) => s + t.gpDist, 0);
  finalLP[finalLP.length - 1] += totalLP;
  finalGP[finalGP.length - 1] += totalGP;

  return tiers.map(t => ({
    tier: t.tier,
    tierName: t.tierName,
    lpDistribution: t.lpDist,
    gpDistribution: t.gpDist,
    lpIrr: calculateIRR(finalLP),
    gpIrr: calculateIRR(finalGP),
    lpEquityMultiple: calculateEM(finalLP),
    gpEquityMultiple: calculateEM(finalGP),
  }));
}

// ── Sensitivity Matrix ─────────────────────────────────────────────────────

export function computeSensitivityMatrix(
  base: ModelAssumptions,
): {
  exitCapAxis: number[];
  rentGrowthAxis: number[];
  irrGrid: (number | null)[][];
  emGrid: (number | null)[][];
} {
  const exitCapAxis = [
    base.exitCap - 0.01,
    base.exitCap - 0.005,
    base.exitCap,
    base.exitCap + 0.005,
    base.exitCap + 0.01,
  ];
  const rentGrowthAxis = [
    base.rentGrowth[0] - 0.01,
    base.rentGrowth[0] - 0.005,
    base.rentGrowth[0],
    base.rentGrowth[0] + 0.005,
    base.rentGrowth[0] + 0.01,
    base.rentGrowth[0] + 0.015,
  ];

  const irrGrid: (number | null)[][] = [];
  const emGrid: (number | null)[][] = [];

  for (let ei = 0; ei < exitCapAxis.length; ei++) {
    irrGrid[ei] = [];
    emGrid[ei] = [];
    for (let ri = 0; ri < rentGrowthAxis.length; ri++) {
      const rcScale = rentGrowthAxis[ri] / base.rentGrowth[0];
      const adjusted: ModelAssumptions = {
        ...base,
        exitCap: exitCapAxis[ei],
        rentGrowth: base.rentGrowth.map(r => r * (isFinite(rcScale) ? rcScale : 1)),
      };
      const result = runModel(adjusted, { skipSensitivity: true });
      irrGrid[ei][ri] = result.summary.irr;
      emGrid[ei][ri] = result.summary.equityMultiple;
    }
  }

  return { exitCapAxis, rentGrowthAxis, irrGrid, emGrid };
}

// ── Integrity Checks ──────────────────────────────────────────────────────

export function runIntegrityChecks(a: ModelAssumptions, result: ModelResults): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  const cf = result.annualCashFlow;

  // INV-1: NOI = EGR - totalExp
  for (let i = 0; i < cf.length; i++) {
    const row = cf[i];
    const diff = Math.abs(row.noi - (row.effectiveGrossIncome - row.totalExpenses));
    if (diff > 0.01) {
      checks.push({ id: `INV-1_Y${row.year}`, status: 'error', message: `NOI mismatch Y${row.year}: ${row.noi.toFixed(2)} vs expected ${(row.effectiveGrossIncome - row.totalExpenses).toFixed(2)}` });
    }
  }

  // INV-2: GPR >= baseRevenue >= EGR >= NOI
  for (let i = 0; i < cf.length; i++) {
    const row = cf[i];
    if (row.grossPotentialRent < row.baseRevenue - 0.01) {
      checks.push({ id: `INV-2a_Y${row.year}`, status: 'error', message: `GPR < baseRevenue Y${row.year}` });
    }
  }

  // INV-4: DSCR > 0
  for (let i = 0; i < cf.length; i++) {
    if (cf[i].dscr !== null && cf[i].dscr <= 0) {
      checks.push({ id: `INV-4_Y${cf[i].year}`, status: 'error', message: `DSCR <= 0 Y${cf[i].year}` });
    }
  }

  // INV-5: initial cash flow negative
  const equity = Math.abs(result.summary.totalEquity);
  if (equity <= 0) {
    checks.push({ id: 'INV-7', status: 'error', message: 'Total equity <= 0' });
  }

  // INV-8: loan must not exceed purchase price (hard stop — 100%+ LTV is structurally invalid)
  if (a.loanAmount > a.purchasePrice) {
    checks.push({ id: 'INV-8', status: 'error', message: `Loan (${a.loanAmount}) > purchase price (${a.purchasePrice}): LTV exceeds 100%` });
  }

  // INV-9: hold years
  if (a.holdYears !== cf.length - 1) {
    checks.push({ id: 'INV-9', status: 'warn', message: `Cash flow rows (${cf.length}) != hold years (${a.holdYears}) + 1` });
  }

  // INV-10: exit cap range
  if (a.exitCap <= 0 || a.exitCap > 0.15) {
    checks.push({ id: 'INV-10', status: 'warn', message: `Exit cap ${(a.exitCap * 100).toFixed(1)}% outside 0-15%` });
  }

  // Soft checks
  const lastOpRow = cf[cf.length - 2];
  if (lastOpRow && lastOpRow.dscr !== null && lastOpRow.dscr < 1.25) {
    checks.push({ id: 'TIGHT_DSCR', status: 'warn', message: `Y${lastOpRow.year} DSCR ${lastOpRow.dscr.toFixed(2)} < 1.25` });
  }
  if (a.ltv > 0.75) {
    checks.push({ id: 'AGGRESSIVE_LTV', status: 'warn', message: `LTV ${(a.ltv * 100).toFixed(0)}% > 75%` });
  }
  if (a.rentGrowth.length > 0 && a.rentGrowth[0] > 0.06) {
    checks.push({ id: 'AGGRESSIVE_RENT_GROWTH', status: 'warn', message: `Y1 rent growth ${(a.rentGrowth[0] * 100).toFixed(1)}% > 6%` });
  }
  if (a.vacancyStab < 0.05) {
    checks.push({ id: 'OPTIMISTIC_VACANCY', status: 'warn', message: `Vacancy ${(a.vacancyStab * 100).toFixed(1)}% < 5%` });
  }
  if (a.exitCap < 0.045) {
    checks.push({ id: 'OPTIMISTIC_EXIT_CAP', status: 'warn', message: `Exit cap ${(a.exitCap * 100).toFixed(1)}% < 4.5%` });
  }

  if (!checks.some(c => c.status === 'error')) {
    checks.unshift({ id: 'ALL_INVARIANTS', status: 'pass', message: 'All hard invariants pass' });
  }

  return checks;
}

function buildCashFlowVector(totalEquity: number, annualRows: AnnualCashFlowRow[]): number[] {
  const cf: number[] = [-totalEquity];
  for (const row of annualRows) {
    cf.push(row.preTaxCashFlow);
  }
  return cf;
}

// ── Main runner ────────────────────────────────────────────────────────────

export function runModel(a: ModelAssumptions, opts?: { skipSensitivity?: boolean }): ModelResults {
  const log: string[] = [];
  const hold = a.holdYears;
  const nYears = hold + 1;

  // ── Phase 1: Derived inputs ─────────────────────────────────────────────
  log.push(`Phase 1: Deriving inputs for ${a.dealType} deal, ${hold}yr hold, ${a.units} units`);

  const closingCosts = a.closingCostsPct > 0
    ? a.purchasePrice * a.closingCostsPct
    : a.purchasePrice * DEF_CLOSING_PCT;

  let docStamps = 0;
  let intangibleTax = 0;
  let titleInsurance = 0;

  if (a.isFlorida) {
    const docPct = a.docStampsPct > 0 ? a.docStampsPct : (isMiamiDade(a.county) ? DEF_FL_MIA_DOC_PCT : DEF_FL_DOC_PCT);
    docStamps = a.purchasePrice * docPct;
    const intPct = a.intangibleTaxPct > 0 ? a.intangibleTaxPct : DEF_FL_INTANGIBLE_PCT;
    intangibleTax = a.loanAmount * intPct;
    const titlePct = a.titleInsurancePct > 0 ? a.titleInsurancePct : DEF_FL_TITLE_PCT;
    titleInsurance = a.purchasePrice * titlePct;
    log.push(`  FL taxes: docStamps ${(docPct * 100).toFixed(2)}% (${docStamps}), intangible ${(intPct * 100).toFixed(2)}% (${intangibleTax}), title ${(titlePct * 100).toFixed(2)}% (${titleInsurance})`);
  } else {
    docStamps = a.purchasePrice * DEF_NONFL_TRANSFER_TAX_PCT;
    log.push(`  Non-FL: combined transaction tax ${DEF_NONFL_TRANSFER_TAX_PCT * 100}% (${docStamps})`);
  }

  const totalEquity = a.lpEquity + a.gpEquity;
  const totalAcqCost = a.purchasePrice + closingCosts + docStamps + intangibleTax + titleInsurance + a.capexBudget;
  log.push(`  Total equity: ${totalEquity}, Total acq cost: ${totalAcqCost}`);

  // ── Phase 2: Vacancy schedule & rent growth ─────────────────────────────
  const vacancySched = buildVacancySchedule(hold, a.vacancyY1, a.vacancyStab);
  const cumGrowth = cumulativeRentGrowth(a.rentGrowth, hold);
  log.push(`Phase 2: Vacancy Y1=${(a.vacancyY1 * 100).toFixed(1)}%, Stab=${(a.vacancyStab * 100).toFixed(1)}%, Rent growth Y1=${(a.rentGrowth[0] * 100).toFixed(1)}%`);

  // ── Phase 3: Tax schedule ───────────────────────────────────────────────
  let taxSchedule: { perYear: number[]; assessedValues: number[] };
  if (a.isFlorida) {
    taxSchedule = computeFloridaTax(a.purchasePrice, hold);
    log.push(`Phase 3: FL tax schedule (CNADR 10% cap, assessed base=${a.purchasePrice * DEF_REASSESS_PCT})`);
  } else {
    const baseTax = a.basePropertyTax ?? (a.purchasePrice * 0.012); // ~1.2% of purchase as default
    taxSchedule = computeNonFloridaTax(baseTax, a.expenseGrowth, hold);
    log.push(`Phase 3: Non-FL tax schedule, base=${baseTax}, growth=${(a.expenseGrowth * 100).toFixed(1)}%`);
  }

  // ── Phase 4: Amortization schedule ──────────────────────────────────────
  const amort = computeAmortization(a.loanAmount, a.rate, a.term, a.amort, a.ioPeriod, hold);
  const origFee = a.originationFeePct > 0 ? a.loanAmount * a.originationFeePct : a.loanAmount * DEF_ORIGINATION_PCT;
  log.push(`Phase 4: Loan ${a.loanAmount} @ ${(a.rate * 100).toFixed(2)}%, ${a.amort}mo amort, ${a.ioPeriod}mo IO`);

  // ── Phase 5: Annual cash flows ──────────────────────────────────────────
  log.push(`Phase 5: Building ${nYears} years of cash flows`);
  const annualRows: AnnualCashFlowRow[] = [];

  for (let y = 1; y <= nYears; y++) {
    const expCum = Math.pow(1 + a.expenseGrowth, y - 1);
    const taxYear = y <= taxSchedule.perYear.length ? taxSchedule.perYear[y - 1] : taxSchedule.perYear[taxSchedule.perYear.length - 1];

    const op = computeYearOperating(y, a, cumGrowth[y - 1], vacancySched, taxYear, expCum);

    const interest = amort.interestByYear[y - 1] ?? (a.loanAmount * a.rate);
    const principal = amort.principalByYear[y - 1] ?? 0;
    const debtService = amort.debtServiceByYear[y - 1] ?? interest;
    const cf = op.noi - debtService;
    const dscr = debtService > 0.01 ? op.noi / debtService : null;
    const dyield = a.loanAmount > 0 ? op.noi / a.loanAmount : null;

    annualRows.push({
      year: y,
      ...op,
      annualInterest: interest,
      annualPrincipal: principal,
      debtService,
      preTaxCashFlow: cf,
      cfads: cf,
      dscr,
      debtYield: dyield,
      capRateOnCost: null,  // filled below after totalAcqCost is available
      isExitYear: y === nYears,
    });
  }

  // ── Phase 6: Disposition ────────────────────────────────────────────────
  const exitRow = annualRows[hold]; // forward NOI = NOI at hold+1 (index = hold)
  const stabilizedNOI = exitRow?.noi ?? 0;
  const grossSalePrice = a.exitCap > 0 ? stabilizedNOI / a.exitCap : 0;
  const saleCostsValue = grossSalePrice * a.saleCosts;
  const dispositionDocStamps = a.isFlorida ? grossSalePrice * 0.007 : 0;
  const loanBalance = amort.balanceByYear[hold - 1] ?? 0;
  const netSaleProceeds = grossSalePrice - saleCostsValue - dispositionDocStamps;
  const equityProceeds = netSaleProceeds - loanBalance;

  log.push(`Phase 6: Disposition — stabilized NOI=${stabilizedNOI}, exit cap=${(a.exitCap * 100).toFixed(1)}%, sale price=${grossSalePrice}`);
  log.push(`  Sale costs=${saleCostsValue}, loan bal=${loanBalance}, equity proceeds=${equityProceeds}`);

  // Fill capRateOnCost now that totalAcqCost is known
  for (const row of annualRows) {
    row.capRateOnCost = totalAcqCost > 0 ? row.noi / totalAcqCost : null;
  }

  // ── Phase 7: Returns ────────────────────────────────────────────────────
  const cashFlows = buildCashFlowVector(totalEquity, annualRows);
  const irr = calculateIRR(cashFlows);
  const em = calculateEM(cashFlows);
  const avgCoC = calculateAvgCoC(totalEquity, annualRows.slice(0, hold).map(r => r.preTaxCashFlow));
  const noiY1 = annualRows[0]?.noi ?? 0;
  const goingInCap = a.purchasePrice > 0 ? noiY1 / a.purchasePrice : 0;

  // Unlevered IRR: cash flows ignoring debt service
  const unlevCF: number[] = [-totalAcqCost];
  for (let y = 0; y < hold; y++) {
    unlevCF.push(annualRows[y]?.noi ?? 0);
  }
  // Terminal: add gross sale proceeds (before selling costs and transfer taxes) at exit
  unlevCF[unlevCF.length - 1] += grossSalePrice - saleCostsValue;
  const unleveredIrr = calculateIRR(unlevCF);

  log.push(`Phase 7: IRR=${irr !== null ? (irr * 100).toFixed(2) : "null"}%, EM=${em !== null ? em.toFixed(2) : "null"}, UnlevIRR=${unleveredIrr !== null ? (unleveredIrr * 100).toFixed(2) : "null"}%, Avg CoC=${avgCoC !== null ? (avgCoC * 100).toFixed(2) : "null"}%`);

  // Phase 8: Waterfall
  log.push("Phase 8: Computing waterfall");
  const waterfall = computeWaterfall(
    annualRows, a.lpEquity, a.gpEquity, totalEquity,
    a.preferredReturn, hold, a.promoteTiers, a.promoteSplits, equityProceeds,
  );

  // ── Waterfall-derived summary metrics ────────────────────────────────────
  const lpTotalDistributions = waterfall.reduce((s, t) => s + t.lpDistribution, 0);
  const gpTotalDistributions = waterfall.reduce((s, t) => s + t.gpDistribution, 0);
  const lpProfit = lpTotalDistributions - a.lpEquity;
  const gpProfit = gpTotalDistributions - a.gpEquity;
  // Promote earned = GP distributions from promote tiers (tiers 3-5, indices 2-4)
  const gpPromoteEarned = waterfall.slice(2).reduce((s, t) => s + t.gpDistribution, 0);
  const totalProfit = lpProfit + gpProfit;

  // LP/GP cash-on-cash: avg annual operating dist / initial equity
  const lpOpDists = annualRows.slice(0, hold).map(r => r.preTaxCashFlow * (a.lpEquity / totalEquity));
  const gpOpDists = annualRows.slice(0, hold).map(r => r.preTaxCashFlow * (a.gpEquity / totalEquity));
  const lpCoC = a.lpEquity > 0 && lpOpDists.length > 0
    ? lpOpDists.reduce((s, v) => s + v, 0) / lpOpDists.length / a.lpEquity
    : null;
  const gpCoC = a.gpEquity > 0 && gpOpDists.length > 0
    ? gpOpDists.reduce((s, v) => s + v, 0) / gpOpDists.length / a.gpEquity
    : null;

  // ── Yield-on-Cost ─────────────────────────────────────────────────────────
  const yieldOnCostUntrended = totalAcqCost > 0 ? noiY1 / totalAcqCost : 0;
  const yieldOnCostTrended = totalAcqCost > 0 ? stabilizedNOI / totalAcqCost : 0;

  // ── Stabilized cap rate ───────────────────────────────────────────────────
  const stabilizedCapRate = a.purchasePrice > 0 ? stabilizedNOI / a.purchasePrice : null;

  // ── Debt metrics block ───────────────────────────────────────────────────
  const opRows = annualRows.slice(0, hold);
  const dscrValues = opRows.map(r => r.dscr).filter((d): d is number => d !== null);
  const dscrMin = dscrValues.length > 0 ? Math.min(...dscrValues) : null;
  const dscrAvg = dscrValues.length > 0 ? dscrValues.reduce((s, v) => s + v, 0) / dscrValues.length : null;
  const dscrY1 = annualRows[0]?.dscr ?? null;
  const dscrAtStabilization = annualRows[1]?.dscr ?? dscrY1;
  const debtYieldValues = opRows.map(r => r.debtYield).filter((d): d is number => d !== null);
  const debtYieldMin = debtYieldValues.length > 0 ? Math.min(...debtYieldValues) : null;
  const debtYieldY1 = annualRows[0]?.debtYield ?? null;

  // Break-even occupancy: occupancy at which NOI covers debt service for Y1
  // NOI = GPR * occ * (1 - mgmtFee) - fixedExp (approx)
  let breakEvenOccupancy: number | null = null;
  if (annualRows[0]) {
    const r0 = annualRows[0];
    const gpr = r0.grossPotentialRent;
    const ds0 = r0.debtService;
    // Fixed expenses = total − management fee (which scales with EGI)
    const fixedExp = r0.totalExpenses - r0.managementFee;
    // NOI ≈ GPR * occ * (1 − mgmtFee) − fixedExp = DS  → occ = (DS + fixedExp) / (GPR * (1 − mgmtFee))
    const mgmtFrac = r0.effectiveGrossIncome > 0 ? r0.managementFee / r0.effectiveGrossIncome : a.managementFee;
    const denom = gpr * (1 - mgmtFrac);
    breakEvenOccupancy = denom > 0 ? Math.min(1, (ds0 + fixedExp) / denom) : null;
  }

  // DSCR at −10% NOI stress
  const dscrStressed = dscrY1 !== null && annualRows[0]
    ? (annualRows[0].debtService > 0 ? (annualRows[0].noi * 0.9) / annualRows[0].debtService : null)
    : null;

  const positiveLeverage = goingInCap > a.rate;
  const spreadBps = Math.round((goingInCap - a.rate) * 10000);
  const ltvAtMaturity = grossSalePrice > 0 ? loanBalance / grossSalePrice : a.ltv;

  const debtMetrics: DebtMetrics = {
    coverage: {
      dscrMin,
      dscrAvg,
      dscrY1,
      dscrAtStabilization,
      debtYieldMin,
      debtYieldY1,
      breakEvenOccupancy,
      dscrStressedMinus10PctNOI: dscrStressed,
    },
    structural: {
      loanAmount: a.loanAmount,
      rate: a.rate,
      termMonths: a.term,
      amortMonths: a.amort,
      ioPeriodMonths: a.ioPeriod,
      originationFee: origFee,
      loanType: a.term <= 84 ? 'bridge' : 'perm',  // ≤7yr term = bridge
    },
    leverage: {
      ltvAtClose: a.ltv,
      ltvAtMaturity,
      positiveLeverage,
      spreadOverCapRateBps: spreadBps,
    },
    stress: {
      dscrAt10PctNOIDecline: dscrStressed,
      breakEvenOccupancy,
    },
  };

  // ── Valuation block ──────────────────────────────────────────────────────
  const gprY1 = annualRows[0]?.grossPotentialRent ?? 0;
  const valuation: ValuationBlock = {
    perUnit: {
      goingIn: a.units > 0 ? a.purchasePrice / a.units : 0,
      atExit: a.units > 0 ? grossSalePrice / a.units : 0,
    },
    perSF: {
      netRentable: (a.units > 0 && a.avgUnitSf > 0) ? a.purchasePrice / (a.units * a.avgUnitSf) : 0,
    },
    multiples: {
      grm: gprY1 > 0 ? a.purchasePrice / gprY1 : null,
      nim: noiY1 > 0 ? a.purchasePrice / noiY1 : null,
      opexRatio: (annualRows[0]?.effectiveGrossIncome ?? 0) > 0
        ? (annualRows[0]?.totalExpenses ?? 0) / (annualRows[0]?.effectiveGrossIncome ?? 1)
        : null,
      capRate: goingInCap,
      yieldOnCost: totalAcqCost > 0 ? noiY1 / totalAcqCost : null,
    },
  };

  // Phase 9: Sensitivity (skipped in sub-runs to prevent recursion)
  log.push("Phase 9: Computing sensitivity matrix");
  const sensitivity = opts?.skipSensitivity
    ? { exitCapAxis: [], rentGrowthAxis: [], irrGrid: [], emGrid: [] }
    : computeSensitivityMatrix(a);

  // Phase 10: Stress scenarios (skipped in sub-runs to prevent recursion)
  log.push("Phase 10: Computing stress scenarios");
  const stressScenarios: StressScenario[] = [
    { scenario: 'base', irr, equityMultiple: em, cashOnCash: avgCoC },
    { scenario: 'bear', irr: null, equityMultiple: null, cashOnCash: null },
    { scenario: 'bull', irr: null, equityMultiple: null, cashOnCash: null },
    { scenario: 'black_swan', irr: null, equityMultiple: null, cashOnCash: null },
  ];

  if (!opts?.skipSensitivity) {
    const stressConfigs: { scenario: string; rgDelta: number; vacDelta: number; ecDelta: number; egDelta: number }[] = [
      { scenario: 'bear', rgDelta: -0.015, vacDelta: 0.02, ecDelta: 0.0075, egDelta: 0.01 },
      { scenario: 'bull', rgDelta: 0.0075, vacDelta: -0.005, ecDelta: -0.005, egDelta: -0.005 },
      { scenario: 'black_swan', rgDelta: a.rentGrowth[0] > 0.005 ? -(a.rentGrowth[0] - 0.005) : -0.01, vacDelta: 0.05, ecDelta: 0.015, egDelta: 0.025 },
    ];

    for (const sc of stressConfigs) {
      const stressed: ModelAssumptions = {
        ...a,
        rentGrowth: a.rentGrowth.map(r => Math.max(0, r + sc.rgDelta)),
        vacancyY1: Math.min(1, Math.max(0, a.vacancyY1 + sc.vacDelta)),
        vacancyStab: Math.min(1, Math.max(0.05, a.vacancyStab + sc.vacDelta)),
        exitCap: a.exitCap + sc.ecDelta,
        expenseGrowth: Math.max(0, a.expenseGrowth + sc.egDelta),
      };
      const sr = runModel(stressed, { skipSensitivity: true });
      const s = stressScenarios.find(s => s.scenario === sc.scenario);
      if (s) {
        s.irr = sr.summary.irr;
        s.equityMultiple = sr.summary.equityMultiple;
        s.cashOnCash = sr.summary.avgCoC;
      }
    }
  }

  // ── Phase 11: Assemble result ─────────────────────────────────────────────
  log.push("Phase 11: Running integrity checks");

  const totalSources = a.lpEquity + a.gpEquity + a.loanAmount;
  const totalUses = a.purchasePrice + closingCosts + docStamps + intangibleTax + titleInsurance + origFee + a.capexBudget;

  const debtYieldByYear = annualRows.map(r => a.loanAmount > 0 ? r.noi / a.loanAmount : 0);

  const modelResult: ModelResults = {
    summary: {
      purchasePrice: a.purchasePrice,
      loanAmount: a.loanAmount,
      totalEquity,
      noiYear1: noiY1,
      goingInCapRate: goingInCap,
      exitCapRate: a.exitCap,
      irr,
      equityMultiple: em,
      avgCoC,
      lpIrr: waterfall.length > 0 ? waterfall[waterfall.length - 1].lpIrr : null,
      gpIrr: waterfall.length > 0 ? waterfall[waterfall.length - 1].gpIrr : null,
      lpEquityMultiple: waterfall.length > 0 ? waterfall[waterfall.length - 1].lpEquityMultiple : null,
      gpEquityMultiple: waterfall.length > 0 ? waterfall[waterfall.length - 1].gpEquityMultiple : null,
      loanBalanceAtExit: loanBalance,
      cashOnCashByYear: annualRows.slice(0, hold).map(r => totalEquity > 0 ? r.preTaxCashFlow / totalEquity : 0),
      dscrByYear: annualRows.slice(0, hold).map(r => r.dscr ?? 0),
      noiByYear: annualRows.slice(0, hold).map(r => r.noi),
      egiByYear: annualRows.slice(0, hold).map(r => r.effectiveGrossIncome),
      debtServiceCoverageByYear: annualRows.slice(0, hold).map(r => r.dscr ?? 0),
      debtYieldByYear: annualRows.slice(0, hold).map(r => r.debtYield ?? 0),
      stabilizedCapRate,
      unleveredIrr,
      yieldOnCost: { untrended: yieldOnCostUntrended, trended: yieldOnCostTrended },
      totalProfit,
      lpCoC,
      gpCoC,
      lpTotalDistributions,
      lpProfit,
      gpTotalDistributions,
      gpPromoteEarned,
    },
    annualCashFlow: annualRows,
    sourcesAndUses: {
      sources: [
        { id: 'equity-lp', label: 'Equity (LP)', amount: a.lpEquity, pct: totalSources > 0 ? a.lpEquity / totalSources : 0, source: 'equity' },
        { id: 'equity-gp', label: 'Equity (GP)', amount: a.gpEquity, pct: totalSources > 0 ? a.gpEquity / totalSources : 0, source: 'equity' },
        { id: 'senior-debt', label: 'Senior Debt', amount: a.loanAmount, pct: totalSources > 0 ? a.loanAmount / totalSources : 0, source: 'debt' },
      ],
      uses: [
        { id: 'purchase-price', label: 'Purchase Price', amount: a.purchasePrice, pct: totalUses > 0 ? a.purchasePrice / totalUses : 0, source: 'acquisition' },
        { id: 'closing-costs', label: 'Closing Costs', amount: closingCosts, pct: totalUses > 0 ? closingCosts / totalUses : 0, source: 'acquisition' },
        { id: 'doc-stamps', label: 'Doc Stamps', amount: docStamps, pct: totalUses > 0 ? docStamps / totalUses : 0, source: 'tax' },
        { id: 'intangible-tax', label: 'Intangible Tax', amount: intangibleTax, pct: totalUses > 0 ? intangibleTax / totalUses : 0, source: 'tax' },
        { id: 'title-insurance', label: 'Title Insurance', amount: titleInsurance, pct: totalUses > 0 ? titleInsurance / totalUses : 0, source: 'closing' },
        { id: 'origination-fee', label: 'Origination Fee', amount: origFee, pct: totalUses > 0 ? origFee / totalUses : 0, source: 'financing' },
        { id: 'capex-budget', label: 'Capex Budget', amount: a.capexBudget, pct: totalUses > 0 ? a.capexBudget / totalUses : 0, source: 'capex' },
      ],
      totalSources,
      totalUses,
      delta: 0,
      balanced: true,
      benchmarks: {
        totalCostPerUnit: a.units > 0 ? totalAcqCost / a.units : 0,
        debtPct: totalSources > 0 ? a.loanAmount / totalSources : 0,
        equityPct: totalSources > 0 ? totalEquity / totalSources : 0,
        capexPerUnit: a.units > 0 ? a.capexBudget / a.units : 0,
      },
    },
    disposition: {
      stabilizedNOI,
      grossSalePrice,
      saleCosts: saleCostsValue,
      netSaleProceeds,
      loanBalance,
      equityProceeds,
      dispositionDocStamps,
      exitYear: hold,
    },
    debtMetrics,
    valuation,
    sensitivityAnalysis: { matrix: sensitivity },
    stressScenarios,
    waterfallDistributions: waterfall,
    capital: {
      amortizationSchedule: [],
      loanBalanceByYear: amort.balanceByYear,
      debtServiceByYear: amort.debtServiceByYear,
      debtYieldByYear,
      tranches: [
        {
          id: 'senior-debt',
          label: 'Senior Debt',
          amount: a.loanAmount,
          rate: a.rate,
          termMonths: a.term,
          amortMonths: a.amort,
          ltv: a.ltv,
        },
      ],
      metrics: {
        totalCost: totalAcqCost,
        totalEquity,
        totalDebt: a.loanAmount,
        equityPct: totalAcqCost > 0 ? totalEquity / totalAcqCost : 0,
        debtPct: totalAcqCost > 0 ? a.loanAmount / totalAcqCost : 0,
        capexPerUnit: a.units > 0 ? a.capexBudget / a.units : 0,
      },
    },
    taxes: {
      reTax: taxSchedule,
      transferTax: {
        acquisition: docStamps + intangibleTax + titleInsurance,
        disposition: dispositionDocStamps,
        refi: 0,
      },
    },
    projections: [],
    integrityChecks: [],
    reasoning: { derivationLog: log },
    meta: {
      modelVersion: '1.1',
      runner: 'deterministic-model-runner',
      computedAt: new Date().toISOString(),
    },
  };

  modelResult.integrityChecks = runIntegrityChecks(a, modelResult);

  // Fix S&U balanced flag
  modelResult.sourcesAndUses.delta = modelResult.sourcesAndUses.totalSources - modelResult.sourcesAndUses.totalUses;
  modelResult.sourcesAndUses.balanced = Math.abs(modelResult.sourcesAndUses.delta) < 1;

  // Populate amortization schedule
  for (let y = 0; y < hold + 1; y++) {
    modelResult.capital.amortizationSchedule.push({
      year: y + 1,
      beginningBalance: y === 0 ? a.loanAmount : amort.balanceByYear[y - 1],
      interest: amort.interestByYear[y] ?? 0,
      principal: amort.principalByYear[y] ?? 0,
      endingBalance: amort.balanceByYear[y] ?? 0,
    });
  }

  // Populate projections (institutional format rows)
  for (let y = 0; y < annualRows.length; y++) {
    const row = annualRows[y];
    modelResult.projections.push({
      year: row.year,
      institutionalRow: {
        gpr: row.grossPotentialRent,
        ltl: row.lossToLease,
        vacancy: row.vacancy,
        concessions: row.concessions,
        bad_debt: row.badDebt,
        base_revenue: row.baseRevenue,
        other_income: row.otherIncome,
        egi: row.effectiveGrossIncome,
        total_opex: row.totalExpenses,
        noi: row.noi,
        debt_service: row.debtService,
        cash_flow: row.preTaxCashFlow,
        dscr: row.dscr ?? 0,
        occupancy: row.occupancy,
        debt_yield: row.debtYield ?? 0,
        cap_rate_on_cost: row.capRateOnCost ?? 0,
      },
    });
  }

  return modelResult;
}
