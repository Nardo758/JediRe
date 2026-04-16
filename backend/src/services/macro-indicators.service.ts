import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface MacroIndicatorResult {
  metricId: string;
  metricName: string;
  value: number;
  unit: string;
  periodDate: string;
  source: string;
  confidence: number;
  yoyChange?: number;
  momChange?: number;
  computedAt: string;
}

export interface CpiComparison {
  officialCpi: MacroIndicatorResult | null;
  shadowCpi: MacroIndicatorResult | null;
  methodologyGap: number | null;
  gapSignal: string | null;
}

const SHADOWSTATS_ADJUSTMENT = 5.5;

export class MacroIndicatorsService {
  constructor(private pool: Pool) {}

  async getLatestOilPrice(): Promise<MacroIndicatorResult | null> {
    const result = await this.pool.query(
      `SELECT value, period_date, source, confidence
       FROM metric_time_series
       WHERE metric_id = 'MACRO_OIL_PRICE'
         AND geography_type = 'msa'
       ORDER BY period_date DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const value = parseFloat(row.value);

    const prevResult = await this.pool.query(
      `SELECT value, period_date
       FROM metric_time_series
       WHERE metric_id = 'MACRO_OIL_PRICE'
         AND geography_type = 'msa'
         AND period_date < $1
       ORDER BY period_date DESC
       LIMIT 1`,
      [row.period_date]
    );

    const prevYearResult = await this.pool.query(
      `SELECT value
       FROM metric_time_series
       WHERE metric_id = 'MACRO_OIL_PRICE'
         AND geography_type = 'msa'
         AND period_date <= ($1::date - INTERVAL '1 year')
       ORDER BY period_date DESC
       LIMIT 1`,
      [row.period_date]
    );

    let momChange: number | undefined;
    let yoyChange: number | undefined;

    if (prevResult.rows.length > 0) {
      const prev = parseFloat(prevResult.rows[0].value);
      if (prev > 0) momChange = Math.round(((value - prev) / prev) * 10000) / 100;
    }
    if (prevYearResult.rows.length > 0) {
      const prevYear = parseFloat(prevYearResult.rows[0].value);
      if (prevYear > 0) yoyChange = Math.round(((value - prevYear) / prevYear) * 10000) / 100;
    }

    return {
      metricId: 'MACRO_OIL_PRICE',
      metricName: 'Crude Oil Price (WTI)',
      value: Math.round(value * 100) / 100,
      unit: '$/barrel',
      periodDate: row.period_date,
      source: row.source || 'EIA / FRED',
      confidence: parseFloat(row.confidence) || 0.95,
      yoyChange,
      momChange,
      computedAt: new Date().toISOString(),
    };
  }

  async storeOilPrice(
    price: number,
    periodDate: string,
    source: string = 'EIA / FRED'
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, created_at = NOW()`,
      [
        'MACRO_OIL_PRICE',
        'msa',
        'national',
        'National (WTI)',
        periodDate,
        'daily',
        price,
        source,
        0.99,
      ]
    );
    logger.info(`[MacroIndicators] Stored oil price: $${price} for ${periodDate}`);
  }

  async getLatestCpi(msaGeoId: string = 'national'): Promise<MacroIndicatorResult | null> {
    const result = await this.pool.query(
      `SELECT value, period_date, source, confidence
       FROM metric_time_series
       WHERE metric_id = 'MACRO_CPI_OFFICIAL'
         AND geography_type = 'msa'
         AND geography_id = $1
       ORDER BY period_date DESC
       LIMIT 1`,
      [msaGeoId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      metricId: 'MACRO_CPI_OFFICIAL',
      metricName: 'CPI — Official (BLS)',
      value: Math.round(parseFloat(row.value) * 100) / 100,
      unit: '%',
      periodDate: row.period_date,
      source: row.source || 'Bureau of Labor Statistics',
      confidence: parseFloat(row.confidence) || 0.99,
      computedAt: new Date().toISOString(),
    };
  }

  async storeCpi(
    cpiValue: number,
    periodDate: string,
    msaGeoId: string = 'national',
    msaName: string = 'National',
    source: string = 'Bureau of Labor Statistics CPI-U'
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, created_at = NOW()`,
      [
        'MACRO_CPI_OFFICIAL',
        'msa',
        msaGeoId,
        msaName,
        periodDate,
        'monthly',
        cpiValue,
        source,
        0.99,
      ]
    );
    logger.info(`[MacroIndicators] Stored CPI official: ${cpiValue}% for ${msaGeoId} on ${periodDate}`);
  }

  computeShadowStatsCpi(officialCpiYoY: number): number {
    return Math.round((officialCpiYoY + SHADOWSTATS_ADJUSTMENT) * 100) / 100;
  }

  async getLatestShadowCpi(msaGeoId: string = 'national'): Promise<MacroIndicatorResult | null> {
    const stored = await this.pool.query(
      `SELECT value, period_date, source, confidence
       FROM metric_time_series
       WHERE metric_id = 'MACRO_CPI_SHADOW'
         AND geography_type = 'msa'
         AND geography_id = $1
       ORDER BY period_date DESC
       LIMIT 1`,
      [msaGeoId]
    );

    if (stored.rows.length > 0) {
      const row = stored.rows[0];
      return {
        metricId: 'MACRO_CPI_SHADOW',
        metricName: 'CPI — ShadowStats (1980-Based)',
        value: Math.round(parseFloat(row.value) * 100) / 100,
        unit: '%',
        periodDate: row.period_date,
        source: row.source || 'ShadowStats.com (1980-based methodology)',
        confidence: parseFloat(row.confidence) || 0.7,
        computedAt: new Date().toISOString(),
      };
    }

    const officialCpi = await this.getLatestCpi(msaGeoId);
    if (!officialCpi) return null;

    const shadowValue = this.computeShadowStatsCpi(officialCpi.value);
    return {
      metricId: 'MACRO_CPI_SHADOW',
      metricName: 'CPI — ShadowStats (1980-Based)',
      value: shadowValue,
      unit: '%',
      periodDate: officialCpi.periodDate,
      source: `ShadowStats.com (1980-based methodology, +${SHADOWSTATS_ADJUSTMENT}pp adjustment)`,
      confidence: 0.7,
      computedAt: new Date().toISOString(),
    };
  }

  async storeShadowCpi(
    shadowCpiValue: number,
    periodDate: string,
    msaGeoId: string = 'national',
    msaName: string = 'National'
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, created_at = NOW()`,
      [
        'MACRO_CPI_SHADOW',
        'msa',
        msaGeoId,
        msaName,
        periodDate,
        'monthly',
        shadowCpiValue,
        'ShadowStats.com (1980-based methodology)',
        0.7,
      ]
    );
    logger.info(`[MacroIndicators] Stored ShadowStats CPI: ${shadowCpiValue}% for ${msaGeoId} on ${periodDate}`);
  }

  async getCpiComparison(msaGeoId: string = 'national'): Promise<CpiComparison> {
    const [officialCpi, shadowCpi] = await Promise.all([
      this.getLatestCpi(msaGeoId),
      this.getLatestShadowCpi(msaGeoId),
    ]);

    let methodologyGap: number | null = null;
    let gapSignal: string | null = null;

    if (officialCpi && shadowCpi) {
      methodologyGap = Math.round((shadowCpi.value - officialCpi.value) * 100) / 100;

      if (methodologyGap > 8) {
        gapSignal = 'Wide gap — real cost-of-living pressure significantly exceeds official data. Tenant affordability risk elevated. CRE real returns may be overstated.';
      } else if (methodologyGap > 6) {
        gapSignal = 'Moderate gap — meaningful divergence between official and pre-1983 methodology. Monitor tenant cost burden.';
      } else if (methodologyGap > 4) {
        gapSignal = 'Typical gap — consistent with normal methodological differences. Official CPI reasonably reliable.';
      } else {
        gapSignal = 'Narrow gap — methodologies converging. Official numbers closely reflect actual inflation experience.';
      }
    }

    return { officialCpi, shadowCpi, methodologyGap, gapSignal };
  }

  async storeOfficialAndShadowCpi(
    officialCpiYoY: number,
    periodDate: string,
    msaGeoId: string = 'national',
    msaName: string = 'National'
  ): Promise<CpiComparison> {
    await this.storeCpi(officialCpiYoY, periodDate, msaGeoId, msaName);

    const shadowValue = this.computeShadowStatsCpi(officialCpiYoY);
    await this.storeShadowCpi(shadowValue, periodDate, msaGeoId, msaName);

    return this.getCpiComparison(msaGeoId);
  }
}
