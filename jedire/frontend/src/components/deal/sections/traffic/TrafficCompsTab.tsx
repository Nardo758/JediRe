import { useState, useEffect } from 'react';
import {
  ArrowUpDown, Download, Filter, Building2, AlertCircle,
  CheckCircle2, Globe, Eye, Car, FileText,
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

interface TrafficCompsTabProps {
  dealId: string;
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

export default function TrafficCompsTab({ dealId }: TrafficCompsTabProps) {
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [averages, setAverages] = useState<CompAverages | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('distance_miles');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minUnits: '',
    maxUnits: '',
    minOccupancy: '',
    maxDistance: '',
  });

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    Promise.all([
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
    ])
      .then(([compsRes, avgRes]) => {
        setComps(compsRes.data.comps || []);
        setAverages(avgRes.data.averages || null);
      })
      .catch(err => console.error('[Comps] Load failed:', err))
      .finally(() => setLoading(false));
  }, [dealId, sortBy, sortDir, filters]);

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

  if (comps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <Building2 size={32} className="mx-auto text-stone-300 mb-3" />
        <h3 className="text-sm font-semibold text-stone-700 mb-2">No Comparable Properties Found</h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          Define a trade area and ensure comparable properties have traffic data uploaded to see the comp grid.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-stone-500">{comps.length} comparable properties in trade area</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              showFilters ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Filter size={12} /> Filters
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs hover:bg-stone-200"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 grid grid-cols-4 gap-3">
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
              placeholder="1000"
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

      <div className="overflow-x-auto rounded-lg border border-stone-200">
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
    </div>
  );
}
