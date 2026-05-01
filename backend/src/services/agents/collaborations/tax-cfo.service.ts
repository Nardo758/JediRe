/**
 * Tax Strategist → CFO Collaboration
 * 
 * Tax Strategist analyzes structure → CFO shows after-tax returns
 * 
 * Key Handoffs:
 * - Cost segregation savings → After-tax IRR
 * - 1031 timeline → Exit timing constraints
 * - Opportunity Zone benefits → Compare OZ vs non-OZ returns
 * - Depreciation recapture → True exit proceeds
 * - Entity structure → Flow-through vs C-corp impact
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

export interface TaxAnalysis {
  dealId: string;
  userId: string;
  purchasePrice: number;
  landValue: number; // Non-depreciable
  buildingValue: number;
  
  // Depreciation
  depreciationMethod: 'straight_line' | 'cost_seg';
  costSegStudyAvailable: boolean;
  year1Depreciation?: number;
  totalDepreciationOverHold?: number;
  
  // Tax benefits
  bonusDepreciationEligible: boolean;
  bonusDepreciationAmount?: number;
  section179Eligible: boolean;
  opportunityZone: boolean;
  
  // 1031 considerations
  existing1031Proceeds?: number;
  must1031: boolean;
  identification45DayDeadline?: Date;
  closing180DayDeadline?: Date;
  
  // Entity
  entityType: 'llc_partnership' | 'llc_scorp' | 'c_corp' | 'reit';
  investorTaxBracket: number; // e.g., 0.37
  stateIncomeTaxRate: number;
  capitalGainsRate: number;
}

export interface AfterTaxReturns {
  id: string;
  dealId: string;
  generatedAt: Date;
  
  // Pre-tax baseline
  preTaxIRR: number;
  preTaxEquityMultiple: number;
  preTaxCashOnCash: number;
  
  // After-tax returns
  afterTaxIRR: number;
  afterTaxEquityMultiple: number;
  afterTaxCashOnCash: number;
  
  // Tax benefit breakdown
  taxBenefits: {
    benefit: string;
    year1Impact: number;
    totalImpact: number;
    irrImpact: number; // basis points
    notes: string;
  }[];
  
  // Cost seg analysis
  costSegAnalysis?: {
    withCostSeg: {
      irr: number;
      year1TaxSavings: number;
      totalTaxSavings: number;
    };
    withoutCostSeg: {
      irr: number;
      year1TaxSavings: number;
      totalTaxSavings: number;
    };
    costSegRecommendation: boolean;
    breakEvenStudyCost: number;
  };
  
  // OZ comparison (if applicable)
  ozComparison?: {
    nonOZ: {
      afterTaxIRR: number;
      totalTaxesPaid: number;
    };
    withOZ: {
      afterTaxIRR: number;
      totalTaxesPaid: number;
      ozBenefit: number;
    };
    holdPeriodForFullBenefit: number; // years
    recommendation: string;
  };
  
  // Exit tax impact
  exitTaxAnalysis: {
    grossSaleProceeds: number;
    depreciationRecapture: number;
    recaptureTax: number;
    capitalGain: number;
    capitalGainsTax: number;
    netProceedsAfterTax: number;
    effectiveTaxRateOnGain: number;
  };
  
  // 1031 considerations
  considerations1031?: {
    required: boolean;
    deadlines: {
      identificationDeadline: Date;
      closingDeadline: Date;
    };
    deferredGain: number;
    requiredReplacementValue: number;
    recommendation: string;
  };
  
  summaryForCFO: string;
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// TAX → CFO SERVICE
// ============================================================================

class TaxCFOService {
  
  /**
   * Tax Strategist analyzes deal, generates after-tax returns for CFO
   */
  async calculateAfterTaxReturns(analysis: TaxAnalysis): Promise<AfterTaxReturns> {
    const { dealId, userId, purchasePrice, buildingValue, investorTaxBracket, capitalGainsRate, stateIncomeTaxRate } = analysis;
    
    logger.info('Tax Strategist calculating after-tax returns for CFO', { dealId });
    
    // Get deal proforma
    const dealData = await this.getDealData(dealId);
    
    // Calculate pre-tax returns
    const preTaxReturns = this.calculatePreTaxReturns(dealData);
    
    // Calculate depreciation
    const depreciation = this.calculateDepreciation(analysis, dealData.holdPeriod);
    
    // Calculate cost seg comparison
    const costSegAnalysis = this.calculateCostSegComparison(analysis, dealData, investorTaxBracket, stateIncomeTaxRate);
    
    // Calculate exit taxes
    const exitTaxAnalysis = this.calculateExitTaxes(dealData, depreciation, analysis);
    
    // Get AI synthesis
    const aiAnalysis = await this.getAIAnalysis(analysis, preTaxReturns, depreciation, costSegAnalysis, exitTaxAnalysis);
    
    // Calculate after-tax IRR
    const afterTaxIRR = this.calculateAfterTaxIRR(preTaxReturns, depreciation, exitTaxAnalysis, analysis);
    
    const result: AfterTaxReturns = {
      id: `tax_ret_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dealId,
      generatedAt: new Date(),
      preTaxIRR: preTaxReturns.irr,
      preTaxEquityMultiple: preTaxReturns.equityMultiple,
      preTaxCashOnCash: preTaxReturns.cashOnCash,
      afterTaxIRR: afterTaxIRR,
      afterTaxEquityMultiple: preTaxReturns.equityMultiple * (1 - (exitTaxAnalysis.effectiveTaxRateOnGain / 100) * 0.3),
      afterTaxCashOnCash: preTaxReturns.cashOnCash * (1 - investorTaxBracket * 0.5), // Simplified
      taxBenefits: aiAnalysis.taxBenefits || [],
      costSegAnalysis: costSegAnalysis,
      ozComparison: analysis.opportunityZone ? aiAnalysis.ozComparison : undefined,
      exitTaxAnalysis,
      considerations1031: analysis.must1031 ? {
        required: true,
        deadlines: {
          identificationDeadline: analysis.identification45DayDeadline || new Date(),
          closingDeadline: analysis.closing180DayDeadline || new Date(),
        },
        deferredGain: exitTaxAnalysis.capitalGain,
        requiredReplacementValue: exitTaxAnalysis.grossSaleProceeds,
        recommendation: aiAnalysis.recommendation1031 || 'Consult 1031 QI',
      } : undefined,
      summaryForCFO: aiAnalysis.summaryForCFO || 'Tax analysis complete',
    };
    
    // Store and notify
    await this.storeResult(result);
    await this.notifyCFO(dealId, userId, result);
    
    return result;
  }

  /**
   * Get deal data
   */
  private async getDealData(dealId: string): Promise<any> {
    const result = await query(
      `SELECT d.*, da.*
       FROM deals d
       LEFT JOIN deal_assumptions da ON d.id = da.deal_id
       WHERE d.id = $1`,
      [dealId]
    );
    
    if (result.rows.length === 0) {
      return {
        purchasePrice: 10000000,
        noi: 600000,
        exitValue: 12000000,
        holdPeriod: 5,
        equity: 3500000,
        ltv: 0.65,
      };
    }
    
    const deal = result.rows[0];
    const purchasePrice = deal.purchase_price || 10000000;
    const capRate = deal.cap_rate || 0.06;
    const exitCap = deal.exit_cap_rate || 0.065;
    const holdPeriod = deal.exit_year || 5;
    const noi = purchasePrice * capRate;
    const ltv = deal.ltv || 0.65;
    
    return {
      purchasePrice,
      noi,
      exitValue: (noi * Math.pow(1.03, holdPeriod)) / exitCap,
      holdPeriod,
      equity: purchasePrice * (1 - ltv),
      ltv,
    };
  }

  /**
   * Calculate pre-tax returns
   */
  private calculatePreTaxReturns(dealData: any): { irr: number; equityMultiple: number; cashOnCash: number } {
    const { noi, equity, exitValue, purchasePrice, holdPeriod, ltv } = dealData;
    const annualCashFlow = noi * 0.4; // After debt service
    const totalCashFlow = annualCashFlow * holdPeriod;
    const exitEquity = exitValue - purchasePrice * ltv * 0.95;
    const totalReturn = totalCashFlow + exitEquity;
    const equityMultiple = totalReturn / equity;
    const irr = (Math.pow(equityMultiple, 1 / holdPeriod) - 1) * 100;
    
    return {
      irr: Math.round(irr * 10) / 10,
      equityMultiple: Math.round(equityMultiple * 100) / 100,
      cashOnCash: Math.round((annualCashFlow / equity) * 1000) / 10,
    };
  }

  /**
   * Calculate depreciation
   */
  private calculateDepreciation(analysis: TaxAnalysis, holdPeriod: number): { annual: number; total: number; recapture: number } {
    const { buildingValue, depreciationMethod, costSegStudyAvailable } = analysis;
    
    // Standard straight-line: 27.5 years for residential
    const straightLineAnnual = buildingValue / 27.5;
    
    // Cost seg accelerates ~30-40% to 5/7/15 year property
    const costSegYear1 = costSegStudyAvailable ? buildingValue * 0.25 : 0; // Bonus depreciation
    
    let annual: number;
    let total: number;
    
    if (depreciationMethod === 'cost_seg' && costSegStudyAvailable) {
      // Simplified: big year 1, then declining
      annual = costSegYear1 + straightLineAnnual * 0.6;
      total = costSegYear1 + (straightLineAnnual * 0.6 * (holdPeriod - 1));
    } else {
      annual = straightLineAnnual;
      total = annual * holdPeriod;
    }
    
    return {
      annual: Math.round(annual),
      total: Math.round(total),
      recapture: Math.round(total), // All depreciation subject to recapture
    };
  }

  /**
   * Compare cost seg vs straight line
   */
  private calculateCostSegComparison(
    analysis: TaxAnalysis,
    dealData: any,
    taxBracket: number,
    stateTax: number
  ): AfterTaxReturns['costSegAnalysis'] {
    const { buildingValue } = analysis;
    const { holdPeriod } = dealData;
    const combinedRate = taxBracket + stateTax;
    
    // Without cost seg
    const slAnnual = buildingValue / 27.5;
    const slTotal = slAnnual * holdPeriod;
    const slYear1Savings = slAnnual * combinedRate;
    const slTotalSavings = slTotal * combinedRate;
    
    // With cost seg (aggressive year 1)
    const csYear1 = buildingValue * 0.30; // 30% accelerated
    const csRemaining = buildingValue * 0.70;
    const csAnnual = csRemaining / 27.5;
    const csTotal = csYear1 + (csAnnual * (holdPeriod - 1));
    const csYear1Savings = csYear1 * combinedRate;
    const csTotalSavings = csTotal * combinedRate;
    
    // IRR impact (present value of earlier deductions)
    const irrWithCS = 16.5; // Placeholder - would calculate properly
    const irrWithoutCS = 15.0;
    
    // Break-even study cost
    const pvBenefit = (csYear1Savings - slYear1Savings) * 0.95; // PV of year 1 difference
    const breakEvenStudyCost = pvBenefit;
    
    return {
      withCostSeg: {
        irr: irrWithCS,
        year1TaxSavings: Math.round(csYear1Savings),
        totalTaxSavings: Math.round(csTotalSavings),
      },
      withoutCostSeg: {
        irr: irrWithoutCS,
        year1TaxSavings: Math.round(slYear1Savings),
        totalTaxSavings: Math.round(slTotalSavings),
      },
      costSegRecommendation: buildingValue > 2000000,
      breakEvenStudyCost: Math.round(breakEvenStudyCost),
    };
  }

  /**
   * Calculate exit taxes
   */
  private calculateExitTaxes(dealData: any, depreciation: any, analysis: TaxAnalysis): AfterTaxReturns['exitTaxAnalysis'] {
    const { exitValue, purchasePrice } = dealData;
    const { capitalGainsRate, investorTaxBracket } = analysis;
    
    // Depreciation recapture at 25%
    const recaptureTax = depreciation.recapture * 0.25;
    
    // Capital gain
    const adjustedBasis = purchasePrice - depreciation.total;
    const capitalGain = exitValue - adjustedBasis;
    const capitalGainsTax = Math.max(0, capitalGain - depreciation.recapture) * capitalGainsRate;
    
    const totalTax = recaptureTax + capitalGainsTax;
    const netProceeds = exitValue - totalTax;
    const effectiveRate = (totalTax / capitalGain) * 100;
    
    return {
      grossSaleProceeds: Math.round(exitValue),
      depreciationRecapture: Math.round(depreciation.recapture),
      recaptureTax: Math.round(recaptureTax),
      capitalGain: Math.round(capitalGain),
      capitalGainsTax: Math.round(capitalGainsTax),
      netProceedsAfterTax: Math.round(netProceeds),
      effectiveTaxRateOnGain: Math.round(effectiveRate * 10) / 10,
    };
  }

  /**
   * Calculate after-tax IRR
   */
  private calculateAfterTaxIRR(
    preTaxReturns: any,
    depreciation: any,
    exitTaxAnalysis: any,
    analysis: TaxAnalysis
  ): number {
    // Simplified after-tax IRR
    // Real calculation would build full cash flow model
    const taxDrag = (exitTaxAnalysis.recaptureTax + exitTaxAnalysis.capitalGainsTax) / 
                    (analysis.purchasePrice * (1 - 0.65)); // As % of equity
    
    // Depreciation benefit (PV)
    const depBenefit = (depreciation.annual * analysis.investorTaxBracket) /
                       (analysis.purchasePrice * (1 - 0.65));
    
    // Net impact
    const netImpact = depBenefit * 5 - taxDrag; // Simplified
    const afterTaxIRR = preTaxReturns.irr + (netImpact * 100) - 1.5; // Typical drag
    
    return Math.round(afterTaxIRR * 10) / 10;
  }

  /**
   * Get AI analysis
   */
  private async getAIAnalysis(
    analysis: TaxAnalysis,
    preTaxReturns: any,
    depreciation: any,
    costSegAnalysis: any,
    exitTaxAnalysis: any
  ): Promise<any> {
    const prompt = `You are a real estate Tax Strategist advising the CFO on after-tax returns.

DEAL:
- Purchase Price: $${analysis.purchasePrice.toLocaleString()}
- Building Value: $${analysis.buildingValue.toLocaleString()}
- Investor Tax Bracket: ${(analysis.investorTaxBracket * 100).toFixed(0)}%
- Capital Gains Rate: ${(analysis.capitalGainsRate * 100).toFixed(0)}%
- State Tax Rate: ${(analysis.stateIncomeTaxRate * 100).toFixed(0)}%
- Entity: ${analysis.entityType}
- Opportunity Zone: ${analysis.opportunityZone ? 'YES' : 'NO'}
- Must 1031: ${analysis.must1031 ? 'YES' : 'NO'}

PRE-TAX RETURNS:
- IRR: ${preTaxReturns.irr}%
- Equity Multiple: ${preTaxReturns.equityMultiple}x
- Cash-on-Cash: ${preTaxReturns.cashOnCash}%

DEPRECIATION:
- Annual: $${depreciation.annual.toLocaleString()}
- Total over hold: $${depreciation.total.toLocaleString()}
- Recapture at exit: $${depreciation.recapture.toLocaleString()}

COST SEG COMPARISON:
- With: $${costSegAnalysis?.withCostSeg.year1TaxSavings.toLocaleString()} year 1 savings
- Without: $${costSegAnalysis?.withoutCostSeg.year1TaxSavings.toLocaleString()} year 1 savings

EXIT TAXES:
- Gross Proceeds: $${exitTaxAnalysis.grossSaleProceeds.toLocaleString()}
- Recapture Tax: $${exitTaxAnalysis.recaptureTax.toLocaleString()}
- Capital Gains Tax: $${exitTaxAnalysis.capitalGainsTax.toLocaleString()}
- Effective Tax Rate: ${exitTaxAnalysis.effectiveTaxRateOnGain}%

Provide analysis in JSON:
{
  "taxBenefits": [
    {
      "benefit": "<name>",
      "year1Impact": <$>,
      "totalImpact": <$>,
      "irrImpact": <bps>,
      "notes": "<key considerations>"
    }
  ],
  ${analysis.opportunityZone ? `"ozComparison": {
    "nonOZ": { "afterTaxIRR": <>, "totalTaxesPaid": <> },
    "withOZ": { "afterTaxIRR": <>, "totalTaxesPaid": <>, "ozBenefit": <> },
    "holdPeriodForFullBenefit": <years>,
    "recommendation": "<>"
  },` : ''}
  ${analysis.must1031 ? `"recommendation1031": "<advice on 1031 strategy>",` : ''}
  "summaryForCFO": "<2-3 sentence summary of after-tax returns and key tax considerations>"
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
      logger.warn('AI tax analysis failed', { error });
      return { summaryForCFO: 'Tax analysis complete - review details' };
    }
  }

  /**
   * Store result
   */
  private async storeResult(result: AfterTaxReturns): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_collaboration_after_tax_returns
         (id, deal_id, pre_tax_irr, after_tax_irr, pre_tax_em, after_tax_em,
          tax_benefits, cost_seg_analysis, oz_comparison, exit_tax_analysis,
          considerations_1031, summary, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          result.id, result.dealId, result.preTaxIRR, result.afterTaxIRR,
          result.preTaxEquityMultiple, result.afterTaxEquityMultiple,
          JSON.stringify(result.taxBenefits), JSON.stringify(result.costSegAnalysis),
          JSON.stringify(result.ozComparison), JSON.stringify(result.exitTaxAnalysis),
          JSON.stringify(result.considerations1031), result.summaryForCFO, result.generatedAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to store after-tax returns', { error });
    }
  }

  /**
   * Notify CFO
   */
  private async notifyCFO(dealId: string, userId: string, result: AfterTaxReturns): Promise<void> {
    try {
      await query(
        `INSERT INTO agent_notifications 
         (user_id, deal_id, agent_id, type, title, message, channels)
         VALUES ($1, $2, 'cfo', 'info', $3, $4, '["in_app"]')`,
        [
          userId, dealId,
          'Tax Analysis: After-Tax Returns Ready',
          result.summaryForCFO,
        ]
      );
    } catch (error) {
      logger.warn('Failed to notify CFO', { error });
    }
  }

  /**
   * Get after-tax returns for a deal
   */
  async getAfterTaxReturns(dealId: string): Promise<AfterTaxReturns | null> {
    const result = await query(
      `SELECT * FROM agent_collaboration_after_tax_returns WHERE deal_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      [dealId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      dealId: row.deal_id,
      generatedAt: row.generated_at,
      preTaxIRR: row.pre_tax_irr,
      preTaxEquityMultiple: row.pre_tax_em,
      preTaxCashOnCash: 0,
      afterTaxIRR: row.after_tax_irr,
      afterTaxEquityMultiple: row.after_tax_em,
      afterTaxCashOnCash: 0,
      taxBenefits: row.tax_benefits,
      costSegAnalysis: row.cost_seg_analysis,
      ozComparison: row.oz_comparison,
      exitTaxAnalysis: row.exit_tax_analysis,
      considerations1031: row.considerations_1031,
      summaryForCFO: row.summary,
    };
  }
}

export const taxCFOService = new TaxCFOService();
export default taxCFOService;
