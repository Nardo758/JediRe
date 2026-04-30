/**
 * KG Deal Ingestion Routes — Explicit trigger endpoints for KG input adapter.
 *
 * These are called by the F-tab system when analysis completes:
 *   POST /api/v1/knowledge-graph/deals/:dealId/on-zoning-complete
 *   POST /api/v1/knowledge-graph/deals/:dealId/on-market-complete
 *   POST /api/v1/knowledge-graph/deals/:dealId/on-program-set
 *
 * Also used for backfill: POST /api/v1/knowledge-graph/deals/:dealId/backfill
 * (runs all three sequentially).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { getKGDealListener } from './kg-deal-listener.service';

// ─── Factory ────────────────────────────────────────────────────────────────

export function createKGDealIngestionRoutes(pool: Pool): Router {
  const router = Router();
  const listener = getKGDealListener(pool);

  // ── Zoning Complete ────────────────────────────────────────────────────

  const zoningSchema = z.object({
    dealName: z.string(),
    jurisdiction: z.string(),
    state: z.string(),
    zoningCode: z.string(),
    zoningProfile: z.record(z.any()),
    bindingConstraint: z.string(),
    developmentEnvelope: z.object({
      maxUnits: z.number(),
      maxGfaSf: z.number(),
      maxStories: z.number(),
      maxHeightFt: z.number(),
      buildingFootprintSf: z.number(),
      parkingSpaces: z.number(),
    }),
  });

  router.post(
    '/deals/:dealId/on-zoning-complete',
    async (req: Request, res: Response) => {
      try {
        const body = zoningSchema.parse(req.body);
        await listener.onZoningAnalysisComplete({
          dealId: req.params.dealId,
          ...body,
        });
        res.json({ success: true, action: 'zoning_ingested', dealId: req.params.dealId });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Zoning ingestion failed' });
      }
    },
  );

  // ── Market Complete ────────────────────────────────────────────────────

  const marketSchema = z.object({
    market: z.string(),
    submarket: z.string(),
    msa: z.string(),
    region: z.string(),
    compDealIds: z.array(z.string()).optional(),
    marketStats: z.record(z.any()).optional(),
    submarketStats: z.record(z.any()).optional(),
  });

  router.post(
    '/deals/:dealId/on-market-complete',
    async (req: Request, res: Response) => {
      try {
        const body = marketSchema.parse(req.body);
        await listener.onMarketAnalysisComplete({
          dealId: req.params.dealId,
          ...body,
        });
        res.json({ success: true, action: 'market_ingested', dealId: req.params.dealId });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Market ingestion failed' });
      }
    },
  );

  // ── Program Set ────────────────────────────────────────────────────────

  const programSchema = z.object({
    targetUnits: z.number(),
    targetGFA: z.number(),
    targetFAR: z.number(),
    targetFloors: z.number(),
    targetHeight: z.number(),
    parkingRatio: z.number(),
    unitMix: z.object({ studio: z.number(), oneBed: z.number(), twoBed: z.number(), threeBed: z.number() }).optional(),
    amenities: z.array(z.object({
      id: z.string(), name: z.string(), category: z.string(), estimatedCost: z.number().optional(),
    })).optional(),
    budget: z.object({ total: z.number(), costPerSqft: z.number() }).optional(),
  });

  router.post(
    '/deals/:dealId/on-program-set',
    async (req: Request, res: Response) => {
      try {
        const body = programSchema.parse(req.body);
        await listener.onProgramTargetsSet({
          dealId: req.params.dealId,
          ...body,
        });
        res.json({ success: true, action: 'program_ingested', dealId: req.params.dealId });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Program ingestion failed' });
      }
    },
  );

  // ── Backfill all three ─────────────────────────────────────────────────

  const backfillSchema = z.object({
    zoning: zoningSchema.optional(),
    market: marketSchema.optional(),
    program: programSchema.optional(),
  });

  router.post(
    '/deals/:dealId/backfill',
    async (req: Request, res: Response) => {
      try {
        const body = backfillSchema.parse(req.body);
        const actions: string[] = [];

        if (body.zoning) {
          await listener.onZoningAnalysisComplete({ dealId: req.params.dealId, ...body.zoning });
          actions.push('zoning');
        }
        if (body.market) {
          await listener.onMarketAnalysisComplete({ dealId: req.params.dealId, ...body.market });
          actions.push('market');
        }
        if (body.program) {
          await listener.onProgramTargetsSet({ dealId: req.params.dealId, ...body.program });
          actions.push('program');
        }

        res.json({ success: true, actions, dealId: req.params.dealId });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Backfill failed' });
      }
    },
  );

  return router;
}
