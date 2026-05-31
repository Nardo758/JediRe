/**
 * Field Divergence API Routes — Piece B3 (Divergence Surfacing)
 *
 * GET /api/v1/deals/:dealId/field-divergences
 *   Returns divergence signatures for all tracked LayeredValue fields
 *   in deal_assumptions.year1.  Only fields with ≥2 non-null source layers
 *   are returned; the caller skips fields where no comparison is possible.
 *
 * GET /api/v1/deals/:dealId/field-divergences/summary
 *   Returns aggregate counts for T-C1 deal completeness scoring.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import { getFieldValues, getDivergenceSummary } from '../../services/field-access/get-field-value.service';
import { logger } from '../../utils/logger';

const router = Router();
router.use(requireAuth);

const DIVERGENCE_FIELDS = [
  'gpr', 'egi', 'total_opex',
  'loss_to_lease', 'vacancy', 'concessions', 'bad_debt',
  'other_income', 'real_estate_tax', 'insurance', 'management_fee',
  'repairs_maintenance', 'utilities', 'payroll', 'administrative',
  'marketing', 'contract_services', 'noi', 'exit_cap', 'rent_growth_yr1',
];

router.get('/:dealId/field-divergences', async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const { dealId } = req.params;
  const pool = getPool();

  try {
    const accessCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1::uuid AND user_id = $2 LIMIT 1',
      [dealId, userId],
    );
    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    const values = await getFieldValues(pool, dealId, DIVERGENCE_FIELDS);

    const result: Array<{
      fieldName: string;
      divergence: NonNullable<(typeof values)[string]>['divergenceSignature'];
    }> = [];

    for (const fieldName of DIVERGENCE_FIELDS) {
      const lv = values[fieldName];
      if (!lv?.divergenceSignature) continue;
      result.push({ fieldName, divergence: lv.divergenceSignature });
      // Ledger observation is now emitted at detection time inside getFieldValues().
    }

    return res.json({ success: true, data: result, dealId });
  } catch (err: any) {
    logger.error('field-divergences error', { dealId, error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to compute field divergences' });
  }
});

router.get('/:dealId/field-divergences/summary', async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const { dealId } = req.params;
  const pool = getPool();

  try {
    const accessCheck = await pool.query(
      'SELECT id FROM deals WHERE id = $1::uuid AND user_id = $2 LIMIT 1',
      [dealId, userId],
    );
    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    const summary = await getDivergenceSummary(pool, dealId);
    return res.json({ success: true, data: summary, dealId });
  } catch (err: any) {
    logger.error('field-divergences/summary error', { dealId, error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to compute divergence summary' });
  }
});

export default router;
