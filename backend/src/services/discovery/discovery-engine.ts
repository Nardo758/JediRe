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

class DiscoveryEngine {
  private rateLimiters: Map<string, { count: number; resetAt: Date }> = new Map();

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

    // Store and dispatch events for significant news
    for (const news of discoveries) {
      await this.storeNewsDiscovery(news);
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

  private async storeNewsDiscovery(news: NewsDiscovery): Promise<void> {
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

      // Dispatch event for significant news
      await eventDispatcher.onNewsAlert({
        headline: news.headline,
        source: news.source,
        category: news.category,
        url: news.url,
      });

    } catch (error) {
      // Ignore duplicates
    }
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
