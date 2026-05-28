/**
 * M27: Sale Comp Intelligence Module
 * Transaction intelligence and pattern detection
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp, MapPin, Calendar, DollarSign,
  Building2, Users, Target, BarChart3, AlertCircle,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface CompsModuleProps {
  deal?: any;
  dealId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
}

type InvestmentStrategy = 'stabilized' | 'value_add' | 'ground_up' | 'redevelopment';

interface CompRelevanceFactors {
  distance_decay: number;
  recency_decay: number;
  asset_class_match: number;
  size_similarity: number;
  vintage_similarity: number;
  data_quality_tier: number;
}

interface CompTransaction {
  id: string;
  recording_date: string;
  property_address: string;
  units: number;
  year_built: number;
  derived_sale_price: number;
  price_per_unit: number;
  implied_cap_rate: number | null;
  grantee_name: string;
  buyer_type: string;
  distance_miles: number;
  source?: string;
  relevance_score?: number;
  relevance_tier?: string;
  relevance_factors?: CompRelevanceFactors;
  geographic_tier?: 'trade_area' | 'submarket' | 'msa';
  geographic_label?: string;
}

interface CascadeMetadata {
  trade_area_count: number;
  submarket_count:  number;
  msa_count:        number;
  widened_to: 'trade_area' | 'submarket' | 'msa';
  threshold: number;
}

interface CompGroup {
  group_key:         string;
  label:             string;
  description:       string;
  comp_ids:          string[];
  avg_price_per_unit: number | null;
  median_cap_rate:   number | null;
}

interface CapRateSpread {
  min:          number;
  max:          number;
  median:       number;
  p25:          number;
  p75:          number;
  spread_bps:   number;
  recent_count: number;
}

interface CompStoryResult {
  story_key:   string;
  story_label: string;
  description: string;
  cascade:     CascadeMetadata;
  groups?:               CompGroup[];
  price_gap_per_unit?:   number | null;
  price_gap_pct?:        number | null;
  cap_rate_spread?:      CapRateSpread;
  recently_delivered_count?: number;
  recently_delivered_ids?:   string[];
  obsolete_vintage_count?:   number;
  obsolete_vintage_ids?:     string[];
}

interface CompSet {
  id?: string;
  comp_count: number;
  median_price_per_unit: number;
  avg_price_per_unit: number;
  min_price_per_unit: number;
  max_price_per_unit: number;
  median_implied_cap_rate: number | null;
  avg_implied_cap_rate: number | null;
  comps: CompTransaction[];
  top_comp_ids?: string[];
  strategy?: string;
  weights?: Record<string, number>;
  comp_story?: CompStoryResult;
  /** 'live' = real staged cascade was executed; 'stored_fallback' = no coordinates, used stored set */
  cascade_source?: 'live' | 'stored_fallback';
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  C1: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  C2: { bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/40' },
  M1: { bg: 'bg-yellow-500/15',  text: 'text-yellow-300',  border: 'border-yellow-500/40' },
  M2: { bg: 'bg-gray-500/15',    text: 'text-gray-400',    border: 'border-gray-600' },
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  C1: 'Core — tightest match across all factors',
  C2: 'Comparable — good match; minor deviations',
  M1: 'Marginal — limited match; use with caution',
  M2: 'Weak — geographic fill only',
};

const STRATEGY_LABELS: Record<InvestmentStrategy, string> = {
  stabilized:    'Stabilized',
  value_add:     'Value-Add',
  ground_up:     'Ground-Up',
  redevelopment: 'Redevelopment',
};

const FACTOR_LABELS: Record<keyof CompRelevanceFactors, string> = {
  distance_decay:     'Distance',
  recency_decay:      'Recency',
  asset_class_match:  'Asset Class',
  size_similarity:    'Size',
  vintage_similarity: 'Vintage',
  data_quality_tier:  'Data Quality',
};

const SOURCE_LABELS: Record<string, string> = {
  county_recorded: 'County',
  georgia_county:  'County',
  research_agent:  'Research',
  costar_upload:   'CoStar',
  om_extraction:   'OM',
};

function TierBadge({ tier }: { tier: string }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.M2;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${colors.bg} ${colors.text} ${colors.border}`}
      title={TIER_DESCRIPTIONS[tier] ?? tier}
    >
      {tier}
    </span>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#34d399' : pct >= 45 ? '#60a5fa' : pct >= 25 ? '#fbbf24' : '#9ca3af';
  return (
    <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
      <span className="w-14 truncate">{label}</span>
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-6 text-right" style={{ color }}>{pct}</span>
    </div>
  );
}

function FactorTooltip({ comp }: { comp: CompTransaction }) {
  const [open, setOpen] = useState(false);
  if (!comp.relevance_factors) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-gray-500 hover:text-gray-300 transition-colors"
        title="Factor breakdown"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute z-50 left-5 top-0 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl"
            style={{ minWidth: 180 }}
          >
            <div className="text-[9px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              Factor Breakdown
            </div>
            <div className="space-y-1">
              {(Object.keys(FACTOR_LABELS) as Array<keyof CompRelevanceFactors>).map(k => (
                <ScoreBar
                  key={k}
                  value={comp.relevance_factors![k] ?? 0}
                  label={FACTOR_LABELS[k]}
                />
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-[9px]">
              <span className="text-gray-500">Composite</span>
              <span className="text-gray-300 font-bold">
                {Math.round((comp.relevance_score ?? 0) * 100)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_TOP_COUNT = 8;

// ---------------------------------------------------------------------------
// CompStoryPanel — strategy-specific insight panel (D-COMP-2)
// ---------------------------------------------------------------------------
function CompStoryPanel({
  story,
  strategy,
  comps,
  formatCurrency,
  formatPercent,
}: {
  story: CompStoryResult;
  strategy: InvestmentStrategy;
  comps: CompTransaction[];
  formatCurrency: (v: number) => string;
  formatPercent: (v: number) => string;
}) {
  if (strategy === 'value_add' && story.groups && story.groups.length === 2) {
    const lower = story.groups[0];
    const upper = story.groups[1];
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">Rent Ceiling Gap</span>
          {story.price_gap_pct != null && story.price_gap_per_unit != null && (
            <span className="text-xs text-emerald-400 font-bold">
              +{story.price_gap_pct}% gap · {formatCurrency(story.price_gap_per_unit)}/unit value-add delta
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-gray-700">
          {[lower, upper].map((group, idx) => {
            const groupComps = comps.filter(c => group.comp_ids.includes(c.id));
            const color = idx === 0 ? 'amber' : 'emerald';
            return (
              <div key={group.group_key} className="p-3">
                <div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${idx === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {group.label}
                </div>
                <div className="text-[9px] text-gray-500 mb-2">{group.description}</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Avg $/Unit</span>
                    <span className={`font-semibold ${idx === 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {group.avg_price_per_unit != null ? formatCurrency(group.avg_price_per_unit) : '—'}
                    </span>
                  </div>
                  {group.median_cap_rate != null && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-500">Median Cap</span>
                      <span className="text-gray-300">{formatPercent(group.median_cap_rate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Comps</span>
                    <span className="text-gray-400">{groupComps.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (strategy === 'stabilized' && story.cap_rate_spread) {
    const { cap_rate_spread: cr } = story;
    return (
      <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-400 mb-2">Cap Rate Convergence</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px]">
          <div><span className="text-gray-500">Median </span><span className="text-blue-300 font-semibold">{formatPercent(cr.median)}</span></div>
          <div><span className="text-gray-500">P25 </span><span className="text-blue-300">{formatPercent(cr.p25)}</span></div>
          <div><span className="text-gray-500">P75 </span><span className="text-blue-300">{formatPercent(cr.p75)}</span></div>
          <div><span className="text-gray-500">Range </span><span className="text-gray-400">{formatPercent(cr.min)} – {formatPercent(cr.max)}</span></div>
          <div><span className="text-gray-500">Spread </span><span className="text-gray-400">{cr.spread_bps} bps</span></div>
          {cr.recent_count > 0 && (
            <div><span className="text-gray-500">Recent (&lt;18 mo) </span><span className="text-blue-300">{cr.recent_count} comps</span></div>
          )}
        </div>
      </div>
    );
  }

  if (strategy === 'ground_up' && story.recently_delivered_count != null) {
    return (
      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Lease-Up Achievement</span>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {story.recently_delivered_count > 0
              ? <><span className="text-emerald-300 font-semibold">{story.recently_delivered_count} recently-delivered</span> comp{story.recently_delivered_count !== 1 ? 's' : ''} (vintage ≤ 3 yr) — highlighted below as lease-up benchmarks.</>
              : 'No comps with vintage ≤ 3 years found in pool. Consider widening radius or date range.'}
          </div>
        </div>
      </div>
    );
  }

  if (strategy === 'redevelopment' && story.obsolete_vintage_count != null) {
    return (
      <div className="bg-purple-500/8 border border-purple-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-purple-400">Repositioning Potential</span>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {story.obsolete_vintage_count > 0
              ? <><span className="text-purple-300 font-semibold">{story.obsolete_vintage_count} obsolete-vintage</span> comp{story.obsolete_vintage_count !== 1 ? 's' : ''} (age ≥ 30 yr) — highlighted below as repositioning comps.</>
              : 'No comps with vintage ≥ 30 years found in pool.'}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function CompsModule({
  deal,
  dealId: propDealId,
  embedded = false,
  onUpdate,
  onBack
}: CompsModuleProps) {
  const dealId = deal?.id || propDealId;
  const [activeTab, setActiveTab] = useState<'grid' | 'patterns' | 'cap-rates'>('grid');
  const [loading, setLoading] = useState(true);
  const [compSet, setCompSet] = useState<CompSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [strategy, setStrategy] = useState<InvestmentStrategy>('stabilized');
  const [reranking, setReranking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (dealId) loadCompData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const loadCompData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/deals/${dealId}/comps/ranked?strategy=${strategy}`);
      if (response.success && response.data) {
        setCompSet(response.data);
      } else {
        setCompSet(null);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError(null);
        setCompSet(null);
      } else {
        setError(err.message || 'Failed to load comp data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyChange = async (newStrategy: InvestmentStrategy) => {
    setStrategy(newStrategy);
    if (!compSet) return;
    try {
      setReranking(true);
      const response = await apiClient.get(`/deals/${dealId}/comps/ranked?strategy=${newStrategy}`);
      if (response.success && response.data) setCompSet(response.data);
    } catch {
    } finally {
      setReranking(false);
    }
  };

  const handleGenerateComps = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await apiClient.post(`/deals/${dealId}/comps/generate`, {
        radius_miles: 3.0,
        date_range_months: 24,
        min_units: 50,
        max_units: 500,
        exclude_distress: true,
        arms_length_only: true,
        strategy,
      });
      if (response.success) {
        // Re-fetch from /ranked so we always get geographic tier labels + proper top-N
        const rankedResponse = await apiClient.get(`/deals/${dealId}/comps/ranked?strategy=${strategy}`);
        if (rankedResponse.success && rankedResponse.data) {
          setCompSet(rankedResponse.data);
        } else if (response.data) {
          setCompSet(response.data);
        }
        setShowAll(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate comp set');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatPercent = (value: number) => (value * 100).toFixed(2) + '%';

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const displayedComps = () => {
    if (!compSet?.comps) return [];
    if (showAll || !compSet.top_comp_ids?.length) return compSet.comps;
    const topSet = new Set(compSet.top_comp_ids);
    const top = compSet.comps.filter(c => topSet.has(c.id));
    return top.length > 0 ? top : compSet.comps.slice(0, DEFAULT_TOP_COUNT);
  };

  const hiddenCount = () => {
    if (!compSet?.comps) return 0;
    return compSet.comps.length - displayedComps().length;
  };

  const renderGridTab = () => {
    if (!compSet) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <MapPin className="w-12 h-12 mb-4 text-gray-600" />
          <p className="text-sm text-gray-400 mb-4">No comp set available</p>
          <button
            onClick={handleGenerateComps}
            disabled={generating}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm font-medium rounded transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Comp Set'}
          </button>
          <p className="text-xs text-gray-500 mt-3">3-mile radius · 24 months · Multifamily only</p>
        </div>
      );
    }

    const comps = displayedComps();
    const hidden = hiddenCount();

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span>Comp Count</span>
            </div>
            <div className="text-2xl font-bold text-gray-300">{compSet.comp_count}</div>
            <div className="text-xs text-gray-500 mt-1">Sales in last 24 mo</div>
            {compSet.comps.length > 0 && (() => {
              const costarCount = compSet.comps.filter(c => c.source === 'costar_upload').length;
              const platformCount = compSet.comps.length - costarCount;
              if (costarCount === 0) return null;
              return (
                <div className="text-[10px] text-gray-600 mt-1">
                  {platformCount} platform · {costarCount} CoStar
                </div>
              );
            })()}
          </div>

          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Median Price/Unit</span>
            </div>
            <div className="text-2xl font-bold text-green-300">{formatCurrency(compSet.median_price_per_unit)}</div>
            <div className="text-xs text-green-500/70 mt-1">
              Range: {formatCurrency(compSet.min_price_per_unit)} – {formatCurrency(compSet.max_price_per_unit)}
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-400 text-xs mb-2">
              <Target className="w-3.5 h-3.5" />
              <span>Median Cap Rate</span>
            </div>
            <div className="text-2xl font-bold text-blue-300">
              {compSet.median_implied_cap_rate ? formatPercent(compSet.median_implied_cap_rate) : 'N/A'}
            </div>
            <div className="text-xs text-blue-500/70 mt-1">Transaction-derived</div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Avg Price/Unit</span>
            </div>
            <div className="text-2xl font-bold text-purple-300">{formatCurrency(compSet.avg_price_per_unit)}</div>
            <div className="text-xs text-purple-500/70 mt-1">
              {compSet.avg_price_per_unit > compSet.median_price_per_unit ? '+' : ''}
              {formatCurrency(compSet.avg_price_per_unit - compSet.median_price_per_unit)} vs median
            </div>
          </div>
        </div>

        {/* Geographic cascade expansion banner */}
        {compSet.cascade_source === 'live' && compSet.comp_story?.cascade && compSet.comp_story.cascade.widened_to !== 'trade_area' && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
            compSet.comp_story.cascade.widened_to === 'submarket'
              ? 'bg-blue-500/8 border-blue-500/25 text-blue-300'
              : 'bg-amber-500/8 border-amber-500/25 text-amber-300'
          }`}>
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">
                {compSet.comp_story.cascade.widened_to === 'submarket'
                  ? 'Widened to submarket'
                  : 'Widened to MSA'}
              </span>
              {' — '}
              {compSet.comp_story.cascade.trade_area_count < compSet.comp_story.cascade.threshold
                ? `Only ${compSet.comp_story.cascade.trade_area_count} trade-area comp${compSet.comp_story.cascade.trade_area_count !== 1 ? 's' : ''} found (threshold: ${compSet.comp_story.cascade.threshold}).`
                : `Insufficient qualifying comps in trade area.`}
              {compSet.comp_story.cascade.submarket_count > 0 && compSet.comp_story.cascade.widened_to === 'msa' && (
                <span> Submarket added {compSet.comp_story.cascade.submarket_count} comp{compSet.comp_story.cascade.submarket_count !== 1 ? 's' : ''}.</span>
              )}
              <span className="ml-1 text-gray-500">
                TA: {compSet.comp_story.cascade.trade_area_count} · SM: {compSet.comp_story.cascade.submarket_count} · MSA: {compSet.comp_story.cascade.msa_count}
              </span>
            </div>
          </div>
        )}

        {/* Strategy story panel */}
        {compSet.comp_story && (
          <CompStoryPanel story={compSet.comp_story} strategy={strategy} comps={compSet.comps} formatCurrency={formatCurrency} formatPercent={formatPercent} />
        )}

        {/* Strategy selector + legend */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Scoring strategy:</span>
            <div className="flex gap-1">
              {(Object.keys(STRATEGY_LABELS) as InvestmentStrategy[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleStrategyChange(s)}
                  disabled={reranking}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    strategy === s
                      ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-gray-500 border border-gray-700 hover:text-gray-300'
                  }`}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              ))}
            </div>
            {reranking && <span className="text-[10px] text-gray-500 italic">Re-ranking...</span>}
          </div>
          <div className="flex items-center gap-2">
            {(['C1', 'C2', 'M1', 'M2'] as const).map(tier => (
              <div key={tier} className="flex items-center gap-1">
                <TierBadge tier={tier} />
              </div>
            ))}
          </div>
        </div>

        {/* Comp Table */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-300">
              Comparable Sales
              {!showAll && hidden > 0 && (
                <span className="text-xs text-gray-500 font-normal ml-2">
                  (top {comps.length} of {compSet.comp_count})
                </span>
              )}
            </h4>
            <span className="text-[10px] text-gray-500">ranked by relevance · {STRATEGY_LABELS[strategy]}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/30">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium w-6">#</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Address</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Tier</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Score</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Date</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Units</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Sale Price</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">$/Unit</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Cap Rate</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Dist</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Geography</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((comp, i) => {
                  const tierColors = comp.relevance_tier ? (TIER_COLORS[comp.relevance_tier] ?? TIER_COLORS.M2) : null;
                  const story = compSet.comp_story;
                  const isRecentlyDelivered = strategy === 'ground_up' && story?.recently_delivered_ids?.includes(comp.id);
                  const isObsoleteVintage   = strategy === 'redevelopment' && story?.obsolete_vintage_ids?.includes(comp.id);
                  const isCurrentCondition  = strategy === 'value_add' && story?.groups?.[0]?.comp_ids.includes(comp.id);
                  const isRenovated         = strategy === 'value_add' && story?.groups?.[1]?.comp_ids.includes(comp.id);
                  return (
                    <tr
                      key={comp.id}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/20 ${
                        i === 0 && comp.relevance_tier === 'M1' ? 'opacity-70' :
                        isRecentlyDelivered ? 'bg-emerald-500/5' :
                        isObsoleteVintage   ? 'bg-purple-500/5' :
                        isCurrentCondition  ? 'bg-amber-500/4' :
                        isRenovated         ? 'bg-emerald-500/4' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-gray-600 tabular-nums">{i + 1}</td>
                      <td className="py-2 px-3 text-gray-300 max-w-[180px] truncate">
                        {comp.property_address}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {comp.relevance_tier && <TierBadge tier={comp.relevance_tier} />}
                          {comp.relevance_factors && <FactorTooltip comp={comp} />}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {comp.relevance_score != null ? (
                          <span className={`font-mono text-[11px] font-bold ${tierColors?.text ?? 'text-gray-400'}`}>
                            {Math.round(comp.relevance_score * 100)}
                          </span>
                        ) : (
                          <span className="text-gray-600">–</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-gray-400">
                        {formatDate(comp.recording_date)}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300">{comp.units}</td>
                      <td className="py-2 px-3 text-right text-gray-300 font-medium">
                        {formatCurrency(comp.derived_sale_price)}
                      </td>
                      <td className="py-2 px-3 text-right text-green-400 font-medium">
                        {formatCurrency(comp.price_per_unit)}
                      </td>
                      <td className="py-2 px-3 text-right text-blue-400">
                        {comp.implied_cap_rate ? formatPercent(comp.implied_cap_rate) : '–'}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-500">
                        {comp.distance_miles.toFixed(1)} mi
                      </td>
                      <td className="py-2 px-3 text-center">
                        {comp.geographic_label ? (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              comp.geographic_tier === 'trade_area'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : comp.geographic_tier === 'submarket'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                            title={comp.source ? `Source: ${SOURCE_LABELS[comp.source] ?? comp.source}` : undefined}
                          >
                            {comp.geographic_label}
                          </span>
                        ) : comp.source ? (
                          <span className="text-[9px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                            {SOURCE_LABELS[comp.source] ?? comp.source}
                          </span>
                        ) : (
                          <span className="text-gray-700">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Show all / collapse */}
          {compSet.comp_count > DEFAULT_TOP_COUNT && (
            <div className="px-4 py-3 border-t border-gray-700 flex justify-center">
              <button
                onClick={() => setShowAll(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show top {DEFAULT_TOP_COUNT} only
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Show all {compSet.comp_count} comps
                    {hidden > 0 && (
                      <span className="text-gray-600">({hidden} more · M1/M2 tier)</span>
                    )}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Regenerate */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerateComps}
            disabled={generating}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 border border-gray-700 text-gray-300 text-sm font-medium rounded transition-colors"
          >
            {generating ? 'Regenerating...' : 'Regenerate Comp Set'}
          </button>
        </div>
      </div>
    );
  };

  const renderPatternsTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-300 mb-3">Transaction Patterns</div>
        <div className="text-xs text-gray-500">
          Coming soon: Velocity shifts, price migration, buyer rotation, and holding period analysis.
        </div>
      </div>
    </div>
  );

  const renderCapRatesTab = () => {
    if (!compSet || !compSet.median_implied_cap_rate) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">Cap rate data unavailable</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-blue-300 mb-1">Transaction-Derived Cap Rate</div>
              <div className="text-xs text-blue-400/80 mb-3">
                Based on actual recorded sales with documentary stamps — ground truth, not broker quotes.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-400/70 mb-1">Median Cap Rate</div>
                  <div className="text-2xl font-bold text-blue-300">
                    {formatPercent(compSet.median_implied_cap_rate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-blue-400/70 mb-1">Average Cap Rate</div>
                  <div className="text-2xl font-bold text-blue-300">
                    {compSet.avg_implied_cap_rate ? formatPercent(compSet.avg_implied_cap_rate) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Cap Rate Intelligence</div>
          <div className="text-xs text-gray-500">
            Coming soon: Cap rate trends by class, vintage, and submarket. Spread vs treasuries.
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400 text-sm">Loading comp data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Sale Comp Intelligence
          </h3>
          <p className="text-xs text-gray-500 mt-1">Transaction intelligence and pattern detection</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300"
          >
            Back
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['grid', 'patterns', 'cap-rates'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-green-400 border-green-400'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">{error}</div>
            </div>
          </div>
        )}
        {activeTab === 'grid'      && renderGridTab()}
        {activeTab === 'patterns'  && renderPatternsTab()}
        {activeTab === 'cap-rates' && renderCapRatesTab()}
      </div>
    </div>
  );
}
