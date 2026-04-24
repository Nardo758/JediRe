/**
 * MSATrendsTab - Comprehensive historical trends and forecasting
 * Integrated from pre-Bloomberg TrendsTab (68KB)
 * Features: Correlation Analysis, Supply Wave, Rent by Vintage, JEDI History, Affordability
 */

import React, { useState, useMemo, useEffect } from 'react';
import { BT, terminalStyles, fmt } from '../../theme';
import { CardSection, DataTable } from '../../TerminalLayouts';
import { TerminalChart, ChartSeries, ChartDataPoint } from '../../TerminalChart';
import { SIGNAL_GROUPS, BT_SIGNAL_COLORS, SUPPLY_WAVE_STYLES, SupplyWavePhase } from '../../signalGroups';
import { useCommentaryStore } from '../../../../stores/commentaryStore';
import { SignalCommentary, SupplyNarrative } from '../../commentary';
import apiClient from '../../../../api/client';

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

const SUPPLY_WAVE_DATA = [
  { year: '2026', confirmed: 8200, capacity: 1200 },
  { year: '2027', confirmed: 6400, capacity: 1400 },
  { year: '2028', confirmed: 3800, capacity: 1600 },
  { year: '2029', confirmed: 1200, capacity: 1800 },
  { year: '2030', confirmed: 400, capacity: 1600 },
  { year: '2031', confirmed: 0, capacity: 1200 },
  { year: '2032', confirmed: 0, capacity: 800 },
  { year: '2033', confirmed: 0, capacity: 600 },
  { year: '2034', confirmed: 0, capacity: 400 },
];

const RENT_VINTAGE_DATA = [
  { quarter: 'Q1 24', aPlus: 2420, a: 2150, bPlus: 1650, b: 1390, c: 1060 },
  { quarter: 'Q2 24', aPlus: 2510, a: 2240, bPlus: 1740, b: 1480, c: 1130 },
  { quarter: 'Q3 24', aPlus: 2540, a: 2280, bPlus: 1800, b: 1540, c: 1170 },
  { quarter: 'Q4 24', aPlus: 2490, a: 2230, bPlus: 1760, b: 1500, c: 1140 },
  { quarter: 'Q1 25', aPlus: 2520, a: 2260, bPlus: 1820, b: 1560, c: 1190 },
  { quarter: 'Q2 25', aPlus: 2620, a: 2360, bPlus: 1960, b: 1700, c: 1310 },
  { quarter: 'Q3 25', aPlus: 2660, a: 2400, bPlus: 2040, b: 1780, c: 1380 },
  { quarter: 'Q4 25', aPlus: 2600, a: 2340, bPlus: 1990, b: 1730, c: 1340 },
];

const DEMAND_SIGNAL_DATA = [
  { quarter: 'Q1 24', trafficGrowth: 1.4, searchInterest: 52, t02Avg: 58, t03Avg: 48 },
  { quarter: 'Q2 24', trafficGrowth: 4.1, searchInterest: 68, t02Avg: 67, t03Avg: 64 },
  { quarter: 'Q3 24', trafficGrowth: 5.2, searchInterest: 74, t02Avg: 72, t03Avg: 72 },
  { quarter: 'Q4 24', trafficGrowth: 3.6, searchInterest: 62, t02Avg: 66, t03Avg: 60 },
  { quarter: 'Q1 25', trafficGrowth: 3.8, searchInterest: 66, t02Avg: 68, t03Avg: 62 },
  { quarter: 'Q2 25', trafficGrowth: 7.4, searchInterest: 91, t02Avg: 82, t03Avg: 88 },
  { quarter: 'Q3 25', trafficGrowth: 8.1, searchInterest: 96, t02Avg: 86, t03Avg: 93 },
  { quarter: 'Q4 25', trafficGrowth: 5.8, searchInterest: 78, t02Avg: 76, t03Avg: 74 },
];

const TRANSACTION_DATA = [
  { date: 'Mar 24', pricePerUnit: 138000, units: 140, capRate: 5.3 },
  { date: 'Jun 24', pricePerUnit: 152000, units: 260, capRate: 5.0 },
  { date: 'Sep 24', pricePerUnit: 144000, units: 180, capRate: 5.2 },
  { date: 'Dec 24', pricePerUnit: 158000, units: 320, capRate: 4.8 },
  { date: 'Mar 25', pricePerUnit: 141000, units: 150, capRate: 5.4 },
  { date: 'Jun 25', pricePerUnit: 162000, units: 290, capRate: 4.7 },
  { date: 'Sep 25', pricePerUnit: 148000, units: 200, capRate: 5.1 },
  { date: 'Dec 25', pricePerUnit: 156000, units: 240, capRate: 5.0 },
];

const CONCESSION_DATA = [
  { quarter: 'Q1 24', concessionPct: 6.8, occupancy: 90.8 },
  { quarter: 'Q2 24', concessionPct: 5.2, occupancy: 92.4 },
  { quarter: 'Q3 24', concessionPct: 4.6, occupancy: 93.1 },
  { quarter: 'Q4 24', concessionPct: 5.8, occupancy: 91.6 },
  { quarter: 'Q1 25', concessionPct: 5.4, occupancy: 91.2 },
  { quarter: 'Q2 25', concessionPct: 3.6, occupancy: 93.4 },
  { quarter: 'Q3 25', concessionPct: 3.0, occupancy: 94.0 },
  { quarter: 'Q4 25', concessionPct: 4.2, occupancy: 92.8 },
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

export const MSATrendsTab: React.FC<MSATrendsTabProps> = ({ msaId, msa }) => {
  const [timeRange, setTimeRange] = useState<typeof TIME_RANGES[number]>('1Y');
  const [supplyView, setSupplyView] = useState<'2yr' | '10yr'>('10yr');
  const [priceTrends, setPriceTrends] = useState<PriceTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [rentSnapshots, setRentSnapshots] = useState<Array<{
    snapshot_date: string;
    studio_rent: number | null;
    one_br_rent: number | null;
    two_br_rent: number | null;
    three_br_rent: number | null;
    avg_rent: number | null;
  }>>([]);
  const [rentLoading, setRentLoading] = useState(true);
  const msaName = msa?.name || msaId || 'Atlanta';
  const { fetchCommentary, getCommentary, isLoading, getError } = useCommentaryStore();
  const commentary = getCommentary('msa', msaId);
  const loading = isLoading('msa', msaId);
  const error = getError('msa', msaId);
  useEffect(() => { fetchCommentary('msa', msaId, msaName); }, [msaId, msaName]);

  useEffect(() => {
    setTrendsLoading(true);
    apiClient.get('/api/v1/georgia/analytics/price-trends?state=GA')
      .then(res => {
        const trends: PriceTrend[] = res.data?.trends || [];
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
    setRentLoading(true);
    apiClient.get('/api/v1/georgia/analytics/rent-trends?city=Atlanta&state=GA&limit=8')
      .then(res => setRentSnapshots(res.data?.snapshots || []))
      .catch(() => setRentSnapshots([]))
      .finally(() => setRentLoading(false));
  }, []);

  // Calculate max for supply wave chart
  const maxSupply = Math.max(...SUPPLY_WAVE_DATA.map(d => d.confirmed + d.capacity));

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

      {/* Row 2: Supply Wave */}
      <div style={{ ...terminalStyles.card, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Supply Wave Forecast
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
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: BT.text.muted,
              background: BT.bg.elevated,
              padding: '2px 7px', borderRadius: 0,
            }}>
              FORECAST MODEL
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['2yr', '10yr'] as const).map(view => (
              <button
                key={view}
                onClick={() => setSupplyView(view)}
                style={{
                  padding: '4px 12px',
                  background: supplyView === view ? BT.accent.blue : BT.bg.elevated,
                  color: supplyView === view ? '#fff' : BT.text.secondary,
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {/* Stacked bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, marginBottom: 16 }}>
          {SUPPLY_WAVE_DATA.slice(0, supplyView === '2yr' ? 3 : 9).map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                height: 140,
                justifyContent: 'flex-end',
              }}>
                {d.capacity > 0 && (
                  <div style={{
                    width: '80%',
                    height: `${(d.capacity / maxSupply) * 100}%`,
                    background: 'rgba(139,92,246,0.4)',
                    borderRadius: 0,
                    borderBottom: d.confirmed > 0 ? 'none' : undefined,
                  }} />
                )}
                {d.confirmed > 0 && (
                  <div style={{
                    width: '80%',
                    height: `${(d.confirmed / maxSupply) * 100}%`,
                    background: BT.accent.blue,
                    borderRadius: 0,
                  }} />
                )}
              </div>
              <span style={{ fontSize: 10, color: BT.text.muted, marginTop: 4 }}>{d.year}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: BT.accent.blue, borderRadius: 0 }} />
            <span style={{ fontSize: 10, color: BT.text.muted }}>Confirmed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: 'rgba(139,92,246,0.4)', borderRadius: 0 }} />
            <span style={{ fontSize: 10, color: BT.text.muted }}>Capacity (probability-weighted)</span>
          </div>
        </div>
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
        {/* Market Rents by Bedroom Type */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Market Rents by Bedroom
            </h3>
            {!rentLoading && rentSnapshots.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: BT.text.green,
                background: 'rgba(34,197,94,0.12)',
                padding: '2px 7px', borderRadius: 0,
              }}>
                LIVE · APT LOCATOR
              </span>
            )}
          </div>
          {rentLoading ? (
            <div style={{ fontSize: 11, color: BT.text.muted, textAlign: 'center', padding: 20 }}>
              Loading rent data...
            </div>
          ) : rentSnapshots.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rentSnapshots.slice(0, 6).map((s, i) => {
                  const maxR = Math.max(
                    s.studio_rent || 0, s.one_br_rent || 0,
                    s.two_br_rent || 0, s.three_br_rent || 0, 1
                  );
                  const label = s.snapshot_date
                    ? new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                    : '—';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 48, fontSize: 10, color: BT.text.muted }}>{label}</span>
                      <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', height: 20 }}>
                        {s.studio_rent && (
                          <div style={{ flex: 1, height: `${(s.studio_rent / maxR) * 100}%`, background: '#22c55e', borderRadius: 0 }} title={`Studio: $${s.studio_rent}`} />
                        )}
                        {s.one_br_rent && (
                          <div style={{ flex: 1, height: `${(s.one_br_rent / maxR) * 100}%`, background: '#3b82f6', borderRadius: 0 }} title={`1BR: $${s.one_br_rent}`} />
                        )}
                        {s.two_br_rent && (
                          <div style={{ flex: 1, height: `${(s.two_br_rent / maxR) * 100}%`, background: '#f59e0b', borderRadius: 0 }} title={`2BR: $${s.two_br_rent}`} />
                        )}
                        {s.three_br_rent && (
                          <div style={{ flex: 1, height: `${(s.three_br_rent / maxR) * 100}%`, background: '#f97316', borderRadius: 0 }} title={`3BR: $${s.three_br_rent}`} />
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: BT.text.secondary, width: 44, textAlign: 'right' }}>
                        {s.avg_rent ? `$${Math.round(s.avg_rent / 100) * 100}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Studio', color: '#22c55e' },
                  { label: '1BR', color: '#3b82f6' },
                  { label: '2BR', color: '#f59e0b' },
                  { label: '3BR', color: '#f97316' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, background: item.color, borderRadius: 0 }} />
                    <span style={{ fontSize: 10, color: BT.text.muted }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', borderLeft: `2px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: 12, color: BT.text.muted, marginBottom: 6 }}>
                No rent snapshot data available
              </div>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                Run the Atlanta sync to populate market rent snapshots.
              </div>
            </div>
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

        {/* Concession Tracking */}
        <div style={{ flex: 1, ...terminalStyles.card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...terminalStyles.sectionTitle, fontSize: 14 }}>
              Concession vs Occupancy
            </h3>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: BT.text.muted, background: BT.bg.elevated,
              padding: '2px 7px', borderRadius: 0,
            }}>BENCHMARK MODEL</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CONCESSION_DATA.slice(-6).map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 48, fontSize: 10, color: BT.text.muted }}>{d.quarter}</span>
                <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{
                    width: `${d.concessionPct * 10}%`,
                    height: 12,
                    background: BT.accent.red,
                    borderRadius: 0,
                  }} />
                  <span style={{ fontSize: 10, color: BT.accent.red }}>{d.concessionPct}%</span>
                </div>
                <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <div style={{
                    width: `${(d.occupancy - 85) * 6}%`,
                    height: 12,
                    background: BT.text.green,
                    borderRadius: 0,
                  }} />
                  <span style={{ fontSize: 10, color: BT.text.green }}>{d.occupancy}%</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, background: BT.accent.red, borderRadius: 0 }} />
              <span style={{ fontSize: 10, color: BT.text.muted }}>Concession %</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, background: BT.text.green, borderRadius: 0 }} />
              <span style={{ fontSize: 10, color: BT.text.muted }}>Occupancy %</span>
            </div>
          </div>
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
