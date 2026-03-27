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
import { BT } from '@/components/deal/bloomberg-ui';

type TierKey = 'trade_area' | 'submarket' | 'msa';

const TIER_CONFIG: Record<TierKey, { label: string; colorHex: string; icon: string }> = {
  trade_area: { label: 'Trade Area Comps', colorHex: BT.text.green, icon: '📍' },
  submarket: { label: 'Submarket Comps', colorHex: BT.text.cyan, icon: '🏘️' },
  msa: { label: 'MSA Comps', colorHex: BT.text.purple, icon: '🌆' },
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

  const withRent = inSet.filter(c => c.avg_rent != null && c.avg_rent > 0 && c.units > 0);
  const withDist = inSet.filter(c => c.distance_miles != null);

  // Rent is unit-weighted: larger properties carry proportionally more weight
  const weightedRent = withRent.length > 0
    ? (() => {
        const totalUnits = withRent.reduce((s, c) => s + c.units, 0);
        return totalUnits > 0
          ? Math.round(withRent.reduce((s, c) => s + (c.avg_rent || 0) * c.units, 0) / totalUnits)
          : null;
      })()
    : null;

  return {
    count: inSet.length,
    avgRent: weightedRent,
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
  const scoreColorHex = comp.match_score >= 70 ? BT.text.green : comp.match_score >= 50 ? BT.text.amber : BT.text.muted;
  const scoreBgHex = comp.match_score >= 70 ? BT.text.green : comp.match_score >= 50 ? BT.text.amber : BT.text.muted;

  return (
    <tr className="transition-colors" style={{ borderTop: `1px solid ${BT.border.subtle}` }}
      onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs font-mono" style={{ color: BT.text.muted }}>{rank}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs font-semibold truncate max-w-[200px]" style={{ color: BT.text.primary }}>{comp.name || comp.address}</div>
        <div className="text-[10px] truncate max-w-[200px]" style={{ color: BT.text.muted }}>{comp.address}</div>
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: BT.text.secondary }}>{comp.units || '—'}</td>
      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: BT.text.secondary }}>{comp.year_built || '—'}</td>
      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: BT.text.secondary }}>{comp.stories || '—'}</td>
      <td className="px-3 py-2.5 text-center">
        {comp.class_code ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5" style={{
            borderRadius: 0,
            background: comp.class_code.startsWith('A') ? `${BT.text.cyan}11` :
              comp.class_code.startsWith('B') ? `${BT.text.amber}11` : BT.bg.panelAlt,
            color: comp.class_code.startsWith('A') ? BT.text.cyan :
              comp.class_code.startsWith('B') ? BT.text.amber : BT.text.muted
          }}>{comp.class_code}</span>
        ) : <span className="text-xs" style={{ color: BT.text.muted }}>—</span>}
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: BT.text.secondary }}>
        {comp.distance_miles != null ? `${comp.distance_miles} mi` : '—'}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold font-mono" style={{ color: scoreColorHex }}>{Math.round(comp.match_score)}</span>
          <div className="w-12 h-1.5 overflow-hidden" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
            <div className="h-full" style={{ width: `${Math.min(100, comp.match_score)}%`, background: scoreBgHex, borderRadius: 0 }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: BT.text.secondary }}>
        {comp.avg_rent != null && comp.avg_rent > 0 ? `$${comp.avg_rent.toLocaleString()}` : '—'}
      </td>
      <td className="px-3 py-2.5 text-center text-xs font-mono" style={{ color: BT.text.secondary }}>
        {comp.occupancy != null ? `${comp.occupancy}%` : '—'}
      </td>
      <td className="px-3 py-2.5 text-center">
        <button
          onClick={() => onToggleCompSet(comp)}
          disabled={toggling}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all ${toggling ? 'opacity-50 cursor-wait' : ''}`}
          style={{
            borderRadius: 0,
            background: comp.in_comp_set ? `${BT.text.green}22` : BT.bg.panelAlt,
            color: comp.in_comp_set ? BT.text.green : BT.text.secondary,
            border: `1px solid ${comp.in_comp_set ? BT.text.green : BT.border.medium}`,
          }}
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
    <div className="overflow-hidden" style={{ border: `1px solid ${config.colorHex}44`, borderRadius: 0 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-90 transition-opacity"
        style={{ background: `${config.colorHex}11` }}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" style={{ color: BT.text.secondary }} /> : <ChevronRight className="h-4 w-4" style={{ color: BT.text.secondary }} />}
          <span className="text-sm font-bold" style={{ color: BT.text.primary }}>{config.icon} {config.label}</span>
          <span className="text-xs font-mono" style={{ color: BT.text.secondary }}>({comps.length} properties)</span>
          {inSetCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5" style={{ background: BT.text.green, color: BT.bg.terminal, borderRadius: 0 }}>{inSetCount} in set</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: BT.text.secondary }}>
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
        <div style={{ background: BT.bg.panel }}>
          {comps.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-6 w-6 mx-auto mb-2" style={{ color: BT.text.muted }} />
              <p className="text-xs" style={{ color: BT.text.secondary }}>No properties found at this geographic level</p>
              <p className="text-[10px] mt-1" style={{ color: BT.text.muted }}>
                {tier === 'trade_area' && 'No geocoded properties within the trade area radius'}
                {tier === 'submarket' && 'Deal location does not fall within a defined submarket boundary'}
                {tier === 'msa' && 'Deal location does not fall within a defined MSA boundary'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ background: BT.bg.header }}>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider w-10" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>#</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>PROPERTY</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-14" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>UNITS</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-16" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>BUILT</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-16" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>STORIES</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-14" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>CLASS</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-16" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>DIST</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-24" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>MATCH</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-20" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>RENT</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-16" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>OCC</th>
                    <th className="px-3 py-2 text-[10px] font-mono tracking-wider text-center w-24" style={{ color: BT.text.muted, fontFamily: BT.font.mono }}>COMP SET</th>
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
    } catch (err: any) {
      console.error('Failed to toggle comp set:', err);
      setError(`Failed to ${comp.in_comp_set ? 'remove from' : 'add to'} comp set: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setError(null), 4000);
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
          <div className="animate-spin h-8 w-8 mx-auto mb-3" style={{ border: `2px solid ${BT.text.purple}`, borderTopColor: 'transparent', borderRadius: 0 }} />
          <p className="text-sm" style={{ color: BT.text.secondary }}>Discovering comps across geographic tiers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center" style={{ background: `${BT.text.red}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <AlertCircle className="h-6 w-6 mx-auto mb-2" style={{ color: BT.text.red }} />
        <p className="text-sm font-medium" style={{ color: BT.text.red }}>{error}</p>
        <button onClick={fetchTieredComps} className="mt-3 text-xs font-medium" style={{ color: BT.text.red }}>
          Retry
        </button>
      </div>
    );
  }

  const totalComps = allComps.length;

  return (
    <div className="space-y-4">
      <div className="p-4" style={{ background: BT.bg.panel, color: BT.text.primary, borderRadius: 0, borderLeft: `4px solid ${BT.text.purple}` }}>
        <div className="text-[10px] font-mono tracking-widest mb-1" style={{ color: BT.text.purple, fontFamily: BT.font.mono }}>COMP ANALYSIS</div>
        <div className="text-lg font-semibold">
          {dealInfo?.name || 'Deal'} — Geographic Comp Discovery
        </div>
        <div className="text-xs mt-1" style={{ color: BT.text.secondary }}>
          {totalComps} properties discovered across {[tiers.trade_area.length > 0 && 'Trade Area', tiers.submarket.length > 0 && 'Submarket', tiers.msa.length > 0 && 'MSA'].filter(Boolean).join(', ')} tiers
        </div>
      </div>

      <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5" style={{ color: BT.text.green }} />
            <div>
              <h3 className="text-sm font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Your Comp Set</h3>
              <p className="text-[10px]" style={{ color: BT.text.muted }}>{summary.count} properties selected</p>
            </div>
          </div>
          <button
            onClick={handleResetToDefaults}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            style={{ border: `1px solid ${BT.border.medium}`, borderRadius: 0, color: BT.text.secondary }}
          >
            <RotateCcw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </button>
        </div>

        {summary.count > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 text-center" style={{ background: `${BT.text.green}11`, border: `1px solid ${BT.text.green}44`, borderRadius: 0 }}>
              <div className="text-[10px] font-mono tracking-wider" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>PROPERTIES</div>
              <div className="text-xl font-bold" style={{ color: BT.text.green, fontFamily: BT.font.mono }}>{summary.count}</div>
            </div>
            <div className="p-3 text-center" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="text-[10px] font-mono tracking-wider" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>AVG UNITS</div>
              <div className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{summary.avgUnits ?? '—'}</div>
            </div>
            <div className="p-3 text-center" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="text-[10px] font-mono tracking-wider" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>AVG DISTANCE</div>
              <div className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{summary.avgDistance != null ? `${summary.avgDistance} mi` : '—'}</div>
            </div>
            <div className="p-3 text-center" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <div className="text-[10px] font-mono tracking-wider" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>AVG MATCH</div>
              <div className="text-xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{summary.avgMatchScore ?? '—'}</div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center" style={{ background: `${BT.text.amber}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <p className="text-xs" style={{ color: BT.text.amber }}>No properties in your comp set. Use the "Add to Set" buttons below to build your competitive analysis.</p>
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
        <div className="p-8 text-center" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
          <MapPin className="h-8 w-8 mx-auto mb-3" style={{ color: BT.text.muted }} />
          <p className="text-sm font-medium" style={{ color: BT.text.secondary }}>No comparable properties found</p>
          <p className="text-xs mt-1" style={{ color: BT.text.muted }}>This may be because property records in this area lack geocoded coordinates. Try the auto-discovery feature or add comps manually.</p>
          <button
            onClick={handleResetToDefaults}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors"
            style={{ background: BT.text.purple, color: BT.bg.terminal, borderRadius: 0 }}
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
