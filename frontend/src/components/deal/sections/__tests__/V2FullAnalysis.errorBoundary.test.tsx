/**
 * Regression test for Task #428: a single broken sub-strategy must not take
 * down V2FullAnalysis. If a future refactor removes the per-strategy
 * BlockErrorBoundary, this test fails.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V2FullAnalysis } from '../StrategyV2Components';
import type {
  StrategyAnalysisV2,
  SubStrategyScore,
} from '../../../../hooks/useStrategyAnalysisV2';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))));
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function makeSubStrategy(opts: {
  key: string;
  name: string;
  isDetectedPrimary?: boolean;
  /** When true, corrupt the fixture so EvidenceReportBlock throws on render. */
  crash?: boolean;
}): SubStrategyScore {
  // EvidenceReportBlock renders `(thesisPrompt.keyDrivers || []).map(...)`.
  // A non-array truthy value bypasses the `|| []` fallback and throws.
  const keyDrivers: string[] = opts.crash
    ? (42 as unknown as string[])
    : ['driver-a', 'driver-b'];

  return {
    key: opts.key,
    family: 'value_add',
    name: opts.name,
    isDetectedPrimary: opts.isDetectedPrimary ?? false,
    isAdjacent: false,
    gate: { qualified: true, marginal: false, disqualified: false, reasons: [] },
    baseScore: 75,
    timingMultiplier: 1,
    gateAdjustment: 0,
    finalScore: 75,
    disqualified: false,
    financialPreview: { irr: 0.18, cocReturn: 0.09, equityMultiple: 2.1, exitCapRate: 0.055, holdMonths: 60 },
    strategyAssumptions: {},
    signalWeights: {},
    appliedCorrelations: [],
    evidenceReport: {
      subStrategyKey: opts.key,
      thesis: 'Thesis text.',
      thesisPrompt: {
        headline: 'Headline',
        rationale: 'Rationale',
        keyDrivers,
        riskFactors: ['risk-a'],
        aiCoordinatorContext: 'context',
      },
      metricStack: [],
      compEvidence: { tradeArea: [], likeKind: [] },
      mathTrail: [],
      ultimateReturn: null,
    },
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

const renderV2 = (analysis: StrategyAnalysisV2) =>
  render(
    <V2FullAnalysis
      analysis={analysis}
      onConfirm={() => {}}
      onAdjust={() => {}}
      onOverride={() => {}}
      dealId="test-deal"
    />,
  );

describe('V2FullAnalysis per-sub-strategy error isolation', () => {
  it('shows the fallback for a broken sub-strategy and still renders the healthy one', () => {
    const broken = makeSubStrategy({ key: 'broken_strategy', name: 'Broken Strategy', isDetectedPrimary: true, crash: true });
    const healthy = makeSubStrategy({ key: 'healthy_strategy', name: 'Healthy Strategy', isDetectedPrimary: true });

    renderV2(makeAnalysis([broken, healthy]));

    expect(screen.getByText(/BLOCK FAILED TO RENDER/i)).toBeInTheDocument();
    expect(screen.getByText(/Couldn't render evidence for BROKEN STRATEGY/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText(/EVIDENCE — HEALTHY STRATEGY/i)).toBeInTheDocument();
    expect(screen.getByText(/SUB-STRATEGY COMPARISON/i)).toBeInTheDocument();
    expect(screen.getByText(/SIGNAL × STRATEGY HEATMAP/i)).toBeInTheDocument();
  });

  it('renders all sub-strategies normally when none crash', () => {
    const a = makeSubStrategy({ key: 'alpha', name: 'Alpha', isDetectedPrimary: true });
    const b = makeSubStrategy({ key: 'beta', name: 'Beta', isDetectedPrimary: true });

    renderV2(makeAnalysis([a, b]));

    expect(screen.queryByText(/BLOCK FAILED TO RENDER/i)).not.toBeInTheDocument();
    expect(screen.getByText(/EVIDENCE — ALPHA/i)).toBeInTheDocument();
    expect(screen.getByText(/EVIDENCE — BETA/i)).toBeInTheDocument();
  });
});
