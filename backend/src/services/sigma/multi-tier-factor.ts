/**
 * Multi-Tier Factor Decomposition — M36 Addendum
 *
 * Three-tier factor model for submarket-level analysis.
 *
 * Model (spec §2):
 *   Y_sm,t = α_sm + β_sm · F_national,t + γ_sm · F_MSA(sm),t + ε_sm,t
 *
 * Tiers:
 *   - National (K_n = 6): existing M36 factors
 *   - MSA (K_m = 1..2): metro-specific factors extracted from residuals
 *   - Submarket: OLS regression on national + MSA factors
 *
 * Core linear algebra: PCA for MSA factor extraction, OLS for submarket loadings,
 * shrinkage for sparse submarkets.
 *
 * spec: M36_Multi_Tier_Factor_Addendum.md
 */

import type { Logger } from 'pino';
import { createLogger } from '../../utils/logger';
import { factorEstimator } from './factor-estimator';
import { spatialKernel } from './spatial-kernel';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubmarketFactors {
  submarketId: string;
  msaId: string;
  assetClass: string;
  /** β_sm: national factor loadings (K_n variables) */
  nationalLoadings: Record<string, number>;
  /** γ_sm: MSA factor loadings (K_m variables) */
  msaLoadings: Record<string, number>;
  /** α_sm: submarket-specific mean */
  alpha: number;
  /** σ²_sm: residual variance */
  residualVariance: number;
  /** Shrinkage weight applied (0 = none, >0 = shrunk) */
  shrinkageWeight: number;
  /** T-statistics for loadings */
  tStats: Record<string, number>;
  /** Standard errors */
  standardErrors: Record<string, number>;
  estimationDate: Date;
}

export interface MsaFactorResult {
  msaId: string;
  factors: { factorId: string; factorName: string; varianceExplained: number }[];
  factorScores: Record<string, number[]>;
  estimationDate: Date;
}

export interface ThreeTierSigma {
  /** Combined Σ for a set of submarkets on a single metric.
   *  Σ_ij = β_i · Σ_F_nat · β_j + 𝟙[same_msa] · γ_i · Σ_F_msa · γ_j + 𝟙[same_msa] · ρ_ij · σ_i · σ_j */
  matrix: number[][];
  submarketIds: string[];
  metric: string;
  decomposition: {
    national: number[][];
    msa: number[][];
    spatial: number[][];
    idiosyncratic: number[];
  };
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('multi-tier-factor');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matMul(a: number[][], b: number[][]): number[][] {
  const m = a.length, n = b[0].length, p = b.length;
  const r: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < p; k++)
        r[i][j] += a[i][k] * b[k][j];
  return r;
}

function matTranspose(m: number[][]): number[][] {
  if (m.length === 0) return [];
  return m[0].map((_, i) => m.map(r => r[i]));
}

function matMean(m: number[][]): number[] {
  if (m.length === 0) return [];
  const n = m[0].length;
  const sums = new Array(n).fill(0);
  for (let i = 0; i < m.length; i++)
    for (let j = 0; j < n; j++)
      sums[j] += m[i][j];
  return sums.map(s => s / m.length);
}

/**
 * OLS regression: y = Xβ + ε
 * Returns { beta, residuals, rSquared, standardErrors, tStats }
 */
function ols(
  y: number[],
  X: number[][],
): { beta: number[]; residuals: number[]; rSquared: number; standardErrors: number[]; tStats: number[]; residualVariance: number } {
  const n = y.length;
  const p = X[0].length;

  // X'X
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++)
    for (let j = 0; j < p; j++)
      for (let t = 0; t < n; t++)
        XtX[i][j] += X[t][i] * X[t][j];

  // X'y
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < p; i++)
    for (let t = 0; t < n; t++)
      Xty[i] += X[t][i] * y[t];

  // Solve (X'X)β = X'y via Gaussian elimination
  const aug: number[][] = Array.from({ length: p }, (_, i) => [...XtX[i], Xty[i]]);
  for (let col = 0; col < p; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let j = col; j <= p; j++) aug[col][j] /= pivot;

    for (let row = 0; row < p; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = col; j <= p; j++) aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const beta = aug.map(row => row[p]);

  // Residuals
  const fitted = y.map((_, i) => {
    let sum = 0;
    for (let k = 0; k < p; k++) sum += X[i][k] * (beta[k] ?? 0);
    return sum;
  });
  const residuals = y.map((yi, i) => yi - fitted[i]);

  // R²
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const ssRes = residuals.reduce((s, v) => s + v * v, 0);
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Standard errors
  const residualVariance = (n - p) > 0 ? ssRes / (n - p) : 0;
  const se: number[] = new Array(p).fill(0);
  const tStats: number[] = new Array(p).fill(0);

  try {
    // Estimate covariance of β: σ² · (X'X)⁻¹
    const XtXInv = invertMatrix(XtX, p);
    for (let i = 0; i < p; i++) {
      se[i] = Math.sqrt(Math.max(0, residualVariance * XtXInv[i][i]));
      tStats[i] = se[i] > 0 ? beta[i] / se[i] : 0;
    }
  } catch {
    // Fallback: no SE computation
  }

  return { beta, residuals, rSquared, standardErrors: se, tStats, residualVariance };
}

function invertMatrix(A: number[][], n: number): number[][] {
  const aug: number[][] = Array.from({ length: n }, (_, i) => [...A[i], ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = col; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = col; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  return aug.map(row => row.slice(n));
}

function powerIteration(cov: number[][], K: number): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = cov.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];
  let residual = cov.map(r => [...r]);
  for (let k = 0; k < K; k++) {
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    let lambda = 0;
    for (let iter = 0; iter < 100; iter++) {
      const vNew = new Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          vNew[i] += residual[i][j] * v[j];
      let norm = Math.sqrt(vNew.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-12) break;
      v = vNew.map(x => x / norm);
      const rq = v.reduce((s, vi, i) => {
        let sum = 0;
        for (let j = 0; j < n; j++) sum += residual[i][j] * v[j];
        return s + vi * sum;
      }, 0);
      if (Math.abs(rq - lambda) < 1e-8 && iter > 2) { lambda = rq; break; }
      lambda = rq;
    }
    eigenvalues.push(lambda);
    const ev = [...v];
    if (ev[0] < 0) ev.forEach((_, i) => ev[i] *= -1);
    eigenvectors.push(ev);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        residual[i][j] -= lambda * ev[i] * ev[j];
  }
  return { eigenvalues, eigenvectors };
}

// ─── Class ───────────────────────────────────────────────────────────────────

export class MultiTierFactorDecomposition {
  private submarketResults: Map<string, SubmarketFactors> = new Map();
  private msaResults: Map<string, MsaFactorResult> = new Map();
  private nationalFactorCov: number[][] = [];
  private nationalFactorNames: string[] = [];

  constructor() {}

  // ─── Stage 1: National Factor Model (uses existing FactorEstimator) ───

  /**
   * Set national factor covariance from precomputed FactorEstimator result.
   * spec §3.1: Stage 1.
   */
  setNationalFactors(factorNames: string[], factorCov: number[][]): void {
    this.nationalFactorNames = factorNames;
    this.nationalFactorCov = factorCov.map(r => [...r]);
    log.info({ nFactors: factorNames.length }, 'National factors set');
  }

  // ─── Stage 2: MSA Factor Extraction ──────────────────────────────────

  /**
   * Extract MSA-specific factors from MSA-aggregated residuals.
   * spec §2.3 + §3.2: Stage 2.
   *
   * Step 1: Compute MSA-aggregated metrics (sample-size-weighted avg)
   * Step 2: Project out national factors
   * Step 3: PCA on MSA residuals → top 1-2 components
   * Step 4: F_MSA(m),t = extracted factor scores
   */
  extractMsaFactors(
    msaId: string,
    msaData: Record<string, number[]>,
    nationalScores: Record<string, number[]>,
    submarketCount: number,
  ): MsaFactorResult {
    const metricIds = Object.keys(msaData);
    const T = msaData[metricIds[0]]?.length ?? 0;
    const nNational = this.nationalFactorNames.length;

    // Build national factor design matrix: T × nNational
    const F_nat: number[][] = Array.from({ length: T }, (_, t) =>
      this.nationalFactorNames.map(nf => nationalScores[nf]?.[t] ?? 0)
    );

    // For each metric, compute residual: Y_m,t - β̂_m · F_nat,t
    // We estimate β̂_m via OLS on MSA aggregates
    const residuals: Record<string, number[]> = {};

    for (const metric of metricIds) {
      const y = msaData[metric];
      const result = ols(y, F_nat);
      residuals[metric] = result.residuals;
    }

    // Build residual matrix: T × N_metrics
    const residualMatrix: number[][] = Array.from({ length: T }, (_, t) =>
      metricIds.map(m => residuals[m]?.[t] ?? 0)
    );

    // Standardize residuals
    const means = matMean(residualMatrix);
    const stds = means.map((_, j) => {
      let var_ = 0;
      for (let t = 0; t < T; t++) var_ += (residualMatrix[t][j] - means[j]) ** 2;
      return Math.sqrt(var_ / (T - 1)) || 1;
    });
    const Z = residualMatrix.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

    // PCA on standardized residuals
    const cov: number[][] = Array.from({ length: metricIds.length }, (_, i) =>
      Array.from({ length: metricIds.length }, (_, j) => {
        let s = 0;
        for (let t = 0; t < T; t++) s += Z[t][i] * Z[t][j];
        return s / (T - 1);
      })
    );

    // Extract top 1-2 components
    const nExtract = Math.min(2, metricIds.length);
    const { eigenvalues, eigenvectors } = powerIteration(cov, nExtract);
    const totalVar = eigenvalues.reduce((a, b) => a + b, 0);

    // Factor scores
    const factorScores: Record<string, number[]> = {};
    const factors: { factorId: string; factorName: string; varianceExplained: number }[] = [];

    for (let k = 0; k < nExtract; k++) {
      // Variance explained > 60% of residual? If only one factor, keep it
      if (k === 1 && eigenvalues[1] / totalVar < 0.20 && nExtract > 1) break;

      const varExp = totalVar > 0 ? eigenvalues[k] / totalVar : 0;
      const factorId = `F_MSA_${msaId}_${k + 1}`;
      const factorName = `MSA component ${k + 1} (${(varExp * 100).toFixed(0)}% residual var)`;

      const scores: number[] = new Array(T).fill(0);
      for (let t = 0; t < T; t++) {
        for (let j = 0; j < metricIds.length; j++) {
          scores[t] += Z[t][j] * eigenvectors[k][j];
        }
      }
      factorScores[factorId] = scores;
      factors.push({ factorId, factorName, varianceExplained: varExp });
    }

    const result: MsaFactorResult = {
      msaId,
      factors,
      factorScores,
      estimationDate: new Date(),
    };

    this.msaResults.set(msaId, result);

    log.info({
      msaId,
      factors: factors.length,
      submarketCount,
      residualVarExplained: factors.reduce((s, f) => s + f.varianceExplained, 0),
    }, 'MSA factors extracted');

    return result;
  }

  // ─── Stage 3: Submarket Loadings ─────────────────────────────────────

  /**
   * Estimate submarket loadings β_sm and γ_sm via OLS.
   * spec §2.4 + §3.3: Stage 3.
   *
   * For each submarket:
   *   Regress Y_sm,t on F_national,t and F_MSA(parent),t
   *   Output: β_sm, γ_sm, σ²_sm
   *
   * Regularization for sparse submarkets (n_obs < 36):
   *   β_sm = (1-w)·β_sm,OLS + w·β_typical
   */
  estimateSubmarketLoadings(
    submarketId: string,
    msaId: string,
    assetClass: string,
    ySeries: number[],
    nationalScores: Record<string, number[]>,
    msaFactorResult?: MsaFactorResult,
    typicalLoadings?: Record<string, number>,
  ): SubmarketFactors {
    const T = ySeries.length;
    const nNat = this.nationalFactorNames.length;

    // Build design matrix: [F_nat | F_msa]  (T × (nNat + nMsa))
    let msaFactorIds: string[] = [];
    if (msaFactorResult) {
      msaFactorIds = msaFactorResult.factors.map(f => f.factorId);
    }

    const nPred = nNat + msaFactorIds.length;
    const X: number[][] = Array.from({ length: T }, (_, t) => [
      ...this.nationalFactorNames.map(nf => nationalScores[nf]?.[t] ?? 0),
      ...msaFactorIds.map(mf => msaFactorResult?.factorScores[mf]?.[t] ?? 0),
    ]);

    // OLS
    const result = ols(ySeries, X);

    // Shrinkage for sparse submarkets (spec §2.4)
    const shrinkageWeight = T < 36 ? Math.max(0, (36 - T) / 36) : 0;

    const nationalLoadings: Record<string, number> = {};
    const msaLoadings: Record<string, number> = {};
    const standardErrors: Record<string, number> = {};
    const tStats: Record<string, number> = {};

    for (let i = 0; i < nNat; i++) {
      const nf = this.nationalFactorNames[i];
      let beta = result.beta[i] ?? 0;
      if (shrinkageWeight > 0 && typicalLoadings && typicalLoadings[nf] != null) {
        beta = (1 - shrinkageWeight) * beta + shrinkageWeight * typicalLoadings[nf];
      }
      nationalLoadings[nf] = Math.round(beta * 10000) / 10000;
      standardErrors[nf] = Math.round((result.standardErrors[i] ?? 0) * 10000) / 10000;
      tStats[nf] = Math.round((result.tStats[i] ?? 0) * 100) / 100;
    }

    for (let i = 0; i < msaFactorIds.length; i++) {
      const mf = msaFactorIds[i];
      const idx = nNat + i;
      const gamma = result.beta[idx] ?? 0;
      msaLoadings[mf] = Math.round(gamma * 10000) / 10000;
      standardErrors[mf] = Math.round((result.standardErrors[idx] ?? 0) * 10000) / 10000;
      tStats[mf] = Math.round((result.tStats[idx] ?? 0) * 100) / 100;
    }

    // Mean (alpha)
    const alpha = ySeries.reduce((s, v) => s + v, 0) / T;

    const factors: SubmarketFactors = {
      submarketId,
      msaId,
      assetClass,
      nationalLoadings,
      msaLoadings,
      alpha: Math.round(alpha * 10000) / 10000,
      residualVariance: Math.round(result.residualVariance * 10000) / 10000,
      shrinkageWeight: Math.round(shrinkageWeight * 100) / 100,
      tStats,
      standardErrors,
      estimationDate: new Date(),
    };

    this.submarketResults.set(submarketId, factors);
    return factors;
  }

  // ─── Stage 5: Σ Assembly (Spec §3.5) ────────────────────────────────

  /**
   * Assemble the three-tier Σ for a set of submarkets on a single metric.
   * spec §2.5: Σ_ij decomposition into national + MSA + spatial + idiosyncratic.
   *
   * @param submarketIds - Submarkets to include in the matrix
   * @param metric - Metric being modeled
   * @param nationalFactorCov - Precomputed Σ_F_national (nNat × nNat)
   * @returns Full Σ and decomposed components
   */
  assembleSigma(
    submarketIds: string[],
    metric?: string,
    nationalFactorCov?: number[][],
  ): ThreeTierSigma {
    const n = submarketIds.length;
    const covNat = nationalFactorCov ?? this.nationalFactorCov;
    const nNat = this.nationalFactorNames.length;

    // Initialize component matrices
    const natComponent: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const msaComponent: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const spatialComponent: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const idiovariances: number[] = new Array(n).fill(0);
    const fullMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      const smA = this.submarketResults.get(submarketIds[i]);
      if (!smA) continue;
      idiovariances[i] = smA.residualVariance;

      for (let j = 0; j <= i; j++) {
        const smB = this.submarketResults.get(submarketIds[j]);
        if (!smB) continue;

        const sameMsa = smA.msaId === smB.msaId;

        // National component: β_i · Σ_F_nat · β_jᵀ
        let natCov = 0;
        for (let a = 0; a < nNat; a++) {
          const ba1 = smA.nationalLoadings[this.nationalFactorNames[a]] ?? 0;
          for (let b = 0; b < nNat; b++) {
            const bb2 = smB.nationalLoadings[this.nationalFactorNames[b]] ?? 0;
            natCov += ba1 * (covNat[a]?.[b] ?? 0) * bb2;
          }
        }
        natComponent[i][j] = natCov;
        natComponent[j][i] = natCov;

        // MSA component (if same MSA): γ_i · Σ_F_MSA · γ_jᵀ
        let msaCov = 0;
        if (sameMsa) {
          const msaResult = this.msaResults.get(smA.msaId);
          if (msaResult) {
            for (const fa of msaResult.factors) {
              const ga = smA.msaLoadings[fa.factorId] ?? 0;
              const gb = smB.msaLoadings[fa.factorId] ?? 0;
              // Factors are approximately uncorrelated (PCA property)
              msaCov += ga * fa.varianceExplained * gb;
            }
          }
        }
        msaComponent[i][j] = msaCov;
        msaComponent[j][i] = msaCov;

        // Spatial component (if same MSA): ρ_ij · σ_i · σ_j
        let spatialCov = 0;
        if (sameMsa && submarketIds[i] !== submarketIds[j]) {
          const sdI = Math.sqrt(Math.max(0, smA.residualVariance));
          const sdJ = Math.sqrt(Math.max(0, smB.residualVariance));
          const corr = spatialKernel.getSpatialCorrelation(submarketIds[i], submarketIds[j]);
          if (corr.sameMsa) {
            spatialCov = corr.rho * sdI * sdJ;
          }
        }
        spatialComponent[i][j] = spatialCov;
        spatialComponent[j][i] = spatialCov;

        // Total
        const total = natCov + msaCov + spatialCov;
        fullMatrix[i][j] = total;
        fullMatrix[j][i] = total;

        // Diagonal: add idiosyncratic variance
        if (i === j) {
          fullMatrix[i][i] = total + smA.residualVariance;
          natComponent[i][i] = natCov;
          msaComponent[i][i] = msaCov;
          spatialComponent[i][i] = spatialCov;
        }
      }
    }

    return {
      matrix: fullMatrix,
      submarketIds,
      metric: metric ?? 'unknown',
      decomposition: {
        national: natComponent,
        msa: msaComponent,
        spatial: spatialComponent,
        idiosyncratic: idiovariances,
      },
    };
  }

  // ─── API Helpers ─────────────────────────────────────────────────────

  getSubmarketFactors(submarketId: string): SubmarketFactors | undefined {
    return this.submarketResults.get(submarketId);
  }

  getMsaFactors(msaId: string): MsaFactorResult | undefined {
    return this.msaResults.get(msaId);
  }

  getAllSubmarketResults(): SubmarketFactors[] {
    return Array.from(this.submarketResults.values());
  }

  clearCache(): void {
    this.submarketResults.clear();
    this.msaResults.clear();
  }

  getStats(): { nSubmarkets: number; nMsaExtractions: number } {
    return {
      nSubmarkets: this.submarketResults.size,
      nMsaExtractions: this.msaResults.size,
    };
  }
}

export const multiTierFactorDecomposition = new MultiTierFactorDecomposition();
export default multiTierFactorDecomposition;
