/**
 * @deprecated MetricRecommendationAgent has been reclassified as a service.
 *
 * Per the Agent Taxonomy & Layers spec, MetricRecommendation is NOT a Layer 1 agent:
 * it has no tool-calling loop, no AgentRuntime, and no service account.
 *
 * Use MetricRecommendationService from '../services/metricRecommendation.service' instead.
 * This shim exists only for backward compatibility during migration.
 */

export { MetricRecommendationService as MetricRecommendationAgent } from '../services/metricRecommendation.service';
