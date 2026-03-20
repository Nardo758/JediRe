/**
 * P1 Service Adapters
 *
 * Connects P1-priority JEDI RE services to the module wiring infrastructure.
 * Each adapter wraps an existing service singleton, calling its methods and
 * publishing outputs through the Data Flow Router and Event Bus.
 *
 * Wiring Priority:
 *   P1-1: M09 ProForma auto-sync (market data + news → proforma assumptions)
 *   P1-2: M10 Scenario → M09 ProForma (evidence-based scenarios → adjusted assumptions)
 *   P1-3: M15 Competition → M05 Market (comp set → market calibration)
 *   P1-4: M11 Debt Analysis (NOI → DSCR/LTV/debt yield)
 */

import { dataFlowRouter } from './data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-event-bus';
import { executeFormula } from './formula-engine';
import { logger } from '../../utils/logger';

// Lazy-loaded service imports to avoid circular dependencies
function getProFormaService() {
  return require('../proforma-adjustment.service').proformaAdjustmentService;
}
function getScenarioService() {
  return require('../scenario-generation.service').scenarioGenerationService;
}
function getApartmentMarketService() {
  return require('../apartmentMarketService').default;
}

// ============================================================================
// P1-1: M09 ProForma Auto-Sync
// ============================================================================

/**
 * Recalculate proforma assumptions for a deal based on market data and news events.
 * Gathers inputs from M05 Market, M06 Demand, M04 Supply and recalculates.
 * Downstream: M10 Scenario, M11 Debt, M12 Exit, M14 Risk, M01 Overview
 */
export async function wireProFormaSync(
  dealId: string,
  triggerType: 'news_event' | 'demand_signal' | 'periodic_update' = 'periodic_update',
  triggerEventId?: string,
): Promise<void> {
  try {
    const proformaService = getProFormaService();

    // Recalculate all proforma assumptions (handles demand/supply internally)
    const updated = await proformaService.recalculate({
      dealId,
      triggerType,
      triggerEventId,
    });

    // Gather additional inputs from data flow router
    const marketData = dataFlowRouter.getModuleData('M05', dealId);
    const demandData = dataFlowRouter.getModuleData('M06', dealId);
    const supplyData = dataFlowRouter.getModuleData('M04', dealId);

    // Build financial inputs for formula execution
    const units = marketData?.data?.existing_units || 100;
    const avgRent = marketData?.data?.avg_rent_psf || updated.rentGrowth?.effective || 1500;
    const vacancyRate = (updated.vacancy?.effective ?? 5) / 100;
    const opexRatio = 0.40; // Standard assumption

    // Execute F16: NOI
    const noi = executeFormula('F16', {
      units,
      avg_rent: avgRent,
      vacancy_rate: vacancyRate,
      other_income: 0,
      opex_ratio: opexRatio,
    });

    // Execute F32: News-Adjusted Rent Growth
    const demandEvents = demandData?.data?.classified_demand_events || [];
    const adjustedRentGrowth = executeFormula('F32', {
      baseline_rent_growth: (updated.rentGrowth?.baseline ?? 3.5) / 100,
      demand_events: demandEvents,
      rent_sensitivity_factor: 0.001,
    });

    // Execute F33: News-Adjusted Vacancy
    const netDemandUnits = demandData?.data?.demand_units_total || 0;
    const existingUnits = marketData?.data?.existing_units || units;
    const adjustedVacancy = executeFormula('F33', {
      baseline_vacancy: (updated.vacancy?.baseline ?? 5) / 100,
      net_demand_units: netDemandUnits,
      existing_units: existingUnits,
      vacancy_sensitivity: 1.0,
    });

    // Publish M09 outputs
    dataFlowRouter.publishModuleData('M09', dealId, {
      noi,
      adjusted_rent_growth: adjustedRentGrowth,
      adjusted_vacancy: adjustedVacancy,
      assumptions: {
        rent_growth: updated.rentGrowth?.effective,
        vacancy: updated.vacancy?.effective,
        opex_growth: updated.opexGrowth?.effective,
        exit_cap: updated.exitCap?.effective,
        absorption: updated.absorption?.effective,
      },
      last_recalculation: updated.lastRecalculation || new Date(),
    });

    // Emit data updated event to trigger downstream cascades (M10, M11, M14)
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M09',
      dealId,
      data: { noi, triggerType },
      timestamp: new Date(),
    });

    logger.info('[P1-1] ProForma auto-sync wired', {
      dealId,
      noi,
      adjustedRentGrowth,
      adjustedVacancy,
      triggerType,
    });
  } catch (error) {
    logger.error('[P1-1] ProForma auto-sync failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

/**
 * Initialize a new proforma for a deal with market baseline data.
 */
export async function wireProFormaInit(
  dealId: string,
  strategy: 'rental' | 'build_to_sell' | 'flip' | 'airbnb' = 'rental',
): Promise<void> {
  try {
    const proformaService = getProFormaService();

    // Get market data from M05 if available
    const marketData = dataFlowRouter.getModuleData('M05', dealId);

    const baselineValues = marketData?.data
      ? {
          rentGrowth: { baseline: marketData.data.rent_growth_pct || 3.5 },
          vacancy: { baseline: (1 - (marketData.data.vacancy_rate || 0.95)) * 100 },
          exitCap: { baseline: 5.5 },
        }
      : undefined;

    const proforma = await proformaService.initializeProForma(dealId, strategy, baselineValues);

    // Publish initial M09 data
    dataFlowRouter.publishModuleData('M09', dealId, {
      assumptions: {
        rent_growth: proforma.rentGrowth.effective,
        vacancy: proforma.vacancy.effective,
        opex_growth: proforma.opexGrowth.effective,
        exit_cap: proforma.exitCap.effective,
        absorption: proforma.absorption.effective,
      },
      strategy,
      initialized: true,
    });

    logger.info('[P1-1] ProForma initialized', { dealId, strategy });
  } catch (error) {
    logger.error('[P1-1] ProForma init failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P1-2: M10 Scenario → M09 ProForma
// ============================================================================

/**
 * Generate scenarios for a deal and publish outputs.
 * Scenarios feed back into proforma for sensitivity analysis.
 * Downstream: M09 ProForma, M14 Risk, M01 Overview
 */
export async function wireScenarioGeneration(
  dealId: string,
  options?: {
    tradeAreaId?: string;
    trigger?: 'auto' | 'manual' | 'event_update';
    generatedBy?: string;
  },
): Promise<void> {
  try {
    const scenarioService = getScenarioService();

    // Generate all 4 standard scenarios
    const scenarios = await scenarioService.generateScenariosForDeal({
      dealId,
      tradeAreaId: options?.tradeAreaId,
      generatedBy: options?.generatedBy,
      trigger: options?.trigger || 'auto',
    });

    // Get scenario comparison
    let comparison;
    try {
      comparison = await scenarioService.getScenarioComparison(dealId);
    } catch {
      // Comparison view may not exist yet
      comparison = null;
    }

    // Execute F30: Scenario Parameter Generation
    const demandData = dataFlowRouter.getModuleData('M06', dealId);
    const supplyData = dataFlowRouter.getModuleData('M04', dealId);
    const scenarioParams = executeFormula('F30', {
      demand_events: demandData?.data?.classified_demand_events || [],
      supply_events: supplyData?.data?.classified_supply_events || [],
    });

    // Execute F31: Probability-Weighted Return (if we have scenario results)
    let expectedReturns = null;
    if (comparison?.scenarios) {
      const irrs: Record<string, number> = {};
      const probs: Record<string, number> = { bull: 0.20, base: 0.50, bear: 0.25, stress: 0.05 };

      for (const [type, summary] of Object.entries(comparison.scenarios)) {
        if (summary && typeof (summary as any).irrPct === 'number') {
          irrs[type] = (summary as any).irrPct;
        }
      }

      if (Object.keys(irrs).length > 0) {
        expectedReturns = executeFormula('F31', {
          scenario_irrs: irrs,
          scenario_probabilities: probs,
        });
      }
    }

    // Publish M10 outputs
    dataFlowRouter.publishModuleData('M10', dealId, {
      scenario_comparison: comparison,
      scenario_parameters: scenarioParams,
      probability_weighted_returns: expectedReturns,
      scenario_narratives: scenarios.map((s: any) => ({
        type: s.scenario_type,
        name: s.scenario_name,
        summary: s.key_assumptions_summary,
      })),
      sensitivity_ranges: comparison?.ranges || null,
      scenarios_generated: scenarios.length,
    });

    // Emit data updated for downstream cascade
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M10',
      dealId,
      data: {
        scenarios_count: scenarios.length,
        expected_irr: expectedReturns?.expected_irr,
      },
      timestamp: new Date(),
    });

    logger.info('[P1-2] Scenario generation wired', {
      dealId,
      scenariosGenerated: scenarios.length,
      expectedIRR: expectedReturns?.expected_irr,
      irrSpread: comparison?.ranges?.irrSpread,
    });
  } catch (error) {
    logger.error('[P1-2] Scenario generation failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

/**
 * Recalculate a specific scenario after events have changed.
 */
export async function wireScenarioRecalculate(
  scenarioId: string,
  userId?: string,
): Promise<void> {
  try {
    const scenarioService = getScenarioService();
    const updated = await scenarioService.recalculateScenario(scenarioId, userId);

    logger.info('[P1-2] Scenario recalculated', {
      scenarioId,
      scenarioType: updated.scenario_type,
      dealId: updated.deal_id,
    });
  } catch (error) {
    logger.error('[P1-2] Scenario recalculation failed', { scenarioId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P1-3: M15 Competition → M05 Market
// ============================================================================

/**
 * Wire competition data into market analysis.
 * Fetches comp set, calculates rent comp metrics, calibrates market data.
 * Downstream: M08 Strategy, M09 ProForma, M14 Risk
 */
export async function wireCompetitionToMarket(
  dealId: string,
  location: {
    latitude: number;
    longitude: number;
    tradeAreaId?: number;
    subjectRent?: number;
  },
): Promise<void> {
  try {
    const apartmentService = getApartmentMarketService();

    // Fetch comparable properties
    const comps = await apartmentService.fetchPropertiesNearDeal(
      dealId,
      location.latitude,
      location.longitude,
      5, // 5-mile radius
    );

    // Link comparables to deal
    await apartmentService.linkComparablesToDeal(dealId, location.latitude, location.longitude);

    // Calculate trade area metrics if trade area is available
    let tradeAreaMetrics = null;
    if (location.tradeAreaId) {
      tradeAreaMetrics = await apartmentService.calculateTradeAreaMetrics(dealId, location.tradeAreaId);
    }

    // Build comp rent array for F27
    const compRents = comps
      .filter((c: any) => c.min_price && c.min_price > 0)
      .map((c: any) => (c.min_price + c.max_price) / 2);

    // Execute F27: Rent Comp Analysis
    let rentCompResult = null;
    if (location.subjectRent && compRents.length > 0) {
      rentCompResult = executeFormula('F27', {
        subject_rent: location.subjectRent,
        comp_rents: compRents,
      });
    }

    // Execute F26: Submarket Rank
    const submarketRank = executeFormula('F26', {
      rent_growth: tradeAreaMetrics ? (tradeAreaMetrics as any).rent_growth_12mo || 0 : 0,
      absorption_rate: 0.08, // Default
      vacancy_rate: tradeAreaMetrics?.avg_occupancy_rate
        ? (100 - tradeAreaMetrics.avg_occupancy_rate) / 100
        : 0.05,
      population_growth_rate: 0.01, // Default
    });

    // Publish M15 Competition outputs
    dataFlowRouter.publishModuleData('M15', dealId, {
      comp_set: comps.map((c: any) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        rent: (c.min_price + c.max_price) / 2,
        occupancy: c.occupancy_rate,
        year_built: c.year_built,
      })),
      comp_count: comps.length,
      rent_comp_matrix: rentCompResult,
      competitive_position_score: rentCompResult?.comp_position || 50,
      amenity_gap_analysis: null, // Requires deeper comp data
    });

    // Publish M05 Market outputs (calibrated by comp data)
    const marketOutputs: Record<string, any> = {
      submarket_rank: submarketRank,
      avg_rent_psf: compRents.length > 0
        ? compRents.reduce((a: number, b: number) => a + b, 0) / compRents.length
        : null,
      vacancy_rate: tradeAreaMetrics?.avg_occupancy_rate
        ? (100 - tradeAreaMetrics.avg_occupancy_rate) / 100
        : null,
      existing_units: tradeAreaMetrics?.total_units || null,
      comp_calibrated: true,
    };

    if (tradeAreaMetrics) {
      marketOutputs.avg_rent_studio = (tradeAreaMetrics as any).avg_rent_studio;
      marketOutputs.avg_rent_1br = (tradeAreaMetrics as any).avg_rent_1br;
      marketOutputs.avg_rent_2br = (tradeAreaMetrics as any).avg_rent_2br;
      marketOutputs.avg_rent_3br = (tradeAreaMetrics as any).avg_rent_3br;
    }

    dataFlowRouter.publishModuleData('M05', dealId, marketOutputs);

    // Emit data updated events for downstream cascade
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M15',
      dealId,
      data: { comp_count: comps.length },
      timestamp: new Date(),
    });

    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M05',
      dealId,
      data: { submarket_rank: submarketRank, comp_calibrated: true },
      timestamp: new Date(),
    });

    logger.info('[P1-3] Competition → Market wired', {
      dealId,
      compsFound: comps.length,
      rentPremium: rentCompResult?.rent_premium_pct,
      submarketRank,
    });
  } catch (error) {
    logger.error('[P1-3] Competition → Market wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// P1-4: M11 Debt Analysis Wiring
// ============================================================================

/**
 * Calculate debt metrics (DSCR, LTV, Debt Yield) from proforma NOI.
 * Downstream: M09 ProForma feedback, M14 Risk
 */
export async function wireDebtAnalysis(
  dealId: string,
  debtParams: {
    purchasePrice: number;
    loanAmount: number;
    interestRate: number;
    amortizationYears?: number;
    loanTermYears?: number;
    totalEquity?: number;
  },
): Promise<void> {
  try {
    // Get NOI from M09 data flow
    const proformaData = dataFlowRouter.getModuleData('M09', dealId);
    const noi = proformaData?.data?.noi;

    if (!noi) {
      logger.warn('[P1-4] No NOI available for debt analysis, attempting formula calculation', { dealId });
    }

    const effectiveNoi = noi || 0;
    const {
      purchasePrice,
      loanAmount,
      interestRate,
      amortizationYears = 30,
      loanTermYears = 10,
      totalEquity,
    } = debtParams;

    // Execute F21: DSCR
    const dscr = executeFormula('F21', {
      noi: effectiveNoi,
      loan_amount: loanAmount,
      interest_rate: interestRate,
      amortization_years: amortizationYears,
    });

    // Execute F22: Debt Yield
    const debtYield = executeFormula('F22', {
      noi: effectiveNoi,
      loan_amount: loanAmount,
    });

    // Calculate LTV
    const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;

    // Calculate annual debt service for downstream use
    const monthlyRate = interestRate / 12;
    const n = amortizationYears * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1);
    const annualDebtService = monthlyPayment * 12;

    // Generate rate sensitivity matrix (DSCR at different rates)
    const rateSensitivity: Array<{ rate: number; dscr: number; debtYield: number }> = [];
    const baseRateBps = Math.round(interestRate * 10000);
    for (let deltaBase = -200; deltaBase <= 200; deltaBase += 50) {
      const testRate = (baseRateBps + deltaBase) / 10000;
      if (testRate <= 0) continue;
      const testDSCR = executeFormula('F21', {
        noi: effectiveNoi,
        loan_amount: loanAmount,
        interest_rate: testRate,
        amortization_years: amortizationYears,
      });
      rateSensitivity.push({
        rate: parseFloat((testRate * 100).toFixed(2)),
        dscr: testDSCR,
        debtYield: parseFloat(((effectiveNoi / loanAmount) * 100).toFixed(2)),
      });
    }

    // Determine lender recommendation based on metrics
    const lenderRecommendations = getLenderRecommendations(dscr, ltv, debtYield);

    // Calculate CoC if equity is provided
    let cocReturn = null;
    if (totalEquity && totalEquity > 0) {
      cocReturn = executeFormula('F18', {
        noi: effectiveNoi,
        annual_debt_service: annualDebtService,
        total_equity: totalEquity,
      });
    }

    // Publish M11 outputs
    dataFlowRouter.publishModuleData('M11', dealId, {
      dscr,
      ltv: parseFloat(ltv.toFixed(2)),
      debt_yield: debtYield,
      annual_debt_service: parseFloat(annualDebtService.toFixed(2)),
      rate_sensitivity_matrix: rateSensitivity,
      lender_recommendations: lenderRecommendations,
      coc_return: cocReturn,
      debt_params: {
        loan_amount: loanAmount,
        interest_rate: interestRate,
        amortization_years: amortizationYears,
        loan_term_years: loanTermYears,
      },
    });

    // Emit data updated for downstream cascade
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M11',
      dealId,
      data: { dscr, ltv, debtYield },
      timestamp: new Date(),
    });

    // Alert if DSCR is below threshold
    if (dscr > 0 && dscr < 1.25) {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M11',
        dealId,
        data: {
          alert_type: 'low_dscr',
          dscr,
          threshold: 1.25,
          severity: dscr < 1.0 ? 'high' : 'medium',
        },
        timestamp: new Date(),
      });
    }

    logger.info('[P1-4] Debt analysis wired', {
      dealId,
      dscr,
      ltv: parseFloat(ltv.toFixed(2)),
      debtYield,
      annualDebtService: parseFloat(annualDebtService.toFixed(2)),
    });
  } catch (error) {
    logger.error('[P1-4] Debt analysis wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

/**
 * Determine lender recommendations based on debt metrics.
 */
function getLenderRecommendations(
  dscr: number,
  ltv: number,
  debtYield: number,
): Array<{ lenderType: string; fit: 'strong' | 'moderate' | 'weak'; rationale: string }> {
  const recs: Array<{ lenderType: string; fit: 'strong' | 'moderate' | 'weak'; rationale: string }> = [];

  // Agency (Fannie/Freddie) — typical: DSCR > 1.25, LTV < 80%
  if (dscr >= 1.25 && ltv <= 80) {
    recs.push({ lenderType: 'Agency (Fannie/Freddie)', fit: 'strong', rationale: `DSCR ${dscr}x exceeds 1.25x threshold; LTV ${ltv.toFixed(1)}% within 80% limit` });
  } else if (dscr >= 1.15 && ltv <= 85) {
    recs.push({ lenderType: 'Agency (Fannie/Freddie)', fit: 'moderate', rationale: `DSCR ${dscr}x and LTV ${ltv.toFixed(1)}% near agency limits` });
  } else {
    recs.push({ lenderType: 'Agency (Fannie/Freddie)', fit: 'weak', rationale: `DSCR ${dscr}x or LTV ${ltv.toFixed(1)}% outside agency guidelines` });
  }

  // CMBS — typical: DSCR > 1.20, LTV < 75%, Debt Yield > 8%
  if (dscr >= 1.20 && ltv <= 75 && debtYield >= 8) {
    recs.push({ lenderType: 'CMBS', fit: 'strong', rationale: `Debt yield ${debtYield.toFixed(1)}% exceeds 8% threshold` });
  } else if (dscr >= 1.10 && debtYield >= 6) {
    recs.push({ lenderType: 'CMBS', fit: 'moderate', rationale: `Debt yield ${debtYield.toFixed(1)}% acceptable` });
  } else {
    recs.push({ lenderType: 'CMBS', fit: 'weak', rationale: `Metrics below CMBS requirements` });
  }

  // Bank/Life Co — typical: DSCR > 1.30, LTV < 70%
  if (dscr >= 1.30 && ltv <= 70) {
    recs.push({ lenderType: 'Bank/Life Company', fit: 'strong', rationale: `Conservative metrics fit bank/life co profile` });
  } else if (dscr >= 1.20 && ltv <= 75) {
    recs.push({ lenderType: 'Bank/Life Company', fit: 'moderate', rationale: `Metrics within acceptable range` });
  } else {
    recs.push({ lenderType: 'Bank/Life Company', fit: 'weak', rationale: `Leverage too high for bank/life co` });
  }

  // Bridge/Mezzanine — more flexible, higher rates
  if (ltv > 75 || dscr < 1.20) {
    recs.push({ lenderType: 'Bridge/Mezzanine', fit: 'strong', rationale: `Higher leverage or transitional profile suits bridge lending` });
  } else {
    recs.push({ lenderType: 'Bridge/Mezzanine', fit: 'moderate', rationale: `Conventional financing likely more favorable` });
  }

  return recs;
}

// ============================================================================
// Full P1 Pipeline
// ============================================================================

/**
 * Execute the full P1 wiring pipeline for a deal.
 * Runs in dependency order: Competition → Market → ProForma → Scenario → Debt
 */
export async function wireP1Pipeline(
  dealId: string,
  options?: {
    location?: { latitude: number; longitude: number; tradeAreaId?: number; subjectRent?: number };
    debtParams?: Parameters<typeof wireDebtAnalysis>[1];
    trigger?: 'auto' | 'manual' | 'event_update';
    generatedBy?: string;
  },
): Promise<{
  modulesWired: string[];
  noi?: number;
  dscr?: number;
  scenariosGenerated?: number;
  compsFound?: number;
}> {
  const modulesWired: string[] = [];

  try {
    // Step 1: P1-3 Competition → Market (if location provided)
    if (options?.location) {
      await wireCompetitionToMarket(dealId, options.location);
      modulesWired.push('M15', 'M05');
    }

    // Step 2: P1-1 ProForma Auto-Sync
    await wireProFormaSync(dealId, 'periodic_update');
    modulesWired.push('M09');

    // Step 3: P1-2 Scenario Generation
    await wireScenarioGeneration(dealId, {
      tradeAreaId: options?.location?.tradeAreaId?.toString(),
      trigger: options?.trigger || 'auto',
      generatedBy: options?.generatedBy,
    });
    modulesWired.push('M10');

    // Step 4: P1-4 Debt Analysis (if debt params provided)
    if (options?.debtParams) {
      await wireDebtAnalysis(dealId, options.debtParams);
      modulesWired.push('M11');
    }

    // Gather results
    const proformaData = dataFlowRouter.getModuleData('M09', dealId);
    const debtData = dataFlowRouter.getModuleData('M11', dealId);
    const scenarioData = dataFlowRouter.getModuleData('M10', dealId);
    const compData = dataFlowRouter.getModuleData('M15', dealId);

    logger.info('[P1] Full pipeline wired', { dealId, modulesWired });

    return {
      modulesWired: [...new Set(modulesWired)],
      noi: proformaData?.data?.noi,
      dscr: debtData?.data?.dscr,
      scenariosGenerated: scenarioData?.data?.scenarios_generated,
      compsFound: compData?.data?.comp_count,
    };
  } catch (error) {
    logger.error('[P1] Pipeline wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Event Bus Subscriptions (auto-cascade wiring for P1)
// ============================================================================

/**
 * Set up automatic cascade subscriptions for P1 modules.
 * When upstream data changes, P1 modules automatically recalculate.
 */
export function setupP1Subscriptions(): void {
  // When M05 Market data updates → recalculate M09 ProForma assumptions
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M05') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M09',
        dealId: event.dealId,
        data: { trigger: 'market_data_update' },
        timestamp: new Date(),
      }, `proforma-recalc:${event.dealId}`);
    }
  });

  // When M06 Demand or M04 Supply updates → recalculate M09 ProForma
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M06' || event.sourceModule === 'M04') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M09',
        dealId: event.dealId,
        data: { trigger: `${event.sourceModule}_update` },
        timestamp: new Date(),
      }, `proforma-recalc:${event.dealId}`);
    }
  });

  // When M09 ProForma updates → recalculate M10 Scenarios and M11 Debt
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M09') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M10',
        dealId: event.dealId,
        data: { trigger: 'proforma_update' },
        timestamp: new Date(),
      }, `scenario-recalc:${event.dealId}`);

      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M11',
        dealId: event.dealId,
        data: { trigger: 'proforma_update' },
        timestamp: new Date(),
      }, `debt-recalc:${event.dealId}`);
    }
  });

  // When M15 Competition updates → recalculate M05 Market → cascade to M09
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M15') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M05',
        dealId: event.dealId,
        data: { trigger: 'competition_update' },
        timestamp: new Date(),
      }, `market-recalc:${event.dealId}`);
    }
  });

  // When M11 Debt updates → recalculate M14 Risk (debt coverage risk)
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule === 'M11') {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M14',
        dealId: event.dealId,
        data: { trigger: 'debt_analysis_update' },
        timestamp: new Date(),
      }, `risk-recalc-debt:${event.dealId}`);
    }
  });

  logger.info('P1 auto-cascade subscriptions initialized');
}
