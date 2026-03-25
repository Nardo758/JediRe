import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, AlertCircle, Play, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface EnrichmentCoverage {
  total_properties: number;
  geocoded: number;
  has_msa: number;
  has_submarket: number;
  has_parcel: number;
  has_market_data: number;
  has_census: number;
}

interface EnrichmentJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_properties: number;
  processed: number;
  errors: number;
  started_at: string | null;
  completed_at: string | null;
}

interface EnrichmentProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  geocoded: boolean;
  has_msa: boolean;
  has_submarket: boolean;
  has_parcel_data: boolean;
}

export function EnrichmentStatusSection() {
  const [coverage, setCoverage] = useState<EnrichmentCoverage | null>(null);
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [properties, setProperties] = useState<EnrichmentProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/enrichment/status');
      setCoverage(res.data.coverage ?? null);
      setJobs(res.data.recent_jobs ?? []);
      setProperties(res.data.properties ?? []);
    } catch {
      setError('Enrichment status endpoint not available yet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runBulkEnrichment = async () => {
    setRunning(true);
    try {
      await apiClient.post('/api/v1/admin/enrichment/enrich-bulk');
      await load();
    } catch {
      setError('Failed to start bulk enrichment');
    } finally {
      setRunning(false);
    }
  };

  const pct = (n: number | undefined, total: number) =>
    total > 0 && n !== undefined ? Math.round((n / total) * 100) : 0;

  const coverageBars = coverage
    ? [
        { label: 'Geocoded', value: pct(coverage.geocoded, coverage.total_properties) },
        { label: 'MSA Assigned', value: pct(coverage.has_msa, coverage.total_properties) },
        { label: 'Submarket Assigned', value: pct(coverage.has_submarket, coverage.total_properties) },
        { label: 'Parcel Data', value: pct(coverage.has_parcel, coverage.total_properties) },
        { label: 'Market Data', value: pct(coverage.has_market_data, coverage.total_properties) },
        { label: 'Census Demographics', value: pct(coverage.has_census, coverage.total_properties) },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Property Enrichment</h2>
          {coverage && (
            <span className="text-xs text-gray-400 ml-1">
              ({coverage.total_properties.toLocaleString()} properties)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runBulkEnrichment}
            disabled={running || loading}
            className="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded px-3 py-1.5"
          >
            <Play className={`w-3 h-3 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Running…' : 'Run Bulk Enrichment'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Coverage bars */}
      {coverageBars.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Enrichment Coverage</h3>
          {coverageBars.map(bar => (
            <div key={bar.label}>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{bar.label}</span>
                <span>{bar.value}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${bar.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent jobs */}
      {jobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Recent Jobs</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processed</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Errors</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Started</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {j.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      {j.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      {j.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
                      {j.status === 'pending' && <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />}
                      <span className="text-xs capitalize text-gray-700">{j.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-600 font-mono">{j.total_properties}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-600 font-mono">{j.processed}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-mono">
                    <span className={j.errors > 0 ? 'text-red-600' : 'text-gray-400'}>{j.errors}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {j.started_at ? new Date(j.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-property table */}
      {properties.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Properties Needing Enrichment</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Geo</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">MSA</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Parcel</th>
              </tr>
            </thead>
            <tbody>
              {properties.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-medium text-gray-900">{p.address}</div>
                    <div className="text-xs text-gray-400">{p.city}, {p.state}</div>
                  </td>
                  {[p.geocoded, p.has_msa, p.has_submarket, p.has_parcel_data].map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      {v
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                        : <XCircle className="w-3.5 h-3.5 text-gray-300 mx-auto" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !coverage && jobs.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg py-10 text-center">
          <Database className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">Enrichment pipeline not yet initialized.</p>
          <p className="text-xs text-gray-400">Click "Run Bulk Enrichment" to start enriching property data.</p>
        </div>
      )}
    </div>
  );
}
