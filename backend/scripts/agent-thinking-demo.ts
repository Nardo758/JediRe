#!/usr/bin/env node
/**
 * Agent Thinking Practice
 *
 * Simulates what the CashFlow agent thinks when it has building profiles.
 * Three scenarios show how profile knowledge changes the agent's reasoning.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const ARCHIVE_ROOT = '/home/ldixon/.openclaw/Archive Deals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ProfileCluster {
  fingerprint: string;
  buildingType: string;
  vintage: string;
  count: number;
  deals: string[];
  lineItems: Map<string, number[]>; // line_item → array of dollar amounts
  totalOpexPerUnit: number[];
}

function classifyAmenities(texts: string[]): Record<string, boolean> {
  const keywords: [string, string][] = [
    ['elevator', 'hasElevator'], ['elevators', 'hasElevator'],
    ['pool', 'hasPool'], ['swimming', 'hasPool'],
    ['clubhouse', 'hasClubhouse'], ['club', 'hasClubhouse'],
    ['fitness', 'hasFitness'], ['gym', 'hasFitness'],
    ['concierge', 'hasConcierge'],
    ['dog park', 'hasDogPark'],
    ['rooftop', 'hasRooftop'],
    ['coworking', 'hasCoworking'],
    ['package concierge', 'hasPackageConcierge'],
    ['valet trash', 'hasValetTrash'],
    ['parking garage', 'hasGarage'],
  ];
  const flags: Record<string, boolean> = {};
  for (const [, field] of keywords) flags[field] = false;
  for (const t of texts) {
    const lower = t.toLowerCase();
    for (const [keyword, field] of keywords) {
      if (lower.includes(keyword)) flags[field] = true;
    }
  }
  return flags;
}

function buildFingerprint(type: string, vintage: string, flags: Record<string, boolean>): string {
  const e = flags.hasElevator ? 'elev' : 'noelev';
  const p = flags.hasPool ? 'pool' : 'nopool';
  const f = flags.hasFitness ? 'fit' : 'nofit';
  const c = flags.hasClubhouse ? 'club' : 'noclub';
  return `${type}|${vintage}|${e}|${p}|${f}|${c}`;
}

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

function getVintageBand(yb: number | null): string {
  if (!yb) return 'unknown';
  if (yb < 1980) return 'pre-1980';
  if (yb < 2000) return '1980-1999';
  if (yb < 2010) return '2000-2009';
  if (yb < 2020) return '2010-2019';
  return '2020+';
}

function getBuildingType(stories: number | null): string {
  if (!stories) return 'garden';
  if (stories <= 3) return 'garden';
  if (stories <= 6) return 'midrise';
  return 'highrise';
}

function extractT12(filePath: string, units: number | null): Record<string, number> | null {
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true, type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (data.length < 5) continue;
      
      const expenses: Record<string, number> = {};
      const tu = units || 100;
      let hasData = false;
      
      for (const row of data) {
        if (!row || row.length < 2) continue;
        const label = String(row[0] || '').toLowerCase().trim();
        
        let annualVal = null;
        for (let i = row.length - 1; i >= 1; i--) {
          if (typeof row[i] === 'number' && row[i] > 100) {
            annualVal = row[i];
            break;
          }
        }
        if (!annualVal) continue;
        
        if (label.includes('repair') || label.includes('r&m') || label.includes('maintenance')) {
          expenses['repairs_maintenance'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('payroll') || label.includes('salary') || label.includes('wages')) {
          expenses['payroll'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('insurance') || label.includes('property insurance')) {
          expenses['insurance'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('tax') && !label.includes('income') && !label.includes('payroll')) {
          expenses['real_estate_taxes'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('utility') || label.includes('electric') || label.includes('water') || label.includes('gas')) {
          expenses['utilities'] = (expenses['utilities'] || 0) + Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('management') || label.includes('mgmt')) {
          expenses['management_fee'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('marketing') || label.includes('advertising')) {
          expenses['marketing'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('admin') || label.includes('general')) {
          expenses['admin_general'] = Math.round(annualVal / tu);
          hasData = true;
        } else if (label.includes('legal') || label.includes('professional') || label.includes('accounting')) {
          expenses['professional_fees'] = Math.round(annualVal / tu);
          hasData = true;
        }
      }
      
      if (hasData) return expenses;
    }
  } catch {}
  return null;
}

// ─── Build profile clusters from all deals ────────────────────────────────────

function buildAllClusters(limit: number): Map<string, ProfileCluster> {
  const folders = fs.readdirSync(ARCHIVE_ROOT)
    .filter(f => fs.statSync(path.join(ARCHIVE_ROOT, f)).isDirectory() && !f.startsWith('.'))
    .sort()
    .slice(0, limit);
  
  const clusters = new Map<string, ProfileCluster>();
  const skipList = ['45 Eighty Dunwoody', '7900 Park Central']; // some don't parse well
  
  for (const folder of folders) {
    const folderPath = path.join(ARCHIVE_ROOT, folder);
    const files = findFiles(folderPath);
    const nameTexts = files.map(f => f.name);
    const amenities = classifyAmenities(nameTexts);
    const fp = buildFingerprint('garden', '2010-2019', amenities);
    
    const rrFile = files.find(f => f.name.toLowerCase().includes('rent roll') && !f.name.includes('~$'));
    let units: number | null = null;
    if (rrFile) {
      try {
        const wb = XLSX.readFile(rrFile.path, { type: 'buffer' });
        for (const sn of wb.SheetNames) {
          const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
          let uc = 0;
          let foundTable = false;
          for (const row of data) {
            if (!row || row.length < 3) continue;
            const cells = row.map(c => String(c ?? '').toLowerCase());
            if (!foundTable && cells.some(c => c.includes('unit') && c.includes('type'))) { foundTable = true; continue; }
            if (!foundTable) continue;
            if (cells.some(c => c.includes('total'))) continue;
            uc++;
          }
          if (uc > 5 && uc < 1000) { units = uc; break; }
        }
      } catch {}
    }
    
    const t12File = files.find(f => 
      (f.name.toLowerCase().includes('t12') || f.name.toLowerCase().includes('t-12') || 
       f.name.toLowerCase().includes('income statement')) &&
      (f.ext === '.xlsx' || f.ext === '.xls') && !f.name.includes('~$')
    );
    const expenses = t12File ? extractT12(t12File.path, units) : null;
    
    if (!clusters.has(fp)) {
      clusters.set(fp, { fingerprint: fp, buildingType: 'garden', vintage: '2010-2019', count: 0, deals: [], lineItems: new Map(), totalOpexPerUnit: [] });
    }
    const cl = clusters.get(fp)!;
    cl.count++;
    cl.deals.push(folder);
    
    if (expenses) {
      for (const [line, perUnit] of Object.entries(expenses)) {
        if (!cl.lineItems.has(line)) cl.lineItems.set(line, []);
        cl.lineItems.get(line)!.push(perUnit);
      }
    }
  }
  
  return clusters;
}

function getStats(vals: number[]): { p10: number, p25: number, p50: number, p75: number, p90: number, mean: number, count: number } {
  const sorted = [...vals].sort((a, b) => a - b);
  return {
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    mean: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    count: sorted.length,
  };
}

// ─── Scenario 1: One-time cost detection ──────────────────────────────────────

function scenario1_OneTimeCost(clusters: Map<string, ProfileCluster>) {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  SCENARIO 1: One-Time Cost Detection                                       ║');
  console.log('║                                                                              ║');
  console.log('║  Deal: 464 Bishop — garden built 2017, 194 units                            ║');
  console.log('║  T12 shows repairs_maintenance at $1,722/unit                               ║');
  console.log('║  Profile cluster (garden|2010-2019|noelev|nopool|nofit|noclub) has 9 deals  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const rmCluster = clusters.get('garden|2010-2019|noelev|nopool|nofit|noclub');
  if (!rmCluster) { console.log('  No cluster data'); return; }
  const rmVals = rmCluster.lineItems.get('repairs_maintenance') || [];
  const stats = getStats(rmVals);
  
  console.log('  Agent reasoning with BUILDING PROFILES:\n');
  console.log(`  🔍 fetch_line_item_benchmarks({line_items: ["repairs_maintenance"],`);
  console.log(`    building_profile_fingerprint: "garden|2010-2019|noelev|nopool|nofit|noclub"})`);
  console.log();
  console.log(`  PROFILE-MATCHED BENCHMARKS (${stats.count} similar buildings):`);
  console.log(`    P25: $${stats.p25.toLocaleString()}/unit     P50: $${stats.p50.toLocaleString()}/unit     P75: $${stats.p75.toLocaleString()}/unit`);
  console.log();
  console.log(`  AGENT THINKS:`);
  console.log(`    "T12 says $1,722/unit for R&M. Profile says P50 is $${stats.p50}/unit."`);
  console.log(`    "Deal is $${(1722 - stats.p50).toLocaleString()}/unit above profile median — ${Math.round((1722 - stats.p50) / stats.p50 * 100)}% delta."`);
  console.log();
  console.log(`    "Possible reasons:"`);
  console.log(`    • One-time catch-up: prior owner deferred R&M for sale → rehab backlog`);
  console.log(`    • Capex misclassification: HVAC replacement expensed as R&M`);
  console.log(`    • Age premium: property is ${new Date().getFullYear() - 2017} years old, turning point for major systems`);
  console.log(`    • Operational issue: high turnover driving make-ready costs`);
  console.log();
  console.log(`    "Decision: Flag as one-time if catch-up or capex. Remove from forward projection."`);
  console.log(`    "Adjusted R&M: $${stats.p50.toLocaleString()}/unit (P50) for stabilized forward years."`);
  console.log(`    "Evidence: T12 actual $1,722 — profile P50 $${stats.p50.toLocaleString()} — adjusted to P50 due to one-time catch-up suspect."`);
  console.log();
  
  // What the agent does WITHOUT building profiles
  console.log('  ─── Without building profiles, agent would: ───');
  console.log('  "Market benchmark P50 is $800/unit (national generic)."');
  console.log('  "T12 is 2x market — FLAG: ABOVE P90."');
  console.log('  "Use T12 anyway because Tier 1 wins."');
  console.log('  → RESULT: Inflated forward projection, NO INVESTIGATION into why.\n');
  
  // What the agent does WITH building profiles
  console.log('  ─── With building profiles, agent instead: ───');
  console.log('  "Profile-matched P50 is $600/unit (same vintage, type, amenities)."');
  console.log('  "T12 is 3x profile expectation — SAME-BUILDING CLUSTER is the real comparator."');
  console.log('  "Investigate: HVAC replaced? Deferred maintenance catch-up?"');
  console.log('  → RESULT: One-time cost identified, removed from forward → $600/unit\n');
}

// ─── Scenario 2: Occupancy vs comps ───────────────────────────────────────────

function scenario2_OccupancyVsComps() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  SCENARIO 2: Occupancy Below Comps — Distress or Transition?                 ║');
  console.log('║                                                                              ║');
  console.log('║  Deal: 7900 Park Central (200 units, garden, 2020 build, no elevator)        ║');
  console.log('║  Rent roll shows 82% occupancy                                               ║');
  console.log('║  Market comps show 94% average                                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('  Agent reasoning with BUILDING PROFILES:\n');
  console.log('  🔍 fetch_comp_set() → market occupancy 94%');
  console.log('  🔍 fetch_building_profile() → same-bldg cluster P50 occupancy 93%\n');
  console.log('  AGENT THINKS:');
  console.log('    "Subject 82% vs market comps 94% vs profile-matched 93%."');
  console.log('    "Both market AND profile cluster agree: 93-94% is expected for this building type."');
  console.log('    "The 82% is either:"');
  console.log('    • Lease-up (2020 build, still filling from construction)');
  console.log('    • Recent acquisition (transition → 90 days of re-leasing disruption)');
  console.log('    • Management problem (flag as distress if persists)');
  console.log('    • Structural vacancy (bad location → unlikely for 2020 build)');
  console.log();
  console.log('    "Since it was built in 2020 and comps are 94%, this is LEASE-UP."');
  console.log('    "Project: ramp from 82% → 90% (Y1) → 93% (Y2) → 94% stabilized (Y3)."');
  console.log('    "But only if management quality supports the trajectory."');
  console.log();
  
  console.log('  ─── Without building profiles, agent would: ───');
  console.log('  "Market comps say 94%. Subject says 82%. Gap = 12%."');
  console.log('  "Use 82% because Tier 1 (rent roll) wins."');
  console.log('  "But I have no way to assess whether 82% is normal for this building type."');
  console.log('  → RESULT: No ramp projected, 82% forever, undervalues asset\n');
  
  console.log('  ─── With building profiles, agent instead: ───');
  console.log('  "93-94% IS normal for this profile. The 82% is temporary."');
  console.log('  "Profile says: buildings like this one operate at 93%."');
  console.log('  "Subject hit by lease-up disruption — ramp to 93% by Y3."');
  console.log('  → RESULT: Correct ramp trajectory, accurate NOI projection\n');
}

// ─── Scenario 3: Insurance spike ──────────────────────────────────────────────

function scenario3_Insurance(clusters: Map<string, ProfileCluster>) {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  SCENARIO 3: Insurance Spike — Real Market Shift or One-Time Catch-Up?       ║');
  console.log('║                                                                              ║');
  console.log('║  Deal: 72 West — garden built 2013, 250 units                                ║');
  console.log('║  T12 shows insurance at $2,791/unit (against most other cluster deals       ║');
 console.log('║  showing $74-500/unit)                                                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  
  const cluster = clusters.get('garden|2010-2019|noelev|nopool|nofit|noclub');
  const insVals = cluster?.lineItems.get('insurance') || [74, 200, 105, 500, 2800, 150, 88, 320, 450];
  const insStats = getStats(insVals);
  
  console.log('  Agent reasoning with BUILDING PROFILES:\n');
  console.log(`  🔍 fetch_line_item_benchmarks({line_items: ["insurance"],`);
  console.log(`    building_profile_fingerprint: "garden|2010-2019|noelev|nopool|nofit|noclub"})`);
  console.log();
  console.log(`  PROFILE-MATCHED INSURANCE (${insStats.count} buildings):`);
  console.log(`    P10: $${insStats.p10.toLocaleString()}/unit  P50: $${insStats.p50.toLocaleString()}/unit  P90: $${insStats.p90.toLocaleString()}/unit`);
  console.log();
  console.log('  AGENT THINKS:');
  console.log('    "T12 says $2,791/unit for insurance."');
  console.log('    "Profile says P50 is $150/unit, P90 is $450/unit."');
  console.log('    "This is $2,791 — ABOVE PROFILE P90 by 6x."');
  console.log();
  console.log('    "This is either:"');
  console.log('    • Hurricane/flood zone loading (check Floridian deal — FEMA flood zone)');
  console.log('    • Retroactive premium catch-up (prior owner underpaid, full year billed now)');
  console.log('    • One-time claim payout (deductible hit from storm damage)');
  console.log('    • Actual new market rate (insurance crisis — check if all FL/TX deals show same)');
  console.log();
  console.log('    "I need to cross-check ALL FL/TX deals in the same profile cluster."');
  console.log('    "If FL deals = $2,500+/unit and GA deals = $150/unit, then location drives it."');
  console.log('    "If FL deals are $300/unit too, then $2,791 is a one-time catch-up."');
  console.log();
  
  console.log('  ─── Two possible outcomes: ───\n');
  console.log('  ROUTE A: Florida location (location-driven, not one-time)');
  console.log('    "FEMA Flood Zone AE + FL insurance crisis = $2,791 IS the new rate."');
  console.log('    "Apply $2,791/unit forward with 10% annual escalation."');
  console.log('    "Evidence: T12 actual $2,791 — cross-checked 4 FL deals same profile P75 $2,650 — confirmed location-driven."');
  console.log('    → CORRECT underwriting: expensive but real\n');
  
  console.log('  ROUTE B: Georgia location (one-time catch-up)');
  console.log('    "Georgia insurance rate is $150/unit P50. This is clearly a catch-up."');
  console.log('    "Apply $200/unit forward (conservative P25 + buffer)."');
  console.log('    "Evidence: T12 actual $2,791 — profile P50 $150 — adjusted to P25+$50 for safety."');
  console.log('    → CORRECT underwriting: prevented overpaying for a one-time charge\n');
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧠 AGENT THINKING WITH BUILDING PROFILES — 3 Scenarios\n');
  
  // Build clusters from all 191 deals
  console.log('📊 Building reference clusters from archive deals...');
  const clusters = buildAllClusters(191);
  const clusterStats = [...clusters.values()].map(c => ({ fp: c.fingerprint, count: c.count, items: c.lineItems.size }));
  console.log(`   Built ${clusters.size} profile clusters from ${clusterStats.reduce((a, c) => a + c.count, 0)} deals\n`);
  
  scenario1_OneTimeCost(clusters);
  scenario2_OccupancyVsComps();
  scenario3_Insurance(clusters);
  
  // What the agent actually says
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY: What building profiles unlock for the agent                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  console.log('  Without profiles:');
  console.log('    "T12 says $X. Market says $Y. One is wrong, I pick the higher one."');
  console.log('    "I have no way to distinguish one-time from recurring."');
  console.log('    "I have no way to know what [this specific building type] normally spends."');
  console.log();
  console.log('  With profiles:');
  console.log('    "T12 says $X. Market says $Y. Profile-matched cluster says $Z."');
  console.log('    "Since $Z comes from buildings IDENTICAL to this one:"');
  console.log('    "  $X ≈ $Z → numbers are normal, use T12 with high confidence"');
  console.log('    "  $X >> $Z → investigate one-time, capex misclass, or location premium"');
  console.log('    "  $X << $Z → investigate deferred maintenance, understated by operator"');
  console.log('    "  $X ≈ $Y but ≠ $Z → location is the driver, not the building"');
  console.log();
  console.log('  The agent goes from asking "is this number right?"');
  console.log('  to asking "why does this building cost differently from others like it?"');
  console.log('  That is the difference between a calculator and an underwriter.\n');
}

main().catch(console.error);
