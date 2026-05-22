/**
 * archive-municipal-enrich.ts
 *
 * Phase 7 — Municipal API Enrichment Runner
 *
 * Reads archive properties from property_descriptions, looks up each
 * property's address in county GIS/Property Appraiser ArcGIS endpoints,
 * and writes the results back to property_descriptions with
 * LayeredValue<municipal> provenance.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich.ts
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich.ts --resume
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich.ts --dry-run
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich.ts --parcel "mirabella_lakes"
 *   npx ts-node --transpile-only scripts/archive-municipal-enrich.ts --limit 20
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPropertyInfoRegistry } from '../src/services/property-enrichment/property-info/provider-registry';
import { getPool } from '../src/database/connection';
import { PropertyInfo } from '../src/services/property-enrichment/types';

// ─── State persistence ──────────────────────────────────────────────────────

interface EnrichState {
  startedAt: string;
  completedAt: string | null;
  totalProperties: number;
  enriched: number;
  errors: number;
  skippedNoAddress: number;
  perProperty: Record<string, {
    status: 'done' | 'error' | 'skipped';
    apiEndpoint?: string;
    fieldsFilled: string[];
    error?: string;
  }>;
}

const STATE_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'ARCHIVE_MUNICIPAL_STATE.json');

function loadState(): EnrichState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalProperties: 0,
    enriched: 0,
    errors: 0,
    skippedNoAddress: 0,
    perProperty: {},
  };
}

function saveState(state: EnrichState): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

// ─── CLI flags ──────────────────────────────────────────────────────────────

const flags = {
  resume: process.argv.includes('--resume'),
  dryRun: process.argv.includes('--dry-run'),
  parcel: (() => {
    const idx = process.argv.indexOf('--parcel');
    return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
  })(),
  limit: (() => {
    const idx = process.argv.indexOf('--limit');
    return idx >= 0 && idx + 1 < process.argv.length ? parseInt(process.argv[idx + 1], 10) : 9999;
  })(),
};

// ─── DB helpers ─────────────────────────────────────────────────────────────

interface JsonbLayers {
  layers?: { municipal?: Record<string, unknown> };
  resolution_rule?: string;
}

interface ArchiveProperty {
  parcel_id: string;
  property_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  year_built_jsonb: JsonbLayers | null;
  unit_count_jsonb: JsonbLayers | null;
  stories_jsonb: JsonbLayers | null;
}

async function fetchProperties(): Promise<ArchiveProperty[]> {
  const pool = getPool();
  const r = await pool.query(`
    SELECT 
      pd.parcel_id,
      pd.property_name,
      pd.address->>'resolved' as address,
      pd.address->'layers'->>'municipal' as address_municipal,
      pd.msa as msa_jsonb,
      pd.year_built as year_built_jsonb,
      pd.unit_count as unit_count_jsonb,
      pd.stories as stories_jsonb,
      pd.county as county_jsonb
    FROM property_descriptions pd
    ORDER BY pd.parcel_id
  `);
  
  return r.rows.map((row: Record<string, unknown>) => {
    // Extract address from property_descriptions
    // The resolved field can be either a flat string ("123 Main St, Atlanta, GA")
    // or a JSON string ("{"street":"123 Main St","city":"Atlanta","state":"GA"}")
    let address: string | null = null;
    let city: string | null = null;
    let state: string | null = null;
    let zip: string | null = null;
    
    const addrRaw = row.address;
    if (addrRaw && typeof addrRaw === 'object') {
      const addrObj = addrRaw as Record<string, unknown>;
      const resolved = addrObj['resolved'];
      
      if (resolved) {
        if (typeof resolved === 'object') {
          // Already parsed JSON object {street, city, state, zip}
          const r = resolved as Record<string, string>;
          address = r['street'] || r['address'] || null;
          city = r['city'] || null;
          state = r['state'] || null;
          zip = r['zip'] || r['zip_code'] || null;
        } else if (typeof resolved === 'string') {
          // Try parsing as JSON
          try {
            const parsed = JSON.parse(resolved);
            if (typeof parsed === 'object') {
              address = parsed.street || parsed.address || null;
              city = parsed.city || null;
              state = parsed.state || null;
              zip = parsed.zip || null;
            } else {
              address = resolved;
            }
          } catch {
            // Flat string — use as-is
            address = resolved;
          }
        }
      }
    }

    return {
      parcel_id: row.parcel_id as string,
      property_name: typeof row.property_name === 'string' ? row.property_name : null,
      address,
      city,
      state,
      zip,
      county: null,
      year_built_jsonb: row.year_built_jsonb as JsonbLayers | null,
      unit_count_jsonb: row.unit_count_jsonb as JsonbLayers | null,
      stories_jsonb: row.stories_jsonb as JsonbLayers | null,
    };
  });
}

async function updatePropertyDescription(
  parcelId: string,
  enriched: PropertyInfo,
  apiEndpoint: string
): Promise<void> {
  const pool = getPool();
  const now = new Date().toISOString();

  // Build LayeredValue JSON for each field
  const buildLayer = (value: unknown, source: string) => {
    if (value === null || value === undefined) return null;
    return JSON.stringify({
      resolved: value,
      layers: {
        municipal: {
          value,
          source,
          fetched_at: now,
          api_endpoint: apiEndpoint,
        },
      },
      resolution_rule: 'municipal_canonical',
    });
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const pushSet = (col: string, val: unknown) => {
    if (val === null || val === undefined) return;
    sets.push(`${col} = $${paramIdx++}`);
    values.push(val);
  };

  pushSet('year_built', buildLayer(enriched.yearBuilt, enriched.provider));
  pushSet('unit_count', buildLayer(enriched.numberOfUnits, enriched.provider));
  pushSet('stories', buildLayer(enriched.stories, enriched.provider));
  pushSet('total_sqft', buildLayer(enriched.livingAreaSqFt, enriched.provider));
  pushSet('lot_size_acres', buildLayer(enriched.acres, enriched.provider));
  pushSet('zoning_code', buildLayer(enriched.zoning, enriched.provider));

  if (enriched.address) {
    const addrVal = {
      resolved: {
        street: enriched.address,
        city: enriched.city,
        state: enriched.state,
        zip: enriched.zip,
      },
      layers: {
        municipal: {
          value: {
            street: enriched.address,
            city: enriched.city,
            state: enriched.state,
            zip: enriched.zip,
          },
          source: enriched.provider,
          fetched_at: now,
          api_endpoint: apiEndpoint,
        },
      },
      resolution_rule: 'municipal_canonical',
    };
    sets.push(`address = $${paramIdx++}`);
    values.push(JSON.stringify(addrVal));
  }

  if (sets.length === 0) {
    console.log(`  └─ No municipal data to write for ${parcelId}`);
    return;
  }

  sets.push(`updated_at = NOW()`);
  
  // COALESCE: only set if column is null or existing layer is not manual override
  // Use COALESCE + jsonb concatenation for merge semantics
  // This preserves existing layers that aren't being replaced
  const mergeSql = `
    UPDATE property_descriptions 
    SET 
      ${sets.map((set, i) => {
        const [col] = set.split(' = ');
        // Only update if existing has no manual override
        return `${col} = CASE 
          WHEN ${col} IS NULL OR (${col}->>'resolution_rule' != 'manual_override' OR ${col}->>'resolution_rule' IS NULL) 
          THEN ${set.split(' = ')[1]} 
          ELSE ${col} 
        END`;
      }).join(',\n      ')}
    WHERE parcel_id = $${paramIdx}
  `;

  values.push(parcelId);
  
  try {
    await pool.query(mergeSql, values);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  └─ DB ERROR for ${parcelId}: ${msg}`);
    throw err;
  }
}

// ─── Main enrichment logic ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Phase 7 — Archive Municipal API Enrichment          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  if (flags.dryRun) console.log('🧪 DRY RUN — no data will be written');
  if (flags.resume) console.log('↻ Resume mode — skipping already-enriched properties');
  if (flags.parcel) console.log(`→ Filtering to parcel: ${flags.parcel}`);
  if (flags.limit < 9999) console.log(`→ Limit: ${flags.limit} properties`);

  const state = loadState();
  const registry = getPropertyInfoRegistry();
  
  // Check health of all providers first
  const healthResults = await registry.healthCheck();
  const healthyCount = Array.from(healthResults.values()).filter(Boolean).length;
  console.log(`\n📍 County API Coverage:`);
  const stats = registry.getCoverageStats();
  for (const [state, count] of Object.entries(stats.byState)) {
    console.log(`   ${state}: ${count} county(s)`);
  }
  console.log(`   Total: ${stats.totalProviders} providers (${healthyCount} healthy)`);
  console.log();

  // Fetch properties
  const props = await fetchProperties();
  state.totalProperties = props.length;

  if (flags.parcel) {
    const filtered = props.filter(p => p.parcel_id.toLowerCase().includes(flags.parcel!.toLowerCase()));
    if (filtered.length === 0) {
      console.log(`❌ No properties matching "${flags.parcel}"`);
      process.exit(1);
    }
    props.length = 0;
    props.push(...filtered);
  }

  console.log(`📋 Loaded ${props.length} properties from property_descriptions`);
  
  if (flags.limit < props.length) {
    props.length = flags.limit;
    console.log(`   (limited to ${flags.limit})`);
  }

  // Stats tracking
  let enriched = 0;
  let errors = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const pct = ((i + 1) / props.length * 100).toFixed(1);
    console.log(`\n[${i + 1}/${props.length} ${pct}%] ${prop.parcel_id}`);

    // Resume: skip if already done
    if (flags.resume && state.perProperty[prop.parcel_id]?.status === 'done') {
      console.log(`  └─ Already enriched (${state.perProperty[prop.parcel_id].fieldsFilled?.length || 0} fields)`);
      enriched++;
      continue;
    }

    // Check if we have a resolvable address or at least city/state
    const address = prop.address;
    const city = prop.city || '';
    const stateCode = prop.state || '';
    
    if (!stateCode || stateCode.length !== 2) {
      console.log(`  ⚠ No state code available — skipping. Try archive-enrich.ts --resume to populate addresses from OM PDFs first.`);
      state.perProperty[prop.parcel_id] = { status: 'skipped', fieldsFilled: [], error: 'no_state' };
      skipped++;
      saveState(state);
      continue;
    }

    if (!address || !city) {
      console.log(`  ⚠ Address/city not resolved. State: ${stateCode}. Try archive-enrich.ts --resume first.`);
      state.perProperty[prop.parcel_id] = { status: 'skipped', fieldsFilled: [], error: 'no_address' };
      skipped++;
      saveState(state);
      continue;
    }
    
    const zip = prop.zip || undefined;
    const county = prop.county || undefined;

    // Skip properties that already have municipal data populated for all desired fields
    const hasMunicipalYearBuilt = prop.year_built_jsonb?.layers?.municipal !== undefined;
    const hasMunicipalUnits = prop.unit_count_jsonb?.layers?.municipal !== undefined;
    const hasMunicipalStories = prop.stories_jsonb?.layers?.municipal !== undefined;
    if (hasMunicipalYearBuilt && hasMunicipalUnits && flags.resume) {
      console.log(`  └─ Already has municipal layers for year_built + unit_count — skipping`);
      enriched++;
      continue;
    }

    try {
      // Geocode to get county if we don't have it
      // The registry automatically picks the right provider by state+county
      const { info, provider } = await registry.fetchPropertyInfo(
        address, city, stateCode, zip, undefined, undefined
      );

      if (!info) {
        console.log(`  ⚠ No municipal data found for this address`);
        state.perProperty[prop.parcel_id] = { status: 'skipped', fieldsFilled: [], error: 'no_municipal_data' };
        skipped++;
        saveState(state);
        continue;
      }

      console.log(`  ✓ ${provider}`);
      console.log(`    Parcel: ${info.parcelId} | ${info.address}`);
      console.log(`    Year built: ${info.yearBuilt || '—'} | Units: ${info.numberOfUnits || '—'} | Stories: ${info.stories || '—'}`);
      console.log(`    Sqft: ${info.livingAreaSqFt || '—'} | Zoning: ${info.zoning || '—'}`);

      const fieldsFilled: string[] = [];
      if (info.yearBuilt) fieldsFilled.push('year_built');
      if (info.numberOfUnits) fieldsFilled.push('unit_count');
      if (info.stories) fieldsFilled.push('stories');
      if (info.livingAreaSqFt) fieldsFilled.push('total_sqft');
      if (info.acres) fieldsFilled.push('lot_size_acres');
      if (info.zoning) fieldsFilled.push('zoning_code');
      if (info.address) fieldsFilled.push('address');

      if (flags.dryRun) {
        console.log(`  🧪 Dry run — would write ${fieldsFilled.length} fields`);
      } else {
        // Build the API endpoint URL from the provider
        const apiEndpoint = `arcgis://${provider}`;
        await updatePropertyDescription(prop.parcel_id, info, apiEndpoint);
        console.log(`  ✓ Wrote ${fieldsFilled.length} fields to property_descriptions`);
      }

      state.perProperty[prop.parcel_id] = {
        status: 'done',
        apiEndpoint: provider || undefined,
        fieldsFilled,
      };
      enriched++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error: ${msg}`);
      state.perProperty[prop.parcel_id] = { status: 'error', fieldsFilled: [], error: msg };
      errors++;
    }

    saveState(state);

    // Rate limit — 500ms between requests to be polite
    if (i < props.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  state.completedAt = new Date().toISOString();
  saveState(state);

  console.log('\n' + '═'.repeat(55));
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('═'.repeat(55));
  console.log(`   Total properties: ${props.length}`);
  console.log(`   Enriched:         ${enriched}`);
  console.log(`   Skipped:          ${skipped}`);
  console.log(`   Errors:           ${errors}`);
  console.log(`   Time:             ${elapsed} minutes`);
  console.log();
  
  if (flags.dryRun) {
    console.log('🧪 Dry run completed — no data written.');
    console.log('   Remove --dry-run to run for real.');
  }
  
  console.log(`   State saved to: ${STATE_PATH}`);
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
