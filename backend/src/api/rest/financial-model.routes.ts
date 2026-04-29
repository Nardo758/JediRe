import { Router, Request, Response } from 'express';
import { financialModelEngine } from '../../services/financial-model-engine.service';
import { excelExportService } from '../../services/excel-export.service';
import { getPool } from '../../database/connection';
import { dealVersionsService, type SaveTrigger } from '../../services/proforma/deal-versions.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireDealAccess } from '../../middleware/deal-access';

const router = Router();

// ──────────────────────────────────────────────────────────────────────────
// Save-Driven Versioning (Spec §13)
//
// All version endpoints are gated by requireAuth + requireDealAccess so that
// the audit trail cannot be read or written across tenants. Authentication is
// enforced first, then deal-level org membership is checked against the
// authenticated user.
// ──────────────────────────────────────────────────────────────────────────

router.get(
  '/:dealId/versions',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const versions = await dealVersionsService.listVersions(req.params.dealId);
      return res.json({ success: true, data: versions });
    } catch (error: any) {
      console.error('List versions error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  '/:dealId/versions',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dealId } = req.params;
      // Audit-integrity: server is authoritative for `created_by`, `model_versions`,
      // and `override_divergences` (Spec §13). Client-supplied values for those
      // fields are intentionally ignored to prevent audit-trail tampering.
      const { snapshot, trigger, note } = req.body ?? {};
      if (!snapshot || typeof snapshot !== 'object') {
        return res.status(400).json({ error: 'snapshot (object) is required' });
      }
      const allowedTriggers: SaveTrigger[] = ['user_save', 'chat_command', 'auto_prompt'];
      const safeTrigger: SaveTrigger | undefined =
        trigger && allowedTriggers.includes(trigger) ? trigger : undefined;
      const userId = (req.user as any)?.userId ?? null;
      const row = await dealVersionsService.saveVersion({
        dealId,
        userId,
        snapshot,
        // modelVersions + divergences intentionally omitted — server stamps them.
        trigger: safeTrigger,
        note: note ?? null,
      });
      return res.status(201).json({ success: true, data: row });
    } catch (error: any) {
      console.error('Save version error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  '/:dealId/versions/:versionNumber',
  requireAuth,
  requireDealAccess,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const versionNumber = Number(req.params.versionNumber);
      if (!Number.isFinite(versionNumber) || versionNumber < 1) {
        return res.status(400).json({ error: 'versionNumber must be a positive integer' });
      }
      const version = await dealVersionsService.getVersion(req.params.dealId, versionNumber);
      if (!version) return res.status(404).json({ error: 'version not found' });
      return res.json({ success: true, data: version });
    } catch (error: any) {
      console.error('Get version error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
);

router.post('/build', async (req: Request, res: Response) => {
  try {
    const { dealId, assumptions } = req.body;
    if (!dealId || !assumptions) {
      return res.status(400).json({ error: 'dealId and assumptions are required' });
    }
    const result = await financialModelEngine.buildModel(dealId, assumptions);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Financial model build error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to build financial model' });
  }
});

router.get('/:dealId/latest', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const model = await financialModelEngine.getLatestModel(dealId);
    if (!model) {
      return res.status(404).json({ error: 'No completed model found for this deal' });
    }
    return res.json({ success: true, data: model });
  } catch (error: any) {
    console.error('Get latest model error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:dealId/export/excel', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const model = await financialModelEngine.getLatestModel(dealId);
    if (!model) {
      return res.status(404).json({ error: 'No completed model found. Build a model first.' });
    }

    if (!model.results?.annualCashFlow || !Array.isArray(model.results.annualCashFlow)) {
      return res.status(400).json({ error: 'Model results incomplete — no annual cash flow data available for export' });
    }

    const filepath = await excelExportService.generateWorkbook(dealId, model.assumptions, model.results);

    const fs = await import('fs');
    if (!fs.existsSync(filepath)) {
      return res.status(500).json({ error: 'Excel file generation failed' });
    }

    const pool = getPool();
    await pool.query(
      `UPDATE deal_financial_models SET excel_path = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM deal_financial_models WHERE deal_id = $2 AND status = 'complete' ORDER BY created_at DESC LIMIT 1)`,
      [filepath, dealId]
    );

    return res.download(filepath, undefined, (err) => {
      if (err && !res.headersSent) {
        console.error('Excel download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
  } catch (error: any) {
    console.error('Excel export error:', error.message, error.stack);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
