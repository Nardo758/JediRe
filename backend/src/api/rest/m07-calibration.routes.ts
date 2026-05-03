/**
 * M07 Calibration API Routes
 *
 * Exposes the M07 self-calibrating backend over REST:
 *
 *   POST /api/v1/calibration/rent-roll/upload
 *     → Full pipeline: detect → map → parse → store → derive → S1 → S2 (if eligible)
 *
 *   POST /api/v1/calibration/rent-roll/:snapshotId/derive
 *     → Re-run derivations for an existing snapshot
 *
 *   GET  /api/v1/calibration/rent-roll/:dealId/snapshots
 *     → List all snapshots for a deal
 *
 *   POST /api/v1/calibration/job/run
 *     → Trigger the nightly calibration job on-demand (admin only)
 *
 *   GET  /api/v1/calibration/coefficients/:dealId
 *     → Get resolved coefficients for a deal (Subject → Deal → Platform → Baseline)
 *
 *   GET  /api/v1/calibration/starting-state/:dealId
 *     → Resolve starting state for a deal (STABILIZED / LEASE_UP / REDEVELOPMENT)
 *
 *   GET  /api/v1/calibration/absorption-benchmark/:submarketId
 *     → Get platform absorption benchmark for a submarket
 *
 *   PUT  /api/v1/calibration/deal/:dealId/mode
 *     → Update deal_mode (STABILIZED / LEASE_UP / REDEVELOPMENT)
 *
 *   GET  /api/v1/calibration/subject-history/:dealId
 *     → Get subject_traffic_history for a deal (S1/S2/S3/S4 tier)
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import type { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { mkdirSync } from 'fs';
import { pool } from '../../database';
import { RentRollParserService } from '../../services/rent-roll/rent-roll-parser.service';
import { RentRollDerivationsService } from '../../services/rent-roll-derivations.service';
import { StartingStateService } from '../../services/starting-state.service';
import { CoefficientResolverService } from '../../services/coefficient-resolver.service';
import { TrafficCalibrationJob } from '../../jobs/trafficCalibrationJob';
import { SubjectHistoryS1Service } from '../../services/rent-roll/subject-history-s1.service';
import { RentRollDiffService, S2_MIN_PERIOD_DAYS } from '../../services/rent-roll/rent-roll-diff.service';
import { ConcessionEnvironmentEngine } from '../../services/concession-environment-engine';
import { logger } from '../../utils/logger';

const router = Router();

// Services
const rentRollParser           = new RentRollParserService(pool);
const derivationsService       = new RentRollDerivationsService(pool);
const startingStateService     = new StartingStateService(pool);
const coefficientResolver      = new CoefficientResolverService(pool);
const calibrationJob           = new TrafficCalibrationJob(pool);
const subjectHistoryS1         = new SubjectHistoryS1Service(pool);
const rentRollDiff             = new RentRollDiffService(pool);
const concessionEnvEngine      = new ConcessionEnvironmentEngine(pool);

// Multer for rent roll uploads.
// Uses diskStorage with explicit filename so the original extension is preserved —
// FormatDetectorService.detect() infers format from path.extname(filePath), so
// the temp file MUST keep its extension (e.g. .csv / .xlsx / .xls).
const uploadDir = path.join(process.cwd(), 'uploads', 'rent-rolls');
mkdirSync(uploadDir, { recursive: true });

const rentRollUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },  // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      logger.warn(`[M07] Rejected file type: ${ext}`);
      cb(null, false);
    }
  },
});

// @ts-expect-error — multer resolves RequestHandler against workspace-root
// @types/express while this module resolves against backend-local @types/express.
// Both resolve to the same interface at runtime; the dual-tree node_modules layout
// causes nominal divergence that cannot be fixed without consolidating tsconfig paths.
const rentRollMiddleware: RequestHandler = rentRollUpload.single('file');

// ============================================================================
// Authorization helper: verify the authenticated user owns the deal.
// Returns the deal row on success, or responds with 403/404 and returns null.
// ============================================================================
async function assertDealOwnership(req: Request, res: Response, dealId: string): Promise<boolean> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  const result = await pool.query<{ id: string }>(
    'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
    [dealId, userId],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Deal not found' });
    return false;
  }

  return true;
}

// Admin role check for privileged operations
function assertAdminRole(req: Request, res: Response): boolean {
  const role = (req as AuthenticatedRequest).user?.role;
  if (role !== 'admin' && role !== 'service') {
    res.status(403).json({ error: 'Admin or service role required' });
    return false;
  }
  return true;
}

// ============================================================================
// POST /rent-roll/upload
// Full pipeline: detect → map → parse → store → derive → S1 aggregation →
//                S2 diff extraction (if ≥2 snapshots ≥60 days apart)
// ============================================================================
router.post('/rent-roll/upload', rentRollMiddleware, async (req, res) => {
  try {
    const file   = req.file;
    const dealId = req.body['dealId'];

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded. Accepted formats: CSV, XLSX, XLS' });
    }
    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    // Step 1: Parse and store (writes parsed_payload, unit_count, occupied_count)
    const parseResult = await rentRollParser.parseAndStore(file.path, dealId);

    // Step 2: Run derivations immediately
    const derived = await derivationsService.deriveAndStore(parseResult.snapshot_id);

    // Mark snapshot as calibrated-ready
    await pool.query(
      `UPDATE rent_roll_snapshots SET status = 'derived' WHERE id = $1`,
      [parseResult.snapshot_id],
    );

    // Step 3: S1 subject history aggregation (non-fatal — runs after primary response payload
    // is assembled so any error here doesn't block the upload)
    let s1Result: { ran: boolean; tier?: string } = { ran: false };
    let s2Result: { ran: boolean; diff_id?: number | null; period_days?: number } = { ran: false };

    try {
      await subjectHistoryS1.aggregateS1(parseResult.snapshot_id, dealId);
      s1Result = { ran: true, tier: 'S1' };
    } catch (s1Err) {
      logger.warn('[M07] S1 aggregation failed (non-fatal)', {
        dealId,
        error: s1Err instanceof Error ? s1Err.message : String(s1Err),
      });
    }

    // Step 4: S2 diff extraction — only if there are prior snapshots ≥ 60 days apart
    try {
      const priorRow = await pool.query<{ snapshot_date: string }>(`
        SELECT snapshot_date::text
        FROM rent_roll_snapshots
        WHERE deal_id = $1
          AND id != $2
          AND status IN ('derived','calibrated','parsed')
        ORDER BY snapshot_date DESC, id DESC
        LIMIT 1
      `, [dealId, parseResult.snapshot_id]);

      if (priorRow.rows.length > 0) {
        const priorDate   = new Date(priorRow.rows[0].snapshot_date);
        const currentDate = parseResult.snapshot_date;
        const periodDays  = Math.round(
          (currentDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (periodDays >= S2_MIN_PERIOD_DAYS) {
          const diffId = await rentRollDiff.extractAndStore(dealId, parseResult.snapshot_id);
          s2Result = { ran: true, diff_id: diffId, period_days: periodDays };
        } else {
          s2Result = { ran: false, period_days: periodDays };
        }
      }
    } catch (s2Err) {
      logger.warn('[M07] S2 diff extraction failed (non-fatal)', {
        dealId,
        error: s2Err instanceof Error ? s2Err.message : String(s2Err),
      });
    }

    // ── Trigger: traffic.subject_history.updated ──────────────────────────
    // Recompute concession environment after S1/S2 because the subject signal
    // (Step 4 of the four-step stack) has changed. Non-fatal.
    let concessionEnvResult: { recomputed: boolean; error?: string } = { recomputed: false };
    try {
      await concessionEnvEngine.computeForDeal(dealId);
      concessionEnvResult = { recomputed: true };
    } catch (concErr) {
      const msg = concErr instanceof Error ? concErr.message : String(concErr);
      concessionEnvResult = { recomputed: false, error: msg };
      logger.warn('[M07] Concession environment recompute failed after upload (non-fatal)', { dealId, error: msg });
    }

    return res.json({
      success: true,
      snapshot_id: parseResult.snapshot_id,
      deal_id: dealId,
      format: parseResult.format,
      row_count: parseResult.row_count,
      extraction_confidence: parseResult.extraction_confidence,
      snapshot_date: parseResult.snapshot_date,
      lease_events_stored: parseResult.lease_events_stored,
      derivations: {
        renewal_rate_proxy: derived.renewal_rate_proxy,
        unit_types_found: derived.unit_type_breakdown.length,
        signing_velocity_total: derived.signing_velocity_24m.reduce((a, b) => a + b, 0),
      },
      subject_history: {
        s1: s1Result,
        s2: s2Result,
      },
      concession_environment: concessionEnvResult,
      message: `Rent roll parsed and derived. ${parseResult.lease_events_stored} lease events stored.`,
    });
  } catch (error: unknown) {
    logger.error('[M07] Rent roll upload failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to process rent roll', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// POST /rent-roll/:snapshotId/derive
// Re-run derivations for an existing snapshot (ownership checked via snapshot→deal)
// ============================================================================
router.post('/rent-roll/:snapshotId/derive', async (req, res) => {
  try {
    const snapshotId = parseInt(req.params['snapshotId']);
    if (isNaN(snapshotId)) {
      return res.status(400).json({ error: 'Invalid snapshotId' });
    }

    const snapshotRow = await pool.query<{ deal_id: string }>(
      'SELECT deal_id FROM rent_roll_snapshots WHERE id = $1',
      [snapshotId],
    );
    if (snapshotRow.rows.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    const authorized = await assertDealOwnership(req, res, snapshotRow.rows[0].deal_id);
    if (!authorized) return;

    const derived = await derivationsService.deriveAndStore(snapshotId);

    return res.json({
      success: true,
      snapshot_id: snapshotId,
      derivations: derived,
    });
  } catch (error: unknown) {
    logger.error('[M07] Derivations failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to run derivations', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /rent-roll/:dealId/snapshots
// List all rent roll snapshots for a deal
// ============================================================================
router.get('/rent-roll/:dealId/snapshots', async (req, res) => {
  try {
    const dealId = req.params['dealId'];

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    const result = await pool.query<any>(`
      SELECT id, upload_id, original_filename, file_format, row_count,
             extraction_confidence, snapshot_date, status, error_message,
             unit_count, occupied_count, parser_source, created_at
      FROM rent_roll_snapshots
      WHERE deal_id = $1
      ORDER BY snapshot_date DESC, created_at DESC
    `, [dealId]);

    return res.json({
      deal_id: dealId,
      count: result.rows.length,
      snapshots: result.rows,
    });
  } catch (error: unknown) {
    logger.error('[M07] Snapshot list failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to list snapshots', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// POST /job/run
// Trigger the nightly calibration job on-demand (admin/service role only)
// ============================================================================
router.post('/job/run', async (req, res) => {
  try {
    if (!assertAdminRole(req, res)) return;

    const lookbackHours = parseInt(req.body['lookbackHours'] || '720');
    logger.info('[M07] Manual calibration job triggered', { lookbackHours });
    const result = await calibrationJob.run(lookbackHours);

    // ── m05.submarket_concession.updated + m04.supply_pressure.updated ────────
    // After the calibration job refreshes traffic_calibration_factors and
    // supply_risk_scores, recompute the concession environment for every active
    // deal so they pick up the new submarket and supply signals immediately.
    // Non-fatal: job result is returned even if batch recompute partially fails.
    let batchRecompute: { attempted: number; succeeded: number; failed: number } = { attempted: 0, succeeded: 0, failed: 0 };
    try {
      const activeDeals = await pool.query<{ id: string; hold_years: number }>(
        `SELECT d.id,
                COALESCE((d.deal_data->>'hold_years')::int, 5) AS hold_years
           FROM deals d
          WHERE d.archived_at IS NULL
            AND d.deal_data IS NOT NULL
          LIMIT 500`,
      );
      batchRecompute.attempted = activeDeals.rows.length;
      await Promise.allSettled(
        activeDeals.rows.map(async (row) => {
          try {
            await concessionEnvEngine.computeForDeal(row.id, row.hold_years);
            batchRecompute.succeeded++;
          } catch (err: any) {
            batchRecompute.failed++;
            logger.warn('[M07] Batch concession recompute failed for deal', { dealId: row.id, error: err.message });
          }
        }),
      );
      logger.info('[M07] Batch concession recompute after calibration job', batchRecompute);
    } catch (batchErr: any) {
      logger.warn('[M07] Batch concession recompute query failed (non-fatal)', { error: batchErr.message });
    }

    return res.json({ success: true, result, concession_recompute: batchRecompute });
  } catch (error: unknown) {
    logger.error('[M07] Calibration job failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Calibration job failed', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /coefficients/:dealId
// Get resolved coefficients for a deal (Subject → Deal → Platform → Baseline)
// ============================================================================
router.get('/coefficients/:dealId', async (req, res) => {
  try {
    const dealId = req.params['dealId'];

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    const dealResult = await pool.query<any>(`
      SELECT
        (d.deal_data->'market_intelligence'->'data'->'demographics'->'submarket'->>'id') AS submarket_id,
        (d.deal_data->>'property_class') AS property_class,
        (d.deal_data->>'year_built') AS year_built
      FROM deals d
      WHERE d.id = $1
    `, [dealId]);

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = dealResult.rows[0];
    const resolved = await coefficientResolver.resolveForDeal(
      dealId,
      deal.submarket_id || null,
      deal.property_class || null,
      deal.year_built ? parseInt(deal.year_built) : null,
    );

    return res.json({
      deal_id: dealId,
      ...resolved.meta,
      coefficients: resolved.family,
    });
  } catch (error: unknown) {
    logger.error('[M07] Coefficient resolution failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to resolve coefficients', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /starting-state/:dealId
// Resolve starting state for a deal
// ============================================================================
router.get('/starting-state/:dealId', async (req, res) => {
  try {
    const dealId = req.params['dealId'];

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    const state = await startingStateService.resolveStartingState(dealId);

    return res.json({ deal_id: dealId, starting_state: state });
  } catch (error: unknown) {
    logger.error('[M07] Starting state resolution failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to resolve starting state', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /absorption-benchmark/:submarketId
// ============================================================================
router.get('/absorption-benchmark/:submarketId', async (req, res) => {
  try {
    const submarketId = req.params['submarketId'];
    const { property_class, size_band } = req.query;

    const vintageFilter = size_band ? `size:${size_band}` : null;

    const result = await pool.query<any>(`
      SELECT *
      FROM traffic_calibration_factors
      WHERE coefficient_name = 'absorption_curve'
        AND submarket_id = $1
        AND (property_class = $2 OR $2 IS NULL)
        AND (vintage_band = $3 OR $3 IS NULL)
      ORDER BY updated_at DESC
      LIMIT 1
    `, [submarketId, property_class || null, vintageFilter]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No absorption benchmark found for this submarket',
        submarket_id: submarketId,
        hint: 'Run POST /api/v1/calibration/job/run to compute benchmarks from uploaded rent rolls',
      });
    }

    const row = result.rows[0];
    return res.json({
      submarket_id: submarketId,
      property_class: row.property_class,
      size_band: row.vintage_band ? String(row.vintage_band).replace(/^size:/, '') : null,
      n_peer_properties: row.n_peer_properties,
      benchmark: row.curve_data,
      last_updated: row.updated_at,
    });
  } catch (error: unknown) {
    logger.error('[M07] Absorption benchmark fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch benchmark', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// PUT /deal/:dealId/mode
// ============================================================================
router.put('/deal/:dealId/mode', async (req, res) => {
  try {
    const dealId = req.params['dealId'];
    const mode: string = req.body['mode'];

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    const VALID_MODES = ['STABILIZED', 'LEASE_UP', 'REDEVELOPMENT'];
    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({
        error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`,
        provided: mode,
      });
    }

    const result = await pool.query<any>(
      'UPDATE deals SET deal_mode = $1 WHERE id = $2 RETURNING id, deal_mode',
      [mode, dealId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // ── Trigger: mode.changed ─────────────────────────────────────────────
    // Recompute concession environment because the mode overlay (LEASE_UP decay
    // curve, REDEVELOPMENT bifurcation, or STABILIZED baseline) has changed.
    // Also re-evaluates mode-mismatch rejection on any existing subject history.
    // Non-fatal: mode update always succeeds even if recompute fails.
    let concessionEnvResult: { recomputed: boolean; error?: string } = { recomputed: false };
    try {
      await concessionEnvEngine.computeForDeal(dealId);
      concessionEnvResult = { recomputed: true };
    } catch (concErr) {
      const msg = concErr instanceof Error ? concErr.message : String(concErr);
      concessionEnvResult = { recomputed: false, error: msg };
      logger.warn('[M07] Concession environment recompute failed after mode change (non-fatal)', { dealId, error: msg });
    }

    return res.json({
      success: true,
      deal_id: dealId,
      deal_mode: result.rows[0].deal_mode,
      concession_environment: concessionEnvResult,
    });
  } catch (error: unknown) {
    logger.error('[M07] Deal mode update failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to update deal mode', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /subject-history/:dealId
// Get subject_traffic_history for a deal
// ============================================================================
router.get('/subject-history/:dealId', async (req, res) => {
  try {
    const dealId = req.params['dealId'];

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    const result = await pool.query<any>(
      `SELECT id, deal_id, tier, snapshot_count, coverage_months,
              current_state, observed_dynamics, confidence_weights, peer_collisions,
              created_at, updated_at
         FROM subject_traffic_history
        WHERE deal_id = $1`,
      [dealId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        deal_id: dealId,
        tier: null,
        message: 'No subject history found. Upload a rent roll to generate S1 data.',
      });
    }

    return res.json({ deal_id: dealId, ...result.rows[0] });
  } catch (error: unknown) {
    logger.error('[M07] Subject history fetch failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to fetch subject history', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /concession-environment/:dealId
// Compute per-year concession environment for a deal (four-step stack).
// Consumed by the M09 Projections Adapter and the CashFlow Agent.
// ============================================================================
router.get('/concession-environment/:dealId', async (req, res) => {
  try {
    const dealId = req.params['dealId'];
    const holdYears = req.query['hold_years'] ? parseInt(String(req.query['hold_years'])) : 5;

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    if (isNaN(holdYears) || holdYears < 1 || holdYears > 30) {
      return res.status(400).json({ error: 'hold_years must be an integer between 1 and 30' });
    }

    const output = await concessionEnvEngine.computeForDeal(dealId, holdYears);
    return res.json(output);
  } catch (error: unknown) {
    logger.error('[M07] Concession environment computation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to compute concession environment',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================
// GET /concession-defaults
// Admin read route: expose concession_class_defaults.json for the admin panel.
// Also exposes the _meta tuning parameters (supply_pressure_coefficient,
// collision sigma thresholds, etc.).
// ============================================================================
router.get('/concession-defaults', async (req, res) => {
  try {
    if (!assertAdminRole(req, res)) return;

    const defaults = require('../../data/concession_class_defaults.json');
    return res.json({
      classes:       { A: defaults['A'], B: defaults['B'], C: defaults['C'] },
      fallback:      defaults['_defaults_fallback'],
      meta:          defaults['_meta'],
      note:          defaults['_comment'],
    });
  } catch (error: unknown) {
    logger.error('[M07] Concession defaults fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to load concession defaults' });
  }
});

// ============================================================================
// POST /concession-environment/fixtures/run
// Admin-only: run the seven test fixture scenarios and return results.
// Useful for integration verification after schema or parameter changes.
// ============================================================================
router.post('/concession-environment/fixtures/run', async (req, res) => {
  try {
    if (!assertAdminRole(req, res)) return;

    const { runFixtures } = require('../../services/concession-environment-engine.fixtures');
    const results = await runFixtures(pool);
    const allPassed = results.every((r: any) => r.passed);

    return res.json({
      all_passed: allPassed,
      passed:     results.filter((r: any) => r.passed).length,
      total:      results.length,
      results,
    });
  } catch (error: unknown) {
    logger.error('[M07] Fixture run failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Fixture run failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
