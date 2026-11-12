import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { TRAFFIC_GROWTH_CONFIG, TRAFFIC_METRIC_IDS } from '../../config/traffic-growth.config';
import {
  SpeedSample,
  TemporalFactors,
  TrafficGrowthIndexService,
  baselineHourlyVolume,
  compareWithDotTrend,
  computeGrowthEstimate,
  percentile,
} from '../traffic-growth-index.service';
import { SpeedFlowParams, VolumeCrossCheckProvider, defaultSpeedFlowParams } from '../traffic-volume-estimator';

const PARAMS = defaultSpeedFlowParams('Arterial');
const LANES = 4;
const CAPACITY_VPH = LANES * PARAMS.capacityPerLaneVph;
const AADT = 40000;
const FREE_FLOW_SECONDS = 100;

/** Flat weekday and season factors so a test can vary one thing at a time. */
const HOURLY_SHARE: Record<number, number> = { 3: 0.005, 8: 0.08, 12: 0.068, 17: 0.088 };
const temporal = (hour: number): TemporalFactors => ({
  hourlyShare: HOURLY_SHARE[hour],
  dowFactor: 1,
  seasonalFactor: 1,
});

const inTrafficSecondsFor = (volumeVph: number, params: SpeedFlowParams = PARAMS): number =>
  FREE_FLOW_SECONDS * (1 + params.alpha * Math.pow(volumeVph / CAPACITY_VPH, params.beta));

/** One sample per listed hour per day; daytime volume = baseline × (1 + growth). */
function buildSamples(days: number, growth: number, hours: number[] = [3, 8, 12, 17]): SpeedSample[] {
  const samples: SpeedSample[] = [];
  for (let day = 0; day < days; day++) {
    for (const hour of hours) {
      const baselineVph = AADT * HOURLY_SHARE[hour];
      samples.push({
        sampledAt: new Date(Date.UTC(2026, 10, 1 + day, hour)).toISOString(),
        localHour: hour,
        localDayOfWeek: 2,
        localMonth: 11,
        inTrafficSeconds: hour === 3 ? FREE_FLOW_SECONDS : inTrafficSecondsFor(baselineVph * (1 + growth)),
        typicalSeconds: 105,
      });
    }
  }
  return samples;
}

const CONFIG = { minSamples: 12, freeFlowPercentile: 0.1, maxFreeFlowShare: 0.5 };

describe('baselineHourlyVolume', () => {
  it('normalises the DOT baseline by hour, weekday and season', () => {
    expect(baselineHourlyVolume(20000, { hourlyShare: 0.08, dowFactor: 1, seasonalFactor: 1 })).toBeCloseTo(1600, 9);
    expect(baselineHourlyVolume(20000, { hourlyShare: 0.08, dowFactor: 1.1, seasonalFactor: 1 })).toBeCloseTo(1760, 9);
    expect(baselineHourlyVolume(20000, { hourlyShare: 0.08, dowFactor: 1.1, seasonalFactor: 0.9 })).toBeCloseTo(1584, 9);
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    expect(percentile([5, 1, 4, 2, 3], 0.1)).toBe(1);
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentile([5, 1, 4, 2, 3], 1)).toBe(5);
  });

  it('rejects an empty list and an out-of-range p', () => {
    expect(() => percentile([], 0.5)).toThrow(RangeError);
    expect(() => percentile([1], 1.5)).toThrow(RangeError);
  });
});

describe('computeGrowthEstimate', () => {
  const run = (samples: SpeedSample[], overrides: Partial<typeof CONFIG> = {}) =>
    computeGrowthEstimate({
      samples,
      baselineAadt: AADT,
      lanes: LANES,
      params: PARAMS,
      temporal: (hour) => temporal(hour),
      config: { ...CONFIG, ...overrides },
    });

  it.each([0.1, 0, -0.05])('recovers a known growth of %s against the DOT baseline', (growth) => {
    const estimate = run(buildSamples(7, growth));
    expect(estimate.status).toBe('ok');
    if (estimate.status !== 'ok') return;
    expect(estimate.growthPct).toBeCloseTo(growth * 100, 6);
    expect(estimate.freeFlowSeconds).toBe(FREE_FLOW_SECONDS);
    expect(estimate.usableSampleCount).toBe(21);
    expect(estimate.calibrated).toBe(false);
    expect(estimate.lanesSource).toBe('dot_station');
  });

  it('compares each hour with the baseline for that hour', () => {
    const estimate = run(buildSamples(7, 0.1));
    if (estimate.status !== 'ok') throw new Error('expected ok');
    expect(estimate.hourly.map((h) => h.hour)).toEqual([8, 12, 17]);
    for (const h of estimate.hourly) {
      expect(h.sampleCount).toBe(7);
      expect(h.meanBaselineVph).toBeCloseTo(AADT * HOURLY_SHARE[h.hour], 6);
      expect(h.meanEstimatedVph).toBeCloseTo(AADT * HOURLY_SHARE[h.hour] * 1.1, 4);
    }
  });

  it('applies weekday and season factors to the baseline side', () => {
    // Volume is exactly the unadjusted baseline; a 1.25 weekday factor raises
    // the baseline, so the same traffic reads as 20% below it.
    const estimate = computeGrowthEstimate({
      samples: buildSamples(7, 0),
      baselineAadt: AADT,
      lanes: LANES,
      params: PARAMS,
      temporal: (hour) => ({ ...temporal(hour), dowFactor: hour === 3 ? 1 : 1.25 }),
      config: CONFIG,
    });
    if (estimate.status !== 'ok') throw new Error('expected ok');
    expect(estimate.growthPct).toBeCloseTo(-20, 6);
  });

  it('returns insufficient samples below the minimum count', () => {
    const estimate = run(buildSamples(2, 0.1));
    expect(estimate).toEqual({ status: 'insufficient_samples', usableSampleCount: 0, totalSampleCount: 8, required: 12 });
  });

  it('does not count overnight samples toward the minimum', () => {
    // 16 samples in total, but only 8 are at hours where speed carries a volume signal.
    const estimate = run(buildSamples(8, 0.1, [3, 17]));
    expect(estimate).toEqual({ status: 'insufficient_samples', usableSampleCount: 8, totalSampleCount: 16, required: 12 });
  });

  it('ignores samples with no travel time', () => {
    const broken = buildSamples(7, 0.1).map((s, i) => (i % 2 === 0 ? { ...s, inTrafficSeconds: 0 } : s));
    const estimate = run(broken, { minSamples: 15 });
    expect(estimate.status).toBe('insufficient_samples');
  });

  it('returns insufficient signal when most usable samples sit at free flow', () => {
    const flat = buildSamples(7, 0).map((s) => ({ ...s, inTrafficSeconds: FREE_FLOW_SECONDS }));
    const estimate = run(flat);
    expect(estimate).toMatchObject({ status: 'insufficient_signal', usableSampleCount: 21, freeFlowShare: 1 });
  });

  it('counts clamped samples', () => {
    const jammed = buildSamples(7, 0).map((s) =>
      s.localHour === 17 ? { ...s, inTrafficSeconds: FREE_FLOW_SECONDS * 3 } : s,
    );
    const estimate = run(jammed);
    if (estimate.status !== 'ok') throw new Error('expected ok');
    expect(estimate.clampedSampleCount).toBe(7);
  });

  it('rejects a non-positive baseline', () => {
    expect(() =>
      computeGrowthEstimate({
        samples: [],
        baselineAadt: 0,
        lanes: LANES,
        params: PARAMS,
        temporal: (hour) => temporal(hour),
        config: CONFIG,
      }),
    ).toThrow(RangeError);
  });
});

describe('compareWithDotTrend', () => {
  it('reports no trend when DOT has none', () => {
    expect(compareWithDotTrend(5, null, 2, 10)).toEqual({ status: 'no_dot_trend' });
  });

  it('compounds the DOT trend from the baseline year', () => {
    const comparison = compareWithDotTrend(6, 3, 2, 10);
    if (comparison.status !== 'compared') throw new Error('expected compared');
    expect(comparison.dotImpliedGrowthPct).toBeCloseTo(6.09, 6);
    expect(comparison.differencePct).toBeCloseTo(-0.09, 6);
    expect(comparison.diverges).toBe(false);
    expect(comparison.signAgrees).toBe(true);
  });

  it('flags divergence past the threshold and honours a different threshold', () => {
    expect(compareWithDotTrend(25, 3, 1, 10)).toMatchObject({ diverges: true, differencePct: expect.closeTo(22, 6) });
    expect(compareWithDotTrend(25, 3, 1, 30)).toMatchObject({ diverges: false });
  });

  it('reports sign disagreement', () => {
    expect(compareWithDotTrend(-4, 3, 1, 10)).toMatchObject({ signAgrees: false, diverges: false });
  });

  it('treats a baseline from the current year as one year old', () => {
    expect(compareWithDotTrend(3, 3, 0, 10)).toMatchObject({
      yearsSinceBaseline: 1,
      dotImpliedGrowthPct: expect.closeTo(3, 6),
    });
  });
});

// ─── Service, against an in-memory pool ─────────────────────────────────────

interface FakeDb {
  context: Record<string, unknown> | null;
  samples: SpeedSample[];
  lanes: number | null;
  paramsRow: Record<string, unknown> | null;
  dotYoy: number | null;
}

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

function fakePool(db: FakeDb): { pool: Pool; queries: RecordedQuery[]; metricWrites: () => unknown[][] } {
  const queries: RecordedQuery[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes('FROM property_traffic_context ptc') && sql.includes('WHERE ptc.property_id')) {
      return { rows: db.context ? [db.context] : [] };
    }
    if (sql.includes('FROM traffic_speed_samples')) {
      return {
        rows: db.samples.map((s) => ({
          sampled_at: s.sampledAt,
          local_hour: s.localHour,
          local_dow: s.localDayOfWeek,
          local_month: s.localMonth,
          duration_in_traffic_s: s.inTrafficSeconds,
          duration_typical_s: s.typicalSeconds,
        })),
      };
    }
    if (sql.includes('FROM adt_counts')) {
      return { rows: db.lanes === null ? [] : [{ number_of_lanes: db.lanes }] };
    }
    if (sql.includes('FROM traffic_speed_flow_params')) {
      return { rows: db.paramsRow ? [db.paramsRow] : [] };
    }
    if (sql.includes("metric_id = 'T_AADT_YOY'")) {
      return { rows: db.dotYoy === null ? [] : [{ value: String(db.dotYoy) }] };
    }
    if (sql.includes('INSERT INTO metric_time_series')) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query in test: ${sql}`);
  });
  return {
    pool: { query } as unknown as Pool,
    queries,
    metricWrites: () => queries.filter((q) => q.sql.includes('INSERT INTO metric_time_series')).map((q) => q.params),
  };
}

const NOW = new Date('2026-11-12T18:00:00.000Z');

const CONTEXT = {
  primary_adt: '40000',
  primary_adt_station_id: 'GA-1234',
  primary_road_classification: 'Principal Arterial',
  adt_measurement_year: '2024',
  state: 'GA',
  msa_id: 12060,
};

const temporalProfiles = {
  getTemporalMultiplier: vi.fn(async (_roadClass: string, _state: string, hour: number) => ({
    hourly_factor: HOURLY_SHARE[hour],
    dow_factor: 1,
    seasonal_factor: 1,
  })),
};

function buildService(db: Partial<FakeDb>, options: { enabled: boolean; providers?: VolumeCrossCheckProvider[] }) {
  const fake = fakePool({
    context: CONTEXT,
    samples: buildSamples(7, 0.1),
    lanes: LANES,
    paramsRow: null,
    dotYoy: 3,
    ...db,
  });
  const service = new TrafficGrowthIndexService(fake.pool, {
    temporalProfiles,
    crossCheckProviders: options.providers,
    isEstimateEnabled: () => options.enabled,
    now: () => NOW,
  });
  return { service, ...fake };
}

describe('TrafficGrowthIndexService', () => {
  it('returns null when the property has no traffic context or no DOT baseline', async () => {
    expect(await buildService({ context: null }, { enabled: true }).service.computeForProperty('p1')).toBeNull();
    const zeroAdt = buildService({ context: { ...CONTEXT, primary_adt: '0' } }, { enabled: true });
    expect(await zeroAdt.service.computeForProperty('p1')).toBeNull();
  });

  it('reads a rolling window of samples ending now', async () => {
    const { service, queries } = buildService({}, { enabled: false });
    const result = await service.computeForProperty('p1');
    const sampleQuery = queries.find((q) => q.sql.includes('FROM traffic_speed_samples'));
    const expectedStart = new Date(NOW.getTime() - TRAFFIC_GROWTH_CONFIG.windowDays * 86_400_000).toISOString();
    expect(sampleQuery?.params).toEqual(['p1', expectedStart]);
    expect(result?.window).toMatchObject({ days: 28, start: expectedStart, end: NOW.toISOString(), totalSamples: 28 });
  });

  it('computes growth, the DOT trend comparison and the congestion reading', async () => {
    const { service } = buildService({}, { enabled: false });
    const result = await service.computeForProperty('p1');
    if (!result || result.estimate.status !== 'ok') throw new Error('expected an ok estimate');
    expect(result.estimate.growthPct).toBeCloseTo(10, 6);
    expect(result.dotBaseline).toEqual({
      aadt: 40000,
      measurementYear: 2024,
      stationId: 'GA-1234',
      roadClass: 'Arterial',
      lanes: LANES,
    });
    // 3% a year compounded over 2024 → 2026.
    expect(result.dotTrend).toMatchObject({ status: 'compared', dotYoyPct: 3, yearsSinceBaseline: 2, diverges: false });
    expect(result.params).toEqual({ scope: 'default', source: 'uncalibrated_default', calibratedAt: null });
    expect(result.crossCheck).toEqual({ status: 'no_cross_check' });
    expect(result.congestion?.index).toBeCloseTo(inTrafficSecondsFor(AADT * 0.088 * 1.1) / 105, 3);
  });

  it('flags divergence from the DOT trend', async () => {
    const { service } = buildService({ samples: buildSamples(7, 0.3) }, { enabled: false });
    const result = await service.computeForProperty('p1');
    expect(result?.dotTrend).toMatchObject({ status: 'compared', diverges: true, signAgrees: true });
  });

  it('prefers stored parameters over the defaults', async () => {
    const paramsRow = {
      scope: 'station',
      alpha: PARAMS.alpha,
      beta: PARAMS.beta,
      capacity_per_lane_vph: PARAMS.capacityPerLaneVph,
      default_lanes: PARAMS.defaultLanes,
      max_vc_ratio: PARAMS.maxVcRatio,
      source: 'fit:dot_hourly_counts',
      calibrated_at: '2026-10-01T00:00:00.000Z',
      sample_count: 40,
      fit_r2: 0.9,
    };
    const { service, queries } = buildService({ paramsRow }, { enabled: false });
    const result = await service.computeForProperty('p1');
    expect(queries.find((q) => q.sql.includes('FROM traffic_speed_flow_params'))?.params).toEqual(['Arterial', 'GA-1234']);
    expect(result?.params).toEqual({
      scope: 'station',
      source: 'fit:dot_hourly_counts',
      calibratedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(result?.estimate).toMatchObject({ status: 'ok', calibrated: true });
  });

  it('reports an unknown road class instead of assuming one', async () => {
    const { service } = buildService(
      { context: { ...CONTEXT, primary_road_classification: 'Ramp' } },
      { enabled: true },
    );
    const result = await service.computeForProperty('p1');
    expect(result?.estimate).toEqual({ status: 'unknown_road_class', rawRoadClass: 'Ramp' });
    expect(result?.params).toBeNull();
  });

  it('with the flag off stores congestion on its own ID and never publishes growth', async () => {
    const { service, metricWrites } = buildService({}, { enabled: false });
    const result = await service.computeAndStoreForProperty('p1');
    expect(result?.estimate.status).toBe('ok');
    expect(result?.stored).toEqual({ congestion: true, growthEstimate: false });
    const writes = metricWrites();
    expect(writes.map((w) => w[0])).toEqual([TRAFFIC_METRIC_IDS.CONGESTION]);
    expect(writes[0].slice(1, 6)).toEqual(['property', 'p1', 'p1', '2026-11-12', 'daily']);
  });

  it('with the flag on publishes growth under the estimate ID and nothing under the legacy ID', async () => {
    const { service, metricWrites } = buildService({}, { enabled: true });
    const result = await service.computeAndStoreForProperty('p1');
    expect(result?.stored).toEqual({ congestion: true, growthEstimate: true });
    const writes = metricWrites();
    expect(writes.map((w) => w[0])).toEqual([TRAFFIC_METRIC_IDS.CONGESTION, TRAFFIC_METRIC_IDS.GROWTH_ESTIMATE]);
    expect(writes[1][6]).toBe(10);
    expect(writes.some((w) => w[0] === TRAFFIC_METRIC_IDS.LEGACY_GROWTH_INDEX)).toBe(false);
  });

  it('does not publish an estimate that is not ok, even with the flag on', async () => {
    const { service, metricWrites } = buildService({ samples: buildSamples(2, 0.1) }, { enabled: true });
    const result = await service.computeAndStoreForProperty('p1');
    expect(result?.estimate.status).toBe('insufficient_samples');
    expect(result?.stored).toEqual({ congestion: true, growthEstimate: false });
    expect(metricWrites().map((w) => w[0])).toEqual([TRAFFIC_METRIC_IDS.CONGESTION]);
  });

  it('uses a registered cross-check provider for the busiest hour', async () => {
    const provider: VolumeCrossCheckProvider = {
      name: 'test-counter',
      getHourlyVolume: vi.fn(async () => ({
        source: 'dot_continuous_counter',
        volumeVph: AADT * 0.08,
        observedAt: NOW.toISOString(),
      })),
    };
    const { service } = buildService({}, { enabled: false, providers: [provider] });
    const result = await service.computeForProperty('p1');
    expect(provider.getHourlyVolume).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'p1', stationId: 'GA-1234', hour: 8 }),
    );
    expect(result?.crossCheck).toMatchObject({ status: 'agree', source: 'dot_continuous_counter' });
  });

  it('surfaces database errors instead of swallowing them', async () => {
    const { service, pool } = buildService({}, { enabled: false });
    (pool.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('relation does not exist'));
    await expect(service.computeForProperty('p1')).rejects.toThrow('relation does not exist');
  });
});
