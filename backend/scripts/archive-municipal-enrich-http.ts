/**
 * archive-municipal-enrich-http.ts
 *
 * HTTP version of the municipal enrichment runner — designed to run on
 * Leon's Windows machine where county GIS ArcGIS endpoints are reachable.
 *
 * Flow:
 *   1. GET  /api/v1/archive/municipal-queue  — fetch properties needing enrichment
 *   2. For each property, call county GIS via the local provider registry
 *   3. POST /api/v1/archive/municipal-result — write results back through Replit API
 *
 * No direct DB access required — everything goes through the HTTP API.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich-http.ts
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich-http.ts --limit 20
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich-http.ts --state GA
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich-http.ts --resume
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich-http.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPropertyInfoRegistry } from '../src/services/property-enrichment/property-info/provider-registry';

// ── Config ────────────────────────────────────────────────────────────────────

const ENDPOINT  = (process.env.ARCHIVE_ENDPOINT  ?? 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive').replace(/\/$/, '');
const SECRET    = process.env.ARCHIVE_INGEST_SECRET ?? 'jedire-archive-2026';
const STATE_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'ARCHIVE_MUNICIPAL_HTTP_STATE.json');

// ── CLI flags ─────────────────────────────────────────────────────────────────

function argVal(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

const flags = {
  limit:  argVal('limit')  ? parseInt(argVal('limit')!, 10) : 9999,
  state:  argVal('state')  ?? null,
  resume: process.argv.includes('--resume'),
  dryRun: process.argv.includes('--dry-run'),
};

// ── State persistence ─────────────────────────────────────────────────────────

interface RunState {
  startedAt: string;
  completedAt: string | null;
  enriched: number;
  skipped: number;
  errors: number;
  perProperty: Record<string, { status: 'done' | 'skipped' | 'error'; fields?: string[]; error?: string }>;
}

function loadState(): RunState {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch { /* ignore */ }
  return { startedAt: new Date().toISOString(), completedAt: null, enriched: 0, skipped: 0, errors: 0, perProperty: {} };
}

function saveState(s: RunState) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2), 'utf-8');
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${ENDPOINT}${path}`, {
    headers: { 'x-ingest-secret': SECRET },
  });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method: 'POST',
    headers: { 'x-ingest-secret': SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   Municipal Enrichment — HTTP Mode (runs locally)       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  if (flags.dryRun)  console.log('🧪 DRY RUN — no data will be written');
  if (flags.resume)  console.log('↻  Resume mode');
  if (flags.state)   console.log(`→  State filter: ${flags.state}`);
  if (flags.limit < 9999) console.log(`→  Limit: ${flags.limit}`);
  console.log(`   Endpoint: ${ENDPOINT}\n`);

  const state = loadState();
  const registry = getPropertyInfoRegistry();

  // 1. Fetch the queue from Replit
  const queueUrl = `/municipal-queue?limit=${Math.min(flags.limit, 500)}&resume=${flags.resume}${flags.state ? `&state=${flags.state}` : ''}`;
  console.log(`Fetching queue from Replit...`);
  const queueResp = await apiGet(queueUrl) as { success: boolean; count: number; properties: Array<{ parcel_id: string; property_name: string | null; street: string; city: string; state: string; zip: string | null }> };

  if (!queueResp.success) throw new Error('Queue fetch failed');

  let props = queueResp.properties;
  console.log(`Got ${props.length} properties to enrich\n`);

  // Apply resume skip from local state
  if (flags.resume) {
    props = props.filter(p => state.perProperty[p.parcel_id]?.status !== 'done');
    console.log(`After resume filter: ${props.length} remaining\n`);
  }

  // Apply limit after queue fetch (queue already limits, but cap here too)
  if (props.length > flags.limit) props = props.slice(0, flags.limit);

  let enriched = 0, skipped = 0, errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const pct = ((i + 1) / props.length * 100).toFixed(1);
    console.log(`\n[${i + 1}/${props.length} ${pct}%] ${prop.parcel_id}`);
    console.log(`  Address: ${prop.street}, ${prop.city}, ${prop.state} ${prop.zip || ''}`);

    try {
      const { info, provider } = await registry.fetchPropertyInfo(
        prop.street,
        prop.city,
        prop.state,
        prop.zip || undefined,
        undefined,
        undefined,
      );

      if (!info) {
        console.log(`  ⚠ No municipal data found`);
        state.perProperty[prop.parcel_id] = { status: 'skipped', error: 'no_municipal_data' };
        skipped++;
        saveState(state);
        continue;
      }

      const fields: string[] = [];
      if (info.yearBuilt)      fields.push('year_built');
      if (info.numberOfUnits)  fields.push('unit_count');
      if (info.stories)        fields.push('stories');
      if (info.livingAreaSqFt) fields.push('total_sqft');
      if (info.acres)          fields.push('lot_size_acres');
      if (info.zoning)         fields.push('zoning_code');
      if (info.address)        fields.push('address');

      console.log(`  ✓ ${provider}`);
      console.log(`    year_built=${info.yearBuilt ?? '—'}  units=${info.numberOfUnits ?? '—'}  stories=${info.stories ?? '—'}  sqft=${info.livingAreaSqFt ?? '—'}  zoning=${info.zoning ?? '—'}`);

      if (flags.dryRun) {
        console.log(`  🧪 Would write ${fields.length} fields: ${fields.join(', ')}`);
        state.perProperty[prop.parcel_id] = { status: 'done', fields };
        enriched++;
      } else {
        await apiPost('/municipal-result', {
          parcel_id:      prop.parcel_id,
          provider,
          api_endpoint:   `arcgis://${provider}`,
          year_built:     info.yearBuilt     ?? undefined,
          unit_count:     info.numberOfUnits ?? undefined,
          stories:        info.stories       ?? undefined,
          total_sqft:     info.livingAreaSqFt ?? undefined,
          lot_size_acres: info.acres         ?? undefined,
          zoning:         info.zoning        ?? undefined,
          address:        info.address       ?? undefined,
          city:           info.city          ?? undefined,
          state:          info.state         ?? undefined,
          zip:            info.zip           ?? undefined,
        });
        console.log(`  ✓ Wrote ${fields.length} fields to Replit DB`);
        state.perProperty[prop.parcel_id] = { status: 'done', fields };
        enriched++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${msg}`);
      state.perProperty[prop.parcel_id] = { status: 'error', error: msg };
      errors++;
    }

    saveState(state);

    // Polite rate limit
    if (i < props.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  state.completedAt = new Date().toISOString();
  saveState(state);

  console.log('\n' + '═'.repeat(58));
  console.log('SUMMARY');
  console.log('═'.repeat(58));
  console.log(`  Enriched:  ${enriched}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Time:      ${elapsed} min`);
  console.log(`  State:     ${STATE_PATH}`);
  if (flags.dryRun) console.log('\n🧪 Dry run — remove --dry-run to write for real.');
  console.log();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
