import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { MetricCorrelationEngine } from './metric-correlation-engine.service';

export interface ProjectedValue {
  date: string;
  value: number;
  lower_ci_80: number;
  upper_ci_80: number;
  lower_ci_95: number;
  upper_ci_95: number;
}

export interface ProjectionResult {
  metricId: string;
  geographyType: string;
  geographyId: string;
  horizonMonths: number;
  method: 'ols_linear' | 'ols_seasonal' | 'anchor_correlation';
  rSquared: number;
  trainingMonths: number;
  confidence: 'high' | 'medium' | 'low';
  projectedValues: ProjectedValue[];
  anchorMetric?: string;
  anchorLagMonths?: number;
  anchorR?: number;
}

const CACHE_DAYS = 30;

const ANCHOR_CONFIGS: Record<string, Array<{ anchorMetricId: string; anchorGeoType: string }>> = {
  'C_TRAFFIC_GROWTH_INDEX': [
    { anchorMetricId: 'rent_index_yoy', anchorGeoType: 'metro' },
    { anchorMetricId: 'home_value_index_yoy', anchorGeoType: 'metro' },
  ],
  'C_SURGE_INDEX': [
    { anchorMetricId: 'rent_index_yoy', anchorGeoType: 'metro' },
    { anchorMetricId: 'home_value_index_yoy', anchorGeoType: 'metro' },
  ],
  'T_AADT_YOY': [
    { anchorMetricId: 'home_value_index_yoy', anchorGeoType: 'metro' },
    { anchorMetricId: 'rent_index_yoy', anchorGeoType: 'metro' },
  ],
  'F_RENT_GROWTH': [
    { anchorMetricId: 'home_value_index_yoy', anchorGeoType: 'metro' },
    { anchorMetricId: 'rent_index_yoy', anchorGeoType: 'metro' },
  ],
};

export class MetricProjectionService {
  private correlationEngine: MetricCorrelationEngine;

  constructor(private pool: Pool) {
    this.correlationEngine = new MetricCorrelationEngine(pool);
  }

  async getProjection(
    metricId: string,
    geoType: string,
    geoId: string,
    horizonMonths: number = 60,
  ): Promise<ProjectionResult | null> {
    if (horizonMonths < 1 || horizonMonths > 60) horizonMonths = 60;

    const cached = await this.getCachedProjection(metricId, geoType, geoId, horizonMonths);
    if (cached) return cached;

    const anchorChain = ANCHOR_CONFIGS[metricId];
    if (anchorChain) {
      for (const anchorConfig of anchorChain) {
        const result = await this.projectAnchorCorrelation(
          metricId, geoType, geoId, horizonMonths,
          anchorConfig.anchorMetricId, anchorConfig.anchorGeoType,
        );
        if (result) {
          await this.cacheProjection(result);
          return result;
        }
      }
    }

    const series = await this.fetchSeries(metricId, geoType, geoId);

    if (series.length >= 60) {
      const result = this.projectOLS(metricId, geoType, geoId, series, horizonMonths, true);
      await this.cacheProjection(result);
      return result;
    }

    if (series.length >= 24) {
      const result = this.projectOLS(metricId, geoType, geoId, series, horizonMonths, false);
      await this.cacheProjection(result);
      return result;
    }

    if (series.length >= 6) {
      const result = this.projectOLS(metricId, geoType, geoId, series, horizonMonths, false);
      await this.cacheProjection(result);
      return result;
    }

    return null;
  }

  private projectOLS(
    metricId: string,
    geoType: string,
    geoId: string,
    series: Array<{ date: string; value: number }>,
    horizonMonths: number,
    seasonal: boolean,
  ): ProjectionResult {
    const n = series.length;
    const values = series.map(s => s.value);
    const X: number[][] = [];
    const y = values;

    for (let i = 0; i < n; i++) {
      const row: number[] = [1, i];
      if (seasonal) {
        const month = new Date(series[i].date).getMonth();
        for (let m = 0; m < 11; m++) {
          row.push(month === m ? 1 : 0);
        }
      }
      X.push(row);
    }

    const coeffs = this.olsFit(X, y);

    let ssRes = 0, ssTot = 0;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) {
      const predicted = this.dotProduct(X[i], coeffs);
      ssRes += (y[i] - predicted) ** 2;
      ssTot += (y[i] - meanY) ** 2;
    }
    const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    const rmse = Math.sqrt(ssRes / Math.max(1, n - coeffs.length));

    const lastDate = new Date(series[n - 1].date);
    const projectedValues: ProjectedValue[] = [];

    for (let h = 1; h <= horizonMonths; h++) {
      const futureDate = new Date(lastDate);
      futureDate.setMonth(futureDate.getMonth() + h);
      const futureT = n - 1 + h;

      const row: number[] = [1, futureT];
      if (seasonal) {
        const month = futureDate.getMonth();
        for (let m = 0; m < 11; m++) {
          row.push(month === m ? 1 : 0);
        }
      }

      const predicted = this.dotProduct(row, coeffs);
      const horizonFactor = Math.sqrt(1 + h / n);
      const ci80 = 1.28 * rmse * horizonFactor;
      const ci95 = 1.96 * rmse * horizonFactor;

      projectedValues.push({
        date: futureDate.toISOString().substring(0, 10),
        value: Math.round(predicted * 1000) / 1000,
        lower_ci_80: Math.round((predicted - ci80) * 1000) / 1000,
        upper_ci_80: Math.round((predicted + ci80) * 1000) / 1000,
        lower_ci_95: Math.round((predicted - ci95) * 1000) / 1000,
        upper_ci_95: Math.round((predicted + ci95) * 1000) / 1000,
      });
    }

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (n >= 120 && rSquared > 0.5) confidence = 'high';
    else if (n >= 60 && rSquared > 0.3) confidence = 'medium';
    else if (n >= 24 && rSquared > 0.2) confidence = 'medium';

    return {
      metricId,
      geographyType: geoType,
      geographyId: geoId,
      horizonMonths,
      method: seasonal ? 'ols_seasonal' : 'ols_linear',
      rSquared: Math.round(rSquared * 1000) / 1000,
      trainingMonths: n,
      confidence,
      projectedValues,
    };
  }

  private async getPersistedCorrelation(
    anchorMetricId: string,
    metricId: string,
    geoType: string,
    geoId: string,
  ): Promise<{ correlationR: number; bestLagMonths: number } | null> {
    const result = await this.pool.query(
      `SELECT correlation_r, lead_lag_months FROM metric_correlations
       WHERE metric_a = $1 AND metric_b = $2 AND geography_type = $3 AND geography_id = $4
       ORDER BY ABS(correlation_r) DESC LIMIT 1`,
      [anchorMetricId, metricId, geoType, geoId],
    );
    if (result.rows.length === 0) return null;
    return {
      correlationR: parseFloat(result.rows[0].correlation_r),
      bestLagMonths: parseInt(result.rows[0].lead_lag_months),
    };
  }

  private async projectAnchorCorrelation(
    metricId: string,
    geoType: string,
    geoId: string,
    horizonMonths: number,
    anchorMetricId: string,
    anchorGeoType: string,
  ): Promise<ProjectionResult | null> {
    const anchorSeries = await this.fetchSeries(anchorMetricId, anchorGeoType, geoId);
    if (anchorSeries.length < 60) return null;

    const targetSeries = await this.fetchSeries(metricId, geoType, geoId);
    if (targetSeries.length < 3) return null;

    let bestR: number;
    let bestLag: number;

    const persisted = await this.getPersistedCorrelation(anchorMetricId, metricId, anchorGeoType, geoId);
    if (persisted && Math.abs(persisted.correlationR) >= 0.2) {
      bestR = persisted.correlationR;
      bestLag = persisted.bestLagMonths;
    } else {
      const sweep = this.correlationEngine.sweepLagsDirect(anchorSeries, targetSeries);
      if (sweep.sweepResults.length === 0 || Math.abs(sweep.bestR) < 0.2) {
        return null;
      }
      bestR = sweep.bestR;
      bestLag = sweep.bestLag;
    }

    const anchorProjection = this.projectOLS(
      anchorMetricId, anchorGeoType, geoId, anchorSeries, horizonMonths + Math.abs(bestLag), true,
    );

    const targetMean = targetSeries.reduce((a, b) => a + b.value, 0) / targetSeries.length;
    const targetStd = Math.sqrt(
      targetSeries.reduce((a, b) => a + (b.value - targetMean) ** 2, 0) / targetSeries.length,
    );

    const anchorValues = anchorSeries.map(s => s.value);
    const anchorMean = anchorValues.reduce((a, b) => a + b, 0) / anchorValues.length;
    const anchorStd = Math.sqrt(
      anchorValues.reduce((a, b) => a + (b - anchorMean) ** 2, 0) / anchorValues.length,
    );

    const uncertaintyExpansion = 1 + (1 - Math.abs(bestR));

    const projectedValues: ProjectedValue[] = [];
    const lagOffset = bestLag;

    for (let h = 1; h <= horizonMonths; h++) {
      const anchorIdx = h + lagOffset - 1;
      if (anchorIdx < 0 || anchorIdx >= anchorProjection.projectedValues.length) continue;

      const anchorPV = anchorProjection.projectedValues[anchorIdx];
      const anchorZ = anchorStd > 0 ? (anchorPV.value - anchorMean) / anchorStd : 0;
      const derivedValue = targetMean + bestR * anchorZ * targetStd;

      const anchorCI80 = (anchorPV.upper_ci_80 - anchorPV.lower_ci_80) / 2;
      const anchorCI95 = (anchorPV.upper_ci_95 - anchorPV.lower_ci_95) / 2;
      const derivedCI80 = anchorCI80 * uncertaintyExpansion * (targetStd / Math.max(anchorStd, 0.001));
      const derivedCI95 = anchorCI95 * uncertaintyExpansion * (targetStd / Math.max(anchorStd, 0.001));

      const futureDate = new Date(targetSeries[targetSeries.length - 1].date);
      futureDate.setMonth(futureDate.getMonth() + h);

      projectedValues.push({
        date: futureDate.toISOString().substring(0, 10),
        value: Math.round(derivedValue * 1000) / 1000,
        lower_ci_80: Math.round((derivedValue - derivedCI80) * 1000) / 1000,
        upper_ci_80: Math.round((derivedValue + derivedCI80) * 1000) / 1000,
        lower_ci_95: Math.round((derivedValue - derivedCI95) * 1000) / 1000,
        upper_ci_95: Math.round((derivedValue + derivedCI95) * 1000) / 1000,
      });
    }

    const rSquared = bestR * bestR * anchorProjection.rSquared;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (Math.abs(bestR) > 0.6 && anchorProjection.trainingMonths >= 120) confidence = 'medium';
    if (Math.abs(bestR) > 0.7 && anchorProjection.trainingMonths >= 200) confidence = 'high';

    return {
      metricId,
      geographyType: geoType,
      geographyId: geoId,
      horizonMonths,
      method: 'anchor_correlation',
      rSquared: Math.round(rSquared * 1000) / 1000,
      trainingMonths: targetSeries.length,
      confidence,
      projectedValues,
      anchorMetric: anchorMetricId,
      anchorLagMonths: bestLag,
      anchorR: Math.round(bestR * 1000) / 1000,
    };
  }

  private olsFit(X: number[][], y: number[]): number[] {
    const n = X.length;
    const p = X[0].length;

    const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    const Xty: number[] = Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        Xty[j] += X[i][j] * y[i];
        for (let k = 0; k < p; k++) {
          XtX[j][k] += X[i][j] * X[i][k];
        }
      }
    }

    return this.solveLinearSystem(XtX, Xty);
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
          maxRow = row;
        }
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

      if (Math.abs(aug[col][col]) < 1e-12) {
        aug[col][col] = 1e-12;
      }

      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }

    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i] || 1e-12;
    }

    return x;
  }

  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private async fetchSeries(
    metricId: string,
    geoType: string,
    geoId: string,
  ): Promise<Array<{ date: string; value: number }>> {
    const result = await this.pool.query(
      `SELECT period_date::text as date, value
       FROM metric_time_series
       WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
       ORDER BY period_date ASC`,
      [metricId, geoType, geoId],
    );
    return result.rows;
  }

  private async getCachedProjection(
    metricId: string,
    geoType: string,
    geoId: string,
    horizonMonths: number,
  ): Promise<ProjectionResult | null> {
    const result = await this.pool.query(
      `SELECT * FROM metric_projections
       WHERE metric_id = $1 AND geography_type = $2 AND geography_id = $3
         AND horizon_months = $4
         AND computed_at > NOW() - INTERVAL '${CACHE_DAYS} days'
       LIMIT 1`,
      [metricId, geoType, geoId, horizonMonths],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      metricId: row.metric_id,
      geographyType: row.geography_type,
      geographyId: row.geography_id,
      horizonMonths: row.horizon_months,
      method: row.method,
      rSquared: row.r_squared,
      trainingMonths: row.training_months,
      confidence: row.confidence,
      projectedValues: row.projected_values,
    };
  }

  private async cacheProjection(result: ProjectionResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO metric_projections
         (metric_id, geography_type, geography_id, horizon_months,
          projected_values, r_squared, method, training_months, confidence, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (metric_id, geography_type, geography_id, horizon_months)
         DO UPDATE SET
           projected_values = EXCLUDED.projected_values,
           r_squared = EXCLUDED.r_squared,
           method = EXCLUDED.method,
           training_months = EXCLUDED.training_months,
           confidence = EXCLUDED.confidence,
           computed_at = NOW()`,
        [
          result.metricId, result.geographyType, result.geographyId,
          result.horizonMonths, JSON.stringify(result.projectedValues),
          result.rSquared, result.method, result.trainingMonths, result.confidence,
        ],
      );
    } catch (err: any) {
      logger.warn(`[ProjectionEngine] Cache write failed: ${err.message}`);
    }
  }
}
