import { Pool } from 'pg';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { translateMetricId, OUTCOME_METRICS_DB } from '../utils/metricTranslation';

export interface CorrelationResult {
  id: string;
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;
  signal: string | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}

export interface CorrelationReport {
  market: string;
  state: string;
  computedAt: string;
  snapshotDate: string | null;
  metricsComputed: number;
  metricsSkipped: number;
  correlations: CorrelationResult[];
  summary: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    insufficientData: number;
    rentRunway: string | null;
    affordabilityCeiling: string | null;
    supplyPressure: string | null;
    topOpportunity: string | null;
  };
}

export interface MetricCorrelation {
  id: number;
  metric_a: string;
  metric_b: string;
  geography_type: string;
  geography_id: string;
  window_months: number;
  correlation_r: number;
  lead_lag_months: number | null;
  p_value: number | null;
  sample_size: number;
  computed_at: string;
}

interface MarketSnapshot {
  total_properties: number | null;
  total_units: number | null;
  avg_occupancy: number | null;
  rent_growth_90d: number | null;
  rent_growth_180d: number | null;
  concession_rate: number | null;
  avg_concession_value: number | null;
  avg_days_to_lease: number | null;
  monthly_absorption_rate: number | null;
  supply_pressure: string | null;
  snapshot_date: string;
}

interface TrendObservation {
  date: string;
  avg_rent: number;
  total_supply: number;
  vacancy_rate: number;
  available_units: number;
  listings_active: number;
  seasonal_factor: number;
  application_volume: number;
  avg_days_on_market: number;
  avg_opportunity_score: number;
  search_activity_index: number;
  concessions_prevalence: number;
  negotiation_success_rate: number;
}

interface SubmarketData {
  name: string;
  avg_rent: number;
  total_units: number;
  vacancy_rate: number;
  market_pressure: string;
  rent_growth_30d: number;
  properties_count: number;
  avg_opportunity_score: number;
  negotiation_success_rate: number;
}

interface MSAData {
  population: number | null;
  median_household_income: number | null;
  avg_rent: number | null;
  avg_occupancy: number | null;
}

export interface MetricRecommendation {
  rank: number;
  metricId: string;
  metricLabel: string;
  columnId: string | null;
  score: number;
  reason: string;
  correlationR: number;
  leadLagMonths: number;
  pairedMetric: string;
  pairedMetricLabel: string;
  geographyId: string;
  geoCount: number;
  trendDirection: string;
  trendMagnitude: number;
}

export class CorrelationEngineService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async computeCorrelations(city: string = 'Atlanta', state: string = 'GA'): Promise<CorrelationReport> {
    const snapshot = await this.getLatestSnapshot(city, state);
    const trends = await this.getTrendObservations(city);
    const submarkets = await this.getSubmarketData(city);
    const msa = await this.getMSAData(city);

    const correlations: CorrelationResult[] = [];

    correlations.push(this.computeCOR01(snapshot, trends));
    correlations.push(this.computeCOR02(trends));
    correlations.push(this.computeCOR03(trends));
    correlations.push(this.computeCOR04(msa, snapshot));
    correlations.push(this.computeCOR05(snapshot, trends));
    correlations.push(this.computeCOR06(snapshot));
    correlations.push(this.computeCOR07(snapshot));
    correlations.push(this.computeCOR08());
    correlations.push(this.computeCOR09(snapshot, trends));
    correlations.push(this.computeCOR10());
    correlations.push(this.computeCOR11());
    correlations.push(this.computeCOR12());
    correlations.push(this.computeCOR13(msa, snapshot, trends));
    correlations.push(this.computeCOR14(submarkets));
    correlations.push(this.computeCOR15(trends));
    correlations.push(this.computeCOR16(trends));
    correlations.push(this.computeCOR17());
    correlations.push(this.computeCOR18());
    correlations.push(this.computeCOR19());
    correlations.push(this.computeCOR20());

    const computed = correlations.filter(c => c.confidence !== 'insufficient');
    const skipped = correlations.filter(c => c.confidence === 'insufficient');

    const bullish = computed.filter(c => c.signal === 'bullish').length;
    const bearish = computed.filter(c => c.signal === 'bearish').length;
    const neutral = computed.filter(c => c.signal === 'neutral').length;

    const cor04 = correlations.find(c => c.id === 'COR-04');
    const cor13 = correlations.find(c => c.id === 'COR-13');
    const cor06 = correlations.find(c => c.id === 'COR-06');

    return {
      market: city,
      state,
      computedAt: new Date().toISOString(),
      snapshotDate: snapshot?.snapshot_date || null,
      metricsComputed: computed.length,
      metricsSkipped: skipped.length,
      correlations,
      summary: {
        bullishSignals: bullish,
        bearishSignals: bearish,
        neutralSignals: neutral,
        insufficientData: skipped.length,
        rentRunway: cor04?.actionable || null,
        affordabilityCeiling: cor13?.actionable || null,
        supplyPressure: cor06?.actionable || null,
        topOpportunity: this.identifyTopOpportunity(correlations),
      },
    };
  }

  async computeForProperty(propertyId: string, city: string = 'Atlanta', state: string = 'GA'): Promise<CorrelationReport> {
    return this.computeCorrelations(city, state);
  }

  async computeTimeSeriesCorrelations(geographyType: string, geographyId: string, windowMonths: number = 36): Promise<void> {
    try {
      // Step 1: Get all metrics with sufficient data for this geography
      const metricsRes = await this.pool.query(
        `SELECT DISTINCT metric_id, COUNT(*) as points
         FROM metric_time_series
         WHERE geography_type = $1 AND geography_id = $2
         GROUP BY metric_id
         HAVING COUNT(*) >= 12`,
        [geographyType, geographyId]
      );

      const metrics = metricsRes.rows.map((r: any) => r.metric_id);
      logger.info(`Found ${metrics.length} metrics with sufficient data for ${geographyType}:${geographyId}`);

      if (metrics.length < 2) {
        logger.warn(`Insufficient metrics (${metrics.length}) to compute correlations`);
        return;
      }

      // Step 2: For each pair of metrics, compute correlations
      let correlationCount = 0;
      for (let i = 0; i < metrics.length; i++) {
        for (let j = i + 1; j < metrics.length; j++) {
          const metricA = metrics[i];
          const metricB = metrics[j];

          const correlation = await this.computePairCorrelation(
            metricA,
            metricB,
            geographyType,
            geographyId,
            windowMonths
          );

          if (correlation) {
            correlationCount++;
          }
        }
      }

      // Get geography name for logging
      const geoRes = await this.pool.query(
        `SELECT geography_name FROM metric_time_series
         WHERE geography_type = $1 AND geography_id = $2
         LIMIT 1`,
        [geographyType, geographyId]
      );
      const geoName = geoRes.rows[0]?.geography_name || geographyId;

      logger.info(`Computed ${correlationCount} correlations for ${geoName}`);
    } catch (error) {
      logger.error(`Error in computeTimeSeriesCorrelations: ${String(error)}`);
      throw error;
    }
  }

  private async computePairCorrelation(
    rawMetricA: string,
    rawMetricB: string,
    geographyType: string,
    geographyId: string,
    windowMonths: number
  ): Promise<boolean> {
    const [metricA, metricB] = [rawMetricA, rawMetricB].sort();
    try {
      const windowClause = windowMonths > 0
        ? `AND ts_a.period_date >= (NOW() - INTERVAL '${windowMonths} months')`
        : '';
      const dataRes = await this.pool.query(
        `WITH ts_a AS (
           SELECT period_date, value as val_a
           FROM metric_time_series
           WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
           ORDER BY period_date
         ),
         ts_b AS (
           SELECT period_date, value as val_b
           FROM metric_time_series
           WHERE metric_id = $4 AND geography_type = $2 AND geography_id = $3
           ORDER BY period_date
         )
         SELECT ts_a.period_date, ts_a.val_a, ts_b.val_b
         FROM ts_a
         FULL OUTER JOIN ts_b ON ts_a.period_date = ts_b.period_date
         WHERE ts_a.val_a IS NOT NULL AND ts_b.val_b IS NOT NULL
         ${windowClause}
         ORDER BY ts_a.period_date`,
        [metricA, geographyType, geographyId, metricB]
      );

      const data = dataRes.rows;
      if (data.length < 12) {
        return false;
      }

      const correlation = this.computePearsonCorrelation(
        data.map((d: any) => d.val_a),
        data.map((d: any) => d.val_b)
      );

      const lagResults = this.computeLagCorrelations(
        data.map((d: any) => d.val_a),
        data.map((d: any) => d.val_b)
      );

      const n = data.length;
      const pValue = this.computePValue(correlation.r, n);

      const obsStart = data[0]?.period_date || null;
      const obsEnd = data[data.length - 1]?.period_date || null;

      await this.pool.query(
        `DELETE FROM metric_correlations
         WHERE metric_a = $1 AND metric_b = $2 AND geography_type = $3 AND geography_id = $4 AND window_months = $5`,
        [metricA, metricB, geographyType, geographyId, windowMonths]
      );
      await this.pool.query(
        `INSERT INTO metric_correlations
         (metric_a, metric_b, geography_type, geography_id, window_months, correlation_r, lead_lag_months, p_value, sample_size, observation_start, observation_end, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [metricA, metricB, geographyType, geographyId, windowMonths, correlation.r, lagResults.bestLag, pValue, n, obsStart, obsEnd]
      );

      return true;
    } catch (error) {
      logger.error(`Error computing pair correlation ${metricA}-${metricB}: ${String(error)}`);
      return false;
    }
  }

  private computePearsonCorrelation(x: number[], y: number[]): { r: number } {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
    const denominatorX = Math.sqrt(x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0));
    const denominatorY = Math.sqrt(y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0));

    if (denominatorX === 0 || denominatorY === 0) {
      return { r: 0 };
    }

    return { r: numerator / (denominatorX * denominatorY) };
  }

  private computeLagCorrelations(x: number[], y: number[]): { bestLag: number } {
    let bestLag = 0;
    let bestAbsR = 0;

    for (let lag = -12; lag <= 12; lag++) {
      const shiftedX: number[] = [];
      const alignedY: number[] = [];

      if (lag < 0) {
        // Shift x forward (negative lag = x leads)
        for (let i = 0; i < x.length + lag; i++) {
          shiftedX.push(x[i - lag]);
          alignedY.push(y[i]);
        }
      } else if (lag > 0) {
        // Shift x backward (positive lag = y leads)
        for (let i = lag; i < x.length; i++) {
          shiftedX.push(x[i]);
          alignedY.push(y[i - lag]);
        }
      } else {
        shiftedX.push(...x);
        alignedY.push(...y);
      }

      if (shiftedX.length >= 12) {
        const corr = this.computePearsonCorrelation(shiftedX, alignedY);
        const absR = Math.abs(corr.r);
        if (absR > bestAbsR) {
          bestAbsR = absR;
          bestLag = lag;
        }
      }
    }

    return { bestLag };
  }

  private computePValue(r: number, n: number): number {
    if (Math.abs(r) >= 1 || n < 3) {
      return 0;
    }
    // t = r * sqrt(n-2) / sqrt(1 - r^2)
    const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
    // For two-tailed test, approximate p-value
    // Using normal approximation for simplicity
    const absT = Math.abs(t);
    const p = 2 * (1 - this.normalCDF(absT));
    return Math.max(0, Math.min(1, p));
  }

  private normalCDF(z: number): number {
    // Standard normal cumulative distribution function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  async getCorrelations(geographyType: string, geographyId: string): Promise<MetricCorrelation[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, metric_a, metric_b, geography_type, geography_id, window_months,
                correlation_r, lead_lag_months, p_value, sample_size, computed_at
         FROM metric_correlations
         WHERE geography_type = $1 AND geography_id = $2
         ORDER BY ABS(correlation_r) DESC`,
        [geographyType, geographyId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error retrieving correlations: ${String(error)}`);
      return [];
    }
  }

  async getTopCorrelations(
    geographyType: string,
    geographyId: string,
    targetMetric?: string,
    limit: number = 10,
    minAbsR: number = 0.5
  ): Promise<MetricCorrelation[]> {
    try {
      let query: string;
      let params: (string | number)[];

      if (targetMetric) {
        query = `SELECT id, metric_a, metric_b, geography_type, geography_id, window_months,
                        correlation_r, lead_lag_months, p_value, sample_size, computed_at
                 FROM metric_correlations
                 WHERE geography_type = $1 AND geography_id = $2
                   AND (metric_a = $3 OR metric_b = $3)
                   AND ABS(correlation_r) >= $4
                 ORDER BY ABS(correlation_r) DESC
                 LIMIT $5`;
        params = [geographyType, geographyId, targetMetric, minAbsR, limit];
      } else {
        query = `SELECT id, metric_a, metric_b, geography_type, geography_id, window_months,
                        correlation_r, lead_lag_months, p_value, sample_size, computed_at
                 FROM metric_correlations
                 WHERE geography_type = $1 AND geography_id = $2
                   AND ABS(correlation_r) >= $3
                 ORDER BY ABS(correlation_r) DESC
                 LIMIT $4`;
        params = [geographyType, geographyId, minAbsR, limit];
      }

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error retrieving top correlations: ${String(error)}`);
      return [];
    }
  }

  async getBatchCorrelations(
    queries: Array<{ geographyType: string; geographyId: string }>,
    topN: number = 100,
    minAbsR: number = 0
  ): Promise<Record<string, MetricCorrelation[]>> {
    if (queries.length === 0) return {};

    try {
      const geoTypes = queries.map(q => q.geographyType);
      const geoIds = queries.map(q => q.geographyId);

      const result = await this.pool.query(
        `SELECT id, metric_a, metric_b, geography_type, geography_id, window_months,
                correlation_r, lead_lag_months, p_value, sample_size, computed_at
         FROM metric_correlations
         WHERE (geography_type, geography_id) IN (
           SELECT unnest($1::text[]), unnest($2::text[])
         )
         AND ABS(correlation_r) >= $3
         ORDER BY geography_type, geography_id, ABS(correlation_r) DESC`,
        [geoTypes, geoIds, minAbsR]
      );

      const results: Record<string, MetricCorrelation[]> = {};
      const counts: Record<string, number> = {};
      for (const q of queries) {
        const key = `${q.geographyType}:${q.geographyId}`;
        results[key] = [];
        counts[key] = 0;
      }
      for (const row of result.rows) {
        const key = `${row.geography_type}:${row.geography_id}`;
        if (results[key] && counts[key] < topN) {
          results[key].push(row);
          counts[key]++;
        }
      }
      return results;
    } catch (error) {
      logger.error(`Error in batch correlations: ${String(error)}`);
      const results: Record<string, MetricCorrelation[]> = {};
      for (const q of queries) {
        results[`${q.geographyType}:${q.geographyId}`] = [];
      }
      return results;
    }
  }

  async getFreshness(): Promise<Array<{
    geography_type: string;
    geography_id: string;
    correlation_count: number;
    oldest_computed_at: string;
    newest_computed_at: string;
    avg_abs_r: number;
    stale: boolean;
  }>> {
    try {
      const result = await this.pool.query(
        `SELECT geography_type, geography_id,
                COUNT(*)::int as correlation_count,
                MIN(computed_at) as oldest_computed_at,
                MAX(computed_at) as newest_computed_at,
                ROUND(AVG(ABS(correlation_r))::numeric, 4) as avg_abs_r
         FROM metric_correlations
         GROUP BY geography_type, geography_id
         ORDER BY MAX(computed_at) ASC`
      );

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return result.rows.map((row: Record<string, unknown>) => ({
        geography_type: row.geography_type as string,
        geography_id: row.geography_id as string,
        correlation_count: row.correlation_count as number,
        oldest_computed_at: String(row.oldest_computed_at),
        newest_computed_at: String(row.newest_computed_at),
        avg_abs_r: parseFloat(String(row.avg_abs_r)),
        stale: new Date(String(row.newest_computed_at)) < sevenDaysAgo,
      }));
    } catch (error) {
      logger.error(`Error retrieving freshness: ${String(error)}`);
      return [];
    }
  }

  async sweepAllGeographies(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    try {
      const geoRes = await this.pool.query(
        `SELECT DISTINCT geography_type, geography_id
         FROM metric_time_series
         ORDER BY geography_type, geography_id`
      );

      logger.info(`[CorrelationSweep] Starting sweep across ${geoRes.rows.length} geographies`);

      for (const row of geoRes.rows) {
        const geoType = row.geography_type as string;
        const geoId = row.geography_id as string;
        try {
          await this.computeTimeSeriesCorrelations(geoType, geoId);
          processed++;
        } catch (err) {
          logger.error(`[CorrelationSweep] Failed for ${geoType}:${geoId}: ${String(err)}`);
          failed++;
        }
      }

      logger.info(`[CorrelationSweep] Complete: ${processed} processed, ${failed} failed`);
      return { processed, failed };
    } catch (error) {
      logger.error(`[CorrelationSweep] Fatal error: ${String(error)}`);
      throw error;
    }
  }

  async computeMatrix(
    metricIds: string[],
    scope: string,
    geographyId?: string,
    windowMonths: number = 36
  ): Promise<{ computed: number; skipped: number; matrix: Array<{ metricA: string; metricB: string; r: number; pValue: number; sampleSize: number }> }> {
    const matrix: Array<{ metricA: string; metricB: string; r: number; pValue: number; sampleSize: number }> = [];
    let computed = 0;
    let skipped = 0;

    if (metricIds.length < 2) {
      return { computed: 0, skipped: 0, matrix: [] };
    }

    if (geographyId) {
      for (let i = 0; i < metricIds.length; i++) {
        for (let j = i + 1; j < metricIds.length; j++) {
          const success = await this.computePairCorrelation(metricIds[i], metricIds[j], scope, geographyId, windowMonths);
          if (success) computed++;
          else skipped++;
        }
      }
      const cached = await this.getCorrelationMatrix(metricIds, scope, geographyId);
      return { computed, skipped, matrix: cached };
    }

    const geoRes = await this.pool.query(
      `SELECT DISTINCT geography_id FROM metric_time_series WHERE geography_type = $1 ORDER BY geography_id`,
      [scope]
    );

    for (const row of geoRes.rows) {
      const geoId = row.geography_id as string;
      for (let i = 0; i < metricIds.length; i++) {
        for (let j = i + 1; j < metricIds.length; j++) {
          const success = await this.computePairCorrelation(metricIds[i], metricIds[j], scope, geoId, windowMonths);
          if (success) computed++;
          else skipped++;
        }
      }
    }

    for (let i = 0; i < metricIds.length; i++) {
      for (let j = i + 1; j < metricIds.length; j++) {
        const [mA, mB] = [metricIds[i], metricIds[j]].sort();
        const aggRes = await this.pool.query(
          `SELECT ROUND(AVG(correlation_r)::numeric, 4) as avg_r,
                  ROUND(AVG(p_value)::numeric, 6) as avg_p,
                  SUM(sample_size)::int as total_samples,
                  ROUND(AVG(lead_lag_months))::int as avg_lag,
                  MIN(observation_start) as obs_start,
                  MAX(observation_end) as obs_end,
                  COUNT(*) as geo_count
           FROM metric_correlations
           WHERE metric_a = $1 AND metric_b = $2 AND geography_type = $3
             AND geography_id IS NOT NULL AND window_months = $4`,
          [mA, mB, scope, windowMonths]
        );
        const agg = aggRes.rows[0];
        if (agg && parseInt(agg.geo_count) > 0) {
          await this.pool.query(
            `DELETE FROM metric_correlations
             WHERE metric_a = $1 AND metric_b = $2 AND geography_type = $3 AND geography_id IS NULL AND window_months = $4`,
            [mA, mB, scope, windowMonths]
          );
          await this.pool.query(
            `INSERT INTO metric_correlations
             (metric_a, metric_b, geography_type, geography_id, window_months, correlation_r, lead_lag_months, p_value, sample_size, observation_start, observation_end, computed_at)
             VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            [mA, mB, scope, windowMonths, parseFloat(agg.avg_r), parseInt(agg.avg_lag) || 0, parseFloat(agg.avg_p), parseInt(agg.total_samples), agg.obs_start, agg.obs_end]
          );
        }
      }
    }

    const aggregated = await this.getCorrelationMatrix(metricIds, scope);
    return { computed, skipped, matrix: aggregated };
  }

  async getCorrelationMatrix(
    metricIds: string[],
    scope: string,
    geographyId?: string
  ): Promise<Array<{ metricA: string; metricB: string; r: number; pValue: number; sampleSize: number; leadLagMonths: number | null; observationStart: string | null; observationEnd: string | null }>> {
    try {
      let query: string;
      let params: any[];

      if (geographyId) {
        query = `SELECT metric_a, metric_b, correlation_r, p_value, sample_size, lead_lag_months,
                        observation_start, observation_end
                 FROM metric_correlations
                 WHERE geography_type = $1 AND geography_id = $2
                   AND ((metric_a = ANY($3) AND metric_b = ANY($3)))
                 ORDER BY ABS(correlation_r) DESC`;
        params = [scope, geographyId, metricIds];
      } else {
        query = `SELECT metric_a, metric_b, correlation_r, p_value, sample_size, lead_lag_months,
                        observation_start, observation_end
                 FROM metric_correlations
                 WHERE geography_type = $1 AND geography_id IS NULL
                   AND ((metric_a = ANY($2) AND metric_b = ANY($2)))
                 ORDER BY ABS(correlation_r) DESC`;
        params = [scope, metricIds];
      }

      const result = await this.pool.query(query, params);
      return result.rows.map((row: any) => ({
        metricA: row.metric_a,
        metricB: row.metric_b,
        r: parseFloat(row.correlation_r) || 0,
        pValue: parseFloat(row.p_value) || 0,
        sampleSize: parseInt(row.sample_size) || 0,
        leadLagMonths: row.lead_lag_months != null ? parseInt(row.lead_lag_months) : null,
        observationStart: row.observation_start ? String(row.observation_start) : null,
        observationEnd: row.observation_end ? String(row.observation_end) : null,
      }));
    } catch (error) {
      logger.error(`Error retrieving correlation matrix: ${String(error)}`);
      return [];
    }
  }

  async getStrategyCorrelations(strategyId: string): Promise<{
    strategyName: string;
    conditionMetrics: string[];
    outcomeMetrics: string[];
    pairwise: Array<{ metricA: string; metricB: string; r: number; pValue: number; sampleSize: number; leadLagMonths: number | null; observationStart: string | null; observationEnd: string | null; type: 'condition-condition' | 'condition-outcome' }>;
    redundant: Array<{ metricA: string; metricB: string; r: number }>;
    complementary: Array<{ metricA: string; metricB: string; r: number }>;
  }> {
    const OUTCOME_METRICS = OUTCOME_METRICS_DB;

    const stratRes = await this.pool.query(
      `SELECT name, conditions, scope FROM strategy_definitions WHERE id = $1`,
      [strategyId]
    );

    if (stratRes.rows.length === 0) {
      throw new Error('Strategy not found');
    }

    const strategy = stratRes.rows[0];
    const conditions = typeof strategy.conditions === 'string' ? JSON.parse(strategy.conditions) : (strategy.conditions || []);
    const scope = strategy.scope || 'submarket';

    const conditionMetricIds = [...new Set(conditions.map((c: any) => {
      const raw = c.metricId || c.metric_id || '';
      return translateMetricId(raw);
    }))];

    const allMetrics = [...new Set([...(conditionMetricIds as string[]), ...OUTCOME_METRICS])];
    const matrix = await this.getCorrelationMatrix(allMetrics, scope);

    const pairwise = matrix
      .filter(m => {
        const aIsCondition = conditionMetricIds.includes(m.metricA);
        const bIsCondition = conditionMetricIds.includes(m.metricB);
        const aIsOutcome = OUTCOME_METRICS.includes(m.metricA);
        const bIsOutcome = OUTCOME_METRICS.includes(m.metricB);
        return (aIsCondition && bIsCondition) || (aIsCondition && bIsOutcome) || (bIsCondition && aIsOutcome);
      })
      .map(m => ({
        ...m,
        type: (conditionMetricIds.includes(m.metricA) && conditionMetricIds.includes(m.metricB))
          ? 'condition-condition' as const
          : 'condition-outcome' as const,
      }));

    const redundant = pairwise.filter(p => p.type === 'condition-condition' && Math.abs(p.r) > 0.85);
    const complementary = pairwise.filter(p => p.type === 'condition-condition' && Math.abs(p.r) >= 0.3 && Math.abs(p.r) <= 0.7);

    return {
      strategyName: strategy.name,
      conditionMetrics: conditionMetricIds as string[],
      outcomeMetrics: OUTCOME_METRICS,
      pairwise,
      redundant,
      complementary,
    };
  }

  async seedPresetStrategyCorrelations(): Promise<{ strategiesProcessed: number; correlationsComputed: number }> {
    try {
      const strategiesRes = await this.pool.query(
        `SELECT id, name, conditions, scope FROM strategy_definitions WHERE type = 'preset'`
      );

      let totalComputed = 0;
      for (const row of strategiesRes.rows) {
        try {
          const conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions || []);
          const condMetrics = [...new Set(conditions.map((c: any) => {
            const raw = c.metricId || c.metric_id || '';
            return translateMetricId(raw);
          }))];
          const allMetrics = [...new Set([...condMetrics, ...OUTCOME_METRICS_DB])];

          if (allMetrics.length >= 2) {
            const result = await this.computeMatrix(allMetrics as string[], row.scope || 'submarket');
            totalComputed += result.computed;
            logger.info(`[CorrelationSeed] ${row.name}: ${result.computed} computed, ${result.skipped} skipped`);
          }
        } catch (e) {
          logger.warn(`Skipping preset strategy ${row.name}: ${String(e)}`);
        }
      }

      logger.info(`[CorrelationSeed] Seeded correlations for ${strategiesRes.rows.length} preset strategies (${totalComputed} total computed)`);
      return { strategiesProcessed: strategiesRes.rows.length, correlationsComputed: totalComputed };
    } catch (error) {
      logger.error(`Error seeding preset strategy correlations: ${String(error)}`);
      return { strategiesProcessed: 0, correlationsComputed: 0 };
    }
  }

  private async getLatestSnapshot(city: string, state: string): Promise<MarketSnapshot | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM apartment_market_snapshots WHERE city = $1 AND state = $2 ORDER BY snapshot_date DESC LIMIT 1`,
        [city, state]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  }

  private async getTrendObservations(city: string): Promise<TrendObservation[]> {
    try {
      const result = await this.pool.query(
        `SELECT data FROM apartment_trends WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 1`,
        [city]
      );
      if (result.rows.length === 0) return [];
      const data = typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data;
      return data.observations || [];
    } catch {
      return [];
    }
  }

  private async getSubmarketData(city: string): Promise<SubmarketData[]> {
    try {
      const result = await this.pool.query(
        `SELECT data FROM apartment_submarkets WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 1`,
        [city]
      );
      if (result.rows.length === 0) return [];
      const data = typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data;
      return data.submarkets || [];
    } catch {
      return [];
    }
  }

  private async getMSAData(city: string): Promise<MSAData | null> {
    try {
      const result = await this.pool.query(
        `SELECT population, median_household_income, avg_rent, avg_occupancy FROM msas WHERE name ILIKE $1 LIMIT 1`,
        [`%${city}%`]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  }

  private computeCOR01(snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    if (!snapshot) missing.push('market snapshot');

    const rentGrowth = snapshot?.rent_growth_90d;
    let searchSurge: number | null = null;

    if (trends.length >= 8) {
      const recent = trends.slice(-4);
      const prior = trends.slice(-8, -4);
      const recentAvg = recent.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recent.length;
      const priorAvg = prior.reduce((s, t) => s + (t.search_activity_index || 0), 0) / prior.length;
      if (priorAvg > 0) searchSurge = (recentAvg - priorAvg) / priorAvg;
    } else if (trends.length >= 2) {
      const midpoint = Math.floor(trends.length / 2);
      const recent = trends.slice(midpoint);
      const prior = trends.slice(0, midpoint);
      const recentAvg = recent.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recent.length;
      const priorAvg = prior.reduce((s, t) => s + (t.search_activity_index || 0), 0) / prior.length;
      if (priorAvg > 0) searchSurge = (recentAvg - priorAvg) / priorAvg;
    } else {
      missing.push('sufficient trend observations (need 2+)');
    }

    if (searchSurge === null && trends.length >= 2) missing.push('valid search activity index values');
    missing.push('ADT baseline (adt_counts empty, using search index as proxy)');

    const hasData = searchSurge !== null && rentGrowth !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (searchSurge! > 0.10 && (rentGrowth ?? 0) < 0.05) {
        signal = 'bullish';
        actionable = `Search surge +${(searchSurge! * 100).toFixed(1)}% but rent growth only ${((rentGrowth ?? 0) * 100).toFixed(1)}% — repricing opportunity`;
      } else if (searchSurge! < -0.10) {
        signal = 'bearish';
        actionable = `Search declining ${(searchSurge! * 100).toFixed(1)}% — demand weakening`;
      } else {
        signal = 'neutral';
        actionable = `Search and rent growth aligned`;
      }
    }

    return {
      id: 'COR-01',
      name: 'Traffic Surge Index vs Rent Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchSurge !== null ? parseFloat((searchSurge * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null ? parseFloat(((rentGrowth ?? 0) * 100).toFixed(1)) : null,
      correlation: hasData ? this.estimateCorrelation(searchSurge!, rentGrowth!) : null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '3-6 months',
      actionable,
      dataSources: ['Apartment Locator AI (search index)', 'Market Snapshots (rent growth)'],
      missingData: missing,
    };
  }

  private computeCOR02(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = ['FDOT AADT year-over-year (adt_counts empty)'];
    let searchMomentum: number | null = null;

    if (trends.length >= 8) {
      const recentQ = trends.slice(-4);
      const priorQ = trends.slice(-8, -4);
      const recentAvg = recentQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recentQ.length;
      const priorAvg = priorQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / priorQ.length;
      if (priorAvg > 0) searchMomentum = (recentAvg - priorAvg) / priorAvg;
    } else {
      missing.push('sufficient trend observations (need 8+)');
    }

    return {
      id: 'COR-02',
      name: 'Search Momentum vs AADT Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchMomentum !== null ? parseFloat((searchMomentum * 100).toFixed(1)) : null,
      yValue: null,
      correlation: null,
      signal: searchMomentum !== null && searchMomentum > 0.05 ? 'bullish' : searchMomentum !== null && searchMomentum < -0.05 ? 'bearish' : searchMomentum !== null ? 'neutral' : null,
      confidence: 'insufficient',
      leadTime: '2-6 months',
      actionable: searchMomentum !== null ? `Search momentum: ${(searchMomentum * 100).toFixed(1)}% QoQ (AADT comparison pending)` : null,
      dataSources: ['Apartment Locator AI (search index)'],
      missingData: missing,
    };
  }

  private computeCOR03(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    let searchMomentum: number | null = null;
    let rentGrowth: number | null = null;

    if (trends.length >= 8) {
      const recentQ = trends.slice(-4);
      const priorQ = trends.slice(-8, -4);
      const recentSearchAvg = recentQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recentQ.length;
      const priorSearchAvg = priorQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / priorQ.length;
      if (priorSearchAvg > 0) searchMomentum = (recentSearchAvg - priorSearchAvg) / priorSearchAvg;

      const recentRentAvg = recentQ.reduce((s, t) => s + (t.avg_rent || 0), 0) / recentQ.length;
      const priorRentAvg = priorQ.reduce((s, t) => s + (t.avg_rent || 0), 0) / priorQ.length;
      if (priorRentAvg > 0) rentGrowth = (recentRentAvg - priorRentAvg) / priorRentAvg;
    } else {
      missing.push('sufficient trend observations (need 8+)');
    }

    const hasData = searchMomentum !== null && rentGrowth !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const gap = searchMomentum! - rentGrowth!;
      if (gap > 0.05) {
        signal = 'bullish';
        actionable = `Digital demand +${(searchMomentum! * 100).toFixed(1)}% outpacing rent growth ${(rentGrowth! * 100).toFixed(1)}% — repricing window open`;
      } else if (gap < -0.05) {
        signal = 'bearish';
        actionable = `Rent growth ${(rentGrowth! * 100).toFixed(1)}% outpacing demand ${(searchMomentum! * 100).toFixed(1)}% — correction risk`;
      } else {
        signal = 'neutral';
        actionable = 'Search momentum and rent growth aligned';
      }
    }

    return {
      id: 'COR-03',
      name: 'Search Momentum vs Rent Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchMomentum !== null ? parseFloat((searchMomentum * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null ? parseFloat((rentGrowth * 100).toFixed(1)) : null,
      correlation: hasData ? this.estimateCorrelation(searchMomentum!, rentGrowth!) : null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '4-8 months',
      actionable,
      dataSources: ['Apartment Locator AI (search index + rents)'],
      missingData: missing,
    };
  }

  private computeCOR04(msa: MSAData | null, snapshot: MarketSnapshot | null): CorrelationResult {
    const missing: string[] = [];
    if (!msa?.median_household_income) missing.push('BLS QCEW wage data (using MSA median income as proxy)');

    const medianIncome = msa?.median_household_income ? parseFloat(String(msa.median_household_income)) : null;
    const msaAvgRent = msa?.avg_rent ? parseFloat(String(msa.avg_rent)) : null;
    const rentGrowth = snapshot?.rent_growth_90d;

    let rentToIncomeRatio: number | null = null;
    if (medianIncome && msaAvgRent) {
      rentToIncomeRatio = (msaAvgRent * 12) / medianIncome;
    }

    const hasData = rentToIncomeRatio !== null && rentGrowth !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const affordPct = (rentToIncomeRatio! * 100);
      if (affordPct < 28) {
        signal = 'bullish';
        actionable = `Affordability ratio ${affordPct.toFixed(1)}% (below 30% ceiling). Room to push rents.`;
      } else if (affordPct < 32) {
        signal = 'neutral';
        actionable = `Affordability ratio ${affordPct.toFixed(1)}% — approaching 30% threshold. Moderate runway.`;
      } else {
        signal = 'bearish';
        actionable = `Affordability ratio ${affordPct.toFixed(1)}% exceeds 30% ceiling. Rent growth constrained.`;
      }
    }

    return {
      id: 'COR-04',
      name: 'Wage Growth vs Rent Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: rentToIncomeRatio !== null ? parseFloat((rentToIncomeRatio * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null ? parseFloat(((rentGrowth ?? 0) * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: 'Concurrent',
      actionable,
      dataSources: ['MSA median household income', 'MSA avg rent', 'Market Snapshots'],
      missingData: missing,
    };
  }

  private computeCOR05(snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    if (!snapshot) missing.push('market snapshot');

    let vacancyRate: number | null = null;
    let searchActivity: number | null = null;

    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      vacancyRate = latest.vacancy_rate;
      searchActivity = latest.search_activity_index;
    } else {
      missing.push('trend observations');
    }

    if (!vacancyRate && snapshot?.avg_occupancy) {
      vacancyRate = 1 - parseFloat(String(snapshot.avg_occupancy));
    }

    const hasData = vacancyRate !== null && searchActivity !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (searchActivity! > 80 && vacancyRate! > 0.08) {
        signal = 'bullish';
        actionable = `High search activity (${searchActivity}) + elevated vacancy (${(vacancyRate! * 100).toFixed(1)}%) = Management/pricing problem, not demand. Value-add target.`;
      } else if (searchActivity! < 60 && vacancyRate! > 0.10) {
        signal = 'bearish';
        actionable = `Low search (${searchActivity}) + high vacancy (${(vacancyRate! * 100).toFixed(1)}%) = True demand problem.`;
      } else {
        signal = 'neutral';
        actionable = `Search ${searchActivity}, vacancy ${(vacancyRate! * 100).toFixed(1)}% — balanced.`;
      }
    }

    return {
      id: 'COR-05',
      name: 'Traffic Surge Index vs Vacancy Rate',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchActivity,
      yValue: vacancyRate !== null ? parseFloat((vacancyRate * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '2-4 months',
      actionable,
      dataSources: ['Apartment Locator AI (search + vacancy)'],
      missingData: missing,
    };
  }

  private computeCOR06(snapshot: MarketSnapshot | null): CorrelationResult {
    const missing: string[] = [];
    const supplyPressure = snapshot?.supply_pressure;
    const rentGrowth = snapshot?.rent_growth_90d;

    if (!supplyPressure) missing.push('supply pressure data');
    if (rentGrowth === null || rentGrowth === undefined) missing.push('rent growth data');

    const hasData = supplyPressure !== null && supplyPressure !== undefined;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (supplyPressure === 'low') {
        signal = 'bullish';
        actionable = 'Supply pressure is low — favorable for rent growth.';
      } else if (supplyPressure === 'moderate') {
        signal = 'neutral';
        actionable = 'Moderate supply pressure — monitor pipeline deliveries.';
      } else {
        signal = 'bearish';
        actionable = 'High supply pressure — pipeline >12% triggers rent growth deceleration.';
      }
    }

    return {
      id: 'COR-06',
      name: 'Pipeline % vs Rent Growth',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: null,
      yValue: rentGrowth !== null && rentGrowth !== undefined ? parseFloat(((rentGrowth) * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'low' : 'insufficient',
      leadTime: '6-18 months',
      actionable,
      dataSources: ['Market Snapshots (supply pressure)'],
      missingData: missing,
    };
  }

  private computeCOR07(snapshot: MarketSnapshot | null): CorrelationResult {
    const missing: string[] = [];
    const absorptionRate = snapshot?.monthly_absorption_rate;
    const supplyPressure = snapshot?.supply_pressure;

    if (!absorptionRate) missing.push('absorption rate');
    if (!supplyPressure) missing.push('pipeline data');

    const hasData = absorptionRate !== null && absorptionRate !== undefined;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const rate = parseFloat(String(absorptionRate));
      if (rate > 0.02) {
        signal = 'bullish';
        actionable = `Monthly absorption rate ${(rate * 100).toFixed(1)}% — healthy demand absorbing supply.`;
      } else if (rate > 0) {
        signal = 'neutral';
        actionable = `Monthly absorption rate ${(rate * 100).toFixed(1)}% — adequate.`;
      } else {
        signal = 'bearish';
        actionable = 'Negative absorption — supply exceeding demand.';
      }
    }

    return {
      id: 'COR-07',
      name: 'Absorption Rate vs Pipeline %',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: absorptionRate !== null && absorptionRate !== undefined ? parseFloat((parseFloat(String(absorptionRate)) * 100).toFixed(1)) : null,
      yValue: null,
      correlation: null,
      signal,
      confidence: hasData ? 'low' : 'insufficient',
      leadTime: 'Concurrent',
      actionable,
      dataSources: ['Market Snapshots (absorption)'],
      missingData: missing,
    };
  }

  private computeCOR08(): CorrelationResult {
    return {
      id: 'COR-08',
      name: 'Permit Velocity vs Market Cap Rate',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '18-30 months',
      actionable: null,
      dataSources: [],
      missingData: ['Municipal permit data', 'Transaction cap rate records'],
    };
  }

  private computeCOR09(snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    let concessionRate: number | null = null;

    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      concessionRate = latest.concessions_prevalence;
    } else if (snapshot?.concession_rate) {
      concessionRate = parseFloat(String(snapshot.concession_rate));
    } else {
      missing.push('concession rate data');
    }

    missing.push('quarterly unit delivery counts');

    const hasData = concessionRate !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (concessionRate! > 0.40) {
        signal = 'bearish';
        actionable = `Concession prevalence ${(concessionRate! * 100).toFixed(0)}% — heavy discounting indicates supply pressure. Factor into EGI.`;
      } else if (concessionRate! > 0.20) {
        signal = 'neutral';
        actionable = `Concession prevalence ${(concessionRate! * 100).toFixed(0)}% — moderate. Normal market conditions.`;
      } else {
        signal = 'bullish';
        actionable = `Low concession prevalence ${(concessionRate! * 100).toFixed(0)}% — landlord-favorable market.`;
      }
    }

    return {
      id: 'COR-09',
      name: 'Quarterly Deliveries vs Concession Rate',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: null,
      yValue: concessionRate !== null ? parseFloat((concessionRate * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'low' : 'insufficient',
      leadTime: '1-3 months',
      actionable,
      dataSources: ['Apartment Locator AI (concessions)'],
      missingData: missing,
    };
  }

  private computeCOR10(): CorrelationResult {
    return {
      id: 'COR-10',
      name: 'Business Formation Velocity vs Search Momentum',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3-6 months',
      actionable: null,
      dataSources: [],
      missingData: ['Census Business Formation Statistics (BFS)'],
    };
  }

  private computeCOR11(): CorrelationResult {
    return {
      id: 'COR-11',
      name: 'Net Migration vs Out-of-State Search',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-12 months',
      actionable: null,
      dataSources: [],
      missingData: ['IRS SOI migration data', 'Google Trends by region'],
    };
  }

  private computeCOR12(): CorrelationResult {
    return {
      id: 'COR-12',
      name: 'Job Growth vs Net Absorption',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3-6 months',
      actionable: null,
      dataSources: [],
      missingData: ['BLS job growth data', 'Net absorption records'],
    };
  }

  private computeCOR13(msa: MSAData | null, snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    const medianIncome = msa?.median_household_income ? parseFloat(String(msa.median_household_income)) : null;

    let avgRent: number | null = null;
    if (trends.length > 0) {
      avgRent = trends[trends.length - 1].avg_rent;
    } else if (msa?.avg_rent) {
      avgRent = parseFloat(String(msa.avg_rent));
    }

    if (!medianIncome) missing.push('Census ACS median household income');
    if (!avgRent) missing.push('current avg rent');

    let ratio: number | null = null;
    if (medianIncome && avgRent) {
      ratio = (avgRent * 12) / medianIncome;
    }

    const rentGrowth = snapshot?.rent_growth_90d;

    const hasData = ratio !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const pct = ratio! * 100;
      if (pct < 28) {
        signal = 'bullish';
        actionable = `Rent-to-income ${pct.toFixed(1)}% — well below 30% affordability ceiling. Runway for rent increases.`;
      } else if (pct <= 32) {
        signal = 'neutral';
        actionable = `Rent-to-income ${pct.toFixed(1)}% — near ceiling. Limited upside for aggressive rent growth.`;
      } else {
        signal = 'bearish';
        actionable = `Rent-to-income ${pct.toFixed(1)}% — exceeds 30% ceiling. Reduce rent growth assumptions by 100-200bps.`;
      }
    }

    return {
      id: 'COR-13',
      name: 'Rent-to-Income Ratio vs Rent Growth',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: ratio !== null ? parseFloat((ratio * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null && rentGrowth !== undefined ? parseFloat(((rentGrowth ?? 0) * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: 'Concurrent',
      actionable,
      dataSources: ['MSA median income (Census ACS)', 'Apartment Locator AI (avg rent)'],
      missingData: missing,
    };
  }

  private computeCOR14(submarkets: SubmarketData[]): CorrelationResult {
    const missing: string[] = ['Google Places API ratings'];

    if (submarkets.length === 0) {
      missing.push('submarket data');
      return {
        id: 'COR-14',
        name: 'Google Rating vs Rent Premium',
        tier: 4,
        category: 'Competitive & Quality Signals',
        xValue: null,
        yValue: null,
        correlation: null,
        signal: null,
        confidence: 'insufficient',
        leadTime: 'Concurrent',
        actionable: null,
        dataSources: [],
        missingData: missing,
      };
    }

    const avgRentOverall = submarkets.reduce((s, sm) => s + sm.avg_rent, 0) / submarkets.length;
    const premiums = submarkets.map(sm => ({
      name: sm.name,
      premium: ((sm.avg_rent - avgRentOverall) / avgRentOverall) * 100,
      opportunityScore: sm.avg_opportunity_score,
    }));

    const bestOpportunity = premiums.reduce((best, p) => p.opportunityScore > best.opportunityScore ? p : best, premiums[0]);

    return {
      id: 'COR-14',
      name: 'Google Rating vs Rent Premium',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: bestOpportunity.opportunityScore,
      yValue: parseFloat(bestOpportunity.premium.toFixed(1)),
      correlation: null,
      signal: bestOpportunity.premium < 0 && bestOpportunity.opportunityScore > 5 ? 'bullish' : 'neutral',
      confidence: 'low',
      leadTime: 'Concurrent',
      actionable: `${bestOpportunity.name}: opportunity score ${bestOpportunity.opportunityScore.toFixed(1)} with rent ${bestOpportunity.premium > 0 ? '+' : ''}${bestOpportunity.premium.toFixed(1)}% vs market avg`,
      dataSources: ['Apartment Locator AI (submarket opportunity scores + rents)'],
      missingData: missing,
    };
  }

  private computeCOR15(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = ['Google review sentiment NLP'];
    let negotiationTrend: number | null = null;

    if (trends.length >= 4) {
      const recent = trends.slice(-2);
      const prior = trends.slice(-4, -2);
      const recentAvg = recent.reduce((s, t) => s + (t.negotiation_success_rate || 0), 0) / recent.length;
      const priorAvg = prior.reduce((s, t) => s + (t.negotiation_success_rate || 0), 0) / prior.length;
      if (priorAvg > 0) negotiationTrend = recentAvg - priorAvg;
    } else {
      missing.push('sufficient trend data');
    }

    let signal: string | null = null;
    let actionable: string | null = null;
    if (negotiationTrend !== null) {
      if (negotiationTrend > 0.05) {
        signal = 'bearish';
        actionable = `Negotiation success rising (+${(negotiationTrend * 100).toFixed(1)}pp) — tenants gaining leverage. Rent increase resistance likely.`;
      } else if (negotiationTrend < -0.05) {
        signal = 'bullish';
        actionable = `Negotiation success falling (${(negotiationTrend * 100).toFixed(1)}pp) — landlords gaining pricing power.`;
      } else {
        signal = 'neutral';
        actionable = 'Negotiation dynamics stable.';
      }
    }

    return {
      id: 'COR-15',
      name: 'Sentiment Trend vs Lease Velocity',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: negotiationTrend !== null ? parseFloat((negotiationTrend * 100).toFixed(1)) : null,
      yValue: null,
      correlation: null,
      signal,
      confidence: negotiationTrend !== null ? 'low' : 'insufficient',
      leadTime: '2-4 months',
      actionable,
      dataSources: ['Apartment Locator AI (negotiation rates)'],
      missingData: missing,
    };
  }

  private computeCOR16(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    let searchShare: number | null = null;
    let vacancyRate: number | null = null;

    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      searchShare = latest.search_activity_index;
      vacancyRate = latest.vacancy_rate;
    } else {
      missing.push('trend observations');
    }

    const hasData = searchShare !== null && vacancyRate !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (searchShare! > 80 && vacancyRate! < 0.06) {
        signal = 'bullish';
        actionable = `High search activity (${searchShare}) + low vacancy (${(vacancyRate! * 100).toFixed(1)}%) — strong demand-supply balance.`;
      } else if (searchShare! < 60) {
        signal = 'bearish';
        actionable = `Falling search activity (${searchShare}) — top-of-funnel warning for occupancy.`;
      } else {
        signal = 'neutral';
        actionable = `Search activity ${searchShare}, vacancy ${(vacancyRate! * 100).toFixed(1)}% — stable.`;
      }
    }

    return {
      id: 'COR-16',
      name: 'Digital Traffic Share vs Physical Occupancy',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: searchShare,
      yValue: vacancyRate !== null ? parseFloat((vacancyRate * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '1-3 months',
      actionable,
      dataSources: ['Apartment Locator AI (search + vacancy)'],
      missingData: missing,
    };
  }

  private computeCOR17(): CorrelationResult {
    return {
      id: 'COR-17',
      name: 'Traffic Velocity Score vs RevPAU',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3-6 months',
      actionable: null,
      dataSources: [],
      missingData: ['M07 Fusion Engine TPI data', 'Property financial records'],
    };
  }

  private computeCOR18(): CorrelationResult {
    return {
      id: 'COR-18',
      name: 'Business Formations (NAICS) vs Rent Growth',
      tier: 5,
      category: 'Advanced / Emerging',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-12 months',
      actionable: null,
      dataSources: [],
      missingData: ['Census BFS sector data'],
    };
  }

  private computeCOR19(): CorrelationResult {
    return {
      id: 'COR-19',
      name: 'Maintenance Sentiment vs NOI Margin',
      tier: 5,
      category: 'Advanced / Emerging',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: 'Concurrent',
      actionable: null,
      dataSources: [],
      missingData: ['NLP review analysis', 'P&L statements'],
    };
  }

  private computeCOR20(): CorrelationResult {
    return {
      id: 'COR-20',
      name: 'Digital-Physical Gap vs Price per Unit',
      tier: 5,
      category: 'Advanced / Emerging',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-12 months',
      actionable: null,
      dataSources: [],
      missingData: ['SpyFu domain data', 'FDOT AADT', 'Transaction deed records'],
    };
  }

  private estimateCorrelation(x: number, y: number): number {
    if (x === 0 && y === 0) return 0;
    const sameDirection = (x > 0 && y > 0) || (x < 0 && y < 0);
    const magnitude = Math.min(Math.abs(x) + Math.abs(y), 1);
    return parseFloat(((sameDirection ? 0.5 : -0.5) + magnitude * (sameDirection ? 0.3 : -0.3)).toFixed(2));
  }

  private identifyTopOpportunity(correlations: CorrelationResult[]): string | null {
    const bullish = correlations.filter(c => c.signal === 'bullish' && c.confidence !== 'insufficient');
    if (bullish.length === 0) return null;
    const tier1Bullish = bullish.filter(c => c.tier === 1);
    if (tier1Bullish.length > 0) {
      return `${tier1Bullish.length} Tier-1 bullish signal(s): ${tier1Bullish.map(c => c.id).join(', ')}`;
    }
    return `${bullish.length} bullish signal(s) across tiers`;
  }

  async generateMetricRecommendations(
    marketGeoIds: Array<{ geoType: string; geoId: string }>,
    userId?: string,
    topN: number = 5
  ): Promise<MetricRecommendation[]> {
    if (marketGeoIds.length === 0) return [];

    try {
      if (userId) {
        const cached = await this.getCachedRecommendations(userId, marketGeoIds, topN);
        if (cached) return cached;
      }

      const geoTypes = marketGeoIds.map(g => g.geoType);
      const geoIds = marketGeoIds.map(g => g.geoId);

      const corrRes = await this.pool.query(
        `SELECT * FROM (
          (SELECT metric_a, metric_b, geography_type, geography_id,
                  correlation_r, lead_lag_months, p_value, sample_size, computed_at,
                  FALSE as is_cross_geo
           FROM metric_correlations
           WHERE (geography_type, geography_id) IN (
             SELECT unnest($1::text[]), unnest($2::text[])
           )
           AND ABS(correlation_r) >= 0.4
           AND sample_size >= 12)
          UNION ALL
          (SELECT metric_a, metric_b, geography_type, geography_id,
                  correlation_r, lead_lag_months, p_value, sample_size, computed_at,
                  TRUE as is_cross_geo
           FROM metric_correlations
           WHERE (metric_a, metric_b) IN (
             SELECT DISTINCT metric_a, metric_b FROM metric_correlations
             WHERE (geography_type, geography_id) IN (
               SELECT unnest($1::text[]), unnest($2::text[])
             )
           )
           AND NOT ((geography_type, geography_id) IN (
             SELECT unnest($1::text[]), unnest($2::text[])
           ))
           AND ABS(correlation_r) >= 0.6
           AND sample_size >= 12
           LIMIT 50)
        ) combined ORDER BY ABS(correlation_r) DESC`,
        [geoTypes, geoIds]
      );

      if (corrRes.rows.length === 0) return [];

      const trendRes = await this.pool.query(
        `SELECT metric_id, geography_type, geography_id,
                value, period_date
         FROM (
           SELECT metric_id, geography_type, geography_id, value, period_date,
                  ROW_NUMBER() OVER (PARTITION BY metric_id, geography_type, geography_id ORDER BY period_date DESC) as rn
           FROM metric_time_series
           WHERE (geography_type, geography_id) IN (
             SELECT unnest($1::text[]), unnest($2::text[])
           )
         ) sub
         WHERE rn <= 6`,
        [geoTypes, geoIds]
      );

      const trendMap = new Map<string, Array<{ value: number; date: string }>>();
      for (const row of trendRes.rows) {
        const key = `${row.metric_id}:${row.geography_type}:${row.geography_id}`;
        if (!trendMap.has(key)) trendMap.set(key, []);
        const dateStr = row.period_date instanceof Date ? row.period_date.toISOString() : String(row.period_date);
        trendMap.get(key)!.push({ value: parseFloat(row.value), date: dateStr });
      }

      const metricScores = new Map<string, {
        totalScore: number;
        appearances: number;
        bestR: number;
        bestLag: number;
        bestPair: string;
        bestGeo: string;
        geoCount: number;
        geos: Set<string>;
        crossGeoSources: Set<string>;
        trendDirection: string;
        trendMagnitude: number;
      }>();

      const COLUMN_METRIC_MAP: Record<string, string> = {
        rent_index: 'rent',
        rent_index_yoy: 'rentD',
        home_value_index: 'cap',
        home_value_index_yoy: 'cap',
        DEMO_MED_INCOME: 'medInc',
        DEMO_POPULATION: 'popD',
        DEMO_RENTER_PCT: 'vac',
        T_AADT: 'dApt',
        T_AADT_YOY: 'dApt',
      };

      for (const row of corrRes.rows) {
        const metrics = [row.metric_a, row.metric_b];
        const rowGeoId = row.geography_id;
        const isTracked = !row.is_cross_geo;

        for (const metric of metrics) {
          const globalKey = metric;
          const perMarketKeys: string[] = [];
          if (isTracked) {
            perMarketKeys.push(`${metric}::${rowGeoId}`);
          } else {
            for (const gId of geoIds) {
              perMarketKeys.push(`${metric}::${gId}`);
            }
          }
          const keysToScore = [globalKey, ...perMarketKeys];

          for (const key of keysToScore) {
            if (!metricScores.has(key)) {
              metricScores.set(key, {
                totalScore: 0,
                appearances: 0,
                bestR: 0,
                bestLag: 0,
                bestPair: '',
                bestGeo: '',
                geoCount: 0,
                geos: new Set(),
                crossGeoSources: new Set<string>(),
                trendDirection: 'stable',
                trendMagnitude: 0,
              });
            }

            const entry = metricScores.get(key)!;
            const absR = Math.abs(parseFloat(row.correlation_r));
            const pVal = row.p_value ? parseFloat(row.p_value) : 1;
            const sampleSize = parseInt(row.sample_size);
            const age = (Date.now() - new Date(row.computed_at).getTime()) / (1000 * 60 * 60 * 24);
            const crossGeoDiscount = isTracked ? 1.0 : 0.4;

            let score = absR * 40 * crossGeoDiscount;
            if (pVal < 0.01) score += 20;
            else if (pVal < 0.05) score += 15;
            else if (pVal < 0.1) score += 10;

            if (sampleSize >= 36) score += 10;
            else if (sampleSize >= 24) score += 5;

            if (age <= 7) score += 10;
            else if (age <= 14) score += 5;

            if (row.lead_lag_months && Math.abs(parseInt(row.lead_lag_months)) > 0) {
              score += 5;
            }

            entry.totalScore += score;
            entry.appearances++;
            entry.geos.add(`${row.geography_type}:${rowGeoId}`);
            if (!isTracked && key.includes('::')) {
              entry.crossGeoSources.add(rowGeoId);
            }

            if (absR > Math.abs(entry.bestR) || entry.bestR === 0) {
              entry.bestR = parseFloat(row.correlation_r);
              const rawLag = parseInt(row.lead_lag_months) || 0;
              entry.bestLag = metric === row.metric_a ? rawLag : -rawLag;
              entry.bestPair = metrics.find(m => m !== metric) || '';
              entry.bestGeo = rowGeoId;
            }
          }
        }
      }

      for (const [key, entry] of metricScores) {
        entry.geoCount = entry.geos.size;

        if (entry.geoCount > 1) {
          entry.totalScore *= (1 + Math.min(entry.geoCount - 1, 5) * 0.1);
        }

        const baseMetric = key.includes('::') ? key.split('::')[0] : key;
        for (const geo of entry.geos) {
          const [geoType, geoId] = geo.split(':');
          const trendKey = `${baseMetric}:${geoType}:${geoId}`;
          const trends = trendMap.get(trendKey);
          if (trends && trends.length >= 2) {
            const sorted = trends.sort((a, b) => a.date.localeCompare(b.date));
            const recent = sorted[sorted.length - 1].value;
            const prior = sorted[0].value;
            if (prior !== 0) {
              const change = (recent - prior) / Math.abs(prior);
              if (Math.abs(change) > Math.abs(entry.trendMagnitude)) {
                entry.trendMagnitude = change;
                entry.trendDirection = change > 0.01 ? 'rising' : change < -0.01 ? 'falling' : 'stable';
              }
            }
          }
        }

        if (entry.trendDirection !== 'stable') {
          entry.totalScore *= 1.15;
        }
      }

      const perMarketEntries = Array.from(metricScores.entries())
        .filter(([key]) => key.includes('::'));

      const ranked: Array<{
        metric: string;
        score: number;
        crossGeoCount: number;
        totalScore: number;
        appearances: number;
        bestR: number;
        bestLag: number;
        bestPair: string;
        bestGeo: string;
        geoCount: number;
        geos: Set<string>;
        crossGeoSources: Set<string>;
        trendDirection: string;
        trendMagnitude: number;
      }> = [];

      if (perMarketEntries.length > 0) {
        const byGeo = new Map<string, typeof perMarketEntries>();
        for (const [key, entry] of perMarketEntries) {
          const geoId = key.split('::')[1];
          if (!byGeo.has(geoId)) byGeo.set(geoId, []);
          byGeo.get(geoId)!.push([key, entry]);
        }

        for (const [geoId, entries] of byGeo) {
          const sorted = entries
            .map(([key, entry]) => {
              const baseMetric = key.split('::')[0];
              const globalEntry = metricScores.get(baseMetric);
              const crossGeoCount = globalEntry ? globalEntry.geos.size - entry.geos.size : 0;
              return {
                metric: baseMetric,
                score: entry.totalScore / Math.max(entry.appearances, 1),
                crossGeoCount,
                ...entry,
                bestGeo: geoId,
              };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);
          ranked.push(...sorted);
        }
      } else {
        const globalEntries = Array.from(metricScores.entries())
          .filter(([key]) => !key.includes('::'));
        const sorted = globalEntries
          .map(([key, entry]) => ({
            metric: key,
            score: entry.totalScore / Math.max(entry.appearances, 1),
            crossGeoCount: 0,
            ...entry,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, topN);
        ranked.push(...sorted);
      }

      const METRIC_LABELS: Record<string, string> = {
        home_value_index: 'Home Value Index',
        home_value_index_yoy: 'Home Value Growth (YoY)',
        rent_index: 'Rent Index',
        rent_index_yoy: 'Rent Growth (YoY)',
        DEMO_MED_INCOME: 'Median Household Income',
        DEMO_POPULATION: 'Population',
        DEMO_RENTER_PCT: 'Renter Percentage',
        T_AADT: 'Traffic Volume (AADT)',
        T_AADT_YOY: 'Traffic Growth (YoY)',
      };

      const recommendations: MetricRecommendation[] = ranked.map((item, idx) => {
        const columnId = COLUMN_METRIC_MAP[item.metric] || null;
        const label = METRIC_LABELS[item.metric] || item.metric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const pairLabel = METRIC_LABELS[item.bestPair] || item.bestPair.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const geoParts = item.bestGeo.split('-');
        const geoCity = geoParts.slice(0, -2).join(' ').replace(/\b\w/g, c => c.toUpperCase());
        const geoState = (geoParts[geoParts.length - 2] || '').toUpperCase();
        const geoName = geoState ? `${geoCity}, ${geoState}` : geoCity;

        let reason = '';
        const rSign = item.bestR > 0 ? 'positively' : 'inversely';
        const absR = Math.abs(item.bestR).toFixed(2);

        if (item.bestLag !== 0) {
          const lagDir = item.bestLag > 0 ? 'leads' : 'lags';
          const lagAbs = Math.abs(item.bestLag);
          reason = `${label} ${lagDir} ${pairLabel} by ${lagAbs} month${lagAbs > 1 ? 's' : ''} in ${geoName} (r=${absR}, ${rSign})`;
        } else {
          reason = `${label} ${rSign} correlates with ${pairLabel} in ${geoName} (r=${absR})`;
        }

        if (item.trendDirection !== 'stable') {
          const pct = (Math.abs(item.trendMagnitude) * 100).toFixed(1);
          reason += ` — currently ${item.trendDirection} ${pct}%`;
        }

        const globalEntry = metricScores.get(item.metric);
        const totalGeos = globalEntry ? globalEntry.geos.size : item.geoCount;
        const crossCount = item.crossGeoCount || 0;
        if (totalGeos > 1 && crossCount > 0) {
          const formatGeoName = (id: string) => {
            const parts = id.split('-');
            const city = parts.slice(0, -2).join(' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const st = (parts[parts.length - 2] || '').toUpperCase();
            return st ? `${city}, ${st}` : city;
          };
          const topSources = Array.from(item.crossGeoSources).slice(0, 3).map(formatGeoName);
          if (topSources.length > 0) {
            reason += `. Also validated in ${topSources.join(', ')}${crossCount > 3 ? ` and ${crossCount - 3} other markets` : ''}`;
          } else {
            reason += `. Validated across ${totalGeos} markets (${crossCount} cross-market)`;
          }
        } else if (totalGeos > 1) {
          reason += `. Consistent across ${totalGeos} markets`;
        }

        return {
          rank: idx + 1,
          metricId: item.metric,
          metricLabel: label,
          columnId,
          score: Math.round(item.score * 10) / 10,
          reason,
          correlationR: item.bestR,
          leadLagMonths: item.bestLag,
          pairedMetric: item.bestPair,
          pairedMetricLabel: pairLabel,
          geographyId: item.bestGeo,
          geoCount: item.geoCount,
          trendDirection: item.trendDirection,
          trendMagnitude: Math.round(item.trendMagnitude * 1000) / 1000,
        };
      });

      if (userId && recommendations.length > 0) {
        await this.cacheRecommendations(userId, marketGeoIds, recommendations, topN);
      }

      return recommendations;
    } catch (error) {
      logger.error(`Error generating metric recommendations: ${String(error)}`);
      return [];
    }
  }

  private batchCacheKey(marketGeoIds: Array<{ geoType: string; geoId: string }>, topN: number = 5): string {
    const raw = marketGeoIds.map(g => `${g.geoType}:${g.geoId}`).sort().join(',') + `|topN=${topN}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 64);
  }

  private async getCachedRecommendations(
    userId: string,
    marketGeoIds: Array<{ geoType: string; geoId: string }>,
    topN: number = 5
  ): Promise<MetricRecommendation[] | null> {
    try {
      const cacheKey = this.batchCacheKey(marketGeoIds, topN);
      const geoTypes = marketGeoIds.map(g => g.geoType);
      const geoIds = marketGeoIds.map(g => g.geoId);

      const res = await this.pool.query(
        `SELECT mr.recommendations, mr.computed_at as cache_computed_at
         FROM metric_recommendations mr
         WHERE mr.user_id = $1 AND mr.geography_type = 'batch' AND mr.geography_id = $2
           AND mr.expires_at > NOW()
         ORDER BY mr.computed_at DESC LIMIT 1`,
        [userId, cacheKey]
      );
      if (res.rows.length === 0) return null;

      const cacheTime = new Date(res.rows[0].cache_computed_at);

      const freshRes = await this.pool.query(
        `SELECT MAX(computed_at) as newest_corr
         FROM metric_correlations
         WHERE (geography_type, geography_id) IN (
           SELECT unnest($1::text[]), unnest($2::text[])
         )`,
        [geoTypes, geoIds]
      );
      if (freshRes.rows[0]?.newest_corr) {
        const newestCorr = new Date(freshRes.rows[0].newest_corr);
        if (newestCorr > cacheTime) {
          return null;
        }
      }

      return res.rows[0].recommendations as MetricRecommendation[];
    } catch {
      return null;
    }
  }

  private async cacheRecommendations(
    userId: string,
    marketGeoIds: Array<{ geoType: string; geoId: string }>,
    recommendations: MetricRecommendation[],
    topN: number = 5
  ): Promise<void> {
    try {
      const cacheKey = this.batchCacheKey(marketGeoIds, topN);
      await this.pool.query(
        `INSERT INTO metric_recommendations (user_id, geography_type, geography_id, recommendations, computed_at, expires_at)
         VALUES ($1, 'batch', $2, $3, NOW(), NOW() + INTERVAL '7 days')
         ON CONFLICT (user_id, geography_type, geography_id)
         DO UPDATE SET recommendations = $3, computed_at = NOW(), expires_at = NOW() + INTERVAL '7 days'`,
        [userId, cacheKey, JSON.stringify(recommendations)]
      );
    } catch (error) {
      logger.error(`Error caching recommendations: ${String(error)}`);
    }
  }
}
