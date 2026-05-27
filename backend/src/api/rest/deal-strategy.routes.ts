/**
 * M08 Deal-Level Strategy Endpoints — v2 detection-first system only
 * GET   /api/v1/deals/:dealId/strategies               — full v2 strategy output (strategy_analyses)
 * PATCH /api/v1/deals/:dealId/detection-confirmation   — persist user confirmation / override
 *
 * Legacy v1 endpoints (strategy-scores, strategy-scores/recalculate, arbitrage) and
 * strategyArbitrage.service.ts were removed in Task #1251 (T7.1). The corresponding
 * DB tables (strategy_scores, strategy_arbitrage) are dropped via migration
 * 20260527_drop_strategy_legacy_tables.sql.
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query, getPool } from '../../database/connection';
import { getStrategiesForDeal, bustM08Cache } from '../../services/m08-strategies.service';
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

/**
 * PATCH /api/v1/deals/:dealId/detection-confirmation
 * Persists user confirmation or override of AI asset-class detection.
 *
 * Body: { userConfirmed: boolean; userOverrideClassification?: string }
 *
 * Writes to deal_data.m08_detection JSONB sub-document and busts the M08 cache
 * so the next GET /strategies reflects the confirmed classification.
 */
router.patch('/:dealId/detection-confirmation', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);

    if (!(await checkDealAccess(dealId, userId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const { userConfirmed, userOverrideClassification } = req.body;
    if (typeof userConfirmed !== 'boolean') {
      return res.status(400).json({ success: false, error: 'userConfirmed (boolean) is required' });
    }

    // Merge into deal_data.m08_detection sub-document without clobbering other deal_data keys
    const patch: Record<string, any> = { user_confirmed: userConfirmed };
    if (userOverrideClassification !== undefined) {
      patch.user_override_classification = userOverrideClassification || null;
    }
    patch.confirmed_at = new Date().toISOString();

    await query(
      `UPDATE deals
          SET deal_data = jsonb_set(
                COALESCE(deal_data, '{}'::jsonb),
                '{m08_detection}',
                COALESCE(deal_data->'m08_detection', '{}'::jsonb) || $1::jsonb,
                true
              ),
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(patch), dealId]
    );

    bustM08Cache(dealId);

    return res.json({
      success: true,
      data: { dealId, userConfirmed, userOverrideClassification: userOverrideClassification ?? null },
    });
  } catch (error: any) {
    logger.error('[M08v2] Error persisting detection confirmation:', error);
    return res.status(500).json({ success: false, error: 'Failed to persist detection confirmation' });
  }
});

/**
 * GET /api/v1/deals/:dealId/strategies
 * M08 v2 strategy output contract — returns strategy_analyses entries for the deal.
 */
router.get('/:dealId/strategies', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const orgId = await getUserOrgId(userId);

    if (!(await checkDealAccess(dealId, userId, orgId))) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const pool = getPool();
    const analysis = await getStrategiesForDeal(pool, dealId);
    return res.json({ success: true, data: analysis });
  } catch (error: any) {
    logger.error('[M08v2] Error fetching strategies:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch strategies' });
  }
});

export default router;
