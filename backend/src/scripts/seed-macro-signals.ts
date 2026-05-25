/**
 * seed-macro-signals.ts
 *
 * Backfills `historical_observations` with FRED + BLS macro signals for all
 * known MSAs. Reads from tables that are already populated by the existing
 * ingestion pipelines:
 *   - metric_time_series  → FRED fed-funds rate (RATE_FED_FUNDS) + 10Y treasury (RATE_TREASURY_10Y)
 *   - msa_economic_snapshot → BLS CES total nonfarm employment, unemployment rate
 *
 * After this script runs:
 *   - `historical_observations` has one row per MSA per month for the last 15+ months
 *   - `msa_treasury_10y`, `msa_fed_funds_rate`, `msa_employment_total`,
 *     `msa_employment_growth_yoy`, `msa_unemployment_rate` are populated
 *   - `CorpusQueryService.coverage()` will return "partial" or better for Atlanta
 *
 * Safe to re-run: uses ON CONFLICT DO UPDATE (idempotent).
 *
 * Usage:
 *   cd backend
 *   npx ts-node --transpile-only src/scripts/seed-macro-signals.ts [--months=18]
 */

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { CorpusMacroIngestor, KNOWN_MSAS } from '../services/macro-signals/corpus-macro-ingestor';
import { logger } from '../utils/logger';

async function run(): Promise<void> {
  const monthsArg = process.argv.find(a => a.startsWith('--months='));
  const lookbackMonths = monthsArg ? parseInt(monthsArg.split('=')[1], 10) : 18;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const endDate = new Date();
    const startDate = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - lookbackMonths + 1, 1),
    );

    logger.info('[seed-macro-signals] Starting macro signal backfill', {
      lookbackMonths,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      msas: KNOWN_MSAS.map(m => m.msaId),
    });

    const ingestor = new CorpusMacroIngestor(pool);
    const results = await ingestor.ingestAll(KNOWN_MSAS, startDate, endDate);

    let totalUpserted = 0;
    for (const r of results) {
      totalUpserted += r.rowsUpserted;
      logger.info('[seed-macro-signals] MSA result', {
        msaId: r.msaId,
        monthsProcessed: r.monthsProcessed,
        rowsUpserted: r.rowsUpserted,
        rowsWithRates: r.rowsWithRates,
        rowsWithEmployment: r.rowsWithEmployment,
      });
    }

    // Verify final counts
    const verify = await pool.query(
      `SELECT
         msa_id,
         COUNT(*) AS months,
         COUNT(msa_fed_funds_rate) AS has_ffr,
         COUNT(msa_treasury_10y) AS has_10y,
         COUNT(msa_employment_total) AS has_emp,
         MIN(observation_date) AS earliest,
         MAX(observation_date) AS latest
       FROM historical_observations
       WHERE geography_level = 'msa'
       GROUP BY msa_id
       ORDER BY msa_id`,
    );

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(' historical_observations MSA macro coverage (post-seed)');
    console.log('═══════════════════════════════════════════════════════');
    for (const row of verify.rows) {
      console.log(
        `  ${row.msa_id}: ${row.months} months | ` +
        `FFR: ${row.has_ffr} | 10Y: ${row.has_10y} | EMP: ${row.has_emp} ` +
        `(${row.earliest} → ${row.latest})`,
      );
    }
    console.log(`\n  Total rows upserted: ${totalUpserted}`);
    console.log('═══════════════════════════════════════════════════════\n');

    logger.info('[seed-macro-signals] Done', { totalUpserted });
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  logger.error('[seed-macro-signals] Fatal error:', err);
  process.exit(1);
});
