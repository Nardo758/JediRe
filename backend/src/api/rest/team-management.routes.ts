import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const pool = getPool();

const MemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().default('member'),
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  permissions: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(false),
    admin: z.boolean().default(false),
  }).optional(),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
});

const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  assigned_to_name: z.string().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  created_by_name: z.string().nullable().optional(),
});

const CommentSchema = z.object({
  author_name: z.string().min(1),
  content: z.string().min(1),
});

async function verifyDealAccess(dealId: string, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

router.get('/deals/:dealId/team/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;
    if (userId && !(await verifyDealAccess(dealId, userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query(
      'SELECT * FROM deal_team_members WHERE deal_id = $1 ORDER BY created_at',
      [dealId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

router.post('/deals/:dealId/team/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;
    if (userId && !(await verifyDealAccess(dealId, userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const data = MemberSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO deal_team_members (deal_id, name, email, phone, role, title, company, permissions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [dealId, data.name, data.email ?? null, data.phone ?? null, data.role,
       data.title ?? null, data.company ?? null,
       JSON.stringify(data.permissions ?? { read: true, write: false, admin: false }),
       data.status]
    );
    await pool.query(
      `INSERT INTO deal_team_activity (deal_id, actor_name, action, target_type, target_id, details)
       VALUES ($1, $2, 'member_added', 'member', $3, $4)`,
      [dealId, 'System', result.rows[0].id, JSON.stringify({ name: data.name, role: data.role })]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

router.put('/deals/:dealId/team/members/:memberId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, memberId } = req.params;
    const data = MemberSchema.partial().parse(req.body);
    const setClauses: string[] = [];
    const values: any[] = [dealId, memberId];
    let idx = 3;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        values.push(key === 'permissions' ? JSON.stringify(val) : val);
        idx++;
      }
    }
    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const result = await pool.query(
      `UPDATE deal_team_members SET ${setClauses.join(', ')} WHERE deal_id = $1 AND id = $2 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

router.delete('/deals/:dealId/team/members/:memberId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, memberId } = req.params;
    await pool.query('DELETE FROM deal_team_members WHERE deal_id = $1 AND id = $2', [dealId, memberId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.get('/deals/:dealId/team/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;
    if (userId && !(await verifyDealAccess(dealId, userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query(
      'SELECT * FROM deal_tasks WHERE deal_id = $1 ORDER BY created_at DESC',
      [dealId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/deals/:dealId/team/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const data = TaskSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO deal_tasks (deal_id, title, description, assigned_to, assigned_to_name, status, priority, due_date, tags, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [dealId, data.title, data.description ?? null, data.assigned_to ?? null,
       data.assigned_to_name ?? null, data.status, data.priority,
       data.due_date ?? null, data.tags ?? [], data.created_by_name ?? null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/deals/:dealId/team/tasks/:taskId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, taskId } = req.params;
    const data = TaskSchema.partial().parse(req.body);
    const setClauses: string[] = [];
    const values: any[] = [dealId, taskId];
    let idx = 3;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        values.push(key === 'tags' ? val : val);
        idx++;
      }
    }
    if (data.status === 'completed') {
      setClauses.push(`completed_at = $${idx}`);
      values.push(new Date().toISOString());
      idx++;
    }
    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const result = await pool.query(
      `UPDATE deal_tasks SET ${setClauses.join(', ')} WHERE deal_id = $1 AND id = $2 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/deals/:dealId/team/tasks/:taskId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, taskId } = req.params;
    await pool.query('DELETE FROM deal_tasks WHERE deal_id = $1 AND id = $2', [dealId, taskId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

router.get('/deals/:dealId/team/tasks/:taskId/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, taskId } = req.params;
    const result = await pool.query(
      'SELECT * FROM deal_task_comments WHERE deal_id = $1 AND task_id = $2 ORDER BY created_at',
      [dealId, taskId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/deals/:dealId/team/tasks/:taskId/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId, taskId } = req.params;
    const data = CommentSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO deal_task_comments (task_id, deal_id, author_name, content) VALUES ($1, $2, $3, $4) RETURNING *`,
      [taskId, dealId, data.author_name, data.content]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: error.errors });
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.get('/deals/:dealId/team/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = (req as any).user?.userId;
    if (userId && !(await verifyDealAccess(dealId, userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query(
      'SELECT * FROM deal_team_activity WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 50',
      [dealId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

router.get('/team/role-templates', requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM deal_role_templates ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching role templates:', error);
    res.status(500).json({ error: 'Failed to fetch role templates' });
  }
});

export default router;
