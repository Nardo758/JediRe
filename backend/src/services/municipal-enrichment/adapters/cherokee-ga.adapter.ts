/**
 * Cherokee County GA — ArcGIS Parcels adapter
 *
 * Supports two lookup modes:
 *   - lookupCherokeeGA(address)          — query by street address
 *   - lookupCherokeeGAByParcelId(id)     — query by PIN (exact match)
 *
 * Endpoint — Cherokee County GIS, MainLayersOnline MapServer, Parcels layer (layer 1):
 *   https://gis.cherokeecountyga.gov/arcgis/rest/services/MainLayersOnline/MapServer/1/query
 *
 * Available fields (Parcels layer):
 *   PIN, TIN, TINNoSpace               — parcel identifiers
 *   OWNER                              — owner name
 *   Property_Address                   — situs address (e.g. "508 Custer Way")
 *   Property_City, Property_Zip        — city and zip
 *   Acreage                            — parcel size in acres
 *   Zoning                             — zoning code
 *   TaxDistrict                        — tax district code
 *
 * Note: Assessment/valuation data is not available in the public Parcels layer.
 *       The adapter returns PIN, owner, acreage, and zoning; assessed_value is omitted.
 *
 * Address query strategy:
 *   Property_Address LIKE '{num} %' AND UPPER(Property_Address) LIKE '%{keyword}%'
 *   Property_Address is stored in title-case with abbreviated street types
 *   (e.g. "508 Custer Way", "100 Pink Marble Dr").
 *   The two-clause pattern filters first by street number prefix then by a
 *   mid-wildcard keyword derived from the primary street-name token.
 *   When multiple hits return, the one whose city best matches the input is preferred.
 *
 * Parcel ID query strategy (lookupCherokeeGAByParcelId):
 *   PIN = '{id}'   — Cherokee PINs look like "15-1237-0075" or "13-0243-0001"
 *
 * Covers: Canton, Woodstock, Ball Ground, Holly Springs, Waleska, Waleska,
 *         Marble Hill, Nelson, Tate, and surrounding Cherokee County communities.
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddressFull,
  extractStreetNumber,
  extractStreetKeyword,
  sanitize,
} from '../address-normalize';

// ─── Endpoints ────────────────────────────────────────────────────────────────

const CHEROKEE_PARCELS_URL =
  'https://gis.cherokeecountyga.gov/arcgis/rest/services/MainLayersOnline/MapServer/1/query';

const OUT_FIELDS = [
  'PIN', 'TIN', 'TINNoSpace',
  'OWNER',
  'Property_Address', 'Property_City', 'Property_Zip',
  'Acreage',
  'Zoning',
  'TaxDistrict',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

// ─── Retry helpers ────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArcGIS(url: string): Promise<{ data?: any; error?: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200;
      logger.debug(`[cherokee-ga] retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(delay)}ms`);
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
      logger.warn(`[cherokee-ga] fetch attempt ${attempt + 1} error: ${lastError}`);
      continue;
    }

    if (!resp.ok) {
      lastError = `HTTP ${resp.status}`;
      logger.warn(`[cherokee-ga] ArcGIS HTTP ${resp.status} (attempt ${attempt + 1})`);
      if (resp.status !== 429 && resp.status < 500) {
        if (resp.status !== 400) break;
      }
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
      logger.warn(`[cherokee-ga] ArcGIS body error (attempt ${attempt + 1}): ${msg}`);
      if (msg.toLowerCase().includes('invalid query') || msg.toLowerCase().includes('invalid parameter')) {
        continue;
      }
      return { error: msg };
    }

    return { data };
  }

  logger.warn(`[cherokee-ga] all ${MAX_RETRIES} attempts failed: ${lastError}`);
  return { error: lastError };
}

// ─── WHERE clause builders ─────────────────────────────────────────────────────

function buildAddressWhere(address: string): string {
  // Strip city/state/zip (everything after first comma), then normalize.
  // normalizeAddressFull abbreviates street types (Road→RD, Drive→DR etc.)
  // and expands compound directions (Northeast→NE etc.).
  const streetOnly = address.replace(/,.*$/, '');
  const normalized = normalizeAddressFull(streetOnly);
  const num     = extractStreetNumber(normalized);
  const keyword = extractStreetKeyword(normalized);

  if (num && keyword) {
    // Property_Address stored as "508 Custer Way" — LIKE '{num} %' pins the street number,
    // mid-wildcard on keyword handles stored abbreviations vs. input variants.
    return `Property_Address LIKE '${sanitize(num, 12)} %' AND UPPER(Property_Address) LIKE '%${sanitize(keyword.toUpperCase(), 80)}%'`;
  }

  // Fallback: full address LIKE scan
  const safeAddr = sanitize(normalized.replace(/\s+/g, '%'), 100);
  return `UPPER(Property_Address) LIKE '%${safeAddr}%'`;
}

function buildParcelWhere(parcelId: string): string {
  // Cherokee PINs are formatted like "15-1237-0075".
  // Accept both forms with and without dashes.
  const trimmed = sanitize(parcelId.trim(), 30);
  return `PIN = '${trimmed}'`;
}

// ─── City-match scoring (prefer parcel whose city matches input) ───────────────

function cityMatchScore(attrs: Record<string, any>, inputAddress: string): number {
  const stored = (attrs.Property_City ?? '').toLowerCase();
  const input  = inputAddress.toLowerCase();
  if (!stored) return 0;
  return input.includes(stored) || stored.split(' ').some((w: string) => w.length > 3 && input.includes(w)) ? 1 : 0;
}

// ─── Response mapping ─────────────────────────────────────────────────────────

function mapAttrsToResult(attrs: Record<string, any>, inputAddress?: string): Partial<MunicipalLookupResult> {
  const acres = (typeof attrs.Acreage === 'number' && attrs.Acreage > 0) ? attrs.Acreage : undefined;

  return {
    parcel_id:    attrs.PIN              ?? null,
    address:      attrs.Property_Address ?? (inputAddress ?? null),
    owner:        attrs.OWNER            ?? null,
    land_acres:   acres,
    land_use_code: attrs.Zoning          ?? null,
    tax_district: attrs.TaxDistrict      ?? null,
    neighborhood: null,
    county:       'Cherokee',
    state:        'GA',
    source:       'arcgis_cherokee_ga',
    raw:          attrs,
  };
}

// ─── Core query ───────────────────────────────────────────────────────────────

async function queryArcGIS(
  where: string,
  inputAddress?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${CHEROKEE_PARCELS_URL}?${params.toString()}`;
  const { data, error } = await fetchArcGIS(url);
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  // Prefer the parcel whose city best matches the input address
  let chosen = features[0];
  if (inputAddress && features.length > 1) {
    const scored = features.map((f: any) => ({
      f,
      score: cityMatchScore(f.attributes ?? {}, inputAddress),
    }));
    const best = scored.reduce((a: any, b: any) => (b.score > a.score ? b : a));
    chosen = best.f;
  }

  const attrs: Record<string, any> = chosen.attributes ?? {};
  const mapped = mapAttrsToResult(attrs, inputAddress);

  logger.debug(
    `[cherokee-ga] resolved → PIN ${mapped.parcel_id}, owner: ${mapped.owner}, ` +
    `city: ${attrs.Property_City ?? '?'}, zoning: ${attrs.Zoning ?? '?'}`,
  );

  return {
    status:     mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up a Cherokee County parcel by street address. */
export async function lookupCherokeeGA(address: string): Promise<MunicipalLookupResult> {
  const where = buildAddressWhere(address);
  logger.debug(`[cherokee-ga] address lookup: "${address}" → where: ${where}`);
  return queryArcGIS(where, address);
}

/** Look up a Cherokee County parcel by its PIN (exact match). */
export async function lookupCherokeeGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const where = buildParcelWhere(parcelId);
  logger.debug(`[cherokee-ga] parcel-id lookup: "${parcelId}" → where: ${where}`);
  return queryArcGIS(where);
}
