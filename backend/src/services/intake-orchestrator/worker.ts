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
import { municipalEnrichment } from '../municipal-enrichment';
import { stripUnitSuffix } from '../municipal-enrichment/address-normalize';
import { censusGeocode } from '../geocoder/census/census-geocoder.client';
import {
  getCachedGeocode,
  setCachedGeocode,
  setCachedGeocodeFailed,
} from '../geocoder/census/geocode-cache';
import { writeBackToPropertyDescriptions } from './property-writeback';

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
  status: 'ok' | 'not_implemented' | 'blocked' | 'error';
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
    return { resolved: false, parcel_id: null };
  }

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
        }

        await appendLog(jobId, {
          step:   'census_geocoder',
          status: cached.geocodeFailed ? 'no_match' : (cached.countyFips ? 'ok' : 'no_fips'),
          ts:     ts(),
          detail: {
            address,
            matched_address: cached.matchedAddress,
            county_fips:     cached.countyFips,
            cache_hit:       cacheHit,
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
      return { resolved: false, parcel_id: null };
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
      return { resolved: true, parcel_id: result.parcel_id };
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
      return { resolved: false, parcel_id: null };
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
      return { resolved: false, parcel_id: null };
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
      return { resolved: true, parcel_id: fallbackResult.parcel_id };
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

  return { resolved: false, parcel_id: null };
}

// ── Step (c): web search stub ────────────────────────────────────────────────

async function stepWebSearch(jobId: string): Promise<void> {
  await appendLog(jobId, {
    step: 'web_search',
    status: 'not_implemented',
    ts: ts(),
    detail: { note: 'Real web search wired in Phase 7' },
  });
}

// ── Step (d): Google Places stub ─────────────────────────────────────────────

async function stepGooglePlaces(jobId: string): Promise<void> {
  await appendLog(jobId, {
    step: 'google_places',
    status: 'not_implemented',
    ts: ts(),
    detail: { note: 'Real Places calls wired in Phase 7' },
  });
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
}): Promise<void> {
  const { id, source_data } = job;
  let parcel_id = job.parcel_id;

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
    await stepWebSearch(id);
    await stepGooglePlaces(id);

    // If municipal lookup found a real county parcel_id that differs from the
    // current parcel_id (which is often just the property name), update the row.
    // Use a conditional UPDATE that skips if another row already holds the same
    // parcel_id (partial UNIQUE index on parcel_id WHERE parcel_id IS NOT NULL).
    if (municipal.resolved && municipal.parcel_id && municipal.parcel_id !== parcel_id) {
      try {
        const updateRes = await query(
          `UPDATE intake_jobs SET parcel_id = $1, updated_at = NOW()
           WHERE id = $2 AND NOT EXISTS (
             SELECT 1 FROM intake_jobs WHERE parcel_id = $1 AND id != $2
           )`,
          [municipal.parcel_id, id]
        );
        // Only update in-memory value if the DB row was actually changed
        if (updateRes.rowCount && updateRes.rowCount > 0) {
          parcel_id = municipal.parcel_id;
          logger.debug(`[intake-worker] job ${id} parcel_id updated to ${parcel_id} via municipal lookup`);
        } else {
          logger.warn(`[intake-worker] job ${id} parcel_id ${municipal.parcel_id} not written (conflict or no-op)`);
        }
      } catch (pErr: any) {
        logger.warn(`[intake-worker] job ${id} parcel_id update skipped: ${pErr.message}`);
      }
    }

    // ── Terminal state ────────────────────────────────────────────────────────
    const resolved = otherDocs.resolved || municipal.resolved;

    if (resolved) {
      await setState(id, 'complete');

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

    const res = await query<{ id: string; parcel_id: string | null; source_data: Record<string, unknown> | null }>(
      `SELECT id, parcel_id, source_data
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
