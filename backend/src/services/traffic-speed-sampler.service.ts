/**
 * Traffic speed sampler (DL-192).
 *
 * Collects travel-time samples at fixed local hours and stores each one with
 * its timestamp and local hour in traffic_speed_samples. The growth index
 * reads a rolling window of these; nothing here feeds google_realtime_factor,
 * which stays owned by the existing daily refresh.
 *
 * Quota: one run samples at most dailySampleBudget / sampleHours.length
 * properties, so a full day of runs stays within dailySampleBudget calls.
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
  STATE_TIME_ZONES,
  TRAFFIC_GROWTH_CONFIG,
  TrafficGrowthConfig,
  localTimeParts,
} from '../config/traffic-growth.config';
import type { RealTimeTrafficResult } from './traffic-data-sources.service';

export interface TravelTimeSource {
  getRealTimeTrafficFactor(lat: number, lng: number): Promise<RealTimeTrafficResult>;
}

export interface SamplerDeps {
  travelTimes: TravelTimeSource;
  config?: TrafficGrowthConfig;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface SamplerRunResult {
  /** States whose local hour is a sample hour for this run. */
  dueStates: string[];
  perRunLimit: number;
  candidates: number;
  sampled: number;
  /** Candidates for which the travel-time source returned no usable durations. */
  skippedNoData: number;
}

/** States whose local clock reads one of the sample hours at `instant`. */
export function statesDueForSample(instant: Date, sampleHours: readonly number[]): string[] {
  return Object.entries(STATE_TIME_ZONES)
    .filter(([, zone]) => sampleHours.includes(localTimeParts(instant, zone).hour))
    .map(([state]) => state)
    .sort();
}

export function perRunSampleLimit(config: Pick<TrafficGrowthConfig, 'dailySampleBudget' | 'sampleHours'>): number {
  if (config.sampleHours.length === 0) return 0;
  return Math.floor(config.dailySampleBudget / config.sampleHours.length);
}

export class TrafficSpeedSamplerService {
  private readonly travelTimes: TravelTimeSource;
  private readonly config: TrafficGrowthConfig;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private pool: Pool, deps: SamplerDeps) {
    this.travelTimes = deps.travelTimes;
    this.config = deps.config ?? TRAFFIC_GROWTH_CONFIG;
    this.now = deps.now ?? (() => new Date());
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async sampleDueProperties(): Promise<SamplerRunResult> {
    const instant = this.now();
    const dueStates = statesDueForSample(instant, this.config.sampleHours);
    const perRunLimit = perRunSampleLimit(this.config);
    const result: SamplerRunResult = { dueStates, perRunLimit, candidates: 0, sampled: 0, skippedNoData: 0 };
    if (dueStates.length === 0 || perRunLimit === 0) return result;

    const hourStart = new Date(instant);
    hourStart.setUTCMinutes(0, 0, 0);

    // Least-recently-sampled first, so coverage rotates when there are more
    // properties than one run can sample.
    const due = await this.pool.query(
      `SELECT ptc.property_id, ptc.state, p.latitude, p.longitude
       FROM property_traffic_context ptc
       JOIN properties p ON p.id = ptc.property_id
       LEFT JOIN LATERAL (
         SELECT MAX(s.sampled_at) AS last_sampled_at
         FROM traffic_speed_samples s
         WHERE s.property_id = ptc.property_id
       ) last ON TRUE
       WHERE ptc.state = ANY($1)
         AND ptc.primary_adt > 0
         AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM traffic_speed_samples s2
           WHERE s2.property_id = ptc.property_id AND s2.sample_hour_start = $2
         )
       ORDER BY last.last_sampled_at ASC NULLS FIRST
       LIMIT $3`,
      [dueStates, hourStart.toISOString(), perRunLimit],
    );
    result.candidates = due.rows.length;

    for (const row of due.rows) {
      const reading = await this.travelTimes.getRealTimeTrafficFactor(
        parseFloat(row.latitude),
        parseFloat(row.longitude),
      );
      const inTraffic = reading.duration_in_traffic;
      const typical = reading.duration_normal;
      if (inTraffic === null || typical === null || inTraffic <= 0 || typical <= 0) {
        result.skippedNoData++;
      } else {
        const sampledAt = this.now();
        const local = localTimeParts(sampledAt, STATE_TIME_ZONES[row.state]);
        await this.pool.query(
          `INSERT INTO traffic_speed_samples (
             property_id, sampled_at, sample_hour_start, time_zone,
             local_hour, local_dow, local_month,
             duration_in_traffic_s, duration_typical_s, vendor
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (property_id, sample_hour_start) DO NOTHING`,
          [
            row.property_id,
            sampledAt.toISOString(),
            hourStart.toISOString(),
            STATE_TIME_ZONES[row.state],
            local.hour,
            local.dayOfWeek,
            local.month,
            inTraffic,
            typical,
            'google_directions',
          ],
        );
        result.sampled++;
      }
      await this.sleep(this.config.requestDelayMs);
    }

    logger.info('[TrafficSpeedSampler] Run complete', { ...result });
    return result;
  }

  /** Drops samples that have left the rolling window. Returns the number removed. */
  async purgeExpiredSamples(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - this.config.windowDays * 24 * 60 * 60 * 1000);
    const res = await this.pool.query(`DELETE FROM traffic_speed_samples WHERE sampled_at < $1`, [
      cutoff.toISOString(),
    ]);
    return res.rowCount ?? 0;
  }
}
