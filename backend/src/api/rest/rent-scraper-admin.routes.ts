import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';
import { RentScraperDiscoveryService } from '../../services/rent-scraper-discovery.service';
import { RentScraperService } from '../../services/rent-scraper.service';

const router = Router();
const pool = getPool();

interface BulkDiscoveryJob {
  status: 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  discovered: number;
  namesFound: number;
  failed: number;
  skipped: number;
  startedAt: Date;
  completedAt: Date | null;
  errors: string[];
}

const activeJobs = new Map<string, BulkDiscoveryJob>();
let currentJobId: string | null = null;

router.get('/discovery/status', async (_req: Request, res: Response) => {
  try {
    const counts = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE places_search_done = TRUE)                AS searched,
        COUNT(*) FILTER (WHERE website_url IS NOT NULL)                  AS with_website,
        COUNT(*) FILTER (WHERE places_search_done = FALSE
                           AND website_url IS NULL AND active = TRUE)    AS pending,
        COUNT(DISTINCT market)                                           AS markets
      FROM rent_scrape_targets
    `);

    const byMarket = await pool.query(`
      SELECT market,
             COUNT(*)                                          AS total,
             COUNT(*) FILTER (WHERE website_url IS NOT NULL)  AS discovered,
             COUNT(*) FILTER (WHERE places_search_done = FALSE
                                AND website_url IS NULL
                                AND active = TRUE)            AS pending
      FROM rent_scrape_targets
      GROUP BY market
      ORDER BY total DESC
    `);

    const job = currentJobId ? activeJobs.get(currentJobId) : null;

    res.json({
      success: true,
      counts: counts.rows[0],
      byMarket: byMarket.rows,
      activeJob: job ? { jobId: currentJobId, ...job } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/discovery/run', async (req: Request, res: Response) => {
  try {
    if (currentJobId && activeJobs.get(currentJobId)?.status === 'running') {
      return res.status(409).json({
        error: 'A discovery job is already running',
        jobId: currentJobId,
      });
    }

    const batchSize = Math.min(req.body?.batchSize || 30, 50);
    const delayMs  = Math.max(req.body?.delayMs  || 350, 100);
    const market   = req.body?.market || null;

    const countQ = market
      ? await pool.query(
          `SELECT COUNT(*) AS pending FROM rent_scrape_targets
           WHERE places_search_done = FALSE AND website_url IS NULL AND active = TRUE AND market = $1`,
          [market]
        )
      : await pool.query(
          `SELECT COUNT(*) AS pending FROM rent_scrape_targets
           WHERE places_search_done = FALSE AND website_url IS NULL AND active = TRUE`
        );

    const total = parseInt(countQ.rows[0].pending, 10);

    if (total === 0) {
      return res.json({ success: true, message: 'No pending targets — all done', total: 0 });
    }

    const jobId = `disc-${(market || 'all').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const job: BulkDiscoveryJob = {
      status: 'running',
      total,
      processed: 0,
      discovered: 0,
      namesFound: 0,
      failed: 0,
      skipped: 0,
      startedAt: new Date(),
      completedAt: null,
      errors: [],
    };
    activeJobs.set(jobId, job);
    currentJobId = jobId;

    res.json({
      success: true,
      jobId,
      total,
      message: `Discovery job started for ${total} pending targets`,
      batchSize,
      delayMs,
      estimatedMinutes: Math.ceil((total * 2 * delayMs) / 60000),
    });

    setImmediate(async () => {
      try {
        const discovery = new RentScraperDiscoveryService(pool);

        while (true) {
          const rows = market
            ? await pool.query(
                `SELECT id, address, property_name FROM rent_scrape_targets
                 WHERE places_search_done = FALSE AND website_url IS NULL AND active = TRUE AND market = $1
                 ORDER BY id ASC LIMIT $2`,
                [market, batchSize]
              )
            : await pool.query(
                `SELECT id, address, property_name FROM rent_scrape_targets
                 WHERE places_search_done = FALSE AND website_url IS NULL AND active = TRUE
                 ORDER BY id ASC LIMIT $1`,
                [batchSize]
              );

          if (rows.rows.length === 0) break;

          for (const row of rows.rows) {
            try {
              const result = await discovery.discoverById(row.id);
              if (result.websiteUrl) {
                job.discovered++;
              } else {
                job.skipped++;
              }
              if (result.nameDiscovered) {
                job.namesFound++;
              }
            } catch (err: any) {
              job.failed++;
              if (job.errors.length < 50) {
                job.errors.push(`Target ${row.id}: ${err.message}`);
              }
            }
            job.processed++;

            await new Promise(r => setTimeout(r, delayMs));
          }

          logger.info(
            `[bulk-discovery] ${job.processed}/${job.total} — ` +
            `${job.discovered} websites, ${job.namesFound} names, ${job.skipped} no-url, ${job.failed} failed`
          );
        }

        job.status = 'completed';
        job.completedAt = new Date();
        logger.info(
          `[bulk-discovery] DONE — ${job.discovered} websites, ${job.namesFound} names discovered, ` +
          `${job.failed} failed, ${job.skipped} no-url out of ${job.processed}`
        );
      } catch (err: any) {
        const j = activeJobs.get(jobId);
        if (j) {
          j.status = 'failed';
          j.completedAt = new Date();
          j.errors.push(`Job error: ${err.message}`);
        }
        logger.error(`[bulk-discovery] Job failed: ${err.message}`);
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/discovery/job/:jobId', (req: Request, res: Response) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true, jobId: req.params.jobId, ...job });
});

// ── REIT Web-Search Pass ──────────────────────────────────────────────────────
// Second-pass discovery for no-website targets: uses a regular Google search
// to find property pages on known REIT / PM company domains.

interface BulkReitSearchJob {
  status: 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  discovered: number;
  failed: number;
  startedAt: Date;
  completedAt: Date | null;
  errors: string[];
}

const activeReitJobs = new Map<string, BulkReitSearchJob>();
let currentReitJobId: string | null = null;

router.get('/discovery/reit-search/status', async (_req: Request, res: Response) => {
  try {
    const counts = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE website_url IS NULL OR website_url = '')              AS no_website,
        COUNT(*) FILTER (WHERE metadata->>'reit_search_done' = 'true')              AS reit_searched,
        COUNT(*) FILTER (WHERE (website_url IS NULL OR website_url = '')
                           AND (metadata->>'reit_search_done' IS NULL
                             OR metadata->>'reit_search_done' != 'true')
                           AND active = TRUE)                                        AS pending,
        COUNT(*) FILTER (WHERE url_source = 'reit_web_search')                     AS found_via_reit_search
      FROM rent_scrape_targets
      WHERE market = 'Atlanta'
    `);
    const job = currentReitJobId ? activeReitJobs.get(currentReitJobId) : null;
    res.json({
      success: true,
      counts: counts.rows[0],
      activeJob: job ? { jobId: currentReitJobId, ...job } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/discovery/reit-search/run', async (req: Request, res: Response) => {
  try {
    if (currentReitJobId && activeReitJobs.get(currentReitJobId)?.status === 'running') {
      return res.status(409).json({
        error: 'A REIT search job is already running',
        jobId: currentReitJobId,
      });
    }

    const market  = req.body?.market  || 'Atlanta';
    const limit   = req.body?.limit   || 277;
    const delayMs = Math.max(req.body?.delayMs || 1200, 500);

    const countQ = await pool.query(
      `SELECT COUNT(*) AS pending
       FROM rent_scrape_targets
       WHERE market ILIKE $1
         AND active = TRUE
         AND (website_url IS NULL OR website_url = '')
         AND (metadata->>'reit_search_done' IS NULL OR metadata->>'reit_search_done' != 'true')`,
      [market]
    );

    const total = Math.min(parseInt(countQ.rows[0].pending, 10), limit);
    if (total === 0) {
      return res.json({ success: true, message: 'No pending targets for REIT search', total: 0 });
    }

    const jobId = `reit-search-${market.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const job: BulkReitSearchJob = {
      status: 'running',
      total,
      processed: 0,
      discovered: 0,
      failed: 0,
      startedAt: new Date(),
      completedAt: null,
      errors: [],
    };
    activeReitJobs.set(jobId, job);
    currentReitJobId = jobId;

    res.json({
      success: true,
      jobId,
      total,
      market,
      delayMs,
      message: `REIT web-search started for ${total} no-website targets in ${market}`,
      estimatedMinutes: Math.ceil((total * (delayMs + 800)) / 60000),
    });

    setImmediate(async () => {
      const discovery = new RentScraperDiscoveryService(pool);
      try {
        const result = await discovery.discoverNoWebsiteViaWebSearch({
          market,
          limit: total,
          delayMs,
        });
        job.discovered = result.discovered;
        job.failed = result.failed;
        job.processed = result.total;
        job.status = 'completed';
        job.completedAt = new Date();
        logger.info(
          `[reit-search] DONE — ${result.discovered} URLs found out of ${result.total} searched`
        );
      } catch (err: any) {
        job.status = 'failed';
        job.completedAt = new Date();
        job.errors.push(err.message);
        logger.error(`[reit-search] Job failed: ${err.message}`);
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/discovery/reit-search/job/:jobId', (req: Request, res: Response) => {
  const job = activeReitJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true, jobId: req.params.jobId, ...job });
});

// ── Bulk Scrape Endpoints ────────────────────────────────────────────────────

interface BulkScrapeJob {
  status: 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  totalUnitsScraped: number;
  startedAt: Date;
  completedAt: Date | null;
  errors: string[];
}

const activeScrapeJobs = new Map<string, BulkScrapeJob>();
let currentScrapeJobId: string | null = null;

router.get('/scrape/status', async (_req: Request, res: Response) => {
  try {
    const counts = await pool.query(`
      SELECT
        COUNT(DISTINCT rst.id)                                              AS total_targets,
        COUNT(DISTINCT rst.id) FILTER (WHERE rst.website_url IS NOT NULL)  AS with_website,
        COUNT(DISTINCT rj.target_id) FILTER (WHERE rj.status = 'completed') AS scraped,
        COUNT(sr.id)                                                        AS total_units_scraped
      FROM rent_scrape_targets rst
      LEFT JOIN rent_scrape_jobs rj ON rj.target_id = rst.id
      LEFT JOIN scraped_rents sr ON sr.target_id = rst.id
      WHERE rst.source = 'property_records' AND rst.active = TRUE
    `);

    const byMarket = await pool.query(`
      SELECT rst.market,
        COUNT(DISTINCT rst.id)                                                AS total,
        COUNT(DISTINCT rst.id) FILTER (WHERE rst.website_url IS NOT NULL)    AS with_website,
        COUNT(DISTINCT rj.target_id) FILTER (WHERE rj.status = 'completed')  AS scraped,
        COUNT(sr.id)                                                          AS units_scraped
      FROM rent_scrape_targets rst
      LEFT JOIN rent_scrape_jobs rj ON rj.target_id = rst.id
      LEFT JOIN scraped_rents sr ON sr.target_id = rst.id
      WHERE rst.source = 'property_records' AND rst.active = TRUE
      GROUP BY rst.market
      ORDER BY total DESC
    `);

    const job = currentScrapeJobId ? activeScrapeJobs.get(currentScrapeJobId) : null;

    res.json({
      success: true,
      counts: counts.rows[0],
      byMarket: byMarket.rows,
      activeJob: job ? { jobId: currentScrapeJobId, ...job } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scrape/run', async (req: Request, res: Response) => {
  try {
    if (currentScrapeJobId && activeScrapeJobs.get(currentScrapeJobId)?.status === 'running') {
      return res.status(409).json({
        error: 'A scrape job is already running',
        jobId: currentScrapeJobId,
      });
    }

    const batchSize = Math.min(req.body?.batchSize || 20, 50);
    const delayMs   = Math.max(req.body?.delayMs   || 3000, 1000);
    const market    = req.body?.market || 'Atlanta';
    const limit     = req.body?.limit  || null;

    const countQ = await pool.query(
      `SELECT COUNT(DISTINCT rst.id) AS pending
       FROM rent_scrape_targets rst
       WHERE rst.active = TRUE
         AND rst.market = $1
         AND rst.website_url IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM rent_scrape_jobs rj
           WHERE rj.target_id = rst.id AND rj.status = 'completed'
         )`,
      [market]
    );

    const total = limit
      ? Math.min(parseInt(countQ.rows[0].pending, 10), limit)
      : parseInt(countQ.rows[0].pending, 10);

    if (total === 0) {
      return res.json({ success: true, message: 'No pending targets — all already scraped', total: 0 });
    }

    const jobId = `scrape-${market.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const job: BulkScrapeJob = {
      status: 'running',
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      totalUnitsScraped: 0,
      startedAt: new Date(),
      completedAt: null,
      errors: [],
    };
    activeScrapeJobs.set(jobId, job);
    currentScrapeJobId = jobId;

    res.json({
      success: true,
      jobId,
      total,
      market,
      message: `Scrape job started for ${total} targets in ${market}`,
      batchSize,
      delayMs,
      estimatedMinutes: Math.ceil((total * delayMs * 3) / 60000),
    });

    setImmediate(async () => {
      try {
        const scraper = new RentScraperService(pool);
        let processed = 0;

        while (true) {
          if (limit && processed >= limit) break;

          const remaining = limit ? limit - processed : batchSize;
          const rows = await pool.query(
            `SELECT DISTINCT rst.id
             FROM rent_scrape_targets rst
             WHERE rst.active = TRUE
               AND rst.market = $1
               AND rst.website_url IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM rent_scrape_jobs rj
                 WHERE rj.target_id = rst.id AND rj.status = 'completed'
               )
             ORDER BY rst.id ASC
             LIMIT $2`,
            [market, Math.min(remaining, batchSize)]
          );

          if (rows.rows.length === 0) break;

          for (const row of rows.rows) {
            if (limit && processed >= limit) break;
            try {
              const result = await scraper.scrapeProperty(row.id);
              if (result.status === 'success') {
                job.succeeded++;
                job.totalUnitsScraped += result.units.length;
              } else {
                job.failed++;
                if (job.errors.length < 50) {
                  job.errors.push(`Target ${row.id}: ${result.error || result.status}`);
                }
              }
            } catch (err: any) {
              job.failed++;
              if (job.errors.length < 50) {
                job.errors.push(`Target ${row.id}: ${err.message}`);
              }
            }
            job.processed++;
            processed++;

            await new Promise(r => setTimeout(r, delayMs));
          }

          logger.info(
            `[bulk-scrape] ${job.processed}/${job.total} — ` +
            `${job.succeeded} ok, ${job.failed} failed, ${job.totalUnitsScraped} units`
          );
        }

        job.status = 'completed';
        job.completedAt = new Date();
        logger.info(
          `[bulk-scrape] DONE — ${job.succeeded} scraped, ${job.failed} failed, ` +
          `${job.totalUnitsScraped} total units out of ${job.processed} targets`
        );
      } catch (err: any) {
        const j = activeScrapeJobs.get(jobId);
        if (j) {
          j.status = 'failed';
          j.completedAt = new Date();
          j.errors.push(`Job error: ${err.message}`);
        }
        logger.error(`[bulk-scrape] Job failed: ${err.message}`);
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scrape/job/:jobId', (req: Request, res: Response) => {
  const job = activeScrapeJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ success: true, jobId: req.params.jobId, ...job });
});

export default router;
