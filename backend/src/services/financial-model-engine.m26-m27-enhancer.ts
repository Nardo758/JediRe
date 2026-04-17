export const m26m27ProFormaEnhancer = {
  async enhanceAssumptions(_dealId: string, assumptions: unknown): Promise<unknown> {
    return assumptions;
  },
  getEnhancementSummary(_enhanced: unknown): Record<string, unknown> {
    return {};
  },
};
