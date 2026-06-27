import { inngest } from '../../lib/inngest';
import { outcomePanelService } from '../../services/ingestion/outcome-panel.service';
import { pool } from '../../database';
import { logger } from '../../utils/logger';

/**
 * Outcome Panel Forward-Fill Cron
 *
 * Monthly job that adds the most recent month's data to the outcome_panel.
 * Called automatically on the 1st of each month at 05:00 UTC.
 *
 * For each submarket with new metric_time_series data in the target month:
 *   1. Fetch leading metrics from metric_time_series
 *   2. Fetch realized outcomes from market_snapshots at lag dates
 *   3. Build and upsert the outcome_panel row
 *   4. Refresh the outcome_panel_current materialized view
 */

export const outcomePanelForwardFillCron = inngest.createFunction(
  { id: 'outcome-panel-forward-fill', name: 'Outcome Panel Forward Fill', triggers: [{ cron: '0 5 1 * *' }] },
  async ({ step }) => {
    const targetMonth = await step.run('compute-target-month', () => {
      const now = new Date();
      now.setMonth(now.getMonth() - 1); // previous month
      return now.toISOString().slice(0, 7); // YYYY-MM
    });

    logger.info('OutcomePanelCron: starting forward fill', { targetMonth });

    const submarkets = await step.run('find-submarkets', async () => {
      const result = await pool.query(
        `SELECT DISTINCT submarket_id
         FROM metric_time_series
         WHERE period_date >= $1 AND period_date < $2`,
        [`${targetMonth}-01`, `${targetMonth}-31`]
      );
      return result.rows;
    });

    let filled = 0;
    let failed = 0;

    for (const row of submarkets) {
      const submarketId = row.submarket_id;
      const periodDate = `${targetMonth}-01`;

      try {
        await step.run(`forward-fill-${submarketId}`, async () => {
          return await outcomePanelService.forwardFill(submarketId, periodDate);
        });
        filled++;
      } catch (err) {
        logger.warn('OutcomePanelCron: forward fill failed', {
          submarketId,
          periodDate,
          error: (err as Error).message,
        });
        failed++;
      }
    }

    // Refresh materialized view
    await step.run('refresh-materialized-view', async () => {
      await pool.query('SELECT refresh_outcome_panel_current()');
    });

    logger.info('OutcomePanelCron: complete', { targetMonth, filled, failed });

    return { targetMonth, submarketsProcessed: filled + failed, filled, failed };
  }
);
