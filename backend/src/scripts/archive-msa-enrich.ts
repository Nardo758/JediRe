/**
 * F9 Archive Seeding — Session 3: MSA / Geography / Year-Built Enrichment
 *
 * Scans property folder names and OM content to infer:
 *   - MSA (metropolitan statistical area)
 *   - State abbreviation
 *   - Year built (from OM documents, tax bills, or folder name)
 *
 * Outputs a JSON enrichment manifest that can be uploaded alongside
 * corpus observations to fill parcel-level metadata columns.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-msa-enrich.ts
 *
 * Flags:
 *   --output path/to/output.json    (default: archive-msa-enrichment.json)
 */

import * as fs from 'fs';
import * as path from 'path';
import { classifyDocument } from '../services/document-extraction/classifier';
import type { DocumentType } from '../services/document-extraction/types';

// ─── Config ─────────────────────────────────────────────────────────────────

const ARCHIVE_ROOT = process.env.ARCHIVE_ROOT ||
  path.resolve(
    process.env.HOME || process.env.USERPROFILE || 'C:\\Users\\Leon',
    'OneDrive - Myers Apartment Group\\Deals\\Archive',
  );

const OUTPUT_FILE = (() => {
  const idx = process.argv.indexOf('--output');
  return idx >= 0 ? process.argv[idx + 1] : 'archive-msa-enrichment.json';
})();

// ─── Known MSA patterns — Myers Apartment Group is Atlanta-based ────────────

interface MsaEntry {
  msa: string;
  state: string;
  cbsaCode?: string;
}

const MSA_PATTERNS: Array<{ patterns: RegExp[]; msa: string; state: string; cbsaCode: string }> = [
  { patterns: [/atlanta/i, /roswell/i, /sandy springs/i, /marietta/i, /dunwoody/i, /alpharetta/i, /cobb/i, /gwinnett/i, /dekalb/i, /fulton/i, /clayton/i], msa: 'Atlanta-Sandy Springs-Roswell, GA', state: 'GA', cbsaCode: '12060' },
  { patterns: [/charlotte/i, /gastonia/i, /concord/i, /pineville/i, /ballantyne/i, /matthews/i, /fort mill/i], msa: 'Charlotte-Concord-Gastonia, NC-SC', state: 'NC', cbsaCode: '16740' },
  { patterns: [/raleigh/i, /durham/i, /chapel hill/i, /cary/i, /morrisville/i, /fuquay/i, /garner/i, /apex/i, /holly springs/i], msa: 'Raleigh-Cary, NC', state: 'NC', cbsaCode: '39580' },
  { patterns: [/miami/i, /fort lauderdale/i, /west palm beach/i, /boca raton/i, /dania/i], msa: 'Miami-Fort Lauderdale-West Palm Beach, FL', state: 'FL', cbsaCode: '33100' },
  { patterns: [/dallas/i, /fort worth/i, /arlington/i, /plano/i, /frisco/i, /irving/i, /garland/i, /mesquite/i, /carrollton/i, /pflugerville/i], msa: 'Dallas-Fort Worth-Arlington, TX', state: 'TX', cbsaCode: '19100' },
  { patterns: [/nashville/i, /murfreesboro/i, /franklin/i, /gallatin/i, /brentwood/i, /hendersonville/i], msa: 'Nashville-Davidson-Murfreesboro-Franklin, TN', state: 'TN', cbsaCode: '34980' },
  { patterns: [/jacksonville/i, /nocatee/i, /st johns/i, /duval/i], msa: 'Jacksonville, FL', state: 'FL', cbsaCode: '27260' },
  { patterns: [/orlando/i, /kissimmee/i, /sanford/i, /altamonte/i, /winter park/i, /maitland/i], msa: 'Orlando-Kissimmee-Sanford, FL', state: 'FL', cbsaCode: '36740' },
  { patterns: [/austin/i, /round rock/i, /georgetown/i, /cedar park/i], msa: 'Austin-Round Rock-Georgetown, TX', state: 'TX', cbsaCode: '12420' },
  { patterns: [/birmingham/i, /hoover/i], msa: 'Birmingham-Hoover, AL', state: 'AL', cbsaCode: '13820' },
  { patterns: [/tampa/i, /st\.? petersburg/i, /clearwater/i], msa: 'Tampa-St. Petersburg-Clearwater, FL', state: 'FL', cbsaCode: '45300' },
  { patterns: [/denver/i, /aurora/i, /lakewood/i], msa: 'Denver-Aurora-Lakewood, CO', state: 'CO', cbsaCode: '19740' },
  { patterns: [/phoenix/i, /mesa/i, /scottsdale/i], msa: 'Phoenix-Mesa-Chandler, AZ', state: 'AZ', cbsaCode: '38060' },
  { patterns: [/houston/i, /woodlands/i, /sugar land/i], msa: 'Houston-The Woodlands-Sugar Land, TX', state: 'TX', cbsaCode: '26420' },
  { patterns: [/san antonio/i, /new braunfels/i], msa: 'San Antonio-New Braunfels, TX', state: 'TX', cbsaCode: '41700' },
  { patterns: [/columbus/i, /grove city/i], msa: 'Columbus, OH', state: 'OH', cbsaCode: '18140' },
  { patterns: [/greenville/i, /spartanburg/i, /anderson/i], msa: 'Greenville-Anderson-Spartanburg, SC', state: 'SC', cbsaCode: '24860' },
  { patterns: [/knoxville/i], msa: 'Knoxville, TN', state: 'TN', cbsaCode: '28940' },
  { patterns: [/memphis/i], msa: 'Memphis, TN-MS-AR', state: 'TN', cbsaCode: '32820' },
  { patterns: [/baltimore/i, /columbia/i, /towson/i], msa: 'Baltimore-Columbia-Towson, MD', state: 'MD', cbsaCode: '12580' },
  { patterns: [/richmond/i, /petersburg/i], msa: 'Richmond, VA', state: 'VA', cbsaCode: '40060' },
  { patterns: [/norfolk/i, /virginia beach/i, /newport news/i], msa: 'Virginia Beach-Norfolk-Newport News, VA-NC', state: 'VA', cbsaCode: '47260' },
  { patterns: [/savannah/i], msa: 'Savannah, GA', state: 'GA', cbsaCode: '42340' },
  { patterns: [/indianapolis/i, /carmel/i, /anderson/i], msa: 'Indianapolis-Carmel-Anderson, IN', state: 'IN', cbsaCode: '26900' },
  { patterns: [/louisville/i, /jefferson/i], msa: 'Louisville/Jefferson County, KY-IN', state: 'KY', cbsaCode: '31140' },
  { patterns: [/kansas city/i], msa: 'Kansas City, MO-KS', state: 'MO', cbsaCode: '28140' },
  { patterns: [/chicago/i, /naperville/i, /elgin/i], msa: 'Chicago-Naperville-Elgin, IL-IN-WI', state: 'IL', cbsaCode: '16980' },
  { patterns: [/seattle/i, /tacoma/i, /bellevue/i], msa: 'Seattle-Tacoma-Bellevue, WA', state: 'WA', cbsaCode: '42660' },
  { patterns: [/los angeles/i, /long beach/i, /anaheim/i], msa: 'Los Angeles-Long Beach-Anaheim, CA', state: 'CA', cbsaCode: '31080' },
  { patterns: [/san diego/i, /chula vista/i, /escondido/i], msa: 'San Diego-Chula Vista-Carlsbad, CA', state: 'CA', cbsaCode: '41740' },
];

// State-level fallback patterns
const STATE_PATTERNS: Array<{ patterns: RegExp[]; state: string }> = [
  { patterns: [/\bGA\b/i, /georgia/i], state: 'GA' },
  { patterns: [/\bNC\b/i, /north carolina/i], state: 'NC' },
  { patterns: [/\bFL\b/i, /florida/i], state: 'FL' },
  { patterns: [/\bTX\b/i, /texas/i], state: 'TX' },
  { patterns: [/\bTN\b/i, /tennessee/i], state: 'TN' },
  { patterns: [/\bSC\b/i, /south carolina/i], state: 'SC' },
  { patterns: [/\bAL\b/i, /alabama/i], state: 'AL' },
  { patterns: [/\bCA\b/i, /california/i], state: 'CA' },
  { patterns: [/\bCO\b/i, /colorado/i], state: 'CO' },
  { patterns: [/\bAZ\b/i, /arizona/i], state: 'AZ' },
  { patterns: [/\bOH\b/i, /ohio/i], state: 'OH' },
  { patterns: [/\bMD\b/i, /maryland/i], state: 'MD' },
  { patterns: [/\bVA\b/i, /virginia/i], state: 'VA' },
  { patterns: [/\bIN\b/i, /indiana/i], state: 'IN' },
  { patterns: [/\bKY\b/i, /kentucky/i], state: 'KY' },
  { patterns: [/\bWA\b/i, /washington/i], state: 'WA' },
  { patterns: [/\bIL\b/i, /illinois/i], state: 'IL' },
  { patterns: [/\bMO\b/i, /missouri/i], state: 'MO' },
  { patterns: [/\bTN\b/i, /tennessee/i], state: 'TN' },
];

// Year built patterns commonly found in OM documents
const YEAR_BUILT_PATTERNS = [
  /year\s*built:?\s*(\d{4})/i,
  /built\s*in\s*(\d{4})/i,
  /constructed\s*(\d{4})/i,
  /built\s*(\d{4})/i,
  /vintage\s*(\d{4})/i,
  /completed\s*(\d{4})/i,
  /year\s*of\s*construction:?\s*(\d{4})/i,
  /year\s*built\s*\(?y[bB]\)?\s*:?\s*(\d{4})/i,
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyEnrichment {
  folderName: string;
  msa: string | null;
  state: string | null;
  cbsaCode: string | null;
  yearBuilt: number | null;
  msaSource: 'folder_name' | 'om_doc' | 'state_pattern' | 'unresolved';
  yearBuiltSource: 'om_doc' | 'tax_bill' | 'folder_name' | null;
  folderNameHasLocation: boolean;
  omFiles: number;
  taxBillFiles: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(level: string, msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`);
}

function matchMsa(name: string, text?: string): { msa: string; state: string; cbsaCode: string } | null {
  const searchText = [name, text].filter(Boolean).join(' ');
  for (const entry of MSA_PATTERNS) {
    for (const p of entry.patterns) {
      if (p.test(searchText)) {
        return { msa: entry.msa, state: entry.state, cbsaCode: entry.cbsaCode };
      }
    }
  }
  // Try state-level fallback
  for (const entry of STATE_PATTERNS) {
    for (const p of entry.patterns) {
      if (p.test(searchText)) {
        return { msa: `Unknown (${entry.state})`, state: entry.state, cbsaCode: '' };
      }
    }
  }
  return null;
}

function extractYearBuilt(text: string): number | null {
  for (const p of YEAR_BUILT_PATTERNS) {
    const m = p.exec(text);
    if (m) {
      const yr = parseInt(m[1], 10);
      if (yr >= 1950 && yr <= 2025) return yr;
    }
  }
  return null;
}

function hasLocationInName(name: string): boolean {
  // Check if the name already contains a known location keyword
  for (const entry of MSA_PATTERNS) {
    for (const p of entry.patterns) {
      if (p.test(name)) return true;
    }
  }
  // Check for common location suffixes
  return /\b(GA|NC|FL|TX|TN|SC|AL|CA|CO|AZ|OH|MD|VA|IN|KY|WA|IL|MO)\b/i.test(name);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('info', '=== F9 Archive Seeding — Session 3: MSA / Vintage Enrichment ===');
  log('info', `  Archive: ${ARCHIVE_ROOT}`);
  log('info', `  Output:  ${OUTPUT_FILE}`);
  log('info', '');

  if (!fs.existsSync(ARCHIVE_ROOT)) {
    log('error', `Archive root not found: ${ARCHIVE_ROOT}`);
    process.exit(1);
  }

  const folders = fs.readdirSync(ARCHIVE_ROOT)
    .filter(name => {
      const fp = path.join(ARCHIVE_ROOT, name);
      return fs.statSync(fp).isDirectory() && !name.startsWith('__') && !name.startsWith('._');
    })
    .sort((a, b) => a.localeCompare(b));

  log('info', `Found ${folders.length} property folders`);

  const results: PropertyEnrichment[] = [];
  let msaFromFolder = 0;
  let msaFromOm = 0;
  let msaUnresolved = 0;
  let withYearBuilt = 0;

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const folderPath = path.join(ARCHIVE_ROOT, folder);
    const enrichment: PropertyEnrichment = {
      folderName: folder,
      msa: null,
      state: null,
      cbsaCode: null,
      yearBuilt: null,
      msaSource: 'unresolved',
      yearBuiltSource: null,
      folderNameHasLocation: false,
      omFiles: 0,
      taxBillFiles: 0,
    };

    // Step 1: Try folder name
    const folderMsa = matchMsa(folder);
    if (folderMsa) {
      enrichment.msa = folderMsa.msa;
      enrichment.state = folderMsa.state;
      enrichment.cbsaCode = folderMsa.cbsaCode;
      enrichment.msaSource = 'folder_name';
      enrichment.folderNameHasLocation = hasLocationInName(folder);
      msaFromFolder++;
    }

    // Step 2: Scan OM files for address/geography and year built
    try {
      const files = fs.readdirSync(folderPath, { recursive: false });
      const omFiles = files.filter(f => /\.(pdf|doc|docx)$/i.test(f) && /om|offering.*memorandum/i.test(f));
      const taxFiles = files.filter(f => /tax|assessment/i.test(f) && /\.(pdf|xlsx|xls)$/i.test(f));
      enrichment.omFiles = omFiles.length;
      enrichment.taxBillFiles = taxFiles.length;

      // Try OM files (PDF) — quick text scan for city/state and year built
      for (const omFile of [...omFiles, ...taxFiles].slice(0, 3)) {
        const omPath = path.join(folderPath, omFile);
        const ext = path.extname(omFile).toLowerCase();
        
        if (ext === '.pdf') {
          try {
            const buf = fs.readFileSync(omPath);
            // For PDFs, try simple text extraction
            const text = buf.toString('utf-8').replace(/\0/g, ' ').slice(0, 50000);
            
            if (!enrichment.msa) {
              const omMsa = matchMsa(folder, text);
              if (omMsa) {
                enrichment.msa = omMsa.msa;
                enrichment.state = omMsa.state;
                enrichment.cbsaCode = omMsa.cbsaCode;
                enrichment.msaSource = 'om_doc';
                msaFromOm++;
              }
            }

            if (!enrichment.yearBuilt) {
              const yr = extractYearBuilt(text);
              if (yr) {
                enrichment.yearBuilt = yr;
                enrichment.yearBuiltSource = ext.includes('tax') ? 'tax_bill' : 'om_doc';
                withYearBuilt++;
              }
            }
          } catch {
            // skip unreadable PDFs
          }
        } else if (ext === '.xlsx' || ext === '.xls') {
          // XLSX tax bills — skip for now (would need xlsx library)
        }
      }
    } catch {
      // directory read error
    }

    if (!enrichment.msa) {
      msaUnresolved++;
    }

    results.push(enrichment);

    if ((i + 1) % 50 === 0) {
      log('info', `  Progress: ${i + 1}/${folders.length} (${Math.round((i + 1) / folders.length * 100)}%)`);
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  log('info', '');
  log('info', `=== MSA / VINTAGE ENRICHMENT COMPLETE ===`);
  log('info', `  Total properties:     ${folders.length}`);
  log('info', `  MSA from folder name: ${msaFromFolder}`);
  log('info', `  MSA from OM doc:      ${msaFromOm}`);
  log('info', `  MSA unresolved:       ${msaUnresolved}`);
  log('info', `  Year built found:     ${withYearBuilt}`);
  log('info', '');

  // Log unresolved properties
  const unresolved = results.filter(r => !r.msa);
  if (unresolved.length > 0) {
    log('info', `  Unresolved properties (${unresolved.length}):`);
    for (const r of unresolved.slice(0, 20)) {
      log('info', `    ${r.folderName} — OM files: ${r.omFiles}, Tax: ${r.taxBillFiles}`);
    }
    if (unresolved.length > 20) {
      log('info', `    ... and ${unresolved.length - 20} more`);
    }
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  log('info', `\n  Wrote ${results.length} enrichment records to ${OUTPUT_FILE}`);

  // Also output a simplified manifest suitable for HTTP upload
  const manifest = results.map(r => ({
    parcel_id: r.folderName,
    msa: r.msa,
    state: r.state,
    cbsa_code: r.cbsaCode,
    year_built: r.yearBuilt,
    msa_source: r.msaSource,
    year_built_source: r.yearBuiltSource,
  }));
  const manifestPath = OUTPUT_FILE.replace('.json', '-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log('info', `  Wrote HTTP-ready manifest to ${manifestPath}`);
}

main().catch(err => {
  log('error', `Fatal: ${err.message}`);
  process.exit(1);
});
