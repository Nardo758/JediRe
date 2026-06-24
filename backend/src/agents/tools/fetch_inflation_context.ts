/**
 * Agent Tool: Fetch Inflation Context
 * 
 * Provides agents with JediRe's proprietary inflation intelligence for:
 * - Rent growth assumption validation
 * - Expense escalation projections
 * - Cap rate spread analysis
 * - Construction cost budgeting
 * 
 * Uses the JediRe Composite Inflation Score (JCIS) which blends:
 * - Standard sources (BLS CPI, PPI, FRED)
 * - Proprietary indices (Rent, OpEx, Insurance, Tax)
 */

import { z } from 'zod';
import { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { getInflationEngineService, InflationContext } from '../../services/inflation';

export const fetchInflationContextSchema = z.object({
  geography: z.object({
    level: z.enum(['national', 'msa', 'county']).default('national'),
    name: z.string().default('United States'),
    fipsCode: z.string().optional()
  }).optional(),
  
  // What context to include
  includeCPI: z.boolean().optional().default(true),
  includeFed: z.boolean().optional().default(true),
  includeJediReIndices: z.boolean().optional().default(true),
  includeGuidance: z.boolean().optional().default(true),
  includeForecasts: z.boolean().optional().default(true)
});

export type FetchInflationContextParams = z.infer<typeof fetchInflationContextSchema>;

export interface InflationContextResult {
  // Core score
  compositeScore: number;
  regime: string;
  confidence: string;
  
  // Underwriting guidance
  guidance: {
    rentGrowthRecommendation: number;
    expenseEscalationRecommendation: number;
    capRateSpreadVsTreasury: number;
    constructionContingency: number;
  };
  
  // Key indicators for agents
  keyIndicators: {
    cpiAllItems: number;
    cpiShelter: number;
    cpiRent: number;
    fedFundsRate: number;
    treasury10Y: number;
    breakeven10Y: number;
  };
  
  // JediRe proprietary
  jediReIndices: {
    rentInflation: number;
    operatingCosts: number;
    insurance: number;
    taxes: number;
    construction: number;
  };
  
  // Forecasts
  forecasts: {
    cpi12Month: number;
    shelterInflation12Month: number;
    rentGrowth12Month: number;
  };
  
  // Agent-friendly summary
  summary: string;
  
  // Risk factors to consider
  riskFactors: string[];
  
  asOf: Date;
}

export async function fetchInflationContext(
  params: FetchInflationContextParams,
  pool: Pool
): Promise<InflationContextResult> {
  const geography = params.geography || { level: 'national' as const, name: 'United States' };
  
  const service = getInflationEngineService(pool);
  const context = await service.getInflationContext(geography);
  
  // Build agent-friendly result
  const result: InflationContextResult = {
    compositeScore: context.compositeScore.score,
    regime: context.compositeScore.regime,
    confidence: context.compositeScore.confidence,
    
    guidance: {
      rentGrowthRecommendation: context.compositeScore.underwritingGuidance.rentGrowthRecommendation,
      expenseEscalationRecommendation: context.compositeScore.underwritingGuidance.expenseEscalationRecommendation,
      capRateSpreadVsTreasury: context.compositeScore.underwritingGuidance.capRateSpreadVsTreasury,
      constructionContingency: (context.compositeScore.underwritingGuidance as any).constructionCostContingency ?? 15,
    },
    
    keyIndicators: {
      cpiAllItems: context.cpi.allItems,
      cpiShelter: context.cpi.shelter,
      cpiRent: context.cpi.rentPrimary,
      fedFundsRate: context.fred.fedFundsRate,
      treasury10Y: context.fred.treasury10Year,
      breakeven10Y: context.fred.breakeven10Year
    },
    
    jediReIndices: {
      rentInflation: context.jediReIndices.rentInflationIndex.national,
      operatingCosts: context.jediReIndices.operatingCostIndex.composite,
      insurance: context.jediReIndices.insuranceInflationIndex.composite,
      taxes: context.jediReIndices.taxAssessmentIndex.composite,
      construction: context.jediReIndices.constructionCostIndex.composite
    },
    
    forecasts: {
      cpi12Month: context.forecasts.cpi12Month,
      shelterInflation12Month: context.forecasts.shelterInflation12Month,
      rentGrowth12Month: context.forecasts.rentGrowth12Month
    },
    
    summary: generateSummary(context),
    riskFactors: identifyRiskFactors(context),
    
    asOf: context.asOf
  };
  
  return result;
}

function generateSummary(context: InflationContext): string {
  const score = context.compositeScore.score;
  const regime = context.compositeScore.regime;
  const guidance = context.compositeScore.underwritingGuidance;
  
  let summary = `JediRe Composite Inflation Score: ${score}/200 (${regime.replace('_', ' ')}). `;
  
  if (regime === 'elevated' || regime === 'high_inflation') {
    summary += `Inflation is running hot. `;
    summary += `Recommend ${guidance.rentGrowthRecommendation}% rent growth and ${guidance.expenseEscalationRecommendation}% expense escalation. `;
    summary += `Cap rates should provide ${guidance.capRateSpreadVsTreasury}bps spread over 10Y Treasury (${context.fred.treasury10Year}%). `;
  } else if (regime === 'moderate') {
    summary += `Inflation is within normal range. `;
    summary += `Use ${guidance.rentGrowthRecommendation}% rent growth and ${guidance.expenseEscalationRecommendation}% expense escalation. `;
  } else {
    summary += `Inflation is subdued. `;
    summary += `Conservative rent growth of ${guidance.rentGrowthRecommendation}% recommended. `;
  }
  
  // Insurance callout if elevated
  if (context.jediReIndices.insuranceInflationIndex.composite > 10) {
    summary += `⚠️ Insurance costs rising ${context.jediReIndices.insuranceInflationIndex.composite}% annually. `;
  }
  
  return summary;
}

function identifyRiskFactors(context: InflationContext): string[] {
  const risks: string[] = [];
  
  // High shelter inflation
  if (context.cpi.shelter > 5.0) {
    risks.push(`Shelter CPI at ${context.cpi.shelter}% - may pressure rent affordability`);
  }
  
  // Insurance crisis
  if (context.jediReIndices.insuranceInflationIndex.composite > 15) {
    risks.push(`Insurance inflation at ${context.jediReIndices.insuranceInflationIndex.composite}% - budget aggressively`);
  }
  
  // Tax reassessment risk
  if (context.jediReIndices.taxAssessmentIndex.reassessmentRisk === 'high') {
    risks.push('High property tax reassessment risk in this geography');
  }
  
  // Construction costs
  if (context.jediReIndices.constructionCostIndex.composite > 5) {
    risks.push(`Construction costs rising ${context.jediReIndices.constructionCostIndex.composite}% - add contingency for CapEx/value-add`);
  }
  
  // Fed policy
  if (context.fred.fedFundsRate > 5.0 && context.fred.breakeven10Year < 2.5) {
    risks.push('Real rates are restrictive - cap rate expansion risk if Fed holds longer');
  }
  
  // Operating cost pressure
  if (context.jediReIndices.operatingCostIndex.trend === 'accelerating') {
    risks.push('Operating costs accelerating - expense ratios may increase');
  }
  
  return risks;
}

// Tool definition for agent registry
export const fetchInflationContextTool = {
  name: 'fetch_inflation_context',
  description: `Get JediRe's proprietary inflation intelligence for underwriting.

Returns:
- JediRe Composite Inflation Score (0-200, 100=neutral)
- Inflation regime (deflationary/low/moderate/elevated/high)
- Recommended rent growth and expense escalation rates
- Cap rate spread guidance vs 10Y Treasury
- Construction cost contingency recommendation
- CPI components (all items, shelter, rent)
- Fed indicators (funds rate, 10Y Treasury, breakeven inflation)
- JediRe proprietary indices:
  * Rent Inflation Index (actual rent growth from platform deals)
  * Operating Cost Index (expense trends from T12s)
  * Insurance Inflation Index (property insurance trends)
  * Tax Assessment Index (county tax growth)
  * Construction Cost Index (development cost trends)
- 12-month forecasts
- Risk factors to consider

Use this tool to:
- Validate rent growth assumptions in underwriting
- Set expense escalation factors
- Determine appropriate cap rate spreads
- Budget construction/CapEx contingencies
- Identify inflation-related risks`,
  
  inputSchema: fetchInflationContextSchema,
  execute: async (input, _ctx) => fetchInflationContext(input, getPool())
};


