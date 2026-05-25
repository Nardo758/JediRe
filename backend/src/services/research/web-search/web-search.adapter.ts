/**
 * Web Search Adapter — Phase 8 Research Agent Enrichment
 *
 * Uses Tavily (TAVILY_API_KEY) to run 4 targeted queries per property,
 * then generates a cited narrative via Claude.
 *
 * Requires: TAVILY_API_KEY (present) + Anthropic key (present).
 */

import { tavily } from '@tavily/core';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../../utils/logger';

// ── Output types ──────────────────────────────────────────────────────────────

export interface NewsArticle {
  title: string;
  url: string;
  summary: string;
  published_date: string | null;
}

export interface RecentEvent {
  title: string;
  date: string;
  type: 'renovation' | 'ownership_change' | 'capex' | 'news';
  summary: string;
  source_url: string;
}

export interface WebSearchResult {
  property_website: string | null;
  aggregator_urls: string[];
  news_articles: NewsArticle[];
  recent_events: RecentEvent[];
  citation_set: string[];
  narrative: string | null;
  narrative_citations: string[];
}

// ── Aggregator domains ────────────────────────────────────────────────────────

const AGGREGATOR_DOMAINS = [
  'apartmentratings.com', 'apartmentlist.com', 'apartments.com',
  'zillow.com', 'rent.com', 'rentcafe.com', 'realpage.com',
  'yelp.com', 'google.com/maps',
];

function isAggregator(url: string): boolean {
  return AGGREGATOR_DOMAINS.some(d => url.includes(d));
}

const EVENT_KEYWORDS = [
  'renovation', 'renovated', 'renovations', 'remodel',
  'ownership', 'acquired', 'acquisition', 'sold', 'purchased',
  'capex', 'capital improvement', 'upgrade', 'new management',
  'announced', 'announcement', 'opening', 'redevelopment',
];

function classifyEventType(title: string, content: string): RecentEvent['type'] {
  const text = (title + ' ' + content).toLowerCase();
  if (/renovati|remodel|upgrade|capital improvement/i.test(text)) return 'renovation';
  if (/acqui|ownership|sold|purchased|new management/i.test(text)) return 'ownership_change';
  if (/capex|capital expenditure/i.test(text)) return 'capex';
  return 'news';
}

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function isWithinTwoYears(dateStr: string | null): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && Date.now() - d.getTime() < TWO_YEARS_MS;
}

// ── Tavily search helper ──────────────────────────────────────────────────────

async function searchSerpApi(
  query: string,
  maxResults: number,
): Promise<Array<{ title: string; url: string; content: string; publishedDate?: string }>> {
  const serpKey = process.env.SERPAPI_KEY;
  if (!serpKey) return [];
  try {
    const url = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(query)}&num=${maxResults}&api_key=${serpKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json() as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
    };
    return (data.organic_results ?? []).slice(0, maxResults).map(r => ({
      title: r.title ?? '',
      url: r.link ?? '',
      content: (r.snippet ?? '').slice(0, 1500),
      publishedDate: r.date,
    }));
  } catch (err) {
    logger.warn('[web-search] SerpAPI fallback query failed', { query, err: (err as Error).message });
    return [];
  }
}

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults = 5,
): Promise<Array<{ title: string; url: string; content: string; publishedDate?: string }>> {
  try {
    const client = tavily({ apiKey });
    const resp = await client.search(query, { maxResults });
    const results = (resp.results ?? []).map(r => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: (r.content ?? '').slice(0, 1500),
      publishedDate: r.publishedDate,
    }));
    if (results.length > 0) return results;
    logger.info('[web-search] Tavily returned 0 results, trying SerpAPI fallback', { query });
    return searchSerpApi(query, maxResults);
  } catch (err) {
    const msg = (err as Error).message ?? '';
    logger.warn('[web-search] Tavily query failed, trying SerpAPI fallback', { query, err: msg });
    return searchSerpApi(query, maxResults);
  }
}

// ── Narrative generation via Claude ──────────────────────────────────────────

async function generateNarrative(opts: {
  propertyName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  placesRating: number | null;
  placesAmenityFlags: string[];
  articles: NewsArticle[];
  events: RecentEvent[];
  citations: string[];
}): Promise<{ text: string; citations: string[] }> {
  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  });

  const { propertyName, address, city, state, placesRating, placesAmenityFlags, articles, events, citations } = opts;

  const location = [address, city, state].filter(Boolean).join(', ');

  const sourceBlock = citations.slice(0, 10).map((url, i) => `[${i + 1}] ${url}`).join('\n');

  const articlesBlock = articles.slice(0, 5).map(a =>
    `Title: ${a.title}\nURL: ${a.url}\nSummary: ${a.summary}\nDate: ${a.published_date ?? 'unknown'}`
  ).join('\n\n');

  const eventsBlock = events.slice(0, 5).map(e =>
    `Event: ${e.title}\nType: ${e.type}\nDate: ${e.date}\nURL: ${e.source_url}`
  ).join('\n\n');

  const amenitiesLine = placesAmenityFlags.length > 0
    ? `Known amenities from Google Places: ${placesAmenityFlags.join(', ')}.`
    : '';

  const ratingLine = placesRating != null
    ? `Google Places rating: ${placesRating}/5.`
    : '';

  const systemPrompt = `You are a factual real estate analyst writing property profiles for institutional investors.
Write a 2-3 paragraph description (maximum 300 words) of the property.

STRICT RULES:
1. Every factual claim (number, date, name, statistic, event) MUST be followed immediately by [URL] citing the source.
2. Only cite URLs from the provided source list.
3. If you cannot support a claim with a provided URL, omit that claim entirely.
4. Do not use marketing language or superlatives.
5. Tone: factual, objective, analytical.
6. Do NOT invent any facts.
7. Format: plain text with inline [url] citations. No markdown.`;

  const userMessage = `Property: ${propertyName}
Location: ${location}
${ratingLine}
${amenitiesLine}

Source articles:
${articlesBlock || '(none found)'}

Recent events:
${eventsBlock || '(none found)'}

Available citation URLs:
${sourceBlock || '(none)'}

Write the property profile now. Cite every claim.`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: userMessage }],
    system: systemPrompt,
  });

  const content = msg.content[0];
  if (content.type !== 'text') return { text: '', citations: [] };

  const text = content.text.trim();

  const citedUrls = [...new Set(
    [...text.matchAll(/\[(https?:\/\/[^\]]+)\]/g)].map(m => m[1])
  )];

  const wordCount = text.split(/\s+/).length;
  if (wordCount > 320) {
    logger.warn('[web-search] Narrative exceeded 300 words', { wordCount, propertyName });
  }

  return { text, citations: citedUrls };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function enrichWithWebSearch(opts: {
  propertyName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  placesRating?: number | null;
  placesAmenityFlags?: string[];
}): Promise<WebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    logger.warn('[web-search] TAVILY_API_KEY not set — skipping web search enrichment');
    return {
      property_website: null,
      aggregator_urls: [],
      news_articles: [],
      recent_events: [],
      citation_set: [],
      narrative: null,
      narrative_citations: [],
    };
  }

  const { propertyName, address, city, state, placesRating, placesAmenityFlags } = opts;
  const loc = [city, state].filter(Boolean).join(', ');

  const queries = [
    `${propertyName} ${loc} apartments`,
    address ? `"${address}" apartment` : `${propertyName} ${loc} address`,
    `${propertyName} management ownership`,
    `${propertyName} news renovation announcement`,
  ];

  const allResults: Array<{ title: string; url: string; content: string; publishedDate?: string }> = [];

  await Promise.all(
    queries.map(async q => {
      const results = await searchTavily(q, apiKey, 5);
      allResults.push(...results);
    })
  );

  const seenUrls = new Set<string>();
  const uniqueResults = allResults.filter(r => {
    if (!r.url || seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  const citationSet = uniqueResults.map(r => r.url).filter(Boolean);

  let propertyWebsite: string | null = null;
  const aggregatorUrls: string[] = [];
  const newsArticles: NewsArticle[] = [];
  const recentEvents: RecentEvent[] = [];

  for (const r of uniqueResults) {
    const isAgg = isAggregator(r.url);
    const hasEventKeyword = EVENT_KEYWORDS.some(kw => (r.title + ' ' + r.content).toLowerCase().includes(kw));
    const withinTwoYears = isWithinTwoYears(r.publishedDate ?? null);

    if (!isAgg && !propertyWebsite && r.url.toLowerCase().includes(propertyName.toLowerCase().split(' ')[0] ?? '')) {
      propertyWebsite = r.url;
    }

    if (isAgg) {
      aggregatorUrls.push(r.url);
    } else if (hasEventKeyword && withinTwoYears) {
      recentEvents.push({
        title: r.title,
        date: r.publishedDate ?? new Date().toISOString().slice(0, 10),
        type: classifyEventType(r.title, r.content),
        summary: r.content.slice(0, 200),
        source_url: r.url,
      });
    } else if (withinTwoYears && r.title && r.content.length > 50) {
      newsArticles.push({
        title: r.title,
        url: r.url,
        summary: r.content.slice(0, 200),
        published_date: r.publishedDate ?? null,
      });
    }
  }

  let narrativeText: string | null = null;
  let narrativeCitations: string[] = [];

  if (citationSet.length > 0 || newsArticles.length > 0 || recentEvents.length > 0) {
    try {
      const { text, citations } = await generateNarrative({
        propertyName,
        address,
        city,
        state,
        placesRating: placesRating ?? null,
        placesAmenityFlags: placesAmenityFlags ?? [],
        articles: newsArticles,
        events: recentEvents,
        citations: citationSet,
      });
      narrativeText = text || null;
      narrativeCitations = citations;
    } catch (err) {
      logger.warn('[web-search] Narrative generation failed', { propertyName, err: (err as Error).message });
    }
  }

  return {
    property_website: propertyWebsite,
    aggregator_urls: aggregatorUrls.slice(0, 5),
    news_articles: newsArticles.slice(0, 10),
    recent_events: recentEvents.slice(0, 10),
    citation_set: citationSet,
    narrative: narrativeText,
    narrative_citations: narrativeCitations,
  };
}
