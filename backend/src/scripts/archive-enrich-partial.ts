"use strict";

/**
 * archive-enrich.ts — Property metadata enrichment pipeline
 *
 * 3-step process:
 *   1. OM PDF -> AI extraction via parse-om endpoint
 *   2. Get address from OM result or file names
 *   Missing fields remain unknown; rent enrichment uses the local Apartment Locator provider.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --dry-run
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --property "Alta Dairies"
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --resume
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ARCHIVE_ROOT = 'C:\\Users\\Leon\\OneDrive - Myers Apartment Group\\Deals\\Archive';
const CATALOG_PATH = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG.csv');
const STATE_PATH = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_ENRICH_STATE.json');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG_ENRICHED.csv');
const REAPER = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive';
const SECRET = 'jedire-archive-2026';

const ALL_FIELDS = [
  'address','city','state','zip','county','msa','submarket',
  'year_built','year_renovated','building_class','stories','construction_type',
  'property_type','unit_count','avg_unit_sqft','net_rentable_sqft',
  'parking_type','parking_ratio','lot_size_acres','management_company'
];

const CATALOG_COLS = [
  'ParcelId','Address','City','State','ZIP','County','MSA','Submarket',
  'YearBuilt','YearRenovated','AssetClass','Stories','ConstructionType',
  'PropertyType','UnitCount','AvgUnitSqft','NetRentableSqft','ParkingType',
  'ParkingRatio','LotSizeAcres','ManagementCompany','Notes','DataConfidence','SourceFiles'
];

const FIELD_TO_COL: Record<string,string> = {
  address:'Address', city:'City', state:'State', zip:'ZIP',
  msa:'MSA', year_built:'YearBuilt', year_renovated:'YearRenovated',
  building_class:'AssetClass', stories:'Stories', construction_type:'ConstructionType',
  property_type:'PropertyType', unit_count:'UnitCount',
  avg_unit_sqft:'AvgUnitSqft', net_rentable_sqft:'NetRentableSqft',
  parking_type:'ParkingType', parking_ratio:'ParkingRatio',
  lot_size_acres:'LotSizeAcres', management_company:'ManagementCompany',
};

// Helpers
function getMsa(p: string) { return KNOWN_MSA[p]?.msa || ''; }
function getCity(p: string) { return KNOWN_MSA[p]?.city || ''; }
function getState(p: string) { return KNOWN_MSA[p]?.state || ''; }
function parseCSVLine(line: string): string[] {
  const r: string[] = []; let c = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { r.push(c.trim()); c = ''; continue; }
    c += ch;
  }
  r.push(c.trim()); return r;
}

const KNOWN_MSA: Record<string,{msa:string;state:string;city:string}> = {};
const YB: Record<string,string> = {};

// ---- Core functions ----

function findOmPdf(pid: string): string|null {
  const dp = path.join(ARCHIVE_ROOT, pid);
  if (!fs.existsSync(dp)) return null;
  const files = fs.readdirSync(dp);
  const om = files.find(f => /om|offering\s*memo/i.test(f) && f.endsWith('.pdf'));
  if (om) return path.join(dp, om);
  const pdfs = files.filter(f => f.endsWith('.pdf') && !/(rent\s*roll|t12|box.score|tax)/i.test(f));
  return pdfs.length ? path.join(dp, pdfs[0]) : null;
}

async function doOm(pid: string): Promise<Record<string,string>> {
  const pdf = findOmPdf(pid);
  if (!pdf) return {};
  console.log(`  [OM] Sending: ${path.basename(pdf)}`);
  try {
    const cmd = `curl.exe -s "${REAPER}/parse-om?parcel_id=${encodeURIComponent(pid)}&observation_date=2025-01-01" -H "x-ingest-secret: ${SECRET}" -F "file=@${pdf}" --connect-timeout 30 --max-time 180 2>&1`;
    const buf = execSync(cmd, { timeout:190000, encoding:'buffer', maxBuffer:10*1024*1024, stdio:['pipe','pipe','pipe'] });
    const txt = buf.toString('utf8').trim();
    if (!txt) return {};
    const r = JSON.parse(txt);
    if (r.success === false) return {};
    const f: Record<string,string> = {};
    for (const k of ALL_FIELDS) if (r[k] != null && r[k] !== '') f[k] = String(r[k]);
    console.log(`  [OM] Got ${Object.keys(f).length}: ${Object.keys(f).join(', ')}`);
    return f;
  } catch (e: any) {
    console.log(`  [OM] Failed: ${(e.message||'').slice(0,80)}`); return {};
  }
}

function extractAddrFromFiles(pid: string): string|null {
  const dp = path.join(ARCHIVE_ROOT, pid);
  if (!fs.existsSync(dp)) return null;
  for (const f of fs.readdirSync(dp)) {
    const n = path.basename(f, path.extname(f));
    const m = n.match(/(\d{2,5})\s+([A-Za-z].{4,50})/);
    if (m) { const c = `${m[1]} ${m[2]}`; if (c.length > 8 && !/^\d{4}$/.test(c)) return c; }
  }
  return null;
}


function loadState(): any {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch { return { version:1, updated:new Date().toISOString(), properties:{} }; }
}

function saveState(s: any) {
  s.updated = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  const singleI = args.indexOf('--property');
  const singleP = singleI >= 0 ? args[singleI + 1] : null;

  const state = loadState();
  const props = fs.readdirSync(ARCHIVE_ROOT)
    .filter(d => fs.statSync(path.join(ARCHIVE_ROOT, d)).isDirectory() && !d.startsWith('_') && !d.startsWith('.'))
    .sort();

  const target = singleP ? (props.includes(singleP) ? [singleP] : (console.error(`Not found: ${singleP}`), process.exit(1))) : props;
  console.log(`Enriching ${target.length}/${props.length} props${dryRun?' DRY':''}`);

  const enriched: Record<string,Record<string,string>> = {};

  for (let i = 0; i < target.length; i++) {
    const pid = target[i];
    const prev = state.properties[pid] || {};
    if (prev.done && resume && !singleP) { console.log(`[${i+1}/${target.length}] ${pid} skipped`); continue; }

    console.log(`\n[${i+1}/${target.length}] ${pid}`);
    const f: Record<string,string> = {};
    if (getMsa(pid)) { f.msa = getMsa(pid); f.city = getCity(pid); f.state = getState(pid); }
    if (YB[pid]) f.year_built = YB[pid];

    // OM
    if (fs.existsSync(path.join(ARCHIVE_ROOT, pid))) {
      const omf = await doOm(pid);
      for (const [k,v] of Object.entries(omf)) if (!f[k]) f[k] = v;
    }

    // Address from files
    if (!f.address) { const a = extractAddrFromFiles(pid); if (a) f.address = a; }

    // Do not scrape listing sites to fill unknown facts.

    enriched[pid] = f;
    console.log(`  Outcome: ${Object.keys(f).length} fields`);

    state.properties[pid] = { parcelId:pid, done:Object.keys(f).length>1, note:`${Object.keys(f).length}` };
    if ((i+1) % 5 === 0 || singleP) saveState(state);
  }

  // Write enriched catalog
  if (!dryRun) {
    const header = CATALOG_COLS.join(',');
    const rows = props.map(pid => {
      const f = enriched[pid] || {};
      const rec: Record<string,string> = {};
      for (const col of CATALOG_COLS) rec[col] = '';
      rec.ParcelId = pid;
      // Map enriched fields back to catalog columns
      for (const [k,v] of Object.entries(f)) {
        const col = FIELD_TO_COL[k as keyof typeof FIELD_TO_COL];
        if (col) rec[col] = v;
      }
      if (!rec.MSA) rec.MSA = getMsa(pid);
      if (!rec.City) rec.City = getCity(pid);
      if (!rec.State) rec.State = getState(pid);
      if (!rec.YearBuilt) rec.YearBuilt = YB[pid] || '';

      // Compute confidence
      const core = ['City','State','MSA','YearBuilt','AssetClass','Stories','PropertyType','UnitCount'];
      const filled = core.filter(c => rec[c]).length;
      rec.DataConfidence = filled >= 6 ? 'high' : filled >= 3 ? 'medium' : filled >= 1 ? 'low' : 'none';
      return parseCSVLine(header).map((_,colIdx) => {
        const colName = CATALOG_COLS[colIdx];
        const v = (rec[colName]||'').replace(/"/g,'""');
        return v.includes(',')||v.includes('"')||v.includes('\n') ? `"${v}"` : v;
      }).join(',');
    });

    fs.writeFileSync(OUTPUT_PATH, '\ufeff' + [header, ...rows].join('\r\n'), 'utf8');
    console.log(`\nWrote ${rows.length} rows to ${OUTPUT_PATH}`);

    const withYb = rows.filter(r => r.includes(',202') || r.includes(',199') || r.includes(',200') || r.includes(',198')).length;
    const withUnits = rows.filter(r => r.split(',')[14] && r.split(',')[14].length >= 2).length;
    const withClass = rows.filter(r => /[ABC]/.test(r.split(',')[10]||'')).length;
    console.log(`YearBuilt: ${withYb} | UnitCount: ${withUnits} | Class: ${withClass} | Output: ${OUTPUT_PATH}`);
  }

  saveState(state);
}

main().catch(e => { console.error(e); process.exit(1); });
