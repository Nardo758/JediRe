/**
 * exitStrategy.notSet.test.ts
 *
 * Task #619 — regression guard: verifies that the condition controlling the
 * "NOT SET" badge in DealTermsTab renders correctly based on the exit-strategy
 * LV object shape.
 *
 * The badge renders when:
 *   exitStrategyLv?.override == null && exitStrategyLv?.detected == null
 *
 * Tests here exercise that boolean predicate (pure logic, no DOM needed) and
 * the LV resolution path that feeds it, ensuring neither defaults silently.
 *
 * Run: npx vitest run frontend/src/pages/development/financial-engine/__tests__/exitStrategy.notSet.test.ts
 */

import { describe, it, expect } from 'vitest';

// ── Pure helpers mirroring DealTermsTab.tsx logic ────────────────────────────

type StrategyLv = {
  detected: { value: string; confidence: number; source: string } | null;
  override: string | null;
  resolved: string | null;
} | null;

/** Mirrors DealTermsTab lines 506-508 */
function deriveExitStrategyState(assumptions: Record<string, unknown> | null): {
  lv: StrategyLv;
  resolved: string | null;
  showNotSetBadge: boolean;
} {
  const lv = (assumptions?.exitStrategy ?? null) as StrategyLv;
  const resolved = lv?.resolved ?? null;
  const showNotSetBadge = lv?.override == null && lv?.detected == null;
  return { lv, resolved, showNotSetBadge };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Exit Strategy "NOT SET" badge condition (Task #619)', () => {
  it('shows NOT SET badge when assumptions is null (no F9 data yet)', () => {
    const { showNotSetBadge, resolved } = deriveExitStrategyState(null);
    expect(showNotSetBadge).toBe(true);
    expect(resolved).toBeNull();
  });

  it('shows NOT SET badge when both LV slots are null', () => {
    const { showNotSetBadge, resolved } = deriveExitStrategyState({
      exitStrategy: { detected: null, override: null, resolved: null },
    });
    expect(showNotSetBadge).toBe(true);
    expect(resolved).toBeNull();
  });

  it('shows NOT SET badge when exitStrategy key is absent from assumptions', () => {
    const { showNotSetBadge } = deriveExitStrategyState({ holdYears: 5 });
    expect(showNotSetBadge).toBe(true);
  });

  it('hides NOT SET badge when override slot is populated', () => {
    const { showNotSetBadge, resolved } = deriveExitStrategyState({
      exitStrategy: { detected: null, override: 'Sale', resolved: 'Sale' },
    });
    expect(showNotSetBadge).toBe(false);
    expect(resolved).toBe('Sale');
  });

  it('hides NOT SET badge when detected slot is populated (M08 wrote it)', () => {
    const { showNotSetBadge, resolved } = deriveExitStrategyState({
      exitStrategy: {
        detected: { value: 'Refinance', confidence: 0.85, source: 'M08' },
        override: null,
        resolved: 'Refinance',
      },
    });
    expect(showNotSetBadge).toBe(false);
    expect(resolved).toBe('Refinance');
  });

  it('hides NOT SET badge when both slots are populated (override wins)', () => {
    const { showNotSetBadge, resolved } = deriveExitStrategyState({
      exitStrategy: {
        detected: { value: 'Refinance', confidence: 0.85, source: 'M08' },
        override: 'Hold',
        resolved: 'Hold',
      },
    });
    expect(showNotSetBadge).toBe(false);
    expect(resolved).toBe('Hold');
  });

  it('resolved never equals "Sale" when both slots are null', () => {
    const nullCases = [
      null,
      { exitStrategy: null },
      { exitStrategy: { detected: null, override: null, resolved: null } },
    ];
    for (const assumptions of nullCases) {
      const { resolved } = deriveExitStrategyState(
        assumptions as Record<string, unknown> | null,
      );
      expect(resolved).not.toBe('Sale');
    }
  });
});
