import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface MSABoundingBox {
  msaId: string;
  msaName: string;
  state: string;
  centerLat: number;
  centerLng: number;
  counties: string[];
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

const FL_MSAS: MSABoundingBox[] = [
  {
    msaId: '33100', msaName: 'Miami', state: 'FL',
    centerLat: 25.95, centerLng: -80.25,
    counties: ['Miami-Dade', 'Broward', 'Palm Beach'],
    latMin: 25.1, latMax: 27.0, lngMin: -80.9, lngMax: -79.9,
  },
  {
    msaId: '36740', msaName: 'Orlando', state: 'FL',
    centerLat: 28.54, centerLng: -81.38,
    counties: ['Orange', 'Seminole', 'Osceola', 'Lake'],
    latMin: 28.0, latMax: 29.2, lngMin: -82.0, lngMax: -80.8,
  },
  {
    msaId: '45300', msaName: 'Tampa-St Petersburg', state: 'FL',
    centerLat: 27.95, centerLng: -82.46,
    counties: ['Hillsborough', 'Pinellas', 'Pasco', 'Hernando'],
    latMin: 27.5, latMax: 28.7, lngMin: -83.0, lngMax: -82.0,
  },
  {
    msaId: '27260', msaName: 'Jacksonville', state: 'FL',
    centerLat: 30.33, centerLng: -81.66,
    counties: ['Duval', 'St. Johns', 'Clay', 'Nassau'],
    latMin: 29.7, latMax: 30.9, lngMin: -82.2, lngMax: -81.1,
  },
  {
    msaId: '38940', msaName: 'Port St Lucie', state: 'FL',
    centerLat: 27.27, centerLng: -80.35,
    counties: ['St. Lucie', 'Martin'],
    latMin: 26.9, latMax: 27.6, lngMin: -80.7, lngMax: -80.0,
  },
  {
    msaId: '15980', msaName: 'Cape Coral', state: 'FL',
    centerLat: 26.64, centerLng: -81.87,
    counties: ['Lee'],
    latMin: 26.2, latMax: 27.0, lngMin: -82.3, lngMax: -81.5,
  },
  {
    msaId: '19660', msaName: 'Deltona', state: 'FL',
    centerLat: 29.03, centerLng: -81.22,
    counties: ['Volusia', 'Flagler'],
    latMin: 28.7, latMax: 29.7, lngMin: -81.7, lngMax: -80.8,
  },
  {
    msaId: '29460', msaName: 'Lakeland', state: 'FL',
    centerLat: 28.04, centerLng: -81.95,
    counties: ['Polk'],
    latMin: 27.6, latMax: 28.4, lngMin: -82.2, lngMax: -81.2,
  },
  {
    msaId: '37340', msaName: 'Palm Bay', state: 'FL',
    centerLat: 28.24, centerLng: -80.72,
    counties: ['Brevard'],
    latMin: 27.8, latMax: 28.7, lngMin: -81.1, lngMax: -80.4,
  },
  {
    msaId: '35840', msaName: 'North Port', state: 'FL',
    centerLat: 27.14, centerLng: -82.18,
    counties: ['Sarasota', 'Manatee', 'Charlotte'],
    latMin: 26.8, latMax: 27.6, lngMin: -82.7, lngMax: -81.8,
  },
  {
    msaId: '37860', msaName: 'Pensacola', state: 'FL',
    centerLat: 30.44, centerLng: -87.22,
    counties: ['Escambia', 'Santa Rosa'],
    latMin: 30.2, latMax: 31.0, lngMin: -87.7, lngMax: -86.6,
  },
  {
    msaId: '23540', msaName: 'Gainesville', state: 'FL',
    centerLat: 29.65, centerLng: -82.32,
    counties: ['Alachua'],
    latMin: 29.3, latMax: 30.0, lngMin: -82.7, lngMax: -82.0,
  },
];

const GA_MSAS: MSABoundingBox[] = [
  {
    msaId: '12060', msaName: 'Atlanta', state: 'GA',
    centerLat: 33.75, centerLng: -84.39,
    counties: ['Fulton', 'DeKalb', 'Cobb', 'Gwinnett', 'Clayton'],
    latMin: 33.2, latMax: 34.4, lngMin: -85.0, lngMax: -83.8,
  },
  {
    msaId: '42340', msaName: 'Savannah', state: 'GA',
    centerLat: 32.08, centerLng: -81.09,
    counties: ['Chatham'],
    latMin: 31.7, latMax: 32.5, lngMin: -81.5, lngMax: -80.8,
  },
];

const TX_MSAS: MSABoundingBox[] = [
  {
    msaId: '26420', msaName: 'Houston', state: 'TX',
    centerLat: 29.76, centerLng: -95.37,
    counties: ['Harris'],
    latMin: 29.3, latMax: 30.3, lngMin: -96.0, lngMax: -94.8,
  },
  {
    msaId: '19100', msaName: 'Dallas', state: 'TX',
    centerLat: 32.78, centerLng: -96.80,
    counties: ['Dallas', 'Tarrant'],
    latMin: 32.3, latMax: 33.4, lngMin: -97.5, lngMax: -96.3,
  },
  {
    msaId: '12420', msaName: 'Austin', state: 'TX',
    centerLat: 30.27, centerLng: -97.74,
    counties: ['Travis'],
    latMin: 29.8, latMax: 30.8, lngMin: -98.2, lngMax: -97.2,
  },
  {
    msaId: '41700', msaName: 'San Antonio', state: 'TX',
    centerLat: 29.42, centerLng: -98.49,
    counties: ['Bexar'],
    latMin: 29.0, latMax: 29.9, lngMin: -99.0, lngMax: -98.0,
  },
];

const NC_MSAS: MSABoundingBox[] = [
  {
    msaId: '16740', msaName: 'Charlotte', state: 'NC',
    centerLat: 35.23, centerLng: -80.84,
    counties: ['Mecklenburg'],
    latMin: 34.8, latMax: 35.6, lngMin: -81.4, lngMax: -80.3,
  },
  {
    msaId: '39580', msaName: 'Raleigh', state: 'NC',
    centerLat: 35.78, centerLng: -78.64,
    counties: ['Wake'],
    latMin: 35.3, latMax: 36.2, lngMin: -79.1, lngMax: -78.1,
  },
];

const ALL_MSAS: Record<string, MSABoundingBox[]> = {
  FL: FL_MSAS,
  GA: GA_MSAS,
  TX: TX_MSAS,
  NC: NC_MSAS,
};

export interface AggregationResult {
  msasProcessed: number;
  timeSeriesUpserted: number;
  yoyComputed: number;
  errors: string[];
  durationMs: number;
}

export class DotAggregatorService {
  constructor(private pool: Pool) {}

  async aggregateToGeographies(state?: string): Promise<AggregationResult> {
    const start = Date.now();
    const errors: string[] = [];
    let msasProcessed = 0;
    let timeSeriesUpserted = 0;
    let yoyComputed = 0;

    const statesToProcess = state ? [state.toUpperCase()] : Object.keys(ALL_MSAS);

    for (const st of statesToProcess) {
      const msas = ALL_MSAS[st];
      if (!msas) {
        errors.push(`No MSA definitions for state: ${st}`);
        continue;
      }

      for (const msa of msas) {
        try {
          const aadtByYear = await this.getAggregatedAADTByBBox(msa);

          if (Object.keys(aadtByYear).length === 0) {
            logger.debug(`[DotAggregator] No AADT data for ${msa.msaName} (${msa.msaId})`);
            continue;
          }

          await this.ensureGeography(msa.msaId, msa.msaName, msa.state);

          for (const [yearStr, medianAadt] of Object.entries(aadtByYear)) {
            const year = parseInt(yearStr, 10);
            await this.upsertTimeSeries(
              'T_AADT',
              'msa',
              msa.msaId,
              msa.msaName,
              `${year}-01-01`,
              'annual',
              medianAadt,
              `DOT_${st}`,
            );
            timeSeriesUpserted++;
          }

          const years = Object.keys(aadtByYear).map(Number).sort();
          for (let i = 1; i < years.length; i++) {
            const prevYear = years[i - 1];
            const currYear = years[i];
            const prevVal = aadtByYear[prevYear];
            const currVal = aadtByYear[currYear];

            if (prevVal > 0) {
              const yoy = ((currVal - prevVal) / prevVal) * 100;
              await this.upsertTimeSeries(
                'T_AADT_YOY',
                'msa',
                msa.msaId,
                msa.msaName,
                `${currYear}-01-01`,
                'annual',
                Math.round(yoy * 100) / 100,
                `DOT_${st}`,
              );
              yoyComputed++;
            }
          }

          msasProcessed++;
          logger.info(`[DotAggregator] ${msa.msaName}: ${Object.keys(aadtByYear).length} years of AADT data aggregated`);
        } catch (err: any) {
          errors.push(`MSA ${msa.msaId} (${msa.msaName}): ${err.message}`);
          logger.error(`[DotAggregator] Failed to process MSA ${msa.msaId}`, { error: err.message });
        }
      }
    }

    logger.info(`[DotAggregator] Complete: ${msasProcessed} MSAs, ${timeSeriesUpserted} series, ${yoyComputed} YoY computed`);

    return {
      msasProcessed,
      timeSeriesUpserted,
      yoyComputed,
      errors,
      durationMs: Date.now() - start,
    };
  }

  private async getAggregatedAADTByBBox(msa: MSABoundingBox): Promise<Record<number, number>> {
    const result = await this.pool.query(
      `SELECT
        measurement_year,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY adt) as median_adt,
        COUNT(*) as station_count,
        AVG(adt) as avg_adt
      FROM adt_counts
      WHERE state = $1
        AND latitude BETWEEN $2 AND $3
        AND longitude BETWEEN $4 AND $5
        AND adt > 0
        AND measurement_year IS NOT NULL
      GROUP BY measurement_year
      HAVING COUNT(*) >= 3
      ORDER BY measurement_year`,
      [msa.state, msa.latMin, msa.latMax, msa.lngMin, msa.lngMax]
    );

    const aadtByYear: Record<number, number> = {};
    for (const row of result.rows) {
      aadtByYear[row.measurement_year] = Math.round(parseFloat(row.median_adt));
    }
    return aadtByYear;
  }

  private async ensureGeography(msaId: string, msaName: string, state: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO geographies (id, type, name, state)
       VALUES ($1, 'msa', $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [msaId, msaName, state]
    );
  }

  private async upsertTimeSeries(
    metricId: string,
    geoType: string,
    geoId: string,
    geoName: string,
    periodDate: string,
    periodType: string,
    value: number,
    source: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, created_at = NOW()`,
      [metricId, geoType, geoId, geoName, periodDate, periodType, value, source]
    );
  }

  async getAADTHistory(geoId: string, geoType: string = 'msa'): Promise<{
    geography: { id: string; type: string; name: string | null };
    aadt: Array<{ year: number; value: number; source: string }>;
    yoy: Array<{ year: number; value: number }>;
    statistics: { latestYear: number | null; latestAADT: number | null; avgGrowth: number | null; dataPoints: number };
  }> {
    const geoResult = await this.pool.query(
      'SELECT id, type, name FROM geographies WHERE id = $1',
      [geoId]
    );

    const geography = geoResult.rows[0] || { id: geoId, type: geoType, name: null };

    const aadtResult = await this.pool.query(
      `SELECT period_date, value, source
       FROM metric_time_series
       WHERE metric_id = 'T_AADT' AND geography_type = $1 AND geography_id = $2
       ORDER BY period_date ASC`,
      [geoType, geoId]
    );

    const yoyResult = await this.pool.query(
      `SELECT period_date, value
       FROM metric_time_series
       WHERE metric_id = 'T_AADT_YOY' AND geography_type = $1 AND geography_id = $2
       ORDER BY period_date ASC`,
      [geoType, geoId]
    );

    const aadt = aadtResult.rows.map(r => ({
      year: new Date(r.period_date).getFullYear(),
      value: parseFloat(r.value),
      source: r.source,
    }));

    const yoy = yoyResult.rows.map(r => ({
      year: new Date(r.period_date).getFullYear(),
      value: parseFloat(r.value),
    }));

    const latestAADT = aadt.length > 0 ? aadt[aadt.length - 1] : null;
    const avgGrowth = yoy.length > 0 ? yoy.reduce((s, r) => s + r.value, 0) / yoy.length : null;

    return {
      geography: { id: geography.id, type: geography.type, name: geography.name },
      aadt,
      yoy,
      statistics: {
        latestYear: latestAADT?.year || null,
        latestAADT: latestAADT?.value || null,
        avgGrowth: avgGrowth !== null ? Math.round(avgGrowth * 100) / 100 : null,
        dataPoints: aadt.length,
      },
    };
  }
}
