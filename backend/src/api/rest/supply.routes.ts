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
 * GET /api/v1/deals/:dealId/supply
 * Get supply data for a specific deal (based on its trade area)
 */
router.get('/deals/:dealId/supply', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    // Get deal's trade area
    const { getClient } = require('../../database/connection');
    const client = await getClient();
    
    try {
      const dealResult = await client.query(
        `SELECT trade_area_id FROM deals WHERE id = $1`,
        [dealId]
      );
      
      if (dealResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Deal not found'
        });
      }
      
      const tradeAreaId = dealResult.rows[0].trade_area_id;
      
      if (!tradeAreaId) {
        return res.status(400).json({
          success: false,
          error: 'Deal does not have a trade area assigned'
        });
      }
      
      // Get supply pipeline for this trade area
      const pipeline = await supplySignalService.getSupplyPipeline(tradeAreaId);
      
      res.json({
        success: true,
        dealId,
        tradeAreaId,
        data: pipeline
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Error getting deal supply data', { error: error.message, dealId: req.params.dealId });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/supply/trade-area/:id
 * Get supply pipeline for a trade area
 */
router.get('/trade-area/:id', async (req, res) => {
  try {
    const tradeAreaId = req.params.id;
    
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
    const tradeAreaId = req.params.id;
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
    const tradeAreaId = req.params.tradeAreaId;
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
 * GET /api/v1/supply/pipeline-timeline
 *
 * Lives in this router so callers can use the conventional `/supply/*` path.
 * Mounted in `index.replit.ts` at `/api/v1/supply` via the dedicated
 * `supplyExtraRouter` so it does not collide with `supplyRoutes` (which is
 * mounted at `/api/v1`).
 *
 * Forward-looking unit deliveries for an MSA or Submarket.
 *
 * Query params:
 *   msaId           — e.g. 'atlanta-ga'
 *   state           — 2-letter; if omitted we try to read from msaId tail, else 'GA'
 *   submarketName   — optional. When provided, projects are filtered by name/address keyword match
 *   submarketId     — optional. Echoed back in `resolved` for client correlation
 *   quarters        — chart window length, default 8
 *
 * Data source rationale: the canonical `supply_pipeline` / `supply_delivery_timeline` /
 * `supply_pipeline_projects` tables are currently empty in this environment. The only
 * populated source for forward apartment deliveries is `apartment_supply_pipeline`
 * (apartment-locator daily sync). Status/probability are derived from `available_date`
 * because the source feed does not carry explicit construction phase. When the canonical
 * trade-area-keyed feed is populated, this handler can be re-pointed to it.
 */
export const supplyPipelineTimelineHandler = async (req: import('express').Request, res: import('express').Response) => {
  try {
    const msaId = (req.query.msaId as string) || '';
    // Only accept an explicit state, or a 2-letter trailing token in msaId.
    // Avoids "atlanta" -> state "ATLANTA" bug when msaId is a single slug.
    const explicitState = (req.query.state as string) || '';
    const tail = msaId.split('-').pop() || '';
    const state = (
      explicitState && /^[A-Za-z]{2}$/.test(explicitState) ? explicitState
      : /^[A-Za-z]{2}$/.test(tail) ? tail
      : 'GA'
    ).toUpperCase();
    const submarketName = (req.query.submarketName as string) || '';
    const submarketId = (req.query.submarketId as string) || '';
    const quarters = Math.min(Math.max(parseInt(req.query.quarters as string) || 8, 1), 16);

    const { getClient } = require('../../database/connection');
    const client = await getClient();

    try {
      const params: (string | number)[] = [state];
      let where = `state = $1`;

      // Submarket filter: case-insensitive keyword match against name OR address.
      // Splits "Inman Park/Old Fourth Ward" → first token to widen matches.
      if (submarketName) {
        const keyword = submarketName.split('/')[0].trim();
        params.push(`%${keyword}%`);
        where += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length})`;
      }

      const rowsResult = await client.query(
        `SELECT id, name, address, city, state, total_units, property_class,
                available_date, units_delivering
           FROM apartment_supply_pipeline
          WHERE ${where}
          ORDER BY available_date NULLS LAST, total_units DESC NULLS LAST`,
        params
      );

      const now = new Date();
      const probabilityByStatus: Record<string, number> = {
        lease_up: 1.0,
        under_construction: 0.85,
        approved: 0.55,
        planned: 0.25,
      };

      const dateToQuarter = (d: Date): string => {
        const y = d.getUTCFullYear();
        const q = Math.floor(d.getUTCMonth() / 3) + 1;
        return `${y}-Q${q}`;
      };

      const advanceQuarter = (q: string, n: number): string => {
        const [yStr, qStr] = q.split('-Q');
        let qi = parseInt(qStr) - 1 + n;
        let y = parseInt(yStr) + Math.floor(qi / 4);
        qi = ((qi % 4) + 4) % 4;
        return `${y}-Q${qi + 1}`;
      };

      const startQuarter = dateToQuarter(now);
      const windowQuarters: string[] = [];
      for (let i = 0; i < quarters; i++) {
        windowQuarters.push(advanceQuarter(startQuarter, i));
      }
      const inWindow = new Set(windowQuarters);

      type Project = {
        id: string;
        name: string;
        address: string | null;
        submarket: string | null;
        developer: string | null;
        units: number;
        unitsDelivering: number;
        weightedUnits: number;
        status: 'lease_up' | 'under_construction' | 'approved' | 'planned';
        deliveryDate: string | null;
        deliveryQuarter: string | null;
        propertyClass: string | null;
        propertyId: string | null;
      };

      const projects: Project[] = [];
      const quarterAgg = new Map<string, { totalUnits: number; weightedUnits: number; projectCount: number }>();
      windowQuarters.forEach(q => quarterAgg.set(q, { totalUnits: 0, weightedUnits: 0, projectCount: 0 }));

      let totalUnits = 0;
      let weightedUnits = 0;
      const statusUnits: Record<string, number> = {
        lease_up: 0, under_construction: 0, approved: 0, planned: 0,
      };

      for (const r of rowsResult.rows) {
        const units = Number(r.total_units || 0);
        const unitsDelivering = Number(r.units_delivering || 0);
        const availableDate: Date | null = r.available_date ? new Date(r.available_date) : null;

        // Derive status from available_date.
        let status: Project['status'];
        if (!availableDate) {
          status = 'planned';
        } else {
          const monthsOut = (availableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          if (monthsOut < -3) {
            // Already delivered — exclude from forward pipeline view entirely.
            continue;
          }
          if (monthsOut <= 0) status = 'lease_up';
          else if (monthsOut <= 12) status = 'under_construction';
          else if (monthsOut <= 24) status = 'approved';
          else status = 'planned';
        }

        const probability = probabilityByStatus[status];
        const weighted = units * probability;
        const deliveryQuarter = availableDate ? dateToQuarter(availableDate) : null;

        projects.push({
          id: String(r.id),
          name: r.name || r.address || 'Unknown project',
          address: r.address || null,
          submarket: r.city || null,
          developer: null, // not present in source feed
          units,
          unitsDelivering,
          weightedUnits: parseFloat(weighted.toFixed(1)),
          status,
          deliveryDate: availableDate ? availableDate.toISOString().slice(0, 10) : null,
          deliveryQuarter,
          propertyClass: r.property_class || null,
          propertyId: null, // no linkage in source feed yet
        });

        totalUnits += units;
        weightedUnits += weighted;
        statusUnits[status] += units;

        if (deliveryQuarter && inWindow.has(deliveryQuarter)) {
          const bucket = quarterAgg.get(deliveryQuarter)!;
          bucket.totalUnits += units;
          bucket.weightedUnits += weighted;
          bucket.projectCount += 1;
        }
      }

      const byQuarter = windowQuarters.map(q => {
        const b = quarterAgg.get(q)!;
        return {
          quarter: q,
          totalUnits: b.totalUnits,
          weightedUnits: parseFloat(b.weightedUnits.toFixed(1)),
          projectCount: b.projectCount,
        };
      });

      const msaName = msaId
        ? msaId
            .replace(/-[a-z]{2}$/, '')
            .split('-')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ')
        : null;
      const scope = submarketName ? 'submarket' : 'msa';
      const label = submarketName
        ? `${submarketName}${msaName ? ` — ${msaName} MSA` : ''}`
        : msaName ? `${msaName} MSA` : `${state} state pipeline`;

      res.json({
        success: true,
        resolved: {
          scope,
          label,
          msaId: msaId || null,
          msaName,
          state,
          submarketName: submarketName || null,
          submarketId: submarketId || null,
        },
        totals: {
          projectCount: projects.length,
          totalUnits,
          weightedUnits: parseFloat(weightedUnits.toFixed(1)),
          leaseUpUnits: statusUnits.lease_up,
          underConstructionUnits: statusUnits.under_construction,
          approvedUnits: statusUnits.approved,
          plannedUnits: statusUnits.planned,
        },
        byQuarter,
        projects,
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting supply pipeline timeline', { error: msg });
    res.status(500).json({ success: false, error: msg });
  }
};

/**
 * Dedicated router for endpoints that must live under `/api/v1/supply/*`.
 * Mount this router at `/api/v1/supply` in `index.replit.ts`. Keep it
 * separate from the default `router` (which is mounted at `/api/v1` for
 * legacy reasons), so paths don't collide and conventions stay clean.
 */
export const supplyExtraRouter = Router();
supplyExtraRouter.get('/pipeline-timeline', supplyPipelineTimelineHandler);

/**
 * GET /api/v1/supply/market-dynamics/:tradeAreaId
 * Get combined demand-supply analysis for trade area
 */
router.get('/market-dynamics/:tradeAreaId', async (req, res) => {
  try {
    const tradeAreaId = req.params.tradeAreaId;
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
        interpretation: interpretMarketBalance(
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
