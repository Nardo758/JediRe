/**
 * F8AdminView - Platform Administration
 * 
 * Clean admin panel for system monitoring and org-level configuration.
 * User-facing settings are in Settings page, not here.
 * 
 * Sections:
 * - PLATFORM: System Health, Background Jobs, AI Agents, Platform Users
 * - INTELLIGENCE: Deal Oversight, Data Coverage
 * - ORGANIZATION: Org Integrations (DocuSign, Plaid, Notarize)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';

// Bloomberg Terminal theme
interface ThemeType {
  bg: { terminal: string; panel: string; panelAlt: string; header: string; hover: string; active: string; input: string };
  text: { primary: string; secondary: string; muted: string; amber: string; green: string; red: string; cyan: string; orange: string; purple: string };
  border: { subtle: string; medium: string; bright: string };
  font: { mono: string; display: string; label: string };
}

interface F8AdminViewProps {
  T: ThemeType;
}

// ═══════════════════════════════════════════════════════════════════
// NAV CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

interface NavItem {
  key: string;
  label: string;
  icon: string;
  description: string;
  group: 'platform' | 'intel' | 'org';
}

const NAV_ITEMS: NavItem[] = [
  // Platform Group
  { key: 'health', label: 'SYSTEM HEALTH', icon: '💚', description: 'Uptime, metrics, status', group: 'platform' },
  { key: 'jobs', label: 'BACKGROUND JOBS', icon: '⚙️', description: 'Queues, workers, tasks', group: 'platform' },
  { key: 'agents', label: 'AI AGENTS', icon: '🤖', description: 'Runs, performance, cost', group: 'platform' },
  { key: 'users', label: 'PLATFORM USERS', icon: '👤', description: 'All users, activity', group: 'platform' },
  
  // Intelligence Group
  { key: 'deals', label: 'DEAL OVERSIGHT', icon: '📊', description: 'All deals, status', group: 'intel' },
  { key: 'coverage', label: 'DATA COVERAGE', icon: '🗺️', description: 'Geographic coverage', group: 'intel' },
  
  // Organization Group
  { key: 'integrations', label: 'ORG INTEGRATIONS', icon: '🔌', description: 'DocuSign, Plaid, etc', group: 'org' },
];

const GROUP_LABELS: Record<string, string> = {
  platform: '⚡ PLATFORM',
  intel: '🔍 INTELLIGENCE',
  org: '🏢 ORGANIZATION',
};

// ═══════════════════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════════════════

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace" };

// ═══════════════════════════════════════════════════════════════════
// SYSTEM HEALTH SECTION
// ═══════════════════════════════════════════════════════════════════

function SystemHealthSection({ T }: { T: ThemeType }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/admin/system/stats');
      setStats(res.data.totals);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to load system stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = stats ? [
    { label: 'USERS', value: Number(stats.user_count || 0).toLocaleString(), icon: '👤' },
    { label: 'DEALS', value: Number(stats.deal_count || 0).toLocaleString(), icon: '📊' },
    { label: 'PROPERTIES', value: Number(stats.property_count || 0).toLocaleString(), icon: '🏢' },
    { label: 'SCENARIOS', value: Number(stats.scenario_count || 0).toLocaleString(), icon: '📈' },
    { label: 'BENCHMARKS', value: Number(stats.benchmark_count || 0).toLocaleString(), icon: '📐' },
    { label: 'ZONING', value: Number(stats.zoning_district_count || 0).toLocaleString(), icon: '🗺️' },
  ] : [];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, ...mono }}>
          💚 SYSTEM HEALTH
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, color: T.text.muted, ...mono }}>
            {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '4px 10px', fontSize: 9, fontWeight: 600, ...mono,
              background: 'transparent', border: `1px solid ${T.border.subtle}`,
              color: T.text.secondary, cursor: 'pointer',
            }}
          >
            {loading ? '...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div style={{
        padding: 12,
        background: T.bg.panel,
        border: `1px solid ${T.text.green}`,
        borderLeft: `3px solid ${T.text.green}`,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>✓</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.text.green, ...mono }}>ALL SYSTEMS OPERATIONAL</span>
        </div>
        <div style={{ fontSize: 10, color: T.text.secondary, marginTop: 4, marginLeft: 22 }}>
          API, database, and background services running normally
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16, height: 80 }} />
          ))
        ) : (
          metrics.map(m => (
            <div key={m.label} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12 }}>{m.icon}</span>
                <span style={{ fontSize: 9, color: T.text.muted, letterSpacing: 0.5, ...mono }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.text.primary, ...mono }}>{m.value}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BACKGROUND JOBS SECTION
// ═══════════════════════════════════════════════════════════════════

function BackgroundJobsSection({ T }: { T: ThemeType }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/v1/admin/jobs')
      .then(res => setJobs(res.data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusStyle = (s: string) => {
    const colors: Record<string, string> = {
      pending: T.text.amber,
      running: T.text.cyan,
      completed: T.text.green,
      failed: T.text.red,
    };
    return colors[s] || T.text.secondary;
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, marginBottom: 16, ...mono }}>
        ⚙️ BACKGROUND JOBS
      </div>

      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>Loading...</div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 11, color: T.text.muted }}>No background jobs recorded</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.bg.header }}>
                {['JOB TYPE', 'STATUS', 'STARTED', 'COMPLETED'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 9, color: T.text.muted, textAlign: 'left', letterSpacing: 0.5, ...mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 20).map((j, i) => (
                <tr key={j.id || i} style={{ borderTop: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text.primary }}>{j.job_type?.replace(/_/g, ' ')}</div>
                    {j.error_message && <div style={{ fontSize: 9, color: T.text.red, marginTop: 2 }}>{j.error_message}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusStyle(j.status), ...mono }}>{j.status?.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.muted, ...mono }}>{formatDate(j.started_at)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.muted, ...mono }}>{formatDate(j.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AI AGENTS SECTION
// ═══════════════════════════════════════════════════════════════════

function AIAgentsSection({ T }: { T: ThemeType }) {
  const [stats, setStats] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, runsRes] = await Promise.all([
        apiClient.get('/api/v1/admin/agents/stats'),
        apiClient.get(`/api/v1/admin/agents/recent-runs?limit=30${selectedAgent ? `&agent_id=${selectedAgent}` : ''}`),
      ]);
      setStats(statsRes.data.agents || []);
      setRuns(runsRes.data.runs || []);
    } catch (e) {
      console.error('Failed to load agent data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => { load(); }, [load]);

  const agentIds = ['research', 'zoning', 'supply', 'cashflow', 'commentary'];
  
  const fmtMs = (ms: any) => {
    if (!ms) return '—';
    const n = typeof ms === 'string' ? parseFloat(ms) : ms;
    return n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;
  };

  const fmtCost = (usd: any) => {
    if (!usd) return '—';
    const n = parseFloat(usd);
    return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
  };

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      succeeded: T.text.green,
      failed: T.text.red,
      running: T.text.cyan,
      pending: T.text.secondary,
    };
    return colors[s] || T.text.secondary;
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, ...mono }}>
          🤖 AI AGENTS
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '4px 10px', fontSize: 9, fontWeight: 600, ...mono,
            background: T.bg.active, border: 'none', color: T.text.primary, cursor: 'pointer',
          }}
        >
          {loading ? '...' : 'REFRESH'}
        </button>
      </div>

      {/* Agent Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {agentIds.map(agentId => {
          const s = stats.find(r => r.agent_id === agentId);
          const isSelected = selectedAgent === agentId;
          const successRate = s ? parseFloat(s.success_rate_pct || '0') : null;
          
          return (
            <div
              key={agentId}
              onClick={() => setSelectedAgent(isSelected ? null : agentId)}
              style={{
                background: T.bg.panel,
                border: `1px solid ${isSelected ? T.text.amber : T.border.subtle}`,
                padding: 14,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.text.amber, letterSpacing: 1, ...mono }}>
                  {agentId.toUpperCase()}
                </span>
                {successRate !== null && (
                  <span style={{ 
                    fontSize: 9, 
                    color: successRate >= 85 ? T.text.green : successRate >= 70 ? T.text.amber : T.text.red,
                    ...mono 
                  }}>
                    {successRate.toFixed(0)}% OK
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10 }}>
                <div>
                  <div style={{ color: T.text.muted, fontSize: 9 }}>30d Runs</div>
                  <div style={{ fontWeight: 600, color: T.text.primary, ...mono }}>{s?.runs_last_30d || '0'}</div>
                </div>
                <div>
                  <div style={{ color: T.text.muted, fontSize: 9 }}>Today</div>
                  <div style={{ fontWeight: 600, color: T.text.primary, ...mono }}>{s?.runs_last_1d || '0'}</div>
                </div>
                <div>
                  <div style={{ color: T.text.muted, fontSize: 9 }}>p50 / p99</div>
                  <div style={{ color: T.text.secondary, ...mono }}>{fmtMs(s?.p50_duration_ms)} / {fmtMs(s?.p99_duration_ms)}</div>
                </div>
                <div>
                  <div style={{ color: T.text.muted, fontSize: 9 }}>Cost (30d)</div>
                  <div style={{ color: T.text.secondary, ...mono }}>{fmtCost(s?.cost_usd_30d)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Runs Table */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: T.text.primary, ...mono }}>
            RECENT RUNS {selectedAgent ? `— ${selectedAgent.toUpperCase()}` : ''}
          </span>
          {selectedAgent && (
            <button
              onClick={() => setSelectedAgent(null)}
              style={{ fontSize: 9, color: T.text.secondary, background: T.bg.active, border: 'none', padding: '2px 8px', cursor: 'pointer' }}
            >
              CLEAR
            </button>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.bg.header }}>
              {['AGENT', 'DEAL', 'STATUS', 'DURATION', 'COST', 'STARTED'].map(h => (
                <th key={h} style={{ padding: '8px 14px', fontSize: 9, color: T.text.muted, textAlign: 'left', ...mono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: T.text.muted, fontSize: 11 }}>
                  {loading ? 'Loading...' : 'No runs found'}
                </td>
              </tr>
            ) : runs.map((run, i) => (
              <tr key={run.id || i} style={{ borderTop: `1px solid ${T.border.subtle}` }}>
                <td style={{ padding: '8px 14px', fontSize: 10, fontWeight: 600, color: T.text.amber, ...mono }}>{run.agent_id}</td>
                <td style={{ padding: '8px 14px', fontSize: 10, color: T.text.secondary, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {run.deal_name || run.deal_id?.slice(0, 8) || '—'}
                </td>
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: statusColor(run.status), ...mono }}>{run.status?.toUpperCase()}</span>
                </td>
                <td style={{ padding: '8px 14px', fontSize: 10, color: T.text.secondary, ...mono }}>{fmtMs(run.duration_ms)}</td>
                <td style={{ padding: '8px 14px', fontSize: 10, color: T.text.secondary, ...mono }}>{fmtCost(run.cost_usd)}</td>
                <td style={{ padding: '8px 14px', fontSize: 9, color: T.text.muted, ...mono }}>
                  {run.started_at ? new Date(run.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLATFORM USERS SECTION
// ═══════════════════════════════════════════════════════════════════

function PlatformUsersSection({ T }: { T: ThemeType }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/v1/admin/users')
      .then(res => setUsers(res.data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, marginBottom: 16, ...mono }}>
        👤 PLATFORM USERS
        <span style={{ fontSize: 10, fontWeight: 400, color: T.text.muted, marginLeft: 8 }}>({users.length})</span>
      </div>

      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.bg.header }}>
                {['USER', 'ROLE', 'JOINED', 'LAST SIGN IN'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 9, color: T.text.muted, textAlign: 'left', letterSpacing: 0.5, ...mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id || i} style={{ borderTop: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text.primary }}>{u.full_name || '—'}</div>
                    <div style={{ fontSize: 9, color: T.text.muted }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ 
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', 
                      background: T.bg.panelAlt, 
                      color: u.role === 'admin' ? T.text.purple : T.text.secondary,
                      ...mono 
                    }}>
                      {u.role?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.muted, ...mono }}>{formatDate(u.created_at)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.muted, ...mono }}>{formatDate(u.last_sign_in_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DEAL OVERSIGHT SECTION
// ═══════════════════════════════════════════════════════════════════

function DealOversightSection({ T }: { T: ThemeType }) {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/v1/admin/deals')
      .then(res => setDeals(res.data.deals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      active: T.text.green,
      closed: T.text.cyan,
      dead: T.text.red,
    };
    return colors[s] || T.text.secondary;
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, marginBottom: 16, ...mono }}>
        📊 DEAL OVERSIGHT
        <span style={{ fontSize: 10, fontWeight: 400, color: T.text.muted, marginLeft: 8 }}>({deals.length})</span>
      </div>

      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>Loading...</div>
        ) : deals.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 11, color: T.text.muted }}>No deals found</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.bg.header }}>
                {['DEAL', 'TYPE', 'STATUS', 'CREATED'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 9, color: T.text.muted, textAlign: 'left', letterSpacing: 0.5, ...mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.slice(0, 30).map((d, i) => (
                <tr key={d.id || i} style={{ borderTop: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: T.text.primary }}>{d.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.secondary }}>{d.deal_type?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusColor(d.status), ...mono }}>{d.status?.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.muted, ...mono }}>
                    {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DATA COVERAGE SECTION
// ═══════════════════════════════════════════════════════════════════

function DataCoverageSection({ T }: { T: ThemeType }) {
  const [counties, setCounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/api/v1/admin/data-coverage')
      .then(res => setCounties(res.data.counties || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      active: T.text.green,
      pending: T.text.amber,
      error: T.text.red,
    };
    return colors[s] || T.text.secondary;
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, marginBottom: 16, ...mono }}>
        🗺️ DATA COVERAGE
      </div>

      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>Loading...</div>
        ) : counties.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
            <div style={{ fontSize: 11, color: T.text.secondary }}>No county coverage configured</div>
            <div style={{ fontSize: 10, color: T.text.muted, marginTop: 4 }}>Add counties to track data coverage</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.bg.header }}>
                {['COUNTY', 'STATUS', 'PROPERTIES', 'LAST SCRAPED'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 9, color: T.text.muted, textAlign: 'left', letterSpacing: 0.5, ...mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counties.map((c, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: T.text.primary }}>{c.county}, {c.state}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusColor(c.status), ...mono }}>{c.status?.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.secondary, ...mono }}>{c.property_count?.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', fontSize: 10, color: T.text.muted, ...mono }}>
                    {c.last_scraped ? new Date(c.last_scraped).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ORG INTEGRATIONS SECTION
// ═══════════════════════════════════════════════════════════════════

type IntegrationKey = 'docusign' | 'notarize' | 'plaid';

interface IntegrationDef {
  key: IntegrationKey;
  name: string;
  icon: string;
  description: string;
  apiPath: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    key: 'docusign', name: 'DocuSign', icon: '✍️', description: 'Document signing for PSAs, LOIs, loan docs',
    apiPath: '/api/v1/organization/integrations/docusign/credentials',
    fields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'integrationKey', label: 'Integration Key', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'secretKey', label: 'Secret Key', placeholder: 'Your DocuSign secret', secret: true },
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://demo.docusign.net/restapi' },
    ],
  },
  {
    key: 'notarize', name: 'Notarize', icon: '📜', description: 'Remote online notarization',
    apiPath: '/api/v1/organization/integrations/notarize/credentials',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Notarize API key', secret: true },
      { key: 'environment', label: 'Environment', placeholder: 'sandbox or production' },
    ],
  },
  {
    key: 'plaid', name: 'Plaid', icon: '🏦', description: 'Identity & bank verification (KYC)',
    apiPath: '/api/v1/organization/integrations/plaid/credentials',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'Your Plaid client_id' },
      { key: 'secret', label: 'Secret', placeholder: 'Your Plaid secret', secret: true },
      { key: 'environment', label: 'Environment', placeholder: 'sandbox, development, or production' },
    ],
  },
];

function OrgIntegrationsSection({ T }: { T: ThemeType }) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [openForm, setOpenForm] = useState<IntegrationKey | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleConnect = async (def: IntegrationDef) => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      def.fields.forEach(f => { body[f.key] = formValues[f.key] || ''; });
      await apiClient.post(def.apiPath, body);
      setStatuses(prev => ({ ...prev, [def.key]: 'connected' }));
      setOpenForm(null);
      setFormValues({});
      setMessage({ type: 'success', text: `${def.name} connected successfully` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.error || `Failed to connect ${def.name}` });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: 10, padding: '6px 10px',
    background: T.bg.panelAlt, border: `1px solid ${T.border.medium}`,
    color: T.text.primary, outline: 'none', ...mono,
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, letterSpacing: 1, marginBottom: 8, ...mono }}>
        🔌 ORGANIZATION INTEGRATIONS
      </div>
      <div style={{ fontSize: 10, color: T.text.secondary, marginBottom: 20 }}>
        Connect third-party services at the organization level. Credentials are AES-256 encrypted.
      </div>

      {message && (
        <div style={{
          padding: '8px 12px', marginBottom: 16, fontSize: 10,
          background: message.type === 'success' ? T.text.green + '11' : T.text.red + '11',
          border: `1px solid ${message.type === 'success' ? T.text.green : T.text.red}`,
          color: message.type === 'success' ? T.text.green : T.text.red,
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {INTEGRATIONS.map(def => {
          const status = statuses[def.key] || 'not_configured';
          const isOpen = openForm === def.key;

          return (
            <div key={def.key} style={{ 
              background: T.bg.panel, 
              border: `1px solid ${isOpen ? T.text.amber : T.border.subtle}`, 
              padding: 16 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{def.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text.primary }}>{def.name}</div>
                    <div style={{ fontSize: 9, color: T.text.muted }}>{def.description}</div>
                  </div>
                </div>
                <span style={{ 
                  fontSize: 9, 
                  color: status === 'connected' ? T.text.green : T.text.muted,
                  ...mono 
                }}>
                  {status === 'connected' ? '● CONNECTED' : '○ NOT CONFIGURED'}
                </span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  {def.fields.map(f => (
                    <div key={f.key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 3, ...mono }}>{f.label}</div>
                      <input
                        type={f.secret ? 'password' : 'text'}
                        placeholder={f.placeholder}
                        value={formValues[f.key] || ''}
                        onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => handleConnect(def)}
                      disabled={saving}
                      style={{
                        padding: '6px 14px', fontSize: 9, fontWeight: 700,
                        background: T.text.amber, color: T.bg.terminal, border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                        ...mono,
                      }}
                    >
                      {saving ? 'SAVING...' : 'SAVE'}
                    </button>
                    <button
                      onClick={() => { setOpenForm(null); setFormValues({}); }}
                      style={{
                        padding: '6px 14px', fontSize: 9,
                        background: 'transparent', color: T.text.muted, border: `1px solid ${T.border.medium}`,
                        cursor: 'pointer', ...mono,
                      }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {!isOpen && (
                <button
                  onClick={() => { setOpenForm(def.key); setFormValues({}); }}
                  style={{
                    width: '100%', marginTop: 10, padding: '8px 12px', fontSize: 10, fontWeight: 600,
                    background: 'transparent',
                    color: status === 'connected' ? T.text.muted : T.text.amber,
                    border: `1px solid ${status === 'connected' ? T.text.muted : T.text.amber}44`,
                    cursor: 'pointer', ...mono,
                  }}
                >
                  {status === 'connected' ? 'RECONFIGURE' : 'CONNECT'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function F8AdminView({ T }: F8AdminViewProps) {
  const [activeSection, setActiveSection] = useState('health');
  const [collapsed, setCollapsed] = useState(false);

  const renderNavGroup = (groupId: string) => {
    const items = NAV_ITEMS.filter(item => item.group === groupId);
    const label = GROUP_LABELS[groupId];
    
    return (
      <div key={groupId} style={{ marginBottom: 12 }}>
        <div style={{ 
          fontSize: 8, color: T.text.muted, padding: collapsed ? '6px 4px' : '6px 10px', 
          letterSpacing: 0.8, ...mono 
        }}>
          {collapsed ? label.split(' ')[0] : label}
        </div>
        {items.map(item => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%',
                padding: collapsed ? '8px 4px' : '8px 10px',
                marginBottom: 2,
                background: isActive ? T.bg.active : 'transparent',
                border: 'none',
                borderLeft: isActive ? `2px solid ${T.text.amber}` : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 8,
              }}
            >
              <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: isActive ? T.text.amber : T.text.primary, ...mono }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 8, color: T.text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.description}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'health': return <SystemHealthSection T={T} />;
      case 'jobs': return <BackgroundJobsSection T={T} />;
      case 'agents': return <AIAgentsSection T={T} />;
      case 'users': return <PlatformUsersSection T={T} />;
      case 'deals': return <DealOversightSection T={T} />;
      case 'coverage': return <DataCoverageSection T={T} />;
      case 'integrations': return <OrgIntegrationsSection T={T} />;
      default: return <SystemHealthSection T={T} />;
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 44 : 180,
        background: T.bg.panel,
        borderRight: `1px solid ${T.border.subtle}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.15s',
      }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: 8, background: 'transparent', border: 'none',
            borderBottom: `1px solid ${T.border.subtle}`,
            cursor: 'pointer', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end',
          }}
        >
          <span style={{ fontSize: 11, color: T.text.muted }}>{collapsed ? '→' : '←'}</span>
        </button>
        
        <nav style={{ flex: 1, padding: collapsed ? '8px 2px' : '8px 6px', overflowY: 'auto' }}>
          {renderNavGroup('platform')}
          {renderNavGroup('intel')}
          {renderNavGroup('org')}
        </nav>

        {!collapsed && (
          <div style={{ 
            padding: '8px 10px', borderTop: `1px solid ${T.border.subtle}`, 
            fontSize: 8, color: T.text.muted, ...mono 
          }}>
            F8 ADMIN v3.0
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', background: T.bg.terminal }}>
        {renderContent()}
      </main>
    </div>
  );
}
