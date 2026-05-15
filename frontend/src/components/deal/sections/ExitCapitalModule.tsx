import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { computeExitReturns } from '../../../shared/calculations/returns';
import { apiClient } from '../../../api/client';
import { useDealModule } from '../../../contexts/DealModuleContext';

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
  rss: number | null;       // composite (null until D5 aggregation is wired)
  mw: number | null;  // Market Window (35%)
  re: number | null;  // Rate Environment (25%)
  sp: number | null;  // Supply Position (20%) — W-10: live from M35 pipeline
  or: number | null;  // Operational Readiness (15%)
  bp: number | null;  // Buyer Pressure (5%)  — W-10: live from M07-via-JEDI
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
//
// D1 (CE-04, P0): The four 21-year arrays (RENT_GROWTH_21Y, CAP_RATES_21Y,
// SUPPLY_21Y, T10_21Y) and the synthetic computeRSS21 / RSS_21Y derived
// from them were removed. The audit found that a detailed-looking 21-year
// projection driven by compiled-in constants was actively misleading
// users.
//
// Per-quarter series are now passed into the chart as
// `(number | null)[]`. When the live source isn't wired for a given
// quarter the cell is null and the chart renders only the grid +
// time axis + history-vs-projected boundary, plus a clear "no live
// trajectory available" message. Downstream dispatches (D2 exit cap
// reconciliation, D4 event wiring) will populate the projected-half
// of these series; the historical half will follow once
// historical_observations realized series flow through.
//
// NOW_IDX / TOTAL_Q remain — they are time-axis math, not fiction.

const NOW_IDX = 40;  // Q1 2026
const TOTAL_Q = 84;  // Q1 2016 → Q4 2036

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

// D1: the chart accepts series as `(number | null)[]`. Each index 0..83
// corresponds to a quarter from Q1 2016 .. Q4 2036 (NOW_IDX = 40 = Q1 2026).
// `null` slots mean "no live data available for that quarter" — the chart
// will skip the polyline segment and the tooltip will render "—".
interface ConvergenceChart21Series {
  rentGrowth: (number | null)[];   // quarterly rent growth %
  capRate: (number | null)[];      // quarterly cap rate %
  supply: (number | null)[];       // quarterly net new supply (units)
  treasury10y: (number | null)[];  // quarterly 10y Treasury %
  rss: (number | null)[];          // quarterly RSS composite 0-100
}

interface ConvergenceChart21Props {
  selectedFwd: number;
  onSelectFwd: (idx: number) => void;
  optimalFwd: number | null;
  series: ConvergenceChart21Series;
  liveEvents?: M35Event[];
  selectedEventId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const CHART_KEY_EVENTS: Array<{ idx: number; label: string; phase: 'past' | 'future'; color: string; sublabel: string }> = [
  { idx: 17, label: 'COVID',    phase: 'past',   color: 'rgba(252,129,129,0.8)',  sublabel: 'Q2\'20 · Demand shock'      },
  { idx: 24, label: 'RATE↑',   phase: 'past',   color: 'rgba(246,173,85,0.85)',  sublabel: 'Q1\'22 · Hike cycle begins'  },
  { idx: 30, label: 'PEAK',    phase: 'past',   color: 'rgba(252,129,129,0.85)', sublabel: 'Q3\'23 · 5.25–5.50% EFFR'   },
  { idx: 34, label: 'CUT-1',   phase: 'past',   color: 'rgba(104,211,145,0.8)',  sublabel: 'Q3\'24 · First Fed cut'      },
  { idx: 44, label: 'NORM',    phase: 'future',  color: 'rgba(99,179,237,0.85)', sublabel: 'Q1\'27 · Rate normalization'  },
  { idx: 49, label: 'SUPPLY↓', phase: 'future',  color: 'rgba(167,139,250,0.8)', sublabel: 'Q2\'28 · Supply peak clears'  },
];

function ConvergenceChart21({ selectedFwd, onSelectFwd, optimalFwd, series, liveEvents = [], selectedEventId, onMarkerClick }: ConvergenceChart21Props) {
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

  // Series come from props (D1). When every entry is null the chart
  // renders an empty trajectory grid — the correct "not wired" state.
  const supplyLive = series.supply.filter((v): v is number => v != null);
  const maxSupply = supplyLive.length > 0 ? Math.max(...supplyLive) : 0;
  const selAbsIdx = NOW_IDX + selectedFwd;
  const optAbsIdx = optimalFwd != null ? NOW_IDX + optimalFwd : null;

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
    [onSelectFwd] // eslint-disable-line react-hooks/exhaustive-deps -- intentionally omits iW, pad.l — closure reads them from enclosing scope; re-running on listed deps is the desired trigger
  );

  // Build SVG paths. D1: a null quarter breaks the polyline rather
  // than being silently filled with a constant. Each path is a list
  // of contiguous segments separated by an empty entry; we emit a
  // `M`/`L` joined path string with explicit moveTo's at null gaps.
  function buildSegmented(
    quarters: (number | null)[],
    yScale: (v: number) => number,
    rangeStart: number,
    rangeEndInclusive: number,
  ): string {
    const cmds: string[] = [];
    let prevWasLive = false;
    for (let i = rangeStart; i <= rangeEndInclusive; i++) {
      const v = quarters[i];
      if (v == null) {
        prevWasLive = false;
        continue;
      }
      const px = x(i);
      const py = yScale(v);
      cmds.push(`${prevWasLive ? 'L' : 'M'}${px},${py}`);
      prevWasLive = true;
    }
    return cmds.join(' ');
  }

  const rgHistD  = buildSegmented(series.rentGrowth, yRG,  0,        NOW_IDX);
  const rgProjD  = buildSegmented(series.rentGrowth, yRG,  NOW_IDX,  TOTAL_Q - 1);
  const capHistD = buildSegmented(series.capRate,    yCap, 0,        NOW_IDX);
  const capProjD = buildSegmented(series.capRate,    yCap, NOW_IDX,  TOTAL_Q - 1);
  const rssHistD = buildSegmented(series.rss,        yRSS, 0,        NOW_IDX);
  const rssProjD = buildSegmented(series.rss,        yRSS, NOW_IDX,  TOTAL_Q - 1);

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
    [] // eslint-disable-line react-hooks/exhaustive-deps -- intentionally omits iW, pad.l — closure reads them from enclosing scope; re-running on listed deps is the desired trigger
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

        {/* Supply bars — only quarters with a live (>0) value. */}
        {series.supply.map((v, i) => {
          if (v == null || v === 0 || maxSupply === 0) return null;
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

        {/* Rent growth — solid historical, dashed projected. Empty `d`
            strings render nothing (correct "no data" state). */}
        {rgHistD && <path d={rgHistD} fill="none" stroke="#68D391" strokeWidth={1.5} />}
        {rgProjD && <path d={rgProjD} fill="none" stroke="#68D391" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />}

        {/* Cap rate */}
        {capHistD && <path d={capHistD} fill="none" stroke="#63B3ED" strokeWidth={1.5} />}
        {capProjD && <path d={capProjD} fill="none" stroke="#63B3ED" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />}

        {/* RSS — bold, forward meaningful */}
        {rssHistD && <path d={rssHistD} fill="none" stroke="#10b981" strokeWidth={1} opacity={0.3} />}
        {rssProjD && <path d={rssProjD} fill="none" stroke="#10b981" strokeWidth={2.5} />}

        {/* NOW divider */}
        <line x1={nowX} y1={pad.t - 8} x2={nowX} y2={pad.t + iH + 8} stroke="#E8E6E1" strokeWidth={1.5} />
        <rect x={nowX - 16} y={pad.t - 18} width={32} height={14} rx={3} fill="#E8E6E1" />
        <text x={nowX} y={pad.t - 8} textAnchor="middle" fill="#0B0E13" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">
          NOW
        </text>

        {/* Optimal marker — only rendered when an optimal quarter exists. */}
        {optAbsIdx != null && (
          <>
            <line x1={x(optAbsIdx)} y1={pad.t} x2={x(optAbsIdx)} y2={pad.t + iH} stroke="#68D391" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
            <text x={x(optAbsIdx)} y={pad.t + iH + 28} textAnchor="middle" fill="#68D391" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">
              OPTIMAL
            </text>
          </>
        )}

        {/* User selected marker. RSS label only when the selected
            quarter has a live RSS value. */}
        <line x1={x(selAbsIdx)} y1={pad.t - 2} x2={x(selAbsIdx)} y2={pad.t + iH + 2} stroke="#E8E6E1" strokeWidth={2} />
        <rect x={x(selAbsIdx) - 22} y={pad.t - 20} width={44} height={14} rx={3} fill="#E8E6E1" />
        <text x={x(selAbsIdx)} y={pad.t - 10} textAnchor="middle" fill="#0B0E13" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">
          {Q_LABELS[selAbsIdx]?.label}
        </text>
        {series.rss[selAbsIdx] != null && (
          <text x={x(selAbsIdx)} y={yRSS(series.rss[selAbsIdx]!) - 10} textAnchor="middle" fill="#10b981" fontSize={11} fontWeight={800} fontFamily="JetBrains Mono">
            {series.rss[selAbsIdx]}
          </text>
        )}

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

        {/* FOMC Meeting Markers */}
        {FOMC_MEETINGS_2026.map((mtg) => {
          const mtgX = x(mtg.absQuarterIdx);
          const mtgY = yCap(mtg.currentTarget);
          const color =
            mtg.action === 'cut_25' ? '#68D391' :
            mtg.action === 'hike_25' ? '#FC8181' :
            '#999';

          return (
            <g key={`fomc-${mtg.date}`}>
              {/* Diamond marker */}
              <polygon points={`${mtgX},${mtgY - 6} ${mtgX + 6},${mtgY} ${mtgX},${mtgY + 6} ${mtgX - 6},${mtgY}`} fill={color} opacity={0.7} />
              {/* Tooltip on hover */}
              <circle cx={mtgX} cy={mtgY} r={8} fill="transparent" style={{ cursor: 'pointer' }} title={`${mtg.date}: ${mtg.action}`} />
            </g>
          );
        })}

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
          <polygon points="330,0 335,-3 340,0 335,3" fill="#68D391" />
          <text x={344} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>
            FOMC cut
          </text>
        </g>
      </svg>

      {/* Key event marker strip */}
      <div style={{ position: 'relative', height: 36, marginTop: -4 }}>
        {CHART_KEY_EVENTS.map(ev => {
          const leftPct = (50 + (ev.idx / (TOTAL_Q - 1)) * 820) / 920 * 100;
          return (
            <div key={`hc-${ev.idx}`} title={ev.sublabel} style={{ position: 'absolute', left: `${leftPct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}>
              <svg width="9" height="8" viewBox="0 0 9 8" style={{ display: 'block' }}>
                <polygon points="4.5,0.5 8.5,7.5 0.5,7.5" fill="none" stroke={ev.color} strokeWidth="1.2" />
              </svg>
              <span style={{ fontSize: 7, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: ev.color, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>{ev.label}</span>
            </div>
          );
        })}
        {liveEvents.map(ev => {
          const dateStr = ev.announcedDate ?? ev.materializationDate;
          if (!dateStr || Number.isNaN(new Date(dateStr).getTime())) return null;
          const qIdx = dateToQIdx(dateStr);
          if (qIdx < 0 || qIdx >= TOTAL_Q) return null;
          const color = m35CatColor(ev.category);
          const leftPct = (50 + (qIdx / (TOTAL_Q - 1)) * 820) / 920 * 100;
          const truncLabel = ev.name.length > 10 ? ev.name.slice(0, 9) + '…' : ev.name;
          const isMarkerSelected = selectedEventId === ev.id;
          return (
            <div
              key={`live-${ev.id}`}
              title={ev.name}
              onClick={() => onMarkerClick?.(ev.id)}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                transform: `translateX(-50%) scale(${isMarkerSelected ? 1.55 : 1})`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                cursor: onMarkerClick ? 'pointer' : 'default',
                transition: 'transform 0.18s ease',
                zIndex: isMarkerSelected ? 10 : 1,
              }}
            >
              <svg
                width="9" height="8" viewBox="0 0 9 8"
                style={{
                  display: 'block',
                  filter: isMarkerSelected
                    ? `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 2px ${color})`
                    : 'none',
                  transition: 'filter 0.18s ease',
                }}
              >
                <polygon points="4.5,0.5 8.5,7.5 0.5,7.5" fill={color} />
              </svg>
              <span style={{ fontSize: 7, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color, whiteSpace: 'nowrap', letterSpacing: 0.3, opacity: isMarkerSelected ? 1 : 0.85 }}>{truncLabel}</span>
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: `${(50 + (NOW_IDX / (TOTAL_Q - 1)) * 820) / 920 * 100}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid rgba(232,230,225,0.8)' }} />
          <span style={{ fontSize: 7, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: 'rgba(232,230,225,0.8)', whiteSpace: 'nowrap' }}>NOW</span>
        </div>
      </div>

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
            { l: 'Rent growth', v: series.rentGrowth[hoverIdx], c: '#68D391', s: '%' },
            { l: 'Cap rate',    v: series.capRate[hoverIdx],    c: '#63B3ED', s: '%' },
            { l: 'Treasury 10Y',v: series.treasury10y[hoverIdx],c: '#B794F4', s: '%' },
            { l: 'Supply',      v: series.supply[hoverIdx],     c: '#F6AD55', s: ' units' },
            { l: 'RSS',         v: series.rss[hoverIdx],        c: '#10b981', s: '' },
          ].map((r) => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ fontSize: 9, color: r.c }}>{r.l}</span>
              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", fontWeight: 600, color: r.c }}>
                {r.v == null ? '—' : (typeof r.v === 'number' && Number.isInteger(r.v) ? `${r.v}${r.s}` : `${r.v.toFixed(1)}${r.s}`)}
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
  rssData: RSSBreakdown | null;
}

function RSSBreakdownCards({ rssData }: RSSBreakdownCardsProps) {
  // D1: each sub-score is shown only when a live RSS breakdown exists.
  // Until the per-component pipeline lands, the composite RSS is the
  // only field populated — the five sub-cells correctly render "—".
  const cards = [
    { l: 'Market Window', v: rssData?.mw ?? null, w: '35%', c: '#68D391' },
    { l: 'Rate Environment', v: rssData?.re ?? null, w: '25%', c: '#63B3ED' },
    { l: 'Supply Position', v: rssData?.sp ?? null, w: '20%', c: '#F6AD55' },
    { l: 'Operational Ready', v: rssData?.or ?? null, w: '15%', c: '#B794F4' },
    { l: 'Buyer Pressure', v: rssData?.bp ?? null, w: '5%', c: '#4FD1C5' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
      {cards.map((s) => {
        const isLive = s.v != null;
        return (
          <div key={s.l} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{s.l}</span>
              <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>{s.w}</span>
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono'",
              color: !isLive ? 'rgba(232,230,225,0.35)'
                : s.v! >= 70 ? '#68D391' : s.v! >= 50 ? '#F6E05E' : '#FC8181',
            }}>{isLive ? s.v : '—'}</div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: isLive ? `${s.v}%` : '0%', background: s.c, borderRadius: 2, opacity: 0.5 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// M35 KEY EVENT TYPES + HELPERS
// ═══════════════════════════════════════════════════════════════════════════

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  sourceName?: string;
  publishedAt?: string;
  relevanceScore?: number;
  isInferred?: boolean;
}

interface M35Event {
  id: string;
  name: string;
  category: string;
  subtype?: string;
  status: string;
  description?: string;
  announcedDate?: string;
  materializationDate?: string;
  updatedAt?: string;
  magnitudeScore: number;
  confidence: number;
  isVerified: boolean;
  msaName?: string;
  submarketName?: string;
  ingestionSource?: string;
  newsItems?: NewsItem[];
  sourceUrl?: string;
}

function normalizeCat(raw: string): string {
  const s = raw.toLowerCase();
  if (s.startsWith('macro'))      return 'macro';
  if (s.startsWith('technology')) return 'technology';
  if (s.startsWith('regulatory')) return 'regulatory';
  if (s.startsWith('disaster'))   return 'disaster';
  if (s === 'market_structure')   return 'market_structure';
  return s;
}

const M35_CAT_COLORS: Record<string, string> = {
  employment:      '#68D391',
  infrastructure:  '#63B3ED',
  regulatory:      '#F6AD55',
  market_structure:'#B794F4',
  macro:           '#4FD1C5',
  disaster:        '#FC8181',
  technology:      '#F6E05E',
};

function m35CatColor(cat: string): string {
  return M35_CAT_COLORS[normalizeCat(cat)] ?? 'rgba(232,230,225,0.5)';
}

function dateToQIdx(iso: string): number {
  const d = new Date(iso);
  return (d.getFullYear() - 2016) * 4 + Math.floor(d.getMonth() / 3);
}

function eventPhase(ev: M35Event): 'past' | 'now' | 'future' {
  const refDate = new Date('2026-04-15');
  const date = ev.announcedDate ?? ev.materializationDate;
  if (!date) return ev.status === 'materialized' ? 'past' : 'future';
  const d = new Date(date);
  const diffMonths = (d.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (diffMonths < -1) return 'past';
  if (diffMonths <= 1) return 'now';
  return 'future';
}

function exitImpact(category: string, status: string): { label: string; color: string } {
  const cat = normalizeCat(category);
  if (cat === 'disaster') return { label: 'NEGATIVE', color: '#FC8181' };
  if (cat === 'regulatory') return { label: 'WATCH', color: '#F6AD55' };
  if (status === 'reversed' || status === 'cancelled') return { label: 'NEUTRAL', color: 'rgba(232,230,225,0.4)' };
  if (cat === 'employment' || cat === 'infrastructure' || cat === 'macro') return { label: 'POSITIVE', color: '#68D391' };
  return { label: 'NEUTRAL', color: 'rgba(232,230,225,0.4)' };
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
  const [selectedFwd, setSelectedFwd] = useState<number>(0);
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);
  const [liveRatesLoading, setLiveRatesLoading] = useState(false);
  const [m35Events, setM35Events] = useState<M35Event[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const keyEventRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chartStripRef = useRef<HTMLDivElement>(null);

  // D1 (CE-04, P0): live trajectory series for the convergence chart.
  // The pre-D1 implementation hardcoded four 84-quarter arrays
  // (RENT_GROWTH_21Y / CAP_RATES_21Y / SUPPLY_21Y / T10_21Y) and a
  // synthetic computeRSS21. Those were the worst kind of fiction —
  // detailed-looking projection driven by compiled-in constants.
  //
  // Today no upstream service ships a per-quarter 21-year series for
  // these signals. Downstream dispatches are responsible for wiring:
  //   - rentGrowth / capRate: from proforma_assumptions + the LIUS
  //     exit cap trajectory once D2/D3 land
  //   - supply:               W-10 WIRED — M35 multifamily_delivery events
  //                            via /exit-trajectory endpoint (D4 partial)
  //   - treasury10y:          from /api/v1/rates/history (already live)
  //   - rss:                  composite of the above + Debt module's
  //                            rate environment classification (D5)
  //
  // Until then every quarter is `null` and the chart renders an empty
  // trajectory grid with a "no live data" banner — the correct state
  // per the D1 NULL-where-no-source contract.
  const dealModule = useDealModule();
  const live10yHistory: (number | null)[] | null = null; // TODO: wire to /api/v1/rates/history
  const liveCapTrajectory: (number | null)[] | null = null; // TODO: wire to proforma_assumptions.exit_cap_current + LIUS

  // W-10 (CE-12): Fetch M35 supply pressure + M07 buyer pressure from
  // /exit-trajectory.  supplyPressureByYear is used for chartSeries.supply
  // and rssData.sp; buyerPressureByYear feeds rssData.bp.
  const [trajectoryData, setTrajectoryData] = useState<{
    supplyPressureByYear: (number | null)[];
    buyerPressureByYear: (number | null)[];
  } | null>(null);

  useEffect(() => {
    if (!dealId) return;
    apiClient
      .get(`/api/v1/deals/${dealId}/exit-trajectory`)
      .then(res => {
        if (res.data?.success) {
          setTrajectoryData({
            supplyPressureByYear: res.data.supplyPressureByYear,
            buyerPressureByYear: res.data.buyerPressureByYear,
          });
        }
      })
      .catch(() => null);
  // mount-once per dealId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Expand annual supply pressure (Y1-Y10) to quarterly for convergence chart.
  // Each annual value spans 4 quarters starting at NOW_IDX.
  // Supply pressure → supply position: supplyPos = max(30, 85 - pressure).
  const supplyQuarterly = useMemo((): (number | null)[] => {
    const arr: (number | null)[] = Array.from({ length: TOTAL_Q }, () => null);
    if (!trajectoryData) return arr;
    for (let y = 1; y <= 10; y++) {
      const pressure = trajectoryData.supplyPressureByYear[y];
      if (pressure == null) continue;
      const supplyScore = Math.max(30, 85 - pressure);
      for (let q = 0; q < 4; q++) {
        const qIdx = NOW_IDX + (y - 1) * 4 + q;
        if (qIdx < TOTAL_Q) arr[qIdx] = supplyScore;
      }
    }
    return arr;
  }, [trajectoryData]);

  const chartSeries: ConvergenceChart21Series = useMemo(() => {
    const empty = (): (number | null)[] => Array.from({ length: TOTAL_Q }, () => null);
    return {
      rentGrowth:  empty(),
      capRate:     liveCapTrajectory ?? empty(),
      supply:      supplyQuarterly,          // W-10: live from /exit-trajectory (M35)
      treasury10y: live10yHistory ?? empty(),
      rss:         empty(),
    };
  // Recompute when any wired live source updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealModule.financial?.lastUpdated, dealModule.market?.lastUpdated, supplyQuarterly]);

  const hasAnyLiveProjection = useMemo(() => {
    return (
      chartSeries.rentGrowth.some(v => v != null) ||
      chartSeries.capRate.some(v => v != null) ||
      chartSeries.supply.some(v => v != null) ||
      chartSeries.rss.some(v => v != null)
    );
  }, [chartSeries]);

  function handleMarkerClick(id: string) {
    const next = selectedEventId === id ? null : id;
    setSelectedEventId(next);
    if (next) {
      requestAnimationFrame(() => {
        keyEventRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  function handleCardClick(id: string) {
    const next = selectedEventId === id ? null : id;
    setSelectedEventId(next);
    if (next) {
      requestAnimationFrame(() => {
        chartStripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  useEffect(() => {
    const POLL_MS = 5 * 60 * 1000;
    let ignored = false;

    setM35Events([]);

    function fetchEvents() {
      if (document.visibilityState === 'hidden') return;
      apiClient.get<{ events: M35Event[] }>(`/m35/deals/${dealId}/events-context`)
        .then(r => { if (!ignored && Array.isArray(r.data?.events)) setM35Events(r.data.events); })
        .catch(() => null);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') fetchEvents();
    }

    fetchEvents();
    const timer = setInterval(fetchEvents, POLL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      ignored = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dealId]);

  function toggleEventExpand(id: string) {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Compute optimal exit quarter — highest live RSS in the forward
  // window. Returns null when no quarter has a live RSS, in which
  // case the "OPTIMAL" marker and "PLATFORM OPTIMAL" header are
  // hidden rather than defaulted to Q1 2026.
  const optimalFwd = useMemo((): number | null => {
    let bestIdx: number | null = null;
    let bestRss = -Infinity;
    const fwdCount = TOTAL_Q - NOW_IDX;
    for (let i = 0; i < fwdCount; i++) {
      const rss = chartSeries.rss[NOW_IDX + i];
      if (rss != null && rss > bestRss) {
        bestRss = rss;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [chartSeries.rss]);

  // Set default selection on mount. When no optimal is available
  // selectedFwd stays at 0 (Q1 2026) — the chart still renders the
  // current-quarter marker as a reference point.
  useEffect(() => {
    if (optimalFwd != null) setSelectedFwd(optimalFwd);
  }, [optimalFwd]);

  const POSITIVE_CATS = new Set(['employment', 'infrastructure', 'macro', 'market_structure', 'technology']);

  interface CaseForBullet { text: string; color: string; isLive: boolean }
  interface KeyTriggerItem {
    n: string; label: string; desc: string; color: string;
    done: boolean; isLive: boolean;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW'; icon: string;
  }

  const FALLBACK_CASE_FOR = 'By this quarter, the Fed normalization cycle will have compressed 10Y Treasuries enough to unlock agency cap rate compression, while the current supply pipeline will have largely been absorbed by sustained household formation. Institutional buyer demand is expected to produce premium pricing on well-positioned assets.';

  function triggerUrgency(cat: string, status: string, magnitude: number): { urgency: 'HIGH' | 'MEDIUM' | 'LOW'; icon: string } {
    const impact = exitImpact(cat, status);
    if (impact.label === 'NEGATIVE') return { urgency: 'HIGH', icon: '▼' };
    if (impact.label === 'WATCH')    return { urgency: 'MEDIUM', icon: '◆' };
    if (impact.label === 'POSITIVE' && magnitude >= 4) return { urgency: 'HIGH', icon: '▲' };
    if (impact.label === 'POSITIVE') return { urgency: 'MEDIUM', icon: '▲' };
    return { urgency: 'LOW', icon: '●' };
  }

  const FALLBACK_TRIGGERS: KeyTriggerItem[] = [
    { n: '01', label: 'Rate normalization', desc: 'SOFR falls to 3.5–4.0% range, compressing cap rates 25–50bps', color: '#63B3ED', done: false, isLive: false, urgency: 'HIGH', icon: '▲' },
    { n: '02', label: 'Supply pipeline clears', desc: 'New starts YoY decline sustains, absorption outpaces deliveries', color: '#B794F4', done: false, isLive: false, urgency: 'MEDIUM', icon: '◆' },
    { n: '03', label: 'Asset stabilization', desc: 'Occupancy ≥ 93% at market rents for 2+ consecutive quarters', color: '#F6AD55', done: false, isLive: false, urgency: 'MEDIUM', icon: '◆' },
    { n: '04', label: 'RSS peaks above 80', desc: 'All sub-scores converge — institutional buyer window opens', color: '#10b981', done: false, isLive: false, urgency: 'HIGH', icon: '▲' },
  ];

  const caseForBullets = useMemo((): CaseForBullet[] | null => {
    const positive = m35Events
      .filter(ev => POSITIVE_CATS.has(normalizeCat(ev.category)) && ev.status !== 'cancelled' && ev.status !== 'reversed')
      .sort((a, b) => b.magnitudeScore - a.magnitudeScore)
      .slice(0, 4);
    if (positive.length === 0) return null;
    return positive.map(ev => {
      const cat = normalizeCat(ev.category);
      const suffix =
        cat === 'employment'         ? 'supporting household formation and rental demand'
        : cat === 'infrastructure'   ? 'improving submarket access and long-term desirability'
        : cat === 'macro'            ? 'creating macro tailwinds for real asset appreciation'
        : cat === 'market_structure' ? 'driving favorable cap rate compression dynamics'
        : cat === 'technology'       ? 'accelerating operational efficiency and asset positioning'
        : 'contributing to strengthened demand fundamentals';
      const shortName = ev.name.length > 60 ? ev.name.slice(0, 57) + '…' : ev.name;
      return {
        text: `${shortName} — ${suffix}`,
        color: m35CatColor(cat),
        isLive: true,
      };
    });
  // hook intentionally captures POSITIVE_CATS via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted value is read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m35Events]);

  const keyTriggers = useMemo((): KeyTriggerItem[] => {
    const live = m35Events
      .filter(ev => (ev.status === 'announced' || ev.status === 'in_progress') && (ev.magnitudeScore >= 3 || ev.confidence >= 0.65))
      .sort((a, b) => b.magnitudeScore - a.magnitudeScore)
      .slice(0, 4);
    if (live.length === 0) return FALLBACK_TRIGGERS;
    const mapped: KeyTriggerItem[] = live.map((ev, i) => {
      const shortName = ev.name.length > 40 ? ev.name.slice(0, 37) + '…' : ev.name;
      const desc = ev.description
        ? (ev.description.length > 80 ? ev.description.slice(0, 77) + '…' : ev.description)
        : `${ev.category.replace('_', ' ')} event — confidence ${Math.round(ev.confidence * 100)}%`;
      const { urgency, icon } = triggerUrgency(ev.category, ev.status, ev.magnitudeScore);
      return {
        n: String(i + 1).padStart(2, '0'),
        label: shortName,
        desc,
        color: m35CatColor(ev.category),
        done: ev.status === 'in_progress',
        isLive: true,
        urgency,
        icon,
      };
    });
    if (mapped.length < 4) {
      const needed = 4 - mapped.length;
      const pads = FALLBACK_TRIGGERS.slice(mapped.length, mapped.length + needed).map((t, i) => ({
        ...t,
        n: String(mapped.length + i + 1).padStart(2, '0'),
      }));
      return [...mapped, ...pads];
    }
    return mapped;
  // hook intentionally captures FALLBACK_TRIGGERS via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted value is read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m35Events]);

  function formatDataAsOf(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  }

  const caseForDataAsOf = useMemo((): string | null => {
    const displayed = m35Events
      .filter(ev => POSITIVE_CATS.has(normalizeCat(ev.category)) && ev.status !== 'cancelled' && ev.status !== 'reversed')
      .sort((a, b) => b.magnitudeScore - a.magnitudeScore)
      .slice(0, 4)
      .filter(ev => ev.updatedAt);
    if (displayed.length === 0) return null;
    const latest = displayed.reduce((best, ev) => ev.updatedAt! > (best.updatedAt ?? '') ? ev : best, displayed[0]);
    return latest.updatedAt ? formatDataAsOf(latest.updatedAt) : null;
  // hook intentionally captures POSITIVE_CATS via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted value is read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m35Events]);

  const keyTriggersDataAsOf = useMemo((): string | null => {
    const displayed = m35Events
      .filter(ev => (ev.status === 'announced' || ev.status === 'in_progress') && (ev.magnitudeScore >= 3 || ev.confidence >= 0.65))
      .sort((a, b) => b.magnitudeScore - a.magnitudeScore)
      .slice(0, 4)
      .filter(ev => ev.updatedAt);
    if (displayed.length === 0) return null;
    const latest = displayed.reduce((best, ev) => ev.updatedAt! > (best.updatedAt ?? '') ? ev : best, displayed[0]);
    return latest.updatedAt ? formatDataAsOf(latest.updatedAt) : null;
  }, [m35Events]);

  // Fetch live rates when Debt Market tab is opened (cached 15min on backend)
  useEffect(() => {
    if (activeTab !== 'market' || liveRates !== null) return;
    setLiveRatesLoading(true);
    apiClient.get('/capital-structure/rates/live')
      .then((data: any) => setLiveRates(data?.data ?? data))
      .catch(() => {})
      .finally(() => setLiveRatesLoading(false));
  }, [activeTab, liveRates]);

  // Compute returns for selected and optimal quarters. D1: returns
  // are null when no live rentGrowth + exitCap series exist for the
  // target quarter (`computeExitReturns` requires both). The header
  // chips render "—" in that state.
  const ret = useMemo(() => {
    const rg = chartSeries.rentGrowth[NOW_IDX + selectedFwd];
    const cap = chartSeries.capRate[NOW_IDX + selectedFwd];
    return computeExitReturns(selectedFwd, dealType, rg, cap);
  }, [chartSeries, selectedFwd, dealType]);
  const optRet = useMemo(() => {
    if (optimalFwd == null) return null;
    const rg = chartSeries.rentGrowth[NOW_IDX + optimalFwd];
    const cap = chartSeries.capRate[NOW_IDX + optimalFwd];
    return computeExitReturns(optimalFwd, dealType, rg, cap);
  }, [chartSeries, optimalFwd, dealType]);

  const stack = STACK_PRESETS[DEFAULT_EXIT_STRATEGY[dealType]] ?? STACK_PRESETS['sell-stabilized'];
  const totalBasis = dealType === 'development' ? 52000000 : 46420000;
  const loanAmt = totalBasis * (stack.sr.pct / 100);
  const annualDS = Math.round(loanAmt * (stack.sr.rate / 100));

  // RSS data for selected exit quarter.
  // D1: composite rss is null until D5 wires the full aggregation.
  // W-10: sp (Supply Position) and bp (Buyer Pressure) are live once
  // /exit-trajectory responds — rssData is non-null when either is available.
  const selRss = chartSeries.rss[NOW_IDX + selectedFwd];
  const selectedYear = Math.max(1, Math.min(10, Math.floor(selectedFwd / 4) + 1));
  const liveSp: number | null = (() => {
    const p = trajectoryData?.supplyPressureByYear?.[selectedYear];
    return p != null ? Math.max(30, 85 - p) : null;
  })();
  const liveBp: number | null = trajectoryData?.buyerPressureByYear?.[selectedYear] ?? null;

  const rssData: RSSBreakdown | null = (selRss == null && liveSp == null && liveBp == null)
    ? null
    : {
      rss:  selRss ?? null,      // null until D5; sub-scores may be live sooner
      mw:   null,                // pending D2/D4 wiring
      re:   null,                // pending D5 rate-environment wiring
      sp:   liveSp,              // W-10: live from M35 multifamily_delivery
      or:   null,                // pending operational readiness wiring
      bp:   liveBp,              // W-10: live from M07 position_score
    };

  // RSS verdict — only meaningful when composite rss is live
  const rssColor = (rssData == null || rssData.rss == null) ? '#9CA3AF'
    : rssData.rss >= 85 ? '#68D391' : rssData.rss >= 70 ? '#63B3ED' : rssData.rss >= 55 ? '#F6E05E' : '#FC8181';
  const rssVerdict = (rssData == null || rssData.rss == null) ? '—'
    : rssData.rss >= 85 ? 'Strong sell window' : rssData.rss >= 70 ? 'Favorable' : rssData.rss >= 55 ? 'Neutral' : 'Weak — hold';

  return (
    <div style={{ height: '100%', background: '#0B0E13', color: '#E8E6E1', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
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
            { label: 'IRR', value: ret == null ? '—' : `${ret.irr.toFixed(1)}%`, color: ret == null ? '#9CA3AF' : ret.irr >= 15 ? '#68D391' : '#F6E05E' },
            { label: 'EM',  value: ret == null ? '—' : `${ret.em.toFixed(2)}x`, color: ret == null ? '#9CA3AF' : '#63B3ED' },
            { label: `RSS`, value: (rssData == null || rssData.rss == null) ? '—' : `${rssData.rss} — ${rssVerdict}`, color: rssColor },
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
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: '#68D391' }}>
                    {optimalFwd != null ? Q_LABELS[NOW_IDX + optimalFwd]?.label : '—'}
                  </div>
                  {optimalFwd != null && selectedFwd !== optimalFwd && (
                    <div style={{ fontSize: 9, color: '#F6E05E', fontFamily: "'JetBrains Mono'" }}>
                      Yours: {Q_LABELS[NOW_IDX + selectedFwd]?.label} (RSS {(rssData == null || rssData.rss == null) ? '—' : rssData.rss} vs {chartSeries.rss[NOW_IDX + optimalFwd] ?? '—'})
                    </div>
                  )}
                </div>
              </div>
              {/* Chart legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 4, paddingLeft: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="9" height="8" viewBox="0 0 9 8" style={{ flexShrink: 0 }}>
                    <polygon points="4.5,0.5 8.5,7.5 0.5,7.5" fill="none" stroke="rgba(232,230,225,0.35)" strokeWidth="1.2" />
                  </svg>
                  <span style={{ fontSize: 8, color: 'rgba(232,230,225,0.35)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.4 }}>PLATFORM CYCLE EVENT</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="9" height="8" viewBox="0 0 9 8" style={{ flexShrink: 0 }}>
                    <polygon points="4.5,0.5 8.5,7.5 0.5,7.5" fill="#00e5a0" />
                  </svg>
                  <span style={{ fontSize: 8, color: 'rgba(232,230,225,0.35)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.4 }}>LIVE M35 EVENT — CLICK TO CROSS-REF</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid rgba(232,230,225,0.35)', flexShrink: 0 }} />
                  <span style={{ fontSize: 8, color: 'rgba(232,230,225,0.35)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.4 }}>NOW</span>
                </div>
              </div>
              {/* M35 category color key — only categories present on the chart */}
              {(() => {
                const CAT_LABELS: Record<string, string> = {
                  employment: 'Employment', infrastructure: 'Infrastructure',
                  regulatory: 'Regulatory', market_structure: 'Market Structure',
                  macro: 'Macro', disaster: 'Disaster', technology: 'Technology',
                };
                const seen = new Map<string, string>();
                for (const ev of m35Events.slice(0, 6)) {
                  const norm = normalizeCat(ev.category);
                  if (!seen.has(norm)) seen.set(norm, m35CatColor(ev.category));
                }
                if (seen.size === 0) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, paddingLeft: 2, flexWrap: 'wrap' }}>
                    {[...seen.entries()].map(([norm, color]) => (
                      <div key={norm} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 7.5, color: 'rgba(232,230,225,0.35)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.4 }}>
                          {CAT_LABELS[norm] ?? norm.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div ref={chartStripRef}>
                <ConvergenceChart21
                  selectedFwd={selectedFwd}
                  onSelectFwd={setSelectedFwd}
                  optimalFwd={optimalFwd}
                  series={chartSeries}
                  liveEvents={m35Events.slice(0, 6)}
                  selectedEventId={selectedEventId}
                  onMarkerClick={handleMarkerClick}
                />
                {!hasAnyLiveProjection && (
                  <div style={{
                    marginTop: 8, padding: '10px 14px',
                    background: 'rgba(246,224,94,0.06)',
                    border: '1px solid rgba(246,224,94,0.18)',
                    borderRadius: 6,
                    fontSize: 10, color: 'rgba(246,224,94,0.85)',
                    fontFamily: "'JetBrains Mono'", letterSpacing: 0.3,
                  }}>
                    PROJECTION TRAJECTORIES NOT YET WIRED — rent growth, cap rate,
                    supply pressure, and RSS series will populate once the D2/D4
                    dispatches connect proforma_assumptions, LIUS exit cap, and the
                    M35 event feed. Until then, this chart renders only the time axis.
                  </div>
                )}
              </div>
            </div>

            {/* RSS breakdown cards */}
            <RSSBreakdownCards rssData={rssData} />

            {/* Exit Intelligence Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {/* Why this window */}
              <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 7, padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: '#10b981', fontFamily: "'JetBrains Mono'" }}>
                      THE CASE FOR {Q_LABELS[NOW_IDX + optimalFwd]?.label ?? '—'}
                    </div>
                    {caseForBullets !== null && (
                      <span style={{ fontSize: 7, padding: '1px 5px', background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', borderRadius: 2, color: '#68D391', fontFamily: "'JetBrains Mono'", fontWeight: 700 }}>
                        LIVE
                      </span>
                    )}
                  </div>
                  {caseForBullets !== null && caseForDataAsOf && (
                    <div style={{ fontSize: 7, color: 'rgba(232,230,225,0.28)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.5 }}>
                      DATA AS OF {caseForDataAsOf}
                    </div>
                  )}
                </div>
                {caseForBullets !== null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {caseForBullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: b.color, flexShrink: 0, marginTop: 5 }} />
                        <div style={{ fontSize: 9.5, color: 'rgba(232,230,225,0.7)', lineHeight: 1.55 }}>{b.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'rgba(232,230,225,0.65)', lineHeight: 1.7 }}>
                    The 21-year convergence model identifies <span style={{ color: '#68D391', fontWeight: 600 }}>{Q_LABELS[NOW_IDX + optimalFwd]?.label}</span> as the peak RSS window. {FALLBACK_CASE_FOR}
                  </div>
                )}
              </div>

              {/* Key triggers */}
              <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>
                      KEY TRIGGERS TO EXIT WINDOW
                    </div>
                    {keyTriggers.some(t => t.isLive) && (
                      <span style={{ fontSize: 7, padding: '1px 5px', background: 'rgba(99,179,237,0.1)', border: '1px solid rgba(99,179,237,0.3)', borderRadius: 2, color: '#63B3ED', fontFamily: "'JetBrains Mono'", fontWeight: 700 }}>
                        M35
                      </span>
                    )}
                  </div>
                  {keyTriggers.some(t => t.isLive) && keyTriggersDataAsOf && (
                    <div style={{ fontSize: 7, color: 'rgba(232,230,225,0.28)', fontFamily: "'JetBrains Mono'", letterSpacing: 0.5 }}>
                      DATA AS OF {keyTriggersDataAsOf}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {keyTriggers.map(t => {
                    const urgencyColor = t.urgency === 'HIGH' ? '#FC8181' : t.urgency === 'MEDIUM' ? '#F6AD55' : 'rgba(232,230,225,0.3)';
                    return (
                      <div key={t.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 2, minWidth: 18 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: t.color }}>{t.icon}</span>
                          <span style={{ fontSize: 6, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: urgencyColor, letterSpacing: 0.3 }}>{t.urgency}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.done ? 'rgba(232,230,225,0.45)' : '#E8E6E1', textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</div>
                            {t.done && <span style={{ fontSize: 7, color: '#68D391', fontFamily: "'JetBrains Mono'", fontWeight: 700 }}>IN PROGRESS</span>}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.4)', lineHeight: 1.5 }}>{t.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Market Momentum Strip */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 8 }}>
                MARKET MOMENTUM INDICATORS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Net Absorption', value: 'IMPROVING', trend: '↑', detail: '+2.3% QoQ vs market avg', c: '#68D391' },
                  { label: 'Concession Level', value: 'DECLINING', trend: '↓', detail: '0.4 mo free → 0.2 mo', c: '#68D391' },
                  { label: 'Buyer Pool Depth', value: 'DEEP', trend: '→', detail: '14 active inst. buyers tracked', c: '#63B3ED' },
                  { label: 'Competing Supply', value: 'EASING', trend: '↓', detail: 'Pipeline -18% vs 2024 peak', c: '#68D391' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 5 }}>{m.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: m.c }}>{m.value}</span>
                      <span style={{ fontSize: 11, color: m.c, fontWeight: 700 }}>{m.trend}</span>
                    </div>
                    <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.3)', marginTop: 3, fontFamily: "'JetBrains Mono'" }}>{m.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* KEY EVENTS — sourced from M35 Event Impact Engine (news-ingested) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'" }}>
                  KEY EVENTS — NEWS-SOURCED IMPACT SIGNALS
                </div>
                {m35Events.length > 0 && (
                  <span style={{ fontSize: 7, padding: '1px 6px', background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', borderRadius: 3, color: '#68D391', fontFamily: "'JetBrains Mono'", fontWeight: 700 }}>
                    {m35Events.length} ACTIVE
                  </span>
                )}
              </div>

              {m35Events.length === 0 ? (
                <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 10, color: 'rgba(232,230,225,0.3)', fontFamily: "'JetBrains Mono'" }}>
                  No M35 events indexed for this market yet. Events auto-ingest from news and government filings.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m35Events.slice(0, 6).map(ev => {
                    const phase = eventPhase(ev);
                    const impact = exitImpact(ev.category, ev.status);
                    const catColor = m35CatColor(ev.category);
                    const dateStr = ev.announcedDate ?? ev.materializationDate;
                    const displayDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
                    const linkedNews: NewsItem[] = ev.newsItems ?? [];
                    const allInferred = linkedNews.length > 0 && linkedNews.every(n => n.isInferred);
                    const hasExpandable = linkedNews.length > 0 || Boolean(ev.sourceUrl);
                    const isExpanded = expandedEvents.has(ev.id);
                    const isSelected = selectedEventId === ev.id;
                    return (
                      <div
                        key={ev.id}
                        ref={el => { keyEventRefs.current[ev.id] = el; }}
                        style={{
                          background: isSelected ? `${catColor}10` : 'rgba(255,255,255,0.018)',
                          border: `1px solid ${isSelected ? catColor + '55' : catColor + '20'}`,
                          borderLeft: `3px solid ${catColor}`,
                          boxShadow: isSelected ? `0 0 0 1px ${catColor}25, 0 2px 14px ${catColor}15` : 'none',
                          borderRadius: 5,
                          overflow: 'hidden',
                          transition: 'box-shadow 0.2s, border-color 0.2s, background 0.2s',
                        }}
                      >
                        <div
                          onClick={() => handleCardClick(ev.id)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', background: `${catColor}15`, border: `1px solid ${catColor}40`, borderRadius: 2, color: catColor, fontFamily: "'JetBrains Mono'", textTransform: 'uppercase' }}>
                                {ev.category.replace('_', ' ')}
                              </span>
                              <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', background: `${impact.color}10`, border: `1px solid ${impact.color}30`, borderRadius: 2, color: impact.color, fontFamily: "'JetBrains Mono'" }}>
                                {impact.label}
                              </span>
                              {ev.ingestionSource === 'news' && (
                                <span style={{ fontSize: 7, padding: '1px 5px', background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 2, color: '#63B3ED', fontFamily: "'JetBrains Mono'" }}>
                                  NEWS
                                </span>
                              )}
                              {ev.isVerified && (
                                <span style={{ fontSize: 7, padding: '1px 5px', background: 'rgba(104,211,145,0.08)', border: '1px solid rgba(104,211,145,0.25)', borderRadius: 2, color: '#68D391', fontFamily: "'JetBrains Mono'" }}>
                                  ✓ VERIFIED
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#E8E6E1', marginBottom: ev.description ? 3 : 0, lineHeight: 1.4 }}>{ev.name}</div>
                            {ev.description && (
                              <div style={{ fontSize: 9, color: 'rgba(232,230,225,0.45)', lineHeight: 1.5 }}>{ev.description}</div>
                            )}
                            {hasExpandable && (
                              <button
                                onClick={e => { e.stopPropagation(); toggleEventExpand(ev.id); }}
                                style={{ marginTop: 6, fontSize: 8, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: allInferred ? '#F6AD55' : '#63B3ED', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
                              >
                                {linkedNews.length > 0
                                  ? `${linkedNews.length} SOURCE${linkedNews.length > 1 ? 'S' : ''}`
                                  : 'VIEW SOURCE'}
                                <span style={{ fontSize: 8, transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                              </button>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 8, fontWeight: 700, color: phase === 'past' ? 'rgba(232,230,225,0.3)' : phase === 'now' ? '#63B3ED' : '#F6AD55', fontFamily: "'JetBrains Mono'", marginBottom: 4 }}>
                              {phase.toUpperCase()}
                            </div>
                            {displayDate && (
                              <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.3)', fontFamily: "'JetBrains Mono'" }}>{displayDate}</div>
                            )}
                            <div style={{ marginTop: 6 }}>
                              <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.22)', fontFamily: "'JetBrains Mono'", marginBottom: 1 }}>CONFIDENCE</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: ev.confidence >= 0.7 ? '#68D391' : ev.confidence >= 0.5 ? '#F6E05E' : '#FC8181', fontFamily: "'JetBrains Mono'" }}>
                                {Math.round(ev.confidence * 100)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${catColor}18`, padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {linkedNews.length > 0 ? (
                              linkedNews.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 10px', background: 'rgba(255,255,255,0.022)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {item.sourceUrl ? (
                                      <a
                                        href={item.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ fontSize: 10, fontWeight: 600, color: '#E8E6E1', lineHeight: 1.4, textDecoration: 'none', display: 'block' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#63B3ED')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#E8E6E1')}
                                      >
                                        {item.title}
                                      </a>
                                    ) : (
                                      <div style={{ fontSize: 10, fontWeight: 600, color: '#E8E6E1', lineHeight: 1.4 }}>{item.title}</div>
                                    )}
                                    {item.summary && (
                                      <div style={{ fontSize: 8, color: 'rgba(232,230,225,0.4)', lineHeight: 1.5, marginTop: 2 }}>{item.summary}</div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                      {item.isInferred && (
                                        <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', background: 'rgba(246,173,85,0.1)', border: '1px solid rgba(246,173,85,0.3)', borderRadius: 2, color: '#F6AD55', fontFamily: "'JetBrains Mono'" }}>
                                          AUTO-MATCHED
                                        </span>
                                      )}
                                      {item.sourceName && (
                                        <span style={{ fontSize: 7, color: 'rgba(232,230,225,0.3)', fontFamily: "'JetBrains Mono'" }}>{item.sourceName}</span>
                                      )}
                                      {item.publishedAt && (
                                        <span style={{ fontSize: 7, color: 'rgba(232,230,225,0.25)', fontFamily: "'JetBrains Mono'" }}>
                                          {new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                      )}
                                      {item.relevanceScore !== undefined && item.relevanceScore !== null && (
                                        <span style={{ fontSize: 7, color: 'rgba(232,230,225,0.25)', fontFamily: "'JetBrains Mono'" }}>
                                          REL {Math.round(item.relevanceScore * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {item.sourceUrl && (
                                    <a
                                      href={item.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: 8, color: '#63B3ED', flexShrink: 0, textDecoration: 'none', fontFamily: "'JetBrains Mono'", fontWeight: 700 }}
                                    >
                                      ↗
                                    </a>
                                  )}
                                </div>
                              ))
                            ) : ev.sourceUrl ? (
                              <a
                                href={ev.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 9, color: '#63B3ED', fontFamily: "'JetBrains Mono'", fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <span>VIEW SOURCE ↗</span>
                              </a>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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

          const stratMap = STRATEGY_SPREAD_MAP[DEFAULT_EXIT_STRATEGY[dealType]] ?? STRATEGY_SPREAD_MAP['sell-stabilized'];
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
                  const rg = chartSeries.rentGrowth[NOW_IDX + i];
                  const cap = chartSeries.capRate[NOW_IDX + i];
                  const r = computeExitReturns(i, dealType, rg, cap);
                  const isSelected = i === selectedFwd;
                  const isOptimal = optimalFwd != null && i === optimalFwd;
                  // null IRR → flat empty bar in neutral grey (no live data).
                  const irr = r?.irr ?? null;
                  const h = irr == null ? 4 : Math.max(4, (irr / 30) * 130);
                  const col = irr == null ? 'rgba(232,230,225,0.18)'
                    : isSelected ? '#E8E6E1'
                    : isOptimal ? '#68D391'
                    : irr >= 15 ? '#68D391' : irr >= 10 ? '#63B3ED' : '#FC8181';
                  return (
                    <div key={i} onClick={() => setSelectedFwd(i)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                      {(isSelected || isOptimal || i % 2 === 0) && (
                        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", fontWeight: isSelected ? 700 : 400, color: isSelected ? '#E8E6E1' : 'rgba(232,230,225,0.22)' }}>
                          {irr == null ? '—' : irr.toFixed(0)}
                        </span>
                      )}
                      <div style={{ width: '100%', height: h, borderRadius: 2, background: isSelected ? '#E8E6E1' : `${col}30`, border: isOptimal ? `1px solid #68D391` : isSelected ? `1px solid #E8E6E1` : 'none' }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {([
                [selectedFwd, ret, 'YOUR SELECTION', 'rgba(232,230,225,0.3)', '#E8E6E1'] as const,
                [optimalFwd, optRet, 'PLATFORM OPTIMAL', 'rgba(104,211,145,0.2)', '#68D391'] as const,
              ]).map(([fi, r, title, bc, tc]) => {
                // D1: every row gracefully shows "—" when its source is null.
                const fiNum = fi as number | null;
                const fmtPctOr = (v: number | null | undefined) => v == null ? '—' : fmt.pct(v);
                const fmtKOr = (v: number | null | undefined) => v == null ? '—' : fmt.k(v);
                const rssLive = fiNum != null ? chartSeries.rss[NOW_IDX + fiNum] ?? null : null;
                return (
                  <div key={title} style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${bc}`, borderRadius: 8, padding: '16px 20px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: tc, fontFamily: "'JetBrains Mono'", marginBottom: 10 }}>
                      {title} — {fiNum != null ? Q_LABELS[NOW_IDX + fiNum]?.label : '—'}
                    </div>
                    {([
                      { l: 'Hold', v: r ? `${r.holdYears}yr` : '—' },
                      { l: 'Exit NOI', v: fmtKOr(r?.exitNOI), c: '#68D391' },
                      { l: 'Cap', v: fmtPctOr(r?.exitCap), c: '#63B3ED' },
                      { l: 'Gross value', v: fmtKOr(r?.grossValue), c: '#68D391' },
                      { l: 'Net proceeds', v: fmtKOr(r?.netProceeds), c: '#68D391' },
                      { sep: 1 } as const,
                      { l: 'IRR', v: fmtPctOr(r?.irr), c: r == null ? '#9CA3AF' : r.irr >= 15 ? '#68D391' : '#F6E05E', big: 1 },
                      { l: 'EM',  v: r == null ? '—' : `${r.em.toFixed(2)}x`, c: r == null ? '#9CA3AF' : '#63B3ED', big: 1 },
                      { l: 'RSS', v: rssLive == null ? '—' : String(rssLive), c: rssLive == null ? '#9CA3AF' : rssLive >= 70 ? '#68D391' : '#F6E05E', big: 1 },
                    ] as Array<{l?:string;v?:string;c?:string;big?:number;sep?:number}>).map((row, i) => {
                      if (row.sep) return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '6px 0' }} />;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                          <span style={{ fontSize: 10, color: 'rgba(232,230,225,0.5)' }}>{row.l}</span>
                          <span style={{ fontSize: row.big ? 14 : 11, fontWeight: row.big ? 800 : 600, fontFamily: "'JetBrains Mono'", color: row.c || '#E8E6E1' }}>
                            {row.v}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ExitCapitalModule;
