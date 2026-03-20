/**
 * Regulatory Risk Scoring Service
 *
 * Computes composite regulatory risk scores from zoning module risk data
 * and publishes them to the data flow router for M14 composite risk integration.
 *
 * Risk categories: Zoning Stability, Permit Timeline, Impact Fees,
 * Inclusionary Requirements, Rent Control, STR Regulation, Environmental
 */

import { dataFlowRouter } from './module-wiring/data-flow-router';
import { moduleEventBus, ModuleEventType } from './module-wiring/module-event-bus';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface RegulatoryRiskInput {
  dealId: string;
  municipality: string;
  state: string;
  developmentPath?: string;
  categories: RiskCategoryScore[];
}

export interface RiskCategoryScore {
  category: string;
  level: 'low' | 'moderate' | 'elevated' | 'high';
  score: number;      // 0-100, higher = more risk
  weight: number;     // 0-1, contribution to composite
  trend: 'improving' | 'stable' | 'worsening';
  strategyImpact: Record<string, number>; // impact per strategy type
}

export interface RegulatoryRiskResult {
  dealId: string;
  compositeScore: number;
  compositeLevel: 'low' | 'moderate' | 'elevated' | 'high';
  categories: RiskCategoryScore[];
  strategyRiskScores: Record<string, number>;
  trendDirection: 'improving' | 'stable' | 'worsening';
  topRisks: string[];
  mitigationSuggestions: string[];
}

// ============================================================================
// Risk Scoring Config
// ============================================================================

const LEVEL_SCORES: Record<string, number> = {
  low: 15,
  moderate: 40,
  elevated: 65,
  high: 85,
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  zoning_stability: 0.20,
  permit_timeline: 0.18,
  impact_fees: 0.15,
  inclusionary_req: 0.12,
  rent_control: 0.10,
  str_regulation: 0.10,
  environmental: 0.10,
  historic_preservation: 0.05,
};

// ============================================================================
// Service
// ============================================================================

class RegulatoryRiskScoringService {
  /**
   * Calculate composite regulatory risk score and publish to M14.
   */
  async scoreRegulatory(input: RegulatoryRiskInput): Promise<RegulatoryRiskResult> {
    const { dealId, categories, developmentPath } = input;

    // Normalize weights
    const totalWeight = categories.reduce((s, c) => s + (c.weight || DEFAULT_WEIGHTS[c.category] || 0.1), 0);

    // Compute weighted composite score
    let compositeScore = 0;
    for (const cat of categories) {
      const weight = (cat.weight || DEFAULT_WEIGHTS[cat.category] || 0.1) / totalWeight;
      compositeScore += cat.score * weight;
    }
    compositeScore = parseFloat(compositeScore.toFixed(1));

    // Determine composite level
    const compositeLevel = compositeScore >= 70 ? 'high' :
      compositeScore >= 50 ? 'elevated' :
      compositeScore >= 30 ? 'moderate' : 'low';

    // Compute per-strategy risk scores
    const strategies = ['build_to_sell', 'flip', 'rental', 'str'];
    const strategyRiskScores: Record<string, number> = {};
    for (const strategy of strategies) {
      let stratScore = 0;
      for (const cat of categories) {
        const weight = (cat.weight || DEFAULT_WEIGHTS[cat.category] || 0.1) / totalWeight;
        const stratImpact = cat.strategyImpact[strategy] ?? 1.0;
        stratScore += cat.score * weight * stratImpact;
      }
      strategyRiskScores[strategy] = parseFloat(stratScore.toFixed(1));
    }

    // Development path risk adjustment
    if (developmentPath) {
      const pathMultipliers: Record<string, number> = {
        by_right: 0.7,       // lower risk
        overlay_bonus: 0.85,  // slight reduction
        variance: 1.1,        // slight increase
        rezone: 1.4,          // significant increase
      };
      const mult = pathMultipliers[developmentPath] || 1.0;
      compositeScore = parseFloat(Math.min(100, compositeScore * mult).toFixed(1));
    }

    // Trend analysis
    const trends = categories.map(c => c.trend);
    const worsening = trends.filter(t => t === 'worsening').length;
    const improving = trends.filter(t => t === 'improving').length;
    const trendDirection = worsening > improving ? 'worsening' :
      improving > worsening ? 'improving' : 'stable';

    // Identify top risks
    const topRisks = categories
      .filter(c => c.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.category);

    // Generate mitigation suggestions
    const mitigationSuggestions = this.generateMitigations(topRisks, developmentPath);

    const result: RegulatoryRiskResult = {
      dealId,
      compositeScore,
      compositeLevel,
      categories,
      strategyRiskScores,
      trendDirection,
      topRisks,
      mitigationSuggestions,
    };

    // Publish to data flow router for M14 consumption
    dataFlowRouter.publishModuleData('M02', dealId, {
      entitlement_risk_score: compositeScore,
      regulatory_risk_level: compositeLevel,
      strategy_risk_scores: strategyRiskScores,
      risk_trend: trendDirection,
      top_regulatory_risks: topRisks,
      development_path: developmentPath,
    });

    // Emit risk alert if high
    if (compositeLevel === 'high') {
      moduleEventBus.emit({
        type: ModuleEventType.RISK_ALERT,
        sourceModule: 'M02',
        dealId,
        data: {
          riskType: 'regulatory',
          score: compositeScore,
          level: compositeLevel,
          topRisks,
        },
        timestamp: new Date(),
      });
    }

    logger.info('Regulatory risk scored', {
      dealId,
      compositeScore,
      compositeLevel,
      trendDirection,
      path: developmentPath,
    });

    return result;
  }

  private generateMitigations(topRisks: string[], path?: string): string[] {
    const suggestions: string[] = [];

    const mitigationMap: Record<string, string> = {
      impact_fees: 'Negotiate phased payment schedule or community benefit offset for impact fees',
      permit_timeline: 'File pre-application early and engage expediter for parallel permitting',
      str_regulation: 'Confirm STR license availability before closing; consider hybrid rental model',
      rent_control: 'Structure lease terms to comply with rent stabilization; model worst-case rent growth',
      inclusionary_req: 'Model inclusionary units into proforma upfront; explore density bonus trade-offs',
      environmental: 'Order Phase I ESA during due diligence; budget for potential Phase II remediation',
      zoning_stability: 'Lock in entitlements before any upcoming zoning code updates',
    };

    for (const risk of topRisks) {
      const suggestion = mitigationMap[risk];
      if (suggestion) suggestions.push(suggestion);
    }

    if (path === 'rezone') {
      suggestions.push('Engage political consultants early; attend NPU meetings before filing');
    }

    return suggestions;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const regulatoryRiskScoringService = new RegulatoryRiskScoringService();
