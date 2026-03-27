/**
 * SubmarketTrafficTab - Aggregate traffic patterns, demand signals
 */

import React, { useMemo } from 'react';
import { Activity, TrendingUp, Users, MapPin, Eye } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { SubmarketData } from '../../SubmarketTerminal';

interface SubmarketTrafficTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

export const SubmarketTrafficTab: React.FC<SubmarketTrafficTabProps> = ({ submarketId, submarket }) => {
  // Traffic trend data
  const trafficData: ChartDataPoint[] = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let traffic = 8500;
    return months.map((m) => {
      traffic = traffic + (Math.random() * 400 - 100);
      return { date: `${m} '25`, traffic: Math.round(traffic), searches: Math.round(traffic * 0.7) };
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            <Eye size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            MONTHLY VISITS
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            42.5K
          </div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>+12% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <Activity size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            SEARCH VOLUME
          </div>
          <div style={{ ...terminalStyles.metricValue }}>18.2K</div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>+8% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <Users size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            LEAD VOLUME
          </div>
          <div style={{ ...terminalStyles.metricValue }}>3.8K</div>
          <div style={{ fontSize: 11, color: BT.text.amber, marginTop: 4 }}>+2% vs LY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <MapPin size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            TOURS BOOKED
          </div>
          <div style={{ ...terminalStyles.metricValue }}>1.2K</div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>+15% vs LY</div>
        </div>
      </div>

      {/* Traffic Chart */}
      <TerminalChart
        title="Traffic & Search Trends"
        data={trafficData}
        series={[
          { key: 'traffic', name: 'Site Traffic', color: BT.text.cyan, data: [] },
          { key: 'searches', name: 'Searches', color: BT.text.amber, data: [] },
        ]}
        height={220}
        valueFormatter={(v) => v.toLocaleString()}
      />

      {/* Demand Signals */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <TrendingUp size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Demand Signals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ padding: 12, background: BT.bg.cardHover, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>Avg Days on Market</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.green }}>18</div>
            <div style={{ fontSize: 10, color: BT.text.green }}>-3 days vs MSA avg</div>
          </div>
          <div style={{ padding: 12, background: BT.bg.cardHover, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>Lease-Up Velocity</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.cyan }}>24/mo</div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>units per project</div>
          </div>
          <div style={{ padding: 12, background: BT.bg.cardHover, borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>Renewal Rate</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.green }}>62%</div>
            <div style={{ fontSize: 10, color: BT.text.green }}>+4% vs LY</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmarketTrafficTab;
