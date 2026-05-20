/**
 * Broader Goal Seek Service — bisection solver for any (input variable → target metric) pair.
 *
 * Supported solve variables:
 *   purchase_price, exit_cap_rate, rent_growth, hold_period, ltv, interest_rate
 *
 * Supported target metrics:
 *   irr, equity_multiple, cash_on_cash
 *
 * Algorithm: bisection over the variable's plausible search range until
 * |metric(x) - target| < TOLERANCE, or no-solution if target is not bracketed.
 *
 * Hold period uses integer scan (not bisection) because it is discrete.
 *
 * When proFormaAssumptions is provided the solver calls runModel() (the real
 * deterministic F9 engine) for each iteration step, ensuring results are fully
 * consistent with what the user sees in the proforma.  Without it the solver
 * falls back to a lightweight analytic approximation.
 */

import { logger } from '../../utils/logger';
import { runModel, ModelAssumptions as FlatModelAssumptions } from '../deterministic/deterministic-model-runner';
import { mapProFormaAssumptionsToModelAssumptions } from '../deterministic/proforma-assumptions-bridge';
import type { ProFormaAssumptions } from '../financial-model-engine.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SolveVariable =
  | 'purchase_price'
  | 'exit_cap_rate'
  | 'rent_growth'
  | 'hold_period'
  | 'ltv'
  | 'interest_rate';

export type TargetMetric = 'irr' | 'equity_multiple' | 'cash_on_cash';

export interface BroaderGoalSeekInput {
  solveFor: SolveVariable;
  targetMetric: TargetMetric;
  targetValue: number;

  // ── Simplified fallback params (used when proFormaAssumptions is absent) ──
  purchasePrice: number;
  noiYear1: number;
  holdYears: number;
  exitCapRate: number;
  debtRate: number;
  ltv: number;
  noiGrowthRate: number;
  sellingCostsPct: number;
  ioPeriodYears?: number;
  amortYears?: number;

  // ── Full F9 assumptions (enables runModel-backed evaluation) ──────────────
  proFormaAssumptions?: ProFormaAssumptions;

  searchLo?: number;
  searchHi?: number;
}

export interface BroaderGoalSeekResult {
  solveFor: SolveVariable;
  targetMetric: TargetMetric;
  targetValue: number;
  solvedValue: number | null;
  originalValue: number;
  achievedMetricValue: number | null;
  converged: boolean;
  iterations: number;
  noSolution: boolean;
  noSolutionReason: string | null;
  rangeTriedLo: number;
  rangeTriedHi: number;
  metricAtLo: number | null;
  metricAtHi: number | null;
  /** true when the solver used the full deterministic runModel engine */
  usedFullEngine: boolean;
}

// ─── runModel-backed evaluation ───────────────────────────────────────────────

function applyToFlat(a: FlatModelAssumptions, variable: SolveVariable, val: number): FlatModelAssumptions {
  const copy: FlatModelAssumptions = { ...a, rentGrowth: [...a.rentGrowth] };
  switch (variable) {
    case 'purchase_price':
      copy.purchasePrice = val;
      copy.loanAmount = val * a.ltv;
      break;
    case 'exit_cap_rate':
      copy.exitCap = val;
      break;
    case 'rent_growth':
      copy.rentGrowth = copy.rentGrowth.map(() => val);
      break;
    case 'hold_period':
      copy.holdYears = Math.round(val);
      copy.term = Math.max(copy.term, Math.round(val));
      break;
    case 'ltv':
      copy.ltv = Math.min(0.9999, Math.max(0.0001, val));
      copy.loanAmount = a.purchasePrice * copy.ltv;
      break;
    case 'interest_rate':
      copy.rate = val;
      break;
  }
  return copy;
}

function extractFromFlat(a: FlatModelAssumptions, variable: SolveVariable): number {
  switch (variable) {
    case 'purchase_price': return a.purchasePrice;
    case 'exit_cap_rate':  return a.exitCap;
    case 'rent_growth':    return a.rentGrowth[0] ?? 0.03;
    case 'hold_period':    return a.holdYears;
    case 'ltv':            return a.ltv;
    case 'interest_rate':  return a.rate;
  }
}

function extractMetricFromRunModelResult(
  result: ReturnType<typeof runModel>,
  metric: TargetMetric,
): number | null {
  switch (metric) {
    case 'irr':             return result.summary.irr;
    case 'equity_multiple': return result.summary.equityMultiple;
    case 'cash_on_cash':    return result.summary.cashOnCashByYear?.[0] ?? result.summary.avgCoC ?? null;
  }
}

// ─── Simplified fallback (analytic approximation) ─────────────────────────────
//
// Used when proFormaAssumptions is not provided.  Gives a fast approximation
// that may diverge slightly from the full engine for edge cases.

function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return principal * r * Math.pow(1 + r, termMonths) / (Math.pow(1 + r, termMonths) - 1);
}

function remainingBalance(
  principal: number,
  annualRate: number,
  totalTermMonths: number,
  paymentsMade: number,
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return Math.max(0, principal - (principal / totalTermMonths) * paymentsMade);
  const pmt = monthlyPayment(principal, annualRate, totalTermMonths);
  return Math.max(0, principal * Math.pow(1 + r, paymentsMade) - pmt * (Math.pow(1 + r, paymentsMade) - 1) / r);
}

function computeIrrBisect(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const npv = (r: number) => cashFlows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  const v0 = npv(0);
  if (Math.abs(v0) < 1e-4) return 0;
  let lo = -0.9999, hi = 10.0;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const m = npv(mid);
    if (Math.abs(m) < 1e-6 || hi - lo < 1e-10) return parseFloat(mid.toFixed(6));
    if (v0 > 0 ? m > 0 : m < 0) lo = mid; else hi = mid;
  }
  return parseFloat(((lo + hi) / 2).toFixed(6));
}

interface DealParams {
  purchasePrice: number;
  noiYear1: number;
  holdYears: number;
  exitCapRate: number;
  debtRate: number;
  ltv: number;
  noiGrowthRate: number;
  sellingCostsPct: number;
  ioPeriodYears: number;
  amortYears: number;
}

interface DealMetrics {
  irr: number | null;
  equity_multiple: number | null;
  cash_on_cash: number | null;
}

function computeMetrics(p: DealParams): DealMetrics {
  if (
    p.purchasePrice <= 0 ||
    p.noiYear1 <= 0 ||
    p.holdYears < 1 ||
    p.exitCapRate <= 0 ||
    p.debtRate < 0 ||
    p.ltv < 0 ||
    p.ltv >= 1
  ) {
    return { irr: null, equity_multiple: null, cash_on_cash: null };
  }

  const loan = p.purchasePrice * p.ltv;
  const equity = p.purchasePrice * (1 - p.ltv);
  if (equity <= 0) return { irr: null, equity_multiple: null, cash_on_cash: null };

  const ioYears = Math.max(0, p.ioPeriodYears);
  const amortMonths = Math.max(1, p.amortYears) * 12;
  const ioPmt = loan * p.debtRate;
  const amortPmt = monthlyPayment(loan, p.debtRate, amortMonths) * 12;

  const cashFlows: number[] = [-equity];

  for (let y = 1; y <= p.holdYears; y++) {
    const noi = p.noiYear1 * Math.pow(1 + p.noiGrowthRate, y - 1);
    const ds = y <= ioYears ? ioPmt : amortPmt;
    const cfads = noi - ds;

    if (y < p.holdYears) {
      cashFlows.push(cfads);
    } else {
      const exitNoi = noi * (1 + p.noiGrowthRate);
      const grossSale = exitNoi / p.exitCapRate;
      const sellingCosts = grossSale * p.sellingCostsPct;
      const monthsAmortized = y <= ioYears ? 0 : (y - ioYears) * 12;
      const loanBal = y <= ioYears
        ? loan
        : remainingBalance(loan, p.debtRate, amortMonths, monthsAmortized);
      const netSale = grossSale - sellingCosts - loanBal;
      cashFlows.push(cfads + netSale);
    }
  }

  const irr = computeIrrBisect(cashFlows);
  const totalReturn = cashFlows.slice(1).reduce((s, cf) => s + cf, 0);
  const equity_multiple = equity > 0 ? (totalReturn + equity) / equity : null;
  const cfY1 = cashFlows[1] ?? 0;
  const cash_on_cash = equity > 0 ? cfY1 / equity : null;

  return { irr, equity_multiple, cash_on_cash };
}

// ─── Variable metadata (search ranges + display labels) ──────────────────────

interface VariableMeta {
  label: string;
  unit: 'percent' | 'dollars' | 'years';
  defaultLo: (base: DealParams) => number;
  defaultHi: (base: DealParams) => number;
  applyTo: (p: DealParams, val: number) => DealParams;
  extractFrom: (p: DealParams) => number;
  isInteger?: boolean;
  formatValue: (v: number) => string;
  /** true = metric becomes null when variable is too large (e.g. purchase_price, interest_rate) */
  nullAtHigh?: boolean;
}

const VARIABLE_META: Record<SolveVariable, VariableMeta> = {
  purchase_price: {
    label: 'Purchase Price',
    unit: 'dollars',
    defaultLo: (p) => Math.max(100_000, p.purchasePrice * 0.20),
    defaultHi: (p) => {
      const maxByDs = p.ltv > 0 && p.debtRate > 0
        ? (p.noiYear1 / (p.ltv * p.debtRate)) * 0.80
        : p.purchasePrice * 2.0;
      return Math.min(maxByDs, p.purchasePrice * 2.5);
    },
    applyTo: (p, v) => ({ ...p, purchasePrice: v }),
    extractFrom: (p) => p.purchasePrice,
    formatValue: (v) => `$${Math.round(v).toLocaleString()}`,
    nullAtHigh: true,
  },
  exit_cap_rate: {
    label: 'Exit Cap Rate',
    unit: 'percent',
    defaultLo: () => 0.030,
    defaultHi: () => 0.120,
    applyTo: (p, v) => ({ ...p, exitCapRate: v }),
    extractFrom: (p) => p.exitCapRate,
    formatValue: (v) => `${(v * 100).toFixed(2)}%`,
    nullAtHigh: true,
  },
  rent_growth: {
    label: 'Rent / NOI Growth',
    unit: 'percent',
    defaultLo: () => -0.05,
    defaultHi: () => 0.15,
    applyTo: (p, v) => ({ ...p, noiGrowthRate: v }),
    extractFrom: (p) => p.noiGrowthRate,
    formatValue: (v) => `${(v * 100).toFixed(2)}%`,
    nullAtHigh: false,
  },
  hold_period: {
    label: 'Hold Period',
    unit: 'years',
    defaultLo: () => 1,
    defaultHi: () => 15,
    applyTo: (p, v) => ({ ...p, holdYears: Math.round(v) }),
    extractFrom: (p) => p.holdYears,
    isInteger: true,
    formatValue: (v) => `${Math.round(v)} yr`,
  },
  ltv: {
    label: 'LTV',
    unit: 'percent',
    defaultLo: () => 0.10,
    defaultHi: () => 0.90,
    applyTo: (p, v) => ({ ...p, ltv: Math.min(0.9999, Math.max(0.0001, v)) }),
    extractFrom: (p) => p.ltv,
    formatValue: (v) => `${(v * 100).toFixed(1)}%`,
    nullAtHigh: true,
  },
  interest_rate: {
    label: 'Interest Rate',
    unit: 'percent',
    defaultLo: () => 0.01,
    defaultHi: () => 0.18,
    applyTo: (p, v) => ({ ...p, debtRate: v }),
    extractFrom: (p) => p.debtRate,
    formatValue: (v) => `${(v * 100).toFixed(2)}%`,
    nullAtHigh: true,
  },
};

const METRIC_LABELS: Record<TargetMetric, string> = {
  irr: 'IRR',
  equity_multiple: 'Equity Multiple',
  cash_on_cash: 'Cash-on-Cash',
};

// ─── Main solver ──────────────────────────────────────────────────────────────

const BISECT_TOLERANCE = 1e-6;
const MAX_ITER = 100;

function getMetricValue(metrics: DealMetrics, target: TargetMetric): number | null {
  return metrics[target];
}

export async function runBroaderGoalSeek(
  input: BroaderGoalSeekInput,
): Promise<BroaderGoalSeekResult> {
  const varMeta = VARIABLE_META[input.solveFor];
  if (!varMeta) {
    throw new Error(`Unknown solve variable: ${input.solveFor}`);
  }

  // ── Choose evaluation strategy ──────────────────────────────────────────
  // When the caller supplies the full ProForma assumptions, bridge them to the
  // flat ModelAssumptions shape and call runModel() for each bisection step so
  // the solver works against the SAME deterministic engine the user sees in F9.

  let flatBase: FlatModelAssumptions | null = null;
  if (input.proFormaAssumptions) {
    try {
      flatBase = mapProFormaAssumptionsToModelAssumptions(input.proFormaAssumptions);
    } catch (err) {
      logger.warn('[broader-goal-seek] mapProFormaAssumptionsToModelAssumptions failed, falling back to simplified model', { err });
      flatBase = null;
    }
  }

  const usedFullEngine = flatBase !== null;

  const evalAt = usedFullEngine
    ? (val: number): number | null => {
        const mutated = applyToFlat(flatBase!, input.solveFor, val);
        try {
          const result = runModel(mutated, { skipSensitivity: true });
          return extractMetricFromRunModelResult(result, input.targetMetric);
        } catch {
          return null;
        }
      }
    : (val: number): number | null => {
        const p = varMeta.applyTo(baseParams, val);
        const m = computeMetrics(p);
        return getMetricValue(m, input.targetMetric);
      };

  // ── Derive original value and base params ────────────────────────────────
  const originalValue = usedFullEngine
    ? extractFromFlat(flatBase!, input.solveFor)
    : varMeta.extractFrom({
        purchasePrice: input.purchasePrice,
        noiYear1: input.noiYear1,
        holdYears: input.holdYears,
        exitCapRate: input.exitCapRate,
        debtRate: input.debtRate,
        ltv: input.ltv,
        noiGrowthRate: input.noiGrowthRate,
        sellingCostsPct: input.sellingCostsPct,
        ioPeriodYears: input.ioPeriodYears ?? 0,
        amortYears: input.amortYears ?? 30,
      });

  const baseParams: DealParams = {
    purchasePrice: input.purchasePrice,
    noiYear1: input.noiYear1,
    holdYears: input.holdYears,
    exitCapRate: input.exitCapRate,
    debtRate: input.debtRate,
    ltv: input.ltv,
    noiGrowthRate: input.noiGrowthRate,
    sellingCostsPct: input.sellingCostsPct,
    ioPeriodYears: input.ioPeriodYears ?? 0,
    amortYears: input.amortYears ?? 30,
  };

  const lo = input.searchLo ?? varMeta.defaultLo(baseParams);
  const hi = input.searchHi ?? varMeta.defaultHi(baseParams);

  logger.info('[broader-goal-seek] Starting', {
    solveFor: input.solveFor,
    targetMetric: input.targetMetric,
    targetValue: input.targetValue,
    usedFullEngine,
    lo, hi,
  });

  // ── Integer scan for hold_period ────────────────────────────────────────
  if (varMeta.isInteger) {
    const intLo = Math.max(1, Math.round(lo));
    const intHi = Math.min(30, Math.round(hi));
    let bestVal: number | null = null;
    let bestDiff = Infinity;
    let bestMetric: number | null = null;
    let iters = 0;

    for (let v = intLo; v <= intHi; v++) {
      iters++;
      const m = evalAt(v);
      if (m === null) continue;
      const diff = Math.abs(m - input.targetValue);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestVal = v;
        bestMetric = m;
      }
    }

    const converged = bestDiff < 0.005;
    const metricAtLo = evalAt(intLo);
    const metricAtHi = evalAt(intHi);
    const isInRange = metricAtLo !== null && metricAtHi !== null;
    const bracketed = isInRange
      ? (metricAtLo - input.targetValue) * (metricAtHi - input.targetValue) <= 0
      : false;

    return {
      solveFor: input.solveFor,
      targetMetric: input.targetMetric,
      targetValue: input.targetValue,
      solvedValue: converged ? bestVal : null,
      originalValue,
      achievedMetricValue: bestMetric,
      converged,
      iterations: iters,
      noSolution: !converged,
      noSolutionReason: !converged
        ? bracketed
          ? `Closest hold period is ${bestVal} yr (${METRIC_LABELS[input.targetMetric]}: ${bestMetric !== null ? (bestMetric * 100).toFixed(1) + '%' : 'N/A'}, target: ${(input.targetValue * 100).toFixed(1)}%)`
          : `Target ${METRIC_LABELS[input.targetMetric]} of ${(input.targetValue * 100).toFixed(1)}% not achievable for any hold period ${intLo}–${intHi} yr`
        : null,
      rangeTriedLo: intLo,
      rangeTriedHi: intHi,
      metricAtLo,
      metricAtHi,
      usedFullEngine,
    };
  }

  // ── Continuous bisection ────────────────────────────────────────────────
  const nullAtHigh = varMeta.nullAtHigh ?? true;
  const BOUNDARY_STEPS = 20;

  let effectiveLo = lo;
  let effectiveHi = hi;

  let mLo = evalAt(effectiveLo);
  if (mLo === null) {
    const step = (hi - lo) / BOUNDARY_STEPS;
    for (let i = 1; i <= BOUNDARY_STEPS; i++) {
      effectiveLo = lo + step * i;
      mLo = evalAt(effectiveLo);
      if (mLo !== null) break;
    }
  }

  let mHi = evalAt(effectiveHi);
  if (mHi === null) {
    const step = (hi - lo) / BOUNDARY_STEPS;
    for (let i = 1; i <= BOUNDARY_STEPS; i++) {
      effectiveHi = hi - step * i;
      mHi = evalAt(effectiveHi);
      if (mHi !== null) break;
    }
  }

  const metricAtLo = mLo;
  const metricAtHi = mHi;

  if (mLo === null || mHi === null) {
    return {
      solveFor: input.solveFor,
      targetMetric: input.targetMetric,
      targetValue: input.targetValue,
      solvedValue: null,
      originalValue,
      achievedMetricValue: null,
      converged: false,
      iterations: 0,
      noSolution: true,
      noSolutionReason: `Could not compute ${METRIC_LABELS[input.targetMetric]} within search range — the deal may not be viable. Check NOI, LTV, and debt rate.`,
      rangeTriedLo: lo,
      rangeTriedHi: hi,
      metricAtLo,
      metricAtHi,
      usedFullEngine,
    };
  }

  const diff0 = mLo - input.targetValue;
  const diff1 = mHi - input.targetValue;

  if (diff0 * diff1 > 0) {
    const closerSide = Math.abs(diff0) < Math.abs(diff1) ? 'low end' : 'high end';
    const metricLow  = formatMetricValue(mLo, input.targetMetric);
    const metricHigh = formatMetricValue(mHi, input.targetMetric);
    const metricRange = mLo > mHi ? `${metricHigh} – ${metricLow}` : `${metricLow} – ${metricHigh}`;
    return {
      solveFor: input.solveFor,
      targetMetric: input.targetMetric,
      targetValue: input.targetValue,
      solvedValue: null,
      originalValue,
      achievedMetricValue: null,
      converged: false,
      iterations: 2,
      noSolution: true,
      noSolutionReason: `Target ${METRIC_LABELS[input.targetMetric]} of ${formatMetricValue(input.targetValue, input.targetMetric)} is outside the achievable range. ` +
        `${varMeta.label} searched: ${varMeta.formatValue(effectiveLo)} – ${varMeta.formatValue(effectiveHi)}. ` +
        `Achievable range: ${metricRange} (closest at ${closerSide}).`,
      rangeTriedLo: effectiveLo,
      rangeTriedHi: effectiveHi,
      metricAtLo,
      metricAtHi,
      usedFullEngine,
    };
  }

  let a = effectiveLo, b = effectiveHi;
  let mA = mLo;
  let iter = 0;
  let mid = (a + b) / 2;
  let mMid: number | null = null;

  for (; iter < MAX_ITER; iter++) {
    mid = (a + b) / 2;
    mMid = evalAt(mid);

    if (mMid === null) {
      if (nullAtHigh) {
        b = mid;
      } else {
        a = mid;
      }
      continue;
    }

    if (Math.abs(mMid - input.targetValue) < BISECT_TOLERANCE || (b - a) < 1e-10) {
      break;
    }

    const dMid = mMid - input.targetValue;
    if (dMid * (mA - input.targetValue) <= 0) {
      b = mid;
    } else {
      a = mid; mA = mMid;
    }
  }

  const solvedValue = mid;
  const achievedMetricValue = mMid;
  const converged = achievedMetricValue !== null &&
    Math.abs(achievedMetricValue - input.targetValue) < 0.001;

  logger.info('[broader-goal-seek] Done', {
    solveFor: input.solveFor,
    targetMetric: input.targetMetric,
    targetValue: input.targetValue,
    solvedValue,
    achievedMetricValue,
    converged,
    iterations: iter,
    usedFullEngine,
  });

  return {
    solveFor: input.solveFor,
    targetMetric: input.targetMetric,
    targetValue: input.targetValue,
    solvedValue: converged ? parseFloat(solvedValue.toFixed(8)) : null,
    originalValue,
    achievedMetricValue,
    converged,
    iterations: iter,
    noSolution: !converged,
    noSolutionReason: !converged
      ? `Could not converge on ${METRIC_LABELS[input.targetMetric]} = ${formatMetricValue(input.targetValue, input.targetMetric)} within ${MAX_ITER} iterations.`
      : null,
    rangeTriedLo: lo,
    rangeTriedHi: hi,
    metricAtLo,
    metricAtHi,
    usedFullEngine,
  };
}

function formatMetricValue(v: number, metric: TargetMetric): string {
  if (metric === 'equity_multiple') return `${v.toFixed(2)}×`;
  return `${(v * 100).toFixed(2)}%`;
}
