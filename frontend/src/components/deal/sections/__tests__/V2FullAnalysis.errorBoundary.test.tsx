/**
 * V2FullAnalysis — per-block error boundary regression test (Task #429).
 *
 * Locks in the guarantee from Task #428: a single broken sub-strategy must
 * NOT take down the entire Strategy view. If a future refactor of
 * V2FullAnalysis or EvidenceReportBlock removes/relocates the per-strategy
 * BlockErrorBoundary, this test fails immediately.
 *
 * How the bad sub-strategy is engineered to crash:
 *   EvidenceReportBlock renders `(tp.keyDrivers || []).map(...)` (line ~913
 *   of StrategyV2Components.tsx). Setting `keyDrivers` to a non-array,
 *   truthy value (e.g. the number 42) bypasses the `|| []` fallback and
 *   throws `TypeError: 42.map is not a function` during render. Marking the
 *   bad sub-strategy as `isDetectedPrimary: true` ensures the evidence
 *   block is expanded on mount so the throw happens immediately.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V2FullAnalysis } from '../StrategyV2Components';
import type {
  StrategyAnalysisV2,
  SubStrategyScore,
} from '../../../../hooks/useStrategyAnalysisV2';

// React + the BlockErrorBoundary log to console.error when a child throws —
// silence it for these tests so the output stays readable.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // Stop the boundary's network log call from polluting the test environment.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
  );
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

// ─── Fixture builders ────────────────────────────────────────────────────────

function makeSubStrategy(
  overrides: Partial<SubStrategyScore> & { key: string; name: string },
): SubStrategyScore {
  return {
    key: overrides.key,
    family: overrides.family ?? 'value_add',
    name: overrides.name,
    isDetectedPrimary: overrides.isDetectedPrimary ?? false,
    isAdjacent: overrides.isAdjacent ?? false,
    gate: { qualified: true, marginal: false, disqualified: false, reasons: [] },
    baseScore: 75,
    timingMultiplier: 1,
    gateAdjustment: 0,
    finalScore: 75,
    disqualified: false,
    financialPreview: {
      irr: 0.18,
      cocReturn: 0.09,
      equityMultiple: 2.1,
      exitCapRate: 0.055,
      holdMonths: 60,
    },
    strategyAssumptions: {},
    signalWeights: {},
    appliedCorrelations: [],
    evidenceReport: {
      subStrategyKey: overrides.key,
      thesis: 'Healthy thesis text.',
      thesisPrompt: {
        headline: 'Healthy headline',
        rationale: 'Healthy rationale',
        keyDrivers: ['driver-a', 'driver-b'],
        riskFactors: ['risk-a'],
        aiCoordinatorContext: 'context',
      },
      metricStack: [],
      compEvidence: { tradeArea: [], likeKind: [] },
      mathTrail: [],
      ultimateReturn: null,
    },
    ...overrides,
  };
}

function makeAnalysis(subStrategies: SubStrategyScore[]): StrategyAnalysisV2 {
  return {
    dealId: 'test-deal',
    computedAt: new Date('2026-01-01').toISOString(),
    detection: {
      assetClass: 'multifamily',
      subType: 'garden',
      detectedDealType: 'value_add',
      detectedSubStrategy: subStrategies[0]?.key ?? '',
      confidence: 0.95,
      // Ungated so the post-detection panels render.
      requiresUserConfirmation: false,
      userConfirmed: true,
      confidenceBreakdown: {
        assessorCode: 0.9, zoningMatch: 0.9, rentRollSignal: 0.9,
        naicsSignal: 0.9, buildingStructure: 0.9,
      },
      detectionSignals: [],
      alternateSubStrategies: [],
    },
    signalScores: { demand: 70, supply: 70, momentum: 70, position: 70, risk: 70, confidence: 95 },
    subStrategies,
    arbitrage: { detected: false, winner: '', detectedPrimary: '', deltaPoints: 0, narrative: '' },
    plan: {
      entry: { targetQuarter: '2026Q2', priceCeiling: 0, rationale: '', debtStructure: '' },
      holdStructure: { targetHoldMonths: 60, rationale: '', exitWindows: [] },
      valueCreation: [],
      capitalSequencing: [],
      exit: { targetQuarter: '2031Q2', buyerType: '', activeBuyers: [], capRate: 0.055, expectedIRR: [0.15, 0.2] },
      monitoring: [],
      pivotConditions: [],
    },
    goldenChain: { phase: 'Discovery', position: 1, description: '', activeSignals: [] },
    correlationAlerts: [],
    indicators: { leading: [], concurrent: [], lagging: [] },
    buyerTargeting: { trafficQuadrant: '', institutionalActivity: 0, suggestedBuyerTypes: [], narrative: '' },
    coordinatorNarrative: '',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('V2FullAnalysis — per-sub-strategy error boundary isolation', () => {
  it('isolates a crashing sub-strategy so other panels and sub-strategies still render', () => {
    const broken = makeSubStrategy({
      key: 'broken_strategy',
      name: 'Broken Strategy',
      // Expanded on mount so the throw fires synchronously during render.
      isDetectedPrimary: true,
    });
    // Inject malformed thesisPrompt to cause `.map is not a function` inside
    // EvidenceReportBlock. Cast through unknown to keep the fixture honest
    // about the runtime-only invariant violation.
    (broken.evidenceReport.thesisPrompt as unknown as { keyDrivers: unknown }).keyDrivers = 42;

    const healthy = makeSubStrategy({
      key: 'healthy_strategy',
      name: 'Healthy Strategy',
      isDetectedPrimary: true, // expand so its evidence content is in the DOM
    });

    const analysis = makeAnalysis([broken, healthy]);

    render(
      <V2FullAnalysis
        analysis={analysis}
        onConfirm={() => {}}
        onAdjust={() => {}}
        onOverride={() => {}}
        dealId="test-deal"
      />,
    );

    // The broken sub-strategy's per-block fallback must be visible…
    expect(screen.getByText(/BLOCK FAILED TO RENDER/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Couldn't render evidence for BROKEN STRATEGY/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // …while the healthy sub-strategy still mounts its evidence panel.
    expect(screen.getByText(/EVIDENCE — HEALTHY STRATEGY/i)).toBeInTheDocument();

    // And sibling top-level panels (also wrapped in their own boundaries)
    // remain on the page — proving one bad block didn't unmount the section.
    expect(screen.getByText(/SUB-STRATEGY COMPARISON/i)).toBeInTheDocument();
    expect(screen.getByText(/SIGNAL × STRATEGY HEATMAP/i)).toBeInTheDocument();
  });

  it('renders all sub-strategies normally when none of them crash', () => {
    const a = makeSubStrategy({ key: 'alpha', name: 'Alpha', isDetectedPrimary: true });
    const b = makeSubStrategy({ key: 'beta', name: 'Beta', isDetectedPrimary: true });
    const analysis = makeAnalysis([a, b]);

    render(
      <V2FullAnalysis
        analysis={analysis}
        onConfirm={() => {}}
        onAdjust={() => {}}
        onOverride={() => {}}
        dealId="test-deal"
      />,
    );

    expect(screen.queryByText(/BLOCK FAILED TO RENDER/i)).not.toBeInTheDocument();
    expect(screen.getByText(/EVIDENCE — ALPHA/i)).toBeInTheDocument();
    expect(screen.getByText(/EVIDENCE — BETA/i)).toBeInTheDocument();
  });
});
