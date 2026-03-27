/**
 * OverviewTab - Comprehensive property overview with all signals
 * Integrated from pre-Bloomberg: DealsTab (quadrants, PCS, lifecycle, traffic)
 * Features: Key metrics, Quadrant, PCS, Lifecycle, Sponsor Health, Scenarios
 */

import React, { useMemo } from 'react';
import { BT, fmt, terminalStyles } from '../theme';
import { TerminalChart, ChartSeries, ChartDataPoint } from '../TerminalChart';
import {
  SIGNAL_GROUPS,
  BT_SIGNAL_COLORS,
  QUADRANT_STYLES,
  Quadrant,
  LIFECYCLE_STYLES,
  LifecyclePhase,
  TRAFFIC_QUAL_STYLES,
  TrafficQualification,
  PCSComponents,
  calculatePCS,
  scoreColor,
} from '../signalGroups';

interface OverviewTabProps {
  dealId: string;
  deal: any;
}

// Financial metrics for scenario comparison
const METRICS = [
  { key: 'irr', label: 'IRR', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'equityMultiple', label: 'Equity Multiple', format: (v: number) => `${v.toFixed(2)}x` },
  { key: 'cashOnCash', label: 'Cash-on-Cash', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'noi', label: 'Year 1 NOI', format: (v: number) => fmt.currency(v) },
  { key: 'dscr', label: 'DSCR', format: (v: number) => `${v.toFixed(2)}x` },
  { key: 'yoc', label: 'Yield on Cost', format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'exitValue', label: 'Exit Value', format: (v: number) => fmt.currency(v) },
];

// PCS component definitions
const PCS_COMPONENTS = [
  { key: 'trafficPerformance', label: 'Traffic Performance', code: 'T-02/03' },
  { key: 'revenueStrength', label: 'Revenue Strength', code: 'P-03/10' },
  { key: 'operationalQuality', label: 'Operational Quality', code: 'P-10/11' },
  { key: 'assetCondition', label: 'Asset Condition', code: 'P-01/R-06' },
  { key: 'marketPosition', label: 'Market Position', code: 'C-05' },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({ dealId, deal }) => {
  // Extract deal data with defaults
  const propertyName = deal?.name || deal?.property?.name || 'Property';
  const units = deal?.units || deal?.property?.units || 180;
  const yearBuilt = deal?.yearBuilt || deal?.property?.yearBuilt || 1992;
  const propertyClass = deal?.class || deal?.property?.class || 'B';
  const submarket = deal?.submarket || deal?.property?.submarket || 'Midtown';

  // Classification data
  const quadrant: Quadrant = deal?.quadrant || 'Hidden Gem';
  const lifecyclePhase: LifecyclePhase = deal?.lifecyclePhase || 'Acceleration';
  const trafficQual: TrafficQualification = deal?.trafficQualified || 'Qualified';
  const jediScore = deal?.jediScore || 92;
  const targetScore = deal?.targetScore || 91;

  // PCS components
  const pcsComponents: PCSComponents = deal?.pcsComponents || {
    trafficPerformance: 76,
    revenueStrength: 88,
    operationalQuality: 71,
    assetCondition: 62,
    marketPosition: 54,
  };
  const pcsScore = calculatePCS(pcsComponents);
  const pcsRank = deal?.pcsRank || 3;
  const pcsMovement = deal?.pcsMovement || 'up';
  const pcsMovementDelta = deal?.pcsMovementDelta || 2;

  // Strategy & Arbitrage
  const strategy = deal?.strategy || 'Value-Add Flip';
  const arbSpread = deal?.arbSpread || '+7.4%';
  const lossToLease = deal?.lossToLease || '$220/unit';
  const lossToLeasePct = deal?.lossToLeasePct || '14.8%';

  // Traffic metrics
  const physicalScore = deal?.physicalScore || 76;
  const digitalScore = deal?.digitalScore || 34;
  const walkIns = deal?.walkIns || '1,840/week';
  const captureRate = deal?.captureRate || '12.4%';
  const trafficShare = deal?.trafficShare || '8.2%';
  const tar = deal?.tar || 1.28;

  // Owner & Motivation
  const sellerMotivation = deal?.sellerMotivation || 78;
  const holdPeriod = deal?.holdPeriod || '6.9 years';
  const debtMaturity = deal?.debtMaturity || 'Q3 2026';
  const ownerEntity = deal?.ownerEntity || 'Greystone Capital Partners LLC';

  // Sponsor Health
  const managementCompany = deal?.managementCompany || 'Peachtree Residential';
  const managementPcsPercentile = deal?.managementPcsPercentile || 31;
  const managementRating = deal?.managementRating || 'bottom quartile';

  // Scenario data
  const scenarios = useMemo(() => {
    const model = deal?.model || deal?.latestModel || {};
    const results = model?.results?.summary || {};
    const s = model?.scenarios || {};
    
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
      best: s.best || { ...base, irr: base.irr * 1.15, equityMultiple: base.equityMultiple * 1.2 },
      worst: s.worst || { ...base, irr: base.irr * 0.75, equityMultiple: base.equityMultiple * 0.7 },
    };
  }, [deal]);

  // Exit score calculation
  const exitScore = useMemo(() => {
    const rentGrowth = (deal?.marketContext?.rent_growth || 0.04) * 100;
    const rate = 4.15;
    const supply = 200;
    const rentScore = Math.max(0, Math.min(100, (rentGrowth / 10) * 100)) * 0.40;
    const rateScore = Math.max(0, Math.min(100, ((5.0 - rate) / 2.0) * 100)) * 0.35;
    const supplyScore = Math.max(0, Math.min(100, ((400 - supply) / 400) * 100)) * 0.25;
    return Math.round(Math.max(0, Math.min(100, rentScore + rateScore + supplyScore)));
  }, [deal]);

  const quadrantStyle = QUADRANT_STYLES[quadrant];
  const lifecycleStyle = LIFECYCLE_STYLES[lifecyclePhase];
  const trafficQualStyle = TRAFFIC_QUAL_STYLES[trafficQual];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: Property Info + Classifications */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Property Card */}
        <div style={{ flex: '0 0 300px', ...terminalStyles.card, padding: 20 }}>
          <div style={{ fontSize: 10, color: BT.text.cyan, fontFamily: 'monospace', marginBottom: 4 }}>
            DEAL #{dealId?.slice(-6) || '000001'}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: BT.text.primary, marginBottom: 8 }}>
            {propertyName}
          </h2>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div>
              <span style={{ color: BT.text.muted, fontSize: 11 }}>Units</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{units}</div>
            </div>
            <div>
              <span style={{ color: BT.text.muted, fontSize: 11 }}>Year</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{yearBuilt}</div>
            </div>
            <div>
              <span style={{ color: BT.text.muted, fontSize: 11 }}>Class</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{propertyClass}</div>
            </div>
            <div>
              <span style={{ color: BT.text.muted, fontSize: 11 }}>Submarket</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{submarket}</div>
            </div>
          </div>
          
          {/* Strategy Badge */}
          <div style={{
            padding: '8px 12px',
            background: BT.bg.elevated,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ color: BT.text.muted, fontSize: 11 }}>Strategy:</span>
            <span style={{ color: BT.text.green, fontWeight: 600, fontSize: 13 }}>{strategy}</span>
          </div>
        </div>

        {/* Classifications Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {/* JEDI Score */}
          <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.cyan, fontFamily: 'monospace' }}>C-01 JEDI</div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: scoreColor(jediScore).btText,
              marginTop: 4,
            }}>
              {jediScore}
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Target: {targetScore}</div>
          </div>

          {/* Quadrant */}
          <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Quadrant</div>
            <div style={{
              marginTop: 8,
              padding: '6px 12px',
              background: quadrantStyle.btBg,
              color: quadrantStyle.btText,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
            }}>
              {quadrant}
            </div>
          </div>

          {/* Lifecycle Phase */}
          <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Lifecycle</div>
            <div style={{
              marginTop: 8,
              padding: '6px 12px',
              background: lifecycleStyle.btBg,
              color: lifecycleStyle.btText,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}>
              <span>{lifecycleStyle.icon}</span>
              {lifecyclePhase}
            </div>
          </div>

          {/* Traffic Qualification */}
          <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Traffic</div>
            <div style={{
              marginTop: 8,
              padding: '6px 12px',
              background: trafficQualStyle.btBg,
              color: trafficQualStyle.btText,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
            }}>
              {trafficQualStyle.icon} {trafficQual}
            </div>
            <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>
              TAR: {tar.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Key Metrics + PCS */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Arbitrage & Value Metrics */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
            Value Arbitrage
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Arb Spread</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: BT.text.green }}>{arbSpread}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Loss-to-Lease</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary }}>{lossToLease}</div>
              <div style={{ fontSize: 11, color: BT.accent.amber }}>{lossToLeasePct}</div>
            </div>
            <div style={{ padding: 12, background: BT.bg.elevated, borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Exit Score</div>
              <div style={{ 
                fontSize: 22, 
                fontWeight: 700, 
                color: scoreColor(exitScore).btText,
              }}>
                {exitScore}
              </div>
            </div>
          </div>

          {/* Traffic Metrics Row */}
          <div style={{ 
            marginTop: 16,
            padding: 12,
            background: BT_SIGNAL_COLORS.TRAFFIC.bg,
            borderRadius: 6,
            borderLeft: `3px solid ${BT_SIGNAL_COLORS.TRAFFIC.primary}`,
          }}>
            <div style={{ fontSize: 10, color: BT.text.cyan, marginBottom: 8, fontFamily: 'monospace' }}>
              TRAFFIC ENGINE
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontSize: 10, color: BT.text.muted }}>Physical</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{physicalScore}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: BT.text.muted }}>Digital</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{digitalScore}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: BT.text.muted }}>Walk-Ins</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{walkIns}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: BT.text.muted }}>Capture</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{captureRate}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: BT.text.muted }}>Share</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: BT.text.primary }}>{trafficShare}</div>
              </div>
            </div>
          </div>
        </div>

        {/* PCS Score Breakdown */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Property Competitive Score (PCS)
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 10px',
                background: scoreColor(pcsScore).btBg,
                color: scoreColor(pcsScore).btText,
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 700,
              }}>
                {pcsScore}
              </span>
              <span style={{
                fontSize: 11,
                color: pcsMovement === 'up' ? BT.text.green : BT.accent.red,
              }}>
                {pcsMovement === 'up' ? '▲' : '▼'} {pcsMovementDelta} (Rank #{pcsRank})
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PCS_COMPONENTS.map(comp => {
              const val = (pcsComponents as any)[comp.key];
              const colors = scoreColor(val);
              return (
                <div key={comp.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: BT.text.secondary }}>{comp.label}</span>
                      <span style={{ fontSize: 9, color: BT.text.cyan, fontFamily: 'monospace' }}>{comp.code}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors.btText }}>{val}</span>
                  </div>
                  <div style={{
                    height: 6,
                    background: BT.bg.elevated,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${val}%`,
                      height: '100%',
                      background: colors.btText,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Seller Motivation + Sponsor Health */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Seller Motivation */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
            Seller Motivation Analysis
          </h3>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: '0 0 100px', textAlign: 'center' }}>
              <div style={{ 
                fontSize: 42, 
                fontWeight: 700, 
                color: sellerMotivation > 70 ? BT.text.green : sellerMotivation > 50 ? BT.accent.amber : BT.accent.red,
              }}>
                {sellerMotivation}
              </div>
              <div style={{ fontSize: 11, color: BT.text.muted }}>Motivation Score</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: BT.bg.elevated, borderRadius: 4 }}>
                <span style={{ fontSize: 11, color: BT.text.muted }}>Hold Period</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: BT.text.primary }}>{holdPeriod}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: BT.bg.elevated, borderRadius: 4 }}>
                <span style={{ fontSize: 11, color: BT.text.muted }}>Debt Maturity</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: BT.accent.amber }}>{debtMaturity}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: BT.bg.elevated, borderRadius: 4 }}>
                <span style={{ fontSize: 11, color: BT.text.muted }}>Owner</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: BT.text.secondary }}>{ownerEntity}</span>
              </div>
            </div>
          </div>
          
          {sellerMotivation > 70 && (
            <div style={{
              marginTop: 12,
              padding: 10,
              background: 'rgba(34,197,94,0.1)',
              borderLeft: `3px solid ${BT.text.green}`,
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: BT.text.green }}>
                ⚡ TRIPLE TRIGGER CANDIDATE
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 2 }}>
                Hold period + debt maturity + motivation align for potential off-market opportunity
              </div>
            </div>
          )}
        </div>

        {/* Sponsor Health */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
            Sponsor Health
          </h3>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 4 }}>Management Company</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: BT.text.primary, marginBottom: 12 }}>
                {managementCompany}
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: BT.text.muted }}>PCS Percentile</div>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 700, 
                    color: managementPcsPercentile < 50 ? BT.accent.red : BT.text.green,
                  }}>
                    {managementPcsPercentile}%
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: BT.text.muted }}>Rating</div>
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: managementRating.includes('bottom') ? BT.accent.red : BT.text.primary,
                    textTransform: 'capitalize',
                  }}>
                    {managementRating}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Performance Gap Indicator */}
            <div style={{
              padding: 16,
              background: managementPcsPercentile < 50 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              borderRadius: 8,
              textAlign: 'center',
              minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Performance Gap</div>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: managementPcsPercentile < 50 ? BT.text.green : BT.text.muted,
              }}>
                {managementPcsPercentile < 50 ? '★ UPSIDE' : '—'}
              </div>
              {managementPcsPercentile < 50 && (
                <div style={{ fontSize: 10, color: BT.text.green, marginTop: 4 }}>
                  New management could improve PCS
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Scenario Comparison */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
          Scenario Comparison
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Metric</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>
                <span style={{ color: BT.accent.red }}>Worst</span>
              </th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>
                <span style={{ color: BT.text.cyan }}>Base</span>
              </th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>
                <span style={{ color: BT.text.green }}>Best</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(metric => (
              <tr key={metric.key} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ ...terminalStyles.tableCell }}>{metric.label}</td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.accent.red }}>
                  {metric.format((scenarios.worst as any)[metric.key])}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.cyan, fontWeight: 600 }}>
                  {metric.format((scenarios.base as any)[metric.key])}
                </td>
                <td style={{ ...terminalStyles.tableCell, textAlign: 'right', color: BT.text.green }}>
                  {metric.format((scenarios.best as any)[metric.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OverviewTab;
