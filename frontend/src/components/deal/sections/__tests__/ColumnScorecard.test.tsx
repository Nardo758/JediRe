/**
 * Task #516 — Tests for the inline per-column extraction scorecard.
 *
 * Confirms:
 *   - Renders only when a non-empty coverage map is supplied (the parent
 *     component gates on this; here we exercise the renderer directly).
 *   - All 7 critical columns appear as pills in a stable order.
 *   - Each of the 5 statuses produces a distinguishable pill (visual or
 *     tooltip), with `fallback` and `not_supported` rendering distinctly
 *     from the ok / missing / all_null trio per the task spec.
 *
 * The component is tested indirectly through UnitMixTab to avoid having to
 * export ColumnScorecard. We assert against the conditional render output
 * by mounting the parent and supplying coverage via the data prop... but
 * UnitMixTab fetches via API, so direct mounting is heavyweight. Instead
 * we mount the renderer through the same export pattern we used for
 * ExpirationBars in Task #515 — re-exporting the component is a small,
 * test-only surface that mirrors the established pattern.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColumnScorecard } from '../UnitMixTab';

const ALL_OK = {
  unit_no: 'ok',
  unit_type: 'ok',
  sqft: 'ok',
  market_rent: 'ok',
  charge_code: 'ok',
  amount: 'ok',
  lease_expiration: 'ok',
};

describe('ColumnScorecard — Task #516 inline extraction scorecard', () => {
  it('renders the SCORECARD label and all 7 critical-column pills', () => {
    const { getByText } = render(<ColumnScorecard coverage={ALL_OK} />);
    expect(getByText('EXTRACTION SCORECARD')).toBeTruthy();
    for (const label of ['UNIT #', 'UNIT TYPE', 'SQ FT', 'MKT RENT', 'CHG CODE', 'AMOUNT', 'LEASE END']) {
      expect(getByText(label), `expected pill with label "${label}"`).toBeTruthy();
    }
  });

  it("ok status — pill carries the green-dot tooltip and no warning copy", () => {
    const { container } = render(<ColumnScorecard coverage={{ unit_no: 'ok' }} />);
    const tooltips = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '');
    const okTip = tooltips.find(t => t.startsWith('UNIT #:'));
    expect(okTip).toBeDefined();
    expect(okTip).toMatch(/mapped from header/i);
  });

  it("missing status — tooltip explains 'no header AND no data' + recommends re-export", () => {
    const { container } = render(<ColumnScorecard coverage={{ market_rent: 'missing' }} />);
    const tooltips = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '');
    const tip = tooltips.find(t => t.startsWith('MKT RENT:'));
    expect(tip).toBeDefined();
    expect(tip).toMatch(/could not locate this column/i);
    expect(tip).toMatch(/Yardi/i);
  });

  it("all_null status — tooltip explains 'header found, every row empty'", () => {
    const { container } = render(<ColumnScorecard coverage={{ amount: 'all_null' }} />);
    const tip = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '')
      .find(t => t.startsWith('AMOUNT:'));
    expect(tip).toBeDefined();
    expect(tip).toMatch(/header found/i);
    expect(tip).toMatch(/null|empty/i);
  });

  it("fallback status — DISTINCT from ok: amber background and provenance-warning tooltip", () => {
    const { container } = render(<ColumnScorecard coverage={{ sqft: 'fallback' }} />);
    const pill = Array.from(container.querySelectorAll('[title]'))
      .find(el => (el.getAttribute('title') ?? '').startsWith('SQ FT:'));
    expect(pill).toBeTruthy();
    const style = (pill as HTMLElement).getAttribute('style') ?? '';
    // Amber background distinguishes fallback from the dark default pill.
    // jsdom normalizes #1a0d00 → rgb(26, 13, 0). Match either form.
    expect(style).toMatch(/background:\s*(#1a0d00|rgb\(26,\s*13,\s*0\))/i);
    expect((pill as HTMLElement).getAttribute('title')).toMatch(/hardcoded.*position|provenance is weak/i);
  });

  it("not_supported status — DISTINCT from ok: dashed border + 'structurally cannot' tooltip", () => {
    const { container } = render(<ColumnScorecard coverage={{ lease_expiration: 'not_supported' }} />);
    const pill = Array.from(container.querySelectorAll('[title]'))
      .find(el => (el.getAttribute('title') ?? '').startsWith('LEASE END:'));
    expect(pill).toBeTruthy();
    const style = (pill as HTMLElement).getAttribute('style') ?? '';
    // Dashed border distinguishes not_supported from any solid-border pill.
    expect(style).toMatch(/border:\s*1px\s+dashed/i);
    expect((pill as HTMLElement).getAttribute('title')).toMatch(/structurally cannot/i);
  });

  it("renders pills in the documented column order (regression guard)", () => {
    const { container } = render(<ColumnScorecard coverage={ALL_OK} />);
    // Pills are flex children of the scorecard container. Skip the leading
    // "EXTRACTION SCORECARD" label by matching only elements that have a
    // non-empty title attribute (the label uses title too — for that one
    // we filter by content).
    const pillTexts = Array.from(container.querySelectorAll('[title]'))
      .filter(el => (el.textContent ?? '').trim() !== 'EXTRACTION SCORECARD')
      .map(el => (el.textContent ?? '').trim());
    expect(pillTexts).toEqual(['UNIT #', 'UNIT TYPE', 'SQ FT', 'MKT RENT', 'CHG CODE', 'AMOUNT', 'LEASE END']);
  });

  it("handles a missing key in the coverage map by treating it as 'missing'", () => {
    // Defensive default: if the backend ever drops a key from column_coverage
    // (e.g. schema drift), we render the pill as missing rather than crash.
    const { container } = render(<ColumnScorecard coverage={{ unit_no: 'ok' }} />);
    const tip = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '')
      .find(t => t.startsWith('SQ FT:'));
    expect(tip).toMatch(/could not locate this column/i);
  });
});
