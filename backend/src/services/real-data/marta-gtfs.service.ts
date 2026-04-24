/**
 * MARTA GTFS Service
 *
 * Fetches MARTA's public GTFS feed (stops.txt), parses it, and batch-upserts
 * transit stop rows into points_of_interest.
 *
 * GTFS stop types:
 *   location_type 1 → rail station   → poi_type 'transit_station'
 *   location_type 0 → bus/BRT stop   → poi_type 'bus_stop'
 *
 * Atlanta metro bounding box: lat 33.5–34.2, lng −84.8 to −83.9
 */

import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const GTFS_URL = 'https://www.itsmarta.com/google_transit_feed/google_transit.zip';

const BBOX = {
  minLat: 33.5,
  maxLat: 34.2,
  minLng: -84.8,
  maxLng: -83.9,
};

interface GtfsStop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_desc?: string;
  stop_lat: string;
  stop_lon: string;
  location_type?: string;
  parent_station?: string;
  wheelchair_boarding?: string;
}

export interface MartaSyncResult {
  fetched: number;
  upserted: number;
  skipped: number;
  errors: string[];
}

export async function syncMartaGtfs(): Promise<MartaSyncResult> {
  const pool = getPool();
  const errors: string[] = [];
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;

  logger.info('[MartaGtfs] Fetching GTFS feed', { url: GTFS_URL });

  const response = await axios.get<ArrayBuffer>(GTFS_URL, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'JediRe-DataSync/1.0 (realestate-intelligence)' },
  });

  const zip = new AdmZip(Buffer.from(response.data));
  const stopsEntry = zip.getEntry('stops.txt');
  if (!stopsEntry) {
    throw new Error('[MartaGtfs] stops.txt not found in GTFS zip');
  }

  const stopsCsv = stopsEntry.getData().toString('utf8');
  const stops: GtfsStop[] = parse(stopsCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  fetched = stops.length;
  logger.info('[MartaGtfs] Parsed stops', { count: fetched });

  for (const stop of stops) {
    const lat = parseFloat(stop.stop_lat);
    const lng = parseFloat(stop.stop_lon);

    if (isNaN(lat) || isNaN(lng)) { skipped++; continue; }
    if (lat < BBOX.minLat || lat > BBOX.maxLat || lng < BBOX.minLng || lng > BBOX.maxLng) {
      skipped++;
      continue;
    }

    const locType = parseInt(stop.location_type || '0', 10);
    const poiType = locType === 1 ? 'transit_station' : 'bus_stop';
    const poiSubtype = locType === 1 ? 'rail' : 'bus';

    try {
      await pool.query(`
        INSERT INTO points_of_interest (
          poi_type, poi_name, poi_subtype,
          latitude, longitude,
          city, state,
          transit_agency,
          status, source, source_id,
          last_verified
        ) VALUES (
          $1, $2, $3,
          $4, $5,
          'Atlanta', 'GA',
          'MARTA',
          'active', 'marta_gtfs', $6,
          CURRENT_DATE
        )
        ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET
          poi_name    = EXCLUDED.poi_name,
          poi_subtype = EXCLUDED.poi_subtype,
          latitude    = EXCLUDED.latitude,
          longitude   = EXCLUDED.longitude,
          last_verified = CURRENT_DATE,
          updated_at  = NOW()
      `, [
        poiType,
        stop.stop_name,
        poiSubtype,
        lat,
        lng,
        stop.stop_id,
      ]);
      upserted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`stop ${stop.stop_id}: ${msg}`);
      logger.warn('[MartaGtfs] Upsert error', { stop_id: stop.stop_id, error: msg });
    }
  }

  logger.info('[MartaGtfs] Sync complete', { fetched, upserted, skipped, errors: errors.length });
  return { fetched, upserted, skipped, errors };
}
