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
  const { DigitalTrafficService } = require('../digitalTrafficService');
  const { pool } = require('../../database');
  return new DigitalTrafficService(pool);
}
function getPropertyMetricsService() {
  const { PropertyMetricsService } = require('../propertyMetrics.service');
  const { pool } = require('../../database');
  return new PropertyMetricsService(pool);
}
function getVisibilityScoringService() {
  try {
    const mod = require('../visibility-scoring.service');
    return mod.visibilityScoringService || mod.default || null;
  } catch { return null; }
}
function getTrafficDataSourcesService() {
  try {
    const mod = require('../traffic-data-sources.service');
    return mod.trafficDataSourcesService || mod.default || null;
  } catch { return null; }
}
function getPropertyAnalyticsService() {
  try {
    const { pool } = require('../../database');
    const { PropertyAnalyticsService } = require('../property-analytics.service');
    return new PropertyAnalyticsService(pool);
  } catch { return null; }
}
function getCompTrafficService() {
  try {
    const mod = require('../comp-traffic.service');
    return mod.compTrafficService || mod.default || null;
  } catch { return null; }
}
function getTrafficModuleWiring() {
  return require('../traffic-module-wiring');
}
function getTrendPatternDetector() {
  try {
    const mod = require('../trend-pattern-detector');
    return mod.trendPatternDetector || mod.default || null;
  } catch { return null; }
}

// ============================================================================
// P2-1: M07 Traffic Intelligence
// ============================================================================

/**
 * Wire traffic intelligence for a property.
 * Combines all 4 data sources: DOT/Google street traffic, SpyFu website
 * traffic, Apartment Locator AI market intel, and Location Visibility scoring.
 * Publishes TrafficIntelligenceV2 to DataFlowRouter for downstream cascade.
 * Downstream: M05 Market, M08 Strategy, M09 ProForma, M14 Risk, M25 JEDI Score
 */
export async function wireTrafficIntelligence(
  dealId: string,
  propertyId: string,
  options?: { tradeAreaId?: string; totalUnits?: number },
): Promise<void> {
  try {
    const trafficEngine = getTrafficPredictionEngine();
    const leasingService = getLeasingTrafficService();
    let connectedSources = 0;

    // Source 1: Physical traffic prediction (DOT ADT + Google real-time)
    let physicalTraffic = null;
    let trafficContext = null;
    try {
      physicalTraffic = await trafficEngine.predictTraffic(propertyId);
      connectedSources++;
    } catch (err) {
      logger.warn('[P2-1] Physical traffic prediction unavailable', {
        propertyId,
        error: (err as Error).message,
      });
    }

    const trafficDataService = getTrafficDataSourcesService();
    if (trafficDataService) {
      try {
        trafficContext = await trafficDataService.getPropertyTrafficContext(propertyId);
        if (trafficContext && !physicalTraffic) connectedSources++;
      } catch (err) {
        logger.warn('[P2-1] DOT/Google traffic context unavailable', {
          propertyId,
          error: (err as Error).message,
        });
      }
    }

    // Source 2: Website traffic (Google Analytics or comp proxy)
    let webTraffic = null;
    const analyticsService = getPropertyAnalyticsService();
    if (analyticsService) {
      try {
        webTraffic = await analyticsService.fetchPropertyWebTraffic(propertyId);
        if (webTraffic) connectedSources++;
      } catch (err) {
        if (options?.tradeAreaId) {
          try {
            webTraffic = await analyticsService.getCompProxyTraffic(propertyId, options.tradeAreaId);
            if (webTraffic) connectedSources++;
          } catch {}
        }
        logger.warn('[P2-1] Website analytics unavailable', {
          propertyId,
          error: (err as Error).message,
        });
      }
    }

    // Source 3: Digital traffic score (Apartment Locator AI / market intel)
    let digitalScore = null;
    try {
      const digitalService = getDigitalTrafficService();
      digitalScore = await digitalService.calculateDigitalScore(propertyId);
      if (digitalScore) connectedSources++;
    } catch (err) {
      logger.warn('[P2-1] Digital traffic score unavailable', {
        propertyId,
        error: (err as Error).message,
      });
    }

    // Source 4: Visibility scoring
    let visibilityData = null;
    const visibilityService = getVisibilityScoringService();
    if (visibilityService) {
      try {
        visibilityData = await visibilityService.getVisibilityScore(propertyId);
      } catch (err) {
        logger.warn('[P2-1] Visibility score unavailable', {
          propertyId,
          error: (err as Error).message,
        });
      }
    }
    if (visibilityData) connectedSources++;

    // Comp traffic averages from trade area
    let compAverages = null;
    if (options?.tradeAreaId) {
      const compService = getCompTrafficService();
      if (compService) {
        try {
          compAverages = await compService.getCompAverages(options.tradeAreaId);
        } catch (err) {
          logger.warn('[P2-1] Comp averages unavailable', {
            tradeAreaId: options.tradeAreaId,
            error: (err as Error).message,
          });
        }
      }
    }

    // Leasing traffic prediction
    let leasingTraffic = null;
    try {
      leasingTraffic = await leasingService.predictCurrentWeek(propertyId);
    } catch (err) {
      logger.warn('[P2-1] Leasing traffic prediction unavailable', {
        propertyId,
        error: (err as Error).message,
      });
    }

    // Execute F28: Traffic-to-Lease Prediction
    const trafficToLease = executeFormula('F28', {
      daily_drive_bys: physicalTraffic?.daily_average || trafficContext?.primary_adt || 0,
      weekly_web_visits: webTraffic?.sessions || digitalScore?.weekly_views || 0,
      monthly_search_volume: (webTraffic?.sessions || digitalScore?.weekly_views || 0) * 4,
    });

    // Execute F29: Lease Velocity Index
    const leaseVelocity = executeFormula('F29', {
      monthly_leases: leasingTraffic?.expected_leases
        ? leasingTraffic.expected_leases * 4
        : trafficToLease.predicted_leases * 4,
      available_units: leasingTraffic?.available_units || options?.totalUnits || 20,
    });

    const captureRate = visibilityData?.capture_rate ?? (physicalTraffic
      ? trafficToLease.predicted_leases / Math.max(1, physicalTraffic.weekly_walk_ins) * 100
      : null);

    const visibilityScore = visibilityData?.composite_score ?? null;

    // Calculate ProForma assumption overrides from traffic data
    const totalUnits = options?.totalUnits || leasingTraffic?.available_units || 200;
    const annualLeases = trafficToLease.predicted_leases * 52;
    const annualTurnover = totalUnits * 0.50;
    const leaseDemandRatio = annualLeases / Math.max(annualTurnover, 1);
    const impliedOccupancy = Math.min(98, 88 + (leaseDemandRatio * 8));
    const vacancyAssumption = Math.round((100 - impliedOccupancy) * 10) / 10;

    let rentGrowthAdj = 0;
    if (leaseVelocity.velocity_rating === 'Increasing' || leaseVelocity.velocity_rating === 'Hot') rentGrowthAdj = 0.005;
    else if (leaseVelocity.velocity_rating === 'Decreasing' || leaseVelocity.velocity_rating === 'Cold') rentGrowthAdj = -0.005;

    const absorptionRate = Math.round(trafficToLease.predicted_leases * 52);

    // Calculate risk signals
    const occupancyBelowThreshold = leasingTraffic
      ? leasingTraffic.occupancy_pct < 93
      : impliedOccupancy < 93;
    const seasonalRiskWindows: Array<{ week_start: number; week_end: number; risk: string }> = [];
    if (leaseVelocity.velocity_rating === 'Cold' || leaseVelocity.velocity_rating === 'Decreasing') {
      seasonalRiskWindows.push({ week_start: 1, week_end: 12, risk: 'low_traffic_period' });
    }

    const effectiveBaseAdt = physicalTraffic?.breakdown?.effective_base_adt ?? null;
    const temporalAdjustedAdt = physicalTraffic?.breakdown?.temporal_adjusted_adt ?? null;
    const trafficTrajectory = physicalTraffic?.breakdown?.traffic_trajectory ?? null;
    const trendMomentum = physicalTraffic?.breakdown?.trend_momentum ?? null;
    const trendDirection = physicalTraffic?.breakdown?.trend_direction ?? null;
    const dailyBreakdown = physicalTraffic?.daily_breakdown ?? null;
    const digitalShare = webTraffic?.digital_share ?? null;

    let detectedPatterns: Array<{
      name: string;
      icon: string;
      confidence: number;
      condition: string;
      action: string;
      timeline: string;
      signals_used: string[];
    }> = [];
    try {
      if (physicalTraffic?.detected_patterns) {
        detectedPatterns = physicalTraffic.detected_patterns;
      } else {
        const patternDetector = getTrendPatternDetector();
        if (patternDetector) {
          detectedPatterns = patternDetector.detectPatterns({
            digital_momentum_pct: trendMomentum || 0,
            yoy_aadt_growth_pct: 0,
            digital_share: digitalShare ?? undefined,
          });
        }
      }
    } catch {
      detectedPatterns = [];
    }

    // Publish M07 outputs with full TrafficIntelligenceV2 payload
    dataFlowRouter.publishModuleData('M07', dealId, {
      predicted_leases_week: trafficToLease.predicted_leases,
      traffic_to_lease_ratio: physicalTraffic
        ? trafficToLease.predicted_leases / Math.max(1, physicalTraffic.weekly_walk_ins)
        : null,
      traffic_trend: leaseVelocity.velocity_rating,
      search_volume_index: digitalScore?.score || null,
      visibility_score: visibilityScore,
      capture_rate: captureRate,
      comp_averages: compAverages,
      data_quality_score: connectedSources,
      vacancy_assumption: vacancyAssumption,
      rent_growth_adjustment: rentGrowthAdj,
      absorption_rate: absorptionRate,
      seasonal_risk_windows: seasonalRiskWindows,
      occupancy_below_threshold: occupancyBelowThreshold,
      effective_base_adt: effectiveBaseAdt,
      temporal_adjusted_adt: temporalAdjustedAdt,
      traffic_trajectory: trafficTrajectory,
      trend_momentum: trendMomentum,
      trend_direction: trendDirection,
      detected_patterns: detectedPatterns,
      digital_share: digitalShare,
      daily_breakdown: dailyBreakdown,
      physical_traffic: physicalTraffic
        ? {
            weekly_walk_ins: physicalTraffic.weekly_walk_ins,
            daily_average: physicalTraffic.daily_average,
            peak_hour: physicalTraffic.peak_hour_estimate,
            confidence: physicalTraffic.confidence,
          }
        : null,
      street_traffic: trafficContext
        ? {
            primary_adt: trafficContext.primary_adt,
            primary_road: trafficContext.primary_road_name,
            google_realtime_factor: trafficContext.google_realtime_factor,
            trend_direction: trafficContext.trend_direction,
            trend_pct: trafficContext.trend_pct,
          }
        : null,
      web_traffic: webTraffic
        ? {
            sessions: webTraffic.sessions,
            users: webTraffic.users,
            bounce_rate: webTraffic.bounce_rate,
            is_comp_proxy: webTraffic.is_comp_proxy || false,
            digital_share: digitalShare,
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
      visibility: visibilityData
        ? {
            composite_score: visibilityData.composite_score,
            capture_rate: visibilityData.capture_rate,
            tier: visibilityData.tier,
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

    // Emit data updated for downstream cascade (M05, M08, M09, M14, M25)
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M07',
      dealId,
      data: {
        predicted_leases: trafficToLease.predicted_leases,
        velocity_rating: leaseVelocity.velocity_rating,
        visibility_score: visibilityScore,
        capture_rate: captureRate,
        data_quality_score: connectedSources,
        effective_base_adt: effectiveBaseAdt,
        temporal_adjusted_adt: temporalAdjustedAdt,
        traffic_trajectory: trafficTrajectory,
        trend_momentum: trendMomentum,
        trend_direction: trendDirection,
        detected_patterns: detectedPatterns,
        digital_share: digitalShare,
        daily_breakdown: dailyBreakdown,
      },
      timestamp: new Date(),
    });

    for (const pattern of detectedPatterns) {
      if (pattern.name === 'DIGITAL_DIVERGENCE' || pattern.name === 'MARKET_EXHAUSTION') {
        moduleEventBus.emit({
          type: ModuleEventType.RISK_ALERT,
          sourceModule: 'M07',
          dealId,
          data: {
            alert_type: `traffic_${pattern.name.toLowerCase()}`,
            pattern_name: pattern.name,
            confidence: pattern.confidence,
            action: pattern.action,
            timeline: pattern.timeline,
            severity: pattern.name === 'MARKET_EXHAUSTION' ? 'high' : 'medium',
          },
          timestamp: new Date(),
        });
      }

      if (pattern.name === 'DEMAND_SURGE') {
        moduleEventBus.emit({
          type: ModuleEventType.ARBITRAGE_DETECTED,
          sourceModule: 'M07',
          dealId,
          data: {
            signal_type: 'DEMAND_SURGE',
            confidence: pattern.confidence,
            action: pattern.action,
            timeline: pattern.timeline,
            acquisition_confidence: 'high',
          },
          timestamp: new Date(),
        });
      }
    }

    logger.info('[P2-1] Traffic intelligence wired (V2)', {
      dealId,
      propertyId,
      predictedLeases: trafficToLease.predicted_leases,
      velocityRating: leaseVelocity.velocity_rating,
      visibilityScore,
      captureRate,
      connectedSources,
      digitalScore: digitalScore?.score,
      effectiveBaseAdt,
      trafficTrajectory,
      detectedPatterns: detectedPatterns.map((p: any) => p.name),
      digitalShare,
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
    tradeAreaId?: string;
    totalUnits?: number;
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
      await wireTrafficIntelligence(dealId, options.propertyId, {
        tradeAreaId: options.tradeAreaId,
        totalUnits: options.totalUnits,
      });
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
  // When M07 Traffic data updates → recalculate M05, M08, M09, M14, M25
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M07') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M05',
          dealId: event.dealId,
          data: {
            trigger: 'traffic_update',
            digital_share: event.data?.digital_share,
          },
          timestamp: new Date(),
        },
        `market-recalc-traffic:${event.dealId}`,
      );

      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M08',
          dealId: event.dealId,
          data: {
            trigger: 'traffic_update',
            detected_patterns: event.data?.detected_patterns,
            traffic_trajectory: event.data?.traffic_trajectory,
          },
          timestamp: new Date(),
        },
        `strategy-recalc-traffic:${event.dealId}`,
      );

      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M09',
          dealId: event.dealId,
          data: {
            trigger: 'traffic_update',
            effective_base_adt: event.data?.effective_base_adt,
            temporal_adjusted_adt: event.data?.temporal_adjusted_adt,
            daily_breakdown: event.data?.daily_breakdown,
            traffic_trajectory: event.data?.traffic_trajectory,
          },
          timestamp: new Date(),
        },
        `proforma-recalc-traffic:${event.dealId}`,
      );

      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M14',
          dealId: event.dealId,
          data: {
            trigger: 'traffic_update',
            visibility_score: event.data?.visibility_score,
            detected_patterns: event.data?.detected_patterns,
            traffic_trajectory: event.data?.traffic_trajectory,
          },
          timestamp: new Date(),
        },
        `risk-recalc-traffic:${event.dealId}`,
      );

      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M25',
          dealId: event.dealId,
          data: {
            trigger: 'traffic_update',
            predicted_leases: event.data?.predicted_leases,
            traffic_trajectory: event.data?.traffic_trajectory,
            trend_momentum: event.data?.trend_momentum,
            trend_direction: event.data?.trend_direction,
          },
          timestamp: new Date(),
        },
        `jedi-recalc-traffic:${event.dealId}`,
      );
    }
  });

  // When M07 detects risk patterns (DIGITAL_DIVERGENCE, MARKET_EXHAUSTION) → alert M14 Risk
  moduleEventBus.on(ModuleEventType.RISK_ALERT, async (event) => {
    if (event.sourceModule === 'M07') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M14',
          dealId: event.dealId,
          data: {
            trigger: 'traffic_risk_pattern',
            pattern_name: event.data?.pattern_name,
            severity: event.data?.severity,
            action: event.data?.action,
          },
          timestamp: new Date(),
        },
        `risk-recalc-traffic-pattern:${event.dealId}`,
      );
    }
  });

  // When M07 detects DEMAND_SURGE → notify M08 Strategy for acquisition confidence
  moduleEventBus.on(ModuleEventType.ARBITRAGE_DETECTED, async (event) => {
    if (event.sourceModule === 'M07' && event.data?.signal_type === 'DEMAND_SURGE') {
      moduleEventBus.emitDebounced(
        {
          type: ModuleEventType.RECALCULATE,
          sourceModule: 'M08',
          dealId: event.dealId,
          data: {
            trigger: 'demand_surge_detected',
            signal_type: 'DEMAND_SURGE',
            confidence: event.data?.confidence,
            acquisition_confidence: event.data?.acquisition_confidence,
            timeline: event.data?.timeline,
          },
          timestamp: new Date(),
        },
        `strategy-recalc-demand-surge:${event.dealId}`,
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
