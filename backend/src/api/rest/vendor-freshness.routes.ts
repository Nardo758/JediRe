/**
 * Vendor Freshness Routes — Phase 2C
 *
 * Exposes the freshness state of all registered vendors' data for a deal.
 * Mounted at /api/v1/deals (via requireAuth in index.replit.ts).
 *
 * GET  /:dealId/vendor-freshness
 *   Returns per-vendor freshness status derived from vendor_market_observations
 *   and data_library_files. Used by the F-key freshness indicators and the
 *   stale-data refresh prompt in the deal UI.
 *
 * POST /:dealId/vendor-refresh
 *   Body: { vendorId: string }
 *   Finds the most recent data_library_files row for the given vendor + deal,
 *   atomically claims it for re-parse, and fires the parse pipeline in the
 *   background. Returns 202 on success, 409 if already running, 404 if no
 *   prior upload exists.
 *
 * Response shapes: DealVendorFreshnessResult / VendorRefreshResult
 */

import { Router, Response } from 'express';
import { assertDealOrgAccess } from '../../services/deal-scoping.service';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../../middleware/auth';
import {
  getVendorFreshnessForDeal,
  enqueueVendorRefresh,
} from '../../services/vendor-freshness.service';

const router = Router({ mergeParams: true });

// ── GET /:dealId/vendor-freshness ────────────────────────────────────────────

router.get('/:dealId/vendor-freshness', async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    // Verify the deal belongs to this user
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Deal not found or access denied' });
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

// ── POST /:dealId/vendor-refresh ─────────────────────────────────────────────

router.post('/:dealId/vendor-refresh', async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { vendorId } = req.body ?? {};
  if (!vendorId || typeof vendorId !== 'string') {
    return res.status(400).json({ error: 'vendorId is required' });
  }

  try {
    const pool = getPool();

    // Verify the deal belongs to this user
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Deal not found or access denied' });
    }

    const result = await enqueueVendorRefresh(dealId, vendorId, pool);

    if (result.status === 'no_files') {
      return res.status(404).json({
        vendorId,
        status: 'no_files',
        error: 'No prior upload found for this vendor — upload a fresh export from the Data Library',
      });
    }

    if (result.status === 'already_running') {
      return res.status(409).json({
        vendorId,
        status: 'already_running',
        error: 'A re-import is already in progress for this vendor',
      });
    }

    return res.status(202).json(result);
  } catch (err: any) {
    logger.error('vendor-refresh: failed to enqueue refresh', {
      dealId,
      vendorId,
      error: err?.message,
    });
    return res.status(500).json({ error: err?.message ?? 'Failed to enqueue vendor refresh' });
  }
});

export default router;
