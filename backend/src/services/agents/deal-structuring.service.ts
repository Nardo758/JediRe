/**
 * Deal Structuring Service
 * 
 * CFO analyzes deal economics → generates recommendations for Legal
 * on how to structure contracts, LOIs, and waterfalls to protect
 * and optimize returns for the platform user.
 * 
 * Key Insights CFO Provides:
 * - Cash flow vs appreciation split
 * - Risk factors requiring protection
 * - Waterfall hurdle recommendations
 * - Clawback and catch-up provisions
 * - Home run clause thresholds
 * - Promote structure optimization
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { eventDispatcher } from './event-dispatcher';

// ============================================================================
// TYPES
// ============================================================================

export interface DealEconomics {
  dealId: string;
  dealName: string;
  
  // Return profile
  projectedIRR: number;
  equityMultiple: number;
  cashOnCash: number;
  
  // Value source breakdown
  cashFlowPercent: number;      // % of total return from cash flow
  appreciationPercent: number;   // % of total return from sale
  
  // Risk metrics
  breakEvenOccupancy: number;
  dscr: number;
  ltv: number;
  
  // Sensitivity
  irrAtExitCapPlus50bps: number;
  irrAtExitCapMinus50bps: number;
  irrAtRentGrowthMinus1pct: number;
  
  // Hold period
  projectedHoldYears: number;
  optimalExitYear: number;
}

export interface StructuringRecommendation {
  id: string;
  dealId: string;
  generatedAt: Date;
  
  // Return profile classification
  returnProfile: 'cash_flow_heavy' | 'appreciation_heavy' | 'balanced';
  
  // Waterfall recommendations
  waterfallStructure: {
    preferredReturn: number;         // e.g., 8%
    tier1Hurdle: number;            // e.g., 12% IRR
    tier1Split: { lp: number; gp: number };
    tier2Hurdle?: number;           // e.g., 15% IRR
    tier2Split?: { lp: number; gp: number };
    tier3Hurdle?: number;           // e.g., 20% IRR (home run)
    tier3Split?: { lp: number; gp: number };
    catchUpProvision: boolean;
    lookbackProvision: boolean;
  };
  
  // Contract clauses to include/modify
  contractClauses: {
    clause: string;
    recommendation: 'include' | 'modify' | 'remove' | 'strengthen';
    rationale: string;
    suggestedLanguage?: string;
  }[];
  
  // LOI specific terms
  loiTerms: {
    term: string;
    recommendation: string;
    rationale: string;
  }[];
  
  // Risk mitigations
  riskMitigations: {
    risk: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
    contractLanguage?: string;
  }[];
  
  // Summary for Legal agent
  summaryForLegal: string;
  
  // Raw analysis
  fullAnalysis: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// DEAL STRUCTURING SERVICE
// ============================================================================

class DealStructuringService {
  
  /**
   * Analyze deal economics and generate structuring recommendations
   */
  async analyzeAndRecommend(dealId: string, userId: string): Promise<StructuringRecommendation> {
    logger.info('Starting deal structuring analysis', { dealId });
    
    // 1. Get deal economics
    const economics = await this.getDealEconomics(dealId);
    
    // 2. Classify return profile
    const returnProfile = this.classifyReturnProfile(economics);
    
    // 3. Generate AI recommendations
    const recommendations = await this.generateRecommendations(economics, returnProfile);
    
    // 4. Store recommendations
    await this.storeRecommendations(dealId, recommendations);
    
    // 5. Notify Legal agent
    await this.notifyLegalAgent(dealId, userId, recommendations);
    
    return recommendations;
  }

  /**
   * Get deal economics from database
   */
  private async getDealEconomics(dealId: string): Promise<DealEconomics> {
    // Get deal and assumptions
    const dealRes = await query(
      `SELECT d.*, da.*, p.name as property_name
       FROM deals d
       LEFT JOIN deal_assumptions da ON d.id = da.deal_id
       LEFT JOIN properties p ON d.property_id = p.id
       WHERE d.id = $1`,
      [dealId]
    );
    
    if (dealRes.rows.length === 0) {
      throw new Error('Deal not found');
    }
    
    const deal = dealRes.rows[0];
    
    // Get proforma cash flows if available
    const cashFlowRes = await query(
      `SELECT * FROM deal_monthly_actuals 
       WHERE deal_id = $1 AND is_proforma = true
       ORDER BY report_month`,
      [dealId]
    );
    
    // Calculate economics (simplified - would use actual proforma in production)
    const purchasePrice = deal.purchase_price || deal.budget || 10000000;
    const units = deal.units || deal.target_units || 100;
    const capRate = deal.cap_rate || 0.055;
    const exitCap = deal.exit_cap_rate || capRate + 0.005;
    const holdYears = deal.exit_year || 5;
    const rentGrowth = deal.rent_growth || 0.03;
    const expenseGrowth = deal.expense_growth || 0.025;
    const ltv = deal.ltv || 0.65;
    
    // Estimate NOI
    const year1NOI = purchasePrice * capRate;
    const projectedExitNOI = year1NOI * Math.pow(1 + rentGrowth - expenseGrowth/2, holdYears);
    const projectedExitValue = projectedExitNOI / exitCap;
    
    // Calculate cash flow vs appreciation
    const totalCashFlow = year1NOI * holdYears * 0.4; // Assume 40% after debt service
    const appreciation = projectedExitValue - purchasePrice;
    const totalReturn = totalCashFlow + appreciation;
    
    const cashFlowPercent = (totalCashFlow / totalReturn) * 100;
    const appreciationPercent = (appreciation / totalReturn) * 100;
    
    // IRR estimate (simplified)
    const equity = purchasePrice * (1 - ltv);
    const equityMultiple = (equity + totalCashFlow + appreciation * (1 - ltv)) / equity;
    const irr = (Math.pow(equityMultiple, 1/holdYears) - 1) * 100;
    
    return {
      dealId,
      dealName: deal.name || deal.property_name || 'Unnamed Deal',
      projectedIRR: irr,
      equityMultiple,
      cashOnCash: (year1NOI * 0.4 / equity) * 100,
      cashFlowPercent,
      appreciationPercent,
      breakEvenOccupancy: 85, // Would calculate from actuals
      dscr: 1.25,
      ltv: ltv * 100,
      irrAtExitCapPlus50bps: irr - 2.5,
      irrAtExitCapMinus50bps: irr + 2.0,
      irrAtRentGrowthMinus1pct: irr - 3.0,
      projectedHoldYears: holdYears,
      optimalExitYear: holdYears,
    };
  }

  /**
   * Classify the return profile
   */
  private classifyReturnProfile(economics: DealEconomics): 'cash_flow_heavy' | 'appreciation_heavy' | 'balanced' {
    if (economics.cashFlowPercent > 60) return 'cash_flow_heavy';
    if (economics.appreciationPercent > 60) return 'appreciation_heavy';
    return 'balanced';
  }

  /**
   * Generate AI-powered structuring recommendations
   */
  private async generateRecommendations(
    economics: DealEconomics,
    returnProfile: string
  ): Promise<StructuringRecommendation> {
    
    const prompt = `You are a real estate investment CFO advising Legal on deal structuring.

DEAL ECONOMICS:
- Deal: ${economics.dealName}
- Projected IRR: ${economics.projectedIRR.toFixed(1)}%
- Equity Multiple: ${economics.equityMultiple.toFixed(2)}x
- Cash-on-Cash: ${economics.cashOnCash.toFixed(1)}%

VALUE SOURCE:
- ${economics.cashFlowPercent.toFixed(0)}% from Cash Flow (during hold)
- ${economics.appreciationPercent.toFixed(0)}% from Appreciation (at sale)
- Return Profile: ${returnProfile.replace('_', ' ').toUpperCase()}

RISK METRICS:
- Break-even Occupancy: ${economics.breakEvenOccupancy}%
- DSCR: ${economics.dscr.toFixed(2)}x
- LTV: ${economics.ltv.toFixed(0)}%

SENSITIVITY:
- IRR if exit cap +50bps: ${economics.irrAtExitCapPlus50bps.toFixed(1)}%
- IRR if exit cap -50bps: ${economics.irrAtExitCapMinus50bps.toFixed(1)}%
- IRR if rent growth -1%: ${economics.irrAtRentGrowthMinus1pct.toFixed(1)}%

HOLD PERIOD: ${economics.projectedHoldYears} years

Based on this analysis, provide structuring recommendations in JSON format:

{
  "waterfallStructure": {
    "preferredReturn": <pref return % that matches cash flow>,
    "tier1Hurdle": <first promote hurdle IRR>,
    "tier1Split": {"lp": <LP %>, "gp": <GP %>},
    "tier2Hurdle": <second hurdle if appropriate>,
    "tier2Split": {"lp": <LP %>, "gp": <GP %>},
    "tier3Hurdle": <home run threshold if appreciation heavy>,
    "tier3Split": {"lp": <LP %>, "gp": <GP %>},
    "catchUpProvision": <true if GP should catch up to LP pref>,
    "lookbackProvision": <true if should look back for clawback>
  },
  "contractClauses": [
    {
      "clause": "<clause name>",
      "recommendation": "include|modify|strengthen",
      "rationale": "<why this matters for this deal>",
      "suggestedLanguage": "<specific language if helpful>"
    }
  ],
  "loiTerms": [
    {
      "term": "<LOI term>",
      "recommendation": "<what to ask for>",
      "rationale": "<why>"
    }
  ],
  "riskMitigations": [
    {
      "risk": "<identified risk>",
      "severity": "high|medium|low",
      "mitigation": "<how to mitigate>",
      "contractLanguage": "<suggested protective language>"
    }
  ],
  "summaryForLegal": "<2-3 sentence summary of key structuring priorities>"
}

IMPORTANT GUIDANCE:
- For CASH FLOW HEAVY deals: Higher pref return, quarterly distributions, less aggressive promotes
- For APPRECIATION HEAVY deals: Lower pref (or none), home run clause above 20% IRR, promote kicks in at sale
- For BALANCED deals: Standard 8% pref, IRR hurdles at 12%, 15%, 18%
- Consider the sensitivity - if returns are fragile, add more protective provisions
- If exit cap risk is high, recommend sale price floors or earnouts`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const responseText = textBlock?.text || '{}';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    
    try {
      parsed = JSON.parse(jsonMatch?.[0] || '{}');
    } catch {
      logger.warn('Failed to parse AI response, using defaults');
      parsed = this.getDefaultRecommendations(returnProfile);
    }

    return {
      id: `struct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dealId: economics.dealId,
      generatedAt: new Date(),
      returnProfile: returnProfile as any,
      waterfallStructure: parsed.waterfallStructure || this.getDefaultWaterfall(returnProfile),
      contractClauses: parsed.contractClauses || [],
      loiTerms: parsed.loiTerms || [],
      riskMitigations: parsed.riskMitigations || [],
      summaryForLegal: parsed.summaryForLegal || `Deal is ${returnProfile}. Structure accordingly.`,
      fullAnalysis: responseText,
    };
  }

  /**
   * Default waterfall based on return profile
   */
  private getDefaultWaterfall(returnProfile: string): StructuringRecommendation['waterfallStructure'] {
    switch (returnProfile) {
      case 'cash_flow_heavy':
        return {
          preferredReturn: 10,
          tier1Hurdle: 12,
          tier1Split: { lp: 80, gp: 20 },
          tier2Hurdle: 15,
          tier2Split: { lp: 70, gp: 30 },
          catchUpProvision: false,
          lookbackProvision: true,
        };
      
      case 'appreciation_heavy':
        return {
          preferredReturn: 6,
          tier1Hurdle: 15,
          tier1Split: { lp: 75, gp: 25 },
          tier2Hurdle: 18,
          tier2Split: { lp: 65, gp: 35 },
          tier3Hurdle: 22,
          tier3Split: { lp: 50, gp: 50 },
          catchUpProvision: true,
          lookbackProvision: false,
        };
      
      default: // balanced
        return {
          preferredReturn: 8,
          tier1Hurdle: 12,
          tier1Split: { lp: 80, gp: 20 },
          tier2Hurdle: 15,
          tier2Split: { lp: 70, gp: 30 },
          tier2Hurdle: 18,
          tier2Split: { lp: 60, gp: 40 },
          catchUpProvision: true,
          lookbackProvision: true,
        };
    }
  }

  /**
   * Default recommendations if AI fails
   */
  private getDefaultRecommendations(returnProfile: string): any {
    return {
      waterfallStructure: this.getDefaultWaterfall(returnProfile),
      contractClauses: [
        {
          clause: 'Distribution Timing',
          recommendation: returnProfile === 'cash_flow_heavy' ? 'strengthen' : 'include',
          rationale: 'Ensure regular distributions match investor expectations',
        },
        {
          clause: 'Exit Rights',
          recommendation: 'include',
          rationale: 'Protect ability to exit at optimal timing',
        },
      ],
      loiTerms: [
        {
          term: 'Exclusivity Period',
          recommendation: '60 days',
          rationale: 'Standard DD period',
        },
      ],
      riskMitigations: [],
      summaryForLegal: `This is a ${returnProfile.replace('_', ' ')} deal. Structure waterfall accordingly.`,
    };
  }

  /**
   * Store recommendations in database
   */
  private async storeRecommendations(dealId: string, rec: StructuringRecommendation): Promise<void> {
    try {
      await query(
        `INSERT INTO deal_structuring_recommendations 
         (id, deal_id, return_profile, waterfall_structure, contract_clauses, 
          loi_terms, risk_mitigations, summary_for_legal, full_analysis, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          rec.id,
          dealId,
          rec.returnProfile,
          JSON.stringify(rec.waterfallStructure),
          JSON.stringify(rec.contractClauses),
          JSON.stringify(rec.loiTerms),
          JSON.stringify(rec.riskMitigations),
          rec.summaryForLegal,
          rec.fullAnalysis,
          rec.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store structuring recommendations:', error);
    }
  }

  /**
   * Notify Legal agent about the recommendations
   */
  private async notifyLegalAgent(
    dealId: string, 
    userId: string, 
    rec: StructuringRecommendation
  ): Promise<void> {
    // Store a notification for the legal agent
    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, $2, 'legal', 'info', $3, $4, '["in_app"]')`,
        [
          userId,
          dealId,
          'CFO Structuring Analysis Ready',
          rec.summaryForLegal,
        ]
      );

      // Also create an agent-to-agent message
      await query(
        `INSERT INTO agent_conversations 
         (conversation_id, deal_id, user_id, agent_id, role, content, skills_used)
         VALUES ($1, $2, $3, 'cfo', 'assistant', $4, '["analyze_deal_structure"]')`,
        [
          `cfo_to_legal_${dealId}_${Date.now()}`,
          dealId,
          userId,
          `STRUCTURING ANALYSIS FOR LEGAL:

Return Profile: ${rec.returnProfile.replace('_', ' ').toUpperCase()}

${rec.summaryForLegal}

WATERFALL RECOMMENDATION:
- Preferred Return: ${rec.waterfallStructure.preferredReturn}%
- Tier 1: ${rec.waterfallStructure.tier1Hurdle}% IRR → LP ${rec.waterfallStructure.tier1Split.lp}% / GP ${rec.waterfallStructure.tier1Split.gp}%
${rec.waterfallStructure.tier2Hurdle ? `- Tier 2: ${rec.waterfallStructure.tier2Hurdle}% IRR → LP ${rec.waterfallStructure.tier2Split?.lp}% / GP ${rec.waterfallStructure.tier2Split?.gp}%` : ''}
${rec.waterfallStructure.tier3Hurdle ? `- HOME RUN (Tier 3): ${rec.waterfallStructure.tier3Hurdle}% IRR → LP ${rec.waterfallStructure.tier3Split?.lp}% / GP ${rec.waterfallStructure.tier3Split?.gp}%` : ''}
- Catch-up: ${rec.waterfallStructure.catchUpProvision ? 'YES' : 'NO'}
- Lookback: ${rec.waterfallStructure.lookbackProvision ? 'YES' : 'NO'}

KEY CONTRACT CLAUSES TO ADDRESS:
${rec.contractClauses.map(c => `• ${c.clause}: ${c.recommendation.toUpperCase()} - ${c.rationale}`).join('\n')}

RISK MITIGATIONS NEEDED:
${rec.riskMitigations.map(r => `• [${r.severity.toUpperCase()}] ${r.risk}: ${r.mitigation}`).join('\n') || 'None identified'}`,
        ]
      );

    } catch (error) {
      logger.warn('Failed to notify legal agent:', error);
    }
  }

  /**
   * Get existing recommendations for a deal
   */
  async getRecommendations(dealId: string): Promise<StructuringRecommendation | null> {
    const result = await query(
      `SELECT * FROM deal_structuring_recommendations 
       WHERE deal_id = $1 
       ORDER BY generated_at DESC 
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      dealId: row.deal_id,
      generatedAt: row.generated_at,
      returnProfile: row.return_profile,
      waterfallStructure: row.waterfall_structure,
      contractClauses: row.contract_clauses,
      loiTerms: row.loi_terms,
      riskMitigations: row.risk_mitigations,
      summaryForLegal: row.summary_for_legal,
      fullAnalysis: row.full_analysis,
    };
  }
}

// Export singleton
export const dealStructuringService = new DealStructuringService();
export default dealStructuringService;
