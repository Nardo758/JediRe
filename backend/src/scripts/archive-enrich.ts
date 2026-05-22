/**
 * archive-enrich.ts — Property metadata enrichment pipeline
 *  1. OM PDF -> AI extraction via parse-om endpoint
 *  2. Address from file names
 *  3. apartments.com search for missing fields
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --dry-run
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --property "Alta Dairies"
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --resume
 *   npx ts-node --transpile-only src/scripts/archive-enrich.ts --skip-om
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

const FIELD_MAP: Record<string,string> = {
  address:'Address', city:'City', state:'State', zip:'ZIP',
  msa:'MSA', year_built:'YearBuilt', year_renovated:'YearRenovated',
  building_class:'AssetClass', stories:'Stories', construction_type:'ConstructionType',
  property_type:'PropertyType', unit_count:'UnitCount',
  avg_unit_sqft:'AvgUnitSqft', net_rentable_sqft:'NetRentableSqft',
  parking_type:'ParkingType', parking_ratio:'ParkingRatio',
  lot_size_acres:'LotSizeAcres', management_company:'ManagementCompany',
};

function parseCSVLine(line: string): string[] {
  const r: string[] = []; let c = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { r.push(c.trim()); c = ''; continue; }
    c += ch;
  }
  r.push(c.trim()); return r;
}

// ---- Load existing catalog for known MSA/city/state + year built ----

function loadSeed(): Record<string,Record<string,string>> {
  const seed: Record<string,Record<string,string>> = {};
  if (fs.existsSync(CATALOG_PATH)) {
    const lines = fs.readFileSync(CATALOG_PATH, 'utf8').split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 1) {
      const headers = parseCSVLine(lines[0]);
      for (const line of lines.slice(1)) {
        const vals = parseCSVLine(line);
        const rec: Record<string,string> = {};
        headers.forEach((h,i) => rec[h] = vals[i] || '');
        const pid = rec['ParcelId'];
        if (pid) seed[pid] = rec;
      }
    }
  }
  return seed;
}

// ---- Step 1: OM PDF -> AI extraction ----

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
  console.log('  [OM] ' + path.basename(pdf));
  try {
    const cmd = 'curl.exe -s "' + REAPER + '/parse-om?parcel_id='
      + encodeURIComponent(pid) + '&observation_date=2025-01-01" -H "x-ingest-secret: '
      + SECRET + '" -F "file=@' + pdf + '" --connect-timeout 30 --max-time 180 2>&1';
    const buf = execSync(cmd, { timeout:190000, encoding:'buffer', maxBuffer:10*1024*1024, stdio:['pipe','pipe','pipe'] });
    const txt = buf.toString('utf8').trim();
    if (!txt) return {};
    const r = JSON.parse(txt);
    if (r.success === false) return {};
    const f: Record<string,string> = {};
    for (const k of ALL_FIELDS) if (r[k] != null && r[k] !== '') f[k] = String(r[k]);
    console.log('  [OM] ' + Object.keys(f).length + ' fields');
    return f;
  } catch (e: any) {
    console.log('  [OM] Failed: ' + (e.message||'').slice(0,80));
    return {};
  }
}

// ---- Step 2: Address from file names ----

function extractAddr(pid: string): string|null {
  const dp = path.join(ARCHIVE_ROOT, pid);
  if (!fs.existsSync(dp)) return null;
  for (const f of fs.readdirSync(dp)) {
    const n = path.basename(f, path.extname(f));
    const m = n.match(/(\d{2,5})\s+([A-Za-z].{4,50})/);
    if (m) { const c = m[1] + ' ' + m[2]; if (c.length > 8 && !/^\d{4}$/.test(c)) return c; }
  }
  return null;
}

// ---- Step 3: apartments.com (try mobile + desktop + JSON-LD) ----

async function searchApt(pid: string, known: Record<string,string>): Promise<Record<string,string>> {
  const parts: string[] = [];
  if (known.address) { parts.push(known.address); }
  else { parts.push(pid); }
  if (known.city) parts.push(known.city);
  if (known.state) parts.push(known.state);
  const searchUrl = 'https://www.apartments.com/search/'
    + encodeURIComponent(parts.join(' ')) + '/';
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36';
  const tmpDir = require('os').tmpdir();
  const ck = pid.replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);

  console.log('  [APT] Searching: ' + parts.join(', '));

  try {
    // Get search results
    const sf = path.join(tmpDir, '_s_' + ck + '.html');
    try {
      execSync('curl.exe -s -L "' + searchUrl + '" -H "User-Agent: ' + ua
        + '" --connect-timeout 15 --max-time 45 --max-filesize 3000000 -o "' + sf + '" 2>&1',
        { timeout:50000 });
    } catch {}
    if (fs.existsSync(sf) && fs.statSync(sf).size >= 1000) {
      const h = fs.readFileSync(sf, 'utf8').slice(0,500000);

      // Extract listing slugs
      const slugs: string[] = [];
      const slugRx = /href="\/([a-z0-9\-]+\/[0-9]+[^"]*)"/gi;
      let m;
      while ((m = slugRx.exec(h)) !== null) {
        if (!slugs.includes(m[1])) slugs.push(m[1]);
      }

      if (slugs.length > 0) {
        console.log('  [APT] ' + slugs.length + ' listing(s)');
      }

      // Try each slug on desktop + mobile
      for (const slug of slugs.slice(0, 3)) {
        const dl = 'https://www.apartments.com/' + slug;
        const ml = 'https://m.apartments.com/' + slug;

        for (const [url, agent] of [
          [dl, ua],
          [ml, 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'],
        ] as [string,string][]) {
          const dk = url.replace(/https?:\/\//,'').replace(/[^a-zA-Z0-9]/g,'_').slice(0,50);
          const df = path.join(tmpDir, '_d_' + dk + '.html');
          try {
            execSync('curl.exe -s -L "' + url + '" -H "User-Agent: ' + agent
              + '" --connect-timeout 15 --max-time 30 --max-filesize 3000000 -o "' + df + '" 2>&1',
              { timeout:35000 });
          } catch {}

          if (!fs.existsSync(df) || fs.statSync(df).size < 1000) continue;
          const dh = fs.readFileSync(df, 'utf8').slice(0,500000);
          const f: Record<string,string> = {};

          // JSON-LD structured data
          const ldRx = /<script type="application\/ld\+json">([^<]+)<\/script>/g;
          let ldM;
          while ((ldM = ldRx.exec(dh)) !== null) {
            try {
              const ld: any = JSON.parse(ldM[1]);
              const t = ld['@type'] || '';
              if (t === 'Product' || t === 'ApartmentComplex' || t === 'Place') {
                if (ld.name) f.pname = ld.name;
                if (ld.additionalProperty && Array.isArray(ld.additionalProperty)) {
                  for (const ap of ld.additionalProperty) {
                    if (!ap.name || !ap.value) continue;
                    const key = String(ap.name).toLowerCase().replace(/[\s-]+/g,'_');
                    const val = String(ap.value);
                    if (key.includes('year') && /^\d{4}$/.test(val)) f.year_built = val;
                    if ((key.includes('unit') || key.includes('dwelling')) && /^\d{2,4}$/.test(val)) f.unit_count = val;
                    if ((key.includes('floor') || key.includes('storie')) && /^\d+$/.test(val)) f.stories = val;
                  }
                }
              }
            } catch {}
          }

          // Inline JSON from page scripts
          const street = dh.match(/"streetAddress"\s*:\s*"([^"]+)"/);
          if (street) f.address = street[1];
          const city = dh.match(/"addressLocality"\s*:\s*"([^"]+)"/);
          if (city) f.city = city[1];
          const state = dh.match(/"addressRegion"\s*:\s*"([^"]+)"/);
          if (state) f.stateApt = state[1];
          const zip = dh.match(/"postalCode"\s*:\s*"(\d{5})"/);
          if (zip) f.zip = zip[1];
          const totalU = dh.match(/"totalNumberOfUnits"\s*:\s*(\d+)/);
          if (totalU && !f.unit_count) f.unit_count = totalU[1];
          const floors = dh.match(/"numberOfFloors"\s*:\s*(\d+)/);
          if (floors && !f.stories) f.stories = floors[1];

          // Meta description for year built
          const desc = dh.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
          if (desc) {
            const yb = desc[1].match(/(?:built|constructed)\s+(?:in\s+)?(\d{4})/i);
            if (yb && !f.year_built) f.year_built = yb[1];
            if (!f.building_class) {
              const cls = desc[1].match(/Class\s+([ABC])/i);
              if (cls) f.building_class = cls[1].toUpperCase();
            }
          }

          // Title fallback
          const title = dh.match(/<title>([^<]+)<\/title>/i);
          if (title && /luxury/i.test(title[1]) && !f.building_class) f.building_class = 'A';

          const nFields = Object.keys(f).length;
          if (nFields > 3) {
            console.log('  [APT] ' + nFields + ' fields');
            return f;
          }
        }
      }
    }
  } catch (e: any) {
    console.log('  [APT] Error: ' + (e.message||'').slice(0,60));
  }
  return {};
}

// ---- State persistence ----

function loadState(): any {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch { return { version:1, updated:new Date().toISOString(), properties:{} }; }
}

function saveState(s: any) {
  s.updated = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// ---- Helpers ----

function getSeedVal(seed: Record<string,Record<string,string>>, pid: string, col: string): string {
  return seed[pid]?.[col] || '';
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  const skipOm = args.includes('--skip-om');
  const singleI = args.indexOf('--property');
  const singleP = singleI >= 0 ? args[singleI+1] : null;

  const seed = loadSeed();
  const state = loadState();

  const dirs = fs.readdirSync(ARCHIVE_ROOT)
    .filter(d => fs.statSync(path.join(ARCHIVE_ROOT, d)).isDirectory() && !d.startsWith('_') && !d.startsWith('.'))
    .sort();

  const target = singleP
    ? (dirs.includes(singleP) ? [singleP] : (console.error('Unknown: ' + singleP), process.exit(1)))
    : dirs;

  console.log('\nEnriching ' + target.length + '/' + dirs.length + ' properties'
    + (dryRun ? ' (dry-run)' : ''));
  if (resume) console.log('Resume mode');
  if (skipOm) console.log('Skipping OM extraction');
  console.log('');

  const enriched: Record<string,Record<string,string>> = {};

  for (let i = 0; i < target.length; i++) {
    const pid = target[i];
    if (state.properties[pid]?.done && resume && !singleP) {
      enriched[pid] = state.properties[pid].enriched || {};
      continue;
    }

    console.log('[' + (i+1) + '/' + target.length + '] ' + pid);
    const f: Record<string,string> = {};
    const sr = seed[pid];

    // Seed from catalog
    if (sr) {
      if (sr['MSA']) f.msa = sr['MSA'];
      if (sr['City']) f.city = sr['City'];
      if (sr['State']) f.state = sr['State'];
      if (sr['YearBuilt']) f.year_built = sr['YearBuilt'];
    }

    // Step 1: OM
    if (!skipOm) {
      const omf = await doOm(pid);
      for (const [k,v] of Object.entries(omf)) if (!f[k]) f[k] = v;
    }

    // Step 2: Address
    if (!f.address) {
      const a = extractAddr(pid);
      if (a) { f.address = a; console.log('  [ADDR] ' + a); }
    }

    // Step 3: apartments.com (only if missing core fields)
    const core = ['building_class','stories','year_built','property_type','unit_count'];
    const missing = core.filter(k => !f[k]);
    if (missing.length > 0) {
      const apt = await searchApt(pid, f);
      for (const [k,v] of Object.entries(apt)) {
        // Map stateApt -> state
        const key = k === 'stateApt' ? 'state' : k;
        if (!f[key]) f[key] = v;
      }
    } else {
      console.log('  [APT] Skipped (all core fields present)');
    }

    enriched[pid] = f;
    const nFields = Object.keys(f).length;
    console.log('  => ' + nFields + ' fields\n');

    state.properties[pid] = {
      parcelId: pid,
      done: nFields > 2,
      enriched: f,
      note: nFields + ' fields',
    };

    if ((i+1) % 5 === 0 || singleP) saveState(state);
  }

  // Write output
  if (!dryRun) {
    const rows: string[] = [CATALOG_COLS.join(',')];

    for (const pid of dirs) {
      const f = enriched[pid] || {};
      const sr = seed[pid] || {};
      const rec: Record<string,string> = {};
      for (const col of CATALOG_COLS) rec[col] = '';

      rec.ParcelId = pid;
      for (const [k,v] of Object.entries(f)) {
        const col = FIELD_MAP[k as keyof typeof FIELD_MAP];
        if (col) rec[col] = v;
      }
      // Fallback to seed
      for (const col of ['Address','City','State','ZIP','MSA','YearBuilt','County','Submarket','AssetClass','Stories','PropertyType','UnitCount','ConstructionType','ParkingType','ManagementCompany']) {
        if (!rec[col] && sr[col]) rec[col] = sr[col];
      }

      // Confidence
      const core = ['City','State','MSA','YearBuilt','AssetClass','Stories','PropertyType','UnitCount'];
      const filled = core.filter(c => rec[c]).length;
      rec.DataConfidence = filled >= 6 ? 'high' : filled >= 3 ? 'medium' : filled >= 1 ? 'low' : 'none';
      rec.SourceFiles = sr['SourceFiles'] || '';

      const vals = CATALOG_COLS.map(col => {
        const v = (rec[col]||'').replace(/"/g,'""');
        return /[,"\n]/.test(v) ? '"' + v + '"' : v;
      });
      rows.push(vals.join(','));
    }

    fs.writeFileSync(OUTPUT_PATH, '\ufeff' + rows.join('\r\n'), 'utf8');
    const nOut = rows.length - 1;
    console.log('\nWrote ' + nOut + ' rows to ' + OUTPUT_PATH);

    const withYb = rows.filter(r => /,(?:19|20)\d{2},/.test(r)).length - 1;
    const withUnits = rows.filter(r => /^\d{2,4}$/.test(r.split(',')[14]||'')).length;
    const withClass = rows.filter(r => /[ABC]/.test(r.split(',')[10]||'')).length;
    console.log('Coverage: YearBuilt=' + withYb + ' UnitCount=' + withUnits + ' Class=' + withClass);
  }

  saveState(state);
}

main().catch(e => { console.error(e); process.exit(1); });
