/**
 * Bloomberg News Provider (via RSS)
 * 
 * FREE - Uses public RSS feeds
 * Best for: Markets, finance, business news
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
  id: 'bloomberg',
  name: 'Bloomberg',
  description: 'Global business and financial information',
  hasFullContent: false,
  maxRequestsPerDay: -1, // RSS
  supportedCategories: ['business', 'finance', 'technology', 'real-estate'],
  baseUrl: 'https://www.bloomberg.com',
};

// ============================================================================
// RSS FEEDS
// ============================================================================

const FEEDS: Record<string, string> = {
  'top': 'https://feeds.bloomberg.com/markets/news.rss',
  'business': 'https://feeds.bloomberg.com/bview/news.rss',
  'finance': 'https://feeds.bloomberg.com/wealth/news.rss',
  'technology': 'https://feeds.bloomberg.com/technology/news.rss',
  'real-estate': 'https://feeds.bloomberg.com/pursuits/news.rss', // Closest match
  'economy': 'https://feeds.bloomberg.com/economics/news.rss',
  'markets': 'https://feeds.bloomberg.com/markets/news.rss',
};

// ============================================================================
// BLOOMBERG PROVIDER
// ============================================================================

class BloombergProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    const feedUrl = options.category && FEEDS[options.category]
      ? FEEDS[options.category]
      : FEEDS['markets'];

    const articles = await this.fetchFeed(feedUrl);

    // Filter by query
    let filtered = articles;
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      filtered = articles.filter(a =>
        a.title.toLowerCase().includes(queryLower) ||
        (a.description?.toLowerCase().includes(queryLower))
      );
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      articles: paged,
      totalResults: filtered.length,
      page,
      pageSize,
      provider: 'bloomberg',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    logger.warn('Bloomberg getArticle not supported via RSS', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    const feedUrl = options?.category && FEEDS[options.category]
      ? FEEDS[options.category]
      : FEEDS['markets'];

    const articles = await this.fetchFeed(feedUrl);
    const limited = articles.slice(0, options?.pageSize || 10);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'bloomberg',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['markets'], { method: 'HEAD' });
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

      const items = parsed.rss?.channel?.item || parsed.feed?.entry || [];
      const itemsArray = Array.isArray(items) ? items : [items];

      return itemsArray.map((item: any) => this.mapRssItem(item));
    } catch (error) {
      logger.error('Bloomberg RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any): NewsArticle {
    return {
      id: item.guid?._ || item.guid || item.id || item.link,
      provider: 'bloomberg',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300) || item.summary,
      content: undefined,
      url: item.link?.href || item.link,
      imageUrl: undefined,
      publishedAt: new Date(item.pubDate || item.published || item.updated),
      source: {
        id: 'bloomberg',
        name: 'Bloomberg',
      },
      author: item['dc:creator'] || item.author?.name,
      category: item.category,
      tags: [],
    };
  }
}

export const bloombergProvider = new BloombergProvider();
export default bloombergProvider;
