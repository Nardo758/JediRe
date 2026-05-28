/**
 * Valuation Grid API Routes
 * Task #1370, Dispatch 2 / Task #1389 CoStar Upload / Task #1392 Preview+Commit
 *
 * GET  /api/v1/deals/:dealId/valuation-grid                      — compute full grid
 * PATCH /api/v1/deals/:dealId/valuation-grid/override            — save operator override
 * POST /api/v1/deals/:dealId/valuation-grid/comps/upload         — CoStar CSV/XLSX ingest (legacy)
 * POST /api/v1/deals/:dealId/valuation-grid/comps/preview        — parse file, return rows, no DB writes
 * POST /api/v1/deals/:dealId/valuation-grid/comps/commit         — insert rows with operator overrides
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { ValuationGridService } from '../../services/valuation/valuation-grid.service';
import { getPool } from '../../database/connection';
import {
  processCoStarUpload,
  previewCoStarUpload,
  commitCoStarUpload,
  detectCompType,
  type CompType,
  type RowOverride,
} from '../../services/valuation/costar-comp-upload.service';
import { compSetService } from '../../services/saleComps/compSet.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (['csv', 'xlsx', 'xls'].includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: .${ext}. Use .csv or .xlsx`));
  },
});

const router = Router();


/**
 * GET /api/v1/deals/:dealId/valuation-grid
 * Returns the full multi-method valuation grid computation.
 */
router.get('/deals/:dealId/valuation-grid', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    // Verify deal ownership (owner or admin) before computing
    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found.' });
    }

    const svc = new ValuationGridService(pool);
    const result = await svc.compute(dealId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[valuation-grid] compute error:', err);
    res.status(err.message?.includes('not found') ? 404 : 500).json({
      success: false,
      error: err.message ?? 'Failed to compute valuation grid',
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/valuation-grid/populate-subject
 * D-DEAL-2: Manually triggers subject field population for a deal's linked
 * properties row. Reads from all available sources (boundary, OM extraction,
 * rent roll, data library) and writes missing fields using COALESCE so existing
 * values are never overwritten. Safe to call multiple times.
 */
router.post('/deals/:dealId/valuation-grid/populate-subject', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found.' });
    }

    const { SubjectPopulationService } = await import('../../services/subject-population.service');
    const svc = new SubjectPopulationService(pool);
    const populationResult = await svc.populateSubjectFields(dealId);
    const completeness = await svc.checkSubjectCompleteness(dealId, 'valuation_grid');

    res.json({ success: true, data: { population: populationResult, completeness } });
  } catch (err: any) {
    console.error('[valuation-grid] populate-subject error:', err);
    res.status(500).json({
      success: false,
      error: err.message ?? 'Failed to populate subject fields',
    });
  }
});

/**
 * PATCH /api/v1/deals/:dealId/valuation-grid/override
 * Persists an operator override purchase price into deal_assumptions.valuation_override_lv.
 *
 * Body: { value: number, rationale?: string }
 */
router.patch('/deals/:dealId/valuation-grid/override', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { value, rationale } = req.body;
    const userId = req.user?.userId;
    const pool = getPool();

    // Verify deal ownership before allowing writes
    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found.' });
    }

    if (typeof value !== 'number' || value <= 0) {
      return res.status(400).json({
        success: false,
        error: 'value must be a positive number',
      });
    }

    const svc = new ValuationGridService(pool);
    await svc.saveOperatorOverride(dealId, value, rationale);

    res.json({ success: true, message: 'Valuation override saved.' });
  } catch (err: any) {
    console.error('[valuation-grid] override error:', err);
    res.status(500).json({
      success: false,
      error: err.message ?? 'Failed to save override',
    });
  }
});

/**
 * POST /api/v1/deals/:dealId/valuation-grid/comps/upload
 *
 * Accepts a CoStar CSV or XLSX export, parses it, and ingests rows into
 * market_sale_comps or market_rent_comps with source='costar_upload'.
 *
 * Body (multipart/form-data):
 *   file          — CSV or XLSX
 *   comp_type     — 'sale' | 'rent' (optional; auto-detected from headers if omitted)
 *   snapshot_date — ISO date string (required for rent comps; default: today)
 */
router.post(
  '/deals/:dealId/valuation-grid/comps/upload',
  requireAuth,
  upload.single('file') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = req.user?.userId;
      const pool = getPool();

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
      }

      const ownerCheck = await pool.query(
        `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
        [dealId, userId, req.user?.role === 'admin']
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Deal not found.' });
      }

      const compTypeRaw = (req.body.comp_type ?? '').toLowerCase();
      const compType: CompType | undefined =
        compTypeRaw === 'sale' ? 'sale' : compTypeRaw === 'rent' ? 'rent' : undefined;

      const snapshotDate: string | undefined =
        req.body.snapshot_date?.trim() || new Date().toISOString().slice(0, 10);

      const result = await processCoStarUpload(pool, {
        buffer: req.file.buffer,
        filename: req.file.originalname,
        compType,
        snapshotDate,
        fileId: null,
        dealId,
      });

      // After a successful sale comp upload, force-regenerate the comp set so
      // the new rows are immediately reflected in the Valuation Grid (PPU method).
      if (!result.rejected && result.compType === 'sale' && result.inserted > 0) {
        try {
          await compSetService.generateCompSet({ deal_id: dealId });
        } catch {
          // Non-fatal: comp set refresh may fail if the property has no coordinates.
          // The uploaded rows are already persisted and will be picked up on the next
          // grid compute once coordinates are available.
        }
      }

      const status = result.rejected ? 400 : 200;
      return res.status(status).json({ success: !result.rejected, data: result });
    } catch (err: any) {
      console.error('[valuation-grid] comp upload error:', err);
      return res.status(500).json({
        success: false,
        error: err.message ?? 'Upload failed',
      });
    }
  }
);

/**
 * POST /api/v1/deals/:dealId/valuation-grid/comps/preview
 *
 * Parses a CoStar CSV/XLSX file and returns all rows with validation status and
 * duplicate flags. Does NOT write to the database.
 *
 * Body (multipart/form-data):
 *   file          — CSV or XLSX
 *   comp_type     — 'sale' | 'rent' (optional; auto-detected from headers)
 *   snapshot_date — ISO date string (for rent comps)
 */
router.post(
  '/deals/:dealId/valuation-grid/comps/preview',
  requireAuth,
  upload.single('file') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = req.user?.userId;
      const pool = getPool();

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
      }

      const ownerCheck = await pool.query(
        `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
        [dealId, userId, req.user?.role === 'admin']
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Deal not found.' });
      }

      const compTypeRaw = (req.body.comp_type ?? '').toLowerCase();
      const compType: CompType | undefined =
        compTypeRaw === 'sale' ? 'sale' : compTypeRaw === 'rent' ? 'rent' : undefined;

      const snapshotDate: string =
        req.body.snapshot_date?.trim() || new Date().toISOString().slice(0, 10);

      const result = await previewCoStarUpload(pool, {
        buffer: req.file.buffer,
        filename: req.file.originalname,
        compType,
        snapshotDate,
        dealId,
      });

      const status = result.rejected ? 400 : 200;
      return res.status(status).json({ success: !result.rejected, data: result });
    } catch (err: any) {
      console.error('[valuation-grid] comp preview error:', err);
      return res.status(500).json({
        success: false,
        error: err.message ?? 'Preview failed',
      });
    }
  }
);

/**
 * POST /api/v1/deals/:dealId/valuation-grid/comps/commit
 *
 * Inserts the operator-reviewed rows into the database.
 * Accepts per-row overrides: asset_class corrections, excluded rows, overwrite flags.
 *
 * Body (multipart/form-data):
 *   file          — CSV or XLSX (same file used in /preview)
 *   comp_type     — 'sale' | 'rent'
 *   snapshot_date — ISO date string (for rent comps)
 *   overrides     — JSON string: Array<{ rowIndex, assetClass?, excluded, overwriteDuplicate }>
 */
router.post(
  '/deals/:dealId/valuation-grid/comps/commit',
  requireAuth,
  upload.single('file') as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      const userId = req.user?.userId;
      const pool = getPool();

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
      }

      const ownerCheck = await pool.query(
        `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
        [dealId, userId, req.user?.role === 'admin']
      );
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Deal not found.' });
      }

      const compTypeRaw = (req.body.comp_type ?? '').toLowerCase();
      const compType: CompType | undefined =
        compTypeRaw === 'sale' ? 'sale' : compTypeRaw === 'rent' ? 'rent' : undefined;

      const snapshotDate: string =
        req.body.snapshot_date?.trim() || new Date().toISOString().slice(0, 10);

      let overrides: RowOverride[] = [];
      try {
        overrides = JSON.parse(req.body.overrides ?? '[]');
      } catch {
        // Invalid JSON — proceed with no overrides
      }

      const result = await commitCoStarUpload(pool, {
        buffer: req.file.buffer,
        filename: req.file.originalname,
        compType,
        snapshotDate,
        fileId: null,
        dealId,
        overrides,
      });

      if (!result.rejected && result.compType === 'sale' && result.inserted > 0) {
        try {
          await compSetService.generateCompSet({ deal_id: dealId });
        } catch {
          // Non-fatal: comp set refresh may fail if the property has no coordinates.
        }
      }

      const status = result.rejected ? 400 : 200;
      return res.status(status).json({ success: !result.rejected, data: result });
    } catch (err: any) {
      console.error('[valuation-grid] comp commit error:', err);
      return res.status(500).json({
        success: false,
        error: err.message ?? 'Commit failed',
      });
    }
  }
);

// ── Task #1417 (6.1 / 6.3): Comp review endpoints ─────────────────────────

/**
 * GET /api/v1/deals/:dealId/valuation-grid/comps
 *
 * Returns the candidate comp pool for this deal with staleness labels, selection
 * criteria, and excluded-comp flags. Used by the Comp Review Panel in the UI.
 */
router.get('/deals/:dealId/valuation-grid/comps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found.' });

    const svc = new ValuationGridService(pool);
    const result = await svc.listCompsForReview(dealId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[valuation-grid] comps review error:', err);
    res.status(500).json({ success: false, error: err.message ?? 'Failed to list comps' });
  }
});

/**
 * PATCH /api/v1/deals/:dealId/valuation-grid/comps/criteria
 *
 * Persist tunable selection parameters. Accepted fields:
 *   radiusMiles, maxAgeMonths, minUnits, maxUnits, propertyClasses
 * Does NOT change excludedCompIds (use DELETE/include endpoints for that).
 */
router.patch('/deals/:dealId/valuation-grid/comps/criteria', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found.' });

    const { radiusMiles, maxAgeMonths, minUnits, maxUnits, propertyClasses } = req.body;
    const patch: Record<string, unknown> = {};
    if (typeof radiusMiles === 'number' && radiusMiles > 0 && radiusMiles <= 50) patch.radiusMiles = radiusMiles;
    if (typeof maxAgeMonths === 'number' && maxAgeMonths >= 6 && maxAgeMonths <= 120) patch.maxAgeMonths = maxAgeMonths;
    if (typeof minUnits === 'number' && minUnits >= 0) patch.minUnits = minUnits;
    if (typeof maxUnits === 'number' && maxUnits > 0) patch.maxUnits = maxUnits;
    if (Array.isArray(propertyClasses) && propertyClasses.every(c => typeof c === 'string')) patch.propertyClasses = propertyClasses;

    const svc = new ValuationGridService(pool);
    const updated = await svc.updateCompCriteria(dealId, patch as any);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[valuation-grid] comp criteria update error:', err);
    res.status(500).json({ success: false, error: err.message ?? 'Failed to update criteria' });
  }
});

/**
 * DELETE /api/v1/deals/:dealId/valuation-grid/comps/:compId
 *
 * Excludes a specific comp from this deal's scoring (operator override).
 * The comp remains in market_sale_comps but is filtered from synthesis runs.
 */
router.delete('/deals/:dealId/valuation-grid/comps/:compId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, compId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found.' });

    const svc = new ValuationGridService(pool);
    await svc.excludeComp(dealId, compId);
    res.json({ success: true, message: 'Comp excluded from this deal.' });
  } catch (err: any) {
    console.error('[valuation-grid] comp exclude error:', err);
    res.status(500).json({ success: false, error: err.message ?? 'Failed to exclude comp' });
  }
});

/**
 * POST /api/v1/deals/:dealId/valuation-grid/comps/:compId/include
 *
 * Re-includes a previously excluded comp.
 */
router.post('/deals/:dealId/valuation-grid/comps/:compId/include', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, compId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND (user_id = $2::uuid OR $3 = true)`,
      [dealId, userId, req.user?.role === 'admin']
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Deal not found.' });

    const svc = new ValuationGridService(pool);
    await svc.includeComp(dealId, compId);
    res.json({ success: true, message: 'Comp re-included.' });
  } catch (err: any) {
    console.error('[valuation-grid] comp include error:', err);
    res.status(500).json({ success: false, error: err.message ?? 'Failed to include comp' });
  }
});

export default router;
