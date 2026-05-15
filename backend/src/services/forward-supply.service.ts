/**
 * WS-3 Layers 1+2 — Forward Supply Orchestrator
 *
 * Composes RadiusSweepService (Layer 1) and BatchFeasibilityService (Layer 2)
 * into a full forward-supply projection for a deal.
 *
 * Returns:
 *  rings   — per-ring aggregate stats for 3mi and 5mi fixed rings
 *  parcels — full parcel list with feasibility attributes
 */

import { Pool } from 'pg';
import { RadiusSweepService } from './radius-sweep.service';
import { BatchFeasibilityService, type FeasibilityParcel } from './batch-feasibility.service';
import { logger } from '../utils/logger';

export const RING_RADII = [3, 5] as const;
export type RingRadius = typeof RING_RADII[number];

export interface ForwardSupplyRing {
  radiusMiles: RingRadius;
  parcelCount: number;
  staticCapacityUnits: number;
  vacantUnits: number;
  underbuiltUnits: number;
  developedCount: number;
  parcelsByClass: {
    vacant: number;
    underbuilt: number;
    developed: number;
  };
}

export interface ForwardSupplyResult {
  dealId: string;
  computedAt: string;
  rings: ForwardSupplyRing[];
  parcels: (FeasibilityParcel & { ring: RingRadius })[];
  metadata: {
    lat: number | null;
    lng: number | null;
    hasCoordinates: boolean;
    parcelDataAvailable: boolean;
    municipality: string | null;
    mfZoningFilter: 'broad_mf';
  };
}

function buildRing(
  radiusMiles: RingRadius,
  parcels: FeasibilityParcel[],
): ForwardSupplyRing {
  const inRing = parcels.filter((p) => p.distanceMiles <= radiusMiles);
  const byClass = { vacant: 0, underbuilt: 0, developed: 0 };
  let staticCapacity = 0;
  let vacantUnits = 0;
  let underbuiltUnits = 0;

  for (const p of inRing) {
    byClass[p.currentUse]++;
    staticCapacity += p.allowedUnits;
    if (p.currentUse === 'vacant') vacantUnits += p.allowedUnits;
    if (p.currentUse === 'underbuilt') underbuiltUnits += p.latentCapacityUnits;
  }

  return {
    radiusMiles,
    parcelCount: inRing.length,
    staticCapacityUnits: staticCapacity,
    vacantUnits,
    underbuiltUnits,
    developedCount: byClass.developed,
    parcelsByClass: byClass,
  };
}

export class ForwardSupplyService {
  private sweepService: RadiusSweepService;
  private feasibilityService: BatchFeasibilityService;

  constructor(private pool: Pool) {
    this.sweepService = new RadiusSweepService(pool);
    this.feasibilityService = new BatchFeasibilityService(pool);
  }

  async compute(dealId: string): Promise<ForwardSupplyResult> {
    const dealRow = await this.getDealContext(dealId);

    const emptyMeta = {
      lat: null,
      lng: null,
      hasCoordinates: false,
      parcelDataAvailable: false,
      municipality: null,
      mfZoningFilter: 'broad_mf' as const,
    };

    if (!dealRow) {
      return {
        dealId,
        computedAt: new Date().toISOString(),
        rings: RING_RADII.map((r) => buildRing(r, [])),
        parcels: [],
        metadata: emptyMeta,
      };
    }

    const { lat, lng, municipality } = dealRow;

    if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return {
        dealId,
        computedAt: new Date().toISOString(),
        rings: RING_RADII.map((r) => buildRing(r, [])),
        parcels: [],
        metadata: { ...emptyMeta, lat, lng, municipality },
      };
    }

    const largestRadius = Math.max(...RING_RADII);

    logger.debug('[ForwardSupplyService] sweeping', { dealId, lat, lng, radiusMiles: largestRadius });

    const swept = await this.sweepService.sweep(lat, lng, largestRadius);

    if (swept.length === 0) {
      return {
        dealId,
        computedAt: new Date().toISOString(),
        rings: RING_RADII.map((r) => buildRing(r, [])),
        parcels: [],
        metadata: {
          lat, lng, hasCoordinates: true, parcelDataAvailable: false,
          municipality, mfZoningFilter: 'broad_mf',
        },
      };
    }

    const feasible = await this.feasibilityService.run(swept, municipality ?? '');

    const taggedParcels: (FeasibilityParcel & { ring: RingRadius })[] = feasible.map((p) => ({
      ...p,
      ring: p.distanceMiles <= 3 ? 3 : 5,
    }));

    const rings = RING_RADII.map((r) => buildRing(r, feasible));

    return {
      dealId,
      computedAt: new Date().toISOString(),
      rings,
      parcels: taggedParcels,
      metadata: {
        lat, lng, hasCoordinates: true, parcelDataAvailable: true,
        municipality, mfZoningFilter: 'broad_mf',
      },
    };
  }

  private async getDealContext(dealId: string): Promise<{
    lat: number | null;
    lng: number | null;
    municipality: string | null;
  } | null> {
    try {
      const result = await this.pool.query<{
        lat: string | null;
        lng: string | null;
        municipality: string | null;
      }>(
        `SELECT
           COALESCE(
             pb.centroid[1]::text,
             d.deal_data->'coordinates'->>'lat'
           ) AS lat,
           COALESCE(
             pb.centroid[0]::text,
             d.deal_data->'coordinates'->>'lng'
           ) AS lng,
           dzc.municipality
         FROM deals d
         LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
         LEFT JOIN deal_zoning_confirmations dzc ON dzc.deal_id = d.id
         WHERE d.id = $1
         LIMIT 1`,
        [dealId],
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const lat = row.lat ? parseFloat(row.lat) || null : null;
      const lng = row.lng ? parseFloat(row.lng) || null : null;

      return { lat, lng, municipality: row.municipality ?? null };
    } catch (err) {
      logger.warn('[ForwardSupplyService] getDealContext failed', {
        dealId, err: (err as Error).message,
      });
      return null;
    }
  }
}
