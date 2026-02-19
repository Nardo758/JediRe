/**
 * Property Type Strategy Routes
 * 
 * API endpoints for property type strategy matrix
 */

import { Router, Request, Response } from 'express';
import pool from '../../config/database';
import type {
  PropertyTypeStrategy,
  PropertyTypeWithStrategies,
  StrategyComparison,
  PropertyStrategyAnalysis,
  StrategyMatrixSummary,
  StrategyQueryParams,
  CreatePropertyTypeStrategyDto,
  UpdatePropertyTypeStrategyDto,
} from '../../types/property-type-strategies.types';

const router = Router();

/**
 * GET /api/v1/property-types/:id/strategies
 * Get all strategies for a specific property type
 */
router.get('/:id/strategies', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { include_calculations } = req.query;

    // Get property type with strategies
    const propertyTypeResult = await pool.query(
      `SELECT 
        pt.id, pt.type_key, pt.display_name, pt.category, 
        pt.description, pt.icon, pt.sort_order
       FROM property_types pt
       WHERE pt.id = $1`,
      [id]
    );

    if (propertyTypeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property type not found' });
    }

    const propertyType = propertyTypeResult.rows[0];

    // Get strategies for this property type
    const strategiesResult = await pool.query(
      `SELECT 
        id, type_id, strategy_name, strength, notes,
        hold_period_min, hold_period_max, key_metrics,
        is_primary, sort_order, created_at, updated_at
       FROM property_type_strategies
       WHERE type_id = $1
       ORDER BY sort_order ASC`,
      [id]
    );

    const strategies = strategiesResult.rows.map((row) => ({
      ...row,
      key_metrics: Array.isArray(row.key_metrics) ? row.key_metrics : [],
      hold_period: row.hold_period_min && row.hold_period_max
        ? `${Math.floor(row.hold_period_min / 12)}-${Math.floor(row.hold_period_max / 12)} years`
        : 'N/A',
    }));

    const response: PropertyTypeWithStrategies = {
      ...propertyType,
      strategies,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching property type strategies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/strategies
 * Get all strategies with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      property_type,
      category,
      strategy,
      strength,
      primary_only,
    } = req.query as StrategyQueryParams;

    let query = `
      SELECT 
        pts.id, pts.type_id, pts.strategy_name, pts.strength, 
        pts.notes, pts.hold_period_min, pts.hold_period_max,
        pts.key_metrics, pts.is_primary, pts.sort_order,
        pts.created_at, pts.updated_at,
        pt.type_key, pt.display_name AS property_type_name, 
        pt.category, pt.description, pt.icon
      FROM property_type_strategies pts
      JOIN property_types pt ON pts.type_id = pt.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (property_type) {
      query += ` AND pt.type_key = $${paramIndex}`;
      queryParams.push(property_type);
      paramIndex++;
    }

    if (category) {
      query += ` AND pt.category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (strategy) {
      query += ` AND pts.strategy_name = $${paramIndex}`;
      queryParams.push(strategy);
      paramIndex++;
    }

    if (strength) {
      query += ` AND pts.strength = $${paramIndex}`;
      queryParams.push(strength);
      paramIndex++;
    }

    if (primary_only === 'true' || primary_only === true) {
      query += ` AND pts.is_primary = true`;
    }

    query += ` ORDER BY pt.category, pt.sort_order, pts.sort_order`;

    const result = await pool.query(query, queryParams);

    const strategies = result.rows.map((row) => ({
      id: row.id,
      type_id: row.type_id,
      strategy_name: row.strategy_name,
      strength: row.strength,
      notes: row.notes,
      hold_period_min: row.hold_period_min,
      hold_period_max: row.hold_period_max,
      key_metrics: Array.isArray(row.key_metrics) ? row.key_metrics : [],
      is_primary: row.is_primary,
      sort_order: row.sort_order,
      property_type: {
        type_key: row.type_key,
        display_name: row.property_type_name,
        category: row.category,
        description: row.description,
        icon: row.icon,
      },
    }));

    res.json({
      count: strategies.length,
      strategies,
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/strategies/summary
 * Get strategy matrix summary statistics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Get overall stats
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM property_types) AS total_property_types,
        (SELECT COUNT(*) FROM property_type_strategies) AS total_strategies,
        (SELECT AVG(strategy_count)::NUMERIC(10,2) 
         FROM (SELECT COUNT(*) AS strategy_count 
               FROM property_type_strategies 
               GROUP BY type_id) AS counts) AS avg_strategies_per_type
    `);

    // Get breakdown by category
    const categoryResult = await pool.query(`
      SELECT 
        pt.category,
        COUNT(DISTINCT pt.id) AS type_count,
        COUNT(pts.id) AS strategy_count
      FROM property_types pt
      LEFT JOIN property_type_strategies pts ON pt.id = pts.type_id
      GROUP BY pt.category
      ORDER BY pt.category
    `);

    // Get breakdown by strategy
    const strategyResult = await pool.query(`
      SELECT 
        pts.strategy_name,
        COUNT(DISTINCT pts.type_id) AS property_type_count,
        SUM(CASE WHEN pts.strength = 'Strong' THEN 1 ELSE 0 END) AS strong_count,
        SUM(CASE WHEN pts.strength = 'Moderate' THEN 1 ELSE 0 END) AS moderate_count,
        SUM(CASE WHEN pts.strength = 'Weak' THEN 1 ELSE 0 END) AS weak_count
      FROM property_type_strategies pts
      GROUP BY pts.strategy_name
      ORDER BY pts.strategy_name
    `);

    const summary: StrategyMatrixSummary = {
      total_property_types: parseInt(statsResult.rows[0].total_property_types),
      total_strategies: parseInt(statsResult.rows[0].total_strategies),
      avg_strategies_per_type: parseFloat(statsResult.rows[0].avg_strategies_per_type),
      by_category: categoryResult.rows.map((row) => ({
        category: row.category,
        type_count: parseInt(row.type_count),
        strategy_count: parseInt(row.strategy_count),
      })),
      by_strategy: strategyResult.rows.map((row) => ({
        strategy_name: row.strategy_name,
        property_type_count: parseInt(row.property_type_count),
        strong_count: parseInt(row.strong_count),
        moderate_count: parseInt(row.moderate_count),
        weak_count: parseInt(row.weak_count),
      })),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching strategy summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/strategies/compare/:propertyType
 * Get strategy comparison for a property type
 */
router.get('/compare/:propertyType', async (req: Request, res: Response) => {
  try {
    const { propertyType } = req.params;

    // Get property type
    const propertyTypeResult = await pool.query(
      `SELECT id, type_key, display_name, category 
       FROM property_types 
       WHERE type_key = $1`,
      [propertyType]
    );

    if (propertyTypeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property type not found' });
    }

    const pt = propertyTypeResult.rows[0];

    // Get all strategies for this type
    const strategiesResult = await pool.query(
      `SELECT 
        strategy_name, strength, notes, 
        hold_period_min, hold_period_max, 
        key_metrics, is_primary, sort_order
       FROM property_type_strategies
       WHERE type_id = $1
       ORDER BY sort_order ASC`,
      [pt.id]
    );

    const strategies: StrategyComparison[] = strategiesResult.rows.map((row) => ({
      strategy_name: row.strategy_name,
      strength: row.strength,
      notes: row.notes,
      hold_period: row.hold_period_min && row.hold_period_max
        ? `${Math.floor(row.hold_period_min / 12)}-${Math.floor(row.hold_period_max / 12)} years`
        : null,
      key_metrics: Array.isArray(row.key_metrics) ? row.key_metrics : [],
      is_primary: row.is_primary,
    }));

    const primaryStrategy = strategies.find((s) => s.is_primary) || null;

    const analysis: PropertyStrategyAnalysis = {
      property_id: propertyType, // In real implementation, this would be actual property ID
      property_type: pt.type_key,
      property_type_name: pt.display_name,
      strategies,
      primary_strategy: primaryStrategy,
      best_roi_strategy: null, // Would be calculated with actual property financials
      arbitrage_opportunity: {
        exists: false, // Would be calculated with actual property financials
      },
    };

    res.json(analysis);
  } catch (error) {
    console.error('Error comparing strategies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/strategies
 * Create a new property type strategy
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreatePropertyTypeStrategyDto = req.body;

    // Validate required fields
    if (!dto.type_id || !dto.strategy_name || !dto.strength) {
      return res.status(400).json({ 
        error: 'Missing required fields: type_id, strategy_name, strength' 
      });
    }

    // Check if property type exists
    const propertyTypeCheck = await pool.query(
      'SELECT id FROM property_types WHERE id = $1',
      [dto.type_id]
    );

    if (propertyTypeCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Property type not found' });
    }

    // Insert strategy
    const result = await pool.query(
      `INSERT INTO property_type_strategies (
        type_id, strategy_name, strength, notes,
        hold_period_min, hold_period_max, key_metrics,
        is_primary, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dto.type_id,
        dto.strategy_name,
        dto.strength,
        dto.notes || null,
        dto.hold_period_min || null,
        dto.hold_period_max || null,
        JSON.stringify(dto.key_metrics || []),
        dto.is_primary || false,
        dto.sort_order || 0,
      ]
    );

    const strategy = result.rows[0];
    res.status(201).json(strategy);
  } catch (error: any) {
    console.error('Error creating strategy:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ 
        error: 'Strategy already exists for this property type' 
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/strategies/:id
 * Update an existing strategy
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dto: UpdatePropertyTypeStrategyDto = req.body;

    // Check if strategy exists
    const existingCheck = await pool.query(
      'SELECT id FROM property_type_strategies WHERE id = $1',
      [id]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.strength !== undefined) {
      updates.push(`strength = $${paramIndex}`);
      values.push(dto.strength);
      paramIndex++;
    }

    if (dto.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(dto.notes);
      paramIndex++;
    }

    if (dto.hold_period_min !== undefined) {
      updates.push(`hold_period_min = $${paramIndex}`);
      values.push(dto.hold_period_min);
      paramIndex++;
    }

    if (dto.hold_period_max !== undefined) {
      updates.push(`hold_period_max = $${paramIndex}`);
      values.push(dto.hold_period_max);
      paramIndex++;
    }

    if (dto.key_metrics !== undefined) {
      updates.push(`key_metrics = $${paramIndex}`);
      values.push(JSON.stringify(dto.key_metrics));
      paramIndex++;
    }

    if (dto.is_primary !== undefined) {
      updates.push(`is_primary = $${paramIndex}`);
      values.push(dto.is_primary);
      paramIndex++;
    }

    if (dto.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex}`);
      values.push(dto.sort_order);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE property_type_strategies
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const strategy = result.rows[0];

    res.json(strategy);
  } catch (error) {
    console.error('Error updating strategy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/v1/strategies/:id
 * Delete a strategy
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM property_type_strategies WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting strategy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
