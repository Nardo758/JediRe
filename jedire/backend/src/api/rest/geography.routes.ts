/**
 * Geography API Routes
 * Endpoints for geographic hierarchy (MSAs, Submarkets, Trade Areas)
 * and geocoding/event assignment
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { query } from '../../database/connection';
import { geocodingService } from '../../services/geocoding.service';
import { geographicAssignmentService } from '../../services/geographic-assignment.service';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================
// TRADE AREAS
// ============================================

/**
 * GET /api/v1/geography/trade-areas
 * List all trade areas (user's own + shared)
 */
router.get('/trade-areas', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || 1;
    const { include_shared = 'true', msa_id, submarket_id, limit = 50, offset = 0 } = req.query;
    
    let whereConditions = ['(ta.user_id = $1 OR ta.is_shared = true)'];
    const params: any[] = [userId];
    let paramIndex = 2;
    
    if (msa_id) {
      whereConditions.push(`gr.msa_id = $${paramIndex}`);
      params.push(parseInt(msa_id as string));
      paramIndex++;
    }
    
    if (submarket_id) {
      whereConditions.push(`gr.submarket_id = $${paramIndex}`);
      params.push(parseInt(submarket_id as string));
      paramIndex++;
    }
    
    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));
    
    const sql = `
      SELECT DISTINCT ON (ta.id)
        ta.id,
        ta.name,
        ta.user_id,
        ta.definition_method,
        ta.method_params,
        ta.confidence_score,
        ta.stats_snapshot,
        ta.is_shared,
        ta.created_at,
        ST_AsGeoJSON(ta.geometry)::json as geometry,
        ST_AsGeoJSON(ta.centroid)::json as centroid,
        s.name as submarket_name,
        m.name as msa_name
      FROM trade_areas ta
      LEFT JOIN geographic_relationships gr ON gr.trade_area_id = ta.id
      LEFT JOIN submarkets s ON gr.submarket_id = s.id
      LEFT JOIN msas m ON gr.msa_id = m.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ta.id, ta.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching trade areas:', error);
    next(error);
  }
});

/**
 * GET /api/v1/geography/trade-areas/:id
 * Get single trade area with details
 */
router.get('/trade-areas/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || 1;
    
    const result = await query(
      `SELECT 
        ta.*,
        ST_AsGeoJSON(ta.geometry)::json as geometry,
        ST_AsGeoJSON(ta.centroid)::json as centroid,
        json_agg(json_build_object(
          'submarket_id', s.id,
          'submarket_name', s.name,
          'msa_id', m.id,
          'msa_name', m.name,
          'overlap_pct', gr.overlap_pct
        )) as geographic_context
      FROM trade_areas ta
      LEFT JOIN geographic_relationships gr ON gr.trade_area_id = ta.id
      LEFT JOIN submarkets s ON gr.submarket_id = s.id
      LEFT JOIN msas m ON gr.msa_id = m.id
      WHERE ta.id = $1 AND (ta.user_id = $2 OR ta.is_shared = true)
      GROUP BY ta.id`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Trade area not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching trade area:', error);
    next(error);
  }
});

/**
 * GET /api/v1/geography/trade-area/:id/events
 * Get events affecting a trade area (with impact scores)
 */
router.get('/trade-area/:id/events', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { min_impact_score = 10, limit = 50 } = req.query;
    
    const result = await query(
      `SELECT 
        ne.*,
        tai.impact_score,
        tai.decay_score,
        tai.impact_type,
        tai.distance_miles,
        tai.proximity_score,
        tai.sector_score,
        tai.absorption_score,
        tai.temporal_score
      FROM news_events ne
      JOIN trade_area_event_impacts tai ON tai.event_id = ne.id
      WHERE tai.trade_area_id = $1
        AND tai.impact_score >= $2
      ORDER BY tai.impact_score DESC, ne.published_at DESC
      LIMIT $3`,
      [id, parseFloat(min_impact_score as string), parseInt(limit as string)]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching trade area events:', error);
    next(error);
  }
});

// ============================================
// SUBMARKETS
// ============================================

/**
 * GET /api/v1/geography/submarkets
 * List submarkets
 */
router.get('/submarkets', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { msa_id, limit = 100, offset = 0 } = req.query;
    
    let whereClause = '';
    const params: any[] = [];
    
    if (msa_id) {
      whereClause = 'WHERE s.msa_id = $1';
      params.push(parseInt(msa_id as string));
      params.push(parseInt(limit as string));
      params.push(parseInt(offset as string));
    } else {
      params.push(parseInt(limit as string));
      params.push(parseInt(offset as string));
    }
    
    const sql = `
      SELECT 
        s.id,
        s.name,
        s.msa_id,
        m.name as msa_name,
        s.source,
        s.properties_count,
        s.total_units,
        s.avg_occupancy,
        s.avg_rent,
        s.avg_cap_rate,
        ST_AsGeoJSON(s.geometry)::json as geometry,
        ST_AsGeoJSON(s.centroid)::json as centroid
      FROM submarkets s
      JOIN msas m ON s.msa_id = m.id
      ${whereClause}
      ORDER BY s.name
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching submarkets:', error);
    next(error);
  }
});

/**
 * GET /api/v1/geography/submarkets/:id
 * Get single submarket with stats
 */
router.get('/submarkets/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT 
        s.*,
        m.name as msa_name,
        ST_AsGeoJSON(s.geometry)::json as geometry,
        ST_AsGeoJSON(s.centroid)::json as centroid,
        COUNT(DISTINCT ta.id) as trade_areas_count
      FROM submarkets s
      JOIN msas m ON s.msa_id = m.id
      LEFT JOIN geographic_relationships gr ON gr.submarket_id = s.id
      LEFT JOIN trade_areas ta ON ta.id = gr.trade_area_id
      WHERE s.id = $1
      GROUP BY s.id, m.name`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submarket not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching submarket:', error);
    next(error);
  }
});

// ============================================
// MSAs
// ============================================

/**
 * GET /api/v1/geography/msas
 * List MSAs
 */
router.get('/msas', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await query(
      `SELECT 
        m.id,
        m.name,
        m.cbsa_code,
        m.state_codes,
        m.population,
        m.median_household_income,
        m.total_properties,
        m.total_units,
        m.avg_occupancy,
        m.avg_rent,
        ST_AsGeoJSON(m.centroid)::json as centroid,
        COUNT(DISTINCT s.id) as submarkets_count,
        COUNT(DISTINCT ta.id) as trade_areas_count
      FROM msas m
      LEFT JOIN submarkets s ON s.msa_id = m.id
      LEFT JOIN geographic_relationships gr ON gr.msa_id = m.id
      LEFT JOIN trade_areas ta ON ta.id = gr.trade_area_id
      GROUP BY m.id
      ORDER BY m.population DESC NULLS LAST
      LIMIT $1 OFFSET $2`,
      [parseInt(limit as string), parseInt(offset as string)]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching MSAs:', error);
    next(error);
  }
});

/**
 * GET /api/v1/geography/msas/:id
 * Get single MSA with details
 */
router.get('/msas/:id', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT 
        m.*,
        ST_AsGeoJSON(m.geometry)::json as geometry,
        ST_AsGeoJSON(m.centroid)::json as centroid,
        COUNT(DISTINCT s.id) as submarkets_count,
        COUNT(DISTINCT ta.id) as trade_areas_count
      FROM msas m
      LEFT JOIN submarkets s ON s.msa_id = m.id
      LEFT JOIN geographic_relationships gr ON gr.msa_id = m.id
      LEFT JOIN trade_areas ta ON ta.id = gr.trade_area_id
      WHERE m.id = $1
      GROUP BY m.id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'MSA not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching MSA:', error);
    next(error);
  }
});

// ============================================
// GEOCODING
// ============================================

/**
 * POST /api/v1/geography/geocode
 * Geocode an address to coordinates
 */
router.post('/geocode', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, addresses } = req.body;
    
    if (addresses && Array.isArray(addresses)) {
      // Batch geocoding
      const results = await geocodingService.batchGeocode(addresses);
      
      res.json({
        success: true,
        data: results,
        count: results.length,
      });
    } else if (address) {
      // Single geocoding
      const result = await geocodingService.geocode(address);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Address not found',
        });
      }
      
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Address or addresses array required',
      });
    }
  } catch (error) {
    logger.error('Error geocoding:', error);
    next(error);
  }
});

/**
 * POST /api/v1/geography/reverse-geocode
 * Reverse geocode coordinates to address
 */
router.post('/reverse-geocode', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude required',
      });
    }
    
    const result = await geocodingService.reverseGeocode(lat, lng);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Location not found',
      });
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error reverse geocoding:', error);
    next(error);
  }
});

// ============================================
// EVENT ASSIGNMENT
// ============================================

/**
 * POST /api/v1/geography/assign-event
 * Assign a news event to geographic levels
 */
router.post('/assign-event', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location, magnitude, published_at, event_id } = req.body;
    
    if (!location || !magnitude) {
      return res.status(400).json({
        success: false,
        message: 'location and magnitude required',
      });
    }
    
    const assignment = await geographicAssignmentService.assignEvent(
      location,
      magnitude,
      published_at ? new Date(published_at) : undefined
    );
    
    // Save to database if event_id provided
    if (event_id) {
      await geographicAssignmentService.saveEventAssignment(event_id, assignment);
    }
    
    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    logger.error('Error assigning event:', error);
    next(error);
  }
});

/**
 * GET /api/v1/geography/lookup
 * Lookup all geographic levels for a point
 */
router.get('/lookup', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude required',
      });
    }
    
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    
    // Find MSA
    const msaResult = await query(
      `SELECT * FROM find_msa_for_point($1, $2)`,
      [latitude, longitude]
    );
    
    // Find submarket
    const submarketResult = await query(
      `SELECT * FROM find_submarket_for_point($1, $2)`,
      [latitude, longitude]
    );
    
    // Find trade areas
    const tradeAreasResult = await query(
      `SELECT * FROM find_trade_areas_for_point($1, $2)`,
      [latitude, longitude]
    );
    
    res.json({
      success: true,
      data: {
        msa: msaResult.rows[0] || null,
        submarket: submarketResult.rows[0] || null,
        trade_areas: tradeAreasResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error looking up geography:', error);
    next(error);
  }
});

export default router;
