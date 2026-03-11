/**
 * P0 Service Adapters
 *
 * Connects existing JEDI RE services to the module wiring infrastructure.
 * Each adapter wraps an existing service singleton, calling its methods and
 * publishing outputs through the Data Flow Router and Event Bus.
 *
 * Wiring Priority:
 *   P0-1: M25 JEDI Score → M01 Overview
 *   P0-2: M19 News → M06 Demand + M04 Supply
 *   P0-3: M02 Zoning → M03 Dev Cap → M08 Strategy
 *   P0-4: M04 Supply + M06 Demand → M14 Risk
 *   P0-5: M08 Strategy Arbitrage Engine (all signals)
 */

import { dataFlowRouter } from './data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-event-bus';
import { strategyArbitrageEngine } from './strategy-arbitrage-engine';
import { executeFormula } from './formula-engine';
import { logger } from '../../utils/logger';

// Lazy-loaded service imports to avoid circular dependencies
function getJediScoreService() {
  return require('../jedi-score.service').jediScoreService;
}
function getDemandSignalService() {
  return require('../demand-signal.service').demandSignalService;
}
function getSupplySignalService() {
  return require('../supply-signal.service').supplySignalService;
}
function getRiskScoringService() {
  return require('../risk-scoring.service').riskScoringService;
}

// ============================================================================
// P0-1: M25 JEDI Score → M01 Overview
// ============================================================================

/**
 * Calculate JEDI Score for a deal and publish to the data flow router.
 * Downstream: M01 Overview, M20 Map, M23 Alerts
 */
export async function wireJediScore(dealId: string, triggerType?: string): Promise<void> {
  try {
    const jediScoreService = getJediScoreService();

    // Get previous score
    const previousScore = await jediScoreService.getLatestScore(dealId);
    const previousTotal = previousScore?.totalScore;

    // Calculate new score
    const score = await jediScoreService.calculateScore({
      dealId,
      triggerType: triggerType || 'manual_recalc',
    });

    // Save to history
    await jediScoreService.saveScore(
      { dealId, triggerType: triggerType || 'manual_recalc' },
      score,
      previousTotal,
    );

    const scoreDelta = previousTotal != null ? score.totalScore - previousTotal : 0;

    // Publish M25 outputs to data flow router
    dataFlowRouter.publishModuleData('M25', dealId, {
      jedi_score: score.totalScore,
      sub_scores: {
        demand: score.demandScore,
        supply: score.supplyScore,
        momentum: score.momentumScore,
        position: score.positionScore,
        risk: score.riskScore,
      },
      score_delta: scoreDelta,
      confidence_level: 70, // Will improve as more modules contribute data
    });

    // Emit score change event if significant
    if (Math.abs(scoreDelta) >= 2) {
      moduleEventBus.emit({
        type: ModuleEventType.SCORE_CHANGED,
        sourceModule: 'M25',
        dealId,
        data: {
          new_score: score.totalScore,
          previous_score: previousTotal,
          score_delta: scoreDelta,
          sub_scores: {
            demand: score.demandScore,
            supply: score.supplyScore,
            momentum: score.momentumScore,
            position: score.positionScore,
            risk: score.riskScore,
          },
        },
        timestamp: new Date(),
      });
    }

    logger.info('[P0-1] JEDI Score wired', {
      dealId,
      score: score.totalScore,
      delta: scoreDelta,
    });
  } catch (error) {
    logger.error('[P0-1] JEDI Score wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P0-2: M19 News → M06 Demand + M04 Supply
// ============================================================================

/**
 * Process a classified news event and route to demand/supply services.
 * Called when the news extraction service classifies an article.
 */
export async function wireNewsToSignals(
  dealId: string,
  newsEvent: {
    id: string;
    category: string;
    eventType: string;
    headline: string;
    sourceUrl?: string;
    publishedAt: Date;
    peopleCount?: number;
    units?: number;
    incomeTier?: string;
    latitude?: number;
    longitude?: number;
    msaId?: number;
    submarketId?: number;
    sentiment?: number;
  },
): Promise<void> {
  try {
    // Publish news classification to M19
    dataFlowRouter.publishModuleData('M19', dealId, {
      classified_events: [newsEvent],
      sentiment_score: newsEvent.sentiment ?? 0,
    });

    // Route demand-type events to M06
    const demandCategories = ['employment', 'university', 'military', 'migration'];
    if (demandCategories.includes(newsEvent.category) && newsEvent.peopleCount) {
      const demandSignalService = getDemandSignalService();

      const demandEvent = await demandSignalService.createDemandEvent({
        newsEventId: newsEvent.id,
        headline: newsEvent.headline,
        sourceUrl: newsEvent.sourceUrl,
        publishedAt: newsEvent.publishedAt,
        category: newsEvent.category as any,
        eventType: newsEvent.eventType,
        peopleCount: newsEvent.peopleCount,
        incomeTier: newsEvent.incomeTier as any,
        msaId: newsEvent.msaId,
        submarketId: newsEvent.submarketId,
      });

      // Publish M06 outputs
      dataFlowRouter.publishModuleData('M06', dealId, {
        demand_units_total: demandEvent.totalUnits,
        demand_score: demandEvent.confidenceScore,
        employer_concentration_risk: 0, // Calculated separately
        classified_demand_events: [newsEvent],
      });

      // Publish M19 demand classification
      dataFlowRouter.publishModuleData('M19', dealId, {
        classified_demand_events: [newsEvent],
      });

      logger.info('[P0-2] News → Demand wired', {
        dealId,
        eventId: newsEvent.id,
        units: demandEvent.totalUnits,
      });
    }

    // Route supply-type events to M04
    const supplyCategories = ['development', 'construction', 'permit', 'demolition'];
    if (supplyCategories.includes(newsEvent.category) && newsEvent.units) {
      const supplySignalService = getSupplySignalService();

      const statusMap: Record<string, any> = {
        permit: 'permitted',
        construction: 'under_construction',
        development: 'permitted',
        demolition: 'demolished',
      };

      const supplyEvent = await supplySignalService.createSupplyEvent({
        category: newsEvent.category === 'construction' ? 'construction' : 'permit',
        eventType: newsEvent.eventType,
        units: newsEvent.units,
        eventDate: newsEvent.publishedAt,
        status: statusMap[newsEvent.category] || 'permitted',
        latitude: newsEvent.latitude,
        longitude: newsEvent.longitude,
        msaId: newsEvent.msaId,
        submarketId: newsEvent.submarketId,
        newsEventId: newsEvent.id,
        sourceType: 'news',
        sourceUrl: newsEvent.sourceUrl,
      });

      // Publish M04 outputs
      dataFlowRouter.publishModuleData('M04', dealId, {
        pipeline_units_by_status: { [supplyEvent.status]: supplyEvent.units },
        supply_pressure_score: 0, // Recalculated via cascade
        classified_supply_events: [newsEvent],
      });

      // Publish M19 supply classification
      dataFlowRouter.publishModuleData('M19', dealId, {
        classified_supply_events: [newsEvent],
      });

      logger.info('[P0-2] News → Supply wired', {
        dealId,
        eventId: newsEvent.id,
        units: newsEvent.units,
      });
    }

    // Emit news classified event to trigger downstream cascades
    moduleEventBus.emit({
      type: ModuleEventType.NEWS_CLASSIFIED,
      sourceModule: 'M19',
      dealId,
      data: { events: [newsEvent] },
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('[P0-2] News → Signals wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P0-3: M02 Zoning → M03 Dev Cap → M08 Strategy
// ============================================================================

/**
 * Wire zoning data through development capacity to strategy analysis.
 * Called when zoning data is available/updated for a deal.
 */
export async function wireZoningToStrategy(
  dealId: string,
  zoningData: {
    zoningCode: string;
    far: number;
    setbacks: { front: number; side: number; rear: number };
    maxDensity: number;
    maxHeight?: number;
    landArea: number;
    currentUnits: number;
    entitlementRiskScore?: number;
  },
): Promise<void> {
  try {
    // Publish M02 Zoning outputs
    dataFlowRouter.publishModuleData('M02', dealId, {
      zoning_code: zoningData.zoningCode,
      far: zoningData.far,
      setbacks: zoningData.setbacks,
      max_density: zoningData.maxDensity,
      entitlement_risk_score: zoningData.entitlementRiskScore ?? 50,
      zoning_utilization_pct: executeFormula('F13', {
        current_units: zoningData.currentUnits,
        land_area_acres: zoningData.landArea / 43560, // sqft to acres
        max_density_per_acre: zoningData.maxDensity,
      }),
    });

    // Calculate M03 Dev Cap — building envelope
    const envelope = executeFormula('F14', {
      land_area: zoningData.landArea,
      setbacks: zoningData.setbacks,
      far: zoningData.far,
      max_height: zoningData.maxHeight,
      avg_unit_size: 850,
      parking_ratio: 1.0,
    });

    // Get supply pipeline data for gap calculation
    const supplyData = dataFlowRouter.getModuleData('M04', dealId);
    const pipelineUnits = supplyData?.data?.pipeline_units_by_status
      ? Object.values(supplyData.data.pipeline_units_by_status as Record<string, number>).reduce((a, b) => a + b, 0)
      : 0;

    const capacityGap = executeFormula('F15', {
      max_buildable_units: envelope.max_units,
      existing_units: zoningData.currentUnits,
      projected_annual_demand: 0, // Will be filled by M06 demand data
      pipeline_units: pipelineUnits,
    });

    // Publish M03 Dev Cap outputs
    dataFlowRouter.publishModuleData('M03', dealId, {
      max_units_by_right: envelope.max_units,
      envelope_dimensions: envelope,
      scenario_comparison: [
        { type: 'as_of_right', ...envelope },
      ],
      ten_year_supply_gap: capacityGap.ten_year_supply_gap,
    });

    // Run M08 Strategy Arbitrage analysis
    const arbResult = await strategyArbitrageEngine.analyze(dealId);

    logger.info('[P0-3] Zoning → Dev Cap → Strategy wired', {
      dealId,
      maxUnits: envelope.max_units,
      recommended: arbResult.recommended,
      arbitrage: arbResult.arbitrageFlag,
    });
  } catch (error) {
    logger.error('[P0-3] Zoning → Strategy wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P0-4: M04 Supply + M06 Demand → M14 Risk
// ============================================================================

/**
 * Wire supply and demand signals into the risk dashboard.
 * Called when supply or demand data changes for a deal's trade area.
 */
export async function wireSignalsToRisk(dealId: string, tradeAreaId: string): Promise<void> {
  try {
    const riskScoringService = getRiskScoringService();

    // Calculate supply risk
    const supplyRisk = await riskScoringService.calculateSupplyRisk(tradeAreaId);

    // Calculate demand risk
    const demandRisk = await riskScoringService.calculateDemandRisk(tradeAreaId);

    // Calculate composite risk
    const compositeRisk = await riskScoringService.calculateCompositeRisk(tradeAreaId);

    // Publish M14 Risk outputs
    dataFlowRouter.publishModuleData('M14', dealId, {
      composite_risk_score: compositeRisk.compositeScore,
      risk_heatmap: {
        supply: compositeRisk.supplyRisk,
        demand: compositeRisk.demandRisk,
        regulatory: compositeRisk.regulatoryRisk,
        market: compositeRisk.marketRisk,
        execution: compositeRisk.executionRisk,
        climate: compositeRisk.climateRisk,
      },
      risk_trend: 'stable', // TODO: compare with previous calculation
      alert_triggers: [],
    });

    // Emit risk alert if threshold breached
    if (compositeRisk.compositeScore >= 70) {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M14',
        dealId,
        data: {
          composite_score: compositeRisk.compositeScore,
          risk_level: compositeRisk.riskLevel,
          highest_category: compositeRisk.highestCategory,
          highest_score: compositeRisk.highestCategoryScore,
        },
        timestamp: new Date(),
      });
    }

    logger.info('[P0-4] Supply + Demand → Risk wired', {
      dealId,
      tradeAreaId,
      compositeScore: compositeRisk.compositeScore,
      riskLevel: compositeRisk.riskLevel,
    });
  } catch (error) {
    logger.error('[P0-4] Signals → Risk wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P0-5: All signals → M08 Strategy Arbitrage
// ============================================================================

/**
 * Run the full strategy arbitrage analysis with all available signal data.
 * Gathers data from M02-M07 via the data flow router.
 */
export async function wireStrategyArbitrage(dealId: string): Promise<void> {
  try {
    const result = await strategyArbitrageEngine.analyze(dealId);

    logger.info('[P0-5] Strategy Arbitrage wired', {
      dealId,
      recommended: result.recommended,
      recommendedScore: result.recommendedScore,
      arbitrage: result.arbitrageFlag,
      delta: result.arbitrageDelta,
    });
  } catch (error) {
    logger.error('[P0-5] Strategy Arbitrage wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Full P0 Pipeline: Wire everything for a deal
// ============================================================================

/**
 * Execute the full P0 wiring pipeline for a deal.
 * Runs in dependency order: News → Demand/Supply → Risk → Strategy → Score → Overview
 */
export async function wireP0Pipeline(
  dealId: string,
  options?: {
    tradeAreaId?: string;
    zoningData?: Parameters<typeof wireZoningToStrategy>[1];
    newsEvents?: Parameters<typeof wireNewsToSignals>[1][];
  },
): Promise<{
  modulesWired: string[];
  jediScore?: number;
  recommended?: string;
  riskLevel?: string;
}> {
  const modulesWired: string[] = [];

  try {
    // Step 1: Process any news events (P0-2: M19 → M06 + M04)
    if (options?.newsEvents) {
      for (const event of options.newsEvents) {
        await wireNewsToSignals(dealId, event);
      }
      modulesWired.push('M19', 'M06', 'M04');
    }

    // Step 2: Wire zoning → dev cap → strategy (P0-3: M02 → M03 → M08)
    if (options?.zoningData) {
      await wireZoningToStrategy(dealId, options.zoningData);
      modulesWired.push('M02', 'M03', 'M08');
    }

    // Step 3: Wire supply + demand → risk (P0-4: M04 + M06 → M14)
    if (options?.tradeAreaId) {
      await wireSignalsToRisk(dealId, options.tradeAreaId);
      modulesWired.push('M14');
    }

    // Step 4: Run strategy arbitrage with all available data (P0-5)
    await wireStrategyArbitrage(dealId);
    if (!modulesWired.includes('M08')) modulesWired.push('M08');

    // Step 5: Calculate JEDI Score (P0-1: M25 → M01)
    await wireJediScore(dealId, 'pipeline_wiring');
    modulesWired.push('M25', 'M01');

    // Gather results
    const scoreData = dataFlowRouter.getModuleData('M25', dealId);
    const strategyData = dataFlowRouter.getModuleData('M08', dealId);
    const riskData = dataFlowRouter.getModuleData('M14', dealId);

    logger.info('[P0] Full pipeline wired', {
      dealId,
      modulesWired,
      score: scoreData?.data?.jedi_score,
    });

    return {
      modulesWired: [...new Set(modulesWired)],
      jediScore: scoreData?.data?.jedi_score,
      recommended: strategyData?.data?.recommended_strategy,
      riskLevel: riskData?.data?.risk_heatmap ? 'calculated' : undefined,
    };
  } catch (error) {
    logger.error('[P0] Pipeline wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Event Bus Subscriptions (auto-cascade wiring)
// ============================================================================

/**
 * Set up automatic cascade subscriptions so that when upstream data changes,
 * downstream modules automatically recalculate.
 */
export function setupP0Subscriptions(): void {
  // When M06 Demand or M04 Supply data updates → recalculate M14 Risk
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M06' || event.sourceModule === 'M04') {
      // Debounce to avoid recalculating risk on every single event
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M14',
        dealId: event.dealId,
        timestamp: new Date(),
      }, `risk-recalc:${event.dealId}`);
    }
  });

  // When M14 Risk updates → recalculate M25 JEDI Score
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M14') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M25',
        dealId: event.dealId,
        timestamp: new Date(),
      }, `score-recalc:${event.dealId}`);
    }
  });

  // When M02 Zoning updates → recalculate M03 Dev Cap → M08 Strategy
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M02') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M03',
        dealId: event.dealId,
        timestamp: new Date(),
      }, `devcap-recalc:${event.dealId}`);
    }
  });

  // When M08 Strategy updates → recalculate M25 JEDI Score
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M08') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M25',
        dealId: event.dealId,
        timestamp: new Date(),
      }, `score-recalc:${event.dealId}`);
    }
  });

  // When M19 News classifies events → route to M06/M04
  moduleEventBus.on(ModuleEventType.NEWS_CLASSIFIED, async (event) => {
    logger.info('[Auto-cascade] News classified, routing to demand/supply', {
      dealId: event.dealId,
      eventCount: event.data?.events?.length,
    });
  });

  logger.info('P0 auto-cascade subscriptions initialized');
}
