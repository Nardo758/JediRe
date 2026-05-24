/**
 * Mecklenburg County NC — ArcGIS TaxParcel_camadata adapter (Charlotte)
 *
 * Endpoint:
 *   https://meckgis.mecklenburgcountync.gov/server/rest/services/TaxParcel_camadata/FeatureServer/0/query
 *
 * Key fields: streetnumber, streetname → address, parcelid, nc_pin,
 *   ownrlstnme/ownrfrstnme (owner), legaldesc, totalvalue (appraised),
 *   totmarkval (market), totlandval, totalbldgval, totalac, lusecode,
 *   comunits, resunits
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddress,
  extractStreetNumber,
  extractStreetNameFull as extractStreetName,
  sanitize,
} from '../address-normalize';

const MECK_URL =
  'https://meckgis.mecklenburgcountync.gov/server/rest/services/TaxParcel_camadata/FeatureServer/0/query';

const OUT_FIELDS = [
  'parcelid', 'nc_pin', 'address',
  'streetnumber', 'streetname',
  'ownrlstnme', 'ownrfrstnme', 'ownr2lstnme',
  'legaldesc', 'lusecode', 'landuse_description',
  'totalvalue', 'totmarkval', 'totlandval', 'totalbldgval',
  'totalac', 'comunits', 'resunits',
  'saleprice', 'saledate', 'loccity', 'neighborhood',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

function buildWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const streetName = extractStreetName(normalized);
  if (streetNum && streetName) {
    const namePart = streetName.split(' ')[0];
    return `streetnumber='${sanitize(streetNum)}' AND streetname LIKE '${sanitize(namePart)}%'`;
  }
  return `address LIKE '${sanitize(normalized)}%'`;
}

function buildParcelWhere(parcelId: string): string {
  return `parcelid='${sanitize(parcelId)}'`;
}

async function queryMecklenburg(
  where: string,
  normalizedAddr?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({ where, outFields: OUT_FIELDS, returnGeometry: 'false', f: 'json' });
  const url = `${MECK_URL}?${params.toString()}`;

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
    logger.warn(`[mecklenburg-nc] fetch error: ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[mecklenburg-nc] ArcGIS error: ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  let chosen = features[0];
  if (normalizedAddr && features.length > 1) {
    const exact = features.find((f: any) =>
      normalizeAddress(f.attributes?.address ?? '').startsWith(normalizedAddr.substring(0, 15))
    );
    if (exact) chosen = exact;
  }

  const a = chosen.attributes ?? {};
  const owner = [a.ownrfrstnme, a.ownrlstnme].filter(Boolean).join(' ').trim() || null;
  const units = (a.comunits && a.comunits > 0) ? a.comunits : (a.resunits && a.resunits > 0 ? a.resunits : undefined);

  logger.debug(`[mecklenburg-nc] resolved → parcelid ${a.parcelid}, owner ${owner}`);

  return {
    status: a.parcelid ? 'ok' : 'not_found',
    parcel_id:          a.parcelid    ?? null,
    address:            a.address     ?? null,
    owner:              owner,
    legal_description:  a.legaldesc   ?? null,
    assessed_value:     a.totalvalue  !== undefined ? Number(a.totalvalue)  : undefined,
    appraised_value:    a.totmarkval  !== undefined ? Number(a.totmarkval)  : undefined,
    assessed_land:      a.totlandval  !== undefined ? Number(a.totlandval)  : undefined,
    assessed_improvement: a.totalbldgval !== undefined ? Number(a.totalbldgval) : undefined,
    land_acres:         a.totalac     !== undefined ? Number(a.totalac)     : undefined,
    units,
    land_use_code:      a.lusecode    ?? null,
    neighborhood:       a.neighborhood ?? null,
    county:             'Mecklenburg',
    state:              'NC',
    source:             'arcgis_mecklenburg_nc',
    candidates:         features.length,
    raw:                a,
  };
}

export async function lookupMecklenburgNC(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where = buildWhere(address);
  logger.debug(`[mecklenburg-nc] address lookup: "${address}"`);
  return queryMecklenburg(where, normalized);
}

export async function lookupMecklenburgNCByParcelId(parcelId: string): Promise<MunicipalLookupResult> {
  logger.debug(`[mecklenburg-nc] parcel-id lookup: "${parcelId}"`);
  return queryMecklenburg(buildParcelWhere(parcelId));
}
