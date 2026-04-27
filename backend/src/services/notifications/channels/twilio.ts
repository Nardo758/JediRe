/**
 * Twilio channel adapter for OpenClaw notifications.
 *
 * Twilio Conversations / SMS / WhatsApp don't support inline buttons, so
 * structured NotificationActions render as a "Reply: ..." hint at the bottom
 * of the message body. Inbound action commands are matched in messageRouter
 * before the orchestrator sees them.
 */

import { logger } from '../../../utils/logger';
import {
  getTwilioClient,
  getTwilioFromPhoneNumber,
} from '../../twilio/twilioClient';
import type {
  MessageRef,
  Notification,
  NotificationAction,
  NotificationChannel,
  SendResult,
} from '../types';

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeNumber(raw: string): string {
  // Strip Twilio platform prefixes (whatsapp:, messenger:) for comparison.
  return raw.replace(/^whatsapp:/, '').replace(/^messenger:/, '').trim();
}

function renderActionHint(actions: NotificationAction[] | undefined): string {
  if (!actions || actions.length === 0) return '';
  const fragments = actions.map((a) => {
    const verb = a.actionId;
    return a.resourceId ? `${verb} ${a.resourceId}` : verb;
  });
  return `\n\nReply: ${fragments.join(' / ')}`;
}

function renderText(n: Notification): string {
  // Plain text — no markdown. Twilio renders ** literally on SMS.
  const parts = [n.title.toUpperCase(), '', n.body];
  if (n.deepLink) parts.push('', n.deepLink);
  parts.push(renderActionHint(n.actions));
  return parts.join('\n').trim();
}

class TwilioChannel implements NotificationChannel {
  readonly name = 'twilio' as const;

  isEnabled(): boolean {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_PHONE_NUMBER &&
      process.env.TWILIO_NOTIFY_TO_NUMBERS,
    );
  }

  isAuthorized(senderId: string): boolean {
    const allow = parseList(process.env.TWILIO_ALLOWED_NUMBERS).map(normalizeNumber);
    const sender = normalizeNumber(senderId);
    if (allow.length === 0) {
      // Fall back to the notify-to list if no explicit allowlist.
      const fallback = parseList(process.env.TWILIO_NOTIFY_TO_NUMBERS).map(normalizeNumber);
      return fallback.includes(sender);
    }
    return allow.includes(sender);
  }

  async send(n: Notification): Promise<SendResult> {
    if (!this.isEnabled()) {
      return { ok: false, error: 'twilio channel disabled (missing TWILIO_* env vars)' };
    }
    const recipients = parseList(process.env.TWILIO_NOTIFY_TO_NUMBERS);
    if (recipients.length === 0) {
      return { ok: false, error: 'no TWILIO_NOTIFY_TO_NUMBERS configured' };
    }

    let client: any;
    let from: string;
    try {
      client = await getTwilioClient();
      from = await getTwilioFromPhoneNumber();
    } catch (err: any) {
      return { ok: false, error: `twilio client unavailable: ${err?.message ?? 'unknown'}` };
    }

    const body = renderText(n);
    const refs: MessageRef[] = [];
    let anyOk = false;
    let lastErr: string | undefined;

    for (const to of recipients) {
      try {
        const msg = await client.messages.create({
          body,
          to,
          from,
        });
        refs.push({
          channel: 'twilio',
          messageId: String(msg?.sid ?? ''),
          recipient: to,
        });
        anyOk = true;
      } catch (err: any) {
        lastErr = err?.message ?? 'unknown';
        logger.warn('OpenClaw twilio send failed', {
          kind: n.kind,
          to,
          error: lastErr,
          code: err?.code,
        });
      }
    }
    return anyOk ? { ok: true, refs } : { ok: false, error: lastErr ?? 'all twilio sends failed' };
  }

  async editMessage(ref: MessageRef, text: string): Promise<{ ok: boolean; error?: string }> {
    // Twilio messages can't be edited after send. Send a fresh follow-up so
    // the recipient still sees the confirmation.
    if (!this.isEnabled()) return { ok: false, error: 'twilio channel disabled' };
    try {
      const client = await getTwilioClient() as any;
      const from = await getTwilioFromPhoneNumber();
      await client.messages.create({ body: text, to: ref.recipient, from });
      return { ok: true };
    } catch (err: any) {
      logger.warn('OpenClaw twilio follow-up failed', { error: err?.message });
      return { ok: false, error: err?.message ?? 'unknown' };
    }
  }
}

export const twilioChannel = new TwilioChannel();

/**
 * Parse an inbound Twilio message body for an action command.
 *
 * Recognised patterns (case-insensitive, leading/trailing whitespace OK):
 *   "approve <id>"  -> { actionId: 'approve', resourceId: '<id>' }
 *   "dismiss"       -> { actionId: 'dismiss' }
 *   "dismiss <id>"  -> { actionId: 'dismiss', resourceId: '<id>' }
 *   "rerun <id>"    -> { actionId: 'rerun',  resourceId: '<id>' }
 *
 * Returns null if the body doesn't match any known action verb.
 */
export function parseTwilioActionCommand(
  body: string,
): { actionId: string; resourceId?: string } | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  const verb = tokens[0].toLowerCase();
  const KNOWN = new Set(['approve', 'dismiss', 'rerun']);
  if (!KNOWN.has(verb)) return null;
  const rest = tokens.slice(1).join(' ').trim();
  return rest ? { actionId: verb, resourceId: rest } : { actionId: verb };
}
