/**
 * MSACapitalOwnersTab — Combined Owners + Capital Markets intelligence
 * Sub-toggle: [OWNERS] buy/sell signals, portfolios, land positions
 *             [MARKETS] volume, cap rates, debt, recent deals, buyer composition
 */

import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Building2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { DataTable } from '../../TerminalLayouts';
import { TerminalSection } from '../../TerminalLayouts';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { scoreColor } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';
import { MSAData } from '../../MSATerminal';
import { apiClient } from '../../../../api/client';

interface Props {
  msaId: string;
  msa: MSAData | null;
  onSelectProperty?: (propertyId: string, propertyName?: string) => void;
}

type SubView = 'owners' | 'markets';
type SignalType = 'BUY' | 'SELL' | 'SELL?' | 'HOLD';
type OwnerType = 'REIT' | 'Private Equity' | 'Family Office' | 'Syndicator' | 'Developer' | 'Institution';

interface Owner {
  id: string;
  name: string;
  type: OwnerType;
  propertyCount: number;
  totalUnits: number;
  avgHoldPeriod: number;
  avgPcsPercentile: number;
  signal: SignalType;
  signalConfidence: number;
  markets: string[];
  recentActivity: string;
  landPositions?: { parcel: string; acres: number; capacity: string; probability: string; status: string }[];
}

interface OwnerProperty {
  name: string; submarket: string; units: number; yearBuilt: number; class: string;
  purchaseDate: string; holdYears: number; pcsRank: number; pcsPercentile: number;
  debtMaturity: string; motivation: number;
}

const SIGNAL_STYLES: Record<SignalType, { bg: string; text: string }> = {
  'BUY':   { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e' },
  'SELL':  { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
  'SELL?': { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
  'HOLD':  { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
};

const OWNER_TYPE_COLORS: Record<OwnerType, string> = {
  'REIT':           '#3b82f6',
  'Private Equity': '#8b5cf6',
  'Family Office':  '#14b8a6',
  'Syndicator':     '#f97316',
  'Developer':      '#ec4899',
  'Institution':    '#6b7280',
};

const MOCK_OWNERS: Owner[] = [
  { id: 'greystone', name: 'Greystone Capital Partners', type: 'Private Equity', propertyCount: 8, totalUnits: 2240, avgHoldPeriod: 5.8, avgPcsPercentile: 31, signal: 'SELL', signalConfidence: 84, markets: ['Atlanta', 'Charlotte', 'Nashville'], recentActivity: 'Sold 2 assets in Q4 2025', landPositions: [{ parcel: 'Parcel A — Midtown ATL', acres: 4.2, capacity: '380 units', probability: '72%', status: 'Entitled' }, { parcel: 'Parcel B — SouthEnd CLT', acres: 2.8, capacity: '220 units', probability: '58%', status: 'Pre-zoning' }] },
  { id: 'cortland', name: 'Cortland Partners', type: 'REIT', propertyCount: 12, totalUnits: 3840, avgHoldPeriod: 4.2, avgPcsPercentile: 68, signal: 'BUY', signalConfidence: 76, markets: ['Atlanta', 'Dallas', 'Denver', 'Phoenix'], recentActivity: 'Acquired 3 assets YTD 2026' },
  { id: 'trammell', name: 'Trammell Crow Residential', type: 'Developer', propertyCount: 5, totalUnits: 1680, avgHoldPeriod: 3.1, avgPcsPercentile: 82, signal: 'SELL?', signalConfidence: 62, markets: ['Atlanta', 'Austin', 'Nashville'], recentActivity: 'Stabilizing 2 new developments' },
  { id: 'peachtree', name: 'Peachtree Residential', type: 'Syndicator', propertyCount: 6, totalUnits: 1120, avgHoldPeriod: 6.4, avgPcsPercentile: 28, signal: 'SELL', signalConfidence: 91, markets: ['Atlanta'], recentActivity: 'Debt maturing Q2-Q3 2026' },
  { id: 'starwood', name: 'Starwood Capital', type: 'Institution', propertyCount: 4, totalUnits: 1480, avgHoldPeriod: 7.2, avgPcsPercentile: 45, signal: 'HOLD', signalConfidence: 58, markets: ['Atlanta', 'Tampa', 'Orlando'], recentActivity: 'No recent transactions' },
  { id: 'bridge', name: 'Bridge Investment Group', type: 'Private Equity', propertyCount: 7, totalUnits: 2080, avgHoldPeriod: 4.8, avgPcsPercentile: 54, signal: 'BUY', signalConfidence: 68, markets: ['Atlanta', 'Charlotte', 'Raleigh'], recentActivity: 'Active acquirer, closed 2 deals' },
];

const MOCK_PORTFOLIO: Record<string, OwnerProperty[]> = {
  'greystone': [
    { name: 'Pines at Midtown', submarket: 'Midtown', units: 180, yearBuilt: 1992, class: 'B', purchaseDate: 'Mar 2019', holdYears: 6.9, pcsRank: 3, pcsPercentile: 31, debtMaturity: 'Q3 2026', motivation: 78 },
    { name: 'Decatur Station', submarket: 'Decatur', units: 156, yearBuilt: 1985, class: 'C+', purchaseDate: 'Jun 2020', holdYears: 5.7, pcsRank: 12, pcsPercentile: 28, debtMaturity: 'Q4 2026', motivation: 72 },
    { name: 'Sandy Springs Gardens', submarket: 'Sandy Springs', units: 240, yearBuilt: 1998, class: 'B+', purchaseDate: 'Sep 2018', holdYears: 7.4, pcsRank: 8, pcsPercentile: 35, debtMaturity: 'Q1 2026', motivation: 85 },
  ],
  'cortland': [
    { name: 'Buckhead Grand', submarket: 'Buckhead', units: 320, yearBuilt: 2020, class: 'A', purchaseDate: 'Jan 2023', holdYears: 3.1, pcsRank: 2, pcsPercentile: 92, debtMaturity: 'Q2 2028', motivation: 22 },
    { name: 'Midtown Tower', submarket: 'Midtown', units: 280, yearBuilt: 2019, class: 'A', purchaseDate: 'Apr 2022', holdYears: 3.9, pcsRank: 5, pcsPercentile: 78, debtMaturity: 'Q4 2027', motivation: 18 },
  ],
};

export const MSACapitalOwnersTab: React.FC<Props> = ({ msaId, msa, onSelectProperty }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const [subView, setSubView] = useState<SubView>('owners');
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('All');
  const [signalFilter, setSignalFilter] = useState('All');
  const [liveCapitalData, setLiveCapitalData] = useState<any>(null);
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  useEffect(() => {
    apiClient.get<any>('/georgia/owners?state=GA')
      .then(res => { if (res.data.success) setLiveCapitalData(res.data); })
      .catch(() => {});
  }, []);

  const ownerTypes = ['All', ...Array.from(new Set(MOCK_OWNERS.map(o => o.type)))];
  const signals: string[] = ['All', 'BUY', 'SELL', 'SELL?', 'HOLD'];

  const filteredOwners = useMemo(() => {
    return MOCK_OWNERS.filter(o => {
      if (ownerTypeFilter !== 'All' && o.type !== ownerTypeFilter) return false;
      if (signalFilter !== 'All' && o.signal !== signalFilter) return false;
      return true;
    }).sort((a, b) => b.signalConfidence - a.signalConfidence);
  }, [ownerTypeFilter, signalFilter]);

  const stats = useMemo(() => ({
    totalOwners: MOCK_OWNERS.length,
    totalProperties: MOCK_OWNERS.reduce((s, o) => s + o.propertyCount, 0),
    totalUnits: MOCK_OWNERS.reduce((s, o) => s + o.totalUnits, 0),
    likelySellers: MOCK_OWNERS.filter(o => o.signal === 'SELL' || o.signal === 'SELL?').length,
    likelyBuyers: MOCK_OWNERS.filter(o => o.signal === 'BUY').length,
  }), []);

  const volumeData: ChartDataPoint[] = [
    { date: 'Q1 24', volume: 850, capRate: 5.4 },
    { date: 'Q2 24', volume: 1100, capRate: 5.3 },
    { date: 'Q3 24', volume: 980, capRate: 5.2 },
    { date: 'Q4 24', volume: 1270, capRate: 5.2 },
    { date: 'Q1 25', volume: 920, capRate: 5.3 },
  ];

  const capRateByClass = [
    { class: 'A',  current: 4.6, prior: 4.8, change: -20, spread: 125 },
    { class: 'B+', current: 5.1, prior: 5.4, change: -30, spread: 175 },
    { class: 'B',  current: 5.5, prior: 5.8, change: -30, spread: 215 },
    { class: 'B-', current: 5.9, prior: 6.2, change: -30, spread: 255 },
    { class: 'C',  current: 6.4, prior: 6.6, change: -20, spread: 305 },
  ];

  const debtMarketData = [
    { lender: 'Agency (Freddie)', rate: '5.85%', ltv: '75%', term: '10yr', spread: '+165', status: 'Active' },
    { lender: 'Agency (Fannie)',  rate: '5.90%', ltv: '75%', term: '10yr', spread: '+170', status: 'Active' },
    { lender: 'CMBS',            rate: '6.25%', ltv: '70%', term: '10yr', spread: '+205', status: 'Selective' },
    { lender: 'Life Co',         rate: '5.70%', ltv: '65%', term:  '7yr', spread: '+145', status: 'Active' },
    { lender: 'Bank',            rate: '6.50%', ltv: '65%', term:  '5yr', spread: '+225', status: 'Tight' },
    { lender: 'Bridge',          rate: '7.25%', ltv: '80%', term:  '3yr', spread: '+300', status: 'Active' },
  ];

  const buyerActivity = [
    { type: 'Private Equity', pctVolume: 34, dealCount: 43, avgSize: '$62M', trend: 'up' },
    { type: 'REIT',           pctVolume: 22, dealCount: 28, avgSize: '$85M', trend: 'up' },
    { type: 'Institution',    pctVolume: 18, dealCount: 12, avgSize: '$142M', trend: 'flat' },
    { type: 'Family Office',  pctVolume: 14, dealCount: 26, avgSize: '$38M', trend: 'down' },
    { type: 'Syndicator',     pctVolume:  8, dealCount: 14, avgSize: '$22M', trend: 'down' },
    { type: 'Developer',      pctVolume:  4, dealCount:  4, avgSize: '$48M', trend: 'flat' },
  ];

  const displayDeals = useMemo(() => {
    if (liveCapitalData?.recentDeals?.length > 0) {
      return liveCapitalData.recentDeals.map((d: any) => ({
        property: d.property,
        units: d.units,
        price: d.price > 0 ? parseFloat((d.price / 1_000_000).toFixed(1)) : null,
        ppu: d.ppu ? parseFloat((d.ppu / 1000).toFixed(1)) : null,
        cap: d.cap ? parseFloat(d.cap.toFixed(2)) : null,
        buyer: d.buyer || 'Unknown',
        date: d.date || '—',
        isLive: true,
      }));
    }
    return [
      { property: 'Camden Paces Portfolio',      units: 1240, price: 285,  ppu: 230, cap: 4.8, buyer: 'Blackstone', date: 'Mar 25', isLive: false },
      { property: 'Greystar Midtown Collection', units:  890, price: 198,  ppu: 222, cap: 5.0, buyer: 'Invesco',    date: 'Feb 25', isLive: false },
      { property: 'The Metropolitan at Phipps',  units:  320, price:  85,  ppu: 266, cap: 4.8, buyer: 'Blackstone', date: 'Feb 25', isLive: false },
      { property: 'Alexan Buckhead',             units:  290, price:  62,  ppu: 214, cap: 5.5, buyer: 'Greystar',   date: 'Nov 24', isLive: false },
    ];
  }, [liveCapitalData]);

  const SubToggle = () => (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['owners', 'markets'] as SubView[]).map(v => (
        <button
          key={v}
          onClick={() => setSubView(v)}
          style={{
            padding: '5px 18px',
            background: subView === v ? BT.accent.blue : BT.bg.elevated,
            color: subView === v ? '#fff' : BT.text.secondary,
            border: `1px solid ${subView === v ? BT.accent.blue : BT.border.medium}`,
            borderRadius: 2,
            fontSize: 11,
            fontWeight: subView === v ? 700 : 400,
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            transition: 'background 0.12s',
          }}
        >
          {v === 'owners' ? 'Owners & Signals' : 'Capital Markets'}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Capital & Ownership Intelligence
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            {stats.totalOwners} active owners · {stats.totalProperties} properties · {stats.totalUnits.toLocaleString()} units
          </span>
        </div>
        <SubToggle />
      </div>

      {/* ── Shared KPI Bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          { label: 'LIKELY SELLERS', value: stats.likelySellers, color: SIGNAL_STYLES.SELL.text, sub: `${MOCK_OWNERS.filter(o => o.signal === 'SELL').reduce((s, o) => s + o.totalUnits, 0).toLocaleString()} units` },
          { label: 'ACTIVE BUYERS',  value: stats.likelyBuyers,  color: SIGNAL_STYLES.BUY.text,  sub: 'Strong appetite' },
          { label: 'AVG HOLD',       value: '5.2yr',             color: BT.text.primary,          sub: 'Market avg' },
          { label: 'YTD VOLUME',     value: `$${msa ? (msa.transactionVolume / 1e9).toFixed(1) : '2.8'}B`, color: BT.text.green, sub: '+12% vs LY' },
          { label: 'AVG CAP RATE',   value: `${msa?.avgCapRate ?? 5.2}%`, color: BT.text.cyan,   sub: '-20 bps vs LY' },
          { label: 'AVG $/UNIT',     value: '$228K',             color: BT.text.primary,          sub: '+5% vs LY' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '10px 14px',
            background: BT.bg.card,
            border: `1px solid ${BT.border.subtle}`,
          }}>
            <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 2 }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════ OWNERS VIEW ══════════════════════ */}
      {subView === 'owners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: BT.text.muted }}>Type:</span>
              <select
                value={ownerTypeFilter}
                onChange={e => setOwnerTypeFilter(e.target.value)}
                style={{ padding: '5px 10px', background: BT.bg.elevated, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, fontSize: 11 }}
              >
                {ownerTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: BT.text.muted }}>Signal:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {signals.map(s => {
                  const ss = s !== 'All' ? SIGNAL_STYLES[s as SignalType] : null;
                  const isActive = signalFilter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setSignalFilter(s)}
                      style={{
                        padding: '4px 10px',
                        background: isActive ? (ss?.bg || BT.accent.blue) : BT.bg.elevated,
                        color: isActive ? (ss?.text || '#fff') : BT.text.secondary,
                        border: 'none',
                        borderRadius: 0,
                        fontSize: 11,
                        fontWeight: isActive ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Owners Table */}
          <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
            <DataTable>
              <thead>
                <tr style={{ background: BT.bg.elevated }}>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', minWidth: 200 }}>Owner</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Type</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Signal</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Props</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Avg Hold</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>PCS %ile</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Recent Activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwners.map(owner => {
                  const ss = SIGNAL_STYLES[owner.signal];
                  const isExpanded = expandedOwner === owner.id;
                  const portfolio = MOCK_PORTFOLIO[owner.id] || [];
                  return (
                    <React.Fragment key={owner.id}>
                      <tr
                        style={{ borderBottom: `1px solid ${BT.border.subtle}`, cursor: 'pointer', background: isExpanded ? BT.bg.elevated : 'transparent' }}
                        onClick={() => setExpandedOwner(isExpanded ? null : owner.id)}
                      >
                        <td style={{ ...terminalStyles.tableCell }}>
                          <div style={{ fontWeight: 600 }}>{owner.name}</div>
                          <div style={{ fontSize: 10, color: BT.text.muted }}>{owner.markets.join(', ')}</div>
                        </td>
                        <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                          <span style={{ padding: '3px 8px', background: `${OWNER_TYPE_COLORS[owner.type]}20`, color: OWNER_TYPE_COLORS[owner.type], fontSize: 10, fontWeight: 600 }}>
                            {owner.type}
                          </span>
                        </td>
                        <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ padding: '4px 10px', background: ss.bg, color: ss.text, fontSize: 11, fontWeight: 700 }}>
                              {owner.signal}
                            </span>
                            <span style={{ fontSize: 9, color: BT.text.muted }}>{owner.signalConfidence}% conf</span>
                          </div>
                        </td>
                        <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontWeight: 600 }}>{owner.propertyCount}</td>
                        <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{owner.totalUnits.toLocaleString()}</td>
                        <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{owner.avgHoldPeriod.toFixed(1)}yr</td>
                        <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                          <span style={{ color: owner.avgPcsPercentile < 40 ? BT.accent.red : owner.avgPcsPercentile > 70 ? BT.text.green : BT.text.primary, fontWeight: 600 }}>
                            {owner.avgPcsPercentile}%
                          </span>
                        </td>
                        <td style={{ ...terminalStyles.tableCell, color: BT.text.muted, fontSize: 11 }}>{owner.recentActivity}</td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0 }}>
                            <div style={{ padding: 20, background: BT.bg.card, borderBottom: `2px solid ${ss.text}` }}>
                              <div style={{ display: 'flex', gap: 24 }}>
                                <div style={{ flex: 2 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary, marginBottom: 12 }}>
                                    Portfolio ({portfolio.length} properties)
                                  </div>
                                  {portfolio.length > 0 ? (
                                    <DataTable>
                                      <thead>
                                        <tr>
                                          <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'left' }}>Property</th>
                                          <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>Units</th>
                                          <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>Hold</th>
                                          <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>PCS</th>
                                          <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'center' }}>Debt Mat.</th>
                                          <th style={{ ...terminalStyles.tableHeader, fontSize: 10, textAlign: 'right' }}>Motiv.</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {portfolio.map((prop, i) => (
                                          <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                                            <td style={{ ...terminalStyles.tableCell, fontSize: 11 }}>
                                              <div style={{ fontWeight: 500 }}>{prop.name}</div>
                                              <div style={{ fontSize: 9, color: BT.text.muted }}>{prop.submarket} · {prop.class} · {prop.yearBuilt}</div>
                                            </td>
                                            <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>{prop.units}</td>
                                            <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>{prop.holdYears}yr</td>
                                            <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>
                                              <span style={{ color: prop.pcsPercentile < 40 ? BT.accent.red : BT.text.primary }}>#{prop.pcsRank}</span>
                                            </td>
                                            <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'center', color: BT.accent.amber }}>{prop.debtMaturity}</td>
                                            <td style={{ ...terminalStyles.tableCell, fontSize: 11, textAlign: 'right' }}>
                                              <span style={{ padding: '2px 6px', background: prop.motivation > 70 ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)', color: prop.motivation > 70 ? BT.accent.red : BT.text.muted, fontWeight: 600 }}>
                                                {prop.motivation}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </DataTable>
                                  ) : (
                                    <div style={{ color: BT.text.muted, fontSize: 11 }}>Portfolio details not available</div>
                                  )}
                                </div>

                                {owner.landPositions && owner.landPositions.length > 0 && (
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: BT.text.violet, marginBottom: 12 }}>Land Positions ★</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {owner.landPositions.map((land, i) => (
                                        <div key={i} style={{ padding: 10, background: 'rgba(139,92,246,0.1)', borderLeft: `3px solid ${BT.text.violet}` }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>{land.parcel}</div>
                                          <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>{land.acres} acres · {land.capacity}</div>
                                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                            <span style={{ fontSize: 9, padding: '2px 6px', background: BT.bg.elevated, color: BT.text.violet }}>DC-06: {land.probability}</span>
                                            <span style={{ fontSize: 9, padding: '2px 6px', background: BT.bg.elevated, color: BT.text.muted }}>{land.status}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {/* ══════════════════════ MARKETS VIEW ══════════════════════ */}
      {subView === 'markets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <TerminalChart
            title="Transaction Volume ($M) & Cap Rate Trend"
            data={volumeData}
            series={[{ key: 'volume', name: 'Volume ($M)', color: BT.text.green, data: [] }]}
            height={180}
            valueFormatter={v => `$${v}M`}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TerminalSection title="Cap Rate by Class">
              <DataTable>
                <thead>
                  <tr>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Class</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Current</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Prior Yr</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Chg (bps)</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Spread</th>
                  </tr>
                </thead>
                <tbody>
                  {capRateByClass.map(row => (
                    <tr key={row.class} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>{row.class}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan }}>{row.current.toFixed(1)}%</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.muted }}>{row.prior.toFixed(1)}%</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green }}>{row.change}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.amber }}>+{row.spread}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TerminalSection>

            <TerminalSection title="Buyer Composition">
              <DataTable>
                <thead>
                  <tr>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Type</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>% Vol</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Deals</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Avg Size</th>
                    <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {buyerActivity.map(row => (
                    <tr key={row.type} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.type}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <div style={{ width: 40, height: 6, background: BT.bg.elevated, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${row.pctVolume * 2.5}%`, background: BT.accent.blue }} />
                          </div>
                          <span>{row.pctVolume}%</span>
                        </div>
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{row.dealCount}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green }}>{row.avgSize}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        <span style={{ color: row.trend === 'up' ? BT.text.green : row.trend === 'down' ? BT.accent.red : BT.text.muted, fontWeight: 600 }}>
                          {row.trend === 'up' ? '▲' : row.trend === 'down' ? '▼' : '▬'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TerminalSection>
          </div>

          <TerminalSection title="Debt Market Conditions" icon={<DollarSign size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
            <DataTable>
              <thead>
                <tr>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Lender Type</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Rate</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Max LTV</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Term</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Spread</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Availability</th>
                </tr>
              </thead>
              <tbody>
                {debtMarketData.map(row => (
                  <tr key={row.lender} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.lender}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan }}>{row.rate}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{row.ltv}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center', color: BT.text.muted }}>{row.term}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.amber }}>{row.spread}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: row.status === 'Active' ? `${BT.text.green}22` : row.status === 'Tight' ? `${BT.accent.red}22` : `${BT.text.amber}22`,
                        color: row.status === 'Active' ? BT.text.green : row.status === 'Tight' ? BT.accent.red : BT.text.amber,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TerminalSection>

          <TerminalSection
            title={`Recent Transactions · ${liveCapitalData ? `${displayDeals.length} from county records` : 'editorial demo'}`}
            icon={<Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
          >
            <DataTable>
              <thead>
                <tr>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Property</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Price</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>$/Unit</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Cap</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Buyer / Grantee</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayDeals.map((deal, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ ...terminalStyles.tableCell, fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.property}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{deal.units > 0 ? deal.units.toLocaleString() : '—'}</td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                      {deal.price != null ? `$${deal.price}M` : '—'}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                      {deal.ppu != null ? `$${deal.ppu}K` : '—'}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan }}>
                      {deal.cap != null ? `${deal.cap}%` : '—'}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, color: deal.buyer === 'Unknown' ? BT.text.muted : BT.text.secondary, fontStyle: deal.buyer === 'Unknown' ? 'italic' : 'normal' }}>
                      {deal.buyer}
                    </td>
                    <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.muted }}>{deal.date}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TerminalSection>

          {commentary?.signalCommentary?.capital_sentiment && (
            <div style={{ ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="position" commentary={commentary.signalCommentary.capital_sentiment} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSACapitalOwnersTab;
