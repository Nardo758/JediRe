/**
 * M08 Strategy Output Service — Debt Advisor Contract Adapter
 *
 * This is the authoritative adapter between the Debt Advisor and the M08
 * strategy engine. It implements the M08 v2 strategy output contract:
 *   1. Reads the user's selected/recommended strategy from strategy_analyses
 *      (populated when the user runs M08 strategy selection in the frontend).
 *   2. Falls back to the top-scored strategy from strategy_scores (M08 engine).
 *   3. Returns null when no M08 output exists for the deal (→ Advisor shows
 *      "run strategy first" CTA, no plan is fabricated).
 *
 * When Task #176 (M08 v2 Backend) is merged, this service can be updated
 * to call GET /api/v1/deals/:dealId/strategies instead.
 */
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

export interface M08StrategyOutput {
  strategySlug: string;
  strategyName: string;
  riskScore: number;
  overallScore: number;
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
  source: 'strategy_analyses' | 'strategy_scores';
}

export async function getM08StrategyOutput(
  pool: Pool,
  dealId: string
): Promise<M08StrategyOutput | null> {
  try {
    const primaryResult = await pool.query(
      `SELECT strategy_slug, risk_score, roi_metrics, assumptions, recommended
       FROM strategy_analyses
       WHERE deal_id = $1
       ORDER BY recommended DESC, created_at DESC LIMIT 1`,
      [dealId]
    );

    if (primaryResult.rows.length > 0) {
      const row = primaryResult.rows[0];
      const rm = row.roi_metrics || {};
      const slug = row.strategy_slug || '';
      return {
        strategySlug: slug,
        strategyName: slug.replace(/-/g, ' ').replace(/_/g, ' '),
        riskScore: row.risk_score ? parseFloat(row.risk_score) : 0,
        overallScore: row.risk_score ? parseFloat(row.risk_score) : 0,
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

    const fallbackResult = await pool.query(
      `SELECT ss.overall_score, ss.sub_scores, ss.confidence, s.name as strategy_name
       FROM strategy_scores ss
       JOIN strategies s ON s.id = ss.strategy_id
       WHERE ss.deal_id = $1
         AND ss.gate_result = 'PASS'
       ORDER BY ss.overall_score DESC LIMIT 1`,
      [dealId]
    );

    if (fallbackResult.rows.length > 0) {
      const row = fallbackResult.rows[0];
      const name = (row.strategy_name || '').toLowerCase();
      const slug = name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return {
        strategySlug: slug,
        strategyName: row.strategy_name || '',
        riskScore: 0,
        overallScore: row.overall_score ? parseFloat(row.overall_score) : 0,
        roiMetrics: {},
        assumptions: {},
        recommended: true,
        source: 'strategy_scores',
      };
    }

    return null;
  } catch (err: any) {
    logger.warn('[M08StrategyOutput] Failed to fetch strategy output', { dealId, error: err.message });
    return null;
  }
}
