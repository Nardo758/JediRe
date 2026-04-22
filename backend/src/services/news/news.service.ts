/**
 * News Service
 * 
 * Central service for news operations with credit metering.
 * JediRe holds API keys, users pay in credits, difference is margin.
 * 
 * Credit costs:
 * - news.search: 1 credit
 * - news.article_full: 3 credits
 * - news.morning_brief: 5 credits
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import { creditService } from '../ai/creditService';
import {
  NewsProvider,
  NewsArticle,
  NewsSearchOptions,
  NewsSearchResult,
  NEWS_CREDIT_COSTS,
  NewsOperation,
  registerProvider,
  getProvider,
  getAllProviders,
  getAvailableProviders,
} from './news-provider.interface';

// Import and register providers
import { guardianProvider } from './providers/guardian.provider';
import { nytProvider } from './providers/nyt.provider';
import { newsapiProvider } from './providers/newsapi.provider';

// Register all providers on load
registerProvider(guardianProvider);
registerProvider(nytProvider);
registerProvider(newsapiProvider);

// ============================================================================
// TYPES
// ============================================================================

export interface NewsServiceOptions {
  userId: string;
  dealId?: string;
  providers?: string[];       // Specific providers to use (default: all available)
  skipCreditCheck?: boolean;  // For internal/automated calls
}

export interface MorningBriefOptions {
  userId: string;
  topics?: string[];          // Focus areas
  includeMarketNews?: boolean;
  includeRealEstateNews?: boolean;
  maxArticles?: number;
}

// ============================================================================
// NEWS SERVICE
// ============================================================================

class NewsService {
  
  /**
   * Search for news articles across providers
   * Cost: 1 credit per provider searched
   */
  async search(
    searchOpts: NewsSearchOptions,
    serviceOpts: NewsServiceOptions
  ): Promise<NewsSearchResult> {
    const { userId, providers: requestedProviders, skipCreditCheck } = serviceOpts;
    
    // Get available providers
    const availableProviders = await this.getHealthyProviders(requestedProviders);
    if (availableProviders.length === 0) {
      throw new Error('No news providers available');
    }

    // Charge credits (1 per provider)
    const creditCost = NEWS_CREDIT_COSTS['news.search'] * availableProviders.length;
    if (!skipCreditCheck) {
      const reserved = await creditService.reserveCredits(userId, creditCost);
      if (!reserved) {
        logger.warn('News search proceeding in overage', { userId, creditCost });
      }
    }

    try {
      // Search first available provider (could parallelize for multi-source)
      const provider = availableProviders[0];
      const result = await provider.searchArticles(searchOpts);

      // Log usage
      await this.logUsage(userId, 'news.search', provider.config.id, creditCost, {
        query: searchOpts.query,
        resultsCount: result.articles.length,
      });

      return result;
    } catch (error) {
      // Refund on failure if we reserved
      if (!skipCreditCheck) {
        await creditService.debitActualCost(userId, creditCost, 0);
      }
      throw error;
    }
  }

  /**
   * Search multiple providers and aggregate results
   * Cost: 1 credit per provider
   */
  async searchMulti(
    searchOpts: NewsSearchOptions,
    serviceOpts: NewsServiceOptions
  ): Promise<{ results: NewsSearchResult[]; totalCredits: number }> {
    const { userId, providers: requestedProviders, skipCreditCheck } = serviceOpts;
    
    const availableProviders = await this.getHealthyProviders(requestedProviders);
    const creditCost = NEWS_CREDIT_COSTS['news.search'] * availableProviders.length;

    if (!skipCreditCheck) {
      await creditService.reserveCredits(userId, creditCost);
    }

    const results: NewsSearchResult[] = [];
    let successCount = 0;

    for (const provider of availableProviders) {
      try {
        const result = await provider.searchArticles(searchOpts);
        results.push(result);
        successCount++;
      } catch (error) {
        logger.warn(`Provider ${provider.config.id} search failed`, { error });
      }
    }

    // Charge only for successful calls
    const actualCost = NEWS_CREDIT_COSTS['news.search'] * successCount;
    if (!skipCreditCheck && actualCost !== creditCost) {
      await creditService.debitActualCost(userId, creditCost, actualCost);
    }

    await this.logUsage(userId, 'news.search', 'multi', actualCost, {
      query: searchOpts.query,
      providersSearched: successCount,
    });

    return { results, totalCredits: actualCost };
  }

  /**
   * Get full article content (Guardian only has full content)
   * Cost: 3 credits
   */
  async getFullArticle(
    providerId: string,
    articleId: string,
    serviceOpts: NewsServiceOptions
  ): Promise<NewsArticle | null> {
    const { userId, skipCreditCheck } = serviceOpts;
    const provider = getProvider(providerId);

    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const creditCost = provider.config.hasFullContent
      ? NEWS_CREDIT_COSTS['news.article_full']
      : NEWS_CREDIT_COSTS['news.article'];

    if (!skipCreditCheck) {
      await creditService.reserveCredits(userId, creditCost);
    }

    try {
      const article = await provider.getArticle(articleId);

      await this.logUsage(userId, 'news.article_full', providerId, creditCost, {
        articleId,
        hasContent: !!article?.content,
      });

      return article;
    } catch (error) {
      if (!skipCreditCheck) {
        await creditService.debitActualCost(userId, creditCost, 0);
      }
      throw error;
    }
  }

  /**
   * Get headlines from a provider
   * Cost: 1 credit
   */
  async getHeadlines(
    providerId: string,
    options: { category?: string; pageSize?: number },
    serviceOpts: NewsServiceOptions
  ): Promise<NewsSearchResult> {
    const { userId, skipCreditCheck } = serviceOpts;
    const provider = getProvider(providerId);

    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const creditCost = NEWS_CREDIT_COSTS['news.search'];

    if (!skipCreditCheck) {
      await creditService.reserveCredits(userId, creditCost);
    }

    try {
      const result = await provider.getHeadlines(options);

      await this.logUsage(userId, 'news.search', providerId, creditCost, {
        operation: 'headlines',
        category: options.category,
      });

      return result;
    } catch (error) {
      if (!skipCreditCheck) {
        await creditService.debitActualCost(userId, creditCost, 0);
      }
      throw error;
    }
  }

  /**
   * Generate a morning news brief across multiple sources
   * Cost: 5 credits
   */
  async generateMorningBrief(options: MorningBriefOptions): Promise<{
    articles: NewsArticle[];
    summary?: string;
    creditsUsed: number;
  }> {
    const { userId, topics, includeMarketNews = true, includeRealEstateNews = true, maxArticles = 20 } = options;
    const creditCost = NEWS_CREDIT_COSTS['news.morning_brief'];

    await creditService.reserveCredits(userId, creditCost);

    try {
      const allArticles: NewsArticle[] = [];
      const providers = await this.getHealthyProviders();

      // Build queries based on preferences
      const queries: string[] = [];
      if (includeRealEstateNews) {
        queries.push('real estate investment OR multifamily OR commercial property');
      }
      if (includeMarketNews) {
        queries.push('interest rates OR Federal Reserve OR inflation');
      }
      if (topics && topics.length > 0) {
        queries.push(topics.join(' OR '));
      }

      // Search each provider for each query
      for (const provider of providers.slice(0, 2)) { // Limit to 2 providers
        for (const q of queries.slice(0, 2)) { // Limit queries
          try {
            const result = await provider.searchArticles({
              query: q,
              pageSize: 5,
              sortBy: 'publishedAt',
            });
            allArticles.push(...result.articles);
          } catch (error) {
            logger.warn(`Morning brief: provider ${provider.config.id} failed`, { error });
          }
        }
      }

      // Dedupe and sort by date
      const seen = new Set<string>();
      const deduped = allArticles.filter(a => {
        const key = a.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      const final = deduped.slice(0, maxArticles);

      await this.logUsage(userId, 'news.morning_brief', 'multi', creditCost, {
        articlesReturned: final.length,
        queries,
      });

      return {
        articles: final,
        creditsUsed: creditCost,
      };
    } catch (error) {
      await creditService.debitActualCost(userId, creditCost, 0);
      throw error;
    }
  }

  /**
   * Real estate market news scan
   * Cost: 5 credits
   */
  async marketNewsScan(
    userId: string,
    markets: string[] = []
  ): Promise<{ articles: NewsArticle[]; creditsUsed: number }> {
    const creditCost = NEWS_CREDIT_COSTS['news.market_scan'];
    await creditService.reserveCredits(userId, creditCost);

    try {
      const allArticles: NewsArticle[] = [];
      const providers = await this.getHealthyProviders();

      // Base RE queries
      const queries = [
        'multifamily apartment investment',
        'commercial real estate market',
        'cap rates real estate',
        ...markets.map(m => `${m} real estate market`),
      ];

      for (const provider of providers.slice(0, 2)) {
        for (const q of queries.slice(0, 3)) {
          try {
            const result = await provider.searchArticles({
              query: q,
              pageSize: 5,
              sortBy: 'publishedAt',
            });
            allArticles.push(...result.articles);
          } catch (error) {
            // Continue on failure
          }
        }
      }

      // Dedupe
      const seen = new Set<string>();
      const final = allArticles.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      }).slice(0, 25);

      await this.logUsage(userId, 'news.market_scan', 'multi', creditCost, {
        markets,
        articlesReturned: final.length,
      });

      return { articles: final, creditsUsed: creditCost };
    } catch (error) {
      await creditService.debitActualCost(userId, creditCost, 0);
      throw error;
    }
  }

  /**
   * Get list of available providers
   */
  getProviders() {
    return getAvailableProviders();
  }

  /**
   * Check provider health
   */
  async getProviderHealth(): Promise<Record<string, boolean>> {
    const providers = getAllProviders();
    const health: Record<string, boolean> = {};

    for (const p of providers) {
      try {
        health[p.config.id] = await p.healthCheck();
      } catch {
        health[p.config.id] = false;
      }
    }

    return health;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async getHealthyProviders(requested?: string[]): Promise<NewsProvider[]> {
    const all = getAllProviders();
    const filtered = requested
      ? all.filter(p => requested.includes(p.config.id))
      : all;

    // Check health (could cache this)
    const healthy: NewsProvider[] = [];
    for (const p of filtered) {
      try {
        const ok = await p.healthCheck();
        if (ok) healthy.push(p);
      } catch {
        // Skip unhealthy
      }
    }

    return healthy;
  }

  private async logUsage(
    userId: string,
    operation: string,
    provider: string,
    credits: number,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO news_api_usage 
         (user_id, operation, provider, credits_charged, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, operation, provider, credits, JSON.stringify(metadata)]
      );
    } catch (error) {
      logger.warn('Failed to log news API usage', { error });
    }
  }
}

// Export singleton
export const newsService = new NewsService();
export default newsService;
