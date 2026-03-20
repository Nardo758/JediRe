/**
 * M22 Deal Archive & Intelligence Flywheel REST API
 * Three-pattern architecture: Snapshot (write), Calibration (feedback), Benchmark (read)
 */

import { Router, Request, Response } from 'express';
import { underwritingArchiveService } from '../../services/underwriting-archive.service';
import { monthlyActualsService } from '../../services/monthly-actuals.service';
import { benchmarkQueryService } from '../../services/benchmark-query.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// PATTERN 1: Snapshots (Immutable Write)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/archive/snapshot
 * Create immutable snapshot at stage transition
 */
router.post('/snapshot', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { capsule, trigger } = req.body;
    const createdBy = req.user?.id || 'system';

    const snapshot = await underwritingArchiveService.createSnapshot(capsule, trigger, createdBy);

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create snapshot',
    });
  }
});

/**
 * GET /api/v1/archive/snapshots/:dealId
 * Get all snapshots for a deal
 */
router.get('/snapshots/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const snapshots = await underwritingArchiveService.getSnapshots(dealId);

    res.json({
      success: true,
      data: snapshots,
      count: snapshots.length,
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch snapshots',
    });
  }
});

/**
 * GET /api/v1/archive/snapshot/:dealId/latest
 * Get most recent snapshot for a deal
 */
router.get('/snapshot/:dealId/latest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const snapshot = await underwritingArchiveService.getLatestSnapshot(dealId);

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: 'No snapshots found for this deal',
      });
    }

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Error fetching latest snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest snapshot',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATTERN 1: Monthly Actuals (Critical Path - Living Record)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/archive/actuals
 * Upload monthly actuals (triggers calibration push)
 */
router.post('/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const input = req.body;
    const uploadedBy = req.user?.id || 'system';

    const actuals = await monthlyActualsService.uploadActuals(input, uploadedBy);

    res.json({
      success: true,
      data: actuals,
      message: 'Actuals uploaded. Calibration push triggered.',
    });
  } catch (error) {
    console.error('Error uploading actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload actuals',
    });
  }
});

/**
 * POST /api/v1/archive/actuals/bulk
 * Bulk upload actuals (CSV import)
 */
router.post('/actuals/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { records } = req.body;
    const uploadedBy = req.user?.id || 'system';

    const result = await monthlyActualsService.bulkUpload(records, uploadedBy);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error bulk uploading actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk upload actuals',
    });
  }
});

/**
 * GET /api/v1/archive/actuals/:dealId
 * Get actuals for a deal
 */
router.get('/actuals/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const actuals = await monthlyActualsService.getActuals(dealId, limit);

    res.json({
      success: true,
      data: actuals,
      count: actuals.length,
    });
  } catch (error) {
    console.error('Error fetching actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch actuals',
    });
  }
});

/**
 * GET /api/v1/archive/actuals/:dealId/summary
 * Get actuals summary (for dashboard)
 */
router.get('/actuals/:dealId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const summary = await monthlyActualsService.getSummary(dealId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching actuals summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch actuals summary',
    });
  }
});

/**
 * GET /api/v1/archive/actuals/:dealId/variance
 * Get variance analysis (actual vs projected)
 */
router.get('/actuals/:dealId/variance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;

    const variance = await monthlyActualsService.getVarianceAnalysis(dealId);

    res.json({
      success: true,
      data: variance,
      count: variance.length,
    });
  } catch (error) {
    console.error('Error fetching variance analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variance analysis',
    });
  }
});

/**
 * PUT /api/v1/archive/actuals/:id/verify
 * Verify actuals (mark as reviewed)
 */
router.put('/actuals/:id/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const verifiedBy = req.user?.id || 'system';

    const actuals = await monthlyActualsService.verifyActuals(parseInt(id), verifiedBy);

    res.json({
      success: true,
      data: actuals,
    });
  } catch (error) {
    console.error('Error verifying actuals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify actuals',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATTERN 3: Benchmark Query (Pre-Computed Read Layer)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/archive/benchmarks/query
 * Query benchmark envelope for underwriting
 */
router.post('/benchmarks/query', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.body;

    const benchmark = await benchmarkQueryService.queryBenchmarkWithFallback(query);

    if (!benchmark) {
      return res.status(404).json({
        success: false,
        error: 'No benchmark data found for this segment',
      });
    }

    res.json({
      success: true,
      data: benchmark,
    });
  } catch (error) {
    console.error('Error querying benchmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query benchmark',
    });
  }
});

/**
 * POST /api/v1/archive/benchmarks/compute
 * Trigger nightly benchmark computation job (admin only)
 */
router.post('/benchmarks/compute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // TODO: Add admin check

    const result = await benchmarkQueryService.computeBenchmarks();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error computing benchmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compute benchmarks',
    });
  }
});

export default router;
