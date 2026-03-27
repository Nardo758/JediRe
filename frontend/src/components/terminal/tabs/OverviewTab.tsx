/**
 * OverviewTab - Key metrics, exit score, scenario comparison
 * Migrated from: Model Comparison view in FinancialDashboard
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, Zap, Building2, DollarSign } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { TerminalChart, ChartSeries, ChartDataPoint } from '../TerminalChart';

interface OverviewTabProps {
  dealId: string;
  deal: any;
}

const METRICS = [
  { key: 'irr', label: 'IRR', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'equityMultiple', label: 'Equity Multiple', format: (v: number) => `${v.toFixed(2)}x` },
  { key: 'cashOnCash', label: 'Cash-on-Cash', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'noi', label: 'Year 1 NOI', format: (v: number) => fmt.currency(v) },
  { key: 'dscr', label: 'DSCR', format: (v: number) => `${v.toFixed(2)}x` },
  { key: 'yoc', label: 'Yield on Cost', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'exitValue', label: 'Exit Value', format: (v: number) => fmt.currency(v) },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({ dealId, deal }) => {
  // Extract scenarios from deal
  const scenarios = useMemo(() => {
    const model = deal?.model || deal?.latestModel || {};
    const results = model?.results?.summary || {};
    const s = model?.scenarios || {};
    
    // Build scenarios from engine results or defaults
    const base = s.base || {
      irr: results.irr || 18.5,
      equityMultiple: results.equityMultiple || 2.1,
      cashOnCash: results.cashOnCash?.[0] || 8.2,
      noi: results.noiYear1 || 2800000,
      dscr: results.dscr?.[0] || 1.42,
      yoc: results.yieldOnCost || 6.8,
      exitValue: results.exitValue || 58000000,
    };

    return {
      base,
      best: s.best || {
        irr: base.irr * 1.15,
        equityMultiple: base.equityMultiple * 1.2,
        cashOnCash: base.cashOnCash * 1.1,
        noi: base.noi * 1.07,
        dscr: base.dscr * 1.07,
        yoc: base.yoc * 1.08,
        exitValue: base.exitValue * 1.25,
      },
      worst: s.worst || {
        irr: base.irr * 0.75,
        equityMultiple: base.equityMultiple * 0.7,
        cashOnCash: base.cashOnCash * 0.82,
        noi: base.noi * 0.9,
        dscr: base.dscr * 0.83,
        yoc: base.yoc * 0.9,
        exitValue: base.exitValue * 0.7,
      },
    };
  }, [deal]);

  // Calculate exit score
  const exitScore = useMemo(() => {
    const rentGrowth = (deal?.marketContext?.rent_growth || 0.04) * 100;
    const rate = 4.15;
    const supply = 200;
    const rentScore = Math.max(0, Math.min(100, (rentGrowth / 10) * 100)) * 0.40;
    const rateScore = Math.max(0, Math.min(100, ((5.0 - rate) / 2.0) * 100)) * 0.35;
    const supplyScore = Math.max(0, Math.min(100, ((400 - supply) / 400) * 100)) * 0.25;
    return Math.round(Math.max(0, Math.min(100, rentScore + rateScore + supplyScore)));
  }, [deal]);

  // Mock chart data for rent/occ trends
  const chartData: ChartDataPoint[] = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, i) => ({
      date: `${m} '25`,
      rent: 1750 + i * 25 + Math.random() * 30,
      occupancy: 92 + i * 0.3 + Math.random() * 1,
      noi: 220000 + i * 8000 + Math.random() * 5000,
    }));
  }, []);

  const chartSeries: ChartSeries[] = [
    { key: 'rent', name: 'Avg Rent', color: BT.text.green, data: [] },
    { key: 'occupancy', name: 'Occupancy %', color: BT.text.cyan, data: [] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {/* Exit Score */}
        <div style={{
          ...terminalStyles.card,
          textAlign: 'center',
          borderColor: exitScore >= 70 ? BT.text.green : exitScore >= 50 ? BT.text.amber : BT.text.red,
        }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            EXIT SCORE
          </div>
          <div style={{
            ...terminalStyles.metricValue,
            color: exitScore >= 70 ? BT.text.green : exitScore >= 50 ? BT.text.amber : BT.text.red,
          }}>
            {exitScore}
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            {exitScore >= 70 ? 'Strong window' : exitScore >= 50 ? 'Fair window' : 'Weak window'}
          </div>
        </div>

        {/* Optimal Exit */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            OPTIMAL EXIT
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            Q1 26
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            Low rates + low supply
          </div>
        </div>

        {/* Convergence */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.amber, marginBottom: 8 }}>
            CONVERGENCE
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.amber }}>
            3
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            Factors aligned
          </div>
        </div>

        {/* Base IRR */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.primary, marginBottom: 8 }}>
            BASE IRR
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.primary }}>
            {scenarios.base.irr.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            Pro Forma + Strategy
          </div>
        </div>
      </div>

      {/* Rent/Occupancy Chart */}
      <TerminalChart
        title="Property Performance Trend"
        data={chartData}
        series={chartSeries}
        height={220}
        valueFormatter={(v) => v >= 100 ? `$${v.toLocaleString()}` : `${v.toFixed(1)}%`}
      />

      {/* Scenario Comparison Table */}
      <div>
        <div style={terminalStyles.sectionLabel}>
          SIDE-BY-SIDE MODEL COMPARISON
        </div>
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...terminalStyles.th, textAlign: 'left' }}>METRIC</th>
                <th style={terminalStyles.th}>
                  <div style={{ fontWeight: 700 }}>Base Case</div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: BT.text.muted, marginTop: 2 }}>
                    Pro Forma + Strategy + Traffic
                  </div>
                </th>
                <th style={{ ...terminalStyles.th, color: BT.text.green }}>
                  <div style={{ fontWeight: 700 }}>Best Case</div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: BT.text.muted, marginTop: 2 }}>
                    Optimistic traffic + tight market
                  </div>
                </th>
                <th style={{ ...terminalStyles.th, color: BT.text.red }}>
                  <div style={{ fontWeight: 700 }}>Worst Case</div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: BT.text.muted, marginTop: 2 }}>
                    Weak traffic + rate pressure
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map(m => {
                const base = scenarios.base[m.key as keyof typeof scenarios.base] || 0;
                const best = scenarios.best[m.key as keyof typeof scenarios.best] || 0;
                const worst = scenarios.worst[m.key as keyof typeof scenarios.worst] || 0;
                const bestDelta = base !== 0 ? ((best - base) / base * 100).toFixed(1) : '0.0';
                const worstDelta = base !== 0 ? ((worst - base) / base * 100).toFixed(1) : '0.0';

                return (
                  <tr key={m.key}>
                    <td style={{ ...terminalStyles.td, fontWeight: 600, color: BT.text.primary }}>
                      {m.label}
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                      <span style={{ 
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        color: BT.text.primary,
                      }}>
                        {m.format(base)}
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                      <span style={{ 
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        color: BT.text.primary,
                      }}>
                        {m.format(best)}
                      </span>
                      <span style={{ 
                        display: 'block',
                        fontSize: 10,
                        color: BT.text.green,
                        marginTop: 2,
                      }}>
                        +{bestDelta}%
                      </span>
                    </td>
                    <td style={{ ...terminalStyles.td, textAlign: 'center' }}>
                      <span style={{ 
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        color: BT.text.primary,
                      }}>
                        {m.format(worst)}
                      </span>
                      <span style={{ 
                        display: 'block',
                        fontSize: 10,
                        color: BT.text.red,
                        marginTop: 2,
                      }}>
                        {worstDelta}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          <Zap size={16} />
          AI Model Intelligence
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
              <strong style={{ color: BT.text.primary }}>
                IRR spread of {Math.abs(scenarios.best.irr - scenarios.worst.irr).toFixed(1)}%
              </strong>{' '}
              between Best/Worst — deal is exit cap-sensitive.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>
                Base DSCR at {scenarios.base.dscr.toFixed(2)}x
              </strong>{' '}
              provides {scenarios.base.dscr >= 1.25 ? 'comfortable' : 'tight'} debt coverage.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>
                Yield on Cost at {scenarios.base.yoc.toFixed(1)}%
              </strong>{' '}
              — {scenarios.base.yoc > 6 ? 'strong value creation margin' : 'limited spread over going-in cap'}.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>
                Exit convergence score: {exitScore}/100
              </strong>{' '}
              — {exitScore >= 70 
                ? 'strong alignment of rates, supply, and rent growth for near-term exit' 
                : 'monitor convergence factors before committing to exit timing'}.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default OverviewTab;
