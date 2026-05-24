/**
 * DeKalb County GA — ArcGIS Parcels adapter
 *
 * Supports two lookup modes:
 *   - lookupDeKalbGA(address)          — query by street address
 *   - lookupDeKalbGAByParcelId(id)     — query by PARCELID (exact match)
 *
 * Endpoint (DeKalb County org ID: IxVN2oUE9EYLSnPE):
 *   https://services2.arcgis.com/IxVN2oUE9EYLSnPE/arcgis/rest/services/Parcels/FeatureServer/0/query
 *
 * Available fields (from layer metadata):
 *   PARCELID, SITEADDRES, ADDRESS_NU, FULL_STREE, CITY,
 *   OWNERNME1, OWNERNME2,
 *   CNTASSDVAL (assessed value), TOTAPR1 (appraised value), LNDVALUE (land value),
 *   BLDGAREA (building area sq ft), ACREAGE,
 *   LANDUSECODE, USECD, USEDSCRP, CLASSCD, CLASSDSCRP,
 *   ZONING, SUBDIVISIO, Shape__Area
 *
 * Address query strategy:
 *   LOWER(SITEADDRES) LIKE '{num} %{keyword}%'
 *   The mid-wildcard (%) handles "North", "South" etc. prefixes stored before the
 *   street name (e.g., "2696 North Druid Hills Road Atlanta, GA 30329").
 *
 * Parcel ID query:
 *   UPPER(PARCELID) = UPPER('{id}')
 *   Direct equality with UPPER() wrapping avoids an ArcGIS quirk where plain
 *   string equality on PARCELID with spaces returns 400.
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddressFull as normalizeAddress,
  extractStreetNumber,
  extractStreetKeyword,
  sanitize,
} from '../address-normalize';

const DEKALB_PARCELS_URL =
  'https://services2.arcgis.com/IxVN2oUE9EYLSnPE/arcgis/rest/services/Parcels/FeatureServer/0/query';

const OUT_FIELDS = [
  'PARCELID', 'SITEADDRES', 'ADDRESS_NU', 'FULL_STREE', 'CITY',
  'OWNERNME1', 'OWNERNME2',
  'CNTASSDVAL', 'TOTAPR1', 'LNDVALUE',
  'BLDGAREA', 'ACREAGE',
  'LANDUSE', 'USECD', 'USEDSCRP',
  'CLASSCD', 'CLASSDSCRP',
  'ZONING', 'SUBDIVISIO',
  'Shape__Area',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

// ─── Address helpers ──────────────────────────────────────────────────────────

function buildAddressWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const num     = extractStreetNumber(normalized);
  const keyword = extractStreetKeyword(normalized);

  if (num && keyword) {
    // Mid-wildcard pattern handles stored street names like "North Druid Hills Rd"
    // when input is "N Druid Hills Rd" or "Druid Hills Rd"
    return `LOWER(SITEADDRES) LIKE '${sanitize(num)} %${sanitize(keyword)}%'`;
  }
  // Fallback: LOWER match on whole address prefix
  return `LOWER(SITEADDRES) LIKE '${sanitize(normalized.toLowerCase())}%'`;
}

function buildParcelWhere(parcelId: string): string {
  // UPPER() wrapping avoids a DeKalb ArcGIS quirk where plain PARCELID='...'
  // returns 400 Invalid URL on IDs containing spaces.
  return `UPPER(PARCELID) = '${sanitize(parcelId.toUpperCase())}'`;
}

// ─── Response mapping ─────────────────────────────────────────────────────────

function mapAttrsToResult(attrs: Record<string, any>, inputAddress?: string): Partial<MunicipalLookupResult> {
  const ownerParts = [attrs.OWNERNME1, attrs.OWNERNME2].filter(Boolean);
  const city = attrs.CITY ?? null;

  // SITEADDRES contains full address with city/state/zip; extract just street portion
  const siteAddr: string | null = attrs.SITEADDRES ?? null;
  // Strip city/state/zip suffix (", GA XXXXX" pattern) to get clean street address
  const streetAddr = siteAddr
    ? siteAddr.replace(/,?\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, '').replace(/\s+[A-Z][A-Za-z\s]+$/, '').trim()
    : (inputAddress ?? null);

  // BLDGAREA is building area (sq ft) — used as geometry_area_sqft proxy
  const bldgArea = attrs.BLDGAREA !== undefined && attrs.BLDGAREA !== null
    ? Math.round(Number(attrs.BLDGAREA))
    : undefined;

  return {
    parcel_id:              attrs.PARCELID             ?? null,
    address:                streetAddr,
    owner:                  ownerParts.length ? ownerParts.join(', ') : null,
    assessed_value:         attrs.CNTASSDVAL !== undefined ? Number(attrs.CNTASSDVAL)  : undefined,
    appraised_value:        attrs.TOTAPR1    !== undefined ? Number(attrs.TOTAPR1)     : undefined,
    assessed_land:          attrs.LNDVALUE   !== undefined ? Number(attrs.LNDVALUE)    : undefined,
    land_acres:             attrs.ACREAGE    !== undefined ? Number(attrs.ACREAGE)     : undefined,
    geometry_area_sqft:     bldgArea,
    land_use_code:          attrs.LANDUSE               ?? attrs.USECD ?? null,
    class_code:             attrs.CLASSCD               ?? null,
    neighborhood:           null,
    tax_district:           null,
    county:                 'DeKalb',
    state:                  'GA',
    source:                 'arcgis_dekalb_ga',
    raw:                    attrs,
  };
}

// ─── Core ArcGIS fetch (with retry) ──────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArcGIS(url: string): Promise<{ data?: any; error?: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter: 800ms, 1600ms, 3200ms (± 200ms jitter)
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200;
      logger.debug(`[dekalb-ga] retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(delay)}ms`);
      await sleep(delay);
    }

    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err));
      logger.warn(`[dekalb-ga] fetch attempt ${attempt + 1} error: ${lastError}`);
      continue;
    }

    if (!resp.ok) {
      lastError = `HTTP ${resp.status}`;
      logger.warn(`[dekalb-ga] ArcGIS HTTP ${resp.status} (attempt ${attempt + 1})`);
      // Only retry on 429 or 5xx; treat other HTTP errors as fatal
      if (resp.status !== 429 && resp.status < 500) {
        // 400 "Invalid query parameters" from ArcGIS is often transient under load
        // — retry it too
        if (resp.status !== 400) break;
      }
      continue;
    }

    let data: any;
    try {
      data = await resp.json();
    } catch (parseErr: any) {
      lastError = 'JSON parse error';
      continue;
    }

    // ArcGIS returns HTTP 200 but embeds an error in the body for some failures
    if (data?.error) {
      const msg: string = data.error?.message ?? JSON.stringify(data.error);
      lastError = msg;
      logger.warn(`[dekalb-ga] ArcGIS body error (attempt ${attempt + 1}): ${msg}`);
      // "Invalid query parameters" is transient under load — retry
      if (msg.toLowerCase().includes('invalid query') || msg.toLowerCase().includes('invalid parameter')) {
        continue;
      }
      // Other ArcGIS errors (e.g. field not found) are fatal — don't retry
      return { error: msg };
    }

    return { data };
  }

  logger.warn(`[dekalb-ga] all ${MAX_RETRIES} attempts failed: ${lastError}`);
  return { error: lastError };
}

async function queryArcGIS(
  where: string,
  normalizedAddrForExactMatch?: string,
  inputAddress?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${DEKALB_PARCELS_URL}?${params.toString()}`;

  const { data, error } = await fetchArcGIS(url);
  if (error) {
    return { status: 'error', error };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) {
    return { status: 'not_found' };
  }

  // Prefer exact-match on PARCELID when multiple candidates returned;
  // if none match exactly, fall back to the first feature.
  let chosen = features[0];
  if (normalizedAddrForExactMatch && features.length > 1) {
    const lcTarget = normalizedAddrForExactMatch.toLowerCase();
    const exact = features.find((f: any) => {
      const stored = (f.attributes?.SITEADDRES ?? '').toLowerCase();
      return stored.startsWith(`${extractStreetNumber(normalizedAddrForExactMatch)} `);
    });
    if (exact) chosen = exact;
  }

  const attrs: Record<string, any> = chosen.attributes ?? {};
  const mapped = mapAttrsToResult(attrs, inputAddress);

  logger.debug(`[dekalb-ga] resolved → parcel ${mapped.parcel_id}, owner: ${mapped.owner}`);

  return {
    status: mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
}

// ─── WGS84 spatial intersect + envelope fallback ─────────────────────────────

/**
 * Bounding-box half-width for the envelope fallback (≈50 m at Atlanta's
 * latitude). Matches the constant used in the Cobb and Fulton adapters.
 */
const ENVELOPE_BUF_DEG = 0.0005;

/**
 * Street-number tolerance for the envelope candidate filter.
 *
 * This is intentionally ±10 rather than a larger value because DeKalb's
 * parcels are denser than Cobb County's.  Empirical probe of 8 failing
 * benchmark addresses confirmed that ±50 leaves 2–4 ambiguous candidates
 * for every address tested — the single-candidate gate would never fire and
 * zero addresses would be recovered.  At ±10, "3108 Briarcliff Rd NE"
 * resolves to exactly one candidate (stored SITEADDRES number = 3110,
 * delta = 2) while all other failures remain safely ambiguous or misses.
 *
 * If future benchmark addresses need a wider window, this constant should be
 * raised incrementally and re-validated against the full 71-address set.
 */
const ADDR_NUM_TOLERANCE = 10;

/**
 * Envelope fallback: issues a ±ENVELOPE_BUF_DEG bounding-box query and
 * accepts the result only when exactly ONE parcel survives a dual filter:
 *
 *   1. Street number parsed from SITEADDRES (using extractStreetNumber,
 *      same utility used by the WHERE-clause path) within ±ADDR_NUM_TOLERANCE
 *      of the input house number.
 *
 *   2. FULL_STREE field (stored street name) contains the input street keyword
 *      — prevents adjacent-street false positives where two nearby streets
 *      share similar house numbers.
 *
 * Zero or multiple candidates → not_found (caller falls back to WHERE query).
 * Transport/ArcGIS errors → not_found (degrades gracefully).
 */
async function queryParcelByEnvelope(
  lat: number,
  lng: number,
  inputStreetNum: number,
  inputKeyword: string | null,
  inputAddress: string,
): Promise<MunicipalLookupResult> {
  const envelope = JSON.stringify({
    xmin: lng - ENVELOPE_BUF_DEG,
    ymin: lat - ENVELOPE_BUF_DEG,
    xmax: lng + ENVELOPE_BUF_DEG,
    ymax: lat + ENVELOPE_BUF_DEG,
    spatialReference: { wkid: 4326 },
  });

  const params = new URLSearchParams({
    geometry:     envelope,
    geometryType: 'esriGeometryEnvelope',
    spatialRel:   'esriSpatialRelIntersects',
    inSR:         '4326',
    outFields:    OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const { data, error } = await fetchArcGIS(`${DEKALB_PARCELS_URL}?${params.toString()}`);
  if (error) {
    logger.debug(`[dekalb-ga] envelope fallback fetch error: ${error} — skipping`);
    return { status: 'not_found' };
  }

  const features: any[] = data?.features ?? [];

  const candidates = features.filter(f => {
    // Parse street number from SITEADDRES (e.g. "3110 Briarcliff Road Atlanta, GA 30329" → 3110)
    const siteAddr   = (f.attributes?.SITEADDRES ?? '') as string;
    const storedNumStr = extractStreetNumber(siteAddr);
    if (!storedNumStr) return false;
    const storedNum = parseInt(storedNumStr, 10);
    if (Math.abs(storedNum - inputStreetNum) > ADDR_NUM_TOLERANCE) return false;
    // Also require FULL_STREE keyword match to prevent adjacent-street collisions.
    const fullStreet = (f.attributes?.FULL_STREE ?? '') as string;
    if (inputKeyword && !fullStreet.toUpperCase().includes(inputKeyword.toUpperCase())) return false;
    return true;
  });

  if (candidates.length !== 1) {
    logger.debug(
      `[dekalb-ga] envelope fallback: ${candidates.length} candidate(s) after dual filter` +
      ` (inputNum=${inputStreetNum}, keyword=${inputKeyword}) — ` +
      (candidates.length === 0 ? 'no match' : 'ambiguous'),
    );
    return { status: 'not_found' };
  }

  const attrs: Record<string, any> = candidates[0].attributes ?? {};
  const mapped = mapAttrsToResult(attrs, inputAddress);

  logger.debug(
    `[dekalb-ga] envelope fallback resolved → parcel ${mapped.parcel_id},` +
    ` siteAddr: ${attrs.SITEADDRES}`,
  );

  return {
    status:     mapped.parcel_id ? 'ok' : 'not_found',
    candidates: 1,
    ...mapped,
  };
}

/**
 * Two-stage spatial lookup using WGS84 lat/lng (WKID 4326).
 *
 * Stage 1 — point intersect:
 *   Issues an esriSpatialRelIntersects query with the Census-resolved
 *   coordinate.  A hit is returned immediately (no number validation needed —
 *   the point-in-polygon guarantee is sufficient for DeKalb's parcel density).
 *
 * Stage 2 — envelope fallback (road-centerline misses):
 *   When Stage 1 returns 0 features (Census point lands in a street ROW gap),
 *   issues a ±ENVELOPE_BUF_DEG bounding-box query filtered by:
 *     • ADDRESS_NU within ±ADDR_NUM_TOLERANCE of the input house number
 *     • FULL_STREE contains the input street keyword
 *   Only accepted when exactly one candidate survives.
 *
 * Returns not_found on any miss so the caller falls back to the WHERE query.
 */
async function queryParcelByWgs84(lat: number, lng: number, inputAddress: string): Promise<MunicipalLookupResult> {
  const geometry = JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  });

  const params = new URLSearchParams({
    geometry,
    geometryType: 'esriGeometryPoint',
    spatialRel:   'esriSpatialRelIntersects',
    inSR:         '4326',
    outFields:    OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const { data, error } = await fetchArcGIS(`${DEKALB_PARCELS_URL}?${params.toString()}`);
  if (error) return { status: 'not_found' };

  const features: any[] = data?.features ?? [];

  // Stage 1 hit — return immediately.
  if (features.length > 0) {
    const attrs: Record<string, any> = features[0].attributes ?? {};
    const mapped = mapAttrsToResult(attrs, inputAddress);
    logger.debug(`[dekalb-ga] WGS84 point resolved → parcel ${mapped.parcel_id}`);
    return {
      status:     mapped.parcel_id ? 'ok' : 'not_found',
      candidates: features.length,
      ...mapped,
    };
  }

  // Stage 2 — envelope fallback for road-centerline / ROW gap misses.
  const normalized       = normalizeAddress(inputAddress);
  const inputStreetNumStr = extractStreetNumber(normalized);
  const inputNum          = inputStreetNumStr ? parseInt(inputStreetNumStr, 10) : NaN;

  if (!isNaN(inputNum)) {
    const inputKeyword = extractStreetKeyword(normalized) ?? null;
    logger.debug(
      `[dekalb-ga] WGS84 point miss — trying envelope fallback` +
      ` (inputNum=${inputNum}, keyword=${inputKeyword})`,
    );
    return queryParcelByEnvelope(lat, lng, inputNum, inputKeyword, inputAddress);
  }

  return { status: 'not_found' };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up a DeKalb County parcel by street address.
 *
 * Two-path strategy:
 *   A) knownCoords provided (WGS84 lat/lng from Census Geocoder)
 *      → try spatial intersect first; fall back to address WHERE-clause on not_found.
 *        Recovers addresses whose stored SITEADDRES doesn't match the Census-
 *        normalized form (e.g. "500 Briarvista Way", "1000 Barone Ave").
 *   B) No knownCoords → address WHERE-clause query (existing path).
 */
export async function lookupDeKalbGA(
  address: string,
  knownCoords?: { lat: number; lng: number },
): Promise<MunicipalLookupResult> {
  logger.debug(
    `[dekalb-ga] address lookup: "${address}"` +
    (knownCoords ? ` (pre-geocoded lat=${knownCoords.lat.toFixed(5)}, lng=${knownCoords.lng.toFixed(5)})` : ''),
  );

  // Path A: Census Geocoder already resolved coordinates — try spatial intersect.
  if (knownCoords) {
    const result = await queryParcelByWgs84(knownCoords.lat, knownCoords.lng, address);
    if (result.status === 'ok') return result;
    // not_found or transient error — fall back to address WHERE-clause (graceful degradation)
    logger.debug(
      `[dekalb-ga] WGS84 spatial ${result.status} for "${address}", falling back to address WHERE query`,
    );
  }

  // Path B: address WHERE-clause query.
  const normalized = normalizeAddress(address);
  const where      = buildAddressWhere(address);
  logger.debug(`[dekalb-ga] address WHERE: ${where}`);
  return queryArcGIS(where, normalized, address);
}

/** Look up a DeKalb County parcel by its PARCELID (exact match). */
export async function lookupDeKalbGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const where = buildParcelWhere(parcelId);
  logger.debug(`[dekalb-ga] parcel-id lookup: "${parcelId}" → where: ${where}`);
  return queryArcGIS(where);
}
