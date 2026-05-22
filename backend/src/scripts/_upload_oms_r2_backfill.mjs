import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARCHIVE = 'C:\\Users\\Leon\\OneDrive - Myers Apartment Group\\Deals\\Archive';
const URL = 'https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/archive/parse-om';
const SECRET = 'jedire-archive-2026';

// Collect all OM PDFs
const allFiles = [];
for (const entry of fs.readdirSync(ARCHIVE)) {
  const d = path.join(ARCHIVE, entry);
  if (!fs.statSync(d).isDirectory() || entry.startsWith('_')) continue;
  for (const f of fs.readdirSync(d)) {
    const upper = f.toUpperCase();
    if (upper.endsWith('.PDF') && upper.includes(' OM') && !f.startsWith('~$')) {
      allFiles.push({ parcel: entry, file: f, fpath: path.join(d, f) });
    }
  }
}

console.log(`Total OM PDFs: ${allFiles.length} files`);
for (const f of allFiles) {
  const sz = fs.statSync(f.fpath).size / 1024;
  console.log(`  ${f.parcel} / ${f.file} (${sz.toFixed(0)}KB)`);
}

let success = 0, failed = 0, ybCount = 0, r2Count = 0;
const errors = [];

for (let i = 0; i < allFiles.length; i++) {
  const { parcel, file, fpath } = allFiles[i];
  const sz = fs.statSync(fpath).size / 1024;
  const enc = encodeURIComponent(parcel).replace(/%20/g, '%20');
  const url = `${URL}?parcel_id=${enc}&observation_date=2025-01-01`;
  process.stdout.write(`[${i+1}/${allFiles.length}] ${parcel} / ${file} (${sz.toFixed(0)}KB)... `);

  let out = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      out = execSync(
        `curl.exe -s -X POST "${url}" -H "x-ingest-secret: ${SECRET}" -F "file=@${fpath}" --connect-timeout 15 --max-time 300`,
        { encoding: 'buffer', timeout: 310000 }
      ).toString('utf8').trim();
      if (out) break;
    } catch (e) {
      out = (e.stdout || Buffer.from('')).toString('utf8').trim();
      if (out) break;
    }
    if (attempt === 0) process.stdout.write('EMPTY(retry)... ');
  }

  if (!out) {
    process.stdout.write('EMPTY\n');
    failed++; errors.push([parcel, 'empty response']);
    continue;
  }

  try {
    const j = JSON.parse(out);
    if (j.success) {
      const yb = j.yearBuilt;
      const fid = j.fileId?.slice(0, 8);
      const sk = j.storageKey?.slice(0, 40);
      if (yb) ybCount++;
      if (fid) r2Count++;
      process.stdout.write(`OK yb=${yb} r2=${fid ? '✓' : '✗'}\n`);
      success++;
    } else {
      const err = String(j.error || JSON.stringify(j)).slice(0, 150);
      process.stdout.write(`ERR: ${err}\n`);
      failed++; errors.push([parcel, err]);
    }
  } catch {
    process.stdout.write(`JSONERR: ${out.slice(0, 80)}\n`);
    failed++; errors.push([parcel, `JSONerr: ${out.slice(0, 50)}`]);
  }
}

console.log(`\nDone: ${success} ok, ${failed} failed, ${ybCount} yearBuilt, ${r2Count} R2 uploads`);
for (const [p, e] of errors) console.log(`  FAIL ${p}: ${e}`);
