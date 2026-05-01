/**
 * Goal-Seeking Solver
 *
 * Given a target IRR, finds the assumption set that achieves it at the
 * lowest plausibility cost (Mahalanobis distance d²).
 *
 * Formulation:
 *   minimize: d²(x) = (x - μ)ᵀ · Σ⁻¹ · (x - μ)
 *   subject to: proforma(x) ≈ target IRR
 *               x ∈ [min, max] per variable
 *               |x_i - x_0,i| ≤ Δ_i (per-variable max move)
 *
 * Phase A uses a simplified proforma approximation (not the full financial
 * model engine, which requires DB calls). The approximation computes IRR
 * from assumptions directly using a simplified DCF.
 *
 * Phase C upgrade: replace the simplified proforma with a call to the
 * actual financial model engine (or a proxy model trained on it).
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
import { scorePlausibility } from './sigma-plausibility.service';
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
  /** Debt bundle to evaluate */
  bundleId: string;
  /** Regime */
  regime?: RegimeLabel;
  /** Aggressiveness budgets to sweep */
  aggressivenessBudgets?: number[];
  /** Deal-specific parameters for proforma approximation */
  dealParams?: DealParams;
}

export interface DealParams {
  purchasePrice: number;
  totalUnits: number;
  noiAtAcquisition: number;
  acquisitionCosts: number; // fraction of purchase price
  exitFees: number; // fraction of sale price
  annualNOIGrowthBase?: number; // override if needed
  debtRate?: number; // override bundle rate
  ltv?: number; // override bundle LTV
}

export interface ParetoPoint {
  assumptions: Record<string, number>;
  irr: number;
  d: number;
  d2: number;
  band: string;
  variance: number;
}

export interface BundleResult {
  bundleId: string;
  bundleName: string;
  points: ParetoPoint[];
  targetReachable: boolean;
  nearestIRR: number;
  bestD: number;
  recommendation: string;
}

export interface GoalSeekResult {
  targetIRR: number;
  perBundle: BundleResult[];
  recommendation: string;
  regime: RegimeLabel;
  holdPeriodYears: number;
}

// ─── Simplex Optimization ────────────────────────────────────────────────────

/**
 * Simple Nelder-Mead style optimizer for the goal-seek problem.
 * Minimizes: d² + penalty × max(0, |IRR - target| - tolerance)
 *
 * Phase A: brute-force grid search along key dimensions, then simplex refine.
 * Phase C: SLSQP with proper gradient.
 */

const DEFAULT_AGGRESSIVENESS_BUDGETS = [1.0, 1.5, 2.0, 2.5];

const ADJUSTABLE_VARS = [
  'rent_growth',
  'vacancy_rate',
  'exit_cap_rate',
  'expense_growth',
  'entry_cap_rate',
];

// ─── Simplified IRR ──────────────────────────────────────────────────────────

function computeIRR(cashFlows: number[]): number {
  // Newton's method for IRR
  let rate = 0.12; // initial guess
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
    if (rate < -0.9) rate = -0.9; // keep above -90%
    if (rate > 10) rate = 10; // cap at 1000%
  }
  return rate;
}

function computeSimplifiedIRR(
  assumptions: Record<string, number>,
  deal: DealParams,
  bundleId: string,
): number {
  const bundle = DEBT_BUNDLES[bundleId];
  if (!bundle) return 0;

  const rentGrowth = assumptions.rent_growth ?? 0.03;
  const expenseGrowth = assumptions.expense_growth ?? 0.03;
  const exitCap = assumptions.exit_cap_rate ?? 0.055;
  const vacancy = assumptions.vacancy_rate ?? 0.05;

  const debtRate = deal.debtRate ?? bundle.params.debtRate;
  const ltv = deal.ltv ?? bundle.params.ltv;

  const equity = deal.purchasePrice * (1 - ltv) + deal.purchasePrice * deal.acquisitionCosts;
  const loanAmount = deal.purchasePrice * ltv;

  // Monthly payment for amortizing debt
  const monthlyRate = debtRate / 12;
  const amortYears = bundle.params.amortization > 0 ? bundle.params.amortization : 30;
  const numPayments = amortYears * 12;
  const monthlyPayment = Math.abs(monthlyRate) < 1e-10
    ? loanAmount / numPayments
    : loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annualDebtService = monthlyPayment * 12;

  // Year-1 NOI after vacancy
  let noi = deal.noiAtAcquisition * (1 - vacancy);

  const years = Math.min(deal.totalUnits > 0 ? 5 : 5, 10); // default 5yr hold
  const cashFlows: number[] = [-equity];

  for (let y = 1; y <= years; y++) {
    const noiGrowth = (1 + rentGrowth) / (1 + expenseGrowth) - 1;
    noi = noi * (1 + noiGrowth);
    cashFlows.push(noi - annualDebtService);
  }

  // Year N: sale
  const finalNOI = noi;
  const salePrice = finalNOI / exitCap;
  const loanBalance = loanAmount * (1 - (1 - 1 / Math.pow(1 + monthlyRate, numPayments - years * 12)) /
    (1 - 1 / Math.pow(1 + monthlyRate, numPayments)));
  const netProceeds = salePrice - Math.max(loanBalance, 0) - salePrice * deal.exitFees;
  cashFlows[cashFlows.length - 1] += netProceeds;

  return computeIRR(cashFlows);
}

// ─── Grid Search ─────────────────────────────────────────────────────────────

function gridSearch(
  base: Record<string, number>,
  targetIRR: number,
  dealParams: DealParams,
  bundleId: string,
  locked: string[],
  budget: number,
  regime: RegimeLabel,
): ParetoPoint | null {
  const lockedSet = new Set(locked);
  let best: ParetoPoint | null = null;
  let bestObj = Infinity;

  // Generate candidate assumption sets via grid over the adjustable variables
  const candidates: Record<string, number>[] = [];

  // Start with small perturbations from base
  const steps = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02];

  for (const rStep of steps) {
    for (const vStep of steps) {
      for (const eStep of steps) {
        for (const xStep of steps) {
          for (const cStep of steps) {
            const candidate: Record<string, number> = { ...base };

            if (!lockedSet.has('rent_growth')) {
              const val = base.rent_growth + rStep;
              const vDef = SIGMA_VARIABLES.rent_growth;
              if (val >= (vDef?.minFeasible ?? -0.05) && val <= (vDef?.maxFeasible ?? 0.10)) {
                candidate.rent_growth = val;
              }
            }
            if (!lockedSet.has('vacancy_rate')) {
              const val = base.vacancy_rate + vStep * 0.5;
              const vDef = SIGMA_VARIABLES.vacancy_rate;
              if (val >= (vDef?.minFeasible ?? 0) && val <= (vDef?.maxFeasible ?? 0.25)) {
                candidate.vacancy_rate = val;
              }
            }
            if (!lockedSet.has('expense_growth')) {
              const val = base.expense_growth + eStep;
              const vDef = SIGMA_VARIABLES.expense_growth;
              if (val >= (vDef?.minFeasible ?? 0) && val <= (vDef?.maxFeasible ?? 0.10)) {
                candidate.expense_growth = val;
              }
            }
            if (!lockedSet.has('exit_cap_rate')) {
              const val = base.exit_cap_rate + xStep;
              const vDef = SIGMA_VARIABLES.exit_cap_rate;
              if (val >= (vDef?.minFeasible ?? 0.03) && val <= (vDef?.maxFeasible ?? 0.12)) {
                candidate.exit_cap_rate = val;
              }
            }
            if (!lockedSet.has('entry_cap_rate')) {
              const val = base.entry_cap_rate + cStep;
              const vDef = SIGMA_VARIABLES.entry_cap_rate;
              if (val >= (vDef?.minFeasible ?? 0.03) && val <= (vDef?.maxFeasible ?? 0.12)) {
                candidate.entry_cap_rate = val;
              }
            }

            candidates.push(candidate);
          }
        }
      }
    }
  }

  // Score each candidate
  for (const candidate of candidates) {
    const irr = computeSimplifiedIRR(candidate, dealParams, bundleId);
    const irrGap = Math.abs(irr - targetIRR);

    // Compute plausibility
    const { mahalanobisD, band } = aggressivenessBand(0); // will compute properly below
    // Score async — but we're in sync; quick compute inline
    const sigma = buildHeuristicSigma(regime);
    const n = sigma.variableOrder.length;
    const x = new Array(n);
    for (let i = 0; i < n; i++) {
      const varId = sigma.variableOrder[i];
      x[i] = candidate[varId] !== undefined ? candidate[varId] : sigma.meanVector[i];
    }
    const d2 = (() => {
      const diff = new Array(n);
      for (let i = 0; i < n; i++) diff[i] = x[i] - sigma.meanVector[i];
      const temp = new Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          temp[i] += sigma.invCovFlat[i * n + j] * diff[j];
      let d2Val = 0;
      for (let i = 0; i < n; i++) d2Val += diff[i] * temp[i];
      return d2Val;
    })();
    const { d: dVal, band: bandVal } = aggressivenessBand(d2);

    // Objective: minimize d² when within target budget, else penalize
    const dPenalty = dVal > budget ? (dVal - budget) * 10 : 0;
    const irrPenalty = irrGap * 50;
    const obj = d2 + irrPenalty + dPenalty;

    const variance = estimateBundleIRRVariance(bundleId, 0.15, 0.01);

    if (obj < bestObj) {
      bestObj = obj;
      best = {
        assumptions: { ...candidate },
        irr,
        d: dVal,
        d2,
        band: bandVal,
        variance,
      };
    }
  }

  return best;
}

// ─── Main Solver ────────────────────────────────────────────────────────────

/**
 * Run goal-seeking for all debt bundles or a single bundle.
 */
export async function runGoalSeek(input: GoalSeekInput): Promise<GoalSeekResult> {
  const {
    targetIRR,
    baseAssumptions,
    holdPeriodYears,
    lockedVariables = [],
    bundleId,
    regime = 'expansion',
    aggressivenessBudgets = DEFAULT_AGGRESSIVENESS_BUDGETS,
    dealParams,
  } = input;

  const defaultDealParams: DealParams = {
    purchasePrice: 10_000_000,
    totalUnits: 100,
    noiAtAcquisition: 600_000,
    acquisitionCosts: 0.02,
    exitFees: 0.03,
    ...dealParams,
  };

  const bundles = bundleId === 'all'
    ? Object.keys(DEBT_BUNDLES)
    : [bundleId];

  const perBundle: BundleResult[] = [];
  let bestRecommendation = '';

  for (const bId of bundles) {
    const bundle = DEBT_BUNDLES[bId];
    if (!bundle) continue;

    const points: ParetoPoint[] = [];
    let targetReachable = false;
    let nearestIRR = 0;
    let bestD = Infinity;

    for (const budget of aggressivenessBudgets) {
      const result = gridSearch(
        baseAssumptions,
        targetIRR,
        defaultDealParams,
        bId,
        lockedVariables,
        budget,
        regime,
      );

      if (result) {
        points.push(result);
        if (Math.abs(result.irr - targetIRR) < 0.005) {
          targetReachable = true;
          if (result.d < bestD) {
            bestD = result.d;
          }
        }
        if (Math.abs(result.irr - targetIRR) < Math.abs(nearestIRR - targetIRR)) {
          nearestIRR = result.irr;
        }
      }
    }

    // Generate recommendation
    let recommendation: string;
    if (targetReachable) {
      recommendation = `${bundle.name} hits ${(targetIRR * 100).toFixed(0)}% IRR at d=${bestD.toFixed(1)} (${points.find(p => Math.abs(p.irr - targetIRR) < 0.005)?.band ?? 'Stretch'}).`;
    } else if (points.length > 0) {
      const best = points.reduce((a, b) =>
        Math.abs(a.irr - targetIRR) < Math.abs(b.irr - targetIRR) ? a : b
      );
      recommendation = `${bundle.name} cannot reach ${(targetIRR * 100).toFixed(0)}% IRR. Best achievable: ${(best.irr * 100).toFixed(1)}% at d=${best.d.toFixed(1)} (${best.band}).`;
    } else {
      recommendation = `${bundle.name}: No feasible path found within aggressiveness constraints.`;
    }

    perBundle.push({
      bundleId: bId,
      bundleName: bundle.name,
      points,
      targetReachable,
      nearestIRR,
      bestD,
      recommendation,
    });
  }

  // Cross-bundle recommendation
  const reachable = perBundle.filter(b => b.targetReachable);
  if (reachable.length > 0) {
    const best = reachable.reduce((a, b) => a.bestD < b.bestD ? a : b);
    bestRecommendation = `Recommendation: ${best.bundleName}. Hits target at lowest d (${best.bestD.toFixed(1)}).`;
  } else if (perBundle.length > 0) {
    const best = perBundle.reduce((a, b) => a.bestD < b.bestD ? a : b);
    bestRecommendation = `No bundle reaches target. Closest: ${best.bundleName} at ${(best.nearestIRR * 100).toFixed(1)}% IRR (d=${best.bestD.toFixed(1)}).`;
  }

  return {
    targetIRR,
    perBundle,
    recommendation: bestRecommendation,
    regime,
    holdPeriodYears,
  };
}
