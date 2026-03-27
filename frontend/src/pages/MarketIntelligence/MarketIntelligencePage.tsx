import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BT } from '@/components/deal/bloomberg-ui';
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
  if (pipeline > 15) return { label: `${pipeline}%`, style: { background: BT.text.red + '22', color: BT.text.red } as React.CSSProperties };
  if (pipeline >= 12) return { label: `${pipeline}%`, style: { background: BT.text.amber + '22', color: BT.text.amber } as React.CSSProperties };
  return { label: `${pipeline}%`, style: { background: BT.text.green + '22', color: BT.text.green } as React.CSSProperties };
};

const getConstraintBadge = (constraint: number) => {
  if (constraint > 65) return { label: 'HIGH', style: { background: BT.text.red + '22', color: BT.text.red } as React.CSSProperties };
  if (constraint >= 50) return { label: 'MOD', style: { background: BT.text.amber + '22', color: BT.text.amber } as React.CSSProperties };
  return { label: 'LOW', style: { background: BT.text.green + '22', color: BT.text.green } as React.CSSProperties };
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
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      <div className="border-b" style={{ background: BT.bg.panel, borderColor: BT.border.subtle }}>
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs mb-1" style={{ color: BT.text.muted }}>
                Market Intelligence <span className="mx-1">›</span> <span className="font-medium" style={{ color: BT.text.secondary }}>My Markets</span>
              </div>
              <h1 className="text-2xl font-bold" style={{ color: BT.text.primary }}>My Markets</h1>
            </div>
            <button className="px-4 py-2 text-sm font-medium hover:opacity-80 transition-colors" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>
              + Add Market
            </button>
          </div>
          <div className="text-sm mb-4" style={{ color: BT.text.secondary }}>
            Tracking {markets.length} markets | {totalProps.toLocaleString()} properties | {totalUnits.toLocaleString()} units
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={
                    sortBy === opt.key
                      ? { background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }
                      : { background: BT.bg.header, color: BT.text.secondary, borderRadius: 0 }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center p-0.5" style={{ background: BT.bg.header, borderRadius: 0 }}>
              {(['grid', 'list', 'map'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-2.5 py-1.5 text-xs font-medium transition-colors"
                  style={
                    viewMode === mode
                      ? { background: BT.bg.panel, color: BT.text.primary, borderRadius: 0 }
                      : { color: BT.text.secondary, borderRadius: 0 }
                  }
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
                className="border p-5 hover:border-opacity-80 transition-all cursor-pointer"
                style={{ background: BT.bg.panel, borderColor: BT.border.subtle, borderRadius: 0 }}
                onClick={() => navigate(`/market-intelligence/markets/${market.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold uppercase tracking-wide" style={{ color: BT.text.primary }}>
                      {market.name}, {market.state}
                    </h3>
                    <div className="text-xs mt-0.5" style={{ color: BT.text.secondary }}>
                      {market.properties.toLocaleString()} props | {formatUnits(market.units)} units
                      {market.id === 'atlanta' && atlantaStats && <span className="ml-1 text-[8px] font-bold px-1 py-0.5" style={{ color: BT.text.green, background: BT.text.green + '22', borderRadius: 2 }}>LIVE</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium" style={{ color: BT.text.muted }}>JEDI</div>
                    <div className="text-2xl font-bold" style={{ color: BT.text.primary }}>{market.jediScore}</div>
                  </div>
                </div>

                <div className="w-full h-1.5 mb-3" style={{ background: BT.bg.header, borderRadius: 0 }}>
                  <div
                    className="h-1.5 transition-all"
                    style={{ width: `${market.jediScore}%`, background: BT.text.cyan, borderRadius: 0 }}
                  />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs" style={{ color: BT.text.secondary }}>Coverage:</span>
                  <div className="flex-1 h-1.5" style={{ background: BT.bg.header, borderRadius: 0 }}>
                    <div className="h-1.5" style={{ width: `${market.coverage}%`, background: BT.text.green, borderRadius: 0 }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: BT.text.secondary }}>{market.coverage}%</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                  <div className="flex justify-between">
                    <span style={{ color: BT.text.secondary }}>Rent:</span>
                    <span className="font-medium" style={{ color: BT.text.primary }}>${market.rent.toLocaleString()} <span className="text-xs" style={{ color: BT.text.green }}>+{market.rentGrowth}%</span></span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: BT.text.secondary }}>Jobs/Apt:</span>
                    <span className="font-medium" style={{ color: BT.text.primary }}>{market.jobsApt}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: BT.text.secondary }}>Pipeline:</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5" style={{ ...pBadge.style, borderRadius: 2 }}>{pBadge.label}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: BT.text.secondary }}>Constraint:</span>
                    <span className="font-medium" style={{ color: BT.text.primary }}>{market.constraint} <span className="text-xs font-semibold px-1.5 py-0.5" style={{ ...cBadge.style, borderRadius: 2 }}>{cBadge.label}</span></span>
                  </div>
                </div>

                <div className="border px-3 py-2 mb-3" style={{ background: BT.text.cyan + '12', borderColor: BT.text.cyan + '33', borderRadius: 0 }}>
                  <span className="text-xs font-medium" style={{ color: BT.text.cyan }}>▲ {market.insight}</span>
                </div>

                <div className="space-y-1.5">
                  {(Object.entries(market.signals) as [string, number][]).map(([key, score]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-bold w-3" style={{ color: SIGNAL_COLORS[key] }}>{key}</span>
                      <div className="flex-1 h-2 overflow-hidden" style={{ background: BT.bg.header, borderRadius: 0 }}>
                        <div
                          className="h-2 transition-all"
                          style={{ width: `${score}%`, backgroundColor: SIGNAL_COLORS[key], borderRadius: 0 }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-6 text-right" style={{ color: BT.text.secondary }}>{score}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t" style={{ borderColor: BT.border.subtle }}>
                  <span className="text-xs font-medium" style={{ color: BT.text.cyan }}>Open Dashboard →</span>
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
