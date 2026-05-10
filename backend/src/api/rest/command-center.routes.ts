/**
 * Command Center API Routes
 * Admin endpoints for data sync orchestration
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { commandCenterService } from '../../services/command-center.service';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

const router = Router();

// Require auth for all command center routes
router.use(requireAuth);

/**
 * GET /api/v1/command-center/status
 * Get overall status of data platform
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [dataStatus, integrationStatus, dataQuality] = await Promise.all([
      commandCenterService.getDataStatus(),
      commandCenterService.getIntegrationStatus(),
      commandCenterService.getDataQuality()
    ]);
    
    const activeJobs = commandCenterService.getActiveJobs();
    const recentJobs = commandCenterService.getJobHistory(10);
    
    res.json({
      success: true,
      data: {
        data_status: dataStatus,
        integrations: integrationStatus,
        data_quality: dataQuality,
        active_jobs: activeJobs,
        recent_jobs: recentJobs
      }
    });
    
  } catch (error: any) {
    logger.error('Command center status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/command-center/sync-atlanta
 * Start Atlanta sync job
 */
router.post('/sync-atlanta', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('Atlanta sync triggered from Command Center', { userId: req.user?.userId });
    
    const jobId = await commandCenterService.syncAtlanta();
    
    res.json({
      success: true,
      jobId,
      message: 'Atlanta sync started'
    });
    
  } catch (error: any) {
    logger.error('Failed to start Atlanta sync', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to start sync',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/command-center/sync-all-metros
 * Start all metros sync job
 */
router.post('/sync-all-metros', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info('All metros sync triggered from Command Center', { userId: req.user?.userId });
    
    const jobId = await commandCenterService.syncAllMetros();
    
    res.json({
      success: true,
      jobId,
      message: 'All metros sync started (17 cities)'
    });
    
  } catch (error: any) {
    logger.error('Failed to start all metros sync', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to start sync',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/command-center/job/:jobId
 * Get status of a specific job
 */
router.get('/job/:jobId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const job = commandCenterService.getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      job
    });
    
  } catch (error: any) {
    logger.error('Failed to get job status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get job status',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/command-center/jobs/active
 * Get all active jobs
 */
router.get('/jobs/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobs = commandCenterService.getActiveJobs();
    
    res.json({
      success: true,
      jobs
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to get active jobs'
    });
  }
});

/**
 * GET /api/v1/command-center/jobs/history
 * Get job history
 */
router.get('/jobs/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const jobs = commandCenterService.getJobHistory(limit);
    
    res.json({
      success: true,
      jobs
    });
    
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to get job history'
    });
  }
});

/**
 * GET /api/v1/command-center/dqa/reliability
 * Cross-deal DQA reliability breakdown: counts of each finding type grouped by
 * document_type × proforma_row × classification, optionally filtered by date range.
 *
 * Query params:
 *   from  — ISO date string (inclusive), defaults to 30 days ago
 *   to    — ISO date string (inclusive), defaults to now
 */
router.get('/dqa/reliability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const toDate   = req.query.to   ? new Date(req.query.to as string)   : new Date();
    const fromDate = req.query.from ? new Date(req.query.from as string) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid from/to date parameters' });
    }

    const result = await pool.query<{
      document_type: string;
      proforma_row: string;
      classification: string;
      severity: string;
      finding_count: string;
      deal_count: string;
      total_deals_for_doctype: string;
      hit_rate_pct: string | null;
    }>(
      `WITH totals AS (
         SELECT document_type,
                COUNT(DISTINCT deal_id) AS total_deals
           FROM data_quality_alerts
          WHERE status    != 'dismissed'
            AND created_at >= $1
            AND created_at <= $2
          GROUP BY document_type
       )
       SELECT  a.document_type,
               a.proforma_row,
               a.classification,
               a.severity,
               COUNT(*)::text                    AS finding_count,
               COUNT(DISTINCT a.deal_id)::text   AS deal_count,
               t.total_deals::text               AS total_deals_for_doctype,
               ROUND(
                 COUNT(DISTINCT a.deal_id)::numeric
                 / NULLIF(t.total_deals, 0) * 100,
                 1
               )::text                           AS hit_rate_pct
         FROM  data_quality_alerts a
         JOIN  totals t ON t.document_type = a.document_type
        WHERE  a.status    != 'dismissed'
          AND  a.created_at >= $1
          AND  a.created_at <= $2
        GROUP BY a.document_type, a.proforma_row, a.classification, a.severity, t.total_deals
        ORDER BY finding_count::int DESC`,
      [fromDate.toISOString(), toDate.toISOString()]
    );

    res.json({
      success: true,
      dateRange: {
        from: fromDate.toISOString(),
        to:   toDate.toISOString(),
      },
      total: result.rows.length,
      rows: result.rows.map(r => ({
        document_type:           r.document_type,
        proforma_row:            r.proforma_row,
        classification:          r.classification,
        severity:                r.severity,
        finding_count:           parseInt(r.finding_count, 10),
        deal_count:              parseInt(r.deal_count, 10),
        total_deals_for_doctype: parseInt(r.total_deals_for_doctype, 10),
        hit_rate_pct:            r.hit_rate_pct !== null ? parseFloat(r.hit_rate_pct) : null,
      })),
    });
  } catch (error: any) {
    logger.error('DQA reliability query failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
