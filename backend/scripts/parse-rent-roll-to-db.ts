/**
 * parse-rent-roll-to-db.ts
 *
 * Reads ResAnalytics Rent Roll Excel files (stored locally) for Highlands (p2122),
 * parses them using the existing parseRentRoll function, and inserts rows into
 * `rent_roll_units` (unique constraint: deal_id, unit_number, as_of_date).
 *
 * Usage: npx ts-node --transpile-only scripts/parse-rent-roll-to-db.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { parseRentRoll } from '../src/services/document-extraction/parsers/rent-roll-parser';
import { RentRollUnit } from '../src/services/document-extraction/types';

const DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';
const DRY_RUN = process.argv.includes('--dry-run');
// file_path in deal_files is relative to backend/ (process.cwd() when the server runs)
const BACKEND_ROOT = path.resolve(__dirname, '..');

// Derive last-day-of-month from filename suffix like "p21221224" → Dec 2024 → 2024-12-31
function derivePeriodFromFilename(filename: string): string | null {
  // Match pattern p2122_p{MMYY}_... e.g. "p21221224" → MMYY = 1224 → Dec 2024
  // The segment after the property code looks like "p21221224" = p2122 + 1224
  const m = filename.match(/p2122(?:_p2122)?(\d{2})(\d{2})(?:_|\b)/);
  if (!m) {
    // No period suffix: files uploaded without period are the Dec 2021 snapshots
    // (they share the same ~1780257062xxx timestamp as the Dec 2021 trial balance)
    if (/p2122_\d{13}/.test(filename)) return '2021-12-31';
    return null;
  }
  const mm = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  const year = 2000 + yy;
  if (mm < 1 || mm > 12) return null;
  // Last day of that month
  const lastDay = new Date(year, mm, 0); // day 0 of next month = last day of this month
  return lastDay.toISOString().slice(0, 10);
}

// Infer unit status from RentRollUnit fields
function inferStatus(u: RentRollUnit): string {
  if (u.isFutureResident) return 'future';
  const s = (u.status ?? '').toLowerCase().trim();
  if (s.includes('vacant') || s === 'v') return 'vacant';
  if (s.includes('notice') || s === 'n') return 'notice';
  if (s.includes('occup') || s === 'o') return 'occupied';
  // If there's a tenant name or lease rent, assume occupied
  if (u.tenantName || u.leaseRent) return 'occupied';
  return 'vacant';
}

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log(`[RR→DB] Starting${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`[RR→DB] Backend root: ${BACKEND_ROOT}`);

  const filesRes = await db.query(
    `SELECT id, filename, file_path
     FROM deal_files
     WHERE deal_id = $1 AND folder_path = '/Rent_Roll'
     ORDER BY created_at`,
    [DEAL_ID]
  );

  const files = filesRes.rows;
  console.log(`[RR→DB] Found ${files.length} rent roll file(s)`);

  let totalInserted = 0;
  let skipped = 0;

  for (const file of files) {
    const localPath = path.join(BACKEND_ROOT, file.file_path as string);
    console.log(`\n[RR→DB] Processing: ${file.filename}`);

    if (!fs.existsSync(localPath)) {
      console.error(`  ✗ File not found on disk: ${localPath}`);
      skipped++;
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    console.log(`  Read ${buffer.length} bytes`);

    const result = parseRentRoll(buffer, file.filename);
    if (!result.success || !result.data) {
      console.error(`  ✗ Parse failed: ${result.error}`);
      if (result.warnings?.length) console.warn(`  Warnings: ${result.warnings.join('; ')}`);
      skipped++;
      continue;
    }

    if (result.warnings?.length) console.warn(`  Warnings: ${result.warnings.join('; ')}`);

    const rrData = result.data as any;
    const units: RentRollUnit[] = rrData.units ?? [];

    // Determine as_of_date: parser's asOfDate takes priority; fall back to filename
    let asOfDate: string | null = (rrData as any).as_of_date ?? null;
    if (!asOfDate) {
      asOfDate = derivePeriodFromFilename(file.filename);
    }
    if (!asOfDate) {
      // Last resort: use file's created_at date
      asOfDate = new Date().toISOString().slice(0, 10);
      console.warn(`  Could not determine as_of_date from file; using today: ${asOfDate}`);
    }

    const summary = rrData.summary ?? {};
    console.log(`  as_of_date: ${asOfDate} | Units: ${units.length} | Occupied: ${summary.occupiedUnits ?? '?'} | Occ%: ${((summary.occupancyRate ?? 0) * 100).toFixed(1)}%`);

    if (units.length === 0) {
      console.warn('  No units extracted — skipping file');
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      const sample = units.slice(0, 3);
      console.log('  Sample units:', sample.map(u => `${u.unitNumber}(${u.unitType}) mkt=$${u.marketRent} eff=$${u.effectiveRent ?? u.leaseRent}`).join(', '));
      console.log('  [DRY RUN] Skipping insert');
      continue;
    }

    // Batch insert all units for this snapshot
    const client = await db.connect();
    let insertedForFile = 0;
    try {
      await client.query('BEGIN');

      for (const u of units) {
        const status = inferStatus(u);
        const currentRent = u.effectiveRent ?? u.leaseRent ?? null;
        const lossToLease = (u.marketRent != null && currentRent != null)
          ? u.marketRent - currentRent : null;
        const lossToLeasePct = (u.marketRent != null && u.marketRent > 0 && lossToLease != null)
          ? lossToLease / u.marketRent : null;

        await client.query(
          `INSERT INTO rent_roll_units (
             deal_id, unit_number, unit_type, sqft,
             resident_name,
             lease_start, lease_end,
             market_rent, current_rent,
             status,
             move_in_date, move_out_date,
             current_balance,
             as_of_date
           ) VALUES (
             $1, $2, $3, $4,
             $5,
             $6, $7,
             $8, $9,
             $10,
             $11, $12,
             $13,
             $14
           )
           ON CONFLICT (deal_id, unit_number, as_of_date) DO UPDATE SET
             unit_type       = EXCLUDED.unit_type,
             sqft            = EXCLUDED.sqft,
             resident_name   = EXCLUDED.resident_name,
             lease_start     = EXCLUDED.lease_start,
             lease_end       = EXCLUDED.lease_end,
             market_rent     = EXCLUDED.market_rent,
             current_rent    = EXCLUDED.current_rent,
             status          = EXCLUDED.status,
             move_in_date    = EXCLUDED.move_in_date,
             move_out_date   = EXCLUDED.move_out_date,
             current_balance = EXCLUDED.current_balance`,
          [
            DEAL_ID,
            u.unitNumber,
            u.unitType ?? null,
            u.sqft ?? null,
            u.tenantName ?? null,
            u.leaseStart ?? null,
            u.leaseEnd ?? null,
            u.marketRent ?? null,
            currentRent,
            status,
            u.moveInDate ?? null,
            u.moveOutDate ?? null,
            u.balance ?? null,
            asOfDate,
          ]
        );
        insertedForFile++;
      }

      await client.query('COMMIT');
      console.log(`  ✓ Upserted ${insertedForFile} unit rows for ${asOfDate}`);
      totalInserted += insertedForFile;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`  ✗ Insert failed: ${err.message}`);
      skipped++;
    } finally {
      client.release();
    }
  }

  console.log(`\n[RR→DB] Done — ${totalInserted} rows upserted across ${files.length - skipped} files, ${skipped} skipped`);
  await db.end();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
