import { inngest } from '../../lib/inngest';
import { ingestBLSQCEW } from '../../services/ingestion/bls-qcew-ingest.service';
import { logger } from '../../utils/logger';

export const blsQcewMonthlyCron = inngest.createFunction(
  { id: 'bls-qcew-monthly', name: 'BLS QCEW Monthly Refresh' },
  { cron: '0 6 3 * *' },  // 3rd of month, 06:00 UTC
  async ({ step }) => {
    // QCEW lags ~6 months, so ingest the previous year
    const year = new Date().getFullYear() - 1;

    logger.info(`Starting BLS QCEW monthly refresh for year ${year}`);

    const result = await step.run('ingest-bls-qcew', async () => {
      return ingestBLSQCEW(year);
    });

    logger.info(`BLS QCEW monthly refresh completed for year ${year}: ${result.rowsInserted} rows inserted, ${result.errors} errors`);

    return {
      year,
      rowsInserted: result.rowsInserted,
      errors: result.errors,
    };
  }
);
