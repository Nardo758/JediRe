/**
 * GlobeSt News Provider (via RSS)
 * 
 * FREE - Uses public RSS feeds
 * SPECIALTY: Commercial Real Estate news - multifamily, office, retail, industrial
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

// GlobeSt.com shut down their RSS feeds (all /feed/ paths now 404).
// Replaced with three CRE-specialist sources that collectively cover the same
// sectors: Commercial Observer (deals/leasing), Trepp (CMBS/finance),
// PropModo (CRE technology & operations).  Provider ID kept as 'globest'
// so no import changes are needed in news.service.ts.
const config: NewsProviderConfig = {
  id: 'globest',
  name: 'CRE Intelligence',
  description: 'Commercial real estate news — Commercial Observer, Trepp, PropModo',
  hasFullContent: false,
  maxRequestsPerDay: -1,
  supportedCategories: ['real-estate', 'business', 'finance'],
  baseUrl: 'https://commercialobserver.com',
};

// ============================================================================
// RSS FEEDS  (all verified working 2026-04-22)
// ============================================================================

const FEEDS: Record<string, string> = {
  // Commercial Observer: 17 items, 1-day window — deals, leasing, sales
  'all':            'https://commercialobserver.com/feed/',
  'real-estate':    'https://commercialobserver.com/feed/',
  'office':         'https://commercialobserver.com/feed/',
  'retail':         'https://commercialobserver.com/feed/',
  'hospitality':    'https://commercialobserver.com/feed/',
  // Trepp: 10 items, 9-day window — CMBS, debt, distress analysis
  'multifamily':    'https://www.trepp.com/trepptalk/rss.xml',
  'industrial':     'https://www.trepp.com/trepptalk/rss.xml',
  'capital-markets':'https://www.trepp.com/trepptalk/rss.xml',
  'investment':     'https://www.trepp.com/trepptalk/rss.xml',
  // PropModo: 10 items, 2-day window — CRE technology and operations
  'technology':     'https://www.propmodo.com/feed/',
  'business':       'https://www.propmodo.com/feed/',
};

// ============================================================================
// GLOBEST PROVIDER
// ============================================================================

class GlobeStProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    // Try to match sector
    const queryLower = options.query?.toLowerCase() || '';
    let feedUrl = FEEDS['all'];
    
    if (queryLower.includes('multifamily') || queryLower.includes('apartment')) {
      feedUrl = FEEDS['multifamily'];
    } else if (queryLower.includes('office')) {
      feedUrl = FEEDS['office'];
    } else if (queryLower.includes('retail')) {
      feedUrl = FEEDS['retail'];
    } else if (queryLower.includes('industrial') || queryLower.includes('warehouse')) {
      feedUrl = FEEDS['industrial'];
    } else if (queryLower.includes('hotel') || queryLower.includes('hospitality')) {
      feedUrl = FEEDS['hospitality'];
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
      provider: 'globest',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    logger.warn('GlobeSt getArticle not supported via RSS', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    const feedUrl = options?.category && FEEDS[options.category]
      ? FEEDS[options.category]
      : FEEDS['all'];

    const articles = await this.fetchFeed(feedUrl);
    const limited = articles.slice(0, options?.pageSize || 10);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'globest',
    };
  }

  /**
   * Get sector-specific news
   */
  async getSectorNews(sector: 'multifamily' | 'office' | 'retail' | 'industrial' | 'hospitality', pageSize: number = 10): Promise<NewsSearchResult> {
    const feedUrl = FEEDS[sector] || FEEDS['all'];
    const articles = await this.fetchFeed(feedUrl);
    const limited = articles.slice(0, pageSize);

    return {
      articles: limited,
      totalResults: articles.length,
      page: 1,
      pageSize,
      provider: 'globest',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(FEEDS['all']);
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

      // Use the RSS channel title as the source name so articles from
      // Commercial Observer, Trepp, PropModo etc. show their real names.
      const channelTitle: string = parsed.rss?.channel?.title || 'CRE Intelligence';

      const items = parsed.rss?.channel?.item || [];
      const itemsArray = Array.isArray(items) ? items : [items];

      return itemsArray.map((item: any) => this.mapRssItem(item, channelTitle));
    } catch (error) {
      logger.error('CRE Intelligence RSS fetch failed', { url, error });
      return [];
    }
  }

  private mapRssItem(item: any, sourceName: string = 'CRE Intelligence'): NewsArticle {
    let imageUrl: string | undefined;
    if (item['media:content']?.['$']?.url) {
      imageUrl = item['media:content']['$'].url;
    } else if (item.enclosure?.['$']?.url) {
      imageUrl = item.enclosure['$'].url;
    }

    // Extract from description if needed
    if (!imageUrl && item.description) {
      const imgMatch = item.description.match(/src="([^"]+)"/);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    // Detect category from URL or title
    let category = 'Commercial Real Estate';
    const url = item.link || '';
    if (url.includes('/multifamily/') || item.title?.toLowerCase().includes('multifamily')) {
      category = 'Multifamily';
    } else if (url.includes('/office/')) {
      category = 'Office';
    } else if (url.includes('/retail/')) {
      category = 'Retail';
    } else if (url.includes('/industrial/')) {
      category = 'Industrial';
    }

    return {
      id: item.guid?._ || item.guid || item.link,
      provider: 'globest',
      title: item.title || 'Untitled',
      description: item.description?.replace(/<[^>]*>/g, '').slice(0, 300),
      content: undefined,
      url: item.link,
      imageUrl,
      publishedAt: new Date(item.pubDate),
      source: {
        id: 'globest',
        name: sourceName,
      },
      author: item['dc:creator'],
      category,
      tags: ['CRE', category.toLowerCase()],
    };
  }
}

export const globestProvider = new GlobeStProvider();
export default globestProvider;
