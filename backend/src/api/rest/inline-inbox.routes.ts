import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, updateEmailSchema } from './validation';

const router = Router();
const pool = getPool();

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread_only === 'true';
    const flaggedOnly = req.query.flagged_only === 'true';
    const search = req.query.search as string;
    const source = req.query.source as string;

    let whereConditions = ['e.user_id = $1', 'NOT e.is_archived'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (unreadOnly) {
      whereConditions.push('e.is_read = FALSE');
    }
    if (flaggedOnly) {
      whereConditions.push('e.is_flagged = TRUE');
    }
    if (search) {
      whereConditions.push(`(e.subject ILIKE $${paramIndex} OR e.from_name ILIKE $${paramIndex} OR e.from_address ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (source === 'pst') {
      whereConditions.push(`e.external_id LIKE 'pst-%'`);
    } else if (source === 'connected') {
      whereConditions.push(`e.external_id NOT LIKE 'pst-%'`);
    }
    if (req.query.deal_linked === 'true') {
      whereConditions.push('e.deal_id IS NOT NULL');
    }

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT e.id, e.email_account_id, e.user_id, e.external_id, e.thread_id,
              e.subject, e.from_name, e.from_address, e.to_addresses, e.cc_addresses,
              e.body_preview, e.body_text, e.is_read, e.is_flagged, e.is_archived,
              e.has_attachments, e.deal_id, e.property_id, e.ai_processed,
              e.received_at, e.sent_at, e.created_at,
              d.name as deal_name,
              ea.provider as source_provider,
              (SELECT COUNT(*) FROM email_attachments att WHERE att.email_id = e.id) as attachment_count
       FROM emails e
       LEFT JOIN deals d ON e.deal_id = d.id
       LEFT JOIN email_accounts ea ON e.email_account_id = ea.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY e.received_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    if (error.code === '42P01') {
      res.json({ success: true, data: [] });
    } else {
      console.error('Error fetching inbox:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch emails' });
    }
  }
});

router.get('/pst-imports', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    const whereConditions = ['e.user_id = $1', "e.external_id LIKE 'pst-%'"];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(pei.subject ILIKE $${paramIndex} OR pei.sender ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT e.id, e.subject, e.from_name, e.from_address, e.body_preview,
              e.received_at, e.is_read, e.is_flagged, e.has_attachments,
              e.deal_id, e.created_at, e.external_id, e.to_addresses,
              pei.has_signal, pei.upload_id,
              du.original_filename as source_file,
              'pst_import' as source_provider
       FROM emails e
       JOIN pst_email_imports pei ON 'pst-' || pei.id::text = e.external_id
       JOIN data_uploads du ON du.id = pei.upload_id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY e.received_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const countParams = params.slice(0, paramIndex - 1);
    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM emails e
       WHERE e.user_id = $1 AND e.external_id LIKE 'pst-%'`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      total: countResult.rows[0]?.total || 0,
    });
  } catch (error: any) {
    if (error.code === '42P01') {
      res.json({ success: true, data: [], total: 0 });
    } else {
      console.error('Error fetching PST imports:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch PST imports' });
    }
  }
});

router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      `SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE NOT is_read)::int as unread,
        COUNT(*) FILTER (WHERE is_flagged)::int as flagged,
        COUNT(*) FILTER (WHERE deal_id IS NOT NULL)::int as deal_related,
        COUNT(*) FILTER (WHERE has_attachments)::int as with_attachments,
        COUNT(*) FILTER (WHERE external_id LIKE 'pst-%')::int as pst_imports
       FROM emails WHERE user_id = $1 AND NOT is_archived`,
      [userId]
    );
    res.json({ success: true, data: result.rows[0] || { total: 0, unread: 0, flagged: 0, deal_related: 0, with_attachments: 0, pst_imports: 0 } });
  } catch (error: any) {
    if (error.code === '42P01') {
      res.json({ success: true, data: { total: 0, unread: 0, flagged: 0, deal_related: 0, with_attachments: 0, pst_imports: 0 } });
    } else {
      console.error('Error fetching inbox stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
  }
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const emailId = parseInt(req.params.id);
    if (isNaN(emailId)) {
      return res.status(400).json({ success: false, error: 'Invalid email ID' });
    }
    const result = await pool.query(
      `SELECT e.*, d.name as deal_name, ea.provider as source_provider
       FROM emails e
       LEFT JOIN deals d ON e.deal_id = d.id
       LEFT JOIN email_accounts ea ON e.email_account_id = ea.id
       WHERE e.id = $1 AND e.user_id = $2`,
      [emailId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    const attachments = await pool.query('SELECT * FROM email_attachments WHERE email_id = $1', [emailId]);
    const email = { ...result.rows[0], attachments: attachments.rows };
    res.json({ success: true, data: email });
  } catch (error: any) {
    console.error('Error fetching email:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email' });
  }
});

router.patch('/:id', requireAuth, validate(updateEmailSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const emailId = parseInt(req.params.id);
    const updates = req.body;
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['is_read', 'is_flagged', 'is_archived', 'deal_id'].includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    params.push(emailId, userId);
    await pool.query(
      `UPDATE emails SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      params
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating email:', error);
    res.status(500).json({ success: false, error: 'Failed to update email' });
  }
});

export default router;
