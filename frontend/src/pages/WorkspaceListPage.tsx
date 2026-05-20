/**
 * Task #920 — Workspace list / hub page
 * Route: /workspaces
 *
 * Lists all workspaces for the current user with creation affordance.
 * Also shows "Recently Pinned" hint when no workspaces exist.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

const T = {
  bg:     '#0A0E17',
  panel:  '#0F1319',
  header: '#1A1F2E',
  border: '#1E2538',
  borderMed: '#2A3348',
  amber:  '#F5A623',
  green:  '#00D26A',
  red:    '#FF4757',
  muted:  '#4A5568',
  secondary: '#8B95A5',
  primary: '#E8ECF1',
  hover:  '#1E2538',
  mono:   "'JetBrains Mono','Fira Code',monospace",
};

interface WorkspaceSummary {
  id: string;
  name: string;
  panel_count: number;
  updated_at: string;
}

const PANEL_TYPE_ICONS: Record<string, string> = {
  deal_summary: '■',
  market_chart: '▲',
  module_table: '◆',
};

export default function WorkspaceListPage() {
  const navigate = useNavigate();
  const [workspaces, setWs]   = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/api/v1/workspaces')
      .then(r => setWs(r.data?.data ?? []))
      .catch(() => setWs([]))
      .finally(() => setLoading(false));
  }, []);

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await apiClient.post('/api/v1/workspaces', { name: newName.trim() });
      const ws = r.data?.data;
      if (ws?.id) navigate(`/workspaces/${ws.id}`);
    } catch {
      setCreating(false);
    }
  };

  const deleteWorkspace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this workspace?')) return;
    try {
      await apiClient.delete(`/api/v1/workspaces/${id}`);
      setWs(prev => prev.filter(w => w.id !== id));
    } catch { /* non-fatal */ }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', background: T.header,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.amber, letterSpacing: 2 }}>
            WORKSPACES
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: 9, color: T.amber,
            background: `${T.amber}18`, padding: '1px 6px', borderRadius: 2,
          }}>
            MODE 4
          </span>
          {!loading && (
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 700,
            color: '#000', background: T.amber,
            border: 'none', borderRadius: 2, padding: '5px 14px',
            cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          + NEW WORKSPACE
        </button>
      </div>

      <div style={{ padding: 20, maxWidth: 900 }}>
        {/* Create modal */}
        {showCreate && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowCreate(false)}
          >
            <div style={{
              background: T.panel, border: `1px solid ${T.borderMed}`,
              borderRadius: 4, padding: 20, minWidth: 320,
              boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
            >
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 700, marginBottom: 14 }}>
                NEW WORKSPACE
              </div>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createWorkspace(); }}
                placeholder="Workspace name…"
                autoFocus
                style={{
                  width: '100%', padding: '7px 10px', marginBottom: 14,
                  fontFamily: T.mono, fontSize: 10, color: T.primary,
                  background: T.bg, border: `1px solid ${T.borderMed}`, borderRadius: 2,
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{
                  fontFamily: T.mono, fontSize: 9, color: T.secondary,
                  background: T.bg, border: `1px solid ${T.border}`, borderRadius: 2,
                  padding: '5px 12px', cursor: 'pointer',
                }}>CANCEL</button>
                <button
                  onClick={createWorkspace}
                  disabled={!newName.trim() || creating}
                  style={{
                    fontFamily: T.mono, fontSize: 9, color: '#000', fontWeight: 700,
                    background: newName.trim() && !creating ? T.amber : T.muted,
                    border: 'none', borderRadius: 2,
                    padding: '5px 12px', cursor: newName.trim() && !creating ? 'pointer' : 'default',
                  }}
                >
                  {creating ? 'CREATING…' : 'CREATE'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, padding: 24 }}>
            loading…
          </div>
        )}

        {!loading && workspaces.length === 0 && (
          <div style={{
            marginTop: 40, textAlign: 'center',
            fontFamily: T.mono, color: T.muted,
          }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>No workspaces yet</div>
            <div style={{ fontSize: 9, color: T.border, marginBottom: 20 }}>
              Create a workspace and pin deal summaries, market signals, or module outputs
            </div>
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 16, fontSize: 9, color: T.secondary,
            }}>
              {[
                { icon: '■', label: 'Deal Summary Strip', desc: 'Pin any deal\'s key metrics' },
                { icon: '▲', label: 'Market Signals Chart', desc: 'Live bullish/bearish signals' },
                { icon: '◆', label: 'Module Output Table', desc: 'COR-01..30 correlation table' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{
                  background: T.panel, border: `1px solid ${T.border}`,
                  borderRadius: 3, padding: '12px 16px', width: 160, textAlign: 'left',
                }}>
                  <div style={{ fontSize: 14, color: T.amber, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: 3, color: T.primary }}>{label}</div>
                  <div style={{ color: T.muted }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && workspaces.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {workspaces.map(ws => (
              <div
                key={ws.id}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
                style={{
                  background: T.panel, border: `1px solid ${T.border}`,
                  borderRadius: 3, padding: '12px 14px',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = T.amber + '50')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.primary }}>
                    {ws.name}
                  </span>
                  <button
                    onClick={e => deleteWorkspace(ws.id, e)}
                    style={{
                      fontFamily: T.mono, fontSize: 11, color: T.muted,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1,
                    }}
                    title="Delete workspace"
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.mono, fontSize: 9, color: T.muted }}>
                  <span>{ws.panel_count} panel{ws.panel_count !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>
                    {new Date(ws.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
