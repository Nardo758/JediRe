/**
 * Revenue Management Service
 * 
 * The brain of operations intelligence:
 * - Compares actuals to projections at line-item level
 * - Monitors rent roll and lease expirations
 * - Analyzes traffic vs predictions
 * - Generates actionable recommendations
 * - Feeds learnings back to the underwriting system
 * 
 * This is where underwriting meets operations — closing the loop
 * between what we projected and what's actually happening.
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export interface VarianceItem {
  lineItem: string;
  category: string;
  projected: number;
  actual: number;
  varianceAmount: number;
  variancePct: number;
  varianceType: 'favorable' | 'unfavorable' | 'neutral';
  severity: 'minor' | 'moderate' | 'major';
  trend: 'improving' | 'stable' | 'worsening';
  consecutiveMonths: number;
  noiImpact: number;
}

export interface OperationsRecommendation {
  category: 'pricing' | 'occupancy' | 'expense' | 'renewal' | 'traffic' | 'collections' | 'other_income';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  estimatedMonthlyImpact: number;
  estimatedAnnualImpact: number;
  confidence: number;
  suggestedActions: { action: string; detail?: string }[];
}

export interface LeaseExpirationAnalysis {
  month: string;
  expiringUnits: number;
  expiringPct: number;
  rentAtRisk: number;
  avgCurrentRent: number;
  avgMarketRent: number;
  lossToLeasePct: number;
  recommendedAction: string;
  recommendedIncreasePct: number;
}

export interface TrafficAnalysis {
  period: string;
  projectedLeads: number;
  actualLeads: number;
  leadVariancePct: number;
  projectedMoveIns: number;
  actualMoveIns: number;
  moveInVariancePct: number;
  conversionRate: number;
  benchmarkConversion: number;
  recommendations: string[];
}

// ─── Variance Analysis ────────────────────────────────────────────────

/**
 * Compute variance analysis for a deal's current period
 */
export async function computeVarianceAnalysis(
  dealId: string,
  periodStart: Date
): Promise<VarianceItem[]> {
  const periodStr = periodStart.toISOString().slice(0, 10);
  
  // Get projections
  const projResult = await query(
    `SELECT * FROM proforma_projections WHERE deal_id = $1 AND period_start = $2`,
    [dealId, periodStr]
  );
  
  // Get actuals
  const actResult = await query(
    `SELECT * FROM operations_actuals WHERE deal_id = $1 AND period_start = $2`,
    [dealId, periodStr]
  );
  
  if (projResult.rows.length === 0 || actResult.rows.length === 0) {
    return [];
  }
  
  const proj = projResult.rows[0] as Record<string, number>;
  const actual = actResult.rows[0] as Record<string, number>;
  
  const variances: VarianceItem[] = [];
  
  // Line items to compare
  const lineItems = [
    // Revenue
    { key: 'gross_potential_rent', category: 'revenue' },
    { key: 'loss_to_lease', category: 'revenue' },
    { key: 'vacancy_loss', category: 'revenue' },
    { key: 'concessions', category: 'revenue' },
    { key: 'bad_debt', category: 'revenue' },
    { key: 'other_income', category: 'revenue' },
    { key: 'effective_gross_income', category: 'revenue' },
    // OpEx
    { key: 'payroll', category: 'opex' },
    { key: 'management_fee', category: 'opex' },
    { key: 'utilities_total', category: 'opex' },
    { key: 'repairs_maintenance', category: 'opex' },
    { key: 'make_ready', category: 'opex' },
    { key: 'insurance', category: 'opex' },
    { key: 'real_estate_taxes', category: 'opex' },
    { key: 'total_operating_expenses', category: 'opex' },
    // NOI
    { key: 'net_operating_income', category: 'noi' },
  ];
  
  for (const item of lineItems) {
    const projected = Number(proj[item.key] ?? 0);
    const actualVal = Number(actual[item.key] ?? 0);
    
    if (projected === 0 && actualVal === 0) continue;
    
    const varianceAmount = actualVal - projected;
    const variancePct = projected !== 0 ? (varianceAmount / Math.abs(projected)) * 100 : 0;
    
    // Determine if favorable/unfavorable
    let varianceType: 'favorable' | 'unfavorable' | 'neutral' = 'neutral';
    if (item.category === 'revenue' || item.category === 'noi') {
      varianceType = varianceAmount > 0 ? 'favorable' : varianceAmount < 0 ? 'unfavorable' : 'neutral';
    } else if (item.category === 'opex') {
      varianceType = varianceAmount < 0 ? 'favorable' : varianceAmount > 0 ? 'unfavorable' : 'neutral';
    }
    
    // Severity
    const absPct = Math.abs(variancePct);
    const severity: 'minor' | 'moderate' | 'major' = absPct > 15 ? 'major' : absPct > 5 ? 'moderate' : 'minor';
    
    // NOI impact
    let noiImpact = 0;
    if (item.category === 'revenue') noiImpact = varianceAmount;
    if (item.category === 'opex') noiImpact = -varianceAmount;
    if (item.category === 'noi') noiImpact = varianceAmount;
    
    variances.push({
      lineItem: item.key,
      category: item.category,
      projected,
      actual: actualVal,
      varianceAmount,
      variancePct,
      varianceType,
      severity,
      trend: 'stable', // Would need historical data to compute
      consecutiveMonths: 1,
      noiImpact,
    });
  }
  
  // Save to database
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    for (const v of variances) {
      await client.query(
        `INSERT INTO variance_analysis (
          deal_id, period_start, period_end, line_item, category,
          projected_value, actual_value, noi_impact, annualized_impact, severity
        ) VALUES ($1, $2, $2 + INTERVAL '1 month', $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (deal_id, period_start, line_item) DO UPDATE SET
          actual_value = EXCLUDED.actual_value,
          noi_impact = EXCLUDED.noi_impact,
          computed_at = NOW()`,
        [
          dealId, periodStr, v.lineItem, v.category,
          v.projected, v.actual, v.noiImpact, v.noiImpact * 12, v.severity,
        ]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  return variances;
}

// ─── Lease Expiration Analysis ────────────────────────────────────────

/**
 * Analyze lease expirations and generate renewal recommendations
 */
export async function analyzeLeaseExpirations(
  dealId: string,
  monthsAhead = 6
): Promise<LeaseExpirationAnalysis[]> {
  const result = await query(`
    SELECT 
      DATE_TRUNC('month', lease_end) as expiration_month,
      COUNT(*) as expiring_count,
      SUM(current_rent) as total_rent,
      AVG(current_rent) as avg_current_rent,
      AVG(market_rent) as avg_market_rent,
      AVG(loss_to_lease_pct) as avg_ltl_pct
    FROM rent_roll_units
    WHERE deal_id = $1
      AND status = 'occupied'
      AND lease_end BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 || ' months')::interval
    GROUP BY DATE_TRUNC('month', lease_end)
    ORDER BY expiration_month
  `, [dealId, monthsAhead]);
  
  // Get total unit count
  const totalResult = await query(
    `SELECT COUNT(*) as total FROM rent_roll_units WHERE deal_id = $1 AND status = 'occupied'`,
    [dealId]
  );
  const totalUnits = Number(totalResult.rows[0]?.total ?? 1);
  
  const analysis: LeaseExpirationAnalysis[] = [];
  
  for (const row of result.rows as Record<string, unknown>[]) {
    const expiringUnits = Number(row.expiring_count);
    const expiringPct = (expiringUnits / totalUnits) * 100;
    const avgCurrentRent = Number(row.avg_current_rent ?? 0);
    const avgMarketRent = Number(row.avg_market_rent ?? 0);
    const lossToLeasePct = Number(row.avg_ltl_pct ?? 0);
    
    // Generate recommendation
    let recommendedAction: string;
    let recommendedIncreasePct: number;
    
    if (lossToLeasePct > 10) {
      // Significant loss to lease - push harder on renewals
      recommendedAction = 'AGGRESSIVE RENEWAL: Significant loss-to-lease opportunity';
      recommendedIncreasePct = Math.min(lossToLeasePct * 0.7, 12); // Capture 70% of gap, max 12%
    } else if (lossToLeasePct > 5) {
      recommendedAction = 'MODERATE INCREASE: Capture loss-to-lease while maintaining retention';
      recommendedIncreasePct = Math.min(lossToLeasePct * 0.5, 6);
    } else if (lossToLeasePct > 0) {
      recommendedAction = 'STANDARD INCREASE: Market-aligned renewal';
      recommendedIncreasePct = Math.max(lossToLeasePct, 2.5);
    } else {
      // At or above market - focus on retention
      recommendedAction = 'RETENTION FOCUS: At-market rent, prioritize renewal';
      recommendedIncreasePct = Math.max(1, lossToLeasePct);
    }
    
    // Adjust for concentration risk
    if (expiringPct > 15) {
      recommendedAction += ' ⚠️ HIGH CONCENTRATION - stagger renewal offers';
    }
    
    analysis.push({
      month: new Date(row.expiration_month as string).toISOString().slice(0, 7),
      expiringUnits,
      expiringPct,
      rentAtRisk: Number(row.total_rent),
      avgCurrentRent,
      avgMarketRent,
      lossToLeasePct,
      recommendedAction,
      recommendedIncreasePct,
    });
  }
  
  return analysis;
}

// ─── Traffic Analysis ─────────────────────────────────────────────────

/**
 * Analyze traffic performance vs predictions
 */
export async function analyzeTrafficPerformance(
  dealId: string,
  months = 3
): Promise<TrafficAnalysis[]> {
  const result = await query(`
    SELECT 
      TO_CHAR(t.period_start, 'YYYY-MM') as period,
      t.total_leads as actual_leads,
      t.move_ins as actual_move_ins,
      t.overall_conversion as conversion_rate,
      t.projected_leads,
      t.projected_move_ins,
      t.lead_to_tour_pct,
      t.tour_to_app_pct,
      t.app_to_lease_pct
    FROM traffic_funnel t
    WHERE t.deal_id = $1
      AND t.period_start >= CURRENT_DATE - ($2 || ' months')::interval
    ORDER BY t.period_start DESC
  `, [dealId, months]);
  
  // Benchmark conversion rates (would come from archive benchmarks)
  const benchmarkConversion = 8.5; // 8.5% lead-to-move-in benchmark
  
  const analysis: TrafficAnalysis[] = [];
  
  for (const row of result.rows as Record<string, unknown>[]) {
    const projectedLeads = Number(row.projected_leads ?? 0);
    const actualLeads = Number(row.actual_leads ?? 0);
    const projectedMoveIns = Number(row.projected_move_ins ?? 0);
    const actualMoveIns = Number(row.actual_move_ins ?? 0);
    const conversionRate = Number(row.conversion_rate ?? 0);
    
    const leadVariancePct = projectedLeads > 0 ? ((actualLeads - projectedLeads) / projectedLeads) * 100 : 0;
    const moveInVariancePct = projectedMoveIns > 0 ? ((actualMoveIns - projectedMoveIns) / projectedMoveIns) * 100 : 0;
    
    const recommendations: string[] = [];
    
    // Lead generation recommendations
    if (leadVariancePct < -20) {
      recommendations.push('🔴 Lead volume significantly below projection - increase marketing spend or diversify lead sources');
    } else if (leadVariancePct < -10) {
      recommendations.push('🟡 Lead volume below target - review ILS performance and ad spend allocation');
    }
    
    // Conversion recommendations
    if (conversionRate < benchmarkConversion - 2) {
      recommendations.push('🔴 Conversion rate below benchmark - audit leasing process and tour quality');
      
      const leadToTour = Number(row.lead_to_tour_pct ?? 0);
      const tourToApp = Number(row.tour_to_app_pct ?? 0);
      const appToLease = Number(row.app_to_lease_pct ?? 0);
      
      if (leadToTour < 30) {
        recommendations.push('  → Lead-to-tour is weak: improve response time and follow-up cadence');
      }
      if (tourToApp < 40) {
        recommendations.push('  → Tour-to-application is weak: focus on tour experience and urgency tactics');
      }
      if (appToLease < 70) {
        recommendations.push('  → Application-to-lease is weak: review screening criteria or pricing');
      }
    }
    
    // Move-in recommendations
    if (moveInVariancePct < -15) {
      recommendations.push('🔴 Move-ins below projection - velocity issue will impact occupancy');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Traffic and conversion performing at or above expectations');
    }
    
    analysis.push({
      period: String(row.period),
      projectedLeads,
      actualLeads,
      leadVariancePct,
      projectedMoveIns,
      actualMoveIns,
      moveInVariancePct,
      conversionRate,
      benchmarkConversion,
      recommendations,
    });
  }
  
  return analysis;
}

// ─── Generate Recommendations ─────────────────────────────────────────

/**
 * Generate comprehensive operations recommendations for a deal
 */
export async function generateOperationsRecommendations(
  dealId: string
): Promise<OperationsRecommendation[]> {
  const recommendations: OperationsRecommendation[] = [];
  
  try {
    // Get current variance analysis
    const varianceResult = await query(`
      SELECT * FROM variance_analysis
      WHERE deal_id = $1
        AND period_start = DATE_TRUNC('month', CURRENT_DATE)
      ORDER BY ABS(variance_pct) DESC
    `, [dealId]);
    
    // Get lease expiration data
    const expirationResult = await query(`
      SELECT * FROM v_expiring_leases_90d WHERE deal_id = $1
    `, [dealId]);
    
    // Get rent roll summary
    const rentRollResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'vacant') as vacant_units,
        COUNT(*) FILTER (WHERE status = 'notice') as notice_units,
        COUNT(*) as total_units,
        AVG(loss_to_lease_pct) as avg_ltl,
        SUM(current_balance) FILTER (WHERE current_balance > 0) as total_delinquent
      FROM rent_roll_units
      WHERE deal_id = $1 AND as_of_date = (SELECT MAX(as_of_date) FROM rent_roll_units WHERE deal_id = $1)
    `, [dealId]);
    
    // Get other income vs projection
    const otherIncomeResult = await query(`
      SELECT 
        o.total_other_income as actual,
        o.projected_other_income as projected,
        o.other_income_per_unit
      FROM other_income_tracking o
      WHERE deal_id = $1
      ORDER BY period_start DESC
      LIMIT 1
    `, [dealId]);
    
    const variances = varianceResult.rows as Record<string, unknown>[];
    const expirations = expirationResult.rows[0] as Record<string, unknown> | undefined;
    const rentRoll = rentRollResult.rows[0] as Record<string, unknown> | undefined;
    const otherIncome = otherIncomeResult.rows[0] as Record<string, unknown> | undefined;
    
    // ─── Pricing Recommendations ───────────────────────────────
    
    const ltlPct = Number(rentRoll?.avg_ltl ?? 0);
    if (ltlPct > 8) {
      recommendations.push({
        category: 'pricing',
        priority: 'high',
        title: 'Significant Loss-to-Lease Opportunity',
        description: `Average loss-to-lease is ${ltlPct.toFixed(1)}%, indicating rents are significantly below market.`,
        rationale: 'Current rents are trailing market rates. Aggressive renewal pricing and new lease pricing adjustments can capture this gap.',
        estimatedMonthlyImpact: ltlPct * 0.5 * (Number(rentRoll?.total_units ?? 0)) * 50, // Rough estimate
        estimatedAnnualImpact: ltlPct * 0.5 * (Number(rentRoll?.total_units ?? 0)) * 50 * 12,
        confidence: 85,
        suggestedActions: [
          { action: 'Increase renewal offers by 4-6% above current rate' },
          { action: 'Raise asking rents on vacant units by 3-5%' },
          { action: 'Review concession strategy - reduce if demand supports' },
        ],
      });
    }
    
    // ─── Occupancy Recommendations ─────────────────────────────
    
    const vacantUnits = Number(rentRoll?.vacant_units ?? 0);
    const noticeUnits = Number(rentRoll?.notice_units ?? 0);
    const totalUnits = Number(rentRoll?.total_units ?? 1);
    const exposurePct = ((vacantUnits + noticeUnits) / totalUnits) * 100;
    
    if (exposurePct > 12) {
      recommendations.push({
        category: 'occupancy',
        priority: 'critical',
        title: 'High Vacancy Exposure',
        description: `Total exposure (vacant + notice) is ${exposurePct.toFixed(1)}% (${vacantUnits} vacant, ${noticeUnits} on notice).`,
        rationale: 'Exposure above 10% puts NOI at risk and may require pricing adjustments to drive traffic.',
        estimatedMonthlyImpact: -(exposurePct - 5) * totalUnits * 50, // Negative = loss
        estimatedAnnualImpact: -(exposurePct - 5) * totalUnits * 50 * 12,
        confidence: 90,
        suggestedActions: [
          { action: 'Increase marketing spend by 20-30%' },
          { action: 'Offer move-in concession to accelerate velocity' },
          { action: 'Review pricing - may need to reduce asking rents temporarily' },
          { action: 'Focus on save strategy for notice units' },
        ],
      });
    }
    
    // ─── Renewal Recommendations ───────────────────────────────
    
    const expiringCount = Number(expirations?.expiring_count ?? 0);
    const pendingRenewals = Number(expirations?.pending_renewals ?? 0);
    const acceptedRenewals = Number(expirations?.accepted_renewals ?? 0);
    
    if (expiringCount > 0 && pendingRenewals > expiringCount * 0.5) {
      recommendations.push({
        category: 'renewal',
        priority: 'high',
        title: 'Pending Renewals Need Attention',
        description: `${pendingRenewals} leases expiring in next 90 days still pending response.`,
        rationale: 'Unanswered renewal offers risk move-outs. Proactive follow-up increases renewal rate.',
        estimatedMonthlyImpact: pendingRenewals * 0.3 * 500, // Assume 30% would accept, save $500 turn cost each
        estimatedAnnualImpact: pendingRenewals * 0.3 * 500,
        confidence: 75,
        suggestedActions: [
          { action: 'Call all pending renewals within 48 hours' },
          { action: 'Offer early renewal incentive (free carpet clean, etc.)' },
          { action: 'Document reasons for any declines to inform future pricing' },
        ],
      });
    }
    
    // ─── Expense Recommendations ───────────────────────────────
    
    const unfavorableExpenses = variances.filter(
      v => v.category === 'opex' && v.variance_type === 'unfavorable' && Number(v.variance_pct) > 10
    );
    
    for (const exp of unfavorableExpenses.slice(0, 2)) {
      recommendations.push({
        category: 'expense',
        priority: Number(exp.variance_pct) > 20 ? 'high' : 'medium',
        title: `${String(exp.line_item).replace(/_/g, ' ')} Over Budget`,
        description: `${String(exp.line_item)} is ${Number(exp.variance_pct).toFixed(1)}% over budget ($${Number(exp.variance_amount).toLocaleString()} variance).`,
        rationale: `Expense trending above projection. If this continues, annual NOI impact is $${(Number(exp.variance_amount) * 12).toLocaleString()}.`,
        estimatedMonthlyImpact: -Number(exp.variance_amount),
        estimatedAnnualImpact: -Number(exp.variance_amount) * 12,
        confidence: 80,
        suggestedActions: [
          { action: `Review ${exp.line_item} invoices for anomalies` },
          { action: 'Compare to prior year same period' },
          { action: 'Get competitive bids if vendor-related' },
        ],
      });
    }
    
    // ─── Collections Recommendations ───────────────────────────
    
    const totalDelinquent = Number(rentRoll?.total_delinquent ?? 0);
    if (totalDelinquent > totalUnits * 50) { // More than $50/unit avg
      recommendations.push({
        category: 'collections',
        priority: 'high',
        title: 'Elevated Delinquency',
        description: `Total delinquent balance is $${totalDelinquent.toLocaleString()}.`,
        rationale: 'High delinquency impacts cash flow and may indicate resident quality issues.',
        estimatedMonthlyImpact: -totalDelinquent * 0.3, // Assume 30% becomes bad debt
        estimatedAnnualImpact: -totalDelinquent * 0.3 * 3, // Recurring issue
        confidence: 70,
        suggestedActions: [
          { action: 'Send demand letters to all 30+ day delinquent' },
          { action: 'Offer payment plans for residents in good standing historically' },
          { action: 'File evictions for chronic non-payers' },
        ],
      });
    }
    
    // ─── Other Income Recommendations ──────────────────────────
    
    const otherIncomeActual = Number(otherIncome?.actual ?? 0);
    const otherIncomeProjected = Number(otherIncome?.projected ?? 0);
    const otherIncomePerUnit = Number(otherIncome?.other_income_per_unit ?? 0);
    
    if (otherIncomePerUnit < 150) { // Below $150/unit is typically low
      recommendations.push({
        category: 'other_income',
        priority: 'medium',
        title: 'Other Income Optimization Opportunity',
        description: `Other income is $${otherIncomePerUnit.toFixed(0)}/unit. Market benchmark is $150-250/unit.`,
        rationale: 'Ancillary income is an underutilized revenue stream with high NOI impact.',
        estimatedMonthlyImpact: (150 - otherIncomePerUnit) * totalUnits * 0.3, // Assume capture 30% of gap
        estimatedAnnualImpact: (150 - otherIncomePerUnit) * totalUnits * 0.3 * 12,
        confidence: 65,
        suggestedActions: [
          { action: 'Implement or increase pet rent ($25-50/mo per pet)' },
          { action: 'Add covered parking premium ($50-100/mo)' },
          { action: 'Introduce trash valet service ($25-35/mo)' },
          { action: 'Review application/admin fee structure' },
        ],
      });
    }
    
    // Save recommendations to database
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      for (const rec of recommendations) {
        await client.query(
          `INSERT INTO operations_recommendations (
            deal_id, category, priority, title, description, rationale,
            estimated_monthly_impact, estimated_annual_impact, confidence_pct,
            suggested_actions
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            dealId, rec.category, rec.priority, rec.title, rec.description, rec.rationale,
            rec.estimatedMonthlyImpact, rec.estimatedAnnualImpact, rec.confidence,
            JSON.stringify(rec.suggestedActions),
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    logger.info('[revenue-management] Generated recommendations', {
      dealId,
      count: recommendations.length,
    });
    
  } catch (err) {
    logger.error('[revenue-management] Failed to generate recommendations', {
      dealId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  
  return recommendations;
}

// ─── Operations Summary ───────────────────────────────────────────────

/**
 * Get comprehensive operations summary for a deal
 */
export async function getOperationsSummary(dealId: string): Promise<{
  varianceSummary: {
    totalNoiVariance: number;
    unfavorableCount: number;
    favorableCount: number;
    topVariances: VarianceItem[];
  };
  leaseExpirations: LeaseExpirationAnalysis[];
  traffic: TrafficAnalysis[];
  recommendations: OperationsRecommendation[];
  healthScore: number;
}> {
  // Get variances
  const varianceResult = await query(`
    SELECT * FROM variance_analysis
    WHERE deal_id = $1 AND period_start = DATE_TRUNC('month', CURRENT_DATE)
    ORDER BY ABS(noi_impact) DESC
  `, [dealId]);
  
  const variances = varianceResult.rows as Record<string, unknown>[];
  const totalNoiVariance = variances.reduce((sum, v) => sum + Number(v.noi_impact ?? 0), 0);
  const unfavorableCount = variances.filter(v => v.variance_type === 'unfavorable').length;
  const favorableCount = variances.filter(v => v.variance_type === 'favorable').length;
  
  // Get lease expirations
  const leaseExpirations = await analyzeLeaseExpirations(dealId, 6);
  
  // Get traffic
  const traffic = await analyzeTrafficPerformance(dealId, 3);
  
  // Get recommendations
  const recsResult = await query(`
    SELECT * FROM operations_recommendations
    WHERE deal_id = $1 AND status = 'pending'
    ORDER BY 
      CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      created_at DESC
  `, [dealId]);
  
  const recommendations = (recsResult.rows as Record<string, unknown>[]).map(r => ({
    category: r.category as OperationsRecommendation['category'],
    priority: r.priority as OperationsRecommendation['priority'],
    title: String(r.title),
    description: String(r.description),
    rationale: String(r.rationale ?? ''),
    estimatedMonthlyImpact: Number(r.estimated_monthly_impact ?? 0),
    estimatedAnnualImpact: Number(r.estimated_annual_impact ?? 0),
    confidence: Number(r.confidence_pct ?? 0),
    suggestedActions: (r.suggested_actions as { action: string }[]) ?? [],
  }));
  
  // Compute health score (0-100)
  let healthScore = 100;
  
  // Deduct for unfavorable variances
  healthScore -= unfavorableCount * 3;
  
  // Deduct for critical/high recommendations
  const criticalCount = recommendations.filter(r => r.priority === 'critical').length;
  const highCount = recommendations.filter(r => r.priority === 'high').length;
  healthScore -= criticalCount * 10;
  healthScore -= highCount * 5;
  
  // Deduct for negative NOI variance
  if (totalNoiVariance < 0) {
    healthScore -= Math.min(20, Math.abs(totalNoiVariance) / 1000);
  }
  
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  return {
    varianceSummary: {
      totalNoiVariance,
      unfavorableCount,
      favorableCount,
      topVariances: variances.slice(0, 5).map(v => ({
        lineItem: String(v.line_item),
        category: String(v.category),
        projected: Number(v.projected_value ?? 0),
        actual: Number(v.actual_value ?? 0),
        varianceAmount: Number(v.variance_amount ?? 0),
        variancePct: Number(v.variance_pct ?? 0),
        varianceType: v.variance_type as 'favorable' | 'unfavorable' | 'neutral',
        severity: v.severity as 'minor' | 'moderate' | 'major',
        trend: (v.trend_direction ?? 'stable') as 'improving' | 'stable' | 'worsening',
        consecutiveMonths: Number(v.consecutive_months ?? 1),
        noiImpact: Number(v.noi_impact ?? 0),
      })),
    },
    leaseExpirations,
    traffic,
    recommendations,
    healthScore,
  };
}

// ─── Feed to Learning System ──────────────────────────────────────────

/**
 * Feed operations data back to the learning system
 * This closes the loop between underwriting and operations
 */
export async function feedOperationsToLearning(dealId: string): Promise<void> {
  try {
    // Get the acquisition snapshot
    const snapshotResult = await query(
      `SELECT id, assumptions FROM assumption_snapshots
       WHERE deal_id = $1 AND snapshot_type = 'acquisition'
       ORDER BY snapshot_date DESC LIMIT 1`,
      [dealId]
    );
    
    if (snapshotResult.rows.length === 0) return;
    
    // Get TTM actuals
    const actualsResult = await query(`
      SELECT 
        AVG(net_operating_income) as avg_noi,
        AVG(physical_occupancy_pct) as avg_occupancy,
        AVG(total_operating_expenses) as avg_opex
      FROM operations_actuals
      WHERE deal_id = $1
        AND period_start >= CURRENT_DATE - INTERVAL '12 months'
    `, [dealId]);
    
    if (!actualsResult.rows[0]) return;
    
    const actuals = actualsResult.rows[0] as Record<string, number>;
    
    // Record actual performance for learning system
    await query(
      `INSERT INTO actual_performance (
        deal_id, period_type, period_start, period_end,
        actual_noi, actual_vacancy_pct, actual_opex_per_unit, source
      ) VALUES ($1, 'annual', CURRENT_DATE - INTERVAL '12 months', CURRENT_DATE, $2, $3, $4, 'operations_summary')
      ON CONFLICT (deal_id, period_type, period_start) DO UPDATE SET
        actual_noi = EXCLUDED.actual_noi,
        actual_vacancy_pct = EXCLUDED.actual_vacancy_pct,
        imported_at = NOW()`,
      [
        dealId,
        actuals.avg_noi * 12,
        100 - (actuals.avg_occupancy ?? 95),
        actuals.avg_opex,
      ]
    );
    
    logger.info('[revenue-management] Fed operations data to learning system', { dealId });
    
  } catch (err) {
    logger.error('[revenue-management] Failed to feed learning system', {
      dealId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
