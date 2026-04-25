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
 * Forward-looking unit deliveries for an MSA / Submarket. Resolves entities
 * canonically (msas, trade_areas, submarkets) and returns 404 when missing.
 * Reuses canonical probability weighting via PROBABILITY_BY_STATUS.
 */
const PROBABILITY_BY_STATUS: Record<string, number> = {
  lease_up: 1.0,
  under_construction: 0.85,
  approved: 0.55,
  planned: 0.25,
};

// Canonical entity resolvers live in `_market-resolution.ts` so this file
// and `sentiment.routes.ts` (and any future market-scoped REST routes) stay
// in lock-step on what "atlanta-ga" or "midtown" actually means.
import {
  resolveMsa,
  resolveSubmarket,
  type SubmarketResolution,
} from './_market-resolution';

export const supplyPipelineTimelineHandler = async (req: import('express').Request, res: import('express').Response) => {
  try {
    const msaId = (req.query.msaId as string) || '';
    const submarketId = (req.query.submarketId as string) || '';
    const quarters = Math.min(Math.max(parseInt(req.query.quarters as string) || 8, 1), 16);

    if (!msaId) {
      res.status(400).json({ success: false, error: 'msaId is required' });
      return;
    }

    const { getClient } = require('../../database/connection');
    const client = await getClient();

    try {
      // Deterministic, DB-backed resolution. 404 if either is unresolvable.
      const msa = await resolveMsa(client, msaId);
      if (!msa) {
        res.status(404).json({
          success: false,
          error: `MSA not found for id "${msaId}"`,
        });
        return;
      }

      let submarket: SubmarketResolution | null = null;
      if (submarketId) {
        submarket = await resolveSubmarket(client, submarketId, msa.id);
        if (!submarket) {
          res.status(404).json({
            success: false,
            error: `Submarket not found for id "${submarketId}"`,
          });
          return;
        }
      }

      // True MSA-bounded municipality set via PostGIS: take DISTINCT
      // municipalities of trade_areas whose boundary spatially intersects
      // the canonical msas.geometry polygon. This isolates the MSA in
      // multi-MSA states (FL, TX, NC, etc.). Fallback to msa.primaryCity
      // when trade_areas have no spatial coverage for this MSA yet.
      const cityRows = await client.query(
        `SELECT DISTINCT ta.municipality
           FROM trade_areas ta
           JOIN msas m ON m.id = $1
          WHERE ta.boundary IS NOT NULL
            AND ta.municipality IS NOT NULL
            AND ST_Intersects(ta.boundary, m.geometry)`,
        [msa.id],
      );
      const canonicalCities = new Set<string>();
      for (const r of cityRows.rows) {
        if (r.municipality) canonicalCities.add(String(r.municipality));
      }
      if (canonicalCities.size === 0) canonicalCities.add(msa.primaryCity);
      const cities = Array.from(canonicalCities);

      const params: (string | number)[] = [];
      const wheres: string[] = [];

      if (msa.stateCodes.length > 0) {
        const placeholders = msa.stateCodes.map(s => {
          params.push(s);
          return `$${params.length}`;
        });
        wheres.push(`asp.state IN (${placeholders.join(', ')})`);
      }

      // Wider MSA city scope: ALL canonical municipalities for this MSA.
      const cityPlaceholders = cities.map(c => {
        params.push(c);
        return `$${params.length}`;
      });
      wheres.push(`asp.city IN (${cityPlaceholders.join(', ')})`);

      if (submarket) {
        const keyword = submarket.name.split('/')[0].trim();
        params.push(`%${keyword}%`);
        wheres.push(`(asp.name ILIKE $${params.length} OR asp.address ILIKE $${params.length})`);
      }

      const where = wheres.join(' AND ');

      // LEFT JOINs:
      //   properties              -> propertyId for Property Terminal drill-through
      //   apartment_locator_props -> management_company surfaced as developer/sponsor
      const rowsResult = await client.query(
        `SELECT asp.id, asp.name, asp.address, asp.city, asp.state, asp.total_units,
                asp.property_class, asp.available_date, asp.units_delivering,
                p.id::text AS property_id,
                alp.management_company AS developer
           FROM apartment_supply_pipeline asp
           LEFT JOIN properties p
             ON LOWER(p.address_line1) = LOWER(asp.address)
            AND p.state_code = asp.state
           LEFT JOIN apartment_locator_properties alp
             ON LOWER(alp.address) = LOWER(asp.address)
            AND alp.state = asp.state
          WHERE ${where}
          ORDER BY asp.available_date NULLS LAST, asp.total_units DESC NULLS LAST`,
        params
      );

      const now = new Date();

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
      const unscheduledProjects: Project[] = [];
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

        let status: Project['status'];
        if (!availableDate) {
          status = 'planned';
        } else {
          const monthsOut = (availableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          if (monthsOut < -3) {
            // Already delivered — exclude from the forward pipeline view.
            continue;
          }
          if (monthsOut <= 0) status = 'lease_up';
          else if (monthsOut <= 12) status = 'under_construction';
          else if (monthsOut <= 24) status = 'approved';
          else status = 'planned';
        }

        const probability = PROBABILITY_BY_STATUS[status];
        const weighted = units * probability;
        const deliveryQuarter = availableDate ? dateToQuarter(availableDate) : null;

        const proj: Project = {
          id: String(r.id),
          name: r.name || r.address || 'Unknown project',
          address: r.address || null,
          submarket: r.city || null,
          developer: r.developer || null,
          units,
          unitsDelivering,
          weightedUnits: parseFloat(weighted.toFixed(1)),
          status,
          deliveryDate: availableDate ? availableDate.toISOString().slice(0, 10) : null,
          deliveryQuarter,
          propertyClass: r.property_class || null,
          propertyId: r.property_id || null,
        };

        totalUnits += units;
        weightedUnits += weighted;
        statusUnits[status] += units;

        if (deliveryQuarter && inWindow.has(deliveryQuarter)) {
          // In-window: appears in chart AND in the chart-aligned project list.
          projects.push(proj);
          const bucket = quarterAgg.get(deliveryQuarter)!;
          bucket.totalUnits += units;
          bucket.weightedUnits += weighted;
          bucket.projectCount += 1;
        } else {
          // No delivery date OR scheduled outside the chart window.
          unscheduledProjects.push(proj);
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

      const scope: 'msa' | 'submarket' = submarket ? 'submarket' : 'msa';
      const label = submarket
        ? `${submarket.name} — ${msa.name}`
        : `${msa.name} MSA`;

      res.json({
        success: true,
        resolved: {
          scope,
          label,
          msaId: msaId || null,
          msaCanonicalId: msa.id,
          msaName: msa.name,
          state: msa.stateCodes[0] || null,
          stateCodes: msa.stateCodes,
          cities: [msa.primaryCity],
          submarketId: submarketId || null,
          submarketCanonicalId: submarket ? String(submarket.id) : null,
          submarketName: submarket ? submarket.name : null,
          submarketSource: submarket ? submarket.source : null,
          windowQuarters,
        },
        totals: {
          projectCount: projects.length + unscheduledProjects.length,
          inWindowProjectCount: projects.length,
          unscheduledProjectCount: unscheduledProjects.length,
          totalUnits,
          weightedUnits: parseFloat(weightedUnits.toFixed(1)),
          leaseUpUnits: statusUnits.lease_up,
          underConstructionUnits: statusUnits.under_construction,
          approvedUnits: statusUnits.approved,
          plannedUnits: statusUnits.planned,
        },
        byQuarter,
        projects,
        unscheduledProjects,
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
