/**
 * User Preferences API Routes
 * Market coverage and property type preferences
 */

import { Router } from 'express';
import { pool } from '../../database';
import { AuthenticatedRequest, requireAuth } from '../../middleware/auth';

const router = Router();

async function syncMarketsToIntelligence(userId: string, preferredMarkets: string[]): Promise<void> {
  for (const marketName of preferredMarkets) {
    const available = await pool.query(
      'SELECT name, display_name, state FROM available_markets WHERE name = $1',
      [marketName]
    );
    const displayName = available.rows[0]?.display_name || marketName.charAt(0).toUpperCase() + marketName.slice(1);
    const stateCode = available.rows[0]?.state || '';

    await pool.query(
      `INSERT INTO market_coverage_status (market_id, display_name, state_code, total_parcels, covered_parcels, data_points_count, total_units, status, metadata)
       VALUES ($1, $2, $3, 0, 0, 0, 0, 'pending', '{}')
       ON CONFLICT (market_id) DO NOTHING`,
      [marketName, displayName, stateCode]
    );

    const priority = preferredMarkets.indexOf(marketName) + 1;
    await pool.query(
      `INSERT INTO user_market_preferences (user_id, market_id, display_name, is_active, priority, notification_settings)
       VALUES ($1, $2, $3, true, $4, '{}')
       ON CONFLICT (user_id, market_id) DO UPDATE SET is_active = true, display_name = $3, priority = $4, updated_at = NOW()`,
      [userId, marketName, displayName, priority]
    );
  }

  await pool.query(
    `UPDATE user_market_preferences SET is_active = false, updated_at = NOW()
     WHERE user_id = $1 AND market_id != ALL($2)`,
    [userId, preferredMarkets]
  );

  console.log(`[MI Sync] Synced ${preferredMarkets.length} markets for user ${userId}`);
}

/**
 * GET /api/user/preferences
 * Get current user's preferences
 */
router.get('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    
    const result = await pool.query(`
      SELECT 
        preferred_markets,
        property_types,
        primary_market,
        primary_use_case,
        onboarding_completed
      FROM users
      WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      preferences: result.rows[0]
    });
  } catch (error: any) {
    console.error('[User Preferences] Get failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
router.put('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const {
      preferred_markets,
      property_types,
      primary_market,
      primary_use_case,
      onboarding_completed
    } = req.body;
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 2;
    
    if (preferred_markets !== undefined) {
      updates.push(`preferred_markets = $${paramCount}`);
      values.push(preferred_markets);
      paramCount++;
    }
    
    if (property_types !== undefined) {
      updates.push(`property_types = $${paramCount}`);
      values.push(property_types);
      paramCount++;
    }
    
    if (primary_market !== undefined) {
      updates.push(`primary_market = $${paramCount}`);
      values.push(primary_market);
      paramCount++;
    }
    
    if (primary_use_case !== undefined) {
      updates.push(`primary_use_case = $${paramCount}`);
      values.push(primary_use_case);
      paramCount++;
    }
    
    if (onboarding_completed !== undefined) {
      updates.push(`onboarding_completed = $${paramCount}`);
      values.push(onboarding_completed);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No preferences provided' });
    }
    
    updates.push('preferences_set_at = CURRENT_TIMESTAMP');
    
    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING preferred_markets, property_types, primary_market, primary_use_case, onboarding_completed
    `;
    
    const result = await pool.query(query, values);

    if (preferred_markets && preferred_markets.length > 0) {
      try {
        await syncMarketsToIntelligence(userId, preferred_markets);
      } catch (syncError) {
        console.error('[User Preferences] MI sync failed (non-blocking):', syncError);
      }
    }
    
    res.json({
      success: true,
      preferences: result.rows[0],
      message: 'Preferences updated successfully'
    });
  } catch (error: any) {
    console.error('[User Preferences] Update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/available-markets
 * Get list of available markets
 */
router.get('/available-markets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        name,
        display_name,
        state,
        metro_area,
        coverage_status,
        property_count,
        data_freshness
      FROM available_markets
      WHERE enabled = true
      ORDER BY 
        CASE coverage_status
          WHEN 'active' THEN 1
          WHEN 'beta' THEN 2
          WHEN 'coming_soon' THEN 3
        END,
        display_name
    `);
    
    res.json({
      success: true,
      markets: result.rows
    });
  } catch (error: any) {
    console.error('[Markets] Get available markets failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/property-types
 * Get available property types
 */
router.get('/property-types', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        type_key,
        display_name,
        description,
        icon
      FROM property_types
      WHERE enabled = true
      ORDER BY display_name
    `);
    
    res.json({
      success: true,
      property_types: result.rows
    });
  } catch (error: any) {
    console.error('[Property Types] Get failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
