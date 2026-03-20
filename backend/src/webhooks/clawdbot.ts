export const clawdbotWebhook = {
  isEnabled(): boolean {
    return false;
  },
  async sendErrorNotification(
    _err: unknown,
    _context: Record<string, unknown>
  ): Promise<void> {
    // Stub — webhook not configured
  },
};
