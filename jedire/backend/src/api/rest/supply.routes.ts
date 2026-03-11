/**
 * Supply Signal API Routes
 * Track construction pipeline and calculate supply risk
 */

import { Router } from 'express';
import { supplySignalService } from '../../services/supply-signal.service';
import { demandSignalService } from '../../services/demand-signal.service';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/supply/trade-area/:id
 * Get supply pipeline for a trade area
 */
router.get('/trade-area/:id', async (req, res) => {
  try {
    const tradeAreaId = parseInt(req.params.id);
    
    const pipeline = await supplySignalService.getSupplyPipeline(tradeAreaId);
    
    res.json({
      success: true,
      data: pipeline
    });
  } catch (error: any) {
    logger.error('Error getting trade area supply pipeline', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/supply/trade-area/:id/risk
 * Get supply risk score for a trade area
 */
router.get('/trade-area/:id/risk', async (req, res) => {
  try {
    const tradeAreaId = parseInt(req.params.id);
    const quarter = req.query.quarter as string || '2028-Q1';
    
    // Get demand data for this trade area/quarter (if available)
    let demandUnits: number | undefined;
    try {
      const demandForecast = await demandSignalService.getTradeAreaForecast(tradeAreaId, quarter, quarter);
      if (demandForecast.length > 0) {
        demandUnits = demandForecast[0].netUnits;
      }
    } catch (err) {
      // Demand data not available, continue without it
      logger.warn('Demand data not available for supply risk calculation', { tradeAreaId, quarter });
    }
    
    const riskScore = await supplySignalService.calculateSupplyRisk(tradeAreaId, quarter, demandUnits);
    
    res.json({
      success: true,
      data: riskScore
    });
  } catch (error: any) {
    logger.error('Error calculating supply risk', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/supply/events
 * List supply events (permits, starts, completions)
 */
router.get('/events', async (req, res) => {
  try {
    const filters: any = {};
    
    if (req.query.msa_id) filters.msaId = parseInt(req.query.msa_id as string);
    if (req.query.submarket_id) filters.submarketId = parseInt(req.query.submarket_id as string);
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.category) filters.category = req.query.category as string;
    if (req.query.start_date) filters.startDate = new Date(req.query.start_date as string);
    if (req.query.end_date) filters.endDate = new Date(req.query.end_date as string);
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    
    const events = await supplySignalService.getSupplyEvents(filters);
    
    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error: any) {
    logger.error('Error listing supply events', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/supply/competitive/:dealId
 * Get competitive projects near a deal
 */
router.get('/competitive/:dealId', async (req, res) => {
  try {
    const dealId = req.params.dealId;
    const maxDistance = req.query.max_distance ? parseFloat(req.query.max_distance as string) : 3.0;
    
    const competitiveProjects = await supplySignalService.getCompetitiveProjects(dealId, maxDistance);
    
    res.json({
      success: true,
      count: competitiveProjects.length,
      data: competitiveProjects
    });
  } catch (error: any) {
    logger.error('Error getting competitive projects', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/v1/supply/event
 * Create a supply event (for testing or manual entry)
 */
router.post('/event', async (req, res) => {
  try {
    const input = req.body;
    
    // Convert date strings to Date objects
    if (input.eventDate) input.eventDate = new Date(input.eventDate);
    if (input.expectedDeliveryDate) input.expectedDeliveryDate = new Date(input.expectedDeliveryDate);
    if (input.actualDeliveryDate) input.actualDeliveryDate = new Date(input.actualDeliveryDate);
    
    const supplyEvent = await supplySignalService.createSupplyEvent(input);
    
    res.json({
      success: true,
      data: supplyEvent
    });
  } catch (error: any) {
    logger.error('Error creating supply event', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/v1/supply/event/:id/status
 * Update supply event status (permit → construction → delivered)
 */
router.put('/event/:id/status', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { status, actualDeliveryDate } = req.body;
    
    await supplySignalService.updateSupplyEventStatus(
      eventId,
      status,
      actualDeliveryDate ? new Date(actualDeliveryDate) : undefined
    );
    
    res.json({
      success: true,
      message: 'Supply event status updated'
    });
  } catch (error: any) {
    logger.error('Error updating supply event status', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/supply/timeline/:tradeAreaId
 * Get supply delivery timeline for trade area
 */
router.get('/timeline/:tradeAreaId', async (req, res) => {
  try {
    const tradeAreaId = parseInt(req.params.tradeAreaId);
    const startQuarter = req.query.start_quarter as string;
    const endQuarter = req.query.end_quarter as string;
    
    const timeline = await supplySignalService.getSupplyDeliveryTimeline(
      tradeAreaId,
      startQuarter,
      endQuarter
    );
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error: any) {
    logger.error('Error getting supply delivery timeline', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/supply/market-dynamics/:tradeAreaId
 * Get combined demand-supply analysis for trade area
 */
router.get('/market-dynamics/:tradeAreaId', async (req, res) => {
  try {
    const tradeAreaId = parseInt(req.params.tradeAreaId);
    const quarter = req.query.quarter as string || '2028-Q1';
    
    // Get demand forecast
    let demandForecast: any = null;
    try {
      const forecast = await demandSignalService.getTradeAreaForecast(tradeAreaId, quarter, quarter);
      demandForecast = forecast.length > 0 ? forecast[0] : null;
    } catch (err) {
      logger.warn('Demand forecast not available', { tradeAreaId, quarter });
    }
    
    // Get supply risk
    const supplyRisk = await supplySignalService.calculateSupplyRisk(
      tradeAreaId,
      quarter,
      demandForecast?.netUnits
    );
    
    // Get supply pipeline
    const pipeline = await supplySignalService.getSupplyPipeline(tradeAreaId);
    
    // Calculate market dynamics
    const analysis = {
      tradeAreaId,
      quarter,
      
      // Demand
      demand: demandForecast ? {
        totalUnitsProjected: demandForecast.totalUnitsProjected,
        netUnits: demandForecast.netUnits,
        positiveUnits: demandForecast.positiveUnits,
        negativeUnits: demandForecast.negativeUnits,
        eventCount: demandForecast.eventCount
      } : null,
      
      // Supply
      supply: {
        pipelineUnits: pipeline.totalPipelineUnits,
        weightedPipelineUnits: pipeline.totalWeightedUnits,
        permittedUnits: pipeline.permittedUnits,
        constructionUnits: pipeline.constructionUnits,
        delivered12moUnits: pipeline.delivered12moUnits
      },
      
      // Risk Scores
      risk: {
        supplyRiskScore: supplyRisk.supplyRiskScore,
        riskLevel: supplyRisk.riskLevel,
        monthsToAbsorb: supplyRisk.monthsToAbsorb,
        absorptionRisk: supplyRisk.absorptionRisk
      },
      
      // Market Balance
      marketBalance: demandForecast ? {
        demandSupplyGap: supplyRisk.demandSupplyGap,
        netMarketPressure: supplyRisk.netMarketPressure,
        interpretation: this.interpretMarketBalance(
          supplyRisk.demandSupplyGap || 0,
          supplyRisk.netMarketPressure || 0
        )
      } : null
    };
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    logger.error('Error getting market dynamics', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper: Interpret market balance
 */
function interpretMarketBalance(gap: number, pressure: number): string {
  if (gap > 0 && pressure > 5) {
    return 'Demand exceeds supply - Strong market conditions';
  } else if (gap > 0 && pressure > 2) {
    return 'Demand exceeds supply - Healthy market';
  } else if (Math.abs(gap) < 50 && Math.abs(pressure) < 2) {
    return 'Balanced market - Supply matches demand';
  } else if (gap < 0 && pressure < -5) {
    return 'Oversupply risk - Demand significantly below supply';
  } else if (gap < 0 && pressure < -2) {
    return 'Moderate oversupply - Monitor absorption';
  } else {
    return 'Market in flux - Continue monitoring';
  }
}

export default router;
