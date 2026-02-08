/**
 * News Intelligence API Routes
 * Event feed, market dashboard, alerts, and network intelligence
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { query } from '../../database/connection';

const logger = { error: (...args: any[]) => console.error(...args) };

const router = Router();

/**
 * GET /api/v1/news/events
 * Get news events with filtering
 */
router.get('/events', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const {
      category,
      source_type,
      severity,
      limit = 50,
      offset = 0,
      include_private = 'true',
    } = req.query;

    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by category
    if (category && category !== 'all') {
      whereConditions.push(`ne.event_category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Filter by source type
    if (source_type) {
      whereConditions.push(`ne.source_type = $${paramIndex}`);
      params.push(source_type);
      paramIndex++;
    }

    // Filter by severity
    if (severity) {
      whereConditions.push(`ne.impact_severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    // Include private events only for the current user
    if (include_private === 'true') {
      whereConditions.push(`(ne.source_type = 'public' OR ne.source_user_id = $${paramIndex})`);
      params.push(userId);
      paramIndex++;
    } else {
      whereConditions.push(`ne.source_type = 'public'`);
    }

    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT 
        ne.*,
        COUNT(DISTINCT negi.deal_id) as affected_deals_count,
        COUNT(DISTINCT negi.property_id) as affected_properties_count
      FROM news_events ne
      LEFT JOIN news_event_geo_impacts negi ON negi.event_id = ne.id
      ${whereClause}
      GROUP BY ne.id
      ORDER BY ne.published_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(sql, params);

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM news_events ne
      ${whereClause}
    `;
    const countResult = await query(countSql, params.slice(0, -2));

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching news events:', error);
    next(error);
  }
});

/**
 * GET /api/v1/news/events/:id
 * Get single event with full details
 */
router.get('/events/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT ne.*,
        array_agg(DISTINCT jsonb_build_object(
          'deal_id', negi.deal_id,
          'property_id', negi.property_id,
          'impact_type', negi.impact_type,
          'distance_miles', negi.distance_miles,
          'impact_score', negi.impact_score
        )) FILTER (WHERE negi.id IS NOT NULL) as geographic_impacts
      FROM news_events ne
      LEFT JOIN news_event_geo_impacts negi ON negi.event_id = ne.id
      WHERE ne.id = $1
        AND (ne.source_type = 'public' OR ne.source_user_id = $2)
      GROUP BY ne.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching news event:', error);
    next(error);
  }
});

/**
 * GET /api/v1/news/dashboard
 * Get market dashboard metrics
 */
router.get('/dashboard', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { trade_area_id, submarket_id } = req.query;

    // Get demand momentum (employment events)
    const demandResult = await query(
      `SELECT 
        SUM(CASE 
          WHEN event_type LIKE '%inbound%' OR event_type LIKE '%hiring%' 
          THEN (extracted_data->>'employee_count')::INTEGER 
          ELSE 0 
        END) as inbound_jobs,
        SUM(CASE 
          WHEN event_type LIKE '%outbound%' 
          THEN (extracted_data->>'employee_count')::INTEGER 
          ELSE 0 
        END) as outbound_jobs,
        SUM(CASE 
          WHEN event_type LIKE '%layoff%' 
          THEN (extracted_data->>'employee_count')::INTEGER 
          ELSE 0 
        END) as layoff_jobs
      FROM news_events ne
      WHERE ne.event_category = 'employment'
        AND ne.published_at > NOW() - INTERVAL '12 months'
        AND (ne.source_type = 'public' OR ne.source_user_id = $1)`,
      [userId]
    );

    const demand = demandResult.rows[0];
    const netJobs = (demand.inbound_jobs || 0) - (demand.outbound_jobs || 0) - (demand.layoff_jobs || 0);
    const estimatedHousingDemand = Math.round(netJobs * 0.65 * 0.67); // occupancy_factor * household_factor

    // Get supply pressure (development events)
    const supplyResult = await query(
      `SELECT 
        SUM((extracted_data->>'unit_count')::INTEGER) as pipeline_units,
        COUNT(*) as project_count
      FROM news_events ne
      WHERE ne.event_category = 'development'
        AND ne.event_type LIKE '%permit%'
        AND ne.published_at > NOW() - INTERVAL '6 months'
        AND (ne.source_type = 'public' OR ne.source_user_id = $1)`,
      [userId]
    );

    const supply = supplyResult.rows[0];

    // Get transaction activity
    const transactionsResult = await query(
      `SELECT 
        COUNT(*) as transaction_count,
        AVG((extracted_data->>'cap_rate')::DECIMAL) as avg_cap_rate,
        AVG((extracted_data->>'price_per_unit')::INTEGER) as avg_price_per_unit
      FROM news_events ne
      WHERE ne.event_category = 'transactions'
        AND ne.published_at > NOW() - INTERVAL '6 months'
        AND (ne.source_type = 'public' OR ne.source_user_id = $1)`,
      [userId]
    );

    const transactions = transactionsResult.rows[0];

    res.json({
      success: true,
      data: {
        demand_momentum: {
          inbound_jobs: demand.inbound_jobs || 0,
          outbound_jobs: demand.outbound_jobs || 0,
          layoff_jobs: demand.layoff_jobs || 0,
          net_jobs: netJobs,
          estimated_housing_demand: estimatedHousingDemand,
          momentum_pct: netJobs > 0 ? 3.2 : -1.5, // Simplified calculation
        },
        supply_pressure: {
          pipeline_units: supply.pipeline_units || 0,
          project_count: supply.project_count || 0,
          pressure_pct: 8.5, // TODO: Calculate based on existing inventory
        },
        transaction_activity: {
          count: parseInt(transactions.transaction_count) || 0,
          avg_cap_rate: parseFloat(transactions.avg_cap_rate) || null,
          avg_price_per_unit: parseInt(transactions.avg_price_per_unit) || null,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching market dashboard:', error);
    next(error);
  }
});

/**
 * GET /api/v1/news/alerts
 * Get user's news alerts
 */
router.get('/alerts', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const { unread_only = 'false', severity, limit = 50, offset = 0 } = req.query;

    let whereConditions = ['na.user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (unread_only === 'true') {
      whereConditions.push('na.is_read = FALSE');
    }

    if (severity) {
      whereConditions.push(`na.severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));

    const sql = `
      SELECT 
        na.*,
        ne.event_category,
        ne.event_type,
        ne.location_raw,
        d.name as deal_name,
        p.address_line1 as property_name
      FROM news_alerts na
      JOIN news_events ne ON ne.id = na.event_id
      LEFT JOIN deals d ON d.id = na.linked_deal_id
      LEFT JOIN properties p ON p.id = na.linked_property_id
      WHERE ${whereConditions.join(' AND ')}
        AND (na.is_dismissed = FALSE OR na.is_dismissed IS NULL)
        AND (na.snoozed_until IS NULL OR na.snoozed_until < NOW())
      ORDER BY na.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(sql, params);

    // Get unread count
    const countResult = await query(
      'SELECT COUNT(*) as unread FROM news_alerts WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      unread_count: parseInt(countResult.rows[0].unread),
    });
  } catch (error) {
    logger.error('Error fetching news alerts:', error);
    next(error);
  }
});

/**
 * PATCH /api/v1/news/alerts/:id
 * Mark alert as read/dismissed/snoozed
 */
router.patch('/alerts/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const { is_read, is_dismissed, snooze_hours } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (typeof is_read === 'boolean') {
      updates.push(`is_read = $${paramIndex}`);
      params.push(is_read);
      paramIndex++;
      if (is_read) {
        updates.push(`read_at = NOW()`);
      }
    }

    if (typeof is_dismissed === 'boolean') {
      updates.push(`is_dismissed = $${paramIndex}`);
      params.push(is_dismissed);
      paramIndex++;
      if (is_dismissed) {
        updates.push(`dismissed_at = NOW()`);
      }
    }

    if (snooze_hours) {
      updates.push(`snoozed_until = NOW() + INTERVAL '${parseInt(snooze_hours)} hours'`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided',
      });
    }

    params.push(id);
    params.push(userId);

    const sql = `
      UPDATE news_alerts
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating alert:', error);
    next(error);
  }
});

/**
 * GET /api/v1/news/network
 * Get network intelligence (contact credibility)
 */
router.get('/network', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT 
        contact_name,
        contact_company,
        contact_role,
        total_signals,
        corroborated_signals,
        credibility_score,
        specialties,
        last_signal_at
      FROM news_contact_credibility
      WHERE user_id = $1
        AND total_signals >= 3
      ORDER BY credibility_score DESC, total_signals DESC
      LIMIT 20`,
      [userId]
    );

    // Calculate average early signal days
    const earlySignalResult = await query(
      `SELECT AVG(early_signal_days) as avg_early_days
      FROM news_events ne
      WHERE ne.source_user_id = $1
        AND ne.early_signal_days IS NOT NULL`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        contacts: result.rows,
        avg_early_signal_days: parseFloat(earlySignalResult.rows[0].avg_early_days) || 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching network intelligence:', error);
    next(error);
  }
});

export default router;
