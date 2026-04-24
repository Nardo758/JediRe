/**
 * OSM Overpass Service
 *
 * Queries the OpenStreetMap Overpass API for:
 *   - Grocery stores (shop=supermarket)
 *   - Parks         (leisure=park)
 *   - Hospitals     (amenity=hospital)
 *
 * within the Atlanta metro bounding box (lat 33.5–34.2, lng −84.8 to −83.9).
 * Results are upserted into points_of_interest.
 *
 * POI type mapping:
 *   supermarket: Whole Foods / Trader Joe's / Fresh Market → grocery_premium
 *                all others                                → grocery_standard
 *   park        → park
 *   hospital    → hospital
 */

import axios from 'axios';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const BBOX = '33.5,-84.8,34.2,-83.9';

const PREMIUM_GROCERY_NAMES = [
  'whole foods', "trader joe's", 'trader joes', 'the fresh market',
  'sprouts', 'lucky\'s', 'luckys', 'earth fare',
];

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export interface OsmSyncResult {
  groceries: { fetched: number; upserted: number };
  parks: { fetched: number; upserted: number };
  hospitals: { fetched: number; upserted: number };
  errors: string[];
}

async function overpassQuery(query: string): Promise<OverpassElement[]> {
  const response = await axios.post<OverpassResponse>(
    OVERPASS_URL,
    `data=${encodeURIComponent(query)}`,
    {
      timeout: 60_000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'JediRe-DataSync/1.0 (realestate-intelligence)',
      },
    }
  );
  return response.data.elements || [];
}

function elementLatLng(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.lat !== undefined && el.lon !== undefined) return { lat: el.lat, lon: el.lon };
  if (el.center) return el.center;
  return null;
}

async function upsertPoi(params: {
  poiType: string;
  poiSubtype: string | null;
  poiName: string;
  lat: number;
  lon: number;
  sourceId: string;
  city?: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(`
    INSERT INTO points_of_interest (
      poi_type, poi_subtype, poi_name,
      latitude, longitude,
      city, state,
      status, source, source_id,
      last_verified
    ) VALUES (
      $1, $2, $3,
      $4, $5,
      $6, 'GA',
      'active', 'osm_overpass', $7,
      CURRENT_DATE
    )
    ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL
    DO UPDATE SET
      poi_name      = EXCLUDED.poi_name,
      poi_type      = EXCLUDED.poi_type,
      poi_subtype   = EXCLUDED.poi_subtype,
      latitude      = EXCLUDED.latitude,
      longitude     = EXCLUDED.longitude,
      last_verified = CURRENT_DATE,
      updated_at    = NOW()
  `, [
    params.poiType,
    params.poiSubtype,
    params.poiName,
    params.lat,
    params.lon,
    params.city || 'Atlanta',
    params.sourceId,
  ]);
}

export async function syncOsmPois(): Promise<OsmSyncResult> {
  const errors: string[] = [];
  const result: OsmSyncResult = {
    groceries: { fetched: 0, upserted: 0 },
    parks: { fetched: 0, upserted: 0 },
    hospitals: { fetched: 0, upserted: 0 },
    errors,
  };

  // ── Grocery stores ──────────────────────────────────────────────────────────
  logger.info('[OsmOverpass] Fetching grocery stores');
  const groceryQuery = `
    [out:json][timeout:45];
    (
      node["shop"="supermarket"](${BBOX});
      way["shop"="supermarket"](${BBOX});
    );
    out center tags;
  `;

  try {
    const groceries = await overpassQuery(groceryQuery);
    result.groceries.fetched = groceries.length;
    for (const el of groceries) {
      const ll = elementLatLng(el);
      if (!ll) continue;
      const name = el.tags?.name || el.tags?.['name:en'] || 'Grocery Store';
      const nameLower = name.toLowerCase();
      const isPremium = PREMIUM_GROCERY_NAMES.some(n => nameLower.includes(n));
      const poiType = isPremium ? 'grocery_premium' : 'grocery_standard';
      try {
        await upsertPoi({
          poiType,
          poiSubtype: el.tags?.brand || null,
          poiName: name,
          lat: ll.lat,
          lon: ll.lon,
          sourceId: `osm_${el.type}_${el.id}`,
          city: el.tags?.['addr:city'],
        });
        result.groceries.upserted++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`grocery ${el.id}: ${msg}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`grocery fetch failed: ${msg}`);
    logger.error('[OsmOverpass] Grocery fetch error', { error: msg });
  }

  // ── Parks ───────────────────────────────────────────────────────────────────
  logger.info('[OsmOverpass] Fetching parks');
  const parkQuery = `
    [out:json][timeout:45];
    (
      node["leisure"="park"](${BBOX});
      way["leisure"="park"](${BBOX});
      relation["leisure"="park"](${BBOX});
    );
    out center tags;
  `;

  try {
    const parks = await overpassQuery(parkQuery);
    result.parks.fetched = parks.length;
    for (const el of parks) {
      const ll = elementLatLng(el);
      if (!ll) continue;
      const name = el.tags?.name || 'Park';
      try {
        await upsertPoi({
          poiType: 'park',
          poiSubtype: el.tags?.leisure || null,
          poiName: name,
          lat: ll.lat,
          lon: ll.lon,
          sourceId: `osm_${el.type}_${el.id}`,
          city: el.tags?.['addr:city'],
        });
        result.parks.upserted++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`park ${el.id}: ${msg}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`park fetch failed: ${msg}`);
    logger.error('[OsmOverpass] Park fetch error', { error: msg });
  }

  // ── Hospitals ───────────────────────────────────────────────────────────────
  logger.info('[OsmOverpass] Fetching hospitals');
  const hospitalQuery = `
    [out:json][timeout:45];
    (
      node["amenity"="hospital"](${BBOX});
      way["amenity"="hospital"](${BBOX});
    );
    out center tags;
  `;

  try {
    const hospitals = await overpassQuery(hospitalQuery);
    result.hospitals.fetched = hospitals.length;
    for (const el of hospitals) {
      const ll = elementLatLng(el);
      if (!ll) continue;
      const name = el.tags?.name || 'Hospital';
      try {
        await upsertPoi({
          poiType: 'hospital',
          poiSubtype: el.tags?.['healthcare:speciality'] || null,
          poiName: name,
          lat: ll.lat,
          lon: ll.lon,
          sourceId: `osm_${el.type}_${el.id}`,
          city: el.tags?.['addr:city'],
        });
        result.hospitals.upserted++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`hospital ${el.id}: ${msg}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`hospital fetch failed: ${msg}`);
    logger.error('[OsmOverpass] Hospital fetch error', { error: msg });
  }

  logger.info('[OsmOverpass] Sync complete', {
    groceries: result.groceries,
    parks: result.parks,
    hospitals: result.hospitals,
    errors: errors.length,
  });

  return result;
}
