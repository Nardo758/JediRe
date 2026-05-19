/**
 * deal-shares.routes.ts — Task B
 *
 * Deal-level share management endpoints. Mounted at /api/v1/deals (with requireAuth).
 * Resolves deal_id → capsule_id via deal_data->>'deal_id' (JSON field on deal_capsules).
 *
 * Routes:
 *   GET  /:dealId/shares              — list all shares for the deal's capsule
 *   POST /:dealId/shares/:shareId/revoke — revoke a specific share
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// ─── GET /:dealId/shares ──────────────────────────────────────────────────────
// Resolves deal → capsule → shares. Returns capsule_id alongside shares so the
// frontend can pass it to ShareCapsuleModal for new-share creation.

router.get('/:dealId/shares', requireAuth, async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    // Resolve deal → capsule. deal_capsules stores deal_id inside the deal_data JSONB field.
    const capsuleResult = await pool.query<{ id: string }>(
      `SELECT id FROM deal_capsules
       WHERE deal_data->>'deal_id' = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [dealId, userId],
    );

    if (capsuleResult.rows.length === 0) {
      return res.json({ capsule_id: null, shares: [] });
    }
    const capsuleId = capsuleResult.rows[0].id;

    const sharesResult = await pool.query(
      `SELECT
         ces.share_id,
         ces.share_type,
         ces.share_mode,
         ces.label,
         ces.recipient_email,
         ces.recipient_name,
         ces.created_at,
         ces.expires_at,
         ces.revoked_at,
         ces.preview_text,
         ces.share_url,
         ces.shortcode,
         CASE
           WHEN ces.revoked_at IS NOT NULL THEN 'revoked'
           WHEN ces.expires_at IS NOT NULL AND ces.expires_at < NOW() THEN 'expired'
           ELSE 'active'
         END AS share_status
       FROM capsule_external_shares ces
       WHERE ces.capsule_id = $1
       ORDER BY ces.created_at DESC`,
      [capsuleId],
    );

    return res.json({ capsule_id: capsuleId, shares: sharesResult.rows });
  } catch (err: any) {
    logger.error('Failed to list deal shares', { error: err?.message, dealId });
    return res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

// ─── POST /:dealId/shares/:shareId/revoke ────────────────────────────────────
// Revokes a specific share. Ownership is verified via the capsule.

router.post('/:dealId/shares/:shareId/revoke', requireAuth, async (req: Request, res: Response) => {
  const { dealId, shareId } = req.params;
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    const capsuleResult = await pool.query<{ id: string }>(
      `SELECT id FROM deal_capsules
       WHERE deal_data->>'deal_id' = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [dealId, userId],
    );

    if (capsuleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found for this deal' });
    }
    const capsuleId = capsuleResult.rows[0].id;

    const result = await pool.query(
      `UPDATE capsule_external_shares
       SET revoked_at = NOW()
       WHERE share_id = $1 AND capsule_id = $2 AND revoked_at IS NULL
       RETURNING share_id`,
      [shareId, capsuleId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or already revoked' });
    }

    return res.json({ revoked: true, share_id: result.rows[0].share_id });
  } catch (err: any) {
    logger.error('Failed to revoke deal share', { error: err?.message, dealId, shareId });
    return res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

export default router;
