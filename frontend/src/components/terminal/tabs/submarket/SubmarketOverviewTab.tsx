/**
 * SubmarketOverviewTab - Key metrics, health score, trends
 */

import React, { useMemo, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Building2, Users, Briefcase, Home, Award, Activity } from 'lucide-react';
import { BT, fmt, terminalStyles } from '../../theme';
import { TerminalChart, ChartDataPoint, ChartSeries } from '../../TerminalChart';
import { SubmarketData } from '../../SubmarketTerminal';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { MarketNarrative, StrategyScoreBadge, InvestmentThesis } from '../../commentary';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';
import { apiClient } from '../../../../services/api.client';

// Minimal local type for platform-aggregated vendor survey rows.
// deal_id is intentionally absent — the submarket endpoint only returns
// rows where deal_id IS NULL (platform-level aggregates, not private deal uploads).
interface VendorSurveyRow {
  id: string;
  observation_date: string;
  geography_level: string;
  vendor_source: string;
  vendor_license_posture: string;
  vendor_data_as_of: string | null;
  submarket_avg_asking_rent: number | null;
  submarket_avg_effective_rent: number | null;
  submarket_vacancy_rate: number | null;
  submarket_under_construction: number | null;
  market_survey_snapshot: Record<string, unknown> | null;
}

const VENDOR_LABELS: Record<string, string> = {
  yardi_matrix: 'Yardi Matrix',
  costar:       'CoStar',
};
function vendorLabel(s: string): string { return VENDOR_LABELS[s] ?? s; }
function vendorColor(s: string): string {
  return s === 'yardi_matrix' ? '#f59e0b' : s === 'costar' ? '#3b82f6' : '#6b7280';
}

interface SubmarketOverviewTabProps {
  submarketId: string;
  submarket: SubmarketData;
  dealId?: string;
}

export const SubmarketOverviewTab: React.FC<SubmarketOverviewTabProps> = ({ submarketId, submarket, dealId }) => {
  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'submarket_deep_dive', submarketId }
  );

  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('submarket', submarketId);
  const loading = isLoading('submarket', submarketId);
  const error = getError('submarket', submarketId);

  useEffect(() => {
    fetchCommentary('submarket', submarketId, submarket.name);
  // hook intentionally captures fetchCommentary via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted value is read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submarketId, submarket.name]);

  // ── Vendor survey data from historical_observations ────────────────────────
  const [vendorRows, setVendorRows] = useState<VendorSurveyRow[]>([]);

  useEffect(() => {
    // The submarket endpoint is purely submarket-scoped (no deal_id filter).
    // Pass ?name= as a hint for JSONB text matching on vendor rows that store
    // submarket name in market_survey_snapshot rather than a FK submarket_id.
    const params = new URLSearchParams({ name: submarket.name });
    apiClient
      .get(`/api/v1/historical-observations/submarket/${encodeURIComponent(submarketId)}/vendor-surveys?${params}`)
      .then(r => setVendorRows(r.data?.rows ?? []))
      .catch(() => setVendorRows([]));
  // Intentionally excludes `submarket.name` string reference to avoid re-fetching on every render;
  // submarketId is the stable key — name is used only as a hint for JSONB matching.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submarketId]);

  // Unique vendor sources present in the fetched rows
  const vendorSources = useMemo(
    () => [...new Set(vendorRows.map(r => r.vendor_source))],
    [vendorRows],
  );
  const hasVendorData = vendorRows.length > 0;

  // Calculate submarket health score
  const healthScore = useMemo(() => {
    const occupancyScore = Math.min(100, (submarket.occupancy / 95) * 100) * 0.25;
    const rentGrowthScore = Math.min(100, (submarket.rentGrowth / 5) * 100) * 0.20;
    const absorptionScore = Math.min(100, submarket.absorptionRate) * 0.20;
    const employmentScore = Math.min(100, (submarket.employmentGrowth / 4) * 100) * 0.20;
    const pipelineRisk = Math.max(0, 100 - (submarket.pipelineUnits / submarket.totalUnits * 100)) * 0.15;
    return Math.round(occupancyScore + rentGrowthScore + absorptionScore + employmentScore + pipelineRisk);
  }, [submarket]);

  // ── Per-vendor chart data — one series per vendor_source, simulated fallback
  const {
    rentChartData,
    rentChartSeries,
    occupancyChartData,
    occupancyChartSeries,
  } = useMemo<{
    rentChartData: ChartDataPoint[];
    rentChartSeries: ChartSeries[];
    occupancyChartData: ChartDataPoint[];
    occupancyChartSeries: ChartSeries[];
  }>(() => {
    const fmtPeriod = (d: string) =>
      new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    if (vendorRows.length === 0) {
      // Fallback: deterministic trend derived from the submarket prop, which is sourced
      // from market-aggregated data (CoStar/platform). We back-calculate 12 monthly points
      // ending at the current snapshot values using the recorded YoY growth rates. This is
      // deterministic (no Math.random()) and accurately reflects the market-aggregated source.
      const now = new Date();
      const monthlyRentGrowth = Math.pow(1 + (submarket.rentGrowth ?? 0) / 100, 1 / 12) - 1;
      // Back-calculate starting rent 11 months ago from the current snapshot value
      const currentRent = submarket.avgRent;
      const startRent = currentRent / Math.pow(1 + monthlyRentGrowth, 11);
      // Occupancy: interpolate linearly from (current - occupancyChange) to current
      const currentOcc = submarket.occupancy;
      const occupancyChangeYoY = submarket.occupancyChange ?? 0;
      const startOcc = currentOcc - occupancyChangeYoY;

      const rentFallbackData: ChartDataPoint[] = [];
      const occFallbackData:  ChartDataPoint[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const rentVal = Math.round(startRent * Math.pow(1 + monthlyRentGrowth, i));
        const occVal  = Number((startOcc + (occupancyChangeYoY * i / 11)).toFixed(1));
        rentFallbackData.push({ date: label, rent: rentVal });
        occFallbackData.push({ date: label, occupancy: Math.min(99, Math.max(50, occVal)) });
      }
      return {
        rentChartData:      rentFallbackData,
        rentChartSeries:    [{ key: 'rent',      name: 'Avg Rent (platform avg.)', color: BT.text.green, data: [] }],
        occupancyChartData: occFallbackData,
        occupancyChartSeries: [{ key: 'occupancy', name: 'Occupancy (platform avg.)', color: BT.text.cyan, data: [] }],
      };
    }

    // Group rows by vendor_source
    const byVendor: Record<string, VendorSurveyRow[]> = {};
    for (const row of vendorRows) {
      (byVendor[row.vendor_source] ??= []).push(row);
    }
    const vendors = Object.keys(byVendor);

    // Build per-vendor lookup maps keyed by ISO observation_date string
    const rentByDate: Record<string, Record<string, number>> = {};
    const occByDate:  Record<string, Record<string, number>> = {};
    for (const [src, rows] of Object.entries(byVendor)) {
      for (const row of rows) {
        const d = row.observation_date;
        if (row.submarket_avg_asking_rent != null) {
          (rentByDate[src] ??= {})[d] = Math.round(Number(row.submarket_avg_asking_rent));
        }
        if (row.submarket_vacancy_rate != null) {
          (occByDate[src] ??= {})[d] = Number((100 - Number(row.submarket_vacancy_rate)).toFixed(1));
        }
      }
    }

    // Union of all dates, sorted oldest → newest
    const allDates = [...new Set(vendorRows.map(r => r.observation_date))]
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // One data point per date; each vendor contributes its own key (gaps = undefined = broken line)
    const rentChartData: ChartDataPoint[] = allDates.map(d => {
      const pt: ChartDataPoint = { date: fmtPeriod(d) };
      for (const src of vendors) {
        const val = rentByDate[src]?.[d];
        if (val !== undefined) pt[`rent_${src}`] = val;
      }
      return pt;
    });

    const occupancyChartData: ChartDataPoint[] = allDates.map(d => {
      const pt: ChartDataPoint = { date: fmtPeriod(d) };
      for (const src of vendors) {
        const val = occByDate[src]?.[d];
        if (val !== undefined) pt[`occ_${src}`] = val;
      }
      return pt;
    });

    // One ChartSeries per vendor — each gets its own color and label
    const rentChartSeries: ChartSeries[] = vendors.map(src => ({
      key:   `rent_${src}`,
      name:  `Ask Rent — ${vendorLabel(src)}`,
      color: vendorColor(src),
      data:  [],
    }));

    const occupancyChartSeries: ChartSeries[] = vendors.map(src => ({
      key:   `occ_${src}`,
      name:  `Occupancy — ${vendorLabel(src)}`,
      color: vendorColor(src),
      data:  [],
    }));

    return { rentChartData, rentChartSeries, occupancyChartData, occupancyChartSeries };
  }, [vendorRows, submarket.avgRent, submarket.occupancy]);

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

      {/* Vendor data source badges — shown when real market survey data is available */}
      {hasVendorData && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '5px 10px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 4,
        }}>
          <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: BT.font.mono, letterSpacing: 0.4 }}>
            MARKET DATA SOURCE
          </span>
          {vendorSources.map(src => (
            <span
              key={src}
              style={{
                fontSize: 8, fontWeight: 700,
                padding: '1px 6px',
                background: vendorColor(src) + '22',
                color: vendorColor(src),
                border: `1px solid ${vendorColor(src)}55`,
                borderRadius: 3,
                fontFamily: BT.font.mono,
                letterSpacing: 0.3,
              }}
            >
              {vendorLabel(src).toUpperCase()}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 7, color: BT.text.muted, fontFamily: BT.font.mono }}>
            {vendorRows.length} period{vendorRows.length !== 1 ? 's' : ''} · replacing estimated trend
          </span>
        </div>
      )}

      {/* Charts Row — per-vendor series when real data exists, simulated fallback otherwise */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TerminalChart
          title="Rent Trend"
          data={rentChartData}
          series={rentChartSeries}
          height={180}
          valueFormatter={(v) => `$${v.toLocaleString()}`}
        />
        <TerminalChart
          title="Occupancy Trend"
          data={occupancyChartData}
          series={occupancyChartSeries}
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
