/**
 * Backfill Market Event Extraction (Task #372)
 *
 * One-time script that runs extractAndPersistEvents() across ALL rows in
 * news_article_cache (or only those whose URL has no matching market_events
 * row) to populate the event database with historical context.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-event-extraction.ts
 *
 * Flags:
 *   --all        Process every cached article regardless of prior extraction
 *                (default: skip articles whose URL already appears in market_events)
 *   --dry-run    Log what would be processed without calling the LLM or writing to DB
 */

import { getPool } from '../database/connection';
import { extractAndPersistEvents } from '../services/market-event-extraction.service';
import { logger } from '../utils/logger';

const args = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const FORCE_ALL = args.includes('--all');

async function main() {
  const pool = getPool();

  logger.info('[BackfillEvents] Starting market event backfill', { dryRun: DRY_RUN, forceAll: FORCE_ALL });

  const articlesResult = FORCE_ALL
    ? await pool.query<{
        title: string;
        description: string | null;
        content: string | null;
        url: string;
        published_at: string | null;
      }>(`
        SELECT title, description, content, url, published_at
        FROM news_article_cache
        WHERE title IS NOT NULL
        ORDER BY cached_at ASC
      `)
    : await pool.query<{
        title: string;
        description: string | null;
        content: string | null;
        url: string;
        published_at: string | null;
      }>(`
        SELECT nac.title, nac.description, nac.content, nac.url, nac.published_at
        FROM news_article_cache nac
        WHERE nac.title IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM market_events me
            WHERE me.source_url = nac.url
          )
        ORDER BY nac.cached_at ASC
      `);

  const articles = articlesResult.rows;

  logger.info('[BackfillEvents] Articles to process', {
    total: articles.length,
    mode: FORCE_ALL ? 'all cached articles' : 'unextracted only',
  });

  if (articles.length === 0) {
    logger.info('[BackfillEvents] Nothing to process — all articles already have events extracted.');
    await pool.end();
    return;
  }

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const prefix  = `[BackfillEvents] [${i + 1}/${articles.length}]`;

    if (DRY_RUN) {
      logger.info(`${prefix} DRY-RUN — would process`, { title: article.title, url: article.url });
      continue;
    }

    try {
      const result = await extractAndPersistEvents({
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        publishedAt: article.published_at ? new Date(article.published_at) : null,
      });

      totalInserted += result.inserted;
      totalSkipped  += result.skipped;

      logger.info(`${prefix} Done`, {
        title: article.title,
        inserted: result.inserted,
        skipped: result.skipped,
      });
    } catch (err: unknown) {
      totalErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`${prefix} Failed`, { title: article.title, error: msg });
    }
  }

  logger.info('[BackfillEvents] Complete', {
    articles_processed: DRY_RUN ? 0 : articles.length - totalErrors,
    events_inserted: totalInserted,
    events_skipped_dedup: totalSkipped,
    errors: totalErrors,
  });

  await pool.end();
}

main().catch(err => {
  console.error('[BackfillEvents] Fatal error:', err);
  process.exit(1);
});
