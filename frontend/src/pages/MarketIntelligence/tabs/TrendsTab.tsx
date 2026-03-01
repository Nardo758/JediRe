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

const RENT_VINTAGE_DATA = [
  { quarter: 'Q1 24', aPlus: 2450, a: 2180, bPlus: 1680, b: 1420, c: 1080 },
  { quarter: 'Q2 24', aPlus: 2480, a: 2210, bPlus: 1720, b: 1460, c: 1110 },
  { quarter: 'Q3 24', aPlus: 2510, a: 2250, bPlus: 1780, b: 1520, c: 1160 },
  { quarter: 'Q4 24', aPlus: 2530, a: 2270, bPlus: 1830, b: 1570, c: 1200 },
  { quarter: 'Q1 25', aPlus: 2560, a: 2300, bPlus: 1890, b: 1630, c: 1250 },
  { quarter: 'Q2 25', aPlus: 2580, a: 2320, bPlus: 1940, b: 1680, c: 1300 },
  { quarter: 'Q3 25', aPlus: 2610, a: 2350, bPlus: 2000, b: 1740, c: 1350 },
  { quarter: 'Q4 25', aPlus: 2640, a: 2380, bPlus: 2060, b: 1800, c: 1400 },
];
const RENT_FORECAST = [
  { quarter: 'Q1 26', aPlus: 2680, a: 2410, bPlus: 2130, b: 1870, c: 1460 },
  { quarter: 'Q2 26', aPlus: 2720, a: 2440, bPlus: 2200, b: 1940, c: 1520 },
];

const SUPPLY_QUARTERLY = [
  { quarter: 'Q1 25', underConstruction: 3200, permitted: 1400 },
  { quarter: 'Q2 25', underConstruction: 2800, permitted: 1800 },
  { quarter: 'Q3 25', underConstruction: 2400, permitted: 2100 },
  { quarter: 'Q4 25', underConstruction: 2100, permitted: 1600 },
  { quarter: 'Q1 26', underConstruction: 1800, permitted: 1200 },
  { quarter: 'Q2 26', underConstruction: 1500, permitted: 900 },
];

const DEMAND_SIGNAL_DATA = [
  { quarter: 'Q1 24', trafficGrowth: 2.1, searchInterest: 58, t02Avg: 62, t03Avg: 55 },
  { quarter: 'Q2 24', trafficGrowth: 3.4, searchInterest: 64, t02Avg: 65, t03Avg: 61 },
  { quarter: 'Q3 24', trafficGrowth: 4.2, searchInterest: 71, t02Avg: 68, t03Avg: 69 },
  { quarter: 'Q4 24', trafficGrowth: 5.1, searchInterest: 78, t02Avg: 72, t03Avg: 76 },
  { quarter: 'Q1 25', trafficGrowth: 5.8, searchInterest: 82, t02Avg: 75, t03Avg: 80 },
  { quarter: 'Q2 25', trafficGrowth: 6.5, searchInterest: 88, t02Avg: 79, t03Avg: 85 },
  { quarter: 'Q3 25', trafficGrowth: 7.2, searchInterest: 92, t02Avg: 82, t03Avg: 89 },
  { quarter: 'Q4 25', trafficGrowth: 7.8, searchInterest: 96, t02Avg: 85, t03Avg: 94 },
];

const TRANSACTION_DATA = [
  { date: 'Mar 24', pricePerUnit: 142000, units: 180, capRate: 5.1 },
  { date: 'Jun 24', pricePerUnit: 148000, units: 240, capRate: 5.2 },
  { date: 'Sep 24', pricePerUnit: 135000, units: 120, capRate: 5.4 },
  { date: 'Dec 24', pricePerUnit: 155000, units: 300, capRate: 5.0 },
  { date: 'Mar 25', pricePerUnit: 138000, units: 160, capRate: 5.5 },
  { date: 'Jun 25', pricePerUnit: 160000, units: 280, capRate: 4.9 },
  { date: 'Sep 25', pricePerUnit: 145000, units: 200, capRate: 5.3 },
  { date: 'Dec 25', pricePerUnit: 152000, units: 220, capRate: 5.2 },
];

const CONCESSION_DATA = [
  { quarter: 'Q1 24', concessionPct: 6.2, occupancy: 91.4 },
  { quarter: 'Q2 24', concessionPct: 5.8, occupancy: 91.8 },
  { quarter: 'Q3 24', concessionPct: 5.4, occupancy: 92.1 },
  { quarter: 'Q4 24', concessionPct: 5.0, occupancy: 92.5 },
  { quarter: 'Q1 25', concessionPct: 4.6, occupancy: 92.8 },
  { quarter: 'Q2 25', concessionPct: 4.2, occupancy: 93.0 },
  { quarter: 'Q3 25', concessionPct: 3.8, occupancy: 93.2 },
  { quarter: 'Q4 25', concessionPct: 3.2, occupancy: 93.5 },
];

const JEDI_SCORE_HISTORY = [
  { quarter: 'Q1 24', composite: 58, demand: 52, supply: 62, momentum: 55 },
  { quarter: 'Q2 24', composite: 63, demand: 58, supply: 63, momentum: 60 },
  { quarter: 'Q3 24', composite: 68, demand: 65, supply: 64, momentum: 66 },
  { quarter: 'Q4 24', composite: 72, demand: 70, supply: 64, momentum: 72 },
  { quarter: 'Q1 25', composite: 76, demand: 74, supply: 65, momentum: 76 },
  { quarter: 'Q2 25', composite: 81, demand: 78, supply: 64, momentum: 80 },
  { quarter: 'Q3 25', composite: 85, demand: 82, supply: 64, momentum: 84 },
  { quarter: 'Q4 25', composite: 87, demand: 85, supply: 64, momentum: 88 },
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
          {(() => {
            const allData = [...RENT_VINTAGE_DATA, ...RENT_FORECAST];
            const cW = 520, cH = 220, pL = 55, pR = 15, pT = 15, pB = 30;
            const plotW = cW - pL - pR, plotH = cH - pT - pB;
            const allVals = allData.flatMap(d => [d.aPlus, d.a, d.bPlus, d.b, d.c]);
            const minV = Math.min(...allVals) - 100, maxV = Math.max(...allVals) + 100;
            const step = plotW / (allData.length - 1);
            const toY = (v: number) => pT + plotH - ((v - minV) / (maxV - minV)) * plotH;
            const lines: { key: string; field: keyof typeof allData[0]; color: string; label: string }[] = [
              { key: 'aPlus', field: 'aPlus', color: '#4f46e5', label: 'A+ Vintage' },
              { key: 'a', field: 'a', color: '#3b82f6', label: 'A Vintage' },
              { key: 'bPlus', field: 'bPlus', color: '#10b981', label: 'B+ Vintage' },
              { key: 'b', field: 'b', color: '#f59e0b', label: 'B Vintage' },
              { key: 'c', field: 'c', color: '#f87171', label: 'C Vintage' },
            ];
            const histLen = RENT_VINTAGE_DATA.length;
            return (
              <>
                <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    const val = minV + (maxV - minV) * frac;
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]">${Math.round(val).toLocaleString()}</text>
                      </g>
                    );
                  })}
                  {allData.map((d, i) => (
                    <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">{d.quarter}</text>
                  ))}
                  <line x1={pL + (histLen - 1) * step} y1={pT} x2={pL + (histLen - 1) * step} y2={pT + plotH} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4,3" />
                  <text x={pL + (histLen - 1) * step + 4} y={pT + 10} className="fill-violet-500 text-[8px]">Forecast</text>
                  {lines.map(line => {
                    const histPts = RENT_VINTAGE_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toY(d[line.field] as number)}`).join(' ');
                    const fcPts = RENT_FORECAST.map((d, i) => `L${pL + (histLen + i) * step},${toY(d[line.field] as number)}`).join(' ');
                    const lastHist = RENT_VINTAGE_DATA[histLen - 1];
                    return (
                      <g key={line.key}>
                        <path d={histPts} fill="none" stroke={line.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <path d={`M${pL + (histLen - 1) * step},${toY(lastHist[line.field] as number)} ${fcPts}`} fill="none" stroke={line.color} strokeWidth={2} strokeDasharray="6,4" strokeLinecap="round" />
                      </g>
                    );
                  })}
                  {lines.map(line => {
                    const lastVal = allData[allData.length - 1][line.field] as number;
                    return <circle key={`dot-${line.key}`} cx={pL + (allData.length - 1) * step} cy={toY(lastVal)} r={3} fill={line.color} />;
                  })}
                </svg>
                <div className="flex flex-wrap justify-center gap-3">
                  {lines.map(line => (
                    <span key={line.key} className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: line.color }} /> {line.label}</span>
                  ))}
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-violet-500 inline-block rounded border-dashed" /> DC-11 Forecast</span>
                </div>
              </>
            );
          })()}
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
            <div className="w-full bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600">Quarterly Pipeline (S-02 + S-03)</span>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 bg-red-500 rounded inline-block" /> Under Construction</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 bg-amber-400 rounded inline-block" /> Permitted</span>
                </div>
              </div>
              {(() => {
                const maxQ = Math.max(...SUPPLY_QUARTERLY.map(d => d.underConstruction + d.permitted));
                const barW = 50, gap = 70;
                return (
                  <svg viewBox={`0 0 ${SUPPLY_QUARTERLY.length * gap + 20} 160`} className="w-full h-auto">
                    {SUPPLY_QUARTERLY.map((d, i) => {
                      const x = i * gap + 20;
                      const ucH = (d.underConstruction / maxQ) * 110;
                      const prmH = (d.permitted / maxQ) * 110;
                      return (
                        <g key={d.quarter}>
                          <rect x={x} y={130 - ucH - prmH} width={barW} height={prmH} rx={2} className="fill-amber-400" />
                          <rect x={x} y={130 - ucH} width={barW} height={ucH} rx={2} className="fill-red-500" />
                          <text x={x + barW / 2} y={148} textAnchor="middle" className="fill-gray-500 text-[9px]">{d.quarter}</text>
                          <text x={x + barW / 2} y={130 - ucH - prmH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">{((d.underConstruction + d.permitted) / 1000).toFixed(1)}k</text>
                        </g>
                      );
                    })}
                    <line x1="15" y1="130" x2={SUPPLY_QUARTERLY.length * gap + 10} y2="130" className="stroke-gray-300" strokeWidth={1} />
                  </svg>
                );
              })()}
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
          {(() => {
            const cW = 520, cH = 200, pL = 45, pR = 45, pT = 15, pB = 30;
            const plotW = cW - pL - pR, plotH = cH - pT - pB;
            const step = plotW / (DEMAND_SIGNAL_DATA.length - 1);
            const maxLeft = 10;
            const maxRight = 100;
            const toYL = (v: number) => pT + plotH - (v / maxLeft) * plotH;
            const toYR = (v: number) => pT + plotH - (v / maxRight) * plotH;
            const makeLine = (vals: number[], toY: (v: number) => number, color: string, dashed = false) => {
              const pts = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toY(v)}`).join(' ');
              return <path d={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '6,4' : undefined} />;
            };
            return (
              <>
                <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" className="fill-green-500 text-[9px]">{(maxLeft * frac).toFixed(1)}%</text>
                        <text x={cW - pR + 4} y={y + 3} textAnchor="start" className="fill-blue-500 text-[9px]">{Math.round(maxRight * frac)}</text>
                      </g>
                    );
                  })}
                  {DEMAND_SIGNAL_DATA.map((d, i) => (
                    <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">{d.quarter}</text>
                  ))}
                  {makeLine(DEMAND_SIGNAL_DATA.map(d => d.trafficGrowth), toYL, '#10b981')}
                  {makeLine(DEMAND_SIGNAL_DATA.map(d => d.t02Avg), toYR, '#059669', true)}
                  {makeLine(DEMAND_SIGNAL_DATA.map(d => d.searchInterest), toYR, '#3b82f6')}
                  {makeLine(DEMAND_SIGNAL_DATA.map(d => d.t03Avg), toYR, '#6366f1', true)}
                  {DEMAND_SIGNAL_DATA.map((d, i) => (
                    <g key={`dots-${i}`}>
                      <circle cx={pL + i * step} cy={toYL(d.trafficGrowth)} r={2.5} className="fill-emerald-500" />
                      <circle cx={pL + i * step} cy={toYR(d.searchInterest)} r={2.5} className="fill-blue-500" />
                    </g>
                  ))}
                  <text x={pL - 4} y={pT - 4} textAnchor="end" className="fill-green-500 text-[8px]">Physical</text>
                  <text x={cW - pR + 4} y={pT - 4} textAnchor="start" className="fill-blue-500 text-[8px]">Digital</text>
                </svg>
                <div className="flex flex-wrap justify-center gap-4">
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> D-05 Traffic Growth</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-emerald-600 inline-block rounded border-dashed" /> T-02 Physical Score</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> D-08 Search Interest</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded border-dashed" /> T-03 Digital Score</span>
                </div>
              </>
            );
          })()}
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
            {(() => {
              const cW = 380, cH = 200, pL = 55, pR = 15, pT = 15, pB = 30;
              const plotW = cW - pL - pR, plotH = cH - pT - pB;
              const prices = TRANSACTION_DATA.map(d => d.pricePerUnit);
              const minP = Math.min(...prices) - 5000, maxP = Math.max(...prices) + 5000;
              const step = plotW / (TRANSACTION_DATA.length - 1);
              const toY = (v: number) => pT + plotH - ((v - minP) / (maxP - minP)) * plotH;
              const capToColor = (cap: number) => cap < 5.1 ? '#10b981' : cap > 5.3 ? '#ef4444' : '#f59e0b';
              return (
                <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    const val = minP + (maxP - minP) * frac;
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" className="fill-gray-400 text-[8px]">${(val / 1000).toFixed(0)}k</text>
                      </g>
                    );
                  })}
                  {TRANSACTION_DATA.map((d, i) => (
                    <g key={d.date}>
                      <text x={pL + i * step} y={cH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">{d.date}</text>
                      <circle cx={pL + i * step} cy={toY(d.pricePerUnit)} r={Math.max(4, d.units / 40)} fill={capToColor(d.capRate)} fillOpacity={0.7} stroke={capToColor(d.capRate)} strokeWidth={1.5} />
                      <text x={pL + i * step} y={toY(d.pricePerUnit) - Math.max(4, d.units / 40) - 4} textAnchor="middle" className="fill-gray-500 text-[7px]">{d.capRate}%</text>
                    </g>
                  ))}
                </svg>
              );
            })()}
            <div className="flex justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Cap &lt; 5.1%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Cap 5.1-5.3%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Cap &gt; 5.3%</span>
              <span className="text-[10px] text-gray-400">Bubble size = unit count</span>
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
            {(() => {
              const cW = 300, cH = 180, pL = 35, pR = 35, pT = 15, pB = 30;
              const plotW = cW - pL - pR, plotH = cH - pT - pB;
              const step = plotW / (CONCESSION_DATA.length - 1);
              const maxC = 8;
              const minO = 90, maxO = 95;
              const toYC = (v: number) => pT + plotH - (v / maxC) * plotH;
              const toYO = (v: number) => pT + plotH - ((v - minO) / (maxO - minO)) * plotH;
              const areaPath = CONCESSION_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toYC(d.concessionPct)}`).join(' ')
                + ` L${pL + (CONCESSION_DATA.length - 1) * step},${pT + plotH} L${pL},${pT + plotH} Z`;
              const occLine = CONCESSION_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toYO(d.occupancy)}`).join(' ');
              return (
                <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" className="fill-orange-400 text-[8px]">{(maxC * frac).toFixed(1)}%</text>
                        <text x={cW - pR + 4} y={y + 3} textAnchor="start" className="fill-teal-500 text-[8px]">{(minO + (maxO - minO) * frac).toFixed(1)}</text>
                      </g>
                    );
                  })}
                  {CONCESSION_DATA.map((d, i) => (
                    <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" className="fill-gray-500 text-[7px]">{d.quarter}</text>
                  ))}
                  <path d={areaPath} fill="#fdba74" fillOpacity={0.3} stroke="none" />
                  <path d={CONCESSION_DATA.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toYC(d.concessionPct)}`).join(' ')} fill="none" stroke="#f97316" strokeWidth={2} strokeLinecap="round" />
                  <path d={occLine} fill="none" stroke="#14b8a6" strokeWidth={2} strokeLinecap="round" strokeDasharray="6,4" />
                  {CONCESSION_DATA.map((d, i) => (
                    <g key={`dots-${i}`}>
                      <circle cx={pL + i * step} cy={toYC(d.concessionPct)} r={2.5} className="fill-orange-500" />
                      <circle cx={pL + i * step} cy={toYO(d.occupancy)} r={2.5} className="fill-teal-500" />
                    </g>
                  ))}
                </svg>
              );
            })()}
            <div className="flex justify-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Concession % GPR</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-500 inline-block rounded" /> Occupancy %</span>
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
          {(() => {
            const cW = 520, cH = 200, pL = 35, pR = 15, pT = 15, pB = 30;
            const plotW = cW - pL - pR, plotH = cH - pT - pB;
            const step = plotW / (JEDI_SCORE_HISTORY.length - 1);
            const minS = 40, maxS = 100;
            const toY = (v: number) => pT + plotH - ((v - minS) / (maxS - minS)) * plotH;
            const scoreSeries: { key: string; field: keyof typeof JEDI_SCORE_HISTORY[0]; color: string; label: string; width: number }[] = [
              { key: 'composite', field: 'composite', color: '#0d9488', label: 'JEDI Composite', width: 3 },
              { key: 'demand', field: 'demand', color: '#22c55e', label: 'Demand', width: 1.5 },
              { key: 'supply', field: 'supply', color: '#ef4444', label: 'Supply', width: 1.5 },
              { key: 'momentum', field: 'momentum', color: '#f97316', label: 'Momentum', width: 1.5 },
            ];
            return (
              <>
                <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = pT + plotH * (1 - frac);
                    const val = minS + (maxS - minS) * frac;
                    return (
                      <g key={frac}>
                        <line x1={pL} y1={y} x2={cW - pR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        <text x={pL - 4} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]">{Math.round(val)}</text>
                      </g>
                    );
                  })}
                  {JEDI_SCORE_HISTORY.map((d, i) => (
                    <text key={d.quarter} x={pL + i * step} y={cH - 4} textAnchor="middle" className="fill-gray-500 text-[8px]">{d.quarter}</text>
                  ))}
                  {scoreSeries.map(s => {
                    const pts = JEDI_SCORE_HISTORY.map((d, i) => `${i === 0 ? 'M' : 'L'}${pL + i * step},${toY(d[s.field] as number)}`).join(' ');
                    return <path key={s.key} d={pts} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />;
                  })}
                  {scoreSeries.map(s =>
                    JEDI_SCORE_HISTORY.map((d, i) => (
                      <circle key={`${s.key}-${i}`} cx={pL + i * step} cy={toY(d[s.field] as number)} r={s.key === 'composite' ? 3 : 2} fill={s.color} />
                    ))
                  )}
                </svg>
                <div className="flex flex-wrap justify-center gap-3">
                  {scoreSeries.map(s => (
                    <span key={s.key} className="flex items-center gap-1 text-xs"><span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: s.color }} /> {s.label}</span>
                  ))}
                </div>
              </>
            );
          })()}
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
