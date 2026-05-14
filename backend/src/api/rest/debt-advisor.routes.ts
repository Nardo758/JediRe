/**
 * Debt Advisor Routes
 * Strategy-driven debt recommendation for a given deal.
 *
 * GET  /api/v1/deals/:dealId/debt/advisor           — get recommendation (15min cache).
 *                                                      CE-09: the recommendation is
 *                                                      auto-applied to Pro Forma
 *                                                      per_year_overrides as
 *                                                      resolution:'platform' the moment
 *                                                      it is computed (no Accept needed).
 *                                                      User overrides win over platform
 *                                                      via the standard LayeredValue
 *                                                      precedence — preserved by the
 *                                                      applyDebtAdvisorPlatformDefault
 *                                                      SQL guard.
 * POST /api/v1/deals/:dealId/debt/advisor/accept    — confirmation + monitoring-trigger
 *                                                      alert registration. Re-runs the
 *                                                      platform-default write
 *                                                      (idempotent) and registers the
 *                                                      monitoring triggers as alerts.
 *                                                      Post-D3 this is an
 *                                                      acknowledgment step, not the
 *                                                      activation gate.
 * POST /api/v1/deals/:dealId/debt/advisor/recompute — bust cache + recompute (which
 *                                                      re-fires the platform-default
 *                                                      write under the same guard).
 * GET  /api/v1/deals/debt/rate-environment          — public rate environment snapshot
 *                                                      from rate-environment.service —
 *                                                      the single canonical producer
 *                                                      post-CE-07.
 */
import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { formulateDebtPlan, bustAdvisorCache, acceptDebtPlan } from '../../services/debt-advisor/debt-plan-formulator.service';
import { classifyRateEnvironment, bustRateCache } from '../../services/debt-advisor/rate-environment.service';
import { dealAlertService } from '../../services/deal-alert.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router({ mergeParams: true });

/** Verify caller owns or has org access to the deal. Returns false on IDOR. */
async function hasDealAccess(dealId: string, userId: string): Promise<boolean> {
  try {
    const orgRow = await query(
      `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const orgId: string | null = orgRow.rows[0]?.org_id ?? null;

    const result = await query(
      `SELECT id FROM deals
       WHERE id = $1
         AND (user_id = $2 OR ($3::uuid IS NOT NULL AND org_id = $3))`,
      [dealId, userId, orgId]
    );
    return result.rows.length > 0;
  } catch (err: any) {
    logger.warn('[DebtAdvisor] Deal access check failed', { dealId, userId, error: err.message });
    return false;
  }
}

/** GET /api/v1/deals/:dealId/debt/advisor */
router.get('/:dealId/debt/advisor', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user!.userId;

  if (!(await hasDealAccess(dealId, userId))) {
    return res.status(404).json({ success: false, error: 'Deal not found' });
  }

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
  const userId = req.user!.userId;

  if (!(await hasDealAccess(dealId, userId))) {
    return res.status(404).json({ success: false, error: 'Deal not found' });
  }

  try {
    const plan = await formulateDebtPlan(dealId);

    const result = await acceptDebtPlan(dealId, userId, phaseIndex);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    const alertPromises = plan.monitoringTriggers.map(trigger =>
      dealAlertService.createAlert({
        userId,
        dealId,
        alertType: 'market_shift',
        severity: trigger.severity === 'critical' ? 'red' : trigger.severity === 'warning' ? 'yellow' : 'green',
        title: `[Debt Monitor] ${trigger.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
        message: trigger.condition,
        suggestedAction: trigger.action,
        impactSummary: `Frequency: ${trigger.frequency} | Threshold: ${trigger.threshold}`,
      }).catch((alertErr: any) => {
        logger.warn('[DebtAdvisor] Non-critical: failed to register monitoring alert', {
          dealId,
          triggerId: trigger.id,
          error: alertErr?.message,
        });
      })
    );
    await Promise.all(alertPromises);

    return res.json({ success: true, message: result.message, alertsRegistered: plan.monitoringTriggers.length });
  } catch (err: any) {
    logger.error('[DebtAdvisor] Accept failed', { dealId, error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/v1/deals/:dealId/debt/advisor/recompute
 * Optional body: { productHint: string } — forces phase 1 product substitution
 * so the Advisor can "Run Alternative" for any alternative product.
 */
router.post('/:dealId/debt/advisor/recompute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user!.userId;
  const { productHint } = req.body as { productHint?: string };

  if (!(await hasDealAccess(dealId, userId))) {
    return res.status(404).json({ success: false, error: 'Deal not found' });
  }

  try {
    bustAdvisorCache(dealId);
    bustRateCache();
    const plan = await formulateDebtPlan(dealId, productHint);
    return res.json({ success: true, data: plan, message: productHint ? `Alternative computed: ${productHint}` : 'Recomputed from live market data' });
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
