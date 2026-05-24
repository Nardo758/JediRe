/**
 * Duval County FL — City of Jacksonville COJ ArcGIS Parcels adapter
 *
 * Endpoint:
 *   https://maps.coj.net/coj/rest/services/CityBiz/Parcels/MapServer/0/query
 *
 * Key fields: STREET_NO + ST_NAME → full address, RE (parcel/record ID),
 *   LNAMEOWNER (owner last name), LNAME2 (second owner),
 *   LEGAL1..5 (legal description), CAMA_VAL (assessed value),
 *   TOT_LND_VA (land value), TOT_BLD_VA (building value),
 *   TOT_IMPR_V (improvement value), ACRES, ZON_LABEL, DESCPU (land use desc)
 *
 * Note: owner is stored as last name only (LNAMEOWNER) — this is COJ's design.
 * RE format: "167747 3010" (space-separated record number).
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';

const DUVAL_URL =
  'https://maps.coj.net/coj/rest/services/CityBiz/Parcels/MapServer/0/query';

const OUT_FIELDS = [
  'RE', 'STREET_NO', 'ST_NAME', 'ST_TYPE', 'ST_DIR', 'SAINT_NAME', 'STNM_TYPE', 'UNIT_NO',
  'LNAMEOWNER', 'LNAME2', 'MAILADDR1', 'MAILADDR2', 'MAILADDR3', 'MAILCITY', 'MAILSTATE', 'MAILZIP',
  'LEGAL1', 'LEGAL2', 'LEGAL3', 'LEGAL4', 'LEGAL5',
  'CAMA_VAL', 'TOT_LND_VA', 'TOT_BLD_VA', 'TOT_IMPR_V',
  'ACRES', 'NBBLDGS', 'ZON_LABEL', 'DESCPU', 'PUSE',
  'ADDRCITY', 'ZIPCODE',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

function normalizeAddress(addr: string): string {
  return addr.toUpperCase().replace(/\s+/g, ' ').replace(/\./g, '').replace(/,.*$/, '').trim();
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

function sanitize(v: string): string {
  return v.replace(/'/g, "''").replace(/[;\\]/g, '').substring(0, 100);
}

function buildWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const streetName = extractStreetName(normalized);
  if (streetNum && streetName) {
    const namePart = streetName.split(' ')[0];
    return `STREET_NO='${sanitize(streetNum)}' AND ST_NAME LIKE '${sanitize(namePart)}%'`;
  }
  return `STREET_NO='${sanitize(normalized.split(' ')[0])}'`;
}

function buildParcelWhere(parcelId: string): string {
  return `RE='${sanitize(parcelId)}'`;
}

async function queryDuval(
  where: string,
  normalizedAddr?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({ where, outFields: OUT_FIELDS, returnGeometry: 'false', f: 'json' });
  const url = `${DUVAL_URL}?${params.toString()}`;

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
    logger.warn(`[duval-fl] fetch error: ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[duval-fl] ArcGIS error: ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  let chosen = features[0];
  if (normalizedAddr && features.length > 1) {
    const exact = features.find((f: any) => {
      const a = f.attributes;
      const built = [a.STREET_NO, a.ST_NAME, a.ST_TYPE].filter(Boolean).join(' ');
      return normalizeAddress(built) === normalizedAddr;
    });
    if (exact) chosen = exact;
  }

  const a = chosen.attributes ?? {};
  const builtAddress = [a.STREET_NO, a.ST_DIR, a.ST_NAME, a.ST_TYPE, a.UNIT_NO].filter(Boolean).join(' ');
  const owner = [a.LNAMEOWNER, a.LNAME2].filter(Boolean).join(' / ') || null;
  const legalParts = [a.LEGAL1, a.LEGAL2, a.LEGAL3, a.LEGAL4, a.LEGAL5].filter(Boolean);
  const ownerAddr = [a.MAILADDR1, a.MAILADDR2, a.MAILADDR3, a.MAILCITY, a.MAILSTATE, a.MAILZIP].filter(Boolean).join(', ') || null;

  logger.debug(`[duval-fl] resolved → RE ${a.RE}, owner ${owner}`);

  return {
    status: a.RE ? 'ok' : 'not_found',
    parcel_id:           a.RE          ?? null,
    address:             builtAddress  || null,
    owner:               owner,
    owner_address:       ownerAddr,
    legal_description:   legalParts.length ? legalParts.join(' ') : null,
    assessed_value:      a.CAMA_VAL    !== undefined ? Number(a.CAMA_VAL)    : undefined,
    assessed_land:       a.TOT_LND_VA  !== undefined ? Number(a.TOT_LND_VA)  : undefined,
    assessed_improvement:a.TOT_IMPR_V  !== undefined ? Number(a.TOT_IMPR_V)  : undefined,
    land_acres:          a.ACRES       !== undefined ? Number(a.ACRES)        : undefined,
    land_use_code:       a.ZON_LABEL   ?? a.PUSE ?? null,
    county:              'Duval',
    state:               'FL',
    source:              'arcgis_duval_fl',
    candidates:          features.length,
    raw:                 a,
  };
}

export async function lookupDuvalFL(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where = buildWhere(address);
  logger.debug(`[duval-fl] address lookup: "${address}"`);
  return queryDuval(where, normalized);
}

export async function lookupDuvalFLByParcelId(re: string): Promise<MunicipalLookupResult> {
  logger.debug(`[duval-fl] parcel-id lookup: "${re}"`);
  return queryDuval(buildParcelWhere(re));
}
