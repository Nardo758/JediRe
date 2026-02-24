import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Database,
  MapPin,
  Building2,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Globe,
  Layers,
} from 'lucide-react';

interface DataTrackerData {
  completenessScore: number;
  summary: {
    municipalities: {
      total: number;
      withData: number;
      withApiOnly: number;
      noApi: number;
    };
    zoning: {
      totalDistricts: number;
      municipalitiesWithData: number;
      statesWithData: number;
      apiSourced: number;
      aiSourced: number;
      manualSourced: number;
    };
    properties: {
      total: number;
      citiesCovered: number;
      statesCovered: number;
    };
    rentComps: {
      total: number;
      marketsCovered: number;
    };
    deals: {
      total: number;
      active: number;
    };
    propertyTypes: {
      total: number;
      enabled: number;
      categories: number;
    };
    dataLibrary: {
      totalFiles: number;
    };
  };
  municipalities: Array<{
    name: string;
    state: string;
    has_api: boolean;
    api_type: string | null;
    total_zoning_districts: number;
    data_quality: string;
    last_scraped_at: string | null;
    coverage_status: string;
  }>;
  stateBreakdown: Array<{
    state: string;
    total_municipalities: number;
    with_data: number;
    with_api: number;
    total_districts: number;
  }>;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; classes: string }> = {
    has_data: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Has Data',
      classes: 'bg-green-100 text-green-700 border-green-200',
    },
    api_available: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: 'API Available',
      classes: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
    no_api: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: 'No API',
      classes: 'bg-gray-100 text-gray-500 border-gray-200',
    },
  };

  const c = config[status] || config.no_api;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.classes}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function DataTrackerPage() {
  const [data, setData] = useState<DataTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/v1/admin/data-tracker');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data tracker');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleState = (state: string) => {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">Failed to load data</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { summary, municipalities, stateBreakdown, completenessScore } = data;

  const filteredMunicipalities =
    filterStatus === 'all'
      ? municipalities
      : municipalities.filter((m) => m.coverage_status === filterStatus);

  const municipalitiesByState = filteredMunicipalities.reduce(
    (acc, m) => {
      if (!acc[m.state]) acc[m.state] = [];
      acc[m.state].push(m);
      return acc;
    },
    {} as Record<string, typeof municipalities>,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              to="/admin"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Data Tracker</h1>
          </div>
          <p className="text-gray-500 text-sm ml-8">
            Track data coverage, completeness, and needs across the platform
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Completeness Score + KPI Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
            <div className="text-sm font-medium text-gray-500 mb-3">
              Data Completeness
            </div>
            <ScoreRing score={completenessScore} />
            <div className="text-xs text-gray-400 mt-3 text-center">
              Based on municipal coverage, zoning, properties, comps &amp; library
            </div>
          </div>

          <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard
              icon={<Globe className="w-5 h-5 text-blue-600" />}
              label="Municipalities"
              value={summary.municipalities.total}
              sub={`${summary.municipalities.withData} with data`}
              color="bg-blue-50"
            />
            <KpiCard
              icon={<Layers className="w-5 h-5 text-emerald-600" />}
              label="Zoning Districts"
              value={summary.zoning.totalDistricts.toLocaleString()}
              sub={`${summary.zoning.municipalitiesWithData} cities covered`}
              color="bg-emerald-50"
            />
            <KpiCard
              icon={<Building2 className="w-5 h-5 text-purple-600" />}
              label="Properties"
              value={summary.properties.total.toLocaleString()}
              sub={`${summary.properties.citiesCovered} cities`}
              color="bg-purple-50"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-orange-600" />}
              label="Rent Comps"
              value={summary.rentComps.total}
              sub={`${summary.rentComps.marketsCovered} markets`}
              color="bg-orange-50"
            />
            <KpiCard
              icon={<MapPin className="w-5 h-5 text-rose-600" />}
              label="Active Deals"
              value={summary.deals.active}
              sub={`${summary.deals.total} total`}
              color="bg-rose-50"
            />
            <KpiCard
              icon={<FileText className="w-5 h-5 text-cyan-600" />}
              label="Data Library"
              value={summary.dataLibrary.totalFiles}
              sub={`${summary.propertyTypes.enabled} property types`}
              color="bg-cyan-50"
            />
          </div>
        </div>

        {/* Zoning Data Sources Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Zoning Data Sources
          </h2>
          <div className="flex items-center gap-2 h-6 rounded-full overflow-hidden bg-gray-100">
            {summary.zoning.apiSourced > 0 && (
              <div
                className="h-full bg-blue-500 rounded-l-full flex items-center justify-center text-[10px] text-white font-medium"
                style={{
                  width: `${(summary.zoning.apiSourced / Math.max(summary.zoning.totalDistricts, 1)) * 100}%`,
                  minWidth: 40,
                }}
              >
                API ({summary.zoning.apiSourced})
              </div>
            )}
            {summary.zoning.aiSourced > 0 && (
              <div
                className="h-full bg-purple-500 flex items-center justify-center text-[10px] text-white font-medium"
                style={{
                  width: `${(summary.zoning.aiSourced / Math.max(summary.zoning.totalDistricts, 1)) * 100}%`,
                  minWidth: 40,
                }}
              >
                AI ({summary.zoning.aiSourced})
              </div>
            )}
            {summary.zoning.manualSourced > 0 && (
              <div
                className="h-full bg-gray-400 rounded-r-full flex items-center justify-center text-[10px] text-white font-medium"
                style={{
                  width: `${(summary.zoning.manualSourced / Math.max(summary.zoning.totalDistricts, 1)) * 100}%`,
                  minWidth: 40,
                }}
              >
                Manual ({summary.zoning.manualSourced})
              </div>
            )}
          </div>
          <div className="flex gap-6 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Municipal APIs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              AI-Retrieved (Claude)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              Manual / Seeded
            </span>
          </div>
        </div>

        {/* State Coverage Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Coverage by State
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {stateBreakdown.map((s) => {
              const pct =
                s.total_municipalities > 0
                  ? Math.round(
                      (parseInt(String(s.with_data)) /
                        parseInt(String(s.total_municipalities))) *
                        100,
                    )
                  : 0;
              return (
                <div
                  key={s.state}
                  className="border border-gray-200 rounded-lg p-3 text-center hover:border-blue-300 transition-colors"
                >
                  <div className="text-lg font-bold text-gray-900">
                    {s.state}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {parseInt(String(s.with_data))}/{parseInt(String(s.total_municipalities))} cities
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {parseInt(String(s.total_districts)) || 0} districts
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Municipality Detail Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              Municipal Zoning Coverage
            </h2>
            <div className="flex gap-2">
              {(['all', 'has_data', 'api_available', 'no_api'] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterStatus === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all'
                      ? `All (${municipalities.length})`
                      : f === 'has_data'
                        ? `Has Data (${summary.municipalities.withData})`
                        : f === 'api_available'
                          ? `API Only (${summary.municipalities.withApiOnly})`
                          : `No API (${summary.municipalities.noApi})`}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {Object.entries(municipalitiesByState)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([state, cities]) => (
                <div key={state}>
                  <button
                    onClick={() => toggleState(state)}
                    className="w-full px-6 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    {expandedStates.has(state) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-semibold text-gray-700">
                      {state}
                    </span>
                    <span className="text-xs text-gray-400">
                      {cities.length}{' '}
                      {cities.length === 1 ? 'city' : 'cities'}
                    </span>
                  </button>

                  {expandedStates.has(state) && (
                    <div className="px-6 pb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase tracking-wider">
                            <th className="text-left py-2 font-medium">
                              Municipality
                            </th>
                            <th className="text-left py-2 font-medium">
                              Status
                            </th>
                            <th className="text-right py-2 font-medium">
                              Districts
                            </th>
                            <th className="text-left py-2 font-medium">
                              API Type
                            </th>
                            <th className="text-left py-2 font-medium">
                              Quality
                            </th>
                            <th className="text-left py-2 font-medium">
                              Last Updated
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {cities.map((m) => (
                            <tr
                              key={m.name}
                              className="hover:bg-gray-50"
                            >
                              <td className="py-2 font-medium text-gray-900">
                                {m.name}
                              </td>
                              <td className="py-2">
                                <StatusBadge status={m.coverage_status} />
                              </td>
                              <td className="py-2 text-right font-mono text-gray-700">
                                {m.total_zoning_districts || 0}
                              </td>
                              <td className="py-2 text-gray-500">
                                {m.api_type ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                                    {m.api_type.toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                              <td className="py-2">
                                {m.data_quality ? (
                                  <span
                                    className={`text-xs font-medium ${
                                      m.data_quality === 'good' || m.data_quality === 'excellent'
                                        ? 'text-green-600'
                                        : m.data_quality === 'fair'
                                          ? 'text-yellow-600'
                                          : 'text-gray-400'
                                    }`}
                                  >
                                    {m.data_quality.charAt(0).toUpperCase() +
                                      m.data_quality.slice(1)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                              <td className="py-2 text-xs text-gray-400">
                                {m.last_scraped_at
                                  ? new Date(
                                      m.last_scraped_at,
                                    ).toLocaleDateString()
                                  : 'Never'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Data Needs Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Data Needs &amp; Gaps
          </h2>
          <div className="space-y-3">
            {summary.municipalities.noApi > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-red-800">
                    {summary.municipalities.noApi} municipalities without API
                    connections
                  </div>
                  <div className="text-xs text-red-600 mt-0.5">
                    These cities need Municode data upload or manual zoning code
                    entry
                  </div>
                </div>
              </div>
            )}
            {summary.municipalities.withApiOnly > 0 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-yellow-800">
                    {summary.municipalities.withApiOnly} municipalities with API
                    but no data fetched
                  </div>
                  <div className="text-xs text-yellow-600 mt-0.5">
                    Run the zoning fetch script to pull data from these
                    endpoints
                  </div>
                </div>
              </div>
            )}
            {summary.rentComps.total < 50 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-orange-800">
                    Rent comp coverage is limited ({summary.rentComps.total}{' '}
                    comps)
                  </div>
                  <div className="text-xs text-orange-600 mt-0.5">
                    Expand rent comp data across more markets for better
                    analysis
                  </div>
                </div>
              </div>
            )}
            {summary.dataLibrary.totalFiles === 0 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Database className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-blue-800">
                    Data Library is empty
                  </div>
                  <div className="text-xs text-blue-600 mt-0.5">
                    Upload historical property data to enable Opus AI comparable
                    matching
                  </div>
                </div>
              </div>
            )}
            {summary.municipalities.withData > 0 &&
              summary.zoning.totalDistricts > 100 &&
              summary.properties.total > 0 && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-green-800">
                      Core data foundation is in place
                    </div>
                    <div className="text-xs text-green-600 mt-0.5">
                      {summary.zoning.totalDistricts} zoning districts across{' '}
                      {summary.zoning.municipalitiesWithData} cities with{' '}
                      {summary.properties.total} properties loaded
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
