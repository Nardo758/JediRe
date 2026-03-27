import React, { useState, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { DataTable } from '../../TerminalLayouts';
import { SIGNAL_GROUPS, SignalGroupId, BT_SIGNAL_COLORS, ALL_OUTPUTS, scoreColor } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import {
  MarketNarrative,
  InvestmentThesis,
  RiskOpportunity,
  PeerContext,
  SupplyNarrative,
  StrategyScoreBadge,
} from '../../commentary';

interface MSAOverviewTabProps {
  msaId: string;
  msa: any;
}

type SignalTab = 'demand' | 'supply' | 'momentum' | 'traffic' | 'position' | 'risk';

const SIGNAL_TABS: { key: SignalTab; label: string; color: string }[] = [
  { key: 'demand', label: 'DEMAND', color: BT.text.cyan },
  { key: 'supply', label: 'SUPPLY', color: BT.text.green },
  { key: 'momentum', label: 'MOMENTUM', color: BT.text.amber },
  { key: 'traffic', label: 'TRAFFIC', color: BT.text.violet },
  { key: 'position', label: 'POSITION', color: BT.text.magenta },
  { key: 'risk', label: 'RISK', color: BT.text.red },
];

interface ChartSeries {
  name: string;
  data: number[];
  color: string;
}

interface ChartDataSet {
  title: string;
  labels: string[];
  series: ChartSeries[];
}

interface MetricRow {
  sig: string;
  name: string;
  val: string;
  chg: string;
  w: string;
  pts: string;
  gate: 'pass' | 'soft-fail' | 'fail';
  live?: boolean;
}

interface MarketAlert {
  date: string;
  title: string;
  impact: string;
  severity: 'high' | 'medium' | 'low';
}

interface SupplyMetric {
  id: string;
  label: string;
  value: string;
  warning?: boolean;
}

const CHART_DATA: Record<SignalTab, ChartDataSet> = {
  demand: {
    title: 'Demand Signals',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Pop Growth', data: [1.2, 1.3, 1.4, 1.4, 1.5, 1.6, 1.7, 1.7, 1.8], color: BT.text.cyan },
      { name: 'Emp Growth', data: [1.8, 1.9, 2.0, 2.0, 2.1, 2.2, 2.3, 2.3, 2.4], color: BT.text.green },
      { name: 'Income Growth', data: [2.8, 2.9, 3.0, 3.0, 3.1, 3.1, 3.1, 3.2, 3.2], color: BT.text.amber },
    ],
  },
  supply: {
    title: 'Supply Pipeline',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Pipeline', data: [12.0, 13.5, 14.2, 15.1, 16.0, 16.8, 17.4, 18.0, 18.4], color: BT.text.red },
      { name: 'Absorption', data: [82, 83, 84, 85, 85, 86, 87, 87, 88], color: BT.text.green },
      { name: 'Occupancy', data: [95.8, 95.4, 95.2, 95.0, 94.8, 94.6, 94.4, 94.3, 94.2], color: BT.text.cyan },
    ],
  },
  momentum: {
    title: 'Momentum Indicators',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Rent Growth', data: [2.1, 2.5, 2.8, 3.0, 3.2, 3.5, 3.7, 3.9, 4.1], color: BT.text.cyan },
      { name: 'NOI Growth', data: [2.4, 2.6, 2.8, 3.0, 3.1, 3.3, 3.5, 3.6, 3.8], color: BT.text.green },
      { name: 'Cap Rate', data: [5.8, 5.7, 5.6, 5.5, 5.4, 5.3, 5.3, 5.2, 5.2], color: BT.text.amber },
    ],
  },
  traffic: {
    title: 'Traffic & Engagement',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Traffic Index', data: [58, 60, 62, 64, 66, 68, 70, 72, 74], color: BT.text.violet },
      { name: 'Search Volume', data: [44, 48, 51, 54, 56, 58, 60, 61, 62], color: BT.text.cyan },
    ],
  },
  position: {
    title: 'Positional Metrics',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Walk Score', data: [55, 56, 57, 58, 59, 59, 60, 61, 62], color: BT.text.magenta },
      { name: 'Dev Capacity', data: [0.40, 0.39, 0.38, 0.37, 0.36, 0.36, 0.35, 0.35, 0.34], color: BT.text.amber },
    ],
  },
  risk: {
    title: 'Risk Factors',
    labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26'],
    series: [
      { name: 'Permit Chg', data: [-2, -3, -4, -5, -6, -8, -9, -10, -12], color: BT.text.red },
      { name: 'Zoning Util', data: [72, 73, 74, 74, 75, 76, 76, 77, 78], color: BT.text.amber },
    ],
  },
};

const TABLE_DATA: Record<SignalTab, MetricRow[]> = {
  demand: [
    { sig: 'D-12', name: 'Population Growth', val: '6.2M', chg: '+1.8%', w: '8%', pts: '+8', gate: 'pass' },
    { sig: 'D-01', name: 'Employment Growth', val: '+2.4%', chg: '+0.3%', w: '12%', pts: '+12', gate: 'pass' },
    { sig: 'D-03', name: 'Job-Housing Ratio', val: '1.24', chg: '+0.06', w: '6%', pts: '+6', gate: 'pass' },
    { sig: 'D-05', name: 'Median Income', val: '$72.4K', chg: '+3.2%', w: '5%', pts: '+5', gate: 'pass' },
  ],
  supply: [
    { sig: 'S-01', name: 'Pipeline Units', val: '18,400', chg: '+22%', w: '6%', pts: '-3', gate: 'soft-fail' },
    { sig: 'S-03', name: 'Occupancy Rate', val: '94.2%', chg: '-0.3%', w: '8%', pts: '+6', gate: 'pass' },
    { sig: 'S-05', name: 'Absorption Rate', val: '88%', chg: '+2.1%', w: '7%', pts: '+7', gate: 'pass' },
    { sig: 'S-06', name: 'Permit Momentum', val: '-12%', chg: '-8%', w: '4%', pts: '+4', gate: 'pass' },
  ],
  momentum: [
    { sig: 'M-01', name: 'Rent Growth', val: '+4.1%', chg: '+0.9%', w: '10%', pts: '+9', gate: 'pass', live: true },
    { sig: 'M-03', name: 'NOI Growth', val: '+3.8%', chg: '+0.4%', w: '6%', pts: '+6', gate: 'pass' },
    { sig: 'M-04', name: 'Cap Rate', val: '5.2%', chg: '-0.3%', w: '5%', pts: '+5', gate: 'pass' },
    { sig: 'M-05', name: 'Avg Rent', val: '$1,487', chg: '+4.8%', w: '4%', pts: '+4', gate: 'pass', live: true },
  ],
  traffic: [
    { sig: 'T-01', name: 'Traffic Index', val: '74', chg: '+6.2%', w: '5%', pts: '+4', gate: 'pass' },
    { sig: 'T-03', name: 'Traffic Growth', val: '+6.2%', chg: '+1.1%', w: '4%', pts: '+4', gate: 'pass' },
  ],
  position: [
    { sig: 'P-05', name: 'Walk Score', val: '62', chg: '+3', w: '3%', pts: '+2', gate: 'soft-fail' },
    { sig: 'DC-01', name: 'Dev Capacity Ratio', val: '0.34', chg: '-0.02', w: '3%', pts: '+3', gate: 'pass' },
    { sig: 'DC-05', name: 'Zoning Utilization', val: '78%', chg: '+2%', w: '3%', pts: '+3', gate: 'pass' },
  ],
  risk: [
    { sig: 'R-01', name: 'Insurance Cost Δ', val: '+8.2%', chg: '+2.1%', w: '3%', pts: '-2', gate: 'soft-fail' },
    { sig: 'R-02', name: 'Tax Assessment Δ', val: '+4.1%', chg: '+0.8%', w: '2%', pts: '+2', gate: 'pass' },
    { sig: 'R-03', name: 'Flood Zone Pct', val: '3.2%', chg: '-0.1%', w: '2%', pts: '+2', gate: 'pass' },
  ],
};

const MOCK_ALERTS: MarketAlert[] = [
  {
    date: 'Feb 18',
    title: 'Amazon announces 5,000 additional jobs at Midtown campus',
    impact: 'D-01 ratio improving. Midtown rent pressure likely.',
    severity: 'high',
  },
  {
    date: 'Feb 12',
    title: 'Fulton County TAD extension approved for Westside BeltLine',
    impact: 'Tax incentive extends. Supply accelerant for BeltLine sub.',
    severity: 'medium',
  },
  {
    date: 'Feb 8',
    title: 'Q4 2025 rent report: Atlanta B-class up 4.8% vs A +2.1%',
    impact: 'Vintage spread widening (R-02). Value-add thesis confirmed.',
    severity: 'low',
  },
];

const MOCK_NEAR_TERM_SUPPLY: SupplyMetric[] = [
  { id: 'S-01', label: 'Existing Stock', value: '249,964' },
  { id: 'S-02', label: 'Under Construction', value: '32,400' },
  { id: 'S-03', label: 'Permitted', value: '7,200' },
  { id: '', label: 'Pipeline %', value: '15.8%', warning: true },
  { id: 'S-04', label: 'Absorption Runway', value: '22.4 mo' },
  { id: 'S-05', label: 'Delivery Clusters', value: '3', warning: true },
  { id: 'S-06', label: 'Permit Momentum', value: '0.85x' },
  { id: 'S-10', label: 'Vintage Breakdown', value: '<2000: 42% | 2000-15: 35% | 2015+: 23%' },
];

const MOCK_LONG_TERM_CAPACITY = [
  { id: 'DC-01', label: 'Capacity Ratio', value: '32%', badge: 'MOD' },
  { id: 'DC-02', label: 'Buildout Timeline', value: '8.6 yr' },
  { id: 'DC-03', label: 'Constraint Score', value: '58/100', badge: 'MOD' },
  { id: 'DC-04', label: 'Overhang Risk', value: 'LOW', check: true },
];

const MOCK_TOP_SUBMARKETS = [
  { name: 'Midtown', jedi: 82, rentGrowth: '+5.2%', units: 18400 },
  { name: 'Buckhead', jedi: 78, rentGrowth: '+3.8%', units: 24200 },
  { name: 'Old Fourth Ward', jedi: 76, rentGrowth: '+6.1%', units: 8900 },
  { name: 'Decatur', jedi: 74, rentGrowth: '+4.2%', units: 12100 },
  { name: 'Sandy Springs', jedi: 71, rentGrowth: '+2.9%', units: 15600 },
];

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

const severityColors = {
  high: { border: BT.accent.red, bg: 'rgba(239,68,68,0.1)' },
  medium: { border: BT.accent.amber, bg: 'rgba(245,158,11,0.1)' },
  low: { border: BT.text.green, bg: 'rgba(34,197,94,0.1)' },
};

export const MSAOverviewTab: React.FC<MSAOverviewTabProps> = ({ msaId, msa }) => {
  const [activeSignal, setActiveSignal] = useState<SignalTab>('demand');
  const chart = CHART_DATA[activeSignal];
  const rows = TABLE_DATA[activeSignal];
  const tabColor = SIGNAL_TABS.find(t => t.key === activeSignal)?.color || BT.text.cyan;
  const totalPts = rows.reduce((s, r) => s + parseInt(r.pts), 0);

  const msaName = msa?.name || msaId || 'Atlanta';
  const msaState = msa?.state || 'GA';
  const jediScore = msa?.healthScore || 78;

  const { fetchCommentary, getCommentary, isLoading } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: BT.bg.header,
        border: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: BT.text.primary, ...mono }}>
            MSA: {msaName.toUpperCase()}, {msaState}
          </span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: BT.text.green,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: BT.text.green,
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }} />
            LIVE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '3px 8px',
            background: `${BT.text.amber}22`,
            color: BT.text.amber,
            fontSize: 11,
            fontWeight: 700,
            ...mono,
          }}>
            JEDI {jediScore}
          </span>
          <span style={{
            padding: '3px 8px',
            background: `${BT.text.amber}11`,
            border: `1px solid ${BT.text.amber}44`,
            color: BT.text.amber,
            fontSize: 11,
            ...mono,
          }}>
            Δ{commentary?.arbitrageDelta || 22}
          </span>
          <span style={{
            padding: '3px 8px',
            background: `${BT.text.green}22`,
            color: BT.text.green,
            fontSize: 11,
            ...mono,
          }}>
            Score: {jediScore}/100
          </span>
        </div>
      </div>

      {/* Main Content: Chart+Grid LEFT | Commentary RIGHT */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Signal Chart */}
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              <span style={{ fontSize: 11, color: BT.text.amber, fontWeight: 700, ...mono }}>
                {chart.title} — {msaName} MSA
              </span>
              <div style={{ display: 'flex', gap: 12 }}>
                {chart.series.map(s => (
                  <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: s.color, display: 'inline-block' }} />
                    <span style={{ color: BT.text.muted }}>{s.name}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 4px' }}>
              <MultiLineChart labels={chart.labels} series={chart.series} height={220} />
            </div>
            <div style={{
              display: 'flex',
              gap: 4,
              padding: '8px 12px',
              borderTop: `1px solid ${BT.border.subtle}`,
              background: BT.bg.header,
            }}>
              {SIGNAL_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSignal(tab.key)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 10,
                    fontWeight: activeSignal === tab.key ? 700 : 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    borderRadius: 3,
                    border: activeSignal === tab.key ? `1px solid ${tab.color}66` : '1px solid transparent',
                    background: activeSignal === tab.key ? `${tab.color}18` : 'transparent',
                    color: activeSignal === tab.key ? tab.color : BT.text.muted,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    ...mono,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Signal Metrics Table */}
          <div style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              background: BT.bg.header,
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tabColor, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
                {SIGNAL_TABS.find(t => t.key === activeSignal)?.label} Signal Metrics
              </span>
              <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>{rows.length} metrics</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  {['Signal', 'Metric', 'Value', 'Δ YoY', 'Weight', 'Pts', 'Gate'].map((h, i) => (
                    <th key={h} style={{
                      padding: '5px 12px',
                      textAlign: i <= 1 ? 'left' : (i === 6 ? 'center' : 'right') as any,
                      fontSize: 10,
                      fontWeight: 500,
                      color: BT.text.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      ...mono,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isNeg = r.chg.startsWith('-');
                  return (
                    <tr key={r.sig} style={{
                      borderBottom: i < rows.length - 1 ? `1px solid ${BT.border.subtle}44` : 'none',
                    }}>
                      <td style={{ padding: '5px 12px' }}>
                        <span style={{
                          padding: '1px 4px',
                          background: BT.bg.header,
                          border: `1px solid ${BT.border.subtle}`,
                          fontSize: 9,
                          color: BT.text.muted,
                          borderRadius: 2,
                          ...mono,
                        }}>{r.sig}</span>
                      </td>
                      <td style={{ padding: '5px 12px', color: BT.text.primary, ...mono }}>
                        {r.name}
                        {r.live && (
                          <span style={{
                            marginLeft: 6,
                            padding: '0 4px',
                            background: `${BT.text.green}22`,
                            color: BT.text.green,
                            fontSize: 8,
                            borderRadius: 2,
                            ...mono,
                          }}>LIVE</span>
                        )}
                      </td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 700, color: BT.text.primary, ...mono }}>{r.val}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: isNeg ? BT.text.amber : BT.text.green, ...mono }}>{r.chg}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', color: BT.text.muted, ...mono }}>{r.w}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'right', fontWeight: 700, color: r.pts.startsWith('-') ? BT.text.red : BT.text.cyan, ...mono }}>{r.pts}</td>
                      <td style={{ padding: '5px 12px', textAlign: 'center' }}>
                        {r.gate === 'pass' && <span style={{ color: BT.text.green }}>✓</span>}
                        {r.gate === 'soft-fail' && <span style={{ color: BT.text.amber }}>⚠</span>}
                        {r.gate === 'fail' && <span style={{ color: BT.text.red }}>✗</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: BT.bg.header,
              borderTop: `1px solid ${BT.border.subtle}`,
              fontSize: 10,
              color: BT.text.muted,
              ...mono,
            }}>
              <span>14/16 Gates Passed | 2 Soft Fails (-8pts)</span>
              <span>Contribution: <span style={{ color: tabColor, fontWeight: 700 }}>{totalPts > 0 ? '+' : ''}{totalPts}pts</span></span>
            </div>
          </div>

          {/* Market Alerts + Near-Term Supply + Long-Term Dev Capacity — inside left column */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            {/* Market Alerts */}
            <div style={{ width: 280, flexShrink: 0, ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: BT.bg.header,
                borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.amber, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
                  Market Alerts
                </span>
                <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>{MOCK_ALERTS.length} active</span>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MOCK_ALERTS.map((alert, i) => {
                  const severity = severityColors[alert.severity];
                  return (
                    <div key={i} style={{
                      padding: 8,
                      background: severity.bg,
                      borderLeft: `3px solid ${severity.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: BT.text.primary }}>{alert.title}</span>
                        <span style={{ fontSize: 9, color: BT.text.muted, flexShrink: 0, marginLeft: 8 }}>{alert.date}</span>
                      </div>
                      <div style={{ fontSize: 9, color: BT.text.muted }}>{alert.impact}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Near-Term Supply (18mo) */}
            <div style={{ flex: 1, ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: BT.bg.header,
                borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.amber, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
                  Near-Term Supply (18mo)
                </span>
                <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>S-01→S-10</span>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {MOCK_NEAR_TERM_SUPPLY.map((metric, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: metric.warning ? `${BT.text.amber}11` : BT.bg.elevated,
                    borderLeft: metric.warning ? `3px solid ${BT.text.amber}` : 'none',
                    borderRadius: 3,
                  }}>
                    <span style={{ fontSize: 10, color: BT.text.muted }}>
                      {metric.label}
                      {metric.id && (
                        <span style={{ fontSize: 8, color: BT.text.cyan, marginLeft: 4, ...mono }}>{metric.id}</span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: metric.warning ? BT.text.amber : BT.text.primary,
                      ...mono,
                    }}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Long-Term Dev Capacity */}
            <div style={{ flex: 1, ...terminalStyles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                background: BT.bg.header,
                borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.violet, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
                  Long-Term Dev Capacity
                </span>
                <span style={{
                  fontSize: 9,
                  color: BT.text.violet,
                  background: 'rgba(139,92,246,0.15)',
                  padding: '2px 6px',
                  ...mono,
                }}>
                  DC-01→DC-11
                </span>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MOCK_LONG_TERM_CAPACITY.map((metric, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: BT.bg.elevated,
                    borderRadius: 3,
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: BT.text.muted }}>{metric.label}</div>
                      <div style={{ fontSize: 8, color: BT.text.violet, ...mono }}>{metric.id}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: BT.text.primary, ...mono }}>{metric.value}</span>
                      {metric.badge && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: BT.text.amber,
                          background: 'rgba(245,158,11,0.15)',
                          padding: '2px 6px',
                          ...mono,
                        }}>{metric.badge}</span>
                      )}
                      {metric.check && <span style={{ color: BT.text.green }}>✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Submarkets — inside left column */}
          <div style={{ ...terminalStyles.card, padding: 0, overflow: 'hidden', marginTop: 12 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              background: BT.bg.header,
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.amber, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
                Top Submarkets by JEDI Score
              </span>
              <span style={{ fontSize: 10, color: BT.text.muted, ...mono }}>Click to drill down</span>
            </div>
            <DataTable>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>JEDI</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Rent Δ</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Units</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TOP_SUBMARKETS.map((sub, i) => {
                  const jediColor = scoreColor(sub.jedi);
                  return (
                    <tr key={i} style={{
                      borderBottom: `1px solid ${BT.border.subtle}`,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = BT.bg.elevated}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>{sub.name}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                        <span style={{
                          padding: '2px 8px',
                          background: jediColor.btBg,
                          color: jediColor.btText,
                          fontWeight: 700,
                          fontSize: 12,
                        }}>
                          {sub.jedi}
                        </span>
                      </td>
                      <td style={{
                        ...terminalStyles.tableCell,
                        textAlign: 'right',
                        color: BT.text.green,
                        fontWeight: 600,
                      }}>
                        {sub.rentGrowth}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>
                        {sub.units.toLocaleString()}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                        <button style={{
                          padding: '4px 12px',
                          background: BT.text.blue,
                          color: BT.text.primary,
                          border: 'none',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}>
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        </div>

        {/* RIGHT: Commentary Side Panel */}
        <div style={{
          width: 280,
          flexShrink: 0,
          borderLeft: `2px solid ${BT.text.amber}66`,
          paddingLeft: 16,
        }}>
          {commentary ? (
            <>
              <MarketNarrative narrative={commentary.marketNarrative} compact />
              <InvestmentThesis
                recommendation={commentary.investmentThesis.recommendation}
                points={commentary.investmentThesis.points}
                compact
              />
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <SectionHeader>Strategy Score</SectionHeader>
                <StrategyScoreBadge
                  score={commentary.jediScore}
                  delta={commentary.arbitrageDelta}
                  size="lg"
                />
                <div style={{ fontSize: 10, color: BT.text.muted, ...mono, marginTop: 4 }}>
                  {commentary.recommendedStrategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </div>
              <RiskOpportunity
                risks={commentary.riskOpportunity.risks}
                opportunities={commentary.riskOpportunity.opportunities}
                compact
              />
              <PeerContext
                summary={commentary.peerContext.summary}
                peerRank={commentary.peerContext.peerRank}
                peerTotal={commentary.peerContext.peerTotal}
                topPeers={commentary.peerContext.topPeers}
                currentScore={commentary.jediScore}
                compact
              />
              <SupplyNarrative narrative={commentary.supplyNarrative} compact />
            </>
          ) : (
            <>
              <SectionHeader>Market Narrative</SectionHeader>
              <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: '0 0 8px 0' }}>
                {msaName}'s multifamily market continues to demonstrate resilient fundamentals despite
                elevated supply pipeline. Demand drivers remain strong with {msa?.populationGrowth || 1.8}%
                population growth and a favorable {msa?.employmentGrowth || 2.4}% employment trajectory.
              </p>
              <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.6, margin: '0 0 16px 0' }}>
                Near-term supply pressure from {(msa?.pipelineUnits || 18400).toLocaleString()} units
                delivering in H2 2026 warrants selective positioning in core submarkets with
                established demand profiles.
              </p>
              <SectionHeader>Investment Thesis</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                <ThesisItem icon="✓" color={BT.text.green}>Population growth exceeds national avg</ThesisItem>
                <ThesisItem icon="✓" color={BT.text.green}>Employment diversification reducing risk</ThesisItem>
                <ThesisItem icon="⚠" color={BT.text.amber}>Supply deliveries may pressure occupancy</ThesisItem>
                <ThesisItem icon="✗" color={BT.text.red}>Insurance costs escalating in Cobb County</ThesisItem>
              </div>
              <div style={{
                padding: '6px 8px',
                background: `${BT.text.amber}14`,
                border: `1px solid ${BT.text.amber}44`,
                borderRadius: 3,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: BT.text.amber,
                ...mono,
              }}>
                SELECTIVE BUY
              </div>
              <div style={{ marginTop: 16 }}>
                <SectionHeader>Strategy Score</SectionHeader>
                <StrategyScoreBadge score={jediScore} delta={22} size="lg" />
                <div style={{ fontSize: 10, color: BT.text.muted, ...mono, marginTop: 4 }}>
                  Core Plus Value-Add
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: BT.text.amber,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: `1px solid ${BT.text.amber}44`,
      paddingBottom: 4,
      marginBottom: 8,
      ...mono,
    }}>
      {children}
    </div>
  );
}

function ThesisItem({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
      <span style={{ color, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: BT.text.secondary }}>{children}</span>
    </div>
  );
}

function MultiLineChart({ labels, series, height }: { labels: string[]; series: ChartSeries[]; height: number }) {
  const allVals = series.flatMap(s => s.data);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const pad = range * 0.1;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  const w = 800;
  const h = height;
  const leftPad = 40;
  const rightPad = 10;
  const topPad = 10;
  const botPad = 24;
  const plotW = w - leftPad - rightPad;
  const plotH = h - topPad - botPad;
  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => yMin + (yRange * i) / gridLines);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="xMinYMid meet">
      {yTicks.map((tick, i) => {
        const y = topPad + plotH - ((tick - yMin) / yRange) * plotH;
        return (
          <g key={i}>
            <line x1={leftPad} y1={y} x2={w - rightPad} y2={y} stroke={BT.border.subtle} strokeWidth="0.5" />
            <text x={leftPad - 4} y={y + 3} textAnchor="end" fill={BT.text.muted} fontSize="8" fontFamily="monospace">
              {tick < 1 ? tick.toFixed(2) : tick >= 1000 ? `${(tick / 1000).toFixed(1)}K` : tick.toFixed(1)}
            </text>
          </g>
        );
      })}
      {labels.map((label, i) => {
        const x = leftPad + (i / (labels.length - 1)) * plotW;
        return (
          <g key={i}>
            <line x1={x} y1={topPad} x2={x} y2={topPad + plotH} stroke={BT.border.subtle} strokeWidth="0.3" />
            <text x={x} y={h - 4} textAnchor="middle" fill={BT.text.muted} fontSize="8" fontFamily="monospace">{label}</text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const points = s.data.map((v, i) => {
          const x = leftPad + (i / (s.data.length - 1)) * plotW;
          const y = topPad + plotH - ((v - yMin) / yRange) * plotH;
          return `${x},${y}`;
        }).join(' ');

        const fillPoints = s.data.map((v, i) => {
          const x = leftPad + (i / (s.data.length - 1)) * plotW;
          const y = topPad + plotH - ((v - yMin) / yRange) * plotH;
          return `${x},${y}`;
        });
        const fillPath = `${leftPad},${topPad + plotH} ${fillPoints.join(' ')} ${leftPad + plotW},${topPad + plotH}`;

        const lastX = leftPad + plotW;
        const lastY = topPad + plotH - ((s.data[s.data.length - 1] - yMin) / yRange) * plotH;

        return (
          <g key={si}>
            <polyline fill={`${s.color}08`} stroke="none" points={fillPath} />
            <polyline fill="none" stroke={s.color} strokeWidth="1.5" points={points} />
            <circle cx={lastX} cy={lastY} r="3" fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}

export default MSAOverviewTab;
