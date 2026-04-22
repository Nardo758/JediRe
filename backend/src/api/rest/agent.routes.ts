/**
 * Agent Orchestration REST Routes
 * Task submission and status endpoints
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuthOrApiKey, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { AgentJobQueue } from '../../agents/runtime/job-queue';
import { agentOrchestrator } from '../../services/agents/agent-orchestrator';
import { logger } from '../../utils/logger';

const router = Router();
const jobQueue = new AgentJobQueue();

/**
 * POST /api/v1/agents/tasks
 * Submit a new agent task
 */
router.post('/tasks', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { taskType, inputData, priority } = req.body;

    if (!taskType || !inputData) {
      throw new AppError(400, 'taskType and inputData are required');
    }

    const task = await jobQueue.submitTask({
      taskType,
      inputData,
      userId: req.user!.userId,
      priority: priority || 0,
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/tasks/:taskId
 * Get task status
 */
router.get('/tasks/:taskId', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { taskId } = req.params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(taskId)) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const result = await query(
      'SELECT * FROM agent_tasks WHERE id = $1 AND user_id = $2',
      [taskId, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Task not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/tasks
 * List user's tasks
 */
router.get('/tasks', requireAuthOrApiKey, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let queryText = 'SELECT * FROM agent_tasks WHERE user_id = $1';
    const params: any[] = [req.user!.userId];
    let paramIndex = 2;

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      tasks: result.rows,
      count: result.rows.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DEBUG: MANUAL TRIGGER FOR SCHEDULED FUNCTIONS (Task #327)
// ============================================================================

/**
 * POST /api/v1/agents/_debug/trigger?fn=<name>
 * Admin-only. Manually invoke a scheduled job's underlying work, bypassing
 * Inngest's cron, so wiring can be verified without waiting hours/days.
 *
 * Supported `fn` values:
 *   - dailyMorningBriefing
 *   - dailyComplianceCheck
 *   - weeklyPortfolioReview
 *   - hourlyMarketDiscovery
 *   - dailyNewsDiscovery
 *   - dailyEconomicDiscovery (rates only; full job also refreshes employment per MSA)
 */
router.post(
  '/_debug/trigger',
  requireAuthOrApiKey,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (req.user?.role !== 'admin') {
        throw new AppError(403, 'Admin role required for debug triggers');
      }

      const fn = String((req.query.fn as string) || req.body?.fn || '');
      const userId = req.user.userId;

      const { discoveryEngine } = await import(
        '../../services/discovery/discovery-engine'
      );

      switch (fn) {
        case 'dailyMorningBriefing': {
          const result = await agentOrchestrator.dispatchEvent({
            event: 'schedule_daily',
            userId,
            data: { triggeredManually: true },
          });
          return res.json({ success: true, fn, result });
        }
        case 'dailyComplianceCheck': {
          const result = await agentOrchestrator.dispatchEvent({
            event: 'task_due',
            userId,
            data: { triggeredManually: true, task: 'compliance_check' },
          });
          return res.json({ success: true, fn, result });
        }
        case 'weeklyPortfolioReview': {
          const result = await agentOrchestrator.dispatchEvent({
            event: 'schedule_weekly',
            userId,
            data: { triggeredManually: true },
          });
          return res.json({ success: true, fn, result });
        }
        case 'hourlyMarketDiscovery': {
          const rates = await discoveryEngine.discoverInterestRates();
          const reits = await discoveryEngine.discoverREITPrices();
          return res.json({ success: true, fn, rates, reits });
        }
        case 'dailyNewsDiscovery': {
          const news = await discoveryEngine.discoverNews([
            'commercial real estate',
            'multifamily investment',
            'apartment market',
          ]);
          return res.json({
            success: true,
            fn,
            count: Array.isArray(news) ? news.length : 0,
          });
        }
        case 'dailyEconomicDiscovery': {
          const rates = await discoveryEngine.discoverInterestRates();
          return res.json({
            success: true,
            fn,
            note: 'Debug trigger refreshes interest rates only; the full cron job also iterates per-MSA employment data.',
            rates,
          });
        }
        default:
          throw new AppError(
            400,
            `Unknown fn '${fn}'. Supported: dailyMorningBriefing, dailyComplianceCheck, weeklyPortfolioReview, hourlyMarketDiscovery, dailyNewsDiscovery, dailyEconomicDiscovery`
          );
      }
    } catch (error: any) {
      logger.error(`[debug/trigger] failed:`, error);
      next(error);
    }
  }
);

export default router;
