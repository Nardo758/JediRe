/**
 * MSA Resolver — W-07 Follow-up A
 *
 * Resolves a deal's MSA identifier when `deals.msa_id` is null.
 * Uses city/state → msa_boundaries table lookup with a hardcoded
 * fallback map of well-known US cities.
 *
 * @version 1.0.0
 * @date 2026-05-19
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

/** Hardcoded map of well-known US cities to MSA identifiers.
 *  Used when the msa_boundaries table doesn't exist or the city
 *  isn't found in it. */
const KNOWN_MSAS: Record<string, string> = {
  atlanta: 'atlanta-msa',
  orlando: 'orlando-msa',
  miami: 'miami-msa',
  tampa: 'tampa-msa',
  jacksonville: 'jacksonville-msa',
  charlotte: 'charlotte-msa',
  raleigh: 'raleigh-msa',
  nashville: 'nashville-msa',
  austin: 'austin-msa',
  dallas: 'dallas-msa',
  houston: 'houston-msa',
  phoenix: 'phoenix-msa',
  denver: 'denver-msa',
  seattle: 'seattle-msa',
  'los angeles': 'los-angeles-msa',
  'san francisco': 'san-francisco-msa',
  'new york': 'new-york-msa',
  boston: 'boston-msa',
  washington: 'washington-dc-msa',
  chicago: 'chicago-msa',
  detroit: 'detroit-msa',
  minneapolis: 'minneapolis-msa',
  'san diego': 'san-diego-msa',
  portland: 'portland-msa',
  'salt lake city': 'salt-lake-city-msa',
  'las vegas': 'las-vegas-msa',
  'san antonio': 'san-antonio-msa',
  kansas: 'kansas-city-msa',
  columbus: 'columbus-msa',
  indianapolis: 'indianapolis-msa',
  cleveland: 'cleveland-msa',
  cincinnati: 'cincinnati-msa',
  milwaukee: 'milwaukee-msa',
  sacramento: 'sacramento-msa',
  'san jose': 'san-jose-msa',
  pittsburgh: 'pittsburgh-msa',
  philadelphia: 'philadelphia-msa',
  baltimore: 'baltimore-msa',
  'st louis': 'st-louis-msa',
  richmond: 'richmond-msa',
  norfolk: 'norfolk-msa',
  'new orleans': 'new-orleans-msa',
  memphis: 'memphis-msa',
  oklahoma: 'oklahoma-city-msa',
  louisville: 'louisville-msa',
  providence: 'providence-msa',
  albuquerque: 'albuquerque-msa',
  tucson: 'tucson-msa',
  fresno: 'fresno-msa',
  'fort worth': 'dallas-msa',
};

class MsaResolver {
  /**
   * Resolve the MSA ID for a given deal.
   *
   * Strategy:
   * 1. If deals.msa_id is already set, return it (fast path)
   * 2. Try msa_boundaries table lookup from city/state
   * 3. Fall back to KNOWN_MSAS hardcoded map
   * 4. If all fail, return null with a warning log
   *
   * When a resolution succeeds, it lazily backfills `deals.msa_id`
   * for future runs.
   */
  async resolve(dealId: string): Promise<string | null> {
    try {
      const pool = getPool();

      // Step 1: Check if already set
      const dealResult = await pool.query(
        `SELECT msa_id, property_city, property_state
         FROM deals
         WHERE id = $1
         LIMIT 1`,
        [dealId]
      );

      if (dealResult.rows.length === 0) {
        logger.warn('msa-resolver: deal not found', { dealId });
        return null;
      }

      const row = dealResult.rows[0];

      // Fast path: already resolved
      if (row.msa_id) {
        return row.msa_id as string;
      }

      const city = (row.property_city as string ?? '').trim().toLowerCase();
      const state = (row.property_state as string ?? '').trim().toUpperCase();

      if (!city) {
        logger.warn('msa-resolver: deal has no property_city', { dealId });
        return null;
      }

      let resolvedMsaId: string | null = null;

      // Step 2: Try msa_boundaries table
      try {
        const lookupResult = await pool.query(
          `SELECT msa_id FROM msa_boundaries
           WHERE LOWER(city_name) = $1 AND state_code = $2
           LIMIT 1`,
          [city, state]
        );
        if (lookupResult.rows.length > 0) {
          resolvedMsaId = lookupResult.rows[0].msa_id as string;
        }
      } catch (err: any) {
        // Table may not exist yet — log and continue
        logger.debug('msa-resolver: msa_boundaries table unavailable, falling back to hardcoded map', {
          dealId,
          error: err?.message,
        });
      }

      // Step 3: Fall back to hardcoded map
      if (!resolvedMsaId) {
        resolvedMsaId = KNOWN_MSAS[city] ?? null;
      }

      // Step 4: Lazy backfill on success
      if (resolvedMsaId) {
        await pool.query(
          `UPDATE deals SET msa_id = $1 WHERE id = $2 AND msa_id IS NULL`,
          [resolvedMsaId, dealId]
        );
        logger.info('msa-resolver: resolved and cached msa_id', {
          dealId,
          city,
          state,
          resolvedMsaId,
        });
      } else {
        logger.warn('msa-resolver: no MSA found for city', {
          dealId,
          city,
          state,
        });
      }

      return resolvedMsaId;
    } catch (err: any) {
      logger.error('msa-resolver: resolution failed', { dealId, error: err?.message });
      return null;
    }
  }
}

export const msaResolver = new MsaResolver();
