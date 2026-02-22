import React, { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Calendar, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface TrendsAnalysisSectionProps {
  deal?: any;
  onUpdate?: () => void;
  onBack?: () => void;
}

const TREND_CATEGORIES = ['Rent Growth', 'Occupancy', 'Supply', 'Demand', 'Cap Rates', 'Construction Costs'] as const;

const mockTrends = [
  { category: 'Rent Growth', current: 3.8, previous: 4.2, forecast: 3.5, direction: 'down' as const, signal: 'yellow' as const },
  { category: 'Occupancy', current: 94.2, previous: 93.8, forecast: 94.5, direction: 'up' as const, signal: 'green' as const },
  { category: 'Supply Pipeline', current: 2850, previous: 3200, forecast: 2400, direction: 'down' as const, signal: 'green' as const },
  { category: 'Absorption', current: 1200, previous: 980, forecast: 1350, direction: 'up' as const, signal: 'green' as const },
  { category: 'Cap Rates', current: 5.25, previous: 4.85, forecast: 5.40, direction: 'up' as const, signal: 'yellow' as const },
  { category: 'Construction Costs', current: 245, previous: 232, forecast: 255, direction: 'up' as const, signal: 'red' as const },
];

const mockSeasonalPatterns = [
  { month: 'Jan', leasing: 65, moveIns: 45, concessions: 80 },
  { month: 'Feb', leasing: 70, moveIns: 50, concessions: 75 },
  { month: 'Mar', leasing: 82, moveIns: 65, concessions: 60 },
  { month: 'Apr', leasing: 90, moveIns: 78, concessions: 45 },
  { month: 'May', leasing: 95, moveIns: 88, concessions: 30 },
  { month: 'Jun', leasing: 100, moveIns: 95, concessions: 20 },
  { month: 'Jul', leasing: 98, moveIns: 92, concessions: 25 },
  { month: 'Aug', leasing: 92, moveIns: 85, concessions: 35 },
  { month: 'Sep', leasing: 85, moveIns: 72, concessions: 50 },
  { month: 'Oct', leasing: 75, moveIns: 60, concessions: 60 },
  { month: 'Nov', leasing: 60, moveIns: 42, concessions: 70 },
  { month: 'Dec', leasing: 55, moveIns: 35, concessions: 85 },
];

export const TrendsAnalysisSection: React.FC<TrendsAnalysisSectionProps> = ({ deal }) => {
  const [timeframe, setTimeframe] = useState<'1Y' | '3Y' | '5Y' | '10Y'>('3Y');
  const [selectedMetric, setSelectedMetric] = useState<string>('Rent Growth');

  const getDirectionIcon = (direction: string) => {
    if (direction === 'up') return <ArrowUpRight size={14} className="text-green-500" />;
    if (direction === 'down') return <ArrowDownRight size={14} className="text-red-500" />;
    return <Minus size={14} className="text-slate-400" />;
  };

  const getSignalColor = (signal: string) => {
    if (signal === 'green') return 'bg-green-100 text-green-700 border-green-200';
    if (signal === 'yellow') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Trends Analysis</h2>
          <p className="text-sm text-slate-500">Market cycle indicators, seasonal patterns & forecasting</p>
        </div>
        <div className="flex items-center gap-2">
          {(['1Y', '3Y', '5Y', '10Y'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeframe === tf
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {mockTrends.map(trend => (
          <div
            key={trend.category}
            onClick={() => setSelectedMetric(trend.category)}
            className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
              selectedMetric === trend.category
                ? 'border-blue-300 ring-1 ring-blue-200 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">{trend.category}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${getSignalColor(trend.signal)}`}>
                {trend.signal === 'green' ? 'Favorable' : trend.signal === 'yellow' ? 'Watch' : 'Alert'}
              </span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {trend.category === 'Supply Pipeline' || trend.category === 'Absorption'
                  ? trend.current.toLocaleString()
                  : trend.category === 'Construction Costs'
                    ? `$${trend.current}`
                    : `${trend.current}%`}
              </span>
              <span className="flex items-center gap-0.5 text-xs mb-1">
                {getDirectionIcon(trend.direction)}
                <span className={trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
                  vs {trend.category === 'Supply Pipeline' || trend.category === 'Absorption'
                    ? trend.previous.toLocaleString()
                    : trend.category === 'Construction Costs'
                      ? `$${trend.previous}`
                      : `${trend.previous}%`}
                </span>
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Forecast: {trend.category === 'Supply Pipeline' || trend.category === 'Absorption'
                ? trend.forecast.toLocaleString()
                : trend.category === 'Construction Costs'
                  ? `$${trend.forecast}/SF`
                  : `${trend.forecast}%`}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {selectedMetric} - {timeframe} Trend
          </h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Actual</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-300 inline-block border-dashed" /> Forecast</span>
          </div>
        </div>
        <div className="h-48 flex items-end justify-between gap-1 px-2">
          {Array.from({ length: 12 }, (_, i) => {
            const height = 30 + Math.sin(i * 0.8) * 25 + Math.random() * 20;
            const isForecast = i >= 9;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${isForecast ? 'bg-blue-200 border border-dashed border-blue-300' : 'bg-blue-500'}`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-slate-400">
                  {['Q1', 'Q2', 'Q3', 'Q4'][i % 4]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Seasonal Leasing Patterns</h3>
        <div className="grid grid-cols-12 gap-2">
          {mockSeasonalPatterns.map(month => (
            <div key={month.month} className="text-center">
              <div className="space-y-1 mb-2">
                <div
                  className="w-full bg-blue-400 rounded-t mx-auto"
                  style={{ height: `${month.leasing * 0.6}px` }}
                  title={`Leasing: ${month.leasing}%`}
                />
                <div
                  className="w-full bg-green-400 mx-auto"
                  style={{ height: `${month.moveIns * 0.5}px` }}
                  title={`Move-ins: ${month.moveIns}%`}
                />
              </div>
              <span className="text-[10px] text-slate-500 font-medium">{month.month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-400 rounded inline-block" /> Leasing Activity</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-400 rounded inline-block" /> Move-ins</span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">AI Trend Insight</h4>
            <p className="text-sm text-blue-700 mt-1">
              Based on {timeframe} historical patterns, the Atlanta submarket is entering a favorable window for new development. 
              Supply pipeline is declining while absorption remains strong. Optimal delivery timing: Q2-Q3 2026 to capture the supply gap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsAnalysisSection;
