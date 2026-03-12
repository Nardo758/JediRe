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
              e.is_flagged as has_signal,
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

router.get('/accounts', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;

    const gmailResult = await pool.query(
      `SELECT uea.id, uea.email_address, uea.provider, uea.last_sync_at,
              uea.sync_enabled, uea.created_at, uea.token_expires_at,
              COALESCE((SELECT COUNT(*)::int FROM emails e WHERE e.email_account_id = uea.id), 0) as email_count
       FROM user_email_accounts uea
       WHERE uea.user_id = $1
       ORDER BY uea.created_at DESC`,
      [userId]
    );

    let microsoftRows: any[] = [];
    try {
      const msResult = await pool.query(
        `SELECT ma.id, ma.email as email_address, 'microsoft' as provider,
                ma.last_sync_at, ma.is_active as sync_enabled, ma.created_at,
                ma.token_expires_at,
                COALESCE((
                  SELECT COUNT(*)::int FROM emails e
                  WHERE e.user_id = ma.user_id AND e.external_id LIKE 'ms-%'
                ), 0) as email_count
         FROM microsoft_accounts ma
         WHERE ma.user_id = $1 AND ma.is_active = true
         ORDER BY ma.created_at DESC`,
        [userId]
      );
      microsoftRows = msResult.rows;
    } catch (e: any) {
      if (e.code !== '42P01') {
        console.error('Error fetching Microsoft accounts:', e);
      }
    }

    const now = new Date();
    const accounts = [
      ...gmailResult.rows.map((r: any) => ({
        ...r,
        provider: r.provider || 'google',
        needs_reauth: r.token_expires_at ? new Date(r.token_expires_at) < now : false,
      })),
      ...microsoftRows.map((r: any) => ({
        ...r,
        needs_reauth: r.token_expires_at ? new Date(r.token_expires_at) < now : false,
      })),
    ];

    res.json({ success: true, data: accounts });
  } catch (error: any) {
    if (error.code === '42P01') {
      res.json({ success: true, data: [] });
    } else {
      console.error('Error fetching connected accounts:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch accounts' });
    }
  }
});

router.post('/accounts/:id/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const accountId = req.params.id;

    const gmailCheck = await pool.query(
      'SELECT id FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (gmailCheck.rows.length > 0) {
      const { gmailSyncService } = require('../../services/gmail-sync.service');
      const result = await gmailSyncService.syncEmails(accountId, 50);
      return res.json({ success: true, data: result });
    }

    let msCheck;
    try {
      msCheck = await pool.query(
        'SELECT id, user_id, email as email_address, access_token, refresh_token, token_expires_at FROM microsoft_accounts WHERE id = $1 AND user_id = $2 AND is_active = true',
        [accountId, userId]
      );
    } catch (e: any) {
      if (e.code === '42P01') {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      throw e;
    }

    if (msCheck && msCheck.rows.length > 0) {
      const msAccount = msCheck.rows[0];
      let accessToken = msAccount.access_token;

      if (msAccount.token_expires_at && new Date(msAccount.token_expires_at) < new Date()) {
        if (msAccount.refresh_token) {
          try {
            const axios = require('axios');
            const refreshRes = await axios.post(
              `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
              new URLSearchParams({
                client_id: process.env.MICROSOFT_CLIENT_ID || '',
                client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
                refresh_token: msAccount.refresh_token,
                grant_type: 'refresh_token',
              }),
              { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            accessToken = refreshRes.data.access_token;
            const newExpiry = new Date(Date.now() + (refreshRes.data.expires_in || 3600) * 1000);
            await pool.query(
              'UPDATE microsoft_accounts SET access_token = $1, refresh_token = COALESCE($2, refresh_token), token_expires_at = $3, updated_at = NOW() WHERE id = $4',
              [accessToken, refreshRes.data.refresh_token || null, newExpiry, accountId]
            );
          } catch (refreshErr) {
            console.error('Microsoft token refresh failed:', refreshErr);
            return res.status(401).json({ success: false, error: 'Token expired. Please reconnect your Outlook account.' });
          }
        } else {
          return res.status(401).json({ success: false, error: 'Token expired. Please reconnect your Outlook account.' });
        }
      }

      try {
        const axios = require('axios');
        const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages', {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            '$top': 50,
            '$select': 'id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,isRead',
            '$orderby': 'receivedDateTime DESC',
          },
        });

        const messages = graphRes.data.value || [];
        let stored = 0;
        let skipped = 0;

        const emailAccountResult = await pool.query(
          `SELECT id FROM email_accounts WHERE provider = 'microsoft' AND user_id = $1 LIMIT 1`,
          [userId]
        );

        let emailAccountId: number;
        if (emailAccountResult.rows.length > 0) {
          emailAccountId = emailAccountResult.rows[0].id;
        } else {
          const insertResult = await pool.query(
            `INSERT INTO email_accounts (user_id, provider, email_address, display_name, is_active)
             VALUES ($1, 'microsoft', $2, $3, true) RETURNING id`,
            [userId, msAccount.email_address, msAccount.email_address]
          );
          emailAccountId = insertResult.rows[0].id;
        }

        for (const msg of messages) {
          const externalId = `ms-${msg.id}`;
          const existing = await pool.query(
            'SELECT id FROM emails WHERE external_id = $1 AND user_id = $2',
            [externalId, userId]
          );
          if (existing.rows.length > 0) {
            skipped++;
            continue;
          }

          const fromName = msg.from?.emailAddress?.name || '';
          const fromAddress = msg.from?.emailAddress?.address || '';
          const receivedAt = msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date();

          await pool.query(
            `INSERT INTO emails (email_account_id, user_id, external_id, subject, from_name, from_address,
              body_preview, body_text, is_read, has_attachments, received_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              emailAccountId, userId, externalId,
              msg.subject || '(no subject)', fromName, fromAddress,
              msg.bodyPreview || '', msg.body?.content || '',
              msg.isRead !== false, msg.hasAttachments || false, receivedAt,
            ]
          );
          stored++;
        }

        await pool.query('UPDATE microsoft_accounts SET last_sync_at = NOW() WHERE id = $1', [accountId]);

        return res.json({ success: true, data: { fetched: messages.length, stored, skipped } });
      } catch (graphErr: any) {
        console.error('Microsoft Graph sync error:', graphErr?.response?.data || graphErr);
        if (graphErr?.response?.status === 401) {
          return res.status(401).json({ success: false, error: 'Token expired. Please reconnect your Outlook account.' });
        }
        return res.status(500).json({ success: false, error: 'Failed to sync Outlook emails' });
      }
    }

    res.status(404).json({ success: false, error: 'Account not found' });
  } catch (error: any) {
    console.error('Error syncing account:', error);
    res.status(500).json({ success: false, error: 'Failed to sync account' });
  }
});

router.get('/pst-imports', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    const whereConditions = [
      "(du.user_id = $1 OR e.user_id = $1)",
      "du.file_type = 'pst'"
    ];
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
      `SELECT
              e.id,
              pei.subject,
              CASE WHEN pei.sender LIKE '%<%' THEN TRIM(SPLIT_PART(pei.sender, '<', 1)) ELSE pei.sender END as from_name,
              CASE
                WHEN pei.sender LIKE '%<%>%' THEN TRIM(BOTH '<>' FROM SUBSTRING(pei.sender FROM '<([^>]+)>'))
                WHEN pei.sender LIKE '%@%' THEN pei.sender
                ELSE 'unknown@pst-import.local'
              END as from_address,
              LEFT(pei.raw_body, 500) as body_preview,
              COALESCE(pei.email_date, pei.created_at) as received_at,
              COALESCE(e.is_read, true) as is_read,
              pei.has_signal as is_flagged,
              pei.has_signal,
              pei.has_attachments,
              pei.created_at,
              pei.upload_id,
              pei.recipients as to_addresses,
              du.original_filename as source_file,
              'pst_import' as source_provider,
              'pst-' || pei.id::text as external_id,
              e.deal_id
       FROM pst_email_imports pei
       JOIN data_uploads du ON du.id = pei.upload_id
       LEFT JOIN emails e ON e.external_id = 'pst-' || pei.id::text
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY pei.email_date DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total
       FROM pst_email_imports pei
       JOIN data_uploads du ON du.id = pei.upload_id
       LEFT JOIN emails e ON e.external_id = 'pst-' || pei.id::text
       WHERE (du.user_id = $1 OR e.user_id = $1) AND du.file_type = 'pst'`,
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

router.get('/:id/intel', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const emailId = parseInt(req.params.id);
    if (isNaN(emailId)) {
      return res.status(400).json({ success: false, error: 'Invalid email ID' });
    }

    let propertyExtractions: any[] = [];
    try {
      const propResult = await pool.query(
        `SELECT pq.*, mp.id as pin_id, mp.property_name, mp.address as pin_address
         FROM property_extraction_queue pq
         LEFT JOIN map_pins mp ON pq.created_pin_id = mp.id
         WHERE pq.email_id = $1 AND pq.user_id = $2
         ORDER BY pq.created_at DESC`,
        [emailId, userId]
      );
      propertyExtractions = propResult.rows;
    } catch (e: any) {
      if (e.code !== '42P01') console.error('Error fetching property extractions:', e);
    }

    let newsExtraction = null;
    try {
      const emailRaw = await pool.query('SELECT raw_data FROM emails WHERE id = $1 AND user_id = $2', [emailId, userId]);
      const linkedNewsId = emailRaw.rows[0]?.raw_data?.linkedNewsItemId;
      if (linkedNewsId) {
        const newsResult = await pool.query(
          `SELECT id, title, summary, category, impact_score, sentiment_score, published_date FROM news_items WHERE id = $1`,
          [linkedNewsId]
        );
        newsExtraction = newsResult.rows[0] || null;
      }
    } catch (e: any) {
      if (e.code !== '42P01') console.error('Error fetching news extraction:', e);
    }

    let actionItems: any[] = [];
    try {
      const emailBody = await pool.query('SELECT body_text, body_preview FROM emails WHERE id = $1 AND user_id = $2', [emailId, userId]);
      const body = emailBody.rows[0]?.body_text || emailBody.rows[0]?.body_preview || '';
      if (body) {
        const actionPatterns = [
          /(?:please|can you|could you|need to|should|must|have to)\s+(send|provide|submit|schedule|review|complete|prepare|update|contact|call|email)/gi,
          /(by|before|until|no later than)\s+(\w+day|this week|next week|\d{1,2}\/\d{1,2})/gi,
        ];
        const sentences = body.split(/[.!?\n]+/);
        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (!trimmed || trimmed.length < 10) continue;
          for (const pattern of actionPatterns) {
            pattern.lastIndex = 0;
            if (pattern.test(trimmed)) {
              let priority: string = 'medium';
              if (/urgent|asap|immediately|critical/i.test(trimmed)) priority = 'urgent';
              else if (/important|soon|priority/i.test(trimmed)) priority = 'high';
              actionItems.push({
                text: trimmed.slice(0, 300),
                suggestedTask: trimmed.replace(/^(please|can you|could you|need to|should)\s+/i, '').trim().slice(0, 200),
                priority,
              });
              break;
            }
          }
        }
      }
    } catch (e: any) {
      console.error('Error detecting action items:', e);
    }

    let linkedTasks: any[] = [];
    try {
      const taskResult = await pool.query(
        `SELECT id, title, status, priority, due_date, created_at FROM deal_tasks WHERE deal_id IN (
          SELECT deal_id FROM emails WHERE id = $1 AND user_id = $2 AND deal_id IS NOT NULL
        ) ORDER BY created_at DESC LIMIT 10`,
        [emailId, userId]
      );
      linkedTasks = taskResult.rows;
    } catch (e: any) {
      if (e.code !== '42P01') console.error('Error fetching linked tasks:', e);
    }

    res.json({
      success: true,
      data: {
        emailId,
        propertyExtractions,
        newsExtraction,
        actionItems: actionItems.slice(0, 10),
        linkedTasks,
      },
    });
  } catch (error: any) {
    console.error('Error fetching email intel:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch email intelligence' });
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
