/**
 * Backfill Market Event Extraction (Task #372)
 *
 * One-time script that runs extractAndPersistEvents() across ALL rows in
 * news_article_cache (or only those with extracted_at IS NULL) to populate
 * the event database with historical context.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill-event-extraction.ts
 *
 * Flags:
 *   --force          Re-process every cached article regardless of prior extraction
 *                    (default: skip articles where extracted_at IS NULL)
 *   --all            Alias for --force (backward-compat)
 *   --dry-run        Log what would be processed without calling the LLM or writing to DB
 *   --stamp-existing One-shot backfill (Task #1134): stamp extracted_at = NOW() on any
 *                    news_article_cache row that already has a market_events match but
 *                    whose extracted_at is still NULL. No LLM calls are made. Idempotent.
 */

import { getPool } from '../database/connection';
import { extractAndPersistEvents } from '../services/market-event-extraction.service';
import { logger } from '../utils/logger';

const args = process.argv.slice(2);
const DRY_RUN        = args.includes('--dry-run');
const FORCE_ALL      = args.includes('--force') || args.includes('--all');
const STAMP_EXISTING = args.includes('--stamp-existing');

/**
 * Task #1134: stamp extracted_at on articles that already produced market_events.
 * No LLM calls; pure SQL UPDATE. Idempotent.
 */
async function stampExisting(): Promise<void> {
  const pool = getPool();

  logger.info('[BackfillEvents] --stamp-existing mode: stamping pre-existing extracted articles …');

  const result = await pool.query(`
    UPDATE news_article_cache nac
    SET extracted_at = NOW()
    WHERE EXISTS (
      SELECT 1
      FROM market_events me
      WHERE me.source_url = nac.url
    )
    AND nac.extracted_at IS NULL
  `);

  logger.info('[BackfillEvents] --stamp-existing complete', { rowsStamped: result.rowCount ?? 0 });

  await pool.end();
}

async function main() {
  if (STAMP_EXISTING) {
    await stampExisting();
    return;
  }

  const pool = getPool();

  logger.info('[BackfillEvents] Starting market event backfill', { dryRun: DRY_RUN, forceAll: FORCE_ALL });

  const articlesResult = FORCE_ALL
    ? await pool.query<{
        id: string;
        title: string;
        description: string | null;
        content: string | null;
        url: string;
        published_at: string | null;
      }>(`
        SELECT id, title, description, content, url, published_at
        FROM news_article_cache
        WHERE title IS NOT NULL
        ORDER BY cached_at ASC
      `)
    : await pool.query<{
        id: string;
        title: string;
        description: string | null;
        content: string | null;
        url: string;
        published_at: string | null;
      }>(`
        SELECT id, title, description, content, url, published_at
        FROM news_article_cache
        WHERE title IS NOT NULL
          AND extracted_at IS NULL
        ORDER BY cached_at ASC
      `);

  const articles = articlesResult.rows;

  logger.info('[BackfillEvents] Articles to process', {
    total: articles.length,
    mode: FORCE_ALL ? 'all cached articles' : 'unextracted only (extracted_at IS NULL)',
  });

  if (articles.length === 0) {
    logger.info('[BackfillEvents] Nothing to process — all articles already have extracted_at stamped.');
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
      const result = await extractAndPersistEvents(
        {
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          publishedAt: article.published_at ? new Date(article.published_at) : null,
        },
        article.id,
      );

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
