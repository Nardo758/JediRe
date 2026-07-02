import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import {
  initiateClosing,
  getSessionStatus,
  cancelSession,
  getCertificate,
  handleWebhook,
  getSessionHistory,
} from '../../services/notarize/notarize.service';

const router = Router();

const InitiateSchema = z.object({
  document_ids: z.array(z.string().uuid()).min(1, 'At least one document required'),
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    role: z.string().optional(),
  })).min(1, 'At least one signer required'),
  scheduled_at: z.string().optional(),
});

async function verifyDealAccess(dealId: string, userId: string): Promise<boolean> {
  try {
    const pool = getPool();
    // B4a: org-scoped access check (primary gate)
    const { assertDealOrgAccess } = await import('../../services/deal-scoping.service');
    const deal = await assertDealOrgAccess(dealId, userId, pool);
    if (deal) return true;
    // Fallback: deal-team collab members with edit+ permission
    const collab = await pool.query(
      "SELECT id FROM deal_team_members WHERE deal_id = $1 AND user_id = $2 AND status = 'active' AND permission_level IN ('admin', 'edit')",
      [dealId, userId],
    );
    return collab.rows.length > 0;
  } catch {
    return false;
  }
}

router.post('/deals/:dealId/notarize', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!(await verifyDealAccess(dealId, userId))) {
      return res.status(403).json({ error: 'Access denied — admin or edit permission required' });
    }

    const data = InitiateSchema.parse(req.body);

    const result = await initiateClosing({
      dealId,
      userId,
      documentIds: data.document_ids,
      signers: data.signers,
      scheduledAt: data.scheduled_at,
    });

    res.json({
      success: true,
      session: result.session,
      signers: result.signers,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    console.error('[Notarize] Initiate error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to initiate notarization' });
  }
});

router.get('/deals/:dealId/notarize/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await getSessionStatus(dealId);
    if (!result) {
      return res.json({ session: null, signers: [] });
    }

    res.json(result);
  } catch (error: any) {
    console.error('[Notarize] Status error:', error.message);
    res.status(500).json({ error: 'Failed to get notarization status' });
  }
});

router.get('/deals/:dealId/notarize/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const sessions = await getSessionHistory(dealId);
    res.json({ sessions });
  } catch (error: any) {
    console.error('[Notarize] History error:', error.message);
    res.status(500).json({ error: 'Failed to get notarization history' });
  }
});

router.post('/deals/:dealId/notarize/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!(await verifyDealAccess(dealId, userId))) {
      return res.status(403).json({ error: 'Access denied — admin or edit permission required' });
    }

    const { reason } = req.body || {};
    const result = await cancelSession(dealId, userId, reason);
    res.json(result);
  } catch (error: any) {
    console.error('[Notarize] Cancel error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to cancel notarization' });
  }
});

router.get('/deals/:dealId/notarize/certificate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    if (!await assertDealOrgAccess(dealId, userId, pool).catch(() => null)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const result = await getCertificate(dealId);
    res.json(result);
  } catch (error: any) {
    console.error('[Notarize] Certificate error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to get certificate' });
  }
});

router.post('/webhooks/notarize', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-notarize-signature'] as string || req.headers['x-webhook-signature'] as string;
    const eventType = req.body?.event_type || req.body?.type || 'unknown';
    const payload = req.body;

    const result = await handleWebhook(eventType, payload, signature);

    res.json({ received: true, processed: result.processed });
  } catch (error: any) {
    if (error.message === 'Invalid webhook signature' || error.message === 'Missing webhook signature') {
      return res.status(401).json({ error: error.message });
    }
    console.error('[Notarize] Webhook error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
