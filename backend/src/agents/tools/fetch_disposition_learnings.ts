/**
 * fetch_disposition_learnings Tool
 * 
 * Retrieves exit performance data from sold deals.
 * The ultimate learning signal: how did our projections compare to reality?
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export const fetchDispositionLearningsSchema = z.object({
  state: z.string().optional().describe('Filter by state code (e.g., TX, GA)'),
  msa: z.string().optional().describe('Filter by MSA name'),
  asset_class: z.enum(['A', 'B', 'C']).optional().describe('Filter by asset class'),
  deal_type: z.enum(['acquisition', 'development', 'value_add']).optional(),
  min_hold_period_months: z.number().optional().describe('Minimum hold period'),
  max_hold_period_months: z.number().optional().describe('Maximum hold period'),
  vintage_year_min: z.number().optional().describe('Earliest acquisition year'),
  vintage_year_max: z.number().optional().describe('Latest acquisition year'),
  limit: z.number().default(50).describe('Max results to return'),
});

export type FetchDispositionLearningsInput = z.infer<typeof fetchDispositionLearningsSchema>;

export interface DispositionLearningsResult {
  filters: FetchDispositionLearningsInput;
  sampleSize: number;
  
  // Aggregate performance
  aggregateStats: {
    avgIrrVarianceBps: number;
    medianIrrVarianceBps: number;
    avgExitCapVarianceBps: number;
    avgHoldPeriodMonths: number;
    outperformedPct: number;
    metExpectationsPct: number;
    underperformedPct: number;
  };
  
  // Distribution of outcomes
  irrVarianceDistribution: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  
  // Key drivers of variance
  varianceDrivers: {
    driver: string;
    avgImpactBps: number;
    frequency: number; // How often this driver appeared
  }[];
  
  // Individual deal learnings (most instructive cases)
  dealLearnings: {
    dealId: string;
    dealName: string;
    state: string;
    msa: string;
    assetClass: string;
    acquisitionDate: string;
    dispositionDate: string;
    holdPeriodMonths: number;
    projectedIrr: number;
    actualIrr: number;
    irrVarianceBps: number;
    projectedExitCap: number;
    actualExitCap: number;
    exitCapVarianceBps: number;
    performance: 'outperformed' | 'met' | 'underperformed';
    lessonsLearned: string;
    keyDrivers: string[];
  }[];
  
  // Actionable insights
  insights: string[];
}

/**
 * Fetch disposition learnings for calibration
 */
export async function fetchDispositionLearnings(
  input: FetchDispositionLearningsInput
): Promise<DispositionLearningsResult> {
  logger.info('[fetch_disposition_learnings] Fetching exit learnings', input);

  // Build WHERE clause
  const conditions: string[] = ['dis.closing_date IS NOT NULL'];
  const params: unknown[] = [];

  if (input.state) {
    params.push(input.state);
    conditions.push(`s.state = $${params.length}`);
  }
  if (input.msa) {
    params.push(input.msa);
    conditions.push(`s.msa = $${params.length}`);
  }
  if (input.asset_class) {
    params.push(input.asset_class);
    conditions.push(`s.asset_class = $${params.length}`);
  }
  if (input.deal_type) {
    params.push(input.deal_type);
    conditions.push(`s.deal_type = $${params.length}`);
  }
  if (input.min_hold_period_months) {
    params.push(input.min_hold_period_months);
    conditions.push(`dis.hold_period_months >= $${params.length}`);
  }
  if (input.max_hold_period_months) {
    params.push(input.max_hold_period_months);
    conditions.push(`dis.hold_period_months <= $${params.length}`);
  }
  if (input.vintage_year_min) {
    params.push(input.vintage_year_min);
    conditions.push(`EXTRACT(YEAR FROM s.snapshot_date) >= $${params.length}`);
  }
  if (input.vintage_year_max) {
    params.push(input.vintage_year_max);
    conditions.push(`EXTRACT(YEAR FROM s.snapshot_date) <= $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  // Main query for deal-level learnings
  const limitParam = params.length + 1;
  params.push(input.limit);

  const mainQuery = `
    SELECT 
      d.id as deal_id,
      d.name as deal_name,
      s.state,
      s.msa,
      s.asset_class,
      s.snapshot_date as acquisition_date,
      dis.closing_date as disposition_date,
      dis.hold_period_months,
      dis.projected_irr,
      dis.actual_irr,
      dis.irr_variance_bps,
      dis.projected_exit_cap,
      dis.actual_exit_cap,
      dis.exit_cap_variance_bps,
      dis.lessons_learned,
      CASE 
        WHEN dis.irr_variance_bps >= 0 THEN 'outperformed'
        WHEN dis.irr_variance_bps >= -200 THEN 'met'
        ELSE 'underperformed'
      END as performance
    FROM deals d
    JOIN dispositions dis ON dis.deal_id = d.id
    LEFT JOIN assumption_snapshots s ON s.deal_id = d.id AND s.snapshot_type = 'acquisition'
    WHERE ${whereClause}
    ORDER BY dis.closing_date DESC
    LIMIT $${limitParam}
  `;

  const mainResult = await query(mainQuery, params);

  // Aggregate stats query
  const aggQuery = `
    SELECT 
      COUNT(*) as sample_size,
      AVG(dis.irr_variance_bps) as avg_irr_var,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dis.irr_variance_bps) as median_irr_var,
      AVG(dis.exit_cap_variance_bps) as avg_cap_var,
      AVG(dis.hold_period_months) as avg_hold,
      SUM(CASE WHEN dis.irr_variance_bps >= 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as outperformed_pct,
      SUM(CASE WHEN dis.irr_variance_bps < 0 AND dis.irr_variance_bps >= -200 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as met_pct,
      SUM(CASE WHEN dis.irr_variance_bps < -200 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as under_pct,
      PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY dis.irr_variance_bps) as p10,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY dis.irr_variance_bps) as p25,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dis.irr_variance_bps) as p50,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dis.irr_variance_bps) as p75,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY dis.irr_variance_bps) as p90
    FROM deals d
    JOIN dispositions dis ON dis.deal_id = d.id
    LEFT JOIN assumption_snapshots s ON s.deal_id = d.id AND s.snapshot_type = 'acquisition'
    WHERE ${whereClause.replace(/\$\d+/g, (match) => {
      // Re-number parameters for aggregate query (same params but different positions)
      const num = parseInt(match.slice(1));
      return num <= params.length - 1 ? match : `$${num}`;
    })}
  `;

  const aggParams = params.slice(0, -1); // Remove limit param
  const aggResult = await query(aggQuery, aggParams);
  const agg = aggResult.rows[0] as Record<string, number>;

  // Get variance drivers from assumption_outcomes
  const driversQuery = `
    SELECT 
      ao.assumption_name as driver,
      AVG((ao.actual_value - ao.assumed_value) / NULLIF(ao.assumed_value, 0) * 100) as avg_impact,
      COUNT(*) as frequency
    FROM assumption_outcomes ao
    JOIN dispositions dis ON dis.deal_id = ao.deal_id
    LEFT JOIN assumption_snapshots s ON s.deal_id = ao.deal_id AND s.snapshot_type = 'acquisition'
    WHERE ${whereClause.replace(/\$\d+/g, (match) => {
      const num = parseInt(match.slice(1));
      return num <= params.length - 1 ? match : `$${num}`;
    })}
      AND ao.actual_period = 'exit'
    GROUP BY ao.assumption_name
    HAVING COUNT(*) >= 3
    ORDER BY ABS(AVG((ao.actual_value - ao.assumed_value) / NULLIF(ao.assumed_value, 0))) DESC
    LIMIT 10
  `;

  const driversResult = await query(driversQuery, aggParams);

  // Build deal learnings
  const dealLearnings = (mainResult.rows as Record<string, unknown>[]).map(row => ({
    dealId: String(row.deal_id),
    dealName: String(row.deal_name),
    state: String(row.state ?? ''),
    msa: String(row.msa ?? ''),
    assetClass: String(row.asset_class ?? ''),
    acquisitionDate: row.acquisition_date 
      ? new Date(row.acquisition_date as string).toISOString().split('T')[0]
      : '',
    dispositionDate: row.disposition_date
      ? new Date(row.disposition_date as string).toISOString().split('T')[0]
      : '',
    holdPeriodMonths: Number(row.hold_period_months ?? 0),
    projectedIrr: Number(row.projected_irr ?? 0),
    actualIrr: Number(row.actual_irr ?? 0),
    irrVarianceBps: Number(row.irr_variance_bps ?? 0),
    projectedExitCap: Number(row.projected_exit_cap ?? 0),
    actualExitCap: Number(row.actual_exit_cap ?? 0),
    exitCapVarianceBps: Number(row.exit_cap_variance_bps ?? 0),
    performance: row.performance as 'outperformed' | 'met' | 'underperformed',
    lessonsLearned: String(row.lessons_learned ?? ''),
    keyDrivers: [], // Would come from reforecasts.change_drivers
  }));

  // Variance drivers
  const varianceDrivers = (driversResult.rows as Record<string, unknown>[]).map(row => ({
    driver: String(row.driver),
    avgImpactBps: Math.round(Number(row.avg_impact ?? 0) * 100),
    frequency: Number(row.frequency),
  }));

  // Generate insights
  const insights: string[] = [];
  
  if (agg.sample_size > 0) {
    if (agg.avg_irr_var > 50) {
      insights.push(`Deals in this segment have historically outperformed projections by ${Math.round(agg.avg_irr_var)}bps on average.`);
    } else if (agg.avg_irr_var < -50) {
      insights.push(`Deals in this segment have historically underperformed projections by ${Math.abs(Math.round(agg.avg_irr_var))}bps on average. Consider more conservative assumptions.`);
    }
    
    if (agg.outperformed_pct > 60) {
      insights.push(`${Math.round(agg.outperformed_pct)}% of similar deals outperformed - you may be underwriting conservatively.`);
    } else if (agg.under_pct > 40) {
      insights.push(`${Math.round(agg.under_pct)}% of similar deals underperformed - consider stress testing your assumptions.`);
    }

    const avgHold = Math.round(agg.avg_hold);
    insights.push(`Average hold period for this segment: ${avgHold} months (${(avgHold / 12).toFixed(1)} years).`);
  }

  // Add driver-specific insights
  for (const driver of varianceDrivers.slice(0, 3)) {
    if (Math.abs(driver.avgImpactBps) > 100) {
      const direction = driver.avgImpactBps > 0 ? 'overestimated' : 'underestimated';
      insights.push(`${driver.driver.replace(/_/g, ' ')} has been historically ${direction} by ~${Math.abs(driver.avgImpactBps)}bps.`);
    }
  }

  const result: DispositionLearningsResult = {
    filters: input,
    sampleSize: Number(agg.sample_size ?? 0),
    aggregateStats: {
      avgIrrVarianceBps: Number(agg.avg_irr_var ?? 0),
      medianIrrVarianceBps: Number(agg.median_irr_var ?? 0),
      avgExitCapVarianceBps: Number(agg.avg_cap_var ?? 0),
      avgHoldPeriodMonths: Number(agg.avg_hold ?? 0),
      outperformedPct: Number(agg.outperformed_pct ?? 0),
      metExpectationsPct: Number(agg.met_pct ?? 0),
      underperformedPct: Number(agg.under_pct ?? 0),
    },
    irrVarianceDistribution: {
      p10: Number(agg.p10 ?? 0),
      p25: Number(agg.p25 ?? 0),
      p50: Number(agg.p50 ?? 0),
      p75: Number(agg.p75 ?? 0),
      p90: Number(agg.p90 ?? 0),
    },
    varianceDrivers,
    dealLearnings,
    insights,
  };

  logger.info('[fetch_disposition_learnings] Fetched learnings', {
    sampleSize: result.sampleSize,
    avgIrrVarianceBps: result.aggregateStats.avgIrrVarianceBps,
  });

  return result;
}

/**
 * Tool definition for agent registration
 */
export const fetchDispositionLearningsTool = {
  name: 'fetch_disposition_learnings',
  description: `Retrieve exit performance data from sold deals.
This is the ultimate learning signal: how did our projections compare to reality?

Returns:
- Aggregate stats (avg IRR variance, % outperformed, etc.)
- IRR variance distribution (P10-P90)
- Key variance drivers (which assumptions were most wrong)
- Individual deal learnings with lessons

Use to calibrate underwriting assumptions based on actual exits in similar markets/asset classes.`,
  schema: fetchDispositionLearningsSchema,
  execute: fetchDispositionLearnings,
};
