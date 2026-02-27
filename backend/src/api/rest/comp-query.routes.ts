import { Router, Request, Response } from 'express';
import { compQueryService } from '../../services/comp-query.service';
import {
  searchComps as searchCompsV2,
  getRentComps,
  getSubmarketStats,
} from '../../services/compQueryEngine';

const router = Router();

router.post('/search', async (req: Request, res: Response) => {
  try {
    const results = await compQueryService.searchComps(req.body);
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search/v2', async (req: Request, res: Response) => {
  try {
    const response = await searchCompsV2(req.body);
    res.json({ success: true, ...response });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const results = await compQueryService.findCompsForProperty(req.params.propertyId);
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/property/:propertyId/rent-comps', async (req: Request, res: Response) => {
  try {
    const radiusMiles = req.query.radius ? parseFloat(req.query.radius as string) : 3.0;
    const result = await getRentComps(req.params.propertyId, radiusMiles);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/submarket/:submarketId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getSubmarketStats(req.params.submarketId);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await compQueryService.getCompSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
