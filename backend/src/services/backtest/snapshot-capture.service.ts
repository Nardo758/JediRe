/**
 * Snapshot Capture Service
 *
 * Orchestrates monthly market_snapshots captures for the Atlanta MSA and
 * its key submarkets. Called by the Inngest cron function on the 1st of
 * each month at 02:00 UTC.
 *
 * Data sources per snapshot (in order of precedence):
 *   1. apartment_locator_properties  — rent, occupancy, total units
 *      (MSA: city='Atlanta'; submarket: lat/lon proximity within ~3 mi of centroid)
 *   2. property_proximity            — avg walk/transit score per submarket
 *      (costar_market_metrics is not present in this environment)
 *   3. market_sale_comps (georgia_county) — cap rate, price/unit
 *   4. apartment_supply_pipeline     — units delivering
 *   5. market_events                 — forward supply planned within 24 months
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface SnapshotCaptureResult {
  geography_type: string;
  geography_id: string;
  geography_name: string;
  snapshot_date: string;
  total_properties: number | null;
  total_units: number | null;
  avg_asking_rent: number | null;
  avg_effective_rent: number | null;
  avg_occupancy_pct: number | null;
  avg_walk_score: number | null;
  avg_transit_score: number | null;
  avg_cap_rate: number | null;
  avg_price_per_unit: number | null;
  units_under_construction: number | null;
  planned_units_24mo: number | null;
  data_completeness_score: number;
}

export interface CaptureMonthlyResult {
  snapshot_date: string;
  captured: number;
  skipped: number;
  errors: number;
  results: SnapshotCaptureResult[];
}

interface Geography {
  type: string;
  id: string;
  name: string;
  /** Approximate centroid for submarket proximity queries (WGS-84) */
  lat?: number;
  lng?: number;
}

/** Approximate centroids for each Atlanta submarket (WGS-84) */
const ATLANTA_GEOGRAPHIES: Geography[] = [
  { type: 'msa',       id: 'atlanta',        name: 'Atlanta-Sandy Springs-Roswell, GA' },
  { type: 'submarket', id: 'midtown',         name: 'Midtown Atlanta',          lat: 33.7848, lng: -84.3832 },
  { type: 'submarket', id: 'buckhead',        name: 'Buckhead',                 lat: 33.8390, lng: -84.3800 },
  { type: 'submarket', id: 'west_end',        name: 'West End',                 lat: 33.7338, lng: -84.4136 },
  { type: 'submarket', id: 'old_fourth_ward', name: 'Old Fourth Ward',          lat: 33.7576, lng: -84.3648 },
  { type: 'submarket', id: 'downtown',        name: 'Downtown Atlanta',         lat: 33.7490, lng: -84.3880 },
  { type: 'submarket', id: 'reynoldstown',    name: 'Reynoldstown',             lat: 33.7502, lng: -84.3508 },
  { type: 'submarket', id: 'vinings',         name: 'Vinings',                  lat: 33.8593, lng: -84.4588 },
  { type: 'submarket', id: 'pittsburgh',      name: 'Pittsburgh / Sylvan Hills', lat: 33.7218, lng: -84.4010 },
  { type: 'submarket', id: 'north_fulton',    name: 'North Fulton',             lat: 34.0200, lng: -84.3600 },
];

/** Proximity radius (miles) for submarket apartment queries */
const SUBMARKET_RADIUS_MILES = 3.0;

class SnapshotCaptureService {
  /**
   * Capture monthly snapshots for all Atlanta geographies.
   * Idempotent: uses ON CONFLICT DO UPDATE so re-running on the same month
   * refreshes figures without duplicating rows.
   */
  async captureMonthlySnapshots(
    overrideDate?: Date
  ): Promise<CaptureMonthlyResult> {
    const pool = getPool();
    const snapshotDate = overrideDate ?? new Date();
    const firstOfMonth = new Date(
      snapshotDate.getFullYear(),
      snapshotDate.getMonth(),
      1
    );
    const isoDate = firstOfMonth.toISOString().slice(0, 10);

    const results: SnapshotCaptureResult[] = [];
    let captured = 0;
    let skipped = 0;
    let errors = 0;

    for (const geo of ATLANTA_GEOGRAPHIES) {
      try {
        const snap = await this.captureOneSnapshot(pool, geo, firstOfMonth, isoDate);
        results.push(snap);
        captured++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[SnapshotCapture] Failed to capture snapshot', {
          geo: geo.id,
          date: isoDate,
          error: msg,
        });
        errors++;
      }
    }

    logger.info('[SnapshotCapture] Monthly capture complete', {
      snapshot_date: isoDate,
      captured,
      skipped,
      errors,
    });

    return { snapshot_date: isoDate, captured, skipped, errors, results };
  }

  private async captureOneSnapshot(
    pool: Pool,
    geo: Geography,
    snapshotDate: Date,
    isoDate: string
  ): Promise<SnapshotCaptureResult> {
    const isMsa = geo.type === 'msa';

    // ── 1. Rent & occupancy from apartment_locator_properties ──────────────
    // MSA:       all properties with city ILIKE 'Atlanta%', state = 'GA'
    // Submarket: properties within SUBMARKET_RADIUS_MILES of the centroid
    let alpResult: QueryResult<QueryResultRow>;

    if (isMsa) {
      alpResult = await pool.query(`
        SELECT
          COUNT(*)::int                                                        AS total_properties,
          COALESCE(SUM(total_units), 0)::int                                  AS total_units,
          AVG(avg_asking_rent)    FILTER (WHERE avg_asking_rent > 0)           AS avg_asking_rent,
          AVG(avg_effective_rent) FILTER (WHERE avg_effective_rent > 0)        AS avg_effective_rent,
          AVG(occupancy_pct)      FILTER (WHERE occupancy_pct BETWEEN 0.5 AND 1.0) AS avg_occupancy_pct
        FROM apartment_locator_properties
        WHERE state = 'GA'
          AND city ILIKE 'Atlanta%'
      `);
    } else {
      alpResult = await pool.query(`
        SELECT
          COUNT(*)::int                                                        AS total_properties,
          COALESCE(SUM(total_units), 0)::int                                  AS total_units,
          AVG(avg_asking_rent)    FILTER (WHERE avg_asking_rent > 0)           AS avg_asking_rent,
          AVG(avg_effective_rent) FILTER (WHERE avg_effective_rent > 0)        AS avg_effective_rent,
          AVG(occupancy_pct)      FILTER (WHERE occupancy_pct BETWEEN 0.5 AND 1.0) AS avg_occupancy_pct
        FROM apartment_locator_properties
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            point(longitude::float, latitude::float)
            <@> point($2::float, $1::float)
          ) <= $3
      `, [geo.lat, geo.lng, SUBMARKET_RADIUS_MILES]);
    }

    const alpRow = alpResult.rows[0];

    // ── 2. Walk/transit scores from property_proximity ──────────────────────
    // property_proximity is property-scoped; aggregate within the same radius.
    // costar_market_metrics is not present in this environment.
    let ppRow: QueryResultRow | undefined;

    if (!isMsa && geo.lat && geo.lng) {
      const ppResult = await pool.query(`
        SELECT
          AVG(walk_score)    FILTER (WHERE walk_score BETWEEN 0 AND 100) AS avg_walk_score,
          AVG(transit_score) FILTER (WHERE transit_score BETWEEN 0 AND 100) AS avg_transit_score
        FROM property_proximity
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            point(longitude::float, latitude::float)
            <@> point($2::float, $1::float)
          ) <= $3
      `, [geo.lat, geo.lng, SUBMARKET_RADIUS_MILES]);
      ppRow = ppResult.rows[0];
    }

    // ── 3. Cap rate & price/unit from market_sale_comps ────────────────────
    const mscResult = await pool.query(`
      SELECT
        AVG(cap_rate)       FILTER (WHERE cap_rate BETWEEN 0.03 AND 0.12) AS avg_cap_rate,
        AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)             AS avg_price_per_unit
      FROM market_sale_comps
      WHERE state = 'GA'
        AND source = 'georgia_county'
        AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
    `);

    const mscRow = mscResult.rows[0];

    // ── 4. Supply pipeline from apartment_supply_pipeline ──────────────────
    const aspResult = await pool.query(`
      SELECT
        COALESCE(SUM(units_delivering), 0)::int AS units_delivering
      FROM apartment_supply_pipeline
      WHERE state = 'GA'
        AND city ILIKE 'Atlanta%'
    `);

    const aspRow = aspResult.rows[0];

    // ── 5. Forward supply from market_events ───────────────────────────────
    const evtResult = await pool.query(`
      SELECT
        COALESCE(SUM(
          CASE WHEN effective_date <= CURRENT_DATE + INTERVAL '24 months'
               THEN COALESCE(units_affected, 0) END
        ), 0)::int AS planned_24mo
      FROM market_events
      WHERE event_type IN ('supply_delivery', 'supply_announced', 'supply_groundbreaking')
        AND (geography_id = $1 OR geography_type = 'msa')
        AND effective_date >= CURRENT_DATE
    `, [geo.id]);

    const evtRow = evtResult.rows[0];

    // ── Compute data completeness score ─────────────────────────────────────
    const completenessFields: (string | null)[] = [
      alpRow?.avg_asking_rent,
      alpRow?.avg_effective_rent,
      alpRow?.avg_occupancy_pct,
      mscRow?.avg_cap_rate,
      mscRow?.avg_price_per_unit,
      aspRow?.units_delivering !== undefined && aspRow.units_delivering > 0
        ? String(aspRow.units_delivering)
        : null,
    ];
    const populated = completenessFields.filter(
      f => f != null && parseFloat(String(f)) !== 0
    ).length;
    const completeness = Math.round((populated / completenessFields.length) * 100) / 100;

    // ── Upsert into market_snapshots ────────────────────────────────────────
    await pool.query(`
      INSERT INTO market_snapshots (
        geography_type, geography_id, geography_name, snapshot_date, snapshot_type,
        total_properties, total_units,
        avg_asking_rent, avg_effective_rent, avg_occupancy_pct,
        avg_walk_score, avg_transit_score,
        avg_cap_rate, avg_price_per_unit,
        units_under_construction, planned_units_24mo,
        data_completeness_score,
        data_sources
      ) VALUES (
        $1, $2, $3, $4, 'monthly',
        $5, $6,
        $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        $16,
        $17
      )
      ON CONFLICT (geography_type, geography_id, snapshot_date) DO UPDATE SET
        total_properties         = EXCLUDED.total_properties,
        total_units              = EXCLUDED.total_units,
        avg_asking_rent          = EXCLUDED.avg_asking_rent,
        avg_effective_rent       = EXCLUDED.avg_effective_rent,
        avg_occupancy_pct        = EXCLUDED.avg_occupancy_pct,
        avg_walk_score           = EXCLUDED.avg_walk_score,
        avg_transit_score        = EXCLUDED.avg_transit_score,
        avg_cap_rate             = EXCLUDED.avg_cap_rate,
        avg_price_per_unit       = EXCLUDED.avg_price_per_unit,
        units_under_construction = EXCLUDED.units_under_construction,
        planned_units_24mo       = EXCLUDED.planned_units_24mo,
        data_completeness_score  = EXCLUDED.data_completeness_score,
        data_sources             = EXCLUDED.data_sources
    `, [
      geo.type,
      geo.id,
      geo.name,
      snapshotDate,
      alpRow?.total_properties != null ? parseInt(String(alpRow.total_properties)) : null,
      alpRow?.total_units != null ? parseInt(String(alpRow.total_units)) : null,
      alpRow?.avg_asking_rent != null ? parseFloat(String(alpRow.avg_asking_rent)) : null,
      alpRow?.avg_effective_rent != null ? parseFloat(String(alpRow.avg_effective_rent)) : null,
      alpRow?.avg_occupancy_pct != null ? parseFloat(String(alpRow.avg_occupancy_pct)) : null,
      ppRow?.avg_walk_score != null ? parseFloat(String(ppRow.avg_walk_score)) : null,
      ppRow?.avg_transit_score != null ? parseFloat(String(ppRow.avg_transit_score)) : null,
      mscRow?.avg_cap_rate != null ? parseFloat(String(mscRow.avg_cap_rate)) : null,
      mscRow?.avg_price_per_unit != null ? parseFloat(String(mscRow.avg_price_per_unit)) : null,
      aspRow?.units_delivering != null ? parseInt(String(aspRow.units_delivering)) : null,
      evtRow?.planned_24mo != null ? parseInt(String(evtRow.planned_24mo)) : null,
      completeness,
      ['apartment_locator_properties', 'property_proximity', 'market_sale_comps',
       'apartment_supply_pipeline', 'market_events'],
    ]);

    logger.info('[SnapshotCapture] Captured snapshot', {
      geography: geo.id,
      date: isoDate,
      completeness,
      avg_asking_rent: alpRow?.avg_asking_rent != null
        ? parseFloat(String(alpRow.avg_asking_rent)) : null,
    });

    return {
      geography_type:        geo.type,
      geography_id:          geo.id,
      geography_name:        geo.name,
      snapshot_date:         isoDate,
      total_properties:      alpRow?.total_properties != null ? parseInt(String(alpRow.total_properties)) : null,
      total_units:           alpRow?.total_units != null ? parseInt(String(alpRow.total_units)) : null,
      avg_asking_rent:       alpRow?.avg_asking_rent != null ? parseFloat(String(alpRow.avg_asking_rent)) : null,
      avg_effective_rent:    alpRow?.avg_effective_rent != null ? parseFloat(String(alpRow.avg_effective_rent)) : null,
      avg_occupancy_pct:     alpRow?.avg_occupancy_pct != null ? parseFloat(String(alpRow.avg_occupancy_pct)) : null,
      avg_walk_score:        ppRow?.avg_walk_score != null ? parseFloat(String(ppRow.avg_walk_score)) : null,
      avg_transit_score:     ppRow?.avg_transit_score != null ? parseFloat(String(ppRow.avg_transit_score)) : null,
      avg_cap_rate:          mscRow?.avg_cap_rate != null ? parseFloat(String(mscRow.avg_cap_rate)) : null,
      avg_price_per_unit:    mscRow?.avg_price_per_unit != null ? parseFloat(String(mscRow.avg_price_per_unit)) : null,
      units_under_construction: aspRow?.units_delivering != null ? parseInt(String(aspRow.units_delivering)) : null,
      planned_units_24mo:    evtRow?.planned_24mo != null ? parseInt(String(evtRow.planned_24mo)) : null,
      data_completeness_score: completeness,
    };
  }

  /**
   * Retrieve the latest snapshot per geography for Atlanta.
   * Returns exactly one row per (geography_type, geography_id) pair —
   * the most recent snapshot within the requested window.
   * Used by GET /georgia/snapshots.
   */
  async getLatestSnapshots(options: {
    geography_type?: string;
    geography_id?: string;
    months?: number;
  } = {}): Promise<SnapshotCaptureResult[]> {
    const pool = getPool();
    const { geography_type, geography_id, months = 12 } = options;

    const params: (string | number)[] = [months];
    const filters: string[] = [
      `snapshot_date >= CURRENT_DATE - ($1 || ' months')::interval`,
    ];

    if (geography_type) {
      params.push(geography_type);
      filters.push(`geography_type = $${params.length}`);
    }
    if (geography_id) {
      params.push(geography_id);
      filters.push(`geography_id = $${params.length}`);
    }

    const result = await pool.query<{
      id: string;
      geography_type: string;
      geography_id: string;
      geography_name: string;
      snapshot_date: string;
      snapshot_type: string;
      total_properties: string | null;
      total_units: string | null;
      avg_asking_rent: string | null;
      avg_effective_rent: string | null;
      avg_occupancy_pct: string | null;
      avg_walk_score: string | null;
      avg_transit_score: string | null;
      avg_cap_rate: string | null;
      avg_price_per_unit: string | null;
      units_under_construction: string | null;
      planned_units_24mo: string | null;
      data_completeness_score: string | null;
      data_sources: string[] | null;
    }>(`
      SELECT DISTINCT ON (geography_type, geography_id)
        id,
        geography_type,
        geography_id,
        geography_name,
        snapshot_date::text,
        snapshot_type,
        total_properties,
        total_units,
        avg_asking_rent,
        avg_effective_rent,
        avg_occupancy_pct,
        avg_walk_score,
        avg_transit_score,
        avg_cap_rate,
        avg_price_per_unit,
        units_under_construction,
        planned_units_24mo,
        data_completeness_score,
        data_sources
      FROM market_snapshots
      WHERE ${filters.join(' AND ')}
      ORDER BY geography_type, geography_id, snapshot_date DESC
    `, params);

    return result.rows.map(r => ({
      geography_type:          r.geography_type,
      geography_id:            r.geography_id,
      geography_name:          r.geography_name,
      snapshot_date:           r.snapshot_date,
      total_properties:        r.total_properties != null ? parseInt(r.total_properties) : null,
      total_units:             r.total_units != null ? parseInt(r.total_units) : null,
      avg_asking_rent:         r.avg_asking_rent != null ? parseFloat(r.avg_asking_rent) : null,
      avg_effective_rent:      r.avg_effective_rent != null ? parseFloat(r.avg_effective_rent) : null,
      avg_occupancy_pct:       r.avg_occupancy_pct != null ? parseFloat(r.avg_occupancy_pct) : null,
      avg_walk_score:          r.avg_walk_score != null ? parseFloat(r.avg_walk_score) : null,
      avg_transit_score:       r.avg_transit_score != null ? parseFloat(r.avg_transit_score) : null,
      avg_cap_rate:            r.avg_cap_rate != null ? parseFloat(r.avg_cap_rate) : null,
      avg_price_per_unit:      r.avg_price_per_unit != null ? parseFloat(r.avg_price_per_unit) : null,
      units_under_construction: r.units_under_construction != null ? parseInt(r.units_under_construction) : null,
      planned_units_24mo:      r.planned_units_24mo != null ? parseInt(r.planned_units_24mo) : null,
      data_completeness_score: r.data_completeness_score != null ? parseFloat(r.data_completeness_score) : 0,
    }));
  }
}

export const snapshotCaptureService = new SnapshotCaptureService();
