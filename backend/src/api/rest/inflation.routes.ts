/**
 * Inflation Engine API Routes
 * 
 * JediRe proprietary inflation tracking for multifamily real estate.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getInflationEngineService } from '../../services/inflation';

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

export default router;
