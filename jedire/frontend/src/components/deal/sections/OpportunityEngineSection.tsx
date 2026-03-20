import React, { useState, useEffect } from 'react';
import { apiClient } from '@/services/api.client';

interface OpportunitySignal {
  type: string;
  label: string;
  value: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  weight: number;
}

interface OpportunityScore {
  submarketName: string;
  city: string;
  marketScore: number;
  propertyScore: number;
  opportunityScore: number;
  estimatedUpsidePercent: number;
  estimatedUpsideDollar: number;
  strategy: string;
  strategyRationale: string;
  signals: OpportunitySignal[];
  rank: number;
  quartile: number;
}

interface MarketSummary {
  city: string;
  avgMarketScore: number;
  totalSubmarkets: number;
  topOpportunitySubmarket: string;
  avgUpsidePercent: number;
}

interface OpportunityData {
  opportunities: OpportunityScore[];
  marketSummary: MarketSummary;
  calculatedAt: string;
}

interface Props {
  deal?: any;
}

const strategyConfig: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  renovate: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: '🔧' },
  rebrand: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: '✨' },
  reposition: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: '🎯' },
  acquire: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '💰' },
};

const signalColors: Record<string, string> = {
  bullish: 'text-emerald-600',
  bearish: 'text-red-500',
  neutral: 'text-stone-500',
};

export const OpportunityEngineSection: React.FC<Props> = ({ deal }) => {
  const [data, setData] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'upside'>('score');

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/opportunities/detect', { params: { city: 'Atlanta' } });
      if (res.data?.success && res.data.data) {
        setData(res.data.data);
      } else {
        setError('No opportunity data available');
      }
    } catch (err: any) {
      console.error('Failed to load opportunities:', err);
      setError(err.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">OPPORTUNITY ENGINE</div>
          <div className="text-lg font-semibold">Where should I invest and what strategy maximizes returns?</div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-48 mx-auto mb-3"></div>
            <div className="text-xs text-stone-400">Scanning markets for opportunities...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
          <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">OPPORTUNITY ENGINE</div>
          <div className="text-lg font-semibold">Where should I invest and what strategy maximizes returns?</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-800 font-medium mb-2">No opportunities detected</div>
          <div className="text-xs text-red-600 mb-3">{error || 'Sync apartment data first to enable opportunity detection.'}</div>
          <button onClick={loadOpportunities} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  let filtered = data.opportunities;
  if (filterStrategy !== 'all') {
    filtered = filtered.filter(o => o.strategy === filterStrategy);
  }
  if (sortBy === 'upside') {
    filtered = [...filtered].sort((a, b) => b.estimatedUpsidePercent - a.estimatedUpsidePercent);
  }

  return (
    <div className="space-y-5">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-amber-500">
        <div className="text-[10px] font-mono text-amber-500 tracking-widest mb-1">OPPORTUNITY ENGINE</div>
        <div className="text-lg font-semibold">Where should I invest and what strategy maximizes returns?</div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Markets Scanned" value={data.marketSummary.totalSubmarkets.toString()} sub={data.marketSummary.city} />
        <StatCard label="Avg Market Score" value={`${data.marketSummary.avgMarketScore}`} sub="F40 Score" color={data.marketSummary.avgMarketScore > 60 ? 'emerald' : 'amber'} />
        <StatCard label="Top Opportunity" value={data.marketSummary.topOpportunitySubmarket} sub="#1 ranked" />
        <StatCard label="Avg Upside" value={`${data.marketSummary.avgUpsidePercent}%`} sub="estimated return" color="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Ranked Opportunities</h3>
            <p className="text-xs text-stone-500">{filtered.length} submarkets ranked by opportunity score</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">LIVE DATA</span>
            <select
              value={filterStrategy}
              onChange={e => setFilterStrategy(e.target.value)}
              className="text-xs border border-stone-200 rounded px-2 py-1"
            >
              <option value="all">All Strategies</option>
              <option value="renovate">Renovate</option>
              <option value="rebrand">Rebrand</option>
              <option value="reposition">Reposition</option>
              <option value="acquire">Acquire</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'score' | 'upside')}
              className="text-xs border border-stone-200 rounded px-2 py-1"
            >
              <option value="score">Sort by Score</option>
              <option value="upside">Sort by Upside</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((opp, idx) => {
            const cfg = strategyConfig[opp.strategy] || strategyConfig.acquire;
            return (
              <div key={idx} className={`border ${cfg.border} border-l-4 ${cfg.bg} rounded-lg p-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-stone-900">#{opp.rank} {opp.submarketName}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.icon} {opp.strategy.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mb-2">{opp.strategyRationale}</p>

                    <div className="flex items-center gap-4 text-[11px] text-stone-500 mb-2">
                      <span>Market: <strong className="text-stone-900">{opp.marketScore}</strong>/100</span>
                      <span>Property: <strong className="text-stone-900">{opp.propertyScore}</strong>/100</span>
                      <span className="font-semibold text-emerald-600">+{opp.estimatedUpsidePercent}% upside</span>
                      <span className="text-emerald-600">${(opp.estimatedUpsideDollar / 1000000).toFixed(1)}M est. value</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {opp.signals.map((sig, si) => (
                        <span key={si} className={`text-[10px] font-mono ${signalColors[sig.direction]}`}>
                          {sig.direction === 'bullish' ? '▲' : sig.direction === 'bearish' ? '▼' : '●'} {sig.label}: {sig.value}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ml-4 text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-stone-900">{opp.opportunityScore}</div>
                    <div className="text-[10px] text-stone-400">OPP SCORE</div>
                    <div className="mt-2 w-16 bg-stone-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${opp.opportunityScore > 70 ? 'bg-emerald-500' : opp.opportunityScore > 50 ? 'bg-amber-500' : 'bg-stone-400'}`}
                        style={{ width: `${opp.opportunityScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-stone-400 text-sm">
            No opportunities match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sub: string; color?: string }> = ({ label, value, sub, color = 'stone' }) => (
  <div className="bg-white rounded-xl border border-stone-200 p-4">
    <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-1">{label.toUpperCase()}</div>
    <div className={`text-xl font-bold ${color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : 'text-stone-900'}`}>{value}</div>
    <div className="text-[11px] text-stone-500 mt-0.5">{sub}</div>
  </div>
);

export default OpportunityEngineSection;
