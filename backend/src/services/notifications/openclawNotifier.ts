/**
 * OpenClaw notifier — single entry point that fans a Notification out to all
 * enabled channels (Telegram + Twilio in v1, more later).
 *
 * Replaces the legacy `clawdbotWebhook` stub. Callsites use the kind-specific
 * helpers (notifyDealCreated / notifyAnalysisComplete / notifyError) so the
 * call sites stay one-liners.
 *
 * All sends are fire-and-forget from the caller's perspective: failures are
 * logged but never thrown, so a flaky bot can never break a request flow.
 */

import { logger } from '../../utils/logger';
import { telegramChannel } from './channels/telegram';
import { twilioChannel } from './channels/twilio';
import type {
  ChannelName,
  Notification,
  NotificationChannel,
  SendResult,
} from './types';

const ALL_CHANNELS: NotificationChannel[] = [telegramChannel, twilioChannel];

function parseEnabledChannels(): Set<ChannelName> {
  const raw = process.env.OPENCLAW_ENABLED_CHANNELS;
  if (raw === undefined || raw.trim() === '') {
    // Default: enable every channel that has the credentials it needs.
    return new Set(
      ALL_CHANNELS.filter((c) => c.isEnabled()).map((c) => c.name),
    );
  }
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase() as ChannelName)
      .filter((s): s is ChannelName => s === 'telegram' || s === 'twilio'),
  );
}

/**
 * Resolve which channels receive 5xx error notifications.
 *
 * Returns `undefined` when OPENCLAW_ERROR_CHANNELS is set to an empty value
 * (e.g. `OPENCLAW_ERROR_CHANNELS=`), which signals "no override — fan out to
 * every enabled channel".
 */
function parseErrorChannels(): ChannelName[] | undefined {
  const raw = process.env.OPENCLAW_ERROR_CHANNELS;
  if (raw === undefined) return ['telegram']; // default: errors go to Telegram only
  if (raw.trim() === '') return undefined;     // explicit empty = all enabled channels
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase() as ChannelName)
    .filter((s): s is ChannelName => s === 'telegram' || s === 'twilio');
  return parsed.length > 0 ? parsed : ['telegram'];
}

class OpenClawNotifier {
  /** True iff at least one channel is both listed and enabled. */
  isEnabled(): boolean {
    const enabled = parseEnabledChannels();
    return ALL_CHANNELS.some((c) => enabled.has(c.name) && c.isEnabled());
  }

  /**
   * Fan a notification out to all channels listed in `n.channels`
   * (or all enabled channels if `channels` is omitted).
   *
   * Always resolves — failures are logged per-channel.
   */
  async notify(n: Notification): Promise<SendResult[]> {
    const enabled = parseEnabledChannels();
    const target = new Set<ChannelName>(n.channels ?? Array.from(enabled));
    const results: SendResult[] = [];

    for (const ch of ALL_CHANNELS) {
      if (!target.has(ch.name)) continue;
      if (!enabled.has(ch.name)) continue;
      if (!ch.isEnabled()) {
        results.push({ ok: false, error: `${ch.name} listed but missing credentials` });
        continue;
      }
      try {
        const r = await ch.send(n);
        if (!r.ok) {
          logger.warn('OpenClaw send returned not-ok', { channel: ch.name, error: r.error, kind: n.kind });
        }
        results.push(r);
      } catch (err: any) {
        logger.error('OpenClaw send threw', { channel: ch.name, kind: n.kind, error: err?.message });
        results.push({ ok: false, error: err?.message ?? 'unknown' });
      }
    }
    return results;
  }

  // ─── Kind-specific helpers (used by the existing callsites) ──────────────

  notifyDealCreated(deal: {
    id: string;
    name: string;
    address?: string;
    propertyType?: string;
    status?: string;
    createdBy?: string;
  }): Promise<SendResult[]> {
    const lines = [
      `*${deal.name}*`,
      deal.address ? `Address: ${deal.address}` : null,
      deal.propertyType ? `Type: ${deal.propertyType}` : null,
      deal.status ? `Status: ${deal.status}` : null,
      deal.createdBy ? `Created by: ${deal.createdBy}` : null,
    ].filter(Boolean) as string[];

    return this.notify({
      kind: 'deal_created',
      title: 'New deal created',
      body: lines.join('\n'),
      deepLink: this.dealDeepLink(deal.id),
      actions: [
        { label: 'Approve', actionId: 'approve', resourceId: deal.id },
        { label: 'Dismiss', actionId: 'dismiss', resourceId: deal.id },
      ],
      meta: { dealId: deal.id },
    }).catch((err) => {
      logger.error('notifyDealCreated failed', { error: err?.message });
      return [];
    });
  }

  notifyAnalysisComplete(dealId: string, analysis: any): Promise<SendResult[]> {
    const summary = this.summariseAnalysis(analysis);
    return this.notify({
      kind: 'analysis_complete',
      title: 'Deal analysis complete',
      body: `Deal ${dealId}\n${summary}`,
      deepLink: this.dealDeepLink(dealId),
      actions: [
        { label: 'Re-run analysis', actionId: 'rerun', resourceId: dealId },
        { label: 'Dismiss', actionId: 'dismiss', resourceId: dealId },
      ],
      meta: { dealId },
    }).catch((err) => {
      logger.error('notifyAnalysisComplete failed', { error: err?.message });
      return [];
    });
  }

  notifyError(err: Error, ctx: {
    url?: string;
    method?: string;
    userId?: string;
    ip?: string;
    statusCode?: number;
    [key: string]: any;
  }): Promise<SendResult[]> {
    const lines = [
      `\`${err.name || 'Error'}\`: ${err.message}`,
      ctx.method && ctx.url ? `Request: ${ctx.method} ${ctx.url}` : null,
      ctx.statusCode ? `Status: ${ctx.statusCode}` : null,
      ctx.userId ? `User: ${ctx.userId}` : null,
      ctx.ip ? `IP: ${ctx.ip}` : null,
    ].filter(Boolean) as string[];

    // Operators can override which channels receive 5xx error blasts via
    // OPENCLAW_ERROR_CHANNELS (comma-separated). Default is "telegram" alone
    // because SMS for every 500 gets noisy fast; set it to blank to fan out
    // to all enabled channels.
    return this.notify({
      kind: 'server_error',
      title: 'Server error',
      body: lines.join('\n'),
      channels: parseErrorChannels(),
      meta: { stack: err.stack?.split('\n').slice(0, 3).join('\n') },
    }).catch((sendErr) => {
      logger.error('notifyError failed', { error: sendErr?.message });
      return [];
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private dealDeepLink(dealId: string): string | undefined {
    const base = process.env.JEDIRE_PUBLIC_URL || process.env.PUBLIC_APP_URL;
    if (!base) return undefined;
    return `${base.replace(/\/$/, '')}/deals/${dealId}`;
  }

  private summariseAnalysis(analysis: any): string {
    if (!analysis || typeof analysis !== 'object') return '(no summary available)';
    const score = analysis.jediScore ?? analysis.score;
    const verdict = analysis.verdict ?? analysis.recommendation;
    const parts: string[] = [];
    if (score !== undefined) parts.push(`Score: ${score}`);
    if (verdict) parts.push(`Verdict: ${verdict}`);
    return parts.length > 0 ? parts.join(' • ') : 'Analysis ready — open in JediRe for details.';
  }
}

export const openclawNotifier = new OpenClawNotifier();
export type { Notification, NotificationAction, SendResult } from './types';
