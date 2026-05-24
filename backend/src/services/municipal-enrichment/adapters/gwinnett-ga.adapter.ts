/**
 * Gwinnett County GA — ArcGIS Property & Tax adapter
 *
 * Supports two lookup modes:
 *   - lookupGwinnettGA(address)          — query by street address
 *   - lookupGwinnettGAByParcelId(id)     — query by PIN (exact match)
 *
 * Endpoint — Gwinnett County GIS (org: RfpmnkSAQleRbndX), Tax Master Table (layer 3):
 *   https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer/3/query
 *
 * Available fields (Tax Master Table):
 *   PIN, RPIN, LRSN                 — parcel identifiers
 *   LOCADDR, LOCCITY, LOCZIP        — property location address
 *   STRNUM (number), STRNAME        — street number and street name (UPPERCASE)
 *   OWNER1, OWNER2                  — owner names
 *   TOTVAL1                         — total assessed value
 *   DWLGVAL1                        — building / improvement assessed value
 *   LANDVAL1                        — land assessed value
 *   TAXTOT1                         — total taxable value
 *   LEGALAC                         — legal acreage (string with leading spaces)
 *   ZONING, ZONEDESC                — zoning code and description
 *   PROPCLAS, PCDESC                — property class code and description
 *   DISTNUM                         — tax district number
 *
 * Address query strategy:
 *   STRNUM = {num} AND UPPER(STRNAME) LIKE '%{keyword}%'
 *   STRNUM is a numeric field; STRNAME is stored all-uppercase.
 *   The mid-wildcard on STRNAME handles directional prefixes stored in the field
 *   (e.g., "WEST ROCK QUARRY RD" when input is "Rock Quarry Rd").
 *   When multiple hits return, the one whose LOCCITY best matches the input city is preferred.
 *
 * Parcel ID query strategy (lookupGwinnettGAByParcelId):
 *   PIN = '{id}'   — Gwinnett PINs look like "6195 151" (no leading R)
 *   Falls back to RPIN = 'R{id}' if the caller strips the R prefix.
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddress,
  extractStreetNumber,
  extractStreetKeyword,
  sanitize,
} from '../address-normalize';

// ─── Endpoints ────────────────────────────────────────────────────────────────

const GWINNETT_TAX_MASTER_URL =
  'https://services3.arcgis.com/RfpmnkSAQleRbndX/arcgis/rest/services/Property_and_Tax/FeatureServer/3/query';

const OUT_FIELDS = [
  'PIN', 'RPIN', 'LRSN',
  'LOCADDR', 'LOCCITY', 'LOCZIP',
  'STRNUM', 'STRNAME',
  'OWNER1', 'OWNER2',
  'TOTVAL1', 'DWLGVAL1', 'LANDVAL1', 'TAXTOT1',
  'LEGALAC',
  'ZONING', 'ZONEDESC',
  'PROPCLAS', 'PCDESC',
  'DISTNUM',
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
      logger.debug(`[gwinnett-ga] retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(delay)}ms`);
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
      logger.warn(`[gwinnett-ga] fetch attempt ${attempt + 1} error: ${lastError}`);
      continue;
    }

    if (!resp.ok) {
      lastError = `HTTP ${resp.status}`;
      logger.warn(`[gwinnett-ga] ArcGIS HTTP ${resp.status} (attempt ${attempt + 1})`);
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
      logger.warn(`[gwinnett-ga] ArcGIS body error (attempt ${attempt + 1}): ${msg}`);
      if (msg.toLowerCase().includes('invalid query') || msg.toLowerCase().includes('invalid parameter')) {
        continue;
      }
      return { error: msg };
    }

    return { data };
  }

  logger.warn(`[gwinnett-ga] all ${MAX_RETRIES} attempts failed: ${lastError}`);
  return { error: lastError };
}

// ─── WHERE clause builders ─────────────────────────────────────────────────────

function buildAddressWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const num     = extractStreetNumber(normalized);
  const keyword = extractStreetKeyword(normalized);

  if (num && keyword) {
    // STRNUM is numeric; STRNAME is stored uppercase — mid-wildcard for robustness
    return `STRNUM = ${sanitize(num, 12)} AND UPPER(STRNAME) LIKE '%${sanitize(keyword.toUpperCase(), 80)}%'`;
  }
  // Fallback: full LOCADDR LIKE query
  const safeAddr = sanitize(normalized.replace(/\s+/g, '%'), 100);
  return `UPPER(LOCADDR) LIKE '%${safeAddr}%'`;
}

function buildParcelWhere(parcelId: string): string {
  const trimmed = parcelId.trim();
  // PINs are stored without the leading 'R' (e.g. "6195 151"), RPIN has it (e.g. "R6195 151").
  // Accept both forms.
  if (trimmed.toUpperCase().startsWith('R')) {
    const withoutR = trimmed.slice(1).trim();
    return `PIN = '${sanitize(withoutR)}' OR RPIN = '${sanitize(trimmed.toUpperCase())}'`;
  }
  return `PIN = '${sanitize(trimmed)}'`;
}

// ─── City-match scoring (prefer the parcel whose city matches input) ───────────

function cityMatchScore(attrs: Record<string, any>, inputAddress: string): number {
  const stored = (attrs.LOCCITY ?? '').toLowerCase();
  const input  = inputAddress.toLowerCase();
  if (!stored) return 0;
  return input.includes(stored) || stored.split(' ').some((w: string) => w.length > 3 && input.includes(w)) ? 1 : 0;
}

// ─── Response mapping ─────────────────────────────────────────────────────────

function mapAttrsToResult(attrs: Record<string, any>, inputAddress?: string): Partial<MunicipalLookupResult> {
  const ownerParts = [attrs.OWNER1, attrs.OWNER2].filter(Boolean);

  // LEGALAC is stored as a space-padded string like "      0.4100"
  const legalAcStr = (attrs.LEGALAC ?? '').toString().trim();
  const legalAcres = legalAcStr ? parseFloat(legalAcStr) : undefined;
  const acres = legalAcres && legalAcres > 0 ? legalAcres : undefined;

  // Valuations are stored as quoted number strings (ArcGIS NUMERIC → string)
  const toNum = (v: any): number | undefined =>
    v !== undefined && v !== null && v !== '' ? Number(v) : undefined;

  return {
    parcel_id:            attrs.PIN             ?? null,
    address:              attrs.LOCADDR         ?? (inputAddress ?? null),
    owner:                ownerParts.length ? ownerParts.join(', ') : null,
    assessed_value:       toNum(attrs.TOTVAL1),
    assessed_improvement: toNum(attrs.DWLGVAL1),
    assessed_land:        toNum(attrs.LANDVAL1),
    land_acres:           acres,
    land_use_code:        attrs.PROPCLAS        ?? null,
    class_code:           attrs.PCDESC          ?? null,
    tax_district:         attrs.DISTNUM         ?? null,
    neighborhood:         null,
    county:               'Gwinnett',
    state:                'GA',
    source:               'arcgis_gwinnett_ga',
    raw:                  attrs,
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

  const url = `${GWINNETT_TAX_MASTER_URL}?${params.toString()}`;
  const { data, error } = await fetchArcGIS(url);
  if (error) return { status: 'error', error };

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  // Prefer the parcel whose LOCCITY best matches the input address
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
    `[gwinnett-ga] resolved → PIN ${mapped.parcel_id}, owner: ${mapped.owner}, ` +
    `totalAssessed: ${mapped.assessed_value}, city: ${attrs.LOCCITY ?? '?'}`,
  );

  return {
    status:     mapped.parcel_id ? 'ok' : 'not_found',
    candidates: features.length,
    ...mapped,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up a Gwinnett County parcel by street address. */
export async function lookupGwinnettGA(address: string): Promise<MunicipalLookupResult> {
  const where = buildAddressWhere(address);
  logger.debug(`[gwinnett-ga] address lookup: "${address}" → where: ${where}`);
  return queryArcGIS(where, address);
}

/** Look up a Gwinnett County parcel by its PIN (exact match). */
export async function lookupGwinnettGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const where = buildParcelWhere(parcelId);
  logger.debug(`[gwinnett-ga] parcel-id lookup: "${parcelId}" → where: ${where}`);
  return queryArcGIS(where);
}
