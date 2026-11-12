/**
 * Traffic volume estimator (DL-192).
 *
 * Turns an observed travel-time ratio (in traffic / free flow) into an hourly
 * vehicle volume by inverting a BPR-form speed–flow curve:
 *
 *   t / t0 = 1 + alpha * (v / c) ^ beta      =>      v = c * ((t / t0 - 1) / alpha) ^ (1 / beta)
 *
 * Pure functions only: no I/O, no clock. Parameters come from the caller
 * (traffic_speed_flow_params, or the uncalibrated defaults below).
 *
 * Known limits, surfaced in every result instead of hidden:
 *  - Near free flow the curve is flat, so volume is not identifiable from
 *    speed. Those readings are returned as `free_flow` with volume capped at
 *    the identifiability floor.
 *  - Above capacity observed flow falls while travel time keeps rising, so the
 *    curve is not invertible. Those readings are `clamped` at maxVcRatio.
 */

export const ROAD_CLASSES = ['Interstate', 'Expressway', 'Arterial', 'Collector', 'Local'] as const;
export type RoadClass = (typeof ROAD_CLASSES)[number];

export type SpeedFlowParamScope = 'station' | 'road_class' | 'default';

export interface SpeedFlowParams {
  roadClass: RoadClass;
  alpha: number;
  beta: number;
  /** Capacity of one lane, vehicles per hour. */
  capacityPerLaneVph: number;
  /** Lanes (both directions) assumed when the DOT station does not report them. */
  defaultLanes: number;
  /** v/c above which the curve is treated as not invertible. */
  maxVcRatio: number;
  scope: SpeedFlowParamScope;
  /** Where the numbers came from, e.g. 'uncalibrated_default' or 'fit:dot_hourly_counts'. */
  source: string;
  /** ISO date the parameters were fitted; null for uncalibrated defaults. */
  calibratedAt: string | null;
  sampleCount: number;
  fitR2: number | null;
}

const BPR_ALPHA = 0.15;
const BPR_BETA = 4;
const DEFAULT_MAX_VC = 1.2;

/**
 * Starting parameters: the standard BPR coefficients with planning-level lane
 * capacities. They are assumptions, not measurements — every result produced
 * from them carries `calibrated: false`, and the estimate stays behind its
 * feature flag until a back-test on DOT hourly counts replaces them.
 */
const DEFAULT_CAPACITY: Readonly<Record<RoadClass, { capacityPerLaneVph: number; defaultLanes: number }>> = {
  Interstate: { capacityPerLaneVph: 2000, defaultLanes: 6 },
  Expressway: { capacityPerLaneVph: 1800, defaultLanes: 4 },
  Arterial: { capacityPerLaneVph: 850, defaultLanes: 4 },
  Collector: { capacityPerLaneVph: 600, defaultLanes: 2 },
  Local: { capacityPerLaneVph: 400, defaultLanes: 2 },
};

export function defaultSpeedFlowParams(roadClass: RoadClass): SpeedFlowParams {
  return {
    roadClass,
    alpha: BPR_ALPHA,
    beta: BPR_BETA,
    ...DEFAULT_CAPACITY[roadClass],
    maxVcRatio: DEFAULT_MAX_VC,
    scope: 'default',
    source: 'uncalibrated_default',
    calibratedAt: null,
    sampleCount: 0,
    fitR2: null,
  };
}

const ROAD_CLASS_BY_ALIAS: Readonly<Record<string, RoadClass>> = {
  interstate: 'Interstate',
  expressway: 'Expressway',
  freeway: 'Expressway',
  arterial: 'Arterial',
  'principal arterial': 'Arterial',
  'minor arterial': 'Arterial',
  collector: 'Collector',
  'major collector': 'Collector',
  'minor collector': 'Collector',
  local: 'Local',
  'local road': 'Local',
};

/** Returns null for an unknown class so the caller can report it instead of guessing. */
export function toRoadClass(raw: string | null | undefined): RoadClass | null {
  if (!raw) return null;
  return ROAD_CLASS_BY_ALIAS[raw.toLowerCase().trim()] ?? null;
}

/**
 * Smallest travel-time ratio treated as a real slowdown. Durations arrive in
 * whole seconds on routes of roughly 60–180 s, so anything closer to 1 than
 * this is rounding noise.
 */
export const MIN_IDENTIFIABLE_RATIO = 1.02;

export type InversionStatus = 'ok' | 'free_flow' | 'clamped';

export interface SpeedFlowInversion {
  vcRatio: number;
  status: InversionStatus;
}

function assertValidParams(params: SpeedFlowParams): void {
  const positive: Array<[string, number]> = [
    ['alpha', params.alpha],
    ['beta', params.beta],
    ['capacityPerLaneVph', params.capacityPerLaneVph],
    ['defaultLanes', params.defaultLanes],
    ['maxVcRatio', params.maxVcRatio],
  ];
  for (const [name, value] of positive) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`SpeedFlowParams.${name} must be a positive finite number (got ${value})`);
    }
  }
}

/** v/c at which the curve reaches MIN_IDENTIFIABLE_RATIO; below it speed carries no volume signal. */
export function identifiabilityFloor(params: SpeedFlowParams): number {
  assertValidParams(params);
  return Math.pow((MIN_IDENTIFIABLE_RATIO - 1) / params.alpha, 1 / params.beta);
}

export function invertSpeedFlow(travelTimeRatio: number, params: SpeedFlowParams): SpeedFlowInversion {
  assertValidParams(params);
  if (!Number.isFinite(travelTimeRatio) || travelTimeRatio <= 0) {
    throw new RangeError(`travelTimeRatio must be a positive finite number (got ${travelTimeRatio})`);
  }
  if (travelTimeRatio < MIN_IDENTIFIABLE_RATIO) {
    return { vcRatio: identifiabilityFloor(params), status: 'free_flow' };
  }
  const vcRatio = Math.pow((travelTimeRatio - 1) / params.alpha, 1 / params.beta);
  if (vcRatio > params.maxVcRatio) {
    return { vcRatio: params.maxVcRatio, status: 'clamped' };
  }
  return { vcRatio, status: 'ok' };
}

export interface HourlyVolumeInput {
  freeFlowSeconds: number;
  inTrafficSeconds: number;
  /** Lanes reported by the DOT station; null falls back to the class default. */
  lanes: number | null;
  params: SpeedFlowParams;
}

export interface HourlyVolumeEstimate {
  /** Vehicles per hour. For `free_flow` this is an upper bound, for `clamped` a lower bound. */
  volumeVph: number;
  vcRatio: number;
  travelTimeRatio: number;
  status: InversionStatus;
  lanesUsed: number;
  lanesSource: 'dot_station' | 'class_default';
  /** False when the parameters are the uncalibrated defaults. */
  calibrated: boolean;
}

export function estimateHourlyVolume(input: HourlyVolumeInput): HourlyVolumeEstimate {
  const { freeFlowSeconds, inTrafficSeconds, lanes, params } = input;
  if (!Number.isFinite(freeFlowSeconds) || freeFlowSeconds <= 0) {
    throw new RangeError(`freeFlowSeconds must be a positive finite number (got ${freeFlowSeconds})`);
  }
  if (!Number.isFinite(inTrafficSeconds) || inTrafficSeconds <= 0) {
    throw new RangeError(`inTrafficSeconds must be a positive finite number (got ${inTrafficSeconds})`);
  }
  const hasStationLanes = lanes !== null && Number.isFinite(lanes) && lanes > 0;
  const lanesUsed = hasStationLanes ? (lanes as number) : params.defaultLanes;
  const travelTimeRatio = inTrafficSeconds / freeFlowSeconds;
  const { vcRatio, status } = invertSpeedFlow(travelTimeRatio, params);
  return {
    volumeVph: vcRatio * lanesUsed * params.capacityPerLaneVph,
    vcRatio,
    travelTimeRatio,
    status,
    lanesUsed,
    lanesSource: hasStationLanes ? 'dot_station' : 'class_default',
    calibrated: params.scope !== 'default',
  };
}

// ─── Calibration ────────────────────────────────────────────────────────────

/** One paired reading: a travel-time ratio and the DOT hourly count for the same road and hour. */
export interface CalibrationObservation {
  travelTimeRatio: number;
  dotHourlyCountVph: number;
  lanes: number;
}

export const MIN_CALIBRATION_OBSERVATIONS = 8;

export type CalibrationFit =
  | { status: 'ok'; params: SpeedFlowParams; usedObservations: number }
  | { status: 'insufficient_observations'; usedObservations: number; required: number }
  | { status: 'degenerate'; usedObservations: number; reason: string };

export interface CalibrationOptions {
  scope: Exclude<SpeedFlowParamScope, 'default'>;
  source: string;
  /** ISO date recorded on the fitted parameters. Passed in so the fit stays deterministic. */
  calibratedAt: string;
}

/**
 * Fits alpha and beta by ordinary least squares on the log form of the curve,
 *
 *   ln(t/t0 - 1) = ln(alpha) + beta * ln(v/c),
 *
 * holding lane capacity at the base value. Free-flow readings and readings
 * above maxVcRatio are excluded because the curve does not describe them.
 */
export function fitSpeedFlowParams(
  observations: readonly CalibrationObservation[],
  base: SpeedFlowParams,
  options: CalibrationOptions,
): CalibrationFit {
  assertValidParams(base);
  const points: Array<{ x: number; y: number }> = [];
  for (const obs of observations) {
    if (!(obs.lanes > 0) || !(obs.dotHourlyCountVph > 0)) continue;
    if (!Number.isFinite(obs.travelTimeRatio) || obs.travelTimeRatio < MIN_IDENTIFIABLE_RATIO) continue;
    const vc = obs.dotHourlyCountVph / (obs.lanes * base.capacityPerLaneVph);
    if (vc > base.maxVcRatio) continue;
    points.push({ x: Math.log(vc), y: Math.log(obs.travelTimeRatio - 1) });
  }

  const n = points.length;
  if (n < MIN_CALIBRATION_OBSERVATIONS) {
    return { status: 'insufficient_observations', usedObservations: n, required: MIN_CALIBRATION_OBSERVATIONS };
  }

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
    syy += (p.y - meanY) ** 2;
  }
  if (sxx < 1e-9) {
    return { status: 'degenerate', usedObservations: n, reason: 'all observations share one v/c value' };
  }

  const beta = sxy / sxx;
  const alpha = Math.exp(meanY - beta * meanX);
  if (!(beta > 0) || !Number.isFinite(alpha) || !(alpha > 0)) {
    return {
      status: 'degenerate',
      usedObservations: n,
      reason: 'travel time does not rise with volume in these observations',
    };
  }

  const fitR2 = syy < 1e-12 ? 1 : (sxy * sxy) / (sxx * syy);
  return {
    status: 'ok',
    usedObservations: n,
    params: {
      ...base,
      alpha,
      beta,
      scope: options.scope,
      source: options.source,
      calibratedAt: options.calibratedAt,
      sampleCount: n,
      fitR2,
    },
  };
}

// ─── Cross-check ────────────────────────────────────────────────────────────

export interface CrossCheckRequest {
  propertyId: string;
  stationId: string | null;
  /** Local hour 0–23 the estimate is for. */
  hour: number;
  /** Inclusive start and exclusive end of the sample window, ISO timestamps. */
  windowStart: string;
  windowEnd: string;
}

export interface CrossCheckReading {
  /** e.g. 'dot_continuous_counter', 'foot_traffic_panel'. */
  source: string;
  volumeVph: number;
  observedAt: string;
}

/**
 * An independent volume reading for the same road and hour (a live DOT
 * counter, a foot-traffic panel). No provider is registered today; the
 * interface exists so one can be added without touching the estimator.
 */
export interface VolumeCrossCheckProvider {
  readonly name: string;
  getHourlyVolume(request: CrossCheckRequest): Promise<CrossCheckReading | null>;
}

export type CrossCheckResult =
  | { status: 'no_cross_check' }
  | { status: 'agree' | 'diverge'; source: string; referenceVolumeVph: number; differencePct: number };

export function evaluateCrossCheck(
  estimatedVolumeVph: number,
  reading: CrossCheckReading | null,
  tolerancePct: number,
): CrossCheckResult {
  if (!reading || !(reading.volumeVph > 0)) return { status: 'no_cross_check' };
  const differencePct = ((estimatedVolumeVph - reading.volumeVph) / reading.volumeVph) * 100;
  return {
    status: Math.abs(differencePct) <= tolerancePct ? 'agree' : 'diverge',
    source: reading.source,
    referenceVolumeVph: reading.volumeVph,
    differencePct,
  };
}
