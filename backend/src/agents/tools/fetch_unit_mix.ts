/**
 * Tool: fetch_unit_mix
 *
 * Returns per-floor-plan unit data for a deal — unit counts, in-place rent,
 * market rent, avg sqft, and occupancy. Sponsor overrides applied in the
 * Unit Mix tab are reflected here without an agent re-run.
 *
 * Source priority (mirrors proforma-adjustment.service.ts logic):
 *   1. deal_assumptions.unit_mix (base array) + unit_mix_overrides (applied on top)
 *   2. deals.deal_data.extraction_rent_roll.floor_plan_mix (fallback)
 *
 * Required capability: read:financials
 */

import { z } from 'zod';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ToolDefinition } from '../runtime/types';

const InputSchema = z.object({
  deal_id: z.string().describe('Deal UUID'),
});

const FloorPlanSchema = z.object({
  floor_plan_id: z.string().describe('Floor plan label / type name (e.g. "1BR", "2BR/2BA")'),
  unit_count: z.number(),
  in_place_rent: z.number().nullable().describe('Avg in-place (effective) rent $/unit/month'),
  market_rent: z.number().nullable().describe('Avg market rent $/unit/month'),
  avg_sqft: z.number().nullable(),
  occupancy_pct: z.number().nullable().describe('Occupancy 0–100'),
  override_applied: z.boolean().describe('True if any sponsor override modified this row'),
  source: z.enum(['deal_assumptions', 'extraction_rent_roll']),
});

const OutputSchema = z.object({
  deal_id: z.string(),
  has_data: z.boolean(),
  floor_plans: z.array(FloorPlanSchema),
  total_units: z.number().nullable(),
  source: z.enum(['deal_assumptions', 'extraction_rent_roll', 'none']),
  message: z.string().optional(),
});

export type FetchUnitMixOutput = z.infer<typeof OutputSchema>;

// ── Override key helpers ──────────────────────────────────────────────────────

type OverrideMap = Record<
  string,
  { value?: number | null; originalValue?: number | null } | null
>;

function applyOverrides(
  rawMix: Array<Record<string, unknown>>,
  overrides: OverrideMap
): z.infer<typeof FloorPlanSchema>[] {
  const result: z.infer<typeof FloorPlanSchema>[] = [];

  // Build rawIdx → displayedIdx mapping (mirroring proforma filter logic)
  const displayedRawIndices: number[] = [];
  rawMix.forEach((row, i) => {
    const c = +(row.count ?? row.units ?? 0);
    if (Number.isFinite(c) && c > 0) displayedRawIndices.push(i);
  });

  displayedRawIndices.forEach((rawIdx) => {
    const row = rawMix[rawIdx];
    const typeLabel = String(row.type ?? row.unit_type ?? 'Unknown');
    let inPlaceRent: number | null =
      row.in_place_rent != null ? Number(row.in_place_rent) :
      row.avg_rent       != null ? Number(row.avg_rent)       : null;
    let marketRent: number | null =
      row.market_rent != null ? Number(row.market_rent) : null;
    let overrideApplied = false;

    const ipKey = `unit_mix_override:${rawIdx}:in_place_rent`;
    const mkKey = `unit_mix_override:${rawIdx}:market_rent`;
    const ipOv = overrides[ipKey];
    const mkOv = overrides[mkKey];

    if (ipOv && ipOv.value !== null && ipOv.value !== undefined) {
      inPlaceRent = Number(ipOv.value);
      overrideApplied = true;
    }
    if (mkOv && mkOv.value !== null && mkOv.value !== undefined) {
      marketRent = Number(mkOv.value);
      overrideApplied = true;
    }

    result.push({
      floor_plan_id: typeLabel,
      unit_count: +(row.count ?? row.units ?? 0),
      in_place_rent: inPlaceRent,
      market_rent: marketRent,
      avg_sqft: row.avg_sqft != null ? Number(row.avg_sqft) :
                row.avg_sf   != null ? Number(row.avg_sf)   : null,
      occupancy_pct: row.occupancy_pct != null ? Number(row.occupancy_pct) : null,
      override_applied: overrideApplied,
      source: 'deal_assumptions' as const,
    });
  });

  return result;
}

// ── Fallback: extraction_rent_roll.floor_plan_mix ─────────────────────────────

function fromFloorPlanMix(
  fpm: Record<string, unknown>
): z.infer<typeof FloorPlanSchema>[] {
  return Object.entries(fpm)
    .map(([planName, v]) => {
      const d = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
      const count = +(d.count ?? 0);
      if (!Number.isFinite(count) || count <= 0) return null;
      return {
        floor_plan_id: planName,
        unit_count: count,
        in_place_rent: d.avg_effective_rent != null ? Number(d.avg_effective_rent) : null,
        market_rent: d.avg_market_rent != null && Number(d.avg_market_rent) > 0
          ? Number(d.avg_market_rent) : null,
        avg_sqft: d.avg_sqft != null ? Number(d.avg_sqft) : null,
        occupancy_pct: d.occupancy_pct != null ? Number(d.occupancy_pct) : null,
        override_applied: false,
        source: 'extraction_rent_roll' as const,
      };
    })
    .filter(x => x !== null) as z.infer<typeof FloorPlanSchema>[];
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const fetchUnitMixTool: ToolDefinition<
  z.infer<typeof InputSchema>,
  z.infer<typeof OutputSchema>
> = {
  name: 'fetch_unit_mix',
  description:
    'Fetch per-floor-plan unit mix data for a deal. Returns unit counts, ' +
    'in-place rent, market rent, avg sqft, and occupancy for each floor plan type. ' +
    'Sponsor overrides from the Unit Mix tab are applied before returning results. ' +
    'Use this as the canonical source of floor-plan-level data for GPR and unit-mix analysis.',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  requiresCapability: 'read:financials',

  execute: async (input, ctx) => {
    const dealId = input.deal_id ?? ctx.dealId;
    const empty: z.infer<typeof OutputSchema> = {
      deal_id: dealId ?? input.deal_id,
      has_data: false,
      floor_plans: [],
      total_units: null,
      source: 'none',
    };

    if (!dealId) {
      return { ...empty, message: 'No deal_id provided' };
    }

    try {
      // ── Step 1: Try deal_assumptions.unit_mix + unit_mix_overrides ────────
      const daRes = await query(
        `SELECT unit_mix, unit_mix_overrides
         FROM deal_assumptions
         WHERE deal_id = $1::uuid`,
        [dealId]
      );

      const daRow = daRes.rows[0];
      const rawUnitMix: Array<Record<string, unknown>> | null = (() => {
        const um = daRow?.unit_mix;
        if (!um) return null;
        if (Array.isArray(um) && um.length > 0) return um as Array<Record<string, unknown>>;
        if (typeof um === 'object' && um !== null && !Array.isArray(um)) {
          const entries = Object.entries(um as Record<string, unknown>);
          if (entries.length > 0) {
            return entries.map(([k, v]) => ({
              type: k,
              ...(typeof v === 'object' && v !== null ? (v as object) : {}),
            })) as Array<Record<string, unknown>>;
          }
        }
        return null;
      })();

      if (rawUnitMix && rawUnitMix.length > 0) {
        const overrides = (daRow?.unit_mix_overrides ?? {}) as OverrideMap;
        const floorPlans = applyOverrides(rawUnitMix, overrides);
        const totalUnits = floorPlans.reduce((s, fp) => s + fp.unit_count, 0);
        return {
          deal_id: dealId,
          has_data: floorPlans.length > 0,
          floor_plans: floorPlans,
          total_units: totalUnits,
          source: 'deal_assumptions',
        };
      }

      // ── Step 2: Fallback to extraction_rent_roll.floor_plan_mix ──────────
      const fpmRes = await query(
        `SELECT deal_data->'extraction_rent_roll'->'floor_plan_mix' AS fpm
         FROM deals
         WHERE id = $1::uuid AND deal_data IS NOT NULL`,
        [dealId]
      );

      const fpmRaw = fpmRes.rows[0]?.fpm as Record<string, unknown> | null;
      if (fpmRaw && typeof fpmRaw === 'object' && Object.keys(fpmRaw).length > 0) {
        const floorPlans = fromFloorPlanMix(fpmRaw);
        const totalUnits = floorPlans.reduce((s, fp) => s + fp.unit_count, 0);
        return {
          deal_id: dealId,
          has_data: floorPlans.length > 0,
          floor_plans: floorPlans,
          total_units: totalUnits,
          source: 'extraction_rent_roll',
        };
      }

      return { ...empty, message: 'No unit mix data found in deal_assumptions or extraction_rent_roll' };
    } catch (err) {
      logger.warn('fetch_unit_mix: DB query failed', {
        dealId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ...empty, source: 'none', message: 'DB query failed' };
    }
  },
};
