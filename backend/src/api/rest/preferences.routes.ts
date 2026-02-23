/**
 * User Preferences API Routes
 * Handle user acquisition criteria and preferences
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/preferences
 * Get user's acquisition preferences
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT * FROM user_acquisition_preferences 
       WHERE user_id = $1 AND is_active = true 
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No preferences set'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences'
    });
  }
});

/**
 * POST /api/v1/preferences
 * Create or update user preferences
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      property_types,
      min_units,
      max_units,
      min_year_built,
      max_year_built,
      markets,
      cities,
      states,
      zip_codes,
      min_price,
      max_price,
      min_sqft,
      max_sqft,
      min_cap_rate,
      max_cap_rate,
      min_occupancy,
      conditions,
      deal_types,
      custom_criteria,
      auto_create_on_match,
      notify_on_mismatch,
      confidence_threshold
    } = req.body;

    // Validation
    if (!property_types || !Array.isArray(property_types) || property_types.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'property_types is required and must be a non-empty array'
      });
    }

    if (!states || !Array.isArray(states) || states.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'states is required and must be a non-empty array'
      });
    }

    if (auto_create_on_match === undefined) {
      return res.status(400).json({
        success: false,
        error: 'auto_create_on_match is required (boolean)'
      });
    }

    // Upsert preferences (insert or update if exists)
    const result = await query(
      `INSERT INTO user_acquisition_preferences (
        user_id,
        property_types,
        min_units,
        max_units,
        min_year_built,
        max_year_built,
        markets,
        cities,
        states,
        zip_codes,
        min_price,
        max_price,
        min_sqft,
        max_sqft,
        min_cap_rate,
        max_cap_rate,
        min_occupancy,
        conditions,
        deal_types,
        custom_criteria,
        auto_create_on_match,
        notify_on_mismatch,
        confidence_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (user_id) 
      WHERE is_active = true
      DO UPDATE SET
        property_types = EXCLUDED.property_types,
        min_units = EXCLUDED.min_units,
        max_units = EXCLUDED.max_units,
        min_year_built = EXCLUDED.min_year_built,
        max_year_built = EXCLUDED.max_year_built,
        markets = EXCLUDED.markets,
        cities = EXCLUDED.cities,
        states = EXCLUDED.states,
        zip_codes = EXCLUDED.zip_codes,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        min_sqft = EXCLUDED.min_sqft,
        max_sqft = EXCLUDED.max_sqft,
        min_cap_rate = EXCLUDED.min_cap_rate,
        max_cap_rate = EXCLUDED.max_cap_rate,
        min_occupancy = EXCLUDED.min_occupancy,
        conditions = EXCLUDED.conditions,
        deal_types = EXCLUDED.deal_types,
        custom_criteria = EXCLUDED.custom_criteria,
        auto_create_on_match = EXCLUDED.auto_create_on_match,
        notify_on_mismatch = EXCLUDED.notify_on_mismatch,
        confidence_threshold = EXCLUDED.confidence_threshold,
        updated_at = now()
      RETURNING *`,
      [
        userId,
        property_types,
        min_units,
        max_units,
        min_year_built,
        max_year_built,
        markets || [],
        cities || [],
        states,
        zip_codes || [],
        min_price,
        max_price,
        min_sqft,
        max_sqft,
        min_cap_rate,
        max_cap_rate,
        min_occupancy,
        conditions || [],
        deal_types || [],
        custom_criteria || {},
        auto_create_on_match,
        notify_on_mismatch || false,
        confidence_threshold || 0.80
      ]
    );

    logger.info('User preferences saved', { userId, preferencesId: result.rows[0].id });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Preferences saved successfully'
    });

  } catch (error) {
    logger.error('Error saving preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save preferences'
    });
  }
});

/**
 * DELETE /api/v1/preferences
 * Clear user preferences
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    await query(
      `UPDATE user_acquisition_preferences 
       SET is_active = false, updated_at = now()
       WHERE user_id = $1`,
      [userId]
    );

    logger.info('User preferences cleared', { userId });

    res.json({
      success: true,
      message: 'Preferences cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear preferences'
    });
  }
});

/**
 * GET /api/v1/preferences/available-markets
 * Get list of available markets for onboarding
 */
router.get('/available-markets', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT name, display_name, state, metro_area, coverage_status, 
              property_count, data_freshness, region
       FROM available_markets 
       WHERE enabled = true
       ORDER BY 
         CASE region
           WHEN 'Southeast' THEN 1
           WHEN 'Texas' THEN 2
           WHEN 'West' THEN 3
           WHEN 'Midwest' THEN 4
           WHEN 'Northeast' THEN 5
           ELSE 6
         END,
         CASE coverage_status 
           WHEN 'active' THEN 1
           WHEN 'beta' THEN 2
           WHEN 'coming_soon' THEN 3
         END,
         display_name ASC`
    );

    res.json({
      success: true,
      markets: result.rows
    });
  } catch (error) {
    logger.error('Error fetching available markets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available markets'
    });
  }
});

/**
 * GET /api/v1/preferences/property-types
 * Get list of property types for onboarding
 */
router.get('/property-types', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT type_key, display_name, description, icon, category, sort_order
       FROM property_types 
       WHERE enabled = true
       ORDER BY sort_order ASC, display_name ASC`
    );

    res.json({
      success: true,
      property_types: result.rows
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
 * PUT /api/v1/preferences/user
 * Update user market and property type preferences (for onboarding)
 */
router.put('/user', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      preferred_markets,
      property_types,
      primary_market,
      primary_use_case,
      onboarding_completed
    } = req.body;

    // Build SET clauses dynamically
    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 1;

    if (preferred_markets !== undefined) {
      paramCount++;
      updates.push(`preferred_markets = $${paramCount}`);
      values.push(preferred_markets);
    }

    if (property_types !== undefined) {
      paramCount++;
      updates.push(`property_types = $${paramCount}`);
      values.push(property_types);
    }

    if (primary_market !== undefined) {
      paramCount++;
      updates.push(`primary_market = $${paramCount}`);
      values.push(primary_market);
    }

    if (primary_use_case !== undefined) {
      paramCount++;
      updates.push(`primary_use_case = $${paramCount}`);
      values.push(primary_use_case);
    }

    if (onboarding_completed !== undefined) {
      paramCount++;
      updates.push(`onboarding_completed = $${paramCount}`);
      values.push(onboarding_completed);
      
      if (onboarding_completed) {
        updates.push(`preferences_set_at = CURRENT_TIMESTAMP`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING id, preferred_markets, property_types, primary_market, 
                 primary_use_case, onboarding_completed, preferences_set_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    logger.info('User preferences updated', { 
      userId, 
      onboardingCompleted: onboarding_completed 
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    logger.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * GET /api/v1/preferences/user
 * Get user's market and property type preferences
 */
router.get('/user', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT preferred_markets, property_types, primary_market, 
              primary_use_case, onboarding_completed, preferences_set_at
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences'
    });
  }
});

export default router;
