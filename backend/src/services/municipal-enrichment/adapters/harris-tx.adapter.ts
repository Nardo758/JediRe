/**
 * Harris County TX — HCAD ArcGIS Parcels adapter (Houston)
 *
 * Endpoint:
 *   https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query
 *
 * Key fields: site_str_num + site_str_name → full address, acct_num (parcel/HCAD ID),
 *   owner_name_1/2/3 (owner), mail_addr_1/2 (owner mailing address),
 *   total_appraised_val (appraised), total_market_val (market), land_value, bld_value,
 *   legal_dscr_1..4 (legal description), Acreage, land_sqft, land_use, nra, state_class
 *
 * Address lookup strategy:
 *   WHERE site_str_num = '{num}' AND site_str_name LIKE '{name}%'
 *   site_str_pfx is the prefix direction (N/S/E/W), stored separately.
 *   site_str_sfx is the suffix type (ST/AVE/BLVD/DR/etc).
 *
 * Note: acct_num is a 13-digit numeric HCAD account number.
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import {
  normalizeAddress,
  extractStreetNumber,
  extractStreetNameFull as extractStreetName,
  sanitize,
} from '../address-normalize';

const HARRIS_URL =
  'https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0/query';

const OUT_FIELDS = [
  'acct_num', 'HCAD_NUM', 'LOWPARCELID', 'tax_year',
  'site_str_num', 'site_str_pfx', 'site_str_name', 'site_str_sfx', 'site_str_sfx_dir',
  'site_city', 'site_county', 'site_zip', 'site_str_num_sfx',
  'owner_name_1', 'owner_name_2', 'owner_name_3',
  'mail_addr_1', 'mail_addr_2', 'mail_city', 'mail_state', 'mail_zip',
  'land_value', 'bld_value', 'impr_value', 'productivity_value',
  'total_appraised_val', 'total_market_val', 'tax_value',
  'legal_dscr_1', 'legal_dscr_2', 'legal_dscr_3', 'legal_dscr_4',
  'Acreage', 'land_sqft', 'land_use', 'state_class', 'nra',
  'nh_cd', 'dscr',
].join(',');

const REQUEST_TIMEOUT_MS = 12_000;

function buildWhere(address: string): string {
  const normalized = normalizeAddress(address);
  const streetNum  = extractStreetNumber(normalized);
  const streetName = extractStreetName(normalized);
  if (streetNum && streetName) {
    const namePart = streetName.split(' ')[0];
    return `site_str_num='${sanitize(streetNum)}' AND site_str_name LIKE '${sanitize(namePart)}%'`;
  }
  return `site_str_num='${sanitize(normalized.split(' ')[0])}'`;
}

function buildParcelWhere(parcelId: string): string {
  return `acct_num='${sanitize(parcelId)}'`;
}

async function queryHarris(
  where: string,
  normalizedAddr?: string,
): Promise<MunicipalLookupResult> {
  const params = new URLSearchParams({ where, outFields: OUT_FIELDS, returnGeometry: 'false', f: 'json' });
  const url = `${HARRIS_URL}?${params.toString()}`;

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
    logger.warn(`[harris-tx] fetch error: ${msg}`);
    return { status: 'error', error: msg };
  }

  if (data?.error) {
    logger.warn(`[harris-tx] ArcGIS error: ${data.error.message}`);
    return { status: 'error', error: data.error.message };
  }

  const features: any[] = data?.features ?? [];
  if (features.length === 0) return { status: 'not_found' };

  let chosen = features[0];
  if (normalizedAddr && features.length > 1) {
    const exact = features.find((f: any) => {
      const a = f.attributes;
      const built = [a.site_str_num, a.site_str_pfx, a.site_str_name, a.site_str_sfx].filter(Boolean).join(' ');
      return normalizeAddress(built) === normalizedAddr;
    });
    if (exact) chosen = exact;
  }

  const a = chosen.attributes ?? {};
  const builtAddress = [a.site_str_num, a.site_str_pfx, a.site_str_name, a.site_str_sfx, a.site_str_sfx_dir]
    .filter(Boolean).join(' ');
  const ownerParts = [a.owner_name_1, a.owner_name_2, a.owner_name_3].filter(Boolean);
  const owner = ownerParts.join(' / ') || null;
  const ownerAddr = [a.mail_addr_1, a.mail_addr_2, a.mail_city, a.mail_state, a.mail_zip].filter(Boolean).join(', ') || null;
  const legalParts = [a.legal_dscr_1, a.legal_dscr_2, a.legal_dscr_3, a.legal_dscr_4].filter(Boolean);

  logger.debug(`[harris-tx] resolved → acct_num ${a.acct_num}, owner ${a.owner_name_1}`);

  return {
    status: a.acct_num ? 'ok' : 'not_found',
    parcel_id:           String(a.acct_num ?? '') || null,
    address:             builtAddress || null,
    owner:               owner,
    owner_address:       ownerAddr,
    legal_description:   legalParts.length ? legalParts.join(' ') : null,
    appraised_value:     a.total_appraised_val !== undefined ? Number(a.total_appraised_val) : undefined,
    assessed_value:      a.tax_value           !== undefined ? Number(a.tax_value)           : undefined,
    assessed_land:       a.land_value          !== undefined ? Number(a.land_value)          : undefined,
    assessed_improvement:a.impr_value          !== undefined ? Number(a.impr_value)          : undefined,
    land_acres:          a.Acreage             !== undefined ? Number(a.Acreage)             : undefined,
    geometry_area_sqft:  a.land_sqft           !== undefined ? Math.round(Number(a.land_sqft)) : undefined,
    land_use_code:       a.land_use            ?? null,
    county:              'Harris',
    state:               'TX',
    source:              'arcgis_harris_tx',
    candidates:          features.length,
    raw:                 a,
  };
}

export async function lookupHarrisTX(address: string): Promise<MunicipalLookupResult> {
  const normalized = normalizeAddress(address);
  const where = buildWhere(address);
  logger.debug(`[harris-tx] address lookup: "${address}"`);
  return queryHarris(where, normalized);
}

export async function lookupHarrisTXByParcelId(acctNum: string): Promise<MunicipalLookupResult> {
  logger.debug(`[harris-tx] parcel-id lookup: "${acctNum}"`);
  return queryHarris(buildParcelWhere(acctNum));
}
