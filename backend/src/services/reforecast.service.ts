/**
 * Reforecast Service
 * 
 * Automatically updates projections when actuals diverge significantly.
 * Shows real-time comparison of original projections vs current trajectory.
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export interface ReforecastResult {
  dealId: string;
  reforecastDate: Date;
  reforecastType: string;
  
  // NOI changes
  originalNoiYear1: number;
  reforecastNoiYear1: number;
  noiYear1DeltaPct: number;
  
  originalNoiStabilized: number;
  reforecastNoiStabilized: number;
  
  // Returns
  originalIrr: number;
  reforecastIrr: number;
  irrDeltaBps: number;
  
  originalEm: number;
  reforecastEm: number;
  
  // Key drivers
  changeDrivers: { driver: string; impactBps: number; direction: 'positive' | 'negative' }[];
}

export interface ProjectedVsActual {
  period: string;
  metric: string;
  projected: number;
  actual: number | null;
  reforecast: number | null;
  variancePct: number | null;
  source: 'projection' | 'actual' | 'reforecast';
}

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Compute a reforecast based on YTD actuals
 */
export async function computeReforecast(
  dealId: string,
  triggerReason: string = 'manual'
): Promise<ReforecastResult | null> {
  try {
    // Get original acquisition assumptions
    const snapshotResult = await query(
      `SELECT 
        id,
        assumptions,
        projected_noi_year1,
        projected_noi_year3,
        projected_irr
       FROM assumption_snapshots
       WHERE deal_id = $1 AND snapshot_type = 'acquisition'
       ORDER BY snapshot_date DESC LIMIT 1`,
      [dealId]
    );
    
    if (snapshotResult.rows.length === 0) {
      logger.warn('[reforecast] No acquisition snapshot found', { dealId });
      return null;
    }
    
    const snapshot = snapshotResult.rows[0] as Record<string, unknown>;
    const originalAssumptions = snapshot.assumptions as Record<string, { value: number }>;
    
    // Get YTD actuals
    const actualsResult = await query(`
      SELECT 
        AVG(net_operating_income) as avg_monthly_noi,
        AVG(physical_occupancy_pct) as avg_occupancy,
        AVG(effective_gross_income) as avg_egi,
        AVG(total_operating_expenses) as avg_opex,
        COUNT(*) as months_of_data
      FROM operations_actuals
      WHERE deal_id = $1
        AND period_start >= DATE_TRUNC('year', CURRENT_DATE)
    `, [dealId]);
    
    const actuals = actualsResult.rows[0] as Record<string, number>;
    const monthsOfData = Number(actuals.months_of_data ?? 0);
    
    if (monthsOfData < 3) {
      logger.info('[reforecast] Insufficient data for reforecast', { dealId, monthsOfData });
      return null;
    }
    
    // Original projections
    const originalNoiYear1 = Number(snapshot.projected_noi_year1 ?? 0);
    const originalIrr = Number(originalAssumptions?.irr?.value ?? snapshot.projected_irr ?? 0);
    const originalEm = Number(originalAssumptions?.equity_multiple?.value ?? 2.0);
    const originalNoiStabilized = Number(snapshot.projected_noi_year3 ?? originalNoiYear1 * 1.1);
    
    // Calculate reforecast values
    const avgMonthlyNoi = Number(actuals.avg_monthly_noi ?? 0);
    const annualizedNoi = avgMonthlyNoi * 12;
    
    // Apply trend to project forward
    const actualVsProjectedRatio = originalNoiYear1 > 0 ? annualizedNoi / originalNoiYear1 : 1;
    
    // Reforecast Year 1 NOI (blend actual run-rate with original projection)
    const ytdActualWeight = monthsOfData / 12;
    const reforecastNoiYear1 = (annualizedNoi * ytdActualWeight) + (originalNoiYear1 * (1 - ytdActualWeight));
    
    // Reforecast stabilized NOI (apply variance ratio to original)
    const reforecastNoiStabilized = originalNoiStabilized * actualVsProjectedRatio;
    
    // Estimate IRR impact (rough approximation)
    // Every 10% change in exit value moves IRR by ~200-300bps
    const noiVariancePct = ((reforecastNoiYear1 - originalNoiYear1) / originalNoiYear1) * 100;
    const estimatedIrrImpact = noiVariancePct * 0.25; // Rough multiplier
    const reforecastIrr = originalIrr + estimatedIrrImpact;
    
    // Estimate equity multiple impact
    const emImpactMultiplier = 1 + (noiVariancePct / 100) * 0.5;
    const reforecastEm = originalEm * emImpactMultiplier;
    
    // Identify change drivers
    const changeDrivers: { driver: string; impactBps: number; direction: 'positive' | 'negative' }[] = [];
    
    // Compare actual occupancy to projected
    const actualOccupancy = Number(actuals.avg_occupancy ?? 0);
    const projectedOccupancy = 100 - Number(originalAssumptions?.vacancy_pct?.value ?? 5);
    const occupancyDelta = actualOccupancy - projectedOccupancy;
    if (Math.abs(occupancyDelta) > 1) {
      changeDrivers.push({
        driver: 'occupancy',
        impactBps: Math.round(occupancyDelta * 15), // ~15bps IRR per 1% occupancy
        direction: occupancyDelta > 0 ? 'positive' : 'negative',
      });
    }
    
    // Compare OpEx
    const actualOpex = Number(actuals.avg_opex ?? 0) * 12;
    const projectedOpex = originalNoiYear1 * 0.45; // Rough estimate
    const opexVariancePct = projectedOpex > 0 ? ((actualOpex - projectedOpex) / projectedOpex) * 100 : 0;
    if (Math.abs(opexVariancePct) > 5) {
      changeDrivers.push({
        driver: 'operating_expenses',
        impactBps: Math.round(-opexVariancePct * 5), // Negative because higher opex = lower returns
        direction: opexVariancePct < 0 ? 'positive' : 'negative',
      });
    }
    
    // Save reforecast
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      await client.query(
        `INSERT INTO reforecasts (
          deal_id, reforecast_date, reforecast_type, trigger_reason,
          original_snapshot_id,
          original_noi_year1, reforecast_noi_year1,
          original_noi_stabilized, reforecast_noi_stabilized,
          original_irr, reforecast_irr,
          original_em, reforecast_em,
          change_drivers, status
        ) VALUES (
          $1, CURRENT_DATE, $2, $3,
          $4,
          $5, $6,
          $7, $8,
          $9, $10,
          $11, $12,
          $13, 'draft'
        )`,
        [
          dealId, monthsOfData >= 6 ? 'quarterly' : 'triggered', triggerReason,
          snapshot.id,
          originalNoiYear1, reforecastNoiYear1,
          originalNoiStabilized, reforecastNoiStabilized,
          originalIrr, reforecastIrr,
          originalEm, reforecastEm,
          JSON.stringify(changeDrivers),
        ]
      );
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    logger.info('[reforecast] Computed reforecast', {
      dealId,
      originalIrr,
      reforecastIrr,
      irrDeltaBps: (reforecastIrr - originalIrr) * 100,
    });
    
    return {
      dealId,
      reforecastDate: new Date(),
      reforecastType: triggerReason,
      originalNoiYear1,
      reforecastNoiYear1,
      noiYear1DeltaPct: ((reforecastNoiYear1 - originalNoiYear1) / originalNoiYear1) * 100,
      originalNoiStabilized,
      reforecastNoiStabilized,
      originalIrr,
      reforecastIrr,
      irrDeltaBps: (reforecastIrr - originalIrr) * 100,
      originalEm,
      reforecastEm,
      changeDrivers,
    };
    
  } catch (err) {
    logger.error('[reforecast] Computation failed', {
      dealId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Get projected vs actual time series for a metric
 */
export async function getProjectedVsActual(
  dealId: string,
  metric: string = 'noi'
): Promise<ProjectedVsActual[]> {
  // Get projections
  const projResult = await query(`
    SELECT 
      TO_CHAR(period_start, 'YYYY-MM') as period,
      net_operating_income as noi,
      effective_gross_income as egi,
      total_operating_expenses as opex,
      projected_occupancy_pct as occupancy
    FROM proforma_projections
    WHERE deal_id = $1
    ORDER BY period_start
  `, [dealId]);
  
  // Get actuals
  const actResult = await query(`
    SELECT 
      TO_CHAR(period_start, 'YYYY-MM') as period,
      net_operating_income as noi,
      effective_gross_income as egi,
      total_operating_expenses as opex,
      physical_occupancy_pct as occupancy
    FROM operations_actuals
    WHERE deal_id = $1
    ORDER BY period_start
  `, [dealId]);
  
  // Get latest reforecast
  const reforecastResult = await query(`
    SELECT reforecast_assumptions
    FROM reforecasts
    WHERE deal_id = $1 AND status IN ('draft', 'approved')
    ORDER BY reforecast_date DESC
    LIMIT 1
  `, [dealId]);
  
  // Build combined timeline
  const projections = new Map<string, Record<string, number>>();
  const actuals = new Map<string, Record<string, number>>();
  
  for (const row of projResult.rows as Record<string, unknown>[]) {
    projections.set(String(row.period), {
      noi: Number(row.noi ?? 0),
      egi: Number(row.egi ?? 0),
      opex: Number(row.opex ?? 0),
      occupancy: Number(row.occupancy ?? 0),
    });
  }
  
  for (const row of actResult.rows as Record<string, unknown>[]) {
    actuals.set(String(row.period), {
      noi: Number(row.noi ?? 0),
      egi: Number(row.egi ?? 0),
      opex: Number(row.opex ?? 0),
      occupancy: Number(row.occupancy ?? 0),
    });
  }
  
  // Combine all periods
  const allPeriods = new Set([...projections.keys(), ...actuals.keys()]);
  const sortedPeriods = Array.from(allPeriods).sort();
  
  const result: ProjectedVsActual[] = [];
  
  for (const period of sortedPeriods) {
    const proj = projections.get(period);
    const act = actuals.get(period);
    
    const projectedValue = proj ? proj[metric] : null;
    const actualValue = act ? act[metric] : null;
    
    let variancePct: number | null = null;
    if (projectedValue && actualValue) {
      variancePct = ((actualValue - projectedValue) / projectedValue) * 100;
    }
    
    result.push({
      period,
      metric,
      projected: projectedValue ?? 0,
      actual: actualValue,
      reforecast: null, // Would come from reforecast assumptions
      variancePct,
      source: actualValue != null ? 'actual' : 'projection',
    });
  }
  
  return result;
}

/**
 * Check if a deal needs reforecast based on variance thresholds
 */
export async function checkReforecastTriggers(dealId: string): Promise<{
  shouldReforecast: boolean;
  triggers: string[];
}> {
  const triggers: string[] = [];
  
  // Get recent variances
  const varianceResult = await query(`
    SELECT line_item, variance_pct, consecutive_months
    FROM variance_analysis
    WHERE deal_id = $1
      AND period_start >= CURRENT_DATE - INTERVAL '3 months'
      AND ABS(variance_pct) > 10
    ORDER BY ABS(variance_pct) DESC
  `, [dealId]);
  
  for (const row of varianceResult.rows as Record<string, unknown>[]) {
    const lineItem = String(row.line_item);
    const variancePct = Number(row.variance_pct);
    const consecutiveMonths = Number(row.consecutive_months ?? 1);
    
    // Trigger if >15% variance for 2+ months
    if (Math.abs(variancePct) > 15 && consecutiveMonths >= 2) {
      triggers.push(`${lineItem}: ${variancePct.toFixed(1)}% variance for ${consecutiveMonths} consecutive months`);
    }
  }
  
  // Check NOI specifically
  const noiResult = await query(`
    SELECT 
      AVG(ABS(variance_pct)) as avg_noi_variance
    FROM variance_analysis
    WHERE deal_id = $1
      AND line_item = 'net_operating_income'
      AND period_start >= CURRENT_DATE - INTERVAL '6 months'
  `, [dealId]);
  
  const avgNoiVariance = Number((noiResult.rows[0] as Record<string, number>)?.avg_noi_variance ?? 0);
  if (avgNoiVariance > 10) {
    triggers.push(`NOI averaging ${avgNoiVariance.toFixed(1)}% variance over last 6 months`);
  }
  
  return {
    shouldReforecast: triggers.length > 0,
    triggers,
  };
}

/**
 * Get reforecast history for a deal
 */
export async function getReforecastHistory(dealId: string): Promise<{
  id: string;
  reforecastDate: Date;
  reforecastType: string;
  originalIrr: number;
  reforecastIrr: number;
  irrDeltaBps: number;
  status: string;
  changeDrivers: { driver: string; impactBps: number }[];
}[]> {
  const result = await query(`
    SELECT 
      id, reforecast_date, reforecast_type,
      original_irr, reforecast_irr, irr_delta_bps,
      status, change_drivers
    FROM reforecasts
    WHERE deal_id = $1
    ORDER BY reforecast_date DESC
  `, [dealId]);
  
  return (result.rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    reforecastDate: new Date(row.reforecast_date as string),
    reforecastType: String(row.reforecast_type),
    originalIrr: Number(row.original_irr),
    reforecastIrr: Number(row.reforecast_irr),
    irrDeltaBps: Number(row.irr_delta_bps),
    status: String(row.status),
    changeDrivers: (row.change_drivers as { driver: string; impactBps: number }[]) ?? [],
  }));
}
