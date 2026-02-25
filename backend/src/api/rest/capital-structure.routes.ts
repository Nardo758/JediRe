/**
 * Capital Structure Engine API Routes
 *
 * REST endpoints for capital stack design, debt product selection,
 * rate environment, equity waterfall, scenario comparison, and lifecycle.
 */

import { Router, Request, Response } from 'express';
import {
  capitalStructureService,
  type CapitalLayer,
  type CapitalUses,
  type StrategyType,
  type DebtProduct,
  type EquityWaterfallConfig,
  type ScenarioInput,
} from '../../services/capital-structure.service';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// Capital Stack Endpoints
// ============================================================================

/** POST /capital-structure/stack - Build capital stack with metrics */
router.post('/stack', (req: Request, res: Response) => {
  try {
    const { dealId, strategy, layers, uses, noi, propertyValue, grossPotentialRent } = req.body;

    if (!dealId || !strategy || !layers || !uses || !noi) {
      return res.status(400).json({ error: 'Missing required fields: dealId, strategy, layers, uses, noi' });
    }

    const stack = capitalStructureService.buildCapitalStack(
      dealId,
      strategy as StrategyType,
      layers as CapitalLayer[],
      uses as CapitalUses,
      noi,
      propertyValue || 0,
      grossPotentialRent,
    );

    res.json({ stack });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Stack build failed', { error: error.message });
    res.status(500).json({ error: 'Failed to build capital stack', detail: error.message });
  }
});

/** POST /capital-structure/size-senior - Size senior debt via F40 triple constraint */
router.post('/size-senior', (req: Request, res: Response) => {
  try {
    const { totalCost, maxLTC, noi, dscrMin, propertyValue, maxLTV, interestRate, amortYears } = req.body;

    if (!totalCost || !noi || !propertyValue) {
      return res.status(400).json({ error: 'Missing required fields: totalCost, noi, propertyValue' });
    }

    const maxDebt = capitalStructureService.sizeSeniorDebt(
      totalCost,
      maxLTC || 0.75,
      noi,
      dscrMin || 1.25,
      propertyValue,
      maxLTV || 0.80,
      interestRate || 7.0,
      amortYears || 30,
    );

    res.json({ maxSeniorDebt: maxDebt });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Senior sizing failed', { error: error.message });
    res.status(500).json({ error: 'Failed to size senior debt', detail: error.message });
  }
});

/** POST /capital-structure/size-mezz - Size mezzanine via F41 */
router.post('/size-mezz', (req: Request, res: Response) => {
  try {
    const { totalCost, maxCombinedLTC, seniorDebt } = req.body;
    const maxMezz = capitalStructureService.sizeMezzanine(totalCost, maxCombinedLTC || 0.85, seniorDebt);
    res.json({ maxMezzanine: maxMezz });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Mezz sizing failed', { error: error.message });
    res.status(500).json({ error: 'Failed to size mezzanine', detail: error.message });
  }
});

/** POST /capital-structure/insights - Generate stack insights */
router.post('/insights', (req: Request, res: Response) => {
  try {
    const { metrics } = req.body;
    if (!metrics) {
      return res.status(400).json({ error: 'Missing required field: metrics' });
    }
    const insights = capitalStructureService.generateInsights(metrics);
    res.json({ insights });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Insights generation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to generate insights', detail: error.message });
  }
});

// ============================================================================
// Debt Product Endpoints
// ============================================================================

/** POST /capital-structure/debt-products/recommend - Get strategy-filtered products */
router.post('/debt-products/recommend', (req: Request, res: Response) => {
  try {
    const { strategy, products } = req.body;
    if (!strategy || !products) {
      return res.status(400).json({ error: 'Missing required fields: strategy, products' });
    }
    const result = capitalStructureService.getRecommendedProducts(strategy as StrategyType, products as DebtProduct[]);
    res.json(result);
  } catch (error: any) {
    logger.error('[CapStructure Routes] Product recommendation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to recommend products', detail: error.message });
  }
});

/** POST /capital-structure/debt-products/mismatch - Detect strategy/debt mismatches */
router.post('/debt-products/mismatch', (req: Request, res: Response) => {
  try {
    const { strategy, products } = req.body;
    if (!strategy || !products) {
      return res.status(400).json({ error: 'Missing required fields: strategy, products' });
    }
    const warnings = capitalStructureService.detectMismatches(strategy as StrategyType, products as DebtProduct[]);
    res.json({ warnings, count: warnings.length });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Mismatch detection failed', { error: error.message });
    res.status(500).json({ error: 'Failed to detect mismatches', detail: error.message });
  }
});

// ============================================================================
// Rate Environment Endpoints
// ============================================================================

/** POST /capital-structure/rate/cycle-phase - Classify rate cycle */
router.post('/rate/cycle-phase', (req: Request, res: Response) => {
  try {
    const { fedDirection, durationMonths, yieldCurveSlope } = req.body;
    const phase = capitalStructureService.classifyCyclePhase(fedDirection, durationMonths, yieldCurveSlope);
    res.json({ cyclePhase: phase });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Cycle phase failed', { error: error.message });
    res.status(500).json({ error: 'Failed to classify cycle phase', detail: error.message });
  }
});

/** POST /capital-structure/rate/all-in - Calculate all-in rate from index + spread */
router.post('/rate/all-in', (req: Request, res: Response) => {
  try {
    const { indexRate, spreadBps } = req.body;
    const allInRate = capitalStructureService.calcAllInRate(indexRate, spreadBps);
    res.json({ allInRate });
  } catch (error: any) {
    logger.error('[CapStructure Routes] All-in rate failed', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate all-in rate', detail: error.message });
  }
});

/** POST /capital-structure/rate/lock-vs-float - Lock vs Float analysis */
router.post('/rate/lock-vs-float', (req: Request, res: Response) => {
  try {
    const { loanAmount, lockRate, expectedFloatRates, termMonths, discountRate } = req.body;
    if (!loanAmount || !lockRate) {
      return res.status(400).json({ error: 'Missing required fields: loanAmount, lockRate' });
    }
    const analysis = capitalStructureService.analyzeLockVsFloat(
      loanAmount,
      lockRate,
      expectedFloatRates || [],
      termMonths || 36,
      discountRate || 0.05,
    );
    res.json({ analysis });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Lock vs float failed', { error: error.message });
    res.status(500).json({ error: 'Failed to analyze lock vs float', detail: error.message });
  }
});

/** POST /capital-structure/rate/sensitivity - Rate sensitivity matrix */
router.post('/rate/sensitivity', (req: Request, res: Response) => {
  try {
    const { loanAmount, holdYears, bpsSteps } = req.body;
    if (!loanAmount) {
      return res.status(400).json({ error: 'Missing required field: loanAmount' });
    }
    const matrix = capitalStructureService.calcRateSensitivityMatrix(loanAmount, holdYears || 5, bpsSteps);
    res.json({ sensitivityMatrix: matrix });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Rate sensitivity failed', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate rate sensitivity', detail: error.message });
  }
});

/** POST /capital-structure/rate/spread-percentile - Spread vs historical */
router.post('/rate/spread-percentile', (req: Request, res: Response) => {
  try {
    const { currentSpread, fiveYearMin, fiveYearMax } = req.body;
    const percentile = capitalStructureService.calcSpreadPercentile(currentSpread, fiveYearMin, fiveYearMax);
    res.json({ percentile });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Spread percentile failed', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate spread percentile', detail: error.message });
  }
});

// ============================================================================
// Equity Waterfall Endpoints
// ============================================================================

/** POST /capital-structure/waterfall - Calculate full waterfall distribution */
router.post('/waterfall', (req: Request, res: Response) => {
  try {
    const { config, exitProceeds, holdYears, annualCashFlows } = req.body;
    if (!config || !exitProceeds) {
      return res.status(400).json({ error: 'Missing required fields: config, exitProceeds' });
    }
    const result = capitalStructureService.calculateWaterfall(
      config as EquityWaterfallConfig,
      exitProceeds,
      holdYears || 5,
      annualCashFlows || [],
    );
    res.json({ waterfall: result });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Waterfall calculation failed', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate waterfall', detail: error.message });
  }
});

// ============================================================================
// Scenario Comparison Endpoints
// ============================================================================

/** POST /capital-structure/scenarios/compare - Compare multiple scenarios */
router.post('/scenarios/compare', (req: Request, res: Response) => {
  try {
    const { scenarios, noi, propertyValue } = req.body;
    if (!scenarios || !noi) {
      return res.status(400).json({ error: 'Missing required fields: scenarios, noi' });
    }
    const comparison = capitalStructureService.compareScenarios(
      scenarios as ScenarioInput[],
      noi,
      propertyValue || 0,
    );
    res.json({ comparison });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Scenario comparison failed', { error: error.message });
    res.status(500).json({ error: 'Failed to compare scenarios', detail: error.message });
  }
});

// ============================================================================
// Debt Lifecycle Endpoints
// ============================================================================

/** POST /capital-structure/lifecycle/refi - Calculate refinance proceeds */
router.post('/lifecycle/refi', (req: Request, res: Response) => {
  try {
    const { stabilizedValue, refiLTV, existingDebt } = req.body;
    if (!stabilizedValue || !existingDebt) {
      return res.status(400).json({ error: 'Missing required fields: stabilizedValue, existingDebt' });
    }
    const proceeds = capitalStructureService.calcRefiProceeds(stabilizedValue, refiLTV || 0.75, existingDebt);
    res.json({ refiProceeds: proceeds, cashOut: proceeds > 0 });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Refi proceeds failed', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate refi proceeds', detail: error.message });
  }
});

/** POST /capital-structure/lifecycle/draw-progress - Construction draw progress */
router.post('/lifecycle/draw-progress', (req: Request, res: Response) => {
  try {
    const { draws, totalCommitment } = req.body;
    if (!totalCommitment) {
      return res.status(400).json({ error: 'Missing required field: totalCommitment' });
    }
    const progress = capitalStructureService.calcDrawProgress(draws || [], totalCommitment);
    res.json({ drawProgress: progress });
  } catch (error: any) {
    logger.error('[CapStructure Routes] Draw progress failed', { error: error.message });
    res.status(500).json({ error: 'Failed to calculate draw progress', detail: error.message });
  }
});

export default router;
