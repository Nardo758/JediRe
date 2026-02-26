import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { RegulatoryAlertService } from '../../services/regulatory-alert.service';

const router = Router();
const pool = getPool();
const alertService = new RegulatoryAlertService(pool);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { municipality, state, category, severity, activeOnly, limit, offset } = req.query;
    const result = await alertService.list({
      municipality: municipality as string,
      state: state as string,
      category: category as string,
      severity: severity as string,
      activeOnly: activeOnly !== 'false',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ success: true, data: result.alerts, total: result.total });
  } catch (error: any) {
    console.error('List alerts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/municipality/:municipality', async (req: Request, res: Response) => {
  try {
    const { municipality } = req.params;
    const { state } = req.query;
    const alerts = await alertService.getByMunicipality(municipality, state as string);
    res.json({ success: true, data: alerts });
  } catch (error: any) {
    console.error('Get alerts by municipality error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/strategy-matrix', async (req: Request, res: Response) => {
  try {
    const { municipality, state } = req.query;
    if (!municipality) {
      return res.status(400).json({ success: false, error: 'municipality is required' });
    }
    const matrix = await alertService.getStrategyImpactMatrix(
      municipality as string,
      state as string
    );
    res.json({ success: true, data: matrix });
  } catch (error: any) {
    console.error('Strategy matrix error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { municipality } = req.query;
    const breakdown = await alertService.getCategoryBreakdown(municipality as string);
    res.json({ success: true, data: breakdown });
  } catch (error: any) {
    console.error('Category breakdown error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const alert = await alertService.getById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error: any) {
    console.error('Get alert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { municipality, state, category, severity, title } = req.body;
    if (!municipality || !state || !category || !title) {
      return res.status(400).json({
        success: false,
        error: 'municipality, state, category, and title are required',
      });
    }
    const alert = await alertService.create(req.body);
    res.status(201).json({ success: true, data: alert });
  } catch (error: any) {
    console.error('Create alert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const alert = await alertService.deactivate(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error: any) {
    console.error('Deactivate alert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Regulatory Risk Scoring (Phase 4b — M14 integration)
// ============================================================================
import { regulatoryRiskScoringService } from '../../services/regulatory-risk-scoring.service';

/** POST /score-risk - Calculate composite regulatory risk score */
router.post('/score-risk', async (req: Request, res: Response) => {
  try {
    const { dealId, municipality, state, developmentPath, categories } = req.body;
    if (!dealId || !categories?.length) {
      return res.status(400).json({ error: 'Required: dealId, categories[]' });
    }
    const result = await regulatoryRiskScoringService.scoreRegulatory({
      dealId,
      municipality: municipality || '',
      state: state || '',
      developmentPath,
      categories,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Regulatory risk scoring error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
