import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { opportunityEngineService } from '../../services/opportunity-engine.service';

const router = Router();

router.use(requireAuth);

router.get('/detect', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const result = await opportunityEngineService.detectOpportunities(city);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Opportunity detection failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to detect opportunities' });
  }
});

router.get('/rankings', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await opportunityEngineService.detectOpportunities(city);
    const ranked = result.opportunities.slice(0, limit);
    res.json({
      success: true,
      data: {
        rankings: ranked,
        summary: result.marketSummary,
        calculatedAt: result.calculatedAt,
      },
    });
  } catch (error: any) {
    console.error('Opportunity rankings failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get rankings' });
  }
});

export default router;
