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

// Admin endpoint: Compute time series correlations for a geography
router.post('/admin/correlations/compute', async (req: Request, res: Response) => {
  try {
    const { geographyType, geographyId, all } = req.body;

    if (!geographyType) {
      return res.status(400).json({ success: false, error: 'geographyType is required' });
    }

    if (all && geographyType === 'county') {
      // Compute for all FL counties
      const countyRes = await pool.query(
        `SELECT DISTINCT geography_id FROM metric_time_series WHERE geography_type = 'county'`
      );
      const counties = countyRes.rows.map((r: any) => r.geography_id);

      let successCount = 0;
      for (const countyId of counties) {
        try {
          await engine.computeTimeSeriesCorrelations('county', countyId);
          successCount++;
        } catch (err) {
          console.error(`Failed to compute correlations for county ${countyId}:`, err);
        }
      }

      return res.json({
        success: true,
        message: `Computed correlations for ${successCount}/${counties.length} counties`,
      });
    } else if (geographyId) {
      // Compute for specific geography
      await engine.computeTimeSeriesCorrelations(geographyType, geographyId);
      return res.json({
        success: true,
        message: `Computed correlations for ${geographyType}:${geographyId}`,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either geographyId or all:true is required',
      });
    }
  } catch (error: any) {
    console.error('Correlation computation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public endpoint: Get pre-computed correlations for a geography
router.get('/:geographyType/:geographyId', async (req: Request, res: Response) => {
  try {
    const { geographyType, geographyId } = req.params;
    const correlations = await engine.getCorrelations(geographyType, geographyId);

    res.json({
      success: true,
      count: correlations.length,
      data: correlations,
    });
  } catch (error: any) {
    console.error('Get correlations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
