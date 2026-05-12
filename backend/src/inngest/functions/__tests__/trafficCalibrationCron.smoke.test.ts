/**
 * Smoke test — trafficCalibrationCron
 *
 * Verifies the Inngest function is exported and constructed correctly,
 * and that the handler calls job.run with lookbackHours = 168.
 * Does NOT invoke the actual calibration job or touch the database.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Mocks (must precede dynamic import) ────────────────────────────────────

const mockRun = vi.fn().mockResolvedValue({
  buckets_updated: 2,
  buckets_created: 1,
  properties_processed: 5,
  absorption_benchmarks_updated: 3,
  job_version: '1.0.0',
  run_at: new Date(),
});

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
  TrafficCalibrationJob: vi.fn().mockImplementation(() => ({ run: mockRun })),
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

  it('calls job.run with lookbackHours = 168', async () => {
    // step.run executes the callback inline so we can assert on the job mock
    const mockStep = {
      run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const handler = trafficCalibrationCron['handler'] as (ctx: { step: typeof mockStep }) => Promise<unknown>;
    await handler({ step: mockStep });

    expect(mockRun).toHaveBeenCalledWith(168);
  });
});
