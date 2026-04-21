/**
 * AgentControlPanel - Manual Agent Trigger UI
 * 
 * Provides UI controls to manually run agents on a deal.
 * Shows real-time progress and results.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../services/api.client';

// ─── Types ────────────────────────────────────────────────────────

interface AgentDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  dependsOn?: string[];
}

interface AgentRun {
  id: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  error?: string;
  output?: Record<string, unknown>;
}

interface AgentControlPanelProps {
  dealId: string;
  compact?: boolean;
  onRunComplete?: (agentId: string, result: AgentRun) => void;
}

// ─── Agent Definitions ────────────────────────────────────────────

const AGENTS: AgentDef[] = [
  {
    id: 'research',
    label: 'Research',
    icon: '🔬',
    description: 'Property data, market context, ownership history',
    color: '#8B5CF6',
  },
  {
    id: 'supply',
    label: 'Supply',
    icon: '🏗️',
    description: 'Pipeline analysis, construction permits, deliveries',
    color: '#F59E0B',
  },
  {
    id: 'zoning',
    label: 'Zoning',
    icon: '📐',
    description: 'Zoning analysis, entitlements, land use',
    color: '#10B981',
  },
  {
    id: 'cashflow',
    label: 'CashFlow',
    icon: '💰',
    description: 'Underwriting, proforma, returns analysis',
    color: '#06B6D4',
    dependsOn: ['research'],
  },
  {
    id: 'commentary',
    label: 'Commentary',
    icon: '📝',
    description: 'Investment memo, narrative walkthrough',
    color: '#EC4899',
    dependsOn: ['cashflow'],
  },
];

// ─── Theme (Bloomberg-style) ──────────────────────────────────────

const T = {
  bg: {
    panel: '#1a1a1a',
    hover: '#252525',
    active: '#2a2a2a',
  },
  text: {
    primary: '#e5e5e5',
    secondary: '#a3a3a3',
    muted: '#737373',
    amber: '#FFB800',
    green: '#00D26A',
    red: '#FF4757',
    cyan: '#00D4FF',
  },
  border: {
    subtle: '#333',
  },
  font: {
    mono: "'JetBrains Mono', 'SF Mono', monospace",
  },
};

// ─── Component ────────────────────────────────────────────────────

export function AgentControlPanel({ dealId, compact = false, onRunComplete }: AgentControlPanelProps) {
  const [runningAgents, setRunningAgents] = useState<Record<string, string>>({}); // agentId → runId
  const [recentRuns, setRecentRuns] = useState<Record<string, AgentRun>>({}); // agentId → latest run
  const [expanded, setExpanded] = useState(!compact);
  const [loading, setLoading] = useState(true);

  // Fetch recent runs on mount
  useEffect(() => {
    fetchRecentRuns();
  }, [dealId]);

  // Poll running agents
  useEffect(() => {
    const runningIds = Object.values(runningAgents);
    if (runningIds.length === 0) return;

    const interval = setInterval(() => {
      runningIds.forEach(runId => pollRunStatus(runId));
    }, 2000);

    return () => clearInterval(interval);
  }, [runningAgents]);

  const fetchRecentRuns = async () => {
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/agent-runs?limit=20`);
      const runs = res.data?.runs ?? [];
      
      // Group by agent, keep latest
      const byAgent: Record<string, AgentRun> = {};
      const stillRunning: Record<string, string> = {};
      
      for (const run of runs) {
        const agentId = run.agent_id;
        if (!byAgent[agentId] || new Date(run.started_at) > new Date(byAgent[agentId].startedAt!)) {
          byAgent[agentId] = {
            id: run.id,
            agentId: run.agent_id,
            status: mapStatus(run.display_status || run.status),
            startedAt: run.started_at ? new Date(run.started_at) : undefined,
            completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
            durationMs: run.duration_ms,
            tokensIn: run.tokens_in,
            tokensOut: run.tokens_out,
            costUsd: run.cost_usd,
            error: run.error,
          };
          
          if (byAgent[agentId].status === 'running' || byAgent[agentId].status === 'pending') {
            stillRunning[agentId] = run.id;
          }
        }
      }
      
      setRecentRuns(byAgent);
      setRunningAgents(stillRunning);
    } catch (err) {
      console.error('Failed to fetch agent runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const pollRunStatus = async (runId: string) => {
    try {
      const res = await apiClient.get(`/api/v1/agents/runs/${runId}`);
      const run = res.data?.run;
      if (!run) return;

      const agentId = run.agent_id;
      const status = mapStatus(run.display_status || run.status);

      setRecentRuns(prev => ({
        ...prev,
        [agentId]: {
          id: run.id,
          agentId,
          status,
          startedAt: run.started_at ? new Date(run.started_at) : undefined,
          completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
          durationMs: run.duration_ms,
          tokensIn: run.tokens_in,
          tokensOut: run.tokens_out,
          costUsd: run.cost_usd,
          error: run.error,
          output: run.output,
        },
      }));

      // Remove from running if complete
      if (status !== 'running' && status !== 'pending') {
        setRunningAgents(prev => {
          const next = { ...prev };
          delete next[agentId];
          return next;
        });
        
        if (onRunComplete) {
          onRunComplete(agentId, {
            id: run.id,
            agentId,
            status,
            startedAt: run.started_at ? new Date(run.started_at) : undefined,
            completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
            output: run.output,
          });
        }
      }
    } catch (err) {
      console.error('Failed to poll run status:', err);
    }
  };

  const triggerAgent = async (agentId: string) => {
    try {
      setRunningAgents(prev => ({ ...prev, [agentId]: 'pending' }));
      
      const res = await apiClient.post(`/api/v1/agents/${agentId}/run`, {
        deal_id: dealId,
        force_refresh: true,
      });

      if (res.data?.run_id) {
        setRunningAgents(prev => ({ ...prev, [agentId]: res.data.run_id }));
        setRecentRuns(prev => ({
          ...prev,
          [agentId]: {
            id: res.data.run_id,
            agentId,
            status: 'running',
            startedAt: new Date(),
          },
        }));
      }
    } catch (err: any) {
      console.error('Failed to trigger agent:', err);
      setRunningAgents(prev => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
      setRecentRuns(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          status: 'failed',
          error: err.response?.data?.error || err.message,
        },
      }));
    }
  };

  const mapStatus = (s: string): AgentRun['status'] => {
    switch (s) {
      case 'running': return 'running';
      case 'completed': case 'succeeded': return 'completed';
      case 'failed': return 'failed';
      case 'cancelled': case 'aborted': return 'cancelled';
      default: return 'pending';
    }
  };

  const getStatusColor = (status: AgentRun['status']) => {
    switch (status) {
      case 'running': return T.text.amber;
      case 'completed': return T.text.green;
      case 'failed': return T.text.red;
      case 'cancelled': return T.text.muted;
      default: return T.text.muted;
    }
  };

  const getStatusIcon = (status: AgentRun['status']) => {
    switch (status) {
      case 'running': return '⏳';
      case 'completed': return '✓';
      case 'failed': return '✗';
      case 'cancelled': return '○';
      default: return '○';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (date?: Date) => {
    if (!date) return '—';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: T.bg.panel,
          border: `1px solid ${T.border.subtle}`,
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: T.font.mono,
          fontSize: 10,
          color: T.text.amber,
        }}
      >
        <span>🤖</span>
        <span>AGENTS</span>
        {Object.keys(runningAgents).length > 0 && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: T.text.amber,
            animation: 'pulse 1.5s infinite',
          }} />
        )}
      </button>
    );
  }

  return (
    <div style={{
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `1px solid ${T.border.subtle}`,
        background: '#111',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🤖</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>
            AI AGENTS
          </span>
          {Object.keys(runningAgents).length > 0 && (
            <span style={{
              fontSize: 9,
              padding: '2px 6px',
              background: T.text.amber + '22',
              color: T.text.amber,
              fontFamily: T.font.mono,
            }}>
              {Object.keys(runningAgents).length} RUNNING
            </span>
          )}
        </div>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'none', border: 'none', color: T.text.muted, cursor: 'pointer', fontSize: 12 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Agent List */}
      <div style={{ padding: 8 }}>
        {AGENTS.map(agent => {
          const run = recentRuns[agent.id];
          const isRunning = !!runningAgents[agent.id];
          const canRun = !isRunning && (!agent.dependsOn || agent.dependsOn.every(d => recentRuns[d]?.status === 'completed'));

          return (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                marginBottom: 4,
                background: isRunning ? T.bg.active : 'transparent',
                borderRadius: 4,
                borderLeft: `3px solid ${run?.status === 'completed' ? T.text.green : run?.status === 'failed' ? T.text.red : agent.color}`,
              }}
            >
              {/* Icon & Name */}
              <div style={{ width: 28, textAlign: 'center', fontSize: 16 }}>{agent.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>
                    {agent.label.toUpperCase()}
                  </span>
                  {run && (
                    <span style={{ fontSize: 9, color: getStatusColor(run.status), fontFamily: T.font.mono }}>
                      {getStatusIcon(run.status)} {run.status.toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: T.text.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {agent.description}
                </div>
                {run && (
                  <div style={{ fontSize: 8, color: T.text.muted, marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>⏱ {formatDuration(run.durationMs)}</span>
                    {run.tokensIn && <span>↓{run.tokensIn}</span>}
                    {run.tokensOut && <span>↑{run.tokensOut}</span>}
                    {run.costUsd && <span>${run.costUsd.toFixed(3)}</span>}
                    <span>{formatTime(run.completedAt || run.startedAt)}</span>
                  </div>
                )}
                {run?.error && (
                  <div style={{ fontSize: 8, color: T.text.red, marginTop: 2 }}>
                    {run.error.substring(0, 100)}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => triggerAgent(agent.id)}
                disabled={!canRun}
                style={{
                  padding: '4px 10px',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: T.font.mono,
                  background: isRunning ? 'transparent' : canRun ? agent.color + '22' : 'transparent',
                  color: isRunning ? T.text.amber : canRun ? agent.color : T.text.muted,
                  border: `1px solid ${isRunning ? T.text.amber : canRun ? agent.color : T.text.muted}44`,
                  borderRadius: 3,
                  cursor: canRun ? 'pointer' : 'not-allowed',
                  opacity: canRun ? 1 : 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {isRunning ? '⏳ RUNNING' : run?.status === 'completed' ? '↻ RE-RUN' : '▶ RUN'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Run All Button */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${T.border.subtle}` }}>
        <button
          onClick={() => {
            // Run in sequence: research → others
            triggerAgent('research');
          }}
          disabled={Object.keys(runningAgents).length > 0}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: T.font.mono,
            background: Object.keys(runningAgents).length > 0 ? 'transparent' : T.text.amber + '22',
            color: Object.keys(runningAgents).length > 0 ? T.text.muted : T.text.amber,
            border: `1px solid ${T.text.amber}44`,
            borderRadius: 3,
            cursor: Object.keys(runningAgents).length > 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {Object.keys(runningAgents).length > 0 ? '⏳ AGENTS RUNNING...' : '▶ RUN ALL AGENTS'}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default AgentControlPanel;
