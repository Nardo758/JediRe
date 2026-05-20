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
import { executeRecipientQuery, executeRecipientQueryByShortcode } from '../../services/recipient-agent-executor.service';
import { encryptToken } from '../../services/encryption';
import { emailService } from '../../services/email.service';
import { NotificationService } from '../../services/NotificationService';
import { NotificationType } from '../../types/notification.types';
import * as crypto from 'crypto';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

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

// ─── GET /shares/:shortcode/export/excel — shortcode XLSX export ─────────────
// allow_document_download must be true; no platform auth required.

router.get('/shares/:shortcode/export/excel', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  try {
    const pool = getPool();
    const shareResult = await pool.query(
      `SELECT ces.capsule_id, ces.allow_document_download
       FROM capsule_external_shares ces
       WHERE ces.shortcode = $1 AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW()) LIMIT 1`,
      [shortcode]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share link is invalid, expired, or has been revoked.' });
    }
    if (!shareResult.rows[0].allow_document_download) {
      return res.status(403).json({ error: 'Document download is not permitted for this share.' });
    }
    const capsuleId = shareResult.rows[0].capsule_id;
    const result = await pool.query(
      `SELECT property_address, asset_class, jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs, created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [capsuleId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Capsule not found.' });
    const wb = buildCapsuleWorkbook(result.rows[0]);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true });
    const safeName = (result.rows[0].property_address ?? capsuleId)
      .replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_capsule.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.send(buf);
  } catch (err: any) {
    logger.error('Shortcode Excel export failed', { error: err?.message, shortcode });
    if (!res.headersSent) return res.status(500).json({ error: err?.message ?? 'Export failed' });
  }
});

// ─── GET /shares/:shortcode/export/pdf — shortcode PDF export ────────────────

router.get('/shares/:shortcode/export/pdf', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  try {
    const pool = getPool();
    const shareResult = await pool.query(
      `SELECT ces.capsule_id, ces.allow_document_download,
              ubs.company_name, ubs.logo_url
       FROM capsule_external_shares ces
       JOIN deal_capsules dc ON dc.id = ces.capsule_id
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = dc.user_id
       WHERE ces.shortcode = $1 AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW()) LIMIT 1`,
      [shortcode]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share link is invalid, expired, or has been revoked.' });
    }
    if (!shareResult.rows[0].allow_document_download) {
      return res.status(403).json({ error: 'Document download is not permitted for this share.' });
    }
    const { capsule_id: capsuleId, company_name, logo_url } = shareResult.rows[0];
    const result = await pool.query(
      `SELECT property_address, asset_class, jedi_score, collision_score,
              deal_data, platform_intel, created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [capsuleId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Capsule not found.' });

    const capsule = result.rows[0];
    const dd = flattenLV((capsule.deal_data as Record<string, unknown>) ?? {});
    const pi = flattenLV((capsule.platform_intel as Record<string, unknown>) ?? {});
    const companyName: string = company_name ?? 'JEDI RE';
    const address: string = capsule.property_address ?? 'Undisclosed Address';
    const assetClass: string = capsule.asset_class ?? '';
    const logoBuffer = logo_url ? await safeFetchLogoBuffer(String(logo_url)) : null;

    const fmtM = (v: unknown): string => {
      const n = parseFloat(String(v ?? ''));
      if (isNaN(n)) return '—';
      if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
      if (Math.abs(n) >= 1_000) return `$${n.toLocaleString()}`;
      return `$${n}`;
    };
    const fmtP = (v: unknown): string => {
      const n = parseFloat(String(v ?? ''));
      if (isNaN(n)) return '—';
      return `${(n > 1 ? n : n * 100).toFixed(2)}%`;
    };

    const safeName = address.replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_capsule.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: address, Author: companyName } });
    doc.pipe(res);

    const W = 595.28, H = 841.89;
    const NAVY_SC = '#0D1B2A', AMBER_SC = '#F0B429', SLATE_SC = '#1A2A3E';
    const WHITE_SC = '#FFFFFF', LIGHT_SC = '#E8ECF1', MID_SC = '#8B9CB0';

    // ── Cover page ──
    doc.rect(0, 0, W, H).fill(NAVY_SC);
    doc.rect(0, 0, W, 8).fill(AMBER_SC);

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 50, { fit: [120, 40], align: 'left' });
        doc.fillColor(MID_SC).font('Helvetica').fontSize(9).text('DEAL CAPSULE — CONFIDENTIAL', 50, 96);
      } catch {
        doc.fillColor(AMBER_SC).font('Helvetica-Bold').fontSize(14).text(companyName.toUpperCase(), 50, 60, { width: W - 100 });
        doc.fillColor(MID_SC).font('Helvetica').fontSize(9).text('DEAL CAPSULE — CONFIDENTIAL', 50, 80);
      }
    } else {
      doc.fillColor(AMBER_SC).font('Helvetica-Bold').fontSize(14).text(companyName.toUpperCase(), 50, 60, { width: W - 100 });
      doc.fillColor(MID_SC).font('Helvetica').fontSize(9).text('DEAL CAPSULE — CONFIDENTIAL', 50, 80);
    }

    doc.rect(50, 140, W - 100, 2).fill(AMBER_SC);
    doc.fillColor(WHITE_SC).font('Helvetica-Bold').fontSize(26).text(address, 50, 160, { width: W - 100, lineGap: 4 });
    if (assetClass) doc.fillColor(AMBER_SC).font('Helvetica-Bold').fontSize(11).text(assetClass.toUpperCase(), 50, doc.y + 10);

    if (capsule.jedi_score != null) {
      doc.rect(50, 300, 120, 80).fill(SLATE_SC);
      doc.fillColor(AMBER_SC).font('Helvetica-Bold').fontSize(36).text(String(capsule.jedi_score), 50, 312, { width: 120, align: 'center' });
      doc.fillColor(MID_SC).font('Helvetica').fontSize(8).text('JEDI SCORE', 50, 352, { width: 120, align: 'center' });
    }
    doc.fillColor(MID_SC).font('Helvetica').fontSize(8)
      .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, H - 80, { width: W - 100 });

    // ── Metrics page ──
    doc.addPage();
    doc.rect(0, 0, W, H).fill(WHITE_SC);
    doc.rect(0, 0, W, 8).fill(AMBER_SC);
    doc.rect(0, 8, W, 50).fill(NAVY_SC);
    doc.fillColor(AMBER_SC).font('Helvetica-Bold').fontSize(13).text('KEY METRICS', 50, 22);
    doc.fillColor(LIGHT_SC).font('Helvetica').fontSize(9).text(address, 50, 40);

    const metricsList2: [string, string][] = [
      ['Purchase Price / Asking Price', fmtM(dd.purchase_price ?? dd.asking_price ?? dd.purchasePrice)],
      ['Annual NOI', fmtM(dd.noi ?? dd.annual_noi)],
      ['Going-In Cap Rate', fmtP(dd.cap_rate ?? dd.going_in_cap_rate)],
      ['Exit Cap Rate', fmtP(dd.exit_cap_rate ?? dd.exitCapRate)],
      ['Hold Period', dd.hold_period ?? dd.holdPeriod ? `${dd.hold_period ?? dd.holdPeriod} years` : '—'],
      ['LTV', fmtP(dd.ltv ?? dd.loan_to_value)],
      ['Total Units', String(dd.total_units ?? dd.totalUnits ?? '—')],
      ['Asset Class', assetClass || '—'],
    ];

    let my3 = 80;
    metricsList2.forEach(([label, value], i) => {
      const rowBg = i % 2 === 0 ? '#F8F9FA' : WHITE_SC;
      doc.rect(50, my3, W - 100, 28).fill(rowBg);
      doc.fillColor('#333333').font('Helvetica').fontSize(10).text(label, 60, my3 + 8, { width: 220 });
      doc.fillColor(NAVY_SC).font('Helvetica-Bold').fontSize(10).text(value, 300, my3 + 8, { width: 200, align: 'right' });
      my3 += 28;
    });

    const piEntries3 = Object.entries(pi)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object').slice(0, 6);
    if (piEntries3.length > 0) {
      my3 += 20;
      doc.fillColor(NAVY_SC).font('Helvetica-Bold').fontSize(11).text('MARKET INTELLIGENCE', 50, my3);
      doc.rect(50, my3 + 16, W - 100, 1).fill(AMBER_SC);
      my3 += 24;
      piEntries3.forEach(([k, v], i) => {
        const rowBg = i % 2 === 0 ? '#F8F9FA' : WHITE_SC;
        doc.rect(50, my3, W - 100, 24).fill(rowBg);
        doc.fillColor('#555555').font('Helvetica').fontSize(9).text(humanizeKey(k), 60, my3 + 6, { width: 220 });
        doc.fillColor(NAVY_SC).font('Helvetica-Bold').fontSize(9).text(String(v ?? '—'), 300, my3 + 6, { width: 200, align: 'right' });
        my3 += 24;
      });
    }

    doc.fillColor(MID_SC).font('Helvetica').fontSize(8)
      .text(`${companyName} · JEDI RE Platform · ${new Date().toLocaleDateString()}`, 50, H - 50, { width: W - 100, align: 'center' });

    doc.end();
    return;
  } catch (err: any) {
    logger.error('Shortcode PDF export failed', { error: err?.message, shortcode });
    if (!res.headersSent) return res.status(500).json({ error: err?.message ?? 'Export failed' });
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

// ─── Shortcode-native agent endpoints ────────────────────────────────────────
// Recipients access via /share/:shortcode — they never hold the raw access
// token, so these endpoints resolve everything directly from the shortcode.

router.get('/shares/:shortcode/connection', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT rc.connection_id, rc.provider, rc.total_queries,
              rc.total_charges_usd, rc.connected_at, rc.last_used_at
       FROM recipient_api_connections rc
       JOIN capsule_external_shares ces ON ces.share_id = rc.share_id
       WHERE ces.shortcode = $1
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
         AND rc.disconnected_at IS NULL
       ORDER BY rc.connected_at DESC
       LIMIT 1`,
      [shortcode]
    );
    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }
    const row = result.rows[0];
    return res.json({
      connected: true,
      connection_id: row.connection_id,
      provider: row.provider,
      total_queries: row.total_queries,
      total_charges_usd: parseFloat(row.total_charges_usd ?? '0'),
      connected_at: row.connected_at,
      last_used_at: row.last_used_at,
    });
  } catch (err: any) {
    logger.error('Failed to check connection status', { error: err?.message });
    return res.status(500).json({ error: 'Failed to check connection status' });
  }
});

router.post('/shares/:shortcode/connect_api', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  const { provider, api_key } = req.body;

  if (!provider || !api_key) {
    return res.status(400).json({ error: 'provider and api_key are required' });
  }
  if (!['anthropic', 'openai'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be anthropic or openai' });
  }

  try {
    const pool = getPool();
    const shareResult = await pool.query(
      `SELECT share_id, share_type, recipient_email FROM capsule_external_shares
       WHERE shortcode = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [shortcode]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share link is invalid or expired' });
    }
    const share = shareResult.rows[0];
    if (share.share_type !== 'external_agent_enabled') {
      return res.status(403).json({ error: 'Agent interaction not enabled for this share' });
    }

    // Stripe customer
    let stripeCustomerId: string | null = null;
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        if (share.recipient_email) {
          const existing = await stripe.customers.list({ email: share.recipient_email, limit: 1 });
          stripeCustomerId = existing.data[0]?.id ?? null;
        }
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: share.recipient_email ?? undefined,
            metadata: { source: 'capsule_share', share_id: share.share_id },
          });
          stripeCustomerId = customer.id;
        }
      }
    } catch (stripeErr: any) {
      logger.warn('Stripe customer creation failed (non-fatal)', { error: stripeErr?.message });
    }

    // Validate key
    try {
      if (provider === 'anthropic') {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const testClient = new Anthropic({ apiKey: api_key });
        await testClient.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 1,
          system: 'Respond with a single word: ok',
          messages: [{ role: 'user', content: 'test' }],
        });
      } else if (provider === 'openai') {
        const OpenAI = await import('openai');
        const testClient = new OpenAI.default({ apiKey: api_key });
        await testClient.chat.completions.create({
          model: 'gpt-4o-mini', max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        });
      }
    } catch (validationErr: any) {
      return res.status(400).json({
        error: 'API key validation failed',
        detail: validationErr?.message ?? 'Provider rejected the key. Check it is valid and has model access.',
      });
    }

    const { encryptToken } = await import('../../services/encryption');
    const encryptedKey = encryptToken(api_key);

    const connectionResult = await pool.query(
      `INSERT INTO recipient_api_connections
         (share_id, provider, api_key_encrypted, stripe_customer_id)
       VALUES ($1, $2, $3, $4)
       RETURNING connection_id, connected_at`,
      [share.share_id, provider, encryptedKey, stripeCustomerId]
    );
    const connection = connectionResult.rows[0];

    logger.info('API key connected via shortcode (AES-256-GCM)', {
      shareId: share.share_id, connectionId: connection.connection_id, provider,
    });

    return res.status(201).json({
      connection_id: connection.connection_id,
      provider,
      connected_at: connection.connected_at,
      status: 'connected',
    });
  } catch (err: any) {
    logger.error('Failed to connect API key (shortcode path)', { error: err?.message });
    return res.status(500).json({ error: err?.message ?? 'Failed to connect API key' });
  }
});

router.post('/shares/:shortcode/query', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 10000) {
    return res.status(400).json({ error: 'Message too long (max 10,000 characters)' });
  }
  try {
    const result = await executeRecipientQueryByShortcode(shortcode, message.trim());
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
    logger.error('Recipient query failed (shortcode path)', { error: err?.message });
    return res.status(400).json({ error: err?.message ?? 'Query failed' });
  }
});

router.delete('/shares/:shortcode/connect_api', async (req: Request, res: Response) => {
  const { shortcode } = req.params;
  try {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE recipient_api_connections rc
       SET disconnected_at = NOW()
       FROM capsule_external_shares ces
       WHERE ces.shortcode = $1
         AND ces.share_id = rc.share_id
         AND rc.disconnected_at IS NULL
       RETURNING rc.connection_id, rc.disconnected_at`,
      [shortcode]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active connection found for this share' });
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

// ─── POST /shares/:shortcode/fork — authenticated user forks deal into pipeline ──
// Called immediately after registration/login when the user arrived from a
// share landing page. Creates a new pipeline deal seeded from the capsule data.
// Requires platform auth (the user just registered/logged in).

router.post('/shares/:shortcode/fork', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { shortcode } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();

    // Resolve the share — must be valid, not revoked, not expired
    const shareResult = await pool.query(
      `SELECT ces.share_id, ces.capsule_id, ces.share_type, ces.expires_at
       FROM capsule_external_shares ces
       WHERE ces.shortcode = $1
         AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW())
       LIMIT 1`,
      [shortcode]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share link is invalid, expired, or has been revoked.' });
    }

    const { capsule_id: capsuleId } = shareResult.rows[0];

    // Fetch capsule data
    const capsuleResult = await pool.query(
      `SELECT property_address, asset_class, jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [capsuleId]
    );

    if (capsuleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal content not found.' });
    }

    const capsule = capsuleResult.rows[0];
    const propertyAddress = capsule.property_address ?? 'Shared Deal';
    const assetClass = capsule.asset_class ?? null;

    // Build seeded deal_data from the capsule, tagging the fork origin
    const sourceDealData = (capsule.deal_data as Record<string, unknown>) ?? {};
    const seededDealData: Record<string, unknown> = {
      ...sourceDealData,
      forked_from_share: shortcode,
      forked_from_capsule: capsuleId,
      forked_at: new Date().toISOString(),
      ...(capsule.jedi_score != null && { jedi_score: capsule.jedi_score }),
    };

    // Check if the user has already forked this share to avoid duplicates
    const dupeCheck = await pool.query(
      `SELECT d.id, dc.id AS capsule_id
       FROM deals d
       LEFT JOIN deal_capsules dc
         ON dc.user_id = d.user_id
        AND dc.deal_data->>'forked_from_share' = $2
       WHERE d.user_id = $1
         AND d.deal_data->>'forked_from_share' = $2
       LIMIT 1`,
      [userId, shortcode]
    );

    if (dupeCheck.rows.length > 0) {
      logger.info('Share fork skipped — already forked', { userId, shortcode, existingDealId: dupeCheck.rows[0].id });
      return res.json({
        deal_id: dupeCheck.rows[0].id,
        capsule_id: dupeCheck.rows[0].capsule_id ?? null,
        property_address: propertyAddress,
        already_existed: true,
      });
    }

    // ── Atomic transaction: create deal + recipient capsule clone ────────────
    // Both rows must exist or neither should — use a client for BEGIN/COMMIT.
    const client = await pool.connect();
    let newDeal: { id: string; name: string };
    let newCapsuleId: string;

    try {
      await client.query('BEGIN');

      // 1. Create the pipeline deal
      const dealInsert = await client.query(
        `INSERT INTO deals (
           user_id, name, status, deal_category,
           address, property_address,
           strategy, deal_data
         ) VALUES ($1, $2, 'active', 'pipeline', $3, $4, $5, $6)
         RETURNING id, name`,
        [
          userId,
          propertyAddress,
          propertyAddress,
          propertyAddress,
          assetClass,
          JSON.stringify(seededDealData),
        ]
      );
      newDeal = dealInsert.rows[0];

      // 2. Clone the source capsule for the recipient (their own working copy).
      // Stamp deal_id = newDeal.id so capsule-bridge.findCapsuleByDeal can resolve it.
      // user_adjustments reset to {} — recipient starts fresh on top of the snapshot.
      const capsuleDealData: Record<string, unknown> = {
        ...seededDealData,
        deal_id: newDeal.id,
      };

      const capsuleInsert = await client.query(
        `INSERT INTO deal_capsules (
           user_id, deal_data, platform_intel, user_adjustments, module_outputs,
           property_address, asset_class, jedi_score, collision_score, status
         ) VALUES ($1, $2, $3, '{}'::jsonb, $4, $5, $6, $7, $8, 'DISCOVER')
         RETURNING id`,
        [
          userId,
          JSON.stringify(capsuleDealData),
          JSON.stringify((capsule.platform_intel as Record<string, unknown>) ?? {}),
          JSON.stringify((capsule.module_outputs as Record<string, unknown>) ?? {}),
          propertyAddress,
          assetClass,
          capsule.jedi_score ?? null,
          capsule.collision_score ?? null,
        ]
      );
      newCapsuleId = capsuleInsert.rows[0].id;

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Attribution — write fork event to capsule_fork_log (non-fatal, outside tx)
    try {
      await pool.query(
        `INSERT INTO capsule_fork_log
           (shortcode, capsule_id, source_share_id, forked_by_user_id, new_deal_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [shortcode, capsuleId, shareResult.rows[0].share_id, userId, newDeal.id]
      );
    } catch (forkLogErr) {
      logger.warn('Failed to write fork attribution log (non-fatal)', {
        error: (forkLogErr as Error).message,
        shortcode, capsuleId, newDealId: newDeal.id,
      });
    }

    logger.info('Deal forked from share', {
      userId, shortcode, capsuleId, newDealId: newDeal.id, newCapsuleId,
    });

    return res.status(201).json({
      deal_id: newDeal.id,
      capsule_id: newCapsuleId,
      deal_name: newDeal.name,
      property_address: propertyAddress,
      already_existed: false,
    });
  } catch (err: any) {
    logger.error('Failed to fork deal from share', { error: err?.message, shortcode });
    return res.status(500).json({ error: err?.message ?? 'Failed to fork deal' });
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

// ─── Capsule export helpers ───────────────────────────────────────────────────

function flattenLV(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'resolved' in (v as Record<string, unknown>)) {
      out[k] = (v as Record<string, unknown>).resolved;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function humanizeKey(k: string): string {
  return k.replace(/_lv$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function jsonToKVRows(obj: Record<string, unknown>): (string | number | null)[][] {
  const flat = flattenLV(obj);
  return Object.entries(flat)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => [humanizeKey(k), typeof v === 'number' ? v : String(v ?? '')]);
}

function buildCapsuleWorkbook(capsule: {
  property_address: string | null;
  asset_class: string | null;
  jedi_score: number | null;
  collision_score: number | null;
  deal_data: Record<string, unknown>;
  platform_intel: Record<string, unknown>;
  user_adjustments: Record<string, unknown>;
  module_outputs: Record<string, unknown>;
  created_at: string;
}): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const dd = flattenLV(capsule.deal_data ?? {});

  const summaryRows: (string | number | null)[][] = [
    ['DEAL SUMMARY', ''],
    ['Property Address', capsule.property_address ?? ''],
    ['Asset Class', capsule.asset_class ?? ''],
    ['JEDI Score', capsule.jedi_score ?? ''],
    ['Collision Score', capsule.collision_score ?? ''],
    ['Created', new Date(capsule.created_at).toLocaleDateString()],
    ['', ''],
    ['KEY FINANCIAL METRICS', ''],
    ['Purchase Price / Asking Price', (dd.purchase_price ?? dd.asking_price ?? dd.purchasePrice ?? '') as string | number],
    ['NOI (Annual)', (dd.noi ?? dd.annual_noi ?? '') as string | number],
    ['Going-In Cap Rate', (dd.cap_rate ?? dd.going_in_cap_rate ?? '') as string | number],
    ['Exit Cap Rate', (dd.exit_cap_rate ?? dd.exitCapRate ?? '') as string | number],
    ['Hold Period (Years)', (dd.hold_period ?? dd.holdPeriod ?? '') as string | number],
    ['LTV', (dd.ltv ?? dd.loan_to_value ?? '') as string | number],
    ['Total Units', (dd.total_units ?? dd.totalUnits ?? '') as string | number],
    ['Vacancy Rate', (dd.vacancy_rate ?? dd.vacancy ?? '') as string | number],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet([['METRIC', 'VALUE'], ...summaryRows]);
  ws1['!cols'] = [{ wch: 34 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  const ddRows = jsonToKVRows(capsule.deal_data ?? {});
  if (ddRows.length > 0) {
    const ws2 = XLSX.utils.aoa_to_sheet([['FIELD', 'VALUE'], ...ddRows]);
    ws2['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Deal Data');
  }

  const piRows = jsonToKVRows(capsule.platform_intel ?? {});
  if (piRows.length > 0) {
    const ws3 = XLSX.utils.aoa_to_sheet([['FIELD', 'VALUE'], ...piRows]);
    ws3['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Market Intel');
  }

  const uaRows = jsonToKVRows(capsule.user_adjustments ?? {});
  if (uaRows.length > 0) {
    const ws4 = XLSX.utils.aoa_to_sheet([['FIELD', 'VALUE'], ...uaRows]);
    ws4['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'User Inputs');
  }

  const moRows = jsonToKVRows(capsule.module_outputs ?? {});
  if (moRows.length > 0) {
    const ws5 = XLSX.utils.aoa_to_sheet([['FIELD', 'VALUE'], ...moRows]);
    ws5['!cols'] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Module Outputs');
  }

  return wb;
}

// ─── GET /:capsuleId/export/excel — XLSX workbook download ───────────────────

router.get('/:capsuleId/export/excel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { capsuleId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT property_address, asset_class, jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs, created_at
       FROM deal_capsules WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [capsuleId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Capsule not found or access denied' });
    }

    const capsule = result.rows[0];
    const wb = buildCapsuleWorkbook(capsule);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true });

    const safeName = (capsule.property_address ?? capsuleId).replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_capsule.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.send(buf);
  } catch (err: any) {
    logger.error('Capsule Excel export failed', { error: err?.message, capsuleId });
    if (!res.headersSent) return res.status(500).json({ error: err?.message ?? 'Export failed' });
  }
});

// ─── SSRF-safe logo fetch helper ─────────────────────────────────────────────
async function safeFetchLogoBuffer(rawUrl: string): Promise<Buffer | null> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const h = parsed.hostname.toLowerCase();
  const BLOCKED_EXACT = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254', 'metadata.google.internal']);
  if (BLOCKED_EXACT.has(h)) return null;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fc00:|fc[0-9a-f]{2}:|fd)/i.test(h)) return null;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return null;
  try {
    const r = await (globalThis.fetch as typeof fetch)(rawUrl, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// ─── GET /:capsuleId/export/pdf — PDF pitch deck download ────────────────────

router.get('/:capsuleId/export/pdf', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { capsuleId } = req.params;
  const userId = req.user?.userId ?? (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT dc.property_address, dc.asset_class, dc.jedi_score, dc.collision_score,
              dc.deal_data, dc.platform_intel, dc.module_outputs, dc.created_at,
              ubs.company_name, ubs.logo_url
       FROM deal_capsules dc
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = dc.user_id
       WHERE dc.id = $1 AND dc.user_id = $2 LIMIT 1`,
      [capsuleId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Capsule not found or access denied' });
    }

    const capsule = result.rows[0];
    const dd = flattenLV((capsule.deal_data as Record<string, unknown>) ?? {});
    const pi = flattenLV((capsule.platform_intel as Record<string, unknown>) ?? {});
    const companyName: string = capsule.company_name ?? 'JEDI RE';
    const address: string = capsule.property_address ?? 'Undisclosed Address';
    const assetClass: string = capsule.asset_class ?? '';

    // Fetch logo buffer BEFORE piping — safe helper rejects private IPs/non-HTTPS
    const logoBuffer = capsule.logo_url ? await safeFetchLogoBuffer(String(capsule.logo_url)) : null;

    const fmtMoney = (v: unknown): string => {
      const n = parseFloat(String(v ?? ''));
      if (isNaN(n)) return '—';
      if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
      if (Math.abs(n) >= 1_000) return `$${n.toLocaleString()}`;
      return `$${n}`;
    };
    const fmtPct = (v: unknown): string => {
      const n = parseFloat(String(v ?? ''));
      if (isNaN(n)) return '—';
      return `${(n > 1 ? n : n * 100).toFixed(2)}%`;
    };

    const safeName = address.replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_pitch_deck.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: address, Author: companyName } });
    doc.pipe(res);

    const W = 595.28;
    const H = 841.89;
    const NAVY = '#0D1B2A';
    const AMBER_PDF = '#F0B429';
    const SLATE = '#1A2A3E';
    const WHITE = '#FFFFFF';
    const LIGHT = '#E8ECF1';
    const MID = '#8B9CB0';

    // ── Page 1: Cover ──
    doc.rect(0, 0, W, H).fill(NAVY);
    doc.rect(0, 0, W, 8).fill(AMBER_PDF);

    // Company branding — embed logo if available, else text fallback
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 50, { fit: [120, 40], align: 'left' });
        doc.fillColor(MID).font('Helvetica').fontSize(9)
          .text('DEAL CAPSULE — CONFIDENTIAL', 50, 96);
      } catch {
        // Image format not supported by pdfkit (e.g. WebP) — fall back to text
        doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(14)
          .text(companyName.toUpperCase(), 50, 60, { width: W - 100 });
        doc.fillColor(MID).font('Helvetica').fontSize(9)
          .text('DEAL CAPSULE — CONFIDENTIAL', 50, 80);
      }
    } else {
      doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(14)
        .text(companyName.toUpperCase(), 50, 60, { width: W - 100 });
      doc.fillColor(MID).font('Helvetica').fontSize(9)
        .text('DEAL CAPSULE — CONFIDENTIAL', 50, 80);
    }

    // Property address (large)
    doc.rect(50, 140, W - 100, 2).fill(AMBER_PDF);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(26)
      .text(address, 50, 160, { width: W - 100, lineGap: 4 });

    if (assetClass) {
      doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(11)
        .text(assetClass.toUpperCase(), 50, doc.y + 10);
    }

    // JEDI Score badge
    if (capsule.jedi_score != null) {
      const scoreY = 300;
      doc.rect(50, scoreY, 120, 80).fill(SLATE);
      doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(36)
        .text(String(capsule.jedi_score), 50, scoreY + 12, { width: 120, align: 'center' });
      doc.fillColor(MID).font('Helvetica').fontSize(8)
        .text('JEDI SCORE', 50, scoreY + 52, { width: 120, align: 'center' });
    }

    // Date
    doc.fillColor(MID).font('Helvetica').fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, H - 80, { width: W - 100 });
    doc.fillColor(MID).font('Helvetica').fontSize(8)
      .text('This document contains confidential and proprietary information.', 50, H - 60, { width: W - 100 });

    // ── Page 2: Key Metrics ──
    doc.addPage();
    doc.rect(0, 0, W, H).fill(WHITE);
    doc.rect(0, 0, W, 8).fill(AMBER_PDF);
    doc.rect(0, 8, W, 50).fill(NAVY);

    doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(13)
      .text('KEY METRICS', 50, 22);
    doc.fillColor(LIGHT).font('Helvetica').fontSize(9)
      .text(address, 50, 40);

    const metrics: [string, string][] = [
      ['Purchase Price / Asking Price', fmtMoney(dd.purchase_price ?? dd.asking_price ?? dd.purchasePrice)],
      ['Annual NOI', fmtMoney(dd.noi ?? dd.annual_noi)],
      ['Going-In Cap Rate', fmtPct(dd.cap_rate ?? dd.going_in_cap_rate)],
      ['Exit Cap Rate', fmtPct(dd.exit_cap_rate ?? dd.exitCapRate)],
      ['Hold Period', dd.hold_period || dd.holdPeriod ? `${dd.hold_period ?? dd.holdPeriod} years` : '—'],
      ['LTV', fmtPct(dd.ltv ?? dd.loan_to_value)],
      ['Total Units', String(dd.total_units ?? dd.totalUnits ?? '—')],
      ['Vacancy Rate', fmtPct(dd.vacancy_rate ?? dd.vacancy)],
      ['Asset Class', assetClass || '—'],
      ['Status', capsule.asset_class ?? '—'],
    ];

    let my = 80;
    metrics.forEach(([label, value], i) => {
      const rowBg = i % 2 === 0 ? '#F8F9FA' : WHITE;
      doc.rect(50, my, W - 100, 28).fill(rowBg);
      doc.fillColor('#333333').font('Helvetica').fontSize(10).text(label, 60, my + 8, { width: 220 });
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text(value, 300, my + 8, { width: 200, align: 'right' });
      my += 28;
    });

    // Platform intel highlights
    const piEntries = Object.entries(pi)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
      .slice(0, 8);

    if (piEntries.length > 0) {
      my += 20;
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
        .text('MARKET INTELLIGENCE', 50, my);
      doc.rect(50, my + 16, W - 100, 1).fill(AMBER_PDF);
      my += 24;

      piEntries.forEach(([k, v], i) => {
        const rowBg = i % 2 === 0 ? '#F8F9FA' : WHITE;
        doc.rect(50, my, W - 100, 24).fill(rowBg);
        doc.fillColor('#555555').font('Helvetica').fontSize(9).text(humanizeKey(k), 60, my + 6, { width: 220 });
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text(String(v ?? '—'), 300, my + 6, { width: 200, align: 'right' });
        my += 24;
      });
    }

    // Footer page 2
    doc.fillColor(MID).font('Helvetica').fontSize(8)
      .text(`${companyName} · JEDI RE Platform · ${new Date().toLocaleDateString()}`, 50, H - 50, { width: W - 100, align: 'center' });

    // ── Page 3: Visual Metrics Scorecard ──
    doc.addPage();
    doc.rect(0, 0, W, H).fill(NAVY);
    doc.rect(0, 0, W, 8).fill(AMBER_PDF);
    doc.rect(0, 8, W, 50).fill(SLATE);

    doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(13).text('METRICS SCORECARD', 50, 22);
    doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text(address, 50, 40);

    // Percentage metrics bar chart
    const pctMetrics: [string, number | null][] = [
      ['Going-In Cap Rate', dd.cap_rate ?? dd.going_in_cap_rate ? parseFloat(String(dd.cap_rate ?? dd.going_in_cap_rate)) : null],
      ['Exit Cap Rate',     dd.exit_cap_rate ?? dd.exitCapRate   ? parseFloat(String(dd.exit_cap_rate ?? dd.exitCapRate))   : null],
      ['LTV',              dd.ltv ?? dd.loan_to_value           ? parseFloat(String(dd.ltv ?? dd.loan_to_value))           : null],
      ['Vacancy Rate',     dd.vacancy_rate ?? dd.vacancy         ? parseFloat(String(dd.vacancy_rate ?? dd.vacancy))        : null],
    ].filter(([, v]) => v !== null && !isNaN(v as number)) as [string, number][];

    const BAR_X = 50, BAR_W = W - 100, BAR_MAX_VAL = 100;
    let by = 82;
    doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(10).text('PERCENTAGE METRICS', BAR_X, by);
    doc.rect(BAR_X, by + 16, BAR_W, 1).fill(AMBER_PDF + '60');
    by += 24;

    pctMetrics.forEach(([label, rawVal]) => {
      const val = Math.min(rawVal > 1 ? rawVal : rawVal * 100, BAR_MAX_VAL);
      const barLen = Math.max((val / BAR_MAX_VAL) * BAR_W, 4);
      doc.fillColor(LIGHT).font('Helvetica').fontSize(9).text(label, BAR_X, by + 2, { width: 180 });
      doc.rect(BAR_X + 190, by, BAR_W - 190 - 60, 14).fill('#1A2A3E');
      doc.rect(BAR_X + 190, by, Math.min(barLen, BAR_W - 190 - 60), 14).fill(AMBER_PDF);
      doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(9)
        .text(`${val.toFixed(2)}%`, BAR_X + BAR_W - 55, by + 2, { width: 55, align: 'right' });
      by += 24;
    });

    // Dollar metrics scorecard tiles
    const dollarMetrics: [string, string][] = [
      ['ASKING PRICE', fmtMoney(dd.purchase_price ?? dd.asking_price ?? dd.purchasePrice)],
      ['ANNUAL NOI',   fmtMoney(dd.noi ?? dd.annual_noi)],
    ].filter(([, v]) => v !== '—') as [string, string][];

    if (dollarMetrics.length > 0) {
      by += 20;
      doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(10).text('KEY FINANCIAL FIGURES', BAR_X, by);
      doc.rect(BAR_X, by + 16, BAR_W, 1).fill(AMBER_PDF + '60');
      by += 28;
      const tileW = (BAR_W - 20) / 2;
      dollarMetrics.forEach(([label, value], i) => {
        const tx = BAR_X + i * (tileW + 20);
        doc.rect(tx, by, tileW, 70).fill(SLATE);
        doc.rect(tx, by, tileW, 4).fill(AMBER_PDF);
        doc.fillColor(MID).font('Helvetica').fontSize(8).text(label, tx + 12, by + 12, { width: tileW - 24 });
        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(18).text(value, tx + 12, by + 26, { width: tileW - 24 });
      });
      by += 90;
    }

    // JEDI score callout
    if (capsule.jedi_score != null) {
      doc.rect(BAR_X, by + 10, BAR_W, 80).fill(SLATE);
      doc.rect(BAR_X, by + 10, 8, 80).fill(AMBER_PDF);
      doc.fillColor(MID).font('Helvetica').fontSize(8).text('JEDI INTELLIGENCE SCORE', BAR_X + 24, by + 22, { width: 200 });
      doc.fillColor(AMBER_PDF).font('Helvetica-Bold').fontSize(42)
        .text(String(capsule.jedi_score), BAR_X + 24, by + 32, { width: 100 });
      doc.fillColor(LIGHT).font('Helvetica').fontSize(9)
        .text('Synthesized deal quality score derived from market, financial,\nand zoning intelligence across 18 capability modules.', BAR_X + 140, by + 32, { width: BAR_W - 164 });
    }

    // Footer page 3
    doc.fillColor(MID).font('Helvetica').fontSize(8)
      .text(`${companyName} · CONFIDENTIAL · ${new Date().toLocaleDateString()}`, 50, H - 50, { width: W - 100, align: 'center' });

    doc.end();
    return;
  } catch (err: any) {
    logger.error('Capsule PDF export failed', { error: err?.message, capsuleId });
    if (!res.headersSent) return res.status(500).json({ error: err?.message ?? 'Export failed' });
  }
});

// ─── GET /capsule-links/:accessToken/export/excel — share-token XLSX export ───
// No platform auth — share token is the credential. Rate-limit inherited from
// general deal-book store.

router.get('/capsule-links/:accessToken/export/excel', async (req: Request, res: Response) => {
  const { accessToken } = req.params;
  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareResult = await pool.query(
      `SELECT capsule_id, allow_document_download FROM capsule_external_shares
       WHERE access_token = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [tokenHash]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired share link' });
    }
    if (!shareResult.rows[0].allow_document_download) {
      return res.status(403).json({ error: 'Document download is not permitted for this share.' });
    }

    const capsuleId = shareResult.rows[0].capsule_id;
    const result = await pool.query(
      `SELECT property_address, asset_class, jedi_score, collision_score,
              deal_data, platform_intel, user_adjustments, module_outputs, created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [capsuleId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Capsule not found' });

    const wb = buildCapsuleWorkbook(result.rows[0]);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true });
    const safeName = (result.rows[0].property_address ?? capsuleId)
      .replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_capsule.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    return res.send(buf);
  } catch (err: any) {
    logger.error('Share-token Excel export failed', { error: err?.message });
    if (!res.headersSent) return res.status(500).json({ error: err?.message ?? 'Export failed' });
  }
});

// ─── GET /capsule-links/:accessToken/export/pdf — share-token PDF export ──────

router.get('/capsule-links/:accessToken/export/pdf', async (req: Request, res: Response) => {
  const { accessToken } = req.params;
  try {
    const pool = getPool();
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    const shareResult = await pool.query(
      `SELECT ces.capsule_id, ces.allow_document_download, ubs.company_name, ubs.logo_url
       FROM capsule_external_shares ces
       JOIN deal_capsules dc ON dc.id = ces.capsule_id
       LEFT JOIN user_branding_settings ubs ON ubs.user_id = dc.user_id
       WHERE ces.access_token = $1 AND ces.revoked_at IS NULL
         AND (ces.expires_at IS NULL OR ces.expires_at > NOW()) LIMIT 1`,
      [tokenHash]
    );
    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired share link' });
    }
    if (!shareResult.rows[0].allow_document_download) {
      return res.status(403).json({ error: 'Document download is not permitted for this share.' });
    }

    const { capsule_id: capsuleId, company_name, logo_url } = shareResult.rows[0];
    const result = await pool.query(
      `SELECT property_address, asset_class, jedi_score, collision_score,
              deal_data, platform_intel, created_at
       FROM deal_capsules WHERE id = $1 LIMIT 1`,
      [capsuleId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Capsule not found' });

    const capsule = result.rows[0];
    const dd = flattenLV((capsule.deal_data as Record<string, unknown>) ?? {});
    const pi = flattenLV((capsule.platform_intel as Record<string, unknown>) ?? {});
    const companyName: string = company_name ?? 'JEDI RE';
    const address: string = capsule.property_address ?? 'Undisclosed Address';
    const assetClass: string = capsule.asset_class ?? '';
    const logoBuffer = logo_url ? await safeFetchLogoBuffer(String(logo_url)) : null;

    const fmtM = (v: unknown): string => {
      const n = parseFloat(String(v ?? ''));
      if (isNaN(n)) return '—';
      if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
      if (Math.abs(n) >= 1_000) return `$${n.toLocaleString()}`;
      return `$${n}`;
    };
    const fmtP = (v: unknown): string => {
      const n = parseFloat(String(v ?? ''));
      if (isNaN(n)) return '—';
      return `${(n > 1 ? n : n * 100).toFixed(2)}%`;
    };

    const safeName = address.replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_capsule.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: address, Author: companyName } });
    doc.pipe(res);

    const W = 595.28, H = 841.89;
    const NAVY_ST = '#0D1B2A', AMBER_ST = '#F0B429', SLATE_ST = '#1A2A3E';
    const WHITE_ST = '#FFFFFF', LIGHT_ST = '#E8ECF1', MID_ST = '#8B9CB0';

    // Cover page
    doc.rect(0, 0, W, H).fill(NAVY_ST);
    doc.rect(0, 0, W, 8).fill(AMBER_ST);

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 50, { fit: [120, 40], align: 'left' });
        doc.fillColor(MID_ST).font('Helvetica').fontSize(9).text('DEAL CAPSULE — CONFIDENTIAL', 50, 96);
      } catch {
        doc.fillColor(AMBER_ST).font('Helvetica-Bold').fontSize(14).text(companyName.toUpperCase(), 50, 60, { width: W - 100 });
        doc.fillColor(MID_ST).font('Helvetica').fontSize(9).text('DEAL CAPSULE — CONFIDENTIAL', 50, 80);
      }
    } else {
      doc.fillColor(AMBER_ST).font('Helvetica-Bold').fontSize(14).text(companyName.toUpperCase(), 50, 60, { width: W - 100 });
      doc.fillColor(MID_ST).font('Helvetica').fontSize(9).text('DEAL CAPSULE — CONFIDENTIAL', 50, 80);
    }

    doc.rect(50, 140, W - 100, 2).fill(AMBER_ST);
    doc.fillColor(WHITE_ST).font('Helvetica-Bold').fontSize(26).text(address, 50, 160, { width: W - 100, lineGap: 4 });
    if (assetClass) doc.fillColor(AMBER_ST).font('Helvetica-Bold').fontSize(11).text(assetClass.toUpperCase(), 50, doc.y + 10);

    if (capsule.jedi_score != null) {
      doc.rect(50, 300, 120, 80).fill(SLATE_ST);
      doc.fillColor(AMBER_ST).font('Helvetica-Bold').fontSize(36).text(String(capsule.jedi_score), 50, 312, { width: 120, align: 'center' });
      doc.fillColor(MID_ST).font('Helvetica').fontSize(8).text('JEDI SCORE', 50, 352, { width: 120, align: 'center' });
    }
    doc.fillColor(MID_ST).font('Helvetica').fontSize(8)
      .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, H - 80, { width: W - 100 });

    // Metrics page
    doc.addPage();
    doc.rect(0, 0, W, H).fill(WHITE_ST);
    doc.rect(0, 0, W, 8).fill(AMBER_ST);
    doc.rect(0, 8, W, 50).fill(NAVY_ST);
    doc.fillColor(AMBER_ST).font('Helvetica-Bold').fontSize(13).text('KEY METRICS', 50, 22);
    doc.fillColor(LIGHT_ST).font('Helvetica').fontSize(9).text(address, 50, 40);

    const metricsList: [string, string][] = [
      ['Purchase Price / Asking Price', fmtM(dd.purchase_price ?? dd.asking_price ?? dd.purchasePrice)],
      ['Annual NOI', fmtM(dd.noi ?? dd.annual_noi)],
      ['Going-In Cap Rate', fmtP(dd.cap_rate ?? dd.going_in_cap_rate)],
      ['Exit Cap Rate', fmtP(dd.exit_cap_rate ?? dd.exitCapRate)],
      ['Hold Period', dd.hold_period ?? dd.holdPeriod ? `${dd.hold_period ?? dd.holdPeriod} years` : '—'],
      ['LTV', fmtP(dd.ltv ?? dd.loan_to_value)],
      ['Total Units', String(dd.total_units ?? dd.totalUnits ?? '—')],
      ['Asset Class', assetClass || '—'],
    ];

    let my2 = 80;
    metricsList.forEach(([label, value], i) => {
      const rowBg = i % 2 === 0 ? '#F8F9FA' : WHITE_ST;
      doc.rect(50, my2, W - 100, 28).fill(rowBg);
      doc.fillColor('#333333').font('Helvetica').fontSize(10).text(label, 60, my2 + 8, { width: 220 });
      doc.fillColor(NAVY_ST).font('Helvetica-Bold').fontSize(10).text(value, 300, my2 + 8, { width: 200, align: 'right' });
      my2 += 28;
    });

    const piEntries2 = Object.entries(pi)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object').slice(0, 6);
    if (piEntries2.length > 0) {
      my2 += 20;
      doc.fillColor(NAVY_ST).font('Helvetica-Bold').fontSize(11).text('MARKET INTELLIGENCE', 50, my2);
      doc.rect(50, my2 + 16, W - 100, 1).fill(AMBER_ST);
      my2 += 24;
      piEntries2.forEach(([k, v], i) => {
        const rowBg = i % 2 === 0 ? '#F8F9FA' : WHITE_ST;
        doc.rect(50, my2, W - 100, 24).fill(rowBg);
        doc.fillColor('#555555').font('Helvetica').fontSize(9).text(humanizeKey(k), 60, my2 + 6, { width: 220 });
        doc.fillColor(NAVY_ST).font('Helvetica-Bold').fontSize(9).text(String(v ?? '—'), 300, my2 + 6, { width: 200, align: 'right' });
        my2 += 24;
      });
    }

    doc.fillColor(MID_ST).font('Helvetica').fontSize(8)
      .text(`${companyName} · JEDI RE Platform · ${new Date().toLocaleDateString()}`, 50, H - 50, { width: W - 100, align: 'center' });

    doc.end();
    return;
  } catch (err: any) {
    logger.error('Share-token PDF export failed', { error: err?.message });
    if (!res.headersSent) return res.status(500).json({ error: err?.message ?? 'Export failed' });
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
