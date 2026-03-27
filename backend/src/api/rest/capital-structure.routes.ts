/**
 * Capital Structure Engine API Routes
 *
 * REST endpoints for capital stack design, debt product selection,
 * rate environment, equity waterfall, scenario comparison, and lifecycle.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import Decimal from 'decimal.js';
import {
  capitalStructureService,
  type CapitalLayer,
  type CapitalUses,
  type StrategyType,
  type DebtProduct,
  type EquityWaterfallConfig,
  type ScenarioInput,
} from '../../services/capital-structure.service';
import { fetchLiveRates, fetchRateHistory } from '../../services/rate-index.service';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'rate-sheets'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

// ============================================================================
// Input Validation Helpers
// ============================================================================

/**
 * Validate that financial amount is a string (for PostgreSQL NUMERIC precision)
 */
function validateFinancialString(value: any, fieldName: string): string {
  if (typeof value === 'string') {
    // Verify it's a valid numeric string
    try {
      new Decimal(value);
      return value;
    } catch {
      throw new Error(`${fieldName} must be a valid numeric string (e.g., "2500000.50"), got: ${value}`);
    }
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  throw new Error(`${fieldName} must be a string or number, got: ${typeof value}`);
}

/**
 * Validate CapitalLayer fields are strings
 */
function validateCapitalLayer(layer: any): CapitalLayer {
  if (!layer.id || !layer.name || !layer.layerType || !layer.term) {
    throw new Error('Layer must have: id, name, layerType, term');
  }
  return {
    ...layer,
    amount: validateFinancialString(layer.amount, 'Layer.amount'),
    rate: validateFinancialString(layer.rate, 'Layer.rate'),
  };
}

/**
 * Validate CapitalUses fields are strings
 */
function validateCapitalUses(uses: any): CapitalUses {
  return {
    acquisitionPrice: validateFinancialString(uses.acquisitionPrice, 'Uses.acquisitionPrice'),
    closingCosts: validateFinancialString(uses.closingCosts, 'Uses.closingCosts'),
    renovationBudget: validateFinancialString(uses.renovationBudget, 'Uses.renovationBudget'),
    carryingCosts: validateFinancialString(uses.carryingCosts, 'Uses.carryingCosts'),
    reserves: validateFinancialString(uses.reserves, 'Uses.reserves'),
    developerFee: validateFinancialString(uses.developerFee, 'Uses.developerFee'),
    total: validateFinancialString(uses.total, 'Uses.total'),
  };
}

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

    if (!Array.isArray(layers)) {
      return res.status(400).json({ error: 'layers must be an array' });
    }

    // Validate and convert financial fields to strings for precision
    try {
      const validatedLayers = layers.map(validateCapitalLayer);
      const validatedUses = validateCapitalUses(uses);

      const stack = capitalStructureService.buildCapitalStack(
        dealId,
        strategy as StrategyType,
        validatedLayers,
        validatedUses,
        noi,
        propertyValue || 0,
        grossPotentialRent,
      );

      res.json({ stack });
    } catch (validationError: any) {
      return res.status(400).json({ error: validationError.message });
    }
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

// ============================================================================
// Live Index Rate Endpoints
// ============================================================================

router.get('/rates/live', async (_req: Request, res: Response) => {
  try {
    const rates = await fetchLiveRates();
    res.json(rates);
  } catch (error: any) {
    logger.error('[CapStructure Routes] Live rates failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch live rates', detail: error.message });
  }
});

router.get('/rates/history', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '2y';
    if (!['6m', '1y', '2y'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use 6m, 1y, or 2y' });
    }
    const history = await fetchRateHistory(period);
    res.json(history);
  } catch (error: any) {
    logger.error('[CapStructure Routes] Rate history failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch rate history', detail: error.message });
  }
});

// ============================================================================
// Rate Sheet Upload Endpoints
// ============================================================================

router.post('/rate-sheet/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const dealId = req.body.dealId;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!dealId) {
      return res.status(400).json({ error: 'Missing dealId' });
    }

    const { parseRateSheet } = await import('../../services/rate-sheet-parser.service');
    const result = await parseRateSheet(file.path, file.originalname, dealId);
    res.json(result);
  } catch (error: any) {
    logger.error('[CapStructure Routes] Rate sheet upload failed', { error: error.message });
    res.status(500).json({ error: 'Failed to parse rate sheet', detail: error.message });
  }
});

router.get('/rate-sheet/:dealId/latest', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { getRateSheetLatest } = await import('../../services/rate-sheet-parser.service');
    const result = await getRateSheetLatest(dealId);
    if (!result) {
      return res.status(404).json({ error: 'No rate sheet found for this deal' });
    }
    res.json(result);
  } catch (error: any) {
    logger.error('[CapStructure Routes] Rate sheet fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch rate sheet', detail: error.message });
  }
});

// ============================================================================
// AI Optimal Strategy Endpoint
// ============================================================================

router.post('/optimal-strategy', async (req: Request, res: Response) => {
  res.status(202).json({ success: true, message: 'Optimal strategy computation queued' });
  try {
    const { noi, debtService, acquisitionPrice } = req.body;

    // Validate financial inputs are properly formatted
    if (typeof noi !== 'number' && typeof noi !== 'string') {
      return res.status(400).json({
        error: 'Financial inputs must be strings (e.g., "2500000.50") or numbers',
        example: { noi: '2500000.50', debtService: '150000.00', acquisitionPrice: '15000000.00' }
      });
    }

    const { getOptimalStrategy } = await import('../../services/rate-index.service');
    const liveRates = await fetchLiveRates();

    // Convert numeric values to strings for precision
    const requestPayload = {
      ...req.body,
      noi: typeof noi === 'number' ? noi.toString() : noi,
      debtService: typeof debtService === 'number' ? debtService.toString() : debtService,
      acquisitionPrice: typeof acquisitionPrice === 'number' ? acquisitionPrice.toString() : acquisitionPrice,
    };

    const result = await getOptimalStrategy(requestPayload, liveRates);
    res.json(result);
  } catch (error: any) {
    logger.error('[CapStructure Routes] Optimal strategy failed', { error: error.message });
  }
});

// ============================================================================
// Deal Capital Structure Lookup (persisted deal_data)
// ============================================================================

/** GET /capital-structure/:dealId - Return capital layers stored in deal_data */
router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT purchase_price, loan_amount, loan_to_value, interest_rate, noi, deal_data
       FROM deals WHERE id = $1`,
      [dealId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const row = result.rows[0];
    const dealData = row.deal_data || {};

    const purchasePrice: number = parseFloat(row.purchase_price) || 0;
    const loanAmount: number = parseFloat(row.loan_amount) || 0;
    const ltv: number = parseFloat(row.loan_to_value) || 0;
    const interestRate: number = parseFloat(row.interest_rate) || 0;
    const noi: number = parseFloat(row.noi) || 0;
    const equityAmount = Math.max(0, purchasePrice - loanAmount);

    const layers: any[] = [];

    if (loanAmount > 0) {
      layers.push({
        id: 'senior',
        name: 'Senior Debt',
        layerType: 'senior',
        amount: loanAmount.toString(),
        rate: interestRate > 0 ? interestRate.toString() : '—',
        ltv: ltv > 0 ? `${(ltv * 100).toFixed(1)}%` : '—',
        term: dealData.loanTerm || '5yr',
      });
    }

    const mezzAmount: number =
      parseFloat(dealData?.capitalStack?.mezz) ||
      parseFloat(dealData?.financing?.mezzanine) ||
      0;

    if (mezzAmount > 0) {
      layers.push({
        id: 'mezz',
        name: 'Mezzanine',
        layerType: 'mezz',
        amount: mezzAmount.toString(),
        rate: dealData?.capitalStack?.mezzRate || dealData?.financing?.mezzRate || '—',
        term: dealData?.capitalStack?.mezzTerm || '3yr',
      });
    }

    if (equityAmount > 0) {
      layers.push({
        id: 'equity',
        name: 'Equity',
        layerType: 'equity',
        amount: equityAmount.toString(),
        rate: '—',
        term: '—',
      });
    }

    return res.json({
      dealId,
      layers,
      summary: {
        purchasePrice,
        loanAmount,
        equityAmount,
        mezzAmount: mezzAmount || null,
        ltv,
        interestRate,
        noi,
        dscr: noi > 0 && loanAmount > 0 && interestRate > 0
          ? noi / (loanAmount * (interestRate / 100))
          : null,
      },
    });
  } catch (error: any) {
    logger.error('[CapStructure Routes] GET /:dealId failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch capital structure', detail: error.message });
  }
});

export default router;
