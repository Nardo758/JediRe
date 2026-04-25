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
 * Returns forward-looking apartment unit deliveries for an MSA or Submarket
 * over the next N quarters, plus the project list aligned to that same window.
 *
 * Query params:
 *   msaId           e.g. 'atlanta-ga' — used to resolve city + state for scoping
 *   state           optional override; 2-letter
 *   submarketName   optional — refines projects by name/address keyword
 *   submarketId     optional — echoed in `resolved` for client correlation
 *   quarters        chart window length (1-16, default 8)
 *
 * Response shape:
 *   resolved: scope/labels/state/cities used for the query
 *   totals:   project count + units rolled up across full forward pipeline
 *   byQuarter[N]: aligned to chart window (next N quarters from today)
 *   projects[]:   forward projects whose delivery quarter falls IN the window
 *   unscheduledProjects[]: forward projects with no scheduled delivery date,
 *                          or scheduled delivery beyond the window
 *
 * Source: `apartment_supply_pipeline` (the populated forward-pipeline source).
 * `propertyId` is best-effort joined from `properties` on (address, state) so
 * linked rows can drill through to the Property Terminal.
 */
const MSA_CITY_MAP: Record<string, { state: string; cities: string[] }> = {
  'atlanta-ga': { state: 'GA', cities: ['Atlanta'] },
  'tampa-fl':   { state: 'FL', cities: ['Tampa'] },
  'orlando-fl': { state: 'FL', cities: ['Orlando'] },
  'miami-fl':   { state: 'FL', cities: ['Miami'] },
  'dallas-tx':  { state: 'TX', cities: ['Dallas'] },
  'houston-tx': { state: 'TX', cities: ['Houston'] },
  'austin-tx':  { state: 'TX', cities: ['Austin'] },
};

const resolveMsaScope = (msaId: string, explicitState: string): { state: string; cities: string[]; msaName: string | null } => {
  const lookup = MSA_CITY_MAP[msaId.toLowerCase()];
  if (lookup) {
    return {
      state: lookup.state,
      cities: lookup.cities,
      msaName: lookup.cities[0],
    };
  }
  // No mapping — derive state from explicit param or the trailing 2-letter token in msaId.
  const tail = msaId.split('-').pop() || '';
  const state = (
    explicitState && /^[A-Za-z]{2}$/.test(explicitState) ? explicitState
    : /^[A-Za-z]{2}$/.test(tail) ? tail
    : 'GA'
  ).toUpperCase();
  // If msaId looks like "<city>-<state>", peel off the city token(s).
  const parts = msaId.split('-');
  const cityTokens = /^[A-Za-z]{2}$/.test(parts[parts.length - 1] || '')
    ? parts.slice(0, -1)
    : parts;
  const city = cityTokens
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
  return {
    state,
    cities: city ? [city] : [],
    msaName: city || null,
  };
};

export const supplyPipelineTimelineHandler = async (req: import('express').Request, res: import('express').Response) => {
  try {
    const msaId = (req.query.msaId as string) || '';
    const explicitState = (req.query.state as string) || '';
    const submarketName = (req.query.submarketName as string) || '';
    const submarketId = (req.query.submarketId as string) || '';
    const quarters = Math.min(Math.max(parseInt(req.query.quarters as string) || 8, 1), 16);

    const { state, cities, msaName } = resolveMsaScope(msaId, explicitState);

    const { getClient } = require('../../database/connection');
    const client = await getClient();

    try {
      const params: (string | number)[] = [state];
      let where = `asp.state = $1`;

      // MSA scoping: restrict to the MSA's primary city/cities (not just state).
      if (cities.length > 0) {
        const placeholders = cities.map(c => {
          params.push(c);
          return `$${params.length}`;
        });
        where += ` AND asp.city IN (${placeholders.join(', ')})`;
      }

      // Submarket scoping: keyword ILIKE on name/address (first token of compound names).
      if (submarketName) {
        const keyword = submarketName.split('/')[0].trim();
        params.push(`%${keyword}%`);
        where += ` AND (asp.name ILIKE $${params.length} OR asp.address ILIKE $${params.length})`;
      }

      // Best-effort propertyId linkage by (address, state). LEFT JOIN so unlinked
      // rows still appear (they fall back to the read-only detail panel).
      const rowsResult = await client.query(
        `SELECT asp.id, asp.name, asp.address, asp.city, asp.state, asp.total_units,
                asp.property_class, asp.available_date, asp.units_delivering,
                p.id::text AS property_id
           FROM apartment_supply_pipeline asp
           LEFT JOIN properties p
             ON LOWER(p.address_line1) = LOWER(asp.address)
            AND p.state_code = asp.state
          WHERE ${where}
          ORDER BY asp.available_date NULLS LAST, asp.total_units DESC NULLS LAST`,
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

        const probability = probabilityByStatus[status];
        const weighted = units * probability;
        const deliveryQuarter = availableDate ? dateToQuarter(availableDate) : null;

        const proj: Project = {
          id: String(r.id),
          name: r.name || r.address || 'Unknown project',
          address: r.address || null,
          submarket: r.city || null,
          developer: null,
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
          cities,
          submarketName: submarketName || null,
          submarketId: submarketId || null,
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
