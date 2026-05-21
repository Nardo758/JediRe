import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { runEnrichmentBatch, getJob } from '../../services/enrichment/enrichment.service';
import { logger } from '../../utils/logger';

function requireIngestSecret(req: Request, res: Response): boolean {
  const secret = process.env.ARCHIVE_INGEST_SECRET;
  if (!secret) {
    res.status(503).json({ success: false, error: 'ARCHIVE_INGEST_SECRET not configured on server' });
    return false;
  }
  if (req.headers['x-ingest-secret'] !== secret) {
    res.status(401).json({ success: false, error: 'Invalid or missing x-ingest-secret header' });
    return false;
  }
  return true;
}

export function createEnrichmentRoutes(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/enrichment/run
   *
   * Kick off a multi-source batch enrichment job.
   * Writes missing property_descriptions fields via COALESCE upsert (source: web_enrichment).
   *
   * Auth: x-ingest-secret header
   *
   * Body (all optional):
   *   parcelIds   string[]  — subset to enrich; omit for all rows with null fields
   *   sources     string[]  — ['county','apartments_com','apartment_list','web']
   *   dryRun      boolean   — skip writes, just log what would be fetched
   *   concurrency number    — parallel requests (default 4)
   */
  router.post('/run', async (req: Request, res: Response) => {
    if (!requireIngestSecret(req, res)) return;

    const { parcelIds, sources, dryRun, concurrency } = req.body ?? {};

    try {
      const jobId = await runEnrichmentBatch(pool, { parcelIds, sources, dryRun, concurrency });
      logger.info('[enrichment/run] job started', { jobId });
      res.json({ success: true, jobId });
    } catch (err: any) {
      logger.error('[enrichment/run] failed to start', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/enrichment/status?jobId=X
   *
   * Returns current progress for an enrichment job.
   * Auth: x-ingest-secret header
   */
  router.get('/status', (req: Request, res: Response) => {
    if (!requireIngestSecret(req, res)) return;

    const jobId = req.query.jobId as string | undefined;
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId query param is required' });
    }

    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: `Job ${jobId} not found` });
    }

    res.json({ success: true, job });
  });

  return router;
}
