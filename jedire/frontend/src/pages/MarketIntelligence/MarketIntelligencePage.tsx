import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SIGNAL_GROUPS } from './signalGroups';

interface MarketSignals {
  D: number;
  S: number;
  M: number;
  P: number;
  R: number;
}

interface Market {
  id: string;
  name: string;
  state: string;
  jediScore: number;
  properties: number;
  units: number;
  coverage: number;
  rent: number;
  rentGrowth: number;
  jobsApt: number;
  pipeline: number;
  constraint: number;
  signals: MarketSignals;
  insight: string;
}

const TRACKED_MARKETS: Market[] = [
  { id: 'atlanta', name: 'Atlanta', state: 'GA', jediScore: 87, properties: 1028, units: 249964, coverage: 60, rent: 2150, rentGrowth: 4.2, jobsApt: 5.8, pipeline: 15.8, constraint: 58, signals: { D: 82, S: 64, M: 78, P: 72, R: 28 }, insight: 'Demand accelerating' },
  { id: 'charlotte', name: 'Charlotte', state: 'NC', jediScore: 82, properties: 680, units: 142000, coverage: 52, rent: 1680, rentGrowth: 3.5, jobsApt: 5.2, pipeline: 12.4, constraint: 68, signals: { D: 76, S: 72, M: 74, P: 68, R: 26 }, insight: 'Best risk-adjusted' },
  { id: 'raleigh', name: 'Raleigh', state: 'NC', jediScore: 85, properties: 480, units: 98000, coverage: 48, rent: 1740, rentGrowth: 3.9, jobsApt: 5.5, pipeline: 11.8, constraint: 72, signals: { D: 74, S: 78, M: 75, P: 70, R: 24 }, insight: 'Past-peak supply' },
  { id: 'nashville', name: 'Nashville', state: 'TN', jediScore: 78, properties: 520, units: 118000, coverage: 42, rent: 1890, rentGrowth: 2.8, jobsApt: 4.8, pipeline: 18.2, constraint: 42, signals: { D: 68, S: 48, M: 72, P: 66, R: 38 }, insight: 'Supply peaking' },
  { id: 'tampa', name: 'Tampa', state: 'FL', jediScore: 74, properties: 390, units: 86000, coverage: 38, rent: 1620, rentGrowth: 3.1, jobsApt: 4.6, pipeline: 10.2, constraint: 74, signals: { D: 70, S: 80, M: 68, P: 62, R: 22 }, insight: 'Supply trough' },
  { id: 'dallas', name: 'Dallas', state: 'TX', jediScore: 71, properties: 440, units: 102000, coverage: 35, rent: 1540, rentGrowth: 2.4, jobsApt: 4.4, pipeline: 14.2, constraint: 51, signals: { D: 64, S: 58, M: 66, P: 60, R: 32 }, insight: 'Watch supply' },
];

type SortKey = 'jediScore' | 'rentGrowth' | 'pipeline' | 'constraint' | 'signals';
type ViewMode = 'grid' | 'list' | 'map';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'jediScore', label: 'JEDI Score' },
  { key: 'rentGrowth', label: 'Rent Growth' },
  { key: 'pipeline', label: 'Pipeline %' },
  { key: 'constraint', label: 'Constraint' },
  { key: 'signals', label: 'Traffic' },
];

const SIGNAL_COLORS: Record<string, string> = {
  D: SIGNAL_GROUPS.DEMAND.color,
  S: SIGNAL_GROUPS.SUPPLY.color,
  M: SIGNAL_GROUPS.MOMENTUM.color,
  P: SIGNAL_GROUPS.POSITION.color,
  R: SIGNAL_GROUPS.RISK.color,
};

const getPipelineBadge = (pipeline: number) => {
  if (pipeline > 15) return { label: `${pipeline}%`, className: 'bg-red-100 text-red-700' };
  if (pipeline >= 12) return { label: `${pipeline}%`, className: 'bg-yellow-100 text-yellow-700' };
  return { label: `${pipeline}%`, className: 'bg-green-100 text-green-700' };
};

const getConstraintBadge = (constraint: number) => {
  if (constraint > 65) return { label: 'HIGH', className: 'bg-red-100 text-red-700' };
  if (constraint >= 50) return { label: 'MOD', className: 'bg-yellow-100 text-yellow-700' };
  return { label: 'LOW', className: 'bg-green-100 text-green-700' };
};

const formatUnits = (units: number) => {
  if (units >= 1000) return `${Math.round(units / 1000)}K`;
  return units.toString();
};

const MarketIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortKey>('jediScore');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [atlantaStats, setAtlantaStats] = useState<any>(null);

  useEffect(() => {
    const fetchAtlantaStats = async () => {
      try {
        const res = await fetch('/api/v1/markets/market-stats/atlanta');
        const data = await res.json();
        setAtlantaStats(data);
      } catch (err) {
        console.error('Failed to fetch Atlanta stats:', err);
      }
    };
    fetchAtlantaStats();
  }, []);

  const markets = TRACKED_MARKETS.map(m => {
    if (m.id === 'atlanta' && atlantaStats) {
      return {
        ...m,
        properties: atlantaStats.totalProperties || m.properties,
        units: atlantaStats.totalUnits || m.units,
      };
    }
    return m;
  });

  const sortedMarkets = [...markets].sort((a, b) => {
    switch (sortBy) {
      case 'jediScore': return b.jediScore - a.jediScore;
      case 'rentGrowth': return b.rentGrowth - a.rentGrowth;
      case 'pipeline': return b.pipeline - a.pipeline;
      case 'constraint': return b.constraint - a.constraint;
      case 'signals': return (b.signals.D + b.signals.S) - (a.signals.D + a.signals.S);
      default: return 0;
    }
  });

  const totalProps = markets.reduce((s, m) => s + m.properties, 0);
  const totalUnits = markets.reduce((s, m) => s + m.units, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">
                Market Intelligence <span className="mx-1">›</span> <span className="text-gray-700 font-medium">My Markets</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">My Markets</h1>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              + Add Market
            </button>
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Tracking {markets.length} markets | {totalProps.toLocaleString()} properties | {totalUnits.toLocaleString()} units
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    sortBy === opt.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {(['grid', 'list', 'map'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode === 'grid' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  )}
                  {mode === 'list' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  )}
                  {mode === 'map' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5' : 'space-y-4'}>
          {sortedMarkets.map((market) => {
            const pBadge = getPipelineBadge(market.pipeline);
            const cBadge = getConstraintBadge(market.constraint);

            return (
              <div
                key={market.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer"
                onClick={() => navigate(`/market-intelligence/markets/${market.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                      {market.name}, {market.state}
                    </h3>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {market.properties.toLocaleString()} props | {formatUnits(market.units)} units
                      {market.id === 'atlanta' && atlantaStats && <span className="ml-1 text-[8px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">LIVE</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 font-medium">JEDI</div>
                    <div className="text-2xl font-bold text-gray-900">{market.jediScore}</div>
                  </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${market.jediScore}%` }}
                  />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Coverage:</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${market.coverage}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{market.coverage}%</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rent:</span>
                    <span className="font-medium">${market.rent.toLocaleString()} <span className="text-green-600 text-xs">+{market.rentGrowth}%</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Jobs/Apt:</span>
                    <span className="font-medium">{market.jobsApt}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Pipeline:</span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${pBadge.className}`}>{pBadge.label}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Constraint:</span>
                    <span className="font-medium">{market.constraint} <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cBadge.className}`}>{cBadge.label}</span></span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
                  <span className="text-xs text-blue-700 font-medium">▲ {market.insight}</span>
                </div>

                <div className="space-y-1.5">
                  {(Object.entries(market.signals) as [string, number][]).map(([key, score]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-3" style={{ color: SIGNAL_COLORS[key] }}>{key}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${score}%`, backgroundColor: SIGNAL_COLORS[key] }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-6 text-right">{score}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-blue-600 hover:text-blue-800">Open Dashboard →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MarketIntelligencePage;
