#!/usr/bin/env ts-node
/**
 * ARCHIVE INVENTORY SCRIPT
 * Run in Replit: npx ts-node scripts/archive-inventory.ts
 * Read-only — no DB writes. Produces all T1–T6 tables.
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface FileRow {
  id: string;
  original_filename: string;
  mime_type: string | null;
  uploaded_at: string;
}

interface DealRow {
  id: string;
  name: string;
}

// ── Property name extraction ──────────────────────────────────────────
const DOC_TYPE_WORDS = [
  'rent roll', 'rentroll', 't12', 't-12', 'trailing 12',
  'om', 'offering memorandum', 'offering_memorandum',
  'tax', 'tax bill', 'taxable', 'assessment',
  'financials', 'income statement', 'income',
  'unit mix', 'unitmix',
  'box score', 'boxscore',
  'flyer', 'brochure', 'photos',
  'lease', 'leases',
  'apinv', 'ap inv',
  'demographics', 'concession', 'concessions',
  'forecast', 'budget',
  'historical', 'history',
  'preliminary',
  'modified',
  'copy of',
  'techno',
  'summary',
  'statement',
  'detail',
  'modified',
  'select',
  'other',
  'isplural',
  'submarket',
  'market',
  'intel',
  'report',
  'overview',
  'comps',
  'rent comps',
  'q4', 'q3', 'q2', 'q1',
  // date patterns (will be handled separately)
];

const DATE_PATTERNS = [
  /\d{4}[._]\d{2}[._]\d{2}/,           // 2019.05.31, 2019_05_31
  /\d{4}[._]\d{2}/,                    // 2019.05
  /\d{6}/,                             // 080819
  /\d{2}[._]\d{2}[._]\d{2}/,          // 05.09.2018
  /\d{4}[-–—]\d{2}[-–—]\d{2}/,        // 2019-05-31
  /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // 8/26/2019, 05-09-2018
  /\(\d{4}[._]\d{2}\)/,               // (2019.05)
  /\bQ[1-4][-\–—]?\d{2,4}\b/,         // Q4-17, Q2-2019
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/i,
  /\d{4}\b/,                           // standalone year
];

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(the|at|of|on|in|by|for|a|an)\b/g, '')
    .replace(/\d+/g, '')
    .trim();
}

function exactNormalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractPropertyName(filename: string): { property: string | null; docType: string; dateStr: string | null } {
  // Strip extension
  let base = filename.replace(/\.[^.]+$/, '');

  // Try to extract date first (save it, remove from base for property extraction)
  let dateStr: string | null = null;
  for (const pat of DATE_PATTERNS) {
    const m = base.match(pat);
    if (m) {
      dateStr = m[0];
      base = base.replace(pat, ' ');
      break;
    }
  }

  // Detect doc type from keywords
  let docType = 'unknown';
  const lower = base.toLowerCase();
  if (/(rent\s*roll|rentroll)/.test(lower)) docType = 'rent_roll';
  else if (/(t12|t-12|trailing\s*12|trailing12)/.test(lower)) docType = 't12';
  else if (/(om|offering\s*memorandum|offering_memorandum)/.test(lower)) docType = 'om';
  else if (/(tax\s*bill|taxable|assessment|tax\s)/.test(lower)) docType = 'tax';
  else if (/(financials|income\s*statement|income\sstmt|income)/.test(lower)) docType = 'financials_other';
  else if (/(unit\s*mix|unitmix)/.test(lower)) docType = 'unit_mix';
  else if (/(box\s*score|boxscore)/.test(lower)) docType = 'box_score';
  else if (/(flyer|brochure|photos?)/.test(lower)) docType = 'photos';
  else if (/(apinv|ap\s*inv)/.test(lower)) docType = 'ap_invoice';
  else if (/(demographics|concession|concessions)/.test(lower)) docType = 'demographics_concessions';
  else if (/(forecast|budget)/.test(lower)) docType = 'forecast_budget';
  else if (/(lease|leases)/.test(lower)) docType = 'lease';
  else if (/(historical|history)/.test(lower)) docType = 'historical';
  else if (/(preliminary)/.test(lower)) docType = 'preliminary';
  else if (/(summary|statement)/.test(lower)) docType = 'summary';

  // Strip doc-type words and date residue
  let cleaned = base;
  for (const w of DOC_TYPE_WORDS) {
    cleaned = cleaned.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  cleaned = cleaned.replace(/\d{4}/g, ' ').replace(/\b\d+\b/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If cleaned is empty or too short, try harder
  if (!cleaned || cleaned.length < 3) {
    // Fallback: just remove obvious doc-type suffixes and dates
    cleaned = base
      .replace(/\b(rent roll|rentroll|t12|t-12|om|offering memorandum|tax bill|tax|financials|unit mix|flyer)\b/gi, ' ')
      .replace(/\d{4}[._]\d{2}[._]\d{2}/g, ' ')
      .replace(/\d{6}/g, ' ')
      .replace(/\(\d{4}[._]\d{2}\)/g, ' ')
      .trim();
  }

  const property = cleaned.length >= 2 ? cleaned.trim() : null;
  return { property, docType, dateStr };
}

function parseYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  // 2019.05.31 or 2019.05 or 2019-05-31
  let m = dateStr.match(/(\d{4})/);
  if (m) {
    const y = parseInt(m[1]);
    if (y >= 1980 && y <= 2030) return y;
  }
  // 080819 → 2019
  m = dateStr.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    let y = parseInt(m[3]);
    y = y < 50 ? 2000 + y : 1900 + y;
    return y;
  }
  // 05.09.2018
  m = dateStr.match(/(\d{4})\s*$/);
  if (m) {
    const y = parseInt(m[1]);
    if (y >= 1980 && y <= 2030) return y;
  }
  return null;
}

// ── Fuzzy match ───────────────────────────────────────────────────────
function fuzzyMatch(clusterName: string, deals: DealRow[]): { dealId: string | null; confidence: 'exact' | 'partial' | 'none' } {
  const clusterNorm = exactNormalize(clusterName);
  const clusterWords = normalizeName(clusterName).split(/\s+/).filter(w => w.length > 2);

  for (const deal of deals) {
    const dealNorm = exactNormalize(deal.name);
    if (clusterNorm === dealNorm) return { dealId: deal.id, confidence: 'exact' };
    // Substring match in either direction
    if (clusterNorm.includes(dealNorm) || dealNorm.includes(clusterNorm)) {
      // Only if meaningful length
      if (Math.max(clusterNorm.length, dealNorm.length) >= 5) {
        return { dealId: deal.id, confidence: 'partial' };
      }
    }
    // Word overlap
    const dealWords = normalizeName(deal.name).split(/\s+/).filter(w => w.length > 2);
    const overlap = clusterWords.filter(w => dealWords.includes(w));
    if (overlap.length >= 2 || (overlap.length === 1 && clusterWords.length === 1)) {
      return { dealId: deal.id, confidence: 'partial' };
    }
  }
  return { dealId: null, confidence: 'none' };
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('=== ARCHIVE INVENTORY ===\n');

  // 1. Pull the batch
  const filesRes = await pool.query<FileRow>(
    `SELECT id, original_filename, mime_type, uploaded_at
     FROM data_library_files
     WHERE scope_id = 'ARCHIVE_IMPORT_2026-05-21'
     ORDER BY original_filename`
  );
  const files = filesRes.rows;
  console.log(`Total files in batch: ${files.length}\n`);

  // Also include Axiom sentinel files if they were scoped separately
  const axiomRes = await pool.query<FileRow>(
    `SELECT id, original_filename, mime_type, uploaded_at
     FROM data_library_files
     WHERE scope_id = 'RESTRICTED_PENDING_DEAL'
       AND original_filename ILIKE '%Axiom%'
     ORDER BY original_filename`
  );
  const axiomFiles = axiomRes.rows;
  if (axiomFiles.length > 0) {
    console.log(`Including ${axiomFiles.length} Axiom sentinel files.\n`);
    files.push(...axiomFiles);
  }

  // 2. Extract and cluster
  const clusters = new Map<string, { files: Array<{id: string; filename: string; docType: string; dateStr: string|null; year: number|null}> }>();
  const unclustered: FileRow[] = [];

  for (const f of files) {
    const extracted = extractPropertyName(f.original_filename);
    if (extracted.property) {
      const normKey = normalizeName(extracted.property);
      if (!clusters.has(normKey)) clusters.set(normKey, { files: [] });
      clusters.get(normKey)!.files.push({
        id: f.id,
        filename: f.original_filename,
        docType: extracted.docType,
        dateStr: extracted.dateStr,
        year: parseYear(extracted.dateStr),
      });
    } else {
      unclustered.push(f);
    }
  }

  // ── T1: Cluster table ───────────────────────────────────────────────
  console.log('=== T1 — CLUSTER MAP ===');
  console.log('property_name | file_count | sample_filenames');
  const sortedClusters = Array.from(clusters.entries()).sort((a, b) => b[1].files.length - a[1].files.length);
  for (const [name, data] of sortedClusters) {
    const samples = data.files.slice(0, 2).map(f => f.filename).join(' | ');
    console.log(`${name} | ${data.files.length} | ${samples}`);
  }
  console.log(`\nUNCLUSTERED RESIDUE: ${unclustered.length} files`);
  if (unclustered.length > 0) {
    console.log('Sample unclustered:', unclustered.slice(0, 5).map(f => f.original_filename).join(' | '));
  }

  // ── T2: Document-type census ────────────────────────────────────────
  console.log('\n=== T2 — DOCUMENT-TYPE CENSUS ===');
  const typeCounts = new Map<string, number>();
  let omCount = 0;
  let rentRollCount = 0;
  let propertiesWithOM = new Set<string>();
  let propertiesWithOperating = new Set<string>();
  let propertiesWithBoth = new Set<string>();

  for (const [name, data] of sortedClusters) {
    const types = new Map<string, number>();
    let hasOM = false;
    let hasOperating = false;
    for (const f of data.files) {
      typeCounts.set(f.docType, (typeCounts.get(f.docType) || 0) + 1);
      types.set(f.docType, (types.get(f.docType) || 0) + 1);
      if (f.docType === 'om') hasOM = true;
      if (['rent_roll', 't12', 'financials_other', 'unit_mix', 'tax'].includes(f.docType)) hasOperating = true;
    }
    if (hasOM) {
      omCount++;
      propertiesWithOM.add(name);
    }
    if (hasOperating) propertiesWithOperating.add(name);
    if (hasOM && hasOperating) propertiesWithBoth.add(name);
  }

  console.log('\nOverall doc-type counts:');
  for (const [type, count] of Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`\nProperties with OM: ${propertiesWithOM.size}`);
  console.log(`Properties with operating docs: ${propertiesWithOperating.size}`);
  console.log(`Properties with BOTH OM + operating docs: ${propertiesWithBoth.size}`);

  console.log('\nPer-cluster matrix (property | has_om? | rent_roll_count | t12_count | other_count):');
  for (const [name, data] of sortedClusters.slice(0, 30)) {
    const types = new Map<string, number>();
    for (const f of data.files) {
      types.set(f.docType, (types.get(f.docType) || 0) + 1);
    }
    const hasOM = data.files.some(f => f.docType === 'om') ? 'Y' : 'N';
    const rr = types.get('rent_roll') || 0;
    const t12 = types.get('t12') || 0;
    const other = data.files.length - rr - t12;
    console.log(`${name} | ${hasOM} | ${rr} | ${t12} | ${other}`);
  }

  // ── T3: Temporal jackpot check ──────────────────────────────────────
  console.log('\n=== T3 — TEMPORAL JACKPOT CHECK (II.14) ===');
  let temporalCandidates = 0;
  for (const [name, data] of sortedClusters) {
    const rentRollYears = new Set<number>();
    const t12Years = new Set<number>();
    for (const f of data.files) {
      if (f.year) {
        if (f.docType === 'rent_roll') rentRollYears.add(f.year);
        if (f.docType === 't12') t12Years.add(f.year);
      }
    }
    const allYears = new Set([...rentRollYears, ...t12Years]);
    const span = allYears.size > 0 ? Math.max(...allYears) - Math.min(...allYears) : 0;
    if (span >= 2) {
      temporalCandidates++;
      console.log(`${name} | rent_roll_years=${Array.from(rentRollYears).sort().join(',')} t12_years=${Array.from(t12Years).sort().join(',')} span=${span}y`);
    }
  }
  console.log(`\nTemporal-series candidates (≥2yr span): ${temporalCandidates}`);

  // ── T4: Match against existing deals ────────────────────────────────
  console.log('\n=== T4 — MATCH AGAINST EXISTING DEALS ===');
  const dealsRes = await pool.query<DealRow>(`SELECT id, name FROM deals;`);
  const deals = dealsRes.rows;
  console.log(`Existing deals in platform: ${deals.length}\n`);

  let exactMatches = 0;
  let partialMatches = 0;
  let noMatches = 0;
  const matchDetails: Array<{cluster: string; dealId: string|null; confidence: string; dealName: string}> = [];

  for (const [name, data] of sortedClusters) {
    const match = fuzzyMatch(name, deals);
    const dealName = match.dealId ? deals.find(d => d.id === match.dealId)!.name : 'NONE';
    matchDetails.push({ cluster: name, dealId: match.dealId, confidence: match.confidence, dealName });
    if (match.confidence === 'exact') exactMatches++;
    else if (match.confidence === 'partial') partialMatches++;
    else noMatches++;
  }

  console.log('cluster | matched_deal_id | confidence | deal_name');
  for (const m of matchDetails) {
    console.log(`${m.cluster} | ${m.dealId || 'NONE'} | ${m.confidence} | ${m.dealName}`);
  }
  console.log(`\nExact matches: ${exactMatches}`);
  console.log(`Partial matches: ${partialMatches}`);
  console.log(`No match (need new shell): ${noMatches}`);

  // ── T5: Vintage profile ─────────────────────────────────────────────
  console.log('\n=== T5 — VINTAGE PROFILE ===');
  const allYears: number[] = [];
  for (const [, data] of sortedClusters) {
    for (const f of data.files) {
      if (f.year) allYears.push(f.year);
    }
  }
  const pre2020 = allYears.filter(y => y < 2020).length;
  const y2020plus = allYears.filter(y => y >= 2020).length;
  const yearDist = new Map<number, number>();
  for (const y of allYears) yearDist.set(y, (yearDist.get(y) || 0) + 1);
  console.log('Year distribution (docs with extractable dates):');
  for (const [year, count] of Array.from(yearDist.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${year}: ${count}`);
  }
  console.log(`\nPre-2020: ${pre2020} docs (${allYears.length > 0 ? Math.round(pre2020/allYears.length*100) : 0}%)`);
  console.log(`2020+: ${y2020plus} docs (${allYears.length > 0 ? Math.round(y2020plus/allYears.length*100) : 0}%)`);
  console.log(`Docs with no extractable date: ${files.length - allYears.length}`);

  // ── T6: Sizing Summary ──────────────────────────────────────────────
  console.log('\n=== T6 — SIZING SUMMARY ===');
  console.log('| Metric | Count |');
  console.log('|---|---|');
  console.log(`| Total files | ${files.length} |`);
  console.log(`| Clustered files | ${files.length - unclustered.length} |`);
  console.log(`| Unclustered residue | ${unclustered.length} |`);
  console.log(`| Distinct properties (clusters) | ${clusters.size} |`);
  console.log(`| Properties with an OM | ${propertiesWithOM.size} |`);
  console.log(`| Properties with OM + operating docs | ${propertiesWithBoth.size} |`);
  console.log(`| Temporal-series candidates (≥2yr rent-roll span) | ${temporalCandidates} |`);
  console.log(`| Clusters matching existing deals (exact) | ${exactMatches} |`);
  console.log(`| Clusters matching existing deals (partial) | ${partialMatches} |`);
  console.log(`| Clusters needing new shells | ${noMatches} |`);
  console.log(`| Corpus pre-2020 | ${pre2020} (${allYears.length > 0 ? Math.round(pre2020/allYears.length*100) : 0}%) |`);
  console.log(`| Corpus 2020+ | ${y2020plus} (${allYears.length > 0 ? Math.round(y2020plus/allYears.length*100) : 0}%) |`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
