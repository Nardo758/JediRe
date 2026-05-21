/**
 * Upload remaining OM PDFs — one file per spawnSync call to avoid stale connections
 * Usage: node src/scripts/_upload_oms_remaining.mjs
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ARCHIVE_ROOT = path.resolve(
  process.env.USERPROFILE || 'C:\\Users\\Leon',
  'OneDrive - Myers Apartment Group\\Deals\\Archive',
);

const ENDPOINT = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive/parse-om';

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function findOmFiles(root) {
  const results = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const dirPath = path.join(root, entry.name);
    try {
      for (const file of fs.readdirSync(dirPath)) {
        const upper = file.toUpperCase();
        if (upper.endsWith('.PDF') && upper.includes(' OM') && !file.startsWith('~$')) {
          results.push({ folderName: entry.name, fileName: file, filePath: path.join(dirPath, file) });
        }
      }
    } catch {}
  }
  return results;
}

function main() {
  log('=== OM Year-Built Upload (remaining) ===');

  const allFiles = findOmFiles(ARCHIVE_ROOT);

  // Already succeeded in first run
  const doneSet = new Set([
    'Addison on Long Beach', 'Alta Lakehouse', 'Alta Tech Ridge',
    'Ardmore at Flowers', 'Ashley River', 'Avril Cambridge',
    'Azola Palm Beach', 'Cadence at Nocatee', 'Carrington at Brier Creek',
    'Crescent', 'Debartolo Portfolio', 'East Point at Altamonte',
    'Enclave on East', 'Exchange Orange Park', 'Ferry Pike - Nashville',
    'Heron Pointe',
  ]);

  // For Heron Pointe & Ferry Pike, check if they have a 2nd file (already done the first one)
  // Ferry Pike has 2 OMs: Markham East (done) and Radius at Donelson (done)
  // Enclave has 2: both done

  const remaining = allFiles.filter(f => !doneSet.has(f.folderName) || f.folderName === 'Heron Pointe');
  // Actually Heron Pointe worked individually — include it to verify
  const toUpload = [];

  for (const f of allFiles) {
    if (!doneSet.has(f.folderName)) {
      toUpload.push(f);
    } else {
      // Check if we already processed this specific file
      // for now just proceed with truly new ones
    }
  }

  // Print the remaining files
  log(`Remaining: ${toUpload.length} files`);
  for (const f of toUpload) {
    const sz = Math.round(fs.statSync(f.filePath).size / 1024);
    log(`  ${f.folderName} / ${f.fileName} (${sz}KB)`);
  }

  let success = 0, failed = 0, yearBuiltCount = 0;

  for (let i = 0; i < toUpload.length; i++) {
    const f = toUpload[i];
    const sz = Math.round(fs.statSync(f.filePath).size / 1024);
    const enc = encodeURIComponent(f.folderName);
    const url = `${ENDPOINT}?parcel_id=${enc}&observation_date=2025-01-01`;

    log(`[${i+1}/${toUpload.length}] ${f.folderName} / ${f.fileName} (${sz}KB)`);
    process.stdout.write(`  `);

    const proc = spawnSync('curl.exe', [
      '-s', '-X', 'POST', url,
      '-H', 'x-ingest-secret: jedire-archive-2026',
      '-F', `file=@${f.filePath}`,
      '--connect-timeout', '15',
      '--max-time', '300',
    ], { encoding: 'utf-8', maxBuffer: 200 * 1024 * 1024 });

    if (proc.error) {
      log(`curl error: ${proc.error.message}`);
      failed++;
      continue;
    }

    if (!proc.stdout) {
      log(`empty response (exit ${proc.status})`);
      failed++;
      continue;
    }

    try {
      const j = JSON.parse(proc.stdout);
      if (j.success) {
        const yb = j.yearBuilt || 'null';
        const ocr = j.usedOcr;
        const dbw = j.dbWritten;
        if (j.yearBuilt) yearBuiltCount++;
        log(`OK yb=${yb} ocr=${ocr} dbw=${dbw}`);
        success++;
      } else {
        log(`Error: ${JSON.stringify(j).slice(0, 200)}`);
        failed++;
      }
    } catch (e) {
      log(`JSON err: ${proc.stdout.slice(0, 100)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} ok, ${failed} failed, ${yearBuiltCount} yearBuilt`);
}

main();
