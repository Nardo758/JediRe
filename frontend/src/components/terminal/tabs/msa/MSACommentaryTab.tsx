import React, { useState, useEffect } from 'react';

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'market_dashboard', marketId: msaId }
  );
import { BT } from '../../theme';
import type { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import {
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';
  MarketNarrative,
  InvestmentThesis,
  RiskOpportunity,
  PeerContext,
  SupplyNarrative,
  StrategyScoreBadge,
  MarketSentimentTrend,
  BrokerNarrativesFeed,
  ReplacementCostPanel,
  RefreshIntelligenceButton,
} from '../../commentary';

interface MSACommentaryTabProps {
  msaId: string;
  msa: MSAData | null;
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

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export const MSACommentaryTab: React.FC<MSACommentaryTabProps> = ({ msaId, msa }) => {
  const [activeSignal, setActiveSignal] = useState<SignalTab>('demand');
  // Bumped by RefreshIntelligenceButton (queue + completion) so the OM-derived
  // panels — broker narratives + replacement cost — re-fetch in lockstep with
  // the commentary text. Without this, those panels would only refresh on
  // remount, surfacing stale data after a refresh.
  const [panelRefreshNonce, setPanelRefreshNonce] = useState<number>(0);
  const chart = CHART_DATA[activeSignal];
  const rows = TABLE_DATA[activeSignal];
  const tabColor = SIGNAL_TABS.find(t => t.key === activeSignal)?.color || BT.text.cyan;
  const msaName = msa?.name || msaId.charAt(0).toUpperCase() + msaId.slice(1);
  const jediScore = msa?.healthScore || 78;
  const totalPts = rows.reduce((s, r) => s + parseInt(r.pts), 0);

  const { fetchCommentary, getCommentary, isLoading } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <MarketSentimentTrend
          entityType="msa"
          entityId={msaId}
          entityName={msaName}
        />
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
            <MultiLineChart labels={chart.labels} series={chart.series} height={140} />
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
      </div>

      <div style={{
        width: 280,
        flexShrink: 0,
        borderLeft: `2px solid ${BT.text.amber}66`,
        paddingLeft: 16,
      }}>
        <RefreshIntelligenceButton
          entityType="msa"
          entityId={msaId}
          onQueued={() => {
            setPanelRefreshNonce(n => n + 1);
            fetchCommentary('msa', msaId, msaName, true);
          }}
          onCompleted={() => {
            setPanelRefreshNonce(n => n + 1);
            fetchCommentary('msa', msaId, msaName, true);
          }}
        />
        {commentary ? (
          <>
            <MarketNarrative narrative={commentary.marketNarrative} compact />
            <BrokerNarrativesFeed entityType="msa" entityId={msaId} refreshNonce={panelRefreshNonce} />
            <ReplacementCostPanel entityType="msa" entityId={msaId} refreshNonce={panelRefreshNonce} />
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
      fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
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

export default MSACommentaryTab;
