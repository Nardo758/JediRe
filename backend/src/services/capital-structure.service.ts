/**
 * Capital Structure Engine Service
 *
 * Backend service for the Capital Structure Engine (M11+).
 * Handles capital stack design, debt product selection, rate environment,
 * equity waterfall calculations, scenario comparison, and debt lifecycle.
 *
 * Uses Formula Engine (F40-F66) for all calculations.
 */

import { logger } from '../utils/logger';
import { executeFormula } from './module-wiring/formula-engine';

// ============================================================================
// Types
// ============================================================================

export type StrategyType = 'build_to_sell' | 'flip' | 'rental_value_add' | 'rental_stabilized' | 'str';

export type LayerType = 'senior' | 'mezz' | 'prefEquity' | 'gpEquity' | 'lpEquity' | 'incentive';

export type DebtProductType =
  | 'agency' | 'cmbs' | 'bank' | 'life_company' | 'bridge'
  | 'hard_money' | 'construction' | 'dscr_loan' | 'debt_fund' | 'mezz';

export type CyclePhase = 'easing' | 'trough' | 'tightening' | 'peak';

export interface CapitalLayer {
  id: string;
  name: string;
  layerType: LayerType;
  amount: number;
  percentage: number;
  rate: number;
  term: number;
  source: string;
  amortYears?: number;
  notes?: string;
}

export interface CapitalUses {
  acquisitionPrice: number;
  closingCosts: number;
  renovationBudget: number;
  carryingCosts: number;
  reserves: number;
  developerFee: number;
  total: number;
}

export interface StackMetrics {
  ltv: number;
  ltc: number;
  dscr: number;
  debtYield: number;
  equityRequired: number;
  totalDebt: number;
  totalEquity: number;
  weightedAvgCostOfCapital: number;
  cocReturn: number;
  breakEvenOccupancy: number;
  capitalRiskScore: number;
}

export interface CapitalStack {
  dealId: string;
  strategy: StrategyType;
  totalSources: number;
  totalUses: number;
  layers: CapitalLayer[];
  isBalanced: boolean;
  imbalance: number;
  uses: CapitalUses;
  metrics: StackMetrics;
}

export interface WaterfallTier {
  id: string;
  name: string;
  hurdleRate: number;
  gpSplit: number;
  lpSplit: number;
}

export interface EquityWaterfallConfig {
  lpCapital: number;
  gpCapital: number;
  totalEquity: number;
  lpPercentage: number;
  gpPercentage: number;
  preferredReturn: number;
  tiers: WaterfallTier[];
  catchUpProvision: boolean;
  catchUpPercentage: number;
  clawbackProvision: boolean;
}

export interface WaterfallDistributionResult {
  tierId: string;
  tierName: string;
  lpDistribution: number;
  gpDistribution: number;
  totalDistribution: number;
}

export interface WaterfallResult {
  distributions: WaterfallDistributionResult[];
  lpTotalReturn: number;
  gpTotalReturn: number;
  lpEquityMultiple: number;
  gpEquityMultiple: number;
  gpEffectiveShare: number;
  totalDistributed: number;
}

export interface ScenarioInput {
  id: string;
  name: string;
  layers: CapitalLayer[];
  uses: CapitalUses;
  noi: number;
  annualCashFlow: number;
  exitProceeds: number;
  holdYears: number;
  propertyValue: number;
  rateType: 'fixed' | 'floating';
  hasMezz: boolean;
}

export interface ScenarioResult {
  id: string;
  name: string;
  metrics: StackMetrics;
  returns: {
    irr: number;
    equityMultiple: number;
    cocReturn: number;
    dscr: number;
  };
  risks: {
    refinanceRisk: 'low' | 'medium' | 'high';
    interestRateRisk: 'low' | 'medium' | 'high';
    capitalRiskScore: number;
    covenantHeadroom: number;
  };
}

export interface DebtProduct {
  id: string;
  name: string;
  productType: DebtProductType;
  lender: string;
  rateType: 'fixed' | 'floating';
  rateRange: { min: number; max: number };
  spreadOverIndex?: number;
  indexName?: string;
  ltvMax: number;
  ltcMax?: number;
  term: { min: number; max: number };
  amortization: number;
  recourse: 'non-recourse' | 'partial' | 'full';
  prepaymentPenalty: string;
  dscrMin: number;
  assumable: boolean;
  closingTimeline: number;
  fees: { origination: number; closing: number; legal: number };
  bestForStrategies: StrategyType[];
  keyBenefit: string;
  keyRisk: string;
}

// ============================================================================
// Strategy × Debt Product Matrix
// ============================================================================

const STRATEGY_DEBT_MATRIX: Record<StrategyType, DebtProductType[]> = {
  build_to_sell: ['construction', 'bridge', 'hard_money', 'mezz'],
  flip: ['hard_money', 'bridge'],
  rental_value_add: ['bridge', 'bank', 'mezz', 'debt_fund'],
  rental_stabilized: ['agency', 'cmbs', 'life_company', 'bank'],
  str: ['dscr_loan', 'bank', 'hard_money'],
};

// ============================================================================
// Capital Structure Service
// ============================================================================

export class CapitalStructureService {

  /**
   * Build a full capital stack with metrics from layers and uses.
   */
  buildCapitalStack(
    dealId: string,
    strategy: StrategyType,
    layers: CapitalLayer[],
    uses: CapitalUses,
    noi: number,
    propertyValue: number,
    grossPotentialRent?: number,
  ): CapitalStack {
    logger.info('[CapStructure] Building capital stack', { dealId, strategy, layerCount: layers.length });

    const totalSources = layers.reduce((sum, l) => sum + l.amount, 0);

    // F46: Sources = Uses
    const balance = executeFormula('F46', { total_sources: totalSources, total_uses: uses.total });

    // Separate debt vs equity
    const debtLayerTypes: LayerType[] = ['senior', 'mezz'];
    const debtLayers = layers.filter(l => debtLayerTypes.includes(l.layerType));
    const equityLayers = layers.filter(l => !debtLayerTypes.includes(l.layerType));
    const totalDebt = debtLayers.reduce((sum, l) => sum + l.amount, 0);
    const totalEquity = equityLayers.reduce((sum, l) => sum + l.amount, 0);

    // F43: LTV
    const ltv = executeFormula('F43', { total_debt: totalDebt, property_value: propertyValue });

    // F44: LTC
    const ltc = executeFormula('F44', { total_debt: totalDebt, total_cost: uses.total });

    // F45: WACC
    const wacc = executeFormula('F45', { layers });

    // F64: Total Annual Debt Service
    const debtLayerInputs = debtLayers.map(l => ({
      amount: l.amount,
      rate: l.rate,
      amort_years: l.amortYears || 0,
    }));
    const totalAnnualDS = executeFormula('F64', { debt_layers: debtLayerInputs });

    // F21: DSCR (using total debt service)
    const dscr = totalAnnualDS > 0 ? parseFloat((noi / totalAnnualDS).toFixed(2)) : 0;

    // F22: Debt Yield
    const debtYield = executeFormula('F22', { noi, loan_amount: totalDebt });

    // F18: Cash-on-Cash
    const annualCashFlow = noi - totalAnnualDS;
    const cocReturn = totalEquity > 0 ? parseFloat(((annualCashFlow / totalEquity) * 100).toFixed(2)) : 0;

    // F63: Break-even occupancy
    const opex = grossPotentialRent ? grossPotentialRent - noi : noi * 0.45; // estimate if not provided
    const breakEvenOccupancy = grossPotentialRent
      ? executeFormula('F63', { opex, annual_debt_service: totalAnnualDS, gross_potential_rent: grossPotentialRent })
      : 0;

    // F62: Capital Risk Score
    const seniorLayer = debtLayers.find(l => l.layerType === 'senior');
    const capitalRiskScore = executeFormula('F62', {
      ltv,
      dscr,
      rate_type: seniorLayer?.rate ? 'fixed' : 'floating',
      hold_years: 5,
      loan_term_years: seniorLayer ? seniorLayer.term / 12 : 5,
      has_mezz: debtLayers.some(l => l.layerType === 'mezz'),
    });

    // Compute percentages for each layer
    const layersWithPct = layers.map(l => ({
      ...l,
      percentage: totalSources > 0 ? parseFloat(((l.amount / totalSources) * 100).toFixed(1)) : 0,
    }));

    return {
      dealId,
      strategy,
      totalSources,
      totalUses: uses.total,
      layers: layersWithPct,
      isBalanced: balance.balanced,
      imbalance: balance.imbalance,
      uses,
      metrics: {
        ltv,
        ltc,
        dscr,
        debtYield,
        equityRequired: totalEquity,
        totalDebt,
        totalEquity,
        weightedAvgCostOfCapital: wacc,
        cocReturn,
        breakEvenOccupancy,
        capitalRiskScore,
      },
    };
  }

  /**
   * Size senior debt using F40 triple constraint (LTC, LTV, DSCR).
   */
  sizeSeniorDebt(
    totalCost: number,
    maxLTC: number,
    noi: number,
    dscrMin: number,
    propertyValue: number,
    maxLTV: number,
    interestRate: number,
    amortYears: number,
  ): number {
    return executeFormula('F40', {
      total_cost: totalCost,
      max_ltc: maxLTC,
      noi,
      dscr_min: dscrMin,
      property_value: propertyValue,
      max_ltv: maxLTV,
      interest_rate: interestRate,
      amort_years: amortYears,
    });
  }

  /**
   * Size mezzanine debt using F41.
   */
  sizeMezzanine(totalCost: number, maxCombinedLTC: number, seniorDebt: number): number {
    return executeFormula('F41', {
      total_cost: totalCost,
      max_combined_ltc: maxCombinedLTC,
      senior_debt: seniorDebt,
    });
  }

  /**
   * Filter debt products by strategy using the Strategy × Debt Matrix.
   */
  getRecommendedProducts(strategy: StrategyType, allProducts: DebtProduct[]): {
    recommended: DebtProduct[];
    notRecommended: DebtProduct[];
  } {
    const allowedTypes = STRATEGY_DEBT_MATRIX[strategy] || [];
    const recommended = allProducts.filter(p => p.bestForStrategies.includes(strategy) || allowedTypes.includes(p.productType));
    const notRecommended = allProducts.filter(p => !p.bestForStrategies.includes(strategy) && !allowedTypes.includes(p.productType));
    return { recommended, notRecommended };
  }

  /**
   * Detect strategy/debt mismatches.
   */
  detectMismatches(strategy: StrategyType, debtProducts: DebtProduct[]): Array<{
    strategy: StrategyType;
    debtProduct: string;
    issue: string;
    suggestion: string;
  }> {
    const warnings: Array<{ strategy: StrategyType; debtProduct: string; issue: string; suggestion: string }> = [];
    const allowedTypes = STRATEGY_DEBT_MATRIX[strategy] || [];

    for (const product of debtProducts) {
      if (!allowedTypes.includes(product.productType) && !product.bestForStrategies.includes(strategy)) {
        let issue = `${product.name} is not typically used for ${strategy} deals.`;
        let suggestion = `Consider products from: ${allowedTypes.join(', ')}.`;

        // Strategy-specific mismatch warnings
        if (strategy === 'flip' && product.productType === 'agency') {
          issue = `Using a long-term fixed loan for a 6-12mo flip. Yield maintenance penalty will eat 3-5% of profit.`;
          suggestion = 'Switch to hard money or bridge with no prepayment penalty.';
        } else if (strategy === 'rental_stabilized' && product.rateType === 'floating') {
          issue = `Floating rate ${product.name} for stabilized hold creates cash flow uncertainty.`;
          suggestion = 'Refinance to agency permanent with fixed rate to lock in stable debt service.';
        } else if (strategy === 'str' && product.productType === 'agency') {
          issue = 'Agency loans often prohibit short-term rental use. May trigger covenant violation.';
          suggestion = 'Use DSCR loan specifically structured for STR properties.';
        }

        warnings.push({ strategy, debtProduct: product.name, issue, suggestion });
      }
    }

    return warnings;
  }

  /**
   * Classify rate cycle phase using F47.
   */
  classifyCyclePhase(fedDirection: string, durationMonths: number, yieldCurveSlope: number): CyclePhase {
    return executeFormula('F47', { fed_direction: fedDirection, duration_months: durationMonths, yield_curve_slope: yieldCurveSlope });
  }

  /**
   * Calculate all-in rate from index + spread using F48.
   */
  calcAllInRate(indexRate: number, spreadBps: number): number {
    return executeFormula('F48', { index_rate: indexRate, spread_bps: spreadBps });
  }

  /**
   * Lock vs Float analysis using F49.
   */
  analyzeLockVsFloat(
    loanAmount: number,
    lockRate: number,
    expectedFloatRates: number[],
    termMonths: number,
    discountRate: number,
  ): { lock_npv: number; float_npv: number; savings: number; recommendation: 'lock' | 'float' } {
    return executeFormula('F49', {
      loan_amount: loanAmount,
      lock_rate: lockRate,
      expected_float_rates: expectedFloatRates,
      term_months: termMonths,
      discount_rate: discountRate,
    });
  }

  /**
   * Spread percentile vs historical range using F50.
   */
  calcSpreadPercentile(currentSpread: number, fiveYearMin: number, fiveYearMax: number): number {
    return executeFormula('F50', { current_spread: currentSpread, five_year_min: fiveYearMin, five_year_max: fiveYearMax });
  }

  /**
   * Rate sensitivity analysis using F51.
   */
  calcRateSensitivityMatrix(
    loanAmount: number,
    holdYears: number,
    bpsSteps: number[] = [-200, -150, -100, -50, 0, 50, 100, 150, 200],
  ): Array<{ bpsChange: number; annualImpact: number; totalImpact: number }> {
    return bpsSteps.map(bps => ({
      bpsChange: bps,
      annualImpact: parseFloat((loanAmount * (bps / 10000)).toFixed(0)),
      totalImpact: executeFormula('F51', { loan_amount: loanAmount, rate_change_bps: bps, hold_years: holdYears }),
    }));
  }

  /**
   * Calculate full equity waterfall distribution.
   */
  calculateWaterfall(
    config: EquityWaterfallConfig,
    exitProceeds: number,
    holdYears: number,
    annualCashFlows: number[],
  ): WaterfallResult {
    logger.info('[CapStructure] Calculating waterfall', { totalEquity: config.totalEquity, exitProceeds });

    const distributions: WaterfallDistributionResult[] = [];
    let remainingProceeds = exitProceeds;
    let lpTotal = 0;
    let gpTotal = 0;

    // 1. Return of Capital
    const lpCapitalReturn = Math.min(remainingProceeds, config.lpCapital);
    const gpCapitalReturn = Math.min(remainingProceeds - lpCapitalReturn, config.gpCapital);
    remainingProceeds -= (lpCapitalReturn + gpCapitalReturn);
    lpTotal += lpCapitalReturn;
    gpTotal += gpCapitalReturn;
    distributions.push({
      tierId: 'return-of-capital',
      tierName: 'Return of Capital',
      lpDistribution: lpCapitalReturn,
      gpDistribution: gpCapitalReturn,
      totalDistribution: lpCapitalReturn + gpCapitalReturn,
    });

    // 2. Preferred Return (F54)
    const prefReturn = executeFormula('F54', {
      lp_capital: config.lpCapital,
      pref_rate: config.preferredReturn,
      years: holdYears,
    });
    // Subtract already-distributed annual cash flows (LP share)
    const annualLPCash = annualCashFlows.reduce((sum, cf) => sum + cf * config.lpPercentage / 100, 0);
    const prefAccrued = Math.max(0, prefReturn - annualLPCash);
    const prefDistributed = Math.min(remainingProceeds, prefAccrued);
    remainingProceeds -= prefDistributed;
    lpTotal += prefDistributed;
    distributions.push({
      tierId: 'preferred-return',
      tierName: `Preferred Return (${config.preferredReturn}%)`,
      lpDistribution: prefDistributed,
      gpDistribution: 0,
      totalDistribution: prefDistributed,
    });

    // 3. GP Catch-Up (F55)
    if (config.catchUpProvision && remainingProceeds > 0) {
      const catchUp = executeFormula('F55', {
        pref_distributed_to_lp: prefDistributed,
        catch_up_pct: config.catchUpPercentage,
        gp_target_split: config.tiers[0]?.gpSplit || 0.20,
      });
      const catchUpDist = Math.min(remainingProceeds, catchUp);
      remainingProceeds -= catchUpDist;
      gpTotal += catchUpDist;
      distributions.push({
        tierId: 'catch-up',
        tierName: `GP Catch-Up (${config.catchUpPercentage}%)`,
        lpDistribution: 0,
        gpDistribution: catchUpDist,
        totalDistribution: catchUpDist,
      });
    }

    // 4. Tiered Promote Splits (F56)
    for (const tier of config.tiers) {
      if (remainingProceeds <= 0) break;
      const tierDist = executeFormula('F56', {
        distributable_amount: remainingProceeds,
        gp_split: tier.gpSplit,
        lp_split: tier.lpSplit,
      });
      lpTotal += tierDist.lp_distribution;
      gpTotal += tierDist.gp_distribution;
      distributions.push({
        tierId: tier.id,
        tierName: tier.name,
        lpDistribution: tierDist.lp_distribution,
        gpDistribution: tierDist.gp_distribution,
        totalDistribution: tierDist.total,
      });
      remainingProceeds = 0; // all distributed at final tier
    }

    const totalDistributed = lpTotal + gpTotal;

    // F57: LP Equity Multiple
    const lpEquityMultiple = executeFormula('F57', { total_lp_distributions: lpTotal, lp_capital: config.lpCapital });

    // GP equity multiple
    const gpEquityMultiple = config.gpCapital > 0 ? parseFloat((gpTotal / config.gpCapital).toFixed(2)) : 0;

    // F58: GP Effective Share
    const gpEffectiveShare = executeFormula('F58', { gp_distributions: gpTotal, total_distributions: totalDistributed });

    return {
      distributions,
      lpTotalReturn: lpTotal,
      gpTotalReturn: gpTotal,
      lpEquityMultiple,
      gpEquityMultiple,
      gpEffectiveShare,
      totalDistributed,
    };
  }

  /**
   * Compare multiple capital structure scenarios.
   */
  compareScenarios(scenarios: ScenarioInput[], noi: number, propertyValue: number): {
    results: ScenarioResult[];
    bestIRR: string;
    bestCoC: string;
    lowestRisk: string;
    delta: { irr: number; equityMultiple: number; dscr: number };
  } {
    logger.info('[CapStructure] Comparing scenarios', { count: scenarios.length });

    const results: ScenarioResult[] = scenarios.map(scenario => {
      const debtLayers = scenario.layers.filter(l => l.layerType === 'senior' || l.layerType === 'mezz');
      const equityLayers = scenario.layers.filter(l => l.layerType !== 'senior' && l.layerType !== 'mezz');
      const totalDebt = debtLayers.reduce((sum, l) => sum + l.amount, 0);
      const totalEquity = equityLayers.reduce((sum, l) => sum + l.amount, 0);
      const seniorLayer = debtLayers.find(l => l.layerType === 'senior');
      const seniorRate = seniorLayer?.rate || 0;

      // F60: Scenario Returns
      const returns = executeFormula('F60', {
        noi,
        total_equity: totalEquity,
        annual_cash_flow: scenario.annualCashFlow,
        exit_proceeds: scenario.exitProceeds,
        loan_amount: totalDebt,
        interest_rate: seniorRate,
        amort_years: seniorLayer?.amortYears || 30,
        hold_years: scenario.holdYears,
      });

      // F62: Risk Score
      const capitalRiskScore = executeFormula('F62', {
        ltv: propertyValue > 0 ? (totalDebt / propertyValue) * 100 : 0,
        dscr: returns.dscr,
        rate_type: scenario.rateType,
        hold_years: scenario.holdYears,
        loan_term_years: seniorLayer ? seniorLayer.term / 12 : scenario.holdYears,
        has_mezz: scenario.hasMezz,
      });

      const ltv = propertyValue > 0 ? parseFloat(((totalDebt / propertyValue) * 100).toFixed(1)) : 0;
      const ltc = scenario.uses.total > 0 ? parseFloat(((totalDebt / scenario.uses.total) * 100).toFixed(1)) : 0;
      const wacc = executeFormula('F45', { layers: scenario.layers });
      const debtYield = executeFormula('F22', { noi, loan_amount: totalDebt });

      return {
        id: scenario.id,
        name: scenario.name,
        metrics: {
          ltv,
          ltc,
          dscr: returns.dscr,
          debtYield,
          equityRequired: totalEquity,
          totalDebt,
          totalEquity,
          weightedAvgCostOfCapital: wacc,
          cocReturn: returns.coc_return,
          breakEvenOccupancy: 0,
          capitalRiskScore,
        },
        returns: {
          irr: returns.coc_return * 1.15, // simplified IRR proxy
          equityMultiple: returns.equity_multiple,
          cocReturn: returns.coc_return,
          dscr: returns.dscr,
        },
        risks: {
          refinanceRisk: capitalRiskScore > 50 ? 'high' : capitalRiskScore > 25 ? 'medium' : 'low',
          interestRateRisk: scenario.rateType === 'floating' ? 'high' : 'low',
          capitalRiskScore,
          covenantHeadroom: parseFloat(((returns.dscr - 1.25) * 100).toFixed(0)),
        },
      };
    });

    // Find best scenario by metric
    const bestIRR = results.reduce((best, r) => r.returns.irr > best.returns.irr ? r : best).id;
    const bestCoC = results.reduce((best, r) => r.returns.cocReturn > best.returns.cocReturn ? r : best).id;
    const lowestRisk = results.reduce((best, r) => r.risks.capitalRiskScore < best.risks.capitalRiskScore ? r : best).id;

    // F61: Delta between best and worst
    const irrs = results.map(r => r.returns.irr);
    const ems = results.map(r => r.returns.equityMultiple);
    const dscrs = results.map(r => r.returns.dscr);

    const delta = {
      irr: parseFloat((Math.max(...irrs) - Math.min(...irrs)).toFixed(2)),
      equityMultiple: parseFloat((Math.max(...ems) - Math.min(...ems)).toFixed(2)),
      dscr: parseFloat((Math.max(...dscrs) - Math.min(...dscrs)).toFixed(2)),
    };

    return { results, bestIRR, bestCoC, lowestRisk, delta };
  }

  /**
   * Calculate refinance proceeds using F65.
   */
  calcRefiProceeds(stabilizedValue: number, refiLTV: number, existingDebt: number): number {
    return executeFormula('F65', { stabilized_value: stabilizedValue, refi_ltv: refiLTV, existing_debt: existingDebt });
  }

  /**
   * Calculate construction draw progress using F66.
   */
  calcDrawProgress(draws: number[], totalCommitment: number): number {
    return executeFormula('F66', { draws, total_commitment: totalCommitment });
  }

  /**
   * Generate insights from stack metrics following Data → Insight → Action pattern.
   */
  generateInsights(metrics: StackMetrics): Array<{
    metric: string;
    value: string;
    insight: string;
    severity: 'info' | 'success' | 'warning' | 'danger';
    action?: { label: string; handler: string };
  }> {
    const insights: Array<{ metric: string; value: string; insight: string; severity: 'info' | 'success' | 'warning' | 'danger'; action?: { label: string; handler: string } }> = [];

    // DSCR insight
    if (metrics.dscr < 1.15) {
      insights.push({
        metric: 'DSCR',
        value: `${metrics.dscr}x`,
        insight: `DSCR below 1.15x — high risk of covenant breach. Most lenders require minimum 1.25x.`,
        severity: 'danger',
        action: { label: 'Reduce Leverage →', handler: 'reduce-leverage' },
      });
    } else if (metrics.dscr < 1.25) {
      insights.push({
        metric: 'DSCR',
        value: `${metrics.dscr}x`,
        insight: `DSCR tight at ${metrics.dscr}x. A 50bps rate increase could push below covenant minimum.`,
        severity: 'warning',
        action: { label: 'Run Rate Sensitivity →', handler: 'rate-sensitivity' },
      });
    } else {
      insights.push({
        metric: 'DSCR',
        value: `${metrics.dscr}x`,
        insight: `Healthy DSCR with ${((metrics.dscr - 1.25) * 100).toFixed(0)}bps headroom above typical 1.25x minimum.`,
        severity: 'success',
      });
    }

    // LTV insight
    if (metrics.ltv > 80) {
      insights.push({
        metric: 'LTV',
        value: `${metrics.ltv}%`,
        insight: 'LTV exceeds 80% — most permanent lenders will not qualify. Bridge or mezz required.',
        severity: 'danger',
      });
    } else if (metrics.ltv > 75) {
      insights.push({
        metric: 'LTV',
        value: `${metrics.ltv}%`,
        insight: 'LTV above 75% — limits lender options to bridge/bank. Agency max is typically 80% for value-add.',
        severity: 'warning',
      });
    } else {
      insights.push({
        metric: 'LTV',
        value: `${metrics.ltv}%`,
        insight: `Conservative leverage at ${metrics.ltv}%. Qualifies for most permanent loan products.`,
        severity: 'success',
      });
    }

    // WACC insight
    if (metrics.weightedAvgCostOfCapital > 9) {
      insights.push({
        metric: 'WACC',
        value: `${metrics.weightedAvgCostOfCapital}%`,
        insight: 'High blended cost of capital. Consider removing mezzanine or reducing leverage to lower WACC.',
        severity: 'warning',
        action: { label: 'Compare Without Mezz →', handler: 'remove-mezz-scenario' },
      });
    }

    // Risk score
    if (metrics.capitalRiskScore > 60) {
      insights.push({
        metric: 'Risk Score',
        value: `${metrics.capitalRiskScore}/100`,
        insight: 'Capital structure risk is elevated. Review leverage, rate exposure, and term matching.',
        severity: 'danger',
        action: { label: 'View Risk Breakdown →', handler: 'risk-breakdown' },
      });
    }

    return insights;
  }
}

// Singleton export
export const capitalStructureService = new CapitalStructureService();
