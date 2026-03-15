import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import { apiClient } from '../../../services/api.client';
import type {
  MunicipalBenchmark,
  JurisdictionComparison,
} from '../../../types/zoning.types';

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function TrendArrow({ trend }: { trend: 'improving' | 'stable' | 'worsening' }) {
  if (trend === 'improving') return <span className="text-green-600 font-bold">{'\u2193'}</span>;
  if (trend === 'worsening') return <span className="text-red-600 font-bold">{'\u2191'}</span>;
  return <span className="text-gray-400 font-bold">{'\u2192'}</span>;
}

function DataSourceBadge({ source, count }: { source: 'real' | 'synthetic'; count?: number }) {
  if (source === 'real') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        Real Data{count ? ` (${count})` : ''}
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

interface DetailedStep {
  step: string;
  p25: string;
  median: string;
  p75: string;
  p90: string;
  n: string;
  isSubRow: boolean;
}

interface MonteCarloData {
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; stdDev: number };
  phases: { preApp: number; sitePlan: number; hearing: number; approval: number; permit: number; construction: number; total: number };
  financialImpact: { p10: { carryingCost: number; irrImpact: number }; p50: { carryingCost: number; irrImpact: number }; p90: { carryingCost: number; irrImpact: number } };
  ganttPhases: Array<{ name: string; startMonth: number; p10Duration: number; p50Duration: number; p90Duration: number }>;
  histogram: Array<{ monthBucket: number; probability: number; cumulative: number }>;
  sampleSize: number;
  nSimulations: number;
}

interface TimelineIntelligence {
  estimatedMonths: { optimistic: number; expected: number; worstCase: number };
  shovelDateRange: { earliest: string; likely: string; latest: string };
  riskFactors: Array<{ factor: string; severity: string; impact: string; mitigation: string }>;
  pathInsights: { summary: string; advantages: string[]; challenges: string[]; alternativePath: string };
  benchmarkComparison: { summary: string; fastestComparable: string; slowestComparable: string; avgDays: number | null };
  recommendations: string[];
  criticalMilestones: Array<{ milestone: string; estimatedMonth: number; criticalPath: boolean; note: string }>;
  dataLibraryContext: { benchmarkCount: number; pathBenchmarkCount: number; hasPermitTimelines: boolean; hasCostData: boolean };
  generatedAt: string;
}

interface TimeToShovelTabProps {
  dealId?: string;
  deal?: any;
}

function DealContextBar({ deal, developmentPath, unitCount, municipality, onSelectPath }: { deal?: any; developmentPath: string | null; unitCount: number; municipality: string; onSelectPath: (path: string) => void }) {
  const paths = [
    { id: 'by_right', label: 'By-Right' },
    { id: 'overlay_bonus', label: 'Overlay Bonus' },
    { id: 'variance', label: 'Variance' },
    { id: 'rezone', label: 'Rezone' },
  ];
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Deal</label>
          <div className="text-sm text-gray-900 border border-gray-200 rounded-md px-3 py-2 bg-gray-50 truncate">
            {deal?.name || deal?.address || 'No deal selected'}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Development Path</label>
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md p-1">
            {paths.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectPath(p.id)}
                className={`flex-1 text-xs font-semibold px-2 py-1.5 rounded transition-all ${
                  developmentPath === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Jurisdiction</label>
          <div className="text-sm text-gray-900 border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
            {municipality || 'Unknown'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// SECTION 2: EVIDENCE BASE (RAW DATA)
// ========================================

function EvidenceBaseSection({ benchmarks, detailedSteps, dataSource, totalSampleCount, jurisdictions, jurisdictionDataSource }:
  { benchmarks: MunicipalBenchmark[]; detailedSteps: DetailedStep[]; dataSource: 'real' | 'synthetic'; totalSampleCount: number; jurisdictions: JurisdictionComparison[]; jurisdictionDataSource: 'real' | 'synthetic' }) {

  const totalSampleSize = totalSampleCount || benchmarks.reduce((sum, b) => sum + b.sampleSize, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Evidence Base</h3>
        <p className="text-xs text-gray-500 mt-0.5">Raw data from benchmark analysis</p>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* DETAILED PROCESSING STEPS */}
        {detailedSteps.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Historical Processing Timeline</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Based on {totalSampleSize} {dataSource === 'real' ? 'real entitlement records' : 'estimated applications'}</p>
              </div>
              <DataSourceBadge source={dataSource} count={totalSampleSize} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2 font-semibold text-gray-700 uppercase tracking-wide text-[10px]">Step</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                      <div>P25</div><div className="font-normal text-gray-400">(Fast)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                      <div>Median</div><div className="font-normal text-gray-400">(Expected)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                      <div>P75</div><div className="font-normal text-gray-400">(Typical)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">
                      <div>P90</div><div className="font-normal text-gray-400">(Worst)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">n=</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedSteps.map((row, idx) => (
                    <tr key={idx} className={`border-b border-gray-100 ${row.isSubRow ? '' : 'hover:bg-gray-50'}`}>
                      <td className={`py-1.5 px-2 ${row.isSubRow ? 'pl-6 text-gray-500 italic' : 'text-gray-900 font-medium'}`}>
                        {row.isSubRow && <span className="text-gray-300 mr-1">{'\u251C\u2500'}</span>}
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
          </div>
        )}

        {/* ENTITLEMENT TYPE SUMMARY */}
        {benchmarks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide mb-2">Median Time by Entitlement Type</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {benchmarks.map((b) => (
                <div key={b.id || b.entitlementType} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <p className="text-[10px] font-semibold text-gray-700 uppercase">{b.entitlementType}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{b.medianMonths}<span className="text-xs font-normal text-gray-500"> mo</span></p>
                  <p className="text-[9px] text-gray-500 mt-1">n={b.sampleSize}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JURISDICTION COMPARISON */}
        {jurisdictions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Jurisdiction Comparison</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Median timeline across markets in this state</p>
              </div>
              <DataSourceBadge source={jurisdictionDataSource} count={jurisdictions.length} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2 font-semibold text-gray-700 text-[10px] uppercase tracking-wide">Jurisdiction</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Median TTS</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 text-[10px]">Rank</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500 text-[10px]">Carry Cost Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {jurisdictions.map((j) => {
                    const isSubject = j.carryCostDelta === 0 || (j as any).isSubject;
                    return (
                      <tr key={j.municipality} className={`border-b border-gray-100 ${isSubject ? 'bg-blue-50 border-l-2 border-l-blue-400' : 'hover:bg-gray-50'}`}>
                        <td className="py-2 px-2 font-medium text-gray-900">{j.municipality}</td>
                        <td className="py-2 px-2 text-right text-gray-700 font-semibold">{j.medianTts}mo</td>
                        <td className="py-2 px-2 text-center text-gray-600">#{j.rank}</td>
                        <td className={`py-2 px-2 text-right font-semibold text-[10px] ${j.carryCostDelta < 0 ? 'text-green-600' : j.carryCostDelta > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {j.carryCostDeltaLabel || (isSubject ? 'Subject' : '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// SECTION 1: TIMELINE ESTIMATE (ONE DEFINITIVE ANSWER)
// ========================================

function TimelineEstimateSection({ mcData, loading, error, onRerun, pathLabel, intelligence }:
  { mcData: MonteCarloData | null; loading: boolean; error: string | null; onRerun: () => void; pathLabel: string; intelligence: TimelineIntelligence | null }) {

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-center gap-3">
        <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <span className="text-sm text-gray-600">Computing timeline estimate...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-red-700">Timeline Analysis Failed</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
        <button onClick={onRerun} className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-300 rounded px-3 py-1.5 hover:bg-red-100">
          Retry
        </button>
      </div>
    );
  }

  if (!mcData && !intelligence) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">Select a development path above to generate timeline estimates.</p>
        <p className="text-xs text-gray-400 mt-1">The simulation requires a path selection to compute phase durations.</p>
      </div>
    );
  }

  // Use Monte Carlo estimates for hero values
  const bestCase = mcData?.percentiles.p10 ?? 0;
  const expectedCase = mcData?.percentiles.p50 ?? 0;
  const worstCase = mcData?.percentiles.p90 ?? 0;

  const maxProb = mcData ? Math.max(...mcData.histogram.map(h => h.probability)) : 1;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Timeline Estimate</h3>
          <p className="text-xs text-gray-500 mt-0.5">{pathLabel} path &mdash; Months to first shovel</p>
        </div>
        {mcData && <button onClick={onRerun} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Recalculate</button>}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* THE DEFINITIVE ANSWER: ONE ROW WITH THREE NUMBERS */}
        <div className="grid grid-cols-3 gap-4 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-gray-200 p-4">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Best Case</div>
            <div className="text-4xl font-bold text-green-600 mt-2">{bestCase}</div>
            <div className="text-xs text-gray-500 mt-1">months</div>
          </div>
          <div className="text-center border-l border-r border-gray-300">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Expected</div>
            <div className="text-4xl font-bold text-blue-700 mt-2">{expectedCase}</div>
            <div className="text-xs text-gray-500 mt-1">months</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">Worst Case</div>
            <div className="text-4xl font-bold text-red-600 mt-2">{worstCase}</div>
            <div className="text-xs text-gray-500 mt-1">months</div>
          </div>
        </div>

        {/* ATTRIBUTION */}
        {mcData && (
          <p className="text-[10px] text-gray-400 text-center">Based on Monte Carlo simulation ({mcData.nSimulations.toLocaleString()} iterations)</p>
        )}

        {/* PHASE BREAKDOWN */}
        {mcData && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Phase Timeline (Best / Expected / Worst)</h4>
            <div className="space-y-2">
              {mcData.ganttPhases.map((phase, i) => {
                const maxEnd = mcData!.ganttPhases.reduce((max, p) => Math.max(max, p.startMonth + p.p90Duration), 0);
                const scale = 100 / Math.max(1, maxEnd);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 w-32 text-right truncate font-medium">{phase.name}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded relative border border-gray-200">
                      <div className="absolute h-full bg-red-200 rounded" style={{ left: `${phase.startMonth * scale}%`, width: `${phase.p90Duration * scale}%` }} />
                      <div className="absolute h-full bg-blue-300 rounded" style={{ left: `${phase.startMonth * scale}%`, width: `${phase.p50Duration * scale}%` }} />
                      <div className="absolute h-full bg-green-400 rounded" style={{ left: `${phase.startMonth * scale}%`, width: `${phase.p10Duration * scale}%` }} />
                      <span className="absolute text-[8px] text-gray-700 font-semibold" style={{ left: `${(phase.startMonth + phase.p50Duration / 2) * scale}%`, top: '1px', transform: 'translateX(-50%)' }}>
                        {phase.p50Duration}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center text-[9px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-green-400 rounded" />Best</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-blue-300 rounded" />Expected</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-red-200 rounded" />Worst</span>
            </div>
          </div>
        )}

        {/* PROBABILITY DISTRIBUTION */}
        {mcData && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Probability Distribution</h4>
            <div className="flex items-end gap-px h-20 bg-gray-50 rounded-lg p-2 border border-gray-200">
              {mcData.histogram.filter(h => h.probability > 0.001).map((h, i) => {
                const heightPct = (h.probability / maxProb) * 100;
                const isExpected = Math.abs(h.monthBucket - expectedCase) < 2;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className={`w-full rounded-t transition-colors ${isExpected ? 'bg-blue-600' : 'bg-blue-300 group-hover:bg-blue-400'}`}
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                    />
                    {i % 3 === 0 && <span className="text-[8px] text-gray-500 mt-0.5">{h.monthBucket}m</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FINANCIAL IMPACT */}
        {mcData && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Financial Impact</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Best (P10)', data: mcData.financialImpact.p10, color: 'border-green-200 bg-green-50' },
                { label: 'Expected (P50)', data: mcData.financialImpact.p50, color: 'border-blue-200 bg-blue-50' },
                { label: 'Worst (P90)', data: mcData.financialImpact.p90, color: 'border-red-200 bg-red-50' },
              ].map(item => (
                <div key={item.label} className={`border rounded p-2 ${item.color}`}>
                  <div className="text-[9px] font-medium text-gray-600">{item.label}</div>
                  <div className="text-xs font-bold text-gray-900 mt-0.5">${(item.data.carryingCost / 1000).toFixed(0)}K</div>
                  <div className={`text-[9px] font-medium ${item.data.irrImpact < -1 ? 'text-red-600' : 'text-amber-600'}`}>
                    {item.data.irrImpact > 0 ? '+' : ''}{item.data.irrImpact}% IRR
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// SECTION 3: AI ANALYSIS (QUALITATIVE INSIGHTS)
// ========================================

function AIAnalysisSection({ developmentPath, intelligence, intelligenceLoading, intelligenceError }: {
  developmentPath: string | null;
  intelligence: TimelineIntelligence | null;
  intelligenceLoading: boolean;
  intelligenceError: string | null;
}) {
  if (!developmentPath) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">Select a development path to see AI timeline analysis.</p>
      </div>
    );
  }

  if (intelligenceLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-sm text-gray-500">Generating AI timeline intelligence...</p>
        <p className="text-xs text-gray-400 mt-1">Analyzing benchmark data and regulatory environment</p>
      </div>
    );
  }

  if (intelligenceError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm font-medium text-red-700">Timeline Intelligence Error</p>
        <p className="text-xs text-red-600 mt-1">{intelligenceError}</p>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-500">AI timeline analysis unavailable for this deal.</p>
        <p className="text-xs text-gray-400 mt-1">Ensure zoning profile and benchmark data are loaded.</p>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    low: 'text-green-700 bg-green-50 border-green-200',
    moderate: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    high: 'text-red-700 bg-red-50 border-red-200',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">AI Timeline Intelligence</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Deal-specific analysis from {intelligence.dataLibraryContext.benchmarkCount} benchmarks
            {intelligence.dataLibraryContext.hasCostData && ' + Data Library costs'}
          </p>
        </div>
        <span className="text-[10px] text-gray-400">Generated {new Date(intelligence.generatedAt).toLocaleDateString()}</span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {intelligence.pathInsights && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Path Analysis</h4>
            <p className="text-sm text-gray-700 mb-3">{intelligence.pathInsights.summary}</p>
            <div className="grid grid-cols-2 gap-3">
              {intelligence.pathInsights.advantages.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-green-800 uppercase mb-1">Advantages</p>
                  <ul className="space-y-1">
                    {intelligence.pathInsights.advantages.map((a, i) => (
                      <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">+</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {intelligence.pathInsights.challenges.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-amber-800 uppercase mb-1">Challenges</p>
                  <ul className="space-y-1">
                    {intelligence.pathInsights.challenges.map((c, i) => (
                      <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {intelligence.pathInsights.alternativePath && (
              <p className="text-xs text-gray-500 mt-2 italic">{intelligence.pathInsights.alternativePath}</p>
            )}
          </div>
        )}

        {intelligence.riskFactors.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Timeline Risk Factors</h4>
            <div className="space-y-2">
              {intelligence.riskFactors.map((rf, i) => (
                <div key={i} className={`border rounded-lg p-3 ${severityColors[rf.severity] || severityColors.moderate}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase">{rf.severity}</span>
                    <span className="text-xs font-semibold">{rf.factor}</span>
                  </div>
                  <p className="text-xs opacity-90 mb-1">{rf.impact}</p>
                  <p className="text-[10px] opacity-75">Mitigation: {rf.mitigation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {intelligence.criticalMilestones.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Critical Milestones</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2 font-semibold text-gray-700 text-[10px] uppercase">Milestone</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 text-[10px]">Month</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 text-[10px]">Critical Path</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 text-[10px]">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {intelligence.criticalMilestones.map((ms, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 px-2 text-gray-900 font-medium">{ms.milestone}</td>
                      <td className="py-1.5 px-2 text-center text-gray-700 font-semibold">{ms.estimatedMonth}</td>
                      <td className="py-1.5 px-2 text-center">{ms.criticalPath ? <span className="text-red-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>}</td>
                      <td className="py-1.5 px-2 text-gray-600">{ms.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {intelligence.benchmarkComparison && intelligence.benchmarkComparison.summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-blue-800 uppercase mb-1">Benchmark Comparison</p>
            <p className="text-xs text-blue-700">{intelligence.benchmarkComparison.summary}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {intelligence.benchmarkComparison.fastestComparable && (
                <p className="text-[10px] text-blue-600">Fastest: {intelligence.benchmarkComparison.fastestComparable}</p>
              )}
              {intelligence.benchmarkComparison.slowestComparable && (
                <p className="text-[10px] text-blue-600">Slowest: {intelligence.benchmarkComparison.slowestComparable}</p>
              )}
            </div>
          </div>
        )}

        {intelligence.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Recommendations</h4>
            <ul className="space-y-1.5">
              {intelligence.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">&#x2713;</span>
                  <span className="text-sm text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


export default function TimeToShovelTab({ dealId, deal }: TimeToShovelTabProps = {}) {
  const { development_path, selected_envelope, selectDevelopmentPath } = useZoningModuleStore();

  const [mcData, setMcData] = useState<MonteCarloData | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);
  const [intelligence, setIntelligence] = useState<TimelineIntelligence | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null);
  const [benchmarks, setBenchmarks] = useState<MunicipalBenchmark[]>([]);
  const [detailedSteps, setDetailedSteps] = useState<DetailedStep[]>([]);
  const [stepsDataSource, setStepsDataSource] = useState<'real' | 'synthetic'>('synthetic');
  const [benchmarkDataSource, setBenchmarkDataSource] = useState<'real' | 'synthetic'>('synthetic');
  const [totalSampleCount, setTotalSampleCount] = useState(0);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionComparison[]>([]);
  const [jurisdictionDataSource, setJurisdictionDataSource] = useState<'real' | 'synthetic'>('synthetic');
  const [geographicState, setGeographicState] = useState<string>('GA');

  const county = deal?.county || 'Fulton';
  const state = geographicState;
  const municipality = deal?.municipality || deal?.city || '';
  const unitCount = selected_envelope?.max_units || deal?.unit_count || 0;
  const pathLabel = { by_right: 'By-Right', overlay_bonus: 'Overlay Bonus', variance: 'Variance', rezone: 'Full Rezone' }[development_path || ''] || development_path || 'None';

  // Default to 'by_right' path on first load
  useEffect(() => {
    if (!development_path && dealId) {
      selectDevelopmentPath('by_right' as any, selected_envelope);
    }
  }, [dealId]);

  const runSimulation = useCallback(async () => {
    if (!dealId || !development_path) return;
    setMcLoading(true);
    setMcError(null);
    try {
      const res = await apiClient.post('/api/v1/benchmark-timeline/simulate', {
        dealId,
        county,
        state,
        developmentPath: development_path,
        unitCount: unitCount || 200,
        projectType: deal?.project_type || 'multifamily',
      });
      setMcData(res.data);
    } catch (err: any) {
      setMcData(null);
      setMcError(err.response?.data?.error || err.message || 'Simulation failed');
    } finally {
      setMcLoading(false);
    }
  }, [dealId, development_path, county, state, unitCount, deal]);

  useEffect(() => {
    if (development_path) runSimulation();
  }, [development_path, runSimulation]);

  useEffect(() => {
    const fetchGeographicState = async () => {
      if (!dealId) return;
      try {
        const resp = await apiClient.get(`/api/v1/deals/${dealId}/zoning-confirmation`);
        if (resp.data?.state) {
          setGeographicState(resp.data.state);
        }
      } catch {
        setGeographicState('GA');
      }
    };

    const fetchIntelligence = async () => {
      if (!dealId || !development_path) return;
      setIntelligenceLoading(true);
      setIntelligenceError(null);
      try {
        const resp = await apiClient.get(`/api/v1/deals/${dealId}/timeline-intelligence`, {
          params: { path: development_path },
          timeout: 90000,
        });
        setIntelligence(resp.data);
      } catch (err: any) {
        setIntelligence(null);
        setIntelligenceError(err.response?.data?.error || err.message || 'Failed to load intelligence');
      } finally {
        setIntelligenceLoading(false);
      }
    };

    fetchGeographicState();

    const fetchBenchmarks = async () => {
      try {
        const res = await apiClient.get('/api/v1/benchmark-timeline/benchmarks', { params: { county, state } });
        const data = res.data;
        if (data.summaries && data.summaries.length > 0) {
          const mapped = data.summaries.map((s: any, i: number) => ({
            id: String(i), municipality, state, projectType: 'Multifamily',
            unitCountMin: 100, unitCountMax: 999,
            entitlementType: s.entitlementType,
            medianMonths: s.medianMonths, p25Months: s.p25Months,
            p50Months: s.medianMonths, p75Months: s.p75Months, p90Months: s.p90Months,
            sampleSize: s.sampleSize, trend: s.trend || 'stable',
            lastUpdated: new Date().toISOString().slice(0, 10),
          }));
          setBenchmarks(mapped);
          setBenchmarkDataSource(data.summaries[0]?.dataSource || 'synthetic');
          setTotalSampleCount(data.summaries.reduce((sum: number, s: any) => sum + (s.sampleSize || 0), 0));
        }
      } catch {
        setBenchmarkDataSource('synthetic');
      }
    };

    const fetchSteps = async () => {
      try {
        const res = await apiClient.get('/api/v1/benchmark-timeline/detailed-steps', { params: { county, state } });
        if (res.data.steps && res.data.steps.length > 0) {
          setDetailedSteps(res.data.steps);
          setStepsDataSource(res.data.dataSource || 'synthetic');
        }
      } catch {
        setStepsDataSource('synthetic');
      }
    };

    const fetchJurisdictions = async () => {
      try {
        const res = await apiClient.get('/api/v1/benchmark-timeline/jurisdiction-comparison', {
          params: { state, subjectMunicipality: municipality },
        });
        if (res.data.jurisdictions && res.data.jurisdictions.length > 0) {
          const mapped: JurisdictionComparison[] = res.data.jurisdictions.map((j: any) => ({
            municipality: j.municipality, state,
            medianTts: j.medianMonths, rank: j.rank,
            trend: 'stable' as const,
            sampleSize: j.sampleSize,
            isSubject: j.isSubject,
            carryCostDelta: Math.round(j.carryCostDelta || 0),
            carryCostDeltaLabel: j.isSubject ? 'Subject'
              : j.carryCostDelta < 0 ? `-$${Math.abs(Math.round(j.carryCostDelta / 1000))}K vs subject`
              : `+$${Math.round(j.carryCostDelta / 1000)}K vs subject`,
          }));
          setJurisdictions(mapped);
          setJurisdictionDataSource(res.data.dataSource || 'synthetic');
        }
      } catch {
        setJurisdictionDataSource('synthetic');
      }
    };

    fetchBenchmarks();
    fetchSteps();
    fetchJurisdictions();
    fetchIntelligence();
  }, [county, state, municipality, dealId, development_path]);

  if (!dealId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-sm text-yellow-700">Select a deal to view Time-to-Shovel analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DealContextBar
        deal={deal}
        developmentPath={development_path}
        unitCount={unitCount}
        municipality={municipality}
        onSelectPath={(pathId) => selectDevelopmentPath(pathId as any, selected_envelope)}
      />

      {/* SECTION 1: DEFINITIVE TIMELINE ESTIMATE (ONE ANSWER) */}
      <TimelineEstimateSection
        mcData={mcData}
        loading={mcLoading}
        error={mcError}
        onRerun={runSimulation}
        pathLabel={pathLabel}
        intelligence={intelligence}
      />

      {/* SECTION 2: EVIDENCE BASE (RAW DATA) */}
      {(benchmarks.length > 0 || detailedSteps.length > 0 || jurisdictions.length > 0) && (
        <EvidenceBaseSection
          benchmarks={benchmarks}
          detailedSteps={detailedSteps}
          dataSource={stepsDataSource === 'real' || benchmarkDataSource === 'real' ? 'real' : 'synthetic'}
          totalSampleCount={totalSampleCount}
          jurisdictions={jurisdictions}
          jurisdictionDataSource={jurisdictionDataSource}
        />
      )}

      {/* SECTION 3: AI ANALYSIS (QUALITATIVE INSIGHTS) */}
      <AIAnalysisSection
        developmentPath={development_path}
        intelligence={intelligence}
        intelligenceLoading={intelligenceLoading}
        intelligenceError={intelligenceError}
      />
    </div>
  );
}
