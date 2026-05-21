/**
 * archive-bulk-file-upload.ts
 *
 * Batch upload script for Phase 1 — runs on Leon's Windows machine.
 * Walks a root folder, classifies each file, sha256-dedup checks against
 * the server, then POSTs new files to /api/v1/archive/files/ingest.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-bulk-file-upload.ts \
 *     --root "C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive" \
 *     --endpoint "https://<replit-dev-domain>/api/v1/archive" \
 *     --secret "jedire-archive-2026" \
 *     [--concurrency 6] \
 *     [--dry-run]
 *
 * Output: manifest JSON written to ./upload-manifest-<timestamp>.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

// ── CLI args ──────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const ROOT_FOLDER  = arg('root')        ?? process.env.ARCHIVE_ROOT ?? '';
const ENDPOINT     = (arg('endpoint')   ?? process.env.ARCHIVE_ENDPOINT ?? '').replace(/\/$/, '');
const SECRET       = arg('secret')      ?? process.env.ARCHIVE_INGEST_SECRET ?? '';
const CONCURRENCY  = parseInt(arg('concurrency') ?? '6', 10);
const DRY_RUN      = flag('dry-run');

if (!ROOT_FOLDER || !ENDPOINT || !SECRET) {
  console.error('Usage: archive-bulk-file-upload --root <path> --endpoint <url> --secret <secret>');
  process.exit(1);
}

// ── Document type classifier (filename-only, no buffer parse needed here) ─────

const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /aged[\s_-]*receiv/i,                                          type: 'AGED_RECEIVABLES' },
  { pattern: /box[\s_-]*score/i,                                            type: 'BOX_SCORE' },
  { pattern: /leasing/i,                                                    type: 'LEASING_STATS' },
  { pattern: /concession[\s_-]*burn/i,                                      type: 'CONCESSION_BURNOFF' },
  { pattern: /trade[\s_-]*out|t30[\s_-]*lto|lto[\s_-]*report|lease[\s_-]*trade/i, type: 'T30_LTO' },
  { pattern: /tax[\s_-]*bill|tax[\s_-]*statement|property[\s_-]*tax/i,     type: 'TAX_BILL' },
  { pattern: /market[\s_-]*rent[\s_-]*sched|other[\s_-]*income/i,          type: 'OTHER_INCOME' },
  { pattern: /offering[\s_-]*memorandum|investment[\s_-]*summary|property[\s_-]*offering/i, type: 'OM' },
  { pattern: /rent[\s_+\-]*roll|rr[\s_-]*w[\s_-]*lc|rrwlc/i,              type: 'RENT_ROLL' },
  { pattern: /t[\s_-]*12|trailing[\s_-]*12|income[\s_-]*statement|ysi[\s_-]*is/i, type: 'T12' },
];

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.xlsx', '.xls', '.csv', '.tsv', '.docx', '.doc',
]);

function classifyByFilename(filename: string): string {
  for (const { pattern, type } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) return type;
  }
  return 'OTHER';
}

// ── parcel_id resolution ──────────────────────────────────────────────────────
// Convention: the immediate parent folder of the file is the parcel/deal name.
// Override by setting PARCEL_ID_DEPTH env var:
//   0 = parent dir (default)
//   1 = grandparent dir
// If the folder name looks like a date or generic word, walk up one more level.

const GENERIC_FOLDER_NAMES = /^(archive|deals|documents|files|uploads|data|\d{4})$/i;

function resolveParcelId(filePath: string): string {
  const parts = filePath.split(path.sep);
  // parts[-1] = filename, parts[-2] = immediate parent
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i];
    if (!GENERIC_FOLDER_NAMES.test(candidate)) return candidate;
  }
  return parts[parts.length - 2] ?? 'UNKNOWN';
}

// ── File discovery ────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) results.push(full);
    }
  }
  return results;
}

// ── sha256 ────────────────────────────────────────────────────────────────────

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('timeout')); });
  });
}

function multipartPost(
  url: string,
  headers: Record<string, string>,
  fields: Record<string, string>,
  fileField: string,
  filePath: string,
  filename: string,
  mimeType: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const boundary = `----JediReBoundary${Date.now().toString(16)}`;
    const fileBuffer = fs.readFileSync(filePath);

    const parts: Buffer[] = [];

    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      ));
    }

    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let resp = '';
      res.on('data', (c) => (resp += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: resp }));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('upload timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function pool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface FileResult {
  filePath: string;
  parcelId: string;
  documentType: string;
  sha256: string;
  status: 'uploaded' | 'skipped_dup' | 'failed' | 'dry_run';
  fileId?: string;
  storageKey?: string;
  error?: string;
  sizeBytes: number;
}

async function processFile(filePath: string): Promise<FileResult> {
  const filename   = path.basename(filePath);
  const parcelId   = resolveParcelId(filePath);
  const docType    = classifyByFilename(filename);
  const sizeBytes  = fs.statSync(filePath).size;
  const sha256     = sha256File(filePath);

  const base: Omit<FileResult, 'status'> = { filePath, parcelId, documentType: docType, sha256, sizeBytes };

  if (DRY_RUN) {
    return { ...base, status: 'dry_run' };
  }

  // 1. Dedup probe
  try {
    const check = await httpGet(
      `${ENDPOINT}/files/check?sha256=${sha256}`,
      { 'x-ingest-secret': SECRET },
    );
    const parsed = JSON.parse(check.body);
    if (parsed.exists) {
      return { ...base, status: 'skipped_dup', fileId: parsed.fileId, storageKey: parsed.storageKey };
    }
  } catch (e: any) {
    return { ...base, status: 'failed', error: `check failed: ${e.message}` };
  }

  // 2. Upload
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf'
    : (ext === '.xlsx' || ext === '.xls') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : ext === '.csv' ? 'text/csv'
    : 'application/octet-stream';

  try {
    const resp = await multipartPost(
      `${ENDPOINT}/files/ingest`,
      { 'x-ingest-secret': SECRET },
      { parcel_id: parcelId, document_type: docType, parser_status: 'unparsed' },
      'file',
      filePath,
      filename,
      mimeType,
    );

    if (resp.status === 200 || resp.status === 201) {
      const parsed = JSON.parse(resp.body);
      if (parsed.duplicate) {
        return { ...base, status: 'skipped_dup', fileId: parsed.fileId, storageKey: parsed.storageKey };
      }
      return { ...base, status: 'uploaded', fileId: parsed.fileId, storageKey: parsed.storageKey };
    }
    return { ...base, status: 'failed', error: `HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
  } catch (e: any) {
    return { ...base, status: 'failed', error: `upload failed: ${e.message}` };
  }
}

async function main() {
  console.log(`\n=== JediRe Archive Bulk Upload ===`);
  console.log(`Root:        ${ROOT_FOLDER}`);
  console.log(`Endpoint:    ${ENDPOINT}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Dry run:     ${DRY_RUN}\n`);

  if (!fs.existsSync(ROOT_FOLDER)) {
    console.error(`Root folder not found: ${ROOT_FOLDER}`);
    process.exit(1);
  }

  console.log('Discovering files...');
  const files = walkDir(ROOT_FOLDER);
  console.log(`Found ${files.length} files\n`);

  const tasks = files.map((fp) => () => {
    process.stdout.write(`  ${path.relative(ROOT_FOLDER, fp).slice(0, 70).padEnd(70)} `);
    return processFile(fp).then((r) => {
      const tag = r.status === 'uploaded'    ? '✓ uploaded'
                : r.status === 'skipped_dup' ? '↩ dup'
                : r.status === 'dry_run'     ? '~ dry-run'
                : `✗ ${r.error ?? 'failed'}`;
      console.log(tag);
      return r;
    });
  });

  const results = await pool(tasks, CONCURRENCY);

  const uploaded    = results.filter((r) => r.status === 'uploaded').length;
  const skipped     = results.filter((r) => r.status === 'skipped_dup').length;
  const failed      = results.filter((r) => r.status === 'failed');
  const dryRun      = results.filter((r) => r.status === 'dry_run').length;

  console.log(`\n=== Summary ===`);
  console.log(`Total files:   ${results.length}`);
  console.log(`Uploaded:      ${uploaded}`);
  console.log(`Skipped (dup): ${skipped}`);
  console.log(`Dry-run:       ${dryRun}`);
  console.log(`Failed:        ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed files:');
    for (const f of failed) {
      console.log(`  ${f.filePath}\n    ${f.error}`);
    }
  }

  const manifestPath = `./upload-manifest-${Date.now()}.json`;
  fs.writeFileSync(manifestPath, JSON.stringify({ summary: { total: results.length, uploaded, skipped, failed: failed.length, dryRun }, results }, null, 2));
  console.log(`\nManifest written to: ${manifestPath}`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
