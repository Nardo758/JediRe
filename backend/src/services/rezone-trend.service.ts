/**
 * WS-3 Layer 3 — Rezone/Upzone Trend Model
 *
 * Computes a trend-weighted additional supply estimate for non-MF-zoned parcels
 * within fixed 3mi/5mi rings by combining three sub-steps:
 *
 *  1. Event Density Signal — queries `key_events` for `zoning_upzoning` and
 *     `entitlement_approval` (positive weight) plus `development_moratorium`
 *     (hard cap) in the submarket to derive a net rezone probability scalar.
 *
 *  2. Non-MF Parcel Sweep — queries `county_parcels` for parcels NOT matching
 *     the broad-MF zoning filter within the largest ring radius.
 *
 *  3. Theoretical MF Capacity — estimates what each non-MF parcel could support
 *     if rezoned, using the municipality's median MF density as a proxy.
 *     Phase A uses this uniform density; Phase B uses empirical rezone rates
 *     from `historical_observations`.
 *
 *  4. Probability-Weighted Capacity — theoreticalMFCapacity × rezoneProbability.
 *     In Phase A, all non-MF parcels in the submarket share the same
 *     `rezoneProbabilityBase`; Phase B calibrates against real outcomes.
 *
 * Phase B empirical calibration is corpus-gated: requires ≥ MIN_PHASE_B_CORPUS
 * observations in `historical_observations` with similar event-density profiles
 * before activating; falls back to Phase A otherwise.
 *
 * NOTE: MF_ZONING_CONDITIONS here must stay in sync with the identical block
 * in radius-sweep.service.ts.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';

const MI_TO_METERS = 1609.344;
const DEG_PER_METER_LAT = 1 / 111320;

/** Hard cap on non-MF parcel sweep — bounds query cost. */
const MAX_NON_MF_PARCELS = 2000;

/** Default MF density when no zoning_districts data is available. */
const DEFAULT_MF_DENSITY_UNITS_PER_ACRE = 25;

// ─────────────────────── Phase A probability constants ───────────────────────
// Each normalised upzoning event (magnitude 1-5 → 0-1 scale) contributes this
// much to the base rezone probability.  Approval events have half the weight.
// NOTE: Keep these in sync with any documentation referencing Phase A constants.
const PROB_PER_UPZONE_UNIT = 0.05;
const PROB_PER_APPROVAL_UNIT = 0.025;
/** Maximum rezone probability regardless of event count or model phase. */
const MAX_REZONE_PROBABILITY = 0.40;
/** When a development_moratorium is active, cap probability at this floor. */
const MORATORIUM_PROBABILITY_CAP = 0.05;
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────── Phase B calibration constants ───────────────────────
/**
 * Minimum number of empirical rezone observations required before Phase B
 * activates.  Below this threshold the corpus is too thin for reliable rate
 * estimates and the system falls back to Phase A.
 */
const MIN_PHASE_B_CORPUS = 5;

/**
 * ±N tolerance when matching the current submarket's upzoning event count to
 * historical corpus rows.  Allows cross-submarket learning even when the
 * exact event count hasn't been observed before.
 */
const PHASE_B_EVENT_BUCKET_WINDOW = 2;

/**
 * Bayesian shrinkage factor.  A corpus of this many observations is treated as
 * "full confidence empirical"; smaller corpora are blended toward the Phase A
 * prior.  Formula: w = corpusSize / (corpusSize + SHRINKAGE_FACTOR).
 */
const PHASE_B_SHRINKAGE_FACTOR = 20;
// ─────────────────────────────────────────────────────────────────────────────

// Matches MF_ZONING_CONDITIONS in radius-sweep.service.ts — MUST stay in sync.
const MF_ZONING_CONDITIONS = `
  (
    county_zoning_code ILIKE '%MF%'
    OR county_zoning_code ILIKE '%RM%'
    OR county_zoning_code ILIKE '%MR%'
    OR county_zoning_code ILIKE '%MDR%'
    OR county_zoning_code ILIKE '%HDR%'
    OR county_zoning_code ILIKE '%RMF%'
    OR county_zoning_code ILIKE '%MFR%'
    OR county_zoning_code ILIKE '%MU%'
    OR county_zoning_code ILIKE '%MX%'
    OR county_zoning_code ILIKE 'R-3%'
    OR county_zoning_code ILIKE 'R3%'
    OR county_zoning_code ILIKE 'R-4%'
    OR county_zoning_code ILIKE 'R4%'
    OR county_zoning_code ILIKE 'R-5%'
    OR county_zoning_code ILIKE 'R5%'
    OR county_zoning_code ILIKE 'R-6%'
    OR county_zoning_code ILIKE 'R6%'
    OR county_zoning_code ILIKE '%APT%'
    OR county_zoning_code ILIKE '%MULTI%'
    OR county_zoning_code ILIKE '%HIGH%DENS%'
    OR county_zoning_code ILIKE '%MH%'
    OR land_use_code ILIKE '%multi%'
    OR land_use_code ILIKE '%apartment%'
    OR land_use_code ILIKE '%condo%'
    OR land_use_code ILIKE '%residential_hi%'
  )
`;

// ─────────────────────────────────── Types ───────────────────────────────────

export interface TrendSignal {
  submarketId: string | null;
  upzoningEventCount: number;
  approvalEventCount: number;
  moratoriumActive: boolean;
  moratoriumName: string | null;
  /**
   * Base rezone probability for all non-MF parcels in the submarket.
   * Range: 0..MAX_REZONE_PROBABILITY (0.40).
   * 0 when submarketId is null (no submarket linked to deal).
   */
  rezoneProbabilityBase: number;
  /**
   * 'A_linear'   — Phase A flat-rate linear model (event count × fixed weights).
   * 'B_empirical' — Phase B empirically-calibrated model using historical rezone
   *                  outcomes from `historical_observations`.
   */
  modelPhase: 'A_linear' | 'B_empirical';
  /**
   * Number of corpus observations matched for Phase B calibration.
   * 0 means Phase B was not attempted or found zero matching rows.
   * > 0 but < MIN_PHASE_B_CORPUS means Phase B fell back to Phase A.
   * ≥ MIN_PHASE_B_CORPUS means Phase B is active (modelPhase = 'B_empirical').
   */
  phaseBCorpusSize: number;
}

export interface TrendRing {
  radiusMiles: 3 | 5;
  /**
   * Sum of (theoreticalMFCapacity × rezoneProbability) across all non-MF
   * parcels within this ring radius.
   */
  trendWeightedCapacityUnits: number;
  /**
   * Top-100 non-MF parcels by probabilistic contribution.  Full ring
   * aggregation uses ALL parcels; this slice is for UI drill-down only.
   * Sorted descending by probabilisticUnits (pre-computed server-side).
   */
  probableRezoneParcels: {
    parcelId: string;
    address: string | null;
    zoningCode: string | null;
    acreage: number;
    distanceMiles: number;
    theoreticalMFCapacity: number;
    rezoneProbability: number;
    probabilisticUnits: number;
  }[];
}

export interface TrendResult {
  signal: TrendSignal;
  rings: TrendRing[];
  /** Total non-MF parcels returned by the sweep (capped at MAX_NON_MF_PARCELS). */
  nonMfParcelCount: number;
  /** True when the non-MF sweep hit the cap; trend totals may be understated. */
  nonMfSweepTruncated: boolean;
}

// ──────────────────────────────── Service ────────────────────────────────────

export class RezoneTrendService {
  constructor(private pool: Pool) {}

  /**
   * Main entry point: compute Layer 3 trend-weighted supply for a deal.
   *
   * @param lat         Deal centroid latitude
   * @param lng         Deal centroid longitude
   * @param radiusMiles Outer ring radius (typically 5 — inner rings are subsets)
   * @param submarketId Submarket linked to the deal (null → signal defaults to 0)
   * @param municipality Municipality name for median MF density lookup
   */
  async compute(
    lat: number,
    lng: number,
    radiusMiles: number,
    submarketId: string | null,
    municipality: string | null,
  ): Promise<TrendResult> {
    const [signal, sweepResult, medianDensity] = await Promise.all([
      this.computeTrendSignal(submarketId),
      this.sweepNonMfParcels(lat, lng, radiusMiles),
      this.getMedianMfDensity(municipality ?? ''),
    ]);

    const densityUnitsPerAcre = medianDensity ?? DEFAULT_MF_DENSITY_UNITS_PER_ACRE;

    // Compute per-parcel theoretical MF capacity and probability-weighted units
    const taggedParcels = sweepResult.parcels.map((p) => {
      const acreage = Math.max(0.01, p.lotAreaSf / 43560);
      const theoreticalMFCapacity = Math.max(0, Math.floor(acreage * densityUnitsPerAcre));
      const rezoneProbability = signal.rezoneProbabilityBase;
      return {
        ...p,
        theoreticalMFCapacity,
        rezoneProbability,
        probabilisticUnits: Math.floor(theoreticalMFCapacity * rezoneProbability),
      };
    });

    // Build per-ring aggregates; each ring is an inclusive subset by distance
    const rings: TrendRing[] = ([3, 5] as const).map((r) => {
      const inRing = taggedParcels.filter((p) => p.distanceMiles <= r);
      const trendWeightedCapacityUnits = inRing.reduce((s, p) => s + p.probabilisticUnits, 0);
      // Top-100 by probabilistic contribution for the UI drill-down list
      const top100 = [...inRing]
        .sort((a, b) => b.probabilisticUnits - a.probabilisticUnits)
        .slice(0, 100);

      return {
        radiusMiles: r,
        trendWeightedCapacityUnits,
        probableRezoneParcels: top100.map((p) => ({
          parcelId: p.parcelId,
          address: p.address,
          zoningCode: p.zoningCode,
          acreage: parseFloat((Math.max(0.01, p.lotAreaSf / 43560)).toFixed(3)),
          distanceMiles: parseFloat(p.distanceMiles.toFixed(3)),
          theoreticalMFCapacity: p.theoreticalMFCapacity,
          rezoneProbability: p.rezoneProbability,
          probabilisticUnits: p.probabilisticUnits,
        })),
      };
    });

    return {
      signal,
      rings,
      nonMfParcelCount: sweepResult.parcels.length,
      nonMfSweepTruncated: sweepResult.truncated,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Orchestrates signal computation: tries Phase B empirical calibration first;
   * falls back to Phase A linear model when corpus is insufficient.
   *
   * Phase B corpus size is always threaded through to `TrendSignal.phaseBCorpusSize`
   * even on fallback, enabling the UI to distinguish "Phase A because no corpus"
   * from "Phase A because corpus too small".
   */
  private async computeTrendSignal(submarketId: string | null): Promise<TrendSignal> {
    if (!submarketId) {
      return {
        submarketId: null,
        upzoningEventCount: 0,
        approvalEventCount: 0,
        moratoriumActive: false,
        moratoriumName: null,
        rezoneProbabilityBase: 0,
        modelPhase: 'A_linear',
        phaseBCorpusSize: 0,
      };
    }

    try {
      const [upzoningRows, approvalRows, moratoriumRows] = await Promise.all([
        this.pool.query<{ magnitude_score: string | null }>(
          `SELECT magnitude_score
           FROM key_events
           WHERE subtype = 'zoning_upzoning'
             AND submarket_id = $1
             AND status NOT IN ('draft', 'cancelled')`,
          [submarketId],
        ),
        this.pool.query<{ magnitude_score: string | null }>(
          `SELECT magnitude_score
           FROM key_events
           WHERE subtype = 'entitlement_approval'
             AND submarket_id = $1
             AND status IN ('announced', 'in_progress', 'materialized')`,
          [submarketId],
        ),
        this.pool.query<{ name: string }>(
          `SELECT name
           FROM key_events
           WHERE subtype = 'development_moratorium'
             AND submarket_id = $1
             AND status IN ('materialized', 'in_progress')
           ORDER BY materialization_date DESC
           LIMIT 1`,
          [submarketId],
        ),
      ]);

      // Normalise magnitude_score (1-5 scale) → 0..1; default 1.0 when absent
      const normalise = (score: string | null): number =>
        score ? Math.min(Math.max(parseFloat(score), 0) / 5, 1.0) : 1.0;

      const upzoningScore = upzoningRows.rows.reduce(
        (s, r) => s + normalise(r.magnitude_score), 0,
      );
      const approvalScore = approvalRows.rows.reduce(
        (s, r) => s + normalise(r.magnitude_score), 0,
      );

      const moratoriumActive = moratoriumRows.rows.length > 0;
      const moratoriumName = moratoriumRows.rows[0]?.name ?? null;

      const upzoningEventCount = upzoningRows.rows.length;
      const approvalEventCount = approvalRows.rows.length;

      // ── Phase A base probability ──────────────────────────────────────────
      const rawProbabilityA = Math.min(
        upzoningScore * PROB_PER_UPZONE_UNIT + approvalScore * PROB_PER_APPROVAL_UNIT,
        MAX_REZONE_PROBABILITY,
      );
      const phaseABase = moratoriumActive
        ? Math.min(rawProbabilityA, MORATORIUM_PROBABILITY_CAP)
        : rawProbabilityA;

      // ── Phase B attempt ───────────────────────────────────────────────────
      // Always await Phase B so we capture corpus size even on fallback.
      const phaseB = await this.computeTrendSignalPhaseB(
        submarketId,
        upzoningEventCount,
        phaseABase,
        moratoriumActive,
      );

      if (phaseB.activated) {
        return {
          submarketId,
          upzoningEventCount,
          approvalEventCount,
          moratoriumActive,
          moratoriumName,
          rezoneProbabilityBase: phaseB.calibratedProb!,
          modelPhase: 'B_empirical',
          phaseBCorpusSize: phaseB.corpusSize,
        };
      }

      // Phase B insufficient corpus — fall back to Phase A.
      // phaseBCorpusSize carries the actual matched row count even when < threshold,
      // allowing the UI to distinguish "fallback (n=3)" from "no corpus (n=0)".
      return {
        submarketId,
        upzoningEventCount,
        approvalEventCount,
        moratoriumActive,
        moratoriumName,
        rezoneProbabilityBase: phaseABase,
        modelPhase: 'A_linear',
        phaseBCorpusSize: phaseB.corpusSize,
      };
    } catch (err) {
      logger.warn('[RezoneTrendService] computeTrendSignal failed', {
        submarketId, err: (err as Error).message,
      });
      return {
        submarketId,
        upzoningEventCount: 0,
        approvalEventCount: 0,
        moratoriumActive: false,
        moratoriumName: null,
        rezoneProbabilityBase: 0,
        modelPhase: 'A_linear',
        phaseBCorpusSize: 0,
      };
    }
  }

  /**
   * Phase B empirical calibration using a two-tier corpus lookup:
   *
   *  Tier 1 — Submarket-specific: rows where `submarket_id` matches the
   *    current submarket AND `rezone_window_months = 24` (vintage gate).
   *    If this tier yields ≥ MIN_PHASE_B_CORPUS observations, use it directly.
   *
   *  Tier 2 — Cross-submarket event-density bucket: rows from any submarket
   *    where the upzoning event count is within ±PHASE_B_EVENT_BUCKET_WINDOW,
   *    `rezone_window_months = 24`, and moratorium state matches.  Used only
   *    when Tier 1 has insufficient coverage.
   *
   * Always returns a result object — `activated: false` and `corpusSize` set to
   * the best corpus size found when below the activation threshold, so the caller
   * can surface "Phase A fallback (n=3)" vs "Phase A (no corpus)" in the UI.
   *
   * @param submarketId         Current deal's submarket
   * @param upzoningEventCount  Current submarket's upzoning event count
   * @param phaseABase          Phase A computed probability (Bayesian prior)
   * @param moratoriumActive    Whether a moratorium is currently active
   */
  private async computeTrendSignalPhaseB(
    submarketId: string,
    upzoningEventCount: number,
    phaseABase: number,
    moratoriumActive: boolean,
  ): Promise<{
    activated: boolean;
    calibratedProb: number | null;
    corpusSize: number;
    matchScope: 'submarket' | 'cross_submarket' | null;
  }> {
    const noData = { activated: false, calibratedProb: null, corpusSize: 0, matchScope: null as null };

    try {
      // Run Tier 1 (submarket-specific × vintage) and Tier 2 (cross-submarket
      // event-bucket × vintage × moratorium) in parallel.
      const [tier1, tier2] = await Promise.all([
        this.pool.query<{ empirical_rate: string | null; corpus_size: string }>(
          `SELECT
             AVG(CASE WHEN rezone_outcome THEN 1.0 ELSE 0.0 END) AS empirical_rate,
             COUNT(*) AS corpus_size
           FROM historical_observations
           WHERE rezone_outcome IS NOT NULL
             AND submarket_id = $1
             AND COALESCE(rezone_window_months, 24) = 24`,
          [submarketId],
        ),
        this.pool.query<{ empirical_rate: string | null; corpus_size: string }>(
          `SELECT
             AVG(CASE WHEN rezone_outcome THEN 1.0 ELSE 0.0 END) AS empirical_rate,
             COUNT(*) AS corpus_size
           FROM historical_observations
           WHERE rezone_outcome IS NOT NULL
             AND COALESCE(rezone_window_months, 24) = 24
             AND ABS(COALESCE(rezone_upzoning_event_count, 0) - $1) <= $2
             AND (
               $3 = false
               OR COALESCE(rezone_moratorium_active, false) = true
             )`,
          [upzoningEventCount, PHASE_B_EVENT_BUCKET_WINDOW, moratoriumActive],
        ),
      ]);

      const t1Size = parseInt(tier1.rows[0]?.corpus_size ?? '0', 10);
      const t2Size = parseInt(tier2.rows[0]?.corpus_size ?? '0', 10);

      // Choose the best tier that meets the activation threshold.
      // Tier 1 (submarket-specific) is preferred for precision; Tier 2 as fallback.
      let row: { empirical_rate: string | null; corpus_size: string } | undefined;
      let matchScope: 'submarket' | 'cross_submarket' | null = null;
      let corpusSize = 0;

      if (t1Size >= MIN_PHASE_B_CORPUS) {
        row = tier1.rows[0];
        matchScope = 'submarket';
        corpusSize = t1Size;
      } else if (t2Size >= MIN_PHASE_B_CORPUS) {
        row = tier2.rows[0];
        matchScope = 'cross_submarket';
        corpusSize = t2Size;
      } else {
        // Neither tier meets the threshold — return the larger of the two sizes
        // so the UI can show "n=3 < 5 needed" rather than just "n=0".
        return {
          activated: false,
          calibratedProb: null,
          corpusSize: Math.max(t1Size, t2Size),
          matchScope: null,
        };
      }

      const empiricalRate = parseFloat(row?.empirical_rate ?? '0') || 0;

      // Bayesian shrinkage: blend empirical rate toward Phase A prior.
      // w → 1 as corpus grows; w → 0 when corpus just clears the threshold.
      const w = corpusSize / (corpusSize + PHASE_B_SHRINKAGE_FACTOR);
      const blended = w * empiricalRate + (1 - w) * phaseABase;

      // Re-apply moratorium cap and global max — these hard limits always hold.
      const calibrated = moratoriumActive
        ? Math.min(blended, MORATORIUM_PROBABILITY_CAP)
        : Math.min(blended, MAX_REZONE_PROBABILITY);

      return { activated: true, calibratedProb: calibrated, corpusSize, matchScope };
    } catch (err) {
      // Phase B is best-effort; any query failure is not fatal — Phase A takes over.
      logger.warn('[RezoneTrendService] computeTrendSignalPhaseB query failed', {
        submarketId, upzoningEventCount, err: (err as Error).message,
      });
      return noData;
    }
  }

  private async sweepNonMfParcels(
    lat: number,
    lng: number,
    radiusMiles: number,
  ): Promise<{
    parcels: Array<{
      parcelId: string;
      address: string | null;
      zoningCode: string | null;
      lotAreaSf: number;
      distanceMiles: number;
    }>;
    truncated: boolean;
  }> {
    const radiusM = radiusMiles * MI_TO_METERS;
    const latOffset = radiusM * DEG_PER_METER_LAT;
    const lngOffset = latOffset / Math.max(0.01, Math.cos((lat * Math.PI) / 180));

    try {
      const result = await this.pool.query<{
        parcel_id: string;
        site_address: string | null;
        county_zoning_code: string | null;
        lot_area_sf: string | null;
        distance_m: string;
        total_count: string;
      }>(
        `SELECT
           parcel_id,
           site_address,
           county_zoning_code,
           lot_area_sf,
           ST_Distance(
             ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
           ) AS distance_m,
           COUNT(*) OVER() AS total_count
         FROM county_parcels
         WHERE centroid_lat BETWEEN $1 - $3 AND $1 + $3
           AND centroid_lng BETWEEN $2 - $4 AND $2 + $4
           AND centroid_lat IS NOT NULL
           AND centroid_lng IS NOT NULL
           AND county_zoning_code IS NOT NULL
           AND ST_DWithin(
             ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $5
           )
           AND NOT ${MF_ZONING_CONDITIONS}
         ORDER BY distance_m
         LIMIT $6`,
        [lat, lng, latOffset, lngOffset, radiusM, MAX_NON_MF_PARCELS],
      );

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

      return {
        parcels: result.rows.map((r) => ({
          parcelId: r.parcel_id,
          address: r.site_address ?? null,
          zoningCode: r.county_zoning_code ?? null,
          lotAreaSf: Math.max(1, parseFloat(r.lot_area_sf ?? '0') || 0),
          distanceMiles: parseFloat(r.distance_m) / MI_TO_METERS,
        })),
        truncated: totalCount > MAX_NON_MF_PARCELS,
      };
    } catch (err) {
      logger.warn('[RezoneTrendService] sweepNonMfParcels failed', {
        lat, lng, radiusMiles, err: (err as Error).message,
      });
      return { parcels: [], truncated: false };
    }
  }

  /**
   * Returns the median max_density_per_acre across MF-eligible zoning districts
   * for the municipality.  Used as a uniform proxy for theoretical MF capacity
   * of non-MF parcels in Phase A (and Phase B — density estimation is separate
   * from probability calibration).
   */
  private async getMedianMfDensity(municipality: string): Promise<number | null> {
    if (!municipality) return null;
    try {
      const result = await this.pool.query<{ median_density: string | null }>(
        `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
           ORDER BY COALESCE(max_density_per_acre, max_units_per_acre)::numeric
         ) AS median_density
         FROM zoning_districts
         WHERE UPPER(COALESCE(municipality, '')) = UPPER($1)
           AND (
             UPPER(COALESCE(zoning_code, district_code)) LIKE '%MF%'
             OR UPPER(COALESCE(zoning_code, district_code)) LIKE '%RM%'
             OR UPPER(COALESCE(zoning_code, district_code)) LIKE '%MDR%'
             OR UPPER(COALESCE(zoning_code, district_code)) LIKE '%HDR%'
           )
           AND COALESCE(max_density_per_acre, max_units_per_acre) > 0`,
        [municipality],
      );
      const val = result.rows[0]?.median_density;
      return val ? parseFloat(val) || null : null;
    } catch {
      return null;
    }
  }
}
