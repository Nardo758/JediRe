/**
 * Capital Structure Engine — Module Wiring Adapter
 *
 * Connects the Capital Structure Service (M11+) to the module wiring system.
 * Handles full capital stack analysis, waterfall calculations, scenario comparison,
 * and cross-module event propagation.
 *
 * Extends the existing wireDebtAnalysis (P1-4) with full capital structure capabilities.
 */

import { dataFlowRouter } from './data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-event-bus';
import { executeFormula } from './formula-engine';
import { logger } from '../../utils/logger';

// Lazy-loaded service to avoid circular dependencies
function getCapitalStructureService() {
  return require('../capital-structure.service').capitalStructureService;
}

// ============================================================================
// Full Capital Stack Wiring
// ============================================================================

/**
 * Wire a complete capital stack build through the module system.
 * Executes F40-F46 formulas, publishes to M11, cascades to M09/M14/M01/M12.
 */
export async function wireCapitalStack(
  dealId: string,
  strategy: string,
  layers: Array<{
    id: string;
    name: string;
    layerType: string;
    amount: number;
    rate: number;
    term: number;
    source: string;
    amortYears?: number;
  }>,
  uses: {
    acquisitionPrice: number;
    closingCosts: number;
    renovationBudget: number;
    carryingCosts: number;
    reserves: number;
    developerFee: number;
    total: number;
  },
  noi: number,
  propertyValue: number,
): Promise<void> {
  try {
    logger.info('[CapStructure Wiring] Building capital stack', { dealId, strategy, layerCount: layers.length });

    const service = getCapitalStructureService();
    const stack = service.buildCapitalStack(dealId, strategy, layers, uses, noi, propertyValue);

    // Publish full capital stack to data flow router
    dataFlowRouter.publishModuleData('M11', dealId, {
      capital_stack: stack,
      dscr: stack.metrics.dscr,
      ltv: stack.metrics.ltv,
      ltc: stack.metrics.ltc,
      debt_yield: stack.metrics.debtYield,
      wacc: stack.metrics.weightedAvgCostOfCapital,
      total_debt: stack.metrics.totalDebt,
      total_equity: stack.metrics.totalEquity,
      equity_required: stack.metrics.equityRequired,
      coc_return: stack.metrics.cocReturn,
      capital_risk_score: stack.metrics.capitalRiskScore,
      is_balanced: stack.isBalanced,
      imbalance: stack.imbalance,
      strategy,
    });

    // Emit capital.stack.updated event
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M11',
      dealId,
      data: {
        event_subtype: 'capital.stack.updated',
        dscr: stack.metrics.dscr,
        ltv: stack.metrics.ltv,
        wacc: stack.metrics.weightedAvgCostOfCapital,
        total_debt: stack.metrics.totalDebt,
        total_equity: stack.metrics.totalEquity,
      },
      timestamp: new Date(),
    });

    // Risk alerts
    if (stack.metrics.capitalRiskScore > 60) {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M11',
        dealId,
        data: {
          alert_type: 'capital_structure_risk',
          capital_risk_score: stack.metrics.capitalRiskScore,
          dscr: stack.metrics.dscr,
          ltv: stack.metrics.ltv,
          severity: stack.metrics.capitalRiskScore > 80 ? 'high' : 'medium',
        },
        timestamp: new Date(),
      });
    }

    // Source/Uses imbalance warning
    if (!stack.isBalanced) {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M11',
        dealId,
        data: {
          alert_type: 'sources_uses_imbalance',
          imbalance: stack.imbalance,
          severity: Math.abs(stack.imbalance) > 100000 ? 'high' : 'medium',
        },
        timestamp: new Date(),
      });
    }

    // Generate and publish insights
    const insights = service.generateInsights(stack.metrics);
    dataFlowRouter.publishModuleData('M11', dealId, {
      ...dataFlowRouter.getModuleData('M11', dealId)?.data,
      insights,
    });

    logger.info('[CapStructure Wiring] Capital stack wired', {
      dealId,
      dscr: stack.metrics.dscr,
      ltv: stack.metrics.ltv,
      riskScore: stack.metrics.capitalRiskScore,
      balanced: stack.isBalanced,
    });
  } catch (error) {
    logger.error('[CapStructure Wiring] Capital stack wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Equity Waterfall Wiring
// ============================================================================

/**
 * Wire waterfall calculation through module system.
 * Executes F52-F59, publishes waterfall results to M11.
 */
export async function wireWaterfallCalculation(
  dealId: string,
  waterfallConfig: {
    lpCapital: number;
    gpCapital: number;
    totalEquity: number;
    lpPercentage: number;
    gpPercentage: number;
    preferredReturn: number;
    tiers: Array<{ id: string; name: string; hurdleRate: number; gpSplit: number; lpSplit: number }>;
    catchUpProvision: boolean;
    catchUpPercentage: number;
    clawbackProvision: boolean;
  },
  exitProceeds: number,
  holdYears: number,
  annualCashFlows: number[],
): Promise<void> {
  try {
    logger.info('[CapStructure Wiring] Calculating waterfall', { dealId, exitProceeds, holdYears });

    const service = getCapitalStructureService();
    const result = service.calculateWaterfall(waterfallConfig, exitProceeds, holdYears, annualCashFlows);

    // Merge waterfall results into M11 data
    const existingData = dataFlowRouter.getModuleData('M11', dealId)?.data || {};
    dataFlowRouter.publishModuleData('M11', dealId, {
      ...existingData,
      equity_waterfall: result,
      lp_irr: result.lpEquityMultiple, // simplified
      gp_irr: result.gpEquityMultiple,
      gp_effective_share: result.gpEffectiveShare,
    });

    // Emit returns updated event
    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M11',
      dealId,
      data: {
        event_subtype: 'capital.returns.updated',
        lp_total_return: result.lpTotalReturn,
        gp_total_return: result.gpTotalReturn,
        gp_effective_share: result.gpEffectiveShare,
      },
      timestamp: new Date(),
    });

    logger.info('[CapStructure Wiring] Waterfall wired', {
      dealId,
      lpMultiple: result.lpEquityMultiple,
      gpMultiple: result.gpEquityMultiple,
      gpShare: result.gpEffectiveShare,
    });
  } catch (error) {
    logger.error('[CapStructure Wiring] Waterfall wiring failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Scenario Comparison Wiring
// ============================================================================

/**
 * Wire multi-scenario comparison through module system.
 */
export async function wireScenarioComparison(
  dealId: string,
  scenarios: Array<{
    id: string;
    name: string;
    layers: any[];
    uses: any;
    noi: number;
    annualCashFlow: number;
    exitProceeds: number;
    holdYears: number;
    propertyValue: number;
    rateType: 'fixed' | 'floating';
    hasMezz: boolean;
  }>,
  noi: number,
  propertyValue: number,
): Promise<void> {
  try {
    logger.info('[CapStructure Wiring] Comparing scenarios', { dealId, count: scenarios.length });

    const service = getCapitalStructureService();
    const comparison = service.compareScenarios(scenarios, noi, propertyValue);

    // Merge into M11 data
    const existingData = dataFlowRouter.getModuleData('M11', dealId)?.data || {};
    dataFlowRouter.publishModuleData('M11', dealId, {
      ...existingData,
      scenario_comparison: comparison,
    });

    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M11',
      dealId,
      data: {
        event_subtype: 'capital.scenarios.compared',
        best_irr: comparison.bestIRR,
        best_coc: comparison.bestCoC,
        lowest_risk: comparison.lowestRisk,
        delta: comparison.delta,
      },
      timestamp: new Date(),
    });

    logger.info('[CapStructure Wiring] Scenarios compared', {
      dealId,
      bestIRR: comparison.bestIRR,
      lowestRisk: comparison.lowestRisk,
    });
  } catch (error) {
    logger.error('[CapStructure Wiring] Scenario comparison failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Rate Environment Wiring
// ============================================================================

/**
 * Wire rate environment analysis through module system.
 */
export async function wireRateAnalysis(
  dealId: string,
  rateData: {
    fedDirection: string;
    durationMonths: number;
    yieldCurveSlope: number;
    loanAmount: number;
    lockRate: number;
    expectedFloatRates: number[];
    termMonths: number;
  },
): Promise<void> {
  try {
    logger.info('[CapStructure Wiring] Analyzing rate environment', { dealId });

    const service = getCapitalStructureService();

    // F47: Cycle phase
    const cyclePhase = service.classifyCyclePhase(
      rateData.fedDirection,
      rateData.durationMonths,
      rateData.yieldCurveSlope,
    );

    // F49: Lock vs Float
    const lockVsFloat = service.analyzeLockVsFloat(
      rateData.loanAmount,
      rateData.lockRate,
      rateData.expectedFloatRates,
      rateData.termMonths,
      0.05,
    );

    // F51: Rate sensitivity matrix
    const sensitivity = service.calcRateSensitivityMatrix(rateData.loanAmount, 5);

    // Merge into M11 data
    const existingData = dataFlowRouter.getModuleData('M11', dealId)?.data || {};
    dataFlowRouter.publishModuleData('M11', dealId, {
      ...existingData,
      rate_environment: {
        cycle_phase: cyclePhase,
        lock_vs_float: lockVsFloat,
        rate_sensitivity_matrix: sensitivity,
      },
    });

    moduleEventBus.emit({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M11',
      dealId,
      data: {
        event_subtype: 'capital.rate.analyzed',
        cycle_phase: cyclePhase,
        recommendation: lockVsFloat.recommendation,
      },
      timestamp: new Date(),
    });

    logger.info('[CapStructure Wiring] Rate analysis wired', {
      dealId,
      cyclePhase,
      lockVsFloat: lockVsFloat.recommendation,
    });
  } catch (error) {
    logger.error('[CapStructure Wiring] Rate analysis failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Full Capital Structure Pipeline
// ============================================================================

/**
 * Wire the full Capital Structure Engine pipeline.
 * Runs capital stack → waterfall → scenarios → rate analysis in sequence.
 */
export async function wireCapitalStructurePipeline(
  dealId: string,
  params: {
    strategy: string;
    layers: any[];
    uses: any;
    noi: number;
    propertyValue: number;
    waterfallConfig?: any;
    exitProceeds?: number;
    holdYears?: number;
    annualCashFlows?: number[];
    scenarios?: any[];
    rateData?: any;
  },
): Promise<void> {
  try {
    logger.info('[CapStructure Pipeline] Starting full pipeline', { dealId, strategy: params.strategy });

    // Step 1: Capital Stack
    await wireCapitalStack(
      dealId,
      params.strategy,
      params.layers,
      params.uses,
      params.noi,
      params.propertyValue,
    );

    // Step 2: Waterfall (if config provided)
    if (params.waterfallConfig && params.exitProceeds) {
      await wireWaterfallCalculation(
        dealId,
        params.waterfallConfig,
        params.exitProceeds,
        params.holdYears || 5,
        params.annualCashFlows || [],
      );
    }

    // Step 3: Scenario Comparison (if scenarios provided)
    if (params.scenarios && params.scenarios.length > 0) {
      await wireScenarioComparison(dealId, params.scenarios, params.noi, params.propertyValue);
    }

    // Step 4: Rate Analysis (if rate data provided)
    if (params.rateData) {
      await wireRateAnalysis(dealId, params.rateData);
    }

    logger.info('[CapStructure Pipeline] Pipeline complete', { dealId });
  } catch (error) {
    logger.error('[CapStructure Pipeline] Pipeline failed', { dealId, error: (error as Error).message });
    throw error;
  }
}

// ============================================================================
// Cross-Module Subscriptions
// ============================================================================

/**
 * Set up event subscriptions for the Capital Structure Engine.
 *
 * Listens for:
 *   M09 data update → recalculate DSCR/metrics with new NOI
 *   M08 strategy change → re-evaluate debt product recommendations
 */
export function setupCapitalStructureSubscriptions(): void {
  logger.info('[CapStructure Wiring] Setting up cross-module subscriptions');

  // M09 ProForma → M11 Capital Structure (NOI changed → recalculate)
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule !== 'M09') return;
    if (!event.data?.noi) return;

    const { dealId, data } = event;
    logger.info('[CapStructure Sub] M09 NOI update detected, recalculating M11', { dealId });

    // Get existing M11 stack data and trigger recalculation
    const existingM11 = dataFlowRouter.getModuleData('M11', dealId);
    if (existingM11?.data?.capital_stack) {
      moduleEventBus.emitDebounced({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M11',
        dealId,
        data: { trigger: 'M09_NOI_update', noi: data.noi },
        timestamp: new Date(),
      });
    }
  });

  // M08 Strategy → M11 Capital Structure (strategy change → re-evaluate products)
  moduleEventBus.on(ModuleEventType.DATA_UPDATED, async (event) => {
    if (event.sourceModule !== 'M08') return;
    if (!event.data?.strategy) return;

    const { dealId, data } = event;
    logger.info('[CapStructure Sub] M08 strategy change detected', { dealId, newStrategy: data.strategy });

    // Emit debounced event so frontend can refresh debt product recommendations
    moduleEventBus.emitDebounced({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M11',
      dealId,
      data: {
        event_subtype: 'capital.strategy.changed',
        new_strategy: data.strategy,
      },
      timestamp: new Date(),
    });
  });

  logger.info('[CapStructure Wiring] Subscriptions active: M09→M11, M08→M11');
}
