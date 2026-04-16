/**
 * Tasks API Routes - Database Version
 * 
 * REPLACE: backend/src/api/rest/tasks.routes.ts
 * 
 * Converts from in-memory store to PostgreSQL with:
 * - Deal linking
 * - Stage-based task generation
 * - Agent-created tasks support
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (s: string) => UUID_RE.test(s);

// ============================================================================
// GET /api/v1/tasks - Get all tasks with optional filters
// ============================================================================
router.get('/', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { 
      status, 
      deal_id, 
      assigned_to_id, 
      category, 
      priority,
      limit = 100,
      offset = 0,
      include_completed = 'false',
    } = req.query;

    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status) {
      whereConditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    } else if (include_completed !== 'true') {
      // Default: exclude completed/cancelled
      whereConditions.push(`t.status NOT IN ('done', 'cancelled')`);
    }

    // Filter by deal
    if (deal_id) {
      if (!isValidUUID(deal_id as string)) {
        return res.status(400).json({ success: false, message: 'Invalid deal_id' });
      }
      whereConditions.push(`t.deal_id = $${paramIndex}`);
      params.push(deal_id);
      paramIndex++;
    }

    // Filter by assigned user
    if (assigned_to_id) {
      whereConditions.push(`t.assigned_to_id = $${paramIndex}`);
      params.push(assigned_to_id);
      paramIndex++;
    } else {
      // Default: show tasks assigned to current user OR unassigned
      whereConditions.push(`(t.assigned_to_id = $${paramIndex} OR t.assigned_to_id IS NULL)`);
      params.push(userId);
      paramIndex++;
    }

    // Filter by category
    if (category) {
      whereConditions.push(`t.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Filter by priority
    if (priority) {
      whereConditions.push(`t.priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));

    const sql = `
      SELECT 
        t.*,
        d.name as deal_name,
        u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN deals d ON t.deal_id = d.id
      LEFT JOIN users u ON t.assigned_to_id = u.id
      ${whereClause}
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(sql, params);

    // Get total count
    const countParams = params.slice(0, -2);
    const countSql = `SELECT COUNT(*) as total FROM tasks t ${whereClause}`;
    const countResult = await query(countSql, countParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        status: row.status,
        dealId: row.deal_id,
        dealName: row.deal_name,
        assignedToId: row.assigned_to_id,
        assignedTo: row.assigned_to_name,
        dueDate: row.due_date,
        source: row.source,
        tags: row.tags,
        createdAt: row.created_at,
      })),
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    next(error);
  }
});

// ============================================================================
// GET /api/v1/tasks/stats - Get task statistics
// ============================================================================
router.get('/stats', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { deal_id } = req.query;

    let whereCondition = 'assigned_to_id = $1 OR assigned_to_id IS NULL';
    const params: any[] = [userId];
    
    if (deal_id && isValidUUID(deal_id as string)) {
      whereCondition = 'deal_id = $2 AND (' + whereCondition + ')';
      params.push(deal_id);
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'todo') as todo,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE status = 'done') as done,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done', 'cancelled')) as overdue,
        COUNT(*) FILTER (WHERE due_date::date = CURRENT_DATE AND status NOT IN ('done', 'cancelled')) as due_today,
        COUNT(*) FILTER (WHERE due_date > NOW() AND due_date < NOW() + INTERVAL '7 days' AND status NOT IN ('done', 'cancelled')) as due_soon,
        COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('done', 'cancelled')) as urgent
      FROM tasks
      WHERE ${whereCondition}`,
      params
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        total: parseInt(stats.total),
        byStatus: {
          todo: parseInt(stats.todo),
          in_progress: parseInt(stats.in_progress),
          blocked: parseInt(stats.blocked),
          done: parseInt(stats.done),
          cancelled: parseInt(stats.cancelled),
        },
        overdue: parseInt(stats.overdue),
        dueToday: parseInt(stats.due_today),
        dueSoon: parseInt(stats.due_soon),
        urgent: parseInt(stats.urgent),
      },
    });
  } catch (error) {
    logger.error('Error fetching task stats:', error);
    next(error);
  }
});

// ============================================================================
// GET /api/v1/tasks/:id - Get single task
// ============================================================================
router.get('/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const result = await query(
      `SELECT 
        t.*,
        d.name as deal_name,
        u.full_name as assigned_to_name,
        creator.full_name as created_by_name
      FROM tasks t
      LEFT JOIN deals d ON t.deal_id = d.id
      LEFT JOIN users u ON t.assigned_to_id = u.id
      LEFT JOIN users creator ON t.created_by_id = creator.id
      WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching task:', error);
    next(error);
  }
});

// ============================================================================
// POST /api/v1/tasks - Create new task
// ============================================================================
router.post('/', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      title,
      description,
      category,
      priority = 'medium',
      status = 'todo',
      deal_id,
      property_id,
      email_id,
      assigned_to_id,
      due_date,
      source = 'manual',
      source_ref,
      tags = [],
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title and category are required',
      });
    }

    const result = await query(
      `INSERT INTO tasks (
        title, description, category, priority, status,
        deal_id, property_id, email_id,
        assigned_to_id, created_by_id,
        due_date, source, source_ref, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        title,
        description,
        category,
        priority,
        status,
        deal_id || null,
        property_id || null,
        email_id || null,
        assigned_to_id || userId,
        userId,
        due_date || null,
        source,
        source_ref || null,
        tags,
      ]
    );

    logger.info(`Task created: ${title}`, { taskId: result.rows[0].id, userId });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Task created successfully',
    });
  } catch (error) {
    logger.error('Error creating task:', error);
    next(error);
  }
});

// ============================================================================
// PATCH /api/v1/tasks/:id - Update task
// ============================================================================
router.patch('/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const updates = req.body;
    const allowedFields = [
      'title', 'description', 'category', 'priority', 'status',
      'deal_id', 'assigned_to_id', 'due_date', 'blocked_reason', 'tags'
    ];

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        params.push(updates[field]);
        paramIndex++;
      }
    }

    // Auto-set completed_at when status changes to done
    if (updates.status === 'done') {
      setClauses.push(`completed_at = NOW()`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid updates provided' });
    }

    params.push(id);

    const result = await query(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    logger.info(`Task updated: ${result.rows[0].title}`, {
      taskId: id,
      changes: Object.keys(updates),
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Task updated successfully',
    });
  } catch (error) {
    logger.error('Error updating task:', error);
    next(error);
  }
});

// ============================================================================
// DELETE /api/v1/tasks/:id - Delete task
// ============================================================================
router.delete('/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const result = await query('DELETE FROM tasks WHERE id = $1 RETURNING id, title', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    logger.info(`Task deleted: ${result.rows[0].title}`, { taskId: id });

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting task:', error);
    next(error);
  }
});

// ============================================================================
// POST /api/v1/tasks/generate-for-stage - Generate tasks for deal stage
// ============================================================================
router.post('/generate-for-stage', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { deal_id, stage } = req.body;

    if (!deal_id || !stage) {
      return res.status(400).json({
        success: false,
        message: 'deal_id and stage are required',
      });
    }

    if (!isValidUUID(deal_id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal_id' });
    }

    // Call the database function to generate tasks
    const result = await query(
      'SELECT generate_stage_tasks($1, $2, $3) as task_count',
      [deal_id, stage, userId]
    );

    const taskCount = result.rows[0].task_count;

    logger.info(`Generated ${taskCount} tasks for deal stage transition`, {
      dealId: deal_id,
      stage,
      userId,
    });

    res.json({
      success: true,
      data: { tasksGenerated: taskCount },
      message: `Generated ${taskCount} tasks for ${stage} stage`,
    });
  } catch (error) {
    logger.error('Error generating stage tasks:', error);
    next(error);
  }
});

// ============================================================================
// POST /api/v1/tasks/from-agent - Create task from AI agent
// ============================================================================
router.post('/from-agent', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      title,
      description,
      category,
      priority = 'medium',
      deal_id,
      agent_code, // e.g., 'RISK', 'DD', 'MARKET'
      due_days = 3, // Days from now
    } = req.body;

    if (!title || !category || !agent_code) {
      return res.status(400).json({
        success: false,
        message: 'title, category, and agent_code are required',
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + due_days);

    const result = await query(
      `INSERT INTO tasks (
        title, description, category, priority, status,
        deal_id, assigned_to_id, 
        due_date, source, source_ref
      ) VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7, 'agent', $8)
      RETURNING *`,
      [
        title,
        description,
        category,
        priority,
        deal_id || null,
        userId,
        dueDate,
        agent_code,
      ]
    );

    logger.info(`Agent task created: ${title}`, { 
      taskId: result.rows[0].id, 
      agentCode: agent_code,
      dealId: deal_id,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: `Task created by ${agent_code} agent`,
    });
  } catch (error) {
    logger.error('Error creating agent task:', error);
    next(error);
  }
});

export default router;
