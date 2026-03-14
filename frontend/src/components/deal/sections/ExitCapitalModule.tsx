import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

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

// ═══════════════════════════════════════════════════════════════════════════
// EXIT RETURNS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

function computeExitReturns(fwdIdx: number, dealType: DealType): ExitReturns {
  const absIdx = NOW_IDX + fwdIdx;
  const holdYears = Math.max(0.25, (fwdIdx + 1) / 4);

  // Base deal economics by type
  const baseNOI = dealType === 'development' ? 2800000 : 3420000;
  const totalBasis = dealType === 'development' ? 52000000 : 46420000;
  const equity = dealType === 'development' ? 18200000 : 14920000;
  const annualDS = 2340000;

  // Build NOI through hold period
  let noiMult = 1;
  for (let i = NOW_IDX; i <= absIdx && i < TOTAL_Q; i++) {
    noiMult *= 1 + (RENT_GROWTH_21Y[i] ?? 2.5) / 100 / 4;
  }
  const exitNOI = baseNOI * noiMult;

  // Exit valuation
  const exitCap = (CAP_RATES_21Y[absIdx] ?? 5.0) / 100;
  const grossValue = exitNOI / exitCap;
  const sellingCosts = grossValue * 0.02;
  const loanPayoff = totalBasis - equity;
  const netProceeds = grossValue - sellingCosts - loanPayoff;

  // Cash flow through hold
  const yrs = Math.ceil(holdYears);
  let totalCF = 0;
  for (let y = 0; y < yrs; y++) {
    let ym = 1;
    for (let q = 0; q < 4 && y * 4 + q < fwdIdx; q++) {
      ym *= 1 + (RENT_GROWTH_21Y[NOW_IDX + y * 4 + q] ?? 2.5) / 100 / 4;
    }
    totalCF += baseNOI * ym - annualDS;
  }

  const totalReturn = totalCF + netProceeds;
  const em = equity > 0 ? totalReturn / equity : 0;
  const irr = holdYears > 0 && equity > 0 ? (Math.pow(Math.max(0.01, totalReturn / equity), 1 / holdYears) - 1) * 100 : 0;
  const rss = RSS_21Y[absIdx]?.rss ?? 50;

  return {
    holdYears: holdYears.toFixed(1),
    exitNOI,
    grossValue,
    netProceeds,
    totalReturn,
    irr: Math.max(0, Math.min(50, irr)),
    em: Math.max(0, em),
    exitCap: CAP_RATES_21Y[absIdx] ?? 5.0,
    rss,
    absIdx,
  };
}

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

        {/* CAPITAL STACK TAB (placeholder) */}
        {activeTab === 'stack' && <div style={{ color: 'rgba(232,230,225,0.5)' }}>Capital Stack tab — coming next</div>}

        {/* DEBT MARKET TAB (placeholder) */}
        {activeTab === 'market' && <div style={{ color: 'rgba(232,230,225,0.5)' }}>Debt Market tab — coming next</div>}

        {/* EXIT TIMING TAB (placeholder) */}
        {activeTab === 'timing' && <div style={{ color: 'rgba(232,230,225,0.5)' }}>Exit Timing tab — coming next</div>}

        {/* SENSITIVITY TAB (placeholder) */}
        {activeTab === 'sensitivity' && <div style={{ color: 'rgba(232,230,225,0.5)' }}>Sensitivity tab — coming next</div>}
      </div>
    </div>
  );
}

export default ExitCapitalModule;
