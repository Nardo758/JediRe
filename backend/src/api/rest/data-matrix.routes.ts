/**
 * Data Matrix API Routes
 * 
 * The neural network layer that pulls from Data Library + all external sources.
 */

import { Router, Request, Response } from 'express';
import { getDataMatrixService, DataLibraryDeal } from '../../services/neural-network';
import { requireAuth } from '../../middleware/auth';

const router = Router();

/**
 * POST /api/v1/data-matrix/context
 * 
 * Build full data matrix context for a Data Library deal.
 * This is the main entry point for agents to get comprehensive deal context.
 */
router.post('/context', requireAuth, async (req: Request, res: Response) => {
  try {
    const { deal, options } = req.body as {
      deal: DataLibraryDeal;
      options?: {
        includePropertyInfo?: boolean;
        includeRentData?: boolean;
        includeSalesComps?: boolean;
        includeProximity?: boolean;
        includeEvents?: boolean;
        includeBacktest?: boolean;
        includeBenchmarks?: boolean;
        includeMacro?: boolean;
        includeMarketTrends?: boolean;
        searchRadiusMiles?: number;
      };
    };
    
    if (!deal) {
      return res.status(400).json({ error: 'Deal is required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database pool not configured' });
    }
    
    const service = getDataMatrixService(pool);
    const context = await service.buildContext(deal, options);
    
    res.json(context);
  } catch (error) {
    console.error('[DataMatrix] Context build error:', error);
    res.status(500).json({ 
      error: 'Failed to build data matrix context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/data-matrix/context/from-asset
 * 
 * Build context from a Data Library asset ID.
 */
router.post('/context/from-asset', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetId, options } = req.body as {
      assetId: string;
      options?: Record<string, any>;
    };
    
    if (!assetId) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database pool not configured' });
    }
    
    // Fetch asset from Data Library
    const assetResult = await pool.query(`
      SELECT 
        id, user_id, property_name, address, city, state, county, zip_code,
        units, year_built, stories, living_area_sqft,
        asking_price, cap_rate, noi, avg_rent, occupancy_pct,
        deal_type, asset_class,
        latitude, longitude
      FROM data_library_assets
      WHERE id = $1
    `, [assetId]);
    
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const row = assetResult.rows[0];
    const deal: DataLibraryDeal = {
      id: row.id,
      userId: row.user_id,
      propertyName: row.property_name,
      address: row.address,
      city: row.city,
      state: row.state,
      county: row.county,
      zip: row.zip_code,
      units: row.units,
      yearBuilt: row.year_built,
      stories: row.stories,
      livingAreaSqFt: row.living_area_sqft,
      askingPrice: row.asking_price ? parseFloat(row.asking_price) : undefined,
      capRate: row.cap_rate ? parseFloat(row.cap_rate) : undefined,
      noi: row.noi ? parseFloat(row.noi) : undefined,
      avgRent: row.avg_rent ? parseFloat(row.avg_rent) : undefined,
      occupancyPct: row.occupancy_pct ? parseFloat(row.occupancy_pct) : undefined,
      dealType: row.deal_type,
      assetClass: row.asset_class,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined
    };
    
    const service = getDataMatrixService(pool);
    const context = await service.buildContext(deal, options);
    
    res.json(context);
  } catch (error) {
    console.error('[DataMatrix] Context from asset error:', error);
    res.status(500).json({ error: 'Failed to build context from asset' });
  }
});

/**
 * POST /api/v1/data-matrix/context/from-deal
 * 
 * Build context from a deals table record.
 */
router.post('/context/from-deal', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, options } = req.body as {
      dealId: string;
      options?: Record<string, any>;
    };
    
    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database pool not configured' });
    }
    
    // Fetch from deals table
    const dealResult = await pool.query(`
      SELECT 
        id, property_name, address, city, state, county, zip,
        units, year_built, stories, sf,
        asking_price, noi,
        deal_type, asset_class
      FROM deals
      WHERE id = $1
    `, [dealId]);
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const row = dealResult.rows[0];
    const deal: DataLibraryDeal = {
      id: row.id,
      propertyName: row.property_name,
      address: row.address,
      city: row.city,
      state: row.state,
      county: row.county,
      zip: row.zip,
      units: row.units,
      yearBuilt: row.year_built,
      stories: row.stories,
      livingAreaSqFt: row.sf,
      askingPrice: row.asking_price ? parseFloat(row.asking_price) : undefined,
      noi: row.noi ? parseFloat(row.noi) : undefined,
      dealType: row.deal_type,
      assetClass: row.asset_class
    };
    
    const service = getDataMatrixService(pool);
    const context = await service.buildContext(deal, options);
    
    res.json(context);
  } catch (error) {
    console.error('[DataMatrix] Context from deal error:', error);
    res.status(500).json({ error: 'Failed to build context from deal' });
  }
});

/**
 * GET /api/v1/data-matrix/layers
 * 
 * Get info about available data layers.
 */
router.get('/layers', async (_req: Request, res: Response) => {
  res.json({
    layers: [
      { 
        name: 'propertyInfo', 
        description: 'Property records from municipal APIs (year built, units, zoning, owner)',
        source: 'County GIS (Cobb, Gwinnett, DeKalb, Fulton, FL counties, etc.)',
        weight: 15
      },
      { 
        name: 'rentData', 
        description: 'Rent and occupancy data from Apartment Locator',
        source: 'apartment_locator_properties',
        weight: 15
      },
      { 
        name: 'salesComps', 
        description: 'Recent sales transactions for comparable analysis',
        source: 'property_sales (927K+ Cobb County records)',
        weight: 10
      },
      { 
        name: 'proximity', 
        description: 'Spatial context (transit, grocery, schools, crime)',
        source: 'points_of_interest + property_proximity',
        weight: 15
      },
      { 
        name: 'events', 
        description: 'Market events (employer moves, supply pipeline)',
        source: 'market_events',
        weight: 10
      },
      { 
        name: 'backtest', 
        description: 'Historical deal performance validation',
        source: 'archive_deals + backtest_runs',
        weight: 10
      },
      { 
        name: 'benchmarks', 
        description: 'Assumption benchmarks from historical deals',
        source: 'archive_deals',
        weight: 10
      },
      { 
        name: 'macro', 
        description: 'Economic indicators (jobs, population, inflation)',
        source: 'BLS API + cached data',
        weight: 5
      },
      { 
        name: 'marketTrends', 
        description: 'Market trends from correlation engine',
        source: 'market_snapshots + metric_correlations',
        weight: 10
      }
    ],
    totalWeight: 100
  });
});

export default router;
