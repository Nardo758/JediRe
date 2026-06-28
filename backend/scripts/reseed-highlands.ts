/**
 * One-off re-seed script for Highlands at Satellite (eaabeb9f-...).
 * Calls seedProFormaYear1 directly (bypasses ensureDealAssumptionsSeeded's
 * extraction-data guard, which incorrectly skips portfolio-asset deals).
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/reseed-highlands.ts
 */
import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

const HIGHLANDS_DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log(`[reseed] Force re-seeding Highlands (${HIGHLANDS_DEAL_ID}) via seedProFormaYear1…`);

  const result = await seedProFormaYear1(pool, HIGHLANDS_DEAL_ID);
  console.log('[reseed] seedProFormaYear1 result:', JSON.stringify(result, null, 2));

  if (!result.seeded) {
    console.error('[reseed] ERROR: seeder returned seeded=false. Check warnings above.');
    await pool.end();
    process.exit(1);
  }

  // Verify the new JSONB
  const verify = await pool.query(`
    SELECT
      periodic_seed->'fields'->'rent_growth' IS NOT NULL                          AS has_rent_growth,
      periodic_seed->'boundary'->>'has_projection'                                AS has_projection,
      periodic_seed->'boundary'->>'first_projection_month'                        AS first_projection_month,
      periodic_seed->'boundary'->>'actuals_through_month'                         AS actuals_through_month,
      jsonb_array_length(periodic_seed->'fields'->'rent_growth'->'periods')       AS rg_periods,
      (SELECT p->>'resolved'
         FROM jsonb_array_elements(
           periodic_seed->'fields'->'rent_growth'->'periods'
         ) AS p
        WHERE p->>'zone' = 'projection'
        LIMIT 1)                                                                   AS rg_projection_sample
    FROM deal_assumptions
    WHERE deal_id = $1
  `, [HIGHLANDS_DEAL_ID]);

  const row = verify.rows[0];
  if (!row) {
    console.error('[reseed] ERROR: deal_assumptions row not found after re-seed');
    process.exit(1);
  }

  console.log('\n[reseed] Post-seed verification:');
  console.log(`  has_rent_growth:        ${row.has_rent_growth}`);
  console.log(`  has_projection:         ${row.has_projection}`);
  console.log(`  first_projection_month: ${row.first_projection_month}`);
  console.log(`  actuals_through_month:  ${row.actuals_through_month}`);
  console.log(`  rg_periods:             ${row.rg_periods}`);
  console.log(`  rg_projection_sample:   ${row.rg_projection_sample}`);

  const pass =
    row.has_rent_growth === true &&
    row.has_projection === 'true' &&
    row.first_projection_month != null;

  if (pass) {
    console.log('\n✅  Re-seed PASSED — rent_growth populated, boundary correct.');
  } else {
    console.error('\n❌  Re-seed checks FAILED — see values above.');
    process.exit(1);
  }

  await pool.end();
}

main().catch(err => {
  console.error('[reseed] Fatal:', err);
  process.exit(1);
});
