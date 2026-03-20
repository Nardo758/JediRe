import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { DealTimelineService } from '../../services/deal-timeline.service';

const router = Router();
const pool = getPool();
const timelineService = new DealTimelineService(pool);

router.get('/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const timelines = await timelineService.getByDeal(req.params.dealId);
    res.json({ success: true, data: timelines });
  } catch (error: any) {
    console.error('Get deal timelines error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { dealId, scenario } = req.body;
    if (!dealId || !scenario) {
      return res.status(400).json({ success: false, error: 'dealId and scenario are required' });
    }
    const timeline = await timelineService.generateTimeline(req.body);
    res.status(201).json({ success: true, data: timeline });
  } catch (error: any) {
    console.error('Generate timeline error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/benchmarks/:municipality', async (req: Request, res: Response) => {
  try {
    const { municipality } = req.params;
    const { state } = req.query;
    const benchmarks = await timelineService.getBenchmarksByMunicipality(
      municipality,
      state as string
    );
    res.json({ success: true, data: benchmarks });
  } catch (error: any) {
    console.error('Get benchmarks error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/jurisdiction-comparison', async (req: Request, res: Response) => {
  try {
    const { municipalities } = req.query;
    if (!municipalities) {
      return res.status(400).json({ success: false, error: 'municipalities query param is required (comma-separated)' });
    }
    const municipalityList = (municipalities as string).split(',').map(m => m.trim());
    const comparison = await timelineService.getJurisdictionComparison(municipalityList);
    res.json({ success: true, data: comparison });
  } catch (error: any) {
    console.error('Jurisdiction comparison error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/carrying-costs/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { scenario } = req.query;
    const costs = await timelineService.getCarryingCosts(dealId, scenario as string);
    res.json({ success: true, data: costs });
  } catch (error: any) {
    console.error('Get carrying costs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const timeline = await timelineService.getById(req.params.id);
    if (!timeline) {
      return res.status(404).json({ success: false, error: 'Timeline not found' });
    }
    res.json({ success: true, data: timeline });
  } catch (error: any) {
    console.error('Get timeline error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
