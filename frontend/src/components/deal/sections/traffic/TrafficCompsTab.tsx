import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpDown, Download, Filter, Building2, AlertCircle,
  CheckCircle2, Globe, Eye, Car, FileText, Database, ChevronDown, ChevronUp,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';

interface CompProperty {
  property_id: string;
  property_name: string;
  property_address: string;
  units: number;
  occupancy_pct: number;
  weekly_traffic: number;
  weekly_tours: number;
  closing_ratio: number;
  net_leases_per_week: number;
  web_sessions: number;
  visibility_score: number;
  adt: number;
  distance_miles: number;
  data_sources: string[];
  is_subject: boolean;
}

interface CompAverages {
  avg_units: number;
  avg_occupancy: number;
  avg_traffic: number;
  avg_tours: number;
  avg_closing_ratio: number;
  avg_net_leases: number;
  avg_web_sessions: number;
  avg_visibility: number;
  avg_adt: number;
}

interface DealWithData {
  deal_id: string;
  deal_name: string;
  address: string;
  total_units: number;
  snapshot_count: number;
  earliest_week: string;
  latest_week: string;
  avg_traffic: number;
  avg_tours: number;
  avg_closing_ratio: number;
  avg_occ_pct: number;
  is_selected: boolean;
}

interface TrafficCompsTabProps {
  dealId: string;
  onSelectionChange?: () => void;
}

function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { icon: any; label: string; color: string }> = {
    ga: { icon: Globe, label: 'GA', color: 'bg-blue-100 text-blue-700' },
    apartment_locator: { icon: Building2, label: 'AL', color: 'bg-purple-100 text-purple-700' },
    uploaded: { icon: FileText, label: 'Upload', color: 'bg-amber-100 text-amber-700' },
    visibility: { icon: Eye, label: 'Vis', color: 'bg-emerald-100 text-emerald-700' },
    adt: { icon: Car, label: 'DOT', color: 'bg-stone-100 text-stone-700' },
    estimate: { icon: AlertCircle, label: 'Est', color: 'bg-stone-100 text-stone-400' },
  };
  const cfg = config[source] || config.estimate;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-mono ${cfg.color}`}>
      <Icon size={8} /> {cfg.label}
    </span>
  );
}

function formatWeekRange(earliest: string, latest: string) {
  const fmt = (d: string) => {
    if (!d) return '–';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  return `${fmt(earliest)} → ${fmt(latest)}`;
}

export default function TrafficCompsTab({ dealId, onSelectionChange }: TrafficCompsTabProps) {
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [averages, setAverages] = useState<CompAverages | null>(null);
  const [dealsWithData, setDealsWithData] = useState<DealWithData[]>([]);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [showCompGrid, setShowCompGrid] = useState(false);
  const [sortBy, setSortBy] = useState('distance_miles');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minUnits: '',
    maxUnits: '',
    minOccupancy: '',
    maxDistance: '',
  });

  const loadData = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const [compsRes, avgRes, dealsRes] = await Promise.all([
        apiClient.get(`/api/v1/traffic-comps/${dealId}`, {
          params: {
            sortBy,
            sortDir,
            minUnits: filters.minUnits || undefined,
            maxUnits: filters.maxUnits || undefined,
            minOccupancy: filters.minOccupancy || undefined,
            maxDistance: filters.maxDistance || undefined,
          },
        }),
        apiClient.get(`/api/v1/traffic-comps/${dealId}/averages`),
        apiClient.get(`/api/v1/traffic-comps/${dealId}/deals-with-data`),
      ]);
      setComps(compsRes.data.comps || []);
      setAverages(avgRes.data.averages || null);
      const deals: DealWithData[] = dealsRes.data.deals || [];
      setDealsWithData(deals);
      setSelectedDealIds(new Set(deals.filter(d => d.is_selected).map(d => d.deal_id)));
    } catch (err) {
      console.error('[Comps] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [dealId, sortBy, sortDir, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleDealSelection = async (deal: DealWithData) => {
    const next = new Set(selectedDealIds);
    if (next.has(deal.deal_id)) {
      next.delete(deal.deal_id);
    } else {
      next.add(deal.deal_id);
    }
    setSelectedDealIds(next);
    setSavingSelection(true);
    try {
      const selections = Array.from(next).map(id => {
        const d = dealsWithData.find(x => x.deal_id === id);
        return { comp_deal_id: id, comp_deal_name: d?.deal_name };
      });
      await apiClient.put(`/api/v1/traffic-comps/${dealId}/selections`, { selections });
      onSelectionChange?.();
    } catch (err) {
      console.error('[Comps] Selection save failed:', err);
      setSelectedDealIds(selectedDealIds);
    } finally {
      setSavingSelection(false);
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <th
      className="px-3 py-2.5 text-right cursor-pointer hover:bg-[#4d5a4c] transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="text-white/80 text-[10px] font-medium uppercase tracking-wider flex items-center justify-end gap-1">
        {label}
        {sortBy === field && <ArrowUpDown size={10} className="text-white" />}
      </span>
    </th>
  );

  const exportCSV = () => {
    const headers = ['Property', 'Units', 'Occ %', 'Weekly Traffic', 'Tours/Wk', 'Closing %', 'Net Leases/Wk', 'Web Sessions', 'Visibility', 'ADT', 'Distance'];
    const rows = comps.map(c => [
      c.property_name, c.units, (c.occupancy_pct * 100).toFixed(1),
      c.weekly_traffic, c.weekly_tours, (c.closing_ratio * 100).toFixed(1),
      c.net_leases_per_week.toFixed(1), c.web_sessions, c.visibility_score,
      c.adt, c.distance_miles.toFixed(1),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comp-traffic-grid-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-stone-500 text-sm">Loading comp traffic data...</p>
      </div>
    );
  }

  const selectedCount = selectedDealIds.size;

  return (
    <div className="space-y-4">

      {/* Pattern Sources Panel */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between" style={{ backgroundColor: '#f8f7f4' }}>
          <div className="flex items-center gap-2">
            <Database size={14} className="text-stone-600" />
            <span className="text-sm font-semibold text-stone-800">Regional Pattern Sources</span>
            {selectedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 size={9} /> {selectedCount} active
              </span>
            )}
            {savingSelection && (
              <span className="text-[10px] text-stone-400 font-mono">saving...</span>
            )}
          </div>
          <p className="text-[11px] text-stone-500">
            Check deals to use their historical patterns as the projection baseline
          </p>
        </div>

        {dealsWithData.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Building2 size={28} className="mx-auto text-stone-300 mb-2" />
            <p className="text-sm text-stone-500">No other deals with traffic history found.</p>
            <p className="text-xs text-stone-400 mt-1">Upload weekly reports for comparable deals to enable comp-calibrated projections.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="px-4 py-2 text-left w-8">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Deal / Property</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Units</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Data Range</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Weeks</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Avg Traffic/Wk</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Avg Tours/Wk</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Avg Close %</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Avg Occ %</th>
                </tr>
              </thead>
              <tbody>
                {dealsWithData.map((deal, i) => {
                  const isSelected = selectedDealIds.has(deal.deal_id);
                  return (
                    <tr
                      key={deal.deal_id}
                      onClick={() => toggleDealSelection(deal)}
                      className={`border-b border-stone-100 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 hover:bg-emerald-100'
                          : i % 2 === 0 ? 'bg-white hover:bg-stone-50' : 'bg-stone-50/40 hover:bg-stone-100/60'
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className={`font-medium ${isSelected ? 'text-emerald-900' : 'text-stone-800'}`}>{deal.deal_name}</div>
                        {deal.address && <div className="text-[10px] text-stone-400 truncate max-w-[220px]">{deal.address}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700">{deal.total_units || '–'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-500 text-[10px]">{formatWeekRange(deal.earliest_week, deal.latest_week)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700">{deal.snapshot_count}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700">{deal.avg_traffic.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700">{deal.avg_tours.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700">
                        {deal.avg_closing_ratio ? `${(deal.avg_closing_ratio * 100).toFixed(1)}%` : '–'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700">
                        {deal.avg_occ_pct ? `${(deal.avg_occ_pct * 100).toFixed(1)}%` : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedCount > 0 && (
          <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span className="text-[11px] text-emerald-800 font-medium">
              Projection baseline is calibrated from {selectedCount} comp deal{selectedCount !== 1 ? 's' : ''}.
              Traffic, seasonal patterns, and trend rates are derived from their historical data and scaled to this deal's unit count.
            </span>
          </div>
        )}
      </div>

      {/* Trade Area Comp Grid (toggle) */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <button
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
          onClick={() => setShowCompGrid(!showCompGrid)}
        >
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-stone-500" />
            <span className="text-sm font-semibold text-stone-700">Trade Area Comp Grid</span>
            {comps.length > 0 && (
              <span className="text-[10px] text-stone-400 font-mono">{comps.length} properties</span>
            )}
          </div>
          {showCompGrid ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
        </button>

        {showCompGrid && (
          <>
            <div className="px-4 pb-3 border-t border-stone-100 pt-3 flex items-center justify-between">
              <div className="text-xs text-stone-500">{comps.length} comparable properties in trade area</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    showFilters ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <Filter size={12} /> Filters
                </button>
                {comps.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs hover:bg-stone-200 transition-colors"
                  >
                    <Download size={12} /> Export
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="px-4 pb-3 grid grid-cols-4 gap-3 border-b border-stone-100">
                <div>
                  <label className="text-[10px] text-stone-500 uppercase mb-1 block">Min Units</label>
                  <input
                    type="number"
                    value={filters.minUnits}
                    onChange={e => setFilters(p => ({ ...p, minUnits: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase mb-1 block">Max Units</label>
                  <input
                    type="number"
                    value={filters.maxUnits}
                    onChange={e => setFilters(p => ({ ...p, maxUnits: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase mb-1 block">Min Occupancy %</label>
                  <input
                    type="number"
                    value={filters.minOccupancy}
                    onChange={e => setFilters(p => ({ ...p, minOccupancy: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase mb-1 block">Max Distance (mi)</label>
                  <input
                    type="number"
                    value={filters.maxDistance}
                    onChange={e => setFilters(p => ({ ...p, maxDistance: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg"
                    placeholder="5"
                  />
                </div>
              </div>
            )}

            {comps.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <AlertCircle size={24} className="mx-auto text-stone-300 mb-2" />
                <p className="text-sm text-stone-500">No trade area comp snapshot data yet.</p>
                <p className="text-xs text-stone-400 mt-1">Use the snapshot action to pull traffic data for nearby properties.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: '#3C4A3B' }}>
                      <th className="sticky left-0 z-10 text-left px-4 py-2.5 min-w-[180px]" style={{ backgroundColor: '#3C4A3B' }}>
                        <span className="text-white/80 text-[10px] font-medium uppercase tracking-wider">Property</span>
                      </th>
                      <SortHeader field="units" label="Units" />
                      <SortHeader field="occupancy_pct" label="Occ %" />
                      <SortHeader field="weekly_traffic" label="Traffic/Wk" />
                      <SortHeader field="weekly_tours" label="Tours/Wk" />
                      <SortHeader field="closing_ratio" label="Close %" />
                      <SortHeader field="net_leases_per_week" label="Net/Wk" />
                      <SortHeader field="web_sessions" label="Web" />
                      <SortHeader field="visibility_score" label="Vis" />
                      <SortHeader field="adt" label="ADT" />
                      <SortHeader field="distance_miles" label="Dist" />
                      <th className="px-3 py-2.5 text-right">
                        <span className="text-white/80 text-[10px] font-medium uppercase tracking-wider">Sources</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comps.map((comp, i) => (
                      <tr
                        key={comp.property_id}
                        className={`border-b border-stone-100 ${
                          comp.is_subject
                            ? 'bg-amber-50 font-medium'
                            : i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'
                        }`}
                      >
                        <td className={`sticky left-0 z-10 px-4 py-2 text-[11px] border-r border-stone-100 ${comp.is_subject ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}>
                          <div className="text-stone-900 font-medium truncate max-w-[160px]">{comp.property_name}</div>
                          {comp.is_subject && <span className="text-[9px] text-amber-600 font-mono">SUBJECT</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.units || '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.occupancy_pct ? `${(comp.occupancy_pct * 100).toFixed(1)}%` : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.weekly_traffic || '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.weekly_tours || '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.closing_ratio ? `${(comp.closing_ratio * 100).toFixed(1)}%` : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.net_leases_per_week ? comp.net_leases_per_week.toFixed(1) : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.web_sessions ? comp.web_sessions.toLocaleString() : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">
                          {comp.visibility_score ? (
                            <span className={`${comp.visibility_score >= 70 ? 'text-emerald-700' : comp.visibility_score >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                              {comp.visibility_score}
                            </span>
                          ) : '–'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.adt ? `${(comp.adt / 1000).toFixed(0)}K` : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-800">{comp.distance_miles ? `${comp.distance_miles.toFixed(1)} mi` : '–'}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center gap-0.5 justify-end flex-wrap">
                            {(comp.data_sources || []).map((s, j) => <SourceBadge key={j} source={s} />)}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {averages && (
                      <tr className="bg-stone-100 border-t-2 border-stone-300 font-medium">
                        <td className="sticky left-0 z-10 bg-stone-100 px-4 py-2 text-[11px] text-stone-700 border-r border-stone-200">
                          Trade Area Average
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_units ? Math.round(averages.avg_units) : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_occupancy ? `${(averages.avg_occupancy * 100).toFixed(1)}%` : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_traffic ? Math.round(averages.avg_traffic) : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_tours ? Math.round(averages.avg_tours) : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_closing_ratio ? `${(averages.avg_closing_ratio * 100).toFixed(1)}%` : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_net_leases ? averages.avg_net_leases.toFixed(1) : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_web_sessions ? Math.round(averages.avg_web_sessions).toLocaleString() : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_visibility ? Math.round(averages.avg_visibility) : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700">{averages.avg_adt ? `${(averages.avg_adt / 1000).toFixed(0)}K` : '–'}</td>
                        <td className="px-3 py-2 text-right font-mono text-stone-700" colSpan={2}>–</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
