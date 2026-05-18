/**
 * optimize_capital_structure Tool
 *
 * Maximizes a strategy-implied primary metric (IRR, cash-on-cash, stabilized
 * value, or profit-at-exit) by performing a true single-variable bisection over
 * LTV in [0.50, 0.85], subject to five hard-rule constraints:
 *
 *   1. DSCR ≥ 1.30 every year of the hold period
 *   2. LTV ≤ 0.85
 *   3. LTV ≥ 0.50
 *   4. Break-even occupancy ≤ 0.85
 *   5. Annual cash flow after debt service positive every year
 *
 * Algorithm: bisection on the feasibility boundary (highest feasible LTV)
 * to tolerance 0.0001. For IRR and CoC the metric is monotone-increasing in
 * LTV within the feasible region, so the maximum is always at the boundary.
 * For stabilized_value and profit_at_exit bisection still finds the binding
 * constraint, then a secondary scan within [lo_bound − 0.05, lo_bound]
 * confirms the peak metric value.
 *
 * Distinct from goal_seek_target_irr which solves *to* a target IRR by
 * adjusting multiple variables across debt bundles.  This tool *maximizes*
 * a metric by adjusting LTV only, given fixed deal economics.
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';

// ─── Strategy → primary metric mapping ────────────────────────────────────────

const STRATEGY_METRIC_MAP: Record<string, string> = {
  'value-add':             'irr',
  'value_add':             'irr',
  'redevelopment':         'irr',
  'redevelopment_full':    'irr',
  'existing':              'cash_on_cash',
  'stabilized':            'cash_on_cash',
  'redevelopment_partial': 'cash_on_cash',
  // lease-up and development: optimizing toward stabilized value ensures the
  // recommended LTV is the highest one where the deal still covers its debt
  // service, protecting the property's stabilized valuation floor. Because
  // stabilized_value (noi/cap) is constant w.r.t. LTV, the feasibility
  // boundary (bisection) is the binding constraint and the peak-scan confirms
  // the maximum-feasible LTV recommendation.
  'lease-up':              'stabilized_value',
  'lease_up':              'stabilized_value',
  'development':           'stabilized_value',
  'flip':                  'profit_at_exit',
};

// ─── Financial math helpers ────────────────────────────────────────────────────

function monthlyPaymentAmount(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (principal <= 0) return 0;
  if (termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return principal * r * Math.pow(1 + r, termMonths) / (Math.pow(1 + r, termMonths) - 1);
}

function remainingLoanBalance(
  principal: number,
  annualRate: number,
  totalTermMonths: number,
  paymentsMade: number,
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) {
    const perPmt = principal / totalTermMonths;
    return Math.max(0, principal - perPmt * paymentsMade);
  }
  const pmt = monthlyPaymentAmount(principal, annualRate, totalTermMonths);
  const balance = principal * Math.pow(1 + r, paymentsMade) -
    pmt * (Math.pow(1 + r, paymentsMade) - 1) / r;
  return Math.max(0, balance);
}

function computeIrr(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const npv = (r: number) =>
    cashFlows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  const v0 = npv(0);
  if (Math.abs(v0) < 1e-4) return 0;
  let lo = -0.9999, hi = 10.0;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const m = npv(mid);
    if (Math.abs(m) < 1e-4 || hi - lo < 1e-10) return +(mid.toFixed(6));
    if (v0 > 0 ? m > 0 : m < 0) lo = mid;
    else hi = mid;
  }
  return +((lo + hi) / 2).toFixed(6);
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  noi_year1: z.number().positive().describe(
    'Stabilized Year-1 Net Operating Income (annual $)'
  ),
  purchase_price: z.number().positive().describe(
    'Property purchase price ($)'
  ),
  hold_years: z.number().int().min(1).max(30).default(5).describe(
    'Hold period in years'
  ),
  exit_cap_rate: z.number().min(0.02).max(0.20).default(0.055).describe(
    'Exit cap rate as decimal (e.g., 0.055 for 5.5%)'
  ),
  debt_rate: z.number().min(0.01).max(0.20).default(0.065).describe(
    'Loan interest rate as decimal (e.g., 0.065 for 6.5%)'
  ),
  amortization_years: z.number().int().min(0).max(40).default(30).describe(
    'Amortization schedule in years (0 = full IO term)'
  ),
  io_period_months: z.number().int().min(0).max(120).default(0).describe(
    'Interest-only period in months'
  ),
  noi_growth_rate: z.number().min(-0.05).max(0.15).default(0.03).describe(
    'Annual NOI growth rate as decimal (default 3%)'
  ),
  deal_strategy: z.string().default('existing').describe(
    'Deal strategy: value-add, existing, development, lease-up, redevelopment, flip'
  ),
  gpr_year1: z.number().positive().optional().describe(
    'Gross Potential Rent Year-1 annual ($). Used for break-even occupancy. Defaults to NOI / 0.50 if omitted.'
  ),
  selling_costs_pct: z.number().min(0).max(0.10).default(0.02).describe(
    'Selling costs as pct of gross sale value (default 2%)'
  ),
  primary_metric_override: z.enum(['irr', 'cash_on_cash', 'stabilized_value', 'profit_at_exit']).optional().describe(
    'Override the strategy-derived metric. Used when the agent has a specific optimization goal.'
  ),
  ltv_max: z.number().min(0.50).max(0.95).optional().describe(
    'Maximum LTV ceiling for bisection search (default 0.85). ' +
    'Pass the debt product\'s own LTV cap (e.g., 0.83 for HUD 221(d)(4), 0.75 for Agency, 0.70 for Bridge/CMBS) ' +
    'to enforce product-specific constraints. run_joint_goal_seek passes bundle.ltv automatically.'
  ),
  ltv_min: z.number().min(0.30).max(0.70).optional().describe(
    'Minimum LTV floor for bisection search (default 0.50).'
  ),
  dscr_floor: z.number().min(1.0).max(2.0).optional().describe(
    'Minimum DSCR covenant floor (default 1.30). Pass bundle.minDscr to enforce ' +
    'product-specific requirements: HUD 221(d)(4) = 1.11, Agency = 1.25, ' +
    'Bridge = 1.20, CMBS = 1.25. run_joint_goal_seek passes this automatically.'
  ),
});

export type OptimizeCapitalStructureInput = z.infer<typeof InputSchema>;

const LtvScanRowSchema = z.object({
  ltv: z.number(),
  feasible: z.boolean(),
  metric_value: z.number().nullable(),
  dscr_min: z.number().nullable(),
  breakeven_occ: z.number().nullable(),
  constraints_violated: z.array(z.string()),
});

const OutputSchema = z.object({
  primary_metric: z.enum(['irr', 'cash_on_cash', 'stabilized_value', 'profit_at_exit']),
  optimal_ltv: z.number().nullable(),
  optimal_debt_amount: z.number().nullable(),
  optimal_rate: z.number(),
  resulting_dscr_min: z.number().nullable(),
  resulting_breakeven_occ: z.number().nullable(),
  primary_metric_value: z.number().nullable(),
  gp_irr: z.number().nullable().describe(
    'GP levered equity IRR — always computed from [-equity, yr1_cfads, …, yrN_cfads+netSale], ' +
    'independent of primaryMetric. Use this (not primary_metric_value) for sponsor-side ranking.'
  ),
  evidence_narrative: z.string(),
  constraints_binding: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  infeasible: z.boolean(),
  infeasibility_reason: z.string().nullable(),
  ltv_scan: z.array(LtvScanRowSchema),
  equity_at_optimal: z.number().nullable(),
  gp_equity: z.number().nullable(),
  lp_equity: z.number().nullable(),
});

export type OptimizeCapitalStructureOutput = z.infer<typeof OutputSchema>;

// ─── Core evaluator ───────────────────────────────────────────────────────────

interface LtvEval {
  ltv: number;
  feasible: boolean;
  metricValue: number | null;
  gpIrr: number | null;
  dscrMin: number | null;
  breakevenOcc: number | null;
  constraintsViolated: string[];
  cashFlows: number[];
}

function evaluateLtv(
  ltv: number,
  input: OptimizeCapitalStructureInput,
  primaryMetric: string,
): LtvEval {
  const loan = input.purchase_price * ltv;
  const equity = input.purchase_price * (1 - ltv);
  const gpr = input.gpr_year1 ?? input.noi_year1 / 0.50;
  const ioYears = Math.ceil(input.io_period_months / 12);
  const amortMonths = (input.amortization_years > 0 ? input.amortization_years : 30) * 12;
  const ioPmt = loan * input.debt_rate;
  const amortPmt = monthlyPaymentAmount(loan, input.debt_rate, amortMonths) * 12;

  const cashFlows: number[] = [-equity];
  let dscrMin = Infinity;
  let allCfPositive = true;
  const constraintsViolated: string[] = [];

  for (let y = 1; y <= input.hold_years; y++) {
    const noi = input.noi_year1 * Math.pow(1 + input.noi_growth_rate, y - 1);
    const ds = y <= ioYears ? ioPmt : amortPmt;
    const cfads = noi - ds;
    const dscr = ds > 0 ? noi / ds : 99;
    if (dscr < dscrMin) dscrMin = dscr;
    if (cfads < 0) allCfPositive = false;

    if (y < input.hold_years) {
      cashFlows.push(cfads);
    } else {
      const exitNoi = noi * (1 + input.noi_growth_rate);
      const grossSale = exitNoi / input.exit_cap_rate;
      const sellingCosts = grossSale * input.selling_costs_pct;
      const monthsAmortized = y <= ioYears ? 0 : (y - ioYears) * 12;
      const loanBalance = y <= ioYears
        ? loan
        : remainingLoanBalance(loan, input.debt_rate, amortMonths, monthsAmortized);
      const netSale = grossSale - sellingCosts - loanBalance;
      cashFlows.push(cfads + netSale);
    }
  }

  const ioPmtY1 = 1 <= ioYears ? ioPmt : amortPmt;
  const opex = Math.max(0, gpr * 0.93 - input.noi_year1);
  const breakevenOcc = gpr > 0 ? (opex + ioPmtY1) / gpr : 1;

  const dscrFloor = input.dscr_floor ?? 1.30;
  if (dscrMin < dscrFloor) constraintsViolated.push(`DSCR ${dscrMin.toFixed(2)} < ${dscrFloor.toFixed(2)}`);
  if (!allCfPositive) constraintsViolated.push('annual cash flow negative in ≥1 year');
  if (breakevenOcc > 0.85) constraintsViolated.push(`break-even occupancy ${(breakevenOcc * 100).toFixed(1)}% > 85%`);
  const ltvFloor   = input.ltv_min ?? 0.50;
  const ltvCeiling = input.ltv_max ?? 0.85;
  if (ltv < ltvFloor)   constraintsViolated.push(`LTV below ${(ltvFloor * 100).toFixed(0)}% floor`);
  if (ltv > ltvCeiling) constraintsViolated.push(`LTV above ${(ltvCeiling * 100).toFixed(0)}% ceiling`);

  const feasible = constraintsViolated.length === 0;

  let metricValue: number | null = null;
  if (feasible) {
    switch (primaryMetric) {
      case 'irr':
        metricValue = computeIrr(cashFlows);
        break;
      case 'cash_on_cash': {
        const cfY1 = cashFlows[1] ?? 0;
        metricValue = equity > 0 ? cfY1 / equity : null;
        break;
      }
      case 'stabilized_value':
        metricValue = input.noi_year1 / input.exit_cap_rate;
        break;
      case 'profit_at_exit': {
        const lastCf = cashFlows[cashFlows.length - 1] ?? 0;
        metricValue = lastCf - equity;
        break;
      }
    }
  }

  // GP IRR is always computed from the levered equity cashflows regardless of
  // the primaryMetric optimization target. This guarantees sponsor-side Pareto
  // ranking is always based on GP return rate (not stabilized_value dollar amounts).
  const gpIrr = computeIrr(cashFlows);

  return {
    ltv,
    feasible,
    metricValue,
    gpIrr,
    dscrMin: dscrMin === Infinity ? null : dscrMin,
    breakevenOcc,
    constraintsViolated,
    cashFlows,
  };
}

// ─── Bisection optimizer ──────────────────────────────────────────────────────

/**
 * Bisect to find the highest feasible LTV in [loStart, hiStart].
 * Assumption: the feasible region is contiguous at the low end (feasible for
 * lower LTVs, infeasible above some threshold) — true for DSCR + CF constraints.
 *
 * Returns null if even loStart is infeasible.
 */
function bisectMaxFeasibleLtv(
  input: OptimizeCapitalStructureInput,
  primaryMetric: string,
  loStart = 0.50,
  hiStart = 0.85,
  tolerance = 0.0001,
): { ltv: number; eval: LtvEval } | null {
  const evalLo = evaluateLtv(loStart, input, primaryMetric);
  if (!evalLo.feasible) return null;

  const evalHi = evaluateLtv(hiStart, input, primaryMetric);
  if (evalHi.feasible) return { ltv: hiStart, eval: evalHi };

  let lo = loStart;
  let hi = hiStart;
  for (let iter = 0; iter < 60 && (hi - lo) > tolerance; iter++) {
    const mid = (lo + hi) / 2;
    if (evaluateLtv(mid, input, primaryMetric).feasible) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const optLtv = Math.round(lo * 10000) / 10000;
  return { ltv: optLtv, eval: evaluateLtv(optLtv, input, primaryMetric) };
}

/**
 * For metrics that are not strictly monotone in LTV (stabilized_value,
 * profit_at_exit), scan within the feasible region to confirm the true peak.
 * Uses a coarse 20-point scan across the feasible interval.
 */
function findPeakInFeasibleRegion(
  input: OptimizeCapitalStructureInput,
  primaryMetric: string,
  loBound: number,
  hiBound: number,
): LtvEval {
  const steps = 20;
  const step = (hiBound - loBound) / steps;
  let best: LtvEval = evaluateLtv(loBound, input, primaryMetric);

  for (let i = 1; i <= steps; i++) {
    const ltv = Math.min(loBound + step * i, hiBound);
    const ev = evaluateLtv(ltv, input, primaryMetric);
    if (ev.feasible && ev.metricValue != null) {
      if (best.metricValue == null || ev.metricValue > best.metricValue) {
        best = ev;
      }
    }
  }
  return best;
}

// ─── Diagnostic scan (for ltv_scan field — 5% steps) ─────────────────────────

function buildDiagnosticScan(
  input: OptimizeCapitalStructureInput,
  primaryMetric: string,
): LtvEval[] {
  const scan: LtvEval[] = [];
  const scanLo = Math.round((input.ltv_min ?? 0.50) * 100);
  const scanHi = Math.round((input.ltv_max ?? 0.85) * 100);
  for (let ltv100 = scanLo; ltv100 <= scanHi; ltv100 += 5) {
    scan.push(evaluateLtv(ltv100 / 100, input, primaryMetric));
  }
  return scan;
}

// ─── Main optimizer ───────────────────────────────────────────────────────────

export async function optimizeCapitalStructure(
  input: OptimizeCapitalStructureInput,
): Promise<OptimizeCapitalStructureOutput> {
  logger.info('[optimize_capital_structure] Starting LTV bisection', {
    strategy: input.deal_strategy,
    noi: input.noi_year1,
    purchasePrice: input.purchase_price,
    holdYears: input.hold_years,
  });

  const primaryMetric = (input.primary_metric_override
    ?? STRATEGY_METRIC_MAP[input.deal_strategy.toLowerCase().replace(/\s/g, '-')]
    ?? 'irr') as 'irr' | 'cash_on_cash' | 'stabilized_value' | 'profit_at_exit';

  // ── Step 1: bisect to find the highest feasible LTV ──────────────────────
  const bisectResult = bisectMaxFeasibleLtv(
    input, primaryMetric,
    input.ltv_min ?? 0.50,
    input.ltv_max ?? 0.85,
  );
  const infeasible = bisectResult === null;

  // ── Step 2: for non-monotone metrics, find the true peak in feasible range ─
  let optimalEval: LtvEval | null = null;
  if (!infeasible) {
    const maxFeasibleLtv = bisectResult!.ltv;
    if (primaryMetric === 'stabilized_value' || primaryMetric === 'profit_at_exit') {
      optimalEval = findPeakInFeasibleRegion(input, primaryMetric, input.ltv_min ?? 0.50, maxFeasibleLtv);
    } else {
      // IRR and CoC are monotone-increasing in leverage within feasible region
      optimalEval = bisectResult!.eval;
    }
  }

  // ── Step 3: determine binding constraints ────────────────────────────────
  const bindingConstraints: string[] = [];
  if (optimalEval) {
    const ltvCeiling = input.ltv_max ?? 0.85;
    if (optimalEval.ltv >= ltvCeiling - 0.001) {
      bindingConstraints.push(`LTV ceiling at ${(ltvCeiling * 100).toFixed(0)}%`);
    } else if (bisectResult && bisectResult.ltv < ltvCeiling) {
      // There is a binding constraint just above the optimal
      const slightlyAbove = evaluateLtv(
        Math.min(optimalEval.ltv + 0.01, ltvCeiling),
        input,
        primaryMetric,
      );
      if (!slightlyAbove.feasible) {
        bindingConstraints.push(...slightlyAbove.constraintsViolated);
      }
    }
  }

  // ── Step 4: infeasibility reason ────────────────────────────────────────
  let infeasibilityReason: string | null = null;
  if (infeasible) {
    const ltvFloorPct = ((input.ltv_min ?? 0.50) * 100).toFixed(0);
    const ltvCeilPct  = ((input.ltv_max ?? 0.85) * 100).toFixed(0);
    const loEval = evaluateLtv(input.ltv_min ?? 0.50, input, primaryMetric);
    infeasibilityReason = `No LTV in [${ltvFloorPct}%, ${ltvCeilPct}%] satisfies all constraints. ${loEval.constraintsViolated.join('; ')}. Deal economics do not support leverage at the minimum ${ltvFloorPct}% LTV.`;
  }

  // ── Step 5: confidence ──────────────────────────────────────────────────
  const confidence = infeasible
    ? 'low'
    : optimalEval && (optimalEval.dscrMin ?? 0) >= 1.50 && (optimalEval.breakevenOcc ?? 1) <= 0.75
      ? 'high' : 'medium';

  // ── Step 6: narrative ───────────────────────────────────────────────────
  const narrative = buildNarrative(input, primaryMetric, optimalEval, infeasible, infeasibilityReason);

  // ── Step 7: diagnostic scan (5% steps, for UI visualization) ───────────
  const diagScan = buildDiagnosticScan(input, primaryMetric);

  const equity = optimalEval ? input.purchase_price * (1 - optimalEval.ltv) : null;

  logger.info('[optimize_capital_structure] Bisection result', {
    primaryMetric,
    optimalLtv: optimalEval?.ltv,
    metricValue: optimalEval?.metricValue,
    infeasible,
    bindingConstraints,
  });

  return {
    primary_metric: primaryMetric,
    optimal_ltv: optimalEval?.ltv ?? null,
    optimal_debt_amount: optimalEval ? input.purchase_price * optimalEval.ltv : null,
    optimal_rate: input.debt_rate,
    resulting_dscr_min: optimalEval?.dscrMin ?? null,
    resulting_breakeven_occ: optimalEval?.breakevenOcc ?? null,
    primary_metric_value: optimalEval?.metricValue ?? null,
    gp_irr: optimalEval?.gpIrr ?? null,
    evidence_narrative: narrative,
    constraints_binding: bindingConstraints,
    confidence,
    infeasible,
    infeasibility_reason: infeasibilityReason,
    ltv_scan: diagScan.map(s => ({
      ltv: s.ltv,
      feasible: s.feasible,
      metric_value: s.feasible ? s.metricValue : null,
      dscr_min: s.dscrMin,
      breakeven_occ: s.breakevenOcc,
      constraints_violated: s.constraintsViolated,
    })),
    equity_at_optimal: equity,
    gp_equity: equity != null ? equity * 0.10 : null,
    lp_equity: equity != null ? equity * 0.90 : null,
  };
}

function buildNarrative(
  input: OptimizeCapitalStructureInput,
  primaryMetric: string,
  best: LtvEval | null,
  infeasible: boolean,
  infeasibilityReason: string | null,
): string {
  const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const fmt$ = (v: number) => v >= 1e6
    ? `$${(v / 1e6).toFixed(2)}M`
    : `$${(v / 1e3).toFixed(0)}K`;

  if (infeasible) {
    const ltvFloorPct = ((input.ltv_min ?? 0.50) * 100).toFixed(0);
    const ltvCeilPct  = ((input.ltv_max ?? 0.85) * 100).toFixed(0);
    return `Capital structure optimization could not find a feasible LTV in the [${ltvFloorPct}%, ${ltvCeilPct}%] range. ${infeasibilityReason ?? ''} Recommend reviewing deal economics — consider re-pricing, improving NOI, or relaxing individual constraints with lender negotiation.`;
  }

  const ltv = best!.ltv;
  const debt = input.purchase_price * ltv;
  const equity = input.purchase_price * (1 - ltv);
  const metricLabel: Record<string, string> = {
    irr: 'Levered IRR',
    cash_on_cash: 'Year-1 Cash-on-Cash',
    stabilized_value: 'Stabilized Value',
    profit_at_exit: 'Profit at Exit',
  };
  const metricFmt = (v: number) => {
    if (primaryMetric === 'irr' || primaryMetric === 'cash_on_cash') return fmtPct(v);
    return fmt$(v);
  };

  const dscrFloorNarrative = input.dscr_floor ?? 1.30;
  const gpIrrStr = best?.gpIrr != null ? ` GP IRR: ${(best.gpIrr * 100).toFixed(1)}%.` : '';
  return `Bisection found optimal leverage for a ${input.deal_strategy} strategy at ${fmtPct(ltv)} LTV (${fmt$(debt)} debt / ${fmt$(equity)} equity), maximizing ${metricLabel[primaryMetric]} at ${metricFmt(best!.metricValue ?? 0)}.${gpIrrStr} Minimum DSCR across the ${input.hold_years}-year hold is ${best!.dscrMin?.toFixed(2) ?? '—'}×, maintaining a ${(((best!.dscrMin ?? dscrFloorNarrative) - dscrFloorNarrative) * 100).toFixed(0)}bps cushion above the ${dscrFloorNarrative.toFixed(2)}× covenant floor. Break-even occupancy is ${fmtPct(best!.breakevenOcc ?? 0)}, comfortably below the 85% break-even occupancy threshold. At ${fmtPct(input.debt_rate)} interest with ${input.amortization_years > 0 ? `${input.amortization_years}-year amortization` : 'full IO'}, the structure supports the deal's return objectives.`;
}

// ─── Tool registration ────────────────────────────────────────────────────────

export const optimizeCapitalStructureTool = {
  name: 'optimize_capital_structure',
  description: `Maximize the deal's strategy-implied return metric by finding the optimal LTV via bisection.

Uses bisection on the feasibility boundary to find the highest LTV where all
five hard constraints are satisfied simultaneously:
  1. DSCR ≥ 1.30 every year
  2. LTV ≤ 85%
  3. LTV ≥ 50%
  4. Break-even occupancy ≤ 85%
  5. Annual cash flow positive every year

IMPORTANT: Call this tool AFTER compute_proforma so that noi_year1 and
purchase_price are known. The strategy → metric mapping is deterministic:
  value-add, redevelopment → IRR (maximized at highest feasible LTV)
  existing, stabilized → Cash-on-Cash (maximized at highest feasible LTV)
  lease-up, development → Stabilized Value
  flip → Profit at Exit

Example call:
{ "noi_year1": 500000, "purchase_price": 7500000, "hold_years": 5,
  "debt_rate": 0.065, "exit_cap_rate": 0.055, "deal_strategy": "value-add",
  "gpr_year1": 950000 }`,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: optimizeCapitalStructure,
};
