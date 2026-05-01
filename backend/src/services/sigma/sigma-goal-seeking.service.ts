/**
 * Goal-Seeking Solver
 *
 * Finds the most plausible path from current assumptions to a target IRR.
 * Returns a step-by-step roadmap with per-variable IRR lift and d cost,
 * including per-line-item expense adjustments.
 *
 * Architecture:
 *   - Grid search over adjustable variables with bounded moves
 *   - Simplified DCF for IRR computation
 *   - Mahalanobis d² as the objective (minimum plausibility cost)
 *   - Output: roadmap steps + "Apply" payload for the frontend
 *
 * Adjustable variables (9):
 *   Revenue:    rent_growth, vacancy_rate, loss_to_lease, collection_loss
 *   Expenses:   expense_growth (blended — roadmap splits to line items)
 *   Disposition: exit_cap_rate
 *   Acquisition: entry_cap_rate
 *   Financing:  debt_rate, ltv
 */

import {
  SIGMA_VARIABLES,
} from './sigma-variable-registry';
import {
  buildHeuristicSigma,
  aggressivenessBand,
} from './heuristic-sigma-builder';
import type { RegimeLabel } from './heuristic-sigma-builder';
import { DEBT_BUNDLES, estimateBundleIRRVariance } from './debt-bundle-registry';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoalSeekInput {
  /** Target IRR (as decimal, e.g., 0.15 = 15%) */
  targetIRR: number;
  /** Base assumption set (current deal assumptions) */
  baseAssumptions: Record<string, number>;
  /** Hold period in years */
  holdPeriodYears: number;
  /** Variables to lock (don't change these) */
  lockedVariables?: string[];
  /** Per-line-item expense map { expenseKey: currentGrowthRate } */
  expenseLineItems?: Record<string, number>;
  /** Controllable expense keys (non-controllable locked) */
  controllableExpenseKeys?: string[];
  /** Debt bundle to evaluate */
  bundleId: string;
  /** Regime */
  regime?: RegimeLabel;
  /** Aggressiveness budgets to sweep */
  aggressivenessBudgets?: number[];
  /** Deal-specific parameters */
  dealParams?: DealParams;
}

export interface DealParams {
  purchasePrice: number;
  totalUnits: number;
  noiAtAcquisition: number;
  acquisitionCosts: number;
  exitFees: number;
  debtRate?: number;
  ltv?: number;
}

/** Single step in the roadmap */
export interface RoadmapStep {
  /** Variable key (e.g., 'rent_growth', or expense key like 'Repairs & Maintenance') */
  varId: string;
  /** Human-readable label */
  label: string;
  /** Category: 'revenue' | 'expense' | 'capital' | 'disposition' */
  category: 'revenue' | 'expense' | 'capital' | 'disposition';
  /** Current value */
  currentValue: number;
  /** Suggested value */
  suggestedValue: number;
  /** IRR lift from this adjustment (percentage points, e.g. 1.2 = +1.2pp) */
  irrLiftPp: number;
  /** Marginal plausibility cost (delta d, dimensionless) */
  dCost: number;
  /** Is this an expense line item? (vs blended or macro variable) */
  isExpenseLineItem: boolean;
  /** Locked (user override or non-controllable)? */
  locked: boolean;
  /** Assessment: how hard is this change to achieve */
  feasibility: 'straightforward' | 'moderate' | 'aggressive' | 'heroic';
}

export interface ApplyPayload {
  /** Updated assumption set for buildModel() */
  assumptions: Record<string, number>;
  /** Per-line-item expense growth overrides */
  expenseOverrides: Record<string, number>;
  /** Which fields changed vs base */
  changed: string[];
  /** Summary text */
  summary: string;
}

export interface GoalSeekOutput {
  targetIRR: number;
  currentIRR: number;
  currentD: number;
  currentBand: string;
  steps: RoadmapStep[];
  projectedIRR: number;
  projectedD: number;
  projectedBand: string;
  recommendation: string;
  regime: string;
  holdPeriodYears: number;
  bundleId: string;
  bundleName: string;
  targetReachable: boolean;
  applyPayload: ApplyPayload;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const ADJUSTABLE_VARS: Array<{
  id: string;
  label: string;
  category: RoadmapStep['category'];
  isExpenseLineItem: boolean;
}> = [
  { id: 'rent_growth',     label: 'Market Rent Growth',           category: 'revenue',     isExpenseLineItem: false },
  { id: 'vacancy_rate',     label: 'Vacancy Rate',                 category: 'revenue',     isExpenseLineItem: false },
  { id: 'loss_to_lease',    label: 'Loss-to-Lease',                category: 'revenue',     isExpenseLineItem: false },
  { id: 'collection_loss',  label: 'Collection Loss',              category: 'revenue',     isExpenseLineItem: false },
  { id: 'expense_growth',   label: 'Operating Expense Growth',     category: 'expense',     isExpenseLineItem: false },
  { id: 'exit_cap_rate',    label: 'Exit Cap Rate',                category: 'disposition', isExpenseLineItem: false },
  { id: 'entry_cap_rate',   label: 'Entry Cap Rate',               category: 'capital',     isExpenseLineItem: false },
  { id: 'debt_rate',        label: 'Debt Interest Rate',            category: 'capital',     isExpenseLineItem: false },
  { id: 'ltv',              label: 'Loan-to-Value',                category: 'capital',     isExpenseLineItem: false },
];

/** Default aggressiveness budgets (d thresholds) */
const DEFAULT_BUDGETS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

/** Step sizes for grid search */
const STEP_SIZES: Record<string, number[]> = {
  rent_growth:     [-0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015, 0.02, 0.03],
  vacancy_rate:    [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03],
  loss_to_lease:   [-0.01, -0.005, 0, 0.005, 0.01],
  collection_loss: [-0.005, -0.0025, 0, 0.0025, 0.005],
  expense_growth:  [-0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015],
  exit_cap_rate:   [-0.005, -0.0025, 0, 0.0025, 0.005, 0.01],
  entry_cap_rate:  [-0.005, -0.0025, 0, 0.0025, 0.005],
  debt_rate:       [-0.005, -0.0025, 0, 0.0025, 0.005, 0.01],
  ltv:             [-0.05, -0.025, 0, 0.025, 0.05],
  default:         [-0.01, -0.005, 0, 0.005, 0.01],
};

/** Expense line items → controllable vs market-driven */
const CONTROLLABLE_EXPENSE_KEYS: Record<string, boolean> = {
  'Repairs & Maintenance': true,
  'Contract Services': true,
  'Security': true,
  'Landscaping': true,
  'Personnel / Payroll': true,
  'Marketing': true,
  'Leasing Commissions': true,
  'Administrative / G&A': true,
  'Turnover': true,
  'Water / Sewer': false,    // utility rate — market driven
  'Electric': false,          // utility rate — market driven
  'Insurance': false,         // insurance market
  'Real Estate Taxes': false, // tax assessment — jurisdictional
  'Management Fee': true,     // negotiated
};

/** Mean expense growth rate for normalizing line items */
const DEFAULT_EXPENSE_GROWTH = 0.03;

// ─── IRR Computation ─────────────────────────────────────────────────────────

function computeIRR(cashFlows: number[]): number {
  let rate = 0.12;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(npv) < 1e-8) break;
    if (Math.abs(dnpv) < 1e-12) break;
    rate = rate - npv / dnpv;
    if (rate < -0.9) rate = -0.9;
    if (rate > 10) rate = 10;
  }
  return rate;
}

function computeSimplifiedIRR(
  assumptions: Record<string, number>,
  deal: DealParams,
  bundleId: string,
  years: number,
): number {
  const bundle = DEBT_BUNDLES[bundleId];
  if (!bundle) return 0;

  const rentGrowth = assumptions.rent_growth ?? 0.03;
  const expenseGrowth = assumptions.expense_growth ?? 0.03;
  const exitCap = assumptions.exit_cap_rate ?? 0.055;
  const vacancy = assumptions.vacancy_rate ?? 0.05;
  const ltl = assumptions.loss_to_lease ?? 0.03;
  const collLoss = assumptions.collection_loss ?? 0.015;

  const debtRate = deal.debtRate ?? bundle.params.debtRate;
  const ltv = deal.ltv ?? bundle.params.ltv;

  const equity = deal.purchasePrice * (1 - ltv) + deal.purchasePrice * deal.acquisitionCosts;
  const loanAmount = deal.purchasePrice * ltv;

  // Monthly payment
  const monthlyRate = debtRate / 12;
  const amortYears = bundle.params.amortization > 0 ? bundle.params.amortization : 30;
  const numPayments = amortYears * 12;
  const monthlyPayment = Math.abs(monthlyRate) < 1e-10
    ? loanAmount / numPayments
    : loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annualDebtService = monthlyPayment * 12;

  // Year-1 NOI
  let baseNOI = deal.noiAtAcquisition * (1 - vacancy) * (1 - ltl) * (1 - collLoss);

  const cashFlows: number[] = [-equity];

  for (let y = 1; y <= years; y++) {
    const noiGrowth = (1 + rentGrowth) / (1 + expenseGrowth) - 1;
    baseNOI = baseNOI * (1 + noiGrowth);
    const effectiveNOI = baseNOI * (1 - vacancy) * (1 - ltl) * (1 - collLoss);
    cashFlows.push(effectiveNOI - annualDebtService);
  }

  // Disposition
  const finalNOI = baseNOI * (1 + rentGrowth); // N+1 rent growth for cap rate computation
  const salePrice = finalNOI / exitCap;
  const loanBalance = loanAmount * (1 - (1 - 1 / Math.pow(1 + monthlyRate, numPayments - years * 12)) /
    (1 - 1 / Math.pow(1 + monthlyRate, numPayments)));
  const netProceeds = salePrice - Math.max(loanBalance, 0) - salePrice * deal.exitFees;
  cashFlows[cashFlows.length - 1] += netProceeds;

  return computeIRR(cashFlows);
}

// ─── Mahalanobis Distance ────────────────────────────────────────────────────

function computeMahalanobisD(
  candidate: Record<string, number>,
  base: Record<string, number>,
  sigma: ReturnType<typeof buildHeuristicSigma>,
): number {
  const n = sigma.variableOrder.length;
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    const varId = sigma.variableOrder[i];
    x[i] = candidate[varId] !== undefined ? candidate[varId] : sigma.meanVector[i];
  }
  const diff = new Array(n);
  for (let i = 0; i < n; i++) diff[i] = x[i] - sigma.meanVector[i];
  const temp = new Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      temp[i] += sigma.invCovFlat[i * n + j] * diff[j];
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += diff[i] * temp[i];
  return Math.sqrt(d2);
}

// ─── Grid Solver ─────────────────────────────────────────────────────────────

interface CandidateSolution {
  assumptions: Record<string, number>;
  irr: number;
  d: number;
  d2: number;
  band: string;
}

/** Run grid search over adjustable variables */
function gridSearch(
  base: Record<string, number>,
  targetIRR: number,
  dealParams: DealParams,
  bundleId: string,
  lockedSet: Set<string>,
  years: number,
  sigma: ReturnType<typeof buildHeuristicSigma>,
): CandidateSolution | null {
  const candidates: Record<string, number>[] = [];

  // Generate candidates via grid
  for (const rStep of (STEP_SIZES.rent_growth ?? STEP_SIZES.default)) {
    for (const vStep of (STEP_SIZES.vacancy_rate ?? STEP_SIZES.default)) {
      for (const xStep of (STEP_SIZES.exit_cap_rate ?? STEP_SIZES.default)) {
        for (const eStep of (STEP_SIZES.expense_growth ?? STEP_SIZES.default)) {
          for (const dStep of STEP_SIZES.default) {
            const candidate: Record<string, number> = { ...base };

            const adjustments: Array<{ id: string; step: number; steps: number[] }> = [
              { id: 'rent_growth', step: rStep, steps: STEP_SIZES.rent_growth ?? [] },
              { id: 'vacancy_rate', step: vStep, steps: STEP_SIZES.vacancy_rate ?? [] },
              { id: 'exit_cap_rate', step: xStep, steps: STEP_SIZES.exit_cap_rate ?? [] },
              { id: 'expense_growth', step: eStep, steps: STEP_SIZES.expense_growth ?? [] },
              { id: 'entry_cap_rate', step: dStep * 0.5, steps: STEP_SIZES.entry_cap_rate ?? [] },
              { id: 'debt_rate', step: dStep, steps: STEP_SIZES.debt_rate ?? [] },
              { id: 'ltv', step: dStep * 0.5, steps: STEP_SIZES.ltv ?? [] },
              { id: 'loss_to_lease', step: vStep * 0.3, steps: STEP_SIZES.loss_to_lease ?? [] },
              { id: 'collection_loss', step: vStep * 0.15, steps: STEP_SIZES.collection_loss ?? [] },
            ];

            let valid = true;
            for (const adj of adjustments) {
              if (lockedSet.has(adj.id)) continue;
              const current = base[adj.id] ?? 0;
              const val = current + adj.step;
              const vDef = (SIGMA_VARIABLES as any)[adj.id];
              if (vDef && vDef.minFeasible !== undefined) {
                if (val < vDef.minFeasible || val > (vDef.maxFeasible ?? 1)) {
                  valid = false;
                  break;
                }
              }
              candidate[adj.id] = Math.round(val * 10000) / 10000;
            }

            if (valid) candidates.push(candidate);
          }
        }
      }
    }
  }

  // Score each candidate
  let best: CandidateSolution | null = null;
  let bestObj = Infinity;

  for (const candidate of candidates) {
    const irr = computeSimplifiedIRR(candidate, dealParams, bundleId, years);
    const irrGap = Math.abs(irr - targetIRR);
    const d = computeMahalanobisD(candidate, base, sigma);
    const { d: dRounded, band } = aggressivenessBand(d * d);

    // Objective: minimize d² + IRR penalty
    const irrPenalty = irrGap * 100;
    const obj = d * d + irrPenalty;

    if (obj < bestObj) {
      bestObj = obj;
      best = { assumptions: { ...candidate }, irr, d, d2: d * d, band };
    }
  }

  return best;
}

// ─── Expense Line Item Mapping ───────────────────────────────────────────────

/** Compute per-line-item adjustments from blended expense growth change */
function computeExpenseAdjustments(
  expenseLineItems: Record<string, number>,
  controllableKeys: string[],
  oldBlended: number,
  newBlended: number,
  lockedSet: Set<string>,
): Map<string, { current: number; suggested: number; irrLiftPp: number; locked: boolean }> {
  const result = new Map<string, { current: number; suggested: number; irrLiftPp: number; locked: boolean }>();

  // Estimate: each 1pp reduction in blended expense growth ≈ 0.3pp IRR lift
  const blendedDelta = oldBlended - newBlended;
  const totalIrImpact = blendedDelta * 0.3; // rough IRR multiplier for blended expense

  const controllable = controllableKeys.filter(k => CONTROLLABLE_EXPENSE_KEYS[k] !== false);

  if (controllable.length === 0) return result;

  // Distribute the adjustment across controllable line items proportionally to their current rate
  // Higher-rate items get more room to cut
  const controllableItems = controllable.map(key => ({
    key,
    currentRate: expenseLineItems[key] ?? DEFAULT_EXPENSE_GROWTH,
  }));

  // Sort by current rate descending — higher-growth items get more cut
  controllableItems.sort((a, b) => b.currentRate - a.currentRate);

  // Weight: items with higher current rate get more adjustment weight
  const totalWeight = controllableItems.reduce((s, c) => s + c.currentRate, 0);
  let remainingDelta = blendedDelta;
  let assignedIr = 0;

  for (let i = 0; i < controllableItems.length; i++) {
    const item = controllableItems[i];
    if (lockedSet.has(`expense:${item.key}`)) {
      result.set(item.key, { current: item.currentRate, suggested: item.currentRate, irrLiftPp: 0, locked: true });
      continue;
    }

    // Proportional weight
    const weight = item.currentRate / totalWeight;
    const itemDelta = remainingDelta * weight;
    const suggested = Math.max(0.005, Math.min(0.08, item.currentRate - itemDelta));
    const irrFraction = totalIrImpact * weight;

    result.set(item.key, { current: item.currentRate, suggested, irrLiftPp: irrFraction, locked: false });
    assignedIr += irrFraction;
  }

  return result;
}

/** Estimate IRR lift from a single variable change, holding others fixed */
function estimateSingleVarIRRSensitivity(
  varId: string,
  base: Record<string, number>,
  dealParams: DealParams,
  bundleId: string,
  years: number,
  stepSize: number,
): number {
  const up = { ...base, [varId]: (base[varId] ?? 0) + stepSize };
  const down = { ...base, [varId]: Math.max(0.005, (base[varId] ?? 0) - stepSize) };
  const irrUp = computeSimplifiedIRR(up, dealParams, bundleId, years);
  const irrDown = computeSimplifiedIRR(down, dealParams, bundleId, years);
  return (irrUp - irrDown) / 2; // average lift per stepSize
}

// ─── Feasibility Assessment ──────────────────────────────────────────────────

function assessFeasibility(
  varId: string,
  current: number,
  suggested: number,
  sigma: ReturnType<typeof buildHeuristicSigma>,
): RoadmapStep['feasibility'] {
  const diff = Math.abs(suggested - current);
  if (diff < 0.005) return 'straightforward';
  if (diff < 0.02) return 'moderate';

  // Check against variable's feasible range
  const vDef = (SIGMA_VARIABLES as any)[varId];
  if (vDef && vDef.maxFeasible !== undefined) {
    const inBand = suggested >= vDef.minFeasible && suggested <= vDef.maxFeasible;
    if (!inBand) return 'heroic';

    // Check how far from mean
    const fromMean = Math.abs(suggested - vDef.default) / vDef.annualStdDev;
    if (fromMean > 2.5) return 'heroic';
    if (fromMean > 1.5) return 'aggressive';
  }
  if (diff > 0.03) return 'aggressive';
  return 'moderate';
}

// ─── Main Solver ─────────────────────────────────────────────────────────────

/**
 * Run the goal-seeking engine.
 * Returns a roadmap + apply payload.
 */
export async function runGoalSeek(input: GoalSeekInput): Promise<GoalSeekOutput> {
  const {
    targetIRR,
    baseAssumptions,
    holdPeriodYears,
    lockedVariables = [],
    expenseLineItems = {},
    controllableExpenseKeys = [],
    bundleId,
    regime = 'expansion',
    aggressivenessBudgets = DEFAULT_BUDGETS,
    dealParams,
  } = input;

  const years = Math.min(holdPeriodYears, 10);
  const lockedSet = new Set(lockedVariables);

  const defaultDealParams: DealParams = {
    purchasePrice: 10_000_000,
    totalUnits: 100,
    noiAtAcquisition: 600_000,
    acquisitionCosts: 0.02,
    exitFees: 0.03,
    ...dealParams,
  };

  const bundle = DEBT_BUNDLES[bundleId];
  if (!bundle) {
    throw new Error(`Unknown bundle: ${bundleId}`);
  }

  // Build baseline Σ
  const sigma = buildHeuristicSigma(regime);

  // Compute current state
  const currentIRR = computeSimplifiedIRR(baseAssumptions, defaultDealParams, bundleId, years);
  const currentD = computeMahalanobisD(baseAssumptions, baseAssumptions, sigma);
  const { band: currentBand } = aggressivenessBand(currentD * currentD);

  // Compute per-variable IR sensitivity (for roadmap IRR lift attribution)
  const sensitivity: Record<string, number> = {};
  for (const v of ADJUSTABLE_VARS) {
    sensitivity[v.id] = estimateSingleVarIRRSensitivity(
      v.id, baseAssumptions, defaultDealParams, bundleId, years, 0.01,
    );
  }

  // Run grid search across aggressiveness budgets
  const candidates: CandidateSolution[] = [];
  for (const budget of aggressivenessBudgets) {
    const result = gridSearch(
      baseAssumptions,
      targetIRR,
      defaultDealParams,
      bundleId,
      lockedSet,
      years,
      sigma,
    );
    if (result && result.d <= budget) {
      candidates.push(result);
    }
  }

  // Pick the best candidate (lowest d among those close to target)
  const targetThreshold = 0.005; // within 50bps of target
  const bestCandidate = candidates
    .filter(c => Math.abs(c.irr - targetIRR) < targetThreshold)
    .sort((a, b) => a.d - b.d)[0]
    ?? candidates.sort((a, b) => a.d - b.d)[0];

  if (!bestCandidate) {
    // No feasible path found
    const steps: RoadmapStep[] = [];
    return {
      targetIRR,
      currentIRR,
      currentD,
      currentBand,
      steps,
      projectedIRR: currentIRR,
      projectedD: currentD,
      projectedBand: currentBand,
      recommendation: `Cannot reach ${(targetIRR * 100).toFixed(1)}% IRR under ${bundle.name}. Current max achievable: ${(currentIRR * 100).toFixed(1)}%. Consider different debt structure or revisiting base assumptions.`,
      regime,
      holdPeriodYears,
      bundleId,
      bundleName: bundle.name,
      targetReachable: false,
      applyPayload: { assumptions: { ...baseAssumptions }, expenseOverrides: {}, changed: [], summary: 'No feasible path.' },
    };
  }

  // Build roadmap steps
  const steps: RoadmapStep[] = [];
  const changed: string[] = [];
  const expenseOverrides: Record<string, number> = {};
  let totalIrLift = 0;
  let totalDCost = 0;

  for (const v of ADJUSTABLE_VARS) {
    const baseVal = baseAssumptions[v.id] ?? 0;
    const suggestedVal = bestCandidate.assumptions[v.id] ?? baseVal;
    const diff = Math.abs(suggestedVal - baseVal);

    if (diff < 0.0005) continue; // no meaningful change

    // Estimate IRR lift
    const irrLift = computeSimplifiedIRR(
      { ...baseAssumptions, [v.id]: suggestedVal },
      defaultDealParams,
      bundleId,
      years,
    ) - computeSimplifiedIRR(baseAssumptions, defaultDealParams, bundleId, years);

    // Compute marginal d cost
    const baseD = computeMahalanobisD(baseAssumptions, baseAssumptions, sigma);
    const adjD = computeMahalanobisD(
      { ...baseAssumptions, [v.id]: suggestedVal },
      baseAssumptions,
      sigma,
    );
    const dCost = Math.max(0, adjD - baseD);

    const locked = lockedSet.has(v.id);

    steps.push({
      varId: v.id,
      label: v.label,
      category: v.category,
      currentValue: baseVal,
      suggestedValue: suggestedVal,
      irrLiftPp: Math.round(irrLift * 1000) / 10, // in percentage points (e.g., 1.2)
      dCost: Math.round(dCost * 100) / 100,
      isExpenseLineItem: v.isExpenseLineItem,
      locked,
      feasibility: assessFeasibility(v.id, baseVal, suggestedVal, sigma),
    });

    totalIrLift += irrLift;
    totalDCost += dCost;
    changed.push(v.id);
  }

  // Expense line item adjustments
  if (Object.keys(expenseLineItems).length > 0) {
    const oldBlended = baseAssumptions.expense_growth ?? DEFAULT_EXPENSE_GROWTH;
    const newBlended = bestCandidate.assumptions.expense_growth ?? oldBlended;
    const expAdjustments = computeExpenseAdjustments(
      expenseLineItems,
      controllableExpenseKeys.length > 0 ? controllableExpenseKeys : Object.keys(CONTROLLABLE_EXPENSE_KEYS),
      oldBlended,
      newBlended,
      lockedSet,
    );

    for (const [key, adj] of expAdjustments) {
      if (Math.abs(adj.suggested - adj.current) < 0.0005) continue;

      steps.push({
        varId: `expense:${key}`,
        label: key,
        category: 'expense',
        currentValue: adj.current,
        suggestedValue: adj.suggested,
        irrLiftPp: Math.round(adj.irrLiftPp * 1000) / 10,
        dCost: 0.1, // small per-line-item cost
        isExpenseLineItem: true,
        locked: adj.locked,
        feasibility: (adj.suggested < 0.01) ? 'aggressive' : (adj.suggested < adj.current * 0.7) ? 'moderate' : 'straightforward',
      });

      expenseOverrides[key] = adj.suggested;
      changed.push(`expense:${key}`);
    }
  }

  // Build apply payload
  const applyAssumptions: Record<string, number> = { ...baseAssumptions };
  for (const v of ADJUSTABLE_VARS) {
    if (bestCandidate.assumptions[v.id] !== undefined) {
      applyAssumptions[v.id] = bestCandidate.assumptions[v.id];
    }
  }

  const projectedIRR = computeSimplifiedIRR(applyAssumptions, defaultDealParams, bundleId, years);
  const projectedD = computeMahalanobisD(applyAssumptions, baseAssumptions, sigma);
  const { band: projectedBand } = aggressivenessBand(projectedD * projectedD);

  // Build recommendation
  let recommendation: string;
  if (Math.abs(projectedIRR - targetIRR) < targetThreshold) {
    const hardest = steps.filter(s => !s.locked).sort((a, b) => {
      const order = { heroic: 3, aggressive: 2, moderate: 1, straightforward: 0 };
      return (order[b.feasibility] ?? 0) - (order[a.feasibility] ?? 0);
    })[0];
    recommendation = `Target ${(targetIRR * 100).toFixed(1)}% IRR is achievable under ${bundle.name}. ` +
      `Projected: ${(projectedIRR * 100).toFixed(1)}% at d=${projectedD.toFixed(1)} (${projectedBand}). ` +
      `Current: ${(currentIRR * 100).toFixed(1)}% at d=${currentD.toFixed(1)} (${currentBand}). ` +
      (hardest ? `Hardest adjustment: ${hardest.label} from ${(hardest.currentValue * 100).toFixed(1)}% → ${(hardest.suggestedValue * 100).toFixed(1)}% (${hardest.feasibility}).` : '');
  } else {
    recommendation = `Cannot fully reach ${(targetIRR * 100).toFixed(1)}% IRR under ${bundle.name}. ` +
      `Best achievable: ${(projectedIRR * 100).toFixed(1)}% at d=${projectedD.toFixed(1)} (${projectedBand}). ` +
      `Gap: ${((targetIRR - projectedIRR) * 100).toFixed(1)}pp. Consider relaxing constraints or choosing a different bundle.`;
  }

  return {
    targetIRR,
    currentIRR,
    currentD,
    currentBand,
    steps,
    projectedIRR,
    projectedD,
    projectedBand,
    recommendation,
    regime,
    holdPeriodYears,
    bundleId,
    bundleName: bundle.name,
    targetReachable: Math.abs(projectedIRR - targetIRR) < targetThreshold,
    applyPayload: {
      assumptions: applyAssumptions,
      expenseOverrides,
      changed: [...new Set(changed)],
      summary: `${changed.length} adjustments applied. ` +
        `IRR: ${(currentIRR * 100).toFixed(1)}% → ${(projectedIRR * 100).toFixed(1)}% ` +
        `(d: ${currentD.toFixed(1)} → ${projectedD.toFixed(1)}).`,
    },
  };
}
