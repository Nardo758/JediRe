/**
 * Clawdbot webhook stub — no-op implementation.
 * Replace with real webhook config when Clawdbot is provisioned.
 */

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
    return Boolean(process.env.CLAWDBOT_WEBHOOK_URL);
  },

  async sendErrorNotification(_err: Error, _ctx: ErrorContext): Promise<void> {
    if (!this.isEnabled()) return;
    // Webhook integration not yet implemented
  },
};

export { clawdbotWebhook };
