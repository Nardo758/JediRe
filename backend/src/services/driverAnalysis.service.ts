import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { METRICS_CATALOG, getMetricById } from './metricsCatalog.service';
import { translateMetricId } from '../utils/metricTranslation';

interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface DriverResult {
  driverMetricId: string;
  driverMetricName: string;
  driverCategory: string;
  driverGeographyType: string;
  driverGeographyId: string;
  outcomeMetricId: string;
  optimalLagWeeks: number;
  pearsonR: number;
  pValue: number;
  rSquared: number;
  slope: number;
  intercept: number;
  sampleSize: number;
  direction: string;
}

export interface DriverAnalysisRunResult {
  runId: number;
  propertyId: string;
  propertyName: string;
  status: string;
  totalDriversTested: number;
  totalResultsStored: number;
  outcomeMetrics: string[];
  results: DriverResult[];
  summary: Record<string, DriverResult[]>;
}

const OUTCOME_METRICS = [
  'OP_AVG_MARKET_RENT',
  'OP_LER',
  'OP_CONCESSION_PCT',
  'OP_EFFECTIVE_RENT',
  'OP_OCCUPANCY_PCT',
  'OP_TRAFFIC',
  'OP_NET_LEASES',
  'OP_LEASED_PCT',
];

const PROPERTY_GEO_MAP: Record<string, { submarket: string; submarketName: string }> = {
  'hsc-duluth': { submarket: 'duluth-suwanee-buford', submarketName: 'Duluth/Suwanee/Buford' },
  'ssc-suwanee': { submarket: 'duluth-suwanee-buford', submarketName: 'Duluth/Suwanee/Buford' },
};

export class DriverAnalysisService {
  constructor(private pool: Pool) {}

  async runAnalysis(
    propertyId: string,
    options?: { maxLagWeeks?: number; minSampleSize?: number; outcomeMetrics?: string[] }
  ): Promise<DriverAnalysisRunResult> {
    const maxLagWeeks = Math.min(26, Math.max(1, options?.maxLagWeeks ?? 26));
    const minSampleSize = Math.max(8, options?.minSampleSize ?? 12);
    const outcomeMetrics = options?.outcomeMetrics ?? OUTCOME_METRICS;

    const propRes = await this.pool.query(
      `SELECT DISTINCT geography_name FROM metric_time_series WHERE geography_id = $1 LIMIT 1`,
      [propertyId]
    );
    const propertyName = propRes.rows[0]?.geography_name || propertyId;

    const runRes = await this.pool.query(
      `INSERT INTO driver_analysis_runs (property_id, property_name, status, outcome_metrics)
       VALUES ($1, $2, 'running', $3)
       RETURNING id`,
      [propertyId, propertyName, outcomeMetrics]
    );
    const runId = runRes.rows[0].id;

    try {
      const driverMetrics = await this.collectDriverMetrics(propertyId);
      logger.info(`[DriverAnalysis] Property ${propertyId}: found ${driverMetrics.length} driver metrics to test against ${outcomeMetrics.length} outcomes`);

      const allResults: DriverResult[] = [];

      for (const outcomeMetricId of outcomeMetrics) {
        const outcomeSeries = await this.getPropertySeries(propertyId, outcomeMetricId);
        if (outcomeSeries.length < minSampleSize) {
          logger.warn(`[DriverAnalysis] Skipping outcome ${outcomeMetricId}: only ${outcomeSeries.length} points`);
          continue;
        }

        for (const driver of driverMetrics) {
          const driverSeries = await this.getDriverSeries(driver.metricId, driver.geographyType, driver.geographyId);
          if (driverSeries.length < minSampleSize) continue;

          const best = this.findBestLag(driverSeries, outcomeSeries, maxLagWeeks, minSampleSize);
          if (!best) continue;

          const catalogMetric = getMetricById(driver.catalogId || '');

          const result: DriverResult = {
            driverMetricId: driver.metricId,
            driverMetricName: catalogMetric?.name || driver.metricId,
            driverCategory: catalogMetric?.category || driver.source || 'unknown',
            driverGeographyType: driver.geographyType,
            driverGeographyId: driver.geographyId,
            outcomeMetricId,
            optimalLagWeeks: best.lagWeeks,
            pearsonR: best.r,
            pValue: best.pValue,
            rSquared: best.r * best.r,
            slope: best.slope,
            intercept: best.intercept,
            sampleSize: best.sampleSize,
            direction: best.r > 0 ? 'positive' : 'negative',
          };

          allResults.push(result);
        }
      }

      if (allResults.length > 0) {
        await this.persistResults(runId, propertyId, allResults);
      }

      const summary = this.buildSummary(allResults);

      await this.pool.query(
        `UPDATE driver_analysis_runs SET status = 'completed', driver_count = $2, results_count = $3, summary = $4, completed_at = NOW() WHERE id = $1`,
        [runId, driverMetrics.length, allResults.length, JSON.stringify(summary)]
      );

      this.updateCatalogFromResults(allResults, propertyId);

      logger.info(`[DriverAnalysis] Run #${runId} complete: ${allResults.length} significant relationships found from ${driverMetrics.length} drivers`);

      return {
        runId,
        propertyId,
        propertyName,
        status: 'completed',
        totalDriversTested: driverMetrics.length,
        totalResultsStored: allResults.length,
        outcomeMetrics,
        results: allResults,
        summary,
      };
    } catch (err) {
      await this.pool.query(
        `UPDATE driver_analysis_runs SET status = 'failed', summary = $2, completed_at = NOW() WHERE id = $1`,
        [runId, JSON.stringify({ error: String(err) })]
      );
      throw err;
    }
  }

  private async collectDriverMetrics(propertyId: string): Promise<Array<{
    metricId: string;
    geographyType: string;
    geographyId: string;
    source: string;
    catalogId?: string;
  }>> {
    const drivers: Array<{
      metricId: string;
      geographyType: string;
      geographyId: string;
      source: string;
      catalogId?: string;
    }> = [];

    const seen = new Set<string>();
    const addDriver = (metricId: string, geoType: string, geoId: string, source: string, catalogId?: string) => {
      const key = `${metricId}|${geoType}|${geoId}`;
      if (!seen.has(key)) {
        seen.add(key);
        drivers.push({ metricId, geographyType: geoType, geographyId: geoId, source, catalogId });
      }
    };

    for (const catalogMetric of METRICS_CATALOG) {
      if (catalogMetric.id.startsWith('OP_')) continue;

      const dbId = translateMetricId(catalogMetric.id);

      const idsToTry = [dbId];
      if (dbId !== catalogMetric.id) {
        idsToTry.push(catalogMetric.id);
      }

      for (const tryId of idsToTry) {
        const geoRes = await this.pool.query(
          `SELECT DISTINCT geography_type, geography_id
           FROM metric_time_series
           WHERE metric_id = $1 AND value IS NOT NULL
           GROUP BY geography_type, geography_id
           HAVING COUNT(*) >= 8
           ORDER BY COUNT(*) DESC
           LIMIT 5`,
          [tryId]
        );
        if (geoRes.rows.length > 0) {
          for (const row of geoRes.rows) {
            addDriver(tryId, row.geography_type, row.geography_id, catalogMetric.source, catalogMetric.id);
          }
          break;
        }
      }
    }

    const geoMapping = PROPERTY_GEO_MAP[propertyId];
    if (geoMapping) {
      const csRes = await this.pool.query(
        `SELECT DISTINCT metric_id
         FROM metric_time_series
         WHERE metric_id LIKE 'CS_%' AND geography_type = 'submarket'
           AND geography_id = $1
         GROUP BY metric_id
         HAVING COUNT(*) >= 8
         ORDER BY metric_id`,
        [geoMapping.submarket]
      );
      for (const row of csRes.rows) {
        addDriver(row.metric_id, 'submarket', geoMapping.submarket, 'costar');
      }
    }

    const fredRes = await this.pool.query(
      `SELECT DISTINCT metric_id, geography_type, geography_id
       FROM metric_time_series
       WHERE source LIKE 'fred%' AND value IS NOT NULL
       GROUP BY metric_id, geography_type, geography_id
       HAVING COUNT(*) >= 12
       ORDER BY metric_id`
    );
    for (const row of fredRes.rows) {
      addDriver(row.metric_id, row.geography_type, row.geography_id, 'fred');
    }

    const zillowRes = await this.pool.query(
      `SELECT DISTINCT metric_id, geography_type, geography_id
       FROM metric_time_series
       WHERE source = 'zillow' AND value IS NOT NULL
       GROUP BY metric_id, geography_type, geography_id
       HAVING COUNT(*) >= 12
       ORDER BY metric_id`
    );
    for (const row of zillowRes.rows) {
      addDriver(row.metric_id, row.geography_type, row.geography_id, 'zillow');
    }

    const otherRes = await this.pool.query(
      `SELECT DISTINCT metric_id, geography_type, geography_id, source
       FROM metric_time_series
       WHERE source IN ('census_acs5', 'google_trends', 'derived')
         AND value IS NOT NULL AND metric_id NOT LIKE 'OP_%'
       GROUP BY metric_id, geography_type, geography_id, source
       HAVING COUNT(*) >= 8
       ORDER BY metric_id`
    );
    for (const row of otherRes.rows) {
      addDriver(row.metric_id, row.geography_type, row.geography_id, row.source);
    }

    return drivers;
  }

  private async getPropertySeries(propertyId: string, metricId: string): Promise<TimeSeriesPoint[]> {
    const res = await this.pool.query(
      `SELECT period_date::text as date, value
       FROM metric_time_series
       WHERE geography_id = $1 AND metric_id = $2 AND value IS NOT NULL
       ORDER BY period_date`,
      [propertyId, metricId]
    );
    return res.rows.map((r: any) => ({ date: r.date.substring(0, 10), value: parseFloat(r.value) }));
  }

  private async getDriverSeries(metricId: string, geoType: string, geoId: string): Promise<TimeSeriesPoint[]> {
    const res = await this.pool.query(
      `SELECT period_date::text as date, AVG(value) as value
       FROM metric_time_series
       WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3 AND value IS NOT NULL
       GROUP BY period_date
       ORDER BY period_date`,
      [metricId, geoType, geoId]
    );
    return res.rows.map((r: any) => ({ date: r.date.substring(0, 10), value: parseFloat(r.value) }));
  }

  private findBestLag(
    driverSeries: TimeSeriesPoint[],
    outcomeSeries: TimeSeriesPoint[],
    maxLagWeeks: number,
    minSampleSize: number
  ): { lagWeeks: number; r: number; pValue: number; slope: number; intercept: number; sampleSize: number } | null {
    let bestResult: { lagWeeks: number; r: number; pValue: number; slope: number; intercept: number; sampleSize: number } | null = null;
    let bestAbsR = 0;

    const driverDates = driverSeries.map(p => ({ time: new Date(p.date).getTime(), value: p.value }));

    const findNearestDriverValue = (targetDate: Date, lagWeeks: number): number | null => {
      const laggedTime = targetDate.getTime() - lagWeeks * 7 * 24 * 60 * 60 * 1000;
      let closestIdx = -1;
      let closestDist = Infinity;
      for (let i = 0; i < driverDates.length; i++) {
        const dist = Math.abs(driverDates[i].time - laggedTime);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      if (closestIdx >= 0 && closestDist < 45 * 24 * 60 * 60 * 1000) {
        return driverDates[closestIdx].value;
      }
      return null;
    };

    for (let lag = 0; lag <= maxLagWeeks; lag++) {
      const xVals: number[] = [];
      const yVals: number[] = [];

      for (const outcomePoint of outcomeSeries) {
        const driverVal = findNearestDriverValue(new Date(outcomePoint.date), lag);
        if (driverVal !== null) {
          xVals.push(driverVal);
          yVals.push(outcomePoint.value);
        }
      }

      if (xVals.length < minSampleSize) continue;

      const { r, slope, intercept } = this.linearRegression(xVals, yVals);
      if (!Number.isFinite(r)) continue;

      const pValue = this.computePValue(r, xVals.length);

      if (Math.abs(r) > bestAbsR) {
        bestAbsR = Math.abs(r);
        bestResult = {
          lagWeeks: lag,
          r: Math.round(r * 10000) / 10000,
          pValue: Math.round(pValue * 100000000) / 100000000,
          slope: Math.round(slope * 100000000) / 100000000,
          intercept: Math.round(intercept * 100000000) / 100000000,
          sampleSize: xVals.length,
        };
      }
    }

    return bestResult;
  }

  private linearRegression(x: number[], y: number[]): { r: number; slope: number; intercept: number } {
    const n = x.length;
    if (n < 3) return { r: 0, slope: 0, intercept: 0 };

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let ssXY = 0, ssXX = 0, ssYY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      ssXY += dx * dy;
      ssXX += dx * dx;
      ssYY += dy * dy;
    }

    if (ssXX === 0 || ssYY === 0) return { r: 0, slope: 0, intercept: 0 };

    const slope = ssXY / ssXX;
    const intercept = meanY - slope * meanX;
    const r = ssXY / Math.sqrt(ssXX * ssYY);

    return { r, slope, intercept };
  }

  private computePValue(r: number, n: number): number {
    if (Math.abs(r) >= 1 || n < 3) return 0;
    const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
    const absT = Math.abs(t);
    const p = 2 * (1 - this.normalCDF(absT));
    return Math.max(0, Math.min(1, p));
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-z * z);
    return 0.5 * (1.0 + sign * y);
  }

  private async persistResults(runId: number, propertyId: string, results: DriverResult[]): Promise<void> {
    const batchSize = 50;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];
      let idx = 1;

      for (const r of batch) {
        placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        values.push(
          runId, propertyId, r.driverMetricId, r.driverMetricName, r.driverCategory,
          r.driverGeographyType, r.driverGeographyId, r.outcomeMetricId,
          r.optimalLagWeeks, r.pearsonR, r.pValue, r.rSquared, r.slope, r.intercept,
          r.sampleSize, r.direction
        );
      }

      await this.pool.query(
        `INSERT INTO driver_analysis_results
         (run_id, property_id, driver_metric_id, driver_metric_name, driver_category,
          driver_geography_type, driver_geography_id, outcome_metric_id,
          optimal_lag_weeks, pearson_r, p_value, r_squared, slope, intercept,
          sample_size, direction)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }
  }

  private buildSummary(results: DriverResult[]): Record<string, DriverResult[]> {
    const summary: Record<string, DriverResult[]> = {};
    for (const r of results) {
      if (!summary[r.outcomeMetricId]) summary[r.outcomeMetricId] = [];
      summary[r.outcomeMetricId].push(r);
    }
    for (const key of Object.keys(summary)) {
      summary[key].sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));
      summary[key] = summary[key].slice(0, 15);
    }
    return summary;
  }

  private updateCatalogFromResults(allResults: DriverResult[], propertyId: string): void {
    const leadsMap = new Map<string, Array<{ metricId: string; lagMonths: number; typicalR: number }>>();
    const laggedByMap = new Map<string, Array<{ metricId: string; leadMonths: number; typicalR: number }>>();

    for (const r of allResults) {
      if (Math.abs(r.pearsonR) < 0.3 || r.optimalLagWeeks === 0) continue;

      const driverCatalogId = this.findCatalogId(r.driverMetricId);
      const outcomeCatalogId = r.outcomeMetricId;
      const lagMonths = Math.round(r.optimalLagWeeks / 4.33);

      if (!leadsMap.has(driverCatalogId)) leadsMap.set(driverCatalogId, []);
      leadsMap.get(driverCatalogId)!.push({ metricId: outcomeCatalogId, lagMonths, typicalR: r.pearsonR });

      if (!laggedByMap.has(outcomeCatalogId)) laggedByMap.set(outcomeCatalogId, []);
      laggedByMap.get(outcomeCatalogId)!.push({ metricId: driverCatalogId, leadMonths: lagMonths, typicalR: r.pearsonR });
    }

    let updated = 0;
    const allIds = new Set([...leadsMap.keys(), ...laggedByMap.keys()]);
    for (const id of allIds) {
      const metric = getMetricById(id);
      if (!metric) continue;

      const leads = (leadsMap.get(id) || []).sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR)).slice(0, 5);
      const lagged = (laggedByMap.get(id) || []).sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR)).slice(0, 5);

      if (leads.length > 0) metric.leadsMetrics = leads;
      if (lagged.length > 0) metric.laggedBy = lagged;
      metric.empiricallyValidated = true;
      updated++;
    }

    if (updated > 0) {
      logger.info(`[DriverAnalysis] Updated ${updated} catalog metrics with empirical lead/lag data for ${propertyId}`);
    }
  }

  private findCatalogId(dbMetricId: string): string {
    for (const m of METRICS_CATALOG) {
      const translated = translateMetricId(m.id);
      if (translated === dbMetricId) return m.id;
    }
    return dbMetricId;
  }

  async getResults(
    propertyId: string,
    options?: {
      outcomeMetric?: string;
      minR?: number;
      maxPValue?: number;
      minLag?: number;
      maxLag?: number;
      limit?: number;
      sortBy?: string;
      sortDir?: string;
    }
  ): Promise<any[]> {
    let query = `SELECT * FROM driver_analysis_results WHERE property_id = $1`;
    const params: any[] = [propertyId];
    let idx = 2;

    if (options?.outcomeMetric) {
      query += ` AND outcome_metric_id = $${idx++}`;
      params.push(options.outcomeMetric);
    }
    if (options?.minR) {
      query += ` AND ABS(pearson_r) >= $${idx++}`;
      params.push(options.minR);
    }
    if (options?.maxPValue) {
      query += ` AND p_value <= $${idx++}`;
      params.push(options.maxPValue);
    }
    if (options?.minLag !== undefined) {
      query += ` AND optimal_lag_weeks >= $${idx++}`;
      params.push(options.minLag);
    }
    if (options?.maxLag !== undefined) {
      query += ` AND optimal_lag_weeks <= $${idx++}`;
      params.push(options.maxLag);
    }

    const sortCol = options?.sortBy === 'r_squared' ? 'r_squared'
      : options?.sortBy === 'lag' ? 'optimal_lag_weeks'
      : options?.sortBy === 'p_value' ? 'p_value'
      : 'ABS(pearson_r)';
    const sortDir = options?.sortDir === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortDir}`;

    if (options?.limit) {
      query += ` LIMIT $${idx++}`;
      params.push(options.limit);
    }

    const res = await this.pool.query(query, params);
    return res.rows.map(this.formatRow);
  }

  async getSummary(propertyId: string, topN: number = 10): Promise<Record<string, any[]>> {
    const latestRunRes = await this.pool.query(
      `SELECT id FROM driver_analysis_runs WHERE property_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
      [propertyId]
    );
    if (latestRunRes.rows.length === 0) return {};

    const runId = latestRunRes.rows[0].id;
    const res = await this.pool.query(
      `SELECT * FROM driver_analysis_results WHERE run_id = $1 ORDER BY outcome_metric_id, ABS(pearson_r) DESC`,
      [runId]
    );

    const summary: Record<string, any[]> = {};
    for (const row of res.rows) {
      const key = row.outcome_metric_id;
      if (!summary[key]) summary[key] = [];
      if (summary[key].length < topN) {
        summary[key].push(this.formatRow(row));
      }
    }
    return summary;
  }

  async getRuns(propertyId?: string): Promise<any[]> {
    let query = `SELECT * FROM driver_analysis_runs`;
    const params: any[] = [];
    if (propertyId) {
      query += ` WHERE property_id = $1`;
      params.push(propertyId);
    }
    query += ` ORDER BY created_at DESC LIMIT 20`;
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  private formatRow(row: any) {
    return {
      id: row.id,
      runId: row.run_id,
      propertyId: row.property_id,
      driverMetricId: row.driver_metric_id,
      driverMetricName: row.driver_metric_name,
      driverCategory: row.driver_category,
      driverGeographyType: row.driver_geography_type,
      driverGeographyId: row.driver_geography_id,
      outcomeMetricId: row.outcome_metric_id,
      optimalLagWeeks: row.optimal_lag_weeks,
      pearsonR: parseFloat(row.pearson_r),
      pValue: parseFloat(row.p_value),
      rSquared: parseFloat(row.r_squared),
      slope: parseFloat(row.slope),
      intercept: parseFloat(row.intercept),
      sampleSize: row.sample_size,
      direction: row.direction,
      computedAt: row.computed_at,
    };
  }
}
