import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Play, AlertCircle, CheckCircle, Check, X } from 'lucide-react';
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

interface CountyOption {
  county: string;
  state: string;
}

interface PendingMatch {
  id: string;
  discovered_property_id: string;
  apartment_locator_id: string;
  confidence_score: number;
  status: string;
  discovered_address?: string;
  discovered_city?: string;
  al_property_name?: string;
  al_address?: string;
}

export function PropertyDiscoverySection() {
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<DiscoveryJob[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [counties, setCounties] = useState<CountyOption[]>([]);
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

      const seen = new Set<string>();
      const counties: CountyOption[] = [];
      // Always include configured counties first (so per-county actions are
      // available even when no discoveries exist yet).
      for (const c of (statsRes.data.configuredCountyList || []) as CountyOption[]) {
        const key = `${c.county}, ${c.state}`;
        if (!seen.has(key)) { seen.add(key); counties.push(c); }
      }
      // Then add any other counties that show up in stats.byCounty but aren't configured.
      for (const k of Object.keys(statsRes.data.byCounty || {})) {
        const m = k.match(/^(.+),\s*(.+)$/);
        if (m && !seen.has(k)) { seen.add(k); counties.push({ county: m[1], state: m[2] }); }
      }
      setCounties(counties);

      try {
        const jobsRes = await apiClient.get('/api/v1/property-discovery/jobs?limit=10');
        setRecentJobs(jobsRes.data.jobs ?? []);
      } catch {
        setRecentJobs([]);
      }

      try {
        const reviewRes = await apiClient.get('/api/v1/property-discovery/matches/review?limit=20');
        setPendingMatches(reviewRes.data.matches ?? []);
      } catch {
        setPendingMatches([]);
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runAction = async (key: string, fn: () => Promise<string>) => {
    setRunning(key);
    setMessage(null);
    setError(null);
    try {
      const msg = await fn();
      setMessage(msg);
      await load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Action failed');
    } finally {
      setRunning(null);
    }
  };

  const runDiscoverAll = () => runAction('discover-all', async () => {
    const res = await apiClient.post('/api/v1/property-discovery/discover-all', { minUnits: 50 });
    const s = res.data.summary || {};
    return `Discovery completed: ${s.totalFound ?? 0} properties (${s.totalNew ?? 0} new) across ${s.counties ?? 0} counties`;
  });

  const runMatchAll = () => runAction('match-all', async () => {
    const res = await apiClient.post('/api/v1/property-discovery/match-all', {});
    return `Matching completed: ${res.data.totalMatched ?? 0} matched, ${res.data.totalReview ?? 0} need review`;
  });

  const runAlSync = () => runAction('al-sync', async () => {
    const res = await apiClient.post('/api/v1/apartment-locator/sync-table', { minUnits: 50 });
    const s = res.data.stats || {};
    return `AL sync completed: inserted=${s.inserted ?? 0}, updated=${s.updated ?? 0}`;
  });

  const runDiscoverCounty = (county: string, state: string) => runAction(`discover-${county}-${state}`, async () => {
    const res = await apiClient.post('/api/v1/property-discovery/discover', { county, state, minUnits: 50 });
    const j = res.data.job || {};
    const found = j.propertiesFound ?? j.properties_found ?? 0;
    return `Discovered ${found} properties in ${county}, ${state}`;
  });

  const runMatchCounty = (county: string, state: string) => runAction(`match-${county}-${state}`, async () => {
    const res = await apiClient.post('/api/v1/property-discovery/match', { county, state });
    return `Matched ${res.data.matched ?? 0} in ${county}, ${state} (${res.data.reviewRequired ?? 0} need review)`;
  });

  const confirmMatch = async (id: string) => {
    setRunning(`confirm-${id}`);
    try {
      await apiClient.post(`/api/v1/property-discovery/matches/${id}/confirm`);
      setPendingMatches(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Failed to confirm');
    } finally {
      setRunning(null);
    }
  };

  const rejectMatch = async (id: string) => {
    setRunning(`reject-${id}`);
    try {
      await apiClient.post(`/api/v1/property-discovery/matches/${id}/reject`, { reason: 'Manual rejection' });
      setPendingMatches(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Failed to reject');
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
          value={(stats?.byMatchStatus?.review_required ?? 0) + (stats?.byMatchStatus?.pending ?? 0)}
          accent="amber"
        />
      </div>

      {/* Action buttons (global) */}
      <div className="border border-gray-800 bg-gray-900/40 p-4 space-y-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide">Global Triggers</div>
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
            label="Match All Counties"
            onClick={runMatchAll}
            running={running === 'match-all'}
            disabled={!!running}
          />
        </div>
        <div className="text-[10px] text-gray-500">
          Daily cron: <span className="font-mono text-gray-400">0 4 * * * UTC</span>
          {' '}— runs Discover All → AL Sync → Match All
        </div>
      </div>

      {/* Pending review queue */}
      {pendingMatches.length > 0 && (
        <div className="border border-amber-800 bg-amber-950/20">
          <div className="px-4 py-2 text-xs font-bold text-amber-400 uppercase tracking-wide border-b border-amber-800 flex items-center justify-between">
            <span>Pending Review Queue ({pendingMatches.length})</span>
            <span className="text-[10px] text-gray-500 normal-case">Confidence 50–84% requires manual confirmation</span>
          </div>
          <div className="divide-y divide-amber-900/40">
            {pendingMatches.map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center justify-between text-xs">
                <div className="flex-1">
                  <div className="text-gray-300 font-mono">
                    <span className="text-cyan-400">{m.discovered_address}</span>
                    {' '}↔{' '}
                    <span className="text-amber-300">{m.al_property_name || m.al_address}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Confidence: <span className="font-mono text-amber-400">{Math.round(m.confidence_score)}%</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => confirmMatch(m.id)}
                    disabled={running === `confirm-${m.id}`}
                    className="px-2 py-1 bg-emerald-900/40 text-emerald-300 border border-emerald-700 hover:bg-emerald-900/60 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Confirm
                  </button>
                  <button
                    onClick={() => rejectMatch(m.id)}
                    disabled={running === `reject-${m.id}`}
                    className="px-2 py-1 bg-red-900/40 text-red-300 border border-red-700 hover:bg-red-900/60 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By-county breakdown with per-county actions */}
      {counties.length > 0 && (
        <div className="border border-gray-800 bg-gray-900/40">
          <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-800">
            By County
          </div>
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">County</th>
                <th className="text-right px-4 py-2">Discovered</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {counties.map(c => {
                const key = `${c.county}, ${c.state}`;
                const count = stats?.byCounty?.[key] ?? 0;
                return (
                  <tr key={key} className="border-t border-gray-800">
                    <td className="px-4 py-2 font-mono">{key}</td>
                    <td className="px-4 py-2 text-right font-mono text-cyan-400">{count}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <ActionButton
                          label="Discover"
                          onClick={() => runDiscoverCounty(c.county, c.state)}
                          running={running === `discover-${c.county}-${c.state}`}
                          disabled={!!running}
                          small
                        />
                        <ActionButton
                          label="Match"
                          onClick={() => runMatchCounty(c.county, c.state)}
                          running={running === `match-${c.county}-${c.state}`}
                          disabled={!!running}
                          small
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                      j.status === 'completed' || j.status === 'complete' ? 'text-emerald-400' :
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

function ActionButton({ label, onClick, running, disabled, small }: { label: string; onClick: () => void; running: boolean; disabled: boolean; small?: boolean }) {
  const sizeClass = small ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClass} flex items-center gap-1 border ${
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
