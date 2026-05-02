/**
 * Discovery Engine
 * 
 * Autonomous data discovery system that:
 * 1. Fetches data from external APIs
 * 2. Searches the web for relevant information
 * 3. Monitors news for deal/market-relevant events
 * 4. Stores discoveries for agent consumption
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import axios, { AxiosRequestConfig } from 'axios';
import { parseStringPromise } from 'xml2js';
import { DATA_SOURCES, DataSource, DataEndpoint, getDataSource } from './data-sources';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { eventDispatcher } from '../agents/event-dispatcher';
import { fetchCreTradePressFeeds, canonicalizeUrl, CreFeedItem } from './sources/cre-rss';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveryResult {
  sourceId: string;
  endpointId: string;
  query: Record<string, any>;
  data: any;
  relevance?: number;
  fetchedAt: Date;
  expiresAt?: Date;
}

export interface NewsDiscovery {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: Date;
  summary?: string;
  relevantMsas?: string[];
  relevantDeals?: string[];
  category: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

// ============================================================================
// DISCOVERY ENGINE CLASS
// ============================================================================

/** A precomputed matching token derived from an active deal's city / MSA name. */
interface ActiveDealMatchEntry {
  id: string;
  /** Lowercased market tokens used for hint/text matching (city, msa name, msa primary token). */
  tokens: string[];
}

class DiscoveryEngine {
  private rateLimiters: Map<string, { count: number; resetAt: Date }> = new Map();

  // Cache of active deals tokenized by city / MSA, used to auto-tag freshly
  // ingested trade-press items so the per-deal news endpoint sees them
  // immediately without waiting for the per-deal scan to be re-run.
  private activeDealsCache: { entries: ActiveDealMatchEntry[]; expiresAt: number } | null = null;
  private readonly ACTIVE_DEALS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH FROM SPECIFIC SOURCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch data from a specific source/endpoint
   */
  async fetch(
    sourceId: string,
    endpointId: string,
    params: Record<string, any>
  ): Promise<DiscoveryResult | null> {
    const source = getDataSource(sourceId);
    if (!source) {
      logger.error(`Unknown data source: ${sourceId}`);
      return null;
    }

    const endpoint = source.endpoints.find(e => e.id === endpointId);
    if (!endpoint) {
      logger.error(`Unknown endpoint: ${endpointId} for source ${sourceId}`);
      return null;
    }

    // Check rate limit
    if (!this.checkRateLimit(source)) {
      logger.warn(`Rate limit exceeded for ${sourceId}`);
      return null;
    }

    try {
      const data = await this.executeRequest(source, endpoint, params);
      
      const result: DiscoveryResult = {
        sourceId,
        endpointId,
        query: params,
        data,
        fetchedAt: new Date(),
        expiresAt: endpoint.refreshInterval 
          ? new Date(Date.now() + endpoint.refreshInterval * 1000)
          : undefined,
      };

      // Cache the result
      await this.cacheResult(result);

      return result;

    } catch (error: any) {
      logger.error(`Discovery fetch failed for ${sourceId}/${endpointId}:`, error.message);
      return null;
    }
  }

  /**
   * Execute HTTP request to source
   */
  private async executeRequest(
    source: DataSource,
    endpoint: DataEndpoint,
    params: Record<string, any>
  ): Promise<any> {
    let url = `${source.baseUrl}${endpoint.path}`;
    
    // Replace path parameters
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
    }

    const config: AxiosRequestConfig = {
      method: endpoint.method,
      url,
      headers: {
        'User-Agent': 'JediRE/1.0 (Real Estate Investment Platform)',
      },
    };

    // Add auth
    if (source.authType === 'api_key' && source.authEnvVar) {
      const apiKey = process.env[source.authEnvVar];
      if (apiKey) {
        if (source.id === 'newsapi') {
          config.headers!['X-Api-Key'] = apiKey;
        } else if (source.id === 'serper') {
          config.headers!['X-API-KEY'] = apiKey;
        } else if (source.baseUrl.includes('rapidapi')) {
          config.headers!['X-RapidAPI-Key'] = apiKey;
          config.headers!['X-RapidAPI-Host'] = new URL(source.baseUrl).host;
        } else {
          // Default: add as query param
          params.api_key = apiKey;
        }
      }
    }

    // Add params
    if (endpoint.method === 'GET') {
      config.params = params;
    } else {
      config.data = params;
    }

    const response = await axios(config);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEWS DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Discover relevant news for a topic/MSA
   */
  async discoverNews(topics: string[], opts?: { msaTokens?: string[] }): Promise<NewsDiscovery[]> {
    const discoveries: NewsDiscovery[] = [];
    const seenUrls = new Set<string>();

    const pushUnique = (item: NewsDiscovery) => {
      const key = canonicalizeUrl(item.url) || item.id;
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
      discoveries.push(item);
    };

    // CRE trade press (free, no API keys) — run first so we have a strong baseline
    try {
      const keywords = topics
        .flatMap((t) => t.split(/\s+/))
        .map((w) => w.toLowerCase())
        .filter((w) => w.length >= 3);

      const creItems: CreFeedItem[] = await fetchCreTradePressFeeds({
        keywords: keywords.length > 0 ? keywords : undefined,
        msaTokens: opts?.msaTokens,
        perFeedLimit: 25,
        maxAgeDays: 14,
      });

      for (const item of creItems.slice(0, 100)) {
        pushUnique({
          id: item.id,
          headline: item.headline,
          source: item.source,
          url: item.url,
          publishedAt: item.publishedAt,
          summary: item.summary,
          category: item.category,
          relevantMsas: item.marketHint ? [item.marketHint] : undefined,
        });
      }
    } catch (err) {
      logger.warn('cre-rss discovery failed:', err);
    }

    // Try NewsAPI first
    if (process.env.NEWSAPI_KEY) {
      for (const topic of topics) {
        try {
          const result = await this.fetch('newsapi', 'everything', {
            q: topic,
            sortBy: 'publishedAt',
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          });

          if (result?.data?.articles) {
            for (const article of result.data.articles.slice(0, 5)) {
              pushUnique({
                id: `newsapi_${Buffer.from(article.url).toString('base64').slice(0, 20)}`,
                headline: article.title,
                source: article.source?.name || 'Unknown',
                url: article.url,
                publishedAt: new Date(article.publishedAt),
                summary: article.description,
                category: 'general',
              });
            }
          }
        } catch (error) {
          logger.warn(`NewsAPI discovery failed for ${topic}:`, error);
        }
      }
    }

    // Fallback to Google News RSS (free)
    for (const topic of topics) {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
        const response = await axios.get(rssUrl);
        const parsed = await parseStringPromise(response.data);
        
        const items = parsed?.rss?.channel?.[0]?.item || [];
        for (const item of items.slice(0, 5)) {
          pushUnique({
            id: `gnews_${Buffer.from(item.link?.[0] || '').toString('base64').slice(0, 20)}`,
            headline: item.title?.[0] || '',
            source: item.source?.[0]?._ || 'Google News',
            url: item.link?.[0] || '',
            publishedAt: new Date(item.pubDate?.[0] || Date.now()),
            category: 'general',
          });
        }
      } catch (error) {
        logger.warn(`Google News discovery failed for ${topic}:`, error);
      }
    }

    // Store and dispatch events for significant news. We swallow per-item
    // failures here so a single bad row doesn't abort the whole discovery run;
    // batch jobs that need accurate persistence stats should call
    // `storeNewsDiscovery` directly and handle the thrown error themselves.
    for (const news of discoveries) {
      try {
        await this.storeNewsDiscovery(news);
      } catch (err) {
        logger.warn(`storeNewsDiscovery failed for id=${news.id}:`, err);
      }
    }

    return discoveries;
  }

  /**
   * Discover news relevant to a specific deal
   */
  async discoverDealNews(dealId: string): Promise<NewsDiscovery[]> {
    // Get deal info
    const dealRes = await query(
      `SELECT d.name, p.city, p.state, p.address, m.name as msa_name
       FROM deals d
       LEFT JOIN properties p ON d.property_id = p.id
       LEFT JOIN msas m ON p.msa_id = m.id
       WHERE d.id = $1`,
      [dealId]
    );

    if (dealRes.rows.length === 0) return [];

    const deal = dealRes.rows[0];
    const topics = [
      `${deal.city} ${deal.state} multifamily`,
      `${deal.city} apartment market`,
      deal.msa_name ? `${deal.msa_name} real estate` : null,
    ].filter(Boolean) as string[];

    const msaTokens = [deal.city, deal.msa_name].filter(Boolean) as string[];
    const news = await this.discoverNews(topics, { msaTokens });

    // Tag news with deal relevance and persist tags
    const tagged = news.map(n => ({
      ...n,
      relevantDeals: [dealId],
      relevantMsas: deal.msa_name ? [deal.msa_name] : n.relevantMsas,
    }));

    // Persist deal/MSA tags only — alert dispatch already happened in discoverNews()
    for (const item of tagged) {
      await this.upsertNewsDiscoveryTags(item);
    }

    return tagged;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ECONOMIC DATA DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch employment data for an MSA
   */
  async discoverEmploymentData(msaCode: string): Promise<DiscoveryResult | null> {
    // BLS series IDs follow format: LAUCN{FIPS}0000000003 for unemployment rate
    return this.fetch('bls', 'employment', { msaCode });
  }

  /**
   * Fetch interest rate data
   */
  async discoverInterestRates(): Promise<Record<string, any>> {
    const rates: Record<string, any> = {};

    // Fed Funds Rate
    const fedFunds = await this.fetch('fred', 'series', { seriesId: 'FEDFUNDS' });
    if (fedFunds?.data?.observations) {
      const latest = fedFunds.data.observations[fedFunds.data.observations.length - 1];
      rates.fedFunds = { value: parseFloat(latest.value), date: latest.date };
    }

    // 30-Year Mortgage
    const mortgage30 = await this.fetch('fred', 'series', { seriesId: 'MORTGAGE30US' });
    if (mortgage30?.data?.observations) {
      const latest = mortgage30.data.observations[mortgage30.data.observations.length - 1];
      rates.mortgage30 = { value: parseFloat(latest.value), date: latest.date };
    }

    // 10-Year Treasury
    const treasury10 = await this.fetch('fred', 'series', { seriesId: 'DGS10' });
    if (treasury10?.data?.observations) {
      const latest = treasury10.data.observations[treasury10.data.observations.length - 1];
      rates.treasury10 = { value: parseFloat(latest.value), date: latest.date };
    }

    // SOFR
    const sofr = await this.fetch('fred', 'series', { seriesId: 'SOFR' });
    if (sofr?.data?.observations) {
      const latest = sofr.data.observations[sofr.data.observations.length - 1];
      rates.sofr = { value: parseFloat(latest.value), date: latest.date };
    }

    return rates;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search the web for any query
   */
  async webSearch(query: string, type: 'web' | 'news' = 'web'): Promise<any[]> {
    if (process.env.SERPER_API_KEY) {
      const result = await this.fetch('serper', type === 'news' ? 'news' : 'search', { q: query });
      if (result?.data) {
        return type === 'news' 
          ? result.data.news || []
          : result.data.organic || [];
      }
    }

    // Fallback: use DuckDuckGo (no API key needed)
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const response = await axios.get(ddgUrl);
      return response.data.RelatedTopics || [];
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET DATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch REIT prices
   */
  async discoverREITPrices(symbols: string[] = ['AVB', 'EQR', 'MAA', 'UDR', 'CPT']): Promise<Record<string, any>> {
    const prices: Record<string, any> = {};

    for (const symbol of symbols) {
      try {
        const result = await this.fetch('yahoofinance', 'quote', { symbol, range: '5d', interval: '1d' });
        if (result?.data?.chart?.result?.[0]) {
          const quote = result.data.chart.result[0];
          const meta = quote.meta;
          prices[symbol] = {
            price: meta.regularMarketPrice,
            change: meta.regularMarketPrice - meta.previousClose,
            changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2),
          };
        }
      } catch (error) {
        logger.warn(`Failed to fetch REIT price for ${symbol}:`, error);
      }
    }

    return prices;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private checkRateLimit(source: DataSource): boolean {
    const limiter = this.rateLimiters.get(source.id);
    const now = new Date();

    if (!limiter || limiter.resetAt < now) {
      this.rateLimiters.set(source.id, {
        count: 1,
        resetAt: new Date(now.getTime() + source.rateLimit.perSeconds * 1000),
      });
      return true;
    }

    if (limiter.count >= source.rateLimit.requests) {
      return false;
    }

    limiter.count++;
    return true;
  }

  private async cacheResult(result: DiscoveryResult): Promise<void> {
    try {
      await query(
        `INSERT INTO discovery_cache (source_id, endpoint_id, query_hash, data, fetched_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (source_id, endpoint_id, query_hash) 
         DO UPDATE SET data = $4, fetched_at = $5, expires_at = $6`,
        [
          result.sourceId,
          result.endpointId,
          this.hashQuery(result.query),
          JSON.stringify(result.data),
          result.fetchedAt,
          result.expiresAt,
        ]
      );
    } catch (error) {
      logger.warn('Failed to cache discovery result:', error);
    }
  }

  /**
   * Load active deals (status not in 'closed'/'dead') with their city / MSA
   * tokens, used to auto-tag ingested news. Cached for a few minutes so a
   * single ingest batch doesn't hammer the deals table.
   */
  private async getActiveDealsForMatching(): Promise<ActiveDealMatchEntry[]> {
    const now = Date.now();
    if (this.activeDealsCache && this.activeDealsCache.expiresAt > now) {
      return this.activeDealsCache.entries;
    }

    try {
      // Pull deal market identifiers from both `deals` (city/state_code) and
      // the joined property/MSA so we work whether or not msa_id has been
      // populated yet. Status filter mirrors `dailyDealNewsDiscovery`.
      const result = await query(
        `SELECT d.id,
                COALESCE(NULLIF(p.city, ''), NULLIF(d.city, '')) AS city,
                m.name AS msa_name
           FROM deals d
           LEFT JOIN properties p ON p.id = d.property_id
           LEFT JOIN msas m ON m.id = p.msa_id
          WHERE d.status NOT IN ('closed', 'dead')`
      );

      const entries: ActiveDealMatchEntry[] = result.rows.map((r: any) => {
        const tokens = new Set<string>();
        const city = (r.city ? String(r.city) : '').toLowerCase().trim();
        if (city.length >= 3) tokens.add(city);

        if (r.msa_name) {
          const msaLower = String(r.msa_name).toLowerCase().trim();
          if (msaLower.length >= 3) tokens.add(msaLower);
          // MSA names look like "Atlanta-Sandy Springs-Roswell, GA". The first
          // segment is the anchor city we want to match hints like "Atlanta"
          // against, so add it as its own token.
          const primary = msaLower.split(/[,\-]/)[0]?.trim();
          if (primary && primary.length >= 3) tokens.add(primary);
        }

        return { id: String(r.id), tokens: Array.from(tokens) };
      });

      this.activeDealsCache = {
        entries,
        expiresAt: now + this.ACTIVE_DEALS_CACHE_TTL_MS,
      };
      return entries;
    } catch (err) {
      logger.warn('getActiveDealsForMatching failed:', err);
      return [];
    }
  }

  /**
   * Force the active-deals cache to refresh on next access. Exposed for tests
   * and for callers (e.g. deal CRUD) that know the deal list just changed.
   */
  invalidateActiveDealsCache(): void {
    this.activeDealsCache = null;
  }

  /**
   * Find active deal IDs that match a news item by MSA / city. Uses the
   * item's `relevantMsas` (which carries the feed `marketHint`) as the
   * primary signal, and falls back to looking for the deal's tokens in the
   * headline / summary text. Tokens shorter than 4 chars are skipped in the
   * text fallback to avoid false positives like "tampa" matching "tampering".
   */
  async matchActiveDealsForNews(news: NewsDiscovery): Promise<string[]> {
    const deals = await this.getActiveDealsForMatching();
    if (deals.length === 0) return [];

    const hints: string[] = [];
    if (news.relevantMsas) {
      for (const m of news.relevantMsas) {
        if (m) {
          const h = String(m).toLowerCase().trim();
          if (h.length >= 3) hints.push(h);
        }
      }
    }
    const text = `${news.headline || ''} ${news.summary || ''}`.toLowerCase();

    const matched = new Set<string>();
    for (const deal of deals) {
      if (deal.tokens.length === 0) continue;

      // Hint match (high precision): a hint and a deal token overlap as
      // substrings in either direction. e.g. hint="atlanta" matches token
      // "atlanta-sandy springs-roswell, ga".
      const hintHit = hints.some((h) =>
        deal.tokens.some((t) => h === t || h.includes(t) || t.includes(h))
      );
      if (hintHit) {
        matched.add(deal.id);
        continue;
      }

      // Text fallback: word-boundary search for the deal's tokens in the
      // article text. Skip very short tokens and reject pure-numeric ones.
      for (const t of deal.tokens) {
        if (t.length < 4) continue;
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'i');
        if (re.test(text)) {
          matched.add(deal.id);
          break;
        }
      }
    }

    return Array.from(matched);
  }

  /**
   * Outcome of an upsert into `news_discoveries`. Distinguishes a fresh
   * `'inserted'` row from a `'duplicate'` (id already existed and tags were
   * merged). DB-level failures are surfaced as thrown errors so callers can
   * decide whether to swallow, retry, or mark a batch run as partially failed.
   */
  async storeNewsDiscovery(news: NewsDiscovery): Promise<'inserted' | 'duplicate'> {
    // Auto-tag against active deals by MSA / city so ingested trade-press
    // items show up under the right deal without waiting for the per-deal
    // discoverDealNews() job to refetch them. Failures here are non-fatal —
    // we'd rather persist the article without auto-tags than drop it.
    let autoTaggedDeals: string[] = [];
    try {
      autoTaggedDeals = await this.matchActiveDealsForNews(news);
    } catch (err) {
      logger.warn(`auto-tag matching failed for news id=${news.id}:`, err);
    }

    const mergedDeals = autoTaggedDeals.length > 0
      ? Array.from(new Set([...(news.relevantDeals || []), ...autoTaggedDeals]))
      : news.relevantDeals;
    // The `xmax = 0` trick distinguishes a true INSERT from an ON CONFLICT
    // DO UPDATE: PostgreSQL only sets `xmax` on rows that were updated.
    const res = await query(
      `INSERT INTO news_discoveries (id, headline, source, url, published_at, summary, category, relevant_msas, relevant_deals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         relevant_msas = (
           SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
           FROM jsonb_array_elements(
             COALESCE(news_discoveries.relevant_msas, '[]'::jsonb) ||
             COALESCE(EXCLUDED.relevant_msas, '[]'::jsonb)
           ) AS v
         ),
         relevant_deals = (
           SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
           FROM jsonb_array_elements(
             COALESCE(news_discoveries.relevant_deals, '[]'::jsonb) ||
             COALESCE(EXCLUDED.relevant_deals, '[]'::jsonb)
           ) AS v
         )
       RETURNING (xmax = 0) AS inserted`,
      [
        news.id,
        news.headline,
        news.source,
        news.url,
        news.publishedAt,
        news.summary,
        news.category,
        news.relevantMsas ? JSON.stringify(news.relevantMsas) : null,
        mergedDeals && mergedDeals.length > 0 ? JSON.stringify(mergedDeals) : null,
      ]
    );

    const inserted: boolean = res.rows[0]?.inserted === true;

    // Only dispatch alerts for genuinely new items so recurring feed polls
    // don't fan out duplicate notifications for the same article.
    if (inserted) {
      await eventDispatcher.onNewsAlert({
        headline: news.headline,
        source: news.source,
        category: news.category,
        url: news.url,
      });
    }

    return inserted ? 'inserted' : 'duplicate';
  }

  /**
   * Sweep recently-ingested `news_discoveries` rows and append auto-matched
   * deal IDs to `relevant_deals`. Used as a safety net so items that landed
   * before this matcher existed (or before a new deal was created) still
   * surface under the right deal without a manual per-deal scan.
   *
   * Returns the number of rows that gained at least one new deal tag.
   */
  async backfillRecentNewsAutoTags(opts?: { sinceHours?: number; limit?: number }): Promise<number> {
    const sinceHours = opts?.sinceHours ?? 72;
    const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);

    let updated = 0;
    try {
      const res = await query(
        `SELECT id, headline, source, url, published_at, summary, category,
                relevant_msas, relevant_deals
           FROM news_discoveries
          WHERE created_at > NOW() - ($1::int * INTERVAL '1 hour')
          ORDER BY created_at DESC
          LIMIT $2`,
        [sinceHours, limit]
      );

      for (const row of res.rows) {
        const item: NewsDiscovery = {
          id: String(row.id),
          headline: row.headline,
          source: row.source,
          url: row.url,
          publishedAt: new Date(row.published_at),
          summary: row.summary || undefined,
          category: row.category,
          relevantMsas: Array.isArray(row.relevant_msas) ? row.relevant_msas : undefined,
          relevantDeals: Array.isArray(row.relevant_deals) ? row.relevant_deals : undefined,
        };
        const matched = await this.matchActiveDealsForNews(item);
        if (matched.length === 0) continue;

        const existing = new Set<string>(item.relevantDeals || []);
        const additions = matched.filter((id) => !existing.has(id));
        if (additions.length === 0) continue;

        try {
          await query(
            `UPDATE news_discoveries
                SET relevant_deals = (
                  SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
                  FROM jsonb_array_elements(
                    COALESCE(relevant_deals, '[]'::jsonb) || $2::jsonb
                  ) AS v
                )
              WHERE id = $1`,
            [item.id, JSON.stringify(additions)]
          );
          updated += 1;
        } catch (err) {
          logger.warn(`backfillRecentNewsAutoTags update failed for id=${item.id}:`, err);
        }
      }
    } catch (err) {
      logger.warn('backfillRecentNewsAutoTags sweep failed:', err);
    }

    return updated;
  }

  /**
   * Append deal/MSA tags to an already-stored news_discoveries row without
   * re-dispatching alerts. Used by discoverDealNews() to attach deal context
   * after discoverNews() has already inserted + dispatched.
   */
  private async upsertNewsDiscoveryTags(news: NewsDiscovery): Promise<void> {
    try {
      await query(
        `INSERT INTO news_discoveries (id, headline, source, url, published_at, summary, category, relevant_msas, relevant_deals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           relevant_msas = (
             SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
             FROM jsonb_array_elements(
               COALESCE(news_discoveries.relevant_msas, '[]'::jsonb) ||
               COALESCE(EXCLUDED.relevant_msas, '[]'::jsonb)
             ) AS v
           ),
           relevant_deals = (
             SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
             FROM jsonb_array_elements(
               COALESCE(news_discoveries.relevant_deals, '[]'::jsonb) ||
               COALESCE(EXCLUDED.relevant_deals, '[]'::jsonb)
             ) AS v
           )`,
        [
          news.id,
          news.headline,
          news.source,
          news.url,
          news.publishedAt,
          news.summary,
          news.category,
          news.relevantMsas ? JSON.stringify(news.relevantMsas) : null,
          news.relevantDeals ? JSON.stringify(news.relevantDeals) : null,
        ]
      );
    } catch {
      /* ignore */
    }
  }

  private hashQuery(query: Record<string, any>): string {
    return Buffer.from(JSON.stringify(query)).toString('base64').slice(0, 64);
  }
}

// Export singleton
export const discoveryEngine = new DiscoveryEngine();
export default discoveryEngine;
