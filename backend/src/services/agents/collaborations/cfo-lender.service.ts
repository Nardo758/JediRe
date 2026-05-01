/**
 * CFO → Lender Collaboration
 * 
 * CFO analyzes deal returns → recommends optimal debt structure
 * Lender sizes loan to maximize equity returns while maintaining covenants
 * 
 * Key Handoffs:
 * - Target DSCR for optimal returns
 * - Refi timing recommendations
 * - Interest rate sensitivity analysis
 * - Fixed vs floating recommendations
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

export interface DebtOptimizationRequest {
  dealId: string;
  userId: string;
  purchasePrice: number;
  noi: number;
  capRate: number;
  targetIRR?: number;
  holdPeriod?: number;
}

export interface DebtRecommendation {
  id: string;
  dealId: string;
  generatedAt: Date;
  
  // Optimal structure
  recommendedLTV: number;
  recommendedLoanAmount: number;
  targetDSCR: number;
  maxLoanAtDSCR: number;
  
  // Rate structure
  rateStructure: 'fixed' | 'floating' | 'hybrid';
  rateStructureRationale: string;
  
  // Refi analysis
  refiRecommendation: {
    shouldRefi: boolean;
    optimalYear: number;
    estimatedProceeds: number;
    irrImpact: number;
    rationale: string;
  };
  
  // Sensitivity
  irrByLTV: { ltv: number; irr: number; dscr: number }[];
  breakpoints: {
    maxLTVForPositiveLeverage: number;
    ltvAtTargetDSCR: number;
    ltvAtMinDSCR: number;
  };
  
  // Covenant recommendations
  covenantSuggestions: {
    covenant: string;
    suggestedValue: number | string;
    rationale: string;
  }[];
  
  summaryForLender: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// CFO → LENDER SERVICE
// ============================================================================

class CFOLenderService {
  
  /**
   * CFO analyzes deal and generates debt recommendations for Lender
   */
  async analyzeAndRecommend(request: DebtOptimizationRequest): Promise<DebtRecommendation> {
    const { dealId, userId, purchasePrice, noi, capRate, targetIRR = 15, holdPeriod = 5 } = request;
    
    logger.info('CFO analyzing debt optimization for Lender', { dealId });
    
    // Calculate debt scenarios
    const scenarios = this.calculateDebtScenarios(purchasePrice, noi, holdPeriod);
    
    // Get AI recommendations
    const aiAnalysis = await this.getAIRecommendations({
      purchasePrice,
      noi,
      capRate,
      targetIRR,
      holdPeriod,
      scenarios,
    });
    
    // Build recommendation
    const recommendation: DebtRecommendation = {
      id: `debt_rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dealId,
      generatedAt: new Date(),
      recommendedLTV: aiAnalysis.recommendedLTV || 65,
      recommendedLoanAmount: purchasePrice * (aiAnalysis.recommendedLTV || 65) / 100,
      targetDSCR: aiAnalysis.targetDSCR || 1.25,
      maxLoanAtDSCR: this.calculateMaxLoanAtDSCR(noi, aiAnalysis.targetDSCR || 1.25, 0.065),
      rateStructure: aiAnalysis.rateStructure || 'fixed',
      rateStructureRationale: aiAnalysis.rateStructureRationale || 'Fixed rate provides certainty for cash flow projections',
      refiRecommendation: aiAnalysis.refiRecommendation || {
        shouldRefi: false,
        optimalYear: 3,
        estimatedProceeds: 0,
        irrImpact: 0,
        rationale: 'Insufficient data for refi analysis',
      },
      irrByLTV: scenarios,
      breakpoints: {
        maxLTVForPositiveLeverage: this.findPositiveLeverageBreakpoint(scenarios),
        ltvAtTargetDSCR: this.findLTVAtDSCR(noi, aiAnalysis.targetDSCR || 1.25, purchasePrice, 0.065),
        ltvAtMinDSCR: this.findLTVAtDSCR(noi, 1.15, purchasePrice, 0.065),
      },
      covenantSuggestions: aiAnalysis.covenantSuggestions || [],
      summaryForLender: aiAnalysis.summaryForLender || 'Analysis complete - review recommendations',
    };
    
    // Store and notify
    await this.storeRecommendation(recommendation);
    await this.notifyLenderAgent(dealId, userId, recommendation);
    
    return recommendation;
  }

  /**
   * Calculate IRR at various LTV levels
   */
  private calculateDebtScenarios(
    purchasePrice: number,
    noi: number,
    holdPeriod: number
  ): { ltv: number; irr: number; dscr: number }[] {
    const scenarios: { ltv: number; irr: number; dscr: number }[] = [];
    const interestRate = 0.065; // Assume 6.5%
    const exitCap = 0.06; // Assume 6% exit cap
    
    for (let ltv = 0; ltv <= 80; ltv += 5) {
      const loanAmount = purchasePrice * ltv / 100;
      const equity = purchasePrice - loanAmount;
      const annualDebtService = loanAmount * (interestRate + 0.02); // Simplified amortizing
      const dscr = noi / (annualDebtService || 1);
      
      // Simplified IRR calculation
      const annualCashFlow = noi - annualDebtService;
      const exitValue = (noi * Math.pow(1.02, holdPeriod)) / exitCap;
      const exitEquity = exitValue - loanAmount * 0.95; // Assume 5% paydown
      
      const totalReturn = (annualCashFlow * holdPeriod) + exitEquity;
      const equityMultiple = totalReturn / equity;
      const irr = (Math.pow(equityMultiple, 1 / holdPeriod) - 1) * 100;
      
      scenarios.push({ ltv, irr: Math.round(irr * 10) / 10, dscr: Math.round(dscr * 100) / 100 });
    }
    
    return scenarios;
  }

  /**
   * Find LTV where leverage turns negative
   */
  private findPositiveLeverageBreakpoint(scenarios: { ltv: number; irr: number }[]): number {
    const allCashIRR = scenarios.find(s => s.ltv === 0)?.irr || 0;
    for (let i = scenarios.length - 1; i >= 0; i--) {
      if (scenarios[i].irr > allCashIRR) {
        return scenarios[i].ltv;
      }
    }
    return 0;
  }

  /**
   * Calculate max loan at given DSCR
   */
  private calculateMaxLoanAtDSCR(noi: number, targetDSCR: number, rate: number): number {
    const maxDebtService = noi / targetDSCR;
    return maxDebtService / (rate + 0.02); // Simplified
  }

  /**
   * Find LTV that achieves target DSCR
   */
  private findLTVAtDSCR(noi: number, targetDSCR: number, purchasePrice: number, rate: number): number {
    const maxLoan = this.calculateMaxLoanAtDSCR(noi, targetDSCR, rate);
    return Math.round((maxLoan / purchasePrice) * 100);
  }

  /**
   * Get AI-powered recommendations
   */
  private async getAIRecommendations(data: any): Promise<any> {
    const prompt = `You are a real estate CFO advising on optimal debt structure.

DEAL DATA:
- Purchase Price: $${(data.purchasePrice / 1000000).toFixed(1)}M
- NOI: $${(data.noi / 1000).toFixed(0)}K
- Cap Rate: ${(data.capRate * 100).toFixed(1)}%
- Target IRR: ${data.targetIRR}%
- Hold Period: ${data.holdPeriod} years

IRR BY LEVERAGE:
${data.scenarios.map((s: any) => `${s.ltv}% LTV → ${s.irr}% IRR, ${s.dscr}x DSCR`).join('\n')}

Provide recommendations in JSON:
{
  "recommendedLTV": <optimal LTV %>,
  "targetDSCR": <DSCR to maintain>,
  "rateStructure": "fixed|floating|hybrid",
  "rateStructureRationale": "<why this structure>",
  "refiRecommendation": {
    "shouldRefi": true/false,
    "optimalYear": <year>,
    "estimatedProceeds": <$>,
    "irrImpact": <basis points>,
    "rationale": "<why>"
  },
  "covenantSuggestions": [
    {"covenant": "Minimum DSCR", "suggestedValue": 1.20, "rationale": "<why>"}
  ],
  "summaryForLender": "<2-3 sentence summary for Lender agent>"
}

Consider:
- Positive leverage cutoff
- DSCR cushion for downside
- Rate environment (rising/falling)
- Refi optionality value`;

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
      logger.warn('AI debt analysis failed, using defaults', { error });
      return {
        recommendedLTV: 65,
        targetDSCR: 1.25,
        rateStructure: 'fixed',
        rateStructureRationale: 'Fixed provides cash flow certainty',
        summaryForLender: 'Default recommendations applied',
      };
    }
  }

  /**
   * Store recommendation
   */
  private async storeRecommendation(rec: DebtRecommendation): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_collaboration_debt_recommendations
         (id, deal_id, recommended_ltv, target_dscr, rate_structure, refi_recommendation, 
          irr_by_ltv, breakpoints, covenant_suggestions, summary_for_lender, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          rec.id, rec.dealId, rec.recommendedLTV, rec.targetDSCR, rec.rateStructure,
          JSON.stringify(rec.refiRecommendation), JSON.stringify(rec.irrByLTV),
          JSON.stringify(rec.breakpoints), JSON.stringify(rec.covenantSuggestions),
          rec.summaryForLender, rec.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store debt recommendation', { error });
    }
  }

  /**
   * Notify Lender agent
   */
  private async notifyLenderAgent(dealId: string, userId: string, rec: DebtRecommendation): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, $2, 'lender', 'info', $3, $4, '["in_app"]')`,
        [userId, dealId, 'CFO Debt Analysis Ready', rec.summaryForLender]
      );
    } catch (error) {
      logger.warn('Failed to notify lender agent', { error });
    }
  }

  /**
   * Get existing recommendation
   */
  async getRecommendation(dealId: string): Promise<DebtRecommendation | null> {
    const result = await query(
      `SELECT * FROM agent_collaboration_debt_recommendations WHERE deal_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      [dealId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      dealId: row.deal_id,
      generatedAt: row.generated_at,
      recommendedLTV: row.recommended_ltv,
      recommendedLoanAmount: 0, // Calculate from deal
      targetDSCR: row.target_dscr,
      maxLoanAtDSCR: 0,
      rateStructure: row.rate_structure,
      rateStructureRationale: '',
      refiRecommendation: row.refi_recommendation,
      irrByLTV: row.irr_by_ltv,
      breakpoints: row.breakpoints,
      covenantSuggestions: row.covenant_suggestions,
      summaryForLender: row.summary_for_lender,
    };
  }
}

export const cfoLenderService = new CFOLenderService();
export default cfoLenderService;
