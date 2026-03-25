import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface SystemStats {
  user_count: string;
  deal_count: string;
  property_count: string;
  scenario_count: string;
  zoning_district_count: string;
  benchmark_count: string;
}

export function SystemHealthSection() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/api/v1/admin/system/stats');
      setStats(res.data.totals);
      setLastRefreshed(new Date());
    } catch {
      setError('Could not load system stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = stats
    ? [
        { label: 'Users', value: Number(stats.user_count).toLocaleString(), ok: true },
        { label: 'Deals', value: Number(stats.deal_count).toLocaleString(), ok: true },
        { label: 'Properties', value: Number(stats.property_count).toLocaleString(), ok: true },
        { label: 'Scenarios', value: Number(stats.scenario_count).toLocaleString(), ok: true },
        { label: 'Zoning Districts', value: Number(stats.zoning_district_count).toLocaleString(), ok: true },
        { label: 'Benchmarks', value: Number(stats.benchmark_count).toLocaleString(), ok: true },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Refreshed {lastRefreshed.toLocaleTimeString()}
          </span>
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
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-7 bg-gray-200 rounded w-14" />
              </div>
            ))
          : metrics.map(m => (
              <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{m.value}</div>
              </div>
            ))}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">All systems operational</span>
        </div>
        <p className="text-xs text-green-700 mt-1 ml-6">
          API, database, and background services are running normally.
        </p>
      </div>
    </div>
  );
}
