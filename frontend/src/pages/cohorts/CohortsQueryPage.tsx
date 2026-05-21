import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  Layers, Search, X, Download, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, Building2, Users, TrendingUp, ArrowLeft,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AggregatedMetrics {
  avgOccupancy?: number;
  occupancyStdDev?: number;
  avgRent?: number;
  rentStdDev?: number;
  avgConcession?: number;
  concessionStdDev?: number;
  avgUnitCount?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  medianYearBuilt?: number;
}

interface Cohort {
  id: string;
  productType: string | null;
  assetClass: string | null;
  market: string | null;
  vintage: string | null;
  sizeRange: string | null;
  memberCount: number;
  aggregatedMetrics: AggregatedMetrics;
}

interface Member {
  cohortId: string;
  parcelId: string;
  propertyDescription: {
    name: string | null;
    address: string | null;
    assetClass: string | null;
    propertyType: string | null;
    market: string | null;
    yearBuilt: number | null;
    unitCount: number | null;
  };
  currentMetrics: {
    occupancy: number | null;
    avgRent: number | null;
    metricsDate: string | null;
  };
  occupancySparkline: Array<{ date: string; value: number }>;
}

interface Dimensions {
  productTypes: string[];
  assetClasses: string[];
  markets: string[];
  vintages: string[];
  sizeRanges: string[];
}

interface QueryResult {
  cohorts: Cohort[];
  members: Member[];
  totalMembers: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1, prefix = '', suffix = ''): string {
  if (n === null || n === undefined) return '—';
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDollar(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function exportCSV(cohorts: Cohort[], members: Member[]) {
  const cohortById = Object.fromEntries(cohorts.map((c) => [c.id, c]));
  const headers = [
    'Parcel ID', 'Name', 'Product Type', 'Asset Class', 'Market',
    'Vintage', 'Size Range', 'Year Built', 'Units',
    'Current Occupancy', 'Current Avg Rent', 'Metrics Date',
  ];
  const rows = members.map((m) => {
    const c = cohortById[m.cohortId];
    return [
      m.parcelId,
      m.propertyDescription.name ?? '',
      c?.productType ?? '',
      c?.assetClass ?? '',
      c?.market ?? '',
      c?.vintage ?? '',
      c?.sizeRange ?? '',
      m.propertyDescription.yearBuilt ?? '',
      m.propertyDescription.unitCount ?? '',
      m.currentMetrics.occupancy !== null ? (m.currentMetrics.occupancy * 100).toFixed(1) + '%' : '',
      m.currentMetrics.avgRent !== null ? `$${Math.round(m.currentMetrics.avgRent)}` : '',
      m.currentMetrics.metricsDate ?? '',
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cohort-query-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterSelect({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 px-3 py-1.5 focus:outline-none focus:border-amber-600 min-w-[160px]"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MetricPill({
  label, value, stdDev,
}: { label: string; value: string; stdDev?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</span>
      <span className="text-white font-semibold text-lg leading-none">{value}</span>
      {stdDev && <span className="text-xs text-gray-500 mt-0.5">±{stdDev}</span>}
    </div>
  );
}

function OccupancySparkline({
  data, avg,
}: { data: Array<{ date: string; value: number }>; avg?: number }) {
  if (!data.length) {
    return <div className="w-24 h-8 flex items-center justify-center text-gray-700 text-xs">no data</div>;
  }
  const chartData = data.map((d) => ({ ...d, value: +(d.value * 100).toFixed(2) }));
  const refVal = avg !== undefined ? +(avg * 100).toFixed(2) : undefined;
  return (
    <ResponsiveContainer width={96} height={32}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        {refVal !== undefined && (
          <ReferenceLine y={refVal} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, padding: '2px 6px' }}
          labelStyle={{ display: 'none' }}
          itemStyle={{ color: '#22d3ee', fontSize: 11 }}
          formatter={(v: number) => [`${v}%`, 'Occ']}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CohortCard({ cohort, members }: { cohort: Cohort; members: Member[] }) {
  const [expanded, setExpanded] = useState(true);
  const m = cohort.aggregatedMetrics;
  const navigate = useNavigate();

  const label = [cohort.productType, cohort.assetClass, cohort.vintage, cohort.sizeRange]
    .filter(Boolean).join(' · ') || 'Uncategorised';

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Cohort header / stats bar */}
      <div className="bg-gray-800/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-white font-semibold">{label}</div>
            {cohort.market && <div className="text-gray-400 text-sm mt-0.5">{cohort.market}</div>}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-700 px-2.5 py-1 rounded">
              <Users className="w-3 h-3" />
              {cohort.memberCount} {cohort.memberCount === 1 ? 'property' : 'properties'}
            </span>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Aggregated metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <MetricPill
            label="Avg Occupancy"
            value={fmtPct(m.avgOccupancy)}
            stdDev={m.occupancyStdDev !== undefined ? fmtPct(m.occupancyStdDev) : undefined}
          />
          <MetricPill
            label="Avg Rent"
            value={fmtDollar(m.avgRent)}
            stdDev={m.rentStdDev !== undefined ? fmtDollar(m.rentStdDev) : undefined}
          />
          <MetricPill
            label="Avg Concession"
            value={fmtDollar(m.avgConcession)}
            stdDev={m.concessionStdDev !== undefined ? fmtDollar(m.concessionStdDev) : undefined}
          />
          <MetricPill
            label="Avg Unit Count"
            value={m.avgUnitCount !== undefined ? String(Math.round(m.avgUnitCount)) : '—'}
          />
        </div>

        {(m.minYearBuilt || m.medianYearBuilt) && (
          <div className="mt-3 text-xs text-gray-500">
            Year built: {m.minYearBuilt ?? '?'} – {m.maxYearBuilt ?? '?'}
            {m.medianYearBuilt && <> · median {Math.round(m.medianYearBuilt as number)}</>}
          </div>
        )}
      </div>

      {/* Member table */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2 font-medium">Property</th>
                <th className="px-4 py-2 font-medium">Year</th>
                <th className="px-4 py-2 font-medium">Units</th>
                <th className="px-4 py-2 font-medium">Occupancy</th>
                <th className="px-4 py-2 font-medium">Avg Rent</th>
                <th className="px-4 py-2 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-600 text-sm">
                    No members
                  </td>
                </tr>
              )}
              {members.map((mem) => (
                <tr
                  key={mem.parcelId}
                  className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/archive/properties/${encodeURIComponent(mem.parcelId.replace(/\s+/g, '_'))}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="text-gray-200 font-medium truncate max-w-[200px]">
                      {mem.propertyDescription.name ?? mem.parcelId}
                    </div>
                    <div className="text-gray-500 text-xs truncate max-w-[200px]">{mem.parcelId}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {mem.propertyDescription.yearBuilt ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {mem.propertyDescription.unitCount ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {mem.currentMetrics.occupancy !== null ? (
                      <span className={`text-sm font-medium ${(mem.currentMetrics.occupancy ?? 0) >= (m.avgOccupancy ?? 0) ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtPct(mem.currentMetrics.occupancy)}
                      </span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-300 text-sm">
                    {mem.currentMetrics.avgRent !== null ? fmtDollar(mem.currentMetrics.avgRent) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <OccupancySparkline data={mem.occupancySparkline} avg={m.avgOccupancy} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CohortsQueryPage() {
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState<Dimensions>({
    productTypes: [], assetClasses: [], markets: [], vintages: [], sizeRanges: [],
  });

  const [filters, setFilters] = useState({
    product_type: '', asset_class: '', market: '', vintage: '', size_range: '',
  });

  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const hasQueried = useRef(false);

  // Load dimension options on mount
  useEffect(() => {
    fetch('/api/v1/cohorts/dimensions')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j) setDimensions(j); })
      .catch(() => {});
  }, []);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    hasQueried.current = true;
    try {
      const params = new URLSearchParams();
      if (filters.product_type) params.set('product_type', filters.product_type);
      if (filters.asset_class)  params.set('asset_class',  filters.asset_class);
      if (filters.market)       params.set('market',       filters.market);
      if (filters.vintage)      params.set('vintage',      filters.vintage);
      if (filters.size_range)   params.set('size_range',   filters.size_range);

      const res = await fetch(`/api/v1/cohorts/query?${params}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Query failed');
      setResult(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch('/api/v1/cohorts/backfill', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Backfill failed');
      setBackfillMsg(`Backfill complete — ${j.cohortCount} cohorts, ${j.memberCount} members`);
      // Reload dimensions
      const dr = await fetch('/api/v1/cohorts/dimensions');
      if (dr.ok) setDimensions(await dr.json());
    } catch (e: unknown) {
      setBackfillMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfilling(false);
    }
  };

  const clearFilters = () => setFilters({ product_type: '', asset_class: '', market: '', vintage: '', size_range: '' });

  const hasFilters = Object.values(filters).some(Boolean);

  // Group members by cohort_id
  const membersByCohort: Record<string, Member[]> = {};
  for (const m of result?.members ?? []) {
    if (!membersByCohort[m.cohortId]) membersByCohort[m.cohortId] = [];
    membersByCohort[m.cohortId].push(m);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 text-gray-300">
          <Layers className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-sm">Cohort Compare</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {result && result.members.length > 0 && (
            <button
              onClick={() => exportCSV(result.cohorts, result.members)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded transition-colors"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-400 border border-gray-700 hover:border-amber-700 px-3 py-1.5 rounded transition-colors disabled:opacity-40"
            title="Rebuild cohort membership from property_descriptions"
          >
            <RefreshCw className={`w-3 h-3 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Rebuilding…' : 'Rebuild Cohorts'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Backfill message */}
        {backfillMsg && (
          <div className={`text-sm px-4 py-3 rounded border ${backfillMsg.startsWith('Error') ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>
            {backfillMsg}
          </div>
        )}

        {/* ── Filter form ──────────────────────────────────────────────────── */}
        <section className="bg-gray-900 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-amber-500" /> Filters
              <span className="text-gray-600 font-normal normal-case">— all optional</span>
            </h2>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mb-5">
            <FilterSelect label="Product Type" options={dimensions.productTypes} value={filters.product_type} onChange={(v) => setFilters((f) => ({ ...f, product_type: v }))} />
            <FilterSelect label="Asset Class"  options={dimensions.assetClasses} value={filters.asset_class}  onChange={(v) => setFilters((f) => ({ ...f, asset_class: v }))} />
            <FilterSelect label="Market"       options={dimensions.markets}      value={filters.market}       onChange={(v) => setFilters((f) => ({ ...f, market: v }))} />
            <FilterSelect label="Vintage"      options={dimensions.vintages}     value={filters.vintage}      onChange={(v) => setFilters((f) => ({ ...f, vintage: v }))} />
            <FilterSelect label="Size Range"   options={dimensions.sizeRanges}   value={filters.size_range}   onChange={(v) => setFilters((f) => ({ ...f, size_range: v }))} />
          </div>

          <button
            onClick={runQuery}
            disabled={loading}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm px-5 py-2 rounded transition-colors"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Querying…' : 'Run Query'}
          </button>
        </section>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {result && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Results
              </h2>
              <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded">
                {result.cohorts.length} cohort{result.cohorts.length !== 1 ? 's' : ''} · {result.totalMembers} {result.totalMembers === 1 ? 'property' : 'properties'}
              </span>
            </div>

            {result.cohorts.length === 0 ? (
              <div className="border border-gray-800 rounded-lg py-16 text-center space-y-3">
                <Building2 className="w-10 h-10 text-gray-700 mx-auto" />
                <div className="text-gray-500">
                  {hasFilters ? 'No cohorts match the selected filters.' : 'No cohorts found. Run "Rebuild Cohorts" after uploading files.'}
                </div>
              </div>
            ) : (
              result.cohorts.map((cohort) => (
                <CohortCard
                  key={cohort.id}
                  cohort={cohort}
                  members={membersByCohort[cohort.id] ?? []}
                />
              ))
            )}
          </section>
        )}

        {/* Pre-query empty state */}
        {!result && !loading && !error && (
          <div className="border border-gray-800 rounded-lg py-20 text-center space-y-3">
            <Layers className="w-12 h-12 text-gray-700 mx-auto" />
            <div className="text-gray-500 text-sm">Select filters and click Run Query to compare cohorts.</div>
            <div className="text-gray-600 text-xs">Leave all filters blank to return every cohort.</div>
          </div>
        )}
      </div>
    </div>
  );
}
