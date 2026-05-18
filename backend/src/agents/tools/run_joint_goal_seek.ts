/**
 * Tool: run_joint_goal_seek
 *
 * M36 Joint Distribution Engine — multi-bundle Pareto frontier optimization.
 *
 * Runs the same LTV-bisection optimizer as optimize_capital_structure across
 * all five debt product bundles (HUD 221(d)(4), Agency Fixed, Agency Floating,
 * Bridge, CMBS), producing a role-sorted Pareto frontier of up to 3 capital
 * stack alternatives.
 *
 * Role-aware sorting:
 *   sponsor / gp   → ranked by primary metric value (GP IRR / CoC) descending
 *   lp             → ranked by LP IRR descending (year-by-year LP cash flow model
 *                    with 90% LP equity split), with LP distribution yield as
 *                    secondary tiebreaker (NOI / LP equity)
 *   lender         → ranked by dscr_min descending (DSCR robustness first)
 *
 * LP IRR is computed from actual year-by-year LP cash flows:
 *   - LP equity = total equity × 0.90
 *   - LP operating CF = (NOI − debt service) × 0.90 per year
 *   - LP exit = (gross_sale − selling_costs − remaining_loan) × 0.90
 *   - LP IRR = internal rate of return on [−lp_equity, cf1, …, cfN + lp_exit]
 *
 * Output is placed in:
 *   proforma.capital_structure.optimization.pareto_frontier[]
 * (only feasible bundles included; infeasible bundles are excluded by default)
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import { optimizeCapitalStructure } from './optimize_capital_structure';
import { DEBT_BUNDLES, computePlausibility } from '../../services/sigma/sigma-engine';
import { query } from '../../database/connection';

// ─── Trade-off summaries per bundle ──────────────────────────────────────────

const BUNDLE_TRADE_OFF: Record<string, string> = {
  hud_221d4:
    'HUD 221(d)(4): Best leverage at 83% LTV and lowest rate (5.00%). ' +
    'Requires 6–9 month closing timeline and approved rehabilitation scope. ' +
    'Best for deals with significant capex programs and patient sponsors.',
  agency_fixed:
    'Agency Fixed (FNMA/FHLMC): 75% LTV at competitive fixed rate (5.75%) with 5-yr IO. ' +
    '30–60 day close. Rate certainty for the hold period. Ideal for stabilized acquisitions.',
  agency_floating:
    'Agency Floating (SOFR+): 75% LTV at floating rate (~6.50%). Same leverage as fixed. ' +
    'Rate hedge optional. Favors sponsors expecting rates to fall or who plan an early refi.',
  bridge:
    'Bridge/Transitional: Lower leverage (70% LTV) at higher rate (7.50%). ' +
    '2–4 week close. Favors time-sensitive acquisitions, lease-up, or value-add plays ' +
    'where speed outweighs carry cost.',
  cmbs:
    'CMBS Fixed: 70% LTV fully amortizing at fixed rate (6.50%). 10-year term with rate ' +
    'certainty. Higher equity required vs agency. Suitable for stabilized assets with ' +
    'predictable long-term cash flows.',
};

// ─── LP IRR financial model ───────────────────────────────────────────────────

/**
 * Bisection-based IRR solver — same algorithm as optimize_capital_structure.ts.
 * Solves for r where NPV(cash_flows, r) = 0.
 */
function irrBisect(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const npv = (r: number) =>
    cashFlows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  const v0 = npv(0);
  if (Math.abs(v0) < 1e-4) return 0;
  let lo = -0.9999, hi = 10.0;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const m = npv(mid);
    if (Math.abs(m) < 1e-4 || hi - lo < 1e-10) return parseFloat(mid.toFixed(6));
    if (v0 > 0 ? m > 0 : m < 0) lo = mid; else hi = mid;
  }
  return parseFloat(((lo + hi) / 2).toFixed(6));
}

/**
 * Compute LP IRR and distribution coverage for a given bundle + deal parameters.
 *
 * @param optimal_ltv  LTV from the bisection optimizer (0–1)
 * @param bundle_rate  Bundle interest rate (decimal)
 * @param io_period_years  IO period in years
 * @param amort_years  Amortization term in years
 * @param lp_equity_pct  LP equity fraction (default 0.90)
 *
 * Returns:
 *   lp_irr                — LP IRR on [−lp_equity, yr1_lp_cf, …, yrN_lp_cf + lp_exit_proceeds]
 *   lp_distribution_yield — NOI Year-1 / LP equity (LP cash-on-cash at start of hold)
 *   lp_equity             — LP equity at optimal LTV
 */
function computeLpMetrics(params: {
  noi_year1: number;
  purchase_price: number;
  optimal_ltv: number;
  bundle_rate: number;
  io_period_years: number;
  amort_years: number;
  hold_years: number;
  exit_cap_rate: number;
  noi_growth_rate: number;
  selling_costs_pct: number;
  lp_equity_pct?: number;
}): {
  lp_irr: number | null;
  lp_distribution_yield: number | null;
  lp_equity: number | null;
} {
  const {
    noi_year1,
    purchase_price,
    optimal_ltv,
    bundle_rate,
    io_period_years,
    amort_years,
    hold_years,
    exit_cap_rate,
    noi_growth_rate,
    selling_costs_pct,
    lp_equity_pct = 0.90,
  } = params;

  if (!optimal_ltv || optimal_ltv <= 0 || optimal_ltv >= 1 || purchase_price <= 0) {
    return { lp_irr: null, lp_distribution_yield: null, lp_equity: null };
  }

  const loan        = purchase_price * optimal_ltv;
  const totalEquity = purchase_price * (1 - optimal_ltv);
  const lpEquity    = totalEquity * lp_equity_pct;

  if (lpEquity <= 0) return { lp_irr: null, lp_distribution_yield: null, lp_equity: null };

  // Annual debt service (IO vs amortizing)
  const ioPmt = loan * bundle_rate;
  let amortPmt = ioPmt;
  if (amort_years > 0 && bundle_rate > 0) {
    const r = bundle_rate / 12;
    const n = amort_years * 12;
    const mPmt = loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    amortPmt = mPmt * 12;
  }

  // Build LP cash flow stream
  const lpCfs: number[] = [-lpEquity]; // Year-0: LP equity investment (outflow)

  for (let y = 1; y <= hold_years; y++) {
    const noi         = noi_year1 * Math.pow(1 + noi_growth_rate, y - 1);
    const debtService = y <= io_period_years ? ioPmt : amortPmt;
    const cfAfterDebt = noi - debtService;
    const lpOpCf      = Math.max(0, cfAfterDebt) * lp_equity_pct;

    if (y < hold_years) {
      lpCfs.push(lpOpCf);
    } else {
      // Exit year: LP gets their equity fraction of net sale proceeds
      const exitNoi       = noi * (1 + noi_growth_rate);
      const grossSale     = exit_cap_rate > 0 ? exitNoi / exit_cap_rate : 0;
      const sellingCosts  = grossSale * selling_costs_pct;

      // Remaining loan balance at exit (simplified)
      const yearsAmort = Math.max(0, hold_years - io_period_years);
      let remainingBalance = loan;
      if (yearsAmort > 0 && amort_years > 0 && bundle_rate > 0) {
        const r    = bundle_rate / 12;
        const paid = yearsAmort * 12;
        const mPmt = amortPmt / 12;
        remainingBalance = loan * Math.pow(1 + r, paid)
          - mPmt * (Math.pow(1 + r, paid) - 1) / r;
        remainingBalance = Math.max(0, remainingBalance);
      }

      const netSale     = grossSale - sellingCosts - remainingBalance;
      const lpExitShare = Math.max(0, netSale * lp_equity_pct);

      lpCfs.push(lpOpCf + lpExitShare);
    }
  }

  const lp_irr               = irrBisect(lpCfs);
  const lp_distribution_yield = lpEquity > 0
    ? parseFloat((noi_year1 / lpEquity).toFixed(4))
    : null;

  return {
    lp_irr:               lp_irr != null ? parseFloat(lp_irr.toFixed(5)) : null,
    lp_distribution_yield,
    lp_equity:            parseFloat(lpEquity.toFixed(2)),
  };
}

// ─── Input / Output schemas ───────────────────────────────────────────────────

const InputSchema = z.object({
  noi_year1: z.number().positive().describe(
    'Stabilized Year-1 NOI (annual $). Same as passed to optimize_capital_structure.'
  ),
  purchase_price: z.number().positive().describe(
    'Property purchase price ($).'
  ),
  hold_years: z.number().int().min(1).max(30).default(5).describe(
    'Hold period in years.'
  ),
  exit_cap_rate: z.number().min(0.02).max(0.20).default(0.055).describe(
    'Exit cap rate as decimal.'
  ),
  noi_growth_rate: z.number().min(-0.05).max(0.15).default(0.03).describe(
    'Annual NOI growth rate as decimal.'
  ),
  deal_strategy: z.string().default('existing').describe(
    'Deal strategy: value-add, existing, development, lease-up, redevelopment, flip.'
  ),
  gpr_year1: z.number().positive().optional().describe(
    'Gross Potential Rent Year-1 annual ($). Used for break-even occupancy.'
  ),
  selling_costs_pct: z.number().min(0).max(0.10).default(0.02).describe(
    'Selling costs as pct of gross sale value (default 2%).'
  ),
  deal_id: z.string().uuid().optional().describe(
    'Deal UUID for server-side platform role resolution (recommended). When provided, ' +
    'the tool queries the investors table (investors.type) for the deal\'s primary user ' +
    'to determine platform_role deterministically: lp→lp, gp/co_invest→sponsor. ' +
    'Falls back to LLM-provided platform_role if the lookup returns null or fails. ' +
    'Always supply deal_id when available to prevent role misclassification.'
  ),
  platform_role: z.enum(['sponsor', 'lp', 'lender']).default('sponsor').describe(
    'Requesting user role — determines sort order of the Pareto frontier. ' +
    'Override: if deal_id is supplied, the server resolves role from the DB (investors.type) ' +
    'and this value is used only as fallback.\n' +
    '  sponsor: sorted by GP primary metric (IRR, CoC, etc.) descending\n' +
    '  lp:      sorted by LP IRR descending (computed from year-by-year LP\n' +
    '           cash flows at 90% LP equity split), with LP distribution\n' +
    '           yield (NOI/LP equity) as secondary tiebreaker\n' +
    '  lender:  sorted by dscr_min descending (DSCR robustness first)'
  ),
  bundle_filter: z.array(z.string()).optional().describe(
    'Optional subset of bundle IDs to evaluate. Default: all 5 bundles.'
  ),
  max_alternatives: z.number().int().min(1).max(5).default(3).describe(
    'Maximum number of alternatives to return (default 3, feasible only).'
  ),
  include_infeasible: z.boolean().default(false).describe(
    'If true, include infeasible bundles at the end of the frontier (after feasible). ' +
    'Default: false — infeasible bundles are excluded.'
  ),
});

const ParetoItemSchema = z.object({
  bundle_id:            z.string(),
  bundle_name:          z.string(),
  optimal_ltv:          z.number().nullable(),
  trade_off_summary:    z.string(),
  primary_metric:       z.string(),
  primary_metric_value: z.number().nullable().describe('GP-perspective primary metric (IRR, CoC, etc.)'),
  lp_irr:               z.number().nullable().describe(
    'LP IRR computed from year-by-year LP cash flows (90% equity split, annual operating CF + exit proceeds). ' +
    'Primary LP ranking criterion.'
  ),
  lp_distribution_yield: z.number().nullable().describe(
    'LP distribution coverage yield = noi_year1 / lp_equity. ' +
    'Secondary LP ranking criterion (NOI return on LP equity dollar).'
  ),
  lp_equity:            z.number().nullable().describe('LP equity at optimal LTV (equity × 0.90)'),
  dscr_min:             z.number().nullable(),
  breakeven_occ:        z.number().nullable(),
  optimal_rate:         z.number(),
  equity_at_optimal:    z.number().nullable(),
  plausibility_score:   z.number().describe("Mahalanobis d-score for this bundle's assumption set"),
  plausibility_band:    z.string().describe('Realistic | Stretch | Aggressive | Heroic | Unrealistic'),
  plausibility_color:   z.enum(['green', 'amber', 'red']),
  feasible:             z.boolean(),
  infeasibility_reason: z.string().nullable(),
  role_rank:            z.number().describe('1-based rank for the requesting role (1 = best)'),
});

const OutputSchema = z.object({
  pareto_frontier:  z.array(ParetoItemSchema),
  role:             z.string(),
  sort_key:         z.string().describe('Field used for role-aware sorting'),
  bundles_evaluated: z.number(),
  feasible_count:   z.number(),
  note:             z.string(),
});

export type RunJointGoalSeekInput  = z.infer<typeof InputSchema>;
export type RunJointGoalSeekOutput = z.infer<typeof OutputSchema>;

// ─── Color helper ─────────────────────────────────────────────────────────────

function bandToColor(band: string): 'green' | 'amber' | 'red' {
  if (band === 'Realistic')  return 'green';
  if (band === 'Stretch' || band === 'Aggressive') return 'amber';
  return 'red';
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function runJointGoalSeek(
  input: RunJointGoalSeekInput,
): Promise<RunJointGoalSeekOutput> {
  const bundles = (input.bundle_filter && input.bundle_filter.length > 0)
    ? DEBT_BUNDLES.filter(b => input.bundle_filter!.includes(b.id))
    : DEBT_BUNDLES;

  logger.info('[run_joint_goal_seek] Starting multi-bundle Pareto optimization', {
    strategy: input.deal_strategy,
    noi: input.noi_year1,
    purchasePrice: input.purchase_price,
    holdYears: input.hold_years,
    role: input.platform_role,
    bundles: bundles.map(b => b.id),
  });

  // ── Evaluate each bundle via the bisection optimizer ───────────────────────
  const rawResults = await Promise.all(
    bundles.map(async (bundle) => {
      let result;
      try {
        result = await optimizeCapitalStructure({
          noi_year1:          input.noi_year1,
          purchase_price:     input.purchase_price,
          hold_years:         input.hold_years,
          exit_cap_rate:      input.exit_cap_rate,
          debt_rate:          bundle.rate,
          amortization_years: bundle.amortYears,
          io_period_months:   bundle.ioPeriod * 12,
          noi_growth_rate:    input.noi_growth_rate,
          deal_strategy:      input.deal_strategy,
          gpr_year1:          input.gpr_year1,
          selling_costs_pct:  input.selling_costs_pct,
          // Enforce bundle-specific product LTV ceiling (HUD=83%, Agency=75%, Bridge/CMBS=70%)
          ltv_max:            bundle.ltv,
          ltv_min:            0.50,
        });
      } catch (err) {
        logger.warn('[run_joint_goal_seek] Bundle evaluation failed', {
          bundle: bundle.id, err: String(err),
        });
        return null;
      }

      // Plausibility score for this bundle's assumption set
      const plau = computePlausibility({
        ltv:           result.optimal_ltv ?? bundle.ltv,
        interestRate:  bundle.rate,
        ioPeriodYears: bundle.ioPeriod,
        amortYears:    bundle.amortYears,
        exitCapRate:   input.exit_cap_rate,
        holdYears:     input.hold_years,
      });

      // LP metrics: IRR + distribution yield from year-by-year LP cash flow model
      const lpMetrics = result.optimal_ltv != null && !result.infeasible
        ? computeLpMetrics({
            noi_year1:         input.noi_year1,
            purchase_price:    input.purchase_price,
            optimal_ltv:       result.optimal_ltv,
            bundle_rate:       bundle.rate,
            io_period_years:   bundle.ioPeriod,
            amort_years:       bundle.amortYears,
            hold_years:        input.hold_years,
            exit_cap_rate:     input.exit_cap_rate,
            noi_growth_rate:   input.noi_growth_rate,
            selling_costs_pct: input.selling_costs_pct ?? 0.02,
          })
        : { lp_irr: null, lp_distribution_yield: null, lp_equity: result.lp_equity };

      return { bundle, result, plau, lpMetrics };
    })
  );

  const evaluated = rawResults.filter(Boolean) as NonNullable<(typeof rawResults)[number]>[];
  const feasibleEvaluated = evaluated.filter(e => !e.result.infeasible);

  // ── Resolve platform role server-side (deterministic override) ───────────
  //
  // When deal_id is provided, query the investors table to get the user's
  // investor type and map it to the sorting role, overriding whatever the
  // LLM supplied in platform_role. This prevents role misclassification if
  // the model omits or misstates the role.
  //
  //   investors.type → platform_role:
  //     'lp'           → 'lp'
  //     'gp'           → 'sponsor'
  //     'co_invest'    → 'sponsor'
  //     (other/null)   → fall back to LLM-provided platform_role
  //
  let resolvedRole: 'sponsor' | 'lp' | 'lender' = input.platform_role ?? 'sponsor';
  if (input.deal_id) {
    try {
      const roleRow = await query(
        `SELECT i.type AS investor_type
           FROM investors i
           JOIN deals d ON d.user_id = i.user_id
          WHERE d.id = $1
          LIMIT 1`,
        [input.deal_id],
      );
      const dbType = roleRow.rows[0]?.investor_type as string | undefined;
      if (dbType === 'lp') {
        resolvedRole = 'lp';
      } else if (dbType === 'gp' || dbType === 'co_invest') {
        resolvedRole = 'sponsor';
      }
      // 'lender' is not represented in the investors table — keep LLM-provided role
    } catch (err) {
      logger.warn('[run_joint_goal_seek] DB role lookup failed, using prompt-provided role', {
        err: String(err), deal_id: input.deal_id, fallback: resolvedRole,
      });
    }
  }

  // ── Role-aware sort ───────────────────────────────────────────────────────
  //
  // sponsor: maximize GP primary metric (IRR, CoC, etc.) — sort DESC
  // lp:      maximize LP IRR (year-by-year LP cash flow model, 90% equity split)
  //          with LP distribution yield as tiebreaker — both sort DESC
  // lender:  maximize DSCR robustness — sort resulting_dscr_min DESC
  //
  const role = resolvedRole;
  let sortKey: string;

  // Sort only feasible bundles; infeasible go at the end (if included)
  const sortFeasible = (candidates: typeof feasibleEvaluated): typeof feasibleEvaluated => {
    if (role === 'lender') {
      sortKey = 'resulting_dscr_min descending (DSCR robustness — lender perspective)';
      return [...candidates].sort((a, b) =>
        (b.result.resulting_dscr_min ?? 0) - (a.result.resulting_dscr_min ?? 0));

    } else if (role === 'lp') {
      sortKey = 'LP IRR descending (year-by-year LP cash flows, 90% equity split), ' +
                'LP distribution yield (NOI/LP equity) as tiebreaker';
      return [...candidates].sort((a, b) => {
        const lpIrrA = a.lpMetrics.lp_irr ?? -Infinity;
        const lpIrrB = b.lpMetrics.lp_irr ?? -Infinity;
        if (Math.abs(lpIrrA - lpIrrB) > 0.0005) return lpIrrB - lpIrrA;
        // Tiebreaker: LP distribution yield (NOI / LP equity)
        const yA = a.lpMetrics.lp_distribution_yield ?? 0;
        const yB = b.lpMetrics.lp_distribution_yield ?? 0;
        return yB - yA;
      });

    } else {
      // sponsor / gp
      sortKey = 'primary_metric_value descending (GP IRR / CoC / profit — sponsor perspective)';
      return [...candidates].sort((a, b) =>
        (b.result.primary_metric_value ?? -Infinity) - (a.result.primary_metric_value ?? -Infinity));
    }
  };

  const sortedFeasible  = sortFeasible(feasibleEvaluated);
  const infeasibleItems = evaluated.filter(e => e.result.infeasible);

  // Build the display list: feasible first, then optionally infeasible
  const displayList = input.include_infeasible
    ? [...sortedFeasible, ...infeasibleItems]
    : sortedFeasible;

  const top = displayList.slice(0, input.max_alternatives ?? 3);

  // ── Build Pareto frontier items ───────────────────────────────────────────
  const paretoFrontier = top.map((item, idx) => {
    const tradeOffBase = BUNDLE_TRADE_OFF[item.bundle.id] ?? item.bundle.description;

    const metricStr = item.result.primary_metric_value != null
      ? (item.result.primary_metric === 'irr' || item.result.primary_metric === 'cash_on_cash'
          ? ` GP ${item.result.primary_metric.toUpperCase()}: ${(item.result.primary_metric_value * 100).toFixed(1)}%.`
          : ` ${item.result.primary_metric}: $${Math.round(item.result.primary_metric_value).toLocaleString()}.`)
      : '';

    const lpIrrStr = item.lpMetrics.lp_irr != null
      ? ` LP IRR: ${(item.lpMetrics.lp_irr * 100).toFixed(1)}%.`
      : '';

    const lpYieldStr = item.lpMetrics.lp_distribution_yield != null
      ? ` LP dist. yield: ${(item.lpMetrics.lp_distribution_yield * 100).toFixed(1)}% (NOI/LP equity).`
      : '';

    const dscrStr = item.result.resulting_dscr_min != null
      ? ` Min DSCR: ${item.result.resulting_dscr_min.toFixed(2)}×.`
      : '';

    const feasStr = item.result.infeasible
      ? ` ⚠ Infeasible: ${item.result.infeasibility_reason ?? 'constraints not satisfied'}.`
      : '';

    // Trade-off summary includes role-relevant metrics
    const roleStr = role === 'lp' ? `${lpIrrStr}${lpYieldStr}` : metricStr;

    return {
      bundle_id:             item.bundle.id,
      bundle_name:           item.bundle.name,
      optimal_ltv:           item.result.optimal_ltv,
      trade_off_summary:     `${tradeOffBase}${roleStr}${dscrStr}${feasStr}`,
      primary_metric:        item.result.primary_metric,
      primary_metric_value:  item.result.primary_metric_value,
      lp_irr:                item.lpMetrics.lp_irr,
      lp_distribution_yield: item.lpMetrics.lp_distribution_yield,
      lp_equity:             item.lpMetrics.lp_equity,
      dscr_min:              item.result.resulting_dscr_min,
      breakeven_occ:         item.result.resulting_breakeven_occ,
      optimal_rate:          item.bundle.rate,
      equity_at_optimal:     item.result.equity_at_optimal,
      plausibility_score:    parseFloat(item.plau.dScore.toFixed(3)),
      plausibility_band:     item.plau.band,
      plausibility_color:    bandToColor(item.plau.band),
      feasible:              !item.result.infeasible,
      infeasibility_reason:  item.result.infeasibility_reason,
      role_rank:             idx + 1,
    };
  });

  logger.info('[run_joint_goal_seek] Pareto frontier built', {
    role,
    alternativesCount: paretoFrontier.length,
    feasibleCount: feasibleEvaluated.length,
    bundlesEvaluated: evaluated.length,
  });

  return {
    pareto_frontier:   paretoFrontier,
    role,
    sort_key:          sortKey!,
    bundles_evaluated: evaluated.length,
    feasible_count:    feasibleEvaluated.length,
    note: `${paretoFrontier.length} feasible alternative(s) ranked for ${role} role by ${role === 'lp' ? 'LP IRR' : role === 'lender' ? 'DSCR robustness' : 'GP return metric'}. Include as proforma.capital_structure.optimization.pareto_frontier in output.`,
  };
}

export const runJointGoalSeekTool = {
  name: 'run_joint_goal_seek',
  description: `M36 Joint Distribution Engine — multi-bundle Pareto frontier optimization.

Run this AFTER optimize_capital_structure to get up to 3 ranked capital stack alternatives
across all 5 debt products (HUD 221(d)(4), Agency Fixed, Agency Floating, Bridge, CMBS).

Each alternative includes:
  bundle_id, bundle_name, optimal_ltv, trade_off_summary
  primary_metric_value (GP perspective)
  lp_irr                (LP IRR from year-by-year LP cash flows — LP ranking criterion)
  lp_distribution_yield (NOI / LP equity — LP distribution coverage)
  dscr_min, plausibility_score, plausibility_band, feasible

Role-aware sorting:
  sponsor → ranked by GP primary metric (IRR/CoC) descending
  lp      → ranked by LP IRR descending (computed from actual LP cash flow model
             with 90% equity split and bundle-specific debt structure);
             LP distribution yield used as tiebreaker
  lender  → ranked by dscr_min descending (DSCR robustness first)

Only feasible bundles are returned by default (set include_infeasible=true to include all).

Include the result in your output as:
  proforma.capital_structure.optimization.pareto_frontier

Example call:
{
  "noi_year1": 500000,
  "purchase_price": 7500000,
  "hold_years": 5,
  "exit_cap_rate": 0.055,
  "noi_growth_rate": 0.03,
  "deal_strategy": "value-add",
  "platform_role": "sponsor"
}`,
  inputSchema:  InputSchema,
  outputSchema: OutputSchema,
  execute: runJointGoalSeek,
};
