/**
 * M08 Deal-Level Strategy Endpoints
 * GET  /api/v1/deals/:dealId/strategy-scores          — get cached strategy scores
 * POST /api/v1/deals/:dealId/strategy-scores/recalculate — trigger fresh scoring
 * GET  /api/v1/deals/:dealId/arbitrage                — get arbitrage result
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query, getPool } from '../../database/connection';
import { scoreAndPersist, detectArbitrage } from '../../services/strategyArbitrage.service';
import { logger } from '../../utils/logger';

const router = Router({ mergeParams: true });

router.get('/:dealId/strategy-scores', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await query(
      `SELECT ss.*, s.name as strategy_name, s.is_system_template, s.sort_order
       FROM strategy_scores ss
       JOIN strategies s ON s.id = ss.strategy_id
       WHERE ss.deal_id = $1
       ORDER BY ss.overall_score DESC NULLS LAST`,
      [dealId]
    );

    if (result.rows.length === 0) {
      const scores = await scoreAndPersist(dealId);
      return res.json({ success: true, scores, freshlyCalculated: true });
    }

    res.json({ success: true, scores: result.rows });
  } catch (error: any) {
    logger.error('[M08] Error fetching strategy scores:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch strategy scores' });
  }
});

router.post('/:dealId/strategy-scores/recalculate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const scores = await scoreAndPersist(dealId);
    const arbitrage = detectArbitrage(scores);
    res.json({ success: true, scores, arbitrage });
  } catch (error: any) {
    logger.error('[M08] Error recalculating scores:', error);
    res.status(500).json({ success: false, error: 'Failed to recalculate scores' });
  }
});

router.get('/:dealId/arbitrage', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await query(
      `SELECT sa.*,
         sw.name as winning_strategy_name,
         sr.name as runner_up_strategy_name
       FROM strategy_arbitrage sa
       LEFT JOIN strategies sw ON sw.id = sa.winning_strategy_id
       LEFT JOIN strategies sr ON sr.id = sa.runner_up_strategy_id
       WHERE sa.deal_id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      const scores = await scoreAndPersist(dealId);
      const arbitrage = detectArbitrage(scores);
      return res.json({ success: true, arbitrage, freshlyCalculated: true });
    }

    res.json({ success: true, arbitrage: result.rows[0] });
  } catch (error: any) {
    logger.error('[M08] Error fetching arbitrage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch arbitrage' });
  }
});

export default router;
