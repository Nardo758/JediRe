#!/usr/bin/env ts-node
/**
 * Phase 8 Backfill Script
 * Runs research enrichment (web search + Google Places) for all archive properties
 * that have lat/lng or address data but lack Phase 8 content in property_descriptions.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-phase8-research.ts
 *
 * Flags:
 *   --dry-run         Print which properties would be processed; do not enrich
 *   --force           Re-enrich even if property already has Phase 8 data
 *   --limit=N         Process at most N properties (default: all)
 *   --concurrency=N   Parallel workers (default: 3)
 *   --city=CITY       Filter to properties in a specific city
 *   --skip-places     Skip Google Places step (only run Tavily web search)
 *   --jitter=MS       Max random jitter in ms between tasks (default: 1500)
 */

import { Pool } from 'pg';
import { runResearchEnrichment } from '../src/services/research/research-enrichment.service';
import { recalculateDQScore } from '../src/services/research/dq-recalculator.service';

function parseFlag(flag: string, defaultVal: string | null = null): string | null {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`));
  return arg ? arg.split('=')[1] ?? defaultVal : defaultVal;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

const DRY_RUN = hasFlag('dry-run');
const FORCE = hasFlag('force');
const SKIP_PLACES = hasFlag('skip-places');
const LIMIT = parseInt(parseFlag('limit', '0') ?? '0', 10);
const CONCURRENCY = parseInt(parseFlag('concurrency', '3') ?? '3', 10);
const CITY_FILTER = parseFlag('city');
const JITTER_MS = parseInt(parseFlag('jitter', '1500') ?? '1500', 10);

interface PropertyRow {
  asset_id: string;
  property_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  has_phase8: boolean;
}

async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<{ ok: boolean; result?: T; error?: string }>> {
  const results: Array<{ ok: boolean; result?: T; error?: string }> = [];
  const queue = [...tasks];
  let active = 0;
  let idx = 0;

  return new Promise(resolve => {
    function runNext() {
      while (active < concurrency && queue.length > 0) {
        const task = queue.shift()!;
        const taskIdx = idx++;
        active++;
        task()
          .then(result => {
            results[taskIdx] = { ok: true, result };
          })
          .catch(err => {
            results[taskIdx] = { ok: false, error: (err as Error).message };
          })
          .finally(() => {
            active--;
            if (queue.length === 0 && active === 0) resolve(results);
            else runNext();
          });
      }
    }
    runNext();
    if (queue.length === 0) resolve(results);
  });
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  console.log(`\n[phase8-backfill] Starting Phase 8 research backfill`);
  console.log(`  dry-run: ${DRY_RUN}, force: ${FORCE}, skip-places: ${SKIP_PLACES}, limit: ${LIMIT || 'all'}, concurrency: ${CONCURRENCY}, jitter: ${JITTER_MS}ms`);
  if (CITY_FILTER) console.log(`  city filter: ${CITY_FILTER}`);

  const whereConditions: string[] = [];
  const params: unknown[] = [];

  if (!FORCE) {
    whereConditions.push(`(pd.reviews IS NULL AND pd.recent_events IS NULL AND pd.photos IS NULL)`);
  }

  if (CITY_FILTER) {
    whereConditions.push(`LOWER(a.city) = $${params.length + 1}`);
    params.push(CITY_FILTER.toLowerCase());
  }

  const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : '';
  const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : '';

  const query = `
    SELECT
      a.id AS asset_id,
      a.property_name,
      a.address,
      a.city,
      a.state,
      (pd.reviews IS NOT NULL OR pd.recent_events IS NOT NULL) AS has_phase8
    FROM data_library_assets a
    LEFT JOIN property_descriptions pd ON pd.parcel_id = a.property_name
    WHERE a.property_name IS NOT NULL
      AND a.source_type = 'archive'
      ${whereClause}
    ORDER BY a.created_at DESC
    ${limitClause}
  `;

  const { rows } = await pool.query<PropertyRow>(query, params);

  console.log(`\n[phase8-backfill] Found ${rows.length} properties to process\n`);

  if (rows.length === 0) {
    console.log('[phase8-backfill] Nothing to do — all properties already have Phase 8 data. Use --force to re-run.');
    await pool.end();
    return;
  }

  if (DRY_RUN) {
    console.log('[phase8-backfill] DRY RUN — would process:');
    rows.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.property_name} (${r.city ?? '?'}, ${r.state ?? '?'}) — has_phase8: ${r.has_phase8}`);
    });
    await pool.end();
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  const tasks = rows.map(r => async () => {
    const label = `${r.property_name.slice(0, 40)} (${r.city ?? '?'}, ${r.state ?? '?'})`;
    try {
      if (JITTER_MS > 0) {
        await new Promise(res => setTimeout(res, Math.floor(Math.random() * JITTER_MS)));
      }
      console.log(`  → enriching: ${label}${SKIP_PLACES ? ' [skip-places]' : ''}`);
      const result = await runResearchEnrichment({
        parcelId: r.property_name,
        propertyName: r.property_name,
        address: r.address,
        city: r.city,
        state: r.state,
        skipPlaces: SKIP_PLACES,
      });

      if (result.fields_written.length === 0) {
        console.log(`    ✗ no fields written (places: ${result.places_status}, web: ${result.web_status})`);
        skipped++;
        return;
      }

      await recalculateDQScore(r.asset_id);

      console.log(`    ✓ wrote [${result.fields_written.join(', ')}] — ${result.reviews_count} reviews, ${result.photos_count} photos, ${result.narrative_words} narrative words`);
      success++;
    } catch (err) {
      console.error(`    ✗ FAILED: ${(err as Error).message}`);
      failed++;
    }
  });

  await pLimit(tasks, CONCURRENCY);

  await pool.end();

  console.log(`\n[phase8-backfill] Complete`);
  console.log(`  ✓ success: ${success}`);
  console.log(`  – skipped: ${skipped}`);
  console.log(`  ✗ failed:  ${failed}`);
}

main().catch(err => {
  console.error('[phase8-backfill] Fatal:', err.message);
  process.exit(1);
});
