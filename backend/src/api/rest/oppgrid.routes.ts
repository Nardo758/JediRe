/**
 * OppGrid Integration Routes
 * 
 * Provides endpoints for:
 * 1. Syncing data from ApartmentIQ (demand signals, market economics)
 * 2. Serving aggregated data to OppGrid for report generation
 * 
 * Flow: ApartmentIQ (Leon's PC) -> JediRE (this) -> OppGrid
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

const router = Router();

// ============================================================================
// Authentication Middleware
// ============================================================================

function validateOppGridAuth(req: Request, res: Response, next: Function): void {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const expectedToken = process.env.OPPGRID_SYNC_TOKEN || process.env.CLAWDBOT_AUTH_TOKEN;
  
  // Allow if no token configured (dev mode) or token matches
  if (!expectedToken || token === expectedToken) {
    next();
    return;
  }
  
  res.status(401).json({ 
    error: 'Unauthorized', 
    message: 'Invalid or missing authorization token' 
  });
}

// ============================================================================
// SYNC ENDPOINTS (ApartmentIQ -> JediRE)
// ============================================================================

/**
 * POST /api/v1/oppgrid/sync-demand
 * 
 * Receives demand signals from ApartmentIQ
 * Body: { city, state, signals: [{ amenity_type, demand_pct, avg_frequency, priority_weight, sample_size }] }
 */
router.post('/sync-demand', validateOppGridAuth, async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    const { city, state, signals } = req.body;
    
    if (!city || !state || !signals || !Array.isArray(signals)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Required: city, state, signals (array)',
      });
    }
    
    let upserted = 0;
    
    for (const signal of signals) {
      const { amenity_type, demand_pct, avg_frequency, priority_weight, sample_size, trend } = signal;
      
      if (!amenity_type) continue;
      
      await pool.query(`
        INSERT INTO oppgrid_demand_signals 
          (city, state, amenity_type, demand_pct, avg_frequency, priority_weight, sample_size, trend, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (city, state, amenity_type) 
        DO UPDATE SET
          demand_pct = EXCLUDED.demand_pct,
          avg_frequency = EXCLUDED.avg_frequency,
          priority_weight = EXCLUDED.priority_weight,
          sample_size = EXCLUDED.sample_size,
          trend = COALESCE(EXCLUDED.trend, oppgrid_demand_signals.trend),
          updated_at = NOW()
      `, [
        city.toLowerCase(),
        state.toUpperCase(),
        amenity_type.toLowerCase(),
        demand_pct || 0,
        avg_frequency || 0,
        priority_weight || 1.0,
        sample_size || 0,
        trend || 'stable'
      ]);
      
      upserted++;
    }
    
    logger.info(`[OppGrid] Synced ${upserted} demand signals for ${city}, ${state}`);
    
    res.json({
      success: true,
      message: `Synced ${upserted} demand signals`,
      city,
      state,
      count: upserted,
    });
    
  } catch (error: any) {
    logger.error('[OppGrid] sync-demand error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/v1/oppgrid/sync-economics
 * 
 * Receives market economics from ApartmentIQ
 * Body: { city, state, avg_rent_1br, avg_rent_2br, avg_rent_3br, median_rent, vacancy_rate, rent_trend, yoy_change, sample_size }
 */
router.post('/sync-economics', validateOppGridAuth, async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    const { 
      city, state, 
      avg_rent_1br, avg_rent_2br, avg_rent_3br, 
      median_rent, vacancy_rate, rent_trend, yoy_change, sample_size 
    } = req.body;
    
    if (!city || !state) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Required: city, state',
      });
    }
    
    await pool.query(`
      INSERT INTO oppgrid_market_economics 
        (city, state, avg_rent_1br, avg_rent_2br, avg_rent_3br, median_rent, 
         vacancy_rate, rent_trend, yoy_change, sample_size, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (city, state) 
      DO UPDATE SET
        avg_rent_1br = COALESCE(EXCLUDED.avg_rent_1br, oppgrid_market_economics.avg_rent_1br),
        avg_rent_2br = COALESCE(EXCLUDED.avg_rent_2br, oppgrid_market_economics.avg_rent_2br),
        avg_rent_3br = COALESCE(EXCLUDED.avg_rent_3br, oppgrid_market_economics.avg_rent_3br),
        median_rent = COALESCE(EXCLUDED.median_rent, oppgrid_market_economics.median_rent),
        vacancy_rate = COALESCE(EXCLUDED.vacancy_rate, oppgrid_market_economics.vacancy_rate),
        rent_trend = COALESCE(EXCLUDED.rent_trend, oppgrid_market_economics.rent_trend),
        yoy_change = COALESCE(EXCLUDED.yoy_change, oppgrid_market_economics.yoy_change),
        sample_size = COALESCE(EXCLUDED.sample_size, oppgrid_market_economics.sample_size),
        updated_at = NOW()
    `, [
      city.toLowerCase(),
      state.toUpperCase(),
      avg_rent_1br || null,
      avg_rent_2br || null,
      avg_rent_3br || null,
      median_rent || null,
      vacancy_rate || null,
      rent_trend || 'stable',
      yoy_change || null,
      sample_size || null
    ]);
    
    logger.info(`[OppGrid] Synced market economics for ${city}, ${state}`);
    
    res.json({
      success: true,
      message: `Synced market economics for ${city}, ${state}`,
      city,
      state,
    });
    
  } catch (error: any) {
    logger.error('[OppGrid] sync-economics error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ============================================================================
// QUERY ENDPOINTS (OppGrid -> JediRE)
// ============================================================================

/**
 * GET /api/v1/oppgrid/demand-signals
 * 
 * Returns demand signals for a city/state
 * Query: ?city=Atlanta&state=GA
 */
router.get('/demand-signals', async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    const { city, state } = req.query;
    
    if (!city || !state) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Required query params: city, state',
      });
    }
    
    const result = await pool.query(`
      SELECT 
        amenity_type,
        demand_pct,
        avg_frequency,
        priority_weight,
        sample_size,
        trend,
        updated_at
      FROM oppgrid_demand_signals
      WHERE city = $1 AND state = $2
      ORDER BY demand_pct DESC
    `, [
      (city as string).toLowerCase(),
      (state as string).toUpperCase()
    ]);
    
    res.json({
      city: (city as string).toLowerCase(),
      state: (state as string).toUpperCase(),
      signals: result.rows.map(row => ({
        amenity_type: row.amenity_type,
        demand_pct: parseFloat(row.demand_pct) || 0,
        avg_frequency: parseFloat(row.avg_frequency) || 0,
        priority_weight: parseFloat(row.priority_weight) || 1,
        sample_size: row.sample_size || 0,
        trend: row.trend || 'stable',
      })),
      updated_at: result.rows[0]?.updated_at || null,
      count: result.rows.length,
    });
    
  } catch (error: any) {
    logger.error('[OppGrid] demand-signals error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * GET /api/v1/oppgrid/market-economics
 * 
 * Returns market economics for a city/state
 * Query: ?city=Atlanta&state=GA
 */
router.get('/market-economics', async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    const { city, state } = req.query;
    
    if (!city || !state) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Required query params: city, state',
      });
    }
    
    const result = await pool.query(`
      SELECT 
        avg_rent_1br,
        avg_rent_2br,
        avg_rent_3br,
        median_rent,
        vacancy_rate,
        rent_trend,
        yoy_change,
        sample_size,
        updated_at
      FROM oppgrid_market_economics
      WHERE city = $1 AND state = $2
    `, [
      (city as string).toLowerCase(),
      (state as string).toUpperCase()
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No market economics data for ${city}, ${state}`,
      });
    }
    
    const row = result.rows[0];
    
    // Calculate spending power index (0-100 scale based on rent levels)
    // Higher rent = higher spending power
    const medianRent = row.median_rent || row.avg_rent_2br || 1500;
    const spendingPowerIndex = Math.min(100, Math.round((medianRent / 3000) * 100));
    
    res.json({
      city: (city as string).toLowerCase(),
      state: (state as string).toUpperCase(),
      avg_rent_1br: row.avg_rent_1br,
      avg_rent_2br: row.avg_rent_2br,
      avg_rent_3br: row.avg_rent_3br,
      median_rent: row.median_rent,
      vacancy_rate: parseFloat(row.vacancy_rate) || null,
      rent_trend: row.rent_trend || 'stable',
      yoy_change: parseFloat(row.yoy_change) || null,
      spending_power_index: spendingPowerIndex,
      sample_size: row.sample_size,
      updated_at: row.updated_at,
    });
    
  } catch (error: any) {
    logger.error('[OppGrid] market-economics error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/v1/oppgrid/score-location
 * 
 * Scores a business location based on demand signals and market data
 * Body: { address, city, state, business_type }
 */
router.post('/score-location', async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    const { address, city, state, business_type } = req.body;
    
    if (!city || !state || !business_type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Required: city, state, business_type',
      });
    }
    
    // Get demand signal for this business type
    const demandResult = await pool.query(`
      SELECT demand_pct, avg_frequency, trend
      FROM oppgrid_demand_signals
      WHERE city = $1 AND state = $2 AND amenity_type = $3
    `, [
      city.toLowerCase(),
      state.toUpperCase(),
      business_type.toLowerCase()
    ]);
    
    // Get market economics
    const economicsResult = await pool.query(`
      SELECT median_rent, vacancy_rate, rent_trend, yoy_change
      FROM oppgrid_market_economics
      WHERE city = $1 AND state = $2
    `, [
      city.toLowerCase(),
      state.toUpperCase()
    ]);
    
    const demand = demandResult.rows[0];
    const economics = economicsResult.rows[0];
    
    // Calculate scores
    let demand_score = 50; // default
    let demographics_score = 50;
    let accessibility_score = 70; // placeholder - would need Google Places data
    let competition_score = 60; // placeholder - would need competitor data
    
    const insights: string[] = [];
    
    if (demand) {
      // Convert demand_pct to a score (0-100)
      demand_score = Math.min(100, Math.round(parseFloat(demand.demand_pct) * 2));
      
      if (parseFloat(demand.demand_pct) >= 40) {
        insights.push(`High demand: ${demand.demand_pct}% of residents prioritize ${business_type.replace('_', ' ')}`);
      } else if (parseFloat(demand.demand_pct) >= 20) {
        insights.push(`Moderate demand: ${demand.demand_pct}% of residents want ${business_type.replace('_', ' ')} nearby`);
      } else {
        insights.push(`Lower demand: ${demand.demand_pct}% residential preference for ${business_type.replace('_', ' ')}`);
      }
      
      if (demand.trend === 'rising') {
        demand_score = Math.min(100, demand_score + 10);
        insights.push('Demand trend: Rising');
      }
    } else {
      insights.push(`No demand data available for ${business_type.replace('_', ' ')} in ${city}`);
    }
    
    if (economics) {
      const medianRent = parseFloat(economics.median_rent) || 1500;
      // Higher rent areas = higher spending power = better score
      demographics_score = Math.min(100, Math.round((medianRent / 2500) * 80));
      
      if (medianRent >= 2000) {
        insights.push(`High spending power area (median rent: $${medianRent})`);
      } else if (medianRent >= 1500) {
        insights.push(`Moderate spending power (median rent: $${medianRent})`);
      }
      
      const vacancy = parseFloat(economics.vacancy_rate);
      if (vacancy && vacancy < 5) {
        insights.push('Low vacancy rate indicates strong rental market');
      }
    }
    
    // Calculate overall score (weighted average)
    const overall_score = Math.round(
      (demand_score * 0.35) +
      (demographics_score * 0.25) +
      (accessibility_score * 0.20) +
      (competition_score * 0.20)
    );
    
    res.json({
      address: address || `${city}, ${state}`,
      city: city.toLowerCase(),
      state: state.toUpperCase(),
      business_type,
      overall_score,
      breakdown: {
        demand_score,
        demographics_score,
        accessibility_score,
        competition_score,
      },
      insights,
      data_available: {
        demand: !!demand,
        economics: !!economics,
      },
    });
    
  } catch (error: any) {
    logger.error('[OppGrid] score-location error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * GET /api/v1/oppgrid/health
 * 
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    // Check if tables exist
    const tablesCheck = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM oppgrid_demand_signals) as demand_signals_count,
        (SELECT COUNT(*) FROM oppgrid_market_economics) as market_economics_count
    `).catch(() => ({ rows: [{ demand_signals_count: 0, market_economics_count: 0 }] }));
    
    const counts = tablesCheck.rows[0];
    
    res.json({
      status: 'healthy',
      service: 'oppgrid-integration',
      timestamp: new Date().toISOString(),
      data: {
        demand_signals_count: parseInt(counts.demand_signals_count) || 0,
        market_economics_count: parseInt(counts.market_economics_count) || 0,
      },
    });
    
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/oppgrid/cities
 * 
 * Returns list of cities with available data
 */
router.get('/cities', async (req: Request, res: Response) => {
  const pool = getPool();
  
  try {
    const result = await pool.query(`
      SELECT DISTINCT city, state, 
        (SELECT COUNT(*) FROM oppgrid_demand_signals ds WHERE ds.city = e.city AND ds.state = e.state) as demand_signal_count
      FROM oppgrid_market_economics e
      ORDER BY state, city
    `);
    
    res.json({
      cities: result.rows.map(row => ({
        city: row.city,
        state: row.state,
        demand_signal_count: parseInt(row.demand_signal_count) || 0,
      })),
      count: result.rows.length,
    });
    
  } catch (error: any) {
    logger.error('[OppGrid] cities error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;
