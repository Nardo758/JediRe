/**
 * Strategy Arbitrage Engine (Module M08)
 *
 * Simultaneously analyzes all 4 investment strategies for every deal:
 *   - Build-to-Sell (BTS)
 *   - Flip
 *   - Rental (Long-term hold)
 *   - Short-Term Rental (STR)
 *
 * Uses the Strategy Signal Weights matrix (Blueprint Sheet 6) to score each strategy
 * based on 5 signal inputs (Demand, Supply, Momentum, Position, Risk).
 * Flags arbitrage opportunities when the gap between top strategies exceeds 15 points.
 */

import { executeFormula } from './formula-engine';
import { dataFlowRouter } from './data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-event-bus';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type StrategyType = 'build_to_sell' | 'flip' | 'rental' | 'str';

export interface StrategyWeights {
  demand_score: number;
  supply_score: number;
  momentum_score: number;
  position_score: number;
  risk_score: number;
}

export interface StrategyAnalysis {
  strategy: StrategyType;
  label: string;
  score: number;
  rank: number;
  signalContributions: Record<string, number>;
  keyIndicators: string[];
  roi?: number;
}

export interface ArbitrageResult {
  dealId: string;
  strategies: StrategyAnalysis[];
  recommended: StrategyType;
  recommendedScore: number;
  secondBest: StrategyType;
  secondBestScore: number;
  arbitrageFlag: boolean;
  arbitrageDelta: number;
  roiComparison: Record<StrategyType, number>;
  timestamp: Date;
}

export interface DemandBudgetInput {
  avg: number;
  median: number;
  min: number;
  max: number;
}

export interface StrategySignalInputs {
  demandScore: number;
  supplyScore: number;
  momentumScore: number;
  positionScore: number;
  riskScore: number;
  budgetDistribution?: DemandBudgetInput;
  bedroomDemand?: { studio: number; oneBed: number; twoBed: number; threePlusBed: number };
}

// ============================================================================
// Strategy Signal Weights Matrix (from Blueprint Sheet 6)
// ============================================================================

export const STRATEGY_WEIGHTS: Record<StrategyType, StrategyWeights> = {
  build_to_sell: {
    demand_score: 0.30,
    supply_score: 0.25,
    momentum_score: 0.20,
    position_score: 0.15,
    risk_score: 0.10,
  },
  flip: {
    demand_score: 0.15,
    supply_score: 0.20,
    momentum_score: 0.30,
    position_score: 0.20,
    risk_score: 0.15,
  },
  rental: {
    demand_score: 0.30,
    supply_score: 0.25,
    momentum_score: 0.20,
    position_score: 0.15,
    risk_score: 0.10,
  },
  str: {
    demand_score: 0.25,
    supply_score: 0.20,
    momentum_score: 0.25,
    position_score: 0.20,
    risk_score: 0.10,
  },
};

export const STRATEGY_LABELS: Record<StrategyType, string> = {
  build_to_sell: 'Build-to-Sell',
  flip: 'Flip',
  rental: 'Rental (Long-term)',
  str: 'Short-Term Rental',
};

export const KEY_INDICATORS: Record<StrategyType, string[]> = {
  build_to_sell: [
    'Absorption rate > supply pipeline',
    'Price appreciation accelerating',
    'Entitled land available',
    'Construction cost stability',
  ],
  flip: [
    'Distressed inventory rising',
    'Days on market declining',
    'Below-market distressed deals',
    'Renovation cost certainty',
  ],
  rental: [
    'Rent growth > inflation',
    'Vacancy rate declining',
    'Cash flow positive at acquisition',
    'Tenant quality/default risk low',
  ],
  str: [
    'Tourism/business travel trends up',
    'STR permit availability confirmed',
    'ADR growth rate positive',
    'Regulatory environment favorable',
  ],
};

// ============================================================================
// Strategy Arbitrage Engine
// ============================================================================

class StrategyArbitrageEngine {
  /**
   * Run full 4-strategy analysis for a deal.
   * Gathers signal inputs from upstream modules and scores each strategy.
   */
  async analyze(dealId: string, signals?: StrategySignalInputs): Promise<ArbitrageResult> {
    // Get signal inputs from data flow router, or use provided signals
    const signalInputs = signals || this.gatherSignals(dealId);

    logger.info('Strategy arbitrage analysis started', {
      dealId,
      signals: signalInputs,
    });

    // Score each strategy
    const strategies: StrategyAnalysis[] = [];

    for (const strategyType of Object.keys(STRATEGY_WEIGHTS) as StrategyType[]) {
      const weights = STRATEGY_WEIGHTS[strategyType];
      const analysis = this.scoreStrategy(strategyType, signalInputs, weights);
      strategies.push(analysis);
    }

    // Sort by score descending
    strategies.sort((a, b) => b.score - a.score);

    // Assign ranks
    strategies.forEach((s, i) => { s.rank = i + 1; });

    // Detect arbitrage opportunity
    const recommended = strategies[0];
    const secondBest = strategies[1];
    const arbitrageDelta = recommended.score - secondBest.score;
    const arbitrageFlag = arbitrageDelta > 15 && recommended.score > 70;

    // Build ROI comparison (placeholder values - would come from M09)
    const roiComparison = {} as Record<StrategyType, number>;
    for (const s of strategies) {
      roiComparison[s.strategy] = s.roi || 0;
    }

    const result: ArbitrageResult = {
      dealId,
      strategies,
      recommended: recommended.strategy,
      recommendedScore: recommended.score,
      secondBest: secondBest.strategy,
      secondBestScore: secondBest.score,
      arbitrageFlag,
      arbitrageDelta: parseFloat(arbitrageDelta.toFixed(2)),
      roiComparison,
      timestamp: new Date(),
    };

    // Publish results to data flow router
    dataFlowRouter.publishModuleData('M08', dealId, {
      strategy_scores: Object.fromEntries(strategies.map(s => [s.strategy, s.score])),
      roi_comparison_matrix: roiComparison,
      recommended_strategy: recommended.strategy,
      arbitrage_flag: arbitrageFlag,
      arbitrage_delta: arbitrageDelta,
    });

    // Emit arbitrage alert if detected
    if (arbitrageFlag) {
      moduleEventBus.emit({
        type: ModuleEventType.ARBITRAGE_DETECTED,
        sourceModule: 'M08',
        dealId,
        data: {
          recommended: recommended.strategy,
          recommended_score: recommended.score,
          delta: arbitrageDelta,
        },
        timestamp: new Date(),
      });
    }

    logger.info('Strategy arbitrage analysis complete', {
      dealId,
      recommended: recommended.strategy,
      recommendedScore: recommended.score,
      arbitrageFlag,
      arbitrageDelta,
    });

    return result;
  }

  /**
   * Score a single strategy based on signal inputs and strategy-specific weights.
   */
  private scoreStrategy(
    strategyType: StrategyType,
    signals: StrategySignalInputs,
    weights: StrategyWeights,
  ): StrategyAnalysis {
    const signalContributions: Record<string, number> = {};

    const demandContrib = signals.demandScore * weights.demand_score;
    const supplyContrib = signals.supplyScore * weights.supply_score;
    const momentumContrib = signals.momentumScore * weights.momentum_score;
    const positionContrib = signals.positionScore * weights.position_score;
    const riskContrib = signals.riskScore * weights.risk_score;

    signalContributions.demand = parseFloat(demandContrib.toFixed(2));
    signalContributions.supply = parseFloat(supplyContrib.toFixed(2));
    signalContributions.momentum = parseFloat(momentumContrib.toFixed(2));
    signalContributions.position = parseFloat(positionContrib.toFixed(2));
    signalContributions.risk = parseFloat(riskContrib.toFixed(2));

    let score = demandContrib + supplyContrib + momentumContrib + positionContrib + riskContrib;

    if (signals.budgetDistribution && signals.budgetDistribution.avg > 0) {
      const avgBudget = signals.budgetDistribution.avg;
      const budgetSpread = signals.budgetDistribution.max - signals.budgetDistribution.min;

      if (strategyType === 'rental' && avgBudget > 1500) {
        score += Math.min(3, (avgBudget - 1500) / 500);
        signalContributions.budget_enrichment = parseFloat(Math.min(3, (avgBudget - 1500) / 500).toFixed(2));
      }

      if (strategyType === 'str' && avgBudget > 2000) {
        score += Math.min(2, (avgBudget - 2000) / 1000);
        signalContributions.budget_enrichment = parseFloat(Math.min(2, (avgBudget - 2000) / 1000).toFixed(2));
      }

      if (strategyType === 'build_to_sell' && budgetSpread > 1000) {
        score += Math.min(2, budgetSpread / 2000);
        signalContributions.budget_enrichment = parseFloat(Math.min(2, budgetSpread / 2000).toFixed(2));
      }
    }

    if (signals.bedroomDemand) {
      const bd = signals.bedroomDemand;
      const totalDemand = (bd.studio || 0) + (bd.oneBed || 0) + (bd.twoBed || 0) + (bd.threePlusBed || 0);
      if (totalDemand > 0) {
        const familyDemandRatio = ((bd.twoBed || 0) + (bd.threePlusBed || 0)) / totalDemand;
        if (strategyType === 'build_to_sell' && familyDemandRatio > 0.4) {
          score += 2;
          signalContributions.bedroom_enrichment = 2;
        }
        if (strategyType === 'rental' && (bd.oneBed || 0) / totalDemand > 0.4) {
          score += 1.5;
          signalContributions.bedroom_enrichment = 1.5;
        }
      }
    }

    return {
      strategy: strategyType,
      label: STRATEGY_LABELS[strategyType],
      score: parseFloat(Math.max(0, Math.min(100, score)).toFixed(2)),
      rank: 0,
      signalContributions,
      keyIndicators: KEY_INDICATORS[strategyType],
    };
  }

  /**
   * Gather signal scores from upstream modules via data flow router.
   */
  private gatherSignals(dealId: string): StrategySignalInputs {
    const flowResult = dataFlowRouter.gatherInputs('M08', dealId);
    const allInputs = { ...flowResult.optionalInputs, ...flowResult.requiredInputs };

    return {
      demandScore: allInputs.demand_score ?? 50,
      supplyScore: allInputs.supply_pressure_score
        ? (100 - allInputs.supply_pressure_score)
        : 50,
      momentumScore: allInputs.rent_growth_pct
        ? Math.max(0, Math.min(100, 50 + (allInputs.rent_growth_pct - 3) * 17))
        : 50,
      positionScore: allInputs.submarket_rank ?? 50,
      riskScore: allInputs.composite_risk_score
        ? (100 - allInputs.composite_risk_score)
        : 50,
      budgetDistribution: allInputs.budget_distribution || undefined,
      bedroomDemand: allInputs.bedroom_demand || undefined,
    };
  }

  /**
   * Compare two strategies head-to-head across all signal dimensions.
   */
  compareStrategies(
    strategyA: StrategyType,
    strategyB: StrategyType,
    signals: StrategySignalInputs,
  ): { winner: StrategyType; margin: number; breakdown: Record<string, { a: number; b: number; delta: number }> } {
    const analysisA = this.scoreStrategy(strategyA, signals, STRATEGY_WEIGHTS[strategyA]);
    const analysisB = this.scoreStrategy(strategyB, signals, STRATEGY_WEIGHTS[strategyB]);

    const breakdown: Record<string, { a: number; b: number; delta: number }> = {};
    for (const signal of ['demand', 'supply', 'momentum', 'position', 'risk']) {
      const a = analysisA.signalContributions[signal] || 0;
      const b = analysisB.signalContributions[signal] || 0;
      breakdown[signal] = { a, b, delta: a - b };
    }

    return {
      winner: analysisA.score >= analysisB.score ? strategyA : strategyB,
      margin: parseFloat(Math.abs(analysisA.score - analysisB.score).toFixed(2)),
      breakdown,
    };
  }

  /**
   * Get strategy weights (allows user customization in future).
   */
  getStrategyWeights(): Record<StrategyType, StrategyWeights> {
    return { ...STRATEGY_WEIGHTS };
  }

  /**
   * Adjust strategy scores based on zoning envelope data from M02.
   *
   * When a development path is selected, it modifies the feasibility of each strategy:
   * - by_right: boosts BTS (fast to market), slightly boosts Rental
   * - overlay_bonus: boosts BTS and Rental (more units, moderate timeline)
   * - variance: neutral-to-positive across strategies
   * - rezone: boosts BTS (max density), penalizes STR (regulatory risk)
   *
   * @returns Adjusted ArbitrageResult with envelope-aware scores
   */
  async analyzeWithEnvelope(
    dealId: string,
    envelope: {
      development_path: string;
      max_units: number;
      max_gfa_sf: number;
      entitlement_timeline_months: number;
      entitlement_risk_score?: number;
    },
    signals?: StrategySignalInputs,
  ): Promise<ArbitrageResult> {
    // Start with base analysis
    const baseResult = await this.analyze(dealId, signals);

    // Apply envelope-based adjustments
    const pathAdjustments: Record<string, Record<StrategyType, number>> = {
      by_right: { build_to_sell: 8, flip: 2, rental: 5, str: 3 },
      overlay_bonus: { build_to_sell: 6, flip: 1, rental: 7, str: 2 },
      variance: { build_to_sell: 3, flip: 2, rental: 4, str: 1 },
      rezone: { build_to_sell: 10, flip: -2, rental: 5, str: -5 },
    };

    const adjustments = pathAdjustments[envelope.development_path] || {};

    // Timeline penalty: longer entitlement = penalize time-sensitive strategies
    const timelinePenalty = Math.min(10, envelope.entitlement_timeline_months * 0.5);
    const timelineSensitivity: Record<StrategyType, number> = {
      build_to_sell: 0.7,
      flip: 1.0,
      rental: 0.3,
      str: 0.8,
    };

    // Scale boost: more units = more opportunity for BTS/Rental
    const scaleBonus = envelope.max_units > 200 ? 5 : envelope.max_units > 100 ? 3 : 0;
    const scaleAffinity: Record<StrategyType, number> = {
      build_to_sell: 1.0,
      flip: 0,
      rental: 0.8,
      str: 0.3,
    };

    // Apply adjustments
    for (const strategy of baseResult.strategies) {
      const pathAdj = adjustments[strategy.strategy] || 0;
      const timePen = timelinePenalty * (timelineSensitivity[strategy.strategy] || 0.5);
      const scaleAdj = scaleBonus * (scaleAffinity[strategy.strategy] || 0);
      const riskAdj = (envelope.entitlement_risk_score ?? 0) * -0.1;

      strategy.score = parseFloat(
        Math.max(0, Math.min(100, strategy.score + pathAdj - timePen + scaleAdj + riskAdj)).toFixed(2)
      );
    }

    // Re-sort and re-rank
    baseResult.strategies.sort((a, b) => b.score - a.score);
    baseResult.strategies.forEach((s, i) => { s.rank = i + 1; });

    // Update recommended
    const recommended = baseResult.strategies[0];
    const secondBest = baseResult.strategies[1];
    baseResult.recommended = recommended.strategy;
    baseResult.recommendedScore = recommended.score;
    baseResult.secondBest = secondBest.strategy;
    baseResult.secondBestScore = secondBest.score;
    baseResult.arbitrageDelta = parseFloat((recommended.score - secondBest.score).toFixed(2));
    baseResult.arbitrageFlag = baseResult.arbitrageDelta > 15 && recommended.score > 70;

    // Re-publish with envelope context
    dataFlowRouter.publishModuleData('M08', dealId, {
      strategy_scores: Object.fromEntries(baseResult.strategies.map(s => [s.strategy, s.score])),
      roi_comparison_matrix: baseResult.roiComparison,
      recommended_strategy: recommended.strategy,
      arbitrage_flag: baseResult.arbitrageFlag,
      arbitrage_delta: baseResult.arbitrageDelta,
      envelope_adjusted: true,
      development_path: envelope.development_path,
    });

    logger.info('Strategy analysis with envelope complete', {
      dealId,
      path: envelope.development_path,
      recommended: recommended.strategy,
      score: recommended.score,
    });

    return baseResult;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const strategyArbitrageEngine = new StrategyArbitrageEngine();
