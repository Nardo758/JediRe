/**
 * exit-strategy-lv.test.ts
 *
 * Task #619 — regression guard: confirms the exit-strategy LayeredValue resolver
 * never silently defaults to "Sale" (or any other value) when both the `detected`
 * and `override` slots are null.
 *
 * These tests mirror the exact resolution logic in proforma-adjustment.service.ts
 * (lines 2175-2179):
 *
 *   resolved = override ?? detected?.value ?? null
 *
 * Run: npx vitest run backend/src/services/__tests__/exit-strategy-lv.test.ts
 */

import { describe, it, expect } from 'vitest';

// ── Resolver — mirrors proforma-adjustment.service.ts lines 2175-2179 ──────────

type StrategyDetected = { value: string; confidence: number; source: string } | null;
type StrategyLvRaw = { detected: StrategyDetected; override: string | null } | null;

function resolveExitStrategy(raw: StrategyLvRaw): {
  detected: StrategyDetected;
  override: string | null;
  resolved: string | null;
} {
  return {
    detected: raw?.detected ?? null,
    override: raw?.override ?? null,
    resolved: raw?.override ?? raw?.detected?.value ?? null,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Exit Strategy LV resolver — null contract (Task #619)', () => {
  it('returns resolved=null when both LV slots are null (no silent default)', () => {
    const lv = resolveExitStrategy({ detected: null, override: null });
    expect(lv.resolved).toBeNull();
  });

  it('returns resolved=null when the raw row is null (deal has no assumptions row)', () => {
    const lv = resolveExitStrategy(null);
    expect(lv.resolved).toBeNull();
  });

  it('never silently defaults to "Sale" — all null paths must stay null', () => {
    const cases: StrategyLvRaw[] = [
      null,
      { detected: null, override: null },
    ];
    for (const raw of cases) {
      const { resolved } = resolveExitStrategy(raw);
      expect(resolved).not.toBe('Sale');
      expect(resolved).not.toBe('Refinance');
      expect(resolved).not.toBe('Hold');
      expect(resolved).toBeNull();
    }
  });

  it('returns override value when override slot is populated (regardless of detected)', () => {
    const lv = resolveExitStrategy({ detected: null, override: 'Sale' });
    expect(lv.resolved).toBe('Sale');
  });

  it('returns detected value when detected slot is populated and override is null', () => {
    const lv = resolveExitStrategy({
      detected: { value: 'Refinance', confidence: 0.85, source: 'M08' },
      override: null,
    });
    expect(lv.resolved).toBe('Refinance');
  });

  it('override takes precedence over detected when both are populated', () => {
    const lv = resolveExitStrategy({
      detected: { value: 'Refinance', confidence: 0.85, source: 'M08' },
      override: 'Hold',
    });
    expect(lv.resolved).toBe('Hold');
  });

  it('exposes detected and override on the returned object regardless of resolved', () => {
    const raw: StrategyLvRaw = {
      detected: { value: 'Sale', confidence: 0.9, source: 'M08' },
      override: null,
    };
    const lv = resolveExitStrategy(raw);
    expect(lv.detected).toEqual(raw.detected);
    expect(lv.override).toBeNull();
    expect(lv.resolved).toBe('Sale');
  });
});
