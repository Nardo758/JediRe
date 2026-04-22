/**
 * Bisnow News Provider (via RSS)
 * 
 * FREE - Uses public RSS feeds
 * SPECIALTY: Commercial Real Estate news!
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
  id: 'bisnow',
  name: 'Bisnow',
  description: 'Commercial real estate news and events',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['real-estate', 'business'],
  baseUrl: 'https://www.bisnow.com',
};

// ============================================================================
// RSS FEEDS
// ============================================================================

const FEEDS: Record<string, string> = {
  'national': 'https://www.bisnow.com/national/feed',
  'real-estate': 'https://www.bisnow.com/national/feed',
  'multifamily': 'https://www.bisnow.com/national/feed', // Filter by query
  'business': 'https://www.bisnow.com/national/feed',
  // Regional feeds
  'new-york': 'https://www.bisnow.com/new-york/feed',
  'los-angeles': 'https://www.bisnow.com/los-angeles/feed',
  'chicago': 'https://www.bisnow.com/chicago/feed',
  'dallas': 'https://www.bisnow.com/dallas-ft-worth/feed',
  'phoenix': 'https://www.bisnow.com/phoenix/feed',
  'atlanta': 'https://www.bisnow.com/atlanta/feed',
  'miami': 'https://www.bisnow.com/south-florida/feed',
  'boston': 'https://www.bisnow.com/boston/feed',
  'dc': 'https://www.bisnow.com/washington-dc/feed',
  'san-francisco': 'https://www.bisnow.com/san-francisco/feed',
  'denver': 'https://www.bisnow.com/denver/feed',
  'seattle': 'https://www.bisnow.com/seattle/feed',
  'houston': 'https://www.bisnow.com/houston/feed',
  'tampa': 'https://www.bisnow.com/tampa-bay/feed',
  'austin': 'https://www.bisnow.com/austin-san-antonio/feed',
  'charlotte': 'https://www.bisnow.com/charlotte/feed',
  'nashville': 'https://www.bisnow.com/nashville/feed',
};

// ============================================================================
// BISNOW PROVIDER
// ============================================================================

class BisnowProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    // Check if querying a specific market
    const queryLower = options.query?.toLowerCase() || '';
    let feedUrl = FEEDS['national'];
    
    // Try to match a regional feed
    for (const [market, url] of Object.entries(FEEDS)) {
      if (queryLower.includes(market.replace('-', ' '))) {
        feedUrl = url;
        break;
      }
    }

    const articles = await this.fetchFeed(feedUrl);

    let filtered = articles;
    if (options.query) {
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
      provider: 'bisnow',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    logger.warn('Bisnow getArticle not supported via RSS', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    const articles = await this.fetchFeed(FEEDS['national']);
    const limited = articles.slice(0, options?.pageSize || 10);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'bisnow',
    };
  }

  /**
   * Get news for a specific market
   */
  async getMarketNews(market: string, pageSize: number = 10): Promise<NewsSearchResult> {
    const marketKey = market.toLowerCase().replace(/\s+/g, '-');
    const feedUrl = FEEDS[marketKey] || FEEDS['national'];

    const articles = await this.fetchFeed(feedUrl);
    const limited = articles.slice(0, pageSize);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize,
      provider: 'bisnow',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['national']);
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
      logger.error('Bisnow RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any): NewsArticle {
    // Extract image from enclosure or content
    let imageUrl: string | undefined;
    if (item.enclosure?.['$']?.url) {
      imageUrl = item.enclosure['$'].url;
    } else if (item['media:content']?.['$']?.url) {
      imageUrl = item['media:content']['$'].url;
    }

    // Bisnow often embeds image in description
    if (!imageUrl && item.description) {
      const imgMatch = item.description.match(/src="([^"]+)"/);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'bisnow',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: {
        id: 'bisnow',
        name: 'Bisnow',
      },
      author: item['dc:creator'],
      category: 'Commercial Real Estate',
      tags: ['CRE', 'real estate'],
    };
  }
}

export const bisnowProvider = new BisnowProvider();
export default bisnowProvider;
