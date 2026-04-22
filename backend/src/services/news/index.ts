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
export * from './newsletter-parser.service';

// Re-export providers for direct access if needed
// API-based
export { guardianProvider } from './providers/guardian.provider';
export { nytProvider } from './providers/nyt.provider';
export { newsapiProvider } from './providers/newsapi.provider';

// RSS-based (free, no keys needed)
export { marketwatchProvider } from './providers/marketwatch.provider';
export { bloombergProvider } from './providers/bloomberg.provider';
export { reutersProvider } from './providers/reuters.provider';
export { wsjProvider } from './providers/wsj.provider';
export { cnbcProvider } from './providers/cnbc.provider';
export { ftProvider } from './providers/ft.provider';

// CRE-specific
export { bisnowProvider } from './providers/bisnow.provider';
export { globestProvider } from './providers/globest.provider';

// Default export
import { newsService } from './news.service';
export default newsService;
