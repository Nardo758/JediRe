/**
 * seed-enriched-to-property-descriptions.ts
 *
 * Reads the enriched CSV (ARCHIVE_PROPERTY_CATALOG_ENRICHED.csv) and generates
 * INSERT/UPSERT SQL to update property_descriptions on the Replit DB.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/seed-enriched-to-property-descriptions.ts > seed.sql
 *   # copy seed.sql to Replit
 *   psql $DATABASE_URL < seed.sql
 */

import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG_ENRICHED.csv');

if (!fs.existsSync(CSV_PATH)) {
  console.error('Enriched CSV not found at:', CSV_PATH);
  process.exit(1);
}

const csv = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csv.trim().split('\n').filter(Boolean);
const out: string[] = [];
out.push('-- Seed property_descriptions with enriched addresses from OM extraction');

let count = 0;
let hasAddress = 0;

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

function buildField(val: unknown, source: string = 'om'): string {
  if (val === null || val === undefined || val === '') return 'NULL';
  const now = new Date().toISOString();
  const obj = {
    resolved: val,
    layers: {
      [source]: { value: val, source_file_id: null, confidence: 0.7, extracted_at: now, source: source === 'om' ? 'om_extraction' : source }
    },
    resolution_rule: 'highest_confidence'
  };
  return `'${esc(JSON.stringify(obj))}'::jsonb`;
}

function buildAddr(street: string, city: string, state: string, zip: string): string {
  if (!street && !city) return 'NULL';
  const now = new Date().toISOString();
  const obj = {
    resolved: { street, city, state, zip },
    layers: {
      om: { value: { street, city, state, zip }, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' }
    },
    resolution_rule: 'highest_confidence'
  };
  return `'${esc(JSON.stringify(obj))}'::jsonb`;
}

function hasRealAddr(addr: string): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  if (a.includes('.pdf') || a.includes('.xls') || a.includes('.doc') || a.includes('.ppt')) return false;
  if (a.includes('modified') || a.includes('teaser') || a.includes('preliminary') || a.includes('financials')) return false;
  if (/^\d+$/.test(addr.trim())) return false;
  if (a.includes('through') || a.includes('budget') || a.includes('renewals') || a.includes('concessions')) return false;
  // Must have at least one letter and one number (typical street address)
  if (/[a-z]/i.test(addr) && /\d/.test(addr)) return true;
  if (addr.length > 15 && /[a-z]/i.test(addr)) return true;
  return false;
}

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  
  // Parse CSV properly handling quoted fields
  const vals: string[] = [];
  let current = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { vals.push(current); current = ''; continue; }
    current += ch;
  }
  vals.push(current);
  
  const pid = vals[0] || '';
  const addr = vals[1] || '';
  const city = vals[2] || '';
  const st = vals[3] || '';
  const zip = vals[4] || '';
  
  if (!pid) continue;
  
  const yb = vals[8] ? parseInt(vals[8], 10) || null : null;
  const uc = vals[14] ? parseInt(vals[14], 10) || null : null;
  const stories = vals[11] ? parseInt(vals[11], 10) || null : null;
  const constType = vals[12] || '';
  const propType = vals[13] || '';
  const sqft = vals[15] ? parseInt(vals[15], 10) || null : null;
  const parking = vals[17] || '';
  const lotAcres = vals[19] ? parseFloat(vals[19]) || null : null;
  const asstCls = vals[10] || '';
  const mgmt = vals[20] || '';

  const hasAddr = hasRealAddr(addr);
  if (hasAddr) hasAddress++;

  const cols: string[] = ['parcel_id', 'property_name'];
  const inserts: string[] = [`'${esc(pid)}'`, `'${esc(pid)}'`]; // property_name = parcel_id as default
  const sets: string[] = ['property_name = EXCLUDED.property_name'];

  if (hasAddr) {
    const addrCol = buildAddr(esc(addr), esc(city), esc(st), esc(zip));
    cols.push('address');
    inserts.push(addrCol);
    sets.push(`address = CASE WHEN property_descriptions.address IS NULL OR (property_descriptions.address->>'resolution_rule' IS DISTINCT FROM 'manual_override') THEN EXCLUDED.address ELSE property_descriptions.address END`);
  }
  
  if (yb) {
    const col = buildField(yb);
    cols.push('year_built'); inserts.push(col);
    sets.push('year_built = EXCLUDED.year_built');
  }
  if (uc) {
    const col = buildField(uc);
    cols.push('unit_count'); inserts.push(col);
    sets.push('unit_count = EXCLUDED.unit_count');
  }
  if (stories) {
    const col = buildField(stories);
    cols.push('stories'); inserts.push(col);
    sets.push('stories = EXCLUDED.stories');
  }
  if (sqft) {
    const col = buildField(sqft);
    cols.push('total_sqft'); inserts.push(col);
    sets.push('total_sqft = EXCLUDED.total_sqft');
  }
  if (lotAcres) {
    const col = buildField(lotAcres);
    cols.push('lot_size_acres'); inserts.push(col);
    sets.push('lot_size_acres = EXCLUDED.lot_size_acres');
  }
  if (asstCls) {
    const col = buildField(asstCls);
    cols.push('asset_class'); inserts.push(col);
    sets.push('asset_class = EXCLUDED.asset_class');
  }
  if (constType) {
    cols.push('construction_type'); inserts.push(buildField(constType));
    sets.push('construction_type = EXCLUDED.construction_type');
  }
  if (parking) {
    cols.push('parking_type'); inserts.push(buildField(parking));
    sets.push('parking_type = EXCLUDED.parking_type');
  }

  cols.push('updated_at'); inserts.push('NOW()'); sets.push('updated_at = NOW()');
  cols.push('created_at'); inserts.push('NOW()');

  const insertSql = `INSERT INTO property_descriptions (${cols.join(', ')}) VALUES (${inserts.join(', ')}) ON CONFLICT (parcel_id) DO UPDATE SET ${sets.join(', ')};`;
  out.push(insertSql);
  count++;

  if (count % 50 === 0) {
    out.push(`-- ${count}/${lines.length - 1}`);
  }
}

out.push(`-- Total: ${count} properties upserted (${hasAddress} with real street addresses)`);
const outputPath = path.resolve(__dirname, '..', 'docs', 'operations', 'seed_pd_v2.sql');
fs.writeFileSync(outputPath, out.join('\n'));
console.log(`Wrote ${count} statements to /tmp/seed_pd_v2.sql`);
console.log(`${hasAddress} properties have real-looking street addresses`);
