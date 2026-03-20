/**
 * Strategy Definitions Routes
 * CRUD operations and execution for strategy definitions
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query, getPool } from '../../database/connection';
import { StrategyExecutionService, StrategyCondition } from '../../services/strategyExecution.service';
import { logger } from '../../utils/logger';

const router = Router();
const pool = getPool();
const strategyExecutionService = new StrategyExecutionService(pool);

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/v1/strategies
 * Create a new strategy definition
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      name,
      description,
      scope,
      conditions,
      combinator,
      sortBy,
      sortDirection,
      maxResults,
      assetClasses,
      dealTypes,
      tags,
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'name is required',
      });
    }

    if (!scope) {
      return res.status(400).json({
        success: false,
        error: 'scope is required',
      });
    }

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'conditions array is required and must not be empty',
      });
    }

    if (!combinator || !['AND', 'OR'].includes(combinator)) {
      return res.status(400).json({
        success: false,
        error: 'combinator must be AND or OR',
      });
    }

    // Insert strategy
    const result = await query(
      `INSERT INTO strategy_definitions
       (user_id, name, description, type, scope, conditions, combinator,
        sort_by, sort_direction, max_results, asset_classes, deal_types, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId,
        name,
        description || null,
        'custom',
        scope,
        JSON.stringify(conditions),
        combinator,
        sortBy || null,
        sortDirection || 'desc',
        maxResults || 50,
        assetClasses || [],
        dealTypes || [],
        tags || [],
      ]
    );

    logger.info('Strategy definition created:', {
      userId,
      strategyId: result.rows[0].id,
      name,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error creating strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create strategy',
    });
  }
});

/**
 * GET /api/v1/strategies
 * List all strategies (user's custom + presets)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT id, name, description, type, scope, combinator, sort_by,
              run_count, last_run_at, created_at
       FROM strategy_definitions
       WHERE user_id = $1 OR type = 'preset'
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Error fetching strategies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategies',
    });
  }
});

/**
 * GET /api/v1/strategies/:id
 * Get a specific strategy definition
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM strategy_definitions
       WHERE id = $1 AND (user_id = $2 OR type = 'preset')`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied',
      });
    }

    // Parse JSONB fields
    const strategy = result.rows[0];
    strategy.conditions = typeof strategy.conditions === 'string'
      ? JSON.parse(strategy.conditions)
      : strategy.conditions;

    res.json({
      success: true,
      data: strategy,
    });
  } catch (error: any) {
    logger.error('Error fetching strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch strategy',
    });
  }
});

/**
 * PUT /api/v1/strategies/:id
 * Update a strategy definition
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const {
      name,
      description,
      scope,
      conditions,
      combinator,
      sortBy,
      sortDirection,
      maxResults,
      assetClasses,
      dealTypes,
      tags,
    } = req.body;

    // Verify ownership
    const ownershipCheck = await query(
      `SELECT id FROM strategy_definitions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied',
      });
    }

    // Build update query
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
    if (scope !== undefined) {
      updates.push(`scope = $${paramIndex++}`);
      values.push(scope);
    }
    if (conditions !== undefined) {
      updates.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(conditions));
    }
    if (combinator !== undefined) {
      updates.push(`combinator = $${paramIndex++}`);
      values.push(combinator);
    }
    if (sortBy !== undefined) {
      updates.push(`sort_by = $${paramIndex++}`);
      values.push(sortBy);
    }
    if (sortDirection !== undefined) {
      updates.push(`sort_direction = $${paramIndex++}`);
      values.push(sortDirection);
    }
    if (maxResults !== undefined) {
      updates.push(`max_results = $${paramIndex++}`);
      values.push(maxResults);
    }
    if (assetClasses !== undefined) {
      updates.push(`asset_classes = $${paramIndex++}`);
      values.push(assetClasses);
    }
    if (dealTypes !== undefined) {
      updates.push(`deal_types = $${paramIndex++}`);
      values.push(dealTypes);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE strategy_definitions
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    logger.info('Strategy definition updated:', {
      userId,
      strategyId: id,
    });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error updating strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update strategy',
    });
  }
});

/**
 * DELETE /api/v1/strategies/:id
 * Delete a strategy definition
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    // Verify ownership
    const ownershipCheck = await query(
      `SELECT id FROM strategy_definitions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Strategy not found or access denied',
      });
    }

    // Delete strategy and cascading records
    await query(`DELETE FROM strategy_runs WHERE strategy_id = $1`, [id]);
    await query(`DELETE FROM strategy_definitions WHERE id = $1`, [id]);

    logger.info('Strategy definition deleted:', {
      userId,
      strategyId: id,
    });

    res.json({
      success: true,
      message: 'Strategy deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete strategy',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY EXECUTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/strategies/:id/run
 * Execute a strategy by ID
 */
router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const results = await strategyExecutionService.executeStrategy(id);

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: any) {
    logger.error('Error running strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run strategy',
    });
  }
});

/**
 * POST /api/v1/strategies/preview
 * Preview a strategy without saving
 * Body: {
 *   conditions: StrategyCondition[],
 *   scope: 'submarket' | 'market' | 'msa' | 'property' | 'zip',
 *   combinator: 'AND' | 'OR',
 *   sortBy?: string,
 *   maxResults?: number
 * }
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { conditions, scope, combinator, sortBy, maxResults } = req.body;

    // Validate required fields
    if (!conditions || !Array.isArray(conditions)) {
      return res.status(400).json({
        success: false,
        error: 'conditions array is required',
      });
    }

    if (!scope) {
      return res.status(400).json({
        success: false,
        error: 'scope is required',
      });
    }

    if (!combinator) {
      return res.status(400).json({
        success: false,
        error: 'combinator is required',
      });
    }

    const results = await strategyExecutionService.previewStrategy(
      conditions as StrategyCondition[],
      scope,
      combinator,
      sortBy,
      maxResults
    );

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: any) {
    logger.error('Error previewing strategy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to preview strategy',
    });
  }
});

/**
 * GET /api/v1/strategies/:id/results
 * Get cached results from the most recent strategy run
 */
router.get('/:id/results', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM strategy_runs WHERE strategy_id = $1 ORDER BY run_at DESC LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No results found for this strategy',
      });
    }

    const runData = result.rows[0];
    const results = JSON.parse(runData.results);

    res.json({
      success: true,
      data: results,
      count: results.length,
      runAt: runData.run_at,
    });
  } catch (error: any) {
    logger.error('Error fetching strategy results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch results',
    });
  }
});

/**
 * POST /api/v1/strategies/score-deal/:dealId
 * Score a deal against all strategies
 */
router.post('/score-deal/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required',
      });
    }

    const results = await strategyExecutionService.scoreDeal(dealId, userId);

    // Filter to only strategies that matched
    const matched = results.filter((r) => r.matched);

    res.json({
      success: true,
      data: results,
      matchedCount: matched.length,
      totalCount: results.length,
    });
  } catch (error: any) {
    logger.error('Error scoring deal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to score deal',
    });
  }
});

export default router;
