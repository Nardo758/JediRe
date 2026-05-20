/**
 * Task #388 — News Item Sentiment Backfill
 *
 * One-time (safe to re-run) backfill that scores `news_items` rows from
 * the last 12 months which are missing `sentiment_score`. Once enough
 * rows have scores, the Sentiment Trend chart on /msa/atlanta-ga
 * COMMENTARY tab stops reporting "no news data" and the 30d news line
 * starts drawing real values.
 *
 * Strategy:
 *   1. Selects up to N rows (default 1000) where sentiment_score IS NULL
 *      AND published_at >= NOW() - INTERVAL '12 months'.
 *   2. For each row, calls `scoreNewsItem` (LLM if configured, lexicon
 *      fallback otherwise) on `title + summary`.
 *   3. UPDATEs sentiment_score + sentiment_label.
 *   4. Idempotent: re-runs only touch rows still missing scores.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-news-sentiment.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-news-sentiment.ts --limit=200
 *   cd backend && npx ts-node --transpile-only scripts/backfill-news-sentiment.ts --lexicon-only
 *   cd backend && npx ts-node --transpile-only scripts/backfill-news-sentiment.ts --dry-run
 */

import { getPool, connectDatabase } from '../src/database/connection';
import {
  scoreNewsItem,
  scoreNewsItemLexicon,
} from '../src/services/news-sentiment-scorer.service';
import { logger } from '../src/utils/logger';

interface CliFlags {
  dryRun: boolean;
  lexiconOnly: boolean;
  limit: number;
  months: number;
}

function parseFlags(): CliFlags {
  const flags: CliFlags = { dryRun: false, lexiconOnly: false, limit: 1000, months: 12 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--lexicon-only') flags.lexiconOnly = true;
    else if (arg.startsWith('--limit=')) flags.limit = Number(arg.split('=')[1]) || flags.limit;
    else if (arg.startsWith('--months=')) flags.months = Number(arg.split('=')[1]) || flags.months;
  }
  return flags;
}

interface NewsRow {
  id: string;
  title: string | null;
  summary: string | null;
}

async function main() {
  const flags = parseFlags();
  logger.info('[backfill-news-sentiment] starting', flags);

  await connectDatabase();
  const pool = getPool();

  // Confirm the sentiment columns exist before doing anything — the
  // 20260603 migration is additive but may not have been applied yet on
  // older deployments.
  const colCheck = await pool.query<{ has_score: string; has_label: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE column_name = 'sentiment_score')::text AS has_score,
       COUNT(*) FILTER (WHERE column_name = 'sentiment_label')::text AS has_label
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'news_items'`,
  );
  const cols = colCheck.rows[0];
  if (!cols || Number(cols.has_score) === 0 || Number(cols.has_label) === 0) {
    logger.error(
      '[backfill-news-sentiment] news_items is missing sentiment columns; apply migration 20260603_news_items_sentiment.sql first',
    );
    process.exit(1);
  }

  const sel = await pool.query<NewsRow>(
    `SELECT id::text AS id, title, summary
       FROM news_items
      WHERE sentiment_score IS NULL
        AND published_at >= NOW() - ($1::int * INTERVAL '1 month')
      ORDER BY published_at DESC
      LIMIT $2`,
    [flags.months, flags.limit],
  );

  const rows = sel.rows;
  logger.info('[backfill-news-sentiment] candidates', { count: rows.length });
  if (rows.length === 0) {
    logger.info('[backfill-news-sentiment] nothing to do');
    await pool.end();
    return;
  }

  let updated = 0;
  let llm = 0;
  let lexicon = 0;
  let failed = 0;

  for (const row of rows) {
    const title = row.title ?? '';
    const summary = row.summary ?? '';
    try {
      const scored = flags.lexiconOnly
        ? scoreNewsItemLexicon(title, summary)
        : await scoreNewsItem(title, summary);

      if (scored.source === 'llm') llm++;
      else lexicon++;

      if (flags.dryRun) {
        logger.info('[backfill-news-sentiment] dry-run', {
          id: row.id,
          score: scored.score,
          label: scored.label,
          source: scored.source,
        });
      } else {
        await pool.query(
          `UPDATE news_items
              SET sentiment_score = $2,
                  sentiment_label = $3
            WHERE id = $1
              AND sentiment_score IS NULL`,
          [row.id, scored.score, scored.label],
        );
        updated++;
      }
    } catch (err) {
      failed++;
      logger.warn('[backfill-news-sentiment] row failed', {
        id: row.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('[backfill-news-sentiment] complete', {
    candidates: rows.length,
    updated,
    llm,
    lexicon,
    failed,
    dryRun: flags.dryRun,
  });

  await pool.end();
}

main().catch(err => {
  logger.error('[backfill-news-sentiment] fatal', {
    err: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
