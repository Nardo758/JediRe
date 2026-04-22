/**
 * Discovery Skills
 * 
 * Skills that allow agents to search external data sources:
 * - Web search
 * - News search  
 * - Economic data lookup
 * - Market data lookup
 * 
 * @version 1.0.0
 * @date 2026-04-22
 */

import { z } from 'zod';
import { skillRegistry, SkillDefinition, SkillResult } from '../skill-registry';
import { discoveryEngine } from '../../discovery/discovery-engine';
import { logger } from '../../../utils/logger';

// ============================================================================
// WEB SEARCH SKILL
// ============================================================================

const webSearch: SkillDefinition = {
  id: 'web_search',
  name: 'Web Search',
  description: 'Search the web for any information. Use for ad-hoc queries, finding market reports, company info, etc.',
  category: 'data',
  parameters: z.object({
    query: z.string().describe('Search query'),
    type: z.enum(['web', 'news']).optional().describe('Search type: web for general, news for recent articles'),
    maxResults: z.number().optional().default(5),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { query, type = 'web', maxResults = 5 } = params;

    try {
      const results = await discoveryEngine.webSearch(query, type);
      
      return {
        success: true,
        data: {
          query,
          type,
          results: results.slice(0, maxResults).map((r: any) => ({
            title: r.title || r.Text,
            link: r.link || r.FirstURL,
            snippet: r.snippet || r.Text,
          })),
          totalFound: results.length,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// NEWS SEARCH SKILL
// ============================================================================

const searchNews: SkillDefinition = {
  id: 'search_news',
  name: 'Search News',
  description: 'Search for recent news articles on any topic. Good for market updates, company news, economic reports.',
  category: 'data',
  parameters: z.object({
    topics: z.array(z.string()).describe('Topics to search for'),
    daysBack: z.number().optional().default(7),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { topics, daysBack = 7 } = params;

    try {
      const news = await discoveryEngine.discoverNews(topics);

      // Filter to requested time range
      const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const filtered = news.filter(n => n.publishedAt >= cutoff);

      return {
        success: true,
        data: {
          topics,
          articles: filtered.slice(0, 10).map(n => ({
            headline: n.headline,
            source: n.source,
            publishedAt: n.publishedAt.toISOString(),
            url: n.url,
            summary: n.summary,
          })),
          totalFound: filtered.length,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// INTEREST RATES SKILL
// ============================================================================

const getInterestRates: SkillDefinition = {
  id: 'get_interest_rates',
  name: 'Get Interest Rates',
  description: 'Get current interest rates: Fed Funds, SOFR, Treasury yields, mortgage rates.',
  category: 'data',
  parameters: z.object({
    rates: z.array(z.enum(['fed_funds', 'sofr', 'treasury_10y', 'mortgage_30y', 'all'])).optional().default(['all']),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    try {
      const rates = await discoveryEngine.discoverInterestRates();

      return {
        success: true,
        data: {
          asOf: new Date().toISOString(),
          rates: {
            fedFunds: rates.fedFunds,
            sofr: rates.sofr,
            treasury10Y: rates.treasury10,
            mortgage30Y: rates.mortgage30,
          },
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REIT PRICES SKILL
// ============================================================================

const getREITPrices: SkillDefinition = {
  id: 'get_reit_prices',
  name: 'Get REIT Prices',
  description: 'Get current stock prices for apartment REITs (AVB, EQR, MAA, UDR, CPT, etc.)',
  category: 'data',
  parameters: z.object({
    symbols: z.array(z.string()).optional().default(['AVB', 'EQR', 'MAA', 'UDR', 'CPT']),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { symbols } = params;

    try {
      const prices = await discoveryEngine.discoverREITPrices(symbols);

      return {
        success: true,
        data: {
          asOf: new Date().toISOString(),
          prices,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// DEAL NEWS SKILL
// ============================================================================

const getDealNews: SkillDefinition = {
  id: 'get_deal_news',
  name: 'Get Deal-Relevant News',
  description: 'Search for news specifically relevant to the current deal\'s market and location.',
  category: 'data',
  parameters: z.object({
    includeMarket: z.boolean().optional().default(true),
    includeCompetitors: z.boolean().optional().default(false),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { dealId } = context;
    const { includeMarket = true, includeCompetitors = false } = params;

    if (!dealId) {
      return { success: false, error: 'No deal context provided' };
    }

    try {
      const news = await discoveryEngine.discoverDealNews(dealId);

      return {
        success: true,
        data: {
          dealId,
          articles: news.slice(0, 10).map(n => ({
            headline: n.headline,
            source: n.source,
            publishedAt: n.publishedAt.toISOString(),
            url: n.url,
            summary: n.summary,
          })),
          totalFound: news.length,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// MARKET RESEARCH SKILL
// ============================================================================

const researchMarket: SkillDefinition = {
  id: 'research_market',
  name: 'Research Market',
  description: 'Comprehensive market research: search for reports, news, data on a specific market.',
  category: 'analysis',
  parameters: z.object({
    market: z.string().describe('Market name (city or MSA)'),
    focus: z.array(z.enum(['supply', 'demand', 'rents', 'employment', 'demographics', 'all'])).optional().default(['all']),
  }),
  execute: async (params, context): Promise<SkillResult> => {
    const { market, focus = ['all'] } = params;

    try {
      const results: Record<string, any> = {};

      // News search
      const newsTopics = [
        `${market} multifamily market`,
        `${market} apartment rents`,
        `${market} real estate development`,
      ];
      results.news = await discoveryEngine.discoverNews(newsTopics);

      // Web search for market reports
      const webResults = await discoveryEngine.webSearch(`${market} multifamily market report 2026`, 'web');
      results.reports = webResults.slice(0, 5);

      // If we have employment focus, try to get that data
      if (focus.includes('all') || focus.includes('employment')) {
        // Would need MSA code lookup here
        results.employmentNote = 'Employment data available via MSA code lookup';
      }

      return {
        success: true,
        data: {
          market,
          focus,
          news: results.news?.slice(0, 5).map((n: any) => ({
            headline: n.headline,
            source: n.source,
            url: n.url,
          })),
          reports: results.reports?.map((r: any) => ({
            title: r.title,
            link: r.link,
            snippet: r.snippet,
          })),
          summary: `Found ${results.news?.length || 0} news articles and ${results.reports?.length || 0} potential reports for ${market}`,
        },
        displayType: 'json',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REGISTER DISCOVERY SKILLS
// ============================================================================

export function registerDiscoverySkills(): void {
  skillRegistry.register(webSearch);
  skillRegistry.register(searchNews);
  skillRegistry.register(getInterestRates);
  skillRegistry.register(getREITPrices);
  skillRegistry.register(getDealNews);
  skillRegistry.register(researchMarket);

  logger.info('Registered 6 discovery skills');
}
