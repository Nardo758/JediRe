import React, { useState, useEffect } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';
import { apiClient } from '../../../api/client';
import { useTabTheme } from '../../../hooks/useTabTheme';

interface TrendsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

interface CorrelationMetric {
  id: string; name: string; tier: number; category: string;
  xValue: number | null; yValue: number | null; correlation: number | null;
  signal: string | null; confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string; actionable: string | null; dataSources: string[]; missingData: string[];
}

interface CorrelationReport {
  market: string; state: string; computedAt: string; snapshotDate: string | null;
  metricsComputed: number; metricsSkipped: number; correlations: CorrelationMetric[];
  summary: {
    bullishSignals: number; bearishSignals: number; neutralSignals: number;
    insufficientData: number; rentRunway: string | null; affordabilityCeiling: string | null;
    supplyPressure: string | null; topOpportunity: string | null;
  };
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };
const badge = (color: string): React.CSSProperties => ({
  fontSize: 8, fontWeight: 700, color, background: color + '20',
  padding: '1px 6px', borderRadius: 2, letterSpacing: 1, ...mono,
});
const insightBox = (color: string): React.CSSProperties => ({
  background: color + '0A', border: `1px solid ${color}28`,
  padding: '8px 10px', borderRadius: 2, marginTop: 6,
});

// ── STATIC DATA ──
const TIME_RANGES = ['3M', '6M', '1Y', '3Y', '5Y', 'Max'] as const;
const SUBMARKETS = ['All', 'Buckhead', 'Midtown', 'Decatur', 'Sandy Springs', 'East Atlanta'];

const DEMAND_SIGNALS = [
  { id: 'D-01', name: 'Jobs-to-Apartments Ratio',   value: '2.8x',     ok: true  },
  { id: 'D-02', name: 'New Jobs to New Units',       value: '3.1x',     ok: true  },
  { id: 'D-03', name: 'Net Migration to Supply',     value: '1.4x',     ok: true  },
  { id: 'D-04', name: 'Household Formation',         value: '+12.4K/yr',ok: true  },
  { id: 'D-05', name: 'Traffic Count Growth',        value: '+4.2%',    ok: true  },
  { id: 'D-06', name: 'Traffic Acceleration',        value: '+0.8%',    ok: true  },
  { id: 'D-07', name: 'Digital-Physical Gap',        value: '1.3x',     ok: true  },
  { id: 'D-08', name: 'Search Interest Volume',      value: '↑ 18%',    ok: true  },
  { id: 'D-09', name: 'Demand Momentum Score',       value: '78/100',   ok: true  },
  { id: 'D-10', name: 'Employment Gravity',          value: '82/100',   ok: true  },
  { id: 'D-11', name: 'Rent-to-Mortgage Discount',  value: '24%',      ok: true  },
];

const SUPPLY_SIGNALS = [
  { id: 'S-04', name: 'Absorption Runway',           value: '14 mo',    ok: false },
  { id: 'S-05', name: 'Delivery Clustering',         value: '3 clusters',ok: false},
  { id: 'S-06', name: 'Permit Momentum',             value: '↓ 12%',    ok: true  },
  { id: 'S-07', name: 'Construction Cost vs Yield',  value: '5.8%',     ok: true  },
  { id: 'S-08', name: 'Saturation Index',            value: '0.92',     ok: true  },
  { id: 'S-09', name: 'Permit-to-Delivery',          value: '68%',      ok: false },
];

const CORRELATION_QUARTERS = [
  { quarter: 'Q1 2024', rentGrowth: 1.8, trafficTrend: 1.2, wageGrowth: 3.4 },
  { quarter: 'Q2 2024', rentGrowth: 4.2, trafficTrend: 3.8, wageGrowth: 3.1 },
  { quarter: 'Q3 2024', rentGrowth: 5.1, trafficTrend: 4.6, wageGrowth: 2.8 },
  { quarter: 'Q4 2024', rentGrowth: 3.4, trafficTrend: 2.8, wageGrowth: 3.0 },
  { quarter: 'Q1 2025', rentGrowth: 3.8, trafficTrend: 2.4, wageGrowth: 3.2 },
  { quarter: 'Q2 2025', rentGrowth: 6.8, trafficTrend: 6.2, wageGrowth: 2.9 },
  { quarter: 'Q3 2025', rentGrowth: 7.6, trafficTrend: 7.1, wageGrowth: 2.6 },
  { quarter: 'Q4 2025', rentGrowth: 5.4, trafficTrend: 4.5, wageGrowth: 2.7 },
];

const AFFORDABILITY_DATA = {
  medianHouseholdIncome: 72500, medianMonthlyRent: 1895,
  thresholdPercent: 30, currentPercent: 31.4,
  historicalPercents: [26.8, 28.6, 29.2, 28.4, 29.0, 30.6, 31.4, 30.2],
};

const SUPPLY_WAVE_DATA = [
  { year: '2026', confirmed: 8200, capacity: 1200 },
  { year: '2027', confirmed: 6400, capacity: 1400 },
  { year: '2028', confirmed: 3800, capacity: 1600 },
  { year: '2029', confirmed: 1200, capacity: 1800 },
  { year: '2030', confirmed: 400,  capacity: 1600 },
  { year: '2031', confirmed: 0,    capacity: 1200 },
  { year: '2032', confirmed: 0,    capacity: 800  },
  { year: '2033', confirmed: 0,    capacity: 600  },
  { year: '2034', confirmed: 0,    capacity: 400  },
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
const RENT_FORECAST = [
  { quarter: 'Q1 26', aPlus: 2640, a: 2380, bPlus: 2060, b: 1800, c: 1400 },
  { quarter: 'Q2 26', aPlus: 2750, a: 2480, bPlus: 2220, b: 1960, c: 1540 },
];

const SUPPLY_QUARTERLY = [
  { quarter: 'Q1 25', underConstruction: 2600, permitted: 1100 },
  { quarter: 'Q2 25', underConstruction: 3400, permitted: 2200 },
  { quarter: 'Q3 25', underConstruction: 2900, permitted: 1800 },
  { quarter: 'Q4 25', underConstruction: 1800, permitted: 1200 },
  { quarter: 'Q1 26', underConstruction: 1500, permitted: 900  },
  { quarter: 'Q2 26', underConstruction: 2100, permitted: 1400 },
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

function computeCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY;
    num += dx * dy; denX += dx * dx; denY += dy * dy;
  }
  return denX && denY ? num / Math.sqrt(denX * denY) : 0;
}

function checkDivergence(): boolean {
  let consecutive = 0;
  for (const q of CORRELATION_QUARTERS) {
    if (q.rentGrowth > q.wageGrowth * 1.5) { consecutive++; if (consecutive >= 3) return true; }
    else consecutive = 0;
  }
  return false;
}

// ── COMPONENT ──
const TrendsTab: React.FC<TrendsTabProps> = ({ marketId }) => {
  const T = useTabTheme();
  const card: React.CSSProperties = { background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' };
  const hdr = (accent: string): React.CSSProperties => ({
    padding: '8px 14px', background: T.dimBg,
    borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${accent}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  });
  const [timeRange, setTimeRange] = useState<string>('1Y');
  const [submarketFilter, setSubmarketFilter] = useState('All');
  const [supplyView, setSupplyView] = useState<'2yr' | '10yr'>('2yr');
  const [correlationReport, setCorrelationReport] = useState<CorrelationReport | null>(null);
  const [correlationLoading, setCorrelationLoading] = useState(true);
  const [correlationError, setCorrelationError] = useState<string | null>(null);
  const [showPendingMetrics, setShowPendingMetrics] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCorrelations = async () => {
      try {
        setCorrelationLoading(true); setCorrelationError(null);
        const response: any = await apiClient.get('/correlations/report');
        const report = response?.data || response;
        if (!cancelled && report?.correlations) setCorrelationReport(report);
        else if (!cancelled) setCorrelationError('Invalid response format');
      } catch (err: any) {
        if (!cancelled) setCorrelationError(err?.message || 'Failed to load correlation data');
      } finally {
        if (!cancelled) setCorrelationLoading(false);
      }
    };
    fetchCorrelations();
    return () => { cancelled = true; };
  }, []);

  const computedMetrics = correlationReport?.correlations.filter(c => c.confidence !== 'insufficient') || [];
  const pendingMetrics  = correlationReport?.correlations.filter(c => c.confidence === 'insufficient') || [];
  const getCorMetric = (id: string) => correlationReport?.correlations.find(c => c.id === id);
  const cor04 = getCorMetric('COR-04');
  const cor13 = getCorMetric('COR-13');
  const liveAffordabilityRatio = cor04?.xValue ?? cor13?.xValue ?? null;
  const liveRentRunway = cor04?.actionable ?? null;
  const maxSupplyVal = Math.max(...SUPPLY_WAVE_DATA.map(d => d.confirmed + d.capacity));

  // Correlation metric renderers
  const sigStyle: Record<string, { bg: string; color: string; icon: string }> = {
    bullish: { bg: T.green + '12', color: T.green, icon: '▲' },
    bearish: { bg: T.red   + '12', color: T.red,   icon: '▼' },
    neutral: { bg: T.muted + '12', color: T.secondary, icon: '─' },
  };
  const confColor: Record<string, string> = {
    high: T.green, medium: T.cyan, low: T.amber, insufficient: T.muted,
  };

  const renderCorRow = (metric: CorrelationMetric) => {
    const s = sigStyle[metric.signal || 'neutral'] || sigStyle.neutral;
    return (
      <div key={metric.id} style={{ padding: '6px 8px', background: s.bg, borderRadius: 2, marginBottom: 4 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, ...mono }}>{metric.id}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: s.color }}>{metric.name}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: s.color, ...mono }}>{s.icon} {metric.signal}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: confColor[metric.confidence], background: confColor[metric.confidence] + '20', padding: '1px 4px', borderRadius: 2, ...mono }}>{metric.confidence.toUpperCase()}</span>
          <span style={{ fontSize: 8, color: T.muted, ...mono }}>Lead: {metric.leadTime}</span>
        </div>
        {metric.actionable && <div style={{ fontSize: 10, color: s.color, marginTop: 3 }}>{metric.actionable}</div>}
        {metric.xValue !== null && (
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>X: {metric.xValue}</span>
            {metric.yValue !== null && <span style={{ fontSize: 9, color: T.secondary, ...mono }}>Y: {metric.yValue}%</span>}
            {metric.correlation !== null && <span style={{ fontSize: 9, color: T.secondary, ...mono }}>r: {metric.correlation}</span>}
          </div>
        )}
      </div>
    );
  };

  const renderPendingRow = (metric: CorrelationMetric) => (
    <div key={metric.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, width: 50, ...mono }}>{metric.id}</span>
      <span style={{ fontSize: 9, color: T.secondary, flex: 1 }}>{metric.name}</span>
      <span style={{ fontSize: 8, color: T.muted, fontStyle: 'italic', ...mono }}>
        {metric.missingData[0] || 'pending'}
      </span>
    </div>
  );

  // ── Shared legend helper
  const leg = (color: string, label: string, dashed = false) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: T.secondary, ...mono }}>
      <span style={{ width: 14, height: 2, background: dashed ? 'none' : color, borderTop: dashed ? `2px dashed ${color}` : 'none', borderRadius: 1, flexShrink: 0 }} />
      {label}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: T.bg, minHeight: '100%' }}>

      {/* ── TIME RANGE + SUBMARKET CONTROLS ── */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, padding: '8px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: T.secondary, ...mono, marginRight: 4 }}>RANGE:</span>
          {TIME_RANGES.map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                fontSize: 9, fontWeight: 700, ...mono, cursor: 'pointer',
                padding: '3px 9px', borderRadius: 2, border: 'none',
                background: timeRange === range ? T.amber : T.dimBg,
                color: timeRange === range ? '#000' : T.secondary,
                outline: timeRange === range ? 'none' : `1px solid ${T.border}`,
                transition: 'all 0.12s',
              }}
            >
              {range}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: T.secondary, ...mono }}>SUBMARKET:</span>
          <select
            value={submarketFilter}
            onChange={e => setSubmarketFilter(e.target.value)}
            style={{ fontSize: 9, background: T.dimBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 2, padding: '3px 8px', cursor: 'pointer', ...mono }}
          >
            {SUBMARKETS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── SECTION 0: CURRENT MARKET SIGNALS (NEW) ── */}
      <div style={card}>
        <div style={hdr(T.green)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: 2, ...mono }}>CURRENT MARKET SIGNALS</span>
            <span style={badge(T.green)}>SNAPSHOT</span>
          </div>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>D-01..D-11 DEMAND · S-04..S-09 SUPPLY · AS OF Q4 2025</span>
        </div>
        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* DEMAND column */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.green, letterSpacing: 2, ...mono, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.green}30` }}>
              DEMAND SIGNALS · {DEMAND_SIGNALS.filter(s => s.ok).length}/{DEMAND_SIGNALS.length} POSITIVE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {DEMAND_SIGNALS.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', borderRadius: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 8, color: s.ok ? T.green : T.amber, ...mono }}>{s.ok ? '✓' : '⚠'}</span>
                    <span style={{ fontSize: 8, color: T.muted, ...mono, width: 32 }}>{s.id}</span>
                    <span style={{ fontSize: 10, color: T.secondary }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.text, ...mono }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{ ...insightBox(T.green), marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.green, ...mono }}>STRONG DEMAND</span>
                <span style={{ fontSize: 8, color: T.green, ...mono }}>Confidence: 82%</span>
              </div>
              <p style={{ fontSize: 9, color: T.secondary, lineHeight: 1.5 }}>
                Atlanta job growth at 2.8× apartments ratio. Net migration +48K/yr sustains demand pressure. Household formation outpaces supply in Class B/C segments.
              </p>
            </div>
          </div>
          {/* SUPPLY column */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.amber}30` }}>
              SUPPLY SIGNALS · {SUPPLY_SIGNALS.filter(s => s.ok).length}/{SUPPLY_SIGNALS.length} FAVORABLE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SUPPLY_SIGNALS.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', borderRadius: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 8, color: s.ok ? T.green : T.amber, ...mono }}>{s.ok ? '✓' : '⚠'}</span>
                    <span style={{ fontSize: 8, color: T.muted, ...mono, width: 32 }}>{s.id}</span>
                    <span style={{ fontSize: 10, color: T.secondary }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.text, ...mono }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{ ...insightBox(T.amber), marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>MODERATE SUPPLY RISK</span>
                <span style={{ fontSize: 8, color: T.amber, ...mono }}>Confidence: 68%</span>
              </div>
              <p style={{ fontSize: 9, color: T.secondary, lineHeight: 1.5 }}>
                14-month absorption runway elevated from Class A deliveries in Midtown/Buckhead. Permit momentum slowing (−12%). Construction costs filtering marginal projects.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: RENT TRENDS BY VINTAGE ── */}
      <div style={card}>
        <div style={hdr(SIGNAL_GROUPS.MOMENTUM.color)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>RENT TRENDS BY VINTAGE</span>
            <span style={badge(T.violet)}>★ ENHANCED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>Sources: M-01, M-02, R-02 + DC-11</span>
            <span style={badge(T.secondary)}>4 OUTPUTS</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {(() => {
            const allData = [...RENT_VINTAGE_DATA, ...RENT_FORECAST];
            const cW = 520, cH = 220, pL = 55, pR = 15, pT = 15, pB = 30;
            const plotW = cW - pL - pR, plotH = cH - pT - pB;
            const allVals = allData.flatMap(d => [d.aPlus, d.a, d.bPlus, d.b, d.c]);
            const minV = Math.min(...allVals) - 100, maxV = Math.max(...allVals) + 100;
            const step = plotW / (allData.length - 1);
            const toY = (v: number) => pT + plotH - ((v - minV) / (maxV - minV)) * plotH;
            const lines = [
              { field: 'aPlus' as const, color: '#4f46e5', label: 'A+ Vintage' },
              { field: 'a'    as const, color: '#3b82f6', label: 'A Vintage'  },
              { field: 'bPlus'as const, color: '#10b981', label: 'B+ Vintage' },
              { field: 'b'    as const, color: '#f59e0b', label: 'B Vintage'  },
              { field: 'c'    as const, color: '#f87171', label: 'C Vintage'  },
            ];
            const histLen = RENT_VINTAGE_DATA.length;
            return (
              <>
                <svg viewBox={`0 0 ${cW} ${cH}`} style={{ height: '140px', width: 'auto', maxWidth: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    const val = minV + (maxV - minV) * frac;
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke={T.border} strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" fill={T.muted} fontSize={9}>${Math.round(val).toLocaleString()}</text>
                      </g>
                    );
                  })}
                  {allData.map((d, i) => <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" fill={T.muted} fontSize={8}>{d.quarter}</text>)}
                  <line x1={pL + (histLen - 1) * step} y1={pT} x2={pL + (histLen - 1) * step} y2={pT + plotH} stroke={T.violet} strokeWidth={1} strokeDasharray="4,3" />
                  <text x={pL + (histLen - 1) * step + 4} y={pT + 10} fill={T.violet} fontSize={8}>Forecast</text>
                  {lines.map(line => {
                    const histPts = RENT_VINTAGE_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toY(d[line.field])}`).join(' ');
                    const fcPts   = RENT_FORECAST.map((d, i) => `L${pL + (histLen + i) * step},${toY(d[line.field])}`).join(' ');
                    const lH = RENT_VINTAGE_DATA[histLen - 1];
                    return (
                      <g key={line.field}>
                        <path d={histPts} fill="none" stroke={line.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={`M${pL + (histLen - 1) * step},${toY(lH[line.field])} ${fcPts}`} fill="none" stroke={line.color} strokeWidth={2} strokeDasharray="6,4" strokeLinecap="round" />
                      </g>
                    );
                  })}
                  {lines.map(line => {
                    const lastVal = allData[allData.length - 1][line.field];
                    return <circle key={line.field} cx={pL + (allData.length - 1) * step} cy={toY(lastVal)} r={3} fill={line.color} />;
                  })}
                </svg>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
                  {lines.map(l => leg(l.color, l.label))}
                  {leg(T.violet, 'DC-11 Forecast', true)}
                </div>
                <div style={insightBox(T.cyan)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, ...mono }}>INSIGHT · </span>
                  <span style={{ fontSize: 10, color: T.secondary }}>B/C vintages outpacing A by 2×. DC-11 forecast shows B accelerating further due to supply constraint in value-add corridors.</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── SECTION 2: SUPPLY PIPELINE TIMELINE ── */}
      <div style={card}>
        <div style={hdr(SIGNAL_GROUPS.SUPPLY.color)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>SUPPLY PIPELINE TIMELINE</span>
            <span style={badge(T.violet)}>★ ENHANCED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>Sources: S-02, S-03, S-04, S-05, S-06 + DC-08</span>
            <span style={badge(T.secondary)}>6 OUTPUTS</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['2yr', '10yr'] as const).map(v => (
              <button key={v} onClick={() => setSupplyView(v)} style={{
                fontSize: 9, fontWeight: 700, ...mono, cursor: 'pointer',
                padding: '3px 10px', borderRadius: 2, border: 'none',
                background: supplyView === v ? T.red : T.dimBg,
                color: supplyView === v ? '#fff' : T.secondary,
                outline: supplyView === v ? 'none' : `1px solid ${T.border}`,
              }}>
                {v === '2yr' ? '2-YEAR PIPELINE' : '10-YEAR SUPPLY WAVE ★'}
              </button>
            ))}
          </div>

          {supplyView === '2yr' ? (
            <div style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: T.secondary, ...mono }}>Quarterly Pipeline (S-02 + S-03)</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {leg(T.red, 'Under Construction')}
                  {leg(T.amber, 'Permitted')}
                </div>
              </div>
              {(() => {
                const maxQ = Math.max(...SUPPLY_QUARTERLY.map(d => d.underConstruction + d.permitted));
                const barW = 50, gap = 70;
                return (
                  <svg viewBox={`0 0 ${SUPPLY_QUARTERLY.length * gap + 20} 160`} style={{ height: '110px', width: 'auto', maxWidth: '100%' }}>
                    {SUPPLY_QUARTERLY.map((d, i) => {
                      const x = i * gap + 20;
                      const ucH  = (d.underConstruction / maxQ) * 110;
                      const prmH = (d.permitted / maxQ) * 110;
                      return (
                        <g key={d.quarter}>
                          <rect x={x} y={130 - ucH - prmH} width={barW} height={prmH} rx={2} fill={T.amber} opacity={0.7} />
                          <rect x={x} y={130 - ucH} width={barW} height={ucH} rx={2} fill={T.red} />
                          <text x={x + barW / 2} y={148} textAnchor="middle" fill={T.muted} fontSize={9}>{d.quarter}</text>
                          <text x={x + barW / 2} y={130 - ucH - prmH - 4} textAnchor="middle" fill={T.secondary} fontSize={8}>{((d.underConstruction + d.permitted) / 1000).toFixed(1)}k</text>
                        </g>
                      );
                    })}
                    <line x1="15" y1="130" x2={SUPPLY_QUARTERLY.length * gap + 10} y2="130" stroke={T.border} strokeWidth={1} />
                  </svg>
                );
              })()}
            </div>
          ) : (
            <div style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: T.secondary, ...mono }}>10-Year Supply Wave Forecast (DC-08)</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {leg(T.red, 'Confirmed Pipeline')}
                  {leg('#fb923c', 'Capacity Conversion')}
                </div>
              </div>
              <svg viewBox="0 0 450 160" style={{ height: '110px', width: 'auto', maxWidth: '100%' }}>
                {SUPPLY_WAVE_DATA.map((d, i) => {
                  const barWidth = 35, gap = 50, x = i * gap + 15;
                  const confirmedH = (d.confirmed / maxSupplyVal) * 120;
                  const capacityH  = (d.capacity  / maxSupplyVal) * 120;
                  return (
                    <g key={d.year}>
                      <rect x={x} y={140 - confirmedH - capacityH} width={barWidth} height={capacityH} rx={2} fill="#fb923c" opacity={0.7} />
                      <rect x={x} y={140 - confirmedH} width={barWidth} height={confirmedH} rx={2} fill={T.red} />
                      <text x={x + barWidth / 2} y={155} textAnchor="middle" fill={T.muted} fontSize={9}>{d.year}</text>
                      {d.confirmed > 0 && (
                        <text x={x + barWidth / 2} y={140 - confirmedH - capacityH - 4} textAnchor="middle" fill={T.secondary} fontSize={8}>{((d.confirmed + d.capacity) / 1000).toFixed(1)}k</text>
                      )}
                    </g>
                  );
                })}
                <line x1="0" y1="140" x2="450" y2="140" stroke={T.border} strokeWidth={1} />
              </svg>
            </div>
          )}
          <div style={insightBox(T.red)}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.red, ...mono }}>INSIGHT · </span>
            <span style={{ fontSize: 10, color: T.secondary }}>Peak year: 2026 (8,200u). Pipeline exhaustion: 2029. Capacity conversion tapers to ~800u/yr by 2032.</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: DEMAND SIGNAL TRENDS ── */}
      <div style={card}>
        <div style={hdr(SIGNAL_GROUPS.DEMAND.color)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>DEMAND SIGNAL TRENDS</span>
            <span style={badge(T.violet)}>★ ENHANCED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>Sources: D-05, D-06, D-07, D-08, D-09 + T-02, T-03, T-07</span>
            <span style={badge(T.secondary)}>8 OUTPUTS</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {(() => {
            const cW = 520, cH = 200, pL = 45, pR = 45, pT = 15, pB = 30;
            const plotW = cW - pL - pR, plotH = cH - pT - pB;
            const step = plotW / (DEMAND_SIGNAL_DATA.length - 1);
            const maxLeft = 10, maxRight = 100;
            const toYL = (v: number) => pT + plotH - (v / maxLeft) * plotH;
            const toYR = (v: number) => pT + plotH - (v / maxRight) * plotH;
            const mkLine = (vals: number[], toY: (v: number) => number, color: string, dashed = false) => {
              const pts = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toY(v)}`).join(' ');
              return <path d={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '6,4' : undefined} />;
            };
            return (
              <>
                <svg viewBox={`0 0 ${cW} ${cH}`} style={{ height: '140px', width: 'auto', maxWidth: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke={T.border} strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" fill={T.green} fontSize={9}>{(maxLeft * frac).toFixed(1)}%</text>
                        <text x={cW - pR + 4} y={y + 3} textAnchor="start" fill={T.cyan} fontSize={9}>{Math.round(maxRight * frac)}</text>
                      </g>
                    );
                  })}
                  {DEMAND_SIGNAL_DATA.map((d, i) => <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" fill={T.muted} fontSize={8}>{d.quarter}</text>)}
                  {mkLine(DEMAND_SIGNAL_DATA.map(d => d.trafficGrowth), toYL, T.green)}
                  {mkLine(DEMAND_SIGNAL_DATA.map(d => d.t02Avg), toYR, T.green, true)}
                  {mkLine(DEMAND_SIGNAL_DATA.map(d => d.searchInterest), toYR, T.cyan)}
                  {mkLine(DEMAND_SIGNAL_DATA.map(d => d.t03Avg), toYR, T.violet, true)}
                  {DEMAND_SIGNAL_DATA.map((d, i) => (
                    <g key={i}>
                      <circle cx={pL + i * step} cy={toYL(d.trafficGrowth)} r={2.5} fill={T.green} />
                      <circle cx={pL + i * step} cy={toYR(d.searchInterest)} r={2.5} fill={T.cyan} />
                    </g>
                  ))}
                  <text x={pL - 4} y={pT - 4} textAnchor="end" fill={T.green} fontSize={8}>Physical</text>
                  <text x={cW - pR + 4} y={pT - 4} textAnchor="start" fill={T.cyan} fontSize={8}>Digital</text>
                </svg>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
                  {leg(T.green,  'D-05 Traffic Growth')}
                  {leg(T.green,  'T-02 Physical Score', true)}
                  {leg(T.cyan,   'D-08 Search Interest')}
                  {leg(T.violet, 'T-03 Digital Score', true)}
                </div>
                <div style={insightBox(T.green)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.green, ...mono }}>INSIGHT · </span>
                  <span style={{ fontSize: 10, color: T.secondary }}>Digital leads physical by 8–12 weeks. T-03 uptick in Decatur Q4 2025 → T-02 uptick Q1 2026.</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── SECTION 4: TRANSACTION & CAP RATES + CONCESSION (side by side) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10 }}>
        {/* Transaction & Cap Rates */}
        <div style={card}>
          <div style={hdr(SIGNAL_GROUPS.MOMENTUM.color)}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>TRANSACTION & CAP RATES</span>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>Sources: M-08, M-09, P-07</span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {(() => {
              const cW = 380, cH = 200, pL = 55, pR = 15, pT = 15, pB = 30;
              const plotW = cW - pL - pR, plotH = cH - pT - pB;
              const prices = TRANSACTION_DATA.map(d => d.pricePerUnit);
              const minP = Math.min(...prices) - 5000, maxP = Math.max(...prices) + 5000;
              const step = plotW / (TRANSACTION_DATA.length - 1);
              const toY = (v: number) => pT + plotH - ((v - minP) / (maxP - minP)) * plotH;
              const capColor = (cap: number) => cap < 5.1 ? T.green : cap > 5.3 ? T.red : T.amber;
              return (
                <svg viewBox={`0 0 ${cW} ${cH}`} style={{ height: '130px', width: 'auto', maxWidth: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    const val = minP + (maxP - minP) * frac;
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke={T.border} strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" fill={T.muted} fontSize={8}>${(val / 1000).toFixed(0)}k</text>
                      </g>
                    );
                  })}
                  {TRANSACTION_DATA.map((d, i) => (
                    <g key={d.date}>
                      <text x={pL + i * step} y={cH - 4} textAnchor="middle" fill={T.muted} fontSize={8}>{d.date}</text>
                      <circle cx={pL + i * step} cy={toY(d.pricePerUnit)} r={Math.max(4, d.units / 40)} fill={capColor(d.capRate)} fillOpacity={0.7} stroke={capColor(d.capRate)} strokeWidth={1.5} />
                      <text x={pL + i * step} y={toY(d.pricePerUnit) - Math.max(4, d.units / 40) - 4} textAnchor="middle" fill={T.secondary} fontSize={7}>{d.capRate}%</text>
                    </g>
                  ))}
                </svg>
              );
            })()}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
              {[{ c: T.green, l: 'Cap < 5.1%' }, { c: T.amber, l: 'Cap 5.1-5.3%' }, { c: T.red, l: 'Cap > 5.3%' }].map(({ c, l }) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: T.secondary, ...mono }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  {l}
                </span>
              ))}
              <span style={{ fontSize: 8, color: T.muted, ...mono }}>Bubble size = unit count</span>
            </div>
            <div style={insightBox(T.amber)}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>CAP RATES · </span>
              <span style={{ fontSize: 10, color: T.secondary }}>5.1% → 5.5% expanding</span>
            </div>
          </div>
        </div>

        {/* Concession & Occupancy */}
        <div style={card}>
          <div style={hdr(SIGNAL_GROUPS.MOMENTUM.color)}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>CONCESSION & OCC</span>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>M-03, M-04, M-06, R-03</span>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {(() => {
              const cW = 300, cH = 180, pL = 35, pR = 35, pT = 15, pB = 30;
              const plotW = cW - pL - pR, plotH = cH - pT - pB;
              const step = plotW / (CONCESSION_DATA.length - 1);
              const maxC = 8, minO = 90, maxO = 95;
              const toYC = (v: number) => pT + plotH - (v / maxC) * plotH;
              const toYO = (v: number) => pT + plotH - ((v - minO) / (maxO - minO)) * plotH;
              const areaPath = CONCESSION_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toYC(d.concessionPct)}`).join(' ')
                + ` L${pL + (CONCESSION_DATA.length - 1) * step},${pT + plotH} L${pL},${pT + plotH} Z`;
              const occLine = CONCESSION_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toYO(d.occupancy)}`).join(' ');
              return (
                <svg viewBox={`0 0 ${cW} ${cH}`} style={{ height: '120px', width: 'auto', maxWidth: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke={T.border} strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" fill={T.orange} fontSize={8}>{(maxC * frac).toFixed(1)}%</text>
                        <text x={cW - pR + 4} y={y + 3} textAnchor="start" fill={T.cyan} fontSize={8}>{(minO + (maxO - minO) * frac).toFixed(1)}</text>
                      </g>
                    );
                  })}
                  {CONCESSION_DATA.map((d, i) => <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" fill={T.muted} fontSize={7}>{d.quarter}</text>)}
                  <path d={areaPath} fill={T.orange} fillOpacity={0.15} />
                  <path d={CONCESSION_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toYC(d.concessionPct)}`).join(' ')} fill="none" stroke={T.orange} strokeWidth={2} strokeLinecap="round" />
                  <path d={occLine} fill="none" stroke={T.cyan} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,4" />
                  {CONCESSION_DATA.map((d, i) => (
                    <g key={i}>
                      <circle cx={pL + i * step} cy={toYC(d.concessionPct)} r={2.5} fill={T.orange} />
                      <circle cx={pL + i * step} cy={toYO(d.occupancy)} r={2.5} fill={T.cyan} />
                    </g>
                  ))}
                </svg>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 6 }}>
              {leg(T.orange, 'Concession % GPR')}
              {leg(T.cyan, 'Occupancy %', true)}
            </div>
            <div style={insightBox(T.orange)}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.orange, ...mono }}>CONCESSION · </span>
              <span style={{ fontSize: 10, color: T.secondary }}>4.8% → 3.2% (declining). Availability declining.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: JEDI SCORE HISTORY ── */}
      <div style={card}>
        <div style={hdr(SIGNAL_GROUPS.COMPOSITE.color)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>JEDI SCORE HISTORY</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>Source: C-01 time series</span>
            <span style={badge(T.secondary)}>1 OUTPUT</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {(() => {
            const cW = 520, cH = 200, pL = 35, pR = 15, pT = 15, pB = 30;
            const plotW = cW - pL - pR, plotH = cH - pT - pB;
            const step = plotW / (JEDI_SCORE_HISTORY.length - 1);
            const minS = 40, maxS = 100;
            const toY = (v: number) => pT + plotH - ((v - minS) / (maxS - minS)) * plotH;
            const scoreSeries = [
              { field: 'composite' as const, color: T.cyan,  label: 'JEDI Composite', width: 3 },
              { field: 'demand'    as const, color: T.green, label: 'Demand',          width: 1.5 },
              { field: 'supply'    as const, color: T.red,   label: 'Supply',           width: 1.5 },
              { field: 'momentum'  as const, color: T.amber, label: 'Momentum',         width: 1.5 },
            ];
            return (
              <>
                <svg viewBox={`0 0 ${cW} ${cH}`} style={{ height: '140px', width: 'auto', maxWidth: '100%' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    const val = minS + (maxS - minS) * frac;
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke={T.border} strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" fill={T.muted} fontSize={9}>{Math.round(val)}</text>
                      </g>
                    );
                  })}
                  {JEDI_SCORE_HISTORY.map((d, i) => <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" fill={T.muted} fontSize={8}>{d.quarter}</text>)}
                  {scoreSeries.map(s => {
                    const pts = JEDI_SCORE_HISTORY.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toY(d[s.field])}`).join(' ');
                    return <path key={s.field} d={pts} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />;
                  })}
                  {scoreSeries.map(s =>
                    JEDI_SCORE_HISTORY.map((d, i) => <circle key={`${s.field}-${i}`} cx={pL + i * step} cy={toY(d[s.field])} r={s.field === 'composite' ? 3 : 2} fill={s.color} />)
                  )}
                </svg>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
                  {scoreSeries.map(s => leg(s.color, s.label))}
                </div>
                <div style={insightBox(T.cyan)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.cyan, ...mono }}>TRAJECTORY · </span>
                  <span style={{ fontSize: 10, color: T.secondary }}>58 → 72 → 81 → 87 over 24 months. Primary driver: Demand acceleration (D-09: 55→82). Drag factor: Supply risk (S-composite: stable at 64).</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── SECTION 6: RENT–TRAFFIC–WAGE CORRELATION ── */}
      {(() => {
        const rents   = CORRELATION_QUARTERS.map(q => q.rentGrowth);
        const traffic = CORRELATION_QUARTERS.map(q => q.trafficTrend);
        const wages   = CORRELATION_QUARTERS.map(q => q.wageGrowth);
        const rRentTraffic = computeCorrelation(rents, traffic);
        const rRentWage    = computeCorrelation(rents, wages);
        const maxVal = Math.max(...rents, ...traffic, ...wages);
        const chartW = 480, chartH = 180, padL = 40, padR = 20, padT = 10, padB = 30;
        const plotW = chartW - padL - padR, plotH = chartH - padT - padB;
        const step = plotW / (CORRELATION_QUARTERS.length - 1);
        const mkPath = (vals: number[], color: string) => {
          const pts = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${padL + i * step},${padT + plotH - (v / maxVal) * plotH}`).join(' ');
          return <path d={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
        };
        return (
          <div style={card}>
            <div style={hdr('#6366f1')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>RENT–TRAFFIC–WAGE CORRELATION</span>
                <span style={badge('#6366f1')}>CI ENGINE</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 9, color: T.secondary, ...mono }}>r(Rent,Traffic) = <span style={{ fontWeight: 700, color: '#6366f1' }}>{rRentTraffic.toFixed(2)}</span></span>
                <span style={{ fontSize: 9, color: T.secondary, ...mono }}>r(Rent,Wage) = <span style={{ fontWeight: 700, color: T.red }}>{rRentWage.toFixed(2)}</span></span>
              </div>
            </div>
            <div style={{ padding: '10px 14px' }}>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ height: '140px', width: 'auto', maxWidth: '100%' }}>
                {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                  const y = padT + plotH * (1 - frac);
                  return (
                    <g key={frac}>
                      <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke={T.border} strokeWidth={1} />
                      <text x={padL - 4} y={y + 3} textAnchor="end" fill={T.muted} fontSize={9}>{(maxVal * frac).toFixed(1)}%</text>
                    </g>
                  );
                })}
                {CORRELATION_QUARTERS.map((q, i) => <text key={q.quarter} x={padL + i * step} y={chartH - 4} textAnchor="middle" fill={T.muted} fontSize={9}>{q.quarter}</text>)}
                {mkPath(wages,   T.green)}
                {mkPath(traffic, '#6366f1')}
                {mkPath(rents,   T.red)}
                {rents.map((v, i)   => <circle key={`r${i}`} cx={padL + i * step} cy={padT + plotH - (v / maxVal) * plotH} r={3} fill={T.red} />)}
                {traffic.map((v, i) => <circle key={`t${i}`} cx={padL + i * step} cy={padT + plotH - (v / maxVal) * plotH} r={3} fill="#6366f1" />)}
                {wages.map((v, i)   => <circle key={`w${i}`} cx={padL + i * step} cy={padT + plotH - (v / maxVal) * plotH} r={3} fill={T.green} />)}
              </svg>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
                {leg(T.red,   'Rent Growth (%)')}
                {leg('#6366f1', 'Traffic Trend (%)')}
                {leg(T.green, 'Wage Growth (%)')}
              </div>
              <div style={insightBox('#6366f1')}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', ...mono }}>INSIGHT · </span>
                <span style={{ fontSize: 10, color: T.secondary }}>Rent and traffic are highly correlated (r={rRentTraffic.toFixed(2)}), while wages have diverged significantly (r={rRentWage.toFixed(2)}), indicating affordability pressure.</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── DIVERGENCE ALERT BANNER ── */}
      {checkDivergence() && (
        <div style={{ background: T.amber + '0C', border: `2px solid ${T.amber}50`, borderRadius: 3, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.74 0z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.amber, ...mono, marginBottom: 4 }}>RENT–WAGE DIVERGENCE ALERT</div>
            <p style={{ fontSize: 10, color: T.secondary, lineHeight: 1.5 }}>
              Rent growth has outpaced wage growth by &gt;1.5× for 3+ consecutive quarters. This divergence signals affordability stress and may lead to increased vacancy, concession pressure, or regulatory intervention.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {CORRELATION_QUARTERS.slice(-4).map(q => (
                <span key={q.quarter} style={{ fontSize: 9, color: T.amber, background: T.amber + '15', padding: '2px 6px', borderRadius: 2, ...mono }}>
                  <span style={{ fontWeight: 700 }}>{q.quarter}:</span> Rent {q.rentGrowth}% vs Wage {q.wageGrowth}% ({(q.rentGrowth / q.wageGrowth).toFixed(1)}×)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 7: CORRELATION INTELLIGENCE (LIVE API) ── */}
      <div style={card}>
        <div style={hdr('#6366f1')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>CORRELATION INTELLIGENCE</span>
            <span style={badge('#6366f1')}>CI ENGINE</span>
            {correlationLoading && <span style={{ fontSize: 9, color: T.violet, ...mono }}>Loading live data…</span>}
            {!correlationLoading && !correlationError && correlationReport && (
              <span style={{ fontSize: 8, fontWeight: 700, color: T.green, background: T.green + '20', padding: '1px 5px', borderRadius: 2, ...mono }}>LIVE DATA</span>
            )}
            {correlationError && (
              <span style={{ fontSize: 8, fontWeight: 700, color: T.amber, background: T.amber + '20', padding: '1px 5px', borderRadius: 2, ...mono }}>SAMPLE DATA</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.muted, ...mono }}>COR-01..COR-20 — 20 cross-module metrics</span>
            {correlationReport && <span style={{ fontSize: 9, color: T.cyan, ...mono }}>{correlationReport.metricsComputed}/{correlationReport.correlations.length} computed</span>}
            <span style={badge(T.secondary)}>20 METRICS</span>
          </div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          {correlationReport && !correlationError ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '6px 10px', background: T.dimBg, borderRadius: 2, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 1.5, ...mono }}>MARKET SIGNALS:</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.green, ...mono }}>{correlationReport.summary.bullishSignals} bullish</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.red, ...mono }}>{correlationReport.summary.bearishSignals} bearish</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.secondary, ...mono }}>{correlationReport.summary.neutralSignals} neutral</span>
                <span style={{ fontSize: 10, color: T.muted, ...mono }}>{correlationReport.summary.insufficientData} pending</span>
                {correlationReport.summary.topOpportunity && (
                  <span style={{ fontSize: 10, color: T.green, fontWeight: 600, ...mono }}>★ {correlationReport.summary.topOpportunity}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {(['bullish', 'neutral', 'bearish'] as const).map(sig => {
                  const s = sigStyle[sig];
                  const items = computedMetrics.filter(m => m.signal === sig);
                  return (
                    <div key={sig}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${s.color}30` }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, padding: '1px 6px', borderRadius: 2, ...mono }}>
                          {s.icon} {sig.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: s.color, ...mono }}>{items.length}</span>
                      </div>
                      {items.map(m => renderCorRow(m))}
                      {items.length === 0 && <p style={{ fontSize: 9, color: T.muted, fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No {sig} signals</p>}
                    </div>
                  );
                })}
              </div>
              {pendingMetrics.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setShowPendingMetrics(!showPendingMetrics)}
                    style={{ fontSize: 9, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', ...mono }}>
                    {showPendingMetrics ? 'Hide' : 'Show'} {pendingMetrics.length} pending metrics (awaiting data sources)
                  </button>
                  {showPendingMetrics && (
                    <div style={{ marginTop: 6, border: `1px solid ${T.border}`, borderRadius: 2, padding: '6px 8px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: 1, marginBottom: 4, ...mono }}>AWAITING DATA SOURCES:</div>
                      {pendingMetrics.map(m => renderPendingRow(m))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : correlationError ? (
            <div style={insightBox(T.amber)}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>DATA UNAVAILABLE · </span>
              <span style={{ fontSize: 10, color: T.secondary }}>{correlationError}. Showing static Pearson analysis above.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
              <span style={{ fontSize: 10, color: T.secondary, ...mono }}>Loading correlation metrics…</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 8: AFFORDABILITY CEILING GAUGE ── */}
      <div style={card}>
        <div style={hdr('#f43f5e')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>AFFORDABILITY CEILING GAUGE</span>
            <span style={badge('#6366f1')}>CI ENGINE</span>
            {liveAffordabilityRatio !== null && <span style={{ fontSize: 8, fontWeight: 700, color: T.green, background: T.green + '20', padding: '1px 5px', borderRadius: 2, ...mono }}>LIVE</span>}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800, color: AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? T.red : T.green,
            background: (AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? T.red : T.green) + '20',
            padding: '2px 8px', borderRadius: 12, ...mono,
          }}>
            {AFFORDABILITY_DATA.currentPercent}%
          </span>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Median HH Income',    val: `$${AFFORDABILITY_DATA.medianHouseholdIncome.toLocaleString()}`, color: T.text },
              { label: 'Median Monthly Rent',  val: `$${AFFORDABILITY_DATA.medianMonthlyRent.toLocaleString()}`,    color: T.text },
              { label: 'Rent-to-Income Ratio', val: `${AFFORDABILITY_DATA.currentPercent}%`,                        color: AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? T.red : T.green },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: T.secondary, ...mono, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color, ...mono }}>{val}</div>
              </div>
            ))}
          </div>
          {(() => {
            const gaugeW = 480, gaugeH = 80, barY = 25, barH = 24;
            const minP = 20, maxP = 40, range = maxP - minP;
            const toX = (pct: number) => ((pct - minP) / range) * (gaugeW - 60) + 30;
            const threshX = toX(AFFORDABILITY_DATA.thresholdPercent);
            const currX   = toX(AFFORDABILITY_DATA.currentPercent);
            const overThresh = AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent;
            return (
              <svg viewBox={`0 0 ${gaugeW} ${gaugeH}`} style={{ height: '64px', width: 'auto', maxWidth: '100%' }}>
                <rect x={30} y={barY} width={gaugeW - 60} height={barH} rx={4} fill={T.dimBg} stroke={T.border} strokeWidth={1} />
                <rect x={30} y={barY} width={Math.max(0, currX - 30)} height={barH} rx={4} fill={overThresh ? T.red : T.green} opacity={0.7} />
                <line x1={threshX} y1={barY - 6} x2={threshX} y2={barY + barH + 6} stroke={T.red} strokeWidth={2.5} strokeDasharray="4,3" />
                <text x={threshX} y={barY - 10} textAnchor="middle" fill={T.red} fontSize={10} fontWeight={700}>{AFFORDABILITY_DATA.thresholdPercent}% Threshold</text>
                <circle cx={currX} cy={barY + barH / 2} r={6} fill={overThresh ? T.red : T.green} />
                <text x={currX} y={barY + barH + 18} textAnchor="middle" fill={overThresh ? T.red : T.green} fontSize={10} fontWeight={700}>{AFFORDABILITY_DATA.currentPercent}%</text>
                {[20, 25, 30, 35, 40].map(tick => (
                  <text key={tick} x={toX(tick)} y={barY + barH + 18} textAnchor="middle" fill={T.muted} fontSize={8}>{tick}%</text>
                ))}
              </svg>
            );
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>8-QTR TREND:</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {AFFORDABILITY_DATA.historicalPercents.map((pct, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 18, borderRadius: 2, fontSize: 8, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono,
                    background: pct > AFFORDABILITY_DATA.thresholdPercent ? T.red + '30' : T.green + '20',
                    color: pct > AFFORDABILITY_DATA.thresholdPercent ? T.red : T.green,
                  }}>{pct}</div>
                  <span style={{ fontSize: 7, color: T.muted, ...mono, marginTop: 2 }}>{CORRELATION_QUARTERS[i]?.quarter.replace(' ', '\n') || ''}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={insightBox(AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? T.red : T.green)}>
            <span style={{ fontSize: 9, fontWeight: 700, color: AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? T.red : T.green, ...mono }}>
              {AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'WARNING · ' : 'STATUS · '}
            </span>
            <span style={{ fontSize: 10, color: T.secondary }}>
              Rent-to-income ratio has {AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'exceeded' : 'not yet reached'} the {AFFORDABILITY_DATA.thresholdPercent}% threshold.
              {AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent && ' Markets above this level historically see increased turnover and concession pressure within 2–3 quarters.'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 9: RENT RUNWAY INDICATOR ── */}
      <div style={card}>
        <div style={hdr(T.green)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>RENT RUNWAY INDICATOR</span>
            <span style={badge('#6366f1')}>CI ENGINE</span>
            {liveRentRunway && <span style={{ fontSize: 8, fontWeight: 700, color: T.green, background: T.green + '20', padding: '1px 5px', borderRadius: 2, ...mono }}>LIVE</span>}
          </div>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>When wages outpace rents, the gap = runway (COR-04)</span>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(() => {
            const wageGrowth = cor04?.xValue ?? 4.2;
            const rentGrowth = cor04?.yValue ?? 1.8;
            const hasRunway  = wageGrowth > rentGrowth;
            const gapPct = Math.abs(wageGrowth - rentGrowth).toFixed(1);
            const ratio  = (wageGrowth / rentGrowth).toFixed(1);
            const barW = 480, barH = 60, maxGrowth = Math.max(wageGrowth, rentGrowth) * 1.3;
            const toBarWidth = (val: number) => (val / maxGrowth) * (barW - 80);
            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Wage Growth', val: `${wageGrowth}%`, color: T.green },
                    { label: 'Rent Growth', val: `${rentGrowth}%`, color: T.secondary },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: T.dimBg, border: `1px solid ${T.border}`, borderRadius: 2, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: T.secondary, ...mono, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color, ...mono }}>{val}</div>
                    </div>
                  ))}
                </div>
                <svg viewBox={`0 0 ${barW} ${barH}`} style={{ height: '55px', width: 'auto', maxWidth: '100%' }}>
                  <rect x={40} y={8}  width={toBarWidth(wageGrowth)} height={18} rx={4} fill={T.green} opacity={0.8} />
                  <text x={36} y={21} textAnchor="end" fill={T.secondary} fontSize={10}>Wages</text>
                  <text x={44 + toBarWidth(wageGrowth)} y={21} fill={T.green} fontSize={10} fontWeight={700}>{wageGrowth}%</text>
                  <rect x={40} y={34} width={toBarWidth(rentGrowth)} height={18} rx={4} fill={T.secondary} opacity={0.5} />
                  <text x={36} y={47} textAnchor="end" fill={T.secondary} fontSize={10}>Rents</text>
                  <text x={44 + toBarWidth(rentGrowth)} y={47} fill={T.secondary} fontSize={10} fontWeight={700}>{rentGrowth}%</text>
                  {hasRunway && (
                    <>
                      <rect x={40 + toBarWidth(rentGrowth)} y={34} width={toBarWidth(wageGrowth) - toBarWidth(rentGrowth)} height={18} fill={T.green} fillOpacity={0.2} />
                      <text x={40 + toBarWidth(rentGrowth) + (toBarWidth(wageGrowth) - toBarWidth(rentGrowth)) / 2} y={47} textAnchor="middle" fill={T.green} fontSize={9} fontWeight={700}>RUNWAY</text>
                    </>
                  )}
                </svg>
                <div style={insightBox(hasRunway ? T.green : T.red)}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: hasRunway ? T.green : T.red, ...mono }}>
                    {hasRunway ? 'RUNWAY AVAILABLE · ' : 'NO RUNWAY · '}
                  </span>
                  <span style={{ fontSize: 10, color: T.secondary }}>
                    {hasRunway
                      ? `Wages growing ${ratio}× faster than rents, creating a ${gapPct}% gap. Room for rent increases before hitting affordability pressure.`
                      : 'Rents growing faster than wages. Affordability ceiling may limit further increases.'}
                  </span>
                  {liveRentRunway && <div style={{ fontSize: 9, color: T.green, marginTop: 4, ...mono }}>{liveRentRunway}</div>}
                </div>
              </>
            );
          })()}
        </div>
      </div>

    </div>
  );
};

export default TrendsTab;
