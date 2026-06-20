import { inngest } from '../inngest';
import { extractConcessionsFromSnapshots } from '../../services/ingestion/concession-time-series.service';
import { logger } from '../../utils/logger';

/**
 * Concession Time Series Extraction Cron
 *
 * Monthly job that extracts concession data from existing market_snapshots
 * into metric_time_series for correlation engine use (COR-09).
 *
 * Runs on the 7th of each month at 03:00 UTC.
 */

export const concessionExtractionCron = inngest.createFunction(
  { id: 'concession-extraction-monthly', name: 'Concession Time Series Extraction' },
  { cron: '0 3 7 * *' },  // 7th of month, 03:00 UTC
  async ({ step }) => {
    const targetMonth = await step.run('compute-target-month', () => {
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      return now.toISOString().slice(0, 7); // YYYY-MM
    });

    logger.info('ConcessionCron: starting extraction', { targetMonth });

    const result = await step.run('extract-concessions', async () => {
      return await extractConcessionsFromSnapshots({
        startDate: `${targetMonth}-01`,
        endDate: `${targetMonth}-31`,
      });
    });

    logger.info('ConcessionCron: complete', { targetMonth, ...result });

    return { targetMonth, ...result };
  }
);
