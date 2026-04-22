/**
 * NewsAPI.org Provider
 * 
 * FREE tier: 100 requests/day, headlines only, 1 month old max
 * PAID tier ($449/mo): Full content, unlimited requests
 * 
 * Good for: Aggregating multiple sources in one call
 * 
 * Docs: https://newsapi.org/docs
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

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
const BASE_URL = 'https://newsapi.org/v2';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const config: NewsProviderConfig = {
  id: 'newsapi',
  name: 'NewsAPI',
  description: 'Aggregated news from 80,000+ sources worldwide',
  hasFullContent: false, // Free tier truncates content
  maxRequestsPerDay: 100, // Free tier
  supportedCategories: ['business', 'technology', 'general'],
  baseUrl: BASE_URL,
};

// ============================================================================
// NEWSAPI PROVIDER
// ============================================================================

class NewsAPIProvider implements NewsProvider {
  readonly config = config;

  async searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult> {
    if (!NEWSAPI_KEY) {
      throw new Error('NewsAPI key not configured');
    }

    const params = new URLSearchParams({
      'apiKey': NEWSAPI_KEY,
      'pageSize': String(Math.min(options.pageSize || 10, 100)),
      'page': String(options.page || 1),
      'language': 'en',
    });

    if (options.query) {
      params.set('q', options.query);
    } else {
      // NewsAPI requires either q or sources
      params.set('q', 'real estate OR commercial property OR multifamily');
    }

    if (options.sortBy === 'publishedAt') {
      params.set('sortBy', 'publishedAt');
    } else if (options.sortBy === 'popularity') {
      params.set('sortBy', 'popularity');
    } else {
      params.set('sortBy', 'relevancy');
    }

    if (options.fromDate) {
      params.set('from', options.fromDate.toISOString());
    }

    if (options.toDate) {
      params.set('to', options.toDate.toISOString());
    }

    const url = `${BASE_URL}/everything?${params.toString()}`;
    logger.debug('NewsAPI search', { url: url.replace(NEWSAPI_KEY, '***') });

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error(`NewsAPI error: ${data.code} - ${data.message}`);
    }

    return {
      articles: data.articles?.map(this.mapArticle) || [],
      totalResults: data.totalResults || 0,
      page: options.page || 1,
      pageSize: options.pageSize || 10,
      provider: 'newsapi',
    };
  }

  async getArticle(articleId: string): Promise<NewsArticle | null> {
    // NewsAPI doesn't support fetching by ID
    // The articleId we store is the URL
    logger.warn('NewsAPI getArticle not supported - use URL directly', { articleId });
    return null;
  }

  async getHeadlines(options?: { category?: string; pageSize?: number }): Promise<NewsSearchResult> {
    if (!NEWSAPI_KEY) {
      throw new Error('NewsAPI key not configured');
    }

    const params = new URLSearchParams({
      'apiKey': NEWSAPI_KEY,
      'pageSize': String(Math.min(options?.pageSize || 10, 100)),
      'country': 'us',
    });

    if (options?.category) {
      params.set('category', options.category);
    }

    const url = `${BASE_URL}/top-headlines?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error(`NewsAPI error: ${data.code} - ${data.message}`);
    }

    return {
      articles: data.articles?.map(this.mapArticle) || [],
      totalResults: data.totalResults || 0,
      page: 1,
      pageSize: options?.pageSize || 10,
      provider: 'newsapi',
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!NEWSAPI_KEY) return false;

    try {
      const response = await fetch(`${BASE_URL}/top-headlines?apiKey=${NEWSAPI_KEY}&country=us&pageSize=1`);
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  private mapArticle(article: any): NewsArticle {
    return {
      id: article.url, // NewsAPI uses URL as identifier
      provider: 'newsapi',
      title: article.title || 'Untitled',
      description: article.description,
      content: article.content, // Often truncated to ~200 chars on free tier
      url: article.url,
      imageUrl: article.urlToImage,
      publishedAt: new Date(article.publishedAt),
      source: {
        id: article.source?.id,
        name: article.source?.name || 'Unknown',
      },
      author: article.author,
      category: undefined,
      tags: [],
    };
  }
}

export const newsapiProvider = new NewsAPIProvider();
export default newsapiProvider;
