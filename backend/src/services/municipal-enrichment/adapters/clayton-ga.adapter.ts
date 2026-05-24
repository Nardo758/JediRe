/**
 * Clayton County GA — ArcGIS TaxAssessor Parcels adapter
 *
 * Supports two lookup modes:
 *   - lookupClaytonGA(address)          — query by street address
 *   - lookupClaytonGAByParcelId(id)     — query by PARCELID (exact match)
 *
 * Endpoint — Clayton County GIS, TaxAssessor/Parcels MapServer, layer 0:
 *   https://gis.claytoncountyga.gov/server/rest/services/TaxAssessor/Parcels/MapServer/0/query
 *
 * Available fields (Tax Parcels layer):
 *   PARCELID                           — parcel identifier (e.g. "04204 205001")
 *   OWNERNME                           — owner name (uppercase)
 *   SITEADDRES                         — site address (uppercase, e.g. "505 HALL RD")
 *   SITECITY, SITEZIP5                 — city and zip (SITECITY uppercase)
 *   APPRVAL, ASSESSVAL                 — appraised and assessed values (string)
 *   ACERAGE                            — parcel size in acres (double)
 *   ZONE                               — zoning code
 *   LANDUSEC, LANDUSED                 — land use code and description
 *   SUBDNAME                           — subdivision name
 *   NEIGHBORHOODDESC                   — neighborhood description
 *   STREETNO, STREETNAME               — split street number and name (uppercase)
 *   STRUCTYPE                          — structure type
 *   YEARBUILT, SQRFT                   — building attributes
 *   SALEPRICE, SALEDATE               — most recent sale
 *
 * Note: APPRVAL and ASSESSVAL are stored as strings despite being numeric values.
 *
 * Address query strategy:
 *   UPPER(SITEADDRES) LIKE '{NUM} %' AND UPPER(SITEADDRES) LIKE '%{KEYWORD}%'
 *   Addresses are stored in ALL CAPS (e.g. "505 HALL RD").
 *
 * Parcel ID query strategy (lookupClaytonGAByParcelId):
 *   PARCELID = '{id}'  — format: "04204 205001" (alphanumeric with space)
 *
 * Covers: Jonesboro (county seat), Forest Park, Morrow, Riverdale, Lake City,
 *         Lovejoy, Rex, Ellenwood, Palmetto, Hampton, and surrounding Clayton County.
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

const CLAYTON_PARCELS_URL =
  'https://gis.claytoncountyga.gov/server/rest/services/TaxAssessor/Parcels/MapServer/0/query';

const OUT_FIELDS = [
  'PARCELID',
  'OWNERNME',
  'SITEADDRES', 'SITECITY', 'SITEZIP5',
  'APPRVAL', 'ASSESSVAL',
  'ACERAGE',
  'ZONE',
  'LANDUSEC', 'LANDUSED',
  'SUBDNAME',
  'NEIGHBORHOODDESC',
  'STRUCTYPE',
  'YEARBUILT', 'SQRFT',
  'SALEPRICE', 'SALEDATE',
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
      logger.debug(`[clayton-ga] retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(delay)}ms`);
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
      logger.warn(`[clayton-ga] fetch attempt ${attempt + 1} error: ${lastError}`);
      continue;
    }

    if (!resp.ok) {
      lastError = `HTTP ${resp.status}`;
      logger.warn(`[clayton-ga] ArcGIS HTTP ${resp.status} (attempt ${attempt + 1})`);
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
      logger.warn(`[clayton-ga] ArcGIS body error (attempt ${attempt + 1}): ${msg}`);
      if (msg.toLowerCase().includes('invalid query') || msg.toLowerCase().includes('invalid parameter')) {
        continue;
      }
      return { error: msg };
    }

    return { data };
  }

  logger.warn(`[clayton-ga] all ${MAX_RETRIES} attempts failed: ${lastError}`);
  return { error: lastError };
}

// ─── WHERE clause builders ─────────────────────────────────────────────────────

function buildAddressWhere(address: string): string {
  // Strip city/state/zip (everything after first comma), then normalize.
  const streetOnly = address.replace(/,.*$/, '');
  const normalized = normalizeAddressFull(streetOnly);
  const num     = extractStreetNumber(normalized);
  const keyword = extractStreetKeyword(normalized);

  if (num && keyword) {
    // SITEADDRES is stored in ALL CAPS (e.g. "505 HALL RD").
    // UPPER() is applied for safety; keyword is uppercased for the mid-wildcard.
    return `UPPER(SITEADDRES) LIKE '${sanitize(num, 12)} %' AND UPPER(SITEADDRES) LIKE '%${sanitize(keyword.toUpperCase(), 80)}%'`;
  }

  // Fallback: full address wildcard scan
  const safeAddr = sanitize(normalized.toUpperCase().replace(/\s+/g, '%'), 100);
  return `UPPER(SITEADDRES) LIKE '%${safeAddr}%'`;
}

function buildParcelWhere(parcelId: string): string {
  // Clayton PINs use format "04204 205001" (alphanumeric with embedded space/hyphens).
  // Accept the ID as-is after sanitization; callers must pass the canonical form.
  const trimmed = sanitize(parcelId.trim(), 30);
  return `PARCELID = '${trimmed}'`;
}

// ─── City-match scoring (prefer parcel whose city matches input) ───────────────

function cityMatchScore(attrs: Record<string, any>, inputAddress: string): number {
  const stored = (attrs.SITECITY ?? '').toLowerCase().trim();
  const input  = inputAddress.toLowerCase();
  if (!stored) return 0;
  return input.includes(stored) || stored.split(' ').some((w: string) => w.length > 3 && input.includes(w)) ? 1 : 0;
}

// ─── Response mapping ─────────────────────────────────────────────────────────

function mapAttrsToResult(attrs: Record<string, any>, inputAddress?: string): Partial<MunicipalLookupResult> {
  const acres = (typeof attrs.ACERAGE === 'number' && attrs.ACERAGE > 0) ? attrs.ACERAGE : undefined;
  const appraisedVal = attrs.APPRVAL ? parseFloat(attrs.APPRVAL) : undefined;

  return {
    parcel_id:        attrs.PARCELID        ?? null,
    address:          attrs.SITEADDRES      ?? (inputAddress ?? null),
    owner:            attrs.OWNERNME?.trim() ?? null,
    land_acres:       acres,
    land_use_code:    attrs.LANDUSEC        ?? attrs.ZONE ?? null,
    neighborhood:     attrs.NEIGHBORHOODDESC ?? attrs.SUBDNAME ?? null,
    tax_district:     null,
    assessed_value:   (!isNaN(appraisedVal as number) && (appraisedVal as number) > 0)
                        ? appraisedVal
                        : undefined,
    county:           'Clayton',
    state:            'GA',
    source:           'arcgis_clayton_ga',
    raw:              attrs,
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

  const url = `${CLAYTON_PARCELS_URL}?${params.toString()}`;
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
    `[clayton-ga] resolved → PARCELID ${mapped.parcel_id}, owner: ${mapped.owner}, ` +
    `city: ${attrs.SITECITY ?? '?'}, zone: ${attrs.ZONE ?? '?'}, appraised: ${attrs.APPRVAL ?? '?'}`,
  );

  return {
    status:     mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up a Clayton County parcel by street address. */
export async function lookupClaytonGA(address: string): Promise<MunicipalLookupResult> {
  const where = buildAddressWhere(address);
  logger.debug(`[clayton-ga] address lookup: "${address}" → where: ${where}`);
  return queryArcGIS(where, address);
}

/** Look up a Clayton County parcel by its PARCELID (exact match, e.g. "04204 205001"). */
export async function lookupClaytonGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const where = buildParcelWhere(parcelId);
  logger.debug(`[clayton-ga] parcel-id lookup: "${parcelId}" → where: ${where}`);
  return queryArcGIS(where);
}
