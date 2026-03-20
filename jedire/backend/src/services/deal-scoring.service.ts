/**
 * Deal Scoring Service
 * Weighted scoring system for deal recommendations
 */

import { logger } from '../utils/logger';

export interface ScoringWeights {
  zoning: number;        // Weight for zoning opportunity score (0-1)
  supply: number;        // Weight for supply/market conditions (0-1)
  cashflow: number;      // Weight for cash flow metrics (0-1)
  location: number;      // Weight for location factors (0-1)
}

export interface DealAnalysisData {
  zoning?: {
    opportunityScore?: number;
    maxUnits?: number;
    maxBuildableSqft?: number;
    confidenceScore?: number;
  };
  supply?: {
    opportunityScore?: number;
    absorptionRate?: number;
    vacancyRate?: number;
    avgDaysOnMarket?: number;
    medianPrice?: number;
  };
  cashflow?: {
    opportunityScore?: number;
    cashOnCashReturn?: number;
    monthlyCashFlow?: number;
    annualCashFlow?: number;
  };
  location?: {
    city?: string;
    stateCode?: string;
  };
}

export interface DealScore {
  totalScore: number;           // 0-100
  componentScores: {
    zoning: number;
    supply: number;
    cashflow: number;
    location: number;
  };
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'pass';
  confidenceLevel: 'high' | 'medium' | 'low';
  reasoning: string[];
}

export class DealScoringService {
  private defaultWeights: ScoringWeights = {
    zoning: 0.25,
    supply: 0.25,
    cashflow: 0.40,
    location: 0.10,
  };

  /**
   * Calculate comprehensive deal score
   */
  calculateScore(
    analysisData: DealAnalysisData,
    customWeights?: Partial<ScoringWeights>
  ): DealScore {
    const weights = { ...this.defaultWeights, ...customWeights };
    const componentScores = {
      zoning: this.scoreZoning(analysisData.zoning),
      supply: this.scoreSupply(analysisData.supply),
      cashflow: this.scoreCashflow(analysisData.cashflow),
      location: this.scoreLocation(analysisData.location),
    };

    const totalScore = 
      componentScores.zoning * weights.zoning +
      componentScores.supply * weights.supply +
      componentScores.cashflow * weights.cashflow +
      componentScores.location * weights.location;

    const recommendation = this.getRecommendation(totalScore, componentScores);
    const confidenceLevel = this.getConfidenceLevel(analysisData);
    const reasoning = this.generateReasoning(componentScores, analysisData);

    return {
      totalScore: Math.round(totalScore * 10) / 10,
      componentScores,
      recommendation,
      confidenceLevel,
      reasoning,
    };
  }

  /**
   * Score zoning factors
   */
  private scoreZoning(data?: DealAnalysisData['zoning']): number {
    if (!data) return 50; // Neutral if no data

    let score = data.opportunityScore || 50;

    // Bonus for high unit density potential
    if (data.maxUnits && data.maxUnits > 50) {
      score += 10;
    } else if (data.maxUnits && data.maxUnits > 100) {
      score += 20;
    }

    // Bonus for high confidence
    if (data.confidenceScore && data.confidenceScore > 80) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score supply/market factors
   */
  private scoreSupply(data?: DealAnalysisData['supply']): number {
    if (!data) return 50;

    let score = data.opportunityScore || 50;

    // Strong absorption = good market
    if (data.absorptionRate && data.absorptionRate > 20) {
      score += 15;
    } else if (data.absorptionRate && data.absorptionRate < 10) {
      score -= 15;
    }

    // Low vacancy = tight market (good for investors)
    if (data.vacancyRate !== undefined) {
      if (data.vacancyRate < 0.05) score += 10;      // <5% vacancy
      else if (data.vacancyRate > 0.10) score -= 10; // >10% vacancy
    }

    // Fast absorption = hot market
    if (data.avgDaysOnMarket && data.avgDaysOnMarket < 30) {
      score += 10;
    } else if (data.avgDaysOnMarket && data.avgDaysOnMarket > 60) {
      score -= 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score cashflow/financial factors
   */
  private scoreCashflow(data?: DealAnalysisData['cashflow']): number {
    if (!data) return 50;

    let score = data.opportunityScore || 50;

    // Cash-on-cash return is king
    if (data.cashOnCashReturn !== undefined && data.cashOnCashReturn !== null) {
      if (data.cashOnCashReturn > 12) {
        score += 25; // Excellent return
      } else if (data.cashOnCashReturn > 8) {
        score += 15; // Good return
      } else if (data.cashOnCashReturn > 5) {
        score += 5; // Acceptable return
      } else if (data.cashOnCashReturn < 0) {
        score -= 30; // Negative cash flow
      }
    }

    // Monthly cash flow matters
    if (data.monthlyCashFlow && data.monthlyCashFlow > 10000) {
      score += 10;
    } else if (data.monthlyCashFlow && data.monthlyCashFlow < 0) {
      score -= 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score location factors
   */
  private scoreLocation(data?: DealAnalysisData['location']): number {
    if (!data) return 50;

    let score = 50;

    // Premium markets (can expand this with external data)
    const premiumCities = ['atlanta', 'austin', 'nashville', 'raleigh', 'charlotte'];
    const city = data.city?.toLowerCase() || '';

    if (premiumCities.some(c => city.includes(c))) {
      score += 20;
    }

    // Sun Belt states
    const sunBeltStates = ['GA', 'TX', 'FL', 'AZ', 'NC', 'SC', 'TN'];
    if (data.stateCode && sunBeltStates.includes(data.stateCode)) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get recommendation based on score
   */
  private getRecommendation(
    totalScore: number,
    components: any
  ): DealScore['recommendation'] {
    // Must have positive cash flow for buy recommendation
    if (components.cashflow < 50) {
      return 'pass';
    }

    if (totalScore >= 80) return 'strong_buy';
    if (totalScore >= 65) return 'buy';
    if (totalScore >= 50) return 'hold';
    return 'pass';
  }

  /**
   * Determine confidence level
   */
  private getConfidenceLevel(data: DealAnalysisData): DealScore['confidenceLevel'] {
    let dataPoints = 0;
    let highQualityPoints = 0;

    if (data.zoning) {
      dataPoints++;
      if (data.zoning.confidenceScore && data.zoning.confidenceScore > 80) {
        highQualityPoints++;
      }
    }

    if (data.supply) {
      dataPoints++;
      if (data.supply.absorptionRate) highQualityPoints++;
    }

    if (data.cashflow) {
      dataPoints++;
      if (data.cashflow.cashOnCashReturn !== undefined) highQualityPoints++;
    }

    if (dataPoints === 0) return 'low';
    if (highQualityPoints >= 2 && dataPoints >= 3) return 'high';
    if (highQualityPoints >= 1) return 'medium';
    return 'low';
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(scores: any, data: DealAnalysisData): string[] {
    const reasons: string[] = [];

    // Zoning
    if (scores.zoning >= 70) {
      reasons.push(`✓ Strong zoning: ${data.zoning?.maxUnits || 'N/A'} units permitted`);
    } else if (scores.zoning < 50) {
      reasons.push(`⚠ Zoning constraints limit development potential`);
    }

    // Supply
    if (scores.supply >= 70) {
      reasons.push(`✓ Hot market: ${data.supply?.absorptionRate?.toFixed(1) || 'N/A'} units/mo absorption`);
    } else if (scores.supply < 50) {
      reasons.push(`⚠ Soft market conditions`);
    }

    // Cash flow
    if (data.cashflow?.cashOnCashReturn !== undefined) {
      const coc = data.cashflow.cashOnCashReturn;
      if (coc > 10) {
        reasons.push(`✓ Excellent returns: ${coc.toFixed(1)}% cash-on-cash`);
      } else if (coc < 0) {
        reasons.push(`❌ Negative cash flow: ${coc.toFixed(1)}%`);
      }
    }

    // Location
    if (scores.location >= 60) {
      reasons.push(`✓ Strong market: ${data.location?.city}, ${data.location?.stateCode}`);
    }

    return reasons;
  }

  /**
   * Rank multiple deals
   */
  rankDeals(deals: Array<{ dealId: string; analysisData: DealAnalysisData }>): any[] {
    return deals
      .map(deal => ({
        dealId: deal.dealId,
        score: this.calculateScore(deal.analysisData),
      }))
      .sort((a, b) => b.score.totalScore - a.score.totalScore);
  }
}
