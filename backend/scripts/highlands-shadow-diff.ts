/**
 * W-B Phase 2 — Highlands shadow-diff (blocker #4).
 *
 * Captures the currently-persisted periodic_seed for Highlands (Task #4 "before"
 * snapshot), then runs the real seedProFormaYear1 reseed (which persists the
 * "after" seed), and diffs noi period-by-period. Expectation per dispatch: the
 * ONLY differences should be in the gap zone (data-lag re-trend), since
 * Highlands has property_id set but zero traffic_projections rows today — so
 * fetchTrafficEngineMonthsToStabilization should return null and resolution
 * should fall through to platform_default, same as before this session's work
 * touched anything else.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/highlands-shadow-diff.ts
 */
import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

const HIGHLANDS_DEAL_ID = 'eaabeb9f-830e-44f9-a923-56679ad0329d';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const before = await pool.query(
    `SELECT periodic_seed FROM deal_assumptions WHERE deal_id = $1`,
    [HIGHLANDS_DEAL_ID]
  );
  const beforeSeed = before.rows[0]?.periodic_seed ?? null;

  console.log('[shadow-diff] Running seedProFormaYear1 (persists new seed)...');
  const result = await seedProFormaYear1(pool, HIGHLANDS_DEAL_ID);
  console.log('[shadow-diff] seedProFormaYear1 result:', JSON.stringify(result, null, 2));

  if (!result.seeded) {
    console.error('[shadow-diff] ERROR: seeder returned seeded=false.');
    await pool.end();
    process.exit(1);
  }

  const after = await pool.query(
    `SELECT periodic_seed FROM deal_assumptions WHERE deal_id = $1`,
    [HIGHLANDS_DEAL_ID]
  );
  const afterSeed = after.rows[0]?.periodic_seed;

  console.log('\n[shadow-diff] Boundary before:', JSON.stringify(beforeSeed?.boundary));
  console.log('[shadow-diff] Boundary after: ', JSON.stringify(afterSeed?.boundary));

  const beforeNoi: any[] = beforeSeed?.fields?.noi?.periods ?? [];
  const afterNoi: any[] = afterSeed?.fields?.noi?.periods ?? [];

  const beforeByMonth = new Map(beforeNoi.map(p => [p.month, p]));
  const diffsByZone: Record<string, number> = {};
  const sampleDiffs: any[] = [];

  for (const ap of afterNoi) {
    const bp = beforeByMonth.get(ap.month);
    if (!bp) {
      diffsByZone['new_month'] = (diffsByZone['new_month'] ?? 0) + 1;
      continue;
    }
    const changed = bp.resolved !== ap.resolved || bp.zone !== ap.zone || bp.resolution !== ap.resolution;
    if (changed) {
      diffsByZone[ap.zone] = (diffsByZone[ap.zone] ?? 0) + 1;
      if (sampleDiffs.length < 8) {
        sampleDiffs.push({ month: ap.month, before: bp, after: ap });
      }
    }
  }

  console.log('\n[shadow-diff] Diff counts by zone (after seed):', JSON.stringify(diffsByZone, null, 2));
  console.log('[shadow-diff] Sample diffs (up to 8):', JSON.stringify(sampleDiffs, null, 2));

  const onlyGapZoneDiff = Object.keys(diffsByZone).every(z => z === 'gap' || z === 'new_month');
  console.log(`\n[shadow-diff] Diff confined to gap zone / new months only: ${onlyGapZoneDiff}`);

  // Acceptance sample fields for the persisted "after" seed.
  const egi = afterSeed?.fields?.egi?.periods?.find((p: any) => p.zone === 'actual');
  console.log('\n[shadow-diff] Sample actual EGI period:', JSON.stringify(egi));

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[shadow-diff] Fatal:', err);
  process.exit(1);
});
