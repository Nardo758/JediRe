import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface TrafficGrowthResult {
  propertyId: string;
  googleRealtimeAdt: number;
  dotHistoricalAvgAdt: number;
  trafficGrowthIndex: number;
  confidence: number;
  sources: {
    googleFactor: number;
    dotBaseAdt: number;
    dotMeasurementYear: number | null;
    stationId: string | null;
  };
  computedAt: string;
}

export class TrafficGrowthIndexService {
  constructor(private pool: Pool) {}

  async computeForProperty(propertyId: string): Promise<TrafficGrowthResult | null> {
    const ctx = await this.pool.query(
      `SELECT primary_adt, primary_adt_station_id, google_realtime_factor,
              adt_measurement_year
       FROM property_traffic_context
       WHERE property_id = $1`,
      [propertyId]
    );

    if (ctx.rows.length === 0) return null;

    const row = ctx.rows[0];
    const dotHistoricalAvgAdt = parseFloat(row.primary_adt) || 0;
    const parsedFactor = parseFloat(row.google_realtime_factor);
    const googleFactor = Number.isFinite(parsedFactor) ? parsedFactor : 1.0;

    if (dotHistoricalAvgAdt <= 0) return null;

    const googleRealtimeAdtRaw = dotHistoricalAvgAdt * googleFactor;
    const trafficGrowthIndex =
      ((googleRealtimeAdtRaw - dotHistoricalAvgAdt) / dotHistoricalAvgAdt) * 100;
    const googleRealtimeAdt = Math.round(googleRealtimeAdtRaw);

    let confidence = 0.7;
    if (parsedFactor !== 1.0 && Number.isFinite(parsedFactor)) confidence += 0.15;
    if (row.adt_measurement_year) {
      const age = new Date().getFullYear() - parseInt(row.adt_measurement_year);
      if (age <= 1) confidence += 0.1;
      else if (age <= 3) confidence += 0.05;
    }
    confidence = Math.min(confidence, 1.0);

    return {
      propertyId,
      googleRealtimeAdt,
      dotHistoricalAvgAdt,
      trafficGrowthIndex: Math.round(trafficGrowthIndex * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      sources: {
        googleFactor,
        dotBaseAdt: dotHistoricalAvgAdt,
        dotMeasurementYear: row.adt_measurement_year ? parseInt(row.adt_measurement_year) : null,
        stationId: row.primary_adt_station_id,
      },
      computedAt: new Date().toISOString(),
    };
  }

  async computeAndStoreForProperty(propertyId: string): Promise<TrafficGrowthResult | null> {
    const result = await this.computeForProperty(propertyId);
    if (!result) return null;

    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source,
                      confidence = EXCLUDED.confidence, created_at = NOW()`,
      [
        'C_TRAFFIC_GROWTH_INDEX',
        'property',
        propertyId,
        propertyId,
        new Date().toISOString().split('T')[0],
        'daily',
        result.trafficGrowthIndex,
        'Google Realtime + DOT AADT',
        result.confidence,
      ]
    );

    logger.info(`[TrafficGrowthIndex] Computed for ${propertyId}: ${result.trafficGrowthIndex}%`);
    return result;
  }

  async computeBatchForSubmarket(submarketGeoId: string): Promise<{
    submarketIndex: number | null;
    propertyCount: number;
    results: TrafficGrowthResult[];
  }> {
    const props = await this.pool.query(
      `SELECT ptc.property_id
       FROM property_traffic_context ptc
       JOIN properties p ON p.id = ptc.property_id
       WHERE p.submarket_id = $1 AND ptc.primary_adt > 0`,
      [submarketGeoId]
    );

    const results: TrafficGrowthResult[] = [];
    for (const row of props.rows) {
      const r = await this.computeForProperty(row.property_id);
      if (r) results.push(r);
    }

    if (results.length === 0) return { submarketIndex: null, propertyCount: 0, results };

    const avgIndex =
      results.reduce((sum, r) => sum + r.trafficGrowthIndex, 0) / results.length;
    const rounded = Math.round(avgIndex * 100) / 100;

    await this.pool.query(
      `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source,
                      confidence = EXCLUDED.confidence, created_at = NOW()`,
      [
        'C_TRAFFIC_GROWTH_INDEX',
        'submarket',
        submarketGeoId,
        submarketGeoId,
        new Date().toISOString().split('T')[0],
        'daily',
        rounded,
        'Google Realtime + DOT AADT (submarket avg)',
        0.8,
      ]
    );

    logger.info(`[TrafficGrowthIndex] Submarket ${submarketGeoId}: ${rounded}% (${results.length} properties)`);
    return { submarketIndex: rounded, propertyCount: results.length, results };
  }
}
