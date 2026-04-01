import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { translateMetricId, OUTCOME_METRICS_DB, reverseTranslateDbId, reverseTranslateDbIdPrimary } from '../utils/metricTranslation';

const OUTCOME_METRIC_LABELS: Record<string, string> = {
  'rent_index_yoy': 'F_RENT_GROWTH',
  'home_value_index_yoy': 'SFR_HOME_VALUE_GROWTH',
  'home_value_index': 'SFR_HOME_VALUE',
  'rent_index': 'F_RENT_INDEX',
};

interface LagProfileEntry {
  lagMonths: number;
  r: number;
  sampleSize: number;
}

interface LeadLagResult {
  metricAId: string;
  metricBId: string;
  optimalLagMonths: number;
  rAtOptimalLag: number;
  rAtZeroLag: number;
  improvementAbs: number;
  improvementPct: number;
  lagProfile: LagProfileEntry[];
  geographyType: string;
  sampleSize: number;
  confidenceLevel: string;
}

export class LeadLagDiscoveryService {
  constructor(private pool: Pool) {}

  async discoverLeadLag(
    metricAId: string,
    metricBId: string,
    geographyType: string = 'submarket',
    maxLag: number = 24
  ): Promise<LeadLagResult | null> {
    try {
      const geoRes = await this.pool.query(
        `SELECT DISTINCT geography_id FROM metric_time_series
         WHERE geography_type = $1 AND metric_id IN ($2, $3)
         GROUP BY geography_id
         HAVING COUNT(DISTINCT metric_id) = 2
         ORDER BY geography_id`,
        [geographyType, metricAId, metricBId]
      );

      if (geoRes.rows.length === 0) {
        return null;
      }

      const allSeriesA: Map<string, Map<string, number>> = new Map();
      const allSeriesB: Map<string, Map<string, number>> = new Map();

      for (const geoRow of geoRes.rows) {
        const geoId = geoRow.geography_id;
        const tsRes = await this.pool.query(
          `SELECT metric_id, period_date, value FROM metric_time_series
           WHERE geography_type = $1 AND geography_id = $2 AND metric_id IN ($3, $4)
           ORDER BY period_date`,
          [geographyType, geoId, metricAId, metricBId]
        );

        const seriesA = new Map<string, number>();
        const seriesB = new Map<string, number>();

        for (const row of tsRes.rows) {
          const key = String(row.period_date).substring(0, 7);
          if (row.metric_id === metricAId) {
            seriesA.set(key, parseFloat(row.value));
          } else {
            seriesB.set(key, parseFloat(row.value));
          }
        }

        if (seriesA.size >= 12 && seriesB.size >= 12) {
          allSeriesA.set(geoId, seriesA);
          allSeriesB.set(geoId, seriesB);
        }
      }

      if (allSeriesA.size === 0) {
        return null;
      }

      const lagProfile: LagProfileEntry[] = [];
      let rAtZeroLag = 0;

      for (let lag = 0; lag <= maxLag; lag++) {
        let sumR = 0;
        let geoCount = 0;
        let totalSamples = 0;

        for (const [geoId, seriesA] of allSeriesA) {
          const seriesB = allSeriesB.get(geoId)!;
          const allMonths = [...new Set([...seriesA.keys(), ...seriesB.keys()])].sort();

          const xVals: number[] = [];
          const yVals: number[] = [];

          for (let i = lag; i < allMonths.length; i++) {
            const monthA = allMonths[i - lag];
            const monthB = allMonths[i];
            const valA = seriesA.get(monthA);
            const valB = seriesB.get(monthB);
            if (valA !== undefined && valB !== undefined) {
              xVals.push(valA);
              yVals.push(valB);
            }
          }

          if (xVals.length >= 12) {
            const r = this.pearsonR(xVals, yVals);
            if (!isNaN(r)) {
              sumR += r;
              geoCount++;
              totalSamples += xVals.length;
            }
          }
        }

        if (geoCount > 0) {
          const avgR = sumR / geoCount;
          lagProfile.push({
            lagMonths: lag,
            r: Math.round(avgR * 10000) / 10000,
            sampleSize: totalSamples,
          });
          if (lag === 0) {
            rAtZeroLag = avgR;
          }
        }
      }

      if (lagProfile.length === 0) {
        return null;
      }

      let optimalLag = 0;
      let bestAbsR = 0;
      let rAtOptimal = rAtZeroLag;
      let optimalSamples = lagProfile[0]?.sampleSize || 0;

      for (const entry of lagProfile) {
        if (Math.abs(entry.r) > bestAbsR) {
          bestAbsR = Math.abs(entry.r);
          optimalLag = entry.lagMonths;
          rAtOptimal = entry.r;
          optimalSamples = entry.sampleSize;
        }
      }

      const improvementAbs = Math.abs(rAtOptimal) - Math.abs(rAtZeroLag);
      const improvementPct = Math.abs(rAtZeroLag) > 0.001
        ? (improvementAbs / Math.abs(rAtZeroLag)) * 100
        : Math.abs(rAtOptimal) > 0.1 ? 100 : 0;

      let confidenceLevel = 'low';
      if (optimalSamples >= 120 && Math.abs(rAtOptimal) >= 0.5) {
        confidenceLevel = 'high';
      } else if (optimalSamples >= 48 && Math.abs(rAtOptimal) >= 0.3) {
        confidenceLevel = 'medium';
      }

      return {
        metricAId,
        metricBId,
        optimalLagMonths: optimalLag,
        rAtOptimalLag: Math.round(rAtOptimal * 10000) / 10000,
        rAtZeroLag: Math.round(rAtZeroLag * 10000) / 10000,
        improvementAbs: Math.round(improvementAbs * 10000) / 10000,
        improvementPct: Math.round(improvementPct * 100) / 100,
        lagProfile,
        geographyType,
        sampleSize: optimalSamples,
        confidenceLevel,
      };
    } catch (error) {
      logger.error(`Error discovering lead/lag for ${metricAId}->${metricBId}: ${String(error)}`);
      return null;
    }
  }

  async persistResult(result: LeadLagResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_lead_lag_results
       (metric_a_id, metric_b_id, optimal_lag_months, r_at_optimal_lag, r_at_zero_lag,
        improvement_abs, improvement_pct, lag_profile, geography_type, sample_size, confidence_level, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (metric_a_id, metric_b_id, geography_type)
       DO UPDATE SET
         optimal_lag_months = $3, r_at_optimal_lag = $4, r_at_zero_lag = $5,
         improvement_abs = $6, improvement_pct = $7, lag_profile = $8, sample_size = $10,
         confidence_level = $11, computed_at = NOW()`,
      [
        result.metricAId, result.metricBId, result.optimalLagMonths,
        result.rAtOptimalLag, result.rAtZeroLag, result.improvementAbs,
        result.improvementPct, JSON.stringify(result.lagProfile), result.geographyType,
        result.sampleSize, result.confidenceLevel,
      ]
    );
  }

  async runDiscoveryPipeline(geographyType: string = 'submarket'): Promise<{
    pairsProcessed: number;
    pairsDiscovered: number;
    pairsSkipped: number;
  }> {
    const outcomeDbIds = OUTCOME_METRICS_DB;

    const catalogMetricsRes = await this.pool.query(
      `SELECT DISTINCT metric_id FROM metric_time_series
       WHERE geography_type = $1
       GROUP BY metric_id
       HAVING COUNT(*) >= 12`,
      [geographyType]
    );

    const allMetricIds = catalogMetricsRes.rows.map((r: any) => r.metric_id as string);

    const pairs: Array<[string, string]> = [];
    for (const leader of allMetricIds) {
      for (const outcome of outcomeDbIds) {
        if (leader === outcome) continue;
        pairs.push([leader, outcome]);
      }
    }
    for (let i = 0; i < outcomeDbIds.length; i++) {
      for (let j = i + 1; j < outcomeDbIds.length; j++) {
        if (!pairs.some(p => p[0] === outcomeDbIds[i] && p[1] === outcomeDbIds[j])) {
          pairs.push([outcomeDbIds[i], outcomeDbIds[j]]);
        }
        if (!pairs.some(p => p[0] === outcomeDbIds[j] && p[1] === outcomeDbIds[i])) {
          pairs.push([outcomeDbIds[j], outcomeDbIds[i]]);
        }
      }
    }

    let processed = 0;
    let discovered = 0;
    let skipped = 0;

    for (const [leader, outcome] of pairs) {
      processed++;
      try {
        const result = await this.discoverLeadLag(leader, outcome, geographyType);
        if (result && result.optimalLagMonths > 0 && result.sampleSize >= 24 && result.improvementAbs > 0.1) {
          await this.persistResult(result);
          discovered++;
        } else {
          skipped++;
        }
      } catch (e) {
        logger.warn(`Lead/lag discovery failed for ${leader}->${outcome}: ${String(e)}`);
        skipped++;
      }
    }

    logger.info(`[LeadLagPipeline] Processed ${processed}, discovered ${discovered}, skipped ${skipped}`);
    return { pairsProcessed: processed, pairsDiscovered: discovered, pairsSkipped: skipped };
  }

  async getResults(options?: {
    outcomeMetric?: string;
    minR?: number;
    limit?: number;
  }): Promise<any[]> {
    let query = `SELECT * FROM metric_lead_lag_results WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (options?.outcomeMetric) {
      const dbId = translateMetricId(options.outcomeMetric);
      query += ` AND metric_b_id = $${idx++}`;
      params.push(dbId);
    }

    if (options?.minR) {
      query += ` AND ABS(r_at_optimal_lag) >= $${idx++}`;
      params.push(options.minR);
    }

    query += ` ORDER BY ABS(r_at_optimal_lag) DESC`;

    if (options?.limit) {
      query += ` LIMIT $${idx++}`;
      params.push(options.limit);
    }

    const res = await this.pool.query(query, params);
    return res.rows.map(this.formatRow);
  }

  async getMetricLeadLag(metricId: string): Promise<{
    leadsOutcomes: any[];
    ledByMetrics: any[];
  }> {
    const dbId = translateMetricId(metricId);

    const leadsRes = await this.pool.query(
      `SELECT * FROM metric_lead_lag_results
       WHERE metric_a_id = $1
       ORDER BY ABS(r_at_optimal_lag) DESC`,
      [dbId]
    );

    const ledByRes = await this.pool.query(
      `SELECT * FROM metric_lead_lag_results
       WHERE metric_b_id = $1
       ORDER BY ABS(r_at_optimal_lag) DESC`,
      [dbId]
    );

    return {
      leadsOutcomes: leadsRes.rows.map(this.formatRow),
      ledByMetrics: ledByRes.rows.map(this.formatRow),
    };
  }

  async getOutcomeSummary(): Promise<Record<string, any[]>> {
    const result: Record<string, any[]> = {};

    for (const [dbId, label] of Object.entries(OUTCOME_METRIC_LABELS)) {
      const res = await this.pool.query(
        `SELECT * FROM metric_lead_lag_results
         WHERE metric_b_id = $1
         ORDER BY ABS(r_at_optimal_lag) DESC
         LIMIT 10`,
        [dbId]
      );
      result[label] = res.rows.map(this.formatRow);
    }

    return result;
  }

  async getEmpiricalCatalogOverrides(): Promise<Array<{
    metricId: string;
    leadsMetrics: Array<{ metricId: string; lagMonths: number; typicalR: number }>;
    laggedBy: Array<{ metricId: string; leadMonths: number; typicalR: number }>;
    empiricallyValidated: boolean;
  }>> {
    const allRes = await this.pool.query(
      `SELECT * FROM metric_lead_lag_results
       WHERE confidence_level IN ('medium', 'high') AND optimal_lag_months > 0
       ORDER BY metric_a_id, ABS(r_at_optimal_lag) DESC`
    );

    const leadsMap = new Map<string, Array<{ metricId: string; lagMonths: number; typicalR: number }>>();
    const laggedByMap = new Map<string, Array<{ metricId: string; leadMonths: number; typicalR: number }>>();

    for (const row of allRes.rows) {
      const leader = row.metric_a_id;
      const outcome = row.metric_b_id;

      if (!leadsMap.has(leader)) leadsMap.set(leader, []);
      leadsMap.get(leader)!.push({
        metricId: outcome,
        lagMonths: row.optimal_lag_months,
        typicalR: parseFloat(row.r_at_optimal_lag),
      });

      if (!laggedByMap.has(outcome)) laggedByMap.set(outcome, []);
      laggedByMap.get(outcome)!.push({
        metricId: leader,
        leadMonths: row.optimal_lag_months,
        typicalR: parseFloat(row.r_at_optimal_lag),
      });
    }

    const allDbMetrics = new Set([...leadsMap.keys(), ...laggedByMap.keys()]);
    const overrides: Array<{
      metricId: string;
      leadsMetrics: Array<{ metricId: string; lagMonths: number; typicalR: number }>;
      laggedBy: Array<{ metricId: string; leadMonths: number; typicalR: number }>;
      empiricallyValidated: boolean;
    }> = [];

    for (const dbMetricId of allDbMetrics) {
      const primaryCatalogId = reverseTranslateDbIdPrimary(dbMetricId);
      const leads = (leadsMap.get(dbMetricId) || []).map(l => ({
        metricId: reverseTranslateDbIdPrimary(l.metricId),
        lagMonths: l.lagMonths,
        typicalR: l.typicalR,
      }));
      const lagged = (laggedByMap.get(dbMetricId) || []).map(l => ({
        metricId: reverseTranslateDbIdPrimary(l.metricId),
        leadMonths: l.leadMonths,
        typicalR: l.typicalR,
      }));
      overrides.push({
        metricId: primaryCatalogId,
        leadsMetrics: leads,
        laggedBy: lagged,
        empiricallyValidated: true,
      });
    }

    return overrides;
  }

  private formatRow(row: any) {
    return {
      id: row.id,
      metricAId: row.metric_a_id,
      metricBId: row.metric_b_id,
      metricACatalogId: reverseTranslateDbIdPrimary(row.metric_a_id),
      metricBCatalogId: reverseTranslateDbIdPrimary(row.metric_b_id),
      optimalLagMonths: row.optimal_lag_months,
      rAtOptimalLag: parseFloat(row.r_at_optimal_lag),
      rAtZeroLag: parseFloat(row.r_at_zero_lag),
      improvementAbs: parseFloat(row.improvement_abs || '0'),
      improvementPct: parseFloat(row.improvement_pct),
      lagProfile: row.lag_profile,
      geographyType: row.geography_type,
      sampleSize: row.sample_size,
      confidenceLevel: row.confidence_level,
      computedAt: row.computed_at,
    };
  }

  private pearsonR(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 3) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    const num = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0);
    const denX = Math.sqrt(x.reduce((s, xi) => s + (xi - meanX) ** 2, 0));
    const denY = Math.sqrt(y.reduce((s, yi) => s + (yi - meanY) ** 2, 0));

    if (denX === 0 || denY === 0) return 0;
    return num / (denX * denY);
  }
}
