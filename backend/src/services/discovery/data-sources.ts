/**
 * Data Sources Registry
 * 
 * Defines all external data sources agents can query:
 * - Public APIs (BLS, FRED, Census, SEC)
 * - News APIs (NewsAPI, Google News)
 * - Real Estate Data (CoStar proxy, Zillow, Redfin)
 * - Market Data (Yahoo Finance, Treasury)
 * - Web Search (for ad-hoc discovery)
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface DataSource {
  id: string;
  name: string;
  category: 'economic' | 'real_estate' | 'news' | 'market' | 'regulatory' | 'web';
  description: string;
  baseUrl: string;
  authType: 'none' | 'api_key' | 'oauth' | 'bearer';
  authEnvVar?: string;
  rateLimit: { requests: number; perSeconds: number };
  endpoints: DataEndpoint[];
}

export interface DataEndpoint {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST';
  description: string;
  parameters: z.ZodObject<any>;
  responseMapping?: Record<string, string>;  // Maps response fields to our schema
  refreshInterval?: number;  // How often to refresh in seconds
}

// ============================================================================
// DATA SOURCES
// ============================================================================

export const DATA_SOURCES: DataSource[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ECONOMIC DATA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'bls',
    name: 'Bureau of Labor Statistics',
    category: 'economic',
    description: 'Employment, unemployment, CPI, wages by MSA',
    baseUrl: 'https://api.bls.gov/publicAPI/v2',
    authType: 'api_key',
    authEnvVar: 'BLS_API_KEY',
    rateLimit: { requests: 50, perSeconds: 60 },
    endpoints: [
      {
        id: 'employment',
        name: 'Employment by MSA',
        path: '/timeseries/data/',
        method: 'POST',
        description: 'Get employment data for a metropolitan area',
        parameters: z.object({
          msaCode: z.string().describe('MSA FIPS code'),
          startYear: z.number().optional(),
          endYear: z.number().optional(),
        }),
        refreshInterval: 86400, // Daily
      },
      {
        id: 'cpi',
        name: 'Consumer Price Index',
        path: '/timeseries/data/',
        method: 'POST',
        description: 'Get CPI inflation data',
        parameters: z.object({
          region: z.enum(['national', 'south', 'west', 'midwest', 'northeast']).optional(),
        }),
        refreshInterval: 86400,
      },
    ],
  },

  {
    id: 'fred',
    name: 'Federal Reserve Economic Data',
    category: 'economic',
    description: 'Interest rates, GDP, monetary policy data',
    baseUrl: 'https://api.stlouisfed.org/fred',
    authType: 'api_key',
    authEnvVar: 'FRED_API_KEY',
    rateLimit: { requests: 120, perSeconds: 60 },
    endpoints: [
      {
        id: 'series',
        name: 'Economic Series',
        path: '/series/observations',
        method: 'GET',
        description: 'Get time series data for any FRED series',
        parameters: z.object({
          seriesId: z.string().describe('FRED series ID (e.g., FEDFUNDS, GDP, MORTGAGE30US)'),
          observationStart: z.string().optional(),
          observationEnd: z.string().optional(),
        }),
        refreshInterval: 3600, // Hourly for rates
      },
    ],
  },

  {
    id: 'census',
    name: 'US Census Bureau',
    category: 'economic',
    description: 'Population, demographics, housing statistics',
    baseUrl: 'https://api.census.gov/data',
    authType: 'api_key',
    authEnvVar: 'CENSUS_API_KEY',
    rateLimit: { requests: 500, perSeconds: 60 },
    endpoints: [
      {
        id: 'population',
        name: 'Population Estimates',
        path: '/2023/pep/population',
        method: 'GET',
        description: 'Get population data by geography',
        parameters: z.object({
          state: z.string().optional(),
          county: z.string().optional(),
        }),
        refreshInterval: 604800, // Weekly
      },
      {
        id: 'housing',
        name: 'Housing Units',
        path: '/2023/acs/acs5',
        method: 'GET',
        description: 'Get housing unit counts and characteristics',
        parameters: z.object({
          state: z.string(),
          variables: z.array(z.string()).optional(),
        }),
        refreshInterval: 604800,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEWS & EVENTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'newsapi',
    name: 'NewsAPI',
    category: 'news',
    description: 'Breaking news and headlines from 80,000+ sources',
    baseUrl: 'https://newsapi.org/v2',
    authType: 'api_key',
    authEnvVar: 'NEWSAPI_KEY',
    rateLimit: { requests: 100, perSeconds: 86400 }, // 100/day on free tier
    endpoints: [
      {
        id: 'everything',
        name: 'Search News',
        path: '/everything',
        method: 'GET',
        description: 'Search all news articles',
        parameters: z.object({
          q: z.string().describe('Search query'),
          from: z.string().optional(),
          to: z.string().optional(),
          sortBy: z.enum(['relevancy', 'popularity', 'publishedAt']).optional(),
        }),
        refreshInterval: 3600,
      },
      {
        id: 'headlines',
        name: 'Top Headlines',
        path: '/top-headlines',
        method: 'GET',
        description: 'Get breaking news headlines',
        parameters: z.object({
          category: z.enum(['business', 'technology', 'general']).optional(),
          country: z.string().optional(),
        }),
        refreshInterval: 1800, // 30 min
      },
    ],
  },

  {
    id: 'cre_rss',
    name: 'CRE Trade-Press RSS',
    category: 'news',
    description: 'Free public RSS/JSON feeds from CRE publishers (GlobeSt, Bisnow, Connect CRE, REJournals, MFE, MHN, BiggerPockets, SEC EDGAR REIT 8-K, Reddit). Aggregated by services/discovery/sources/cre-rss.',
    baseUrl: 'aggregate://cre-rss',
    authType: 'none',
    rateLimit: { requests: 600, perSeconds: 3600 },
    endpoints: [
      {
        id: 'all',
        name: 'All CRE Trade-Press Feeds',
        path: '',
        method: 'GET',
        description: 'Fetch and dedupe items from all configured CRE feeds. Filter by keywords/MSAs.',
        parameters: z.object({
          keywords: z.array(z.string()).optional(),
          msaTokens: z.array(z.string()).optional(),
          maxAgeDays: z.number().optional().default(14),
        }),
        refreshInterval: 1800, // 30 min
      },
    ],
  },

  {
    id: 'googlenews',
    name: 'Google News RSS',
    category: 'news',
    description: 'Google News search via RSS (no API key needed)',
    baseUrl: 'https://news.google.com/rss',
    authType: 'none',
    rateLimit: { requests: 100, perSeconds: 3600 },
    endpoints: [
      {
        id: 'search',
        name: 'Search Google News',
        path: '/search',
        method: 'GET',
        description: 'Search Google News',
        parameters: z.object({
          q: z.string().describe('Search query'),
          hl: z.string().optional().default('en-US'),
          gl: z.string().optional().default('US'),
        }),
        refreshInterval: 3600,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL ESTATE DATA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'zillow',
    name: 'Zillow (RapidAPI)',
    category: 'real_estate',
    description: 'Property values, rent estimates, market trends',
    baseUrl: 'https://zillow-com1.p.rapidapi.com',
    authType: 'api_key',
    authEnvVar: 'RAPIDAPI_KEY',
    rateLimit: { requests: 100, perSeconds: 86400 },
    endpoints: [
      {
        id: 'property',
        name: 'Property Details',
        path: '/property',
        method: 'GET',
        description: 'Get property details by address or zpid',
        parameters: z.object({
          zpid: z.string().optional(),
          address: z.string().optional(),
        }),
        refreshInterval: 86400,
      },
      {
        id: 'rentEstimate',
        name: 'Rent Estimate',
        path: '/rentEstimate',
        method: 'GET',
        description: 'Get rent Zestimate for a property',
        parameters: z.object({
          zpid: z.string(),
        }),
        refreshInterval: 604800,
      },
    ],
  },

  {
    id: 'apartmentlist',
    name: 'Apartment List Data',
    category: 'real_estate',
    description: 'Rent reports and vacancy data (public CSV)',
    baseUrl: 'https://www.apartmentlist.com/research/data',
    authType: 'none',
    rateLimit: { requests: 10, perSeconds: 3600 },
    endpoints: [
      {
        id: 'rentReport',
        name: 'National Rent Report',
        path: '/rent-estimates',
        method: 'GET',
        description: 'Monthly rent data by city',
        parameters: z.object({
          city: z.string().optional(),
          state: z.string().optional(),
        }),
        refreshInterval: 2592000, // Monthly
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET DATA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'treasury',
    name: 'US Treasury',
    category: 'market',
    description: 'Treasury rates and yield curve data',
    baseUrl: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
    authType: 'none',
    rateLimit: { requests: 1000, perSeconds: 3600 },
    endpoints: [
      {
        id: 'rates',
        name: 'Treasury Rates',
        path: '/v2/accounting/od/avg_interest_rates',
        method: 'GET',
        description: 'Get average interest rates on treasury securities',
        parameters: z.object({
          filter: z.string().optional(),
          sort: z.string().optional(),
        }),
        refreshInterval: 86400,
      },
    ],
  },

  {
    id: 'yahoofinance',
    name: 'Yahoo Finance',
    category: 'market',
    description: 'Stock quotes, REIT prices, market data',
    baseUrl: 'https://query1.finance.yahoo.com/v8/finance',
    authType: 'none',
    rateLimit: { requests: 100, perSeconds: 60 },
    endpoints: [
      {
        id: 'quote',
        name: 'Stock Quote',
        path: '/chart/{symbol}',
        method: 'GET',
        description: 'Get stock/REIT quote',
        parameters: z.object({
          symbol: z.string().describe('Ticker symbol'),
          interval: z.enum(['1d', '1wk', '1mo']).optional(),
          range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y']).optional(),
        }),
        refreshInterval: 300, // 5 min
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REGULATORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'sec',
    name: 'SEC EDGAR',
    category: 'regulatory',
    description: 'Company filings, 10-K, 10-Q for public REITs',
    baseUrl: 'https://data.sec.gov',
    authType: 'none',
    rateLimit: { requests: 10, perSeconds: 1 },
    endpoints: [
      {
        id: 'filings',
        name: 'Company Filings',
        path: '/submissions/CIK{cik}.json',
        method: 'GET',
        description: 'Get all filings for a company',
        parameters: z.object({
          cik: z.string().describe('SEC CIK number'),
        }),
        refreshInterval: 86400,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SEARCH (for ad-hoc discovery)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'serper',
    name: 'Serper (Google Search API)',
    category: 'web',
    description: 'Google search results for ad-hoc queries',
    baseUrl: 'https://google.serper.dev',
    authType: 'api_key',
    authEnvVar: 'SERPER_API_KEY',
    rateLimit: { requests: 2500, perSeconds: 86400 },
    endpoints: [
      {
        id: 'search',
        name: 'Web Search',
        path: '/search',
        method: 'POST',
        description: 'Search the web',
        parameters: z.object({
          q: z.string().describe('Search query'),
          num: z.number().optional().default(10),
          gl: z.string().optional().default('us'),
        }),
        refreshInterval: 0, // No caching, always fresh
      },
      {
        id: 'news',
        name: 'News Search',
        path: '/news',
        method: 'POST',
        description: 'Search news articles',
        parameters: z.object({
          q: z.string(),
          num: z.number().optional().default(10),
        }),
        refreshInterval: 0,
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getDataSource(id: string): DataSource | undefined {
  return DATA_SOURCES.find(s => s.id === id);
}

export function getDataSourcesByCategory(category: DataSource['category']): DataSource[] {
  return DATA_SOURCES.filter(s => s.category === category);
}

export function getAllEndpoints(): { source: DataSource; endpoint: DataEndpoint }[] {
  return DATA_SOURCES.flatMap(source =>
    source.endpoints.map(endpoint => ({ source, endpoint }))
  );
}
