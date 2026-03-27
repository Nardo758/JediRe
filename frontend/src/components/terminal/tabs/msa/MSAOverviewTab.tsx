/**
 * MSAOverviewTab - Metro stats, health score, key metrics
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Building2, Users, Briefcase, DollarSign, Award, Activity } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { MSAData } from '../../MSATerminal';

interface MSAOverviewTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSAOverviewTab: React.FC<MSAOverviewTabProps> = ({ msaId, msa }) => {
  // Rent trend data
  const rentTrendData: ChartDataPoint[] = useMemo(() => {
    const quarters = ['Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25'];
    let rent = msa.avgRent * 0.88;
    return quarters.map((q) => {
      rent *= 1.013;
      return { date: q, rent: Math.round(rent) };
    });
  }, [msa]);

  // Top submarkets
  const topSubmarkets = useMemo(() => [
    { name: 'Buckhead', units: 38450, avgRent: 1895, growth: 5.2, occupancy: 94.3, rank: 1 },
    { name: 'Midtown', units: 42500, avgRent: 2150, growth: 5.8, occupancy: 95.2, rank: 2 },
    { name: 'Old Fourth Ward', units: 15800, avgRent: 1950, growth: 6.2, occupancy: 94.8, rank: 3 },
    { name: 'West Midtown', units: 18500, avgRent: 1780, growth: 4.5, occupancy: 93.2, rank: 4 },
    { name: 'Downtown', units: 28200, avgRent: 1820, growth: 3.2, occupancy: 91.5, rank: 5 },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {/* Health Score */}
        <div style={{
          ...terminalStyles.card,
          textAlign: 'center',
          borderColor: msa.healthScore >= 75 ? BT.text.green : BT.text.amber,
        }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <Award size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            HEALTH SCORE
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: msa.healthScore >= 75 ? BT.text.green : BT.text.amber,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {msa.healthScore}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>
            Rank #{msa.rank} of {msa.totalRank}
          </div>
        </div>

        {/* Avg Rent */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG RENT</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.primary }}>
            ${msa.avgRent.toLocaleString()}
          </div>
          <div style={{ 
            fontSize: 11, 
            color: msa.rentGrowth >= 0 ? BT.text.green : BT.text.red, 
            marginTop: 4 
          }}>
            {msa.rentGrowth > 0 ? '+' : ''}{msa.rentGrowth}% YoY
          </div>
        </div>

        {/* Occupancy */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>OCCUPANCY</div>
          <div style={{ 
            ...terminalStyles.metricValue, 
            color: msa.occupancy >= 93 ? BT.text.green : BT.text.amber 
          }}>
            {msa.occupancy.toFixed(1)}%
          </div>
          <div style={{ 
            fontSize: 11, 
            color: msa.occupancyChange >= 0 ? BT.text.green : BT.text.red, 
            marginTop: 4 
          }}>
            {msa.occupancyChange >= 0 ? '▲' : '▼'} {Math.abs(msa.occupancyChange).toFixed(1)}%
          </div>
        </div>

        {/* Cap Rate */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG CAP RATE</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {msa.avgCapRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            5Y avg: 5.1%
          </div>
        </div>

        {/* Transaction Volume */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>YTD VOLUME</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            ${(msa.transactionVolume / 1000000000).toFixed(1)}B
          </div>
          <div style={{ fontSize: 11, color: BT.text.green, marginTop: 4 }}>
            +12% vs LY
          </div>
        </div>

        {/* Pipeline */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>PIPELINE</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.amber }}>
            {(msa.pipelineUnits / 1000).toFixed(1)}K
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            {((msa.pipelineUnits / msa.totalUnits) * 100).toFixed(1)}% of stock
          </div>
        </div>
      </div>

      {/* Rent Trend Chart */}
      <TerminalChart
        title="Average Rent Trend"
        data={rentTrendData}
        series={[{ key: 'rent', name: 'Avg Rent', color: BT.text.green, data: [] }]}
        height={180}
        valueFormatter={(v) => `$${v.toLocaleString()}`}
      />

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top Submarkets */}
        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
            <Building2 size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Top Submarkets by Rent Growth
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <th style={{ ...terminalStyles.th, textAlign: 'left', width: 30 }}>#</th>
                <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Submarket</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Rent</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Growth</th>
                <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Occ</th>
              </tr>
            </thead>
            <tbody>
              {topSubmarkets.map((sub) => (
                <tr key={sub.name} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.td, color: BT.text.amber, fontWeight: 600 }}>{sub.rank}</td>
                  <td style={{ ...terminalStyles.td, fontWeight: 500 }}>{sub.name}</td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                    ${sub.avgRent.toLocaleString()}
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontWeight: 600 }}>
                    +{sub.growth}%
                  </td>
                  <td style={{ ...terminalStyles.td, textAlign: 'right' }}>
                    {sub.occupancy}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Demographics */}
        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
            <Users size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Demographics & Economy
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 10, background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Population</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                {(msa.population / 1000000).toFixed(1)}M
              </div>
              <div style={{ fontSize: 10, color: BT.text.green }}>+{msa.populationGrowth}%</div>
            </div>
            <div style={{ padding: 10, background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Employment</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                {(msa.employment / 1000000).toFixed(1)}M
              </div>
              <div style={{ fontSize: 10, color: BT.text.green }}>+{msa.employmentGrowth}%</div>
            </div>
            <div style={{ padding: 10, background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Median Income</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                ${(msa.medianIncome / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: 10, color: BT.text.green }}>+{msa.incomeGrowth}%</div>
            </div>
            <div style={{ padding: 10, background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Submarkets</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                {msa.submarketCount}
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>{msa.propertyCount.toLocaleString()} properties</div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div style={{
        background: `linear-gradient(135deg, ${BT.bg.panelAlt} 0%, ${BT.bg.panel} 100%)`,
        border: `1px solid ${BT.text.amber}33`,
        borderRadius: 8,
        padding: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          color: BT.text.amber,
          fontWeight: 700,
          fontSize: 12,
        }}>
          <Activity size={16} />
          Market Intelligence
        </div>
        <ul style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>{msa.name} ranks #{msa.rank}</strong> among top {msa.totalRank} metros for multifamily investment.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>Employment growth +{msa.employmentGrowth}%</strong> outpaces national average of 1.8%, supporting rent growth.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>Pipeline at {((msa.pipelineUnits / msa.totalUnits) * 100).toFixed(1)}%</strong> 
              {(msa.pipelineUnits / msa.totalUnits) < 0.06 
                ? ' — below historical average, favorable supply dynamics' 
                : ' — elevated but absorption remains strong'}.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MSAOverviewTab;
