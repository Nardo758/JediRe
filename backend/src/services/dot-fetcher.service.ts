import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ADTRecord } from './traffic-data-sources.service';

export interface StateDOTConfig {
  state: string;
  stateFips: string;
  name: string;
  coordinateSystem: 'webMercator' | 'wgs84';
  availableYears: number[];
  getServiceUrl: (year: number) => string;
  getAadtField: (year: number) => string;
  getWhereClause: (year: number) => string;
  mapFeature: (attrs: Record<string, any>, geom: any, year: number, state: string) => Partial<ADTRecord> | null;
}

export interface IngestionResult {
  state: string;
  year: number;
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
  durationMs: number;
}

const FDOT_CONFIG: StateDOTConfig = {
  state: 'FL',
  stateFips: '12',
  name: 'Florida DOT',
  coordinateSystem: 'wgs84',
  availableYears: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  getServiceUrl: (_year: number) =>
    'https://gis.fdot.gov/arcgis/rest/services/FTO/fto_PROD/MapServer/7',
  getAadtField: (_year: number) => 'AADT',
  getWhereClause: (year: number) => `AADT>0 AND YEAR_=${year}`,
  mapFeature: (attrs, geom, year, state) => {
    const adt = parseInt(String(attrs.AADT || '0'), 10);
    if (!adt || adt <= 0) return null;

    const cosite = String(attrs.COSITE || attrs.OBJECTID || '');
    const roadway = String(attrs.ROADWAY || '');
    const descFrom = String(attrs.DESC_FRM || '');
    const descTo = String(attrs.DESC_TO || '');
    const roadName = descFrom && descTo && descFrom !== 'N/A' && descTo !== 'N/A'
      ? `${roadway} (${descFrom} to ${descTo})`.substring(0, 250)
      : roadway || 'Unknown';
    const county = String(attrs.COUNTY || '');

    return {
      source_system: `DOT_${state}`,
      station_id: `FL_${cosite}`,
      route_id: roadway || undefined,
      road_name: roadName,
      county: county || undefined,
      state,
      adt,
      measurement_year: parseInt(String(attrs.YEAR_ || year), 10),
    };
  },
};

const GDOT_CONFIG: StateDOTConfig = {
  state: 'GA',
  stateFips: '13',
  name: 'Georgia DOT (via FHWA HPMS)',
  coordinateSystem: 'wgs84',
  availableYears: [2020, 2022, 2024],
  getServiceUrl: (year: number) =>
    `https://geo.dot.gov/server/rest/services/Hosted/HPMS_FULL_GA_${year}/FeatureServer/0`,
  getAadtField: (_year: number) => 'aadt',
  getWhereClause: (_year: number) => 'aadt>0',
  mapFeature: (attrs, _geom, year, state) => {
    const adt = parseInt(String(attrs.aadt || '0'), 10);
    if (!adt || adt <= 0) return null;

    // Field names differ by year: 2020 uses route_id/county_code; 2022 uses routeid/county_id
    const routeId = String(attrs.route_id || attrs.routeid || '');
    const county = String(attrs.county_code || attrs.county_id || '');
    const roadName = String(attrs.route_name || routeId || 'Unknown');
    const lanes = parseInt(String(attrs.through_lanes || '0'), 10) || undefined;
    const fClass = parseInt(String(attrs.f_system || '0'), 10) || undefined;

    return {
      source_system: `DOT_${state}`,
      station_id: `GA_HPMS_${attrs.objectid || routeId}_${year}`,
      route_id: routeId || undefined,
      road_name: roadName,
      county: county || undefined,
      state,
      adt,
      measurement_year: year,
      number_of_lanes: lanes || undefined,
      functional_class: fClass ? String(fClass) : undefined,
    };
  },
};

const TXDOT_CONFIG: StateDOTConfig = {
  state: 'TX',
  stateFips: '48',
  name: 'Texas DOT',
  coordinateSystem: 'wgs84',
  availableYears: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
  getServiceUrl: (_year: number) =>
    'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_AADT/FeatureServer/0',
  getAadtField: (_year: number) => 'ADT',
  getWhereClause: (year: number) => `YEAR_ADT=${year} AND ADT>0`,
  mapFeature: (attrs, _geom, year, state) => {
    const adt = parseInt(String(attrs.ADT || attrs.AADT || '0'), 10);
    if (!adt || adt <= 0) return null;
    return {
      source_system: `DOT_${state}`,
      station_id: `TX_${attrs.STATION_ID || attrs.OBJECTID || ''}`,
      route_id: String(attrs.ROUTE || '') || undefined,
      road_name: String(attrs.ROAD_NAME || attrs.ROUTE || 'Unknown'),
      county: String(attrs.COUNTY || '') || undefined,
      state,
      adt,
      measurement_year: parseInt(String(attrs.YEAR_ADT || year), 10),
    };
  },
};

const NCDOT_CONFIG: StateDOTConfig = {
  state: 'NC',
  stateFips: '37',
  name: 'North Carolina DOT',
  coordinateSystem: 'wgs84',
  availableYears: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
  getServiceUrl: (_year: number) =>
    'https://services.arcgis.com/0tBwJNaBzFE6wPkn/arcgis/rest/services/NCDOT_AADT/FeatureServer/0',
  getAadtField: (_year: number) => 'AADT',
  getWhereClause: (year: number) => `YEAR=${year} AND AADT>0`,
  mapFeature: (attrs, _geom, year, state) => {
    const adt = parseInt(String(attrs.AADT || '0'), 10);
    if (!adt || adt <= 0) return null;
    return {
      source_system: `DOT_${state}`,
      station_id: `NC_${attrs.STATION_ID || attrs.OBJECTID || ''}`,
      route_id: String(attrs.ROUTE_ID || '') || undefined,
      road_name: String(attrs.ROUTE_NAME || attrs.ROUTE_ID || 'Unknown'),
      county: String(attrs.COUNTY || '') || undefined,
      state,
      adt,
      measurement_year: parseInt(String(attrs.YEAR || year), 10),
    };
  },
};

const STATE_CONFIGS: Record<string, StateDOTConfig> = {
  FL: FDOT_CONFIG,
  GA: GDOT_CONFIG,
  TX: TXDOT_CONFIG,
  NC: NCDOT_CONFIG,
};

function webMercatorToWgs84(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lat, lng };
}

export class DotFetcherService {
  constructor(private pool: Pool) {}

  getAvailableStates(): string[] {
    return Object.keys(STATE_CONFIGS);
  }

  getStateConfig(state: string): StateDOTConfig | null {
    return STATE_CONFIGS[state.toUpperCase()] || null;
  }

  async fetchAndIngest(state: string, year: number): Promise<IngestionResult> {
    const start = Date.now();
    const config = STATE_CONFIGS[state.toUpperCase()];
    if (!config) {
      return {
        state,
        year,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: [`No configuration found for state: ${state}`],
        durationMs: Date.now() - start,
      };
    }

    logger.info(`[DotFetcher] Starting fetch for ${config.name}, year ${year}`);

    const serviceUrl = config.getServiceUrl(year);
    if (!serviceUrl) {
      return {
        state: config.state,
        year,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: [`No ArcGIS service URL configured for ${config.name} year ${year}`],
        durationMs: Date.now() - start,
      };
    }

    try {
      const records = await this.fetchFromArcGIS(config, year, serviceUrl);
      logger.info(`[DotFetcher] Fetched ${records.length} records from ${config.name} for ${year}`);

      if (records.length === 0) {
        return {
          state: config.state,
          year,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          errors: ['No records returned from API — endpoint may not have data for this year'],
          durationMs: Date.now() - start,
        };
      }

      const { inserted, skipped, errors } = await this.bulkInsert(records);

      logger.info(`[DotFetcher] ${config.name} ${year}: ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`);

      return {
        state: config.state,
        year,
        fetched: records.length,
        inserted,
        skipped,
        errors,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      logger.error(`[DotFetcher] Failed to fetch ${config.name} ${year}`, { error: err.message });
      return {
        state: config.state,
        year,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: [err.message],
        durationMs: Date.now() - start,
      };
    }
  }

  private async fetchFromArcGIS(config: StateDOTConfig, year: number, serviceUrl: string): Promise<ADTRecord[]> {
    const allRecords: ADTRecord[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`${serviceUrl}/query`);
      url.searchParams.set('where', config.getWhereClause(year));
      url.searchParams.set('outFields', '*');
      url.searchParams.set('returnGeometry', 'true');
      url.searchParams.set('resultRecordCount', String(batchSize));
      url.searchParams.set('resultOffset', String(offset));
      url.searchParams.set('outSR', '4326');
      url.searchParams.set('f', 'json');

      logger.debug(`[DotFetcher] Fetching batch offset=${offset} from ${config.state} ${year}`);

      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'JediRe-DOT-Ingestion/1.0' },
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`ArcGIS API returned ${response.status}: ${response.statusText}`);
      }

      interface ArcGISResponse {
        error?: { message?: string; code?: number };
        features?: Array<{ attributes: Record<string, unknown>; geometry?: Record<string, unknown> }>;
        exceededTransferLimit?: boolean;
      }

      const data: ArcGISResponse = await response.json() as ArcGISResponse;

      if (data.error) {
        throw new Error(`ArcGIS error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const features = data.features || [];
      if (features.length === 0) {
        hasMore = false;
        break;
      }

      for (const feature of features) {
        const record = this.mapFeature(feature, config, year);
        if (record) {
          allRecords.push(record);
        }
      }

      offset += features.length;

      if (features.length < batchSize || data.exceededTransferLimit === false) {
        hasMore = false;
      }

      if (offset > 100000) {
        logger.warn(`[DotFetcher] Safety limit reached at ${offset} records for ${config.state} ${year}`);
        hasMore = false;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return allRecords;
  }

  private extractCoordinates(geom: any, coordSystem: 'webMercator' | 'wgs84'): { lat: number; lng: number } | null {
    if (geom.y !== undefined && geom.x !== undefined) {
      if (coordSystem === 'webMercator') {
        return webMercatorToWgs84(geom.x, geom.y);
      }
      return { lat: geom.y, lng: geom.x };
    }

    if (geom.paths && Array.isArray(geom.paths)) {
      const allPoints: number[][] = [];
      for (const path of geom.paths) {
        for (const point of path) {
          allPoints.push(point);
        }
      }
      if (allPoints.length > 0) {
        const mid = Math.floor(allPoints.length / 2);
        const [x, y] = allPoints[mid];
        if (coordSystem === 'webMercator') {
          return webMercatorToWgs84(x, y);
        }
        return { lat: y, lng: x };
      }
    }

    if (geom.rings && Array.isArray(geom.rings)) {
      const ring = geom.rings[0];
      if (ring && ring.length > 0) {
        const mid = Math.floor(ring.length / 2);
        const [x, y] = ring[mid];
        if (coordSystem === 'webMercator') {
          return webMercatorToWgs84(x, y);
        }
        return { lat: y, lng: x };
      }
    }

    return null;
  }

  private mapFeature(feature: any, config: StateDOTConfig, year: number): ADTRecord | null {
    const attrs = feature.attributes || {};
    const geom = feature.geometry || {};

    const partial = config.mapFeature(attrs, geom, year, config.state);
    if (!partial || !partial.adt || partial.adt <= 0) return null;

    const coords = this.extractCoordinates(geom, config.coordinateSystem);
    if (!coords) return null;

    const { lat, lng } = coords;
    if (isNaN(lat) || isNaN(lng) || lat < 20 || lat > 55 || lng < -130 || lng > -60) return null;

    return {
      source_system: partial.source_system || `DOT_${config.state}`,
      station_id: partial.station_id || `${config.state}_${lat.toFixed(6)}_${lng.toFixed(6)}`,
      route_id: partial.route_id,
      latitude: lat,
      longitude: lng,
      road_name: partial.road_name || 'Unknown',
      city: partial.city,
      county: partial.county,
      state: partial.state || config.state,
      adt: partial.adt,
      measurement_year: partial.measurement_year || year,
      directional_split: partial.directional_split,
      road_classification: partial.road_classification,
      number_of_lanes: partial.number_of_lanes,
      functional_class: partial.functional_class,
      data_source_url: partial.data_source_url,
    };
  }

  private deduplicateRecords(records: ADTRecord[]): ADTRecord[] {
    const map = new Map<string, ADTRecord>();
    for (const r of records) {
      const key = `${r.station_id}__${r.measurement_year}`;
      const existing = map.get(key);
      if (!existing || r.adt > existing.adt) {
        map.set(key, r);
      }
    }
    return Array.from(map.values());
  }

  async bulkInsert(records: ADTRecord[]): Promise<{ inserted: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let inserted = 0;
    let skipped = 0;
    const batchSize = 500;

    records = this.deduplicateRecords(records);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];

      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        if (!r.latitude || !r.longitude || !r.adt) {
          skipped++;
          continue;
        }

        const offset = values.length;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16})`
        );
        values.push(
          r.source_system,
          r.station_id,
          r.route_id || null,
          r.latitude,
          r.longitude,
          r.road_name,
          r.city || null,
          r.county || null,
          r.state || null,
          r.adt,
          r.measurement_year,
          r.directional_split || null,
          r.road_classification || null,
          r.number_of_lanes || null,
          r.functional_class || null,
          r.data_source_url || null,
        );
      }

      if (placeholders.length === 0) continue;

      try {
        const result = await this.pool.query(
          `INSERT INTO adt_counts (
            source_system, station_id, route_id, latitude, longitude,
            road_name, city, county, state, adt, measurement_year,
            directional_split, road_classification, number_of_lanes,
            functional_class, data_source_url
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (station_id, measurement_year) DO UPDATE SET
            adt = EXCLUDED.adt,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            road_name = EXCLUDED.road_name,
            county = EXCLUDED.county,
            ingested_at = NOW()`,
          values
        );
        inserted += result.rowCount || 0;
      } catch (err: any) {
        logger.error(`[DotFetcher] Bulk insert batch failed`, { error: err.message });
        errors.push(`Batch at offset ${i}: ${err.message}`);
        skipped += batch.length;
      }
    }

    return { inserted, skipped, errors };
  }

  async getIngestionStatus(): Promise<{
    states: Array<{
      state: string;
      name: string;
      totalStations: number;
      yearRange: { min: number; max: number } | null;
      lastIngested: string | null;
    }>;
    totalRecords: number;
  }> {
    const totalResult = await this.pool.query('SELECT COUNT(*) as count FROM adt_counts');
    const totalRecords = parseInt(totalResult.rows[0].count, 10);

    const stateResult = await this.pool.query(`
      SELECT
        state,
        COUNT(DISTINCT station_id) as station_count,
        MIN(measurement_year) as min_year,
        MAX(measurement_year) as max_year,
        MAX(ingested_at) as last_ingested
      FROM adt_counts
      GROUP BY state
      ORDER BY state
    `);

    const states = Object.entries(STATE_CONFIGS).map(([stateCode, config]) => {
      const dbRow = stateResult.rows.find(r => r.state === stateCode);
      return {
        state: stateCode,
        name: config.name,
        totalStations: dbRow ? parseInt(dbRow.station_count, 10) : 0,
        yearRange: dbRow ? { min: dbRow.min_year, max: dbRow.max_year } : null,
        lastIngested: dbRow?.last_ingested ? new Date(dbRow.last_ingested).toISOString() : null,
      };
    });

    return { states, totalRecords };
  }
}
