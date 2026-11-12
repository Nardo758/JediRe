/**
 * Traffic growth index (DL-192).
 *
 *   growth = (current volume − DOT baseline) / DOT baseline
 *
 * Both sides are hourly volumes for the same local hour, weekday and month:
 * the baseline is DOT AADT spread by dot_temporal_profiles, and the current
 * volume comes from sampled travel times through traffic-volume-estimator.
 *
 * What changed from the previous version: "current" used to be AADT multiplied
 * by Google's travel-time ratio, which measures congestion, not volume. That
 * ratio is now stored on its own as C_TRAFFIC_CONGESTION_INDEX and no longer
 * feeds growth.
 *
 * The growth estimate is only published to metric_time_series when
 * TRAFFIC_GROWTH_INDEX_EST_ENABLED is 'true'. With the flag off the service
 * still computes and returns it, so it can be back-tested, but nothing
 * downstream can read it.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
  TRAFFIC_GROWTH_CONFIG,
  TRAFFIC_METRIC_IDS,
  TrafficGrowthConfig,
  isTrafficGrowthEstimateEnabled,
} from '../config/traffic-growth.config';
import { getDotTemporalProfilesService } from './dot-temporal-profiles.service';
import {
  CrossCheckResult,
  HourlyVolumeEstimate,
  RoadClass,
  SpeedFlowParams,
  VolumeCrossCheckProvider,
  defaultSpeedFlowParams,
  estimateHourlyVolume,
  evaluateCrossCheck,
  identifiabilityFloor,
  toRoadClass,
} from './traffic-volume-estimator';

export { TRAFFIC_GROWTH_RESPONSE_META } from '../config/traffic-growth.config';

// ─── Pure core ──────────────────────────────────────────────────────────────

export interface SpeedSample {
  sampledAt: string;
  /** Local hour 0–23, weekday 0 (Sunday)–6 and month 1–12 at the property. */
  localHour: number;
  localDayOfWeek: number;
  localMonth: number;
  inTrafficSeconds: number;
  typicalSeconds: number;
}

export interface TemporalFactors {
  /** Share of daily volume carried in this hour (the 24 shares sum to about 1). */
  hourlyShare: number;
  dowFactor: number;
  seasonalFactor: number;
}

export type TemporalLookup = (hour: number, dayOfWeek: number, month: number) => TemporalFactors;

export interface GrowthEstimateInput {
  samples: readonly SpeedSample[];
  baselineAadt: number;
  /** Lanes from the DOT station, or null to use the class default. */
  lanes: number | null;
  params: SpeedFlowParams;
  temporal: TemporalLookup;
  config: Pick<TrafficGrowthConfig, 'minSamples' | 'freeFlowPercentile' | 'maxFreeFlowShare'>;
}

export interface HourlyGrowthBreakdown {
  hour: number;
  sampleCount: number;
  meanEstimatedVph: number;
  meanBaselineVph: number;
}

export type GrowthEstimate =
  | {
      status: 'ok';
      growthPct: number;
      /** Samples at hours where the baseline predicts enough volume for speed to carry a signal. */
      usableSampleCount: number;
      /** Usable samples that still read as free flow; their volume is an upper bound. */
      freeFlowSampleCount: number;
      /** Usable samples above the invertible range; their volume is a lower bound. */
      clampedSampleCount: number;
      freeFlowSeconds: number;
      calibrated: boolean;
      lanesSource: HourlyVolumeEstimate['lanesSource'];
      hourly: HourlyGrowthBreakdown[];
    }
  | { status: 'insufficient_samples'; usableSampleCount: number; totalSampleCount: number; required: number }
  | { status: 'insufficient_signal'; usableSampleCount: number; freeFlowShare: number; maxFreeFlowShare: number };

/** Nearest-rank percentile; `p` in [0, 1]. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new RangeError('percentile of an empty list');
  if (!(p >= 0 && p <= 1)) throw new RangeError(`percentile p must be within [0, 1] (got ${p})`);
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1];
}

/** DOT baseline volume for one hour, normalised by hour, weekday and season. */
export function baselineHourlyVolume(baselineAadt: number, factors: TemporalFactors): number {
  return baselineAadt * factors.hourlyShare * factors.dowFactor * factors.seasonalFactor;
}

export function computeGrowthEstimate(input: GrowthEstimateInput): GrowthEstimate {
  const { baselineAadt, lanes, params, temporal, config } = input;
  if (!(baselineAadt > 0)) throw new RangeError(`baselineAadt must be positive (got ${baselineAadt})`);

  const valid = input.samples.filter((s) => s.inTrafficSeconds > 0);
  if (valid.length < config.minSamples) {
    return {
      status: 'insufficient_samples',
      usableSampleCount: 0,
      totalSampleCount: valid.length,
      required: config.minSamples,
    };
  }

  // Free-flow time is taken from the window itself (a low percentile of the
  // observed travel times), not from Google's "typical" duration, which is an
  // average-conditions figure and can exceed the in-traffic time overnight.
  const freeFlowSeconds = percentile(valid.map((s) => s.inTrafficSeconds), config.freeFlowPercentile);

  // A sample is usable when the DOT baseline for its hour implies a v/c high
  // enough for travel time to respond. Selecting on the baseline, not on the
  // observed slowdown, keeps quiet-but-usable hours in the comparison.
  const probe = estimateHourlyVolume({ freeFlowSeconds, inTrafficSeconds: freeFlowSeconds, lanes, params });
  const hourlyCapacity = probe.lanesUsed * params.capacityPerLaneVph;
  const floor = identifiabilityFloor(params);

  const byHour = new Map<number, { n: number; estimated: number; baseline: number }>();
  let usable = 0;
  let freeFlow = 0;
  let clamped = 0;
  let estimatedTotal = 0;
  let baselineTotal = 0;

  for (const sample of valid) {
    const baselineVph = baselineHourlyVolume(
      baselineAadt,
      temporal(sample.localHour, sample.localDayOfWeek, sample.localMonth),
    );
    if (!(baselineVph > 0) || baselineVph / hourlyCapacity < floor) continue;

    const estimate = estimateHourlyVolume({
      freeFlowSeconds,
      inTrafficSeconds: sample.inTrafficSeconds,
      lanes,
      params,
    });
    usable++;
    if (estimate.status === 'free_flow') freeFlow++;
    if (estimate.status === 'clamped') clamped++;
    estimatedTotal += estimate.volumeVph;
    baselineTotal += baselineVph;

    const bucket = byHour.get(sample.localHour) ?? { n: 0, estimated: 0, baseline: 0 };
    bucket.n++;
    bucket.estimated += estimate.volumeVph;
    bucket.baseline += baselineVph;
    byHour.set(sample.localHour, bucket);
  }

  if (usable < config.minSamples) {
    return {
      status: 'insufficient_samples',
      usableSampleCount: usable,
      totalSampleCount: valid.length,
      required: config.minSamples,
    };
  }

  const freeFlowShare = freeFlow / usable;
  if (freeFlowShare > config.maxFreeFlowShare) {
    return {
      status: 'insufficient_signal',
      usableSampleCount: usable,
      freeFlowShare,
      maxFreeFlowShare: config.maxFreeFlowShare,
    };
  }

  return {
    status: 'ok',
    growthPct: ((estimatedTotal - baselineTotal) / baselineTotal) * 100,
    usableSampleCount: usable,
    freeFlowSampleCount: freeFlow,
    clampedSampleCount: clamped,
    freeFlowSeconds,
    calibrated: probe.calibrated,
    lanesSource: probe.lanesSource,
    hourly: [...byHour.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, b]) => ({
        hour,
        sampleCount: b.n,
        meanEstimatedVph: b.estimated / b.n,
        meanBaselineVph: b.baseline / b.n,
      })),
  };
}

export type DotTrendComparison =
  | { status: 'no_dot_trend' }
  | {
      status: 'compared';
      /** Latest T_AADT_YOY for the property's MSA, percent per year. */
      dotYoyPct: number;
      /** That trend compounded from the baseline count year to now, percent. */
      dotImpliedGrowthPct: number;
      yearsSinceBaseline: number;
      differencePct: number;
      diverges: boolean;
      signAgrees: boolean;
    };

export function compareWithDotTrend(
  growthPct: number,
  dotYoyPct: number | null,
  yearsSinceBaseline: number,
  thresholdPct: number,
): DotTrendComparison {
  if (dotYoyPct === null || !Number.isFinite(dotYoyPct)) return { status: 'no_dot_trend' };
  const years = Math.max(1, yearsSinceBaseline);
  const dotImpliedGrowthPct = (Math.pow(1 + dotYoyPct / 100, years) - 1) * 100;
  const differencePct = growthPct - dotImpliedGrowthPct;
  return {
    status: 'compared',
    dotYoyPct,
    dotImpliedGrowthPct,
    yearsSinceBaseline: years,
    differencePct,
    diverges: Math.abs(differencePct) > thresholdPct,
    signAgrees: Math.sign(growthPct) === Math.sign(dotImpliedGrowthPct),
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

export type PropertyGrowthEstimate = GrowthEstimate | { status: 'unknown_road_class'; rawRoadClass: string | null };

export interface TrafficGrowthResult {
  propertyId: string;
  computedAt: string;
  /** Whether the growth estimate is published to metric_time_series. */
  estimateEnabled: boolean;
  estimate: PropertyGrowthEstimate;
  dotBaseline: {
    aadt: number;
    measurementYear: number | null;
    stationId: string | null;
    roadClass: RoadClass | null;
    lanes: number | null;
  };
  /** Latest travel-time ratio (in traffic / typical). Null until a sample exists. */
  congestion: { index: number; sampledAt: string } | null;
  dotTrend: DotTrendComparison;
  crossCheck: CrossCheckResult;
  params: Pick<SpeedFlowParams, 'scope' | 'source' | 'calibratedAt'> | null;
  window: { days: number; start: string; end: string; totalSamples: number };
  stored?: { congestion: boolean; growthEstimate: boolean };
}

interface TemporalMultiplierSource {
  getTemporalMultiplier(
    roadClass: string,
    state: string,
    hour: number,
    dayOfWeek: number,
    month: number,
  ): Promise<{ hourly_factor: number; seasonal_factor: number; dow_factor: number }>;
}

export interface TrafficGrowthIndexDeps {
  temporalProfiles?: TemporalMultiplierSource;
  crossCheckProviders?: readonly VolumeCrossCheckProvider[];
  config?: TrafficGrowthConfig;
  isEstimateEnabled?: () => boolean;
  now?: () => Date;
}

/** Ordinal labels for metric_time_series.confidence; not statistical confidence. */
const CONFIDENCE_BY_PARAM_SCOPE: Readonly<Record<SpeedFlowParams['scope'], number>> = {
  default: 0.25,
  road_class: 0.5,
  station: 0.75,
};
const CONGESTION_CONFIDENCE = 0.9;

const UPSERT_METRIC_SQL = `INSERT INTO metric_time_series (
        metric_id, geography_type, geography_id, geography_name,
        period_date, period_type, value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (metric_id, geography_type, geography_id, period_date)
        DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source,
                      confidence = EXCLUDED.confidence, created_at = NOW()`;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export class TrafficGrowthIndexService {
  private readonly temporalProfiles: TemporalMultiplierSource;
  private readonly crossCheckProviders: readonly VolumeCrossCheckProvider[];
  private readonly config: TrafficGrowthConfig;
  private readonly isEstimateEnabled: () => boolean;
  private readonly now: () => Date;

  constructor(private pool: Pool, deps: TrafficGrowthIndexDeps = {}) {
    this.temporalProfiles = deps.temporalProfiles ?? getDotTemporalProfilesService(pool);
    this.crossCheckProviders = deps.crossCheckProviders ?? [];
    this.config = deps.config ?? TRAFFIC_GROWTH_CONFIG;
    this.isEstimateEnabled = deps.isEstimateEnabled ?? (() => isTrafficGrowthEstimateEnabled());
    this.now = deps.now ?? (() => new Date());
  }

  async computeForProperty(propertyId: string): Promise<TrafficGrowthResult | null> {
    const ctx = await this.pool.query(
      `SELECT ptc.primary_adt, ptc.primary_adt_station_id, ptc.primary_road_classification,
              ptc.adt_measurement_year, ptc.state, p.msa_id
       FROM property_traffic_context ptc
       JOIN properties p ON p.id = ptc.property_id
       WHERE ptc.property_id = $1`,
      [propertyId],
    );
    if (ctx.rows.length === 0) return null;

    const row = ctx.rows[0];
    const baselineAadt = parseFloat(row.primary_adt) || 0;
    if (baselineAadt <= 0) return null;

    const now = this.now();
    const windowStart = new Date(now.getTime() - this.config.windowDays * 24 * 60 * 60 * 1000);
    const stationId: string | null = row.primary_adt_station_id ?? null;
    const measurementYear = row.adt_measurement_year ? parseInt(row.adt_measurement_year, 10) : null;
    const roadClass = toRoadClass(row.primary_road_classification);

    const samples = await this.loadSamples(propertyId, windowStart);
    const latest = samples[samples.length - 1];
    const congestion =
      latest && latest.typicalSeconds > 0
        ? {
            index: Math.round((latest.inTrafficSeconds / latest.typicalSeconds) * 1000) / 1000,
            sampledAt: latest.sampledAt,
          }
        : null;

    const base: Omit<TrafficGrowthResult, 'estimate' | 'dotTrend' | 'crossCheck' | 'params'> = {
      propertyId,
      computedAt: now.toISOString(),
      estimateEnabled: this.isEstimateEnabled(),
      dotBaseline: { aadt: baselineAadt, measurementYear, stationId, roadClass, lanes: null },
      congestion,
      window: {
        days: this.config.windowDays,
        start: windowStart.toISOString(),
        end: now.toISOString(),
        totalSamples: samples.length,
      },
    };

    if (!roadClass) {
      return {
        ...base,
        estimate: { status: 'unknown_road_class', rawRoadClass: row.primary_road_classification ?? null },
        dotTrend: { status: 'no_dot_trend' },
        crossCheck: { status: 'no_cross_check' },
        params: null,
      };
    }

    const lanes = await this.loadStationLanes(stationId);
    const params = await this.loadParams(roadClass, stationId);
    const temporal = await this.buildTemporalLookup(roadClass, row.state, samples);
    const estimate = computeGrowthEstimate({ samples, baselineAadt, lanes, params, temporal, config: this.config });

    let dotTrend: DotTrendComparison = { status: 'no_dot_trend' };
    let crossCheck: CrossCheckResult = { status: 'no_cross_check' };
    if (estimate.status === 'ok') {
      const yearsSinceBaseline = measurementYear ? now.getUTCFullYear() - measurementYear : 1;
      dotTrend = compareWithDotTrend(
        estimate.growthPct,
        await this.loadDotYoyPct(row.msa_id),
        yearsSinceBaseline,
        this.config.yoyDivergenceThresholdPct,
      );
      crossCheck = await this.runCrossCheck(propertyId, stationId, estimate.hourly, windowStart, now);
    }

    return {
      ...base,
      dotBaseline: { ...base.dotBaseline, lanes },
      estimate,
      dotTrend,
      crossCheck,
      params: { scope: params.scope, source: params.source, calibratedAt: params.calibratedAt },
    };
  }

  async computeAndStoreForProperty(propertyId: string): Promise<TrafficGrowthResult | null> {
    const result = await this.computeForProperty(propertyId);
    if (!result) return null;

    const periodDate = result.computedAt.split('T')[0];
    const stored = { congestion: false, growthEstimate: false };

    if (result.congestion) {
      await this.pool.query(UPSERT_METRIC_SQL, [
        TRAFFIC_METRIC_IDS.CONGESTION,
        'property',
        propertyId,
        propertyId,
        periodDate,
        'daily',
        result.congestion.index,
        'Google Directions travel-time ratio',
        CONGESTION_CONFIDENCE,
      ]);
      stored.congestion = true;
    }

    if (result.estimateEnabled && result.estimate.status === 'ok' && result.params) {
      await this.pool.query(UPSERT_METRIC_SQL, [
        TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE,
        'property',
        propertyId,
        propertyId,
        periodDate,
        'daily',
        round2(result.estimate.growthPct),
        `Speed-flow volume estimate vs DOT AADT (${result.params.source})`,
        CONFIDENCE_BY_PARAM_SCOPE[result.params.scope],
      ]);
      stored.growthEstimate = true;
    }

    logger.info('[TrafficGrowthIndex] Computed', {
      propertyId,
      estimateStatus: result.estimate.status,
      estimateEnabled: result.estimateEnabled,
      stored,
    });
    return { ...result, stored };
  }

  async computeBatchForSubmarket(submarketGeoId: string): Promise<{
    submarketIndex: number | null;
    propertyCount: number;
    stored: boolean;
    results: TrafficGrowthResult[];
  }> {
    const props = await this.pool.query(
      `SELECT ptc.property_id
       FROM property_traffic_context ptc
       JOIN properties p ON p.id = ptc.property_id
       WHERE p.submarket_id = $1 AND ptc.primary_adt > 0`,
      [submarketGeoId],
    );

    const results: TrafficGrowthResult[] = [];
    for (const row of props.rows) {
      const r = await this.computeForProperty(row.property_id);
      if (r) results.push(r);
    }

    const growthValues: number[] = [];
    let weakestScope: SpeedFlowParams['scope'] = 'station';
    for (const r of results) {
      if (r.estimate.status !== 'ok' || !r.params) continue;
      growthValues.push(r.estimate.growthPct);
      if (CONFIDENCE_BY_PARAM_SCOPE[r.params.scope] < CONFIDENCE_BY_PARAM_SCOPE[weakestScope]) {
        weakestScope = r.params.scope;
      }
    }
    if (growthValues.length === 0) {
      return { submarketIndex: null, propertyCount: 0, stored: false, results };
    }

    const submarketIndex = round2(growthValues.reduce((sum, v) => sum + v, 0) / growthValues.length);
    const enabled = this.isEstimateEnabled();
    if (enabled) {
      await this.pool.query(UPSERT_METRIC_SQL, [
        TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE,
        'submarket',
        submarketGeoId,
        submarketGeoId,
        this.now().toISOString().split('T')[0],
        'daily',
        submarketIndex,
        'Speed-flow volume estimate vs DOT AADT (submarket mean)',
        CONFIDENCE_BY_PARAM_SCOPE[weakestScope],
      ]);
    }

    logger.info('[TrafficGrowthIndex] Submarket computed', {
      submarketGeoId,
      submarketIndex,
      propertyCount: growthValues.length,
      stored: enabled,
    });
    return { submarketIndex, propertyCount: growthValues.length, stored: enabled, results };
  }

  private async loadSamples(propertyId: string, windowStart: Date): Promise<SpeedSample[]> {
    const res = await this.pool.query(
      `SELECT sampled_at, local_hour, local_dow, local_month,
              duration_in_traffic_s, duration_typical_s
       FROM traffic_speed_samples
       WHERE property_id = $1 AND sampled_at >= $2
       ORDER BY sampled_at ASC`,
      [propertyId, windowStart.toISOString()],
    );
    return res.rows.map((r) => ({
      sampledAt: new Date(r.sampled_at).toISOString(),
      localHour: Number(r.local_hour),
      localDayOfWeek: Number(r.local_dow),
      localMonth: Number(r.local_month),
      inTrafficSeconds: Number(r.duration_in_traffic_s),
      typicalSeconds: Number(r.duration_typical_s),
    }));
  }

  private async loadStationLanes(stationId: string | null): Promise<number | null> {
    if (!stationId) return null;
    const res = await this.pool.query(
      `SELECT number_of_lanes
       FROM adt_counts
       WHERE station_id = $1 AND number_of_lanes IS NOT NULL
       ORDER BY measurement_year DESC
       LIMIT 1`,
      [stationId],
    );
    const lanes = res.rows.length > 0 ? Number(res.rows[0].number_of_lanes) : NaN;
    return Number.isFinite(lanes) && lanes > 0 ? lanes : null;
  }

  /** Station-specific parameters win over road-class ones; uncalibrated defaults are the last resort. */
  private async loadParams(roadClass: RoadClass, stationId: string | null): Promise<SpeedFlowParams> {
    const res = await this.pool.query(
      `SELECT scope, alpha, beta, capacity_per_lane_vph, default_lanes, max_vc_ratio,
              source, calibrated_at, sample_count, fit_r2
       FROM traffic_speed_flow_params
       WHERE road_class = $1
         AND ((scope = 'station' AND station_id = $2) OR scope = 'road_class')
       ORDER BY (scope = 'station') DESC, calibrated_at DESC
       LIMIT 1`,
      [roadClass, stationId],
    );
    if (res.rows.length === 0) return defaultSpeedFlowParams(roadClass);
    const r = res.rows[0];
    return {
      roadClass,
      alpha: Number(r.alpha),
      beta: Number(r.beta),
      capacityPerLaneVph: Number(r.capacity_per_lane_vph),
      defaultLanes: Number(r.default_lanes),
      maxVcRatio: Number(r.max_vc_ratio),
      scope: r.scope,
      source: r.source,
      calibratedAt: r.calibrated_at ? new Date(r.calibrated_at).toISOString() : null,
      sampleCount: Number(r.sample_count),
      fitR2: r.fit_r2 === null ? null : Number(r.fit_r2),
    };
  }

  private async buildTemporalLookup(
    roadClass: RoadClass,
    state: string,
    samples: readonly SpeedSample[],
  ): Promise<TemporalLookup> {
    const key = (hour: number, dow: number, month: number): string => `${hour}:${dow}:${month}`;
    const factors = new Map<string, TemporalFactors>();
    for (const s of samples) {
      const k = key(s.localHour, s.localDayOfWeek, s.localMonth);
      if (factors.has(k)) continue;
      const m = await this.temporalProfiles.getTemporalMultiplier(
        roadClass,
        state,
        s.localHour,
        s.localDayOfWeek,
        s.localMonth,
      );
      factors.set(k, { hourlyShare: m.hourly_factor, dowFactor: m.dow_factor, seasonalFactor: m.seasonal_factor });
    }
    return (hour, dow, month) => {
      const found = factors.get(key(hour, dow, month));
      if (!found) throw new Error(`No temporal factors loaded for hour ${hour}, weekday ${dow}, month ${month}`);
      return found;
    };
  }

  private async loadDotYoyPct(msaId: string | number | null): Promise<number | null> {
    if (msaId === null || msaId === undefined) return null;
    const res = await this.pool.query(
      `SELECT value
       FROM metric_time_series
       WHERE metric_id = 'T_AADT_YOY' AND geography_type = 'msa' AND geography_id = $1
       ORDER BY period_date DESC
       LIMIT 1`,
      [String(msaId)],
    );
    if (res.rows.length === 0) return null;
    const value = parseFloat(res.rows[0].value);
    return Number.isFinite(value) ? value : null;
  }

  /** Checks the busiest sampled hour against the first provider that has a reading for it. */
  private async runCrossCheck(
    propertyId: string,
    stationId: string | null,
    hourly: readonly HourlyGrowthBreakdown[],
    windowStart: Date,
    windowEnd: Date,
  ): Promise<CrossCheckResult> {
    if (this.crossCheckProviders.length === 0 || hourly.length === 0) return { status: 'no_cross_check' };
    const busiest = hourly.reduce((a, b) => (b.sampleCount > a.sampleCount ? b : a));
    for (const provider of this.crossCheckProviders) {
      const reading = await provider.getHourlyVolume({
        propertyId,
        stationId,
        hour: busiest.hour,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
      if (reading) {
        return evaluateCrossCheck(busiest.meanEstimatedVph, reading, this.config.crossCheckTolerancePct);
      }
    }
    return { status: 'no_cross_check' };
  }
}
