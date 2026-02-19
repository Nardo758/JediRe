/**
 * Property Types API Routes
 * Fetch available property types for deal creation
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, type_key, display_name, category, description, icon, sort_order, enabled
       FROM property_types
       WHERE enabled = true
       ORDER BY sort_order, display_name`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching property types:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch property types' });
  }
});

router.get('/:typeKey', async (req: Request, res: Response) => {
  try {
    const { typeKey } = req.params;
    const result = await query(
      `SELECT id, type_key, display_name, category, description, icon, sort_order, enabled
       FROM property_types
       WHERE type_key = $1 AND enabled = true`,
      [typeKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Property type not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching property type:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch property type' });
  }
});

export default router;
