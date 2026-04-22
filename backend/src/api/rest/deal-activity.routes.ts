/**
 * Deal Activity Routes
 * 
 * Unified activity feed for a deal: emails, tasks, events, decisions
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// GET /api/v1/deals/:dealId/activity/emails
// Get emails linked to this deal
// ============================================================================
router.get('/:dealId/activity/emails', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Get emails linked to this deal
    const result = await query(`
      SELECT 
        e.id,
        e.subject,
        e.from_address,
        e.to_addresses,
        e.cc_addresses,
        e.snippet,
        e.received_at,
        e.is_read,
        e.is_starred,
        e.has_attachments,
        e.thread_id,
        e.labels
      FROM emails e
      WHERE e.deal_id = $1 AND e.user_id = $2
      ORDER BY e.received_at DESC
      LIMIT $3 OFFSET $4
    `, [dealId, req.user!.userId, parseInt(limit as string), parseInt(offset as string)]);
    
    const countResult = await query(
      'SELECT COUNT(*) FROM emails WHERE deal_id = $1 AND user_id = $2',
      [dealId, req.user!.userId]
    );
    
    res.json({
      success: true,
      emails: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err: any) {
    logger.error('GET deal emails', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// POST /api/v1/deals/:dealId/activity/link-email
// Link an email to this deal
// ============================================================================
router.post('/:dealId/activity/link-email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { emailId } = req.body;
    
    if (!emailId) {
      return res.status(400).json({ success: false, error: 'emailId required' });
    }
    
    await query(
      'UPDATE emails SET deal_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [dealId, emailId, req.user!.userId]
    );
    
    res.json({ success: true });
  } catch (err: any) {
    logger.error('POST link email', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// DELETE /api/v1/deals/:dealId/activity/unlink-email/:emailId
// Unlink an email from this deal
// ============================================================================
router.delete('/:dealId/activity/unlink-email/:emailId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, emailId } = req.params;
    
    await query(
      'UPDATE emails SET deal_id = NULL, updated_at = NOW() WHERE id = $1 AND deal_id = $2 AND user_id = $3',
      [emailId, dealId, req.user!.userId]
    );
    
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE unlink email', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /api/v1/deals/:dealId/activity/tasks
// Get tasks for this deal
// ============================================================================
router.get('/:dealId/activity/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { status, include_completed = 'false' } = req.query;
    
    let whereClause = 'deal_id = $1';
    const params: any[] = [dealId];
    
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    } else if (include_completed !== 'true') {
      whereClause += ` AND status NOT IN ('done', 'cancelled')`;
    }
    
    const result = await query(`
      SELECT 
        t.*,
        u.full_name as assigned_to_name,
        d.name as deal_name
      FROM tasks t
      LEFT JOIN auth.users u ON t.assigned_to_id = u.id
      LEFT JOIN deals d ON t.deal_id = d.id
      WHERE ${whereClause}
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `, params);
    
    res.json({ success: true, tasks: result.rows });
  } catch (err: any) {
    logger.error('GET deal tasks', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// POST /api/v1/deals/:dealId/activity/tasks
// Create a task for this deal (pushes to global task list)
// ============================================================================
router.post('/:dealId/activity/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      title,
      description,
      priority = 'medium',
      category = 'general',
      due_date,
      assigned_to_id,
      email_id,
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ success: false, error: 'title required' });
    }
    
    const result = await query(`
      INSERT INTO tasks (
        deal_id, title, description, priority, category, status,
        due_date, assigned_to_id, email_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, $9)
      RETURNING *
    `, [
      dealId,
      title,
      description || null,
      priority,
      category,
      due_date || null,
      assigned_to_id || req.user!.userId,
      email_id || null,
      req.user!.userId,
    ]);
    
    res.status(201).json({ success: true, task: result.rows[0] });
  } catch (err: any) {
    logger.error('POST deal task', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// PATCH /api/v1/deals/:dealId/activity/tasks/:taskId
// Update a task
// ============================================================================
router.patch('/:dealId/activity/tasks/:taskId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, taskId } = req.params;
    const allowed = ['title', 'description', 'priority', 'category', 'status', 'due_date', 'assigned_to_id'];
    
    const sets: string[] = [];
    const params: any[] = [taskId, dealId];
    
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    
    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    sets.push('updated_at = NOW()');
    
    const result = await query(`
      UPDATE tasks SET ${sets.join(', ')}
      WHERE id = $1 AND deal_id = $2
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    res.json({ success: true, task: result.rows[0] });
  } catch (err: any) {
    logger.error('PATCH deal task', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /api/v1/deals/:dealId/activity/unified
// Get unified activity feed (emails + tasks + events)
// ============================================================================
router.get('/:dealId/activity/unified', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { limit = 50 } = req.query;
    
    // Get emails
    const emails = await query(`
      SELECT 
        id, 'email' as type, subject as title, snippet as description,
        received_at as timestamp, from_address as actor
      FROM emails
      WHERE deal_id = $1 AND user_id = $2
      ORDER BY received_at DESC
      LIMIT $3
    `, [dealId, req.user!.userId, Math.floor(parseInt(limit as string) / 3)]);
    
    // Get tasks
    const tasks = await query(`
      SELECT 
        id, 'task' as type, title, description,
        created_at as timestamp, 
        COALESCE((SELECT full_name FROM auth.users WHERE id = created_by), 'System') as actor
      FROM tasks
      WHERE deal_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [dealId, Math.floor(parseInt(limit as string) / 3)]);
    
    // Get events
    const events = await query(`
      SELECT 
        id, 'event' as type, event_type as title, description,
        event_date as timestamp, source as actor
      FROM deal_events
      WHERE deal_id = $1
      ORDER BY event_date DESC
      LIMIT $2
    `, [dealId, Math.floor(parseInt(limit as string) / 3)]);
    
    // Merge and sort
    const unified = [
      ...emails.rows,
      ...tasks.rows,
      ...events.rows,
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, parseInt(limit as string));
    
    res.json({ success: true, activity: unified });
  } catch (err: any) {
    logger.error('GET unified activity', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// POST /api/v1/deals/:dealId/activity/extract-tasks-from-email
// Extract tasks from email content using AI
// ============================================================================
router.post('/:dealId/activity/extract-tasks-from-email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { emailId } = req.body;
    
    if (!emailId) {
      return res.status(400).json({ success: false, error: 'emailId required' });
    }
    
    // Get email content
    const emailResult = await query(
      'SELECT id, subject, snippet, raw_data FROM emails WHERE id = $1 AND user_id = $2',
      [emailId, req.user!.userId]
    );
    
    if (emailResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    // For now, just link the email to the deal if not already
    await query(
      'UPDATE emails SET deal_id = $1, updated_at = NOW() WHERE id = $2 AND deal_id IS NULL',
      [dealId, emailId]
    );
    
    // TODO: Use AI to extract action items from email body
    // For now, return empty (frontend can implement manual task creation)
    
    res.json({
      success: true,
      message: 'Email linked to deal. Manual task creation available.',
      suggestedTasks: [],
    });
  } catch (err: any) {
    logger.error('POST extract tasks', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
