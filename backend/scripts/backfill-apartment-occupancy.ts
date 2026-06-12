/**
 * Backfill Apartment Occupancy & Rent
 *
 * Populates current_occupancy, avg_rent, and beds for multifamily properties
 * (units > 1) where these fields are null or hold the default placeholder 0.
 *
 * Data priority:
 *   1. City-level averages from market_rent_comps (where available)
 *   2. Metro-level estimates from METRO_ESTIMATES lookup table
 *   3. National default (94% occupancy, $1,500 avg rent)
 *
 * Idempotent: rows where current_occupancy > 0 AND avg_rent IS NOT NULL
 * are skipped unless --force is passed.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/backfill-apartment-occupancy.ts
 *   npx ts-node --transpile-only scripts/backfill-apartment-occupancy.ts --dry-run
 *   npx ts-node --transpile-only scripts/backfill-apartment-occupancy.ts --city=Atlanta
 *   npx ts-node --transpile-only scripts/backfill-apartment-occupancy.ts --force
 */

import { pool } from '../src/database';

// ─── Metro Estimates ────────────────────────────────────────────────────────
// Based on publicly available 2024-2025 apartment market data.
// occupancy: decimal 0-1; avg_rent: USD per month (blended all unit types)
interface MetroEstimate {
  occupancy: number;
  avgRent: number;
  source: string;
}

const METRO_ESTIMATES: Record<string, MetroEstimate> = {
  // key: "city|state" (lowercase)
  'atlanta|ga':       { occupancy: 0.930, avgRent: 1852, source: 'market_rent_comps_2026' },
  'houston|tx':       { occupancy: 0.905, avgRent: 1200, source: 'metro_estimate_2025' },
  'nashville|tn':     { occupancy: 0.928, avgRent: 1750, source: 'metro_estimate_2025' },
  'jacksonville|fl':  { occupancy: 0.918, avgRent: 1400, source: 'metro_estimate_2025' },
  'orlando|fl':       { occupancy: 0.925, avgRent: 1550, source: 'metro_estimate_2025' },
  'tampa|fl':         { occupancy: 0.928, avgRent: 1600, source: 'metro_estimate_2025' },
  'austin|tx':        { occupancy: 0.872, avgRent: 1900, source: 'metro_estimate_2025' },
  'charlotte|nc':     { occupancy: 0.921, avgRent: 1650, source: 'metro_estimate_2025' },
  'dallas|tx':        { occupancy: 0.895, avgRent: 1450, source: 'metro_estimate_2025' },
  'san antonio|tx':   { occupancy: 0.902, avgRent: 1200, source: 'metro_estimate_2025' },
  'miami|fl':         { occupancy: 0.953, avgRent: 2400, source: 'metro_estimate_2025' },
  'phoenix|az':       { occupancy: 0.905, avgRent: 1550, source: 'metro_estimate_2025' },
  'denver|co':        { occupancy: 0.913, avgRent: 1850, source: 'metro_estimate_2025' },
  'seattle|wa':       { occupancy: 0.942, avgRent: 2200, source: 'metro_estimate_2025' },
  'raleigh|nc':       { occupancy: 0.918, avgRent: 1650, source: 'metro_estimate_2025' },
  'richmond|va':      { occupancy: 0.932, avgRent: 1450, source: 'metro_estimate_2025' },
  'memphis|tn':       { occupancy: 0.905, avgRent: 1100, source: 'metro_estimate_2025' },
  'louisville|ky':    { occupancy: 0.915, avgRent: 1050, source: 'metro_estimate_2025' },
  'columbus|oh':      { occupancy: 0.921, avgRent: 1150, source: 'metro_estimate_2025' },
  'indianapolis|in':  { occupancy: 0.915, avgRent: 1100, source: 'metro_estimate_2025' },
  'college park|ga':  { occupancy: 0.920, avgRent: 1400, source: 'metro_estimate_2025' },
  'decatur|ga':       { occupancy: 0.925, avgRent: 1600, source: 'metro_estimate_2025' },
  'duluth|ga':        { occupancy: 0.930, avgRent: 1500, source: 'metro_estimate_2025' },
};

const NATIONAL_DEFAULT: MetroEstimate = {
  occupancy: 0.940,
  avgRent:   1500,
  source:    'national_default_2025',
};

// ─── Flags ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');
const CITY_FILTER = args.find(a => a.startsWith('--city='))?.replace('--city=', '') ?? null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lookupEstimate(city: string, state: string): MetroEstimate {
  const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
  return METRO_ESTIMATES[key] ?? NATIONAL_DEFAULT;
}

async function buildCompsCityAverages(): Promise<Map<string, MetroEstimate>> {
  const map = new Map<string, MetroEstimate>();
  const { rows } = await pool.query<{
    city: string;
    state: string;
    avg_rent: string;
    avg_occupancy: string;
    comp_count: string;
  }>(`
    SELECT
      city,
      state,
      ROUND(AVG(COALESCE(avg_effective_rent, avg_asking_rent))::numeric, 0) AS avg_rent,
      ROUND(AVG(occupancy_pct)::numeric, 4)                                  AS avg_occupancy,
      COUNT(*)                                                                AS comp_count
    FROM market_rent_comps
    WHERE (avg_effective_rent IS NOT NULL OR avg_asking_rent IS NOT NULL)
      AND occupancy_pct IS NOT NULL
      AND occupancy_pct > 0.5          -- exclude placeholder zeros
    GROUP BY city, state
  `);
  for (const row of rows) {
    const key = `${row.city.toLowerCase()}|${row.state.toLowerCase()}`;
    map.set(key, {
      occupancy: parseFloat(row.avg_occupancy),
      avgRent:   parseFloat(row.avg_rent),
      source:    `market_rent_comps_${row.comp_count}_props`,
    });
  }
  return map;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Apartment Occupancy & Rent Backfill ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Force: ${FORCE} | City filter: ${CITY_FILTER ?? 'all'}`);
  console.log('');

  // 1. Build city-level averages from real comps
  const compsMap = await buildCompsCityAverages();
  console.log(`Loaded ${compsMap.size} city-level comp average(s):`);
  for (const [key, val] of compsMap.entries()) {
    console.log(`  ${key}: occ=${(val.occupancy * 100).toFixed(1)}%, rent=$${val.avgRent} (${val.source})`);
  }
  console.log('');

  // 2. Fetch multifamily properties that need backfill
  //    "Needs backfill" = occupancy is NULL or 0, OR avg_rent is NULL, OR beds is NULL
  //    Unless --force, skip rows where occupancy > 0 AND avg_rent IS NOT NULL AND beds IS NOT NULL
  const needsOccupancy = FORCE
    ? 'true'
    : '(p.current_occupancy IS NULL OR p.current_occupancy = 0)';
  const needsRent = FORCE
    ? 'true'
    : 'p.avg_rent IS NULL';
  const needsBeds = FORCE
    ? 'true'
    : 'p.beds IS NULL';

  const cityClause = CITY_FILTER
    ? `AND LOWER(p.city) = LOWER($1)`
    : '';
  const queryParams = CITY_FILTER ? [CITY_FILTER] : [];

  const { rows: properties } = await pool.query<{
    id: string;
    name: string | null;
    city: string | null;
    state_code: string | null;
    units: string;
    current_occupancy: string | null;
    avg_rent: string | null;
    beds: string | null;
  }>(`
    SELECT id, name, city, state_code, units, current_occupancy, avg_rent, beds
    FROM properties p
    WHERE p.units > 1
      AND (${needsOccupancy} OR ${needsRent} OR ${needsBeds})
      ${cityClause}
    ORDER BY p.city, p.units DESC
  `, queryParams);

  console.log(`Found ${properties.length} multifamily properties needing backfill.`);
  if (properties.length === 0) {
    console.log('Nothing to do. Use --force to re-run even for already-populated rows.');
    await pool.end();
    return;
  }

  // 3. Build per-property updates
  type PropertyUpdate = {
    id: string;
    occupancy: number | null;
    avg_rent: number | null;
    beds: number | null;
    skip_occupancy: boolean;
    skip_rent: boolean;
    skip_beds: boolean;
    source: string;
    city: string;
  };

  const updates: PropertyUpdate[] = [];

  for (const prop of properties) {
    const city  = prop.city ?? '';
    const state = prop.state_code ?? '';
    const compKey = `${city.toLowerCase()}|${state.toLowerCase()}`;
    const estimate = compsMap.get(compKey) ?? lookupEstimate(city, state);

    const currentOcc  = prop.current_occupancy !== null ? parseFloat(prop.current_occupancy) : null;
    const currentRent = prop.avg_rent !== null ? parseFloat(prop.avg_rent) : null;
    const currentBeds = prop.beds !== null ? parseInt(prop.beds) : null;

    const skipOcc  = !FORCE && currentOcc !== null && currentOcc > 0;
    const skipRent = !FORCE && currentRent !== null;
    const skipBeds = !FORCE && currentBeds !== null;

    // Infer beds from unit count if small building, otherwise default to 1
    const inferredBeds = parseInt(prop.units) <= 2 ? 1 : 1; // default 1BR blended

    updates.push({
      id:             prop.id,
      occupancy:      skipOcc  ? null : estimate.occupancy,
      avg_rent:       skipRent ? null : estimate.avgRent,
      beds:           skipBeds ? null : inferredBeds,
      skip_occupancy: skipOcc,
      skip_rent:      skipRent,
      skip_beds:      skipBeds,
      source:         estimate.source,
      city:           `${city}, ${state}`,
    });
  }

  // 4. Summary by city
  const citySummary: Record<string, { count: number; occupancy: number; rent: number }> = {};
  for (const u of updates) {
    if (!citySummary[u.city]) citySummary[u.city] = { count: 0, occupancy: 0, rent: 0 };
    citySummary[u.city].count++;
    if (!u.skip_occupancy && u.occupancy !== null) citySummary[u.city].occupancy = u.occupancy;
    if (!u.skip_rent     && u.avg_rent  !== null) citySummary[u.city].rent      = u.avg_rent;
  }
  console.log('\nBackfill plan by city:');
  console.log('  City                    | Count | Occupancy | Avg Rent');
  console.log('  ----------------------- | ----- | --------- | --------');
  for (const [city, s] of Object.entries(citySummary).sort()) {
    const occ  = s.occupancy ? `${(s.occupancy * 100).toFixed(1)}%` : '(skip)';
    const rent = s.rent      ? `$${s.rent}`                         : '(skip)';
    console.log(`  ${city.padEnd(23)} | ${String(s.count).padStart(5)} | ${occ.padStart(9)} | ${rent}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No database writes. Rerun without --dry-run to apply.');
    await pool.end();
    return;
  }

  // 5. Apply updates in batches
  console.log('\nApplying updates...');
  let updatedOcc  = 0;
  let updatedRent = 0;
  let updatedBeds = 0;
  let skipped     = 0;

  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await pool.query('BEGIN');
    try {
      for (const u of batch) {
        if (u.skip_occupancy && u.skip_rent && u.skip_beds) {
          skipped++;
          continue;
        }
        const setClauses: string[] = [];
        const params: (number | string | null)[] = [];
        let pIdx = 1;

        if (!u.skip_occupancy && u.occupancy !== null) {
          setClauses.push(`current_occupancy = $${pIdx++}`);
          params.push(u.occupancy);
          updatedOcc++;
        }
        if (!u.skip_rent && u.avg_rent !== null) {
          setClauses.push(`avg_rent = $${pIdx++}`);
          params.push(u.avg_rent);
          updatedRent++;
        }
        if (!u.skip_beds && u.beds !== null) {
          setClauses.push(`beds = $${pIdx++}`);
          params.push(u.beds);
          updatedBeds++;
        }

        if (setClauses.length === 0) {
          skipped++;
          continue;
        }

        // Track enrichment source
        setClauses.push(`enrichment_source = $${pIdx++}`);
        params.push(`backfill_occupancy_rent_v1:${u.source}`);
        setClauses.push(`last_enriched_at = NOW()`);

        params.push(u.id);
        await pool.query(
          `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $${pIdx}`,
          params,
        );
      }
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    const done = Math.min(i + BATCH, updates.length);
    process.stdout.write(`  ${done}/${updates.length} processed...\r`);
  }

  console.log(`\n\nDone!`);
  console.log(`  occupancy updated : ${updatedOcc}`);
  console.log(`  avg_rent  updated : ${updatedRent}`);
  console.log(`  beds      updated : ${updatedBeds}`);
  console.log(`  skipped           : ${skipped}`);

  // 6. Validation query
  const { rows: after } = await pool.query<{
    total: string; missing_occ: string; missing_rent: string; missing_beds: string;
    zero_occ: string;
  }>(`
    SELECT
      COUNT(*)                                                    AS total,
      COUNT(*) FILTER (WHERE current_occupancy IS NULL)          AS missing_occ,
      COUNT(*) FILTER (WHERE current_occupancy = 0)              AS zero_occ,
      COUNT(*) FILTER (WHERE avg_rent IS NULL)                   AS missing_rent,
      COUNT(*) FILTER (WHERE beds IS NULL)                       AS missing_beds
    FROM properties
    WHERE units > 1
  `);
  const a = after[0];
  console.log('\nPost-backfill state (multifamily, units > 1):');
  console.log(`  Total properties : ${a.total}`);
  console.log(`  NULL occupancy   : ${a.missing_occ}`);
  console.log(`  Zero occupancy   : ${a.zero_occ}`);
  console.log(`  NULL avg_rent    : ${a.missing_rent}`);
  console.log(`  NULL beds        : ${a.missing_beds}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
