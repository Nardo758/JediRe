import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface CorrelationResult {
  metricA: string;
  metricB: string;
  geographyType: string;
  geographyId: string;
  bestLagMonths: number;
  correlationR: number;
  pValue: number | null;
  sampleSize: number;
  windowMonths: number;
}

export interface CorrelationSweepResult {
  bestLag: number;
  bestR: number;
  sweepResults: Array<{ lagMonths: number; r: number; n: number }>;
}

export class MetricCorrelationEngine {
  constructor(private pool: Pool) {}

  private pearsonR(x: number[], y: number[]): { r: number; n: number } {
    const n = Math.min(x.length, y.length);
    if (n < 5) return { r: 0, n };

    const xs = x.slice(0, n);
    const ys = y.slice(0, n);

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    if (sumX2 === 0 || sumY2 === 0) return { r: 0, n };
    const r = sumXY / Math.sqrt(sumX2 * sumY2);
    return { r, n };
  }

  private approximatePValue(r: number, n: number): number | null {
    if (n < 5) return null;
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;
    const x = df / (df + t * t);
    const p = this.incompleteBeta(df / 2, 0.5, x);
    return Math.min(1, Math.max(0, p));
  }

  private incompleteBeta(a: number, b: number, x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let sum = 0;
    let term = 1;
    for (let k = 0; k < 200; k++) {
      if (k > 0) {
        term *= (a + k - 1) * x / k;
        term /= (a + b + k - 1);
      }
      const inc = term / (a + k);
      sum += inc;
      if (Math.abs(inc) < 1e-10) break;
    }
    return Math.pow(x, a) * Math.pow(1 - x, b) * sum * this.gamma(a + b) / (this.gamma(a) * this.gamma(b));
  }

  private gamma(z: number): number {
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * this.gamma(1 - z));
    }
    z -= 1;
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (z + i);
    }
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  async sweepLags(
    metricA: string,
    metricB: string,
    geoType: string,
    geoId: string,
    maxLag: number = 24,
    stepMonths: number = 3,
  ): Promise<CorrelationSweepResult> {
    const seriesA = await this.fetchSeries(metricA, geoType, geoId);
    const seriesB = await this.fetchSeries(metricB, geoType, geoId);

    if (seriesA.length < 10 || seriesB.length < 10) {
      return { bestLag: 0, bestR: 0, sweepResults: [] };
    }

    const sweepResults: Array<{ lagMonths: number; r: number; n: number }> = [];
    let bestLag = 0;
    let bestAbsR = 0;
    let bestR = 0;

    for (let lag = -maxLag; lag <= maxLag; lag += stepMonths) {
      const { aligned_a, aligned_b } = this.alignWithLag(seriesA, seriesB, lag);
      const { r, n } = this.pearsonR(aligned_a, aligned_b);
      sweepResults.push({ lagMonths: lag, r, n });
      if (Math.abs(r) > bestAbsR) {
        bestAbsR = Math.abs(r);
        bestR = r;
        bestLag = lag;
      }
    }

    return { bestLag, bestR, sweepResults };
  }

  private toYearMonth(dateStr: string): string {
    return dateStr.substring(0, 7);
  }

  private shiftYearMonth(ym: string, months: number): string {
    const [y, m] = ym.split('-').map(Number);
    const totalMonths = y * 12 + (m - 1) + months;
    const newY = Math.floor(totalMonths / 12);
    const newM = (totalMonths % 12) + 1;
    return `${newY}-${String(newM).padStart(2, '0')}`;
  }

  private alignWithLag(
    seriesA: Array<{ date: string; value: number }>,
    seriesB: Array<{ date: string; value: number }>,
    lagMonths: number,
  ): { aligned_a: number[]; aligned_b: number[] } {
    const mapB = new Map<string, number>();
    for (const s of seriesB) {
      mapB.set(this.toYearMonth(s.date), s.value);
    }

    const aligned_a: number[] = [];
    const aligned_b: number[] = [];

    for (const a of seriesA) {
      const aYM = this.toYearMonth(a.date);
      const laggedYM = this.shiftYearMonth(aYM, lagMonths);
      const bVal = mapB.get(laggedYM);
      if (bVal !== undefined) {
        aligned_a.push(a.value);
        aligned_b.push(bVal);
      }
    }

    return { aligned_a, aligned_b };
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

  async computeAndUpsert(
    metricA: string,
    metricB: string,
    geoType: string,
    geoId: string,
    windowMonths: number = 60,
  ): Promise<CorrelationResult | null> {
    const sweep = await this.sweepLags(metricA, metricB, geoType, geoId);
    if (sweep.sweepResults.length === 0) return null;

    const pValue = this.approximatePValue(sweep.bestR, sweep.sweepResults.find(s => s.lagMonths === sweep.bestLag)?.n || 0);

    const bestEntry = sweep.sweepResults.find(s => s.lagMonths === sweep.bestLag);

    await this.pool.query(
      `INSERT INTO metric_correlations
       (metric_a, metric_b, geography_type, geography_id, window_months,
        correlation_r, lead_lag_months, p_value, sample_size, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (metric_a, metric_b, geography_type, geography_id, window_months)
       DO UPDATE SET
         correlation_r = EXCLUDED.correlation_r,
         lead_lag_months = EXCLUDED.lead_lag_months,
         p_value = EXCLUDED.p_value,
         sample_size = EXCLUDED.sample_size,
         computed_at = NOW()`,
      [
        metricA, metricB, geoType, geoId, windowMonths,
        sweep.bestR, sweep.bestLag,
        pValue, bestEntry?.n || 0,
      ],
    );

    return {
      metricA,
      metricB,
      geographyType: geoType,
      geographyId: geoId,
      bestLagMonths: sweep.bestLag,
      correlationR: sweep.bestR,
      pValue,
      sampleSize: bestEntry?.n || 0,
      windowMonths,
    };
  }

  async seedCorePairs(): Promise<{ computed: number; skipped: number }> {
    const corePairs = [
      { a: 'home_value_index_yoy', b: 'rent_index_yoy' },
      { a: 'rent_index_yoy', b: 'home_value_index_yoy' },
    ];

    const geos = await this.pool.query(
      `SELECT DISTINCT geography_id FROM metric_time_series
       WHERE metric_id = 'home_value_index_yoy' AND geography_type = 'metro'`,
    );

    let computed = 0;
    let skipped = 0;

    for (const pair of corePairs) {
      for (const geo of geos.rows) {
        try {
          const result = await this.computeAndUpsert(
            pair.a, pair.b, 'metro', geo.geography_id, 60,
          );
          if (result && Math.abs(result.correlationR) > 0.1) {
            computed++;
          } else {
            skipped++;
          }
        } catch (err: any) {
          skipped++;
        }
      }
    }

    logger.info(`[CorrelationEngine] Seeded ${computed} correlations, skipped ${skipped}`);
    return { computed, skipped };
  }

  async getCorrelations(
    metricA?: string,
    metricB?: string,
    geoType?: string,
    geoId?: string,
  ): Promise<any[]> {
    let query = `SELECT * FROM metric_correlations WHERE 1=1`;
    const params: any[] = [];

    if (metricA) {
      params.push(metricA);
      query += ` AND metric_a = $${params.length}`;
    }
    if (metricB) {
      params.push(metricB);
      query += ` AND metric_b = $${params.length}`;
    }
    if (geoType) {
      params.push(geoType);
      query += ` AND geography_type = $${params.length}`;
    }
    if (geoId) {
      params.push(geoId);
      query += ` AND geography_id = $${params.length}`;
    }

    query += ` ORDER BY ABS(correlation_r) DESC LIMIT 100`;
    const result = await this.pool.query(query, params);
    return result.rows;
  }
}
