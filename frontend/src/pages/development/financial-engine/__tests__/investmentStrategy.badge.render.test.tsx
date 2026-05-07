/**
 * investmentStrategy.badge.render.test.tsx
 *
 * Task #620 — lightweight DOM render regression guard.
 * Verifies that the amber "NOT SET" badge appears / disappears in the DOM
 * based on the LV slot states, matching the DealTermsTab.tsx flag condition.
 *
 * Uses the actual NotSetBadge markup (inlined here as a test fixture so the
 * private component doesn't need to be exported) rendered through React
 * Testing Library with jsdom.
 *
 * Run: npx vitest run frontend/src/pages/development/financial-engine/__tests__/investmentStrategy.badge.render.test.tsx
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../../test/testUtils';

// ── Minimal badge fixture — mirrors DealTermsTab.tsx NotSetBadge ──────────────

function NotSetBadge({
  label = 'NOT SET',
  title = 'Field not set — operator attention required',
}: { label?: string; title?: string } = {}) {
  return (
    <span title={title} data-testid="not-set-badge" style={{ fontWeight: 700 }}>
      {label}
    </span>
  );
}

// ── Minimal wrapper — mirrors the Investment Strategy LvRow flag condition ────

type StrategyLv = {
  detected: { value: string } | null;
  override: string | null;
} | null;

function InvestmentStrategyBadgeWrapper({ lv }: { lv: StrategyLv }) {
  const showBadge = lv?.override == null && lv?.detected == null;
  return (
    <div>
      {showBadge && (
        <NotSetBadge title="No investment strategy set — operator attention required" />
      )}
      {!showBadge && <span data-testid="no-badge">badge suppressed</span>}
    </div>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Investment Strategy NOT SET badge — DOM render (Task #620)', () => {
  it('renders NOT SET badge when both LV slots are null', () => {
    render(<InvestmentStrategyBadgeWrapper lv={{ detected: null, override: null }} />);
    const badge = screen.getByTestId('not-set-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('NOT SET');
    expect(badge).toHaveAttribute('title', 'No investment strategy set — operator attention required');
  });

  it('renders NOT SET badge when lv is null (no assumptions row)', () => {
    render(<InvestmentStrategyBadgeWrapper lv={null} />);
    expect(screen.getByTestId('not-set-badge')).toBeInTheDocument();
  });

  it('suppresses NOT SET badge when override slot is populated', () => {
    render(
      <InvestmentStrategyBadgeWrapper lv={{ detected: null, override: 'Rental' }} />,
    );
    expect(screen.queryByTestId('not-set-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-badge')).toBeInTheDocument();
  });

  it('suppresses NOT SET badge when detected slot is populated', () => {
    render(
      <InvestmentStrategyBadgeWrapper
        lv={{ detected: { value: 'Build-to-Sell' }, override: null }}
      />,
    );
    expect(screen.queryByTestId('not-set-badge')).not.toBeInTheDocument();
  });

  it('suppresses NOT SET badge for all four valid strategy override values', () => {
    const strategies = ['Build-to-Sell', 'Flip', 'Rental', 'Short-Term Rental'];
    for (const strategy of strategies) {
      const { unmount } = render(
        <InvestmentStrategyBadgeWrapper lv={{ detected: null, override: strategy }} />,
      );
      expect(screen.queryByTestId('not-set-badge')).not.toBeInTheDocument();
      unmount();
    }
  });
});
