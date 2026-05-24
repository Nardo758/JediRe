/**
 * M02 Zoning — Atlanta area adapter
 *
 * Jurisdiction resolution order:
 *   1. Census Geocoder provides county FIPS (done upstream, passed in input).
 *   2. If FIPS is 13121 (Fulton) or 13089 (DeKalb): query Atlanta GIS zoning
 *      layer with lat/lng to determine zone_code.
 *   3. Cross-reference zone_code against city-of-atlanta.json lookup table
 *      to produce normalized RegulatoryConstraints.
 *   4. If property is outside City of Atlanta limits (GIS returns no result),
 *      jurisdiction = "Unincorporated <County>" and constraints are null
 *      (not yet implemented — separate lookup tables needed for each county).
 *   5. For other Atlanta-metro FIPS (Cobb 13067, Gwinnett 13135, Cherokee
 *      13057, Clayton 13063, Henry 13151), returns stub with correct
 *      jurisdiction name and null constraints.
 *
 * This adapter covers the FIPS range for Atlanta metro GA.
 * Do NOT use for non-GA addresses.
 */

import { logger } from '../../../../utils/logger';
import type { RegulatoryAdapter, RegulatoryLookupInput } from '../adapter-interface';
import type { RegulatoryConstraints, UseClassification, OverlayDistrict } from '../../types';
import { emptyRegulatoryConstraints } from '../../types';
import coaZoningCodes from '../../zoning-codes/city-of-atlanta.json';

// ── Atlanta GIS zoning layer ───────────────────────────────────────────────
// City of Atlanta ArcGIS zoning FeatureServer (point-in-polygon query).
// Returns ZONING_CODE attribute for the parcel.
// Fallback URLs tried in order if primary fails.
const ATLANTA_GIS_URLS = [
  'https://gis.atlantaga.gov/server/rest/services/ADHI/ADHI_zoning/MapServer/0/query',
  'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Zoning/FeatureServer/0/query',
];

const GIS_TIMEOUT_MS = 10_000;

// County FIPS for Atlanta metro area
const FULTON_FIPS  = '13121';
const DEKALB_FIPS  = '13089';
const COBB_FIPS    = '13067';
const GWINNETT_FIPS = '13135';
const CHEROKEE_FIPS = '13057';
const CLAYTON_FIPS  = '13063';
const HENRY_FIPS    = '13151';
const FORSYTH_FIPS  = '13117';
const PAULDING_FIPS = '13223';

const COUNTY_NAMES: Record<string, string> = {
  [FULTON_FIPS]:   'Fulton',
  [DEKALB_FIPS]:   'DeKalb',
  [COBB_FIPS]:     'Cobb',
  [GWINNETT_FIPS]: 'Gwinnett',
  [CHEROKEE_FIPS]: 'Cherokee',
  [CLAYTON_FIPS]:  'Clayton',
  [HENRY_FIPS]:    'Henry',
  [FORSYTH_FIPS]:  'Forsyth',
  [PAULDING_FIPS]: 'Paulding',
};

const ADAPTER_ID = 'm02_atlanta';
const SOURCE_TAG = 'municipal:m02_atlanta_city';
const SOURCE_TAG_COUNTY = (county: string) => `municipal:m02_${county.toLowerCase()}_ga_stub`;

// ── GIS query ──────────────────────────────────────────────────────────────

interface GisQueryResult {
  zoneCode: string | null;
  urlUsed: string | null;
}

async function queryAtlantaGisZoneCode(lat: number, lng: number): Promise<GisQueryResult> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'ZONING_CODE,ZONING,ZONING_DIST,ZONE_TYPE,TYPE,LABEL',
    returnGeometry: 'false',
    f: 'json',
  });

  for (const baseUrl of ATLANTA_GIS_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GIS_TIMEOUT_MS);

      const resp = await fetch(`${baseUrl}?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        logger.debug(`[m02-atlanta] GIS ${baseUrl} returned HTTP ${resp.status}`);
        continue;
      }

      const json = (await resp.json()) as {
        features?: Array<{ attributes: Record<string, unknown> }>;
        error?: { message: string };
      };

      if (json.error) {
        logger.debug(`[m02-atlanta] GIS ${baseUrl} returned error: ${json.error.message}`);
        continue;
      }

      const feature = json.features?.[0];
      if (!feature) {
        // No feature = outside City of Atlanta limits
        return { zoneCode: null, urlUsed: baseUrl };
      }

      const attrs = feature.attributes;
      // Try multiple field name variants (different ArcGIS layers use different names)
      const zoneCode =
        (attrs.ZONING_CODE as string | null) ??
        (attrs.ZONING as string | null) ??
        (attrs.ZONING_DIST as string | null) ??
        (attrs.ZONE_TYPE as string | null) ??
        (attrs.TYPE as string | null) ??
        (attrs.LABEL as string | null) ??
        null;

      return { zoneCode: zoneCode?.trim() ?? null, urlUsed: baseUrl };
    } catch (err: any) {
      logger.debug(`[m02-atlanta] GIS ${baseUrl} error: ${err?.message ?? String(err)}`);
    }
  }

  return { zoneCode: null, urlUsed: null };
}

// ── Lookup table cross-reference ────────────────────────────────────────────

type CoaDistrict = (typeof coaZoningCodes.districts)[keyof typeof coaZoningCodes.districts];

function getDistrictData(zoneCode: string): CoaDistrict | null {
  const upper = zoneCode.toUpperCase().trim();
  const districts = coaZoningCodes.districts as Record<string, CoaDistrict>;
  // Exact match first
  if (districts[upper]) return districts[upper];
  // Prefix match — e.g. "MR-2A" resolves to "MR-2" if exact not found
  for (const key of Object.keys(districts)) {
    if (upper.startsWith(key)) return districts[key];
  }
  return null;
}

function buildLV<T>(
  value: T,
  source: string,
  runAt: string,
): { value: T; source: string; runAt: string } {
  return { value, source, runAt };
}

// ── Adapter implementation ──────────────────────────────────────────────────

export const atlantaAdapter: RegulatoryAdapter = {
  id: ADAPTER_ID,
  name: 'Atlanta Metro GA (City of Atlanta + metro stub)',

  async lookupRegulatory(input: RegulatoryLookupInput): Promise<RegulatoryConstraints> {
    const runAt = new Date().toISOString();
    const fips = input.county_fips ?? null;

    // ── Jurisdiction routing ───────────────────────────────────────────────
    // For FIPS outside Atlanta metro, return not_implemented stub.
    if (fips && !COUNTY_NAMES[fips]) {
      const empty = emptyRegulatoryConstraints(
        `Unknown county (FIPS ${fips})`,
        'zoning',
        'not_available',
        [`${ADAPTER_ID}:fips_not_in_metro`],
      );
      return empty;
    }

    // ── For non-Fulton/non-DeKalb metro counties: stub (no GIS lookup yet) ──
    // These counties exist in the metro but we only have the CoA lookup table
    // for this dispatch.  Return correct jurisdiction name + null constraints.
    if (fips && fips !== FULTON_FIPS && fips !== DEKALB_FIPS) {
      const countyName = COUNTY_NAMES[fips] ?? 'Unknown';
      return emptyRegulatoryConstraints(
        `Unincorporated ${countyName} County`,
        'zoning',
        SOURCE_TAG_COUNTY(countyName),
        [`${ADAPTER_ID}:county_stub_${fips}`],
      );
    }

    // ── Fulton or DeKalb: try Atlanta GIS for zone_code ───────────────────
    const source_chain: string[] = ['census_geocoder'];

    const lat = input.lat ?? null;
    const lng = input.lng ?? null;

    // Without coordinates we cannot query the GIS layer
    if (!lat || !lng) {
      logger.debug(`[m02-atlanta] no coordinates for ${input.address} — returning empty`);
      const countyName = fips ? (COUNTY_NAMES[fips] ?? 'Fulton') : 'Fulton';
      source_chain.push(`${ADAPTER_ID}:no_coordinates`);
      return emptyRegulatoryConstraints(
        `Unincorporated ${countyName} County`,
        'zoning',
        SOURCE_TAG_COUNTY(countyName),
        source_chain,
      );
    }

    // ── GIS query ─────────────────────────────────────────────────────────
    source_chain.push('atlanta_gis_zoning');
    const { zoneCode, urlUsed } = await queryAtlantaGisZoneCode(lat, lng);

    if (urlUsed) {
      source_chain.push(urlUsed);
    } else {
      source_chain.push(`${ADAPTER_ID}:gis_all_urls_failed`);
    }

    // No feature returned = outside City of Atlanta limits
    if (zoneCode === null && urlUsed !== null) {
      // GIS returned successfully but no features → unincorporated county
      const countyName = fips ? (COUNTY_NAMES[fips] ?? 'Fulton') : 'Fulton';
      logger.debug(`[m02-atlanta] lat/lng not in CoA limits → jurisdiction: Unincorporated ${countyName}`);
      return emptyRegulatoryConstraints(
        `Unincorporated ${countyName} County`,
        'zoning',
        SOURCE_TAG_COUNTY(countyName),
        source_chain,
      );
    }

    // GIS completely unavailable → degrade gracefully
    if (zoneCode === null && urlUsed === null) {
      const countyName = fips ? (COUNTY_NAMES[fips] ?? 'Fulton') : 'Fulton';
      return emptyRegulatoryConstraints(
        `City of Atlanta (GIS unavailable)`,
        'zoning',
        SOURCE_TAG,
        source_chain,
      );
    }

    // ── Cross-reference lookup table ──────────────────────────────────────
    source_chain.push('zoning-codes/city-of-atlanta.json');
    const district = getDistrictData(zoneCode!);

    if (!district) {
      logger.warn(`[m02-atlanta] zone_code "${zoneCode}" not found in city-of-atlanta.json`);
      // Return zone_code but null constraints — unknown district
      const empty = emptyRegulatoryConstraints('City of Atlanta', 'zoning', SOURCE_TAG, source_chain);
      empty.zone_code = buildLV<string | null>(zoneCode, SOURCE_TAG, runAt);
      empty.jurisdiction = buildLV('City of Atlanta', SOURCE_TAG, runAt);
      return empty;
    }

    // ── Build full RegulatoryConstraints ──────────────────────────────────
    const lv = <T>(value: T) => buildLV(value, SOURCE_TAG, runAt);

    const constraints: RegulatoryConstraints = {
      permitted_uses:             lv<UseClassification[]>(district.permitted_uses as UseClassification[]),
      density_max_units_per_acre: lv<number | null>(district.density_max_units_per_acre),
      far_max:                    lv<number | null>(district.far_max),

      height_max_feet:            lv<number | null>(district.height_max_feet),
      stories_max:                lv<number | null>(district.stories_max),
      setback_front_feet:         lv<number | null>(district.setback_front_feet),
      setback_side_feet:          lv<number | null>(district.setback_side_feet),
      setback_rear_feet:          lv<number | null>(district.setback_rear_feet),
      lot_coverage_max_pct:       lv<number | null>(district.lot_coverage_max_pct),

      parking_min_per_unit:       lv<number | null>(district.parking_min_per_unit),
      parking_min_method:         lv<'per_unit' | 'per_sqft' | 'matrix' | null>(
                                    district.parking_min_method as 'per_unit' | 'per_sqft' | 'matrix' | null,
                                  ),

      entitlement_risk:           lv<'low' | 'medium' | 'high' | null>(
                                    district.entitlement_risk as 'low' | 'medium' | 'high' | null,
                                  ),
      allows_short_term_rental:   lv<boolean | null>(district.allows_short_term_rental),

      impact_fees_est:            lv<number | null>(district.impact_fees_est),

      overlay_districts:          lv<OverlayDistrict[]>([]),

      zone_code:                  lv<string | null>(zoneCode),
      jurisdiction:               lv('City of Atlanta'),
      regulatory_model:           lv<'zoning' | 'deed_restriction' | 'mixed'>('zoning'),

      resolved_at:  runAt,
      source_chain,
    };

    logger.debug(
      `[m02-atlanta] resolved ${input.address} → zone=${zoneCode}, ` +
      `far=${district.far_max}, height=${district.height_max_feet}ft, ` +
      `density=${district.density_max_units_per_acre ?? 'n/a'} u/ac`,
    );

    return constraints;
  },
};
