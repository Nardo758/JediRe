/**
 * Unit Mix Propagation API Routes
 * 
 * Endpoints for propagating unit mix data to all dependent modules
 */

import { Router, Request, Response } from 'express';
import { assertDealOrgAccess } from '../../services/deal-scoping.service';
import { requireAuth } from '../../middleware/auth';
import { 
  propagateUnitMix, 
  getUnitMixStatus,
  setManualUnitMix 
} from '../../services/unit-mix-propagation.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/v1/deals/:dealId/unit-mix/apply
 * Apply unit mix to all modules
 */
router.post('/:dealId/unit-mix/apply', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { source = 'manual' } = req.body;

    // Verify access
    const dealCheck = await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null);
    if (!dealCheck) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    logger.info('Applying unit mix:', { userId, dealId, source });

    const result = await propagateUnitMix(dealId, source);

    res.json({
      success: result.success,
      data: {
        dealId,
        dealName: dealCheck.name,
        result,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    logger.error('Apply unit mix error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply unit mix'
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/unit-mix/status
 * Get current unit mix status
 */
router.get('/:dealId/unit-mix/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;

    // Verify access
    if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    const status = await getUnitMixStatus(dealId);

    res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    logger.error('Get unit mix status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unit mix status'
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/unit-mix/set
 * Manually set unit mix (user override)
 */
router.post('/:dealId/unit-mix/set', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { unitMix } = req.body;

    if (!unitMix) {
      return res.status(400).json({
        success: false,
        error: 'Unit mix data required'
      });
    }

    // Verify access
    const dealCheck = await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null);
    if (!dealCheck) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    logger.info('Setting manual unit mix:', { userId, dealId, unitMix });

    const result = await setManualUnitMix(dealId, unitMix);

    res.json({
      success: result.success,
      data: {
        dealId,
        dealName: dealCheck.name,
        result,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    logger.error('Set manual unit mix error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set unit mix'
    });
  }
});

/**
 * PUT /api/v1/deals/:dealId/unit-mix/types
 * Save the full unit type array directly to deal_assumptions.unit_mix
 * and propagate to all dependent modules.
 * Used by the manual build-from-scratch UX in UnitMixTab (development deals).
 */
router.put('/:dealId/unit-mix/types', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { types } = req.body as { types: Array<{
      type: string;
      count: number;
      avg_sqft: number | null;
      in_place_rent: number | null;
      market_rent: number | null;
      bedrooms: number | null;
      bathrooms: number | null;
      notes?: string | null;
    }> };

    if (!Array.isArray(types)) {
      return res.status(400).json({ success: false, error: 'types must be an array' });
    }

    const dealCheck = await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null);
    if (!dealCheck) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    const dealType = dealCheck.deal_category || dealCheck.development_type || '';
    if (dealType === 'development' || dealType === 'redevelopment') {
      return res.status(403).json({ success: false, error: 'Unit mix cannot be changed for development or redevelopment deals' });
    }

    logger.info('Saving manual unit mix types:', { userId, dealId, count: types.length });

    const totalCount = types.reduce((s, t) => s + (t.count ?? 0), 0);

    // 1. Upsert deal_assumptions.unit_mix — primary source for proforma GPR
    await query(
      `INSERT INTO deal_assumptions (deal_id, unit_mix, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (deal_id) DO UPDATE
         SET unit_mix = $2::jsonb, updated_at = NOW()`,
      [dealId, JSON.stringify(types)]
    );

    // 2. Write to module_outputs.unitMixOverride in the shape that
    //    getAuthoritativeUnitMix() / parseUnitMixData() expect, so the
    //    upcoming propagateUnitMix() call fans out the correct mix.
    //    Also update target_units in the same statement to prevent a
    //    double-write race between this and the propagation step.
    const unitMixOverride = {
      program: types.map(t => ({
        unitType: t.type,
        count: t.count ?? 0,
        avgSF: t.avg_sqft ?? 0,
        sf: t.avg_sqft ?? 0,
        // Carry explicit bedroom count so parseUnitMixData() can classify by
        // bedrooms first rather than relying on label-text heuristics.
        bedrooms: t.bedrooms ?? null,
      })),
      updatedAt: new Date().toISOString(),
    };
    await query(
      `UPDATE deals
       SET module_outputs = jsonb_set(
             COALESCE(module_outputs, '{}'::jsonb),
             '{unitMixOverride}',
             $1::jsonb
           ),
           target_units = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(unitMixOverride), totalCount > 0 ? totalCount : dealCheck.target_units, dealId]
    );

    // 3. Propagate to financial model, 3D design, dev capacity, etc.
    //    getAuthoritativeUnitMix() will now find the override written above.
    const result = await propagateUnitMix(dealId, 'manual');

    res.json({
      success: result.success,
      data: {
        dealId,
        dealName: dealCheck.name,
        typesCount: types.length,
        totalUnits: totalCount,
        propagation: result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Save unit mix types error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save unit mix types' });
  }
});

/**
 * POST /api/v1/deals/:dealId/development-path/select
 * Select development path and propagate unit mix
 */
router.post('/:dealId/development-path/select', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { pathId } = req.body;

    if (!pathId) {
      return res.status(400).json({
        success: false,
        error: 'Path ID required'
      });
    }

    // Verify access
    const dealCheck = await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null);
    if (!dealCheck) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    const deal = dealCheck;
    const moduleOutputs = deal.module_outputs || {};
    const strategy = moduleOutputs.developmentStrategy;

    if (!strategy || !strategy.paths) {
      return res.status(400).json({
        success: false,
        error: 'No development paths available'
      });
    }

    // Find the selected path
    const selectedPath = strategy.paths.find((p: any) => p.id === pathId);

    if (!selectedPath) {
      return res.status(404).json({
        success: false,
        error: 'Development path not found'
      });
    }

    logger.info('Selecting development path:', { userId, dealId, pathId });

    // Update selected path in database
    strategy.selectedPath = selectedPath;
    strategy.selectedPathId = pathId;

    await query(
      `UPDATE deals
       SET module_outputs = jsonb_set(
         module_outputs,
         '{developmentStrategy}',
         $1::jsonb
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(strategy), dealId]
    );

    // Propagate unit mix from selected path
    const result = await propagateUnitMix(dealId, 'path');

    res.json({
      success: result.success,
      data: {
        dealId,
        dealName: deal.name,
        selectedPath,
        propagation: result,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    logger.error('Select development path error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to select development path'
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/f3-program
 * Return the saved F3 Programming tab program targets.
 */
router.get('/:dealId/f3-program', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;

    if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    const result = await query(
      'SELECT f3_design_program FROM deal_assumptions WHERE deal_id = $1',
      [dealId]
    );

    const program = result.rows[0]?.f3_design_program ?? null;

    return res.json({ success: true, data: program });
  } catch (error: any) {
    logger.error('GET f3-program error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to get F3 program' });
  }
});

/**
 * PUT /api/v1/deals/:dealId/f3-program
 * Persist the F3 Programming tab program targets.
 */
router.put('/:dealId/f3-program', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { program } = req.body;

    if (!program || typeof program !== 'object') {
      return res.status(400).json({ success: false, error: 'program object required' });
    }

    if (!await assertDealOrgAccess(dealId, userId, { query } as any).catch(() => null)) {
      return res.status(404).json({ success: false, error: 'Deal not found or access denied' });
    }

    await query(
      `INSERT INTO deal_assumptions (deal_id, f3_design_program, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (deal_id) DO UPDATE
         SET f3_design_program = $2::jsonb, updated_at = NOW()`,
      [dealId, JSON.stringify(program)]
    );

    logger.info('Saved F3 design program:', { userId, dealId });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('PUT f3-program error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to save F3 program' });
  }
});

export default router;
