/**
 * Inngest Cron: Nightly Market Event Extraction
 *
 * Fires every night at 03:00 UTC.
 * Queries news_article_cache for the last 7 days of articles that have not
 * yet produced any market_events rows (source_url NOT EXISTS guard), passes
 * each through extractAndPersistEvents(), and logs inserted/skipped counts.
 *
 * Deduplication strategy:
 *   - Source-level: WHERE NOT EXISTS (SELECT 1 FROM market_events WHERE source_url = ...)
 *     prevents re-paying LLM cost for articles already processed.
 *   - Event-level: ON CONFLICT (event_name, effective_date, geography_id) DO NOTHING
 *     in insertExtractedEvents() handles the rare case where two articles describe
 *     the same event.
 *
 * Architecture:
 *   Step 1 — Query unextracted articles from the last 7 days
 *   Step 2 — Extract and persist events for each article (sequential, LLM-rate-aware)
 *   Step 3 — Log summary
 */

import { inngest } from '../../lib/inngest';
import { extractAndPersistEvents } from '../../services/market-event-extraction.service';
import { query as dbQuery } from '../../database/connection';
import { logger } from '../../utils/logger';

const LOOKBACK_DAYS = 7;

export const nightlyEventExtractionCron = inngest.createFunction(
  {
    id: 'nightly-event-extraction',
    name: 'Atlanta: nightly market event extraction from news cache',
    triggers: [{ cron: '0 3 * * *' }],
  },
  async ({ step }) => {
    const articles = await step.run('fetch-unextracted-articles', async () => {
      const result = await dbQuery<{
        title: string;
        description: string | null;
        content: string | null;
        url: string;
        published_at: string | null;
      }>(`
        SELECT title, description, content, url, published_at
        FROM news_article_cache
        WHERE cached_at >= NOW() - ($1 || ' days')::interval
          AND title IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM market_events
            WHERE source_url = news_article_cache.url
          )
        ORDER BY cached_at DESC
      `, [LOOKBACK_DAYS]);

      logger.info('[Inngest/NightlyEventExtraction] Unextracted articles found', {
        count: result.rows.length,
        lookback_days: LOOKBACK_DAYS,
      });

      return result.rows;
    });

    const summary = await step.run('extract-and-persist-events', async () => {
      let totalInserted = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const article of articles) {
        try {
          const result = await extractAndPersistEvents({
            title: article.title,
            description: article.description,
            content: article.content,
            url: article.url,
            publishedAt: article.published_at ? new Date(article.published_at) : null,
          });
          totalInserted += result.inserted;
          totalSkipped += result.skipped;
        } catch (err: unknown) {
          totalErrors++;
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn('[Inngest/NightlyEventExtraction] Article extraction error', {
            title: article.title,
            url: article.url,
            error: msg,
          });
        }
      }

      return {
        articles_processed: articles.length,
        events_inserted: totalInserted,
        events_skipped_dedup: totalSkipped,
        errors: totalErrors,
      };
    });

    await step.run('log-summary', async () => {
      logger.info('[Inngest/NightlyEventExtraction] Nightly run complete', {
        articles_processed: summary.articles_processed,
        events_inserted: summary.events_inserted,
        events_skipped_dedup: summary.events_skipped_dedup,
        errors: summary.errors,
        lookback_days: LOOKBACK_DAYS,
      });
      return summary;
    });

    return {
      success: summary.errors === 0,
      ...summary,
    };
  }
);
