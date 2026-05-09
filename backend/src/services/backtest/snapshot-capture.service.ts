/**
 * Snapshot Capture Service
 *
 * Orchestrates monthly market_snapshots captures for the Atlanta MSA and
 * its key submarkets. Called by the Inngest cron function on the 1st of
 * each month at 02:00 UTC.
 *
 * Data sources per snapshot (in priority order):
 *   1. costar_market_metrics  — primary: submarket rent, occupancy, cap rate,
 *      vacancy, absorption (populated when CoStar feed is active)
 *   2. apartment_locator_properties — fallback when costar has no row for the
 *      geography; proximity-filtered by submarket centroid (≤3 mi)
 *   3. property_proximity     — avg walk/transit score; proximity-filtered by
 *      submarket centroid (≤3 mi), companion aggregate required by spec
 *   4. market_sale_comps      — cap rate & price/unit; proximity-filtered for
 *      submarkets, city-scoped for MSA
 *   5. apartment_supply_pipeline — delivering units; proximity-filtered for
 *      submarkets, city-scoped for MSA
 *   6. market_events          — forward supply planned within 24 months
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
  costar_sourced: boolean;
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
  /** Centroid for submarket proximity queries (WGS-84) */
  lat?: number;
  lng?: number;
}

/** Approximate centroids for each Atlanta submarket (WGS-84) */
const ATLANTA_GEOGRAPHIES: Geography[] = [
  { type: 'msa',       id: 'atlanta',        name: 'Atlanta-Sandy Springs-Roswell, GA' },
  { type: 'submarket', id: 'midtown',         name: 'Midtown Atlanta',           lat: 33.7848, lng: -84.3832 },
  { type: 'submarket', id: 'buckhead',        name: 'Buckhead',                  lat: 33.8390, lng: -84.3800 },
  { type: 'submarket', id: 'west_end',        name: 'West End',                  lat: 33.7338, lng: -84.4136 },
  { type: 'submarket', id: 'old_fourth_ward', name: 'Old Fourth Ward',           lat: 33.7576, lng: -84.3648 },
  { type: 'submarket', id: 'downtown',        name: 'Downtown Atlanta',          lat: 33.7490, lng: -84.3880 },
  { type: 'submarket', id: 'reynoldstown',    name: 'Reynoldstown',              lat: 33.7502, lng: -84.3508 },
  { type: 'submarket', id: 'vinings',         name: 'Vinings',                   lat: 33.8593, lng: -84.4588 },
  { type: 'submarket', id: 'pittsburgh',      name: 'Pittsburgh / Sylvan Hills',  lat: 33.7218, lng: -84.4010 },
  { type: 'submarket', id: 'north_fulton',    name: 'North Fulton',              lat: 34.0200, lng: -84.3600 },
];

/** Proximity radius (statute miles) for submarket queries */
const SUBMARKET_RADIUS_MILES = 3.0;

interface CostarRow extends QueryResultRow {
  avg_asking_rent: string | null;
  avg_effective_rent: string | null;
  avg_occupancy_pct: string | null;
  avg_cap_rate: string | null;
  avg_price_per_unit: string | null;
  units_under_construction: string | null;
}

interface AlpRow extends QueryResultRow {
  total_properties: string | null;
  total_units: string | null;
  avg_asking_rent: string | null;
  avg_effective_rent: string | null;
  avg_occupancy_pct: string | null;
}

interface ProximityRow extends QueryResultRow {
  avg_walk_score: string | null;
  avg_transit_score: string | null;
}

interface MscRow extends QueryResultRow {
  avg_cap_rate: string | null;
  avg_price_per_unit: string | null;
}

interface AspRow extends QueryResultRow {
  units_delivering: string | null;
}

interface EvtRow extends QueryResultRow {
  planned_24mo: string | null;
}

class SnapshotCaptureService {
  /**
   * Capture monthly snapshots for all Atlanta geographies.
   * Idempotent: ON CONFLICT DO UPDATE so re-running on the same month refreshes
   * figures without duplicating rows.
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

    // ── 1. Primary: costar_market_metrics ──────────────────────────────────
    // Preferred source for submarket rent, occupancy, cap rate, vacancy.
    // Falls back to apartment_locator_properties when costar has no row.
    const costarResult = await pool.query<CostarRow>(`
      SELECT
        avg_asking_rent,
        avg_effective_rent,
        avg_occupancy_pct,
        avg_cap_rate,
        avg_price_per_unit,
        units_under_construction
      FROM costar_market_metrics
      WHERE geography_id = $1
        AND as_of_date >= CURRENT_DATE - INTERVAL '45 days'
      ORDER BY as_of_date DESC
      LIMIT 1
    `, [geo.id]);

    const costarRow = costarResult.rows[0] ?? null;
    const costarSourced = costarRow !== null;

    // ── 2. Fallback: apartment_locator_properties (proximity-scoped) ────────
    // MSA:       all Atlanta GA properties
    // Submarket: properties within SUBMARKET_RADIUS_MILES of centroid
    let alpResult: QueryResult<AlpRow>;
    if (isMsa) {
      alpResult = await pool.query<AlpRow>(`
        SELECT
          COUNT(*)::int                                                           AS total_properties,
          COALESCE(SUM(total_units), 0)::int                                     AS total_units,
          AVG(avg_asking_rent)    FILTER (WHERE avg_asking_rent > 0)              AS avg_asking_rent,
          AVG(avg_effective_rent) FILTER (WHERE avg_effective_rent > 0)           AS avg_effective_rent,
          AVG(occupancy_pct)      FILTER (WHERE occupancy_pct BETWEEN 0.5 AND 1.0) AS avg_occupancy_pct
        FROM apartment_locator_properties
        WHERE state = 'GA'
          AND city ILIKE 'Atlanta%'
      `);
    } else {
      alpResult = await pool.query<AlpRow>(`
        SELECT
          COUNT(*)::int                                                           AS total_properties,
          COALESCE(SUM(total_units), 0)::int                                     AS total_units,
          AVG(avg_asking_rent)    FILTER (WHERE avg_asking_rent > 0)              AS avg_asking_rent,
          AVG(avg_effective_rent) FILTER (WHERE avg_effective_rent > 0)           AS avg_effective_rent,
          AVG(occupancy_pct)      FILTER (WHERE occupancy_pct BETWEEN 0.5 AND 1.0) AS avg_occupancy_pct
        FROM apartment_locator_properties
        WHERE latitude  IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            point(longitude::float, latitude::float)
            <@> point($2::float, $1::float)
          ) <= $3
      `, [geo.lat, geo.lng, SUBMARKET_RADIUS_MILES]);
    }

    const alpRow = alpResult.rows[0] ?? null;

    // Merge: costar takes precedence for rent/occupancy; alp fills property counts
    const avgAskingRent     = this.f(costarRow?.avg_asking_rent)     ?? this.f(alpRow?.avg_asking_rent);
    const avgEffectiveRent  = this.f(costarRow?.avg_effective_rent)  ?? this.f(alpRow?.avg_effective_rent);
    const avgOccupancyPct   = this.f(costarRow?.avg_occupancy_pct)   ?? this.f(alpRow?.avg_occupancy_pct);

    // ── 3. property_proximity: walk/transit scores (companion aggregate) ─────
    // Proximity-filtered per submarket; skipped for MSA (city-wide walk score is noisy)
    let ppRow: ProximityRow | null = null;
    if (!isMsa && geo.lat != null && geo.lng != null) {
      const ppResult = await pool.query<ProximityRow>(`
        SELECT
          AVG(walk_score)    FILTER (WHERE walk_score    BETWEEN 0 AND 100) AS avg_walk_score,
          AVG(transit_score) FILTER (WHERE transit_score BETWEEN 0 AND 100) AS avg_transit_score
        FROM property_proximity
        WHERE latitude  IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            point(longitude::float, latitude::float)
            <@> point($2::float, $1::float)
          ) <= $3
      `, [geo.lat, geo.lng, SUBMARKET_RADIUS_MILES]);
      ppRow = ppResult.rows[0] ?? null;
    }

    // ── 4. market_sale_comps: cap rate & price/unit (geography-scoped) ───────
    // Submarket: proximity filter around centroid; MSA: city/state scope
    let mscRow: MscRow | null = null;
    if (!isMsa && geo.lat != null && geo.lng != null) {
      const mscResult = await pool.query<MscRow>(`
        SELECT
          AVG(cap_rate)       FILTER (WHERE cap_rate BETWEEN 0.03 AND 0.12) AS avg_cap_rate,
          AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)             AS avg_price_per_unit
        FROM market_sale_comps
        WHERE state      = 'GA'
          AND source     = 'georgia_county'
          AND sale_date >= CURRENT_DATE - INTERVAL '24 months'
          AND latitude  IS NOT NULL
          AND longitude IS NOT NULL
          AND (
            point(longitude::float, latitude::float)
            <@> point($2::float, $1::float)
          ) <= $3
      `, [geo.lat, geo.lng, SUBMARKET_RADIUS_MILES]);
      mscRow = mscResult.rows[0] ?? null;
    } else if (isMsa) {
      const mscResult = await pool.query<MscRow>(`
        SELECT
          AVG(cap_rate)       FILTER (WHERE cap_rate BETWEEN 0.03 AND 0.12) AS avg_cap_rate,
          AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)             AS avg_price_per_unit
        FROM market_sale_comps
        WHERE state      = 'GA'
          AND source     = 'georgia_county'
          AND city      ILIKE 'Atlanta%'
          AND sale_date >= CURRENT_DATE - INTERVAL '24 months'
      `);
      mscRow = mscResult.rows[0] ?? null;
    }

    // Costar cap rate / price per unit take precedence if available
    const avgCapRate       = this.f(costarRow?.avg_cap_rate)       ?? this.f(mscRow?.avg_cap_rate);
    const avgPricePerUnit  = this.f(costarRow?.avg_price_per_unit) ?? this.f(mscRow?.avg_price_per_unit);

    // ── 5. apartment_supply_pipeline: delivering units (geography-scoped) ────
    // Submarket: proximity filter; MSA: city/state scope
    let aspRow: AspRow | null = null;
    if (!isMsa && geo.lat != null && geo.lng != null) {
      // supply_pipeline lacks coordinates — join against city + proximity of known
      // apartment_locator_properties to approximate submarket scope
      const aspResult = await pool.query<AspRow>(`
        SELECT
          COALESCE(SUM(asp.units_delivering), 0)::int AS units_delivering
        FROM apartment_supply_pipeline asp
        JOIN apartment_locator_properties alp
          ON LOWER(alp.address) = LOWER(asp.address)
        WHERE alp.latitude  IS NOT NULL
          AND alp.longitude IS NOT NULL
          AND (
            point(alp.longitude::float, alp.latitude::float)
            <@> point($2::float, $1::float)
          ) <= $3
      `, [geo.lat, geo.lng, SUBMARKET_RADIUS_MILES]);
      aspRow = aspResult.rows[0] ?? null;
    } else if (isMsa) {
      const aspResult = await pool.query<AspRow>(`
        SELECT
          COALESCE(SUM(units_delivering), 0)::int AS units_delivering
        FROM apartment_supply_pipeline
        WHERE state = 'GA'
          AND city ILIKE 'Atlanta%'
      `);
      aspRow = aspResult.rows[0] ?? null;
    }

    const unitsDelivering = costarRow?.units_under_construction != null
      ? this.i(costarRow.units_under_construction)
      : this.i(aspRow?.units_delivering);

    // ── 6. market_events: forward supply (any geography match within 24mo) ───
    const evtResult = await pool.query<EvtRow>(`
      SELECT
        COALESCE(SUM(
          CASE WHEN effective_date <= CURRENT_DATE + INTERVAL '24 months'
               THEN COALESCE(units_affected, 0) END
        ), 0)::int AS planned_24mo
      FROM market_events
      WHERE event_type IN ('supply_delivery', 'supply_announced', 'supply_groundbreaking')
        AND (geography_id = $1 OR (geography_type = 'msa' AND geography_id = 'atlanta'))
        AND effective_date >= CURRENT_DATE
    `, [geo.id]);

    const plannedUnits24mo = this.i(evtResult.rows[0]?.planned_24mo);

    // ── Data completeness score ─────────────────────────────────────────────
    // total_properties is included so that a submarket with zero nearby
    // properties (proximity filter found nothing) scores meaningfully lower
    // than one with a real property cohort backing its rent figure.
    const completenessFields: (number | null)[] = [
      this.i(alpRow?.total_properties),
      avgAskingRent,
      avgEffectiveRent,
      avgOccupancyPct,
      avgCapRate,
      avgPricePerUnit,
      unitsDelivering,
    ];
    const populated = completenessFields.filter(v => v != null && v !== 0).length;
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
      this.i(alpRow?.total_properties),
      this.i(alpRow?.total_units),
      avgAskingRent,
      avgEffectiveRent,
      avgOccupancyPct,
      this.f(ppRow?.avg_walk_score),
      this.f(ppRow?.avg_transit_score),
      avgCapRate,
      avgPricePerUnit,
      unitsDelivering,
      plannedUnits24mo,
      completeness,
      ['costar_market_metrics', 'apartment_locator_properties', 'property_proximity',
       'market_sale_comps', 'apartment_supply_pipeline', 'market_events'],
    ]);

    logger.info('[SnapshotCapture] Captured snapshot', {
      geography: geo.id,
      date: isoDate,
      costar_sourced: costarSourced,
      completeness,
      avg_asking_rent: avgAskingRent,
    });

    return {
      geography_type:           geo.type,
      geography_id:             geo.id,
      geography_name:           geo.name,
      snapshot_date:            isoDate,
      total_properties:         this.i(alpRow?.total_properties),
      total_units:              this.i(alpRow?.total_units),
      avg_asking_rent:          avgAskingRent,
      avg_effective_rent:       avgEffectiveRent,
      avg_occupancy_pct:        avgOccupancyPct,
      avg_walk_score:           this.f(ppRow?.avg_walk_score),
      avg_transit_score:        this.f(ppRow?.avg_transit_score),
      avg_cap_rate:             avgCapRate,
      avg_price_per_unit:       avgPricePerUnit,
      units_under_construction: unitsDelivering,
      planned_units_24mo:       plannedUnits24mo,
      data_completeness_score:  completeness,
      costar_sourced:           costarSourced,
    };
  }

  /** Retrieve the latest snapshot per geography (DISTINCT ON).
   *  Returns exactly one row per (geography_type, geography_id) pair —
   *  the most recent snapshot within the requested window. */
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
      geography_type: string;
      geography_id: string;
      geography_name: string;
      snapshot_date: string;
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
    }>(`
      SELECT DISTINCT ON (geography_type, geography_id)
        geography_type,
        geography_id,
        geography_name,
        snapshot_date::text,
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
        data_completeness_score
      FROM market_snapshots
      WHERE ${filters.join(' AND ')}
      ORDER BY geography_type, geography_id, snapshot_date DESC
    `, params);

    return result.rows.map(r => ({
      geography_type:           r.geography_type,
      geography_id:             r.geography_id,
      geography_name:           r.geography_name,
      snapshot_date:            r.snapshot_date,
      total_properties:         this.i(r.total_properties),
      total_units:              this.i(r.total_units),
      avg_asking_rent:          this.f(r.avg_asking_rent),
      avg_effective_rent:       this.f(r.avg_effective_rent),
      avg_occupancy_pct:        this.f(r.avg_occupancy_pct),
      avg_walk_score:           this.f(r.avg_walk_score),
      avg_transit_score:        this.f(r.avg_transit_score),
      avg_cap_rate:             this.f(r.avg_cap_rate),
      avg_price_per_unit:       this.f(r.avg_price_per_unit),
      units_under_construction: this.i(r.units_under_construction),
      planned_units_24mo:       this.i(r.planned_units_24mo),
      data_completeness_score:  r.data_completeness_score != null ? parseFloat(r.data_completeness_score) : 0,
      costar_sourced:           false,
    }));
  }

  /** Parse nullable string → float or null */
  private f(v: string | null | undefined): number | null {
    if (v == null) return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
  }

  /** Parse nullable string → integer or null */
  private i(v: string | null | undefined): number | null {
    if (v == null) return null;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? null : n;
  }
}

export const snapshotCaptureService = new SnapshotCaptureService();
