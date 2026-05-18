/**
 * Tool: query_capital_stack_bundles
 *
 * Returns the full registry of supported debt product bundles with their
 * current rate/term parameters. Called by the CashFlow Agent before invoking
 * run_joint_goal_seek so the agent can reason about which bundles are
 * appropriate for the deal's strategy and timeline.
 */

import { z } from 'zod';
import { DEBT_BUNDLES } from '../../services/sigma/sigma-engine';
import { logger } from '../../utils/logger';

const InputSchema = z.object({
  filter_ids: z.array(z.string()).optional().describe(
    'Optional list of bundle IDs to return. If omitted, all 5 bundles are returned.'
  ),
  strategy_hint: z.string().optional().describe(
    'Deal strategy hint (value-add, stabilized, development, bridge-to-perm, etc.) ' +
    'for informational context. Does not filter; agent decides relevance.'
  ),
});

const BundleSchema = z.object({
  id: z.string(),
  name: z.string(),
  ltv: z.number().describe('Max LTV as decimal (e.g., 0.75 = 75%)'),
  rate: z.number().describe('Interest rate as decimal (e.g., 0.0575 = 5.75%)'),
  io_period_years: z.number().describe('Interest-only period in years'),
  amort_years: z.number().describe('Amortization schedule in years'),
  upfront_bps: z.number().describe('Up-front costs in basis points'),
  min_dscr: z.number().describe('Minimum required DSCR for this product'),
  description: z.string().describe('Plain-language trade-off summary'),
  closing_timeline: z.string().describe('Typical closing timeline'),
  best_for: z.string().describe('Deal types / scenarios this product is best suited for'),
});

const OutputSchema = z.object({
  bundles: z.array(BundleSchema),
  count: z.number(),
  note: z.string(),
});

export type QueryCapitalStackBundlesInput = z.infer<typeof InputSchema>;
export type QueryCapitalStackBundlesOutput = z.infer<typeof OutputSchema>;

const CLOSING_TIMELINES: Record<string, string> = {
  hud_221d4:       '6–9 months (HUD review + Davis-Bacon compliance)',
  agency_fixed:    '30–60 days (standard FNMA/FHLMC)',
  agency_floating: '30–60 days (same as Agency Fixed)',
  bridge:          '2–4 weeks (asset-based; minimal underwriting delay)',
  cmbs:            '45–90 days (CMBS origination + rating)',
};

const BEST_FOR: Record<string, string> = {
  hud_221d4:       'New construction, substantial rehabilitation, ground-up development. Requires approved scope and long lead time.',
  agency_fixed:    'Stabilized acquisitions, mild value-add. Best when sponsor needs rate certainty and can tolerate 30-60d close.',
  agency_floating: 'Stabilized deals where sponsor expects rates to fall within hold period, or plans early refi.',
  bridge:          'Transitional assets, value-add plays, lease-up stabilization. Fast-close situations.',
  cmbs:            'Stabilized assets with predictable cash flows. Sponsors comfortable with prepayment lockout and longer term.',
};

export async function queryCapitalStackBundles(
  input: QueryCapitalStackBundlesInput,
): Promise<QueryCapitalStackBundlesOutput> {
  const ids = input.filter_ids ?? [];
  const filtered = ids.length > 0
    ? DEBT_BUNDLES.filter(b => ids.includes(b.id))
    : DEBT_BUNDLES;

  logger.info('[query_capital_stack_bundles] Returning bundles', {
    count: filtered.length,
    strategy_hint: input.strategy_hint,
    filter_ids: ids,
  });

  const bundles = filtered.map(b => ({
    id: b.id,
    name: b.name,
    ltv: b.ltv,
    rate: b.rate,
    io_period_years: b.ioPeriod,
    amort_years: b.amortYears,
    upfront_bps: b.upFrontBps,
    min_dscr: b.minDscr,
    description: b.description,
    closing_timeline: CLOSING_TIMELINES[b.id] ?? 'Standard',
    best_for: BEST_FOR[b.id] ?? '',
  }));

  return {
    bundles,
    count: bundles.length,
    note: 'Pass bundle IDs to run_joint_goal_seek to generate a multi-bundle Pareto frontier.',
  };
}

export const queryCapitalStackBundlesTool = {
  name: 'query_capital_stack_bundles',
  description: `Return the registry of supported debt product bundles with current rate/term parameters.

Call this before run_joint_goal_seek to understand the full product universe:
  - hud_221d4:       HUD 221(d)(4) — 83% LTV, 5.00% fixed, 35yr amort, 6-9mo close
  - agency_fixed:    Agency Fixed (FNMA/FHLMC) — 75% LTV, 5.75% fixed, 30yr, 5yr IO
  - agency_floating: Agency Floating (SOFR+) — 75% LTV, 6.50%, 30yr, 5yr IO
  - bridge:          Bridge / Transitional — 70% LTV, 7.50% floating, 3yr IO, fast close
  - cmbs:            CMBS Fixed — 70% LTV, 6.50% fixed, fully amortizing, 10yr term

Returns each bundle's LTV, rate, IO period, amort, up-front costs, min DSCR,
closing timeline, and "best for" scenarios for agent reasoning.

Input: {} or { "filter_ids": ["bridge", "agency_fixed"] }`,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: queryCapitalStackBundles,
};
