/**
 * M08 v2 Strategies Service
 *
 * Implements the M08 v2 strategy output contract for a given deal.
 * Reads from strategy_analyses (the M08 v2 output table populated when the
 * user runs M08 strategy selection). Returns null when no analysis exists.
 *
 * This service backs the GET /api/v1/deals/:dealId/strategies endpoint
 * (M08 v2 contract endpoint). The Debt Advisor formulator uses this
 * function directly to avoid HTTP round-trips in the same process.
 */
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface M08StrategyV2 {
  strategySlug: string;
  strategyName: string;
  riskScore: number;
  recommended: boolean;
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
  createdAt: string;
}

export async function getStrategiesForDeal(
  pool: Pool,
  dealId: string
): Promise<M08StrategyV2[]> {
  const result = await pool.query(
    `SELECT strategy_slug, risk_score, roi_metrics, assumptions, recommended, created_at
     FROM strategy_analyses
     WHERE deal_id = $1
     ORDER BY recommended DESC, created_at DESC`,
    [dealId]
  );

  if (result.rows.length === 0) {
    logger.info('[M08StrategiesV2] No strategy_analyses for deal', { dealId });
    return [];
  }

  return result.rows.map(row => {
    const rm = row.roi_metrics || {};
    const slug = row.strategy_slug || '';
    return {
      strategySlug: slug,
      strategyName: slug.replace(/-/g, ' ').replace(/_/g, ' '),
      riskScore: row.risk_score ? parseFloat(row.risk_score) : 0,
      recommended: row.recommended === true,
      roiMetrics: {
        leveragedIrr: rm.leveraged_irr ?? rm.irr ?? undefined,
        unleveredIrr: rm.unlevered_irr ?? undefined,
        equityMultiple: rm.equity_multiple ?? rm.em ?? undefined,
        dscr: rm.dscr ?? undefined,
        exitCapRate: rm.exit_cap_rate ?? rm.exit_cap ?? undefined,
        targetIrr: rm.target_irr ?? undefined,
        noi: rm.noi ?? rm.net_operating_income ?? undefined,
        debtYield: rm.debt_yield ?? undefined,
      },
      assumptions: row.assumptions || {},
      createdAt: row.created_at?.toISOString?.() ?? '',
    };
  });
}

export async function getPrimaryStrategyForDeal(
  pool: Pool,
  dealId: string
): Promise<M08StrategyV2 | null> {
  const strategies = await getStrategiesForDeal(pool, dealId);
  if (strategies.length === 0) return null;
  return strategies.find(s => s.recommended) ?? strategies[0];
}
