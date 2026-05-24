/**
 * reset-intake-jobs-by-state.ts
 *
 * Admin utility: reset blocked intake_jobs back to `pending` for a given
 * US state code so the worker re-processes them through the municipal
 * enrichment chain, then prints a before/after resolution summary.
 *
 * Usage:
 *   cd backend
 *   npx ts-node --transpile-only scripts/reset-intake-jobs-by-state.ts --state=GA
 *
 * Flags:
 *   --state=XX        (required) Two-letter US state abbreviation, e.g. GA, NC, TX
 *   --dry-run         Print what would be reset without modifying the DB
 *   --include-failed  Also reset jobs in `failed` state (default: blocked_needs_user only)
 */

import { query } from '../src/database/connection';
import { logger } from '../src/utils/logger';

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const stateCode: string = (args['state'] as string | undefined)?.toUpperCase() ?? '';
const dryRun = !!args['dry-run'];
const includeFailed = !!args['include-failed'];

if (!stateCode) {
  console.error('Error: --state=XX is required (e.g. --state=GA)');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDistribution(state: string): Promise<Record<string, number>> {
  const res = await query<{ state: string; count: string }>(
    `SELECT state, COUNT(*)::text AS count
     FROM intake_jobs
     WHERE source_data->>'state' = $1
     GROUP BY state
     ORDER BY state`,
    [state]
  );
  return Object.fromEntries(res.rows.map((r) => [r.state, parseInt(r.count, 10)]));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info(`[reset-intake] state=${stateCode} dry-run=${dryRun} include-failed=${includeFailed}`);

  // ── Before snapshot ────────────────────────────────────────────────────────
  const before = await getDistribution(stateCode);
  const total = Object.values(before).reduce((s, n) => s + n, 0);

  console.log(`\n=== BEFORE: ${stateCode} intake_jobs (${total} total) ===`);
  for (const [s, n] of Object.entries(before)) {
    const pct = total ? ((n / total) * 100).toFixed(1) : '0.0';
    console.log(`  ${s.padEnd(24)} ${String(n).padStart(4)}  (${pct}%)`);
  }

  // ── States to reset ────────────────────────────────────────────────────────
  const statesToReset = ['blocked_needs_user', ...(includeFailed ? ['failed'] : [])];
  const targetCount = statesToReset.reduce((s, k) => s + (before[k] ?? 0), 0);

  if (targetCount === 0) {
    console.log(`\nNo jobs in states [${statesToReset.join(', ')}] for state=${stateCode}. Nothing to do.`);
    process.exit(0);
  }

  console.log(`\n→ Will reset ${targetCount} job(s) in [${statesToReset.join(', ')}] to 'pending'.`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes made.');
    process.exit(0);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetRes = await query(
    `UPDATE intake_jobs
     SET state = 'pending',
         enrichment_log = '[]'::jsonb,
         block_reason = NULL,
         updated_at = NOW()
     WHERE source_data->>'state' = $1
       AND state = ANY($2::text[])`,
    [stateCode, statesToReset]
  );

  console.log(`\nReset ${resetRes.rowCount ?? 0} job(s) to 'pending'. Worker will pick them up within ${30}s.`);
  console.log(`\nRun the following query to monitor progress:\n`);
  console.log(
    `  SELECT state, COUNT(*) FROM intake_jobs WHERE source_data->>'state'='${stateCode}' GROUP BY state ORDER BY state;`
  );

  // ── After snapshot (immediate — before worker processes) ───────────────────
  const after = await getDistribution(stateCode);
  const totalAfter = Object.values(after).reduce((s, n) => s + n, 0);

  console.log(`\n=== AFTER RESET: ${stateCode} intake_jobs (${totalAfter} total) ===`);
  for (const [s, n] of Object.entries(after)) {
    const pct = totalAfter ? ((n / totalAfter) * 100).toFixed(1) : '0.0';
    console.log(`  ${s.padEnd(24)} ${String(n).padStart(4)}  (${pct}%)`);
  }

  console.log('\nDone. Let the worker run and re-query to see final resolution rate.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
