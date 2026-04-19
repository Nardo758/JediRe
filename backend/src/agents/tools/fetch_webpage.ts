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
 *   - SSRF-safe: resolves hostname to IP and blocks RFC1918/loopback/link-local ranges
 *
 * Required capability: web:search
 *
 * Returns { title, content_text, retrieved_at } on success.
 * Returns { title: '', content_text: '', retrieved_at, error } on failure.
 */

import { z } from 'zod';
import * as cheerio from 'cheerio';
import * as dns from 'dns/promises';
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

// ── SSRF protection ───────────────────────────────────────────────────────────

/**
 * Returns true if the IP is in a private/loopback/link-local range that
 * should never be reachable from a production web service.
 * Blocks IPv4: 127.x, 10.x, 172.16–31.x, 192.168.x, 169.254.x, 0.0.0.0
 * Blocks IPv6: ::1, fc00::/7 (ULA), fe80::/10 (link-local)
 */
function isPrivateIP(ip: string): boolean {
  // IPv6 loopback and ULA/link-local
  if (ip === '::1') return true;
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true; // fe80-febf link-local
  if (/^fc[0-9a-f]{2}:/i.test(ip) || /^fd[0-9a-f]{2}:/i.test(ip)) return true; // fc00/fd00 ULA

  // IPv4
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  if (a === 0) return true;                           // 0.0.0.0/8
  if (a === 127) return true;                         // 127.0.0.0/8 loopback
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local (IMDS)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

/**
 * Resolves the hostname in a URL to an IP and returns true if it resolves
 * to a private/loopback address (SSRF attempt) or cannot be resolved.
 */
async function isSSRFTarget(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return true; // malformed URL — block
  }

  // Reject plain-IP literals in the URL that map to private ranges
  if (isPrivateIP(hostname)) return true;

  // Block well-known internal hostnames regardless of DNS
  const lc = hostname.toLowerCase();
  if (lc === 'localhost' || lc.endsWith('.local') || lc.endsWith('.internal')) {
    return true;
  }

  try {
    const { address } = await dns.lookup(hostname, { family: 4 });
    if (isPrivateIP(address)) return true;
  } catch {
    // DNS failure — block to be safe
    return true;
  }

  return false;
}

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

    // Enforce https/http only — block file://, ftp://, etc.
    const scheme = (() => { try { return new URL(input.url).protocol; } catch { return ''; } })();
    if (scheme !== 'https:' && scheme !== 'http:') {
      logger.warn('fetch_webpage: non-http(s) scheme blocked', { agentId, url: input.url });
      return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'scheme_not_allowed' };
    }

    // Domain allowlist/blocklist check
    if (!isDomainAllowed(input.url, config)) {
      logger.warn('fetch_webpage: domain blocked for agent', { agentId, url: input.url });
      return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'domain_blocked' };
    }

    // SSRF protection: resolve hostname and block private/internal IPs
    if (await isSSRFTarget(input.url)) {
      logger.warn('fetch_webpage: SSRF target blocked', { agentId, url: input.url });
      return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'ssrf_blocked' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetchWithRedirectValidation(
        input.url,
        controller.signal,
        config,
      );

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
      if (err instanceof SSRFRedirectError) {
        logger.warn('fetch_webpage: SSRF redirect blocked', { url: input.url, redirectTarget: err.target });
        return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'ssrf_blocked' };
      }
      if (err instanceof DomainRedirectError) {
        logger.warn('fetch_webpage: domain-blocked redirect', { url: input.url, redirectTarget: err.target });
        return { title: '', content_text: '', retrieved_at: retrievedAt, error: 'domain_blocked' };
      }
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

// ── Redirect-safe fetch ───────────────────────────────────────────────────────

const MAX_REDIRECTS = 5;

class SSRFRedirectError extends Error {
  target: string;
  constructor(target: string) {
    super(`SSRF redirect blocked: ${target}`);
    this.target = target;
  }
}

class DomainRedirectError extends Error {
  target: string;
  constructor(target: string) {
    super(`Domain-blocked redirect: ${target}`);
    this.target = target;
  }
}

/**
 * Fetches a URL with manual redirect handling. Each redirect target is validated
 * against the same SSRF + scheme + domain-policy checks as the original URL,
 * preventing server-side request forgery via redirect chains.
 */
async function fetchWithRedirectValidation(
  url: string,
  signal: AbortSignal,
  config: import('../config/search').SearchConfig,
  hopCount = 0,
): Promise<Response> {
  if (hopCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
  }

  const response = await fetch(url, {
    signal,
    redirect: 'manual',
    headers: {
      'User-Agent': 'JediRE-ResearchAgent/1.0 (commercial real estate intelligence)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  // Handle 3xx redirects manually so we can re-validate each hop
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`Redirect ${response.status} with no Location header`);
    }

    // Resolve relative redirects against the current URL
    const nextUrl = new URL(location, url).toString();

    // Enforce https/http on redirect target
    const scheme = new URL(nextUrl).protocol;
    if (scheme !== 'https:' && scheme !== 'http:') {
      throw new SSRFRedirectError(nextUrl);
    }

    // Domain policy re-check on redirect target
    if (!isDomainAllowed(nextUrl, config)) {
      throw new DomainRedirectError(nextUrl);
    }

    // SSRF re-check on redirect target
    if (await isSSRFTarget(nextUrl)) {
      throw new SSRFRedirectError(nextUrl);
    }

    return fetchWithRedirectValidation(nextUrl, signal, config, hopCount + 1);
  }

  return response;
}

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
