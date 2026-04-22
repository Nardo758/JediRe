/**
 * Inbound email parsing for per-user news connections (Task #329, Phase 1).
 *
 * Each user gets a unique address such as `<userId>+<token>@inbox.jedire.app`.
 * They forward newsletters from publishers (WSJ Real Estate Daily, FT Property,
 * Bloomberg Businessweek, etc.) to that address. A transactional email vendor
 * (Postmark Inbound, Mailgun Routes, SendGrid Inbound Parse) POSTs the parsed
 * email payload to our webhook, and we extract the headlines/links.
 *
 * No publisher credentials are stored. We only parse what the user explicitly
 * forwards from their own inbox.
 */

import crypto from 'crypto';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface InboundEmailPayload {
  from?: string;
  to?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  receivedAt?: string;
}

export interface ExtractedNewsItem {
  url: string;
  title: string;
  summary?: string;
}

/**
 * Map a sender domain/address to a publisher slug + display label so the UI
 * can show "From your WSJ subscription". The mapping is intentionally a small
 * curated allow-list — anything else is recorded as the literal sender domain.
 */
const PUBLISHER_BY_DOMAIN: Record<string, { slug: string; label: string }> = {
  'wsj.com': { slug: 'wsj', label: 'WSJ' },
  'newsletters.wsj.com': { slug: 'wsj', label: 'WSJ' },
  'email.wsj.com': { slug: 'wsj', label: 'WSJ' },
  'ft.com': { slug: 'ft', label: 'FT' },
  'mail.ft.com': { slug: 'ft', label: 'FT' },
  'bloomberg.net': { slug: 'bloomberg', label: 'Bloomberg' },
  'mail.bloomberg.com': { slug: 'bloomberg', label: 'Bloomberg' },
  'newsletter.bloomberg.com': { slug: 'bloomberg', label: 'Bloomberg' },
  'nytimes.com': { slug: 'nyt', label: 'NYT' },
  'email.nytimes.com': { slug: 'nyt', label: 'NYT' },
  'economist.com': { slug: 'economist', label: 'The Economist' },
  'reuters.com': { slug: 'reuters', label: 'Reuters' },
  'bisnow.com': { slug: 'bisnow', label: 'Bisnow' },
  'globest.com': { slug: 'globest', label: 'GlobeSt' },
};

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'mod', 'mc_cid', 'mc_eid', 'src', 'st', 'cid', 'ref', 'reflink',
  'mkt_tok', 'gclid', 'fbclid', 'igshid',
]);

/** Strip tracking params, normalize case, drop fragment. */
export function canonicalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    const cleanParams = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      if (!TRACKING_PARAMS.has(k.toLowerCase())) cleanParams.append(k, v);
    });
    u.search = cleanParams.toString();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function dedupeKey(userId: string, canonicalUrl: string): string {
  return crypto
    .createHash('sha1')
    .update(`${userId}|${canonicalUrl}`)
    .digest('hex');
}

/**
 * Best-effort headline extractor. Pulls anchor text + href from HTML; falls
 * back to plain-text URL detection. We deliberately stay dependency-free
 * (no cheerio/readability) so the webhook stays fast and tree-shake-friendly.
 */
export function extractItems(payload: InboundEmailPayload): ExtractedNewsItem[] {
  const items: ExtractedNewsItem[] = [];
  const seen = new Set<string>();

  const pushItem = (rawUrl: string, rawTitle: string) => {
    const canonical = canonicalizeUrl(rawUrl);
    if (!canonical) return;
    if (seen.has(canonical)) return;
    seen.add(canonical);
    const title = rawTitle.replace(/\s+/g, ' ').trim();
    if (!title || title.length < 4) return;
    items.push({ url: canonical, title: title.slice(0, 500) });
  };

  if (payload.html) {
    // Anchor tags: <a href="…">title</a>
    const anchorRe =
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(payload.html)) !== null) {
      const href = m[1];
      // Strip nested HTML tags from anchor body
      const text = m[2].replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      // Skip publisher chrome links: "View in browser", "Unsubscribe", etc.
      if (
        /^(view in browser|unsubscribe|manage preferences|forward to a friend|privacy policy|terms)/i.test(
          text
        )
      ) {
        continue;
      }
      pushItem(href, text);
    }
  }

  if (payload.text && items.length === 0) {
    // Fallback: scan plain text for URLs and use the surrounding line as title.
    const lines = payload.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const urlMatch = lines[i].match(/https?:\/\/\S+/);
      if (!urlMatch) continue;
      const titleLine =
        (i > 0 && lines[i - 1].trim()) || lines[i].replace(urlMatch[0], '').trim();
      pushItem(urlMatch[0], titleLine || urlMatch[0]);
    }
  }

  return items;
}

export function detectPublisher(payload: InboundEmailPayload): {
  slug: string;
  label: string;
} {
  const from = (payload.from || '').toLowerCase();
  const domainMatch = from.match(/@([^\s>]+)/);
  const domain = domainMatch ? domainMatch[1] : '';
  if (domain && PUBLISHER_BY_DOMAIN[domain]) return PUBLISHER_BY_DOMAIN[domain];
  // Match longest suffix
  for (const key of Object.keys(PUBLISHER_BY_DOMAIN)) {
    if (domain.endsWith(`.${key}`) || domain === key) return PUBLISHER_BY_DOMAIN[key];
  }
  return { slug: domain || 'unknown', label: domain || 'Unknown' };
}

/**
 * Look up the connection that owns the given inbound address.
 */
export async function findConnectionByAddress(address: string): Promise<{
  id: string;
  user_id: string;
  metadata: any;
} | null> {
  const result = await query(
    `SELECT id, user_id, metadata
       FROM user_news_connections
      WHERE address = $1 AND type = 'email' AND status = 'active'
      LIMIT 1`,
    [address.toLowerCase()]
  );
  return result.rows[0] || null;
}

/**
 * Persist parsed items. Returns how many new rows were inserted.
 * Tracks detected publishers in the connection's metadata.
 */
export async function persistInboundItems(
  connection: { id: string; user_id: string; metadata: any },
  payload: InboundEmailPayload,
  items: ExtractedNewsItem[]
): Promise<number> {
  if (items.length === 0) return 0;

  const publisher = detectPublisher(payload);
  const source = `email_${publisher.slug}`;
  const publishedAt = payload.receivedAt ? new Date(payload.receivedAt) : new Date();

  let inserted = 0;
  for (const item of items) {
    const key = dedupeKey(connection.user_id, item.url);
    const result = await query(
      `INSERT INTO user_news_items
         (user_id, connection_id, dedupe_key, source, publisher, url, title, summary, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, dedupe_key) DO NOTHING
       RETURNING id`,
      [
        connection.user_id,
        connection.id,
        key,
        source,
        publisher.label,
        item.url,
        item.title,
        item.summary || null,
        publishedAt,
      ]
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }

  // Track detected publishers + last-seen timestamp in metadata so the settings
  // UI can show "We're seeing newsletters from: WSJ, FT".
  const meta = connection.metadata || {};
  const detected = new Set<string>(meta.detectedPublishers || []);
  detected.add(publisher.label);
  await query(
    `UPDATE user_news_connections
        SET metadata = $1::jsonb,
            last_synced_at = NOW(),
            updated_at = NOW(),
            last_error = NULL,
            status = 'active'
      WHERE id = $2`,
    [
      JSON.stringify({
        ...meta,
        detectedPublishers: Array.from(detected),
        lastInboundFrom: payload.from || null,
        lastInboundSubject: payload.subject || null,
      }),
      connection.id,
    ]
  );

  logger.info(
    `[news-connections] inbound-email: persisted ${inserted}/${items.length} items for ${connection.id} (${publisher.label})`
  );
  return inserted;
}

/**
 * Generate a unique inbound address for a user. The token is short, random
 * and unguessable so forwarded mail can be routed without leaking user IDs.
 */
export function generateInboundAddress(domain = 'inbox.jedire.app'): string {
  const token = crypto.randomBytes(8).toString('hex');
  return `news-${token}@${domain}`;
}
