/**
 * Capsule Sharing Routes — Piece 4 Foundation
 *
 * External share creation, access token resolution, and API key connection.
 *
 * @version 1.0.0
 * @date 2026-05-19
 */

import { Router, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { executeRecipientQuery } from '../../services/recipient-agent-executor.service';
import * as crypto from 'crypto';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random access token.
 * Returns the raw token (for the URL) and a SHA-256 hash (for DB storage).
 */
function generateAccessToken(): { token: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { token: raw, hash };
}

// ─── POST /api/v1/deals/:dealId/share/external ───────────────────────────────

/**
 * Create an external share (capsule) for a non-platform recipient.
 */
router.post('/:dealId/share/external', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const {
      recipient_email,
      recipient_name,
      share_type,
      allow_document_download,
      allow_agent_interaction,
      expires_at,
    } = req.body;

    // Validate required fields
    if (!recipient_email) {
      return res.status(400).json({ error: 'recipient_email is required' });
    }

    const shareType = share_type ?? 'external_view';
    if (!['external_view', 'external_agent_enabled'].includes(shareType)) {
      return res.status(400).json({ error: 'share_type must be external_view or external_agent_enabled' });
    }

    const pool = getPool();

    // Verify deal ownership
    const dealCheck = await pool.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dealId, userId]
    );
    if (dealCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Deal not found or access denied' });
    }

    // Generate access token
    const { token, hash } = generateAccessToken();

    // Create share
    const shareResult = await pool.query(
      `INSERT INTO capsule_shares
         (deal_id, shared_by_user_id, share_type, recipient_email, recipient_name,
          allow_document_download, allow_agent_interaction, expires_at, access_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING share_id, created_at`,
      [
        dealId,
        userId,
        shareType,
        recipient_email,
        recipient_name ?? null,
        allow_document_download !== false, // default true
        allow_agent_interaction !== false, // default true
        expires_at ?? null,
        hash,
      ]
    );

    const share = shareResult.rows[0];

    // Return capsule URL with raw token (not hash)
    const baseUrl = process.env.PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`;
    const capsuleUrl = `${baseUrl}/capsules/${token}`;

    logger.info('External share created', {
      dealId,
      shareId: share.share_id,
      recipientEmail: recipient_email,
      shareType,
    });

    return res.status(201).json({
      share_id: share.share_id,
      capsule_url: capsuleUrl,
      access_token: token, // raw token for sender to share with recipient
      recipient_email,
      share_type: shareType,
      expires_at: expires_at ?? null,
      created_at: share.created_at,
    });
  } catch (err: any) {
    logger.error('Failed to create external share', { error: err?.message, dealId });
    return res.status(500).json({ error: err?.message ?? 'Failed to create share' });
  }
});

// ─── GET /api/v1/capsules/:accessToken ────────────────────────────────────────

/**
 * Resolve a capsule share by access token.
 * Returns deal metadata respecting share settings.
 */
router.get('/capsules/:accessToken', async (req, res: Response) => {
  const { accessToken } = req.params;

  try {
    const pool = getPool();

    // Hash the provided token to look up in DB
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareResult = await pool.query(
      `SELECT cs.share_id, cs.deal_id, cs.share_type, cs.allow_document_download,
              cs.allow_agent_interaction, cs.expires_at, cs.revoked_at,
              d.name AS deal_name, d.deal_data->>'property_city' AS city,
              d.deal_data->>'property_state' AS state,
              d.deal_data->>'property_type' AS property_type,
              d.deal_data->>'total_units' AS total_units
       FROM capsule_shares cs
       JOIN deals d ON d.id = cs.deal_id
       WHERE cs.access_token = $1
         AND cs.revoked_at IS NULL
         AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       LIMIT 1`,
      [tokenHash]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found or has been revoked/expired' });
    }

    const share = shareResult.rows[0];
    const dealData = share.deal_data ?? {};

    return res.json({
      share_id: share.share_id,
      deal_id: share.deal_id,
      deal_name: share.deal_name,
      deal_summary: {
        city: share.city ?? dealData?.property_city ?? null,
        state: share.state ?? dealData?.property_state ?? null,
        property_type: share.property_type ?? dealData?.property_type ?? null,
        total_units: share.total_units ?? dealData?.total_units ?? null,
      },
      share_type: share.share_type,
      allow_document_download: share.allow_document_download,
      allow_agent_interaction: share.allow_agent_interaction,
      expires_at: share.expires_at,
      agent_enabled: share.share_type === 'external_agent_enabled',
      // Agent runtime is now wired
      agent_status: share.share_type === 'external_agent_enabled'
        ? { available: true, message: 'Agent interaction available. Connect an API key via POST /capsules/:accessToken/connect_api, then query via POST /capsules/:accessToken/query' }
        : { available: false, message: 'Agent interaction not enabled for this share' },
    });
  } catch (err: any) {
    logger.error('Failed to resolve capsule', { error: err?.message });
    return res.status(500).json({ error: 'Failed to resolve capsule' });
  }
});

// ─── POST /api/v1/capsules/:accessToken/connect_api ──────────────────────────

/**
 * Connect an API key to a capsule share (stub for Piece 4).
 */
router.post('/capsules/:accessToken/connect_api', async (req, res: Response) => {
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
      `SELECT share_id, share_type FROM capsule_shares
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

    // Validate the API key against the provider before storing
    try {
      if (provider === 'anthropic') {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const testClient = new Anthropic({ apiKey: api_key });
        // Ping the API with a minimal request to validate the key
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

    // Store the encrypted key (base64-encoded AES-GCM or simple base64 for now)
    const encryptedKey = Buffer.from(api_key).toString('base64');

    const connectionResult = await pool.query(
      `INSERT INTO recipient_api_connections
         (share_id, provider, api_key_encrypted, stripe_customer_id)
       VALUES ($1, $2, $3, NULL)
       RETURNING connection_id, connected_at`,
      [share.share_id, provider, `encrypted:${encryptedKey}`]
    );

    const connection = connectionResult.rows[0];

    logger.info('API key connected to capsule', {
      shareId: share.share_id,
      connectionId: connection.connection_id,
      provider,
    });

    return res.status(201).json({
      connection_id: connection.connection_id,
      provider,
      connected_at: connection.connected_at,
      status: 'connected',
      note: 'API key validated and stored. You can now query the agent via POST /capsules/:accessToken/query',
    });
  } catch (err: any) {
    logger.error('Failed to connect API key', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to connect API key' });
  }
});

// ─── POST /api/v1/capsules/:accessToken/query ───────────────────────────────

/**
 * Send a query through the recipient-scoped agent runtime.
 * Requires a connected API key (POST /capsules/:accessToken/connect_api).
 */
router.post('/capsules/:accessToken/query', async (req, res: Response) => {
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

// ─── DELETE /api/v1/capsules/:accessToken/connect_api ────────────────────────

/**
 * Disconnect an API key from a capsule share.
 */
router.delete('/capsules/:accessToken/connect_api', async (req, res: Response) => {
  const { accessToken } = req.params;

  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const result = await pool.query(
      `UPDATE recipient_api_connections rc
       SET disconnected_at = NOW()
       FROM capsule_shares cs
       WHERE cs.access_token = $1
         AND cs.share_id = rc.share_id
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

// ─── Share listing for sender ─────────────────────────────────────────────────

/**
 * GET /api/v1/deals/:dealId/shares
 *
 * Lists all shares for a deal (deal owner only).
 */
router.get('/:dealId/shares', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const pool = getPool();

    // Verify ownership
    const dealCheck = await pool.query(
      `SELECT 1 FROM deals WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dealId, userId]
    );
    if (dealCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT cs.share_id, cs.share_type, cs.recipient_email, cs.recipient_name,
              cs.created_at, cs.revoked_at, cs.expires_at,
              CASE WHEN cs.revoked_at IS NOT NULL THEN 'revoked'
                   WHEN cs.expires_at IS NOT NULL AND cs.expires_at < NOW() THEN 'expired'
                   ELSE 'active'
              END AS share_status
       FROM capsule_shares cs
       WHERE cs.deal_id = $1
       ORDER BY cs.created_at DESC`,
      [dealId]
    );

    return res.json({ shares: result.rows, count: result.rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Failed to list shares' });
  }
});

// ─── Revoke share ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/deals/:dealId/shares/:shareId/revoke
 *
 * Revokes a share. Subsequent access returns 404.
 */
router.post('/:dealId/shares/:shareId/revoke', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId, shareId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  try {
    const pool = getPool();

    const result = await pool.query(
      `UPDATE capsule_shares
       SET revoked_at = NOW()
       WHERE share_id = $1 AND deal_id = $2
         AND shared_by_user_id = $3
         AND revoked_at IS NULL
       RETURNING share_id, revoked_at`,
      [shareId, dealId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or already revoked' });
    }

    logger.info('Share revoked', { dealId, shareId });

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
