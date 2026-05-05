/**
 * Spatial Kernel — M36-C
 *
 * Submarket residual correlation via drive-time distance decay.
 *
 * Model:
 *   ρ_spatial(sm_a, sm_b) = exp(-d(sm_a, sm_b) / λ)
 *
 * where d is drive-time in minutes and λ is calibrated per MSA tier.
 *
 * Tier-1 (NYC, LA, Chicago, SF): λ = 12 minutes
 * Tier-2 (Tampa, Charlotte, Phoenix): λ = 18 minutes
 * Tier-3 (smaller MSAs): λ = 25 minutes
 *
 * The spatial kernel applies to submarket (sm) pairs within the SAME MSA.
 * Cross-MSA pairs have ρ = 0 (no spatial coherence beyond factor model).
 *
 * For the three-tier factor model (per M36 Multi-Tier Factor Addendum):
 *   Cov(Y_sm_a, Y_sm_b) = β_a · Σ_F_national · β_bᵀ + 𝟙[same MSA] · γ_a · Σ_F_MSA · γ_bᵀ + 𝟙[same MSA] · ρ_spatial · σ_res_a · σ_res_b
 */

import type { Logger } from 'pino';
import { createLogger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubmarketLocation {
  submarketId: string;
  msaId: string;
  msaTier: 1 | 2 | 3;
  centroidLat: number;
  centroidLng: number;
  name?: string;
}

export interface MsaSpatialConfig {
  msaId: string;
  msaTier: 1 | 2 | 3;
  lambdaMinutes: number;
  metricSpecificOverrides?: Record<string, number>;
}

export interface SpatialCorrelation {
  submarketA: string;
  submarketB: string;
  sameMsa: boolean;
  driveMinutes: number | null;
  rho: number;
  lambdaUsed: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Tier-specific λ defaults (per M36 Multi-Tier spec §2.6)
const LAMBDA_TIER: Record<number, number> = {
  1: 12,
  2: 18,
  3: 25,
};

// Known MSA → tier mapping. Extended as needed.
const DEFAULT_MSA_TIERS: Record<string, number> = {
  'nyc': 1, 'nynj': 1, 'newark': 1,
  'lax': 1, 'los_angeles': 1, 'long_beach': 1,
  'chi': 1, 'chicago': 1, 'naperville': 1,
  'sf_bay': 1, 'san_francisco': 1, 'oakland': 1,

  'tampa': 2, 'st_petersburg': 2, 'clearwater': 2,
  'clt': 2, 'charlotte': 2, 'gastonia': 2, 'concord': 2,
  'phx': 2, 'phoenix': 2, 'mesa': 2, 'scottsdale': 2,
  'atl': 2, 'atlanta': 2, 'sandy_springs': 2,
  'mia': 2, 'miami': 2, 'fort_lauderdale': 2,
  'orl': 2, 'orlando': 2, 'kissimmee': 2,
  'dal': 2, 'dallas': 2, 'fort_worth': 2, 'arlington': 2,
  'hou': 2, 'houston': 2, 'the_woodlands': 2,
  'wdc': 2, 'washington': 2, 'arlington_msa': 2,
  'sea': 2, 'seattle': 2, 'tacoma': 2, 'bellevue': 2,
  'den': 2, 'denver': 2, 'aurora': 2, 'lakewood': 2,

  // Everything else defaults to tier 3
};

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('spatial-kernel');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Haversine distance in miles between two lat/lng points.
 * Used as fallback when drive-time isn't available.
 */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rough drive-time estimate (miles / 35 mph) + 5 min fixed overhead.
 * Used when live drive-time API isn't available.
 */
function estimatedDriveMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const miles = haversineMiles(lat1, lng1, lat2, lng2);
  return miles / 35 * 60 + 5; // ~35 mph average urban speed + overhead
}

// ─── Class ───────────────────────────────────────────────────────────────────

export class SpatialKernel {
  private submarketRegistry: Map<string, SubmarketLocation> = new Map();
  private msaConfigs: Map<string, MsaSpatialConfig> = new Map();
  private distanceCache: Map<string, number> = new Map();

  constructor() {}

  // ─── Registry Management ─────────────────────────────────────────────

  registerSubmarket(sm: SubmarketLocation): void {
    this.submarketRegistry.set(sm.submarketId, sm);

    // Ensure MSA config exists
    const msaKey = sm.msaId.toLowerCase();
    if (!this.msaConfigs.has(msaKey)) {
      const tier = DEFAULT_MSA_TIERS[msaKey] ?? 3;
      const lambda = LAMBDA_TIER[tier] ?? 18;
      this.msaConfigs.set(msaKey, {
        msaId: sm.msaId,
        msaTier: tier as 1 | 2 | 3,
        lambdaMinutes: lambda,
      });
    }
  }

  registerSubmarkets(locations: SubmarketLocation[]): void {
    for (const loc of locations) this.registerSubmarket(loc);
  }

  getSubmarket(id: string): SubmarketLocation | undefined {
    return this.submarketRegistry.get(id);
  }

  getMsaConfig(msaId: string): MsaSpatialConfig | undefined {
    return this.msaConfigs.get(msaId.toLowerCase());
  }

  // ─── Distance Retrieval ─────────────────────────────────────────────

  private cacheKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /**
   * Get or estimate drive-time between two submarkets.
   * Caches by pair (canonical ordering: submarketA_id < submarketB_id).
   */
  getDriveMinutes(submarketAId: string, submarketBId: string): number | null {
    const key = this.cacheKey(submarketAId, submarketBId);

    // Check cache
    const cached = this.distanceCache.get(key);
    if (cached !== undefined) return cached;

    // Look up submarkets
    const smA = this.submarketRegistry.get(submarketAId);
    const smB = this.submarketRegistry.get(submarketBId);

    if (smA && smB) {
      // Check same MSA
      if (smA.msaId !== smB.msaId) {
        this.distanceCache.set(key, -1); // sentinel for cross-MSA
        return null;
      }

      // Estimate drive-time
      const driveMin = estimatedDriveMinutes(smA.centroidLat, smA.centroidLng, smB.centroidLat, smB.centroidLng);
      this.distanceCache.set(key, driveMin);
      return driveMin;
    }

    return null;
  }

  // ─── Spatial Correlation ─────────────────────────────────────────────

  /**
   * Compute spatial correlation ρ between two submarkets.
   *
   * @param submarketAId - First submarket ID
   * @param submarketBId - Second submarket ID
   * @param msaTierOverride - Optional override for MSA tier (auto-detected if not provided)
   * @returns Spatial correlation ρ (0 = no correlation, 1 = identical location)
   */
  getSpatialCorrelation(
    submarketAId: string,
    submarketBId: string,
    msaTierOverride?: number,
  ): SpatialCorrelation {
    const smA = this.submarketRegistry.get(submarketAId);
    const smB = this.submarketRegistry.get(submarketBId);

    if (!smA || !smB) {
      return {
        submarketA: submarketAId,
        submarketB: submarketBId,
        sameMsa: false,
        driveMinutes: null,
        rho: 0,
        lambdaUsed: 18,
      };
    }

    const sameMsa = smA.msaId === smB.msaId;
    if (!sameMsa) {
      return {
        submarketA: submarketAId,
        submarketB: submarketBId,
        sameMsa: false,
        driveMinutes: null,
        rho: 0,
        lambdaUsed: LAMBDA_TIER[msaTierOverride ?? smA.msaTier] ?? 18,
      };
    }

    // Determine λ
    const tier = msaTierOverride ?? smA.msaTier;
    const lambda = LAMBDA_TIER[tier] ?? 18;

    // Get drive-time
    let driveMin = this.getDriveMinutes(submarketAId, submarketBId);
    if (driveMin === null || driveMin < 0) {
      // Fallback: use haversine-based estimate even for same MSA
      driveMin = estimatedDriveMinutes(smA.centroidLat, smA.centroidLng, smB.centroidLat, smB.centroidLng);
    }

    // Exponential decay
    const rho = Math.exp(-driveMin / lambda);

    return {
      submarketA: submarketAId,
      submarketB: submarketBId,
      sameMsa: true,
      driveMinutes: driveMin,
      rho,
      lambdaUsed: lambda,
    };
  }

  /**
   * Compute residual covariance contributed by spatial kernel for a submarket pair.
   *
   * Cov = ρ_spatial × σ_res_a × σ_res_b
   *
   * @param idA - Submarket A ID
   * @param idB - Submarket B ID
   * @param residualStdA - Residual standard deviation for submarket A (σ_res_a)
   * @param residualStdB - Residual standard deviation for submarket B (σ_res_b)
   * @param msaTierOverride - Optional MSA tier override
   */
  getSpatialCovariance(
    idA: string,
    idB: string,
    residualStdA: number,
    residualStdB: number,
    msaTierOverride?: number,
  ): number {
    const corr = this.getSpatialCorrelation(idA, idB, msaTierOverride);
    if (!corr.sameMsa) return 0;
    return corr.rho * residualStdA * residualStdB;
  }

  // ─── Calibration ────────────────────────────────────────────────────

  /**
   * Calibrate λ for a specific MSA given residual correlation data.
   *
   * Using maximum likelihood:
   *   L(λ) = -½ Σ[(ε_i - ε_j)² / σ²_spatial + log(σ²_spatial)] + const
   *
   * where σ²_spatial = ρ(d_ij, λ) · σ_i · σ_j
   *
   * @param msaId - MSA to calibrate for
   * @param residuals - Residual matrix: each row is a submarket, each column is a time point
   * @param distances - Distance matrix: distances[i][j] = drive-time between submarket i and j (minutes)
   * @param msaTier - MSA tier for initial guess
   * @returns Calibrated λ in minutes
   */
  calibrateLambda(
    msaId: string,
    residuals: number[][],
    distances: number[],
    msaTier: number = 3,
  ): number {
    const n = residuals.length;
    if (n < 2 || distances.length < n * n) {
      log.warn({ msaId, n }, 'Insufficient data for λ calibration, using tier-default');
      return LAMBDA_TIER[msaTier] ?? 18;
    }

    // Compute residual variances
    const residualVars: number[] = [];
    for (let i = 0; i < n; i++) {
      const T = residuals[i].length;
      const mean = residuals[i].reduce((s, v) => s + v, 0) / T;
      const var_ = residuals[i].reduce((s, v) => s + (v - mean) ** 2, 0) / (T - 1);
      residualVars.push(Math.max(var_, 0.0001));
    }

    // Grid search for optimal λ
    const candidates = [5, 8, 10, 12, 15, 18, 20, 22, 25, 30, 35, 40, 45, 50];
    let bestLambda = LAMBDA_TIER[msaTier] ?? 18;
    let bestNegLL = Infinity;

    for (const lambda of candidates) {
      let negLL = 0;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = distances[i * n + j];
          if (d <= 0) continue;

          const rho = Math.exp(-d / lambda);
          const sigmaProduct = Math.sqrt(residualVars[i] * residualVars[j]);
          const expectedCov = rho * sigmaProduct;

          // Empirical covariance
          const T = residuals[i].length;
          let empCov = 0;
          for (let t = 0; t < T; t++) {
            empCov += (residuals[i][t] - 0) * (residuals[j][t] - 0);
          }
          empCov /= T;

          // Negative log-likelihood contribution
          const diff = empCov - expectedCov;
          negLL += diff * diff / Math.max(sigmaProduct * sigmaProduct, 0.0001);
        }
      }

      if (negLL < bestNegLL) {
        bestNegLL = negLL;
        bestLambda = lambda;
      }
    }

    log.info({ msaId, bestLambda, bestNegLL }, 'λ calibrated for MSA');

    // Update config
    const msaKey = msaId.toLowerCase();
    if (this.msaConfigs.has(msaKey)) {
      this.msaConfigs.get(msaKey)!.lambdaMinutes = bestLambda;
    }

    return bestLambda;
  }

  /**
   * Set or override MSA tier and λ.
   */
  setMsaConfig(msaId: string, tier: 1 | 2 | 3, lambdaMinutes?: number): void {
    this.msaConfigs.set(msaId.toLowerCase(), {
      msaId,
      msaTier: tier,
      lambdaMinutes: lambdaMinutes ?? LAMBDA_TIER[tier],
    });
  }

  /**
   * Clear distance cache (e.g., after submarket boundary changes).
   */
  clearCache(): void {
    this.distanceCache.clear();
  }

  /**
   * Get statistics on the spatial kernel.
   */
  getStats(): { registeredSubmarkets: number; msaConfigs: number; cachedDistances: number } {
    return {
      registeredSubmarkets: this.submarketRegistry.size,
      msaConfigs: this.msaConfigs.size,
      cachedDistances: this.distanceCache.size,
    };
  }
}

export const spatialKernel = new SpatialKernel();
export default spatialKernel;
