import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../../services/api.client';

interface DiscoveryStats {
  totalDiscovered: number;
  byCounty: Record<string, number>;
  byMatchStatus: Record<string, number>;
  configuredCounties?: number;
  coverageByState?: Record<string, number>;
}

interface DiscoveryJob {
  id: string;
  county: string;
  state: string;
  status: string;
  properties_discovered?: number;
  properties_updated?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export function PropertyDiscoverySection() {
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<DiscoveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await apiClient.get('/api/v1/property-discovery/stats');
      setStats(statsRes.data);
      try {
        const jobsRes = await apiClient.get('/api/v1/property-discovery/jobs?limit=10');
        setRecentJobs(jobsRes.data.jobs ?? []);
      } catch {
        setRecentJobs([]);
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runDiscoverAll = async () => {
    setRunning('discover-all');
    setMessage(null);
    try {
      const res = await apiClient.post('/api/v1/property-discovery/discover-all', { minUnits: 50 });
      setMessage(`Discovery completed: ${res.data.totalDiscovered ?? 0} properties across ${res.data.counties ?? 0} counties`);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Discovery failed');
    } finally {
      setRunning(null);
    }
  };

  const runMatchAll = async () => {
    setRunning('match-all');
    setMessage(null);
    try {
      const res = await apiClient.post('/api/v1/property-discovery/match', { all: true });
      setMessage(`Matching completed: ${res.data.totalMatched ?? 0} matches found`);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Matching failed');
    } finally {
      setRunning(null);
    }
  };

  const runAlSync = async () => {
    setRunning('al-sync');
    setMessage(null);
    try {
      const res = await apiClient.post('/api/v1/apartment-locator/sync-table', { minUnits: 50 });
      const s = res.data.stats || {};
      setMessage(`AL sync completed: inserted=${s.inserted ?? 0}, updated=${s.updated ?? 0}`);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'AL sync failed');
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-400 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading discovery status…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
            <Search className="w-5 h-5" /> Property Discovery & Matching
          </h2>
          <div className="text-xs text-gray-500 mt-1">
            Discover commercial multifamily properties from county GIS APIs and match against Apartment Locator
          </div>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {message && (
        <div className="p-3 bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {message}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Discovered" value={stats?.totalDiscovered ?? 0} accent="cyan" />
        <StatCard label="Counties Configured" value={stats?.configuredCounties ?? 0} accent="cyan" />
        <StatCard
          label="Auto-Matched"
          value={stats?.byMatchStatus?.auto_matched ?? 0}
          accent="emerald"
        />
        <StatCard
          label="Awaiting Review"
          value={stats?.byMatchStatus?.pending ?? 0}
          accent="amber"
        />
      </div>

      {/* Action buttons */}
      <div className="border border-gray-800 bg-gray-900/40 p-4 space-y-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Manual Triggers</div>
        <div className="flex gap-3 flex-wrap">
          <ActionButton
            label="Discover All Counties"
            onClick={runDiscoverAll}
            running={running === 'discover-all'}
            disabled={!!running}
          />
          <ActionButton
            label="Sync Apartment Locator → AL Table"
            onClick={runAlSync}
            running={running === 'al-sync'}
            disabled={!!running}
          />
          <ActionButton
            label="Match Discovered ↔ AL"
            onClick={runMatchAll}
            running={running === 'match-all'}
            disabled={!!running}
          />
        </div>
        <div className="text-[10px] text-gray-500">
          Daily cron: <span className="font-mono text-gray-400">{(window as unknown as { __DISCOVERY_CRON?: string }).__DISCOVERY_CRON || '0 4 * * *'}</span>
          {' '}— runs discover-all, then AL sync, then match
        </div>
      </div>

      {/* By-county breakdown */}
      {stats?.byCounty && Object.keys(stats.byCounty).length > 0 && (
        <div className="border border-gray-800 bg-gray-900/40">
          <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-800">
            By County
          </div>
          <div className="divide-y divide-gray-800">
            {Object.entries(stats.byCounty).map(([county, count]) => (
              <div key={county} className="px-4 py-2 flex justify-between items-center text-xs">
                <span className="text-gray-300 font-mono">{county}</span>
                <span className="text-cyan-400 font-mono font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <div className="border border-gray-800 bg-gray-900/40">
          <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-800">
            Recent Discovery Jobs
          </div>
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">County</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Found</th>
                <th className="text-right px-4 py-2">Updated</th>
                <th className="text-left px-4 py-2">Started</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {recentJobs.map(j => (
                <tr key={j.id} className="border-t border-gray-800">
                  <td className="px-4 py-2 font-mono">{j.county}, {j.state}</td>
                  <td className="px-4 py-2">
                    <span className={
                      j.status === 'completed' ? 'text-emerald-400' :
                      j.status === 'failed' ? 'text-red-400' :
                      'text-amber-400'
                    }>{j.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{j.properties_discovered ?? 0}</td>
                  <td className="px-4 py-2 text-right font-mono">{j.properties_updated ?? 0}</td>
                  <td className="px-4 py-2 text-gray-500">{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'cyan' | 'emerald' | 'amber' }) {
  const accentClass = accent === 'cyan' ? 'text-cyan-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-amber-400';
  return (
    <div className="border border-gray-800 bg-gray-900/40 p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-mono font-bold ${accentClass} mt-1`}>{value.toLocaleString()}</div>
    </div>
  );
}

function ActionButton({ label, onClick, running, disabled }: { label: string; onClick: () => void; running: boolean; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs flex items-center gap-2 border ${
        running
          ? 'bg-gray-700 text-gray-300 border-gray-600 cursor-wait'
          : disabled
          ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
          : 'bg-cyan-900/40 text-cyan-300 border-cyan-700 hover:bg-cyan-900/60'
      }`}
    >
      {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
      {label}
    </button>
  );
}
