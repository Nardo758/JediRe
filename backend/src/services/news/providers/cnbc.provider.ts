/**
 * CNBC News Provider (via RSS)
 * 
 * FREE - Uses public RSS feeds
 * Best for: Markets, business, real estate
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
  id: 'cnbc',
  name: 'CNBC',
  description: 'Business news and real-time financial market coverage',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['business', 'finance', 'real-estate', 'technology'],
  baseUrl: 'https://www.cnbc.com',
};

// ============================================================================
// RSS FEEDS
// ============================================================================

const FEEDS: Record<string, string> = {
  'top': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',
  'business': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147',
  'finance': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
  'real-estate': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=104723454',
  'technology': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910',
  'economy': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
  'investing': 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069',
};

// ============================================================================
// CNBC PROVIDER
// ============================================================================

class CNBCProvider implements NewsProvider {
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
      provider: 'cnbc',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    logger.warn('CNBC getArticle not supported via RSS', { articleId });
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
      provider: 'cnbc',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['business']);
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
      logger.error('CNBC RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any): NewsArticle {
    // CNBC includes media:thumbnail
    let imageUrl: string | undefined;
    if (item['media:thumbnail']?.['$']?.url) {
      imageUrl = item['media:thumbnail']['$'].url;
    } else if (item['media:content']?.['$']?.url) {
      imageUrl = item['media:content']['$'].url;
    }

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'cnbc',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: {
        id: 'cnbc',
        name: 'CNBC',
      },
      author: item['dc:creator'],
      category: item.category,
      tags: [],
    };
  }
}

export const cnbcProvider = new CNBCProvider();
export default cnbcProvider;
