/**
 * Reuters News Provider (via RSS)
 * 
 * FREE - Uses public RSS feeds
 * Best for: Breaking news, markets, business
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
  id: 'reuters',
  name: 'Reuters',
  description: 'Global news agency - breaking business and financial news',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['business', 'finance', 'technology'],
  baseUrl: 'https://www.reuters.com',
};

// ============================================================================
// RSS FEEDS
// ============================================================================

const FEEDS: Record<string, string> = {
  'top': 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
  'business': 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
  'finance': 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
  'technology': 'https://www.reutersagency.com/feed/?best-topics=tech&post_type=best',
};

// ============================================================================
// REUTERS PROVIDER
// ============================================================================

class ReutersProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    const feedUrl = options.category && FEEDS[options.category]
      ? FEEDS[options.category]
      : FEEDS['business'];

    const articles = await this.fetchFeed(feedUrl);

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
      provider: 'reuters',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    logger.warn('Reuters getArticle not supported via RSS', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    const feedUrl = options?.category && FEEDS[options.category]
      ? FEEDS[options.category]
      : FEEDS['business'];

    const articles = await this.fetchFeed(feedUrl);
    const limited = articles.slice(0, options?.pageSize || 10);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'reuters',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['business'], { method: 'HEAD' });
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
      logger.error('Reuters RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any): NewsArticle {
    // Extract image from enclosure or media:content
    let imageUrl: string | undefined;
    if (item.enclosure?.['$']?.url) {
      imageUrl = item.enclosure['$'].url;
    } else if (item['media:content']?.['$']?.url) {
      imageUrl = item['media:content']['$'].url;
    }

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'reuters',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: {
        id: 'reuters',
        name: 'Reuters',
      },
      author: item['dc:creator'],
      category: item.category,
      tags: [],
    };
  }
}

export const reutersProvider = new ReutersProvider();
export default reutersProvider;
