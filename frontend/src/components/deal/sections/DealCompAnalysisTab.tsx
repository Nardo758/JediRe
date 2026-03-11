import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { competitionService, TieredCompProperty } from '@/services/competition.service';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  RotateCcw,
  MapPin,
  Building2,
  AlertCircle,
} from 'lucide-react';

type TierKey = 'trade_area' | 'submarket' | 'msa';

const TIER_CONFIG: Record<TierKey, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  trade_area: { label: 'Trade Area Comps', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: '📍' },
  submarket: { label: 'Submarket Comps', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: '🏘️' },
  msa: { label: 'MSA Comps', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', icon: '🌆' },
};

interface CompSetSummary {
  count: number;
  avgRent: number | null;
  avgUnits: number | null;
  avgDistance: number | null;
  avgMatchScore: number | null;
}

function computeCompSetSummary(comps: TieredCompProperty[]): CompSetSummary {
  const inSet = comps.filter(c => c.in_comp_set);
  if (inSet.length === 0) return { count: 0, avgRent: null, avgUnits: null, avgDistance: null, avgMatchScore: null };

  const withRent = inSet.filter(c => c.avg_rent != null && c.avg_rent > 0);
  const withDist = inSet.filter(c => c.distance_miles != null);

  return {
    count: inSet.length,
    avgRent: withRent.length > 0 ? Math.round(withRent.reduce((s, c) => s + (c.avg_rent || 0), 0) / withRent.length) : null,
    avgUnits: Math.round(inSet.reduce((s, c) => s + c.units, 0) / inSet.length),
    avgDistance: withDist.length > 0 ? Math.round(withDist.reduce((s, c) => s + (c.distance_miles || 0), 0) / withDist.length * 10) / 10 : null,
    avgMatchScore: Math.round(inSet.reduce((s, c) => s + c.match_score, 0) / inSet.length),
  };
}

function CompRow({
  comp,
  rank,
  onToggleCompSet,
  toggling,
}: {
  comp: TieredCompProperty;
  rank: number;
  onToggleCompSet: (comp: TieredCompProperty) => void;
  toggling: boolean;
}) {
  const scoreColor = comp.match_score >= 70 ? 'text-emerald-600' : comp.match_score >= 50 ? 'text-amber-600' : 'text-stone-500';
  const scoreBg = comp.match_score >= 70 ? 'bg-emerald-500' : comp.match_score >= 50 ? 'bg-amber-500' : 'bg-stone-400';

  return (
    <tr className="border-t border-stone-100 hover:bg-stone-50/50 transition-colors">
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs font-mono text-stone-400">{rank}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs font-semibold text-stone-900 truncate max-w-[200px]">{comp.name || comp.address}</div>
        <div className="text-[10px] text-stone-400 truncate max-w-[200px]">{comp.address}</div>
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono text-stone-600">{comp.units || '—'}</td>
      <td className="px-3 py-2.5 text-center text-xs font-mono text-stone-600">{comp.year_built || '—'}</td>
      <td className="px-3 py-2.5 text-center text-xs font-mono text-stone-600">{comp.stories || '—'}</td>
      <td className="px-3 py-2.5 text-center">
        {comp.class_code ? (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            comp.class_code.startsWith('A') ? 'bg-blue-50 text-blue-600' :
            comp.class_code.startsWith('B') ? 'bg-amber-50 text-amber-600' :
            'bg-stone-100 text-stone-500'
          }`}>{comp.class_code}</span>
        ) : <span className="text-xs text-stone-300">—</span>}
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono text-stone-600">
        {comp.distance_miles != null ? `${comp.distance_miles} mi` : '—'}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold font-mono ${scoreColor}`}>{Math.round(comp.match_score)}</span>
          <div className="w-12 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBg}`} style={{ width: `${Math.min(100, comp.match_score)}%` }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono text-stone-600">
        {comp.avg_rent != null && comp.avg_rent > 0 ? `$${comp.avg_rent.toLocaleString()}` : '—'}
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono text-stone-600">
        {comp.occupancy != null ? `${comp.occupancy}%` : '—'}
      </td>
      <td className="px-3 py-2.5 text-center">
        <button
          onClick={() => onToggleCompSet(comp)}
          disabled={toggling}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
            comp.in_comp_set
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
              : 'bg-stone-100 text-stone-600 border border-stone-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
          } ${toggling ? 'opacity-50 cursor-wait' : ''}`}
        >
          {comp.in_comp_set ? (
            <><Check className="h-3 w-3" /> In Set</>
          ) : (
            <><Plus className="h-3 w-3" /> Add to Set</>
          )}
        </button>
      </td>
    </tr>
  );
}

function TierSection({
  tier,
  comps,
  onToggleCompSet,
  togglingAddress,
}: {
  tier: TierKey;
  comps: TieredCompProperty[];
  onToggleCompSet: (comp: TieredCompProperty) => void;
  togglingAddress: string | null;
}) {
  const [expanded, setExpanded] = useState(tier === 'trade_area');
  const config = TIER_CONFIG[tier];
  const inSetCount = comps.filter(c => c.in_comp_set).length;

  return (
    <div className={`border ${config.borderColor} rounded-lg overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-3 ${config.bgColor} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-500" />}
          <span className="text-sm font-bold text-stone-900">{config.icon} {config.label}</span>
          <span className="text-xs text-stone-500 font-mono">({comps.length} properties)</span>
          {inSetCount > 0 && (
            <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{inSetCount} in set</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-stone-500">
          {comps.length > 0 && (
            <>
              <span>Avg Units: {Math.round(comps.reduce((s, c) => s + c.units, 0) / comps.length)}</span>
              {comps.some(c => c.distance_miles != null) && (
                <span>Avg Distance: {(comps.filter(c => c.distance_miles != null).reduce((s, c) => s + (c.distance_miles || 0), 0) / comps.filter(c => c.distance_miles != null).length).toFixed(1)} mi</span>
              )}
            </>
          )}
        </div>
      </button>

      {expanded && (
        <div className="bg-white">
          {comps.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-6 w-6 text-stone-300 mx-auto mb-2" />
              <p className="text-xs text-stone-400">No properties found at this geographic level</p>
              <p className="text-[10px] text-stone-300 mt-1">
                {tier === 'trade_area' && 'No geocoded properties within the trade area radius'}
                {tier === 'submarket' && 'Deal location does not fall within a defined submarket boundary'}
                {tier === 'msa' && 'Deal location does not fall within a defined MSA boundary'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-left">
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider w-10">#</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-14">UNITS</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-16">BUILT</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-16">STORIES</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-14">CLASS</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-16">DIST</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-24">MATCH</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-20">RENT</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-16">OCC</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-stone-400 tracking-wider text-center w-24">COMP SET</th>
                  </tr>
                </thead>
                <tbody>
                  {comps.map((comp, idx) => (
                    <CompRow
                      key={comp.address}
                      comp={comp}
                      rank={idx + 1}
                      onToggleCompSet={onToggleCompSet}
                      toggling={togglingAddress === comp.address}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DealCompAnalysisTab: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Record<TierKey, TieredCompProperty[]>>({
    trade_area: [],
    submarket: [],
    msa: [],
  });
  const [dealInfo, setDealInfo] = useState<{ name: string; address: string } | null>(null);
  const [togglingAddress, setTogglingAddress] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchTieredComps = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await competitionService.discoverTieredComps(dealId, 3);
      setTiers({
        trade_area: result.trade_area,
        submarket: result.submarket,
        msa: result.msa,
      });
      setDealInfo({ name: result.deal.name, address: result.deal.address });
    } catch (err: any) {
      console.error('Failed to fetch tiered comps:', err);
      setError(err.message || 'Failed to load comp analysis');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchTieredComps();
  }, [fetchTieredComps]);

  const allComps = [...tiers.trade_area, ...tiers.submarket, ...tiers.msa];
  const summary = computeCompSetSummary(allComps);

  const handleToggleCompSet = async (comp: TieredCompProperty) => {
    if (!dealId) return;
    setTogglingAddress(comp.address);
    try {
      if (comp.in_comp_set && comp.comp_set_id) {
        await competitionService.removeFromCompSet(dealId, comp.comp_set_id);
      } else {
        const result = await competitionService.addToCompSet(dealId, {
          address: comp.address,
          name: comp.name,
          units: comp.units,
          year_built: comp.year_built,
          stories: comp.stories,
          class_code: comp.class_code,
          distance_miles: comp.distance_miles,
          match_score: comp.match_score,
          geographic_tier: comp.geographic_tier,
        });
        comp.comp_set_id = result.comp?.id || null;
      }

      setTiers(prev => {
        const updated = { ...prev };
        for (const tier of ['trade_area', 'submarket', 'msa'] as TierKey[]) {
          updated[tier] = prev[tier].map(c =>
            c.address === comp.address
              ? { ...c, in_comp_set: !c.in_comp_set, comp_set_id: c.in_comp_set ? null : (comp.comp_set_id || 'pending') }
              : c
          );
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to toggle comp set:', err);
    } finally {
      setTogglingAddress(null);
    }
  };

  const handleResetToDefaults = async () => {
    if (!dealId) return;
    setResetting(true);
    try {
      await competitionService.resetCompSet(dealId, 3);
      await fetchTieredComps();
    } catch (err) {
      console.error('Failed to reset comp set:', err);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mb-3" />
          <p className="text-sm text-stone-500">Discovering comps across geographic tiers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-700 font-medium">{error}</p>
        <button onClick={fetchTieredComps} className="mt-3 text-xs text-red-600 hover:text-red-800 font-medium">
          Retry
        </button>
      </div>
    );
  }

  const totalComps = allComps.length;

  return (
    <div className="space-y-4">
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">COMP ANALYSIS</div>
        <div className="text-lg font-semibold">
          {dealInfo?.name || 'Deal'} — Geographic Comp Discovery
        </div>
        <div className="text-xs text-stone-400 mt-1">
          {totalComps} properties discovered across {[tiers.trade_area.length > 0 && 'Trade Area', tiers.submarket.length > 0 && 'Submarket', tiers.msa.length > 0 && 'MSA'].filter(Boolean).join(', ')} tiers
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-stone-900">Your Comp Set</h3>
              <p className="text-[10px] text-stone-400">{summary.count} properties selected</p>
            </div>
          </div>
          <button
            onClick={handleResetToDefaults}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 rounded-lg hover:bg-stone-50 text-xs text-stone-600 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </button>
        </div>

        {summary.count > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-emerald-600 tracking-wider">PROPERTIES</div>
              <div className="text-xl font-bold text-emerald-700">{summary.count}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-stone-500 tracking-wider">AVG UNITS</div>
              <div className="text-xl font-bold text-stone-800">{summary.avgUnits ?? '—'}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-stone-500 tracking-wider">AVG DISTANCE</div>
              <div className="text-xl font-bold text-stone-800">{summary.avgDistance != null ? `${summary.avgDistance} mi` : '—'}</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-stone-500 tracking-wider">AVG MATCH</div>
              <div className="text-xl font-bold text-stone-800">{summary.avgMatchScore ?? '—'}</div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-xs text-amber-700">No properties in your comp set. Use the "Add to Set" buttons below to build your competitive analysis.</p>
          </div>
        )}
      </div>

      {(['trade_area', 'submarket', 'msa'] as TierKey[]).map(tier => (
        <TierSection
          key={tier}
          tier={tier}
          comps={tiers[tier]}
          onToggleCompSet={handleToggleCompSet}
          togglingAddress={togglingAddress}
        />
      ))}

      {totalComps === 0 && (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-8 text-center">
          <MapPin className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-500 font-medium">No comparable properties found</p>
          <p className="text-xs text-stone-400 mt-1">This may be because property records in this area lack geocoded coordinates. Try the auto-discovery feature or add comps manually.</p>
          <button
            onClick={handleResetToDefaults}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-xs font-medium transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Run Auto-Discovery
          </button>
        </div>
      )}
    </div>
  );
};

export default DealCompAnalysisTab;
