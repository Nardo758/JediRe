/**
 * The Guardian News Provider
 * 
 * FREE tier: 12 calls/second, 5000 calls/day
 * Returns FULL article content (big advantage)
 * 
 * Docs: https://open-platform.theguardian.com/documentation/
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

const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY || '';
const BASE_URL = 'https://content.guardianapis.com';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const config: NewsProviderConfig = {
  id: 'guardian',
  name: 'The Guardian',
  description: 'UK-based global news with full article content',
  hasFullContent: true,
  maxRequestsPerDay: 5000,
  supportedCategories: ['business', 'technology', 'money', 'us-news', 'world'],
  baseUrl: BASE_URL,
};

// ============================================================================
// CATEGORY MAPPING
// ============================================================================

const CATEGORY_MAP: Record<string, string> = {
  'business': 'business',
  'technology': 'technology',
  'finance': 'money',
  'real-estate': 'money', // Guardian doesn't have dedicated RE section
  'general': 'us-news',
};

// ============================================================================
// GUARDIAN PROVIDER
// ============================================================================

class GuardianProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    if (!GUARDIAN_API_KEY) {
      throw new Error('Guardian API key not configured');
    }

    const params = new URLSearchParams({
      'api-key': GUARDIAN_API_KEY,
      'show-fields': 'headline,trailText,body,thumbnail,byline,publication',
      'page-size': String(options.pageSize || 10),
      'page': String(options.page || 1),
      'order-by': options.sortBy === 'publishedAt' ? 'newest' : 'relevance',
    });

    if (options.query) {
      params.set('q', options.query);
    }

    if (options.category && CATEGORY_MAP[options.category]) {
      params.set('section', CATEGORY_MAP[options.category]);
    }

    if (options.fromDate) {
      params.set('from-date', options.fromDate.toISOString().split('T')[0]);
    }

    if (options.toDate) {
      params.set('to-date', options.toDate.toISOString().split('T')[0]);
    }

    const url = `${BASE_URL}/search?${params.toString()}`;
    logger.debug('Guardian API search', { url: url.replace(GUARDIAN_API_KEY, '***') });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Guardian API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.response;

    return {
      articles: results.results?.map(this.mapArticle) || [],
      totalResults: results.total || 0,
      page: results.currentPage || 1,
      pageSize: results.pageSize || 10,
      provider: 'guardian',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    if (!GUARDIAN_API_KEY) {
      throw new Error('Guardian API key not configured');
    }

    // Guardian article IDs are paths like "business/2026/apr/22/article-slug"
    const url = `${BASE_URL}/${articleId}?api-key=${GUARDIAN_API_KEY}&show-fields=headline,trailText,body,thumbnail,byline,publication`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Guardian API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.response?.content;
    if (!content) return null;

    return this.mapArticle(content);
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    return this.searchArticles({
      category: options?.category as any,
      pageSize: options?.pageSize || 10,
      sortBy: 'publishedAt',
    });
  }

  async healthCheck(): Promise<boolean> {
    if (!GUARDIAN_API_KEY) return false;

    try {
      const response = await fetch(`${BASE_URL}/search?api-key=${GUARDIAN_API_KEY}&page-size=1`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapArticle(item: any): NewsArticle {
    const fields = item.fields || {};
    
    return {
      id: item.id,
      provider: 'guardian',
      title: fields.headline || item.webTitle,
      description: fields.trailText,
      content: fields.body, // Full HTML content!
      url: item.webUrl,
      imageUrl: fields.thumbnail,
      publishedAt: new Date(item.webPublicationDate),
      source: {
        id: 'guardian',
        name: 'The Guardian',
      },
      author: fields.byline,
      category: item.sectionName,
      tags: item.tags?.map((t: any) => t.webTitle) || [],
    };
  }
}

export const guardianProvider = new GuardianProvider();
export default guardianProvider;
