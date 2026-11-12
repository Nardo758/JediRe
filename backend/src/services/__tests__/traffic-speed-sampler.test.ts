import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  TRAFFIC_GROWTH_CONFIG,
  isTrafficSpeedSamplingEnabled,
  localTimeParts,
} from '../../config/traffic-growth.config';
import {
  TrafficSpeedSamplerService,
  TravelTimeSource,
  perRunSampleLimit,
  statesDueForSample,
} from '../traffic-speed-sampler.service';

// Thursday 12 Nov 2026, 13:05 UTC = 08:05 Eastern (EST), 07:05 Central (CST).
const NOW = new Date('2026-11-12T13:05:00.000Z');

describe('localTimeParts', () => {
  it('gives the hour, weekday and month at the property, not in UTC', () => {
    expect(localTimeParts(NOW, 'America/New_York')).toEqual({ hour: 8, dayOfWeek: 4, month: 11 });
    expect(localTimeParts(NOW, 'America/Chicago')).toEqual({ hour: 7, dayOfWeek: 4, month: 11 });
  });

  it('rolls the weekday and month back across midnight', () => {
    // 03:30 UTC on 1 Dec is 22:30 on Mon 30 Nov in New York.
    expect(localTimeParts(new Date('2026-12-01T03:30:00.000Z'), 'America/New_York')).toEqual({
      hour: 22,
      dayOfWeek: 1,
      month: 11,
    });
  });

  it('follows daylight saving time', () => {
    // 12:00 UTC in July is 08:00 EDT.
    expect(localTimeParts(new Date('2026-07-15T12:00:00.000Z'), 'America/New_York').hour).toBe(8);
  });
});

describe('statesDueForSample', () => {
  it('selects the states whose local hour is a sample hour', () => {
    expect(statesDueForSample(NOW, [8])).toEqual(['FL', 'GA', 'KY', 'NC', 'SC', 'VA']);
    expect(statesDueForSample(NOW, [7])).toEqual(['AL', 'AR', 'LA', 'MS', 'TN', 'TX']);
    expect(statesDueForSample(NOW, [15])).toEqual([]);
  });
});

describe('perRunSampleLimit', () => {
  it('keeps a full day of runs within the daily budget', () => {
    const limit = perRunSampleLimit(TRAFFIC_GROWTH_CONFIG);
    expect(limit).toBe(20);
    expect(limit * TRAFFIC_GROWTH_CONFIG.sampleHours.length).toBeLessThanOrEqual(TRAFFIC_GROWTH_CONFIG.dailySampleBudget);
  });

  it('is zero when there are no sample hours', () => {
    expect(perRunSampleLimit({ dailySampleBudget: 100, sampleHours: [] })).toBe(0);
  });
});

describe('isTrafficSpeedSamplingEnabled', () => {
  it('is off unless the variable is exactly "true"', () => {
    expect(isTrafficSpeedSamplingEnabled({})).toBe(false);
    expect(isTrafficSpeedSamplingEnabled({ TRAFFIC_SPEED_SAMPLING_ENABLED: '1' })).toBe(false);
    expect(isTrafficSpeedSamplingEnabled({ TRAFFIC_SPEED_SAMPLING_ENABLED: 'true' })).toBe(true);
  });
});

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

function buildSampler(
  candidates: Array<{ property_id: string; state: string; latitude: string; longitude: string }>,
  travelTimes: TravelTimeSource,
) {
  const queries: RecordedQuery[] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes('FROM property_traffic_context ptc')) return { rows: candidates };
    if (sql.includes('INSERT INTO traffic_speed_samples')) return { rows: [], rowCount: 1 };
    if (sql.includes('DELETE FROM traffic_speed_samples')) return { rows: [], rowCount: 3 };
    throw new Error(`Unexpected query in test: ${sql}`);
  });
  const sleep = vi.fn(async () => undefined);
  const sampler = new TrafficSpeedSamplerService({ query } as unknown as Pool, {
    travelTimes,
    now: () => NOW,
    sleep,
  });
  return { sampler, queries, sleep };
}

const reading = (inTraffic: number | null, typical: number | null) => ({
  factor: 1,
  duration_in_traffic: inTraffic,
  duration_normal: typical,
  congestion_level: 'low',
  fetched_at: NOW.toISOString(),
});

describe('TrafficSpeedSamplerService', () => {
  const candidates = [
    { property_id: 'p-ga', state: 'GA', latitude: '33.7490', longitude: '-84.3880' },
    { property_id: 'p-tx', state: 'TX', latitude: '32.7767', longitude: '-96.7970' },
  ];

  it('stores each sample with its timestamp, hour bucket and local hour', async () => {
    const travelTimes = { getRealTimeTrafficFactor: vi.fn(async () => reading(131, 118)) };
    const { sampler, queries, sleep } = buildSampler(candidates, travelTimes);

    const result = await sampler.sampleDueProperties();

    expect(result).toMatchObject({ candidates: 2, sampled: 2, skippedNoData: 0, perRunLimit: 20 });
    expect(result.dueStates).toEqual(expect.arrayContaining(['GA', 'TX']));
    expect(travelTimes.getRealTimeTrafficFactor).toHaveBeenCalledWith(33.749, -84.388);

    const inserts = queries.filter((q) => q.sql.includes('INSERT INTO traffic_speed_samples'));
    expect(inserts.map((q) => q.params)).toEqual([
      ['p-ga', NOW.toISOString(), '2026-11-12T13:00:00.000Z', 'America/New_York', 8, 4, 11, 131, 118, 'google_directions'],
      ['p-tx', NOW.toISOString(), '2026-11-12T13:00:00.000Z', 'America/Chicago', 7, 4, 11, 131, 118, 'google_directions'],
    ]);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(TRAFFIC_GROWTH_CONFIG.requestDelayMs);
  });

  it('asks only for due states, skips properties already sampled this hour, and respects the per-run limit', async () => {
    const travelTimes = { getRealTimeTrafficFactor: vi.fn(async () => reading(131, 118)) };
    const { sampler, queries } = buildSampler(candidates, travelTimes);
    await sampler.sampleDueProperties();
    const select = queries.find((q) => q.sql.includes('FROM property_traffic_context ptc'));
    expect(select?.sql).toContain('s2.sample_hour_start = $2');
    expect(select?.params).toEqual([
      ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA'],
      '2026-11-12T13:00:00.000Z',
      20,
    ]);
  });

  it('never stores a sample when the travel-time source has no durations', async () => {
    const travelTimes = { getRealTimeTrafficFactor: vi.fn(async () => reading(null, null)) };
    const { sampler, queries } = buildSampler(candidates, travelTimes);
    const result = await sampler.sampleDueProperties();
    expect(result).toMatchObject({ sampled: 0, skippedNoData: 2 });
    expect(queries.some((q) => q.sql.includes('INSERT INTO traffic_speed_samples'))).toBe(false);
  });

  it('makes no calls outside the sample hours', async () => {
    const travelTimes = { getRealTimeTrafficFactor: vi.fn(async () => reading(131, 118)) };
    const queries: RecordedQuery[] = [];
    const sampler = new TrafficSpeedSamplerService(
      { query: vi.fn(async (sql: string, params: unknown[]) => { queries.push({ sql, params }); return { rows: [] }; }) } as unknown as Pool,
      { travelTimes, now: () => new Date('2026-11-12T20:05:00.000Z'), sleep: async () => undefined },
    );
    const result = await sampler.sampleDueProperties();
    expect(result).toMatchObject({ dueStates: [], candidates: 0, sampled: 0 });
    expect(queries).toHaveLength(0);
    expect(travelTimes.getRealTimeTrafficFactor).not.toHaveBeenCalled();
  });

  it('purges samples older than the rolling window', async () => {
    const travelTimes = { getRealTimeTrafficFactor: vi.fn() };
    const { sampler, queries } = buildSampler([], travelTimes);
    expect(await sampler.purgeExpiredSamples()).toBe(3);
    const cutoff = new Date(NOW.getTime() - TRAFFIC_GROWTH_CONFIG.windowDays * 86_400_000).toISOString();
    expect(queries[0].params).toEqual([cutoff]);
  });

  it('surfaces database errors instead of swallowing them', async () => {
    const travelTimes = { getRealTimeTrafficFactor: vi.fn(async () => reading(131, 118)) };
    const sampler = new TrafficSpeedSamplerService(
      { query: vi.fn(async () => { throw new Error('relation "traffic_speed_samples" does not exist'); }) } as unknown as Pool,
      { travelTimes, now: () => NOW, sleep: async () => undefined },
    );
    await expect(sampler.sampleDueProperties()).rejects.toThrow('does not exist');
  });
});
