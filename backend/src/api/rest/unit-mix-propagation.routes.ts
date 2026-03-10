/**
 * Unit Mix Propagation API Routes
 * 
 * Endpoints for propagating unit mix data to all dependent modules
 */

import { Router, Request, Response } from 'express';
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
    const dealCheck = await query(
      'SELECT id, name FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }

    logger.info('Applying unit mix:', { userId, dealId, source });

    const result = await propagateUnitMix(dealId, source);

    res.json({
      success: result.success,
      data: {
        dealId,
        dealName: dealCheck.rows[0].name,
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
    const dealCheck = await query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
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
    const dealCheck = await query(
      'SELECT id, name FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }

    logger.info('Setting manual unit mix:', { userId, dealId, unitMix });

    const result = await setManualUnitMix(dealId, unitMix);

    res.json({
      success: result.success,
      data: {
        dealId,
        dealName: dealCheck.rows[0].name,
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
    const dealCheck = await query(
      'SELECT id, name, module_outputs FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }

    const deal = dealCheck.rows[0];
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

export default router;
