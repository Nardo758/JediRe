/**
 * Property Data Proxy Routes
 * Proxies requests to Municipal Scraper API (Cloudflare Worker)
 */

import express, { Request, Response } from 'express';
import { logger } from '../../utils/logger';

const router = express.Router();

const MUNICIPAL_SCRAPER_API = 'https://municipal-scraper.m-dixon5030.workers.dev';

/**
 * Proxy: Scrape property by address
 */
router.post('/properties/scrape', async (req: Request, res: Response) => {
  try {
    const { address, county = 'Fulton' } = req.body;

    logger.info(`[Property Proxy] Scraping property: ${address}, ${county}`);

    const response = await fetch(`${MUNICIPAL_SCRAPER_API}/api-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, county }),
    });

    const data = await response.json();

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('[Property Proxy] Scrape failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Proxy: Health check
 */
router.get('/properties/health', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MUNICIPAL_SCRAPER_API}/health`);
    const data = await response.json();

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('[Property Proxy] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Proxy: API health check
 */
router.get('/properties/api-health', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${MUNICIPAL_SCRAPER_API}/api-health`);
    const data = await response.json();

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('[Property Proxy] API health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
