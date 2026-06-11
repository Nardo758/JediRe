import cron from 'node-cron';
import { ingestRateData } from '../scripts/ingest-rate-data';
import { ingestLeadingIndicators } from '../scripts/ingest-leading-indicators';
import { ingestMsaData } from '../scripts/ingest-msa-economic-data';
import { classifyAllMarkets } from '../scripts/classify-market-cycles';
import { ingestAtlantaNews } from '../scripts/ingest-atlanta-news';
import { MarketMetricsAggregator } from './market-metrics-aggregator.service';
import { CorrelationEngineService } from './correlationEngine.service';
import { TrafficCalibrationJob } from '../jobs/trafficCalibrationJob';
import { pool } from '../database';

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

  const aggregator = new MarketMetricsAggregator(pool);
  cron.schedule('0 */6 * * *', async () => {
    console.log('[M28 Scheduler] Running market metrics refresh...');
    try {
      const result = await aggregator.refreshMetricsSnapshot();
      console.log(`[M28 Scheduler] Market metrics refresh complete: ${result.marketsProcessed} markets processed at ${result.timestamp.toISOString()}`);
    } catch (err: any) {
      console.error('[M28 Scheduler] Market metrics refresh failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  const correlationEngine = new CorrelationEngineService(pool);
  cron.schedule('0 3 * * 0', async () => {
    console.log('[M28 Scheduler] Running weekly correlation sweep...');
    try {
      const result = await correlationEngine.sweepAllGeographies();
      console.log(`[M28 Scheduler] Correlation sweep complete: ${result.processed} processed, ${result.failed} failed`);
    } catch (err: any) {
      console.error('[M28 Scheduler] Correlation sweep failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  // M07: Nightly traffic calibration (Bayesian coefficient update + absorption benchmarks)
  // Runs at 2:00 AM ET daily with a 24-hour lookback window.
  const calibrationJob = new TrafficCalibrationJob(pool);
  cron.schedule('0 2 * * *', async () => {
    console.log('[M28 Scheduler] Running nightly M07 traffic calibration...');
    try {
      const result = await calibrationJob.run(24);
      console.log(
        `[M28 Scheduler] M07 calibration complete: ${result.buckets_updated} updated, ` +
        `${result.buckets_created} created, ${result.absorption_benchmarks_updated} benchmarks`
      );
    } catch (err: any) {
      console.error('[M28 Scheduler] M07 traffic calibration failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  // MSA economic data ingestion — runs at 8:30 AM ET (after rate ingest at 8:00 AM)
  cron.schedule('30 8 * * *', async () => {
    console.log('[M28 Scheduler] Running MSA economic data ingestion...');
    try {
      await ingestMsaData();
      console.log('[M28 Scheduler] MSA economic data ingestion complete.');
    } catch (err: any) {
      console.error('[M28 Scheduler] MSA economic data ingestion failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  // Atlanta CRE news — daily at 6:00 AM ET (before morning briefing at 7 AM)
  cron.schedule('0 6 * * *', async () => {
    console.log('[M28 Scheduler] Running Atlanta CRE news ingestion...');
    try {
      const result = await ingestAtlantaNews();
      console.log(`[M28 Scheduler] Atlanta news complete: ${result.inserted} articles inserted`);
    } catch (err: any) {
      console.error('[M28 Scheduler] Atlanta news ingestion failed:', err.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('[M28 Scheduler] Scheduled:');
  console.log('  - Rate + macro ingestion: daily at 8:00 AM ET');
  console.log('  - MSA economic data (BLS): daily at 8:30 AM ET');
  console.log('  - Leading indicators: 5th of each month at 9:00 AM ET');
  console.log('  - Cycle classification: 1st of each month at 10:00 AM ET');
  console.log('  - Market metrics refresh: every 6 hours');
  console.log('  - Correlation sweep: weekly Sundays at 3:00 AM ET');
  console.log('  - M07 traffic calibration: nightly at 2:00 AM ET');
  console.log('  - Atlanta CRE news: daily at 6:00 AM ET');
}
