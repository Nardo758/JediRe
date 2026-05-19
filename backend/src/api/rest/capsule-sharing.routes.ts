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
 *     GET    /capsule-links/:accessToken/deal-book
 *     GET    /capsule-links/:accessToken/overlay
 *     PATCH  /capsule-links/:accessToken/overlay
 *     DELETE /capsule-links/:accessToken/overlay
 *     POST   /capsule-links/:accessToken/connect_api
 *     POST   /capsule-links/:accessToken/query
 *     DELETE /capsule-links/:accessToken/connect_api
 *
 * @version 1.2.0
 * @date 2026-05-19
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { executeRecipientQuery } from '../../services/recipient-agent-executor.service';
import { encryptToken } from '../../services/encryption';
import { emailService } from '../../services/email.service';
import { NotificationService } from '../../services/NotificationService';
import { NotificationType } from '../../types/notification.types';
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

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateShortcode(): string {
  const bytes = crypto.randomBytes(6);
  let result = '';
  for (const byte of bytes) {
    result += BASE62[byte % 62];
  }
  return result.slice(0, 7);
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
    share_mode,
    label,
    allow_document_download,
    allow_agent_interaction,
    expires_at,
    preview_text,
    preview_metadata,
    show_attribution_override,
  } = body;

  const resolvedShareMode = (share_mode as string) === 'shareable_link' ? 'shareable_link' : 'specific_recipient';

  if (resolvedShareMode === 'specific_recipient' && !recipient_email) {
    res.status(400).json({ error: 'recipient_email is required for specific_recipient shares' }); return;
  }
  const shareType = (share_type as string) ?? 'external_view';
  if (!['external_view', 'external_agent_enabled'].includes(shareType)) {
    res.status(400).json({ error: 'share_type must be external_view or external_agent_enabled' }); return;
  }
  if (label && typeof label === 'string' && label.length > 200) {
    res.status(400).json({ error: 'label must not exceed 200 characters' }); return;
  }
  if (preview_text && typeof preview_text === 'string' && preview_text.length > 500) {
    res.status(400).json({ error: 'preview_text must not exceed 500 characters' }); return;
  }
  if (preview_metadata && (typeof preview_metadata !== 'object' || Array.isArray(preview_metadata))) {
    res.status(400).json({ error: 'preview_metadata must be a JSON object' }); return;
  }

  const pool = getPool();

  const capsuleCheck = await pool.query(
    `SELECT dc.id, dc.property_address, dc.asset_class, dc.status, dc.jedi_score, dc.collision_score,
            dc.deal_data, dc.platform_intel, dc.user_adjustments, dc.module_outputs, dc.created_at,
            COALESCE(
              NULLIF(u.full_name, ''),
              NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
              u.email
            ) AS sender_display_name,
            COALESCE(u.subscription_tier, 'free') AS subscription_tier
     FROM deal_capsules dc
     JOIN users u ON u.id = dc.user_id
     WHERE dc.id = $1 AND dc.user_id = $2 LIMIT 1`,
    [capsuleId, userId]
  );
  if (capsuleCheck.rows.length === 0) {
    res.status(403).json({ error: 'Capsule not found or access denied' }); return;
  }

  // Phase 1 live-data pivot: no frozen snapshot stored.
  // Recipients are served live data from deal_capsules on every request.
  const capsuleRow = capsuleCheck.rows[0];

  // Platform user detection — early return if recipient has a JediRe account.
  // Spec: send in-platform notification; do NOT create an external share/token.
  if (resolvedShareMode === 'specific_recipient' && recipient_email) {
    try {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [recipient_email as string]
      );
      if (userResult.rows.length > 0) {
        const recipientUserId = userResult.rows[0].id;
        const notifService = new NotificationService(pool);
        await notifService.createNotification({
          userId: recipientUserId,
          type: NotificationType.INFO_CAPSULE_SHARE_RECEIVED,
          title: 'Deal shared with you',
          message: `${capsuleRow.sender_display_name ?? 'A JediRe user'} shared "${capsuleRow.property_address ?? 'a deal'}" with you`,
          actionLabel: 'View in Pipeline',
          metadata: { capsuleId },
        });
        logger.info('Share routed in-platform via notification', { capsuleId, recipientUserId });
        res.status(200).json({ routed_to_platform: true }); return;
      }
    } catch (notifErr) {
      logger.warn('Failed to send in-platform share notification (non-fatal)', {
        error: (notifErr as Error).message,
      });
    }
  }

  // External recipient — generate token + shortcode and create the share record.
  const { token, hash } = generateAccessToken();
  let shortcode = generateShortcode();

  // Tier-gate: only enterprise can set show_attribution_override = false
  const senderTier: string = capsuleRow.subscription_tier ?? 'free';
  const canRemoveAttribution = ['enterprise'].includes(senderTier);
  let resolvedAttributionOverride: boolean | null = null;
  if (show_attribution_override !== undefined && show_attribution_override !== null) {
    if (canRemoveAttribution) {
      resolvedAttributionOverride = Boolean(show_attribution_override);
    }
    // Silently ignore false attribution override for lower tiers — do not 403 the share
  }

  const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;
  const baseUrl = process.env.PUBLIC_BASE_URL
    ?? process.env.FRONTEND_URL
    ?? process.env.PUBLIC_URL
    ?? (forwardedHost ? `https://${forwardedHost}` : null)
    ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    ?? `${req.protocol}://${req.get('host')}`;
  let capsuleUrl = `${baseUrl}/share/${shortcode}`;

  // Retry loop for shortcode uniqueness — max 3 attempts.
  // Collision probability is ~1 in 3.5T so retries will almost never fire.
  let shareRow: { share_id: string; created_at: string } | null = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const result = await pool.query(
        `INSERT INTO capsule_external_shares
           (capsule_id, shared_by_user_id, share_type, share_mode, label,
            recipient_email, recipient_name,
            allow_document_download, allow_agent_interaction, expires_at, access_token,
            preview_text, preview_metadata, capsule_snapshot, show_attribution_override,
            share_url, shortcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING share_id, created_at`,
        [
          capsuleId,
          userId,
          shareType,
          resolvedShareMode,
          label ? (label as string).trim().slice(0, 200) : null,
          recipient_email ?? null,
          recipient_name ?? null,
          allow_document_download !== false,
          allow_agent_interaction !== false,
          expires_at ?? null,
          hash,
          preview_text ?? null,
          preview_metadata ? JSON.stringify(preview_metadata) : null,
          null, // Phase 1: no frozen snapshot; live data served from deal_capsules
          resolvedAttributionOverride,
          capsuleUrl,
          shortcode,
        ]
      );
      shareRow = result.rows[0];
      break;
    } catch (insertErr: any) {
      const isShortcodeConflict =
        insertErr.code === '23505' &&
        String(insertErr.constraint ?? insertErr.detail ?? '').toLowerCase().includes('shortcode');
      if (attempt < 2 && isShortcodeConflict) {
        shortcode = generateShortcode();
        capsuleUrl = `${baseUrl}/share/${shortcode}`;
        continue;
      }
      throw insertErr;
    }
  }
  if (!shareRow) throw new Error('Failed to create share record after retries');
  const share = shareRow;

  // Fire share invitation email for specific-recipient shares.
  // Shareable links have no known recipient at creation time — no email sent.
  let emailQueued = false;
  if (resolvedShareMode === 'specific_recipient' && recipient_email) {
    try {
      const senderName = capsuleRow.sender_display_name as string ?? 'A JediRe user';
      emailQueued = await emailService.sendShareInvitation({
        to: recipient_email as string,
        senderName,
        dealName: capsuleRow.property_address ?? 'a deal',
        previewPitch: preview_text as string | null ?? null,
        capsuleUrl,
        expiresAt: expires_at as string | null ?? null,
        accessType: shareType,
      });
    } catch (emailErr) {
      logger.warn('Share invitation email failed (non-fatal)', {
        capsuleId, shareId: share.share_id, error: (emailErr as Error).message,
      });
    }
  }

  logger.info('External share created', {
    capsuleId, shareId: share.share_id,
    recipientEmail: recipient_email, shareType, shareMode: resolvedShareMode,
    hasPreview: !!preview_text, emailQueued,
  });

  res.status(201).json({
    share_id: share.share_id,
    capsule_url: capsuleUrl,
    share_url: capsuleUrl,
    shortcode,
    access_token: token,
    share_mode: resolvedShareMode,
    label: label ? (label as string).trim().slice(0, 200) : null,
    recipient_email: recipient_email ?? null,
    share_type: shareType,
    expires_at: expires_at ?? null,
    preview_text: preview_text ?? null,
    preview_metadata: preview_metadata ?? null,
    created_at: share.created_at,
    email_queued: emailQueued,
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

// ─── GET /shares/:shortcode — shortcode resolution + deal-book ───────────────
// Resolves a 7-char shortcode to the deal-book payload.
// The shortcode is the credential; no raw access token is returned.
// Recipients use the shortcode for all overlay operations via PATCH/DELETE below.

const shortcodeRateLimitStore = new Map<string, number[]>();

router.get('/shares/:shortcode', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  try {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const rateKey = `share_resolve:${clientIp}`;
    const now = Date.now();
    const hits = (shortcodeRateLimitStore.get(rateKey) ?? []).filter(t => now - t < 3_600_000);
    if (hits.length >= 60) {
      return res.status(429).json({ error: 'Too many requests. Please wait before refreshing.' });
    }
    hits.push(now);
    shortcodeRateLimitStore.set(rateKey, hits);

    const pool = getPool();

    const shareResult = await pool.query(
      `SELECT ces.share_id, ces.capsule_id, ces.share_type, ces.access_token,
              ces.allow_document_download, ces.allow_agent_interaction,
              ces.expires_at, ces.recipient_email, ces.preview_text, ces.preview_metadata,
              ces.capsule_snapshot, ces.show_attribution_override,
              COALESCE(
                NULLIF(u.full_name, ''),
                NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
                u.email
              ) AS sender_display_name,
              COALESCE(rso.overlay_data, '{}'::jsonb) AS overlay_data
       FROM capsule_external_shares ces
       LEFT JOIN deal_capsules dc ON dc.id = ces.capsule_id
       LEFT JOIN users u ON u.id = dc.user_id
       LEFT JOIN recipient_session_overlays rso ON rso.access_token_hash = ces.access_token
       WHERE ces.shortcode = $1
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       LIMIT 1`,
      [shortcode]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share link is invalid, expired, or has been revoked.' });
    }

    const share = shareResult.rows[0];

    // Phase 1 live-data pivot: always read from deal_capsules (never frozen snapshot).
    const capsuleResult = await pool.query(
      `SELECT id, property_address, asset_class, status,
              jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs,
              created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [share.capsule_id]
    );
    if (capsuleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal content not found.' });
    }
    const capsuleData: Record<string, unknown> = capsuleResult.rows[0];

    const senderBrandingResult = await pool.query(
      `SELECT COALESCE(u.subscription_tier, 'free') AS tier,
              ubs.company_name, ubs.logo_url,
              COALESCE(ubs.show_attribution, true) AS show_attribution
       FROM deal_capsules dc
       JOIN users u ON u.id = dc.user_id
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = dc.user_id
       WHERE dc.id = $1`,
      [share.capsule_id]
    );

    const senderBranding = senderBrandingResult.rows[0] ?? null;
    const senderTier: string = senderBranding?.tier ?? 'free';
    const attributionEligible = ['enterprise'].includes(senderTier);

    let attributionVisible: boolean;
    if (!attributionEligible) {
      attributionVisible = true;
    } else if (share.show_attribution_override !== null && share.show_attribution_override !== undefined) {
      attributionVisible = Boolean(share.show_attribution_override);
    } else {
      attributionVisible = senderBranding?.show_attribution !== false;
    }

    logger.info('Deal book served via shortcode', {
      capsuleId: share.capsule_id,
      shortcode,
      shareType: share.share_type,
    });

    return res.json({
      shortcode,
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
        id: share.capsule_id,
        property_address: capsuleData.property_address,
        asset_class: capsuleData.asset_class,
        status: capsuleData.status,
        jedi_score: capsuleData.jedi_score ?? null,
        collision_score: capsuleData.collision_score ?? null,
        deal_data: (capsuleData.deal_data as Record<string, unknown>) ?? {},
        platform_intel: (capsuleData.platform_intel as Record<string, unknown>) ?? {},
        user_adjustments: (capsuleData.user_adjustments as Record<string, unknown>) ?? {},
        module_outputs: (capsuleData.module_outputs as Record<string, unknown>) ?? {},
        snapshot_taken_at: (capsuleData.snapshot_taken_at as string) ?? null,
        created_at: capsuleData.created_at,
      },
      overlay: (share.overlay_data as Record<string, unknown>) ?? {},
      attribution_visible: attributionVisible,
      sender_display_name: share.sender_display_name ?? null,
      sender_branding: {
        company_name: senderBranding?.company_name ?? null,
        logo_url: senderBranding?.logo_url ?? null,
      },
    });
  } catch (err: any) {
    logger.error('Failed to serve deal book via shortcode', { error: err?.message });
    return res.status(500).json({ error: 'Failed to load share.' });
  }
});

// ─── PATCH /shares/:shortcode/overlay ────────────────────────────────────────

router.patch('/shares/:shortcode/overlay', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  const patch = req.body;

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(400).json({ error: 'Request body must be a flat key-value object' });
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Patch object must contain at least one key' });
  }

  try {
    const pool = getPool();
    const shareResult = await pool.query(
      `SELECT share_id, access_token FROM capsule_external_shares
       WHERE shortcode = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [shortcode]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or expired' });
    }
    const { share_id: shareId, access_token: tokenHash } = shareResult.rows[0];

    const result = await pool.query(
      `INSERT INTO recipient_session_overlays (access_token_hash, share_id, overlay_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (access_token_hash) DO UPDATE
         SET overlay_data = recipient_session_overlays.overlay_data || $3::jsonb,
             updated_at   = NOW()
       RETURNING overlay_data`,
      [tokenHash, shareId, JSON.stringify(patch)]
    );
    return res.json({ overlay_data: result.rows[0].overlay_data });
  } catch (err: any) {
    logger.error('Failed to patch overlay via shortcode', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to update overlay' });
  }
});

// ─── DELETE /shares/:shortcode/overlay ───────────────────────────────────────

router.delete('/shares/:shortcode/overlay', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  const { path } = req.query as { path?: string };

  try {
    const pool = getPool();
    const shareResult = await pool.query(
      `SELECT access_token FROM capsule_external_shares
       WHERE shortcode = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [shortcode]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found or expired' });
    }
    const tokenHash = shareResult.rows[0].access_token;

    let updatedOverlay: Record<string, unknown> = {};
    if (path) {
      const result = await pool.query(
        `UPDATE recipient_session_overlays
         SET overlay_data = overlay_data - $2, updated_at = NOW()
         WHERE access_token_hash = $1
         RETURNING overlay_data`,
        [tokenHash, path]
      );
      updatedOverlay = result.rows[0]?.overlay_data ?? {};
    } else {
      await pool.query(
        `UPDATE recipient_session_overlays
         SET overlay_data = '{}', updated_at = NOW()
         WHERE access_token_hash = $1`,
        [tokenHash]
      );
    }
    return res.json({ overlay_data: updatedOverlay });
  } catch (err: any) {
    logger.error('Failed to reset overlay via shortcode', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to reset overlay' });
  }
});

// Shared rate-limit store for both /deals/:dealId/deal-book and /capsule-links/:token/deal-book
const dealBookRateLimitStore = new Map<string, number[]>();

// ─── GET /deals/:dealId/deal-book ────────────────────────────────────────────
// Spec Step 1: token-authenticated deal-book endpoint keyed by capsule_id.
// Authenticates via Authorization: Bearer <token> or ?token= query param.
// :dealId is treated as the capsule UUID (deal_capsules has no deal_id column).
// Rate limit: 30 per hour per IP (matches /capsule-links/:token/deal-book).

router.get('/deals/:dealId/deal-book', async (req: Request, res: Response) => {
  const { dealId: capsuleId } = req.params;
  const raw = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : (req.query.token as string | undefined);
  if (!raw) return res.status(401).json({ error: 'Access token required' });

  const pool = getPool();
  try {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const rateKey = `deal_book:${clientIp}`;
    const now = Date.now();
    const hits = (dealBookRateLimitStore.get(rateKey) ?? []).filter(t => now - t < 3_600_000);
    if (hits.length >= 30) return res.status(429).json({ error: 'Rate limit exceeded — try again later' });
    hits.push(now);
    dealBookRateLimitStore.set(rateKey, hits);

    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const shareResult = await pool.query(
      `SELECT ces.share_id, ces.capsule_id, ces.share_type,
              ces.allow_document_download, ces.allow_agent_interaction,
              ces.expires_at, ces.revoked_at, ces.recipient_email,
              ces.preview_text, ces.show_attribution_override,
              COALESCE(rso.overlay_data, '{}'::jsonb) AS overlay_data
       FROM capsule_external_shares ces
       LEFT JOIN recipient_session_overlays rso ON rso.access_token_hash = ces.access_token
       WHERE ces.access_token = $1
         AND ces.capsule_id = $2
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       LIMIT 1`,
      [tokenHash, capsuleId]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal link is invalid, expired, or has been revoked.' });
    }
    const share = shareResult.rows[0];

    const capsuleResult = await pool.query(
      `SELECT id, property_address, asset_class, status,
              jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs, created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [share.capsule_id]
    );
    if (capsuleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal content not found.' });
    }
    const capsule = capsuleResult.rows[0];

    const brandingResult = await pool.query(
      `SELECT COALESCE(u.subscription_tier,'free') AS tier,
              COALESCE(
                NULLIF(u.full_name,''),
                NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
                u.email
              ) AS sender_display_name,
              ubs.company_name, ubs.logo_url,
              COALESCE(ubs.show_attribution, true) AS show_attribution
       FROM deal_capsules dc
       JOIN users u ON u.id = dc.user_id
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = dc.user_id
       WHERE dc.id = $1`,
      [share.capsule_id]
    );
    const branding = brandingResult.rows[0] ?? null;

    // Extract deal_assumptions and year1 from embedded capsule data
    const dealData    = (capsule.deal_data   ?? {}) as Record<string, unknown>;
    const modOutputs  = (capsule.module_outputs ?? {}) as Record<string, unknown>;
    const dealAssumptions = (dealData.assumptions as Record<string, unknown> | undefined) ?? {};
    const year1 =
      (modOutputs.year1 as Record<string, unknown> | undefined) ??
      ((modOutputs.cashflow as Record<string, unknown> | undefined)?.year1 as Record<string, unknown> | undefined) ??
      null;

    return res.json({
      capsule_id: capsule.id,
      property_address: capsule.property_address,
      asset_class: capsule.asset_class,
      status: capsule.status,
      jedi_score: capsule.jedi_score,
      collision_score: capsule.collision_score,
      deal_data: dealData,
      deal_assumptions: dealAssumptions,
      year1,
      platform_intel: capsule.platform_intel ?? {},
      user_adjustments: capsule.user_adjustments ?? {},
      module_outputs: modOutputs,
      created_at: capsule.created_at,
      overlay_data: share.overlay_data ?? {},
      share_permissions: {
        share_type: share.share_type,
        allow_agent_interaction: share.allow_agent_interaction,
        allow_document_download: share.allow_document_download,
        expires_at: share.expires_at ?? null,
        preview_text: share.preview_text ?? null,
        recipient_email: share.recipient_email ?? null,
      },
      sender_display_name: branding?.sender_display_name ?? null,
      show_attribution: (() => {
        const tier: string = branding?.tier ?? 'free';
        const eligible = ['enterprise'].includes(tier);
        if (!eligible) return true;
        if (share.show_attribution_override !== null && share.show_attribution_override !== undefined)
          return Boolean(share.show_attribution_override);
        return branding?.show_attribution !== false;
      })(),
    });
  } catch (err: any) {
    logger.error('Failed to serve /deals/:dealId/deal-book', { error: err?.message, capsuleId });
    return res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

// ─── GET /capsule-links/:accessToken/deal-book ───────────────────────────────
// Returns the full capsule content for external display.
// Rate limit: 30 per hour per IP (less aggressive than token resolution).
// Public — no platform auth required; share token is the credential.

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
              ces.preview_text, ces.preview_metadata,
              ces.capsule_snapshot,
              ces.show_attribution_override,
              COALESCE(rso.overlay_data, '{}'::jsonb) AS overlay_data
       FROM capsule_external_shares ces
       LEFT JOIN recipient_session_overlays rso ON rso.access_token_hash = ces.access_token
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

    // Phase 1 live-data pivot: always read from deal_capsules (never frozen snapshot).
    const capsuleTokenResult = await pool.query(
      `SELECT id, property_address, asset_class, status,
              jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs,
              created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [share.capsule_id]
    );
    if (capsuleTokenResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule content not found.' });
    }
    const capsuleData: Record<string, unknown> = capsuleTokenResult.rows[0];

    // Resolve sender branding + tier for attribution decision
    const senderBrandingResult = await pool.query(
      `SELECT COALESCE(u.subscription_tier, 'free') AS tier,
              ubs.company_name,
              ubs.logo_url,
              COALESCE(ubs.show_attribution, true) AS show_attribution
       FROM deal_capsules dc
       JOIN users u ON u.id = dc.user_id
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = dc.user_id
       WHERE dc.id = $1`,
      [share.capsule_id]
    );

    const senderBranding = senderBrandingResult.rows[0] ?? null;
    const senderTier: string = senderBranding?.tier ?? 'free';
    const attributionEligible = ['enterprise'].includes(senderTier);

    // Attribution resolution order (strict tier-first):
    // 1. Non-eligible tier → always show, ignore any stored override
    // 2. Eligible + per-share override set → use override
    // 3. Eligible + no override → fall back to account-level setting (default: true)
    let attributionVisible: boolean;
    if (!attributionEligible) {
      attributionVisible = true;
    } else if (share.show_attribution_override !== null && share.show_attribution_override !== undefined) {
      attributionVisible = Boolean(share.show_attribution_override);
    } else {
      attributionVisible = senderBranding?.show_attribution !== false;
    }

    logger.info('Deal book served', {
      capsuleId: share.capsule_id,
      shareId: share.share_id,
      shareType: share.share_type,
      attributionVisible,
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
        id: share.capsule_id,
        property_address: capsuleData.property_address,
        asset_class: capsuleData.asset_class,
        status: capsuleData.status,
        jedi_score: capsuleData.jedi_score ?? null,
        collision_score: capsuleData.collision_score ?? null,
        deal_data: (capsuleData.deal_data as Record<string, unknown>) ?? {},
        platform_intel: (capsuleData.platform_intel as Record<string, unknown>) ?? {},
        user_adjustments: (capsuleData.user_adjustments as Record<string, unknown>) ?? {},
        module_outputs: (capsuleData.module_outputs as Record<string, unknown>) ?? {},
        snapshot_taken_at: (capsuleData.snapshot_taken_at as string) ?? null,
        created_at: capsuleData.created_at,
      },
      // Recipient's session-scoped overlay (empty object if no modifications yet)
      overlay: (share.overlay_data as Record<string, unknown>) ?? {},
      // Attribution + sender branding for recipient-facing header/footer
      attribution_visible: attributionVisible,
      sender_branding: {
        company_name: senderBranding?.company_name ?? null,
        logo_url: senderBranding?.logo_url ?? null,
      },
    });
  } catch (err: any) {
    logger.error('Failed to serve deal book', { error: err?.message });
    return res.status(500).json({ error: 'Failed to load deal book.' });
  }
});

// ─── GET /capsule-links/:accessToken/overlay ─────────────────────────────────
// Returns the recipient's current session overlay (or {} if none yet).

router.get('/capsule-links/:accessToken/overlay', async (req: Request, res: Response) => {
  const { accessToken } = req.params;
  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareCheck = await pool.query(
      `SELECT 1 FROM capsule_external_shares
       WHERE access_token = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [tokenHash]
    );
    if (shareCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found or expired' });
    }

    const overlayResult = await pool.query(
      `SELECT overlay_data FROM recipient_session_overlays WHERE access_token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    return res.json({ overlay_data: overlayResult.rows[0]?.overlay_data ?? {} });
  } catch (err: any) {
    logger.error('Failed to get overlay', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to get overlay' });
  }
});

// ─── PATCH /capsule-links/:accessToken/overlay ────────────────────────────────
// Merges a flat-key patch object into the recipient's overlay.
// e.g. { "user_adjustments.preferred_hold_period": 7, "deal_data.exit_cap_assumption": 5.5 }
// Returns the full updated overlay_data.

router.patch('/capsule-links/:accessToken/overlay', async (req: Request, res: Response) => {
  const { accessToken } = req.params;
  const patch = req.body;

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(400).json({ error: 'Request body must be a flat key-value object' });
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Patch object must contain at least one key' });
  }

  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareCheck = await pool.query(
      `SELECT share_id FROM capsule_external_shares
       WHERE access_token = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [tokenHash]
    );
    if (shareCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found or expired' });
    }
    const shareId = shareCheck.rows[0].share_id;

    // Upsert: create overlay row if absent; merge patch into existing data on conflict
    const result = await pool.query(
      `INSERT INTO recipient_session_overlays (access_token_hash, share_id, overlay_data)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (access_token_hash) DO UPDATE
         SET overlay_data = recipient_session_overlays.overlay_data || $3::jsonb,
             updated_at   = NOW()
       RETURNING overlay_data`,
      [tokenHash, shareId, JSON.stringify(patch)]
    );
    return res.json({ overlay_data: result.rows[0].overlay_data });
  } catch (err: any) {
    logger.error('Failed to patch overlay', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to update overlay' });
  }
});

// ─── DELETE /capsule-links/:accessToken/overlay ───────────────────────────────
// ?path=user_adjustments.target_irr  → removes a single key
// (no path param)                    → clears the entire overlay

router.delete('/capsule-links/:accessToken/overlay', async (req: Request, res: Response) => {
  const { accessToken } = req.params;
  const { path } = req.query as { path?: string };

  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareCheck = await pool.query(
      `SELECT 1 FROM capsule_external_shares
       WHERE access_token = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [tokenHash]
    );
    if (shareCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found or expired' });
    }

    let updatedOverlay: Record<string, unknown> = {};
    if (path) {
      const result = await pool.query(
        `UPDATE recipient_session_overlays
         SET overlay_data = overlay_data - $2, updated_at = NOW()
         WHERE access_token_hash = $1
         RETURNING overlay_data`,
        [tokenHash, path]
      );
      updatedOverlay = result.rows[0]?.overlay_data ?? {};
    } else {
      await pool.query(
        `UPDATE recipient_session_overlays
         SET overlay_data = '{}', updated_at = NOW()
         WHERE access_token_hash = $1`,
        [tokenHash]
      );
      updatedOverlay = {};
    }
    return res.json({ overlay_data: updatedOverlay });
  } catch (err: any) {
    logger.error('Failed to reset overlay', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to reset overlay' });
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
      `SELECT ces.share_id, ces.share_type, ces.share_mode, ces.label,
              ces.recipient_email, ces.recipient_name,
              ces.created_at, ces.revoked_at, ces.expires_at,
              ces.preview_text, ces.preview_metadata,
              ces.share_url,
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

// ─── GET /:capsuleId/resolve-deal — Task B redirect helper ───────────────────
// Resolves a capsule_id to its linked deal_id. Used by CapsuleRedirectPage to
// redirect old /capsules/:id bookmarks to /deals/:dealId/detail?tab=shares.
// Requires auth (inline requireAuth — this router is mounted both publicly and
// at /capsules-ext with requireAuth, so the inline guard covers both cases).

router.get('/:capsuleId/resolve-deal', requireAuth, async (req: Request, res: Response) => {
  const { capsuleId } = req.params;
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();
    const result = await pool.query<{ deal_id: string }>(
      `SELECT deal_data->>'deal_id' AS deal_id
       FROM deal_capsules
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [capsuleId, userId],
    );

    if (result.rows.length === 0 || !result.rows[0].deal_id) {
      return res.status(404).json({ error: 'Capsule not found or no associated deal' });
    }

    return res.json({ deal_id: result.rows[0].deal_id });
  } catch (err: any) {
    logger.error('Failed to resolve capsule to deal', { error: err?.message, capsuleId });
    return res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

export default router;
