/**
 * MSASupplyTab - Metro-wide supply pipeline
 */

import React, { useMemo } from 'react';
import { Building2, Hammer, Clock, CheckCircle2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { MSAData } from '../../MSATerminal';

interface MSASupplyTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSASupplyTab: React.FC<MSASupplyTabProps> = ({ msaId, msa }) => {
  const deliveryData: ChartDataPoint[] = useMemo(() => {
    return [
      { date: 'Q1 25', delivered: 4200, absorbed: 4500 },
      { date: 'Q2 25', delivered: 5100, absorbed: 4800 },
      { date: 'Q3 25', delivered: 6200, absorbed: 5500 },
      { date: 'Q4 25', delivered: 5800, absorbed: 6100 },
      { date: 'Q1 26', delivered: 4500, absorbed: 4200 },
      { date: 'Q2 26', delivered: 3800, absorbed: 4100 },
    ];
  }, []);

  const pipelineBySubmarket = useMemo(() => [
    { name: 'Downtown', units: 3800, pctOfTotal: 13.3 },
    { name: 'Midtown', units: 3200, pctOfTotal: 11.2 },
    { name: 'Buckhead', units: 2840, pctOfTotal: 10.0 },
    { name: 'Perimeter', units: 2400, pctOfTotal: 8.4 },
    { name: 'West Midtown', units: 2100, pctOfTotal: 7.4 },
    { name: 'Other', units: 14160, pctOfTotal: 49.7 },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.amber, marginBottom: 8 }}>
            TOTAL PIPELINE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.amber }}>
            {(msa.pipelineUnits / 1000).toFixed(1)}K
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>
            {((msa.pipelineUnits / msa.totalUnits) * 100).toFixed(1)}% of stock
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            LEASE-UP
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            {(msa.pipelineUnits * 0.12 / 1000).toFixed(1)}K
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            <Hammer size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            UNDER CONST.
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {(msa.pipelineUnits * 0.45 / 1000).toFixed(1)}K
          </div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            PLANNED
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.muted }}>
            {(msa.pipelineUnits * 0.43 / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      {/* Delivery vs Absorption Chart */}
      <TerminalChart
        title="Delivery vs Absorption (Units)"
        data={deliveryData}
        series={[
          { key: 'delivered', name: 'Delivered', color: BT.text.amber, data: [] },
          { key: 'absorbed', name: 'Absorbed', color: BT.text.green, data: [] },
        ]}
        height={200}
        valueFormatter={(v) => v.toLocaleString()}
      />

      {/* Pipeline by Submarket */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Pipeline by Submarket
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Pipeline Units</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>% of Total</th>
              <th style={{ ...terminalStyles.th, textAlign: 'left', width: 200 }}>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {pipelineBySubmarket.map((sub) => (
              <tr key={sub.name} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, fontWeight: 500 }}>{sub.name}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {sub.units.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.amber }}>
                  {sub.pctOfTotal.toFixed(1)}%
                </td>
                <td style={{ ...terminalStyles.td }}>
                  <div style={{
                    height: 8,
                    background: BT.bg.cardHover,
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${sub.pctOfTotal * 2}%`,
                      background: BT.text.amber,
                      borderRadius: 4,
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MSASupplyTab;
