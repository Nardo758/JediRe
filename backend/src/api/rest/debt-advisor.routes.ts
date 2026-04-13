/**
 * Debt Advisor Routes
 * Strategy-driven debt recommendation for a given deal.
 *
 * GET  /api/v1/deals/:dealId/debt/advisor           — get recommendation (15min cache)
 * POST /api/v1/deals/:dealId/debt/advisor/accept    — accept plan → populate Configure fields
 * POST /api/v1/deals/:dealId/debt/advisor/recompute — bust cache + recompute
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { formulateDebtPlan, bustAdvisorCache, acceptDebtPlan } from '../../services/debt-advisor/debt-plan-formulator.service';
import { classifyRateEnvironment, bustRateCache } from '../../services/debt-advisor/rate-environment.service';
import { logger } from '../../utils/logger';

const router = Router({ mergeParams: true });

interface AuthenticatedRequest extends Request {
  user?: { id: string; orgId?: string };
}

/** GET /api/v1/deals/:dealId/debt/advisor */
router.get('/:dealId/debt/advisor', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  try {
    const plan = await formulateDebtPlan(dealId);
    return res.json({ success: true, data: plan });
  } catch (err: any) {
    logger.error('[DebtAdvisor] GET failed', { dealId, error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/v1/deals/:dealId/debt/advisor/accept */
router.post('/:dealId/debt/advisor/accept', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const { phaseIndex = 0 } = req.body;
  try {
    const result = await acceptDebtPlan(dealId, phaseIndex);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    return res.json({ success: true, message: result.message });
  } catch (err: any) {
    logger.error('[DebtAdvisor] Accept failed', { dealId, error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/v1/deals/:dealId/debt/advisor/recompute */
router.post('/:dealId/debt/advisor/recompute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  try {
    bustAdvisorCache(dealId);
    bustRateCache();
    const plan = await formulateDebtPlan(dealId);
    return res.json({ success: true, data: plan, message: 'Recomputed from live market data' });
  } catch (err: any) {
    logger.error('[DebtAdvisor] Recompute failed', { dealId, error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/v1/deals/debt/rate-environment — public rate environment snapshot */
router.get('/debt/rate-environment', async (_req: Request, res: Response) => {
  try {
    const env = await classifyRateEnvironment();
    return res.json({ success: true, data: env });
  } catch (err: any) {
    logger.error('[DebtAdvisor] Rate environment failed', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
