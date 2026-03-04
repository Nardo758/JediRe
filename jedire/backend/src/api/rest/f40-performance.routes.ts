import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { f40PerformanceScoreService } from '../../services/f40-performance-score.service';

const router = Router();

router.use(requireAuth);

router.get('/market', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const result = await f40PerformanceScoreService.calculateMarketF40(city, state);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('F40 market calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rankings', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const result = await f40PerformanceScoreService.calculateMarketF40(city, state);
    const rankings = result.submarketScores.map((sm, idx) => ({
      rank: idx + 1,
      name: sm.submarketName,
      score: sm.overallScore,
      quartile: sm.quartile,
      propertiesCount: sm.propertiesCount,
      totalUnits: sm.totalUnits,
      dimensions: sm.dimensions,
    }));
    res.json({ success: true, data: { rankings, marketGrade: result.marketGrade, trendDirection: result.trendDirection } });
  } catch (error: any) {
    console.error('F40 rankings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/comp-set', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const submarket = req.query.submarket as string;
    if (!submarket) {
      return res.status(400).json({ success: false, error: 'submarket query parameter is required' });
    }
    const result = await f40PerformanceScoreService.getCompSetForSubmarket(city, submarket, state);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('F40 comp-set error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const city = (req.body.city as string) || (req.query.city as string) || 'Atlanta';
    const state = (req.body.state as string) || (req.query.state as string) || 'GA';
    const result = await f40PerformanceScoreService.calculateMarketF40(city, state);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('F40 calculate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
