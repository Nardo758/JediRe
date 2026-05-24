/**
 * Dallas County TX — DCAD ArcGIS TaxParcels adapter (Dallas city)
 *
 * Endpoint:
 *   https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query
 *
 * Key fields: ST_NUM + ST_NAME → full address, ACCT (parcel ID),
 *   TAXPANAME1/2 (owner), BUSNAME/PROPNAM (property name),
 *   LEGAL_1..5 (legal description), AREA_FEET, ST_DIR, ST_TYPE
 *
 * Address lookup strategy: WHERE ST_NUM = '{num}' AND ST_NAME LIKE '{name}%'
 * (ST_DIR is stored separately and not needed in WHERE — matching by number
 *  + street name is sufficient for unique apartment parcels)
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddress,
  extractStreetNumber,
  extractStreetNameFull as extractStreetName,
  sanitize,
} from '../address-normalize';

const DALLAS_URL =
  'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query';

const OUT_FIELDS = [
  'ACCT', 'GIS_ACCT', 'APPRAISALYEAR',
  'ST_NUM', 'ST_DIR', 'ST_NAME', 'ST_TYPE', 'UNITID', 'CITY',
  'TAXPANAME1', 'TAXPANAME2', 'TAXPAADD1', 'TAXPAADD2', 'TAXPACITY', 'TAXPASTA', 'TAXPAZIP',
  'BUSNAME', 'PROPNAM',
  'LEGAL_1', 'LEGAL_2', 'LEGAL_3', 'LEGAL_4', 'LEGAL_5',
  'AREA_FEET', 'SPTBCODE', 'PROP_CL',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

function buildWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const streetName = extractStreetName(normalized);
  if (streetNum && streetName) {
    const namePart = streetName.split(' ')[0];
    return `ST_NUM='${sanitize(streetNum)}' AND ST_NAME LIKE '${sanitize(namePart)}%'`;
  }
  return `ST_NUM LIKE '${sanitize(normalized.split(' ')[0])}%'`;
}

function buildParcelWhere(parcelId: string): string {
  return `ACCT='${sanitize(parcelId)}'`;
}

async function queryDallas(
  where: string,
  normalizedAddr?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({ where, outFields: OUT_FIELDS, returnGeometry: 'false', f: 'json' });
  const url = `${DALLAS_URL}?${params.toString()}`;

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
    logger.warn(`[dallas-tx] fetch error: ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[dallas-tx] ArcGIS error: ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  let chosen = features[0];
  if (normalizedAddr && features.length > 1) {
    const exact = features.find((f: any) => {
      const a = f.attributes;
      const builtAddr = [a.ST_NUM, a.ST_DIR, a.ST_NAME, a.ST_TYPE].filter(Boolean).join(' ');
      return normalizeAddress(builtAddr) === normalizedAddr;
    });
    if (exact) chosen = exact;
  }

  const a = chosen.attributes ?? {};
  const builtAddress = [a.ST_NUM, a.ST_DIR, a.ST_NAME, a.ST_TYPE].filter(Boolean).join(' ');
  const owner = [a.TAXPANAME1, a.TAXPANAME2].filter(Boolean).join(' / ') || a.BUSNAME || null;
  const legalParts = [a.LEGAL_1, a.LEGAL_2, a.LEGAL_3, a.LEGAL_4, a.LEGAL_5].filter(Boolean);
  const ownerAddr  = [a.TAXPAADD1, a.TAXPAADD2, a.TAXPACITY, a.TAXPASTA, a.TAXPAZIP].filter(Boolean).join(', ') || null;
  const areaAcres  = a.AREA_FEET !== undefined ? Math.round((Number(a.AREA_FEET) / 43560) * 10000) / 10000 : undefined;

  logger.debug(`[dallas-tx] resolved → ACCT ${a.ACCT}, owner ${owner}`);

  return {
    status: a.ACCT ? 'ok' : 'not_found',
    parcel_id:          a.ACCT        ?? null,
    address:            builtAddress  || null,
    owner:              owner,
    owner_address:      ownerAddr,
    legal_description:  legalParts.length ? legalParts.join(' ') : null,
    land_acres:         areaAcres,
    geometry_area_sqft: a.AREA_FEET !== undefined ? Math.round(Number(a.AREA_FEET)) : undefined,
    land_use_code:      a.SPTBCODE   ?? null,
    county:             'Dallas',
    state:              'TX',
    source:             'arcgis_dallas_tx',
    candidates:         features.length,
    raw:                a,
  };
}

export async function lookupDallasTX(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where = buildWhere(address);
  logger.debug(`[dallas-tx] address lookup: "${address}"`);
  return queryDallas(where, normalized);
}

export async function lookupDallasTXByParcelId(acct: string): Promise<MunicipalLookupResult> {
  logger.debug(`[dallas-tx] parcel-id lookup: "${acct}"`);
  return queryDallas(buildParcelWhere(acct));
}
