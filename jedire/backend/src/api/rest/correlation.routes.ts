import { Router, Request, Response } from 'express';
import { pool } from '../../database';
import { CorrelationEngineService } from '../../services/correlationEngine.service';

const router = Router();
const engine = new CorrelationEngineService(pool);

router.get('/report', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const report = await engine.computeCorrelations(city, state);
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('Correlation report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const report = await engine.computeForProperty(propertyId, city, state);
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('Property correlation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/metric/:metricId', async (req: Request, res: Response) => {
  try {
    const { metricId } = req.params;
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const report = await engine.computeCorrelations(city, state);
    const metric = report.correlations.find(c => c.id === metricId.toUpperCase());
    if (!metric) {
      return res.status(404).json({ success: false, error: `Metric ${metricId} not found` });
    }
    res.json({ success: true, data: metric });
  } catch (error: any) {
    console.error('Metric correlation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const state = (req.query.state as string) || 'GA';
    const report = await engine.computeCorrelations(city, state);
    res.json({
      success: true,
      data: {
        market: report.market,
        computedAt: report.computedAt,
        metricsComputed: report.metricsComputed,
        metricsSkipped: report.metricsSkipped,
        summary: report.summary,
        signals: report.correlations
          .filter(c => c.confidence !== 'insufficient')
          .map(c => ({ id: c.id, name: c.name, signal: c.signal, actionable: c.actionable })),
      },
    });
  } catch (error: any) {
    console.error('Correlation summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
