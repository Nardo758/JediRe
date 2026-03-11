import { Router, Request, Response } from 'express';
import { financialModelEngine } from '../../services/financial-model-engine.service';
import { excelExportService } from '../../services/excel-export.service';
import { getPool } from '../../database/connection';

const router = Router();

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
