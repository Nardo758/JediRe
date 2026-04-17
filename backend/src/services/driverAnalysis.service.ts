import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { METRICS_CATALOG, getMetricById, applyEmpiricalLeadLag } from './metricsCatalog.service';
import { CATALOG_TO_DB } from '../config/metricIdMapping';

const DB_METRIC_NAMES: Record<string, string> = {
  home_value_index: 'Median Home Value (Zillow)',
  home_value_index_yoy: 'Home Value Growth YoY (Zillow)',
  rent_index: 'Rent Index (Zillow)',
  rent_index_yoy: 'Rent Growth YoY (Zillow)',
  RATE_FED_FUNDS: 'Federal Funds Rate',
  RATE_MORTGAGE_30Y: '30-Year Mortgage Rate',
  RATE_SOFR: 'SOFR Rate',
  RATE_TREASURY_10Y: '10-Year Treasury Yield',
  M_GDP: 'GDP',
  M_PERSONAL_INCOME: 'Personal Income',
  M_CPI_OFFICIAL: 'CPI — Official (BLS)',
  M_CPI_SHADOWSTATS: 'CPI — ShadowStats (1980-Based)',
  M_CPI_STICKY: 'Sticky CPI',
  M_OIL_PRICE: 'Crude Oil Price (WTI)',
  M_EMPLOYED: 'Total Employed',
  M_LABOR_FORCE: 'Labor Force',
  M_UNEMPLOYMENT_RATE: 'Unemployment Rate',
  M_POPULATION: 'Population (National)',
  M_BUILDING_PERMITS: 'Building Permits',
  M_HOUSING_STARTS: 'Housing Starts',
  M_HOME_PRICE_INDEX: 'Home Price Index',
  M_CASE_SHILLER_HPI: 'Case-Shiller HPI',
  M_LEISURE_HOSPITALITY_EMP: 'Leisure & Hospitality Employment',
  D_POPULATION: 'Total Population',
  D_MEDIAN_INCOME: 'Median Household Income',
  D_MEDIAN_RENT: 'Median Rent',
  D_MEDIAN_HOME_VALUE: 'Median Home Value',
  D_MEDIAN_AGE: 'Median Age',
  D_HOUSEHOLD_COUNT: 'Household Count',
  D_HOUSEHOLD_GROWTH_YOY: 'Household Growth YoY',
  D_RENTER_PCT: 'Renter Household %',
  D_RENTER_OCCUPIED: 'Renter-Occupied Units',
  D_TOTAL_OCCUPIED: 'Total Occupied Housing',
  D_TOTAL_HOUSING_UNITS: 'Total Housing Units',
  D_TOTAL_POP_POVERTY: 'Population in Poverty',
  D_POVERTY_POP: 'Poverty Population Count',
  D_POVERTY_RATE: 'Poverty Rate',
  D_POP_25_PLUS: 'Population 25+',
  D_BACHELOR_PLUS: 'Bachelor Degree or Higher',
  D_EDUCATION_BACHELOR_PCT: 'Education: Bachelor %',
  D_AVG_HOURLY_EARNINGS: 'Avg Hourly Earnings',
  D_AVG_WEEKLY_WAGE: 'Avg Weekly Wage',
  D_EMP_GROWTH_YOY: 'Employment Growth YoY',
  D_WAGE_GROWTH_YOY: 'Wage Growth YoY',
  D_POP_GROWTH_YOY: 'Population Growth YoY',
  D_BIZ_FORMATIONS: 'Business Formations',
  D_PERMIT_VELOCITY_YOY: 'Permit Filing Velocity YoY',
  D_RENT_TO_INCOME: 'Rent-to-Income Ratio',
  D_PRICE_TO_RENT: 'Price-to-Rent Ratio',
  D_JOBS_TO_HOUSING: 'Jobs-to-Housing Ratio',
  D_SEARCH_VOL: 'Search Volume (Branded + Category)',
  D_SEARCH_VOL_YOY: 'Search Volume Growth YoY',
  T_AADT: 'AADT (Annual Average Daily Traffic)',
  T_AADT_YOY: 'AADT Growth YoY',
  C_SEARCH_GROWTH_INDEX: 'Search Growth Index (SGI)',
  CS_VACANCY_RATE: 'Vacancy Rate (CoStar)',
  CS_OCCUPANCY_RATE: 'Occupancy Rate (CoStar)',
  CS_NET_ABSORPTION: 'Net Absorption (CoStar)',
  CS_ABSORPTION_UNITS: 'Absorption Units (CoStar)',
  CS_ABSORPTION_PCT: 'Absorption % (CoStar)',
  CS_UNDER_CONSTRUCTION: 'Under Construction (CoStar)',
  CS_UNDER_CONSTR_PCT: 'Under Construction % (CoStar)',
  CS_DELIVERIES: 'Deliveries (CoStar)',
  CS_DEMAND_UNITS: 'Demand Units (CoStar)',
  CS_EFFECTIVE_RENT: 'Effective Rent (CoStar)',
  CS_EFF_RENT_GROWTH: 'Effective Rent Growth (CoStar)',
  CS_MARKET_RENT: 'Market Rent (CoStar)',
  CS_RENT_GROWTH: 'Rent Growth (CoStar)',
  CS_CAP_RATE: 'Cap Rate (CoStar)',
  CS_MEDIAN_PRICE_UNIT: 'Price per Unit (CoStar)',
  CS_INVENTORY_UNITS: 'Inventory Units (CoStar)',
  CS_CONSTR_STARTS: 'Construction Starts (CoStar)',
  CS_RENT_INDEX: 'Rent Index (CoStar)',
  CS_PRICE_INDEX: 'Price Index (CoStar)',
  CS_SALES_VOLUME: 'Sales Volume (CoStar)',
  CS_ASSET_VALUE: 'Asset Value (CoStar)',
  D_SEARCH_MOMENTUM: 'Search Momentum (QoQ %)',
  D_DIGITAL_SCORE: 'Digital Traffic Score',
  D_DIGITAL_SHARE: 'Digital Traffic Share (%)',
  T_EFFECTIVE_ADT: 'Effective ADT (Signal-Adjusted)',
  T_WALKINS: 'Predicted Walk-Ins',
  T_PHYSICAL_SCORE: 'Physical Traffic Score',
  C_SURGE_INDEX: 'Traffic Surge Index',
  C_DIGITAL_PHYSICAL_GAP: 'Digital-Physical Divergence',
  C_TPI: 'Traffic Position Index',
  C_TVS: 'Traffic Velocity Score',
  C_TRAFFIC_GROWTH_INDEX: 'Traffic Growth Index',
  S_MONTHS_OF_SUPPLY: 'Months of Supply',
  M_SUBMARKET_RANK: 'Submarket Rank Percentile',
  R_SUPPLY_RISK: 'Supply Risk Score',
  DEMO_NET_MIGRATION: 'Net Migration (Households/Year)',
  DEMO_POPULATION_DECLINE: 'Population Decline Indicator',
  DEMO_POPULATION_TREND_3Y: '3-Year Population CAGR',
  CS_NET_DELIVERIES: 'Net Deliveries (CoStar)',
  CS_EFF_RENT_GROWTH_QTR: 'Eff Rent Growth QoQ (CoStar)',
  CS_STABILIZED_VACANCY: 'Stabilized Vacancy (CoStar)',
};

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

      const driverCache = new Map<string, TimeSeriesPoint[]>();
      const BATCH_SIZE = 200;
      for (let i = 0; i < driverMetrics.length; i += BATCH_SIZE) {
        const batch = driverMetrics.slice(i, i + BATCH_SIZE);
        const conditions = batch.map((d, idx) => {
          const base = idx * 3;
          return `(metric_id = $${base + 1} AND geography_type = $${base + 2} AND geography_id = $${base + 3})`;
        });
        const params = batch.flatMap(d => [d.metricId, d.geographyType, d.geographyId]);
        const batchRes = await this.pool.query(
          `SELECT metric_id, geography_type, geography_id, period_date::text as date, AVG(value) as value
           FROM metric_time_series
           WHERE (${conditions.join(' OR ')}) AND value IS NOT NULL
           GROUP BY metric_id, geography_type, geography_id, period_date
           ORDER BY metric_id, period_date`,
          params
        );
        for (const row of batchRes.rows) {
          const key = `${row.metric_id}|${row.geography_type}|${row.geography_id}`;
          if (!driverCache.has(key)) driverCache.set(key, []);
          driverCache.get(key)!.push({ date: row.date.substring(0, 10), value: parseFloat(row.value) });
        }
        if (i % 1000 === 0) logger.info(`[DriverAnalysis] Prefetched ${Math.min(i + BATCH_SIZE, driverMetrics.length)}/${driverMetrics.length} driver series`);
      }
      logger.info(`[DriverAnalysis] Prefetch complete: ${driverCache.size} driver series cached`);

      const allResults: DriverResult[] = [];

      for (const outcomeMetricId of outcomeMetrics) {
        const outcomeSeries = await this.getPropertySeries(propertyId, outcomeMetricId);
        if (outcomeSeries.length < minSampleSize) {
          logger.warn(`[DriverAnalysis] Skipping outcome ${outcomeMetricId}: only ${outcomeSeries.length} points`);
          continue;
        }

        for (const driver of driverMetrics) {
          const cacheKey = `${driver.metricId}|${driver.geographyType}|${driver.geographyId}`;
          const driverSeries = driverCache.get(cacheKey);
          if (!driverSeries || driverSeries.length < minSampleSize) continue;

          const best = this.findBestLag(driverSeries, outcomeSeries, maxLagWeeks, minSampleSize);
          if (!best) continue;

          const catalogMetric = getMetricById(driver.catalogId || '');
          const displayName = catalogMetric?.name || DB_METRIC_NAMES[driver.metricId] || driver.metricId;
          const displayCategory = catalogMetric?.category || DB_METRIC_NAMES[driver.metricId] ? driver.source : driver.source || 'unknown';

          const result: DriverResult = {
            driverMetricId: driver.metricId,
            driverMetricName: displayName,
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

      const mappedId = CATALOG_TO_DB[catalogMetric.id];
      const idsToTry: string[] = [];
      if (mappedId) idsToTry.push(mappedId);
      idsToTry.push(catalogMetric.id);

      for (const tryId of idsToTry) {
        const geoRes = await this.pool.query(
          `SELECT geography_type, geography_id, COUNT(*) as cnt
           FROM metric_time_series
           WHERE metric_id = $1 AND value IS NOT NULL
           GROUP BY geography_type, geography_id
           HAVING COUNT(*) >= 8
           ORDER BY cnt DESC
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
        `SELECT metric_id
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
      `SELECT metric_id, geography_type, geography_id
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
      `SELECT metric_id, geography_type, geography_id
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
      `SELECT metric_id, geography_type, geography_id, source
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

    const driverTimes = driverSeries.map(p => new Date(p.date).getTime());
    const driverValues = driverSeries.map(p => p.value);
    const MAX_DIST = 45 * 24 * 60 * 60 * 1000;
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const outcomeTimes = outcomeSeries.map(p => new Date(p.date).getTime());
    const outcomeValues = outcomeSeries.map(p => p.value);

    for (let lag = 0; lag <= maxLagWeeks; lag++) {
      const xVals: number[] = [];
      const yVals: number[] = [];
      const lagMs = lag * WEEK_MS;

      for (let oi = 0; oi < outcomeTimes.length; oi++) {
        const target = outcomeTimes[oi] - lagMs;
        let lo = 0, hi = driverTimes.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (driverTimes[mid] < target) lo = mid + 1; else hi = mid;
        }
        let bestIdx = lo;
        if (lo > 0 && Math.abs(driverTimes[lo - 1] - target) < Math.abs(driverTimes[lo] - target)) bestIdx = lo - 1;
        if (bestIdx < driverTimes.length && Math.abs(driverTimes[bestIdx] - target) < MAX_DIST) {
          xVals.push(driverValues[bestIdx]);
          yVals.push(outcomeValues[oi]);
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

    const allIds = new Set([...leadsMap.keys(), ...laggedByMap.keys()]);
    const overrides = Array.from(allIds).map(id => ({
      metricId: id,
      leadsMetrics: (leadsMap.get(id) || []).sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR)).slice(0, 5),
      laggedBy: (laggedByMap.get(id) || []).sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR)).slice(0, 5),
      empiricallyValidated: true,
    }));

    if (overrides.length > 0) {
      const applied = applyEmpiricalLeadLag(overrides);
      logger.info(`[DriverAnalysis] Applied ${applied} empirical lead/lag overrides to catalog for ${propertyId}`);
    }
  }

  private findCatalogId(dbMetricId: string): string {
    for (const m of METRICS_CATALOG) {
      const mapped = CATALOG_TO_DB[m.id];
      if (mapped === dbMetricId || m.id === dbMetricId) return m.id;
    }
    return dbMetricId;
  }

  async getResults(
    propertyId: string,
    options?: {
      outcomeMetric?: string;
      minR?: number;
      minRSquared?: number;
      maxPValue?: number;
      minLag?: number;
      maxLag?: number;
      limit?: number;
      sortBy?: string;
      sortDir?: string;
    }
  ): Promise<any[]> {
    let whereClause = `WHERE property_id = $1`;
    const params: any[] = [propertyId];
    let idx = 2;

    if (options?.outcomeMetric) {
      whereClause += ` AND outcome_metric_id = $${idx++}`;
      params.push(options.outcomeMetric);
    }
    if (options?.minR) {
      whereClause += ` AND ABS(pearson_r) >= $${idx++}`;
      params.push(options.minR);
    }
    if (options?.minRSquared) {
      whereClause += ` AND r_squared >= $${idx++}`;
      params.push(options.minRSquared);
    }
    if (options?.maxPValue) {
      whereClause += ` AND p_value <= $${idx++}`;
      params.push(options.maxPValue);
    }
    if (options?.minLag !== undefined) {
      whereClause += ` AND optimal_lag_weeks >= $${idx++}`;
      params.push(options.minLag);
    }
    if (options?.maxLag !== undefined) {
      whereClause += ` AND optimal_lag_weeks <= $${idx++}`;
      params.push(options.maxLag);
    }

    const sortCol = options?.sortBy === 'r_squared' ? 'r_squared'
      : options?.sortBy === 'lag' ? 'optimal_lag_weeks'
      : options?.sortBy === 'p_value' ? 'p_value'
      : 'abs_r';
    const sortDir = options?.sortDir === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT DISTINCT ON (driver_metric_id, outcome_metric_id) *,
             ABS(pearson_r) as abs_r
      FROM driver_analysis_results
      ${whereClause}
      ORDER BY driver_metric_id, outcome_metric_id, ABS(pearson_r) DESC
    `;

    const wrapQuery = `
      SELECT * FROM (${query}) deduped
      ORDER BY ${sortCol} ${sortDir}
      ${options?.limit ? `LIMIT $${idx++}` : ''}
    `;
    if (options?.limit) params.push(options.limit);

    const res = await this.pool.query(wrapQuery, params);
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
