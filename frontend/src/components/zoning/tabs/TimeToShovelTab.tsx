import React, { useEffect, useMemo } from 'react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import { useDealTimeline } from '../../../hooks/useDealTimeline';
import { useMunicipalBenchmarks } from '../../../hooks/useMunicipalBenchmarks';
import { useCarryingCosts } from '../../../hooks/useCarryingCosts';
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

function TrendArrow({ trend }: { trend: 'improving' | 'stable' | 'worsening' }) {
  if (trend === 'improving') return <span className="text-green-500 font-bold">↓</span>;
  if (trend === 'worsening') return <span className="text-red-500 font-bold">↑</span>;
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

function MunicipalBenchmarkTable({ benchmarks }: { benchmarks: MunicipalBenchmark[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Municipal Benchmarks</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-500">Municipality</th>
              <th className="text-left py-2 px-2 font-medium text-gray-500">Type</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">P25</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">P50</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">P75</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">P90</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">n=</th>
              <th className="text-center py-2 px-2 font-medium text-gray-500">Trend</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((b) => (
              <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-2 text-gray-900 font-medium">{b.municipality}</td>
                <td className="py-2 px-2 text-gray-600 capitalize">{b.entitlementType.replace('_', ' ')}</td>
                <td className="py-2 px-2 text-right text-gray-700">{b.p25Months}mo</td>
                <td className="py-2 px-2 text-right text-gray-700 font-semibold">{b.p50Months}mo</td>
                <td className="py-2 px-2 text-right text-gray-700">{b.p75Months}mo</td>
                <td className="py-2 px-2 text-right text-red-600 font-semibold">{b.p90Months}mo</td>
                <td className="py-2 px-2 text-right text-gray-400">{b.sampleSize}</td>
                <td className="py-2 px-2 text-center"><TrendArrow trend={b.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GanttChart({ phases, totalMonths }: { phases: TimelinePhase[]; totalMonths: number }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500',
    upcoming: 'bg-gray-300',
  };

  const milestones = phases.map((p) => ({
    name: p.name,
    month: p.cumulativeMonths,
    status: p.status,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Deal Timeline</h3>
      <div className="space-y-2">
        {phases.map((phase, idx) => {
          const startPct = ((phase.cumulativeMonths - phase.durationMonths) / totalMonths) * 100;
          const widthPct = (phase.durationMonths / totalMonths) * 100;
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-40 text-xs text-gray-600 truncate flex-shrink-0">{phase.name}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded relative">
                <div
                  className={`absolute top-0 h-full rounded ${statusColors[phase.status]} opacity-90`}
                  style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 1)}%` }}
                />
                <div
                  className="absolute top-0 h-full flex items-center justify-center text-[10px] text-white font-medium pointer-events-none"
                  style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 1)}%` }}
                >
                  {phase.durationMonths}mo
                </div>
              </div>
              <div className="w-12 text-xs text-gray-400 text-right flex-shrink-0">{phase.cumulativeMonths}mo</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Completed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> In Progress</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 inline-block" /> Upcoming</span>
      </div>
      <div className="mt-3 flex items-center gap-1 overflow-x-auto">
        {milestones.map((m, i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0" style={{ marginLeft: i === 0 ? '10rem' : 0 }}>
            <div className={`w-2 h-2 rounded-full ${m.status === 'completed' ? 'bg-green-600' : m.status === 'in_progress' ? 'bg-blue-600' : 'bg-gray-400'}`} />
            <span className="text-[9px] text-gray-400 mt-0.5">{m.month}mo</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineProbabilityBands({ benchmarks }: { benchmarks: MunicipalBenchmark[] }) {
  const primary = benchmarks[0];
  if (!primary) return null;

  const maxVal = primary.p90Months + 4;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline Probability Distribution</h3>
      <div className="relative h-16 bg-gray-50 rounded overflow-hidden">
        <div
          className="absolute top-0 h-full bg-green-100 border-l-2 border-green-400"
          style={{ left: `${(primary.p25Months / maxVal) * 100}%`, width: `${((primary.p50Months - primary.p25Months) / maxVal) * 100}%` }}
        />
        <div
          className="absolute top-0 h-full bg-yellow-100 border-l-2 border-yellow-400"
          style={{ left: `${(primary.p50Months / maxVal) * 100}%`, width: `${((primary.p75Months - primary.p50Months) / maxVal) * 100}%` }}
        />
        <div
          className="absolute top-0 h-full bg-orange-100 border-l-2 border-orange-400"
          style={{ left: `${(primary.p75Months / maxVal) * 100}%`, width: `${((primary.p90Months - primary.p75Months) / maxVal) * 100}%` }}
        />
        <div
          className="absolute top-0 h-full border-r-2 border-red-500"
          style={{ left: `${(primary.p90Months / maxVal) * 100}%`, width: '0' }}
        />
        <div className="absolute bottom-1 flex w-full text-[10px] text-gray-600 justify-between px-1">
          <span style={{ position: 'absolute', left: `${(primary.p25Months / maxVal) * 100}%` }}>P25: {primary.p25Months}mo</span>
          <span style={{ position: 'absolute', left: `${(primary.p50Months / maxVal) * 100}%` }}>P50: {primary.p50Months}mo</span>
          <span style={{ position: 'absolute', left: `${(primary.p75Months / maxVal) * 100}%` }}>P75: {primary.p75Months}mo</span>
          <span style={{ position: 'absolute', left: `${(primary.p90Months / maxVal) * 100}%` }}>P90: {primary.p90Months}mo</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-400 inline-block" /> Best Case</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400 inline-block" /> Likely</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-400 inline-block" /> Extended</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-400 inline-block" /> Worst</span>
      </div>
    </div>
  );
}

function FinancialImpactTable({ timeline }: { timeline: DealTimeline }) {
  const { expected, delayed, worst } = timeline;
  const delayCostDelayed = delayed.carryingCosts.total - expected.carryingCosts.total;
  const delayCostWorst = worst.carryingCosts.total - expected.carryingCosts.total;

  const costRows: { label: string; key: keyof CarryingCosts }[] = [
    { label: 'Interest Carry', key: 'interestCarry' },
    { label: 'Property Tax', key: 'propertyTax' },
    { label: 'Insurance', key: 'insurance' },
    { label: 'Entitlement Costs', key: 'entitlementCosts' },
    { label: 'Soft Costs', key: 'softCosts' },
    { label: 'Total', key: 'total' },
    { label: 'Per Unit', key: 'perUnit' },
  ];

  const returnRows: { label: string; key: keyof FinancialImpact; format: (v: number) => string }[] = [
    { label: 'Project IRR', key: 'projectIrr', format: formatPercent },
    { label: 'Equity Multiple', key: 'equityMultiple', format: (v) => `${v.toFixed(2)}x` },
    { label: 'Dev Margin', key: 'devMargin', format: formatPercent },
    { label: 'Cash-on-Cash', key: 'cashOnCash', format: formatPercent },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Financial Impact of Timeline</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-500"></th>
              <th className="text-right py-2 px-2 font-medium text-green-600">Expected</th>
              <th className="text-right py-2 px-2 font-medium text-yellow-600">Delayed</th>
              <th className="text-right py-2 px-2 font-medium text-red-600">Worst Case</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 bg-gray-50">
              <td className="py-2 px-2 font-semibold text-gray-700">Months to Shovel</td>
              <td className="py-2 px-2 text-right font-semibold text-green-700">{expected.months}mo</td>
              <td className="py-2 px-2 text-right font-semibold text-yellow-700">{delayed.months}mo</td>
              <td className="py-2 px-2 text-right font-semibold text-red-700">{worst.months}mo</td>
            </tr>
            {costRows.map((row) => (
              <tr key={row.key} className={`border-b border-gray-100 ${row.key === 'total' ? 'bg-gray-50 font-semibold' : ''}`}>
                <td className="py-1.5 px-2 text-gray-600">{row.label}</td>
                <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(expected.carryingCosts[row.key])}</td>
                <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(delayed.carryingCosts[row.key])}</td>
                <td className="py-1.5 px-2 text-right text-gray-700">{formatCurrency(worst.carryingCosts[row.key])}</td>
              </tr>
            ))}
            <tr className="border-b border-gray-200 bg-red-50">
              <td className="py-2 px-2 font-semibold text-red-700">Delay Cost</td>
              <td className="py-2 px-2 text-right text-gray-400">—</td>
              <td className="py-2 px-2 text-right text-red-600 font-semibold">{formatCurrency(delayCostDelayed)}</td>
              <td className="py-2 px-2 text-right text-red-700 font-semibold">{formatCurrency(delayCostWorst)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Impact on Returns</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-500"></th>
              <th className="text-right py-2 px-2 font-medium text-green-600">Expected</th>
              <th className="text-right py-2 px-2 font-medium text-yellow-600">Delayed</th>
              <th className="text-right py-2 px-2 font-medium text-red-600">Worst Case</th>
            </tr>
          </thead>
          <tbody>
            {returnRows.map((row) => (
              <tr key={row.key} className="border-b border-gray-100">
                <td className="py-1.5 px-2 text-gray-600">{row.label}</td>
                <td className="py-1.5 px-2 text-right text-green-700 font-medium">{row.format(expected.financialImpact[row.key])}</td>
                <td className="py-1.5 px-2 text-right text-yellow-700 font-medium">{row.format(delayed.financialImpact[row.key])}</td>
                <td className="py-1.5 px-2 text-right text-red-700 font-medium">{row.format(worst.financialImpact[row.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JurisdictionComparisonTable({ jurisdictions }: { jurisdictions: JurisdictionComparison[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Jurisdiction Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-medium text-gray-500">Jurisdiction</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">Median TTS</th>
              <th className="text-center py-2 px-2 font-medium text-gray-500">Rank</th>
              <th className="text-center py-2 px-2 font-medium text-gray-500">Trend</th>
              <th className="text-right py-2 px-2 font-medium text-gray-500">Carry Cost Delta</th>
            </tr>
          </thead>
          <tbody>
            {jurisdictions.map((j) => (
              <tr key={j.municipality} className={`border-b border-gray-100 ${j.carryCostDelta === 0 ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <td className="py-2 px-2 font-medium text-gray-900">{j.municipality}, {j.state}</td>
                <td className="py-2 px-2 text-right text-gray-700">{j.medianTts}mo</td>
                <td className="py-2 px-2 text-center text-gray-600">#{j.rank}</td>
                <td className="py-2 px-2 text-center"><TrendArrow trend={j.trend} /></td>
                <td className={`py-2 px-2 text-right font-medium ${j.carryCostDelta < 0 ? 'text-green-600' : j.carryCostDelta > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {j.carryCostDeltaLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DealLengthMapper({ phases, totalMonths, capitalCalls }: { phases: TimelinePhase[]; totalMonths: number; capitalCalls: CapitalCall[] }) {
  const totalCapital = useMemo(() => phases.reduce((sum, p) => sum + p.capitalDeployed, 0), [phases]);

  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return phases.map((p) => {
      cumulative += p.capitalDeployed;
      return { month: p.cumulativeMonths, cumulative, pct: (cumulative / totalCapital) * 100 };
    });
  }, [phases, totalCapital]);

  const statusLabels: Record<string, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    upcoming: 'Upcoming',
  };

  const phaseColors: Record<string, string> = {
    completed: 'bg-green-200 border-green-400',
    in_progress: 'bg-blue-200 border-blue-400',
    upcoming: 'bg-gray-200 border-gray-300',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Deal Length Mapper — Full Lifecycle</h3>
      <div className="mb-4">
        <div className="flex items-center gap-0.5 h-8 rounded overflow-hidden">
          {phases.map((p, i) => {
            const widthPct = (p.durationMonths / totalMonths) * 100;
            return (
              <div
                key={i}
                className={`h-full ${phaseColors[p.status]} border flex items-center justify-center text-[9px] font-medium text-gray-700 truncate`}
                style={{ width: `${widthPct}%`, minWidth: '20px' }}
                title={`${p.name}: ${p.durationMonths}mo (${statusLabels[p.status]})`}
              >
                {widthPct > 8 ? p.name.split(' ')[0] : ''}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>Acquisition</span>
          <span>Stabilization ({totalMonths}mo)</span>
        </div>
      </div>

      <h4 className="text-xs font-semibold text-gray-700 mb-2">Capital Deployment</h4>
      <div className="relative h-24 bg-gray-50 rounded border border-gray-200 mb-4">
        <svg viewBox={`0 0 ${totalMonths} 100`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="capitalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            d={`M 0 100 ${cumulativeData.map((d) => `L ${d.month} ${100 - d.pct}`).join(' ')} L ${totalMonths} ${100 - (cumulativeData[cumulativeData.length - 1]?.pct || 0)} L ${totalMonths} 100 Z`}
            fill="url(#capitalGrad)"
          />
          <path
            d={`M 0 100 ${cumulativeData.map((d) => `L ${d.month} ${100 - d.pct}`).join(' ')}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.8"
          />
          {cumulativeData.map((d, i) => (
            <circle key={i} cx={d.month} cy={100 - d.pct} r="1" fill="#3b82f6" />
          ))}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-gray-400 px-1">
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

      <h4 className="text-xs font-semibold text-gray-700 mb-2">Investor Capital Call Schedule</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-500">Call #</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500">Purpose</th>
            <th className="text-left py-2 px-2 font-medium text-gray-500">Date</th>
            <th className="text-right py-2 px-2 font-medium text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody>
          {capitalCalls.map((call) => (
            <tr key={call.callNumber} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-1.5 px-2 text-gray-600">{call.callNumber}</td>
              <td className="py-1.5 px-2 text-gray-900 font-medium">{call.purpose}</td>
              <td className="py-1.5 px-2 text-gray-600">{new Date(call.date).toLocaleDateString()}</td>
              <td className="py-1.5 px-2 text-right text-gray-700 font-medium">{formatCurrency(call.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="py-2 px-2" colSpan={3}><span className="font-semibold text-gray-700">Total Capital Required</span></td>
            <td className="py-2 px-2 text-right font-bold text-gray-900">{formatCurrency(capitalCalls.reduce((s, c) => s + c.amount, 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function TimeToShovelTab() {
  const { selectedDealForTimeline, timelineScenario } = useZoningModuleStore();
  const { timeline, loading: tlLoading, error: tlError, fetchTimeline } = useDealTimeline();
  const { benchmarks, loading: bmLoading, error: bmError, fetchBenchmarks } = useMunicipalBenchmarks();
  const { costs, loading: ccLoading, fetchCosts } = useCarryingCosts();

  useEffect(() => {
    fetchBenchmarks();
  }, [fetchBenchmarks]);

  useEffect(() => {
    if (selectedDealForTimeline) {
      fetchTimeline(selectedDealForTimeline, timelineScenario);
      fetchCosts(selectedDealForTimeline);
    }
  }, [selectedDealForTimeline, timelineScenario, fetchTimeline, fetchCosts]);

  const activeBenchmarks = benchmarks.length > 0 ? benchmarks : MOCK_BENCHMARKS;
  const activeTimeline = timeline || MOCK_TIMELINE;
  const activeJurisdictions = MOCK_JURISDICTIONS;
  const activeCapitalCalls = MOCK_CAPITAL_CALLS;

  return (
    <div className="space-y-4 p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-bold text-gray-900">Time-to-Shovel Intelligence</h2>
        <span className="text-xs text-gray-400">
          {activeTimeline.scenario.replace('_', ' ').toUpperCase()} Scenario
        </span>
      </div>

      {(tlLoading || bmLoading || ccLoading) && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Loading timeline data...
        </div>
      )}

      {(tlError || bmError) && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Using sample data — {tlError || bmError}
        </div>
      )}

      <MunicipalBenchmarkTable benchmarks={activeBenchmarks} />
      <GanttChart phases={activeTimeline.phases} totalMonths={activeTimeline.totalMonths} />
      <TimelineProbabilityBands benchmarks={activeBenchmarks} />
      <FinancialImpactTable timeline={activeTimeline} />
      <JurisdictionComparisonTable jurisdictions={activeJurisdictions} />
      <DealLengthMapper phases={activeTimeline.phases} totalMonths={activeTimeline.totalMonths} capitalCalls={activeCapitalCalls} />
    </div>
  );
}
