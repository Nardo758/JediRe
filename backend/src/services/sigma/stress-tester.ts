/**
 * Stress Tester & Anomaly Detector — M36-E
 *
 * Implements M36 spec §4.6 (Stress Testing) and §4.7 (Anomaly Detection).
 *
 * Stress testing:
 *   - Factor-shock scenarios: apply k-σ shocks along factor directions
 *   - Principal component stress: move along eigenvectors of Σ
 *   - Generates scenario variable sets from factor loadings
 *
 * Anomaly detection:
 *   - Mahalanobis M_t tracking over time
 *   - Chi-squared significance testing
 *   - Driving variable identification
 *   - Sustained anomaly detection (multi-month window)
 *
 * The M_t statistic:
 *   M_t = (x_t - μ_pred,t)ᵀ · Σ_pred,t⁻¹ · (x_t - μ_pred,t)
 *   ~ χ²_N under the null (N = number of variables)
 */

import type { Logger } from 'pino';
import { createLogger } from '../../utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnomalyResult {
  mahalanobisD: number;
  pValue: number;
  drivingVars: string[];
  drivingContributions: Record<string, number>;
  isAnomaly: boolean;
  threshold: number;
  nVariables: number;
  date?: string;
}

export interface StressScenario {
  name: string;
  variableShocks: Record<string, number>;
  factorDescription: string;
  kSigma: number;
}

export interface AnomalyTimeSeries {
  date: string;
  mahalanobisD: number;
  pValue: number;
  isAnomaly: boolean;
  drivingVars: string[];
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('stress-tester');

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

function matIdentity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
}

/**
 * Cholesky decomposition for solving A·x = b.
 */
function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      if (j === i) {
        for (let k = 0; k < j; k++) sum += L[j][k] * L[j][k];
        L[j][j] = Math.sqrt(Math.max(1e-10, A[j][j] - sum));
      } else {
        for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
        L[i][j] = L[j][j] > 0 ? (A[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
}

function forwardSub(L: number[][], b: number[]): number[] {
  const n = L.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i][j] * y[j];
    y[i] = L[i][i] !== 0 ? (b[i] - sum) / L[i][i] : 0;
  }
  return y;
}

function backSub(L: number[][], y: number[]): number[] {
  const n = L.length;
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += L[j][i] * x[j];
    x[i] = L[i][i] !== 0 ? (y[i] - sum) / L[i][i] : 0;
  }
  return x;
}

/**
 * Power iteration for top-K eigenvalues/vectors.
 */
function powerIteration(cov: number[][], K: number, maxIter = 100): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = cov.length;
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];
  let residual = cov.map(r => [...r]);

  for (let k = 0; k < K; k++) {
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    let lambda = 0;

    for (let iter = 0; iter < maxIter; iter++) {
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

// ─── Class ──────────────────────────────────────────────────────────────────

export class StressTester {
  /**
   * Compute anomaly score (Mahalanobis distance) for a single observation.
   *
   * M_t = (x_t - μ)ᵀ · Σ⁻¹ · (x_t - μ)
   *
   * Under the null (no anomaly): M_t ~ χ²_N.
   *
   * @param observation - Observed variable values (keyed by variable ID)
   * @param mean - Mean vector
   * @param cov - N×N covariance matrix
   * @param varOrder - Variable order in the covariance matrix (N-length)
   * @param thresholdP - p-value threshold for anomaly flag (default: 0.05)
   */
  computeAnomalyScore(
    observation: Record<string, number>,
    mean: Record<string, number>,
    cov: number[][],
    varOrder: string[],
    thresholdP: number = 0.05,
  ): AnomalyResult {
    const N = varOrder.length;
    const x = varOrder.map(v => observation[v] ?? mean[v] ?? 0);
    const μ = varOrder.map(v => mean[v] ?? 0);

    // Center the observation
    const centered = x.map((xi, i) => xi - μ[i]);

    // Compute d² = centeredᵀ · Σ⁻¹ · centered
    // Solve Σ · z = centered, then d² = centeredᵀ · z
    let mahalanobisD: number;
    try {
      const z = this.solveCov(cov, centered);
      mahalanobisD = Math.sqrt(Math.max(0, centered.reduce((s, ci, i) => s + ci * z[i], 0)));
    } catch (e) {
      log.warn('Failed to invert covariance for anomaly score, using approximate');
      mahalanobisD = Math.sqrt(centered.reduce((s, v) => s + v * v, 0));
    }

    // χ² CDF approximation to get p-value
    const dSquared = mahalanobisD * mahalanobisD;
    const pValue = 1 - this.chi2Cdf(dSquared, N);

    // Driving variables: contribution of each variable to d²
    let contribution: number[];
    try {
      const z = this.solveCov(cov, centered);
      contribution = centered.map((ci, i) => ci * z[i]);
    } catch {
      contribution = centered.map(v => v * v / N);
    }

    // Normalize contributions to sum to d² (which is dSquared ≈ sum of contrib)
    const sumContrib = contribution.reduce((a, b) => a + b, 0);
    const normalizedContrib = sumContrib > 0
      ? contribution.map(c => c / sumContrib * dSquared)
      : new Array(N).fill(dSquared / N);

    // Top driving variables
    const contribByName: Record<string, number> = {};
    varOrder.forEach((v, i) => { contribByName[v] = normalizedContrib[i]; });

    const sorted = varOrder
      .map((v, i) => ({ var: v, contrib: Math.abs(normalizedContrib[i]) }))
      .sort((a, b) => b.contrib - a.contrib);

    const topDriving = sorted.slice(0, 5).map(x => x.var);
    const isAnomaly = pValue < thresholdP;

    return {
      mahalanobisD,
      pValue,
      drivingVars: topDriving,
      drivingContributions: contribByName,
      isAnomaly,
      threshold: thresholdP,
      nVariables: N,
    };
  }

  /**
   * Generate a stress scenario from factor shock magnitudes.
   *
   * x_stress = μ + Σ · B · (k · e_factor)
   * where e_factor has k-σ shock on specified factors and 0 elsewhere.
   *
   * Simplified: x_stress_i = μ_i + Σ_k loading_ik · k_sigma_k · σ_k
   *
   * @param factorShocks - Factor shocks keyed by factor ID (e.g., { F1: -2.0, F3: -1.5 })
   * @param loadingsByName - Factor loadings: { variableId: { factorId: loading, ... }, ... }
   * @param baseMean - Base mean values: { variableId: mean }
   * @param factorVariances - Factor variances: { factorId: variance }
   * @returns Variable shocks (deviation from base mean)
   */
  generateStressScenario(
    factorShocks: Record<string, number>,
    loadingsByName: Record<string, Record<string, number>>,
    baseMean: Record<string, number>,
    factorVariances?: Record<string, number>,
  ): StressScenario {
    const variableShocks: Record<string, number> = {};
    const varIds = Object.keys(loadingsByName);

    for (const varId of varIds) {
      let totalShock = 0;
      const loadings = loadingsByName[varId] ?? {};

      for (const [factorId, kSigma] of Object.entries(factorShocks)) {
        const loading = loadings[factorId] ?? 0;
        // Scale shock by factor variance
        const fv = factorVariances?.[factorId] ?? 1;
        const factorSd = Math.sqrt(Math.max(0.01, fv));
        totalShock += loading * kSigma * factorSd;
      }

      variableShocks[varId] = totalShock;
    }

    const factorStr = Object.entries(factorShocks)
      .map(([f, k]) => `${f}@${k > 0 ? '+' : ''}${k}σ`)
      .join(', ');

    return {
      name: `Factor stress: ${factorStr}`,
      variableShocks,
      factorDescription: factorStr,
      kSigma: Object.values(factorShocks).reduce((max, v) => Math.max(Math.abs(v), max), 0),
    };
  }

  /**
   * Generate stress scenario along a principal component direction.
   *
   * x_stress = μ + k · √(λ_v) · v
   *
   * @param factorIndex - Which eigenvector to use (0 = first PC = largest variance)
   * @param kSigma - How many sigma to shock (2 or 3 for stress)
   * @param eigenvalues - Array of eigenvalues (ascending or descending)
   * @param eigenvectors - Array of eigenvectors: each is length N (number of variables)
   * @param mean - Mean values keyed by variable ID
   * @param varOrder - Variable order matching the eigenvector dimensions
   * @returns Stress scenario with variable values
   */
  principalStress(
    factorIndex: number,
    kSigma: number,
    eigenvalues: number[],
    eigenvectors: number[][],
    mean: Record<string, number>,
    varOrder: string[],
  ): StressScenario {
    const N = varOrder.length;

    if (factorIndex >= eigenvectors.length) {
      log.warn({ factorIndex, maxIdx: eigenvectors.length - 1 }, 'Factor index out of range');
      return {
        name: 'Empty stress scenario',
        variableShocks: {},
        factorDescription: 'invalid_index',
        kSigma,
      };
    }

    const ev = eigenvectors[factorIndex];
    const lambda = eigenvalues[factorIndex] ?? 0;

    const variableShocks: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const shock = kSigma * Math.sqrt(Math.max(0, lambda)) * (ev[i] ?? 0);
      variableShocks[varOrder[i]] = shock;
    }

    const varExplained = eigenvalues.length > 0
      ? lambda / eigenvalues.reduce((a, b) => a + b, 0)
      : 0;

    return {
      name: `PC${factorIndex + 1} ±${kSigma}σ stress (${(varExplained * 100).toFixed(1)}% variance)`,
      variableShocks,
      factorDescription: `Principal component ${factorIndex + 1}`,
      kSigma,
    };
  }

  /**
   * Compute anomaly time series from sequential observations.
   *
   * @param observations - Array of { date, values } where values is a record of var→value
   * @param mean - Mean vector
   * @param cov - N×N covariance matrix
   * @param varOrder - Variable order
   * @returns Array of anomaly results sorted by date
   */
  computeAnomalyTimeSeries(
    observations: { date: string; values: Record<string, number> }[],
    mean: Record<string, number>,
    cov: number[][],
    varOrder: string[],
  ): AnomalyTimeSeries[] {
    return observations.map(obs => {
      const result = this.computeAnomalyScore(obs.values, mean, cov, varOrder);
      return {
        date: obs.date,
        mahalanobisD: result.mahalanobisD,
        pValue: result.pValue,
        isAnomaly: result.isAnomaly,
        drivingVars: result.drivingVars,
      };
    });
  }

  /**
   * Detect sustained anomalies (multi-month runs of anomaly).
   *
   * @param timeSeries - Anomaly time series
   * @param minConsecutive - Minimum consecutive months to flag (default: 3)
   * @returns List of anomaly windows
   */
  detectSustainedAnomalies(
    timeSeries: AnomalyTimeSeries[],
    minConsecutive: number = 3,
  ): { startDate: string; endDate: string; length: number; avgD: number; drivingVars: string[] }[] {
    const windows: { startDate: string; endDate: string; length: number; avgD: number; drivingVars: string[] }[] = [];

    let runStart: number | null = null;
    for (let i = 0; i < timeSeries.length; i++) {
      if (timeSeries[i].isAnomaly) {
        if (runStart === null) runStart = i;
      } else {
        if (runStart !== null && i - runStart >= minConsecutive) {
          const slice = timeSeries.slice(runStart, i);
          const avgD = slice.reduce((s, t) => s + t.mahalanobisD, 0) / slice.length;
          const drivingVars = [...new Set(slice.flatMap(t => t.drivingVars))];
          windows.push({
            startDate: timeSeries[runStart].date,
            endDate: timeSeries[i - 1].date,
            length: i - runStart,
            avgD,
            drivingVars,
          });
        }
        runStart = null;
      }
    }

    // Check trailing run
    if (runStart !== null && timeSeries.length - runStart >= minConsecutive) {
      const slice = timeSeries.slice(runStart);
      const avgD = slice.reduce((s, t) => s + t.mahalanobisD, 0) / slice.length;
      const drivingVars = [...new Set(slice.flatMap(t => t.drivingVars))];
      windows.push({
        startDate: timeSeries[runStart].date,
        endDate: timeSeries[timeSeries.length - 1].date,
        length: timeSeries.length - runStart,
        avgD,
        drivingVars,
      });
    }

    return windows;
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Solve Σ · x = b using Cholesky decomposition.
   */
  private solveCov(cov: number[][], b: number[]): number[] {
    const L = cholesky(cov);
    const y = forwardSub(L, b);
    return backSub(L, y);
  }

  /**
   * χ² CDF approximation using the Wilson-Hilferty transformation.
   *
   * For χ² with k degrees of freedom:
   *   P(χ²_k < x) ≈ Φ((x/k)^{1/3} - (1 - 2/(9k))) / √(2/(9k))
   *
   * where Φ is the standard normal CDF.
   */
  private chi2Cdf(x: number, k: number): number {
    if (x <= 0) return 0;
    if (k <= 0) return 1;

    const z = (Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
    return this.normalCdf(z);
  }

  private normalCdf(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.SQRT2));
  }

  private erf(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
}

export const stressTester = new StressTester();
export default stressTester;
