/**
 * MSATrendsTab - Comprehensive historical trends and forecasting
 * Integrated from pre-Bloomberg TrendsTab (68KB)
 * Features: Correlation Analysis, Supply Wave, Rent by Vintage, JEDI History, Affordability
 */

import React, { useState, useMemo, useEffect } from 'react';

  // Neural network context awareness
  const { analysis: contextAnalysis, loading: contextLoading } = useAutoContextAnalysis(
    { context: 'rent_trends', marketId: msaId }
  );
import { BT, terminalStyles, fmt } from '../../theme';
import { CardSection, DataTable } from '../../TerminalLayouts';
import { TerminalChart, ChartSeries, ChartDataPoint } from '../../TerminalChart';
import { SIGNAL_GROUPS, BT_SIGNAL_COLORS, SUPPLY_WAVE_STYLES, SupplyWavePhase } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary, SupplyNarrative } from '../../commentary';
import { apiClient } from '../../../../api/client';
import { ContextIndicator } from '../../../intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../../../hooks/useContextAwareness';

interface MSATrendsTabProps {
  msaId: string;
  msa: any;
}

const TIME_RANGES = ['3M', '6M', '1Y', '3Y', '5Y', 'Max'] as const;

// Mock data for all charts
const CORRELATION_QUARTERS = [
  { quarter: 'Q1 24', rentGrowth: 1.8, trafficTrend: 1.2, wageGrowth: 3.4 },
  { quarter: 'Q2 24', rentGrowth: 4.2, trafficTrend: 3.8, wageGrowth: 3.1 },
  { quarter: 'Q3 24', rentGrowth: 5.1, trafficTrend: 4.6, wageGrowth: 2.8 },
  { quarter: 'Q4 24', rentGrowth: 3.4, trafficTrend: 2.8, wageGrowth: 3.0 },
  { quarter: 'Q1 25', rentGrowth: 3.8, trafficTrend: 2.4, wageGrowth: 3.2 },
  { quarter: 'Q2 25', rentGrowth: 6.8, trafficTrend: 6.2, wageGrowth: 2.9 },
  { quarter: 'Q3 25', rentGrowth: 7.6, trafficTrend: 7.1, wageGrowth: 2.6 },
  { quarter: 'Q4 25', rentGrowth: 5.4, trafficTrend: 4.5, wageGrowth: 2.7 },
];



const JEDI_SCORE_HISTORY = [
  { quarter: 'Q1 24', composite: 56, demand: 48, supply: 62, momentum: 52 },
  { quarter: 'Q2 24', composite: 65, demand: 62, supply: 60, momentum: 64 },
  { quarter: 'Q3 24', composite: 71, demand: 70, supply: 58, momentum: 72 },
  { quarter: 'Q4 24', composite: 66, demand: 60, supply: 63, momentum: 65 },
  { quarter: 'Q1 25', composite: 70, demand: 64, supply: 66, momentum: 68 },
  { quarter: 'Q2 25', composite: 82, demand: 80, supply: 62, momentum: 84 },
  { quarter: 'Q3 25', composite: 88, demand: 86, supply: 60, momentum: 90 },
  { quarter: 'Q4 25', composite: 81, demand: 76, supply: 65, momentum: 82 },
];

const AFFORDABILITY_DATA = {
  medianHouseholdIncome: 72500,
  medianMonthlyRent: 1895,
  thresholdPercent: 30,
  currentPercent: 31.4,
  historicalPercents: [26.8, 28.6, 29.2, 28.4, 29.0, 30.6, 31.4, 30.2],
};

const SUPPLY_WAVE_PHASES: { market: string; phase: SupplyWavePhase; detail: string; buildout: string; window?: string }[] = [
  { market: 'Nashville', phase: 'PEAKING', detail: 'Q1-Q2 2026 max deliveries', buildout: '14.8yr' },
  { market: 'Atlanta', phase: 'BUILDING', detail: 'peak Q3-Q4 2026', buildout: '8.6yr' },
  { market: 'Charlotte', phase: 'PAST PEAK', detail: 'deliveries declining', buildout: '6.2yr', window: '★ BUYING WINDOW NOW' },
  { market: 'Raleigh', phase: 'TROUGH', detail: 'minimal new starts', buildout: '5.8yr' },
  { market: 'Tampa', phase: 'TROUGH', detail: 'supply bottomed', buildout: '4.2yr', window: '★ BUYING WINDOW NOW' },
];

interface PriceTrend {
  county: string;
  state: string;
  sale_year: number;
  sale_count: number;
  median_price: number;
  avg_price: number;
  median_price_per_unit: number | null;
  avg_price_per_unit: number | null;
  yoy_change_pct: number | null;
}

interface PriceTrendsResponse {
  success: boolean;
  trends: PriceTrend[];
}

interface RentByClassEntry {
  asset_class: 'A' | 'B' | 'C';
  property_count: number;
  avg_rent: number | null;
  min_rent: number | null;
  max_rent: number | null;
}

interface RentByClassResponse {
  success: boolean;
  city: string;
  state: string;
  count: number;
  classes: RentByClassEntry[];
}

interface SupplyPipelineSubmarket {
  name: string;
  units: number;
  pctOfTotal: number;
  status: 'HIGH' | 'MOD' | 'LOW';
  projectCount?: number;
}

interface SupplyPipelineResponse {
  success: boolean;
  totalUnits: number;
  projectCount: number;
  bySubmarket: SupplyPipelineSubmarket[];
}

export const MSATrendsTab: React.FC<MSATrendsTabProps> = ({ msaId, msa }) => {
  const [timeRange, setTimeRange] = useState<typeof TIME_RANGES[number]>('1Y');
  const [priceTrends, setPriceTrends] = useState<PriceTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [rentByClass, setRentByClass] = useState<RentByClassEntry[]>([]);
  const [rentByClassLoading, setRentByClassLoading] = useState(true);
  const [supplyPipeline, setSupplyPipeline] = useState<SupplyPipelineSubmarket[]>([]);
  const [supplyPipelineTotal, setSupplyPipelineTotal] = useState<number | null>(null);
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  useEffect(() => {
    setTrendsLoading(true);
    apiClient.get<PriceTrendsResponse>('/georgia/analytics/price-trends?state=GA')
      .then((res: PriceTrendsResponse) => {
        const trends: PriceTrend[] = res?.trends || [];
        // Aggregate across counties using transaction-count weighted averages
        const aggregated = new Map<number, {
          sale_count: number;
          weighted_ppu_sum: number;
          weighted_ppu_txns: number;
          weighted_yoy_sum: number;
          weighted_yoy_txns: number;
        }>();
        for (const t of trends) {
          const ppu = t.median_price_per_unit ?? t.avg_price_per_unit;
          const existing = aggregated.get(t.sale_year);
          if (existing) {
            existing.sale_count += t.sale_count;
            if (ppu != null) {
              existing.weighted_ppu_sum += ppu * t.sale_count;
              existing.weighted_ppu_txns += t.sale_count;
            }
            if (t.yoy_change_pct != null) {
              existing.weighted_yoy_sum += t.yoy_change_pct * t.sale_count;
              existing.weighted_yoy_txns += t.sale_count;
            }
          } else {
            aggregated.set(t.sale_year, {
              sale_count: t.sale_count,
              weighted_ppu_sum: ppu != null ? ppu * t.sale_count : 0,
              weighted_ppu_txns: ppu != null ? t.sale_count : 0,
              weighted_yoy_sum: t.yoy_change_pct != null ? t.yoy_change_pct * t.sale_count : 0,
              weighted_yoy_txns: t.yoy_change_pct != null ? t.sale_count : 0,
            });
          }
        }
        const merged: PriceTrend[] = Array.from(aggregated.entries()).map(([year, v]) => ({
          county: 'all',
          state: 'GA',
          sale_year: year,
          sale_count: v.sale_count,
          median_price: 0,
          avg_price: 0,
          median_price_per_unit: v.weighted_ppu_txns > 0 ? v.weighted_ppu_sum / v.weighted_ppu_txns : null,
          avg_price_per_unit: v.weighted_ppu_txns > 0 ? v.weighted_ppu_sum / v.weighted_ppu_txns : null,
          yoy_change_pct: v.weighted_yoy_txns > 0 ? v.weighted_yoy_sum / v.weighted_yoy_txns : null,
        }));
        merged.sort((a, b) => b.sale_year - a.sale_year);
        setPriceTrends(merged);
      })
      .catch(() => setPriceTrends([]))
      .finally(() => setTrendsLoading(false));
  }, []);

  useEffect(() => {
    setRentByClassLoading(true);
    apiClient.get<RentByClassResponse>('/georgia/analytics/rent-by-class?city=Atlanta&state=GA')
      .then((res: RentByClassResponse) => setRentByClass(res?.classes || []))
      .catch(() => setRentByClass([]))
      .finally(() => setRentByClassLoading(false));
  }, []);

  useEffect(() => {
    apiClient.get<SupplyPipelineResponse>('/georgia/supply/pipeline?state=GA&limit=8')
      .then((res: SupplyPipelineResponse) => {
        if (res?.success && Array.isArray(res.bySubmarket) && res.bySubmarket.length > 0) {
          setSupplyPipeline(res.bySubmarket);
          setSupplyPipelineTotal(res.totalUnits || null);
        }
      })
      .catch(() => {});
  }, []);


  // Calculate max for supply wave chart (real pipeline or fallback label)
  const maxSupply = supplyPipeline.length > 0
    ? Math.max(...supplyPipeline.map(d => d.units))
    : 0;

  // Calculate correlation
  const rentValues = CORRELATION_QUARTERS.map(q => q.rentGrowth);
  const trafficValues = CORRELATION_QUARTERS.map(q => q.trafficTrend);
  const correlation = useMemo(() => {
    const n = rentValues.length;
    const meanR = rentValues.reduce((a, b) => a + b, 0) / n;
    const meanT = trafficValues.reduce((a, b) => a + b, 0) / n;
    let num = 0, denR = 0, denT = 0;
    for (let i = 0; i < n; i++) {
      const dr = rentValues[i] - meanR;
      const dt = trafficValues[i] - meanT;
      num += dr * dt;
      denR += dr * dr;
      denT += dt * dt;
    }
    return denR && denT ? num / Math.sqrt(denR * denT) : 0;
  }, [rentValues, trafficValues]);

  // Check for rent-wage divergence
  const hasDivergence = CORRELATION_QUARTERS.filter(q => q.rentGrowth > q.wageGrowth * 1.5).length >= 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with Time Range Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ ...terminalStyles.sectionTitle }}>
          {msaName} — Historical Trends & Forecasting
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIME_RANGES.map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 12px',
                background: timeRange === range ? BT.accent.blue : BT.bg.elevated,
                color: timeRange === range ? '#fff' : BT.text.secondary,
                border: 'none',
                borderRadius: 0,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Correlation Analysis + Affordability */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Correlation Analysis */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
                Rent-Traffic Correlation
              </h3>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.muted, background: BT.bg.elevated,
                padding: '2px 7px', borderRadius: 0,
              }}>BENCHMARK MODEL</span>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: correlation > 0.7 ? BT.text.green : correlation > 0.4 ? BT.accent.amber : BT.accent.red,
              background: correlation > 0.7 ? 'rgba(34,197,94,0.15)' : correlation > 0.4 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              padding: '4px 8px',
              borderRadius: 0,
            }}>
              r = {correlation.toFixed(2)}
            </span>
          </div>
          
          {/* Mini bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CORRELATION_QUARTERS.slice(-6).map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 48, fontSize: 10, color: BT.text.muted }}>{q.quarter}</span>
                <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                  <div style={{
                    width: `${(q.rentGrowth / 10) * 100}%`,
                    height: 12,
                    background: BT.text.green,
                    borderRadius: 0,
                  }} />
                  <div style={{
                    width: `${(q.trafficTrend / 10) * 100}%`,
                    height: 12,
                    background: BT.text.cyan,
                    borderRadius: 0,
                  }} />
                </div>
                <span style={{ width: 40, fontSize: 10, color: BT.text.secondary, textAlign: 'right' }}>
                  +{q.rentGrowth}%
                </span>
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: BT.text.green, borderRadius: 0 }} />
              <span style={{ fontSize: 10, color: BT.text.muted }}>Rent Growth</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: BT.text.cyan, borderRadius: 0 }} />
              <span style={{ fontSize: 10, color: BT.text.muted }}>Traffic Trend</span>
            </div>
          </div>
        </div>

        {/* Affordability Check */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14, marginBottom: 16 }}>
            Affordability Check
          </h3>
          
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: AFFORDABILITY_DATA.currentPercent > 30 ? BT.accent.amber : BT.text.green }}>
                {AFFORDABILITY_DATA.currentPercent}%
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Rent/Income</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: BT.text.primary }}>
                {AFFORDABILITY_DATA.thresholdPercent}%
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Threshold</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: BT.text.secondary }}>
                ${(AFFORDABILITY_DATA.medianHouseholdIncome / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>Med. Income</div>
            </div>
          </div>

          {hasDivergence && (
            <div style={{
              padding: 12,
              background: 'rgba(239,68,68,0.1)',
              borderLeft: `3px solid ${BT.accent.red}`,
              borderRadius: 0,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: BT.accent.red, marginBottom: 4 }}>
                ⚠️ DIVERGENCE ALERT
              </div>
              <div style={{ fontSize: 11, color: BT.text.muted }}>
                Rent growth exceeding wage growth for 3+ consecutive quarters. Monitor affordability ceiling.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Supply Pipeline (real data from apartment_supply_pipeline) */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Supply Pipeline by Submarket
            </h3>
            <span style={{
              fontSize: 10,
              color: BT.text.violet,
              background: 'rgba(139,92,246,0.15)',
              padding: '2px 8px',
              borderRadius: 0,
              fontFamily: 'monospace',
            }}>
              DC-08
            </span>
            {supplyPipeline.length > 0 ? (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · APT LOCATOR</span>
            ) : (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.muted, background: BT.bg.elevated,
                padding: '2px 7px', borderRadius: 0,
              }}>LOADING</span>
            )}
          </div>
          {supplyPipelineTotal != null && (
            <span style={{ fontSize: 11, color: BT.text.secondary }}>
              {supplyPipelineTotal.toLocaleString()} total units
            </span>
          )}
        </div>

        {supplyPipeline.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginBottom: 16 }}>
              {supplyPipeline.slice(0, 8).map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>
                    {d.units.toLocaleString()}
                  </div>
                  <div style={{
                    width: '80%',
                    height: maxSupply > 0 ? `${Math.round((d.units / maxSupply) * 120)}px` : '4px',
                    background: d.status === 'HIGH' ? BT.accent.red
                      : d.status === 'MOD' ? BT.accent.amber
                      : BT.accent.blue,
                    borderRadius: 0,
                    minHeight: 4,
                  }} />
                  <span style={{ fontSize: 9, color: BT.text.muted, marginTop: 4, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.name}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ color: BT.accent.red, label: 'HIGH (>5,000 units)' }, { color: BT.accent.amber, label: 'MOD (2,000–5,000)' }, { color: BT.accent.blue, label: 'LOW (<2,000)' }].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, background: color, borderRadius: 0 }} />
                  <span style={{ fontSize: 10, color: BT.text.muted }}>{label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 }}>
            <div style={{ fontSize: 12, color: BT.text.muted, fontWeight: 600 }}>No supply pipeline data</div>
            <div style={{ fontSize: 10, color: BT.text.muted }}>Run the Atlanta sync to populate apartment supply data.</div>
          </div>
        )}
      </div>

      {/* Row 3: Supply Wave Phases */}
      <CardSection title="Market Supply Wave Phases">
        <DataTable>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Market</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Phase</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'left' }}>Detail</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'right' }}>Buildout</th>
              <th style={{ ...terminalStyles.tableHeader, textAlign: 'center' }}>Window</th>
            </tr>
          </thead>
          <tbody>
            {SUPPLY_WAVE_PHASES.map((p, i) => {
              const phaseStyle = SUPPLY_WAVE_STYLES[p.phase];
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ ...terminalStyles.tableCell, fontWeight: 600 }}>{p.market}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 0,
                      background: phaseStyle.btBg,
                      color: phaseStyle.btText,
                      fontSize: 10,
                      fontWeight: 700,
                    }}>
                      {p.phase}
                    </span>
                  </td>
                  <td style={{ ...terminalStyles.tableCell, color: BT.text.muted }}>{p.detail}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'right' }}>{p.buildout}</td>
                  <td style={{ ...terminalStyles.tableCell, textAlign: 'center' }}>
                    {p.window && (
                      <span style={{ color: BT.text.green, fontSize: 11, fontWeight: 600 }}>
                        {p.window}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </CardSection>

      {/* Row 4: Rent by Vintage + JEDI History */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Rent by Vintage Class */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Rent by Vintage Class
            </h3>
            {rentByClassLoading ? (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.muted, background: BT.bg.elevated,
                padding: '2px 7px', borderRadius: 0,
              }}>LOADING</span>
            ) : rentByClass.length > 0 ? (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · APT LOCATOR</span>
            ) : (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.muted, background: BT.bg.elevated,
                padding: '2px 7px', borderRadius: 0,
              }}>MARKET BENCHMARK</span>
            )}
          </div>
          {rentByClassLoading ? (
            <div style={{ fontSize: 11, color: BT.text.muted, textAlign: 'center', padding: 20 }}>
              Loading rent data...
            </div>
          ) : rentByClass.length > 0 ? (
            (() => {
              const CLASS_COLORS: Record<string, string> = { A: '#22c55e', B: '#3b82f6', C: '#f59e0b' };
              const CLASS_LABELS: Record<string, string> = {
                A: 'Class A (2010+)',
                B: 'Class B (1995–2009)',
                C: 'Class C (pre-1995)',
              };
              const maxRent = Math.max(...rentByClass.map(c => c.avg_rent || 0), 1);
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {rentByClass.map((c, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: CLASS_COLORS[c.asset_class] || BT.text.secondary }}>
                            {CLASS_LABELS[c.asset_class] || `Class ${c.asset_class}`}
                          </span>
                          <span style={{ fontSize: 11, color: BT.text.primary, fontWeight: 700 }}>
                            {c.avg_rent != null ? `$${c.avg_rent.toLocaleString()}` : '—'}
                          </span>
                        </div>
                        <div style={{ height: 14, background: BT.bg.elevated, borderRadius: 0, position: 'relative' }}>
                          <div style={{
                            position: 'absolute', left: 0, top: 0,
                            width: `${((c.avg_rent || 0) / maxRent) * 100}%`,
                            height: '100%',
                            background: CLASS_COLORS[c.asset_class] || BT.accent.blue,
                            borderRadius: 0,
                          }} />
                        </div>
                        <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 3 }}>
                          {c.property_count} {c.property_count === 1 ? 'property' : 'properties'}
                          {c.min_rent != null && c.max_rent != null && (
                            <span> · range ${c.min_rent.toLocaleString()}–${c.max_rent.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 14, borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 8 }}>
                    Source: Apartment Locator AI · Atlanta metro
                  </div>
                </>
              );
            })()
          ) : (
            (() => {
              const last = RENT_VINTAGE_DATA[RENT_VINTAGE_DATA.length - 1];
              const CLASS_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#f59e0b', '#a78bfa'];
              const entries = [
                { label: 'Class A+ (2015+)', value: last.aPlus, color: CLASS_COLORS[0] },
                { label: 'Class A (2010–2014)', value: last.a, color: CLASS_COLORS[1] },
                { label: 'Class B+ (2000–2009)', value: last.bPlus, color: CLASS_COLORS[2] },
                { label: 'Class B (1990–1999)', value: last.b, color: CLASS_COLORS[3] },
                { label: 'Class C (pre-1990)', value: last.c, color: CLASS_COLORS[4] },
              ];
              const maxRent = Math.max(...entries.map(e => e.value), 1);
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {entries.map((e, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: e.color, fontWeight: 600 }}>{e.label}</span>
                          <span style={{ fontSize: 11, color: BT.text.secondary }}>${e.value.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 10, background: BT.bg.elevated, borderRadius: 0, position: 'relative' }}>
                          <div style={{
                            position: 'absolute', left: 0, top: 0,
                            width: `${(e.value / maxRent) * 100}%`,
                            height: '100%',
                            background: e.color,
                            opacity: 0.7,
                            borderRadius: 0,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 14, borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 8 }}>
                    Static benchmark — {last.quarter} · Connect Apt Locator sync for live data
                  </div>
                </>
              );
            })()
          )}
        </div>

        {/* JEDI Score History */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              JEDI Score History
            </h3>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: BT.text.muted, background: BT.bg.elevated,
              padding: '2px 7px', borderRadius: 0,
            }}>BENCHMARK MODEL</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {JEDI_SCORE_HISTORY.slice(-6).map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 48, fontSize: 10, color: BT.text.muted }}>{d.quarter}</span>
                <div style={{ flex: 1, position: 'relative', height: 16, background: BT.bg.elevated, borderRadius: 0 }}>
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${d.composite}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${BT.text.cyan} 0%, ${BT.text.green} 100%)`,
                    borderRadius: 0,
                  }} />
                  <span style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: d.composite > 50 ? '#fff' : BT.text.primary,
                  }}>
                    {d.composite}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <span style={{ fontSize: 10, color: BT.text.green }}>▲ {JEDI_SCORE_HISTORY[JEDI_SCORE_HISTORY.length - 1].composite - JEDI_SCORE_HISTORY[0].composite} pts (8Q)</span>
          </div>
        </div>
      </div>

      {/* Row 5: Transactions + Concessions */}
      <div style={{ display: 'flex', gap: 20 }}>
        {/* Transaction Data */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Transaction Activity
            </h3>
            {!trendsLoading && priceTrends.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green,
                background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>
                LIVE · GA COUNTY DATA
              </span>
            )}
          </div>
          {trendsLoading ? (
            <div style={{ fontSize: 11, color: BT.text.muted, textAlign: 'center', padding: 20 }}>
              Loading transaction data...
            </div>
          ) : priceTrends.length > 0 ? (
            <DataTable>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'left', fontSize: 10 }}>Year</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right', fontSize: 10 }}>$/Unit</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right', fontSize: 10 }}>Txns</th>
                  <th style={{ ...terminalStyles.tableHeader, textAlign: 'right', fontSize: 10 }}>YoY</th>
                </tr>
              </thead>
              <tbody>
                {priceTrends.slice(0, 5).map((t, i) => {
                  const ppu = t.median_price_per_unit ?? t.avg_price_per_unit;
                  const yoy = t.yoy_change_pct;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ ...terminalStyles.tableCell, fontSize: 11 }}>FY {t.sale_year}</td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontSize: 11, fontWeight: 600 }}>
                        {ppu ? `$${(ppu / 1000).toFixed(0)}K` : '—'}
                      </td>
                      <td style={{ ...terminalStyles.tableCell, textAlign: 'right', fontSize: 11 }}>
                        {t.sale_count.toLocaleString()}
                      </td>
                      <td style={{
                        ...terminalStyles.tableCell, textAlign: 'right', fontSize: 11,
                        color: yoy == null ? BT.text.muted : yoy >= 0 ? BT.text.green : BT.accent.red,
                      }}>
                        {yoy == null ? '—' : `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          ) : (
            <div style={{
              padding: 24,
              textAlign: 'center',
              borderLeft: `2px solid ${BT.border.subtle}`,
            }}>
              <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>
                No transaction data available
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                Run the Georgia county pipeline to populate sale comp data.
              </div>
            </div>
          )}
        </div>

        {/* Rent by Class */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Rent by Class
            </h3>
            {!rentByClassLoading && rentByClass.length > 0 ? (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green, background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>LIVE · APT LOCATOR</span>
            ) : (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.muted, background: BT.bg.elevated,
                padding: '2px 7px', borderRadius: 0,
              }}>APT LOCATOR</span>
            )}
          </div>
          {rentByClassLoading ? (
            <div style={{ fontSize: 11, color: BT.text.muted, textAlign: 'center', padding: 20 }}>
              Loading rent by class...
            </div>
          ) : rentByClass.length > 0 ? (
            <>
              {(() => {
                const maxRent = Math.max(...rentByClass.map(t => t.avg_rent ?? 0), 1);
                const classColors: Record<string, string> = {
                  'A': BT.text.green,
                  'B': '#f59e0b',
                  'C': '#f97316',
                };
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rentByClass.map((tier, i) => {
                      const color = classColors[tier.asset_class] || BT.text.secondary;
                      const rent = tier.avg_rent ?? 0;
                      const barWidth = (rent / maxRent) * 100;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Context Awareness */}
      {contextAnalysis && (
        <ContextIndicator analysis={contextAnalysis} loading={contextLoading} compact />
      )}
                          <span style={{
                            width: 24, fontSize: 11, fontWeight: 700,
                            color, textAlign: 'right', flexShrink: 0,
                          }}>Class {tier.asset_class}</span>
                          <div style={{
                            flex: 1, height: 14, background: BT.bg.elevated,
                            position: 'relative', borderRadius: 0,
                          }}>
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: `${barWidth}%`,
                              background: color,
                              opacity: 0.85,
                              borderRadius: 0,
                            }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: BT.text.primary, width: 52, textAlign: 'right' }}>
                              ${rent.toLocaleString()}
                            </span>
                            <span style={{
                              fontSize: 9, color: BT.text.muted,
                              background: BT.bg.elevated,
                              padding: '1px 5px', borderRadius: 0,
                            }}>{tier.property_count}p</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BT.border.subtle}` }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    { label: 'A+ ≥ $2,500', color: BT.text.cyan },
                    { label: 'A $2,000–2,499', color: BT.text.green },
                    { label: 'B+ $1,600–1,999', color: '#3b82f6' },
                    { label: 'B $1,300–1,599', color: '#f59e0b' },
                    { label: 'C < $1,300', color: '#f97316' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 8, height: 8, background: item.color, borderRadius: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 9, color: BT.text.muted }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', borderLeft: `2px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>
                No class breakdown available
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                Run the Atlanta apartment sync to populate property data.
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ ...terminalStyles.card, padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Generating trend analysis...</span>
        </div>
      )}
      {error && (
        <div style={{ ...terminalStyles.card, padding: 12, borderLeft: `3px solid ${BT.accent.red}` }}>
          <span style={{ fontSize: 11, color: BT.text.muted }}>Commentary unavailable</span>
        </div>
      )}
      {commentary && (
        <div style={{ display: 'flex', gap: 16 }}>
          {commentary.signalCommentary?.trend_interpretation && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SignalCommentary signalKey="supply" commentary={commentary.signalCommentary.trend_interpretation} />
            </div>
          )}
          {commentary.supplyNarrative && (
            <div style={{ flex: 1, ...terminalStyles.card, padding: 16 }}>
              <SupplyNarrative narrative={commentary.supplyNarrative} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MSATrendsTab;
