/**
 * Property Events API Routes
 * 
 * Endpoints for tracking user engagement with properties and calculating
 * digital traffic scores for property ranking and insights.
 * 
 * Part of Week 1 (Events Infrastructure) of the 8-week traffic engine roadmap.
 * 
 * @version 1.0.0
 * @date 2025-02-18
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { DigitalTrafficService } from '../../services/digitalTrafficService';

export function createEventsRoutes(pool: Pool): Router {
  const router = Router();
  const trafficService = new DigitalTrafficService(pool);

  // ============================================================================
  // POST /api/events/track
  // Track single property engagement event
  // ============================================================================

  /**
   * Track a single event (view, save, share, analysis)
   * 
   * Request body:
   * {
   *   property_id: string (UUID),
   *   event_type: string ('search_impression' | 'map_click' | 'detail_view' | 'analysis_run' | 'saved' | 'shared'),
   *   metadata?: object (optional context data)
   * }
   * 
   * Auto-captures: user_id (from auth), timestamp, session_id
   */
  router.post('/track', async (req: Request, res: Response) => {
    try {
      const { property_id, event_type, metadata = {} } = req.body;

      // Validate required fields
      if (!property_id || !event_type) {
        return res.status(400).json({
          error: 'Missing required fields: property_id, event_type'
        });
      }

      // Validate event_type
      const validEventTypes = [
        'search_impression',
        'map_click',
        'detail_view',
        'analysis_run',
        'saved',
        'shared'
      ];

      if (!validEventTypes.includes(event_type)) {
        return res.status(400).json({
          error: `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}`
        });
      }

      // Auto-capture user_id from auth (req.user)
      // TODO: Wire up auth middleware properly
      const user_id = (req as any).user?.id || '00000000-0000-0000-0000-000000000000';

      // Auto-capture session_id from request
      const session_id = (req as any).sessionID || req.headers['x-session-id'] || null;

      // Auto-capture referrer
      const referrer = req.headers.referer || req.headers.referrer || null;

      // Insert event
      const result = await pool.query(
        `INSERT INTO property_events (property_id, user_id, event_type, metadata, session_id, referrer)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, property_id, event_type, timestamp`,
        [property_id, user_id, event_type, JSON.stringify(metadata), session_id, referrer]
      );

      const event = result.rows[0];

      res.json({
        success: true,
        event_id: event.id,
        property_id: event.property_id,
        event_type: event.event_type,
        timestamp: event.timestamp
      });
    } catch (error: any) {
      console.error('Error tracking event:', error);
      res.status(500).json({
        error: 'Failed to track event',
        message: error.message
      });
    }
  });

  // ============================================================================
  // POST /api/events/track-batch
  // Track multiple events in bulk for performance
  // ============================================================================

  /**
   * Track multiple events in a single request (batch processing)
   * 
   * Request body:
   * {
   *   events: [
   *     { property_id, event_type, metadata? },
   *     { property_id, event_type, metadata? },
   *     ...
   *   ]
   * }
   */
  router.post('/track-batch', async (req: Request, res: Response) => {
    try {
      const { events } = req.body;

      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          error: 'events must be a non-empty array'
        });
      }

      // Validate each event
      const validEventTypes = [
        'search_impression',
        'map_click',
        'detail_view',
        'analysis_run',
        'saved',
        'shared'
      ];

      for (const event of events) {
        if (!event.property_id || !event.event_type) {
          return res.status(400).json({
            error: 'Each event must have property_id and event_type'
          });
        }

        if (!validEventTypes.includes(event.event_type)) {
          return res.status(400).json({
            error: `Invalid event_type: ${event.event_type}`
          });
        }
      }

      // Auto-capture common fields
      const user_id = (req as any).user?.id || '00000000-0000-0000-0000-000000000000';
      const session_id = (req as any).sessionID || req.headers['x-session-id'] || null;
      const referrer = req.headers.referer || req.headers.referrer || null;

      // Build bulk insert query
      const values: any[] = [];
      const valuePlaceholders: string[] = [];

      events.forEach((event, index) => {
        const offset = index * 6;
        valuePlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
        );

        values.push(
          event.property_id,
          user_id,
          event.event_type,
          JSON.stringify(event.metadata || {}),
          session_id,
          referrer
        );
      });

      const insertQuery = `
        INSERT INTO property_events (property_id, user_id, event_type, metadata, session_id, referrer)
        VALUES ${valuePlaceholders.join(', ')}
      `;

      await pool.query(insertQuery, values);

      res.json({
        success: true,
        events_tracked: events.length,
        message: `Successfully tracked ${events.length} events`
      });
    } catch (error: any) {
      console.error('Error tracking batch events:', error);
      res.status(500).json({
        error: 'Failed to track batch events',
        message: error.message
      });
    }
  });

  // ============================================================================
  // GET /api/events/daily/:propertyId
  // Get daily aggregations for a property (last 30 days)
  // ============================================================================

  /**
   * Get daily engagement metrics for a property
   * 
   * Returns: Array of daily stats with trend indicators
   */
  router.get('/daily/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const { days = 30 } = req.query;

      const result = await pool.query(
        `SELECT 
          date,
          views,
          saves,
          shares,
          analysis_runs,
          unique_users,
          created_at
         FROM property_engagement_daily
         WHERE property_id = $1
           AND date >= CURRENT_DATE - INTERVAL '${parseInt(days as string)} days'
         ORDER BY date DESC`,
        [propertyId]
      );

      // Calculate trends (compare to previous day)
      const dailyStats = result.rows.map((row, index) => {
        const prevRow = result.rows[index + 1];
        let trend = 'flat';

        if (prevRow) {
          const totalToday = row.views + row.saves + row.shares + row.analysis_runs;
          const totalYesterday = prevRow.views + prevRow.saves + prevRow.shares + prevRow.analysis_runs;

          if (totalToday > totalYesterday * 1.1) trend = 'up';
          else if (totalToday < totalYesterday * 0.9) trend = 'down';
        }

        return {
          ...row,
          trend
        };
      });

      res.json({
        property_id: propertyId,
        period_days: parseInt(days as string),
        daily_stats: dailyStats,
        total_records: dailyStats.length
      });
    } catch (error: any) {
      console.error('Error fetching daily stats:', error);
      res.status(500).json({
        error: 'Failed to fetch daily stats',
        message: error.message
      });
    }
  });

  // ============================================================================
  // GET /api/events/score/:propertyId
  // Get digital traffic score for a property (cached 1 hour)
  // ============================================================================

  /**
   * Get comprehensive digital traffic score
   * 
   * Returns:
   * {
   *   score: number (0-100),
   *   breakdown: { views, saves, shares, velocity },
   *   trending: boolean,
   *   institutional_interest: boolean
   * }
   */
  router.get('/score/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;

      // Check cache first (scores calculated within last hour)
      const cacheResult = await pool.query(
        `SELECT 
          score,
          weekly_views,
          weekly_saves,
          trending_velocity,
          institutional_interest_flag,
          unique_users_7d,
          calculated_at
         FROM digital_traffic_scores
         WHERE property_id = $1
           AND calculated_at > NOW() - INTERVAL '1 hour'
         ORDER BY calculated_at DESC
         LIMIT 1`,
        [propertyId]
      );

      let scoreData;

      if (cacheResult.rows.length > 0) {
        // Use cached score
        scoreData = cacheResult.rows[0];
      } else {
        // Calculate fresh score
        scoreData = await trafficService.calculateDigitalScore(propertyId);
      }

      res.json({
        property_id: propertyId,
        score: scoreData.score,
        breakdown: {
          weekly_views: scoreData.weekly_views,
          weekly_saves: scoreData.weekly_saves,
          trending_velocity: parseFloat(scoreData.trending_velocity),
          unique_users_7d: scoreData.unique_users_7d
        },
        trending: scoreData.trending_velocity > 20,
        institutional_interest: scoreData.institutional_interest_flag,
        calculated_at: scoreData.calculated_at
      });
    } catch (error: any) {
      console.error('Error fetching score:', error);
      res.status(500).json({
        error: 'Failed to fetch digital traffic score',
        message: error.message
      });
    }
  });

  // ============================================================================
  // GET /api/events/trending
  // Get trending properties (highest velocity, top 10)
  // ============================================================================

  /**
   * Get trending properties ranked by week-over-week growth
   * 
   * Query params:
   * - submarket (optional): Filter by submarket
   * - property_type (optional): Filter by property type
   */
  router.get('/trending', async (req: Request, res: Response) => {
    try {
      const { submarket, property_type, limit = 10 } = req.query;

      // Base query: get properties with highest velocity
      let query_sql = `
        SELECT 
          dts.property_id,
          dts.score,
          dts.trending_velocity,
          dts.weekly_views,
          dts.weekly_saves,
          dts.institutional_interest_flag,
          dts.unique_users_7d,
          dts.calculated_at,
          p.address_line1,
          p.city,
          p.state_code,
          p.property_type
        FROM digital_traffic_scores dts
        JOIN properties p ON p.id = dts.property_id
        WHERE dts.calculated_at > NOW() - INTERVAL '24 hours'
      `;

      const params: any[] = [];

      // Apply filters
      if (submarket) {
        params.push(submarket);
        // TODO: Wire up submarket filtering when properties table has submarket field
        // query_sql += ` AND p.submarket = $${params.length}`;
      }

      if (property_type) {
        params.push(property_type);
        query_sql += ` AND p.property_type = $${params.length}`;
      }

      query_sql += `
        ORDER BY dts.trending_velocity DESC, dts.score DESC
        LIMIT $${params.length + 1}
      `;

      params.push(parseInt(limit as string));

      const result = await pool.query(query_sql, params);

      // Calculate growth percentage
      const trendingProperties = result.rows.map(row => ({
        property_id: row.property_id,
        score: row.score,
        velocity: parseFloat(row.trending_velocity),
        growth_percentage: parseFloat(row.trending_velocity),
        weekly_views: row.weekly_views,
        weekly_saves: row.weekly_saves,
        unique_users: row.unique_users_7d,
        institutional_interest: row.institutional_interest_flag,
        property: {
          address: row.address_line1,
          city: row.city,
          state: row.state_code,
          type: row.property_type
        },
        calculated_at: row.calculated_at
      }));

      res.json({
        trending_properties: trendingProperties,
        count: trendingProperties.length,
        filters: {
          submarket: submarket || null,
          property_type: property_type || null
        }
      });
    } catch (error: any) {
      console.error('Error fetching trending properties:', error);
      res.status(500).json({
        error: 'Failed to fetch trending properties',
        message: error.message
      });
    }
  });

  // ============================================================================
  // POST /api/events/aggregate-daily
  // Run daily aggregation (cron job endpoint)
  // ============================================================================

  /**
   * Aggregate yesterday's events into daily engagement table
   * 
   * This should be called by a scheduled task (cron) once per day
   * 
   * Returns: Count of properties updated
   */
  router.post('/aggregate-daily', async (req: Request, res: Response) => {
    try {
      const { date } = req.body;
      
      // Default to yesterday if no date provided
      const targetDate = date || new Date(Date.now() - 86400000).toISOString().split('T')[0];

      console.log(`[Daily Aggregation] Starting aggregation for date: ${targetDate}`);

      // Aggregate events from yesterday
      const aggregationQuery = `
        INSERT INTO property_engagement_daily (property_id, date, views, saves, shares, analysis_runs, unique_users)
        SELECT 
          property_id,
          DATE($1) as date,
          COUNT(*) FILTER (WHERE event_type IN ('search_impression', 'map_click', 'detail_view')) as views,
          COUNT(*) FILTER (WHERE event_type = 'saved') as saves,
          COUNT(*) FILTER (WHERE event_type = 'shared') as shares,
          COUNT(*) FILTER (WHERE event_type = 'analysis_run') as analysis_runs,
          COUNT(DISTINCT user_id) as unique_users
        FROM property_events
        WHERE DATE(timestamp) = DATE($1)
        GROUP BY property_id
        ON CONFLICT (property_id, date) 
        DO UPDATE SET
          views = EXCLUDED.views,
          saves = EXCLUDED.saves,
          shares = EXCLUDED.shares,
          analysis_runs = EXCLUDED.analysis_runs,
          unique_users = EXCLUDED.unique_users,
          created_at = NOW()
        RETURNING property_id
      `;

      const result = await pool.query(aggregationQuery, [targetDate]);

      const propertiesUpdated = result.rows.length;

      console.log(`[Daily Aggregation] Completed: ${propertiesUpdated} properties updated`);

      res.json({
        success: true,
        date: targetDate,
        properties_updated: propertiesUpdated,
        message: `Daily aggregation completed for ${targetDate}`
      });
    } catch (error: any) {
      console.error('Error running daily aggregation:', error);
      res.status(500).json({
        error: 'Failed to run daily aggregation',
        message: error.message
      });
    }
  });

  return router;
}

export default createEventsRoutes;
