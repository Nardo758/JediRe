/**
 * Scheduled Refresh Routes
 * 
 * Endpoints for triggering and monitoring knowledge graph refresh.
 * Designed to be called by cron job every 6 hours.
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { getScheduledRefreshService } from '../../services/neural-network/scheduled-refresh';

const router = Router();

/**
 * POST /run
 * Trigger a scheduled refresh run
 * Can be called by cron or manually
 */
router.post('/run', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const refreshService = getScheduledRefreshService(pool);
    
    const result = await refreshService.run();
    
    res.json({
      success: true,
      ...result,
      message: `Processed ${result.queued} stale nodes`
    });
  } catch (error: any) {
    console.error('Scheduled refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /stats
 * Get staleness statistics without triggering refresh
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    const refreshService = getScheduledRefreshService(pool);
    
    const stats = await refreshService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Refresh stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /stale
 * List stale nodes that need refresh
 */
router.get('/stale', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    
    const pool = getPool();
    const refreshService = getScheduledRefreshService(pool);
    
    const staleNodes = await refreshService.getStaleNodes(limit);
    
    res.json({
      success: true,
      count: staleNodes.length,
      nodes: staleNodes
    });
  } catch (error: any) {
    console.error('Stale nodes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /refresh/:nodeType
 * Manually refresh all nodes of a specific type
 */
router.post('/refresh/:nodeType', async (req: Request, res: Response) => {
  try {
    const { nodeType } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    const validTypes = ['Property', 'Market', 'Submarket', 'Event', 'Deal', 'Permit', 'Metric'];
    if (!validTypes.includes(nodeType)) {
      return res.status(400).json({ 
        error: `Invalid node type. Valid types: ${validTypes.join(', ')}` 
      });
    }
    
    const pool = getPool();
    const refreshService = getScheduledRefreshService(pool);
    
    const result = await refreshService.refreshNodeType(nodeType, limit);
    
    res.json({
      success: true,
      nodeType,
      ...result
    });
  } catch (error: any) {
    console.error('Manual refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
