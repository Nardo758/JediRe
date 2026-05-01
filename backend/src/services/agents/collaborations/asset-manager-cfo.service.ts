/**
 * Asset Manager → CFO Collaboration
 * 
 * Asset Manager spots operational variance → CFO recalculates return impact
 * 
 * Key Handoffs:
 * - Occupancy changes → IRR impact
 * - OpEx variance → Break-even shifts
 * - Rent growth vs proforma → Refi timing
 * - NOI variance → Hold/sell recommendation update
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface VarianceAlert {
  dealId: string;
  userId: string;
  varianceType: 'occupancy' | 'rent' | 'opex' | 'noi' | 'capex';
  metric: string;
  proformaValue: number;
  actualValue: number;
  variancePercent: number;
  period: string; // e.g., "2026-Q1"
}

export interface VarianceImpactAnalysis {
  id: string;
  dealId: string;
  generatedAt: Date;
  
  // The variance that triggered this
  triggeringVariance: VarianceAlert;
  
  // Return impact
  returnImpact: {
    originalIRR: number;
    revisedIRR: number;
    irrChange: number;
    originalEquityMultiple: number;
    revisedEquityMultiple: number;
  };
  
  // Risk impact
  riskImpact: {
    originalBreakEvenOccupancy: number;
    revisedBreakEvenOccupancy: number;
    originalDSCR: number;
    revisedDSCR: number;
    covenantRisk: 'none' | 'watch' | 'breach';
  };
  
  // Recommendation
  recommendation: {
    action: 'hold' | 'reposition' | 'sell' | 'refi';
    confidence: number;
    rationale: string;
    immediateActions: string[];
  };
  
  // If variance persists
  scenarioAnalysis: {
    ifVarianceContinues: {
      irr12Months: number;
      irr24Months: number;
      recommendation: string;
    };
    ifVarianceReverses: {
      irr12Months: number;
      irr24Months: number;
      recommendation: string;
    };
  };
  
  summaryForUser: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// ASSET MANAGER → CFO SERVICE
// ============================================================================

class AssetManagerCFOService {
  
  /**
   * Asset Manager reports variance, CFO analyzes return impact
   */
  async analyzeVarianceImpact(alert: VarianceAlert): Promise<VarianceImpactAnalysis> {
    const { dealId, userId, varianceType, metric, proformaValue, actualValue, variancePercent, period } = alert;
    
    logger.info('CFO analyzing variance impact from Asset Manager', { dealId, varianceType, variancePercent });
    
    // Get deal baseline data
    const dealData = await this.getDealBaseline(dealId);
    
    // Calculate return impact
    const returnImpact = this.calculateReturnImpact(dealData, alert);
    
    // Calculate risk impact
    const riskImpact = this.calculateRiskImpact(dealData, alert);
    
    // Get AI recommendation
    const aiAnalysis = await this.getAIAnalysis(dealData, alert, returnImpact, riskImpact);
    
    const analysis: VarianceImpactAnalysis = {
      id: `var_impact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dealId,
      generatedAt: new Date(),
      triggeringVariance: alert,
      returnImpact,
      riskImpact,
      recommendation: aiAnalysis.recommendation || {
        action: 'hold',
        confidence: 50,
        rationale: 'Insufficient data for recommendation',
        immediateActions: ['Monitor closely'],
      },
      scenarioAnalysis: aiAnalysis.scenarioAnalysis || {
        ifVarianceContinues: { irr12Months: returnImpact.revisedIRR - 1, irr24Months: returnImpact.revisedIRR - 2, recommendation: 'Consider repositioning' },
        ifVarianceReverses: { irr12Months: returnImpact.originalIRR, irr24Months: returnImpact.originalIRR, recommendation: 'Maintain current strategy' },
      },
      summaryForUser: aiAnalysis.summaryForUser || `${varianceType} variance of ${variancePercent.toFixed(1)}% impacts IRR by ${(returnImpact.irrChange).toFixed(1)}%`,
    };
    
    // Store and notify
    await this.storeAnalysis(analysis);
    await this.notifyUser(dealId, userId, analysis);
    
    return analysis;
  }

  /**
   * Get deal baseline for calculations
   */
  private async getDealBaseline(dealId: string): Promise<any> {
    const result = await query(
      `SELECT d.*, da.*, 
              COALESCE(d.purchase_price, d.budget) as purchase_price,
              COALESCE(d.units, d.target_units) as units
       FROM deals d
       LEFT JOIN deal_assumptions da ON d.id = da.deal_id
       WHERE d.id = $1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return {
        purchasePrice: 10000000,
        noi: 600000,
        units: 100,
        ltv: 0.65,
        holdPeriod: 5,
        capRate: 0.06,
        exitCap: 0.065,
      };
    }
    
    const deal = result.rows[0];
    return {
      purchasePrice: deal.purchase_price || 10000000,
      noi: deal.purchase_price * (deal.cap_rate || 0.06),
      units: deal.units || 100,
      ltv: deal.ltv || 0.65,
      holdPeriod: deal.exit_year || 5,
      capRate: deal.cap_rate || 0.06,
      exitCap: deal.exit_cap_rate || 0.065,
      rentGrowth: deal.rent_growth || 0.03,
    };
  }

  /**
   * Calculate return impact from variance
   */
  private calculateReturnImpact(dealData: any, alert: VarianceAlert): VarianceImpactAnalysis['returnImpact'] {
    const { purchasePrice, noi, ltv, holdPeriod, exitCap } = dealData;
    const equity = purchasePrice * (1 - ltv);
    
    // Original returns
    const originalExitValue = (noi * Math.pow(1.03, holdPeriod)) / exitCap;
    const originalCashFlow = noi * 0.4 * holdPeriod;
    const originalTotal = originalCashFlow + (originalExitValue - purchasePrice * ltv);
    const originalEM = originalTotal / equity;
    const originalIRR = (Math.pow(originalEM, 1/holdPeriod) - 1) * 100;
    
    // Adjust NOI based on variance type
    let noiAdjustment = 1;
    switch (alert.varianceType) {
      case 'occupancy':
        noiAdjustment = 1 + (alert.variancePercent / 100) * 0.8; // Occupancy has ~80% flow-through
        break;
      case 'rent':
        noiAdjustment = 1 + (alert.variancePercent / 100) * 0.9; // Rent has ~90% flow-through
        break;
      case 'opex':
        noiAdjustment = 1 - (alert.variancePercent / 100) * 0.4; // OpEx variance partially offset
        break;
      case 'noi':
        noiAdjustment = 1 + (alert.variancePercent / 100);
        break;
    }
    
    const revisedNOI = noi * noiAdjustment;
    const revisedExitValue = (revisedNOI * Math.pow(1.03, holdPeriod)) / exitCap;
    const revisedCashFlow = revisedNOI * 0.4 * holdPeriod;
    const revisedTotal = revisedCashFlow + (revisedExitValue - purchasePrice * ltv);
    const revisedEM = revisedTotal / equity;
    const revisedIRR = (Math.pow(revisedEM, 1/holdPeriod) - 1) * 100;
    
    return {
      originalIRR: Math.round(originalIRR * 10) / 10,
      revisedIRR: Math.round(revisedIRR * 10) / 10,
      irrChange: Math.round((revisedIRR - originalIRR) * 10) / 10,
      originalEquityMultiple: Math.round(originalEM * 100) / 100,
      revisedEquityMultiple: Math.round(revisedEM * 100) / 100,
    };
  }

  /**
   * Calculate risk impact from variance
   */
  private calculateRiskImpact(dealData: any, alert: VarianceAlert): VarianceImpactAnalysis['riskImpact'] {
    const { noi, purchasePrice, ltv } = dealData;
    const debtService = purchasePrice * ltv * 0.085; // Assume 8.5% debt constant
    
    // Original metrics
    const originalDSCR = noi / debtService;
    const originalBEOcc = 0.85; // Simplified
    
    // Adjust for variance
    let noiAdjustment = 1;
    if (alert.varianceType === 'occupancy' || alert.varianceType === 'noi') {
      noiAdjustment = 1 + (alert.variancePercent / 100);
    }
    
    const revisedNOI = noi * noiAdjustment;
    const revisedDSCR = revisedNOI / debtService;
    const revisedBEOcc = originalBEOcc / noiAdjustment;
    
    let covenantRisk: 'none' | 'watch' | 'breach' = 'none';
    if (revisedDSCR < 1.15) covenantRisk = 'breach';
    else if (revisedDSCR < 1.20) covenantRisk = 'watch';
    
    return {
      originalBreakEvenOccupancy: Math.round(originalBEOcc * 100),
      revisedBreakEvenOccupancy: Math.round(revisedBEOcc * 100),
      originalDSCR: Math.round(originalDSCR * 100) / 100,
      revisedDSCR: Math.round(revisedDSCR * 100) / 100,
      covenantRisk,
    };
  }

  /**
   * Get AI analysis and recommendations
   */
  private async getAIAnalysis(dealData: any, alert: VarianceAlert, returnImpact: any, riskImpact: any): Promise<any> {
    const prompt = `You are a real estate CFO analyzing operational variance reported by the Asset Manager.

VARIANCE ALERT:
- Type: ${alert.varianceType}
- Metric: ${alert.metric}
- Proforma: ${alert.proformaValue}
- Actual: ${alert.actualValue}
- Variance: ${alert.variancePercent.toFixed(1)}%
- Period: ${alert.period}

RETURN IMPACT:
- Original IRR: ${returnImpact.originalIRR}%
- Revised IRR: ${returnImpact.revisedIRR}%
- IRR Change: ${returnImpact.irrChange}%
- Equity Multiple: ${returnImpact.originalEquityMultiple}x → ${returnImpact.revisedEquityMultiple}x

RISK IMPACT:
- DSCR: ${riskImpact.originalDSCR}x → ${riskImpact.revisedDSCR}x
- Break-even Occupancy: ${riskImpact.originalBreakEvenOccupancy}% → ${riskImpact.revisedBreakEvenOccupancy}%
- Covenant Risk: ${riskImpact.covenantRisk}

Provide recommendations in JSON:
{
  "recommendation": {
    "action": "hold|reposition|sell|refi",
    "confidence": <0-100>,
    "rationale": "<why this action>",
    "immediateActions": ["<action 1>", "<action 2>"]
  },
  "scenarioAnalysis": {
    "ifVarianceContinues": {
      "irr12Months": <projected IRR>,
      "irr24Months": <projected IRR>,
      "recommendation": "<what to do>"
    },
    "ifVarianceReverses": {
      "irr12Months": <projected IRR>,
      "irr24Months": <projected IRR>,
      "recommendation": "<what to do>"
    }
  },
  "summaryForUser": "<1-2 sentence plain English summary>"
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch?.[0] || '{}');
    } catch (error) {
      logger.warn('AI variance analysis failed', { error });
      return {};
    }
  }

  /**
   * Store analysis
   */
  private async storeAnalysis(analysis: VarianceImpactAnalysis): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_collaboration_variance_impacts
         (id, deal_id, triggering_variance, return_impact, risk_impact, 
          recommendation, scenario_analysis, summary_for_user, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          analysis.id, analysis.dealId, JSON.stringify(analysis.triggeringVariance),
          JSON.stringify(analysis.returnImpact), JSON.stringify(analysis.riskImpact),
          JSON.stringify(analysis.recommendation), JSON.stringify(analysis.scenarioAnalysis),
          analysis.summaryForUser, analysis.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store variance impact analysis', { error });
    }
  }

  /**
   * Notify user of significant variance impact
   */
  private async notifyUser(dealId: string, userId: string, analysis: VarianceImpactAnalysis): Promise<void> {
    const { returnImpact, riskImpact, recommendation } = analysis;
    
    // Only notify if material impact
    if (Math.abs(returnImpact.irrChange) < 0.5 && riskImpact.covenantRisk === 'none') {
      return;
    }
    
    const severity = riskImpact.covenantRisk === 'breach' ? 'critical' :
                     Math.abs(returnImpact.irrChange) > 2 ? 'warning' : 'info';
    
    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, $2, 'cfo', $3, $4, $5, '["in_app", "email"]')`,
        [
          userId, dealId, severity,
          `Variance Alert: ${analysis.triggeringVariance.varianceType.toUpperCase()}`,
          analysis.summaryForUser,
        ]
      );
    } catch (error) {
      logger.warn('Failed to notify user', { error });
    }
  }

  /**
   * Get variance impact history for a deal
   */
  async getVarianceHistory(dealId: string): Promise<VarianceImpactAnalysis[]> {
    const result = await query(
      `SELECT * FROM agent_collaboration_variance_impacts WHERE deal_id = $1 ORDER BY generated_at DESC LIMIT 20`,
      [dealId]
    );
    return result.rows.map(row => ({
      id: row.id,
      dealId: row.deal_id,
      generatedAt: row.generated_at,
      triggeringVariance: row.triggering_variance,
      returnImpact: row.return_impact,
      riskImpact: row.risk_impact,
      recommendation: row.recommendation,
      scenarioAnalysis: row.scenario_analysis,
      summaryForUser: row.summary_for_user,
    }));
  }
}

export const assetManagerCFOService = new AssetManagerCFOService();
export default assetManagerCFOService;
