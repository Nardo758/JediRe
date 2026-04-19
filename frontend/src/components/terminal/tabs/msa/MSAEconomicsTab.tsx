/**
 * MSAEconomicsTab - Employment, population, income, sector composition
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Users, Briefcase, DollarSign, MapPin, Database } from 'lucide-react';
import { BT, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint } from '../../TerminalChart';
import { TerminalSection, DataTable } from '../../TerminalLayouts';
import { MSAData } from '../../MSATerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary } from '../../commentary';
import { apiClient } from '../../../../services/api.client';

interface LaborRow {
  naics_code: string;
  naics_label: string;
  total_employment: number | null;
  yoy_change_pct: number | null;
  avg_weekly_wage: number | null;
  establishment_count: number | null;
  bls_citation_tag: string | null;
}

interface MacroSnapshot {
  ffr: number | null;
  sofr: number | null;
  t10y: number | null;
  t30y_mtg: number | null;
  gdp_growth_pct: number | null;
  cpi_yoy_pct: number | null;
  unrate: number | null;
  consumer_sentiment: number | null;
  snapshot_date: string | null;
}

interface MSAEconomicsTabProps {
  msaId: string;
  msa: MSAData;
}

const NAICS_ORDER = ['531', '236', '522', '623', '611', '621', '493', '721'];

export const MSAEconomicsTab: React.FC<MSAEconomicsTabProps> = ({ msaId, msa }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);

  const [econData, setEconData] = useState<{ macro: MacroSnapshot | null; labor: LaborRow[] }>({ macro: null, labor: [] });
  const [econLoading, setEconLoading] = useState(false);

  useEffect(() => {
    fetchCommentary('msa', msaId, msaName);
  }, [msaId, msaName]);

  useEffect(() => {
    if (!msaId) return;
    const numericId = msaId.match(/^\d+$/) ? msaId : null;
    if (!numericId) return;
    setEconLoading(true);
    apiClient.get<{ success: boolean; data: { macro: MacroSnapshot; labor: LaborRow[] } }>(
      `/api/v1/economic-context?msaId=${numericId}&businessType=multifamily`
    ).then(res => {
      if (res.data.success) setEconData({ macro: res.data.data.macro, labor: res.data.data.labor });
    }).catch(() => {}).finally(() => setEconLoading(false));
  }, [msaId]);

  const sortedLabor = useMemo(() => {
    if (!econData.labor.length) return [];
    return [...econData.labor].sort((a, b) => {
      const ai = NAICS_ORDER.indexOf(a.naics_code);
      const bi = NAICS_ORDER.indexOf(b.naics_code);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [econData.labor]);

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

  const macro = econData.macro;
  const citationDate = macro?.snapshot_date ? macro.snapshot_date.slice(0, 10) : 'N/A';

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

      {macro && (
        <div style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 3, padding: 14, background: BT.bg.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Database size={11} color={BT.text.cyan} />
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.1em' }}>
              NATIONAL MACRO INDICATORS
            </span>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: BT.text.dim, marginLeft: 'auto' }}>
              FRED {citationDate}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'GDP GROWTH', value: macro.gdp_growth_pct !== null ? `${macro.gdp_growth_pct > 0 ? '+' : ''}${macro.gdp_growth_pct.toFixed(2)}%` : 'N/A', good: macro.gdp_growth_pct !== null && macro.gdp_growth_pct >= 2, warn: macro.gdp_growth_pct !== null && macro.gdp_growth_pct >= 0 && macro.gdp_growth_pct < 2 },
              { label: 'CPI YoY', value: macro.cpi_yoy_pct !== null ? `${macro.cpi_yoy_pct.toFixed(2)}%` : 'N/A', good: macro.cpi_yoy_pct !== null && macro.cpi_yoy_pct <= 2.5, warn: macro.cpi_yoy_pct !== null && macro.cpi_yoy_pct > 2.5 && macro.cpi_yoy_pct <= 3.5 },
              { label: 'UNEMPLOYMENT', value: macro.unrate !== null ? `${macro.unrate.toFixed(1)}%` : 'N/A', good: macro.unrate !== null && macro.unrate <= 4.5, warn: macro.unrate !== null && macro.unrate > 4.5 && macro.unrate <= 5.5 },
              { label: 'SENTIMENT', value: macro.consumer_sentiment !== null ? macro.consumer_sentiment.toFixed(1) : 'N/A', good: macro.consumer_sentiment !== null && macro.consumer_sentiment >= 70, warn: macro.consumer_sentiment !== null && macro.consumer_sentiment >= 55 && macro.consumer_sentiment < 70 },
            ].map(({ label, value, good, warn }) => {
              const color = good ? BT.text.green : warn ? BT.text.amber : BT.accent.red;
              return (
                <div key={label} style={{ textAlign: 'center', padding: '8px 0', borderRight: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, color: BT.text.muted, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color }}>{value}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(sortedLabor.length > 0 || econLoading) && (
        <TerminalSection title={`BLS LABOR — ${msaName.toUpperCase()} [QCEW]`} icon={<Database size={13} style={{ marginRight: 8, verticalAlign: 'middle', color: BT.text.cyan }} />}>
          {econLoading && !sortedLabor.length ? (
            <div style={{ padding: 12, color: BT.text.muted, fontSize: 11 }}>Loading BLS data…</div>
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Sector</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Employment</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>YoY</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Avg Wage/Wk</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Establishments</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Citation</th>
                </tr>
              </thead>
              <tbody>
                {sortedLabor.map(row => {
                  const yoyColor = row.yoy_change_pct === null ? BT.text.muted : row.yoy_change_pct >= 1 ? BT.text.green : row.yoy_change_pct >= 0 ? BT.text.amber : BT.accent.red;
                  return (
                    <tr key={row.naics_code} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ ...terminalStyles.tableCell, fontWeight: 500 }}>{row.naics_label || `NAICS ${row.naics_code}`}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                        {row.total_employment !== null ? row.total_employment.toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: yoyColor, fontWeight: 600 }}>
                        {row.yoy_change_pct !== null ? `${row.yoy_change_pct >= 0 ? '+' : ''}${row.yoy_change_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'", color: BT.text.cyan }}>
                        {row.avg_weekly_wage !== null ? `$${row.avg_weekly_wage.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontFamily: "'JetBrains Mono'" }}>
                        {row.establishment_count !== null ? row.establishment_count.toLocaleString() : '—'}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, fontSize: 9, color: BT.text.dim }}>
                        {row.bls_citation_tag || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </TerminalSection>
      )}

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
        <TerminalSection title="Sector Composition">
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
        </TerminalSection>

        <TerminalSection title="Income Distribution & Renter Propensity" icon={<DollarSign size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
          <DataTable>
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
          </DataTable>
        </TerminalSection>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <TerminalSection title="Top Employers" icon={<Briefcase size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
          <DataTable>
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
          </DataTable>
        </TerminalSection>

        <TerminalSection title="Net Migration (Top Origins)" icon={<MapPin size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />}>
          <DataTable>
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
          </DataTable>
        </TerminalSection>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating economics analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.demand && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.demand} />
            </div>
          )}
          {commentary.signalCommentary?.pricing_power && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="demand" commentary={commentary.signalCommentary.pricing_power} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSAEconomicsTab;
