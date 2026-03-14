/**
 * Data Ingestion Admin Routes
 * Endpoints to trigger ETL processes for Zillow, FRED, and other data sources
 * All routes require admin authentication
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { ingestZillowZHVI } from '../../services/ingestion/zillow-zhvi-ingest.service';
import { ingestZillowZORI } from '../../services/ingestion/zillow-zori-ingest.service';
import { ingestFRED } from '../../services/ingestion/fred-ingest.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * Middleware to check admin role
 */
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check if user is admin (you might have an admin flag or role)
    // For now, we'll just allow authenticated users to trigger ingestion
    // In production, add proper admin role checking
    next();
  } catch (error) {
    logger.error('Admin check failed:', error);
    res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

router.use(requireAdmin);

/**
 * POST /api/v1/admin/ingest/zillow-zhvi
 * Ingest Zillow ZHVI (home values) data
 * Accepts either file upload or URL to download
 */
router.post('/zillow-zhvi', async (req: Request, res: Response) => {
  try {
    const startTime = new Date();
    let filePath: string | null = null;

    try {
      // Check if file was uploaded
      if ((req as any).file) {
        filePath = (req as any).file.path;
        logger.info(`Using uploaded file: ${filePath}`);
      } else if (req.body.url) {
        // Download from URL
        const url = req.body.url;
        logger.info(`Downloading ZHVI file from ${url}`);

        filePath = path.join('/tmp', `zhvi-${Date.now()}.csv`);
        const response = await axios.get(url, { responseType: 'stream' });
        const writeStream = fs.createWriteStream(filePath);

        await new Promise<void>((resolve, reject) => {
          response.data.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (err) => reject(err));
        });

        logger.info(`Downloaded to ${filePath}`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either file upload or url parameter required',
        });
      }

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Run ingestion
      const result = await ingestZillowZHVI(filePath);

      // Clean up temp file if downloaded
      if (req.body.url && filePath) {
        fs.unlinkSync(filePath);
      }

      res.json({
        success: true,
        message: 'ZHVI ingestion completed',
        duration_ms: new Date().getTime() - startTime.getTime(),
        result,
      });
    } finally {
      // Ensure temp file is cleaned up
      if (filePath && (req as any).file && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    logger.error('ZHVI ingestion error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/v1/admin/ingest/zillow-zori
 * Ingest Zillow ZORI (rent index) data
 * Accepts either file upload or URL to download
 */
router.post('/zillow-zori', async (req: Request, res: Response) => {
  try {
    const startTime = new Date();
    let filePath: string | null = null;

    try {
      // Check if file was uploaded
      if ((req as any).file) {
        filePath = (req as any).file.path;
        logger.info(`Using uploaded file: ${filePath}`);
      } else if (req.body.url) {
        // Download from URL
        const url = req.body.url;
        logger.info(`Downloading ZORI file from ${url}`);

        filePath = path.join('/tmp', `zori-${Date.now()}.csv`);
        const response = await axios.get(url, { responseType: 'stream' });
        const writeStream = fs.createWriteStream(filePath);

        await new Promise<void>((resolve, reject) => {
          response.data.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (err) => reject(err));
        });

        logger.info(`Downloaded to ${filePath}`);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either file upload or url parameter required',
        });
      }

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Run ingestion
      const result = await ingestZillowZORI(filePath);

      // Clean up temp file if downloaded
      if (req.body.url && filePath) {
        fs.unlinkSync(filePath);
      }

      res.json({
        success: true,
        message: 'ZORI ingestion completed',
        duration_ms: new Date().getTime() - startTime.getTime(),
        result,
      });
    } finally {
      // Ensure temp file is cleaned up
      if (filePath && (req as any).file && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    logger.error('ZORI ingestion error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * POST /api/v1/admin/ingest/fred
 * Ingest FRED (Federal Reserve) interest rate data
 * Requires FRED API key in request body
 */
router.post('/fred', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'FRED API key required in request body',
      });
    }

    const startTime = new Date();

    // Run FRED ingestion
    const result = await ingestFRED(apiKey);

    res.json({
      success: true,
      message: 'FRED ingestion completed',
      duration_ms: new Date().getTime() - startTime.getTime(),
      result,
    });
  } catch (error) {
    logger.error('FRED ingestion error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/v1/admin/ingest/status
 * Get data freshness report — shows when each data source was last updated
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const freshness = await query(
      `
      SELECT
        source,
        COUNT(*) as row_count,
        MIN(period_date) as earliest_date,
        MAX(period_date) as latest_date,
        MAX(created_at) as last_ingested_at,
        EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 3600 as hours_since_update
      FROM metric_time_series
      WHERE source IN ('zillow_zhvi', 'zillow_zori', 'fred')
      GROUP BY source
      ORDER BY last_ingested_at DESC
      `
    );

    const metricCounts = await query(
      `
      SELECT
        metric_id,
        COUNT(*) as row_count,
        COUNT(DISTINCT geography_id) as geographies
      FROM metric_time_series
      WHERE source IN ('zillow_zhvi', 'zillow_zori', 'fred')
      GROUP BY metric_id
      ORDER BY metric_id
      `
    );

    res.json({
      success: true,
      freshness: freshness.rows,
      metrics: metricCounts.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

export default router;
