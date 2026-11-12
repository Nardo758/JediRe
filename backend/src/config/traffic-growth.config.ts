/**
 * Traffic growth index configuration (DL-192).
 *
 * Metric IDs, feature flags and tunables for the volume-based traffic growth
 * estimate. Everything here is read by traffic-growth-index.service.ts, its
 * sampler and its Inngest job; nothing else should import the tunables.
 */

export const TRAFFIC_METRIC_IDS = {
  /** Volume-based growth estimate vs the DOT AADT baseline. Sole writer: TrafficGrowthIndexService. */
  GROWTH_ESTIMATE: 'C_TRAFFIC_GROWTH_INDEX_EST',
  /** Travel-time ratio (in traffic / typical). A congestion reading, never a growth input. Sole writer: TrafficGrowthIndexService. */
  CONGESTION: 'C_TRAFFIC_CONGESTION_INDEX',
  /** 0–100 normalised search-volume YoY, falling back to AADT YoY. Sole writer: DerivedMetricsService. */
  DEMAND_COMPOSITE: 'C_DEMAND_GROWTH_COMPOSITE',
  /**
   * Legacy ID. Kept as a documented alias of DEMAND_COMPOSITE so presets and the
   * Strategy Builder keep resolving until they are repointed. Sole writer:
   * DerivedMetricsService (mirrors DEMAND_COMPOSITE). TrafficGrowthIndexService
   * no longer writes it.
   */
  LEGACY_GROWTH_INDEX: 'C_TRAFFIC_GROWTH_INDEX',
} as const;

/** Legacy metric ID → the ID that now carries its meaning. */
export const LEGACY_METRIC_ALIASES: Readonly<Record<string, string>> = {
  [TRAFFIC_METRIC_IDS.LEGACY_GROWTH_INDEX]: TRAFFIC_METRIC_IDS.DEMAND_COMPOSITE,
};

export function resolveMetricAlias(metricId: string): string {
  return LEGACY_METRIC_ALIASES[metricId] ?? metricId;
}

/** Metric naming returned by the growth-index API routes. */
export const TRAFFIC_GROWTH_RESPONSE_META = {
  metric: TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE,
  metricName: 'Traffic Growth Index — volume estimate',
  formula:
    '(Estimated hourly volume − DOT baseline hourly volume) / DOT baseline hourly volume × 100, same hour, weekday and month',
  congestionMetric: TRAFFIC_METRIC_IDS.CONGESTION,
  legacyAlias: {
    id: TRAFFIC_METRIC_IDS.LEGACY_GROWTH_INDEX,
    resolvesTo: TRAFFIC_METRIC_IDS.DEMAND_COMPOSITE,
  },
} as const;

/**
 * Publishing the growth estimate to metric_time_series (where P9, the Strategy
 * Builder and presets read) is OFF unless this is exactly 'true'.
 */
export function isTrafficGrowthEstimateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TRAFFIC_GROWTH_INDEX_EST_ENABLED === 'true';
}

/** Collecting speed samples spends Google Directions quota, so it is opt-in as well. */
export function isTrafficSpeedSamplingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TRAFFIC_SPEED_SAMPLING_ENABLED === 'true';
}

export interface TrafficGrowthConfig {
  /** Rolling window of samples used for one estimate. */
  windowDays: number;
  /** Fewer usable samples than this returns "insufficient samples". */
  minSamples: number;
  /** Local hours (0–23) at which samples are taken. Includes one overnight hour to observe free-flow time. */
  sampleHours: readonly number[];
  /** Percentile of in-traffic travel time across the window taken as free-flow time. */
  freeFlowPercentile: number;
  /** An estimate is rejected when more than this share of its samples sit at free flow (volume not identifiable). */
  maxFreeFlowShare: number;
  /** Percentage-point gap between the estimate and DOT YoY AADT that raises the divergence flag. */
  yoyDivergenceThresholdPct: number;
  /** Relative gap (%) between the estimate and a cross-check reading that counts as disagreement. */
  crossCheckTolerancePct: number;
  /** Upper bound on Google Directions calls per day made by the sampler. Matches the existing refresh batch limit. */
  dailySampleBudget: number;
  /** Pause between Google Directions calls. Matches the existing refresh job. */
  requestDelayMs: number;
}

export const TRAFFIC_GROWTH_CONFIG: TrafficGrowthConfig = {
  windowDays: 28,
  minSamples: 12,
  sampleHours: [3, 7, 8, 12, 17],
  freeFlowPercentile: 0.1,
  maxFreeFlowShare: 0.5,
  yoyDivergenceThresholdPct: 10,
  crossCheckTolerancePct: 20,
  dailySampleBudget: 100,
  requestDelayMs: 200,
};

/**
 * IANA time zone per state, used to turn a sample instant into the local hour,
 * weekday and month that the DOT temporal profiles are keyed on. States that
 * span two zones use the zone covering most of their population. A property in
 * an unlisted state is skipped by the sampler instead of being sampled at a
 * guessed hour.
 */
export const STATE_TIME_ZONES: Readonly<Record<string, string>> = {
  AL: 'America/Chicago',
  AR: 'America/Chicago',
  FL: 'America/New_York',
  GA: 'America/New_York',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  MS: 'America/Chicago',
  NC: 'America/New_York',
  SC: 'America/New_York',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  VA: 'America/New_York',
};

export interface LocalTimeParts {
  /** 0–23 */
  hour: number;
  /** 0 = Sunday … 6 = Saturday, matching dot_temporal_profiles 'dow' keys. */
  dayOfWeek: number;
  /** 1–12 */
  month: number;
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function localTimeParts(instant: Date, timeZone: string): LocalTimeParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    weekday: 'short',
    month: 'numeric',
  }).formatToParts(instant);
  const get = (type: string): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`localTimeParts: missing ${type} for zone ${timeZone}`);
    return part.value;
  };
  return {
    hour: Number(get('hour')),
    dayOfWeek: WEEKDAY_INDEX[get('weekday')],
    month: Number(get('month')),
  };
}
