/**
 * M28 Cycle Intelligence REST API
 * Routes for market cycle data, predictions, and pattern matching
 */

import { Router, Request, Response } from 'express';
import { cycleIntelligenceService } from '../../services/cycle-intelligence.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// Core Cycle Data
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/phase/:marketId
 * Get current cycle phase for a market
 */
router.get('/phase/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const snapshot = await cycleIntelligenceService.getCyclePhase(marketId);
    
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'No cycle data found for this market',
      });
    }
    
    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Error fetching cycle phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cycle phase',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/phases
 * Get cycle phases for multiple markets
 * Query params: marketIds (comma-separated)
 */
router.get('/phases', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const marketIds = (req.query.marketIds as string)?.split(',') || [];
    
    if (marketIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'marketIds query parameter required',
      });
    }
    
    const snapshots = await cycleIntelligenceService.getCyclePhases(marketIds);
    
    res.json({
      success: true,
      data: snapshots,
      count: snapshots.length,
    });
  } catch (error) {
    console.error('Error fetching cycle phases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cycle phases',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/divergence/:marketId
 * Get leading-lagging divergence signal
 */
router.get('/divergence/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const divergence = await cycleIntelligenceService.getDivergence(marketId);
    
    if (!divergence) {
      return res.status(404).json({
        success: false,
        error: 'No divergence data found for this market',
      });
    }
    
    res.json({
      success: true,
      data: divergence,
    });
  } catch (error) {
    console.error('Error fetching divergence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch divergence',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Rate Environment
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/rate-environment
 * Get current rate environment
 */
router.get('/rate-environment', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rateEnv = await cycleIntelligenceService.getRateEnvironment();
    
    if (!rateEnv) {
      return res.status(404).json({
        success: false,
        error: 'No rate environment data available',
      });
    }
    
    res.json({
      success: true,
      data: rateEnv,
    });
  } catch (error) {
    console.error('Error fetching rate environment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate environment',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/rate-history
 * Get rate environment history
 * Query params: days (default 90)
 */
router.get('/rate-history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const history = await cycleIntelligenceService.getRateHistory(days);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error fetching rate history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate history',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Leading Indicators
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/leading-indicators
 * Get leading indicators (optionally filtered by category)
 * Query params: category (optional)
 */
router.get('/leading-indicators', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const indicators = await cycleIntelligenceService.getLeadingIndicators(category);
    
    res.json({
      success: true,
      data: indicators,
      count: indicators.length,
    });
  } catch (error) {
    console.error('Error fetching leading indicators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leading indicators',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Pattern Matching
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/pattern-matches
 * Get current conditions vs historical patterns
 * Query params: limit (default 5)
 */
router.get('/pattern-matches', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const matches = await cycleIntelligenceService.getPatternMatches(limit);
    
    res.json({
      success: true,
      data: matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Error fetching pattern matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pattern matches',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/historical-event/:eventId
 * Get details of a historical event
 */
router.get('/historical-event/:eventId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const event = await cycleIntelligenceService.getHistoricalEvent(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Historical event not found',
      });
    }
    
    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Error fetching historical event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical event',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Predictions
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/predict/rent-growth/:marketId
 * Predict rent growth for a market
 * Query params: horizonMonths (default 12)
 */
router.get('/predict/rent-growth/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const horizonMonths = parseInt(req.query.horizonMonths as string) || 12;
    
    const forecast = await cycleIntelligenceService.predictRentGrowth(marketId, horizonMonths);
    
    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('Error predicting rent growth:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict rent growth',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/predict/value-change/:marketId
 * Predict value change for a market
 * Query params: horizonMonths (default 12)
 */
router.get('/predict/value-change/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const horizonMonths = parseInt(req.query.horizonMonths as string) || 12;
    
    const forecast = await cycleIntelligenceService.getValueForecast(marketId, horizonMonths);
    
    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('Error predicting value change:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict value change',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/predict/cap-rate/:marketId
 * Predict cap rate movement
 * Query params: horizonMonths (default 12)
 */
router.get('/predict/cap-rate/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const horizonMonths = parseInt(req.query.horizonMonths as string) || 12;
    
    const forecast = await cycleIntelligenceService.predictCapRateMovement(marketId, horizonMonths);
    
    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('Error predicting cap rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict cap rate',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/predict/full-chain/:marketId
 * Full chain prediction: Fed cut → Value change
 * Query params: ffrChangeBps (default -100)
 */
router.get('/predict/full-chain/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const ffrChangeBps = parseInt(req.query.ffrChangeBps as string) || -100;
    
    const prediction = await cycleIntelligenceService.predictFullChain(marketId, ffrChangeBps);
    
    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('Error predicting full chain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict full chain',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Composite Outputs
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/phase-optimal-strategy/:marketId
 * Get phase-optimal strategy for current conditions
 */
router.get('/phase-optimal-strategy/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const strategy = await cycleIntelligenceService.getPhaseOptimalStrategy(marketId);
    
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'No strategy data found for this market',
      });
    }
    
    res.json({
      success: true,
      data: strategy,
    });
  } catch (error) {
    console.error('Error fetching phase-optimal strategy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch phase-optimal strategy',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/construction-cost-index/:marketId
 * Get construction cost index with tariff overlay
 */
router.get('/construction-cost-index/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const index = await cycleIntelligenceService.getConstructionCostIndex(marketId);
    
    res.json({
      success: true,
      data: index,
    });
  } catch (error) {
    console.error('Error fetching construction cost index:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch construction cost index',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/macro-risk
 * Get current macro risk score
 */
router.get('/macro-risk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const risk = await cycleIntelligenceService.getMacroRiskScore();
    
    res.json({
      success: true,
      data: risk,
    });
  } catch (error) {
    console.error('Error fetching macro risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch macro risk',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/market-metrics-history/:marketId
 * Get historical lagging metrics for a market
 * Query params: quarters (default 8)
 */
router.get('/market-metrics-history/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const quarters = parseInt(req.query.quarters as string) || 8;
    
    const history = await cycleIntelligenceService.getMarketMetricsHistory(marketId, quarters);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error fetching market metrics history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market metrics history',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/deal-performance-by-phase/:marketId
 * Get historical deal performance by acquisition phase
 */
router.get('/deal-performance-by-phase/:marketId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { marketId } = req.params;
    const performance = await cycleIntelligenceService.getDealPerformanceByPhase(marketId);
    
    res.json({
      success: true,
      data: performance,
      count: performance.length,
    });
  } catch (error) {
    console.error('Error fetching deal performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deal performance',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Test Endpoints (No Auth Required)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/cycle-intelligence/test/rate-environment
 * Test endpoint - Get current rate environment without auth
 */
router.get('/test/rate-environment', async (req: Request, res: Response) => {
  try {
    const rateEnv = await cycleIntelligenceService.getRateEnvironment();
    
    res.json({
      success: true,
      data: rateEnv,
      note: 'This is a test endpoint. Production endpoints require authentication.',
    });
  } catch (error) {
    console.error('Error fetching rate environment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rate environment',
    });
  }
});

/**
 * GET /api/v1/cycle-intelligence/test/leading-indicators
 * Test endpoint - Get recent leading indicators without auth
 */
router.get('/test/leading-indicators', async (req: Request, res: Response) => {
  try {
    const indicators = await cycleIntelligenceService.getLeadingIndicators();
    
    res.json({
      success: true,
      data: indicators,
      count: indicators.length,
      note: 'This is a test endpoint. Production endpoints require authentication.',
    });
  } catch (error) {
    console.error('Error fetching leading indicators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leading indicators',
    });
  }
});

export default router;
