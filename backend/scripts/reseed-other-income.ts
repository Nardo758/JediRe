/**
 * Reseed Other Income Per Unit — Backfill Script (Part B, Item 3)
 *
 * Targets deals where other_income_per_unit.resolved diverges from the
 * correctly computed (breakdownSum + userLinesAnnual) / totalUnits / 12.
 * This catches deals seeded before Task #519 added the breakdown override to
 * the seeder, where the aggregate was set by an older calculation path instead
 * of being derived from the per-category breakdown.
 *
 * IMPORTANT — user-added income lines:
 *   The "expected" value MUST include other_income_user_lines (e.g. Cable,
 *   RUBS overrides added via the F11 user-line CRUD). A deal is only truly
 *   stale when stored != (breakdownSum + userLinesAnnual) / units / 12.
 *   The earlier Phase 0 validation used breakdownSum alone and incorrectly
 *   flagged 464 Bishop as stale; the stored 75.34 is correct once the
 *   $11,600/month Cable user line is included.
 *
 * Build order (per audit doc): run this script with --dry-run first to
 * confirm candidates, THEN ship the extraction pipeline hook (Part A).
 *
 * Selection criteria (deal must match ALL):
 *   1. deal_assumptions.year1 IS NOT NULL
 *   2. Has at least one extraction capsule (extraction_t12 / extraction_rent_roll / extraction_om)
 *   3. other_income_per_unit.resolution != 'override'  (not user-set)
 *   4. (breakdownSum + userLinesAnnual) > 0 AND stored resolved diverges > 1%
 *      from (breakdownSum + userLinesAnnual) / totalUnits / 12
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/reseed-other-income.ts
 *   cd backend && npx ts-node --transpile-only scripts/reseed-other-income.ts --dry-run
 *   cd backend && npx ts-node --transpile-only scripts/reseed-other-income.ts --dealId=3f32276f-aacd-4da3-b306-317c5109b403
 *   cd backend && npx ts-node --transpile-only scripts/reseed-other-income.ts --no-dry-run
 *   cd backend && npx ts-node --transpile-only scripts/reseed-other-income.ts --no-dry-run --batch-size=20
 *
 * Re-runnable: deals already correctly seeded are skipped (divergence ≤ 1%).
 *
 * INVARIANT: Only refreshes fields whose resolution != 'override'.
 * Operator-set overrides on all fields (gpr, vacancy_pct, etc.) are preserved
 * because seedProFormaYear1 reads the existing year1 and carries forward the
 * override layer before recomputing extraction-derived layers.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { seedProFormaYear1 } from '../src/services/proforma-seeder.service';

interface Args {
  dryRun: boolean;
  dealId: string | null;
  batchSize: number;
}

function parseArgs(): Args {
  const args: Args = { dryRun: true, dealId: null, batchSize: 50 };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-dry-run') args.dryRun = false;
    else if (a.startsWith('--dealId=')) args.dealId = a.slice('--dealId='.length);
    else if (a.startsWith('--batch-size=')) {
      const n = parseInt(a.slice('--batch-size='.length), 10);
      if (!isNaN(n) && n > 0) args.batchSize = n;
    }
  }
  return args;
}

const BREAKDOWN_KEYS = [
  'parking', 'pet', 'storage', 'rubs',
  'laundry', 'fees', 'insurance_admin', 'other',
];

const BREAKDOWN_SUM_SQL = BREAKDOWN_KEYS.map(k =>
  `COALESCE((da.year1->'other_income_breakdown'->'${k}'->>'resolved')::float, 0)`
).join(' +\n      ');

const QUALIFYING_QUERY = `
  SELECT
    d.id,
    d.name,
    COALESCE(da.total_units, 0)::int AS total_units,
    (da.year1->'other_income_per_unit'->>'resolved')::float AS stored_resolved,
    da.year1->'other_income_per_unit'->>'resolution' AS resolution,
    da.year1->'other_income_per_unit'->>'updated_at' AS seed_updated_at,
    ${BREAKDOWN_SUM_SQL} AS breakdown_sum_annual,
    COALESCE((
      SELECT SUM((elem->>'monthly')::float * 12)
      FROM jsonb_array_elements(
        COALESCE(da.year1->'other_income_user_lines', '[]'::jsonb)
      ) AS elem
      WHERE (elem->>'monthly') IS NOT NULL
        AND (elem->>'monthly')::float > 0
    ), 0) AS user_lines_annual
  FROM deals d
  JOIN deal_assumptions da ON da.deal_id = d.id
  WHERE da.year1 IS NOT NULL
    AND COALESCE(da.total_units, 0) > 0
    AND (da.year1->'other_income_per_unit'->>'resolution') IS DISTINCT FROM 'override'
    AND (da.year1->'other_income_per_unit'->>'resolved') IS NOT NULL
    AND (
      (d.deal_data->'extraction_t12')    IS NOT NULL OR
      (d.deal_data->'extraction_rent_roll') IS NOT NULL OR
      (d.deal_data->'extraction_om')     IS NOT NULL
    )
`;

interface DealRow {
  id: string;
  name: string;
  total_units: number;
  stored_resolved: number;
  resolution: string;
  seed_updated_at: string | null;
  breakdown_sum_annual: number;
  user_lines_annual: number;
}

interface QualifyingDeal {
  id: string;
  name: string;
  totalUnits: number;
  storedResolved: number;
  expectedResolved: number;
  divergencePct: number;
  resolution: string;
  seedUpdatedAt: string | null;
}

function qualify(row: DealRow): QualifyingDeal | null {
  const { total_units, stored_resolved, breakdown_sum_annual, user_lines_annual } = row;
  // Expected matches the seeder's formula: (breakdownSum + userLinesAnnual) / units / 12.
  // MUST include user lines — operator-added income lines (e.g. Cable, RUBS) are
  // part of otherIncomeForEgi in buildSeed and shift the per-unit aggregate.
  const otherIncomeForEgi = breakdown_sum_annual + (user_lines_annual ?? 0);
  if (otherIncomeForEgi <= 0) return null;
  const expectedResolved = otherIncomeForEgi / total_units / 12;
  if (expectedResolved <= 0) return null;
  const divergencePct = Math.abs(stored_resolved - expectedResolved) / expectedResolved;
  if (divergencePct <= 0.01) return null; // within 1% tolerance — already correct
  return {
    id: row.id,
    name: row.name.trim(),
    totalUnits: total_units,
    storedResolved: stored_resolved,
    expectedResolved,
    divergencePct,
    resolution: row.resolution,
    seedUpdatedAt: row.seed_updated_at,
  };
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

async function main() {
  const args = parseArgs();

  console.log('');
  console.log('[ReseedOtherIncome] ══════════════════════════════════════════════');
  console.log(`[ReseedOtherIncome] Mode      : ${args.dryRun ? 'DRY-RUN (no data written)' : 'PRODUCTION'}`);
  console.log(`[ReseedOtherIncome] Target    : ${args.dealId ?? 'all qualifying deals'}`);
  if (!args.dryRun) {
    console.log(`[ReseedOtherIncome] Batch size: ${args.batchSize}`);
  }
  console.log('[ReseedOtherIncome] ══════════════════════════════════════════════');
  console.log('');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ── 1. Fetch candidates ──────────────────────────────────────────────────
    let query = QUALIFYING_QUERY;
    const params: string[] = [];

    if (args.dealId) {
      query += ` AND d.id = $1`;
      params.push(args.dealId);
    }

    query += ` ORDER BY d.name`;

    if (!args.dryRun && !args.dealId) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(String(args.batchSize));
    }

    const res = await pool.query<DealRow>(query, params);
    const candidates = res.rows;

    console.log(`[ReseedOtherIncome] Candidates fetched: ${candidates.length}`);
    console.log('');

    // ── 2. Apply qualification criteria ─────────────────────────────────────
    const qualifying: QualifyingDeal[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    for (const row of candidates) {
      const q = qualify(row);
      if (q) {
        qualifying.push(q);
      } else {
        const otherIncomeForEgi = row.breakdown_sum_annual + (row.user_lines_annual ?? 0);
        const expected = otherIncomeForEgi > 0
          ? otherIncomeForEgi / row.total_units / 12
          : 0;
        const userLineNote = row.user_lines_annual > 0
          ? ` (+$${Math.round(row.user_lines_annual).toLocaleString()}/yr user lines)`
          : '';
        skipped.push({
          name: row.name.trim(),
          reason: otherIncomeForEgi <= 0
            ? 'breakdown_sum + user_lines = 0 (no per-category data)'
            : `within tolerance: stored=${fmt(row.stored_resolved)} expected=${fmt(expected)}${userLineNote} (${fmt(Math.abs(row.stored_resolved - expected) / Math.max(expected, 0.001) * 100, 1)}%)`,
        });
      }
    }

    // ── 3. Report plan ───────────────────────────────────────────────────────
    console.log(`[ReseedOtherIncome] Qualifying (diverged > 1%): ${qualifying.length}`);
    console.log(`[ReseedOtherIncome] Already-correct (skipped) : ${skipped.length}`);
    console.log('');

    if (skipped.length > 0) {
      console.log('[ReseedOtherIncome] ── SKIPPED (already correct) ──────────────────');
      for (const s of skipped) {
        console.log(`  ✓ ${s.name}: ${s.reason}`);
      }
      console.log('');
    }

    if (qualifying.length === 0) {
      console.log('[ReseedOtherIncome] Nothing to reseed. All deals are correctly seeded.');
      return;
    }

    console.log('[ReseedOtherIncome] ── QUALIFYING DEALS (will reseed) ─────────────');
    for (const q of qualifying) {
      const annualBefore = q.storedResolved * q.totalUnits * 12;
      const annualAfter  = q.expectedResolved * q.totalUnits * 12;
      console.log(`  ✗ ${q.name} (${q.id})`);
      console.log(`      units         : ${q.totalUnits}`);
      console.log(`      resolution    : ${q.resolution}`);
      console.log(`      stored  $/u/mo: ${fmt(q.storedResolved)} → annual total $${Math.round(annualBefore).toLocaleString()}`);
      console.log(`      expected$/u/mo: ${fmt(q.expectedResolved)} → annual total $${Math.round(annualAfter).toLocaleString()}`);
      console.log(`      divergence    : ${fmt(q.divergencePct * 100, 1)}%`);
      console.log(`      seed updated  : ${q.seedUpdatedAt ?? 'unknown'}`);
    }
    console.log('');

    if (args.dryRun) {
      console.log('[ReseedOtherIncome] DRY-RUN complete. Re-run with --no-dry-run to apply.');
      console.log(`[ReseedOtherIncome] ${qualifying.length} deal(s) would be reseeded.`);
      return;
    }

    // ── 4. Production reseed ─────────────────────────────────────────────────
    console.log('[ReseedOtherIncome] ── APPLYING RESEED ────────────────────────────');
    let ok = 0;
    let failed = 0;
    const failures: Array<{ name: string; error: string }> = [];

    for (const q of qualifying) {
      try {
        // Read before-state for confirmation log
        const beforeRes = await pool.query<{ resolved: string }>(
          `SELECT (year1->'other_income_per_unit'->>'resolved')::float AS resolved
           FROM deal_assumptions WHERE deal_id = $1`,
          [q.id]
        );
        const before = parseFloat(beforeRes.rows[0]?.resolved ?? 'NaN');

        // CRITICAL: seedProFormaYear1 reads the existing year1 first (preserving
        // operator override layers), then recomputes extraction-derived values.
        // Fields with resolution='override' are NOT clobbered.
        const result = await seedProFormaYear1(pool, q.id);

        if (!result.seeded) {
          const reason = result.warnings.join('; ') || 'seeder returned seeded=false';
          failures.push({ name: q.name, error: reason });
          failed++;
          console.error(`  ✗ ${q.name}: ${reason}`);
          continue;
        }

        // Read after-state to confirm the fix
        const afterRes = await pool.query<{ resolved: string }>(
          `SELECT (year1->'other_income_per_unit'->>'resolved')::float AS resolved
           FROM deal_assumptions WHERE deal_id = $1`,
          [q.id]
        );
        const after = parseFloat(afterRes.rows[0]?.resolved ?? 'NaN');

        ok++;
        console.log(`  ✓ ${q.name}: ${fmt(before)} → ${fmt(after)} $/u/mo (expected ${fmt(q.expectedResolved)})`);

        if (result.warnings.length > 0) {
          for (const w of result.warnings) {
            console.warn(`    [warn] ${w}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ name: q.name, error: msg });
        failed++;
        console.error(`  ✗ ${q.name}: ${msg}`);
      }
    }

    // ── 5. Summary ───────────────────────────────────────────────────────────
    console.log('');
    console.log('[ReseedOtherIncome] ══════════════════════════════════════════════');
    console.log(`[ReseedOtherIncome] Done. OK: ${ok}  Failed: ${failed}`);
    if (failures.length > 0) {
      console.log('[ReseedOtherIncome] Failures:');
      for (const f of failures) {
        console.error(`  - ${f.name}: ${f.error}`);
      }
    }
    console.log('[ReseedOtherIncome] ══════════════════════════════════════════════');
    console.log('');

    if (failed > 0) process.exitCode = 1;

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[ReseedOtherIncome] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
