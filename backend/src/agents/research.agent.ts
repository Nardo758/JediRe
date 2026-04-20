/**
 * Research Agent — AgentRuntime Adapter (Phase 3 Refactor)
 *
 * This class is an adapter that routes legacy callers through the Phase 3
 * AgentRuntime execution path (research.config.ts + Inngest function).
 *
 * Previous implementation: directly queried external APIs (ArcGIS, RentCast,
 * SpyFu, etc.) inside execute(). That direct path is retired; this class now
 * delegates to `researchRuntime.run()` when a dealId is available.
 *
 * After the runtime run completes, `deal_context_fields` rows written by the
 * `write_dealcontext` tool are read and mapped back into the DealContext shape
 * so downstream callers (coordinator.ts, orchestrator.service.ts, etc.) receive
 * structured output without requiring immediate migration.
 *
 * When no dealId is provided (legacy callers), a zeroed skeleton is returned
 * and a warning is logged pointing to the migration path.
 *
 * Migration path for callers:
 *   Pass `dealId` in `ResearchInput`, or trigger directly via
 *   `researchRuntime.run()` from research.config.ts.
 */

import { logger } from '../utils/logger';
import { query } from '../database/connection';
import { researchRuntime, type ResearchOutput } from './research.config';
import type { RunContext } from './runtime/types';
import type { DealContext } from '../types/dealContext';

export interface ResearchInput {
  address: string;
  coordinates?: { lat: number; lng: number };
  propertyId?: string;
  /** Required for AgentRuntime execution path. Legacy callers omitting this
   *  receive a zeroed skeleton; provide dealId to enable real execution. */
  dealId?: string;
  userId: string;
  forceRefresh?: boolean;
}

export class ResearchAgent {
  /**
   * Execute research for a deal.
   *
   * When `input.dealId` is provided, delegates to `researchRuntime.run()`:
   *   1. Runs the AI-backed tool-calling loop (fetch_parcel, fetch_ownership,
   *      fetch_tax_bill, fetch_comps, fetch_costar_metrics, write_dealcontext)
   *   2. Reads deal_context_fields written by write_dealcontext tool
   *   3. Maps fields back into the DealContext shape
   *
   * When `input.dealId` is absent, logs a warning and returns a zeroed skeleton.
   */
  async execute(input: ResearchInput): Promise<DealContext> {
    const now = new Date().toISOString();

    if (!input.dealId) {
      logger.warn(
        '[ResearchAgent] execute() called without dealId — cannot use AgentRuntime path. ' +
        'Pass dealId in ResearchInput to enable real research execution. ' +
        'Address: ' + input.address
      );
      return this.defaultContext(input, now);
    }

    const ctx: RunContext = {
      dealId: input.dealId,
      userId: input.userId,
      triggeredBy: 'user',
      triggerContext: {
        source: 'legacy_adapter',
        address: input.address,
        property_id: input.propertyId,
      },
    };

    try {
      // Execute via AgentRuntime — the authoritative Phase 3 execution path.
      // Tools (fetch_parcel, fetch_ownership, write_dealcontext, etc.) run under the
      // research agent's service-account identity (platformClient.as({ agentId: 'research' })).
      const output = await researchRuntime.run(
        {
          deal_id: input.dealId,
          address: input.address,
          ...(input.propertyId && { property_id: input.propertyId }),
        },
        ctx
      ) as ResearchOutput;

      // Read deal_context_fields written by write_dealcontext during this run.
      // Map recognized paths back into the DealContext shape for caller compat.
      const fieldsResult = await query(
        `SELECT field_path, value FROM deal_context_fields
         WHERE deal_id = $1
         ORDER BY updated_at DESC`,
        [input.dealId]
      );

      const fieldMap: Record<string, unknown> = {};
      for (const row of fieldsResult.rows) {
        fieldMap[row.field_path as string] = row.value;
      }

      const ctx2 = this.defaultContext(input, now);
      // Populate runtime-generated confidence and fields into meta
      ctx2.meta.confidenceScore = output.confidence_score ?? 0;
      ctx2.meta.sourcesSucceeded = output.fields_written ?? [];
      ctx2.meta.assemblyTimeMs = Date.now() - new Date(now).getTime();

      // Map dot-path field entries written by write_dealcontext tool back into
      // DealContext fields. Prompt uses snake_case paths (market.vacancy_rate);
      // DealContext uses camelCase (market.vacancyRate). Translate both.
      // Cast through unknown to avoid TS "insufficient overlap" on index signature.
      const ctx2Obj = ctx2 as unknown as Record<string, unknown>;
      for (const [path, value] of Object.entries(fieldMap)) {
        const resolved = resolveFieldName(path);
        if (!resolved) continue;
        const { section, field } = resolved;
        const target = ctx2Obj[section];
        if (target && typeof target === 'object' && field) {
          (target as Record<string, unknown>)[field] = value;
        }
      }

      logger.info('[ResearchAgent] execute() completed via AgentRuntime', {
        dealId: input.dealId,
        confidenceScore: output.confidence_score,
        fieldsWritten: output.fields_written?.length ?? 0,
      });

      return ctx2;
    } catch (err) {
      logger.error('[ResearchAgent] execute(): runtime run failed, returning default context', {
        dealId: input.dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return this.defaultContext(input, now);
    }
  }

  async getMetricRecommendations(
    marketGeoIds: Array<{ geoType: string; geoId: string }>,
    userId: string,
    topN: number = 5
  ) {
    const { MetricRecommendationService } = await import('../services/metricRecommendation.service');
    const svc = new MetricRecommendationService();
    return svc.execute({ marketGeoIds, topN }, userId);
  }

  // ── Default/fallback context ────────────────────────────────────

  private defaultContext(input: ResearchInput, now: string): DealContext {
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
}

export const researchAgent = new ResearchAgent();

// ── Utilities ────────────────────────────────────────────────────

/** Convert snake_case field name to camelCase: vacancy_rate → vacancyRate */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Deterministic translation from tool/prompt field paths to DealContext keys.
 * The LLM writes paths in snake_case (market.vacancy_rate) which snakeToCamel
 * converts automatically. Only add entries here for paths that rename the field
 * entirely (not just casing), e.g. parcel.sqft → parcel.lotSizeSqFt.
 * Format: "<section>.<snake_field>" → "<camelCaseField>"
 */
const FIELD_PATH_ALIASES: Record<string, string> = {
  'parcel.sqft':          'lotSizeSqFt',
  'parcel.sq_ft':         'lotSizeSqFt',
  'parcel.total_sqft':    'lotSizeSqFt',
  'parcel.acres':         'lotSizeAcres',
  'parcel.lot_acres':     'lotSizeAcres',
  'parcel.lot_size_sqft': 'lotSizeSqFt',
  'parcel.building_sqft': 'buildingSqFt',
  'parcel.bldg_sqft':     'buildingSqFt',
  'parcel.last_sale':     'lastSalePrice',
  'parcel.sale_price':    'lastSalePrice',
};

/**
 * Resolve a "section.snake_field" path to the canonical DealContext field name.
 * Checks FIELD_PATH_ALIASES first, then falls back to snakeToCamel conversion.
 */
function resolveFieldName(dotPath: string): { section: string; field: string } | null {
  const dotIdx = dotPath.indexOf('.');
  if (dotIdx === -1) return null;
  const section = dotPath.slice(0, dotIdx);
  const alias = FIELD_PATH_ALIASES[dotPath];
  if (alias) return { section, field: alias };
  return { section, field: snakeToCamel(dotPath.slice(dotIdx + 1)) };
}
