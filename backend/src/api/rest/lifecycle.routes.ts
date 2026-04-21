/**
 * Lifecycle API Routes
 * 
 * Full deal lifecycle management:
 * - Disposition tracking
 * - Reforecast automation  
 * - Debt & refinance management
 * - Competitive set monitoring
 * - CapEx tracking
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';

// Service imports
import {
  recordDisposition,
  recordCashFlows,
  getDispositionLearnings,
  getExitPerformanceStats,
} from '../../services/disposition.service';

import {
  computeReforecast,
  getProjectedVsActual,
  checkReforecastTriggers,
  getReforecastHistory,
} from '../../services/reforecast.service';

import {
  upsertDebtPosition,
  getDebtPositions,
  updateCovenantCompliance,
  runRefiTest,
  recordRefinance,
  getUpcomingMaturities,
  getPortfolioDebtSummary,
} from '../../services/debt-tracking.service';

import {
  addToCompSet,
  getCompSet,
  deactivateComp,
  recordPricingSnapshot,
  getPricingAlerts,
  acknowledgePricingAlert,
  getCompPricingHistory,
  getCompetitivePosition,
} from '../../services/competitive-set.service';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// DISPOSITION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/lifecycle/:dealId/dispositions
 * Get all dispositions recorded for a deal
 */
router.get('/:dealId/dispositions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM dispositions WHERE deal_id = $1 ORDER BY closing_date DESC`,
      [req.params.dealId]
    );
    res.json({ success: true, dispositions: result.rows });
  } catch (err) {
    logger.error('Get dispositions error:', err);
    res.status(500).json({ success: false, error: 'Failed to get dispositions' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/disposition
 * Record a disposition (sale) event
 */
router.post('/:dealId/disposition', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    data.dealId = req.params.dealId;
    data.closingDate = new Date(data.closingDate);
    if (data.listingDate) data.listingDate = new Date(data.listingDate);
    if (data.underContractDate) data.underContractDate = new Date(data.underContractDate);
    
    const id = await recordDisposition(data);
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Record disposition error:', err);
    res.status(500).json({ success: false, error: 'Failed to record disposition' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/cash-flows
 * Record cash flows for IRR calculation
 */
router.post('/:dealId/cash-flows', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cashFlows } = req.body;
    if (!Array.isArray(cashFlows)) {
      return res.status(400).json({ success: false, error: 'cashFlows array required' });
    }
    
    const flows = cashFlows.map(cf => ({
      ...cf,
      flowDate: new Date(cf.flowDate),
    }));
    
    await recordCashFlows(req.params.dealId, flows);
    res.json({ success: true });
  } catch (err) {
    logger.error('Record cash flows error:', err);
    res.status(500).json({ success: false, error: 'Failed to record cash flows' });
  }
});

/**
 * GET /api/v1/lifecycle/dispositions/learnings
 * Get disposition learnings for calibration
 */
router.get('/dispositions/learnings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { state, msa, asset_class, min_hold, max_hold } = req.query;
    const learnings = await getDispositionLearnings({
      state: state as string | undefined,
      msa: msa as string | undefined,
      assetClass: asset_class as string | undefined,
      minHoldPeriod: min_hold ? parseInt(min_hold as string) : undefined,
      maxHoldPeriod: max_hold ? parseInt(max_hold as string) : undefined,
    });
    res.json({ success: true, learnings });
  } catch (err) {
    logger.error('Get disposition learnings error:', err);
    res.status(500).json({ success: false, error: 'Failed to get learnings' });
  }
});

/**
 * GET /api/v1/lifecycle/dispositions/stats
 * Get portfolio-wide exit performance statistics
 */
router.get('/dispositions/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getExitPerformanceStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.error('Get exit stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// REFORECAST ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/lifecycle/:dealId/reforecast
 * Compute a new reforecast
 */
router.post('/:dealId/reforecast', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { triggerReason } = req.body;
    const result = await computeReforecast(req.params.dealId, triggerReason ?? 'manual');
    
    if (!result) {
      return res.json({ success: false, message: 'Insufficient data for reforecast' });
    }
    
    res.json({ success: true, reforecast: result });
  } catch (err) {
    logger.error('Compute reforecast error:', err);
    res.status(500).json({ success: false, error: 'Failed to compute reforecast' });
  }
});

/**
 * GET /api/v1/lifecycle/:dealId/projected-vs-actual
 * Get projected vs actual time series
 */
router.get('/:dealId/projected-vs-actual', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { metric = 'noi' } = req.query;
    const data = await getProjectedVsActual(req.params.dealId, metric as string);
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Get projected vs actual error:', err);
    res.status(500).json({ success: false, error: 'Failed to get data' });
  }
});

/**
 * GET /api/v1/lifecycle/:dealId/reforecast/triggers
 * Check if reforecast is needed
 */
router.get('/:dealId/reforecast/triggers', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await checkReforecastTriggers(req.params.dealId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Check reforecast triggers error:', err);
    res.status(500).json({ success: false, error: 'Failed to check triggers' });
  }
});

/**
 * GET /api/v1/lifecycle/:dealId/reforecast/history
 * Get reforecast history
 */
router.get('/:dealId/reforecast/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const history = await getReforecastHistory(req.params.dealId);
    res.json({ success: true, history });
  } catch (err) {
    logger.error('Get reforecast history error:', err);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DEBT & REFINANCE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/lifecycle/:dealId/debt
 * Get all debt positions for a deal
 */
router.get('/:dealId/debt', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const positions = await getDebtPositions(req.params.dealId);
    res.json({ success: true, positions });
  } catch (err) {
    logger.error('Get debt positions error:', err);
    res.status(500).json({ success: false, error: 'Failed to get debt positions' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/debt
 * Create or update a debt position
 */
router.post('/:dealId/debt', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    data.dealId = req.params.dealId;
    data.originationDate = new Date(data.originationDate);
    data.maturityDate = new Date(data.maturityDate);
    
    const id = await upsertDebtPosition(data);
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Upsert debt position error:', err);
    res.status(500).json({ success: false, error: 'Failed to save debt position' });
  }
});

/**
 * POST /api/v1/lifecycle/debt/:debtId/covenant-check
 * Update covenant compliance status
 */
router.post('/debt/:debtId/covenant-check', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentDscr, currentLtv, currentDebtYield } = req.body;
    const result = await updateCovenantCompliance(
      req.params.debtId,
      currentDscr,
      currentLtv,
      currentDebtYield
    );
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Covenant check error:', err);
    res.status(500).json({ success: false, error: 'Failed to check covenants' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/refi-test
 * Run a refinance test scenario
 */
router.post('/:dealId/refi-test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scenario = {
      ...req.body,
      dealId: req.params.dealId,
      testDate: new Date(req.body.testDate ?? new Date()),
    };
    const result = await runRefiTest(scenario);
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Refi test error:', err);
    res.status(500).json({ success: false, error: 'Failed to run refi test' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/refinance
 * Record a refinance event
 */
router.post('/:dealId/refinance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { oldDebtId, newDebtId, refiDate, closingCosts, refiRationale } = req.body;
    const id = await recordRefinance(
      req.params.dealId,
      oldDebtId,
      newDebtId,
      new Date(refiDate),
      closingCosts,
      refiRationale
    );
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Record refinance error:', err);
    res.status(500).json({ success: false, error: 'Failed to record refinance' });
  }
});

/**
 * GET /api/v1/lifecycle/debt/maturities
 * Get upcoming loan maturities across portfolio
 */
router.get('/debt/maturities', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { months = '24' } = req.query;
    const maturities = await getUpcomingMaturities(parseInt(months as string));
    res.json({ success: true, maturities });
  } catch (err) {
    logger.error('Get maturities error:', err);
    res.status(500).json({ success: false, error: 'Failed to get maturities' });
  }
});

/**
 * GET /api/v1/lifecycle/debt/summary
 * Get portfolio-wide debt summary
 */
router.get('/debt/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await getPortfolioDebtSummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    logger.error('Get debt summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// COMPETITIVE SET ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/lifecycle/:dealId/comp-set
 * Get competitive set for a deal
 */
router.get('/:dealId/comp-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeInactive = 'false' } = req.query;
    const comps = await getCompSet(req.params.dealId, includeInactive === 'true');
    res.json({ success: true, comps });
  } catch (err) {
    logger.error('Get comp set error:', err);
    res.status(500).json({ success: false, error: 'Failed to get comp set' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/comp-set
 * Add a property to the competitive set
 */
router.post('/:dealId/comp-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const comp = {
      ...req.body,
      dealId: req.params.dealId,
    };
    const id = await addToCompSet(comp);
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Add to comp set error:', err);
    res.status(500).json({ success: false, error: 'Failed to add comp' });
  }
});

/**
 * DELETE /api/v1/lifecycle/comp-set/:compId
 * Deactivate a comp
 */
router.delete('/comp-set/:compId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    await deactivateComp(req.params.compId, reason);
    res.json({ success: true });
  } catch (err) {
    logger.error('Deactivate comp error:', err);
    res.status(500).json({ success: false, error: 'Failed to deactivate comp' });
  }
});

/**
 * POST /api/v1/lifecycle/comp-set/:compId/pricing
 * Record a pricing snapshot for a comp
 */
router.post('/comp-set/:compId/pricing', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = {
      ...req.body,
      compSetId: req.params.compId,
      snapshotDate: new Date(req.body.snapshotDate ?? new Date()),
    };
    const id = await recordPricingSnapshot(snapshot);
    res.json({ success: true, id });
  } catch (err) {
    logger.error('Record pricing snapshot error:', err);
    res.status(500).json({ success: false, error: 'Failed to record pricing' });
  }
});

/**
 * GET /api/v1/lifecycle/:dealId/comp-alerts
 * Get pricing alerts for a deal
 */
router.get('/:dealId/comp-alerts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { acknowledged, limit } = req.query;
    const alerts = await getPricingAlerts(req.params.dealId, {
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, alerts });
  } catch (err) {
    logger.error('Get comp alerts error:', err);
    res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

/**
 * POST /api/v1/lifecycle/comp-alerts/:alertId/acknowledge
 * Acknowledge a pricing alert
 */
router.post('/comp-alerts/:alertId/acknowledge', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await acknowledgePricingAlert(req.params.alertId, req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    logger.error('Acknowledge alert error:', err);
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

/**
 * GET /api/v1/lifecycle/:dealId/competitive-position
 * Get competitive position summary
 */
router.get('/:dealId/competitive-position', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const position = await getCompetitivePosition(req.params.dealId);
    res.json({ success: true, ...position });
  } catch (err) {
    logger.error('Get competitive position error:', err);
    res.status(500).json({ success: false, error: 'Failed to get position' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// CAPEX ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/lifecycle/:dealId/capex/budget
 * Get CapEx budget
 */
router.get('/:dealId/capex/budget', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { year } = req.query;
    const result = await query(
      `SELECT * FROM capex_budget WHERE deal_id = $1 ${year ? 'AND budget_year = $2' : ''} ORDER BY budget_year`,
      year ? [req.params.dealId, parseInt(year as string)] : [req.params.dealId]
    );
    res.json({ success: true, budgets: result.rows });
  } catch (err) {
    logger.error('Get capex budget error:', err);
    res.status(500).json({ success: false, error: 'Failed to get budget' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/capex/budget
 * Create/update CapEx budget
 */
router.post('/:dealId/capex/budget', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    await query(
      `INSERT INTO capex_budget (
        deal_id, budget_year,
        unit_interiors, common_areas, building_exterior, mechanical_systems,
        roofing, parking_paving, landscaping, amenities, safety_security, other,
        units, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (deal_id, budget_year) DO UPDATE SET
        unit_interiors = EXCLUDED.unit_interiors,
        common_areas = EXCLUDED.common_areas,
        building_exterior = EXCLUDED.building_exterior,
        mechanical_systems = EXCLUDED.mechanical_systems,
        roofing = EXCLUDED.roofing`,
      [
        req.params.dealId, data.budget_year,
        data.unit_interiors, data.common_areas, data.building_exterior, data.mechanical_systems,
        data.roofing, data.parking_paving, data.landscaping, data.amenities, data.safety_security, data.other,
        data.units, data.source,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('Save capex budget error:', err);
    res.status(500).json({ success: false, error: 'Failed to save budget' });
  }
});

/**
 * GET /api/v1/lifecycle/:dealId/capex/actuals
 * Get CapEx actuals
 */
router.get('/:dealId/capex/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM capex_actuals WHERE deal_id = $1 ORDER BY completion_date DESC`,
      [req.params.dealId]
    );
    res.json({ success: true, actuals: result.rows });
  } catch (err) {
    logger.error('Get capex actuals error:', err);
    res.status(500).json({ success: false, error: 'Failed to get actuals' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/capex/actuals
 * Record CapEx actual
 */
router.post('/:dealId/capex/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    const result = await query(
      `INSERT INTO capex_actuals (
        deal_id, project_name, category, description,
        budget_amount, actual_amount,
        start_date, completion_date, status, vendor, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        req.params.dealId, data.project_name, data.category, data.description,
        data.budget_amount, data.actual_amount,
        data.start_date, data.completion_date, data.status ?? 'completed', data.vendor, data.notes,
      ]
    );
    res.json({ success: true, id: result.rows[0]?.id });
  } catch (err) {
    logger.error('Record capex actual error:', err);
    res.status(500).json({ success: false, error: 'Failed to record actual' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// USER VIEW PREFERENCES
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/lifecycle/preferences/:viewName
 * Get user view preferences
 */
router.get('/preferences/:viewName', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM user_view_preferences WHERE user_id = $1 AND view_name = $2`,
      [req.user!.userId, req.params.viewName]
    );
    res.json({ success: true, preferences: result.rows[0] ?? null });
  } catch (err) {
    logger.error('Get preferences error:', err);
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

/**
 * POST /api/v1/lifecycle/preferences/:viewName
 * Save user view preferences
 */
router.post('/preferences/:viewName', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { visible_columns, column_order, column_widths, default_sort_column, default_sort_dir, saved_filters, show_variance_colors, show_projections, show_actuals } = req.body;
    
    await query(
      `INSERT INTO user_view_preferences (
        user_id, view_name, visible_columns, column_order, column_widths,
        default_sort_column, default_sort_dir, saved_filters,
        show_variance_colors, show_projections, show_actuals
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, view_name) DO UPDATE SET
        visible_columns = EXCLUDED.visible_columns,
        column_order = EXCLUDED.column_order,
        column_widths = EXCLUDED.column_widths,
        default_sort_column = EXCLUDED.default_sort_column,
        saved_filters = EXCLUDED.saved_filters,
        updated_at = NOW()`,
      [
        req.user!.userId, req.params.viewName, visible_columns, column_order, 
        column_widths ? JSON.stringify(column_widths) : null,
        default_sort_column, default_sort_dir ?? 'desc', 
        saved_filters ? JSON.stringify(saved_filters) : null,
        show_variance_colors ?? true, show_projections ?? true, show_actuals ?? true,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('Save preferences error:', err);
    res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
});

export default router;
