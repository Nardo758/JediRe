import React, { useState, useEffect, useCallback } from 'react';
import { Bot, RefreshCw, CheckCircle, XCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

interface AgentStat {
  agent_id: string;
  total_runs: string;
  runs_last_30d: string;
  runs_last_1d: string;
  success_rate_pct: string | null;
  p50_duration_ms: string | null;
  p99_duration_ms: string | null;
  total_cost_usd: string;
  cost_usd_30d: string;
  last_run_at: string | null;
  active_prompts: Array<{ id: string; version: string; prompt_type: string }>;
}

interface AgentRun {
  id: string;
  agent_id: string;
  deal_id: string | null;
  deal_name: string | null;
  status: string;
  triggered_by: string;
  cost_usd: string | null;
  duration_ms: number | null;
  started_at: string;
  error: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  succeeded: BT.text.green,
  failed: BT.text.red,
  budget_exceeded: BT.text.amber,
  aborted: BT.text.secondary,
  running: BT.text.cyan,
  pending: BT.text.secondary,
};

function fmtMs(ms: string | number | null): string {
  if (!ms) return '—';
  const n = typeof ms === 'string' ? parseFloat(ms) : ms;
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function fmtCost(usd: string | null): string {
  if (!usd) return '—';
  const n = parseFloat(usd);
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(3)}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? BT.text.secondary;
  const label = status === 'succeeded' ? 'OK' : status.replace('_', ' ').toUpperCase();
  return (
    <span className="text-xs font-mono font-semibold uppercase px-1.5 py-0.5" style={{ color, borderRadius: 2 }}>
      {label}
    </span>
  );
}

export function AgentsPlatformSection() {
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, runsRes] = await Promise.all([
        apiClient.get('/api/v1/admin/agents/stats'),
        apiClient.get(`/api/v1/admin/agents/recent-runs?limit=50${selectedAgent ? `&agent_id=${selectedAgent}` : ''}`),
      ]);
      setStats(statsRes.data.agents ?? []);
      setRuns(runsRes.data.runs ?? []);
      setGeneratedAt(statsRes.data.generated_at ?? null);
    } catch {
      setError('Failed to load agent platform data');
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => { load(); }, [load]);

  const agentIds = ['research', 'zoning', 'supply', 'cashflow', 'commentary'];

  return (
    <div className="space-y-6" style={{ fontFamily: BT.font.label }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" style={{ color: BT.text.cyan }} />
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            Agent Platform
          </h2>
          {generatedAt && (
            <span className="text-xs ml-2" style={{ color: BT.text.muted }}>
              as of {fmtTime(generatedAt)}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
          style={{ background: BT.bg.active, color: BT.text.primary, borderRadius: 2 }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm" style={{ background: BT.bg.panel, color: BT.text.red, borderRadius: 2, border: `1px solid ${BT.border.subtle}` }}>
          {error}
        </div>
      )}

      {/* Per-agent stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {agentIds.map(agentId => {
          const s = stats.find(r => r.agent_id === agentId);
          const successRate = s ? parseFloat(s.success_rate_pct ?? '0') : null;
          const rateColor = successRate === null ? BT.text.muted
            : successRate >= 85 ? BT.text.green
            : successRate >= 70 ? BT.text.amber
            : BT.text.red;

          return (
            <div
              key={agentId}
              onClick={() => setSelectedAgent(selectedAgent === agentId ? null : agentId)}
              className="p-4 cursor-pointer transition-all"
              style={{
                background: BT.bg.panel,
                border: `1px solid ${selectedAgent === agentId ? BT.text.amber : BT.border.subtle}`,
                borderRadius: 2,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: BT.text.amber, fontFamily: BT.font.display }}>
                  {agentId}
                </span>
                {s ? (
                  <span className="text-xs" title="All-time success rate" style={{ color: rateColor }}>
                    {s.success_rate_pct ?? '0'}% ok (all-time)
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: BT.text.muted }}>no runs</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <div style={{ color: BT.text.muted }}>Runs (30d)</div>
                  <div className="font-mono font-semibold" style={{ color: BT.text.primary }}>
                    {s ? Number(s.runs_last_30d).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: BT.text.muted }}>Today</div>
                  <div className="font-mono font-semibold" style={{ color: BT.text.primary }}>
                    {s ? s.runs_last_1d : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: BT.text.muted }}>p50 / p99</div>
                  <div className="font-mono" style={{ color: BT.text.primary }}>
                    {s ? `${fmtMs(s.p50_duration_ms)} / ${fmtMs(s.p99_duration_ms)}` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ color: BT.text.muted }}>Cost (30d)</div>
                  <div className="font-mono" style={{ color: BT.text.primary }}>
                    {s ? fmtCost(s.cost_usd_30d) : '—'}
                  </div>
                </div>
              </div>

              {s && s.active_prompts.length > 0 && (
                <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                  <div className="text-xs" style={{ color: BT.text.muted }}>Active prompts</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.active_prompts.map(p => (
                      <span key={p.id} className="text-xs px-1.5 py-0.5 font-mono" style={{ background: BT.bg.active, color: BT.text.cyan, borderRadius: 2 }}>
                        {p.prompt_type} v{p.version}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {s && (
                <div className="mt-2 text-xs" style={{ color: BT.text.muted }}>
                  Last run: {fmtTime(s.last_run_at)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent runs feed */}
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 2 }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: BT.text.muted }} />
            <span className="text-sm font-semibold" style={{ color: BT.text.primary }}>
              Recent Runs {selectedAgent ? `— ${selectedAgent}` : '(all agents)'}
            </span>
          </div>
          {selectedAgent && (
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-xs px-2 py-1"
              style={{ color: BT.text.secondary, background: BT.bg.active, borderRadius: 2 }}
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ background: BT.bg.active, color: BT.text.muted }}>
                <th className="text-left px-4 py-2 font-medium">Agent</th>
                <th className="text-left px-4 py-2 font-medium">Deal</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Trigger</th>
                <th className="text-right px-4 py-2 font-medium">Duration</th>
                <th className="text-right px-4 py-2 font-medium">Cost</th>
                <th className="text-left px-4 py-2 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center" style={{ color: BT.text.muted }}>
                    {loading ? 'Loading...' : 'No runs found'}
                  </td>
                </tr>
              )}
              {runs.map(run => (
                <tr key={run.id} style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                  <td className="px-4 py-2 font-semibold" style={{ color: BT.text.amber }}>{run.agent_id}</td>
                  <td className="px-4 py-2 max-w-[160px] truncate" style={{ color: BT.text.secondary }}>
                    {run.deal_name ?? run.deal_id?.slice(0, 8) ?? '—'}
                  </td>
                  <td className="px-4 py-2"><StatusBadge status={run.status} /></td>
                  <td className="px-4 py-2" style={{ color: BT.text.secondary }}>{run.triggered_by}</td>
                  <td className="px-4 py-2 text-right" style={{ color: BT.text.primary }}>{fmtMs(run.duration_ms)}</td>
                  <td className="px-4 py-2 text-right" style={{ color: BT.text.primary }}>{fmtCost(run.cost_usd)}</td>
                  <td className="px-4 py-2" style={{ color: BT.text.muted }}>{fmtTime(run.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
