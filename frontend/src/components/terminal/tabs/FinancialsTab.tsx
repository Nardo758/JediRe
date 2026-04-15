/**
 * FinancialsTab - Pro forma, projections, assumptions, NOI
 * Migrated from: Assumptions + Projections views in FinancialDashboard
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, DollarSign, Building2, Percent } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { TerminalChart, ChartDataPoint, ChartSeries } from '../TerminalChart';
import { M35EventCard, M35EventCardData } from '../../m35/M35EventCard';

interface FinancialsTabProps {
  dealId: string;
  deal: any;
}

export const FinancialsTab: React.FC<FinancialsTabProps> = ({ dealId, deal }) => {
  const [holdFilter, setHoldFilter] = useState(7);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeView, setActiveView] = useState<'projections' | 'assumptions'>('projections');
  const [dealEvents, setDealEvents] = useState<M35EventCardData[]>([]);

  useEffect(() => {
    if (!dealId) return;
    fetch(`/api/v1/m35/deals/${dealId}/events`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then((data: { items?: Array<M35EventCardData & { maxDivergencePct?: number | null }>; events?: Array<M35EventCardData & { maxDivergencePct?: number | null }> }) => {
        const items = (data.items ?? data.events ?? []).slice(0, 4);
        setDealEvents(items.map(e => ({
          ...e,
          divergingForecast: e.maxDivergencePct != null && e.maxDivergencePct > 0.10,
        })));
      })
      .catch(() => setDealEvents([]));
  }, [dealId]);

  const toggle = (section: string) => setCollapsed(p => ({ ...p, [section]: !p[section] }));

  // Extract model data
  const model = useMemo(() => {
    const m = deal?.model || deal?.latestModel || {};
    const acq = m.acquisition || {};
    const capex = m.capex || {};
    const revenue = m.revenue || {};
    const results = m.results || {};
    
    // Build assumptions
    const assumptions = {
      units: acq.units || deal?.target_units || 300,
      sqft: acq.sqft || (acq.units || 300) * 1024,
      purchasePrice: acq.purchasePrice || deal?.budget || 45000000,
      closingCostsPct: acq.closingCostsPct || 0.02,
      interiorPerUnit: capex.interiorPerUnit || 5000,
      currentMonthlyRent: revenue.currentMonthlyRent || 500000,
      currentAvgRent: revenue.currentAvgRentOccupied || 1850,
      marketRent: revenue.currentAvgMarketRent || 1950,
      currentOccupancy: revenue.currentOccupancy || 0.93,
      stabilizedOccupancy: revenue.stabilizedOccupancy || 0.95,
      rentGrowthY1: revenue.rentGrowthY1 || 0.04,
      rentGrowthY2: revenue.rentGrowthY2 || 0.035,
      rentGrowthY3: revenue.rentGrowthY3 || 0.03,
    };

    // Generate cash flow projections
    const cashFlows = results.annualCashFlow || Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const rentGrowth = i === 0 ? 1 : (1 + (i < 2 ? 0.04 : i < 4 ? 0.035 : 0.03));
      const baseRent = assumptions.currentMonthlyRent * 12;
      const potentialRent = baseRent * Math.pow(rentGrowth, i);
      const vacancy = potentialRent * (1 - (i < 2 ? assumptions.currentOccupancy : assumptions.stabilizedOccupancy));
      const collectionLoss = potentialRent * 0.01;
      const otherIncome = potentialRent * 0.03;
      const egr = potentialRent - vacancy - collectionLoss + otherIncome;
      const expenses = egr * 0.38;
      const noi = egr - expenses;
      const reserves = assumptions.units * 200;
      const noiAfterReserves = noi - reserves;
      const debtService = 1800000;
      const leveredCashFlow = noiAfterReserves - debtService;

      return {
        year,
        potentialRent,
        vacancy,
        collectionLoss,
        otherIncome,
        effectiveGrossRevenue: egr,
        totalExpenses: expenses,
        noi,
        replacementReserves: reserves,
        noiAfterReserves,
        debtService,
        leveredCashFlow,
      };
    });

    return { assumptions, cashFlows };
  }, [deal]);

  const filteredCF = model.cashFlows.slice(0, holdFilter);

  // Chart data
  const chartData: ChartDataPoint[] = model.cashFlows.slice(0, holdFilter).map(cf => ({
    date: `Y${cf.year}`,
    noi: cf.noi,
    cashFlow: cf.leveredCashFlow,
  }));

  const chartSeries: ChartSeries[] = [
    { key: 'noi', name: 'NOI', color: BT.text.green, data: [] },
    { key: 'cashFlow', name: 'Cash Flow', color: BT.text.cyan, data: [] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setActiveView('projections')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px solid ${activeView === 'projections' ? BT.border.highlight : BT.border.subtle}`,
            background: activeView === 'projections' ? BT.bg.active : BT.bg.panel,
            color: activeView === 'projections' ? BT.text.amber : BT.text.muted,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Projections
        </button>
        <button
          onClick={() => setActiveView('assumptions')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: `1px solid ${activeView === 'assumptions' ? BT.border.highlight : BT.border.subtle}`,
            background: activeView === 'assumptions' ? BT.bg.active : BT.bg.panel,
            color: activeView === 'assumptions' ? BT.text.amber : BT.text.muted,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Assumptions
        </button>
      </div>

      {activeView === 'projections' ? (
        <>
          {/* NOI Chart */}
          <TerminalChart
            title="NOI & Cash Flow Projections"
            data={chartData}
            series={chartSeries}
            height={200}
            timeRanges={['3Y', '5Y', '7Y', '10Y']}
            defaultRange="7Y"
            valueFormatter={fmt.currency}
            onRangeChange={(range) => setHoldFilter(parseInt(range))}
          />

          {/* Projections Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={terminalStyles.sectionLabel}>OPERATING STATEMENT PROJECTIONS</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[3, 5, 7, 10].map(y => (
                  <button
                    key={y}
                    onClick={() => setHoldFilter(y)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: holdFilter === y ? 700 : 400,
                      border: `1px solid ${holdFilter === y ? BT.border.highlight : BT.border.subtle}`,
                      background: holdFilter === y ? BT.bg.active : BT.bg.panel,
                      color: holdFilter === y ? BT.text.amber : BT.text.muted,
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {y}yr
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 8,
              overflow: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ ...terminalStyles.th, textAlign: 'left', position: 'sticky', left: 0, background: BT.bg.panelAlt }}>
                      Line Item
                    </th>
                    {filteredCF.map(cf => (
                      <th key={cf.year} style={{ ...terminalStyles.th, textAlign: 'right', minWidth: 100 }}>
                        Year {cf.year}{cf.year === holdFilter && ' ⚡'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue Section */}
                  <tr onClick={() => toggle('revenue')} style={{ cursor: 'pointer', background: BT.bg.panelAlt }}>
                    <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.primary }}>
                      {collapsed.revenue ? <ChevronRight size={14} style={{ display: 'inline', marginRight: 4 }} /> : <ChevronDown size={14} style={{ display: 'inline', marginRight: 4 }} />}
                      REVENUE
                    </td>
                    {filteredCF.map(cf => <td key={cf.year} style={terminalStyles.td} />)}
                  </tr>
                  {!collapsed.revenue && (
                    <>
                      <tr>
                        <td style={{ ...terminalStyles.td, paddingLeft: 24 }}>Gross Potential Rent</td>
                        {filteredCF.map(cf => (
                          <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmt.currency(cf.potentialRent)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ ...terminalStyles.td, paddingLeft: 24 }}>(Less) Vacancy</td>
                        {filteredCF.map(cf => (
                          <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.red, fontFamily: "'JetBrains Mono', monospace" }}>
                            ({fmt.currency(cf.vacancy)})
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ ...terminalStyles.td, paddingLeft: 24 }}>Other Income</td>
                        {filteredCF.map(cf => (
                          <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmt.currency(cf.otherIncome)}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                        <td style={{ ...terminalStyles.td, paddingLeft: 24, fontWeight: 600 }}>Effective Gross Revenue</td>
                        {filteredCF.map(cf => (
                          <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmt.currency(cf.effectiveGrossRevenue)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* Expenses Section */}
                  <tr onClick={() => toggle('expenses')} style={{ cursor: 'pointer', background: BT.bg.panelAlt }}>
                    <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.primary }}>
                      {collapsed.expenses ? <ChevronRight size={14} style={{ display: 'inline', marginRight: 4 }} /> : <ChevronDown size={14} style={{ display: 'inline', marginRight: 4 }} />}
                      EXPENSES
                    </td>
                    {filteredCF.map(cf => <td key={cf.year} style={terminalStyles.td} />)}
                  </tr>
                  {!collapsed.expenses && (
                    <tr>
                      <td style={{ ...terminalStyles.td, paddingLeft: 24 }}>Total Operating Expenses</td>
                      {filteredCF.map(cf => (
                        <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.red, fontFamily: "'JetBrains Mono', monospace" }}>
                          ({fmt.currency(cf.totalExpenses)})
                        </td>
                      ))}
                    </tr>
                  )}

                  {/* NOI */}
                  <tr style={{ background: BT.bg.panel }}>
                    <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.green }}>NET OPERATING INCOME</td>
                    {filteredCF.map(cf => (
                      <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt.currency(cf.noi)}
                      </td>
                    ))}
                  </tr>

                  {/* Reserves & Debt */}
                  <tr>
                    <td style={terminalStyles.td}>Replacement Reserves</td>
                    {filteredCF.map(cf => (
                      <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        ({fmt.currency(cf.replacementReserves)})
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Debt Service</td>
                    {filteredCF.map(cf => (
                      <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.red, fontFamily: "'JetBrains Mono', monospace" }}>
                        ({fmt.currency(cf.debtService)})
                      </td>
                    ))}
                  </tr>

                  {/* Levered Cash Flow */}
                  <tr style={{ background: BT.bg.panelAlt, borderTop: `2px solid ${BT.border.medium}` }}>
                    <td style={{ ...terminalStyles.td, fontWeight: 700, color: BT.text.cyan }}>LEVERED CASH FLOW</td>
                    {filteredCF.map(cf => (
                      <td key={cf.year} style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 700, color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt.currency(cf.leveredCashFlow)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Assumptions View */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Acquisition */}
          <div>
            <div style={terminalStyles.sectionLabel}>ACQUISITION ASSUMPTIONS</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={terminalStyles.td}>Number of Units</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {model.assumptions.units}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Total Square Feet</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {model.assumptions.sqft.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Purchase Price</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(model.assumptions.purchasePrice)}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Price Per Unit</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      ${Math.round(model.assumptions.purchasePrice / model.assumptions.units).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Closing Costs</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.percent(model.assumptions.closingCostsPct)} — {fmt.currency(model.assumptions.purchasePrice * model.assumptions.closingCostsPct)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue */}
          <div>
            <div style={terminalStyles.sectionLabel}>REVENUE ASSUMPTIONS</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={terminalStyles.td}>Current Avg Rent</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      ${model.assumptions.currentAvgRent.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Market Rent</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      ${model.assumptions.marketRent.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Current Occupancy</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.percent(model.assumptions.currentOccupancy)}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Stabilized Target</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.percent(model.assumptions.stabilizedOccupancy)}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Rent Growth Y1/Y2/Y3</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.percent(model.assumptions.rentGrowthY1)}/{fmt.percent(model.assumptions.rentGrowthY2)}/{fmt.percent(model.assumptions.rentGrowthY3)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* CapEx */}
          <div>
            <div style={terminalStyles.sectionLabel}>CAPITAL IMPROVEMENTS</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={terminalStyles.td}>Interior Reno $/Unit</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      ${model.assumptions.interiorPerUnit.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Total Interior CapEx</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(model.assumptions.interiorPerUnit * model.assumptions.units)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Derived */}
          <div>
            <div style={terminalStyles.sectionLabel}>DERIVED OUTPUTS</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={terminalStyles.td}>Year 1 NOI</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(model.cashFlows[0]?.noi || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Year 1 Cash Flow</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontWeight: 600, color: BT.text.cyan, fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmt.currency(model.cashFlows[0]?.leveredCashFlow || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* M35 Events — market events affecting this deal's pro forma assumptions */}
      {dealEvents.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
            M35 EVENTS — PRO FORMA RISK FLAGS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dealEvents.map(ev => (
              <M35EventCard key={ev.id} event={ev} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialsTab;
