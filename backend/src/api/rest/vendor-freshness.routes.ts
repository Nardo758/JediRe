/**
 * Vendor Freshness Routes — Phase 2C
 *
 * Exposes the freshness state of all registered vendors' data for a deal.
 * Mounted at /api/v1/deals (via requireAuth in index.replit.ts).
 *
 * GET /:dealId/vendor-freshness
 *   Returns per-vendor freshness status derived from vendor_market_observations
 *   and data_library_files. Used by the F-key freshness indicators and the
 *   stale-data refresh prompt in the deal UI.
 *
 * Response shape: DealVendorFreshnessResult
 */

import { Router, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../../middleware/auth';
import { getVendorFreshnessForDeal } from '../../services/vendor-freshness.service';

const router = Router({ mergeParams: true });

// ── GET /:dealId/vendor-freshness ────────────────────────────────────────────

router.get('/:dealId/vendor-freshness', async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    // Verify the deal belongs to this user
    const ownerCheck = await pool.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dealId, userId],
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Deal not found or access denied' });
    }

    const result = await getVendorFreshnessForDeal(dealId, pool);
    return res.json(result);
  } catch (err: any) {
    logger.error('vendor-freshness: failed to compute freshness', {
      dealId,
      error: err?.message,
    });
    return res.status(500).json({ error: err?.message ?? 'Failed to compute vendor freshness' });
  }
});

export default router;
