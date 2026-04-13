/**
 * M08 Strategy Output Service — Debt Advisor Contract Adapter
 *
 * Authoritative adapter between the Debt Advisor and the M08 strategy engine.
 * Reads exclusively from strategy_analyses (the M08 v2 output table populated
 * when the user runs M08 strategy selection). Returns null when no M08 analysis
 * exists — the Advisor then shows a "run strategy first" CTA with no
 * fabricated recommendation.
 *
 * Legacy strategy_scores/arbitrage paths are explicitly NOT used here.
 * When Task #176 (M08 v2 Backend) merges and exposes
 * GET /api/v1/deals/:dealId/strategies, this service will be replaced by
 * an HTTP call to that endpoint.
 */
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

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
  };
  assumptions: Record<string, any>;
  recommended: boolean;
  source: 'strategy_analyses';
}

export async function getM08StrategyOutput(
  pool: Pool,
  dealId: string
): Promise<M08StrategyOutput | null> {
  const result = await pool.query(
    `SELECT strategy_slug, risk_score, roi_metrics, assumptions, recommended
     FROM strategy_analyses
     WHERE deal_id = $1
     ORDER BY recommended DESC, created_at DESC LIMIT 1`,
    [dealId]
  );

  if (result.rows.length === 0) {
    logger.info('[M08StrategyOutput] No strategy_analyses entry for deal — advisor will return hasStrategy:false', { dealId });
    return null;
  }

  const row = result.rows[0];
  const rm = row.roi_metrics || {};
  const slug = row.strategy_slug || '';

  return {
    strategySlug: slug,
    strategyName: slug.replace(/-/g, ' ').replace(/_/g, ' '),
    riskScore: row.risk_score ? parseFloat(row.risk_score) : 0,
    roiMetrics: {
      leveragedIrr: rm.leveraged_irr ?? rm.irr ?? undefined,
      unleveredIrr: rm.unlevered_irr ?? undefined,
      equityMultiple: rm.equity_multiple ?? rm.em ?? undefined,
      dscr: rm.dscr ?? undefined,
      exitCapRate: rm.exit_cap_rate ?? rm.exit_cap ?? undefined,
      targetIrr: rm.target_irr ?? undefined,
    },
    assumptions: row.assumptions || {},
    recommended: row.recommended === true,
    source: 'strategy_analyses',
  };
}
