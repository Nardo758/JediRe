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
        development_type,
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

    // Determine mode: existing vs development vs redevelopment
    // Note: redevelopment is preserved as a distinct value, not collapsed to 'existing'
    const modeValue = deal.project_type === 'development' ? 'development'
                     : deal.project_type === 'redevelopment' ? 'redevelopment'
                     : 'existing';

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
      mode: modeValue,
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
      projectType: deal.project_type || 'existing',
      developmentType: deal.development_type || null,
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
    const { trigger, assumptions, unitMix } = req.body;

    logger.info(`[Recompute] Triggered for deal ${dealId}`, { trigger });

    if (!assumptions) {
      return res.status(400).json({ success: false, error: 'assumptions required' });
    }

    const {
      rentGrowth = 0.03,
      expenseGrowth = 0.025,
      vacancy = 0.05,
      exitCapRate = 0.06,
      holdPeriod = 5,
      capexPerUnit = 3000,
      managementFee = 0.04,
    } = assumptions;

    const totalUnits = unitMix?.length
      ? unitMix.reduce((s: number, r: any) => s + (r.units ?? 0), 0)
      : 200;
    const avgMarketRent = unitMix?.length
      ? unitMix.reduce((s: number, r: any) => s + (r.marketRent ?? 1500) * (r.units ?? 0), 0) / Math.max(1, totalUnits)
      : 1500;

    const grossPotentialRent = avgMarketRent * totalUnits * 12;
    const effectiveGrossIncome = grossPotentialRent * (1 - vacancy);
    const totalExpenses = effectiveGrossIncome * (managementFee + 0.25);
    const totalCapex = capexPerUnit * totalUnits;
    const yearOneNOI = effectiveGrossIncome - totalExpenses - (totalCapex / holdPeriod);

    const holdQuarters = holdPeriod * 4;
    let noiMult = 1;
    for (let q = 0; q < holdQuarters; q++) {
      noiMult *= 1 + rentGrowth / 4;
    }
    const expenseMult = Math.pow(1 + expenseGrowth, holdPeriod);

    const exitNOI = grossPotentialRent * noiMult * (1 - vacancy)
      - (totalExpenses * expenseMult)
      - (totalCapex / holdPeriod);
    const grossSaleValue = exitNOI / Math.max(exitCapRate, 0.01);
    const sellingCosts = grossSaleValue * 0.02;

    const acquisitionPrice = yearOneNOI / Math.max(exitCapRate + 0.005, 0.01);
    const equityInvested = acquisitionPrice * 0.35;
    const loanBalance = acquisitionPrice * 0.65;
    const annualDebtService = loanBalance * 0.065;

    let totalCashFlow = 0;
    for (let y = 0; y < holdPeriod; y++) {
      const yearNOI = yearOneNOI * Math.pow(1 + rentGrowth, y);
      const yearExpenseAdj = totalExpenses * Math.pow(1 + expenseGrowth, y) - totalExpenses;
      totalCashFlow += yearNOI - yearExpenseAdj - annualDebtService;
    }

    const netProceeds = grossSaleValue - sellingCosts - loanBalance;
    const totalReturn = totalCashFlow + netProceeds;
    const equityMultiple = equityInvested > 0 ? totalReturn / equityInvested : 0;
    const irr = holdPeriod > 0 && equityInvested > 0
      ? (Math.pow(Math.max(0.01, totalReturn / equityInvested), 1 / holdPeriod) - 1) * 100
      : 0;
    const cashOnCash = equityInvested > 0 ? ((yearOneNOI - annualDebtService) / equityInvested) * 100 : 0;

    const clampedIRR = Math.max(0, Math.min(50, irr));
    const clampedEM = Math.max(0, Math.min(10, equityMultiple));
    const clampedCoC = Math.max(-10, Math.min(30, cashOnCash));

    const irrScore = Math.min(35, clampedIRR * 2);
    const emScore = Math.min(25, clampedEM * 10);
    const cocScore = Math.min(15, clampedCoC * 1.5);
    const riskAdj = vacancy > 0.08 ? -5 : vacancy < 0.03 ? 3 : 0;
    const capRateAdj = exitCapRate > 0.08 ? -3 : exitCapRate < 0.045 ? 5 : 0;
    const overallJedi = Math.max(0, Math.min(100,
      irrScore + emScore + cocScore + 20 + riskAdj + capRateAdj
    ));

    const now = new Date().toISOString();

    const financial = {
      assumptions: {
        rentGrowth: { value: rentGrowth },
        expenseGrowth: { value: expenseGrowth },
        vacancy: { value: vacancy },
        exitCapRate: { value: exitCapRate },
        holdPeriod: { value: holdPeriod },
        capexPerUnit: { value: capexPerUnit },
        managementFee: { value: managementFee },
      },
      returns: {
        irr: { value: clampedIRR, updatedAt: now },
        equityMultiple: { value: clampedEM, updatedAt: now },
        cashOnCash: { value: clampedCoC, updatedAt: now },
        exitNOI: { value: exitNOI, updatedAt: now },
        grossSaleValue: { value: grossSaleValue, updatedAt: now },
        netProceeds: { value: netProceeds, updatedAt: now },
        totalReturn: { value: totalReturn, updatedAt: now },
        totalCashFlow: { value: totalCashFlow, updatedAt: now },
        yearOneNOI: { value: yearOneNOI, updatedAt: now },
      },
      recomputedAt: now,
    };

    const strategyBucket =
      clampedIRR >= 18 ? 'value-add-aggressive'
      : clampedIRR >= 12 ? 'value-add'
      : clampedIRR >= 8 ? 'core-plus'
      : 'core';

    const makeStrategyScore = (
      id: string, name: string, type: string,
      fit: number, gateResult: 'PASS' | 'FAIL'
    ) => ({
      strategy_id: id,
      strategy_name: name,
      strategy_type: type,
      overall_score: fit * 100,
      sub_scores: { returns: clampedIRR, risk: 100 - vacancy * 200, leverage: clampedEM * 20 },
      gate_result: gateResult,
      gate_failures: gateResult === 'FAIL' ? [`IRR below ${type} threshold`] : [],
      soft_penalty: 0,
      confidence: 0.75,
      is_system_template: true,
      roi_estimate: { irr: clampedIRR, em: clampedEM, coc: clampedCoC },
    });

    const strategy = {
      recommended: strategyBucket,
      scores: [
        makeStrategyScore('core', 'Core', 'rental',
          strategyBucket === 'core' ? 0.9 : 0.3,
          clampedIRR >= 4 ? 'PASS' : 'FAIL'),
        makeStrategyScore('core-plus', 'Core Plus', 'rental',
          strategyBucket === 'core-plus' ? 0.85 : 0.4,
          clampedIRR >= 6 ? 'PASS' : 'FAIL'),
        makeStrategyScore('value-add', 'Value Add', 'rental',
          strategyBucket === 'value-add' ? 0.8 : 0.35,
          clampedIRR >= 10 ? 'PASS' : 'FAIL'),
        makeStrategyScore('va-aggressive', 'Value Add Aggressive', 'rental',
          strategyBucket === 'value-add-aggressive' ? 0.75 : 0.2,
          clampedIRR >= 15 ? 'PASS' : 'FAIL'),
      ],
      arbitrageGap: clampedIRR - (exitCapRate * 100),
      arbitrageAlert: clampedIRR - (exitCapRate * 100) > 5,
      recomputedAt: now,
    };

    const scores = {
      overall: overallJedi,
      demand: Math.min(100, irrScore + emScore),
      supply: Math.min(100, 50 + capRateAdj * 5),
      momentum: Math.min(100, cocScore * 3),
      position: Math.min(100, 40 + riskAdj * 3),
      risk: Math.max(0, 100 - (vacancy * 200) - (exitCapRate > 0.08 ? 20 : 0)),
      confidence: 0.75,
      verdict: overallJedi >= 70 ? 'Strong Buy' : overallJedi >= 50 ? 'Buy' : overallJedi >= 30 ? 'Neutral' : 'Caution',
      recomputedAt: now,
    };

    const riskLevel = vacancy > 0.10 ? 'high'
      : exitCapRate > 0.09 ? 'elevated'
      : clampedIRR < 6 ? 'elevated'
      : 'moderate';

    const risk = {
      level: riskLevel,
      factors: {
        vacancyRisk: vacancy > 0.08 ? 'high' : vacancy > 0.05 ? 'moderate' : 'low',
        capRateRisk: exitCapRate > 0.08 ? 'elevated' : 'stable',
        returnRisk: clampedIRR < 8 ? 'below-threshold' : 'acceptable',
      },
      recomputedAt: now,
    };

    logger.info(`[Recompute] Complete for deal ${dealId}: IRR=${clampedIRR.toFixed(1)}%, EM=${clampedEM.toFixed(2)}x, JEDI=${overallJedi.toFixed(0)}`);

    res.json({ financial, strategy, scores, risk });
  } catch (error: any) {
    logger.error('Error in recompute:', error);
    res.status(500).json({ success: false, error: 'Recompute failed' });
  }
});

export default router;
