import { Router, Request, Response } from 'express';
import { pool } from '../../database';
import { MacroIndicatorsService } from '../../services/macro-indicators.service';
import { SearchGrowthIndexService, SearchGrowthResult } from '../../services/search-growth-index.service';
import { logger } from '../../utils/logger';

const router = Router();
const macroService = new MacroIndicatorsService(pool);
const searchGrowthService = new SearchGrowthIndexService(pool);

router.get('/oil', async (_req: Request, res: Response) => {
  try {
    const result = await macroService.getLatestOilPrice();
    if (!result) {
      return res.status(404).json({ success: false, error: 'No oil price data available yet.' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[MacroIndicators] Oil price fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get oil price', message: error.message });
  }
});

router.post('/oil', async (req: Request, res: Response) => {
  try {
    const { price, periodDate, source } = req.body;
    if (typeof price !== 'number' || !periodDate) {
      return res.status(400).json({ success: false, error: 'price (number) and periodDate (YYYY-MM-DD) are required' });
    }
    await macroService.storeOilPrice(price, periodDate, source);
    res.json({ success: true, stored: { metricId: 'MACRO_OIL_PRICE', price, periodDate } });
  } catch (error: any) {
    logger.error('[MacroIndicators] Oil price store failed', { error: error.message });
    res.status(500).json({ error: 'Failed to store oil price', message: error.message });
  }
});

router.get('/cpi', async (req: Request, res: Response) => {
  try {
    const msaGeoId = (req.query.msaGeoId as string) || 'national';
    const result = await macroService.getLatestCpi(msaGeoId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'No CPI data available yet.' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[MacroIndicators] CPI fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get CPI', message: error.message });
  }
});

router.get('/cpi/shadow', async (req: Request, res: Response) => {
  try {
    const msaGeoId = (req.query.msaGeoId as string) || 'national';
    const result = await macroService.getLatestShadowCpi(msaGeoId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'No CPI data available to compute ShadowStats CPI.' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[MacroIndicators] ShadowStats CPI fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get ShadowStats CPI', message: error.message });
  }
});

router.get('/cpi/comparison', async (req: Request, res: Response) => {
  try {
    const msaGeoId = (req.query.msaGeoId as string) || 'national';
    const result = await macroService.getCpiComparison(msaGeoId);
    res.json({
      success: true,
      msaGeoId,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MacroIndicators] CPI comparison failed', { error: error.message });
    res.status(500).json({ error: 'Failed to get CPI comparison', message: error.message });
  }
});

router.post('/cpi', async (req: Request, res: Response) => {
  try {
    const { officialCpiYoY, periodDate, msaGeoId, msaName } = req.body;
    if (typeof officialCpiYoY !== 'number' || !periodDate) {
      return res.status(400).json({
        success: false,
        error: 'officialCpiYoY (number, YoY %) and periodDate (YYYY-MM-DD) are required',
      });
    }
    const result = await macroService.storeOfficialAndShadowCpi(
      officialCpiYoY,
      periodDate,
      msaGeoId || 'national',
      msaName || 'National'
    );
    res.json({ success: true, stored: true, data: result });
  } catch (error: any) {
    logger.error('[MacroIndicators] CPI store failed', { error: error.message });
    res.status(500).json({ error: 'Failed to store CPI data', message: error.message });
  }
});

router.get('/search-growth/:geographyType/:geographyId', async (req: Request, res: Response) => {
  try {
    const { geographyType, geographyId } = req.params;
    const validTypes = ['submarket', 'zip', 'county', 'msa'];
    if (!validTypes.includes(geographyType)) {
      return res.status(400).json({
        success: false,
        error: `geographyType must be one of: ${validTypes.join(', ')}`,
      });
    }

    const result = await searchGrowthService.computeForGeography(geographyType, geographyId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No search volume data available for this geography.',
      });
    }

    res.json({
      success: true,
      metric: 'C_SEARCH_GROWTH_INDEX',
      metricName: 'Search Growth Index (SGI)',
      formula: '(Current Search Index − Historical Avg) / Historical Avg × 100',
      data: result,
    });
  } catch (error: any) {
    logger.error('[MacroIndicators] Search growth index compute failed', { error: error.message });
    res.status(500).json({ error: 'Failed to compute Search Growth Index', message: error.message });
  }
});

router.post('/search-growth/:geographyType/:geographyId/store', async (req: Request, res: Response) => {
  try {
    const { geographyType, geographyId } = req.params;
    const result = await searchGrowthService.computeAndStore(geographyType, geographyId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No search volume data available for this geography.',
      });
    }

    res.json({
      success: true,
      metric: 'C_SEARCH_GROWTH_INDEX',
      stored: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[MacroIndicators] Search growth store failed', { error: error.message });
    res.status(500).json({ error: 'Failed to store Search Growth Index', message: error.message });
  }
});

router.post('/search-growth/batch', async (req: Request, res: Response) => {
  try {
    const { geographies } = req.body;
    if (!Array.isArray(geographies) || geographies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'geographies array is required: [{geographyType, geographyId}]',
      });
    }

    const results: SearchGrowthResult[] = [];
    const errors: Array<{ geographyId: string; error: string }> = [];
    const skipped: string[] = [];

    for (const geo of geographies.slice(0, 100)) {
      if (!geo.geographyType || !geo.geographyId) {
        errors.push({ geographyId: geo.geographyId || 'unknown', error: 'Missing geographyType or geographyId' });
        continue;
      }
      try {
        const r = await searchGrowthService.computeAndStore(geo.geographyType, geo.geographyId);
        if (r) {
          results.push(r);
        } else {
          skipped.push(geo.geographyId);
        }
      } catch (err: any) {
        errors.push({ geographyId: geo.geographyId, error: err.message });
      }
    }

    res.json({
      success: true,
      metric: 'C_SEARCH_GROWTH_INDEX',
      computed: results.length,
      skipped: skipped.length,
      failed: errors.length,
      requested: geographies.length,
      data: results,
      skippedIds: skipped.length > 0 ? skipped : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('[MacroIndicators] Batch search growth failed', { error: error.message });
    res.status(500).json({ error: 'Failed to compute batch Search Growth Index', message: error.message });
  }
});

export default router;
