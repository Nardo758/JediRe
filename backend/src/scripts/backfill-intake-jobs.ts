/**
 * Backfill intake_jobs for Apartment Locator properties
 *
 * Queries properties WHERE apartment_locator_id IS NOT NULL and creates
 * an intake_jobs entry (state='pending') for each that doesn't have one yet.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-intake-jobs.ts
 *
 * Flags:
 *   --dry-run        Print counts without inserting
 *   --city=Atlanta   Restrict to a specific city
 *   --state=GA       Restrict to a specific state code
 */

import { query, connectDatabase } from '../database/connection';
import { logger } from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const cityArg = args.find((a) => a.startsWith('--city='))?.split('=')[1];
  const stateArg = args.find((a) => a.startsWith('--state='))?.split('=')[1];

  await connectDatabase();

  // Build WHERE clause
  const conditions: string[] = ['p.apartment_locator_id IS NOT NULL'];
  const params: (string | number)[] = [];
  if (cityArg) {
    params.push(cityArg);
    conditions.push(`LOWER(p.city) = LOWER($${params.length})`);
  }
  if (stateArg) {
    params.push(stateArg);
    conditions.push(`p.state_code = $${params.length}`);
  }
  const whereClause = conditions.join(' AND ');

  // Count total eligible
  const totalRes = await query(
    `SELECT COUNT(*) AS total FROM properties p WHERE ${whereClause}`,
    params
  );
  const total = parseInt(totalRes.rows[0].total, 10);
  console.log(`\n[backfill] Total properties with apartment_locator_id: ${total}`);

  // Count already have an intake_job
  const existingRes = await query(
    `SELECT COUNT(*) AS already
     FROM properties p
     WHERE ${whereClause}
       AND EXISTS (
         SELECT 1 FROM intake_jobs j
         WHERE LOWER(j.parcel_id) = LOWER(COALESCE(p.name, p.address_line1))
       )`,
    params
  );
  const alreadyHaveJob = parseInt(existingRes.rows[0].already, 10);
  console.log(`[backfill] Already have an intake_job:       ${alreadyHaveJob}`);
  console.log(`[backfill] Need new intake_job entries:       ${total - alreadyHaveJob}`);

  if (dryRun) {
    console.log('\n[backfill] --dry-run mode: no inserts performed.\n');
    process.exit(0);
  }

  // Fetch properties that need jobs
  const needRes = await query<{
    id: string;
    name: string | null;
    address_line1: string | null;
    city: string | null;
    state_code: string | null;
    apartment_locator_id: string;
    units: number | null;
    rent: number | null;
  }>(
    `SELECT p.id, p.name, p.address_line1, p.city, p.state_code,
            p.apartment_locator_id, p.units, p.rent
     FROM properties p
     WHERE ${whereClause}
       AND NOT EXISTS (
         SELECT 1 FROM intake_jobs j
         WHERE LOWER(j.parcel_id) = LOWER(COALESCE(p.name, p.address_line1))
       )
     ORDER BY p.city, p.name`,
    params
  );

  let created = 0;
  let errored = 0;

  for (const prop of needRes.rows) {
    const parcelId = prop.name || prop.address_line1;
    if (!parcelId) {
      console.warn(`[backfill] Skipping property ${prop.id} — no name or address`);
      continue;
    }
    try {
      await query(
        `INSERT INTO intake_jobs (parcel_id, state, source_type, source_data)
         VALUES ($1, 'pending', 'apartment_locator', $2::jsonb)
         ON CONFLICT DO NOTHING`,
        [
          parcelId,
          JSON.stringify({
            property_id: prop.id,
            apartment_locator_id: prop.apartment_locator_id,
            name: prop.name,
            address: prop.address_line1,
            city: prop.city,
            state: prop.state_code,
            units: prop.units,
            rent: prop.rent,
          }),
        ]
      );
      created++;
    } catch (err: any) {
      logger.error(`[backfill] Failed to insert job for ${parcelId}`, { error: err.message });
      errored++;
    }
  }

  console.log(`\n[backfill] Done.`);
  console.log(`[backfill]   Created: ${created}`);
  console.log(`[backfill]   Errors:  ${errored}`);
  console.log(`[backfill]   Total eligible: ${total}`);
  console.log(`[backfill]   Already had job: ${alreadyHaveJob}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
