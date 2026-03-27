/**
 * MSAEconomicsTab - Employment, population, income, sector composition
 */

import React, { useMemo } from 'react';
import { Users, Briefcase, DollarSign, MapPin } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { MSAData } from '../../MSATerminal';

interface MSAEconomicsTabProps {
  msaId: string;
  msa: MSAData;
}

export const MSAEconomicsTab: React.FC<MSAEconomicsTabProps> = ({ msaId, msa }) => {
  const msaName = msa?.name || msaId || 'Atlanta';

  const employmentData: ChartDataPoint[] = useMemo(() => [
    { date: '2020', employment: 2850, population: 5900 },
    { date: '2021', employment: 2920, population: 5980 },
    { date: '2022', employment: 3010, population: 6050 },
    { date: '2023', employment: 3060, population: 6120 },
    { date: '2024', employment: 3100, population: 6200 },
  ], []);

  const topEmployers = useMemo(() => [
    { name: 'Delta Air Lines', employees: 40000, sector: 'Transportation', growth: '+3.2%' },
    { name: 'Emory University', employees: 32000, sector: 'Education/Healthcare', growth: '+2.8%' },
    { name: 'The Home Depot', employees: 28000, sector: 'Retail', growth: '+1.4%' },
    { name: 'Coca-Cola', employees: 21000, sector: 'Consumer Goods', growth: '-0.8%' },
    { name: 'UPS', employees: 18000, sector: 'Logistics', growth: '+2.1%' },
    { name: 'Georgia-Pacific', employees: 15000, sector: 'Manufacturing', growth: '+0.6%' },
    { name: 'NCR Corporation', employees: 12000, sector: 'Technology', growth: '+5.4%' },
    { name: 'SunTrust/Truist', employees: 10000, sector: 'Financial Services', growth: '-1.2%' },
  ], []);

  const sectorComposition = useMemo(() => [
    { sector: 'Professional & Business', pct: 18.4, jobs: 571, trend: 'up' },
    { sector: 'Healthcare & Education', pct: 15.2, jobs: 472, trend: 'up' },
    { sector: 'Trade, Transport & Utilities', pct: 14.8, jobs: 459, trend: 'flat' },
    { sector: 'Government', pct: 12.6, jobs: 391, trend: 'flat' },
    { sector: 'Leisure & Hospitality', pct: 10.2, jobs: 316, trend: 'up' },
    { sector: 'Financial Activities', pct: 7.8, jobs: 242, trend: 'flat' },
    { sector: 'Information & Technology', pct: 6.4, jobs: 198, trend: 'up' },
    { sector: 'Manufacturing', pct: 5.2, jobs: 161, trend: 'down' },
    { sector: 'Construction', pct: 4.8, jobs: 149, trend: 'up' },
    { sector: 'Other', pct: 4.6, jobs: 143, trend: 'flat' },
  ], []);

  const migrationData = useMemo(() => [
    { origin: 'New York Metro', inflow: 12400, outflow: 4200, net: 8200 },
    { origin: 'Washington DC', inflow: 6800, outflow: 3100, net: 3700 },
    { origin: 'Chicago', inflow: 5200, outflow: 1800, net: 3400 },
    { origin: 'Los Angeles', inflow: 4600, outflow: 2400, net: 2200 },
    { origin: 'Miami', inflow: 3800, outflow: 4100, net: -300 },
  ], []);

  const incomeDistribution = useMemo(() => [
    { bracket: '<$25K', pct: 12.4, renters: 68 },
    { bracket: '$25-50K', pct: 18.2, renters: 54 },
    { bracket: '$50-75K', pct: 22.1, renters: 42 },
    { bracket: '$75-100K', pct: 16.8, renters: 28 },
    { bracket: '$100-150K', pct: 15.4, renters: 18 },
    { bracket: '$150K+', pct: 15.1, renters: 8 },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ ...terminalStyles.sectionTitle }}>
            {msaName} — Economic Indicators
          </h2>
          <span style={{ color: BT.text.muted, fontSize: 12 }}>
            Employment, demographics, sector composition
          </span>
        </div>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
            Sector Composition
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sectorComposition.map((s) => (
              <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: '0 0 180px', fontSize: 11, color: BT.text.secondary }}>{s.sector}</span>
                <div style={{ flex: 1, height: 8, background: BT.bg.elevated, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct * 4}%`, background: BT.accent.blue }} />
                </div>
                <span style={{ flex: '0 0 40px', fontSize: 10, color: BT.text.primary, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                  {s.pct}%
                </span>
                <span style={{
                  flex: '0 0 16px',
                  fontSize: 10,
                  color: s.trend === 'up' ? BT.text.green : s.trend === 'down' ? BT.accent.red : BT.text.muted,
                  fontWeight: 600,
                }}>
                  {s.trend === 'up' ? '▲' : s.trend === 'down' ? '▼' : '▬'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
            <DollarSign size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Income Distribution & Renter Propensity
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Bracket</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>% of HH</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>% Renter</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', width: 80 }}>Propensity</th>
              </tr>
            </thead>
            <tbody>
              {incomeDistribution.map((row) => (
                <tr key={row.bracket} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.bracket}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>{row.pct}%</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan }}>{row.renters}%</td>
                  <td style={{ ...terminalStyles.tableCell }}>
                    <div style={{ height: 6, background: BT.bg.elevated, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${row.renters}%`, background: BT.text.cyan }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
            <Briefcase size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Top Employers
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Company</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Employees</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Sector</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Growth</th>
              </tr>
            </thead>
            <tbody>
              {topEmployers.map((emp) => (
                <tr key={emp.name} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{emp.name}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                    {emp.employees.toLocaleString()}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, color: BT.text.muted }}>{emp.sector}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: emp.growth.startsWith('+') ? BT.text.green : BT.accent.red }}>
                    {emp.growth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ ...terminalStyles.sectionLabel, marginBottom: 16 }}>
            <MapPin size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Net Migration (Top Origins)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Origin</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>In</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Out</th>
                <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {migrationData.map((row) => (
                <tr key={row.origin} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.origin}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green }}>
                    {row.inflow.toLocaleString()}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.accent.red }}>
                    {row.outflow.toLocaleString()}
                  </td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontWeight: 600, color: row.net > 0 ? BT.text.green : BT.accent.red }}>
                    {row.net > 0 ? '+' : ''}{row.net.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MSAEconomicsTab;
