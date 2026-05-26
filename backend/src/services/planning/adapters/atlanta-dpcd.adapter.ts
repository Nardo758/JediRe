/**
 * Atlanta DPCD Planning Application Adapter
 *
 * Fetches rezoning, SLUP, and variance cases from the Atlanta Department of
 * City Planning (DPCD) ArcGIS FeatureServer layers.
 *
 * Source: gis.atlantaga.gov/dpcd/rest/services/
 * ArcGIS Hub item: 655f985f43cc40b4bf2ab7bc73d2169b (Rezoning Case Map)
 *
 * The DPCD ArcGIS server hosts multiple sub-services under /dpcd/rest/services/:
 *   - ZoningAmendments — rezoning applications (primary)
 *   - VarianceCases    — variance / ZBA cases
 *
 * Authentication: none — all Hub layers are public.
 * Rate limits: ArcGIS Hub standard; 2,000 records per page.
 * Parcel linkage: PARCEL_ID field matches fulton-ga.adapter.ts `parcel_id` format.
 */

import { logger } from '../../../utils/logger';
import type { RawPlanningApplication } from '../planning-ingest.service';

const GIS_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 2_000;
const JURISDICTION = 'atlanta_dpcd';

/**
 * Candidate FeatureServer URLs for DPCD planning application layers.
 * Multiple URLs tried in order — DPCD occasionally reorganises sub-services.
 * Layer 0 is the primary rezoning case layer on each service.
 */
const DPCD_LAYER_URLS = [
  // ZoningAmendments sub-service (primary)
  'https://gis.atlantaga.gov/dpcd/rest/services/ZoningAmendments/ZoningAmendments/FeatureServer/0/query',
  // Fallback: LandUsePlanning MapServer may include case overlay
  'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer/0/query',
];

const SOURCE_BASE_URL = 'https://dpcd-coaplangis.opendata.arcgis.com/datasets/655f985f43cc40b4bf2ab7bc73d2169b';

// ── Field extraction helpers ───────────────────────────────────────────────

type Attrs = Record<string, unknown>;

/** Try multiple field name variants; return first non-empty string value. */
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

/**
 * ArcGIS returns dates as epoch milliseconds (number) or ISO strings.
 * Returns null if the field is absent or invalid.
 */
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

/** Map ArcGIS STATUS values to a normalised set. */
function normaliseStatus(raw: string | null): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  if (upper.includes('APPROV')) return 'APPROVED';
  if (upper.includes('DENI')) return 'DENIED';
  if (upper.includes('WITHDRAW')) return 'WITHDRAWN';
  if (upper.includes('CONTINU')) return 'CONTINUED';
  if (upper.includes('PEND') || upper.includes('REVIEW') || upper.includes('OPEN')) return 'PENDING';
  return raw.trim().toUpperCase();
}

/** Map ArcGIS case type values to a normalised set. */
function normaliseType(raw: string | null): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  if (upper.includes('REZONE') || upper.includes('REZONING') || upper.includes('AMENDMENT')) return 'REZONING';
  if (upper.includes('SLUP') || upper.includes('SPECIAL LAND USE') || upper.includes('SPECIAL USE')) return 'SLUP';
  if (upper.includes('VARIANCE')) return 'VARIANCE';
  if (upper.includes('SITE PLAN') || upper.includes('SITE DEVELOPMENT')) return 'SITE_PLAN';
  if (upper.includes('CONDITIONAL USE') || upper.includes('CUP')) return 'CONDITIONAL_USE';
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
      logger.debug(`[atlanta-dpcd] HTTP ${resp.status} from ${baseUrl}`);
      return null;
    }

    const json = (await resp.json()) as ArcGisResponse;
    if (json.error) {
      logger.debug(`[atlanta-dpcd] ArcGIS error from ${baseUrl}: ${json.error.message}`);
      return null;
    }
    return json;
  } catch (err: any) {
    clearTimeout(timeout);
    logger.debug(`[atlanta-dpcd] fetch error from ${baseUrl}: ${err?.message ?? String(err)}`);
    return null;
  }
}

// ── Adapter entry point ────────────────────────────────────────────────────

/**
 * Fetch planning applications from Atlanta DPCD that were filed or updated
 * within the last `lookbackDays` days.
 *
 * Tries each candidate URL in order, pages through all results (2,000/page),
 * and normalises attributes into RawPlanningApplication records.
 */
export async function fetchAtlantaDpcdApplications(
  lookbackDays = 7,
): Promise<RawPlanningApplication[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD

  // ArcGIS WHERE clause — try date fields that DPCD commonly uses
  // Epoch millisecond comparison is the most reliable across ArcGIS versions
  const cutoffEpoch = cutoff.getTime();
  const where = [
    `SUB_DATE >= ${cutoffEpoch}`,
    `OR SUBMITTED_DATE >= ${cutoffEpoch}`,
    `OR FILING_DATE >= ${cutoffEpoch}`,
    `OR LAST_EDITED_DATE >= ${cutoffEpoch}`,
  ].join(' ');

  // Simpler fallback where that works even when field names differ
  const whereFallback = `OBJECTID > 0`;

  const results: RawPlanningApplication[] = [];

  for (const baseUrl of DPCD_LAYER_URLS) {
    logger.info(`[atlanta-dpcd] Trying ${baseUrl}`);
    let offset = 0;
    let pageCount = 0;
    let succeeded = false;

    while (true) {
      // Try date-filtered query first; fall back to all records if no results
      let data = await queryFeatureServer(baseUrl, where, offset);

      if (!data || !data.features) {
        if (offset === 0) {
          // Date filter may have failed — fall back to all records, filter client-side
          data = await queryFeatureServer(baseUrl, whereFallback, offset);
        }
        if (!data || !data.features) break;
      }

      const features = data.features;
      if (features.length === 0) break;

      for (const feature of features) {
        const attrs = feature.attributes;
        const filedDate = getDateField(attrs, 'SUB_DATE', 'SUBMITTED_DATE', 'FILING_DATE', 'DATE_FILED', 'SUBMITTAL_DATE');
        const updatedDate = getDateField(attrs, 'LAST_EDITED_DATE', 'LAST_MOD_DATE', 'EDIT_DATE', 'MODIFIED_DATE');

        // Client-side date filter if server-side filter didn't apply
        const referenceDate = filedDate ?? updatedDate;
        if (referenceDate && referenceDate < cutoff) continue;

        const caseNumber = getField(attrs,
          'CASE_NUMBER', 'CASE_NUM', 'APP_NUMBER', 'APP_NUM',
          'CASENUMBER', 'APPLICATION_NUMBER', 'RECORD_NUMBER',
          'REZONING_CASE', 'CASE_ID',
        );
        if (!caseNumber) continue; // skip records with no case identifier

        const raw: RawPlanningApplication = {
          case_number:      caseNumber,
          jurisdiction:     JURISDICTION,
          application_type: normaliseType(getField(attrs,
            'CASE_TYPE', 'APP_TYPE', 'APPLICATION_TYPE', 'RECORD_TYPE', 'TYPE',
          )),
          applicant_name: getField(attrs,
            'APPLICANT', 'APPLICANT_NAME', 'AGENT', 'OWNER', 'CONTACT_NAME',
          ),
          property_address: getField(attrs,
            'LOCATION', 'ADDRESS', 'PROPERTY_ADDRESS', 'SITE_ADDRESS', 'ADDR',
          ),
          parcel_id: getField(attrs,
            'PARCEL_ID', 'PIN', 'PARCEL_NUM', 'PARCELID', 'FOLIO', 'PARID',
          ),
          current_zoning: getField(attrs,
            'EXISTING_ZONING', 'CURRENT_ZONING', 'CUR_ZONING', 'FROM_ZONE', 'ZONING_FROM',
          ),
          proposed_zoning: getField(attrs,
            'PROPOSED_ZONING', 'PROP_ZONING', 'NEW_ZONING', 'TO_ZONE', 'ZONING_TO',
          ),
          filed_date:   filedDate,
          status:       normaliseStatus(getField(attrs, 'STATUS', 'STATUS_CODE', 'CASE_STATUS')),
          hearing_date: getDateField(attrs, 'HEARING_DATE', 'ZRB_HEARING', 'PC_DATE', 'HEARING', 'BOARD_DATE'),
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
      logger.info(`[atlanta-dpcd] Fetched ${results.length} application(s) from ${baseUrl} (${pageCount} page(s))`);
      return results;
    }

    logger.warn(`[atlanta-dpcd] No results from ${baseUrl} — trying next URL`);
  }

  if (results.length === 0) {
    logger.warn('[atlanta-dpcd] All DPCD URLs exhausted with 0 results — check service availability');
  }

  return results;
}
