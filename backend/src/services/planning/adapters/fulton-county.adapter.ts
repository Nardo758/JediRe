/**
 * Fulton County Planning Application Adapter
 *
 * Fetches zoning amendment and planning application cases from the Fulton
 * County Community Development ArcGIS Hub.
 *
 * Source: commdist-fulcogis.opendata.arcgis.com
 * ArcGIS Hub item: ea83de932021475ab2a5b08f33eb9b71 (Fulton County GA Zoning / Planning)
 * Organization ArcGIS: services1.arcgis.com/AQDHTHDrZzfsFsB5 (same org as Fulton tax parcels)
 *
 * Jurisdiction: County-level planning outside City of Atlanta — South Fulton,
 * Alpharetta, Milton, Roswell, Sandy Springs, Johns Creek, Mountain Park,
 * and unincorporated areas.
 *
 * Authentication: none — all Hub layers are public.
 * Rate limits: ArcGIS Hub standard; 2,000 records per page.
 * Parcel linkage: PIN field matches fulton-ga.adapter.ts `parcel_id` (14-char alphanumeric).
 */

import { logger } from '../../../utils/logger';
import type { RawPlanningApplication } from '../planning-ingest.service';

const GIS_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 2_000;
const JURISDICTION = 'fulton_county';

/**
 * Candidate FeatureServer URLs for Fulton County planning layers.
 * The same ArcGIS org (AQDHTHDrZzfsFsB5) hosts both the tax parcels adapter
 * and the zoning/planning layers.
 */
const FULTON_LAYER_URLS = [
  // Fulton County Community Development — zoning applications / planning cases
  'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Zoning_Applications/FeatureServer/0/query',
  // Alternative: zoning amendments layer (planning applications for unincorporated Fulton)
  'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/ZoningAmendments/FeatureServer/0/query',
  // Fallback: general Fulton County Zoning layer (item ea83de932021475ab2a5b08f33eb9b71)
  'https://services1.arcgis.com/AQDHTHDrZzfsFsB5/ArcGIS/rest/services/Zoning/FeatureServer/0/query',
];

const SOURCE_BASE_URL = 'https://commdist-fulcogis.opendata.arcgis.com/datasets/ea83de932021475ab2a5b08f33eb9b71';

// ── Field extraction helpers ───────────────────────────────────────────────

type Attrs = Record<string, unknown>;

function getField(attrs: Attrs, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = attrs[key];
    if (v !== null && v !== undefined) {
      const s = String(v).trim();
      if (s && s.toLowerCase() !== 'null' && s !== 'undefined') return s;
    }
  }
  return null;
}

function getDateField(attrs: Attrs, ...keys: string[]): Date | null {
  for (const key of keys) {
    const v = attrs[key];
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' && v > 0) return new Date(v);
    if (typeof v === 'string' && v.trim()) {
      const d = new Date(v.trim());
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function normaliseStatus(raw: string | null): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  if (upper.includes('APPROV')) return 'APPROVED';
  if (upper.includes('DENI')) return 'DENIED';
  if (upper.includes('WITHDRAW')) return 'WITHDRAWN';
  if (upper.includes('CONTINU')) return 'CONTINUED';
  if (upper.includes('PEND') || upper.includes('REVIEW') || upper.includes('OPEN') || upper.includes('ACTIVE')) return 'PENDING';
  return raw.trim().toUpperCase();
}

function normaliseType(raw: string | null): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  if (upper.includes('REZONE') || upper.includes('REZONING') || upper.includes('AMENDMENT')) return 'REZONING';
  if (upper.includes('SLUP') || upper.includes('SPECIAL LAND USE') || upper.includes('SPECIAL USE')) return 'SLUP';
  if (upper.includes('VARIANCE')) return 'VARIANCE';
  if (upper.includes('SITE PLAN') || upper.includes('SITE DEVELOPMENT')) return 'SITE_PLAN';
  if (upper.includes('CONDITIONAL USE') || upper.includes('CUP')) return 'CONDITIONAL_USE';
  if (upper.includes('SUBDIVISION')) return 'SUBDIVISION';
  return raw.trim().toUpperCase();
}

// ── ArcGIS query ───────────────────────────────────────────────────────────

interface ArcGisResponse {
  features?: Array<{ attributes: Attrs }>;
  error?: { code: number; message: string };
  exceededTransferLimit?: boolean;
}

async function queryFeatureServer(
  baseUrl: string,
  where: string,
  offset: number,
): Promise<ArcGisResponse | null> {
  const params = new URLSearchParams({
    where,
    outFields: '*',
    returnGeometry: 'false',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    orderByFields: 'OBJECTID DESC',
    f: 'json',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GIS_TIMEOUT_MS);

  try {
    const resp = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.debug(`[fulton-county] HTTP ${resp.status} from ${baseUrl}`);
      return null;
    }

    const json = (await resp.json()) as ArcGisResponse;
    if (json.error) {
      logger.debug(`[fulton-county] ArcGIS error from ${baseUrl}: ${json.error.message}`);
      return null;
    }
    return json;
  } catch (err: any) {
    clearTimeout(timeout);
    logger.debug(`[fulton-county] fetch error from ${baseUrl}: ${err?.message ?? String(err)}`);
    return null;
  }
}

// ── Adapter entry point ────────────────────────────────────────────────────

/**
 * Fetch planning applications from Fulton County that were filed or updated
 * within the last `lookbackDays` days.
 */
export async function fetchFultonCountyApplications(
  lookbackDays = 7,
): Promise<RawPlanningApplication[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const cutoffEpoch = cutoff.getTime();

  // Try date-filtered WHERE clause first; fall back to all records (client-side filter)
  const where = [
    `FILED_DATE >= ${cutoffEpoch}`,
    `OR APPLICATION_DATE >= ${cutoffEpoch}`,
    `OR SUBMITTAL_DATE >= ${cutoffEpoch}`,
    `OR LAST_EDITED_DATE >= ${cutoffEpoch}`,
  ].join(' ');

  const whereFallback = `OBJECTID > 0`;

  const results: RawPlanningApplication[] = [];

  for (const baseUrl of FULTON_LAYER_URLS) {
    logger.info(`[fulton-county] Trying ${baseUrl}`);
    let offset = 0;
    let pageCount = 0;
    let succeeded = false;

    while (true) {
      let data = await queryFeatureServer(baseUrl, where, offset);

      if (!data || !data.features) {
        if (offset === 0) {
          data = await queryFeatureServer(baseUrl, whereFallback, offset);
        }
        if (!data || !data.features) break;
      }

      const features = data.features;
      if (features.length === 0) break;

      for (const feature of features) {
        const attrs = feature.attributes;
        const filedDate = getDateField(attrs,
          'FILED_DATE', 'APPLICATION_DATE', 'SUBMITTAL_DATE',
          'DATE_FILED', 'DATE_SUBMITTED', 'SUB_DATE',
        );
        const updatedDate = getDateField(attrs, 'LAST_EDITED_DATE', 'LAST_MOD_DATE', 'EDIT_DATE');

        const referenceDate = filedDate ?? updatedDate;
        if (referenceDate && referenceDate < cutoff) continue;

        const caseNumber = getField(attrs,
          'CASE_NUMBER', 'APPLICATION_NUMBER', 'APP_NUMBER', 'RECORD_NUMBER',
          'CASE_NUM', 'CASENUMBER', 'CASE_ID', 'APP_NO',
        );
        if (!caseNumber) continue;

        const raw: RawPlanningApplication = {
          case_number:      caseNumber,
          jurisdiction:     JURISDICTION,
          application_type: normaliseType(getField(attrs,
            'APPLICATION_TYPE', 'APP_TYPE', 'CASE_TYPE', 'RECORD_TYPE', 'TYPE', 'ZONING_TYPE',
          )),
          applicant_name: getField(attrs,
            'APPLICANT', 'APPLICANT_NAME', 'OWNER', 'AGENT', 'OWNER_NAME', 'CONTACT_NAME',
          ),
          property_address: getField(attrs,
            'ADDRESS', 'PROPERTY_ADDRESS', 'LOCATION', 'SITE_ADDRESS', 'ADDR', 'PROPERTY_LOCATION',
          ),
          parcel_id: getField(attrs,
            'PARCEL_ID', 'PIN', 'PARCELID', 'PARCEL_NUM', 'PARCEL_NUMBER', 'MAP_PARCEL',
          ),
          current_zoning: getField(attrs,
            'CURRENT_ZONING', 'EXISTING_ZONING', 'CUR_ZONING', 'FROM_ZONE',
            'CURRENT_DISTRICT', 'EXISTING_DISTRICT',
          ),
          proposed_zoning: getField(attrs,
            'PROPOSED_ZONING', 'PROP_ZONING', 'NEW_ZONING', 'TO_ZONE',
            'PROPOSED_DISTRICT', 'REQUESTED_ZONING',
          ),
          filed_date:   filedDate,
          status:       normaliseStatus(getField(attrs, 'STATUS', 'STATUS_CODE', 'CASE_STATUS', 'APP_STATUS')),
          hearing_date: getDateField(attrs,
            'HEARING_DATE', 'PC_HEARING', 'BOC_DATE', 'BOARD_DATE', 'MEETING_DATE',
          ),
          source_url:   `${SOURCE_BASE_URL}_0`,
          raw_json:     attrs,
        };

        results.push(raw);
        succeeded = true;
      }

      pageCount++;
      if (!data.exceededTransferLimit || features.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (succeeded) {
      logger.info(`[fulton-county] Fetched ${results.length} application(s) from ${baseUrl} (${pageCount} page(s))`);
      return results;
    }

    logger.warn(`[fulton-county] No results from ${baseUrl} — trying next URL`);
  }

  if (results.length === 0) {
    logger.warn('[fulton-county] All Fulton County URLs exhausted with 0 results — check service availability');
  }

  return results;
}
