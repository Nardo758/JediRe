/**
 * Deal Validation API Routes
 * 
 * Endpoints for cross-module consistency validation
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateDealConsistency } from '../../services/deal-consistency-validator.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/deals/:dealId/validate
 * Validate data consistency across all modules
 */
router.post('/:dealId/validate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;

    // Verify user has access to this deal
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

    const deal = dealCheck.rows[0];

    logger.info('Running consistency validation:', { userId, dealId, dealName: deal.name });

    // Run validation
    const validation = await validateDealConsistency(dealId);

    // Log results
    logger.info('Validation complete:', {
      dealId,
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      infoCount: validation.info.length,
    });

    res.json({
      success: true,
      data: {
        dealId,
        dealName: deal.name,
        validation,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    logger.error('Validation endpoint error:', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Validation failed'
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/validation-status
 * Quick check - returns just pass/fail and count
 */
router.get('/:dealId/validation-status', async (req: Request, res: Response) => {
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

    // Run validation
    const validation = await validateDealConsistency(dealId);

    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        summary: validation.summary,
        counts: {
          errors: validation.errors.length,
          warnings: validation.warnings.length,
          info: validation.info.length,
        }
      }
    });

  } catch (error: any) {
    logger.error('Validation status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check validation status'
    });
  }
});

/**
 * POST /api/v1/deals/validate-all
 * Validate all deals for a user (admin function)
 */
router.post('/validate-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { limit = 10 } = req.body;

    // Get user's deals
    const dealsResult = await query(
      'SELECT id, name FROM deals WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2',
      [userId, limit]
    );

    const results = [];

    for (const deal of dealsResult.rows) {
      const validation = await validateDealConsistency(deal.id);
      results.push({
        dealId: deal.id,
        dealName: deal.name,
        isValid: validation.isValid,
        summary: validation.summary,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
      });
    }

    logger.info('Bulk validation complete:', {
      userId,
      dealsChecked: results.length,
      validCount: results.filter(r => r.isValid).length,
    });

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          valid: results.filter(r => r.isValid).length,
          invalid: results.filter(r => !r.isValid).length,
        }
      }
    });

  } catch (error: any) {
    logger.error('Bulk validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Bulk validation failed'
    });
  }
});

export default router;
