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
 * Address-number tolerance used by both the WGS84 point and envelope paths.
 *
 * The Census geocoded point sometimes lands on a neighbouring parcel rather
 * than the exact target.  We accept a spatial result only when the parcel's
 * stored Address number is within ±ADDR_NUM_TOLERANCE of the input house
 * number, which filters out clear wrong-parcel hits (e.g. input=357 but
 * returned parcel Address starts with "115 HILLIARD ST", delta=242).
 *
 * ±50 is conservative enough to reject wrong streets while accommodating
 * rooftop-vs-centroid jitter (e.g. input=1050, stored=1054, delta=4).
 */
const ADDR_NUM_TOLERANCE = 50;

/**
 * Bounding-box half-width used for the envelope fallback (≈50 m at Atlanta's
 * latitude).  Identical to the constant used in the Cobb and DeKalb adapters.
 */
const ENVELOPE_BUF_DEG = 0.0005;

// ─── Envelope fallback ────────────────────────────────────────────────────────

/**
 * Secondary spatial fallback: issues a ±ENVELOPE_BUF_DEG bounding-box query
 * and accepts the result only when exactly ONE parcel whose Address number is
 * within ±ADDR_NUM_TOLERANCE of `inputStreetNum` is returned.
 *
 * Zero or multiple candidates → not_found (caller falls back to WHERE query).
 * Transport/parse errors → not_found (degrades gracefully; does not swallow
 * the error into a hard failure so the WHERE-clause path still runs).
 *
 * NOTE: In Atlanta's dense urban core this gate is almost never satisfiable —
 * empirical probes found 2–117 candidates within the envelope for most downtown
 * Fulton addresses.  The function is still provided so road-centerline misses in
 * lower-density Fulton areas (outer-city, Alpharetta, etc.) can benefit from
 * the same pattern used in Cobb County.
 */
async function queryParcelByEnvelope(
  lat: number,
  lng: number,
  inputStreetNum: number,
  inputKeyword: string | null,
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

  const { data, error } = await fetchFulton(`${FULTON_ARCGIS_URL}?${params.toString()}`);
  if (error) {
    // Degrade gracefully — envelope transport failure must not block WHERE fallback.
    logger.debug(`[fulton-ga] envelope fallback fetch error: ${error} — skipping`);
    return { status: 'not_found' };
  }

  const features: any[] = data?.features ?? [];

  const candidates = features.filter(f => {
    const storedAddr   = (f.attributes?.Address ?? '') as string;
    const storedNumStr = extractStreetNumber(storedAddr);
    if (!storedNumStr) return false;
    if (Math.abs(parseInt(storedNumStr, 10) - inputStreetNum) > ADDR_NUM_TOLERANCE) return false;
    // Also require that the stored address contains the input street keyword so that
    // two adjacent streets with similar house numbers don't collapse (e.g. "357 Auburn
    // Pointe Dr" vs "322 Decatur St", delta=35 ≤ 50 but streets are unrelated).
    if (inputKeyword && !storedAddr.toUpperCase().includes(inputKeyword.toUpperCase())) return false;
    return true;
  });

  if (candidates.length !== 1) {
    logger.debug(
      `[fulton-ga] envelope fallback: ${candidates.length} candidate(s) after AddrNumber filter` +
      ` (inputNum=${inputStreetNum}) — ${candidates.length === 0 ? 'no match' : 'ambiguous'}`,
    );
    return { status: 'not_found' };
  }

  const attrs: Record<string, any> = candidates[0].attributes ?? {};
  const mapped = mapAttrsToResult(attrs);

  logger.debug(
    `[fulton-ga] envelope fallback resolved → parcel ${mapped.parcel_id}, addr: ${attrs.Address}`,
  );

  return {
    status: mapped.parcel_id ? 'ok' : 'not_found',
    candidates: 1,
    ...mapped,
  };
}

// ─── WGS84 spatial intersect (point + envelope) ───────────────────────────────

/**
 * Two-stage spatial lookup using WGS84 lat/lng (WKID 4326).
 *
 * Stage 1 — point intersect:
 *   Issues an esriSpatialRelIntersects query with the Census-resolved coordinate.
 *   On a hit, validates that the returned parcel's Address number is within
 *   ±ADDR_NUM_TOLERANCE of the input house number to filter wrong-parcel returns.
 *   A valid match is returned immediately; an invalid-number hit is discarded.
 *
 * Stage 2 — envelope fallback (road-centerline misses):
 *   When Stage 1 returns 0 features (Census point lands in a street ROW gap),
 *   issues a ±ENVELOPE_BUF_DEG bounding-box query and applies the same
 *   AddrNumber filter.  Only accepted when exactly one candidate survives.
 *
 * Returns not_found on any non-fatal failure so the caller can fall back to the
 * address LIKE WHERE-clause query without losing the lookup entirely.
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
    geometryType:      'esriGeometryPoint',
    spatialRel:        'esriSpatialRelIntersects',
    inSR:              '4326',
    outFields:         OUT_FIELDS,
    resultRecordCount: '1',
    returnGeometry:    'false',
    f:                 'json',
  });

  const { data, error } = await fetchFulton(`${FULTON_ARCGIS_URL}?${params.toString()}`);
  if (error) return { status: 'not_found' };

  const features: any[] = data?.features ?? [];

  // Stage 1 hit — validate address-number proximity before accepting.
  if (features.length > 0) {
    const attrs: Record<string, any> = features[0].attributes ?? {};
    const inputStreetNumStr  = extractStreetNumber(normalizeAddress(inputAddress));
    const storedStreetNumStr = extractStreetNumber(attrs.Address ?? '');
    const inputNum  = inputStreetNumStr  ? parseInt(inputStreetNumStr,  10) : NaN;
    const storedNum = storedStreetNumStr ? parseInt(storedStreetNumStr, 10) : NaN;

    if (!isNaN(inputNum) && !isNaN(storedNum) && Math.abs(storedNum - inputNum) > ADDR_NUM_TOLERANCE) {
      logger.debug(
        `[fulton-ga] WGS84 point rejected: input num ${inputNum}, stored num ${storedNum}` +
        ` (delta ${Math.abs(storedNum - inputNum)} > ${ADDR_NUM_TOLERANCE}) — trying envelope`,
      );
      // Fall through to Stage 2 — point landed on wrong parcel.
    } else {
      const mapped = mapAttrsToResult(attrs);
      logger.debug(
        `[fulton-ga] WGS84 point resolved → parcel ${mapped.parcel_id}, addr: ${attrs.Address}`,
      );
      return {
        status:     mapped.parcel_id ? 'ok' : 'not_found',
        candidates: features.length,
        ...mapped,
      };
    }
  }

  // Stage 2 — envelope fallback for ROW misses (0 features) or number-mismatch rejects.
  const inputStreetNumStr = extractStreetNumber(normalizeAddress(inputAddress));
  const inputNum = inputStreetNumStr ? parseInt(inputStreetNumStr, 10) : NaN;

  if (!isNaN(inputNum)) {
    const inputKeyword = extractStreetKeyword(normalizeAddress(inputAddress)) ?? null;
    logger.debug(`[fulton-ga] WGS84 point miss — trying envelope fallback (inputNum=${inputNum}, keyword=${inputKeyword})`);
    return queryParcelByEnvelope(lat, lng, inputNum, inputKeyword);
  }

  return { status: 'not_found' };
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
