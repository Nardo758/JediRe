/**
 * Revenue Routes
 *
 * Repricing synthesizer endpoints for the Asset Hub REVENUE screen.
 * Mounted at /api/v1/revenue in index.replit.ts.
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { synthesizeRepricingCourse } from '../../services/repricing-synthesizer.service';

const router = Router();

/**
 * GET /api/v1/revenue/:dealId/course
 *
 * Compute and return a repricing course recommendation for a deal.
 * Synthesizes from monthly actuals, loss-to-lease, and correlation signals.
 *
 * Response shape (RepricingCourse):
 *   signal:            'PUSH' | 'HOLD' | 'WATCH'
 *   confidence:        'high' | 'medium' | 'low'
 *   captured_per_mo:   estimated monthly dollar capture
 *   net_lift_pct:      projected net effective-rent lift (0–1 fraction)
 *   recommended_rents: [{month, unit_type, recommended_rent}]  — 12-month ramp
 *   computed_at:       ISO timestamp
 *   basis:             debug snapshot of input signals used
 */
router.get('/:dealId/course', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const course = await synthesizeRepricingCourse(dealId);
    res.json({ success: true, ...course });
  } catch (err) {
    logger.error('[revenue] repricing course error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute repricing course' });
  }
});

export default router;
