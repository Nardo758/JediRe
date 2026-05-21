/**
 * archive-bulk-file-upload.ts — Full batch upload of all archive files to R2
 *
 * Walks the archive folder tree, checks each file's sha256 against the
 * GET /files/check endpoint, and only uploads files with new sha256.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/archive-bulk-file-upload.ts \
 *     --root "C:\Users\Leon\OneDrive - Myers Apartment Group\Deals\Archive" \
 *     --endpoint "https://...replit.dev/api/v1/archive" \
 *     --secret "jedire-archive-2026" \
 *     --concurrency 6
 *     [--dry-run]
 *     [--resume "path/to/manifest.json"]
 *     [--limit 50]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

const ARCHIVE_ROOT = 'C:\\Users\\Leon\\OneDrive - Myers Apartment Group\\Deals\\Archive';
const ENDPOINT = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive';
const SECRET = 'jedire-archive-2026';

// ---- Types ----

interface FileEntry {
  parcelId: string;
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  sha256: string;
}

interface UploadResult {
  relativePath: string;
  parcelId: string;
  sha256: string;
  status: 'uploaded' | 'skipped_dup' | 'failed';
  fileId?: string;
  storageKey?: string;
  error?: string;
  sizeBytes: number;
}

// ---- Helpers ----

function computeSha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function classifyDocument(filename: string): string {
  const upper = filename.toUpperCase();
  if (upper.includes('.PDF') && upper.includes(' OM')) return 'OM';
  if (upper.startsWith('RENT ROLL') || upper.includes('RENT_ROLL') || upper.includes('RENT ROLL')) return 'RENT_ROLL';
  if (/^\d{4}\s+RENT/i.test(filename) || /^\d{4}\s+REN/i.test(filename)) return 'RENT_ROLL';
  if (upper.includes('T12') || upper.includes('T-12') || upper.includes(' TRAIL') || /T1\d/.test(upper)) return 'T12';
  if (upper.includes('BOXSCORE') || upper.includes('BOX_SCORE') || upper.includes('BOX SCORE')) return 'BOX_SCORE';
  if (upper.includes('CONCESSION') || upper.includes('BURNOFF') || upper.includes('BURN OFF')) return 'LEASING_STATS';
  if (upper.includes('TAX') || upper.includes('TAX BILL') || upper.includes('ASSESSMENT')) return 'TAX_BILL';
  if (upper.endsWith('.XLSX') || upper.endsWith('.XLS')) {
    // Default classification for spreadsheets
    if (upper.includes('RENT')) return 'RENT_ROLL';
    if (upper.includes('T12') || upper.includes('INCOME')) return 'T12';
    return 'OTHER';
  }
  return 'OTHER';
}

function curlUpload(parcelId: string, filePath: string, docType: string | undefined): string {
  const url = `${ENDPOINT}/files/ingest`;
  let curlCmd = `curl.exe -s -X POST "${url}" -H "x-ingest-secret: ${SECRET}" -F "file=@${filePath}" -F "parcel_id=${parcelId}" --connect-timeout 30 --max-time 600`;
  if (docType) curlCmd += ` -F "document_type=${docType}"`;
  try {
    const buf = execSync(curlCmd, { timeout: 610000, encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 });
    return buf.toString('utf8').trim();
  } catch (e: any) {
    const stderr = (e.stderr?.toString() || '').trim();
    const stdout = (e.stdout?.toString() || '').trim();
    return stdout || `CURL_ERROR: ${stderr || e.message}`;
  }
}

function curlCheck(sha256: string): string | null {
  const curlCmd = `curl.exe -s "${ENDPOINT}/files/check?sha256=${sha256}" -H "x-ingest-secret: ${SECRET}" --connect-timeout 10 --max-time 30`;
  try {
    const buf = execSync(curlCmd, { timeout: 31000, encoding: 'buffer' });
    return buf.toString('utf8').trim();
  } catch {
    return null;
  }
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const resumeIdx = args.indexOf('--resume');
  const resumeFrom = resumeIdx >= 0 ? args[resumeIdx + 1] : null;

  // Skip files that don't need uploading
  const skipExtensions = new Set(['.docx', '.doc', '.pptx', '.ppt', '.htm', '.html', '.msg', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff']);
  const skipShas = new Set<string>();

  // Load resume manifest if provided
  if (resumeFrom) {
    const existing = JSON.parse(fs.readFileSync(resumeFrom, 'utf8'));
    for (const r of existing.results as UploadResult[]) {
      if (r.status === 'uploaded' || r.status === 'skipped_dup') skipShas.add(r.sha256);
    }
    console.log(`Resumed: ${skipShas.size} files already processed from ${resumeFrom}`);
  }

  // Walk archive
  const entries: FileEntry[] = [];
  const dirs = fs.readdirSync(ARCHIVE_ROOT).filter(d => {
    const dd = path.join(ARCHIVE_ROOT, d);
    return fs.statSync(dd).isDirectory() && !d.startsWith('_') && !d.startsWith('.');
  }).sort();

  for (const dir of dirs) {
    const dirPath = path.join(ARCHIVE_ROOT, dir);
    for (const file of fs.readdirSync(dirPath)) {
      if (file.startsWith('~$')) continue;
      const ext = path.extname(file).toLowerCase();
      if (skipExtensions.has(ext)) continue;
      const fpath = path.join(dirPath, file);
      if (!fs.statSync(fpath).isFile()) continue;
      entries.push({
        parcelId: dir,
        relativePath: path.join(dir, file),
        absolutePath: fpath,
        sizeBytes: fs.statSync(fpath).size,
        sha256: computeSha256(fpath),
      });
    }
  }

  console.log(`Found ${entries.length} candidate files across ${dirs.length} folders`);

  // Deduplicate by sha256 (same file in multiple dirs)
  const seen = new Set<string>();
  const uniqueEntries = entries.filter(e => {
    if (seen.has(e.sha256)) return false;
    seen.add(e.sha256);
    return true;
  });
  console.log(`${uniqueEntries.length} unique files (${entries.length - uniqueEntries.length} duplicates skipped)`);

  // Apply limit
  const toProcess = resumeFrom ? uniqueEntries.filter(e => !skipShas.has(e.sha256)) : uniqueEntries;
  const slice = toProcess.slice(0, limit);

  if (dryRun) {
    console.log(`\nDRY RUN — would upload ${slice.length} files:\n`);
    for (const f of slice) {
      const dt = classifyDocument(path.basename(f.relativePath));
      const sz = (f.sizeBytes / 1024).toFixed(0);
      console.log(`${dt.padEnd(14)} ${f.parcelId.padEnd(25)} ${sz.padStart(6)}KB  ${f.sha256.slice(0, 12)}...  ${f.relativePath}`);
    }
    console.log(`\nTotal: ${slice.length} files`);
    process.exit(0);
  }

  // Batch upload
  const results: UploadResult[] = [];
  let uploaded = 0, skipped = 0, failed = 0, totalUploadedBytes = 0;

  for (let i = 0; i < slice.length; i++) {
    const f = slice[i];
    const filename = path.basename(f.relativePath);
    const docType = classifyDocument(filename);
    const szKB = (f.sizeBytes / 1024).toFixed(0);

    process.stdout.write(`[${i + 1}/${slice.length}] ${docType.padEnd(12)} ${f.parcelId.slice(0, 20).padEnd(20)} ${szKB.padStart(6)}KB `);

    // Check dedup
    const checkResp = curlCheck(f.sha256);
    let checkObj: any = null;
    try { if (checkResp) checkObj = JSON.parse(checkResp); } catch {}
    if (checkObj?.exists) {
      process.stdout.write(`dup(${checkObj.fileId?.slice(0, 8)})\n`);
      results.push({
        relativePath: f.relativePath,
        parcelId: f.parcelId,
        sha256: f.sha256,
        status: 'skipped_dup',
        fileId: checkObj.fileId,
        storageKey: checkObj.storageKey,
        sizeBytes: f.sizeBytes,
      });
      skipped++;
      continue;
    }

    // Upload
    const uploadResp = curlUpload(f.parcelId, f.absolutePath, docType);
    let obj: any = null;
    try { obj = JSON.parse(uploadResp); } catch {}

    if (obj?.success) {
      process.stdout.write(`id=${obj.fileId?.slice(0, 8)} key=${(obj.storageKey || '').slice(0, 35)}\n`);
      results.push({
        relativePath: f.relativePath,
        parcelId: f.parcelId,
        sha256: f.sha256,
        status: 'uploaded',
        fileId: obj.fileId,
        storageKey: obj.storageKey,
        sizeBytes: f.sizeBytes,
      });
      uploaded++;
      totalUploadedBytes += f.sizeBytes;
    } else if (obj?.duplicate) {
      process.stdout.write(`dup(${obj.fileId?.slice(0, 8)})\n`);
      results.push({
        relativePath: f.relativePath,
        parcelId: f.parcelId,
        sha256: f.sha256,
        status: 'skipped_dup',
        fileId: obj.fileId,
        storageKey: obj.storageKey,
        sizeBytes: f.sizeBytes,
      });
      skipped++;
    } else {
      const err = String(obj?.error || uploadResp).slice(0, 100);
      process.stdout.write(`FAIL: ${err}\n`);
      results.push({
        relativePath: f.relativePath,
        parcelId: f.parcelId,
        sha256: f.sha256,
        status: 'failed',
        error: err,
        sizeBytes: f.sizeBytes,
      });
      failed++;
    }
  }

  // Summary
  const manifest = {
    runAt: new Date().toISOString(),
    total: slice.length,
    uploaded,
    skippedDup: skipped,
    failed,
    totalUploadedBytes,
    totalMB: (totalUploadedBytes / (1024 * 1024)).toFixed(1),
    results,
  };

  const manifestPath = path.join(__dirname, `_upload_manifest_${Date.now()}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const mib = (totalUploadedBytes / (1024 * 1024)).toFixed(1);
  console.log(`\nDone: ${uploaded} uploaded (${mib} MiB), ${skipped} skipped (dup), ${failed} failed`);
  console.log(`Manifest: ${manifestPath}`);

  if (failed > 0) {
    console.log('\nFailures:');
    for (const r of results.filter(r => r.status === 'failed')) {
      console.log(`  ${r.relativePath}: ${r.error}`);
    }
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
