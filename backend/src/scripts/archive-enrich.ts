/**
 * archive-enrich.ts — Property metadata enrichment pipeline
 *  1. OM PDF -> AI extraction via parse-om endpoint
 *  2. Address from file names
 *  3. Tavily search for property details (year built, units, stories, class)
 *
 * Uses Tavily API for the web search step — handles JS rendering,
 * returns clean structured text from apartments.com and other listing sites.
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
import * as http from 'http';
import * as https from 'https';

const ARCHIVE_ROOT = 'C:\\Users\\Leon\\OneDrive - Myers Apartment Group\\Deals\\Archive';
const CATALOG_PATH = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG.csv');
const STATE_PATH = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_ENRICH_STATE.json');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'docs', 'operations', 'ARCHIVE_PROPERTY_CATALOG_ENRICHED.csv');
const REAPER = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive';
const SECRET = 'jedire-archive-2026';

// ---- Tavily config ----

const TAVILY_KEY = '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';
const TAVILY_SEARCH = 'https://api.tavily.com/search';
const TAVILY_EXTRACT = 'https://api.tavily.com/extract';

// ---- Field definitions ----

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

// ---- HTTP helpers ----

function httpsPostJson(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    }, (res) => {
      let buf = '';
      res.on('data', (c: Buffer) => buf += c.toString());
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve({ raw: buf }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

// ---- CSV parser ----

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
    const buf = execSync(cmd, {
      timeout: 190000, encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']
    });
    const txt = buf.toString('utf8').trim();
    if (!txt) return {};
    const r = JSON.parse(txt);
    if (r.success === false) return {};
    const f: Record<string,string> = {};
    for (const k of ALL_FIELDS) if (r[k] != null && r[k] !== '') f[k] = String(r[k]);
    console.log('  [OM] ' + Object.keys(f).length + ' fields');
    return f;
  } catch (e: any) {
    console.log('  [OM] Failed: ' + (e.message || '').slice(0, 80));
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
    if (m) {
      const c = m[1] + ' ' + m[2];
      if (c.length > 8 && !/^\d{4}$/.test(c)) return c;
    }
  }
  return null;
}

// ---- Step 3: Tavily search for property details ----

async function searchTavily(
  pid: string,
  known: Record<string,string>
): Promise<Record<string,string>> {
  const city = known.city || '';
  const state = known.state || '';
  const addr = known.address || '';

  // Build search query
  const parts: string[] = [pid];
  if (addr) parts.push(addr);
  if (city) parts.push(city);
  if (state) parts.push(state);
  parts.push('apartment', 'property', 'details', 'year built', 'units');
  const query = parts.join(' ');

  console.log('  [TAV] Searching: ' + pid + (addr ? ' at ' + addr : ''));

  const result: Record<string,string> = {};

  try {
    // Step 3a: Tavily search to find the right URL
    const searchResult = await httpsPostJson(TAVILY_SEARCH, {
      api_key: TAVILY_KEY,
      query: query,
      search_depth: 'advanced',
      include_answer: true,
      include_raw_content: false,
      max_results: 5,
    });

    if (!searchResult || !searchResult.results) return result;

    // Check the AI answer first — Tavily sometimes summarizes from multiple sources
    if (searchResult.answer) {
      const answer = searchResult.answer;
      console.log('  [TAV] AI answer available (' + answer.length + ' chars)');
      mapTextToFields(answer, result);
    }

    // Find apartments.com URL from results
    const aptUrl = searchResult.results
      .filter((r: any) => r.url && /apartments\.com/i.test(r.url))
      .map((r: any) => r.url);

    if (aptUrl.length > 0) {
      console.log('  [TAV] Found apartments.com: ' + aptUrl[0]);
      // Step 3b: Extract the page content via Tavily extract
      const extractResult = await httpsPostJson(TAVILY_EXTRACT, {
        api_key: TAVILY_KEY,
        urls: [aptUrl[0]],
        include_images: false,
      });

      if (extractResult && extractResult.results && extractResult.results.length > 0) {
        const content = extractResult.results[0].raw_content || '';
        if (content.length > 100) {
          console.log('  [TAV] Extracted ' + content.length + ' chars');
          mapTextToFields(content, result);
        }
      }
    }

    // Also check other listing sites (apartmentlist, rent, realtor)
    for (const r of searchResult.results) {
      const url = r.url || '';
      if (!/(apartments\.com|apartmentlist\.com|realtor\.com|rent\.com|zillow\.com)/i.test(url)) continue;
      if (url === aptUrl[0]) continue; // already processed

      console.log('  [TAV] Also extracting: ' + url);
      try {
        const ex = await httpsPostJson(TAVILY_EXTRACT, {
          api_key: TAVILY_KEY,
          urls: [url],
          include_images: false,
        });
        if (ex && ex.results && ex.results.length > 0) {
          mapTextToFields(ex.results[0].raw_content || '', result);
        }
      } catch {}
    }

  } catch (e: any) {
    console.log('  [TAV] Error: ' + (e.message || '').slice(0, 80));
  }

  const n = Object.keys(result).length;
  if (n > 0) console.log('  [TAV] ' + n + ' fields found');
  return result;
}

/**
 * Parse property details from Tavily text content (from AI answer or extract).
 * Looks for year built, units, stories, class, construction, parking, etc.
 */
function mapTextToFields(text: string, target: Record<string,string>) {
  if (!text || text.length < 20) return;

  // Year built
  if (!target.year_built) {
    const yb = text.match(/(?:year\s+built|built|constructed|opened|developed)\s*(?::|in)?\s*(19|20)\d{2}/i);
    if (yb) target.year_built = yb[0].match(/(19|20)\d{2}/)?.[0] || '';
  }

  // Units
  if (!target.unit_count) {
    const uc = text.match(/(\d{2,4})\s*(?:unit|apartment|home|residence)[^a-zA-Z]/i);
    if (uc) target.unit_count = uc[1];
    // Also: "XX units"
    const uc2 = text.match(/\b(\d{2,4})\s+units?\b/i);
    if (uc2 && !target.unit_count) target.unit_count = uc2[1];
    // Total units:
    const uc3 = text.match(/(?:total|number\s+of)\s+units?\s*[:\-]?\s*(\d{2,4})/i);
    if (uc3 && !target.unit_count) target.unit_count = uc3[1];
  }

  // Stories
  if (!target.stories) {
    const st = text.match(/(\d+)\s*(?:-story|-stories|-floor|story|stories|floors?)\s/);
    if (st) target.stories = st[1];
    const st2 = text.match(/(?:stories|floors?|number\s+of\s+stories)\s*[:\-]?\s*(\d+)/i);
    if (st2 && !target.stories) target.stories = st2[1];
  }

  // Building class
  if (!target.building_class) {
    const cl = text.match(/(?:class\s+)([ABCD])(?:\s|$|[,\-])/i);
    if (cl) target.building_class = cl[1].toUpperCase();
    // Luxury often means Class A
    if (!target.building_class && /luxury/i.test(text)) target.building_class = 'A';
  }

  // Property type
  if (!target.property_type) {
    for (const t of ['Garden', 'Mid-Rise', 'Mid Rise', 'High-Rise', 'High Rise', 'Townhouse', 'Walk-Up']) {
      if (new RegExp(t, 'i').test(text)) {
        target.property_type = t;
        break;
      }
    }
  }

  // Construction type
  if (!target.construction_type) {
    for (const t of ['Wood Frame', 'Concrete', 'Steel Frame', 'Masonry', 'Podium', 'Slab']) {
      if (new RegExp(t, 'i').test(text)) {
        target.construction_type = t;
        break;
      }
    }
  }

  // Parking
  if (!target.parking_type) {
    if (/garage\s+parking/i.test(text)) target.parking_type = 'Garage';
    else if (/covered\s+parking/i.test(text)) target.parking_type = 'Covered';
    else if (/surface\s+parking/i.test(text)) target.parking_type = 'Surface';
    if (!target.parking_type && /parking/i.test(text)) target.parking_type = 'Surface';
  }

  // Address
  if (!target.address) {
    const ad = text.match(/\b(\d{2,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}(?:\s+(?:Dr|Drive|St|Street|Rd|Road|Blvd|Boulevard|Ave|Avenue|Ln|Lane|Ct|Court|Cir|Circle|Way|Pkwy|Parkway|Hwy)))\b/);
    if (ad) target.address = ad[1];
  }

  // Square footage
  if (!target.avg_unit_sqft) {
    const sq = text.match(/(\d{3,4})\s*(?:sq\.?\s*ft|square\s*feet|SF)\s*(?:avg|average)?/i);
    if (sq) target.avg_unit_sqft = sq[1];
  }

  if (!target.net_rentable_sqft) {
    const sq2 = text.match(/(\d{3,6})\s*(?:sq\.?\s*ft|square\s*feet|SF)\s*(?:building|total|rentable|gross)?/i);
    if (sq2) target.net_rentable_sqft = sq2[1];
  }

  // Management company
  if (!target.management_company) {
    const mgmt = text.match(/(?:managed\s+by|management|property\s+manager)\s*[:\-]?\s*([A-Z][A-Za-z\s.&]+?)(?:\s+\d|[A-Z]{2}|$)/i);
    if (mgmt) target.management_company = mgmt[1].trim().replace(/\s+/g, ' ');
  }

  // Lot size
  if (!target.lot_size_acres) {
    const lot = text.match(/(\d+\.?\d*)\s*(?:acres?|acre)\b/i);
    if (lot) target.lot_size_acres = lot[1];
  }

  // Year renovated
  if (!target.year_renovated) {
    const yr = text.match(/(?:renovated|renovation|year\s+renovated)\s*(?::|in)?\s*(\d{4})/i);
    if (yr) target.year_renovated = yr[1];
  }
}

// ---- State persistence ----

function loadState(): any {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch {
    return {
      version: 1,
      updated: new Date().toISOString(),
      properties: {}
    };
  }
}

function saveState(s: any) {
  s.updated = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  const skipOm = args.includes('--skip-om');
  const singleI = args.indexOf('--property');
  const singleP = singleI >= 0 ? args[singleI + 1] : null;

  const seed = loadSeed();
  const state = loadState();

  const dirs = fs.readdirSync(ARCHIVE_ROOT)
    .filter(d =>
      fs.statSync(path.join(ARCHIVE_ROOT, d)).isDirectory() &&
      !d.startsWith('_') && !d.startsWith('.')
    )
    .sort();

  const target = singleP
    ? (dirs.includes(singleP) ? [singleP] : (console.error('Unknown: ' + singleP), process.exit(1)))
    : dirs;

  console.log('\nEnriching ' + target.length + '/' + dirs.length + ' properties'
    + (dryRun ? ' (dry-run)' : ''));
  if (resume) console.log('Resume mode (skip done)');
  if (skipOm) console.log('Skipping OM extraction');
  console.log('');

  const enriched: Record<string,Record<string,string>> = {};

  for (let i = 0; i < target.length; i++) {
    const pid = target[i];
    if (state.properties[pid]?.done && resume && !singleP) {
      enriched[pid] = state.properties[pid].enriched || {};
      continue;
    }

    console.log('[' + (i + 1) + '/' + target.length + '] ' + pid);
    const f: Record<string,string> = {};
    const sr = seed[pid];

    // Seed from catalog
    if (sr) {
      if (sr['MSA']) f.msa = sr['MSA'];
      if (sr['City']) f.city = sr['City'];
      if (sr['State']) f.state = sr['State'];
      if (sr['YearBuilt']) f.year_built = sr['YearBuilt'];
    }

    // Step 1: OM extraction
    if (!skipOm) {
      const omf = await doOm(pid);
      for (const [k, v] of Object.entries(omf)) {
        if (!f[k]) f[k] = v;
      }
    }

    // Step 2: Address from files
    if (!f.address) {
      const a = extractAddr(pid);
      if (a) {
        f.address = a;
        console.log('  [ADDR] ' + a);
      }
    }

    // Step 3: Tavily search for missing core fields
    const core = ['building_class', 'stories', 'year_built', 'property_type', 'unit_count'];
    const missing = core.filter(k => !f[k]);
    if (missing.length > 0) {
      const tav = await searchTavily(pid, f);
      for (const [k, v] of Object.entries(tav)) {
        if (!f[k]) f[k] = v;
      }
    } else {
      console.log('  [TAV] Skipped (all core fields present)');
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

    if ((i + 1) % 5 === 0 || singleP) saveState(state);
  }

  // ---- Write enriched CSV ----

  if (!dryRun) {
    const rows: string[] = [CATALOG_COLS.join(',')];

    for (const pid of dirs) {
      const f = enriched[pid] || {};
      const sr = seed[pid] || {};
      const rec: Record<string,string> = {};
      for (const col of CATALOG_COLS) rec[col] = '';

      rec.ParcelId = pid;
      for (const [k, v] of Object.entries(f)) {
        const col = FIELD_MAP[k as keyof typeof FIELD_MAP];
        if (col) rec[col] = v;
      }
      // Fallback to seed
      for (const col of [
        'Address', 'City', 'State', 'ZIP', 'MSA', 'YearBuilt',
        'County', 'Submarket', 'AssetClass', 'Stories', 'PropertyType',
        'UnitCount', 'ConstructionType', 'ParkingType', 'ManagementCompany',
      ]) {
        if (!rec[col] && sr[col]) rec[col] = sr[col];
      }

      // Confidence
      const core = ['City', 'State', 'MSA', 'YearBuilt', 'AssetClass', 'Stories', 'PropertyType', 'UnitCount'];
      const filled = core.filter(c => rec[c]).length;
      rec.DataConfidence = filled >= 6 ? 'high' : filled >= 3 ? 'medium' : filled >= 1 ? 'low' : 'none';
      rec.SourceFiles = sr['SourceFiles'] || '';

      const vals = CATALOG_COLS.map(col => {
        const v = (rec[col] || '').replace(/"/g, '""');
        return /[,"\n]/.test(v) ? '"' + v + '"' : v;
      });
      rows.push(vals.join(','));
    }

    fs.writeFileSync(OUTPUT_PATH, '\ufeff' + rows.join('\r\n'), 'utf8');
    const nOut = rows.length - 1;
    console.log('\nWrote ' + nOut + ' rows to ' + OUTPUT_PATH);

    const withYb = rows.filter(r => /,(?:19|20)\d{2},/.test(r)).length - 1;
    const withUnits = rows.filter(r => /^\d{2,4}$/.test(r.split(',')[14] || '')).length;
    const withClass = rows.filter(r => /[ABC]/.test(r.split(',')[10] || '')).length;
    console.log('Coverage: YearBuilt=' + withYb + ' UnitCount=' + withUnits + ' Class=' + withClass);
  }

  saveState(state);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
