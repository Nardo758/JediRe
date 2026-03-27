/**
 * MSAEconomicsTab - Employment, population, income trends
 */

import React, { useMemo } from 'react';
import { Users, Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { MSAData } from '../../MSATerminal';

interface MSAEconomicsTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSAEconomicsTab: React.FC<MSAEconomicsTabProps> = ({ msaId, msa }) => {
  const employmentData: ChartDataPoint[] = useMemo(() => [
    { date: '2020', employment: 2850, population: 5900 },
    { date: '2021', employment: 2920, population: 5980 },
    { date: '2022', employment: 3010, population: 6050 },
    { date: '2023', employment: 3060, population: 6120 },
    { date: '2024', employment: 3100, population: 6200 },
  ], []);

  const topEmployers = useMemo(() => [
    { name: 'Delta Air Lines', employees: 40000, sector: 'Transportation' },
    { name: 'Emory University', employees: 32000, sector: 'Education/Healthcare' },
    { name: 'The Home Depot', employees: 28000, sector: 'Retail' },
    { name: 'Coca-Cola', employees: 21000, sector: 'Consumer Goods' },
    { name: 'UPS', employees: 18000, sector: 'Logistics' },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.cyan, marginBottom: 8 }}>
            <Users size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            POPULATION
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {(msa.population / 1000000).toFixed(1)}M
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+{msa.populationGrowth}% YoY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>
            <Briefcase size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            EMPLOYMENT
          </div>
          <div style={{ ...terminalStyles.metricValue }}>
            {(msa.employment / 1000000).toFixed(1)}M
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+{msa.employmentGrowth}% YoY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <DollarSign size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            MEDIAN INCOME
          </div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.green }}>
            ${(msa.medianIncome / 1000).toFixed(0)}K
          </div>
          <div style={{ fontSize: 10, color: BT.text.green }}>+{msa.incomeGrowth}% YoY</div>
        </div>
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>UNEMPLOYMENT</div>
          <div style={{ ...terminalStyles.metricValue }}>3.8%</div>
          <div style={{ fontSize: 10, color: BT.text.green }}>-0.3% vs LY</div>
        </div>
      </div>

      {/* Employment & Population Chart */}
      <TerminalChart
        title="Employment & Population Growth (000s)"
        data={employmentData}
        series={[
          { key: 'employment', name: 'Employment', color: BT.text.cyan, data: [] },
          { key: 'population', name: 'Population', color: BT.text.amber, data: [] },
        ]}
        height={180}
        valueFormatter={(v) => `${(v / 1000).toFixed(1)}M`}
      />

      {/* Top Employers */}
      <div style={{ ...terminalStyles.panel, padding: 16 }}>
        <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
          <Briefcase size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Top Employers
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Company</th>
              <th style={{ ...terminalStyles.th, textAlign: 'right' }}>Employees</th>
              <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Sector</th>
            </tr>
          </thead>
          <tbody>
            {topEmployers.map((emp) => (
              <tr key={emp.name} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.td, fontWeight: 500 }}>{emp.name}</td>
                <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {emp.employees.toLocaleString()}
                </td>
                <td style={{ ...terminalStyles.td, color: BT.text.muted }}>{emp.sector}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MSAEconomicsTab;
