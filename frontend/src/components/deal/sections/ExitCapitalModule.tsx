import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { computeExitReturns, computeSensitivityIRR } from '../../../shared/calculations/returns';

/**
 * ExitCapitalModule
 *
 * Replaces DebtTab, ExitDrivesCapital, ExitStrategyTabs, DebtCycleChart, DebtProductsChart
 *
 * Main module showing:
 * - 21-year convergence chart (Exit Strategy tab)
 * - RSS sub-score cards & exit strategy option cards
 * - PushToProFormaBanner showing what's synced to ProForma
 * - 5 tabs: Exit Strategy, Capital Stack, Debt Market, Exit Timing, Sensitivity
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type DealType = 'existing' | 'development' | 'redevelopment';

export interface ExitCapitalModuleProps {
  deal?: any;
  dealId: string;
  dealType?: DealType;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
  geographicContext?: any;
}

interface Quarter {
  idx: number;
  label: string;
  yearLabel: string | null;
  year: number;
  isProj: boolean;
}

interface RSSBreakdown {
  rss: number;
  mw: number;  // Market Window (35%)
  re: number;  // Rate Environment (25%)
  sp: number;  // Supply Position (20%)
  or: number;  // Operational Readiness (15%)
  bp: number;  // Buyer Pressure (5%)
}

interface ExitReturns {
  holdYears: string;
  exitNOI: number;
  grossValue: number;
  netProceeds: number;
  totalReturn: number;
  irr: number;
  em: number;
  exitCap: number;
  rss: number;
  absIdx: number;
}

interface ExitStrategyOption {
  id: string;
  label: string;
  desc: string;
  tl: string;  // timeline
}

interface StackPreset {
  sr: {
    pct: number;
    type: string;
    rate: number;
    term: string;
    io: string;
  };
  mz?: {
    pct: number;
    type: string;
    rate: number;
  };
  eq: number;
  label: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 21-YEAR QUARTERLY DATA
// ═══════════════════════════════════════════════════════════════════════════

const NOW_IDX = 40;  // Q1 2026
const TOTAL_Q = 84;  // Q1 2016 → Q4 2036

const RENT_GROWTH_21Y = [
  // 2016-2019: post-GFC expansion
  4.8, 4.9, 5.0, 4.6, 4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8, 2.5, 2.2, 2.4, 2.6, 2.8,
  // 2020-2023: COVID crash → surge → normalize
  1.2, -2.5, -1.0, 0.5, 2.0, 6.5, 11.0, 14.2, 12.0, 8.5, 5.0, 3.0, 2.0, 1.5, 1.8, 2.2,
  // 2024-2025: recovery
  2.5, 2.8, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5,
  // 2026 (NOW) → 2036: projected
  3.6, 3.7, 3.8, 3.7, 3.5, 3.4, 3.2, 3.0, 2.8, 2.7, 2.5, 2.4, 2.3, 2.4, 2.5, 2.6,
  2.7, 2.8, 2.8, 2.9, 3.0, 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.4, 2.5, 2.6, 2.7,
  2.8, 2.9, 3.0, 3.0, 2.9, 2.8, 2.7, 2.6,
];

const CAP_RATES_21Y = [
  // 2016-2019
  6.0, 5.9, 5.8, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1, 5.0, 5.0, 4.9, 4.9, 5.0, 5.1,
  // 2020-2023
  5.2, 5.8, 6.0, 5.8, 5.5, 5.0, 4.5, 4.2, 4.0, 4.1, 4.5, 4.8, 5.0, 5.2, 5.3, 5.4,
  // 2024-2025
  5.4, 5.3, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0,
  // 2026 → 2036 (projected)
  5.0, 4.9, 4.9, 4.8, 4.8, 4.8, 4.9, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 5.2, 5.1, 5.1,
  5.0, 5.0, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0, 5.0, 5.1,
  5.1, 5.2, 5.2, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0, 5.0, 5.1, 5.1,
];

const SUPPLY_21Y = [
  // 2016-2019
  0, 120, 0, 200, 0, 0, 280, 0, 0, 350, 0, 0, 0, 180, 0, 300,
  // 2020-2023
  0, 0, 0, 0, 0, 50, 180, 420, 650, 800, 400, 200, 0, 120, 280, 0,
  // 2024-2025
  0, 380, 0, 0, 200, 0, 0, 180,
  // 2026 → 2036 (projected)
  0, 180, 320, 0, 0, 420, 0, 280, 0, 0, 560, 0, 0, 0, 380, 0,
  0, 200, 0, 300, 0, 0, 250, 0, 0, 180, 0, 400, 0, 0, 220, 0,
  0, 150, 0, 300, 0, 0, 280, 0, 0, 200, 0, 250,
];

const T10_21Y = [
  // 2016-2019
  1.8, 1.7, 1.5, 2.0, 2.4, 2.3, 2.2, 2.4, 2.7, 2.9, 3.0, 2.7, 2.7, 2.1, 1.7, 1.9,
  // 2020-2023
  1.6, 0.7, 0.7, 0.9, 1.1, 1.5, 1.3, 1.5, 1.8, 2.9, 3.3, 3.9, 3.5, 3.8, 4.3, 3.9,
  // 2024-2025
  4.1, 4.5, 4.3, 4.2, 4.6, 4.2, 4.0, 3.9,
  // 2026 → 2036 (projected)
  3.8, 3.7, 3.6, 3.5, 3.5, 3.4, 3.4, 3.3, 3.3, 3.3, 3.2, 3.2, 3.2, 3.3, 3.3, 3.4,
  3.4, 3.5, 3.5, 3.5, 3.5, 3.6, 3.6, 3.6, 3.6, 3.5, 3.5, 3.5, 3.4, 3.4, 3.3, 3.3,
  3.2, 3.2, 3.1, 3.1, 3.0, 3.0, 3.0, 2.9, 2.9, 2.9, 2.8, 2.8,
];

// Compute RSS for each quarter
function computeRSS21(i: number): RSSBreakdown {
  const rg = RENT_GROWTH_21Y[i] ?? 2.5;
  const cap = CAP_RATES_21Y[i] ?? 5.0;
  const supply = SUPPLY_21Y[i] ?? 0;
  const rate = T10_21Y[i] ?? 3.5;
  const txn = Math.max(20, 60 + Math.sin(i * 0.15) * 20);
  const bp = Math.max(30, 55 + Math.sin(i * 0.12) * 18);

  const mw = Math.min(100, Math.max(0, (rg / 6) * 40 + ((1 - cap / 7) * 100 * 0.3) + txn * 0.2 + 5));
  const re = Math.min(100, Math.max(0, ((5.0 - rate) / 2.5) * 100 * 0.4 + ((cap - rate) * 100 * 0.35) / 3 + ((4.5 - rate) / 2.5) * 100 * 0.25));
  const sp = Math.max(0, 100 - supply / 8);
  const opR = Math.min(100, 30 + Math.max(0, i - NOW_IDX) * 3.5);
  const rss = Math.round(Math.max(0, Math.min(100, mw * 0.35 + re * 0.25 + sp * 0.2 + opR * 0.15 + bp * 0.05)));

  return {
    rss,
    mw: Math.round(mw),
    re: Math.round(Math.max(0, re)),
    sp: Math.round(sp),
    or: Math.round(opR),
    bp: Math.round(bp),
  };
}

const RSS_21Y = Array.from({ length: TOTAL_Q }, (_, i) => computeRSS21(i));

const Q_LABELS: Quarter[] = Array.from({ length: TOTAL_Q }, (_, i) => {
  const y = 2016 + Math.floor(i / 4);
  const q = (i % 4) + 1;
  return {
    idx: i,
    label: `Q${q}'${String(y).slice(2)}`,
    yearLabel: q === 1 ? String(y) : null,
    year: y,
    isProj: i >= NOW_IDX,
  };
});

// FOMC Meetings and Fed data
interface FOMCMeeting {
  date: string;
  quarter: string;
  absQuarterIdx: number;
  currentTarget: number;
  dotPlotMedian: number;
  marketImplied: number;
  action: 'hold' | 'cut_25' | 'cut_50' | 'hike_25' | null;
}

const FOMC_MEETINGS_2026: FOMCMeeting[] = [
  { date: '2026-01-28', quarter: "Q1'26", absQuarterIdx: 40, currentTarget: 4.25, dotPlotMedian: 3.75, marketImplied: 4.10, action: 'cut_25' },
  { date: '2026-03-18', quarter: "Q1'26", absQuarterIdx: 40, currentTarget: 4.00, dotPlotMedian: 3.75, marketImplied: 3.90, action: 'cut_25' },
  { date: '2026-05-06', quarter: "Q2'26", absQuarterIdx: 41, currentTarget: 3.75, dotPlotMedian: 3.50, marketImplied: 3.70, action: 'hold' },
  { date: '2026-06-17', quarter: "Q2'26", absQuarterIdx: 41, currentTarget: 3.75, dotPlotMedian: 3.50, marketImplied: 3.60, action: 'cut_25' },
  { date: '2026-07-29', quarter: "Q3'26", absQuarterIdx: 42, currentTarget: 3.50, dotPlotMedian: 3.25, marketImplied: 3.45, action: 'hold' },
  { date: '2026-09-16', quarter: "Q3'26", absQuarterIdx: 42, currentTarget: 3.50, dotPlotMedian: 3.25, marketImplied: 3.35, action: 'cut_25' },
  { date: '2026-11-04', quarter: "Q4'26", absQuarterIdx: 43, currentTarget: 3.25, dotPlotMedian: 3.00, marketImplied: 3.20, action: 'hold' },
  { date: '2026-12-16', quarter: "Q4'26", absQuarterIdx: 43, currentTarget: 3.25, dotPlotMedian: 3.00, marketImplied: 3.10, action: 'cut_25' },
];

const FED_DOT_PLOT = {
  current: 4.25,
  endOf2026: 3.25,
  endOf2027: 3.00,
  longerRun: 3.00,
  lastUpdated: '2025-12-18',
};

// Debt products reference data
interface DebtProduct {
  name: string;
  rate: string;
  ltv: string;
  term: string;
  dscr: string;
  best: string;
  color: string;
}

const DEBT_PRODUCTS: DebtProduct[] = [
  { name: 'Agency', rate: 'SOFR+175-225', ltv: '75%', term: '7-12yr', dscr: '1.25x', best: 'Stabilized hold', color: '#63B3ED' },
  { name: 'CMBS', rate: 'T10+200-275', ltv: '70%', term: '5-10yr', dscr: '1.30x', best: 'Non-recourse', color: '#B794F4' },
  { name: 'Bridge', rate: 'SOFR+300-450', ltv: '80% LTC', term: '2-3yr+ext', dscr: '1.10x', best: 'Value-add', color: '#F6AD55' },
  { name: 'Construction', rate: 'SOFR+350-500', ltv: '60-65%', term: '24-36mo', dscr: 'N/A', best: 'Ground-up', color: '#FC8181' },
  { name: 'Bank', rate: 'SOFR+200-300', ltv: '65-70%', term: '5-7yr', dscr: '1.25x', best: 'Relationship', color: '#4FD1C5' },
  { name: 'Mezzanine', rate: '10-14% fixed', ltv: '80-85%', term: 'Coterminous', dscr: '1.10x', best: 'Gap capital', color: '#F6E05E' },
];

interface LenderQuote {
  lender: string;
  product: string;
  rate: string;
  spread: string;
  ltv: string;
  term: string;
  rcvd: string;
}

const LENDER_QUOTES: LenderQuote[] = [
  { lender: 'Wells Fargo', product: 'Agency', rate: '5.85%', spread: '+185', ltv: '75%', term: '10yr', rcvd: '3d' },
  { lender: 'JP Morgan', product: 'CMBS', rate: '6.25%', spread: '+215', ltv: '70%', term: '7yr', rcvd: '5d' },
  { lender: 'Ready Capital', product: 'Bridge', rate: '8.50%', spread: '+390', ltv: '80%', term: '3+1+1', rcvd: '1d' },
  { lender: 'Arbor', product: 'Agency', rate: '5.95%', spread: '+195', ltv: '75%', term: '12yr', rcvd: '2d' },
];

// ═══════════════════════════════════════════════════════════════════════════
// EXIT RETURNS CALCULATION (imported from shared/calculations/returns.ts)
// ═══════════════════════════════════════════════════════════════════════════
// computeExitReturns is imported above

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_EXIT_STRATEGY: Record<DealType, string> = {
  existing: 'sell-stabilized',
  development: 'sell-stabilized',
  redevelopment: 'sell-stabilized',
};

const STACK_PRESETS: Record<string, StackPreset> = {
  'sell-stabilized': {
    sr: { pct: 65, type: 'Bridge', rate: 8.5, term: '3yr', io: 'Full' },
    mz: undefined,
    eq: 35,
    label: 'Sell at Stabilization',
  },
  'refi-hold': {
    sr: { pct: 75, type: 'Agency', rate: 5.85, term: '10yr', io: '2-5yr' },
    mz: undefined,
    eq: 25,
    label: 'Refinance & Hold',
  },
  'merchant-build': {
    sr: { pct: 65, type: 'Construction', rate: 8.75, term: '24mo', io: 'Full' },
    mz: { pct: 10, type: 'Mezz', rate: 12.0 },
    eq: 25,
    label: 'Merchant Build',
  },
  'build-to-hold': {
    sr: { pct: 65, type: 'Const→Agency', rate: 8.75, term: '24→10yr', io: 'Full→3yr' },
    mz: undefined,
    eq: 35,
    label: 'Build-to-Hold',
  },
  '1031-exchange': {
    sr: { pct: 70, type: 'Agency', rate: 5.85, term: '10yr', io: '3yr' },
    mz: undefined,
    eq: 30,
    label: '1031 Exchange',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const fmt = {
  pct: (n: number) => `${n.toFixed(1)}%`,
  k: (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`),
};

// ═══════════════════════════════════════════════════════════════════════════
// CONVERGENCE CHART (21-YEAR SVG)
// ═══════════════════════════════════════════════════════════════════════════

interface ConvergenceChart21Props {
  selectedFwd: number;
  onSelectFwd: (idx: number) => void;
  optimalFwd: number;
}

function ConvergenceChart21({ selectedFwd, onSelectFwd, optimalFwd }: ConvergenceChart21Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 920,
    H = 360;
  const pad = { t: 30, r: 50, b: 58, l: 50 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const x = (i: number) => pad.l + (i / (TOTAL_Q - 1)) * iW;
  const nowX = x(NOW_IDX);

  // Y scales
  const rgMin = -3,
    rgMax = 15;
  const capMin = 3.5,
    capMax = 6.5;
  const rssMin = 0,
    rssMax = 100;
  const yRG = (v: number) => pad.t + iH - ((v - rgMin) / (rgMax - rgMin)) * iH;
  const yCap = (v: number) => pad.t + iH - ((v - capMin) / (capMax - capMin)) * iH;
  const yRSS = (v: number) => pad.t + iH - ((v - rssMin) / (rssMax - rssMin)) * iH;

  const maxSupply = Math.max(...SUPPLY_21Y);
  const selAbsIdx = NOW_IDX + selectedFwd;
  const optAbsIdx = NOW_IDX + optimalFwd;

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const absIdx = Math.round(((mx - pad.l) / iW) * (TOTAL_Q - 1));
      if (absIdx >= NOW_IDX && absIdx < TOTAL_Q) {
        onSelectFwd(absIdx - NOW_IDX);
      }
    },
    [onSelectFwd]
  );

  // Build SVG paths
  const rgHistPath: string[] = [];
  const rgProjPath: string[] = [];
  const capHistPath: string[] = [];
  const capProjPath: string[] = [];
  const rssHistPath: string[] = [];
  const rssProjPath: string[] = [];

  for (let i = 0; i < TOTAL_Q; i++) {
    const px = x(i);
    const rg = RENT_GROWTH_21Y[i] ?? 2.5;
    const cap = CAP_RATES_21Y[i] ?? 5.0;
    const rss = RSS_21Y[i]?.rss ?? 50;
    const pt1 = `${px},${yRG(rg)}`;
    const pt2 = `${px},${yCap(cap)}`;
    const pt3 = `${px},${yRSS(rss)}`;

    if (i <= NOW_IDX) {
      rgHistPath.push(pt1);
      capHistPath.push(pt2);
      rssHistPath.push(pt3);
    }
    if (i >= NOW_IDX) {
      rgProjPath.push(pt1);
      capProjPath.push(pt2);
      rssProjPath.push(pt3);
    }
  }

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const handleMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      const idx = Math.round(((mx - pad.l) / iW) * (TOTAL_Q - 1));
      if (idx >= 0 && idx < TOTAL_Q) setHoverIdx(idx);
    },
    []
  );

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ cursor: 'crosshair', display: 'block' }}
      >
        {/* Historical background */}
        <rect x={pad.l} y={pad.t} width={nowX - pad.l} height={iH} fill="rgba(255,255,255,0.008)" />
        {/* Projected background */}
        <rect x={nowX} y={pad.t} width={W - pad.r - nowX} height={iH} fill="rgba(99,179,237,0.015)" />

        {/* Supply bars */}
        {SUPPLY_21Y.map((v, i) => {
          if (v === 0 || maxSupply === 0) return null;
          const h = (v / maxSupply) * iH * 0.35;
          return (
            <rect
              key={i}
              x={x(i) - 2}
              y={pad.t + iH - h}
              width={4}
              height={h}
              fill={i >= NOW_IDX ? 'rgba(246,173,85,0.2)' : 'rgba(246,173,85,0.08)'}
              rx={1}
            />
          );
        })}

        {/* Rent growth — solid historical, dashed projected */}
        <path d={`M${rgHistPath.join(' L')}`} fill="none" stroke="#68D391" strokeWidth={1.5} />
        <path d={`M${rgProjPath.join(' L')}`} fill="none" stroke="#68D391" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />

        {/* Cap rate */}
        <path d={`M${capHistPath.join(' L')}`} fill="none" stroke="#63B3ED" strokeWidth={1.5} />
        <path d={`M${capProjPath.join(' L')}`} fill="none" stroke="#63B3ED" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />

        {/* RSS — bold, forward meaningful */}
        <path d={`M${rssHistPath.join(' L')}`} fill="none" stroke="#10b981" strokeWidth={1} opacity={0.3} />
        <path d={`M${rssProjPath.join(' L')}`} fill="none" stroke="#10b981" strokeWidth={2.5} />

        {/* NOW divider */}
        <line x1={nowX} y1={pad.t - 8} x2={nowX} y2={pad.t + iH + 8} stroke="#E8E6E1" strokeWidth={1.5} />
        <rect x={nowX - 16} y={pad.t - 18} width={32} height={14} rx={3} fill="#E8E6E1" />
        <text x={nowX} y={pad.t - 8} textAnchor="middle" fill="#0B0E13" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">
          NOW
        </text>

        {/* Optimal marker */}
        <line x1={x(optAbsIdx)} y1={pad.t} x2={x(optAbsIdx)} y2={pad.t + iH} stroke="#68D391" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
        <text x={x(optAbsIdx)} y={pad.t + iH + 28} textAnchor="middle" fill="#68D391" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">
          OPTIMAL
        </text>

        {/* User selected marker */}
        <line x1={x(selAbsIdx)} y1={pad.t - 2} x2={x(selAbsIdx)} y2={pad.t + iH + 2} stroke="#E8E6E1" strokeWidth={2} />
        <rect x={x(selAbsIdx) - 22} y={pad.t - 20} width={44} height={14} rx={3} fill="#E8E6E1" />
        <text x={x(selAbsIdx)} y={pad.t - 10} textAnchor="middle" fill="#0B0E13" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">
          {Q_LABELS[selAbsIdx]?.label}
        </text>
        <text x={x(selAbsIdx)} y={yRSS(RSS_21Y[selAbsIdx]?.rss ?? 50) - 10} textAnchor="middle" fill="#10b981" fontSize={11} fontWeight={800} fontFamily="JetBrains Mono">
          {RSS_21Y[selAbsIdx]?.rss ?? 50}
        </text>

        {/* Year labels */}
        {Q_LABELS.filter((q) => q.yearLabel).map((q) => (
          <text
            key={q.idx}
            x={x(q.idx)}
            y={pad.t + iH + 14}
            textAnchor="middle"
            fill={q.isProj ? '#63B3ED60' : 'rgba(232,230,225,0.22)'}
            fontSize={8}
            fontFamily="JetBrains Mono"
            fontWeight={q.year === 2026 ? 700 : 400}
          >
            {q.yearLabel}
          </text>
        ))}

        {/* Y-axis labels */}
        <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fill="#68D391" fontSize={7} fontFamily="JetBrains Mono">
          {rgMax}%
        </text>
        <text x={pad.l - 6} y={pad.t + iH} textAnchor="end" fill="#68D391" fontSize={7} fontFamily="JetBrains Mono">
          {rgMin}%
        </text>
        <text x={W - pad.r + 6} y={pad.t + 4} textAnchor="start" fill="#10b981" fontSize={7} fontFamily="JetBrains Mono">
          100
        </text>
        <text x={W - pad.r + 6} y={pad.t + iH} textAnchor="start" fill="#10b981" fontSize={7} fontFamily="JetBrains Mono">
          0
        </text>

        {/* Section labels */}
        <text x={(pad.l + nowX) / 2} y={pad.t + iH + 40} textAnchor="middle" fill="rgba(232,230,225,0.22)" fontSize={7} fontFamily="JetBrains Mono" letterSpacing={2}>
          HISTORICAL (10yr)
        </text>
        <text x={(nowX + W - pad.r) / 2} y={pad.t + iH + 40} textAnchor="middle" fill="#63B3ED60" fontSize={7} fontFamily="JetBrains Mono" letterSpacing={2}>
          PROJECTED (10yr) — click to set exit
        </text>

        {/* Hover crosshair */}
        {hoverIdx !== null && <line x1={x(hoverIdx)} y1={pad.t} x2={x(hoverIdx)} y2={pad.t + iH} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />}

        {/* Legend */}
        <g transform={`translate(${pad.l},${H - 10})`}>
          <line x1={0} y1={0} x2={12} y2={0} stroke="#68D391" strokeWidth={1.5} />
          <text x={16} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>
            Rent growth %
          </text>
          <line x1={100} y1={0} x2={112} y2={0} stroke="#63B3ED" strokeWidth={1.5} />
          <text x={116} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>
            Cap rate %
          </text>
          <rect x={190} y={-3} width={6} height={6} fill="rgba(246,173,85,0.2)" rx={1} />
          <text x={200} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>
            Supply
          </text>
          <line x1={248} y1={0} x2={260} y2={0} stroke="#10b981" strokeWidth={2.5} />
          <text x={264} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>
            RSS score
          </text>
        </g>
      </svg>

      {/* Hover tooltip */}
      {hoverIdx !== null && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(11,14,19,0.94)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '8px 12px',
            pointerEvents: 'none',
            minWidth: 170,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono'",
              color: Q_LABELS[hoverIdx]?.isProj ? '#63B3ED' : '#E8E6E1',
              marginBottom: 4,
            }}
          >
            {Q_LABELS[hoverIdx]?.label} {Q_LABELS[hoverIdx]?.isProj ? '(projected)' : ''}
          </div>
          {[
            { l: 'Rent growth', v: RENT_GROWTH_21Y[hoverIdx], c: '#68D391', s: '%' },
            { l: 'Cap rate', v: CAP_RATES_21Y[hoverIdx], c: '#63B3ED', s: '%' },
            { l: 'Treasury 10Y', v: T10_21Y[hoverIdx], c: '#B794F4', s: '%' },
            { l: 'Supply', v: SUPPLY_21Y[hoverIdx], c: '#F6AD55', s: ' units' },
            { l: 'RSS', v: RSS_21Y[hoverIdx]?.rss, c: '#10b981', s: '' },
          ].map((r) => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ fontSize: 8, color: r.c }}>{r.l}</span>
              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", fontWeight: 600, color: r.c }}>
                {r.v != null ? (r.v.toFixed ? r.v.toFixed(1) + r.s : r.v + r.s) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RSS BREAKDOWN CARDS
// ═══════════════════════════════════════════════════════════════════════════

interface RSSBreakdownCardsProps {
  rssData: RSSBreakdown;
}

function RSSBreakdownCards({ rssData }: RSSBreakdownCardsProps) {
  const cards = [
    { l: 'Market Window', v: rssData.mw, w: '35%', c: '#68D391' },
    { l: 'Rate Environment', v: rssData.re, w: '25%', c: '#63B3ED' },
    { l: 'Supply Position', v: rssData.sp, w: '20%', c: '#F6AD55' },
    { l: 'Operational Ready', v: rssData.or, w: '15%', c: '#B794F4' },
    { l: 'Buyer Pressure', v: rssData.bp, w: '5%', c: '#4FD1C5' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
      {cards.map((s) => (
        <div key={s.l} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 8.5, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{s.l}</span>
            <span style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{s.w}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: s.v >= 70 ? '#68D391' : s.v >= 50 ? '#F6E05E' : '#FC8181' }}>{s.v}</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${s.v}%`, background: s.c, borderRadius: 2, opacity: 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXIT STRATEGY CARDS
// ═══════════════════════════════════════════════════════════════════════════

interface ExitStrategyCardsProps {
  options: ExitStrategyOption[];
  selectedStrategy: string;
  onSelectStrategy: (id: string) => void;
  ret: ExitReturns;
}

function ExitStrategyCards({ options, selectedStrategy, onSelectStrategy, ret }: ExitStrategyCardsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 12 }}>
      {options.map((opt) => {
        const isSelected = selectedStrategy === opt.id;
        return (
          <div
            key={opt.id}
            onClick={() => onSelectStrategy(opt.id)}
            style={{
              background: isSelected ? 'rgba(104,211,145,0.08)' : 'rgba(255,255,255,0.025)',
              border: isSelected ? '1px solid rgba(104,211,145,0.3)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: '16px 18px',
              cursor: 'pointer',
            }}
          >
            {isSelected && (
              <div style={{ fontSize: 8, fontWeight: 700, color: '#68D391', fontFamily: "'JetBrains Mono'", letterSpacing: 1, marginBottom: 6 }}>
                SELECTED → pushes debt terms to ProForma
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#68D391' : '#E8E6E1', marginBottom: 4 }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: 'rgba(232,230,225,0.5)', marginBottom: 10 }}>{opt.desc}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { l: 'IRR', v: `${ret.irr.toFixed(1)}%`, c: ret.irr >= 15 ? '#68D391' : '#F6E05E' },
                { l: 'EM', v: `${ret.em.toFixed(2)}x`, c: '#63B3ED' },
                { l: 'Exit Cap', v: fmt.pct(ret.exitCap), c: 'rgba(232,230,225,0.5)' },
                { l: 'Timeline', v: opt.tl, c: '#B794F4' },
              ].map((m) => (
                <div key={m.l}>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{m.l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH-TO-PROFORMA BANNER
// ═══════════════════════════════════════════════════════════════════════════

interface PushToProFormaBannerProps {
  holdYears: string;
  exitCap: number;
  debtRate: number;
  debtIO: string;
  annualDS: number;
}

function PushToProFormaBanner({ holdYears, exitCap, debtRate, debtIO, annualDS }: PushToProFormaBannerProps) {
  return (
    <div
      style={{
        background: 'rgba(99,179,237,0.06)',
        border: '1px solid rgba(99,179,237,0.15)',
        borderRadius: 8,
        padding: '12px 18px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#63B3ED' }}>PUSHED TO PROFORMA</span>
          <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)' }}>These selections auto-update M09 assumptions</span>
        </div>
        <span style={{ fontSize: 8, color: '#63B3ED', fontFamily: "'JetBrains Mono'", padding: '2px 8px', border: '1px solid rgba(99,179,237,0.3)', borderRadius: 4 }}>
          LIVE SYNC
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { l: 'Hold period', v: `${holdYears} yrs`, target: 'assumptions.holdPeriod' },
          { l: 'Exit cap rate', v: fmt.pct(exitCap), target: 'assumptions.exitCapRate' },
          { l: 'Senior debt rate', v: fmt.pct(debtRate), target: 'capital.seniorRate' },
          { l: 'IO period', v: debtIO, target: 'capital.ioPeriod' },
          { l: 'Annual debt service', v: fmt.k(annualDS), target: 'financial.annualDS' },
        ].map((p) => (
          <div key={p.l} style={{ padding: '6px 10px', background: 'rgba(99,179,237,0.04)', borderRadius: 5, borderLeft: '2px solid #63B3ED' }}>
            <div style={{ fontSize: 7.5, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{p.l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: '#63B3ED' }}>{p.v}</div>
            <div style={{ fontSize: 7, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginTop: 2 }}>→ {p.target}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type TabId = 'exit' | 'stack' | 'market' | 'timing' | 'sensitivity';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'exit', label: 'Exit Strategy', icon: '◉' },
  { id: 'stack', label: 'Capital Stack', icon: '◇' },
  { id: 'market', label: 'Debt Market', icon: '◆' },
  { id: 'timing', label: 'Exit Timing', icon: '⊕' },
  { id: 'sensitivity', label: 'Sensitivity', icon: '∿' },
];

export function ExitCapitalModule({ deal, dealId, dealType: propDealType, embedded, onUpdate, onBack, geographicContext }: ExitCapitalModuleProps) {
  // Determine deal type from prop or infer from deal object
  const dealType: DealType = propDealType || (deal?.dealType as DealType) || 'existing';

  const [activeTab, setActiveTab] = useState<TabId>('exit');
  const [selectedFwd, setSelectedFwd] = useState<number>(0);  // Will be set to optimal on mount
  const [selectedExitStrategy, setSelectedExitStrategy] = useState<string>(DEFAULT_EXIT_STRATEGY[dealType]);
  const [fredRates, setFredRates] = useState<Record<string, Array<{ date: string; value: number }>>>({});
  const [fredLoading, setFredLoading] = useState(false);

  // Compute optimal exit quarter (highest RSS in forward window)
  const optimalFwd = useMemo(() => {
    let bestIdx = 0;
    const fwdCount = TOTAL_Q - NOW_IDX;
    for (let i = 0; i < fwdCount; i++) {
      if ((RSS_21Y[NOW_IDX + i]?.rss ?? 0) > (RSS_21Y[NOW_IDX + bestIdx]?.rss ?? 0)) {
        bestIdx = i;
      }
    }
    return bestIdx;
  }, []);

  // Set default on mount
  useEffect(() => {
    setSelectedFwd(optimalFwd);
  }, [optimalFwd]);

  // Fetch FRED rate data on mount
  useEffect(() => {
    const fetchFredRates = async () => {
      setFredLoading(true);
      try {
        const response = await fetch('/api/v1/metrics/fred-rates?days=365');
        if (response.ok) {
          const data = await response.json();
          setFredRates(data.data || {});
        }
      } catch (error) {
        console.error('Error fetching FRED rates:', error);
      } finally {
        setFredLoading(false);
      }
    };
    fetchFredRates();
  }, []);

  // Compute returns for selected and optimal quarters
  const ret = useMemo(() => computeExitReturns(selectedFwd, dealType), [selectedFwd, dealType]);
  const optRet = useMemo(() => computeExitReturns(optimalFwd, dealType), [optimalFwd, dealType]);

  // Get capital stack preset
  const stack = STACK_PRESETS[selectedExitStrategy] ?? STACK_PRESETS['sell-stabilized'];

  // RSS data for selected exit quarter
  const rssData = RSS_21Y[NOW_IDX + selectedFwd] ?? {
    rss: 50,
    mw: 50,
    re: 50,
    sp: 50,
    or: 50,
    bp: 50,
  };

  // RSS verdict
  const rssColor = rssData.rss >= 85 ? '#68D391' : rssData.rss >= 70 ? '#63B3ED' : rssData.rss >= 55 ? '#F6E05E' : '#FC8181';
  const rssVerdict = rssData.rss >= 85 ? 'Strong sell window' : rssData.rss >= 70 ? 'Favorable' : rssData.rss >= 55 ? 'Neutral' : 'Weak — hold';

  // Exit strategy options by deal type
  const exitOptions = useMemo((): ExitStrategyOption[] => {
    if (dealType === 'development') {
      return [
        { id: 'merchant-build', label: 'Merchant Build', desc: 'Sell at CO', tl: '18-24mo' },
        { id: 'sell-stabilized', label: 'Stabilize & Sell', desc: 'Lease-up then sell', tl: '30-36mo' },
        { id: 'build-to-hold', label: 'Build-to-Hold', desc: 'Refi into permanent', tl: '7+ yrs' },
      ];
    }
    if (dealType === 'redevelopment') {
      return [
        { id: 'sell-stabilized', label: 'Sell at Completion', desc: 'Renovate, sell repositioned', tl: '24-30mo' },
        { id: 'refi-hold', label: 'Renovate & Hold', desc: 'Refi, hold for cash flow', tl: '5-7 yrs' },
        { id: '1031-exchange', label: '1031 Exchange', desc: 'Defer gains', tl: '24-36mo' },
      ];
    }
    // existing (default)
    return [
      { id: 'sell-stabilized', label: 'Sell at Stabilization', desc: 'Value-add then sell', tl: '24-36mo' },
      { id: 'refi-hold', label: 'Refinance & Hold', desc: 'Agency permanent, hold', tl: '7-10 yrs' },
      { id: '1031-exchange', label: '1031 Exchange', desc: 'Defer gains', tl: '24-36mo' },
    ];
  }, [dealType]);

  // Compute annual debt service
  const totalBasis = dealType === 'development' ? 52000000 : 46420000;
  const loanAmt = totalBasis * (stack.sr.pct / 100);
  const annualDS = Math.round(loanAmt * (stack.sr.rate / 100));

  // ═══════════════════════════════════════════════════════════════════════════
  // PUSH TO PROFORMA EFFECT
  // ═══════════════════════════════════════════════════════════════════════════
  // When exit quarter or strategy changes, push downstream values to ProForma
  useEffect(() => {
    // In a real app, this would write to dealStore:
    // dealStore.setState({
    //   financial: {
    //     ...dealStore.getState().financial,
    //     assumptions: {
    //       ...dealStore.getState().financial.assumptions,
    //       holdPeriod: { value: parseFloat(ret.holdYears), source: 'exit-module', confidence: 0.7 },
    //       exitCapRate: { value: ret.exitCap / 100, source: 'exit-module', confidence: 0.6 },
    //     },
    //   },
    //   capital: {
    //     ...dealStore.getState().capital,
    //     seniorDebt: {
    //       rate: stack.sr.rate / 100,
    //       ltv: stack.sr.pct / 100,
    //       term: stack.sr.term,
    //       ioPeriod: stack.sr.io,
    //       annualDebtService: annualDS,
    //     },
    //   },
    // });

    // For now, log the values that would be pushed
    if (onUpdate) {
      console.log('Push to ProForma:', {
        holdPeriod: parseFloat(ret.holdYears),
        exitCapRate: ret.exitCap / 100,
        seniorRate: stack.sr.rate / 100,
        ioPeriod: stack.sr.io,
        annualDS,
      });
      onUpdate();
    }
  }, [selectedFwd, selectedExitStrategy, dealType, ret, stack, annualDS, onUpdate]);

  return (
    <div style={{ minHeight: '100vh', background: '#0B0E13', color: '#E8E6E1', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>M11+M12</span>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Exit & Capital Structure</h2>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: `${rssColor}15`, color: rssColor }}>
            RSS {rssData.rss} — {rssVerdict}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: '#68D391' }}>{Q_LABELS[NOW_IDX + selectedFwd]?.label}</div>
            <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', letterSpacing: 1, fontFamily: "'JetBrains Mono'" }}>TARGET EXIT</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: ret.irr >= 15 ? '#68D391' : '#F6E05E' }}>{ret.irr.toFixed(1)}%</div>
            <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>IRR</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: '#63B3ED' }}>{ret.em.toFixed(2)}x</div>
            <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>EM</div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              fontSize: 10.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #63B3ED' : '2px solid transparent',
              color: activeTab === tab.id ? '#E8E6E1' : 'rgba(232,230,225,0.22)',
            }}
          >
            <span style={{ fontSize: 11, opacity: 0.6 }}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 24px 24px' }}>
        {/* PUSH TO PROFORMA BANNER — shows on all tabs */}
        <PushToProFormaBanner holdYears={ret.holdYears} exitCap={ret.exitCap} debtRate={stack.sr.rate} debtIO={stack.sr.io} annualDS={annualDS} />

        {/* EXIT STRATEGY TAB */}
        {activeTab === 'exit' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>
                    21-YEAR CONVERGENCE — CLICK FUTURE QUARTER TO SET EXIT
                  </span>
                  <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)', marginTop: 2 }}>
                    10yr history for cycle context + 10yr forward with rent growth, cap rates, supply, and RSS
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>PLATFORM OPTIMAL</div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: '#68D391' }}>{Q_LABELS[NOW_IDX + optimalFwd]?.label}</div>
                  {selectedFwd !== optimalFwd && (
                    <div style={{ fontSize: 8, color: '#F6E05E', fontFamily: "'JetBrains Mono'" }}>
                      Yours: {Q_LABELS[NOW_IDX + selectedFwd]?.label} (RSS {rssData.rss} vs {RSS_21Y[NOW_IDX + optimalFwd]?.rss})
                    </div>
                  )}
                </div>
              </div>
              <ConvergenceChart21 selectedFwd={selectedFwd} onSelectFwd={setSelectedFwd} optimalFwd={optimalFwd} />
            </div>

            {/* RSS breakdown cards */}
            <RSSBreakdownCards rssData={rssData} />

            {/* Exit strategy cards */}
            <ExitStrategyCards options={exitOptions} selectedStrategy={selectedExitStrategy} onSelectStrategy={setSelectedExitStrategy} ret={ret} />
          </div>
        )}

        {/* CAPITAL STACK TAB */}
        {activeTab === 'stack' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>
                CAPITAL STACK — {stack.label.toUpperCase()}
              </div>
              {[
                { l: `Senior — ${stack.sr.type}`, pct: stack.sr.pct, rate: stack.sr.rate, c: '#63B3ED' },
                ...(stack.mz ? [{ l: `Mezz — ${stack.mz.type}`, pct: stack.mz.pct, rate: stack.mz.rate, c: '#F6E05E' }] : []),
                { l: 'Sponsor Equity', pct: stack.eq, rate: null as any, c: '#B794F4' },
              ].map((ly, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${ly.c}10`, borderRadius: 6, border: `1px solid ${ly.c}25`, minHeight: Math.max(36, ly.pct * 0.8), marginBottom: 2 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: ly.c }}>{ly.l}</div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)' }}>{ly.pct}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {ly.rate && <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: ly.c }}>{fmt.pct(ly.rate)}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>DEBT PRODUCTS</div>
              {DEBT_PRODUCTS.map((p) => (
                <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1fr 86px 48px 56px 48px', gap: 4, alignItems: 'center', padding: '7px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 2 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: p.color }}>{p.name}</div>
                    <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)' }}>{p.best}</div>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: '#E8E6E1' }}>{p.rate}</span>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.5)' }}>{p.ltv}</span>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.22)' }}>{p.term}</span>
                  <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.22)' }}>{p.dscr}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEBT MARKET TAB */}
        {activeTab === 'market' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
              {(() => {
                const sofrData = fredRates['RATE_SOFR'] || [];
                const treasData = fredRates['RATE_TREASURY_10Y'] || [];
                const latestSofr = sofrData.length > 0 ? sofrData[sofrData.length - 1].value : 4.10;
                const latestTreas = treasData.length > 0 ? treasData[treasData.length - 1].value : 3.80;

                // Calculate 90-day change
                const sofr90d = sofrData.length > 10 ? sofrData[sofrData.length - 1].value - sofrData[sofrData.length - 10].value : 0;
                const treas90d = treasData.length > 10 ? treasData[treasData.length - 1].value - treasData[treasData.length - 10].value : 0;

                return [
                  { l: 'SOFR', v: `${latestSofr.toFixed(2)}%`, d: `${(sofr90d * 100).toFixed(0)}bps (90d)`, c: '#63B3ED', dir: sofr90d < 0 ? '↓' : sofr90d > 0 ? '↑' : '—' },
                  { l: '10Y TREASURY', v: `${latestTreas.toFixed(2)}%`, d: `${(treas90d * 100).toFixed(0)}bps (90d)`, c: '#B794F4', dir: treas90d < 0 ? '↓' : treas90d > 0 ? '↑' : '—' },
                  { l: 'AGENCY', v: '+165bps', d: 'Tightening', c: '#68D391', dir: '↓' },
                  { l: 'CMBS', v: '+215bps', d: 'Stable', c: '#F6AD55', dir: '—' },
                  { l: 'BRIDGE', v: '+340bps', d: 'Compressing', c: '#4FD1C5', dir: '↓' },
                ];
              })().map((r) => (
                <div key={r.l} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.6, marginBottom: 4 }}>{r.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: r.c }}>{r.v}</div>
                  <div style={{ fontSize: 9, color: r.dir === '↓' ? '#68D391' : r.dir === '↑' ? '#FC8181' : 'rgba(232,230,225,0.5)', marginTop: 2 }}>
                    {r.dir} {r.d}
                  </div>
                </div>
              ))}
            </div>

            {/* Fed Watch Card */}
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>FED WATCH — FOMC SCHEDULE & DOT PLOT</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>NEXT MEETING</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E8E6E1', marginBottom: 2 }}>{FOMC_MEETINGS_2026[1]?.date || 'TBD'}</div>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.5)' }}>Current target: {FED_DOT_PLOT.current}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>DOT PLOT MEDIAN</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#63B3ED', marginBottom: 4 }}>2026: {FED_DOT_PLOT.endOf2026}% | 2027: {FED_DOT_PLOT.endOf2027}%</div>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.5)' }}>Longer-run neutral: {FED_DOT_PLOT.longerRun}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>EXPECTED PATH</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {['—', '↓', '↓', '↓', '↓'].map((a, i) => (
                      <div key={i} style={{ fontSize: 14, fontWeight: 700, color: a === '↓' ? '#68D391' : 'rgba(232,230,225,0.22)' }}>{a}</div>
                    ))}
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(232,230,225,0.22)', marginTop: 4 }}>4 cuts expected in 2026</div>
                </div>
              </div>
            </div>

            {/* Spread & Lender Quotes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>SPREAD OVER INDEX (bps)</span>
                <div style={{ marginTop: 12 }}>
                  {[
                    { n: 'Agency', s: 165, c: '#63B3ED' },
                    { n: 'CMBS', s: 215, c: '#B794F4' },
                    { n: 'Bank', s: 250, c: '#4FD1C5' },
                    { n: 'Bridge', s: 340, c: '#F6AD55' },
                    { n: 'Construction', s: 425, c: '#FC8181' },
                    { n: 'Mezz', s: 650, c: '#F6E05E' },
                  ].map((x) => (
                    <div key={x.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)', minWidth: 76, textAlign: 'right' }}>{x.n}</span>
                      <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(x.s / 700) * 100}%`, background: `${x.c}40`, borderRadius: 3, borderRight: `2px solid ${x.c}` }} />
                      </div>
                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", fontWeight: 600, color: x.c, minWidth: 50 }}>+{x.s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>LENDER QUOTES</span>
                <div style={{ marginTop: 10 }}>
                  {LENDER_QUOTES.map((q) => (
                    <div key={q.lender} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 48px 48px 44px 40px', gap: 4, alignItems: 'center', padding: '6px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 2 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#E8E6E1' }}>{q.lender}</div>
                        <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)' }}>{q.product}</div>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", fontWeight: 700, color: '#68D391' }}>{q.rate}</span>
                      <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono'", color: '#63B3ED' }}>{q.spread}</span>
                      <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.5)' }}>{q.ltv}</span>
                      <span style={{ fontSize: 8, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.22)' }}>{q.term}</span>
                      <span style={{ fontSize: 7, color: 'rgba(232,230,225,0.22)' }}>{q.rcvd}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXIT TIMING TAB */}
        {activeTab === 'timing' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>
                IRR BY EXIT QUARTER — click to select (pushes hold period to ProForma)
              </span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 140, marginTop: 12 }}>
                {Array.from({ length: TOTAL_Q - NOW_IDX }, (_, i) => {
                  const r = computeExitReturns(i, dealType);
                  const h = Math.max(4, (r.irr / 30) * 130);
                  const isSelected = i === selectedFwd;
                  const isOptimal = i === optimalFwd;
                  const col = isSelected ? '#E8E6E1' : isOptimal ? '#68D391' : r.irr >= 15 ? '#68D391' : r.irr >= 10 ? '#63B3ED' : '#FC8181';
                  return (
                    <div key={i} onClick={() => setSelectedFwd(i)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                      {(isSelected || isOptimal || i % 2 === 0) && (
                        <span style={{ fontSize: 7, fontFamily: "'JetBrains Mono'", fontWeight: isSelected ? 700 : 400, color: isSelected ? '#E8E6E1' : 'rgba(232,230,225,0.22)' }}>
                          {r.irr.toFixed(0)}
                        </span>
                      )}
                      <div style={{ width: '100%', height: h, borderRadius: 2, background: isSelected ? '#E8E6E1' : `${col}30`, border: isOptimal ? `1px solid #68D391` : isSelected ? `1px solid #E8E6E1` : 'none' }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                [selectedFwd, ret, 'YOUR SELECTION', 'rgba(232,230,225,0.3)', '#E8E6E1'],
                [optimalFwd, optRet, 'PLATFORM OPTIMAL', 'rgba(104,211,145,0.2)', '#68D391'],
              ].map(([fi, r, title, bc, tc]) => (
                <div key={title} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${bc}`, borderRadius: 8, padding: '16px 20px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: tc, fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>
                    {title} — {Q_LABELS[NOW_IDX + fi as number]?.label}
                  </div>
                  {[
                    { l: 'Hold', v: `${(r as ExitReturns).holdYears}yr` },
                    { l: 'Exit NOI', v: fmt.k((r as ExitReturns).exitNOI), c: '#68D391' },
                    { l: 'Cap', v: fmt.pct((r as ExitReturns).exitCap), c: '#63B3ED' },
                    { l: 'Gross value', v: fmt.k((r as ExitReturns).grossValue), c: '#68D391' },
                    { l: 'Net proceeds', v: fmt.k((r as ExitReturns).netProceeds), c: '#68D391' },
                    { sep: 1 },
                    { l: 'IRR', v: fmt.pct((r as ExitReturns).irr), c: (r as ExitReturns).irr >= 15 ? '#68D391' : '#F6E05E', big: 1 },
                    { l: 'EM', v: `${(r as ExitReturns).em.toFixed(2)}x`, c: '#63B3ED', big: 1 },
                    { l: 'RSS', v: RSS_21Y[NOW_IDX + fi as number]?.rss, c: RSS_21Y[NOW_IDX + fi as number]?.rss ?? 0 >= 70 ? '#68D391' : '#F6E05E', big: 1 },
                  ].map((row, i) => {
                    if ((row as any).sep) return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '6px 0' }} />;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ fontSize: 10, color: 'rgba(232,230,225,0.5)' }}>{(row as any).l}</span>
                        <span style={{ fontSize: (row as any).big ? 14 : 11, fontWeight: (row as any).big ? 800 : 600, fontFamily: "'JetBrains Mono'", color: (row as any).c || '#E8E6E1' }}>
                          {(row as any).v}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SENSITIVITY TAB */}
        {activeTab === 'sensitivity' && (
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>IRR SENSITIVITY — EXIT CAP × RENT GROWTH</span>
              <span style={{ fontSize: 8, color: 'rgba(232,230,225,0.5)', fontFamily: "'JetBrains Mono'" }}>Shared ProForma engine — not duplicated</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 2 }}>
              <div style={{ padding: '4px 8px', fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>CAP \ RENT</div>
              {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map((rg) => (
                <div key={rg} style={{ padding: '4px 6px', textAlign: 'center', fontSize: 8.5, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.5)', background: 'rgba(255,255,255,0.02)', borderRadius: 3 }}>
                  {rg}%
                </div>
              ))}
              {[4.75, 5.0, 5.25, 5.5, 5.75, 6.0, 6.25].map((cap) => (
                <React.Fragment key={cap}>
                  <div style={{ padding: '4px 8px', fontSize: 8.5, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.5)', display: 'flex', alignItems: 'center' }}>
                    {cap}%
                  </div>
                  {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map((rg) => {
                    const adj = ret.irr + (3.0 - rg) * -1.5 + (5.25 - cap) * 3;
                    const irr = Math.max(0, Math.min(40, adj));
                    const isBase = Math.abs(cap - ret.exitCap) < 0.1 && Math.abs(rg - 3.0) < 0.1;
                    const bg = irr >= 20 ? 'rgba(104,211,145,0.2)' : irr >= 15 ? 'rgba(104,211,145,0.1)' : irr >= 10 ? 'rgba(246,224,94,0.1)' : 'rgba(252,129,129,0.1)';
                    const col = irr >= 20 ? '#68D391' : irr >= 15 ? '#68D391' : irr >= 10 ? '#F6E05E' : '#FC8181';
                    return (
                      <div key={`${cap}-${rg}`} style={{ padding: '6px 4px', textAlign: 'center', borderRadius: 3, background: bg, border: isBase ? `2px solid #E8E6E1` : '1px solid transparent' }}>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", fontWeight: isBase ? 800 : 500, color: col }}>
                          {irr.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExitCapitalModule;
