/**
 * Snapshot Capture Service
 *
 * Orchestrates monthly market_snapshots captures for the Atlanta MSA and
 * its key submarkets. Called by the Inngest cron function on the 1st of
 * each month at 02:00 UTC.
 *
 * Data sources per snapshot:
 *   - apartment_locator_properties: rent, occupancy, total units
 *   - market_sale_comps (georgia_county): cap rate, price/unit
 *   - apartment_supply_pipeline: units under construction / delivering
 *   - market_events: forward supply (supply_delivery, supply_announced)
 */

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

const ATLANTA_GEOGRAPHIES = [
  { type: 'msa',       id: 'atlanta',        name: 'Atlanta-Sandy Springs-Roswell, GA' },
  { type: 'submarket', id: 'midtown',         name: 'Midtown Atlanta' },
  { type: 'submarket', id: 'buckhead',        name: 'Buckhead' },
  { type: 'submarket', id: 'west_end',        name: 'West End' },
  { type: 'submarket', id: 'old_fourth_ward', name: 'Old Fourth Ward' },
  { type: 'submarket', id: 'downtown',        name: 'Downtown Atlanta' },
  { type: 'submarket', id: 'reynoldstown',    name: 'Reynoldstown' },
  { type: 'submarket', id: 'vinings',         name: 'Vinings' },
  { type: 'submarket', id: 'pittsburgh',      name: 'Pittsburgh / Sylvan Hills' },
  { type: 'submarket', id: 'north_fulton',    name: 'North Fulton' },
] as const;

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
    // Snap to the 1st of the month (cron fires on the 1st)
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
      } catch (err: any) {
        logger.error('[SnapshotCapture] Failed to capture snapshot', {
          geo: geo.id,
          date: isoDate,
          error: err.message,
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
    pool: ReturnType<typeof getPool>,
    geo: { type: string; id: string; name: string },
    snapshotDate: Date,
    isoDate: string
  ): Promise<SnapshotCaptureResult> {
    const isMsa = geo.type === 'msa';

    // ── Rent & occupancy from apartment_locator_properties ──────────────────
    // For MSA: all GA=GA + city ILIKE 'Atlanta%'
    // For submarkets: match on submarket keyword heuristics OR fall back to MSA level
    const alpResult = await pool.query(`
      SELECT
        COUNT(*)::int                             AS total_properties,
        COALESCE(SUM(total_units), 0)::int        AS total_units,
        AVG(avg_asking_rent)   FILTER (WHERE avg_asking_rent > 0)   AS avg_asking_rent,
        AVG(avg_effective_rent) FILTER (WHERE avg_effective_rent > 0) AS avg_effective_rent,
        AVG(occupancy_pct) FILTER (WHERE occupancy_pct BETWEEN 0.5 AND 1.0) AS avg_occupancy_pct
      FROM apartment_locator_properties
      WHERE state = 'GA'
        AND city ILIKE 'Atlanta%'
    `);

    const alpRow = alpResult.rows[0];

    // ── Cap rate & price/unit from market_sale_comps ────────────────────────
    const mscResult = await pool.query(`
      SELECT
        AVG(cap_rate) FILTER (WHERE cap_rate BETWEEN 0.03 AND 0.12) AS avg_cap_rate,
        AVG(price_per_unit) FILTER (WHERE price_per_unit > 0)       AS avg_price_per_unit
      FROM market_sale_comps
      WHERE state = 'GA'
        AND source = 'georgia_county'
        AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
        ${isMsa ? '' : `AND (county ILIKE $1 OR submarket ILIKE $1)`}
    `, isMsa ? [] : [geo.id.replace('_', ' ')]);

    const mscRow = mscResult.rows[0];

    // ── Supply pipeline from apartment_supply_pipeline ─────────────────────
    const aspResult = await pool.query(`
      SELECT
        COALESCE(SUM(units_delivering), 0)::int   AS units_delivering,
        COALESCE(SUM(total_units), 0)::int        AS total_pipeline_units
      FROM apartment_supply_pipeline
      WHERE state = 'GA'
        AND city ILIKE 'Atlanta%'
    `);

    const aspRow = aspResult.rows[0];

    // ── Forward supply from market_events ───────────────────────────────────
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
    const fields = [
      alpRow?.avg_asking_rent,
      alpRow?.avg_effective_rent,
      alpRow?.avg_occupancy_pct,
      mscRow?.avg_cap_rate,
      mscRow?.avg_price_per_unit,
      aspRow?.units_delivering,
    ];
    const populated = fields.filter(f => f != null && parseFloat(f) !== 0).length;
    const completeness = Math.round((populated / fields.length) * 100) / 100;

    // ── Upsert into market_snapshots ────────────────────────────────────────
    await pool.query(`
      INSERT INTO market_snapshots (
        geography_type, geography_id, geography_name, snapshot_date, snapshot_type,
        total_properties, total_units,
        avg_asking_rent, avg_effective_rent, avg_occupancy_pct,
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
        $14,
        $15
      )
      ON CONFLICT (geography_type, geography_id, snapshot_date) DO UPDATE SET
        total_properties       = EXCLUDED.total_properties,
        total_units            = EXCLUDED.total_units,
        avg_asking_rent        = EXCLUDED.avg_asking_rent,
        avg_effective_rent     = EXCLUDED.avg_effective_rent,
        avg_occupancy_pct      = EXCLUDED.avg_occupancy_pct,
        avg_cap_rate           = EXCLUDED.avg_cap_rate,
        avg_price_per_unit     = EXCLUDED.avg_price_per_unit,
        units_under_construction = EXCLUDED.units_under_construction,
        planned_units_24mo     = EXCLUDED.planned_units_24mo,
        data_completeness_score = EXCLUDED.data_completeness_score,
        data_sources           = EXCLUDED.data_sources
    `, [
      geo.type,
      geo.id,
      geo.name,
      snapshotDate,
      alpRow?.total_properties ? parseInt(alpRow.total_properties) : null,
      alpRow?.total_units ? parseInt(alpRow.total_units) : null,
      alpRow?.avg_asking_rent ? parseFloat(alpRow.avg_asking_rent) : null,
      alpRow?.avg_effective_rent ? parseFloat(alpRow.avg_effective_rent) : null,
      alpRow?.avg_occupancy_pct ? parseFloat(alpRow.avg_occupancy_pct) : null,
      mscRow?.avg_cap_rate ? parseFloat(mscRow.avg_cap_rate) : null,
      mscRow?.avg_price_per_unit ? parseFloat(mscRow.avg_price_per_unit) : null,
      aspRow?.units_delivering ? parseInt(aspRow.units_delivering) : null,
      evtRow?.planned_24mo ? parseInt(evtRow.planned_24mo) : null,
      completeness,
      ['apartment_locator_properties', 'market_sale_comps', 'apartment_supply_pipeline', 'market_events'],
    ]);

    logger.info('[SnapshotCapture] Captured snapshot', {
      geography: geo.id,
      date: isoDate,
      completeness,
    });

    return {
      geography_type: geo.type,
      geography_id: geo.id,
      geography_name: geo.name,
      snapshot_date: isoDate,
      total_properties: alpRow?.total_properties ? parseInt(alpRow.total_properties) : null,
      total_units: alpRow?.total_units ? parseInt(alpRow.total_units) : null,
      avg_asking_rent: alpRow?.avg_asking_rent ? parseFloat(alpRow.avg_asking_rent) : null,
      avg_effective_rent: alpRow?.avg_effective_rent ? parseFloat(alpRow.avg_effective_rent) : null,
      avg_occupancy_pct: alpRow?.avg_occupancy_pct ? parseFloat(alpRow.avg_occupancy_pct) : null,
      avg_cap_rate: mscRow?.avg_cap_rate ? parseFloat(mscRow.avg_cap_rate) : null,
      avg_price_per_unit: mscRow?.avg_price_per_unit ? parseFloat(mscRow.avg_price_per_unit) : null,
      units_under_construction: aspRow?.units_delivering ? parseInt(aspRow.units_delivering) : null,
      planned_units_24mo: evtRow?.planned_24mo ? parseInt(evtRow.planned_24mo) : null,
      data_completeness_score: completeness,
    };
  }

  /**
   * Retrieve the most recent snapshots for each Atlanta geography.
   * Used by GET /georgia/snapshots.
   */
  async getLatestSnapshots(options: {
    geography_type?: string;
    geography_id?: string;
    months?: number;
  } = {}): Promise<any[]> {
    const pool = getPool();
    const { geography_type, geography_id, months = 12 } = options;

    const params: any[] = [months];
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

    const result = await pool.query(`
      SELECT
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
        vacancy_rate,
        rent_growth_yoy,
        avg_cap_rate,
        avg_price_per_unit,
        units_under_construction,
        planned_units_24mo,
        data_completeness_score,
        data_sources,
        created_at
      FROM market_snapshots
      WHERE ${filters.join(' AND ')}
      ORDER BY geography_id, snapshot_date DESC
    `, params);

    return result.rows.map((r: any) => ({
      ...r,
      avg_asking_rent:     r.avg_asking_rent     != null ? parseFloat(r.avg_asking_rent)     : null,
      avg_effective_rent:  r.avg_effective_rent  != null ? parseFloat(r.avg_effective_rent)  : null,
      avg_occupancy_pct:   r.avg_occupancy_pct   != null ? parseFloat(r.avg_occupancy_pct)   : null,
      vacancy_rate:        r.vacancy_rate        != null ? parseFloat(r.vacancy_rate)        : null,
      rent_growth_yoy:     r.rent_growth_yoy     != null ? parseFloat(r.rent_growth_yoy)     : null,
      avg_cap_rate:        r.avg_cap_rate        != null ? parseFloat(r.avg_cap_rate)        : null,
      avg_price_per_unit:  r.avg_price_per_unit  != null ? parseFloat(r.avg_price_per_unit)  : null,
      data_completeness_score: r.data_completeness_score != null
        ? parseFloat(r.data_completeness_score)
        : null,
    }));
  }
}

export const snapshotCaptureService = new SnapshotCaptureService();
