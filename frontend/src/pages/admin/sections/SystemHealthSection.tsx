import React, { useEffect, useState } from 'react';
import {
  Activity, Database, Server, HardDrive, RefreshCw,
  CheckCircle2, XCircle, Wifi, Clock, Cpu, MemoryStick,
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface HealthData {
  database: {
    status: string;
    active_connections: string;
    total_connections: string;
    database_size: string;
    uptime: string;
  };
  topTables: Array<{ table_name: string; total_size: string; row_count: number }>;
  server: {
    nodeVersion: string;
    memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
    uptime: number;
  };
}

interface StatsData {
  totals: Record<string, string>;
  recent: { deals_last_7_days: string; users_last_7_days: string };
  scenarios_by_type: Array<{ entitlement_type: string; cnt: string; active: string }>;
}

interface IntegrationResults {
  integrations: Record<string, { status: string; error?: string }>;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function SystemHealthSection() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingIntegrations, setTestingIntegrations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, statsRes] = await Promise.all([
        apiClient.get('/api/v1/admin/system/health'),
        apiClient.get('/api/v1/admin/system/stats'),
      ]);
      setHealth(healthRes.data);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  };

  const testIntegrations = async () => {
    setTestingIntegrations(true);
    try {
      const res = await apiClient.post('/api/v1/admin/integrations/test');
      setIntegrations(res.data);
    } catch {}
    setTestingIntegrations(false);
  };

  useEffect(() => {
    fetchData();
    testIntegrations();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading system health...</span>
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

  const memPct = health ? Math.round((health.server.memoryUsage.heapUsed / health.server.memoryUsage.heapTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          System Health
        </h2>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Database</span>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              health?.database.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {health?.database.status === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Active Connections</span>
              <span className="font-medium">{health?.database.active_connections}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Connections</span>
              <span className="font-medium">{health?.database.total_connections}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Database Size</span>
              <span className="font-medium">{health?.database.database_size}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Server</span>
            <span className="ml-auto text-xs text-gray-500">{health?.server.nodeVersion}</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Uptime</span>
              <span className="font-medium">{health ? formatUptime(health.server.uptime) : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">RSS Memory</span>
              <span className="font-medium">{health ? formatBytes(health.server.memoryUsage.rss) : '--'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Heap Memory</span>
            <span className="ml-auto text-xs font-medium text-gray-600">{memPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className={`h-2.5 rounded-full transition-all ${memPct > 85 ? 'bg-red-500' : memPct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${memPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Used: {health ? formatBytes(health.server.memoryUsage.heapUsed) : '--'}</span>
            <span>Total: {health ? formatBytes(health.server.memoryUsage.heapTotal) : '--'}</span>
          </div>
        </div>
      </div>

      {stats && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Platform Totals</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Users', value: stats.totals.user_count, color: 'text-blue-600' },
              { label: 'Deals', value: stats.totals.deal_count, color: 'text-green-600' },
              { label: 'Properties', value: stats.totals.property_count, color: 'text-purple-600' },
              { label: 'Scenarios', value: stats.totals.scenario_count, color: 'text-orange-600' },
              { label: 'Zoning Districts', value: stats.totals.zoning_district_count, color: 'text-cyan-600' },
              { label: 'Benchmarks', value: stats.totals.benchmark_count, color: 'text-pink-600' },
              { label: 'Municipalities', value: stats.totals.municipality_count, color: 'text-indigo-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className={`text-xl font-bold ${color}`}>{Number(value).toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex gap-6 text-sm">
            <span className="text-gray-500">Last 7 days: <span className="font-medium text-gray-900">{stats.recent.deals_last_7_days} deals</span></span>
            <span className="text-gray-500"><span className="font-medium text-gray-900">{stats.recent.users_last_7_days} new users</span></span>
          </div>
        </div>
      )}

      {stats && stats.scenarios_by_type.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Scenarios by Entitlement Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.scenarios_by_type.map((s) => (
              <div key={s.entitlement_type || 'unknown'} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 capitalize">{(s.entitlement_type || 'unknown').replace(/_/g, ' ')}</div>
                <div className="text-lg font-bold text-gray-900">{s.cnt}</div>
                <div className="text-xs text-gray-400">{s.active} active</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-600" />
            Integration Status
          </h3>
          <button
            onClick={testIntegrations}
            disabled={testingIntegrations}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {testingIntegrations ? 'Testing...' : 'Re-test'}
          </button>
        </div>
        {integrations ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(integrations.integrations).map(([name, info]) => (
              <div key={name} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                {info.status === 'connected' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 capitalize">{name.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500">{info.status}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">Testing connections...</div>
        )}
      </div>

      {health && health.topTables.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-gray-500" />
            Top Tables by Size
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase">Table</th>
                  <th className="text-right py-2 px-4 text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="text-right py-2 pl-4 text-xs font-medium text-gray-500 uppercase">Rows</th>
                </tr>
              </thead>
              <tbody>
                {health.topTables.slice(0, 15).map((t) => (
                  <tr key={t.table_name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-4 font-mono text-xs text-gray-700">{t.table_name}</td>
                    <td className="py-1.5 px-4 text-right text-gray-600">{t.total_size}</td>
                    <td className="py-1.5 pl-4 text-right text-gray-600">{Number(t.row_count).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
