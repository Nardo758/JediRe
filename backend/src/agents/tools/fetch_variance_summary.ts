/**
 * fetch_variance_summary Tool
 * 
 * Retrieves variance analysis for narrative generation.
 * Shows projected vs actual performance with explanations.
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export const fetchVarianceSummarySchema = z.object({
  deal_id: z.string().describe('Deal ID to fetch variance for'),
  period: z.enum(['ytd', 'trailing_3mo', 'trailing_6mo', 'trailing_12mo', 'latest_month']).default('ytd'),
  include_recommendations: z.boolean().default(true).describe('Include AI-generated recommendations'),
});

export type FetchVarianceSummaryInput = z.infer<typeof fetchVarianceSummarySchema>;

export interface VarianceSummaryResult {
  dealId: string;
  dealName: string;
  periodLabel: string;
  asOfDate: string;
  
  // High-level summary
  summary: {
    totalVarianceItems: number;
    favorableCount: number;
    unfavorableCount: number;
    noiVariancePct: number;
    noiVarianceDirection: 'favorable' | 'unfavorable' | 'on_plan';
    overallAssessment: string;
  };
  
  // Revenue variances
  revenue: {
    lineItem: string;
    projected: number;
    actual: number;
    variance: number;
    variancePct: number;
    direction: 'favorable' | 'unfavorable';
    consecutiveMonths: number;
    explanation: string;
  }[];
  
  // Expense variances
  expenses: {
    lineItem: string;
    projected: number;
    actual: number;
    variance: number;
    variancePct: number;
    direction: 'favorable' | 'unfavorable';
    consecutiveMonths: number;
    explanation: string;
  }[];
  
  // Key drivers (most impactful variances)
  keyDrivers: {
    lineItem: string;
    impact: number; // Dollar impact on NOI
    impactPct: number;
    narrative: string;
  }[];
  
  // Recommendations (if available)
  recommendations: {
    category: string;
    action: string;
    estimatedImpact: number;
    urgency: 'high' | 'medium' | 'low';
  }[];
  
  // Pre-built narrative snippets
  narrativeSnippets: string[];
}

/**
 * Fetch variance summary for commentary
 */
function mapPriority(priority: string | null | undefined): 'high' | 'medium' | 'low' {
  switch(priority?.toLowerCase()) {
    case 'critical': return 'high';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    default: return 'medium';
  }
}

export async function fetchVarianceSummary(
  input: FetchVarianceSummaryInput
): Promise<VarianceSummaryResult> {
  logger.info('[fetch_variance_summary] Fetching variance', {
    dealId: input.deal_id,
    period: input.period,
  });

  // Get deal name
  const dealResult = await query(
    `SELECT name FROM deals WHERE id = $1`,
    [input.deal_id]
  );
  const dealName = String((dealResult.rows[0] as Record<string, string>)?.name ?? 'Unknown');

  // Determine date range based on period
  let dateCondition: string;
  let periodLabel: string;
  
  switch (input.period) {
    case 'latest_month':
      dateCondition = `period_start = (SELECT MAX(period_start) FROM variance_analysis WHERE deal_id = $1)`;
      periodLabel = 'Latest Month';
      break;
    case 'trailing_3mo':
      dateCondition = `period_start >= CURRENT_DATE - INTERVAL '3 months'`;
      periodLabel = 'Trailing 3 Months';
      break;
    case 'trailing_6mo':
      dateCondition = `period_start >= CURRENT_DATE - INTERVAL '6 months'`;
      periodLabel = 'Trailing 6 Months';
      break;
    case 'trailing_12mo':
      dateCondition = `period_start >= CURRENT_DATE - INTERVAL '12 months'`;
      periodLabel = 'Trailing 12 Months';
      break;
    case 'ytd':
    default:
      dateCondition = `period_start >= DATE_TRUNC('year', CURRENT_DATE)`;
      periodLabel = 'Year to Date';
  }

  // Get variance data
  const varianceResult = await query(
    `SELECT 
      line_item,
      category,
      SUM(projected_value) as projected,
      SUM(actual_value) as actual,
      SUM(variance_amount) as variance,
      AVG(variance_pct) as variance_pct,
      MAX(consecutive_months) as consecutive_months,
      MAX(period_start) as latest_period
    FROM variance_analysis
    WHERE deal_id = $1 AND ${dateCondition}
    GROUP BY line_item, category
    ORDER BY ABS(SUM(variance_amount)) DESC`,
    [input.deal_id]
  );

  // Get recommendations if requested
  const recsResult = input.include_recommendations
    ? await query(
        `SELECT category, title, estimated_monthly_impact, priority
         FROM operations_recommendations
         WHERE deal_id = $1 AND status = 'open'
         ORDER BY estimated_noi_impact DESC
         LIMIT 10`,
        [input.deal_id]
      )
    : { rows: [] };

  // Process variances
  const revenueItems: VarianceSummaryResult['revenue'] = [];
  const expenseItems: VarianceSummaryResult['expenses'] = [];
  const keyDrivers: VarianceSummaryResult['keyDrivers'] = [];
  
  let totalProjectedNoi = 0;
  let totalActualNoi = 0;
  let favorableCount = 0;
  let unfavorableCount = 0;
  let latestPeriod = new Date();

  for (const row of varianceResult.rows as Record<string, unknown>[]) {
    const lineItem = String(row.line_item);
    const category = String(row.category ?? '');
    const projected = Number(row.projected ?? 0);
    const actual = Number(row.actual ?? 0);
    const variance = Number(row.variance ?? 0);
    const variancePct = Number(row.variance_pct ?? 0);
    const consecutiveMonths = Number(row.consecutive_months ?? 0);
    
    if (row.latest_period) {
      const periodDate = new Date(row.latest_period as string);
      if (periodDate > latestPeriod) latestPeriod = periodDate;
    }

    // Determine direction (for expenses, negative variance is favorable)
    const isExpense = ['opex', 'expense', 'operating'].some(t => category.toLowerCase().includes(t));
    const isFavorable = isExpense ? variance < 0 : variance > 0;
    
    if (isFavorable) favorableCount++;
    else unfavorableCount++;

    const item = {
      lineItem,
      projected,
      actual,
      variance,
      variancePct,
      direction: (isFavorable ? 'favorable' : 'unfavorable') as 'favorable' | 'unfavorable',
      consecutiveMonths,
      explanation: generateVarianceExplanation(lineItem, variancePct, consecutiveMonths, isFavorable),
    };

    if (isExpense) {
      expenseItems.push(item);
    } else {
      revenueItems.push(item);
    }

    // Track NOI impact
    if (lineItem.toLowerCase().includes('noi') || lineItem === 'net_operating_income') {
      totalProjectedNoi = projected;
      totalActualNoi = actual;
    }

    // Add to key drivers if significant
    if (Math.abs(variancePct) > 5) {
      keyDrivers.push({
        lineItem,
        impact: variance,
        impactPct: variancePct,
        narrative: generateDriverNarrative(lineItem, variance, variancePct, isFavorable),
      });
    }
  }

  // Calculate NOI variance
  const noiVariance = totalActualNoi - totalProjectedNoi;
  const noiVariancePct = totalProjectedNoi > 0 ? (noiVariance / totalProjectedNoi) * 100 : 0;
  const noiDirection = noiVariancePct > 2 ? 'favorable' : noiVariancePct < -2 ? 'unfavorable' : 'on_plan';

  // Build recommendations
  const recommendations = (recsResult.rows as Record<string, unknown>[]).map(row => ({
    category: String(row.category),
    action: String(row.title),
    estimatedImpact: Number(row.estimated_monthly_impact ?? (row.estimated_annual_impact ? row.estimated_annual_impact / 12 : 0) ?? 0),
    urgency: mapPriority(row.priority) as 'high' | 'medium' | 'low',
  }));

  // Generate overall assessment
  const overallAssessment = generateOverallAssessment(noiVariancePct, favorableCount, unfavorableCount, keyDrivers);

  // Generate narrative snippets
  const narrativeSnippets = generateNarrativeSnippets(
    noiVariancePct,
    noiDirection,
    keyDrivers.slice(0, 3),
    recommendations.slice(0, 2)
  );

  const result: VarianceSummaryResult = {
    dealId: input.deal_id,
    dealName,
    periodLabel,
    asOfDate: latestPeriod.toISOString().split('T')[0],
    summary: {
      totalVarianceItems: revenueItems.length + expenseItems.length,
      favorableCount,
      unfavorableCount,
      noiVariancePct,
      noiVarianceDirection: noiDirection,
      overallAssessment,
    },
    revenue: revenueItems,
    expenses: expenseItems,
    keyDrivers: keyDrivers.slice(0, 5),
    recommendations,
    narrativeSnippets,
  };

  logger.info('[fetch_variance_summary] Fetched', {
    dealId: input.deal_id,
    noiVariancePct,
    keyDriversCount: keyDrivers.length,
  });

  return result;
}

/**
 * Generate explanation for a variance item
 */
function generateVarianceExplanation(
  lineItem: string,
  variancePct: number,
  consecutiveMonths: number,
  isFavorable: boolean
): string {
  const trend = consecutiveMonths > 2 ? 'persistent' : consecutiveMonths > 1 ? 'emerging' : 'recent';
  const magnitude = Math.abs(variancePct) > 15 ? 'significant' : Math.abs(variancePct) > 5 ? 'notable' : 'minor';
  const direction = isFavorable ? 'outperformance' : 'underperformance';
  
  return `${magnitude.charAt(0).toUpperCase() + magnitude.slice(1)} ${direction} (${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%) — ${trend} trend over ${consecutiveMonths} month${consecutiveMonths > 1 ? 's' : ''}.`;
}

/**
 * Generate narrative for a key driver
 */
function generateDriverNarrative(
  lineItem: string,
  variance: number,
  variancePct: number,
  isFavorable: boolean
): string {
  const formattedItem = lineItem.replace(/_/g, ' ');
  const formattedVariance = variance >= 0 ? `+$${(variance / 1000).toFixed(0)}K` : `-$${(Math.abs(variance) / 1000).toFixed(0)}K`;
  
  if (isFavorable) {
    return `${formattedItem.charAt(0).toUpperCase() + formattedItem.slice(1)} is contributing ${formattedVariance} (${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%) to performance.`;
  } else {
    return `${formattedItem.charAt(0).toUpperCase() + formattedItem.slice(1)} is creating a ${formattedVariance} (${variancePct.toFixed(1)}%) drag on performance.`;
  }
}

/**
 * Generate overall assessment
 */
function generateOverallAssessment(
  noiVariancePct: number,
  favorableCount: number,
  unfavorableCount: number,
  keyDrivers: VarianceSummaryResult['keyDrivers']
): string {
  const topDriver = keyDrivers[0];
  
  if (noiVariancePct > 5) {
    return `Strong performance: NOI is ${noiVariancePct.toFixed(1)}% ahead of plan with ${favorableCount} favorable line items. ${topDriver ? `Primary contributor: ${topDriver.lineItem.replace(/_/g, ' ')}.` : ''}`;
  } else if (noiVariancePct > 0) {
    return `Positive performance: NOI is tracking ${noiVariancePct.toFixed(1)}% ahead of plan. ${favorableCount} favorable vs ${unfavorableCount} unfavorable variances.`;
  } else if (noiVariancePct >= -3) {
    return `On-plan performance: NOI is tracking within ${Math.abs(noiVariancePct).toFixed(1)}% of projection. Continue monitoring key line items.`;
  } else if (noiVariancePct >= -10) {
    return `Below-plan performance: NOI is trailing by ${Math.abs(noiVariancePct).toFixed(1)}%. ${topDriver ? `Primary headwind: ${topDriver.lineItem.replace(/_/g, ' ')}.` : ''} Corrective action recommended.`;
  } else {
    return `Significant underperformance: NOI is ${Math.abs(noiVariancePct).toFixed(1)}% below plan. Immediate intervention required to address ${unfavorableCount} unfavorable variances.`;
  }
}

/**
 * Generate narrative snippets for commentary
 */
function generateNarrativeSnippets(
  noiVariancePct: number,
  noiDirection: 'favorable' | 'unfavorable' | 'on_plan',
  keyDrivers: VarianceSummaryResult['keyDrivers'],
  recommendations: VarianceSummaryResult['recommendations']
): string[] {
  const snippets: string[] = [];
  
  // NOI summary
  if (noiDirection === 'favorable') {
    snippets.push(`Net Operating Income is outperforming budget by ${noiVariancePct.toFixed(1)}%.`);
  } else if (noiDirection === 'unfavorable') {
    snippets.push(`Net Operating Income is trailing budget by ${Math.abs(noiVariancePct).toFixed(1)}%.`);
  } else {
    snippets.push(`Net Operating Income is tracking within expectations.`);
  }
  
  // Key drivers
  for (const driver of keyDrivers) {
    snippets.push(driver.narrative);
  }
  
  // Recommendations
  if (recommendations.length > 0) {
    const highUrgency = recommendations.filter(r => r.urgency === 'high');
    if (highUrgency.length > 0) {
      snippets.push(`Priority action: ${highUrgency[0].action} (est. $${(highUrgency[0].estimatedImpact / 1000).toFixed(0)}K NOI impact).`);
    }
  }
  
  return snippets;
}

/**
 * Tool definition for agent registration
 */
export const fetchVarianceSummaryTool = {
  name: 'fetch_variance_summary',
  description: `Retrieve variance analysis for narrative generation.
Shows projected vs actual performance with explanations.

Returns:
- Summary (NOI variance, favorable/unfavorable counts)
- Revenue variances by line item
- Expense variances by line item
- Key drivers with NOI impact
- AI-generated recommendations
- Pre-built narrative snippets

Supports periods: ytd, trailing_3mo, trailing_6mo, trailing_12mo, latest_month

Use for operational commentary and investor reports.`,
  inputSchema: fetchVarianceSummarySchema,
  outputSchema: z.any(),
  execute: fetchVarianceSummary,
};
