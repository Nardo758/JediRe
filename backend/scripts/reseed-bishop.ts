/**
 * One-off re-seed script for 464 Bishop (3f32276f-...).
 * Calls seedProFormaYear1 directly to pick up the deriveProjectionForSeed
 * fix (commit f7b1ac96e) which post-dated Bishop's last seed by ~2 hours.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/reseed-bishop.ts
 */
import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

const BISHOP_DEAL_ID = '3f32276f-aacd-4da3-b306-317c5109b403';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log(`[reseed] Force re-seeding Bishop (${BISHOP_DEAL_ID}) via seedProFormaYear1…`);

  const result = await seedProFormaYear1(pool, BISHOP_DEAL_ID);
  console.log('[reseed] seedProFormaYear1 result:', JSON.stringify(result, null, 2));

  if (!result.seeded) {
    console.error('[reseed] ERROR: seeder returned seeded=false. Check warnings above.');
    await pool.end();
    process.exit(1);
  }

  const verify = await pool.query(`
    SELECT
      periodic_seed->'boundary' AS boundary,
      jsonb_array_length(periodic_seed->'fields'->'noi'->'periods') AS total_periods,
      (SELECT jsonb_agg(p->>'zone')
         FROM jsonb_array_elements(periodic_seed->'fields'->'noi'->'periods') AS p) AS zones_raw
    FROM deal_assumptions
    WHERE deal_id = $1
  `, [BISHOP_DEAL_ID]);

  const row = verify.rows[0];
  if (!row) {
    console.error('[reseed] ERROR: deal_assumptions row not found after re-seed');
    process.exit(1);
  }

  const zones: string[] = row.zones_raw ?? [];
  const zoneCounts: Record<string, number> = {};
  for (const z of zones) zoneCounts[z] = (zoneCounts[z] ?? 0) + 1;

  console.log('\n[reseed] Post-seed verification (noi field):');
  console.log('  boundary:', JSON.stringify(row.boundary));
  console.log('  total_periods:', row.total_periods);
  console.log('  zone_counts:', JSON.stringify(zoneCounts));

  const noiPeriods = await pool.query(`
    SELECT periodic_seed->'fields'->'noi'->'periods' AS periods
    FROM deal_assumptions WHERE deal_id = $1
  `, [BISHOP_DEAL_ID]);
  const periods = noiPeriods.rows[0].periods as Array<{ month: string; zone: string; resolved: number | null; resolution: string }>;

  const lastActual = [...periods].reverse().find(p => p.zone === 'actual');
  const firstGap = periods.find(p => p.zone === 'gap');
  const firstProj = periods.find(p => p.zone === 'projection');
  const last5 = periods.filter(p => p.zone === 'actual').slice(-3);
  const proj5 = periods.filter(p => p.zone === 'projection').slice(0, 5);
  const projLast5 = periods.filter(p => p.zone === 'projection').slice(-5);

  console.log('\n  Last 3 actual periods:', JSON.stringify(last5));
  console.log('  First gap period:', JSON.stringify(firstGap ?? 'NONE'));
  console.log('  First 5 projection periods:', JSON.stringify(proj5));
  console.log('  Last 5 projection periods:', JSON.stringify(projLast5));
  console.log('  Last actual -> first projection step:', JSON.stringify({ lastActual, firstProj }));

  await pool.end();
}

main().catch(err => {
  console.error('[reseed] Fatal:', err);
  process.exit(1);
});
