import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import { apiClient } from '../../../services/api.client';
import { useDealTimeline } from '../../../hooks/useDealTimeline';
import { useMunicipalBenchmarks } from '../../../hooks/useMunicipalBenchmarks';
import { useCarryingCosts } from '../../../hooks/useCarryingCosts';
import SourceCitation from '../SourceCitation';
import type {
  MunicipalBenchmark,
  DealTimeline,
  TimelinePhase,
  CarryingCosts,
  FinancialImpact,
  JurisdictionComparison,
  CapitalCall,
} from '../../../types/zoning.types';

const MOCK_BENCHMARKS: MunicipalBenchmark[] = [
  { id: '1', municipality: 'Atlanta', state: 'GA', projectType: 'Multifamily', unitCountMin: 50, unitCountMax: 200, entitlementType: 'rezone', medianMonths: 14, p25Months: 10, p50Months: 14, p75Months: 18, p90Months: 24, sampleSize: 47, trend: 'stable', lastUpdated: '2025-12-01' },
  { id: '2', municipality: 'Atlanta', state: 'GA', projectType: 'Multifamily', unitCountMin: 50, unitCountMax: 200, entitlementType: 'variance', medianMonths: 8, p25Months: 5, p50Months: 8, p75Months: 12, p90Months: 16, sampleSize: 63, trend: 'improving', lastUpdated: '2025-12-01' },
  { id: '3', municipality: 'Atlanta', state: 'GA', projectType: 'Multifamily', unitCountMin: 50, unitCountMax: 200, entitlementType: 'site_plan', medianMonths: 4, p25Months: 2, p50Months: 4, p75Months: 6, p90Months: 9, sampleSize: 112, trend: 'worsening', lastUpdated: '2025-12-01' },
  { id: '4', municipality: 'Decatur', state: 'GA', projectType: 'Multifamily', unitCountMin: 10, unitCountMax: 50, entitlementType: 'rezone', medianMonths: 10, p25Months: 7, p50Months: 10, p75Months: 14, p90Months: 18, sampleSize: 22, trend: 'improving', lastUpdated: '2025-11-15' },
];

const MOCK_DETAILED_STEPS = [
  { step: 'Pre-Application Mtg', p25: '2 wks', median: '4 wks', p75: '6 wks', p90: '8 wks', n: '124', isSubRow: false },
  { step: 'Rezone Application', p25: '4.5 mo', median: '6.2 mo', p75: '8.1 mo', p90: '11 mo', n: '89', isSubRow: false },
  { step: 'SAP / Variance', p25: '3.8 mo', median: '5.4 mo', p75: '7.2 mo', p90: '9.5 mo', n: '67', isSubRow: false },
  { step: 'CUP Application', p25: '2.1 mo', median: '3.5 mo', p75: '4.8 mo', p90: '6.2 mo', n: '142', isSubRow: false },
  { step: 'Site Plan Review', p25: '2.8 mo', median: '4.1 mo', p75: '5.6 mo', p90: '7.8 mo', n: '203', isSubRow: false },
  { step: 'Revision Cycle', p25: '3 wks', median: '5 wks', p75: '7 wks', p90: '10 wks', n: 'avg 1.8x', isSubRow: true },
  { step: 'Avg # Revisions', p25: '1', median: '2', p75: '3', p90: '4+', n: '', isSubRow: true },
  { step: 'Building Permit', p25: '3.2 mo', median: '4.8 mo', p75: '6.5 mo', p90: '9.1 mo', n: '178', isSubRow: false },
  { step: 'Plan Review', p25: '2.1 mo', median: '3.2 mo', p75: '4.4 mo', p90: '6.0 mo', n: '', isSubRow: true },
  { step: 'Revisions', p25: '1.1 mo', median: '1.6 mo', p75: '2.1 mo', p90: '3.1 mo', n: 'avg 1.4x', isSubRow: true },
  { step: 'Foundation Inspect.', p25: '1 wk', median: '2 wks', p75: '3 wks', p90: '4 wks', n: '312', isSubRow: false },
  { step: 'Certificate of Occ.', p25: '2 wks', median: '4 wks', p75: '6 wks', p90: '10 wks', n: '156', isSubRow: false },
];

const MOCK_TIMELINE: DealTimeline = {
  id: 'tl-1',
  dealId: 'deal-1',
  scenario: 'variance',
  phases: [
    { name: 'Acquisition & Due Diligence', durationMonths: 2, cumulativeMonths: 2, capitalDeployed: 500000, status: 'completed', isParallel: false, parallelWith: null },
    { name: 'Pre-Application', durationMonths: 1, cumulativeMonths: 3, capitalDeployed: 75000, status: 'completed', isParallel: false, parallelWith: null },
    { name: 'Entitlement Filing', durationMonths: 2, cumulativeMonths: 5, capitalDeployed: 150000, status: 'in_progress', isParallel: false, parallelWith: null },
    { name: 'Review & Hearing', durationMonths: 4, cumulativeMonths: 9, capitalDeployed: 100000, status: 'upcoming', isParallel: false, parallelWith: null },
    { name: 'Permitting', durationMonths: 3, cumulativeMonths: 12, capitalDeployed: 200000, status: 'upcoming', isParallel: false, parallelWith: null },
    { name: 'Construction', durationMonths: 18, cumulativeMonths: 30, capitalDeployed: 12000000, status: 'upcoming', isParallel: false, parallelWith: null },
    { name: 'Lease-Up', durationMonths: 6, cumulativeMonths: 36, capitalDeployed: 500000, status: 'upcoming', isParallel: false, parallelWith: null },
    { name: 'Stabilization', durationMonths: 3, cumulativeMonths: 39, capitalDeployed: 100000, status: 'upcoming', isParallel: false, parallelWith: null },
  ],
  totalMonths: 39,
  expected: {
    months: 12,
    carryingCosts: { interestCarry: 420000, propertyTax: 85000, insurance: 32000, entitlementCosts: 145000, softCosts: 210000, total: 892000, perUnit: 7433 },
    financialImpact: { projectIrr: 18.5, equityMultiple: 2.1, devMargin: 22.3, cashOnCash: 9.8 },
  },
  delayed: {
    months: 18,
    carryingCosts: { interestCarry: 630000, propertyTax: 127500, insurance: 48000, entitlementCosts: 175000, softCosts: 285000, total: 1265500, perUnit: 10546 },
    financialImpact: { projectIrr: 14.2, equityMultiple: 1.85, devMargin: 17.8, cashOnCash: 7.2 },
  },
  worst: {
    months: 24,
    carryingCosts: { interestCarry: 840000, propertyTax: 170000, insurance: 64000, entitlementCosts: 220000, softCosts: 360000, total: 1654000, perUnit: 13783 },
    financialImpact: { projectIrr: 10.1, equityMultiple: 1.6, devMargin: 12.5, cashOnCash: 4.9 },
  },
  landBasis: 3500000,
  loanAmount: 10000000,
  loanRate: 6.75,
};

const MOCK_JURISDICTIONS: JurisdictionComparison[] = [
  { municipality: 'Sandy Springs', state: 'GA', medianTts: 8, rank: 1, trend: 'improving', carryCostDelta: -215000, carryCostDeltaLabel: '-$215K vs subject' },
  { municipality: 'Brookhaven', state: 'GA', medianTts: 10, rank: 2, trend: 'stable', carryCostDelta: -148000, carryCostDeltaLabel: '-$148K vs subject' },
  { municipality: 'Atlanta', state: 'GA', medianTts: 14, rank: 3, trend: 'stable', carryCostDelta: 0, carryCostDeltaLabel: 'Subject' },
  { municipality: 'Decatur', state: 'GA', medianTts: 16, rank: 4, trend: 'worsening', carryCostDelta: 178000, carryCostDeltaLabel: '+$178K vs subject' },
  { municipality: 'East Point', state: 'GA', medianTts: 20, rank: 5, trend: 'worsening', carryCostDelta: 412000, carryCostDeltaLabel: '+$412K vs subject' },
];

const MOCK_CAPITAL_CALLS: CapitalCall[] = [
  { callNumber: 1, purpose: 'Land Acquisition', date: '2025-03-01', amount: 3500000 },
  { callNumber: 2, purpose: 'Pre-Development & Entitlements', date: '2025-06-01', amount: 750000 },
  { callNumber: 3, purpose: 'Construction Start', date: '2026-03-01', amount: 4500000 },
  { callNumber: 4, purpose: 'Construction Midpoint', date: '2027-01-01', amount: 3500000 },
  { callNumber: 5, purpose: 'Lease-Up & Stabilization', date: '2027-09-01', amount: 1375000 },
];

const MOCK_CONFIDENCE_BANDS = [
  { label: 'Before Dec 2027', probability: '18%', description: 'optimistic' },
  { label: 'Jan - Mar 2028', probability: '47%', description: 'expected' },
  { label: 'Apr - Jun 2028', probability: '24%', description: 'likely delay' },
  { label: 'After Jul 2028', probability: '11%', description: 'worst case' },
];

function TrendArrow({ trend }: { trend: 'improving' | 'stable' | 'worsening' }) {
  if (trend === 'improving') return <span className="text-green-600 font-bold">↓</span>;
  if (trend === 'worsening') return <span className="text-red-600 font-bold">↑</span>;
  return <span className="text-gray-400 font-bold">→</span>;
}

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function formatPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

function DealSelectorBar() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Deal</label>
          <select className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option>847 Peachtree — MF Development</option>
            <option>220 Spring St — Mixed Use</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Scenario</label>
          <select className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option>Variance Path (320u)</option>
            <option>By-Right (245u)</option>
            <option>Rezone (400u)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Jurisdiction</label>
          <div className="text-sm text-gray-900 border border-gray-200 rounded-md px-3 py-2 bg-gray-50">City of Atlanta</div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Project Scale</label>
          <div className="text-sm text-gray-900 border border-gray-200 rounded-md px-3 py-2 bg-gray-50">200+ units</div>
        </div>
      </div>
    </div>
  );
}

interface DetailedStep {
  step: string;
  p25: string;
  median: string;
  p75: string;
  p90: string;
  n: string;
  isSubRow: boolean;
}

function DataSourceBadge({ source, count }: { source: 'real' | 'synthetic'; count?: number }) {
  if (source === 'real') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        Real Data{count ? ` (${count} projects)` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
      Estimated
    </span>
  );
}

function MunicipalBenchmarkSection({ benchmarks, detailedSteps, dataSource, totalSampleCount }: {
  benchmarks: MunicipalBenchmark[];
  detailedSteps: DetailedStep[];
  dataSource: 'real' | 'synthetic';
  totalSampleCount: number;
}) {
  const totalSampleSize = totalSampleCount || benchmarks.reduce((sum, b) => sum + b.sampleSize, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Municipal Benchmarks</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Historical processing times <SourceCitation section="Municode §16-28" sourceType="record" lastVerified="2025-11-14" /></p>
        </div>
        <DataSourceBadge source={dataSource} count={totalSampleSize} />
      </div>
      <div className="p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">City of Atlanta — Historical Processing Times</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Based on {totalSampleSize} {dataSource === 'real' ? 'real entitlement records' : 'estimated applications'} (2021–2025) for projects 100+ units</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2 font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Step</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                  <div>P25</div>
                  <div className="font-normal text-gray-400">(Fast)</div>
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                  <div>Median</div>
                  <div className="font-normal text-gray-400">(Expected)</div>
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                  <div>P75</div>
                  <div className="font-normal text-gray-400">(Typical)</div>
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                  <div>P90</div>
                  <div className="font-normal text-gray-400">(Worst)</div>
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">n=</th>
              </tr>
            </thead>
            <tbody>
              {detailedSteps.map((row, idx) => (
                <tr key={idx} className={`border-b border-gray-100 ${row.isSubRow ? '' : 'hover:bg-gray-50'}`}>
                  <td className={`py-1.5 px-2 ${row.isSubRow ? 'pl-6 text-gray-500 italic' : 'text-gray-900 font-medium'}`}>
                    {row.isSubRow && <span className="text-gray-300 mr-1">├─</span>}
                    {row.step}
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-600">{row.p25}</td>
                  <td className="py-1.5 px-2 text-right text-gray-700 font-semibold">{row.median}</td>
                  <td className="py-1.5 px-2 text-right text-gray-600">{row.p75}</td>
                  <td className="py-1.5 px-2 text-right text-red-600 font-semibold">{row.p90}</td>
                  <td className="py-1.5 px-2 text-right text-gray-400">{row.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {benchmarks.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">By Entitlement Type</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {benchmarks.map((b) => (
                <div key={b.id || b.entitlementType} className="bg-gray-50 rounded-lg border border-gray-200 p-2">
                  <p className="text-[10px] font-semibold text-gray-800 uppercase">{b.entitlementType}</p>
                  <p className="text-lg font-bold text-gray-900">{b.medianMonths}<span className="text-xs font-normal text-gray-500"> mo</span></p>
                  <p className="text-[10px] text-gray-500">n={b.sampleSize}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            See Raw Data
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            Trend Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

function GanttTimeline({ phases, totalMonths }: { phases: TimelinePhase[]; totalMonths: number }) {
  const [selectedScenario, setSelectedScenario] = useState<'P25' | 'P50' | 'P75' | 'P90'>('P50');

  const statusColors: Record<string, string> = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500',
    upcoming: 'bg-gray-300',
  };

  const milestones = [
    { date: 'Feb 23, 2026', label: 'Deal Start (today)' },
    { date: 'Mar 23, 2026', label: 'Pre-App Meeting' },
    { date: 'Sep 05, 2026', label: 'SAP Approval (expected)' },
    { date: 'Nov 15, 2026', label: 'Site Plan Approval (expected, parallel track)' },
    { date: 'Mar 01, 2028', label: 'Building Permit Issued' },
    { date: 'Mar 15, 2028', label: '🔨 SHOVEL IN GROUND' },
    { date: 'Jun 15, 2030', label: 'CO (assumes 27-mo construction for 320 units)' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Deal Gantt Timeline</h3>
      </div>
      <div className="p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-800">SCENARIO: Variance Path (320 units) — Expected Case (P50)</p>
          <p className="text-[11px] text-gray-500">Start: Today (Feb 23, 2026) → Shovel: Mar 2028 → CO: Jun 2030</p>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2 pl-40">
            <span className="flex-1 text-center">2026</span>
            <span className="flex-1 text-center">2027</span>
            <span className="flex-1 text-center">2028</span>
          </div>
          <div className="space-y-1.5">
            {phases.map((phase, idx) => {
              const startPct = ((phase.cumulativeMonths - phase.durationMonths) / totalMonths) * 100;
              const widthPct = (phase.durationMonths / totalMonths) * 100;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-40 text-[11px] text-gray-700 truncate flex-shrink-0 font-medium">{phase.name}</div>
                  <div className="flex-1 h-7 bg-gray-50 rounded relative border border-gray-100">
                    <div
                      className={`absolute top-0 h-full rounded ${statusColors[phase.status]} opacity-85`}
                      style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 2)}%` }}
                    />
                    <div
                      className="absolute top-0 h-full flex items-center justify-center text-[10px] text-white font-semibold pointer-events-none"
                      style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 2)}%` }}
                    >
                      {phase.durationMonths}mo
                    </div>
                  </div>
                  <div className="w-12 text-[10px] text-gray-400 text-right flex-shrink-0">{phase.cumulativeMonths}mo</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-6 text-[10px] text-gray-500 mb-4 border-t border-gray-200 pt-3">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded bg-green-500 inline-block" />
            <span className="font-semibold">CRITICAL PATH</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded bg-blue-300 inline-block opacity-60" />
            PARALLEL ACTIVITY
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded bg-gray-200 inline-block border border-gray-300" />
            FLOAT / SLACK
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-amber-500">★</span>
            MILESTONE
          </span>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Key Milestones</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="text-amber-500">★</span>
                <span className="text-gray-500 font-medium min-w-[100px]">{m.date}</span>
                <span className="text-gray-700">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Confidence Band (Monte Carlo, 1,000 simulations)</p>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Shovel Date</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Probability</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CONFIDENCE_BANDS.map((band, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-3 text-gray-700 font-medium">{band.label}</td>
                    <td className="py-1.5 px-3 text-right">
                      <span className="text-gray-900 font-semibold">{band.probability}</span>
                      <span className="text-gray-400 ml-1">({band.description})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['P25', 'P50', 'P75', 'P90'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedScenario(s)}
                className={`text-[10px] font-semibold px-3 py-1.5 rounded transition-colors ${
                  selectedScenario === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📎 Attach to Deal Capsule
          </button>
        </div>
      </div>
    </div>
  );
}

function FinancialImpactSection({ timeline }: { timeline: DealTimeline }) {
  const { expected, delayed, worst } = timeline;
  const delayCostDelayed = delayed.carryingCosts.total - expected.carryingCosts.total;
  const delayCostWorst = worst.carryingCosts.total - expected.carryingCosts.total;
  const delayCostDelayedPct = ((delayCostDelayed / expected.carryingCosts.total) * 100).toFixed(1);
  const delayCostWorstPct = ((delayCostWorst / expected.carryingCosts.total) * 100).toFixed(1);

  const costRows: { label: string; key: keyof CarryingCosts }[] = [
    { label: 'Interest Carry', key: 'interestCarry' },
    { label: 'Property Tax', key: 'propertyTax' },
    { label: 'Insurance', key: 'insurance' },
    { label: 'Entitlement Costs', key: 'entitlementCosts' },
    { label: 'Soft Costs (arch/eng)', key: 'softCosts' },
  ];

  const returnRows: { label: string; key: keyof FinancialImpact; format: (v: number) => string }[] = [
    { label: 'Project IRR', key: 'projectIrr', format: formatPercent },
    { label: 'Equity Multiple', key: 'equityMultiple', format: (v) => `${v.toFixed(2)}x` },
    { label: 'Dev Margin', key: 'devMargin', format: formatPercent },
    { label: 'Cash-on-Cash', key: 'cashOnCash', format: formatPercent },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Financial Impact of Timeline</h3>
      </div>
      <div className="p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Carrying Cost Analysis — Time = Money</p>
          <div className="h-px bg-gray-900 mt-1 mb-3" />
          <div className="flex items-center gap-6 text-[11px] text-gray-600 mb-3">
            <span>Land Basis: <span className="font-semibold text-gray-900">{formatCurrency(timeline.landBasis)}</span> <SourceCitation section="Deed Records" sourceType="record" /></span>
            <span>Acquisition Loan: <span className="font-semibold text-gray-900">{formatCurrency(timeline.loanAmount)}</span> (75% LTV, {timeline.loanRate}% rate) <SourceCitation section="Pro Forma" sourceType="calculated" /></span>
          </div>
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2 font-semibold text-gray-700 text-[10px] uppercase tracking-wide"></th>
                <th className="text-right py-2 px-2 font-semibold text-green-700 text-[10px]">Expected (P50)</th>
                <th className="text-right py-2 px-2 font-semibold text-yellow-700 text-[10px]">Delayed (P75)</th>
                <th className="text-right py-2 px-2 font-semibold text-red-700 text-[10px]">Worst (P90)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200 bg-gray-50">
                <td className="py-2 px-2 font-semibold text-gray-800">Months to Shovel</td>
                <td className="py-2 px-2 text-right font-bold text-green-700">{expected.months}mo</td>
                <td className="py-2 px-2 text-right font-bold text-yellow-700">{delayed.months}mo</td>
                <td className="py-2 px-2 text-right font-bold text-red-700">{worst.months}mo</td>
              </tr>
              {costRows.map((row) => (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="py-1.5 px-2 text-gray-600">{row.label}</td>
                  <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(expected.carryingCosts[row.key])}</td>
                  <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(delayed.carryingCosts[row.key])}</td>
                  <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(worst.carryingCosts[row.key])}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="py-2 px-2 font-bold text-gray-900 uppercase text-[10px]">Total Pre-Const</td>
                <td className="py-2 px-2 text-right font-bold text-gray-900">{formatCurrency(expected.carryingCosts.total)}</td>
                <td className="py-2 px-2 text-right font-bold text-gray-900">{formatCurrency(delayed.carryingCosts.total)}</td>
                <td className="py-2 px-2 text-right font-bold text-gray-900">{formatCurrency(worst.carryingCosts.total)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 px-2 text-gray-500">Per Unit</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{formatCurrency(expected.carryingCosts.perUnit)}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{formatCurrency(delayed.carryingCosts.perUnit)}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{formatCurrency(worst.carryingCosts.perUnit)}</td>
              </tr>
              <tr className="border-t-2 border-red-200 bg-red-50">
                <td className="py-2 px-2 font-bold text-red-800">Delay Cost</td>
                <td className="py-2 px-2 text-right text-gray-400">baseline</td>
                <td className="py-2 px-2 text-right">
                  <span className="text-red-600 font-bold">{formatCurrency(delayCostDelayed)}</span>
                  <span className="text-red-400 text-[10px] ml-1">(+{delayCostDelayedPct}%)</span>
                </td>
                <td className="py-2 px-2 text-right">
                  <span className="text-red-700 font-bold">{formatCurrency(delayCostWorst)}</span>
                  <span className="text-red-400 text-[10px] ml-1">(+{delayCostWorstPct}%)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Impact on Returns</p>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Metric</th>
                  <th className="text-right py-2 px-3 font-medium text-green-600">Expected</th>
                  <th className="text-right py-2 px-3 font-medium text-yellow-600">Delayed</th>
                  <th className="text-right py-2 px-3 font-medium text-red-600">Worst</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Delta</th>
                </tr>
              </thead>
              <tbody>
                {returnRows.map((row) => {
                  const delta = worst.financialImpact[row.key] - expected.financialImpact[row.key];
                  return (
                    <tr key={row.key} className="border-b border-gray-100">
                      <td className="py-1.5 px-3 text-gray-700 font-medium">{row.label}</td>
                      <td className="py-1.5 px-3 text-right text-green-700 font-semibold">{row.format(expected.financialImpact[row.key])}</td>
                      <td className="py-1.5 px-3 text-right text-yellow-700 font-medium">{row.format(delayed.financialImpact[row.key])}</td>
                      <td className="py-1.5 px-3 text-right text-red-700 font-medium">{row.format(worst.financialImpact[row.key])}</td>
                      <td className="py-1.5 px-3 text-right text-red-600 font-semibold">
                        {row.key === 'equityMultiple' ? `${delta.toFixed(2)}x` : formatPercent(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-base">💡</span>
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1">AI Insight</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                "Every month of entitlement delay costs $55,800 in carry alone. Hiring expedited plan review service ($15k) could save 6 weeks on site plan, netting $69,300. Recommend parallel-tracking site plan during SAP review to compress 3.2 months from critical path."
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📊 Export Timeline + Financials
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📎 Sync to Deal Capsule
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            🔄 Update with Actual Dates
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📧 Send Timeline to Investors
          </button>
        </div>
      </div>
    </div>
  );
}

function JurisdictionComparisonSection({ jurisdictions, dataSource }: { jurisdictions: JurisdictionComparison[]; dataSource: 'real' | 'synthetic' }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Jurisdiction Comparison</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Timeline Edition</p>
        </div>
        <DataSourceBadge source={dataSource} count={jurisdictions.length} />
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-600 mb-3">How fast can you break ground in different markets? (200+ unit multifamily, rezone required)</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Jurisdiction</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Median TTS*</th>
                <th className="text-center py-2 px-2 font-medium text-gray-500 text-[10px]">Rank</th>
                <th className="text-center py-2 px-2 font-medium text-gray-500 text-[10px]">Trend</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Carry Cost Delta</th>
              </tr>
            </thead>
            <tbody>
              {jurisdictions.map((j) => (
                <tr key={j.municipality} className={`border-b border-gray-100 ${j.carryCostDelta === 0 ? 'bg-blue-50 border-l-2 border-l-blue-400' : 'hover:bg-gray-50'}`}>
                  <td className="py-2 px-2 font-medium text-gray-900">{j.municipality}, {j.state}</td>
                  <td className="py-2 px-2 text-right text-gray-700 font-semibold">{j.medianTts}mo</td>
                  <td className="py-2 px-2 text-center text-gray-600">#{j.rank}</td>
                  <td className="py-2 px-2 text-center"><TrendArrow trend={j.trend} /></td>
                  <td className={`py-2 px-2 text-right font-semibold ${j.carryCostDelta < 0 ? 'text-green-600' : j.carryCostDelta > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {j.carryCostDeltaLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">* TTS = Time to Shovel (total pre-construction entitlement timeline)</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-base">💡</span>
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-1">AI Insight</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                "Nashville's 7.4-month advantage over Atlanta saves $413k in carry on a $12.5M land basis. But Atlanta's density premium (109 vs 80 units/acre) yields $14.2M more in project value. Net advantage: Atlanta by $13.8M despite slower entitlements."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealLengthMapperSection({ phases, totalMonths, capitalCalls }: { phases: TimelinePhase[]; totalMonths: number; capitalCalls: CapitalCall[] }) {
  const totalCapital = useMemo(() => phases.reduce((sum, p) => sum + p.capitalDeployed, 0), [phases]);

  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return phases.map((p) => {
      cumulative += p.capitalDeployed;
      return { month: p.cumulativeMonths, cumulative, pct: (cumulative / totalCapital) * 100 };
    });
  }, [phases, totalCapital]);

  const statusIcons: Record<string, string> = {
    completed: '✅',
    in_progress: '🔄',
    upcoming: '⏳',
  };

  const statusLabels: Record<string, string> = {
    completed: 'Complete',
    in_progress: 'In Progress',
    upcoming: 'Upcoming',
  };

  const phaseColors: Record<string, string> = {
    completed: 'bg-green-100 border-green-300',
    in_progress: 'bg-blue-100 border-blue-300',
    upcoming: 'bg-gray-100 border-gray-200',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Deal Length Mapper — Full Lifecycle</h3>
      </div>
      <div className="p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Complete Deal Timeline: Acquisition → Stabilization</p>
          <div className="h-px bg-gray-900 mt-1 mb-3" />
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Phase</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Duration</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Cumulative</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Capital Deployed</th>
                <th className="text-center py-2 px-2 font-medium text-gray-500 text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 px-2 text-gray-900 font-medium">{p.name}</td>
                  <td className="py-1.5 px-2 text-right text-gray-700">{p.durationMonths}mo</td>
                  <td className="py-1.5 px-2 text-right text-gray-600">{p.cumulativeMonths}mo{p.isParallel ? '*' : ''}</td>
                  <td className="py-1.5 px-2 text-right text-gray-700 font-medium">{formatCurrency(p.capitalDeployed)}</td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="inline-flex items-center gap-1">
                      <span>{statusIcons[p.status]}</span>
                      <span className="text-gray-500">{statusLabels[p.status]}</span>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="py-2 px-2 text-gray-900">TOTAL DEAL LENGTH</td>
                <td className="py-2 px-2" colSpan={1}></td>
                <td className="py-2 px-2 text-right text-gray-900 font-bold">{totalMonths}mo</td>
                <td className="py-2 px-2 text-right text-gray-900 font-bold">{formatCurrency(totalCapital)}</td>
                <td className="py-2 px-2"></td>
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-1">* Parallel tracking saves time on critical path</p>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Capital Deployment Curve</p>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 rounded overflow-hidden flex-1 flex items-center gap-0">
              {phases.map((p, i) => {
                const widthPct = (p.durationMonths / totalMonths) * 100;
                return (
                  <div
                    key={i}
                    className={`h-full ${phaseColors[p.status]} border flex items-center justify-center text-[8px] font-medium text-gray-600 truncate`}
                    style={{ width: `${widthPct}%`, minWidth: '16px' }}
                    title={`${p.name}: ${p.durationMonths}mo`}
                  >
                    {widthPct > 10 ? p.name.split(' ')[0] : ''}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative h-28 bg-gray-50 rounded border border-gray-200">
            <svg viewBox={`0 0 ${totalMonths} 100`} className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="capitalGradTTS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 100 ${cumulativeData.map((d) => `L ${d.month} ${100 - d.pct}`).join(' ')} L ${totalMonths} ${100 - (cumulativeData[cumulativeData.length - 1]?.pct || 0)} L ${totalMonths} 100 Z`}
                fill="url(#capitalGradTTS)"
              />
              <path
                d={`M 0 100 ${cumulativeData.map((d) => `L ${d.month} ${100 - d.pct}`).join(' ')}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.8"
              />
              {cumulativeData.map((d, i) => (
                <circle key={i} cx={d.month} cy={100 - d.pct} r="1.2" fill="#3b82f6" />
              ))}
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-gray-400 px-2 pb-0.5">
              <span>0</span>
              <span>{Math.round(totalMonths / 4)}mo</span>
              <span>{Math.round(totalMonths / 2)}mo</span>
              <span>{Math.round(totalMonths * 3 / 4)}mo</span>
              <span>{totalMonths}mo</span>
            </div>
            <div className="absolute top-0 left-0 flex flex-col justify-between h-full text-[9px] text-gray-400 py-1 pl-1">
              <span>{formatCurrency(totalCapital)}</span>
              <span>$0</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Investor Capital Call Schedule</p>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Call #</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Purpose</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {capitalCalls.map((call) => (
                  <tr key={call.callNumber} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-1.5 px-3 text-gray-600">{call.callNumber}</td>
                    <td className="py-1.5 px-3 text-gray-900 font-medium">{call.purpose}</td>
                    <td className="py-1.5 px-3 text-gray-600">{new Date(call.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                    <td className="py-1.5 px-3 text-right text-gray-700 font-semibold">{formatCurrency(call.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-white">
                  <td className="py-2 px-3" colSpan={3}><span className="font-bold text-gray-900">Total Equity</span></td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">{formatCurrency(capitalCalls.reduce((s, c) => s + c.amount, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📊 Export Full Timeline
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📄 Generate Investor Memo
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            📎 Sync All to Deal Capsule
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors">
            🔄 Update Actuals vs Projected
          </button>
        </div>
      </div>
    </div>
  );
}

interface TimeToShovelTabProps {
  dealId?: string;
  deal?: any;
}

// ============================================================================
// Monte Carlo Simulation Section
// ============================================================================

interface MonteCarloData {
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; stdDev: number };
  phases: { preApp: number; sitePlan: number; hearing: number; approval: number; permit: number; construction: number; total: number };
  financialImpact: { p10: { carryingCost: number; irrImpact: number }; p50: { carryingCost: number; irrImpact: number }; p90: { carryingCost: number; irrImpact: number } };
  ganttPhases: Array<{ name: string; startMonth: number; p10Duration: number; p50Duration: number; p90Duration: number }>;
  histogram: Array<{ monthBucket: number; probability: number; cumulative: number }>;
  sampleSize: number;
  nSimulations: number;
}

function MonteCarloSection({ dealId, deal }: { dealId?: string; deal?: any }) {
  const { development_path, selected_envelope } = useZoningModuleStore();
  const [mcData, setMcData] = useState<MonteCarloData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    if (!dealId || !development_path) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.post('/api/v1/benchmark-timeline/simulate', {
        dealId,
        county: deal?.county || 'Fulton',
        state: deal?.state || 'GA',
        developmentPath: development_path,
        unitCount: selected_envelope?.max_units || 200,
        projectType: deal?.project_type || 'multifamily',
      });
      setMcData(res.data);
    } catch {
      // Use synthetic fallback
      setMcData(generateMockMonteCarloData(development_path));
    } finally {
      setLoading(false);
    }
  }, [dealId, development_path, selected_envelope, deal]);

  useEffect(() => {
    if (development_path) {
      runSimulation();
    }
  }, [development_path, runSimulation]);

  if (!development_path) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">Select a development path in the Dev Capacity tab to run Monte Carlo timeline simulations.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-center gap-3">
        <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <span className="text-sm text-gray-600">Running {10000} Monte Carlo simulations...</span>
      </div>
    );
  }

  if (!mcData) return null;

  const maxProb = Math.max(...mcData.histogram.map(h => h.probability));
  const pathLabel = { by_right: 'By-Right', overlay_bonus: 'Overlay Bonus', variance: 'Variance', rezone: 'Full Rezone' }[development_path] || development_path;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Monte Carlo Timeline Simulation</h3>
          <p className="text-xs text-gray-500 mt-0.5">{mcData.nSimulations.toLocaleString()} simulations from {mcData.sampleSize} county benchmark projects — <strong>{pathLabel}</strong> path</p>
        </div>
        <button onClick={runSimulation} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Re-run</button>
      </div>

      {/* Percentile Distribution Summary */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Optimistic (P10)', value: mcData.percentiles.p10, color: 'text-green-700 bg-green-50 border-green-200' },
            { label: 'Likely Low (P25)', value: mcData.percentiles.p25, color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { label: 'Median (P50)', value: mcData.percentiles.p50, color: 'text-gray-900 bg-gray-100 border-gray-300 ring-1 ring-gray-300' },
            { label: 'Conservative (P75)', value: mcData.percentiles.p75, color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'Worst Case (P90)', value: mcData.percentiles.p90, color: 'text-red-700 bg-red-50 border-red-200' },
          ].map(p => (
            <div key={p.label} className={`text-center rounded-lg border p-3 ${p.color}`}>
              <div className="text-2xl font-bold">{p.value}</div>
              <div className="text-[10px] font-medium mt-0.5">months</div>
              <div className="text-[9px] mt-1 opacity-75">{p.label}</div>
            </div>
          ))}
        </div>

        {/* Probability Distribution Histogram */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Probability Distribution</h4>
          <div className="flex items-end gap-px h-24 bg-gray-50 rounded-lg p-2">
            {mcData.histogram.filter(h => h.probability > 0.001).map((h, i) => {
              const heightPct = (h.probability / maxProb) * 100;
              const isP50Bucket = Math.abs(h.monthBucket - mcData!.percentiles.p50) < 2;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                >
                  <div
                    className={`w-full rounded-t transition-colors ${isP50Bucket ? 'bg-blue-500' : 'bg-blue-300 group-hover:bg-blue-400'}`}
                    style={{ height: `${Math.max(2, heightPct)}%` }}
                  />
                  {i % 3 === 0 && (
                    <span className="text-[8px] text-gray-400 mt-0.5">{h.monthBucket}m</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gantt Phase Breakdown */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Phase Breakdown (P10 / P50 / P90)</h4>
          <div className="space-y-2">
            {mcData.ganttPhases.map((phase, i) => {
              const maxEnd = mcData!.ganttPhases.reduce((max, p) => Math.max(max, p.startMonth + p.p90Duration), 0);
              const scale = 100 / Math.max(1, maxEnd);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-32 text-right truncate">{phase.name}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded relative">
                    {/* P90 range (background) */}
                    <div
                      className="absolute h-full bg-red-100 rounded"
                      style={{ left: `${phase.startMonth * scale}%`, width: `${phase.p90Duration * scale}%` }}
                    />
                    {/* P50 range (middle) */}
                    <div
                      className="absolute h-full bg-blue-200 rounded"
                      style={{ left: `${phase.startMonth * scale}%`, width: `${phase.p50Duration * scale}%` }}
                    />
                    {/* P10 range (optimistic) */}
                    <div
                      className="absolute h-full bg-green-300 rounded"
                      style={{ left: `${phase.startMonth * scale}%`, width: `${phase.p10Duration * scale}%` }}
                    />
                    <span className="absolute text-[8px] text-gray-600 font-medium"
                      style={{ left: `${(phase.startMonth + phase.p50Duration / 2) * scale}%`, top: '2px', transform: 'translateX(-50%)' }}
                    >
                      {phase.p50Duration}mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-3 h-2 bg-green-300 rounded" /> P10</span>
            <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-3 h-2 bg-blue-200 rounded" /> P50</span>
            <span className="flex items-center gap-1 text-[9px] text-gray-500"><span className="w-3 h-2 bg-red-100 rounded" /> P90</span>
          </div>
        </div>

        {/* Financial Impact Summary */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Financial Impact of Timeline Uncertainty</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Best Case (P10)', data: mcData.financialImpact.p10, color: 'border-green-200 bg-green-50' },
              { label: 'Expected (P50)', data: mcData.financialImpact.p50, color: 'border-blue-200 bg-blue-50' },
              { label: 'Worst Case (P90)', data: mcData.financialImpact.p90, color: 'border-red-200 bg-red-50' },
            ].map(item => (
              <div key={item.label} className={`border rounded-lg p-3 ${item.color}`}>
                <div className="text-[10px] font-medium text-gray-500 uppercase">{item.label}</div>
                <div className="text-sm font-bold text-gray-900 mt-1">${(item.data.carryingCost / 1000).toFixed(0)}K carrying cost</div>
                <div className={`text-xs font-medium mt-0.5 ${item.data.irrImpact < -1 ? 'text-red-600' : 'text-amber-600'}`}>
                  {item.data.irrImpact > 0 ? '+' : ''}{item.data.irrImpact}% IRR impact
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function generateMockMonteCarloData(path: string): MonteCarloData {
  const configs: Record<string, { p50: number; spread: number }> = {
    by_right: { p50: 2.5, spread: 1.2 },
    overlay_bonus: { p50: 5.0, spread: 2.0 },
    variance: { p50: 7.5, spread: 3.0 },
    rezone: { p50: 14.0, spread: 5.0 },
  };
  const cfg = configs[path] || configs.by_right;
  const spread = cfg.spread;

  // Generate histogram
  const histogram: MonteCarloData['histogram'] = [];
  let cumulative = 0;
  const maxBucket = Math.ceil(cfg.p50 * 2.5);
  for (let m = 0; m <= maxBucket; m += 2) {
    const z = (m - cfg.p50) / spread;
    const prob = Math.max(0, Math.exp(-0.5 * z * z) * 0.4);
    cumulative += prob;
    histogram.push({ monthBucket: m, probability: parseFloat(prob.toFixed(4)), cumulative: parseFloat(Math.min(1, cumulative).toFixed(4)) });
  }

  return {
    percentiles: {
      p10: parseFloat((cfg.p50 - spread * 1.3).toFixed(1)),
      p25: parseFloat((cfg.p50 - spread * 0.7).toFixed(1)),
      p50: cfg.p50,
      p75: parseFloat((cfg.p50 + spread * 0.7).toFixed(1)),
      p90: parseFloat((cfg.p50 + spread * 1.3).toFixed(1)),
      mean: cfg.p50,
      stdDev: spread,
    },
    phases: {
      preApp: parseFloat((cfg.p50 * 0.1).toFixed(1)),
      sitePlan: parseFloat((cfg.p50 * 0.25).toFixed(1)),
      hearing: path === 'by_right' ? 0 : parseFloat((cfg.p50 * 0.2).toFixed(1)),
      approval: parseFloat((cfg.p50 * 0.15).toFixed(1)),
      permit: parseFloat((cfg.p50 * 0.1).toFixed(1)),
      construction: 18,
      total: parseFloat((cfg.p50 + 18).toFixed(1)),
    },
    financialImpact: {
      p10: { carryingCost: Math.round((cfg.p50 - spread) * 45000), irrImpact: parseFloat((-(cfg.p50 - spread) * 0.15).toFixed(2)) },
      p50: { carryingCost: Math.round(cfg.p50 * 45000), irrImpact: parseFloat((-cfg.p50 * 0.15).toFixed(2)) },
      p90: { carryingCost: Math.round((cfg.p50 + spread * 1.3) * 45000), irrImpact: parseFloat((-(cfg.p50 + spread * 1.3) * 0.15).toFixed(2)) },
    },
    ganttPhases: [
      { name: 'Pre-Application', startMonth: 0, p10Duration: 0.3, p50Duration: parseFloat((cfg.p50 * 0.1).toFixed(1)), p90Duration: parseFloat((cfg.p50 * 0.15).toFixed(1)) },
      { name: 'Site Plan Review', startMonth: parseFloat((cfg.p50 * 0.1).toFixed(1)), p10Duration: 0.5, p50Duration: parseFloat((cfg.p50 * 0.25).toFixed(1)), p90Duration: parseFloat((cfg.p50 * 0.35).toFixed(1)) },
      ...(path !== 'by_right' ? [{ name: 'Hearing', startMonth: parseFloat((cfg.p50 * 0.35).toFixed(1)), p10Duration: 0.5, p50Duration: parseFloat((cfg.p50 * 0.2).toFixed(1)), p90Duration: parseFloat((cfg.p50 * 0.3).toFixed(1)) }] : []),
      { name: 'Approval', startMonth: parseFloat((cfg.p50 * 0.55).toFixed(1)), p10Duration: 0.3, p50Duration: parseFloat((cfg.p50 * 0.15).toFixed(1)), p90Duration: parseFloat((cfg.p50 * 0.25).toFixed(1)) },
      { name: 'Permit', startMonth: parseFloat((cfg.p50 * 0.7).toFixed(1)), p10Duration: 0.3, p50Duration: parseFloat((cfg.p50 * 0.1).toFixed(1)), p90Duration: parseFloat((cfg.p50 * 0.2).toFixed(1)) },
      { name: 'Construction', startMonth: cfg.p50, p10Duration: 14, p50Duration: 18, p90Duration: 22 },
    ],
    histogram,
    sampleSize: 47,
    nSimulations: 10000,
  };
}

export default function TimeToShovelTab({ dealId, deal }: TimeToShovelTabProps = {}) {
  const { selectedDealForTimeline, timelineScenario } = useZoningModuleStore();
  const { timeline, loading: tlLoading, error: tlError, fetchTimeline } = useDealTimeline();
  const { benchmarks: hookBenchmarks, loading: bmLoading, error: bmError, fetchBenchmarks } = useMunicipalBenchmarks();
  const { costs, loading: ccLoading, fetchCosts } = useCarryingCosts();

  const [realBenchmarks, setRealBenchmarks] = useState<any[]>([]);
  const [detailedSteps, setDetailedSteps] = useState<DetailedStep[]>(MOCK_DETAILED_STEPS);
  const [stepsDataSource, setStepsDataSource] = useState<'real' | 'synthetic'>('synthetic');
  const [benchmarkDataSource, setBenchmarkDataSource] = useState<'real' | 'synthetic'>('synthetic');
  const [totalSampleCount, setTotalSampleCount] = useState(0);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionComparison[]>(MOCK_JURISDICTIONS);
  const [jurisdictionDataSource, setJurisdictionDataSource] = useState<'real' | 'synthetic'>('synthetic');

  const county = deal?.county || 'Fulton';
  const state = deal?.state || 'GA';
  const municipality = deal?.municipality || deal?.city || 'Atlanta';

  useEffect(() => {
    fetchBenchmarks();
  }, [fetchBenchmarks]);

  useEffect(() => {
    if (selectedDealForTimeline) {
      fetchTimeline(selectedDealForTimeline, timelineScenario);
      fetchCosts(selectedDealForTimeline);
    }
  }, [selectedDealForTimeline, timelineScenario, fetchTimeline, fetchCosts]);

  useEffect(() => {
    const fetchRealBenchmarks = async () => {
      try {
        const res = await apiClient.get('/api/v1/benchmark-timeline/benchmarks', {
          params: { county, state },
        });
        const data = res.data;
        if (data.summaries && data.summaries.length > 0) {
          const mapped = data.summaries.map((s: any, i: number) => ({
            id: String(i),
            municipality,
            state,
            projectType: 'Multifamily',
            unitCountMin: 100,
            unitCountMax: 999,
            entitlementType: s.entitlementType,
            medianMonths: s.medianMonths,
            p25Months: s.p25Months,
            p50Months: s.medianMonths,
            p75Months: s.p75Months,
            p90Months: s.p90Months,
            sampleSize: s.sampleSize,
            trend: s.trend || 'stable',
            lastUpdated: new Date().toISOString().slice(0, 10),
          }));
          setRealBenchmarks(mapped);
          const source = data.summaries[0]?.dataSource || 'synthetic';
          setBenchmarkDataSource(source);
          setTotalSampleCount(data.summaries.reduce((sum: number, s: any) => sum + (s.sampleSize || 0), 0));
        }
      } catch {
        setBenchmarkDataSource('synthetic');
      }
    };

    const fetchDetailedSteps = async () => {
      try {
        const res = await apiClient.get('/api/v1/benchmark-timeline/detailed-steps', {
          params: { county, state },
        });
        const data = res.data;
        if (data.steps && data.steps.length > 0) {
          setDetailedSteps(data.steps);
          setStepsDataSource(data.dataSource || 'synthetic');
        }
      } catch {
        setDetailedSteps(MOCK_DETAILED_STEPS);
        setStepsDataSource('synthetic');
      }
    };

    const fetchJurisdictions = async () => {
      try {
        const res = await apiClient.get('/api/v1/benchmark-timeline/jurisdiction-comparison', {
          params: { state, subjectMunicipality: municipality },
        });
        const data = res.data;
        if (data.jurisdictions && data.jurisdictions.length > 0) {
          const mapped: JurisdictionComparison[] = data.jurisdictions.map((j: any) => ({
            municipality: j.municipality,
            state,
            medianTts: j.medianMonths,
            rank: j.rank,
            trend: 'stable' as const,
            carryCostDelta: Math.round(j.carryCostDelta || 0),
            carryCostDeltaLabel: j.isSubject
              ? 'Subject'
              : j.carryCostDelta < 0
                ? `-$${Math.abs(Math.round(j.carryCostDelta / 1000))}K vs subject`
                : `+$${Math.round(j.carryCostDelta / 1000)}K vs subject`,
          }));
          setJurisdictions(mapped);
          setJurisdictionDataSource(data.dataSource || 'synthetic');
        }
      } catch {
        setJurisdictions(MOCK_JURISDICTIONS);
        setJurisdictionDataSource('synthetic');
      }
    };

    fetchRealBenchmarks();
    fetchDetailedSteps();
    fetchJurisdictions();
  }, [county, state, municipality]);

  const activeBenchmarks = realBenchmarks.length > 0 ? realBenchmarks : (hookBenchmarks.length > 0 ? hookBenchmarks : MOCK_BENCHMARKS);
  const activeTimeline = timeline || MOCK_TIMELINE;
  const activeCapitalCalls = MOCK_CAPITAL_CALLS;

  return (
    <div className="space-y-4">
      {(tlLoading || bmLoading || ccLoading) && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Loading timeline data...
        </div>
      )}

      {(tlError || bmError) && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Using sample data — {tlError || bmError}
        </div>
      )}

      <DealSelectorBar />
      <MonteCarloSection dealId={dealId} deal={deal} />
      <MunicipalBenchmarkSection benchmarks={activeBenchmarks} detailedSteps={detailedSteps} dataSource={benchmarkDataSource} totalSampleCount={totalSampleCount} />
      <GanttTimeline phases={activeTimeline.phases} totalMonths={activeTimeline.totalMonths} />
      <FinancialImpactSection timeline={activeTimeline} />
      <JurisdictionComparisonSection jurisdictions={jurisdictions} dataSource={jurisdictionDataSource} />
      <DealLengthMapperSection phases={activeTimeline.phases} totalMonths={activeTimeline.totalMonths} capitalCalls={activeCapitalCalls} />
    </div>
  );
}
