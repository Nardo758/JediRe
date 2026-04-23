/**
 * HousingWire News Provider (via RSS)
 *
 * FREE - public RSS feed, no API key needed.
 * Best for: mortgage, real estate, housing market news.
 * Replaces the broken CNBC RSS feed (blocked from server-side fetch).
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

const config: NewsProviderConfig = {
  id: 'housingwire',
  name: 'HousingWire',
  description: 'Mortgage and real estate industry news',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['real-estate', 'mortgage', 'finance', 'business'],
  baseUrl: 'https://www.housingwire.com',
};

const FEEDS: Record<string, string> = {
  'top':         'https://www.housingwire.com/feed/',
  'real-estate': 'https://www.housingwire.com/feed/',
  'mortgage':    'https://www.housingwire.com/feed/',
  'business':    'https://www.housingwire.com/feed/',
  'finance':     'https://www.housingwire.com/feed/',
};

class HousingWireProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    const feedUrl = (options.category && FEEDS[options.category]) || FEEDS['top'];
    const articles = await this.fetchFeed(feedUrl);
    let filtered = articles;
    if (options.query) {
      const q = options.query.toLowerCase();
      filtered = articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description?.toLowerCase().includes(q))
      );
    }
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const start = (page - 1) * pageSize;
    return {
      articles: filtered.slice(start, start + pageSize),
      totalResults: filtered.length,
      page,
      pageSize,
      provider: 'housingwire',
    };
  }

  async getArticle(_articleId: string): Promise<NewsArticle | null> {
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    const feedUrl = (options?.category && FEEDS[options.category]) || FEEDS['top'];
    const articles = await this.fetchFeed(feedUrl);
    return {
      articles: articles.slice(0, options?.pageSize || 10),
      totalResults: articles.length,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'housingwire',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const r = await fetch(FEEDS['top'], { signal: AbortSignal.timeout(8000) });
      return r.ok;
    } catch {
      return false;
    }
  }

  private async fetchFeed(url: string): Promise<NewsArticle[]> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`RSS ${response.status}`);
      const xml = await response.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const items = parsed.rss?.channel?.item || [];
      const arr = Array.isArray(items) ? items : [items];
      return arr.map((item: any) => this.mapItem(item));
    } catch (err) {
      logger.error('HousingWire RSS fetch failed', { url, error: err });
      return [];
    }
  }

  private mapItem(item: any): NewsArticle {
    let imageUrl: string | undefined;
    if (item['media:content']?.['$']?.url) imageUrl = item['media:content']['$'].url;
    if (!imageUrl && item['media:thumbnail']?.['$']?.url) imageUrl = item['media:thumbnail']['$'].url;

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'housingwire',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: { id: 'housingwire', name: 'HousingWire' },
      author: item['dc:creator'] || item.author,
      category: item.category,
      tags: [],
    };
  }
}

export const housingwireProvider = new HousingWireProvider();
export default housingwireProvider;
