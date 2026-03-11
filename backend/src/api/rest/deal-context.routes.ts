import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/deals/:dealId/context
 * 
 * Hydrate full DealContext from database.
 * Assembles data from deal_capsules + various agent caches.
 */
router.get('/:dealId/context', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    // Fetch base deal data
    const dealResult = await pool.query(`
      SELECT 
        id,
        name,
        address,
        city,
        COALESCE(state, state_code) as state,
        property_address as zip,
        '' as county,
        '[]'::jsonb as "parcelIds",
        COALESCE(deal_data->'coordinates', '{"lat":0,"lng":0}'::jsonb) as coordinates,
        project_type,
        status as stage,
        deal_data,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM deals
      WHERE id = $1
    `, [dealId]);

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const deal = dealResult.rows[0];
    const dealData = deal.deal_data || {};

    // Determine mode: existing vs development
    const mode = deal.project_type === 'development' ? 'development' : 'existing';

    // Build identity
    const identity = {
      id: deal.id,
      name: deal.name,
      address: deal.address,
      city: deal.city,
      state: deal.state,
      zip: deal.zip,
      county: deal.county,
      parcelIds: deal.parcelIds || [],
      coordinates: deal.coordinates || { lat: 0, lng: 0 },
      mode,
      stage: deal.stage || 'lead',
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    };

    // Helper to create layered values
    const layered = (value: any, source = 'broker', confidence = 0.5) => ({
      value,
      source,
      updatedAt: new Date().toISOString(),
      confidence,
    });

    // Fetch zoning profile
    const zoningResult = await pool.query(`
      SELECT * FROM zoning_profiles WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [dealId]);

    const zoningData = zoningResult.rows[0];
    const zoning = {
      designation: layered(zoningData?.district_code || '', 'platform', 0.7),
      maxDensity: layered(zoningData?.max_density || 0, 'platform', 0.7),
      maxHeight: layered(zoningData?.max_height || 0, 'platform', 0.7),
      maxFAR: layered(zoningData?.max_far || 0, 'platform', 0.7),
      maxLotCoverage: layered(0, 'broker', 0.5),
      setbacks: layered({ front: 0, side: 0, rear: 0 }, 'platform', 0.5),
      parkingRatio: layered(1.0, 'platform', 0.6),
      guestParkingRatio: layered(0.25, 'platform', 0.6),
      sourceUrl: zoningData?.source_url || null,
      verified: zoningData?.verified || false,
      overlays: zoningData?.overlays || [],
    };

    // Fetch market intelligence
    const marketIntelResult = await pool.query(`
      SELECT * FROM deal_market_intelligence WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [dealId]);

    const marketData = marketIntelResult.rows[0];
    const market = {
      submarketName: marketData?.submarket_name || '',
      submarketId: marketData?.submarket_id || '',
      avgRent: layered(marketData?.avg_rent || 0, 'platform', 0.7),
      avgOccupancy: layered(marketData?.avg_occupancy || 0, 'platform', 0.7),
      rentGrowthYoY: layered(marketData?.rent_growth_yoy || 0.03, 'platform', 0.6),
      absorptionRate: layered(0, 'platform', 0.5),
      medianHHI: layered(marketData?.median_hhi || 0, 'platform', 0.6),
      popGrowthPct: layered(0, 'platform', 0.5),
      employmentGrowthPct: layered(0, 'platform', 0.5),
    };

    // Build context object
    const context = {
      identity,
      site: {
        acreage: layered(dealData.site?.acreage || 0),
        buildableAcreage: layered(dealData.site?.buildableAcreage || 0),
        boundary: dealData.site?.boundary || null,
        constraints: dealData.site?.constraints || [],
        floodZone: layered(null),
      },
      zoning,
      developmentPaths: dealData.developmentPaths || [],
      selectedDevelopmentPathId: dealData.selectedDevelopmentPathId || null,
      existingProperty: dealData.existingProperty || null,
      resolvedUnitMix: dealData.resolvedUnitMix || [],
      unitMixOverrides: dealData.unitMixOverrides || {},
      totalUnits: dealData.totalUnits || 0,
      market,
      supply: {
        pipelineUnits: layered(0),
        supplyPressureRatio: 0,
        monthsOfSupply: 0,
        projects: [],
      },
      financial: dealData.financial || {
        assumptions: {
          rentGrowth: layered(0.03, 'platform', 0.6),
          expenseGrowth: layered(0.025, 'platform', 0.6),
          vacancy: layered(0.05, 'platform', 0.6),
          exitCapRate: layered(0.055, 'platform', 0.5),
          holdPeriod: layered(5, 'user', 0.9),
          capexPerUnit: layered(0, 'broker', 0.4),
          managementFee: layered(0.04, 'platform', 0.7),
        },
      },
      capital: dealData.capital || {
        totalCapital: layered(0),
        debt: [],
        equity: [],
      },
      strategy: dealData.strategy || {
        scores: [],
        selectedStrategy: layered('rental', 'platform', 0.5),
        arbitrageGap: 0,
        arbitrageAlert: false,
        verdict: '',
      },
      scores: dealData.scores || {
        overall: 0,
        demand: 0,
        supply: 0,
        momentum: 0,
        position: 0,
        risk: 0,
        score30dAgo: null,
        confidence: 0,
        verdict: 'Neutral',
      },
      risk: dealData.risk || {
        overall: 0,
        categories: { supply: 0, demand: 0, regulatory: 0, market: 0, execution: 0, climate: 0 },
        topRisk: { category: '', score: 0, detail: '', mitigationAvailable: false },
      },
      hydrationStatus: {
        identity: { hydrated: true, lastFetchedAt: new Date().toISOString(), source: 'live' },
        zoning: { hydrated: !!zoningData, lastFetchedAt: new Date().toISOString(), source: 'live' },
        market: { hydrated: !!marketData, lastFetchedAt: new Date().toISOString(), source: 'live' },
        supply: { hydrated: false, lastFetchedAt: null, source: 'mock' },
        financial: { hydrated: !!dealData.financial, lastFetchedAt: new Date().toISOString(), source: dealData.financial ? 'live' : 'mock' },
        capital: { hydrated: false, lastFetchedAt: null, source: 'mock' },
        strategy: { hydrated: !!dealData.strategy, lastFetchedAt: new Date().toISOString(), source: dealData.strategy ? 'live' : 'mock' },
        scores: { hydrated: !!dealData.scores, lastFetchedAt: new Date().toISOString(), source: dealData.scores ? 'live' : 'mock' },
        risk: { hydrated: false, lastFetchedAt: null, source: 'mock' },
      },
      stageHistory: dealData.stageHistory || [],
    };

    res.json(context);
  } catch (error: any) {
    logger.error('Error fetching deal context:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deal context' });
  }
});

/**
 * PATCH /api/v1/deals/:dealId/context
 * 
 * Persist user overrides and selected path changes.
 */
router.patch('/:dealId/context', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const updates = req.body;
    const pool = getPool();

    // Update deal_data JSONB field
    await pool.query(`
      UPDATE deals
      SET 
        deal_data = COALESCE(deal_data, '{}'::jsonb) || $1::jsonb,
        updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(updates), dealId]);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error updating deal context:', error);
    res.status(500).json({ success: false, error: 'Failed to update deal context' });
  }
});

/**
 * POST /api/v1/deals/:dealId/recompute
 * 
 * Trigger downstream recomputation after keystone changes.
 * Returns updated sections (financial, strategy, scores, risk).
 */
router.post('/:dealId/recompute', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { trigger, pathId, unitMix, constructionCost, timeline, zoningCompliance } = req.body;

    logger.info(`[Recompute] Triggered for deal ${dealId}`, { trigger, pathId });

    // TODO: Implement actual recomputation logic
    // For now, return placeholder response
    // In full implementation, this would:
    // 1. Call ProForma service with new unit mix + costs
    // 2. Call Strategy service with new parameters
    // 3. Call JEDI Score recalculation
    // 4. Call Risk reassessment
    // 5. Return updated sections

    const result = {
      financial: null, // ProForma service would populate
      strategy: null,  // Strategy service would populate
      scores: null,    // JEDI Score service would populate
      risk: null,      // Risk service would populate
    };

    res.json(result);
  } catch (error: any) {
    logger.error('Error in recompute:', error);
    res.status(500).json({ success: false, error: 'Recompute failed' });
  }
});

export default router;
