import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../api/client';

// ─── THEME TOKENS ────────────────────────────────────────────
const TC = {
  bg: '#0A0E17', panel: '#0F1319', panelAlt: '#131821', header: '#1A1F2E',
  hover: '#1E2538', active: '#252D40', topBar: '#050810',
  primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568',
  amber: '#F5A623', amberBright: '#FFD166', green: '#00D26A',
  red: '#FF4757', cyan: '#00BCD4', orange: '#FF8C42', purple: '#A78BFA',
  blue: '#3B82F6', blueBg: '#1e3a5f',
  borderS: '#1E2538', borderM: '#2A3348',
};
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

// ─── PROP TYPES ──────────────────────────────────────────────
export interface PropertyCardData {
  id?: string | number;
  name: string;
  address?: string;
  submarket?: string;
  msa?: string;
  county?: string;
  type?: string;
  units?: number;
  yearBuilt?: number;
  class?: string;
  owner?: string;
  jediScore?: number;
  pcsScore?: number;
  pcsRank?: number;
  pcsTotal?: number;
  avgRent?: number;
  occupancy?: number;
  capRate?: number;
  noi?: number;
  irr?: number;
  equityMultiple?: number;
  cashOnCash?: number;
  dscr?: number;
  stories?: number;
  zoning?: string;
  lotAc?: number;
  lotSf?: number;
  sqft?: number;
  parking?: string;
  parcelId?: string;
  assessedValue?: number;
  lastSalePrice?: number;
  lastSaleYear?: number;
  manager?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  estDebt?: string;
  debtMaturity?: string;
  strategy?: string;
  arbGap?: number;
}

interface NewsItem {
  time: string;
  src: string;
  headline: string;
  impact: string;
  pts: string;
}

interface CompRow {
  id?: string | number;
  name: string;
  submarket?: string;
  units: number;
  year?: number;
  class?: string;
  rent?: string;
  rentDelta?: string;
  occ?: string;
  cap?: string;
  ppu?: string;
  review?: number;
  isSubject?: boolean;
}

interface PropertyCardPanelProps {
  property: PropertyCardData;
  onClose: () => void;
  sourceLabel?: string;
}

// ─── CHART HELPERS ───────────────────────────────────────────
function Spark({ data, color = TC.green, w = 52, h = 14 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return null;
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function MiniChart({ data, color = TC.green, h = 80 }: { data: number[]; color?: string; h?: number }) {
  if (!data || data.length < 2) return <div style={{ height: h, background: TC.header }} />;
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = h - 8 - ((v - mn) / r) * (h - 16);
    return `${x}%,${y}`;
  }).join(' ');
  const area = pts + ` 100%,${h} 0%,${h}`;
  return (
    <svg width="100%" height={h} style={{ display: 'block' }} preserveAspectRatio="none" viewBox={`0 0 100 ${h}`}>
      <polygon points={area} fill={color + '12'} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DeltaCell({ value }: { value?: string }) {
  if (!value || value === '—') return <span style={{ color: TC.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value); const pos = s.startsWith('+'); const neg = s.startsWith('-');
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? TC.green : neg ? TC.red : TC.muted, ...mono }}>{s}</span>;
}

function ScoreCell({ value, size = 11 }: { value: number; size?: number }) {
  const c = value >= 80 ? TC.green : value >= 65 ? TC.amber : TC.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, padding: '1px 5px', letterSpacing: 0.5, whiteSpace: 'nowrap' as const }}>
      {label}
    </span>
  );
}

function fmt(n?: number, prefix = '', suffix = '', decimals = 0): string {
  if (n == null) return '—';
  const s = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${prefix}${s}${suffix}`;
}
function fmtM(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── DEFAULT FALLBACK DATA ────────────────────────────────────
const DEFAULT_RENT_HISTORY = [1180, 1200, 1220, 1240, 1250, 1265, 1280, 1300, 1320, 1340, 1360, 1385];
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const DEFAULT_SIGNALS = [
  { id: 'D', name: 'DEMAND',   score: 82, delta: '+3', weight: 30, color: TC.green,  desc: 'Net migration positive. Employment expanding in metro area.' },
  { id: 'S', name: 'SUPPLY',   score: 64, delta: '-2', weight: 25, color: TC.red,    desc: 'Pipeline units within trade area create moderate supply pressure.' },
  { id: 'M', name: 'MOMENTUM', score: 78, delta: '+5', weight: 20, color: TC.orange, desc: 'Rent growth accelerating. Transaction velocity increasing.' },
  { id: 'P', name: 'POSITION', score: 72, delta: '+1', weight: 15, color: TC.purple, desc: 'Solid submarket position. Resident review score above median.' },
  { id: 'R', name: 'RISK',     score: 28, delta: '-4', weight: 10, color: TC.muted,  desc: 'Insurance and regulatory environment stable. Score inverted.' },
];

const DEFAULT_COMPS: CompRow[] = [
  { name: 'Westshore Landings', submarket: 'Westshore', units: 312, year: 2004, rent: '$1,520', rentDelta: '+2.4%', occ: '94.8%', cap: '4.8%', ppu: '$215K', review: 4.3 },
  { name: 'Bay Crest Park',     submarket: 'Westshore', units: 198, year: 1996, rent: '$1,290', rentDelta: '+4.2%', occ: '93.2%', cap: '5.6%', ppu: '$172K', review: 3.8 },
  { name: 'Camden Westchase',   submarket: 'Westchase', units: 408, year: 2018, rent: '$1,820', rentDelta: '+1.8%', occ: '95.4%', cap: '4.4%', ppu: '$268K', review: 4.5 },
  { name: 'Arbor Reserve',      submarket: 'Westshore', units: 176, year: 2001, rent: '$1,340', rentDelta: '+3.2%', occ: '91.8%', cap: '5.4%', ppu: '$178K', review: 3.9 },
];

const DEFAULT_NEWS: NewsItem[] = [
  { time: '2d',  src: 'CBRE',  headline: 'Multifamily demand strengthens as employment expands for 14th consecutive month', impact: '+DEMAND',   pts: '+3.2' },
  { time: '5d',  src: 'CoStar',headline: 'New supply deliveries slow; absorption outpaces new completions in submarket',    impact: '+POSITION', pts: '+1.8' },
  { time: '1w',  src: 'BLS',   headline: 'Metro area employment growth leads Southeast, wage gains support rent growth',    impact: '+DEMAND',   pts: '+1.4' },
  { time: '2w',  src: 'MF',    headline: 'Submarket vacancy falls to 5.8% — 3-year low as demand outstrips supply',        impact: '+MOMENTUM', pts: '+0.8' },
  { time: '3w',  src: 'GOV',   headline: 'Insurance reform bill signed; 8% rate cap provides cost relief for operators',   impact: 'RISK DN',   pts: '+1.2' },
];

const COMP_NORMALIZED_LINES = [
  { name: 'Subject',         color: TC.amber,  data: [100, 101.7, 103.4, 105.1, 105.9, 107.2, 108.5, 110.2, 111.9, 113.6, 115.3, 117.4] },
  { name: 'Comp 1',          color: TC.cyan,   data: [100, 100.8, 101.6, 102.4, 102.8, 103.6, 104.4, 105.2, 106.0, 106.8, 107.2, 108.0] },
  { name: 'Comp 2',          color: TC.green,  data: [100, 101.2, 102.8, 104.2, 105.4, 106.8, 108.2, 109.8, 111.2, 112.8, 114.2, 116.0] },
  { name: 'Comp 3',          color: TC.purple, data: [100, 100.4, 100.8, 101.2, 101.4, 101.8, 102.2, 102.6, 103.0, 103.4, 103.6, 104.0] },
  { name: 'Submarket Avg',   color: TC.muted,  data: [100, 100.8, 101.6, 102.6, 103.2, 104.2, 105.2, 106.2, 107.2, 108.2, 109.2, 110.4] },
];

// ═══════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ═══════════════════════════════════════════════════════════════
function OverviewTab({ property, news, jediScore }: { property: PropertyCardData; news: NewsItem[]; jediScore: number }) {
  const rentHistory = DEFAULT_RENT_HISTORY;
  const displayRent = property.avgRent ? `$${property.avgRent.toLocaleString()}` : '$1,385';
  const displayOcc  = property.occupancy != null ? `${property.occupancy.toFixed(1)}%` : '92.4%';
  const displayCap  = property.capRate != null ? `${(property.capRate * 100).toFixed(1)}%` : '5.2%';
  const displayNOI  = property.noi ? fmtM(property.noi) : '$2.34M';
  const displayIRR  = property.irr != null ? `${property.irr.toFixed(1)}%` : '18.4%';
  const displayEM   = property.equityMultiple != null ? `${property.equityMultiple.toFixed(1)}x` : '2.1x';
  const displayCoC  = property.cashOnCash != null ? `${property.cashOnCash.toFixed(1)}%` : '8.2%';
  const displayDSCR = property.dscr != null ? `${property.dscr.toFixed(2)}x` : '1.32x';
  const score = jediScore || property.jediScore || property.pcsScore || 86;
  const scoreColor = score >= 80 ? TC.green : score >= 65 ? TC.amber : TC.red;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: TC.borderS, flex: 1, overflowY: 'auto' }}>
      {/* ── PROPERTY PRIMER ── */}
      <div style={{ background: TC.panel, padding: '12px 16px' }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: TC.amber, marginBottom: 6, ...mono }}>PROPERTY PRIMER</div>
        <p style={{ fontSize: 11, color: TC.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          <span style={{ color: TC.primary, fontWeight: 600 }}>{property.name}</span> is a{' '}
          {property.units && <span style={{ color: TC.primary, fontWeight: 600 }}>{property.units}-unit </span>}
          {property.class && <span style={{ color: TC.primary, fontWeight: 600 }}>Class {property.class} </span>}
          {property.type || 'multifamily'} asset
          {property.submarket && <span> in the <span style={{ color: TC.amber }}>{property.submarket}</span> submarket</span>}
          {property.yearBuilt && <span>, built in <span style={{ color: TC.primary }}>{property.yearBuilt}</span></span>}.
          {property.avgRent && <> Current rents average <span style={{ color: TC.green }}>{displayRent}/mo</span></>}.
          {property.occupancy != null && <> Physical occupancy is <span style={{ color: TC.amber }}>{displayOcc}</span></>}.
          {property.owner && <> Property is managed by <span style={{ color: TC.primary }}>{property.owner}</span></>}.
          {property.strategy && (
            <> Platform recommends <span style={{ color: TC.purple }}>{property.strategy} strategy</span>
            {property.arbGap != null && <> with an arbitrage gap of <span style={{ color: TC.amber }}>{property.arbGap}pts</span></>}.</>
          )}
        </p>
      </div>

      {/* ── 3-COLUMN ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
        {/* Rent Chart */}
        <div style={{ background: TC.panel, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, ...mono }}>RENT HISTORY · 12MO</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['6M', '1Y', '3Y', '5Y'].map((p, i) => (
                <span key={i} style={{ fontSize: 7, padding: '1px 4px', background: i === 1 ? TC.amber : 'transparent', color: i === 1 ? TC.bg : TC.muted, cursor: 'pointer', ...mono }}>{p}</span>
              ))}
            </div>
          </div>
          <MiniChart data={rentHistory} color={TC.green} h={90} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {MONTHS.filter((_, i) => i % 3 === 0).map((m, i) => (
              <span key={i} style={{ fontSize: 7, color: TC.muted, ...mono }}>{m}</span>
            ))}
          </div>
          <div style={{ marginTop: 8, borderTop: `1px solid ${TC.borderS}`, paddingTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {[
                { l: 'Rent/Unit (Current)', v: displayRent },
                { l: '52wk High', v: '$1,395' },
                { l: 'Rent/SF', v: '$1.92' },
                { l: '52wk Low', v: '$1,180' },
                { l: 'YTD Change', v: '+3.8%', c: TC.green },
                { l: 'vs Submarket', v: '+1.4%', c: TC.green },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ fontSize: 8, color: TC.muted, ...mono }}>{m.l}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: m.c || TC.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operating Metrics */}
        <div style={{ background: TC.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: TC.cyan, borderBottom: `1px solid ${TC.cyan}`, paddingBottom: 2, ...mono }}>OPERATING METRICS</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0, marginTop: 8 }}>
            {[
              { l: 'NOI', v: displayNOI },
              { l: 'Cap Rate', v: displayCap },
              { l: 'DSCR', v: displayDSCR },
              { l: 'Physical Occ', v: displayOcc },
              { l: 'Economic Occ', v: '89.8%' },
              { l: 'RevPAU', v: '$1,312' },
              { l: 'Concession Rate', v: '2.8%' },
            ].map((m, i) => (
              <React.Fragment key={i}>
                <div style={{ padding: '4px 8px 4px 0', fontSize: 9, color: TC.secondary, borderBottom: `1px solid ${TC.borderS}`, ...sans }}>{m.l}</div>
                <div style={{ padding: '4px 0', fontSize: 10, fontWeight: 600, color: TC.primary, textAlign: 'right', borderBottom: `1px solid ${TC.borderS}`, ...mono }}>{m.v}</div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '8px 0', borderTop: `1px solid ${TC.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: TC.amber, ...mono }}>RETURNS</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0, marginTop: 4 }}>
              {[
                { l: 'Proj. IRR', v: displayIRR, c: TC.green },
                { l: 'Equity Multiple', v: displayEM, c: TC.green },
                { l: 'Cash-on-Cash', v: displayCoC, c: TC.green },
              ].map((m, i) => (
                <React.Fragment key={i}>
                  <div style={{ padding: '3px 8px 3px 0', fontSize: 9, color: TC.secondary, ...sans }}>{m.l}</div>
                  <div style={{ padding: '3px 0', fontSize: 10, fontWeight: 700, color: m.c, textAlign: 'right', ...mono }}>{m.v}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Property Info */}
        <div style={{ background: TC.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, ...mono }}>PROPERTY INFO</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0, marginTop: 6 }}>
            {[
              { l: 'Address',       v: property.address || '—' },
              { l: 'County',        v: property.county || '—' },
              { l: 'Parcel ID',     v: property.parcelId || '—' },
              { l: 'Zoning',        v: property.zoning || '—' },
              { l: 'Year Built',    v: property.yearBuilt ? String(property.yearBuilt) : '—' },
              { l: 'Units / SF',    v: `${property.units ?? '—'} / ${property.sqft ? property.sqft.toLocaleString() : '—'}` },
              { l: 'Lot Size',      v: property.lotAc ? `${property.lotAc} ac` : '—' },
              { l: 'Parking',       v: property.parking || '—' },
              { l: 'Assessed Value',v: property.assessedValue ? fmtM(property.assessedValue) : '—' },
              { l: 'Last Sale',     v: property.lastSalePrice ? `${fmtM(property.lastSalePrice)}${property.lastSaleYear ? ` (${property.lastSaleYear})` : ''}` : '—' },
            ].map((m, i) => (
              <React.Fragment key={i}>
                <div style={{ padding: '3px 8px 3px 0', fontSize: 8, color: TC.muted, borderBottom: `1px solid ${TC.borderS}`, ...mono, whiteSpace: 'nowrap' }}>{m.l}</div>
                <div style={{ padding: '3px 0', fontSize: 9, color: TC.primary, borderBottom: `1px solid ${TC.borderS}`, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{m.v}</div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${TC.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: TC.purple, ...mono }}>OWNERSHIP & MGMT</span>
            <div style={{ marginTop: 6 }}>
              {[
                { l: 'Owner',        v: property.owner || '—' },
                { l: 'Manager',      v: property.manager || '—' },
                { l: 'Acquired',     v: property.acquisitionDate || '—' },
                { l: 'Acq. Price',   v: property.acquisitionPrice ? fmtM(property.acquisitionPrice) : '—' },
                { l: 'Est. Debt',    v: property.estDebt || '—' },
                { l: 'Debt Maturity',v: property.debtMaturity || '—' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${TC.borderS}` }}>
                  <span style={{ fontSize: 8, color: TC.muted, ...mono }}>{m.l}</span>
                  <span style={{ fontSize: 9, color: TC.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── JEDI SCORE + SIGNALS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 1 }}>
        <div style={{ background: TC.panel, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 8, color: TC.muted, letterSpacing: 1.5, ...mono }}>JEDI SCORE</div>
          <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', boxShadow: `0 0 16px ${scoreColor}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: scoreColor }}>{score}</span>
            <span style={{ fontSize: 8, color: scoreColor, fontWeight: 600, ...mono }}>+3 30d</span>
          </div>
          <span style={{ fontSize: 8, color: TC.muted, ...mono }}>Conf: 87%</span>
          <Spark data={rentHistory} color={TC.green} w={100} h={20} />
          {(property.pcsScore || property.pcsRank) && (
            <div style={{ marginTop: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: TC.muted, ...mono }}>PCS RANK</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: TC.cyan, ...mono }}>
                #{property.pcsRank ?? '—'}{property.pcsTotal ? <span style={{ fontSize: 9, color: TC.muted }}>/{property.pcsTotal}</span> : ''}
              </div>
            </div>
          )}
        </div>
        <div style={{ background: TC.panel, padding: 12 }}>
          {DEFAULT_SIGNALS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: TC.muted, minWidth: 90, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: 1, height: 5, background: TC.bg, borderRadius: 1 }}>
                <div style={{ height: '100%', width: `${s.score}%`, background: s.score >= 70 ? TC.green : s.score >= 50 ? TC.amber : TC.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={10} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 8, color: TC.muted, flex: 1.5, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NEWS FEED ── */}
      <div style={{ background: TC.panel }}>
        <div style={{ padding: '6px 12px', borderBottom: `1px solid ${TC.borderS}` }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, ...mono }}>RELATED NEWS · {news.length} ITEMS</span>
        </div>
        {news.map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 12px', borderBottom: `1px solid ${TC.borderS}`, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = TC.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontSize: 8, color: TC.muted, minWidth: 24, ...mono }}>{n.time}</span>
            <span style={{ fontSize: 8, color: TC.cyan, minWidth: 32, ...mono }}>{n.src}</span>
            <span style={{ fontSize: 9, color: TC.primary, flex: 1, ...sans }}>{n.headline}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: n.impact.includes('+') || n.impact.includes('DN') ? TC.green : TC.red, minWidth: 56, textAlign: 'right', ...mono }}>{n.impact}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: n.pts.startsWith('+') ? TC.green : TC.red, minWidth: 32, textAlign: 'right', ...mono }}>{n.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: REL VALUE
// ═══════════════════════════════════════════════════════════════
function RelValueTab({ property, comps }: { property: PropertyCardData; comps: CompRow[] }) {
  const allNormVals = COMP_NORMALIZED_LINES.flatMap(c => c.data);
  const mx = Math.max(...allNormVals), mn = Math.min(...allNormVals);

  const subjectComp: CompRow = {
    name: property.name,
    submarket: property.submarket,
    units: property.units ?? 0,
    year: property.yearBuilt,
    class: property.class,
    rent: property.avgRent ? `$${property.avgRent.toLocaleString()}` : '—',
    rentDelta: '+3.8%',
    occ: property.occupancy != null ? `${property.occupancy.toFixed(1)}%` : '—',
    cap: property.capRate != null ? `${(property.capRate * 100).toFixed(1)}%` : '—',
    ppu: '—',
    review: 4.1,
    isSubject: true,
  };

  const allComps: CompRow[] = [subjectComp, ...comps];

  const COL_WIDTHS = [160, 48, 44, 60, 52, 48, 44, 56, 44] as const;
  const COL_LABELS = ['Name (Comp Set)', 'Units', 'Year', 'Rent', 'Rent Δ', 'Occ', 'Cap', '$/Unit', 'Review'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: TC.borderS, flex: 1, overflowY: 'auto' }}>
      {/* Normalized Rent Overlay Chart */}
      <div style={{ background: TC.panel, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, ...mono }}>NORMALIZED RENT OVERLAY (Base 100) · 12MO</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['6M', '1Y', '3Y'].map((p, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', background: i === 1 ? TC.amber : 'transparent', color: i === 1 ? TC.bg : TC.muted, cursor: 'pointer', ...mono }}>{p}</span>
            ))}
          </div>
        </div>
        <svg width="100%" height={140} viewBox="0 0 400 140" preserveAspectRatio="none" style={{ display: 'block' }}>
          {[100, 105, 110, 115, 120].map((v, i) => {
            const y = 130 - ((v - mn) / (mx - mn)) * 120;
            return (
              <React.Fragment key={i}>
                <line x1="0" y1={y} x2="400" y2={y} stroke={TC.borderS} strokeWidth="0.5" />
                <text x="2" y={y - 2} fill={TC.muted} fontSize="6" fontFamily="JetBrains Mono">{v}</text>
              </React.Fragment>
            );
          })}
          {COMP_NORMALIZED_LINES.map((c, ci) => {
            const pts = c.data.map((v, i) => `${(i / 11) * 396 + 2},${130 - ((v - mn) / (mx - mn)) * 120}`).join(' ');
            return (
              <polyline key={ci} points={pts} fill="none" stroke={c.color}
                strokeWidth={c.name === 'Subject' ? '2' : '1'}
                strokeDasharray={c.name === 'Submarket Avg' ? '4 2' : 'none'}
                opacity={c.name === 'Subject' ? 1 : 0.7} />
            );
          })}
        </svg>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {COMP_NORMALIZED_LINES.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 2, background: c.color, borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: c.color, ...mono }}>{i === 0 ? property.name : c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Peer Comparison Table */}
      <div style={{ background: TC.panel }}>
        <div style={{ padding: '6px 12px', borderBottom: `1px solid ${TC.borderS}` }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, ...mono }}>PEER COMPARISON · {allComps.length} COMPS</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', background: TC.header, borderBottom: `1px solid ${TC.borderM}`, minWidth: 600 }}>
            {COL_LABELS.map((l, i) => (
              <div key={i} style={{ width: COL_WIDTHS[i], minWidth: COL_WIDTHS[i], padding: '3px 6px', fontSize: 7, fontWeight: 700, color: TC.muted, letterSpacing: 0.5, borderRight: `1px solid ${TC.borderS}`, flexShrink: 0, ...mono }}>{l}</div>
            ))}
          </div>
          {allComps.map((c, i) => (
            <div key={i} style={{ display: 'flex', background: c.isSubject ? TC.amber + '0A' : i % 2 === 0 ? TC.panel : TC.panelAlt, borderBottom: `1px solid ${TC.borderS}`, borderLeft: c.isSubject ? `2px solid ${TC.amber}` : '2px solid transparent', cursor: 'pointer', minWidth: 600 }}
              onMouseEnter={e => { if (!c.isSubject) e.currentTarget.style.background = TC.hover; }}
              onMouseLeave={e => { if (!c.isSubject) e.currentTarget.style.background = i % 2 === 0 ? TC.panel : TC.panelAlt; }}>
              <div style={{ width: 160, minWidth: 160, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}>
                <span style={{ fontSize: 9, fontWeight: c.isSubject ? 700 : 500, color: c.isSubject ? TC.amberBright : TC.primary, ...sans }}>{c.name}</span>
              </div>
              <div style={{ width: 48, minWidth: 48, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{c.units || '—'}</span></div>
              <div style={{ width: 44, minWidth: 44, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{c.year || '—'}</span></div>
              <div style={{ width: 60, minWidth: 60, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><span style={{ fontSize: 10, fontWeight: 600, color: TC.primary, ...mono }}>{c.rent || '—'}</span></div>
              <div style={{ width: 52, minWidth: 52, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><DeltaCell value={c.rentDelta} /></div>
              <div style={{ width: 48, minWidth: 48, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{c.occ || '—'}</span></div>
              <div style={{ width: 44, minWidth: 44, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{c.cap || '—'}</span></div>
              <div style={{ width: 56, minWidth: 56, padding: '4px 6px', borderRight: `1px solid ${TC.borderS}` }}><span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{c.ppu || '—'}</span></div>
              <div style={{ width: 44, minWidth: 44, padding: '4px 6px' }}><span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{c.review ?? '—'}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: REL INDEX
// ═══════════════════════════════════════════════════════════════
function RelIndexTab({ property }: { property: PropertyCardData }) {
  const scatterPts = [
    { x: -2.1, y: -3.4 }, { x: -0.8, y: -1.2 }, { x: 0.2, y: 0.4 }, { x: 0.4, y: 0.8 }, { x: 0.6, y: 1.2 },
    { x: 0.8, y: 0.6 },  { x: 1.0, y: 1.8 },  { x: 1.2, y: 2.2 }, { x: 0.4, y: 0.2 }, { x: 1.4, y: 2.8 },
    { x: 0.6, y: 1.0 },  { x: 1.8, y: 3.2 },  { x: 0.8, y: 1.4 }, { x: 2.0, y: 3.6 }, { x: 1.2, y: 1.8 },
    { x: 2.2, y: 4.0 },  { x: 1.6, y: 2.4 },  { x: 1.0, y: 1.6 }, { x: 2.4, y: 3.8 }, { x: 0.2, y: -0.4 },
    { x: 1.8, y: 2.6 },  { x: 2.6, y: 4.4 },  { x: -1.4, y: -2.8 }, { x: 0.8, y: 1.2 },
  ];

  const stats = [
    { l: 'Y =', v: property.name },
    { l: 'X =', v: `${property.submarket || 'Submarket'} Avg` },
    { l: '', v: '' },
    { l: 'Linear Beta', v: '1.62' },
    { l: 'Raw Beta', v: '1.58' },
    { l: 'Adjusted Beta', v: '1.39' },
    { l: 'Alpha (Intercept)', v: '+0.42%' },
    { l: 'R² (Correlation²)', v: '0.82' },
    { l: 'R (Correlation)', v: '0.91' },
    { l: 'Std Dev of Error', v: '0.48' },
    { l: 't-Test', v: '9.84' },
    { l: 'Significance', v: '<0.001' },
    { l: 'Number of Points', v: '24' },
  ];

  const chartW = 360, chartH = 240, padL = 40, padB = 24, padT = 10, padR = 10;
  const xMin = -3, xMax = 3, yMin = -4, yMax = 5;
  const toX = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * (chartW - padL - padR);
  const toY = (v: number) => padT + ((yMax - v) / (yMax - yMin)) * (chartH - padT - padB);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: TC.borderS, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 1 }}>
        {/* Scatter plot */}
        <div style={{ flex: 1, background: TC.panel, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, ...mono }}>RENT GROWTH REGRESSION · PROPERTY vs SUBMARKET</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['6M', '1Y', '2Y'].map((p, i) => (
                <span key={i} style={{ fontSize: 7, padding: '1px 4px', background: i === 1 ? TC.amber : 'transparent', color: i === 1 ? TC.bg : TC.muted, cursor: 'pointer', ...mono }}>{p}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'inline-block', padding: '3px 8px', background: TC.amber + '15', border: `1px solid ${TC.amber}40`, marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: TC.amber, fontWeight: 600, ...mono }}>Y = 1.62·X + 0.42</span>
          </div>
          <svg width={chartW} height={chartH} style={{ display: 'block' }}>
            {[-2, -1, 0, 1, 2].map(v => <line key={`gx${v}`} x1={toX(v)} y1={padT} x2={toX(v)} y2={chartH - padB} stroke={TC.borderS} strokeWidth="0.5" />)}
            {[-2, 0, 2, 4].map(v => <line key={`gy${v}`} x1={padL} y1={toY(v)} x2={chartW - padR} y2={toY(v)} stroke={TC.borderS} strokeWidth="0.5" />)}
            {[-2, -1, 0, 1, 2].map(v => <text key={`lx${v}`} x={toX(v)} y={chartH - 4} fill={TC.muted} fontSize="7" textAnchor="middle" fontFamily="JetBrains Mono">{v}%</text>)}
            {[-2, 0, 2, 4].map(v => <text key={`ly${v}`} x={padL - 4} y={toY(v) + 3} fill={TC.muted} fontSize="7" textAnchor="end" fontFamily="JetBrains Mono">{v}%</text>)}
            <line x1={toX(0)} y1={padT} x2={toX(0)} y2={chartH - padB} stroke={TC.borderM} strokeWidth="1" />
            <line x1={padL} y1={toY(0)} x2={chartW - padR} y2={toY(0)} stroke={TC.borderM} strokeWidth="1" />
            <line x1={toX(xMin)} y1={toY(1.62 * xMin + 0.42)} x2={toX(xMax)} y2={toY(1.62 * xMax + 0.42)} stroke={TC.red} strokeWidth="1.5" />
            {scatterPts.map((p, i) => (
              <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r={3} fill={TC.amber} opacity={0.85} />
            ))}
            <text x={chartW / 2} y={chartH} fill={TC.secondary} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono">{property.submarket || 'Submarket'} Rent Growth (%)</text>
            <text x={10} y={chartH / 2} fill={TC.secondary} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" transform={`rotate(-90, 10, ${chartH / 2})`}>{property.name} Rent Growth (%)</text>
          </svg>
        </div>

        {/* Stats panel */}
        <div style={{ width: 220, background: TC.blueBg, padding: 14, flexShrink: 0 }}>
          {stats.map((s, i) => {
            if (!s.l && !s.v) return <div key={i} style={{ height: 8 }} />;
            const isHeader = s.l === 'Y =' || s.l === 'X =';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i > 1 ? `1px solid ${TC.borderS}` : 'none' }}>
                <span style={{ fontSize: 9, color: isHeader ? TC.cyan : TC.secondary, fontWeight: isHeader ? 600 : 400, ...mono }}>{s.l}</span>
                <span style={{ fontSize: isHeader ? 9 : 10, fontWeight: 600, color: isHeader ? TC.green : TC.primary, ...mono, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.v}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Normalized Overlay bottom */}
      <div style={{ background: TC.panel, padding: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 1, color: TC.muted, marginBottom: 8, ...mono }}>NORMALIZED RENT OVERLAY (Base 100) · Monthly 1Y</div>
        <svg width="100%" height={60} viewBox="0 0 400 60" preserveAspectRatio="none" style={{ display: 'block' }}>
          <polyline points={[100, 101.7, 103.4, 105.1, 105.9, 107.2, 108.5, 110.2, 111.9, 113.6, 115.3, 117.4].map((v, i) => `${(i / 11) * 396 + 2},${55 - ((v - 98) / 22) * 50}`).join(' ')} fill="none" stroke={TC.amber} strokeWidth="2" />
          <polyline points={[100, 100.8, 101.6, 102.6, 103.2, 104.2, 105.2, 106.2, 107.2, 108.2, 109.2, 110.4].map((v, i) => `${(i / 11) * 396 + 2},${55 - ((v - 98) / 22) * 50}`).join(' ')} fill="none" stroke={TC.muted} strokeWidth="1" />
        </svg>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 2, background: TC.amber }} />
            <span style={{ fontSize: 8, color: TC.amber, ...mono }}>{property.name} (Base 100)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 2, background: TC.muted }} />
            <span style={{ fontSize: 8, color: TC.muted, ...mono }}>{property.submarket || 'Submarket'} Avg (Base 100)</span>
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div style={{ background: TC.amber + '08', borderLeft: `3px solid ${TC.amber}`, padding: 12 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: TC.amber, ...mono }}>INTERPRETATION: </span>
        <span style={{ fontSize: 10, color: TC.secondary, ...sans }}>
          Beta of 1.62 means <strong style={{ color: TC.primary }}>{property.name}</strong> amplifies submarket rent movements by 62% — when {property.submarket || 'submarket'} rents rise 1%, this property rises 1.62%.
          Alpha of +0.42% indicates persistent outperformance vs submarket.
          R² of 0.82 = strong correlation — this property tracks its submarket closely.
          <span style={{ color: TC.green, fontWeight: 600 }}> High beta + positive alpha = aggressive growth asset.</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PROPERTY CARD PANEL
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: 'overview',  label: '[1] Overview' },
  { id: 'relvalue',  label: '[4] Rel Value' },
  { id: 'relindex',  label: '[3] Rel Index' },
];

export function PropertyCardPanel({ property, onClose, sourceLabel = 'Property List' }: PropertyCardPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [news, setNews] = useState<NewsItem[]>(DEFAULT_NEWS);
  const [comps, setComps] = useState<CompRow[]>(DEFAULT_COMPS);
  const [jediScore, setJediScore] = useState<number>(property.jediScore || property.pcsScore || 86);

  const score = jediScore;
  const scoreColor = score >= 80 ? TC.green : score >= 65 ? TC.amber : TC.red;

  // Attempt to fetch real data when we have an ID
  useEffect(() => {
    if (!property.id) return;
    const token = localStorage.getItem('auth_token') || '';
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch news events for this area
    apiClient.get('/api/v1/news/events', { headers, params: { limit: 5 } })
      .then(r => {
        const items = (r.data?.events || r.data || []).slice(0, 5);
        if (items.length > 0) {
          setNews(items.map((e: any) => ({
            time: e.publishedAt ? new Date(e.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
            src: e.source || 'NEWS',
            headline: e.headline || e.title || '',
            impact: e.impact_type ? `+${e.impact_type.toUpperCase()}` : '—',
            pts: e.impact_score ? (e.impact_score > 0 ? `+${e.impact_score.toFixed(1)}` : e.impact_score.toFixed(1)) : '—',
          })));
        }
      })
      .catch(() => {});
  }, [property.id]);

  // Keyboard handling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '1') setActiveTab('overview');
      if (e.key === '3') setActiveTab('relindex');
      if (e.key === '4') setActiveTab('relvalue');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const displayRent = property.avgRent ? `$${property.avgRent.toLocaleString()}` : '—';
  const displayOcc  = property.occupancy != null ? `${property.occupancy.toFixed(1)}%` : '—';
  const displayCap  = property.capRate != null ? `${(property.capRate * 100).toFixed(1)}%` : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: TC.bg, color: TC.primary, overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { scrollbar-width: thin; scrollbar-color: ${TC.borderM} ${TC.bg}; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${TC.bg}; }
        ::-webkit-scrollbar-thumb { background: ${TC.borderM}; border-radius: 2px; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 22, padding: '0 10px', background: TC.topBar, borderBottom: `1px solid ${TC.borderS}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: TC.amber, letterSpacing: 2, ...mono }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: TC.muted }}>|</span>
          <span style={{ fontSize: 8, color: TC.secondary, ...mono }}>PROPERTY CARD</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 8, color: TC.muted, ...mono }}>{sourceLabel} → Property Detail</span>
          <button onClick={onClose} style={{ fontSize: 10, fontWeight: 700, color: TC.muted, background: 'none', border: `1px solid ${TC.borderS}`, padding: '1px 8px', cursor: 'pointer', ...mono }}>✕ ESC</button>
        </div>
      </div>

      {/* ── PROPERTY QUOTE BAR ── */}
      <div style={{ padding: '5px 10px', background: TC.panel, borderBottom: `1px solid ${TC.borderM}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: TC.amberBright, ...sans }}>{property.name}</span>
        {property.class && <Badge label={`CLASS ${property.class}`} color={TC.cyan} />}
        {property.type && <Badge label={property.type.toUpperCase()} color={TC.purple} />}
        {property.strategy && <Badge label={property.strategy} color={TC.green} />}

        <div style={{ flex: 1, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {[
            { l: 'RENT',   v: displayRent },
            { l: 'OCC',    v: displayOcc },
            { l: 'CAP',    v: displayCap },
            { l: 'UNITS',  v: property.units ? String(property.units) : '—' },
            { l: 'BUILT',  v: property.yearBuilt ? String(property.yearBuilt) : '—' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 7, color: TC.muted, letterSpacing: 1, ...mono }}>{m.l}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: TC.primary, ...mono }}>{m.v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 7, color: TC.muted, letterSpacing: 1, ...mono }}>JEDI</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: scoreColor, ...mono }}>{score}</span>
          </div>
          {property.address && (
            <span style={{ fontSize: 9, color: TC.secondary, ...mono }}>{property.address}</span>
          )}
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', height: 26, background: TC.header, borderBottom: `1px solid ${TC.borderM}`, flexShrink: 0, gap: 1, padding: '0 4px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ height: '100%', padding: '0 14px', fontSize: 9, fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? TC.amber : TC.secondary, background: activeTab === tab.id ? TC.active : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${TC.amber}` : '2px solid transparent', cursor: 'pointer', letterSpacing: 0.5, ...mono }}>
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {property.submarket && (
          <span style={{ fontSize: 8, color: TC.muted, marginRight: 10, ...mono }}>{property.submarket}{property.msa ? ` · ${property.msa}` : ''}</span>
        )}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'overview'  && <OverviewTab property={property} news={news} jediScore={jediScore} />}
        {activeTab === 'relvalue'  && <RelValueTab property={property} comps={comps} />}
        {activeTab === 'relindex'  && <RelIndexTab property={property} />}
      </div>
    </div>
  );
}

export default PropertyCardPanel;
