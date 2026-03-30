import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { CorrelationEngineService } from '../services/correlationEngine.service';

export class MetricRecommendationAgent {
  async execute(inputData: any, userId: string): Promise<any> {
    logger.info('MetricRecommendationAgent executing...', { inputData, userId });

    try {
      const { marketGeoIds, topN } = inputData;

      if (!Array.isArray(marketGeoIds) || marketGeoIds.length === 0) {
        throw new Error('marketGeoIds array is required');
      }

      const pool = getPool();
      const engine = new CorrelationEngineService(pool);

      const recommendations = await engine.generateMetricRecommendations(
        marketGeoIds,
        userId,
        typeof topN === 'number' ? topN : 5
      );

      const summary = recommendations.length > 0
        ? `Found ${recommendations.length} metric recommendations. Top recommendation: ${recommendations[0].metricLabel} — ${recommendations[0].reason}`
        : 'No metric recommendations available. Ensure correlation data has been computed for your tracked markets.';

      return {
        success: true,
        summary,
        recommendations,
        marketCount: marketGeoIds.length,
        computedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('MetricRecommendationAgent error:', error);
      throw error;
    }
  }
}
