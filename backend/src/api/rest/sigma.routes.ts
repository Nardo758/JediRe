import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// M36 JOINT DISTRIBUTION ENGINE — Phase A (Heuristic Σ)
// ─────────────────────────────────────────────────────────────────────────────
//
// This is a minimal viable plausibility + goal-seeking engine.
// Σ is hardcoded from market data ranges until empirical estimation ships.
// Three debt bundles are defined statically.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssumptionVector {
  [key: string]: number;
}

interface DebtBundle {
  id: string;
  name: string;
  ltv: number;           // loan-to-value ratio
  rate: number;          // annual interest rate
  ioPeriod: number;      // interest-only period in years
  amortYears: number;    // amortization period (0 = interest-only)
  upFrontBps: number;    // upfront costs in basis points
  minDscr: number;       // minimum DSCR requirement
  description: string;
}

interface SolverResult {
  targetIrR: number;
  holdYears: number;
  achievedIrR: number;
  dScore: number;
  aggressivenessBand: string;
  bundle: string;
  assumptions: AssumptionVector;
  contributions: { [key: string]: number };
  narrative: string;
}

// ─── Variable Definitions ────────────────────────────────────────────────────

// The ~55 variable schema for the assumption set.
// Each entry defines: name, unit, min, max, prior mean, prior std.
// These feed into the Mahalanobis distance and the solver bounds.
const VARIABLE_META: { [key: string]: { unit: string; min: number; max: number; prior: number; std: number } } = {
  // Acquisition
  purchasePrice:          { unit: '$',     min: 500000,    max: 50000000, prior: 5000000, std: 2000000 },
  pricePerUnit:           { unit: '$/u',   min: 50000,     max: 500000,   prior: 150000,  std: 60000 },
  goingInCapRate:         { unit: '%',     min: 0.03,      max: 0.12,     prior: 0.065,   std: 0.012 },
  
  // Revenue
  rentGrowthY1:           { unit: '%',     min: -0.02,     max: 0.10,     prior: 0.03,    std: 0.015 },
  rentGrowthStabilized:   { unit: '%',     min: 0.0,       max: 0.08,     prior: 0.025,   std: 0.01 },
  vacancyAtStabilization: { unit: '%',     min: 0.02,      max: 0.15,     prior: 0.07,    std: 0.02 },
  lossToLeasePct:         { unit: '%',     min: 0.0,       max: 0.08,     prior: 0.03,    std: 0.015 },
  concessionsPct:          { unit: '%',     min: 0.0,       max: 0.06,     prior: 0.02,    std: 0.01 },
  otherIncomePerUnit:     { unit: '$/u/y', min: 100,       max: 2000,     prior: 500,     std: 300 },
  
  // Expenses
  opexPerUnit:            { unit: '$/u/y', min: 3000,      max: 15000,    prior: 7000,    std: 2000 },
  expenseGrowthRate:      { unit: '%',     min: 0.01,      max: 0.06,     prior: 0.03,    std: 0.008 },
  propertyTaxPctOfRevenue:{ unit: '%',     min: 0.08,      max: 0.25,     prior: 0.14,    std: 0.03 },
  insurancePerUnit:       { unit: '$/u/y', min: 200,       max: 1500,     prior: 600,     std: 250 },
  managementFeePct:       { unit: '%',     min: 0.03,      max: 0.08,     prior: 0.05,    std: 0.01 },
  replacementReservesPerUnit:{ unit:'$/u/y', min: 150,    max: 500,      prior: 300,     std: 100 },
  capexPerUnitYr1:        { unit: '$/u/y', min: 0,         max: 5000,     prior: 1000,    std: 800 },
  
  // Financing
  loanAmount:             { unit: '$',     min: 0,         max: 40000000, prior: 3000000, std: 2000000 },
  interestRate:           { unit: '%',     min: 0.04,      max: 0.10,     prior: 0.07,    std: 0.01 },
  ltv:                    { unit: '%',     min: 0.50,      max: 0.85,     prior: 0.70,    std: 0.08 },
  ioPeriodYears:          { unit: 'years', min: 0,         max: 10,       prior: 3,       std: 2 },
  amortYears:             { unit: 'years', min: 20,        max: 35,       prior: 30,      std: 5 },
  upfrontCostsPctOfLoan:  { unit: '%',     min: 0.005,     max: 0.03,     prior: 0.015,   std: 0.005 },
  
  // Disposition
  exitCapRate:            { unit: '%',     min: 0.04,      max: 0.12,     prior: 0.0625,  std: 0.012 },
  exitSellingCostsPct:    { unit: '%',     min: 0.01,      max: 0.04,     prior: 0.02,    std: 0.005 },
  holdYears:              { unit: 'years', min: 3,         max: 10,       prior: 5,       std: 1.5 },
  
  // Renovation / Development
  renovationCostPerUnit:  { unit: '$/u',   min: 0,         max: 150000,   prior: 15000,   std: 20000 },
  premiumDecayBps:        { unit: 'bps/y', min: 0,         max: 500,      prior: 200,     std: 100 },
  leaseUpMonths:          { unit: 'months',min: 3,         max: 36,       prior: 12,      std: 6 },
  
  // Deal-level
  totalUnits:             { unit: 'int',   min: 5,         max: 500,      prior: 80,      std: 60 },
  sfPerUnit:              { unit: 'sf',    min: 500,       max: 2500,     prior: 1000,    std: 300 },
  yearBuilt:              { unit: 'year',  min: 1950,      max: 2025,     prior: 2000,    std: 15 },
};

// ─── Debt Bundles ────────────────────────────────────────────────────────────

const DEBT_BUNDLES: DebtBundle[] = [
  {
    id: 'hud_221d4',
    name: 'HUD 221(d)(4)',
    ltv: 0.83,
    rate: 0.05,
    ioPeriod: 2,
    amortYears: 35,
    upFrontBps: 100,
    minDscr: 1.11,
    description: 'Best leverage (83% LTV). Lowest rate (5.00%). 35-yr amort. Slow closing (6-9mo). Requires rehabilitation scope. Best for value-add deals with 5+ year hold.',
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
    description: 'Moderate leverage (75% LTV). Competitive fixed rate (5.75%). 5yr IO. 30-60 day close. Flexible prepayment. Best for stabilized assets.',
  },
  {
    id: 'agency_floating',
    name: 'Agency Floating (SOFR +)',
    ltv: 0.75,
    rate: 0.065,  // SOFR + 200bps approx
    ioPeriod: 5,
    amortYears: 30,
    upFrontBps: 25,
    minDscr: 1.25,
    description: 'Same leverage as fixed. Floating rate (SOFR + 180-220bps). 5yr IO. Lower upfront. Rate hedge optional. Best if user expects stable or falling rates.',
  },
  {
    id: 'bridge',
    name: 'Bridge / Transitional',
    ltv: 0.70,
    rate: 0.075,  // SOFR + 350-400bps
    ioPeriod: 3,
    amortYears: 30,
    upFrontBps: 150,
    minDscr: 1.20,
    description: 'Lower leverage (70% LTV). Higher rate (7.50%). 3yr IO. Fast close (2-4 weeks). Flexible seasoning. Best for short-term transitional plays.',
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
    description: 'Moderate leverage (70% LTV). Fixed rate (6.50%). Fully amortizing. Lockbox/cash management. Best for 10-year hold period.',
  },
];

// ─── Helper: Mahalanobis Distance ───────────────────────────────────────────
// d² = (x - μ)ᵀ Σ⁻¹ (x - μ)
// For simplicity in Phase A, Σ is diagonal (no cross-correlations).
// The per-variable contribution is therefore (x_i - μ_i)² / σ_i²

function computePlausibility(assumptions: AssumptionVector): {
  dScore: number;
  band: string;
  contributions: { [key: string]: number };
} {
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

  // Aggressiveness bands (from M36 spec Section 4)
  let band: string;
  if (dScore <= 1.0) band = 'Realistic';
  else if (dScore <= 1.5) band = 'Stretch';
  else if (dScore <= 2.0) band = 'Aggressive';
  else if (dScore <= 3.0) band = 'Heroic';
  else band = 'Unrealistic';

  return { dScore, band, contributions };
}

// ─── Helper: Solve IRR (simplified) ─────────────────────────────────────────
// A full proforma solver is complex. For Phase A, use a simplified
// model that computes LP IRR from a handful of key inputs.
// This gets replaced by the actual financial model engine.

function computeSimplifiedIrR(
  assumptions: AssumptionVector,
  bundle: DebtBundle
): number {
  const pp = assumptions.purchasePrice || 5000000;
  const units = assumptions.totalUnits || 80;
  const rentGrowth = assumptions.rentGrowthStabilized || 0.025;
  const vacancy = assumptions.vacancyAtStabilization || 0.07;
  const opex = assumptions.opexPerUnit || 7000;
  const exitCap = assumptions.exitCapRate || assumptions.goingInCapRate || 0.065;
  const holdYears = assumptions.holdYears || 5;
  const capRate = assumptions.goingInCapRate || 0.065;

  // Step 1: Stabilized NOI
  const potentialGpr = pp * capRate * (1 + vacancy); // rough GPR from cap rate
  const stabilizedNoi = pp * capRate;

  // Step 2: Leverage
  const loanAmount = pp * bundle.ltv;
  const equity = pp - loanAmount;
  const monthlyRate = bundle.rate / 12;
  const nPayments = (bundle.amortYears || 30) * 12;
  const payment = nPayments > 0
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
    : loanAmount * bundle.rate; // IO
  const annualPayment = payment * 12;

  // Step 3: Cash flows over hold period
  const cashFlows: number[] = [];
  for (let y = 1; y <= holdYears; y++) {
    const rentFactor = Math.pow(1 + rentGrowth, y - 1);
    const cfBeforeDebt = stabilizedNoi * rentFactor;
    const cf = cfBeforeDebt - annualPayment;
    // IO period: principal doesn't change
    // After IO: amortization reduces principal (simplified)
    cashFlows.push(cf);
  }

  // Step 4: Exit proceeds
  const exitNoi = stabilizedNoi * Math.pow(1 + rentGrowth, holdYears);
  const exitValue = exitNoi / exitCap;
  const remainingLoan = loanAmount; // simplified: no amort in IO period
  const sellingCosts = exitValue * (assumptions.exitSellingCostsPct || 0.02);
  const netEquity = exitValue - remainingLoan - sellingCosts;
  cashFlows[holdYears - 1] += netEquity;
  cashFlows.unshift(-equity); // initial investment at year 0

  // Step 5: Compute IRR via binary search
  const irr = computeIrR(cashFlows, 0.05, 0.30);

  return irr;
}

function computeIrR(cashFlows: number[], guessLow: number, guessHigh: number, tolerance = 0.0001): number {
  const npv = (rate: number) => cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  let low = guessLow;
  let high = guessHigh;
  let mid = (low + high) / 2;

  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    const n = npv(mid);
    if (Math.abs(n) < tolerance) return mid;
    if (n > 0) low = mid;
    else high = mid;
  }
  return mid;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/sigma/plausibility
 * Score an assumption set for plausibility via Mahalanobis distance.
 */
router.post('/plausibility', async (req: Request, res: Response) => {
  try {
    const { assumptions } = req.body;
    if (!assumptions || typeof assumptions !== 'object') {
      return res.status(400).json({ success: false, error: 'assumptions object required' });
    }

    const result = computePlausibility(assumptions);

    res.json({
      success: true,
      data: {
        mahalanobisD: parseFloat(result.dScore.toFixed(3)),
        band: result.band,
        contributions: result.contributions,
        nVariables: Object.keys(result.contributions).length,
        // Top 5 contributors to distance
        topContributors: Object.entries(result.contributions)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([k, v]) => ({ variable: k, contribution: parseFloat(v.toFixed(3)) })),
      },
    });
  } catch (error: any) {
    console.error('Plausibility error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to compute plausibility' });
  }
});

/**
 * POST /api/sigma/goal-seek
 * Given a target IRR and current deal state, find the least-aggressive
 * assumption set (lowest d) that hits the target. Evaluates each debt bundle.
 */
router.post('/goal-seek', async (req: Request, res: Response) => {
  try {
    const {
      targetIrR,
      holdYears,
      currentAssumptions,
      lockVariables = [],       // variables the user doesn't want changed
      bundleFilter = [],         // restrict to specific bundles
    } = req.body;

    if (targetIrR == null || holdYears == null) {
      return res.status(400).json({ success: false, error: 'targetIrR and holdYears required' });
    }

    // Determine which debt bundles to evaluate
    const bundles = bundleFilter.length > 0
      ? DEBT_BUNDLES.filter(b => bundleFilter.includes(b.id))
      : DEBT_BUNDLES;

    // Current assumption vector (use defaults for missing keys)
    const base: AssumptionVector = { ...currentAssumptions, holdYears };
    for (const [key, meta] of Object.entries(VARIABLE_META)) {
      if (base[key] == null) base[key] = meta.prior;
    }

    const lockedSet = new Set(lockVariables);

    // Evaluate each debt bundle
    const results: SolverResult[] = [];
    for (const bundle of bundles) {
      // Adjust financing assumptions to match bundle
      const bundleAssumptions: AssumptionVector = {
        ...base,
        ltv: bundle.ltv,
        interestRate: bundle.rate,
        ioPeriodYears: bundle.ioPeriod,
        amortYears: bundle.amortYears,
        upfrontCostsPctOfLoan: bundle.upFrontBps / 10000,
      };

      // Compute current IRR with this bundle
      const baseIrR = computeSimplifiedIrR(bundleAssumptions, bundle);

      // If base already hits target, no adjustment needed
      if (baseIrR >= targetIrR * 0.99) {
        const plausible = computePlausibility(bundleAssumptions);
        results.push({
          targetIrR,
          holdYears,
          achievedIrR: baseIrR,
          dScore: plausible.dScore,
          aggressivenessBand: plausible.band,
          bundle: bundle.id,
          assumptions: bundleAssumptions,
          contributions: plausible.contributions,
          narrative: `Current assumptions with ${bundle.name} already achieve ${(baseIrR * 100).toFixed(1)}% IRR (target: ${(targetIrR * 100).toFixed(0)}%). Plausibility: d=${plausible.dScore.toFixed(2)} (${plausible.band}).`,
        });
        continue;
      }

      // ── Solver: adjust levers to hit target IRR ──
      // Prioritized levers (ordered by market plausibility for adjustment):
      // 1. Exit cap rate (±50bps)
      // 2. Rent growth (±1.5pp)
      // 3. Vacancy (±3pp)
      // 4. Expense growth (±1pp)
      // 5. Purchase price (if unlockable)

      const levers = [
        // { key, step, min, max, base value }
        { key: 'exitCapRate', step: 0.0025, min: 0.04, max: 0.10 },
        { key: 'rentGrowthStabilized', step: 0.005, min: -0.01, max: 0.08 },
        { key: 'vacancyAtStabilization', step: 0.01, min: 0.02, max: 0.15 },
        { key: 'expenseGrowthRate', step: 0.0025, min: 0.01, max: 0.06 },
        { key: 'lossToLeasePct', step: 0.005, min: 0, max: 0.08 },
        { key: 'concessionsPct', step: 0.005, min: 0, max: 0.06 },
        { key: 'opexPerUnit', step: 500, min: 3000, max: 15000 },
        { key: 'goingInCapRate', step: 0.0025, min: 0.04, max: 0.10 },
      ];

      let bestSet = { ...bundleAssumptions };
      let bestIrR = baseIrR;

      // Greedy search: for each lever, try incremental adjustments
      // that improve IRR while tracking d-score penalty.
      const maxIterations = 8;
      for (let iter = 0; iter < maxIterations; iter++) {
        if (bestIrR >= targetIrR * 0.995) break;

        let bestCandidate = { ...bestSet };
        let bestCandidateIrR = bestIrR;
        let bestCandidateD = Infinity;

        for (const lever of levers) {
          if (lockedSet.has(lever.key)) continue;

          // Try moving lever in both directions
          for (const direction of [1, -1]) {
            const candidate = { ...bestCandidate };
            const newVal = (candidate[lever.key] ?? VARIABLE_META[lever.key]?.prior ?? 0.05) + lever.step * direction;
            if (newVal < lever.min || newVal > lever.max) continue;

            candidate[lever.key] = newVal;
            newVal;

            const candidateIrR = computeSimplifiedIrR(candidate, bundle);
            const plau = computePlausibility(candidate);

            // Accept if IRR improves and d-score stays acceptable
            if (candidateIrR > bestCandidateIrR) {
              const dPenalty = Math.max(0, plau.dScore - 2.0) * 0.02;
              const effectiveIrR = candidateIrR - dPenalty;

              if (effectiveIrR > bestCandidateIrR || (candidateIrR > bestCandidateIrR && candidateIrR < targetIrR * 1.1)) {
                bestCandidate = candidate;
                bestCandidateIrR = candidateIrR;
                bestCandidateD = plau.dScore;
              }
            }
          }
        }

        bestSet = bestCandidate;
        bestIrR = bestCandidateIrR;
      }

      const finalPlausible = computePlausibility(bestSet);

      // ── Generate narrative ──
      const changedVars: string[] = [];
      for (const [key, val] of Object.entries(bestSet)) {
        const baseVal = bundleAssumptions[key];
        if (baseVal != null && Math.abs(val - baseVal) > 0.001) {
          changedVars.push(`${key}: ${baseVal.toFixed(4)} → ${val.toFixed(4)}`);
        }
      }

      const shortfall = (baseIrR / targetIrR);
      const achievedVia = shortfall < 0.80
        ? 'Adjusting assumptions was insufficient on this debt product.'
        : changedVars.length > 0
          ? `Adjusted ${changedVars.length} variables: ${changedVars.slice(0, 4).join('; ')}${changedVars.length > 4 ? ` (+${changedVars.length - 4} more)` : ''}`
          : 'No adjustment needed.';

      const narrative = [
        `${bundle.name}: `,
        achievedVia,
        ` Result: ${(bestIrR * 100).toFixed(1)}% IRR (target: ${(targetIrR * 100).toFixed(0)}%)`,
        ` Plausibility d=${finalPlausible.dScore.toFixed(2)} (${finalPlausible.band})`,
        ` Bundle: ${bundle.ltv * 100}% LTV @ ${(bundle.rate * 100).toFixed(2)}% ${bundle.ioPeriod}yr IO`,
        finalPlausible.band === 'Unrealistic' ? ' ⚠ This level of adjustment assumes market conditions outside historical norms.' : '',
      ].join('');

      results.push({
        targetIrR,
        holdYears,
        achievedIrR: bestIrR,
        dScore: finalPlausible.dScore,
        aggressivenessBand: finalPlausible.band,
        bundle: bundle.id,
        assumptions: bestSet,
        contributions: finalPlausible.contributions,
        narrative,
      });
    }

    // Sort by d-score (least aggressive first)
    results.sort((a, b) => a.dScore - b.dScore);

    res.json({
      success: true,
      data: {
        targetIrR,
        holdYears,
        currentIrRPerBundle: results.map(r => ({
          bundle: r.bundle,
          currentIrR: computeSimplifiedIrR({ ...base, ltv: DEBT_BUNDLES.find(b => b.id === r.bundle)?.ltv ?? 0.7, interestRate: DEBT_BUNDLES.find(b => b.id === r.bundle)?.rate ?? 0.07 }, DEBT_BUNDLES.find(b => b.id === r.bundle) ?? DEBT_BUNDLES[0]),
        })),
        results,
        recommendation: results[0] ? {
          bundle: results[0].bundle,
          dScore: results[0].dScore,
          band: results[0].aggressivenessBand,
          narrative: results[0].narrative,
        } : null,
        bundlesEvaluated: bundles.map(b => ({ id: b.id, name: b.name })),
      },
    });
  } catch (error: any) {
    console.error('Goal-seek error:', error);
    res.status(500).json({ success: false, error: error.message || 'Goal-seeking failed' });
  }
});

/**
 * GET /api/sigma/bundles
 * List available debt bundles.
 */
router.get('/bundles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: DEBT_BUNDLES.map(b => ({
      id: b.id,
      name: b.name,
      ltv: b.ltv,
      rate: b.rate,
      ioPeriod: b.ioPeriod,
      amortYears: b.amortYears,
      minDscr: b.minDscr,
      description: b.description,
    })),
  });
});

/**
 * GET /api/sigma/variables
 * List variable metadata for the assumption schema.
 */
router.get('/variables', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(VARIABLE_META).map(([key, meta]) => ({
      key,
      unit: meta.unit,
      min: meta.min,
      max: meta.max,
      prior: meta.prior,
      std: meta.std,
    })),
  });
});

export default router;
