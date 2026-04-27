/**
 * Telegram channel adapter for OpenClaw notifications.
 *
 * Wraps the Telegram Bot API HTTP endpoints (sendMessage / editMessageText)
 * and renders structured NotificationActions as inline-keyboard buttons whose
 * `callback_data` is `ocl:<actionId>:<resourceId>`.
 */

import { logger } from '../../../utils/logger';
import type {
  MessageRef,
  Notification,
  NotificationChannel,
  SendResult,
} from '../types';

const TELEGRAM_API = 'https://api.telegram.org';

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

/**
 * Build a Telegram inline_keyboard payload from our NotificationAction list.
 * Each button gets `callback_data` of `ocl:<actionId>[:<resourceId>]` so the
 * inbound webhook handler can dispatch to the action handler.
 */
function buildInlineKeyboard(n: Notification): TelegramInlineKeyboard | undefined {
  if (!n.actions || n.actions.length === 0) return undefined;
  const buttons = n.actions.map((a) => ({
    text: a.label,
    callback_data: a.resourceId
      ? `ocl:${a.actionId}:${a.resourceId}`
      : `ocl:${a.actionId}`,
  }));
  // One row, one button per action — keeps small phones legible.
  return { inline_keyboard: buttons.map((b) => [b]) };
}

function renderText(n: Notification): string {
  const parts = [`*${n.title}*`, '', n.body];
  if (n.deepLink) parts.push('', `[Open in JediRe](${n.deepLink})`);
  return parts.join('\n');
}

class TelegramChannel implements NotificationChannel {
  readonly name = 'telegram' as const;

  isEnabled(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_NOTIFY_CHAT_ID);
  }

  isAuthorized(senderId: string): boolean {
    const allow = parseAllowlist(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
    // If no allowlist configured, fall back to the notification chat id.
    if (allow.size === 0 && process.env.TELEGRAM_NOTIFY_CHAT_ID) {
      return senderId === process.env.TELEGRAM_NOTIFY_CHAT_ID;
    }
    return allow.has(senderId);
  }

  async send(n: Notification): Promise<SendResult> {
    if (!this.isEnabled()) {
      return { ok: false, error: 'telegram channel disabled (missing TELEGRAM_BOT_TOKEN or TELEGRAM_NOTIFY_CHAT_ID)' };
    }

    const chatId = process.env.TELEGRAM_NOTIFY_CHAT_ID!;
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const text = renderText(n);
    const reply_markup = buildInlineKeyboard(n);

    try {
      const axios = (await import('axios')).default;
      // Try Markdown first for nicer rendering, then fall back to plain text
      // if the Telegram API rejects the payload (typically caused by stray
      // unbalanced `*`/`_`/`[` in dynamic body content).
      let resp;
      try {
        resp = await axios.post(`${TELEGRAM_API}/bot${token}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: reply_markup ? JSON.stringify(reply_markup) : undefined,
        });
      } catch (mdErr: unknown) {
        if (errHttpStatus(mdErr) === 400) {
          logger.warn('OpenClaw telegram markdown rejected — retrying as plain text', {
            kind: n.kind,
          });
          resp = await axios.post(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: stripMarkdown(text),
            disable_web_page_preview: true,
            reply_markup: reply_markup ? JSON.stringify(reply_markup) : undefined,
          });
        } else {
          throw mdErr;
        }
      }
      const data = resp?.data as { result?: { message_id?: number | string } } | undefined;
      const messageId = data?.result?.message_id;
      const ref: MessageRef = {
        channel: 'telegram',
        messageId: String(messageId ?? ''),
        recipient: chatId,
      };
      return { ok: true, refs: [ref] };
    } catch (err: unknown) {
      logger.warn('OpenClaw telegram send failed', {
        kind: n.kind,
        error: errMessage(err),
        status: errHttpStatus(err),
      });
      return { ok: false, error: errMessage(err) };
    }
  }

  async editMessage(ref: MessageRef, text: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.isEnabled()) return { ok: false, error: 'telegram channel disabled' };
    if (!ref.messageId) return { ok: false, error: 'missing messageId' };
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    try {
      const axios = (await import('axios')).default;
      try {
        await axios.post(`${TELEGRAM_API}/bot${token}/editMessageText`, {
          chat_id: ref.recipient,
          message_id: Number(ref.messageId),
          text,
          parse_mode: 'Markdown',
        });
      } catch (mdErr: unknown) {
        if (errHttpStatus(mdErr) === 400) {
          await axios.post(`${TELEGRAM_API}/bot${token}/editMessageText`, {
            chat_id: ref.recipient,
            message_id: Number(ref.messageId),
            text: stripMarkdown(text),
          });
        } else {
          throw mdErr;
        }
      }
      return { ok: true };
    } catch (err: unknown) {
      const m = errMessage(err);
      logger.warn('OpenClaw telegram edit failed', { error: m });
      return { ok: false, error: m };
    }
  }
}

/**
 * Strip Markdown control characters so unbalanced `*`/`_`/`[`/etc in
 * dynamic body content (deal names, error messages, etc) don't make
 * Telegram reject the message with HTTP 400 "can't parse entities".
 */
function stripMarkdown(s: string): string {
  return s.replace(/[*_`\[\]()~>#+=|{}!\\-]/g, '');
}

export const telegramChannel = new TelegramChannel();

/**
 * Send a free-text reply to a Telegram chat — used by the action dispatcher
 * for "not authorized" / unknown-action replies. Kept here so the inline-
 * keyboard rendering and reply transport live in one place.
 */
export async function sendTelegramText(chatId: string | number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const axios = (await import('axios')).default;
    await axios.post(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });
  } catch (err: unknown) {
    logger.warn('OpenClaw telegram text reply failed', { error: errMessage(err) });
  }
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'unknown';
}

function errHttpStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: unknown }).response;
    if (r && typeof r === 'object' && 'status' in r) {
      const s = (r as { status?: unknown }).status;
      if (typeof s === 'number') return s;
    }
  }
  return undefined;
}
