/**
 * CRE Trade-Press RSS Sources
 *
 * Fetches and normalizes free, public RSS/JSON feeds from commercial real
 * estate trade press publishers. No API keys required.
 *
 * Includes:
 * - GlobeSt
 * - Bisnow (national + selected per-market feeds)
 * - Connect CRE
 * - REJournals
 * - Multifamily Executive
 * - Multi-Housing News
 * - BiggerPockets news
 * - SEC EDGAR REIT 8-K full-text search
 * - Reddit JSON for r/CommercialRealEstate, r/multifamily
 *
 * Per-host token-bucket rate limiting and backoff are enforced so we don't get
 * blocked by publishers.
 *
 * Items are normalized into a common shape and deduplicated by canonical URL.
 *
 * @version 1.0.0
 * @date 2026-04-22
 */

import axios from 'axios';
import Parser from 'rss-parser';
import { logger } from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CreFeedItem {
  /** Stable hash-style id derived from canonical URL */
  id: string;
  headline: string;
  /** Publisher display name (e.g. "GlobeSt", "Bisnow National") */
  source: string;
  /** Publisher slug used as a stable filter key (e.g. "globest", "bisnow_national") */
  sourceId: string;
  /** Canonical URL (query-string and fragment stripped) */
  url: string;
  publishedAt: Date;
  summary?: string;
  /** Optional MSA / market hint baked into the feed configuration */
  marketHint?: string;
  category: 'cre_press' | 'reit_filing' | 'reddit';
}

export interface CreFeedDefinition {
  id: string;
  name: string;
  url: string;
  /** Format of the feed (drives the parser used) */
  format: 'rss' | 'reddit_json' | 'sec_atom';
  /** Optional market hint applied to every item from this feed */
  marketHint?: string;
  category: CreFeedItem['category'];
}

export interface FetchOptions {
  /** Lowercased keyword tokens; an item must include at least one to be kept */
  keywords?: string[];
  /** MSA / city tokens; if provided, items lacking a token are filtered out */
  msaTokens?: string[];
  /** Restrict to feed ids (default: all) */
  feedIds?: string[];
  /** Max items returned per feed (default: 25) */
  perFeedLimit?: number;
  /** Drop items older than this many days (default: 14) */
  maxAgeDays?: number;
}

// ============================================================================
// FEED REGISTRY
// ============================================================================

export const CRE_FEEDS: CreFeedDefinition[] = [
  // ─── GlobeSt ──────────────────────────────────────────────────────────────
  { id: 'globest', name: 'GlobeSt', url: 'https://www.globest.com/rss', format: 'rss', category: 'cre_press' },

  // ─── Bisnow (national + selected markets) ────────────────────────────────
  { id: 'bisnow_national', name: 'Bisnow National', url: 'https://www.bisnow.com/national/feed', format: 'rss', category: 'cre_press' },
  { id: 'bisnow_atlanta', name: 'Bisnow Atlanta', url: 'https://www.bisnow.com/atlanta/feed', format: 'rss', marketHint: 'Atlanta', category: 'cre_press' },
  { id: 'bisnow_dallas', name: 'Bisnow Dallas-Fort Worth', url: 'https://www.bisnow.com/dallas-ft-worth/feed', format: 'rss', marketHint: 'Dallas', category: 'cre_press' },
  { id: 'bisnow_houston', name: 'Bisnow Houston', url: 'https://www.bisnow.com/houston/feed', format: 'rss', marketHint: 'Houston', category: 'cre_press' },
  { id: 'bisnow_austin', name: 'Bisnow Austin', url: 'https://www.bisnow.com/austin/feed', format: 'rss', marketHint: 'Austin', category: 'cre_press' },
  { id: 'bisnow_phoenix', name: 'Bisnow Phoenix', url: 'https://www.bisnow.com/phoenix/feed', format: 'rss', marketHint: 'Phoenix', category: 'cre_press' },
  { id: 'bisnow_tampa', name: 'Bisnow Tampa', url: 'https://www.bisnow.com/tampa/feed', format: 'rss', marketHint: 'Tampa', category: 'cre_press' },
  { id: 'bisnow_charlotte', name: 'Bisnow Charlotte', url: 'https://www.bisnow.com/charlotte/feed', format: 'rss', marketHint: 'Charlotte', category: 'cre_press' },
  { id: 'bisnow_nyc', name: 'Bisnow New York', url: 'https://www.bisnow.com/new-york/feed', format: 'rss', marketHint: 'New York', category: 'cre_press' },
  { id: 'bisnow_la', name: 'Bisnow Los Angeles', url: 'https://www.bisnow.com/los-angeles/feed', format: 'rss', marketHint: 'Los Angeles', category: 'cre_press' },

  // ─── Connect CRE ──────────────────────────────────────────────────────────
  { id: 'connect_cre', name: 'Connect CRE', url: 'https://www.connectcre.com/feed/', format: 'rss', category: 'cre_press' },

  // ─── REJournals ───────────────────────────────────────────────────────────
  { id: 'rejournals', name: 'REJournals', url: 'https://rejournals.com/feed/', format: 'rss', category: 'cre_press' },

  // ─── Multifamily-specific trade press ─────────────────────────────────────
  { id: 'mfe', name: 'Multifamily Executive', url: 'https://www.multifamilyexecutive.com/rss', format: 'rss', category: 'cre_press' },
  { id: 'mhn', name: 'Multi-Housing News', url: 'https://www.multihousingnews.com/feed/', format: 'rss', category: 'cre_press' },

  // ─── BiggerPockets news ───────────────────────────────────────────────────
  { id: 'biggerpockets', name: 'BiggerPockets', url: 'https://www.biggerpockets.com/blog/feed', format: 'rss', category: 'cre_press' },

  // ─── SEC EDGAR REIT 8-K full-text search (Atom) ───────────────────────────
  // forms=8-K, q="REIT" — public, no key. Returned as Atom.
  {
    id: 'sec_reit_8k',
    name: 'SEC EDGAR REIT 8-K',
    url: 'https://efts.sec.gov/LATEST/search-index?q=%22REIT%22&dateRange=custom&forms=8-K&output=atom',
    format: 'sec_atom',
    category: 'reit_filing',
  },

  // ─── Reddit JSON ──────────────────────────────────────────────────────────
  { id: 'reddit_cre', name: 'r/CommercialRealEstate', url: 'https://www.reddit.com/r/CommercialRealEstate/new.json?limit=25', format: 'reddit_json', category: 'reddit' },
  { id: 'reddit_mf', name: 'r/multifamily', url: 'https://www.reddit.com/r/multifamily/new.json?limit=25', format: 'reddit_json', category: 'reddit' },
];

// ============================================================================
// RATE LIMITING (per-host token bucket)
// ============================================================================

interface HostBucket {
  tokens: number;
  capacity: number;
  refillRatePerMs: number;
  lastRefill: number;
  /** Backoff floor — host is locked out until this timestamp */
  backoffUntil: number;
}

/** Default: 1 request/sec, burst of 3, per host. */
const DEFAULT_CAPACITY = 3;
const DEFAULT_REFILL_PER_MS = 1 / 1000; // 1 token per second

const hostBuckets = new Map<string, HostBucket>();

function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

function getBucket(host: string): HostBucket {
  let b = hostBuckets.get(host);
  if (!b) {
    b = {
      tokens: DEFAULT_CAPACITY,
      capacity: DEFAULT_CAPACITY,
      refillRatePerMs: DEFAULT_REFILL_PER_MS,
      lastRefill: Date.now(),
      backoffUntil: 0,
    };
    hostBuckets.set(host, b);
  }
  return b;
}

async function acquireToken(host: string): Promise<void> {
  const b = getBucket(host);
  const now = Date.now();

  if (b.backoffUntil > now) {
    const wait = b.backoffUntil - now;
    await new Promise((r) => setTimeout(r, wait));
  }

  // Refill
  const elapsed = Date.now() - b.lastRefill;
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillRatePerMs);
  b.lastRefill = Date.now();

  if (b.tokens < 1) {
    const wait = Math.ceil((1 - b.tokens) / b.refillRatePerMs);
    await new Promise((r) => setTimeout(r, wait));
    b.tokens = 0;
    b.lastRefill = Date.now();
  } else {
    b.tokens -= 1;
  }
}

function applyBackoff(host: string, status?: number): void {
  const b = getBucket(host);
  // Aggressive backoff for 429/503; mild for other errors.
  const ms = status === 429 || status === 503 ? 5 * 60 * 1000 : 60 * 1000;
  b.backoffUntil = Date.now() + ms;
  logger.warn(`cre-rss: backing off ${host} for ${Math.round(ms / 1000)}s (status=${status ?? 'n/a'})`);
}

// ============================================================================
// CANONICAL URL & ID
// ============================================================================

/**
 * Strip query strings, fragments, trailing slashes, and lowercase the host.
 * This makes dedupe robust across UTM tags and tracking params.
 */
export function canonicalizeUrl(raw: string): string {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    u.hash = '';
    u.search = '';
    let s = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

function makeId(canonical: string): string {
  // Short, stable, base64url-ish id (no dependency on crypto for portability)
  const b64 = Buffer.from(canonical).toString('base64').replace(/[+/=]/g, '').slice(0, 24);
  return `cre_${b64}`;
}

// ============================================================================
// PARSING
// ============================================================================

const rssParser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'JediRE/1.0 (+https://jedire.app) CRE-News-Aggregator' },
});

async function fetchRss(feed: CreFeedDefinition): Promise<CreFeedItem[]> {
  const host = getHost(feed.url);
  await acquireToken(host);
  try {
    const parsed = await rssParser.parseURL(feed.url);
    return (parsed.items || []).map((item) => {
      const url = canonicalizeUrl(item.link || item.guid || '');
      return {
        id: makeId(url || `${feed.id}_${item.title}`),
        headline: (item.title || '').trim(),
        source: feed.name,
        sourceId: feed.id,
        url,
        publishedAt: new Date(item.isoDate || item.pubDate || Date.now()),
        summary: (item.contentSnippet || item.content || '').slice(0, 500) || undefined,
        marketHint: feed.marketHint,
        category: feed.category,
      } as CreFeedItem;
    });
  } catch (err: any) {
    applyBackoff(host, err?.response?.status);
    logger.warn(`cre-rss: RSS fetch failed for ${feed.id}: ${err?.message || err}`);
    return [];
  }
}

async function fetchRedditJson(feed: CreFeedDefinition): Promise<CreFeedItem[]> {
  const host = getHost(feed.url);
  await acquireToken(host);
  try {
    const res = await axios.get(feed.url, {
      headers: { 'User-Agent': 'JediRE/1.0 CRE-News-Aggregator (by /u/jedire)' },
      timeout: 8000,
    });
    const children = res.data?.data?.children || [];
    return children
      .map((c: any) => c?.data)
      .filter(Boolean)
      .map((d: any) => {
        const link = d.url_overridden_by_dest || `https://www.reddit.com${d.permalink}`;
        const url = canonicalizeUrl(link);
        return {
          id: makeId(url),
          headline: (d.title || '').trim(),
          source: feed.name,
          sourceId: feed.id,
          url,
          publishedAt: new Date((d.created_utc || 0) * 1000 || Date.now()),
          summary: (d.selftext || '').slice(0, 500) || undefined,
          marketHint: feed.marketHint,
          category: feed.category,
        } as CreFeedItem;
      });
  } catch (err: any) {
    applyBackoff(host, err?.response?.status);
    logger.warn(`cre-rss: Reddit fetch failed for ${feed.id}: ${err?.message || err}`);
    return [];
  }
}

async function fetchSecAtom(feed: CreFeedDefinition): Promise<CreFeedItem[]> {
  // SEC EDGAR full-text search returns Atom; rss-parser handles Atom too.
  const host = getHost(feed.url);
  await acquireToken(host);
  try {
    const parsed = await rssParser.parseURL(feed.url);
    return (parsed.items || []).map((item) => {
      const url = canonicalizeUrl(item.link || '');
      return {
        id: makeId(url || `${feed.id}_${item.title}`),
        headline: (item.title || '').trim(),
        source: feed.name,
        sourceId: feed.id,
        url,
        publishedAt: new Date(item.isoDate || item.pubDate || Date.now()),
        summary: (item.contentSnippet || '').slice(0, 500) || undefined,
        category: feed.category,
      } as CreFeedItem;
    });
  } catch (err: any) {
    applyBackoff(host, err?.response?.status);
    logger.warn(`cre-rss: SEC fetch failed for ${feed.id}: ${err?.message || err}`);
    return [];
  }
}

async function fetchOne(feed: CreFeedDefinition): Promise<CreFeedItem[]> {
  switch (feed.format) {
    case 'reddit_json':
      return fetchRedditJson(feed);
    case 'sec_atom':
      return fetchSecAtom(feed);
    case 'rss':
    default:
      return fetchRss(feed);
  }
}

// ============================================================================
// FILTERING & DEDUPE
// ============================================================================

function tokenizeText(s: string): string {
  return (s || '').toLowerCase();
}

function keepItem(item: CreFeedItem, opts: FetchOptions): boolean {
  const text = `${tokenizeText(item.headline)} ${tokenizeText(item.summary || '')}`;

  if (opts.maxAgeDays) {
    const cutoff = Date.now() - opts.maxAgeDays * 24 * 60 * 60 * 1000;
    if (item.publishedAt.getTime() < cutoff) return false;
  }

  if (opts.keywords && opts.keywords.length > 0) {
    const hit = opts.keywords.some((k) => text.includes(k.toLowerCase()));
    if (!hit) return false;
  }

  if (opts.msaTokens && opts.msaTokens.length > 0) {
    const matchedHint = item.marketHint
      ? opts.msaTokens.some((t) => item.marketHint!.toLowerCase().includes(t.toLowerCase()))
      : false;
    const matchedText = opts.msaTokens.some((t) => text.includes(t.toLowerCase()));
    if (!matchedHint && !matchedText) return false;
  }

  return true;
}

function dedupeByCanonicalUrl(items: CreFeedItem[]): CreFeedItem[] {
  const seen = new Map<string, CreFeedItem>();
  for (const item of items) {
    if (!item.url) continue;
    const existing = seen.get(item.url);
    if (!existing || existing.publishedAt < item.publishedAt) {
      seen.set(item.url, item);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fetch all configured trade-press feeds, optionally filtered by keywords/MSAs,
 * and return a deduplicated list sorted by recency.
 */
export async function fetchCreTradePressFeeds(opts: FetchOptions = {}): Promise<CreFeedItem[]> {
  const perFeedLimit = opts.perFeedLimit ?? 25;
  const feeds = opts.feedIds
    ? CRE_FEEDS.filter((f) => opts.feedIds!.includes(f.id))
    : CRE_FEEDS;

  const settled = await Promise.allSettled(feeds.map(fetchOne));
  const all: CreFeedItem[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') all.push(...r.value.slice(0, perFeedLimit));
  }

  const filtered = all.filter((i) => keepItem(i, opts));
  return dedupeByCanonicalUrl(filtered);
}

/** Exposed for tests / diagnostics. */
export function _resetRateLimiterForTests(): void {
  hostBuckets.clear();
}
