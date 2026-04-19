/**
 * @deprecated Research Agent — Legacy Entrypoint (Phase 3 Retirement)
 *
 * This file previously assembled DealContext packages by directly querying
 * external APIs (ArcGIS, RentCast, SpyFu, NewsAPI, etc.). As of Phase 3,
 * the Research Agent is executed via the AgentRuntime + Inngest durable
 * function pipeline:
 *   - Runtime config:  src/agents/research.config.ts
 *   - Inngest function: src/agents/research.inngest.ts
 *   - REST trigger:    POST /api/v1/agents/research/run
 *
 * This class is kept for backward compatibility with existing callers:
 *   - services/ai/coordinator.ts
 *   - services/orchestrator.service.ts
 *   - services/orchestrator/agent-delegator.ts
 *
 * All callers should migrate to `researchRuntime.run()` from research.config.ts.
 * The execute() stub below logs a deprecation warning and returns a zero-filled
 * DealContext skeleton so callers don't throw during migration.
 */

import { logger } from '../utils/logger';
import type {
  DealContext,
} from '../types/dealContext';

interface ResearchInput {
  address: string;
  coordinates?: { lat: number; lng: number };
  propertyId?: string;
  dealId?: string;
  userId: string;
  forceRefresh?: boolean;
}

/**
 * @deprecated Use `researchRuntime.run()` from `research.config.ts` instead.
 * Trigger via Inngest (deal.created) or REST API (POST /agents/research/run).
 */
export class ResearchAgent {
  /**
   * @deprecated Returns a zeroed-out skeleton and logs a migration warning.
   * Migrate to researchRuntime.run() for real AI-backed research execution.
   */
  async execute(input: ResearchInput): Promise<DealContext> {
    logger.warn(
      '[DEPRECATED] ResearchAgent.execute() called. ' +
      'Migrate callers to researchRuntime.run() (research.config.ts). ' +
      'Address: ' + input.address
    );

    const now = new Date().toISOString();
    return {
      requestId: crypto.randomUUID(),
      address: input.address,
      coordinates: input.coordinates ?? { lat: 0, lng: 0 },
      parcelId: input.propertyId ?? '',
      createdAt: now,
      parcel: {
        lotSizeSqFt: 0, lotSizeAcres: 0, assessedValue: 0,
        lastSaleDate: '', lastSalePrice: 0,
        ownerName: '', ownerType: 'entity', legalDescription: '',
      },
      zoning: {
        district: '', description: '', maxStories: 0, maxHeight: 0,
        maxDensity: 0, far: 0, maxBuildableUnits: 0, parkingRatio: 0,
        setbacks: { front: 0, side: 0, rear: 0 },
        overlays: [], floodZone: '', sourceUrl: '', confidence: 0,
      },
      market: {
        msa: '', submarket: '', avgRent: 0, avgRentPSF: 0,
        vacancyRate: 0, absorptionUnitsPerMonth: 0,
        daysOnMarket: 0, rentGrowthYoY: 0, concessionRate: 0,
      },
      comps: [],
      pipeline: {
        activePermits: 0, totalPipelineUnits: 0,
        nearestDeliveryDate: '', monthsOfPipelineSupply: 0,
      },
      demographics: {
        populationGrowthYoY: 0, medianHouseholdIncome: 0,
        employmentGrowthYoY: 0, topEmployers: [], netMigration: 0,
      },
      digital: {
        trafficIndex: 0, searchMomentum: 0,
        googleRatingAvg: 0, reviewVolume: 0,
      },
      news: [],
      macro: {
        fed30YrMortgageRate: 0, freddieMacPMMS: 0,
        msaUnemploymentRate: 0, cpiYoY: 0,
      },
      meta: {
        sourcesQueried: [],
        sourcesSucceeded: [],
        sourcesFailed: [],
        assemblyTimeMs: 0,
        dataFreshnessHours: 0,
        confidenceScore: 0,
      },
    };
  }

  async getMetricRecommendations(
    marketGeoIds: Array<{ geoType: string; geoId: string }>,
    userId: string,
    topN: number = 5
  ) {
    const { MetricRecommendationAgent } = await import('./metric-recommendation.agent');
    const agent = new MetricRecommendationAgent();
    return agent.execute({ marketGeoIds, topN }, userId);
  }
}

export const researchAgent = new ResearchAgent();
