/**
 * Task Completion Detection API Routes
 * Endpoints for scanning emails and suggesting task completions
 */

import { Router, Request, Response } from 'express';
import { taskCompletionDetector } from '../../services/task-completion-detector';

const router = Router();

/**
 * POST /api/v1/tasks/scan-completions
 * Scan recent emails for task completion signals
 */
router.post('/scan-completions', async (req: Request, res: Response) => {
  try {
    const { emailIds, taskIds } = req.body;
    const rawDaysBack = req.body.daysBack;
    const daysBack = Math.max(1, Math.min(90, Number.isFinite(Number(rawDaysBack)) ? Math.floor(Number(rawDaysBack)) : 7));
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Import database connection
    const { query } = await import('../../database/connection');

    // Fetch recent emails from database — parameterized interval (no interpolation)
    let emailQuery = `
      SELECT 
        id,
        subject,
        body_preview as body,
        from_address as sender,
        '[]'::json as recipients,
        received_at as timestamp
      FROM emails
      WHERE user_id = $1
        AND received_at > NOW() - make_interval(days => $2)
    `;
    const emailParams: any[] = [userId, daysBack];

    if (emailIds && emailIds.length > 0) {
      emailQuery += ` AND id = ANY($3)`;
      emailParams.push(emailIds);
    }

    emailQuery += ` ORDER BY received_at DESC LIMIT 100`;

    const emailResult = await query(emailQuery, emailParams);
    const emails = emailResult.rows.map((row: any) => ({
      id: row.id,
      subject: row.subject || '',
      body: row.body || '',
      sender: row.sender || '',
      recipients: row.recipients || [],
      timestamp: row.timestamp,
    }));

    // Fetch open/in-progress tasks scoped to the current user's accessible deals
    let taskQuery = `
      SELECT 
        t.id,
        t.title as name,
        t.description,
        t.status,
        t.deal_id as linked_entity_id,
        d.name as linked_entity_name,
        t.assigned_to_id,
        t.assigned_to_name
      FROM deal_team_tasks t
      LEFT JOIN deals d ON t.deal_id = d.id
      WHERE t.status IN ('todo', 'in-progress')
        AND (
          EXISTS (
            SELECT 1 FROM deal_team_members m
            WHERE m.id = t.assigned_to_id AND m.user_id = $1
          )
          OR d.user_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM deal_team_members dtm
            WHERE dtm.deal_id = t.deal_id AND dtm.user_id = $1
          )
        )
    `;
    const taskParams: any[] = [userId];

    if (taskIds && taskIds.length > 0) {
      taskQuery += ` AND t.id = ANY($2)`;
      taskParams.push(taskIds);
    }

    taskQuery += ` ORDER BY t.due_date ASC NULLS LAST LIMIT 100`;

    const taskResult = await query(taskQuery, taskParams);
    const tasks = taskResult.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      status: row.status,
      linkedEntity: {
        id: row.linked_entity_id,
        name: row.linked_entity_name,
        type: 'deal',
      },
      assignedTo: {
        userId: row.assigned_to_id,
        name: row.assigned_to_name,
      },
    }));

    // Scan emails for completion signals
    const signals = await taskCompletionDetector.scanEmails(emails, tasks);

    // Filter by confidence threshold if provided
    const minConfidence = req.body.minConfidence || 40;
    const filteredSignals = signals.filter(s => s.confidence >= minConfidence);

    res.json({
      success: true,
      data: {
        scanned: {
          emails: emails.length,
          tasks: tasks.length,
        },
        signals: filteredSignals,
        summary: {
          total: filteredSignals.length,
          highConfidence: filteredSignals.filter(s => s.confidence >= 80).length,
          mediumConfidence: filteredSignals.filter(s => s.confidence >= 60 && s.confidence < 80).length,
          lowConfidence: filteredSignals.filter(s => s.confidence < 60).length,
        },
      },
    });
  } catch (error) {
    console.error('Error scanning for task completions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for task completions',
    });
  }
});

/**
 * POST /api/v1/tasks/:taskId/complete-from-email
 * Mark a task as complete based on email detection
 */
router.post('/:taskId/complete-from-email', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { emailId, completionDate, source = 'email-detection' } = req.body;
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { query } = await import('../../database/connection');

    // Update task status — only for tasks the user is assigned to or has deal access
    const result = await query(
      `UPDATE deal_team_tasks 
       SET 
         status = 'completed',
         completed_at = $1,
         updated_at = NOW()
       WHERE id = $2
         AND (
           EXISTS (
             SELECT 1 FROM deal_team_members m
             WHERE m.id = deal_team_tasks.assigned_to_id AND m.user_id = $3
           )
           OR EXISTS (
             SELECT 1 FROM deals d
             WHERE d.id = deal_team_tasks.deal_id AND d.user_id = $3::uuid
           )
           OR EXISTS (
             SELECT 1 FROM deal_team_members dtm
             WHERE dtm.deal_id = deal_team_tasks.deal_id AND dtm.user_id = $3
           )
         )
       RETURNING 
         id,
         title,
         status,
         completed_at,
         deal_id`,
      [completionDate || new Date(), taskId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const updatedTask = {
      id: result.rows[0].id,
      status: result.rows[0].status,
      completedAt: result.rows[0].completed_at,
      source: {
        type: 'email',
        referenceId: emailId,
        sourceUrl: `/emails/${emailId}`,
      },
    };

    // Log activity
    await query(
      `INSERT INTO deal_team_activity (
        deal_id, action, target_type, target_id, title, description
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        result.rows[0].deal_id,
        'completed_task',
        'task',
        taskId,
        `Task completed via email detection: ${result.rows[0].title}`,
        `Automatically detected completion from email ${emailId}`,
      ]
    );

    res.json({
      success: true,
      data: updatedTask,
      message: 'Task marked as complete from email',
    });
  } catch (error) {
    console.error('Error completing task from email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete task from email',
    });
  }
});

/**
 * POST /api/v1/tasks/:taskId/reject-completion
 * Reject an auto-detected task completion
 */
router.post('/:taskId/reject-completion', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { emailId, reason } = req.body;

    // TODO: Log rejection in database for learning
    // This helps improve the detection algorithm over time

    res.json({
      success: true,
      message: 'Completion suggestion rejected',
    });
  } catch (error) {
    console.error('Error rejecting completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject completion',
    });
  }
});

/**
 * GET /api/v1/tasks/completion-suggestions
 * Get pending completion suggestions (not yet reviewed)
 */
router.get('/completion-suggestions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { query } = await import('../../database/connection');

    // Fetch tasks with recent activity scoped to the requesting user's accessible deals
    const result = await query(
      `SELECT 
        t.id as task_id,
        t.title,
        t.description,
        t.status,
        t.deal_id,
        d.name as deal_name,
        t.assigned_to_name,
        COUNT(a.id) as recent_activity_count
      FROM deal_team_tasks t
      LEFT JOIN deals d ON t.deal_id = d.id
      LEFT JOIN deal_team_activity a ON a.target_id::text = t.id::text
        AND a.created_at > NOW() - INTERVAL '7 days'
      WHERE t.status IN ('in-progress', 'review')
        AND t.completed_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM deal_team_members m
            WHERE m.id = t.assigned_to_id AND m.user_id = $1
          )
          OR d.user_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM deal_team_members dtm
            WHERE dtm.deal_id = t.deal_id AND dtm.user_id = $1
          )
        )
      GROUP BY t.id, t.title, t.description, t.status, t.deal_id, d.name, t.assigned_to_name
      HAVING COUNT(a.id) > 0
      ORDER BY COUNT(a.id) DESC
      LIMIT 20`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching completion suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch completion suggestions',
    });
  }
});

export default router;
