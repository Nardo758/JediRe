import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { computeDivergenceRatio } from '../ProFormaSummaryTab';

// ─── Helper unit tests ────────────────────────────────────────────────────────

describe('computeDivergenceRatio', () => {
  it('returns null when broker is null', () => {
    expect(computeDivergenceRatio(null, 250)).toBeNull();
  });

  it('returns null when override is null', () => {
    expect(computeDivergenceRatio(46_400, null)).toBeNull();
  });

  it('returns null when broker is 0 (avoids div-by-zero)', () => {
    expect(computeDivergenceRatio(0, 250)).toBeNull();
  });

  it('returns 0 when broker equals override exactly', () => {
    expect(computeDivergenceRatio(500, 500)).toBe(0);
  });

  it('returns ~0.995 for broker=46400, override=250 (464 Bishop case)', () => {
    const result = computeDivergenceRatio(46_400, 250);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.9946, 3);
  });

  it('returns 0.5 exactly for broker=100, override=150', () => {
    const result = computeDivergenceRatio(100, 150);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.5, 10);
  });
});

// ─── Row render tests (minimal DOM — no full component mount) ─────────────────
//
// These tests exercise the showReservesDivergenceBadge threshold logic by
// calling computeDivergenceRatio directly and asserting the > 0.5 gate, rather
// than mounting the 2 700-line component (which has heavy API and store deps).
// The rendered badge markup is covered by the integration screenshot in the PR.

describe('Replacement Reserves row — divergence badge gate', () => {
  it('shows badge when override is 99% below broker (Bishop case: broker=46400, override=250)', () => {
    const ratio = computeDivergenceRatio(46_400, 250);
    expect(ratio).not.toBeNull();
    expect(ratio! > 0.5).toBe(true);
  });

  it('shows badge when override is 100% above broker (broker=500, override=1000)', () => {
    const ratio = computeDivergenceRatio(500, 1_000);
    expect(ratio).not.toBeNull();
    expect(ratio! > 0.5).toBe(true);
  });

  it('does not show badge when broker is null (Sentosa case — NW-6 null broker layer)', () => {
    const ratio = computeDivergenceRatio(null, 300);
    expect(ratio).toBeNull();
    const show = ratio !== null && ratio > 0.5;
    expect(show).toBe(false);
  });

  it('does not show badge when ratio is exactly 0.5 (boundary — threshold is strictly >)', () => {
    const ratio = computeDivergenceRatio(100, 150);
    expect(ratio).not.toBeNull();
    expect(ratio! > 0.5).toBe(false);
  });

  it('does not show badge when ratio < 0.5 (e.g. broker=1000, override=700, ratio=0.3)', () => {
    const ratio = computeDivergenceRatio(1_000, 700);
    expect(ratio).not.toBeNull();
    expect(ratio! > 0.5).toBe(false);
  });
});
