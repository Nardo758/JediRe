/**
 * Exit Strategy Tabs — Integration for DebtTab (M11+ Capital Structure Engine)
 *
 * Three new tabs that plug into the existing DebtTab.tsx tab system:
 *   ◉ Exit Windows   — 10-year quarterly RSS timeline with sell zones
 *   ∿ Sensitivity    — IRR heat map (exit cap × rent growth matrix)
 *   ◎ Monitor        — Post-acquisition drift detection, signals, scenarios
 *
 * INTEGRATION: Import these components into DebtTab.tsx and render them
 * inside the existing tab switch block. See DebtTab_integration_handoff.md
 * for exact insertion instructions.
 *
 * PATTERN MATCH: Uses identical Tailwind patterns from existing DebtTab.tsx:
 *   - Cards:           bg-white rounded-lg border border-gray-200 p-6
 *   - Section headers:  text-sm font-semibold text-gray-700 uppercase tracking-wide
 *   - Metric grids:    grid grid-cols-2 md:grid-cols-4 gap-4
 *   - Colored status:  bg-green-50 border-green-200 / bg-amber-50 / bg-red-50
 *
 * WIRING: Reads from useDealModule() context:
 *   - financial.noi → feeds projection model NOI base
 *   - capitalStructure.annualDebtService → used in exit return calculations
 *   - dealStatus → controls Monitor tab (pipeline = placeholder, owned = live)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ProjectionYear {
  year: number;
  label: string;
  noi: number;
  grossValue: number;
  netProceeds: number;
  irr: number;
  multiple: number;
  capRate: number;
  supplyPressure: number;
  rss: number;
  marketWindow: number;
  rateEnv: number;
  supplyPos: number;
  opReady: number;
  buyerPressure: number;
  rentGrowth: number;
  valueAddComplete: number;
}

interface QuarterlyPoint {
  q: number;
  label: string;
  year: number;
  rss: number;
  irr: number;
  multiple: number;
  capRate: number;
  supply: number;
}

interface ExitWindow {
  zone: 'sell' | 'prepare';
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
}

interface TimelineEvent {
  quarter: number;
  icon: string;
  short: string;
  text: string;
  color: string;
}

interface MonitoringSignal {
  metric: string;
  value: string;
  detail: string;
}

interface ExitScenario {
  name: string;
  timing: string;
  irr: number;
  multiple: number;
  cap: number;
  risk: string;
  rec: boolean;
}

export interface ExitStrategyConfig {
  baseNOI: number;             // from M09 ProForma or default
  equityInvested: number;      // from capital stack layers
  loanBalance: number;         // from senior debt layer
  dealStatus: 'pipeline' | 'owned';
}

// ============================================================================
// Formatters (matching DebtTab.tsx)
// ============================================================================

const fmtM = (v: number): string => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
};

const fmtPct = (v: number): string => `${v.toFixed(2)}%`;

// ============================================================================
// Shared Sub-Components
// ============================================================================

/** SVG RSS Gauge — matches light theme */
const RSSGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 160 }) => {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const r = (size / 2) - 12;
  const circ = r * 2 * Math.PI;
  const arcFrac = 270 / 360;
  const trackOffset = circ - arcFrac * circ;
  const valueOffset = circ - (anim / 100) * arcFrac * circ;
  const color = anim >= 85 ? '#16a34a' : anim >= 70 ? '#d97706' : anim >= 50 ? '#3b82f6' : '#dc2626';
  const label = anim >= 85 ? 'STRONG SELL' : anim >= 70 ? 'PREPARE' : anim >= 50 ? 'WATCH' : 'HOLD';
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} className="block mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={7}
        strokeDasharray={`${circ}`} strokeDashoffset={trackOffset}
        strokeLinecap="round" transform={`rotate(135,${cx},${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9}
        strokeDasharray={`${circ}`} strokeDashoffset={valueOffset}
        strokeLinecap="round" transform={`rotate(135,${cx},${cy})`}
        style={{
          transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)',
          filter: `drop-shadow(0 0 6px ${color}44)`,
        }} />
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color}
        fontSize={size * 0.22} fontWeight="800" fontFamily="system-ui">
        {Math.round(anim)}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fill="#6B7280"
        fontSize={9} fontWeight="600" letterSpacing="1.5">
        {label}
      </text>
    </svg>
  );
};

/** Animated sub-score bar */
const SubScoreBar: React.FC<{
  label: string; score: number; weight: number; color: string; delay?: number;
}> = ({ label, score, weight, color, delay = 0 }) => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(score), 300 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">
          {label} <span className="text-gray-400">{weight}%</span>
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {Math.round(w)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${w}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  );
};

/** Year selector button row */
const YearSelector: React.FC<{
  years: number[];
  selected: number;
  onChange: (y: number) => void;
  optimal: number;
}> = ({ years, selected, onChange, optimal }) => (
  <div className="flex gap-1.5 flex-wrap">
    {years.map(y => {
      const isOpt = y === optimal;
      const isSel = y === selected;
      return (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={`relative w-10 h-8 rounded-md text-xs font-bold transition-all border ${
            isSel ? 'border-blue-500 bg-blue-50 text-blue-600' :
            isOpt ? 'border-green-300 bg-green-50 text-green-600' :
            'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
          }`}
        >
          Y{y}
          {isOpt && (
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] font-bold text-green-500 tracking-wide">
              BEST
            </span>
          )}
        </button>
      );
    })}
  </div>
);

/** Signal chip (go / watch / concern) */
const SignalChip: React.FC<{
  metric: string; value: string; detail: string;
  type: 'go' | 'watch' | 'concern';
}> = ({ metric, value, detail, type }) => {
  const cfg = {
    go:      { dot: 'bg-green-500', bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-600' },
    watch:   { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600' },
    concern: { dot: 'bg-red-500',   bg: 'bg-red-50',   border: 'border-red-100',   text: 'text-red-600' },
  }[type];
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`}
        style={{ boxShadow: '0 0 6px currentColor' }} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <span className="text-xs font-semibold text-gray-800">{metric}</span>
          <span className={`text-xs font-bold ${cfg.text}`}>{value}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">{detail}</div>
      </div>
    </div>
  );
};

// ============================================================================
// Projection Model Hook
// ============================================================================

export function useProjectionModel(config?: ExitStrategyConfig) {
  const baseNOI = config?.baseNOI || 1920000;
  const equity = config?.equityInvested || 8000000;
  const loan = config?.loanBalance || 19200000;

  const projectionModel = useMemo((): ProjectionYear[] => {
    const yrs: ProjectionYear[] = [];
    const rg = [0, 8.5, 6.2, 4.8, 3.5, 3, 2.8, 2.5, 2.5, 2.5, 2.5];
    const cr = [0, 4.85, 4.9, 5.05, 5.15, 5.25, 5.35, 5.4, 5.45, 5.5, 5.55];
    const sp = [0, 15, 25, 45, 60, 55, 40, 30, 25, 20, 18];
    const va = [0, 0.65, 0.9, 1, 1, 1, 1, 1, 1, 1, 1];
    let cumulativeCF = 0;

    for (let y = 1; y <= 10; y++) {
      const growthMult = rg.slice(1, y + 1).reduce((a, b) => a * (1 + b / 100), 1);
      const noi = baseNOI * growthMult + va[y] * 285 * 140 * 12;
      const grossVal = noi / (cr[y] / 100);
      const netProceeds = grossVal * 0.97 - loan;
      cumulativeCF += Math.max(0, noi - loan * 0.0425);
      const mult = Math.round(((netProceeds + cumulativeCF) / equity) * 100) / 100;
      const irr = Math.round((Math.pow(Math.max(0.1, mult), 1 / y) - 1) * 1000) / 10;

      // RSS sub-scores
      const mw = Math.max(30, 90 - y * 4 - sp[y] * 0.3);
      const re = y <= 3 ? 68 : y <= 6 ? 62 : 55;
      const spos = Math.max(30, 85 - sp[y]);
      const or2 = va[y] >= 0.95 ? 88 : va[y] >= 0.8 ? 72 : 55;
      const bp = Math.max(40, 85 - y * 3);
      const rss = Math.round(mw * 0.35 + re * 0.25 + spos * 0.20 + or2 * 0.15 + bp * 0.05);

      yrs.push({
        year: y, label: `Y${y}`, noi: Math.round(noi),
        grossValue: Math.round(grossVal), netProceeds: Math.round(netProceeds),
        irr, multiple: mult, capRate: cr[y], supplyPressure: sp[y], rss,
        marketWindow: Math.round(mw), rateEnv: re, supplyPos: Math.round(spos),
        opReady: or2, buyerPressure: Math.round(bp),
        rentGrowth: rg[y], valueAddComplete: Math.round(va[y] * 100),
      });
    }
    return yrs;
  }, [baseNOI, equity, loan]);

  const optimalYear = useMemo(
    () => projectionModel.reduce((b, y) => y.rss > b.rss ? y : b, projectionModel[0]).year,
    [projectionModel],
  );

  // Quarterly interpolation (40 data points)
  const quarterlyData = useMemo((): QuarterlyPoint[] => {
    const quarters: QuarterlyPoint[] = [];
    const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
    for (let y = 1; y <= 10; y++) {
      const yd = projectionModel[y - 1];
      const prev = y > 1 ? projectionModel[y - 2] : {
        rss: 35, irr: 0, multiple: 1, capRate: 5, supplyPressure: 10,
      };
      for (let q = 0; q < 4; q++) {
        const f = (q + 1) / 4;
        quarters.push({
          q: (y - 1) * 4 + q + 1,
          label: `Y${y} ${qLabels[q]}`,
          year: y,
          rss: Math.round(prev.rss + (yd.rss - (prev as any).rss) * f),
          irr: Math.round((prev.irr + (yd.irr - prev.irr) * f) * 10) / 10,
          multiple: Math.round(((prev as any).multiple + (yd.multiple - (prev as any).multiple) * f) * 100) / 100,
          capRate: Math.round((prev.capRate + (yd.capRate - prev.capRate) * f) * 100) / 100,
          supply: Math.round((prev as any).supplyPressure + (yd.supplyPressure - (prev as any).supplyPressure) * f),
        });
      }
    }
    return quarters;
  }, [projectionModel]);

  // Detect exit windows (contiguous RSS >= 70 or >= 85)
  const windows = useMemo((): ExitWindow[] => {
    const w: ExitWindow[] = [];
    let cur: ExitWindow | null = null;
    quarterlyData.forEach(d => {
      const zone: 'sell' | 'prepare' | null = d.rss >= 85 ? 'sell' : d.rss >= 70 ? 'prepare' : null;
      if (zone && (!cur || cur.zone !== zone)) {
        if (cur) w.push(cur);
        cur = { zone, start: d.q, end: d.q, startLabel: d.label, endLabel: d.label };
      } else if (zone && cur) {
        cur.end = d.q;
        cur.endLabel = d.label;
      } else if (!zone && cur) {
        w.push(cur);
        cur = null;
      }
    });
    if (cur) w.push(cur);
    return w;
  }, [quarterlyData]);

  // Timeline events
  const events = useMemo((): TimelineEvent[] => [
    { quarter: 2,  icon: '🔧', short: 'Reno starts',    text: 'Value-add renovation begins', color: '#3b82f6' },
    { quarter: 8,  icon: '✅', short: '90% reno',       text: 'Renovation 90% complete',       color: '#16a34a' },
    { quarter: 10, icon: '🏢', short: '200u delivered',  text: 'Competitor: 200-unit delivers',  color: '#dc2626' },
    { quarter: 12, icon: '⭐', short: 'Stabilized',      text: 'Property stabilized',            color: '#16a34a' },
    { quarter: 14, icon: '💰', short: 'Prepay 1%',       text: 'Prepayment penalty drops to 1%', color: '#16a34a' },
    { quarter: 16, icon: '⚠️', short: 'Supply peak',    text: 'Peak supply — 1,240 units',      color: '#dc2626' },
    { quarter: 18, icon: '🏢', short: '350u comp',       text: '350-unit competitor 1.2mi',       color: '#dc2626' },
    { quarter: 22, icon: '📉', short: 'Supply eases',    text: 'Supply wave absorbed',            color: '#16a34a' },
    { quarter: 28, icon: '🔒', short: 'Debt matures',    text: 'Loan maturity — refi required',   color: '#d97706' },
    { quarter: 36, icon: '📊', short: 'Cycle mature',    text: 'Market entering mature phase',    color: '#6B7280' },
  ], []);

  return { projectionModel, optimalYear, quarterlyData, windows, events };
}

// ============================================================================
// Monitoring Data Hook (post-acquisition)
// ============================================================================

export function useMonitoringData() {
  return useMemo(() => ({
    current: { rss: 78 },
    drift: { irrD: 5.9, multD: 0.90 },
    rssHistory: [
      { month: 'Apr 25', rss: 52, projected: 55 },
      { month: 'Jun 25', rss: 58, projected: 58 },
      { month: 'Aug 25', rss: 63, projected: 61 },
      { month: 'Oct 25', rss: 67, projected: 63 },
      { month: 'Dec 25', rss: 71, projected: 65 },
      { month: 'Feb 26', rss: 76, projected: 67 },
      { month: 'Mar 26', rss: 78, projected: 68 },
    ],
    alerts: [
      { date: 'Feb 28', sev: 'warn' as const,  msg: 'Rent growth decel — 3mo at 4.1% vs 8.7% trailing 12mo' },
      { date: 'Feb 15', sev: 'go' as const,    msg: 'Transaction velocity +46.9% QoQ' },
      { date: 'Jan 30', sev: 'warn' as const,  msg: '350-unit comp confirmed Q3 2026' },
      { date: 'Jan 10', sev: 'go' as const,    msg: 'RSS crossed 75 — PREPARE zone' },
      { date: 'Dec 15', sev: 'info' as const,  msg: 'Prepay drops to 1% June 2026' },
    ],
    signals: {
      go: [
        { metric: 'Txn Velocity', value: '+46.9%', detail: '47 sales / 90d' },
        { metric: 'DOM', value: '28 days', detail: 'Down from 51' },
        { metric: 'Stabilized', value: '14 mo', detail: 'Institutional ready' },
        { metric: 'Rank', value: '#8/52', detail: 'Top 15%' },
        { metric: 'NOI Beat', value: '+5.9%', detail: '$2.84M vs $2.68M' },
      ],
      watch: [
        { metric: 'Rent Growth', value: '4.1%', detail: 'Peak 10.2%' },
        { metric: 'Supply', value: '1,240', detail: '+19.3% 24mo' },
        { metric: 'Prepay', value: '$345K', detail: 'Drops June' },
        { metric: 'Comp', value: 'Q3 2026', detail: '350u, 1.2mi' },
      ],
      concern: [
        { metric: 'Refi', value: '5.85%', detail: '+160bps' },
        { metric: 'Cap Spread', value: '77bps', detail: 'Avg 185' },
      ],
    },
    scenarios: [
      { name: 'Sell Now',   timing: 'Q2 2026', irr: 28.4, multiple: 4.30, cap: 4.85, risk: 'Prepay $345K',    rec: true },
      { name: 'Optimal',    timing: 'Q4 2026', irr: 26.1, multiple: 4.12, cap: 4.95, risk: 'Supply nearing',   rec: false },
      { name: 'Hold',       timing: 'Q1 2028', irr: 21.2, multiple: 3.52, cap: 5.35, risk: 'Refi + supply',    rec: false },
    ] as ExitScenario[],
  }), []);
}

// ============================================================================
// TAB 1: Exit Windows (◉)
// 10-year quarterly RSS timeline + gauge + year deep-dive
// ============================================================================

export const ExitWindowsTab: React.FC<{
  config?: ExitStrategyConfig;
}> = ({ config }) => {
  const [selectedYear, setSelectedYear] = useState(3);
  const { projectionModel, optimalYear, quarterlyData, windows, events } = useProjectionModel(config);
  const sel = projectionModel[selectedYear - 1];

  return (
    <div className="space-y-6">
      {/* Window badges */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">10-Year Exit Window Map</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Quarterly RSS projection with sell zones, supply pressure, and key events
          </p>
        </div>
        <div className="flex gap-2">
          {windows.map((w, i) => (
            <button
              key={i}
              onClick={() => setSelectedYear(Math.ceil(w.start / 4))}
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                w.zone === 'sell'
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
            >
              {w.zone === 'sell' ? '⭐' : '🟡'} {w.startLabel} – {w.endLabel}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Timeline Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            RSS Trajectory (Quarterly)
          </h4>
          <div className="flex gap-4">
            {[
              { color: '#16a34a', label: '85+ Sell' },
              { color: '#d97706', label: '70-84 Prepare' },
              { color: '#3b82f6', label: 'RSS Score' },
              { color: '#ef444466', label: 'Supply Pressure' },
            ].map((z, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-sm" style={{ background: z.color }} />
                <span className="text-[10px] text-gray-400">{z.label}</span>
              </div>
            ))}
          </div>
        </div>

        {(() => {
          const W = 900, H = 280, pad = 45;
          const maxRss = 100, minRss = 20;
          const range = maxRss - minRss;
          const xScale = (q: number) => pad + ((q - 1) / 39) * (W - 2 * pad);
          const yScale = (v: number) => H - pad - ((v - minRss) / range) * (H - 2 * pad);

          const rssPoints = quarterlyData.map(d => `${xScale(d.q)},${yScale(d.rss)}`).join(' ');
          const rssArea = rssPoints + ` ${xScale(40)},${yScale(minRss)} ${xScale(1)},${yScale(minRss)}`;
          const supplyPoints = quarterlyData.map(d => `${xScale(d.q)},${yScale(minRss + d.supply * 0.8)}`).join(' ');
          const supplyArea = supplyPoints + ` ${xScale(40)},${yScale(minRss)} ${xScale(1)},${yScale(minRss)}`;

          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
              {/* Zone backgrounds */}
              <rect x={pad} y={yScale(100)} width={W - 2 * pad} height={yScale(85) - yScale(100)} fill="#16a34a" fillOpacity={0.05} />
              <rect x={pad} y={yScale(85)} width={W - 2 * pad} height={yScale(70) - yScale(85)} fill="#d97706" fillOpacity={0.04} />

              {/* Threshold lines */}
              <line x1={pad} y1={yScale(85)} x2={W - pad} y2={yScale(85)} stroke="#16a34a" strokeWidth="0.8" strokeDasharray="4 4" />
              <line x1={pad} y1={yScale(70)} x2={W - pad} y2={yScale(70)} stroke="#d97706" strokeWidth="0.8" strokeDasharray="4 4" />
              <text x={W - pad + 4} y={yScale(85) + 4} fontSize="9" fill="#16a34a">85</text>
              <text x={W - pad + 4} y={yScale(70) + 4} fontSize="9" fill="#d97706">70</text>

              {/* Year grid + labels */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(yr => {
                const x = xScale(yr * 4);
                const isSel = yr === selectedYear;
                return (
                  <g key={yr}>
                    <line x1={x} y1={pad} x2={x} y2={H - pad}
                      stroke={isSel ? '#3b82f6' : '#F3F4F6'} strokeWidth={isSel ? 1.5 : 0.5} />
                    <text x={x} y={H - pad + 16} textAnchor="middle"
                      fontSize="11" fontWeight={isSel ? 700 : 400}
                      fill={isSel ? '#3b82f6' : '#9CA3AF'}>
                      Y{yr}
                    </text>
                  </g>
                );
              })}

              {/* Selected year highlight */}
              <rect
                x={xScale((selectedYear - 1) * 4 + 1)}
                y={pad}
                width={xScale(selectedYear * 4) - xScale((selectedYear - 1) * 4 + 1)}
                height={H - 2 * pad}
                fill="#3b82f6" fillOpacity={0.04} rx={4}
              />

              {/* Y-axis labels */}
              {[20, 40, 60, 80, 100].map(v => (
                <text key={v} x={pad - 6} y={yScale(v) + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">{v}</text>
              ))}

              {/* Supply area (red) */}
              <polygon points={supplyArea} fill="#ef4444" fillOpacity={0.06} />

              {/* RSS area + line */}
              <polygon points={rssArea} fill="#3b82f6" fillOpacity={0.08} />
              <polyline points={rssPoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />

              {/* Event markers */}
              {events.map((evt, i) => {
                const x = xScale(evt.quarter);
                return (
                  <g key={i}>
                    <line x1={x} y1={H - pad} x2={x} y2={H - pad + 6} stroke={evt.color} strokeWidth="1.5" />
                    <circle cx={x} cy={H - pad} r={3} fill={evt.color} fillOpacity={0.3}
                      stroke={evt.color} strokeWidth={1} />
                  </g>
                );
              })}
            </svg>
          );
        })()}

        {/* Event legend */}
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {events.map((evt, i) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded border bg-gray-50"
              style={{ color: evt.color, borderColor: evt.color + '33' }}>
              {evt.icon} {evt.short}
            </span>
          ))}
        </div>
      </div>

      {/* Year Selector + RSS Gauge + Returns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Gauge column */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            RSS Year {selectedYear}
          </h4>
          <RSSGauge score={sel.rss} size={150} />
          <div className="mt-4 text-left">
            <SubScoreBar label="Market Window" score={sel.marketWindow} weight={35} color="#3b82f6" />
            <SubScoreBar label="Rate Environment" score={sel.rateEnv} weight={25} color="#8B5CF6" delay={80} />
            <SubScoreBar label="Supply Position" score={sel.supplyPos} weight={20} color="#d97706" delay={160} />
            <SubScoreBar label="Op. Readiness" score={sel.opReady} weight={15} color="#16a34a" delay={240} />
            <SubScoreBar label="Buyer Pressure" score={sel.buyerPressure} weight={5} color="#ec4899" delay={320} />
          </div>
        </div>

        {/* Right 3-col area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Select Exit Year</h4>
              <span className="text-xs font-semibold text-green-600">Optimal: Year {optimalYear}</span>
            </div>
            <YearSelector years={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} selected={selectedYear}
              onChange={setSelectedYear} optimal={optimalYear} />
          </div>

          {/* Metric cards — matching renderKeyMetrics grid pattern */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Projected IRR', value: `${sel.irr}%`, color: sel.irr >= 20 ? 'text-green-600' : sel.irr >= 15 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Equity Multiple', value: `${sel.multiple}x`, color: sel.multiple >= 3 ? 'text-green-600' : sel.multiple >= 2 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Gross Value', value: fmtM(sel.grossValue), color: 'text-gray-900' },
              { label: 'Exit Cap Rate', value: `${sel.capRate}%`, color: 'text-gray-900' },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 uppercase">{m.label}</div>
                <div className={`text-xl font-bold mt-1 ${m.color}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Context row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rent Growth', value: `${sel.rentGrowth}%`, sub: `Year ${selectedYear}`, color: 'text-blue-600' },
              { label: 'Supply Pressure', value: `${sel.supplyPressure}%`, sub: '% of stock', color: sel.supplyPressure > 40 ? 'text-red-600' : 'text-amber-600' },
              { label: 'Value-Add', value: `${sel.valueAddComplete}%`, sub: 'Reno complete', color: sel.valueAddComplete >= 95 ? 'text-green-600' : 'text-amber-600' },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xs text-gray-500 uppercase">{m.label}</div>
                <div className={`text-lg font-bold mt-1 ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Verdict bar */}
          <div className={`rounded-lg border-2 p-4 text-center ${
            sel.rss >= 85 ? 'bg-green-50 border-green-200' :
            sel.rss >= 70 ? 'bg-amber-50 border-amber-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <span className={`text-2xl font-black ${
              sel.rss >= 85 ? 'text-green-600' : sel.rss >= 70 ? 'text-amber-600' : 'text-blue-600'
            }`}>{sel.rss}</span>
            <span className="text-sm font-semibold text-gray-600 ml-3">
              {sel.rss >= 85 ? 'STRONG SELL WINDOW' : sel.rss >= 70 ? 'PREPARE TO SELL' : sel.rss >= 50 ? 'WATCH — NOT YET' : 'HOLD'}
            </span>
            {selectedYear !== optimalYear && (
              <span className="text-xs text-green-600 ml-3">
                Best: Year {optimalYear} (RSS {projectionModel[optimalYear - 1].rss})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 2: Sensitivity (∿)
// IRR heat map — exit cap rate × rent growth matrix
// ============================================================================

export const SensitivityTab: React.FC<{
  config?: ExitStrategyConfig;
}> = ({ config }) => {
  const [selectedYear, setSelectedYear] = useState(5);
  const { projectionModel, optimalYear } = useProjectionModel(config);
  const sel = projectionModel[selectedYear - 1];
  const equity = config?.equityInvested || 8000000;
  const loan = config?.loanBalance || 19200000;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            IRR Sensitivity — Year {selectedYear} Exit
          </h4>
          <span className="text-xs text-gray-400">
            Base: {sel.capRate}% cap / {sel.rentGrowth}% growth
          </span>
        </div>
        <div className="mb-4">
          <YearSelector years={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} selected={selectedYear}
            onChange={setSelectedYear} optimal={optimalYear} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-semibold border-b border-gray-200">
                  Cap ↓ / Growth →
                </th>
                {[2, 3, 4, 5, 6].map(rg => (
                  <th key={rg} className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-200">
                    {rg}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[4.50, 4.75, 5.00, 5.25, 5.50, 5.75].map(cap => (
                <tr key={cap}>
                  <td className="px-4 py-2.5 text-xs text-gray-500 font-medium border-b border-gray-100">
                    {cap.toFixed(2)}%
                  </td>
                  {[2, 3, 4, 5, 6].map(rg => {
                    const adj = sel.noi * (1 + (rg - sel.rentGrowth) / 100);
                    const net = (adj / (cap / 100)) * 0.97 - loan;
                    const m2 = net / equity;
                    const ir = Math.round((Math.pow(Math.max(0.1, m2), 1 / selectedYear) - 1) * 1000) / 10;
                    const isBase = Math.abs(cap - sel.capRate) < 0.1 && Math.abs(rg - sel.rentGrowth) < 0.5;
                    return (
                      <td key={`${cap}-${rg}`} className={`px-4 py-2.5 text-center font-semibold border-b border-gray-100 ${
                        isBase ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''
                      } ${
                        ir >= 25 ? 'text-green-600' : ir >= 18 ? 'text-amber-600' : ir >= 12 ? 'text-gray-700' : 'text-red-500'
                      }`}>
                        {ir > 0 ? `${ir}%` : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          {[
            { color: 'bg-green-100', text: 'text-green-600', label: '≥25% IRR' },
            { color: 'bg-amber-100', text: 'text-amber-600', label: '18-24%' },
            { color: 'bg-gray-100', text: 'text-gray-600', label: '12-17%' },
            { color: 'bg-red-100', text: 'text-red-500', label: '<12%' },
          ].map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${l.color}`} />
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB 3: Monitor (◎)
// Post-acquisition drift detection, signals, exit scenarios
// ============================================================================

export const MonitorTab: React.FC<{
  dealStatus: 'pipeline' | 'owned';
}> = ({ dealStatus }) => {
  const mon = useMonitoringData();

  if (dealStatus !== 'owned') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
        <div className="text-3xl mb-3">📡</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Monitoring Mode</h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          This tab activates post-acquisition. Once this deal moves to "Owned Assets,"
          it will track actuals vs projections, recalculate RSS as new data arrives,
          and alert when your optimal exit window shifts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* RSS + Drift Header */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Current RSS</h4>
          <RSSGauge score={mon.current.rss} size={140} />
          <div className="flex justify-center gap-6 mt-3">
            <div>
              <div className="text-lg font-black text-green-600">+{mon.drift.irrD}%</div>
              <div className="text-[10px] text-gray-400">IRR vs plan</div>
            </div>
            <div className="w-px bg-gray-200" />
            <div>
              <div className="text-lg font-black text-green-600">+{mon.drift.multD}x</div>
              <div className="text-[10px] text-gray-400">Mult vs plan</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {/* Recommendation banner */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-300">
                    PREPARE TO SELL
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-300">
                    WINDOW: EARLIER
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900">Recommended Exit: Q3–Q4 2026</div>
                <div className="text-sm text-gray-600 mt-1">
                  Outperforming by 5.9% IRR. Market peaking. Supply wave approaching.
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Hold Period</div>
                <div className="text-2xl font-black text-gray-900">5y 11m</div>
              </div>
            </div>
          </div>

          {/* Quick stats — matches renderKeyMetrics grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'IRR', value: '28.4%', sub: 'Plan: 22.5%', color: 'text-green-600' },
              { label: 'Multiple', value: '4.30x', sub: 'Plan: 3.40x', color: 'text-green-600' },
              { label: 'Est. Value', value: '$60.2M', sub: 'Paid $28.5M', color: 'text-gray-900' },
              { label: 'RSS Trend', value: '+14pts', sub: 'Last 6 months', color: 'text-amber-600' },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-400 uppercase">{m.label}</div>
                <div className={`text-lg font-bold mt-0.5 ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-gray-400">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Recent Alerts</h4>
        <div className="space-y-2">
          {mon.alerts.map((a, i) => {
            const cfg = {
              go:   { bg: 'bg-green-50', border: 'border-green-100', label: 'POSITIVE', color: 'text-green-600' },
              warn: { bg: 'bg-amber-50', border: 'border-amber-100', label: 'WATCH',    color: 'text-amber-600' },
              info: { bg: 'bg-blue-50',  border: 'border-blue-100',  label: 'INFO',     color: 'text-blue-600' },
            }[a.sev];
            return (
              <div key={i} className={`px-4 py-3 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-[10px] text-gray-400">{a.date}</span>
                </div>
                <div className="text-xs text-gray-700">{a.msg}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Signal summary — 3-col grid matching existing renderKeyMetrics layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['go', 'watch', 'concern'] as const).map(key => {
          const cfg = {
            go:      { title: 'Go Signals',  color: 'text-green-600', badge: 'bg-green-100 text-green-700' },
            watch:   { title: 'Watch Items', color: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
            concern: { title: 'Concerns',    color: 'text-red-600',   badge: 'bg-red-100 text-red-700' },
          }[key];
          return (
            <div key={key} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                  {mon.signals[key].length}
                </span>
              </div>
              <div className="space-y-2">
                {mon.signals[key].map((s, i) => (
                  <SignalChip key={i} metric={s.metric} value={s.value} detail={s.detail} type={key} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Exit Scenarios — 3-col cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mon.scenarios.map((sc, i) => (
          <div key={i} className={`bg-white rounded-lg border-2 p-5 relative ${
            sc.rec ? 'border-green-300 shadow-md' : 'border-gray-200'
          }`}>
            {sc.rec && (
              <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-green-500 to-transparent" />
            )}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-bold text-gray-900">{sc.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sc.timing}</div>
              </div>
              {sc.rec && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 border border-green-300">
                  RECOMMENDED
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">IRR</div>
                <div className={`text-2xl font-black ${
                  sc.irr >= 25 ? 'text-green-600' : sc.irr >= 20 ? 'text-amber-600' : 'text-red-500'
                }`}>{sc.irr}%</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">Multiple</div>
                <div className={`text-2xl font-black ${
                  sc.multiple >= 4 ? 'text-green-600' : sc.multiple >= 3 ? 'text-amber-600' : 'text-red-500'
                }`}>{sc.multiple}x</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 flex justify-between">
              <div>
                <div className="text-[10px] text-gray-400">EXIT CAP</div>
                <div className="text-sm font-bold text-gray-900">{sc.cap}%</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400">KEY RISK</div>
                <div className="text-xs text-amber-600 font-medium">{sc.risk}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
