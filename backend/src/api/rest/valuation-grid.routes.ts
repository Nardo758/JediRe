/**
 * Valuation Grid API Routes
 * Task #1370, Dispatch 2
 *
 * GET  /api/v1/deals/:dealId/valuation-grid          — compute full grid
 * PATCH /api/v1/deals/:dealId/valuation-grid/override — save operator override
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { ValuationGridService } from '../../services/valuation/valuation-grid.service';
import { getPool } from '../../database/connection';

const router = Router();

function getService(): ValuationGridService {
  return new ValuationGridService(getPool());
}

/**
 * GET /api/v1/deals/:dealId/valuation-grid
 * Returns the full multi-method valuation grid computation.
 */
router.get('/deals/:dealId/valuation-grid', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const svc = getService();
    const result = await svc.compute(dealId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[valuation-grid] compute error:', err);
    res.status(err.message?.includes('not found') ? 404 : 500).json({
      success: false,
      error: err.message ?? 'Failed to compute valuation grid',
    });
  }
});

/**
 * PATCH /api/v1/deals/:dealId/valuation-grid/override
 * Persists an operator override purchase price into deal_assumptions.valuation_override_lv.
 *
 * Body: { value: number, rationale?: string }
 */
router.patch('/deals/:dealId/valuation-grid/override', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { value, rationale } = req.body;

    if (typeof value !== 'number' || value <= 0) {
      return res.status(400).json({
        success: false,
        error: 'value must be a positive number',
      });
    }

    const svc = getService();
    await svc.saveOperatorOverride(dealId, value, rationale);

    res.json({ success: true, message: 'Valuation override saved.' });
  } catch (err: any) {
    console.error('[valuation-grid] override error:', err);
    res.status(500).json({
      success: false,
      error: err.message ?? 'Failed to save override',
    });
  }
});

export default router;
