/**
 * Task #515 — UI snapshot/unit tests for the tri-state ExpirationBars
 * renderer. Locks the three visually-distinct states introduced in Task #514:
 *
 *   FAILED  : em-dash + amber warning triangle, NO segmented bar
 *   PARTIAL : 5 colored buckets + 6th hatched UNKNOWN segment
 *   OK      : 5 colored buckets only (legacy 5-segment look)
 *
 * Plus the two pre-existing fallback states (no curve, all-zero buckets) to
 * pin the renderer's behavior across them all in one place.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ExpirationBars } from '../UnitMixTab';

describe('ExpirationBars — Task #515 tri-state rendering', () => {
  it("FAILED state — renders em-dash + warning icon and NO segmented bar", () => {
    const { container, getByTitle } = render(
      <ExpirationBars
        curve={{ months_0_3: 0, months_3_6: 0, months_6_12: 0, months_12_plus: 0, mtm: 0, unknown: 5 }}
        totalUnits={5}
        status="failed"
      />
    );
    // Em-dash readout present
    expect(container.textContent).toContain('—');
    // Tooltip wrapper carries the failed-state hint
    expect(getByTitle(/column not mapped/i)).toBeTruthy();
    // Warning icon (lucide AlertTriangle renders as an <svg>)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
    // No segmented bar children — the failed branch returns early before
    // rendering the segments wrapper. The only divs should be the outer
    // tooltip flex container (no children with width:110 bar).
    const fixedBars = Array.from(container.querySelectorAll('div')).filter(
      d => /width:\s*110px/i.test(d.getAttribute('style') ?? '')
    );
    expect(fixedBars.length).toBe(0);
  });

  it("PARTIAL state — renders 5 colored buckets + 6th hatched UNKNOWN segment", () => {
    const { container } = render(
      <ExpirationBars
        curve={{ months_0_3: 2, months_3_6: 3, months_6_12: 4, months_12_plus: 5, mtm: 1, unknown: 2 }}
        totalUnits={17}
        status="partial"
      />
    );
    // The hatched UNKNOWN segment carries a tooltip with "missing expiration date"
    const hatchedTooltip = container.querySelector('div[title*="missing expiration date"]');
    expect(hatchedTooltip).toBeTruthy();
    // Hatched segment uses repeating-linear-gradient (not a flat bucket color)
    const style = (hatchedTooltip as HTMLElement).getAttribute('style') ?? '';
    expect(style).toMatch(/repeating-linear-gradient/);
    // The 5 colored bucket segments each have their own tooltip with the
    // bucket label format ("MTM:", "0-3 mo:", etc.). All 5 must render.
    const labelTitles = ['MTM:', '0-3 mo:', '3-6 mo:', '6-12 mo:', '12+ mo:'];
    const allTitles = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '');
    for (const t of labelTitles) {
      expect(allTitles.some(a => a.startsWith(t)), `expected tooltip starting "${t}"`).toBe(true);
    }
    // Readout includes the "?" unknown indicator
    expect(container.textContent).toMatch(/2\s*\?/);
  });

  it("OK state — renders 5-segment legacy bar with NO hatched UNKNOWN segment", () => {
    const { container } = render(
      <ExpirationBars
        curve={{ months_0_3: 5, months_3_6: 8, months_6_12: 12, months_12_plus: 20, mtm: 2, unknown: 0 }}
        totalUnits={47}
        status="ok"
      />
    );
    // No hatched UNKNOWN segment
    const hatched = container.querySelector('div[title*="missing expiration date"]');
    expect(hatched).toBeNull();
    // No repeating-linear-gradient styling anywhere
    expect(container.innerHTML).not.toMatch(/repeating-linear-gradient/);
    // All 5 colored buckets render (each has a tooltip)
    const labelTitles = ['MTM:', '0-3 mo:', '3-6 mo:', '6-12 mo:', '12+ mo:'];
    const allTitles = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '');
    for (const t of labelTitles) {
      expect(allTitles.some(a => a.startsWith(t)), `expected tooltip starting "${t}"`).toBe(true);
    }
  });

  it("OK fallback — when status omitted but curve.unknown=0, behaves like 'ok'", () => {
    // Legacy-capsule path: no status field, no unknown nulls. Renderer must
    // fall through to the 5-segment bar without a hatched UNKNOWN segment.
    const { container } = render(
      <ExpirationBars
        curve={{ months_0_3: 1, months_3_6: 1, months_6_12: 1, months_12_plus: 1, mtm: 1 }}
        totalUnits={5}
      />
    );
    expect(container.querySelector('div[title*="missing expiration date"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/repeating-linear-gradient/);
  });

  it("PARTIAL fallback — when status omitted but curve.unknown>0, infers partial and renders hatch", () => {
    // Legacy-capsule path: no status field, but the curve has nulls. The
    // renderer's fallback inference must promote this to partial-style
    // output (hatched 6th segment present).
    const { container } = render(
      <ExpirationBars
        curve={{ months_0_3: 1, months_3_6: 1, months_6_12: 1, months_12_plus: 1, mtm: 0, unknown: 2 }}
        totalUnits={5}
      />
    );
    expect(container.querySelector('div[title*="missing expiration date"]')).toBeTruthy();
    expect(container.innerHTML).toMatch(/repeating-linear-gradient/);
  });

  it("empty placeholder — null curve renders the dashed-border 'no rent roll' state", () => {
    const { container, getByTitle } = render(
      <ExpirationBars curve={null} totalUnits={0} />
    );
    expect(getByTitle(/no lease expiration data available/i)).toBeTruthy();
    // No segment tooltips
    const allTitles = Array.from(container.querySelectorAll('[title]'))
      .map(el => el.getAttribute('title') ?? '');
    expect(allTitles.some(a => a.startsWith('MTM:'))).toBe(false);
  });

  it("all-zero curve — renders the 0/0/0/0/0 zero-state readout", () => {
    const { container } = render(
      <ExpirationBars
        curve={{ months_0_3: 0, months_3_6: 0, months_6_12: 0, months_12_plus: 0, mtm: 0, unknown: 0 }}
        totalUnits={10}
        status="ok"
      />
    );
    expect(container.textContent).toContain('0/0/0/0/0');
  });
});
