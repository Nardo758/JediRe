/**
 * investmentStrategy.notSet.test.ts
 *
 * Task #620 — regression guard: verifies that the condition controlling the
 * "NOT SET" badge in DealTermsTab renders correctly based on the investment-strategy
 * LV object shape.
 *
 * Mirrors exitStrategy.notSet.test.ts from Task #619 — same badge condition,
 * different LV field (investmentStrategyLv vs exitStrategyLv).
 *
 * Run: npx vitest run frontend/src/pages/development/financial-engine/__tests__/investmentStrategy.notSet.test.ts
 */

import { describe, it, expect } from 'vitest';

// ── Pure helpers mirroring DealTermsTab.tsx logic ────────────────────────────

type StrategyLv = {
  detected: { value: string; confidence: number; source: string } | null;
  override: string | null;
  resolved: string | null;
} | null;

/** Mirrors DealTermsTab lines 506-509 (investmentStrategyLv path) */
function deriveInvestmentStrategyState(assumptions: Record<string, unknown> | null): {
  lv: StrategyLv;
  resolved: string | null;
  showNotSetBadge: boolean;
} {
  const lv = (assumptions?.investmentStrategy ?? null) as StrategyLv;
  const resolved = lv?.resolved ?? null;
  const showNotSetBadge = lv?.override == null && lv?.detected == null;
  return { lv, resolved, showNotSetBadge };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Investment Strategy "NOT SET" badge condition (Task #620)', () => {
  it('shows NOT SET badge when assumptions is null (no F9 data yet)', () => {
    const { showNotSetBadge, resolved } = deriveInvestmentStrategyState(null);
    expect(showNotSetBadge).toBe(true);
    expect(resolved).toBeNull();
  });

  it('shows NOT SET badge when both LV slots are null', () => {
    const { showNotSetBadge, resolved } = deriveInvestmentStrategyState({
      investmentStrategy: { detected: null, override: null, resolved: null },
    });
    expect(showNotSetBadge).toBe(true);
    expect(resolved).toBeNull();
  });

  it('shows NOT SET badge when investmentStrategy key is absent from assumptions', () => {
    const { showNotSetBadge } = deriveInvestmentStrategyState({ holdYears: 5 });
    expect(showNotSetBadge).toBe(true);
  });

  it('hides NOT SET badge when override slot is populated', () => {
    const { showNotSetBadge, resolved } = deriveInvestmentStrategyState({
      investmentStrategy: { detected: null, override: 'Rental', resolved: 'Rental' },
    });
    expect(showNotSetBadge).toBe(false);
    expect(resolved).toBe('Rental');
  });

  it('hides NOT SET badge when detected slot is populated (M08 wrote it)', () => {
    const { showNotSetBadge, resolved } = deriveInvestmentStrategyState({
      investmentStrategy: {
        detected: { value: 'Build-to-Sell', confidence: 0.82, source: 'M08' },
        override: null,
        resolved: 'Build-to-Sell',
      },
    });
    expect(showNotSetBadge).toBe(false);
    expect(resolved).toBe('Build-to-Sell');
  });

  it('hides NOT SET badge when both slots are populated (override wins)', () => {
    const { showNotSetBadge, resolved } = deriveInvestmentStrategyState({
      investmentStrategy: {
        detected: { value: 'Build-to-Sell', confidence: 0.82, source: 'M08' },
        override: 'Flip',
        resolved: 'Flip',
      },
    });
    expect(showNotSetBadge).toBe(false);
    expect(resolved).toBe('Flip');
  });

  it('resolved never equals a default strategy value when both slots are null', () => {
    const silentDefaults = ['Rental', 'Build-to-Sell', 'Flip', 'Short-Term Rental'];
    const nullCases = [
      null,
      { investmentStrategy: null },
      { investmentStrategy: { detected: null, override: null, resolved: null } },
    ];
    for (const assumptions of nullCases) {
      const { resolved } = deriveInvestmentStrategyState(
        assumptions as Record<string, unknown> | null,
      );
      for (const def of silentDefaults) {
        expect(resolved).not.toBe(def);
      }
      expect(resolved).toBeNull();
    }
  });

  it('all four valid strategy values suppress the badge when set as override', () => {
    const validStrategies = ['Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental'];
    for (const strategy of validStrategies) {
      const { showNotSetBadge, resolved } = deriveInvestmentStrategyState({
        investmentStrategy: { detected: null, override: strategy, resolved: strategy },
      });
      expect(showNotSetBadge).toBe(false);
      expect(resolved).toBe(strategy);
    }
  });
});
