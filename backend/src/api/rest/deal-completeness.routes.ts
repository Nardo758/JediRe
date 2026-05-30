/**
 * Deal Completeness Routes (Piece C1)
 *
 * GET  /api/v1/deals/:dealId/completeness
 *   Returns the evaluated DealCompleteness snapshot for the deal.
 *
 * POST /api/v1/deals/:dealId/completeness/:signalId/acknowledge
 *   Operator acknowledges a signal ("known gap, proceeding anyway").
 *   Body: { notes?: string }
 *
 * DELETE /api/v1/deals/:dealId/completeness/:signalId/acknowledge
 *   Retracts an acknowledgement (re-enables the signal in the badge count).
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { pool } from '../../database';
import { logger } from '../../utils/logger';
import {
  evaluateCompleteness,
  acknowledgeSignal,
  unacknowledgeSignal,
} from '../../services/deal-completeness/deal-completeness.service';

const router = Router();
router.use(requireAuth);

// ─── Ownership check helper ───────────────────────────────────────────────────

async function verifyDealAccess(
  dealId: string,
  userId: string,
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [dealId, userId],
  );
  return res.rows.length > 0;
}

// ─── GET /api/v1/deals/:dealId/completeness ───────────────────────────────────

router.get('/:dealId/completeness', async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const { dealId } = req.params;

  try {
    const hasAccess = await verifyDealAccess(dealId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const completeness = await evaluateCompleteness(pool, dealId, userId);
    return res.json(completeness);
  } catch (err: any) {
    logger.error('deal-completeness GET error', { dealId, error: err.message });
    return res.status(500).json({ error: 'Failed to evaluate deal completeness' });
  }
});

// ─── POST /api/v1/deals/:dealId/completeness/:signalId/acknowledge ────────────

router.post('/:dealId/completeness/:signalId/acknowledge', async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const { dealId, signalId } = req.params;
  const { notes } = req.body ?? {};

  try {
    const hasAccess = await verifyDealAccess(dealId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await acknowledgeSignal(pool, dealId, signalId, userId, notes);
    const updated = await evaluateCompleteness(pool, dealId, userId);
    return res.json(updated);
  } catch (err: any) {
    if ((err as Error).message.startsWith('Unknown signal ID')) {
      return res.status(400).json({ error: err.message });
    }
    logger.error('deal-completeness acknowledge error', { dealId, signalId, error: err.message });
    return res.status(500).json({ error: 'Failed to acknowledge signal' });
  }
});

// ─── DELETE /api/v1/deals/:dealId/completeness/:signalId/acknowledge ──────────

router.delete('/:dealId/completeness/:signalId/acknowledge', async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const { dealId, signalId } = req.params;

  try {
    const hasAccess = await verifyDealAccess(dealId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await unacknowledgeSignal(pool, dealId, signalId, userId);
    const updated = await evaluateCompleteness(pool, dealId, userId);
    return res.json(updated);
  } catch (err: any) {
    logger.error('deal-completeness unacknowledge error', { dealId, signalId, error: err.message });
    return res.status(500).json({ error: 'Failed to retract acknowledgement' });
  }
});

export default router;
