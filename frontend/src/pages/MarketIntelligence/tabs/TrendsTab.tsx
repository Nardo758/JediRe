import React, { useState, useEffect } from 'react';
import { SIGNAL_GROUPS } from '../signalGroups';
import { apiClient } from '../../../api/client';

interface TrendsTabProps {
  marketId: string;
  summary?: Record<string, any>;
  onUpdate?: () => void;
}

interface CorrelationMetric {
  id: string;
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;
  signal: string | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}

interface CorrelationReport {
  market: string;
  state: string;
  computedAt: string;
  snapshotDate: string | null;
  metricsComputed: number;
  metricsSkipped: number;
  correlations: CorrelationMetric[];
  summary: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    insufficientData: number;
    rentRunway: string | null;
    affordabilityCeiling: string | null;
    supplyPressure: string | null;
    topOpportunity: string | null;
  };
}

const TIME_RANGES = ['3M', '6M', '1Y', '3Y', '5Y', 'Max'] as const;
const SUBMARKETS = ['All', 'Buckhead', 'Midtown', 'Decatur', 'Sandy Springs', 'East Atlanta'];

const CORRELATION_QUARTERS = [
  { quarter: 'Q1 2024', rentGrowth: 2.1, trafficTrend: 1.8, wageGrowth: 3.2 },
  { quarter: 'Q2 2024', rentGrowth: 3.4, trafficTrend: 2.5, wageGrowth: 3.0 },
  { quarter: 'Q3 2024', rentGrowth: 4.8, trafficTrend: 3.1, wageGrowth: 2.8 },
  { quarter: 'Q4 2024', rentGrowth: 5.6, trafficTrend: 4.2, wageGrowth: 2.9 },
  { quarter: 'Q1 2025', rentGrowth: 6.2, trafficTrend: 5.0, wageGrowth: 3.1 },
  { quarter: 'Q2 2025', rentGrowth: 5.9, trafficTrend: 5.8, wageGrowth: 3.0 },
  { quarter: 'Q3 2025', rentGrowth: 6.8, trafficTrend: 6.1, wageGrowth: 2.7 },
  { quarter: 'Q4 2025', rentGrowth: 7.3, trafficTrend: 6.5, wageGrowth: 2.6 },
];

const AFFORDABILITY_DATA = {
  medianHouseholdIncome: 72500,
  medianMonthlyRent: 1895,
  thresholdPercent: 30,
  currentPercent: 31.4,
  historicalPercents: [27.2, 28.1, 28.9, 29.5, 30.1, 30.8, 31.0, 31.4],
};

const SIGNAL_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  bullish: { bg: 'bg-green-50', text: 'text-green-700', icon: '\u25B2' },
  bearish: { bg: 'bg-red-50', text: 'text-red-700', icon: '\u25BC' },
  neutral: { bg: 'bg-gray-50', text: 'text-gray-600', icon: '\u25AC' },
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-amber-100 text-amber-800',
  insufficient: 'bg-gray-100 text-gray-500',
};

function computeCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  return denX && denY ? num / Math.sqrt(denX * denY) : 0;
}

function checkDivergence(): boolean {
  let consecutive = 0;
  for (const q of CORRELATION_QUARTERS) {
    if (q.rentGrowth > q.wageGrowth * 1.5) {
      consecutive++;
      if (consecutive >= 3) return true;
    } else {
      consecutive = 0;
    }
  }
  return false;
}

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

const TrendsTab: React.FC<TrendsTabProps> = ({ marketId, summary }) => {
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
        setCorrelationLoading(true);
        setCorrelationError(null);
        const response: any = await apiClient.get('/correlations/report');
        const report = response?.data || response;
        if (!cancelled && report?.correlations) {
          setCorrelationReport(report);
        } else if (!cancelled) {
          setCorrelationError('Invalid response format');
        }
      } catch (err: any) {
        if (!cancelled) {
          setCorrelationError(err?.message || 'Failed to load correlation data');
        }
      } finally {
        if (!cancelled) setCorrelationLoading(false);
      }
    };
    fetchCorrelations();
    return () => { cancelled = true; };
  }, []);

  const computedMetrics = correlationReport?.correlations.filter(c => c.confidence !== 'insufficient') || [];
  const pendingMetrics = correlationReport?.correlations.filter(c => c.confidence === 'insufficient') || [];

  const getCorMetric = (id: string): CorrelationMetric | undefined => {
    return correlationReport?.correlations.find(c => c.id === id);
  };

  const cor04 = getCorMetric('COR-04');
  const cor13 = getCorMetric('COR-13');

  const liveAffordabilityRatio = cor04?.xValue ?? cor13?.xValue ?? null;
  const liveRentRunway = cor04?.actionable ?? null;

  const maxSupplyVal = Math.max(...SUPPLY_WAVE_DATA.map(d => d.confirmed + d.capacity));

  const renderSignalBadge = (signal: string | null) => {
    if (!signal) return null;
    const style = SIGNAL_STYLES[signal] || SIGNAL_STYLES.neutral;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
        {style.icon} {signal.charAt(0).toUpperCase() + signal.slice(1)}
      </span>
    );
  };

  const renderConfidenceBadge = (confidence: string) => {
    const style = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.insufficient;
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${style}`}>
        {confidence}
      </span>
    );
  };

  const renderCorrelationMetricRow = (metric: CorrelationMetric) => {
    const style = SIGNAL_STYLES[metric.signal || 'neutral'] || SIGNAL_STYLES.neutral;
    return (
      <div key={metric.id} className={`flex items-start gap-2 p-2.5 rounded-lg ${style.bg} border border-opacity-20`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-800">{metric.id}</span>
            <span className={`text-[11px] font-semibold ${style.text}`}>{metric.name}</span>
            {renderSignalBadge(metric.signal)}
            {renderConfidenceBadge(metric.confidence)}
            <span className="text-[9px] text-gray-400">Lead: {metric.leadTime}</span>
          </div>
          {metric.actionable && (
            <p className={`text-[11px] mt-1 ${style.text}`}>{metric.actionable}</p>
          )}
          {metric.xValue !== null && (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] text-gray-500">X: {metric.xValue}{metric.id === 'COR-16' || metric.id === 'COR-05' ? '' : '%'}</span>
              {metric.yValue !== null && <span className="text-[10px] text-gray-500">Y: {metric.yValue}%</span>}
              {metric.correlation !== null && <span className="text-[10px] text-gray-500">r: {metric.correlation}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPendingMetricRow = (metric: CorrelationMetric) => {
    return (
      <div key={metric.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-gray-50">
        <span className="text-[10px] font-bold text-gray-400 w-12">{metric.id}</span>
        <span className="text-[10px] text-gray-500 flex-1">{metric.name}</span>
        <span className="text-[9px] text-gray-400 italic">
          {metric.missingData.length > 0 ? metric.missingData[0] : 'Data pending'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* TIME RANGE SELECTOR */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-600 mr-2">Time Range:</span>
            {TIME_RANGES.map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Submarket:</span>
            <select
              value={submarketFilter}
              onChange={e => setSubmarketFilter(e.target.value)}
              className="rounded-lg border border-gray-300 text-sm px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              {SUBMARKETS.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All \u25BC' : s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1: RENT TRENDS BY VINTAGE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Rent Trends by Vintage</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{'\u2605'} ENHANCED</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Sources: M-01, M-02, R-02 + DC-11</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">4 outputs</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-56 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4">
            <span className="text-gray-400 text-sm font-medium mb-2">Multi-line Rent Trend Chart</span>
            <div className="flex flex-wrap justify-center gap-3 mb-2">
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-indigo-600 inline-block rounded" /> A+ Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> A Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> B+ Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> B Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" /> C Vintage</span>
              <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-violet-500 inline-block rounded border-dashed" /> DC-11 Forecast</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
              <span className="border-r border-gray-300 pr-4">{'\u2190'} NOW</span>
              <span>FORECAST {'\u2192'}</span>
            </div>
            <span className="text-gray-300 text-xs mt-2">DC-11 dotted forecast line extends 12 months forward</span>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
            <p className="text-sm text-teal-800">
              <span className="font-semibold">Insight:</span> B/C vintages outpacing A by 2x. DC-11 forecast shows B accelerating further due to supply constraint in value-add corridors.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: SUPPLY PIPELINE TIMELINE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.SUPPLY.color }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Supply Pipeline Timeline</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{'\u2605'} ENHANCED</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Sources: S-02, S-03, S-04, S-05, S-06 + DC-08</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">6 outputs</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setSupplyView('2yr')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                supplyView === '2yr' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              2-Year Pipeline
            </button>
            <button
              onClick={() => setSupplyView('10yr')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                supplyView === '10yr' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'
              }`}
            >
              10-Year Supply Wave {'\u2605'}
            </button>
          </div>

          {supplyView === '2yr' ? (
            <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm font-medium">Stacked Bar Chart {'\u2014'} Quarterly Pipeline</span>
              <span className="text-gray-300 text-xs mt-1">S-02 Under Construction + S-03 Permitted by Quarter</span>
              <div className="flex gap-3 mt-2">
                <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-3 h-3 bg-red-500 rounded inline-block" /> Under Construction</span>
                <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-3 h-3 bg-amber-400 rounded inline-block" /> Permitted</span>
              </div>
            </div>
          ) : (
            <div className="w-full bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600">10-Year Supply Wave Forecast (DC-08)</span>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 bg-red-500 rounded inline-block" /> Confirmed Pipeline</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 bg-orange-300 rounded inline-block" /> Capacity Conversion</span>
                </div>
              </div>
              <svg viewBox="0 0 450 160" className="w-full h-auto">
                {SUPPLY_WAVE_DATA.map((d, i) => {
                  const barWidth = 35;
                  const gap = 50;
                  const x = i * gap + 15;
                  const confirmedH = (d.confirmed / maxSupplyVal) * 120;
                  const capacityH = (d.capacity / maxSupplyVal) * 120;
                  return (
                    <g key={d.year}>
                      <rect x={x} y={140 - confirmedH - capacityH} width={barWidth} height={capacityH} rx={2} className="fill-orange-300" />
                      <rect x={x} y={140 - confirmedH} width={barWidth} height={confirmedH} rx={2} className="fill-red-500" />
                      <text x={x + barWidth / 2} y={155} textAnchor="middle" className="fill-gray-500 text-[10px]">{d.year}</text>
                      {d.confirmed > 0 && (
                        <text x={x + barWidth / 2} y={140 - confirmedH - capacityH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">
                          {((d.confirmed + d.capacity) / 1000).toFixed(1)}k
                        </text>
                      )}
                    </g>
                  );
                })}
                <line x1="0" y1="140" x2="450" y2="140" className="stroke-gray-300" strokeWidth={1} />
              </svg>
            </div>
          )}

          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Insight:</span> Peak year: 2026 (8,200u). Pipeline exhaustion: 2029. Capacity conversion tapers to ~800u/yr by 2032.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: DEMAND SIGNAL TRENDS */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.DEMAND.color }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Demand Signal Trends</h3>
                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{'\u2605'} ENHANCED</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Sources: D-05, D-06, D-07, D-08, D-09 + T-02, T-03, T-07</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">8 outputs</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4">
            <span className="text-gray-400 text-sm font-medium mb-2">Dual-Axis Demand Chart</span>
            <div className="grid grid-cols-2 gap-6 text-xs text-gray-400">
              <div className="text-center">
                <p className="font-medium text-gray-500 mb-1">Left Axis (Physical)</p>
                <p>D-05 Traffic Growth</p>
                <p>T-02 avg Physical Score</p>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-500 mb-1">Right Axis (Digital)</p>
                <p>D-08 Search Interest</p>
                <p>T-03 avg Digital Score</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <span className="font-semibold">Insight:</span> Digital leads physical by 8-12 weeks. T-03 uptick in Decatur Q4 2025 {'\u2192'} T-02 uptick Q1 2026.
            </p>
          </div>
        </div>
      </div>

      {/* SECTIONS 4 & 5: TRANSACTION & CONCESSION (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* SECTION 4: TRANSACTION & CAP RATES (60%) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Transaction & Cap Rates</h3>
              <p className="text-sm text-gray-500 mt-0.5">Sources: M-08, M-09, P-07</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1">Scatter Plot</span>
              <span className="text-gray-300 text-xs">X = Time {'\u00B7'} Y = $/unit {'\u00B7'} Size = unit count {'\u00B7'} Color = cap rate</span>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">Cap rates:</span> 5.1% {'\u2192'} 5.5% expanding
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 5: CONCESSION & OCCUPANCY (40%) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.MOMENTUM.color }}>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Concession & Occupancy</h3>
              <p className="text-sm text-gray-500 mt-0.5">Sources: M-03, M-04, M-06, R-03</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1">Area Chart</span>
              <span className="text-gray-300 text-xs">Concession as % GPR over time</span>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 space-y-1">
              <p className="text-sm text-orange-800">
                <span className="font-semibold">Concession as % GPR:</span> 4.8% {'\u2192'} 3.2% (declining)
              </p>
              <p className="text-sm text-orange-700">Availability declining</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: JEDI SCORE HISTORY */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4" style={{ borderLeftColor: SIGNAL_GROUPS.COMPOSITE.color }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">JEDI Score History</h3>
              <p className="text-sm text-gray-500 mt-0.5">Source: C-01 time series</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">1 output</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-4">
            <span className="text-gray-400 text-sm font-medium mb-2">Line Chart with Signal Decomposition</span>
            <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-600 inline-block rounded" /> JEDI Composite</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Demand Component</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Supply Component</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Momentum Component</span>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 space-y-1">
            <p className="text-sm text-teal-800">
              <span className="font-semibold">Score trajectory:</span> 58 {'\u2192'} 72 {'\u2192'} 81 {'\u2192'} 87 over 24 months
            </p>
            <p className="text-sm text-teal-700">
              <span className="font-semibold">Primary driver:</span> Demand acceleration (D-09: 55 {'\u2192'} 82)
            </p>
            <p className="text-sm text-teal-700">
              <span className="font-semibold">Drag factor:</span> Supply risk (S-composite: stable at 64)
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 7: RENT–TRAFFIC–WAGE CORRELATION (Pearson Chart) */}
      {(() => {
        const rents = CORRELATION_QUARTERS.map(q => q.rentGrowth);
        const traffic = CORRELATION_QUARTERS.map(q => q.trafficTrend);
        const wages = CORRELATION_QUARTERS.map(q => q.wageGrowth);
        const rRentTraffic = computeCorrelation(rents, traffic);
        const rRentWage = computeCorrelation(rents, wages);
        const maxVal = Math.max(...rents, ...traffic, ...wages);
        const chartW = 480;
        const chartH = 180;
        const padL = 40;
        const padR = 20;
        const padT = 10;
        const padB = 30;
        const plotW = chartW - padL - padR;
        const plotH = chartH - padT - padB;
        const step = plotW / (CORRELATION_QUARTERS.length - 1);

        const makePath = (values: number[], color: string) => {
          const pts = values.map((v, i) => {
            const x = padL + i * step;
            const y = padT + plotH - (v / maxVal) * plotH;
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
          }).join(' ');
          return <path d={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
        };

        return (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 border-l-4 border-l-indigo-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">Rent{'\u2013'}Traffic{'\u2013'}Wage Correlation</h3>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">CI ENGINE</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">8-quarter overlay with Pearson r-values</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    r(Rent,Traffic) = <span className="font-bold text-indigo-600">{rRentTraffic.toFixed(2)}</span>
                  </span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    r(Rent,Wage) = <span className="font-bold text-red-500">{rRentWage.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
                {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                  const y = padT + plotH * (1 - frac);
                  return (
                    <g key={frac}>
                      <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                      <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]">{(maxVal * frac).toFixed(1)}%</text>
                    </g>
                  );
                })}
                {CORRELATION_QUARTERS.map((q, i) => (
                  <text key={q.quarter} x={padL + i * step} y={chartH - 4} textAnchor="middle" className="fill-gray-500 text-[9px]">{q.quarter}</text>
                ))}
                {makePath(wages, '#10b981')}
                {makePath(traffic, '#6366f1')}
                {makePath(rents, '#ef4444')}
                {rents.map((v, i) => (
                  <circle key={`r${i}`} cx={padL + i * step} cy={padT + plotH - (v / maxVal) * plotH} r={3} className="fill-red-500" />
                ))}
                {traffic.map((v, i) => (
                  <circle key={`t${i}`} cx={padL + i * step} cy={padT + plotH - (v / maxVal) * plotH} r={3} className="fill-indigo-500" />
                ))}
                {wages.map((v, i) => (
                  <circle key={`w${i}`} cx={padL + i * step} cy={padT + plotH - (v / maxVal) * plotH} r={3} className="fill-emerald-500" />
                ))}
              </svg>
              <div className="flex flex-wrap justify-center gap-4">
                <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-0.5 bg-red-500 inline-block rounded" /> Rent Growth (%)</span>
                <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" /> Traffic Trend (%)</span>
                <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Wage Growth (%)</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <p className="text-sm text-indigo-800">
                  <span className="font-semibold">Insight:</span> Rent and traffic are highly correlated (r={rRentTraffic.toFixed(2)}), while wages have diverged significantly (r={rRentWage.toFixed(2)}), indicating affordability pressure.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DIVERGENCE ALERT BANNER */}
      {checkDivergence() && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h18.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.74 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">Rent{'\u2013'}Wage Divergence Alert</h4>
            <p className="text-sm text-amber-800 mt-0.5">
              Rent growth has outpaced wage growth by &gt;1.5{'\u00D7'} for 3+ consecutive quarters. This divergence signals affordability stress and may lead to increased vacancy, concession pressure, or regulatory intervention.
            </p>
            <div className="flex gap-4 mt-2">
              {CORRELATION_QUARTERS.slice(-4).map(q => (
                <span key={q.quarter} className="text-xs text-amber-700">
                  <span className="font-semibold">{q.quarter}:</span> Rent {q.rentGrowth}% vs Wage {q.wageGrowth}% ({(q.rentGrowth / q.wageGrowth).toFixed(1)}{'\u00D7'})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: CORRELATION INTELLIGENCE (LIVE FROM API) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Correlation Intelligence</h3>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">CI ENGINE</span>
                {correlationLoading && (
                  <span className="text-[10px] text-indigo-400 animate-pulse">Loading live data...</span>
                )}
                {!correlationLoading && !correlationError && correlationReport && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">
                    LIVE DATA
                  </span>
                )}
                {correlationError && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                    SAMPLE DATA
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                COR-01 through COR-20 {'\u2014'} 20 cross-module market correlation metrics
                {correlationReport && (
                  <span className="ml-2 text-indigo-500 font-medium">
                    {correlationReport.metricsComputed}/{correlationReport.correlations.length} computed from live data
                  </span>
                )}
              </p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">20 metrics</span>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {correlationReport && !correlationError ? (
            <>
              <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 rounded-lg">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">MARKET SIGNALS:</span>
                <span className="text-[11px] text-green-600 font-bold">{correlationReport.summary.bullishSignals} bullish</span>
                <span className="text-[11px] text-red-600 font-bold">{correlationReport.summary.bearishSignals} bearish</span>
                <span className="text-[11px] text-gray-500 font-bold">{correlationReport.summary.neutralSignals} neutral</span>
                <span className="text-[11px] text-gray-400">{correlationReport.summary.insufficientData} pending data</span>
                {correlationReport.summary.topOpportunity && (
                  <span className="text-[11px] text-emerald-600 font-semibold">{'\u2605'} {correlationReport.summary.topOpportunity}</span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* BULLISH COLUMN */}
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-green-200">
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded uppercase tracking-wider">{'\u25B2'} Bullish</span>
                    <span className="text-[10px] text-green-600 font-bold">{computedMetrics.filter(m => m.signal === 'bullish').length}</span>
                  </div>
                  <div className="space-y-2">
                    {computedMetrics.filter(m => m.signal === 'bullish').map(m => renderCorrelationMetricRow(m))}
                    {computedMetrics.filter(m => m.signal === 'bullish').length === 0 && (
                      <p className="text-[11px] text-gray-400 italic py-3 text-center">No bullish signals</p>
                    )}
                  </div>
                </div>

                {/* NEUTRAL COLUMN */}
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">{'\u25AC'} Neutral</span>
                    <span className="text-[10px] text-gray-500 font-bold">{computedMetrics.filter(m => m.signal === 'neutral').length}</span>
                  </div>
                  <div className="space-y-2">
                    {computedMetrics.filter(m => m.signal === 'neutral').map(m => renderCorrelationMetricRow(m))}
                    {computedMetrics.filter(m => m.signal === 'neutral').length === 0 && (
                      <p className="text-[11px] text-gray-400 italic py-3 text-center">No neutral signals</p>
                    )}
                  </div>
                </div>

                {/* BEARISH COLUMN */}
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
                    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded uppercase tracking-wider">{'\u25BC'} Bearish</span>
                    <span className="text-[10px] text-red-600 font-bold">{computedMetrics.filter(m => m.signal === 'bearish').length}</span>
                  </div>
                  <div className="space-y-2">
                    {computedMetrics.filter(m => m.signal === 'bearish').map(m => renderCorrelationMetricRow(m))}
                    {computedMetrics.filter(m => m.signal === 'bearish').length === 0 && (
                      <p className="text-[11px] text-gray-400 italic py-3 text-center">No bearish signals</p>
                    )}
                  </div>
                </div>
              </div>

              {pendingMetrics.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowPendingMetrics(!showPendingMetrics)}
                    className="text-[11px] font-medium text-gray-400 hover:text-gray-600 underline"
                  >
                    {showPendingMetrics ? 'Hide' : 'Show'} {pendingMetrics.length} pending metrics (awaiting data sources)
                  </button>
                  {showPendingMetrics && (
                    <div className="mt-2 space-y-1 border border-gray-100 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">AWAITING DATA SOURCES:</p>
                      {pendingMetrics.map(m => renderPendingMetricRow(m))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : correlationError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">
                <span className="font-semibold">Correlation data unavailable:</span> {correlationError}. Showing static Pearson analysis above.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-gray-400 animate-pulse">Loading correlation metrics...</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 9: AFFORDABILITY CEILING GAUGE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Affordability Ceiling Gauge</h3>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">CI ENGINE</span>
                {liveAffordabilityRatio !== null && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Rent as % of median household income {'\u2014'} {AFFORDABILITY_DATA.thresholdPercent}% threshold</p>
            </div>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
              AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {AFFORDABILITY_DATA.currentPercent}%
            </span>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Median HH Income</p>
              <p className="text-lg font-bold text-gray-900">${AFFORDABILITY_DATA.medianHouseholdIncome.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Median Monthly Rent</p>
              <p className="text-lg font-bold text-gray-900">${AFFORDABILITY_DATA.medianMonthlyRent.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Rent-to-Income Ratio</p>
              <p className={`text-lg font-bold ${AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'text-red-600' : 'text-green-600'}`}>
                {AFFORDABILITY_DATA.currentPercent}%
              </p>
            </div>
          </div>

          {(() => {
            const gaugeW = 480;
            const gaugeH = 80;
            const barY = 25;
            const barH = 24;
            const minP = 20;
            const maxP = 40;
            const range = maxP - minP;
            const toX = (pct: number) => ((pct - minP) / range) * (gaugeW - 60) + 30;
            const threshX = toX(AFFORDABILITY_DATA.thresholdPercent);
            const currX = toX(AFFORDABILITY_DATA.currentPercent);

            return (
              <svg viewBox={`0 0 ${gaugeW} ${gaugeH}`} className="w-full h-auto">
                <rect x={30} y={barY} width={gaugeW - 60} height={barH} rx={4} className="fill-gray-100" />
                <rect x={30} y={barY} width={Math.max(0, currX - 30)} height={barH} rx={4}
                  className={AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'fill-red-400' : 'fill-emerald-400'} />
                <line x1={threshX} y1={barY - 6} x2={threshX} y2={barY + barH + 6} stroke="#dc2626" strokeWidth={2.5} strokeDasharray="4,3" />
                <text x={threshX} y={barY - 10} textAnchor="middle" className="fill-red-600 text-[10px] font-semibold">{AFFORDABILITY_DATA.thresholdPercent}% Threshold</text>
                <circle cx={currX} cy={barY + barH / 2} r={6} className={AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'fill-red-600' : 'fill-emerald-600'} />
                <text x={currX} y={barY + barH + 18} textAnchor="middle" className="fill-gray-700 text-[10px] font-bold">{AFFORDABILITY_DATA.currentPercent}%</text>
                {[20, 25, 30, 35, 40].map(tick => (
                  <text key={tick} x={toX(tick)} y={barY + barH + 18} textAnchor="middle" className="fill-gray-400 text-[8px]">{tick}%</text>
                ))}
              </svg>
            );
          })()}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">8-Quarter Trend:</span>
            <div className="flex items-center gap-1">
              {AFFORDABILITY_DATA.historicalPercents.map((pct, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-5 rounded text-[9px] font-medium flex items-center justify-center ${
                      pct > AFFORDABILITY_DATA.thresholdPercent ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {pct}
                  </div>
                  <span className="text-[8px] text-gray-400 mt-0.5">{CORRELATION_QUARTERS[i]?.quarter.replace(' ', '\n') || ''}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-lg p-3 ${
            AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent
              ? 'bg-red-50 border border-red-100'
              : 'bg-green-50 border border-green-100'
          }`}>
            <p className={`text-sm ${AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'text-red-800' : 'text-green-800'}`}>
              <span className="font-semibold">
                {AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'Warning:' : 'Status:'}
              </span>
              {' '}Rent-to-income ratio has {AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent ? 'exceeded' : 'not yet reached'} the {AFFORDABILITY_DATA.thresholdPercent}% affordability threshold.
              {AFFORDABILITY_DATA.currentPercent > AFFORDABILITY_DATA.thresholdPercent && ' Markets above this level historically see increased turnover and concession pressure within 2-3 quarters.'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 10: RENT RUNWAY INDICATOR */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">Rent Runway Indicator</h3>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">CI ENGINE</span>
                {liveRentRunway && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">When wages outpace rents, the gap represents runway for rent increases (COR-04)</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {(() => {
            const wageGrowth = cor04?.xValue ?? 4.2;
            const rentGrowth = cor04?.yValue ?? 1.8;
            const hasRunway = wageGrowth > rentGrowth;
            const gapPct = Math.abs(wageGrowth - rentGrowth).toFixed(1);
            const ratio = (wageGrowth / rentGrowth).toFixed(1);

            const barW = 480;
            const barH = 60;
            const maxGrowth = Math.max(wageGrowth, rentGrowth) * 1.3;
            const toBarWidth = (val: number) => (val / maxGrowth) * (barW - 80);

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-lg p-3 text-center ${hasRunway ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                    <p className="text-xs text-gray-500">Wage Growth</p>
                    <p className="text-2xl font-bold text-emerald-600">{wageGrowth}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                    <p className="text-xs text-gray-500">Rent Growth</p>
                    <p className="text-2xl font-bold text-gray-700">{rentGrowth}%</p>
                  </div>
                </div>

                <svg viewBox={`0 0 ${barW} ${barH}`} className="w-full h-auto">
                  <rect x={40} y={8} width={toBarWidth(wageGrowth)} height={18} rx={4} className="fill-emerald-400" />
                  <text x={36} y={21} textAnchor="end" className="fill-gray-500 text-[10px] font-medium">Wages</text>
                  <text x={44 + toBarWidth(wageGrowth)} y={21} className="fill-emerald-700 text-[10px] font-bold">{wageGrowth}%</text>
                  <rect x={40} y={34} width={toBarWidth(rentGrowth)} height={18} rx={4} className="fill-gray-400" />
                  <text x={36} y={47} textAnchor="end" className="fill-gray-500 text-[10px] font-medium">Rents</text>
                  <text x={44 + toBarWidth(rentGrowth)} y={47} className="fill-gray-700 text-[10px] font-bold">{rentGrowth}%</text>
                  {hasRunway && (
                    <>
                      <rect x={40 + toBarWidth(rentGrowth)} y={34} width={toBarWidth(wageGrowth) - toBarWidth(rentGrowth)} height={18} rx={0} className="fill-emerald-200" strokeDasharray="4,3" />
                      <text x={40 + toBarWidth(rentGrowth) + (toBarWidth(wageGrowth) - toBarWidth(rentGrowth)) / 2} y={47} textAnchor="middle" className="fill-emerald-700 text-[9px] font-bold">RUNWAY</text>
                    </>
                  )}
                </svg>

                <div className={`rounded-lg p-3 ${hasRunway ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <p className={`text-sm ${hasRunway ? 'text-emerald-800' : 'text-red-800'}`}>
                    <span className="font-semibold">{hasRunway ? 'Runway Available:' : 'No Runway:'}</span>
                    {hasRunway
                      ? ` Wages are growing ${ratio}\u00D7 faster than rents, creating a ${gapPct}% gap. This suggests room for rent increases before hitting affordability pressure.`
                      : ` Rents are growing faster than wages. Affordability ceiling may limit further increases.`
                    }
                    {liveRentRunway && (
                      <span className="block mt-1 text-[11px] text-emerald-600 font-medium">{liveRentRunway}</span>
                    )}
                  </p>
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
