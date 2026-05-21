import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Building2, FileText, Calendar, Layers, Search, X, ChevronDown, ChevronUp,
  ExternalLink, AlertCircle, ArrowLeft, Eye,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LayeredValue<T = unknown> {
  resolved?: T;
  override?: T;
  detected?: T;
  resolvedFrom?: string | string[];
  alertLevel?: string;
  stanceModulated?: boolean;
}

interface PropertyDescription {
  property_name?: LayeredValue<string>;
  address?: LayeredValue<string>;
  msa?: LayeredValue<string>;
  county?: LayeredValue<string>;
  year_built?: LayeredValue<number>;
  year_renovated?: LayeredValue<number>;
  unit_count?: LayeredValue<number>;
  building_count?: LayeredValue<number>;
  stories?: LayeredValue<number>;
  stories_band?: LayeredValue<string>;
  total_sqft?: LayeredValue<number>;
  rentable_sqft?: LayeredValue<number>;
  lot_size_acres?: LayeredValue<number>;
  construction_type?: LayeredValue<string>;
  parking_type?: LayeredValue<string>;
  parking_spaces?: LayeredValue<number>;
  parking_ratio?: LayeredValue<number>;
  asset_class?: LayeredValue<string>;
  property_type?: LayeredValue<string>;
  amenities?: LayeredValue<unknown>;
  zoning_code?: LayeredValue<string>;
  flood_zone?: LayeredValue<string>;
  in_opportunity_zone?: LayeredValue<boolean>;
  narrative?: LayeredValue<string>;
  submarket?: LayeredValue<string>;
}

interface SummaryResponse {
  parcelId: string;
  propertyDescription: PropertyDescription;
  propertyDescriptionMetadata: {
    sources: Record<string, string[]>;
    lastUpdated: string;
  };
}

interface ArchiveFile {
  id: string;
  parcelId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  documentType: string;
  parserStatus: string;
  storageKey: string;
  createdAt: string;
}

interface TimeSeriesPoint { date: string; value: number | null }
interface TimeSeriesResponse {
  parcelId: string;
  series: Record<string, TimeSeriesPoint[]>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolvedVal(lv: LayeredValue | null | undefined): unknown {
  if (!lv) return null;
  return lv.override ?? lv.resolved ?? lv.detected ?? null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

function sourceLabel(sources: string[]): string {
  return sources.map((s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())).join(', ');
}

const DOC_TYPE_COLORS: Record<string, string> = {
  RENT_ROLL:        'bg-blue-900/60 text-blue-300 border-blue-700',
  T12:              'bg-green-900/60 text-green-300 border-green-700',
  BOX_SCORE:        'bg-purple-900/60 text-purple-300 border-purple-700',
  OM:               'bg-amber-900/60 text-amber-300 border-amber-700',
  TAX_BILL:         'bg-red-900/60 text-red-300 border-red-700',
  LEASING_STATS:    'bg-cyan-900/60 text-cyan-300 border-cyan-700',
  CONCESSION_BURNOFF: 'bg-orange-900/60 text-orange-300 border-orange-700',
  AGED_RECEIVABLES: 'bg-pink-900/60 text-pink-300 border-pink-700',
  T30_LTO:          'bg-indigo-900/60 text-indigo-300 border-indigo-700',
  OTHER_INCOME:     'bg-teal-900/60 text-teal-300 border-teal-700',
  OTHER:            'bg-gray-700/60 text-gray-300 border-gray-600',
};

const PARSER_STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  partial: 'text-yellow-400',
  failed:  'text-red-400',
  unparsed: 'text-gray-500',
};

const SIGNAL_LABELS: Record<string, { label: string; unit: string; color: string }> = {
  property_occupancy:           { label: 'Occupancy',       unit: '%',  color: '#22d3ee' },
  property_avg_rent:            { label: 'Avg Rent',        unit: '$',  color: '#a78bfa' },
  property_signing_velocity:    { label: 'Signing Velocity', unit: '/mo', color: '#34d399' },
  property_concession_per_unit: { label: 'Concessions/Unit', unit: '$',  color: '#fb923c' },
};

const ALL_SIGNALS = Object.keys(SIGNAL_LABELS);

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-white font-semibold text-lg leading-tight truncate">
        {value ?? <span className="text-gray-500 text-sm font-normal">—</span>}
      </div>
    </div>
  );
}

function SourceBadge({ sources }: { sources?: string[] }) {
  if (!sources?.length) return <span className="text-gray-600 text-xs">—</span>;
  return (
    <span className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/30 rounded px-1.5 py-0.5">
      {sourceLabel(sources)}
    </span>
  );
}

function Sparkline({
  data, signal,
}: { data: TimeSeriesPoint[]; signal: string }) {
  const meta = SIGNAL_LABELS[signal];
  if (!data.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-center h-40 text-gray-600 text-sm">
        No data
      </div>
    );
  }

  const isPercent = meta.unit === '%';
  const formatY = (v: number) =>
    isPercent ? `${(v * 100).toFixed(1)}%` : meta.unit === '$' ? `$${v.toLocaleString()}` : `${v}${meta.unit}`;

  const chartData = data.map((d) => ({
    date: d.date,
    value: isPercent && d.value !== null ? +(d.value * 100).toFixed(2) : d.value,
  }));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">{meta.label}</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={(v) => isPercent ? `${v}%` : meta.unit === '$' ? `$${v.toLocaleString()}` : String(v)}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#9ca3af', fontSize: 11 }}
            itemStyle={{ color: meta.color, fontSize: 12 }}
            formatter={(v: number) => [formatY(v), meta.label]}
            labelFormatter={(d) => formatDate(d)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={meta.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: meta.color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropertyArchivePage() {
  const { parcelId: rawParcelId = '' } = useParams<{ parcelId: string }>();
  const navigate = useNavigate();

  const parcelId = rawParcelId.replace(/_/g, ' ');

  const [navInput, setNavInput] = useState(rawParcelId);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [fileFilter, setFileFilter] = useState('');
  const [activeDocType, setActiveDocType] = useState<string | null>(null);

  const [timeSeries, setTimeSeries] = useState<TimeSeriesResponse | null>(null);
  const [tsLoading, setTsLoading] = useState(false);

  const [showAllFields, setShowAllFields] = useState(false);

  const [viewingFile, setViewingFile] = useState<ArchiveFile | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);

  const load = useCallback(async (pid: string) => {
    if (!pid) return;

    setSummaryLoading(true);
    setSummaryError(null);
    setFilesLoading(true);
    setFilesError(null);
    setTsLoading(true);

    const [sumRes, filesRes, tsRes] = await Promise.allSettled([
      fetch(`/api/v1/properties/${encodeURIComponent(pid)}/summary`),
      fetch(`/api/v1/archive/files?parcel_id=${encodeURIComponent(pid)}`),
      fetch(`/api/v1/properties/${encodeURIComponent(pid)}/time-series?signals=${ALL_SIGNALS.join(',')}`),
    ]);

    setSummaryLoading(false);
    setFilesLoading(false);
    setTsLoading(false);

    if (sumRes.status === 'fulfilled') {
      const j = await sumRes.value.json();
      if (sumRes.value.ok) setSummary(j);
      else setSummaryError(j.error ?? 'Failed to load property summary');
    } else {
      setSummaryError('Network error loading summary');
    }

    if (filesRes.status === 'fulfilled' && filesRes.value.ok) {
      const j = await filesRes.value.json();
      setFiles(j.files ?? []);
    } else {
      setFilesError('Failed to load files');
    }

    if (tsRes.status === 'fulfilled' && tsRes.value.ok) {
      const j = await tsRes.value.json();
      setTimeSeries(j);
    }
  }, []);

  useEffect(() => {
    load(parcelId);
    setViewingFile(null);
    setSignedUrl(null);
  }, [parcelId, load]);

  const openFile = async (file: ArchiveFile) => {
    setViewingFile(file);
    setSignedUrl(null);
    if (file.mimeType === 'application/pdf') {
      setSignedUrlLoading(true);
      try {
        const res = await fetch(`/api/v1/archive/files/${file.id}/signed-url`);
        if (res.ok) {
          const j = await res.json();
          setSignedUrl(j.url);
        }
      } finally {
        setSignedUrlLoading(false);
      }
    }
  };

  const handleNav = (e: React.FormEvent) => {
    e.preventDefault();
    const val = navInput.trim().replace(/\s+/g, '_');
    if (val) navigate(`/archive/properties/${encodeURIComponent(val)}`);
  };

  const pd = summary?.propertyDescription;
  const sources = summary?.propertyDescriptionMetadata?.sources ?? {};

  const propName = pd?.property_name ? String(resolvedVal(pd.property_name) ?? parcelId) : parcelId;

  const docTypes = [...new Set(files.map((f) => f.documentType))].sort();
  const filteredFiles = files.filter((f) => {
    const matchType = !activeDocType || f.documentType === activeDocType;
    const matchSearch = !fileFilter || f.originalFilename.toLowerCase().includes(fileFilter.toLowerCase());
    return matchType && matchSearch;
  });

  const ALL_FIELDS: Array<{ key: keyof PropertyDescription; label: string }> = [
    { key: 'property_name',     label: 'Property Name' },
    { key: 'address',           label: 'Address' },
    { key: 'msa',               label: 'MSA' },
    { key: 'county',            label: 'County' },
    { key: 'submarket',         label: 'Submarket' },
    { key: 'year_built',        label: 'Year Built' },
    { key: 'year_renovated',    label: 'Year Renovated' },
    { key: 'unit_count',        label: 'Units' },
    { key: 'building_count',    label: 'Buildings' },
    { key: 'stories',           label: 'Stories' },
    { key: 'stories_band',      label: 'Stories Band' },
    { key: 'total_sqft',        label: 'Total SqFt' },
    { key: 'rentable_sqft',     label: 'Rentable SqFt' },
    { key: 'lot_size_acres',    label: 'Lot Size (ac)' },
    { key: 'construction_type', label: 'Construction Type' },
    { key: 'parking_type',      label: 'Parking Type' },
    { key: 'parking_spaces',    label: 'Parking Spaces' },
    { key: 'parking_ratio',     label: 'Parking Ratio' },
    { key: 'asset_class',       label: 'Asset Class' },
    { key: 'property_type',     label: 'Property Type' },
    { key: 'zoning_code',       label: 'Zoning Code' },
    { key: 'flood_zone',        label: 'Flood Zone' },
    { key: 'in_opportunity_zone', label: 'Opportunity Zone' },
    { key: 'amenities',         label: 'Amenities' },
    { key: 'narrative',         label: 'Narrative' },
  ];

  const notFound = !summaryLoading && summaryError?.includes('No property description') && !filesLoading && files.length === 0 && !tsLoading;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Layers className="w-4 h-4" />
          <span>Archive</span>
          <span>/</span>
          <span className="text-gray-200 font-medium">{propName}</span>
        </div>
        <div className="ml-auto">
          <form onSubmit={handleNav} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={navInput}
                onChange={(e) => setNavInput(e.target.value)}
                placeholder="Jump to property…"
                className="bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:border-amber-600 placeholder-gray-600"
              />
            </div>
            <button type="submit" className="bg-amber-700 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded transition-colors">
              Go
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* Empty state */}
        {notFound && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-gray-600" />
            <div className="text-xl text-gray-400">No data found for this property</div>
            <div className="text-gray-600 text-sm">parcel_id: <code className="text-gray-500">{parcelId}</code></div>
          </div>
        )}

        {/* ── Section A — Property Description ─────────────────────────────── */}
        {(summaryLoading || summary || summaryError) && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Property Description</h2>
            </div>

            {summaryLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 h-20 animate-pulse" />
                ))}
              </div>
            )}

            {summaryError && !summaryError.includes('No property description') && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {summaryError}
              </div>
            )}

            {summary && pd && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <StatCard label="Year Built"  value={String(resolvedVal(pd.year_built) ?? '—')}  icon={Calendar} />
                  <StatCard label="Units"        value={String(resolvedVal(pd.unit_count) ?? '—')}  icon={Building2} />
                  <StatCard label="Stories"      value={String(resolvedVal(pd.stories) ?? resolvedVal(pd.stories_band) ?? '—')} icon={Layers} />
                  <StatCard label="Asset Class"  value={String(resolvedVal(pd.asset_class) ?? resolvedVal(pd.property_type) ?? '—')} icon={FileText} />
                </div>

                {pd.narrative && resolvedVal(pd.narrative) && (
                  <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 text-sm leading-relaxed mb-4">
                    {String(resolvedVal(pd.narrative))}
                  </div>
                )}

                <button
                  onClick={() => setShowAllFields((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                >
                  {showAllFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAllFields ? 'Hide' : 'View'} all fields ({ALL_FIELDS.length})
                </button>

                {showAllFields && (
                  <div className="mt-3 border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                          <th className="px-4 py-2 font-medium">Field</th>
                          <th className="px-4 py-2 font-medium">Value</th>
                          <th className="px-4 py-2 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {ALL_FIELDS.map(({ key, label }) => {
                          const lv = pd[key] as LayeredValue | null | undefined;
                          const val = resolvedVal(lv);
                          const src = sources[key];
                          return (
                            <tr key={key} className="hover:bg-gray-800/40 transition-colors">
                              <td className="px-4 py-2 text-gray-400 font-medium whitespace-nowrap">{label}</td>
                              <td className="px-4 py-2 text-gray-200 max-w-xs break-words">
                                {val === null || val === undefined
                                  ? <span className="text-gray-600">—</span>
                                  : typeof val === 'boolean'
                                    ? (val ? 'Yes' : 'No')
                                    : typeof val === 'object'
                                      ? <pre className="text-xs text-gray-400 whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>
                                      : String(val)}
                              </td>
                              <td className="px-4 py-2"><SourceBadge sources={src} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── Section B — Files ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              Files
              {files.length > 0 && <span className="ml-2 text-gray-500 font-normal">({files.length})</span>}
            </h2>
          </div>

          {/* Filters */}
          {files.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  placeholder="Search filenames…"
                  className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 pl-8 pr-8 py-1.5 w-48 focus:outline-none focus:border-amber-600"
                />
                {fileFilter && (
                  <button onClick={() => setFileFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setActiveDocType(null)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${activeDocType === null ? 'bg-gray-700 border-gray-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
              >
                All
              </button>
              {docTypes.map((dt) => (
                <button
                  key={dt}
                  onClick={() => setActiveDocType(activeDocType === dt ? null : dt)}
                  className={`text-xs px-2.5 py-1 rounded border transition-colors ${activeDocType === dt ? 'bg-gray-700 border-gray-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                >
                  {dt}
                </button>
              ))}
            </div>
          )}

          {filesLoading && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg h-14 animate-pulse" />
              ))}
            </div>
          )}

          {filesError && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
              {filesError}
            </div>
          )}

          {!filesLoading && files.length === 0 && !filesError && (
            <div className="text-gray-600 text-sm py-8 text-center border border-gray-800 rounded-lg">
              No files uploaded for this property yet
            </div>
          )}

          {filteredFiles.length > 0 && (
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-2 font-medium">Filename</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Uploaded</th>
                    <th className="px-4 py-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                      onClick={() => openFile(file)}
                    >
                      <td className="px-4 py-2.5 text-gray-200 font-medium max-w-xs truncate">
                        {file.originalFilename}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${DOC_TYPE_COLORS[file.documentType] ?? DOC_TYPE_COLORS.OTHER}`}>
                          {file.documentType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                        {formatBytes(Number(file.sizeBytes))}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${PARSER_STATUS_COLORS[file.parserStatus] ?? 'text-gray-500'}`}>
                          {file.parserStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(file.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Eye className="w-3.5 h-3.5 text-gray-600 hover:text-amber-400 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Section C — Time-Series Sparklines ────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Time-Series</h2>
          </div>

          {tsLoading && (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg h-40 animate-pulse" />
              ))}
            </div>
          )}

          {!tsLoading && timeSeries && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ALL_SIGNALS.map((sig) => (
                <Sparkline key={sig} signal={sig} data={timeSeries.series[sig] ?? []} />
              ))}
            </div>
          )}

          {!tsLoading && !timeSeries && (
            <div className="text-gray-600 text-sm py-8 text-center border border-gray-800 rounded-lg">
              No time-series data for this property
            </div>
          )}
        </section>
      </div>

      {/* ── Inline PDF / File Viewer Overlay ──────────────────────────────── */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex items-center gap-3 bg-gray-900 border-b border-gray-700 px-4 py-3 flex-shrink-0">
            <button onClick={() => { setViewingFile(null); setSignedUrl(null); }} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <span className="text-gray-200 text-sm font-medium truncate flex-1">{viewingFile.originalFilename}</span>
            <span className={`text-xs px-2 py-0.5 rounded border ${DOC_TYPE_COLORS[viewingFile.documentType] ?? DOC_TYPE_COLORS.OTHER}`}>
              {viewingFile.documentType}
            </span>
            {signedUrl && (
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-amber-400 transition-colors" title="Open in new tab">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {signedUrlLoading && (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading viewer…
              </div>
            )}
            {viewingFile.mimeType === 'application/pdf' && signedUrl && (
              <iframe
                src={signedUrl}
                className="w-full h-full"
                title={viewingFile.originalFilename}
              />
            )}
            {viewingFile.mimeType !== 'application/pdf' && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                <FileText className="w-16 h-16 text-gray-700" />
                <div className="text-sm">{viewingFile.originalFilename}</div>
                <div className="text-xs text-gray-600">{formatBytes(Number(viewingFile.sizeBytes))} · {viewingFile.mimeType}</div>
                {signedUrl && (
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="bg-amber-700 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded transition-colors flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Download / Open
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
