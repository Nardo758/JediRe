/**
 * MSAOverviewTab - Comprehensive market health dashboard
 * Integrated content from pre-Bloomberg: OverviewTab, MarketOverviewTab
 * Features: 5-Signal Health Bar, Market Alerts, Near/Long-term Supply, Vitals Grid
 */

import React, { useState, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { SIGNAL_GROUPS, SignalGroupId, BT_SIGNAL_COLORS, ALL_OUTPUTS, scoreColor } from '../../signalGroups';

interface MSAOverviewTabProps {
  msaId: string;
  msa: any;
}

// Signal health data structure
interface SignalHealth {
  groupId: SignalGroupId;
  label: string;
  outputId: string;
  score: number;
}

// Market alert structure
interface MarketAlert {
  date: string;
  title: string;
  impact: string;
  severity: 'high' | 'medium' | 'low';
}

// Vital metric structure
interface VitalMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  live?: boolean;
}

// Near-term supply metric
interface SupplyMetric {
  id: string;
  label: string;
  value: string;
  warning?: boolean;
}

// Mock data - would come from API
const MOCK_VITALS: VitalMetric[] = [
  { id: 'D-12', label: 'Population', value: '6.2M', sub: 'Metro MSA' },
  { id: 'D-01', label: 'Jobs Ratio', value: '1.8x', sub: 'Jobs / Apartments' },
  { id: 'D-12', label: 'Med. Income', value: '$72,400', sub: 'Household' },
  { id: 'M-01', label: 'Avg Rent', value: '$1,580', sub: '1BR Market', live: true },
  { id: 'M-06', label: 'Occupancy', value: '93.2%', sub: 'Proxy estimate' },
  { id: 'C-01', label: 'JEDI Score', value: '72', sub: 'Composite 0-100', live: true },
];

const MOCK_HEALTH_SIGNALS: SignalHealth[] = [
  { groupId: 'DEMAND', label: 'DEMAND', outputId: 'D-09', score: 68 },
  { groupId: 'SUPPLY', label: 'SUPPLY', outputId: 'S-04', score: 55 },
  { groupId: 'MOMENTUM', label: 'MOMENTUM', outputId: 'M-02', score: 61 },
  { groupId: 'DEV_CAPACITY', label: 'DEV CAPACITY', outputId: 'DC-03', score: 70 },
  { groupId: 'RISK', label: 'RISK', outputId: 'R-01', score: 42 },
];

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
  { id: '', label: 'Pipeline %', value: '15.8%' },
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

export const MSAOverviewTab: React.FC<MSAOverviewTabProps> = ({ msaId, msa }) => {
  const [loading, setLoading] = useState(false);
  const [coveragePercent, setCoveragePercent] = useState(60);
  const [totalParcels, setTotalParcels] = useState(1033000);
  const [totalProperties, setTotalProperties] = useState(1028);
  const [totalUnits, setTotalUnits] = useState(249964);

  const msaName = msa?.name || msaId || 'Atlanta';
  const msaState = msa?.state || 'GA';

  // Severity colors for Bloomberg theme
  const severityColors = {
    high: { border: BT.accent.red, bg: 'rgba(239,68,68,0.1)' },
    medium: { border: BT.accent.amber, bg: 'rgba(245,158,11,0.1)' },
    low: { border: BT.text.green, bg: 'rgba(34,197,94,0.1)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with coverage bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle, marginBottom: 4 }}>
            {msaName}, {msaState} — Market Overview
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            30-second market health check · 25 outputs
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: BT.bg.card,
          borderRadius: 6,
          border: `1px solid ${BT.border.subtle}`,
        }}>
          <span style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: BT.text.green,
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ color: BT.text.muted, fontSize: 11 }}>
            {coveragePercent}% live data
          </span>
        </div>
      </div>

      {/* Vitals Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 12,
        padding: 16,
        background: `linear-gradient(135deg, ${BT.bg.card} 0%, rgba(59,130,246,0.05) 100%)`,
        borderRadius: 8,
        border: `1px solid ${BT.border.subtle}`,
      }}>
        {MOCK_VITALS.map((vital, i) => (
          <div key={i} style={{
            ...terminalStyles.card,
            padding: 16,
            textAlign: 'center',
            position: 'relative',
          }}>
            <div style={{ 
              fontSize: 10, 
              fontFamily: 'monospace', 
              color: BT.text.cyan,
              marginBottom: 4,
            }}>
              {vital.id}
            </div>
            <div style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              color: BT.text.primary,
              marginBottom: 4,
            }}>
              {vital.value}
            </div>
            <div style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: BT.text.secondary,
            }}>
              {vital.label}
            </div>
            <div style={{ 
              fontSize: 10, 
              color: BT.text.muted,
            }}>
              {vital.sub}
            </div>
            {vital.live && (
              <span style={{
                position: 'absolute',
                top: 8,
                right: 8,
                fontSize: 9,
                fontWeight: 700,
                color: BT.text.green,
                background: 'rgba(34,197,94,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                LIVE
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Coverage Bar */}
      <div style={{
        ...terminalStyles.card,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <span style={{ color: BT.text.muted, fontSize: 13 }}>
          {totalParcels.toLocaleString()} Parcels
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            flex: 1,
            height: 12,
            background: BT.bg.elevated,
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${coveragePercent}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${BT.text.green} 0%, ${BT.text.cyan} 100%)`,
              borderRadius: 6,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary }}>
            {coveragePercent}% Coverage
          </span>
        </div>
        <span style={{ color: BT.text.muted, fontSize: 13 }}>
          {totalProperties.toLocaleString()} Props
        </span>
        <span style={{ color: BT.text.muted, fontSize: 13 }}>
          {totalUnits.toLocaleString()} units
        </span>
      </div>

      {/* Main Content: Health Bar + Alerts */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* 5-Signal Health Bar */}
        <div style={{ flex: '0 0 60%', ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              5-Signal Health Bar
            </h3>
            <span style={{ color: BT.text.muted, fontSize: 11 }}>5 composites</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {MOCK_HEALTH_SIGNALS.map((signal) => {
              const group = SIGNAL_GROUPS[signal.groupId];
              const btColor = BT_SIGNAL_COLORS[signal.groupId];
              return (
                <div key={signal.groupId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        color: btColor.primary,
                      }}>
                        {signal.label}
                      </span>
                      <span style={{ 
                        fontSize: 10, 
                        fontFamily: 'monospace',
                        color: BT.text.muted,
                      }}>
                        {signal.outputId}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: 13, 
                      fontWeight: 700, 
                      color: btColor.primary,
                    }}>
                      {signal.score}
                    </span>
                  </div>
                  <div style={{
                    height: 8,
                    background: BT.bg.elevated,
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${signal.score}%`,
                      height: '100%',
                      background: btColor.primary,
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Health Bar Question */}
          <div style={{
            marginTop: 16,
            padding: 12,
            background: BT.bg.elevated,
            borderRadius: 6,
            borderLeft: `3px solid ${BT.text.cyan}`,
          }}>
            <div style={{ fontSize: 10, color: BT.text.cyan, marginBottom: 4, fontFamily: 'monospace' }}>
              MARKET THESIS
            </div>
            <div style={{ fontSize: 13, color: BT.text.primary }}>
              Demand outpacing supply in core submarkets. Value-add thesis intact with B-class spread widening.
            </div>
          </div>
        </div>

        {/* Market Alerts */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
            Market Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {MOCK_ALERTS.map((alert, i) => {
              const severity = severityColors[alert.severity];
              return (
                <div key={i} style={{
                  padding: 12,
                  background: severity.bg,
                  borderLeft: `3px solid ${severity.border}`,
                  borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary }}>
                      {alert.title}
                    </span>
                    <span style={{ fontSize: 10, color: BT.text.muted }}>{alert.date}</span>
                  </div>
                  <div style={{ fontSize: 11, color: BT.text.muted }}>
                    {alert.impact}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Supply Sections */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Near-Term Supply */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Near-Term Supply (18mo)
            </h3>
            <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: 'monospace' }}>S-01 → S-10</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {MOCK_NEAR_TERM_SUPPLY.map((metric, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: metric.warning ? 'rgba(245,158,11,0.1)' : BT.bg.elevated,
                borderRadius: 4,
                borderLeft: metric.warning ? `3px solid ${BT.text.amber}` : 'none',
              }}>
                <div>
                  <span style={{ fontSize: 11, color: BT.text.muted }}>{metric.label}</span>
                  {metric.id && (
                    <span style={{ 
                      fontSize: 9, 
                      color: BT.text.cyan, 
                      marginLeft: 6,
                      fontFamily: 'monospace',
                    }}>
                      {metric.id}
                    </span>
                  )}
                </div>
                <span style={{ 
                  fontSize: 13, 
                  fontWeight: 600, 
                  color: metric.warning ? BT.text.amber : BT.text.primary,
                }}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Long-Term Dev Capacity */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Long-Term Dev Capacity
            </h3>
            <span style={{ 
              fontSize: 10, 
              color: BT.text.violet, 
              fontFamily: 'monospace',
              background: 'rgba(139,92,246,0.15)',
              padding: '2px 6px',
              borderRadius: 4,
            }}>
              DC-01 → DC-11 ★
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_LONG_TERM_CAPACITY.map((metric, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: BT.bg.elevated,
                borderRadius: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: BT.text.muted }}>{metric.label}</span>
                  <span style={{ 
                    fontSize: 9, 
                    color: BT.text.violet, 
                    fontFamily: 'monospace',
                  }}>
                    {metric.id}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: BT.text.primary }}>
                    {metric.value}
                  </span>
                  {metric.badge && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: BT.text.amber,
                      background: 'rgba(245,158,11,0.15)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}>
                      {metric.badge}
                    </span>
                  )}
                  {metric.check && (
                    <span style={{ color: BT.text.green }}>✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Submarkets */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
            Top Submarkets by JEDI Score
          </h3>
          <span style={{ fontSize: 10, color: BT.text.muted }}>Click to drill down</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Submarket</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>JEDI</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Rent Growth</th>
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
                      borderRadius: 4,
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
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
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
        </table>
      </div>
    </div>
  );
};

export default MSAOverviewTab;
