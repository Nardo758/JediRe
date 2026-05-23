/**
 * om-address-extract.ts
 *
 * Lightweight script that runs ON REPLIT: iterates all 296 property_descriptions
 * rows, calls the local parse-om endpoint for each to extract real addresses,
 * and UPSERTs the results back.
 *
 * Usage: npx ts-node --transpile-only scripts/om-address-extract.ts [--resume] [--limit N] [--parcel PID]
 */

import { getPool } from '../src/database/connection';
import * as fs from 'fs';
import * as path from 'path';

const STATE_PATH = path.resolve(__dirname, '..', 'docs', 'operations', 'OM_ADDRESS_STATE.json');
const PARSE_OM_URL = 'http://localhost:3000/api/v1/archive/parse-om';
const INGEST_SECRET = 'jedire-archive-2026';

interface OmState {
  properties: Record<string, { done: boolean; address?: string; error?: string }>;
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
  let success = 0;
  let addressFound = 0;

  for (const row of targets) {
    count++;
    const pid = row.parcel_id;
    console.log(`[${count}/${targets.length}] ${pid}`);

    try {
      // Check if already has a real address
      const addr = row.address?.resolved;
      if (addr?.street && addr?.city && addr?.street !== pid && !addr.street.toLowerCase().includes('.pdf')) {
        console.log(`   ✓ Already has address: ${addr.street}, ${addr.city}`);
        state.properties[pid] = { done: true, address: addr.street };
        addressFound++;
        continue;
      }

      // Call parse-om
      const resp = await fetch(`${PARSE_OM_URL}?parcelId=${encodeURIComponent(pid)}`, {
        method: 'POST',
        headers: { 'x-ingest-secret': INGEST_SECRET }
      });

      if (!resp.ok) {
        const text = await resp.text();
        // parse-om returns HTML if no OM PDF found
        if (resp.status === 404 || text.includes('<!DOCTYPE html>') || text.includes('No OM')) {
          state.properties[pid] = { done: true, error: 'No OM found' };
          console.log(`   ⚠️ No OM found`);
          continue;
        }
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
      }

      const result = await resp.json();
      
      // Extract address fields from result
      const street = result.address?.street || result.streetAddress || result.street || '';
      const city = result.address?.city || result.city || '';
      const stateCode = result.address?.state || result.state || '';
      const zip = result.address?.zip || result.zip || '';

      if (street && city) {
        console.log(`   ✓ Address: ${street}, ${city}, ${stateCode}`);

        // Build LayeredValue JSONB
        const now = new Date().toISOString();
        const addrJson = JSON.stringify({
          resolved: { street, city, state: stateCode, zip },
          layers: {
            om: { value: { street, city, state: stateCode, zip }, source_file_id: pid, confidence: 0.8, extracted_at: now, source: 'om_pdf_extraction' }
          },
          resolution_rule: 'highest_confidence'
        });

        // UPSERT address (COALESCE — don't overwrite manual overrides)
        await pool.query(`
          UPDATE property_descriptions 
          SET address = CASE 
            WHEN address IS NULL OR (address->>'resolution_rule' IS DISTINCT FROM 'manual_override') 
            THEN $1::jsonb 
            ELSE address 
          END,
          updated_at = NOW()
          WHERE parcel_id = $2
        `, [addrJson, pid]);

        state.properties[pid] = { done: true, address: street };
        addressFound++;
        success++;
      } else {
        console.log(`   ⚠️ OM parsed but no address found in result`);
        state.properties[pid] = { done: true, error: 'No address in result' };
      }

    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      state.properties[pid] = { done: true, error: err.message };
    }

    // Save state periodically
    if (count % 10 === 0) saveState(state);
  }

  saveState(state);
  console.log(`\n══════════════════════════════════════`);
  console.log(`📊 EXTRACTION SUMMARY`);
  console.log(`══════════════════════════════════════`);
  console.log(` Total processed: ${count}`);
  console.log(` Addresses found: ${addressFound}`);
  console.log(` State saved to: ${STATE_PATH}`);

  await pool.end();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
