/**
 * Backfill historical sentiment snapshots (Task #389)
 *
 * `market_sentiment_history` only starts collecting rows from "now" forward
 * (Commentary Agent run + daily Inngest cron at 03:30 UTC). Until enough
 * days accumulate the COMMENTARY tab's vs-30d and vs-12mo deltas are
 * meaningless. This one-shot script pre-seeds the time series by walking
 * existing `market_commentary` rows and inserting a `source='backfill'`
 * snapshot at each row's `generated_at`, anchored to the macro UMCSI and
 * 30d news sentiment that were current on that date.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only scripts/backfill-sentiment-history.ts
 *   cd backend && npx ts-node --transpile-only scripts/backfill-sentiment-history.ts --dry-run
 *   cd backend && npx ts-node --transpile-only scripts/backfill-sentiment-history.ts --limit=50
 *
 * Re-runnable: existing (entity, snapshot_at, source='backfill') rows are
 * detected and skipped.
 */

import 'dotenv/config';
import { connectDatabase, getPool } from '../src/database/connection';
import { backfillFromMarketCommentary } from '../src/services/sentiment-history.service';
import { logger } from '../src/utils/logger';

function parseFlag(name: string): string | null {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (arg) return arg.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return '';
  return null;
}

async function main() {
  const dryRun = parseFlag('dry-run') !== null;
  const limitRaw = parseFlag('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isFinite(limit!) || (limit ?? 0) <= 0)) {
    logger.error('[backfill-sentiment-history] --limit must be a positive integer');
    process.exit(2);
  }

  logger.info('[backfill-sentiment-history] starting', { dryRun, limit });

  await connectDatabase();

  const result = await backfillFromMarketCommentary({ dryRun, limit });

  logger.info('[backfill-sentiment-history] done', result);
  // Plain console summary for ops convenience (logger may filter levels).
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ dryRun, ...result }, null, 2));

  await getPool().end().catch(() => { /* ignore */ });
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(err => {
  logger.error('[backfill-sentiment-history] fatal', { err: err instanceof Error ? err.message : String(err) });
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
