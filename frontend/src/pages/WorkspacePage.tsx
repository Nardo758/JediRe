/**
 * Task #920 — Workspace composability (Mode 4, Gap 6)
 *
 * Free-form grid canvas where the operator pins panels from deals,
 * markets, and module outputs. Layout persists per user in user_workspaces.
 *
 * Grid: 12 columns × unlimited rows, each cell 180 × 140 px with 4 px gap.
 * Drag: onMouseDown → document mousemove → snap on mouseup.
 * Resize: bottom-right handle, same snap logic.
 * Auto-save: debounced PATCH 600 ms after last layout mutation.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:     '#0A0E17',
  panel:  '#0F1319',
  panelAlt: '#131821',
  header: '#1A1F2E',
  hover:  '#1E2538',
  border: '#1E2538',
  borderMed: '#2A3348',
  amber:  '#F5A623',
  green:  '#00D26A',
  red:    '#FF4757',
  cyan:   '#00BCD4',
  violet: '#A78BFA',
  muted:  '#4A5568',
  secondary: '#8B95A5',
  primary: '#E8ECF1',
  mono:   "'JetBrains Mono','Fira Code',monospace",
};

// ─── Grid constants ───────────────────────────────────────────────────────────
const CELL_W  = 180;
const CELL_H  = 140;
const GAP     = 4;
const COLS    = 12;

function toPixels(gridX: number, gridY: number, gridW: number, gridH: number) {
  return {
    left:   gridX * (CELL_W + GAP),
    top:    gridY * (CELL_H + GAP),
    width:  gridW * (CELL_W + GAP) - GAP,
    height: gridH * (CELL_H + GAP) - GAP,
  };
}

function snapToGrid(px: number, cellSize: number): number {
  return Math.max(0, Math.round(px / (cellSize + GAP)));
}

// ─── Panel descriptor ─────────────────────────────────────────────────────────
export type PanelType = 'deal_summary' | 'market_chart' | 'module_table';

export interface PanelDescriptor {
  id: string;
  panel_type: PanelType;
  entity_id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Panel type registry ─────────────────────────────────────────────────────
const PANEL_DEFAULTS: Record<PanelType, { w: number; h: number; label: string }> = {
  deal_summary:  { w: 4, h: 3, label: 'Deal Summary' },
  market_chart:  { w: 4, h: 3, label: 'Market Signals' },
  module_table:  { w: 4, h: 3, label: 'Correlation Output' },
};

// ─── Individual panel content components ─────────────────────────────────────

function DealSummaryPanel({ entityId, height }: { entityId: string; height: number }) {
  const [deal, setDeal]     = useState<any>(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoad(true);
    // Try the deals endpoint first; fall back to capsules if not found
    apiClient.get(`/api/v1/deals/${entityId}`)
      .then(r => {
        const d = r.data?.data ?? r.data ?? null;
        if (d && d.id) { setDeal(d); setError(null); }
        else throw new Error('empty');
      })
      .catch(() =>
        apiClient.get(`/api/v1/capsules/${entityId}`)
          .then(r => {
            const d = r.data?.data ?? r.data ?? null;
            setDeal(d);
            setError(d ? null : 'Not found');
          })
          .catch(e => setError(e.message ?? 'Failed'))
      )
      .finally(() => setLoad(false));
  }, [entityId]);

  if (loading) return <LoadingState />;
  if (error || !deal) return <ErrorState msg={error ?? 'No deal data'} />;

  const rows: Array<{ l: string; v: string; c?: string }> = [
    { l: 'ADDRESS', v: deal.property_address ?? deal.address ?? entityId },
    { l: 'ASSET',   v: deal.asset_class ?? '—' },
    { l: 'PRICE',   v: deal.purchase_price != null ? `$${Number(deal.purchase_price).toLocaleString()}` : deal.asking_price != null ? `$${Number(deal.asking_price).toLocaleString()}` : '—' },
    { l: 'JEDI',    v: deal.jedi_score != null ? String(deal.jedi_score) : '—', c: T.amber },
    { l: 'STATUS',  v: deal.status ?? '—' },
    { l: 'STAGE',   v: deal.stage ?? deal.deal_stage ?? '—' },
  ];

  return (
    <div style={{ padding: '6px 8px', overflowY: 'auto', height: height - 32 }}>
      {rows.map(r => (
        <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{r.l}</span>
          <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, color: r.c ?? T.primary }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function MarketChartPanel({ entityId, height }: { entityId: string; height: number }) {
  const [data, setData]    = useState<any>(null);
  const [loading, setLoad] = useState(true);
  const [error, setError]  = useState<string | null>(null);

  useEffect(() => {
    const [city, state] = entityId.split(',').map(s => s.trim());
    setLoad(true);
    apiClient.get('/api/v1/correlations/summary', { params: { city: city || 'Atlanta', state: state || 'GA' } })
      .then(r => { setData(r.data?.data ?? null); setError(null); })
      .catch(e => setError(e.message ?? 'Failed'))
      .finally(() => setLoad(false));
  }, [entityId]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error ?? 'No data'} />;

  const sum = data.summary ?? {};
  const total = (sum.bullishSignals ?? 0) + (sum.bearishSignals ?? 0) + (sum.neutralSignals ?? 0);
  const bullPct = total > 0 ? Math.round(((sum.bullishSignals ?? 0) / total) * 100) : 0;
  const bearPct = total > 0 ? Math.round(((sum.bearishSignals ?? 0) / total) * 100) : 0;

  return (
    <div style={{ padding: '6px 8px', overflowY: 'auto', height: height - 32 }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.secondary, marginBottom: 6 }}>
        {data.market ?? entityId} · {data.metricsComputed}/{(data.metricsComputed ?? 0) + (data.metricsSkipped ?? 0)} signals
      </div>
      {[
        { l: 'BULLISH', v: sum.bullishSignals ?? 0, pct: bullPct, c: T.green },
        { l: 'BEARISH', v: sum.bearishSignals ?? 0, pct: bearPct, c: T.red },
        { l: 'NEUTRAL', v: sum.neutralSignals ?? 0, pct: 0, c: T.secondary },
        { l: 'PENDING', v: sum.insufficientData ?? 0, pct: 0, c: T.muted },
      ].map(r => (
        <div key={r.l} style={{ marginBottom: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{r.l}</span>
            <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, color: r.c }}>{r.v}</span>
          </div>
          {r.pct > 0 && (
            <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${r.pct}%`, height: '100%', background: r.c }} />
            </div>
          )}
        </div>
      ))}
      {sum.topOpportunity && (
        <div style={{ marginTop: 6, padding: '4px 6px', background: `${T.green}10`, borderLeft: `2px solid ${T.green}` }}>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.green }}>★ {sum.topOpportunity}</span>
        </div>
      )}
    </div>
  );
}

function ModuleTablePanel({ entityId, height }: { entityId: string; height: number }) {
  const [data, setData]    = useState<any[]>([]);
  const [loading, setLoad] = useState(true);
  const [error, setError]  = useState<string | null>(null);

  useEffect(() => {
    const [city, state] = entityId.split(',').map(s => s.trim());
    setLoad(true);
    apiClient.get('/api/v1/correlations/report', { params: { city: city || 'Atlanta', state: state || 'GA' } })
      .then(r => {
        const corrs = r.data?.data?.correlations ?? [];
        setData(corrs.filter((c: any) => c.confidence !== 'insufficient').slice(0, 10));
        setError(null);
      })
      .catch(e => setError(e.message ?? 'Failed'))
      .finally(() => setLoad(false));
  }, [entityId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState msg={error} />;

  const signalColor = (s: string) => s === 'bullish' ? T.green : s === 'bearish' ? T.red : T.secondary;
  const confColor   = (c: string) => c === 'high' ? T.green : c === 'medium' ? T.cyan : T.amber;

  return (
    <div style={{ overflowY: 'auto', height: height - 32 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.mono, fontSize: 9 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['ID', 'NAME', 'SIGNAL', 'CONF'].map(h => (
              <th key={h} style={{ padding: '3px 6px', textAlign: 'left', color: T.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c: any) => (
            <tr key={c.id} style={{ borderBottom: `1px solid ${T.border}20` }}>
              <td style={{ padding: '3px 6px', color: T.amber, fontWeight: 700 }}>{c.id}</td>
              <td style={{ padding: '3px 6px', color: T.secondary, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
              <td style={{ padding: '3px 6px', color: signalColor(c.signal), fontWeight: 700 }}>{(c.signal ?? '—').slice(0, 4).toUpperCase()}</td>
              <td style={{ padding: '3px 6px', color: confColor(c.confidence) }}>{c.confidence?.slice(0, 3).toUpperCase() ?? '—'}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '10px 6px', color: T.muted, textAlign: 'center' }}>No signals</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: T.mono, fontSize: 9, color: T.muted }}>
      loading…
    </div>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 8, fontFamily: T.mono, fontSize: 9, color: T.red }}>
      ⚠ {msg}
    </div>
  );
}

// ─── Panel content dispatcher ─────────────────────────────────────────────────
function PanelContent({ panel, height }: { panel: PanelDescriptor; height: number }) {
  switch (panel.panel_type) {
    case 'deal_summary': return <DealSummaryPanel entityId={panel.entity_id} height={height} />;
    case 'market_chart': return <MarketChartPanel entityId={panel.entity_id} height={height} />;
    case 'module_table': return <ModuleTablePanel entityId={panel.entity_id} height={height} />;
    default: return <ErrorState msg={`Unknown panel type: ${(panel as any).panel_type}`} />;
  }
}

// ─── Draggable panel ─────────────────────────────────────────────────────────
interface DraggablePanelProps {
  panel: PanelDescriptor;
  onUpdate: (id: string, patch: Partial<PanelDescriptor>) => void;
  onRemove: (id: string) => void;
}

function DraggablePanel({ panel, onUpdate, onRemove }: DraggablePanelProps) {
  const { left, top, width, height } = toPixels(panel.x, panel.y, panel.w, panel.h);
  const dragOrigin = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number } | null>(null);
  const resOrigin  = useRef<{ mouseX: number; mouseY: number; panelW: number; panelH: number } | null>(null);
  const [live, setLive] = useState({ left, top, width, height });

  useEffect(() => {
    setLive(toPixels(panel.x, panel.y, panel.w, panel.h));
  }, [panel.x, panel.y, panel.w, panel.h]);

  // Drag
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, panelX: panel.x, panelY: panel.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragOrigin.current) return;
      const dxPx = ev.clientX - dragOrigin.current.mouseX;
      const dyPx = ev.clientY - dragOrigin.current.mouseY;
      setLive(prev => ({
        ...prev,
        left: dragOrigin.current!.panelX * (CELL_W + GAP) + dxPx,
        top:  dragOrigin.current!.panelY * (CELL_H + GAP) + dyPx,
      }));
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!dragOrigin.current) return;
      const dxPx = ev.clientX - dragOrigin.current.mouseX;
      const dyPx = ev.clientY - dragOrigin.current.mouseY;
      const rawLeft = dragOrigin.current.panelX * (CELL_W + GAP) + dxPx;
      const rawTop  = dragOrigin.current.panelY * (CELL_H + GAP) + dyPx;
      const newX = Math.min(COLS - panel.w, Math.max(0, snapToGrid(rawLeft, CELL_W)));
      const newY = Math.max(0, snapToGrid(rawTop, CELL_H));
      dragOrigin.current = null;
      onUpdate(panel.id, { x: newX, y: newY });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Resize
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, panelW: panel.w, panelH: panel.h };

    const onMove = (ev: MouseEvent) => {
      if (!resOrigin.current) return;
      const dxPx = ev.clientX - resOrigin.current.mouseX;
      const dyPx = ev.clientY - resOrigin.current.mouseY;
      const newW = Math.max(1, resOrigin.current.panelW * (CELL_W + GAP) + dxPx);
      const newH = Math.max(1, resOrigin.current.panelH * (CELL_H + GAP) + dyPx);
      setLive(prev => ({ ...prev, width: newW - GAP, height: newH - GAP }));
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!resOrigin.current) return;
      const dxPx = ev.clientX - resOrigin.current.mouseX;
      const dyPx = ev.clientY - resOrigin.current.mouseY;
      const rawW = resOrigin.current.panelW * (CELL_W + GAP) + dxPx;
      const rawH = resOrigin.current.panelH * (CELL_H + GAP) + dyPx;
      const newW = Math.max(1, Math.min(COLS - panel.x, Math.round(rawW / (CELL_W + GAP))));
      const newH = Math.max(1, Math.round(rawH / (CELL_H + GAP)));
      resOrigin.current = null;
      onUpdate(panel.id, { w: newW, h: newH });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const panelTypeLabel: Record<PanelType, string> = {
    deal_summary: 'DEAL',
    market_chart: 'MARKET',
    module_table: 'MODULE',
  };
  const panelTypeColor: Record<PanelType, string> = {
    deal_summary: T.amber,
    market_chart: T.cyan,
    module_table: T.violet,
  };

  return (
    <div style={{
      position: 'absolute',
      left: live.left, top: live.top,
      width: live.width, height: live.height,
      background: T.panel, border: `1px solid ${T.borderMed}`,
      borderRadius: 3, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', userSelect: 'none',
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      transition: dragOrigin.current ? 'none' : 'box-shadow 0.1s',
      zIndex: dragOrigin.current ? 10 : 1,
    }}>
      {/* Drag header */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px', background: T.header,
          borderBottom: `1px solid ${T.border}`, cursor: 'grab', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: T.mono, fontSize: 8, fontWeight: 700,
            color: panelTypeColor[panel.panel_type], background: `${panelTypeColor[panel.panel_type]}18`,
            padding: '1px 4px', borderRadius: 2, letterSpacing: 0.5,
          }}>
            {panelTypeLabel[panel.panel_type]}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
            {panel.label || panel.entity_id}
          </span>
        </div>
        <button
          onClick={() => onRemove(panel.id)}
          onMouseDown={e => e.stopPropagation()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: T.mono, fontSize: 11, color: T.muted, padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelContent panel={panel} height={live.height} />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 12, height: 12, cursor: 'se-resize',
          background: `linear-gradient(135deg, transparent 50%, ${T.muted} 50%)`,
        }}
      />
    </div>
  );
}

// ─── Add panel dialog ─────────────────────────────────────────────────────────
interface AddPanelDialogProps {
  panels: PanelDescriptor[];
  onAdd: (panel: PanelDescriptor) => void;
  onClose: () => void;
}

function AddPanelDialog({ panels, onAdd, onClose }: AddPanelDialogProps) {
  const [type, setType]       = useState<PanelType>('deal_summary');
  const [entityId, setEntity] = useState('');
  const [label, setLabel]     = useState('');

  const placeholders: Record<PanelType, string> = {
    deal_summary: 'Deal UUID (e.g. abc123-...)',
    market_chart: 'City, State (e.g. Atlanta, GA)',
    module_table: 'City, State (e.g. Atlanta, GA)',
  };

  const submit = () => {
    if (!entityId.trim()) return;
    const def = PANEL_DEFAULTS[type];
    // Compute next open row
    const maxY = panels.length === 0 ? 0
      : Math.max(...panels.map(p => p.y + p.h));
    onAdd({
      id: crypto.randomUUID(),
      panel_type: type,
      entity_id: entityId.trim(),
      label: label.trim() || entityId.trim(),
      x: 0, y: maxY,
      w: def.w, h: def.h,
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
    onClick={onClose}
    >
      <div style={{
        background: T.panel, border: `1px solid ${T.borderMed}`,
        borderRadius: 4, padding: 20, minWidth: 360,
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
      }}
      onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 700, marginBottom: 14, letterSpacing: 1 }}>
          ADD PANEL
        </div>

        <label style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, display: 'block', marginBottom: 4 }}>PANEL TYPE</label>
        <select
          value={type}
          onChange={e => setType(e.target.value as PanelType)}
          style={{
            width: '100%', padding: '6px 8px', marginBottom: 12,
            fontFamily: T.mono, fontSize: 10, color: T.primary,
            background: T.bg, border: `1px solid ${T.borderMed}`, borderRadius: 2,
          }}
        >
          <option value="deal_summary">Deal Summary Strip</option>
          <option value="market_chart">Market Signals Chart</option>
          <option value="module_table">Module Output Table</option>
        </select>

        <label style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, display: 'block', marginBottom: 4 }}>
          {type === 'deal_summary' ? 'DEAL ID' : 'MARKET'}
        </label>
        <input
          type="text"
          value={entityId}
          onChange={e => setEntity(e.target.value)}
          placeholder={placeholders[type]}
          style={{
            width: '100%', padding: '6px 8px', marginBottom: 12,
            fontFamily: T.mono, fontSize: 10, color: T.primary,
            background: T.bg, border: `1px solid ${T.borderMed}`, borderRadius: 2,
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, display: 'block', marginBottom: 4 }}>LABEL (OPTIONAL)</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Custom display name"
          style={{
            width: '100%', padding: '6px 8px', marginBottom: 16,
            fontFamily: T.mono, fontSize: 10, color: T.primary,
            background: T.bg, border: `1px solid ${T.borderMed}`, borderRadius: 2,
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            fontFamily: T.mono, fontSize: 9, color: T.secondary,
            background: T.bg, border: `1px solid ${T.border}`, borderRadius: 2,
            padding: '6px 14px', cursor: 'pointer',
          }}>CANCEL</button>
          <button onClick={submit} disabled={!entityId.trim()} style={{
            fontFamily: T.mono, fontSize: 9, color: '#000', fontWeight: 700,
            background: entityId.trim() ? T.amber : T.muted,
            border: 'none', borderRadius: 2,
            padding: '6px 14px', cursor: entityId.trim() ? 'pointer' : 'default',
          }}>ADD PANEL</button>
        </div>
      </div>
    </div>
  );
}

// ─── Workspace canvas ─────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<{ id: string; name: string; layout: PanelDescriptor[] } | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);
  const [showAdd, setShowAdd]  = useState(false);
  const [saving, setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load workspace ──
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.get(`/api/v1/workspaces/${id}`)
      .then(r => {
        const ws = r.data?.data;
        setWorkspace({ id: ws.id, name: ws.name, layout: ws.layout ?? [] });
        setNameInput(ws.name);
      })
      .catch(e => setError(e.message ?? 'Failed to load workspace'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Persist layout (debounced) ──
  const schedSave = useCallback((layout: PanelDescriptor[]) => {
    if (!id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    setSaveError(null);
    saveTimer.current = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/workspaces/${id}`, { layout });
      } catch (e: any) {
        setSaveError(e?.response?.data?.error ?? e?.message ?? 'Save failed');
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [id]);

  const updatePanel = useCallback((panelId: string, patch: Partial<PanelDescriptor>) => {
    setWorkspace(ws => {
      if (!ws) return ws;
      const layout = ws.layout.map(p => p.id === panelId ? { ...p, ...patch } : p);
      schedSave(layout);
      return { ...ws, layout };
    });
  }, [schedSave]);

  const removePanel = useCallback((panelId: string) => {
    setWorkspace(ws => {
      if (!ws) return ws;
      const layout = ws.layout.filter(p => p.id !== panelId);
      schedSave(layout);
      return { ...ws, layout };
    });
  }, [schedSave]);

  const addPanel = useCallback((panel: PanelDescriptor) => {
    setWorkspace(ws => {
      if (!ws) return ws;
      const layout = [...ws.layout, panel];
      schedSave(layout);
      return { ...ws, layout };
    });
  }, [schedSave]);

  const saveName = async () => {
    if (!id || !nameInput.trim()) return;
    try {
      await apiClient.patch(`/api/v1/workspaces/${id}`, { name: nameInput.trim() });
      setWorkspace(ws => ws ? { ...ws, name: nameInput.trim() } : ws);
    } catch { /* non-fatal */ }
    setEditName(false);
  };

  // Canvas height: enough to fit all panels + buffer
  const canvasHeight = useMemo(() => {
    if (!workspace?.layout.length) return 6 * (CELL_H + GAP);
    const maxRow = Math.max(...workspace.layout.map(p => p.y + p.h));
    return (maxRow + 4) * (CELL_H + GAP);
  }, [workspace?.layout]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.mono, fontSize: 11, color: T.muted }}>
        loading workspace…
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, padding: 32, fontFamily: T.mono, fontSize: 11, color: T.red }}>
        ⚠ {error ?? 'Workspace not found'}
        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate('/workspaces')} style={{ fontFamily: T.mono, fontSize: 9, color: T.amber, background: 'none', border: `1px solid ${T.amber}`, borderRadius: 2, padding: '4px 10px', cursor: 'pointer' }}>
            ← Back to workspaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', background: T.header,
        borderBottom: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/workspaces')}
          style={{ fontFamily: T.mono, fontSize: 9, color: T.secondary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← WORKSPACES
        </button>

        <span style={{ color: T.borderMed }}>|</span>

        {editName ? (
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditName(false); }}
            autoFocus
            style={{
              fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 700,
              background: 'none', border: `1px solid ${T.amber}50`, borderRadius: 2,
              padding: '2px 6px', outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditName(true)}
            style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, fontWeight: 700, cursor: 'text' }}
            title="Click to rename"
          >
            {workspace.name}
          </span>
        )}

        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>
          {workspace.layout.length} panel{workspace.layout.length !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {saving && (
          <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>saving…</span>
        )}
        {saveError && !saving && (
          <span style={{ fontFamily: T.mono, fontSize: 9, color: '#FF4757' }} title={saveError}>
            ⚠ save failed
          </span>
        )}

        <button
          onClick={() => setShowAdd(true)}
          style={{
            fontFamily: T.mono, fontSize: 9, fontWeight: 700,
            color: '#000', background: T.amber,
            border: 'none', borderRadius: 2, padding: '5px 12px',
            cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          + ADD PANEL
        </button>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{
          position: 'relative',
          width: COLS * (CELL_W + GAP) - GAP,
          height: canvasHeight,
          backgroundImage: `
            linear-gradient(${T.border}30 1px, transparent 1px),
            linear-gradient(90deg, ${T.border}30 1px, transparent 1px)
          `,
          backgroundSize: `${CELL_W + GAP}px ${CELL_H + GAP}px`,
        }}>
          {workspace.layout.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                Empty workspace
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.border }}>
                Click "ADD PANEL" to pin a deal, market, or module here
              </div>
            </div>
          )}
          {workspace.layout.map(panel => (
            <DraggablePanel
              key={panel.id}
              panel={panel}
              onUpdate={updatePanel}
              onRemove={removePanel}
            />
          ))}
        </div>
      </div>

      {showAdd && (
        <AddPanelDialog
          panels={workspace.layout}
          onAdd={addPanel}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
