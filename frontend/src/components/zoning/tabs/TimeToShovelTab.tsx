import { T as BT } from '../../deal/bloomberg-tokens';
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
  if (trend === 'improving') return <span className="font-bold" style={{ color: BT.green }}>↓</span>;
  if (trend === 'worsening') return <span className="font-bold" style={{ color: BT.redL }}>↑</span>;
  return <span className="font-bold" style={{ color: BT.td }}>→</span>;
}

function DataSourceBadge({ source, count }: { source: 'real' | 'synthetic'; count?: number }) {
  if (source === 'real') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5"
        style={{ background: BT.greenBg, color: BT.greenL, border: `1px solid ${BT.green}50` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: BT.green }} />
        Real Data{count ? ` (${count})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5"
      style={{ background: BT.amberBg, color: BT.amberL, border: `1px solid ${BT.amber}50` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: BT.amber }} />
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
    <div className="rounded-lg border p-4" style={{ background: BT.bgCard, borderColor: BT.border }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: BT.td }}>Deal</label>
          <div className="text-sm border rounded-md px-3 py-2 truncate" style={{ color: BT.text, borderColor: BT.border, background: BT.bgPanel }}>
            {deal?.name || deal?.address || 'No deal selected'}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: BT.td }}>Development Path</label>
          <div className="flex items-center gap-1 border rounded-md p-1" style={{ background: BT.bgPanel, borderColor: BT.border }}>
            {paths.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectPath(p.id)}
                className={`flex-1 text-xs font-semibold px-2 py-1.5 rounded transition-all ${
                  developmentPath === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[#9EA8B4] hover:bg-[#1e2a3d] hover:text-[#C8C4BE]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: BT.td }}>Jurisdiction</label>
          <div className="text-sm border rounded-md px-3 py-2" style={{ color: BT.text, borderColor: BT.border, background: BT.bgPanel }}>
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
    <div className="rounded-lg border overflow-hidden" style={{ background: BT.bgCard, borderColor: BT.border }}>
      <div className="border-b px-5 py-3" style={{ background: BT.bgPanel, borderColor: BT.border }}>
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BT.text }}>Evidence Base</h3>
        <p className="text-xs mt-0.5" style={{ color: BT.td }}>Raw data from benchmark analysis</p>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* DETAILED PROCESSING STEPS */}
        {detailedSteps.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: BT.ts }}>Historical Processing Timeline</h4>
                <p className="text-[10px] mt-0.5" style={{ color: BT.td }}>Based on {totalSampleSize} {dataSource === 'real' ? 'real entitlement records' : 'estimated applications'}</p>
              </div>
              <DataSourceBadge source={dataSource} count={totalSampleSize} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: BT.borderL }}>
                    <th className="text-left py-2 px-2 font-semibold uppercase tracking-wide text-[10px]" style={{ color: BT.tm }}>Step</th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>
                      <div>P25</div><div className="font-normal" style={{ color: BT.td }}>(Fast)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>
                      <div>Median</div><div className="font-normal" style={{ color: BT.td }}>(Expected)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>
                      <div>P75</div><div className="font-normal" style={{ color: BT.td }}>(Typical)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>
                      <div>P90</div><div className="font-normal" style={{ color: BT.td }}>(Worst)</div>
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>n=</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedSteps.map((row, idx) => (
                    <tr key={idx} className={`border-b border-[#1e2a3d] ${row.isSubRow ? '' : 'hover:bg-[#131920]'}`}>
                      <td className={`py-1.5 px-2 ${row.isSubRow ? 'pl-6 text-[#6B7585] italic' : 'text-[#E8E6E1] font-medium'}`}>
                        {row.isSubRow && <span className="mr-1" style={{ color: BT.tm }}>{'\u251C\u2500'}</span>}
                        {row.step}
                      </td>
                      <td className="py-1.5 px-2 text-right" style={{ color: BT.tm }}>{row.p25}</td>
                      <td className="py-1.5 px-2 text-right font-semibold" style={{ color: BT.tm }}>{row.median}</td>
                      <td className="py-1.5 px-2 text-right" style={{ color: BT.tm }}>{row.p75}</td>
                      <td className="py-1.5 px-2 text-right text-red-400 font-semibold">{row.p90}</td>
                      <td className="py-1.5 px-2 text-right" style={{ color: BT.td }}>{row.n}</td>
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
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.ts }}>Median Time by Entitlement Type</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {benchmarks.map((b) => (
                <div key={b.id || b.entitlementType} className="rounded-lg border p-3" style={{ background: BT.bgPanel, borderColor: BT.border }}>
                  <p className="text-[10px] font-semibold uppercase" style={{ color: BT.tm }}>{b.entitlementType}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: BT.text }}>{b.medianMonths}<span className="text-xs font-normal" style={{ color: BT.td }}> mo</span></p>
                  <p className="text-[9px] mt-1" style={{ color: BT.td }}>n={b.sampleSize}</p>
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
                <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: BT.ts }}>Jurisdiction Comparison</h4>
                <p className="text-[10px] mt-0.5" style={{ color: BT.td }}>Median timeline across markets in this state</p>
              </div>
              <DataSourceBadge source={jurisdictionDataSource} count={jurisdictions.length} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: BT.borderL }}>
                    <th className="text-left py-2 px-2 font-semibold text-[10px] uppercase tracking-wide" style={{ color: BT.tm }}>Jurisdiction</th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>Median TTS</th>
                    <th className="text-center py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>Rank</th>
                    <th className="text-right py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>Carry Cost Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {jurisdictions.map((j) => {
                    const isSubject = j.carryCostDelta === 0 || (j as any).isSubject;
                    return (
                      <tr key={j.municipality} className={`border-b border-[#1e2a3d] ${isSubject ? 'bg-[#0d1e3d] border-l-2 border-l-blue-400' : 'hover:bg-[#131920]'}`}>
                        <td className="py-2 px-2 font-medium" style={{ color: BT.text }}>{j.municipality}</td>
                        <td className="py-2 px-2 text-right font-semibold" style={{ color: BT.tm }}>{j.medianTts}mo</td>
                        <td className="py-2 px-2 text-center" style={{ color: BT.tm }}>#{j.rank}</td>
                        <td className={`py-2 px-2 text-right font-semibold text-[10px] ${j.carryCostDelta < 0 ? 'text-green-600' : j.carryCostDelta > 0 ? 'text-red-400' : 'text-blue-600'}`}>
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
      <div className="border rounded-lg p-6 flex items-center justify-center gap-3" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <span className="text-sm" style={{ color: BT.tm }}>Computing timeline estimate...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-800/50 rounded-lg p-4 flex items-center justify-between" style={{ background: BT.redBg }}>
        <div>
          <p className="text-sm font-medium text-red-400">Timeline Analysis Failed</p>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
        <button onClick={onRerun} className="text-xs font-medium rounded px-3 py-1.5" style={{ color: BT.redL, border: `1px solid ${BT.red}50`, background: 'transparent' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!mcData && !intelligence) {
    return (
      <div className="border rounded-lg p-6 text-center" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <p className="text-sm" style={{ color: BT.td }}>Select a development path above to generate timeline estimates.</p>
        <p className="text-xs mt-1" style={{ color: BT.td }}>The simulation requires a path selection to compute phase durations.</p>
      </div>
    );
  }

  // Use Monte Carlo estimates for hero values
  const bestCase = mcData?.percentiles.p10 ?? 0;
  const expectedCase = mcData?.percentiles.p50 ?? 0;
  const worstCase = mcData?.percentiles.p90 ?? 0;

  const maxProb = mcData ? Math.max(...mcData.histogram.map(h => h.probability)) : 1;

  return (
    <div className="border rounded-lg overflow-hidden" style={{ background: BT.bgCard, borderColor: BT.border }}>
      <div className="px-5 py-3 border-b bg-gradient-to-r from-teal-50 to-cyan-50 flex items-center justify-between" style={{ borderColor: BT.border }}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BT.text }}>Timeline Estimate</h3>
          <p className="text-xs mt-0.5" style={{ color: BT.td }}>{pathLabel} path &mdash; Months to first shovel</p>
        </div>
        {mcData && <button onClick={onRerun} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Recalculate</button>}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* THE DEFINITIVE ANSWER: ONE ROW WITH THREE NUMBERS */}
        <div className="grid grid-cols-3 gap-4 rounded-lg border p-4" style={{ background: BT.bgPanel, borderColor: BT.border }}>
          <div className="text-center">
            <div className="text-sm font-medium uppercase tracking-wide" style={{ color: BT.tm }}>Best Case</div>
            <div className="text-4xl font-bold text-green-600 mt-2">{bestCase}</div>
            <div className="text-xs mt-1" style={{ color: BT.td }}>months</div>
          </div>
          <div className="text-center border-l border-r" style={{ borderColor: BT.borderL }}>
            <div className="text-sm font-medium uppercase tracking-wide" style={{ color: BT.tm }}>Expected</div>
            <div className="text-4xl font-bold text-blue-400 mt-2">{expectedCase}</div>
            <div className="text-xs mt-1" style={{ color: BT.td }}>months</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium uppercase tracking-wide" style={{ color: BT.tm }}>Worst Case</div>
            <div className="text-4xl font-bold text-red-400 mt-2">{worstCase}</div>
            <div className="text-xs mt-1" style={{ color: BT.td }}>months</div>
          </div>
        </div>

        {/* ATTRIBUTION */}
        {mcData && (
          <p className="text-[10px] text-center" style={{ color: BT.td }}>Based on Monte Carlo simulation ({mcData.nSimulations.toLocaleString()} iterations)</p>
        )}

        {/* PHASE BREAKDOWN */}
        {mcData && (() => {
          const isConstruction = (name: string) => /construction/i.test(name);
          const entitlementPhases = mcData.ganttPhases.filter(p => !isConstruction(p.name));
          const constructionPhase = mcData.ganttPhases.find(p => isConstruction(p.name));
          const entitlementMaxEnd = entitlementPhases.reduce((max, p) => Math.max(max, p.startMonth + p.p90Duration), 0.1);
          const entitlementScale = 100 / entitlementMaxEnd;
          return (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Phase Timeline (Best / Expected / Worst)</h4>
              {entitlementPhases.length > 0 && (
                <div className="space-y-2 mb-3">
                  <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: BT.td }}>Entitlement — {entitlementMaxEnd.toFixed(1)} mo (p90)</div>
                  {entitlementPhases.map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] w-32 text-right truncate font-medium" style={{ color: BT.tm }}>{phase.name}</span>
                      <div className="flex-1 h-4 rounded relative border overflow-hidden" style={{ background: BT.bgPanel, borderColor: BT.border }}>
                        <div className="absolute h-full bg-red-700/60 rounded" style={{ left: `${phase.startMonth * entitlementScale}%`, width: `${Math.max(3, phase.p90Duration * entitlementScale)}%` }} />
                        <div className="absolute h-full bg-blue-300 rounded" style={{ left: `${phase.startMonth * entitlementScale}%`, width: `${Math.max(3, phase.p50Duration * entitlementScale)}%` }} />
                        <div className="absolute h-full bg-green-400 rounded" style={{ left: `${phase.startMonth * entitlementScale}%`, width: `${Math.max(3, phase.p10Duration * entitlementScale)}%` }} />
                        <span className="absolute text-[8px] font-semibold" style={{ color: BT.tm }} style={{ left: `${Math.min(88, (phase.startMonth + phase.p50Duration / 2) * entitlementScale)}%`, top: '1px', transform: 'translateX(-50%)' }}>
                          {phase.p50Duration}mo
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {constructionPhase && (
                <div className="space-y-2">
                  <div className="text-[9px] uppercase tracking-wide mb-1" style={{ color: BT.td }}>Construction</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-32 text-right truncate font-medium" style={{ color: BT.tm }}>{constructionPhase.name}</span>
                    <div className="flex-1 h-4 rounded relative border overflow-hidden" style={{ background: BT.bgPanel, borderColor: BT.border }}>
                      <div className="absolute h-full bg-orange-700/40 rounded" style={{ left: 0, width: '100%' }} />
                      <div className="absolute h-full bg-orange-400 rounded" style={{ left: 0, width: `${(constructionPhase.p50Duration / Math.max(0.1, constructionPhase.p90Duration)) * 100}%` }} />
                      <div className="absolute h-full bg-orange-500 rounded" style={{ left: 0, width: `${(constructionPhase.p10Duration / Math.max(0.1, constructionPhase.p90Duration)) * 100}%` }} />
                      <span className="absolute text-[8px] text-white font-semibold" style={{ left: '50%', top: '1px', transform: 'translateX(-50%)' }}>
                        {constructionPhase.p50Duration}mo
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 justify-center text-[9px] flex-wrap" style={{ color: BT.td }}>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-green-400 rounded" />Best</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-blue-300 rounded" />Expected</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-red-700/60 rounded" />Worst</span>
                {constructionPhase && <span className="flex items-center gap-1"><span className="w-2.5 h-2 bg-orange-400 rounded" />Construction</span>}
              </div>
            </div>
          );
        })()}

        {/* PROBABILITY DISTRIBUTION */}
        {mcData && mcData.histogram.filter(h => h.probability > 0.001).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Probability Distribution</h4>
            <div className="flex items-end gap-px rounded-lg border px-2 pt-2" style={{ background: BT.bgPanel, borderColor: BT.border }} style={{ height: '80px' }}>
              {mcData.histogram.filter(h => h.probability > 0.001).map((h, i) => {
                const heightPct = (h.probability / maxProb) * 100;
                const isExpected = Math.abs(h.monthBucket - expectedCase) < 2;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-colors cursor-default ${isExpected ? 'bg-blue-600' : 'bg-blue-300 hover:bg-blue-400'}`}
                    style={{ height: `${Math.max(3, heightPct)}%` }}
                    title={`${h.monthBucket} months: ${(h.probability * 100).toFixed(1)}%`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[8px] mt-1 px-2" style={{ color: BT.td }}>
              {(() => {
                const bars = mcData.histogram.filter(h => h.probability > 0.001);
                if (bars.length === 0) return null;
                const first = bars[0];
                const mid = bars[Math.floor(bars.length / 2)];
                const last = bars[bars.length - 1];
                return [first, mid, last].filter(Boolean).map(b => (
                  <span key={b.monthBucket}>{b.monthBucket}mo</span>
                ));
              })()}
            </div>
          </div>
        )}

        {/* FINANCIAL IMPACT */}
        {mcData && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Financial Impact</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Best (P10)', data: mcData.financialImpact.p10, color: 'border-green-800/50 bg-[#022c22]' },
                { label: 'Expected (P50)', data: mcData.financialImpact.p50, color: 'border-blue-900/50 bg-[#0d1e3d]' },
                { label: 'Worst (P90)', data: mcData.financialImpact.p90, color: 'border-red-800/50 bg-[#1c0a0a]' },
              ].map(item => (
                <div key={item.label} className={`border rounded p-2 ${item.color}`}>
                  <div className="text-[9px] font-medium" style={{ color: BT.tm }}>{item.label}</div>
                  <div className="text-xs font-bold mt-0.5" style={{ color: BT.text }}>${(item.data.carryingCost / 1000).toFixed(0)}K</div>
                  <div className={`text-[9px] font-medium ${item.data.irrImpact < -1 ? 'text-red-400' : 'text-amber-400'}`}>
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
      <div className="border rounded-lg p-6 text-center" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <p className="text-sm" style={{ color: BT.td }}>Select a development path to see AI timeline analysis.</p>
      </div>
    );
  }

  if (intelligenceLoading) {
    return (
      <div className="border rounded-lg p-6 flex flex-col items-center justify-center" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-sm" style={{ color: BT.td }}>Generating AI timeline intelligence...</p>
        <p className="text-xs mt-1" style={{ color: BT.td }}>Analyzing benchmark data and regulatory environment</p>
      </div>
    );
  }

  if (intelligenceError) {
    return (
      <div className="border border-red-800/50 rounded-lg p-4" style={{ background: BT.redBg }}>
        <p className="text-sm font-medium text-red-400">Timeline Intelligence Error</p>
        <p className="text-xs text-red-400 mt-1">{intelligenceError}</p>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="border rounded-lg p-6 text-center" style={{ background: BT.bgCard, borderColor: BT.border }}>
        <p className="text-sm" style={{ color: BT.td }}>AI timeline analysis unavailable for this deal.</p>
        <p className="text-xs mt-1" style={{ color: BT.td }}>Ensure zoning profile and benchmark data are loaded.</p>
      </div>
    );
  }

  const severityColors: Record<string, string> = {
    low: 'text-green-400 bg-[#022c22] border-green-800/50',
    moderate: 'text-amber-400 bg-[#1a1200] border-amber-800/50',
    high: 'text-red-400 bg-[#1c0a0a] border-red-800/50',
  };

  return (
    <div className="border rounded-lg overflow-hidden" style={{ background: BT.bgCard, borderColor: BT.border }}>
      <div className="px-5 py-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between" style={{ borderColor: BT.border }}>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: BT.text }}>AI Timeline Intelligence</h3>
          <p className="text-xs mt-0.5" style={{ color: BT.td }}>
            Deal-specific analysis from {intelligence.dataLibraryContext.benchmarkCount} benchmarks
            {intelligence.dataLibraryContext.hasCostData && ' + Data Library costs'}
          </p>
        </div>
        <span className="text-[10px]" style={{ color: BT.td }}>Generated {new Date(intelligence.generatedAt).toLocaleDateString()}</span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {intelligence.pathInsights && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Path Analysis</h4>
            <p className="text-sm mb-3" style={{ color: BT.tm }}>{intelligence.pathInsights.summary}</p>
            <div className="grid grid-cols-2 gap-3">
              {intelligence.pathInsights.advantages.length > 0 && (
                <div className="border border-green-800/50 rounded-lg p-3" style={{ background: BT.greenBg }}>
                  <p className="text-[10px] font-semibold text-green-300 uppercase mb-1">Advantages</p>
                  <ul className="space-y-1">
                    {intelligence.pathInsights.advantages.map((a, i) => (
                      <li key={i} className="text-xs text-green-400 flex items-start gap-1">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">+</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {intelligence.pathInsights.challenges.length > 0 && (
                <div className="border border-amber-800/50 rounded-lg p-3" style={{ background: BT.amberBg }}>
                  <p className="text-[10px] font-semibold text-amber-300 uppercase mb-1">Challenges</p>
                  <ul className="space-y-1">
                    {intelligence.pathInsights.challenges.map((c, i) => (
                      <li key={i} className="text-xs text-amber-400 flex items-start gap-1">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">!</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {intelligence.pathInsights.alternativePath && (
              <p className="text-xs mt-2 italic" style={{ color: BT.td }}>{intelligence.pathInsights.alternativePath}</p>
            )}
          </div>
        )}

        {intelligence.riskFactors.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Timeline Risk Factors</h4>
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
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Critical Milestones</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2" style={{ borderColor: BT.borderL }}>
                    <th className="text-left py-2 px-2 font-semibold text-[10px] uppercase" style={{ color: BT.tm }}>Milestone</th>
                    <th className="text-center py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>Month</th>
                    <th className="text-center py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>Critical Path</th>
                    <th className="text-left py-2 px-2 font-medium text-[10px]" style={{ color: BT.td }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {intelligence.criticalMilestones.map((ms, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: BT.border }}>
                      <td className="py-1.5 px-2 font-medium" style={{ color: BT.text }}>{ms.milestone}</td>
                      <td className="py-1.5 px-2 text-center font-semibold" style={{ color: BT.tm }}>{ms.estimatedMonth}</td>
                      <td className="py-1.5 px-2 text-center">{ms.criticalPath ? <span className="text-red-400 font-bold">Yes</span> : <span style={{ color: BT.td }}>No</span>}</td>
                      <td className="py-1.5 px-2" style={{ color: BT.tm }}>{ms.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {intelligence.benchmarkComparison && intelligence.benchmarkComparison.summary && (
          <div className="border border-blue-900/50 rounded-lg p-3" style={{ background: BT.blueBg }}>
            <p className="text-[10px] font-semibold text-blue-300 uppercase mb-1">Benchmark Comparison</p>
            <p className="text-xs text-blue-400">{intelligence.benchmarkComparison.summary}</p>
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
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BT.tm }}>Recommendations</h4>
            <ul className="space-y-1.5">
              {intelligence.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">&#x2713;</span>
                  <span className="text-sm" style={{ color: BT.tm }}>{rec}</span>
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
  const [geographicMunicipality, setGeographicMunicipality] = useState<string>('');

  const county = deal?.county || 'Fulton';
  const state = geographicState;
  const municipality = geographicMunicipality || deal?.municipality || deal?.city || '';
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
    setMcData(null);
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
    setGeographicState('GA');
    setGeographicMunicipality('');
  }, [dealId]);

  useEffect(() => {
    const fetchGeographicContext = async () => {
      if (!dealId) return;
      try {
        const resp = await apiClient.get(`/api/v1/deals/${dealId}/zoning-confirmation`);
        if (resp.data?.state) {
          setGeographicState(resp.data.state);
        }
        if (resp.data?.municipality) {
          setGeographicMunicipality(resp.data.municipality);
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

    fetchGeographicContext();

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
      <div className="border border-amber-800/50 rounded-lg p-6 text-center" style={{ background: BT.amberBg }}>
        <p className="text-sm text-amber-400">Select a deal to view Time-to-Shovel analysis.</p>
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
