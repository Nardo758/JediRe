/**
 * ═══════════════════════════════════════════════════════════════════
 * ASSESSOR SERVICE — Parcel Lookup & Data Proxy
 * ═══════════════════════════════════════════════════════════════════
 *
 * Wraps external assessor/country APIs (Fulton County, etc.) and provides
 * a unified interface for parcel lookups by address or parcel ID.
 *
 * Supported jurisdictions:
 *   - Fulton County, GA (via property-api worker)
 *   - Extensible for additional counties
 */

import { logger } from '../../utils/logger';

export interface AssessorParcelRecord {
  parcelId: string;
  address: string;
  city: string | null;
  state: string;
  zip: string | null;
  county: string;
  ownerName: string | null;
  ownerType: string | null;
  ownerAddress: string | null;
  propertyType: string | null;
  yearBuilt: number | null;
  lotSizeSqft: number | null;
  lotSizeAcres: number | null;
  buildingSqft: number | null;
  landAssessedValue: number | null;
  improvementAssessedValue: number | null;
  totalAssessedValue: number | null;
  lastAssessmentDate: string | null;
  subdivision: string | null;
  geometry: GeoJSON.Polygon | null;
  raw: Record<string, unknown>;
}

export interface AssessorLookupOptions {
  address?: string;
  parcelId?: string;
  county?: string;
  state?: string;
}

const FULTON_SCRAPER_URL = 'https://property-api.m-dixon5030.workers.dev/scrape';

/**
 * Lookup a parcel via the external assessor API.
 * Currently supports Fulton County via the property-api worker.
 */
export async function lookupParcel(
  options: AssessorLookupOptions
): Promise<AssessorParcelRecord | null> {
  const { address, parcelId, county = 'fulton', state = 'GA' } = options;

  if (!address && !parcelId) {
    throw new Error('Either address or parcelId is required for assessor lookup');
  }

  // For now, route all lookups through the Fulton scraper.
  // Future: county-based routing to different assessor APIs.
  if (county.toLowerCase() !== 'fulton' && county.toLowerCase() !== 'all') {
    logger.warn(`[Assessor] County "${county}" not yet supported. Falling back to Fulton.`);
  }

  try {
    const response = await fetch(FULTON_SCRAPER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, parcelId }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      logger.warn('[Assessor] Scraper returned non-OK', {
        status: response.status,
        error: errorBody.error,
        address,
        parcelId,
      });
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.property) {
      logger.info('[Assessor] No property found', { address, parcelId });
      return null;
    }

    const prop = data.property;

    return normalizeParcelRecord(prop);
  } catch (err) {
    logger.error('[Assessor] Lookup failed', { error: (err as Error).message, address, parcelId });
    return null;
  }
}

/**
 * Normalize a raw scraper property object into our canonical AssessorParcelRecord.
 */
function normalizeParcelRecord(raw: Record<string, unknown>): AssessorParcelRecord {
  return {
    parcelId: String(raw.parcelId ?? raw.parcel_id ?? ''),
    address: String(raw.address ?? ''),
    city: raw.city ? String(raw.city) : null,
    state: String(raw.state ?? 'GA'),
    zip: raw.zip ? String(raw.zip) : null,
    county: String(raw.county ?? 'Fulton'),
    ownerName: raw.ownerName ? String(raw.ownerName) : null,
    ownerType: raw.ownerType ? String(raw.ownerType) : null,
    ownerAddress: raw.ownerAddress ? String(raw.ownerAddress) : null,
    propertyType: raw.propertyType ? String(raw.propertyType) : null,
    yearBuilt: raw.yearBuilt ? Number(raw.yearBuilt) : null,
    lotSizeSqft: raw.lotSizeSqft ? Number(raw.lotSizeSqft) : null,
    lotSizeAcres: raw.lotSizeAcres ? Number(raw.lotSizeAcres) : null,
    buildingSqft: raw.buildingSqft ? Number(raw.buildingSqft) : null,
    landAssessedValue: raw.landAssessedValue ? Number(raw.landAssessedValue) : null,
    improvementAssessedValue: raw.improvementAssessedValue ? Number(raw.improvementAssessedValue) : null,
    totalAssessedValue: raw.totalAssessedValue ? Number(raw.totalAssessedValue) : null,
    lastAssessmentDate: raw.lastAssessmentDate ? String(raw.lastAssessmentDate) : null,
    subdivision: raw.subdivision ? String(raw.subdivision) : null,
    geometry: (raw.geometry as GeoJSON.Polygon) ?? null,
    raw,
  };
}

/**
 * Batch lookup multiple parcels. Useful for rendering nearby parcels on the map.
 */
export async function lookupParcelsBatch(
  requests: AssessorLookupOptions[]
): Promise<(AssessorParcelRecord | null)[]> {
  return Promise.all(requests.map((req) => lookupParcel(req)));
}

/**
 * Search parcels by partial address (suggest/autocomplete).
 * Future: integrate with a geocoding service or address suggest API.
 */
export async function suggestAddresses(query: string): Promise<string[]> {
  // Placeholder: return empty array until we integrate a suggest API
  logger.info('[Assessor] Address suggestion not yet implemented', { query });
  return [];
}
