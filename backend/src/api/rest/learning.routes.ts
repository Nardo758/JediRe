/**
 * Learning Feedback API Routes
 * 
 * Endpoints for the self-learning system:
 * - Record actual performance data
 * - Trigger outcome computation
 * - View model accuracy metrics
 * - Manually compute/review adjustments
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import {
  saveAssumptionSnapshot,
  recordActualPerformance,
  computeAssumptionOutcomes,
  computeLearningAdjustments,
  getLearningAdjustments,
  computeModelPerformanceMetrics,
  getModelAccuracySummary,
} from '../../services/learning-feedback.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// ─── Actual Performance Recording ─────────────────────────────────────

/**
 * POST /api/v1/learning/actuals
 * Record actual performance data for a deal
 */
router.post('/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      dealId, periodType, periodStart, periodEnd,
      actualNoi, actualVacancyPct, actualRentPerUnit, actualOpexPerUnit,
      lineItemActuals, source
    } = req.body;

    if (!dealId || !periodType || !periodStart || !periodEnd) {
      return res.status(400).json({ 
        success: false, 
        error: 'dealId, periodType, periodStart, and periodEnd are required' 
      });
    }

    const id = await recordActualPerformance({
      dealId,
      periodType,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      actualNoi,
      actualVacancyPct,
      actualRentPerUnit,
      actualOpexPerUnit,
      lineItemActuals,
      source,
    });

    res.json({ success: true, id });
  } catch (err) {
    logger.error('Record actuals error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to record actuals' 
    });
  }
});

/**
 * POST /api/v1/learning/actuals/bulk
 * Bulk import actual performance data (e.g., from CSV or PMS export)
 */
router.post('/actuals/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'records array required' });
    }

    let imported = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        await recordActualPerformance({
          dealId: record.dealId,
          periodType: record.periodType ?? 'monthly',
          periodStart: new Date(record.periodStart),
          periodEnd: new Date(record.periodEnd),
          actualNoi: record.actualNoi,
          actualVacancyPct: record.actualVacancyPct,
          actualRentPerUnit: record.actualRentPerUnit,
          actualOpexPerUnit: record.actualOpexPerUnit,
          lineItemActuals: record.lineItemActuals,
          source: record.source ?? 'bulk_import',
        });
        imported++;
      } catch (err) {
        errors.push(`Row ${imported + errors.length + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    res.json({ 
      success: true, 
      imported, 
      errors: errors.slice(0, 10),
      totalErrors: errors.length,
    });
  } catch (err) {
    logger.error('Bulk import error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Bulk import failed' 
    });
  }
});

// ─── Outcome Computation ──────────────────────────────────────────────

/**
 * POST /api/v1/learning/compute-outcomes/:dealId
 * Compute assumed vs actual outcomes for a specific deal
 */
router.post('/compute-outcomes/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await computeAssumptionOutcomes(req.params.dealId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Compute outcomes error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Outcome computation failed' 
    });
  }
});

/**
 * POST /api/v1/learning/compute-outcomes-batch
 * Compute outcomes for all deals with sufficient actual data
 */
router.post('/compute-outcomes-batch', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Find deals with acquisition snapshots and 6+ months of actuals
    const eligibleDeals = await query(`
      SELECT DISTINCT s.deal_id
      FROM assumption_snapshots s
      JOIN actual_performance a ON a.deal_id = s.deal_id
      WHERE s.snapshot_type = 'acquisition'
        AND a.period_type = 'monthly'
      GROUP BY s.deal_id
      HAVING COUNT(DISTINCT a.period_start) >= 6
    `);

    let computed = 0;
    const errors: string[] = [];

    for (const row of eligibleDeals.rows as { deal_id: string }[]) {
      const result = await computeAssumptionOutcomes(row.deal_id);
      if (result.outcomesComputed > 0) computed += result.outcomesComputed;
      errors.push(...result.errors);
    }

    res.json({ 
      success: true, 
      dealsProcessed: eligibleDeals.rows.length,
      outcomesComputed: computed,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    logger.error('Batch compute outcomes error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Batch computation failed' 
    });
  }
});

// ─── Learning Adjustments ─────────────────────────────────────────────

/**
 * POST /api/v1/learning/compute-adjustments
 * Compute learning adjustments from accumulated outcomes
 */
router.post('/compute-adjustments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await computeLearningAdjustments();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Compute adjustments error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Adjustment computation failed' 
    });
  }
});

/**
 * GET /api/v1/learning/adjustments
 * Query active learning adjustments
 */
router.get('/adjustments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { state, msa, asset_class, deal_type, assumption_names } = req.query;

    const adjustments = await getLearningAdjustments({
      state: state as string | undefined,
      msa: msa as string | undefined,
      assetClass: asset_class as string | undefined,
      dealType: deal_type as string | undefined,
      assumptionNames: assumption_names ? (assumption_names as string).split(',') : undefined,
    });

    res.json({ success: true, adjustments });
  } catch (err) {
    logger.error('Get adjustments error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Query failed' 
    });
  }
});

// ─── Model Accuracy ───────────────────────────────────────────────────

/**
 * GET /api/v1/learning/accuracy
 * Get overall model accuracy metrics
 */
router.get('/accuracy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await getModelAccuracySummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    logger.error('Get accuracy error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Query failed' 
    });
  }
});

/**
 * POST /api/v1/learning/compute-metrics
 * Recompute model performance metrics
 */
router.post('/compute-metrics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await computeModelPerformanceMetrics();
    const summary = await getModelAccuracySummary();
    res.json({ success: true, message: 'Metrics computed', ...summary });
  } catch (err) {
    logger.error('Compute metrics error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Metric computation failed' 
    });
  }
});

// ─── Outcomes Inspection ──────────────────────────────────────────────

/**
 * GET /api/v1/learning/outcomes
 * View assumption outcomes (for debugging/analysis)
 */
router.get('/outcomes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assumption_name, state, msa, asset_class, limit = '100' } = req.query;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (assumption_name) {
      params.push(assumption_name);
      conditions.push(`assumption_name = $${params.length}`);
    }
    if (state) {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (msa) {
      params.push(msa);
      conditions.push(`msa = $${params.length}`);
    }
    if (asset_class) {
      params.push(asset_class);
      conditions.push(`asset_class = $${params.length}`);
    }

    params.push(parseInt(limit as string, 10));
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
        assumption_name, assumed_value, actual_value,
        gap_pct, gap_direction,
        state, msa, asset_class, deal_type,
        computed_at
       FROM assumption_outcomes
       ${whereClause}
       ORDER BY computed_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, outcomes: result.rows });
  } catch (err) {
    logger.error('Get outcomes error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Query failed' 
    });
  }
});

/**
 * GET /api/v1/learning/outcomes/deal/:dealId/summary
 * Deal-scoped accuracy summary — aggregates assumption outcomes for a specific deal
 */
router.get('/outcomes/deal/:dealId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    // Verify deal belongs to requesting user (prevents IDOR)
    const dealCheck = await query('SELECT id FROM deals WHERE id = $1 AND user_id = $2', [dealId, userId]);
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    const result = await query(
      `SELECT
         assumption_name,
         COUNT(*) AS n_predictions,
         AVG(CASE WHEN ABS(gap_pct) <= 0.10 THEN 1.0 ELSE 0.0 END) AS hit_rate_10pct,
         AVG(CASE WHEN ABS(gap_pct) <= 0.20 THEN 1.0 ELSE 0.0 END) AS hit_rate_20pct,
         AVG(gap_pct) AS mean_gap_pct
       FROM assumption_outcomes
       WHERE deal_id = $1
       GROUP BY assumption_name
       ORDER BY n_predictions DESC`,
      [dealId]
    );
    res.json({ success: true, summary: result.rows });
  } catch (err) {
    logger.error('Deal learning summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to get deal learning summary' });
  }
});

/**
 * GET /api/v1/learning/outcomes/summary
 * Aggregated view of outcomes by assumption type
 */
router.get('/outcomes/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT * FROM v_recent_prediction_accuracy
    `);

    res.json({ success: true, summary: result.rows });
  } catch (err) {
    logger.error('Get outcomes summary error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Query failed' 
    });
  }
});

// ─── Full Learning Cycle ──────────────────────────────────────────────

/**
 * POST /api/v1/learning/run-cycle
 * Run the full learning cycle: compute outcomes → compute adjustments → update metrics
 */
router.post('/run-cycle', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('[learning.routes] Running full learning cycle...');

    // Step 1: Compute outcomes for all eligible deals
    const eligibleDeals = await query(`
      SELECT DISTINCT s.deal_id
      FROM assumption_snapshots s
      JOIN actual_performance a ON a.deal_id = s.deal_id
      WHERE s.snapshot_type = 'acquisition'
        AND a.period_type = 'monthly'
      GROUP BY s.deal_id
      HAVING COUNT(DISTINCT a.period_start) >= 6
    `);

    let outcomesComputed = 0;
    for (const row of eligibleDeals.rows as { deal_id: string }[]) {
      const result = await computeAssumptionOutcomes(row.deal_id);
      outcomesComputed += result.outcomesComputed;
    }

    // Step 2: Compute learning adjustments
    const adjustmentResult = await computeLearningAdjustments();

    // Step 3: Update performance metrics
    await computeModelPerformanceMetrics();

    // Step 4: Get accuracy summary
    const accuracy = await getModelAccuracySummary();

    res.json({
      success: true,
      cycle: {
        dealsProcessed: eligibleDeals.rows.length,
        outcomesComputed,
        adjustmentsComputed: adjustmentResult.adjustmentsComputed,
      },
      accuracy,
      message: 'Learning cycle complete',
    });
  } catch (err) {
    logger.error('Learning cycle error:', err);
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Learning cycle failed' 
    });
  }
});

export default router;
