/**
 * Telegram Notifier Service
 * 
 * Sends real-time platform events to the user's Telegram chat.
 * Replaces the ClawdBot webhook stub with direct Telegram API calls.
 * 
 * Env vars (set in Replit Secrets):
 *   TELEGRAM_BOT_TOKEN  — Bot token from @BotFather
 *   TELEGRAM_CHAT_ID    — Chat ID to send messages to
 * 
 * @version 1.0.0
 * @date 2026-04-27
 */

import { logger } from '../utils/logger';

const TELEGRAM_API = 'https://api.telegram.org';

interface MessagePayload {
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  disable_notification?: boolean;
}

function isEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function chatId(): string {
  return process.env.TELEGRAM_CHAT_ID || '';
}

async function sendRaw(payload: MessagePayload): Promise<void> {
  if (!isEnabled()) return;

  try {
    const url = `${TELEGRAM_API}/bot${botToken()}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId(),
        text: payload.text,
        parse_mode: payload.parse_mode || 'MarkdownV2',
        disable_notification: payload.disable_notification ?? false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn('[TelegramNotifier] send failed', { status: res.status, body });
    }
  } catch (err: any) {
    logger.warn('[TelegramNotifier] send threw', { error: err?.message });
  }
}

// ── Escape MarkdownV2 reserved characters ──────────────────────────────
function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// ── Public API ─────────────────────────────────────────────────────────

export const telegramNotifier = {
  isEnabled,

  /** Deal was created */
  async dealCreated(deal: {
    name: string;
    city?: string;
    state?: string;
    units?: number;
    askingPrice?: number;
    dealId: string;
  }): Promise<void> {
    const price = deal.askingPrice
      ? `$${(deal.askingPrice / 1_000_000).toFixed(1)}M`
      : '—';
    const loc = [deal.city, deal.state].filter(Boolean).join(', ') || '—';
    const units = deal.units ? `${deal.units} units` : '—';

    await sendRaw({
      text: [
        `🏢 *New Deal Created*`,
        ``,
        `*${esc(deal.name)}*`,
        `📍 ${esc(loc)} · ${esc(units)} · 💰 ${esc(price)}`,
        ``,
        `[Open in JediRe](https://jedi-re.replit.app/deals/${deal.dealId})`,
      ].join('\n'),
      parse_mode: 'MarkdownV2',
    });
  },

  /** Document was uploaded and extracted */
  async documentProcessed(params: {
    dealName: string;
    dealId: string;
    filename: string;
    category: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    const icon = params.success ? '✅' : '❌';
    const status = params.success ? 'Extracted successfully' : `Failed: ${params.error || 'unknown'}`;
    const link = `https://jedi-re.replit.app/deals/${params.dealId}`;

    await sendRaw({
      text: [
        `${icon} *Document ${params.success ? 'Processed' : 'Failed'}*`,
        ``,
        `📄 ${esc(params.filename)}`,
        `🏷️  ${esc(params.category)}`,
        `📋 ${esc(status)}`,
        `🔗 [View Deal](${link})`,
      ].join('\n'),
      parse_mode: 'MarkdownV2',
    });
  },

  /** Agent completed */
  async agentCompleted(params: {
    agentName: string;
    dealName: string;
    dealId: string;
    status: 'completed' | 'failed';
    summary?: string;
  }): Promise<void> {
    const icon = params.status === 'completed' ? '🧠' : '⚠️';
    const link = `https://jedi-re.replit.app/deals/${params.dealId}`;

    const msg = [
      `${icon} *Agent ${params.agentName}* \`${params.status.toUpperCase()}\``,
      ``,
      `📊 ${esc(params.dealName)}`,
      params.summary ? `💡 ${esc(params.summary.slice(0, 200))}` : null,
      `🔗 [View Deal](${link})`,
    ].filter(Boolean).join('\n');

    await sendRaw({
      text: msg,
      parse_mode: 'MarkdownV2',
    });
  },

  /** Morning brief */
  async morningBrief(summary: string): Promise<void> {
    await sendRaw({
      text: `🌅 *Morning Brief*\n\n${esc(summary)}`,
      parse_mode: 'MarkdownV2',
    });
  },

  /** Simple text alert (for errors, milestones, etc.) */
  async alert(text: string, link?: string): Promise<void> {
    const msg = link ? `${text}\n\n🔗 ${link}` : text;
    await sendRaw({
      text: msg,
      parse_mode: 'MarkdownV2',
    });
  },

  /** Test connection */
  async test(): Promise<boolean> {
    if (!isEnabled()) return false;
    try {
      await sendRaw({
        text: '🔌 *JediRe Telegram Notifier Connected*',
        parse_mode: 'MarkdownV2',
        disable_notification: true,
      });
      return true;
    } catch {
      return false;
    }
  },
};

export default telegramNotifier;
