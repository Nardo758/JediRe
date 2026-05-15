/**
 * WS-3 Layers 1+2+3 — Forward Supply Orchestrator
 *
 * Composes:
 *   Layer 1 — RadiusSweepService (PostGIS MF-parcel sweep)
 *   Layer 2 — BatchFeasibilityService (building-envelope capacity)
 *   Layer 3 — RezoneTrendService (non-MF rezone probability × theoretical capacity)
 *
 * Returns:
 *   rings   — per-ring aggregate stats (3mi + 5mi), including L3 trendWeighted field
 *   parcels — MF feasibility parcel list (L1+2 output)
 *   metadata — coordinates, municipality, sweep flags, submarket, L3 trend signal
 */

import { Pool } from 'pg';
import { RadiusSweepService } from './radius-sweep.service';
import { BatchFeasibilityService, type FeasibilityParcel } from './batch-feasibility.service';
import { RezoneTrendService, type TrendSignal } from './rezone-trend.service';
import { logger } from '../utils/logger';

export const RING_RADII = [3, 5] as const;
export type RingRadius = typeof RING_RADII[number];

export interface TrendWeightedRing {
  /**
   * Sum of (theoreticalMFCapacity × rezoneProbability) for all non-MF parcels
   * in this ring.  This is the Phase A probabilistic additional supply figure.
   */
  trendWeightedCapacityUnits: number;
  /** Top-100 non-MF parcels by probabilistic contribution (UI drill-down). */
  probableRezoneParcels: {
    parcelId: string;
    theoreticalMFCapacity: number;
    rezoneProbability: number;
  }[];
}

export interface ForwardSupplyRing {
  radiusMiles: RingRadius;
  parcelCount: number;
  /** Total allowedUnits for all MF-zoned parcels in this ring (L1+2). */
  staticCapacityUnits: number;
  /** allowedUnits summed for VACANT-class parcels. */
  vacantUnits: number;
  /** latentCapacityUnits summed for UNDERBUILT-class parcels. */
  underbuiltUnits: number;
  /** Count of DEVELOPED-class parcels. */
  developedCount: number;
  parcelsByClass: { vacant: number; underbuilt: number; developed: number };
  /** Static capacity by parcel class (sum of allowedUnits per class). */
  staticByClass: { vacant: number; underbuilt: number; developed: number };
  /** Layer 3: probabilistic additional supply from probable rezone parcels. */
  trendWeighted: TrendWeightedRing;
}

export interface ForwardSupplyResult {
  dealId: string;
  computedAt: string;
  rings: ForwardSupplyRing[];
  parcels: (FeasibilityParcel & { ring: RingRadius })[];
  metadata: {
    /** False when no row exists for dealId; callers should return 404. */
    dealFound: boolean;
    lat: number | null;
    lng: number | null;
    hasCoordinates: boolean;
    parcelDataAvailable: boolean;
    municipality: string | null;
    mfZoningFilter: 'broad_mf';
    /** True when the MF parcel sweep hit MAX_PARCELS; ring totals may be understated. */
    sweepTruncated: boolean;
    sweepTotalCount: number;
    /**
     * Layer 3 trend signal — null when coordinates are missing or parcel data
     * is unavailable.
     */
    trendSignal: (TrendSignal & {
      nonMfParcelCount: number;
      nonMfSweepTruncated: boolean;
    }) | null;
  };
}

// ─────────────────────────── Ring builder ───────────────────────────────────

function emptyTrendWeighted(): TrendWeightedRing {
  return { trendWeightedCapacityUnits: 0, probableRezoneParcels: [] };
}

function buildRing(
  radiusMiles: RingRadius,
  parcels: FeasibilityParcel[],
  trendWeighted: TrendWeightedRing,
): ForwardSupplyRing {
  const inRing = parcels.filter((p) => p.distanceMiles <= radiusMiles);
  const byClass = { vacant: 0, underbuilt: 0, developed: 0 };
  const staticByClass = { vacant: 0, underbuilt: 0, developed: 0 };
  let staticCapacity = 0;
  let vacantUnits = 0;
  let underbuiltUnits = 0;

  for (const p of inRing) {
    byClass[p.currentUse]++;
    staticCapacity += p.allowedUnits;
    staticByClass[p.currentUse] += p.allowedUnits;
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
    staticByClass,
    trendWeighted,
  };
}

// ─────────────────────────── Service ────────────────────────────────────────

export class ForwardSupplyService {
  private sweepService: RadiusSweepService;
  private feasibilityService: BatchFeasibilityService;
  private trendService: RezoneTrendService;

  constructor(private pool: Pool) {
    this.sweepService = new RadiusSweepService(pool);
    this.feasibilityService = new BatchFeasibilityService(pool);
    this.trendService = new RezoneTrendService(pool);
  }

  async compute(dealId: string): Promise<ForwardSupplyResult> {
    const dealRow = await this.getDealContext(dealId);

    if (!dealRow) {
      return {
        dealId,
        computedAt: new Date().toISOString(),
        rings: RING_RADII.map((r) => buildRing(r, [], emptyTrendWeighted())),
        parcels: [],
        metadata: {
          dealFound: false,
          lat: null, lng: null,
          hasCoordinates: false,
          parcelDataAvailable: false,
          municipality: null,
          mfZoningFilter: 'broad_mf' as const,
          sweepTruncated: false,
          sweepTotalCount: 0,
          trendSignal: null,
        },
      };
    }

    const { lat, lng, municipality, submarketId } = dealRow;

    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0)) {
      return {
        dealId,
        computedAt: new Date().toISOString(),
        rings: RING_RADII.map((r) => buildRing(r, [], emptyTrendWeighted())),
        parcels: [],
        metadata: {
          dealFound: true,
          lat, lng,
          hasCoordinates: false,
          parcelDataAvailable: false,
          municipality,
          mfZoningFilter: 'broad_mf' as const,
          sweepTruncated: false,
          sweepTotalCount: 0,
          trendSignal: null,
        },
      };
    }

    const largestRadius = Math.max(...RING_RADII);

    logger.debug('[ForwardSupplyService] sweeping L1+L3', { dealId, lat, lng, radiusMiles: largestRadius });

    // Run MF sweep (L1) and trend sweep (L3) in parallel — they query different
    // rows from county_parcels and can proceed simultaneously.
    const [sweepResult, trendResult] = await Promise.all([
      this.sweepService.sweep(lat, lng, largestRadius),
      this.trendService.compute(lat, lng, largestRadius, submarketId, municipality),
    ]);

    const trendSignalMeta = {
      ...trendResult.signal,
      nonMfParcelCount: trendResult.nonMfParcelCount,
      nonMfSweepTruncated: trendResult.nonMfSweepTruncated,
    };

    if (sweepResult.parcels.length === 0) {
      return {
        dealId,
        computedAt: new Date().toISOString(),
        rings: RING_RADII.map((r) => {
          const trendRing = trendResult.rings.find((tr) => tr.radiusMiles === r);
          return buildRing(r, [], trendRing ?? emptyTrendWeighted());
        }),
        parcels: [],
        metadata: {
          dealFound: true,
          lat, lng, hasCoordinates: true, parcelDataAvailable: false,
          municipality, mfZoningFilter: 'broad_mf',
          sweepTruncated: sweepResult.truncated,
          sweepTotalCount: sweepResult.totalCount,
          trendSignal: trendSignalMeta,
        },
      };
    }

    // Layer 2: apply building envelope feasibility to each MF parcel
    const feasible = await this.feasibilityService.run(sweepResult.parcels, municipality ?? '');

    const taggedParcels: (FeasibilityParcel & { ring: RingRadius })[] = feasible.map((p) => ({
      ...p,
      ring: p.distanceMiles <= 3 ? 3 : 5,
    }));

    // Merge L1+2 ring stats with L3 trend weighted rings
    const rings = RING_RADII.map((r) => {
      const trendRing = trendResult.rings.find((tr) => tr.radiusMiles === r) ?? emptyTrendWeighted();
      return buildRing(r, feasible, trendRing);
    });

    return {
      dealId,
      computedAt: new Date().toISOString(),
      rings,
      parcels: taggedParcels,
      metadata: {
        dealFound: true,
        lat, lng, hasCoordinates: true, parcelDataAvailable: true,
        municipality, mfZoningFilter: 'broad_mf',
        sweepTruncated: sweepResult.truncated,
        sweepTotalCount: sweepResult.totalCount,
        trendSignal: trendSignalMeta,
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getDealContext(dealId: string): Promise<{
    lat: number | null;
    lng: number | null;
    municipality: string | null;
    submarketId: string | null;
  } | null> {
    try {
      const result = await this.pool.query<{
        lat: string | null;
        lng: string | null;
        municipality: string | null;
        submarket_id: string | null;
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
           dzc.municipality,
           p.submarket_id
         FROM deals d
         LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
         LEFT JOIN deal_zoning_confirmations dzc ON dzc.deal_id = d.id
         LEFT JOIN properties p ON p.deal_id = d.id
         WHERE d.id = $1
         LIMIT 1`,
        [dealId],
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const lat = row.lat ? parseFloat(row.lat) || null : null;
      const lng = row.lng ? parseFloat(row.lng) || null : null;

      return {
        lat,
        lng,
        municipality: row.municipality ?? null,
        submarketId: row.submarket_id ?? null,
      };
    } catch (err) {
      logger.warn('[ForwardSupplyService] getDealContext failed', {
        dealId, err: (err as Error).message,
      });
      return null;
    }
  }
}
