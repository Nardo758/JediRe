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
 * GET /api/v1/financial-models
 * List all financial models
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    const result = await query(
      `SELECT 
         fm.id, 
         fm.deal_id, 
         fm.name, 
         fm.version, 
         fm.created_at, 
         fm.updated_at,
         d.name as deal_name
       FROM financial_models fm
       LEFT JOIN deals d ON d.id = fm.deal_id
       WHERE fm.user_id = $1
       ORDER BY fm.updated_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    logger.error('Error listing financial models', { error: error.message });
    
    // Return empty list if table doesn't exist
    if (error.message?.includes('does not exist')) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch financial models'
    });
  }
});

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

// ============================================================================
// CLAUDE-POWERED FINANCIAL MODEL ENDPOINTS (Phase 4)
// ============================================================================

/**
 * POST /api/v1/financial-models/:dealId/compute-claude
 * NEW: Trigger Claude-powered financial model computation
 * 
 * This endpoint:
 * 1. Infers model type (acquisition/development/redevelopment)
 * 2. Assembles assumptions from deal context (broker/platform/user)
 * 3. Calls Claude API with structured output
 * 4. Validates the output
 * 5. Stores/updates the financial model with Claude output
 */
router.post('/:dealId/compute-claude', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { forceRecompute = false, modelTypeOverride } = req.body;

    // Verify user has access to this deal
    const dealCheck = await query(
      'SELECT * FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (dealCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or access denied'
      });
    }

    const deal = dealCheck.rows[0];

    // Import services (lazy load to avoid circular deps)
    const { inferModelType } = await import('../../services/model-type-inference.service');
    const { assembleAssumptions } = await import('../../services/assumption-assembly.service');
    const { computeFinancialModel } = await import('../../services/claude-compute.service');
    const { validateModelOutput } = await import('../../services/model-validator.service');

    // Step 1: Infer model type
    const modelType = modelTypeOverride || inferModelType(deal);
    logger.info('Model type inferred:', { dealId, modelType });

    // Step 2: Assemble assumptions from all sources
    const assumptions = await assembleAssumptions(dealId, userId, modelType);
    logger.info('Assumptions assembled:', { dealId, modelType, sourceCount: Object.keys(assumptions).length });

    // Step 3: Compute with Claude
    const claudeOutput = await computeFinancialModel(
      dealId,
      modelType,
      assumptions,
      forceRecompute
    );

    // Step 4: Validate output
    const validation = validateModelOutput(modelType, claudeOutput);
    
    if (!validation.isValid) {
      logger.warn('Claude output validation failed:', { 
        dealId, 
        modelType, 
        errors: validation.errors 
      });
    }

    // Step 5: Store in financial_models table
    const existing = await query(
      'SELECT id FROM financial_models WHERE deal_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      [dealId, userId]
    );

    let modelRecord;
    
    if (existing.rows.length > 0) {
      // Update existing model
      const updateResult = await query(
        `UPDATE financial_models 
         SET 
           components = $1,
           assumptions = $2,
           results = $3,
           claude_output = $4,
           model_type = $5,
           computed_at = NOW(),
           validation = $6,
           updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          JSON.stringify(claudeOutput.components || []),
          JSON.stringify(assumptions),
          JSON.stringify(claudeOutput),
          JSON.stringify(claudeOutput),
          modelType,
          JSON.stringify(validation),
          existing.rows[0].id
        ]
      );
      modelRecord = updateResult.rows[0];
    } else {
      // Create new model
      const insertResult = await query(
        `INSERT INTO financial_models 
         (deal_id, user_id, name, version, components, assumptions, results, claude_output, model_type, computed_at, validation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
         RETURNING *`,
        [
          dealId,
          userId,
          `${modelType} Model`,
          1,
          JSON.stringify(claudeOutput.components || []),
          JSON.stringify(assumptions),
          JSON.stringify(claudeOutput),
          JSON.stringify(claudeOutput),
          modelType,
          JSON.stringify(validation)
        ]
      );
      modelRecord = insertResult.rows[0];
    }

    logger.info('Claude financial model computed:', {
      userId,
      dealId,
      modelId: modelRecord.id,
      modelType,
      validationStatus: validation.isValid ? 'valid' : 'invalid'
    });

    res.json({
      success: true,
      data: {
        model: modelRecord,
        validation,
        metadata: {
          modelType,
          computedAt: new Date().toISOString(),
          cached: claudeOutput._cached || false
        }
      }
    });

  } catch (error: any) {
    logger.error('Error computing Claude financial model:', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to compute financial model'
    });
  }
});

/**
 * GET /api/v1/financial-models/:dealId/claude-output
 * NEW: Get Claude-computed output if it exists
 */
router.get('/:dealId/claude-output', async (req: Request, res: Response) => {
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

    // Get latest financial model with Claude output
    const result = await query(
      `SELECT * FROM financial_models 
       WHERE deal_id = $1 AND user_id = $2 AND claude_output IS NOT NULL
       ORDER BY computed_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [dealId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No Claude-computed model found for this deal'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    logger.error('Error fetching Claude output:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Claude output'
    });
  }
});

/**
 * POST /api/v1/financial-models/:dealId/validate
 * NEW: Validate existing financial model output
 */
router.post('/:dealId/validate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { dealId } = req.params;
    const { modelId } = req.body;

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

    // Get the model
    let modelQuery;
    if (modelId) {
      modelQuery = await query(
        'SELECT * FROM financial_models WHERE id = $1 AND user_id = $2',
        [modelId, userId]
      );
    } else {
      // Get latest model for this deal
      modelQuery = await query(
        'SELECT * FROM financial_models WHERE deal_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
        [dealId, userId]
      );
    }

    if (modelQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Financial model not found'
      });
    }

    const model = modelQuery.rows[0];

    // Import validator
    const { validateModelOutput } = await import('../../services/model-validator.service');

    // Validate the output
    const modelType = model.model_type || 'acquisition'; // Default to acquisition if not set
    const output = model.claude_output || model.results;

    const validation = validateModelOutput(modelType, output);

    // Update validation in database
    await query(
      'UPDATE financial_models SET validation = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(validation), model.id]
    );

    logger.info('Financial model validated:', {
      userId,
      dealId,
      modelId: model.id,
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length
    });

    res.json({
      success: true,
      data: {
        validation,
        modelId: model.id,
        modelType
      }
    });

  } catch (error: any) {
    logger.error('Error validating financial model:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate financial model'
    });
  }
});

export default router;
