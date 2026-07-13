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
import type { ModelAssumptions } from '../deterministic/deterministic-model-runner';
import { runModel } from '../deterministic/deterministic-model-runner';
import {
  computeYear1DebtService,
  computeMaxLoanByDscr,
} from '../deterministic/deterministic-model-runner';
import { resolveLoanProduct } from '../debt-advisor/rulesets/loan-product.ruleset';

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
  /**
   * Task #641 (End 2a): When leasingCostTreatment is CAPITALIZED or HYBRID,
   * callers must pass the capitalized_lease_up_total from
   * deal_data.concession_recognition so equity_required reflects the full
   * capital outlay at close.  Zero / undefined → no augmentation (OPERATING path).
   */
  capitalizedLeaseUpTotal?: number,
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
      // Task #641 (End 2a resolved): equity_required is augmented by capitalizedLeaseUpTotal
      // when leasingCostTreatment is CAPITALIZED or HYBRID.  Callers supply the value from
      // deal_data.concession_recognition.capitalized_lease_up_total; defaults to 0 (OPERATING).
      equity_required: (parseFloat(stack.metrics.equityRequired) + (capitalizedLeaseUpTotal ?? 0)).toFixed(2),
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

    // M11 → M09 bridge: pass real WACC and debt service to ProForma so it
    // stops defaulting to the hardcoded 0.15 (15%) target IRR.
    const wacc = parseFloat(stack.metrics.weightedAvgCostOfCapital?.toString() || '0');
    const dscrVal = parseFloat(stack.metrics.dscr?.toString() || '0');
    const annualDebtService = dscrVal > 0 ? noi / dscrVal : 0;

    if (wacc > 0 || annualDebtService > 0) {
      const existingM09 = dataFlowRouter.getModuleData('M09', dealId)?.data || {};
      dataFlowRouter.publishModuleData('M09', dealId, {
        ...existingM09,
        target_irr: wacc > 0 ? wacc : existingM09.target_irr,
        annual_debt_service: annualDebtService > 0 ? annualDebtService : existingM09.annual_debt_service,
        wacc_from_m11: wacc,
        debt_service_source: 'M11_capital_stack',
      });

      moduleEventBus.emit({
        type: ModuleEventType.RECALCULATE,
        sourceModule: 'M09',
        dealId,
        data: {
          trigger: 'M11_capital_stack_update',
          target_irr: wacc,
          annual_debt_service: annualDebtService,
        },
        timestamp: new Date(),
      });

      logger.info('[CapStructure Wiring] M11→M09 bridge: ProForma updated with real WACC', {
        dealId,
        wacc,
        annualDebtService,
      });
    }

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

    if (!params.strategy || !params.layers || !params.noi || !params.propertyValue) {
      throw new Error('Missing required fields: strategy, layers, noi, propertyValue');
    }
    if (!params.uses) {
      params = { ...params, uses: { acquisitionPrice: params.propertyValue, closingCosts: 0, renovationBudget: 0, carryingCosts: 0, reserves: 0, developerFee: 0, total: params.propertyValue } };
    }

    // Step 1: Capital Stack
    // Pipeline callers do not carry deal-level concession data; capitalizedLeaseUpTotal
    // defaults to undefined (treated as 0) — correct for the generic pipeline path.
    await wireCapitalStack(
      dealId,
      params.strategy,
      params.layers,
      params.uses,
      params.noi,
      params.propertyValue,
    );
    // Note: deal-aware callers that have concession recognition data should call
    // wireCapitalStack directly and pass capitalizedLeaseUpTotal explicitly.

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
// M11 Debt Optimizer — getRecommendedTerms / runM11Cycle
// ============================================================================

export interface RecommendedTerms {
  recommendedLoanAmount: number;
  loanTerms: { termMonths: number; amortMonths: number; ioPeriod: number };
  debtService: number;
  effectiveRate: number;
  /**
   * B5: Which constraint bound the sizing decision.
   *   - 'ltv'     : Loan capped by LTV ceiling (DSCR was comfortable)
   *   - 'dscr'    : Loan reduced below LTV cap to satisfy DSCR floor
   *   - 'io'      : IO period constrained by lease-up profile or product maxIOYears
   *   - 'user_override' : Caller supplied explicit loanAmount/ioPeriod/term
   */
  bindingConstraint: 'ltv' | 'dscr' | 'io' | 'user_override';
  /** B5: Human-readable description of why the constraint bound. */
  constraintDetails: string;
}

/**
 * Derive loan terms that satisfy DSCR ≥ 1.25 given NOI and LTV cap.
 *
 * Term/amort conventions (B3 — R2 M11 accepts terms + loan-product ruleset):
 *   - When caller supplies termMonths/amortMonths: use them directly (user/agent override wins)
 *   - When absent: resolve from loan-product ruleset (agency 5/30 default)
 *   - ioPeriod: derived from LTV tier when caller does not supply an override
 *       LTV > 0.75 → 24 months (bridge/value-add products with higher leverage)
 *       LTV > 0.65 → 12 months (moderate leverage with short I/O)
 *       LTV ≤ 0.65 → 0 months  (low-leverage fully-amortizing from day 1)
 *     Caller may override via `ioPeriodMonths`.
 *
 *   B5 — monthsToStabilize: When dealMode is 'lease_up', the IO period is
 *   derived from the lease-up profile (min(monthsToStabilize, maxIOYears*12))
 *   rather than the LTV tier. This prevents IO expiry before stabilization.
 *   Falls back to LTV tier when monthsToStabilize is absent or deal is not
 *   lease-up. User override via ioPeriodMonths still wins.
 *
 * Pure function, no I/O.
 */
export function getRecommendedTerms(params: {
  noiY1: number;
  purchasePrice: number;
  ltv: number;
  rate?: number;
  termMonths?: number;
  amortMonths?: number;
  ioPeriodMonths?: number;
  monthsToStabilize?: number; // B5: lease-up profile → IO derivation
  dealContext?: { lenderType?: string; assetClass?: string; dealMode?: string };
}): RecommendedTerms {
  const { noiY1, purchasePrice, ltv, rate = 0.065, termMonths, amortMonths, ioPeriodMonths, monthsToStabilize, dealContext } = params;
  const maxByLtv = Math.round(purchasePrice * ltv);

  // ── B4: Step 1 — Resolve term/amort/IO BEFORE sizing ─────────────────────

  let resolvedTermMonths: number;
  let resolvedAmortMonths: number;
  let termProvenance: string;

  if (termMonths !== undefined && termMonths > 0) {
    resolvedTermMonths = termMonths;
    termProvenance = 'user_or_agent_override';
  } else {
    const product = resolveLoanProduct(dealContext);
    resolvedTermMonths = product.termYears * 12;
    termProvenance = product.provenance;
  }

  if (amortMonths !== undefined && amortMonths > 0) {
    resolvedAmortMonths = amortMonths;
  } else {
    const product = resolveLoanProduct(dealContext);
    resolvedAmortMonths = product.amortYears * 12;
    if (!termProvenance) {
      termProvenance = product.provenance;
    }
  }

  // ── B5: IO derivation — lease-up profile → LTV tier fallback → user override ─
  let ioPeriod: number;
  let ioProvenance: string;
  let bindingConstraint: RecommendedTerms['bindingConstraint'] = 'dscr';
  let constraintDetails = '';

  if (ioPeriodMonths !== undefined && ioPeriodMonths >= 0) {
    ioPeriod = ioPeriodMonths;
    ioProvenance = ioPeriodMonths === 0 ? 'caller_explicit_zero: fully amortizing' : 'user_or_agent_override';
    bindingConstraint = 'user_override';
    constraintDetails = `IO period set by caller at ${ioPeriod} months`;
  } else if (dealContext?.dealMode === 'lease_up' && monthsToStabilize != null && monthsToStabilize > 0) {
    // B5: Lease-up deals — IO must cover stabilization period (capped by product maxIO)
    const product = resolveLoanProduct(dealContext);
    const maxIO = product.maxIOYears * 12;
    ioPeriod = Math.min(monthsToStabilize, maxIO);
    ioProvenance = `lease_up_profile: monthsToStabilize=${monthsToStabilize}, maxIO=${maxIO} (product: ${product.name})`;
    bindingConstraint = 'io';
    constraintDetails = `IO period derived from lease-up profile: ${monthsToStabilize} months to stabilize, capped at product maxIO ${maxIO} months → ${ioPeriod} months`;
  } else {
    // B4: LTV tier fallback (non-lease-up deals)
    if (ltv > 0.75) {
      ioPeriod = 24;
      ioProvenance = 'ltv_tier: >0.75 → 24mo (bridge/value-add)';
    } else if (ltv > 0.65) {
      ioPeriod = 12;
      ioProvenance = 'ltv_tier: >0.65 → 12mo (moderate leverage)';
    } else {
      ioPeriod = 0;
      ioProvenance = 'ltv_tier: ≤0.65 → 0mo (fully amortizing)';
    }
  }

  // ── B4: Step 2 — Size debt using true amortizing debt service ────────────

  const dscrFloor = 1.25;
  let recommendedLoanAmount: number;
  let debtService: number;

  if (rate <= 0) {
    recommendedLoanAmount = maxByLtv;
    debtService = 0;
    bindingConstraint = 'ltv';
    constraintDetails = 'Zero or negative rate — LTV ceiling is the only binding constraint';
  } else {
    const loanByDscr = computeMaxLoanByDscr(
      noiY1,
      dscrFloor,
      rate,
      resolvedTermMonths,
      resolvedAmortMonths,
      ioPeriod,
      maxByLtv
    );

    recommendedLoanAmount = Math.max(0, Math.min(maxByLtv, loanByDscr));

    debtService = computeYear1DebtService(
      recommendedLoanAmount,
      rate,
      resolvedTermMonths,
      resolvedAmortMonths,
      ioPeriod
    );

    // B5: Determine binding constraint (preserve user_override and io from IO block)
    if (bindingConstraint !== 'user_override' && bindingConstraint !== 'io') {
      if (recommendedLoanAmount < maxByLtv) {
        bindingConstraint = 'dscr';
        constraintDetails = `DSCR floor ${dscrFloor} bound the loan at $${recommendedLoanAmount.toLocaleString()} vs LTV ceiling $${maxByLtv.toLocaleString()}`;
      } else {
        bindingConstraint = 'ltv';
        constraintDetails = `LTV ceiling at ${(ltv * 100).toFixed(0)}% bound the loan at $${maxByLtv.toLocaleString()}; DSCR was comfortable`;
      }
    }
  }

  return {
    recommendedLoanAmount,
    loanTerms: { termMonths: resolvedTermMonths, amortMonths: resolvedAmortMonths, ioPeriod },
    debtService,
    effectiveRate: rate,
    bindingConstraint,
    constraintDetails,
  };
}

export interface M11CycleResult {
  assumptions: ModelAssumptions;
  iterations: number;
  converged: boolean;
}

/**
 * Iteratively converge debt terms until DSCR change < 0.01 (max maxIter passes).
 * Sized from an externally-computed pass-1 NOI (supplied by runFullModel).
 *
 * B3 — R2: M11 now accepts term/amort/ioPeriod from deal assumptions.
 * Only overwrites if the deal's values are non-zero and within a sensible range
 * (12–600 months for term/amort); otherwise uses loan-product ruleset defaults.
 * This preserves identity for legacy deals with corrupted bridge values (e.g.
 * Bishop's term=4320/amort=4320 from the months-as-years bridge bug).
 */
export function runM11Cycle(assumptions: ModelAssumptions, noiY1: number, maxIter = 3): M11CycleResult {
  let current: ModelAssumptions = { ...assumptions };
  let prevDscr: number | null = null;
  let iterations = 0;
  let converged = false;

  // Sanity bounds for term/amort (months). Values outside this range are treated
  // as corrupted bridge output and fall back to ruleset defaults.
  const SANE_MIN_MONTHS = 12;
  const SANE_MAX_MONTHS = 600; // 50 years

  const dealTerm = assumptions.term > 0 && assumptions.term <= SANE_MAX_MONTHS && assumptions.term >= SANE_MIN_MONTHS
    ? assumptions.term
    : undefined;
  const dealAmort = assumptions.amort > 0 && assumptions.amort <= SANE_MAX_MONTHS && assumptions.amort >= SANE_MIN_MONTHS
    ? assumptions.amort
    : undefined;
  const dealIoPeriod = assumptions.ioPeriod > 0 && assumptions.ioPeriod <= SANE_MAX_MONTHS
    ? assumptions.ioPeriod
    : undefined;

  for (let i = 0; i < maxIter; i++) {
    iterations++;
    const modelResult = runModel(current, { skipSensitivity: true });
    const dscrY1 = modelResult.debtMetrics.coverage.dscrY1;

    if (prevDscr !== null && dscrY1 !== null && Math.abs(dscrY1 - prevDscr) < 0.01) {
      converged = true;
      break;
    }
    prevDscr = dscrY1;

    const terms = getRecommendedTerms({
      noiY1,
      purchasePrice: current.purchasePrice,
      ltv: current.ltv,
      rate: current.rate,
      termMonths: dealTerm,
      amortMonths: dealAmort,
      ioPeriodMonths: dealIoPeriod,
      monthsToStabilize: current.monthsToStabilize,
      dealContext: { lenderType: current.dealType, assetClass: 'multifamily', dealMode: current.dealMode },
    });
    current = {
      ...current,
      loanAmount: terms.recommendedLoanAmount,
      rate: terms.effectiveRate,
      term: terms.loanTerms.termMonths,
      amort: terms.loanTerms.amortMonths,
      ioPeriod: terms.loanTerms.ioPeriod,
      // B5: persist binding constraint for writeM11ToFinancing
      _m11BindingConstraint: terms.bindingConstraint,
      _m11ConstraintDetails: terms.constraintDetails,
    };
  }

  return { assumptions: current, iterations, converged };
}

// ============================================================================
// M14 Risk Dashboard — applyM14RiskAdjustments
// ============================================================================

export interface M14AdjustmentResult {
  assumptions: ModelAssumptions;
  applied: boolean;
  capRateAdjBps: number;
  /**
   * DSCR floor sourced from M14's risk dashboard (default 1.25).
   * buildModel() compares the post-cycle actual DSCR against this floor
   * and emits an integrity-check warning when the floor binds.
   */
  dscrFloor: number;
}

/**
 * Apply M14 risk-dashboard cap-rate and reserve overrides to model assumptions.
 * Also reads the DSCR floor configured in M14 (defaulting to 1.25) and returns
 * it so buildModel() can surface a warning when M11's proposed debt would
 * violate the floor.
 * Reads from the dataFlowRouter; returns originals unchanged on missing data.
 */
export async function applyM14RiskAdjustments(
  dealId: string,
  assumptions: ModelAssumptions,
): Promise<M14AdjustmentResult> {
  const m14Data = dataFlowRouter.getModuleData('M14', dealId)?.data;

  // DSCR floor is always returned (default 1.25) even when no other M14 data is present.
  const dscrFloor: number =
    typeof m14Data?.dscr_floor === 'number' && m14Data.dscr_floor > 0
      ? m14Data.dscr_floor
      : 1.25;

  if (!m14Data) {
    return { assumptions, applied: false, capRateAdjBps: 0, dscrFloor };
  }

  const capRateAdjBps: number =
    typeof m14Data.cap_rate_adjustment_bps === 'number' ? m14Data.cap_rate_adjustment_bps : 0;
  const reserveOverrides: Record<string, number> = m14Data.reserve_overrides ?? {};

  if (capRateAdjBps === 0 && reserveOverrides.replacementReserves == null) {
    return { assumptions, applied: false, capRateAdjBps: 0, dscrFloor };
  }

  const updated: ModelAssumptions = { ...assumptions };
  if (capRateAdjBps !== 0) {
    updated.exitCap = assumptions.exitCap + capRateAdjBps / 10000;
  }
  if (reserveOverrides.replacementReserves != null) {
    updated.replacementReserves = reserveOverrides.replacementReserves;
  }
  return { assumptions: updated, applied: true, capRateAdjBps, dscrFloor };
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

// ============================================================================
// M11 → ProFormaAssumptions.financing write-back (Task #1412)
// ============================================================================

/**
 * Summary of the 7 capital structure fields as sourced from M11.
 * Attached to FinancialModelResult.meta so F9 can display sourced values
 * with their derivation provenance.
 */
export interface M11CapitalStructureSummary {
  /** Resolved loan amount ($). Source: M11 DSCR + LTV triple constraint. */
  loanAmount: number;
  /** Loan-to-Value ratio (decimal). Computed: loanAmount / purchasePrice. */
  ltv: number;
  /**
   * Loan-to-Cost ratio (decimal). Computed: loanAmount / totalProjectCost
   * where totalProjectCost = purchasePrice + capexBudget.
   * Falls back to LTV when capexBudget is zero (pure acquisition deal).
   */
  ltc: number;
  /** All-in interest rate (decimal). Source: M11 rate environment. */
  rate: number;
  /** Balloon term in years (e.g. 5). Source: M11 product defaults. */
  termYears: number;
  /** Amortization period in years (e.g. 30). Source: M11 product defaults. */
  amortYears: number;
  /** Interest-only period in months. Source: M11 LTV-tier or lease-up derivation. */
  ioPeriodMonths: number;
  /**
   * M14 DSCR floor that constrained sizing (default 1.25).
   * When constraintBinds=true, the loan was reduced below the LTV cap to
   * satisfy this floor — surfaced as an integrity-check warning in F9.
   */
  dscrFloor: number;
  constraintBinds: boolean;
  /** Year-1 DSCR produced by the final optimized debt terms. */
  dscrActual: number | null;
  /**
   * B5: Which constraint bound the sizing decision.
   * 'ltv' | 'dscr' | 'io' | 'user_override'
   */
  bindingConstraint: string;
  /** B5: Human-readable description of why the constraint bound. */
  constraintDetails: string;
}

/**
 * Write M11-optimized capital structure fields back into the
 * ProFormaAssumptions.financing envelope so the persisted F9 model
 * reflects the M11-sourced values rather than the original analyst inputs.
 *
 * Conversions:
 *   ModelAssumptions.term  (months) → ProFormaAssumptions.financing.term  (years)
 *   ModelAssumptions.amort (months) → ProFormaAssumptions.financing.amortization (years)
 *   ModelAssumptions.ioPeriod stays in months in both schemas.
 *
 * Fields NOT overwritten: loanType, spread, originationFee, rateCapCost,
 * prepayPenalty — these are analyst-entered and M11 does not derive them.
 *
 * @param adjusted    ModelAssumptions after M11+M14 cycle
 * @param financing   Existing ProFormaAssumptions.financing (spread + origination preserved)
 * @param capexBudget Total capex budget ($) for LTC computation (0 for pure acquisitions)
 * @param dscrActual  Year-1 DSCR from the post-cycle deterministic run (null if unavailable)
 * @param dscrFloor   M14 DSCR floor returned by applyM14RiskAdjustments()
 */
export function writeM11ToFinancing(
  adjusted: ModelAssumptions,
  financing: {
    loanAmount: number;
    loanType: string;
    interestRate: number;
    spread: number;
    term: number;
    amortization: number;
    ioPeriod: number;
    originationFee: number;
    rateCapCost: number;
    prepayPenalty: number;
  },
  capexBudget: number,
  dscrActual: number | null,
  dscrFloor: number,
): {
  financing: typeof financing;
  summary: M11CapitalStructureSummary;
} {
  const ltv = adjusted.purchasePrice > 0 ? adjusted.loanAmount / adjusted.purchasePrice : 0;
  const totalCost = adjusted.purchasePrice + (capexBudget > 0 ? capexBudget : 0);
  const ltc = totalCost > 0 ? adjusted.loanAmount / totalCost : ltv;
  const termYears = adjusted.term / 12;
  const amortYears = adjusted.amort / 12;
  const constraintBinds = dscrActual !== null && dscrActual < dscrFloor;

  // B5: binding constraint from the last M11 cycle (stored in meta if available)
  const bindingConstraint = (adjusted as any)._m11BindingConstraint ?? 'dscr';
  const constraintDetails = (adjusted as any)._m11ConstraintDetails ?? '';

  return {
    financing: {
      ...financing,
      loanAmount: adjusted.loanAmount,
      interestRate: adjusted.rate,
      term: termYears,
      amortization: amortYears,
      ioPeriod: adjusted.ioPeriod,
    },
    summary: {
      loanAmount: adjusted.loanAmount,
      ltv,
      ltc,
      rate: adjusted.rate,
      termYears,
      amortYears,
      ioPeriodMonths: adjusted.ioPeriod,
      dscrFloor,
      constraintBinds,
      dscrActual,
      bindingConstraint,
      constraintDetails,
    },
  };
}
