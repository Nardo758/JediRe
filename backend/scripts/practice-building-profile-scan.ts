#!/usr/bin/env node
/**
 * Practice scan: extract building specs from archive deal folder structures
 * and infer building profiles WITHOUT needing the full OM parser.
 *
 * Uses folder names, file names, and simple XLSX parsing to extract:
 * - Year built (from OM PDF pages or folder context)
 * - Building type (from stories or unit count)
 * - Amenity inference from file names and folder structure
 * - T12 financials via xlsx parsing
 *
 * This demonstrates what the building_profile pipeline will produce
 * once the archive is ingested into the Data Library.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const ARCHIVE_ROOT = '/home/ldixon/.openclaw/Archive Deals';
const parseArgs = () => {
  const idx = process.argv.indexOf('--limit');
  return { limit: idx >= 0 ? parseInt(process.argv[idx + 1]) || 20 : 20 };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVintageBand(yb: number | null): string {
  if (!yb) return 'unknown';
  if (yb < 1980) return 'pre-1980';
  if (yb < 2000) return '1980-1999';
  if (yb < 2010) return '2000-2009';
  if (yb < 2020) return '2010-2019';
  return '2020+';
}

function getBuildingType(stories: number | null, units: number | null): string {
  if (stories && stories <= 3) return 'garden';
  if (stories && stories <= 6) return 'midrise';
  if (stories && stories > 6) return 'highrise';
  if (units && units >= 300) return 'midrise';  // bigger = probably midrise
  return 'garden';
}

function getSizeBand(units: number | null): string {
  if (!units) return 'unknown';
  if (units < 100) return 'small';
  if (units < 250) return 'medium';
  if (units < 400) return 'large';
  return 'mega';
}

const AMENITY_KEYWORDS: [string, string][] = [
  ['elevator', 'hasElevator'], ['elevators', 'hasElevator'],
  ['pool', 'hasPool'], ['swimming', 'hasPool'],
  ['clubhouse', 'hasClubhouse'], ['club room', 'hasClubhouse'], ['club', 'hasClubhouse'],
  ['fitness', 'hasFitness'], ['gym', 'hasFitness'], ['fitness center', 'hasFitness'],
  ['concierge', 'hasConcierge'],
  ['dog park', 'hasDogPark'], ['pet park', 'hasDogPark'],
  ['rooftop', 'hasRooftop'], ['roof deck', 'hasRooftop'], ['roof terrace', 'hasRooftop'],
  ['coworking', 'hasCoworking'], ['co-working', 'hasCoworking'],
  ['package concierge', 'hasPackageConcierge'], ['package locker', 'hasPackageConcierge'],
  ['valet trash', 'hasValetTrash'], ['trash valet', 'hasValetTrash'],
  ['doorman', 'hasDoorman'], ['attended lobby', 'hasDoorman'],
  ['parking garage', 'hasGarage'], ['garage parking', 'hasGarage'], ['parking deck', 'hasGarage'],
  ['tennis', 'hasTennis'],
  ['basketball', 'hasBasketball'],
  ['business center', 'hasBusinessCenter'],
  ['playground', 'hasPlayground'],
  ['grill', 'hasGrill'], ['grilling', 'hasGrill'], ['bbq', 'hasGrill'], ['barbeque', 'hasGrill'],
];

function classifyAmenities(texts: string[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const [, field] of AMENITY_KEYWORDS) flags[field] = false;
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const [keyword, field] of AMENITY_KEYWORDS) {
      if (lower.includes(keyword)) flags[field] = true;
    }
  }
  return flags;
}

function buildFingerprint(buildingType: string, vintageBand: string, flags: Record<string, boolean>): string {
  const e = flags.hasElevator ? 'elev' : 'noelev';
  const p = flags.hasPool ? 'pool' : 'nopool';
  const f = flags.hasFitness ? 'fit' : 'nofit';
  const c = flags.hasClubhouse ? 'club' : 'noclub';
  return `${buildingType}|${vintageBand}|${e}|${p}|${f}|${c}`;
}

function formatUsd(v: number | null): string {
  if (v == null) return '?';
  return `$${(v / 1000).toFixed(0)}K`;
}

// ─── Deal Scanner ─────────────────────────────────────────────────────────────

function findFiles(folderPath: string): { name: string; ext: string; path: string }[] {
  const results: { name: string; ext: string; path: string }[] = [];
  try {
    for (const entry of fs.readdirSync(folderPath)) {
      const fp = path.join(folderPath, entry);
      if (fs.statSync(fp).isFile()) {
        results.push({ name: entry, ext: path.extname(entry).toLowerCase(), path: fp });
      } else if (fs.statSync(fp).isDirectory() && !entry.startsWith('.')) {
        for (const sub of fs.readdirSync(fp)) {
          const sp = path.join(fp, sub);
          if (fs.statSync(sp).isFile()) {
            results.push({ name: sub, ext: path.extname(sub).toLowerCase(), path: sp });
          }
        }
      }
    }
  } catch {}
  return results;
}

function extractYearFromFileNames(files: { name: string }[]): number | null {
  // Look for 4-digit years in file names
  const years: number[] = [];
  for (const f of files) {
    const matches = f.name.match(/\b(18\d\d|19\d\d|20[0-2]\d)\b/g);
    if (matches) years.push(...matches.map(Number));
  }
  if (years.length === 0) return null;
  // Most common year that looks like a built-date (not a report date)
  const counts = new Map<number, number>();
  for (const y of years) counts.set(y, (counts.get(y) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function guessStoriesFromName(folderName: string): number | null {
  const lower = folderName.toLowerCase();
  if (lower.includes('story') || lower.includes('floor')) {
    const m = lower.match(/(\d+)\s*(story|floor)/);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractUnitsFromRR(filePath: string): { units: number | null; rent: number | null; occ: number | null } {
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true, type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      
      let unitCount = 0;
      let occupied = 0;
      let rentSum = 0;
      let rentCount = 0;
      let foundTable = false;
      
      for (const row of data.slice(0, 200)) {
        if (!row || row.length < 3) continue;
        const cells = row.map(c => String(c ?? '').toLowerCase().trim());
        
        // Detect header
        if (!foundTable && (cells.some(c => c.includes('unit') && c.includes('type')) || 
            cells.some(c => c.includes('bedroom') || c.includes('bath')))) {
          foundTable = true;
          continue;
        }
        
        if (!foundTable) continue;
        
        // Skip subtotals
        if (cells.some(c => c.includes('total') || c.includes('subtotal'))) continue;
        
        unitCount++;
        
        // Check occupancy
        const status = cells.find(c => ['occupied', 'vacant', 'leased', 'notice', 'ready'].includes(c));
        if (status && ['occupied', 'leased'].includes(status)) occupied++;
        
        // Extract rent from any numeric column
        for (const c of row) {
          if (typeof c === 'number' && c > 100 && c < 10000) {
            rentSum += c;
            rentCount++;
          }
        }
      }
      
      if (unitCount > 5 && unitCount < 1000) {
        return {
          units: unitCount,
          rent: rentCount > 0 ? Math.round(rentSum / rentCount) : null,
          occ: unitCount > 0 ? Math.round((occupied / unitCount) * 100) : null,
        };
      }
    }
  } catch {}
  return { units: null, rent: null, occ: null };
}

interface T12Result {
  gpr: number | null;
  noi: number | null;
  opex: number | null;
  opexPerUnit: number | null;
  expenses: Record<string, number>;
  hasMultipleMonths: boolean;
}

function extractT12(filePath: string, units: number | null): T12Result {
  const result: T12Result = { gpr: null, noi: null, opex: null, opexPerUnit: null, expenses: {}, hasMultipleMonths: false };
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true, type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (data.length < 5) continue;
      
      const tu = units || 100;
      let gpr, noi, opex;
      
      for (const row of data) {
        if (!row || row.length < 2) continue;
        const cells = row.map(c => String(c ?? '').toLowerCase().trim());
        const label = cells[0] || '';
        
        // Find the last numeric column (annual total)
        let annualVal = null;
        for (let i = row.length - 1; i >= 1; i--) {
          if (typeof row[i] === 'number' && row[i] > 100) {
            annualVal = row[i];
            break;
          }
        }
        
        if (!annualVal) continue;
        
        if (label.includes('gross potential') || label.includes('gpr') || label.includes('gpi')) {
          gpr = annualVal;
        } else if (label.includes('effective gross') || label.includes('egi')) {
          // skip, we want GPR
        } else if (label.includes('noi') || label.includes('net operating')) {
          noi = annualVal;
        } else if (label.includes('total expense') || label.includes('total opex') || label.includes('operating expense')) {
          opex = annualVal;
        } else if (label.includes('repair') || label.includes('maintenance') || label.includes('r&m')) {
          result.expenses['repairs_maintenance'] = annualVal;
        } else if (label.includes('payroll') || label.includes('salary') || label.includes('wages')) {
          result.expenses['payroll'] = annualVal;
        } else if (label.includes('insurance') || label.includes('property insurance')) {
          result.expenses['insurance'] = annualVal;
        } else if (label.includes('tax') && !label.includes('income') && !label.includes('payroll')) {
          result.expenses['real_estate_taxes'] = annualVal;
        } else if (label.includes('utility') || label.includes('electric') || label.includes('gas') || label.includes('water')) {
          result.expenses['utilities'] = (result.expenses['utilities'] || 0) + annualVal;
        } else if (label.includes('management') || label.includes('mgmt fee')) {
          result.expenses['management_fee'] = annualVal;
        } else if (label.includes('marketing') || label.includes('advertising') || label.includes('ads')) {
          result.expenses['marketing'] = annualVal;
        } else if (label.includes('admin') || label.includes('administrative') || label.includes('general')) {
          result.expenses['admin_general'] = annualVal;
        } else if (label.includes('legal') || label.includes('professional') || label.includes('accounting')) {
          result.expenses['professional_fees'] = annualVal;
        }
      }
      
      if (gpr || noi || opex) {
        result.gpr = gpr;
        result.noi = noi;
        result.opex = opex;
        if (opex && tu > 0) result.opexPerUnit = Math.round(opex / tu);
        result.hasMultipleMonths = true;
        break;
      }
    }
  } catch {}
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { limit } = parseArgs();
  const folders = fs.readdirSync(ARCHIVE_ROOT)
    .filter(f => fs.statSync(path.join(ARCHIVE_ROOT, f)).isDirectory() && !f.startsWith('.'))
    .sort();
  
  console.log(`\n🔍 BUILDING PROFILE PRACTICE SCAN — ${Math.min(limit, folders.length)} of ${folders.length} archive deals\n`);
  
  interface ProfileEntry {
    fingerprint: string;
    type: string;
    vintage: string;
    units: number | null;
    elevation: boolean;
    pool: boolean;
    fitness: boolean;
    clubhouse: boolean;
    gpr: number | null;
    noi: number | null;
    opex: number | null;
    opexPerUnit: number | null;
    expenses: Record<string, number>;
  }
  
  const entries: ProfileEntry[] = [];
  const stats = { scanned: 0, om: 0, t12: 0, rr: 0, t12WithOpex: 0 };
  
  for (const folder of folders.slice(0, limit)) {
    stats.scanned++;
    const folderPath = path.join(ARCHIVE_ROOT, folder);
    const files = findFiles(folderPath);
    
    // Infer building type from folder name hints
    const stories = guessStoriesFromName(folder);
    const buildingType = getBuildingType(stories, null);
    const yearBuilt = extractYearFromFileNames(files);
    const vintageBand = getVintageBand(yearBuilt);
    
    // Collect all file names and paths as amenity "texts"
    const nameTexts = files.map(f => f.name);
    const amenityFlags = classifyAmenities(nameTexts);
    const fingerprint = buildFingerprint(buildingType, vintageBand, amenityFlags);
    
    // Try to extract units from rent roll
    const rrFile = files.find(f => 
      f.name.toLowerCase().includes('rent roll') && !f.name.includes('~$')
    );
    let units: number | null = null;
    let avgRent: number | null = null;
    let occupancy: number | null = null;
    if (rrFile) {
      stats.rr++;
      const rr = extractUnitsFromRR(rrFile.path);
      units = rr.units;
      avgRent = rr.rent;
      occupancy = rr.occ;
    }
    
    // Try T12
    const t12File = files.find(f => 
      (f.name.toLowerCase().includes('t12') || f.name.toLowerCase().includes('t-12') || 
       f.name.toLowerCase().includes('income statement')) &&
      (f.ext === '.xlsx' || f.ext === '.xls') && !f.name.includes('~$')
    );
    let t12: T12Result = { gpr: null, noi: null, opex: null, opexPerUnit: null, expenses: {}, hasMultipleMonths: false };
    if (t12File) {
      stats.t12++;
      t12 = extractT12(t12File.path, units);
      if (t12.opex) stats.t12WithOpex++;
    }
    
    const hasOM = files.some(f => f.name.toLowerCase().includes('om') || f.name.toLowerCase().includes('offering'));
    if (hasOM) stats.om++;
    
    entries.push({
      fingerprint, type: buildingType, vintage: vintageBand, units,
      elevation: amenityFlags.hasElevator,
      pool: amenityFlags.hasPool,
      fitness: amenityFlags.hasFitness,
      clubhouse: amenityFlags.hasClubhouse,
      gpr: t12.gpr, noi: t12.noi, opex: t12.opex,
      opexPerUnit: t12.opexPerUnit,
      expenses: t12.expenses,
    });
  }
  
  // ── BUILDING PROFILES TABLE ──
  console.log('═══ INDIVIDUAL BUILDING PROFILES ═══\n');
  console.log(
    `${'FOLDER'.padEnd(28)} ${'TYPE'.padEnd(8)} ${'YR'.padEnd(5)} ${'VINTAGE'.padEnd(10)} ` +
    `${'UNITS'.padEnd(6)} ${'ELEV'.padEnd(5)} ${'POOL'.padEnd(5)} ${'FIT'.padEnd(5)} ${'CLUB'.padEnd(5)} ` +
    `${'OPEX/UNIT'.padEnd(10)} ${'FINGERPRINT'.padEnd(48)}`
  );
  console.log('─'.repeat(140));
  
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const folder = folders[i];
    console.log(
      `${folder.slice(0, 27).padEnd(28)} ${e.type.padEnd(8)} ${'?'.padEnd(5)} ` +
      `${e.vintage.padEnd(10)} ${String(e.units ?? '?').padEnd(6)} ` +
      `${e.elevation ? 'Y' : '-'.padEnd(5)} ${e.pool ? 'Y' : '-'.padEnd(5)} ` +
      `${e.fitness ? 'Y' : '-'.padEnd(5)} ${e.clubhouse ? 'Y' : '-'.padEnd(5)} ` +
      `${e.opexPerUnit ? '$' + e.opexPerUnit.toLocaleString() : '?'.padEnd(10)} ` +
      `${e.fingerprint}`
    );
  }
  
  // ── PROFILE CLUSTERS ──
  const clusterMap = new Map<string, { count: number; opexPerUnits: number[]; expenses: Map<string, number[]>; deals: string[] }>();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const fp = e.fingerprint;
    if (!clusterMap.has(fp)) clusterMap.set(fp, { count: 0, opexPerUnits: [], expenses: new Map(), deals: [] });
    const cl = clusterMap.get(fp)!;
    cl.count++;
    cl.deals.push(folders[i]);
    if (e.opexPerUnit) cl.opexPerUnits.push(e.opexPerUnit);
    for (const [line, amt] of Object.entries(e.expenses)) {
      if (!cl.expenses.has(line)) cl.expenses.set(line, []);
      cl.expenses.get(line)!.push(amt / (e.units || 100));
    }
  }
  
  const clustered = [...clusterMap.entries()].filter(([_, c]) => c.count >= 2).sort((a, b) => b[1].count - a[1].count);
  
  if (clustered.length > 0) {
    console.log(`\n═══ PROFILE CLUSTERS (${clustered.length} groups with 2+ identical fingerprints) ═══\n`);
    console.log(`${'FINGERPRINT'.padEnd(48)} ${'N'.padEnd(4)} ${'MED OPEX/UNIT'.padEnd(14)} ${'MIN'.padEnd(10)} ${'MAX'.padEnd(10)}  SAMPLE DEALS`);
    console.log('─'.repeat(130));
    
    for (const [fp, cl] of clustered) {
      const opexVals = cl.opexPerUnits.sort((a, b) => a - b);
      const med = opexVals.length > 0 ? opexVals[Math.floor(opexVals.length / 2)] : null;
      const min = opexVals.length > 0 ? opexVals[0] : null;
      const max = opexVals.length > 0 ? opexVals[opexVals.length - 1] : null;
      const deals = cl.deals.slice(0, 4).map(d => d.slice(0, 20)).join(', ');
      console.log(
        `${fp.padEnd(48)} ${String(cl.count).padEnd(4)} ` +
        `${med ? '$' + med.toLocaleString() : '?'.padEnd(12)} ` +
        `${min ? '$' + min.toLocaleString() : '?'.padEnd(8)} ` +
        `${max ? '$' + max.toLocaleString() : '?'.padEnd(8)}  ${deals}`
      );
    }
    
    // Line item breakdown for largest cluster
    const largest = clustered[0];
    console.log(`\n═══ LINE ITEM BREAKDOWN: "${largest[0]}" (${largest[1].count} deals) ═══\n`);
    console.log(`${'LINE ITEM'.padEnd(35)} ${'MED/UNIT'.padEnd(12)} ${'MIN'.padEnd(10)} ${'MAX'.padEnd(10)} ${'SPREAD'.padEnd(8)}`);
    console.log('─'.repeat(75));
    
    const lineItems = [...largest[1].expenses.entries()]
      .map(([line, vals]) => {
        const sorted = vals.sort((a, b) => a - b);
        const med = sorted[Math.floor(sorted.length / 2)];
        return { line, med, min: sorted[0], max: sorted[sorted.length - 1], spread: sorted[sorted.length - 1] - sorted[0] };
      })
      .filter(l => l.med > 0)
      .sort((a, b) => b.med - a.med);
    
    for (const li of lineItems.slice(0, 10)) {
      const spreadPct = li.med > 0 ? Math.round((li.spread / li.med) * 100) : 0;
      console.log(
        `${li.line.padEnd(35)} $${li.med.toLocaleString().padEnd(9)} ` +
        `$${li.min.toLocaleString().padEnd(8)} $${li.max.toLocaleString().padEnd(8)} ` +
        `${spreadPct}%`
      );
    }
  }
  
  // ── DELTA ANALYSIS ──
  console.log(`\n═══ DELTA ANALYSIS: T12 OPEX vs PROFILE EXPECTATIONS ═══\n`);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.opexPerUnit) continue;
    
    // Find this profile's cluster median
    const cl = clusterMap.get(e.fingerprint);
    if (!cl || cl.opexPerUnits.length < 2) continue;
    const sorted = [...cl.opexPerUnits].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    
    if (!med || e.opexPerUnit === med) continue;
    
    const delta = Math.round(((e.opexPerUnit - med) / med) * 100);
    const direction = delta > 0 ? '📈 ABOVE' : '📉 BELOW';
    
    console.log(
      `  ${direction} cluster median by ${Math.abs(delta)}%: ${folders[i].slice(0, 25).padEnd(25)} ` +
      `(opex $${e.opexPerUnit.toLocaleString()}/unit vs cluster $${med.toLocaleString()}/unit)`
    );
  }
  
  // ── SUMMARY ──
  console.log(`\n═══ SCAN SUMMARY ═══\n`);
  console.log(`  Deals scanned:      ${stats.scanned}`);
  console.log(`  OM inferred:        ${stats.om}`);
  console.log(`  T12 parsed:         ${stats.t12}`);
  console.log(`  T12 w/ OpEx:        ${stats.t12WithOpex}`);
  console.log(`  Rent rolls parsed:  ${stats.rr}`);
  console.log(`  Unique profiles:    ${clusterMap.size}`);
  console.log(`  Clusters (2+):      ${clustered.length}`);
  console.log(`  Largest cluster:    ${clustered.length > 0 ? clustered[0][1].count + ' deals' : 'n/a'}`);
  
  const totalOpexSamples = entries.filter(e => e.opexPerUnit).length;
  const withDeviations = entries.filter(e => e.opexPerUnit).map(e => {
    const cl = clusterMap.get(e.fingerprint);
    if (!cl || cl.opexPerUnits.length < 2) return 0;
    const sorted = [...cl.opexPerUnits].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    return med ? Math.abs(e.opexPerUnit - med) / med : 0;
  }).filter(d => d > 0.2);
  
  console.log(`  Total OpEx samples: ${totalOpexSamples}`);
  console.log(`  >20% from cluster:  ${withDeviations.length} (${Math.round(withDeviations.length / Math.max(1, totalOpexSamples) * 100)}%)`);
  console.log();
}

main().catch(console.error);
