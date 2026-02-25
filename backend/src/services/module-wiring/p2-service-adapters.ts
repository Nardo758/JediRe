/**
 * P2 Service Adapters
 *
 * Connects P2-priority JEDI RE services to the module wiring infrastructure.
 * Each adapter wraps existing service singletons and publishes outputs
 * through the Data Flow Router and Event Bus.
 *
 * Wiring Priority:
 *   P2-1: M07 Traffic Intelligence (physical + digital traffic → lease prediction)
 *   P2-2: M12 Exit Analysis (exit timing optimization, disposition strategy)
 *   P2-3: M22 Portfolio + Actuals (actual vs projected, portfolio-level metrics)
 */

import { dataFlowRouter } from './data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-event-bus';
import { executeFormula } from './formula-engine';
import { logger } from '../../utils/logger';

// Lazy-loaded service imports to avoid circular dependencies
function getTrafficPredictionEngine() {
  return require('../trafficPredictionEngine').default;
}
function getLeasingTrafficService() {
  return require('../leasingTrafficService').default;
}
function getDigitalTrafficService() {
  // DigitalTrafficService requires a Pool instance; lazily construct
  const { DigitalTrafficService } = require('../digitalTrafficService');
  const { pool } = require('../../database');
  return new DigitalTrafficService(pool);
}
function getPropertyMetricsService() {
  const { PropertyMetricsService } = require('../propertyMetrics.service');
  const { pool } = require('../../database');
  return new PropertyMetricsService(pool);
}

// ============================================================================
// P2-1: M07 Traffic Intelligence
// ============================================================================

/**
 * Wire traffic intelligence for a property.
 * Combines physical foot traffic, digital engagement, and leasing predictions.
 * Downstream: M05 Market, M08 Strategy, M09 ProForma
 */
export async function wireTrafficIntelligence(
  dealId: string,
  propertyId: string,
): Promise<void> {
  try {
    const trafficEngine = getTrafficPredictionEngine();
    const leasingService = getLeasingTrafficService();

    // Get physical traffic prediction
    let physicalTraffic = null;
    try {
      physicalTraffic = await trafficEngine.predictTraffic(propertyId);
    } catch (err) {
      logger.warn('[P2-1] Physical traffic prediction unavailable', {
        propertyId,
        error: (err as Error).message,
      });
    }

    // Get leasing traffic prediction
    let leasingTraffic = null;
    try {
      leasingTraffic = await leasingService.predictCurrentWeek(propertyId);
    } catch (err) {
      logger.warn('[P2-1] Leasing traffic prediction unavailable', {
        propertyId,
        error: (err as Error).message,
      });
    }

    // Get digital traffic score
    let digitalScore = null;
    try {
      const digitalService = getDigitalTrafficService();
      digitalScore = await digitalService.calculateDigitalScore(propertyId);
    } catch (err) {
      logger.warn('[P2-1] Digital traffic score unavailable', {
        propertyId,
        error: (err as Error).message,
      });
    }

    // Execute F28: Traffic-to-Lease Prediction
    const trafficToLease = executeFormula('F28', {
      daily_drive_bys: physicalTraffic?.daily_average || 0,
      weekly_web_visits: digitalScore?.weekly_views || 0,
      monthly_search_volume: (digitalScore?.weekly_views || 0) * 4,
    });

    // Execute F29: Lease Velocity Index
    const leaseVelocity = executeFormula('F29', {
      monthly_leases: leasingTraffic?.expected_leases
        ? leasingTraffic.expected_leases * 4
        : trafficToLease.predicted_leases * 4,
      available_units: leasingTraffic?.available_units || 20,
    });

    // Publish M07 outputs
    dataFlowRouter.publishModuleData('M07', dealId, {
      predicted_leases_week: trafficToLease.predicted_leases,
      traffic_to_lease_ratio: physicalTraffic
        ? trafficToLease.predicted_leases / Math.max(1, physicalTraffic.weekly_walk_ins)
        : null,
      traffic_trend: leaseVelocity.velocity_rating,
      search_volume_index: digitalScore?.score || null,
      physical_traffic: physicalTraffic
        ? {
            weekly_walk_ins: physicalTraffic.weekly_walk_ins,
            daily_average: physicalTraffic.daily_average,
            peak_hour: physicalTraffic.peak_hour_estimate,
            confidence: physicalTraffic.confidence,
          }
        : null,
      digital_traffic: digitalScore
        ? {
            score: digitalScore.score,
            weekly_views: digitalScore.weekly_views,
            weekly_saves: digitalScore.weekly_saves,
            trending_velocity: digitalScore.trending_velocity,
            institutional_interest: digitalScore.institutional_interest_flag,
          }
        : null,
      leasing_prediction: leasingTraffic
        ? {
            expected_leases: leasingTraffic.expected_leases,
            inquiries: leasingTraffic.inquiries,
            tours: leasingTraffic.tours,
            occupancy_pct: leasingTraffic.occupancy_pct,
          }
        : null,
      lease_velocity: leaseVelocity,
    });

    // Emit data updated for downstream cascade
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M07',
      dealId,
      data: {
        predicted_leases: trafficToLease.predicted_leases,
        velocity_rating: leaseVelocity.velocity_rating,
      },
      timestamp: new Date(),
    });

    logger.info('[P2-1] Traffic intelligence wired', {
      dealId,
      propertyId,
      predictedLeases: trafficToLease.predicted_leases,
      velocityRating: leaseVelocity.velocity_rating,
      digitalScore: digitalScore?.score,
    });
  } catch (error) {
    logger.error('[P2-1] Traffic intelligence wiring failed', {
      dealId,
      propertyId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Wire a leasing forecast for a property (multi-week projection).
 */
export async function wireTrafficForecast(
  dealId: string,
  propertyId: string,
  weeks: number = 12,
): Promise<void> {
  try {
    const leasingService = getLeasingTrafficService();
    const forecast = await leasingService.forecast(propertyId, weeks);

    dataFlowRouter.publishModuleData('M07', dealId, {
      leasing_forecast: forecast,
      forecast_weeks: weeks,
    });

    logger.info('[P2-1] Traffic forecast wired', {
      dealId,
      propertyId,
      weeks,
      totalProjectedLeases: forecast?.summary?.total_leases,
    });
  } catch (error) {
    logger.error('[P2-1] Traffic forecast failed', {
      dealId,
      propertyId,
      error: (error as Error).message,
    });
    throw error;
  }
}

// ============================================================================
// P2-2: M12 Exit Analysis
// ============================================================================

/**
 * Calculate exit timing and disposition strategy.
 * Gathers NOI projections from M09, rent growth from M05, supply pressure from M04.
 * Downstream: M14 Risk
 */
export async function wireExitAnalysis(
  dealId: string,
  exitParams: {
    purchasePrice: number;
    holdYears?: number;
    discountRate?: number;
    exitCapRateEstimate?: number;
    annualRentGrowth?: number;
    annualExpenseGrowth?: number;
    initialNoi?: number;
    totalEquity?: number;
  },
): Promise<void> {
  try {
    const {
      purchasePrice,
      holdYears = 10,
      discountRate = 0.10,
      exitCapRateEstimate,
      annualRentGrowth,
      annualExpenseGrowth = 0.025,
      initialNoi,
      totalEquity,
    } = exitParams;

    // Gather M09 ProForma data
    const proformaData = dataFlowRouter.getModuleData('M09', dealId);
    const baseNoi = initialNoi || proformaData?.data?.noi || 0;

    // Gather M05 Market data for rent growth
    const marketData = dataFlowRouter.getModuleData('M05', dealId);
    const rentGrowth = annualRentGrowth ?? (marketData?.data?.rent_growth_pct || 0.03);

    // Gather M04 Supply data for cap rate pressure
    const supplyData = dataFlowRouter.getModuleData('M04', dealId);
    const supplyPressure = supplyData?.data?.supply_pressure_score || 50;

    // Gather M11 Debt data for leveraged returns
    const debtData = dataFlowRouter.getModuleData('M11', dealId);
    const annualDebtService = debtData?.data?.annual_debt_service || 0;

    // Build NOI projections
    const projectedNois: number[] = [];
    const projectedExitCaps: number[] = [];
    const annualCashFlows: number[] = [];

    const baseExitCap = exitCapRateEstimate || (proformaData?.data?.assumptions?.exit_cap || 5.5) / 100;

    for (let year = 0; year < holdYears; year++) {
      // Revenue grows with rent, expenses grow separately
      const revenueGrowth = Math.pow(1 + rentGrowth, year);
      const expenseGrowth = Math.pow(1 + annualExpenseGrowth, year);

      // Simplified: assume NOI grows roughly with rent growth minus expense drag
      const noiGrowthFactor = revenueGrowth * 0.6 + expenseGrowth * 0.4;
      const yearNoi = baseNoi * (revenueGrowth * 0.6 + (1 - (expenseGrowth - 1) * 0.4));
      projectedNois.push(parseFloat(yearNoi.toFixed(0)));

      // Exit cap rate: base + supply pressure adjustment
      const supplyCapAdj = ((supplyPressure - 50) / 500); // +/- 10bps per 50pt shift
      const yearCap = baseExitCap + (year * 0.001) + supplyCapAdj; // Slight cap expansion over time
      projectedExitCaps.push(parseFloat(Math.max(0.03, yearCap).toFixed(4)));

      // Cash flow after debt service
      const cashFlow = yearNoi - annualDebtService;
      annualCashFlows.push(parseFloat(cashFlow.toFixed(0)));
    }

    // Execute F34: Optimal Exit Year
    const exitAnalysis = executeFormula('F34', {
      projected_nois: projectedNois,
      projected_exit_caps: projectedExitCaps,
      discount_rate: discountRate,
      annual_cfs: annualCashFlows,
    });

    // Calculate disposition values at each year
    const dispositionTimeline: Array<{
      year: number;
      noi: number;
      exitCap: number;
      dispositionValue: number;
      totalReturn: number;
      irr: number;
    }> = [];

    for (let year = 1; year <= holdYears; year++) {
      const exitNoi = projectedNois[year] || projectedNois[projectedNois.length - 1];
      const exitCap = projectedExitCaps[year - 1] || baseExitCap;
      const dispositionValue = exitNoi / exitCap;

      // Total cash flows up to this year + sale proceeds
      const cumulativeCF = annualCashFlows.slice(0, year).reduce((sum, cf) => sum + cf, 0);
      const totalReturn = cumulativeCF + dispositionValue;

      // Calculate IRR for this exit year
      const irrFlows = [-purchasePrice, ...annualCashFlows.slice(0, year)];
      irrFlows[irrFlows.length - 1] += dispositionValue;
      const irr = executeFormula('F19', {
        initial_equity: totalEquity || purchasePrice,
        annual_cash_flows: annualCashFlows.slice(0, year),
        exit_proceeds: dispositionValue,
      });

      dispositionTimeline.push({
        year,
        noi: exitNoi,
        exitCap: parseFloat((exitCap * 100).toFixed(2)),
        dispositionValue: parseFloat(dispositionValue.toFixed(0)),
        totalReturn: parseFloat(totalReturn.toFixed(0)),
        irr,
      });
    }

    // Hold vs Sell NPV at optimal exit year
    const optYear = exitAnalysis.optimal_exit_year;
    const optEntry = dispositionTimeline[optYear - 1];
    const holdNpv = annualCashFlows.reduce(
      (sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i + 1),
      0,
    );
    const sellNpv = optEntry
      ? annualCashFlows
          .slice(0, optYear)
          .reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i + 1), 0) +
        optEntry.dispositionValue / Math.pow(1 + discountRate, optYear)
      : 0;

    // Publish M12 outputs
    dataFlowRouter.publishModuleData('M12', dealId, {
      optimal_exit_year: exitAnalysis.optimal_exit_year,
      exit_value_at_optimal: exitAnalysis.exit_value_at_optimal,
      exit_cap_rate_range: {
        min: parseFloat((Math.min(...projectedExitCaps) * 100).toFixed(2)),
        max: parseFloat((Math.max(...projectedExitCaps) * 100).toFixed(2)),
        at_optimal: optEntry ? optEntry.exitCap : null,
      },
      disposition_value: optEntry ? optEntry.dispositionValue : null,
      hold_vs_sell_npv: {
        hold_npv: parseFloat(holdNpv.toFixed(0)),
        sell_npv: parseFloat(sellNpv.toFixed(0)),
        advantage: sellNpv > holdNpv ? 'sell' : 'hold',
        delta: parseFloat(Math.abs(sellNpv - holdNpv).toFixed(0)),
      },
      disposition_timeline: dispositionTimeline,
      projected_nois: projectedNois,
      annual_cash_flows: annualCashFlows,
      irr_at_optimal: optEntry?.irr || null,
    });

    // Emit data updated for downstream cascade (M14 Risk)
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M12',
      dealId,
      data: {
        optimal_exit_year: exitAnalysis.optimal_exit_year,
        irr_at_optimal: optEntry?.irr,
      },
      timestamp: new Date(),
    });

    logger.info('[P2-2] Exit analysis wired', {
      dealId,
      optimalExitYear: exitAnalysis.optimal_exit_year,
      dispositionValue: optEntry?.dispositionValue,
      irrAtOptimal: optEntry?.irr,
      holdVsSell: sellNpv > holdNpv ? 'sell' : 'hold',
    });
  } catch (error) {
    logger.error('[P2-2] Exit analysis wiring failed', {
      dealId,
      error: (error as Error).message,
    });
    throw error;
  }
}

// ============================================================================
// P2-3: M22 Portfolio + Actuals
// ============================================================================

/**
 * Wire portfolio-level performance tracking.
 * Compares actual NOI to budgeted (projected), calculates value-weighted JEDI score.
 * Downstream: M01 Overview, M20 Alerts
 */
export async function wirePortfolioPerformance(
  assets: Array<{
    dealId: string;
    actualNoi: number;
    budgetNoi: number;
    assetValue: number;
    jediScore?: number;
    parcelId?: string;
  }>,
): Promise<void> {
  try {
    const propertyMetrics = getPropertyMetricsService();

    // Gather JEDI scores from data flow router for each asset
    const enrichedAssets = await Promise.all(
      assets.map(async (asset) => {
        let jediScore = asset.jediScore;

        // Try to get JEDI score from M25 data if not provided
        if (jediScore === undefined) {
          const scoreData = dataFlowRouter.getModuleData('M25', asset.dealId);
          jediScore = scoreData?.data?.jedi_score || 0;
        }

        // Try to get property metrics if parcel ID provided
        let metrics = null;
        if (asset.parcelId) {
          try {
            metrics = await propertyMetrics.getPropertyMetrics(asset.parcelId);
          } catch {
            // Property metrics are optional
          }
        }

        return { ...asset, jediScore: jediScore || 0, metrics };
      }),
    );

    // Execute F35: Portfolio Performance
    const portfolioMetrics = executeFormula('F35', {
      asset_nois: enrichedAssets.map((a) => a.actualNoi),
      budget_nois: enrichedAssets.map((a) => a.budgetNoi),
      asset_values: enrichedAssets.map((a) => a.assetValue),
      asset_jedi_scores: enrichedAssets.map((a) => a.jediScore),
    });

    // Build per-asset performance breakdown
    const assetPerformance = enrichedAssets.map((asset) => {
      const variance = asset.budgetNoi !== 0
        ? ((asset.actualNoi - asset.budgetNoi) / asset.budgetNoi) * 100
        : 0;

      return {
        dealId: asset.dealId,
        actualNoi: asset.actualNoi,
        budgetNoi: asset.budgetNoi,
        variancePct: parseFloat(variance.toFixed(2)),
        varianceStatus:
          variance >= 5 ? 'outperforming' : variance <= -5 ? 'underperforming' : 'on_track',
        assetValue: asset.assetValue,
        jediScore: asset.jediScore,
        capRate: asset.assetValue > 0
          ? parseFloat(((asset.actualNoi / asset.assetValue) * 100).toFixed(2))
          : 0,
        metrics: asset.metrics,
      };
    });

    // Rank assets by performance
    const ranked = [...assetPerformance].sort(
      (a, b) => b.variancePct - a.variancePct,
    );

    // Calculate portfolio risk score based on underperforming assets
    const underperformingCount = assetPerformance.filter(
      (a) => a.varianceStatus === 'underperforming',
    ).length;
    const portfolioRiskScore = Math.min(
      100,
      (underperformingCount / Math.max(1, assets.length)) * 100 * 2,
    );

    // Publish M22 outputs (use 'PORTFOLIO' as deal-level aggregation key)
    dataFlowRouter.publishModuleData('M22', 'PORTFOLIO', {
      portfolio_noi: portfolioMetrics.portfolio_noi,
      actual_vs_budget: {
        variance_pct: portfolioMetrics.variance_pct,
        status:
          portfolioMetrics.variance_pct >= 5
            ? 'outperforming'
            : portfolioMetrics.variance_pct <= -5
            ? 'underperforming'
            : 'on_track',
      },
      asset_performance_ranking: ranked.map((a, i) => ({
        rank: i + 1,
        dealId: a.dealId,
        variancePct: a.variancePct,
        status: a.varianceStatus,
        jediScore: a.jediScore,
      })),
      portfolio_risk_score: parseFloat(portfolioRiskScore.toFixed(2)),
      portfolio_jedi_score: portfolioMetrics.portfolio_jedi_score,
      asset_count: assets.length,
      asset_details: assetPerformance,
    });

    // Also publish per-deal data for downstream module cascades
    for (const asset of assetPerformance) {
      dataFlowRouter.publishModuleData('M22', asset.dealId, {
        actual_noi: asset.actualNoi,
        budget_noi: asset.budgetNoi,
        variance_pct: asset.variancePct,
        variance_status: asset.varianceStatus,
        cap_rate: asset.capRate,
      });
    }

    // Emit portfolio update event
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M22',
      dealId: 'PORTFOLIO',
      data: {
        portfolio_noi: portfolioMetrics.portfolio_noi,
        variance_pct: portfolioMetrics.variance_pct,
        asset_count: assets.length,
      },
      timestamp: new Date(),
    });

    // Alert on significantly underperforming assets
    for (const asset of assetPerformance) {
      if (asset.variancePct <= -10) {
        moduleEventBus.emit({
          type: ModuleEventType.RISK_ALERT,
          sourceModule: 'M22',
          dealId: asset.dealId,
          data: {
            alert_type: 'underperforming_asset',
            variance_pct: asset.variancePct,
            actual_noi: asset.actualNoi,
            budget_noi: asset.budgetNoi,
            severity: asset.variancePct <= -20 ? 'high' : 'medium',
          },
          timestamp: new Date(),
        });
      }
    }

    logger.info('[P2-3] Portfolio performance wired', {
      assetCount: assets.length,
      portfolioNOI: portfolioMetrics.portfolio_noi,
      variancePct: portfolioMetrics.variance_pct,
      portfolioJEDI: portfolioMetrics.portfolio_jedi_score,
      riskScore: portfolioRiskScore,
    });
  } catch (error) {
    logger.error('[P2-3] Portfolio performance wiring failed', {
      error: (error as Error).message,
    });
    throw error;
  }
}

// ============================================================================
// Full P2 Pipeline
// ============================================================================

/**
 * Execute the full P2 wiring pipeline.
 * Runs in dependency order: Traffic → Exit → Portfolio
 */
export async function wireP2Pipeline(
  dealId: string,
  options?: {
    propertyId?: string;
    exitParams?: Parameters<typeof wireExitAnalysis>[1];
    portfolioAssets?: Parameters<typeof wirePortfolioPerformance>[0];
  },
): Promise<{
  modulesWired: string[];
  predictedLeases?: number;
  optimalExitYear?: number;
  portfolioNoi?: number;
}> {
  const modulesWired: string[] = [];

  try {
    // Step 1: P2-1 Traffic Intelligence (if property ID provided)
    if (options?.propertyId) {
      await wireTrafficIntelligence(dealId, options.propertyId);
      modulesWired.push('M07');
    }

    // Step 2: P2-2 Exit Analysis (if exit params provided)
    if (options?.exitParams) {
      await wireExitAnalysis(dealId, options.exitParams);
      modulesWired.push('M12');
    }

    // Step 3: P2-3 Portfolio Performance (if portfolio assets provided)
    if (options?.portfolioAssets && options.portfolioAssets.length > 0) {
      await wirePortfolioPerformance(options.portfolioAssets);
      modulesWired.push('M22');
    }

    // Gather results
    const trafficData = dataFlowRouter.getModuleData('M07', dealId);
    const exitData = dataFlowRouter.getModuleData('M12', dealId);
    const portfolioData = dataFlowRouter.getModuleData('M22', 'PORTFOLIO');

    logger.info('[P2] Full pipeline wired', { dealId, modulesWired });

    return {
      modulesWired: [...new Set(modulesWired)],
      predictedLeases: trafficData?.data?.predicted_leases_week,
      optimalExitYear: exitData?.data?.optimal_exit_year,
      portfolioNoi: portfolioData?.data?.portfolio_noi,
    };
  } catch (error) {
    logger.error('[P2] Pipeline wiring failed', {
      dealId,
      error: (error as Error).message,
    });
    throw error;
  }
}

// ============================================================================
// Event Bus Subscriptions (auto-cascade wiring for P2)
// ============================================================================

/**
 * Set up automatic cascade subscriptions for P2 modules.
 */
export function setupP2Subscriptions(): void {
  // When M07 Traffic data updates → recalculate M05 Market and M09 ProForma
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M07') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M05',
          dealId: event.dealId,
          data: { trigger: 'traffic_update' },
          timestamp: new Date(),
        },
        `market-recalc-traffic:${event.dealId}`,
      );

      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M09',
          dealId: event.dealId,
          data: { trigger: 'traffic_update' },
          timestamp: new Date(),
        },
        `proforma-recalc-traffic:${event.dealId}`,
      );
    }
  });

  // When M09 ProForma updates → recalculate M12 Exit Analysis
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M09') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M12',
          dealId: event.dealId,
          data: { trigger: 'proforma_update' },
          timestamp: new Date(),
        },
        `exit-recalc:${event.dealId}`,
      );
    }
  });

  // When M12 Exit updates → recalculate M14 Risk
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M12') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M14',
          dealId: event.dealId,
          data: { trigger: 'exit_analysis_update' },
          timestamp: new Date(),
        },
        `risk-recalc-exit:${event.dealId}`,
      );
    }
  });

  // When M22 Portfolio detects underperformance → recalculate M14 Risk for that asset
  moduleEventBus.on(ModuleEventType.RISK_ALERT, async (event) => {
    if (event.sourceModule === 'M22' && event.data?.alert_type === 'underperforming_asset') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M14',
          dealId: event.dealId,
          data: { trigger: 'portfolio_underperformance', variance_pct: event.data.variance_pct },
          timestamp: new Date(),
        },
        `risk-recalc-portfolio:${event.dealId}`,
      );
    }
  });

  logger.info('P2 auto-cascade subscriptions initialized');
}
