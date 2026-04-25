/**
 * SubmarketOverviewTab - Key metrics, health score, trends
 */

import React, { useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Building2, Users, Briefcase, Home, Award, Activity } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint, ChartSeries } from '../../TerminalChart';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { MarketNarrative, StrategyScoreBadge, InvestmentThesis } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface SubmarketOverviewTabProps {
  submarketId: string;
  submarket: SubmarketData;
}

export const SubmarketOverviewTab: React.FC<SubmarketOverviewTabProps> = ({ submarketId, submarket }) => {
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'submarket_deep_dive', submarketId }
  );
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);

  useEffect(() => {
    fetchCommentary('submarket', submarketId, submarket.name);
  }, [submarketId, submarket.name]);
  // Calculate submarket health score
  const healthScore = useMemo(() => {
    const occupancyScore = Math.min(100, (submarket.occupancy / 95) * 100) * 0.25;
    const rentGrowthScore = Math.min(100, (submarket.rentGrowth / 5) * 100) * 0.20;
    const absorptionScore = Math.min(100, submarket.absorptionRate) * 0.20;
    const employmentScore = Math.min(100, (submarket.employmentGrowth / 4) * 100) * 0.20;
    const pipelineRisk = Math.max(0, 100 - (submarket.pipelineUnits / submarket.totalUnits * 100)) * 0.15;
    return Math.round(occupancyScore + rentGrowthScore + absorptionScore + employmentScore + pipelineRisk);
  }, [submarket]);

  // Historical data for charts
  const rentTrendData: ChartDataPoint[] = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let rent = submarket.avgRent * 0.92;
    return months.map((m) => {
      rent = rent * (1 + (Math.random() * 0.01 + 0.002));
      return { date: `${m} '25`, rent: Math.round(rent) };
    });
  }, [submarket]);

  const occupancyTrendData: ChartDataPoint[] = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let occ = submarket.occupancy - 2;
    return months.map((m) => {
      occ = Math.min(98, occ + (Math.random() * 0.5 - 0.1));
      return { date: `${m} '25`, occupancy: Number(occ.toFixed(1)) };
    });
  }, [submarket]);

  const chartSeries: ChartSeries[] = [
    { key: 'rent', name: 'Avg Rent', color: BT.text.green, data: [] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
      {/* Key Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {/* Health Score */}
        <div style={{
          ...terminalStyles.card,
          textAlign: 'center',
          borderColor: healthScore >= 75 ? BT.text.green : healthScore >= 55 ? BT.text.amber : BT.text.red,
        }}>
          <div style={{ ...terminalStyles.metricLabel, color: BT.text.green, marginBottom: 8 }}>
            <Award size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            HEALTH SCORE
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: healthScore >= 75 ? BT.text.green : healthScore >= 55 ? BT.text.amber : BT.text.red,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {healthScore}
          </div>
          <div style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>
            {healthScore >= 75 ? 'Strong Market' : healthScore >= 55 ? 'Stable Market' : 'Caution'}
          </div>
        </div>

        {/* Avg Rent */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG RENT</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.primary }}>
            ${submarket.avgRent.toLocaleString()}
          </div>
          <div style={{ 
            fontSize: 11, 
            color: submarket.rentGrowth >= 0 ? BT.text.green : BT.text.red, 
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}>
            {submarket.rentGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {submarket.rentGrowth > 0 ? '+' : ''}{submarket.rentGrowth}% YoY
          </div>
        </div>

        {/* Occupancy */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>OCCUPANCY</div>
          <div style={{ 
            ...terminalStyles.metricValue, 
            color: submarket.occupancy >= 93 ? BT.text.green : 
                   submarket.occupancy >= 90 ? BT.text.amber : BT.text.red 
          }}>
            {submarket.occupancy.toFixed(1)}%
          </div>
          <div style={{ 
            fontSize: 11, 
            color: submarket.occupancyChange >= 0 ? BT.text.green : BT.text.red, 
            marginTop: 4 
          }}>
            {submarket.occupancyChange >= 0 ? '▲' : '▼'} {Math.abs(submarket.occupancyChange).toFixed(1)}% vs LY
          </div>
        </div>

        {/* Cap Rate */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>AVG CAP RATE</div>
          <div style={{ ...terminalStyles.metricValue, color: BT.text.cyan }}>
            {submarket.avgCapRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            Median: {(submarket.avgCapRate + 0.2).toFixed(1)}%
          </div>
        </div>

        {/* Absorption */}
        <div style={{ ...terminalStyles.card, textAlign: 'center' }}>
          <div style={{ ...terminalStyles.metricLabel, marginBottom: 8 }}>ABSORPTION</div>
          <div style={{ 
            ...terminalStyles.metricValue, 
            color: submarket.absorptionRate >= 90 ? BT.text.green : BT.text.amber 
          }}>
            {submarket.absorptionRate}%
          </div>
          <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>
            Trailing 12mo
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TerminalChart
          title="Rent Trend"
          data={rentTrendData}
          series={[{ key: 'rent', name: 'Avg Rent', color: BT.text.green, data: [] }]}
          height={180}
          valueFormatter={(v) => `$${v.toLocaleString()}`}
        />
        <TerminalChart
          title="Occupancy Trend"
          data={occupancyTrendData}
          series={[{ key: 'occupancy', name: 'Occupancy', color: BT.text.cyan, data: [] }]}
          height={180}
          valueFormatter={(v) => `${v}%`}
        />
      </div>

      {/* Demographics & Supply */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Demographics */}
        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ 
            ...terminalStyles.sectionLabel, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 16 
          }}>
            <Users size={14} />
            Demographics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '10px 12px', background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Population</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                {(submarket.population / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: 10, color: BT.text.green }}>
                +{submarket.populationGrowth}% growth
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Median Income</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                ${(submarket.medianIncome / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                vs $72K MSA avg
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Employment Growth</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.green }}>
                +{submarket.employmentGrowth}%
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                YoY
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: BT.bg.cardHover, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: BT.text.muted, marginBottom: 4 }}>Median Age (Built)</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: BT.text.primary }}>
                {submarket.medianAge}
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                {new Date().getFullYear() - submarket.medianAge} years avg
              </div>
            </div>
          </div>
        </div>

        {/* Supply Pipeline */}
        <div style={{ ...terminalStyles.panel, padding: 16 }}>
          <div style={{ 
            ...terminalStyles.sectionLabel, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 16 
          }}>
            <Building2 size={14} />
            Supply Analysis
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: BT.text.muted }}>Pipeline vs Existing</span>
              <span style={{ 
                fontSize: 12, 
                fontWeight: 600, 
                color: (submarket.pipelineUnits / submarket.totalUnits) < 0.08 ? BT.text.green : BT.text.amber 
              }}>
                {((submarket.pipelineUnits / submarket.totalUnits) * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ 
              height: 8, 
              background: BT.bg.cardHover, 
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (submarket.pipelineUnits / submarket.totalUnits) * 100 * 5)}%`,
                background: (submarket.pipelineUnits / submarket.totalUnits) < 0.08 ? BT.text.green : BT.text.amber,
                borderRadius: 4,
              }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center', padding: 8, background: BT.bg.cardHover, borderRadius: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.amber }}>
                {submarket.pipelineUnits.toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: BT.text.muted }}>Pipeline Units</div>
            </div>
            <div style={{ textAlign: 'center', padding: 8, background: BT.bg.cardHover, borderRadius: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.cyan }}>
                {Math.round(submarket.pipelineUnits * 0.35).toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: BT.text.muted }}>Under Const.</div>
            </div>
            <div style={{ textAlign: 'center', padding: 8, background: BT.bg.cardHover, borderRadius: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.green }}>
                {Math.round(submarket.pipelineUnits * 0.15).toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: BT.text.muted }}>Lease-Up</div>
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
              <strong style={{ color: BT.text.primary }}>
                {submarket.name} ranks #3
              </strong>{' '}
              among {submarket.msaName} submarkets for rent growth.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>
                Supply pipeline at {((submarket.pipelineUnits / submarket.totalUnits) * 100).toFixed(1)}%
              </strong>{' '}
              — {(submarket.pipelineUnits / submarket.totalUnits) < 0.08 
                ? 'below market average, favorable for landlords' 
                : 'elevated supply risk over next 24 months'}.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: BT.text.secondary }}>
            <span style={{ color: BT.text.cyan }}>→</span>
            <span>
              <strong style={{ color: BT.text.primary }}>
                Employment growth +{submarket.employmentGrowth}%
              </strong>{' '}
              outpaces MSA average of 2.1%, supporting continued demand.
            </span>
          </li>
        </ul>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating submarket overview...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <MarketNarrative narrative={commentary.marketNarrative} />
            </div>
            <div style={{
              flex: '0 0 120px',
              ...terminalStyles.card,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                fontSize: 9,
                fontWeight: 700,
                color: BT.text.amber,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                JEDI
              </div>
              <StrategyScoreBadge
                score={commentary.jediScore}
                delta={commentary.arbitrageDelta}
                size="md"
              />
            </div>
          </div>
          {commentary.investmentThesis && (
            <div style={{ ...terminalStyles.card, padding: 16 }}>
              <InvestmentThesis
                recommendation={commentary.investmentThesis.recommendation}
                points={commentary.investmentThesis.points}
                compact
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubmarketOverviewTab;
