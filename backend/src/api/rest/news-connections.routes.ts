/**
 * Per-user news subscription connections (Task #329).
 *
 * Endpoints:
 *   GET    /api/v1/news-connections                      list my connections
 *   POST   /api/v1/news-connections/email                 provision an inbound forwarding address
 *   POST   /api/v1/news-connections/rss                   add a personalized authenticated RSS URL
 *   POST   /api/v1/news-connections/oauth-request         (stub) request enterprise OAuth provider
 *   POST   /api/v1/news-connections/:id/sync              manually sync (RSS only)
 *   PATCH  /api/v1/news-connections/:id                   update label / status
 *   DELETE /api/v1/news-connections/:id                   remove a connection
 *   GET    /api/v1/news-connections/items                 list ingested items for the caller
 *   POST   /api/v1/news-connections/inbound-email         webhook (no auth, address-token-gated)
 */

import { Router, Response, Request } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  generateInboundAddress,
  findConnectionByAddress,
  extractItems,
  persistInboundItems,
  type InboundEmailPayload,
} from '../../services/news-connections/inbound-email';
import {
  encryptFeedSecret,
  pollOneRssConnection,
} from '../../services/news-connections/rss-feeds';

const router = Router();

const INBOUND_EMAIL_DOMAIN =
  process.env.INBOUND_EMAIL_DOMAIN || 'inbox.jedire.app';

const ENTERPRISE_PROVIDERS = new Set(['bloomberg', 'reuters', 'refinitiv']);

/**
 * Strip sensitive columns from a connection row before returning to the API.
 * encrypted_credentials never leaves the server.
 */
function sanitize(row: any) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    address: row.type === 'email' ? row.address : null, // RSS/OAuth secret never returned
    status: row.status,
    metadata: row.metadata || {},
    last_synced_at: row.last_synced_at,
    last_error: row.last_error,
    created_at: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await query(
    `SELECT id, type, label, address, status, metadata,
            last_synced_at, last_error, created_at
       FROM user_news_connections
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  res.json({ connections: result.rows.map(sanitize) });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROVISION INBOUND EMAIL ADDRESS (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const label = String(req.body?.label || 'Forwarded newsletters');

  // Try a few times in the (vanishingly small) chance of token collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const address = generateInboundAddress(INBOUND_EMAIL_DOMAIN);
    try {
      const result = await query(
        `INSERT INTO user_news_connections (user_id, type, label, address, status)
         VALUES ($1, 'email', $2, $3, 'active')
         RETURNING id, type, label, address, status, metadata,
                   last_synced_at, last_error, created_at`,
        [userId, label, address]
      );
      return res.status(201).json({ connection: sanitize(result.rows[0]) });
    } catch (err: any) {
      // Unique-violation on the address index → loop and try a new token.
      if (err?.code !== '23505') {
        logger.error('[news-connections] failed to provision email connection', err);
        return res.status(500).json({ error: 'Could not provision inbound address' });
      }
    }
  }
  return res.status(500).json({ error: 'Could not allocate a unique address; try again' });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADD AUTHENTICATED RSS (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/rss', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const url = String(req.body?.url || '').trim();
  const label = String(req.body?.label || '').trim();

  if (!url || !label) {
    return res.status(400).json({ error: 'url and label are required' });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'url is not a valid URL' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'url must use http(s)' });
  }

  const encrypted = encryptFeedSecret(url);
  const result = await query(
    `INSERT INTO user_news_connections
       (user_id, type, label, encrypted_credentials, status, metadata)
     VALUES ($1, 'rss', $2, $3, 'active', $4::jsonb)
     RETURNING id, type, label, address, status, metadata,
               last_synced_at, last_error, created_at`,
    [userId, label, encrypted, JSON.stringify({ host: parsed.host })]
  );

  // Kick off a one-shot poll so the user sees items immediately. Fire and forget.
  pollOneRssConnection(result.rows[0]).catch((err) =>
    logger.error('[news-connections] initial rss poll failed', err)
  );

  res.status(201).json({ connection: sanitize(result.rows[0]) });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENTERPRISE OAUTH (Phase 3 stub)
// ─────────────────────────────────────────────────────────────────────────────
// Real Bloomberg / Reuters / Refinitiv OAuth requires a customer-supplied
// license. We capture the request and create a connection in pending_oauth
// status; the actual flow is implemented per-tenant during onboarding.

router.post(
  '/oauth-request',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const provider = String(req.body?.provider || '').toLowerCase();
    if (!ENTERPRISE_PROVIDERS.has(provider)) {
      return res.status(400).json({
        error: `provider must be one of: ${Array.from(ENTERPRISE_PROVIDERS).join(', ')}`,
      });
    }
    const result = await query(
      `INSERT INTO user_news_connections
         (user_id, type, label, address, status, metadata)
       VALUES ($1, 'oauth', $2, $3, 'pending_oauth', $4::jsonb)
       RETURNING id, type, label, address, status, metadata,
                 last_synced_at, last_error, created_at`,
      [
        userId,
        `${provider} (Enterprise)`,
        provider,
        JSON.stringify({
          provider,
          note:
            'Enterprise feed: requires customer-supplied license; sales will reach out to complete OAuth setup.',
        }),
      ]
    );
    res.status(202).json({ connection: sanitize(result.rows[0]) });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL SYNC (RSS)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:id/sync',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const id = req.params.id;
    const result = await query(
      `SELECT id, user_id, label, encrypted_credentials, metadata, type
         FROM user_news_connections
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [id, userId]
    );
    const conn = result.rows[0];
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    if (conn.type !== 'rss') {
      return res
        .status(400)
        .json({ error: 'Manual sync only supported for RSS connections' });
    }
    try {
      const out = await pollOneRssConnection(conn);
      return res.json({ success: true, ...out });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Sync failed' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE / DELETE
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const id = req.params.id;
  const allowedStatuses = new Set(['active', 'paused']);

  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (typeof req.body?.label === 'string') {
    sets.push(`label = $${i++}`);
    params.push(req.body.label);
  }
  if (typeof req.body?.status === 'string' && allowedStatuses.has(req.body.status)) {
    sets.push(`status = $${i++}`);
    params.push(req.body.status);
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: 'No updatable fields supplied' });
  }
  sets.push(`updated_at = NOW()`);
  params.push(id, userId);
  const result = await query(
    `UPDATE user_news_connections
        SET ${sets.join(', ')}
      WHERE id = $${i++} AND user_id = $${i++}
      RETURNING id, type, label, address, status, metadata,
                last_synced_at, last_error, created_at`,
    params
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Connection not found' });
  res.json({ connection: sanitize(result.rows[0]) });
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await query(
    `DELETE FROM user_news_connections WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId]
  );
  if ((result.rowCount || 0) === 0) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST INGESTED ITEMS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/items', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
  const connectionId = req.query.connection_id ? String(req.query.connection_id) : null;

  let sql = `SELECT id, connection_id, source, publisher, url, title, summary,
                    author, published_at, fetched_at
               FROM user_news_items
              WHERE user_id = $1`;
  const params: any[] = [userId];
  if (connectionId) {
    sql += ` AND connection_id = $${params.length + 1}`;
    params.push(connectionId);
  }
  sql += ` ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);
  res.json({ items: result.rows });
});

// ─────────────────────────────────────────────────────────────────────────────
// INBOUND EMAIL WEBHOOK (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
// Supports Postmark / Mailgun / SendGrid Inbound Parse shapes. We do NOT
// require an authenticated session here — the user's unique inbound address
// in the To field (combined with optional INBOUND_EMAIL_WEBHOOK_SECRET) is
// the auth.

router.post('/inbound-email', async (req: Request, res: Response) => {
  // Optional shared-secret header. Only enforced when the env var is set so
  // local dev still works without one.
  const expected = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (expected) {
    const got =
      (req.headers['x-jedire-inbound-secret'] as string) ||
      (req.headers['x-webhook-secret'] as string) ||
      '';
    if (got !== expected) return res.status(401).json({ error: 'Bad webhook secret' });
  }

  const body: any = req.body || {};
  // Normalize across vendors:
  //   Postmark: { From, To, Subject, HtmlBody, TextBody, Date }
  //   Mailgun:  { sender, recipient, subject, 'body-html', 'body-plain', timestamp }
  //   SendGrid: { from, to, subject, html, text }
  const payload: InboundEmailPayload = {
    from: body.From || body.from || body.sender || '',
    to: body.To || body.to || body.recipient || '',
    subject: body.Subject || body.subject || '',
    html: body.HtmlBody || body.html || body['body-html'] || '',
    text: body.TextBody || body.text || body['body-plain'] || '',
    receivedAt: body.Date || body.date || body.timestamp || new Date().toISOString(),
  };

  // Resolve which connection owns this `to`. Vendors may pass multi-recipient.
  const recipients = Array.isArray(payload.to)
    ? payload.to
    : String(payload.to || '')
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);

  let conn = null as Awaited<ReturnType<typeof findConnectionByAddress>>;
  for (const rcpt of recipients) {
    const addr = (rcpt.match(/<([^>]+)>/)?.[1] || rcpt).toLowerCase();
    conn = await findConnectionByAddress(addr);
    if (conn) break;
  }
  if (!conn) {
    // Return 200 so the vendor doesn't retry forever for unknown addresses.
    return res.status(200).json({ ok: true, ignored: true, reason: 'no matching connection' });
  }

  const items = extractItems(payload);
  const inserted = await persistInboundItems(conn, payload, items);
  res.status(200).json({ ok: true, extracted: items.length, inserted });
});

export default router;
