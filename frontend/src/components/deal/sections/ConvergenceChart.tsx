/**
 * ConvergenceChart
 *
 * Self-contained 21-year exit timing chart extracted from ExitCapitalModule.
 * Shows Rent Growth, Cap Rate, Supply, and RSS (Readiness to Sell Score)
 * over 84 quarters (Q1 2016 → Q4 2036).
 *
 * Click any future quarter to set/inspect an exit point.
 */

import React, { useState, useCallback, useRef } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
export const NOW_IDX = 40;
export const TOTAL_Q = 84;

export const RENT_GROWTH_21Y = [
  4.8, 4.9, 5.0, 4.6, 4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8, 2.5, 2.2, 2.4, 2.6, 2.8,
  1.2, -2.5, -1.0, 0.5, 2.0, 6.5, 11.0, 14.2, 12.0, 8.5, 5.0, 3.0, 2.0, 1.5, 1.8, 2.2,
  2.5, 2.8, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5,
  3.6, 3.7, 3.8, 3.7, 3.5, 3.4, 3.2, 3.0, 2.8, 2.7, 2.5, 2.4, 2.3, 2.4, 2.5, 2.6,
  2.7, 2.8, 2.8, 2.9, 3.0, 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.4, 2.5, 2.6, 2.7,
  2.8, 2.9, 3.0, 3.0, 2.9, 2.8, 2.7, 2.6,
];

export const CAP_RATES_21Y = [
  6.0, 5.9, 5.8, 5.7, 5.6, 5.5, 5.4, 5.3, 5.2, 5.1, 5.0, 5.0, 4.9, 4.9, 5.0, 5.1,
  5.2, 5.8, 6.0, 5.8, 5.5, 5.0, 4.5, 4.2, 4.0, 4.1, 4.5, 4.8, 5.0, 5.2, 5.3, 5.4,
  5.4, 5.3, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0,
  5.0, 4.9, 4.9, 4.8, 4.8, 4.8, 4.9, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 5.2, 5.1, 5.1,
  5.0, 5.0, 5.0, 5.0, 5.1, 5.1, 5.2, 5.2, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0, 5.0, 5.1,
  5.1, 5.2, 5.2, 5.2, 5.1, 5.1, 5.0, 5.0, 5.0, 5.0, 5.1, 5.1,
];

export const SUPPLY_21Y = [
  0, 120, 0, 200, 0, 0, 280, 0, 0, 350, 0, 0, 0, 180, 0, 300,
  0, 0, 0, 0, 0, 50, 180, 420, 650, 800, 400, 200, 0, 120, 280, 0,
  0, 380, 0, 0, 200, 0, 0, 180,
  0, 180, 320, 0, 0, 420, 0, 280, 0, 0, 560, 0, 0, 0, 380, 0,
  0, 200, 0, 300, 0, 0, 250, 0, 0, 180, 0, 400, 0, 0, 220, 0,
  0, 150, 0, 300, 0, 0, 280, 0, 0, 200, 0, 250,
];

export const T10_21Y = [
  1.8, 1.7, 1.5, 2.0, 2.4, 2.3, 2.2, 2.4, 2.7, 2.9, 3.0, 2.7, 2.7, 2.1, 1.7, 1.9,
  1.6, 0.7, 0.7, 0.9, 1.1, 1.5, 1.3, 1.5, 1.8, 2.9, 3.3, 3.9, 3.5, 3.8, 4.3, 3.9,
  4.1, 4.5, 4.3, 4.2, 4.6, 4.2, 4.0, 3.9,
  3.8, 3.7, 3.6, 3.5, 3.5, 3.4, 3.4, 3.3, 3.3, 3.3, 3.2, 3.2, 3.2, 3.3, 3.3, 3.4,
  3.4, 3.5, 3.5, 3.5, 3.5, 3.6, 3.6, 3.6, 3.6, 3.5, 3.5, 3.5, 3.4, 3.4, 3.3, 3.3,
  3.2, 3.2, 3.1, 3.1, 3.0, 3.0, 3.0, 2.9, 2.9, 2.9, 2.8, 2.8,
];

interface RSSBreakdown {
  rss: number;
  mw: number;
  re: number;
  sp: number;
  or: number;
  bp: number;
}

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
  return { rss, mw: Math.round(mw), re: Math.round(Math.max(0, re)), sp: Math.round(sp), or: Math.round(opR), bp: Math.round(bp) };
}

export const RSS_21Y: RSSBreakdown[] = Array.from({ length: TOTAL_Q }, (_, i) => computeRSS21(i));

interface Quarter { idx: number; label: string; yearLabel: string | null; year: number; isProj: boolean; }

export const Q_LABELS: Quarter[] = Array.from({ length: TOTAL_Q }, (_, i) => {
  const y = 2016 + Math.floor(i / 4);
  const q = (i % 4) + 1;
  return { idx: i, label: `Q${q}'${String(y).slice(2)}`, yearLabel: q === 1 ? String(y) : null, year: y, isProj: i >= NOW_IDX };
});

// Find optimal quarter (highest RSS in projected range, weighted toward sooner)
export const OPTIMAL_FWD = (() => {
  let best = 0;
  let bestScore = -Infinity;
  for (let fwd = 4; fwd <= 24; fwd++) {
    const idx = NOW_IDX + fwd;
    if (idx >= TOTAL_Q) break;
    const score = (RSS_21Y[idx]?.rss ?? 0) - fwd * 0.5;
    if (score > bestScore) { bestScore = score; best = fwd; }
  }
  return best;
})();

const FOMC_MEETINGS = [
  { date: '2026-01-28', absQuarterIdx: 40, currentTarget: 4.25, action: 'cut_25' as const },
  { date: '2026-03-18', absQuarterIdx: 40, currentTarget: 4.00, action: 'cut_25' as const },
  { date: '2026-05-06', absQuarterIdx: 41, currentTarget: 3.75, action: 'hold' as const },
  { date: '2026-06-17', absQuarterIdx: 41, currentTarget: 3.75, action: 'cut_25' as const },
  { date: '2026-07-29', absQuarterIdx: 42, currentTarget: 3.50, action: 'hold' as const },
  { date: '2026-09-16', absQuarterIdx: 42, currentTarget: 3.50, action: 'cut_25' as const },
];

const KEY_EVENTS = [
  { idx: 17, label: 'COVID',  color: 'rgba(252,129,129,0.8)',  sublabel: "Q2'20 · Demand shock" },
  { idx: 24, label: 'RATE↑', color: 'rgba(246,173,85,0.85)', sublabel: "Q1'22 · Hike cycle" },
  { idx: 30, label: 'PEAK',  color: 'rgba(252,129,129,0.85)', sublabel: "Q3'23 · 5.25% EFFR" },
  { idx: 34, label: 'CUT-1', color: 'rgba(104,211,145,0.8)',  sublabel: "Q3'24 · First cut" },
  { idx: 44, label: 'NORM',  color: 'rgba(99,179,237,0.85)',  sublabel: "Q1'27 · Normalisation" },
  { idx: 49, label: 'SUP↓',  color: 'rgba(167,139,250,0.8)', sublabel: "Q2'28 · Supply clears" },
];

// ─── RSS Breakdown Cards ──────────────────────────────────────────────────────
export function RSSBreakdownCards({ rssData }: { rssData: RSSBreakdown }) {
  const cards = [
    { l: 'Market Window',    v: rssData.mw, w: '35%', c: '#68D391' },
    { l: 'Rate Environment', v: rssData.re, w: '25%', c: '#63B3ED' },
    { l: 'Supply Position',  v: rssData.sp, w: '20%', c: '#F6AD55' },
    { l: 'Operational Ready',v: rssData.or, w: '15%', c: '#B794F4' },
    { l: 'Buyer Pressure',   v: rssData.bp, w: '5%',  c: '#4FD1C5' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
      {cards.map(s => (
        <div key={s.l} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.4)', fontFamily: '"JetBrains Mono",monospace' }}>{s.l}</span>
            <span style={{ fontSize: 9, color: 'rgba(232,230,225,0.25)', fontFamily: '"JetBrains Mono",monospace' }}>{s.w}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: '"JetBrains Mono",monospace', color: s.v >= 70 ? '#68D391' : s.v >= 50 ? '#F6E05E' : '#FC8181' }}>{s.v}</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${s.v}%`, background: s.c, borderRadius: 2, opacity: 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Chart ───────────────────────────────────────────────────────────────
interface ConvergenceChartProps {
  selectedFwd: number;
  onSelectFwd: (fwd: number) => void;
  optimalFwd: number;
}

export function ConvergenceChart({ selectedFwd, onSelectFwd, optimalFwd }: ConvergenceChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 920, H = 360;
  const pad = { t: 30, r: 50, b: 58, l: 50 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const x = (i: number) => pad.l + (i / (TOTAL_Q - 1)) * iW;
  const nowX = x(NOW_IDX);
  const selAbsIdx = NOW_IDX + selectedFwd;
  const optAbsIdx = NOW_IDX + optimalFwd;

  const rgMin = -3, rgMax = 15;
  const capMin = 3.5, capMax = 6.5;
  const yRG = (v: number) => pad.t + iH - ((v - rgMin) / (rgMax - rgMin)) * iH;
  const yCap = (v: number) => pad.t + iH - ((v - capMin) / (capMax - capMin)) * iH;
  const yRSS = (v: number) => pad.t + iH - (v / 100) * iH;

  const maxSupply = Math.max(...SUPPLY_21Y);

  const rgHistPath: string[] = [], rgProjPath: string[] = [];
  const capHistPath: string[] = [], capProjPath: string[] = [];
  const rssHistPath: string[] = [], rssProjPath: string[] = [];

  for (let i = 0; i < TOTAL_Q; i++) {
    const px = x(i);
    const pt1 = `${px},${yRG(RENT_GROWTH_21Y[i] ?? 2.5)}`;
    const pt2 = `${px},${yCap(CAP_RATES_21Y[i] ?? 5.0)}`;
    const pt3 = `${px},${yRSS(RSS_21Y[i]?.rss ?? 50)}`;
    if (i <= NOW_IDX) { rgHistPath.push(pt1); capHistPath.push(pt2); rssHistPath.push(pt3); }
    if (i >= NOW_IDX) { rgProjPath.push(pt1); capProjPath.push(pt2); rssProjPath.push(pt3); }
  }

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const absIdx = Math.round(((mx - pad.l) / iW) * (TOTAL_Q - 1));
    if (absIdx >= NOW_IDX && absIdx < TOTAL_Q) onSelectFwd(absIdx - NOW_IDX);
  }, [onSelectFwd]);

  const handleMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((mx - pad.l) / iW) * (TOTAL_Q - 1));
    if (idx >= 0 && idx < TOTAL_Q) setHoverIdx(idx);
  }, []);

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
        <rect x={pad.l} y={pad.t} width={nowX - pad.l} height={iH} fill="rgba(255,255,255,0.008)" />
        <rect x={nowX} y={pad.t} width={W - pad.r - nowX} height={iH} fill="rgba(99,179,237,0.015)" />

        {SUPPLY_21Y.map((v, i) => {
          if (v === 0 || maxSupply === 0) return null;
          const h = (v / maxSupply) * iH * 0.35;
          return <rect key={i} x={x(i) - 2} y={pad.t + iH - h} width={4} height={h} fill={i >= NOW_IDX ? 'rgba(246,173,85,0.2)' : 'rgba(246,173,85,0.08)'} rx={1} />;
        })}

        <path d={`M${rgHistPath.join(' L')}`} fill="none" stroke="#68D391" strokeWidth={1.5} />
        <path d={`M${rgProjPath.join(' L')}`} fill="none" stroke="#68D391" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />
        <path d={`M${capHistPath.join(' L')}`} fill="none" stroke="#63B3ED" strokeWidth={1.5} />
        <path d={`M${capProjPath.join(' L')}`} fill="none" stroke="#63B3ED" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.7} />
        <path d={`M${rssHistPath.join(' L')}`} fill="none" stroke="#10b981" strokeWidth={1} opacity={0.3} />
        <path d={`M${rssProjPath.join(' L')}`} fill="none" stroke="#10b981" strokeWidth={2.5} />

        <line x1={nowX} y1={pad.t - 8} x2={nowX} y2={pad.t + iH + 8} stroke="#E8E6E1" strokeWidth={1.5} />
        <rect x={nowX - 16} y={pad.t - 18} width={32} height={14} rx={3} fill="#E8E6E1" />
        <text x={nowX} y={pad.t - 8} textAnchor="middle" fill="#0B0E13" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">NOW</text>

        <line x1={x(optAbsIdx)} y1={pad.t} x2={x(optAbsIdx)} y2={pad.t + iH} stroke="#68D391" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
        <text x={x(optAbsIdx)} y={pad.t + iH + 28} textAnchor="middle" fill="#68D391" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">OPTIMAL</text>

        <line x1={x(selAbsIdx)} y1={pad.t - 2} x2={x(selAbsIdx)} y2={pad.t + iH + 2} stroke="#E8E6E1" strokeWidth={2} />
        <rect x={x(selAbsIdx) - 22} y={pad.t - 20} width={44} height={14} rx={3} fill="#E8E6E1" />
        <text x={x(selAbsIdx)} y={pad.t - 10} textAnchor="middle" fill="#0B0E13" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono">{Q_LABELS[selAbsIdx]?.label}</text>
        <text x={x(selAbsIdx)} y={yRSS(RSS_21Y[selAbsIdx]?.rss ?? 50) - 10} textAnchor="middle" fill="#10b981" fontSize={11} fontWeight={800} fontFamily="JetBrains Mono">{RSS_21Y[selAbsIdx]?.rss ?? 50}</text>

        {Q_LABELS.filter(q => q.yearLabel).map(q => (
          <text key={q.idx} x={x(q.idx)} y={pad.t + iH + 14} textAnchor="middle" fill={q.isProj ? '#63B3ED60' : 'rgba(232,230,225,0.22)'} fontSize={8} fontFamily="JetBrains Mono" fontWeight={q.year === 2026 ? 700 : 400}>{q.yearLabel}</text>
        ))}

        <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fill="#68D391" fontSize={7} fontFamily="JetBrains Mono">{rgMax}%</text>
        <text x={pad.l - 6} y={pad.t + iH} textAnchor="end" fill="#68D391" fontSize={7} fontFamily="JetBrains Mono">{rgMin}%</text>
        <text x={W - pad.r + 6} y={pad.t + 4} textAnchor="start" fill="#10b981" fontSize={7} fontFamily="JetBrains Mono">100</text>
        <text x={W - pad.r + 6} y={pad.t + iH} textAnchor="start" fill="#10b981" fontSize={7} fontFamily="JetBrains Mono">0</text>

        <text x={(pad.l + nowX) / 2} y={pad.t + iH + 40} textAnchor="middle" fill="rgba(232,230,225,0.22)" fontSize={7} fontFamily="JetBrains Mono" letterSpacing={2}>HISTORICAL (10yr)</text>
        <text x={(nowX + W - pad.r) / 2} y={pad.t + iH + 40} textAnchor="middle" fill="#63B3ED60" fontSize={7} fontFamily="JetBrains Mono" letterSpacing={2}>PROJECTED (10yr) — click to set exit</text>

        {hoverIdx !== null && <line x1={x(hoverIdx)} y1={pad.t} x2={x(hoverIdx)} y2={pad.t + iH} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />}

        {FOMC_MEETINGS.map(mtg => {
          const mtgX = x(mtg.absQuarterIdx);
          const mtgY = yCap(mtg.currentTarget);
          const color = mtg.action === 'cut_25' ? '#68D391' : mtg.action === 'hike_25' ? '#FC8181' : '#999';
          return (
            <g key={`fomc-${mtg.date}`}>
              <polygon points={`${mtgX},${mtgY - 6} ${mtgX + 6},${mtgY} ${mtgX},${mtgY + 6} ${mtgX - 6},${mtgY}`} fill={color} opacity={0.7} />
            </g>
          );
        })}

        <g transform={`translate(${pad.l},${H - 10})`}>
          <line x1={0} y1={0} x2={12} y2={0} stroke="#68D391" strokeWidth={1.5} />
          <text x={16} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>Rent growth %</text>
          <line x1={100} y1={0} x2={112} y2={0} stroke="#63B3ED" strokeWidth={1.5} />
          <text x={116} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>Cap rate %</text>
          <rect x={190} y={-3} width={6} height={6} fill="rgba(246,173,85,0.2)" rx={1} />
          <text x={200} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>Supply</text>
          <line x1={248} y1={0} x2={260} y2={0} stroke="#10b981" strokeWidth={2.5} />
          <text x={264} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>RSS score</text>
          <polygon points="330,0 335,-3 340,0 335,3" fill="#68D391" />
          <text x={344} y={3} fill="rgba(232,230,225,0.22)" fontSize={7}>FOMC cut</text>
        </g>
      </svg>

      {/* Key event strip */}
      <div style={{ position: 'relative', height: 36, marginTop: -4 }}>
        {KEY_EVENTS.map(ev => {
          const leftPct = (50 + (ev.idx / (TOTAL_Q - 1)) * 820) / 920 * 100;
          return (
            <div key={ev.label} title={ev.sublabel} style={{ position: 'absolute', left: `${leftPct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}>
              <svg width="9" height="8" viewBox="0 0 9 8"><polygon points="4.5,0.5 8.5,7.5 0.5,7.5" fill="none" stroke={ev.color} strokeWidth="1.2" /></svg>
              <span style={{ fontSize: 7, fontWeight: 700, fontFamily: '"JetBrains Mono",monospace', color: ev.color, whiteSpace: 'nowrap' }}>{ev.label}</span>
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: `${(50 + (NOW_IDX / (TOTAL_Q - 1)) * 820) / 920 * 100}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '6px solid rgba(232,230,225,0.8)' }} />
          <span style={{ fontSize: 7, fontWeight: 700, fontFamily: '"JetBrains Mono",monospace', color: 'rgba(232,230,225,0.8)', whiteSpace: 'nowrap' }}>NOW</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverIdx !== null && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(11,14,19,0.94)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '8px 12px', pointerEvents: 'none', minWidth: 170 }}>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: '"JetBrains Mono",monospace', color: Q_LABELS[hoverIdx]?.isProj ? '#63B3ED' : '#E8E6E1', marginBottom: 4 }}>
            {Q_LABELS[hoverIdx]?.label} {Q_LABELS[hoverIdx]?.isProj ? '(projected)' : ''}
          </div>
          {[
            { l: 'Rent growth', v: RENT_GROWTH_21Y[hoverIdx], c: '#68D391', s: '%' },
            { l: 'Cap rate',    v: CAP_RATES_21Y[hoverIdx],   c: '#63B3ED', s: '%' },
            { l: 'Treasury 10Y', v: T10_21Y[hoverIdx],        c: '#B794F4', s: '%' },
            { l: 'Supply',     v: SUPPLY_21Y[hoverIdx],        c: '#F6AD55', s: ' units' },
            { l: 'RSS',        v: RSS_21Y[hoverIdx]?.rss,      c: '#10b981', s: '' },
          ].map(r => (
            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span style={{ fontSize: 9, color: r.c }}>{r.l}</span>
              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono",monospace', fontWeight: 600, color: r.c }}>
                {r.v != null ? (typeof r.v === 'number' ? r.v.toFixed(1) + r.s : r.v + r.s) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
