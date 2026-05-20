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
 */

import { logger } from '../../utils/logger';

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
}

// ─── Financial math (self-contained, mirrors optimize_capital_structure) ──────

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

/**
 * Core financial model: build levered equity cash flows and compute the
 * three supported target metrics.
 */
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
      // Cap at price where annual debt service ≈ NOI (break-even), with 20% cushion
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
const HOLD_SCAN_STEPS = 15;

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

  const originalValue = varMeta.extractFrom(baseParams);
  const lo = input.searchLo ?? varMeta.defaultLo(baseParams);
  const hi = input.searchHi ?? varMeta.defaultHi(baseParams);

  logger.info('[broader-goal-seek] Starting', {
    solveFor: input.solveFor,
    targetMetric: input.targetMetric,
    targetValue: input.targetValue,
    lo, hi,
  });

  const evalAt = (val: number): number | null => {
    const params = varMeta.applyTo(baseParams, val);
    const m = computeMetrics(params);
    return getMetricValue(m, input.targetMetric);
  };

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
    };
  }

  // ── Continuous bisection ────────────────────────────────────────────────
  //
  // Find valid boundaries: some variables (purchase_price, interest_rate) make
  // the metric undefined (null) at extreme values because the deal goes
  // underwater. Scan inward from the null boundary to find a valid endpoint.

  const nullAtHigh = varMeta.nullAtHigh ?? true;
  const BOUNDARY_STEPS = 20;

  let effectiveLo = lo;
  let effectiveHi = hi;

  // Scan inward if lo is null (uncommon, but possible for rent_growth negative extreme)
  let mLo = evalAt(effectiveLo);
  if (mLo === null) {
    const step = (hi - lo) / BOUNDARY_STEPS;
    for (let i = 1; i <= BOUNDARY_STEPS; i++) {
      effectiveLo = lo + step * i;
      mLo = evalAt(effectiveLo);
      if (mLo !== null) break;
    }
  }

  // Scan inward if hi is null (common for purchase_price at high prices)
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
    };
  }

  const diff0 = mLo - input.targetValue;
  const diff1 = mHi - input.targetValue;

  if (diff0 * diff1 > 0) {
    // Target is not bracketed — no solution in range
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
    };
  }

  // Bisect — null handling: when evalAt(mid) is null, the deal is infeasible at
  // that point. Pull the boundary inward (toward the valid side).
  let a = effectiveLo, b = effectiveHi;
  let mA = mLo;
  let iter = 0;
  let mid = (a + b) / 2;
  let mMid: number | null = null;

  for (; iter < MAX_ITER; iter++) {
    mid = (a + b) / 2;
    mMid = evalAt(mid);

    if (mMid === null) {
      // Treat null as "too extreme" in the nullAtHigh direction
      if (nullAtHigh) {
        b = mid; // pull hi inward
      } else {
        a = mid; // pull lo inward
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
  };
}

function formatMetricValue(v: number, metric: TargetMetric): string {
  if (metric === 'equity_multiple') return `${v.toFixed(2)}×`;
  return `${(v * 100).toFixed(2)}%`;
}
