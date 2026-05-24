/**
 * address_geocode_cache — thin DB wrapper for the Census Geocoder cache.
 *
 * Keyed by LOWER(TRIM(raw input address)).
 * Designed to be called from the intake worker before each GA municipal lookup.
 */

import { query } from '../../../database/connection';
import { logger } from '../../../utils/logger';
import type { CensusGeocodeResult } from './census-geocoder.client';

export interface CachedGeocode {
  matchedAddress: string | null;
  streetOnly:     string | null;
  countyFips:     string | null;
  lat:            number | null;
  lng:            number | null;
  geocodeFailed:  boolean;
}

function cacheKey(address: string): string {
  return address.toLowerCase().trim();
}

/** Read a previously cached geocode result. Returns null if never attempted. */
export async function getCachedGeocode(address: string): Promise<CachedGeocode | null> {
  try {
    const result = await query(
      `SELECT matched_address, street_only, county_fips, lat, lng, geocode_failed
         FROM address_geocode_cache
        WHERE input_address = $1`,
      [cacheKey(address)],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      matchedAddress: row.matched_address ?? null,
      streetOnly:     row.street_only     ?? null,
      countyFips:     row.county_fips     ?? null,
      lat:            row.lat != null ? parseFloat(row.lat) : null,
      lng:            row.lng != null ? parseFloat(row.lng) : null,
      geocodeFailed:  row.geocode_failed  ?? false,
    };
  } catch (err: any) {
    logger.warn(`[geocode-cache] read error: ${err?.message ?? String(err)}`);
    return null;
  }
}

/** Persist a successful Census geocode result. Upserts on conflict. */
export async function setCachedGeocode(
  address: string,
  result: CensusGeocodeResult,
): Promise<void> {
  try {
    await query(
      `INSERT INTO address_geocode_cache
         (input_address, matched_address, street_only, county_fips, lat, lng, geocode_failed, geocoded_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, now())
       ON CONFLICT (input_address) DO UPDATE SET
         matched_address = EXCLUDED.matched_address,
         street_only     = EXCLUDED.street_only,
         county_fips     = EXCLUDED.county_fips,
         lat             = EXCLUDED.lat,
         lng             = EXCLUDED.lng,
         geocode_failed  = false,
         geocoded_at     = now()`,
      [
        cacheKey(address),
        result.matchedAddress,
        result.streetOnly,
        result.countyFips,
        result.lat,
        result.lng,
      ],
    );
  } catch (err: any) {
    logger.warn(`[geocode-cache] write error: ${err?.message ?? String(err)}`);
  }
}

/** Persist a geocode failure (no match from Census). Prevents re-calling the API. */
export async function setCachedGeocodeFailed(address: string): Promise<void> {
  try {
    await query(
      `INSERT INTO address_geocode_cache
         (input_address, matched_address, street_only, county_fips, lat, lng, geocode_failed, geocoded_at)
       VALUES ($1, NULL, NULL, NULL, NULL, NULL, true, now())
       ON CONFLICT (input_address) DO UPDATE SET
         geocode_failed = true,
         geocoded_at    = now()`,
      [cacheKey(address)],
    );
  } catch (err: any) {
    logger.warn(`[geocode-cache] write-failure error: ${err?.message ?? String(err)}`);
  }
}
