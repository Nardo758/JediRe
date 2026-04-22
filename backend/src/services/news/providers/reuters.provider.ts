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

// Reuters shut down their public RSS syndication (reutersagency.com feeds 404,
// reuters.com requires login).  Replaced with two high-quality free feeds
// that fill the same role — broad market news + real-estate analysis.
// Provider ID kept as 'reuters' so no import changes are needed.
const config: NewsProviderConfig = {
  id: 'reuters',
  name: 'Markets & RE Analysis',
  description: 'Yahoo Finance top stories + Seeking Alpha real-estate coverage',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['business', 'finance', 'real-estate', 'technology'],
  baseUrl: 'https://finance.yahoo.com',
};

// ============================================================================
// RSS FEEDS  (all verified working 2026-04-22)
// ============================================================================

const FEEDS: Record<string, string> = {
  // Yahoo Finance: 45 items — broadest market coverage, updated continuously
  'top':      'https://finance.yahoo.com/rss/topstories',
  'business': 'https://finance.yahoo.com/rss/topstories',
  'finance':  'https://finance.yahoo.com/rss/topstories',
  'technology':'https://finance.yahoo.com/rss/topstories',
  // Seeking Alpha real-estate tag: 20 items, 1-day window — REIT + CRE analysis
  'real-estate': 'https://seekingalpha.com/tag/real-estate.xml',
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

      // Read channel title so Yahoo Finance / Seeking Alpha show their real names
      const channelTitle: string = parsed.rss?.channel?.title || 'Markets & RE Analysis';

      const items = parsed.rss?.channel?.item || [];
      const itemsArray = Array.isArray(items) ? items : [items];

      return itemsArray.map((item: any) => this.mapRssItem(item, channelTitle));
    } catch (error) {
      logger.error('Markets RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any, sourceName: string = 'Markets & RE Analysis'): NewsArticle {
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
        name: sourceName,
      },
      author: item['dc:creator'],
      category: item.category,
      tags: [],
    };
  }
}

export const reutersProvider = new ReutersProvider();
export default reutersProvider;
