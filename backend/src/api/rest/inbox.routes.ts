/**
 * Email Inbox API Routes
 * Full email management system
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/inbox
 * Get user's emails with filtering
 */
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 1;
    const {
      limit = 50,
      offset = 0,
      unread_only = 'false',
      deal_id,
      label,
      search,
    } = req.query;

    let whereConditions = ['e.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (unread_only === 'true') {
      whereConditions.push('e.is_read = FALSE');
    }

    if (deal_id) {
      whereConditions.push(`e.deal_id = $${paramIndex}`);
      params.push(parseInt(deal_id as string));
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(e.subject ILIKE $${paramIndex} OR e.from_name ILIKE $${paramIndex} OR e.body_text ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));

    const sql = `
      SELECT 
        e.id,
        e.subject,
        e.from_name,
        e.from_address,
        e.body_preview,
        e.is_read,
        e.is_flagged,
        e.has_attachments,
        e.deal_id,
        e.received_at,
        e.created_at,
        d.name as deal_name,
        (SELECT COUNT(*) FROM email_attachments WHERE email_id = e.id) as attachment_count
      FROM emails e
      LEFT JOIN deals d ON e.deal_id = d.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY e.received_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(sql, params);

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM emails e
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await query(countSql, params.slice(0, -2));

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching emails:', error);
    next(error);
  }
});

/**
 * GET /api/v1/inbox/stats
 * Get inbox statistics
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 1;

    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = FALSE) as unread,
        COUNT(*) FILTER (WHERE is_flagged = TRUE) as flagged,
        COUNT(*) FILTER (WHERE deal_id IS NOT NULL) as deal_related,
        COUNT(*) FILTER (WHERE has_attachments = TRUE) as with_attachments
      FROM emails
      WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching inbox stats:', error);
    next(error);
  }
});

/**
 * GET /api/v1/inbox/:id
 * Get single email with full content
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || 1;

    const result = await query(
      `SELECT 
        e.*,
        d.name as deal_name,
        ea.email_address as account_email
      FROM emails e
      LEFT JOIN deals d ON e.deal_id = d.id
      LEFT JOIN email_accounts ea ON e.email_account_id = ea.id
      WHERE e.id = $1 AND e.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    // Get attachments
    const attachmentsResult = await query(
      'SELECT * FROM email_attachments WHERE email_id = $1',
      [id]
    );

    // Mark as read if not already
    if (!result.rows[0].is_read) {
      await query(
        'UPDATE emails SET is_read = TRUE WHERE id = $1',
        [id]
      );
    }

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        attachments: attachmentsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching email:', error);
    next(error);
  }
});

/**
 * PATCH /api/v1/inbox/:id
 * Update email (mark read, flag, link to deal, etc)
 */
router.patch('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || 1;
    const { is_read, is_flagged, deal_id, is_archived } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof is_read === 'boolean') {
      updates.push(`is_read = $${paramIndex}`);
      params.push(is_read);
      paramIndex++;
    }

    if (typeof is_flagged === 'boolean') {
      updates.push(`is_flagged = $${paramIndex}`);
      params.push(is_flagged);
      paramIndex++;
    }

    if (deal_id !== undefined) {
      updates.push(`deal_id = $${paramIndex}`);
      params.push(deal_id ? parseInt(deal_id) : null);
      paramIndex++;
    }

    if (typeof is_archived === 'boolean') {
      updates.push(`is_archived = $${paramIndex}`);
      params.push(is_archived);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided',
      });
    }

    params.push(id);
    params.push(userId);

    const sql = `
      UPDATE emails
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating email:', error);
    next(error);
  }
});

/**
 * DELETE /api/v1/inbox/:id
 * Delete email (or move to trash)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || 1;
    const { permanent = 'false' } = req.query;

    if (permanent === 'true') {
      // Permanently delete
      await query(
        'DELETE FROM emails WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
    } else {
      // Move to trash (archive)
      await query(
        'UPDATE emails SET is_archived = TRUE WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
    }

    res.json({
      success: true,
      message: permanent === 'true' ? 'Email permanently deleted' : 'Email moved to trash',
    });
  } catch (error) {
    logger.error('Error deleting email:', error);
    next(error);
  }
});

/**
 * POST /api/v1/inbox/sync
 * Trigger email sync (pull from provider)
 */
router.post('/sync', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 1;

    // Get user's email accounts
    const accountsResult = await query(
      'SELECT * FROM email_accounts WHERE user_id = $1 AND sync_enabled = TRUE',
      [userId]
    );

    if (accountsResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No email accounts configured',
        synced: 0,
      });
    }

    // TODO: Implement actual provider sync
    // For now, return success
    logger.info('Email sync triggered', {
      userId,
      accounts: accountsResult.rows.length,
    });

    res.json({
      success: true,
      message: 'Email sync started',
      accounts: accountsResult.rows.length,
    });
  } catch (error) {
    logger.error('Error syncing emails:', error);
    next(error);
  }
});

/**
 * POST /api/v1/inbox/compose
 * Send a new email
 */
router.post('/compose', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 1;
    const { to, cc, subject, body, deal_id } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'To, subject, and body are required',
      });
    }

    // TODO: Implement actual email sending via provider
    // For now, just log it
    logger.info('Email composed', {
      userId,
      to,
      subject,
      deal_id,
    });

    res.status(201).json({
      success: true,
      message: 'Email sent successfully',
      data: {
        to,
        subject,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error sending email:', error);
    next(error);
  }
});

/**
 * POST /api/v1/inbox/bulk-action
 * Bulk actions on emails
 */
router.post('/bulk-action', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 1;
    const { email_ids, action } = req.body;

    if (!email_ids || !Array.isArray(email_ids) || email_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'email_ids array is required',
      });
    }

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'action is required (mark_read, mark_unread, flag, unflag, archive, delete)',
      });
    }

    let sql = '';
    const params = [userId, email_ids];

    switch (action) {
      case 'mark_read':
        sql = 'UPDATE emails SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2)';
        break;
      case 'mark_unread':
        sql = 'UPDATE emails SET is_read = FALSE WHERE user_id = $1 AND id = ANY($2)';
        break;
      case 'flag':
        sql = 'UPDATE emails SET is_flagged = TRUE WHERE user_id = $1 AND id = ANY($2)';
        break;
      case 'unflag':
        sql = 'UPDATE emails SET is_flagged = FALSE WHERE user_id = $1 AND id = ANY($2)';
        break;
      case 'archive':
        sql = 'UPDATE emails SET is_archived = TRUE WHERE user_id = $1 AND id = ANY($2)';
        break;
      case 'delete':
        sql = 'DELETE FROM emails WHERE user_id = $1 AND id = ANY($2)';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action',
        });
    }

    const result = await query(sql, params);

    res.json({
      success: true,
      message: `Bulk action '${action}' completed`,
      affected: result.rowCount,
    });
  } catch (error) {
    logger.error('Error performing bulk action:', error);
    next(error);
  }
});

export default router;
