/**
 * M07 Calibration API Routes
 *
 * Exposes the M07 self-calibrating backend over REST:
 *
 *   POST /api/v1/calibration/rent-roll/upload
 *     → Full pipeline: detect → map → parse → store → derive
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
 *     → Get resolved coefficients for a deal (Deal → Platform → Baseline hierarchy)
 *
 *   GET  /api/v1/calibration/starting-state/:dealId
 *     → Resolve starting state for a deal (STABILIZED / LEASE_UP / REDEVELOPMENT)
 *
 *   GET  /api/v1/calibration/absorption-benchmark/:submarketId
 *     → Get platform absorption benchmark for a submarket
 *
 *   PUT  /api/v1/calibration/deal/:dealId/mode
 *     → Update deal_mode (STABILIZED / LEASE_UP / REDEVELOPMENT)
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
import { logger } from '../../utils/logger';

const router = Router();

// Services
const rentRollParser = new RentRollParserService(pool);
const derivationsService = new RentRollDerivationsService(pool);
const startingStateService = new StartingStateService(pool);
const coefficientResolver = new CoefficientResolverService(pool);
const calibrationJob = new TrafficCalibrationJob(pool);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rentRollMiddleware = rentRollUpload.single('file') as any as RequestHandler;

// ============================================================================
// Authorization helper: verify the authenticated user owns the deal.
// Returns the deal row on success, or responds with 403/404 and returns null.
// ============================================================================
async function assertDealOwnership(req: Request, res: Response, dealId: string): Promise<boolean> {
  // req.user is set by requireAuth middleware; cast to the augmented interface.
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
    // Return 404 to avoid leaking deal existence to unauthorised callers
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
// Full pipeline: detect → map → parse → store → derive
// ============================================================================
router.post('/rent-roll/upload', rentRollMiddleware, async (req, res) => {
  try {
    const file = req.file;
    const dealId = req.body['dealId'];

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded. Accepted formats: CSV, XLSX, XLS' });
    }
    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    // Verify the caller owns this deal before touching its data
    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    // Step 1: Parse and store
    const parseResult = await rentRollParser.parseAndStore(file.path, dealId);

    // Step 2: Run derivations immediately
    const derived = await derivationsService.deriveAndStore(parseResult.snapshot_id);

    // Mark snapshot as calibrated-ready
    await pool.query(
      `UPDATE rent_roll_snapshots SET status = 'derived' WHERE id = $1`,
      [parseResult.snapshot_id],
    );

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

    // Resolve the deal that owns this snapshot and verify access
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
             extraction_confidence, snapshot_date, status, error_message, created_at
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

    const lookbackHours = parseInt(req.body['lookbackHours'] || '720');  // default: 30 days

    logger.info('[M07] Manual calibration job triggered', { lookbackHours });
    const result = await calibrationJob.run(lookbackHours);

    return res.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    logger.error('[M07] Calibration job failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Calibration job failed', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /coefficients/:dealId
// Get resolved coefficients for a deal (Deal → Platform → Baseline)
// ============================================================================
router.get('/coefficients/:dealId', async (req, res) => {
  try {
    const dealId = req.params['dealId'];

    const authorized = await assertDealOwnership(req, res, dealId);
    if (!authorized) return;

    // Load deal context from JSONB fields (deals has no properties FK)
    const dealResult = await pool.query<any>(`
      SELECT
        (d.deal_data->'market_intelligence'->'data'->'demographics'->'submarket'->>'id') AS submarket_id,
        (d.deal_data->>'property_class') AS property_class,
        (d.deal_data->>'year_built') AS year_built
      FROM deals d
      WHERE d.id = $1
    `, [dealId]);

    // Ownership was confirmed above; if 0 rows here it's a race condition
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

    return res.json({
      deal_id: dealId,
      starting_state: state,
    });
  } catch (error: unknown) {
    logger.error('[M07] Starting state resolution failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to resolve starting state', message: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================================================
// GET /absorption-benchmark/:submarketId
// Get platform absorption benchmark for a submarket (no deal ownership needed —
// submarket benchmarks are aggregated platform-level data, not deal-specific)
// ============================================================================
router.get('/absorption-benchmark/:submarketId', async (req, res) => {
  try {
    const submarketId = req.params['submarketId'];
    const { property_class, size_band } = req.query;

    // size_band is stored in vintage_band as "size:<band>" (e.g. "size:medium").
    // Filter deterministically by (submarket, class, size_band) so callers always
    // get the same row for the same tuple rather than relying on ORDER BY recency.
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
// Update deal_mode (STABILIZED / LEASE_UP / REDEVELOPMENT)
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

    return res.json({
      success: true,
      deal_id: dealId,
      deal_mode: result.rows[0].deal_mode,
    });
  } catch (error: unknown) {
    logger.error('[M07] Deal mode update failed', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to update deal mode', message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
