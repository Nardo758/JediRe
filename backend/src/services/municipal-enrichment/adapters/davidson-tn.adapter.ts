/**
 * Davidson County TN — Nashville Metro ArcGIS Parcels adapter
 *
 * Endpoint:
 *   https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0/query
 *
 * Key fields: PropHouse, PropStreet → PropAddr, ParID, APN,
 *   Owner (owner), LegalDesc, TotlAppr (appraised), TotlAssd (assessed),
 *   LandAppr, ImprAppr, LandAssd, ImprAssd, Acres, LUCode, LUDesc
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddress,
  extractStreetNumber,
  extractStreetName,
  sanitize,
} from '../address-normalize';

const NASHVILLE_URL =
  'https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0/query';

const OUT_FIELDS = [
  'ParID', 'APN', 'PropAddr', 'PropHouse', 'PropStreet',
  'Owner', 'OwnAddr1', 'OwnAddr2', 'OwnCity', 'OwnState',
  'LegalDesc', 'LUCode', 'LUDesc', 'TaxDist',
  'TotlAppr', 'TotlAssd', 'LandAppr', 'ImprAppr', 'LandAssd', 'ImprAssd',
  'SalePrice', 'Acres', 'StatedArea',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

function buildWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const streetName = extractStreetName(normalized);
  if (streetNum && streetName) {
    const namePart = streetName.split(' ')[0];
    return `PropHouse='${sanitize(streetNum)}' AND PropStreet LIKE '${sanitize(namePart)}%'`;
  }
  return `PropAddr LIKE '${sanitize(normalized)}%'`;
}

function buildParcelWhere(parcelId: string): string {
  return `APN='${sanitize(parcelId)}'`;
}

async function queryNashville(
  where: string,
  normalizedAddr?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({ where, outFields: OUT_FIELDS, returnGeometry: 'false', f: 'json' });
  const url = `${NASHVILLE_URL}?${params.toString()}`;

  let data: any;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return { status: 'error', error: `HTTP ${resp.status}` };
    data = await resp.json() as any;
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? String(err));
    logger.warn(`[davidson-tn] fetch error: ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[davidson-tn] ArcGIS error: ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  let chosen = features[0];
  if (normalizedAddr && features.length > 1) {
    const exact = features.find((f: any) =>
      normalizeAddress(f.attributes?.PropAddr ?? '') === normalizedAddr
    );
    if (exact) chosen = exact;
  }

  const a = chosen.attributes ?? {};
  const ownerAddr = [a.OwnAddr1, a.OwnAddr2, a.OwnCity, a.OwnState].filter(Boolean).join(', ') || null;
  const parcelId  = a.APN ?? a.ParID ?? null;

  logger.debug(`[davidson-tn] resolved → APN ${parcelId}, owner ${a.Owner}`);

  return {
    status: parcelId ? 'ok' : 'not_found',
    parcel_id:          parcelId,
    address:            a.PropAddr   ?? null,
    owner:              a.Owner      ?? null,
    owner_address:      ownerAddr,
    legal_description:  a.LegalDesc  ?? null,
    appraised_value:    a.TotlAppr   !== undefined ? Number(a.TotlAppr)   : undefined,
    assessed_value:     a.TotlAssd   !== undefined ? Number(a.TotlAssd)   : undefined,
    assessed_land:      a.LandAssd   !== undefined ? Number(a.LandAssd)   : undefined,
    assessed_improvement: a.ImprAssd !== undefined ? Number(a.ImprAssd)   : undefined,
    appraised_land:     a.LandAppr   !== undefined ? Number(a.LandAppr)   : undefined,
    land_acres:         a.Acres      !== undefined ? Number(a.Acres)       : undefined,
    land_use_code:      a.LUCode     ?? null,
    tax_district:       a.TaxDist    ?? null,
    county:             'Davidson',
    state:              'TN',
    source:             'arcgis_davidson_tn',
    candidates:         features.length,
    raw:                a,
  };
}

export async function lookupDavidsonTN(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where = buildWhere(address);
  logger.debug(`[davidson-tn] address lookup: "${address}"`);
  return queryNashville(where, normalized);
}

export async function lookupDavidsonTNByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  logger.debug(`[davidson-tn] parcel-id lookup: "${parcelId}"`);
  return queryNashville(buildParcelWhere(parcelId));
}
