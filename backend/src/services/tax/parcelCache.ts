/**
 * Parcel Tax Cache
 *
 * Read-through cache backed by the `parcel_tax_cache` DB table
 * (created in migration 20260505_020_tax_service_tables.sql).
 *
 * Cache key: { parcel_id, fiscal_year }
 * TTL: end of the current fiscal year (Jan 1 00:00 UTC of year + 1)
 *
 * Cache invalidation:
 *   parcelCacheInvalidate(parcelId) — called when a `tax_bill_uploaded` Kafka
 *   event fires for that parcel so the next forecast re-fetches fresh data.
 *
 * All methods are safe to call even when the DB table does not yet exist;
 * failures are logged and silently swallowed so the tax service degrades
 * gracefully to ruleset defaults.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { NormalizedParcel } from './types';

// ── TTL helper ────────────────────────────────────────────────────────────────

function fiscalYearEnd(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1));
}

function currentFiscalYear(): number {
  return new Date().getUTCFullYear();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Retrieve a cached NormalizedParcel for a given parcel ID + fiscal year.
 * Returns null on cache miss, DB error, or expired entry.
 */
export async function parcelCacheGet(
  parcelId: string,
  fiscalYear?: number,
): Promise<NormalizedParcel | null> {
  const fy = fiscalYear ?? currentFiscalYear();
  try {
    const res = await query(
      `SELECT data
         FROM parcel_tax_cache
        WHERE parcel_id   = $1
          AND fiscal_year = $2
          AND expires_at  > NOW()
        LIMIT 1`,
      [parcelId, fy],
    );
    return (res.rows[0]?.data ?? null) as NormalizedParcel | null;
  } catch (err: any) {
    logger.warn('[parcelCache] get failed', { parcelId, fy, err: err?.message });
    return null;
  }
}

/**
 * Write a NormalizedParcel into the parcel cache.
 * TTL defaults to end of the current fiscal year.
 * Uses ON CONFLICT DO UPDATE so re-fetches overwrite stale entries.
 */
export async function parcelCacheSet(
  parcelId: string,
  parcel: NormalizedParcel,
  source: string,
  fiscalYear?: number,
): Promise<void> {
  const fy = fiscalYear ?? currentFiscalYear();
  const expiresAt = fiscalYearEnd(fy);
  try {
    await query(
      `INSERT INTO parcel_tax_cache
             (parcel_id, fiscal_year, data, source, expires_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (parcel_id, fiscal_year)
       DO UPDATE SET
         data       = EXCLUDED.data,
         source     = EXCLUDED.source,
         fetched_at = NOW(),
         expires_at = EXCLUDED.expires_at`,
      [parcelId, fy, JSON.stringify(parcel), source, expiresAt.toISOString()],
    );
  } catch (err: any) {
    logger.warn('[parcelCache] set failed', { parcelId, fy, err: err?.message });
  }
}

/**
 * Invalidate ALL cached parcel entries for a given parcel ID across every
 * fiscal year.  Called when a `tax_bill_uploaded` event fires for that parcel
 * so the next forecast re-fetches fresh ATTOM / PDF data regardless of which
 * fiscal year the deal is modelled in.
 *
 * The optional `fiscalYear` parameter is retained for targeted single-year
 * invalidation in tests or administrative tooling, but the default behaviour
 * (no argument) now deletes all years.
 */
export async function parcelCacheInvalidate(
  parcelId: string,
  fiscalYear?: number,
): Promise<void> {
  try {
    if (fiscalYear != null) {
      // Targeted single-year invalidation (tests / admin tooling).
      await query(
        `DELETE FROM parcel_tax_cache WHERE parcel_id = $1 AND fiscal_year = $2`,
        [parcelId, fiscalYear],
      );
      logger.info('[parcelCache] invalidated (single year)', { parcelId, fiscalYear });
    } else {
      // Default: wipe ALL fiscal years so a new tax bill upload always takes effect.
      await query(
        `DELETE FROM parcel_tax_cache WHERE parcel_id = $1`,
        [parcelId],
      );
      logger.info('[parcelCache] invalidated (all years)', { parcelId });
    }
  } catch (err: any) {
    logger.warn('[parcelCache] invalidate failed', { parcelId, fiscalYear, err: err?.message });
  }
}

export const parcelCache = {
  get: parcelCacheGet,
  set: parcelCacheSet,
  invalidate: parcelCacheInvalidate,
};
