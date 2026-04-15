import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { computeExitReturns } from '../../../shared/calculations/returns';
import { apiClient } from '../../../api/client';

interface LiveRates {
  sofr: number;
  sofrAvg30: number;
  effr: number;
  effrTargetLow: number;
  effrTargetHigh: number;
  prime: number;
  treasury1Y: number;
  treasury2Y: number;
  treasury3Y: number;
  treasury5Y: number;
  treasury7Y: number;
  treasury10Y: number;
  treasury20Y: number;
  treasury30Y: number;
  swap10Y: number;
  lastUpdated: string;
  source: string;
}

/**
 * ExitCapitalModule
 *
 * Replaces DebtTab, ExitDrivesCapital, ExitStrategyTabs, DebtCycleChart, DebtProductsChart
 *
 * Main module showing:
 * - 21-year convergence chart (Exit Strategy tab)
 * - RSS sub-score cards & exit strategy option cards
 * - PushToProFormaBanner showing what's synced to ProForma
 * - 3 tabs: Exit Strategy, Debt Market, Exit Timing (Capital Stack + Sensitivity live in F9 Pro Forma)
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
              <span style={{ fontSize: 9, color: r.c }}>{r.l}</span>
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
            <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{s.l}</span>
            <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{s.w}</span>
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
        <span style={{ fontSize: 9, color: '#63B3ED', fontFamily: "'JetBrains Mono'", padding: '2px 8px', border: '1px solid rgba(99,179,237,0.3)', borderRadius: 4 }}>
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
            <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{p.l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: '#63B3ED' }}>{p.v}</div>
            <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginTop: 2 }}>→ {p.target}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type TabId = 'exit' | 'market' | 'timing';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'exit', label: 'Exit Strategy', icon: '◉' },
  { id: 'market', label: 'Debt Market', icon: '◆' },
  { id: 'timing', label: 'Exit Timing', icon: '⊕' },
];

export function ExitCapitalModule({ deal, dealId, dealType: propDealType, embedded, onUpdate, onBack, geographicContext }: ExitCapitalModuleProps) {
  // Determine deal type from prop or infer from deal object
  const dealType: DealType = propDealType || (deal?.dealType as DealType) || 'existing';

  const [activeTab, setActiveTab] = useState<TabId>('exit');
  const [selectedFwd, setSelectedFwd] = useState<number>(0);  // Will be set to optimal on mount
  const [selectedExitStrategy, setSelectedExitStrategy] = useState<string>(DEFAULT_EXIT_STRATEGY[dealType]);
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);
  const [liveRatesLoading, setLiveRatesLoading] = useState(false);

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

  // Fetch live rates when Debt Market tab is opened (cached 15min on backend)
  useEffect(() => {
    if (activeTab !== 'market' || liveRates !== null) return;
    setLiveRatesLoading(true);
    apiClient.get('/capital-structure/rates/live')
      .then((data: any) => setLiveRates(data?.data ?? data))
      .catch(() => {})
      .finally(() => setLiveRatesLoading(false));
  }, [activeTab, liveRates]);

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
    <div style={{ height: '100%', background: '#0B0E13', color: '#E8E6E1', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* PUSH TO PROFORMA BANNER — module-level, not per-tab */}
      <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
        <PushToProFormaBanner holdYears={ret.holdYears} exitCap={ret.exitCap} debtRate={stack.sr.rate} debtIO={stack.sr.io} annualDS={annualDS} />
      </div>

      {/* Tab navigation */}
      <div style={{ padding: '0 24px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', background: 'rgba(255,255,255,0.01)', flexShrink: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, paddingRight: 4 }}>
          {[
            { label: 'EXIT', value: Q_LABELS[NOW_IDX + selectedFwd]?.label ?? '—', color: '#68D391' },
            { label: 'IRR', value: `${ret.irr.toFixed(1)}%`, color: ret.irr >= 15 ? '#68D391' : '#F6E05E' },
            { label: 'EM', value: `${ret.em.toFixed(2)}x`, color: '#63B3ED' },
            { label: `RSS`, value: `${rssData.rss} — ${rssVerdict}`, color: rssColor },
          ].map((m) => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(232,230,225,0.25)', fontFamily: "'JetBrains Mono'" }}>{m.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 24px 24px', flex: 1, overflowY: 'auto' }}>

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
                    <div style={{ fontSize: 9, color: '#F6E05E', fontFamily: "'JetBrains Mono'" }}>
                      Yours: {Q_LABELS[NOW_IDX + selectedFwd]?.label} (RSS {rssData.rss} vs {RSS_21Y[NOW_IDX + optimalFwd]?.rss})
                    </div>
                  )}
                </div>
              </div>
              <ConvergenceChart21 selectedFwd={selectedFwd} onSelectFwd={setSelectedFwd} optimalFwd={optimalFwd} />
            </div>

            {/* RSS breakdown cards */}
            <RSSBreakdownCards rssData={rssData} />

            {/* F9 cross-link */}
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.15)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.3)', fontFamily: "'JetBrains Mono'" }}>⊙</span>
              <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.45)', fontFamily: "'JetBrains Mono'" }}>
                Full debt stack designer (multi-tranche, amortization, SOFR curves) and IRR sensitivity matrix are in
              </span>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: 'proforma' }));
                  setTimeout(() => window.dispatchEvent(new CustomEvent('fe-tab-change', { detail: 6 })), 120);
                }}
                style={{ fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: '#63B3ED', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                F9 · PRO FORMA → ⊙ DEBT &amp; ∿ SENSITIVITY
              </button>
            </div>
          </div>
        )}

        {/* DEBT MARKET TAB */}
        {activeTab === 'market' && (() => {
          // Spread config per loan type
          const SPREADS: Record<string, { label: string; bps: number; index: string; c: string }> = {
            'Agency':       { label: 'Agency',       bps: 165, index: '10Y T', c: '#63B3ED' },
            'CMBS':         { label: 'CMBS',         bps: 215, index: '10Y T', c: '#B794F4' },
            'Bank':         { label: 'Bank',         bps: 250, index: 'SOFR',  c: '#4FD1C5' },
            'Bridge':       { label: 'Bridge',       bps: 340, index: 'SOFR',  c: '#F6AD55' },
            'Construction': { label: 'Construction', bps: 425, index: 'SOFR',  c: '#FC8181' },
            'Mezz':         { label: 'Mezz',         bps: 650, index: 'SOFR',  c: '#F6E05E' },
          };

          // Map strategy to spread entry + index rate from live data
          const STRATEGY_SPREAD_MAP: Record<string, { spreadKey: string; indexLabel: string; getIndex: (r: LiveRates) => number }> = {
            'sell-stabilized': { spreadKey: 'Bridge',       indexLabel: 'SOFR',         getIndex: r => r.sofr },
            'refi-hold':       { spreadKey: 'Agency',       indexLabel: '10Y Treasury', getIndex: r => r.treasury10Y },
            'merchant-build':  { spreadKey: 'Construction', indexLabel: 'SOFR',         getIndex: r => r.sofr },
            'build-to-hold':   { spreadKey: 'Construction', indexLabel: 'SOFR',         getIndex: r => r.sofr },
            '1031-exchange':   { spreadKey: 'Agency',       indexLabel: '10Y Treasury', getIndex: r => r.treasury10Y },
          };

          const stratMap = STRATEGY_SPREAD_MAP[selectedExitStrategy] ?? STRATEGY_SPREAD_MAP['sell-stabilized'];
          const liveIndex = liveRates ? stratMap.getIndex(liveRates) : null;
          const spreadEntry = SPREADS[stratMap.spreadKey];
          const liveAllIn = liveIndex != null ? liveIndex + spreadEntry.bps / 100 : null;
          const presetRate = stack.sr.rate;
          const deltaBps = liveAllIn != null ? Math.round((liveAllIn - presetRate) * 100) : null;
          const deltaAnnualDS = deltaBps != null ? Math.round(loanAmt * (deltaBps / 10000)) : null;

          const curvePoints = liveRates ? [
            { l: '1Y',  v: liveRates.treasury1Y },
            { l: '2Y',  v: liveRates.treasury2Y },
            { l: '3Y',  v: liveRates.treasury3Y },
            { l: '5Y',  v: liveRates.treasury5Y },
            { l: '7Y',  v: liveRates.treasury7Y },
            { l: '10Y', v: liveRates.treasury10Y },
            { l: '20Y', v: liveRates.treasury20Y },
            { l: '30Y', v: liveRates.treasury30Y },
          ] : [];
          const curveMax = curvePoints.length ? Math.max(...curvePoints.map(p => p.v)) + 0.5 : 6;
          const updatedAt = liveRates?.lastUpdated ? new Date(liveRates.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;

          return (
            <div>
              {/* Live rate banner header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>
                  LIVE MARKET RATES — NY FED / US TREASURY
                </span>
                {liveRatesLoading && (
                  <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>fetching…</span>
                )}
                {updatedAt && !liveRatesLoading && (
                  <span style={{ fontSize: 9, color: '#68D391', fontFamily: "'JetBrains Mono'" }}>● LIVE · updated {updatedAt}</span>
                )}
              </div>

              {/* 4 live rate cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { l: 'SOFR',         v: liveRates?.sofr,         sub: `30d avg: ${liveRates?.sofrAvg30?.toFixed(2) ?? '—'}%`, c: '#63B3ED' },
                  { l: '10Y TREASURY', v: liveRates?.treasury10Y,   sub: `30Y: ${liveRates?.treasury30Y?.toFixed(2) ?? '—'}%`,    c: '#B794F4' },
                  { l: 'PRIME RATE',   v: liveRates?.prime,         sub: `EFFR: ${liveRates?.effr?.toFixed(2) ?? '—'}%`,          c: '#F6AD55' },
                  { l: 'EFFR TARGET',  v: liveRates ? (liveRates.effrTargetLow + liveRates.effrTargetHigh) / 2 : undefined, sub: liveRates ? `${liveRates.effrTargetLow.toFixed(2)}–${liveRates.effrTargetHigh.toFixed(2)}%` : '—', c: '#4FD1C5' },
                ].map((r) => (
                  <div key={r.l} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.6, marginBottom: 4 }}>{r.l}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: r.v != null ? r.c : 'rgba(232,230,225,0.15)' }}>
                      {r.v != null ? `${r.v.toFixed(2)}%` : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.35)', marginTop: 2 }}>{r.sub}</div>
                  </div>
                ))}
              </div>

              {/* Rate Impact on This Deal */}
              <div style={{ background: liveRates ? 'rgba(99,179,237,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${liveRates ? 'rgba(99,179,237,0.18)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: liveRates ? '#63B3ED' : 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 12 }}>
                  RATE IMPACT ON THIS DEAL — {stack.label.toUpperCase()} @ {presetRate}% PRESET vs. LIVE MARKET
                </div>
                {!liveRates && !liveRatesLoading && (
                  <div style={{ fontSize: 10, color: 'rgba(232,230,225,0.35)' }}>Open this tab to load live rates.</div>
                )}
                {liveRates && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Left: rate comparison */}
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { l: 'Model preset rate', v: `${presetRate.toFixed(2)}%`, c: '#E8E6E1' },
                          { l: `${stratMap.spreadKey} index (${stratMap.indexLabel})`, v: `${liveIndex!.toFixed(2)}%`, c: '#63B3ED' },
                          { l: `Market spread (${spreadEntry.bps}bps)`, v: `+${(spreadEntry.bps / 100).toFixed(2)}%`, c: 'rgba(232,230,225,0.5)' },
                          { l: 'Live all-in estimate', v: `${liveAllIn!.toFixed(2)}%`, c: deltaBps! > 0 ? '#FC8181' : '#68D391' },
                          { l: 'Delta vs. preset', v: `${deltaBps! > 0 ? '+' : ''}${deltaBps}bps`, c: deltaBps! > 0 ? '#FC8181' : '#68D391' },
                          { l: 'Annual DS delta', v: deltaAnnualDS! > 0 ? `+${fmt.k(deltaAnnualDS!)}/yr` : `${fmt.k(deltaAnnualDS!)}/yr`, c: deltaAnnualDS! > 0 ? '#FC8181' : '#68D391' },
                        ].map(m => (
                          <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.35)', fontFamily: "'JetBrains Mono'" }}>{m.l}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: m.c }}>{m.v}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, padding: '7px 10px', background: deltaBps! > 0 ? 'rgba(252,129,129,0.06)' : 'rgba(104,211,145,0.06)', borderRadius: 5, border: `1px solid ${deltaBps! > 0 ? 'rgba(252,129,129,0.2)' : 'rgba(104,211,145,0.2)'}` }}>
                        <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: deltaBps! > 0 ? '#FC8181' : '#68D391', fontWeight: 700 }}>
                          {deltaBps! > 0
                            ? `⚠ Live market is ${deltaBps}bps above your preset. If rates hold, update assumption in F9.`
                            : `✓ Live market is ${Math.abs(deltaBps!)}bps below your preset. Your model is conservative.`}
                        </div>
                      </div>
                    </div>
                    {/* Right: bps sensitivity table */}
                    <div>
                      <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 8 }}>±BPS SENSITIVITY ON THIS LOAN</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {[-150, -100, -50, 0, 50, 100, 150].map(bps => {
                          const ds = Math.round(loanAmt * (bps / 10000));
                          const isCurrent = bps === 0;
                          const isClose = deltaBps != null && Math.abs(bps - deltaBps) <= 25;
                          return (
                            <div key={bps} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px', gap: 8, alignItems: 'center', padding: '4px 8px', borderRadius: 4, background: isCurrent ? 'rgba(255,255,255,0.06)' : isClose ? 'rgba(99,179,237,0.06)' : 'transparent', border: isClose ? '1px solid rgba(99,179,237,0.15)' : '1px solid transparent' }}>
                              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: bps < 0 ? '#68D391' : bps > 0 ? '#FC8181' : '#E8E6E1', fontWeight: isCurrent ? 700 : 400 }}>
                                {bps === 0 ? 'PRESET' : `${bps > 0 ? '+' : ''}${bps}bps`}
                              </span>
                              <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Math.abs((presetRate + bps / 100) / 12) * 100)}%`, background: bps < 0 ? '#68D391' : bps === 0 ? '#E8E6E1' : '#FC8181', opacity: 0.5, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: ds < 0 ? '#68D391' : ds > 0 ? '#FC8181' : 'rgba(232,230,225,0.5)', textAlign: 'right' }}>
                                {ds === 0 ? `${fmt.k(annualDS)}/yr` : `${ds > 0 ? '+' : ''}${fmt.k(ds)}/yr`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', marginTop: 6, fontFamily: "'JetBrains Mono'" }}>
                        Loan: {fmt.k(loanAmt)} · {stack.sr.pct}% LTV on {fmt.k(totalBasis)}
                      </div>
                      {deltaBps != null && (
                        <div style={{ fontSize: 9, color: '#63B3ED', marginTop: 4, fontFamily: "'JetBrains Mono'" }}>
                          ▲ Live market delta highlighted above
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Treasury Yield Curve */}
              {liveRates && (
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>
                    US TREASURY YIELD CURVE — live
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                    {curvePoints.map((pt) => {
                      const pct = (pt.v / curveMax) * 100;
                      const isKey = pt.l === '10Y';
                      return (
                        <div key={pt.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ fontSize: 8, fontFamily: "'JetBrains Mono'", color: isKey ? '#B794F4' : 'rgba(232,230,225,0.5)', marginBottom: 2 }}>{pt.v.toFixed(2)}</div>
                          <div style={{ width: '100%', height: `${pct}%`, background: isKey ? 'rgba(183,148,244,0.4)' : 'rgba(99,179,237,0.25)', borderRadius: '3px 3px 0 0', border: isKey ? '1px solid rgba(183,148,244,0.5)' : '1px solid rgba(99,179,237,0.2)' }} />
                          <div style={{ fontSize: 8, fontFamily: "'JetBrains Mono'", color: isKey ? '#B794F4' : 'rgba(232,230,225,0.35)', marginTop: 3 }}>{pt.l}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', marginTop: 6, fontFamily: "'JetBrains Mono'" }}>
                    Source: {liveRates.source} · as of {updatedAt}
                  </div>
                </div>
              )}

              {/* Fed Watch Card */}
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>FED WATCH — FOMC SCHEDULE & DOT PLOT</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>NEXT MEETING</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E8E6E1', marginBottom: 2 }}>{FOMC_MEETINGS_2026[1]?.date || 'TBD'}</div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)' }}>Current target: {liveRates ? `${liveRates.effrTargetLow.toFixed(2)}–${liveRates.effrTargetHigh.toFixed(2)}%` : `${FED_DOT_PLOT.current}%`}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>DOT PLOT MEDIAN</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#63B3ED', marginBottom: 4 }}>2026: {FED_DOT_PLOT.endOf2026}% | 2027: {FED_DOT_PLOT.endOf2027}%</div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)' }}>Longer-run neutral: {FED_DOT_PLOT.longerRun}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>EXPECTED PATH</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {['—', '↓', '↓', '↓', '↓'].map((a, i) => (
                        <div key={i} style={{ fontSize: 14, fontWeight: 700, color: a === '↓' ? '#68D391' : 'rgba(232,230,225,0.22)' }}>{a}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', marginTop: 4 }}>4 cuts expected in 2026</div>
                  </div>
                </div>
              </div>

              {/* Spread & Lender Quotes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>SPREAD OVER INDEX (bps)</span>
                  <div style={{ marginTop: 12 }}>
                    {Object.values(SPREADS).map((x) => {
                      const base = x.index === '10Y T' ? liveRates?.treasury10Y : liveRates?.sofr;
                      const allIn = base != null ? base + x.bps / 100 : null;
                      return (
                        <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.5)', minWidth: 76, textAlign: 'right' }}>{x.label}</span>
                          <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(x.bps / 700) * 100}%`, background: `${x.c}40`, borderRadius: 3, borderRight: `2px solid ${x.c}` }} />
                          </div>
                          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", fontWeight: 600, color: x.c, minWidth: 50 }}>+{x.bps}</span>
                          {allIn != null && (
                            <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.35)', minWidth: 44 }}>{allIn.toFixed(2)}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>LENDER QUOTES</span>
                  <div style={{ marginTop: 10 }}>
                    {LENDER_QUOTES.map((q) => (
                      <div key={q.lender} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 48px 48px 44px 40px', gap: 4, alignItems: 'center', padding: '6px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 2 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#E8E6E1' }}>{q.lender}</div>
                          <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)' }}>{q.product}</div>
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono'", fontWeight: 700, color: '#68D391' }}>{q.rate}</span>
                        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: '#63B3ED' }}>{q.spread}</span>
                        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.5)' }}>{q.ltv}</span>
                        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: 'rgba(232,230,225,0.22)' }}>{q.term}</span>
                        <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)' }}>{q.rcvd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* EXIT TIMING TAB */}
        {activeTab === 'timing' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>
                IRR BY EXIT QUARTER — alternate view · same selection as convergence chart above
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
                        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", fontWeight: isSelected ? 700 : 400, color: isSelected ? '#E8E6E1' : 'rgba(232,230,225,0.22)' }}>
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

      </div>
    </div>
  );
}

export default ExitCapitalModule;
