/**
 * Capsule Sharing Routes — Piece 4 Foundation
 *
 * External share creation, access token resolution, and API key connection.
 * Uses capsule_external_shares table (references deal_capsules, not deals).
 *
 * Route groups:
 *   Mounted at /api/v1/capsules-ext (authenticated, capsule-owner actions)
 *     POST   /:capsuleId/share/external
 *     GET    /:capsuleId/shares
 *     POST   /:capsuleId/shares/:shareId/revoke
 *
 *   Mounted at /api/v1 (token-based, no platform auth)
 *     GET    /capsule-links/:accessToken
 *     POST   /capsule-links/:accessToken/connect_api
 *     POST   /capsule-links/:accessToken/query
 *     DELETE /capsule-links/:accessToken/connect_api
 *
 * @version 1.1.0
 * @date 2026-05-19
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { executeRecipientQuery } from '../../services/recipient-agent-executor.service';
import { encryptToken } from '../../services/encryption';
import * as crypto from 'crypto';

const router = Router();

// In-memory store for capsule resolution rate limiting
const rateLimitStore = new Map<string, number[]>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(): { token: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { token: raw, hash };
}

// UUID pattern: 8-4-4-4-12 hex chars separated by dashes.
// Access tokens are 64-char hex strings (no dashes); capsule IDs are UUIDs.
// Used to distinguish the two in the /capsules/:param routes.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── createExternalShareInternal — single source of truth for share creation ──
//
// Called by both /:capsuleId/share/external and /deals/:dealId/share/external.
// Centralising here ensures validation, ownership check, token generation, and
// the INSERT stay in sync regardless of which path is used.
//
// API contract note: :dealId in the /deals/ alias is treated as a capsule UUID.
// deal_capsules rows have no separate deal_id column — capsules are standalone.
// Callers passing a true deal UUID (not a capsule UUID) will receive 403.

async function createExternalShareInternal(
  capsuleId: string,
  userId: string,
  body: Record<string, unknown>,
  req: Request,
  res: Response,
): Promise<void> {
  const {
    recipient_email,
    recipient_name,
    share_type,
    allow_document_download,
    allow_agent_interaction,
    expires_at,
    preview_text,
    preview_metadata,
  } = body;

  if (!recipient_email) {
    res.status(400).json({ error: 'recipient_email is required' }); return;
  }
  const shareType = (share_type as string) ?? 'external_view';
  if (!['external_view', 'external_agent_enabled'].includes(shareType)) {
    res.status(400).json({ error: 'share_type must be external_view or external_agent_enabled' }); return;
  }
  if (preview_text && typeof preview_text === 'string' && preview_text.length > 500) {
    res.status(400).json({ error: 'preview_text must not exceed 500 characters' }); return;
  }
  if (preview_metadata && (typeof preview_metadata !== 'object' || Array.isArray(preview_metadata))) {
    res.status(400).json({ error: 'preview_metadata must be a JSON object' }); return;
  }

  const pool = getPool();

  const capsuleCheck = await pool.query(
    `SELECT 1 FROM deal_capsules WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [capsuleId, userId]
  );
  if (capsuleCheck.rows.length === 0) {
    res.status(403).json({ error: 'Capsule not found or access denied' }); return;
  }

  const { token, hash } = generateAccessToken();

  const shareResult = await pool.query(
    `INSERT INTO capsule_external_shares
       (capsule_id, shared_by_user_id, share_type, recipient_email, recipient_name,
        allow_document_download, allow_agent_interaction, expires_at, access_token,
        preview_text, preview_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING share_id, created_at`,
    [
      capsuleId,
      userId,
      shareType,
      recipient_email,
      recipient_name ?? null,
      allow_document_download !== false,
      allow_agent_interaction !== false,
      expires_at ?? null,
      hash,
      preview_text ?? null,
      preview_metadata ? JSON.stringify(preview_metadata) : null,
    ]
  );

  const share = shareResult.rows[0];
  const baseUrl = process.env.PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`;
  const capsuleUrl = `${baseUrl}/capsule-link/${token}`;

  logger.info('External share created', {
    capsuleId, shareId: share.share_id,
    recipientEmail: recipient_email, shareType, hasPreview: !!preview_text,
  });

  res.status(201).json({
    share_id: share.share_id,
    capsule_url: capsuleUrl,
    access_token: token,
    recipient_email,
    share_type: shareType,
    expires_at: expires_at ?? null,
    preview_text: preview_text ?? null,
    preview_metadata: preview_metadata ?? null,
    created_at: share.created_at,
  });
}

// ─── POST /:capsuleId/share/external ─────────────────────────────────────────

router.post('/:capsuleId/share/external', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { capsuleId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;
  try {
    await createExternalShareInternal(capsuleId, userId, req.body, req, res);
  } catch (err: any) {
    logger.error('Failed to create external share', { error: err?.message, capsuleId });
    if (!res.headersSent) res.status(500).json({ error: err?.message ?? 'Failed to create share' });
  }
});

// ─── POST /deals/:dealId/share/external (spec-required alias) ────────────────
// Task spec references POST /api/v1/deals/:dealId/share/external.
// :dealId is treated as the capsule UUID — see createExternalShareInternal for
// the API contract note on this naming.

router.post('/deals/:dealId/share/external', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const capsuleId = req.params.dealId;
  const userId = req.user?.userId ?? (req as any).user?.id;
  try {
    await createExternalShareInternal(capsuleId, userId, req.body, req, res);
  } catch (err: any) {
    logger.error('Failed to create external share (deals alias)', { error: err?.message, capsuleId });
    if (!res.headersSent) res.status(500).json({ error: err?.message ?? 'Failed to create share' });
  }
});

// ─── Token resolution handler (shared by /capsules/:token and /capsule-links/:token) ──

async function handleTokenResolution(req: Request, res: Response) {
  const { accessToken } = req.params;
  try {
    const pool = getPool();
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const rateKey = `capsule_resolve:${clientIp}`;
    const now = Date.now();
    const rateWindows = rateLimitStore.get(rateKey) ?? [];
    const recent = rateWindows.filter(t => now - t < 600_000);
    if (recent.length >= 5) {
      return res.status(429).json({ error: 'Too many capsule resolution attempts. Please wait before retrying.' });
    }
    recent.push(now);
    rateLimitStore.set(rateKey, recent);

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const shareResult = await pool.query(
      `SELECT ces.share_type, ces.allow_document_download,
              ces.allow_agent_interaction, ces.expires_at, ces.revoked_at,
              ces.recipient_email, ces.preview_text, ces.preview_metadata
       FROM capsule_external_shares ces
       WHERE ces.access_token = $1
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       LIMIT 1`,
      [tokenHash]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found or has been revoked/expired' });
    }
    const share = shareResult.rows[0];
    return res.json({
      share_exists: true,
      share_type: share.share_type,
      recipient_email: share.recipient_email,
      allow_document_download: share.allow_document_download,
      allow_agent_interaction: share.allow_agent_interaction,
      expires_at: share.expires_at,
      agent_enabled: share.share_type === 'external_agent_enabled',
      preview_text: share.preview_text ?? null,
      preview_metadata: share.preview_metadata ?? null,
      must_connect_api: true,
      next_step: share.share_type === 'external_agent_enabled'
        ? 'Connect an API key via POST /capsule-links/:accessToken/connect_api, then query via POST /capsule-links/:accessToken/query'
        : 'Share type does not support agent interaction',
    });
  } catch (err: any) {
    logger.error('Failed to resolve capsule', { error: err?.message });
    return res.status(500).json({ error: 'Failed to resolve capsule' });
  }
}

// ─── GET /capsule-links/:accessToken/deal-book ───────────────────────────────
// Returns the full capsule content for external display.
// Rate limit: 30 per hour per IP (less aggressive than token resolution).
// Public — no platform auth required; share token is the credential.

const dealBookRateLimitStore = new Map<string, number[]>();

router.get('/capsule-links/:accessToken/deal-book', async (req: Request, res: Response) => {
  const { accessToken } = req.params;
  try {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const rateKey = `deal_book:${clientIp}`;
    const now = Date.now();
    const hits = (dealBookRateLimitStore.get(rateKey) ?? []).filter(t => now - t < 3_600_000);
    if (hits.length >= 30) {
      return res.status(429).json({ error: 'Too many requests. Please wait before refreshing.' });
    }
    hits.push(now);
    dealBookRateLimitStore.set(rateKey, hits);

    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareResult = await pool.query(
      `SELECT ces.share_id, ces.capsule_id, ces.share_type,
              ces.allow_document_download, ces.allow_agent_interaction,
              ces.expires_at, ces.revoked_at, ces.recipient_email,
              ces.preview_text, ces.preview_metadata
       FROM capsule_external_shares ces
       WHERE ces.access_token = $1
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       LIMIT 1`,
      [tokenHash]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule link is invalid, expired, or has been revoked.' });
    }

    const share = shareResult.rows[0];

    const capsuleResult = await pool.query(
      `SELECT id, property_address, asset_class, status,
              jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs,
              created_at, updated_at
       FROM deal_capsules
       WHERE id = $1
       LIMIT 1`,
      [share.capsule_id]
    );

    if (capsuleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule content not found.' });
    }

    const capsule = capsuleResult.rows[0];

    logger.info('Deal book served', {
      capsuleId: share.capsule_id,
      shareId: share.share_id,
      shareType: share.share_type,
    });

    return res.json({
      share: {
        share_type: share.share_type,
        agent_enabled: share.share_type === 'external_agent_enabled',
        allow_document_download: share.allow_document_download,
        allow_agent_interaction: share.allow_agent_interaction,
        expires_at: share.expires_at,
        preview_text: share.preview_text ?? null,
        preview_metadata: share.preview_metadata ?? null,
        recipient_email: share.recipient_email,
      },
      capsule: {
        id: capsule.id,
        property_address: capsule.property_address,
        asset_class: capsule.asset_class,
        status: capsule.status,
        jedi_score: capsule.jedi_score,
        collision_score: capsule.collision_score,
        deal_data: capsule.deal_data ?? {},
        platform_intel: capsule.platform_intel ?? {},
        user_adjustments: capsule.user_adjustments ?? {},
        module_outputs: capsule.module_outputs ?? {},
        created_at: capsule.created_at,
      },
    });
  } catch (err: any) {
    logger.error('Failed to serve deal book', { error: err?.message });
    return res.status(500).json({ error: 'Failed to load deal book.' });
  }
});

// ─── GET /capsules/:accessToken (spec-required endpoint with UUID passthrough) ─
// If the param is a UUID (capsule detail request), passes to next middleware so
// the authenticated capsule.routes handler can process it.
// If it's a 64-char hex access token, resolves as a share record.
// This ensures GET /api/v1/capsules/:id (UUID) and GET /api/v1/capsules/:token (hex)
// both work correctly without route collision.

router.get('/capsules/:accessToken', async (req: Request, res: Response, next: NextFunction) => {
  const { accessToken } = req.params;
  if (UUID_RE.test(accessToken)) {
    return next(); // capsule UUID — let authenticated capsule.routes handle it
  }
  return handleTokenResolution(req, res);
});

// ─── GET /capsule-links/:accessToken ─────────────────────────────────────────

router.get('/capsule-links/:accessToken', (req: Request, res: Response) => {
  return handleTokenResolution(req, res);
});

// ─── POST /capsule-links/:accessToken/connect_api ────────────────────────────

router.post('/capsule-links/:accessToken/connect_api', async (req, res: Response) => {
  const { accessToken } = req.params;
  const { provider, api_key } = req.body;

  if (!provider || !api_key) {
    return res.status(400).json({ error: 'provider and api_key are required' });
  }

  if (!['anthropic', 'openai'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be anthropic or openai' });
  }

  try {
    const pool = getPool();

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareResult = await pool.query(
      `SELECT share_id, share_type, recipient_email FROM capsule_external_shares
       WHERE access_token = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [tokenHash]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found or expired' });
    }

    const share = shareResult.rows[0];

    if (share.share_type !== 'external_agent_enabled') {
      return res.status(403).json({ error: 'Agent interaction not enabled for this share' });
    }

    // Create or resolve Stripe customer
    let stripeCustomerId: string | null = null;
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        const recipientEmail = share.recipient_email;

        if (recipientEmail) {
          const existing = await stripe.customers.list({
            email: recipientEmail,
            limit: 1,
          });
          stripeCustomerId = existing.data[0]?.id ?? null;
        }

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: recipientEmail ?? undefined,
            metadata: {
              source: 'capsule_share',
              share_id: share.share_id,
            },
          });
          stripeCustomerId = customer.id;
          logger.info('Created Stripe customer for capsule recipient', {
            shareId: share.share_id,
            stripeCustomerId,
          });
        }
      }
    } catch (stripeErr: any) {
      logger.warn('Stripe customer creation failed (non-fatal)', {
        error: stripeErr?.message,
        shareId: share.share_id,
      });
    }

    // Validate the API key against the provider
    try {
      if (provider === 'anthropic') {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const testClient = new Anthropic({ apiKey: api_key });
        await testClient.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          system: 'Respond with a single word: ok',
          messages: [{ role: 'user', content: 'test' }],
        });
      } else if (provider === 'openai') {
        const OpenAI = await import('openai');
        const testClient = new OpenAI.default({ apiKey: api_key });
        await testClient.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        });
      }
    } catch (validationErr: any) {
      logger.warn('API key validation failed', {
        provider,
        error: validationErr?.message,
      });
      return res.status(400).json({
        error: 'API key validation failed',
        detail: validationErr?.message ?? 'Provider rejected the key. Check that the key is valid and has access to the selected model.',
      });
    }

    const encryptedKey = encryptToken(api_key);

    const connectionResult = await pool.query(
      `INSERT INTO recipient_api_connections
         (share_id, provider, api_key_encrypted, stripe_customer_id)
       VALUES ($1, $2, $3, $4)
       RETURNING connection_id, connected_at`,
      [share.share_id, provider, encryptedKey, stripeCustomerId]
    );

    const connection = connectionResult.rows[0];

    logger.info('API key connected to capsule (AES-256-GCM)', {
      shareId: share.share_id,
      connectionId: connection.connection_id,
      provider,
      hasStripeCustomer: !!stripeCustomerId,
    });

    return res.status(201).json({
      connection_id: connection.connection_id,
      provider,
      connected_at: connection.connected_at,
      status: 'connected',
      note: 'API key validated and encrypted at rest (AES-256-GCM). You can now query the agent via POST /capsule-links/:accessToken/query',
    });
  } catch (err: any) {
    logger.error('Failed to connect API key', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to connect API key' });
  }
});

// ─── POST /capsule-links/:accessToken/query ───────────────────────────────────

router.post('/capsule-links/:accessToken/query', async (req, res: Response) => {
  const { accessToken } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }

  if (message.length > 10000) {
    return res.status(400).json({ error: 'Message too long (max 10,000 characters)' });
  }

  try {
    const result = await executeRecipientQuery(accessToken, message.trim());

    return res.json({
      response: result.response,
      usage: {
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
        cost_basis_usd: result.cost_basis_usd,
        platform_margin_usd: result.platform_margin_usd,
        total_charged_usd: result.total_charged_usd,
      },
    });
  } catch (err: any) {
    logger.error('Recipient query failed', { error: err?.message });
    return res.status(400).json({ error: err?.message ?? 'Query failed' });
  }
});

// ─── DELETE /capsule-links/:accessToken/connect_api ──────────────────────────

router.delete('/capsule-links/:accessToken/connect_api', async (req, res: Response) => {
  const { accessToken } = req.params;

  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const result = await pool.query(
      `UPDATE recipient_api_connections rc
       SET disconnected_at = NOW()
       FROM capsule_external_shares ces
       WHERE ces.access_token = $1
         AND ces.share_id = rc.share_id
         AND rc.disconnected_at IS NULL
       RETURNING rc.connection_id, rc.disconnected_at`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active connection found for this capsule' });
    }

    return res.json({
      connection_id: result.rows[0].connection_id,
      disconnected_at: result.rows[0].disconnected_at,
      status: 'disconnected',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to disconnect' });
  }
});

// ─── GET /:capsuleId/shares ───────────────────────────────────────────────────

router.get('/:capsuleId/shares', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { capsuleId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const pool = getPool();

    const capsuleCheck = await pool.query(
      `SELECT 1 FROM deal_capsules WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [capsuleId, userId]
    );
    if (capsuleCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT ces.share_id, ces.share_type, ces.recipient_email, ces.recipient_name,
              ces.created_at, ces.revoked_at, ces.expires_at,
              ces.preview_text, ces.preview_metadata,
              CASE WHEN ces.revoked_at IS NOT NULL THEN 'revoked'
                   WHEN ces.expires_at IS NOT NULL AND ces.expires_at < NOW() THEN 'expired'
                   ELSE 'active'
              END AS share_status
       FROM capsule_external_shares ces
       WHERE ces.capsule_id = $1
       ORDER BY ces.created_at DESC`,
      [capsuleId]
    );

    return res.json({ shares: result.rows, count: result.rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to list shares' });
  }
});

// ─── POST /:capsuleId/shares/:shareId/revoke ─────────────────────────────────

router.post('/:capsuleId/shares/:shareId/revoke', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { capsuleId, shareId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const pool = getPool();

    const result = await pool.query(
      `UPDATE capsule_external_shares
       SET revoked_at = NOW()
       WHERE share_id = $1 AND capsule_id = $2
         AND shared_by_user_id = $3
         AND revoked_at IS NULL
       RETURNING share_id, revoked_at`,
      [shareId, capsuleId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or already revoked' });
    }

    logger.info('Share revoked', { capsuleId, shareId });

    return res.json({
      share_id: result.rows[0].share_id,
      revoked_at: result.rows[0].revoked_at,
      status: 'revoked',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to revoke share' });
  }
});

export default router;
