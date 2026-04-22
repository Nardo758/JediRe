/**
 * Authenticated personalized RSS feeds for per-user news connections
 * (Task #329, Phase 2).
 *
 * Users paste a feed URL such as a personalized FT RSS link. The URL is
 * stored encrypted (the URL itself often carries the auth token). A poller
 * fetches each active feed hourly, normalizes items, and writes to
 * user_news_items. We never re-publish the URL or token in API responses.
 */

import crypto from 'crypto';
import Parser from 'rss-parser';
import { query } from '../../database/connection';
import { encrypt, decrypt } from '../../utils/encryption';
import { logger } from '../../utils/logger';
import { canonicalizeUrl, dedupeKey } from './inbound-email';

const rssParser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'JediRe/1.0 PersonalNewsAggregator (+https://jedire.app)' },
});

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly

let timerHandle: NodeJS.Timeout | null = null;

/** Encrypt a feed URL/credential before persisting. */
export function encryptFeedSecret(plain: string): string {
  return encrypt(plain);
}

/** Decrypt feed URL/credential at fetch time. Returns null if it can't decrypt. */
export function decryptFeedSecret(cipher: string | null | undefined): string | null {
  if (!cipher) return null;
  try {
    return decrypt(cipher);
  } catch (err) {
    logger.error('[news-connections] rss decrypt failed', err);
    return null;
  }
}

/**
 * Hash a URL down to something safe to log / put in error messages.
 */
function fingerprintUrl(url: string): string {
  return (
    'rss:' +
    crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)
  );
}

interface RssConnectionRow {
  id: string;
  user_id: string;
  label: string;
  encrypted_credentials: string | null;
  metadata: any;
}

async function listActiveRssConnections(): Promise<RssConnectionRow[]> {
  const result = await query(
    `SELECT id, user_id, label, encrypted_credentials, metadata
       FROM user_news_connections
      WHERE type = 'rss' AND status = 'active'`
  );
  return result.rows;
}

async function recordSuccess(
  conn: RssConnectionRow,
  inserted: number,
  publisher: string
): Promise<void> {
  const meta = conn.metadata || {};
  const detected = new Set<string>(meta.detectedPublishers || []);
  if (publisher) detected.add(publisher);
  await query(
    `UPDATE user_news_connections
        SET metadata = $1::jsonb,
            last_synced_at = NOW(),
            last_error = NULL,
            status = 'active',
            updated_at = NOW()
      WHERE id = $2`,
    [
      JSON.stringify({
        ...meta,
        detectedPublishers: Array.from(detected),
        lastInsertedCount: inserted,
      }),
      conn.id,
    ]
  );
}

async function recordError(conn: RssConnectionRow, message: string): Promise<void> {
  await query(
    `UPDATE user_news_connections
        SET status = 'error', last_error = $1, updated_at = NOW()
      WHERE id = $2`,
    [message.slice(0, 500), conn.id]
  );
}

/**
 * Fetch a single RSS connection and persist new items.
 */
export async function pollOneRssConnection(
  conn: RssConnectionRow
): Promise<{ inserted: number; publisher: string }> {
  const url = decryptFeedSecret(conn.encrypted_credentials);
  if (!url) {
    await recordError(conn, 'Feed credentials missing or could not be decrypted');
    return { inserted: 0, publisher: '' };
  }

  const fp = fingerprintUrl(url);
  let feed;
  try {
    feed = await rssParser.parseURL(url);
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error(`[news-connections] rss fetch failed for ${conn.id} (${fp}): ${msg}`);
    await recordError(conn, msg);
    return { inserted: 0, publisher: '' };
  }

  const publisher = feed.title || conn.label;
  let inserted = 0;
  for (const item of feed.items || []) {
    if (!item.link) continue;
    const canonical = canonicalizeUrl(item.link);
    if (!canonical) continue;
    const key = dedupeKey(conn.user_id, canonical);
    const result = await query(
      `INSERT INTO user_news_items
         (user_id, connection_id, dedupe_key, source, publisher, url, title, summary, author, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, dedupe_key) DO NOTHING
       RETURNING id`,
      [
        conn.user_id,
        conn.id,
        key,
        `rss_${publisher.toLowerCase().replace(/\s+/g, '_').slice(0, 32)}`,
        publisher,
        canonical,
        (item.title || '').slice(0, 500),
        (item.contentSnippet || item.summary || '').slice(0, 2000) || null,
        item.creator || (item as any).author || null,
        item.isoDate ? new Date(item.isoDate) : null,
      ]
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }

  await recordSuccess(conn, inserted, publisher);
  logger.info(
    `[news-connections] rss poll: ${inserted} new items for ${conn.id} (${fp}, ${publisher})`
  );
  return { inserted, publisher };
}

/** Poll all active RSS feeds once. Used by the scheduler and by manual "Sync now". */
export async function pollAllRssConnections(): Promise<{ scanned: number; inserted: number }> {
  const conns = await listActiveRssConnections();
  let total = 0;
  for (const conn of conns) {
    try {
      const { inserted } = await pollOneRssConnection(conn);
      total += inserted;
    } catch (err) {
      logger.error('[news-connections] rss poll iteration failed', err);
    }
  }
  return { scanned: conns.length, inserted: total };
}

/** Start the background hourly poller. Idempotent. */
export function startRssPoller(): void {
  if (timerHandle) return;
  // Kick off first poll soon after boot but not in the request path.
  setTimeout(() => {
    pollAllRssConnections().catch((err) =>
      logger.error('[news-connections] initial rss poll failed', err)
    );
  }, 60_000);

  timerHandle = setInterval(() => {
    pollAllRssConnections().catch((err) =>
      logger.error('[news-connections] rss poll failed', err)
    );
  }, POLL_INTERVAL_MS);
  logger.info('[news-connections] hourly RSS poller started');
}

export function stopRssPoller(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}
