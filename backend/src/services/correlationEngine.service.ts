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

    const [cor21, cor22, cor23, cor24, cor25, cor26, cor27, cor28, cor29, cor30] = await Promise.all([
      this.computeCOR21(city),
      this.computeCOR22(city),
      this.computeCOR23(city),
      this.computeCOR24(city),
      this.computeCOR25(city),
      this.computeCOR26(city),
      this.computeCOR27(city),
      this.computeCOR28(city),
      this.computeCOR29(city),
      this.computeCOR30(city),
    ]);
    correlations.push(cor21, cor22, cor23, cor24, cor25, cor26, cor27, cor28, cor29, cor30);

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

  /**
   * Run the full COR-01–30 suite with first-party property data merged into the
   * city-level base data. This gives each owned-portfolio property its own
   * per-property execution path through the correlation engine rather than a
   * shared city-level result with selective post-hoc overrides.
   *
   * Merge strategy (1P values replace city-level where present):
   *   snapshot.avg_occupancy   ← property avg occupancy (0–1 fractional, DB-verified)
   *   snapshot.concession_rate ← property concession_depth_ratio × 100 (→ percentage)
   *   msa.avg_rent             ← property avg effective rent ($/month)
   *   msa.avg_occupancy        ← property avg occupancy (0–1 fractional)
   *   trends[]                 ← property actuals rows (avg_rent, vacancy_rate,
   *                              concessions_prevalence); all other TrendObservation
   *                              fields filled from the most recent city-level row.
   *                              When fewer than 3 actuals are available, city-level
   *                              trends are used as-is (avoids noise from a single month).
   */
  async computeCorrelationsWithPropertyData(
    city: string,
    state: string,
    propertyOverrides: {
      avgOccupancy?: number | null;
      avgEffRent?: number | null;
      concessionDepthRatio?: number | null;
      propertyActualTrends?: Array<{
        date: string;
        avg_rent: number;
        vacancy_rate: number;           // 0–1 fractional (1 − occupancy_rate)
        concessions_prevalence: number; // 0 or 1 (concession present in month)
      }>;
    }
  ): Promise<CorrelationReport> {
    const baseSnapshot = await this.getLatestSnapshot(city, state);
    const baseTrends   = await this.getTrendObservations(city);
    const submarkets   = await this.getSubmarketData(city);
    const baseMsa      = await this.getMSAData(city);

    // Merge 1P occupancy + concession depth into snapshot
    const snapshot: MarketSnapshot | null = baseSnapshot
      ? {
          ...baseSnapshot,
          ...(propertyOverrides.avgOccupancy != null
            ? { avg_occupancy: propertyOverrides.avgOccupancy }
            : {}),
          ...(propertyOverrides.concessionDepthRatio != null
            ? { concession_rate: propertyOverrides.concessionDepthRatio * 100 }
            : {}),
        }
      : baseSnapshot;

    // Merge 1P rent + occupancy into MSA data; synthesise stub when no MSA row exists
    const msa: MSAData | null = baseMsa
      ? {
          ...baseMsa,
          ...(propertyOverrides.avgEffRent != null
            ? { avg_rent: propertyOverrides.avgEffRent }
            : {}),
          ...(propertyOverrides.avgOccupancy != null
            ? { avg_occupancy: propertyOverrides.avgOccupancy }
            : {}),
        }
      : (propertyOverrides.avgEffRent != null || propertyOverrides.avgOccupancy != null)
      ? {
          population: null,
          median_household_income: null,
          avg_rent: propertyOverrides.avgEffRent ?? null,
          avg_occupancy: propertyOverrides.avgOccupancy ?? null,
        }
      : null;

    // Build per-property trend time-series from actuals, falling back to city trends
    // when insufficient actuals are provided.
    let trends = baseTrends;
    if (
      propertyOverrides.propertyActualTrends &&
      propertyOverrides.propertyActualTrends.length >= 3
    ) {
      const cityTemplate = baseTrends[0] ?? {} as Partial<TrendObservation>;
      trends = propertyOverrides.propertyActualTrends.map(pt => ({
        date: pt.date,
        avg_rent: pt.avg_rent,
        total_supply: cityTemplate.total_supply ?? 0,
        vacancy_rate: pt.vacancy_rate,
        available_units: cityTemplate.available_units ?? 0,
        listings_active: cityTemplate.listings_active ?? 0,
        seasonal_factor: cityTemplate.seasonal_factor ?? 1,
        application_volume: cityTemplate.application_volume ?? 0,
        avg_days_on_market: cityTemplate.avg_days_on_market ?? 0,
        avg_opportunity_score: cityTemplate.avg_opportunity_score ?? 0,
        search_activity_index: cityTemplate.search_activity_index ?? 0,
        concessions_prevalence: pt.concessions_prevalence,
        negotiation_success_rate: cityTemplate.negotiation_success_rate ?? 0,
      }));
    }

    // Run full COR-01–30 suite with merged snapshot / MSA / trend data
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

    const [cor21, cor22, cor23, cor24, cor25, cor26, cor27, cor28, cor29, cor30] = await Promise.all([
      this.computeCOR21(city),
      this.computeCOR22(city),
      this.computeCOR23(city),
      this.computeCOR24(city),
      this.computeCOR25(city),
      this.computeCOR26(city),
      this.computeCOR27(city),
      this.computeCOR28(city),
      this.computeCOR29(city),
      this.computeCOR30(city),
    ]);
    correlations.push(cor21, cor22, cor23, cor24, cor25, cor26, cor27, cor28, cor29, cor30);

    const computed = correlations.filter(c => c.confidence !== 'insufficient');
    const skipped  = correlations.filter(c => c.confidence === 'insufficient');
    const bullish  = computed.filter(c => c.signal === 'bullish').length;
    const bearish  = computed.filter(c => c.signal === 'bearish').length;
    const neutral  = computed.filter(c => c.signal === 'neutral').length;
    const cor04    = correlations.find(c => c.id === 'COR-04');
    const cor13    = correlations.find(c => c.id === 'COR-13');
    const cor06    = correlations.find(c => c.id === 'COR-06');

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

  /**
   * Tier-2 (Spec §3): Compute correlations for a deal AND persist the resulting
   * signals as adjustment rows on `deals.correlation_adjustments`. Once persisted,
   * M22 attribution and downstream consumers see the same signal stream that
   * drove the model.
   *
   * Audit-critical: persistence failure THROWS by default so callers (REST
   * routes) surface a 5xx and clients can retry. Pass `{ strict: false }` for
   * legacy/best-effort behavior where a failed persist is logged and swallowed.
   */
  async computeAndPersistForDeal(
    dealId: string,
    city: string = 'Atlanta',
    state: string = 'GA',
    opts: { strict?: boolean } = {}
  ): Promise<CorrelationReport & { adjustmentsPersisted: number }> {
    const strict = opts.strict !== false;
    const report = await this.computeCorrelations(city, state);
    const { persistCorrelationsForDeal } = await import('./correlation-adjustments.service');
    try {
      const { persisted } = await persistCorrelationsForDeal(
        dealId,
        report.correlations.map((c) => ({
          id: c.id,
          name: c.name ?? undefined,
          signal: c.signal,
          confidence: c.confidence,
          leadTime: (c as any).leadTime,
        }))
      );
      return { ...report, adjustmentsPersisted: persisted };
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[correlationEngine] persist for deal ${dealId} failed: ${err?.message}`);
      if (strict) {
        throw new Error(`Persist correlation adjustments failed for deal ${dealId}: ${err?.message}`);
      }
      return { ...report, adjustmentsPersisted: 0 };
    }
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

      // Append to correlation_history (Task #919) — append-only, one row per calendar day per pair
      await this.pool.query(
        `INSERT INTO correlation_history
         (metric_a, metric_b, geography_type, geography_id, window_months, correlation_r, p_value, sample_size, observation_start, observation_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date)
         DO NOTHING`,
        [metricA, metricB, geographyType, geographyId, windowMonths, correlation.r, pValue, n, obsStart, obsEnd]
      ).catch(err => {
        // Non-fatal: table may not exist yet (migration pending)
        logger.warn(`correlation_history insert skipped: ${String(err?.message ?? err)}`);
      });

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

          // Append aggregated correlation to correlation_history (Task #919)
          await this.pool.query(
            `INSERT INTO correlation_history
             (metric_a, metric_b, geography_type, geography_id, window_months, correlation_r, p_value, sample_size, observation_start, observation_end)
             VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date)
             DO NOTHING`,
            [mA, mB, scope, windowMonths, parseFloat(agg.avg_r), parseFloat(agg.avg_p), parseInt(agg.total_samples), agg.obs_start, agg.obs_end]
          ).catch((err: unknown) => {
            logger.warn(`correlation_history aggregated insert skipped: ${String((err as any)?.message ?? err)}`);
          });
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

  private async computeCOR21(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-21',
      name: 'Permit Volume → Rent Growth (18mo lag)',
      tier: 3,
      category: 'Supply & Demand Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '18 months',
      actionable: null,
      dataSources: ['Apartment Supply Pipeline'],
      missingData: [],
    };
    try {
      // Step 1 (X): permit units delivered 18+ months ago (the lagged supply shock)
      interface LagRow { lag_units: string; lag_count: string }
      const lagRes = await this.pool.query<LagRow>(
        `SELECT COALESCE(SUM(units_delivering), 0) AS lag_units,
                COUNT(*) AS lag_count
         FROM apartment_supply_pipeline
         WHERE city ILIKE $1
           AND available_date IS NOT NULL
           AND available_date <= NOW() - INTERVAL '18 months'`,
        [city]
      );
      const lagCount = parseInt(lagRes.rows[0]?.lag_count ?? '0', 10);
      if (lagCount === 0) {
        base.missingData.push('apartment_supply_pipeline: no deliveries with available_date ≥18mo ago for city');
        base.missingData.push('costar_market_metrics.avg_asking_rent required for yValue (rent growth) — table not yet populated');
        return base;
      }
      const lagUnits = parseInt(lagRes.rows[0].lag_units, 10);
      base.xValue = lagUnits;

      // Step 2 (Y): current effective rent growth from costar_market_metrics
      // per spec: yValue = costar_market_metrics.avg_asking_rent time-delta
      interface RentRow { current_rent: string; prior_rent: string }
      let rentGrowthPct: number | null = null;
      try {
        const cmRes = await this.pool.query<RentRow>(
          `SELECT
             FIRST_VALUE(avg_asking_rent) OVER (ORDER BY as_of_date DESC) AS current_rent,
             FIRST_VALUE(avg_asking_rent) OVER (ORDER BY as_of_date ASC)  AS prior_rent
           FROM costar_market_metrics
           WHERE LOWER(geography_name) LIKE LOWER($1)
             AND avg_asking_rent IS NOT NULL
           LIMIT 1`,
          [`%${city}%`]
        );
        if (cmRes.rows.length > 0) {
          const cur = parseFloat(cmRes.rows[0].current_rent);
          const prior = parseFloat(cmRes.rows[0].prior_rent);
          if (prior > 0) rentGrowthPct = parseFloat(((cur - prior) / prior * 100).toFixed(1));
        }
      } catch { /* costar_market_metrics not present */ }

      if (rentGrowthPct === null) {
        base.missingData.push('costar_market_metrics.avg_asking_rent not populated — cannot compute rent growth yValue; confidence insufficient');
        return base;
      }

      base.yValue = rentGrowthPct;
      base.correlation = this.estimateCorrelation(lagUnits / 2000, rentGrowthPct / 10);
      if (lagUnits > 2000 && rentGrowthPct < 2) {
        base.signal = 'bearish';
        base.confidence = 'medium';
        base.actionable = `${lagUnits.toLocaleString()} units delivered 18mo ago; current rent growth ${rentGrowthPct}% — supply delivered and rent growth slowing, consistent with lag pattern.`;
      } else if (lagUnits < 500 && rentGrowthPct > 3) {
        base.signal = 'bullish';
        base.confidence = 'medium';
        base.actionable = `Light delivery ${lagUnits.toLocaleString()} units 18mo ago; rent growth ${rentGrowthPct}% — supply constrained environment driving rent appreciation.`;
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `${lagUnits.toLocaleString()} units delivered 18mo ago; rent growth ${rentGrowthPct}% — mixed supply/rent signal.`;
      }
      return base;
    } catch {
      base.missingData.push('apartment_supply_pipeline or rent query failed');
      return base;
    }
  }

  private async computeCOR22(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-22',
      name: 'Job Growth → Absorption (6mo lag)',
      tier: 2,
      category: 'Macro & Employment Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6 months',
      actionable: null,
      dataSources: ['Market Snapshots'],
      missingData: [],
    };
    try {
      // 6-month lag: pair oldest row's job_growth_yoy (X) with newest row's net_absorption_units (Y)
      // Try costar_market_metrics first (per spec); fall back to market_snapshots
      interface SnapRow { job_growth_yoy: string; net_absorption_units: string; snapshot_date: string }
      let snapRows: SnapRow[] = [];
      let sourceTable = 'costar_market_metrics';
      try {
        const costarRes = await this.pool.query<SnapRow>(
          `SELECT job_growth_yoy, net_absorption_units, as_of_date AS snapshot_date
           FROM costar_market_metrics
           WHERE LOWER(geography_name) LIKE LOWER($1)
             AND job_growth_yoy IS NOT NULL
             AND net_absorption_units IS NOT NULL
           ORDER BY as_of_date ASC`,
          [`%${city}%`]
        );
        snapRows = costarRes.rows;
      } catch {
        // costar_market_metrics not yet present; fall back to market_snapshots
      }
      if (snapRows.length < 2) {
        if (sourceTable === 'costar_market_metrics') {
          base.missingData.push('costar_market_metrics (job_growth_yoy / net_absorption_units) not yet populated — falling back to market_snapshots');
          sourceTable = 'market_snapshots';
        }
        const snapRes = await this.pool.query<SnapRow>(
          `SELECT job_growth_yoy, net_absorption_units, snapshot_date
           FROM market_snapshots
           WHERE LOWER(geography_name) LIKE LOWER($1)
             AND job_growth_yoy IS NOT NULL
             AND net_absorption_units IS NOT NULL
           ORDER BY snapshot_date ASC`,
          [`%${city}%`]
        );
        snapRows = snapRes.rows;
      }
      if (snapRows.length < 2) {
        base.missingData.push(`${sourceTable}: insufficient rows with job_growth_yoy and net_absorption_units for ${city} (need 2+ rows ≥6mo apart)`);
        return base;
      }

      // Explicit 6-month aligned lag: find the most recent row (currentRow), then find the row
      // whose snapshot_date is closest to 6 months before currentRow's date.
      // This enforces the true 6-month lead-lag window, not just oldest-vs-newest.
      const currentRow = snapRows[snapRows.length - 1];
      const currentDate = new Date(currentRow.snapshot_date);
      const targetLagDate = new Date(currentDate);
      targetLagDate.setMonth(targetLagDate.getMonth() - 6);

      let lagRow = snapRows[0];
      let bestDist = Infinity;
      for (const row of snapRows) {
        const d = new Date(row.snapshot_date);
        if (d >= currentDate) continue; // only consider prior snapshots
        const dist = Math.abs(d.getTime() - targetLagDate.getTime());
        if (dist < bestDist) { bestDist = dist; lagRow = row; }
      }

      const lagDate = new Date(lagRow.snapshot_date);
      const monthsApart = (currentDate.getFullYear() - lagDate.getFullYear()) * 12
        + (currentDate.getMonth() - lagDate.getMonth());

      if (monthsApart < 6) {
        base.missingData.push(`No snapshot ≥6 months before most recent ${currentDate.toISOString().slice(0, 7)} — best available lag is ${monthsApart}mo; confidence insufficient for valid 6mo window`);
        return base;
      }

      const jobGrowth = parseFloat(lagRow.job_growth_yoy);
      const currentAbsorption = parseInt(currentRow.net_absorption_units, 10);
      base.xValue = parseFloat((jobGrowth * 100).toFixed(2));
      base.yValue = currentAbsorption;
      base.correlation = this.estimateCorrelation(jobGrowth, currentAbsorption / 1000);
      const lagLabel = `${monthsApart}mo lag`;
      if (jobGrowth > 0.02 && currentAbsorption > 0) {
        base.signal = 'bullish';
        base.confidence = 'medium';
        base.actionable = `Job growth ${(jobGrowth * 100).toFixed(1)}% YoY (${lagLabel}) → +${currentAbsorption.toLocaleString()} net units absorbed — demand confirmation.`;
      } else if (jobGrowth < 0 || currentAbsorption < 0) {
        base.signal = 'bearish';
        base.confidence = 'medium';
        base.actionable = `Job contraction ${(jobGrowth * 100).toFixed(1)}% YoY (${lagLabel}) → ${currentAbsorption.toLocaleString()} net absorption — demand weakening.`;
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `Job growth ${(jobGrowth * 100).toFixed(1)}% YoY (${lagLabel}) — absorption flat; monitor next quarter.`;
      }
      return base;
    } catch {
      base.missingData.push('market_snapshots query failed');
      return base;
    }
  }

  private async computeCOR23(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-23',
      name: 'Transit Proximity → Rent Premium',
      tier: 3,
      category: 'Spatial Value Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: 'Concurrent',
      actionable: null,
      dataSources: ['Property Proximity'],
      missingData: [],
    };
    try {
      // X = avg transit_score; Y = rent premium of high-transit vs low-transit submarkets
      // Source: market_snapshots (avg_transit_score + avg_effective_rent by submarket)
      interface SnapTransitRow {
        avg_transit_score: string;
        avg_effective_rent: string;
        cnt: string;
      }
      const snapRes = await this.pool.query<SnapTransitRow>(
        `SELECT ROUND(AVG(avg_transit_score)::numeric, 1) AS avg_transit_score,
                ROUND(AVG(avg_effective_rent)::numeric, 0) AS avg_effective_rent,
                COUNT(*) AS cnt
         FROM market_snapshots
         WHERE LOWER(geography_name) LIKE LOWER($1)
           AND avg_transit_score IS NOT NULL
           AND avg_effective_rent IS NOT NULL
           AND snapshot_date >= NOW() - INTERVAL '12 months'`,
        [`%${city}%`]
      );
      const snapCount = parseInt(snapRes.rows[0]?.cnt ?? '0', 10);

      // Fallback: property_proximity transit_score + market_snapshots city-level rent baseline
      interface PpRow { avg_transit: string; cnt: string }
      const ppRes = await this.pool.query<PpRow>(
        `SELECT ROUND(AVG(transit_score)::numeric, 1) AS avg_transit, COUNT(*) AS cnt
         FROM property_proximity WHERE city ILIKE $1 AND transit_score IS NOT NULL`,
        [city]
      );
      const ppCount = parseInt(ppRes.rows[0]?.cnt ?? '0', 10);

      if (snapCount === 0 && ppCount === 0) {
        base.missingData.push('market_snapshots: avg_transit_score + avg_effective_rent not populated for city');
        base.missingData.push('property_proximity: transit_score rows absent for city');
        return base;
      }

      let avgTransit: number;
      let premiumPct: number | null = null;

      if (snapCount >= 2) {
        // Compute premium: high-transit (score ≥50) vs low-transit (<50) submarket rents
        interface PremiumRow { high_rent: string; low_rent: string; high_cnt: string; low_cnt: string }
        const premRes = await this.pool.query<PremiumRow>(
          `SELECT
             AVG(avg_effective_rent) FILTER (WHERE avg_transit_score >= 50) AS high_rent,
             AVG(avg_effective_rent) FILTER (WHERE avg_transit_score < 50)  AS low_rent,
             COUNT(*) FILTER (WHERE avg_transit_score >= 50) AS high_cnt,
             COUNT(*) FILTER (WHERE avg_transit_score < 50)  AS low_cnt
           FROM market_snapshots
           WHERE LOWER(geography_name) LIKE LOWER($1)
             AND avg_transit_score IS NOT NULL
             AND avg_effective_rent IS NOT NULL
             AND snapshot_date >= NOW() - INTERVAL '12 months'`,
          [`%${city}%`]
        );
        const highRent = parseFloat(premRes.rows[0]?.high_rent ?? 'NaN');
        const lowRent  = parseFloat(premRes.rows[0]?.low_rent  ?? 'NaN');
        if (!isNaN(highRent) && !isNaN(lowRent) && lowRent > 0) {
          premiumPct = parseFloat(((highRent - lowRent) / lowRent).toFixed(4));
        }
        avgTransit = parseFloat(snapRes.rows[0].avg_transit_score);
      } else {
        avgTransit = ppCount > 0 ? parseFloat(ppRes.rows[0].avg_transit) : 0;
        base.missingData.push('Insufficient submarket rows in market_snapshots to compute high/low transit rent split — premium estimate unavailable');
      }

      base.xValue = parseFloat(avgTransit.toFixed(1));
      if (premiumPct !== null) {
        base.yValue = parseFloat((premiumPct * 100).toFixed(2));
        base.correlation = this.estimateCorrelation(avgTransit / 100, premiumPct);
        if (premiumPct > 0.05) {
          base.signal = 'bullish';
          base.confidence = 'medium';
          base.actionable = `High-transit submarkets command +${(premiumPct * 100).toFixed(1)}% rent premium vs low-transit at avg transit score ${avgTransit.toFixed(0)}.`;
        } else if (premiumPct < 0) {
          base.signal = 'bearish';
          base.confidence = 'low';
          base.actionable = `High-transit submarkets show negative rent premium (${(premiumPct * 100).toFixed(1)}%) — transit advantage not reflected in rents.`;
        } else {
          base.signal = 'neutral';
          base.confidence = 'low';
          base.actionable = `Minimal transit rent premium (${(premiumPct * 100).toFixed(1)}%) at avg score ${avgTransit.toFixed(0)}.`;
        }
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `Avg transit score ${avgTransit.toFixed(0)} — insufficient submarket data to compute rent premium split.`;
      }
      return base;
    } catch {
      base.missingData.push('market_snapshots / property_proximity transit query failed');
      return base;
    }
  }

  private async computeCOR24(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-24',
      name: 'Crime Rate → Occupancy',
      tier: 3,
      category: 'Spatial Value Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: 'Concurrent',
      actionable: null,
      dataSources: ['Property Proximity', 'Market Snapshots'],
      missingData: [],
    };
    try {
      interface CrimeRow { avg_crime: string; row_count: string }
      const crimeRes = await this.pool.query<CrimeRow>(
        `SELECT AVG(crime_index) AS avg_crime, COUNT(*) AS row_count
         FROM property_proximity
         WHERE city ILIKE $1 AND crime_index IS NOT NULL`,
        [city]
      );
      const rowCount = parseInt(crimeRes.rows[0]?.row_count ?? '0', 10);
      const avgCrime = parseFloat(crimeRes.rows[0]?.avg_crime ?? 'NaN');
      if (rowCount === 0 || isNaN(avgCrime)) {
        base.missingData.push('property_proximity rows for city (crime_index)');
        return base;
      }
      interface OccRow { avg_occupancy_pct: string }
      const snapRes = await this.pool.query<OccRow>(
        `SELECT avg_occupancy_pct FROM market_snapshots
         WHERE LOWER(geography_name) LIKE LOWER($1) AND avg_occupancy_pct IS NOT NULL
         ORDER BY snapshot_date DESC LIMIT 1`,
        [`%${city}%`]
      );
      const occupancy = snapRes.rows[0]?.avg_occupancy_pct
        ? parseFloat(snapRes.rows[0].avg_occupancy_pct)
        : null;
      base.xValue = parseFloat(avgCrime.toFixed(1));
      base.yValue = occupancy !== null ? parseFloat((occupancy * 100).toFixed(1)) : null;
      if (occupancy !== null) {
        base.correlation = this.estimateCorrelation(-avgCrime / 100, occupancy);
      }
      if (avgCrime > 120) {
        base.signal = 'bearish';
        base.confidence = 'medium';
        base.actionable = `Avg crime index ${avgCrime.toFixed(0)} exceeds 120 threshold — underwrite 2-3pp higher vacancy${occupancy !== null ? `; current occupancy ${(occupancy * 100).toFixed(1)}%` : ''}.`;
      } else if (avgCrime < 80) {
        base.signal = 'bullish';
        base.confidence = 'medium';
        base.actionable = `Low crime index ${avgCrime.toFixed(0)} — safety premium supports occupancy${occupancy !== null ? ` (currently ${(occupancy * 100).toFixed(1)}%)` : ''}.`;
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `Crime index ${avgCrime.toFixed(0)} near city average — no material occupancy impact expected.`;
      }
      return base;
    } catch {
      base.missingData.push('property_proximity or market_snapshots query failed');
      return base;
    }
  }

  private async computeCOR25(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-25',
      name: 'New Grocery Opening → Rent Growth',
      tier: 3,
      category: 'Amenity Catalyst Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-18 months',
      actionable: null,
      dataSources: ['Points of Interest', 'Market Events'],
      missingData: [],
    };
    try {
      // Step 1 (X): grocery opening count from market_events, scoped to this city's MSA.
      // geography_type='submarket' events link to a submarket slug in geography_id.
      // We join to the submarkets table so we can later pull per-submarket rent (Y).
      interface GrocEvRow {
        event_id: string;
        geography_id: string;
        geography_type: string;
        positive: boolean;
      }
      const evRes = await this.pool.query<GrocEvRow>(
        `SELECT me.id AS event_id, me.geography_id, me.geography_type,
                (me.expected_impact_direction = 'positive') AS positive
         FROM market_events me
         WHERE me.event_type = 'grocery_opening'
           AND me.announced_date >= NOW() - INTERVAL '24 months'
           AND (
             (me.geography_type = 'msa' AND me.geography_id ILIKE $1)
             OR (me.geography_type = 'submarket' AND EXISTS (
               SELECT 1 FROM submarkets s
               JOIN msas m ON s.msa_id = m.id
               WHERE LOWER(s.name) ILIKE LOWER('%' || me.geography_id || '%')
                 AND m.name ILIKE $1
             ))
           )`,
        [`%${city}%`]
      );

      // Fallback: points_of_interest table (no submarket linkage — counts only)
      interface PoiRow { cnt: string }
      const poiRes = await this.pool.query<PoiRow>(
        `SELECT COUNT(*) AS cnt FROM points_of_interest
         WHERE (city ILIKE $1 OR county ILIKE $1)
           AND poi_type ILIKE '%grocery%'
           AND status = 'active'
           AND opened_date >= NOW() - INTERVAL '24 months'`,
        [`%${city}%`]
      );
      const poiCount = parseInt(poiRes.rows[0]?.cnt ?? '0', 10);
      const total = evRes.rows.length + poiCount;

      if (total === 0) {
        base.missingData.push('No grocery openings in market_events or points_of_interest in last 24mo');
        base.missingData.push('Submarket rent (yValue) requires at least 1 grocery opening event to anchor zip/submarket linkage');
        return base;
      }
      base.xValue = total;

      // Step 2 (Y): rent GROWTH in the submarket(s) affected by grocery openings.
      // Use market_snapshots.rent_growth_yoy scoped to the affected submarket geography_id(s).
      // This is the post-opening rent trend, not a static rent level.
      const subIds = evRes.rows
        .filter(r => r.geography_type === 'submarket')
        .map(r => r.geography_id);

      let rentGrowthYoy: number | null = null;
      let snapMatchCount = 0;

      if (subIds.length > 0) {
        interface SnapGrowthRow { avg_growth: string; matched: string }
        const snapGrowthRes = await this.pool.query<SnapGrowthRow>(
          `SELECT ROUND(AVG(ms.rent_growth_yoy)::numeric, 4) AS avg_growth,
                  COUNT(*) AS matched
           FROM market_snapshots ms
           WHERE ms.rent_growth_yoy IS NOT NULL
             AND ms.snapshot_date >= NOW() - INTERVAL '12 months'
             AND EXISTS (
               SELECT 1 FROM UNNEST($1::text[]) AS slug
               WHERE LOWER(ms.geography_id) ILIKE LOWER('%' || slug || '%')
                  OR LOWER(ms.geography_name) ILIKE LOWER('%' || slug || '%')
             )`,
          [subIds]
        );
        snapMatchCount = parseInt(snapGrowthRes.rows[0]?.matched ?? '0', 10);
        if (snapMatchCount > 0) rentGrowthYoy = parseFloat(snapGrowthRes.rows[0].avg_growth);
      }

      // Fall back to MSA-level rent_growth_yoy from market_snapshots only if no submarket match
      if (rentGrowthYoy === null) {
        interface MsaGrowthRow { avg_growth: string; cnt: string }
        const msaGrowthRes = await this.pool.query<MsaGrowthRow>(
          `SELECT ROUND(AVG(rent_growth_yoy)::numeric, 4) AS avg_growth, COUNT(*) AS cnt
           FROM market_snapshots
           WHERE rent_growth_yoy IS NOT NULL
             AND snapshot_date >= NOW() - INTERVAL '12 months'
             AND LOWER(geography_name) ILIKE LOWER($1)`,
          [`%${city}%`]
        );
        const msaCnt = parseInt(msaGrowthRes.rows[0]?.cnt ?? '0', 10);
        if (msaCnt > 0) {
          rentGrowthYoy = parseFloat(msaGrowthRes.rows[0].avg_growth);
          base.missingData.push('No market_snapshots matched affected submarket slugs — using MSA-level rent_growth_yoy; submarket slug linkage requires market_events.geography_id to match market_snapshots.geography_id');
        } else {
          base.missingData.push('market_snapshots.rent_growth_yoy unavailable for affected submarket(s) and MSA — costar_market_metrics not yet populated');
        }
      }

      if (rentGrowthYoy === null) {
        base.missingData.push('yValue (rent growth) insufficient — cannot compute grocery opening → rent growth correlation');
        return base;
      }

      base.yValue = parseFloat((rentGrowthYoy * 100).toFixed(2));
      const positiveCount = evRes.rows.filter(r => r.positive).length;
      base.correlation = this.estimateCorrelation(total, rentGrowthYoy * 10);
      const growthStr = `${(rentGrowthYoy * 100).toFixed(1)}%`;

      if (total >= 3 && positiveCount >= total * 0.7 && rentGrowthYoy > 0.02) {
        base.signal = 'bullish';
        base.confidence = snapMatchCount > 0 ? 'medium' : 'low';
        base.actionable = `${total} grocery opening(s) in last 24mo (${positiveCount} positive impact) — amenity catalyst; affected submarket YoY rent growth ${growthStr}, expected continued 6-18mo lift.`;
      } else if (total >= 2) {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `${total} grocery opening(s) (${positiveCount} positive) — modest amenity signal; submarket YoY rent growth ${growthStr}.`;
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `${total} grocery opening detected — isolated event; submarket YoY rent growth ${growthStr}.`;
      }
      return base;
    } catch {
      base.missingData.push('points_of_interest or market_events query failed');
      return base;
    }
  }

  private async computeCOR26(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-26',
      name: 'Employer HQ Move → Submarket Absorption',
      tier: 2,
      category: 'Macro & Employment Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-24 months',
      actionable: null,
      dataSources: ['Market Events'],
      missingData: [],
    };
    try {
      interface MoveRow {
        event_name: string;
        jobs_affected: string | null;
        expected_impact_direction: string | null;
        announced_date: string;
      }
      // Scope to the queried city's MSA via submarkets table to prevent cross-city contamination
      const res = await this.pool.query<MoveRow>(
        `SELECT me.event_name, me.jobs_affected, me.expected_impact_direction, me.announced_date
         FROM market_events me
         WHERE me.event_type = 'employer_move'
           AND me.announced_date >= NOW() - INTERVAL '36 months'
           AND (
             (me.geography_type = 'msa' AND me.geography_id ILIKE $1)
             OR (me.geography_type = 'submarket' AND EXISTS (
               SELECT 1 FROM submarkets s
               JOIN msas m ON s.msa_id = m.id
               WHERE LOWER(s.name) ILIKE LOWER('%' || me.geography_id || '%')
                 AND m.name ILIKE $1
             ))
           )
         ORDER BY COALESCE(me.jobs_affected::int, 0) DESC`,
        [`%${city}%`]
      );
      if (res.rows.length === 0) {
        base.missingData.push('No employer_move events in market_events in last 36 months');
        base.missingData.push('Pre/post absorption windows require employer_move events to anchor');
        return base;
      }
      const positiveCount = res.rows.filter(row => row.expected_impact_direction === 'positive').length;
      const netJobImpact = res.rows.reduce(
        (sum, row) => sum + (
          row.expected_impact_direction === 'positive'
            ? (row.jobs_affected !== null ? parseInt(row.jobs_affected, 10) : 0)
            : -(row.jobs_affected !== null ? parseInt(row.jobs_affected, 10) : 0)
        ),
        0
      );
      base.xValue = res.rows.length;

      // Attempt pre/post absorption comparison anchored to earliest announced_date
      // Try costar_market_metrics first, fall back to market_snapshots
      interface AbsRow { avg_absorption: string; row_count: string }
      const oldestEventDate = res.rows[res.rows.length - 1]?.announced_date;
      let preAbsorption: number | null = null;
      let postAbsorption: number | null = null;
      if (oldestEventDate) {
        let absRows: AbsRow[] = [];
        try {
          const [preCm, postCm] = await Promise.all([
            this.pool.query<AbsRow>(
              `SELECT ROUND(AVG(net_absorption_units)::numeric, 0) AS avg_absorption, COUNT(*) AS row_count
               FROM costar_market_metrics
               WHERE LOWER(geography_name) LIKE LOWER($1) AND as_of_date < $2`,
              [`%${city}%`, oldestEventDate]
            ),
            this.pool.query<AbsRow>(
              `SELECT ROUND(AVG(net_absorption_units)::numeric, 0) AS avg_absorption, COUNT(*) AS row_count
               FROM costar_market_metrics
               WHERE LOWER(geography_name) LIKE LOWER($1) AND as_of_date >= $2`,
              [`%${city}%`, oldestEventDate]
            ),
          ]);
          if (parseInt(preCm.rows[0]?.row_count ?? '0', 10) > 0 || parseInt(postCm.rows[0]?.row_count ?? '0', 10) > 0) {
            absRows = [preCm.rows[0], postCm.rows[0]];
            preAbsorption = parseFloat(preCm.rows[0]?.avg_absorption ?? 'NaN');
            postAbsorption = parseFloat(postCm.rows[0]?.avg_absorption ?? 'NaN');
          }
        } catch { /* costar_market_metrics not present */ }

        if (absRows.length === 0) {
          // Fall back to market_snapshots
          const [preSn, postSn] = await Promise.all([
            this.pool.query<AbsRow>(
              `SELECT ROUND(AVG(net_absorption_units)::numeric, 0) AS avg_absorption, COUNT(*) AS row_count
               FROM market_snapshots
               WHERE LOWER(geography_name) LIKE LOWER($1) AND snapshot_date < $2
                 AND net_absorption_units IS NOT NULL`,
              [`%${city}%`, oldestEventDate]
            ),
            this.pool.query<AbsRow>(
              `SELECT ROUND(AVG(net_absorption_units)::numeric, 0) AS avg_absorption, COUNT(*) AS row_count
               FROM market_snapshots
               WHERE LOWER(geography_name) LIKE LOWER($1) AND snapshot_date >= $2
                 AND net_absorption_units IS NOT NULL`,
              [`%${city}%`, oldestEventDate]
            ),
          ]);
          if (parseInt(preSn.rows[0]?.row_count ?? '0', 10) > 0 || parseInt(postSn.rows[0]?.row_count ?? '0', 10) > 0) {
            preAbsorption = parseFloat(preSn.rows[0]?.avg_absorption ?? 'NaN');
            postAbsorption = parseFloat(postSn.rows[0]?.avg_absorption ?? 'NaN');
          } else {
            base.missingData.push('Pre/post absorption: costar_market_metrics not available; market_snapshots has no net_absorption_units rows for city');
          }
        }
      }

      // Build yValue and signal
      const hasAbsorption = preAbsorption !== null && !isNaN(preAbsorption) && postAbsorption !== null && !isNaN(postAbsorption);
      if (hasAbsorption) {
        base.yValue = Math.round(postAbsorption! - preAbsorption!);
        base.correlation = this.estimateCorrelation(netJobImpact / 1000, base.yValue / 1000);
      } else {
        base.yValue = netJobImpact;
      }

      if (netJobImpact > 500 && (!hasAbsorption || (postAbsorption! - preAbsorption!) > 0)) {
        base.signal = 'bullish';
        base.confidence = hasAbsorption ? 'medium' : 'low';
        base.actionable = `${res.rows.length} employer move(s) in last 36mo — net +${netJobImpact.toLocaleString()} jobs${hasAbsorption ? `; absorption delta: ${Math.round(postAbsorption! - preAbsorption!).toLocaleString()} units pre→post move` : ''}.`;
      } else if (netJobImpact < -200 && (!hasAbsorption || (postAbsorption! - preAbsorption!) < 0)) {
        base.signal = 'bearish';
        base.confidence = hasAbsorption ? 'medium' : 'low';
        base.actionable = `${res.rows.length} employer move(s) with net ${netJobImpact.toLocaleString()} job loss${hasAbsorption ? `; absorption worsened ${Math.round(postAbsorption! - preAbsorption!).toLocaleString()} units` : ''}.`;
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `${res.rows.length} employer move event(s), ${positiveCount} positive — net job impact ${netJobImpact.toLocaleString()}; absorption effect unclear${hasAbsorption ? ` (absorption delta: ${Math.round(postAbsorption! - preAbsorption!).toLocaleString()})` : ''}.`;
      }
      return base;
    } catch {
      base.missingData.push('market_events employer_move query failed');
      return base;
    }
  }

  private async computeCOR27(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-27',
      name: 'Interest Rate → Cap Rate (3mo lag)',
      tier: 2,
      category: 'Macro & Employment Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3 months',
      actionable: null,
      dataSources: ['Market Snapshots', 'Macro Indicators', 'Market Sale Comps'],
      missingData: [],
    };
    try {
      // Per spec: xValue = interest rate (3mo lagged) from macro_indicators
      //           yValue = current avg_cap_rate from costar_market_metrics
      // macro_indicators table is not yet populated — xValue cannot be computed.
      // Without the interest rate X axis, the lead-lag correlation cannot be established.
      // Document both missing sources and return insufficient.
      interface MacroRow { indicator_value: string; indicator_date: string }
      let macroRate3mo: number | null = null;
      try {
        const macroRes = await this.pool.query<MacroRow>(
          `SELECT indicator_value, indicator_date
           FROM macro_indicators
           WHERE (indicator_name ILIKE '%fed%fund%'
               OR indicator_name ILIKE '%10yr%treasury%'
               OR indicator_name ILIKE '%interest%rate%')
             AND indicator_date <= NOW() - INTERVAL '3 months'
           ORDER BY indicator_date DESC
           LIMIT 1`
        );
        if (macroRes.rows.length > 0) macroRate3mo = parseFloat(macroRes.rows[0].indicator_value);
      } catch { /* macro_indicators does not exist */ }

      if (macroRate3mo === null) {
        base.missingData.push('macro_indicators: table not yet populated — 3-month lagged interest rate (xValue) cannot be computed; confidence insufficient');
      }

      // yValue: costar_market_metrics.avg_cap_rate (primary per spec); fall back to market_snapshots
      interface CostarCapRow { avg_cap_rate: string; period_date: string }
      let currentCap: number | null = null;
      try {
        const costarRes = await this.pool.query<CostarCapRow>(
          `SELECT avg_cap_rate, as_of_date
           FROM costar_market_metrics
           WHERE LOWER(geography_name) LIKE LOWER($1)
             AND avg_cap_rate IS NOT NULL
           ORDER BY as_of_date DESC
           LIMIT 1`,
          [`%${city}%`]
        );
        if (costarRes.rows.length > 0) currentCap = parseFloat(costarRes.rows[0].avg_cap_rate);
      } catch { /* costar_market_metrics does not exist */ }

      if (currentCap === null) {
        base.missingData.push('costar_market_metrics.avg_cap_rate not populated — trying market_snapshots.avg_cap_rate');
        interface SnapCapRow { avg_cap_rate: string }
        const snapRes = await this.pool.query<SnapCapRow>(
          `SELECT avg_cap_rate FROM market_snapshots
           WHERE avg_cap_rate IS NOT NULL
             AND LOWER(geography_name) LIKE LOWER($1)
           ORDER BY snapshot_date DESC LIMIT 1`,
          [`%${city}%`]
        );
        if (snapRes.rows.length > 0) currentCap = parseFloat(snapRes.rows[0].avg_cap_rate);
        else base.missingData.push('market_snapshots.avg_cap_rate also unavailable for this city');
      }

      // Without the lagged interest rate (X), the correlation cannot be established per spec.
      if (macroRate3mo === null) {
        // Record yValue for informational purposes if available, but return insufficient
        if (currentCap !== null) base.yValue = parseFloat((currentCap * 100).toFixed(2));
        return base;
      }

      // Both X and Y available — compute signal
      base.xValue = macroRate3mo;
      if (currentCap !== null) {
        base.yValue = parseFloat((currentCap * 100).toFixed(2));
        base.correlation = this.estimateCorrelation(macroRate3mo / 10, currentCap);
        if (macroRate3mo > 5.0 && currentCap > 0.055) {
          base.signal = 'bearish';
          base.confidence = 'medium';
          base.actionable = `Interest rate ${macroRate3mo.toFixed(2)}% (3mo lag) → cap rate ${(currentCap * 100).toFixed(2)}% — elevated rate environment confirmed in expanded cap rates, bearish for values.`;
        } else if (macroRate3mo < 3.5 && currentCap < 0.05) {
          base.signal = 'bullish';
          base.confidence = 'medium';
          base.actionable = `Interest rate ${macroRate3mo.toFixed(2)}% (3mo lag) → cap rate ${(currentCap * 100).toFixed(2)}% — accommodative rates supporting cap rate compression, bullish for values.`;
        } else {
          base.signal = 'neutral';
          base.confidence = 'low';
          base.actionable = `Interest rate ${macroRate3mo.toFixed(2)}% (3mo lag) → cap rate ${(currentCap * 100).toFixed(2)}% — no clear directional rate/cap correlation.`;
        }
      }
      return base;
    } catch {
      base.missingData.push('macro_indicators / costar_market_metrics cap rate query failed');
      return base;
    }
  }

  private async computeCOR28(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-28',
      name: 'Historical Sale Price/SF → Current Asking',
      tier: 2,
      category: 'Valuation Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: 'Concurrent',
      actionable: null,
      dataSources: ['Market Sale Comps', 'Deals'],
      missingData: [],
    };
    try {
      // Resolve state for city using msas table to avoid hardcoded state assumptions
      interface StateRow { state: string }
      let marketState: string | null = null;
      const stateRes = await this.pool.query<StateRow>(
        `SELECT UPPER(state) AS state FROM msas WHERE name ILIKE $1 AND state IS NOT NULL LIMIT 1`,
        [`%${city}%`]
      );
      if (stateRes.rows.length > 0) marketState = stateRes.rows[0].state;

      // 8-quarter trailing avg price/SF from market_sale_comps — scoped by city then state
      interface HistRow { trailing_avg_psf: string; comp_count: string }
      let histRes;
      if (marketState) {
        histRes = await this.pool.query<HistRow>(
          `SELECT AVG(price_per_sqft) AS trailing_avg_psf, COUNT(*) AS comp_count
           FROM market_sale_comps
           WHERE sale_date >= NOW() - INTERVAL '24 months'
             AND price_per_sqft IS NOT NULL
             AND (city ILIKE $1 OR state = $2)`,
          [`%${city}%`, marketState]
        );
      } else {
        histRes = await this.pool.query<HistRow>(
          `SELECT AVG(price_per_sqft) AS trailing_avg_psf, COUNT(*) AS comp_count
           FROM market_sale_comps
           WHERE sale_date >= NOW() - INTERVAL '24 months'
             AND price_per_sqft IS NOT NULL
             AND city ILIKE $1`,
          [`%${city}%`]
        );
      }
      const compCount = parseInt(histRes.rows[0]?.comp_count ?? '0', 10);
      if (compCount < 3) {
        base.missingData.push(`Insufficient market_sale_comps for ${city}${marketState ? '/' + marketState : ''} (need 3+ with price_per_sqft in last 24mo)`);
        return base;
      }
      const trailingAvg = parseFloat(histRes.rows[0].trailing_avg_psf);
      base.xValue = parseFloat(trailingAvg.toFixed(0));

      // Attempt to fetch current deal asking price/SF from deals + deal_assumptions.
      // Uses budget (total acquisition budget from deals) / gross_sf (from deal_assumptions)
      // as the closest available proxy for underwriting asking price/SF.
      interface DealAskRow { asking_psf: string; deal_name: string }
      const dealAskRes = await this.pool.query<DealAskRow>(
        `SELECT ROUND((d.budget / NULLIF(da.gross_sf, 0))::numeric, 0) AS asking_psf,
                d.name AS deal_name
         FROM deals d
         JOIN deal_assumptions da ON da.deal_id = d.id
         WHERE LOWER(d.city) = LOWER($1)
           AND d.budget IS NOT NULL
           AND d.budget > 0
           AND da.gross_sf IS NOT NULL
           AND da.gross_sf > 0
         ORDER BY d.updated_at DESC NULLS LAST
         LIMIT 1`,
        [city]
      );

      let compareValue: number | null = null;
      let compareLabel = '';

      if (dealAskRes.rows.length > 0) {
        compareValue = parseFloat(dealAskRes.rows[0].asking_psf);
        compareLabel = `deal asking "${dealAskRes.rows[0].deal_name}"`;
      } else {
        // No deal asking price available — fall back to recent market clearing (6mo avg)
        base.missingData.push(`No deal with asking_price + gross_sf found for ${city} — compare uses 6mo market clearing instead of underwriting asking price`);
        interface RecentRow { recent_avg_psf: string; recent_count: string }
        const recentRes = marketState
          ? await this.pool.query<RecentRow>(
              `SELECT AVG(price_per_sqft) AS recent_avg_psf, COUNT(*) AS recent_count
               FROM market_sale_comps
               WHERE sale_date >= NOW() - INTERVAL '6 months'
                 AND price_per_sqft IS NOT NULL
                 AND (city ILIKE $1 OR state = $2)`,
              [`%${city}%`, marketState]
            )
          : await this.pool.query<RecentRow>(
              `SELECT AVG(price_per_sqft) AS recent_avg_psf, COUNT(*) AS recent_count
               FROM market_sale_comps
               WHERE sale_date >= NOW() - INTERVAL '6 months'
                 AND price_per_sqft IS NOT NULL
                 AND city ILIKE $1`,
              [`%${city}%`]
            );
        const recentCount = parseInt(recentRes.rows[0]?.recent_count ?? '0', 10);
        if (recentCount >= 1) {
          compareValue = parseFloat(recentRes.rows[0].recent_avg_psf);
          compareLabel = '6mo market clearing avg';
        }
      }

      base.yValue = compareValue !== null ? parseFloat(compareValue.toFixed(0)) : null;

      if (compareValue !== null) {
        const spread = (compareValue - trailingAvg) / trailingAvg;
        base.correlation = this.estimateCorrelation(trailingAvg / 500, compareValue / 500);
        if (spread > 0.10) {
          base.signal = 'bearish';
          base.confidence = dealAskRes.rows.length > 0 ? 'high' : 'medium';
          base.actionable = `${compareLabel} $${compareValue.toFixed(0)}/SF is ${(spread * 100).toFixed(1)}% above 8-quarter clearing avg $${trailingAvg.toFixed(0)}/SF — pricing above historical clearing; cap rate compression risk.`;
        } else if (spread < -0.10) {
          base.signal = 'bullish';
          base.confidence = dealAskRes.rows.length > 0 ? 'high' : 'medium';
          base.actionable = `${compareLabel} $${compareValue.toFixed(0)}/SF is ${Math.abs(spread * 100).toFixed(1)}% below 8-quarter clearing avg $${trailingAvg.toFixed(0)}/SF — acquiring below historical clearing price.`;
        } else {
          base.signal = 'neutral';
          base.confidence = dealAskRes.rows.length > 0 ? 'high' : 'medium';
          base.actionable = `${compareLabel} $${compareValue.toFixed(0)}/SF within ±10% of 8-quarter avg $${trailingAvg.toFixed(0)}/SF — market at historical clearing price.`;
        }
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `8-quarter avg price/SF: $${trailingAvg.toFixed(0)} (${compCount} comps); no deal asking price or recent trades to compare.`;
        base.missingData.push('No 6mo recent comps available for market clearing comparison');
      }
      return base;
    } catch {
      base.missingData.push('market_sale_comps or deals query failed');
      return base;
    }
  }

  private async computeCOR29(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-29',
      name: 'Concession Rate → Future Vacancy',
      tier: 2,
      category: 'Supply & Demand Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6 months',
      actionable: null,
      dataSources: ['Market Snapshots'],
      missingData: [],
    };
    try {
      // Need at least 2 rows ≥6 months apart to compute lead-lag: older row concession → newer row vacancy
      interface SnapRow { concession_rate: string; vacancy_rate: string | null; snapshot_date: string }
      const res = await this.pool.query<SnapRow>(
        `SELECT properties_offering_concessions_pct AS concession_rate,
                vacancy_rate,
                snapshot_date
         FROM market_snapshots
         WHERE LOWER(geography_name) LIKE LOWER($1)
           AND properties_offering_concessions_pct IS NOT NULL
         ORDER BY snapshot_date ASC`,
        [`%${city}%`]
      );
      if (res.rows.length < 2) {
        base.missingData.push('market_snapshots with properties_offering_concessions_pct (need 2+ rows for 6mo lag)');
        return base;
      }

      // Explicit 6-month aligned lag: find most recent snapshot (currentRow), then find the snapshot
      // whose date is closest to 6 months before currentRow — not just the oldest row.
      const currentRow = res.rows[res.rows.length - 1];
      const currentDate = new Date(currentRow.snapshot_date);
      const target6mo = new Date(currentDate);
      target6mo.setMonth(target6mo.getMonth() - 6);

      let lagRow = res.rows[0];
      let bestDist = Infinity;
      for (const row of res.rows) {
        const d = new Date(row.snapshot_date);
        if (d >= currentDate) continue;
        const dist = Math.abs(d.getTime() - target6mo.getTime());
        if (dist < bestDist) { bestDist = dist; lagRow = row; }
      }

      const lagDate = new Date(lagRow.snapshot_date);
      const monthsApart = (currentDate.getFullYear() - lagDate.getFullYear()) * 12
        + (currentDate.getMonth() - lagDate.getMonth());

      if (monthsApart < 6) {
        base.missingData.push(`No snapshot ≥6 months before most recent ${currentDate.toISOString().slice(0, 7)} — best available lag is ${monthsApart}mo; confidence insufficient for valid 6mo window`);
        return base;
      }

      const concessionRateLag = parseFloat(lagRow.concession_rate);
      const currentVacancy = currentRow.vacancy_rate ? parseFloat(currentRow.vacancy_rate) : null;
      base.xValue = parseFloat((concessionRateLag * 100).toFixed(1));
      base.yValue = currentVacancy !== null ? parseFloat((currentVacancy * 100).toFixed(1)) : null;
      base.correlation = currentVacancy !== null
        ? this.estimateCorrelation(concessionRateLag, currentVacancy)
        : null;
      const lagLabel = `${monthsApart}mo lag`;
      if (concessionRateLag > 0.30) {
        base.signal = 'bearish';
        base.confidence = 'medium';
        base.actionable = `Prior concession rate ${(concessionRateLag * 100).toFixed(0)}% >30% threshold (${lagLabel}) — leading indicator of elevated vacancy over next 6 months.`;
      } else if (concessionRateLag < 0.10) {
        base.signal = 'bullish';
        base.confidence = 'medium';
        base.actionable = `Low historical concession rate ${(concessionRateLag * 100).toFixed(0)}% (${lagLabel}) — tight market signals vacancy remains suppressed.`;
      } else {
        base.signal = 'neutral';
        base.confidence = 'low';
        base.actionable = `Concession rate ${(concessionRateLag * 100).toFixed(0)}% (${lagLabel}) — no outsized future vacancy signal.`;
      }
      return base;
    } catch {
      base.missingData.push('market_snapshots concession_rate query failed');
      return base;
    }
  }

  private async computeCOR30(city: string): Promise<CorrelationResult> {
    const base: CorrelationResult = {
      id: 'COR-30',
      name: 'Renovation Permits → Rent Growth',
      tier: 3,
      category: 'Supply & Demand Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '12-24 months',
      actionable: null,
      dataSources: ['Apartment Supply Pipeline', 'Market Sale Comps', 'Submarkets'],
      missingData: [],
    };
    try {
      // Per spec: xValue = renovation permit count (permit_type = 'renovation') from apartment_supply_pipeline
      //           yValue = subsequent rent_growth_yoy in the same submarket (12-24mo lag)
      // apartment_supply_pipeline schema does not have a permit_type column (only name, city, state,
      // total_units, property_class, available_date, units_delivering). Keyword heuristics on project
      // names are not an acceptable substitute — they produce false positives and cannot be validated.
      // Market_sale_comps below-market price proxy is not a permit signal.
      // Without proper permit_type classification, xValue cannot be computed.
      interface PipelineSchemaRow { has_permit_type: boolean }
      let hasPipelinePermitType = false;
      try {
        const schemaRes = await this.pool.query<PipelineSchemaRow>(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_name = 'apartment_supply_pipeline'
               AND column_name = 'permit_type'
           ) AS has_permit_type`
        );
        hasPipelinePermitType = schemaRes.rows[0]?.has_permit_type ?? false;
      } catch { /* schema check failed */ }

      if (!hasPipelinePermitType) {
        base.missingData.push('apartment_supply_pipeline schema lacks permit_type column — renovation permits cannot be isolated from new-construction pipeline without this field; xValue insufficient');
        base.missingData.push('costar_market_metrics or dedicated permit feed required to compute renovation permit count (xValue)');
      }

      // yValue: market_snapshots.rent_growth_yoy scoped to city (12-24mo lagged rent growth)
      interface RentGrowthRow { rent_growth_yoy: string; snapshot_date: string; cnt: string }
      const rentGrowthRes = await this.pool.query<RentGrowthRow>(
        `SELECT ROUND(AVG(rent_growth_yoy)::numeric, 4) AS rent_growth_yoy,
                MAX(snapshot_date) AS snapshot_date,
                COUNT(*) AS cnt
         FROM market_snapshots
         WHERE rent_growth_yoy IS NOT NULL
           AND LOWER(geography_name) ILIKE LOWER($1)
           AND snapshot_date >= NOW() - INTERVAL '24 months'`,
        [`%${city}%`]
      );
      const rentGrowthCnt = parseInt(rentGrowthRes.rows[0]?.cnt ?? '0', 10);
      const rentGrowthYoy = rentGrowthCnt > 0 ? parseFloat(rentGrowthRes.rows[0].rent_growth_yoy) : null;

      if (rentGrowthYoy !== null) {
        base.yValue = parseFloat((rentGrowthYoy * 100).toFixed(2));
      } else {
        base.missingData.push('market_snapshots.rent_growth_yoy unavailable for this city — costar_market_metrics not yet populated');
      }

      // Cannot compute correlation without renovation permit xValue
      if (!hasPipelinePermitType) return base;

      // When permit_type column exists, query renovation permits
      interface RenovRow { renov_count: string; renov_units: string }
      const renovRes = await this.pool.query<RenovRow>(
        `SELECT COUNT(*) AS renov_count, COALESCE(SUM(units_delivering), 0) AS renov_units
         FROM apartment_supply_pipeline
         WHERE city ILIKE $1
           AND permit_type ILIKE '%renovat%'
           AND available_date >= NOW() - INTERVAL '36 months'`,
        [city]
      );
      const renovCount = parseInt(renovRes.rows[0]?.renov_count ?? '0', 10);
      const renovUnits = parseInt(renovRes.rows[0]?.renov_units ?? '0', 10);

      if (renovCount === 0) {
        base.missingData.push('No renovation permits in apartment_supply_pipeline for this city in last 36mo');
        return base;
      }

      base.xValue = renovCount;
      if (rentGrowthYoy !== null) {
        base.correlation = this.estimateCorrelation(renovUnits / 500, rentGrowthYoy * 10);
        if (renovUnits > 500 && rentGrowthYoy > 0.02) {
          base.signal = 'bullish';
          base.confidence = 'medium';
          base.actionable = `${renovUnits.toLocaleString()} renovation units in pipeline — quality improvement signal correlated with ${(rentGrowthYoy * 100).toFixed(1)}% YoY rent growth; 12-24mo catalyst expected.`;
        } else if (renovCount >= 3) {
          base.signal = 'neutral';
          base.confidence = 'low';
          base.actionable = `${renovCount} renovation permit(s), ${renovUnits.toLocaleString()} units — moderate activity; rent growth ${rentGrowthYoy !== null ? (rentGrowthYoy * 100).toFixed(1) + '%' : 'N/A'} YoY.`;
        } else {
          base.signal = 'neutral';
          base.confidence = 'low';
          base.actionable = `${renovCount} renovation permit(s) detected — insufficient volume for directional forecast.`;
        }
      }
      return base;
    } catch {
      base.missingData.push('apartment_supply_pipeline renovation permit query failed');
      return base;
    }
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

  // ── Task #919: Historical As-Of Correlation Compute ────────────────────────

  /**
   * Computes Pearson correlation for a metric pair using data up to (and including)
   * `asOfDate`. Only appends to `correlation_history` — does NOT overwrite
   * `metric_correlations`. Used for deep historical backfill.
   */
  private async computePairCorrelationAsOf(
    rawMetricA: string,
    rawMetricB: string,
    geographyType: string,
    geographyId: string,
    windowMonths: number,
    asOfDate: Date
  ): Promise<boolean> {
    const [metricA, metricB] = [rawMetricA, rawMetricB].sort();
    const dateStr = asOfDate.toISOString().slice(0, 10);
    try {
      const dataRes = await this.pool.query(
        `WITH ts_a AS (
           SELECT period_date, value as val_a
           FROM metric_time_series
           WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
             AND period_date <= $5::date
             AND period_date >= ($5::date - INTERVAL '${windowMonths} months')
           ORDER BY period_date
         ),
         ts_b AS (
           SELECT period_date, value as val_b
           FROM metric_time_series
           WHERE metric_id = $4 AND geography_type = $2 AND geography_id = $3
             AND period_date <= $5::date
             AND period_date >= ($5::date - INTERVAL '${windowMonths} months')
           ORDER BY period_date
         )
         SELECT ts_a.period_date, ts_a.val_a, ts_b.val_b
         FROM ts_a
         FULL OUTER JOIN ts_b ON ts_a.period_date = ts_b.period_date
         WHERE ts_a.val_a IS NOT NULL AND ts_b.val_b IS NOT NULL
         ORDER BY ts_a.period_date`,
        [metricA, geographyType, geographyId, metricB, dateStr]
      );

      const data = dataRes.rows;
      if (data.length < 12) return false;

      const correlation = this.computePearsonCorrelation(
        data.map((d: any) => d.val_a),
        data.map((d: any) => d.val_b)
      );

      const n = data.length;
      const pValue = this.computePValue(correlation.r, n);
      const obsStart = data[0]?.period_date || null;
      const obsEnd = data[data.length - 1]?.period_date || null;

      await this.pool.query(
        `INSERT INTO correlation_history
         (metric_a, metric_b, geography_type, geography_id, window_months,
          computed_at, computed_date, correlation_r, p_value, sample_size, observation_start, observation_end)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::date, $7, $8, $9, $10, $11)
         ON CONFLICT (metric_a, metric_b, geography_type, COALESCE(geography_id, ''), window_months, computed_date)
         DO NOTHING`,
        [metricA, metricB, geographyType, geographyId, windowMonths,
          dateStr, correlation.r, pValue, n, obsStart, obsEnd]
      );

      return true;
    } catch (error) {
      logger.error(`Error in computePairCorrelationAsOf ${metricA}-${metricB}@${dateStr}: ${String(error)}`);
      return false;
    }
  }

  /**
   * Computes all metric-pair correlations for a geography AS OF a historical date.
   * Only writes to `correlation_history` (no metric_correlations overwrite).
   * Used for deep historical backfill to build multi-point sparkline series.
   */
  async computeTimeSeriesCorrelationsAsOf(
    geographyType: string,
    geographyId: string,
    windowMonths: number,
    asOfDate: Date
  ): Promise<{ computed: number; skipped: number }> {
    const metricsRes = await this.pool.query(
      `SELECT DISTINCT metric_id
       FROM metric_time_series
       WHERE geography_type = $1 AND geography_id = $2
         AND period_date <= $3::date
       GROUP BY metric_id
       HAVING COUNT(*) >= 12`,
      [geographyType, geographyId, asOfDate.toISOString().slice(0, 10)]
    );

    const metrics: string[] = metricsRes.rows.map((r: any) => r.metric_id);
    if (metrics.length < 2) return { computed: 0, skipped: 0 };

    let computed = 0;
    let skipped = 0;
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const ok = await this.computePairCorrelationAsOf(
          metrics[i], metrics[j], geographyType, geographyId, windowMonths, asOfDate
        );
        if (ok) computed++; else skipped++;
      }
    }
    return { computed, skipped };
  }

  /**
   * Returns all metric pairs for a geography with their history point count,
   * latest r value, and computed stability score. Used by the M08 pair-level UI.
   */
  async getGeographyPairsWithStability(
    geographyType: string,
    geographyId: string | null,
    windowMonths: number = 36,
    limit: number = 30
  ): Promise<Array<{
    metric_a: string;
    metric_b: string;
    history_points: number;
    latest_r: number;
    latest_date: string;
    stability_score: number | null;
  }>> {
    try {
      const res = await this.pool.query<{
        metric_a: string; metric_b: string; history_points: string;
        stddev_r: string | null; latest_r: string; latest_date: string;
      }>(
        `SELECT
           h.metric_a, h.metric_b,
           h.history_points, h.stddev_r,
           l.correlation_r AS latest_r,
           h.latest_date::text AS latest_date
         FROM (
           SELECT metric_a, metric_b,
             COUNT(*)::text AS history_points,
             STDDEV_POP(correlation_r::float)::text AS stddev_r,
             MAX(computed_date) AS latest_date
           FROM correlation_history
           WHERE geography_type = $1
             AND (geography_id = $2 OR ($2::text IS NULL AND geography_id IS NULL))
             AND window_months = $3
           GROUP BY metric_a, metric_b
         ) h
         JOIN correlation_history l
           ON l.metric_a = h.metric_a AND l.metric_b = h.metric_b
             AND l.computed_date = h.latest_date
             AND l.geography_type = $1
             AND (l.geography_id = $2 OR ($2::text IS NULL AND l.geography_id IS NULL))
             AND l.window_months = $3
         ORDER BY h.history_points::int DESC, ABS(l.correlation_r::float) DESC
         LIMIT $4`,
        [geographyType, geographyId, windowMonths, limit]
      );

      return res.rows.map(row => {
        const pts = parseInt(row.history_points);
        const stddev = row.stddev_r != null ? parseFloat(row.stddev_r) : null;
        const stability_score = pts >= 3 && stddev != null
          ? Math.max(0, Math.min(1, 1 - stddev / 0.3))
          : null;
        return {
          metric_a: row.metric_a,
          metric_b: row.metric_b,
          history_points: pts,
          latest_r: parseFloat(row.latest_r),
          latest_date: row.latest_date,
          stability_score,
        };
      });
    } catch (error) {
      logger.error(`Error in getGeographyPairsWithStability: ${String(error)}`);
      return [];
    }
  }

  // ── Task #919: Correlation History ─────────────────────────────────────────

  /**
   * Returns sparkline data for a metric pair from correlation_history.
   * Stability score = 1 − (stddev of last N r-values / 0.3), clamped [0, 1].
   * A score of 1.0 means the correlation has been perfectly stable.
   * A score of 0.0 means it fluctuates by ≥ 0.3 in standard deviation.
   */
  async getCorrelationHistory(
    rawMetricA: string,
    rawMetricB: string,
    geographyType: string,
    geographyId: string | null,
    windowMonths: number = 36,
    limit: number = 24
  ): Promise<{
    points: Array<{ computed_at: string; r: number }>;
    stability_score: number | null;
    latest_r: number | null;
  }> {
    const [metricA, metricB] = [rawMetricA, rawMetricB].sort();
    try {
      const res = await this.pool.query<{ computed_at: Date; correlation_r: string }>(
        `SELECT computed_at, correlation_r
         FROM correlation_history
         WHERE metric_a = $1 AND metric_b = $2 AND geography_type = $3
           AND ($4::text IS NULL AND geography_id IS NULL OR geography_id = $4)
           AND window_months = $5
         ORDER BY computed_at DESC
         LIMIT $6`,
        [metricA, metricB, geographyType, geographyId, windowMonths, limit]
      );

      // Return in chronological order for sparkline rendering
      const points = res.rows
        .map(r => ({
          computed_at: r.computed_at instanceof Date ? r.computed_at.toISOString() : String(r.computed_at),
          r: parseFloat(r.correlation_r),
        }))
        .reverse();

      let stability_score: number | null = null;
      if (points.length >= 3) {
        const values = points.map(p => p.r);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const stddev = Math.sqrt(variance);
        stability_score = Math.max(0, Math.min(1, 1 - stddev / 0.3));
      }

      const latest_r = points.length > 0 ? points[points.length - 1].r : null;
      return { points, stability_score, latest_r };
    } catch (error) {
      logger.error(`Error retrieving correlation history: ${String(error)}`);
      return { points: [], stability_score: null, latest_r: null };
    }
  }

  /**
   * Returns average stability score across all pairs for a geography.
   * Used by the M08 Signal Matrix UI to show an overall stability badge.
   */
  async getGeographyStabilityScore(
    geographyType: string,
    geographyId: string | null,
    windowMonths: number = 36,
    minPoints: number = 3
  ): Promise<{ stability_score: number | null; pair_count: number; data_points: number }> {
    try {
      const res = await this.pool.query<{
        metric_a: string; metric_b: string; correlation_r: string; computed_at: Date;
      }>(
        `SELECT metric_a, metric_b, correlation_r, computed_at
         FROM correlation_history
         WHERE geography_type = $1
           AND ($2::text IS NULL AND geography_id IS NULL OR geography_id = $2)
           AND window_months = $3
         ORDER BY metric_a, metric_b, computed_at DESC`,
        [geographyType, geographyId, windowMonths]
      );

      if (res.rows.length === 0) {
        return { stability_score: null, pair_count: 0, data_points: 0 };
      }

      // Group by pair
      const pairMap = new Map<string, number[]>();
      for (const row of res.rows) {
        const key = `${row.metric_a}||${row.metric_b}`;
        if (!pairMap.has(key)) pairMap.set(key, []);
        pairMap.get(key)!.push(parseFloat(row.correlation_r));
      }

      const pairScores: number[] = [];
      for (const values of pairMap.values()) {
        if (values.length < minPoints) continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const stddev = Math.sqrt(variance);
        pairScores.push(Math.max(0, Math.min(1, 1 - stddev / 0.3)));
      }

      if (pairScores.length === 0) {
        return { stability_score: null, pair_count: pairMap.size, data_points: res.rows.length };
      }

      const avg = pairScores.reduce((a, b) => a + b, 0) / pairScores.length;
      return {
        stability_score: Math.round(avg * 1000) / 1000,
        pair_count: pairScores.length,
        data_points: res.rows.length,
      };
    } catch (error) {
      logger.error(`Error computing geography stability score: ${String(error)}`);
      return { stability_score: null, pair_count: 0, data_points: 0 };
    }
  }
}
