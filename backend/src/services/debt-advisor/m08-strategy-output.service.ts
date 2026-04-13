/**
 * M08 Strategy Output Service — Debt Advisor Contract Adapter
 *
 * Adapts the M08 v2 Strategies contract for the Debt Advisor formulator.
 * Delegates to getPrimaryStrategyForDeal() from the M08 v2 strategies
 * service — the same function that backs GET /api/v1/deals/:dealId/strategies.
 *
 * The formulator calls this function instead of making an HTTP call
 * (same process, same function — no round-trip needed).
 * Returns null when no M08 strategy_analyses entry exists for the deal.
 */
import { Pool } from 'pg';
import { getPrimaryStrategyForDeal } from '../m08-strategies.service';

export interface M08StrategyOutput {
  strategySlug: string;
  strategyName: string;
  riskScore: number;
  roiMetrics: {
    leveragedIrr?: number;
    unleveredIrr?: number;
    equityMultiple?: number;
    dscr?: number;
    exitCapRate?: number;
    targetIrr?: number;
    noi?: number;
    debtYield?: number;
  };
  assumptions: Record<string, any>;
  recommended: boolean;
  source: 'strategy_analyses';
}

export async function getM08StrategyOutput(
  pool: Pool,
  dealId: string
): Promise<M08StrategyOutput | null> {
  const primary = await getPrimaryStrategyForDeal(pool, dealId);
  if (!primary) return null;

  return {
    strategySlug: primary.strategySlug,
    strategyName: primary.strategyName,
    riskScore: primary.riskScore,
    roiMetrics: primary.roiMetrics,
    assumptions: primary.assumptions,
    recommended: primary.recommended,
    source: 'strategy_analyses',
  };
}
