/**
 * Cobb County GA — ArcGIS Parcels adapter (with assessment enrichment)
 *
 * Supports two lookup modes:
 *   - lookupCobbGA(address)          — geocode address → spatial intersect CobbParcels → enrich
 *   - lookupCobbGAByParcelId(id)     — query CobbParcels by PIN → enrich
 *
 * Two-step address lookup strategy:
 *   1. CAM_Locator geocoder (no auth required) converts address → X, Y
 *      in WKID 2240 (NAD83 / Georgia State Plane West, US Survey Feet).
 *      Endpoint: https://gis.cobbcounty.org/gisserver/rest/services/locators/CAM_Locator/GeocodeServer
 *   2. CobbParcels FeatureServer spatial intersect finds the parcel polygon
 *      that contains the geocoded point. ArcGIS auto-reprojects from inSR 2240
 *      to the layer's native WKID 102100 (Web Mercator).
 *      Endpoint: https://services.arcgis.com/HYLRafMc4Ux6DA8c/arcgis/rest/services/CobbParcels/FeatureServer/0/query
 *
 * Assessment enrichment (step 3 — best-effort, non-blocking):
 *   After the PIN is resolved, a secondary query to the Cobb County Tax Assessors
 *   daily-updated MapServer layer fetches owner and valuation data keyed by PIN.
 *   Endpoint: https://gis.cobbcounty.org/gisserver/rest/services/tax/taxassessorsdaily/MapServer/0/query
 *   If this query fails, the result still returns status:'ok' with the geometry data
 *   from CobbParcels (owner/value fields are simply omitted).
 *
 * CobbParcels fields (public GIS layer — geometry + classification):
 *   PIN, PARCEL_ID, CLASS (land use class code), LAND_SQFT, ACRE_DEEDE,
 *   TAX_DIST, NBHDSUBD_I (neighborhood+subdivision ID), ST_NUMBER
 *
 * taxassessorsdaily fields (assessment layer — daily refresh):
 *   PIN, SITUS_ADDR                            — parcel address
 *   OWNER_NAM1, OWNER_NAM2                     — owner names
 *   OWNER_ADDR, OWNER_CITY, OWNER_STAT, OWNER_ZIP — owner mailing address
 *   FMV_LAND, FMV_BLDG, FMV_TOTAL             — appraised (fair market) values
 *   ASV_LAND, ASV_BLDG, ASV_TOTAL             — assessed values
 *   ACRE_DEEDED, CLASS, TAXDIST               — acreage, class, tax district
 *
 * Parcel ID query strategy (lookupCobbGAByParcelId):
 *   PIN = '{id}'  (direct equality; Cobb PINs are numeric strings, no spaces)
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';

// ─── Endpoints ────────────────────────────────────────────────────────────────

const CAM_LOCATOR_URL =
  'https://gis.cobbcounty.org/gisserver/rest/services/locators/CAM_Locator/GeocodeServer/findAddressCandidates';

const COBB_PARCELS_URL =
  'https://services.arcgis.com/HYLRafMc4Ux6DA8c/arcgis/rest/services/CobbParcels/FeatureServer/0/query';

const COBB_TAX_ASSESSORS_DAILY_URL =
  'https://gis.cobbcounty.org/gisserver/rest/services/tax/taxassessorsdaily/MapServer/0/query';

const PARCEL_OUT_FIELDS = [
  'PIN', 'PARCEL_ID', 'CLASS', 'LAND_SQFT', 'ACRE_DEEDE', 'ACRE_CALC',
  'TAX_DIST', 'NBHDSUBD_I', 'ST_NUMBER',
].join(',');

const ASSESSMENT_OUT_FIELDS = [
  'PIN', 'SITUS_ADDR',
  'OWNER_NAM1', 'OWNER_NAM2',
  'OWNER_ADDR', 'OWNER_CITY', 'OWNER_STAT', 'OWNER_ZIP',
  'FMV_LAND', 'FMV_BLDG', 'FMV_TOTAL',
  'ASV_LAND', 'ASV_BLDG', 'ASV_TOTAL',
  'ACRE_DEEDED', 'CLASS', 'TAXDIST',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

// ─── Retry helpers ────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, tag: string): Promise<{ data?: any; error?: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200;
      logger.debug(`[cobb-ga] ${tag} retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(delay)}ms`);
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
      logger.warn(`[cobb-ga] ${tag} fetch attempt ${attempt + 1} error: ${lastError}`);
      continue;
    }

    if (!resp.ok) {
      lastError = `HTTP ${resp.status}`;
      logger.warn(`[cobb-ga] ${tag} HTTP ${resp.status} (attempt ${attempt + 1})`);
      if (resp.status !== 429 && resp.status < 500 && resp.status !== 400) break;
      continue;
    }

    let data: any;
    try {
      data = await resp.json();
    } catch {
      lastError = 'JSON parse error';
      continue;
    }

    if (data?.error) {
      const msg: string = data.error?.message ?? JSON.stringify(data.error);
      lastError = msg;
      logger.warn(`[cobb-ga] ${tag} ArcGIS body error (attempt ${attempt + 1}): ${msg}`);
      if (msg.toLowerCase().includes('invalid query') || msg.toLowerCase().includes('invalid parameter')) {
        continue;
      }
      return { error: msg };
    }

    return { data };
  }

  logger.warn(`[cobb-ga] ${tag} all ${MAX_RETRIES} attempts failed: ${lastError}`);
  return { error: lastError };
}

// ─── Geocode step ─────────────────────────────────────────────────────────────

interface GeocodedPoint {
  x: number;
  y: number;
  matchAddr: string;
  score: number;
}

async function geocodeAddress(address: string): Promise<{ point?: GeocodedPoint; error?: string }> {
  const params = new URLSearchParams({
    SingleLine: address,
    outFields: 'X,Y,Match_addr,Score',
    maxLocations: '3',
    f: 'json',
  });

  const url = `${CAM_LOCATOR_URL}?${params.toString()}`;
  const { data, error } = await fetchWithRetry(url, 'geocode');
  if (error) return { error };

  const candidates: any[] = data?.candidates ?? [];
  if (candidates.length === 0) return { error: 'no_candidates' };

  // Pick highest-scoring candidate
  const best = candidates.reduce((a: any, b: any) =>
    (b.score ?? 0) > (a.score ?? 0) ? b : a
  );

  const attrs = best.attributes ?? {};
  const x = typeof attrs.X === 'number' ? attrs.X : best.location?.x;
  const y = typeof attrs.Y === 'number' ? attrs.Y : best.location?.y;

  if (!x || !y) return { error: 'no_coordinates' };

  return {
    point: {
      x,
      y,
      matchAddr: attrs.Match_addr ?? best.address ?? address,
      score: best.score ?? 0,
    },
  };
}

// ─── Assessment enrichment (taxassessorsdaily) ────────────────────────────────

/**
 * Fetch owner and valuation data from the Cobb County Tax Assessors daily layer.
 * Returns null on any failure — caller treats this as a graceful degradation.
 */
async function fetchAssessmentByPin(pin: string): Promise<Record<string, any> | null> {
  const params = new URLSearchParams({
    where: `PIN='${pin.replace(/'/g, "''")}'`,
    outFields: ASSESSMENT_OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${COBB_TAX_ASSESSORS_DAILY_URL}?${params.toString()}`;
  const { data, error } = await fetchWithRetry(url, 'assessment');

  if (error) {
    logger.warn(`[cobb-ga] assessment enrichment failed for PIN ${pin}: ${error}`);
    return null;
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) {
    logger.debug(`[cobb-ga] no assessment record found for PIN ${pin}`);
    return null;
  }

  return features[0].attributes ?? null;
}

// ─── CobbParcels spatial query ─────────────────────────────────────────────────

/**
 * Spatial intersect using Cobb State-Plane coordinates (WKID 2240).
 * Used after the CAM_Locator geocoder step.
 */
async function queryParcelByPoint(pt: GeocodedPoint, inputAddress: string): Promise<MunicipalLookupResult> {
  const geometry = JSON.stringify({
    x: pt.x,
    y: pt.y,
    spatialReference: { wkid: 2240 },
  });

  const params = new URLSearchParams({
    geometry,
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '2240',
    outFields: PARCEL_OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${COBB_PARCELS_URL}?${params.toString()}`;
  const { data, error } = await fetchWithRetry(url, 'spatial-query');
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  const parcelAttrs: Record<string, any> = features[0].attributes ?? {};
  const pin = parcelAttrs.PIN ?? parcelAttrs.PARCEL_ID ?? null;

  // Enrich with assessment data (best-effort — non-blocking on failure)
  const assessmentAttrs = pin ? await fetchAssessmentByPin(pin) : null;

  return mapAttrsToResult(parcelAttrs, assessmentAttrs, pt.matchAddr || inputAddress, features.length);
}

/**
 * Spatial intersect using WGS84 lat/lng (WKID 4326).
 * Used when Census Geocoder already provided coordinates — skips the Cobb
 * CAM_Locator entirely.  ArcGIS auto-reprojects from 4326 to the layer's
 * native WKID (102100 Web Mercator) via the inSR parameter.
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
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outFields: PARCEL_OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${COBB_PARCELS_URL}?${params.toString()}`;
  const { data, error } = await fetchWithRetry(url, 'spatial-query-wgs84');
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  const parcelAttrs: Record<string, any> = features[0].attributes ?? {};
  const pin = parcelAttrs.PIN ?? parcelAttrs.PARCEL_ID ?? null;

  const assessmentAttrs = pin ? await fetchAssessmentByPin(pin) : null;

  return mapAttrsToResult(parcelAttrs, assessmentAttrs, inputAddress, features.length);
}

// ─── CobbParcels PIN query ─────────────────────────────────────────────────────

async function queryParcelByPin(pin: string): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({
    where: `PIN='${pin.replace(/'/g, "''")}'`,
    outFields: PARCEL_OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${COBB_PARCELS_URL}?${params.toString()}`;
  const { data, error } = await fetchWithRetry(url, 'pin-query');
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  const parcelAttrs: Record<string, any> = features[0].attributes ?? {};
  const resolvedPin = parcelAttrs.PIN ?? parcelAttrs.PARCEL_ID ?? pin;

  // Enrich with assessment data (best-effort)
  const assessmentAttrs = await fetchAssessmentByPin(resolvedPin);

  return mapAttrsToResult(parcelAttrs, assessmentAttrs, null, features.length);
}

// ─── Result mapping ────────────────────────────────────────────────────────────

function mapAttrsToResult(
  parcelAttrs: Record<string, any>,
  assessmentAttrs: Record<string, any> | null,
  resolvedAddress: string | null,
  candidateCount: number,
): MunicipalLookupResult {
  const pin      = parcelAttrs.PIN       ?? parcelAttrs.PARCEL_ID ?? null;
  const landSqft = parcelAttrs.LAND_SQFT !== undefined && parcelAttrs.LAND_SQFT !== null
    ? Math.round(Number(parcelAttrs.LAND_SQFT))
    : undefined;

  // Prefer ACRE_DEEDE from parcel layer; fall back to ACRE_CALC, then assessment ACRE_DEEDED
  const acres =
    (parcelAttrs.ACRE_DEEDE && Number(parcelAttrs.ACRE_DEEDE) > 0)
      ? Number(parcelAttrs.ACRE_DEEDE)
      : (parcelAttrs.ACRE_CALC && Number(parcelAttrs.ACRE_CALC) > 0)
        ? Number(parcelAttrs.ACRE_CALC)
        : (assessmentAttrs?.ACRE_DEEDED && Number(assessmentAttrs.ACRE_DEEDED) > 0)
          ? Number(assessmentAttrs.ACRE_DEEDED)
          : undefined;

  // Assessment-layer owner data
  const ownerParts = [assessmentAttrs?.OWNER_NAM1, assessmentAttrs?.OWNER_NAM2].filter(Boolean);
  const ownerMailParts = [
    assessmentAttrs?.OWNER_ADDR,
    assessmentAttrs?.OWNER_CITY,
    assessmentAttrs?.OWNER_STAT,
    assessmentAttrs?.OWNER_ZIP,
  ].filter(Boolean);

  // Prefer the assessment-layer address over the geocoded matchAddr
  const address = assessmentAttrs?.SITUS_ADDR?.trim() || resolvedAddress || null;

  // Prefer assessment-layer CLASS if parcel CLASS is absent
  const classCode = parcelAttrs.CLASS ?? assessmentAttrs?.CLASS ?? null;

  logger.debug(
    `[cobb-ga] resolved → PIN ${pin}, class ${classCode}, ${acres}ac` +
    (assessmentAttrs ? `, owner: ${ownerParts.join(' & ')}, FMV: ${assessmentAttrs.FMV_TOTAL}` : ' (no assessment data)'),
  );

  return {
    status:               pin ? 'ok' : 'not_found',
    candidates:           candidateCount,
    parcel_id:            pin,
    address,
    // Owner (from assessment layer)
    owner:                ownerParts.length ? ownerParts.join(', ') : null,
    owner_address:        ownerMailParts.length ? ownerMailParts.join(', ') : null,
    // Valuations (from assessment layer; undefined when assessment fetch failed)
    assessed_value:       assessmentAttrs?.ASV_TOTAL   !== undefined ? Number(assessmentAttrs.ASV_TOTAL)   : undefined,
    assessed_land:        assessmentAttrs?.ASV_LAND     !== undefined ? Number(assessmentAttrs.ASV_LAND)    : undefined,
    assessed_improvement: assessmentAttrs?.ASV_BLDG     !== undefined ? Number(assessmentAttrs.ASV_BLDG)    : undefined,
    appraised_value:      assessmentAttrs?.FMV_TOTAL    !== undefined ? Number(assessmentAttrs.FMV_TOTAL)   : undefined,
    appraised_land:       assessmentAttrs?.FMV_LAND     !== undefined ? Number(assessmentAttrs.FMV_LAND)    : undefined,
    // Physical
    land_acres:           acres,
    geometry_area_sqft:   landSqft,
    // Classification
    class_code:           classCode,
    tax_district:         assessmentAttrs?.TAXDIST ?? parcelAttrs.TAX_DIST ?? null,
    neighborhood:         parcelAttrs.NBHDSUBD_I ?? null,
    county:               'Cobb',
    state:                'GA',
    source:               'arcgis_cobb_ga',
    raw:                  { ...parcelAttrs, ...(assessmentAttrs ?? {}) },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up a Cobb County parcel by street address.
 *
 * Two-path strategy:
 *   A) knownCoords provided (WGS84 lat/lng from Census Geocoder)
 *      → skip the CAM_Locator and go straight to CobbParcels spatial intersect.
 *        This recovers addresses the CAM_Locator can't find (e.g. "3000 Shadowood
 *        Pkwy SE", "5900 Suffex Green Ln") even though Census has valid coordinates.
 *   B) No knownCoords
 *      → geocode via CAM_Locator (WKID 2240) → spatial intersect (existing path).
 */
export async function lookupCobbGA(
  address: string,
  knownCoords?: { lat: number; lng: number },
): Promise<MunicipalLookupResult> {
  logger.debug(`[cobb-ga] address lookup: "${address}"${knownCoords ? ` (pre-geocoded lat=${knownCoords.lat.toFixed(5)}, lng=${knownCoords.lng.toFixed(5)})` : ''}`);

  // Path A: Census Geocoder already resolved coordinates — skip CAM_Locator.
  if (knownCoords) {
    const result = await queryParcelByWgs84(knownCoords.lat, knownCoords.lng, address);
    // If WGS84 spatial query fails, fall back to CAM_Locator (graceful degradation).
    if (result.status !== 'not_found') return result;
    logger.debug(`[cobb-ga] WGS84 spatial miss for "${address}", falling back to CAM_Locator`);
  }

  // Path B: Use Cobb CAM_Locator geocoder.
  const { point, error: geocodeErr } = await geocodeAddress(address);
  if (geocodeErr) {
    if (geocodeErr === 'no_candidates') return { status: 'not_found' };
    return { status: 'error', error: `geocode: ${geocodeErr}` };
  }

  logger.debug(`[cobb-ga] geocoded "${address}" → (${point!.x.toFixed(0)}, ${point!.y.toFixed(0)}) score=${point!.score}`);
  return queryParcelByPoint(point!, address);
}

/** Look up a Cobb County parcel by its PIN (exact match + assessment enrich). */
export async function lookupCobbGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  logger.debug(`[cobb-ga] parcel-id lookup: "${parcelId}"`);
  return queryParcelByPin(parcelId.trim());
}
