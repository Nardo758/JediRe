import { Pool } from 'pg';
import { logger } from '../utils/logger';
import * as fs from 'fs';

export interface ADTRecord {
  source_system: string;
  station_id: string;
  route_id?: string;
  latitude: number;
  longitude: number;
  road_name: string;
  city?: string;
  county?: string;
  state?: string;
  adt: number;
  measurement_year: number;
  directional_split?: string;
  road_classification?: string;
  number_of_lanes?: number;
  functional_class?: string;
  data_source_url?: string;
}

export interface NearestADTResult {
  station_id: string;
  road_name: string;
  adt: number;
  measurement_year: number;
  road_classification: string | null;
  distance_meters: number;
  latitude: number;
  longitude: number;
}

export interface PropertyTrafficContext {
  property_id: string;
  primary_adt_station_id: string | null;
  primary_adt: number | null;
  primary_adt_distance_m: number | null;
  primary_road_name: string | null;
  primary_road_classification: string | null;
  secondary_adt_station_id: string | null;
  secondary_adt: number | null;
  secondary_adt_distance_m: number | null;
  secondary_road_name: string | null;
  google_realtime_factor: number;
  trend_direction: string | null;
  trend_pct: number | null;
  adt_measurement_year: number | null;
  last_updated: string;
}

export interface RealTimeTrafficResult {
  factor: number;
  duration_in_traffic: number | null;
  duration_normal: number | null;
  congestion_level: string;
  fetched_at: string;
}

export class TrafficDataSourcesService {
  constructor(private pool: Pool) {}

  async ingestADTData(filePath: string, sourceSystem: string = 'DOT'): Promise<{ inserted: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let inserted = 0;
    let skipped = 0;

    try {
      const ext = filePath.toLowerCase();
      let records: ADTRecord[] = [];

      if (ext.endsWith('.csv')) {
        records = await this.parseCSV(filePath, sourceSystem);
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        records = await this.parseExcel(filePath, sourceSystem);
      } else {
        throw new Error('Unsupported file format. Use CSV or Excel (.xlsx/.xls)');
      }

      for (const record of records) {
        try {
          if (!record.latitude || !record.longitude || !record.adt) {
            skipped++;
            continue;
          }

          await this.pool.query(
            `INSERT INTO adt_counts (
              source_system, station_id, route_id, latitude, longitude,
              road_name, city, county, state, adt, measurement_year,
              directional_split, road_classification, number_of_lanes,
              functional_class, data_source_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT DO NOTHING`,
            [
              record.source_system,
              record.station_id,
              record.route_id || null,
              record.latitude,
              record.longitude,
              record.road_name,
              record.city || null,
              record.county || null,
              record.state || null,
              record.adt,
              record.measurement_year,
              record.directional_split || null,
              record.road_classification || null,
              record.number_of_lanes || null,
              record.functional_class || null,
              record.data_source_url || null,
            ]
          );
          inserted++;
        } catch (err: any) {
          errors.push(`Row ${record.station_id}: ${err.message}`);
          skipped++;
        }
      }

      logger.info(`[TrafficDataSources] ADT ingestion complete: ${inserted} inserted, ${skipped} skipped`);
    } catch (err: any) {
      logger.error('[TrafficDataSources] ADT ingestion failed', { error: err.message });
      throw err;
    }

    return { inserted, skipped, errors };
  }

  private async parseCSV(filePath: string, sourceSystem: string): Promise<ADTRecord[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const records: ADTRecord[] = [];

    const colMap = this.buildColumnMap(headers);

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length < headers.length) continue;

      const record = this.mapRowToADT(values, colMap, sourceSystem);
      if (record) records.push(record);
    }

    return records;
  }

  private async parseExcel(filePath: string, sourceSystem: string): Promise<ADTRecord[]> {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) return [];

    const headers = (rows[0] as string[]).map(h => String(h || '').trim().toLowerCase());
    const colMap = this.buildColumnMap(headers);
    const records: ADTRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].map((v: any) => String(v ?? ''));
      const record = this.mapRowToADT(values, colMap, sourceSystem);
      if (record) records.push(record);
    }

    return records;
  }

  private buildColumnMap(headers: string[]): Record<string, number> {
    const aliases: Record<string, string[]> = {
      station_id: ['station_id', 'station', 'stationid', 'count_station', 'site_id'],
      route_id: ['route_id', 'route', 'routeid', 'route_number'],
      latitude: ['latitude', 'lat', 'y'],
      longitude: ['longitude', 'lng', 'lon', 'long', 'x'],
      road_name: ['road_name', 'roadname', 'road', 'street', 'street_name', 'route_name'],
      city: ['city', 'municipality', 'place'],
      county: ['county', 'county_name'],
      state: ['state', 'st', 'state_code'],
      adt: ['adt', 'aadt', 'avg_daily_traffic', 'average_daily_traffic', 'daily_traffic', 'traffic_count', 'volume'],
      measurement_year: ['measurement_year', 'year', 'count_year', 'data_year'],
      directional_split: ['directional_split', 'direction', 'dir'],
      road_classification: ['road_classification', 'classification', 'road_class', 'func_class', 'functional_classification'],
      number_of_lanes: ['number_of_lanes', 'lanes', 'lane_count', 'num_lanes'],
      functional_class: ['functional_class', 'func_class_code', 'fclass'],
    };

    const colMap: Record<string, number> = {};
    for (const [field, names] of Object.entries(aliases)) {
      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx !== -1) {
          colMap[field] = idx;
          break;
        }
      }
    }

    return colMap;
  }

  private mapRowToADT(values: string[], colMap: Record<string, number>, sourceSystem: string): ADTRecord | null {
    const get = (field: string): string => {
      const idx = colMap[field];
      return idx !== undefined ? (values[idx] || '').trim() : '';
    };

    const lat = parseFloat(get('latitude'));
    const lng = parseFloat(get('longitude'));
    const adt = parseInt(get('adt'), 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(adt)) return null;

    return {
      source_system: sourceSystem,
      station_id: get('station_id') || `${sourceSystem}-${lat}-${lng}`,
      route_id: get('route_id') || undefined,
      latitude: lat,
      longitude: lng,
      road_name: get('road_name') || 'Unknown',
      city: get('city') || undefined,
      county: get('county') || undefined,
      state: get('state') || undefined,
      adt,
      measurement_year: parseInt(get('measurement_year'), 10) || new Date().getFullYear(),
      directional_split: get('directional_split') || undefined,
      road_classification: get('road_classification') || undefined,
      number_of_lanes: parseInt(get('number_of_lanes'), 10) || undefined,
      functional_class: get('functional_class') || undefined,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  async findNearestADT(lat: number, lng: number, limit: number = 2): Promise<NearestADTResult[]> {
    const result = await this.pool.query(
      `SELECT
        station_id,
        road_name,
        adt,
        measurement_year,
        road_classification,
        latitude,
        longitude,
        (
          6371000 * acos(
            cos(radians($1)) * cos(radians(latitude)) *
            cos(radians(longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(latitude))
          )
        ) AS distance_meters
      FROM adt_counts
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND adt IS NOT NULL
      ORDER BY distance_meters ASC
      LIMIT $3`,
      [lat, lng, limit]
    );

    return result.rows.map(r => ({
      station_id: r.station_id,
      road_name: r.road_name,
      adt: r.adt,
      measurement_year: r.measurement_year,
      road_classification: r.road_classification,
      distance_meters: Math.round(r.distance_meters),
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
    }));
  }

  async linkPropertyToADT(propertyId: string): Promise<PropertyTrafficContext | null> {
    const propResult = await this.pool.query(
      `SELECT id, latitude, longitude FROM properties WHERE id = $1`,
      [propertyId]
    );

    if (propResult.rows.length === 0) {
      logger.warn(`[TrafficDataSources] Property ${propertyId} not found`);
      return null;
    }

    const property = propResult.rows[0];
    const lat = parseFloat(property.latitude);
    const lng = parseFloat(property.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      logger.warn(`[TrafficDataSources] Property ${propertyId} missing coordinates`);
      return null;
    }

    const nearest = await this.findNearestADT(lat, lng, 2);

    if (nearest.length === 0) {
      logger.info(`[TrafficDataSources] No ADT stations found near property ${propertyId}`);
      return null;
    }

    const primary = nearest[0];
    const secondary = nearest.length > 1 ? nearest[1] : null;

    let realtimeFactor = 1.0;
    try {
      const rtResult = await this.getRealTimeTrafficFactor(lat, lng);
      realtimeFactor = rtResult.factor;
    } catch (e) {
      logger.debug(`[TrafficDataSources] Real-time traffic unavailable for ${propertyId}`);
    }

    const context: PropertyTrafficContext = {
      property_id: propertyId,
      primary_adt_station_id: primary.station_id,
      primary_adt: primary.adt,
      primary_adt_distance_m: primary.distance_meters,
      primary_road_name: primary.road_name,
      primary_road_classification: primary.road_classification,
      secondary_adt_station_id: secondary?.station_id || null,
      secondary_adt: secondary?.adt || null,
      secondary_adt_distance_m: secondary?.distance_meters || null,
      secondary_road_name: secondary?.road_name || null,
      google_realtime_factor: realtimeFactor,
      trend_direction: null,
      trend_pct: null,
      adt_measurement_year: primary.measurement_year,
      last_updated: new Date().toISOString().split('T')[0],
    };

    await this.pool.query(
      `INSERT INTO property_traffic_context (
        property_id, primary_adt_station_id, primary_adt, primary_adt_distance_m,
        primary_road_name, primary_road_classification,
        secondary_adt_station_id, secondary_adt, secondary_adt_distance_m,
        secondary_road_name, google_realtime_factor,
        trend_direction, trend_pct, adt_measurement_year, last_updated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (property_id) DO UPDATE SET
        primary_adt_station_id = EXCLUDED.primary_adt_station_id,
        primary_adt = EXCLUDED.primary_adt,
        primary_adt_distance_m = EXCLUDED.primary_adt_distance_m,
        primary_road_name = EXCLUDED.primary_road_name,
        primary_road_classification = EXCLUDED.primary_road_classification,
        secondary_adt_station_id = EXCLUDED.secondary_adt_station_id,
        secondary_adt = EXCLUDED.secondary_adt,
        secondary_adt_distance_m = EXCLUDED.secondary_adt_distance_m,
        secondary_road_name = EXCLUDED.secondary_road_name,
        google_realtime_factor = EXCLUDED.google_realtime_factor,
        adt_measurement_year = EXCLUDED.adt_measurement_year,
        last_updated = EXCLUDED.last_updated`,
      [
        context.property_id,
        context.primary_adt_station_id,
        context.primary_adt,
        context.primary_adt_distance_m,
        context.primary_road_name,
        context.primary_road_classification,
        context.secondary_adt_station_id,
        context.secondary_adt,
        context.secondary_adt_distance_m,
        context.secondary_road_name,
        context.google_realtime_factor,
        context.trend_direction,
        context.trend_pct,
        context.adt_measurement_year,
        context.last_updated,
      ]
    );

    logger.info(`[TrafficDataSources] Linked property ${propertyId} to ADT station ${primary.station_id} (${primary.adt} vehicles/day, ${primary.distance_meters}m away)`);
    return context;
  }

  async getRealTimeTrafficFactor(lat: number, lng: number): Promise<RealTimeTrafficResult> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return {
        factor: 1.0,
        duration_in_traffic: null,
        duration_normal: null,
        congestion_level: 'unknown',
        fetched_at: new Date().toISOString(),
      };
    }

    try {
      const offsetLat = 0.005;
      const originLat = lat - offsetLat;
      const destLat = lat + offsetLat;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${lng}&destination=${destLat},${lng}&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        logger.debug('[TrafficDataSources] Google Directions API returned no routes', { status: data.status });
        return {
          factor: 1.0,
          duration_in_traffic: null,
          duration_normal: null,
          congestion_level: 'unknown',
          fetched_at: new Date().toISOString(),
        };
      }

      const leg = data.routes[0].legs[0];
      const normalDuration = leg.duration?.value || 0;
      const trafficDuration = leg.duration_in_traffic?.value || normalDuration;

      const factor = normalDuration > 0 ? trafficDuration / normalDuration : 1.0;
      const clampedFactor = Math.max(0.5, Math.min(3.0, factor));

      let congestionLevel = 'low';
      if (clampedFactor > 1.5) congestionLevel = 'heavy';
      else if (clampedFactor > 1.2) congestionLevel = 'moderate';
      else if (clampedFactor > 1.05) congestionLevel = 'light';

      return {
        factor: Math.round(clampedFactor * 1000) / 1000,
        duration_in_traffic: trafficDuration,
        duration_normal: normalDuration,
        congestion_level: congestionLevel,
        fetched_at: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error('[TrafficDataSources] Google traffic fetch failed', { error: err.message });
      return {
        factor: 1.0,
        duration_in_traffic: null,
        duration_normal: null,
        congestion_level: 'error',
        fetched_at: new Date().toISOString(),
      };
    }
  }

  async getPropertyTrafficContext(propertyId: string): Promise<PropertyTrafficContext & { realtime?: RealTimeTrafficResult } | null> {
    const result = await this.pool.query(
      `SELECT * FROM property_traffic_context WHERE property_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const context: PropertyTrafficContext = {
      property_id: row.property_id,
      primary_adt_station_id: row.primary_adt_station_id,
      primary_adt: row.primary_adt,
      primary_adt_distance_m: row.primary_adt_distance_m,
      primary_road_name: row.primary_road_name,
      primary_road_classification: row.primary_road_classification,
      secondary_adt_station_id: row.secondary_adt_station_id,
      secondary_adt: row.secondary_adt,
      secondary_adt_distance_m: row.secondary_adt_distance_m,
      secondary_road_name: row.secondary_road_name,
      google_realtime_factor: parseFloat(row.google_realtime_factor) || 1.0,
      trend_direction: row.trend_direction,
      trend_pct: row.trend_pct ? parseFloat(row.trend_pct) : null,
      adt_measurement_year: row.adt_measurement_year,
      last_updated: row.last_updated,
    };

    const lastUpdated = new Date(row.last_updated);
    const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

    let realtime: RealTimeTrafficResult | undefined;
    if (hoursSinceUpdate > 1) {
      try {
        const propResult = await this.pool.query(
          `SELECT latitude, longitude FROM properties WHERE id = $1`,
          [propertyId]
        );
        if (propResult.rows.length > 0) {
          const { latitude, longitude } = propResult.rows[0];
          if (latitude && longitude) {
            realtime = await this.getRealTimeTrafficFactor(parseFloat(latitude), parseFloat(longitude));
            if (realtime.factor !== 1.0 || realtime.congestion_level !== 'unknown') {
              await this.pool.query(
                `UPDATE property_traffic_context
                 SET google_realtime_factor = $1, last_updated = CURRENT_DATE
                 WHERE property_id = $2`,
                [realtime.factor, propertyId]
              );
              context.google_realtime_factor = realtime.factor;
            }
          }
        }
      } catch (e) {
        logger.debug(`[TrafficDataSources] Skipped realtime update for ${propertyId}`);
      }
    }

    return { ...context, realtime };
  }

  async getADTStations(filters?: {
    city?: string;
    state?: string;
    minADT?: number;
    maxADT?: number;
    year?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ stations: any[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.city) {
      conditions.push(`city ILIKE $${paramIndex++}`);
      params.push(`%${filters.city}%`);
    }
    if (filters?.state) {
      conditions.push(`state = $${paramIndex++}`);
      params.push(filters.state.toUpperCase());
    }
    if (filters?.minADT) {
      conditions.push(`adt >= $${paramIndex++}`);
      params.push(filters.minADT);
    }
    if (filters?.maxADT) {
      conditions.push(`adt <= $${paramIndex++}`);
      params.push(filters.maxADT);
    }
    if (filters?.year) {
      conditions.push(`measurement_year = $${paramIndex++}`);
      params.push(filters.year);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM adt_counts ${whereClause}`,
      params
    );

    const dataResult = await this.pool.query(
      `SELECT * FROM adt_counts ${whereClause} ORDER BY adt DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      stations: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async updatePropertyTrend(propertyId: string, direction: string, pct: number): Promise<void> {
    await this.pool.query(
      `UPDATE property_traffic_context
       SET trend_direction = $1, trend_pct = $2, last_updated = CURRENT_DATE
       WHERE property_id = $3`,
      [direction, pct, propertyId]
    );
  }

  async bulkLinkProperties(limit: number = 50): Promise<{ linked: number; failed: number }> {
    const result = await this.pool.query(
      `SELECT p.id FROM properties p
       LEFT JOIN property_traffic_context ptc ON ptc.property_id = p.id
       WHERE ptc.property_id IS NULL
         AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
       LIMIT $1`,
      [limit]
    );

    let linked = 0;
    let failed = 0;

    for (const row of result.rows) {
      try {
        const ctx = await this.linkPropertyToADT(row.id);
        if (ctx) linked++;
        else failed++;
      } catch (e) {
        failed++;
      }
    }

    logger.info(`[TrafficDataSources] Bulk link complete: ${linked} linked, ${failed} failed`);
    return { linked, failed };
  }
}
