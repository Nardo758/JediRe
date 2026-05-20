/**
 * F9 Archive Seeding — Session 2: Bulk Ingestion Runner
 *
 * Walks the 296-property archive folder tree (`Deals/Archive`),
 * classifies each file by type (T12, rent roll, tax bill, leasing stats, etc.),
 * routes to the appropriate parser, and writes results to the corpus
 * (historical_observations) and document tables (deal_monthly_actuals).
 *
 * Architecture:
 *
 *   Walk 296 folders
 *   ├─ For each property folder:
 *   │   ├─ Detect property identity (folder name → property_id mapping)
 *   │   ├─ Enumerate documents
 *   │   ├─ For each document:
 *   │   │   ├─ classifyDocument(filename, buffer) → DocumentType
 *   │   │   ├─ parseBuffer(docType, buffer) → ExtractionResult
 *   │   │   └─ routeToCorpus(docType, result, dealId) → corpus row(s)
 *   │   └─ Log progress: "[42/296] Property X — 8 docs ingested, 1 skipped"
 *   └─ Final report: properties clean / partial / skipped, total rows written
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-bulk-ingest.ts
 *
 * Flags:
 *   --dry-run          Classify + parse + log, but skip corpus write
 *   --limit N          Process only N properties (for testing)
 *   --concurrency N    Process N properties in parallel (default: 4)
 *   --property X       Process only a specific property folder
 *   --type T           Process only a specific document type (T12, RENT_ROLL, etc.)
 *   --resume           Skip properties already ingested (check corpus)
 *
 * Idempotent: safe to re-run. Skips rows already written (ON CONFLICT DO NOTHING
 * on deal_monthly_actuals; idempotency check on historical_observations).
 */

import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { classifyDocument } from '../services/document-extraction/classifier';
import { routeExtractionResult } from '../services/document-extraction/data-router';
import type { DocumentType, ExtractionResult } from '../services/document-extraction/types';
import type { Pool } from 'pg';

// DB connection — lazy-loaded so dry-run can skip it
let _pool: Pool | null = null;
async function getDbPool(): Promise<Pool | null> {
  if (DRY_RUN) return null;
  if (_pool) return _pool;
  try {
    const { getPool } = await import('../database/connection');
    _pool = getPool();
    return _pool;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `DB connection failed: ${msg}`);
    return null;
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

const ARCHIVE_ROOT = process.env.ARCHIVE_ROOT ||
  path.resolve(process.env.HOME || process.env.USERPROFILE || 'C:\\Users\\Leon',
    'OneDrive - Myers Apartment Group\\Deals\\Archive');

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  return idx >= 0 ? parseInt(process.argv[idx + 1], 10) : Infinity;
})();
const CONCURRENCY = (() => {
  const idx = process.argv.indexOf('--concurrency');
  return idx >= 0 ? parseInt(process.argv[idx + 1], 10) : 4;
})();
const TARGET_PROPERTY = (() => {
  const idx = process.argv.indexOf('--property');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();
const TARGET_TYPE = (() => {
  const idx = process.argv.indexOf('--type');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();
const RESUME = process.argv.includes('--resume');
const VERBOSE = process.argv.includes('--verbose');

// ─── Stats ──────────────────────────────────────────────────────────────────

interface PropertyResult {
  name: string;
  status: 'clean' | 'partial' | 'skipped';
  totalFiles: number;
  ingested: number;
  skipped: number;
  errors: number;
  docTypes: Record<string, number>;
  errorDetails: string[];
}

interface RunStats {
  started: Date;
  propertiesFound: number;
  propertiesProcessed: number;
  propertiesClean: number;
  propertiesPartial: number;
  propertiesSkipped: number;
  totalFiles: number;
  totalIngested: number;
  totalSkipped: number;
  totalErrors: number;
  parserBreakdown: Record<string, { success: number; failure: number }>;
}

const stats: RunStats = {
  started: new Date(),
  propertiesFound: 0,
  propertiesProcessed: 0,
  propertiesClean: 0,
  propertiesPartial: 0,
  propertiesSkipped: 0,
  totalFiles: 0,
  totalIngested: 0,
  totalSkipped: 0,
  totalErrors: 0,
  parserBreakdown: {},
};

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level: string, message: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString().slice(11, 19);
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  const output = `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`;
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

function progressBar(current: number, total: number, message: string): void {
  if (total <= 0 || current < 0) return;
  const pct = Math.round((current / total) * 100);
  const barLen = 20;
  const filled = Math.min(Math.round((current / total) * barLen), barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
  const line = `[${bar}] ${current}/${total} (${pct}%) — ${message}`;
  // Use carriage return to overwrite
  process.stdout.write('\r' + line);
  if (current === total) {
    process.stdout.write('\n');
  }
}

// ─── Property Identity Resolution ────────────────────────────────────────────

/**
 * Resolve a property folder name to a (dealId, propertyId) pair.
 * In dry-run mode, returns dummy IDs for classification logging.
 */
async function resolvePropertyIdentity(
  pool: Pool | null,
  folderName: string,
): Promise<{ dealId: string | null; propertyId: string | null }> {
  if (!pool) {
    // Dry-run: return a deterministic synthetic ID for logging
    const safeName = folderName.replace(/[^a-zA-Z0-9]/g, '_');
    return { dealId: `dry-run-${safeName}`, propertyId: `dry-run-prop-${safeName}` };
  }

  // Strategy 1: Exact match on property name via deal_properties join
  try {
    const exactResult = await pool.query(
      `SELECT d.id as deal_id, dp.property_id
       FROM deals d
       JOIN deal_properties dp ON dp.deal_id = d.id
       WHERE d.name ILIKE $1 OR dp.property_id IN (
         SELECT id FROM properties WHERE name ILIKE $1
       )
       LIMIT 1`,
      [`%${folderName}%`]
    );
    if (exactResult.rows.length > 0) {
      return {
        dealId: exactResult.rows[0].deal_id,
        propertyId: exactResult.rows[0].property_id,
      };
    }

    // Strategy 2: Try normalized version
    const normalized = folderName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    if (normalized !== folderName) {
      return resolvePropertyIdentity(pool, normalized);
    }

    // Strategy 3: Try first significant word(s)
    const words = folderName.split(/[\s\-_]+/).filter(w => w.length > 2);
    for (let i = Math.min(3, words.length); i >= 1; i--) {
      const partial = words.slice(0, i).join(' ');
      const result = await pool.query(
        `SELECT d.id as deal_id, dp.property_id
         FROM deals d
         JOIN deal_properties dp ON dp.deal_id = d.id
         WHERE d.name ILIKE $1 OR dp.property_id IN (
           SELECT id FROM properties WHERE name ILIKE $1
         )
         LIMIT 1`,
        [`%${partial}%`]
      );
      if (result.rows.length > 0) {
        return {
          dealId: result.rows[0].deal_id,
          propertyId: result.rows[0].property_id,
        };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `Identity resolution failed for ${folderName}: ${msg}`);
  }

  return { dealId: null, propertyId: null };
}

// ─── File Processing ────────────────────────────────────────────────────────

interface ProcessedFile {
  filename: string;
  docType: DocumentType | null;
  success: boolean;
  error?: string;
  result?: ExtractionResult;
}

/**
 * Process a single file: classify → parse → return result.
 * Does NOT write to DB — that happens at the property level.
 */
async function processFile(
  filePath: string,
  typeFilter?: string,
): Promise<ProcessedFile> {
  const filename = path.basename(filePath);

  try {
    // Check file existence and size
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return { filename, docType: null, success: false, error: 'Empty file (0 bytes)' };
    }
    if (stat.size > 100 * 1024 * 1024) {
      return { filename, docType: null, success: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB)` };
    }

    // Read file for classification and parsing
    const buffer = fs.readFileSync(filePath);
    const fullName = path.basename(filename);
    const fileExt = path.extname(filename).toLowerCase();
    const classification = await classifyDocument(buffer, fullName);

    if (!classification || !classification.documentType) {
      log('debug', `No classification for ${filename}`);
      return { filename, docType: null, success: false, error: 'Unrecognized document type' };
    }

    const docType = classification.documentType;

    // Apply type filter if set
    if (typeFilter && docType !== typeFilter) {
      return { filename, docType, success: false, error: `Skipped (type filter: ${typeFilter})` };
    }

    // Use extension-based parsing
    let result: ExtractionResult;

    if (fileExt === '.pdf') {
      // PDF files not yet supported for most parsers — skip or route to pdf-parse
      if (docType === 'TAX_BILL' || docType === 'OM') {
        return { filename, docType, success: false, error: 'PDF parsing not yet implemented for this type' };
      }
      if (docType === 'LEASING_STATS' || docType === 'BOX_SCORE') {
        return { filename, docType, success: false, error: 'PDF BoxScore parsing deferred (Session 2.5)' };
      }
      return { filename, docType, success: false, error: 'PDF — no parser available' };
    }

    // Route to parser based on doc type
    // Supported formats: XLSX, XLS (via xlsx library)
    if (['.xlsx', '.xls', '.xlsm', '.xlsb'].includes(fileExt)) {
      switch (docType) {
        case 'T12': {
          const { parseT12 } = await import('../services/document-extraction/parsers/t12-parser');
          result = parseT12(buffer, filename);
          break;
        }
        case 'RENT_ROLL': {
          const { parseRentRoll } = await import('../services/document-extraction/parsers/rent-roll-parser');
          result = parseRentRoll(buffer, filename);
          break;
        }
        case 'BOX_SCORE':
        case 'LEASING_STATS': {
          const { parseLeasingStats } = await import('../services/document-extraction/parsers/leasing-stats-parser');
          result = parseLeasingStats(buffer, filename);
          break;
        }
        case 'CONCESSION_BURNOFF': {
          const { parseConcessionBurnoff } = await import('../services/document-extraction/parsers/concession-burnoff-parser');
          result = parseConcessionBurnoff(buffer, filename);
          break;
        }
        case 'TAX_BILL': {
          // XLSX tax bills not common, but route to parser
          const { parseTaxBill } = await import('../services/document-extraction/parsers/tax-bill-parser');
          result = parseTaxBill(buffer, filename);
          break;
        }
        case 'OTHER_INCOME': {
          const { parseOtherIncome } = await import('../services/document-extraction/parsers/other-income-parser');
          result = parseOtherIncome(buffer, filename);
          break;
        }
        default:
          return { filename, docType, success: false, error: `No parser for type: ${docType}` };
      }
    } else {
      return { filename, docType, success: false, error: `Unsupported file extension: ${fileExt}` };
    }

    return { filename, docType, success: result.success, result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { filename, docType: null, success: false, error: msg };
  }
}

// ─── Property Processing ────────────────────────────────────────────────────

async function processProperty(
  pool: Pool,
  folderName: string,
  folderPath: string,
  identity: { dealId: string | null; propertyId: string | null },
  typeFilter?: string,
  isDryRun: boolean = false,
): Promise<PropertyResult> {
  const result: PropertyResult = {
    name: folderName,
    status: 'clean',
    totalFiles: 0,
    ingested: 0,
    skipped: 0,
    errors: 0,
    docTypes: {},
    errorDetails: [],
  };

  if (!identity.dealId || !identity.propertyId) {
    result.status = 'skipped';
    result.errorDetails.push('Property identity not resolved in database');
    return result;
  }

  // Enumerate files recursively
  const files: string[] = [];
  function walkDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('~$') || entry.name.startsWith('._') ||
            entry.name === '__MACOSX' || entry.name === 'desktop.ini') {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Skip directories that can't be read
    }
  }
  walkDir(folderPath);
  result.totalFiles = files.length;

  // Sort files to process in a predictable order
  files.sort();

  for (const filePath of files) {
    const filename = path.basename(filePath);
    const processed = await processFile(filePath, typeFilter);

    if (!processed.docType || !processed.success) {
      result.skipped++;
      if (processed.error) {
        if (VERBOSE) {
          result.errorDetails.push(`${filename}: ${processed.error}`);
        }
      }
      continue;
    }

    // Track by doc type
    result.docTypes[processed.docType] = (result.docTypes[processed.docType] || 0) + 1;

    // Parse succeeded — now route to corpus / monthly_actuals
    try {
      if (!isDryRun) {
        const routeResult = await routeExtractionResult(processed.result!, {
          dealId: identity.dealId,
          filename,
          uploadedBy: 'archive-bulk-ingest',
        });
        const rowsInserted = routeResult.rowsInserted;
        result.ingested += rowsInserted > 0 ? 1 : 0;
        if (rowsInserted === 0) {
          result.skipped++;
        }
      } else {
        result.ingested++;
      }

      // Track parser stats
      const parserKey = processed.docType;
      if (!stats.parserBreakdown[parserKey]) {
        stats.parserBreakdown[parserKey] = { success: 0, failure: 0 };
      }
      stats.parserBreakdown[parserKey].success++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors++;
      result.errorDetails.push(`${filename}: Write error — ${msg}`);
      if (!stats.parserBreakdown[processed.docType]) {
        stats.parserBreakdown[processed.docType] = { success: 0, failure: 0 };
      }
      stats.parserBreakdown[processed.docType].failure++;
    }
  }

  // Determine overall property status
  if (result.errors > 0 || (result.skipped > 0 && result.ingested === 0 && result.totalFiles > 0)) {
    result.status = 'partial';
  } else if (result.ingested === 0 && result.skipped === 0 && result.totalFiles === 0) {
    result.status = 'skipped';
  } else if (result.ingested === 0 && result.skipped > 0) {
    result.status = 'skipped';
  } else {
    result.status = result.errors > 0 ? 'partial' : 'clean';
  }

  return result;
}

// ─── Main Runner ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('info', `=== F9 Archive Bulk Ingestion Runner ===`);
  log('info', `  Archive path: ${ARCHIVE_ROOT}`);
  log('info', `  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writes enabled)'}`);
  log('info', `  Concurrency: ${CONCURRENCY}`);
  log('info', `  Limit: ${LIMIT === Infinity ? 'all' : LIMIT}`);
  log('info', `  Resume: ${RESUME}`);
  log('info', `  Target property: ${TARGET_PROPERTY || 'all'}`);
  log('info', `  Target type: ${TARGET_TYPE || 'all'}`);
  log('info', '');

  // Verify archive root exists
  if (!fs.existsSync(ARCHIVE_ROOT)) {
    log('error', `Archive root not found: ${ARCHIVE_ROOT}`);
    process.exit(1);
  }

  const pool = await getDbPool();

  // Get all property folders
  let propertyFolders: string[];
  if (TARGET_PROPERTY) {
    propertyFolders = [TARGET_PROPERTY];
  } else {
    propertyFolders = fs.readdirSync(ARCHIVE_ROOT)
      .filter(name => {
        const fullPath = path.join(ARCHIVE_ROOT, name);
        return fs.statSync(fullPath).isDirectory() && !name.startsWith('__') && !name.startsWith('._');
      })
      .sort((a, b) => a.localeCompare(b));
  }

  // Apply limit
  if (LIMIT < propertyFolders.length) {
    propertyFolders = propertyFolders.slice(0, LIMIT);
  }

  stats.propertiesFound = propertyFolders.length;
  log('info', `Found ${propertyFolders.length} property folders (LIMIT=${LIMIT})`);
  log('info', '');

  // If resume mode, check which properties already have corpus data
  let skipSet = new Set<string>();
  if (RESUME && pool) {
    log('info', 'Checking for already-ingested properties...');
    const ingestedResult = await pool.query(
      `SELECT DISTINCT d.name as deal_name
       FROM historical_observations ho
       JOIN deals d ON d.id = ho.deal_id
       WHERE ho.source_signals && ARRAY['t12', 'rent_roll', 'leasing_stats']`
    );
    for (const row of ingestedResult.rows) {
      const name = (row.deal_name as string || '').toLowerCase();
      for (const folder of propertyFolders) {
        if (folder.toLowerCase().includes(name) || name.includes(folder.toLowerCase())) {
          skipSet.add(folder);
        }
      }
    }
    log('info', `  ${skipSet.size} properties appear already ingested, will skip`);
    log('info', '');
  }

  // Process properties with concurrency limit
  const allResults: PropertyResult[] = [];
  const queue = [...propertyFolders];

  // Pre-resolve identities for all properties
  log('info', 'Resolving property identities...');
  const identityCache = new Map<string, { dealId: string | null; propertyId: string | null }>();
  for (const folder of propertyFolders) {
    if (skipSet.has(folder)) {
      identityCache.set(folder, { dealId: null, propertyId: null });
      continue;
    }
    const identity = await resolvePropertyIdentity(pool, folder);
    identityCache.set(folder, identity);
  }
  log('info', `  ${identityCache.size} identities resolved`);
  log('info', '');

  // Process in batches (sequential within batch, parallel across batches)
  for (let batchStart = 0; batchStart < queue.length; batchStart += CONCURRENCY) {
    const batch = queue.slice(batchStart, batchStart + CONCURRENCY);

    const batchPromises = batch.map(async (folder) => {
      if (skipSet.has(folder)) {
        const result: PropertyResult = {
          name: folder,
          status: 'skipped',
          totalFiles: 0,
          ingested: 0,
          skipped: 0,
          errors: 0,
          docTypes: {},
          errorDetails: ['Already ingested (resume mode)'],
        };
        return result;
      }

      const identity = identityCache.get(folder);
      if (!identity || (!identity.dealId && !identity.propertyId)) {
        const result: PropertyResult = {
          name: folder,
          status: 'skipped',
          totalFiles: 0,
          ingested: 0,
          skipped: 0,
          errors: 0,
          docTypes: {},
          errorDetails: ['Property not found in database'],
        };
        return result;
      }

      const folderPath = path.join(ARCHIVE_ROOT, folder);
      return processProperty(pool, folder, folderPath, identity, TARGET_TYPE ?? undefined, DRY_RUN);
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);

    // Update running stats
    for (const r of batchResults) {
      stats.totalFiles += r.totalFiles;
      stats.totalIngested += r.ingested;
      stats.totalSkipped += r.skipped;
      stats.totalErrors += r.errors;
      stats.propertiesProcessed++;

      if (r.status === 'clean') stats.propertiesClean++;
      else if (r.status === 'partial') stats.propertiesPartial++;
      else if (r.status === 'skipped') stats.propertiesSkipped++;
    }

    // Progress bar
    const processedSoFar = Math.min(stats.propertiesProcessed, queue.length);
    const total = Math.min(queue.length, LIMIT);
    progressBar(processedSoFar, total, `last: ${batchResults.map(r => r.name).join(', ')}`);
  }

  // ─── Final Report ────────────────────────────────────────────────────────
  console.log('\n');
  log('info', `=== SESSION 2 — FINAL REPORT ===`);
  log('info', `  Started:     ${stats.started.toISOString()}`);
  log('info', `  Duration:    ${((Date.now() - stats.started.getTime()) / 1000).toFixed(1)}s`);
  log('info', `  Mode:        ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('info', '');

  log('info', `  Properties found:     ${stats.propertiesFound}`);
  log('info', `  Properties processed: ${stats.propertiesProcessed}`);
  log('info', `    Clean:   ${stats.propertiesClean}`);
  log('info', `    Partial: ${stats.propertiesPartial}`);
  log('info', `    Skipped: ${stats.propertiesSkipped}`);
  log('info', '');
  log('info', `  Total files processed: ${stats.totalFiles}`);
  log('info', `  Rows ingested:         ${stats.totalIngested}`);
  log('info', `  Files skipped:         ${stats.totalSkipped}`);
  log('info', `  Errors encountered:    ${stats.totalErrors}`);
  log('info', '');

  log('info', `  Parser breakdown:`);
  for (const [type, counts] of Object.entries(stats.parserBreakdown).sort((a, b) => b[1].success - a[1].success)) {
    log('info', `    ${type.padEnd(20)} ${counts.success.toString().padStart(4)} successes, ${counts.failure} failures`);
  }

  // Partial/error details (first 5 shown)
  const partialProps = allResults.filter(r => r.status === 'partial' || (r.status === 'skipped' && r.errorDetails.length > 0));
  if (partialProps.length > 0) {
    log('info', '');
    log('info', `  Properties with issues (${partialProps.length}):`);
    for (const p of partialProps.slice(0, 10)) {
      const sample = p.errorDetails.slice(0, 3).join('; ');
      log('info', `    ${p.name}: ${p.status} — ${sample}`);
    }
    if (partialProps.length > 10) {
      log('info', `    ... and ${partialProps.length - 10} more`);
    }
  }

  log('info', '');
  log('info', '=== END ===');
}

main().catch(err => {
  log('error', 'Fatal error', { error: err.message, stack: err.stack });
  process.exit(1);
});
