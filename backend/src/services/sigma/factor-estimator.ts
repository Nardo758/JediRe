/**
 * Empirical PCA Factor Estimator — M36-A
 *
 * Factor model estimation on real estate panel data.
 *
 * Model:
 *   Y_it = α_i + B_i · F_t + ε_it
 *
 * where F_t are K=6 systematic factors extracted via PCA, B_i are factor loadings,
 * and ε_it ~ N(0, σ²_i) are idiosyncratic residuals.
 *
 * Implied covariance:
 *   Σ = B · Σ_F · Bᵀ + Ψ
 *
 * Estimation methods:
 *   - Standardized PCA on panel data
 *   - Ledoit-Wolf shrinkage of sample covariance → Σ_target
 *   - OLS regression for loadings given factors
 */

import type { Logger } from 'pino';
import { createLogger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FactorResult {
  /** K × K factor covariance matrix */
  factorCov: number[][];
  /** N × K factor loading matrix (loading[i][k] = loading of variable i on factor k) */
  B: number[][];
  /** Factor scores over time: T × K matrix */
  F: number[][];
  /** Residual variances Ψ (length N) */
  Psi: number[];
  /** N × K loadings indexed by variable ID */
  loadingsByName: Record<string, Record<string, number>>;
  /** Variance explained per factor (length K) */
  varianceExplained: number[];
  /** Cumulative variance explained */
  cumulativeVarianceExplained: number[];
  /** Shrinkage intensity δ */
  shrinkageIntensity: number;
  /** Variable order (list of variable IDs, length N) */
  variableOrder: string[];
  /** Factor IDs */
  factorNames: string[];
  /** Means per variable (length N) */
  means: number[];
  /** Std dev per variable (length N) */
  stds: number[];
}

export interface EstimatorOptions {
  nFactors?: number;
  shrinkageTarget?: 'diagonal' | 'single_factor' | 'constant_correlation';
  standardize?: boolean;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('factor-estimator');

// ─── Matrix Utilities ────────────────────────────────────────────────────────

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

function matScale(m: number[][], center: number[], scale: number[]): number[][] {
  return m.map(row => row.map((v, i) => (v - center[i]) / (scale[i] || 1)));
}

function matCov(m: number[][]): number[][] {
  const T = m.length, N = m[0].length;
  const means = matMean(m);
  const cov: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) s += (m[t][i] - means[i]) * (m[t][j] - means[j]);
      cov[i][j] = s / (T - 1);
      cov[j][i] = cov[i][j];
    }
  }
  return cov;
}

function matIdentity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
}

/**
 * Power iteration with deflation to compute top K eigenvalues/eigenvectors.
 */
function powerIteration(cov: number[][], K: number, maxIter: number = 100): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = cov.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];

  let residual = cov.map(r => [...r]);

  for (let k = 0; k < K; k++) {
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    let prevV = new Array(n).fill(0);
    let lambda = 0;

    for (let iter = 0; iter < maxIter; iter++) {
      // Matrix-vector multiply: v_new = residual * v
      const vNew = new Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          vNew[i] += residual[i][j] * v[j];

      // Normalize
      let norm = Math.sqrt(vNew.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-12) break;
      v = vNew.map(x => x / norm);

      // Rayleigh quotient: λ = vᵀ · Σ · v
      const rq = v.reduce((s, vi, i) => {
        let sum = 0;
        for (let j = 0; j < n; j++) sum += residual[i][j] * v[j];
        return s + vi * sum;
      }, 0);

      // Check convergence
      const diff = Math.abs(rq - lambda);
      if (diff < 1e-8 && iter > 2) { lambda = rq; break; }
      lambda = rq;
      prevV = [...v];
    }

    eigenvalues.push(lambda);

    // Store eigenvector
    const ev = [...v];
    // Ensure sign consistency (make first element positive by convention)
    if (ev[0] < 0) ev.forEach((_, i) => ev[i] *= -1);
    eigenvectors.push(ev);

    // Deflation: residual -= λ · v · vᵀ
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        residual[i][j] -= lambda * ev[i] * ev[j];
  }

  return { eigenvalues, eigenvectors };
}

/**
 * Ledoit-Wolf shrinkage intensity.
 * Estimates optimal δ for Σ_shrunk = (1-δ)·S + δ·F where S = sample cov, F = target.
 */
function ledoitWolfIntensity(S: number[][], F: number[][], X: number[][]): number {
  const T = X.length, N = X[0].length;
  if (T < 2 || N < 2) return 0.5;

  // Compute sample means
  const means = matMean(X);

  // Compute π-hat (sum of variances of S entries)
  let piHat = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let varSij = 0;
      for (let t = 0; t < T; t++) {
        const a = (X[t][i] - means[i]) * (X[t][j] - means[j]) - S[i][j] * (T - 1) / T;
        varSij += a * a;
      }
      varSij *= T / ((T - 1) * (T - 1) * (T - 1));
      piHat += varSij;
    }
  }

  // Compute ρ-hat (sum of squared differences between S and F)
  let rhoHat = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      rhoHat += (S[i][j] - F[i][j]) * (S[i][j] - F[i][j]);

  // Compute γ-hat (estimate of pi - rho)
  let gammaHat = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let varSij = 0;
      for (let t = 0; t < T; t++) {
        const a = (X[t][i] - means[i]) * (X[t][j] - means[j]) - S[i][j] * (T - 1) / T;
        varSij += a * a;
      }
      varSij *= T / ((T - 1) * (T - 1) * (T - 1));
      // γ_ij = π_ij - ρ_ij with ρ_ij = (S_ij - F_ij)²
      gammaHat += varSij - (S[i][j] - F[i][j]) * (S[i][j] - F[i][j]);
    }
  }

  const delta = Math.max(0, Math.min(1, gammaHat / (rhoHat + 1e-10)));
  return delta;
}

/**
 * Build shrinkage target: diagonal of variances.
 */
function diagonalTarget(S: number[][]): number[][] {
  const n = S.length;
  const F: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) F[i][i] = S[i][i];
  return F;
}

/**
 * Build shrinkage target: single-factor model approximation.
 */
function singleFactorTarget(S: number[][]): number[][] {
  const n = S.length;
  const F: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Estimate factor loadings: first PC of correlation matrix
  const corr: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      corr[i][j] = (S[i][i] > 0 && S[j][j] > 0) ? S[i][j] / Math.sqrt(S[i][i] * S[j][j]) : 0;

  const { eigenvectors } = powerIteration(corr, 1);
  const loadings = eigenvectors[0];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        F[i][j] = S[i][j]; // diagonal = sample variances
      } else {
        F[i][j] = loadings[i] * loadings[j] * Math.sqrt(S[i][i] * S[j][j]);
      }
    }
  }
  return F;
}

/**
 * Build shrinkage target: constant correlation model.
 */
function constantCorrelationTarget(S: number[][]): number[][] {
  const n = S.length;
  const F: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let avgR = 0;
  let pairCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (S[i][i] > 0 && S[j][j] > 0) {
        avgR += S[i][j] / Math.sqrt(S[i][i] * S[j][j]);
        pairCount++;
      }
    }
  }
  avgR = pairCount > 0 ? avgR / pairCount : 0;
  // Clamp to [-1,1]
  avgR = Math.max(-1, Math.min(1, avgR));

  for (let i = 0; i < n; i++) {
    F[i][i] = S[i][i];
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        F[i][j] = avgR * Math.sqrt(S[i][i] * S[j][j]);
      }
    }
  }
  return F;
}

// ─── Class ───────────────────────────────────────────────────────────────────

export class FactorEstimator {
  /**
   * Estimate factor model from panel data.
   * @param data Record mapping variable ID to array of time-ordered values
   * @param options Configuration for factor count, shrinkage target, etc.
   */
  estimate(data: Record<string, number[]>, options: EstimatorOptions = {}): FactorResult {
    const nFactors = options.nFactors ?? 6;
    const standardize = options.standardize ?? true;
    const shrinkageTarget = options.shrinkageTarget ?? 'single_factor';

    // Build matrix: T × N
    const varIds = Object.keys(data);
    const N = varIds.length;
    if (N === 0) throw new Error('No data provided');

    const T = data[varIds[0]].length;
    // Validate all series same length
    for (const id of varIds) {
      if (data[id].length !== T) {
        throw new Error(`Variable ${id} has ${data[id].length} observations, expected ${T}`);
      }
    }

    // Matrix: rows = time, cols = variables
    const X: number[][] = Array.from({ length: T }, (_, t) => varIds.map(id => data[id][t]));
    const means = matMean(X);

    // Standard deviations
    const stds = new Array(N).fill(1);
    if (standardize) {
      for (let j = 0; j < N; j++) {
        let variance = 0;
        for (let t = 0; t < T; t++) variance += (X[t][j] - means[j]) ** 2;
        stds[j] = Math.sqrt(variance / (T - 1));
        if (stds[j] < 1e-10) stds[j] = 1;
      }
    }

    // Standardize: Z = (X - μ) / σ
    const Z = matScale(X, means, stds);

    // Sample covariance matrix (N × N)
    const S = matCov(Z);

    // Build shrinkage target
    let F: number[][];
    switch (shrinkageTarget) {
      case 'diagonal':
        F = diagonalTarget(S);
        break;
      case 'constant_correlation':
        F = constantCorrelationTarget(S);
        break;
      case 'single_factor':
      default:
        F = singleFactorTarget(S);
        break;
    }

    // Ledoit-Wolf shrinkage
    const delta = ledoitWolfIntensity(S, F, Z);
    const SShrunk: number[][] = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (_, j) => (1 - delta) * S[i][j] + delta * F[i][j])
    );

    // PCA on shrunk covariance (correlation matrix after standardization)
    const nEff = Math.min(nFactors, N);
    const { eigenvalues, eigenvectors } = powerIteration(SShrunk, nEff);

    // B = eigenvectors scaled by sqrt(eigenvalues) — these are factor loadings
    const B: number[][] = eigenvectors.map((ev, i) => {
      const s = Math.sqrt(Math.max(0, eigenvalues[i]));
      return ev.map(x => x * s);
    });

    // Factor scores: F_scores = Z · B · (Bᵀ B)⁻¹ ... simplified: Z · loadings
    // where loadings are the eigenvectors (unit-length)
    const loadingsMat = eigenvectors; // N × K, each column is unit eigenvector
    const Fscores: number[][] = Array.from({ length: T }, (_, t) =>
      loadingsMat[0].map((_, k) => {
        let sum = 0;
        for (let j = 0; j < N; j++) sum += Z[t][j] * eigenvectors[k][j];
        return sum;
      })
    );

    // Residual variances Ψ = diag(SShrunk - B · Bᵀ)
    const BBt = matMul(B, matTranspose(B));
    const Psi: number[] = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      Psi[i] = Math.max(0.001, SShrunk[i][i] - BBt[i][i]);
    }

    // Variance explained
    const totalVar = SShrunk.reduce((sum, row, i) => sum + row[i], 0);
    const varianceExplained = eigenvalues.map(ev => ev / totalVar);
    let cumSum = 0;
    const cumulativeVarianceExplained = eigenvalues.map(ev => {
      cumSum += ev / totalVar;
      return cumSum;
    });

    // Loadings by variable name (for consumption)
    const loadingsByName: Record<string, Record<string, number>> = {};
    for (let j = 0; j < N; j++) {
      loadingsByName[varIds[j]] = {};
      for (let k = 0; k < nEff; k++) {
        loadingsByName[varIds[j]][`F${k + 1}`] = B[j][k];
      }
    }

    return {
      factorCov: matIdentity(nEff), // factors are uncorrelated (PCA property)
      B,
      F: Fscores,
      Psi,
      loadingsByName,
      varianceExplained,
      cumulativeVarianceExplained,
      shrinkageIntensity: delta,
      variableOrder: varIds,
      factorNames: Array.from({ length: nEff }, (_, i) => `F${i + 1}`),
      means,
      stds,
    };
  }

  /**
   * Estimate on a single window. Convenience wrapper around estimate().
   */
  estimateSingleWindow(data: Record<string, number[]>, options?: EstimatorOptions): FactorResult {
    return this.estimate(data, options);
  }

  /**
   * Project new data onto existing factor structure.
   * Given new observations Z_new (N-length), compute factor scores.
   */
  project(newObs: number[], result: FactorResult): number[] {
    const K = result.factorNames.length;
    const N = result.variableOrder.length;

    // Standardize
    const z = newObs.map((v, i) => (v - result.means[i]) / (result.stds[i] || 1));

    // Compute factor scores
    const factors: number[] = [];
    for (let k = 0; k < K; k++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        sum += z[j] * result.B[j][k];
      }
      // Normalize by eigenvalue
      const ev = Math.max(0.001, result.varianceExplained[k] * N);
      factors.push(sum / Math.sqrt(ev));
    }

    return factors;
  }
}

export const factorEstimator = new FactorEstimator();
export default factorEstimator;
