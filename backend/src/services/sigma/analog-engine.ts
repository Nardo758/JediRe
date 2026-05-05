/**
 * Cross-Market Analog Engine — M37
 *
 * Geographic transfer learning for event impact forecasting.
 * Given a target market and event, searches M35's event library for
 * similar past events, weights them by factor-space similarity,
 * and produces a forecast with calibrated confidence bands.
 *
 * Three query modes (spec §5):
 *   Forward: event → forecast
 *   Backward: market → event response profile
 *   Counterfactual: hypothetical event in target market
 *
 * Similarity formula (spec §3):
 *   sim(target, analog) = sim_market × sim_regime × sim_event
 */

import type { Logger } from 'pino';
import { createLogger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ForwardQueryParams {
  targetMarket: {
    msaId: string;
    submarketId?: string;
    assetClass: string;
    location?: { lat: number; lng: number };
  };
  event:
    | { eventId?: string }
    | { hypothetical: { subtype: string; magnitude: number } };
  metrics: string[];
  horizonsMonths: number[];
  minNEffective?: number;
  bandwidthOverrides?: Partial<BandwidthConfig>;
}

export interface BackwardQueryParams {
  targetMarket: {
    msaId: string;
    submarketId?: string;
    assetClass: string;
  };
  metrics: string[];
  horizonsMonths: number[];
  eventSubtypes?: string[];
}

export interface CounterfactualQueryParams {
  targetMarket: {
    msaId: string;
    submarketId?: string;
    assetClass: string;
    location: { lat: number; lng: number };
  };
  hypotheticalEvent: {
    subtype: string;
    magnitude: number;
    expectedAnnouncementMonth?: number;
  };
  metrics: string[];
  horizonsMonths: number[];
}

export interface BandwidthConfig {
  lambdaFactor: number;
  lambdaGeo: number;
  lambdaChars: number;
  lambdaMagnitude: number;
  lambdaTiming: number;
}

export interface AnalogForecast {
  metric: string;
  horizon: number;
  point: number;
  ci80: [number, number];
  nEffective: number;
  analogs: {
    eventId: string;
    market: string;
    similarity: number;
    realized: number;
    regime: string;
  }[];
  varianceDecomposition: { within: number; between: number };
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalogForecastResult {
  forecasts: AnalogForecast[];
  queryMode: string;
  warnings: string[];
}

export interface AnalogResponseProfile {
  eventSubtype: string;
  typicalImpact: Record<string, Record<number, { point: number; ci80: number[] }>>;
  historicalFrequencyPerYear: number;
  nAnalogs: number;
}

export interface AnalogTrajectory {
  metric: string;
  curve: { horizon: number; point: number; ci80: number[] }[];
  nEffectivePerHorizon: number[];
}

/**
 * Analog candidate from the pool
 */
interface AnalogRecord {
  eventId: string;
  eventSubtype: string;
  eventCategory: string;
  marketId: string;
  marketName: string;
  msaId: string;
  assetClass: string;
  regime: string;
  regimeProbabilities: Record<string, number>;
  magnitude: number;
  monthsSinceEvent: number;
  /** Factor loadings B for this market (keyed by variable → factor → loading) */
  factorLoadings: Record<string, Record<string, number>>;
  marketCharacteristics: Record<string, number>;
  location: { lat: number; lng: number };
  /** Realized impacts: { metric: { horizon: { value, variance } } } */
  realizedImpacts: Record<string, Record<number, { value: number; variance: number }>>;
}

/**
 * In-market event parameters
 */
interface TargetContext {
  msaId: string;
  submarketId?: string;
  assetClass: string;
  location?: { lat: number; lng: number };
  regimeProbabilities: Record<string, number>;
  factorLoadings: Record<string, Record<string, number>>;
  marketCharacteristics: Record<string, number>;
  /** If a real event */
  eventSubtype?: string;
  eventCategory?: string;
  magnitude?: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BANDWIDTHS: BandwidthConfig = {
  lambdaFactor: 1.0,
  lambdaGeo: 30, // minutes
  lambdaChars: 1.0,
  lambdaMagnitude: 1.0,
  lambdaTiming: 6, // months
};

const REGIME_SIM_HARD: Record<string, Record<string, number>> = {
  Expansion: { Expansion: 1.0, 'Late-Cycle': 0.6, Contraction: 0.2 },
  'Late-Cycle': { Expansion: 0.6, 'Late-Cycle': 1.0, Contraction: 0.6 },
  Contraction: { Expansion: 0.2, 'Late-Cycle': 0.6, Contraction: 1.0 },
};

// ─── Logger ──────────────────────────────────────────────────────────────────

const log: Logger = createLogger('analog-engine');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDriveMinutes(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const miles = haversineMiles(lat1, lng1, lat2, lng2);
  return miles / 35 * 60 + 5;
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0));
}

function weightedDistance(a: Record<string, number>, b: Record<string, number>, weights?: Record<string, number>): number {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  let sum = 0;
  for (const k of keys) {
    const w = weights?.[k] ?? 1;
    const diff = (a[k] ?? 0) - (b[k] ?? 0);
    sum += w * diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * t-critical value from the t-distribution.
 * Approximation using normal quantile + Hill-Davis adjustment.
 */
function tCritical(df: number, alpha: number): number {
  if (df >= 1e6) {
    // Normal approximation
    const p = 1 - alpha / 2;
    return normalQuantile(p);
  }
  const p = 1 - alpha / 2;
  const zp = normalQuantile(p);
  return zp + (zp * zp * zp + zp) / (4 * df);
}

function normalQuantile(p: number): number {
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
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e2 = x - (normalCdf(x) - p) / normalPdf(x);
  return e2;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  return sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
}

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ─── Class ───────────────────────────────────────────────────────────────────

export class AnalogEngine {
  private analogPool: AnalogRecord[] = [];
  private bandwidths: BandwidthConfig = { ...DEFAULT_BANDWIDTHS };

  constructor() {}

  // ─── Analog Pool Management ─────────────────────────────────────────────

  setAnalogPool(pool: AnalogRecord[]): void {
    this.analogPool = pool;
    log.info({ count: pool.length }, 'Analog pool set');
  }

  addAnalogRecord(record: AnalogRecord): void {
    this.analogPool.push(record);
  }

  setBandwidths(bw: Partial<BandwidthConfig>): void {
    Object.assign(this.bandwidths, bw);
    log.info({ bandwidths: this.bandwidths }, 'Bandwidths updated');
  }

  getBandwidths(): BandwidthConfig {
    return { ...this.bandwidths };
  }

  getPoolSize(): number {
    return this.analogPool.length;
  }

  // ─── Similarity Computation ──────────────────────────────────────────

  /**
   * Compute similarity between a target and an analog.
   * spec §3: sim = sim_market × sim_regime × sim_event
   */
  computeSimilarity(
    targetContext: TargetContext,
    analog: AnalogRecord,
    eventSubtype?: string,
    eventCategory?: string,
    magnitudeOverride?: number,
  ): number {
    const bw = this.bandwidths;

    // ── Market similarity ──
    // Factor space distance: compare loadings on overlapping variables
    let factorDist = 0;
    let fCount = 0;
    const tLoadings = targetContext.factorLoadings;
    const aLoadings = analog.factorLoadings;

    for (const varId of Object.keys(tLoadings)) {
      const tVar = tLoadings[varId] ?? {};
      const aVar = aLoadings[varId] ?? {};
      for (const factorId of Object.keys(tVar)) {
        const diff = (tVar[factorId] ?? 0) - (aVar[factorId] ?? 0);
        factorDist += diff * diff;
        fCount++;
      }
    }
    if (fCount > 0) factorDist = Math.sqrt(factorDist / fCount);

    const simFactor = Math.exp(-factorDist / bw.lambdaFactor);

    // Geographic distance (drive-time based)
    let simGeo = 1.0;
    if (targetContext.location && analog.location) {
      const driveMin = estimateDriveMinutes(
        targetContext.location.lat, targetContext.location.lng,
        analog.location.lat, analog.location.lng,
      );
      simGeo = Math.exp(-driveMin / bw.lambdaGeo);
    }

    // Market characteristics distance
    const charKeys = [...new Set([...Object.keys(targetContext.marketCharacteristics), ...Object.keys(analog.marketCharacteristics)])];
    let charDist = 0;
    let cCount = 0;
    for (const k of charKeys) {
      const diff = (targetContext.marketCharacteristics[k] ?? 0) - (analog.marketCharacteristics[k] ?? 0);
      charDist += diff * diff;
      cCount++;
    }
    if (cCount > 0) charDist = Math.sqrt(charDist / cCount);

    const simChars = Math.exp(-charDist / bw.lambdaChars);

    const simMarket = simFactor * simGeo * simChars;

    // ── Regime similarity ──
    const tProbs = targetContext.regimeProbabilities;
    const aProbs = analog.regimeProbabilities;
    let simRegime = 0;
    for (const r of ['Expansion', 'Late-Cycle', 'Contraction']) {
      simRegime += (tProbs[r] ?? 0) * (aProbs[r] ?? 0);
    }
    // Fallback to hard match if probabilities not available
    if (simRegime <= 0) {
      const tRegime = Object.entries(tProbs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Expansion';
      const aRegime = analog.regime;
      simRegime = REGIME_SIM_HARD[tRegime]?.[aRegime] ?? 0.5;
    }

    // ── Event similarity ──
    const sub = eventSubtype ?? targetContext.eventSubtype ?? analog.eventSubtype;
    const cat = eventCategory ?? targetContext.eventCategory ?? analog.eventCategory;
    const subMatch = sub === analog.eventSubtype ? 1 : (cat === analog.eventCategory ? 0.4 : 0);

    const tMag = magnitudeOverride ?? targetContext.magnitude ?? 1;
    const aMag = analog.magnitude;
    let simMag = 1.0;
    if (tMag > 0 && aMag > 0) {
      const magDiff = Math.abs(Math.log(tMag) - Math.log(aMag));
      simMag = Math.exp(-magDiff / bw.lambdaMagnitude);
    } else if (!tMag || !aMag) {
      simMag = 0.5; // moderate similarity when magnitude unknown
    }

    const tMonths = magnitudeOverride ? 0 : 0; // for hypothetical events, months_since = 0
    const aMonths = analog.monthsSinceEvent;
    const timingGap = Math.abs(tMonths - aMonths);
    const simTiming = Math.exp(-timingGap / bw.lambdaTiming);

    const simEvent = subMatch * simMag * simTiming;

    return simMarket * simRegime * simEvent;
  }

  /**
   * Get similarity breakdown for diagnostics.
   */
  computeSimilarityBreakdown(
    targetContext: TargetContext,
    analog: AnalogRecord,
    eventSubtype?: string,
    eventCategory?: string,
    magnitudeOverride?: number,
  ): { simMarket: number; simRegime: number; simEvent: number | null; total: number } {
    const bw = this.bandwidths;

    // simMarket
    let factorDist = 0; let fCount = 0;
    const tLoadings = targetContext.factorLoadings;
    const aLoadings = analog.factorLoadings;
    for (const varId of Object.keys(tLoadings)) {
      const tVar = tLoadings[varId] ?? {};
      const aVar = aLoadings[varId] ?? {};
      for (const factorId of Object.keys(tVar)) {
        const diff = (tVar[factorId] ?? 0) - (aVar[factorId] ?? 0);
        factorDist += diff * diff; fCount++;
      }
    }
    if (fCount > 0) factorDist = Math.sqrt(factorDist / fCount);
    const simFactor = Math.exp(-factorDist / bw.lambdaFactor);

    let simGeo = 1.0;
    if (targetContext.location && analog.location) {
      const driveMin = estimateDriveMinutes(targetContext.location.lat, targetContext.location.lng, analog.location.lat, analog.location.lng);
      simGeo = Math.exp(-driveMin / bw.lambdaGeo);
    }

    const charDist = weightedDistance(targetContext.marketCharacteristics, analog.marketCharacteristics);
    const simChars = Math.exp(-charDist / bw.lambdaChars);
    const simMarket = simFactor * simGeo * simChars;

    // simRegime
    const tProbs = targetContext.regimeProbabilities;
    const aProbs = analog.regimeProbabilities;
    let simRegime = 0;
    for (const r of ['Expansion', 'Late-Cycle', 'Contraction']) {
      simRegime += (tProbs[r] ?? 0) * (aProbs[r] ?? 0);
    }
    if (simRegime <= 0) {
      const tRegime = Object.entries(tProbs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Expansion';
      simRegime = REGIME_SIM_HARD[tRegime]?.[analog.regime] ?? 0.5;
    }

    // simEvent
    let simEvent: number | null = null;
    if (eventSubtype || eventCategory) {
      const sub = eventSubtype ?? targetContext.eventSubtype ?? analog.eventSubtype;
      const cat = eventCategory ?? targetContext.eventCategory ?? analog.eventCategory;
      const subMatch = sub === analog.eventSubtype ? 1 : (cat === analog.eventCategory ? 0.4 : 0);
      const tMag = magnitudeOverride ?? targetContext.magnitude ?? 1;
      const aMag = analog.magnitude;
      const magDiff = tMag > 0 && aMag > 0 ? Math.abs(Math.log(tMag) - Math.log(aMag)) : 0.7;
      const simMag = Math.exp(-magDiff / bw.lambdaMagnitude);
      const timingGap = Math.abs(0 - analog.monthsSinceEvent);
      const simTiming = Math.exp(-timingGap / bw.lambdaTiming);
      simEvent = subMatch * simMag * simTiming;
    }

    const total = simMarket * simRegime * (simEvent ?? 1.0);
    return { simMarket, simRegime, simEvent, total };
  }

  // ─── Forecast Generation ──────────────────────────────────────────────

  /**
   * Generate forecast for a single (metric, horizon) pair from a
   * similarity-weighted analog pool.
   */
  private computeForecast(
    metric: string,
    horizon: number,
    analogs: { record: AnalogRecord; sim: number }[],
    minNEffective: number = 3,
  ): AnalogForecast | null {
    const valid = analogs.filter(a => {
      const impact = a.record.realizedImpacts[metric]?.[horizon];
      return impact !== undefined && a.sim >= 0.05;
    });

    if (valid.length === 0) return null;

    const totalSim = valid.reduce((s, a) => s + a.sim, 0);
    if (totalSim <= 0) return null;

    // Weighted mean (point estimate)
    const point = valid.reduce((s, a) => {
      const impact = a.record.realizedImpacts[metric][horizon];
      return s + a.sim * impact.value;
    }, 0) / totalSim;

    // Effective sample size (Kish)
    const sumSimSq = valid.reduce((s, a) => s + a.sim * a.sim, 0);
    const nEffective = totalSim * totalSim / (sumSimSq || 1);

    // Variance decomposition
    const sigmaWithin = Math.sqrt(valid.reduce((s, a) => {
      const impact = a.record.realizedImpacts[metric][horizon];
      return s + a.sim * a.sim * impact.variance;
    }, 0) / (totalSim * totalSim));

    const sigmaBetween = Math.sqrt(valid.reduce((s, a) => {
      const impact = a.record.realizedImpacts[metric][horizon];
      return s + a.sim * (impact.value - point) * (impact.value - point);
    }, 0) / totalSim);

    const totalVar = sigmaWithin * sigmaWithin + sigmaBetween * sigmaBetween;
    const totalSd = Math.sqrt(totalVar);

    // Confidence bands (t-distribution, spec §4.3)
    const df = Math.max(1, nEffective - 1);
    const tVal = tCritical(df, 0.20); // 80% CI
    const ciLow = point - tVal * totalSd;
    const ciHigh = point + tVal * totalSd;

    // Confidence level
    let confidence: 'high' | 'medium' | 'low';
    if (nEffective >= 10) confidence = 'high';
    else if (nEffective >= 5) confidence = 'medium';
    else if (nEffective >= minNEffective) confidence = 'low';
    else return null; // below min effective sample size

    // Top analogs for diagnostics
    const topAnalogs = valid
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 10)
      .map(a => ({
        eventId: a.record.eventId,
        market: a.record.marketName,
        similarity: Math.round(a.sim * 100) / 100,
        realized: a.record.realizedImpacts[metric]?.[horizon]?.value ?? 0,
        regime: a.record.regime,
      }));

    return {
      metric,
      horizon,
      point,
      ci80: [ciLow, ciHigh],
      nEffective,
      analogs: topAnalogs,
      varianceDecomposition: {
        within: sigmaWithin * sigmaWithin,
        between: sigmaBetween * sigmaBetween,
      },
      confidence,
    };
  }

  // ─── Query Modes (Spec §5) ─────────────────────────────────────────

  /**
   * Forward mode: given an event, forecast its impact.
   * spec §5.1
   */
  forwardQuery(params: ForwardQueryParams): AnalogForecastResult {
    const warnings: string[] = [];
    const minNEff = params.minNEffective ?? 3;

    if (this.analogPool.length === 0) {
      warnings.push('Analog pool is empty');
      return { forecasts: [], queryMode: 'forward', warnings };
    }

    // Build target context
    const targetContext: TargetContext = {
      msaId: params.targetMarket.msaId,
      submarketId: params.targetMarket.submarketId,
      assetClass: params.targetMarket.assetClass,
      location: params.targetMarket.location,
      regimeProbabilities: { Expansion: 0.5, 'Late-Cycle': 0.35, Contraction: 0.15 },
      factorLoadings: {},
      marketCharacteristics: {},
    };

    // Determine event subtype/category
    let eventSubtype: string | undefined;
    let eventCategory: string | undefined;
    let magnitude: number | undefined;

    if ('hypothetical' in params.event) {
      eventSubtype = params.event.hypothetical.subtype;
      magnitude = params.event.hypothetical.magnitude;
    } else if (params.event.eventId) {
      // Look up event from pool
      const match = this.analogPool.find(a => a.eventId === params.event.eventId);
      if (match) {
        eventSubtype = match.eventSubtype;
        eventCategory = match.eventCategory;
        magnitude = match.magnitude;
        targetContext.regimeProbabilities = match.regimeProbabilities;
        targetContext.factorLoadings = match.factorLoadings;
        targetContext.marketCharacteristics = match.marketCharacteristics;
      } else {
        warnings.push(`Event ${params.event.eventId} not found in analog pool`);
      }
    }

    // Filter pool to matching asset class
    const filteredPool = this.analogPool.filter(a =>
      a.assetClass === params.targetMarket.assetClass
    );

    if (filteredPool.length < 2) {
      warnings.push(`Insufficient analogs for asset class ${params.targetMarket.assetClass} (found ${filteredPool.length})`);
      return { forecasts: [], queryMode: 'forward', warnings };
    }

    // Compute similarities
    const scoredAnalogs = filteredPool.map(a => ({
      record: a,
      sim: this.computeSimilarity(targetContext, a, eventSubtype, eventCategory, magnitude),
    })).filter(a => a.sim >= 0.05)
      .sort((a, b) => b.sim - a.sim);

    const topAnalogs = scoredAnalogs.slice(0, 50);

    if (topAnalogs.length < 2) {
      warnings.push('Fewer than 2 analogs after similarity filtering');
      return { forecasts: [], queryMode: 'forward', warnings };
    }

    // Compute forecasts per (metric, horizon)
    const forecasts: AnalogForecast[] = [];
    for (const metric of params.metrics) {
      for (const horizon of params.horizonsMonths) {
        const forecast = this.computeForecast(metric, horizon, topAnalogs, minNEff);
        if (forecast) forecasts.push(forecast);
      }
    }

    if (forecasts.length === 0) {
      warnings.push('No forecasts met minimum effective sample size');
    }

    // Check effective sample size
    const minEff = Math.min(...forecasts.map(f => f.nEffective));
    if (minEff < 3) {
      warnings.push(`Low effective sample size (min ${minEff.toFixed(1)}) — forecasts are directional only`);
    }

    return { forecasts, queryMode: 'forward', warnings };
  }

  /**
   * Backward mode: given a market profile, compute response distribution
   * for each event subtype.
   * spec §5.2
   */
  backwardQuery(params: BackwardQueryParams): AnalogResponseProfile[] {
    const profiles: AnalogResponseProfile[] = [];

    if (this.analogPool.length === 0) return profiles;

    // Filter pool to asset class
    const filteredPool = this.analogPool.filter(a =>
      a.assetClass === params.targetMarket.assetClass
    );

    // Gather unique event subtypes
    const subtypes = params.eventSubtypes
      ? params.eventSubtypes
      : [...new Set(filteredPool.map(a => a.eventSubtype))];

    const targetContext: TargetContext = {
      msaId: params.targetMarket.msaId,
      submarketId: params.targetMarket.submarketId,
      assetClass: params.targetMarket.assetClass,
      regimeProbabilities: { Expansion: 0.5, 'Late-Cycle': 0.35, Contraction: 0.15 },
      factorLoadings: {},
      marketCharacteristics: {},
    };

    for (const subtype of subtypes) {
      // Find analogs matching this subtype
      const subtypeAnalogs = filteredPool.filter(a => a.eventSubtype === subtype);
      if (subtypeAnalogs.length < 2) continue;

      // Compute similarities
      const scored = subtypeAnalogs.map(a => ({
        record: a,
        sim: this.computeSimilarity(targetContext, a, subtype),
      })).filter(a => a.sim >= 0.05);

      const totalSim = scored.reduce((s, a) => s + a.sim, 0);
      if (totalSim <= 0) continue;

      // Historical frequency
      const years = subtypeAnalogs.reduce((max, a) => Math.max(max, a.monthsSinceEvent / 12), 12);
      const freqPerYear = subtypeAnalogs.length / Math.max(years, 1);

      // Compute typical impact per (metric, horizon)
      const typicalImpact: Record<string, Record<number, { point: number; ci80: number[] }>> = {};
      for (const metric of params.metrics) {
        typicalImpact[metric] = {};
        for (const horizon of params.horizonsMonths) {
          const forecast = this.computeForecast(metric, horizon, scored, 2);
          if (forecast) {
            typicalImpact[metric][horizon] = {
              point: forecast.point,
              ci80: forecast.ci80,
            };
          }
        }
      }

      profiles.push({
        eventSubtype: subtype,
        typicalImpact,
        historicalFrequencyPerYear: Math.round(freqPerYear * 100) / 100,
        nAnalogs: scored.length,
      });
    }

    // Sort by number of analogs descending
    profiles.sort((a, b) => b.nAnalogs - a.nAnalogs);

    return profiles;
  }

  /**
   * Counterfactual mode: given a hypothetical event, return full trajectories.
   * spec §5.3
   */
  counterfactualQuery(params: CounterfactualQueryParams): AnalogTrajectory[] {
    const trajectories: AnalogTrajectory[] = [];

    if (this.analogPool.length === 0) return trajectories;

    const targetContext: TargetContext = {
      msaId: params.targetMarket.msaId,
      submarketId: params.targetMarket.submarketId,
      assetClass: params.targetMarket.assetClass,
      location: params.targetMarket.location,
      regimeProbabilities: { Expansion: 0.5, 'Late-Cycle': 0.35, Contraction: 0.15 },
      factorLoadings: {},
      marketCharacteristics: {},
    };

    const hypEvent = params.hypotheticalEvent;

    // Filter pool
    const filteredPool = this.analogPool.filter(a =>
      a.assetClass === params.targetMarket.assetClass &&
      a.eventSubtype === hypEvent.subtype
    );

    if (filteredPool.length < 2) return trajectories;

    // Score analogs
    const scored = filteredPool.map(a => ({
      record: a,
      sim: this.computeSimilarity(targetContext, a, hypEvent.subtype, undefined, hypEvent.magnitude),
    })).filter(a => a.sim >= 0.05)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 50);

    if (scored.length < 2) return trajectories;

    // For each metric, generate curve across horizons
    for (const metric of params.metrics) {
      const curve: { horizon: number; point: number; ci80: number[] }[] = [];
      const nEffPerHorizon: number[] = [];

      for (const horizon of params.horizonsMonths) {
        const forecast = this.computeForecast(metric, horizon, scored);

        if (forecast) {
          curve.push({
            horizon,
            point: forecast.point,
            ci80: forecast.ci80,
          });
          nEffPerHorizon.push(forecast.nEffective);
        }
      }

      if (curve.length > 0) {
        trajectories.push({
          metric,
          curve,
          nEffectivePerHorizon: nEffPerHorizon,
        });
      }
    }

    return trajectories;
  }

  // ─── Diagnostic Helpers ─────────────────────────────────────────────

  /**
   * Find the closest analogs for a target market.
   */
  findClosestAnalogs(
    targetMsaId: string,
    assetClass: string,
    limit: number = 20,
    minSimilarity: number = 0.05,
  ): { eventId: string; marketName: string; similarity: number; subtype: string }[] {
    const targetContext: TargetContext = {
      msaId: targetMsaId,
      assetClass,
      regimeProbabilities: { Expansion: 0.5, 'Late-Cycle': 0.35, Contraction: 0.15 },
      factorLoadings: {},
      marketCharacteristics: {},
    };

    const scored = this.analogPool
      .filter(a => a.assetClass === assetClass)
      .map(a => ({
        eventId: a.eventId,
        marketName: a.marketName,
        subtype: a.eventSubtype,
        similarity: this.computeSimilarity(targetContext, a, undefined, undefined, undefined),
      }))
      .filter(a => a.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }
}

export const analogEngine = new AnalogEngine();
export default analogEngine;
