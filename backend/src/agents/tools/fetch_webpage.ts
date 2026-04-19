/**
 * Tool: fetch_webpage
 *
 * Fetches a single URL and returns clean main-content text.
 * Available to Research and Commentary agents (not Zoning — gov sites are
 * handled via fetch_municode and fetch_zoning_code).
 *
 * Behavior:
 *   - 10-second fetch timeout
 *   - Strips scripts, styles, nav, header, footer, sidebar boilerplate via cheerio
 *   - Returns up to 15,000 characters of clean text
 *   - Respects the calling agent's domain allowlist/blocklist
 *
 * Required capability: web:search
 *
 * Returns { title, content_text, retrieved_at } on success.
 * Returns { title: '', content_text: '', retrieved_at, error } on failure.
 */

import { z } from 'zod';
import * as cheerio from 'cheerio';
import { AGENT_SEARCH_CONFIG, isDomainAllowed } from '../config/search';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

// ── Schemas ──────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  url: z.string().url().describe('URL to fetch and extract text from'),
});

const OutputSchema = z.object({
  title: z.string(),
  content_text: z.string(),
  retrieved_at: z.string(),
  error: z.string().optional(),
});

export type FetchWebpageInput = z.infer<typeof InputSchema>;
export type FetchWebpageOutput = z.infer<typeof OutputSchema>;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 15_000;

// ── Tool implementation ───────────────────────────────────────────────────────

export const fetchWebpageTool: ToolDefinition<FetchWebpageInput, FetchWebpageOutput> = {
  name: 'fetch_webpage',
  description:
    'Fetch a URL and return clean main-content text (scripts, styles, and nav stripped). ' +
    'Use after web_search to get full content of a relevant result. ' +
    'Respects the agent domain allowlist.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'web:search',

  execute: async (input, ctx): Promise<FetchWebpageOutput> => {
    const agentId = ctx.agentId ?? 'research';
    const retrievedAt = new Date().toISOString();
    const config = AGENT_SEARCH_CONFIG[agentId];

    if (!config) {
      return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'agent_not_permitted' };
    }

    if (!isDomainAllowed(input.url, config)) {
      logger.warn('fetch_webpage: domain blocked for agent', { agentId, url: input.url });
      return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'domain_blocked' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(input.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'JediRE-ResearchAgent/1.0 (commercial real estate intelligence)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        logger.warn('fetch_webpage: HTTP error', { url: input.url, status: response.status });
        return {
          title: '',
          content_text: '',
          retrieved_at: retrievedAt,
          error: `http_${response.status}`,
        };
      }

      const html = await response.text();
      const { title, text } = extractContent(html);

      logger.debug('fetch_webpage: success', { url: input.url, chars: text.length });

      return {
        title,
        content_text: text.slice(0, MAX_CONTENT_CHARS),
        retrieved_at: retrievedAt,
      };
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      logger.warn('fetch_webpage: fetch failed', { url: input.url, error: isAbort ? 'timeout' : String(err) });
      return {
        title: '',
        content_text: '',
        retrieved_at: retrievedAt,
        error: isAbort ? 'timeout' : 'fetch_error',
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};

// ── Content extraction ────────────────────────────────────────────────────────

function extractContent(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim();

  // Remove boilerplate elements
  $(
    'script, style, noscript, ' +
    'nav, header, footer, aside, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
    '[class*="nav"], [class*="menu"], [class*="sidebar"], [class*="footer"], ' +
    '[class*="header"], [class*="cookie"], [class*="popup"], [class*="modal"], ' +
    '[id*="nav"], [id*="menu"], [id*="sidebar"], [id*="footer"], [id*="header"]'
  ).remove();

  // Prefer semantic content elements
  const mainEl = $('main, article, [role="main"], #main, #content, .content, .article').first();
  const source = mainEl.length ? mainEl : $('body');

  const text = source
    .text()
    .replace(/[\t ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, text };
}
