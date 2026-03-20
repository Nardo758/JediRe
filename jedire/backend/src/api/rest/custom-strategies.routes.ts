/**
 * Custom Strategies API Routes
 * Handle creation, management, and application of custom investment strategies
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/custom-strategies
 * Create a new custom strategy
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      name,
      description,
      holdPeriodMin,
      holdPeriodMax,
      exitType,
      customMetrics,
      defaultAssumptions,
      isTemplate
    } = req.body;

    // Validation
    if (!name || !exitType) {
      return res.status(400).json({
        success: false,
        error: 'name and exitType are required'
      });
    }

    if (!holdPeriodMin || holdPeriodMin < 1) {
      return res.status(400).json({
        success: false,
        error: 'holdPeriodMin must be at least 1 year'
      });
    }

    // Check for duplicate name
    const duplicateCheck = await query(
      'SELECT id FROM custom_strategies WHERE user_id = $1 AND name = $2',
      [userId, name]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A strategy with this name already exists'
      });
    }

    // Create strategy
    const result = await query(
      `INSERT INTO custom_strategies 
       (user_id, name, description, hold_period_min, hold_period_max, exit_type, 
        custom_metrics, default_assumptions, is_template)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        name,
        description || null,
        holdPeriodMin,
        holdPeriodMax || null,
        exitType,
        JSON.stringify(customMetrics || {}),
        JSON.stringify(defaultAssumptions || {}),
        isTemplate || false
      ]
    );

    logger.info('Custom strategy created:', {
      userId,
      strategyId: result.rows[0].id,
      name
    });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    logger.error('Error creating custom strategy:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A strategy with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create custom strategy'
    });
  }
});

/**
 * GET /api/v1/custom-strategies
 * List all custom strategies for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { includePublic } = req.query;

    let queryText = `
      SELECT 
        cs.*,
        COUNT(DISTINCT upts.property_type) AS assigned_property_types_count,
        COUNT(DISTINCT csu.deal_id) AS times_used,
        json_agg(DISTINCT upts.property_type) FILTER (WHERE upts.property_type IS NOT NULL) AS assigned_types
      FROM custom_strategies cs
      LEFT JOIN user_property_type_strategies upts ON upts.custom_strategy_id = cs.id
      LEFT JOIN custom_strategy_usage csu ON csu.custom_strategy_id = cs.id
      WHERE cs.user_id = $1
    `;

    if (includePublic === 'true') {
      queryText += ' OR cs.is_public = TRUE';
    }

    queryText += `
      GROUP BY cs.id
      ORDER BY cs.created_at DESC
    `;

    const result = await query(queryText, [userId]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching custom strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch custom strategies'
    });
  }
});

/**
 * GET /api/v1/custom-strategies/:id
 * Get a specific custom strategy by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT cs.*,
        json_agg(
          json_build_object(
            'property_type', upts.property_type,
            'is_default', upts.is_default,
            'overrides', upts.property_type_overrides
          )
        ) FILTER (WHERE upts.property_type IS NOT NULL) AS property_assignments
       FROM custom_strategies cs
       LEFT JOIN user_property_type_strategies upts ON upts.custom_strategy_id = cs.id
       WHERE cs.id = $1 AND (cs.user_id = $2 OR cs.is_public = TRUE)
       GROUP BY cs.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching custom strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch custom strategy'
    });
  }
});

/**
 * PUT /api/v1/custom-strategies/:id
 * Update a custom strategy
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const {
      name,
      description,
      holdPeriodMin,
      holdPeriodMax,
      exitType,
      customMetrics,
      defaultAssumptions,
      isTemplate
    } = req.body;

    // Verify ownership
    const ownershipCheck = await query(
      'SELECT id FROM custom_strategies WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied'
      });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (holdPeriodMin !== undefined) {
      updates.push(`hold_period_min = $${paramIndex++}`);
      values.push(holdPeriodMin);
    }
    if (holdPeriodMax !== undefined) {
      updates.push(`hold_period_max = $${paramIndex++}`);
      values.push(holdPeriodMax);
    }
    if (exitType !== undefined) {
      updates.push(`exit_type = $${paramIndex++}`);
      values.push(exitType);
    }
    if (customMetrics !== undefined) {
      updates.push(`custom_metrics = $${paramIndex++}`);
      values.push(JSON.stringify(customMetrics));
    }
    if (defaultAssumptions !== undefined) {
      updates.push(`default_assumptions = $${paramIndex++}`);
      values.push(JSON.stringify(defaultAssumptions));
    }
    if (isTemplate !== undefined) {
      updates.push(`is_template = $${paramIndex++}`);
      values.push(isTemplate);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE custom_strategies 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    logger.info('Custom strategy updated:', {
      userId,
      strategyId: id
    });

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    logger.error('Error updating custom strategy:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A strategy with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update custom strategy'
    });
  }
});

/**
 * DELETE /api/v1/custom-strategies/:id
 * Delete a custom strategy
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    // Verify ownership
    const ownershipCheck = await query(
      'SELECT id FROM custom_strategies WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied'
      });
    }

    // Delete strategy (cascade will handle related records)
    await query('DELETE FROM custom_strategies WHERE id = $1', [id]);

    logger.info('Custom strategy deleted:', {
      userId,
      strategyId: id
    });

    res.json({
      success: true,
      message: 'Strategy deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting custom strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete custom strategy'
    });
  }
});

/**
 * POST /api/v1/custom-strategies/:id/duplicate
 * Duplicate an existing strategy (built-in or custom)
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) {
      return res.status(400).json({
        success: false,
        error: 'newName is required'
      });
    }

    // Get source strategy
    const sourceStrategy = await query(
      'SELECT * FROM custom_strategies WHERE id = $1 AND (user_id = $2 OR is_public = TRUE)',
      [id, userId]
    );

    if (sourceStrategy.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Source strategy not found or access denied'
      });
    }

    const source = sourceStrategy.rows[0];

    // Create duplicate
    const result = await query(
      `INSERT INTO custom_strategies 
       (user_id, name, description, hold_period_min, hold_period_max, exit_type, 
        custom_metrics, default_assumptions, is_template, source_strategy_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        newName,
        source.description,
        source.hold_period_min,
        source.hold_period_max,
        source.exit_type,
        source.custom_metrics,
        source.default_assumptions,
        false, // Duplicates are not templates by default
        source.id
      ]
    );

    logger.info('Custom strategy duplicated:', {
      userId,
      sourceId: id,
      newId: result.rows[0].id,
      newName
    });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    logger.error('Error duplicating custom strategy:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A strategy with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to duplicate custom strategy'
    });
  }
});

/**
 * POST /api/v1/custom-strategies/:id/apply-to-type
 * Apply strategy to one or more property types
 */
router.post('/:id/apply-to-type', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { propertyTypes, setAsDefault, propertyTypeOverrides } = req.body;

    if (!propertyTypes || !Array.isArray(propertyTypes) || propertyTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'propertyTypes array is required'
      });
    }

    // Verify strategy ownership
    const strategyCheck = await query(
      'SELECT id FROM custom_strategies WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (strategyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied'
      });
    }

    // If setting as default, unset existing defaults for these property types
    if (setAsDefault) {
      for (const propertyType of propertyTypes) {
        await query(
          `UPDATE user_property_type_strategies 
           SET is_default = FALSE 
           WHERE user_id = $1 AND property_type = $2`,
          [userId, propertyType]
        );
      }
    }

    // Apply to each property type
    const results = [];
    for (const propertyType of propertyTypes) {
      const result = await query(
        `INSERT INTO user_property_type_strategies 
         (user_id, custom_strategy_id, property_type, is_default, property_type_overrides)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, custom_strategy_id, property_type) 
         DO UPDATE SET 
           is_default = EXCLUDED.is_default,
           property_type_overrides = EXCLUDED.property_type_overrides,
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          id,
          propertyType,
          setAsDefault || false,
          JSON.stringify(propertyTypeOverrides?.[propertyType] || {})
        ]
      );
      results.push(result.rows[0]);
    }

    logger.info('Strategy applied to property types:', {
      userId,
      strategyId: id,
      propertyTypes,
      setAsDefault
    });

    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    logger.error('Error applying strategy to property types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply strategy to property types'
    });
  }
});

/**
 * DELETE /api/v1/custom-strategies/:id/property-types/:propertyType
 * Remove strategy assignment from a property type
 */
router.delete('/:id/property-types/:propertyType', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id, propertyType } = req.params;

    const result = await query(
      `DELETE FROM user_property_type_strategies 
       WHERE user_id = $1 AND custom_strategy_id = $2 AND property_type = $3
       RETURNING *`,
      [userId, id, propertyType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy assignment not found'
      });
    }

    logger.info('Strategy removed from property type:', {
      userId,
      strategyId: id,
      propertyType
    });

    res.json({
      success: true,
      message: 'Strategy removed from property type'
    });

  } catch (error) {
    logger.error('Error removing strategy from property type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove strategy from property type'
    });
  }
});

/**
 * POST /api/v1/custom-strategies/:id/export
 * Export strategy as JSON
 */
router.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { format = 'json' } = req.body;

    // Get strategy with property assignments
    const result = await query(
      `SELECT cs.*,
        json_agg(
          json_build_object(
            'property_type', upts.property_type,
            'is_default', upts.is_default,
            'overrides', upts.property_type_overrides
          )
        ) FILTER (WHERE upts.property_type IS NOT NULL) AS property_assignments
       FROM custom_strategies cs
       LEFT JOIN user_property_type_strategies upts ON upts.custom_strategy_id = cs.id
       WHERE cs.id = $1 AND cs.user_id = $2
       GROUP BY cs.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied'
      });
    }

    const strategy = result.rows[0];

    // Log export
    await query(
      `INSERT INTO custom_strategy_exports (custom_strategy_id, user_id, export_format, export_data)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, format, JSON.stringify(strategy)]
    );

    logger.info('Strategy exported:', {
      userId,
      strategyId: id,
      format
    });

    res.json({
      success: true,
      data: {
        version: '1.0',
        exported_at: new Date().toISOString(),
        strategy
      }
    });

  } catch (error) {
    logger.error('Error exporting strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export strategy'
    });
  }
});

/**
 * GET /api/v1/custom-strategies/property-types/:propertyType/default
 * Get default strategy for a property type
 */
router.get('/property-types/:propertyType/default', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { propertyType } = req.params;

    const result = await query(
      `SELECT cs.*, upts.property_type_overrides
       FROM custom_strategies cs
       JOIN user_property_type_strategies upts ON upts.custom_strategy_id = cs.id
       WHERE upts.user_id = $1 
         AND upts.property_type = $2 
         AND upts.is_default = TRUE
       LIMIT 1`,
      [userId, propertyType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No default strategy found for this property type'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching default strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch default strategy'
    });
  }
});

export default router;
