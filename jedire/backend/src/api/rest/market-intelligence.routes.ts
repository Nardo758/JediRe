// Market Intelligence API Routes
// Created: 2026-02-20
// Purpose: Unified market system endpoints

import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import type {
  CreateMarketPreferenceRequest,
  UpdateMarketPreferenceRequest,
  MarketOverviewResponse,
  MarketSummaryResponse,
  MarketComparisonResponse,
  MarketCardData,
  MarketAlert
} from '../../types/marketIntelligence.types';

const router = Router();

// Validation schemas
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

export function createMarketIntelligenceRoutes(pool: Pool) {
  
  // GET /api/v1/markets/preferences - Get user's tracked markets
  router.get('/preferences', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await pool.query(
        `SELECT * FROM user_market_preferences 
         WHERE user_id = $1 
         ORDER BY priority ASC, display_name ASC`,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching market preferences:', error);
      res.status(500).json({ error: 'Failed to fetch market preferences' });
    }
  });

  // POST /api/v1/markets/preferences - Add market to tracking
  router.post('/preferences', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validation = createPreferenceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid request', details: validation.error });
      }

      const { market_id, display_name, priority, notification_settings } = validation.data;

      // Check if market exists in coverage status
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

  // PUT /api/v1/markets/preferences/:id - Update market preference
  router.put('/preferences/:id', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

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

  // DELETE /api/v1/markets/preferences/:id - Remove market from tracking
  router.delete('/preferences/:id', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

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

  // GET /api/v1/markets/overview - Dashboard data for "My Markets"
  router.get('/overview', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user's tracked markets with coverage and vitals
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

      // Get deal counts per market
      const dealCounts = await pool.query(
        `SELECT 
          COALESCE(location, 'unknown') as market_id,
          COUNT(*) as deal_count
         FROM deals
         WHERE user_id = $1
         GROUP BY location`,
        [userId]
      );

      const dealCountMap = new Map(
        dealCounts.rows.map(row => [row.market_id.toLowerCase().replace(/\s+/g, '-'), parseInt(row.deal_count)])
      );

      const markets: MarketCardData[] = marketsResult.rows.map(row => ({
        market_id: row.market_id,
        display_name: row.display_name,
        state_code: row.state_code,
        coverage_percentage: parseFloat(row.coverage_percentage) || 0,
        data_points_count: row.data_points_count || 0,
        total_units: row.total_units || 0,
        active_deals_count: dealCountMap.get(row.market_id) || 0,
        status: row.status,
        vitals: row.jedi_score ? {
          rent_growth_yoy: parseFloat(row.rent_growth_yoy),
          occupancy_rate: parseFloat(row.occupancy_rate),
          jedi_score: row.jedi_score,
          jedi_rating: row.jedi_rating
        } : null,
        last_import_date: row.last_import_date
      }));

      // Generate alerts
      const alerts = await generateMarketAlerts(pool, userId, markets);

      const response: MarketOverviewResponse = {
        active_markets_count: markets.length,
        total_data_points: markets.reduce((sum, m) => sum + m.data_points_count, 0),
        active_deals_count: markets.reduce((sum, m) => sum + m.active_deals_count, 0),
        markets,
        alerts
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching market overview:', error);
      res.status(500).json({ error: 'Failed to fetch market overview' });
    }
  });

  // GET /api/v1/markets/:marketId/summary - Single market card data
  router.get('/:marketId/summary', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { marketId } = req.params;

      // Get market coverage
      const marketResult = await pool.query(
        'SELECT * FROM market_coverage_status WHERE market_id = $1',
        [marketId]
      );

      if (marketResult.rows.length === 0) {
        return res.status(404).json({ error: 'Market not found' });
      }

      // Get latest vitals
      const vitalsResult = await pool.query(
        'SELECT * FROM market_vitals WHERE market_id = $1 ORDER BY date DESC LIMIT 1',
        [marketId]
      );

      // Get user preference
      const preferenceResult = await pool.query(
        'SELECT * FROM user_market_preferences WHERE user_id = $1 AND market_id = $2',
        [userId, marketId]
      );

      // Get deal count
      const dealCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM deals WHERE user_id = $1 AND LOWER(REPLACE(location, \' \', \'-\')) = $2',
        [userId, marketId]
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

  // GET /api/v1/markets/:marketId/alerts - Market-specific alerts
  router.get('/:marketId/alerts', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { marketId } = req.params;

      // Check if user tracks this market
      const preferenceCheck = await pool.query(
        'SELECT id FROM user_market_preferences WHERE user_id = $1 AND market_id = $2 AND is_active = true',
        [userId, marketId]
      );

      if (preferenceCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Market not tracked by user' });
      }

      // Get market data for alert generation
      const marketResult = await pool.query(
        `SELECT mcs.*, mv.* 
         FROM market_coverage_status mcs
         LEFT JOIN LATERAL (
           SELECT * FROM market_vitals WHERE market_id = mcs.market_id ORDER BY date DESC LIMIT 1
         ) mv ON true
         WHERE mcs.market_id = $1`,
        [marketId]
      );

      const alerts = await generateMarketAlerts(pool, userId, [marketResult.rows[0]]);

      res.json(alerts);
    } catch (error) {
      console.error('Error fetching market alerts:', error);
      res.status(500).json({ error: 'Failed to fetch market alerts' });
    }
  });

  // GET /api/v1/markets/compare - Multi-market comparison
  router.get('/compare', async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const marketIds = req.query.markets as string;
      if (!marketIds) {
        return res.status(400).json({ error: 'markets query parameter required' });
      }

      const marketIdArray = marketIds.split(',').map(id => id.trim());

      const result = await pool.query(
        `SELECT 
          mcs.*,
          mv.*,
          (SELECT COUNT(*) FROM deals WHERE user_id = $1 AND LOWER(REPLACE(location, ' ', '-')) = mcs.market_id) as active_deals_count
         FROM market_coverage_status mcs
         LEFT JOIN LATERAL (
           SELECT * FROM market_vitals WHERE market_id = mcs.market_id ORDER BY date DESC LIMIT 1
         ) mv ON true
         WHERE mcs.market_id = ANY($2)`,
        [userId, marketIdArray]
      );

      const response: MarketComparisonResponse = {
        markets: result.rows.map(row => ({
          market_id: row.market_id,
          display_name: row.display_name,
          vitals: row.date ? {
            id: row.id,
            market_id: row.market_id,
            date: row.date,
            population: row.population,
            population_growth_yoy: row.population_growth_yoy,
            job_growth_yoy: row.job_growth_yoy,
            median_income: row.median_income,
            median_home_price: row.median_home_price,
            rent_growth_yoy: row.rent_growth_yoy,
            avg_rent_per_unit: row.avg_rent_per_unit,
            occupancy_rate: row.occupancy_rate,
            vacancy_rate: row.vacancy_rate,
            absorption_rate: row.absorption_rate,
            new_supply_units: row.new_supply_units,
            jedi_score: row.jedi_score,
            jedi_rating: row.jedi_rating,
            source: row.source,
            metadata: row.metadata,
            created_at: row.created_at
          } : null,
          coverage: {
            id: row.id,
            market_id: row.market_id,
            display_name: row.display_name,
            state_code: row.state_code,
            total_parcels: row.total_parcels,
            covered_parcels: row.covered_parcels,
            coverage_percentage: row.coverage_percentage,
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

  // GET /api/v1/markets/properties - List properties with filtering/pagination
  router.get('/properties', async (req, res) => {
    try {
      const marketId = (req.query.marketId as string) || 'atlanta';
      const submarket = req.query.submarket as string;
      const minYear = req.query.minYear ? parseInt(req.query.minYear as string) : undefined;
      const maxYear = req.query.maxYear ? parseInt(req.query.maxYear as string) : undefined;
      const minUnits = req.query.minUnits ? parseInt(req.query.minUnits as string) : undefined;
      const maxUnits = req.query.maxUnits ? parseInt(req.query.maxUnits as string) : undefined;
      const minPricePerUnit = req.query.minPricePerUnit ? parseFloat(req.query.minPricePerUnit as string) : undefined;
      const maxPricePerUnit = req.query.maxPricePerUnit ? parseFloat(req.query.maxPricePerUnit as string) : undefined;
      const ownerType = req.query.ownerType as string;
      const search = req.query.search as string;
      const sortBy = (req.query.sortBy as string) || 'units';
      const sortDir = (req.query.sortDir as string) === 'asc' ? 'ASC' : 'DESC';
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const allowedSortColumns: Record<string, string> = {
        units: 'pr.units',
        year_built: 'pr.year_built',
        assessed_value: 'pr.assessed_value',
        appraised_value: 'pr.appraised_value',
        address: 'pr.address',
        owner_name: 'pr.owner_name',
        building_sqft: 'pr.building_sqft',
      };
      const sortColumn = allowedSortColumns[sortBy] || 'pr.units';

      let whereClause = '';
      const params: any[] = [];
      let paramIndex = 1;

      if (marketId === 'atlanta') {
        whereClause = `WHERE pr.county = 'Fulton' AND pr.state = 'GA' AND pr.units > 0`;
      } else {
        whereClause = `WHERE pr.units > 0`;
      }

      if (search) {
        whereClause += ` AND (pr.address ILIKE $${paramIndex} OR pr.owner_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (minYear) {
        whereClause += ` AND pr.year_built IS NOT NULL AND pr.year_built ~ '^[0-9]+$' AND pr.year_built::integer >= $${paramIndex}`;
        params.push(minYear);
        paramIndex++;
      }

      if (maxYear) {
        whereClause += ` AND pr.year_built IS NOT NULL AND pr.year_built ~ '^[0-9]+$' AND pr.year_built::integer <= $${paramIndex}`;
        params.push(maxYear);
        paramIndex++;
      }

      if (minUnits) {
        whereClause += ` AND pr.units >= $${paramIndex}`;
        params.push(minUnits);
        paramIndex++;
      }

      if (maxUnits) {
        whereClause += ` AND pr.units <= $${paramIndex}`;
        params.push(maxUnits);
        paramIndex++;
      }

      if (minPricePerUnit) {
        whereClause += ` AND pr.assessed_value > 0 AND pr.units > 0 AND (pr.assessed_value::numeric / pr.units::numeric) >= $${paramIndex}`;
        params.push(minPricePerUnit);
        paramIndex++;
      }

      if (maxPricePerUnit) {
        whereClause += ` AND pr.assessed_value > 0 AND pr.units > 0 AND (pr.assessed_value::numeric / pr.units::numeric) <= $${paramIndex}`;
        params.push(maxPricePerUnit);
        paramIndex++;
      }

      if (submarket) {
        whereClause += ` AND pr.neighborhood_code = $${paramIndex}`;
        params.push(submarket);
        paramIndex++;
      }

      if (ownerType) {
        whereClause += ` AND pr.owner_name ILIKE $${paramIndex}`;
        params.push(`%${ownerType}%`);
        paramIndex++;
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM property_records pr ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      const dataParams = [...params, limit, offset];

      const result = await pool.query(
        `SELECT 
          pr.id, pr.parcel_id, pr.county, pr.state, pr.address, pr.city, pr.zip_code,
          pr.owner_name, pr.owner_address_1, pr.owner_address_2,
          pr.units, pr.land_acres, pr.year_built, pr.stories, pr.building_sqft,
          pr.assessed_value, pr.assessed_land, pr.assessed_improvements, pr.appraised_value,
          pr.land_use_code, pr.class_code, pr.neighborhood_code, pr.subdivision, pr.tax_district,
          pr.property_type, pr.total_assessed_value,
          s.name as submarket_name,
          CASE WHEN pr.assessed_value > 0 AND pr.units > 0 THEN ROUND(pr.assessed_value::numeric / pr.units / 12 * 0.08) ELSE NULL END as estimated_rent,
          CASE WHEN pr.appraised_value > 0 AND pr.units > 0 THEN ROUND(pr.appraised_value::numeric / pr.units) ELSE NULL END as price_per_unit,
          CASE 
            WHEN pr.class_code IN ('C5','C6') THEN 'A'
            WHEN pr.class_code IN ('C4') THEN 'B'
            WHEN pr.class_code IN ('C3') THEN 'C'
            ELSE pr.class_code
          END as building_class
        FROM property_records pr
        LEFT JOIN submarkets s ON s.external_id = pr.neighborhood_code
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDir} NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataParams
      );

      res.json({
        properties: result.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  // GET /api/v1/markets/properties/:id - Single property detail with sales history
  router.get('/properties/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const propertyResult = await pool.query(
        `SELECT 
          pr.*,
          s.name as submarket_name,
          CASE WHEN pr.assessed_value > 0 AND pr.units > 0 THEN ROUND(pr.assessed_value::numeric / pr.units / 12 * 0.08) ELSE NULL END as estimated_rent,
          CASE WHEN pr.appraised_value > 0 AND pr.units > 0 THEN ROUND(pr.appraised_value::numeric / pr.units) ELSE NULL END as price_per_unit,
          CASE 
            WHEN pr.class_code IN ('C5','C6') THEN 'A'
            WHEN pr.class_code IN ('C4') THEN 'B'
            WHEN pr.class_code IN ('C3') THEN 'C'
            ELSE pr.class_code
          END as building_class
        FROM property_records pr
        LEFT JOIN submarkets s ON s.external_id = pr.neighborhood_code
        WHERE pr.id = $1`,
        [id]
      );

      if (propertyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Property not found' });
      }

      const property = propertyResult.rows[0];

      const salesResult = await pool.query(
        `SELECT * FROM property_sales WHERE parcel_id = $1 ORDER BY sale_year DESC`,
        [property.parcel_id]
      );

      const currentYear = new Date().getFullYear();
      const lastSaleYear = salesResult.rows.length > 0 ? salesResult.rows[0].sale_year : null;
      const holdPeriod = lastSaleYear ? currentYear - lastSaleYear : null;

      let sellerMotivationScore: number | null = null;
      if (holdPeriod !== null) {
        if (holdPeriod > 10) {
          sellerMotivationScore = 85 + Math.min(15, (holdPeriod - 10) * 2);
        } else if (holdPeriod > 6) {
          sellerMotivationScore = 60 + (holdPeriod - 6) * 6;
        } else if (holdPeriod >= 3) {
          sellerMotivationScore = 30 + (holdPeriod - 3) * 10;
        } else {
          sellerMotivationScore = holdPeriod * 10;
        }
        sellerMotivationScore = Math.min(100, Math.max(0, sellerMotivationScore));
      }

      res.json({
        ...property,
        sales: salesResult.rows,
        hold_period: holdPeriod,
        seller_motivation_score: sellerMotivationScore,
      });
    } catch (error) {
      console.error('Error fetching property detail:', error);
      res.status(500).json({ error: 'Failed to fetch property detail' });
    }
  });

  // GET /api/v1/markets/market-stats/:marketId - Aggregated market statistics
  router.get('/market-stats/:marketId', async (req, res) => {
    try {
      const { marketId } = req.params;

      let whereClause = 'WHERE units > 0';
      if (marketId === 'atlanta') {
        whereClause = "WHERE county = 'Fulton' AND state = 'GA' AND units > 0";
      }

      const statsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_properties,
          COALESCE(SUM(units), 0) as total_units,
          ROUND(AVG(assessed_value)::numeric, 2) as avg_assessed_value,
          ROUND(AVG(units)::numeric, 2) as avg_units_per_property,
          ROUND(STDDEV(assessed_value)::numeric, 2) as stddev_assessed_value,
          COUNT(DISTINCT owner_name) as unique_owners
        FROM property_records
        ${whereClause}`
      );

      const propertyTypesResult = await pool.query(
        `SELECT COALESCE(property_type, 'Unknown') as type, COUNT(*) as count
        FROM property_records
        ${whereClause}
        GROUP BY property_type
        ORDER BY count DESC`
      );

      const neighborhoodResult = await pool.query(
        `SELECT 
          neighborhood_code,
          COUNT(*) as properties,
          SUM(units) as total_units,
          ROUND(AVG(assessed_value)::numeric, 2) as avg_assessed_value
        FROM property_records
        ${whereClause} AND neighborhood_code IS NOT NULL
        GROUP BY neighborhood_code
        ORDER BY total_units DESC
        LIMIT 10`
      );

      const stats = statsResult.rows[0];
      const totalProperties = parseInt(stats.total_properties);
      const totalUnits = parseInt(stats.total_units);
      const avgAssessedValue = parseFloat(stats.avg_assessed_value) || 0;
      const avgUnits = parseFloat(stats.avg_units_per_property) || 0;
      const stddevAssessed = parseFloat(stats.stddev_assessed_value) || 0;
      const uniqueOwners = parseInt(stats.unique_owners) || 0;

      const propertyTypes: Record<string, number> = {};
      propertyTypesResult.rows.forEach((row: any) => {
        propertyTypes[row.type] = parseInt(row.count);
      });

      const demandScore = Math.min(100, Math.round((totalProperties / 500) * 40 + (totalUnits / 5000) * 60));
      const supplyScore = Math.min(100, Math.round(avgUnits * 5 + (totalUnits > 10000 ? 30 : totalUnits / 333)));
      const momentumScore = avgAssessedValue > 100000 ? Math.min(100, Math.round(60 + (avgAssessedValue / 500000) * 40)) : Math.min(100, Math.round((avgAssessedValue / 100000) * 60));
      const ownerConcentration = uniqueOwners > 0 ? totalProperties / uniqueOwners : 1;
      const positionScore = Math.min(100, Math.round(ownerConcentration * 20 + 40));
      const riskScore = stddevAssessed > 0 && avgAssessedValue > 0
        ? Math.min(100, Math.round(100 - (stddevAssessed / avgAssessedValue) * 50))
        : 50;

      res.json({
        totalProperties,
        totalUnits,
        avgAssessedValue,
        avgUnitsPerProperty: avgUnits,
        propertyTypes,
        neighborhoodStats: neighborhoodResult.rows,
        coveragePercent: 60,
        totalParcels: 1033000,
        signals: {
          demand: Math.max(0, Math.min(100, demandScore)),
          supply: Math.max(0, Math.min(100, supplyScore)),
          momentum: Math.max(0, Math.min(100, momentumScore)),
          position: Math.max(0, Math.min(100, positionScore)),
          risk: Math.max(0, Math.min(100, riskScore)),
        },
      });
    } catch (error) {
      console.error('Error fetching market stats:', error);
      res.status(500).json({ error: 'Failed to fetch market stats' });
    }
  });

  // GET /api/v1/markets/submarket-stats/:marketId - Submarket breakdown
  router.get('/submarket-stats/:marketId', async (req, res) => {
    try {
      const { marketId } = req.params;

      const msaId = marketId === 'atlanta' ? 1 : 1;

      const submarketResult = await pool.query(
        `SELECT id, name, external_id, properties_count, total_units, avg_occupancy, avg_rent, avg_cap_rate
        FROM submarkets
        WHERE msa_id = $1
        ORDER BY name ASC`,
        [msaId]
      );

      let whereClause = 'WHERE units > 0';
      if (marketId === 'atlanta') {
        whereClause = "WHERE county = 'Fulton' AND state = 'GA' AND units > 0";
      }

      const propertyStatsResult = await pool.query(
        `SELECT 
          neighborhood_code,
          COUNT(*) as real_properties,
          COALESCE(SUM(units), 0) as real_units
        FROM property_records
        ${whereClause} AND neighborhood_code IS NOT NULL
        GROUP BY neighborhood_code`
      );

      const propertyStatsMap = new Map<string, { real_properties: number; real_units: number }>();
      propertyStatsResult.rows.forEach((row: any) => {
        propertyStatsMap.set(row.neighborhood_code, {
          real_properties: parseInt(row.real_properties),
          real_units: parseInt(row.real_units),
        });
      });

      const submarkets = submarketResult.rows.map((row: any) => {
        const realStats = propertyStatsMap.get(row.external_id);
        return {
          id: row.id,
          name: row.name,
          external_id: row.external_id,
          properties_count: row.properties_count,
          total_units: row.total_units,
          avg_occupancy: row.avg_occupancy ? parseFloat(row.avg_occupancy) : null,
          avg_rent: row.avg_rent ? parseFloat(row.avg_rent) : null,
          avg_cap_rate: row.avg_cap_rate ? parseFloat(row.avg_cap_rate) : null,
          real_properties: realStats ? realStats.real_properties : 0,
          real_units: realStats ? realStats.real_units : 0,
        };
      });

      res.json(submarkets);
    } catch (error) {
      console.error('Error fetching submarket stats:', error);
      res.status(500).json({ error: 'Failed to fetch submarket stats' });
    }
  });

  return router;
}

// Helper: Generate market alerts
async function generateMarketAlerts(pool: Pool, userId: number, markets: any[]): Promise<MarketAlert[]> {
  const alerts: MarketAlert[] = [];

  for (const market of markets) {
    // Alert: New data points available
    if (market.data_points_count > 0 && market.status === 'active') {
      // Check if there are properties with owner info
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
    }

    // Alert: Opportunity identified (high JEDI score)
    if (market.jedi_score && market.jedi_score >= 90) {
      alerts.push({
        id: `${market.market_id}-high-score`,
        market_id: market.market_id,
        market_name: market.display_name,
        type: 'opportunity',
        severity: 'success',
        title: 'Strong Buy Signal',
        message: `JEDI Score: ${market.jedi_score} (${market.jedi_rating}) - Excellent investment opportunity`,
        action_url: `/markets/${market.market_id}/overview`,
        created_at: new Date()
      });
    }

    // Alert: Market data pending
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

export default createMarketIntelligenceRoutes;
