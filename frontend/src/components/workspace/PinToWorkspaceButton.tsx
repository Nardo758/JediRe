/**
 * Task #920 — Pin to Workspace affordance
 *
 * Drop-in button placed in deal overview, market intel pages, and module
 * outputs. On click it opens a small popover listing the user's workspaces
 * and appends the specified panel to the chosen workspace.
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../services/api.client';

export type PanelType = 'deal_summary' | 'market_chart' | 'module_table';

export interface PinPayload {
  panel_type: PanelType;
  entity_id: string;
  label?: string;
}

interface Workspace {
  id: string;
  name: string;
  panel_count: number;
}

interface Props {
  payload: PinPayload;
  size?: 'sm' | 'md';
}

const T = {
  bg: '#0F1319',
  panel: '#131821',
  border: '#1E2538',
  amber: '#F5A623',
  green: '#00D26A',
  muted: '#4A5568',
  secondary: '#8B95A5',
  primary: '#E8ECF1',
  hover: '#1E2538',
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

function nextGridPos(panels: any[]): { x: number; y: number; w: number; h: number } {
  if (panels.length === 0) return { x: 0, y: 0, w: 4, h: 3 };
  const maxRow = Math.max(...panels.map((p: any) => (p.y ?? 0) + (p.h ?? 3)));
  return { x: 0, y: maxRow, w: 4, h: 3 };
}

export function PinToWorkspaceButton({ payload, size = 'sm' }: Props) {
  const [open, setOpen]       = useState(false);
  const [workspaces, setWs]   = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinned, setPinned]   = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient.get('/api/v1/workspaces')
      .then(r => setWs(r.data?.data ?? []))
      .catch(() => setWs([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pin = async (wsId: string) => {
    try {
      // Fetch current layout to compute next position
      const ws = await apiClient.get(`/api/v1/workspaces/${wsId}`);
      const layout: any[] = ws.data?.data?.layout ?? [];
      const pos = nextGridPos(layout);
      const newPanel = {
        id: crypto.randomUUID(),
        panel_type: payload.panel_type,
        entity_id: payload.entity_id,
        label: payload.label || payload.entity_id,
        ...pos,
      };
      await apiClient.patch(`/api/v1/workspaces/${wsId}`, {
        layout: [...layout, newPanel],
      });
      setPinned(wsId);
      setTimeout(() => { setOpen(false); setPinned(null); }, 1200);
    } catch {
      // silent
    }
  };

  const createAndPin = async () => {
    try {
      const res = await apiClient.post('/api/v1/workspaces', { name: 'My Workspace' });
      const wsId = res.data?.data?.id;
      if (wsId) await pin(wsId);
    } catch {
      // silent
    }
  };

  const fs = size === 'sm' ? 9 : 10;
  const px = size === 'sm' ? '5px 8px' : '6px 12px';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Pin to workspace"
        style={{
          fontFamily: T.mono, fontSize: fs, fontWeight: 700,
          color: T.amber, background: `${T.amber}12`,
          border: `1px solid ${T.amber}30`,
          padding: px, borderRadius: 2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          letterSpacing: 0.5,
        }}
      >
        ⊞ PIN
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 9999,
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 3, minWidth: 200, marginTop: 3,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            padding: '6px 10px', borderBottom: `1px solid ${T.border}`,
            fontFamily: T.mono, fontSize: 9, color: T.muted, letterSpacing: 1,
          }}>
            PIN TO WORKSPACE
          </div>
          {loading && (
            <div style={{ padding: '8px 10px', fontFamily: T.mono, fontSize: 9, color: T.muted }}>
              loading…
            </div>
          )}
          {!loading && workspaces.length === 0 && (
            <button
              onClick={createAndPin}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 9, color: T.amber,
              }}
            >
              + Create workspace &amp; pin
            </button>
          )}
          {!loading && workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => pin(ws.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', textAlign: 'left',
                padding: '7px 10px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 9,
                color: pinned === ws.id ? T.green : T.primary,
                borderBottom: `1px solid ${T.border}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{pinned === ws.id ? '✓ Pinned' : ws.name}</span>
              <span style={{ color: T.muted }}>{ws.panel_count} panels</span>
            </button>
          ))}
          {!loading && workspaces.length > 0 && (
            <button
              onClick={createAndPin}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 9, color: T.muted,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T.amber)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}
            >
              + New workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
