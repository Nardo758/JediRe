/**
 * JEDI RE — ProForma Engine (M09) with Traffic Engine (M07) Integration
 * Deal Capsule → ProForma Tab (Enhanced)
 *
 * THE PROBLEM: ProForma hardcodes assumptions; all user-entered.
 * THE FIX: Traffic Engine v2 pushes 4 numbers that replace hardcoded assumptions.
 *
 * M07 → M09 Translation:
 *   Occupancy Trajectory (10yr) → Vacancy % per year
 *   Eff Rent Trajectory (10yr)  → Rent Growth % per year
 *   Net Leases × 52 (seasonal)  → Absorption Rate (dev deals)
 *   Weeks to 95% Occupancy      → Lease-Up Timeline (dev deals)
 *
 * 4 tabs: Traffic → ProForma | 3-Layer Assumptions | 10-Year Income Statement | Returns
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRight, Layers, TrendingUp, DollarSign, BarChart3,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  RefreshCw, Beaker, Loader2, Rocket,
} from 'lucide-react';
import { Deal } from '@/types';
import api from '@/lib/api';

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════

interface AnnualTrafficPrediction {
  year: number;
  weeklyTraffic: number;
  weeklyTours: number;
  weeklyApps: number;
  weeklyLeases: number;
  closingRatio: number;
  occPct: number;
  effRent: number;
  annualLeases: number;
  turnover: number;
  confidence: number;
}

interface OccupancyTrajectoryPoint {
  year: number;
  occ: number;
  vacancy: number;
  confidence: number;
}

interface RentTrajectoryPoint {
  year: number;
  effRent: number;
  growth: number;
  confidence: number;
}

interface TrafficHandoff {
  rawTraffic: AnnualTrafficPrediction[];
  occupancyTrajectory: OccupancyTrajectoryPoint[];
  rentTrajectory: RentTrajectoryPoint[];
  leasingVelocity: { weeklyLeases: number; annualized: number; confidence: number };
  leaseUpTimeline: { weeksTo95: number; weeksTo93: number; weeksTo90: number } | null;
  dataWeeks: number;
  lastCalibrated: string;
  modelConfidence: number;
}

interface ThreeLayerAssumption {
  id: string;
  label: string;
  category: string;
  baseline: { values: (number | null)[]; source: string; conf: number };
  platform: { values: (number | null)[]; source: string; conf: number; module: string | null };
  override: { values: (number | null)[]; active: boolean };
  unit: string;
  direction: 'lower-is-better' | 'higher-is-better';
  insight: string;
}

interface ProFormaYear {
  year: number;
  rent: number;
  gpr: number;
  vacancy: string;
  vacancyLoss: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  btcf: number;
  capRate: string;
}

interface ReturnsComparison {
  irr: { platform: string; baseline: string; delta: string };
  equityMultiple: { platform: string; baseline: string; delta: string };
  cashOnCash: { platform: string; baseline: string; delta: string };
  exitValue: { platform: string; baseline: string; delta: string };
  dscr: { platform: string; baseline: string; delta: string };
}

interface TrafficProFormaData {
  handoff: TrafficHandoff;
  assumptions: ThreeLayerAssumption[];
  incomeStatement: { platform: ProFormaYear[]; baseline: ProFormaYear[] };
  returns: ReturnsComparison;
  property: { name: string; units: number; type: string; acquisitionPrice: number };
}

interface ProFormaWithTrafficSectionProps {
  deal?: Deal;
}

// ════════════════════════════════════════════════════════════════════
// Mock Data Generator (fallback when API isn't ready)
// ════════════════════════════════════════════════════════════════════

function generateMockData(deal?: Deal): TrafficProFormaData {
  const units = deal?.units || 290;
  const acqPrice = 52_200_000;
  const name = deal?.name || 'Property';

  const rawTraffic: AnnualTrafficPrediction[] = [];
  const occTrajectory: OccupancyTrajectoryPoint[] = [];
  const rentTrajectory: RentTrajectoryPoint[] = [];

  const baseRents = [1877, 1937, 1997, 2055, 2114, 2170, 2224, 2276, 2325, 2371];
  const growths = [3.8, 3.2, 3.1, 2.9, 2.9, 2.6, 2.5, 2.3, 2.2, 2.0];
  const occs = [95.2, 95.5, 95.8, 95.6, 95.5, 95.3, 95.1, 94.8, 94.5, 94.2];

  for (let y = 0; y < 10; y++) {
    const conf = Math.max(40, Math.round(92 - y * 5.3));
    const baseTraffic = 12.4 - y * 0.2;
    rawTraffic.push({
      year: y + 1, weeklyTraffic: +(baseTraffic).toFixed(1),
      weeklyTours: +(baseTraffic * 0.56).toFixed(1), weeklyApps: +(baseTraffic * 0.56 * 0.44).toFixed(1),
      weeklyLeases: +(baseTraffic * 0.56 * 0.44 * 0.75).toFixed(1),
      closingRatio: +((baseTraffic * 0.56 * 0.44 * 0.75) / baseTraffic * 100).toFixed(1),
      occPct: occs[y], effRent: baseRents[y],
      annualLeases: Math.round(baseTraffic * 0.56 * 0.44 * 0.75 * 52),
      turnover: 38 + y, confidence: conf,
    });
    occTrajectory.push({ year: y + 1, occ: occs[y], vacancy: +(100 - occs[y]).toFixed(1), confidence: conf });
    rentTrajectory.push({ year: y + 1, effRent: baseRents[y], growth: growths[y], confidence: conf });
  }

  const assumptions: ThreeLayerAssumption[] = [
    {
      id: 'vacancy', label: 'Vacancy Rate', category: 'revenue',
      baseline: { values: Array(10).fill(5.5), source: 'Submarket avg (M05)', conf: 60 },
      platform: { values: occTrajectory.map(o => o.vacancy), source: 'Traffic Engine v2 occupancy trajectory', conf: 92, module: 'M07' },
      override: { values: Array(10).fill(5.0), active: false },
      unit: '%', direction: 'lower-is-better',
      insight: 'Traffic engine predicts 4.8% Y1 vacancy vs 5.5% market default — 70bps tighter.',
    },
    {
      id: 'rentGrowth', label: 'Rent Growth', category: 'revenue',
      baseline: { values: Array(10).fill(2.8), source: '3yr historical avg (M05)', conf: 55 },
      platform: { values: growths, source: 'Traffic Engine v2 rent trajectory', conf: 92, module: 'M07' },
      override: { values: Array(10).fill(3.0), active: false },
      unit: '%', direction: 'higher-is-better',
      insight: 'Traffic engine sees 3.8% Y1 growth — 100bps above market baseline.',
    },
    {
      id: 'absorption', label: 'Absorption Rate', category: 'leasing',
      baseline: { values: Array(10).fill(130), source: 'Submarket avg (M05)', conf: 50 },
      platform: { values: rawTraffic.map(t => t.annualLeases), source: 'Traffic Engine v2 leasing velocity', conf: 92, module: 'M07' },
      override: { values: Array(10).fill(140), active: false },
      unit: ' leases/yr', direction: 'higher-is-better',
      insight: 'Property is leasing at 3/week (156 annualized) vs 2.5/week submarket avg.',
    },
    {
      id: 'opexGrowth', label: 'OpEx Growth', category: 'expense',
      baseline: { values: Array(10).fill(3.0), source: 'CPI + 50bps', conf: 65 },
      platform: { values: Array(10).fill(3.0), source: 'No traffic adjustment (expense-side)', conf: 65, module: null },
      override: { values: Array(10).fill(3.0), active: false },
      unit: '%', direction: 'lower-is-better',
      insight: "Traffic engine doesn't adjust expenses. OpEx growth uses CPI + 50bps baseline.",
    },
    {
      id: 'exitCap', label: 'Exit Cap Rate', category: 'exit',
      baseline: { values: [null, null, null, null, 5.5, null, null, null, null, 5.5], source: 'Trailing 12mo submarket avg (M05)', conf: 45 },
      platform: { values: [null, null, null, null, 5.3, null, null, null, null, 5.5], source: 'Traffic velocity suggests cap compression', conf: 60, module: 'M07' },
      override: { values: [null, null, null, null, 5.5, null, null, null, null, 5.75], active: false },
      unit: '%', direction: 'lower-is-better',
      insight: 'Strong leasing velocity -> lower perceived risk -> slight cap compression.',
    },
  ];

  // Build proforma helper
  const buildPF = (layer: 'baseline' | 'platform'): ProFormaYear[] => {
    const getVal = (id: string, yr: number) => {
      const a = assumptions.find(x => x.id === id);
      if (!a) return null;
      const src = layer === 'platform' ? a.platform : a.baseline;
      return src.values[yr];
    };
    const years: ProFormaYear[] = [];
    let rent = 1808;
    const debt = 2_280_000;
    for (let y = 0; y < 10; y++) {
      const vac = (getVal('vacancy', y) || 5.5) / 100;
      const rg = (getVal('rentGrowth', y) || 2.8) / 100;
      const og = (getVal('opexGrowth', y) || 3.0) / 100;
      if (y > 0) rent = rent * (1 + rg);
      const gpr = units * rent * 12;
      const vl = gpr * vac;
      const egi = gpr - vl;
      const opex = units * 6800 * Math.pow(1 + og, y);
      const noi = egi - opex;
      const btcf = noi - debt;
      years.push({ year: y + 1, rent: Math.round(rent), gpr: Math.round(gpr), vacancy: (vac * 100).toFixed(1), vacancyLoss: Math.round(vl), egi: Math.round(egi), opex: Math.round(opex), noi: Math.round(noi), debtService: debt, btcf: Math.round(btcf), capRate: (noi / acqPrice * 100).toFixed(2) });
    }
    return years;
  };

  const platform = buildPF('platform');
  const baseline = buildPF('baseline');
  const equity = acqPrice * 0.35;

  return {
    handoff: {
      rawTraffic, occupancyTrajectory: occTrajectory, rentTrajectory,
      leasingVelocity: { weeklyLeases: 3, annualized: 156, confidence: 92 },
      leaseUpTimeline: null, dataWeeks: 243, lastCalibrated: '2026-02-24', modelConfidence: 92,
    },
    assumptions,
    incomeStatement: { platform, baseline },
    returns: {
      irr: { platform: '16.2%', baseline: '14.8%', delta: '+1.4%' },
      equityMultiple: { platform: '2.28x', baseline: '2.10x', delta: '+0.18x' },
      cashOnCash: { platform: `${(platform[0].btcf / equity * 100).toFixed(1)}%`, baseline: `${(baseline[0].btcf / equity * 100).toFixed(1)}%`, delta: `+${((platform[0].btcf - baseline[0].btcf) / equity * 100).toFixed(1)}%` },
      exitValue: { platform: fmt$(Math.round(platform[4].noi / 0.053)), baseline: fmt$(Math.round(baseline[4].noi / 0.055)), delta: fmt$(Math.round(platform[4].noi / 0.053 - baseline[4].noi / 0.055)) },
      dscr: { platform: `${(platform[0].noi / 2_280_000).toFixed(2)}x`, baseline: `${(baseline[0].noi / 2_280_000).toFixed(2)}x`, delta: `+${((platform[0].noi - baseline[0].noi) / 2_280_000).toFixed(2)}x` },
    },
    property: { name, units, type: 'Existing — Stabilized', acquisitionPrice: acqPrice },
  };
}

// ════════════════════════════════════════════════════════════════════
// Utilities
// ════════════════════════════════════════════════════════════════════

function fmt$(n: number): string {
  return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;
}

const TABS = [
  { id: 'handoff', label: 'Traffic \u2192 ProForma', icon: ArrowRight },
  { id: 'assumptions', label: '3-Layer Assumptions', icon: Layers },
  { id: 'income', label: '10-Year Income Statement', icon: BarChart3 },
  { id: 'returns', label: 'Returns', icon: DollarSign },
] as const;

type TabId = typeof TABS[number]['id'];

// ════════════════════════════════════════════════════════════════════
// Handoff Tab — M07 → M09 Translation
// ════════════════════════════════════════════════════════════════════

function HandoffTab({ data }: { data: TrafficProFormaData }) {
  const handoff = data.handoff;
  const pipes = [
    {
      from: 'Occupancy Trajectory (10yr)', fromModule: 'M07 Traffic Engine',
      to: 'Vacancy % per year', toModule: 'M09 ProForma',
      value: `${handoff.occupancyTrajectory[0]?.occ}% \u2192 ${handoff.occupancyTrajectory[9]?.occ}% over 10yr`,
      translation: 'vacancy[yr] = 100 - occupancy_trajectory[yr]',
      impact: `Reduces Y1 vacancy from 5.5% (market) to ${handoff.occupancyTrajectory[0]?.vacancy}% (learned).`,
      confidence: handoff.modelConfidence, color: 'cyan',
    },
    {
      from: 'Eff Rent Trajectory (10yr)', fromModule: 'M07 Traffic Engine',
      to: 'Rent Growth % per year', toModule: 'M09 ProForma',
      value: `$${handoff.rentTrajectory[0]?.effRent} \u2192 $${handoff.rentTrajectory[9]?.effRent} (+${Math.round((handoff.rentTrajectory[9]?.effRent / handoff.rentTrajectory[0]?.effRent - 1) * 100)}% over 10yr)`,
      translation: 'rent_growth[yr] = (rent_trajectory[yr] / rent_trajectory[yr-1]) - 1',
      impact: `Y1 rent growth ${handoff.rentTrajectory[0]?.growth}% vs 2.8% baseline.`,
      confidence: handoff.modelConfidence, color: 'emerald',
    },
    {
      from: 'Net Leases x 52 (seasonal)', fromModule: 'M07 Traffic Engine',
      to: 'Absorption Rate', toModule: 'M09 ProForma',
      value: `${handoff.leasingVelocity.weeklyLeases}/wk \u2192 ${handoff.leasingVelocity.annualized} leases/yr`,
      translation: 'absorption[yr] = weekly_net_leases x 52 x seasonal_adj[yr]',
      impact: 'Confirms stabilized occupancy assumptions. For dev deals: directly sets lease-up timeline.',
      confidence: handoff.leasingVelocity.confidence, color: 'blue',
    },
    {
      from: 'Weeks to 95% Occupancy', fromModule: 'M07 Traffic Engine',
      to: 'Lease-Up Timeline', toModule: 'M09 ProForma (Dev Deals)',
      value: handoff.leaseUpTimeline ? `${handoff.leaseUpTimeline.weeksTo95} weeks` : 'N/A \u2014 Stabilized property',
      translation: 'lease_up_months = weeks_to_95 / 4.33',
      impact: handoff.leaseUpTimeline
        ? `Lease-up projected at ${handoff.leaseUpTimeline.weeksTo95} weeks.`
        : 'Not applicable for stabilized properties.',
      confidence: handoff.leaseUpTimeline ? handoff.modelConfidence : null, color: 'stone',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-stone-900">M07 Traffic Engine \u2192 M09 ProForma Translation Layer</h3>
        <p className="text-xs text-stone-500 mt-1">4 numbers flow from traffic predictions into financial assumptions. No human intervention required.</p>
      </div>

      {/* Service spec box */}
      <div className="bg-stone-50 border border-cyan-200 rounded-lg p-4 font-mono text-xs">
        <div className="text-[10px] text-cyan-700 font-bold tracking-wider mb-2">trafficToProFormaService.ts</div>
        <div className="text-stone-600 space-y-0.5">
          <div><span className="text-stone-400">// Called when:</span> traffic predictions update OR user uploads new actuals</div>
          <div><span className="text-stone-400">// Frequency:</span> weekly (after each upload recalibration)</div>
          <div><span className="text-stone-400">// Direction:</span> M07 \u2192 M09 (one-way, no circular dependency)</div>
        </div>
      </div>

      {/* The 4 pipes */}
      {pipes.map((p, i) => (
        <div key={i} className={`bg-white border rounded-lg p-4 ${p.confidence ? 'border-stone-200' : 'border-stone-100'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">{p.fromModule}</div>
              <div className={`text-xs font-semibold text-${p.color}-600`}>{p.from}</div>
            </div>
            <ArrowRight size={16} className={`text-${p.color}-400`} />
            <div className="flex-1">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider">{p.toModule}</div>
              <div className="text-xs font-semibold text-stone-800">{p.to}</div>
            </div>
            {p.confidence && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                <span className="text-[10px] text-emerald-700 font-bold">{p.confidence}%</span>
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-stone-400 bg-stone-50 rounded px-2 py-1 mb-2">{p.translation}</div>
          <div className="text-xs text-stone-700 mb-1">Current: <span className={`text-${p.color}-600 font-semibold`}>{p.value}</span></div>
          <div className="text-xs text-stone-500">{p.impact}</div>
        </div>
      ))}

      {/* Net impact summary */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <h4 className="text-xs font-bold text-emerald-800 mb-3">Net Impact: Platform vs Baseline Assumptions</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Y1 NOI Delta', value: data.returns.dscr.delta !== '+0.00x' ? `+${fmt$(data.incomeStatement.platform[0].noi - data.incomeStatement.baseline[0].noi)}` : '$0', sub: 'Lower vacancy + higher rent growth' },
            { label: '10-Year IRR Delta', value: data.returns.irr.delta, sub: `${data.returns.irr.platform} platform vs ${data.returns.irr.baseline} baseline` },
            { label: 'Equity Multiple Delta', value: data.returns.equityMultiple.delta, sub: `${data.returns.equityMultiple.platform} platform vs ${data.returns.equityMultiple.baseline} baseline` },
          ].map((m, i) => (
            <div key={i}>
              <div className="text-xl font-bold text-emerald-700 font-mono">{m.value}</div>
              <div className="text-[10px] text-stone-700 font-medium">{m.label}</div>
              <div className="text-[9px] text-stone-400">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Assumptions Tab — 3-Layer View
// ════════════════════════════════════════════════════════════════════

function AssumptionsTab({ data }: { data: TrafficProFormaData }) {
  const [activeLayer, setActiveLayer] = useState<'baseline' | 'platform' | 'override'>('platform');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const layers = [
    { id: 'baseline' as const, label: 'Baseline (Market)', color: 'stone', desc: 'Historical averages from market data' },
    { id: 'platform' as const, label: 'Platform-Adjusted (Traffic)', color: 'cyan', desc: 'Traffic Engine v2 predictions' },
    { id: 'override' as const, label: 'User Override', color: 'blue', desc: 'Your manual assumptions' },
  ];

  return (
    <div className="space-y-3">
      {/* Layer selector */}
      <div className="flex gap-2">
        {layers.map(l => (
          <button key={l.id} onClick={() => setActiveLayer(l.id)} className={`flex-1 text-left px-3 py-2 rounded-lg border transition-colors ${
            activeLayer === l.id
              ? `bg-${l.color}-50 border-${l.color}-300 text-${l.color}-800`
              : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
          }`}>
            <div className="text-xs font-semibold">{l.label}</div>
            <div className="text-[9px] text-stone-400 mt-0.5">{l.desc}</div>
          </button>
        ))}
      </div>

      {/* Active layer indicator */}
      {activeLayer === 'platform' && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 flex justify-between items-center">
          <div>
            <span className="text-xs text-cyan-700 font-semibold">Traffic Engine feeding assumptions</span>
            <span className="text-[10px] text-stone-400 ml-2">
              Calibrated from {data.handoff.dataWeeks} weeks · Last updated {data.handoff.lastCalibrated}
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold">Confidence: {data.handoff.modelConfidence}%</span>
        </div>
      )}

      {/* Assumption rows */}
      {data.assumptions.map((a) => {
        const src = activeLayer === 'override' && a.override.active ? a.override : activeLayer === 'platform' ? a.platform : a.baseline;
        const hasDelta = a.platform.values[0] !== a.baseline.values[0] && a.platform.module;
        const deltaY1 = (a.platform.values[0] != null && a.baseline.values[0] != null)
          ? (a.platform.values[0] as number) - (a.baseline.values[0] as number)
          : null;
        const isExpanded = expandedId === a.id;

        return (
          <div key={a.id} className={`bg-white border rounded-lg overflow-hidden ${
            hasDelta && activeLayer === 'platform' ? 'border-cyan-200' : 'border-stone-200'
          }`}>
            {/* Header row */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : a.id)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-800">{a.label}</span>
                  {hasDelta && activeLayer === 'platform' && (
                    <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-bold">M07</span>
                  )}
                </div>
                <div className="text-[9px] text-stone-400 mt-0.5">{src.source}</div>
              </div>
              {/* Y1 value + delta */}
              <div className="text-right min-w-[80px]">
                <div className="text-base font-bold text-stone-900 font-mono">
                  {src.values[0] !== null ? src.values[0] : '\u2014'}{a.unit}
                </div>
                {deltaY1 !== null && deltaY1 !== 0 && activeLayer === 'platform' && (
                  <div className={`text-[10px] font-mono ${
                    (a.direction === 'lower-is-better' ? deltaY1 < 0 : deltaY1 > 0) ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {deltaY1 > 0 ? '+' : ''}{deltaY1.toFixed(1)} vs baseline
                  </div>
                )}
              </div>
              {/* Confidence */}
              <div className="text-right min-w-[40px]">
                <div className={`text-[10px] font-bold ${
                  src.conf > 80 ? 'text-emerald-600' : src.conf > 60 ? 'text-amber-600' : 'text-stone-400'
                }`}>{src.conf}%</div>
                <div className="text-[8px] text-stone-400">conf</div>
              </div>
              {isExpanded ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
            </div>

            {/* Expanded: 10-year comparison + insight */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-stone-100">
                {/* 3-layer comparison grid */}
                <div className="overflow-x-auto">
                  <div className="grid gap-0.5 text-[10px] font-mono" style={{ gridTemplateColumns: '60px repeat(10, 1fr)' }}>
                    <div className="text-stone-400 py-1">Year</div>
                    {[1,2,3,4,5,6,7,8,9,10].map(y => (
                      <div key={y} className="text-stone-400 text-right py-1">Y{y}</div>
                    ))}
                    <div className="text-stone-500">Baseline</div>
                    {a.baseline.values.map((v, i) => (
                      <div key={i} className="text-stone-500 text-right">{v !== null ? v : '\u2014'}</div>
                    ))}
                    <div className="text-cyan-700 font-bold">Platform</div>
                    {a.platform.values.map((v, i) => (
                      <div key={i} className="text-cyan-700 text-right font-bold">{v !== null ? v : '\u2014'}</div>
                    ))}
                    {a.override.active && (
                      <>
                        <div className="text-blue-600">Override</div>
                        {a.override.values.map((v, i) => (
                          <div key={i} className="text-blue-600 text-right">{v !== null ? v : '\u2014'}</div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                {/* Insight */}
                <div className="bg-stone-50 rounded-lg px-3 py-2 mt-3 text-xs text-stone-600 leading-relaxed">
                  {a.insight}
                </div>
                {/* Confidence decay bar */}
                {a.platform.module && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[9px] text-stone-400 min-w-[55px]">Confidence:</span>
                    {data.handoff.occupancyTrajectory.map((t, i) => (
                      <div key={i} className={`flex-1 h-1.5 rounded-full ${
                        t.confidence > 80 ? 'bg-emerald-400' : t.confidence > 60 ? 'bg-amber-400' : 'bg-red-300'
                      }`} style={{ opacity: 0.5 + t.confidence / 200 }} title={`Y${t.year}: ${t.confidence}%`} />
                    ))}
                    <span className="text-[8px] text-stone-400 min-w-[30px] text-right">
                      {data.handoff.occupancyTrajectory[9]?.confidence}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Income Statement Tab — 10-Year Combined Grid
// ════════════════════════════════════════════════════════════════════

function IncomeTab({ data }: { data: TrafficProFormaData }) {
  const [layer, setLayer] = useState<'baseline' | 'platform'>('platform');
  const proforma = layer === 'platform' ? data.incomeStatement.platform : data.incomeStatement.baseline;
  const baseline = data.incomeStatement.baseline;
  const traffic = data.handoff.rawTraffic;

  // All rows: traffic predictions at top, then financials
  type RowType = 'section' | 'traffic' | 'derived' | 'financial';
  interface GridRow {
    type: RowType;
    label: string;
    key?: string;
    color?: string;
    dec?: number;
    suffix?: string;
    prefix?: string;
    feedsFinancial?: string;
    isConf?: boolean;
    compute?: (yr: number) => string;
    fmt?: boolean;
    negative?: boolean;
    bold?: boolean;
    accent?: boolean;
    sub?: boolean;
    highlight?: boolean;
  }

  const allRows: GridRow[] = [
    { type: 'section', label: 'TRAFFIC ENGINE PREDICTIONS (M07)', color: 'cyan' },
    { type: 'traffic', label: 'Avg Weekly Traffic', key: 'weeklyTraffic', dec: 1 },
    { type: 'traffic', label: 'Avg Weekly Tours', key: 'weeklyTours', dec: 1 },
    { type: 'traffic', label: 'Avg Weekly Apps', key: 'weeklyApps', dec: 1 },
    { type: 'traffic', label: 'Avg Weekly Leases', key: 'weeklyLeases', dec: 1 },
    { type: 'traffic', label: 'Annual Leases', key: 'annualLeases', dec: 0 },
    { type: 'traffic', label: 'Annual Turnover', key: 'turnover', dec: 0 },
    { type: 'traffic', label: 'Closing Ratio', key: 'closingRatio', dec: 1, suffix: '%' },
    { type: 'traffic', label: 'Confidence', key: 'confidence', dec: 0, suffix: '%', isConf: true },
    { type: 'section', label: 'TRAFFIC \u2192 FINANCIAL ASSUMPTIONS', color: 'amber' },
    { type: 'traffic', label: 'Occupancy %', key: 'occPct', dec: 1, suffix: '%', feedsFinancial: 'vacancy' },
    { type: 'traffic', label: 'Eff Rent/Unit', key: 'effRent', dec: 0, prefix: '$', feedsFinancial: 'rent' },
    { type: 'derived', label: '\u2192 Vacancy %', compute: (yr) => (100 - traffic[yr].occPct).toFixed(1), suffix: '%' },
    { type: 'derived', label: '\u2192 Rent Growth %', compute: (yr) => yr === 0 ? '3.8' : ((traffic[yr].effRent / traffic[yr - 1].effRent - 1) * 100).toFixed(1), suffix: '%' },
    { type: 'section', label: 'REVENUE', color: 'emerald' },
    { type: 'financial', label: 'Eff Rent/Unit', key: 'rent', prefix: '$', highlight: true },
    { type: 'financial', label: 'Gross Potential Revenue', key: 'gpr', fmt: true },
    { type: 'financial', label: 'Vacancy %', key: 'vacancy', suffix: '%', sub: true, highlight: true },
    { type: 'financial', label: 'Vacancy Loss', key: 'vacancyLoss', fmt: true, negative: true, sub: true },
    { type: 'financial', label: 'Effective Gross Income', key: 'egi', fmt: true, bold: true },
    { type: 'section', label: 'EXPENSES', color: 'red' },
    { type: 'financial', label: 'Operating Expenses', key: 'opex', fmt: true, negative: true },
    { type: 'section', label: 'NET RETURNS', color: 'emerald' },
    { type: 'financial', label: 'NOI', key: 'noi', fmt: true, bold: true, accent: true },
    { type: 'financial', label: 'Debt Service', key: 'debtService', fmt: true, negative: true },
    { type: 'financial', label: 'Before-Tax Cash Flow', key: 'btcf', fmt: true, bold: true },
    { type: 'financial', label: 'Cap Rate', key: 'capRate', suffix: '%' },
  ];

  const renderCell = (row: GridRow, yi: number) => {
    if (row.type === 'section') return null;

    if (row.type === 'traffic') {
      const t = traffic[yi] as Record<string, any>;
      const val = t[row.key!];
      const confColor = row.isConf
        ? (val > 80 ? 'text-emerald-600' : val > 60 ? 'text-amber-600' : 'text-red-500')
        : 'text-cyan-600';
      return (
        <td key={`t-${row.key}-${yi}`} className={`py-0.5 px-1 text-right text-[10px] font-mono ${confColor} ${row.feedsFinancial ? 'font-bold bg-cyan-50/40' : ''}`}>
          {row.prefix || ''}{(row.dec ?? 0) > 0 ? val.toFixed(row.dec) : val}{row.suffix || ''}
        </td>
      );
    }

    if (row.type === 'derived') {
      const val = row.compute!(yi);
      return (
        <td key={`d-${row.label}-${yi}`} className="py-0.5 px-1 text-right text-[10px] font-mono text-amber-600 font-semibold bg-amber-50/30">
          {val}{row.suffix || ''}
        </td>
      );
    }

    if (row.type === 'financial') {
      const yr = proforma[yi] as Record<string, any>;
      const baseYr = baseline[yi] as Record<string, any>;
      const val = yr[row.key!];
      const baseVal = baseYr?.[row.key!];
      const isDiff = layer === 'platform' && row.highlight && val !== baseVal;
      const textColor = row.accent ? 'text-emerald-700' : row.negative ? 'text-red-400' : row.bold ? 'text-stone-900' : 'text-stone-500';
      return (
        <td key={`f-${row.key}-${yi}`} className={`py-0.5 px-1 text-right text-[10px] font-mono ${textColor} ${row.bold ? 'font-bold' : ''} ${isDiff ? 'bg-cyan-50/40' : row.highlight ? 'bg-cyan-50/20' : ''}`}>
          {row.fmt ? fmt$(val) : row.prefix ? `${row.prefix}${typeof val === 'number' ? val.toLocaleString() : val}` : `${val}${row.suffix || ''}`}
        </td>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-stone-900">10-Year Income Statement</h3>
          <p className="text-xs text-stone-500">{data.property.units} units · {fmt$(data.property.acquisitionPrice)} · Traffic assumptions visible</p>
        </div>
        <div className="flex gap-1">
          {([
            { id: 'baseline' as const, label: 'Baseline' },
            { id: 'platform' as const, label: 'Platform (Traffic)' },
          ]).map(l => (
            <button key={l.id} onClick={() => setLayer(l.id)} className={`px-3 py-1 rounded text-[10px] font-medium border transition-colors ${
              layer === l.id
                ? l.id === 'platform' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-stone-100 border-stone-300 text-stone-700'
                : 'bg-white border-stone-200 text-stone-400 hover:bg-stone-50'
            }`}>{l.label}</button>
          ))}
        </div>
      </div>

      {/* Combined grid */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left py-1.5 px-2 text-[9px] text-stone-400 font-mono tracking-wider sticky left-0 bg-stone-50 z-10 min-w-[140px]">Metric</th>
                {Array.from({ length: 10 }, (_, i) => (
                  <th key={i} className="text-right py-1.5 px-1 text-cyan-600 font-semibold min-w-[66px]">Y{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, ri) => {
                if (row.type === 'section') {
                  const sectionColor = row.color === 'cyan' ? 'text-cyan-700 bg-cyan-50/50 border-cyan-100'
                    : row.color === 'amber' ? 'text-amber-700 bg-amber-50/50 border-amber-100'
                    : row.color === 'emerald' ? 'text-emerald-700 bg-emerald-50/50 border-emerald-100'
                    : 'text-red-700 bg-red-50/50 border-red-100';
                  return (
                    <tr key={`sec-${ri}`}>
                      <td colSpan={11} className={`py-1.5 px-2 text-[9px] font-bold uppercase tracking-wider ${sectionColor} ${ri > 0 ? 'border-t-2' : ''} border-b`}>
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                const isTraffic = row.type === 'traffic';
                const isDerived = row.type === 'derived';
                const labelColor = isTraffic ? 'text-cyan-600' : isDerived ? 'text-amber-600' : row.accent ? 'text-emerald-700' : row.sub ? 'text-stone-400' : 'text-stone-700';

                return (
                  <tr key={`row-${ri}`} className="border-b border-stone-50">
                    <td className={`py-0.5 px-2 ${row.bold ? 'font-bold' : isDerived ? 'font-semibold' : ''} ${labelColor} ${isTraffic && row.feedsFinancial ? 'bg-cyan-50/40' : isDerived ? 'bg-amber-50/30' : row.highlight ? 'bg-cyan-50/20' : ''} sticky left-0 z-10 bg-white whitespace-nowrap`}>
                      {row.label}
                      {isTraffic && !row.isConf && <span className="text-[7px] text-cyan-400 ml-1">M07</span>}
                      {row.highlight && layer === 'platform' && <span className="text-[7px] text-cyan-400 ml-1">M07</span>}
                      {isDerived && <span className="text-[7px] text-amber-400 ml-1">\u2192M09</span>}
                    </td>
                    {Array.from({ length: 10 }, (_, yi) => renderCell(row, yi))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flow indicator */}
      <div className="flex items-center gap-2 px-1 text-[9px]">
        <span className="text-cyan-600">● M07 Traffic Predictions</span>
        <span className="text-stone-300">\u2192</span>
        <span className="text-amber-600">● Translated Assumptions</span>
        <span className="text-stone-300">\u2192</span>
        <span className="text-stone-700">● Financial Outcomes</span>
        <span className="text-stone-400 ml-auto">Highlighted cells change when switching Baseline / Platform</span>
      </div>

      {/* NOI comparison */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 4, 9].map(yi => {
          const p = data.incomeStatement.platform[yi];
          const b = data.incomeStatement.baseline[yi];
          const delta = p.noi - b.noi;
          return (
            <div key={yi} className={`bg-white border rounded-lg p-3 ${delta > 0 ? 'border-emerald-200' : 'border-stone-200'}`}>
              <div className="text-[10px] text-cyan-600 font-semibold">Year {yi + 1} NOI</div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-base font-bold text-emerald-700 font-mono">{fmt$(p.noi)}</span>
                {layer === 'platform' && delta !== 0 && (
                  <span className={`text-[10px] ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {delta > 0 ? '+' : ''}{fmt$(delta)} vs baseline
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Returns Tab — Platform vs Baseline
// ════════════════════════════════════════════════════════════════════

function ReturnsTab({ data }: { data: TrafficProFormaData }) {
  const metrics = [
    { label: 'IRR (5-Year Hold)', ...data.returns.irr, note: 'Higher NOI from traffic-adjusted vacancy + rent growth' },
    { label: 'Equity Multiple (5-Year)', ...data.returns.equityMultiple, note: 'Same equity, more cash flow + higher exit value' },
    { label: 'Cash-on-Cash (Y1)', ...data.returns.cashOnCash, note: 'Y1 BTCF difference driven by tighter vacancy' },
    { label: 'Exit Value (Y5 @ Cap)', ...data.returns.exitValue, note: 'Platform: traffic velocity cap compression. Baseline: submarket avg' },
    { label: 'DSCR (Y1 Minimum)', ...data.returns.dscr, note: 'Higher NOI = more debt coverage cushion' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-stone-900">Returns: Platform-Adjusted vs Baseline</h3>
        <p className="text-xs text-stone-500 mt-1">What traffic intelligence adds to your underwriting</p>
      </div>

      {metrics.map((m, i) => (
        <div key={i} className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="text-[10px] text-stone-400 uppercase tracking-wider font-mono mb-2">{m.label}</div>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-[9px] text-stone-400">Baseline</div>
              <div className="text-base text-stone-500 font-mono font-semibold">{m.baseline}</div>
            </div>
            <ArrowRight size={14} className="text-stone-300" />
            <div>
              <div className="text-[9px] text-cyan-600">Platform</div>
              <div className="text-xl text-cyan-700 font-mono font-bold">{m.platform}</div>
            </div>
            <div className="ml-auto bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1">
              <span className="text-sm text-emerald-700 font-bold font-mono">{m.delta}</span>
            </div>
          </div>
          <div className="text-[10px] text-stone-500 mt-2">{m.note}</div>
        </div>
      ))}

      {/* Caveat */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={14} className="text-amber-600" />
          <span className="text-xs text-amber-800 font-semibold">Platform assumptions are predictions, not guarantees</span>
        </div>
        <p className="text-[10px] text-stone-600 leading-relaxed">
          Confidence decays from {data.handoff.modelConfidence}% (Y1) to {data.handoff.occupancyTrajectory[9]?.confidence}% (Y10).
          The traffic engine is most reliable for Years 1-3. Beyond that, market-level trends dominate property-level data.
          Always stress-test with the Scenario Engine (M10).
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════

export const ProFormaWithTrafficSection: React.FC<ProFormaWithTrafficSectionProps> = ({ deal }) => {
  const [tab, setTab] = useState<TabId>('handoff');
  const [data, setData] = useState<TrafficProFormaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'api' | 'demo' | 'none'>('none');
  const [initializing, setInitializing] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('rental');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!deal?.id) {
      setLoading(false);
      setDataSource('none');
      return;
    }

    setLoading(true);
    try {
      const propertyId = (deal as any)?.property_id || (deal as any)?.propertyId;
      const dealId = deal.id;

      if (propertyId && dealId) {
        const response = await api.get(`/proforma/${dealId}/traffic-integration`, {
          params: { propertyId },
        });
        if (response.data?.success && response.data.data) {
          setData(response.data.data);
          setDataSource('api');
          setLoading(false);
          return;
        }
      }

      const assumptionsRes = await api.get(`/proforma/${deal.id}`);
      if (assumptionsRes.data?.success && assumptionsRes.data.data) {
        setData(assumptionsRes.data.data);
        setDataSource('api');
        setLoading(false);
        return;
      }
    } catch {
    }

    setData(null);
    setDataSource('none');
    setLoading(false);
  }, [deal?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInitialize = async () => {
    if (!deal?.id) return;
    setInitializing(true);
    try {
      await api.post(`/proforma/${deal.id}/initialize`, {
        strategy: selectedStrategy,
      });
      await fetchData();
    } catch {
    }
    setInitializing(false);
  };

  const handleLoadDemo = () => {
    setData(generateMockData(deal));
    setDataSource('demo');
  };

  const handleRefreshTraffic = async () => {
    if (!deal?.id) return;
    const propertyId = (deal as any)?.property_id || (deal as any)?.propertyId;
    if (!propertyId) return;
    setRefreshing(true);
    try {
      const response = await api.post(`/proforma/${deal.id}/traffic-refresh`, {
        propertyId,
      });
      if (response.data?.success) {
        await fetchData();
      }
    } catch {
    }
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-sm gap-3">
        <Loader2 size={24} className="animate-spin text-cyan-500" />
        <span>Loading ProForma integration...</span>
      </div>
    );
  }

  if (!data || dataSource === 'none') {
    return (
      <div className="space-y-4">
        <div className="bg-stone-900 text-white rounded-xl p-4">
          <div className="text-[9px] uppercase tracking-[2px] text-stone-500">Deal Capsule → ProForma Engine · M09</div>
          <div className="text-base font-bold mt-1">{deal?.name || 'Property'}</div>
        </div>

        <div className="bg-white border-2 border-dashed border-stone-300 rounded-xl p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center">
            <BarChart3 size={24} className="text-stone-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-800">No Pro Forma Data</h3>
            <p className="text-xs text-stone-500 mt-1">
              Initialize a pro forma with a strategy to start generating financial projections, or view demo data.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
            <div className="w-full">
              <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1">Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 bg-white"
              >
                <option value="rental">Rental (Stabilized)</option>
                <option value="build_to_sell">Build to Sell</option>
                <option value="flip">Flip</option>
                <option value="airbnb">Airbnb / Short-Term</option>
              </select>
            </div>
            <button
              onClick={handleInitialize}
              disabled={initializing}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {initializing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {initializing ? 'Initializing...' : 'Initialize Pro Forma'}
            </button>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[10px] text-stone-400">or</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
            <button
              onClick={handleLoadDemo}
              className="w-full flex items-center justify-center gap-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Beaker size={14} />
              View Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  const content: Record<TabId, React.ReactNode> = {
    handoff: <HandoffTab data={data} />,
    assumptions: <AssumptionsTab data={data} />,
    income: <IncomeTab data={data} />,
    returns: <ReturnsTab data={data} />,
  };

  return (
    <div className="space-y-4">
      {dataSource === 'demo' && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beaker size={14} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">[DEMO DATA]</span>
            <span className="text-xs text-amber-700">Showing sample projections. Initialize a pro forma for real data.</span>
          </div>
          <button
            onClick={() => { setData(null); setDataSource('none'); }}
            className="text-xs text-amber-700 underline hover:text-amber-900 font-medium"
          >
            Initialize Real Data
          </button>
        </div>
      )}

      <div className="bg-stone-900 text-white rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[9px] uppercase tracking-[2px] text-emerald-400">Deal Capsule → ProForma Engine · M09</div>
              {dataSource === 'demo' && (
                <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">DEMO</span>
              )}
            </div>
            <div className="text-base font-bold mt-1">{data.property.name}</div>
            <div className="text-xs text-stone-400">{data.property.units} units · {data.property.type} · {fmt$(data.property.acquisitionPrice)}</div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[9px] text-stone-400">Traffic Feed</span>
              {dataSource === 'api' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-[10px] text-emerald-400 font-semibold">LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  <span className="text-[10px] text-amber-400 font-semibold">DEMO</span>
                </>
              )}
            </div>
            <div className="text-[9px] text-stone-500 mt-1">
              {data.handoff.dataWeeks} weeks calibration · {data.handoff.modelConfidence}% confidence
            </div>
            {dataSource === 'api' && (
              <button
                onClick={handleRefreshTraffic}
                disabled={refreshing}
                className="mt-1 flex items-center gap-1 text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors ml-auto disabled:opacity-50"
              >
                <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing...' : 'Refresh Traffic'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-stone-200 pb-0.5 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-t text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-emerald-50 text-emerald-700 border border-b-0 border-emerald-200'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
            }`}>
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>{content[tab]}</div>
    </div>
  );
};

export default ProFormaWithTrafficSection;
