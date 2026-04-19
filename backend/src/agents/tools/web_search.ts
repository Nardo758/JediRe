/**
 * Tool: web_search
 *
 * Tavily-backed web search for Research, Commentary, and Zoning agents.
 * Always use structured data tools first — web_search is a fallback for
 * questions that structured sources cannot answer.
 *
 * Per-agent policy (from AGENT_SEARCH_CONFIG):
 *   research:  10 searches/run, broad access, 24h cache
 *   commentary: 5 searches/run, broad access, 24h cache
 *   zoning:    3 searches/run, gov-only allowlist, 7-day cache
 *   supply:    NOT AVAILABLE
 *   cashflow:  NOT AVAILABLE
 *
 * Required capability: web:search
 *
 * Graceful degradation:
 *   - TAVILY_API_KEY missing → returns { results: [], error: 'search_unavailable' }
 *   - Domain blocked for agent → returns { results: [], error: 'domain_blocked' }
 *   - Budget exceeded → throws BudgetExceededError (caught by AgentRuntime)
 *
 * Cache:
 *   - In-memory Map, keyed by `${agentId}:${normalizedQuery}`
 *   - TTL from AGENT_SEARCH_CONFIG[agentId].cacheHours
 *   - Cache survives the process lifetime (resets on restart, which is acceptable)
 */

import { z } from 'zod';
import { AGENT_SEARCH_CONFIG, isDomainAllowed } from '../config/search';
import { budgetEnforcer } from '../runtime/BudgetEnforcer';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

// ── Schemas ──────────────────────────────────────────────────────────────────

const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  published_date: z.string().nullable(),
});

const InputSchema = z.object({
  query: z.string().min(1).max(500).describe('Search query string'),
  max_results: z.number().int().min(1).max(10).optional().default(5),
});

const OutputSchema = z.object({
  results: z.array(SearchResultSchema),
  cached: z.boolean(),
  error: z.enum(['search_unavailable', 'domain_blocked', 'budget_exceeded']).optional(),
});

export type WebSearchInput = z.infer<typeof InputSchema>;
export type WebSearchOutput = z.infer<typeof OutputSchema>;

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  results: z.infer<typeof SearchResultSchema>[];
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function getCached(agentId: string, query: string): z.infer<typeof SearchResultSchema>[] | null {
  const key = `${agentId}:${normalizeQuery(query)}`;
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.results;
}

function setCache(
  agentId: string,
  query: string,
  results: z.infer<typeof SearchResultSchema>[],
  cacheHours: number
): void {
  const key = `${agentId}:${normalizeQuery(query)}`;
  _cache.set(key, {
    results,
    expiresAt: Date.now() + cacheHours * 60 * 60 * 1000,
  });
}

// ── Tool implementation ───────────────────────────────────────────────────────

export const webSearchTool: ToolDefinition<WebSearchInput, WebSearchOutput> = {
  name: 'web_search',
  description:
    'Search the web using Tavily. Use ONLY when structured data tools cannot answer the question. ' +
    'Every fact sourced from web search must be cited in the output citations array.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'web:search',

  execute: async (input, ctx): Promise<WebSearchOutput> => {
    const agentId = ctx.agentId ?? 'research';
    const config = AGENT_SEARCH_CONFIG[agentId];

    if (!config) {
      logger.warn(`web_search: agent ${agentId} does not have search access`);
      return { results: [], cached: false, error: 'search_unavailable' };
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      logger.warn('web_search: TAVILY_API_KEY not set — returning empty results');
      return { results: [], cached: false, error: 'search_unavailable' };
    }

    // Enforce per-run search cap via BudgetEnforcer
    if (ctx.correlationId) {
      await budgetEnforcer.checkSearchCap(agentId, ctx.correlationId);
    }

    // Check cache
    const cached = getCached(agentId, input.query);
    if (cached) {
      logger.debug('web_search: cache hit', { agentId, query: input.query });
      return { results: cached, cached: true };
    }

    // Build domain filter arrays for Tavily
    const includeDomains = config.allowlistDomains?.filter(d => !d.startsWith('*')) ?? undefined;
    const excludeDomains = config.blocklistDomains ?? undefined;

    let rawResults: Array<{ title: string; url: string; content: string; publishedDate?: string }>;

    try {
      // Dynamic import to avoid crashing the process on missing API key
      const { tavily } = await import('@tavily/core');
      const client = tavily({ apiKey });

      const response = await client.search(input.query, {
        maxResults: input.max_results ?? 5,
        ...(includeDomains && includeDomains.length > 0 ? { includeDomains } : {}),
        ...(excludeDomains && excludeDomains.length > 0 ? { excludeDomains } : {}),
      });

      rawResults = response.results ?? [];
    } catch (err) {
      logger.error('web_search: Tavily call failed', { agentId, query: input.query, err });
      return { results: [], cached: false, error: 'search_unavailable' };
    }

    // Post-filter by agent domain policy
    const filtered = rawResults
      .filter(r => isDomainAllowed(r.url, config))
      .map(r => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: (r.content ?? '').slice(0, 2000),
        published_date: r.publishedDate ?? null,
      }));

    setCache(agentId, input.query, filtered, config.cacheHours);

    logger.info('web_search: completed', {
      agentId,
      query: input.query,
      resultCount: filtered.length,
      cached: false,
    });

    return { results: filtered, cached: false };
  },
};
