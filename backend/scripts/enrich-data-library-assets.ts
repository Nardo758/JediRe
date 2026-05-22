/**
 * enrich-data-library-assets.ts
 *
 * Runs DeepSeek against every data_library_assets row that is missing
 * key profile fields (address, city, state, year_built, asset_class,
 * stories, construction_type) and writes the results back.
 *
 * Usage:
 *   cd backend
 *   npx ts-node --transpile-only scripts/enrich-data-library-assets.ts
 *   npx ts-node --transpile-only scripts/enrich-data-library-assets.ts --dry-run
 *   npx ts-node --transpile-only scripts/enrich-data-library-assets.ts --limit=20
 *   npx ts-node --transpile-only scripts/enrich-data-library-assets.ts --id=<uuid>
 */

import { query } from '../src/database/connection';
import { logger } from '../src/utils/logger';

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const LIMIT      = (() => { const f = args.find(a => a.startsWith('--limit=')); return f ? parseInt(f.split('=')[1], 10) : 0; })();
const SINGLE_ID  = (() => { const f = args.find(a => a.startsWith('--id=')); return f ? f.split('=')[1] : null; })();
const CONCURRENCY = 5;
const DELAY_MS    = 200; // between batches

// ── Types ────────────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  property_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  unit_count: number | null;
  avg_rent: string | null;
  occupancy_rate: string | null;
}

interface EnrichedProfile {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  county?: string | null;
  msa_name?: string | null;
  submarket_name?: string | null;
  year_built?: number | null;
  year_renovated?: number | null;
  asset_class?: string | null;
  stories?: number | null;
  construction_type?: string | null;
  property_type?: string | null;
  parking_type?: string | null;
  parking_ratio?: number | null;
  lot_size_acres?: number | null;
  height_class?: string | null;
  unit_count?: number | null;
  net_rentable_sqft?: number | null;
  avg_unit_sqft?: number | null;
  management_company?: string | null;
  amenities?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  confidence?: number;
  source_note?: string | null;
}

// ── DeepSeek call ────────────────────────────────────────────────────────────

async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a real estate data researcher with comprehensive knowledge of US multifamily and commercial apartment communities. ' +
            'You have detailed knowledge of apartment communities across the US — their addresses, locations, year built, unit counts, building class, and physical characteristics. ' +
            'Return only valid JSON — no markdown fences, no prose before or after.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Classify the name so we can tailor the prompt ───────────────────────────

function classifyName(name: string): 'address_fragment' | 'branded_community' | 'descriptive' | 'generic' {
  // Starts with a number → likely a street address fragment (e.g. "1420 Magnolia")
  if (/^\d/.test(name.trim())) return 'address_fragment';

  // Generic portfolio / deal labels
  if (/\b(portfolio|deals?|build to rent|pack|two pack)\b/i.test(name)) return 'generic';

  // Known multifamily developer brands embedded in name
  const brands = ['bainbridge', 'broadstone', 'elan', 'alta ', 'bell ', 'ember', 'echo ',
    'enclave', 'estates', 'hawthorne', 'emblem', 'ascen', 'axiom',
    'cadence', 'artistry', 'accent', 'citizen', 'citron', 'citadel',
    'corvalla', 'encore', 'curv', 'fieldhouse', 'folksong', 'jefferson',
    'harbor', 'hardy', 'heron', 'heights', 'hudson', 'indigo', 'infield',
    'jade', 'junction', 'eden', 'edinborough', 'district ', 'exchange ',
    'eve at', 'factory at', 'ferry pike', 'florida crystal', 'franklin',
    'gateway', 'elevate', 'element ', 'enclave', 'encore', 'cornerstone',
    'cottage', 'creekside', 'crescent', 'crest ', 'crestmont', 'coddle',
    'ansley', 'arden ', 'ardmore', 'avril'];
  if (brands.some(b => name.toLowerCase().includes(b))) return 'branded_community';

  // Has a location hint embedded ("at X", "of X", "on X", "@ X", "- CITY")
  if (/\b(at|of|on|at the|near|@)\b/i.test(name) || / - [A-Z]{2}$/.test(name)) return 'descriptive';

  return 'branded_community'; // default: treat as a specific named community
}

// ── Research one property ────────────────────────────────────────────────────

async function researchAsset(asset: AssetRow): Promise<EnrichedProfile | null> {
  const hints: string[] = [];
  if (asset.unit_count) hints.push(`~${asset.unit_count} units`);
  if (asset.avg_rent)   hints.push(`avg rent ~$${Math.round(parseFloat(asset.avg_rent))}/mo`);

  const kind = classifyName(asset.property_name);

  if (kind === 'generic') return null; // not a real property

  let context = '';
  if (kind === 'address_fragment') {
    context = `The name "${asset.property_name}" appears to be a street address fragment for an apartment complex — for example "1420 Magnolia" likely refers to an apartment community at 1420 Magnolia Ave/Dr/Blvd/St. Search for the apartment complex located at this address.`;
  } else if (kind === 'branded_community') {
    // Extract potential location from the name
    const locationHints = asset.property_name.match(/(?:at|at the|on|near|@)\s+(.+)/i)?.[1] ||
      asset.property_name.split(/\s+/).slice(-2).join(' ');
    context = `"${asset.property_name}" is a specific US apartment community. This may be a developer-branded community (e.g. Bainbridge, Alta, Bell, Elan, Broadstone, etc.) with the location embedded in the name. The location clue in the name may be "${locationHints}". Search for this specific apartment community by its full name.`;
  } else {
    context = `"${asset.property_name}" is a US apartment community. The name includes a location or descriptor clue — use it to narrow the search.`;
  }

  const hintStr = hints.length ? `\n\nAdditional hints: ${hints.join(', ')}` : '';

  const prompt = `You are researching a specific US multifamily apartment community.

${context}${hintStr}

Using your knowledge of US real estate properties, apartment communities, and addresses, look up this property and return what you know. Even partial information is useful — provide what you can with confidence and null for the rest. Do NOT fabricate data.

Return this exact JSON (no markdown fences, no extra keys):
{
  "address": null,
  "city": null,
  "state": null,
  "zip_code": null,
  "county": null,
  "msa_name": null,
  "submarket_name": null,
  "year_built": null,
  "year_renovated": null,
  "asset_class": "A|B|C|D or null",
  "stories": null,
  "construction_type": "Wood Frame|Concrete|Steel Frame|Masonry|Mixed or null",
  "property_type": "garden|mid-rise|high-rise|townhome|mixed-use or null",
  "parking_type": "surface|garage|covered|mixed or null",
  "parking_ratio": null,
  "lot_size_acres": null,
  "unit_count": null,
  "net_rentable_sqft": null,
  "avg_unit_sqft": null,
  "management_company": null,
  "amenities": [],
  "latitude": null,
  "longitude": null,
  "confidence": 0.0,
  "source_note": "brief note on how you identified the property, or null"
}`;

  try {
    const text = await callDeepSeek(prompt);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.warn(`[enrich] no JSON in response for "${asset.property_name}"`);
      return null;
    }
    return JSON.parse(match[0]) as EnrichedProfile;
  } catch (err) {
    logger.warn(`[enrich] failed for "${asset.property_name}": ${String(err)}`);
    return null;
  }
}

// ── Normalize helpers ────────────────────────────────────────────────────────

function normalizeClass(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/([A-D][+-]?)/i);
  return m ? m[1].toUpperCase() : null;
}

function safeStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isFinite(n) ? n : null;
}

function safeInt(v: unknown): number | null {
  const n = safeNum(v);
  return n != null ? Math.round(n) : null;
}

// ── Write to DB ──────────────────────────────────────────────────────────────

async function persistProfile(id: string, p: EnrichedProfile, asset: AssetRow): Promise<void> {
  // Build update only for NULL columns — never overwrite existing data
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  const maybeSet = (col: string, val: unknown) => {
    if (val == null) return;
    sets.push(`${col} = COALESCE(${col}, $${idx++})`);
    vals.push(val);
  };

  maybeSet('address',          safeStr(p.address));
  maybeSet('city',             safeStr(p.city));
  maybeSet('state',            safeStr(p.state));
  maybeSet('zip_code',         safeStr(p.zip_code));
  maybeSet('county',           safeStr(p.county));
  maybeSet('msa_name',         safeStr(p.msa_name));
  maybeSet('submarket_name',   safeStr(p.submarket_name));
  maybeSet('year_built',       safeInt(p.year_built));
  maybeSet('year_renovated',   safeInt(p.year_renovated));
  maybeSet('asset_class',      normalizeClass(p.asset_class));
  maybeSet('stories',          safeInt(p.stories));
  maybeSet('construction_type',safeStr(p.construction_type));
  maybeSet('property_type',    safeStr(p.property_type));
  // height_class is a generated column — skip it
  maybeSet('parking_type',     safeStr(p.parking_type));
  maybeSet('parking_ratio',    safeNum(p.parking_ratio));
  maybeSet('lot_size_acres',   safeNum(p.lot_size_acres));
  maybeSet('net_rentable_sqft',safeInt(p.net_rentable_sqft));
  maybeSet('avg_unit_sqft',    safeInt(p.avg_unit_sqft));
  maybeSet('management_company',safeStr(p.management_company));
  maybeSet('latitude',         safeNum(p.latitude));
  maybeSet('longitude',        safeNum(p.longitude));

  // Only set unit_count if currently null (never decrease)
  if (asset.unit_count == null && safeInt(p.unit_count) != null) {
    maybeSet('unit_count', safeInt(p.unit_count));
  }

  // Amenities as JSONB
  if (p.amenities && p.amenities.length > 0) {
    sets.push(`amenities = COALESCE(amenities, $${idx++}::jsonb)`);
    vals.push(JSON.stringify(p.amenities));
  }

  if (sets.length === 0) return;

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  await query(
    `UPDATE data_library_assets SET ${sets.join(', ')} WHERE id = $${idx}`,
    vals,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Data Library Asset Enrichment ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log('');

  // Load assets that need enrichment
  // Only target assets that have never been touched by enrichment:
  // all of city, year_built, asset_class must still be NULL.
  // Partial rows (city filled but missing year_built) are expected —
  // DeepSeek didn't know them the first time and won't the second.
  let whereClause = `
    WHERE property_name IS NOT NULL
      AND property_name != ''
      AND city IS NULL
      AND year_built IS NULL
      AND asset_class IS NULL`;

  if (SINGLE_ID) {
    whereClause = `WHERE id = '${SINGLE_ID}'`;
  }

  const limitClause = LIMIT ? `LIMIT ${LIMIT}` : '';

  const res = await query<AssetRow>(
    `SELECT id, property_name, address, city, state, zip_code, unit_count, avg_rent, occupancy_rate
     FROM data_library_assets
     ${whereClause}
     ORDER BY property_name
     ${limitClause}`,
  );

  const assets = res.rows;
  console.log(`Found ${assets.length} assets to enrich`);

  if (assets.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  let completed = 0;
  let populated = 0;
  let skipped   = 0;
  let failed    = 0;

  // Process in batches
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (asset) => {
      process.stdout.write(`  [${completed + 1}/${assets.length}] ${asset.property_name.padEnd(40)} ... `);

      try {
        const profile = await researchAsset(asset);

        if (!profile) {
          process.stdout.write('no data\n');
          skipped++;
          completed++;
          return;
        }

        const confidence = safeNum(profile.confidence) ?? 0;
        const hasData = [
          profile.city, profile.state, profile.address,
          profile.year_built, profile.asset_class,
        ].some(v => v != null);

        if (!hasData) {
          process.stdout.write(`low confidence (${confidence.toFixed(2)})\n`);
          skipped++;
          completed++;
          return;
        }

        if (!DRY_RUN) {
          await persistProfile(asset.id, profile, asset);
        }

        const summary = [
          profile.city && profile.state ? `${profile.city}, ${profile.state}` : null,
          profile.year_built ? `built ${profile.year_built}` : null,
          profile.asset_class ? `Class ${profile.asset_class}` : null,
          profile.stories ? `${profile.stories}s` : null,
        ].filter(Boolean).join(' | ');

        process.stdout.write(`✓ ${summary || 'saved'} (conf=${confidence.toFixed(2)})\n`);
        populated++;
        completed++;
      } catch (err) {
        process.stdout.write(`ERROR: ${String(err).slice(0, 60)}\n`);
        failed++;
        completed++;
      }
    }));

    // Brief pause between batches
    if (i + CONCURRENCY < assets.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Total:     ${assets.length}`);
  console.log(`Populated: ${populated}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  if (DRY_RUN) console.log(`(dry run — no changes written)`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
