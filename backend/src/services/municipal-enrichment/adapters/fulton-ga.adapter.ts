/**
 * Fulton County GA — ArcGIS Tax Parcels adapter
 *
 * Supports two lookup modes:
 *   - lookupFultonGA(address)       — query by street address
 *   - lookupFultonGAByParcelId(id)  — query by ParcelID (exact match)
 *
 * Endpoint (corrected org-ID from Task #980):
 *   https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query
 *
 * Available fields (from layer metadata):
 *   Address, AddrNumber, AddrStreet, AddrSuffix, AddrPreDir, AddrPosDir,
 *   Owner, OwnerAddr1, OwnerAddr2, TaxDist,
 *   TotAssess, LandAssess, ImprAssess, TotAppr, LandAppr, ImprAppr,
 *   LUCode, ClassCode, LivUnits, LandAcres,
 *   NbrHood, Subdiv, SubdivNum, SubdivLot, SubdivBlck,
 *   ParcelID, Shape__Area
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddressFull as normalizeAddress,
  extractStreetNumber,
  extractStreetKeyword,
  sanitize,
} from '../address-normalize';

const FULTON_ARCGIS_URL =
  'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query';

const OUT_FIELDS = [
  'Address', 'ParcelID',
  'Owner', 'OwnerAddr1', 'OwnerAddr2',
  'TotAssess', 'LandAssess', 'ImprAssess',
  'TotAppr', 'LandAppr', 'ImprAppr',
  'TaxDist', 'LivUnits', 'LandAcres',
  'LUCode', 'ClassCode', 'NbrHood',
  'Subdiv', 'SubdivNum', 'SubdivLot', 'SubdivBlck',
  'Shape__Area',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

// ─── Address helpers ──────────────────────────────────────────────────────────

function buildAddressWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const keyword    = extractStreetKeyword(normalized);

  // Mid-wildcard on the keyword (DeKalb-style): avoids prefix-directional
  // mismatches where Fulton stores "WEST PEACHTREE" but Census returns "W PEACHTREE".
  if (streetNum && keyword) {
    return `UPPER(Address) LIKE '${sanitize(streetNum.toUpperCase())} %${sanitize(keyword.toUpperCase())}%'`;
  }
  return `UPPER(Address) LIKE '${sanitize(normalized.toUpperCase())}%'`;
}

function buildParcelWhere(parcelId: string): string {
  return `ParcelID = '${sanitize(parcelId)}'`;
}

// ─── Response mapping ─────────────────────────────────────────────────────────

function buildLegalDescription(attrs: Record<string, any>): string | null {
  const parts: string[] = [];
  if (attrs.Subdiv)      parts.push(`Subdivision: ${attrs.Subdiv}`);
  if (attrs.SubdivNum)   parts.push(`#${attrs.SubdivNum}`);
  if (attrs.SubdivLot)   parts.push(`Lot ${attrs.SubdivLot}`);
  if (attrs.SubdivBlck)  parts.push(`Block ${attrs.SubdivBlck}`);
  return parts.length ? parts.join(', ') : null;
}

function mapAttrsToResult(attrs: Record<string, any>): Partial<MunicipalLookupResult> {
  const ownerParts = [attrs.OwnerAddr1, attrs.OwnerAddr2].filter(Boolean);

  return {
    parcel_id:              attrs.ParcelID    ?? null,
    address:                attrs.Address     ?? null,
    owner:                  attrs.Owner       ?? null,
    owner_address:          ownerParts.length ? ownerParts.join(', ') : null,
    legal_description:      buildLegalDescription(attrs),
    subdivision:            attrs.Subdiv      ?? null,
    subdivision_lot:        attrs.SubdivLot   ?? null,
    subdivision_block:      attrs.SubdivBlck  ?? null,
    assessed_value:         attrs.TotAssess   !== undefined ? Number(attrs.TotAssess)   : undefined,
    appraised_value:        attrs.TotAppr     !== undefined ? Number(attrs.TotAppr)     : undefined,
    assessed_land:          attrs.LandAssess  !== undefined ? Number(attrs.LandAssess)  : undefined,
    assessed_improvement:   attrs.ImprAssess  !== undefined ? Number(attrs.ImprAssess)  : undefined,
    appraised_land:         attrs.LandAppr    !== undefined ? Number(attrs.LandAppr)    : undefined,
    land_acres:             attrs.LandAcres   !== undefined ? Number(attrs.LandAcres)   : undefined,
    geometry_area_sqft:     attrs.Shape__Area !== undefined ? Math.round(Number(attrs.Shape__Area)) : undefined,
    units:                  (attrs.LivUnits && Number(attrs.LivUnits) > 0) ? Number(attrs.LivUnits) : undefined,
    land_use_code:          attrs.LUCode      ?? null,
    class_code:             attrs.ClassCode   ?? null,
    neighborhood:           attrs.NbrHood     ?? null,
    tax_district:           attrs.TaxDist     ?? null,
    county:                 'Fulton',
    state:                  'GA',
    source:                 'arcgis_fulton_ga_2025',
    raw:                    attrs,
  };
}

// ─── Core ArcGIS fetch ────────────────────────────────────────────────────────

async function fetchFulton(url: string): Promise<{ data?: any; error?: string }> {
  let data: any;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      logger.warn(`[fulton-ga] ArcGIS HTTP ${resp.status}`);
      return { error: `HTTP ${resp.status}` };
    }

    data = await resp.json() as any;
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err));
    logger.warn(`[fulton-ga] fetch error: ${msg}`);
    return { error: msg };
  }

  if (data?.error) {
    logger.warn(`[fulton-ga] ArcGIS error: ${data.error.message}`);
    return { error: data.error.message };
  }

  return { data };
}

async function queryArcGIS(
  where: string,
  normalizedAddrForExactMatch?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const { data, error } = await fetchFulton(`${FULTON_ARCGIS_URL}?${params.toString()}`);
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) {
    return { status: 'not_found' };
  }

  // Prefer exact-match address when multiple features returned; fall back to first
  let chosen = features[0];
  if (normalizedAddrForExactMatch && features.length > 1) {
    const exact = features.find((f: any) =>
      normalizeAddress(f.attributes?.Address ?? '') === normalizedAddrForExactMatch
    );
    if (exact) chosen = exact;
  }

  const attrs: Record<string, any> = chosen.attributes ?? {};
  const mapped = mapAttrsToResult(attrs);

  logger.debug(`[fulton-ga] resolved → parcel ${mapped.parcel_id}, owner: ${mapped.owner}`);

  return {
    status: mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
}

// ─── WGS84 spatial intersect ──────────────────────────────────────────────────

/**
 * Address-number tolerance for WGS84 spatial intersect validation.
 *
 * The Census geocoded point sometimes lands on a neighbouring parcel rather
 * than the exact target.  We accept the spatial result only when the parcel's
 * stored Address number is within ±ADDR_NUM_TOLERANCE of the input house
 * number, which filters out clear wrong-parcel misses (e.g. input=357 but
 * returned parcel Address starts with "115 HILLIARD ST").
 *
 * ±50 is conservative enough to reject wrong streets while accommodating
 * rooftop-vs-centroid jitter (e.g. input=1050, stored=1054).
 */
const ADDR_NUM_TOLERANCE = 50;

/**
 * Spatial intersect using WGS84 lat/lng (WKID 4326).
 * Used when Census Geocoder already provided coordinates — skips the
 * address LIKE query entirely.
 *
 * Returns not_found when the spatial result's Address number differs from
 * the input house number by more than ADDR_NUM_TOLERANCE, so the caller
 * can fall back to the WHERE-clause query without accepting a wrong parcel.
 *
 * Note: envelope fallback is intentionally omitted for Fulton.  Atlanta's
 * dense urban parcel grid produces 100+ parcels with similar address numbers
 * in a 50m radius, making the single-candidate gate never satisfiable.
 */
async function queryParcelByWgs84(
  lat: number,
  lng: number,
  inputAddress: string,
): Promise<MunicipalLookupResult> {
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
    resultRecordCount: '1',
    returnGeometry: 'false',
    f: 'json',
  });

  const { data, error } = await fetchFulton(`${FULTON_ARCGIS_URL}?${params.toString()}`);
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  const attrs: Record<string, any> = features[0].attributes ?? {};
  const mapped = mapAttrsToResult(attrs);

  // Validate address-number proximity to guard against wrong-parcel returns.
  // extractStreetNumber returns the leading numeric token from the stored Address.
  const inputStreetNumStr  = extractStreetNumber(normalizeAddress(inputAddress));
  const storedStreetNumStr = extractStreetNumber(attrs.Address ?? '');
  const inputNum  = inputStreetNumStr  ? parseInt(inputStreetNumStr,  10) : NaN;
  const storedNum = storedStreetNumStr ? parseInt(storedStreetNumStr, 10) : NaN;

  if (!isNaN(inputNum) && !isNaN(storedNum)) {
    const delta = Math.abs(storedNum - inputNum);
    if (delta > ADDR_NUM_TOLERANCE) {
      logger.debug(
        `[fulton-ga] WGS84 spatial rejected: input num ${inputNum}, stored num ${storedNum}` +
        ` (delta ${delta} > ${ADDR_NUM_TOLERANCE}) — falling back to WHERE query`,
      );
      return { status: 'not_found' };
    }
  }

  logger.debug(
    `[fulton-ga] WGS84 spatial resolved → parcel ${mapped.parcel_id}, addr: ${attrs.Address}`,
  );

  return {
    status:     mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up a Fulton County parcel by street address.
 *
 * Two-path strategy:
 *   A) knownCoords provided (WGS84 lat/lng from Census Geocoder)
 *      → try WGS84 spatial intersect first; validate returned parcel's Address
 *        number is within ±ADDR_NUM_TOLERANCE of the input house number to
 *        prevent wrong-parcel false positives; fall back to WHERE query on miss.
 *   B) No knownCoords → address LIKE WHERE query (existing path).
 */
export async function lookupFultonGA(
  address: string,
  knownCoords?: { lat: number; lng: number },
): Promise<MunicipalLookupResult> {
  logger.debug(
    `[fulton-ga] address lookup: "${address}"` +
    (knownCoords ? ` (pre-geocoded lat=${knownCoords.lat.toFixed(5)}, lng=${knownCoords.lng.toFixed(5)})` : ''),
  );

  // Path A: Census Geocoder already resolved coordinates — try spatial intersect.
  if (knownCoords) {
    const result = await queryParcelByWgs84(knownCoords.lat, knownCoords.lng, address);
    if (result.status === 'ok') return result;
    // not_found (miss or number-mismatch guard) or error → fall back gracefully
    logger.debug(
      `[fulton-ga] WGS84 spatial ${result.status} for "${address}", falling back to WHERE query`,
    );
  }

  // Path B: address LIKE WHERE query.
  const normalized = normalizeAddress(address);
  const where      = buildAddressWhere(address);
  logger.debug(`[fulton-ga] address WHERE: ${where}`);
  return queryArcGIS(where, normalized);
}

/** Look up a Fulton County parcel by its ParcelID (exact match). */
export async function lookupFultonGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const where = buildParcelWhere(parcelId);
  logger.debug(`[fulton-ga] parcel-id lookup: "${parcelId}" → where: ${where}`);
  return queryArcGIS(where);
}
