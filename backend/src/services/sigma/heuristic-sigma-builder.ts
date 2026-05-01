/**
 * Heuristic Covariance Matrix Builder
 *
 * Constructs initial Σ from factor loadings and residual variances,
 * with Ledoit-Wolf-like shrinkage toward a structured target.
 *
 * The construction:
 *   Σ = B · Σ_F · Bᵀ + Ψ
 *
 * Where:
 *   B = factor loadings matrix (variables × factors)
 *   Σ_F = factor covariance matrix (6 × 6, diagonal ≈ 1.0 with small off-diagonals)
 *   Ψ = diag(σ²_idio) — residual variance not explained by factors
 *
 * Per-regime matrices with different factor variances.
 *
 * Phase A uses this heuristic Σ. Phase C replaces it with data-driven
 * empirical Σ. The API interface is the same — swap the provider.
 */

import { SIGMA_VARIABLES, VARIABLE_COUNT, getFactorIds } from './sigma-variable-registry';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CovarianceMatrix {
  /** Variable IDs in order (rows/columns align) */
  variableOrder: string[];
  /** n×n covariance matrix as flat array (row-major) */
  covFlat: number[];
  /** n-length mean vector */
  meanVector: number[];
  /** Precomputed inverse (also row-major flat) */
  invCovFlat: number[];
  /** Precomputed for fast Mahalanobis: L⁻¹ where Σ = LLᵀ */
  cholFactorFlat: number[];
  /** Metadata */
  regime: string;
  constructionMethod: 'heuristic' | 'empirical' | 'macro_anchored';
  shrinkageIntensity: number;
  factorCount: number;
  refDate: string;
}

export type RegimeLabel = 'expansion' | 'late_cycle' | 'contraction';

interface RegimeConfig {
  /** Factor variances: how much each factor wiggles in this regime */
  factorVariance: number[];
  /** Factor covariances (upper triangle, only F1-F2, F1-F3, etc.) */
  factorCovariances: [number, number, number][]; // [i, j, value]
  /** Idiosyncratic variance multiplier (1.0 = base) */
  idioVarianceScale: number;
  /** Underwriting variable means shift (additive, in natural units) */
  meanShift: Record<string, number>;
}

// ─── Factor Covariance Matrix ────────────────────────────────────────────────

const BASE_FACTOR_COV: number[][] = (() => {
  const K = 6;
  const C = Array.from({ length: K }, () => new Array(K).fill(0));
  for (let i = 0; i < K; i++) C[i][i] = 1.0;

  // Cross-factor correlations (small but non-zero)
  // F1 (rates) × F6 (sentiment): when rates spike, VIX tends up
  C[0][5] = C[5][0] = 0.25;
  // F1 × F5 (supply): higher rates dampen supply
  C[0][4] = C[4][0] = -0.15;
  // F2 (employment) × F3 (migration): employment drives migration
  C[1][2] = C[2][1] = 0.30;
  // F3 × F4 (asset beta): migration trends attract capital
  C[2][3] = C[3][2] = 0.20;
  // F5 × F6: supply pressure correlates with sentiment (developers go where it's hot)
  C[4][5] = C[5][4] = 0.15;

  return C;
})();

// ─── Regime Configurations ──────────────────────────────────────────────────

const REGIME_CONFIGS: Record<RegimeLabel, RegimeConfig> = {
  expansion: {
    factorVariance: [1.0, 1.0, 1.2, 1.0, 0.8, 0.9],
    factorCovariances: [],
    idioVarianceScale: 1.0,
    meanShift: {},
  },
  late_cycle: {
    factorVariance: [1.3, 1.1, 1.0, 1.2, 1.4, 1.3],
    factorCovariances: [
      [0, 5, 0.35], // F1-F6 stronger in late cycle (rates + sentiment both spiking)
      [1, 3, 0.25], // F2-F4: employment→transaction correlation grows
    ],
    idioVarianceScale: 1.15,
    meanShift: {
      exit_cap_rate: 0.001, // caps +10bps
      entry_cap_rate: 0.001,
      debt_rate: 0.0025, // rates +25bps
      vacancy_rate: 0.002, // vacancy +0.2pp
      rent_growth: -0.005, // rent growth -50bps
      expense_growth: 0.005, // expenses +50bps
    },
  },
  contraction: {
    factorVariance: [2.0, 1.8, 1.2, 1.5, 1.0, 2.0],
    factorCovariances: [
      [0, 1, -0.30], // F1-F2 negative: rates spike with unemployment (stagflation risk)
      [0, 5, 0.50], // F1-F6 strong: flight to quality
      [1, 2, 0.50], // F2-F3: employment crash drives migration
      [3, 4, 0.20], // Supply + transaction both collapse
    ],
    idioVarianceScale: 1.5,
    meanShift: {
      exit_cap_rate: 0.005, // +50bps
      entry_cap_rate: 0.004, // +40bps
      debt_rate: 0.005, // +50bps
      vacancy_rate: 0.01, // +1pp
      rent_growth: -0.02, // -200bps
      expense_growth: 0.01, // +100bps
      employment_growth_yoy: -2.0, // employment -2pp
      occupancy_rate: -2.0, // occupancy -2pp
      supply_pressure_ratio: 0.5, // supply pressure rises (demand drops faster than supply)
    },
  },
};

// ─── Σ Construction ─────────────────────────────────────────────────────────

/**
 * Build a heuristic covariance matrix for the given regime.
 */
export function buildHeuristicSigma(regime: RegimeLabel = 'expansion'): CovarianceMatrix {
  const config = REGIME_CONFIGS[regime];
  const n = VARIABLE_COUNT;
  const variables = Object.values(SIGMA_VARIABLES);
  const varOrder = variables.map(v => v.id);
  const factorIds = getFactorIds();
  const K = factorIds.length;

  // 1. Build B matrix (n × K) — loadings for each variable
  const B: number[][] = variables.map(v => {
    return factorIds.map(f => v.factorLoadings[f] ?? 0);
  });

  // 2. Build Σ_F (K × K) — factor covariance with regime scaling
  // Start with base, apply regime factor variances and extra covariances
  const Σ_F: number[][] = Array.from({ length: K }, () => new Array(K).fill(0));
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      Σ_F[i][j] = BASE_FACTOR_COV[i][j] * Math.sqrt(config.factorVariance[i] * config.factorVariance[j]);
    }
  }
  // Apply regime-specific extra covariances
  for (const [i, j, val] of config.factorCovariances) {
    Σ_F[i][j] = val;
    Σ_F[j][i] = val;
  }

  // 3. Compute B · Σ_F · Bᵀ
  const BΣ: number[][] = matMul(B, Σ_F); // n × K
  const BΣB: number[][] = matMul(BΣ, transpose(B)); // n × n

  // 4. Add residual variance Ψ = diag(σ²_idio × scale)
  // Idiosyncratic variance = total variance - factor-explained variance
  const variance: number[] = variables.map(v => Math.pow(v.annualStdDev, 2));

  const Σ: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Σ[i][j] = BΣB[i][j];
    }
    // Shrink diagonal toward target (heuristic: regress toward mean variance)
    const targetVar = median(variance);
    const shrunkVar = 0.8 * variance[i] + 0.2 * targetVar;
    Σ[i][i] += shrunkVar * config.idioVarianceScale;
  }

  // 5. Enforce positive definiteness with near-identity regularization
  const ε = 1e-6;
  for (let i = 0; i < n; i++) {
    Σ[i][i] = Math.max(Σ[i][i], ε);
  }

  // 6. Compute mean vector (with regime shift)
  const mean: number[] = variables.map(v => {
    const shift = config.meanShift[v.id] ?? 0;
    return v.default + shift;
  });

  // 7. Compute inverse and Cholesky
  const inv = invertMatrix(Σ);
  const chol = choleskyDecomposition(Σ);

  return {
    variableOrder: varOrder,
    covFlat: matrixToFlat(Σ),
    meanVector: mean,
    invCovFlat: matrixToFlat(inv),
    cholFactorFlat: matrixToFlat(chol),
    regime,
    constructionMethod: 'heuristic',
    shrinkageIntensity: 0.20,
    factorCount: K,
    refDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Get all three regime matrices at once.
 */
export function buildAllRegimeMatrices(): Record<RegimeLabel, CovarianceMatrix> {
  return {
    expansion: buildHeuristicSigma('expansion'),
    late_cycle: buildHeuristicSigma('late_cycle'),
    contraction: buildHeuristicSigma('contraction'),
  };
}

// ─── Mahalanobis Distance ────────────────────────────────────────────────────

/**
 * Compute squared Mahalanobis distance d² = (x - μ)ᵀ · Σ⁻¹ · (x - μ).
 * Slow path: invert on each call. For production, use precomputed inverse.
 */
export function mahalanobisSquared(
  x: number[],
  mu: number[],
  invCovFlat: number[],
  n: number,
): number {
  const diff = new Array(n);
  for (let i = 0; i < n; i++) diff[i] = x[i] - mu[i];

  // Compute diff × invCov → temp
  const temp = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      temp[i] += invCovFlat[i * n + j] * diff[j];
    }
  }

  // Compute diffᵀ × temp
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += diff[i] * temp[i];

  return d2;
}

/**
 * Per-variable contribution to d².
 * contribution_i = (x_i - μ_i) · [Σ⁻¹(x - μ)]_i
 */
export function mahalanobisContributions(
  x: number[],
  mu: number[],
  invCovFlat: number[],
  n: number,
): number[] {
  const diff = new Array(n);
  for (let i = 0; i < n; i++) diff[i] = x[i] - mu[i];

  // inner = Σ⁻¹ · (x - μ)
  const inner = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inner[i] += invCovFlat[i * n + j] * diff[j];
    }
  }

  const contrib = new Array(n);
  for (let i = 0; i < n; i++) contrib[i] = diff[i] * inner[i];
  return contrib;
}

/**
 * Compute aggressiveness band label from d².
 */
export function aggressivenessBand(d2: number): { band: string; d: number } {
  const d = Math.sqrt(d2);
  if (d <= 1.0) return { band: 'Realistic', d };
  if (d <= 2.0) return { band: 'Stretch', d };
  if (d <= 3.0) return { band: 'Aggressive', d };
  return { band: 'Heroic', d };
}

// ─── Linear Algebra Utilities ────────────────────────────────────────────────

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, p = B.length;
  const result: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) sum += A[i][k] * B[k][j];
      result[i][j] = sum;
    }
  }
  return result;
}

function transpose(M: number[][]): number[][] {
  const m = M.length, n = M[0].length;
  const T: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      T[j][i] = M[i][j];
  return T;
}

function matrixToFlat(M: number[][]): number[] {
  const n = M.length;
  const flat = new Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      flat[i * n + j] = M[i][j];
  return flat;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Invert n×n matrix using Gaussian elimination with partial pivoting.
 * Returns the inverse matrix.
 */
function invertMatrix(M: number[][]): number[][] {
  const n = M.length;
  const A = M.map(row => [...row]);
  const I = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = 1;
    return row;
  });

  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    if (Math.abs(A[pivot][col]) < 1e-15) {
      // Near-singular; add regularization
      A[col][col] += 1e-6;
      continue;
    }
    // Swap rows
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [I[col], I[pivot]] = [I[pivot], I[col]];

    const pivotVal = A[col][col];
    for (let j = 0; j < n; j++) {
      A[col][j] /= pivotVal;
      I[col][j] /= pivotVal;
    }
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      for (let j = 0; j < n; j++) {
        A[row][j] -= factor * A[col][j];
        I[row][j] -= factor * I[col][j];
      }
    }
  }
  return I;
}

/**
 * Cholesky decomposition L where Σ = L · Lᵀ.
 * L is lower triangular.
 */
function choleskyDecomposition(M: number[][]): number[][] {
  const n = M.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];

      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(M[i][i] - sum, 1e-10));
      } else {
        L[i][j] = (M[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}
