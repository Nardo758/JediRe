import { Pool } from 'pg';
import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

export class RentScraperAggregationService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  // Push scraped floor plan data → comp_unit_types for a specific property
  async pushToCompUnitTypes(targetId: number, jobId?: number): Promise<{
    compId: string | null;
    rowsUpserted: number;
    message: string;
  }> {
    // Aggregate today's scraped_rents for this target by unit type
    const agg = await this.pool.query(
      `SELECT
         unit_type,
         bedrooms,
         ROUND(AVG(sqft))::int            AS avg_sf,
         ROUND(AVG(rent_amount)::numeric, 2) AS avg_rent,
         ROUND(AVG(rent_max)::numeric, 2)    AS avg_rent_max,
         SUM(COALESCE(available_units, 0))   AS available_units
       FROM scraped_rents
       WHERE target_id = $1
         AND date_scraped = CURRENT_DATE
         ${jobId ? 'AND job_id = $2' : ''}
         AND rent_amount IS NOT NULL
       GROUP BY unit_type, bedrooms
       ORDER BY bedrooms ASC NULLS LAST`,
      jobId ? [targetId, jobId] : [targetId]
    );

    if (agg.rows.length === 0) {
      return { compId: null, rowsUpserted: 0, message: 'No scraped data for today' };
    }

    // Find matching comp_properties by property name
    const target = await this.pool.query(
      `SELECT t.property_name, t.address, t.city, t.unit_count
       FROM rent_scrape_targets t WHERE t.id = $1`,
      [targetId]
    );
    if (target.rows.length === 0) {
      return { compId: null, rowsUpserted: 0, message: 'Target not found' };
    }

    const { property_name, address, city, unit_count } = target.rows[0];

    // Look for existing comp_properties match by name similarity
    const namePattern = `%${property_name.toLowerCase().substring(0, 20)}%`;
    let compMatchQuery = `SELECT id, total_units FROM comp_properties WHERE LOWER(name) ILIKE $1`;
    const compMatchParams: any[] = [namePattern];

    if (address && address.trim().length > 3) {
      compMatchQuery += ` OR LOWER(address) ILIKE $2`;
      compMatchParams.push(`%${address.toLowerCase().substring(0, 20)}%`);
    }
    compMatchQuery += ` LIMIT 1`;

    const compMatch = await this.pool.query(compMatchQuery, compMatchParams);

    if (compMatch.rows.length === 0) {
      logger.info(`[aggregation] No comp_properties match for "${property_name}" — skipping comp_unit_types backflow`);
      return { compId: null, rowsUpserted: 0, message: `No comp match for "${property_name}"` };
    }

    const compId = compMatch.rows[0].id;
    const totalUnits = compMatch.rows[0].total_units || unit_count || null;

    let rowsUpserted = 0;

    for (const row of agg.rows) {
      const vacancyPct = (totalUnits && row.available_units !== null)
        ? Math.round((row.available_units / totalUnits) * 100 * 100) / 100
        : null;

      await this.pool.query(
        `INSERT INTO comp_unit_types
           (comp_id, unit_type, avg_sf, avg_rent, vacancy_pct, scraped_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (comp_id, unit_type)
         DO UPDATE SET
           avg_sf = EXCLUDED.avg_sf,
           avg_rent = EXCLUDED.avg_rent,
           vacancy_pct = COALESCE(EXCLUDED.vacancy_pct, comp_unit_types.vacancy_pct),
           scraped_at = NOW()`,
        [compId, row.unit_type, row.avg_sf, row.avg_rent, vacancyPct]
      );
      rowsUpserted++;
    }

    logger.info(`[aggregation] Upserted ${rowsUpserted} unit types for "${property_name}" → comp ${compId}`);
    return { compId, rowsUpserted, message: `Upserted ${rowsUpserted} unit types for comp ${compId}` };
  }

  // Aggregate scraped rents by submarket → apartment_market_snapshots
  async pushToApartmentMarketSnapshots(market: string = 'Atlanta'): Promise<{
    submarkets: string[];
    rowsUpserted: number;
  }> {
    // Get latest scraped data per target per unit type (most recent date)
    const agg = await this.pool.query(
      `WITH latest AS (
         SELECT DISTINCT ON (sr.target_id, sr.unit_type)
           sr.target_id,
           t.submarket,
           sr.bedrooms,
           sr.rent_amount
         FROM scraped_rents sr
         JOIN rent_scrape_targets t ON t.id = sr.target_id
         WHERE t.market = $1
           AND sr.rent_amount IS NOT NULL
         ORDER BY sr.target_id, sr.unit_type, sr.date_scraped DESC
       )
       SELECT
         COALESCE(submarket, 'Atlanta Overall')  AS submarket,
         ROUND(AVG(rent_amount) FILTER (WHERE bedrooms = 0)::numeric, 2) AS avg_studio,
         ROUND(AVG(rent_amount) FILTER (WHERE bedrooms = 1)::numeric, 2) AS avg_1br,
         ROUND(AVG(rent_amount) FILTER (WHERE bedrooms = 2)::numeric, 2) AS avg_2br,
         ROUND(AVG(rent_amount) FILTER (WHERE bedrooms = 3)::numeric, 2) AS avg_3br,
         ROUND(AVG(rent_amount)::numeric, 2)                             AS avg_overall,
         COUNT(DISTINCT target_id)                                        AS property_count
       FROM latest
       GROUP BY submarket
       ORDER BY submarket`,
      [market]
    );

    if (agg.rows.length === 0) {
      return { submarkets: [], rowsUpserted: 0 };
    }

    const submarkets: string[] = [];

    for (const row of agg.rows) {
      // apartment_market_snapshots unique on (city, state, snapshot_date)
      await this.pool.query(
        `INSERT INTO apartment_market_snapshots
           (city, state, snapshot_date, source,
            avg_rent_studio, avg_rent_1br, avg_rent_2br, avg_rent_3br,
            studio_rent, one_br_rent, two_br_rent, three_br_rent,
            avg_rent, updated_at)
         VALUES ($1, 'GA', CURRENT_DATE, 'rent_scraper',
                 $2, $3, $4, $5,
                 $2, $3, $4, $5,
                 $6, NOW())
         ON CONFLICT (city, state, snapshot_date)
         DO UPDATE SET
           avg_rent_studio = COALESCE(EXCLUDED.avg_rent_studio, apartment_market_snapshots.avg_rent_studio),
           avg_rent_1br    = COALESCE(EXCLUDED.avg_rent_1br,    apartment_market_snapshots.avg_rent_1br),
           avg_rent_2br    = COALESCE(EXCLUDED.avg_rent_2br,    apartment_market_snapshots.avg_rent_2br),
           avg_rent_3br    = COALESCE(EXCLUDED.avg_rent_3br,    apartment_market_snapshots.avg_rent_3br),
           studio_rent     = COALESCE(EXCLUDED.studio_rent,     apartment_market_snapshots.studio_rent),
           one_br_rent     = COALESCE(EXCLUDED.one_br_rent,     apartment_market_snapshots.one_br_rent),
           two_br_rent     = COALESCE(EXCLUDED.two_br_rent,     apartment_market_snapshots.two_br_rent),
           three_br_rent   = COALESCE(EXCLUDED.three_br_rent,   apartment_market_snapshots.three_br_rent),
           avg_rent        = COALESCE(EXCLUDED.avg_rent,        apartment_market_snapshots.avg_rent),
           source          = 'rent_scraper',
           updated_at      = NOW()`,
        [row.submarket, row.avg_studio, row.avg_1br, row.avg_2br, row.avg_3br, row.avg_overall]
      );
      submarkets.push(row.submarket);
    }

    logger.info(`[aggregation] Upserted market snapshots for ${submarkets.length} submarkets in ${market}`);
    return { submarkets, rowsUpserted: submarkets.length };
  }

  // Summary of what has been scraped so far
  async getScrapeSummary(market: string = 'Atlanta'): Promise<any> {
    const summary = await this.pool.query(
      `SELECT
         COUNT(DISTINCT t.id)                                      AS total_targets,
         COUNT(DISTINCT t.id) FILTER (WHERE t.website_url IS NOT NULL) AS targets_with_website,
         COUNT(DISTINCT t.id) FILTER (WHERE t.places_search_done)  AS discovery_done,
         COUNT(DISTINCT sr.target_id)                               AS targets_scraped,
         COUNT(sr.id)                                               AS total_floor_plan_rows,
         ROUND(AVG(sr.rent_amount)::numeric, 0)                    AS overall_avg_rent,
         ROUND(AVG(sr.rent_amount) FILTER (WHERE sr.bedrooms = 0)::numeric, 0) AS avg_studio,
         ROUND(AVG(sr.rent_amount) FILTER (WHERE sr.bedrooms = 1)::numeric, 0) AS avg_1br,
         ROUND(AVG(sr.rent_amount) FILTER (WHERE sr.bedrooms = 2)::numeric, 0) AS avg_2br,
         ROUND(AVG(sr.rent_amount) FILTER (WHERE sr.bedrooms = 3)::numeric, 0) AS avg_3br,
         MAX(sr.date_scraped)                                       AS last_scraped
       FROM rent_scrape_targets t
       LEFT JOIN scraped_rents sr ON sr.target_id = t.id
       WHERE t.market = $1`,
      [market]
    );

    const bySubmarket = await this.pool.query(
      `SELECT
         t.submarket,
         COUNT(DISTINCT t.id)       AS properties,
         COUNT(DISTINCT sr.target_id) AS scraped,
         ROUND(AVG(sr.rent_amount)::numeric, 0) AS avg_rent,
         ROUND(AVG(sr.rent_amount) FILTER (WHERE sr.bedrooms = 1)::numeric, 0) AS avg_1br
       FROM rent_scrape_targets t
       LEFT JOIN scraped_rents sr ON sr.target_id = t.id AND sr.date_scraped = (
         SELECT MAX(s2.date_scraped) FROM scraped_rents s2 WHERE s2.target_id = t.id
       )
       WHERE t.market = $1 AND t.active = TRUE
       GROUP BY t.submarket
       ORDER BY COUNT(DISTINCT t.id) DESC`,
      [market]
    );

    return { ...summary.rows[0], bySubmarket: bySubmarket.rows };
  }
}
