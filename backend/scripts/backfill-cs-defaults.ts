/**
 * F-backfill-1: One-time Capital Structure Defaults Backfill
 *
 * Seeds ltv_pct, gp_equity_pct, lp_equity_pct, preferred_return_pct, and
 * debt_rate (FRED DGS10 + 200bps) into the active scenario year1 JSONB for
 * every deal whose active scenario is missing _capital_structure_defaults.
 *
 * Safe to re-run: seedCapitalStructureDefaults is idempotent (it checks
 * seeded_at and skips FRED when the cached rate is fresh).
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-cs-defaults.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-cs-defaults.ts --dry-run
 */

import { getPool, connectDatabase } from '../src/database/connection';
import { seedCapitalStructureDefaults } from '../src/services/proforma-seeder.service';
import { logger } from '../src/utils/logger';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  logger.info('[backfill-cs-defaults] Starting', { dryRun: DRY_RUN });

  await connectDatabase();
  const pool = getPool();

  // Find all deals that have a deal_assumptions row but whose active scenario
  // year1 is missing the _capital_structure_defaults block (i.e. ltv_pct not
  // yet seeded). Deals with no deal_assumptions row are skipped — the seeder
  // fires automatically on their first getDealFinancials call.
  const res = await pool.query<{ deal_id: string }>(`
    SELECT da.deal_id
      FROM deal_assumptions da
     WHERE da.year1 -> '_capital_structure_defaults' -> 'ltv_pct' IS NULL
     ORDER BY da.deal_id
  `);

  const dealIds = res.rows.map(r => r.deal_id);
  logger.info('[backfill-cs-defaults] Deals needing backfill', { count: dealIds.length });

  if (dealIds.length === 0) {
    logger.info('[backfill-cs-defaults] Nothing to do — all deals already seeded.');
    return;
  }

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const dealId of dealIds) {
    if (DRY_RUN) {
      logger.info('[backfill-cs-defaults] DRY RUN — would seed', { dealId });
      skipped++;
      continue;
    }

    try {
      const result = await seedCapitalStructureDefaults(pool, dealId);
      if (result.seeded) {
        logger.info('[backfill-cs-defaults] Seeded', {
          dealId,
          debtRate: result.debt_rate,
          warnings: result.warnings.length > 0 ? result.warnings : undefined,
        });
        seeded++;
      } else {
        logger.info('[backfill-cs-defaults] Already seeded (idempotent skip)', { dealId });
        skipped++;
      }
    } catch (err) {
      logger.error('[backfill-cs-defaults] Failed to seed', {
        dealId,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  logger.info('[backfill-cs-defaults] Complete', {
    total:   dealIds.length,
    seeded,
    skipped,
    failed,
    dryRun:  DRY_RUN,
  });
}

main().catch(err => {
  logger.error('[backfill-cs-defaults] Fatal error', { error: String(err) });
  process.exit(1);
});
