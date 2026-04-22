/**
 * News Provider Interface
 * 
 * Common interface for all news API providers.
 * JediRe holds the API keys and meters user credits.
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

// ============================================================================
// TYPES
// ============================================================================

export interface NewsArticle {
  id: string;
  provider: string;
  title: string;
  description?: string;
  content?: string;           // Full article body (if available)
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  source: {
    id?: string;
    name: string;
  };
  author?: string;
  category?: string;
  tags?: string[];
}

export interface NewsSearchOptions {
  query?: string;
  category?: 'business' | 'technology' | 'real-estate' | 'finance' | 'general';
  fromDate?: Date;
  toDate?: Date;
  pageSize?: number;
  page?: number;
  sortBy?: 'relevance' | 'publishedAt' | 'popularity';
}

export interface NewsSearchResult {
  articles: NewsArticle[];
  totalResults: number;
  page: number;
  pageSize: number;
  provider: string;
}

export interface NewsProviderConfig {
  id: string;
  name: string;
  description: string;
  hasFullContent: boolean;        // Provider returns full article body
  maxRequestsPerDay?: number;     // Rate limit
  supportedCategories: string[];
  baseUrl: string;
}

// ============================================================================
// CREDIT COSTS
// ============================================================================

export const NEWS_CREDIT_COSTS = {
  // Search operations
  'news.search': 1,              // Search headlines
  'news.search_premium': 2,      // Search with full content (if available)
  
  // Article operations  
  'news.article': 2,             // Get single article
  'news.article_full': 3,        // Get article with full body (Guardian)
  
  // Bulk operations
  'news.morning_brief': 5,       // Multi-source synthesized brief
  'news.market_scan': 5,         // Real estate market news scan
  
  // Background/automated
  'news.discovery': 1,           // Automated discovery (per source)
} as const;

export type NewsOperation = keyof typeof NEWS_CREDIT_COSTS;

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface NewsProvider {
  readonly config: NewsProviderConfig;
  
  /**
   * Search for articles matching criteria
   */
  searchArticles(options: NewsSearchOptions): Promise<NewsSearchResult>;
  
  /**
   * Get a specific article by ID
   */
  getArticle(articleId: string): Promise<NewsArticle | null>;
  
  /**
   * Get latest headlines (no query)
   */
  getHeadlines(options?: {
    category?: string;
    pageSize?: number;
  }): Promise<NewsSearchResult>;
  
  /**
   * Health check / API status
   */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

const providers = new Map<string, NewsProvider>();

export function registerProvider(provider: NewsProvider): void {
  providers.set(provider.config.id, provider);
}

export function getProvider(id: string): NewsProvider | undefined {
  return providers.get(id);
}

export function getAllProviders(): NewsProvider[] {
  return Array.from(providers.values());
}

export function getAvailableProviders(): NewsProviderConfig[] {
  return getAllProviders().map(p => p.config);
}
