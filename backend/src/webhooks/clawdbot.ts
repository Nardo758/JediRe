/**
 * Clawdbot webhook — replaced with Telegram notifier.
 * 
 * Retains the same interface so existing call sites work.
 * When TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set, events
 * are forwarded to Telegram instead of the old ClawdBot endpoint.
 */

import { telegramNotifier } from '../services/telegram-notifier.service';

interface ErrorContext {
  url: string;
  method: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  statusCode: number;
}

const clawdbotWebhook = {
  isEnabled(): boolean {
    return telegramNotifier.isEnabled();
  },

  async sendDealCreated(deal: {
    id: string;
    name: string;
    city?: string;
    state?: string;
    units?: number;
    askingPrice?: number;
    url?: string;
  }): Promise<void> {
    if (!this.isEnabled()) return;
    await telegramNotifier.dealCreated({
      name: deal.name,
      city: deal.city,
      state: deal.state,
      units: deal.units,
      askingPrice: deal.askingPrice,
      dealId: deal.id,
    });
  },

  async sendAnalysisComplete(dealId: string, analysis: { score?: number; verdict?: string; summary?: string }): Promise<void> {
    if (!this.isEnabled()) return;
    await telegramNotifier.agentCompleted({
      agentName: 'Strategy Analysis',
      dealName: analysis.summary?.slice(0, 80) || `Deal ${dealId.slice(0, 8)}`,
      dealId,
      status: 'completed',
      summary: analysis.summary,
    });
  },

  async sendDocumentProcessed(params: {
    dealId: string;
    dealName: string;
    filename: string;
    category: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    if (!this.isEnabled()) return;
    await telegramNotifier.documentProcessed(params);
  },

  async sendErrorNotification(_err: Error, _ctx: ErrorContext): Promise<void> {
    if (!this.isEnabled()) return;
    await telegramNotifier.alert(
      `⚠️ *Platform Error*\n\`${esc(_err.message?.slice(0, 200)) || 'Unknown'}\``
    );
  },
};

function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export { clawdbotWebhook };
