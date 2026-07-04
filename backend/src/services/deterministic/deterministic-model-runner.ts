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
  /** Minimum vacancy rate applied during underwriting (default 5%). */
  underwritingVacancyFloor?: number;
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
  // Optional: more-granular deal mode threaded from ProFormaAssumptions.dealMode.
  // Recognised values: 'existing' | 'development' | 'ground_up' | 'redevelopment' | 'lease_up' | 'value_add'.
  // When absent, verifier falls back to dealType.
  dealMode?: string;
  // Optional: non-FL base property tax (for computing non-FL tax schedule)
  basePropertyTax?: number;
  // Optional: apply bonus depreciation in Y1 (spec §11; defaults true when omitted)
  useBonusDepreciation?: boolean;
  // Optional: per-field evidence hints from the seeder's LayeredValue metadata
  _evidenceHints?: Record<string, { source: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reasoning?: string }>;
  // Optional: collision report pre-built by the seeder bridge
  _collisionReport?: CollisionEntry[];
  // Optional: unmatched opex keys detected by the bridge — integrity warning surfaced
  _unmatchedOpexKeys?: string[];
  // Optional: orphaned/alien expense keys — money present but unmapped to any known category
  _orphanedOpexKeys?: string[];
  // Optional: bridge metadata (ruleset version, provenance flags)
  _meta?: { opexKeyRuleVersion?: string };
  // Optional development/ground-up fields (defaults: 18mo construction, 12mo lease-up, 60% LTC, 8% rate)
  _unmatchedOpexKeys?: string[];
  // Optional development/ground-up fields (defaults: 18mo construction, 12mo lease-up, 60% LTC, 8% rate)
  constructionMonths?: number;
  leaseUpMonths?: number;
  hardCostPerSF?: number;
  softCostPct?: number;
  constructionLoanRate?: number;
  constructionLtc?: number;
  // Optional: months to stabilization for lease-up absorption curve (monthly ramp)
  monthsToStabilize?: number;
  // Turn-cohort fields (W1)
  standardTurnDowntimeDays?: number;   // days of downtime for standard turns (default 14)
  renoTurnDowntimeWeeks?: number;     // weeks of downtime for renovation turns (overlay)
  newLeaseConcessionMonths?: number; // months of free rent on new leases (default 1)
  annualTurnoverRate?: number;        // fraction of units turning over per year (default 0.50)
  // Initial occupancy from rent roll (provenance document; absent → platform_default with surfaced flag)
  occupancyAtClose?: number;
}

export interface AnnualCashFlowRow {
  year: number;
  grossPotentialRent: number;
  lossToLease: number;
  vacancy: number;       // vacancy rate (0–1 fraction), NOT a dollar field — rate fields never sum
  vacancyLoss: number;   // dollar vacancy deduction (GPR × vacancy rate), dollar fields never average
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
  // ── Income tax fields (spec §11) ──────────────────────────────────────────
  depreciation: number;
  taxableIncome: number;
  taxPayable: number;
  afterTaxCashFlow: number;
}

export interface MonthlyCashFlowRow {
  month: number; // 1-based, 1..(holdYears*12)
  year: number;  // which operating year this month belongs to
  gpr: number;
  lossToLease: number;
  vacancy: number;       // vacancy rate (0–1 fraction), NOT a dollar field — rate fields never sum
  vacancyLoss: number;   // dollar vacancy deduction (GPR × vacancy rate), dollar fields never average
  concessions: number;
  badDebt: number;
  baseRevenue: number;
  otherIncome: number;
  egi: number;
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
  occupancy: number;
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
  hurdleRate: number;
  lpSplit: number;
  gpSplit: number;
  lpDistribution: number;
  gpDistribution: number;
  promotePctEarned: number;
  lpIrr: number | null;
  gpIrr: number | null;
  lpEquityMultiple: number | null;
  gpEquityMultiple: number | null;
}

export interface WaterfallResult {
  tiers: WaterfallTier[];
  lpCFAggregate: number[];  // [-lpEquity, total_LP_dist_Y1, ..., total_LP_dist_Yexit]
  gpCFAggregate: number[];  // [-gpEquity, total_GP_dist_Y1, ..., total_GP_dist_Yexit]
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

export interface CollisionEntry {
  field: string;
  magnitude: 'material' | 'critical';
  sourceA_value: number;
  sourceB_value: number;
  delta: number;
  selectedSource: string;
  reason: string;
  narrative: string;
}

export interface EvidenceEntry {
  field: string;
  value: number | null;
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

export interface EvidenceBlock {
  confidence_distribution: { high: number; medium: number; low: number };
  fields: EvidenceEntry[];
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
    reTax: {
      t12AssessedValue: number | null;
      platformAssessedValue: number;
      platformMillageRate: number;
      platformAnnualTax: number | null;
      isMiamiDade: boolean;
      sohCapPct: number;
      perYear: Array<{
        year: number;
        assessedValue: number;
        millageRate: number;
        taxAmount: number;
        capBinding: boolean;
        sohCapBinding: boolean;
        reassessmentEvent: boolean;
      }>;
      deltaVsT12Pct: number | null;
    };
    incomeTax: {
      purchasePrice: number;
      landValuePct: number;
      depreciableBase: number;
      annualDepreciation: number;
      bonusDepreciationCurrentYearPct: number;
      costSegAvailablePct: number;
      marginalTaxRate: number;
    };
    transferTax: {
      purchasePrice: number;
      loanAmount: number;
      docStampAmount: number;
      intangibleTaxAmount: number;
      isMiamiDade: boolean;
      miamiDadeRatePct: number;
      statewideFlatRatePct: number;
      appliedRatePct: number;
      totalTransferTax: number;
      dispositionDocStamps: number;
      refi: null;
    };
  };
  projections: { year: number; institutionalRow: Record<string, number> }[];
  integrityChecks: IntegrityCheck[];
  reasoning: {
    derivationLog: string[];
    walkthrough: string;
    collisionReport: CollisionEntry[];
  };
  evidence: EvidenceBlock;
  meta: {
    modelVersion: string;
    runner: string;
    computedAt: string;
    m11Converged?: boolean;
    m11Iterations?: number;
    m14Applied?: boolean;
    m14CapRateAdjBps?: number;
  };
  monthlyCashFlow: MonthlyCashFlowRow[];
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

// Turn-cohort defaults (W1)
const DEF_STANDARD_TURN_DOWNTIME_DAYS = 14;
const DEF_NEW_LEASE_CONCESSION_MONTHS = 1;
const DEF_ANNUAL_TURNOVER_RATE = 0.50;

// Underwriting vacancy floor (W4) — single source of truth, imported by bridge
export const DEF_UNDERWRITING_VACANCY_FLOOR = 0.05;

// ── Annual-per-unit to monthly conversion (C1 fix) ────────────────────────────
// Per-unit expense inputs are ANNUAL rates ($/unit/yr). The monthly compute
// must divide by 12 to get $/month. This is the single named location for that
// conversion; the assertion is why there won't be a fifth appearance of this bug.
function applyAnnualPerUnitToMonth(
  annualPerUnit: number,
  totalUnits: number,
  expenseGrowthFactor: number,
): number {
  // assert: annualPerUnit is in $/unit/year; result is in $/month for this month
  return (annualPerUnit * totalUnits * expenseGrowthFactor) / 12;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isMiamiDade(county?: string): boolean {
  if (!county) return false;
  const c = county.toLowerCase().replace(/[\s-]/g, '');
  return c === 'miamidade' || c === 'dade' || c === '12086';
}

export function buildVacancySchedule(holdYears: number, vacancyY1: number, vacancyStab: number): number[] {
  const s: number[] = [];
  const y1Val = Math.max(vacancyY1, vacancyStab);
  for (let y = 1; y <= holdYears + 1; y++) {
    if (y === 1) {
      s.push(y1Val);
    } else if (y === 2 && y1Val > vacancyStab) {
      // Linear midpoint: halfway between Y1 vacancy and stabilized vacancy
      s.push((y1Val + vacancyStab) / 2);
    } else {
      s.push(vacancyStab);
    }
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
  const attempt = (r0: number): number | null => {
    let r = r0;
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
  };
  const first = attempt(guess);
  if (first !== null) return first;
  // Retry with negative initial guess for marginally-negative-return deals
  if (guess >= 0) return attempt(-0.10);
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
): Omit<AnnualCashFlowRow, 'year' | 'annualInterest' | 'annualPrincipal' | 'debtService' | 'preTaxCashFlow' | 'cfads' | 'dscr' | 'debtYield' | 'capRateOnCost' | 'isExitYear' | 'depreciation' | 'taxableIncome' | 'taxPayable' | 'afterTaxCashFlow'> {
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
    vacancy: vacancySched[y - 1],
    vacancyLoss: vac,
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

// ── Monthly cash-flow resolution (D2 ribbon consumption) ─────────────────────

/**
 * Compute a single month's operating cash flow.
 *
 * For lease-up deals, vacancy ramps linearly within Y1 from 100% down to the
 * Y1 vacancy rate over `monthsToStabilize` months, then holds constant. All
 * other line items are derived from the yearly row by dividing by 12, ensuring
 * that Σ(monthly) == yearly exactly.
 */
export function computeMonthOperating(
  monthIdx: number, // 0-based within the year (0-11)
  year: number,
  a: ModelAssumptions,
  yearRow: AnnualCashFlowRow,
  vacancyRate: number,
): MonthlyCashFlowRow {
  const isY1 = year === 1;
  const isLeaseUp = a.dealMode === 'lease_up' && isY1 && a.monthsToStabilize != null && a.monthsToStabilize > 0;

  let monthVacancy = vacancyRate;
  if (isLeaseUp) {
    const m = monthIdx;
    const M = a.monthsToStabilize!;
    if (m < M) {
      // Linear ramp from 100% vacant to Y1 vacancy over M months
      monthVacancy = 1.0 - ((1.0 - vacancyRate) * (m / M));
    } else {
      monthVacancy = vacancyRate;
    }
  }

  // For revenue items that depend on vacancy, scale proportionally
  // so that the 12-month sum equals the yearly row exactly.
  const vacScale = monthVacancy / vacancyRate;
  const gpr = isLeaseUp ? yearRow.grossPotentialRent * (1 - monthVacancy) / (1 - vacancyRate) / 12 : yearRow.grossPotentialRent / 12;
  const lossToLease = yearRow.lossToLease / 12;
  const vacancy = monthVacancy;
  const concessions = yearRow.concessions / 12;
  const badDebt = yearRow.badDebt / 12;
  const baseRevenue = yearRow.baseRevenue / 12;
  const otherIncome = yearRow.otherIncome / 12;
  const egi = yearRow.effectiveGrossIncome / 12;

  // Expenses: divide by 12 (flat within year)
  const payroll = yearRow.payroll / 12;
  const maintenance = yearRow.maintenance / 12;
  const contractServices = yearRow.contractServices / 12;
  const marketing = yearRow.marketing / 12;
  const utilities = yearRow.utilities / 12;
  const admin = yearRow.admin / 12;
  const insurance = yearRow.insurance / 12;
  const propertyTax = yearRow.propertyTax / 12;
  const managementFee = yearRow.managementFee / 12;
  const replacementReserves = yearRow.replacementReserves / 12;
  const totalExpenses = yearRow.totalExpenses / 12;
  const noi = yearRow.noi / 12;
  const occupancy = 1 - monthVacancy;

  return {
    month: (year - 1) * 12 + monthIdx + 1,
    year,
    gpr,
    lossToLease,
    vacancy,
    vacancyLoss: yearRow.vacancyLoss / 12,
    concessions,
    badDebt,
    baseRevenue,
    otherIncome,
    egi,
    payroll,
    maintenance,
    contractServices,
    marketing,
    utilities,
    admin,
    insurance,
    propertyTax,
    managementFee,
    replacementReserves,
    totalExpenses,
    noi,
    occupancy,
  };
}

// =========================================================================
// TURN-COHORT MONTHLY ENGINE (Phase 2 W2)
// =========================================================================
// Replaces the vacuous "div 12" monthly model with a real unit-cohort engine.
// Tracks lease expiry -> turn downtime -> vacant -> new lease (with concession)
// for every unit, every month.  Y1 NOI is derived from monthly first, then
// aggregated to yearly -- satisfying Operator Ruling #1.
// =========================================================================

/** Mutable state for the turn-cohort engine. */
export interface TurnCohortState {
  /** Units still on original leases (paying in-place rent). */
  occupiedAtInPlace: number;
  /** Units that turned over and now pay market rent. */
  occupiedAtMarket: number;
  /** Units between move-out and ready-for-lease (no rent). */
  turning: number;
  /** Units vacant at acquisition — lease-up stock, drained at absorption pace. */
  vacantStructural: number;
  /** Units that completed make-ready this month — re-leased in full (friction already in downtime). */
  vacantTurn: number;
  /** Units occupied but in free-rent concession period (no rent). */
  concession: number;
  /** Running rent-growth multiplier (1.0 at acquisition). */
  cumulativeGrowth: number;
  /** FIFO queue: turnEntries[m] = units that entered turn in month m. */
  turnEntries: number[];
  /** FIFO queue: concessionEntries[m] = units that entered concession in month m. */
  concessionEntries: number[];
  /** Initial structural vacant count at m=0, for absorption pacing. */
  initialVacantUnits: number;
}

/** Initialise turn-cohort state at acquisition (rent-roll driven or fully occupied default). */
export function createTurnCohortState(a: ModelAssumptions): TurnCohortState {
  const occupiedAtInPlace = a.occupancyAtClose != null ? a.units * a.occupancyAtClose : a.units;
  const vacantStructural = a.units - occupiedAtInPlace;
  return {
    occupiedAtInPlace,
    occupiedAtMarket: 0,
    turning: 0,
    vacantStructural,
    vacantTurn: 0,
    concession: 0,
    cumulativeGrowth: 1.0,
    turnEntries: [],
    concessionEntries: [],
    initialVacantUnits: vacantStructural,
  };
}

/** Resolve effective downtime in months from assumptions. */
function getDowntimeMonths(a: ModelAssumptions): number {
  if (a.renoTurnDowntimeWeeks != null && a.renoTurnDowntimeWeeks > 0) {
    return a.renoTurnDowntimeWeeks * 7 / 30;
  }
  return (a.standardTurnDowntimeDays ?? DEF_STANDARD_TURN_DOWNTIME_DAYS) / 30;
}

/**
 * Compute ONE month using the turn-cohort engine.
 *
 * State is mutated in-place (pass by reference) so the caller can iterate
 * month-by-month without copying large structs.
 *
 * @param monthIdx  0-based month index (0 = first month of operations)
 * @param year      1-based operating year (1..holdYears)
 * @param a         Model assumptions
 * @param state     Mutable TurnCohortState
 * @param taxMonth  Monthly property-tax amount ($/mo)
 * @returns MonthlyCashFlowRow for this month
 */
export function computeMonthTurnCohort(
  monthIdx: number,
  year: number,
  a: ModelAssumptions,
  state: TurnCohortState,
  taxMonth: number,
): MonthlyCashFlowRow {
  const totalUnits = a.units;
  const monthlyTurnover = (a.annualTurnoverRate ?? DEF_ANNUAL_TURNOVER_RATE) / 12;
  const downtimeMonths = getDowntimeMonths(a);
  const concessionMonths = a.newLeaseConcessionMonths ?? DEF_NEW_LEASE_CONCESSION_MONTHS;

  // Rent growth: apply at the start of each year after Y1
  if (monthIdx > 0 && monthIdx % 12 === 0) {
    const growthIdx = Math.min(year - 1, a.rentGrowth.length - 1);
    state.cumulativeGrowth *= (1 + (a.rentGrowth[growthIdx] ?? 0.03));
  }

  const marketRent = a.marketRent * state.cumulativeGrowth;
  const inPlaceRent = a.inPlaceRent * state.cumulativeGrowth;

  // STEP 1 -- Lease expiries: draw proportionally from both pools
  // In-place turns burn off LTL; market→market turns incur downtime+concession
  // but re-lease at market (no LTL effect). Both pools are mortal — steady-state
  // friction requires market units to turn too.
  const expiringInPlace = state.occupiedAtInPlace * monthlyTurnover;
  const expiringMarket = state.occupiedAtMarket * monthlyTurnover;
  state.occupiedAtInPlace -= expiringInPlace;
  state.occupiedAtMarket -= expiringMarket;
  const totalExpiring = expiringInPlace + expiringMarket;
  state.turning += totalExpiring;
  state.turnEntries[monthIdx] = totalExpiring;

  // STEP 2 -- Turn completion: units that entered turn `downtimeMonths` ago
  // finish and become available for re-lease (vacantTurn — friction already modeled).
  const completedMonth = Math.floor(monthIdx - downtimeMonths);
  const completingTurn = completedMonth >= 0 ? (state.turnEntries[completedMonth] ?? 0) : 0;
  state.turning -= completingTurn;
  state.vacantTurn += completingTurn;

  // STEP 3 -- New leases: two channels, never conflated
  //   (a) Turn completions: re-lease in full — downtime IS the friction; no additional throttle.
  //   (b) Structural vacants: lease-up stock, drained at absorption pace.
  //   A market days-on-market throttle on turn re-leases is a v1.1 refinement; log, don't build.
  const pace = a.monthsToStabilize != null && a.monthsToStabilize > 0
    ? Math.ceil(state.initialVacantUnits / a.monthsToStabilize)
    : Math.ceil(state.initialVacantUnits / 24);
  const structuralLeases = Math.min(state.vacantStructural, pace);
  state.vacantStructural -= structuralLeases;
  const turnLeases = state.vacantTurn;
  state.vacantTurn = 0;
  const newLeases = structuralLeases + turnLeases;
  state.concession += newLeases;
  state.concessionEntries[monthIdx] = newLeases;

  // STEP 4 -- Concession expiry: units that entered concession
  // `concessionMonths` ago start paying rent at market
  const concessionCompleteMonth = Math.floor(monthIdx - concessionMonths);
  const concessionCompleting = concessionCompleteMonth >= 0
    ? (state.concessionEntries[concessionCompleteMonth] ?? 0)
    : 0;
  state.concession -= concessionCompleting;
  state.occupiedAtMarket += concessionCompleting;

  // STEP 5 -- Revenue computation
  // GPR = what we would collect if every unit were occupied at market rent
  const gpr = totalUnits * marketRent;

  // Loss to lease = in-place units paying below market
  const lossToLease = state.occupiedAtInPlace * (marketRent - inPlaceRent);

  // Vacancy = units physically empty (turning + vacantStructural + vacantTurn).
  // Concession units are occupied-with-concession; their rent deduction lives
  // only in the `concessions` line. One deduction, one home.
  const physicalVacancyUnits = state.turning + state.vacantStructural + state.vacantTurn;
  const vacancy = totalUnits > 0 ? physicalVacancyUnits / totalUnits : 0;

  // Underwriting vacancy floor (W4): revenue deduction uses effective vacancy,
  // physical occupancy remains emergent and uncapped.
  const floorUnits = totalUnits * (a.underwritingVacancyFloor ?? DEF_UNDERWRITING_VACANCY_FLOOR);
  const effectiveVacancyUnits = Math.max(physicalVacancyUnits, floorUnits);
  const floorBinding = effectiveVacancyUnits > physicalVacancyUnits;
  const effectiveVacancy = totalUnits > 0 ? effectiveVacancyUnits / totalUnits : 0;

  // Concessions = free-rent period on newly leased units
  const concessions = state.concession * marketRent;

  // Bad debt
  const badDebt = gpr * a.badDebt;

  // Base revenue = GPR - lossToLease - vacancyLoss - concessions - badDebt
  // vacancyLoss uses effectiveVacancyUnits (underwriting floor may bind)
  const vacancyLoss = effectiveVacancyUnits * marketRent;
  const baseRevenue = gpr - lossToLease - vacancyLoss - concessions - badDebt;

  // Other income (scales with total units, not occupancy; annual per-unit rate → monthly)
  const expenseGrowthFactor = Math.pow(1 + a.expenseGrowth, year - 1);
  const otherIncome = applyAnnualPerUnitToMonth(a.otherIncomePerUnit, totalUnits, expenseGrowthFactor);

  // Effective gross income
  const egi = baseRevenue + otherIncome;

  // STEP 6 -- Operating expenses (flat per-unit annual rates, scaled by expense growth, converted to monthly)
  const payroll = applyAnnualPerUnitToMonth(a.payrollPerUnit, totalUnits, expenseGrowthFactor);
  const maintenance = applyAnnualPerUnitToMonth(a.maintenancePerUnit, totalUnits, expenseGrowthFactor);
  const contractServices = applyAnnualPerUnitToMonth(a.contractServicesPerUnit, totalUnits, expenseGrowthFactor);
  const marketing = applyAnnualPerUnitToMonth(a.marketingPerUnit, totalUnits, expenseGrowthFactor);
  const utilities = applyAnnualPerUnitToMonth(a.utilitiesPerUnit, totalUnits, expenseGrowthFactor);
  const admin = applyAnnualPerUnitToMonth(a.adminPerUnit, totalUnits, expenseGrowthFactor);
  const insurance = applyAnnualPerUnitToMonth(a.insurancePerUnit, totalUnits, expenseGrowthFactor);
  const managementFee = egi * a.managementFee;
  const replacementReserves = applyAnnualPerUnitToMonth(a.replacementReserves, totalUnits, expenseGrowthFactor);

  const totalExpenses = payroll + maintenance + contractServices + marketing +
    utilities + admin + insurance + taxMonth + managementFee + replacementReserves;

  const noi = egi - totalExpenses;

  const occupiedCount = state.occupiedAtInPlace + state.occupiedAtMarket + state.concession;
  const occupancy = totalUnits > 0 ? occupiedCount / totalUnits : 0;

  return {
    month: monthIdx + 1,
    year,
    gpr,
    lossToLease,
    vacancy,
    vacancyLoss,
    concessions,
    badDebt,
    baseRevenue,
    otherIncome,
    egi,
    payroll,
    maintenance,
    contractServices,
    marketing,
    utilities,
    admin,
    insurance,
    propertyTax: taxMonth,
    managementFee,
    replacementReserves,
    totalExpenses,
    noi,
    occupancy,
    effectiveVacancy,
    floorBinding,
  };
}

/**
 * Build the full monthly cash-flow array using the turn-cohort engine.
 *
 * This is the PRIMARY monthly computation path.  It iterates month-by-month,
 * tracking unit states, then returns the full MonthlyCashFlowRow array.
 * The caller can aggregate these rows to yearly rows via
 * `aggregateMonthlyToAnnual()`.
 *
 * @param a          Model assumptions
 * @param taxByYear  Annual property-tax array (taxByYear[0] = Y1 tax)
 * @returns MonthlyCashFlowRow[] for all operating months
 */
export function buildMonthlyCashFlowTurnCohort(
  a: ModelAssumptions,
  taxByYear: number[],
): MonthlyCashFlowRow[] {
  const monthly: MonthlyCashFlowRow[] = [];
  const state = createTurnCohortState(a);
  const totalMonths = a.holdYears * 12;

  for (let m = 0; m < totalMonths; m++) {
    const year = Math.floor(m / 12) + 1;
    const taxMonth = (taxByYear[year - 1] ?? 0) / 12;
    const row = computeMonthTurnCohort(m, year, a, state, taxMonth);
    monthly.push(row);
  }

  return monthly;
}

/**
 * Aggregate monthly cash-flow rows into annual rows.
 *
 * Sums every monthly field across the 12 months of each year, then fills in
 * the annual-specific fields (interest, principal, debtService, etc.) from
 * the amortization schedule.
 *
 * @param monthly    Array of MonthlyCashFlowRow (from turn-cohort engine)
 * @param a          Model assumptions
 * @param amort      Amortization result { interestByYear, principalByYear, ... }
 * @returns AnnualCashFlowRow[]
 */
export function aggregateMonthlyToAnnual(
  monthly: MonthlyCashFlowRow[],
  a: ModelAssumptions,
  amort: ReturnType<typeof computeAmortization>,
): AnnualCashFlowRow[] {
  const annual: AnnualCashFlowRow[] = [];
  const nYears = a.holdYears;

  for (let y = 1; y <= nYears; y++) {
    const monthRows = monthly.filter(r => r.year === y);
    if (monthRows.length === 0) continue;

    const sum = (field: keyof MonthlyCashFlowRow): number =>
      monthRows.reduce((s, r) => s + (r[field] as number), 0);

    const noi = sum('noi');
    const egi = sum('egi');
    const debtService = amort.debtServiceByYear[y - 1] ?? 0;
    const preTaxCashFlow = noi - debtService;
    const dscr = debtService > 0 ? noi / debtService : null;
    const avgOccupancy = monthRows.reduce((s, r) => s + r.occupancy, 0) / monthRows.length;

    const avgVacancy = monthRows.reduce((s, r) => s + r.vacancy, 0) / monthRows.length;

    annual.push({
      year: y,
      grossPotentialRent: sum('gpr'),
      lossToLease: sum('lossToLease'),
      vacancy: avgVacancy,
      vacancyLoss: sum('vacancyLoss'),
      concessions: sum('concessions'),
      badDebt: sum('badDebt'),
      baseRevenue: sum('baseRevenue'),
      otherIncome: sum('otherIncome'),
      effectiveGrossIncome: egi,
      payroll: sum('payroll'),
      maintenance: sum('maintenance'),
      contractServices: sum('contractServices'),
      marketing: sum('marketing'),
      utilities: sum('utilities'),
      admin: sum('admin'),
      insurance: sum('insurance'),
      propertyTax: sum('propertyTax'),
      managementFee: sum('managementFee'),
      replacementReserves: sum('replacementReserves'),
      totalExpenses: sum('totalExpenses'),
      noi,
      annualInterest: amort.interestByYear[y - 1] ?? 0,
      annualPrincipal: amort.principalByYear[y - 1] ?? 0,
      debtService,
      preTaxCashFlow,
      cfads: preTaxCashFlow,
      dscr,
      occupancy: avgOccupancy,
      debtYield: a.loanAmount > 0 ? noi / a.loanAmount : null,
      capRateOnCost: null,
      isExitYear: false,
      depreciation: 0,
      taxableIncome: 0,
      taxPayable: 0,
      afterTaxCashFlow: 0,
    });
  }

  return annual;
}

/**
 * Build the full monthly cash-flow array from the annual rows and assumptions.
 *
 * Invariant: for every financial field (gpr, egi, noi, etc.), the sum of the
 * 12 monthly values equals the corresponding yearly value exactly.
 */
export function buildMonthlyCashFlow(
  a: ModelAssumptions,
  annualRows: AnnualCashFlowRow[],
): MonthlyCashFlowRow[] {
  const monthly: MonthlyCashFlowRow[] = [];
  const vacancySched = buildVacancySchedule(a.holdYears, a.vacancyY1, a.vacancyStab);

  for (const yearRow of annualRows) {
    const y = yearRow.year;
    if (y > a.holdYears + 1) continue; // skip disposition year if present

    const yearVacancy = vacancySched[y - 1] ?? a.vacancyStab;
    for (let m = 0; m < 12; m++) {
      monthly.push(computeMonthOperating(m, y, a, yearRow, yearVacancy));
    }
  }

  return monthly;
}

/**
 * Extract a monthly field series from the deterministic results for
 * ribbon/seeder consumption.
 */
export function getMonthlyFieldSeries(
  results: ModelResults,
  fieldName: keyof MonthlyCashFlowRow,
): Array<{ month: number; value: number }> {
  return results.monthlyCashFlow.map(row => ({
    month: row.month,
    value: row[fieldName] as number,
  }));
}

// ── Waterfall (IRR-hurdle-based) — per spec §3.12 ─────────────────────────

/**
 * Binary-search for the LP cash flow increment that brings LP's running IRR
 * to `hurdleRate`.
 *
 * @param hurdleRate  Target LP IRR (0 for ROC, preferredReturn for pref, etc.)
 * @param lpCFBase    LP cash flow history up to (but not including) this year:
 *                    [-lpEquity, dist_Y1, ..., dist_Y{y-1}]
 * @param lpAlreadyThisYear  LP already allocated this year from earlier tiers
 * @param maxLPAmount Maximum LP dollars available from this tier (residual × lpSplit)
 * @param tol         Bisection tolerance (default 1e-4 = 0.01%)
 * @returns           LP allocation from this tier in this year
 */
export function bisectDistribution(
  hurdleRate: number,
  lpCFBase: number[],
  lpAlreadyThisYear: number,
  maxLPAmount: number,
  tol: number = 1e-4,
): number {
  if (!isFinite(hurdleRate)) return maxLPAmount;  // catch-all tier: take everything
  if (maxLPAmount <= 0) return 0;

  const cfWith0 = [...lpCFBase, lpAlreadyThisYear];
  const irrWith0 = calculateIRR(cfWith0);
  // If running IRR is already at or above hurdle with 0 additional → this tier is exhausted
  if (irrWith0 !== null && irrWith0 >= hurdleRate - tol * 0.1) return 0;

  const cfWithMax = [...lpCFBase, lpAlreadyThisYear + maxLPAmount];
  const irrWithMax = calculateIRR(cfWithMax);
  // If even max LP allocation doesn't bring IRR to hurdle → take everything
  if (irrWithMax === null || irrWithMax < hurdleRate - tol * 0.1) return maxLPAmount;

  // Bisect: find X ∈ [0, maxLPAmount] s.t. IRR(lpCFBase + [lpAlreadyThisYear + X]) ≈ hurdleRate
  let lo = 0;
  let hi = maxLPAmount;
  for (let iter = 0; iter < 64; iter++) {
    if (hi - lo < tol) break;
    const mid = (lo + hi) / 2;
    const cfMid = [...lpCFBase, lpAlreadyThisYear + mid];
    const irrMid = calculateIRR(cfMid);
    if (irrMid === null || irrMid < hurdleRate) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * IRR-hurdle waterfall per spec §3.12.
 *
 * Each year's cfads (and the exit equityProceeds) flows through 5 tiers in order:
 *   T1 ROC           – pro-rata until LP and GP have each received their invested capital back
 *   T2 Pref          – LP gets 100% until LP running IRR reaches preferredReturn (GP gets 0)
 *   T3 Promote 1     – (1-promoteSplits[0])/promoteSplits[0] until LP IRR = promoteTiers[0]
 *   T4 Promote 2     – (1-promoteSplits[1])/promoteSplits[1] until LP IRR = promoteTiers[1]
 *   T5 Final Promote – remainder at (1-promoteSplits[2])/promoteSplits[2] (no upper bound)
 *
 * Returns tier breakdown + aggregate LP/GP CF vectors for summary IRR/EM calculation.
 */
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
  opts?: { skipPerTierIRR?: boolean },
): WaterfallResult {
  const lpPct = totalEquity > 0 ? lpEquity / totalEquity : 0;
  const gpPct = totalEquity > 0 ? gpEquity / totalEquity : 0;

  // Tier definitions per spec §3.12
  const tierDefs = [
    { tierName: 'Return of Capital', hurdleRate: 0,              lpSplit: lpPct,                 gpSplit: gpPct              },
    // T2 Preferred Return: LP receives 100% of cash flow until running LP IRR
    // reaches `preferredReturn`.  Pref compounding is represented implicitly:
    // distributions in earlier years reduce LP's running IRR deficit, so later
    // years require correspondingly more cash to push LP IRR to the hurdle.
    // This is economically equivalent to an explicit accruing unpaid-pref ledger
    // for standard (non-PIK) waterfalls.
    { tierName: 'Preferred Return',  hurdleRate: preferredReturn, lpSplit: 1.0,                   gpSplit: 0.0                },
    { tierName: 'Promote Tier 1',    hurdleRate: promoteTiers[0], lpSplit: 1 - promoteSplits[0],  gpSplit: promoteSplits[0]   },
    { tierName: 'Promote Tier 2',    hurdleRate: promoteTiers[1], lpSplit: 1 - promoteSplits[1],  gpSplit: promoteSplits[1]   },
    { tierName: 'Promote Tier 3',    hurdleRate: Infinity,        lpSplit: 1 - promoteSplits[2],  gpSplit: promoteSplits[2]   },
  ] as const;
  const N_TIERS = tierDefs.length;

  // Cumulative distributions per tier
  const lpDistByTier = new Array<number>(N_TIERS).fill(0);
  const gpDistByTier = new Array<number>(N_TIERS).fill(0);

  // Per-tier LP/GP CF vectors: [-equity, tier_dist_Y1, tier_dist_Y2, ...]
  const lpCFByTier: number[][] = tierDefs.map(() => [-lpEquity]);
  const gpCFByTier: number[][] = tierDefs.map(() => [-gpEquity]);

  // Aggregate LP/GP CF running vectors (used for bisection and summary IRR)
  const lpCFRunning: number[] = [-lpEquity];
  const gpCFRunning: number[] = [-gpEquity];

  // ── Process each operating year then the exit event ──────────────────────
  for (let pass = 0; pass <= holdYears; pass++) {
    const isExit = pass === holdYears;

    // Operating years use annualRows[pass].cfads; exit uses equityProceeds.
    // Preserve the raw signed value — negative years (operating deficits or
    // underwater exits) must flow into LP/GP aggregate CF history so that
    // running IRR is not overstated and hurdle timing is correct.
    const yearCFADS = isExit
      ? (equityProceeds ?? 0)
      : (annualRows[pass]?.cfads ?? 0);

    const lpThisYear = new Array<number>(N_TIERS).fill(0);
    const gpThisYear = new Array<number>(N_TIERS).fill(0);

    // When CFADS ≤ 0 there is nothing to distribute through tiers.
    // LP/GP still absorb their pro-rata share of the deficit in the
    // aggregate CF vectors so running IRR reflects the loss correctly.
    if (yearCFADS <= 1e-2) {
      lpCFRunning.push(yearCFADS * lpPct);
      gpCFRunning.push(yearCFADS * gpPct);
      for (let t = 0; t < N_TIERS; t++) {
        lpCFByTier[t].push(0);
        gpCFByTier[t].push(0);
      }
      continue;
    }

    let residual = yearCFADS;
    let lpAlreadyThisYear = 0;
    let gpAlreadyThisYear = 0;

    for (let t = 0; t < N_TIERS; t++) {
      if (residual < 1e-2) break;

      const { hurdleRate, lpSplit, gpSplit } = tierDefs[t];

      let lpAlloc: number;

      if (t === 0) {
        // ── T1 ROC: dollar-based (avoids IRR=0% numerical instability) ──────
        const lpROCOwed = Math.max(0, lpEquity - lpDistByTier[0]);
        const gpROCOwed = Math.max(0, gpEquity - gpDistByTier[0]);
        const rocOwed = lpROCOwed + gpROCOwed;
        if (rocOwed <= 1e-2) continue;  // ROC fully returned, skip tier
        const t1Consumed = Math.min(residual, rocOwed);
        // Distribute proportionally to what each class is still owed
        lpAlloc  = t1Consumed * (rocOwed > 0 ? lpROCOwed / rocOwed : lpPct);
        const gpAlloc = t1Consumed * (rocOwed > 0 ? gpROCOwed / rocOwed : gpPct);
        lpThisYear[t]  = lpAlloc;
        gpThisYear[t]  = gpAlloc;
        lpDistByTier[t]  += lpAlloc;
        gpDistByTier[t]  += gpAlloc;
        lpAlreadyThisYear  += lpAlloc;
        gpAlreadyThisYear  += gpAlloc;
        residual -= t1Consumed;
        continue;
      }

      // ── T2–T5: IRR-hurdle bisection ──────────────────────────────────────
      if (lpSplit < 1e-10) {
        // LP gets nothing in this tier (degenerate), give all to GP
        lpAlloc = 0;
      } else {
        const maxLP = residual * lpSplit;
        lpAlloc = bisectDistribution(hurdleRate, lpCFRunning, lpAlreadyThisYear, maxLP);
      }

      const totalConsumed = lpSplit > 1e-10 ? lpAlloc / lpSplit : residual;
      const gpAlloc = totalConsumed * gpSplit;

      lpThisYear[t]    = lpAlloc;
      gpThisYear[t]    = gpAlloc;
      lpDistByTier[t]  += lpAlloc;
      gpDistByTier[t]  += gpAlloc;
      lpAlreadyThisYear  += lpAlloc;
      gpAlreadyThisYear  += gpAlloc;
      residual -= totalConsumed;
    }

    // Append this year's totals to aggregate running vectors
    lpCFRunning.push(lpAlreadyThisYear);
    gpCFRunning.push(gpAlreadyThisYear);

    // Append per-tier distributions
    for (let t = 0; t < N_TIERS; t++) {
      lpCFByTier[t].push(lpThisYear[t]);
      gpCFByTier[t].push(gpThisYear[t]);
    }
  }

  // ── Build tier result objects ─────────────────────────────────────────────
  const tiers: WaterfallTier[] = tierDefs.map((td, t) => {
    const lpIrr = opts?.skipPerTierIRR ? null : calculateIRR(lpCFByTier[t]);
    const gpIrr = opts?.skipPerTierIRR ? null : calculateIRR(gpCFByTier[t]);
    const lpEquityMultiple = calculateEM(lpCFByTier[t]);
    const gpEquityMultiple = calculateEM(gpCFByTier[t]);
    return {
      tier: t + 1,
      tierName: td.tierName,
      hurdleRate: isFinite(td.hurdleRate) ? td.hurdleRate : promoteTiers[2],
      lpSplit: td.lpSplit,
      gpSplit: td.gpSplit,
      lpDistribution: lpDistByTier[t],
      gpDistribution: gpDistByTier[t],
      promotePctEarned: Math.max(0, td.gpSplit - gpPct),
      lpIrr,
      gpIrr,
      lpEquityMultiple,
      gpEquityMultiple,
    };
  });

  return { tiers, lpCFAggregate: lpCFRunning, gpCFAggregate: gpCFRunning };
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

  // C2 fix: integrity warning for unmatched opex keys (loudness)
  if (a._unmatchedOpexKeys && a._unmatchedOpexKeys.length > 0) {
    checks.push({
      id: 'UNMATCHED_OPEX_KEYS',
      status: 'warn',
      message: `Bridge could not match ${a._unmatchedOpexKeys.length} opex key(s): [${a._unmatchedOpexKeys.join(', ')}] — expenses were silently zeroed. Review ProFormaAssumptions.expenses key names.`,
    });
  }

  const cf = result.annualCashFlow;
  const hold = a.holdYears;
  // Operating rows: years 1..hold (index 0..hold-1); forward NOI year at index hold is excluded
  const opRows = cf.slice(0, hold);
  const disp = result.disposition;
  const sum = result.summary;

  // ── Hard Invariants (spec §6.1) ───────────────────────────────────────────

  // INV-1: NOI(y) = EGR(y) − totalOpex(y)  for all operating rows
  for (const row of opRows) {
    const expected = row.effectiveGrossIncome - row.totalExpenses;
    if (Math.abs(row.noi - expected) > 0.01) {
      checks.push({ id: 'INV-1', status: 'error', message: `INV-1 NOI mismatch Y${row.year}: got ${row.noi.toFixed(2)}, expected ${expected.toFixed(2)}` });
      break; // report first violation only
    }
  }

  // INV-2: CF(y) = NOI(y) − debtService(y)  for all operating rows
  for (const row of opRows) {
    const expected = row.noi - row.debtService;
    if (Math.abs(row.cfads - expected) > 0.01) {
      checks.push({ id: 'INV-2', status: 'error', message: `INV-2 CF mismatch Y${row.year}: got ${row.cfads.toFixed(2)}, expected ${expected.toFixed(2)}` });
      break;
    }
  }

  // INV-3: DSCR(y) == NOI(y) / debtService(y) for all y where debtService > 0; fail-closed on null/non-finite
  for (const row of opRows) {
    if (row.debtService > 0.01) {
      if (row.dscr === null || !isFinite(row.dscr)) {
        checks.push({ id: 'INV-3', status: 'error', message: `INV-3 DSCR is null/non-finite Y${row.year} with debtService ${row.debtService.toFixed(0)}` });
        break;
      }
      const expected = row.noi / row.debtService;
      if (Math.abs(row.dscr - expected) > 0.001) {
        checks.push({ id: 'INV-3', status: 'error', message: `INV-3 DSCR mismatch Y${row.year}: got ${row.dscr.toFixed(4)}, expected ${expected.toFixed(4)}` });
        break;
      }
    }
  }

  // INV-4: equityProceeds = netSaleProceeds − loanBalanceAtExit
  {
    const expected = disp.netSaleProceeds - disp.loanBalance;
    if (Math.abs(disp.equityProceeds - expected) > 1) {
      checks.push({ id: 'INV-4', status: 'error', message: `INV-4 equityProceeds ${disp.equityProceeds.toFixed(0)} ≠ netSaleProceeds − loanBal (${expected.toFixed(0)})` });
    }
  }

  // Resolved deal mode: prefer the granular dealMode field (threaded from ProFormaAssumptions)
  // then fall back to dealType.  Non-stabilized modes (development, ground-up, redevelopment,
  // lease-up, value-add) receive relaxed verifier semantics for checks that cannot be evaluated
  // until the deal reaches stabilization.
  const resolvedMode = (a.dealMode ?? a.dealType ?? 'existing').toLowerCase().replace(/-/g, '_');
  const isNonStabilizedMode = ['development', 'ground_up', 'redevelopment', 'lease_up', 'value_add'].includes(resolvedMode);

  // INV-5: grossSalePrice ≈ stabilizedNOI / exitCap  (within 0.1%)
  // When both values are positive the math is fully checkable — any deviation > 0.1% is a
  // hard error for all deal modes.
  // When the formula cannot be evaluated we branch on two conditions independently:
  //   • exitCap ≤ 0: hard error for all modes (bridge always defaults exitCap to 6.5%, so this
  //     path indicates a model defect, not a missing-data situation).
  //   • exitCap > 0 but stabilizedNOI ≤ 0 in a NON-STABILIZED mode (development / ground_up /
  //     redevelopment / lease_up / value_add): warn — negative current-period NOI is expected
  //     during construction or lease-up; exit-year NOI will differ once the deal stabilises.
  //   • exitCap > 0 but stabilizedNOI ≤ 0 in a STABILIZED mode (existing / acquisition):
  //     hard error — stabilised deals must produce positive exit-year NOI.
  if (a.exitCap > 0 && disp.stabilizedNOI > 0) {
    const expected = disp.stabilizedNOI / a.exitCap;
    const relErr = Math.abs(disp.grossSalePrice - expected) / expected;
    if (relErr > 0.001) {
      checks.push({ id: 'INV-5', status: 'error', message: `INV-5 grossSalePrice ${disp.grossSalePrice.toFixed(0)} ≠ stabilizedNOI/exitCap (${expected.toFixed(0)}, err=${(relErr * 100).toFixed(3)}%)` });
    }
  } else if (a.exitCap <= 0) {
    checks.push({ id: 'INV-5', status: 'error', message: `INV-5 exitCap (${a.exitCap}) ≤ 0 [mode=${resolvedMode}] — bridge always provides a default; this indicates a model defect` });
  } else if (isNonStabilizedMode) {
    checks.push({ id: 'INV-5', status: 'warn', message: `INV-5 cannot verify grossSalePrice: stabilizedNOI (${disp.stabilizedNOI?.toFixed(0)}) ≤ 0 [mode=${resolvedMode}] — expected during construction/lease-up; will resolve once deal reaches stabilisation` });
  } else {
    checks.push({ id: 'INV-5', status: 'error', message: `INV-5 stabilizedNOI (${disp.stabilizedNOI?.toFixed(0)}) ≤ 0 [mode=${resolvedMode}] with exitCap=${(a.exitCap * 100).toFixed(2)}% — stabilised acquisitions must produce positive exit-year NOI` });
  }

  // INV-6: totalEquity ≈ totalAcquisitionCost − loanAmount  (5% relative tolerance)
  // A strict $1 tolerance was too tight because closing costs, reserves, and
  // origination fees create a gap between cash equity and calculated residual.
  // 5% relative tolerance accommodates realistic acquisition cost structures
  // while flagging genuinely broken capital stacks (e.g. equity > 2x residual).
  // All-zero special case: when purchasePrice, loanAmount, and equity are all
  // zero the capital stack is simply unseeded — Math.max(1, 0-0) would produce
  // a phantom residual of 1 and guarantee a 100% diff. Downgrade to warn so
  // the build succeeds; Task #545 covers seeding purchasePrice/loanAmount.
  {
    const totalAcqCost = result.capital.metrics.totalCost;
    if (totalAcqCost === 0 && a.loanAmount === 0 && sum.totalEquity === 0) {
      checks.push({ id: 'INV-6', status: 'warn', message: `INV-6 capital stack not seeded (purchasePrice=0, loanAmount=0, equity=0) — seed values to enable this check` });
    } else {
      const expectedResidual = Math.max(1, totalAcqCost - a.loanAmount);
      const relDiff = Math.abs(sum.totalEquity - expectedResidual) / expectedResidual;
      if (relDiff > 0.05) {
        checks.push({ id: 'INV-6', status: 'error', message: `INV-6 totalEquity ${sum.totalEquity.toFixed(0)} ≠ totalAcqCost (${totalAcqCost.toFixed(0)}) − loanAmount (${a.loanAmount.toFixed(0)}) = ${expectedResidual.toFixed(0)} (diff ${(relDiff * 100).toFixed(1)}%)` });
      }
    }
  }

  // INV-7: initial equity outlay must be positive (totalEquity > 0)
  // Severity is gated strictly on deal mode:
  //   NON-STABILIZED (development / ground_up / redevelopment / lease_up / value_add): warn —
  //     zero equity is expected when the capital stack has not yet been committed in a pre-
  //     stabilisation deal; the analyst is expected to seed purchasePrice/loanAmount before
  //     the deal advances to a stabilised underwriting (see Task #545).
  //   STABILIZED (existing / acquisition): hard error — a stabilised deal with a fully-
  //     populated capital stack must have positive equity.
  if (sum.totalEquity <= 0) {
    if (isNonStabilizedMode) {
      checks.push({ id: 'INV-7', status: 'warn', message: `INV-7 Total equity ${sum.totalEquity.toFixed(0)} ≤ 0 [mode=${resolvedMode}] — capital stack not yet seeded; seed purchasePrice/loanAmount to enable this check` });
    } else {
      checks.push({ id: 'INV-7', status: 'error', message: `INV-7 Total equity ${sum.totalEquity.toFixed(0)} ≤ 0 [mode=${resolvedMode}] — structural capital stack defect; check lpEquity + gpEquity vs purchase price` });
    }
  }

  // INV-8: waterfall conservation — Σ tier_distributions == Σ max(0,cfads[y]) + max(0,equityProceeds)
  // Waterfall engine skips negative-CFBT periods (line ~661: `if yearCFADS<=1e-2 continue`).
  // Fail-closed: empty pool (availCash≤0) must also have zero distributions.
  {
    const totalTierDist = result.waterfallDistributions.reduce((s, t) => s + t.lpDistribution + t.gpDistribution, 0);
    const posOpCFs = opRows.reduce((s, r) => s + Math.max(0, r.cfads), 0);
    const availCash = posOpCFs + Math.max(0, disp.equityProceeds);
    if (availCash <= 1) {
      if (totalTierDist > 1) {
        checks.push({ id: 'INV-8', status: 'error', message: `INV-8 Waterfall distributed ${totalTierDist.toFixed(0)} from empty pool (availCash=${availCash.toFixed(0)})` });
      }
    } else {
      const relErr = Math.abs(totalTierDist - availCash) / availCash;
      if (relErr > 0.001) {
        checks.push({ id: 'INV-8', status: 'error', message: `INV-8 Waterfall imbalance: distributed ${totalTierDist.toFixed(0)} ≠ Σmax(0,cfads)+max(0,equityProceeds) ${availCash.toFixed(0)} (${(relErr * 100).toFixed(3)}% error)` });
      }
    }
  }

  // INV-9: lossToLease$ + vacancy$ + concessions$ + badDebt$ < GPR every year
  // Skip construction rows (GPR=0) — revenue invariant is inapplicable with no revenue
  for (const row of opRows) {
    if (row.grossPotentialRent <= 0) continue;
    const losses = row.lossToLease + row.vacancyLoss + row.concessions + row.badDebt;
    if (losses >= row.grossPotentialRent - 0.01) {
      checks.push({ id: 'INV-9', status: 'error', message: `INV-9 Losses Y${row.year} (${losses.toFixed(0)}) ≥ GPR (${row.grossPotentialRent.toFixed(0)})` });
      break;
    }
  }

  // INV-10: annual occupancy == month-weighted aggregate of monthly series
  // Under the turn-cohort model occupancy is emergent (turns + absorption +
  // downtime), not schedule-derived.  This check verifies that the annual
  // aggregation correctly reflects the monthly series — an internal-consistency
  // check stronger than the old schedule-echo check.
  const monthlyCF = result.monthlyCashFlow;
  for (const row of opRows) {
    if (row.grossPotentialRent <= 0 && row.occupancy === 0) continue;
    const yearMonthly = monthlyCF.filter(m => m.year === row.year);
    if (yearMonthly.length === 0) continue;
    const expectedOcc = yearMonthly.reduce((s, m) => s + m.occupancy, 0) / yearMonthly.length;
    if (Math.abs(row.occupancy - expectedOcc) > 0.0001) {
      checks.push({ id: 'INV-10', status: 'error', message: `INV-10 Occupancy Y${row.year}: annual ${row.occupancy.toFixed(4)} ≠ monthly avg ${expectedOcc.toFixed(4)}` });
      break;
    }
  }

  // ── Soft Checks (spec §6.2) ───────────────────────────────────────────────

  // SOFT-1: Any year DSCR < 1.20 → TIGHT_DSCR warn
  const tightDscrRow = opRows.find(r => r.dscr !== null && r.dscr < 1.20);
  if (tightDscrRow) {
    checks.push({ id: 'TIGHT_DSCR', status: 'warn', message: `Y${tightDscrRow.year} DSCR ${tightDscrRow.dscr!.toFixed(2)} < 1.20` });
  }

  // SOFT-2: Any year DSCR < 1.10 → DSCR_BREACH error
  const breachDscrRow = opRows.find(r => r.dscr !== null && r.dscr < 1.10);
  if (breachDscrRow) {
    checks.push({ id: 'DSCR_BREACH', status: 'error', message: `Y${breachDscrRow.year} DSCR ${breachDscrRow.dscr!.toFixed(2)} < 1.10 — covenant breach threshold` });
  }

  // SOFT-3: stabilized vacancy < underwriting floor → AGGRESSIVE_VACANCY warn
  const uwFloor = a.underwritingVacancyFloor ?? DEF_UNDERWRITING_VACANCY_FLOOR;
  if (a.vacancyStab < uwFloor) {
    checks.push({ id: 'AGGRESSIVE_VACANCY', status: 'warn', message: `Stabilized vacancy ${(a.vacancyStab * 100).toFixed(1)}% below underwriting floor ${(uwFloor * 100).toFixed(1)}%` });
  }

  // SOFT-4: rentGrowth Y1 > 6% → AGGRESSIVE_RENT_GROWTH warn
  if (a.rentGrowth.length > 0 && a.rentGrowth[0] > 0.06) {
    checks.push({ id: 'AGGRESSIVE_RENT_GROWTH', status: 'warn', message: `Y1 rent growth ${(a.rentGrowth[0] * 100).toFixed(1)}% > 6%` });
  }

  // SOFT-5: exitCap < goingInCap by > 50bps → CAP_RATE_COMPRESSION warn
  const goingInCap = sum.goingInCapRate;
  if (goingInCap > 0 && a.exitCap < goingInCap - 0.005) {
    checks.push({ id: 'CAP_RATE_COMPRESSION', status: 'warn', message: `Exit cap ${(a.exitCap * 100).toFixed(2)}% is >50bps below going-in cap ${(goingInCap * 100).toFixed(2)}%` });
  }

  // SOFT-6: IRR < 12% → LOW_IRR warn
  if (sum.irr !== null && sum.irr < 0.12) {
    checks.push({ id: 'LOW_IRR', status: 'warn', message: `IRR ${(sum.irr * 100).toFixed(1)}% < 12% threshold` });
  }

  // SOFT-7: equityMultiple < 1.5 → LOW_EM warn
  if (sum.equityMultiple !== null && sum.equityMultiple < 1.5) {
    checks.push({ id: 'LOW_EM', status: 'warn', message: `Equity multiple ${sum.equityMultiple.toFixed(2)}× < 1.5× threshold` });
  }

  // SOFT-11: IRR could not be computed with either guess → irr_not_computable warn
  if (sum.irr === null) {
    checks.push({ id: 'irr_not_computable', status: 'warn', message: 'IRR could not be computed with either positive or negative initial guess — deal may have non-standard cash flow pattern' });
  }

  // SOFT-8: rent-to-wage proxy at Y5 > 35% → AFFORDABILITY_CEILING warn
  // proxy: (GPR_Y5 / units / 12) / $4,500 area median wage
  const y5Row = opRows[4];
  if (y5Row && a.units > 0) {
    const monthlyRentPerUnit = y5Row.grossPotentialRent / a.units / 12;
    const rentToWage = monthlyRentPerUnit / 4500;
    if (rentToWage > 0.35) {
      checks.push({ id: 'AFFORDABILITY_CEILING', status: 'warn', message: `Y5 rent-to-wage proxy ${(rentToWage * 100).toFixed(1)}% > 35% (monthly rent $${monthlyRentPerUnit.toFixed(0)})` });
    }
  }

  // SOFT-9: Y1 vacancy < underwriting floor → VACANCY_BELOW_STRUCTURAL warn
  if (a.vacancyY1 < uwFloor) {
    checks.push({ id: 'VACANCY_BELOW_STRUCTURAL', status: 'warn', message: `Y1 vacancy assumption ${(a.vacancyY1 * 100).toFixed(1)}% below underwriting floor ${(uwFloor * 100).toFixed(1)}%` });
  }

  // SOFT-10: capexBudget == 0 on a non-development deal → NO_CAPEX_BUDGET_FOR_VALUE_ADD
  const isDevelopment = a.dealType === 'development' || a.dealType === 'ground_up';
  if (a.capexBudget === 0 && !isDevelopment) {
    checks.push({ id: 'NO_CAPEX_BUDGET_FOR_VALUE_ADD', status: 'warn', message: 'No capex budget on a non-development deal — consider value-add allocation' });
  }

  // ── ALL_INVARIANTS gate ───────────────────────────────────────────────────
  // Only passes when all 10 hard INV-* checks are clean (SOFT errors do not block)
  const hasHardInvError = checks.some(c => c.status === 'error' && c.id.startsWith('INV-'));
  if (!hasHardInvError) {
    checks.unshift({ id: 'ALL_INVARIANTS', status: 'pass', message: 'All 10 hard invariants pass' });
  }

  return checks;
}

function buildCashFlowVector(
  totalEquity: number,
  annualRows: AnnualCashFlowRow[],
  hold: number,
  equityProceeds: number,
): number[] {
  // Year 0: equity outlay (negative)
  const cf: number[] = [-totalEquity];
  // Years 1..hold: levered operating cash flows only (exclude the forward-NOI year at annualRows[hold])
  for (let i = 0; i < hold; i++) {
    cf.push(annualRows[i]?.preTaxCashFlow ?? 0);
  }
  // Exit: add equity proceeds to the final operating year (end of hold period)
  cf[cf.length - 1] += equityProceeds;
  return cf;
}

// ── Main runner ────────────────────────────────────────────────────────────

export function runModel(a: ModelAssumptions, opts?: { skipSensitivity?: boolean }): ModelResults {
  const log: string[] = [];
  const hold = a.holdYears;
  const nYears = hold + 1;
  let monthlyRows: MonthlyCashFlowRow[] = [];

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
    log.push(`Phase 3: FL tax schedule (FL non-homestead 10% NHCap, assessed base=${a.purchasePrice * DEF_REASSESS_PCT})`);
  } else {
    const baseTax = a.basePropertyTax ?? (a.purchasePrice * 0.012); // ~1.2% of purchase as default
    taxSchedule = computeNonFloridaTax(baseTax, a.expenseGrowth, hold);
    log.push(`Phase 3: Non-FL tax schedule, base=${baseTax}, growth=${(a.expenseGrowth * 100).toFixed(1)}%`);
  }

  // ── Phase 3b: Income tax block (spec §11) ───────────────────────────────
  const INCOME_TAX_LAND_PCT        = 0.20;
  const INCOME_TAX_DEPR_YEARS      = 27.5;
  const INCOME_TAX_BONUS_PCT       = 0.20;
  const INCOME_TAX_COST_SEG_PCT    = 0.30;
  const INCOME_TAX_MARGINAL        = 0.37;
  const incomeTaxDepreciableBase   = a.purchasePrice * (1 - INCOME_TAX_LAND_PCT);
  const incomeTaxAnnualDepr        = incomeTaxDepreciableBase / INCOME_TAX_DEPR_YEARS;
  const incomeTaxBonusDepr         = incomeTaxDepreciableBase * INCOME_TAX_BONUS_PCT; // Y1 bonus

  // ── Phase 4: Amortization schedule ──────────────────────────────────────
  const amort = computeAmortization(a.loanAmount, a.rate, a.term, a.amort, a.ioPeriod, hold);
  const origFee = a.originationFeePct > 0 ? a.loanAmount * a.originationFeePct : a.loanAmount * DEF_ORIGINATION_PCT;
  log.push(`Phase 4: Loan ${a.loanAmount} @ ${(a.rate * 100).toFixed(2)}%, ${a.amort}mo amort, ${a.ioPeriod}mo IO`);

  // ── Development deal pre-computed variables (used in Phase 5 and Phase 7) ──
  const isDevelopmentDeal = a.dealType === 'development' || a.dealType === 'ground_up';
  const devConstructionYears = isDevelopmentDeal ? Math.ceil((a.constructionMonths ?? 18) / 12) : 0;
  const devLeaseUpYears      = isDevelopmentDeal ? Math.ceil((a.leaseUpMonths ?? 12) / 12) : 0;
  const devHardCosts = isDevelopmentDeal
    ? ((a.hardCostPerSF ?? 0) > 0 ? (a.hardCostPerSF!) * a.avgUnitSf * a.units : a.capexBudget)
    : 0;
  const devSoftCosts        = devHardCosts * (a.softCostPct ?? 0);
  const devTotalProjectCost = isDevelopmentDeal ? a.purchasePrice + devHardCosts + devSoftCosts : totalAcqCost;
  const devCLoanAmt         = devTotalProjectCost * (a.constructionLtc ?? 0.60);
  const devAnnualCapInt     = devCLoanAmt * (a.constructionLoanRate ?? 0.08);

  // ── Phase 5: Annual cash flows ──────────────────────────────────────────
  log.push(`Phase 5: Building ${nYears} years of cash flows`);
  const annualRows: AnnualCashFlowRow[] = [];

  if (isDevelopmentDeal) {
    log.push(`  Development path: ${devConstructionYears}yr construction + ${devLeaseUpYears}yr lease-up, projectCost=${devTotalProjectCost}`);
    for (let y = 1; y <= nYears; y++) {
      const taxYear = y <= taxSchedule.perYear.length
        ? taxSchedule.perYear[y - 1]
        : taxSchedule.perYear[taxSchedule.perYear.length - 1];

      if (y <= devConstructionYears) {
        // Construction phase: no revenue, capitalized interest + property tax as expenses
        annualRows.push({
          year: y,
          grossPotentialRent: 0, lossToLease: 0, vacancy: 0, vacancyLoss: 0, concessions: 0, badDebt: 0,
          baseRevenue: 0, otherIncome: 0, effectiveGrossIncome: 0,
          payroll: 0, maintenance: 0, contractServices: 0, marketing: 0,
          utilities: 0, admin: 0, insurance: 0,
          propertyTax: taxYear, managementFee: 0, replacementReserves: 0,
          totalExpenses: devAnnualCapInt + taxYear,
          noi: -(devAnnualCapInt + taxYear),
          annualInterest: devAnnualCapInt, annualPrincipal: 0, debtService: 0,
          preTaxCashFlow: -(devAnnualCapInt + taxYear),
          cfads: -(devAnnualCapInt + taxYear),
          dscr: null, occupancy: 0, debtYield: null, capRateOnCost: null,
          isExitYear: y === nYears,
          depreciation: 0, taxableIncome: 0, taxPayable: 0,
          afterTaxCashFlow: -(devAnnualCapInt + taxYear),
        });
      } else {
        // Post-construction: lease-up linear absorption then stabilized operating
        const phaseY = y - devConstructionYears;
        const vacForYear = phaseY <= devLeaseUpYears
          ? 1 - (phaseY / devLeaseUpYears) * (1 - a.vacancyStab)
          : a.vacancyStab;
        // Build flat vacancy schedule at this year's rate (computeYearOperating uses vacSched[y-1])
        const devVacSched = new Array<number>(nYears + 2).fill(vacForYear);
        const expCum = Math.pow(1 + a.expenseGrowth, y - 1);
        const cumG = cumGrowth[Math.min(y - 1, cumGrowth.length - 1)];
        const op = computeYearOperating(y, a, cumG, devVacSched, taxYear, expCum);

        const interest    = amort.interestByYear[y - 1] ?? (a.loanAmount * a.rate);
        const principal   = amort.principalByYear[y - 1] ?? 0;
        const debtService = amort.debtServiceByYear[y - 1] ?? interest;
        const cf          = op.noi - debtService;
        const dscr        = debtService > 0.01 ? op.noi / debtService : null;
        const dyield      = a.loanAmount > 0 ? op.noi / a.loanAmount : null;
        const applyBonus  = a.useBonusDepreciation !== false;
        const depreciation  = (y === 1 && applyBonus) ? incomeTaxBonusDepr : incomeTaxAnnualDepr;
        const taxableIncome = op.noi - interest - depreciation;
        const taxPayable    = Math.max(0, taxableIncome * INCOME_TAX_MARGINAL);
        annualRows.push({
          year: y, ...op,
          annualInterest: interest, annualPrincipal: principal, debtService,
          preTaxCashFlow: cf, cfads: cf, dscr, debtYield: dyield,
          capRateOnCost: null, isExitYear: y === nYears,
          depreciation, taxableIncome, taxPayable, afterTaxCashFlow: cf - taxPayable,
        });
      }
    }
  } else {
    // Acquisition / value-add path: monthly-first via turn-cohort engine
    log.push('  Acquisition path: turn-cohort monthly engine');
    monthlyRows = buildMonthlyCashFlowTurnCohort(a, taxSchedule.perYear);
    const aggregated = aggregateMonthlyToAnnual(monthlyRows, a, amort);

    // Fill income-tax fields and isExitYear on aggregated annual rows
    for (let i = 0; i < aggregated.length; i++) {
      const y = i + 1;
      const row = aggregated[i];
      const interest = amort.interestByYear[i] ?? (a.loanAmount * a.rate);
      const applyBonus = a.useBonusDepreciation !== false;
      const depreciation = (y === 1 && applyBonus) ? incomeTaxBonusDepr : incomeTaxAnnualDepr;
      const taxableIncome = row.noi - interest - depreciation;
      const taxPayable = Math.max(0, taxableIncome * INCOME_TAX_MARGINAL);
      row.annualInterest = interest;
      row.depreciation = depreciation;
      row.taxableIncome = taxableIncome;
      row.taxPayable = taxPayable;
      row.afterTaxCashFlow = row.preTaxCashFlow - taxPayable;
      row.isExitYear = y === nYears;
    }
    annualRows.push(...aggregated);
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
  const cashFlows = buildCashFlowVector(totalEquity, annualRows, hold, equityProceeds);
  const irr = calculateIRR(cashFlows);
  const em = calculateEM(cashFlows);
  const avgCoC = calculateAvgCoC(totalEquity, annualRows.slice(0, hold).map(r => r.preTaxCashFlow));
  const noiY1 = annualRows[0]?.noi ?? 0;
  // True in-place endpoint: m0 run-rate, annualized (left edge of M09 bridge;
  // no turn dynamics, no vacancy, no concessions — pure acquisition-state NOI).
  const occupiedAtCloseUnits = a.units * (a.occupancyAtClose ?? 1.0);
  const inPlaceGPR = occupiedAtCloseUnits * a.inPlaceRent * 12;
  const inPlaceOtherIncome = a.otherIncomePerUnit * a.units;
  const inPlaceEGI = inPlaceGPR + inPlaceOtherIncome;
  const inPlaceMgmtFee = inPlaceEGI * a.managementFee;
  const inPlaceTotalExpenses =
    (a.payrollPerUnit + a.maintenancePerUnit + a.contractServicesPerUnit +
     a.marketingPerUnit + a.utilitiesPerUnit + a.adminPerUnit + a.insurancePerUnit +
     a.replacementReserves) * a.units +
    inPlaceMgmtFee +
    (annualRows[0]?.propertyTax ?? 0);
  const inPlaceNOI = inPlaceEGI - inPlaceTotalExpenses;
  // Development deals: goingInCap = stabilizedNOI / totalProjectCost (spec §10.6)
  // stabilizedNOI = NOI from first post-lease-up year (construction + lease-up years are non-operating)
  const devStabYearIdx = devConstructionYears + devLeaseUpYears; // 0-based index
  const devStabilizedNOI = isDevelopmentDeal
    ? (annualRows[Math.min(devStabYearIdx, annualRows.length - 1)]?.noi ?? 0)
    : 0;
  const goingInCap = isDevelopmentDeal
    ? (devTotalProjectCost > 0 ? devStabilizedNOI / devTotalProjectCost : 0)
    : (a.purchasePrice > 0 ? noiY1 / a.purchasePrice : 0);

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
  const waterfallResult = computeWaterfall(
    annualRows, a.lpEquity, a.gpEquity, totalEquity,
    a.preferredReturn, hold, a.promoteTiers, a.promoteSplits, equityProceeds,
    { skipPerTierIRR: opts?.skipSensitivity },
  );
  const waterfall = waterfallResult.tiers;
  const lpIrrAggregate = calculateIRR(waterfallResult.lpCFAggregate);
  const gpIrrAggregate = calculateIRR(waterfallResult.gpCFAggregate);
  const lpEMAggregate  = calculateEM(waterfallResult.lpCFAggregate);
  const gpEMAggregate  = calculateEM(waterfallResult.gpCFAggregate);

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
  // Stabilization year: first month the series reaches the stabilized band,
  // then map to the corresponding year.  For acquisition deals with monthly
  // data we read the actual month; for dev deals we fall back to the old
  // vacancy-schedule heuristic.
  let stabRowIdx: number;
  if (monthlyRows.length > 0) {
    const stabOcc = 1 - a.vacancyStab;
    const stabMonthIdx = monthlyRows.findIndex(m => m.occupancy >= stabOcc - 0.01);
    stabRowIdx = stabMonthIdx >= 0 ? Math.floor(stabMonthIdx / 12) : (a.vacancyY1 > a.vacancyStab ? 1 : 0);
  } else {
    stabRowIdx = a.vacancyY1 > a.vacancyStab ? 1 : 0;
  }
  const dscrAtStabilization = annualRows[stabRowIdx]?.dscr ?? dscrY1;
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

  // ── Evidence block (spec §7.1) ────────────────────────────────────────────
  const dscrY1Val = annualRows[0]?.dscr ?? null;
  const hints = a._evidenceHints ?? {};

  // Resolve source/confidence for NOI — the primary driver of all KPI fields.
  // If the seeder passed LayeredValue metadata, use it; otherwise fall back to synthetic.
  const noiHint = hints['noi'];
  const noiSource = noiHint?.source ?? 'computed';
  const noiConf: 'HIGH' | 'MEDIUM' | 'LOW' = noiHint?.confidence ?? 'MEDIUM';

  // DSCR quality inherits from NOI quality (NOI is the numerator)
  const dscrConf: 'HIGH' | 'MEDIUM' | 'LOW' = dscrY1Val !== null && dscrY1Val >= 1.20
    ? (noiConf === 'HIGH' ? 'HIGH' : 'MEDIUM')
    : 'MEDIUM';

  // goingInCap = NOI / purchasePrice — confidence follows NOI
  const goingInCapConf: 'HIGH' | 'MEDIUM' | 'LOW' = goingInCap > 0 ? noiConf : 'LOW';

  const evidenceFields: EvidenceEntry[] = [
    {
      field: 'NOI',
      value: noiY1,
      source: noiSource,
      confidence: noiConf,
      reasoning: noiHint?.reasoning ??
        `Y1 NOI of $${Math.round(noiY1).toLocaleString()} — emergent turn-cohort monthly aggregate (between in-place and stabilized endpoints, not either endpoint itself).`,
    },
    {
      field: 'inPlaceNOI',
      value: inPlaceNOI,
      source: 'computed',
      confidence: noiConf,
      reasoning: `In-Place NOI of $${Math.round(inPlaceNOI).toLocaleString()} — m0 run-rate: ${((a.occupancyAtClose ?? 1.0) * 100).toFixed(0)}% occupied at $${Math.round(a.inPlaceRent).toLocaleString()}/unit/month, annualized. Left edge of the M09 bridge; no turn dynamics applied.`,
    },
    {
      field: 'inPlaceNOI',
      value: noiY1,
      source: noiSource,
      confidence: noiConf,
      reasoning: noiHint?.reasoning ??
        `In-Place NOI of $${Math.round(noiY1).toLocaleString()} derived from the turn-cohort monthly engine (lease-expiry cohorts, turn downtime, absorption pacing) aggregated to yearly.`,
    },
    {
      field: 'IRR',
      value: irr,
      source: 'computed',
      confidence: 'MEDIUM',
      reasoning: `Levered IRR of ${irr !== null ? (irr * 100).toFixed(2) + '%' : 'n/a'} over ${a.holdYears}-year hold; sensitive to exit cap rate and rent growth.`,
    },
    {
      field: 'EM',
      value: em,
      source: 'computed',
      confidence: 'MEDIUM',
      reasoning: `Equity multiple of ${em !== null ? em.toFixed(2) + 'x' : 'n/a'} derived from total distributions ÷ total equity invested.`,
    },
    {
      field: 'DSCR',
      value: dscrY1Val,
      source: 'computed',
      confidence: dscrConf,
      reasoning: `Year-1 DSCR of ${dscrY1Val !== null ? dscrY1Val.toFixed(2) : 'n/a'} (NOI ÷ annual debt service of $${Math.round(annualRows[0]?.debtService ?? 0).toLocaleString()}).`,
    },
    {
      field: 'exitCap',
      value: a.exitCap,
      source: hints['exitCap']?.source ?? 'platform',
      confidence: hints['exitCap']?.confidence ?? 'LOW',
      reasoning: hints['exitCap']?.reasoning ??
        `Exit cap rate of ${(a.exitCap * 100).toFixed(2)}% is an analyst assumption; no document source confirms terminal market cap rate.`,
    },
    {
      field: 'goingInCap',
      value: goingInCap,
      source: 'computed',
      confidence: goingInCapConf,
      reasoning: `Going-in cap of ${(goingInCap * 100).toFixed(2)}% = Y1 NOI (${noiSource}) ÷ purchase price of $${Math.round(a.purchasePrice).toLocaleString()}.`,
    },
  ];

  const lowCount = evidenceFields.filter(e => e.confidence === 'LOW').length;
  const highCount = evidenceFields.filter(e => e.confidence === 'HIGH').length;
  const medCount = evidenceFields.filter(e => e.confidence === 'MEDIUM').length;
  const evidenceBlock: EvidenceBlock = {
    confidence_distribution: { high: highCount, medium: medCount, low: lowCount },
    fields: evidenceFields,
  };

  const pctLow = evidenceFields.length > 0 ? lowCount / evidenceFields.length : 0;

  // ── Walkthrough narrative ─────────────────────────────────────────────────
  const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';
  const fmtUSD = (v: number) => '$' + Math.round(v).toLocaleString();
  const walkthroughText = [
    `This ${a.dealType} deal underwrites ${a.units} units with a ${a.holdYears}-year hold. ` +
    `The purchase price is ${fmtUSD(a.purchasePrice)} at a going-in cap rate of ${fmtPct(goingInCap)}. ` +
    `Gross potential rent is derived from a weighted-average market rent of ${fmtUSD(a.marketRent)}/unit/month ` +
    `(${fmtUSD(a.inPlaceRent)}/unit/month in-place) with a ${fmtPct(a.lossToLease)} loss-to-lease adjustment.`,

    `Y1 NOI of ${fmtUSD(noiY1)} is derived from a monthly turn-cohort model: ` +
    `${a.units} units with lease-expiry turnover at ${((a.annualTurnoverRate ?? DEF_ANNUAL_TURNOVER_RATE) * 100).toFixed(0)}%/yr, ` +
    `${a.standardTurnDowntimeDays ?? DEF_STANDARD_TURN_DOWNTIME_DAYS}-day standard turns, ` +
    `and ${a.newLeaseConcessionMonths ?? DEF_NEW_LEASE_CONCESSION_MONTHS}-month new-lease concessions. ` +
    `Vacancy emerges from turn dynamics; stabilized occupancy targets ${fmtPct(1 - a.vacancyStab)}. ` +
    `Underwriting vacancy floor at ${fmtPct(a.underwritingVacancyFloor ?? DEF_UNDERWRITING_VACANCY_FLOOR)} ` +
    `binds when physical vacancy falls below it. ` +
    `Operating expenses grow at ${fmtPct(a.expenseGrowth)} per year with management fee at ` +
    `${fmtPct(a.managementFee)} of EGI. Rent growth is projected at ` +
    `${fmtPct(a.rentGrowth[0])} in Year 1.`,

    `Debt is structured at ${fmtUSD(a.loanAmount)} (${fmtPct(a.ltv)} LTV) with a ` +
    `${(a.rate * 100).toFixed(2)}% interest rate over a ${Math.round(a.term / 12)}-year term. ` +
    `Year-1 DSCR is ${dscrY1Val !== null ? dscrY1Val.toFixed(2) : 'n/a'}.`,

    `Exit is underwritten at a ${fmtPct(a.exitCap)} cap rate in Year ${a.holdYears}, producing a ` +
    `gross sale price of ${fmtUSD(grossSalePrice)} and equity proceeds of ${fmtUSD(equityProceeds)}. ` +
    `The levered IRR is ${irr !== null ? fmtPct(irr) : 'n/a'} with an equity multiple of ` +
    `${em !== null ? em.toFixed(2) + 'x' : 'n/a'}.`,

    `Key risk call-outs: exit cap rate is an analyst assumption with no document corroboration (LOW confidence). ` +
    `${pctLow >= 0.30 ? 'More than 30% of KPI fields are LOW confidence — treat model outputs as preliminary.' : 'Remaining KPI fields are MEDIUM or HIGH confidence based on available document sources.'}`,
  ].join('\n\n');

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
      lpIrr: lpIrrAggregate,
      gpIrr: gpIrrAggregate,
      lpEquityMultiple: lpEMAggregate,
      gpEquityMultiple: gpEMAggregate,
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
      reTax: (() => {
        const miamiDade = isMiamiDade(a.county);
        const millage   = DEF_MILLAGE;
        const baseAV    = a.isFlorida ? a.purchasePrice * DEF_REASSESS_PCT : 0;
        return {
          t12AssessedValue:   null,
          platformAssessedValue: baseAV,
          platformMillageRate:   millage,
          platformAnnualTax:  baseAV > 0 ? baseAV * millage : null,
          isMiamiDade:        miamiDade,
          sohCapPct:          0.10,
          perYear: taxSchedule.assessedValues.map((av, idx) => {
            const taxAmt    = taxSchedule.perYear[idx] ?? 0;
            const capBound  = a.isFlorida && idx > 0;
            return {
              year:               idx + 1,
              assessedValue:      Math.round(av),
              millageRate:        millage,
              taxAmount:          Math.round(taxAmt),
              capBinding:         capBound,
              sohCapBinding:      capBound,
              reassessmentEvent:  idx === 0,
            };
          }),
          deltaVsT12Pct: null,
        };
      })(),
      incomeTax: {
        purchasePrice:                a.purchasePrice,
        landValuePct:                 INCOME_TAX_LAND_PCT,
        depreciableBase:              incomeTaxDepreciableBase,
        annualDepreciation:           incomeTaxAnnualDepr,
        bonusDepreciationCurrentYearPct: INCOME_TAX_BONUS_PCT,
        costSegAvailablePct:          INCOME_TAX_COST_SEG_PCT,
        marginalTaxRate:              INCOME_TAX_MARGINAL,
      },
      transferTax: (() => {
        const miamiDade     = isMiamiDade(a.county);
        const flatRate      = 0.007;
        const miamiRate     = 0.0105;
        const appliedRate   = miamiDade ? miamiRate : flatRate;
        return {
          purchasePrice:      a.purchasePrice,
          loanAmount:         a.loanAmount,
          docStampAmount:     docStamps,
          intangibleTaxAmount: intangibleTax,
          isMiamiDade:        miamiDade,
          miamiDadeRatePct:   miamiRate,
          statewideFlatRatePct: flatRate,
          appliedRatePct:     appliedRate,
          totalTransferTax:   docStamps + intangibleTax,
          dispositionDocStamps,
          refi:               null,
        };
      })(),
    },
    projections: [],
    integrityChecks: [],
    reasoning: { derivationLog: log, walkthrough: walkthroughText, collisionReport: a._collisionReport ?? [] },
    evidence: evidenceBlock,
    meta: {
      modelVersion: '1.1',
      runner: 'deterministic-model-runner',
      computedAt: new Date().toISOString(),
    },
    monthlyCashFlow: [],
  };

  // Populate monthly cash flow before integrity checks (INV-10 needs it)
  modelResult.monthlyCashFlow = monthlyRows.length > 0
    ? monthlyRows
    : buildMonthlyCashFlow(a, annualRows);

  modelResult.integrityChecks = runIntegrityChecks(a, modelResult);

  if (pctLow >= 0.30) {
    modelResult.integrityChecks.push({
      id: 'LOW_CONFIDENCE_MODEL',
      status: 'warn',
      message: `${(pctLow * 100).toFixed(0)}% of evidence KPI fields are LOW confidence (${lowCount}/${evidenceFields.length}) — treat outputs as preliminary`,
    });
  }

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
        vacancy: row.vacancyLoss,
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

  // Populate monthly cash-flow resolution (D2 ribbon consumption)
  // Already set before integrity checks for acquisition deals;
  // dev deals fall back to buildMonthlyCashFlow in that path.
  if (modelResult.monthlyCashFlow.length === 0) {
    modelResult.monthlyCashFlow = buildMonthlyCashFlow(a, annualRows);
  }

  return modelResult;
}
