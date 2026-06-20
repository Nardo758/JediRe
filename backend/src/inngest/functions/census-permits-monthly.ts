import { inngest } from '../inngest';
import { ingestCensusPermits } from '../../services/ingestion/census-permits-ingest.service';
import { logger } from '../../utils/logger';

export const censusPermitsMonthlyCron = inngest.createFunction(
  { id: 'census-permits-monthly', name: 'Census Building Permits Monthly Refresh' },
  { cron: '0 4 5 * *' },  // 5th of month, 04:00 UTC
  async ({ step }) => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear];

    const result = await step.run('ingest-census-permits', async () => {
      logger.info('Starting Census Building Permits monthly refresh', { years });
      return ingestCensusPermits(years);
    });

    logger.info('Census Building Permits monthly refresh completed', {
      years,
      rowsInserted: result.rowsInserted,
      errors: result.errors,
    });

    return {
      years,
      rowsInserted: result.rowsInserted,
      errors: result.errors,
    };
  }
);
