/**
 * Proximity, Events & Backtest API Routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middleware/auth';
import { getProximityService } from '../../services/proximity/proximity.service';
import { getMarketEventsService } from '../../services/proximity/events.service';
import { getBacktestService } from '../../services/proximity/backtest.service';

const router = Router();

// Protect all proximity routes
router.use(requireAuth);

// Get pool from app (will be set in index.ts)
let pool: Pool;
export function setPool(p: Pool) { pool = p; }

// ============================================================================
// PROXIMITY ROUTES
// ============================================================================

/**
 * POST /api/v1/proximity/compute
 * Compute proximity scores for a location
 */
router.post('/compute', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, address, propertyId, parcelId, saveToDb } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude required' });
    }
    
    const service = getProximityService(pool);
    const scores = await service.computeProximityScores(
      parseFloat(latitude),
      parseFloat(longitude),
      { address, propertyId, parcelId, saveToDb }
    );
    
    res.json(scores);
  } catch (error) {
    console.error('[Proximity] Compute error:', error);
    res.status(500).json({ error: 'Failed to compute proximity scores' });
  }
});

/**
 * GET /api/v1/proximity/property/:propertyId
 * Get cached proximity scores for a property
 */
router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    
    const service = getProximityService(pool);
    const scores = await service.getCachedProximityScores(propertyId);
    
    if (!scores) {
      return res.status(404).json({ error: 'Proximity scores not found' });
    }
    
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get proximity scores' });
  }
});

/**
 * GET /api/v1/proximity/nearby
 * Find nearby POIs
 */
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, types, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    
    const poiTypes = types ? (types as string).split(',') : ['transit_station', 'grocery_premium'];
    const radiusMiles = parseFloat(radius as string) || 2.0;
    
    const service = getProximityService(pool);
    const pois = await service.findNearbyPOIs(
      parseFloat(lat as string),
      parseFloat(lng as string),
      poiTypes as any[],
      radiusMiles
    );
    
    res.json({ count: pois.length, pois });
  } catch (error) {
    res.status(500).json({ error: 'Failed to find nearby POIs' });
  }
});

/**
 * POST /api/v1/proximity/batch
 * Batch compute proximity for multiple properties
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { properties } = req.body;
    
    if (!Array.isArray(properties)) {
      return res.status(400).json({ error: 'properties array required' });
    }
    
    const service = getProximityService(pool);
    const results = await service.batchComputeProximity(properties);
    
    res.json({
      processed: results.size,
      results: Object.fromEntries(results)
    });
  } catch (error) {
    res.status(500).json({ error: 'Batch computation failed' });
  }
});

// ============================================================================
// MARKET EVENTS ROUTES
// ============================================================================

/**
 * GET /api/v1/proximity/events/near
 * Get events near a location
 */
router.get('/events/near', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius, types, status } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    
    const service = getMarketEventsService(pool);
    const events = await service.getEventsNearLocation(
      parseFloat(lat as string),
      parseFloat(lng as string),
      parseFloat(radius as string) || 5.0,
      {
        eventTypes: types ? (types as string).split(',') as any[] : undefined,
        status: status ? (status as string).split(',') : undefined
      }
    );
    
    res.json({ count: events.length, events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * GET /api/v1/proximity/events/upcoming/:submarket
 * Get upcoming events for a submarket
 */
router.get('/events/upcoming/:submarket', async (req: Request, res: Response) => {
  try {
    const { submarket } = req.params;
    const { months } = req.query;
    
    const service = getMarketEventsService(pool);
    const events = await service.getUpcomingEvents(
      submarket,
      parseInt(months as string) || 24
    );
    
    res.json({ submarket, count: events.length, events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get upcoming events' });
  }
});

/**
 * GET /api/v1/proximity/events/:eventId
 * Get event with outcomes
 */
router.get('/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    const service = getMarketEventsService(pool);
    const result = await service.getEventWithOutcomes(eventId);
    
    if (!result) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get event' });
  }
});

/**
 * POST /api/v1/proximity/events
 * Create a new market event
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const service = getMarketEventsService(pool);
    const event = await service.createEvent(req.body);
    
    res.status(201).json(event);
  } catch (error) {
    console.error('[Events] Create error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * POST /api/v1/proximity/events/:eventId/outcome
 * Record an event outcome
 */
router.post('/events/:eventId/outcome', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    
    const service = getMarketEventsService(pool);
    const outcome = await service.recordOutcome({
      eventId,
      ...req.body
    });
    
    res.status(201).json(outcome);
  } catch (error) {
    res.status(500).json({ error: 'Failed to record outcome' });
  }
});

/**
 * GET /api/v1/proximity/events/analysis/:eventType
 * Analyze historical impact of an event type
 */
router.get('/events/analysis/:eventType', async (req: Request, res: Response) => {
  try {
    const { eventType } = req.params;
    
    const service = getMarketEventsService(pool);
    const analysis = await service.analyzeEventTypeImpact(eventType as any);
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze event type' });
  }
});

/**
 * GET /api/v1/proximity/supply-pipeline/:submarket
 * Get supply pipeline for a submarket
 */
router.get('/supply-pipeline/:submarket', async (req: Request, res: Response) => {
  try {
    const { submarket } = req.params;
    const { months } = req.query;
    
    const service = getMarketEventsService(pool);
    const pipeline = await service.getSupplyPipeline(
      submarket,
      parseInt(months as string) || 36
    );
    
    res.json(pipeline);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get supply pipeline' });
  }
});

// ============================================================================
// BACKTEST ROUTES
// ============================================================================

/**
 * POST /api/v1/proximity/backtest/rent-growth
 * Run rent growth backtest
 */
router.post('/backtest/rent-growth', async (req: Request, res: Response) => {
  try {
    const service = getBacktestService(pool);
    const result = await service.backtestRentGrowth({
      ...req.body,
      type: 'rent_growth'
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Backtest] Rent growth error:', error);
    res.status(500).json({ error: 'Backtest failed' });
  }
});

/**
 * POST /api/v1/proximity/backtest/event-impact
 * Run event impact backtest
 */
router.post('/backtest/event-impact', async (req: Request, res: Response) => {
  try {
    const service = getBacktestService(pool);
    const result = await service.backtestEventImpact({
      ...req.body,
      type: 'event_impact'
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Backtest failed' });
  }
});

/**
 * GET /api/v1/proximity/backtest/similar-deals
 * Get similar historical deals for comparison
 */
router.get('/backtest/similar-deals', async (req: Request, res: Response) => {
  try {
    const { dealType, submarket, vintage, units, assetClass } = req.query;
    
    const service = getBacktestService(pool);
    const deals = await service.getSimilarDealsPerformance({
      dealType: dealType as string,
      submarket: submarket as string,
      vintage: vintage ? parseInt(vintage as string) : undefined,
      units: units ? parseInt(units as string) : undefined,
      assetClass: assetClass as string
    });
    
    res.json({ count: deals.length, deals });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get similar deals' });
  }
});

/**
 * POST /api/v1/proximity/snapshots/capture
 * Capture a market snapshot
 */
router.post('/snapshots/capture', async (req: Request, res: Response) => {
  try {
    const { geographyType, geographyId, geographyName } = req.body;
    
    if (!geographyType || !geographyId) {
      return res.status(400).json({ error: 'geographyType and geographyId required' });
    }
    
    const service = getBacktestService(pool);
    const snapshot = await service.captureSnapshot(
      geographyType,
      geographyId,
      geographyName || geographyId
    );
    
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to capture snapshot' });
  }
});

/**
 * GET /api/v1/proximity/snapshots
 * Get historical snapshots
 */
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const { geographyType, geographyIds, startDate, endDate } = req.query;
    
    if (!geographyType || !startDate || !endDate) {
      return res.status(400).json({ error: 'geographyType, startDate, and endDate required' });
    }
    
    const service = getBacktestService(pool);
    const snapshots = await service.getSnapshots(
      geographyType as string,
      geographyIds ? (geographyIds as string).split(',') : [],
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json({ count: snapshots.length, snapshots });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get snapshots' });
  }
});

export default router;
