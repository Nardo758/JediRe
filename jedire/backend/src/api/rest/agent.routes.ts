/**
 * Agent Orchestration REST Routes
 * Task submission and status endpoints
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { AgentOrchestrator } from '../../agents/orchestrator';

const router = Router();
const orchestrator = new AgentOrchestrator();

/**
 * POST /api/v1/agents/tasks
 * Submit a new agent task
 */
router.post('/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { taskType, inputData, priority } = req.body;

    if (!taskType || !inputData) {
      throw new AppError(400, 'taskType and inputData are required');
    }

    const task = await orchestrator.submitTask({
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
router.get('/tasks/:taskId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { taskId } = req.params;

    const result = await query(
      'SELECT * FROM agent_tasks WHERE id = $1',
      [taskId]
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
router.get('/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
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

export default router;
