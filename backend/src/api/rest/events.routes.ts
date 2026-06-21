/**
 * Events Routes — Digital Traffic Score & Engagement Tracking
 *
 * Exposes the DigitalTrafficService with full provenance / breakdown so
 * consumers can audit how scores are derived and what data sources feed
 * each component.
 *
 * Endpoints:
 *   GET /events/score/:propertyId        — current score + breakdown
 *   GET /events/score/:propertyId/raw    — raw inputs (views, saves, etc.)
 *   POST /events/track                   — track a single event
 *   POST /events/track/batch             — track batch events
 *   GET /events/trending                 — trending properties
 *   GET /events/engagement/:propertyId   — 30-day engagement history
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { DigitalTrafficService } from '../../services/digitalTrafficService';
import { logger } from '../../utils/logger';

export function createEventsRoutes(pool: Pool): Router {
  const router = Router();
  const service = new DigitalTrafficService(pool);

  /**
   * GET /events/score/:propertyId
   *
   * Returns the digital traffic score (0-100) plus a full breakdown of
   * how the score was computed, including raw data sources, weights, and
   * the formulas used for each component.
   *
   * Score components:
   *   • Views (0-40 pts) — from property_engagement_daily.views
   *   • Engagement (0-30 pts) — from property_engagement_daily.saves + shares
   *   • Analysis runs (0-20 pts) — from property_engagement_daily.analysis_runs
   *   • Velocity (0-10 pts) — from property_events week-over-week growth
   *
   * Data sources:
   *   • property_engagement_daily (views, saves, shares, analysis_runs, unique_users)
   *   • property_events (event counts, user IDs, event_type = 'analysis_run')
   *   • digital_traffic_scores (output cache)
   */
  router.get('/score/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const score = await service.calculateDigitalScore(propertyId);
      const breakdown = await service.getScoreBreakdown(propertyId);

      res.json({
        property_id: propertyId,
        ...score,
        breakdown,
        _provenance: {
          algorithm_version: '1.0.0',
          data_sources: [
            { table: 'property_engagement_daily', columns: ['views', 'saves', 'shares', 'analysis_runs', 'unique_users'], window: '7 days' },
            { table: 'property_events', columns: ['event_type', 'user_id', 'timestamp'], window: '14 days' },
          ],
          scoring_weights: {
            views: '40% (0-40 pts, tiered)',
            engagement: '30% (0-30 pts, saves 3×, shares 1.5×)',
            analysis_runs: '20% (0-20 pts, 5 pts each)',
            velocity: '10% (0-10 pts, week-over-week growth)',
          },
          institutional_interest_threshold: {
            unique_users_7d: '>= 5',
            analysis_runs_distinct_users: '>= 3',
          },
        },
      });
    } catch (error: any) {
      logger.error('[EventsRoutes] Score fetch failed', { error: error.message, propertyId: req.params.propertyId });
      res.status(500).json({ error: 'Failed to fetch digital score', message: error.message });
    }
  });

  /**
   * GET /events/score/:propertyId/raw
   *
   * Returns the raw input data used to compute the score, without the
   * calculated score itself. Useful for debugging and data-quality audits.
   */
  router.get('/score/:propertyId/raw', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const raw = await service.getRawInputs(propertyId);
      res.json({ property_id: propertyId, raw });
    } catch (error: any) {
      logger.error('[EventsRoutes] Raw inputs fetch failed', { error: error.message, propertyId: req.params.propertyId });
      res.status(500).json({ error: 'Failed to fetch raw inputs', message: error.message });
    }
  });

  /**
   * POST /events/track
   *
   * Track a single property engagement event.
   */
  router.post('/track', async (req: Request, res: Response) => {
    try {
      const { property_id, event_type, metadata, session_id, referrer } = req.body;
      if (!property_id || !event_type) {
        return res.status(400).json({ error: 'property_id and event_type are required' });
      }

      await pool.query(
        `INSERT INTO property_events (property_id, event_type, metadata, session_id, referrer, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [property_id, event_type, JSON.stringify(metadata || {}), session_id, referrer]
      );

      res.json({ success: true, property_id, event_type });
    } catch (error: any) {
      logger.error('[EventsRoutes] Track event failed', { error: error.message });
      res.status(500).json({ error: 'Failed to track event', message: error.message });
    }
  });

  /**
   * POST /events/track/batch
   *
   * Track multiple events in a single request.
   */
  router.post('/track/batch', async (req: Request, res: Response) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events array is required' });
      }

      for (const event of events) {
        const { property_id, event_type, metadata, session_id, referrer } = event;
        await pool.query(
          `INSERT INTO property_events (property_id, event_type, metadata, session_id, referrer, timestamp)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [property_id, event_type, JSON.stringify(metadata || {}), session_id, referrer]
        );
      }

      res.json({ success: true, count: events.length });
    } catch (error: any) {
      logger.error('[EventsRoutes] Batch track failed', { error: error.message });
      res.status(500).json({ error: 'Failed to track batch events', message: error.message });
    }
  });

  /**
   * GET /events/trending
   *
   * Returns trending properties based on velocity score.
   */
  router.get('/trending', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await pool.query(
        `SELECT property_id, score, trending_velocity as velocity
         FROM digital_traffic_scores
         WHERE calculated_at >= NOW() - INTERVAL '7 days'
         ORDER BY score DESC
         LIMIT $1`,
        [limit]
      );
      res.json(result.rows);
    } catch (error: any) {
      logger.error('[EventsRoutes] Trending fetch failed', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch trending properties', message: error.message });
    }
  });

  /**
   * GET /events/engagement/:propertyId
   *
   * Returns daily engagement metrics for the last N days.
   */
  router.get('/engagement/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const result = await pool.query(
        `SELECT date, views, saves, shares, analysis_runs, unique_users
         FROM property_engagement_daily
         WHERE property_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
         ORDER BY date DESC`,
        [propertyId]
      );
      res.json(result.rows);
    } catch (error: any) {
      logger.error('[EventsRoutes] Engagement fetch failed', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch engagement history', message: error.message });
    }
  });

  return router;
}
