/**
 * News Services Index
 * 
 * Credit-metered news API integrations.
 * JediRe holds keys, users pay credits, margin is profit.
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

export * from './news-provider.interface';
export * from './news.service';

// Re-export providers for direct access if needed
export { guardianProvider } from './providers/guardian.provider';
export { nytProvider } from './providers/nyt.provider';
export { newsapiProvider } from './providers/newsapi.provider';

// Default export
import { newsService } from './news.service';
export default newsService;
