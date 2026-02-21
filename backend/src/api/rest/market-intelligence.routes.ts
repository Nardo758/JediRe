import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import type {
  MarketOverviewResponse,
  MarketSummaryResponse,
  MarketComparisonResponse,
  MarketCardData,
  MarketAlert
} from '../../types/marketIntelligence.types';

const router = Router();
const pool = getPool();

const createPreferenceSchema = z.object({
  market_id: z.string().min(1).max(100),
  display_name: z.string().min(1).max(255),
  priority: z.number().int().min(1).optional(),
  notification_settings: z.object({
    alerts_enabled: z.boolean().optional(),
    new_data_points: z.boolean().optional(),
    opportunities: z.boolean().optional(),
    market_updates: z.boolean().optional()
  }).optional()
});

const updatePreferenceSchema = z.object({
  is_active: z.boolean().optional(),
  priority: z.number().int().min(1).optional(),
  notification_settings: z.object({
    alerts_enabled: z.boolean().optional(),
    new_data_points: z.boolean().optional(),
    opportunities: z.boolean().optional(),
    market_updates: z.boolean().optional()
  }).optional()
});

router.get('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const result = await pool.query(
      `SELECT * FROM user_market_preferences WHERE user_id = $1 ORDER BY priority ASC, display_name ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market preferences:', error);
    res.status(500).json({ error: 'Failed to fetch market preferences' });
  }
});

router.post('/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const validation = createPreferenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error });
    }

    const { market_id, display_name, priority, notification_settings } = validation.data;

    const marketCheck = await pool.query(
      'SELECT id FROM market_coverage_status WHERE market_id = $1',
      [market_id]
    );

    if (marketCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found in system' });
    }

    const result = await pool.query(
      `INSERT INTO user_market_preferences 
       (user_id, market_id, display_name, priority, notification_settings)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, market_id) DO UPDATE
       SET is_active = true, display_name = $3, priority = $4, notification_settings = $5, updated_at = NOW()
       RETURNING *`,
      [userId, market_id, display_name, priority || 1, JSON.stringify(notification_settings || {})]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating market preference:', error);
    res.status(500).json({ error: 'Failed to create market preference' });
  }
});

router.put('/preferences/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const preferenceId = parseInt(req.params.id);
    const validation = updatePreferenceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (validation.data.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(validation.data.is_active);
    }

    if (validation.data.priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(validation.data.priority);
    }

    if (validation.data.notification_settings !== undefined) {
      updates.push(`notification_settings = $${paramCount++}`);
      values.push(JSON.stringify(validation.data.notification_settings));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(preferenceId, userId);

    const result = await pool.query(
      `UPDATE user_market_preferences 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market preference not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating market preference:', error);
    res.status(500).json({ error: 'Failed to update market preference' });
  }
});

router.delete('/preferences/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const preferenceId = parseInt(req.params.id);

    const result = await pool.query(
      'DELETE FROM user_market_preferences WHERE id = $1 AND user_id = $2 RETURNING *',
      [preferenceId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market preference not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting market preference:', error);
    res.status(500).json({ error: 'Failed to delete market preference' });
  }
});

router.get('/overview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;

    const marketsResult = await pool.query(
      `SELECT 
        ump.market_id,
        ump.display_name,
        mcs.state_code,
        mcs.coverage_percentage,
        mcs.data_points_count,
        mcs.total_units,
        mcs.status,
        mcs.last_import_date,
        mv.rent_growth_yoy,
        mv.occupancy_rate,
        mv.jedi_score,
        mv.jedi_rating
       FROM user_market_preferences ump
       JOIN market_coverage_status mcs ON ump.market_id = mcs.market_id
       LEFT JOIN LATERAL (
         SELECT * FROM market_vitals 
         WHERE market_id = ump.market_id 
         ORDER BY date DESC 
         LIMIT 1
       ) mv ON true
       WHERE ump.user_id = $1 AND ump.is_active = true
       ORDER BY ump.priority ASC, ump.display_name ASC`,
      [userId]
    );

    const totalDeals = await pool.query(
      `SELECT COUNT(*) as deal_count FROM deals WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    const totalDealCount = parseInt(totalDeals.rows[0]?.deal_count) || 0;

    const markets: MarketCardData[] = marketsResult.rows.map(row => ({
      market_id: row.market_id,
      display_name: row.display_name,
      state_code: row.state_code,
      coverage_percentage: parseFloat(row.coverage_percentage) || 0,
      data_points_count: row.data_points_count || 0,
      total_units: row.total_units || 0,
      active_deals_count: 0,
      status: row.status,
      vitals: row.jedi_score ? {
        rent_growth_yoy: parseFloat(row.rent_growth_yoy),
        occupancy_rate: parseFloat(row.occupancy_rate),
        jedi_score: row.jedi_score,
        jedi_rating: row.jedi_rating
      } : null,
      last_import_date: row.last_import_date
    }));

    const alerts = await generateMarketAlerts(userId, markets);

    const response: MarketOverviewResponse = {
      active_markets_count: markets.length,
      total_data_points: markets.reduce((sum, m) => sum + m.data_points_count, 0),
      active_deals_count: totalDealCount,
      markets,
      alerts
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching market overview:', error);
    res.status(500).json({ error: 'Failed to fetch market overview' });
  }
});

router.get('/coverage', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM market_coverage_status ORDER BY display_name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market coverage:', error);
    res.status(500).json({ error: 'Failed to fetch market coverage' });
  }
});

router.get('/compare', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const marketIds = req.query.markets as string;
    if (!marketIds) {
      return res.status(400).json({ error: 'markets query parameter required' });
    }

    const marketIdArray = marketIds.split(',').map(id => id.trim());

    const result = await pool.query(
      `SELECT 
        mcs.*,
        mv.date as vitals_date,
        mv.population, mv.population_growth_yoy, mv.job_growth_yoy,
        mv.median_income, mv.median_home_price, mv.rent_growth_yoy,
        mv.avg_rent_per_unit, mv.occupancy_rate, mv.vacancy_rate,
        mv.absorption_rate, mv.new_supply_units, mv.jedi_score,
        mv.jedi_rating, mv.source as vitals_source,
        0 as active_deals_count
       FROM market_coverage_status mcs
       LEFT JOIN LATERAL (
         SELECT * FROM market_vitals WHERE market_id = mcs.market_id ORDER BY date DESC LIMIT 1
       ) mv ON true
       WHERE mcs.market_id = ANY($1)`,
      [marketIdArray]
    );

    const response: MarketComparisonResponse = {
      markets: result.rows.map(row => ({
        market_id: row.market_id,
        display_name: row.display_name,
        vitals: row.vitals_date ? {
          id: 0,
          market_id: row.market_id,
          date: row.vitals_date,
          population: row.population,
          population_growth_yoy: row.population_growth_yoy ? parseFloat(row.population_growth_yoy) : null,
          job_growth_yoy: row.job_growth_yoy ? parseFloat(row.job_growth_yoy) : null,
          median_income: row.median_income,
          median_home_price: row.median_home_price,
          rent_growth_yoy: row.rent_growth_yoy ? parseFloat(row.rent_growth_yoy) : null,
          avg_rent_per_unit: row.avg_rent_per_unit,
          occupancy_rate: row.occupancy_rate ? parseFloat(row.occupancy_rate) : null,
          vacancy_rate: row.vacancy_rate ? parseFloat(row.vacancy_rate) : null,
          absorption_rate: row.absorption_rate ? parseFloat(row.absorption_rate) : null,
          new_supply_units: row.new_supply_units,
          jedi_score: row.jedi_score,
          jedi_rating: row.jedi_rating,
          source: row.vitals_source,
          metadata: {},
          created_at: new Date()
        } : null,
        coverage: {
          id: row.id,
          market_id: row.market_id,
          display_name: row.display_name,
          state_code: row.state_code,
          total_parcels: row.total_parcels,
          covered_parcels: row.covered_parcels,
          coverage_percentage: row.coverage_percentage ? parseFloat(row.coverage_percentage) : null,
          data_points_count: row.data_points_count,
          total_units: row.total_units,
          last_import_date: row.last_import_date,
          next_scheduled_import: row.next_scheduled_import,
          status: row.status,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        active_deals_count: parseInt(row.active_deals_count) || 0
      })),
      comparison_date: new Date()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching market comparison:', error);
    res.status(500).json({ error: 'Failed to fetch market comparison' });
  }
});

router.get('/:marketId/summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { marketId } = req.params;

    const marketResult = await pool.query(
      'SELECT * FROM market_coverage_status WHERE market_id = $1',
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const vitalsResult = await pool.query(
      'SELECT * FROM market_vitals WHERE market_id = $1 ORDER BY date DESC LIMIT 1',
      [marketId]
    );

    const preferenceResult = await pool.query(
      'SELECT * FROM user_market_preferences WHERE user_id = $1 AND market_id = $2',
      [userId, marketId]
    );

    const dealCountResult = await pool.query(
      "SELECT COUNT(*) as count FROM deals WHERE user_id = $1 AND status = 'active'",
      [userId]
    );

    const response: MarketSummaryResponse = {
      market: marketResult.rows[0],
      vitals: vitalsResult.rows[0] || null,
      active_deals_count: parseInt(dealCountResult.rows[0].count) || 0,
      is_tracked: preferenceResult.rows.length > 0,
      user_preference: preferenceResult.rows[0] || null
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching market summary:', error);
    res.status(500).json({ error: 'Failed to fetch market summary' });
  }
});

router.get('/:marketId/vitals', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { marketId } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    const result = await pool.query(
      'SELECT * FROM market_vitals WHERE market_id = $1 ORDER BY date DESC LIMIT $2',
      [marketId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market vitals:', error);
    res.status(500).json({ error: 'Failed to fetch market vitals' });
  }
});

async function generateMarketAlerts(userId: string, markets: any[]): Promise<MarketAlert[]> {
  const alerts: MarketAlert[] = [];

  for (const market of markets) {
    if (market.data_points_count > 0 && market.status === 'active') {
      try {
        const ownerInfoCount = await pool.query(
          `SELECT COUNT(*) as count 
           FROM property_records 
           WHERE market_id = $1 AND owner_name IS NOT NULL AND owner_name != ''`,
          [market.market_id]
        );

        const count = parseInt(ownerInfoCount.rows[0]?.count) || 0;
        if (count > 0) {
          alerts.push({
            id: `${market.market_id}-owner-info`,
            market_id: market.market_id,
            market_name: market.display_name,
            type: 'new_data',
            severity: 'info',
            title: 'Owner Contact Info Available',
            message: `${count} properties with owner contact information ready for outreach`,
            action_url: `/markets/${market.market_id}/data`,
            created_at: new Date()
          });
        }
      } catch (e) {}
    }

    if (market.vitals?.jedi_score && market.vitals.jedi_score >= 90) {
      alerts.push({
        id: `${market.market_id}-high-score`,
        market_id: market.market_id,
        market_name: market.display_name,
        type: 'opportunity',
        severity: 'success',
        title: 'Strong Buy Signal',
        message: `JEDI Score: ${market.vitals.jedi_score} (${market.vitals.jedi_rating}) - Excellent investment opportunity`,
        action_url: `/markets/${market.market_id}`,
        created_at: new Date()
      });
    }

    if (market.status === 'pending' && market.data_points_count === 0) {
      alerts.push({
        id: `${market.market_id}-pending`,
        market_id: market.market_id,
        market_name: market.display_name,
        type: 'market_update',
        severity: 'warning',
        title: 'Market Data Import Pending',
        message: 'Research data not yet available for this market',
        action_url: `/settings/markets`,
        created_at: new Date()
      });
    }
  }

  return alerts;
}

export default router;
