/**
 * om-address-extract.ts
 *
 * RUN ON REPLIT: Iterates property_descriptions rows, for each parcel:
 * 1. Fetches the OM PDF from Cloudflare R2 (via REST API, no SDK needed)
 * 2. Sends it to the local parse-om endpoint (multipart form)
 * 3. Extracts real street address from the AI response
 * 4. UPSERTs into property_descriptions.address with LayeredValue provenance
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/om-address-extract.ts [--resume] [--limit N] [--parcel PID]
 *
 * Dependencies (all already in package.json):
 *   form-data, node-fetch (or native fetch on Node 20+)
 */

import { getPool } from '../src/database/connection';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

// ── Config ──────────────────────────────────────────────────────────
const STATE_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'OM_ADDRESS_STATE.json');
const PARSE_OM_URL = 'http://localhost:3000/api/v1/archive/parse-om';
const INGEST_SECRET = 'jedire-archive-2026';

const R2_ACCOUNT_ID = '4c198a3635afafa443be6ef8e9717bb5';
const R2_ACCESS_KEY_ID = 'c15e137be2914334d47f790bee5eb5a1';
const R2_SECRET_ACCESS_KEY = '04b2999bf7977288244190fafeb822871bde94c8133c7940f908a6184e47bbd0';
const R2_BUCKET = 'jedire-archive';
// ─────────────────────────────────────────────────────────────────────

interface OmState {
  properties: Record<string, { done: boolean; address?: string; yearBuilt?: number; units?: number; error?: string }>;
  updatedAt: string;
}

function loadState(): OmState {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')); }
  catch { return { properties: {}, updatedAt: new Date().toISOString() }; }
}

function saveState(state: OmState) {
  state.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Simple HTTPS GET with optional auth header.
 * Used for S3-compatible REST operations against R2.
 */
function r2Request(method: string, key: string): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key.startsWith('/') ? key.slice(1) : key}`);
    
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/auto/s3/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=dummy`,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        'x-amz-date': new Date().toISOString().replace(/[:\-]/g, '').replace(/\.\d{3}/, ''),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 500,
          headers: res.headers as Record<string, string>,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('R2 request timed out')); });
    req.end();
  });
}

/**
 * Simple S3-compatible LIST (via R2 REST endpoint).
 * We do GET with ?list-type=2&prefix=...
 */
function r2ListObjects(prefix: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const xml = Buffer.concat(chunks).toString('utf-8');
        // Simple XML parsing for keys
        const keys: string[] = [];
        const keyRegex = /<Key>([^<]+)<\/Key>/g;
        let match;
        while ((match = keyRegex.exec(xml)) !== null) {
          keys.push(match[1]);
        }
        resolve(keys);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('R2 list timed out')); });
    req.end();
  });
}

/**
 * Find OM PDF for a parcel in R2
 */
async function findOmPdf(parcelId: string): Promise<{ key: string; buffer: Buffer; name: string } | null> {
  const prefixes = [`Archive/${parcelId}/`, `${parcelId}/`, parcelId];
  
  for (const prefix of prefixes) {
    try {
      const keys = await r2ListObjects(prefix);
      
      // Find OM PDFs first
      for (const key of keys) {
        if (/\.pdf$/i.test(key) && /om/i.test(key)) {
          const resp = await r2Request('GET', key);
          if (resp.status === 200) {
            return { key, buffer: resp.body, name: path.basename(key) };
          }
        }
      }
      
      // Fallback: any PDF under 50MB
      for (const key of keys) {
        if (/\.pdf$/i.test(key)) {
          const resp = await r2Request('GET', key);
          if (resp.status === 200 && resp.body.length <= 50 * 1024 * 1024) {
            return { key, buffer: resp.body, name: path.basename(key) };
          }
        }
      }
    } catch {
      // Try next prefix
    }
  }
  
  return null;
}

/**
 * POST a PDF file to the local parse-om endpoint via multipart/form-data
 */
function postFileToParseOm(buffer: Buffer, filename: string, parcelId: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: 'application/pdf' });
    
    const url = new URL(PARSE_OM_URL);
    url.searchParams.set('parcel_id', parcelId);
    
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: parseInt(url.port) || 80,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'x-ingest-secret': INGEST_SECRET,
      },
      timeout: 180000,
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 500, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode ?? 500, body: { raw: body.substring(0, 500) } });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    form.pipe(req);
  });
}

/**
 * Check if an address object contains a real street address (not a filename)
 */
function isRealAddress(addr: any): boolean {
  if (!addr?.street || !addr?.city) return false;
  const s = addr.street.toLowerCase();
  if (s.includes('.pdf') || s.includes('.xls') || s.includes('.doc')) return false;
  if (s.includes('modified') || s.includes('teaser') || s.includes('memorandum')) return false;
  if (s.includes('t12') || s.includes('rent roll') || s.includes('operating budget')) return false;
  if (s.includes('tax bill') || s.includes('financials')) return false;
  if (s === addr.parcelId || addr.street.length < 6) return false;
  // A real street address typically has both letters and numbers
  if (/[a-z]/i.test(addr.street) && /\d/.test(addr.street)) return true;
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const limitI = args.indexOf('--limit');
  const limit = limitI >= 0 ? parseInt(args[limitI + 1], 10) : 0;
  const parcelIdx = args.indexOf('--parcel');
  const singleParcel = parcelIdx >= 0 ? args[parcelIdx + 1] : null;

  const pool = getPool();
  const state = loadState();

  // Get all properties
  const { rows } = await pool.query(
    'SELECT parcel_id, property_name, address FROM property_descriptions ORDER BY parcel_id'
  );

  let targets = rows as { parcel_id: string; property_name: string; address: any }[];
  console.log(`📋 Loaded ${targets.length} properties from property_descriptions`);

  // Skip done in resume mode
  if (resume) {
    targets = targets.filter(r => !state.properties[r.parcel_id]?.done);
    console.log(`   (${targets.length} remaining after resume filter)`);
  }

  // Single property mode
  if (singleParcel) {
    targets = targets.filter(r => r.parcel_id === singleParcel);
    if (targets.length === 0) { console.error(`Unknown parcel: ${singleParcel}`); process.exit(1); }
  }

  // Limit
  if (limit > 0) targets = targets.slice(0, limit);

  let count = 0;
  let alreadyHadAddress = 0;
  let omFound = 0;
  let addressExtracted = 0;
  let noOm = 0;
  let errors = 0;

  for (const row of targets) {
    count++;
    const pid = row.parcel_id;
    console.log(`\n[${count}/${targets.length}] ${pid}`);

    try {
      // Step 1: Check if already has a real street address
      if (isRealAddress(row.address?.resolved)) {
        const a = row.address.resolved;
        console.log(`   ✓ Already has real address: ${a.street}, ${a.city}`);
        state.properties[pid] = { done: true, address: a.street };
        alreadyHadAddress++;
        continue;
      }

      // Step 2: Find OM PDF in R2
      console.log(`   🔍 Looking for OM PDF in R2...`);
      const omPdf = await findOmPdf(pid);
      
      if (!omPdf) {
        console.log(`   ⚠️ No OM PDF found in R2`);
        state.properties[pid] = { done: true, error: 'No OM PDF in R2' };
        noOm++;
        continue;
      }

      console.log(`   📄 Found: ${omPdf.name} (${(omPdf.buffer.length / 1024).toFixed(0)}KB)`);

      // Step 3: Send to parse-om endpoint
      console.log(`   📤 Sending to parse-om...`);
      const resp = await postFileToParseOm(omPdf.buffer, omPdf.name, pid);

      if (resp.status !== 200) {
        const errMsg = typeof resp.body === 'string' ? resp.body : (resp.body?.error || resp.body?.raw || JSON.stringify(resp.body).substring(0, 200));
        console.log(`   ❌ parse-om returned HTTP ${resp.status}: ${errMsg}`);
        state.properties[pid] = { done: true, error: `HTTP ${resp.status}` };
        errors++;
        continue;
      }

      // Step 4: Extract structured fields from result
      const r = resp.body;
      const street = (r.address || r.streetAddress || '').trim();
      const city = (r.city || r.address?.city || '').trim();
      const stateCode = (r.state || r.address?.state || '').trim();
      const zip = (r.zip || r.address?.zip || '').trim();
      const yearBuilt = r.yearBuilt || null;
      const units = r.units || null;
      const propertyName = r.propertyName || null;

      omFound++;

      // Check if we got a real address
      if (street && city && street.length > 5 && !street.toLowerCase().includes('.pdf')) {
        console.log(`   ✓ Address extracted: ${street}, ${city}, ${stateCode} ${zip}`.trim());
      } else if (city && !street) {
        console.log(`   ⚠️ City known (${city}) but no street address — need to infer from search`);
      } else if (city) {
        console.log(`   ⚠️ City: ${city}, but street "${street}" still looks like a filename`);
      } else {
        console.log(`   ⚠️ No address found in OM`);
        if (propertyName) console.log(`     Property name: ${propertyName}`);
        if (yearBuilt) console.log(`     Year built: ${yearBuilt}`);
        if (units) console.log(`     Units: ${units}`);
        state.properties[pid] = { done: true, error: 'No address in result', yearBuilt, units };
        continue;
      }

      // Step 5: Build LayeredValue JSONB
      const now = new Date().toISOString();
      const addrJson = JSON.stringify({
        resolved: { street, city, state: stateCode, zip },
        layers: {
          om: { value: { street, city, state: stateCode, zip }, source_file_id: pid, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' }
        },
        resolution_rule: 'highest_confidence'
      });

      // Step 6: UPSERT — COALESCE so we don't overwrite manual overrides
      await pool.query(`
        UPDATE property_descriptions 
        SET address = CASE 
          WHEN address IS NULL OR (address->>'resolution_rule' IS DISTINCT FROM 'manual_override') 
          THEN $1::jsonb 
          ELSE address 
        END,
        ${yearBuilt ? `year_built = CASE WHEN year_built IS NULL THEN $3::jsonb ELSE year_built END,` : ''}
        ${units ? `unit_count = CASE WHEN unit_count IS NULL THEN $4::jsonb ELSE unit_count END,` : ''}
        updated_at = NOW()
        WHERE parcel_id = $2
      `, [
        addrJson,
        pid,
        yearBuilt ? JSON.stringify({ resolved: yearBuilt, layers: { om: { value: yearBuilt, source_file_id: pid, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } }, resolution_rule: 'highest_confidence' }) : null,
        units ? JSON.stringify({ resolved: units, layers: { om: { value: units, source_file_id: pid, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' } }, resolution_rule: 'highest_confidence' }) : null,
      ].filter(v => v !== null));

      state.properties[pid] = { done: true, address: street, yearBuilt: yearBuilt ?? undefined, units: units ?? undefined };
      addressExtracted++;
      console.log(`   ✅ Written to DB`);

    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      state.properties[pid] = { done: true, error: err.message };
      errors++;
    }

    // Save state periodically
    if (count % 5 === 0) {
      saveState(state);
      console.log(`   [state saved]`);
    }
  }

  saveState(state);
  
  console.log(`\n══════════════════════════════════════`);
  console.log(`📊 EXTRACTION SUMMARY`);
  console.log(`══════════════════════════════════════`);
  console.log(` Total processed:     ${count}`);
  console.log(` Already had address: ${alreadyHadAddress}`);
  console.log(` OM found:           ${omFound}`);
  console.log(` Address extracted:   ${addressExtracted}`);
  console.log(` No OM in R2:        ${noOm}`);
  console.log(` Errors:              ${errors}`);
  console.log(` State saved to:      ${STATE_PATH}`);

  await pool.end();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
