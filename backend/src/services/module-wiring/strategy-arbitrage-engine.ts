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

export interface StrategySignalInputs {
  demandScore: number;
  supplyScore: number;
  momentumScore: number;
  positionScore: number;
  riskScore: number;
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

    const score = demandContrib + supplyContrib + momentumContrib + positionContrib + riskContrib;

    return {
      strategy: strategyType,
      label: STRATEGY_LABELS[strategyType],
      score: parseFloat(Math.max(0, Math.min(100, score)).toFixed(2)),
      rank: 0, // assigned after sorting
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
        ? (100 - allInputs.supply_pressure_score) // Invert: lower pressure = higher score
        : 50,
      momentumScore: allInputs.rent_growth_pct
        ? Math.max(0, Math.min(100, 50 + (allInputs.rent_growth_pct - 3) * 17))
        : 50,
      positionScore: allInputs.submarket_rank ?? 50,
      riskScore: allInputs.composite_risk_score
        ? (100 - allInputs.composite_risk_score) // Invert: lower risk = higher score
        : 50,
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
}

// ============================================================================
// Export Singleton
// ============================================================================

export const strategyArbitrageEngine = new StrategyArbitrageEngine();
