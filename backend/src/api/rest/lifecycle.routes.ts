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

import {
  guardTransition,
  buildSideEffectSQL,
  normalizeStatus,
  type DealStatus,
} from '../../services/lifecycle/transition-guard.service';

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
    const dealId = req.params.dealId;

    // Guard: disposition always transitions the deal to SOLD
    const guardResult = await guardTransition(dealId, 'SOLD');
    if (!guardResult.allowed) {
      return res.status(400).json({ success: false, error: guardResult.reason ?? 'Invalid status transition' });
    }

    // Set guard reason for the trigger to capture
    await query(
      `SELECT set_config('app.lifecycle_reason', $1, true)`,
      [guardResult.reason ?? 'Disposition recorded — transition to SOLD'],
    );

    const data = req.body;
    data.dealId = dealId;
    data.closingDate = new Date(data.closingDate);
    if (data.listingDate) data.listingDate = new Date(data.listingDate);
    if (data.underContractDate) data.underContractDate = new Date(data.underContractDate);
    
    const id = await recordDisposition(data);
    res.json({ success: true, id, transition: { from: guardResult.currentStatus, to: 'SOLD', reason: guardResult.reason } });
  } catch (err) {
    logger.error('Record disposition error:', err);
    res.status(500).json({ success: false, error: 'Failed to record disposition' });
  }
});

/**
 * POST /api/v1/lifecycle/:dealId/status
 * Explicit status transition with guard enforcement.
 * Canonical endpoint for Phase 6 lifecycle state machine.
 */
router.post('/:dealId/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dealId = req.params.dealId;
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const normalizedTarget = normalizeStatus(status) as DealStatus;

    // 1. Validate transition
    const guardResult = await guardTransition(dealId, normalizedTarget);
    if (!guardResult.allowed) {
      return res.status(400).json({ success: false, error: guardResult.reason ?? 'Invalid status transition' });
    }

    // 2. Compute side effects
    const { setClauses: sideEffectClauses } = buildSideEffectSQL(dealId, guardResult.sideEffects ?? []);

    // 3. Set guard reason for the trigger
    await query(
      `SELECT set_config('app.lifecycle_reason', $1, true)`,
      [guardResult.reason ?? `Status changed to ${normalizedTarget}`],
    );

    // 4. Apply UPDATE with side effects
    const setParts = [`status = $1`, ...sideEffectClauses, `updated_at = NOW()`];
    await query(
      `UPDATE deals SET ${setParts.join(', ')} WHERE id = $2`,
      [normalizedTarget, dealId],
    );

    // 5. Manual enriched log (trigger also captures a safety-net row)
    setImmediate(async () => {
      try {
        const { recordDealLifecycleEvent } = await import('../../services/portfolio/lifecycle-transition.service');
        await recordDealLifecycleEvent(
          dealId,
          guardResult.currentStatus ?? null,
          normalizedTarget,
          req.user!.userId,
          { reason: guardResult.reason, sideEffects: guardResult.sideEffects },
        );
      } catch (lcErr) {
        logger.warn('[LifecycleEvents] Manual log failed (non-fatal)', { dealId, error: lcErr });
      }
    });

    return res.json({
      success: true,
      status: normalizedTarget,
      transition: {
        from: guardResult.currentStatus,
        to: normalizedTarget,
        reason: guardResult.reason,
      },
    });
  } catch (err) {
    logger.error('Status transition error:', err);
    return res.status(500).json({ success: false, error: 'Failed to transition status' });
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
    // Include snake_case aliases for the hedge/cap fields per API contract
    const mapped = positions.map(p => ({
      ...p,
      rate_cap_strike:   p.rateCapStrike   ?? null,
      hedge_type:        p.hedgeType        ?? null,
      hedge_expiry_date: p.hedgeExpiryDate  ?? null,
    }));
    res.json({ success: true, positions: mapped });
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
 * GET /api/v1/lifecycle/:dealId/refi-test
 * Fetch past refi test scenarios for a deal
 */
router.get('/:dealId/refi-test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, scenario_name, scenario_type, test_date,
              assumed_noi, assumed_value, assumed_cap_rate, assumed_all_in_rate,
              max_ltv, min_dscr, min_debt_yield,
              max_loan_by_ltv, max_loan_by_dscr, max_loan_by_dy,
              constrained_by, max_loan_proceeds,
              existing_balance, cash_out_available,
              new_debt_service, dscr_post_refi,
              is_feasible, feasibility_notes
       FROM refi_test_scenarios
       WHERE deal_id = $1
       ORDER BY test_date DESC
       LIMIT 20`,
      [req.params.dealId]
    );
    res.json({ success: true, scenarios: rows });
  } catch (err) {
    logger.error('Get refi scenarios error:', err);
    res.status(500).json({ success: false, error: 'Failed to get refi scenarios' });
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

/**
 * GET /api/v1/lifecycle/:dealId/exit-timing
 * Returns an 84-quarter market-cycle series (Q1 2016 → Q4 2036) for the
 * deal's CS submarket: rent growth, cap rate, supply, T10Y, and computed RSS.
 * Historical quarters are sourced from CoStar annual data (interpolated to quarterly).
 * Projected quarters use trend-based mean-reversion extrapolation.
 *
 * Response: { quarters: [{ idx, label, rent_growth, cap_rate, supply, t10,
 *             rss, mw, re, sp, or, bp, is_proj }], optimal_fwd, now_idx, submarket_name }
 */
router.get('/:dealId/exit-timing', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    // 1. Auth + ownership + resolve city/county via property join
    const dealRow = await query(
      `SELECT d.id, d.city, d.state_code, d.property_id,
              p.county
       FROM deals d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE d.id = $1 AND d.user_id = $2 AND d.archived_at IS NULL`,
      [dealId, req.user!.userId],
    );
    if (!dealRow.rows.length) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const { city, state_code, county } = dealRow.rows[0] as Record<string, string | null>;

    // 2. Determine CS submarket geography_ids
    const geoIds = exitTimingResolveGeoIds(county, city, state_code);

    // 3. Query CS annual metrics (averaged across geography_ids)
    const csResult = await query(
      `SELECT metric_id,
              EXTRACT(YEAR FROM period_date)::int AS yr,
              AVG(value)::float               AS value
       FROM metric_time_series
       WHERE geography_id = ANY($1)
         AND metric_id IN ('CS_EFF_RENT_GROWTH', 'CS_CAP_RATE', 'CS_DELIVERIES')
         AND period_type = 'annual'
       GROUP BY metric_id, yr
       ORDER BY metric_id, yr`,
      [geoIds],
    );

    // 4. Query T10Y quarterly averages (full history + near-term)
    const t10Result = await query(
      `SELECT EXTRACT(YEAR FROM period_date)::int    AS yr,
              EXTRACT(QUARTER FROM period_date)::int  AS qtr,
              AVG(value)::float                       AS val
       FROM metric_time_series
       WHERE metric_id = 'RATE_TREASURY_10Y' AND geography_type = 'national'
         AND period_date >= '2016-01-01'
       GROUP BY yr, qtr
       ORDER BY yr, qtr`,
    );

    // 5. Build per-year lookup maps
    const rgByYr:  Record<number, number> = {};
    const capByYr: Record<number, number> = {};
    const supByYr: Record<number, number> = {};
    for (const row of csResult.rows as Array<{ metric_id: string; yr: number; value: number }>) {
      if (row.metric_id === 'CS_EFF_RENT_GROWTH') rgByYr[row.yr]  = row.value;
      else if (row.metric_id === 'CS_CAP_RATE')   capByYr[row.yr] = row.value;
      else if (row.metric_id === 'CS_DELIVERIES')  supByYr[row.yr] = row.value;
    }
    const t10ByYrQtr: Record<string, number> = {};
    for (const row of t10Result.rows as Array<{ yr: number; qtr: number; val: number }>) {
      t10ByYrQtr[`${row.yr}-${row.qtr}`] = row.val;
    }

    // 6. Build 84-quarter arrays (Q1 2016 → Q4 2036)
    const TOTAL_Q   = 84;
    const START_YR  = 2016;
    const NOW_IDX   = 40; // Q1 2026

    const rgArr  = exitTimingInterpolate(rgByYr,  TOTAL_Q, START_YR, 2.5,  false);
    const capArr = exitTimingInterpolate(capByYr, TOTAL_Q, START_YR, 5.0,  false);
    const supArr = exitTimingInterpolate(supByYr, TOTAL_Q, START_YR, 0.0,  true);

    const t10Arr: number[] = Array.from({ length: TOTAL_Q }, (_, i) => {
      const yr  = START_YR + Math.floor(i / 4);
      const qtr = (i % 4) + 1;
      const known = t10ByYrQtr[`${yr}-${qtr}`];
      if (known !== undefined) return +(known.toFixed(3));
      // Extrapolate: current ~4.3% easing toward 3.0% over ~5 years
      const lastKnown = t10ByYrQtr['2026-1'] ?? 4.3;
      const steps = i - NOW_IDX;
      return +(Math.max(2.8, lastKnown - steps * 0.04).toFixed(3));
    });

    // 7. Compute RSS for each quarter
    const quarters = Array.from({ length: TOTAL_Q }, (_, i) => {
      const yr    = START_YR + Math.floor(i / 4);
      const qtr   = (i % 4) + 1;
      const label = `Q${qtr}'${String(yr).slice(2)}`;
      const rg  = rgArr[i]  ?? 2.5;
      const cap = capArr[i] ?? 5.0;
      const sup = supArr[i] ?? 0;
      const t10 = t10Arr[i] ?? 3.5;
      const rssBreak = exitTimingComputeRSS(i, rg, cap, sup, t10, NOW_IDX);
      return { idx: i, label, rent_growth: +rg.toFixed(2), cap_rate: +cap.toFixed(3),
               supply: Math.round(sup), t10: +t10.toFixed(3), is_proj: i >= NOW_IDX, ...rssBreak };
    });

    // 8. Optimal forward quarter (best RSS / earliest bias, 1–6 years out)
    let optFwd = 4, bestScore = -Infinity;
    for (let fwd = 4; fwd <= 24; fwd++) {
      const qi = NOW_IDX + fwd;
      if (qi >= TOTAL_Q) break;
      const score = (quarters[qi].rss ?? 0) - fwd * 0.5;
      if (score > bestScore) { bestScore = score; optFwd = fwd; }
    }

    // 9. Resolve submarket display name
    let submktName = 'Atlanta MSA';
    if (geoIds[0] !== 'atlanta-ga-ga') {
      const nameRes = await query(
        `SELECT geography_name FROM metric_time_series WHERE geography_id = $1 LIMIT 1`,
        [geoIds[0]],
      );
      submktName = (nameRes.rows[0] as any)?.geography_name ?? submktName;
    }

    return res.json({
      success: true, quarters, optimal_fwd: optFwd, now_idx: NOW_IDX, submarket_name: submktName,
    });
  } catch (err) {
    logger.error('exit-timing error:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute exit timing' });
  }
});

// ─── exit-timing helpers ──────────────────────────────────────────────────────

/** Map county/city to CoStar CS geography_id(s). Falls back to Atlanta metro. */
function exitTimingResolveGeoIds(county: string | null, city: string | null, stateCode: string | null): string[] {
  if (stateCode !== 'GA') return ['atlanta-ga-ga'];
  const key = (county ?? city ?? '').toLowerCase();
  if (key.includes('gwinnett')) return ['apt-1-10126', 'apt-1-6730'];
  if (key.includes('fulton'))   return ['apt-1-6729', 'apt-1-6751'];
  if (key.includes('cobb'))     return ['apt-1-6713', 'apt-1-6725'];
  if (key.includes('dekalb'))   return ['apt-1-6715', 'apt-1-6750'];
  if (key.includes('cherokee')) return ['apt-1-6710'];
  if (key.includes('forsyth'))  return ['apt-1-6720'];
  if (key.includes('henry'))    return ['apt-1-6722'];
  if (key.includes('clayton'))  return ['apt-1-6711'];
  return ['atlanta-ga-ga'];
}

/**
 * Maps annual CS data (anchored to Q4 of each year) to a quarterly array via
 * linear interpolation. After the last known data point, applies mean-reversion
 * trend extrapolation over ~20 quarters.
 */
function exitTimingInterpolate(
  byYear: Record<number, number>,
  totalQ: number,
  startYear: number,
  fallback: number,
  isSupply: boolean,
): number[] {
  const result = new Array<number | null>(totalQ).fill(null);

  // Place annual values at Q4 of each year: idx = (yr - startYear) * 4 + 3
  for (let yr = startYear; yr <= startYear + Math.floor(totalQ / 4) + 1; yr++) {
    const qi = (yr - startYear) * 4 + 3;
    if (qi < totalQ && byYear[yr] !== undefined) result[qi] = byYear[yr];
  }

  // Linear interpolation between known anchors
  let prevI = -1, prevV = 0;
  for (let i = 0; i < totalQ; i++) {
    if (result[i] !== null) {
      if (prevI >= 0) {
        for (let j = prevI + 1; j < i; j++) {
          result[j] = prevV + (result[i]! - prevV) * (j - prevI) / (i - prevI);
        }
      }
      prevI = i;
      prevV = result[i]!;
    }
  }

  // Back-fill before first known
  const firstKnown = result.findIndex(v => v !== null);
  if (firstKnown > 0) for (let i = 0; i < firstKnown; i++) result[i] = result[firstKnown];

  // Forward extrapolation after last known (mean-reversion over 20 quarters)
  const lastKnownR = [...result].reverse().findIndex(v => v !== null);
  const lastKnownI = lastKnownR === -1 ? -1 : totalQ - 1 - lastKnownR;
  if (lastKnownI >= 0 && lastKnownI < totalQ - 1) {
    const anchorStep = 4;
    const prevAnchorI = Math.max(0, lastKnownI - anchorStep);
    const trend = (result[lastKnownI]! - (result[prevAnchorI] ?? result[lastKnownI]!)) / anchorStep;
    for (let i = lastKnownI + 1; i < totalQ; i++) {
      const steps = i - lastKnownI;
      const revW  = Math.min(1, steps / 20);
      let v = result[lastKnownI]! + trend * steps * (1 - revW) + fallback * revW - result[lastKnownI]! * revW;
      if (isSupply) v = Math.max(0, v);
      result[i] = v;
    }
  }

  return result.map(v => +(v ?? fallback).toFixed(3));
}

/** RSS (Readiness to Sell Score) — identical formula to ConvergenceChart.tsx. */
function exitTimingComputeRSS(i: number, rg: number, cap: number, supply: number, rate: number, nowIdx: number) {
  const txn = Math.max(20, 60 + Math.sin(i * 0.15) * 20);
  const bp  = Math.max(30, 55 + Math.sin(i * 0.12) * 18);
  const mw  = Math.min(100, Math.max(0, (rg / 6) * 40 + ((1 - cap / 7) * 100 * 0.3) + txn * 0.2 + 5));
  const re  = Math.min(100, Math.max(0, ((5.0 - rate) / 2.5) * 100 * 0.4 + ((cap - rate) * 100 * 0.35) / 3 + ((4.5 - rate) / 2.5) * 100 * 0.25));
  const sp  = Math.max(0, 100 - supply / 8);
  const opR = Math.min(100, 30 + Math.max(0, i - nowIdx) * 3.5);
  const rss = Math.round(Math.max(0, Math.min(100, mw * 0.35 + re * 0.25 + sp * 0.2 + opR * 0.15 + bp * 0.05)));
  return { rss, mw: Math.round(mw), re: Math.round(Math.max(0, re)), sp: Math.round(sp), or: Math.round(opR), bp: Math.round(bp) };
}

export default router;
