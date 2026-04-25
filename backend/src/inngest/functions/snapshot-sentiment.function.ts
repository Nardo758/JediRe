/**
 * Inngest Cron: Daily Sentiment Snapshot (Task #382)
 *
 * Fires daily at 03:30 UTC. For every MSA + submarket entity that has a
 * cached market_commentary row, writes one sentiment observation into
 * market_sentiment_history blending:
 *   - the latest Commentary Agent marketNarrative sentiment (if cached)
 *   - the rolling 30-day news sentiment average (if news_items has the
 *     sentiment columns)
 *   - the latest macro consumer-sentiment reading (UMCSI)
 *
 * Source on each row is 'cron_snapshot' so it can be told apart from rows
 * written synchronously by the Commentary Agent (source = 'agent_run').
 */

import { inngest } from '../../lib/inngest';
import { snapshotAllActiveEntities } from '../../services/sentiment-history.service';
import { logger } from '../../utils/logger';

export const snapshotSentimentDaily = inngest.createFunction(
  {
    id: 'snapshot-sentiment-daily',
    name: 'Sentiment History: daily snapshot',
    triggers: [{ cron: '30 3 * * *' }],
  },
  async ({ step }) => {
    const result = await step.run('write-daily-snapshots', async () => {
      try {
        const out = await snapshotAllActiveEntities();
        logger.info('[Inngest] snapshotSentimentDaily complete', out);
        return { ...out, ok: true as const };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[Inngest] snapshotSentimentDaily fatal', { error: msg });
        throw err;
      }
    });

    return result;
  },
);
