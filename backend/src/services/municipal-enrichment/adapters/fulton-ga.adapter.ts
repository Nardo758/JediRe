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

  const url = `${FULTON_ARCGIS_URL}?${params.toString()}`;

  let data: any;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      logger.warn(`[fulton-ga] ArcGIS HTTP ${resp.status}`);
      return { status: 'error', error: `HTTP ${resp.status}` };
    }

    data = await resp.json() as any;
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err));
    logger.warn(`[fulton-ga] fetch error: ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[fulton-ga] ArcGIS error: ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

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

// ─── Public API ───────────────────────────────────────────────────────────────

/** Look up a Fulton County parcel by street address. */
export async function lookupFultonGA(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where      = buildAddressWhere(address);
  logger.debug(`[fulton-ga] address lookup: "${address}" → where: ${where}`);
  return queryArcGIS(where, normalized);
}

/** Look up a Fulton County parcel by its ParcelID (exact match). */
export async function lookupFultonGAByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  const where = buildParcelWhere(parcelId);
  logger.debug(`[fulton-ga] parcel-id lookup: "${parcelId}" → where: ${where}`);
  return queryArcGIS(where);
}
