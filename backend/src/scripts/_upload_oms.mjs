/**
 * Upload all OM PDFs to the Replit parse-om endpoint using curl.exe
 * (Windows-native multipart handling works where form-data library doesn't)
 *
 * Usage: node src/scripts/_upload_oms.mjs
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARCHIVE_ROOT = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\Leon',
  'OneDrive - Myers Apartment Group\\Deals\\Archive',
);

const ENDPOINT = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive/parse-om';

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}`);
}

// ─── Find OM PDFs ───────────────────────────────────────────────────────────

function findOmFiles(root) {
  const results = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const dirPath = path.join(root, entry.name);

    try {
      const files = fs.readdirSync(dirPath, { recursive: false });
      for (const file of files) {
        const upper = file.toUpperCase();
        if (upper.endsWith('.PDF') && upper.includes(' OM') && !file.startsWith('~$')) {
          results.push({ folderName: entry.name, fileName: file, filePath: path.join(dirPath, file) });
        }
      }
    } catch {
      // skip
    }
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('info', `=== OM PDF → Year Built Upload (via curl.exe) ===`);
  log('info', `  Archive: ${ARCHIVE_ROOT}`);

  const omFiles = findOmFiles(ARCHIVE_ROOT);
  log('info', `  Found ${omFiles.length} OM PDFs`);
  for (const f of omFiles) {
    const sizeKb = Math.round(fs.statSync(f.filePath).size / 1024);
    log('info', `    ${f.folderName} / ${f.fileName} (${sizeKb}KB)`);
  }

  const results = { success: 0, failed: 0, totalYearBuilt: 0, errors: [] };

  for (let i = 0; i < omFiles.length; i++) {
    const f = omFiles[i];
    const sizeKb = Math.round(fs.statSync(f.filePath).size / 1024);
    log('info', `[${i + 1}/${omFiles.length}] ${f.folderName} / ${f.fileName} (${sizeKb}KB)`);

    const parcelEncoded = encodeURIComponent(f.folderName);
    const url = `${ENDPOINT}?parcel_id=${parcelEncoded}&observation_date=2025-01-01`;

    const curlArgs = [
      '-X', 'POST',
      url,
      '-H', 'x-ingest-secret: jedire-archive-2026',
      '-F', `file=@${f.filePath}`,
      '--connect-timeout', '15',
      '--max-time', '180',  // 3 min timeout for OCR-heavy files
      '-s',
    ];

    const proc = spawnSync('curl.exe', curlArgs, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

    if (proc.error) {
      results.failed++;
      results.errors.push({ folderName: f.folderName, error: proc.error.message });
      log('error', `    curl error: ${proc.error.message}`);
      continue;
    }

    if (proc.status !== 0) {
      results.failed++;
      const errMsg = (proc.stderr || '').slice(0, 200) || `curl exit code ${proc.status}`;
      results.errors.push({ folderName: f.folderName, error: errMsg });
      log('error', `    curl exit ${proc.status}: ${errMsg}`);
      continue;
    }

    try {
      const result = JSON.parse(proc.stdout);
      const yearBuilt = result.yearBuilt;
      const usedOcr = result.usedOcr;
      const dbWritten = result.dbWritten;

      if (yearBuilt) {
        results.totalYearBuilt++;
        log('info', `    ✅ YearBuilt=${yearBuilt} ocr=${usedOcr} dbWritten=${dbWritten}`);
      } else {
        log('warn', `    ⚠️  No yearBuilt. ocr=${usedOcr} dbWritten=${dbWritten} (${result.propertyName || f.folderName})`);
      }

      // Print key extraction stats
      if (result.extraction) {
        const prop = result.extraction.property || {};
        const comps = result.extraction.marketComps || {};
        log('info', `       ${prop.name} | ${prop.city}, ${prop.state} | ${prop.units} units | ${comps.submarketName || '?'}`);
      }

      results.success++;
    } catch (e) {
      results.failed++;
      const body = (proc.stdout || '').slice(0, 200);
      results.errors.push({ folderName: f.folderName, error: `JSON parse error: ${body}` });
      log('error', `    JSON parse: ${body}`);
    }
  }

  log('info', '');
  log('info', `=== Done ===`);
  log('info', `  Succeeded: ${results.success}`);
  log('info', `  Failed:    ${results.failed}`);
  log('info', `  YearBuilt: ${results.totalYearBuilt}/${omFiles.length}`);

  if (results.errors.length > 0) {
    log('warn', `  Errors:`);
    for (const e of results.errors) {
      log('warn', `    ${e.folderName}: ${e.error}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
