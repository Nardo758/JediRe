/**
 * Intake Orchestrator Worker
 *
 * Polls intake_jobs WHERE state = 'pending' and advances each job through
 * the enrichment state machine:
 *   pending → parsing → enriching → complete | blocked_needs_user
 *
 * Each state transition appends a structured entry to enrichment_log.
 *
 * Enrichment chain (Phase 1 — stubs except other-docs step):
 *   (a) other-docs check: query data_library_files for matching parcel_id
 *   (b) municipal lookup: stub → not_implemented
 *   (c) web search:       stub → not_implemented
 *   (d) Google Places:    stub → not_implemented
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { emailService } from '../email.service';
import { municipalEnrichment } from '../municipal-enrichment';
import { stripUnitSuffix } from '../municipal-enrichment/address-normalize';
import { censusGeocode } from '../geocoder/census/census-geocoder.client';
import {
  getCachedGeocode,
  setCachedGeocode,
  setCachedGeocodeFailed,
} from '../geocoder/census/geocode-cache';
import { writeBackToPropertyDescriptions } from './property-writeback';
import { lookupRegulatory } from '../regulatory/m02-zoning';

const POLL_INTERVAL_MS = parseInt(process.env.INTAKE_POLL_INTERVAL_MS || '30000', 10);
const BATCH_SIZE = parseInt(process.env.INTAKE_BATCH_SIZE || '20', 10);

/** Max attempts before a failed job is permanently abandoned (no more retries). */
const MAX_ATTEMPTS = 3;

export type IntakeJobState =
  | 'pending'
  | 'parsing'
  | 'enriching'
  | 'complete'
  | 'blocked_needs_user'
  | 'failed'
  | 'ignored';

interface LogEntry {
  step: string;
  status: 'ok' | 'not_implemented' | 'blocked' | 'error' | 'skipped';
  ts: string;
  detail?: Record<string, unknown>;
}

function ts(): string {
  return new Date().toISOString();
}

async function appendLog(jobId: string, entry: LogEntry): Promise<void> {
  await query(
    `UPDATE intake_jobs
     SET enrichment_log = enrichment_log || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify([entry]), jobId]
  );
}

async function setState(
  jobId: string,
  state: IntakeJobState,
  extra?: { block_reason?: string; last_error?: string }
): Promise<void> {
  if (state === 'failed' && extra?.last_error !== undefined) {
    // Increment attempts counter and record the error detail
    await query(
      `UPDATE intake_jobs
          SET state            = $1,
              block_reason     = $2,
              last_error       = $2,
              attempts         = COALESCE(attempts, 0) + 1,
              last_attempt_at  = NOW(),
              updated_at       = NOW()
        WHERE id = $3`,
      [state, extra.last_error, jobId],
    );
  } else if (extra?.block_reason !== undefined) {
    await query(
      `UPDATE intake_jobs
          SET state = $1, block_reason = $2, updated_at = NOW()
        WHERE id = $3`,
      [state, extra.block_reason, jobId],
    );
  } else {
    await query(
      `UPDATE intake_jobs SET state = $1, updated_at = NOW() WHERE id = $2`,
      [state, jobId],
    );
  }
}

// ── Step (a): other-docs check ───────────────────────────────────────────────

async function stepOtherDocs(
  jobId: string,
  parcelId: string | null
): Promise<{ resolved: boolean; fileCount: number; docTypes: string[] }> {
  if (!parcelId) {
    await appendLog(jobId, {
      step: 'other_docs',
      status: 'blocked',
      ts: ts(),
      detail: { reason: 'no_parcel_id' },
    });
    return { resolved: false, fileCount: 0, docTypes: [] };
  }

  const res = await query<{ document_type: string; cnt: string }>(
    `SELECT document_type, COUNT(*)::text AS cnt
     FROM data_library_files
     WHERE LOWER(parcel_id) = LOWER($1)
     GROUP BY document_type`,
    [parcelId]
  );

  const fileCount = res.rows.reduce((sum, r) => sum + parseInt(r.cnt, 10), 0);
  const docTypes = res.rows.map((r) => r.document_type);

  await appendLog(jobId, {
    step: 'other_docs',
    status: fileCount > 0 ? 'ok' : 'blocked',
    ts: ts(),
    detail: { parcel_id: parcelId, file_count: fileCount, doc_types: docTypes },
  });

  return { resolved: fileCount > 0, fileCount, docTypes };
}

// ── Step (b): municipal lookup ────────────────────────────────────────────────

interface MunicipalStepResult {
  resolved: boolean;
  parcel_id: string | null;
  /**
   * True when the municipal lookup resolved a parcel_id AND returned all key
   * attributes (county + at least one valuation field). Used as a cost guard
   * to skip Tavily web search for properties already fully characterised.
   */
  hasFullAttributes: boolean;
  /**
   * True when the Census geocoder (or equivalent) resolved lat/lng for this
   * address. Used as a cost guard to skip Google Places when address + geo
   * are already confirmed by the municipal chain.
   */
  hasLatLng: boolean;
  /** Owner name returned by the municipal adapter (for attribute conflict detection). */
  owner: string | null;
  /**
   * Canonical/matched address returned by the Census geocoder (GA only).
   * Null when geocoding was skipped, failed, or not supported for the state.
   * Used for non-blocking address variant conflict detection.
   */
  canonicalAddress: string | null;
}

async function stepMunicipalLookup(
  jobId: string,
  address: string | null,
  state: string | null,
  existingParcelId: string | null,
  city?: string | null,
): Promise<MunicipalStepResult> {
  if (!state) {
    await appendLog(jobId, {
      step: 'municipal_lookup',
      status: 'blocked',
      ts: ts(),
      detail: { reason: 'missing_state', address, state },
    });
    return { resolved: false, parcel_id: null, hasFullAttributes: false, hasLatLng: false, owner: null, canonicalAddress: null };
  }

  // Tracks whether the Census geocoder resolved lat/lng for this address.
  // Set inside the GA geocoder block; used for the Places cost guard.
  let resolvedLatLng = false;

  // Canonical/matched address from the Census geocoder (GA only).
  // Set when geocoding succeeds so attribute conflict detection can compare
  // it against source_data.address without re-reading the enrichment log.
  let geocoderMatchedAddress: string | null = null;

  // ── Primary path: address lookup ─────────────────────────────────────────
  if (address) {
    // ── Census Geocoder pre-step (GA only) ──────────────────────────────────
    // Normalizes the address and resolves county FIPS so the router can jump
    // directly to the right county adapter instead of trying all 6 in sequence.
    // Cache in address_geocode_cache: once resolved, never calls the API again.
    // Any failure (5xx, timeout, no match) is logged and falls through to the
    // raw address chain — Census is never a hard dependency.
    let geocoderOptions: { countyFips?: string; normalizedAddress?: string; lat?: number; lng?: number } | undefined;
    if (state?.toUpperCase() === 'GA') {
      let cacheHit = false;
      try {
        let cached = await getCachedGeocode(address);
        cacheHit = cached !== null;

        if (cached === null) {
          // Append city + state so Census can disambiguate short street addresses.
          // Without this, "691 14th Street Northwest" could match any US city.
          // Cache key remains the raw address (city/state are stable for a job).
          // Strip unit suffix before Census so "3703 Peachtree Rd NE Apt 4"
          // geocodes as the street address, not the unit.
          const geoBase  = stripUnitSuffix(address);
          const geoQuery = city ? `${geoBase}, ${city}, ${state}` : `${geoBase}, ${state}`;
          const geocodeResult = await censusGeocode(geoQuery);
          if (geocodeResult) {
            await setCachedGeocode(address, geocodeResult);
            cached = {
              matchedAddress: geocodeResult.matchedAddress,
              streetOnly:     geocodeResult.streetOnly,
              countyFips:     geocodeResult.countyFips,
              lat:            geocodeResult.lat,
              lng:            geocodeResult.lng,
              geocodeFailed:  false,
            };
          } else {
            await setCachedGeocodeFailed(address);
            cached = {
              matchedAddress: null,
              streetOnly:     null,
              countyFips:     null,
              lat:            null,
              lng:            null,
              geocodeFailed:  true,
            };
          }
        }

        if (!cached.geocodeFailed && cached.countyFips) {
          geocoderOptions = {
            countyFips:        cached.countyFips,
            normalizedAddress: cached.streetOnly ?? undefined,
            lat:               cached.lat  ?? undefined,
            lng:               cached.lng  ?? undefined,
          };
          resolvedLatLng = !!(cached.lat && cached.lng);
          geocoderMatchedAddress = cached.matchedAddress ?? null;
        }

        await appendLog(jobId, {
          step:   'census_geocoder',
          status: cached.geocodeFailed ? 'blocked' : (cached.countyFips ? 'ok' : 'blocked'),
          ts:     ts(),
          detail: {
            address,
            matched_address: cached.matchedAddress,
            county_fips:     cached.countyFips,
            cache_hit:       cacheHit,
            geocode_result:  cached.geocodeFailed ? 'no_match' : (cached.countyFips ? 'ok' : 'no_fips'),
          },
        });
      } catch (geoErr: any) {
        logger.warn(
          `[intake-worker] Census geocoder error for "${address}": ${geoErr?.message ?? String(geoErr)}`,
        );
        await appendLog(jobId, {
          step:   'census_geocoder',
          status: 'error',
          ts:     ts(),
          detail: { address, error: geoErr?.message ?? String(geoErr) },
        });
        // geocoderOptions stays undefined → raw address chain runs as before
      }
    }

    let result: Awaited<ReturnType<typeof municipalEnrichment.lookup>>;
    try {
      result = await municipalEnrichment.lookup(address, state, city, geocoderOptions);
    } catch (err: any) {
      await appendLog(jobId, {
        step: 'municipal_lookup',
        status: 'error',
        ts: ts(),
        detail: { lookup_mode: 'address', error: err?.message ?? String(err), address, state },
      });
      return { resolved: false, parcel_id: null, hasFullAttributes: false, hasLatLng: false, owner: null, canonicalAddress: null };
    }

    if (result.status === 'ok' && result.parcel_id) {
      await appendLog(jobId, {
        step: 'municipal_lookup',
        status: 'ok',
        ts: ts(),
        detail: {
          lookup_mode:    'address',
          status:         result.status,
          address,
          state,
          source:         result.source ?? null,
          parcel_id:      result.parcel_id,
          owner:          result.owner ?? null,
          legal_description: result.legal_description ?? null,
          assessed_value: result.assessed_value ?? null,
          appraised_value: result.appraised_value ?? null,
          land_acres:     result.land_acres ?? null,
          geometry_area_sqft: result.geometry_area_sqft ?? null,
          units:          result.units ?? null,
          neighborhood:   result.neighborhood ?? null,
          county:         result.county ?? null,
          candidates:     result.candidates ?? null,
        },
      });
      const hasFullAttributes = !!(
        result.county &&
        (result.assessed_value != null || result.appraised_value != null)
      );
      return {
        resolved: true,
        parcel_id: result.parcel_id,
        hasFullAttributes,
        hasLatLng: resolvedLatLng,
        owner: typeof result.owner === 'string' ? result.owner : null,
        canonicalAddress: geocoderMatchedAddress,
      };
    }

    // Address lookup returned not_found / not_implemented / error — fall through
    if (result.status !== 'not_implemented') {
      // Log the address-lookup non-match before attempting parcel-id fallback
      await appendLog(jobId, {
        step: 'municipal_lookup',
        status: result.status === 'error' ? 'error' : 'blocked',
        ts: ts(),
        detail: {
          lookup_mode: 'address',
          status:      result.status,
          address,
          state,
          source:      result.source ?? null,
          candidates:  result.candidates ?? null,
          ...(result.error ? { error: result.error } : {}),
        },
      });
    }

    // If not_implemented there is nothing more to try
    if (result.status === 'not_implemented') {
      await appendLog(jobId, {
        step: 'municipal_lookup',
        status: 'not_implemented',
        ts: ts(),
        detail: { lookup_mode: 'address', status: result.status, state, source: result.source ?? null },
      });
      return { resolved: false, parcel_id: null, hasFullAttributes: false, hasLatLng: false, owner: null, canonicalAddress: null };
    }
  }

  // ── Fallback path: parcel-id lookup ──────────────────────────────────────
  // Attempt only when we have an explicit parcel_id from source_data that
  // differs from the property name (a real county-style ID has no spaces
  // beyond the internal digit separator, or contains digits mixed with letters).
  const sourceParcelId = existingParcelId;
  const looksLikeRealParcelId =
    !!sourceParcelId &&
    /\d/.test(sourceParcelId) &&           // contains at least one digit
    sourceParcelId.trim().length <= 30;    // not a long property name

  if (looksLikeRealParcelId && sourceParcelId) {
    let fallbackResult: Awaited<ReturnType<typeof municipalEnrichment.lookupByParcelId>>;
    try {
      fallbackResult = await municipalEnrichment.lookupByParcelId(sourceParcelId, state, city);
    } catch (err: any) {
      await appendLog(jobId, {
        step: 'municipal_lookup',
        status: 'error',
        ts: ts(),
        detail: { lookup_mode: 'parcel_id', error: err?.message ?? String(err), parcel_id: sourceParcelId, state },
      });
      return { resolved: false, parcel_id: null, hasFullAttributes: false, hasLatLng: false, owner: null, canonicalAddress: null };
    }

    const fallbackLogStatus =
      fallbackResult.status === 'ok'              ? 'ok'              :
      fallbackResult.status === 'not_implemented' ? 'not_implemented' :
      fallbackResult.status === 'not_found'       ? 'blocked'         : 'error';

    await appendLog(jobId, {
      step: 'municipal_lookup',
      status: fallbackLogStatus,
      ts: ts(),
      detail: {
        lookup_mode:    'parcel_id',
        status:         fallbackResult.status,
        parcel_id:      sourceParcelId,
        state,
        source:         fallbackResult.source ?? null,
        owner:          fallbackResult.owner ?? null,
        legal_description: fallbackResult.legal_description ?? null,
        assessed_value: fallbackResult.assessed_value ?? null,
        appraised_value: fallbackResult.appraised_value ?? null,
        land_acres:     fallbackResult.land_acres ?? null,
        geometry_area_sqft: fallbackResult.geometry_area_sqft ?? null,
        county:         fallbackResult.county ?? null,
        candidates:     fallbackResult.candidates ?? null,
        ...(fallbackResult.error ? { error: fallbackResult.error } : {}),
      },
    });

    if (fallbackResult.status === 'ok' && fallbackResult.parcel_id) {
      const hasFullAttributes = !!(
        fallbackResult.county &&
        (fallbackResult.assessed_value != null || fallbackResult.appraised_value != null)
      );
      return {
        resolved: true,
        parcel_id: fallbackResult.parcel_id,
        hasFullAttributes,
        hasLatLng: false,
        owner: typeof fallbackResult.owner === 'string' ? fallbackResult.owner : null,
        canonicalAddress: null,
      };
    }
  } else if (!address) {
    // No address and parcel_id doesn't look like a county ID — nothing to try
    await appendLog(jobId, {
      step: 'municipal_lookup',
      status: 'blocked',
      ts: ts(),
      detail: { reason: 'no_address_and_no_county_parcel_id', state },
    });
  }

  return { resolved: false, parcel_id: null, hasFullAttributes: false, hasLatLng: false, owner: null, canonicalAddress: null };
}

// ── Step (c): web search ─────────────────────────────────────────────────────

async function stepWebSearch(
  jobId: string,
  parcelId: string | null,
  propertyName: string | null,
  address: string | null,
  city: string | null,
  state: string | null,
): Promise<void> {
  const { enrichWithWebSearch } = await import('../research/web-search/web-search.adapter');
  try {
    const result = await enrichWithWebSearch({
      propertyName: propertyName || parcelId || '',
      address,
      city,
      state,
    });
    await appendLog(jobId, {
      step: 'web_search',
      status: 'ok',
      ts: ts(),
      detail: {
        articles: result.news_articles.length,
        events: result.recent_events.length,
        narrative_words: result.narrative ? result.narrative.split(/\s+/).length : 0,
        citation_count: result.citation_set.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendLog(jobId, {
      step: 'web_search',
      status: 'error',
      ts: ts(),
      detail: { error: msg },
    });
  }
}

// ── Step (d): Google Places ───────────────────────────────────────────────────

async function stepGooglePlaces(
  jobId: string,
  parcelId: string | null,
  propertyName: string | null,
  address: string | null,
  city: string | null,
  state: string | null,
): Promise<void> {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    await appendLog(jobId, {
      step: 'google_places',
      status: 'not_implemented',
      ts: ts(),
      detail: { note: 'GOOGLE_PLACES_API_KEY not configured — Places enrichment skipped' },
    });
    return;
  }
  const { enrichWithGooglePlaces } = await import('../research/google-places/google-places.adapter');
  try {
    const result = await enrichWithGooglePlaces({
      propertyName: propertyName || parcelId || '',
      address,
      city,
      state,
    });
    await appendLog(jobId, {
      step: 'google_places',
      status: result.status === 'error' ? 'error' : 'ok',
      ts: ts(),
      detail: result.detail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendLog(jobId, {
      step: 'google_places',
      status: 'error',
      ts: ts(),
      detail: { error: msg },
    });
  }
}

// ── Step (e): M02 Regulatory lookup ──────────────────────────────────────────

async function stepRegulatoryLookup(
  jobId: string,
  address: string | null,
  state: string | null,
  city: string | null,
): Promise<void> {
  if (!address || !state) {
    await appendLog(jobId, {
      step: 'regulatory_lookup',
      status: 'blocked',
      ts: ts(),
      detail: { reason: 'missing_address_or_state' },
    });
    return;
  }

  // Retrieve lat/lng and county FIPS from the geocoder cache (populated during
  // stepMunicipalLookup for GA addresses — and for any state once Census runs).
  let lat: number | null = null;
  let lng: number | null = null;
  let countyFips: string | null = null;

  try {
    const cached = await getCachedGeocode(address);
    if (cached && !cached.geocodeFailed) {
      lat        = cached.lat;
      lng        = cached.lng;
      countyFips = cached.countyFips;
    }
  } catch (_) {
    // Non-fatal: proceed without coordinates (adapter will degrade gracefully)
  }

  try {
    const rc = await lookupRegulatory({
      address,
      lat,
      lng,
      county_fips: countyFips,
      city,
      state,
    });

    await appendLog(jobId, {
      step: 'regulatory_lookup',
      status: rc.zone_code.value !== null || rc.jurisdiction.value ? 'ok' : 'not_implemented',
      ts: ts(),
      detail: {
        jurisdiction:   rc.jurisdiction.value,
        zone_code:      rc.zone_code.value,
        far_max:        rc.far_max.value,
        height_max_ft:  rc.height_max_feet.value,
        density_max:    rc.density_max_units_per_acre.value,
        regulatory_model: rc.regulatory_model.value,
        source_chain:   rc.source_chain,
        constraints:    rc,   // full object stored in log for writeback
      },
    });
  } catch (err: any) {
    await appendLog(jobId, {
      step: 'regulatory_lookup',
      status: 'error',
      ts: ts(),
      detail: { error: err?.message ?? String(err), address, state },
    });
  }
}

// ── Parcel-id extraction from source_data ────────────────────────────────────

function extractParcelId(sourceData: Record<string, unknown> | null): string | null {
  if (!sourceData) return null;
  // Prefer name (human-readable display key used by Apartment Locator properties),
  // then address, then any generic 'parcel_id' field stored in source_data.
  for (const key of ['name', 'address', 'parcel_id']) {
    const v = sourceData[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

// ── Main job processor ───────────────────────────────────────────────────────

async function processJob(job: {
  id: string;
  parcel_id: string | null;
  source_data: Record<string, unknown> | null;
  source_type: string | null;
  file_id: string | null;
  /** Analyst-submitted resolution data; non-null when analyst previously resolved a conflict. */
  user_input: Record<string, unknown> | null;
}): Promise<void> {
  const { id, source_data, source_type, file_id, user_input } = job;
  let parcel_id = job.parcel_id;

  // When the analyst has previously resolved a parcel_id conflict, their
  // explicit choice is the authoritative source of truth for this job.
  // We must not re-block on municipal disagreement after resolution.
  const analystResolvedParcelId =
    user_input && typeof user_input.resolved_parcel_id === 'string'
      ? (user_input.resolved_parcel_id as string).trim() || null
      : null;

  try {
    // ── State: parsing ────────────────────────────────────────────────────────
    await setState(id, 'parsing');

    // If parcel_id is missing, attempt extraction from source_data
    if (!parcel_id) {
      const extracted = extractParcelId(source_data);
      if (extracted) {
        parcel_id = extracted;
        // Persist the recovered parcel_id so later steps and API callers see it
        await query(
          `UPDATE intake_jobs SET parcel_id = $1, updated_at = NOW() WHERE id = $2`,
          [parcel_id, id]
        );
      }
    }

    await appendLog(id, {
      step: 'parsing',
      status: 'ok',
      ts: ts(),
      detail: {
        parcel_id: parcel_id ?? null,
        extracted_from_source: !job.parcel_id && !!parcel_id,
      },
    });

    // ── Document parsing (data_library_upload only) ───────────────────────────
    // Parse the actual file content (PDF → OM pipeline; XLSX/CSV → extractor)
    // before the standard enrichment chain. Failure is non-fatal: the job
    // continues through enrichment so the status chip can still resolve.
    if (source_type === 'data_library_upload' && file_id) {
      try {
        const { processDataLibraryUploadFile } = await import('./data-library-upload-processor');
        const parseResult = await processDataLibraryUploadFile(file_id, source_data ?? {});
        await appendLog(id, {
          step: 'document_parsing',
          status: parseResult.success ? 'ok' : 'error',
          ts: ts(),
          detail: {
            parser_used:   parseResult.parserUsed,
            document_type: parseResult.documentType,
            ...(parseResult.error ? { error: parseResult.error } : {}),
          },
        });
        logger.info(
          `[intake-worker] job ${id} document parsed — type=${parseResult.documentType} ` +
          `parser=${parseResult.parserUsed} ok=${parseResult.success}`,
        );
      } catch (parseErr: any) {
        const msg = parseErr?.message ?? String(parseErr);
        logger.warn(`[intake-worker] job ${id} document parsing failed (non-fatal): ${msg}`);
        await appendLog(id, {
          step: 'document_parsing',
          status: 'error',
          ts: ts(),
          detail: { error: msg },
        });
      }
    }

    // ── State: enriching ──────────────────────────────────────────────────────
    await setState(id, 'enriching');
    await appendLog(id, {
      step: 'enriching_started',
      status: 'ok',
      ts: ts(),
      detail: { parcel_id: parcel_id ?? null },
    });

    // Extract address, state, and city for municipal lookup from source_data
    const sd = source_data ?? {};
    const lookupAddress = (sd.address as string | undefined)?.trim() || null;
    const lookupState   = (sd.state   as string | undefined)?.trim() || null;
    const lookupCity    = (sd.city    as string | undefined)?.trim() || null;

    const otherDocs = await stepOtherDocs(id, parcel_id);
    const municipal = await stepMunicipalLookup(id, lookupAddress, lookupState, parcel_id, lookupCity);
    await stepRegulatoryLookup(id, lookupAddress, lookupState, lookupCity);
    const propertyNameForSearch = (sd.property_name as string | undefined)?.trim()
      || (sd.name as string | undefined)?.trim()
      || parcel_id;

    let phase8HasData = false; // set true if Research Agent writes to pending_web

    if (parcel_id && (lookupAddress || propertyNameForSearch)) {
      try {
        // Resolve the DLA asset_id so research-enrichment can write the FK,
        // enabling the DQ recalculator to use the deterministic asset_id path
        // rather than the brittle property_name == parcel_id string match.
        const dlaLookup = await query<{ id: string }>(
          `SELECT id FROM data_library_assets WHERE property_name = $1 ORDER BY created_at DESC LIMIT 1`,
          [parcel_id],
        );
        const dlaAssetId = dlaLookup.rows[0]?.id ?? undefined;

        const { runResearchEnrichment } = await import('../research/research-enrichment.service');

        // Cost guard: skip web search if municipal lookup already returned a
        // complete characterisation (county + valuation present). The municipal
        // chain gives assessment data; web search adds news/narrative, which
        // is only needed when the property couldn't be fully resolved locally.
        const skipWebSearch = municipal.resolved && municipal.hasFullAttributes;

        // Cost guard: skip Places if municipal returned confirmed address + lat/lng
        // AND the source data provided a real property name (not just falling back
        // to parcel_id). Places resolves amenity flags and reviews — only skip
        // when property identity (confirmed name + address + geo) is already
        // established by the municipal chain.
        const hasConfirmedPropertyName =
          !!propertyNameForSearch && propertyNameForSearch !== parcel_id;
        const skipPlaces =
          municipal.resolved &&
          municipal.hasLatLng &&
          !!lookupAddress &&
          hasConfirmedPropertyName;

        const enrichResult = await runResearchEnrichment({
          parcelId: parcel_id,
          propertyName: propertyNameForSearch ?? parcel_id,
          address: lookupAddress,
          city: lookupCity,
          state: lookupState,
          skipWebSearch,
          skipPlaces,
          assetId: dlaAssetId,
        });
        const webEntry = enrichResult.log_entries.find(
          (e: { step: string; detail?: Record<string, unknown> }) => e.step === 'web_search'
        );
        const webDetail = (webEntry?.detail ?? {}) as { articles_found?: number; events_found?: number };
        await appendLog(id, {
          step: 'web_search',
          status: enrichResult.web_status === 'error' ? 'error'
            : enrichResult.web_status === 'skipped' ? 'skipped'
            : 'ok',
          ts: ts(),
          detail: {
            narrative_words: enrichResult.narrative_words,
            articles_found: webDetail.articles_found ?? 0,
            events_found: webDetail.events_found ?? 0,
            web_status: enrichResult.web_status,
          },
        });
        await appendLog(id, {
          step: 'google_places',
          status: enrichResult.places_status === 'error' ? 'error'
            : enrichResult.places_status === 'skipped' ? 'skipped'
            : 'ok',
          ts: ts(),
          detail: {
            places_status: enrichResult.places_status,
            reviews_count: enrichResult.reviews_count,
            photos_count: enrichResult.photos_count,
          },
        });
        // Mark that Phase 8 data was staged to pending_web, requiring user review.
        // Use fields_written.length > 0 so ALL staged fields (sentiment_summary,
        // recent_events, amenity flags, etc.) trigger awaiting_review — not just
        // the three originally checked (narrative / reviews / photos).
        if (enrichResult.fields_written.length > 0) {
          phase8HasData = true;
        }
      } catch (enrichErr: unknown) {
        const msg = enrichErr instanceof Error ? enrichErr.message : String(enrichErr);
        logger.warn(`[intake-worker] job ${id} Phase 8 enrichment failed: ${msg}`);
        await appendLog(id, {
          step: 'web_search',
          status: 'error',
          ts: ts(),
          detail: { error: msg },
        });
        await appendLog(id, {
          step: 'google_places',
          status: 'error',
          ts: ts(),
          detail: { error: msg },
        });
      }
    } else {
      await appendLog(id, { step: 'web_search', status: 'not_implemented', ts: ts(), detail: { note: 'no address or property_name available' } });
      await appendLog(id, { step: 'google_places', status: 'not_implemented', ts: ts(), detail: { note: 'no address or property_name available' } });
    }

    // ── Parcel-ID conflict detection ──────────────────────────────────────────
    // When municipal lookup returns a parcel_id that disagrees with the one
    // already on the job, surface the conflict to the analyst rather than
    // silently overwriting or discarding either value.
    //
    // Three scenarios:
    //   (A) Analyst already resolved — skip re-blocking; log disagreement as
    //       informational only. The analyst-chosen ID is authoritative.
    //   (B) First-run conflict — block the job so the analyst can adjudicate.
    //   (C) No prior parcel_id — municipal result wins unconditionally.
    if (municipal.resolved && municipal.parcel_id && municipal.parcel_id !== parcel_id) {
      if (parcel_id && analystResolvedParcelId) {
        // (A) Analyst has already picked a parcel_id. Municipal disagrees, but
        // the analyst's explicit resolution takes precedence — do not re-block.
        // Log the disagreement for audit visibility.
        await appendLog(id, {
          step: 'parcel_id_conflict',
          status: 'ok',
          ts: ts(),
          detail: {
            note: 'Municipal lookup disagrees with analyst-resolved parcel_id — no re-block (analyst resolution is authoritative)',
            analyst_resolved: analystResolvedParcelId,
            municipal_returned: municipal.parcel_id,
          },
        });
        logger.info(
          `[intake-worker] job ${id} municipal returned "${municipal.parcel_id}" ` +
          `but analyst resolved to "${analystResolvedParcelId}" — proceeding without re-block`,
        );
        // Keep parcel_id as-is (the analyst-chosen value already written to the row).
      } else if (parcel_id) {
        // (B) Both sources disagree and no analyst resolution on record — block.
        const conflictEntry = {
          step: 'municipal_lookup',
          field: 'parcel_id',
          value_a: parcel_id,
          source_a: 'source_data',
          value_b: municipal.parcel_id,
          source_b: 'municipal_lookup',
          detected_at: ts(),
        };
        await query(
          `UPDATE intake_jobs
              SET conflict_data = $1::jsonb,
                  state         = 'blocked_needs_user',
                  block_reason  = 'parcel_id_conflict',
                  updated_at    = NOW()
            WHERE id = $2`,
          [JSON.stringify([conflictEntry]), id],
        );
        await appendLog(id, {
          step: 'parcel_id_conflict',
          status: 'blocked',
          ts: ts(),
          detail: {
            value_a: parcel_id,
            source_a: 'source_data',
            value_b: municipal.parcel_id,
            source_b: 'municipal_lookup',
            note: 'Analyst must resolve via PATCH /intake-jobs/:id/user-input with resolved_parcel_id',
          },
        });
        logger.info(
          `[intake-worker] job ${id} → blocked_needs_user (parcel_id_conflict: ` +
          `"${parcel_id}" [source_data] vs "${municipal.parcel_id}" [municipal_lookup])`,
        );

        // ── Conflict alert email (one per conflict event, non-fatal) ──────────
        //
        // Dedup uses two persistent DB columns (not enrichment_log, which is
        // reset to '[]' on every requeue by PATCH/POST /user-input):
        //
        //   conflict_alert_sent_at     — when the last successful full-delivery
        //                                alert was dispatched
        //   conflict_alert_fingerprint — sorted canonical string of the two
        //                                parcel IDs that produced the conflict
        //
        // Same fingerprint AND sent_at set → same event → skip.
        // Different fingerprint (new conflict pair) → allow fresh alert.
        //
        // Recipients — account-scoped, no broad fallbacks:
        //   1. source_data.uploaded_by → users.email  (direct job-owner lookup)
        //   2. file_id → data_library_files.uploaded_by → users.email (FK chain)
        //   3. INTAKE_ALERT_EMAILS env var — non-production environments only
        //   If nothing resolves, log a warning and skip; never broadcast.
        //
        // Dedup marker is only set when ALL required recipients received the
        // message — partial delivery leaves the marker unset so a future
        // re-queue can retry sending to the missed recipients.
        try {
          // Build a stable fingerprint; sort so order of discovery is irrelevant.
          const fpParts = [parcel_id, municipal.parcel_id].sort();
          const currentFingerprint = fpParts.join('|||');

          const alertFlagRow = await query<{
            conflict_alert_sent_at: string | null;
            conflict_alert_fingerprint: string | null;
          }>(
            `SELECT conflict_alert_sent_at, conflict_alert_fingerprint
               FROM intake_jobs WHERE id = $1`,
            [id],
          );
          const storedFingerprint = alertFlagRow.rows[0]?.conflict_alert_fingerprint ?? null;
          const alreadySentForThisEvent =
            !!(alertFlagRow.rows[0]?.conflict_alert_sent_at) &&
            storedFingerprint === currentFingerprint;

          if (!alreadySentForThisEvent) {
            // ── Resolve recipients (account-scoped) ──────────────────────
            let recipients: string[] = [];

            // 1. source_data.uploaded_by — stored in JSONB at intake creation
            //    by both the archive upload route and data-library-upload service.
            //    This is the most direct job-owner → email path.
            const sdUploadedBy = (sd.uploaded_by as string | undefined)?.trim() || null;
            if (sdUploadedBy) {
              const ownerResult = await query<{ email: string }>(
                `SELECT email FROM users
                  WHERE id = $1
                    AND email IS NOT NULL
                    AND is_active = true
                  LIMIT 1`,
                [sdUploadedBy],
              );
              recipients = ownerResult.rows.map((r) => r.email).filter(Boolean);
            }

            // 2. file FK chain — fallback for jobs where source_data lacks
            //    uploaded_by (e.g. older rows created before the field existed).
            if (recipients.length === 0 && file_id) {
              const uploaderResult = await query<{ email: string }>(
                `SELECT u.email
                   FROM data_library_files dlf
                   JOIN users u ON u.id = dlf.uploaded_by
                  WHERE dlf.id = $1
                    AND u.email IS NOT NULL
                    AND u.is_active = true
                  LIMIT 1`,
                [file_id],
              );
              recipients = uploaderResult.rows.map((r) => r.email).filter(Boolean);
            }

            // 3. INTAKE_ALERT_EMAILS — non-production override only.
            //    In production this path is intentionally disabled to prevent
            //    cross-account information disclosure via a shared env var.
            if (
              recipients.length === 0 &&
              process.env.NODE_ENV !== 'production'
            ) {
              const envEmails = (process.env.INTAKE_ALERT_EMAILS ?? '')
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean);
              recipients = envEmails;
            }

            if (recipients.length === 0) {
              logger.warn(
                `[intake-worker] job ${id} conflict alert: no account-scoped ` +
                `recipient resolved — ensure the file has an uploader or set ` +
                `source_data.uploaded_by at job creation`,
              );
            } else {
              // ── Build absolute inbox deep link ──────────────────────────
              const rawBase: string =
                process.env.APP_URL ??
                process.env.FRONTEND_URL ??
                (process.env.REPLIT_DEV_DOMAIN
                  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                  : 'http://localhost:3000');
              const inboxUrl = `${rawBase.replace(/\/$/, '')}/archive/inbox`;

              const propertyLabel =
                (sd.property_name as string | undefined)?.trim() ||
                (sd.name as string | undefined)?.trim() ||
                parcel_id ||
                id;

              let sentCount = 0;
              const sendErrors: string[] = [];

              for (const email of recipients) {
                try {
                  await emailService.sendParcelConflictAlert({
                    to: email,
                    jobId: id,
                    propertyLabel,
                    valueA: parcel_id,
                    sourceA: 'source_data',
                    valueB: municipal.parcel_id,
                    sourceB: 'municipal_lookup',
                    inboxUrl,
                  });
                  sentCount++;
                } catch (perRecipientErr: any) {
                  const msg = perRecipientErr?.message ?? String(perRecipientErr);
                  logger.warn(
                    `[intake-worker] job ${id} conflict alert failed for ${email}: ${msg}`,
                  );
                  sendErrors.push(`${email}: ${msg}`);
                }
              }

              if (sentCount === recipients.length) {
                // All recipients delivered — set durable dedup marker so the
                // same conflict pair never triggers a second alert.
                await query(
                  `UPDATE intake_jobs
                      SET conflict_alert_sent_at    = NOW(),
                          conflict_alert_fingerprint = $1
                    WHERE id = $2`,
                  [currentFingerprint, id],
                );
                await appendLog(id, {
                  step: 'conflict_alert_sent',
                  status: 'ok',
                  ts: ts(),
                  detail: {
                    sent_count: sentCount,
                    fingerprint: currentFingerprint,
                    provider: emailService.providerName(),
                  },
                });
                logger.info(
                  `[intake-worker] job ${id} conflict alert sent to all ` +
                  `${sentCount} recipient(s)`,
                );
              } else {
                // Partial or total delivery failure — do NOT set dedup marker
                // so the next re-queue can retry the full recipient list.
                await appendLog(id, {
                  step: 'conflict_alert_sent',
                  status: sentCount > 0 ? 'ok' : 'error',
                  ts: ts(),
                  detail: {
                    sent_count: sentCount,
                    total_recipients: recipients.length,
                    errors: sendErrors,
                    note: 'Dedup marker not set — retry on next re-queue',
                  },
                }).catch(() => {});
                logger.warn(
                  `[intake-worker] job ${id} conflict alert partial delivery ` +
                  `${sentCount}/${recipients.length} — dedup marker withheld`,
                );
              }
            }
          }
        } catch (alertErr: any) {
          // Alert infrastructure failure is non-fatal — job is already blocked,
          // analyst will see it in the Inbox UI even without an email.
          logger.warn(
            `[intake-worker] job ${id} failed to send conflict alert: ` +
            `${alertErr?.message ?? String(alertErr)}`,
          );
          await appendLog(id, {
            step: 'conflict_alert_sent',
            status: 'error',
            ts: ts(),
            detail: { error: alertErr?.message ?? String(alertErr) },
          }).catch(() => {});
        }

        return; // Analyst resolves; requeue will restart the chain with the winning ID.
      } else {
        // (C) No pre-existing parcel_id — municipal result wins without conflict.
        await query(
          `UPDATE intake_jobs SET parcel_id = $1, updated_at = NOW() WHERE id = $2`,
          [municipal.parcel_id, id],
        );
        parcel_id = municipal.parcel_id;
        logger.debug(`[intake-worker] job ${id} parcel_id set to ${parcel_id} via municipal lookup`);
      }
    }

    // ── Non-identifier attribute conflict logging (non-blocking) ──────────────
    // When source_data and municipal lookup disagree on owner name or address,
    // append audit entries to enrichment_log. The first-write-wins rule applies
    // during writeback — these entries are informational only, never blocking.
    if (municipal.resolved) {
      const sdOwner = (sd.owner as string | undefined)?.trim() || null;
      if (sdOwner && municipal.owner && sdOwner.toLowerCase() !== municipal.owner.toLowerCase()) {
        await appendLog(id, {
          step: 'attribute_conflict',
          status: 'ok',
          ts: ts(),
          detail: {
            field: 'owner',
            value_a: sdOwner,
            source_a: 'source_data',
            value_b: municipal.owner,
            source_b: 'municipal_lookup',
            resolution: 'first_write_wins',
          },
        });
      }

      // Address variant: compare source_data address against the Census-matched
      // canonical form (GA only; null for other states or when geocoding failed).
      if (
        lookupAddress &&
        municipal.canonicalAddress &&
        lookupAddress.toLowerCase().replace(/\s+/g, ' ').trim() !==
          municipal.canonicalAddress.toLowerCase().replace(/\s+/g, ' ').trim()
      ) {
        await appendLog(id, {
          step: 'attribute_conflict',
          status: 'ok',
          ts: ts(),
          detail: {
            field: 'address',
            value_a: lookupAddress,
            source_a: 'source_data',
            value_b: municipal.canonicalAddress,
            source_b: 'census_geocoder',
            resolution: 'first_write_wins',
          },
        });
      }
    }

    // ── Terminal state ────────────────────────────────────────────────────────
    const resolved = otherDocs.resolved || municipal.resolved;

    if (resolved) {
      // If Phase 8 enrichment wrote data to pending_web, the job needs user
      // review before it completes. The Apply/Discard action moves it to 'complete'.
      const terminalState = phase8HasData ? 'awaiting_review' : 'complete';
      await setState(id, terminalState);

      // ── Task C: write enrichment data to property_descriptions ─────────────
      if (parcel_id) {
        try {
          // Re-read the final enrichment_log so we capture all steps written
          // above (avoids keeping a mutable in-memory copy through the chain).
          const logRow = await query<{ enrichment_log: LogEntry[] }>(
            `SELECT enrichment_log FROM intake_jobs WHERE id = $1`,
            [id],
          );
          const log: LogEntry[] = logRow.rows[0]?.enrichment_log ?? [];
          const wb = await writeBackToPropertyDescriptions(parcel_id, log);
          if (!wb.skipped) {
            await appendLog(id, {
              step: 'property_writeback',
              status: 'ok',
              ts: ts(),
              detail: { parcel_id, fields_written: wb.fieldsWritten, source: wb.source },
            });
          }
        } catch (wbErr: any) {
          // Write-back failure is non-fatal: job is already complete.
          // Log it so operators can diagnose without blocking the job.
          logger.warn(`[intake-worker] job ${id} write-back failed: ${wbErr.message}`);
          await appendLog(id, {
            step: 'property_writeback',
            status: 'error',
            ts: ts(),
            detail: { parcel_id, error: wbErr.message },
          }).catch(() => {});
        }
      }

      await appendLog(id, {
        step: 'resolution',
        status: 'ok',
        ts: ts(),
        detail: {
          result: 'complete',
          resolved_by: otherDocs.resolved ? 'other_docs' : 'municipal_lookup',
          file_count: otherDocs.fileCount,
          doc_types: otherDocs.docTypes,
          parcel_id: parcel_id ?? null,
        },
      });
      logger.debug(`[intake-worker] job ${id} → complete (${otherDocs.resolved ? 'other_docs' : 'municipal'})`);
    } else {
      await setState(id, 'blocked_needs_user', {
        block_reason: 'no_municipal_or_web_resolution_available',
      });
      await appendLog(id, {
        step: 'resolution',
        status: 'blocked',
        ts: ts(),
        detail: { result: 'blocked_needs_user', reason: 'no_municipal_or_web_resolution_available' },
      });
      logger.debug(`[intake-worker] job ${id} → blocked_needs_user`);
    }
  } catch (err: any) {
    logger.error(`[intake-worker] job ${id} failed`, { error: err.message });
    try {
      await setState(id, 'failed', { last_error: err.message });
      await appendLog(id, {
        step: 'worker_error',
        status: 'error',
        ts: ts(),
        detail: { error: err.message },
      });
    } catch (_) {}
  }
}

// ── Worker loop ──────────────────────────────────────────────────────────────

let running = false;

async function poll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Pick up pending jobs AND failed jobs eligible for retry (attempts < MAX_ATTEMPTS).
    // Failed jobs are reset to 'pending' so the existing processJob path handles them
    // uniformly — no special retry branch needed.
    await query(
      `UPDATE intake_jobs
          SET state = 'pending', updated_at = NOW()
        WHERE state = 'failed'
          AND attempts < $1
          AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '30 seconds')`,
      [MAX_ATTEMPTS],
    );

    const res = await query<{
      id: string;
      parcel_id: string | null;
      source_data: Record<string, unknown> | null;
      source_type: string | null;
      file_id: string | null;
      user_input: Record<string, unknown> | null;
    }>(
      `SELECT id, parcel_id, source_data, source_type, file_id, user_input
       FROM intake_jobs
       WHERE state = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (res.rows.length > 0) {
      logger.info(`[intake-worker] processing ${res.rows.length} pending jobs`);
      let batchComplete = 0;
      let batchBlocked = 0;
      let batchFailed = 0;
      for (const job of res.rows) {
        await processJob(job);
        // Read final state to tally batch summary
        const stateRow = await query<{ state: string }>(
          `SELECT state FROM intake_jobs WHERE id = $1`, [job.id]
        );
        const finalState = stateRow.rows[0]?.state;
        if (finalState === 'complete')            batchComplete++;
        else if (finalState === 'blocked_needs_user') batchBlocked++;
        else if (finalState === 'failed')          batchFailed++;
      }
      logger.info(
        `[intake-worker] batch done — complete: ${batchComplete}, blocked: ${batchBlocked}, failed: ${batchFailed}` +
        ` (of ${res.rows.length} processed)`
      );
    }
  } catch (err: any) {
    logger.error('[intake-worker] poll error', { error: err.message });
  } finally {
    running = false;
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * processJobById — exported for use by backfill/enrichment scripts.
 * Reads the job from the DB then delegates to processJob.
 * Throws if the job does not exist.
 */
export async function processJobById(jobId: string): Promise<void> {
  const res = await query<{
    id: string;
    parcel_id: string | null;
    source_data: Record<string, unknown> | null;
    source_type: string | null;
    file_id: string | null;
  }>(
    `SELECT id, parcel_id, source_data, source_type, file_id
     FROM intake_jobs WHERE id = $1 LIMIT 1`,
    [jobId],
  );
  if (res.rows.length === 0) throw new Error(`intake_job ${jobId} not found`);
  await processJob(res.rows[0]);
}

export function startIntakeWorker(): void {
  if (intervalHandle) return;
  logger.info(`[intake-worker] starting — poll interval ${POLL_INTERVAL_MS}ms, batch size ${BATCH_SIZE}`);
  // Run immediately on start, then on interval
  poll().catch((err) => logger.error('[intake-worker] initial poll error', { error: err.message }));
  intervalHandle = setInterval(() => {
    poll().catch((err) => logger.error('[intake-worker] interval poll error', { error: err.message }));
  }, POLL_INTERVAL_MS);
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
}

export function stopIntakeWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[intake-worker] stopped');
  }
}
