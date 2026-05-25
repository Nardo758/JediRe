/**
 * Research Enrichment Service — Phase 8
 *
 * Orchestrates Google Places + web search enrichment for a single property,
 * then writes the results to property_descriptions using LayeredValue shape.
 *
 * Used by:
 *   - POST /api/v1/properties/by-parcel/:parcelId/enrich (on-demand via modal)
 *   - Intake orchestrator worker.ts (via stepWebSearch / stepGooglePlaces)
 *   - Phase 8 backfill script
 */

import { query as dbQuery } from '../../database/connection';
import { logger } from '../../utils/logger';
import { enrichWithGooglePlaces, PlacesKeyMissingError, PlacesQuotaError } from './google-places/google-places.adapter';
import { enrichWithWebSearch } from './web-search/web-search.adapter';
// ── Types ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  step: string;
  status: 'ok' | 'not_implemented' | 'blocked' | 'error';
  ts: string;
  detail?: Record<string, unknown>;
}

// ── LayeredValue helper ───────────────────────────────────────────────────────

/**
 * Creates a staging LayeredValue that writes ONLY to layers.pending_web.
 * The `resolved` field is intentionally omitted — pending data does not
 * affect the resolved value until the user clicks Apply.
 */
function pendingLayeredValue<T>(value: T, source: string): string {
  const ts = new Date().toISOString();
  return JSON.stringify({
    layers: { pending_web: { value, ts, source } },
  });
}

// ── Result shape ──────────────────────────────────────────────────────────────

export interface ResearchEnrichmentResult {
  parcel_id: string;
  places_status: 'ok' | 'no_match' | 'partial' | 'error' | 'skipped';
  web_status: 'ok' | 'error' | 'skipped';
  fields_written: string[];
  reviews_count: number;
  photos_count: number;
  narrative_words: number;
  place_id: string | null;
  log_entries: LogEntry[];
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runResearchEnrichment(opts: {
  parcelId: string;
  propertyName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  skipPlaces?: boolean;
}): Promise<ResearchEnrichmentResult> {
  const { parcelId, propertyName, address, city, state, skipPlaces = false } = opts;
  const logEntries: LogEntry[] = [];
  const fieldsWritten: string[] = [];
  const now = () => new Date().toISOString();

  // ── Step 1: Google Places ────────────────────────────────────────────────────

  let placesResult: Awaited<ReturnType<typeof enrichWithGooglePlaces>> | null = null;
  let placesStatus: ResearchEnrichmentResult['places_status'] = 'skipped';

  if (skipPlaces) {
    logEntries.push({
      step: 'google_places',
      status: 'not_implemented',
      ts: now(),
      detail: { note: 'skipped by --skip-places flag' },
    });
  } else if (!process.env.GOOGLE_PLACES_API_KEY) {
    logger.warn('[research-enrichment] GOOGLE_PLACES_API_KEY missing — skipping Places step', { parcelId });
    logEntries.push({
      step: 'google_places',
      status: 'not_implemented',
      ts: now(),
      detail: { note: 'GOOGLE_PLACES_API_KEY not configured — Places enrichment skipped' },
    });
  } else {
    try {
      placesResult = await enrichWithGooglePlaces({ propertyName, address, city, state });
      placesStatus = placesResult.status;
      logEntries.push({
        step: 'google_places',
        status: placesResult.status === 'error' ? 'error' : 'ok',
        ts: now(),
        detail: placesResult.detail,
      });
    } catch (err) {
      if (err instanceof PlacesKeyMissingError || err instanceof PlacesQuotaError) throw err;
      logger.error('[research-enrichment] Google Places failed', { parcelId, err });
      placesStatus = 'error';
      logEntries.push({
        step: 'google_places',
        status: 'error',
        ts: now(),
        detail: { error: (err as Error).message },
      });
    }
  }

  // ── Step 2: Web Search ───────────────────────────────────────────────────────

  let webResult: Awaited<ReturnType<typeof enrichWithWebSearch>> | null = null;
  let webStatus: ResearchEnrichmentResult['web_status'] = 'skipped';

  try {
    webResult = await enrichWithWebSearch({
      propertyName,
      address,
      city,
      state,
      placesRating: placesResult?.sentiment_summary?.rating ?? null,
      placesAmenityFlags: Object.keys(placesResult?.amenity_flags ?? {}),
    });
    webStatus = 'ok';
    logEntries.push({
      step: 'web_search',
      status: 'ok',
      ts: now(),
      detail: {
        queries_run: 4,
        articles_found: webResult.news_articles.length,
        events_found: webResult.recent_events.length,
        narrative_words: webResult.narrative ? webResult.narrative.split(/\s+/).length : 0,
        citations: webResult.narrative_citations.length,
      },
    });
  } catch (err) {
    logger.error('[research-enrichment] Web search failed', { parcelId, err });
    webStatus = 'error';
    logEntries.push({
      step: 'web_search',
      status: 'error',
      ts: now(),
      detail: { error: (err as Error).message },
    });
  }

  // ── Step 3: Write to property_descriptions ────────────────────────────────────

  const updates: Record<string, unknown> = {};

  if (webResult?.narrative) {
    updates.narrative = pendingLayeredValue(webResult.narrative, 'web:search_synthesis');
    fieldsWritten.push('narrative');
  }

  if (placesResult && placesResult.reviews.length > 0) {
    updates.reviews = pendingLayeredValue(placesResult.reviews, 'web:google_places');
    fieldsWritten.push('reviews');
  }

  if (placesResult && placesResult.photos.length > 0) {
    updates.photos = pendingLayeredValue(placesResult.photos, 'web:google_places');
    fieldsWritten.push('photos');
  }

  if (placesResult?.sentiment_summary) {
    updates.sentiment_summary = pendingLayeredValue(placesResult.sentiment_summary, 'web:google_places');
    fieldsWritten.push('sentiment_summary');
  }

  if (webResult && webResult.recent_events.length > 0) {
    updates.recent_events = pendingLayeredValue(webResult.recent_events, 'web:search_synthesis');
    fieldsWritten.push('recent_events');
  }

  if (placesResult && Object.keys(placesResult.amenity_flags).length > 0) {
    const flags = placesResult.amenity_flags;
    const flagMap: Record<string, string> = {
      has_pool: 'has_pool',
      has_fitness: 'has_fitness',
      has_dog_park: 'has_dog_park',
      has_business_center: 'has_business_center',
      has_clubhouse: 'has_clubhouse',
      has_concierge: 'has_concierge',
    };
    for (const [flagKey, col] of Object.entries(flagMap)) {
      if (flags[flagKey as keyof typeof flags]) {
        updates[col] = pendingLayeredValue(true, 'web:google_places');
        fieldsWritten.push(col);
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    const pendingCols = Object.keys(updates);
    // For new rows: write the full pending structure.
    // For existing rows: inject ONLY the pending_web slot via jsonb_set,
    // preserving any existing resolved value and layers.web.
    const setClauses = pendingCols.map(col =>
      `${col} = jsonb_set(COALESCE(property_descriptions.${col}, '{}'), '{layers,pending_web}', EXCLUDED.${col}->'layers'->'pending_web')`
    ).join(',\n           ');
    const values = [parcelId, ...Object.values(updates)];

    try {
      await dbQuery(
        `INSERT INTO property_descriptions (parcel_id, ${pendingCols.join(', ')}, updated_at)
         VALUES ($1, ${pendingCols.map((_, i) => `$${i + 2}::jsonb`).join(', ')}, NOW())
         ON CONFLICT (parcel_id) DO UPDATE SET
           ${setClauses},
           updated_at = NOW()`,
        values,
      );
      logEntries.push({
        step: 'property_writeback',
        status: 'ok',
        ts: now(),
        detail: { parcel_id: parcelId, fields_written: fieldsWritten },
      });
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error('[research-enrichment] DB writeback failed', { parcelId, error: msg });
      logEntries.push({
        step: 'property_writeback',
        status: 'error',
        ts: now(),
        detail: { error: msg },
      });
      throw dbErr;
    }
  }

  return {
    parcel_id: parcelId,
    places_status: placesStatus,
    web_status: webStatus,
    fields_written: fieldsWritten,
    reviews_count: placesResult?.reviews.length ?? 0,
    photos_count: placesResult?.photos.length ?? 0,
    narrative_words: webResult?.narrative ? webResult.narrative.split(/\s+/).length : 0,
    place_id: placesResult?.place_id ?? null,
    log_entries: logEntries,
  };
}
