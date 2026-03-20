/**
 * M08 Deal-Level Strategy Endpoints
 * GET  /api/v1/deals/:dealId/strategy-scores          — get cached strategy scores
 * POST /api/v1/deals/:dealId/strategy-scores/recalculate — trigger fresh scoring
 * GET  /api/v1/deals/:dealId/arbitrage                — get arbitrage result
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query, getPool } from '../../database/connection';
import { scoreAndPersist, detectArbitrage, ScoreContext } from '../../services/strategyArbitrage.service';
import { logger } from '../../utils/logger';

const router = Router({ mergeParams: true });

async function getUserOrgId(userId: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.org_id ?? null;
  } catch {
    return null;
  }
}

async function checkDealAccess(dealId: string, userId: string, orgId: string | null): Promise<boolean> {
  const result = await query(
    `SELECT id FROM deals
     WHERE id = $1
       AND (user_id = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
    [dealId, userId, orgId]
  );
  return result.rows.length > 0;
}

router.get('/:dealId/strategy-scores', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);

    if (!(await checkDealAccess(dealId, userId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const ctx: ScoreContext = { userId, orgId };
    const result = await query(
      `SELECT ss.*, s.name as strategy_name, s.is_system_template, s.sort_order
       FROM strategy_scores ss
       JOIN strategies s ON s.id = ss.strategy_id
       WHERE ss.deal_id = $1
         AND (s.is_system_template = true OR s.created_by = $2 OR ($3::uuid IS NOT NULL AND s.org_id = $3))
       ORDER BY ss.overall_score DESC NULLS LAST`,
      [dealId, userId, orgId]
    );

    if (result.rows.length === 0) {
      const scores = await scoreAndPersist(dealId, ctx);
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
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);

    if (!(await checkDealAccess(dealId, userId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const ctx: ScoreContext = { userId, orgId };
    const scores = await scoreAndPersist(dealId, ctx);
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
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);

    if (!(await checkDealAccess(dealId, userId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

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
      const ctx: ScoreContext = { userId, orgId };
      const scores = await scoreAndPersist(dealId, ctx);
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
