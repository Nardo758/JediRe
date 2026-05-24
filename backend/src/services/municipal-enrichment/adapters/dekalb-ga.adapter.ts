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

// ─── WGS84 spatial intersect ──────────────────────────────────────────────────

/**
 * Spatial intersect using WGS84 lat/lng (WKID 4326).
 * Used when Census Geocoder already provided coordinates — skips the address
 * WHERE-clause search entirely.  ArcGIS auto-reprojects from 4326 to the
 * layer's native SR via the inSR parameter.
 *
 * Recovers addresses whose Census-normalized form doesn't match the stored
 * SITEADDRES string but whose geocoded point falls inside the parcel polygon.
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

  const url = `${DEKALB_PARCELS_URL}?${params.toString()}`;
  const { data, error } = await fetchArcGIS(url);
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  const attrs: Record<string, any> = features[0].attributes ?? {};
  const mapped = mapAttrsToResult(attrs, inputAddress);

  logger.debug(`[dekalb-ga] WGS84 spatial resolved → parcel ${mapped.parcel_id}`);

  return {
    status:     mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
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
