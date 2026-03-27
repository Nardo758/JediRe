/**
 * MSACapitalTab - Transaction volume, cap rate trends
 */

import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, Building2 } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { MSAData } from '../../MSATerminal';

interface MSACapitalTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSACapitalTab: React.FC<MSACapitalTabProps> = ({ msaId, msa }) => {
  const volumeData: ChartDataPoint[] = useMemo(() => [
    { date: 'Q1 24', volume: 850, capRate: 5.4 },
    { date: 'Q2 24', volume: 1100, capRate: 5.3 },
    { date: 'Q3 24', volume: 980, capRate: 5.2 },
    { date: 'Q4 24', volume: 1270, capRate: 5.2 },
    { date: 'Q1 25', volume: 920, capRate: 5.3 },
  ], []);

  const recentDeals = useMemo(() => [
    { property: 'Camden Paces Portfolio', units: 1240, price: 285, ppu: 230, cap: 4.8, buyer: 'Blackstone', date: 'Mar 25' },
    { property: 'Greystar Midtown Collection', units: 890, price: 198, ppu: 222, cap: 5.0, buyer: 'Invesco', date: 'Feb 25' },
    { property: 'The Metropolitan at Phipps', units: 320, price: 85, ppu: 266, cap: 4.8, buyer: 'Blackstone', date: 'Feb 25' },
    { property: 'Alexan Buckhead', units: 290, price: 62, ppu: 214, cap: 5.5, buyer: 'Greystar', date: 'Nov 24' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            YTD VOLUME
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            ${(msa.transactionVolume / 1000000000).toFixed(1)}B
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+12% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>DEAL COUNT</div>
          <div style={{ ...terminalStyles.metricValue }}>127</div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+8% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            AVG CAP RATE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {msa.avgCapRate}%
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted }}>-20 bps vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG $/UNIT</div>
          <div style={{ ...terminalStyles.metricValue }}>$228K</div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+5% vs LY</div>
        </div>
      </div>

      {/* Volume & Cap Rate Chart */}
      <TerminalChart
        title="Transaction Volume ($M) & Cap Rate Trend"
        data={volumeData}
        series={[
          { key: 'volume', name: 'Volume ($M)', color: BT.text.green, data: [] },
        ]}
        height={180}
        valueFormatter={(v) => `$${v}M`}
      />

      {/* Recent Deals */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Notable Recent Transactions
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Property</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Units</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Price</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>$/Unit</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Cap</th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Buyer</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentDeals.map((deal, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, fontWeight: 500 }}>{deal.property}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right' }}>{deal.units.toLocaleString()}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                  ${deal.price}M
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  ${deal.ppu}K
                </td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>
                  {deal.cap}%
                </td>
                <td style={{ ...terminalStyles.td, color: BT.text.secondary }}>{deal.buyer}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.muted }}>{deal.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MSACapitalTab;
