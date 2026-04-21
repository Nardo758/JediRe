/**
 * Learning Feedback Service
 * 
 * Closes the feedback loop: compares what the agent assumed vs what actually
 * happened, computes systematic biases, and generates adjustment factors
 * that the agent applies to future underwriting.
 * 
 * The learning cycle:
 * 1. At acquisition: save assumption snapshot
 * 2. During ownership: import actual performance (monthly/quarterly)
 * 3. Periodically: compare assumed vs actual, compute outcomes
 * 4. When enough outcomes exist: compute learning adjustments
 * 5. Agent queries adjustments during underwriting and applies them
 */

import { query, getClient } from '../database/connection';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────

export interface AssumptionSnapshot {
  dealId: string;
  snapshotType: 'acquisition' | 'reforecast_q1' | 'reforecast_annual';
  assumptions: Record<string, {
    value: number;
    source: string;
    confidence: 'high' | 'medium' | 'low';
    benchmarkPercentile?: number;
  }>;
  lineItems?: Record<string, {
    value: number;
    pctEgi?: number;
    benchmarkPercentile?: number;
  }>;
  projectedNoiYear1?: number;
  projectedNoiYear3?: number;
  projectedIrr?: number;
  agentVersion?: string;
  modelUsed?: string;
  confidenceScore?: number;
}

export interface ActualPerformance {
  dealId: string;
  periodType: 'monthly' | 'quarterly' | 'annual';
  periodStart: Date;
  periodEnd: Date;
  actualNoi?: number;
  actualVacancyPct?: number;
  actualRentPerUnit?: number;
  actualOpexPerUnit?: number;
  lineItemActuals?: Record<string, number>;
  source?: string;
}

export interface LearningAdjustment {
  assumptionName: string;
  state?: string;
  msa?: string;
  assetClass?: string;
  dealType?: string;
  adjustmentType: 'additive_bps' | 'multiplicative' | 'percentile_shift';
  adjustmentValue: number;
  adjustmentDirection: 'increase' | 'decrease';
  nDeals: number;
  meanGapPct: number;
  confidence: number;
}

// ─── Snapshot Management ──────────────────────────────────────────────

/**
 * Save an assumption snapshot when a deal is underwritten
 */
export async function saveAssumptionSnapshot(
  snapshot: AssumptionSnapshot,
  dealContext: {
    propertyName?: string;
    state?: string;
    msa?: string;
    submarket?: string;
    assetClass?: string;
    dealType?: string;
    vintageBand?: string;
    unitCount?: number;
  }
): Promise<string> {
  const result = await query(
    `INSERT INTO assumption_snapshots (
      deal_id, snapshot_type, snapshot_date,
      property_name, state, msa, submarket, asset_class, deal_type, vintage_band, unit_count,
      assumptions,
      projected_noi_year1, projected_noi_year3, projected_noi_year5, projected_irr,
      agent_version, model_used, confidence_score
    ) VALUES (
      $1, $2, CURRENT_DATE,
      $3, $4, $5, $6, $7, $8, $9, $10,
      $11,
      $12, $13, $14, $15,
      $16, $17, $18
    )
    ON CONFLICT (deal_id, snapshot_type, snapshot_date) 
    DO UPDATE SET
      assumptions = EXCLUDED.assumptions,
      projected_noi_year1 = EXCLUDED.projected_noi_year1,
      projected_noi_year3 = EXCLUDED.projected_noi_year3,
      agent_version = EXCLUDED.agent_version,
      confidence_score = EXCLUDED.confidence_score
    RETURNING id`,
    [
      snapshot.dealId,
      snapshot.snapshotType,
      dealContext.propertyName,
      dealContext.state,
      dealContext.msa,
      dealContext.submarket,
      dealContext.assetClass,
      dealContext.dealType,
      dealContext.vintageBand,
      dealContext.unitCount,
      JSON.stringify({ 
        ...snapshot.assumptions, 
        line_items: snapshot.lineItems 
      }),
      snapshot.projectedNoiYear1,
      snapshot.projectedNoiYear3,
      null, // year5
      snapshot.projectedIrr,
      snapshot.agentVersion,
      snapshot.modelUsed,
      snapshot.confidenceScore,
    ]
  );

  logger.info('[learning-feedback] Saved assumption snapshot', {
    dealId: snapshot.dealId,
    snapshotType: snapshot.snapshotType,
    snapshotId: result.rows[0]?.id,
  });

  return result.rows[0]?.id;
}

/**
 * Record actual performance data (called when importing from PMS or manually)
 */
export async function recordActualPerformance(data: ActualPerformance): Promise<string> {
  const result = await query(
    `INSERT INTO actual_performance (
      deal_id, period_type, period_start, period_end,
      actual_noi, actual_vacancy_pct, actual_rent_per_unit, actual_opex_per_unit,
      line_item_actuals, source, imported_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
    )
    ON CONFLICT (deal_id, period_type, period_start)
    DO UPDATE SET
      actual_noi = EXCLUDED.actual_noi,
      actual_vacancy_pct = EXCLUDED.actual_vacancy_pct,
      actual_rent_per_unit = EXCLUDED.actual_rent_per_unit,
      actual_opex_per_unit = EXCLUDED.actual_opex_per_unit,
      line_item_actuals = EXCLUDED.line_item_actuals,
      imported_at = NOW()
    RETURNING id`,
    [
      data.dealId,
      data.periodType,
      data.periodStart,
      data.periodEnd,
      data.actualNoi,
      data.actualVacancyPct,
      data.actualRentPerUnit,
      data.actualOpexPerUnit,
      data.lineItemActuals ? JSON.stringify(data.lineItemActuals) : null,
      data.source ?? 'manual',
    ]
  );

  logger.info('[learning-feedback] Recorded actual performance', {
    dealId: data.dealId,
    periodType: data.periodType,
    periodStart: data.periodStart,
  });

  return result.rows[0]?.id;
}

// ─── Outcome Computation ──────────────────────────────────────────────

/**
 * Compute assumption outcomes for a deal (compare assumed vs actual)
 * Call this after 12+ months of actual data is available
 */
export async function computeAssumptionOutcomes(dealId: string): Promise<{
  outcomesComputed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let outcomesComputed = 0;

  try {
    // Get the acquisition snapshot
    const snapshotResult = await query(
      `SELECT id, assumptions, state, msa, asset_class, deal_type, vintage_band
       FROM assumption_snapshots
       WHERE deal_id = $1 AND snapshot_type = 'acquisition'
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [dealId]
    );

    if (snapshotResult.rows.length === 0) {
      errors.push('No acquisition snapshot found');
      return { outcomesComputed, errors };
    }

    const snapshot = snapshotResult.rows[0] as Record<string, unknown>;
    const snapshotId = snapshot.id as string;
    const assumptions = snapshot.assumptions as Record<string, { value: number; source?: string; confidence?: string }>;

    // Get TTM actual performance
    const actualsResult = await query(
      `SELECT 
        AVG(actual_noi) as avg_noi,
        AVG(actual_vacancy_pct) as avg_vacancy,
        AVG(actual_rent_per_unit) as avg_rent,
        AVG(actual_opex_per_unit) as avg_opex,
        COUNT(*) as n_periods
       FROM actual_performance
       WHERE deal_id = $1
         AND period_type = 'monthly'
         AND period_start >= NOW() - INTERVAL '12 months'`,
      [dealId]
    );

    if (!actualsResult.rows[0] || Number(actualsResult.rows[0].n_periods) < 6) {
      errors.push('Insufficient actual data (need at least 6 months)');
      return { outcomesComputed, errors };
    }

    const actuals = actualsResult.rows[0] as Record<string, number | null>;

    // Map of assumption names to actual values
    const actualMappings: Record<string, { actual: number | null; period: string }> = {
      vacancy_pct: { actual: actuals.avg_vacancy, period: 'ttm' },
      opex_per_unit: { actual: actuals.avg_opex, period: 'ttm' },
      rent_per_unit: { actual: actuals.avg_rent, period: 'ttm' },
    };

    // Compute NOI if we have monthly data
    if (actuals.avg_noi != null) {
      actualMappings['noi_year1'] = { actual: actuals.avg_noi * 12, period: 'year1' };
    }

    // Insert outcomes
    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (const [assumptionName, assumed] of Object.entries(assumptions)) {
        if (assumptionName === 'line_items') continue; // Handle separately
        
        const mapping = actualMappings[assumptionName];
        if (!mapping || mapping.actual == null || assumed?.value == null) continue;

        await client.query(
          `INSERT INTO assumption_outcomes (
            deal_id, snapshot_id, assumption_name,
            assumed_value, assumed_source, assumed_confidence,
            actual_value, actual_period, actual_source,
            state, msa, asset_class, deal_type, vintage_band
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (snapshot_id, assumption_name, actual_period) DO UPDATE SET
            actual_value = EXCLUDED.actual_value,
            computed_at = NOW()`,
          [
            dealId, snapshotId, assumptionName,
            assumed.value, assumed.source ?? 'unknown', assumed.confidence ?? 'medium',
            mapping.actual, mapping.period, 'actual_performance',
            snapshot.state, snapshot.msa, snapshot.asset_class, 
            snapshot.deal_type, snapshot.vintage_band,
          ]
        );
        outcomesComputed++;
      }

      // Handle line items
      const lineItems = (assumptions as Record<string, unknown>).line_items as Record<string, { value: number }> | undefined;
      if (lineItems) {
        const lineActualsResult = await query(
          `SELECT line_item_actuals
           FROM actual_performance
           WHERE deal_id = $1
             AND period_type = 'monthly'
             AND line_item_actuals IS NOT NULL
           ORDER BY period_start DESC
           LIMIT 12`,
          [dealId]
        );

        // Average line items over available periods
        const lineItemTotals: Record<string, number[]> = {};
        for (const row of lineActualsResult.rows as { line_item_actuals: Record<string, number> }[]) {
          for (const [name, value] of Object.entries(row.line_item_actuals)) {
            if (!lineItemTotals[name]) lineItemTotals[name] = [];
            lineItemTotals[name].push(value);
          }
        }

        for (const [lineItem, assumed] of Object.entries(lineItems)) {
          const actualValues = lineItemTotals[lineItem];
          if (!actualValues || actualValues.length === 0) continue;
          
          const actualAvg = actualValues.reduce((a, b) => a + b, 0) / actualValues.length;

          await client.query(
            `INSERT INTO assumption_outcomes (
              deal_id, snapshot_id, assumption_name,
              assumed_value, assumed_source, assumed_confidence,
              actual_value, actual_period, actual_source,
              state, msa, asset_class, deal_type, vintage_band
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (snapshot_id, assumption_name, actual_period) DO UPDATE SET
              actual_value = EXCLUDED.actual_value,
              computed_at = NOW()`,
            [
              dealId, snapshotId, `line_item.${lineItem}`,
              assumed.value, 'benchmark', 'medium',
              actualAvg, 'ttm', 'actual_performance',
              snapshot.state, snapshot.msa, snapshot.asset_class,
              snapshot.deal_type, snapshot.vintage_band,
            ]
          );
          outcomesComputed++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info('[learning-feedback] Computed outcomes', { dealId, outcomesComputed });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    logger.error('[learning-feedback] Outcome computation failed', { dealId, error: msg });
  }

  return { outcomesComputed, errors };
}

// ─── Learning Adjustment Computation ──────────────────────────────────

/**
 * Compute learning adjustments from accumulated outcomes
 * Run this periodically (weekly/monthly) to update adjustment factors
 */
export async function computeLearningAdjustments(): Promise<{
  adjustmentsComputed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let adjustmentsComputed = 0;
  const effectiveDate = new Date().toISOString().slice(0, 10);

  try {
    logger.info('[learning-feedback] Computing learning adjustments...');

    // Find systematic biases by bucket
    const biasResult = await query(`
      SELECT 
        assumption_name,
        state, msa, asset_class, deal_type, vintage_band,
        COUNT(*) as n_deals,
        AVG(gap_pct) as mean_gap_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_pct) as median_gap_pct,
        STDDEV(gap_pct) as stddev_gap_pct,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gap_pct) as p25_gap,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gap_pct) as p75_gap
      FROM assumption_outcomes
      WHERE computed_at > NOW() - INTERVAL '2 years'
      GROUP BY assumption_name, state, msa, asset_class, deal_type, vintage_band
      HAVING COUNT(*) >= 5
    `);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (const row of biasResult.rows as Record<string, unknown>[]) {
        const meanGap = Number(row.mean_gap_pct);
        const medianGap = Number(row.median_gap_pct);
        const stddev = Number(row.stddev_gap_pct);
        const nDeals = Number(row.n_deals);

        // Only create adjustment if there's a significant systematic bias
        // (mean gap > 5% and consistent direction)
        if (Math.abs(meanGap) < 5 || stddev > Math.abs(meanGap) * 2) {
          continue; // Too noisy or not significant
        }

        // Determine adjustment
        // If we systematically underestimate (actual > assumed), we need to increase
        // If we systematically overestimate (actual < assumed), we need to decrease
        const direction = meanGap > 0 ? 'increase' : 'decrease';
        
        // Conservative adjustment: apply 50% of the bias
        const adjustmentValue = Math.abs(medianGap) * 0.5;

        // Calculate confidence based on sample size and consistency
        const confidence = Math.min(1, nDeals / 20) * (1 - stddev / (Math.abs(meanGap) + 10));

        await client.query(
          `INSERT INTO learning_adjustments (
            state, msa, asset_class, deal_type, vintage_band,
            assumption_name, adjustment_type, adjustment_value, adjustment_direction,
            n_deals, mean_gap_pct, median_gap_pct, stddev_gap_pct,
            confidence_interval_low, confidence_interval_high,
            effective_date, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
          ON CONFLICT (state, msa, asset_class, deal_type, vintage_band, assumption_name, effective_date)
          DO UPDATE SET
            adjustment_value = EXCLUDED.adjustment_value,
            adjustment_direction = EXCLUDED.adjustment_direction,
            n_deals = EXCLUDED.n_deals,
            mean_gap_pct = EXCLUDED.mean_gap_pct,
            computed_at = NOW()`,
          [
            row.state, row.msa, row.asset_class, row.deal_type, row.vintage_band,
            row.assumption_name, 'multiplicative', adjustmentValue / 100, direction,
            nDeals, meanGap, medianGap, stddev,
            row.p25_gap, row.p75_gap,
            effectiveDate,
          ]
        );
        adjustmentsComputed++;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    logger.info('[learning-feedback] Computed adjustments', { adjustmentsComputed });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    logger.error('[learning-feedback] Adjustment computation failed', { error: msg });
  }

  return { adjustmentsComputed, errors };
}

// ─── Adjustment Query (for agent use) ─────────────────────────────────

/**
 * Get active learning adjustments for a specific context
 * The agent calls this to apply corrections to its assumptions
 */
export async function getLearningAdjustments(context: {
  state?: string;
  msa?: string;
  assetClass?: string;
  dealType?: string;
  assumptionNames?: string[];
}): Promise<LearningAdjustment[]> {
  const params: unknown[] = [];
  const conditions: string[] = [
    'is_active = true',
    "(expires_at IS NULL OR expires_at > CURRENT_DATE)",
    "n_deals >= min_deals_required",
  ];

  if (context.state) {
    params.push(context.state);
    conditions.push(`(state = $${params.length} OR state IS NULL)`);
  }
  if (context.msa) {
    params.push(context.msa);
    conditions.push(`(msa = $${params.length} OR msa IS NULL)`);
  }
  if (context.assetClass) {
    params.push(context.assetClass);
    conditions.push(`(asset_class = $${params.length} OR asset_class IS NULL)`);
  }
  if (context.dealType) {
    params.push(context.dealType);
    conditions.push(`(deal_type = $${params.length} OR deal_type IS NULL)`);
  }
  if (context.assumptionNames?.length) {
    params.push(context.assumptionNames);
    conditions.push(`assumption_name = ANY($${params.length})`);
  }

  const result = await query(
    `SELECT 
      assumption_name,
      state, msa, asset_class, deal_type,
      adjustment_type, adjustment_value, adjustment_direction,
      n_deals, mean_gap_pct,
      (1.0 - COALESCE(stddev_gap_pct, 50) / 100.0) * LEAST(n_deals::float / 20, 1) as confidence
     FROM learning_adjustments
     WHERE ${conditions.join(' AND ')}
     ORDER BY 
       CASE WHEN state IS NOT NULL THEN 1 ELSE 2 END,
       CASE WHEN msa IS NOT NULL THEN 1 ELSE 2 END,
       n_deals DESC`,
    params
  );

  return (result.rows as Record<string, unknown>[]).map(row => ({
    assumptionName: String(row.assumption_name),
    state: row.state as string | undefined,
    msa: row.msa as string | undefined,
    assetClass: row.asset_class as string | undefined,
    dealType: row.deal_type as string | undefined,
    adjustmentType: row.adjustment_type as 'additive_bps' | 'multiplicative' | 'percentile_shift',
    adjustmentValue: Number(row.adjustment_value),
    adjustmentDirection: row.adjustment_direction as 'increase' | 'decrease',
    nDeals: Number(row.n_deals),
    meanGapPct: Number(row.mean_gap_pct),
    confidence: Number(row.confidence),
  }));
}

/**
 * Apply a learning adjustment to a value
 */
export function applyLearningAdjustment(
  value: number,
  adjustment: LearningAdjustment
): { adjustedValue: number; adjustmentNote: string } {
  let adjustedValue = value;
  let adjustmentNote = '';

  if (adjustment.adjustmentType === 'multiplicative') {
    const multiplier = adjustment.adjustmentDirection === 'increase'
      ? 1 + adjustment.adjustmentValue
      : 1 - adjustment.adjustmentValue;
    adjustedValue = value * multiplier;
    const pctChange = (adjustment.adjustmentValue * 100).toFixed(1);
    adjustmentNote = `Learning adjustment: ${adjustment.adjustmentDirection} by ${pctChange}% based on ${adjustment.nDeals} prior deals (${adjustment.assumptionName} was systematically ${adjustment.adjustmentDirection === 'increase' ? 'underestimated' : 'overestimated'})`;
  } else if (adjustment.adjustmentType === 'additive_bps') {
    const bpsChange = adjustment.adjustmentDirection === 'increase'
      ? adjustment.adjustmentValue
      : -adjustment.adjustmentValue;
    adjustedValue = value + bpsChange / 100;
    adjustmentNote = `Learning adjustment: ${bpsChange > 0 ? '+' : ''}${bpsChange}bps based on ${adjustment.nDeals} prior deals`;
  }

  return { adjustedValue, adjustmentNote };
}

// ─── Performance Tracking ─────────────────────────────────────────────

/**
 * Compute model performance metrics
 */
export async function computeModelPerformanceMetrics(): Promise<void> {
  const periodStart = new Date();
  periodStart.setFullYear(periodStart.getFullYear() - 1);
  const periodEnd = new Date();

  const result = await query(`
    SELECT 
      assumption_name,
      COUNT(*) as n_predictions,
      AVG(ABS(gap_pct)) as mean_absolute_error,
      SQRT(AVG(gap_pct * gap_pct)) as rmse,
      AVG(gap_pct) as mean_bias,
      SUM(CASE WHEN ABS(gap_pct) <= 10 THEN 1 ELSE 0 END)::float / COUNT(*) as hit_rate_10pct,
      SUM(CASE WHEN ABS(gap_pct) <= 20 THEN 1 ELSE 0 END)::float / COUNT(*) as hit_rate_20pct
    FROM assumption_outcomes
    WHERE computed_at BETWEEN $1 AND $2
    GROUP BY assumption_name
    HAVING COUNT(*) >= 5
  `, [periodStart.toISOString(), periodEnd.toISOString()]);

  for (const row of result.rows as Record<string, unknown>[]) {
    await query(
      `INSERT INTO model_performance_metrics (
        period_start, period_end, assumption_name,
        n_predictions, mean_absolute_error, root_mean_sq_error,
        mean_bias, hit_rate_10pct, hit_rate_20pct
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (period_start, period_end, agent_version, assumption_name)
      DO UPDATE SET
        n_predictions = EXCLUDED.n_predictions,
        mean_absolute_error = EXCLUDED.mean_absolute_error,
        computed_at = NOW()`,
      [
        periodStart.toISOString().slice(0, 10),
        periodEnd.toISOString().slice(0, 10),
        row.assumption_name,
        row.n_predictions,
        row.mean_absolute_error,
        row.rmse,
        row.mean_bias,
        row.hit_rate_10pct,
        row.hit_rate_20pct,
      ]
    );
  }

  logger.info('[learning-feedback] Updated model performance metrics');
}

/**
 * Get current model accuracy summary
 */
export async function getModelAccuracySummary(): Promise<{
  overallHitRate10Pct: number;
  overallHitRate20Pct: number;
  meanBias: number;
  topBiasedAssumptions: { name: string; bias: number; direction: string }[];
  totalOutcomes: number;
}> {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      AVG(CASE WHEN ABS(gap_pct) <= 10 THEN 1.0 ELSE 0.0 END) as hit_10,
      AVG(CASE WHEN ABS(gap_pct) <= 20 THEN 1.0 ELSE 0.0 END) as hit_20,
      AVG(gap_pct) as mean_bias
    FROM assumption_outcomes
    WHERE computed_at > NOW() - INTERVAL '1 year'
  `);

  const biasResult = await query(`
    SELECT 
      assumption_name,
      AVG(gap_pct) as mean_bias,
      CASE WHEN AVG(gap_pct) > 0 THEN 'underestimate' ELSE 'overestimate' END as direction
    FROM assumption_outcomes
    WHERE computed_at > NOW() - INTERVAL '1 year'
    GROUP BY assumption_name
    HAVING COUNT(*) >= 5
    ORDER BY ABS(AVG(gap_pct)) DESC
    LIMIT 5
  `);

  const row = result.rows[0] as Record<string, number>;
  return {
    overallHitRate10Pct: Number(row?.hit_10 ?? 0) * 100,
    overallHitRate20Pct: Number(row?.hit_20 ?? 0) * 100,
    meanBias: Number(row?.mean_bias ?? 0),
    totalOutcomes: Number(row?.total ?? 0),
    topBiasedAssumptions: (biasResult.rows as { assumption_name: string; mean_bias: number; direction: string }[]).map(r => ({
      name: r.assumption_name,
      bias: r.mean_bias,
      direction: r.direction,
    })),
  };
}
