import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface CompTrafficFilters {
  propertyType?: string;
  maxDistanceMiles?: number;
  minUnits?: number;
  maxUnits?: number;
  minOccupancy?: number;
  maxOccupancy?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CompTrafficRow {
  property_id: string;
  property_name: string;
  property_address: string;
  units: number;
  occupancy_pct: number;
  weekly_traffic: number;
  weekly_tours: number;
  closing_ratio: number;
  net_leases_per_week: number;
  web_sessions: number;
  visibility_score: number;
  adt: number;
  distance_miles: number;
  data_sources: string[];
  is_subject: boolean;
}

export interface CompAverages {
  avg_units: number;
  avg_occupancy_pct: number;
  avg_weekly_traffic: number;
  avg_weekly_tours: number;
  avg_closing_ratio: number;
  avg_net_leases_per_week: number;
  avg_web_sessions: number;
  avg_visibility_score: number;
  avg_adt: number;
  comp_count: number;
}

export interface CompProxyCandidate {
  property_id: string;
  property_name: string;
  ga_property_id: string;
  last_synced: string | null;
  sessions_30d: number;
}

export class CompTrafficService {
  constructor(private pool: Pool) {}

  async getTradeAreaComps(
    tradeAreaId: string,
    subjectPropertyId: string,
    filters: CompTrafficFilters = {}
  ): Promise<CompTrafficRow[]> {
    const {
      propertyType,
      maxDistanceMiles,
      minUnits,
      maxUnits,
      minOccupancy,
      maxOccupancy,
      sortBy = 'distance_miles',
      sortOrder = 'asc',
      limit = 50,
      offset = 0,
    } = filters;

    const conditions: string[] = ['tcs.trade_area_id = $1'];
    const params: any[] = [tradeAreaId];
    let paramIdx = 2;

    if (propertyType) {
      conditions.push(`p.property_type = $${paramIdx}`);
      params.push(propertyType);
      paramIdx++;
    }
    if (maxDistanceMiles !== undefined) {
      conditions.push(`tcs.distance_miles <= $${paramIdx}`);
      params.push(maxDistanceMiles);
      paramIdx++;
    }
    if (minUnits !== undefined) {
      conditions.push(`COALESCE(tcs.units, p.units, 0) >= $${paramIdx}`);
      params.push(minUnits);
      paramIdx++;
    }
    if (maxUnits !== undefined) {
      conditions.push(`COALESCE(tcs.units, p.units, 0) <= $${paramIdx}`);
      params.push(maxUnits);
      paramIdx++;
    }
    if (minOccupancy !== undefined) {
      conditions.push(`COALESCE(tcs.occupancy_pct, 0) >= $${paramIdx}`);
      params.push(minOccupancy);
      paramIdx++;
    }
    if (maxOccupancy !== undefined) {
      conditions.push(`COALESCE(tcs.occupancy_pct, 0) <= $${paramIdx}`);
      params.push(maxOccupancy);
      paramIdx++;
    }

    const allowedSorts = [
      'distance_miles', 'units', 'occupancy_pct', 'weekly_traffic',
      'weekly_tours', 'closing_ratio', 'net_leases_per_week',
      'web_sessions', 'visibility_score', 'adt', 'property_name',
    ];
    const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'distance_miles';
    const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const query = `
      SELECT DISTINCT ON (tcs.property_id)
        tcs.property_id,
        COALESCE(tcs.property_name, p.property_name, p.name, 'Unknown') AS property_name,
        COALESCE(tcs.property_address, p.address, '') AS property_address,
        COALESCE(tcs.units, p.units, 0) AS units,
        COALESCE(tcs.occupancy_pct, 0) AS occupancy_pct,
        COALESCE(tcs.weekly_traffic, 0) AS weekly_traffic,
        COALESCE(tcs.weekly_tours, 0) AS weekly_tours,
        COALESCE(tcs.closing_ratio, 0) AS closing_ratio,
        COALESCE(tcs.net_leases_per_week, 0) AS net_leases_per_week,
        COALESCE(tcs.web_sessions, pwa.sessions, 0) AS web_sessions,
        COALESCE(tcs.visibility_score, pv.overall_visibility_score, 0) AS visibility_score,
        COALESCE(tcs.adt, ptc.primary_adt, 0) AS adt,
        COALESCE(tcs.distance_miles, 0) AS distance_miles,
        COALESCE(tcs.data_sources, '[]'::jsonb) AS data_sources,
        (tcs.property_id = $${paramIdx}) AS is_subject
      FROM traffic_comp_snapshots tcs
      LEFT JOIN properties p ON p.id::text = tcs.property_id
      LEFT JOIN property_website_analytics pwa ON pwa.property_id = tcs.property_id
        AND pwa.period_end = (SELECT MAX(period_end) FROM property_website_analytics WHERE property_id = tcs.property_id)
      LEFT JOIN property_visibility pv ON pv.property_id = tcs.property_id
      LEFT JOIN property_traffic_context ptc ON ptc.property_id = tcs.property_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY tcs.property_id, tcs.snapshot_date DESC
    `;
    params.push(subjectPropertyId);
    paramIdx++;

    try {
      const result = await this.pool.query(query, params);

      const rows: CompTrafficRow[] = result.rows.map((r: any) => ({
        property_id: r.property_id,
        property_name: r.property_name,
        property_address: r.property_address,
        units: parseInt(r.units) || 0,
        occupancy_pct: parseFloat(r.occupancy_pct) || 0,
        weekly_traffic: parseInt(r.weekly_traffic) || 0,
        weekly_tours: parseInt(r.weekly_tours) || 0,
        closing_ratio: parseFloat(r.closing_ratio) || 0,
        net_leases_per_week: parseFloat(r.net_leases_per_week) || 0,
        web_sessions: parseInt(r.web_sessions) || 0,
        visibility_score: parseInt(r.visibility_score) || 0,
        adt: parseInt(r.adt) || 0,
        distance_miles: parseFloat(r.distance_miles) || 0,
        data_sources: Array.isArray(r.data_sources) ? r.data_sources : [],
        is_subject: r.is_subject === true,
      }));

      rows.sort((a, b) => {
        const aVal = (a as any)[safeSort];
        const bVal = (b as any)[safeSort];
        if (typeof aVal === 'string') {
          return safeOrder === 'ASC'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return safeOrder === 'ASC' ? aVal - bVal : bVal - aVal;
      });

      const subjectIdx = rows.findIndex(r => r.is_subject);
      if (subjectIdx > 0) {
        const [subject] = rows.splice(subjectIdx, 1);
        rows.unshift(subject);
      }

      return rows.slice(offset, offset + limit);
    } catch (error: any) {
      logger.error('[CompTraffic] getTradeAreaComps failed', { error: error.message });
      return [];
    }
  }

  async snapshotCompTraffic(tradeAreaId: string): Promise<{ count: number }> {
    try {
      const propertiesResult = await this.pool.query(
        `SELECT DISTINCT p.id AS property_id,
                COALESCE(p.property_name, p.name, 'Unknown') AS property_name,
                COALESCE(p.address, '') AS property_address,
                COALESCE(p.units, 0) AS units,
                COALESCE(p.current_occupancy, 0) AS occupancy_pct
         FROM properties p
         WHERE p.trade_area_id = $1
            OR p.id IN (
              SELECT tcs.property_id FROM traffic_comp_snapshots tcs
              WHERE tcs.trade_area_id = $1
            )`,
        [tradeAreaId]
      );

      if (propertiesResult.rows.length === 0) {
        logger.info(`[CompTraffic] No properties found in trade area ${tradeAreaId}`);
        return { count: 0 };
      }

      let insertCount = 0;

      for (const prop of propertiesResult.rows) {
        try {
          const [trafficResult, webResult, visResult, adtResult] = await Promise.all([
            this.pool.query(
              `SELECT weekly_traffic, weekly_tours, closing_ratio, expected_leases
               FROM leasing_traffic_predictions
               WHERE property_id = $1
               ORDER BY prediction_date DESC LIMIT 1`,
              [prop.property_id]
            ).catch(() => ({ rows: [] })),
            this.pool.query(
              `SELECT sessions FROM property_website_analytics
               WHERE property_id = $1
               ORDER BY period_end DESC LIMIT 1`,
              [prop.property_id]
            ).catch(() => ({ rows: [] })),
            this.pool.query(
              `SELECT overall_visibility_score FROM property_visibility
               WHERE property_id = $1`,
              [prop.property_id]
            ).catch(() => ({ rows: [] })),
            this.pool.query(
              `SELECT primary_adt FROM property_traffic_context
               WHERE property_id = $1`,
              [prop.property_id]
            ).catch(() => ({ rows: [] })),
          ]);

          const traffic = trafficResult.rows[0] || {};
          const web = webResult.rows[0] || {};
          const vis = visResult.rows[0] || {};
          const adt = adtResult.rows[0] || {};

          const dataSources: string[] = [];
          if (traffic.weekly_traffic) dataSources.push('predictions');
          if (web.sessions) dataSources.push('google_analytics');
          if (vis.overall_visibility_score) dataSources.push('visibility');
          if (adt.primary_adt) dataSources.push('dot_adt');

          await this.pool.query(
            `INSERT INTO traffic_comp_snapshots
             (property_id, trade_area_id, snapshot_date, property_name, property_address,
              units, occupancy_pct, weekly_traffic, weekly_tours, closing_ratio,
              net_leases_per_week, web_sessions, visibility_score, adt, data_sources, created_at)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
            [
              prop.property_id,
              tradeAreaId,
              prop.property_name,
              prop.property_address,
              prop.units || 0,
              prop.occupancy_pct || 0,
              traffic.weekly_traffic || 0,
              traffic.weekly_tours || 0,
              traffic.closing_ratio || 0,
              traffic.expected_leases || 0,
              web.sessions || 0,
              vis.overall_visibility_score || 0,
              adt.primary_adt || 0,
              JSON.stringify(dataSources),
            ]
          );
          insertCount++;
        } catch (propError: any) {
          logger.warn(`[CompTraffic] Snapshot failed for property ${prop.property_id}`, {
            error: propError.message,
          });
        }
      }

      logger.info(`[CompTraffic] Snapshot complete for trade area ${tradeAreaId}: ${insertCount} properties`);
      return { count: insertCount };
    } catch (error: any) {
      logger.error('[CompTraffic] snapshotCompTraffic failed', { error: error.message });
      throw error;
    }
  }

  async getCompAverages(tradeAreaId: string): Promise<CompAverages> {
    try {
      const result = await this.pool.query(
        `SELECT
           COUNT(DISTINCT property_id) AS comp_count,
           ROUND(AVG(units)) AS avg_units,
           ROUND(AVG(occupancy_pct)::numeric, 2) AS avg_occupancy_pct,
           ROUND(AVG(weekly_traffic)) AS avg_weekly_traffic,
           ROUND(AVG(weekly_tours)) AS avg_weekly_tours,
           ROUND(AVG(closing_ratio)::numeric, 4) AS avg_closing_ratio,
           ROUND(AVG(net_leases_per_week)::numeric, 2) AS avg_net_leases_per_week,
           ROUND(AVG(web_sessions)) AS avg_web_sessions,
           ROUND(AVG(visibility_score)) AS avg_visibility_score,
           ROUND(AVG(adt)) AS avg_adt
         FROM (
           SELECT DISTINCT ON (property_id)
             property_id, units, occupancy_pct, weekly_traffic, weekly_tours,
             closing_ratio, net_leases_per_week, web_sessions, visibility_score, adt
           FROM traffic_comp_snapshots
           WHERE trade_area_id = $1
           ORDER BY property_id, snapshot_date DESC
         ) latest`,
        [tradeAreaId]
      );

      const row = result.rows[0] || {};
      return {
        comp_count: parseInt(row.comp_count) || 0,
        avg_units: parseInt(row.avg_units) || 0,
        avg_occupancy_pct: parseFloat(row.avg_occupancy_pct) || 0,
        avg_weekly_traffic: parseInt(row.avg_weekly_traffic) || 0,
        avg_weekly_tours: parseInt(row.avg_weekly_tours) || 0,
        avg_closing_ratio: parseFloat(row.avg_closing_ratio) || 0,
        avg_net_leases_per_week: parseFloat(row.avg_net_leases_per_week) || 0,
        avg_web_sessions: parseInt(row.avg_web_sessions) || 0,
        avg_visibility_score: parseInt(row.avg_visibility_score) || 0,
        avg_adt: parseInt(row.avg_adt) || 0,
      };
    } catch (error: any) {
      logger.error('[CompTraffic] getCompAverages failed', { error: error.message });
      return {
        comp_count: 0,
        avg_units: 0,
        avg_occupancy_pct: 0,
        avg_weekly_traffic: 0,
        avg_weekly_tours: 0,
        avg_closing_ratio: 0,
        avg_net_leases_per_week: 0,
        avg_web_sessions: 0,
        avg_visibility_score: 0,
        avg_adt: 0,
      };
    }
  }

  async getCompProxyCandidates(tradeAreaId: string): Promise<CompProxyCandidate[]> {
    try {
      const result = await this.pool.query(
        `SELECT
           pgc.property_id,
           COALESCE(p.property_name, p.name, 'Unknown') AS property_name,
           pgc.ga_property_id,
           pgc.last_synced,
           COALESCE(pwa.sessions, 0) AS sessions_30d
         FROM property_ga_connections pgc
         INNER JOIN traffic_comp_snapshots tcs
           ON tcs.property_id = pgc.property_id AND tcs.trade_area_id = $1
         LEFT JOIN properties p ON p.id::text = pgc.property_id
         LEFT JOIN property_website_analytics pwa
           ON pwa.property_id = pgc.property_id
           AND pwa.is_comp_proxy = false
           AND pwa.period_end >= (CURRENT_DATE - INTERVAL '60 days')
         WHERE pgc.connection_status = 'active'
         ORDER BY pwa.sessions DESC NULLS LAST`,
        [tradeAreaId]
      );

      const seen = new Set<string>();
      const candidates: CompProxyCandidate[] = [];
      for (const row of result.rows) {
        if (!seen.has(row.property_id)) {
          seen.add(row.property_id);
          candidates.push({
            property_id: row.property_id,
            property_name: row.property_name,
            ga_property_id: row.ga_property_id,
            last_synced: row.last_synced,
            sessions_30d: parseInt(row.sessions_30d) || 0,
          });
        }
      }

      return candidates;
    } catch (error: any) {
      logger.error('[CompTraffic] getCompProxyCandidates failed', { error: error.message });
      return [];
    }
  }
}
