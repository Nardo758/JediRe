/**
 * Agent Search Configuration
 *
 * Defines per-agent Tavily web search policy:
 *   - maxSearchesPerRun: hard cap enforced by BudgetEnforcer.checkSearchCap()
 *   - allowlistDomains:  if non-null, only results from these domains are returned
 *   - blocklistDomains:  if non-null, results from these domains are stripped
 *   - cacheHours:        24h for most agents; 168h (7 days) for Zoning because
 *                        municipal zoning codes change slowly
 *
 * null config means the agent does NOT have web search access.
 * Supply and CashFlow agents must use structured data tools only.
 *
 * Domain patterns support:
 *   - Exact hostname:    'municode.com'
 *   - Wildcard prefix:   '*.gov' (matches any .gov TLD)
 *   - Subdomain match:   '.state.fl.us' (matches any subdomain)
 */

import type { AgentId } from '../runtime/types';

export interface SearchConfig {
  maxSearchesPerRun: number;
  allowlistDomains: string[] | null;
  blocklistDomains: string[] | null;
  cacheHours: number;
}

export const AGENT_SEARCH_CONFIG: Record<AgentId, SearchConfig | null> = {
  research: {
    maxSearchesPerRun: 10,
    allowlistDomains: null,
    blocklistDomains: [
      'reddit.com',
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'tiktok.com',
      'pinterest.com',
      'quora.com',
      'yahoo.answers.com',
    ],
    cacheHours: 24,
  },

  commentary: {
    maxSearchesPerRun: 5,
    allowlistDomains: null,
    blocklistDomains: [
      'reddit.com',
      'twitter.com',
      'x.com',
      'facebook.com',
      'instagram.com',
      'tiktok.com',
      'pinterest.com',
    ],
    cacheHours: 24,
  },

  zoning: {
    maxSearchesPerRun: 3,
    allowlistDomains: [
      '*.gov',
      'municode.com',
      'ecode360.com',
      'generalcode.com',
      'cityofmiami.gov',
      'austintexas.gov',
      'atlantaga.gov',
      'dallascityhall.com',
      'houstontx.gov',
      '*.state.fl.us',
      '*.state.tx.us',
      '*.state.ga.us',
    ],
    blocklistDomains: null,
    cacheHours: 168,
  },

  supply: null,

  cashflow: null,
};

/**
 * Returns true if the given URL is allowed for the agent's search config.
 * Always returns true when allowlist is null (broad access).
 * Returns false if the domain is in the blocklist.
 */
export function isDomainAllowed(url: string, config: SearchConfig): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  if (config.blocklistDomains) {
    for (const blocked of config.blocklistDomains) {
      if (matchesDomain(hostname, blocked)) return false;
    }
  }

  if (!config.allowlistDomains) return true;

  for (const allowed of config.allowlistDomains) {
    if (matchesDomain(hostname, allowed)) return true;
  }

  return false;
}

function matchesDomain(hostname: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  if (p.startsWith('*.')) {
    const suffix = p.slice(2);
    return hostname === suffix || hostname.endsWith('.' + suffix);
  }
  if (p.startsWith('.')) {
    return hostname === p.slice(1) || hostname.endsWith(p);
  }
  return hostname === p || hostname.endsWith('.' + p);
}
