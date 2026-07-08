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
      
      // Handle honest-absence gracefully
      if ('dataAvailable' in pipeline && !pipeline.dataAvailable) {
        return res.json({
          success: true,
          dealId,
          tradeAreaId,
          data: {
            dataAvailable: false,
            reason: pipeline.reason
          }
        });
      }
      
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
    
    // Handle honest-absence gracefully
    if ('dataAvailable' in pipeline && !pipeline.dataAvailable) {
      return res.json({
        success: true,
        data: {
          dataAvailable: false,
          reason: pipeline.reason
        }
      });
    }
    
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
    
    // Check pipeline availability first
    const pipelineCheck = await supplySignalService.getSupplyPipeline(tradeAreaId);
    if ('dataAvailable' in pipelineCheck && !pipelineCheck.dataAvailable) {
      return res.json({
        success: true,
        data: {
          dataAvailable: false,
          reason: pipelineCheck.reason
        }
      });
    }
    
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

    // ── m04.supply_pressure.updated trigger ───────────────────────────────────
    // After supply_risk_scores is refreshed for a trade area, recompute the
    // concession environment for every deal whose trade area matches so the
    // M04 supply modifier propagates immediately. Non-fatal.
    try {
      const { getPool: _getPool } = require('../../database/connection');
      const { ConcessionEnvironmentEngine } = require('../../services/concession-environment-engine');
      const _pool = _getPool();
      const engine = new ConcessionEnvironmentEngine(_pool);
      // RECOMPUTE_BATCH_LIMIT_M04 — max deals recomputed per supply-risk update event.
      // Set to 200 to bound latency on the synchronous hot-path (POST /supply-risk).
      // Increase or move to async queue if population exceeds this.
      const RECOMPUTE_BATCH_LIMIT_M04 = 200;
      const affectedDeals = await _pool.query(
        `SELECT d.id,
                COALESCE((d.deal_data->>'hold_years')::int, 5) AS hold_years
           FROM deals d
          WHERE d.trade_area_id = $1
            AND d.archived_at IS NULL
          LIMIT ${RECOMPUTE_BATCH_LIMIT_M04}`,
        [tradeAreaId],
      );
      await Promise.allSettled(
        affectedDeals.rows.map((row: { id: string; hold_years: number }) =>
          engine.computeForDeal(row.id, row.hold_years).catch((e: Error) =>
            logger.warn('Concession recompute failed for deal after supply risk update (non-fatal)',
              { dealId: row.id, error: e.message }),
          ),
        ),
      );
      logger.info('Concession env batch recompute after M04 supply risk update',
        { tradeAreaId, dealsRecomputed: affectedDeals.rows.length });
    } catch (triggerErr: any) {
      logger.warn('M04 concession recompute trigger failed (non-fatal)', { error: triggerErr.message });
    }

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
      //
      // Property matching is layered (most-confident wins, via LATERAL):
      //   1. exact lowercase address + state
      //   2. normalized address (normalize_street_address) + state
      //      — handles STREET↔ST, AVE/AVENUE, stripped APT/UNIT suffixes, etc.
      //   3. exact lowercase name + city + state
      //      — picks up properties recorded under their marketing name when
      //        the street address on either side is null/garbled.
      // Match #1 has confidence 1.00, #2 0.90, #3 0.75. All three exceed the
      // 0.70 click-through threshold; we surface the id regardless of which
      // tier hit and let the frontend treat them uniformly.
      const rowsResult = await client.query(
        `SELECT asp.id, asp.name, asp.address, asp.city, asp.state, asp.total_units,
                asp.property_class, asp.available_date, asp.units_delivering,
                pm.property_id::text AS property_id,
                alp.management_company AS developer
           FROM apartment_supply_pipeline asp
           LEFT JOIN LATERAL (
             SELECT p.id AS property_id
               FROM properties p
              WHERE p.state_code = asp.state
                AND (
                  -- Tier 1: exact lowercase address
                  (asp.address IS NOT NULL
                   AND p.address_line1 IS NOT NULL
                   AND LOWER(p.address_line1) = LOWER(asp.address))
                  OR
                  -- Tier 2: normalized address (suffix/abbrev/whitespace tolerant)
                  (asp.address IS NOT NULL
                   AND p.address_line1 IS NOT NULL
                   AND normalize_street_address(p.address_line1)
                       = normalize_street_address(asp.address))
                  OR
                  -- Tier 3: name + city fallback
                  (asp.name IS NOT NULL
                   AND p.name IS NOT NULL
                   AND asp.city IS NOT NULL
                   AND p.city IS NOT NULL
                   AND LOWER(p.name) = LOWER(asp.name)
                   AND LOWER(p.city) = LOWER(asp.city))
                )
              ORDER BY
                CASE
                  WHEN asp.address IS NOT NULL
                   AND p.address_line1 IS NOT NULL
                   AND LOWER(p.address_line1) = LOWER(asp.address) THEN 1
                  WHEN asp.address IS NOT NULL
                   AND p.address_line1 IS NOT NULL
                   AND normalize_street_address(p.address_line1)
                       = normalize_street_address(asp.address) THEN 2
                  ELSE 3
                END,
                p.id
              LIMIT 1
           ) pm ON true
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
 * GET /api/v1/supply/historical-deliveries
 *
 * Backward-looking quarterly view used by the MSA Supply tab chart. Replaces
 * the old hardcoded `deliveryData` placeholder. For each of the past N
 * quarters returns:
 *   - deliveries:          SUM(total_units) from apartment_supply_pipeline,
 *                          bucketed by quarter of `available_date` (preferred)
 *                          or `synced_at` as a fallback when `available_date`
 *                          is NULL — most rows have NULL today.
 *   - rentSignal:          AVG(avg_effective_rent) (or avg_asking_rent fallback)
 *                          from market_rent_comps for the MSA's cities.
 *   - vacancyPct:          100 - AVG(occupancy_pct) for that quarter.
 *   - rentGrowthYoyPct:    YoY change in rentSignal vs. same quarter prior year
 *                          (null when no prior-year row).
 *   - source flags so the frontend can show provenance / fallback chips.
 *
 * `hasRealData` is true when at least one quarter has either deliveries OR a
 * rent signal — the frontend uses this to decide between "real chart" and
 * "placeholder" rendering.
 */
const histDateToQuarter = (d: Date): string => {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
};

const histAdvanceQuarter = (q: string, n: number): string => {
  const [yStr, qStr] = q.split('-Q');
  let qi = parseInt(qStr, 10) - 1 + n;
  let y = parseInt(yStr, 10) + Math.floor(qi / 4);
  qi = ((qi % 4) + 4) % 4;
  return `${y}-Q${qi + 1}`;
};

const quarterStartDate = (q: string): Date => {
  const [yStr, qStr] = q.split('-Q');
  const y = parseInt(yStr, 10);
  const qi = parseInt(qStr, 10) - 1;
  return new Date(Date.UTC(y, qi * 3, 1));
};

export const supplyHistoricalDeliveriesHandler = async (
  req: import('express').Request,
  res: import('express').Response,
) => {
  try {
    const msaId = (req.query.msaId as string) || '';
    const quarters = Math.min(Math.max(parseInt(req.query.quarters as string) || 8, 2), 16);

    if (!msaId) {
      res.status(400).json({ success: false, error: 'msaId is required' });
      return;
    }

    const { getClient } = require('../../database/connection');
    const client = await getClient();

    try {
      const msa = await resolveMsa(client, msaId);
      if (!msa) {
        res.status(404).json({ success: false, error: `MSA not found for id "${msaId}"` });
        return;
      }

      // Reuse the same MSA-bounded municipality logic as pipeline-timeline so
      // both views agree on what cities count for "Atlanta MSA".
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

      // Build the backward-looking quarter window: the most recently CLOSED
      // quarter and the (quarters - 1) preceding it. We exclude the in-progress
      // quarter so deliveries figures don't visibly tick up mid-quarter.
      const now = new Date();
      const currentQ = histDateToQuarter(now);
      const lastClosedQ = histAdvanceQuarter(currentQ, -1);
      const windowQuarters: string[] = [];
      for (let i = quarters - 1; i >= 0; i--) {
        windowQuarters.push(histAdvanceQuarter(lastClosedQ, -i));
      }
      const windowStart = quarterStartDate(windowQuarters[0]);
      const windowEnd = quarterStartDate(histAdvanceQuarter(windowQuarters[windowQuarters.length - 1], 1));

      // ── Deliveries: prefer available_date, fall back to synced_at ──────────
      // We track which source we used so the UI can disclose provenance
      // (most apartment_supply_pipeline rows have available_date = NULL today).
      const stateParams: (string | number)[] = [];
      const stateClauses = msa.stateCodes.map(s => {
        stateParams.push(s);
        return `$${stateParams.length}`;
      });
      const stateWhere = stateClauses.length > 0
        ? `state IN (${stateClauses.join(', ')})`
        : 'TRUE';

      const cityPlaceholders: string[] = [];
      const cityParamsForDelivery = [...stateParams];
      for (const c of cities) {
        cityParamsForDelivery.push(c);
        cityPlaceholders.push(`$${cityParamsForDelivery.length}`);
      }
      const cityWhereDelivery = `city IN (${cityPlaceholders.join(', ')})`;
      cityParamsForDelivery.push(windowStart.toISOString());
      const startIdx = cityParamsForDelivery.length;
      cityParamsForDelivery.push(windowEnd.toISOString());
      const endIdx = cityParamsForDelivery.length;

      const deliveriesResult = await client.query(
        `SELECT
            CASE
              WHEN available_date IS NOT NULL THEN
                EXTRACT(YEAR FROM available_date)::int || '-Q' ||
                ((EXTRACT(MONTH FROM available_date)::int - 1) / 3 + 1)::int
              ELSE
                EXTRACT(YEAR FROM synced_at)::int || '-Q' ||
                ((EXTRACT(MONTH FROM synced_at)::int - 1) / 3 + 1)::int
            END AS quarter,
            CASE WHEN available_date IS NOT NULL THEN 'available_date'
                 ELSE 'synced_at' END AS date_source,
            COALESCE(SUM(total_units), 0)::int AS deliveries,
            COUNT(*)::int AS project_count
           FROM apartment_supply_pipeline
          WHERE ${stateWhere}
            AND ${cityWhereDelivery}
            AND COALESCE(available_date, synced_at) >= $${startIdx}::timestamptz
            AND COALESCE(available_date, synced_at) <  $${endIdx}::timestamptz
          GROUP BY 1, 2`,
        cityParamsForDelivery,
      );

      type DeliveryAgg = { deliveries: number; projectCount: number; sources: Set<string> };
      const deliveriesByQuarter = new Map<string, DeliveryAgg>();
      windowQuarters.forEach(q => deliveriesByQuarter.set(q, {
        deliveries: 0, projectCount: 0, sources: new Set(),
      }));
      for (const r of deliveriesResult.rows) {
        const q = String(r.quarter);
        const bucket = deliveriesByQuarter.get(q);
        if (!bucket) continue;
        bucket.deliveries += Number(r.deliveries) || 0;
        bucket.projectCount += Number(r.project_count) || 0;
        if (r.date_source) bucket.sources.add(String(r.date_source));
      }

      // ── Rent / vacancy: aggregate market_rent_comps quarterly. We pull a
      // wider window (4 extra quarters) so we can compute YoY rent growth for
      // the earliest in-window quarter.
      const yoyStart = quarterStartDate(histAdvanceQuarter(windowQuarters[0], -4));
      const rentParams: (string | number)[] = [];
      const rentStateClauses = msa.stateCodes.map(s => {
        rentParams.push(s);
        return `$${rentParams.length}`;
      });
      const rentStateWhere = rentStateClauses.length > 0
        ? `state IN (${rentStateClauses.join(', ')})`
        : 'TRUE';
      const rentCityPlaceholders: string[] = [];
      for (const c of cities) {
        rentParams.push(c);
        rentCityPlaceholders.push(`$${rentParams.length}`);
      }
      rentParams.push(yoyStart.toISOString());
      const rentStartIdx = rentParams.length;
      rentParams.push(windowEnd.toISOString());
      const rentEndIdx = rentParams.length;

      type RentRow = {
        quarter: string;
        avg_effective: string | null;
        avg_asking: string | null;
        avg_occupancy: string | null;
        sample_size: string;
      };
      const rentByQuarter = new Map<string, {
        avgEffective: number | null;
        avgAsking: number | null;
        avgOccupancy: number | null;
        sampleSize: number;
      }>();
      try {
        const rentResult: { rows: RentRow[] } = await client.query(
          `SELECT
              EXTRACT(YEAR FROM snapshot_date)::int || '-Q' ||
              ((EXTRACT(MONTH FROM snapshot_date)::int - 1) / 3 + 1)::int AS quarter,
              AVG(avg_effective_rent) AS avg_effective,
              AVG(avg_asking_rent)    AS avg_asking,
              AVG(occupancy_pct)      AS avg_occupancy,
              COUNT(*)                AS sample_size
             FROM market_rent_comps
            WHERE ${rentStateWhere}
              AND source != 'costar_upload'
              AND city IN (${rentCityPlaceholders.join(', ')})
              AND snapshot_date >= $${rentStartIdx}::timestamptz
              AND snapshot_date <  $${rentEndIdx}::timestamptz
            GROUP BY 1`,
          rentParams,
        );
        for (const r of rentResult.rows) {
          rentByQuarter.set(String(r.quarter), {
            avgEffective: r.avg_effective != null ? parseFloat(String(r.avg_effective)) : null,
            avgAsking:    r.avg_asking    != null ? parseFloat(String(r.avg_asking))    : null,
            avgOccupancy: r.avg_occupancy != null ? parseFloat(String(r.avg_occupancy)) : null,
            sampleSize:   parseInt(String(r.sample_size), 10) || 0,
          });
        }
      } catch (err) {
        // market_rent_comps is allowed to be empty / not yet populated; we
        // simply omit the rent overlay rather than failing the whole request.
        logger.warn('historical-deliveries: market_rent_comps query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const byQuarter = windowQuarters.map(q => {
        const d = deliveriesByQuarter.get(q)!;
        const r = rentByQuarter.get(q) || null;
        const yoy = rentByQuarter.get(histAdvanceQuarter(q, -4)) || null;

        const rentSignal = r?.avgEffective ?? r?.avgAsking ?? null;
        const rentSource: 'effective' | 'asking' | null =
          r?.avgEffective != null ? 'effective' : r?.avgAsking != null ? 'asking' : null;
        const yoyRent = yoy?.avgEffective ?? yoy?.avgAsking ?? null;
        const rentGrowthYoyPct = (rentSignal != null && yoyRent != null && yoyRent > 0)
          ? parseFloat((((rentSignal - yoyRent) / yoyRent) * 100).toFixed(2))
          : null;

        const vacancyPct = r?.avgOccupancy != null
          ? parseFloat((100 - r.avgOccupancy).toFixed(2))
          : null;

        return {
          quarter: q,
          deliveries: d.deliveries,
          projectCount: d.projectCount,
          deliverySource: Array.from(d.sources).sort().join('+') || null,
          rentSignal: rentSignal != null ? parseFloat(rentSignal.toFixed(2)) : null,
          rentSource,
          rentGrowthYoyPct,
          vacancyPct,
          rentSampleSize: r?.sampleSize ?? 0,
        };
      });

      const totalDeliveries = byQuarter.reduce((s, q) => s + q.deliveries, 0);
      const quartersWithRent = byQuarter.filter(q => q.rentSignal != null).length;
      const hasRealData = totalDeliveries > 0 || quartersWithRent > 0;

      res.json({
        success: true,
        resolved: {
          scope: 'msa' as const,
          msaId: msaId || null,
          msaCanonicalId: msa.id,
          msaName: msa.name,
          stateCodes: msa.stateCodes,
          cities,
          windowQuarters,
        },
        totals: {
          quarters: byQuarter.length,
          totalDeliveries,
          quartersWithRent,
          quartersWithDeliveries: byQuarter.filter(q => q.deliveries > 0).length,
        },
        byQuarter,
        hasRealData,
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting historical supply deliveries', { error: msg });
    res.status(500).json({ success: false, error: msg });
  }
};

supplyExtraRouter.get('/historical-deliveries', supplyHistoricalDeliveriesHandler);

/**
 * GET /api/v1/supply/market-dynamics/:tradeAreaId
 * Get combined demand-supply analysis for trade area
 */
router.get('/market-dynamics/:tradeAreaId', async (req, res) => {
  try {
    const tradeAreaId = req.params.tradeAreaId;
    const quarter = req.query.quarter as string || '2028-Q1';
    
    // Check pipeline availability first
    const pipelineCheck = await supplySignalService.getSupplyPipeline(tradeAreaId);
    if ('dataAvailable' in pipelineCheck && !pipelineCheck.dataAvailable) {
      return res.json({
        success: true,
        data: {
          tradeAreaId,
          quarter,
          dataAvailable: false,
          reason: pipelineCheck.reason
        }
      });
    }
    
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
