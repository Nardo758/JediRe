/**
 * Inflation Engine API Routes
 * 
 * JediRe proprietary inflation tracking for multifamily real estate.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  getInflationEngineService, 
  getMarketBasketService, 
  getReplacementCostService, 
  getReplacementCostServiceV2,
  ALL_BASKET_ITEMS, 
  PropertyInput,
  ReplacementCostInput
} from '../../services/inflation';

const router = Router();

// ============================================================================
// SCHEMAS
// ============================================================================

const GeographySchema = z.object({
  level: z.enum(['national', 'msa', 'county']),
  name: z.string(),
  fipsCode: z.string().optional()
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/v1/inflation/context
 * 
 * Get full inflation context for a geography.
 * Returns JediRe Composite Score + all component indices.
 */
router.get('/context', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States', fipsCode } = req.query as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
      fipsCode?: string;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level, name, fipsCode });
    
    res.json(context);
  } catch (error) {
    console.error('[Inflation] Context error:', error);
    res.status(500).json({ 
      error: 'Failed to get inflation context',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/inflation/composite-score
 * 
 * Get just the JediRe Composite Inflation Score.
 * Lightweight endpoint for dashboards.
 */
router.get('/composite-score', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States' } = req.query as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level, name });
    
    res.json({
      score: context.compositeScore.score,
      regime: context.compositeScore.regime,
      confidence: context.compositeScore.confidence,
      underwritingGuidance: context.compositeScore.underwritingGuidance,
      asOf: context.asOf
    });
  } catch (error) {
    console.error('[Inflation] Composite score error:', error);
    res.status(500).json({ error: 'Failed to get composite score' });
  }
});

/**
 * GET /api/v1/inflation/underwriting-guidance
 * 
 * Get inflation-adjusted underwriting recommendations.
 */
router.get('/underwriting-guidance', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States' } = req.query as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level, name });
    
    res.json({
      geography: { level, name },
      regime: context.compositeScore.regime,
      compositeScore: context.compositeScore.score,
      guidance: context.compositeScore.underwritingGuidance,
      forecasts: context.forecasts,
      
      // Detailed recommendations
      recommendations: {
        rentGrowth: {
          year1: context.compositeScore.underwritingGuidance.rentGrowthRecommendation,
          year2to5: Math.max(2.5, context.compositeScore.underwritingGuidance.rentGrowthRecommendation * 0.9),
          rationale: context.compositeScore.regime === 'elevated' || context.compositeScore.regime === 'high_inflation'
            ? 'Elevated inflation supports above-average rent growth, but assume mean reversion'
            : 'Moderate inflation environment, use historical averages'
        },
        expenseEscalation: {
          recommendation: context.compositeScore.underwritingGuidance.expenseEscalationRecommendation,
          byCategory: {
            utilities: context.jediReIndices.operatingCostIndex.utilities,
            repairs: context.jediReIndices.operatingCostIndex.repairs,
            insurance: context.jediReIndices.insuranceInflationIndex.composite,
            taxes: context.jediReIndices.taxAssessmentIndex.composite,
            management: context.jediReIndices.operatingCostIndex.management
          }
        },
        capRateConsiderations: {
          treasuryYield: context.fred.treasury10Year,
          recommendedSpread: context.compositeScore.underwritingGuidance.capRateSpreadVsTreasury,
          impliedCapRate: context.fred.treasury10Year + (context.compositeScore.underwritingGuidance.capRateSpreadVsTreasury / 100),
          rationale: `In a ${context.compositeScore.regime} inflation regime, require ${context.compositeScore.underwritingGuidance.capRateSpreadVsTreasury}bps spread over 10Y Treasury`
        },
        constructionCosts: {
          contingency: context.compositeScore.underwritingGuidance.constructionCostContingency,
          constructionInflation: context.jediReIndices.constructionCostIndex.composite,
          rationale: 'Apply to hard costs for development/value-add projects'
        }
      },
      
      asOf: context.asOf
    });
  } catch (error) {
    console.error('[Inflation] Guidance error:', error);
    res.status(500).json({ error: 'Failed to get underwriting guidance' });
  }
});

/**
 * GET /api/v1/inflation/indices
 * 
 * Get all JediRe proprietary indices.
 */
router.get('/indices', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States' } = req.query as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level, name });
    
    res.json({
      geography: { level, name },
      indices: context.jediReIndices,
      asOf: context.asOf
    });
  } catch (error) {
    console.error('[Inflation] Indices error:', error);
    res.status(500).json({ error: 'Failed to get indices' });
  }
});

/**
 * GET /api/v1/inflation/cpi
 * 
 * Get CPI components.
 */
router.get('/cpi', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States' } = req.query as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level, name });
    
    res.json({
      geography: { level, name },
      cpi: context.cpi,
      yoy: context.cpiYoY,
      shelterDetail: {
        shelter: context.cpi.shelter,
        rentPrimary: context.cpi.rentPrimary,
        rentOER: context.cpi.rentOER,
        note: 'Shelter CPI includes rent of primary residence and owners equivalent rent'
      },
      asOf: context.asOf
    });
  } catch (error) {
    console.error('[Inflation] CPI error:', error);
    res.status(500).json({ error: 'Failed to get CPI data' });
  }
});

/**
 * GET /api/v1/inflation/fed
 * 
 * Get Federal Reserve indicators.
 */
router.get('/fed', async (req: Request, res: Response) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level: 'national', name: 'United States' });
    
    res.json({
      fedFundsRate: context.fred.fedFundsRate,
      treasury10Year: context.fred.treasury10Year,
      realYield10Year: context.fred.realYield10Year,
      breakeven5Year: context.fred.breakeven5Year,
      breakeven10Year: context.fred.breakeven10Year,
      coreInflationPCE: context.fred.coreInflationPCE,
      
      interpretation: {
        realRates: context.fred.realYield10Year > 1.5 ? 'restrictive' : context.fred.realYield10Year > 0 ? 'neutral' : 'accommodative',
        marketInflationExpectations: context.fred.breakeven10Year,
        rateTrajectory: context.fred.fedFundsRate > 5.0 ? 'likely cutting' : 'data dependent'
      },
      
      asOf: context.asOf
    });
  } catch (error) {
    console.error('[Inflation] Fed error:', error);
    res.status(500).json({ error: 'Failed to get Fed data' });
  }
});

/**
 * GET /api/v1/inflation/insurance/:state
 * 
 * Get insurance inflation for a state.
 */
router.get('/insurance/:state', async (req: Request, res: Response) => {
  try {
    const { state } = req.params;
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level: 'national', name: 'United States' });
    
    const stateRate = context.jediReIndices.insuranceInflationIndex.byState[state.toUpperCase()] 
      || context.jediReIndices.insuranceInflationIndex.composite;
    
    res.json({
      state: state.toUpperCase(),
      insuranceInflation: stateRate,
      nationalAverage: context.jediReIndices.insuranceInflationIndex.composite,
      vsNational: stateRate - context.jediReIndices.insuranceInflationIndex.composite,
      trend: context.jediReIndices.insuranceInflationIndex.trend,
      
      underwritingNote: stateRate > 15 
        ? `Insurance costs in ${state.toUpperCase()} are escalating rapidly. Budget ${stateRate}%+ annual increases.`
        : `Insurance inflation in ${state.toUpperCase()} is manageable. Budget ${stateRate}% annual increases.`,
      
      asOf: context.asOf
    });
  } catch (error) {
    console.error('[Inflation] Insurance error:', error);
    res.status(500).json({ error: 'Failed to get insurance data' });
  }
});

/**
 * GET /api/v1/inflation/history
 * 
 * Get historical inflation data for charts.
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States', months = 24 } = req.query as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
      months?: number;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    // Query historical snapshots
    const result = await pool.query(`
      SELECT 
        snapshot_date,
        composite_score,
        regime,
        cpi_all_items,
        cpi_shelter,
        rent_inflation_index,
        operating_cost_index,
        insurance_inflation_index
      FROM inflation_snapshots
      WHERE geography_level = $1 AND geography_name = $2
        AND snapshot_date > NOW() - INTERVAL '${months} months'
      ORDER BY snapshot_date ASC
    `, [level, name]);
    
    res.json({
      geography: { level, name },
      history: result.rows.map(row => ({
        date: row.snapshot_date,
        compositeScore: parseFloat(row.composite_score),
        regime: row.regime,
        cpiAllItems: parseFloat(row.cpi_all_items),
        cpiShelter: parseFloat(row.cpi_shelter),
        rentInflationIndex: parseFloat(row.rent_inflation_index),
        operatingCostIndex: parseFloat(row.operating_cost_index),
        insuranceInflationIndex: parseFloat(row.insurance_inflation_index)
      })),
      months: parseInt(months as any)
    });
  } catch (error) {
    console.error('[Inflation] History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

/**
 * GET /api/v1/inflation/alerts
 * 
 * Get active inflation alerts.
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const result = await pool.query(`
      SELECT * FROM inflation_alerts
      WHERE is_active = TRUE
      ORDER BY severity DESC, created_at DESC
      LIMIT 20
    `);
    
    res.json({
      alerts: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('[Inflation] Alerts error:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * POST /api/v1/inflation/snapshot
 * 
 * Take a snapshot of current inflation state (for scheduled jobs).
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const { level = 'national', name = 'United States' } = req.body as {
      level?: 'national' | 'msa' | 'county';
      name?: string;
    };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getInflationEngineService(pool);
    const context = await service.getInflationContext({ level, name });
    
    // Store snapshot
    await pool.query(`
      INSERT INTO inflation_snapshots (
        snapshot_date, geography_level, geography_name,
        composite_score, regime,
        cpi_all_items, cpi_shelter, cpi_rent_primary,
        ppi_construction, fed_funds_rate, treasury_10y, breakeven_10y,
        rent_inflation_index, operating_cost_index, construction_cost_index,
        insurance_inflation_index, tax_assessment_index,
        rent_growth_recommendation, expense_escalation_recommendation,
        cap_rate_spread_vs_treasury, construction_contingency,
        full_context
      ) VALUES (
        CURRENT_DATE, $1, $2,
        $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16,
        $17, $18,
        $19, $20,
        $21
      )
      ON CONFLICT (snapshot_date, geography_level, geography_name)
      DO UPDATE SET
        composite_score = EXCLUDED.composite_score,
        regime = EXCLUDED.regime,
        full_context = EXCLUDED.full_context
    `, [
      level, name,
      context.compositeScore.score, context.compositeScore.regime,
      context.cpi.allItems, context.cpi.shelter, context.cpi.rentPrimary,
      context.ppi.constructionMaterials, context.fred.fedFundsRate, context.fred.treasury10Year, context.fred.breakeven10Year,
      context.jediReIndices.rentInflationIndex.national, context.jediReIndices.operatingCostIndex.composite, context.jediReIndices.constructionCostIndex.composite,
      context.jediReIndices.insuranceInflationIndex.composite, context.jediReIndices.taxAssessmentIndex.composite,
      context.compositeScore.underwritingGuidance.rentGrowthRecommendation, context.compositeScore.underwritingGuidance.expenseEscalationRecommendation,
      context.compositeScore.underwritingGuidance.capRateSpreadVsTreasury, context.compositeScore.underwritingGuidance.constructionCostContingency,
      JSON.stringify(context)
    ]);
    
    res.json({
      success: true,
      snapshot: {
        date: new Date().toISOString().split('T')[0],
        geography: { level, name },
        compositeScore: context.compositeScore.score,
        regime: context.compositeScore.regime
      }
    });
  } catch (error) {
    console.error('[Inflation] Snapshot error:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// ============================================================================
// MARKET BASKET ROUTES
// ============================================================================

/**
 * GET /api/v1/inflation/basket/index
 * 
 * Get market basket index for a geography.
 */
router.get('/basket/index', async (req: Request, res: Response) => {
  try {
    const { market, state } = req.query as { market?: string; state?: string };
    
    if (!market || !state) {
      return res.status(400).json({ error: 'Market and state are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getMarketBasketService(pool);
    const index = await service.getMarketBasketIndex(market, state);
    
    res.json(index);
  } catch (error) {
    console.error('[MarketBasket] Index error:', error);
    res.status(500).json({ error: 'Failed to get market basket index' });
  }
});

/**
 * GET /api/v1/inflation/basket/affordability
 * 
 * Get affordability impact analysis.
 */
router.get('/basket/affordability', async (req: Request, res: Response) => {
  try {
    const { market, state, avgRent } = req.query as { 
      market?: string; 
      state?: string;
      avgRent?: string;
    };
    
    if (!market || !state || !avgRent) {
      return res.status(400).json({ error: 'Market, state, and avgRent are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getMarketBasketService(pool);
    const impact = await service.getAffordabilityImpact(market, state, parseFloat(avgRent));
    
    res.json(impact);
  } catch (error) {
    console.error('[MarketBasket] Affordability error:', error);
    res.status(500).json({ error: 'Failed to get affordability impact' });
  }
});

/**
 * GET /api/v1/inflation/basket/turn-cost
 * 
 * Get turn cost estimate for a unit.
 */
router.get('/basket/turn-cost', async (req: Request, res: Response) => {
  try {
    const { market, state, sqft, condition = 'standard' } = req.query as {
      market?: string;
      state?: string;
      sqft?: string;
      condition?: 'light' | 'standard' | 'heavy';
    };
    
    if (!market || !state || !sqft) {
      return res.status(400).json({ error: 'Market, state, and sqft are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getMarketBasketService(pool);
    const estimate = await service.getTurnCostEstimate(
      market, 
      state, 
      parseInt(sqft),
      condition
    );
    
    res.json({
      market,
      state,
      sqft: parseInt(sqft),
      condition,
      ...estimate
    });
  } catch (error) {
    console.error('[MarketBasket] Turn cost error:', error);
    res.status(500).json({ error: 'Failed to get turn cost estimate' });
  }
});

/**
 * GET /api/v1/inflation/basket/items
 * 
 * Get all tracked basket items.
 */
router.get('/basket/items', async (_req: Request, res: Response) => {
  res.json({
    categories: [
      { id: 'resident_affordability', name: 'Resident Affordability', count: ALL_BASKET_ITEMS.filter(i => i.category === 'resident_affordability').length },
      { id: 'property_operations', name: 'Property Operations', count: ALL_BASKET_ITEMS.filter(i => i.category === 'property_operations').length },
      { id: 'labor_costs', name: 'Labor Costs', count: ALL_BASKET_ITEMS.filter(i => i.category === 'labor_costs').length },
      { id: 'construction_materials', name: 'Construction Materials', count: ALL_BASKET_ITEMS.filter(i => i.category === 'construction_materials').length }
    ],
    items: ALL_BASKET_ITEMS
  });
});

/**
 * GET /api/v1/inflation/basket/items/:category
 * 
 * Get items in a category.
 */
router.get('/basket/items/:category', async (req: Request, res: Response) => {
  const { category } = req.params;
  
  const items = ALL_BASKET_ITEMS.filter(i => i.category === category);
  
  if (items.length === 0) {
    return res.status(404).json({ error: 'Category not found' });
  }
  
  res.json({ category, items });
});

/**
 * GET /api/v1/inflation/basket/price/:itemId
 * 
 * Get price history for an item.
 */
router.get('/basket/price/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { market, state, months = '24' } = req.query as {
      market?: string;
      state?: string;
      months?: string;
    };
    
    if (!market || !state) {
      return res.status(400).json({ error: 'Market and state are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getMarketBasketService(pool);
    const history = await service.getPriceHistory(itemId, market, state, parseInt(months));
    
    const item = ALL_BASKET_ITEMS.find(i => i.id === itemId);
    
    res.json({
      item,
      market,
      state,
      history
    });
  } catch (error) {
    console.error('[MarketBasket] Price history error:', error);
    res.status(500).json({ error: 'Failed to get price history' });
  }
});

/**
 * POST /api/v1/inflation/basket/price
 * 
 * Record a price observation.
 */
router.post('/basket/price', async (req: Request, res: Response) => {
  try {
    const { itemId, market, state, price, source } = req.body as {
      itemId: string;
      market: string;
      state: string;
      price: number;
      source: string;
    };
    
    if (!itemId || !market || !state || !price) {
      return res.status(400).json({ error: 'itemId, market, state, and price are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getMarketBasketService(pool);
    await service.recordPrice({ itemId, market, state, price, source: source || 'manual' });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[MarketBasket] Record price error:', error);
    res.status(500).json({ error: 'Failed to record price' });
  }
});

// ============================================================================
// REPLACEMENT COST ROUTES
// ============================================================================

/**
 * POST /api/v1/inflation/replacement-cost
 * 
 * Estimate replacement cost for a property.
 */
router.post('/replacement-cost', async (req: Request, res: Response) => {
  try {
    const { property, options } = req.body as {
      property: PropertyInput;
      options?: {
        includeLand?: boolean;
        includeDepreciation?: boolean;
        purchasePrice?: number;
        currentInsuredValue?: number;
      };
    };
    
    if (!property || !property.units || !property.totalSF) {
      return res.status(400).json({ error: 'Property with units and totalSF is required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostService(pool);
    const estimate = await service.estimateReplacementCost(property, options);
    
    res.json(estimate);
  } catch (error) {
    console.error('[ReplacementCost] Estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate replacement cost' });
  }
});

/**
 * POST /api/v1/inflation/replacement-cost/quick
 * 
 * Quick replacement cost estimate.
 */
router.post('/replacement-cost/quick', async (req: Request, res: Response) => {
  try {
    const { units, avgUnitSF, city, state, assetClass = 'B' } = req.body as {
      units: number;
      avgUnitSF: number;
      city: string;
      state: string;
      assetClass?: 'A' | 'B' | 'C';
    };
    
    if (!units || !avgUnitSF || !city || !state) {
      return res.status(400).json({ error: 'units, avgUnitSF, city, and state are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostService(pool);
    const estimate = await service.quickEstimate(units, avgUnitSF, city, state, assetClass);
    
    res.json(estimate);
  } catch (error) {
    console.error('[ReplacementCost] Quick estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate replacement cost' });
  }
});

/**
 * POST /api/v1/inflation/replacement-cost/compare
 * 
 * Compare purchase price to replacement cost.
 */
router.post('/replacement-cost/compare', async (req: Request, res: Response) => {
  try {
    const { property, purchasePrice, capRate } = req.body as {
      property: PropertyInput;
      purchasePrice: number;
      capRate: number;
    };
    
    if (!property || !purchasePrice || !capRate) {
      return res.status(400).json({ error: 'property, purchasePrice, and capRate are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostService(pool);
    const analysis = await service.analyzeReplacementVsPurchase(property, purchasePrice, capRate);
    
    res.json(analysis);
  } catch (error) {
    console.error('[ReplacementCost] Compare error:', error);
    res.status(500).json({ error: 'Failed to compare to replacement cost' });
  }
});

/**
 * POST /api/v1/inflation/replacement-cost/insurance
 * 
 * Validate insurance coverage against replacement cost.
 */
router.post('/replacement-cost/insurance', async (req: Request, res: Response) => {
  try {
    const { property, currentCoverage } = req.body as {
      property: PropertyInput;
      currentCoverage: number;
    };
    
    if (!property || !currentCoverage) {
      return res.status(400).json({ error: 'property and currentCoverage are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostService(pool);
    const validation = await service.validateInsuranceCoverage(property, currentCoverage);
    
    res.json(validation);
  } catch (error) {
    console.error('[ReplacementCost] Insurance validation error:', error);
    res.status(500).json({ error: 'Failed to validate insurance coverage' });
  }
});

// ============================================================================
// REPLACEMENT COST V2 ROUTES (Permit-Derived)
// ============================================================================

/**
 * POST /api/v1/inflation/replacement-cost/v2
 * 
 * Permit-derived replacement cost with LayeredValue provenance.
 * Uses: Permit data + BLS PPI escalation + RSMeans CCI adjustment
 */
router.post('/replacement-cost/v2', async (req: Request, res: Response) => {
  try {
    const input = req.body as ReplacementCostInput;
    
    if (!input || !input.units || !input.totalSF || !input.city || !input.state) {
      return res.status(400).json({ 
        error: 'units, totalSF, city, and state are required' 
      });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostServiceV2(pool);
    const result = await service.estimateReplacementCost(input);
    
    res.json(result);
  } catch (error) {
    console.error('[ReplacementCostV2] Estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate replacement cost' });
  }
});

/**
 * POST /api/v1/inflation/replacement-cost/v2/compare
 * 
 * Compare acquisition price to permit-derived replacement cost.
 */
router.post('/replacement-cost/v2/compare', async (req: Request, res: Response) => {
  try {
    const { property, purchasePrice, insuranceCoverage } = req.body as {
      property: ReplacementCostInput;
      purchasePrice: number;
      insuranceCoverage?: number;
    };
    
    if (!property || !purchasePrice) {
      return res.status(400).json({ error: 'property and purchasePrice are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostServiceV2(pool);
    const result = await service.compareToAcquisition(property, purchasePrice, insuranceCoverage);
    
    res.json(result);
  } catch (error) {
    console.error('[ReplacementCostV2] Compare error:', error);
    res.status(500).json({ error: 'Failed to compare to replacement cost' });
  }
});

/**
 * POST /api/v1/inflation/replacement-cost/v2/batch
 * 
 * Batch estimate for portfolio.
 */
router.post('/replacement-cost/v2/batch', async (req: Request, res: Response) => {
  try {
    const { properties } = req.body as { properties: ReplacementCostInput[] };
    
    if (!properties || !Array.isArray(properties)) {
      return res.status(400).json({ error: 'properties array is required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostServiceV2(pool);
    const results = await service.batchEstimate(properties);
    
    res.json({
      count: results.length,
      results
    });
  } catch (error) {
    console.error('[ReplacementCostV2] Batch error:', error);
    res.status(500).json({ error: 'Failed to batch estimate' });
  }
});

/**
 * GET /api/v1/inflation/replacement-cost/v2/cci/:city/:state
 * 
 * Get RSMeans CCI factor for a location.
 */
router.get('/replacement-cost/v2/regional/:city/:state', async (req: Request, res: Response) => {
  try {
    const { city, state } = req.params;
    const { county } = req.query as { county?: string };
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostServiceV2(pool);
    const { factor, source, methodology } = await service.getRegionalFactorForLocation(city, state, county);
    
    res.json({
      location: `${city}, ${state}`,
      county,
      factor,
      nationalBaseline: 100,
      interpretation: factor > 100 
        ? `Construction costs ${(factor - 100).toFixed(1)}% above national average`
        : factor < 100
        ? `Construction costs ${(100 - factor).toFixed(1)}% below national average`
        : 'At national average',
      source,
      methodology
    });
  } catch (error) {
    console.error('[ReplacementCostV2] Regional factor lookup error:', error);
    res.status(500).json({ error: 'Failed to get regional factor' });
  }
});

/**
 * POST /api/v1/inflation/replacement-cost/renovation
 * 
 * Estimate renovation/value-add costs.
 */
router.post('/replacement-cost/renovation', async (req: Request, res: Response) => {
  try {
    const { property, scope } = req.body as {
      property: PropertyInput;
      scope: {
        unitInteriors?: 'light' | 'standard' | 'full';
        unitsToRenovate?: number;
        commonAreas?: boolean;
        amenityUpgrades?: string[];
        exterior?: boolean;
        roofing?: boolean;
        hvac?: boolean;
        plumbing?: boolean;
        electrical?: boolean;
      };
    };
    
    if (!property || !scope) {
      return res.status(400).json({ error: 'property and scope are required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getReplacementCostService(pool);
    const estimate = await service.estimateRenovationCost(property, scope);
    
    res.json(estimate);
  } catch (error) {
    console.error('[ReplacementCost] Renovation estimate error:', error);
    res.status(500).json({ error: 'Failed to estimate renovation cost' });
  }
});

/**
 * POST /api/v1/inflation/basket/prices
 * 
 * Record multiple price observations.
 */
router.post('/basket/prices', async (req: Request, res: Response) => {
  try {
    const { prices } = req.body as {
      prices: Array<{
        itemId: string;
        market: string;
        state: string;
        price: number;
        source?: string;
      }>;
    };
    
    if (!prices || !Array.isArray(prices)) {
      return res.status(400).json({ error: 'prices array is required' });
    }
    
    const pool = req.app.get('pool');
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    const service = getMarketBasketService(pool);
    
    let recorded = 0;
    let failed = 0;
    
    for (const p of prices) {
      try {
        await service.recordPrice({
          itemId: p.itemId,
          market: p.market,
          state: p.state,
          price: p.price,
          source: p.source || 'manual'
        });
        recorded++;
      } catch {
        failed++;
      }
    }
    
    res.json({ success: true, recorded, failed });
  } catch (error) {
    console.error('[MarketBasket] Bulk record error:', error);
    res.status(500).json({ error: 'Failed to record prices' });
  }
});

export default router;
