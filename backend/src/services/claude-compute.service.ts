export async function computeFinancialModel(
  _dealId: string,
  _modelType?: string,
  _assumptions?: unknown,
  _forceRecompute?: boolean
): Promise<{ components: unknown[]; _cached?: boolean }> {
  throw new Error('Claude compute service not yet implemented');
}
