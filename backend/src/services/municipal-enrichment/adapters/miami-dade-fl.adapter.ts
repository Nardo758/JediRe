/**
 * Miami-Dade County FL — Municipal Enrichment Adapter
 *
 * Enables `municipalEnrichment.lookup(address, 'FL', 'Miami')` and
 * `municipalEnrichment.lookupByParcelId(folio, 'FL', 'Miami')` by routing
 * to the Miami-Dade Property Appraiser (MDPA) JSON proxy service.
 *
 * MDPA API (no auth required, public):
 *   apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx
 *
 * Parcel identifier: Miami-Dade uses a 13-digit Folio Number as the
 * primary parcel ID (e.g., "3021010310230"), formatted from the Property
 * Appraiser strap number (e.g., "30-2101-031-0230").
 *
 * Coverage: all unincorporated Miami-Dade plus 34 incorporated municipalities
 * within Miami-Dade County (Miami, Miami Beach, Hialeah, Coral Gables, etc.)
 * FIPS: 12086
 *
 * Task: #1077
 */

import { logger } from '../../../utils/logger';
import type { MunicipalLookupResult } from '../types';
import { resolveFolioPA, resolveFolioByAddress } from '../../../services/planning/adapters/miami-dade.adapter';

// ── Address lookup ────────────────────────────────────────────────────────────

/**
 * Look up a Miami-Dade property by street address via the MDPA proxy API.
 *
 * The MDPA API geocodes the address within Miami-Dade County and returns
 * full property info including folio, owner, zoning, and assessment data.
 *
 * @param address  Street address (e.g., "14650 SW 107 AV")
 * @param city     City within Miami-Dade (defaults to "MIAMI")
 */
export async function lookupMiamiDadeFL(
  address: string,
  city = 'MIAMI',
): Promise<MunicipalLookupResult> {
  logger.debug(`[miami-dade-fl] address lookup: "${address}" city="${city}"`);

  const info = await resolveFolioByAddress(address, city);
  if (!info) {
    return { status: 'not_found' };
  }

  return {
    status:              'ok',
    parcel_id:           info.folio            || null,
    address:             info.site_address      || null,
    owner:               info.owner             || null,
    legal_description:   info.legal_description || null,
    land_use_code:       info.property_class    || info.primary_zone || null,
    assessed_value:      info.assessed_value    !== null ? Number(info.assessed_value) : undefined,
    county:              'Miami-Dade',
    state:               'FL',
    source:              'mdpa_property_appraiser',
    raw:                 info as unknown as Record<string, unknown>,
  };
}

// ── Folio (parcel ID) lookup ─────────────────────────────────────────────────

/**
 * Look up a Miami-Dade property by 13-digit folio number via the MDPA proxy API.
 *
 * @param folio  Miami-Dade folio number (13 digits, e.g., "3021010310230")
 */
export async function lookupMiamiDadeFLByFolio(folio: string): Promise<MunicipalLookupResult> {
  logger.debug(`[miami-dade-fl] folio lookup: "${folio}"`);

  const info = await resolveFolioPA(folio);
  if (!info) {
    return { status: 'not_found' };
  }

  return {
    status:              'ok',
    parcel_id:           info.folio            || null,
    address:             info.site_address      || null,
    owner:               info.owner             || null,
    legal_description:   info.legal_description || null,
    land_use_code:       info.property_class    || info.primary_zone || null,
    assessed_value:      info.assessed_value    !== null ? Number(info.assessed_value) : undefined,
    county:              'Miami-Dade',
    state:               'FL',
    source:              'mdpa_property_appraiser',
    raw:                 info as unknown as Record<string, unknown>,
  };
}
