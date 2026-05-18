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
 *   sponsor / gp   → ranked by primary metric value (IRR, CoC, etc.) descending
 *   lp             → ranked by primary metric value descending (IRR proxy for LP)
 *   lender         → ranked by dscr_min descending (DSCR robustness first)
 *
 * Each alternative includes:
 *   bundle_id, bundle_name, optimal_ltv, trade_off_summary, primary_metric_value,
 *   dscr_min, plausibility_score, plausibility_band, feasible
 *
 * Output is placed in:
 *   proforma.capital_structure.optimization.pareto_frontier[]
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import { optimizeCapitalStructure } from './optimize_capital_structure';
import { DEBT_BUNDLES, computePlausibility } from '../../services/sigma/sigma-engine';

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
  platform_role: z.enum(['sponsor', 'lp', 'lender']).default('sponsor').describe(
    'Requesting user role — determines sort order of the Pareto frontier. ' +
    'sponsor/lp: sorted by primary metric value descending. ' +
    'lender: sorted by dscr_min descending (DSCR robustness first).'
  ),
  bundle_filter: z.array(z.string()).optional().describe(
    'Optional subset of bundle IDs to evaluate. Default: all 5 bundles.'
  ),
  max_alternatives: z.number().int().min(1).max(5).default(3).describe(
    'Maximum number of alternatives to return (default 3).'
  ),
});

const ParetoItemSchema = z.object({
  bundle_id: z.string(),
  bundle_name: z.string(),
  optimal_ltv: z.number().nullable(),
  trade_off_summary: z.string(),
  primary_metric: z.string(),
  primary_metric_value: z.number().nullable(),
  dscr_min: z.number().nullable(),
  breakeven_occ: z.number().nullable(),
  optimal_rate: z.number(),
  equity_at_optimal: z.number().nullable(),
  plausibility_score: z.number().describe('Mahalanobis d-score for this bundle\'s assumption set'),
  plausibility_band: z.string().describe('Realistic | Stretch | Aggressive | Heroic | Unrealistic'),
  plausibility_color: z.enum(['green', 'amber', 'red']),
  feasible: z.boolean(),
  infeasibility_reason: z.string().nullable(),
  role_rank: z.number().describe('1-based rank for the requesting role (1 = best)'),
});

const OutputSchema = z.object({
  pareto_frontier: z.array(ParetoItemSchema),
  role: z.string(),
  sort_key: z.string().describe('Field used for role-aware sorting'),
  bundles_evaluated: z.number(),
  feasible_count: z.number(),
  note: z.string(),
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

  // Evaluate each bundle via the existing bisection optimizer
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
        });
      } catch (err) {
        logger.warn('[run_joint_goal_seek] Bundle evaluation failed', {
          bundle: bundle.id, err: String(err),
        });
        return null;
      }

      // Plausibility score for this bundle's assumption set
      const plausInput = {
        ltv:          result.optimal_ltv ?? bundle.ltv,
        interestRate: bundle.rate,
        ioPeriodYears: bundle.ioPeriod,
        amortYears:   bundle.amortYears,
        exitCapRate:  input.exit_cap_rate,
        holdYears:    input.hold_years,
      };
      const plau = computePlausibility(plausInput);

      return {
        bundle,
        result,
        plau,
      };
    })
  );

  const evaluated = rawResults.filter(Boolean) as NonNullable<(typeof rawResults)[number]>[];
  const feasible  = evaluated.filter(e => !e.result.infeasible);

  // ── Role-aware sort ───────────────────────────────────────────────
  const role = input.platform_role ?? 'sponsor';
  let sortKey: string;

  let sorted: typeof evaluated;
  if (role === 'lender') {
    sortKey = 'dscr_min (descending — DSCR robustness)';
    sorted = [...evaluated].sort((a, b) => {
      const da = a.result.resulting_dscr_min ?? 0;
      const db = b.result.resulting_dscr_min ?? 0;
      if (a.result.infeasible && !b.result.infeasible) return 1;
      if (!a.result.infeasible && b.result.infeasible) return -1;
      return db - da;
    });
  } else {
    // sponsor and lp: sorted by primary_metric_value descending
    sortKey = 'primary_metric_value (descending — best return first)';
    sorted = [...evaluated].sort((a, b) => {
      if (a.result.infeasible && !b.result.infeasible) return 1;
      if (!a.result.infeasible && b.result.infeasible) return -1;
      const va = a.result.primary_metric_value ?? -Infinity;
      const vb = b.result.primary_metric_value ?? -Infinity;
      return vb - va;
    });
  }

  const top = sorted.slice(0, input.max_alternatives ?? 3);

  const paretoFrontier = top.map((item, idx) => {
    const tradeOffBase = BUNDLE_TRADE_OFF[item.bundle.id] ?? item.bundle.description;

    // Append metric result to trade-off summary for agent consumption
    const metricStr = item.result.primary_metric_value != null
      ? (item.result.primary_metric === 'irr' || item.result.primary_metric === 'cash_on_cash'
          ? ` Result: ${(item.result.primary_metric_value * 100).toFixed(1)}% ${item.result.primary_metric.toUpperCase()}.`
          : ` Result: $${Math.round(item.result.primary_metric_value).toLocaleString()} ${item.result.primary_metric}.`)
      : '';

    const dscrStr = item.result.resulting_dscr_min != null
      ? ` Min DSCR: ${item.result.resulting_dscr_min.toFixed(2)}×.`
      : '';

    const feasStr = item.result.infeasible
      ? ` ⚠ Infeasible: ${item.result.infeasibility_reason ?? 'constraints not satisfied'}.`
      : '';

    return {
      bundle_id:          item.bundle.id,
      bundle_name:        item.bundle.name,
      optimal_ltv:        item.result.optimal_ltv,
      trade_off_summary:  `${tradeOffBase}${metricStr}${dscrStr}${feasStr}`,
      primary_metric:     item.result.primary_metric,
      primary_metric_value: item.result.primary_metric_value,
      dscr_min:           item.result.resulting_dscr_min,
      breakeven_occ:      item.result.resulting_breakeven_occ,
      optimal_rate:       item.bundle.rate,
      equity_at_optimal:  item.result.equity_at_optimal,
      plausibility_score: parseFloat(item.plau.dScore.toFixed(3)),
      plausibility_band:  item.plau.band,
      plausibility_color: bandToColor(item.plau.band),
      feasible:           !item.result.infeasible,
      infeasibility_reason: item.result.infeasibility_reason,
      role_rank:          idx + 1,
    };
  });

  logger.info('[run_joint_goal_seek] Pareto frontier built', {
    role,
    alternativesCount: paretoFrontier.length,
    feasibleCount: feasible.length,
    bundlesEvaluated: evaluated.length,
  });

  return {
    pareto_frontier: paretoFrontier,
    role,
    sort_key: sortKey,
    bundles_evaluated: evaluated.length,
    feasible_count: feasible.length,
    note: `${paretoFrontier.length} alternative(s) ranked by ${role === 'lender' ? 'DSCR robustness' : 'return metric'} for ${role} perspective. Include as proforma.capital_structure.optimization.pareto_frontier in output.`,
  };
}

export const runJointGoalSeekTool = {
  name: 'run_joint_goal_seek',
  description: `M36 Joint Distribution Engine — multi-bundle Pareto frontier optimization.

Run this AFTER optimize_capital_structure to get up to 3 ranked capital stack alternatives
across all 5 debt products (HUD 221(d)(4), Agency Fixed, Agency Floating, Bridge, CMBS).

Each alternative includes:
  bundle_id, bundle_name, optimal_ltv, trade_off_summary, primary_metric_value,
  dscr_min, plausibility_score, plausibility_band, feasible

Role-aware sorting:
  sponsor / lp  → ranked by primary metric value descending (best return first)
  lender        → ranked by dscr_min descending (DSCR robustness first)

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
