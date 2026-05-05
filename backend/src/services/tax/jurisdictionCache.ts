/**
 * Jurisdiction Tax Cache
 *
 * Read-through cache backed by the `jurisdiction_tax_cache` DB table
 * (created in migration 20260505_020_tax_service_tables.sql).
 *
 * Cache key: { jurisdiction, field, fiscal_year }
 * TTL: end of the current fiscal year (Jan 1 00:00 UTC of year + 1)
 *
 * Usage:
 *   const rate = await jurisdictionCache.get('FL-Miami-Dade', 'millage_rate', 2026);
 *   if (!rate) {
 *     const live = await fetchLiveMillage(...);
 *     await jurisdictionCache.set('FL-Miami-Dade', 'millage_rate', 2026, live, 'live_millage');
 *   }
 *
 * All methods are safe to call even when the DB table does not yet exist;
 * failures are logged and silently swallowed so the tax service degrades
 * gracefully to hardcoded ruleset defaults.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ── TTL helpers ───────────────────────────────────────────────────────────────

function fiscalYearEnd(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1)); // Jan 1 of year+1, 00:00 UTC
}

function currentFiscalYear(): number {
  return new Date().getUTCFullYear();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Retrieve a cached jurisdiction field value.
 * Returns null on cache miss, DB error, or expired entry.
 */
export async function jurisdictionCacheGet<T = unknown>(
  jurisdiction: string,
  field: string,
  fiscalYear?: number,
): Promise<T | null> {
  const fy = fiscalYear ?? currentFiscalYear();
  try {
    const res = await query(
      `SELECT value
         FROM jurisdiction_tax_cache
        WHERE jurisdiction = $1
          AND field        = $2
          AND fiscal_year  = $3
          AND expires_at   > NOW()
        LIMIT 1`,
      [jurisdiction, field, fy],
    );
    return (res.rows[0]?.value ?? null) as T | null;
  } catch (err: any) {
    logger.warn('[jurisdictionCache] get failed', { jurisdiction, field, fy, err: err?.message });
    return null;
  }
}

/**
 * Write a value into the jurisdiction cache.
 * TTL defaults to end of the current fiscal year.
 * Uses ON CONFLICT DO UPDATE so re-fetches overwrite stale entries.
 */
export async function jurisdictionCacheSet<T = unknown>(
  jurisdiction: string,
  field: string,
  value: T,
  source: string,
  fiscalYear?: number,
): Promise<void> {
  const fy = fiscalYear ?? currentFiscalYear();
  const expiresAt = fiscalYearEnd(fy);
  try {
    await query(
      `INSERT INTO jurisdiction_tax_cache
             (jurisdiction, field, fiscal_year, value, source, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (jurisdiction, field, fiscal_year)
       DO UPDATE SET
         value      = EXCLUDED.value,
         source     = EXCLUDED.source,
         fetched_at = NOW(),
         expires_at = EXCLUDED.expires_at`,
      [jurisdiction, field, fy, JSON.stringify(value), source, expiresAt.toISOString()],
    );
  } catch (err: any) {
    logger.warn('[jurisdictionCache] set failed', { jurisdiction, field, fy, err: err?.message });
  }
}

/**
 * Invalidate all cached fields for a jurisdiction + fiscal year.
 * Call this when a new rate sheet is promoted to `active` status.
 */
export async function jurisdictionCacheInvalidate(
  jurisdiction: string,
  fiscalYear?: number,
): Promise<void> {
  const fy = fiscalYear ?? currentFiscalYear();
  try {
    await query(
      `DELETE FROM jurisdiction_tax_cache
        WHERE jurisdiction = $1 AND fiscal_year = $2`,
      [jurisdiction, fy],
    );
  } catch (err: any) {
    logger.warn('[jurisdictionCache] invalidate failed', { jurisdiction, fy, err: err?.message });
  }
}

export const jurisdictionCache = {
  get: jurisdictionCacheGet,
  set: jurisdictionCacheSet,
  invalidate: jurisdictionCacheInvalidate,
};
