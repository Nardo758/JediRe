/**
 * MarketWatch News Provider (via RSS)
 * 
 * FREE - No API key needed, uses public RSS feeds
 * Great for: Real estate, markets, economy news
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import {
  NewsProvider,
  NewsProviderConfig,
  NewsArticle,
  NewsSearchOptions,
  NewsSearchResult,
} from '../news-provider.interface';
import { logger } from '../../../utils/logger';
import { parseStringPromise } from 'xml2js';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const config: NewsProviderConfig = {
  id: 'marketwatch',
  name: 'MarketWatch',
  description: 'Dow Jones financial news and market data',
  hasFullContent: false,
  maxRequestsPerDay: -1, // Unlimited (RSS)
  supportedCategories: ['business', 'finance', 'real-estate', 'technology'],
  baseUrl: 'https://feeds.marketwatch.com',
};

// ============================================================================
// RSS FEED URLS
// ============================================================================

const FEEDS: Record<string, string> = {
  'top': 'https://feeds.marketwatch.com/marketwatch/topstories/',
  'business': 'https://feeds.marketwatch.com/marketwatch/marketpulse/',
  'real-estate': 'https://feeds.marketwatch.com/marketwatch/realestate/',
  'finance': 'https://feeds.marketwatch.com/marketwatch/personalfinance/',
  'technology': 'https://feeds.marketwatch.com/marketwatch/software/',
  'economy': 'https://feeds.marketwatch.com/marketwatch/economy/',
};

// ============================================================================
// MARKETWATCH PROVIDER
// ============================================================================

class MarketWatchProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    // RSS doesn't support search, so we fetch relevant feeds and filter
    const feedUrl = options.category && FEEDS[options.category] 
      ? FEEDS[options.category] 
      : FEEDS['top'];

    const articles = await this.fetchFeed(feedUrl);
    
    // Filter by query if provided
    let filtered = articles;
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      filtered = articles.filter(a => 
        a.title.toLowerCase().includes(queryLower) ||
        (a.description?.toLowerCase().includes(queryLower))
      );
    }

    // Paginate
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      articles: paged,
      totalResults: filtered.length,
      page,
      pageSize,
      provider: 'marketwatch',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    // RSS doesn't support single article fetch
    // articleId is the URL, user should visit directly
    logger.warn('MarketWatch getArticle not supported via RSS', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    const feedUrl = options?.category && FEEDS[options.category]
      ? FEEDS[options.category]
      : FEEDS['top'];

    const articles = await this.fetchFeed(feedUrl);
    const limited = articles.slice(0, options?.pageSize || 10);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'marketwatch',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['top'], { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async fetchFeed(url: string): Promise<NewsArticle[]> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }

      const xml = await response.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      
      const items = parsed.rss?.channel?.item || [];
      const itemsArray = Array.isArray(items) ? items : [items];

      return itemsArray.map((item: any) => this.mapRssItem(item));
    } catch (error) {
      logger.error('MarketWatch RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any): NewsArticle {
    // Extract image from media:content or description
    let imageUrl: string | undefined;
    if (item['media:content']?.['$']?.url) {
      imageUrl = item['media:content']['$'].url;
    }

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'marketwatch',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: {
        id: 'marketwatch',
        name: 'MarketWatch',
      },
      author: item['dc:creator'] || item.author,
      category: item.category,
      tags: [],
    };
  }
}

export const marketwatchProvider = new MarketWatchProvider();
export default marketwatchProvider;
