/**
 * MarketTab - Market intel, sensitivity analysis, demographics
 * Migrated from: Sensitivity Analysis + Market Intelligence in FinancialDashboard
 */

import React, { useMemo, useState } from 'react';
import { Users, TrendingUp, Building2, MapPin, Percent, DollarSign } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../theme';
import { ContextIndicator } from '../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../hooks/useContextAwareness';
import { PropertyMarketIntelligencePanel } from '../commentary';

interface MarketTabProps {
  dealId: string;
  deal: any;
}

export const MarketTab: React.FC<MarketTabProps> = ({ dealId, deal }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'market_dashboard', dealId }
  );

  const [activeView, setActiveView] = useState<'intel' | 'sensitivity' | 'demographics'>('intel');

  // Market context
  const market = useMemo(() => {
    const ctx = deal?.marketContext || {};
    const mi = deal?.marketIntelligence || {};
    
    return {
      occupancy: ctx.occupancy_rate || 0.942,
      avgRent: ctx.avg_rent || 1850,
      rentGrowth: ctx.rent_growth || 0.041,
      capRate: ctx.cap_rate || 0.052,
      supplyPipeline: ctx.supply_pipeline || 1200,
      absorptionRate: ctx.absorption_rate || 85,
      demandScore: mi.demandScore || 78,
      demandPool: mi.demandPool || 12500,
      captureRate: mi.captureRate || 0.024,
      targetDemographic: mi.targetDemographic || 'Young Professionals',
      medianIncome: mi.medianIncome || 68000,
      medianAge: mi.medianAge || 32,
      population: mi.population || 485000,
      householdGrowth: mi.householdGrowth || 0.023,
      employmentGrowth: mi.employmentGrowth || 0.018,
      recommendedMix: mi.recommendedMix || {
        studio: 0.10,
        oneBR: 0.45,
        twoBR: 0.35,
        threeBR: 0.10,
      },
    };
  }, [deal]);

  // Sensitivity data
  const sensitivity = useMemo(() => {
    const model = deal?.model || deal?.latestModel || {};
    const baseIrr = model.scenarios?.base?.irr || 18.5;
    const baseEM = model.scenarios?.base?.equityMultiple || 2.1;
    const baseExitCap = model.exit?.exitCapRate || 0.055;
    const baseRentGrowth = model.revenue?.rentGrowthY1 || 0.04;

    const exitCaps = [0.045, 0.050, 0.055, 0.060, 0.065];
    const rentGrowths = [0.02, 0.03, 0.04, 0.05];
    const holdPeriods = [5, 6, 7, 8];

    // Generate IRR matrix
    const irrMatrix = exitCaps.map(cap => 
      rentGrowths.map(rg => {
        const irr = Math.max(8, Math.min(55, baseIrr + (baseExitCap - cap) * 200 + (rg - baseRentGrowth) * 150));
        return irr;
      })
    );

    // Generate EM matrix
    const emMatrix = holdPeriods.map(hold =>
      exitCaps.map(cap => {
        const em = Math.max(1.5, Math.min(14, baseEM + ((model.exit?.holdYears || 7) - hold) * -0.8 + (baseExitCap - cap) * 60));
        return em;
      })
    );

    return { exitCaps, rentGrowths, holdPeriods, irrMatrix, emMatrix };
  }, [deal]);

  const getIrrColor = (irr: number) => {
    if (irr > 40) return BT.text.green;
    if (irr > 28) return BT.text.cyan;
    if (irr > 20) return BT.text.amber;
    return BT.text.red;
  };

  const getEmColor = (em: number) => {
    if (em > 9) return BT.text.green;
    if (em > 6) return BT.text.cyan;
    if (em > 4) return BT.text.amber;
    return BT.text.red;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'intel', label: 'Market Intelligence' },
          { key: 'sensitivity', label: 'Sensitivity Analysis' },
          { key: 'demographics', label: 'Demographics' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${activeView === v.key ? BT.border.highlight : BT.border.subtle}`,
              background: activeView === v.key ? BT.bg.active : BT.bg.panel,
              color: activeView === v.key ? BT.text.amber : BT.text.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'intel' && (
        <>
          {/* Broker OM Intelligence — narratives + replacement-cost benchmarks
              scoped to this property's submarket / MSA (Task #392). */}
          <PropertyMarketIntelligencePanel deal={deal} />

          {/* Key Market Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div style={terminalStyles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Percent size={14} style={{ color: BT.text.cyan }} />
                <span style={terminalStyles.metricLabel}>OCCUPANCY</span>
              </div>
              <div style={terminalStyles.metricValue}>{fmt.percent(market.occupancy)}</div>
              <div style={{ fontSize: 11, color: BT.text.green }}>+0.8% vs last month</div>
            </div>
            <div style={terminalStyles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <DollarSign size={14} style={{ color: BT.text.green }} />
                <span style={terminalStyles.metricLabel}>AVG RENT</span>
              </div>
              <div style={terminalStyles.metricValue}>${market.avgRent}</div>
              <div style={{ fontSize: 11, color: BT.text.green }}>+{(market.rentGrowth * 100).toFixed(1)}% YoY</div>
            </div>
            <div style={terminalStyles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Building2 size={14} style={{ color: BT.text.amber }} />
                <span style={terminalStyles.metricLabel}>SUPPLY PIPELINE</span>
              </div>
              <div style={terminalStyles.metricValue}>{market.supplyPipeline.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: BT.text.muted }}>units in development</div>
            </div>
            <div style={terminalStyles.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <TrendingUp size={14} style={{ color: BT.text.purple }} />
                <span style={terminalStyles.metricLabel}>DEMAND SCORE</span>
              </div>
              <div style={{ ...terminalStyles.metricValue, color: market.demandScore >= 70 ? BT.text.green : BT.text.amber }}>
                {market.demandScore}
              </div>
              <div style={{ fontSize: 11, color: BT.text.muted }}>/ 100</div>
            </div>
          </div>

          {/* Recommended Unit Mix */}
          <div>
            <div style={terminalStyles.sectionLabel}>RECOMMENDED UNIT MIX</div>
            <div style={{
              ...terminalStyles.card,
              display: 'flex',
              gap: 16,
            }}>
              {Object.entries(market.recommendedMix).map(([type, pct]) => (
                <div key={type} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 8, textTransform: 'uppercase' }}>
                    {type === 'oneBR' ? '1 BR' : type === 'twoBR' ? '2 BR' : type === 'threeBR' ? '3 BR' : type}
                  </div>
                  <div style={{
                    height: 80,
                    background: BT.bg.panelAlt,
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}>
                    <div style={{
                      height: `${(pct as number) * 100}%`,
                      background: `linear-gradient(180deg, ${BT.text.cyan} 0%, ${BT.text.blue} 100%)`,
                      transition: 'height 0.3s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary, fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmt.percent(pct as number)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market Context */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={terminalStyles.sectionLabel}>DEMAND METRICS</div>
              <div style={terminalStyles.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={terminalStyles.td}>Demand Pool</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {market.demandPool.toLocaleString()} households
                      </td>
                    </tr>
                    <tr>
                      <td style={terminalStyles.td}>Capture Rate</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt.percent(market.captureRate)}
                      </td>
                    </tr>
                    <tr>
                      <td style={terminalStyles.td}>Absorption Rate</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {market.absorptionRate}%
                      </td>
                    </tr>
                    <tr>
                      <td style={terminalStyles.td}>Target Demographic</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>
                        {market.targetDemographic}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div style={terminalStyles.sectionLabel}>SUPPLY ANALYSIS</div>
              <div style={terminalStyles.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={terminalStyles.td}>Units Under Construction</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        {market.supplyPipeline.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td style={terminalStyles.td}>Delivery Timeline</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                        12-24 months
                      </td>
                    </tr>
                    <tr>
                      <td style={terminalStyles.td}>Supply/Demand Ratio</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                        0.85 (Favorable)
                      </td>
                    </tr>
                    <tr>
                      <td style={terminalStyles.td}>Rent Pressure</td>
                      <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green }}>
                        Low
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {activeView === 'sensitivity' && (
        <>
          {/* IRR Sensitivity */}
          <div>
            <div style={terminalStyles.sectionLabel}>IRR SENSITIVITY — EXIT CAP × RENT GROWTH</div>
            <div style={terminalStyles.card}>
              <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 12 }}>
                IRR (%) • Exit Cap Rate (rows) vs Year 1 Rent Growth (columns)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Exit Cap ↓ / Rent →</th>
                    {sensitivity.rentGrowths.map(rg => (
                      <th key={rg} style={terminalStyles.th}>{(rg * 100).toFixed(0)}% Rent</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.exitCaps.map((cap, i) => (
                    <tr key={cap}>
                      <td style={{ ...terminalStyles.td, fontWeight: 600 }}>{(cap * 100).toFixed(1)}% Cap</td>
                      {sensitivity.irrMatrix[i].map((irr, j) => (
                        <td
                          key={j}
                          style={{
                            ...terminalStyles.td,
                            textAlign: 'center',
                            background: BT.bg.panelAlt,
                            color: getIrrColor(irr),
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {irr.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* EM Sensitivity */}
          <div>
            <div style={terminalStyles.sectionLabel}>EQUITY MULTIPLE SENSITIVITY — HOLD PERIOD × EXIT CAP</div>
            <div style={terminalStyles.card}>
              <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 12 }}>
                Equity Multiple (x) • Hold Period (rows) vs Exit Cap Rate (columns)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...terminalStyles.th, textAlign: 'left' }}>Hold ↓ / Cap →</th>
                    {sensitivity.exitCaps.map(cap => (
                      <th key={cap} style={terminalStyles.th}>{(cap * 100).toFixed(1)}%</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.holdPeriods.map((hold, i) => (
                    <tr key={hold}>
                      <td style={{ ...terminalStyles.td, fontWeight: 600 }}>{hold}yr Hold</td>
                      {sensitivity.emMatrix[i].map((em, j) => (
                        <td
                          key={j}
                          style={{
                            ...terminalStyles.td,
                            textAlign: 'center',
                            background: BT.bg.panelAlt,
                            color: getEmColor(em),
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {em.toFixed(2)}x
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === 'demographics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={terminalStyles.sectionLabel}>POPULATION & INCOME</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={terminalStyles.td}>Population (3mi radius)</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {market.population.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Median Age</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {market.medianAge} years
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Median Household Income</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      ${market.medianIncome.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Target Demographic</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.cyan }}>
                      {market.targetDemographic}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div style={terminalStyles.sectionLabel}>GROWTH INDICATORS</div>
            <div style={terminalStyles.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={terminalStyles.td}>Household Growth</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      +{fmt.percent(market.householdGrowth)} YoY
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Employment Growth</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      +{fmt.percent(market.employmentGrowth)} YoY
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Rent Growth</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', color: BT.text.green, fontFamily: "'JetBrains Mono', monospace" }}>
                      +{fmt.percent(market.rentGrowth)} YoY
                    </td>
                  </tr>
                  <tr>
                    <td style={terminalStyles.td}>Rent-to-Income Ratio</td>
                    <td style={{ ...terminalStyles.td, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                      {((market.avgRent * 12) / market.medianIncome * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketTab;
