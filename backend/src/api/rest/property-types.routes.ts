/**
 * Property Types API Routes
 * Fetch available property types for deal creation
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { pool } from '../../config/database';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/property-types
 * Get all available property types
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        id,
        type_key,
        display_name,
        category,
        description,
        icon,
        sort_order,
        enabled
      FROM property_types
      WHERE enabled = true
      ORDER BY sort_order, display_name
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching property types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property types'
    });
  }
});

/**
 * GET /api/v1/property-types/:typeKey
 * Get a specific property type by key
 */
router.get('/:typeKey', async (req: Request, res: Response) => {
  try {
    const { typeKey } = req.params;

    const query = `
      SELECT 
        id,
        type_key,
        display_name,
        category,
        description,
        icon,
        sort_order,
        enabled
      FROM property_types
      WHERE type_key = $1 AND enabled = true
    `;

    const result = await pool.query(query, [typeKey]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property type not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching property type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property type'
    });
  }
});

export default router;
