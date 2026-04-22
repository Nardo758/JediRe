/**
 * Financial Times News Provider (via RSS)
 * 
 * FREE - Uses public RSS feeds
 * Best for: Global business, markets, finance
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
  id: 'ft',
  name: 'Financial Times',
  description: 'International business news and analysis',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['business', 'finance', 'technology'],
  baseUrl: 'https://www.ft.com',
};

// ============================================================================
// RSS FEEDS
// ============================================================================

const FEEDS: Record<string, string> = {
  'top': 'https://www.ft.com/rss/home',
  'business': 'https://www.ft.com/companies?format=rss',
  'finance': 'https://www.ft.com/markets?format=rss',
  'markets': 'https://www.ft.com/markets?format=rss',
  'technology': 'https://www.ft.com/technology?format=rss',
  'world': 'https://www.ft.com/world?format=rss',
};

// ============================================================================
// FT PROVIDER
// ============================================================================

class FTProvider implements NewsProvider {
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
      provider: 'ft',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    logger.warn('FT getArticle not supported via RSS', { articleId });
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
      provider: 'ft',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['top']);
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
      logger.error('FT RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any): NewsArticle {
    let imageUrl: string | undefined;
    if (item['media:content']?.['$']?.url) {
      imageUrl = item['media:content']['$'].url;
    }

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'ft',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: {
        id: 'ft',
        name: 'Financial Times',
      },
      author: item['dc:creator'],
      category: item.category,
      tags: [],
    };
  }
}

export const ftProvider = new FTProvider();
export default ftProvider;
