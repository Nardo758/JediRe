/**
 * Inngest Cron: Monthly Macro Signal Ingestion
 *
 * Fires on the 2nd of each month at 09:00 UTC (after BLS/FRED sources have
 * published their prior-month data).
 *
 * What it does
 * ─────────────
 * Step 1 — Determine the month window to ingest (current + prior 2 months for
 *           any gaps).
 * Step 2 — Run CorpusMacroIngestor for all known MSAs, bridging signals from
 *           metric_time_series (FRED) and msa_economic_snapshot (BLS CES) into
 *           historical_observations.
 * Step 3 — Log a per-MSA summary.
 *
 * Depends on
 * ─────────────
 * - metric_time_series already populated by the existing M28 FRED ingest cron
 *   (rateSheetStalenessCron / ingest-rate-data.ts).
 * - msa_economic_snapshot already populated by the BLS CES ingest
 *   (ingest-msa-economic-data.ts, runs via node-cron 8:30 UTC daily).
 *
 * Without this job
 * ─────────────────
 * - historical_observations.msa_treasury_10y, msa_fed_funds_rate, and
 *   msa_employment_total remain NULL across all rows.
 * - CorpusQueryService.coverage() always returns 'pending' for FRED and BLS signals.
 * - M07, M35, M36–M38 have no macro context for their predictions.
 */

import { inngest } from '../../lib/inngest';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { CorpusMacroIngestor, KNOWN_MSAS } from '../../services/macro-signals/corpus-macro-ingestor';

export const macroSignalsMonthly = inngest.createFunction(
  {
    id: 'macro-signals-monthly',
    name: 'Corpus: Monthly macro signal ingestion (FRED + BLS → historical_observations)',
    triggers: [{ cron: '0 9 2 * *' }], // 2nd of each month at 09:00 UTC
    retries: 2,
  },
  async ({ step }) => {

    // ── Step 1: Determine ingestion window ────────────────────────────────────
    const window = await step.run('determine-window', async () => {
      const now = new Date();
      // Ingest current month + prior 2 months to fill any gaps
      const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
      const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      logger.info('[MacroSignalsMonthly] Ingestion window', {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      });
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
    });

    // ── Step 2: Ingest macro signals for all known MSAs ───────────────────────
    const results = await step.run('ingest-macro-signals', async () => {
      const pool = getPool();
      const ingestor = new CorpusMacroIngestor(pool);
      const startDate = new Date(window.startDate);
      const endDate = new Date(window.endDate);

      const ingestResults = await ingestor.ingestAll(KNOWN_MSAS, startDate, endDate);
      return ingestResults;
    });

    // ── Step 3: Log summary ───────────────────────────────────────────────────
    await step.run('log-summary', async () => {
      const totalUpserted = results.reduce((s, r) => s + r.rowsUpserted, 0);
      const totalWithRates = results.reduce((s, r) => s + r.rowsWithRates, 0);
      const totalWithEmp = results.reduce((s, r) => s + r.rowsWithEmployment, 0);

      logger.info('[MacroSignalsMonthly] Run complete', {
        msasProcessed: results.length,
        totalUpserted,
        totalWithRates,
        totalWithEmp,
        perMsa: results.map(r => ({
          msaId: r.msaId,
          upserted: r.rowsUpserted,
          rates: r.rowsWithRates,
          employment: r.rowsWithEmployment,
        })),
      });
    });

    return {
      msasProcessed: results.length,
      totalUpserted: results.reduce((s, r) => s + r.rowsUpserted, 0),
    };
  },
);
