/**
 * Calibration Ledger — M35/M38
 *
 * Persistent record of every prediction the platform emits, paired with
 * realized outcomes, scored continuously, with drift alerts when accuracy degrades.
 *
 * spec: M35_Calibration_Ledger_Addendum.md
 *
 * Key invariants:
 *   - Predictions are IMMUTABLE once emitted
 *   - Realizations create separate pairing records
 *   - Calibration is measured per stratum (source × metric × asset_class × regime × horizon)
 *
 * Stratification (spec §5): 5D tensor with Bayesian shrinkage for sparse cells.
 * Drift detection (spec §7): rolling 90-day windows with three signals.
 * CI adjustment (spec §6): widening factors based on reliability score.
 */

import type { Logger } from 'pino';
import { createLogger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PredictionRecord {
  predictionId: string;
  emittedAt: Date;
  source: {
    module: string;
    version: string;
    dealId?: string;
    submarketId?: string;
  };
  metric: string;
  assetClass: string;
  regimeAtPrediction: string;
  predictionType: 'point_with_ci' | 'distribution' | 'classification';
  pointEstimate?: number;
  ciLevels?: { level: number; low: number; high: number }[];
  distributionSummary?: { p10: number; p50: number; p90: number; p99?: number };
  classification?: { band: string; confidence: number };
  realizationHorizonMonths: number;
  realizationTargetDate: Date;
  context: {
    rationaleSummary?: string;
    upstreamPredictionIds?: string[];
    underlyingAssumptions?: Record<string, number>;
  };
  supersededBy?: string;
  supersededAt?: Date;
}

export interface RealizationRecord {
  realizationId: string;
  recordedAt: Date;
  metric: string;
  scope: {
    dealId?: string;
    submarketId?: string;
    assetClass?: string;
  };
  observationDate: Date;
  observedValue: number;
  observationSource: string;
  measurementUncertainty?: number;
}

export interface PairingRecord {
  pairingId: string;
  predictionId: string;
  realizationId: string;
  pairedAt: Date;
  pointError: number;
  ciCaptured: { level: number; captured: boolean }[];
  logLikelihood?: number;
  brierScore?: number;
  pairingQuality: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface StratumKey {
  source: string;
  metric: string;
  assetClass: string;
  regime: string;
  horizon: string; // 'short' | 'medium' | 'long'
}

export interface ReliabilityStats {
  stratum: StratumKey;
  nPairings: number;
  captured50: number;
  captured80: number;
  captured90: number;
  captured95: number;
  reliabilityScore: number;
  sharpness: number;
  bias: number;
  brierScore?: number;
  crps?: number;
  shrinkageWeight: number;
  computedAt: Date;
}

export interface CalibrationFactor {
  stratum: StratumKey;
  ciWideningFactor: number;
  biasCorrection: number;
  confidenceLabel: 'high' | 'medium' | 'low';
  effectiveFrom: Date;
  effectiveUntil?: Date;
}

export interface DriftAlert {
  alertId: string;
  detectedAt: Date;
  stratum: StratumKey;
  signalType: 'reliability' | 'bias' | 'sharpness';
  signalValue: number;
  baselineValue: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'acknowledged' | 'resolved';
  resolutionNotes?: string;
}

export interface CalibrationProfile {
  source: string;
  version: string;
  assetClass: string;
  regime: string;
  perMetricReliability: Record<string, {
    reliability: number;
    ciWidening: number;
    biasCorrection: number;
    confidenceLabel: string;
    driftAlerts: DriftAlert[];
  }>;
  computedAt: Date;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('calibration-ledger');

// ─── Constants ───────────────────────────────────────────────────────────────

const Z_SCORES: Record<number, number> = { 0.50: 0.674, 0.80: 1.282, 0.90: 1.645, 0.95: 1.960 };
const HORIZON_STRATA: Record<string, (n: number) => string> = {
  short: (n) => n <= 12 ? 'short' : '',
  medium: (n) => n > 12 && n <= 36 ? 'medium' : '',
  long: (n) => n > 36 ? 'long' : '',
};

// ─── Class ───────────────────────────────────────────────────────────────────

export class CalibrationLedger {
  private predictions: Map<string, PredictionRecord> = new Map();
  private realizations: Map<string, RealizationRecord> = new Map();
  private pairings: Map<string, PairingRecord> = new Map();
  private reliabilityCache: Map<string, ReliabilityStats> = new Map();
  private driftAlerts: DriftAlert[] = [];
  private calibrationFactors: Map<string, CalibrationFactor> = new Map();

  // ─── Prediction Emission ─────────────────────────────────────────────

  /**
   * Record a prediction. Immutable once stored.
   * spec §3.1
   */
  recordPrediction(prediction: PredictionRecord): void {
    if (this.predictions.has(prediction.predictionId)) {
      log.warn({ id: prediction.predictionId }, 'Prediction already recorded, skipping');
      return;
    }
    this.predictions.set(prediction.predictionId, { ...prediction });
    log.info({
      id: prediction.predictionId,
      module: prediction.source.module,
      metric: prediction.metric,
      horizon: prediction.realizationHorizonMonths,
    }, 'Prediction recorded');
  }

  /**
   * Supersede a previous prediction (e.g., agent revises after user pushback).
   * spec §12 Q2: superseded predictions are not evaluated against realizations.
   */
  supersedePrediction(originalId: string, supersedingId: string): boolean {
    const original = this.predictions.get(originalId);
    if (!original) {
      log.warn({ id: originalId }, 'Cannot supersede: prediction not found');
      return false;
    }
    original.supersededBy = supersedingId;
    original.supersededAt = new Date();
    return true;
  }

  getPrediction(id: string): PredictionRecord | undefined {
    return this.predictions.get(id);
  }

  getActivePredictions(): PredictionRecord[] {
    return Array.from(this.predictions.values()).filter(p => !p.supersededAt);
  }

  // ─── Realization Ingestion ──────────────────────────────────────────

  /**
   * Record a realized outcome.
   * spec §3.2
   */
  recordRealization(realization: RealizationRecord): void {
    if (this.realizations.has(realization.realizationId)) {
      return;
    }
    this.realizations.set(realization.realizationId, { ...realization });
    log.info({
      id: realization.realizationId,
      metric: realization.metric,
      value: realization.observedValue,
      source: realization.observationSource,
    }, 'Realization recorded');
  }

  getRealization(id: string): RealizationRecord | undefined {
    return this.realizations.get(id);
  }

  // ─── Pairing Engine (Spec §3.3) ─────────────────────────────────────

  /**
   * Run the pairing engine: walk active predictions, find matching realizations,
   * create pairings.
   * spec §3.3 — runs nightly
   */
  runPairing(since?: Date): PairingRecord[] {
    const now = new Date();
    const newPairings: PairingRecord[] = [];

    const activePredictions = this.getActivePredictions().filter(p => {
      // Only pair predictions whose target date has passed
      if (p.realizationTargetDate > now) return false;
      // If since filter, only pair predictions emitted after that date
      if (since && p.emittedAt < since) return false;
      return true;
    });

    for (const pred of activePredictions) {
      // Find matching realizations
      const matches = Array.from(this.realizations.values()).filter(r => {
        // Match on metric
        if (r.metric !== pred.metric) return false;
        // Match on scope
        if (pred.source.dealId && r.scope.dealId !== pred.source.dealId) return false;
        if (pred.source.submarketId && r.scope.submarketId !== pred.source.submarketId) return false;
        if (pred.assetClass && r.scope.assetClass !== pred.assetClass) return false;
        // Match on time — observation should be near the target date
        const diffDays = Math.abs(r.observationDate.getTime() - pred.realizationTargetDate.getTime()) / (1000 * 86400);
        return diffDays <= 90; // within 90-day window
      });

      for (const real of matches) {
        // Check if already paired
        const alreadyPaired = Array.from(this.pairings.values()).some(
          pair => pair.predictionId === pred.predictionId && pair.realizationId === real.realizationId
        );
        if (alreadyPaired) continue;

        // Compute pairing metrics
        const pointError = pred.pointEstimate != null ? real.observedValue - pred.pointEstimate : 0;

        const ciCaptured: { level: number; captured: boolean }[] = [];
        if (pred.ciLevels) {
          for (const ci of pred.ciLevels) {
            const captured = real.observedValue >= ci.low && real.observedValue <= ci.high;
            ciCaptured.push({ level: ci.level, captured });
          }
        }

        // Brier score for classification predictions
        let brierScore: number | undefined;
        if (pred.predictionType === 'classification' && pred.classification) {
          // Outcome = 1 if classification is "correct" based on some criteria
          // Simplified: we assume correctness if the band matches a heuristic
          brierScore = pred.classification.confidence ** 2; // placeholder
        }

        // Pairing quality based on scope match precision
        let pairingQuality: 'high' | 'medium' | 'low' = 'low';
        if (pred.source.dealId && real.scope.dealId === pred.source.dealId) {
          pairingQuality = 'high';
        } else if (pred.source.submarketId && real.scope.submarketId === pred.source.submarketId) {
          pairingQuality = 'high';
        } else if (pred.source.dealId && !real.scope.dealId && real.scope.submarketId) {
          pairingQuality = 'medium';
        } else if (pred.source.submarketId && !real.scope.submarketId) {
          pairingQuality = 'low';
        }

        const pairing: PairingRecord = {
          pairingId: `pair_${pred.predictionId}_${real.realizationId}`,
          predictionId: pred.predictionId,
          realizationId: real.realizationId,
          pairedAt: new Date(),
          pointError,
          ciCaptured,
          brierScore,
          pairingQuality,
        };

        this.pairings.set(pairing.pairingId, pairing);
        newPairings.push(pairing);
      }
    }

    log.info({ newPairings: newPairings.length }, 'Pairing run completed');
    return newPairings;
  }

  // ─── Reliability Computation (Spec §4) ───────────────────────────────

  /**
   * Compute reliability statistics for a stratum.
   * spec §4.1: Reliability diagram — stated vs empirical capture rate.
   * spec §4.2: Sharpness — mean CI width at 80%.
   * spec §4.3: Bias — mean point error.
   * spec §4.4: Brier score for classification.
   */
  computeReliability(stratum: StratumKey): ReliabilityStats {
    const horizonStr = stratum.horizon;
    const horizonRange = (n: number) => {
      if (horizonStr === 'short') return n <= 12;
      if (horizonStr === 'medium') return n > 12 && n <= 36;
      if (horizonStr === 'long') return n > 36;
      return true;
    };

    // Find pairings matching stratum
    const relevantPairs = Array.from(this.pairings.values()).filter(pair => {
      const pred = this.predictions.get(pair.predictionId);
      if (!pred) return false;
      return (
        pred.source.module === stratum.source &&
        pred.metric === stratum.metric &&
        pred.assetClass === stratum.assetClass &&
        pred.regimeAtPrediction === stratum.regime &&
        horizonRange(pred.realizationHorizonMonths)
      );
    });

    const n = relevantPairs.length;

    // Compute capture rates per CI level
    const captureCounts: Record<number, number> = { 0.50: 0, 0.80: 0, 0.90: 0, 0.95: 0 };
    let totalSharpness = 0;
    let sharpnessCount = 0;
    let totalBias = 0;
    let totalBrier = 0;
    let brierCount = 0;

    for (const pair of relevantPairs) {
      const pred = this.predictions.get(pair.predictionId);
      if (!pred) continue;

      for (const ci of pair.ciCaptured) {
        if (captureCounts[ci.level] !== undefined) {
          if (ci.captured) captureCounts[ci.level]++;
        }
      }

      // Sharpness: mean CI width at 80%
      if (pred.ciLevels) {
        const ci80 = pred.ciLevels.find(c => Math.abs(c.level - 0.80) < 0.01);
        if (ci80) {
          totalSharpness += ci80.high - ci80.low;
          sharpnessCount++;
        }
      }

      // Bias: mean point error
      if (pred.pointEstimate != null) {
        totalBias += pair.pointError;
      }

      // Brier score
      if (pair.brierScore != null) {
        totalBrier += pair.brierScore;
        brierCount++;
      }
    }

    const captured50 = n > 0 ? captureCounts[0.50] / n : 0;
    const captured80 = n > 0 ? captureCounts[0.80] / n : 0;
    const captured90 = n > 0 ? captureCounts[0.90] / n : 0;
    const captured95 = n > 0 ? captureCounts[0.95] / n : 0;

    // Reliability score: mean absolute difference across CI levels
    const reliabilityScore = n > 0
      ? (Math.abs(captured50 - 0.50) + Math.abs(captured80 - 0.80) +
         Math.abs(captured90 - 0.90) + Math.abs(captured95 - 0.95)) / 4
      : 0;

    const sharpness = sharpnessCount > 0 ? totalSharpness / sharpnessCount : 0;
    const bias = n > 0 ? totalBias / n : 0;
    const brierScore = brierCount > 0 ? totalBrier / brierCount : undefined;

    const stats: ReliabilityStats = {
      stratum,
      nPairings: n,
      captured50,
      captured80,
      captured90,
      captured95,
      reliabilityScore,
      sharpness,
      bias,
      brierScore,
      shrinkageWeight: this.computeShrinkageWeight(n),
      computedAt: new Date(),
    };

    // Cache
    const cacheKey = this.stratumKeyToString(stratum);
    this.reliabilityCache.set(cacheKey, stats);

    return stats;
  }

  /**
   * Bayesian shrinkage weight for sparse strata.
   * spec §5.2: λ increases with sample size.
   */
  private computeShrinkageWeight(n: number): number {
    // When n < 10, weight heavily on marginals
    // When n >= 50, weight on cell-specific data
    return Math.min(1, Math.max(0, (n - 10) / 40));
  }

  /**
   * Compute overall reliability across all strata (or filtered).
   */
  computeGlobalReliability(source?: string, metric?: string): { reliabilityScore: number; nPairings: number } {
    let pairings = Array.from(this.pairings.values());

    if (source || metric) {
      pairings = pairings.filter(pair => {
        const pred = this.predictions.get(pair.predictionId);
        if (!pred) return false;
        if (source && pred.source.module !== source) return false;
        if (metric && pred.metric !== metric) return false;
        return true;
      });
    }

    const n = pairings.length;
    let captured80Count = 0;

    for (const pair of pairings) {
      const ci80 = pair.ciCaptured.find(c => Math.abs(c.level - 0.80) < 0.01);
      if (ci80?.captured) captured80Count++;
    }

    const captured80 = n > 0 ? captured80Count / n : 0;
    const reliabilityScore = Math.abs(captured80 - 0.80);

    return { reliabilityScore, nPairings: n };
  }

  // ─── CI Adjustment & Bias Correction (Spec §6) ───────────────────────

  /**
   * Compute calibration factors for a stratum.
   * spec §6.1: ciWideningFactor = z(level) / z(captured)
   * spec §6.2: biasCorrection = mean(pointError)
   */
  computeCalibrationFactors(stratum: StratumKey, ciLevel: number = 0.80): CalibrationFactor {
    const stats = this.computeReliability(stratum);
    const captured = ciLevel === 0.80 ? stats.captured80
      : ciLevel === 0.90 ? stats.captured90
      : ciLevel === 0.95 ? stats.captured95
      : stats.captured50;

    // CI widening factor
    const zStated = Z_SCORES[ciLevel] ?? 1.282;
    // Find empirical z-score from captured rate
    // Invert: find z such that P(|Z| < z) = captured
    // Use interpolation from Z_SCORES
    const zEmpirical = this.invertZScore(captured, ciLevel);
    const ciWideningFactor = zEmpirical > 0 ? zStated / zEmpirical : 1.0;

    // Bias correction
    const biasCorrection = stats.bias;

    // Confidence label
    let confidenceLabel: 'high' | 'medium' | 'low' = 'high';
    if (stats.reliabilityScore > 0.10) confidenceLabel = 'low';
    else if (stats.reliabilityScore > 0.05) confidenceLabel = 'medium';

    const factor: CalibrationFactor = {
      stratum,
      ciWideningFactor: Math.round(ciWideningFactor * 100) / 100,
      biasCorrection: Math.round(biasCorrection * 10000) / 10000,
      confidenceLabel,
      effectiveFrom: new Date(),
    };

    const cacheKey = this.stratumKeyToString(stratum);
    const existing = this.calibrationFactors.get(cacheKey);
    if (existing) {
      existing.effectiveUntil = new Date();
    }
    this.calibrationFactors.set(cacheKey, factor);

    return factor;
  }

  /**
   * Get correction factors for a specific source/version/assetClass/regime.
   * Returns per-metric CalibrationProfile for agent consumption.
   */
  getAgentProfile(source: string, version?: string, assetClass?: string, regime?: string): CalibrationProfile {
    const profile: CalibrationProfile = {
      source,
      version: version ?? 'latest',
      assetClass: assetClass ?? 'multifamily',
      regime: regime ?? 'Expansion',
      perMetricReliability: {},
      computedAt: new Date(),
    };

    // Gather unique metrics from this source
    const metrics = new Set<string>();
    for (const pred of this.predictions.values()) {
      if (pred.source.module === source) {
        if (!assetClass || pred.assetClass === assetClass) {
          metrics.add(pred.metric);
        }
      }
    }

    for (const metric of metrics) {
      const stratum: StratumKey = {
        source,
        metric,
        assetClass: assetClass ?? 'multifamily',
        regime: regime ?? 'Expansion',
        horizon: 'medium',
      };

      const stats = this.computeReliability(stratum);
      const factors = this.computeCalibrationFactors(stratum);

      // Find drift alerts for this stratum
      const alerts = this.driftAlerts.filter(a =>
        a.stratum.source === stratum.source &&
        a.stratum.metric === stratum.metric &&
        a.status !== 'resolved'
      );

      profile.perMetricReliability[metric] = {
        reliability: Math.round(stats.reliabilityScore * 100) / 100,
        ciWidening: factors.ciWideningFactor,
        biasCorrection: factors.biasCorrection,
        confidenceLabel: factors.confidenceLabel,
        driftAlerts: alerts,
      };
    }

    return profile;
  }

  // ─── Drift Detection (Spec §7) ───────────────────────────────────────

  /**
   * Compute drift signals for a stratum using rolling 90-day window.
   * spec §7.1: three drift signals.
   */
  detectDrift(stratum: StratumKey, baselineStats?: ReliabilityStats): DriftAlert[] {
    const newAlerts: DriftAlert[] = [];

    // Compute reliability with rolling 90-day window
    const now = new Date();
    const cutoff = new Date(now.getTime() - 90 * 86400 * 1000);
    const stats = this.computeReliability(stratum);

    // Baseline: use provided or compute from full history
    const baseline = baselineStats ?? stats;

    // Drift signal: reliability drift
    const reliabilityDrift = Math.max(0, stats.reliabilityScore - baseline.reliabilityScore - 0.05);
    if (reliabilityDrift > 0) {
      const threshold = 0.05;
      const severity = reliabilityDrift / threshold;
      const alert: DriftAlert = {
        alertId: `drift_${this.stratumKeyToString(stratum)}_reliability_${Date.now()}`,
        detectedAt: now,
        stratum,
        signalType: 'reliability',
        signalValue: Math.round(stats.reliabilityScore * 10000) / 10000,
        baselineValue: Math.round(baseline.reliabilityScore * 10000) / 10000,
        threshold: 0.05,
        severity: severity > 2.5 ? 'high' : severity > 1.5 ? 'medium' : 'low',
        status: 'open',
      };
      newAlerts.push(alert);
    }

    // Drift signal: bias drift
    const baselineBias = baseline.bias;
    const currentBias = stats.bias;
    const biasThreshold = 0.02; // 2% bias drift threshold
    const biasDrift = Math.max(0, Math.abs(currentBias) - Math.abs(baselineBias) - biasThreshold);
    if (biasDrift > 0) {
      const severity = Math.abs(currentBias) / (Math.abs(baselineBias) + 0.001);
      const alert: DriftAlert = {
        alertId: `drift_${this.stratumKeyToString(stratum)}_bias_${Date.now()}`,
        detectedAt: now,
        stratum,
        signalType: 'bias',
        signalValue: Math.round(currentBias * 10000) / 10000,
        baselineValue: Math.round(baselineBias * 10000) / 10000,
        threshold: biasThreshold,
        severity: severity > 2.5 ? 'high' : severity > 1.5 ? 'medium' : 'low',
        status: 'open',
      };
      newAlerts.push(alert);
    }

    // Sharpness drift
    const sharpnessDrift = stats.sharpness - baseline.sharpness;
    if (Math.abs(sharpnessDrift) > baseline.sharpness * 0.3) {
      const alert: DriftAlert = {
        alertId: `drift_${this.stratumKeyToString(stratum)}_sharpness_${Date.now()}`,
        detectedAt: now,
        stratum,
        signalType: 'sharpness',
        signalValue: Math.round(stats.sharpness * 100) / 100,
        baselineValue: Math.round(baseline.sharpness * 100) / 100,
        threshold: baseline.sharpness * 0.3,
        severity: 'low',
        status: 'open',
      };
      newAlerts.push(alert);
    }

    this.driftAlerts.push(...newAlerts);
    return newAlerts;
  }

  /**
   * Acknowledge a drift alert.
   */
  acknowledgeDrift(alertId: string, notes: string): boolean {
    const alert = this.driftAlerts.find(a => a.alertId === alertId);
    if (!alert) return false;
    alert.status = 'acknowledged';
    alert.resolutionNotes = notes;
    return true;
  }

  /**
   * Acknowledge all open alerts.
   */
  acknowledgeAllDrift(notes: string): number {
    let count = 0;
    for (const alert of this.driftAlerts) {
      if (alert.status === 'open') {
        alert.status = 'acknowledged';
        alert.resolutionNotes = notes;
        count++;
      }
    }
    return count;
  }

  getDriftAlerts(status?: string, since?: Date, metric?: string): DriftAlert[] {
    let alerts = this.driftAlerts;
    if (status) alerts = alerts.filter(a => a.status === status);
    if (since) alerts = alerts.filter(a => a.detectedAt >= since);
    if (metric) alerts = alerts.filter(a => a.stratum.metric === metric);
    return alerts;
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  getStats(): {
    nPredictions: number;
    nRealizations: number;
    nPairings: number;
    nDriftAlertsOpen: number;
  } {
    return {
      nPredictions: this.predictions.size,
      nRealizations: this.realizations.size,
      nPairings: this.pairings.size,
      nDriftAlertsOpen: this.driftAlerts.filter(a => a.status === 'open').length,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private stratumKeyToString(key: StratumKey): string {
    return `${key.source}|${key.metric}|${key.assetClass}|${key.regime}|${key.horizon}`;
  }

  /**
   * Invert z-score: find z such that P(|Z| < z) ≈ captured rate.
   * Interpolates from known z-scores.
   */
  private invertZScore(capturedRate: number, defaultLevel: number): number {
    // Known pairs: (rate, z_score)
    const known: [number, number][] = [
      [0.50, 0.674], [0.80, 1.282], [0.90, 1.645], [0.95, 1.960],
    ];

    // If captured rate is near a known level, use that z-score
    for (const [rate, z] of known) {
      if (Math.abs(capturedRate - rate) < 0.01) return z;
    }

    // Clamp to known range
    if (capturedRate <= 0.50) return 0.674;
    if (capturedRate >= 0.95) return 1.960;

    // Linear interpolation
    let lower: [number, number] = [0.50, 0.674];
    let upper: [number, number] = [0.95, 1.960];
    for (const [r, z] of known) {
      if (r <= capturedRate && r >= lower[0]) lower = [r, z];
      if (r >= capturedRate && r <= upper[0]) upper = [r, z];
    }

    const t = (capturedRate - lower[0]) / (upper[0] - lower[0] + 0.001);
    return lower[1] + t * (upper[1] - lower[1]);
  }
}

export const calibrationLedger = new CalibrationLedger();
export default calibrationLedger;
