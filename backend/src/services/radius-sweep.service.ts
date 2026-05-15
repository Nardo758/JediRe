/**
 * WS-3 Layer 1 — Radius Sweep Service
 *
 * Queries county_parcels within fixed 3mi and 5mi rings of a point using
 * PostGIS ST_DWithin on a geography type derived from the stored
 * centroid_lat / centroid_lng columns.  Only returns parcels that carry
 * a multifamily-eligible zoning designation (broad MF filter so no
 * developable supply is missed; Layer 2 applies the binding dimensional
 * filter).
 *
 * Uses ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography so no stored
 * PostGIS geometry column is required — the on-the-fly cast is accurate
 * great-circle distance and satisfies PostGIS ring membership semantics.
 *
 * A bounding-box pre-filter on centroid_lat/centroid_lng is applied first
 * to keep the sequential scan bounded before the geography expression runs.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface SweptParcel {
  parcelId: string;
  address: string | null;
  zoningCode: string | null;
  zoningDesc: string | null;
  landUseCode: string | null;
  lotAreaSf: number;
  lotWidthFt: number | null;
  lotDepthFt: number | null;
  centroidLat: number;
  centroidLng: number;
  distanceMiles: number;
  rawRecord: Record<string, unknown>;
}

const MI_TO_METERS = 1609.344;
const DEG_PER_METER_LAT = 1 / 111320;

const MF_ZONING_CONDITIONS = `
  (
    county_zoning_code ILIKE '%MF%'
    OR county_zoning_code ILIKE '%RM%'
    OR county_zoning_code ILIKE '%MR%'
    OR county_zoning_code ILIKE '%MDR%'
    OR county_zoning_code ILIKE '%HDR%'
    OR county_zoning_code ILIKE '%RMF%'
    OR county_zoning_code ILIKE '%MFR%'
    OR county_zoning_code ILIKE '%MU%'
    OR county_zoning_code ILIKE '%MX%'
    OR county_zoning_code ILIKE 'R-3%'
    OR county_zoning_code ILIKE 'R3%'
    OR county_zoning_code ILIKE 'R-4%'
    OR county_zoning_code ILIKE 'R4%'
    OR county_zoning_code ILIKE 'R-5%'
    OR county_zoning_code ILIKE 'R5%'
    OR county_zoning_code ILIKE 'R-6%'
    OR county_zoning_code ILIKE 'R6%'
    OR county_zoning_code ILIKE '%APT%'
    OR county_zoning_code ILIKE '%MULTI%'
    OR county_zoning_code ILIKE '%HIGH%DENS%'
    OR county_zoning_code ILIKE '%MH%'
    OR land_use_code ILIKE '%multi%'
    OR land_use_code ILIKE '%apartment%'
    OR land_use_code ILIKE '%condo%'
    OR land_use_code ILIKE '%residential_hi%'
  )
`;

export interface SweepResult {
  parcels: SweptParcel[];
  /** True when the result set was capped at MAX_PARCELS. Ring metrics may be
   *  understated; the operator should ingest more parcel data for this area. */
  truncated: boolean;
  totalCount: number;
}

/**
 * Hard cap per sweep. Set high enough to cover dense 5-mile metros while
 * bounding query cost.  The `truncated` flag is always returned so callers
 * can expose an explicit warning — there is no silent data loss.
 */
const MAX_PARCELS = 5000;

export class RadiusSweepService {
  constructor(private pool: Pool) {}

  /**
   * Returns all MF-zoned parcels within `radiusMiles` of (lat, lng).
   *
   * Uses PostGIS ST_DWithin on a geography type for accurate great-circle
   * ring membership.  A bounding-box pre-filter reduces the rows the
   * geography expression evaluates.
   *
   * When results exceed MAX_PARCELS the response is capped and `truncated`
   * is set to true — callers must surface this explicitly; no silent loss.
   */
  async sweep(lat: number, lng: number, radiusMiles: number): Promise<SweepResult> {
    const radiusM = radiusMiles * MI_TO_METERS;
    const latOffset = radiusM * DEG_PER_METER_LAT;
    const lngOffset = latOffset / Math.max(0.01, Math.cos((lat * Math.PI) / 180));

    try {
      const result = await this.pool.query<{
        parcel_id: string;
        site_address: string | null;
        county_zoning_code: string | null;
        county_zoning_desc: string | null;
        land_use_code: string | null;
        lot_area_sf: string | null;
        lot_width_ft: string | null;
        lot_depth_ft: string | null;
        centroid_lat: string;
        centroid_lng: string;
        distance_m: string;
        raw_record: Record<string, unknown> | null;
        total_count: string;
      }>(
        `SELECT
           parcel_id,
           site_address,
           county_zoning_code,
           county_zoning_desc,
           land_use_code,
           lot_area_sf,
           lot_width_ft,
           lot_depth_ft,
           centroid_lat,
           centroid_lng,
           ST_Distance(
             ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
           ) AS distance_m,
           raw_record,
           COUNT(*) OVER() AS total_count
         FROM county_parcels
         WHERE centroid_lat BETWEEN $1 - $3 AND $1 + $3
           AND centroid_lng BETWEEN $2 - $4 AND $2 + $4
           AND centroid_lat IS NOT NULL
           AND centroid_lng IS NOT NULL
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $5
           )
           AND ${MF_ZONING_CONDITIONS}
         ORDER BY distance_m
         LIMIT $6`,
        [lat, lng, latOffset, lngOffset, radiusM, MAX_PARCELS],
      );

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      const truncated = totalCount > MAX_PARCELS;

      const parcels: SweptParcel[] = result.rows.map((r) => ({
        parcelId: r.parcel_id,
        address: r.site_address ?? null,
        zoningCode: r.county_zoning_code ?? null,
        zoningDesc: r.county_zoning_desc ?? null,
        landUseCode: r.land_use_code ?? null,
        lotAreaSf: Math.max(1, parseFloat(r.lot_area_sf ?? '0') || 0),
        lotWidthFt: r.lot_width_ft ? parseFloat(r.lot_width_ft) || null : null,
        lotDepthFt: r.lot_depth_ft ? parseFloat(r.lot_depth_ft) || null : null,
        centroidLat: parseFloat(r.centroid_lat),
        centroidLng: parseFloat(r.centroid_lng),
        distanceMiles: parseFloat(r.distance_m) / MI_TO_METERS,
        rawRecord: r.raw_record ?? {},
      }));

      return { parcels, truncated, totalCount };
    } catch (err) {
      logger.warn('[RadiusSweepService] sweep query failed', {
        lat, lng, radiusMiles, err: (err as Error).message,
      });
      return { parcels: [], truncated: false, totalCount: 0 };
    }
  }
}
