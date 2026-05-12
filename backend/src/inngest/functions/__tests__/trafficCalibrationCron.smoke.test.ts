/**
 * Smoke test — trafficCalibrationCron
 *
 * Verifies the Inngest function is exported and constructed correctly
 * without invoking the actual calibration job or touching the database.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Mocks (must precede dynamic import) ────────────────────────────────────

vi.mock('../../../lib/inngest', () => {
  const createFunction = vi.fn(
    (config: Record<string, unknown>, handler: unknown) => ({
      __inngestFunction: true,
      id: config['id'],
      name: config['name'],
      triggers: config['triggers'],
      retries: config['retries'],
      handler,
    }),
  );
  return { inngest: { createFunction } };
});

vi.mock('../../../database', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../../../jobs/trafficCalibrationJob', () => ({
  TrafficCalibrationJob: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      buckets_updated: 0,
      buckets_created: 0,
      properties_processed: 0,
      absorption_benchmarks_updated: 0,
      job_version: '1.0.0',
      run_at: new Date(),
    }),
  })),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('trafficCalibrationCron', () => {
  let trafficCalibrationCron: Record<string, unknown>;

  beforeAll(async () => {
    const mod = await import('../trafficCalibrationCron');
    trafficCalibrationCron = mod.trafficCalibrationCron as unknown as Record<string, unknown>;
  });

  it('exports trafficCalibrationCron without throwing', () => {
    expect(trafficCalibrationCron).toBeDefined();
  });

  it('has the correct function id', () => {
    expect(trafficCalibrationCron['id']).toBe('traffic-calibration-weekly');
  });

  it('has the correct display name', () => {
    expect(trafficCalibrationCron['name']).toBe('M07: Weekly Traffic Calibration');
  });

  it('is scheduled for Monday 02:00 UTC', () => {
    const triggers = trafficCalibrationCron['triggers'] as Array<{ cron: string }>;
    expect(Array.isArray(triggers)).toBe(true);
    expect(triggers[0]?.cron).toBe('0 2 * * 1');
  });

  it('uses retries: 1', () => {
    expect(trafficCalibrationCron['retries']).toBe(1);
  });
});
