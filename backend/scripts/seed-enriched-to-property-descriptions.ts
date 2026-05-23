/**
 * Generate clean UPSERT SQL for property_descriptions.
 * Writes JSONB as literal JSON-like strings that pg understands,
 * wrapping in $$ dollar-quoting to avoid quote-escaping hell.
 */
import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG_ENRICHED.csv');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'seed_pd_v3.sql');

if (!fs.existsSync(CSV_PATH)) {
  console.error('Enriched CSV not found at:', CSV_PATH);
  process.exit(1);
}

const csv = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csv.trim().split('\n').filter(Boolean);

function esc(v: string): string {
  return v.replace(/'/g, "''");
}

function escJs(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hasRealAddr(addr: string): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  if (a.includes('.pdf') || a.includes('.xls') || a.includes('.doc') || a.includes('.ppt')) return false;
  if (a.includes('modified') || a.includes('teaser') || a.includes('preliminary') || a.includes('financials')) return false;
  if (/^\d+$/.test(addr.trim())) return false;
  if (a.includes('through') || a.includes('budget') || a.includes('renewals') || a.includes('concessions')) return false;
  if (a.includes('t12') || a.includes('rent roll') || a.includes('operating')) return false;
  if (/[a-z]/i.test(addr) && /\d/.test(addr)) return true;
  if (addr.length > 15 && /[a-z]/i.test(addr)) return true;
  return false;
}

const now = new Date().toISOString();
const out: string[] = [];
out.push('-- Seed property_descriptions v3 with real addresses from OM extraction');
out.push('-- Generated: ' + now);

let count = 0;
let hasAddress = 0;

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

  const realAddrFlag = hasRealAddr(addr);
  if (realAddrFlag) hasAddress++;

  // Build UPSERT
  const sets: string[] = [];
  const inserts: string[] = [];

  // COL 1: parcel_id
  inserts.push(`'${esc(pid)}'`); // parcel_id

  // COL 2: property_name
  inserts.push(`'${esc(pid)}'`); // property_name
  sets.push(`property_name = '${esc(pid)}'`);

  // COL 3: address
  if (realAddrFlag) {
    const addrJson = JSON.stringify({
      resolved: { street: addr, city, state: st, zip },
      layers: {
        om: { value: { street: addr, city, state: st, zip }, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' }
      },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(addrJson)}'::jsonb`);
    sets.push(`address = CASE WHEN property_descriptions.address IS NULL OR (property_descriptions.address->>'resolution_rule' IS DISTINCT FROM 'manual_override') THEN '${esc(addrJson)}'::jsonb ELSE property_descriptions.address END`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 4: year_built
  if (yb) {
    const ybJson = JSON.stringify({
      resolved: yb,
      layers: { om: { value: yb, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(ybJson)}'::jsonb`);
    sets.push(`year_built = '${esc(ybJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 5: unit_count
  if (uc) {
    const ucJson = JSON.stringify({
      resolved: uc,
      layers: { om: { value: uc, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(ucJson)}'::jsonb`);
    sets.push(`unit_count = '${esc(ucJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 6: stories
  if (stories) {
    const stJson = JSON.stringify({
      resolved: stories,
      layers: { om: { value: stories, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(stJson)}'::jsonb`);
    sets.push(`stories = '${esc(stJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 7: total_sqft
  if (sqft) {
    const sqftJson = JSON.stringify({
      resolved: sqft,
      layers: { om: { value: sqft, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(sqftJson)}'::jsonb`);
    sets.push(`total_sqft = '${esc(sqftJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 8: lot_size_acres
  if (lotAcres) {
    const lotJson = JSON.stringify({
      resolved: lotAcres,
      layers: { om: { value: lotAcres, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(lotJson)}'::jsonb`);
    sets.push(`lot_size_acres = '${esc(lotJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 9: asset_class
  if (asstCls) {
    const clsJson = JSON.stringify({
      resolved: asstCls,
      layers: { om: { value: asstCls, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(clsJson)}'::jsonb`);
    sets.push(`asset_class = '${esc(clsJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 10: construction_type
  if (constType) {
    const ctJson = JSON.stringify({
      resolved: constType,
      layers: { om: { value: constType, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(ctJson)}'::jsonb`);
    sets.push(`construction_type = '${esc(ctJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 11: parking_type
  if (parking) {
    const pkJson = JSON.stringify({
      resolved: parking,
      layers: { om: { value: parking, source_file_id: null, confidence: 0.7, extracted_at: now, source: 'om_extraction' } },
      resolution_rule: 'highest_confidence'
    });
    inserts.push(`'${esc(pkJson)}'::jsonb`);
    sets.push(`parking_type = '${esc(pkJson)}'::jsonb`);
  } else {
    inserts.push('DEFAULT');
  }

  // COL 12: updated_at
  inserts.push('NOW()');
  sets.push('updated_at = NOW()');

  // COL 13: created_at
  inserts.push('NOW()');

  const cols = ['parcel_id', 'property_name', 'address', 'year_built', 'unit_count', 'stories', 'total_sqft', 'lot_size_acres', 'asset_class', 'construction_type', 'parking_type', 'updated_at', 'created_at'];
  const sql = `INSERT INTO property_descriptions (${cols.join(', ')}) VALUES (${inserts.join(', ')}) ON CONFLICT (parcel_id) DO UPDATE SET ${sets.join(', ')};`;
  out.push(sql);
  count++;
}

out.push('');
out.push(`-- Total: ${count} properties upserted (${hasAddress} with real street addresses)`);

fs.writeFileSync(OUTPUT_PATH, out.join('\n'));
console.log(`Wrote ${count} statements to ${OUTPUT_PATH}`);
console.log(`${hasAddress} properties have real-looking street addresses`);
console.log('');
console.log('Run on Replit:');
console.log(`  psql $DATABASE_URL < docs/operations/seed_pd_v3.sql`);
