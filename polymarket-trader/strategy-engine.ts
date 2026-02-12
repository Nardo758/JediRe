/**
 * Multi-Strategy Trading Engine for Polymarket
 * Expands beyond simple arbitrage to multiple opportunity types
 */

export interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  category?: string;
}

export interface OpportunitySignal {
  type: 'arbitrage' | 'value' | 'momentum' | 'event' | 'high_conviction' | 'underdog';
  confidence: number; // 0-100
  expectedReturn: number; // Percentage
  reasoning: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface TradingOpportunity {
  market: Market;
  signals: OpportunitySignal[];
  overallScore: number; // 0-100
  recommendedAction: 'BUY_YES' | 'BUY_NO' | 'PASS';
  recommendedSize: number;
  analysis: string;
}

export class StrategyEngine {
  private minConfidence: number;
  private minReturn: number;

  constructor(config: { minConfidence?: number; minReturn?: number } = {}) {
    this.minConfidence = config.minConfidence || 60;
    this.minReturn = config.minReturn || 2; // 2% minimum return
  }

  /**
   * Analyze market for all opportunity types
   */
  async analyzeMarket(
    market: Market,
    grokSentiment?: any,
    claudeRisk?: any
  ): Promise<TradingOpportunity | null> {
    const signals: OpportunitySignal[] = [];

    // Strategy 1: Arbitrage
    const arbSignal = this.checkArbitrage(market);
    if (arbSignal) signals.push(arbSignal);

    // Strategy 2: Value Betting
    const valueSignal = this.checkValueBet(market, grokSentiment);
    if (valueSignal) signals.push(valueSignal);

    // Strategy 3: Momentum
    const momentumSignal = this.checkMomentum(market);
    if (momentumSignal) signals.push(momentumSignal);

    // Strategy 4: High Conviction
    const convictionSignal = this.checkHighConviction(market, grokSentiment);
    if (convictionSignal) signals.push(convictionSignal);

    // Strategy 5: Underdog
    const underdogSignal = this.checkUnderdog(market);
    if (underdogSignal) signals.push(underdogSignal);

    // If no signals, no opportunity
    if (signals.length === 0) return null;

    // Calculate overall score
    const overallScore = this.calculateOverallScore(signals);

    // Filter out low quality opportunities
    if (overallScore < 50) return null;

    // Determine action and size
    const { action, size } = this.determineAction(signals, market);

    return {
      market,
      signals,
      overallScore,
      recommendedAction: action,
      recommendedSize: size,
      analysis: this.generateAnalysis(signals, market),
    };
  }

  /**
   * Strategy 1: Arbitrage (original)
   */
  private checkArbitrage(market: Market): OpportunitySignal | null {
    const spread = 100 - (market.yesPrice + market.noPrice);

    if (Math.abs(spread) >= 3) {
      return {
        type: 'arbitrage',
        confidence: 90,
        expectedReturn: Math.abs(spread),
        reasoning: `Price inefficiency: YES ${market.yesPrice}% + NO ${market.noPrice}% = ${
          market.yesPrice + market.noPrice
        }% (should be ~100%)`,
        urgency: 'high',
      };
    }

    return null;
  }

  /**
   * Strategy 2: Value Betting
   */
  private checkValueBet(market: Market, grokSentiment?: any): OpportunitySignal | null {
    if (!grokSentiment) return null;

    // Compare market price to Grok's assessed probability
    const marketImpliedProb = market.yesPrice;
    const grokProb = grokSentiment.bullishProbability || 50;
    const divergence = Math.abs(marketImpliedProb - grokProb);

    // Significant mispricing?
    if (divergence >= 15) {
      const undervalued = grokProb > marketImpliedProb;

      return {
        type: 'value',
        confidence: Math.min(95, grokSentiment.confidence || 70),
        expectedReturn: divergence * 0.8, // Conservative estimate
        reasoning: `Market prices YES at ${marketImpliedProb}% but AI analysis suggests ${grokProb}% probability. ${
          undervalued ? 'UNDERVALUED' : 'OVERVALUED'
        } by ${divergence.toFixed(1)}%.`,
        urgency: divergence > 25 ? 'high' : 'medium',
      };
    }

    return null;
  }

  /**
   * Strategy 3: Momentum
   */
  private checkMomentum(market: Market): OpportunitySignal | null {
    // Would need historical price data - placeholder for now
    // In production, track price changes over time

    // For now, check volume as proxy for momentum
    if (market.volume > 100000) {
      return {
        type: 'momentum',
        confidence: 65,
        expectedReturn: 3,
        reasoning: `High trading volume ($${(market.volume / 1000).toFixed(0)}k) indicates strong market momentum.`,
        urgency: 'medium',
      };
    }

    return null;
  }

  /**
   * Strategy 4: High Conviction
   */
  private checkHighConviction(market: Market, grokSentiment?: any): OpportunitySignal | null {
    if (!grokSentiment) return null;

    const confidence = grokSentiment.confidence || 0;

    // Very high confidence from AI?
    if (confidence >= 85) {
      return {
        type: 'high_conviction',
        confidence: confidence,
        expectedReturn: 5,
        reasoning: `Extremely high AI confidence (${confidence}%): ${
          grokSentiment.reasoning || 'Strong signal from analysis'
        }`,
        urgency: 'high',
      };
    }

    return null;
  }

  /**
   * Strategy 5: Underdog
   */
  private checkUnderdog(market: Market): OpportunitySignal | null {
    // Look for long-shot bets with good risk/reward
    const yesOdds = market.yesPrice;
    const noOdds = market.noPrice;

    // Either side < 20%?
    if (yesOdds < 20 && yesOdds > 5) {
      const potentialReturn = (100 - yesOdds) / yesOdds;
      return {
        type: 'underdog',
        confidence: 40,
        expectedReturn: potentialReturn * 10, // Scale to percentage
        reasoning: `Long-shot opportunity: YES at ${yesOdds}% offers ${potentialReturn.toFixed(
          1
        )}x return if correct. High risk, high reward.`,
        urgency: 'low',
      };
    }

    if (noOdds < 20 && noOdds > 5) {
      const potentialReturn = (100 - noOdds) / noOdds;
      return {
        type: 'underdog',
        confidence: 40,
        expectedReturn: potentialReturn * 10,
        reasoning: `Long-shot opportunity: NO at ${noOdds}% offers ${potentialReturn.toFixed(
          1
        )}x return if correct. High risk, high reward.`,
        urgency: 'low',
      };
    }

    return null;
  }

  /**
   * Calculate overall opportunity score
   */
  private calculateOverallScore(signals: OpportunitySignal[]): number {
    if (signals.length === 0) return 0;

    // Weighted average of signals
    let totalScore = 0;
    let totalWeight = 0;

    signals.forEach((signal) => {
      const weight = this.getSignalWeight(signal.type);
      totalScore += signal.confidence * weight;
      totalWeight += weight;
    });

    return Math.round(totalScore / totalWeight);
  }

  /**
   * Get weight for signal type
   */
  private getSignalWeight(type: OpportunitySignal['type']): number {
    const weights: Record<OpportunitySignal['type'], number> = {
      arbitrage: 1.5, // Highest weight - most reliable
      value: 1.3,
      high_conviction: 1.2,
      momentum: 1.0,
      event: 1.1,
      underdog: 0.7, // Lowest weight - highest risk
    };
    return weights[type] || 1.0;
  }

  /**
   * Determine action and position size
   */
  private determineAction(
    signals: OpportunitySignal[],
    market: Market
  ): { action: 'BUY_YES' | 'BUY_NO' | 'PASS'; size: number } {
    // Count bullish vs bearish signals
    let bullishScore = 0;
    let bearishScore = 0;

    signals.forEach((signal) => {
      if (signal.type === 'arbitrage') {
        // Check which side
        if (market.yesPrice < 50) bullishScore += signal.confidence;
        else bearishScore += signal.confidence;
      } else if (signal.type === 'value') {
        // Check reasoning
        if (signal.reasoning.includes('UNDERVALUED')) bullishScore += signal.confidence;
        else bearishScore += signal.confidence;
      } else {
        // Most signals favor the direction
        bullishScore += signal.confidence * 0.5;
      }
    });

    // Determine action
    let action: 'BUY_YES' | 'BUY_NO' | 'PASS' = 'PASS';
    if (bullishScore > bearishScore * 1.5) action = 'BUY_YES';
    else if (bearishScore > bullishScore * 1.5) action = 'BUY_NO';

    // Determine size based on confidence
    const maxSignalConfidence = Math.max(...signals.map((s) => s.confidence));
    const baseSize = 50; // $50 default
    const maxSize = 100; // $100 max

    let size = baseSize;
    if (maxSignalConfidence >= 80) size = maxSize;
    else if (maxSignalConfidence >= 70) size = baseSize * 1.5;

    return { action, size };
  }

  /**
   * Generate human-readable analysis
   */
  private generateAnalysis(signals: OpportunitySignal[], market: Market): string {
    const lines = [`Found ${signals.length} opportunity signal(s) for: ${market.question}\n`];

    signals.forEach((signal, i) => {
      lines.push(
        `${i + 1}. ${signal.type.toUpperCase()} (${signal.confidence}% confidence)`
      );
      lines.push(`   ${signal.reasoning}`);
      lines.push(`   Expected return: ${signal.expectedReturn.toFixed(1)}%`);
      lines.push(`   Urgency: ${signal.urgency}\n`);
    });

    return lines.join('\n');
  }
}

export default StrategyEngine;
