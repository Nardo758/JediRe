/**
 * New York Times News Provider
 * 
 * FREE tier: 500 requests/day, 5 requests/minute
 * Returns headlines + snippets only (no full content)
 * 
 * Docs: https://developer.nytimes.com/docs/articlesearch-product/1/overview
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

const NYT_API_KEY = process.env.NYT_API_KEY || '';
const BASE_URL = 'https://api.nytimes.com/svc';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const config: NewsProviderConfig = {
  id: 'nyt',
  name: 'The New York Times',
  description: 'Premium US news source with extensive archives',
  hasFullContent: false, // NYT API only returns snippets
  maxRequestsPerDay: 500,
  supportedCategories: ['business', 'technology', 'real-estate', 'finance'],
  baseUrl: BASE_URL,
};

// ============================================================================
// CATEGORY/DESK MAPPING
// ============================================================================

const NEWS_DESK_MAP: Record<string, string> = {
  'business': 'Business',
  'technology': 'Technology',
  'finance': 'Business',
  'real-estate': 'RealEstate', // NYT has dedicated RE desk!
  'general': 'National',
};

// ============================================================================
// NYT PROVIDER
// ============================================================================

class NYTProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    if (!NYT_API_KEY) {
      throw new Error('NYT API key not configured');
    }

    const params = new URLSearchParams({
      'api-key': NYT_API_KEY,
      'page': String((options.page || 1) - 1), // NYT is 0-indexed
    });

    // Build filter query
    const filters: string[] = [];

    if (options.query) {
      params.set('q', options.query);
    }

    if (options.category && NEWS_DESK_MAP[options.category]) {
      filters.push(`news_desk:("${NEWS_DESK_MAP[options.category]}")`);
    }

    if (filters.length > 0) {
      params.set('fq', filters.join(' AND '));
    }

    if (options.fromDate) {
      params.set('begin_date', options.fromDate.toISOString().split('T')[0].replace(/-/g, ''));
    }

    if (options.toDate) {
      params.set('end_date', options.toDate.toISOString().split('T')[0].replace(/-/g, ''));
    }

    if (options.sortBy === 'publishedAt') {
      params.set('sort', 'newest');
    } else if (options.sortBy === 'relevance') {
      params.set('sort', 'relevance');
    }

    const url = `${BASE_URL}/search/v2/articlesearch.json?${params.toString()}`;
    logger.debug('NYT API search', { url: url.replace(NYT_API_KEY, '***') });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NYT API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.response;

    return {
      articles: results.docs?.map(this.mapArticle) || [],
      totalResults: results.meta?.hits || 0,
      page: (options.page || 1),
      pageSize: 10, // NYT returns 10 per page
      provider: 'nyt',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    // NYT doesn't have a direct article-by-ID endpoint in the free tier
    // We'd need to search for it by web_url or use the Article Search with specific filters
    // For now, return null and let the client use the URL directly
    logger.warn('NYT getArticle not implemented - use URL directly', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    // Use Top Stories API for headlines
    const section = options?.category === 'real-estate' ? 'realestate' :
                    options?.category === 'business' ? 'business' :
                    options?.category === 'technology' ? 'technology' : 'home';

    const url = `${BASE_URL}/topstories/v2/${section}.json?api-key=${NYT_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NYT Top Stories API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      articles: data.results?.slice(0, options?.pageSize || 10).map(this.mapTopStory) || [],
      totalResults: data.num_results || 0,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'nyt',
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!NYT_API_KEY) return false;

    try {
      const response = await fetch(`${BASE_URL}/topstories/v2/home.json?api-key=${NYT_API_KEY}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapArticle(doc: any): NewsArticle {
    // Find main image
    const multimedia = doc.multimedia || [];
    const image = multimedia.find((m: any) => m.subtype === 'xlarge' || m.type === 'image');
    const imageUrl = image ? `https://www.nytimes.com/${image.url}` : undefined;

    return {
      id: doc._id || doc.uri,
      provider: 'nyt',
      title: doc.headline?.main || doc.headline?.print_headline || 'Untitled',
      description: doc.abstract || doc.snippet,
      content: doc.lead_paragraph, // Only snippet available
      url: doc.web_url,
      imageUrl,
      publishedAt: new Date(doc.pub_date),
      source: {
        id: 'nyt',
        name: doc.source || 'The New York Times',
      },
      author: doc.byline?.original?.replace(/^By /i, ''),
      category: doc.news_desk,
      tags: doc.keywords?.map((k: any) => k.value) || [],
    };
  }

  private mapTopStory(story: any): NewsArticle {
    const image = story.multimedia?.find((m: any) => m.format === 'Large Thumbnail') ||
                  story.multimedia?.[0];

    return {
      id: story.uri || story.url,
      provider: 'nyt',
      title: story.title,
      description: story.abstract,
      content: story.abstract, // Top Stories doesn't include body
      url: story.url,
      imageUrl: image?.url,
      publishedAt: new Date(story.published_date),
      source: {
        id: 'nyt',
        name: 'The New York Times',
      },
      author: story.byline?.replace(/^By /i, ''),
      category: story.section,
      tags: story.des_facet || [],
    };
  }
}

export const nytProvider = new NYTProvider();
export default nytProvider;
