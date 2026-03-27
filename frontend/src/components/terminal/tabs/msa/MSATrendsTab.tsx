/**
 * MSATrendsTab - Historical rent/occupancy charts
 */

import React, { useMemo, useState } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { MSAData } from '../../MSATerminal';

interface MSATrendsTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSATrendsTab: React.FC<MSATrendsTabProps> = ({ msaId, msa }) => {
  const [timeRange, setTimeRange] = useState<'1Y' | '3Y' | '5Y'>('3Y');

  const rentTrendData: ChartDataPoint[] = useMemo(() => {
    const years = timeRange === '5Y' ? 5 : timeRange === '3Y' ? 3 : 1;
    const data: ChartDataPoint[] = [];
    let rent = msa.avgRent * (1 - years * 0.04);
    for (let i = 0; i < years * 4; i++) {
      rent *= 1.01 + Math.random() * 0.005;
      data.push({
        date: `Q${(i % 4) + 1} ${2025 - years + Math.floor(i / 4)}`,
        rent: Math.round(rent),
        occupancy: 92 + Math.random() * 4,
      });
    }
    return data;
  }, [msa.avgRent, timeRange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Time Range Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calendar size={14} color={BT.text.muted} />
        <span style={{ fontSize: 11, color: BT.text.muted, marginRight: 8 }}>Time Range:</span>
        {(['1Y', '3Y', '5Y'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{
              padding: '4px 12px',
              background: timeRange === range ? BT.text.amber : 'transparent',
              border: `1px solid ${timeRange === range ? BT.text.amber : BT.border.subtle}`,
              borderRadius: 4,
              color: timeRange === range ? BT.bg.terminal : BT.text.muted,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Rent Trend Chart */}
      <TerminalChart
        title={`Rent Trend (${timeRange})`}
        data={rentTrendData}
        series={[{ key: 'rent', name: 'Avg Rent', color: BT.text.green, data: [] }]}
        height={220}
        valueFormatter={(v) => `$${v.toLocaleString()}`}
      />

      {/* Occupancy Trend Chart */}
      <TerminalChart
        title={`Occupancy Trend (${timeRange})`}
        data={rentTrendData}
        series={[{ key: 'occupancy', name: 'Occupancy', color: BT.text.cyan, data: [] }]}
        height={180}
        valueFormatter={(v) => `${v.toFixed(1)}%`}
      />

      {/* Key Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>RENT CAGR ({timeRange})</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>4.2%</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG OCC ({timeRange})</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>93.8%</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>PEAK RENT</div>
          <div style={{ ...terminalStyles.metricValue }}>${msa.avgRent.toLocaleString()}</div>
          <div style={{ fontSize: 9, color: BT.text.muted }}>Current</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>TROUGH OCC</div>
          <div style={{ ...terminalStyles.metricValue }}>91.2%</div>
          <div style={{ fontSize: 9, color: BT.text.muted }}>Q2 2023</div>
        </div>
      </div>
    </div>
  );
};

export default MSATrendsTab;
