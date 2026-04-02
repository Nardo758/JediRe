import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { ingestZillowZHVI } from '../../services/ingestion/zillow-zhvi-ingest.service';
import { ingestZillowZORI } from '../../services/ingestion/zillow-zori-ingest.service';
import { ingestFRED } from '../../services/ingestion/fred-ingest.service';
import { ingestCensusACS } from '../../services/ingestion/census-acs-ingest.service';
import { ingestAllLeaseFiles } from '../../services/ingestion/lease-rent-ingest.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const router = Router();

router.use(requireAuth);

const requireAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
  } catch (error) {
    logger.error('Admin check failed:', error);
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

router.use(requireAdmin);

router.post('/zillow-zhvi', async (req: Request, res: Response) => {
  try {
    const startTime = new Date();
    let filePath: string | null = null;

    try {
      if ((req as any).file) {
        filePath = (req as any).file.path;
      } else if (req.body.url) {
        const url = req.body.url;
        filePath = path.join('/tmp', `zhvi-${Date.now()}.csv`);
        const response = await axios.get(url, { responseType: 'stream' });
        const writeStream = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
          response.data.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (err) => reject(err));
        });
      } else {
        return res.status(400).json({ success: false, error: 'Either file upload or url parameter required' });
      }

      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

      const result = await ingestZillowZHVI(filePath);

      if (req.body.url && filePath) fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: 'ZHVI ingestion completed',
        duration_ms: new Date().getTime() - startTime.getTime(),
        result,
      });
    } finally {
      if (filePath && (req as any).file && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error('ZHVI ingestion error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/zillow-zori', async (req: Request, res: Response) => {
  try {
    const startTime = new Date();
    let filePath: string | null = null;

    try {
      if ((req as any).file) {
        filePath = (req as any).file.path;
      } else if (req.body.url) {
        const url = req.body.url;
        filePath = path.join('/tmp', `zori-${Date.now()}.csv`);
        const response = await axios.get(url, { responseType: 'stream' });
        const writeStream = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
          response.data.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (err) => reject(err));
        });
      } else {
        return res.status(400).json({ success: false, error: 'Either file upload or url parameter required' });
      }

      if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

      const result = await ingestZillowZORI(filePath);

      if (req.body.url && filePath) fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: 'ZORI ingestion completed',
        duration_ms: new Date().getTime() - startTime.getTime(),
        result,
      });
    } finally {
      if (filePath && (req as any).file && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error('ZORI ingestion error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/fred', async (req: Request, res: Response) => {
  try {
    const apiKey = req.body.apiKey || process.env.FRED_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'FRED API key required (set FRED_API_KEY env var or pass in body)' });
    }

    const startTime = new Date();
    const result = await ingestFRED(apiKey);

    res.json({
      success: true,
      message: 'FRED ingestion completed',
      duration_ms: new Date().getTime() - startTime.getTime(),
      result,
    });
  } catch (error) {
    logger.error('FRED ingestion error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/census-acs', async (req: Request, res: Response) => {
  try {
    const apiKey = req.body.apiKey || process.env.CENSUS_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'Census API key required (set CENSUS_API_KEY env var or pass in body)' });
    }

    const startTime = new Date();
    const result = await ingestCensusACS(apiKey);

    res.json({
      success: true,
      message: 'Census ACS ingestion completed',
      duration_ms: new Date().getTime() - startTime.getTime(),
      result,
    });
  } catch (error) {
    logger.error('Census ACS ingestion error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/all', async (req: Request, res: Response) => {
  try {
    const startTime = new Date();
    const results: Record<string, any> = {};

    const fredKey = req.body.fredApiKey || process.env.FRED_API_KEY;
    if (fredKey) {
      try {
        results.fred = await ingestFRED(fredKey);
      } catch (e) {
        results.fred = { error: String(e) };
      }
    } else {
      results.fred = { skipped: true, reason: 'No FRED API key' };
    }

    const censusKey = req.body.censusApiKey || process.env.CENSUS_API_KEY;
    if (censusKey) {
      try {
        results.census_acs = await ingestCensusACS(censusKey);
      } catch (e) {
        results.census_acs = { error: String(e) };
      }
    } else {
      results.census_acs = { skipped: true, reason: 'No Census API key' };
    }

    res.json({
      success: true,
      message: 'All ingestion pipelines completed',
      duration_ms: new Date().getTime() - startTime.getTime(),
      results,
    });
  } catch (error) {
    logger.error('All ingestion error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const freshness = await query(`
      SELECT
        source,
        COUNT(*) as row_count,
        COUNT(DISTINCT metric_id) as metric_count,
        COUNT(DISTINCT geography_id) as geo_count,
        MIN(period_date)::text as earliest_date,
        MAX(period_date)::text as latest_date,
        MAX(created_at)::text as last_ingested_at
      FROM metric_time_series
      GROUP BY source
      ORDER BY source
    `);

    const metricCounts = await query(`
      SELECT
        metric_id,
        COUNT(*) as row_count,
        COUNT(DISTINCT geography_id) as geographies,
        MIN(period_date)::text as earliest,
        MAX(period_date)::text as latest
      FROM metric_time_series
      GROUP BY metric_id
      ORDER BY metric_id
    `);

    res.json({
      success: true,
      freshness: freshness.rows,
      metrics: metricCounts.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

router.post('/lease-rents', async (req: Request, res: Response) => {
  try {
    const startTime = new Date();

    const results = await ingestAllLeaseFiles();

    const elapsed = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(1);
    logger.info(`Lease rent ingestion completed in ${elapsed}s`, { results });

    res.json({
      success: true,
      results,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    logger.error('Lease rent ingestion error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
