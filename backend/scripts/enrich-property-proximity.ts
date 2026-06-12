/**
 * Enrich property_proximity Records
 *
 * One-shot, re-runnable enrichment that:
 *   1. Pulls Atlanta crime incidents (past 12 months) from the public Atlanta
 *      PD ArcGIS feature service (`OpenDataWebsite_Crime_view`, layer 0).
 *   2. For each property with lat/lng, computes a per-property crime_index
 *      = (incidents_within_1mi / city_mean_incidents_within_1mi) * 100.
 *   3. Calls ProximityService.computeProximityScores with city/state/zip and
 *      the resolved crime indices so the row is persisted with a queryable
 *      city tag and crime_index.
 *
 * Activates correlations COR-23 (Transit Proximity → Rent Premium) and
 * COR-24 (Crime Rate → Occupancy) in correlationEngine.service.ts, both of
 * which filter property_proximity by `city ILIKE $1`.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/enrich-property-proximity.ts
 *   cd backend && npx ts-node --transpile-only scripts/enrich-property-proximity.ts --city=Atlanta
 *   cd backend && npx ts-node --transpile-only scripts/enrich-property-proximity.ts --city=Atlanta --skip-crime
 *
 * Re-run safely: ProximityService.saveProximityScores upserts on property_id.
 *
 * Endpoint note: the existing `atlanta-pd-crime.service.ts` points at a
 * `Atlanta_Crime_Data_Prod` feature server that no longer exists (returns 400).
 * This script bypasses that broken pipeline and pulls directly from the
 * OpenDataWebsite_Crime_view layer that does respond. When the upstream
 * service is repaired, crime_statistics will start populating and the
 * proximity service's ZIP-based fallback will take over automatically.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import axios from 'axios';
import { getProximityService } from '../src/services/proximity';

const ARCGIS_CRIME_URL =
  'https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0/query';

const VIOLENT_OFFENSES = new Set([
  'Murder and Nonnegligent Manslaughter',
  'Negligent Manslaughter',
  'Rape',
  'Robbery',
  'Aggravated Assault',
  'Simple Assault',
  'Kidnapping/Abduction',
]);

const PROPERTY_OFFENSES = new Set([
  'Burglary/Breaking & Entering',
  'Larceny/Theft Offenses',
  'Motor Vehicle Theft',
  'Arson',
  'Destruction/Damage/Vandalism of Property',
  'Stolen Property Offenses',
  'Shoplifting',
  'Theft From Motor Vehicle',
]);

interface Args {
  city: string;
  skipCrime: boolean;
  radiusMiles: number;
}

function parseArgs(): Args {
  const args: Args = { city: 'Atlanta', skipCrime: false, radiusMiles: 1.0 };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--city=')) args.city = a.slice('--city='.length);
    else if (a === '--skip-crime') args.skipCrime = true;
    else if (a.startsWith('--radius=')) args.radiusMiles = parseFloat(a.slice('--radius='.length));
  }
  return args;
}

interface CrimeIncident {
  lat: number;
  lng: number;
  offense: string;
}

async function fetchCrimeIncidents(): Promise<CrimeIncident[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const where = `OccurredFromDate >= TIMESTAMP '${cutoffStr} 00:00:00'`;

  const PAGE_SIZE = 2000;
  const MAX_PAGES = 40;
  const incidents: CrimeIncident[] = [];

  console.log(`[Enrich] Fetching crime incidents since ${cutoffStr}...`);

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const res = await axios.get(ARCGIS_CRIME_URL, {
      params: {
        where,
        outFields: 'OccurredFromDate,Latitude,Longitude,NIBRS_Offense',
        returnGeometry: false,
        orderByFields: 'OBJECTID',
        resultRecordCount: PAGE_SIZE,
        resultOffset: offset,
        f: 'json',
      },
      timeout: 60_000,
      headers: { 'User-Agent': 'JediRe-PropertyProximityEnrich/1.0' },
    });
    const data = res.data;
    if (data.error) throw new Error(`ArcGIS ${data.error.code}: ${data.error.message}`);
    const features = data.features ?? [];
    for (const f of features) {
      const a = f.attributes || {};
      const lat = a.Latitude;
      const lng = a.Longitude;
      if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
        incidents.push({ lat, lng, offense: a.NIBRS_Offense || '' });
      }
    }
    process.stdout.write(`  page ${page + 1}: +${features.length} (total ${incidents.length})\n`);
    if (!data.exceededTransferLimit || features.length === 0) break;
  }

  console.log(`[Enrich] Fetched ${incidents.length} geocoded incidents`);
  return incidents;
}

interface PropertyRow {
  id: string;
  address_line1: string | null;
  city: string | null;
  state_code: string | null;
  county: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  parcel_id: string | null;
  stories: number | null;
}

interface CrimeCounts {
  total: number;
  violent: number;
  property: number;
}

const MILES_PER_DEGREE_LAT = 69.0;

function countIncidentsWithinRadius(
  prop: { lat: number; lng: number },
  incidents: CrimeIncident[],
  radiusMiles: number
): CrimeCounts {
  // Cheap bounding box pre-filter, then haversine for matches near the edge.
  // For a 1mi radius this is plenty accurate without the cost of a full
  // haversine on every incident.
  const latDelta = radiusMiles / MILES_PER_DEGREE_LAT;
  const lngDelta = radiusMiles / (MILES_PER_DEGREE_LAT * Math.cos((prop.lat * Math.PI) / 180));
  const radiusSqDeg = (radiusMiles / MILES_PER_DEGREE_LAT) ** 2;

  let total = 0;
  let violent = 0;
  let propertyCnt = 0;

  for (const inc of incidents) {
    if (Math.abs(inc.lat - prop.lat) > latDelta) continue;
    if (Math.abs(inc.lng - prop.lng) > lngDelta) continue;
    // Approximate squared-degree distance using flat-earth correction
    const dLat = inc.lat - prop.lat;
    const dLng = (inc.lng - prop.lng) * Math.cos((prop.lat * Math.PI) / 180);
    if (dLat * dLat + dLng * dLng > radiusSqDeg) continue;
    total++;
    if (VIOLENT_OFFENSES.has(inc.offense)) violent++;
    if (PROPERTY_OFFENSES.has(inc.offense)) propertyCnt++;
  }

  return { total, violent, property: propertyCnt };
}

/**
 * Look up stories for a property from county assessor sources and persist to
 * properties.stories when the column is not already set.
 *
 * Priority:
 *   1. property_info_cache by parcel_id (ArcGIS / county assessor ingestion)
 *   2. property_info_cache by address + city + state (fallback when no parcel_id)
 *   3. data_library_assets with county source types linked to any deal for this property
 *
 * Uses COALESCE so an existing stories value is never overwritten.
 * Returns the resolved stories value if one was written, null otherwise.
 */
async function persistStoriesFromCounty(
  pool: Pool,
  prop: PropertyRow
): Promise<number | null> {
  if (prop.stories != null && prop.stories > 0) {
    return null;
  }

  let resolvedStories: number | null = null;

  if (prop.parcel_id) {
    const res = await pool.query<{ stories: number | null }>(
      `SELECT stories
       FROM property_info_cache
       WHERE parcel_id = $1
         AND stories IS NOT NULL
         AND stories > 0
       ORDER BY fetched_at DESC
       LIMIT 1`,
      [prop.parcel_id]
    );
    if (res.rows.length > 0 && res.rows[0].stories != null) {
      resolvedStories = Number(res.rows[0].stories);
    }
  }

  if (resolvedStories == null && prop.address_line1 && prop.city && prop.state_code) {
    const res = await pool.query<{ stories: number | null }>(
      `SELECT stories
       FROM property_info_cache
       WHERE address ILIKE $1
         AND city ILIKE $2
         AND state ILIKE $3
         AND stories IS NOT NULL
         AND stories > 0
       ORDER BY fetched_at DESC
       LIMIT 1`,
      [prop.address_line1, prop.city, prop.state_code]
    );
    if (res.rows.length > 0 && res.rows[0].stories != null) {
      resolvedStories = Number(res.rows[0].stories);
    }
  }

  if (resolvedStories == null) {
    const res = await pool.query<{ stories: number | null }>(
      `SELECT dla.stories
       FROM data_library_assets dla
       JOIN deals d ON d.id = dla.deal_id
       JOIN properties p ON p.deal_id = d.id
       WHERE p.id = $1::uuid
         AND dla.stories IS NOT NULL
         AND dla.stories > 0
         AND dla.source_type IN ('county_records', 'tax_bill', 'assessor')
       ORDER BY dla.stories DESC
       LIMIT 1`,
      [prop.id]
    );
    if (res.rows.length > 0 && res.rows[0].stories != null) {
      resolvedStories = Number(res.rows[0].stories);
    }
  }

  if (resolvedStories != null && resolvedStories > 0) {
    const updateRes = await pool.query(
      `UPDATE properties
       SET stories    = COALESCE(NULLIF(stories, 0), $2::integer),
           updated_at = NOW()
       WHERE id = $1::uuid
         AND (stories IS NULL OR stories = 0)`,
      [prop.id, resolvedStories]
    );
    return updateRes.rowCount != null && updateRes.rowCount > 0 ? resolvedStories : null;
  }

  return null;
}

async function main() {
  const args = parseArgs();
  console.log(
    `[Enrich] Starting property_proximity enrichment for city="${args.city}" radius=${args.radiusMiles}mi`
  );

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const service = getProximityService(pool);

  try {
    const propRes = await pool.query<PropertyRow>(
      `SELECT id, address_line1, city, state_code, county, zip, lat, lng, parcel_id,
              stories
       FROM properties
       WHERE city ILIKE $1
         AND lat IS NOT NULL
         AND lng IS NOT NULL`,
      [args.city]
    );

    console.log(`[Enrich] Found ${propRes.rows.length} properties with lat/lng for "${args.city}"`);
    if (propRes.rows.length === 0) {
      console.warn('[Enrich] Nothing to enrich; aborting.');
      return;
    }

    let incidents: CrimeIncident[] = [];
    if (!args.skipCrime) {
      try {
        incidents = await fetchCrimeIncidents();
      } catch (err) {
        console.error('[Enrich] Crime fetch failed:', err instanceof Error ? err.message : err);
        console.warn('[Enrich] Continuing without crime data — crime_index will stay null');
      }
    }

    // Pre-compute per-property counts and the city mean for normalization
    const counts = new Map<string, CrimeCounts>();
    let sumTotal = 0;
    let sumViolent = 0;
    let sumProperty = 0;
    let n = 0;
    if (incidents.length > 0) {
      for (const p of propRes.rows) {
        const c = countIncidentsWithinRadius({ lat: p.lat!, lng: p.lng! }, incidents, args.radiusMiles);
        counts.set(p.id, c);
        sumTotal += c.total;
        sumViolent += c.violent;
        sumProperty += c.property;
        n++;
      }
    }
    const meanTotal = n > 0 ? sumTotal / n : 0;
    const meanViolent = n > 0 ? sumViolent / n : 0;
    const meanProperty = n > 0 ? sumProperty / n : 0;
    console.log(
      `[Enrich] Crime baseline (${args.radiusMiles}mi radius): mean total=${meanTotal.toFixed(1)}, violent=${meanViolent.toFixed(1)}, property=${meanProperty.toFixed(1)} across ${n} properties`
    );

    let ok = 0;
    let failed = 0;
    let withCrime = 0;
    let withTransit = 0;
    let storiesWritten = 0;
    let storiesAlreadySet = 0;

    for (const p of propRes.rows) {
      const c = counts.get(p.id);
      const crimeIndex =
        c && meanTotal > 0 ? Math.round((c.total / meanTotal) * 100 * 10) / 10 : undefined;
      const violentIndex =
        c && meanViolent > 0
          ? Math.round((c.violent / meanViolent) * 100 * 10) / 10
          : undefined;
      const propertyIndex =
        c && meanProperty > 0
          ? Math.round((c.property / meanProperty) * 100 * 10) / 10
          : undefined;

      try {
        const scores = await service.computeProximityScores(p.lat!, p.lng!, {
          propertyId: p.id,
          parcelId: p.parcel_id ?? undefined,
          address: p.address_line1 ?? undefined,
          city: p.city ?? args.city,
          state: p.state_code ?? undefined,
          county: p.county ?? undefined,
          zip: p.zip ?? undefined,
          crimeIndexOverride: crimeIndex,
          violentCrimeIndexOverride: violentIndex,
          propertyCrimeIndexOverride: propertyIndex,
          saveToDb: true,
        });
        ok++;
        if (scores.safety.crimeIndex !== undefined) withCrime++;
        if ((scores.transit.transitScore ?? 0) > 0) withTransit++;

        // Persist stories from county assessor records (property_info_cache)
        // when not already set on the properties row.
        if (p.stories != null && p.stories > 0) {
          storiesAlreadySet++;
        } else {
          const written = await persistStoriesFromCounty(pool, p);
          if (written != null) storiesWritten++;
        }

        await new Promise((r) => setTimeout(r, 30));
      } catch (err) {
        failed++;
        console.error(`[Enrich] property ${p.id} failed:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[Enrich] Complete: ${ok} succeeded, ${failed} failed`);
    console.log(`[Enrich] Coverage: transit_score on ${withTransit}/${ok}, crime_index on ${withCrime}/${ok}`);
    console.log(
      `[Enrich] Stories: ${storiesAlreadySet} already set, ${storiesWritten} written from county records`
    );

    const verifyRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE city ILIKE $1) AS city_rows,
         COUNT(*) FILTER (WHERE city ILIKE $1 AND transit_score IS NOT NULL) AS with_transit,
         COUNT(*) FILTER (WHERE city ILIKE $1 AND crime_index IS NOT NULL) AS with_crime,
         ROUND(AVG(transit_score) FILTER (WHERE city ILIKE $1)::numeric, 1) AS avg_transit,
         ROUND(AVG(crime_index) FILTER (WHERE city ILIKE $1)::numeric, 1) AS avg_crime
       FROM property_proximity`,
      [args.city]
    );
    console.log(`[Enrich] Post-enrichment property_proximity for "${args.city}":`, verifyRes.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Enrich] Fatal:', err);
  process.exit(1);
});
