/**
 * Demand Signal API Routes
 * 
 * Endpoints:
 * - GET /api/v1/demand/trade-area/:id - Get demand forecast for trade area
 * - GET /api/v1/demand/submarket/:id - Aggregated submarket demand
 * - GET /api/v1/demand/events - List demand-generating events
 * - POST /api/v1/demand/calculate - Calculate demand for a news event
 * - GET /api/v1/demand/impact/:dealId - Show demand impact on specific deal
 */

import { Router, Request, Response } from 'express';
import { demandSignalService, DemandEventInput } from '../../services/demand-signal.service';
import { query } from '../../database/connection';
import { authenticateToken } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/demand/trade-area/:id
 * Get demand forecast for a trade area
 * Query params: start_quarter, end_quarter
 */
router.get('/trade-area/:id', async (req: Request, res: Response) => {
  try {
    const tradeAreaId = parseInt(req.params.id);
    const { start_quarter, end_quarter } = req.query;
    
    if (isNaN(tradeAreaId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade area ID'
      });
    }
    
    const forecast = await demandSignalService.getTradeAreaForecast(
      tradeAreaId,
      start_quarter as string,
      end_quarter as string
    );
    
    return res.json({
      success: true,
      data: forecast
    });
  } catch (error: any) {
    console.error('Error fetching trade area demand forecast:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/demand/submarket/:id
 * Get aggregated demand for a submarket
 */
router.get('/submarket/:id', async (req: Request, res: Response) => {
  try {
    const submarketId = parseInt(req.params.id);
    const { start_quarter, end_quarter } = req.query;
    
    if (isNaN(submarketId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid submarket ID'
      });
    }
    
    // Get all trade areas in this submarket
    const tradeAreasResult = await query(
      `SELECT DISTINCT ta.id, ta.name
       FROM trade_areas ta
       JOIN geographic_relationships gr ON gr.trade_area_id = ta.id
       WHERE gr.submarket_id = $1`,
      [submarketId]
    );
    
    if (tradeAreasResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          submarketId,
          tradeAreas: [],
          aggregated: []
        }
      });
    }
    
    // Get demand for all trade areas
    const allForecasts = await Promise.all(
      tradeAreasResult.rows.map(ta => 
        demandSignalService.getTradeAreaForecast(
          ta.id,
          start_quarter as string,
          end_quarter as string
        )
      )
    );
    
    // Aggregate by quarter
    const aggregatedByQuarter: any = {};
    
    for (const forecasts of allForecasts) {
      for (const forecast of forecasts) {
        if (!aggregatedByQuarter[forecast.quarter]) {
          aggregatedByQuarter[forecast.quarter] = {
            quarter: forecast.quarter,
            totalUnitsProjected: 0,
            eventCount: 0,
            affordableUnits: 0,
            workforceUnits: 0,
            luxuryUnits: 0,
            positiveUnits: 0,
            negativeUnits: 0,
            netUnits: 0
          };
        }
        
        const agg = aggregatedByQuarter[forecast.quarter];
        agg.totalUnitsProjected += forecast.totalUnitsProjected;
        agg.eventCount += forecast.eventCount;
        agg.affordableUnits += forecast.affordableUnits;
        agg.workforceUnits += forecast.workforceUnits;
        agg.luxuryUnits += forecast.luxuryUnits;
        agg.positiveUnits += forecast.positiveUnits;
        agg.negativeUnits += forecast.negativeUnits;
        agg.netUnits += forecast.netUnits;
      }
    }
    
    const aggregated = Object.values(aggregatedByQuarter).sort((a: any, b: any) => 
      a.quarter.localeCompare(b.quarter)
    );
    
    return res.json({
      success: true,
      data: {
        submarketId,
        tradeAreaCount: tradeAreasResult.rows.length,
        aggregated
      }
    });
  } catch (error: any) {
    console.error('Error fetching submarket demand:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/demand/events
 * List demand-generating events
 * Query params: msa_id, submarket_id, category, start_date, end_date, limit
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { msa_id, submarket_id, category, start_date, end_date, limit } = req.query;
    
    const filters: any = {};
    
    if (msa_id) filters.msaId = parseInt(msa_id as string);
    if (submarket_id) filters.submarketId = parseInt(submarket_id as string);
    if (category) filters.category = category as string;
    if (start_date) filters.startDate = new Date(start_date as string);
    if (end_date) filters.endDate = new Date(end_date as string);
    if (limit) filters.limit = parseInt(limit as string);
    
    const events = await demandSignalService.getDemandEvents(filters);
    
    return res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error: any) {
    console.error('Error fetching demand events:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/demand/calculate
 * Calculate demand for a news event
 * 
 * Body:
 * {
 *   "newsEventId": "uuid",
 *   "headline": "Amazon to hire 4,500 employees...",
 *   "publishedAt": "2026-02-10T12:00:00Z",
 *   "category": "employment",
 *   "eventType": "job_creation",
 *   "peopleCount": 4500,
 *   "incomeTier": "standard",
 *   "remoteWorkPct": 10,
 *   "msaId": 1,
 *   "submarketId": 5,
 *   "geographicTier": "area"
 * }
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const input: DemandEventInput = req.body;
    
    // Validation
    if (!input.newsEventId || !input.headline || !input.category || !input.eventType || !input.peopleCount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: newsEventId, headline, category, eventType, peopleCount'
      });
    }
    
    if (!input.publishedAt) {
      input.publishedAt = new Date();
    } else if (typeof input.publishedAt === 'string') {
      input.publishedAt = new Date(input.publishedAt);
    }
    
    const demandEvent = await demandSignalService.createDemandEvent(input);
    
    // Get projections
    const projectionsResult = await query(
      `SELECT * FROM demand_projections WHERE demand_event_id = $1 ORDER BY quarter`,
      [demandEvent.id]
    );
    
    return res.json({
      success: true,
      data: {
        demandEvent,
        projections: projectionsResult.rows
      }
    });
  } catch (error: any) {
    console.error('Error calculating demand:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/demand/impact/:dealId
 * Show demand impact on a specific deal
 * Query params: start_quarter, end_quarter
 */
router.get('/impact/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = req.params.dealId;
    const { start_quarter, end_quarter } = req.query;
    
    // Get deal's trade area
    const dealResult = await query(
      `SELECT ta.id as trade_area_id, ta.name as trade_area_name,
              p.address, d.name as deal_name
       FROM deals d
       LEFT JOIN properties p ON p.deal_id = d.id
       LEFT JOIN trade_areas ta ON ta.property_id = p.id
       WHERE d.id = $1
       LIMIT 1`,
      [dealId]
    );
    
    if (dealResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found or no trade area assigned'
      });
    }
    
    const deal = dealResult.rows[0];
    
    if (!deal.trade_area_id) {
      return res.json({
        success: true,
        data: {
          dealId,
          dealName: deal.deal_name,
          message: 'No trade area assigned to this deal yet',
          forecast: []
        }
      });
    }
    
    // Get demand forecast
    const forecast = await demandSignalService.getTradeAreaForecast(
      deal.trade_area_id,
      start_quarter as string,
      end_quarter as string
    );
    
    // Get contributing events
    const eventsResult = await query(
      `SELECT DISTINCT de.*, det.category, det.event_type, det.demand_direction
       FROM demand_events de
       JOIN demand_event_types det ON det.id = de.demand_event_type_id
       JOIN demand_projections dp ON dp.demand_event_id = de.id
       JOIN trade_area_event_impacts taei ON taei.event_id = de.news_event_id
       WHERE taei.trade_area_id = $1
       ORDER BY de.published_at DESC
       LIMIT 20`,
      [deal.trade_area_id]
    );
    
    return res.json({
      success: true,
      data: {
        dealId,
        dealName: deal.deal_name,
        tradeAreaId: deal.trade_area_id,
        tradeAreaName: deal.trade_area_name,
        forecast,
        contributingEvents: eventsResult.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching deal demand impact:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/demand/aggregate/:tradeAreaId
 * Manually trigger aggregation for a trade area
 * Body: { "quarter": "2028-Q1" }
 */
router.post('/aggregate/:tradeAreaId', async (req: Request, res: Response) => {
  try {
    const tradeAreaId = parseInt(req.params.tradeAreaId);
    const { quarter } = req.body;
    
    if (isNaN(tradeAreaId) || !quarter) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade area ID or missing quarter'
      });
    }
    
    await demandSignalService.aggregateTradeAreaDemand(tradeAreaId, quarter);
    
    const forecast = await demandSignalService.getTradeAreaForecast(tradeAreaId, quarter, quarter);
    
    return res.json({
      success: true,
      message: 'Demand aggregated successfully',
      data: forecast[0] || null
    });
  } catch (error: any) {
    console.error('Error aggregating demand:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

export default router;
