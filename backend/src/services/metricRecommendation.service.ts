/**
 * MetricRecommendation Service
 *
 * Reclassified from src/agents/metric-recommendation.agent.ts per the
 * Agent Taxonomy & Layers spec. This is NOT a Layer 1 agent:
 * - No tool-calling loop
 * - No AgentRuntime
 * - No service account or prompt_versions entry
 * - Single LLM-optional retrieval + ranking over a fixed metric catalog
 *
 * Lives in src/services/, not src/agents/.
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { CorrelationEngineService } from './correlationEngine.service';

export interface MetricRecommendationInput {
  marketGeoIds: Array<{ geoType: string; geoId: string }>;
  topN?: number;
}

export interface MetricRecommendationResult {
  success: boolean;
  summary: string;
  recommendations: Array<Record<string, unknown>>;
  marketCount: number;
  computedAt: string;
}

export class MetricRecommendationService {
  async execute(
    inputData: MetricRecommendationInput,
    userId: string
  ): Promise<MetricRecommendationResult> {
    logger.info('MetricRecommendationService executing...', { inputData, userId });

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

      const summary =
        recommendations.length > 0
          ? `Found ${recommendations.length} metric recommendations. Top recommendation: ${recommendations[0].metricLabel} — ${recommendations[0].reason}`
          : 'No metric recommendations available. Ensure correlation data has been computed for your tracked markets.';

      return {
        success: true,
        summary,
        recommendations: recommendations as unknown as Record<string, unknown>[],
        marketCount: marketGeoIds.length,
        computedAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      logger.error('MetricRecommendationService error:', error);
      throw error;
    }
  }
}

export const metricRecommendationService = new MetricRecommendationService();
