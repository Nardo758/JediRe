/**
 * CoStar Comp Upload Routes — Task #1407 Wave B
 *
 * D-COSTAR-1: Parse operator-uploaded CoStar CSV/Excel exports into the
 * platform comp pool (market_sale_comps, market_rent_comps,
 * costar_submarket_stats).
 *
 * D-COSTAR-2: Two-phase commit with per-row operator preview and override
 * before any DB writes.
 *
 * Endpoints
 * ─────────
 * POST /api/v1/deals/:dealId/costar/preview
 *   body: multipart/form-data  { file, compType?, snapshotDate?, dataAsOf? }
 *   Returns: CompPreviewResult — parsed rows with validation state + dedup flags.
 *   No DB writes.
 *
 * POST /api/v1/deals/:dealId/costar/commit
 *   body: multipart/form-data  { file, compType?, snapshotDate?, dataAsOf?,
 *                                 overrides (JSON string) }
 *   Returns: CompUploadResult — inserted / skipped / error counts.
 *   Writes to comp pool.
 *
 * GET  /api/v1/deals/:dealId/costar/summary
 *   Returns counts of CoStar comps associated with this deal across all tables.
 *
 * DELETE /api/v1/deals/:dealId/costar/:compType
 *   Removes all CoStar-uploaded comps of a type for this deal.
 *   Useful during re-upload workflows.
 *
 * Column-mapping spec (documented here for maintainability)
 * ──────────────────────────────────────────────────────────
 * Sale comps (§7.1 comp-profiles-spec.md):
 *   Address         → address
 *   City            → city
 *   State           → state
 *   Zip / Zip Code  → zip
 *   County          → county
 *   MSA             → msa
 *   Submarket       → submarket
 *   Property Name   → property_name
 *   # Units / Units → units
 *   Bldg SF         → sqft
 *   Year Built      → year_built
 *   Building Class  → asset_class
 *   # Stories       → stories
 *   Sale Date       → sale_date          (required)
 *   Sale Price      → sale_price         (required)
 *   Cap Rate        → cap_rate
 *   Buyer           → buyer
 *   Seller          → seller
 *   Latitude        → latitude
 *   Longitude       → longitude
 *
 * Rent comps (§7.2 comp-profiles-spec.md):
 *   Address                 → address
 *   City                    → city
 *   State                   → state
 *   Asking Rent/Unit        → avg_asking_rent   (required)
 *   Effective Rent/Unit     → avg_effective_rent
 *   Occupancy               → occupancy_pct
 *   Concession %            → concession_pct
 *   Year Built              → year_built
 *   # Units / Units         → units
 *   Building Class          → asset_class
 *   Submarket               → submarket
 *   MSA                     → msa
 *   Latitude / Longitude    → latitude / longitude
 *
 * Submarket performance (§7.3):
 *   Submarket        → submarket         (required)
 *   Market / MSA     → msa
 *   City             → city
 *   State            → state
 *   Period / Date    → period_date       (required)
 *   Vacancy Rate     → vacancy_rate
 *   Asking Rent/Unit → asking_rent_per_unit
 *   Eff Rent/Unit    → effective_rent_per_unit
 *   Rent Growth      → yoy_rent_growth
 *   Net Absorption   → absorption_units
 *   Deliveries       → net_deliveries_units
 *   Inventory        → total_inventory_units
 *   Under Const.     → under_construction_units
 *   Occupancy        → occupancy_pct
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import {
  previewCoStarUpload,
  commitCoStarUpload,
  CompType,
  RowOverride,
} from '../../services/valuation/costar-comp-upload.service';

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(csv|xls|xlsx)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are accepted.'));
    }
  },
});

export function createCoStarUploadRoutes(pool: Pool): Router {
  const router = Router({ mergeParams: true });

  // ── Preview ────────────────────────────────────────────────────────────────
  router.post(
    '/preview',
    requireAuth,
    memUpload.single('file') as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { dealId } = req.params;
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded.' });
        }

        const compType = (req.body.compType as CompType | undefined);
        const snapshotDate = req.body.snapshotDate as string | undefined;
        const dataAsOf = req.body.dataAsOf as string | undefined;

        const result = await previewCoStarUpload(pool, {
          buffer: req.file.buffer,
          filename: req.file.originalname,
          compType,
          snapshotDate,
          dataAsOf,
          dealId,
        });

        return res.json(result);
      } catch (err: any) {
        console.error('[CoStar/preview]', err.message);
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // ── Commit ─────────────────────────────────────────────────────────────────
  router.post(
    '/commit',
    requireAuth,
    memUpload.single('file') as any,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { dealId } = req.params;
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded.' });
        }

        const compType = (req.body.compType as CompType | undefined);
        const snapshotDate = req.body.snapshotDate as string | undefined;
        const dataAsOf = req.body.dataAsOf as string | undefined;

        let overrides: RowOverride[] = [];
        if (req.body.overrides) {
          try {
            overrides = JSON.parse(req.body.overrides);
          } catch {
            return res.status(400).json({ error: 'overrides must be a valid JSON array.' });
          }
        }

        const result = await commitCoStarUpload(pool, {
          buffer: req.file.buffer,
          filename: req.file.originalname,
          compType,
          snapshotDate,
          dataAsOf,
          overrides,
          dealId,
        });

        return res.json(result);
      } catch (err: any) {
        console.error('[CoStar/commit]', err.message);
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;

      const [saleRes, rentRes, subRes] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) AS count, MIN(sale_date) AS earliest, MAX(sale_date) AS latest
           FROM market_sale_comps
           WHERE source = 'costar_upload' AND deal_id = $1::uuid`,
          [dealId]
        ),
        pool.query(
          `SELECT COUNT(*) AS count, MIN(snapshot_date) AS earliest, MAX(snapshot_date) AS latest
           FROM market_rent_comps
           WHERE source = 'costar_upload' AND deal_id = $1::uuid`,
          [dealId]
        ),
        pool.query(
          `SELECT COUNT(*) AS count, MIN(period_date) AS earliest, MAX(period_date) AS latest
           FROM costar_submarket_stats
           WHERE deal_id = $1::uuid`,
          [dealId]
        ).catch(() => ({ rows: [{ count: '0', earliest: null, latest: null }] })),
      ]);

      return res.json({
        dealId,
        sale: {
          count: parseInt(saleRes.rows[0].count),
          earliest: saleRes.rows[0].earliest,
          latest: saleRes.rows[0].latest,
        },
        rent: {
          count: parseInt(rentRes.rows[0].count),
          earliest: rentRes.rows[0].earliest,
          latest: rentRes.rows[0].latest,
        },
        submarket: {
          count: parseInt(subRes.rows[0].count),
          earliest: subRes.rows[0].earliest,
          latest: subRes.rows[0].latest,
        },
        total: parseInt(saleRes.rows[0].count) + parseInt(rentRes.rows[0].count) + parseInt(subRes.rows[0].count),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Delete by type ─────────────────────────────────────────────────────────
  router.delete('/:compType', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId, compType } = req.params;

      if (compType === 'sale') {
        const r = await pool.query(
          `DELETE FROM market_sale_comps WHERE source = 'costar_upload' AND deal_id = $1::uuid`,
          [dealId]
        );
        return res.json({ deleted: r.rowCount, compType: 'sale' });
      } else if (compType === 'rent') {
        const r = await pool.query(
          `DELETE FROM market_rent_comps WHERE source = 'costar_upload' AND deal_id = $1::uuid`,
          [dealId]
        );
        return res.json({ deleted: r.rowCount, compType: 'rent' });
      } else if (compType === 'submarket') {
        const r = await pool.query(
          `DELETE FROM costar_submarket_stats WHERE deal_id = $1::uuid`,
          [dealId]
        );
        return res.json({ deleted: r.rowCount, compType: 'submarket' });
      } else {
        return res.status(400).json({ error: `Unknown comp type: ${compType}` });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
