/**
 * Atlanta CRE News Ingestion — system batch job
 * Pulls from Bisnow Atlanta feed + GlobeSt + HousingWire RSS and stores in
 * news_article_cache (7-day expiry) for M35 event impact and agent context.
 * No credit metering — automated pipeline job.
 *
 * After each article is cached, extractAndPersistEvents() is called to extract
 * structured market_events via DeepSeek. Results are written to market_events
 * with source_type='news'. Extraction runs fire-and-forget so it never blocks
 * or fails the core ingestion flow.
 */

import { v4 as uuidv4 } from 'uuid';
import { query as dbQuery } from '../database/connection';
import { bisnowProvider } from '../services/news/providers/bisnow.provider';
import { globestProvider } from '../services/news/providers/globest.provider';
import { housingwireProvider } from '../services/news/providers/housingwire.provider';
import { extractAndPersistEvents } from '../services/market-event-extraction.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Atlanta-specific search queries — use single terms so the provider keyword
// filter doesn't require exact phrase match across title + description.
// Bisnow: the query 'atlanta' triggers the regional feed via FEEDS['atlanta'].
const PROVIDER_QUERIES: Record<string, string[]> = {
  bisnow: ['atlanta', 'multifamily', 'georgia'],
  globest: ['atlanta', 'multifamily', 'georgia'],
  housingwire: ['atlanta', 'multifamily'],
};

export interface AtlantaNewsIngestionResult {
  queried: number;
  inserted: number;
  skipped: number;
  errors: string[];
  events_inserted: number;
}

export async function ingestAtlantaNews(): Promise<AtlantaNewsIngestionResult> {
  const result: AtlantaNewsIngestionResult = {
    queried: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    events_inserted: 0,
  };

  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

  const providerMap = [
    { provider: bisnowProvider, queries: PROVIDER_QUERIES.bisnow },
    { provider: globestProvider, queries: PROVIDER_QUERIES.globest },
    { provider: housingwireProvider, queries: PROVIDER_QUERIES.housingwire },
  ];

  // Deduplicate across queries by URL to avoid duplicate inserts
  const seen = new Set<string>();
  // Track articles that were freshly inserted (vs. already cached) for extraction
  const toExtract: Array<{
    title: string;
    description: string | null;
    content: string | null;
    url: string;
    publishedAt: Date | null;
  }> = [];

  for (const { provider, queries } of providerMap) {
    for (const q of queries) {
      try {
        const searchResult = await provider.searchArticles({ query: q, pageSize: 20 });
        const articles = searchResult.articles ?? [];
        result.queried += articles.length;

        for (const article of articles) {
          if (!article.url || !article.title) { result.skipped++; continue; }
          if (seen.has(article.url)) { result.skipped++; continue; }
          seen.add(article.url);

          const articleId = article.id ?? article.url;
          const id = uuidv4();

          try {
            const insertResult = await dbQuery(`
              INSERT INTO news_article_cache (
                id, provider, article_id, title, description, content,
                url, image_url, published_at, source_id, source_name,
                author, category, tags, cached_at, expires_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15)
              ON CONFLICT (provider, article_id) DO NOTHING
              RETURNING id
            `, [
              id,
              provider.config.id,
              articleId,
              article.title,
              article.description ?? null,
              article.content ?? null,
              article.url,
              article.imageUrl ?? null,
              article.publishedAt ?? null,
              provider.config.id,
              provider.config.name,
              article.author ?? null,
              'real_estate',
              JSON.stringify(['atlanta', 'multifamily', 'georgia']),
              expiresAt,
            ]);

            if (insertResult.rows.length > 0) {
              // Freshly inserted — queue for event extraction
              result.inserted++;
              toExtract.push({
                title: article.title,
                description: article.description ?? null,
                content: article.content ?? null,
                url: article.url,
                publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
              });
            } else {
              result.skipped++;
            }
          } catch {
            result.skipped++;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${provider.config.id}/"${q}": ${msg}`);
      }
    }
  }

  // ── Fire market event extraction for each freshly-inserted article ─────────
  // Each call is awaited sequentially to avoid hammering the DeepSeek API.
  // If extraction fails for one article, it is silently logged and skipped.
  for (const article of toExtract) {
    try {
      const exResult = await extractAndPersistEvents(article);
      result.events_inserted += exResult.inserted;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Atlanta News] Event extraction failed for "${article.title}": ${msg}`);
    }
  }

  console.log(
    `[Atlanta News] Ingested ${result.inserted} articles, skipped ${result.skipped}, ` +
    `errors: ${result.errors.length}, events_inserted: ${result.events_inserted}`
  );
  return result;
}
