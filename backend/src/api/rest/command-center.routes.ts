/**
 * Command Center API Routes
 * Admin endpoints for data sync orchestration
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { commandCenterService } from '../../services/command-center.service';
import { logger } from '../../utils/logger';

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

export default router;
