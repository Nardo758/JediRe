/**
 * Financial Models API Routes
 * Handle financial model data for deals
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/financial-models
 * Create or save a financial model
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId, name, version, components, assumptions, results } = req.body;

    // Validation
    if (!dealId) {
      return res.status(400).json({
        success: false,
        error: 'dealId is required'
      });
    }

    // Verify user has access to this deal
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

    // Create financial model
    const result = await query(
      `INSERT INTO financial_models 
       (deal_id, user_id, name, version, components, assumptions, results)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dealId,
        userId,
        name || 'Financial Model',
        version || 1,
        JSON.stringify(components || []),
        JSON.stringify(assumptions || {}),
        JSON.stringify(results || {})
      ]
    );

    logger.info('Financial model created:', {
      userId,
      dealId,
      modelId: result.rows[0].id
    });

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error creating financial model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create financial model'
    });
  }
});

/**
 * GET /api/v1/financial-models/:dealId
 * Get financial model for a deal
 */
router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;

    // Verify user has access to this deal
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

    // Get latest financial model for this deal
    const result = await query(
      `SELECT * FROM financial_models 
       WHERE deal_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Financial model not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching financial model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch financial model'
    });
  }
});

/**
 * PATCH /api/v1/financial-models/:id
 * Update a financial model
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { name, version, components, assumptions, results } = req.body;

    // Verify ownership
    const ownerCheck = await query(
      'SELECT id FROM financial_models WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Financial model not found or access denied'
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (version !== undefined) {
      updates.push(`version = $${paramIndex++}`);
      values.push(version);
    }
    if (components !== undefined) {
      updates.push(`components = $${paramIndex++}`);
      values.push(JSON.stringify(components));
    }
    if (assumptions !== undefined) {
      updates.push(`assumptions = $${paramIndex++}`);
      values.push(JSON.stringify(assumptions));
    }
    if (results !== undefined) {
      updates.push(`results = $${paramIndex++}`);
      values.push(JSON.stringify(results));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);
    const result = await query(
      `UPDATE financial_models 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    logger.info('Financial model updated:', {
      userId,
      modelId: id
    });

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating financial model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update financial model'
    });
  }
});

/**
 * DELETE /api/v1/financial-models/:id
 * Delete a financial model
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    // Verify ownership
    const ownerCheck = await query(
      'SELECT id FROM financial_models WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Financial model not found or access denied'
      });
    }

    await query('DELETE FROM financial_models WHERE id = $1', [id]);

    logger.info('Financial model deleted:', {
      userId,
      modelId: id
    });

    res.json({
      success: true,
      message: 'Financial model deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting financial model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete financial model'
    });
  }
});

export default router;
