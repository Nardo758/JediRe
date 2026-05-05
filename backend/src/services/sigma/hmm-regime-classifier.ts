/**
 * HMM Regime Classifier — M36-B
 *
 * Three-state Hidden Markov Model for real estate market regime classification.
 * States: Expansion, Late-Cycle, Contraction
 *
 * Observable indicators (5):
 *   yield_curve_slope — 10Y-3M Treasury spread (bps)
 *   employment_momentum — 3-month change in unemployment rate (bps)
 *   transaction_volume_yoy — YoY change in multifamily transaction volume (%)
 *   cap_rate_direction — YoY direction of cap rates (+1 compressing, -1 expanding)
 *   credit_spread_index — IG or HY spread relative to Treasuries (bps)
 *
 * Estimation: Baum-Welch (forward-backward) on observation sequences.
 * Inference: forward algorithm for posterior regime probabilities.
 */

import type { Logger } from 'pino';
import { createLogger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegimeObservation {
  date: Date;
  yield_curve_slope: number;       // bps (10Y-3M)
  employment_momentum: number;     // bps (3mo Δ unemployment)
  transaction_volume_yoy: number;  // % YoY
  cap_rate_direction: number;      // +1 = compressing, -1 = expanding
  credit_spread_index: number;     // bps
}

export interface RegimeResult {
  regime: string;
  probabilities: Record<string, number>;
  confidence: number;
  indicators: Record<string, number>;
}

export interface RegimeTransition {
  from: string;
  to: string;
  probability: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_NAMES = ['Expansion', 'Late-Cycle', 'Contraction'] as const;
const N_STATES = 3;

// Initial transition matrix (seeded from NBER cycle dating)
// Rows: from state, Cols: to state [Expansion, Late-Cycle, Contraction]
const DEFAULT_TRANSITION: number[][] = [
  [0.92, 0.07, 0.01],  // Expansion → (stay Expansion, slip to Late-Cycle, jump to Contraction)
  [0.05, 0.88, 0.07],  // Late-Cycle → (recover to Expansion, stay Late-Cycle, fall to Contraction)
  [0.02, 0.08, 0.90],  // Contraction → (recover to Expansion, to Late-Cycle, stay Contraction)
];

// Initial state probabilities (stationary distribution)
const DEFAULT_PI = [0.50, 0.35, 0.15];

// Emission distribution parameters per (state, indicator) — Normal
// { mean, stddev } per indicator per state. Calibrated from 2000-2024 US RE data.
const EMISSION_PARAMS: Record<string, Record<string, { mean: number; std: number }>> = {
  Expansion: {
    yield_curve_slope:         { mean: 80,  std: 60 },
    employment_momentum:       { mean: -10, std: 20 },
    transaction_volume_yoy:    { mean: 15,  std: 20 },
    cap_rate_direction:        { mean: 1,   std: 0.5 },
    credit_spread_index:       { mean: 120, std: 50 },
  },
  'Late-Cycle': {
    yield_curve_slope:         { mean: 10,  std: 40 },
    employment_momentum:       { mean: 15,  std: 25 },
    transaction_volume_yoy:    { mean: -5,  std: 25 },
    cap_rate_direction:        { mean: 0,   std: 0.7 },
    credit_spread_index:       { mean: 200, std: 80 },
  },
  Contraction: {
    yield_curve_slope:         { mean: -40, std: 50 },
    employment_momentum:       { mean: 60,  std: 40 },
    transaction_volume_yoy:    { mean: -30, std: 30 },
    cap_rate_direction:        { mean: -1,  std: 0.5 },
    credit_spread_index:       { mean: 350, std: 120 },
  },
};

const INDICATOR_KEYS = ['yield_curve_slope', 'employment_momentum', 'transaction_volume_yoy', 'cap_rate_direction', 'credit_spread_index'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gaussianPdf(x: number, mean: number, std: number): number {
  if (std <= 0) return 1e-10;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function logGaussianPdf(x: number, mean: number, std: number): number {
  if (std <= 0) return -23.0; // ~1e-10 in log space
  const z = (x - mean) / std;
  return -Math.log(std) - 0.5 * Math.log(2 * Math.PI) - 0.5 * z * z;
}

function softmax(v: number[]): number[] {
  const max = Math.max(...v);
  const exps = v.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

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
  return m[0].map((_, i) => m.map(r => r[i]));
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('hmm-regime-classifier');

// ─── Class ───────────────────────────────────────────────────────────────────

export class HMMRegimeClassifier {
  private transition: number[][] = DEFAULT_TRANSITION.map(r => [...r]);
  private pi: number[] = [...DEFAULT_PI];
  private emission: Record<string, Record<string, { mean: number; std: number }>> = 
    JSON.parse(JSON.stringify(EMISSION_PARAMS));
  private trained = false;
  private observations: RegimeObservation[] = [];

  constructor() {}

  /**
   * Emission probability Pr(O | S_i) for a single observation.
   * Product of independent Gaussian densities per indicator.
   */
  private emissionProbability(state: string, obs: RegimeObservation): number {
    const params = this.emission[state];
    if (!params) return 1e-10;
    let logProb = 0;
    for (const key of INDICATOR_KEYS) {
      const p = params[key];
      const val = (obs as any)[key] ?? 0;
      logProb += logGaussianPdf(val, p.mean, p.std);
    }
    return Math.exp(logProb);
  }

  /**
   * Log-emission probability (avoids underflow for long sequences).
   */
  private logEmissionProbability(state: string, obs: RegimeObservation): number {
    const params = this.emission[state];
    if (!params) return -23.0;
    let lp = 0;
    for (const key of INDICATOR_KEYS) {
      const p = params[key];
      const val = (obs as any)[key] ?? 0;
      lp += logGaussianPdf(val, p.mean, p.std);
    }
    return lp;
  }

  /**
   * Forward algorithm: α_t(i) = P(O_1..O_t, S_t=i | λ)
   * Returns log-probabilities to avoid underflow.
   */
  private forward(obs: RegimeObservation[]): number[][] {
    const T = obs.length;
    const alpha: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(-Infinity));

    // Initialization
    for (let i = 0; i < N_STATES; i++) {
      alpha[0][i] = Math.log(this.pi[i]) + this.logEmissionProbability(STATE_NAMES[i], obs[0]);
    }

    // Recursion
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < N_STATES; j++) {
        let maxVal = -Infinity;
        for (let i = 0; i < N_STATES; i++) {
          const val = alpha[t - 1][i] + Math.log(this.transition[i][j]);
          if (val > maxVal) maxVal = val;
        }
        alpha[t][j] = maxVal + this.logEmissionProbability(STATE_NAMES[j], obs[t]);
      }
    }

    return alpha;
  }

  /**
   * Backward algorithm: β_t(i) = P(O_{t+1}..O_T | S_t=i, λ)
   */
  private backward(obs: RegimeObservation[]): number[][] {
    const T = obs.length;
    const beta: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(-Infinity));

    // Initialization: β_T(i) = 1 (log = 0)
    for (let i = 0; i < N_STATES; i++) beta[T - 1][i] = 0;

    // Recursion
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < N_STATES; i++) {
        let maxVal = -Infinity;
        for (let j = 0; j < N_STATES; j++) {
          const val = Math.log(this.transition[i][j])
            + this.logEmissionProbability(STATE_NAMES[j], obs[t + 1])
            + beta[t + 1][j];
          if (val > maxVal) maxVal = val;
        }
        beta[t][i] = maxVal;
      }
    }

    return beta;
  }

  /**
   * Compute posterior state probabilities γ_t(i) = P(S_t = i | O, λ)
   * using scaled forward-backward.
   */
  private posteriorProbs(obs: RegimeObservation[], alpha: number[][], beta: number[][]): number[][] {
    const T = obs.length;
    const gamma: number[][] = Array.from({ length: T }, () => new Array(N_STATES).fill(0));

    for (let t = 0; t < T; t++) {
      let maxVal = -Infinity;
      for (let i = 0; i < N_STATES; i++) {
        const val = alpha[t][i] + beta[t][i];
        gamma[t][i] = val;
        if (val > maxVal) maxVal = val;
      }
      // Normalize (subtract max, exponentiate)
      let sum = 0;
      for (let i = 0; i < N_STATES; i++) {
        gamma[t][i] = Math.exp(gamma[t][i] - maxVal);
        sum += gamma[t][i];
      }
      if (sum > 0) {
        for (let i = 0; i < N_STATES; i++) gamma[t][i] /= sum;
      }
    }

    return gamma;
  }

  /**
   * Compute ξ_t(i,j) = P(S_t=i, S_{t+1}=j | O, λ)
   */
  private transitionPosteriors(obs: RegimeObservation[], alpha: number[][], beta: number[][]): number[][][] {
    const T = obs.length;
    const xi: number[][][] = Array.from({ length: T - 1 }, () =>
      Array.from({ length: N_STATES }, () => new Array(N_STATES).fill(0))
    );

    for (let t = 0; t < T - 1; t++) {
      let maxVal = -Infinity;
      for (let i = 0; i < N_STATES; i++) {
        for (let j = 0; j < N_STATES; j++) {
          const val = alpha[t][i]
            + Math.log(this.transition[i][j])
            + this.logEmissionProbability(STATE_NAMES[j], obs[t + 1])
            + beta[t + 1][j];
          if (val > maxVal) maxVal = val;
        }
      }

      let sum = 0;
      for (let i = 0; i < N_STATES; i++) {
        for (let j = 0; j < N_STATES; j++) {
          const val = alpha[t][i]
            + Math.log(this.transition[i][j])
            + this.logEmissionProbability(STATE_NAMES[j], obs[t + 1])
            + beta[t + 1][j];
          xi[t][i][j] = Math.exp(val - maxVal);
          sum += xi[t][i][j];
        }
      }
      if (sum > 0) {
        for (let i = 0; i < N_STATES; i++)
          for (let j = 0; j < N_STATES; j++)
            xi[t][i][j] /= sum;
      }
    }

    return xi;
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Classify the current regime given a single set of indicators (most recent).
   * Runs forward on the observation history plus the new observation.
   */
  classify(date: Date, indicators: Record<string, number>): RegimeResult {
    const obs: RegimeObservation = {
      date,
      yield_curve_slope: indicators.yield_curve_slope ?? 0,
      employment_momentum: indicators.employment_momentum ?? 0,
      transaction_volume_yoy: indicators.transaction_volume_yoy ?? 0,
      cap_rate_direction: indicators.cap_rate_direction ?? 0,
      credit_spread_index: indicators.credit_spread_index ?? 0,
    };

    const allObs = [...this.observations, obs];
    const T = allObs.length;
    if (T === 0) {
      // No history: use prior
      const maxPi = Math.max(...this.pi);
      const bestIdx = this.pi.indexOf(maxPi);
      return {
        regime: STATE_NAMES[bestIdx],
        probabilities: { Expansion: this.pi[0], 'Late-Cycle': this.pi[1], Contraction: this.pi[2] },
        confidence: maxPi,
        indicators,
      };
    }

    const alpha = this.forward(allObs);
    const beta = this.backward(allObs);
    const gamma = this.posteriorProbs(allObs, alpha, beta);

    // Take the last time step's posterior
    const lastProbs = gamma[T - 1];
    const probs: Record<string, number> = {
      Expansion: lastProbs[0],
      'Late-Cycle': lastProbs[1],
      Contraction: lastProbs[2],
    };

    const maxProb = Math.max(...lastProbs);
    const bestIdx = lastProbs.indexOf(maxProb);
    const confidence = maxProb;

    return {
      regime: STATE_NAMES[bestIdx],
      probabilities: probs,
      confidence,
      indicators,
    };
  }

  /**
   * Batch classify a sequence of observations.
   * Returns per-date regime probabilities.
   */
  classifyBatch(observations: RegimeObservation[]): RegimeResult[] {
    const T = observations.length;
    if (T === 0) return [];

    const alpha = this.forward(observations);
    const beta = this.backward(observations);
    const gamma = this.posteriorProbs(observations, alpha, beta);

    const results: RegimeResult[] = [];
    for (let t = 0; t < T; t++) {
      const probs: Record<string, number> = {
        Expansion: gamma[t][0],
        'Late-Cycle': gamma[t][1],
        Contraction: gamma[t][2],
      };
      const maxProb = Math.max(...gamma[t]);
      const bestIdx = gamma[t].indexOf(maxProb);
      results.push({
        regime: STATE_NAMES[bestIdx],
        probabilities: probs,
        confidence: maxProb,
        indicators: {
          yield_curve_slope: observations[t].yield_curve_slope,
          employment_momentum: observations[t].employment_momentum,
          transaction_volume_yoy: observations[t].transaction_volume_yoy,
          cap_rate_direction: observations[t].cap_rate_direction,
          credit_spread_index: observations[t].credit_spread_index,
        },
      });
    }

    return results;
  }

  /**
   * Baum-Welch re-estimation: update transition matrix and emission params
   * to maximize likelihood of the observed sequence.
   */
  reestimate(observations: RegimeObservation[]): { converged: boolean; iterations: number; logLikelihood: number } {
    const maxIter = 50;
    const tol = 1e-4;
    let prevLL = -Infinity;
    let iterations = 0;

    for (let iter = 0; iter < maxIter; iter++) {
      const T = observations.length;
      const alpha = this.forward(observations);
      const beta = this.backward(observations);
      const gamma = this.posteriorProbs(observations, alpha, beta);
      const xi = this.transitionPosteriors(observations, alpha, beta);

      // Re-estimate transition matrix
      const newA: number[][] = Array.from({ length: N_STATES }, () => new Array(N_STATES).fill(0));
      for (let i = 0; i < N_STATES; i++) {
        let denom = 0;
        for (let t = 0; t < T - 1; t++) denom += gamma[t][i];
        for (let j = 0; j < N_STATES; j++) {
          let numer = 0;
          for (let t = 0; t < T - 1; t++) numer += xi[t][i][j];
          newA[i][j] = denom > 0 ? numer / denom : this.transition[i][j];
        }
      }

      // Re-estimate emission params (per-state Gaussian means and stds)
      const newEmission: Record<string, Record<string, { mean: number; std: number }>> = {};
      for (let s = 0; s < N_STATES; s++) {
        const state = STATE_NAMES[s];
        newEmission[state] = {};
        for (const key of INDICATOR_KEYS) {
          let weightedSum = 0;
          let weightedSumSq = 0;
          let totalWeight = 0;
          for (let t = 0; t < T; t++) {
            const val = (observations[t] as any)[key] ?? 0;
            weightedSum += gamma[t][s] * val;
            weightedSumSq += gamma[t][s] * val * val;
            totalWeight += gamma[t][s];
          }
          const mean = totalWeight > 0 ? weightedSum / totalWeight : this.emission[state][key].mean;
          const variance = totalWeight > 0 ? (weightedSumSq / totalWeight - mean * mean) : this.emission[state][key].std ** 2;
          const std = Math.sqrt(Math.max(variance, 0.01)); // floor at 0.01
          newEmission[state][key] = { mean, std };
        }
      }

      // Re-estimate initial state distribution
      const newPi: number[] = new Array(N_STATES).fill(0);
      for (let i = 0; i < N_STATES; i++) newPi[i] = gamma[0][i];

      // Log-likelihood
      const logProb = alpha[T - 1].reduce((a, b) => {
        const maxV = Math.max(a, b);
        return maxV + Math.log(Math.exp(a - maxV) + Math.exp(b - maxV));
      }, -Infinity);

      // Update
      this.transition = newA;
      this.emission = newEmission;
      this.pi = newPi;
      iterations = iter + 1;

      // Check convergence
      if (Math.abs(logProb - prevLL) < tol && prevLL > -Infinity) {
        this.trained = true;
        this.observations = [...observations];
        return { converged: true, iterations, logLikelihood: logProb };
      }
      prevLL = logProb;
    }

    this.trained = true;
    this.observations = [...observations];
    return { converged: false, iterations, logLikelihood: prevLL };
  }

  /** Get current transition matrix */
  getTransitionMatrix(): number[][] {
    return this.transition.map(r => [...r]);
  }

  /** Get current initial state probabilities */
  getInitialProbabilities(): number[] {
    return [...this.pi];
  }

  /** Get current emission parameters */
  getEmissionParams(): Record<string, Record<string, { mean: number; std: number }>> {
    return JSON.parse(JSON.stringify(this.emission));
  }

  /** Reset to default parameters */
  reset(): void {
    this.transition = DEFAULT_TRANSITION.map(r => [...r]);
    this.pi = [...DEFAULT_PI];
    this.emission = JSON.parse(JSON.stringify(EMISSION_PARAMS));
    this.trained = false;
    this.observations = [];
  }
}

export const hmmRegimeClassifier = new HMMRegimeClassifier();
export default hmmRegimeClassifier;
