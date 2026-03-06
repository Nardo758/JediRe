import cron from 'node-cron';
import { ingestRateData } from '../scripts/ingest-rate-data';
import { ingestLeadingIndicators } from '../scripts/ingest-leading-indicators';
import { classifyAllMarkets } from '../scripts/classify-market-cycles';

let initialized = false;

export function startM28Scheduler() {
  if (initialized) return;
  initialized = true;

  console.log('[M28 Scheduler] Starting automated data pipelines...');

  cron.schedule('0 8 * * *', async () => {
    console.log('[M28 Scheduler] Running daily rate ingestion...');
    try {
      await ingestRateData();
      console.log('[M28 Scheduler] Daily rate ingestion complete.');
    } catch (err: any) {
      console.error('[M28 Scheduler] Rate ingestion failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  cron.schedule('0 9 5 * *', async () => {
    console.log('[M28 Scheduler] Running monthly leading indicators ingestion...');
    try {
      await ingestLeadingIndicators();
      console.log('[M28 Scheduler] Leading indicators ingestion complete.');
    } catch (err: any) {
      console.error('[M28 Scheduler] Leading indicators ingestion failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  cron.schedule('0 10 1 * *', async () => {
    console.log('[M28 Scheduler] Running monthly cycle classification...');
    try {
      await classifyAllMarkets();
      console.log('[M28 Scheduler] Cycle classification complete.');
    } catch (err: any) {
      console.error('[M28 Scheduler] Cycle classification failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('[M28 Scheduler] Scheduled:');
  console.log('  - Rate ingestion: daily at 8:00 AM ET');
  console.log('  - Leading indicators: 5th of each month at 9:00 AM ET');
  console.log('  - Cycle classification: 1st of each month at 10:00 AM ET');
}
