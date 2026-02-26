import { Router, Request, Response } from 'express';
import { compQueryService } from '../../services/comp-query.service';

const router = Router();

router.post('/search', async (req: Request, res: Response) => {
  try {
    const results = await compQueryService.searchComps(req.body);
    res.json({ success: true, data: results, count: results.length });
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

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await compQueryService.getCompSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
