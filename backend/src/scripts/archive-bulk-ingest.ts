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

// ─── HTTP endpoint config (set --http to use Replit proxy instead of direct DB) ─
const JSON_OUTPUT = process.argv.includes('--json');
const JSON_OUTPUT_PATH = process.argv.includes('--json')
  ? (() => {
      const idx = process.argv.indexOf('--json');
      return idx >= 0 && idx + 1 < process.argv.length && !process.argv[idx + 1].startsWith('-')
        ? process.argv[idx + 1]
        : 'archive-ingest-output.json';
    })()
  : null;

// HTTP endpoint mode — post rows instead of writing to DB
const HTTP_MODE = process.argv.includes('--http');
const INGEST_ENDPOINT = process.env.INGEST_ENDPOINT ||
  'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive/ingest-rows';
const INGEST_SECRET = process.env.INGEST_SECRET || 'jedire-archive-2026';

// DB connection — lazy-loaded so dry-run can skip it
let _pool: Pool | null = null;
async function getDbPool(): Promise<Pool | null> {
  if (DRY_RUN || HTTP_MODE || JSON_OUTPUT) return null;
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

// ─── Accumulated rows for JSON output ────────────────────────────────────────
const collectedRows: Array<{
  parcelId: string;
  folderName: string;
  filename: string;
  docType: DocumentType;
  data: unknown;
  extraction: ExtractionResult;
}> = [];

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
): Promise<{ dealId: string | null; propertyId: string | null; parcelId?: string }> {
  if (!pool) {
    // Dry-run / HTTP mode: return folder name as parcel ID
    const safeName = folderName.replace(/[^a-zA-Z0-9]/g, '_');
    if (HTTP_MODE) {
      return { dealId: null, propertyId: null, parcelId: folderName };
    }
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

  return { dealId: null, propertyId: null, parcelId: null };
}

// ─── HTTP Batch Accumulator ───────────────────────────────────────────────────

/** Batches of corpus rows waiting to be POSTed */
const httpRowBatch: Array<Record<string, unknown>> = [];
let httpTotalPosted = 0;
const HTTP_BATCH_SIZE = 100;

/**
 * Map a T12 / rent roll / leasing-stats parsed data blob
 * to the corpus observation columns that the DB actually has.
 *
 * Property-level columns accepted by the endpoint:
 *   property_occupancy, property_avg_rent, property_asking_rent,
 *   property_unit_count, property_year_built, property_class,
 *   property_concession_per_unit, property_signing_velocity
 *
 * Realized changes (year-over-year):
 *   realized_rent_change_t3/t12/t24, realized_occupancy_change_t3/t12,
 *   realized_concession_change_t12, realized_signing_velocity_t3/t12
 *
 * Required on every row:
 *   parcel_id, observation_date, source_signals[], data_quality_tier
 */
function extractCorpusColumns(
  docType: DocumentType,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const cols: Record<string, unknown> = {};

  // Determine source signal based on doc type
  if (docType === 'T12') {
    cols.source_signals = ['t12'];
    // T12 typically has monthlySummary or per-month income/expense
    const d = data as Record<string, unknown>;
    if (d.monthlySummary && typeof d.monthlySummary === 'object') {
      const ms = d.monthlySummary as Record<string, unknown>;
      if (ms.occupancy != null) cols.property_occupancy = Number(ms.occupancy);
      if (ms.avgRent != null) cols.property_avg_rent = Number(ms.avgRent);
      if (ms.unitCount != null) cols.property_unit_count = Number(ms.unitCount);
    }
    // Also check data-level occupancy field (some T12s have it at root)
    if (d.occupancyRate != null && cols.property_occupancy == null) cols.property_occupancy = Number(d.occupancyRate);
    if (d.total_units != null && cols.property_unit_count == null) cols.property_unit_count = Number(d.total_units);
    if (d.averageRent != null && cols.property_avg_rent == null) cols.property_avg_rent = Number(d.averageRent);
  } else if (docType === 'RENT_ROLL') {
    cols.source_signals = ['rent_roll'];
    const units = Array.isArray((data as Record<string, unknown>).units) ? (data as Record<string, unknown>).units as Array<Record<string, unknown>> : [];
    if (units.length > 0) {
      cols.property_unit_count = units.length;
      const occupied = units.filter(u => {
        const s = String(u.status || '').toLowerCase();
        return /occupied|leased|rented/.test(s);
      });
      cols.property_occupancy = units.length > 0 ? occupied.length / units.length : null;
      const unitsWithRent = units.filter(u => u.effectiveRent != null || u.marketRent != null);
      cols.property_avg_rent = unitsWithRent.length > 0
        ? unitsWithRent.reduce((s, u) => s + Number(u.effectiveRent ?? u.marketRent ?? 0), 0) / unitsWithRent.length
        : null;
    }
    // Root-level fields may override
    const d = data as Record<string, unknown>;
    if (d.totalUnits != null) cols.property_unit_count = Number(d.totalUnits);
    if (d.occupancy != null) cols.property_occupancy = Number(d.occupancy);
    if (d.avgRent != null) cols.property_avg_rent = Number(d.avgRent);
  } else if (docType === 'BOX_SCORE' || docType === 'LEASING_STATS') {
    cols.source_signals = ['leasing_stats'];
    const d = data as Record<string, unknown>;
    if (d.summary && typeof d.summary === 'object') {
      const s = d.summary as Record<string, unknown>;
      if (s.total_units != null) cols.property_unit_count = Number(s.total_units);
      if (s.total_occupied != null && Number(s.total_units) > 0) {
        cols.property_occupancy = Number(s.total_occupied) / Number(s.total_units);
      }
      if (s.total_new_leases != null) cols.property_signing_velocity = Number(s.total_new_leases);
    }
    // Concession: extract from new_leases if available
    const newLeases = Array.isArray(d.new_leases) ? d.new_leases as Array<Record<string, unknown>> : [];
    if (newLeases.length > 0) {
      const withConcession = newLeases.filter(l => l.concession != null && Number(l.concession) > 0);
      if (withConcession.length > 0) {
        cols.property_concession_per_unit = withConcession.reduce((s, l) => s + Number(l.concession), 0) / withConcession.length;
      }
    }
    // Activity-level signing velocity
    if (d.activity && Array.isArray(d.activity)) {
      const totalNewLeases = (d.activity as Array<Record<string, unknown>>).reduce((s, a) => s + (Number(a.net_leases) || 0), 0);
      if (totalNewLeases > 0) cols.property_signing_velocity = (cols.property_signing_velocity as number || 0) + totalNewLeases;
    }
  } else if (docType === 'CONCESSION_BURNOFF') {
    cols.source_signals = ['concession_burnoff'];
    const d = data as Record<string, unknown>;
    if (d.averageConcession != null) cols.property_concession_per_unit = Number(d.averageConcession);
    if (d.totalUnits != null) cols.property_unit_count = Number(d.totalUnits);
  } else if (docType === 'OTHER_INCOME') {
    cols.source_signals = ['other_income'];
    // No standard property-level fields for other income
  } else {
    cols.source_signals = [docType.toLowerCase()];
  }

  return cols;
}

/**
 * Convert an extraction result into one or more corpus-row-shaped records
 * and add them to the outbound batch. Flushes when batch reaches target size.
 */
async function accumulateForHttp(
  result: ExtractionResult,
  parcelId: string,
  filename: string,
): Promise<boolean> {
  if (!result.success || !result.data) return false;

  const now = new Date().toISOString().split('T')[0];
  const docType = result.documentType;
  const data = result.data as Record<string, unknown>;

  // Determine observation date from parsed data
  let obsDate = now;
  if (data) {
    if (data.period && typeof data.period === 'object') {
      const p = data.period as Record<string, unknown>;
      obsDate = String(p.end || p.start || now);
    } else if (data.date) {
      obsDate = String(data.date);
    } else if (data.observationDate) {
      obsDate = String(data.observationDate);
    }
  }

  // Extract recognized corpus columns from the parsed data
  const columnOverrides = extractCorpusColumns(docType, data);

  // Build the final row — required fields + any extracted columns
  const row: Record<string, unknown> = {
    parcel_id: parcelId,
    observation_date: obsDate,
    data_quality_tier: 'C1',
    source_file: filename,
    ...columnOverrides,
  };

  // Send individual row (endpoint handles column stripping)
  httpRowBatch.push(row);

  // Flush if batch is full
  if (httpRowBatch.length >= HTTP_BATCH_SIZE) {
    return await flushHttpBatch();
  }
  return true;
}

/**
 * Flush accumulated rows to the Replit endpoint.
 */
async function flushHttpBatch(): Promise<boolean> {
  if (httpRowBatch.length === 0) return true;

  const batch = httpRowBatch.splice(0);
  try {
    const response = await fetch(INGEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-secret': INGEST_SECRET,
      },
      body: JSON.stringify({ rows: batch, dryRun: false }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      log('warn', `POST failed [${response.status}]: ${text.slice(0, 300)}`);
      // Put rows back for retry? For now just log
      httpRowBatch.unshift(...batch);
      return false;
    }

    const body = await response.json() as { success?: boolean; inserted?: number; updated?: number; skipped?: number };
    if (!body.success) {
      log('warn', `Server rejected batch of ${batch.length}: ${JSON.stringify(body).slice(0, 300)}`);
      httpRowBatch.unshift(...batch);
      return false;
    }

    httpTotalPosted += batch.length;
    if (body.inserted) httpTotalPosted += body.inserted;
    log('info', `HTTP batch: ${batch.length} rows sent (${body.inserted ?? 0} inserted, ${body.updated ?? 0} updated)`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', `HTTP POST error: ${msg}`);
    httpRowBatch.unshift(...batch);
    return false;
  }
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
  identity: { dealId: string | null; propertyId: string | null; parcelId?: string },
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
    // HTTP/JSON mode: use folder name as parcel identity (server-side resolution)
    if (!HTTP_MODE && !JSON_OUTPUT) {
      result.status = 'skipped';
      result.errorDetails.push('Property identity not resolved in database');
      return result;
    }
    identity.parcelId = folderName;
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
      if (isDryRun) {
        // Dry-run: count it but don't write anything
        result.ingested++;
      } else if (HTTP_MODE) {
        // HTTP mode: accumulate rows and batch-POST to Replit endpoint
        const httpOk = await accumulateForHttp(processed.result!, identity.parcelId || identity.dealId || folderName, filename);
        if (httpOk) {
          result.ingested++;
        } else {
          result.errors++;
          result.errorDetails.push(`${filename}: HTTP POST failed`);
        }
      } else if (JSON_OUTPUT) {
        // JSON mode: accumulate rows for later export
        collectedRows.push({
          parcelId: identity.parcelId || identity.dealId || folderName,
          folderName,
          filename,
          docType: processed.docType,
          data: processed.result!.data,
          extraction: processed.result!,
        });
        result.ingested++;
      } else {
        // Normal mode: write to DB via data router
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
  const identityCache = new Map<string, { dealId: string | null; propertyId: string | null; parcelId?: string }>();
  for (const folder of propertyFolders) {
    if (skipSet.has(folder)) {
      identityCache.set(folder, { dealId: null, propertyId: null, parcelId: null });
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
        // HTTP/JSON mode: proceed with folder name as parcel identity
        if (!HTTP_MODE && !JSON_OUTPUT) {
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
        // Allow processProperty to create synthetic identity from folder name
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

  // ─── Final HTTP/JSON flush ────────────────────────────────────────────────
  if (HTTP_MODE && httpRowBatch.length > 0) {
    log('info', `Flushing final HTTP batch (${httpRowBatch.length} rows)...`);
    await flushHttpBatch();
  }
  if (JSON_OUTPUT && collectedRows.length > 0) {
    const outPath = JSON_OUTPUT_PATH || 'archive-ingest-output.json';
    fs.writeFileSync(outPath, JSON.stringify(collectedRows, null, 2));
    log('info', `Wrote ${collectedRows.length} rows to ${outPath}`);
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
