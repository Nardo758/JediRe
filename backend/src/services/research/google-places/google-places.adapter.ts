/**
 * Google Places Adapter — Phase 8 Research Agent Enrichment
 *
 * Calls the Places API (New) v1 to fetch:
 *   - Place identification + metadata
 *   - Amenity type signals → maps to has_pool/has_fitness/etc. boolean flags
 *   - Up to 5 reviews with structured NLP extraction
 *   - Up to 5 photo references
 *   - Aggregated sentiment summary
 *
 * Requires: GOOGLE_PLACES_API_KEY environment variable.
 * If absent at call time: throws PlacesKeyMissingError.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../../utils/logger';

const PLACES_BASE = 'https://places.googleapis.com/v1';

// ── Public error types ────────────────────────────────────────────────────────

export class PlacesKeyMissingError extends Error {
  constructor() {
    super('GOOGLE_PLACES_API_KEY is not configured');
    this.name = 'PlacesKeyMissingError';
  }
}

export class PlacesQuotaError extends Error {
  constructor() {
    super('Google Places API quota exceeded');
    this.name = 'PlacesQuotaError';
  }
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface ExtractedReview {
  author: string;
  rating: number;
  text: string;
  publishTime: string;
  sentiment_score: number;
  named_entities: string[];
  hazard_mentions: string[];
  amenity_mentions: string[];
}

export interface SentimentSummary {
  overall_score: number;
  rating: number | null;
  total_ratings: number | null;
  hazard_flags: string[];
  amenity_gaps: string[];
  recency_weight: boolean;
}

export interface PhotoRef {
  photo_name: string;
  proxy_url: string;
  attribution: string | null;
  width_px: number | null;
  height_px: number | null;
}

export interface AmenityFlags {
  has_pool?: true;
  has_fitness?: true;
  has_dog_park?: true;
  has_business_center?: true;
  has_clubhouse?: true;
  has_concierge?: true;
}

export interface PlacesEnrichmentResult {
  status: 'ok' | 'no_match' | 'partial' | 'error';
  place_id: string | null;
  amenity_flags: AmenityFlags;
  reviews: ExtractedReview[];
  photos: PhotoRef[];
  sentiment_summary: SentimentSummary | null;
  detail: Record<string, unknown>;
}

// ── Types → amenity flag mapping ──────────────────────────────────────────────

const PLACES_TYPE_TO_FLAG: Record<string, keyof AmenityFlags> = {
  swimming_pool:    'has_pool',
  gym:              'has_fitness',
  fitness_center:   'has_fitness',
  dog_park:         'has_dog_park',
  pet_store:        'has_dog_park',
  business_center:  'has_business_center',
  coworking_space:  'has_business_center',
  community_center: 'has_clubhouse',
  banquet_hall:     'has_clubhouse',
  concierge:        'has_concierge',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesKeyMissingError();
  return key;
}

async function placesPost(path: string, body: unknown, apiKey: string): Promise<unknown> {
  const res = await fetch(`${PLACES_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new PlacesQuotaError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Places API POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function placesGet(path: string, fieldMask: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${PLACES_BASE}${path}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
  });
  if (res.status === 429) throw new PlacesQuotaError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Places API GET ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function extractAmenityFlags(types: string[]): AmenityFlags {
  const flags: AmenityFlags = {};
  for (const t of types) {
    const flag = PLACES_TYPE_TO_FLAG[t.toLowerCase()];
    if (flag) flags[flag] = true;
  }
  return flags;
}

function weightedSentimentScore(reviews: ExtractedReview[]): number {
  if (reviews.length === 0) return 0;
  const now = Date.now();
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of reviews) {
    const ageMs = now - new Date(r.publishTime).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const weight = Math.max(0.2, 1 - ageDays / 730);
    weightedSum += r.sentiment_score * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) / 100 : 0;
}

function deduplicateHazards(reviews: ExtractedReview[]): string[] {
  const counts: Record<string, number> = {};
  for (const r of reviews) {
    for (const h of r.hazard_mentions) {
      counts[h] = (counts[h] ?? 0) + 1;
    }
  }
  return Object.entries(counts).filter(([, cnt]) => cnt >= 2).map(([h]) => h);
}

function extractAmenityGaps(reviews: ExtractedReview[]): string[] {
  const gapKeywords = ['no pool', 'no gym', 'no fitness', 'no dog park', 'no parking',
                       'needs a', 'wish there was', 'would be nice', 'lack of'];
  const gaps = new Set<string>();
  for (const r of reviews) {
    const lower = r.text.toLowerCase();
    for (const kw of gapKeywords) {
      if (lower.includes(kw)) gaps.add(kw);
    }
  }
  return [...gaps];
}

// ── NLP pass via Claude ───────────────────────────────────────────────────────

async function runNlpPassOnReviews(
  rawReviews: Array<{ author: string; rating: number; text: string; publishTime: string }>,
): Promise<ExtractedReview[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `You are a structured data extractor for real estate analysis.
For each review below, extract:
- sentiment_score: number from -1.0 (very negative) to +1.0 (very positive)
- named_entities: array of specific named landmarks, amenities, or businesses mentioned
- hazard_mentions: array of hazard categories mentioned (from: crime, noise, pests, parking, management, maintenance, flooding, safety)
- amenity_mentions: array of specific amenities mentioned positively (pool, gym, dog park, etc.)

Return ONLY a JSON array with one object per review in the same order.
Format: [{ "sentiment_score": 0.8, "named_entities": [], "hazard_mentions": [], "amenity_mentions": [] }, ...]

Reviews:
${rawReviews.map((r, i) => `[${i}] Rating: ${r.rating}/5\n${r.text}`).join('\n\n---\n\n')}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = msg.content[0];
  if (content.type !== 'text') throw new Error('NLP pass: unexpected response type');

  const text = content.text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('NLP pass: no JSON array in response');

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    sentiment_score: number;
    named_entities: string[];
    hazard_mentions: string[];
    amenity_mentions: string[];
  }>;

  return rawReviews.map((r, i) => ({
    ...r,
    sentiment_score: parsed[i]?.sentiment_score ?? 0,
    named_entities: parsed[i]?.named_entities ?? [],
    hazard_mentions: parsed[i]?.hazard_mentions ?? [],
    amenity_mentions: parsed[i]?.amenity_mentions ?? [],
  }));
}

// ── Exponential backoff retry ─────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof PlacesKeyMissingError) throw err;
      if (err instanceof PlacesQuotaError) {
        if (attempt >= maxAttempts) throw err;
        const backoffMs = Math.pow(2, attempt) * 5000;
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  throw lastErr;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function enrichWithGooglePlaces(opts: {
  propertyName: string;
  address: string | null;
  city: string | null;
  state: string | null;
}): Promise<PlacesEnrichmentResult> {
  const apiKey = getApiKey();
  const { propertyName, address, city, state } = opts;

  const query = [propertyName, address, city, state].filter(Boolean).join(' ');

  let placeId: string | null = null;

  try {
    const searchResp = await withRetry(() =>
      placesPost('/places:searchText', {
        textQuery: query,
        maxResultCount: 1,
        rankPreference: 'RELEVANCE',
      }, apiKey)
    ) as { places?: Array<{ id?: string; name?: string }> };

    const firstPlace = searchResp.places?.[0];
    if (!firstPlace?.id) {
      return {
        status: 'no_match',
        place_id: null,
        amenity_flags: {},
        reviews: [],
        photos: [],
        sentiment_summary: null,
        detail: { query, note: 'No Places match found' },
      };
    }
    placeId = firstPlace.id;
  } catch (err) {
    if (err instanceof PlacesQuotaError || err instanceof PlacesKeyMissingError) throw err;
    logger.error('[google-places] Find Place failed', { query, err });
    return {
      status: 'error',
      place_id: null,
      amenity_flags: {},
      reviews: [],
      photos: [],
      sentiment_summary: null,
      detail: { error: (err as Error).message, step: 'find_place' },
    };
  }

  const fieldMask = [
    'id', 'displayName', 'types', 'rating', 'userRatingCount',
    'businessStatus', 'websiteUri', 'reviews', 'photos',
  ].join(',');

  let details: Record<string, unknown> = {};
  let partialReason: string | null = null;

  try {
    details = await withRetry(() =>
      placesGet(`/places/${placeId}`, fieldMask, apiKey)
    ) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof PlacesQuotaError || err instanceof PlacesKeyMissingError) throw err;
    logger.error('[google-places] Place Details failed', { placeId, err });
    partialReason = `place_details_failed: ${(err as Error).message}`;
  }

  const types = (details.types as string[] | undefined) ?? [];
  const amenityFlags = extractAmenityFlags(types);

  const rawReviews = ((details.reviews as Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    publishTime?: string;
  }> | undefined) ?? []).slice(0, 5).map(r => ({
    author: r.authorAttribution?.displayName ?? 'Anonymous',
    rating: r.rating ?? 3,
    text: r.text?.text ?? '',
    publishTime: r.publishTime ?? new Date().toISOString(),
  })).filter(r => r.text.length > 0);

  let enrichedReviews: ExtractedReview[] = rawReviews.map(r => ({
    ...r,
    sentiment_score: (r.rating - 3) / 2,
    named_entities: [],
    hazard_mentions: [],
    amenity_mentions: [],
  }));

  if (rawReviews.length > 0) {
    try {
      enrichedReviews = await runNlpPassOnReviews(rawReviews);
    } catch (nlpErr) {
      logger.warn('[google-places] NLP pass failed — using simple sentiment', { err: nlpErr });
    }
  }

  const rawPhotos = ((details.photos as Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string }>;
  }> | undefined) ?? []).slice(0, 5);

  const photos: PhotoRef[] = rawPhotos
    .filter(p => !!p.name)
    .map(p => ({
      photo_name: p.name!,
      proxy_url: `/api/v1/properties/places-photo?name=${encodeURIComponent(p.name!)}`,
      attribution: p.authorAttributions?.[0]?.displayName ?? null,
      width_px: p.widthPx ?? null,
      height_px: p.heightPx ?? null,
    }));

  const overallScore = weightedSentimentScore(enrichedReviews);
  const hazardFlags = deduplicateHazards(enrichedReviews);
  const amenityGaps = extractAmenityGaps(enrichedReviews);

  const sentimentSummary: SentimentSummary = {
    overall_score: overallScore,
    rating: (details.rating as number | undefined) ?? null,
    total_ratings: (details.userRatingCount as number | undefined) ?? null,
    hazard_flags: hazardFlags,
    amenity_gaps: amenityGaps,
    recency_weight: true,
  };

  return {
    status: partialReason ? 'partial' : 'ok',
    place_id: placeId,
    amenity_flags: amenityFlags,
    reviews: enrichedReviews,
    photos,
    sentiment_summary: sentimentSummary,
    detail: {
      place_id: placeId,
      reviews_count: enrichedReviews.length,
      photos_count: photos.length,
      amenity_flags_set: Object.keys(amenityFlags),
      types_found: types.slice(0, 10),
      ...(partialReason ? { partial_reason: partialReason } : {}),
    },
  };
}
