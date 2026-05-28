/**
 * Valuation Grid API Routes
 * Task #1370, Dispatch 2 / Task #1389 CoStar Upload
 *
 * GET  /api/v1/deals/:dealId/valuation-grid                  — compute full grid
 * PATCH /api/v1/deals/:dealId/valuation-grid/override        — save operator override
 * POST /api/v1/deals/:dealId/valuation-grid/comps/upload     — CoStar CSV/XLSX ingest
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { ValuationGridService } from '../../services/valuation/valuation-grid.service';
import { getPool } from '../../database/connection';
import { processCoStarUpload, detectCompType, type CompType } from '../../services/valuation/costar-comp-upload.service';
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

export default router;
