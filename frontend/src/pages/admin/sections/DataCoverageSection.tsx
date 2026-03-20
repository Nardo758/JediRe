import React, { useEffect, useState } from 'react';
import {
  Map, RefreshCw, Database, BarChart3, CheckCircle2,
  XCircle, Globe, Layers, ExternalLink, Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../services/api.client';

interface ZoningCoverage {
  coverage: { total_properties: number; properties_with_zoning: number; coverage_pct: number };
  by_state: Array<{ state: string; total_districts: number; municipalities: string }>;
}

interface BenchmarkStats {
  total: number;
  by_state: Array<{ state: string; cnt: string }>;
  by_type: Array<{ project_type: string; cnt: string }>;
  by_entitlement: Array<{ entitlement_type: string; cnt: string; avg_days: string; avg_units: string }>;
}

interface Municipality {
  id: string;
  name: string;
  state: string;
  has_api: boolean;
  api_type: string | null;
  total_zoning_districts: number;
  data_quality: string | null;
  last_scraped_at: string | null;
  actual_districts: string;
}

interface ApartmentLocatorStatus {
  connection: { url: string; api_key_configured: boolean; health: string };
  local_stats: { local_properties: number; recent_syncs: any[] } | null;
}

export function DataCoverageSection() {
  const [coverage, setCoverage] = useState<ZoningCoverage | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkStats | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [muniCount, setMuniCount] = useState(0);
  const [aptStatus, setAptStatus] = useState<ApartmentLocatorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<Record<string, number> | null>(null);
  const [showMuniTable, setShowMuniTable] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [covRes, benchRes, muniRes, aptRes] = await Promise.all([
        apiClient.get('/api/v1/admin/data/zoning-coverage'),
        apiClient.get('/api/v1/admin/data/benchmark-stats'),
        apiClient.get('/api/v1/admin/data/municipalities'),
        apiClient.get('/api/v1/admin/integrations/apartment-locator-ai').catch(() => null),
      ]);
      setCoverage(covRes.data);
      setBenchmarks(benchRes.data);
      setMunicipalities(muniRes.data.municipalities);
      setMuniCount(muniRes.data.count);
      if (aptRes) setAptStatus(aptRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data coverage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const refreshCache = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await apiClient.post('/api/v1/admin/data/refresh-cache');
      setRefreshResult(res.data.cleared);
    } catch {}
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading data coverage...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium">{error}</p>
        <button onClick={fetchData} className="mt-3 text-sm text-red-600 hover:underline">Retry</button>
      </div>
    );
  }

  const maxDistricts = coverage?.by_state.reduce((max, s) => Math.max(max, s.total_districts), 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Map className="w-5 h-5 text-cyan-600" />
          Data Coverage
        </h2>
        <div className="flex gap-2">
          <button
            onClick={refreshCache}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {refreshing ? 'Clearing...' : 'Refresh Cache'}
          </button>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>
      </div>

      {refreshResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Cache cleared: {Object.entries(refreshResult).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v} rows`).join(', ')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coverage && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Zoning Coverage</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-1">{coverage.coverage.coverage_pct}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, coverage.coverage.coverage_pct)}%` }} />
            </div>
            <div className="text-xs text-gray-500">
              {coverage.coverage.properties_with_zoning.toLocaleString()} / {coverage.coverage.total_properties.toLocaleString()} properties
            </div>
          </div>
        )}

        {benchmarks && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Benchmarks</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">{benchmarks.total.toLocaleString()}</div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {benchmarks.by_state.slice(0, 3).map((s) => (
                <div key={s.state}>{s.state}: {s.cnt}</div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Municipalities</span>
          </div>
          <div className="text-2xl font-bold text-purple-600 mb-1">{muniCount}</div>
          <div className="text-xs text-gray-500">
            {municipalities.filter(m => m.has_api).length} with API access
          </div>
        </div>
      </div>

      {coverage && coverage.by_state.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Zoning Districts by State</h3>
          <div className="space-y-2">
            {coverage.by_state.map((s) => (
              <div key={s.state} className="flex items-center gap-3">
                <span className="w-8 text-xs font-medium text-gray-600 text-right">{s.state}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                  <div
                    className="bg-blue-500 h-4 rounded-full transition-all"
                    style={{ width: `${(s.total_districts / maxDistricts) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-xs text-gray-500 text-right">{s.total_districts} districts</span>
                <span className="w-12 text-xs text-gray-400 text-right">{s.municipalities} cities</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {benchmarks && benchmarks.by_entitlement.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Benchmarks by Entitlement Type</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Count</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Avg Days</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Avg Units</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.by_entitlement.map((e) => (
                  <tr key={e.entitlement_type || 'unknown'} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-700 capitalize">{(e.entitlement_type || 'unknown').replace(/_/g, ' ')}</td>
                    <td className="py-1.5 text-right font-medium">{e.cnt}</td>
                    <td className="py-1.5 text-right text-gray-500">{e.avg_days ? Math.round(Number(e.avg_days)) : '--'}</td>
                    <td className="py-1.5 text-right text-gray-500">{e.avg_units ? Math.round(Number(e.avg_units)) : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aptStatus && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            Apartment Locator AI
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Status</div>
              <div className="flex items-center gap-1 mt-1">
                {aptStatus.connection.health === 'connected' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium capitalize">{aptStatus.connection.health}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">API Key</div>
              <div className="text-sm font-medium mt-1">{aptStatus.connection.api_key_configured ? 'Configured' : 'Missing'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Local Properties</div>
              <div className="text-sm font-medium mt-1">{aptStatus.local_stats?.local_properties?.toLocaleString() || '0'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Recent Syncs</div>
              <div className="text-sm font-medium mt-1">{aptStatus.local_stats?.recent_syncs?.length || 0}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Municipalities ({muniCount})
          </h3>
          <button
            onClick={() => setShowMuniTable(!showMuniTable)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showMuniTable ? 'Collapse' : 'Show All'}
          </button>
        </div>
        {showMuniTable && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">API</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Districts</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Quality</th>
                </tr>
              </thead>
              <tbody>
                {municipalities.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 text-gray-700">{m.name}</td>
                    <td className="py-1.5 text-gray-500">{m.state}</td>
                    <td className="py-1.5">
                      {m.has_api ? (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">{m.api_type || 'API'}</span>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-medium">{m.actual_districts}</td>
                    <td className="py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        m.data_quality === 'excellent' ? 'bg-green-100 text-green-700' :
                        m.data_quality === 'good' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{m.data_quality || 'unknown'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link to="/admin/data-tracker" className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          <ExternalLink className="w-3.5 h-3.5" />
          Data Tracker
        </Link>
        <Link to="/admin/property-coverage" className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50">
          <ExternalLink className="w-3.5 h-3.5" />
          Property Coverage
        </Link>
      </div>
    </div>
  );
}
