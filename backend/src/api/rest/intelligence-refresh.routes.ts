/**
 * Refresh Intelligence trigger (Task #383).
 *
 * `POST /api/v1/intelligence/refresh/:entityType/:entityId`
 *
 * Enqueues a `commentary_generation` task for the entity through the existing
 * AgentJobQueue (same pipeline used by the Commentary tabs). When the entity
 * resolves to an MSA we additionally enqueue a `research_analysis` task so
 * the broader market intelligence cycle gets refreshed.
 *
 * Returns the queued task IDs so the caller can poll status. Auth-gated.
 */

import { Router, Request, Response } from 'express';
import { AgentJobQueue } from '../../agents/runtime/job-queue';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const jobQueue = new AgentJobQueue();

export function createIntelligenceRefreshRoutes(): Router {
  const router = Router();

  router.post('/refresh/:entityType/:entityId', requireAuth, async (req: Request, res: Response) => {
    try {
      const entityType = req.params.entityType;
      const entityId = req.params.entityId;
      if (entityType !== 'msa' && entityType !== 'submarket') {
        return res.status(400).json({ error: 'entityType must be "msa" or "submarket"' });
      }

      const userId = (req as AuthenticatedRequest).user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const tasks: Array<{ id: string; taskType: string }> = [];

      const commentary = await jobQueue.submitTask({
        taskType: 'commentary_generation',
        inputData: {
          entityType,
          entityId,
          forceRefresh: true,
          source: 'intelligence_refresh',
        },
        userId,
        priority: 5,
      });
      tasks.push({ id: commentary.id, taskType: commentary.taskType });

      if (entityType === 'msa') {
        const research = await jobQueue.submitTask({
          taskType: 'research_analysis',
          inputData: {
            entityType,
            entityId,
            scope: 'market_intelligence_refresh',
          },
          userId,
          priority: 5,
        });
        tasks.push({ id: research.id, taskType: research.taskType });
      }

      res.status(202).json({
        entityType,
        entityId,
        queued: tasks,
      });
    } catch (err: unknown) {
      console.error('intelligence-refresh error:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });

  return router;
}
