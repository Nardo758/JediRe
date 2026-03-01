import { useState, useEffect } from 'react';
import {
  Car, Globe, BarChart3, Eye, AlertCircle, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Minus, Link2, Search,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface DataSourceSignals {
  visibility?: {
    overall_score: number;
    capture_rate: number;
    tier: string;
    component_scores?: Record<string, number>;
  };
  traffic_context?: {
    primary_adt: number;
    primary_road_name: string;
    primary_road_classification: string;
    secondary_adt?: number;
    google_realtime_factor: number;
    trend_direction: string;
    trend_pct: number;
  };
  web_traffic?: {
    sessions: number;
    users: number;
    bounce_rate: number;
    score: number;
    is_comp_proxy: boolean;
    proxy_source_count?: number;
    organic_value?: number;
    organic_keywords?: number;
    paid_keywords?: number;
    domain_strength?: number;
  };
  market_intel?: {
    supply_demand_ratio?: number;
    absorption_rate?: number;
    avg_days_to_lease?: number;
    rent_comp_avg?: number;
    concession_rate?: number;
  };
  data_quality: {
    sources_connected: number;
    total_sources: number;
    confidence_level: 'High' | 'Moderate' | 'Low';
    missing_sources: string[];
  };
}

interface TrafficDataSourcesTabProps {
  dealId: string;
  onNavigateToVisibility?: () => void;
}

function StatusBadge({ status, label }: { status: 'connected' | 'proxy' | 'not_connected'; label: string }) {
  const colors = {
    connected: 'bg-emerald-100 text-emerald-700',
    proxy: 'bg-blue-100 text-blue-700',
    not_connected: 'bg-stone-100 text-stone-500',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${colors[status]}`}>
      {label}
    </span>
  );
}

function TrendIndicator({ direction, pct }: { direction: string; pct: number }) {
  if (direction === 'up') return <span className="flex items-center gap-0.5 text-emerald-600 text-xs"><ArrowUpRight size={12} />+{pct.toFixed(1)}%</span>;
  if (direction === 'down') return <span className="flex items-center gap-0.5 text-red-500 text-xs"><ArrowDownRight size={12} />{pct.toFixed(1)}%</span>;
  return <span className="flex items-center gap-0.5 text-stone-400 text-xs"><Minus size={12} />Stable</span>;
}

function MiniBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-stone-500 w-20 truncate">{label}</span>
      <div className="flex-1 bg-stone-100 rounded-full h-1.5">
        <div className="h-full bg-stone-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-stone-700 w-6 text-right">{value}</span>
    </div>
  );
}

export default function TrafficDataSourcesTab({ dealId, onNavigateToVisibility }: TrafficDataSourcesTabProps) {
  const [data, setData] = useState<{
    data_sources: DataSourceSignals;
    trade_area_id?: string;
    trade_area_name?: string;
    warnings?: Array<{ type: string; message: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState('');
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const loadData = () => {
    setLoading(true);
    apiClient.get(`/api/v1/leasing-traffic/data-sources/${dealId}`)
      .then(res => setData(res.data))
      .catch(err => console.error('[DataSources] Load failed:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!dealId) return;
    loadData();
  }, [dealId]);

  const handleConnectDomain = async () => {
    if (!domainInput.trim()) return;
    setConnecting(true);
    try {
      await apiClient.post('/api/v1/property-analytics/connect', {
        propertyId: dealId,
        domain: domainInput.trim(),
      });
      setShowDomainForm(false);
      setDomainInput('');
      loadData();
    } catch (err) {
      console.error('[DataSources] Domain connect failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-stone-500 text-sm">Loading data sources...</p>
      </div>
    );
  }

  const ds = data?.data_sources;
  const quality = ds?.data_quality;
  const hasTradeArea = !!data?.trade_area_id;

  return (
    <div className="space-y-4">
      {!hasTradeArea && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-900">Trade Area Required</div>
            <p className="text-[11px] text-amber-700 mt-1">
              Define a trade area to unlock full traffic intelligence — comp proxy data, market context, and visibility scoring all depend on it.
            </p>
          </div>
        </div>
      )}

      {hasTradeArea && data?.trade_area_name && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span className="text-sm text-emerald-800">
            Trade Area: <strong>{data.trade_area_name}</strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Car size={16} className="text-stone-500" />
              <span className="font-semibold text-stone-900 text-sm">Street Traffic</span>
            </div>
            {ds?.traffic_context ? (
              <StatusBadge status="connected" label="Connected" />
            ) : (
              <StatusBadge status="not_connected" label="No Data" />
            )}
          </div>
          {ds?.traffic_context ? (
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-stone-900">
                  {ds.traffic_context.primary_adt.toLocaleString()}
                  <span className="text-sm font-normal text-stone-500 ml-1">vehicles/day</span>
                </div>
                <div className="text-xs text-stone-500 mt-0.5">{ds.traffic_context.primary_road_name}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-stone-500">
                  Google Real-Time: <strong className="text-stone-900">{ds.traffic_context.google_realtime_factor.toFixed(2)}x</strong>
                </div>
                <TrendIndicator direction={ds.traffic_context.trend_direction} pct={ds.traffic_context.trend_pct} />
              </div>
              <div className="text-[10px] text-stone-400">
                Classification: {ds.traffic_context.primary_road_classification}
                {ds.traffic_context.secondary_adt && (
                  <span className="ml-2">| Secondary: {ds.traffic_context.secondary_adt.toLocaleString()} ADT</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Car size={24} className="mx-auto text-stone-300 mb-2" />
              <p className="text-xs text-stone-400">Upload DOT traffic counts or link property to ADT stations</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-stone-500" />
              <span className="font-semibold text-stone-900 text-sm">Website Traffic</span>
            </div>
            {ds?.web_traffic ? (
              ds.web_traffic.is_comp_proxy ? (
                <StatusBadge status="proxy" label="Using Comps" />
              ) : (
                <StatusBadge status="connected" label="Connected" />
              )
            ) : (
              <StatusBadge status="not_connected" label="Not Connected" />
            )}
          </div>
          {ds?.web_traffic ? (
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-stone-900">
                  {ds.web_traffic.sessions.toLocaleString()}
                  <span className="text-sm font-normal text-stone-500 ml-1">visitors/mo</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                  <span>Score: <strong className="text-stone-800">{ds.web_traffic.score}/100</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-stone-400 uppercase">Organic Keywords</div>
                  <div className="text-sm font-bold text-stone-900">{(ds.web_traffic.organic_keywords || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400 uppercase">Paid Keywords</div>
                  <div className="text-sm font-bold text-stone-900">{(ds.web_traffic.paid_keywords || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Domain Strength: <strong className="text-stone-900">{ds.web_traffic.domain_strength || 0}/100</strong></span>
                <span className="text-stone-500">SEO Value: <strong className="text-stone-900">${Math.round(ds.web_traffic.organic_value || 0).toLocaleString()}</strong></span>
              </div>
              {ds.web_traffic.is_comp_proxy && (
                <div className="bg-blue-50 rounded-lg p-2 text-[11px] text-blue-700">
                  Using comp average from {ds.web_traffic.proxy_source_count} properties in trade area
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              {showDomainForm ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={domainInput}
                    onChange={e => setDomainInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConnectDomain()}
                    placeholder="e.g. solaireapartments.com"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-stone-400"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleConnectDomain}
                      disabled={connecting || !domainInput.trim()}
                      className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs hover:bg-stone-800 disabled:opacity-50"
                    >
                      {connecting ? 'Looking up...' : 'Look Up Domain'}
                    </button>
                    <button
                      onClick={() => { setShowDomainForm(false); setDomainInput(''); }}
                      className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-xs hover:bg-stone-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Search size={24} className="mx-auto text-stone-300 mb-2" />
                  <p className="text-xs text-stone-400 mb-2">Add this property's website domain to track its digital traffic</p>
                  <button
                    onClick={() => setShowDomainForm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs hover:bg-stone-800"
                  >
                    <Link2 size={12} /> Add Website
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-stone-500" />
              <span className="font-semibold text-stone-900 text-sm">Market Intelligence</span>
            </div>
            {ds?.market_intel ? (
              <StatusBadge status="connected" label="Available" />
            ) : (
              <StatusBadge status="not_connected" label="No Data" />
            )}
          </div>
          {ds?.market_intel ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {ds.market_intel.supply_demand_ratio !== undefined && (
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase">Supply/Demand</div>
                    <div className="text-lg font-bold text-stone-900">{ds.market_intel.supply_demand_ratio.toFixed(2)}</div>
                  </div>
                )}
                {ds.market_intel.absorption_rate !== undefined && (
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase">Absorption</div>
                    <div className="text-lg font-bold text-stone-900">{(ds.market_intel.absorption_rate * 100).toFixed(1)}%</div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ds.market_intel.rent_comp_avg !== undefined && (
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase">Rent Comp Avg</div>
                    <div className="text-sm font-bold text-stone-900">${ds.market_intel.rent_comp_avg.toLocaleString()}</div>
                  </div>
                )}
                {ds.market_intel.concession_rate !== undefined && (
                  <div>
                    <div className="text-[10px] text-stone-400 uppercase">Concession Rate</div>
                    <div className="text-sm font-bold text-stone-900">{(ds.market_intel.concession_rate * 100).toFixed(1)}%</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <BarChart3 size={24} className="mx-auto text-stone-300 mb-2" />
              <p className="text-xs text-stone-400">Market data will appear once available for this property's submarket</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-stone-500" />
              <span className="font-semibold text-stone-900 text-sm">Location Visibility</span>
            </div>
            {ds?.visibility ? (
              <StatusBadge status="connected" label="Assessed" />
            ) : (
              <StatusBadge status="not_connected" label="Not Assessed" />
            )}
          </div>
          {ds?.visibility ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-stone-900">{ds.visibility.overall_score}</div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    ds.visibility.tier === 'Excellent' ? 'bg-emerald-100 text-emerald-700' :
                    ds.visibility.tier === 'Good' ? 'bg-blue-100 text-blue-700' :
                    ds.visibility.tier === 'Fair' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{ds.visibility.tier}</span>
                  <div className="text-xs text-stone-500 mt-1">
                    Capture Rate: <strong>{(ds.visibility.capture_rate * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
              {ds.visibility.component_scores && (
                <div className="space-y-1.5">
                  {Object.entries(ds.visibility.component_scores)
                    .filter(([k]) => k !== 'obstruction_penalty')
                    .map(([key, val]) => (
                      <MiniBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={val ?? 0} />
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Eye size={24} className="mx-auto text-stone-300 mb-2" />
              <p className="text-xs text-stone-400 mb-2">Complete a visibility assessment for this property</p>
              <button
                onClick={onNavigateToVisibility}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs hover:bg-stone-800"
              >
                <Eye size={12} /> Assess Property
              </button>
            </div>
          )}
        </div>
      </div>

      {quality && (
        <div className={`rounded-xl border p-4 flex items-center justify-between ${
          quality.confidence_level === 'High' ? 'bg-emerald-50 border-emerald-200' :
          quality.confidence_level === 'Moderate' ? 'bg-amber-50 border-amber-200' :
          'bg-stone-50 border-stone-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              quality.confidence_level === 'High' ? 'bg-emerald-500' :
              quality.confidence_level === 'Moderate' ? 'bg-amber-500' :
              'bg-stone-400'
            }`} />
            <span className="text-sm font-medium text-stone-800">
              {quality.sources_connected}/{quality.total_sources} sources connected
            </span>
          </div>
          <span className={`text-xs font-mono ${
            quality.confidence_level === 'High' ? 'text-emerald-700' :
            quality.confidence_level === 'Moderate' ? 'text-amber-700' :
            'text-stone-500'
          }`}>
            {quality.confidence_level} Confidence
          </span>
        </div>
      )}
    </div>
  );
}
