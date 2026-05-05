/**
 * Conditional Sampler — M36-D
 *
 * Multivariate Student-t and Gaussian sampling, conditional forecasting,
 * and confidence interval computation for the M36 Joint Distribution Engine.
 *
 * Implements:
 *   - Conditional Gaussian: μ_cond = μ_u + Σ_uo · Σ_oo⁻¹ · (x_o - μ_o)
 *   - Multivariate t-distribution sampling (df=5)
 *   - CI computation with t-distribution and effective sample size correction
 *
 * Core linear algebra: Cholesky decomposition for covariance inversion
 * and sampling.
 */

import type { Logger } from 'pino';
import { createLogger } from '../utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConditionalResult {
  conditionalMean: Record<string, number>;
  conditionalCov: number[][];
  targetVars: string[];
  nObserved: number;
}

export interface ConfidenceIntervalResult {
  lower: number;
  upper: number;
  mean: number;
  tScore: number;
  level: number;
  nEffective: number;
}

// ─── Logger ─────────────────────────────────────────────────────────────────

const log: Logger = createLogger('conditional-sampler');

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

function matSub(a: number[][], b: number[][]): number[][] {
  return a.map((r, i) => r.map((v, j) => v - b[i][j]));
}

function matCopy(m: number[][]): number[][] {
  return m.map(r => [...r]);
}

/**
 * Cholesky decomposition: A = L · Lᵀ
 * A must be symmetric positive-definite.
 */
function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;

      if (j === i) {
        // Diagonal
        for (let k = 0; k < j; k++) sum += L[j][k] * L[j][k];
        const val = A[j][j] - sum;
        if (val <= 0) {
          log.warn({ val, i: j }, 'Cholesky: non-positive diagonal, adding jitter');
          L[j][j] = Math.sqrt(Math.max(1e-10, val));
        } else {
          L[j][j] = Math.sqrt(val);
        }
      } else {
        // Off-diagonal
        for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
        if (L[j][j] === 0) {
          L[i][j] = 0;
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }
  }

  return L;
}

/**
 * Forward substitution: solve L · y = b (L is lower triangular)
 */
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

/**
 * Back substitution: solve Lᵀ · x = y (L is lower triangular)
 */
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
 * Compute Σ⁻¹ · v using Cholesky decomposition.
 * Given A = L·Lᵀ, solve A·x = v → L·(Lᵀ·x) = v
 * 1. Solve L·y = v (forward sub) → y
 * 2. Solve Lᵀ·x = y (back sub) → x
 */
function solveLinear(A: number[][], v: number[]): number[] {
  const L = cholesky(A);
  const y = forwardSub(L, v);
  return backSub(L, y);
}

/**
 * Invert a symmetric positive-definite matrix via Cholesky.
 */
function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  const L = cholesky(A);

  // Solve A · A_inv = I column by column
  const inv: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let col = 0; col < n; col++) {
    const e = new Array(n).fill(0);
    e[col] = 1;
    const y = forwardSub(L, e);
    const x = backSub(L, y);
    for (let row = 0; row < n; row++) inv[row][col] = x[row];
  }

  return inv;
}

/**
 * Generate standard normal random variates using Box-Muller transform.
 */
function randn(n: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.random();
    const u2 = Math.random();
    if (u1 <= 0) { result.push(0); if (i + 1 < n) result.push(0); continue; }
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    result.push(r * Math.cos(theta));
    if (i + 1 < n) result.push(r * Math.sin(theta));
  }
  return result.slice(0, n);
}

/**
 * Generate χ² random variate (chi-squared with df degrees of freedom).
 * Uses Marsaglia's method for integer df.
 */
function randChiSq(df: number): number {
  const z = randn(Math.floor(df));
  return z.reduce((s, v) => s + v * v, 0);
}

// ─── Class ──────────────────────────────────────────────────────────────────

export class ConditionalSampler {
  /**
   * Sample from a multivariate Student-t distribution.
   *
   * Algorithm: x = μ + L · z / √(u / df)
   *   where L = cholesky(Σ), z ~ N(0, I), u ~ χ²(df)
   *
   * @param nSamples - Number of samples to generate
   * @param mean - Mean vector (length N)
   * @param covMatrix - N×N covariance matrix
   * @param df - Degrees of freedom (default: 5)
   * @returns Array of samples (nSamples × N)
   */
  sample(
    nSamples: number,
    mean: number[],
    covMatrix: number[][],
    df: number = 5,
  ): number[][] {
    const n = mean.length;
    const L = cholesky(covMatrix);
    const samples: number[][] = [];

    for (let s = 0; s < nSamples; s++) {
      // z ~ N(0, I)
      const z = randn(n);

      // Compute y = L · z
      const y = new Array(n).fill(0);
      for (let i = 0; i < n; i++)
        for (let k = 0; k <= i; k++)
          y[i] += L[i][k] * z[k];

      // u ~ χ²(df)
      const u = randChiSq(df);

      // t-sample = μ + y / √(u / df)
      const scale = u > 0 ? Math.sqrt(u / df) : 1;
      const sample = y.map((v, i) => mean[i] + v / scale);
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Compute conditional mean and covariance given observed variables.
   *
   * Partition variables into observed (O) and unobserved (U).
   * Given x_O observed:
   *   μ_u|o = μ_u + Σ_uo · Σ_oo⁻¹ · (x_o - μ_o)
   *   Σ_u|o = Σ_uu - Σ_uo · Σ_oo⁻¹ · Σ_ou
   *
   * @param observed - Map of observed variable IDs to their values
   * @param targetVars - Array of target (unobserved) variable IDs
   * @param mean - Full mean vector keyed by variable ID
   * @param cov - Full covariance matrix (N×N) with variable ordering documented separately
   * @param varOrder - Order of variables in the covariance matrix
   * @returns Conditional mean (keyed by targetVar) and conditional covariance matrix
   */
  condition(
    observed: Record<string, number>,
    targetVars: string[],
    mean: Record<string, number>,
    cov: number[][],
    varOrder: string[],
  ): ConditionalResult {
    const obsKeys = Object.keys(observed);
    const targetSet = new Set(targetVars);

    // Build index maps
    const varIndex: Record<string, number> = {};
    for (let i = 0; i < varOrder.length; i++) varIndex[varOrder[i]] = i;

    // Observed indices
    const oIdx = obsKeys.map(k => varIndex[k]).filter(i => i !== undefined);
    // Target indices
    const tIdx = targetVars.map(k => varIndex[k]).filter(i => i !== undefined);
    // All involved variables
    const allIdx = [...new Set([...oIdx, ...tIdx])].sort((a, b) => a - b);
    const nAll = allIdx.length;
    const nObs = oIdx.length;
    const nTarget = tIdx.length;

    // Extract sub-matrices
    // Map: global_index → local_index
    const localMap: Record<number, number> = {};
    allIdx.forEach((gi, li) => { localMap[gi] = li; });

    // Build the full sub-matrix (all involved variables)
    const subCov: number[][] = Array.from({ length: nAll }, (_, i) =>
      Array.from({ length: nAll }, (_, j) => cov[allIdx[i]][allIdx[j]])
    );

    // Extract Σ_oo, Σ_tt, Σ_to (observed block, target block, cross)
    const oLocal = oIdx.map(i => localMap[i]);
    const tLocal = tIdx.map(i => localMap[i]);

    const S_oo: number[][] = oLocal.map(i => oLocal.map(j => subCov[i][j]));
    const S_tt: number[][] = tLocal.map(i => tLocal.map(j => subCov[i][j]));
    const S_to: number[][] = tLocal.map(i => oLocal.map(j => subCov[i][j]));
    const S_ot = matTranspose(S_to);

    // Compute Σ_oo⁻¹
    const S_oo_inv = invertMatrix(S_oo);

    // Compute conditional mean: μ_t + Σ_to · Σ_oo⁻¹ · (x_o - μ_o)
    const x_o = oIdx.map(i => observed[varOrder[i]] ?? 0);
    const μ_o = oIdx.map(i => mean[varOrder[i]] ?? 0);
    const μ_t = tIdx.map(i => mean[varOrder[i]] ?? 0);

    const diff = x_o.map((v, i) => v - μ_o[i]);
    const S_to_inv = matMul(S_to, S_oo_inv); // Σ_to · Σ_oo⁻¹
    const adj = matMul(S_to_inv, diff.map(v => [v])); // (nTarget × 1)

    const condMean: number[] = μ_t.map((v, i) => v + (adj[i]?.[0] ?? 0));

    // Compute conditional covariance: Σ_tt - Σ_to · Σ_oo⁻¹ · Σ_ot
    const condCov = matSub(S_tt, matMul(S_to_inv, S_ot));

    // Build output
    const condMeanMap: Record<string, number> = {};
    targetVars.forEach((v, i) => { condMeanMap[v] = condMean[i] ?? 0; });

    // Re-index conditional cov back to targetVar order
    const fullCondCov: number[][] = Array.from({ length: nTarget }, (_, i) =>
      Array.from({ length: nTarget }, (_, j) => condCov[i][j] ?? 0)
    );

    return {
      conditionalMean: condMeanMap,
      conditionalCov: fullCondCov,
      targetVars,
      nObserved: nObs,
    };
  }

  /**
   * Compute confidence interval from mean and covariance.
   *
   * Uses t-distribution with effective sample size for degrees of freedom.
   * Formula: CI = mean ± t_(n_eff - 1, α/2) · √(σ²)
   *
   * @param mean - Mean value
   * @param variance - Variance estimate
   * @param level - Confidence level (default: 0.80 for 80% CI)
   * @param nEffective - Effective sample size (for t-distribution df). Default: ∞ (normal).
   */
  confidenceInterval(
    mean: number[],
    cov: number[][],
    level: number = 0.80,
    nEffective?: number,
  ): ConfidenceIntervalResult[] {
    const n = mean.length;
    const variances = cov.map((row, i) => Math.max(0, row[i]));

    // t-critical value approximation
    const df = nEffective ? Math.max(1, nEffective - 1) : 1e6;

    // Student-t quantile approximation (Abramowitz & Stegun)
    // For standard normal: z_p = sqrt(2) * erfinv(2p-1)
    // For t: adjust by (1 + 1/(4·df))·z_p for large df
    const alpha = 1 - level;
    const p = 1 - alpha / 2; // two-tailed

    // Normal quantile (rational approximation, Acklam)
    const z_p = this.normalQuantile(p);

    // t-distribution adjustment (Hill & Davis)
    const t_adj = z_p + (z_p * z_p * z_p + z_p) / (4 * df);
    const t_score = df >= 1e6 ? z_p : t_adj;

    return variances.map((var_, i) => {
      const sem = Math.sqrt(var_);
      const lower = mean[i] - t_score * sem;
      const upper = mean[i] + t_score * sem;
      return {
        lower,
        upper,
        mean: mean[i],
        tScore: t_score,
        level,
        nEffective: nEffective ?? 1e6,
      };
    });
  }

  /**
   * Standard normal quantile (inverse CDF).
   * Rational approximation from Acklam (2003).
   */
  private normalQuantile(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

    let x: number;
    const plow = 0.02425;
    const phigh = 1 - plow;

    if (p < plow) {
      // Rational approximation for lower region
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= phigh) {
      // Central region
      const q = p - 0.5;
      const r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      // Upper region
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    // Polynomial refinement
    const e = { x: x - (this.normalCdf(x) - p) / this.normalPdf(x) };
    return e.x;
  }

  private normalCdf(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.SQRT2));
  }

  private erf(x: number): number {
    // Horner approximation for the error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  private normalPdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }
}

export const conditionalSampler = new ConditionalSampler();
export default conditionalSampler;
