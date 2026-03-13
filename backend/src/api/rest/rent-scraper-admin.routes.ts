import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';
import { RentScraperDiscoveryService } from '../../services/rent-scraper-discovery.service';

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

export default router;
