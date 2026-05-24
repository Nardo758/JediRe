/**
 * US Census Bureau Geocoder client — single-record geographies endpoint.
 *
 * Endpoint:
 *   https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress
 *   ?address=<encoded>&benchmark=Public_AR_Current&vintage=Current_Current&format=json
 *
 * Returns the Census-normalized address string, county FIPS (5-digit), and
 * lat/lng. County FIPS is the primary output — it lets the GA municipal
 * enrichment router skip directly to the right county adapter.
 *
 * Rate limits / reliability:
 *   - No documented hard rate limit for the single-record endpoint.
 *   - Government API — no SLA. 3-second timeout enforced.
 *   - 429 responses trigger exponential backoff (2s → 4s → 8s).
 *   - 5xx or timeout → returns null (caller falls back to raw address chain).
 *
 * Cache:
 *   Results are persisted in address_geocode_cache (keyed by LOWER(TRIM(input))).
 *   Cache is checked by the caller (worker.ts) before invoking this client.
 */

import { logger } from '../../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CensusGeocodeResult {
  /** Census-normalized address: "1991 MLK DR SW, ATLANTA, GA, 30310" */
  matchedAddress: string;
  /** Street + number only (city/state/zip stripped): "1991 MLK DR SW" */
  streetOnly: string;
  /** 5-digit county FIPS: "13121" (Fulton GA), "13089" (DeKalb GA), etc. */
  countyFips: string | null;
  lat: number;
  lng: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CENSUS_GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

const TIMEOUT_MS    = 3_000;
const MAX_RETRIES   = 3;
const RETRY_DELAYS  = [2_000, 4_000, 8_000]; // for 429 responses

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip city, state, and zip from a Census-matched address string.
 *
 * Census returns: "1991 MLK DR SW, ATLANTA, GA, 30310"
 * We want:        "1991 MLK DR SW"
 */
function stripCityStateZip(matchedAddress: string): string {
  // Split on the first comma-space that precedes a city name.
  // The matched address format is always: "STREET, CITY, ST, ZIP"
  const parts = matchedAddress.split(',');
  return parts[0]?.trim() ?? matchedAddress;
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

/**
 * Call the Census Geocoder for a single address.
 * Returns null on any failure (5xx, timeout, no match).
 */
export async function censusGeocode(address: string): Promise<CensusGeocodeResult | null> {
  const params = new URLSearchParams({
    address,
    benchmark: 'Public_AR_Current',
    vintage:   'Current_Current',
    format:    'json',
  });
  const url = `${CENSUS_GEOCODER_URL}?${params.toString()}`;

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
    } catch (err: any) {
      const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err));
      logger.warn(`[census-geocoder] fetch error (attempt ${attempt + 1}): ${reason} — address: "${address}"`);
      return null; // network/timeout error → immediate fallback
    }

    if (resp.status === 429) {
      const delay = RETRY_DELAYS[attempt] ?? 8_000;
      logger.warn(`[census-geocoder] 429 rate-limit (attempt ${attempt + 1}), backing off ${delay}ms`);
      await sleep(delay);
      attempt++;
      continue;
    }

    if (!resp.ok) {
      logger.warn(`[census-geocoder] HTTP ${resp.status} (attempt ${attempt + 1}) — address: "${address}"`);
      return null; // 5xx → fallback
    }

    let data: any;
    try {
      data = await resp.json();
    } catch {
      logger.warn(`[census-geocoder] JSON parse error — address: "${address}"`);
      return null;
    }

    const matches: any[] = data?.result?.addressMatches ?? [];
    if (matches.length === 0) {
      logger.debug(`[census-geocoder] no match for "${address}"`);
      return null;
    }

    const match = matches[0];
    const matchedAddress: string = match.matchedAddress ?? '';
    const coords = match.coordinates ?? {};
    const lat = typeof coords.y === 'number' ? coords.y : null;
    const lng = typeof coords.x === 'number' ? coords.x : null;

    // County FIPS comes from geographies.Counties[0].GEOID (5-digit: state+county)
    const counties: any[] = match.geographies?.Counties ?? [];
    const countyFips: string | null = counties[0]?.GEOID ?? null;

    logger.debug(
      `[census-geocoder] matched "${address}" → "${matchedAddress}" | FIPS: ${countyFips ?? 'none'}`,
    );

    return {
      matchedAddress,
      streetOnly:  stripCityStateZip(matchedAddress),
      countyFips,
      lat:  lat ?? 0,
      lng:  lng ?? 0,
    };
  }

  logger.warn(`[census-geocoder] exhausted retries for "${address}"`);
  return null;
}
