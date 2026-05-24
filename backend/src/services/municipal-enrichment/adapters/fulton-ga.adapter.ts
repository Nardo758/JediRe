/**
 * Fulton County GA — ArcGIS Tax Parcels adapter
 *
 * Queries the Fulton County Tax Parcels 2025 FeatureServer to resolve a street
 * address to county parcel records (ParcelID, assessed value, address, units).
 *
 * Endpoint (corrected org-ID from Task #980):
 *   https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';

const FULTON_ARCGIS_URL =
  'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Tax_Parcels_2025/FeatureServer/0/query';

const OUT_FIELDS = [
  'Address', 'ParcelID', 'TotAssess', 'LandAssess', 'ImprAssess',
  'TotAppr', 'LandAppr', 'ImprAppr', 'TaxDist', 'LivUnits', 'LandAcres',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

// ─── Address helpers (mirror benchmark-enrichment.service.ts) ────────────────

function normalizeAddress(addr: string): string {
  return addr
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/,.*$/, '')
    .trim();
}

function extractStreetNumber(addr: string): string {
  const m = addr.match(/^(\d+)\s/);
  return m ? m[1] : '';
}

function extractStreetName(addr: string): string {
  return addr
    .replace(/^\d+\s+/, '')
    .replace(/\s+(NW|NE|SW|SE|N|S|E|W)$/i, '')
    .trim();
}

function sanitize(value: string): string {
  return value.replace(/'/g, "''").replace(/[;\\]/g, '').substring(0, 100);
}

function buildWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const streetName = extractStreetName(normalized);

  if (streetNum && streetName) {
    return `Address LIKE '${sanitize(streetNum)} ${sanitize(streetName)}%'`;
  }
  return `Address LIKE '${sanitize(normalized)}%'`;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export async function lookupFultonGA(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where      = buildWhere(address);

  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    returnGeometry: 'false',
    f: 'json',
  });

  const url = `${FULTON_ARCGIS_URL}?${params.toString()}`;

  let data: any;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      logger.warn(`[fulton-ga] ArcGIS HTTP ${resp.status} for "${address}"`);
      return { status: 'error', error: `HTTP ${resp.status}` };
    }

    data = await resp.json() as any;
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err));
    logger.warn(`[fulton-ga] fetch error for "${address}": ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[fulton-ga] ArcGIS error for "${address}": ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) {
    logger.debug(`[fulton-ga] no match for "${address}"`);
    return { status: 'not_found' };
  }

  // Prefer exact-match address; fall back to first result
  const exactMatch = features.find((f: any) => {
    const apiAddr = normalizeAddress(f.attributes?.Address ?? '');
    return apiAddr === normalized;
  });

  const attrs: Record<string, any> = (exactMatch ?? features[0]).attributes ?? {};

  const parcelId      = attrs.ParcelID     ?? null;
  const assessedValue = attrs.TotAssess    !== undefined ? Number(attrs.TotAssess)   : undefined;
  const appraisedValue= attrs.TotAppr      !== undefined ? Number(attrs.TotAppr)     : undefined;
  const landAcres     = attrs.LandAcres    !== undefined ? Number(attrs.LandAcres)   : undefined;
  const livUnits      = attrs.LivUnits     !== undefined ? Number(attrs.LivUnits)    : undefined;
  const taxDistrict   = attrs.TaxDist      ?? null;
  const resolvedAddress = attrs.Address ?? null;

  logger.debug(`[fulton-ga] resolved "${address}" → parcel ${parcelId}`);

  return {
    status: parcelId ? 'ok' : 'not_found',
    parcel_id:       parcelId,
    address:         resolvedAddress,
    assessed_value:  assessedValue,
    appraised_value: appraisedValue,
    land_acres:      landAcres,
    units:           livUnits && livUnits > 0 ? livUnits : undefined,
    county:          'Fulton',
    state:           'GA',
    tax_district:    taxDistrict,
    source:          'arcgis_fulton_ga_2025',
    raw:             attrs,
    candidates:      features.length,
  };
}
