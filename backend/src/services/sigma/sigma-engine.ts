// ─────────────────────────────────────────────────────────────────────────────
// M36 JOINT DISTRIBUTION ENGINE — Pure Math Functions (Phase A)
// ─────────────────────────────────────────────────────────────────────────────
//
// These functions have no HTTP/DB side effects. They are the shared core used
// by both the HTTP routes (sigma.routes.ts) and the CashflowAgent tools.
//
// Phase A uses a diagonal Σ (no cross-correlations) with hardcoded priors.
// Phase B will replace with empirical estimation.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssumptionVector {
  [key: string]: number;
}

export interface DebtBundle {
  id: string;
  name: string;
  ltv: number;
  rate: number;
  ioPeriod: number;
  amortYears: number;
  upFrontBps: number;
  minDscr: number;
  description: string;
}

export interface VariableMeta {
  unit: string;
  min: number;
  max: number;
  prior: number;
  std: number;
}

export interface PlausibilityResult {
  dScore: number;
  band: string;
  contributions: { [key: string]: number };
  topContributors: { variable: string; contribution: number }[];
}

export interface SolverIteration {
  assumptions: AssumptionVector;
  irr: number;
  dScore: number;
}

export interface BundleResult {
  bundle: DebtBundle;
  baseIrR: number;
  achievedIrR: number;
  dScore: number;
  band: string;
  assumptions: AssumptionVector;
  contributions: { [key: string]: number };
  changedVars: { key: string; before: number; after: number }[];
  narrative: string;
}

export interface GoalSeekResult {
  targetIrR: number;
  holdYears: number;
  currentIrRMap: { bundle: string; baseIrR: number }[];
  results: BundleResult[];
  recommendation: BundleResult | null;
  bundlesEvaluated: { id: string; name: string }[];
}

export interface SolverConstraints {
  lockedVariables?: string[];
  bundleFilter?: string[];
  maxDScore?: number;
}

// ─── Variable Definitions ────────────────────────────────────────────────────

export const VARIABLE_META: { [key: string]: VariableMeta } = {
  purchasePrice:            { unit: '$',      min: 500000,    max: 50000000, prior: 5000000,  std: 3000000 },
  pricePerUnit:             { unit: '$/u',    min: 50000,     max: 500000,   prior: 150000,   std: 65000 },
  goingInCapRate:           { unit: '%',      min: 0.03,      max: 0.12,     prior: 0.065,    std: 0.02 },
  rentGrowthY1:             { unit: '%',      min: -0.02,     max: 0.10,     prior: 0.03,     std: 0.015 },
  rentGrowthStabilized:     { unit: '%',      min: 0.0,       max: 0.08,     prior: 0.025,    std: 0.012 },
  vacancyAtStabilization:   { unit: '%',      min: 0.02,      max: 0.15,     prior: 0.07,     std: 0.025 },
  lossToLeasePct:           { unit: '%',      min: 0.0,       max: 0.08,     prior: 0.03,     std: 0.015 },
  concessionsPct:            { unit: '%',     min: 0.0,       max: 0.06,     prior: 0.02,     std: 0.01 },
  otherIncomePerUnit:       { unit: '$/u/y',  min: 100,       max: 2000,     prior: 500,      std: 400 },
  opexPerUnit:              { unit: '$/u/y',  min: 3000,      max: 15000,    prior: 7000,     std: 2500 },
  expenseGrowthRate:        { unit: '%',      min: 0.01,      max: 0.06,     prior: 0.03,     std: 0.01 },
  propertyTaxPctOfRevenue:  { unit: '%',      min: 0.08,      max: 0.25,     prior: 0.14,     std: 0.035 },
  insurancePerUnit:         { unit: '$/u/y',  min: 200,       max: 1500,     prior: 600,      std: 300 },
  managementFeePct:         { unit: '%',      min: 0.03,      max: 0.08,     prior: 0.05,     std: 0.01 },
  replacementReservesPerUnit:{unit:'$/u/y',   min: 150,       max: 500,      prior: 300,      std: 100 },
  capexPerUnitYr1:          { unit: '$/u/y',  min: 0,         max: 5000,     prior: 1000,     std: 1000 },
  loanAmount:               { unit: '$',      min: 0,         max: 40000000, prior: 3000000,  std: 2000000 },
  interestRate:            { unit: '%',      min: 0.04,      max: 0.10,     prior: 0.07,     std: 0.01 },
  ltv:                      { unit: '%',      min: 0.50,      max: 0.85,     prior: 0.70,     std: 0.08 },
  ioPeriodYears:            { unit: 'years',  min: 0,         max: 10,       prior: 3,        std: 2 },
  amortYears:               { unit: 'years',  min: 20,        max: 35,       prior: 30,       std: 5 },
  upfrontCostsPctOfLoan:    { unit: '%',      min: 0.005,     max: 0.03,     prior: 0.015,    std: 0.006 },
  exitCapRate:              { unit: '%',      min: 0.04,      max: 0.12,     prior: 0.0625,   std: 0.012 },
  exitSellingCostsPct:      { unit: '%',      min: 0.01,      max: 0.04,     prior: 0.02,     std: 0.005 },
  holdYears:                { unit: 'years',  min: 3,         max: 10,       prior: 5,        std: 1.5 },
  renovationCostPerUnit:    { unit: '$/u',    min: 0,         max: 150000,   prior: 15000,    std: 20000 },
  premiumDecayBps:          { unit: 'bps/y',  min: 0,         max: 500,      prior: 200,      std: 100 },
  leaseUpMonths:            { unit: 'months', min: 3,         max: 36,       prior: 12,       std: 6 },
  totalUnits:               { unit: 'int',    min: 5,         max: 500,      prior: 80,       std: 60 },
  sfPerUnit:                { unit: 'sf',     min: 500,       max: 2500,     prior: 1000,     std: 300 },
  yearBuilt:                { unit: 'year',   min: 1950,      max: 2025,     prior: 2000,     std: 20 },
};

// ─── Debt Bundles ────────────────────────────────────────────────────────────

export const DEBT_BUNDLES: DebtBundle[] = [
  {
    id: 'hud_221d4',
    name: 'HUD 221(d)(4)',
    ltv: 0.83,
    rate: 0.05,
    ioPeriod: 2,
    amortYears: 35,
    upFrontBps: 100,
    minDscr: 1.11,
    description: 'Best leverage (83% LTV). Lowest rate (5.00%). 35-yr amort. Slow closing (6-9mo). Requires rehabilitation scope.',
  },
  {
    id: 'agency_fixed',
    name: 'Agency Fixed (Fannie/Freddie)',
    ltv: 0.75,
    rate: 0.0575,
    ioPeriod: 5,
    amortYears: 30,
    upFrontBps: 50,
    minDscr: 1.25,
    description: 'Moderate leverage (75% LTV). Competitive fixed rate (5.75%). 5yr IO. 30-60 day close.',
  },
  {
    id: 'agency_floating',
    name: 'Agency Floating (SOFR +)',
    ltv: 0.75,
    rate: 0.065,
    ioPeriod: 5,
    amortYears: 30,
    upFrontBps: 25,
    minDscr: 1.25,
    description: 'Same leverage as fixed. Floating rate (SOFR + 180-220bps). 5yr IO. Rate hedge optional.',
  },
  {
    id: 'bridge',
    name: 'Bridge / Transitional',
    ltv: 0.70,
    rate: 0.075,
    ioPeriod: 3,
    amortYears: 30,
    upFrontBps: 150,
    minDscr: 1.20,
    description: 'Lower leverage (70% LTV). Higher rate (7.50%). 3yr IO. Fast close (2-4 weeks).',
  },
  {
    id: 'cmbs',
    name: 'CMBS Fixed',
    ltv: 0.70,
    rate: 0.065,
    ioPeriod: 0,
    amortYears: 30,
    upFrontBps: 75,
    minDscr: 1.25,
    description: 'Moderate leverage (70% LTV). Fixed rate (6.50%). Fully amortizing. 10yr term.',
  },
];

// ─── Plausibility: Mahalanobis Distance ─────────────────────────────────────

export function computePlausibility(assumptions: AssumptionVector): PlausibilityResult {
  let dSquared = 0;
  const contributions: { [key: string]: number } = {};

  for (const [key, value] of Object.entries(assumptions)) {
    const meta = VARIABLE_META[key];
    if (!meta) continue;
    const dev = (value - meta.prior) / meta.std;
    const contrib = dev * dev;
    contributions[key] = contrib;
    dSquared += contrib;
  }

  const dScore = Math.sqrt(dSquared);

  let band: string;
  if (dScore <= 1.0) band = 'Realistic';
  else if (dScore <= 1.5) band = 'Stretch';
  else if (dScore <= 2.0) band = 'Aggressive';
  else if (dScore <= 3.0) band = 'Heroic';
  else band = 'Unrealistic';

  const topContributors = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => ({ variable: k, contribution: parseFloat(v.toFixed(3)) }));

  return { dScore, band, contributions, topContributors };
}

// ─── Simplified IRR ─────────────────────────────────────────────────────────

function npv(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

export function computeIrR(cashFlows: number[], guessLow = 0.05, guessHigh = 0.30, tolerance = 0.0001): number {
  let low = guessLow;
  let high = guessHigh;
  let mid = (low + high) / 2;

  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const n = npv(mid, cashFlows);
    if (Math.abs(n) < tolerance) return mid;
    if (n > 0) low = mid;
    else high = mid;
  }
  return mid;
}

/**
 * Simplified IRR for Phase A — replaced by real cashflow model in later phases.
 * Computes LP IRR from a handfull of key inputs and a debt bundle.
 */
export function computeSimplifiedIrR(
  assumptions: AssumptionVector,
  bundle: DebtBundle
): number {
  const pp = assumptions.purchasePrice || 5000000;
  const rentGrowth = assumptions.rentGrowthStabilized || 0.025;
  const exitCap = assumptions.exitCapRate || assumptions.goingInCapRate || 0.065;
  const holdYears = Math.round(assumptions.holdYears || 5);
  const capRate = assumptions.goingInCapRate || 0.065;

  const stabilizedNoi = pp * capRate;
  const loanAmount = pp * bundle.ltv;
  const equity = pp - loanAmount;

  // Monthly payment
  const monthlyRate = bundle.rate / 12;
  const nPayments = (bundle.amortYears || 30) * 12;
  const payment = nPayments > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
    : loanAmount * bundle.rate;
  const annualPayment = payment * 12;

  // Cash flows
  const cashFlows: number[] = [];
  for (let y = 1; y <= holdYears; y++) {
    const rentFactor = Math.pow(1 + rentGrowth, y - 1);
    const cfBeforeDebt = stabilizedNoi * rentFactor;
    const cf = cfBeforeDebt - annualPayment;
    cashFlows.push(cf);
  }

  // Exit proceeds
  const exitNoi = stabilizedNoi * Math.pow(1 + rentGrowth, holdYears);
  const exitValue = exitNoi / exitCap;
  const remainingLoan = loanAmount; // simplified: no amort in IO period
  const sellingCosts = exitValue * (assumptions.exitSellingCostsPct || 0.02);
  const netEquity = exitValue - remainingLoan - sellingCosts;
  cashFlows[holdYears - 1] += netEquity;
  cashFlows.unshift(-equity);

  return computeIrR(cashFlows, 0.05, 0.30);
}

// ─── Goal-Seeking Solver ─────────────────────────────────────────────────────

interface LeverDef {
  key: string;
  step: number;
  min: number;
  max: number;
}

const LEVERS: LeverDef[] = [
  { key: 'exitCapRate', step: 0.0025, min: 0.04, max: 0.10 },
  { key: 'rentGrowthStabilized', step: 0.005, min: -0.01, max: 0.08 },
  { key: 'vacancyAtStabilization', step: 0.01, min: 0.02, max: 0.15 },
  { key: 'expenseGrowthRate', step: 0.0025, min: 0.01, max: 0.06 },
  { key: 'lossToLeasePct', step: 0.005, min: 0, max: 0.08 },
  { key: 'concessionsPct', step: 0.005, min: 0, max: 0.06 },
  { key: 'opexPerUnit', step: 500, min: 3000, max: 15000 },
  { key: 'goingInCapRate', step: 0.0025, min: 0.04, max: 0.10 },
];

function fillAssumptions(base: AssumptionVector): AssumptionVector {
  const filled: AssumptionVector = { ...base };
  for (const [key, meta] of Object.entries(VARIABLE_META)) {
    if (filled[key] == null) filled[key] = meta.prior;
  }
  return filled;
}

function buildBundleAssumptions(base: AssumptionVector, bundle: DebtBundle): AssumptionVector {
  return {
    ...base,
    ltv: bundle.ltv,
    interestRate: bundle.rate,
    ioPeriodYears: bundle.ioPeriod,
    amortYears: bundle.amortYears,
    upfrontCostsPctOfLoan: bundle.upFrontBps / 10000,
  };
}

function computeDeltaNarrative(bestAssumptions: AssumptionVector, baseline: AssumptionVector): { key: string; before: number; after: number }[] {
  const changes: { key: string; before: number; after: number }[] = [];
  for (const [key, val] of Object.entries(bestAssumptions)) {
    const baseVal = baseline[key];
    if (baseVal != null && Math.abs(val - baseVal) > 0.001) {
      changes.push({ key, before: baseVal, after: val });
    }
  }
  return changes;
}

/**
 * Greedy search across prioritized levers to find the assumption set
 * with the lowest d-score that achieves the target IRR for a given bundle.
 */
export function solveBundle(
  bundle: DebtBundle,
  targetIrR: number,
  heldYears: number,
  baseAssumptions: AssumptionVector,
  lockedVariables: Set<string>,
  maxIterations = 10
): BundleResult {
  const fullBase = fillAssumptions({ ...baseAssumptions, holdYears: heldYears });
  const bundleAssumptions = buildBundleAssumptions(fullBase, bundle);
  const baseIrR = computeSimplifiedIrR(bundleAssumptions, bundle);

  // If already at target, return as-is
  if (baseIrR >= targetIrR * 0.99) {
    const plau = computePlausibility(bundleAssumptions);
    return {
      bundle,
      baseIrR,
      achievedIrR: baseIrR,
      dScore: plau.dScore,
      band: plau.band,
      assumptions: bundleAssumptions,
      contributions: plau.contributions,
      changedVars: [],
      narrative: `${bundle.name}: Already at ${(baseIrR * 100).toFixed(1)}% IRR (target ${(targetIrR * 100).toFixed(0)}%) with d=${plau.dScore.toFixed(2)} (${plau.band}). Bundle: ${(bundle.ltv * 100).toFixed(0)}% LTV @ ${(bundle.rate * 100).toFixed(2)}% ${bundle.ioPeriod}yr IO.`,
    };
  }

  let bestSet = { ...bundleAssumptions };
  let bestIrR = baseIrR;

  for (let iter = 0; iter < maxIterations; iter++) {
    if (bestIrR >= targetIrR * 0.995) break;

    let candidateSet = { ...bestSet };
    let candidateIrR = bestIrR;
    let candidateD = Infinity;

    for (const lever of LEVERS) {
      if (lockedVariables.has(lever.key)) continue;

      // Try both directions
      for (const direction of [1, -1]) {
        const test = { ...candidateSet };
        const currentVal = test[lever.key] ?? VARIABLE_META[lever.key]?.prior ?? 0.05;
        const newVal = currentVal + lever.step * direction;
        if (newVal < lever.min || newVal > lever.max) continue;

        test[lever.key] = newVal;
        const testIrR = computeSimplifiedIrR(test, bundle);
        const testPlau = computePlausibility(test);

        if (testIrR > candidateIrR) {
          const dPenalty = Math.max(0, testPlau.dScore - 2.0) * 0.02;
          const effectiveIrR = testIrR - dPenalty;
          if (effectiveIrR > candidateIrR || (testIrR > candidateIrR && testIrR < targetIrR * 1.1)) {
            candidateSet = test;
            candidateIrR = testIrR;
            candidateD = testPlau.dScore;
          }
        }
      }
    }

    bestSet = candidateSet;
    bestIrR = candidateIrR;
  }

  const finalPlau = computePlausibility(bestSet);
  const changes = computeDeltaNarrative(bestSet, bundleAssumptions);

  // Build narrative
  const shortfall = baseIrR / targetIrR;
  const achievedVia = shortfall < 0.80
    ? 'Assumption adjustment insufficient for this debt product'
    : changes.length > 0
      ? `Adjusted ${changes.length} variables for target IRR`
      : 'No adjustment needed';

  const narrative = `${bundle.name}: ${achievedVia}. ` +
    `Result: ${(bestIrR * 100).toFixed(1)}% IRR (target ${(targetIrR * 100).toFixed(0)}%). ` +
    `Plausibility d=${finalPlau.dScore.toFixed(2)} (${finalPlau.band}). ` +
    `Bundle: ${(bundle.ltv * 100).toFixed(0)}% LTV @ ${(bundle.rate * 100).toFixed(2)}% ${bundle.ioPeriod}yr IO.` +
    (finalPlau.band === 'Unrealistic' ? ' ⚠ Outside historical norms.' : '');

  return {
    bundle,
    baseIrR,
    achievedIrR: bestIrR,
    dScore: finalPlau.dScore,
    band: finalPlau.band,
    assumptions: bestSet,
    contributions: finalPlau.contributions,
    changedVars: changes,
    narrative,
  };
}

/**
 * Full goal-seek evaluation across all (or filtered) debt bundles.
 * Returns results sorted by d-score (least aggressive first).
 */
export function goalSeek(
  targetIrR: number,
  holdYears: number,
  currentAssumptions: AssumptionVector,
  constraints?: SolverConstraints
): GoalSeekResult {
  const lockedVariables = new Set(constraints?.lockedVariables ?? []);
  const bundleFilter = constraints?.bundleFilter ?? [];

  const bundles = bundleFilter.length > 0
    ? DEBT_BUNDLES.filter(b => bundleFilter.includes(b.id))
    : DEBT_BUNDLES;

  const filled = fillAssumptions({ ...currentAssumptions, holdYears });

  // Evaluate each bundle
  const results: BundleResult[] = bundles.map(bundle =>
    solveBundle(bundle, targetIrR, holdYears, filled, lockedVariables)
  );

  // Sort by d-score (least aggressive first)
  results.sort((a, b) => a.dScore - b.dScore);

  return {
    targetIrR,
    holdYears,
    currentIrRMap: results.map(r => ({ bundle: r.bundle.id, baseIrR: r.baseIrR })),
    results,
    recommendation: results[0] ?? null,
    bundlesEvaluated: bundles.map(b => ({ id: b.id, name: b.name })),
  };
}

/**
 * Map d-score + band to a simple trust level for UI badges.
 */
export function plausibilityBadge(dScore: number, band: string): { color: string; icon: string; label: string } {
  if (dScore <= 1.0) return { color: 'green', icon: '🟢', label: 'Realistic' };
  if (dScore <= 1.5) return { color: 'yellow', icon: '🟡', label: 'Stretch' };
  if (dScore <= 2.0) return { color: 'orange', icon: '🟠', label: 'Aggressive' };
  if (dScore <= 3.0) return { color: 'red', icon: '🔴', label: 'Heroic' };
  return { color: 'darkred', icon: '💀', label: 'Unrealistic' };
}
