/**
 * SubmarketFinancialsTab - Avg rents, cap rates, NOI by property class
 */

import React, { useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, Building2, BarChart3 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface SubmarketFinancialsTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

export const SubmarketFinancialsTab: React.FC<SubmarketFinancialsTabProps> = ({ submarketId, submarket }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'proforma_review', submarketId: submarketId }
  );

  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);
  useEffect(() => { fetchCommentary('submarket', submarketId, submarket.name); }, [submarketId, submarket.name, fetchCommentary]);
  // Rent by class data
  const rentByClass = useMemo(() => [
    { class: 'A', avgRent: 2180, rentPSF: 2.52, growth: 5.2, occupancy: 94.8 },
    { class: 'B', avgRent: 1720, rentPSF: 2.05, growth: 4.1, occupancy: 94.2 },
    { class: 'C', avgRent: 1280, rentPSF: 1.58, growth: 2.8, occupancy: 93.1 },
  ], []);

  // Rent trend data
  const rentTrendData: ChartDataPoint[] = useMemo(() => {
    const quarters = ['Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25'];
    let classA = 1950, classB = 1550, classC = 1150;
    return quarters.map((q) => {
      classA *= 1.012; classB *= 1.010; classC *= 1.007;
      return { date: q, classA: Math.round(classA), classB: Math.round(classB), classC: Math.round(classC) };
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Key Financial Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            AVG RENT
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            ${submarket.avgRent.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>+{submarket.rentGrowth}% YoY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>RENT/SF</div>
          <div style={{ ...terminalStyles.metricValue }}>$2.18</div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>+3.8% YoY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            AVG CAP RATE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {submarket.avgCapRate}%
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>5Y avg: 5.3%</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG NOI/UNIT</div>
          <div style={{ ...terminalStyles.metricValue }}>$12.4K</div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>+6.2% YoY</div>
        </div>
      </div>

      {/* Rent Trend Chart */}
      <TerminalChart
        title="Rent Trends by Class"
        data={rentTrendData}
        series={[
          { key: 'classA', name: 'Class A', color: BT.text.green, data: [] },
          { key: 'classB', name: 'Class B', color: BT.text.amber, data: [] },
          { key: 'classC', name: 'Class C', color: BT.text.red, data: [] },
        ]}
        height={200}
        valueFormatter={(v) => `$${v.toLocaleString()}`}
      />

      {/* Metrics by Class */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Performance by Property Class
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Class</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Avg Rent</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Rent/SF</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Growth</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {rentByClass.map((row) => (
              <tr key={row.class} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: row.class === 'A' ? `${BT.text.green}22` : 
                               row.class === 'B' ? `${BT.text.amber}22` : `${BT.text.red}22`,
                    color: row.class === 'A' ? BT.text.green : 
                           row.class === 'B' ? BT.text.amber : BT.text.red,
                    fontWeight: 700,
                  }}>
                    Class {row.class}
                  </span>
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  ${row.avgRent.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                  ${row.rentPSF.toFixed(2)}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                  +{row.growth}%
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                  {row.occupancy}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating financial analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.pricing_power && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="supply" commentary={commentary.signalCommentary.pricing_power} />
            </div>
          )}
          {commentary.signalCommentary?.momentum && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="momentum" commentary={commentary.signalCommentary.momentum} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmarketFinancialsTab;
