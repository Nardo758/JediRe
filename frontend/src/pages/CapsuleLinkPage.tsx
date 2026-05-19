import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Lock, Loader2, CheckCircle, TrendingUp, ChevronRight, Send, Key,
  BarChart3, DollarSign, Activity, Zap, Shield, Clock, RotateCcw,
  Building2, MapPin, Car, Layers, Users, Target, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShareInfo {
  share_type: string;
  agent_enabled: boolean;
  allow_document_download: boolean;
  allow_agent_interaction: boolean;
  expires_at: string | null;
  preview_text: string | null;
  preview_metadata: Record<string, unknown> | null;
  recipient_email: string;
}

interface CapsuleInfo {
  id: string;
  property_address: string;
  asset_class: string;
  status: string;
  jedi_score: number | null;
  collision_score: number | null;
  deal_data: Record<string, unknown>;
  platform_intel: Record<string, unknown>;
  user_adjustments: Record<string, unknown>;
  module_outputs: Record<string, unknown>;
  snapshot_taken_at: string | null;
  created_at: string;
}

interface DealBookData {
  share: ShareInfo;
  capsule: CapsuleInfo;
  overlay: Record<string, unknown>;
}

interface ConvMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
  usage?: { tokens_input: number; tokens_output: number; total_charged_usd: number };
}

type TabId = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9' | 'f10' | 'f11' | 'agent';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtM(n: number | unknown): string {
  const v = Number(n);
  if (!n || isNaN(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtDollar(n: number | unknown): string {
  const v = Number(n);
  if (!n || isNaN(v)) return '—';
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | unknown, dp = 1): string {
  const v = Number(n);
  if (n == null || isNaN(v)) return '—';
  return `${v.toFixed(dp)}%`;
}

function fmtX(n: number | unknown): string {
  const v = Number(n);
  if (!n || isNaN(v)) return '—';
  return `${v.toFixed(2)}x`;
}

function fmtYrs(n: number | unknown): string {
  const v = Number(n);
  if (!n || isNaN(v)) return '—';
  return `${v} yr${v !== 1 ? 's' : ''}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function str(v: unknown): string {
  if (v == null) return '—';
  const s = String(v).trim();
  return s || '—';
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG = '#0B0E1A';
const SURFACE = '#131929';
const SURFACE2 = '#0f1520';
const BORDER = '#1E2538';
const TEXT = '#E2E8F0';
const MUTED = '#6B7A8D';
const BLUE = '#0891B2';
const GREEN = '#10B981';
const AMBER = '#D97706';
const RED = '#EF4444';
const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

// ── Overlay utilities ─────────────────────────────────────────────────────────

function applyOverlay(capsule: CapsuleInfo, overlay: Record<string, unknown>): CapsuleInfo {
  if (Object.keys(overlay).length === 0) return capsule;
  const result = JSON.parse(JSON.stringify(capsule)) as CapsuleInfo;
  for (const [path, value] of Object.entries(overlay)) {
    const parts = path.split('.');
    let obj: Record<string, unknown> = result as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null || typeof obj[parts[i]] !== 'object') {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;
  }
  return result;
}

const SECTION_RESET_PREFIXES: Record<string, string[]> = {
  f1: ['user_adjustments.'],
  f5: ['recipient_overrides.capital_stack.'],
  f6: ['recipient_overrides.capital_stack.', 'user_adjustments.max_ltv'],
  f9: ['deal_data.exit_cap', 'user_adjustments.rent_growth'],
};

function sectionOverlayKeys(tab: string, overlay: Record<string, unknown>): string[] {
  const prefixes = SECTION_RESET_PREFIXES[tab] ?? [];
  return Object.keys(overlay).filter(k => prefixes.some(p => k.startsWith(p)));
}

// ── Helper components ─────────────────────────────────────────────────────────

function SnapshotAttr({ date }: { date: string | null | undefined }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontFamily: MONO, color: MUTED,
      background: SURFACE2, border: `1px solid ${BORDER}`,
      borderRadius: 3, padding: '2px 7px',
    }}>
      SNAPSHOT · {date ? fmtDate(date) : 'frozen at share time'}
    </span>
  );
}

function KpiTile({ label, value, sub, accent = TEXT }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', minWidth: 110, flex: '1 1 110px' }}>
      <div style={{ fontSize: 10, fontFamily: MONO, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontFamily: MONO, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function EditableKpiTile({
  label, path, rawValue, senderRaw, fmt, overlay, onPatch, onReset, accent = TEXT,
}: {
  label: string; path: string; rawValue: unknown; senderRaw: unknown;
  fmt: (v: unknown) => string; overlay: Record<string, unknown>;
  onPatch: (path: string, val: number) => void; onReset: (path: string) => void;
  accent?: string;
}) {
  const isModified = path in overlay;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    const n = Number(rawValue);
    setDraft(isNaN(n) ? '' : String(n));
    setEditing(true);
  }
  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n)) onPatch(path, n);
    setEditing(false);
  }

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${isModified ? BLUE + '55' : BORDER}`,
      borderRadius: 8, padding: '14px 16px', minWidth: 110, flex: '1 1 110px',
      position: 'relative', cursor: 'default',
    }}>
      {isModified && (
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} title={`Sender's value: ${fmt(senderRaw)}`} />
          <button
            onClick={e => { e.stopPropagation(); onReset(path); }}
            style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
            title="Reset to sender's value"
          >×</button>
        </div>
      )}
      <div style={{ fontSize: 10, fontFamily: MONO, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      {editing ? (
        <input
          type="number" step="any" value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          style={{ width: '100%', padding: '4px 6px', fontSize: 16, fontFamily: MONO, background: SURFACE2, color: TEXT, border: `1px solid ${BLUE}`, borderRadius: 4, outline: 'none' }}
        />
      ) : (
        <div
          onClick={startEdit}
          style={{ fontSize: 19, fontFamily: MONO, fontWeight: 700, color: isModified ? BLUE : accent, lineHeight: 1.1, cursor: 'text' }}
          title={isModified ? `Your value — click to edit. Sender's: ${fmt(senderRaw)}` : 'Click to set your value'}
        >
          {fmt(rawValue)}
        </div>
      )}
      {isModified && <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Sender: {fmt(senderRaw)}</div>}
      {!isModified && !editing && <div style={{ fontSize: 9, color: MUTED + '88', marginTop: 4, fontFamily: MONO }}>click to set</div>}
    </div>
  );
}

function EditableDebtRow({
  label, path, rawValue, senderRaw, fmt, overlay, onPatch, onReset,
}: {
  label: string; path: string; rawValue: unknown; senderRaw: unknown;
  fmt: (v: unknown) => string; overlay: Record<string, unknown>;
  onPatch: (path: string, val: number) => void; onReset: (path: string) => void;
}) {
  const isModified = path in overlay;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    const n = Number(rawValue);
    setDraft(isNaN(n) ? '' : String(n));
    setEditing(true);
  }
  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n)) onPatch(path, n);
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderTop: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isModified && (
          <>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE }} title={`Sender's value: ${fmt(senderRaw)}`} />
            <span style={{ fontSize: 10, color: MUTED }}>was {fmt(senderRaw)}</span>
          </>
        )}
        {editing ? (
          <input
            type="number" step="any" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
            style={{ width: 70, padding: '2px 6px', fontSize: 12, fontFamily: MONO, background: SURFACE, color: TEXT, border: `1px solid ${BLUE}`, borderRadius: 4, outline: 'none', textAlign: 'right' }}
          />
        ) : (
          <span
            onClick={startEdit}
            style={{ fontSize: 12, fontFamily: MONO, color: isModified ? BLUE : TEXT, cursor: 'text' }}
            title={isModified ? `Your value — click to edit. Sender's: ${fmt(senderRaw)}` : 'Click to set your value'}
          >
            {fmt(rawValue)}
          </span>
        )}
        {isModified && (
          <button
            onClick={() => onReset(path)}
            style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}
            title="Reset to sender's value"
          >×</button>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ label, badge, hasModifications, onReset }: {
  label: string; badge?: string; hasModifications?: boolean; onReset?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: MONO, color: MUTED, whiteSpace: 'nowrap', marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>── {label}</span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        {badge && (
          <span style={{ marginLeft: 8, fontSize: 10, fontFamily: MONO, color: BLUE, background: 'rgba(8,145,178,0.1)', border: `1px solid rgba(8,145,178,0.3)`, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{badge}</span>
        )}
        {hasModifications && onReset && (
          <button
            onClick={onReset}
            style={{ marginLeft: 8, background: 'none', border: `1px solid ${BORDER}`, fontSize: 10, color: MUTED, cursor: 'pointer', fontFamily: MONO, padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RotateCcw size={9} /> Reset tab
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: MONO, color: accent ?? TEXT }}>{value}</span>
    </div>
  );
}

function LayerRow({ label, broker, market, model }: { label: string; broker: string; market: string; model: string }) {
  return (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
      <td style={{ padding: '10px 12px', fontSize: 12, color: MUTED, fontFamily: MONO }}>{label}</td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#93C5FD', fontFamily: MONO, textAlign: 'right' }}>{broker}</td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#C4B5FD', fontFamily: MONO, textAlign: 'right' }}>{market}</td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: GREEN, fontFamily: MONO, textAlign: 'right', fontWeight: 600 }}>{model}</td>
    </tr>
  );
}

function CollisionCard({ name, score, insight, action }: { name: string; score: number; insight: string; action: string }) {
  const color = score >= 80 ? GREEN : score >= 60 ? AMBER : RED;
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: MONO, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{name.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: 18, fontFamily: MONO, fontWeight: 700, color }}>{score}<span style={{ fontSize: 11, color: MUTED }}>/100</span></span>
      </div>
      <p style={{ fontSize: 12, color: TEXT, lineHeight: 1.6, marginBottom: 8 }}>{insight}</p>
      <div style={{ fontSize: 11, color: AMBER, fontFamily: MONO, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>→ {action}</div>
    </div>
  );
}

function EmptyState({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 36, textAlign: 'center' }}>
      <div style={{ margin: '0 auto 12px', color: MUTED }}>{icon}</div>
      <div style={{ color: MUTED, fontSize: 13 }}>{title}</div>
      {detail && <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>{detail}</div>}
    </div>
  );
}

function SkeletonLine({ w = '100%', h = 14 }: { w?: string; h?: number }) {
  return <div style={{ width: w, height: h, background: BORDER, borderRadius: 4, animation: 'pulse 2s ease-in-out infinite' }} />;
}

function ErrorScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Shield style={{ width: 48, height: 48, color: MUTED, marginBottom: 20 }} />
      <h1 style={{ color: TEXT, fontSize: 20, fontFamily: MONO, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>{title}</h1>
      <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>{detail}</p>
      <div style={{ marginTop: 32, fontSize: 10, fontFamily: MONO, color: MUTED }}>JEDI RE · Deal Intelligence</div>
    </div>
  );
}

// ── F-key Tab Bar definition ──────────────────────────────────────────────────

const ALL_TABS: { id: TabId; fkey: string; label: string; icon: React.ReactNode }[] = [
  { id: 'f1',    fkey: 'F1',    label: 'Overview',     icon: <BarChart3 size={11} /> },
  { id: 'f2',    fkey: 'F2',    label: 'Zoning',       icon: <MapPin size={11} /> },
  { id: 'f3',    fkey: 'F3',    label: 'Traffic',      icon: <Car size={11} /> },
  { id: 'f4',    fkey: 'F4',    label: 'Supply',       icon: <Building2 size={11} /> },
  { id: 'f5',    fkey: 'F5',    label: 'Debt',         icon: <Layers size={11} /> },
  { id: 'f6',    fkey: 'F6',    label: 'Capital',      icon: <DollarSign size={11} /> },
  { id: 'f7',    fkey: 'F7',    label: 'Strategy',     icon: <Target size={11} /> },
  { id: 'f8',    fkey: 'F8',    label: 'Investors',    icon: <Users size={11} /> },
  { id: 'f9',    fkey: 'F9',    label: 'Fin. Engine',  icon: <TrendingUp size={11} /> },
  { id: 'f10',   fkey: 'F10',   label: 'Correlation',  icon: <Activity size={11} /> },
  { id: 'f11',   fkey: 'F11',   label: 'Market Intel', icon: <Zap size={11} /> },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CapsuleLinkPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<DealBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('f1');

  const [overlay, setOverlay] = useState<Record<string, unknown>>({});

  const [connected, setConnected] = useState(false);
  const [connectForm, setConnectForm] = useState({ provider: 'anthropic', api_key: '' });
  const [keyVisible, setKeyVisible] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConvMessage[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const convBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/capsule-links/${token}/deal-book`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError({ status: res.status, msg: body.error ?? 'Failed to load deal book' });
          return;
        }
        const body = await res.json();
        setData(body);
        setOverlay((body.overlay as Record<string, unknown>) ?? {});
      })
      .catch(() => setError({ status: 500, msg: 'Network error — please try again' }))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { convBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversation]);

  // ── Overlay helpers ──────────────────────────────────────────────────────────

  const patchOverlay = useCallback(async (path: string, value: number) => {
    if (!token) return;
    const previous = overlay[path];
    setOverlay(prev => ({ ...prev, [path]: value }));
    try {
      const res = await fetch(`/api/v1/capsule-links/${token}/overlay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [path]: value }),
      });
      if (res.ok) {
        const body = await res.json();
        setOverlay(body.overlay_data ?? {});
      } else {
        setOverlay(prev => {
          const next = { ...prev };
          if (previous === undefined) delete next[path]; else next[path] = previous;
          return next;
        });
      }
    } catch { /* keep optimistic */ }
  }, [token, overlay]);

  const resetOverlay = useCallback(async (path?: string) => {
    if (!token) return;
    const previous = { ...overlay };
    if (path) setOverlay(prev => { const n = { ...prev }; delete n[path]; return n; });
    else setOverlay({});
    try {
      const url = path
        ? `/api/v1/capsule-links/${token}/overlay?path=${encodeURIComponent(path)}`
        : `/api/v1/capsule-links/${token}/overlay`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) setOverlay(previous);
    } catch { /* keep optimistic */ }
  }, [token, overlay]);

  const resetTab = useCallback(async (tab: string) => {
    if (!token) return;
    const keys = sectionOverlayKeys(tab, overlay);
    if (keys.length === 0) return;
    const previous = { ...overlay };
    setOverlay(prev => { const n = { ...prev }; keys.forEach(k => delete n[k]); return n; });
    try {
      await Promise.all(keys.map(k =>
        fetch(`/api/v1/capsule-links/${token}/overlay?path=${encodeURIComponent(k)}`, { method: 'DELETE' })
      ));
    } catch { setOverlay(previous); }
  }, [token, overlay]);

  // ── Agent handlers ───────────────────────────────────────────────────────────

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setConnectLoading(true);
    setConnectError(null);
    try {
      const res = await fetch(`/api/v1/capsule-links/${token}/connect_api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: connectForm.provider, api_key: connectForm.api_key }),
      });
      const body = await res.json();
      if (!res.ok) setConnectError(body.error ?? 'Connection failed');
      else setConnected(true);
    } catch { setConnectError('Network error — please try again'); }
    finally { setConnectLoading(false); }
  };

  const handleQuery = async (msg?: string) => {
    const message = (msg ?? queryInput).trim();
    if (!message || !token || queryLoading) return;
    setQueryInput('');
    setConversation(prev => [...prev, { role: 'user', content: message, ts: new Date() }]);
    setQueryLoading(true);
    try {
      const res = await fetch(`/api/v1/capsule-links/${token}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const body = await res.json();
      if (!res.ok)
        setConversation(prev => [...prev, { role: 'assistant', content: `Error: ${body.error ?? 'Query failed'}`, ts: new Date() }]);
      else
        setConversation(prev => [...prev, { role: 'assistant', content: body.response, ts: new Date(), usage: body.usage }]);
    } catch {
      setConversation(prev => [...prev, { role: 'assistant', content: 'Network error — please try again', ts: new Date() }]);
    } finally { setQueryLoading(false); }
  };

  // ── useMemo — must be before early returns ───────────────────────────────────
  const composed = useMemo(
    () => (data ? applyOverlay(data.capsule, overlay) : null),
    [data, overlay],
  );

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT }}>
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
        <div style={{ height: 48, background: '#0d1117', borderBottom: `1px solid ${BORDER}` }} />
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkeletonLine w="60%" h={28} /><SkeletonLine w="40%" h={16} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[1,2,3,4,5,6,7,8,9,10,11].map(i => <SkeletonLine key={i} w="64px" h={44} />)}
          </div>
          <SkeletonLine h={200} />
        </div>
      </div>
    );
  }

  if (error) {
    if (error.status === 404) return <ErrorScreen title="This link is no longer active" detail="The capsule link you followed has expired, been revoked, or does not exist. Contact the sender to request a new link." />;
    if (error.status === 429) return <ErrorScreen title="Too many requests" detail="Please wait a few minutes before trying again." />;
    return <ErrorScreen title="Unable to load deal book" detail={error.msg} />;
  }

  if (!data) return null;

  const { share, capsule } = data;
  const senderL1 = capsule.deal_data;
  const senderL3 = capsule.user_adjustments;
  const senderMO = capsule.module_outputs;

  const C = composed as ReturnType<typeof applyOverlay>;
  const L1 = C.deal_data;
  const L2 = C.platform_intel;
  const L3 = C.user_adjustments;
  const MO = C.module_outputs;

  // Financial branch — prefer branch with real model data
  const _finFin = MO.financial as Record<string, unknown> | undefined;
  const _finPro = MO.proforma as Record<string, unknown> | undefined;
  const REAL_FIN_KEYS = ['returns', 'year1', 'proforma_year1', 'projections', 'noi', 'irr', 'equity_multiple'];
  const fin = (_finFin && REAL_FIN_KEYS.some(k => k in _finFin)) ? _finFin : (_finPro ?? _finFin);
  const senderFin = (senderMO.financial ?? senderMO.proforma) as Record<string, unknown> | undefined;
  const returns = (fin?.returns ?? fin) as Record<string, unknown> | undefined;
  const y1 = (fin?.year1 ?? fin?.proforma_year1) as Array<Record<string, unknown>> | undefined;

  // Capital stack (overlay in recipient_overrides namespace)
  const senderCapStack = (senderFin?.capital_stack ?? senderFin?.capitalStack ?? {}) as Record<string, unknown>;
  const _recipientOverrides = C.recipient_overrides as Record<string, unknown> | undefined;
  const _overlayCapStack = (_recipientOverrides?.capital_stack as Record<string, unknown> | undefined) ?? {};
  const capitalStack: Record<string, unknown> = {
    ...(fin?.capital_stack ?? fin?.capitalStack ?? senderCapStack) as Record<string, unknown>,
    ..._overlayCapStack,
  };

  // Collision analysis
  const rawCollision = (MO.collision_analysis ?? MO.collision) as Record<string, unknown> | undefined;
  const collisionAnalyses = (rawCollision && 'analyses' in rawCollision ? rawCollision.analyses : rawCollision) as Record<string, { score: number; insight: string; recommended_action: string }> | undefined;

  // New tab data sources
  const zoningMO = (MO.zoning ?? {}) as Record<string, unknown>;
  const trafficMO = (MO.traffic ?? {}) as Record<string, unknown>;
  const supplyMO = (MO.supply ?? {}) as Record<string, unknown>;
  const strategyMO = (MO.strategy ?? {}) as Record<string, unknown>;
  const investorsMO = (MO.investors ?? MO.waterfall ?? {}) as Record<string, unknown>;
  const debtAdvisorMO = (MO.debt_advisor ?? {}) as Record<string, unknown>;

  const expiresAt = share.expires_at;
  const isExpiringSoon = expiresAt && new Date(expiresAt).getTime() - Date.now() < 7 * 86_400_000;
  const hasAnyModifications = Object.keys(overlay).length > 0;
  const snapDate = capsule.snapshot_taken_at;

  const visibleTabs = [
    ...ALL_TABS,
    ...(share.agent_enabled ? [{ id: 'agent' as TabId, fkey: 'AGT', label: 'Agent', icon: <Key size={11} /> }] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${BG}}
        ::-webkit-scrollbar-thumb{background:${BORDER};border-radius:2px}
        textarea,input[type="text"],input[type="password"]{background:${SURFACE}!important;color:${TEXT}!important;border:1px solid ${BORDER}!important;border-radius:6px!important;outline:none!important;font-family:inherit!important}
        textarea:focus,input[type="text"]:focus,input[type="password"]:focus{border-color:${BLUE}!important}
        button{cursor:pointer;font-family:inherit}
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0d1117', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px', height: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, color: BLUE, letterSpacing: '0.15em', fontSize: 13 }}>JEDI RE</span>
            <span style={{ color: BORDER }}>|</span>
            <span style={{ color: MUTED, fontSize: 11 }}>Deal Intelligence Platform</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasAnyModifications && (
              <button
                onClick={() => resetOverlay()}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 4, padding: '4px 10px', fontSize: 10, fontFamily: MONO, color: MUTED }}
                title="Remove all your modifications and return to sender's values"
              >
                <RotateCcw size={9} /> Reset all modifications
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Lock size={10} color={GREEN} />
              <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: '0.12em' }}>SECURED</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 100px' }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div style={{ paddingTop: 28, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontFamily: MONO, color: BLUE, background: 'rgba(8,145,178,0.12)', border: `1px solid rgba(8,145,178,0.3)`, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.08em' }}>
                  {capsule.asset_class || 'REAL ESTATE'}
                </span>
                {L1.units && <span style={{ fontSize: 10, fontFamily: MONO, color: MUTED }}>{String(L1.units)} UNITS</span>}
                {L1.year_built && <span style={{ fontSize: 10, fontFamily: MONO, color: MUTED }}>BUILT {String(L1.year_built)}</span>}
                {snapDate && <SnapshotAttr date={snapDate} />}
                {hasAnyModifications && (
                  <span style={{ fontSize: 9, fontFamily: MONO, color: BLUE, background: 'rgba(8,145,178,0.1)', border: `1px solid rgba(8,145,178,0.3)`, borderRadius: 3, padding: '1px 6px' }}>
                    {Object.keys(overlay).length} MOD{Object.keys(overlay).length !== 1 ? 'S' : ''}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 'clamp(17px, 4vw, 24px)', fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                {capsule.property_address}
              </h1>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              {capsule.jedi_score != null && capsule.jedi_score > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: `1px solid rgba(16,185,129,0.3)`, borderRadius: 8, padding: '5px 10px' }}>
                  <TrendingUp size={13} color={GREEN} />
                  <span style={{ fontFamily: MONO, fontWeight: 700, color: GREEN, fontSize: 13 }}>JEDI {capsule.jedi_score}</span>
                </div>
              )}
              {isExpiringSoon && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: MONO, color: AMBER }}>
                  <Clock size={10} /> Expires {fmtDate(expiresAt)}
                </div>
              )}
            </div>
          </div>
          {share.preview_text && (
            <div style={{ marginTop: 16, background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${BLUE}`, borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: MONO, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>From the sender</div>
              <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{share.preview_text}</p>
            </div>
          )}
        </div>

        {/* ── Bloomberg F-key Tab Bar ────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 46, zIndex: 40, background: BG, borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', minWidth: 'max-content' }}>
            {visibleTabs.map(tab => {
              const tabModified = sectionOverlayKeys(tab.id, overlay).length > 0;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '8px 10px', minWidth: 58,
                    background: 'transparent', border: 'none',
                    borderBottom: `2px solid ${isActive ? BLUE : 'transparent'}`,
                    transition: 'border-color .12s',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 700,
                    color: isActive ? BLUE : MUTED,
                    letterSpacing: '0.05em', lineHeight: 1,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    {tab.fkey}
                    {tabModified && <span style={{ width: 4, height: 4, borderRadius: '50%', background: BLUE, display: 'inline-block' }} />}
                    {tab.id === 'agent' && connected && <span style={{ width: 4, height: 4, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />}
                  </span>
                  <span style={{ fontSize: 9, color: isActive ? TEXT : MUTED, marginTop: 2, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                    {tab.label}
                  </span>
                  {tab.id === 'agent' && !connected && (
                    <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 8, background: AMBER, color: '#000', borderRadius: 2, padding: '1px 3px', fontWeight: 700 }}>!</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <div style={{ paddingTop: 24 }}>

          {/* ── F1 OVERVIEW ───────────────────────────────────────────────────── */}
          {activeTab === 'f1' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <SectionLabel
                  label="Your Assumptions"
                  badge="Click any value to edit"
                  hasModifications={sectionOverlayKeys('f1', overlay).length > 0}
                  onReset={() => resetTab('f1')}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <KpiTile label="Purchase Price" value={fmtM(L1.asking_price)} />
                  <KpiTile label="Going-In Cap" value={fmtPct(L1.broker_cap_rate)} />
                  <EditableKpiTile
                    label="Target IRR" path="user_adjustments.target_irr"
                    rawValue={L3.target_irr ?? returns?.irr} senderRaw={senderL3.target_irr ?? returns?.irr}
                    fmt={fmtPct} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} accent={GREEN}
                  />
                  <EditableKpiTile
                    label="Hold Period" path="user_adjustments.preferred_hold_period"
                    rawValue={L3.preferred_hold_period} senderRaw={senderL3.preferred_hold_period}
                    fmt={fmtYrs} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay}
                  />
                  <KpiTile label="Equity Multiple" value={fmtX(returns?.equity_multiple ?? returns?.em)} accent={GREEN} />
                  <EditableKpiTile
                    label="Max LTV" path="user_adjustments.max_ltv"
                    rawValue={L3.max_ltv} senderRaw={senderL3.max_ltv}
                    fmt={fmtPct} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay}
                  />
                </div>
                {hasAnyModifications && (
                  <div style={{ marginTop: 8, fontSize: 10, color: MUTED, fontFamily: MONO }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE, display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />
                    Blue dot = your value · hover for sender's original · × to reset
                  </div>
                )}
              </div>
              <div>
                <SectionLabel label="Three-Layer Analysis" badge="Broker · Market · Model" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#0d1117' }}>
                        <th style={{ padding: '9px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'left', fontWeight: 600, letterSpacing: '0.06em' }}>METRIC</th>
                        <th style={{ padding: '9px 12px', fontSize: 10, fontFamily: MONO, color: '#93C5FD', textAlign: 'right', fontWeight: 600, letterSpacing: '0.06em' }}>BROKER</th>
                        <th style={{ padding: '9px 12px', fontSize: 10, fontFamily: MONO, color: '#C4B5FD', textAlign: 'right', fontWeight: 600, letterSpacing: '0.06em' }}>MARKET</th>
                        <th style={{ padding: '9px 12px', fontSize: 10, fontFamily: MONO, color: GREEN, textAlign: 'right', fontWeight: 600, letterSpacing: '0.06em' }}>MODEL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <LayerRow label="1BR Rent / mo" broker={fmtDollar(L1.broker_rent_1br)} market={fmtDollar(L2.market_rent_1br)} model={fmtDollar(L3.adjusted_rent_1br)} />
                      <LayerRow label="2BR Rent / mo" broker={fmtDollar(L1.broker_rent_2br)} market={fmtDollar(L2.market_rent_2br)} model={fmtDollar(L3.adjusted_rent_2br)} />
                      <LayerRow label="Vacancy Rate" broker={fmtPct(L1.broker_vacancy)} market={fmtPct(L2.market_vacancy ?? L2.submarket_vacancy)} model={fmtPct(L3.adjusted_vacancy)} />
                      <LayerRow label="Cap Rate" broker={fmtPct(L1.broker_cap_rate)} market={fmtPct(L2.market_cap_rate_avg)} model={fmtPct(L3.model_cap_rate ?? L1.broker_cap_rate)} />
                    </tbody>
                  </table>
                </div>
              </div>
              {Array.isArray(L2.comp_sales) && (L2.comp_sales as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Comparable Sales" badge={`${(L2.comp_sales as unknown[]).length} comps`} />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#0d1117' }}>
                          {['Address', 'Price/Unit', 'Cap Rate', 'Date'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'left', fontWeight: 600, letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(L2.comp_sales as Array<Record<string, unknown>>).map((c, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: TEXT }}>{String(c.address)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: GREEN }}>{fmtDollar(c.price_per_unit)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: TEXT }}>{fmtPct(c.cap_rate)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: MUTED }}>{String(c.date ?? '—')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── F2 ZONING & ENTITLEMENTS ──────────────────────────────────────── */}
          {activeTab === 'f2' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionLabel label="Zoning & Entitlements" badge="Read-only snapshot" />
                <SnapshotAttr date={snapDate} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Zoning District" value={str(L1.current_zoning ?? L1.zoning_district ?? zoningMO.district)} />
                <KpiTile label="Land Area (ac)" value={str(L1.land_area ?? zoningMO.land_area_acres)} />
                <KpiTile label="Max FAR" value={str(L1.max_far ?? zoningMO.max_far)} />
                <KpiTile label="Max Height (ft)" value={str(L1.max_height_ft ?? zoningMO.max_height_ft)} />
                <KpiTile label="Max Density (units/ac)" value={str(L1.max_density ?? zoningMO.max_density)} />
                <KpiTile label="Entitlement Status" value={str(L1.entitlement_status ?? zoningMO.entitlement_status)} accent={AMBER} />
              </div>
              <div>
                <SectionLabel label="Zoning Detail" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { label: 'Allowed Uses', value: str(L1.allowed_uses ?? zoningMO.allowed_uses) },
                    { label: 'Parking Ratio', value: str(L1.parking_ratio ?? zoningMO.parking_ratio) },
                    { label: 'Setbacks', value: str(L1.setbacks ?? zoningMO.setbacks) },
                    { label: 'Lot Coverage', value: str(L1.lot_coverage ?? zoningMO.lot_coverage) },
                    { label: 'Overlay District', value: str(L1.overlay_district ?? zoningMO.overlay_district) },
                    { label: 'Special Use Permit', value: str(L1.special_use_permit ?? zoningMO.special_use_permit) },
                  ].map((row, i) => (
                    <InfoRow key={i} label={row.label} value={row.value} />
                  ))}
                </div>
              </div>
              {(zoningMO.entitlement_summary ?? L1.entitlement_notes) && (
                <div>
                  <SectionLabel label="Entitlement Notes" badge="Snapshot" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16 }}>
                    <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>
                      {str(zoningMO.entitlement_summary ?? L1.entitlement_notes)}
                    </p>
                  </div>
                </div>
              )}
              {str(L1.current_zoning ?? L1.zoning_district ?? zoningMO.district) === '—' && (
                <EmptyState
                  icon={<MapPin size={32} />}
                  title="Zoning data not captured in this snapshot"
                  detail="The sender's snapshot did not include zoning module output. Connect the agent to query entitlement details from the deal record."
                />
              )}
            </div>
          )}

          {/* ── F3 TRAFFIC ────────────────────────────────────────────────────── */}
          {activeTab === 'f3' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionLabel label="Traffic Intelligence" badge="Read-only snapshot" />
                <SnapshotAttr date={snapDate} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Traffic Score" value={str(L1.traffic_score ?? trafficMO.score ?? L2.traffic_score)} accent={BLUE} />
                <KpiTile label="AADT" value={str(trafficMO.aadt ?? L1.aadt ?? L2.aadt)} />
                <KpiTile label="Peak Hr Volume" value={str(trafficMO.peak_hour_volume ?? L1.peak_hour_volume)} />
                <KpiTile label="Pedestrian Score" value={str(trafficMO.walk_score ?? L1.walk_score ?? L2.walk_score)} />
                <KpiTile label="Transit Score" value={str(trafficMO.transit_score ?? L1.transit_score ?? L2.transit_score)} accent={GREEN} />
                <KpiTile label="Bike Score" value={str(trafficMO.bike_score ?? L1.bike_score)} />
              </div>
              <div>
                <SectionLabel label="Traffic Detail" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { label: 'Primary Corridor', value: str(trafficMO.primary_corridor ?? L1.primary_corridor) },
                    { label: 'Nearest Intersection', value: str(trafficMO.nearest_intersection ?? L1.nearest_intersection) },
                    { label: 'Highway Access', value: str(trafficMO.highway_access ?? L1.highway_access) },
                    { label: 'Transit Stops (0.5mi)', value: str(trafficMO.transit_stops_half_mile ?? L2.transit_stops) },
                    { label: 'Employer Proximity', value: str(trafficMO.employer_proximity ?? L2.employer_proximity) },
                    { label: 'Retail Density Score', value: str(trafficMO.retail_density ?? L2.retail_density) },
                  ].map((row, i) => (
                    <InfoRow key={i} label={row.label} value={row.value} />
                  ))}
                </div>
              </div>
              {Array.isArray(trafficMO.nearby_generators) && (trafficMO.nearby_generators as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Traffic Generators" badge={`${(trafficMO.nearby_generators as unknown[]).length} nearby`} />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                    {(trafficMO.nearby_generators as Array<Record<string, unknown>>).slice(0, 8).map((g, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                        <span style={{ fontSize: 12, color: TEXT }}>{str(g.name)}</span>
                        <span style={{ fontSize: 12, fontFamily: MONO, color: MUTED }}>{str(g.distance_mi)} mi · {str(g.type)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {str(L1.traffic_score ?? trafficMO.score ?? L2.traffic_score) === '—' && (
                <EmptyState
                  icon={<Car size={32} />}
                  title="Traffic data not captured in this snapshot"
                  detail="The traffic module (M07) was not included in the sender's snapshot. Connect the agent to query traffic analytics."
                />
              )}
            </div>
          )}

          {/* ── F4 SUPPLY ─────────────────────────────────────────────────────── */}
          {activeTab === 'f4' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionLabel label="Supply Pipeline" badge="Read-only snapshot" />
                <SnapshotAttr date={snapDate} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Supply Risk Score" value={L2.supply_risk_score ? `${L2.supply_risk_score}/100` : str(supplyMO.risk_score)} accent={Number(L2.supply_risk_score ?? supplyMO.risk_score) > 60 ? RED : Number(L2.supply_risk_score ?? supplyMO.risk_score) > 40 ? AMBER : GREEN} />
                <KpiTile label="Units in Pipeline" value={str(L2.units_under_construction ?? supplyMO.units_under_construction)} accent={AMBER} />
                <KpiTile label="Nearby Developments" value={str(L2.nearby_developments ?? supplyMO.nearby_count)} />
                <KpiTile label="Absorption Rate" value={str(supplyMO.absorption_rate ?? L2.absorption_rate)} />
                <KpiTile label="Months of Supply" value={str(supplyMO.months_supply ?? L2.months_supply)} />
                <KpiTile label="Delivery (next 12mo)" value={str(supplyMO.delivery_next_12mo ?? L2.delivery_next_12mo)} accent={AMBER} />
              </div>
              <div>
                <SectionLabel label="Supply Metrics" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { label: 'Submarket Vacancy', value: fmtPct(L2.submarket_vacancy ?? supplyMO.vacancy) },
                    { label: 'YoY Vacancy Change', value: fmtPct(L2.vacancy_change_yoy ?? supplyMO.vacancy_change) },
                    { label: 'Net Absorption (trailing 12mo)', value: str(L2.net_absorption ?? supplyMO.net_absorption) },
                    { label: 'Employment Growth', value: fmtPct(L2.employment_growth) },
                    { label: 'Population Growth', value: fmtPct(L2.population_growth ?? supplyMO.population_growth) },
                    { label: 'Rental Demand Index', value: str(supplyMO.demand_index ?? L2.demand_index) },
                  ].map((row, i) => (
                    <InfoRow key={i} label={row.label} value={row.value} />
                  ))}
                </div>
              </div>
              {Array.isArray(supplyMO.pipeline_projects ?? L2.pipeline_projects) && ((supplyMO.pipeline_projects ?? L2.pipeline_projects) as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Pipeline Projects" />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                      <thead>
                        <tr style={{ background: '#0d1117' }}>
                          {['Name', 'Units', 'Delivery', 'Distance'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'left', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {((supplyMO.pipeline_projects ?? L2.pipeline_projects) as Array<Record<string, unknown>>).slice(0, 10).map((p, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: TEXT }}>{str(p.name ?? p.project_name)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: AMBER }}>{str(p.units)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: MUTED }}>{str(p.delivery_date ?? p.delivery)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: MUTED }}>{str(p.distance_mi)} mi</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── F5 DEBT ADVISOR ───────────────────────────────────────────────── */}
          {activeTab === 'f5' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <SectionLabel
                label="Debt Advisor"
                badge="Editable terms"
                hasModifications={sectionOverlayKeys('f5', overlay).length > 0}
                onReset={() => resetTab('f5')}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Loan Amount" value={fmtM(capitalStack.loanAmount ?? capitalStack.debt)} />
                <KpiTile label="Rate" value={fmtPct(capitalStack.rate ?? capitalStack.interestRate)} />
                <KpiTile label="DSCR (Y1)" value={capitalStack.dscr ? `${Number(capitalStack.dscr).toFixed(2)}x` : str(debtAdvisorMO.dscr_y1)} accent={capitalStack.dscr && Number(capitalStack.dscr) >= 1.25 ? GREEN : RED} />
                <KpiTile label="Debt Yield" value={fmtPct(debtAdvisorMO.debt_yield ?? capitalStack.debt_yield)} />
                <KpiTile label="LTV" value={fmtPct(capitalStack.ltv ?? L3.max_ltv)} />
                <KpiTile label="Breakeven Occ." value={fmtPct(debtAdvisorMO.breakeven_occupancy)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#0d1117', fontSize: 10, fontFamily: MONO, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Editable Debt Terms</div>
                  <EditableDebtRow label="Interest Rate" path="recipient_overrides.capital_stack.rate" rawValue={capitalStack.rate ?? capitalStack.interestRate} senderRaw={senderCapStack.rate ?? senderCapStack.interestRate} fmt={fmtPct} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                  <EditableDebtRow label="Loan Term" path="recipient_overrides.capital_stack.term" rawValue={capitalStack.term} senderRaw={senderCapStack.term} fmt={v => v != null && !isNaN(Number(v)) ? `${v} yr` : '—'} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                  <EditableDebtRow label="Amortization" path="recipient_overrides.capital_stack.amortization" rawValue={capitalStack.amortization} senderRaw={senderCapStack.amortization} fmt={v => v != null && !isNaN(Number(v)) ? `${v} yr` : '—'} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                  <InfoRow label="DSCR (Y1)" value={capitalStack.dscr ? `${Number(capitalStack.dscr).toFixed(2)}x` : '—'} accent={capitalStack.dscr && Number(capitalStack.dscr) >= 1.25 ? GREEN : MUTED} />
                </div>
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: '#0d1117', fontSize: 10, fontFamily: MONO, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lender Metrics</div>
                  {[
                    { label: 'Loan-to-Cost', value: fmtPct(debtAdvisorMO.ltc ?? capitalStack.ltc) },
                    { label: 'Loan-to-Value', value: fmtPct(capitalStack.ltv ?? L3.max_ltv) },
                    { label: 'Debt Yield', value: fmtPct(debtAdvisorMO.debt_yield ?? capitalStack.debt_yield) },
                    { label: 'Breakeven Occupancy', value: fmtPct(debtAdvisorMO.breakeven_occupancy) },
                    { label: 'IO Period', value: str(debtAdvisorMO.io_period_months) ? `${debtAdvisorMO.io_period_months} mo` : '—' },
                    { label: 'Prepayment', value: str(debtAdvisorMO.prepayment_structure ?? capitalStack.prepayment) },
                  ].map((row, i) => <InfoRow key={i} label={row.label} value={row.value} />)}
                </div>
              </div>
              {Array.isArray(debtAdvisorMO.sensitivity) && (debtAdvisorMO.sensitivity as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Rate Sensitivity" badge="DSCR at rate ±" />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#0d1117' }}>
                          {['Rate', 'DSCR', 'Debt Yield', 'Monthly DS'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: h === 'Rate' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(debtAdvisorMO.sensitivity as Array<Record<string, unknown>>).map((row, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: BLUE }}>{fmtPct(row.rate)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: Number(row.dscr) >= 1.25 ? GREEN : RED, textAlign: 'right' }}>{row.dscr ? `${Number(row.dscr).toFixed(2)}x` : '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: TEXT, textAlign: 'right' }}>{fmtPct(row.debt_yield)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{fmtM(row.monthly_debt_service)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── F6 CAPITAL STRUCTURE ──────────────────────────────────────────── */}
          {activeTab === 'f6' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <SectionLabel
                label="Capital Structure"
                badge="At Acquisition"
                hasModifications={sectionOverlayKeys('f6', overlay).length > 0}
                onReset={() => resetTab('f6')}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Purchase Price" value={fmtM(L1.asking_price ?? capitalStack.purchasePrice)} />
                <EditableKpiTile label="LTV" path="user_adjustments.max_ltv" rawValue={L3.max_ltv ?? capitalStack.ltv} senderRaw={senderL3.max_ltv ?? senderCapStack.ltv} fmt={fmtPct} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                <KpiTile label="Loan Amount" value={fmtM(capitalStack.loanAmount ?? capitalStack.debt)} />
                <KpiTile label="Equity" value={fmtM(capitalStack.equity ?? capitalStack.equityContribution)} accent={GREEN} />
                <KpiTile label="Total Capitalization" value={fmtM(capitalStack.totalCost ?? capitalStack.total)} />
              </div>
              {Object.keys(capitalStack).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#0d1117', fontSize: 10, fontFamily: MONO, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sources</div>
                    {[
                      { label: 'Senior Debt', value: fmtM(capitalStack.loanAmount ?? capitalStack.debt) },
                      { label: 'Equity', value: fmtM(capitalStack.equity ?? capitalStack.equityContribution) },
                      { label: 'Total', value: fmtM(capitalStack.totalCost ?? capitalStack.total), bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderTop: `1px solid ${BORDER}` }}>
                        <span style={{ fontSize: 12, color: MUTED }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontFamily: MONO, color: r.bold ? TEXT : GREEN, fontWeight: r.bold ? 700 : 400 }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#0d1117', fontSize: 10, fontFamily: MONO, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Debt Terms</div>
                    <EditableDebtRow label="Rate" path="recipient_overrides.capital_stack.rate" rawValue={capitalStack.rate ?? capitalStack.interestRate} senderRaw={senderCapStack.rate ?? senderCapStack.interestRate} fmt={fmtPct} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                    <EditableDebtRow label="Term" path="recipient_overrides.capital_stack.term" rawValue={capitalStack.term} senderRaw={senderCapStack.term} fmt={v => v != null && !isNaN(Number(v)) ? `${v} yr` : '—'} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                    <EditableDebtRow label="Amortization" path="recipient_overrides.capital_stack.amortization" rawValue={capitalStack.amortization} senderRaw={senderCapStack.amortization} fmt={v => v != null && !isNaN(Number(v)) ? `${v} yr` : '—'} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                    <InfoRow label="DSCR (Y1 est.)" value={capitalStack.dscr ? `${Number(capitalStack.dscr).toFixed(2)}x` : '—'} />
                  </div>
                </div>
              ) : (
                <EmptyState icon={<DollarSign size={32} />} title="Capital structure not in snapshot" detail="Key metrics above sourced from deal assumptions." />
              )}
              {(MO.waterfall || fin?.waterfall) && (
                <div>
                  <SectionLabel label="Waterfall" badge="LP / GP Distribution" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 18px', fontSize: 12, color: MUTED }}>
                    Waterfall data present in snapshot — connect the agent to query distribution details.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── F7 STRATEGY ───────────────────────────────────────────────────── */}
          {activeTab === 'f7' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionLabel label="Deal Strategy" badge="Read-only snapshot" />
                <SnapshotAttr date={snapDate} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Investment Strategy" value={str(L1.investment_strategy ?? strategyMO.investment_strategy)} accent={BLUE} />
                <KpiTile label="Exit Strategy" value={str(L1.exit_strategy ?? strategyMO.exit_strategy)} />
                <KpiTile label="Hold Period" value={fmtYrs(L3.preferred_hold_period)} sub="from your adjustments" />
                <KpiTile label="Target IRR" value={fmtPct(L3.target_irr ?? returns?.irr)} accent={GREEN} />
                <KpiTile label="Target EM" value={fmtX(returns?.equity_multiple ?? returns?.em)} accent={GREEN} />
                <KpiTile label="Exit Year" value={str(strategyMO.exit_year ?? L1.exit_year)} />
              </div>
              <div>
                <SectionLabel label="Strategy Detail" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { label: 'Business Plan', value: str(L1.business_plan ?? strategyMO.business_plan) },
                    { label: 'Value-Add Plan', value: str(L1.value_add_plan ?? strategyMO.value_add_plan) },
                    { label: 'Renovation Scope', value: str(L1.renovation_scope ?? strategyMO.renovation_scope) },
                    { label: 'Renovation Budget', value: L1.renovation_budget ? fmtM(L1.renovation_budget) : str(strategyMO.renovation_budget) },
                    { label: 'Lease-Up Timeline', value: str(L1.lease_up_timeline ?? strategyMO.lease_up_months ? `${strategyMO.lease_up_months} months` : null) },
                    { label: 'Stabilized Occupancy Target', value: fmtPct(L1.stabilized_occupancy ?? strategyMO.stabilized_occupancy) },
                  ].map((row, i) => (
                    <InfoRow key={i} label={row.label} value={row.value} />
                  ))}
                </div>
              </div>
              {(strategyMO.key_risks ?? L1.key_risks) && (
                <div>
                  <SectionLabel label="Key Risks" badge="Identified at snapshot time" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16 }}>
                    {Array.isArray(strategyMO.key_risks ?? L1.key_risks)
                      ? ((strategyMO.key_risks ?? L1.key_risks) as string[]).map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                            <span style={{ color: RED, fontFamily: MONO, fontSize: 12 }}>▸</span>
                            <span style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{String(r)}</span>
                          </div>
                        ))
                      : <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{str(strategyMO.key_risks ?? L1.key_risks)}</p>
                    }
                  </div>
                </div>
              )}
              {str(L1.investment_strategy ?? strategyMO.investment_strategy) === '—' && (
                <EmptyState icon={<Target size={32} />} title="Strategy detail not captured in this snapshot" detail="Connect the agent to query deal strategy from the full deal record." />
              )}
            </div>
          )}

          {/* ── F8 INVESTORS ──────────────────────────────────────────────────── */}
          {activeTab === 'f8' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <SectionLabel label="Investors & Capital" badge="Read-only snapshot" />
                <SnapshotAttr date={snapDate} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <KpiTile label="Total Equity" value={fmtM(investorsMO.total_equity ?? capitalStack.equity)} />
                <KpiTile label="GP Equity" value={fmtM(investorsMO.gp_equity ?? investorsMO.gp_contribution)} accent={BLUE} />
                <KpiTile label="LP Equity" value={fmtM(investorsMO.lp_equity ?? investorsMO.lp_contribution)} accent={GREEN} />
                <KpiTile label="GP Promote" value={str(investorsMO.gp_promote) !== '—' ? str(investorsMO.gp_promote) : fmtPct(investorsMO.promote_pct)} />
                <KpiTile label="Pref. Return" value={fmtPct(investorsMO.preferred_return)} />
                <KpiTile label="# Investors" value={str(investorsMO.investor_count)} />
              </div>
              <div>
                <SectionLabel label="Waterfall Structure" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { label: 'Structure Type', value: str(investorsMO.waterfall_type ?? investorsMO.structure_type) },
                    { label: 'Preferred Return', value: fmtPct(investorsMO.preferred_return) },
                    { label: 'GP Co-Invest', value: fmtPct(investorsMO.gp_co_invest_pct) },
                    { label: 'Catch-Up', value: str(investorsMO.catchup_provision) },
                    { label: 'Carry Split (above hurdle)', value: str(investorsMO.carry_split_above_hurdle) },
                    { label: 'Distribution Frequency', value: str(investorsMO.distribution_frequency) },
                  ].map((row, i) => <InfoRow key={i} label={row.label} value={row.value} />)}
                </div>
              </div>
              {Array.isArray(investorsMO.investors) && (investorsMO.investors as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Investor Summary" badge={`${(investorsMO.investors as unknown[]).length} investors`} />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#0d1117' }}>
                          {['Investor', 'Type', 'Commitment', 'Ownership %'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'left', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(investorsMO.investors as Array<Record<string, unknown>>).map((inv, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '8px 12px', fontSize: 12, color: TEXT }}>{str(inv.name)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: inv.type === 'GP' ? BLUE : GREEN }}>{str(inv.type)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: TEXT }}>{fmtM(inv.commitment)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: MUTED }}>{fmtPct(inv.ownership_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {str(investorsMO.total_equity ?? capitalStack.equity) === '—' && (
                <EmptyState icon={<Users size={32} />} title="Investor data not captured in this snapshot" detail="The F8 investor module was not included in the sender's snapshot. Connect the agent to query capital structure details." />
              )}
            </div>
          )}

          {/* ── F9 FINANCIAL ENGINE ───────────────────────────────────────────── */}
          {activeTab === 'f9' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <SectionLabel
                label="Scenario Assumptions"
                badge="Editable"
                hasModifications={sectionOverlayKeys('f9', overlay).length > 0}
                onReset={() => resetTab('f9')}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <EditableKpiTile label="Exit Cap Rate" path="deal_data.exit_cap_assumption" rawValue={L1.exit_cap_assumption} senderRaw={senderL1.exit_cap_assumption} fmt={fmtPct} overlay={overlay} onPatch={patchOverlay} onReset={resetOverlay} />
                <KpiTile label="Hold Period" value={fmtYrs(L3.preferred_hold_period)} sub="from F1" />
                <KpiTile label="Target IRR" value={fmtPct(L3.target_irr ?? returns?.irr)} accent={GREEN} sub="from F1" />
              </div>
              <div>
                <SectionLabel label="Investment Returns" badge="Modeled" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <KpiTile label="Levered IRR" value={fmtPct(returns?.irr ?? fin?.irr)} accent={GREEN} />
                  <KpiTile label="Equity Multiple" value={fmtX(returns?.equity_multiple ?? returns?.em ?? fin?.equity_multiple)} accent={GREEN} />
                  <KpiTile label="Cash-on-Cash Y1" value={fmtPct(returns?.coc ?? returns?.cash_on_cash ?? fin?.coc)} />
                  <KpiTile label="Unlevered IRR" value={fmtPct(returns?.unlevered_irr ?? fin?.unlevered_irr)} />
                  <KpiTile label="Y1 NOI" value={fmtM(fin?.noi ?? fin?.year1_noi ?? (y1 ?? []).find((r: Record<string, unknown>) => r.field === 'noi')?.resolved)} />
                  <KpiTile label="Exit Value" value={fmtM(returns?.exit_value ?? fin?.exit_value)} />
                </div>
              </div>
              {Array.isArray(y1) && y1.length > 0 ? (
                <div>
                  <SectionLabel label="Year 1 Operating Statement" badge="Platform Model" />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#0d1117' }}>
                          {['Line Item', 'Broker', 'Platform', 'Resolved', '/Unit'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: h === 'Line Item' ? 'left' : 'right', fontWeight: 600, letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {y1.slice(0, 20).map((row, i) => {
                          const isSub = ['egr', 'egi', 'noi', 'gpr'].includes(String(row.field));
                          return (
                            <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, background: isSub ? 'rgba(8,145,178,0.05)' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: isSub ? BLUE : TEXT, fontFamily: isSub ? MONO : 'inherit', fontWeight: isSub ? 600 : 400 }}>{String(row.label ?? row.field)}</td>
                              <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{row.broker != null ? fmtM(row.broker) : '—'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{row.platform != null ? fmtM(row.platform) : '—'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: isSub ? GREEN : TEXT, fontWeight: isSub ? 700 : 400, textAlign: 'right' }}>{row.resolved != null ? fmtM(row.resolved) : '—'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{row.perUnit != null ? fmtDollar(row.perUnit) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyState icon={<BarChart3 size={32} />} title="No Year 1 line-item data in this snapshot" detail="Returns and capital structure may still be available above." />
              )}
              {Array.isArray(fin?.projections) && (fin.projections as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Multi-Year Projections" />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                      <thead>
                        <tr style={{ background: '#0d1117' }}>
                          <th style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'left', fontWeight: 600 }}>YEAR</th>
                          {['NOI', 'EGR', 'DSCR', 'CoC', 'Cum. Cash'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'right', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(fin.projections as Array<Record<string, unknown>>).slice(0, 10).map((yr, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: BLUE }}>Y{yr.year ?? i + 1}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: TEXT, textAlign: 'right' }}>{fmtM(yr.noi)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: TEXT, textAlign: 'right' }}>{fmtM(yr.egr ?? yr.egi)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: yr.dscr != null && Number(yr.dscr) < 1.25 ? RED : TEXT, textAlign: 'right' }}>{yr.dscr != null ? `${Number(yr.dscr).toFixed(2)}x` : '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: GREEN, textAlign: 'right' }}>{fmtPct(yr.coc ?? yr.cash_on_cash)}</td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{fmtM(yr.cumulative_cash)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>DSCR shown in red when below 1.25x covenant threshold.</div>
                </div>
              )}
            </div>
          )}

          {/* ── F10 CORRELATION ENGINE ────────────────────────────────────────── */}
          {activeTab === 'f10' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <SectionLabel label="Collision Analysis" badge={`Overall: ${capsule.collision_score ?? '—'}/100`} />
                {collisionAnalyses && Object.keys(collisionAnalyses).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
                    {Object.entries(collisionAnalyses).map(([key, data]) => (
                      <CollisionCard key={key} name={key} score={data?.score ?? 0} insight={data?.insight ?? 'No data'} action={data?.recommended_action ?? '—'} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Activity size={32} />} title="No collision analysis in this snapshot" />
                )}
              </div>
              {(MO.evidence_narrative ?? MO.evidence) && (
                <div>
                  <SectionLabel label="Evidence Narrative" badge="AI-Generated" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20 }}>
                    <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.8 }}>
                      {String(MO.evidence_narrative ?? (MO.evidence as Record<string, unknown> | undefined)?.narrative ?? 'Evidence detail available — connect agent to explore.')}
                    </p>
                  </div>
                </div>
              )}
              {MO.due_diligence && (
                <div>
                  <SectionLabel label="Due Diligence Summary" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20 }}>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.7 }}>
                      {typeof MO.due_diligence === 'object' ? JSON.stringify(MO.due_diligence, null, 2).slice(0, 800) : String(MO.due_diligence)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── F11 MARKET INTELLIGENCE ───────────────────────────────────────── */}
          {activeTab === 'f11' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <SectionLabel label="Market Indicators" badge="Platform Intelligence" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  <KpiTile label="Supply Risk" value={L2.supply_risk_score ? `${L2.supply_risk_score}/100` : '—'} accent={Number(L2.supply_risk_score) > 60 ? RED : Number(L2.supply_risk_score) > 40 ? AMBER : GREEN} />
                  <KpiTile label="Employment Growth" value={fmtPct(L2.employment_growth)} accent={GREEN} />
                  <KpiTile label="Submarket Vacancy" value={fmtPct(L2.submarket_vacancy)} />
                  <KpiTile label="Nearby Developments" value={L2.nearby_developments ? String(L2.nearby_developments) : '—'} />
                  <KpiTile label="Units in Pipeline" value={L2.units_under_construction ? String(L2.units_under_construction) : '—'} accent={AMBER} />
                  <KpiTile label="Market Cap Rate" value={fmtPct(L2.market_cap_rate_avg)} />
                </div>
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '10px 14px', background: '#0d1117', fontSize: 10, fontFamily: MONO, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Rent Comparison</div>
                  {[
                    { label: '1BR Market Rent', broker: fmtDollar(L1.broker_rent_1br), market: fmtDollar(L2.market_rent_1br), model: fmtDollar(L3.adjusted_rent_1br) },
                    { label: '2BR Market Rent', broker: fmtDollar(L1.broker_rent_2br), market: fmtDollar(L2.market_rent_2br), model: fmtDollar(L3.adjusted_rent_2br) },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: `1px solid ${BORDER}`, padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, color: MUTED }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: '#93C5FD', textAlign: 'right' }}>{r.broker}</span>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: '#C4B5FD', textAlign: 'right' }}>{r.market}</span>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: GREEN, textAlign: 'right' }}>{r.model}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SectionLabel label="Deal & Market Intelligence" badge="M06 Pipeline" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { emoji: '📊', headline: 'Platform market data captured at snapshot time', source: 'JEDI RE', age: fmtDate(capsule.snapshot_taken_at), sentiment: 'LIVE', color: GREEN },
                    { emoji: '🏗️', headline: `Supply pipeline: ${L2.units_under_construction ? `${L2.units_under_construction} units under construction` : 'data in snapshot'}`, source: 'Platform', age: '', sentiment: 'NEUTRAL', color: MUTED },
                    { emoji: '💼', headline: `Employment growth: ${fmtPct(L2.employment_growth)} submarket trend`, source: 'Platform', age: '', sentiment: L2.employment_growth && Number(L2.employment_growth) > 2 ? 'POSITIVE' : 'NEUTRAL', color: L2.employment_growth && Number(L2.employment_growth) > 2 ? GREEN : MUTED },
                    { emoji: '🏘️', headline: `Submarket vacancy: ${fmtPct(L2.submarket_vacancy)} | Market cap rate: ${fmtPct(L2.market_cap_rate_avg)}`, source: 'CoStar', age: '', sentiment: 'NEUTRAL', color: MUTED },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 16 }}>{item.emoji}</span>
                        <div>
                          <div style={{ fontSize: 12, color: TEXT }}>{item.headline}</div>
                          {item.age && <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{item.source} · {item.age}</div>}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: MONO, padding: '2px 6px', borderRadius: 4, border: `1px solid ${item.color}4D`, background: `${item.color}1A`, color: item.color, whiteSpace: 'nowrap', marginLeft: 12 }}>{item.sentiment}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── AGENT ─────────────────────────────────────────────────────────── */}
          {activeTab === 'agent' && share.agent_enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {!connected ? (
                <>
                  <div>
                    <SectionLabel label="Interactive Agent" badge="Bring Your Own Key" />
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 22, marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Engage with this deal interactively</h3>
                      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 18 }}>
                        The deal book above contains the full static analysis. Connect your own API key to unlock on-demand reasoning: run sensitivities, stress-test assumptions, query the evidence base, and ask follow-on questions the agent answers by reasoning against this exact snapshot{hasAnyModifications ? ' — including your modifications.' : '.'}
                      </p>
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: BLUE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Example questions:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            'How would levered IRR change if the exit cap moves 25bps higher at end of hold?',
                            "What's the sensitivity of Year 5 CoC to rent growth coming in 200bps below base case?",
                            'At what interest rate does DSCR break below 1.25x under a stress scenario?',
                          ].map((q, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px' }}>
                              <ChevronRight size={12} color={BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{q}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 20 }}>
                        <DollarSign size={12} color={MUTED} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>Priced at your API provider's cost plus a 30% platform fee. Typical query: $0.02–$0.08. Your key is AES-256-GCM encrypted at rest and used only for queries on this capsule.</span>
                      </div>
                      <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: MONO, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Provider</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {['anthropic', 'openai'].map(p => (
                              <button key={p} type="button" onClick={() => setConnectForm(f => ({ ...f, provider: p }))}
                                style={{ padding: '6px 14px', fontSize: 12, fontFamily: MONO, background: connectForm.provider === p ? 'rgba(8,145,178,0.15)' : SURFACE2, border: `1px solid ${connectForm.provider === p ? BLUE : BORDER}`, borderRadius: 6, color: connectForm.provider === p ? BLUE : MUTED }}>
                                {p === 'anthropic' ? 'Anthropic' : 'OpenAI'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: MONO, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>API Key</label>
                          <div style={{ position: 'relative' }}>
                            <input type={keyVisible ? 'text' : 'password'} value={connectForm.api_key} onChange={e => setConnectForm(f => ({ ...f, api_key: e.target.value }))} placeholder={connectForm.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'} style={{ width: '100%', padding: '10px 40px 10px 12px', fontSize: 13, fontFamily: MONO }} />
                            <button type="button" onClick={() => setKeyVisible(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: MUTED, padding: 0 }}>
                              {keyVisible ? <X size={13} /> : <Key size={13} />}
                            </button>
                          </div>
                        </div>
                        {connectError && <div style={{ background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: RED }}>{connectError}</div>}
                        <button type="submit" disabled={connectLoading || !connectForm.api_key}
                          style={{ padding: '10px 20px', fontSize: 13, fontFamily: MONO, background: connectLoading || !connectForm.api_key ? SURFACE2 : BLUE, color: connectLoading || !connectForm.api_key ? MUTED : '#fff', border: 'none', borderRadius: 6, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          {connectLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                          {connectLoading ? 'Validating...' : 'Connect API Key'}
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <SectionLabel label="Agent" badge="LIVE" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.25)`, borderRadius: 8, padding: '10px 16px', marginBottom: 14 }}>
                      <CheckCircle size={13} color={GREEN} />
                      <span style={{ fontSize: 12, color: GREEN, fontFamily: MONO }}>Agent connected — reasoning against F1–F11 snapshot{hasAnyModifications ? ' + your modifications' : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {conversation.length === 0 && (
                      <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 18 }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: BLUE, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Suggested queries</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            'How would levered IRR change if the exit cap moves 25bps higher at end of hold?',
                            "What's the sensitivity of Year 5 CoC to rent growth coming in 200bps below base case?",
                            'At what interest rate does DSCR break below 1.25x under a stress scenario?',
                          ].map((q, i) => (
                            <div key={i} onClick={() => handleQuery(q)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', cursor: 'pointer' }}>
                              <ChevronRight size={12} color={BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{q}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {conversation.map((msg, i) => (
                      <div key={i} style={{ background: msg.role === 'user' ? SURFACE2 : SURFACE, border: `1px solid ${msg.role === 'assistant' ? BORDER : 'transparent'}`, borderRadius: 8, padding: 16, borderLeft: msg.role === 'assistant' ? `3px solid ${BLUE}` : 'none' }}>
                        <div style={{ fontSize: 10, fontFamily: MONO, color: msg.role === 'user' ? MUTED : BLUE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{msg.role === 'user' ? 'You' : 'Agent'}</div>
                        <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                        {msg.usage && <div style={{ fontSize: 10, color: MUTED, marginTop: 8, fontFamily: MONO }}>{msg.usage.tokens_input + msg.usage.tokens_output} tokens · ${msg.usage.total_charged_usd.toFixed(4)}</div>}
                      </div>
                    ))}
                    {queryLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, borderLeft: `3px solid ${BLUE}` }}>
                        <Loader2 size={13} color={BLUE} style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: 12, color: MUTED, fontFamily: MONO }}>Reasoning against F1–F11 deal data...</span>
                      </div>
                    )}
                    <div ref={convBottomRef} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea
                      value={queryInput}
                      onChange={e => setQueryInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery(); } }}
                      placeholder="Ask a question about this deal... (Enter to send)"
                      rows={3}
                      style={{ flex: 1, padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', background: SURFACE, color: TEXT, border: `1px solid ${BORDER}`, borderRadius: 8, outline: 'none' }}
                    />
                    <button onClick={() => handleQuery()} disabled={!queryInput.trim() || queryLoading}
                      style={{ padding: '10px 16px', background: queryInput.trim() && !queryLoading ? BLUE : SURFACE2, border: 'none', borderRadius: 8, color: queryInput.trim() && !queryLoading ? '#fff' : MUTED, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: MONO, fontWeight: 600 }}>
                      <Send size={12} /> Send
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ── Sticky footer reset bar ───────────────────────────────────────────── */}
      {hasAnyModifications && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60, background: '#0d1117', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', gap: 12 }}>
          <div style={{ fontSize: 11, fontFamily: MONO, color: MUTED }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
            {Object.keys(overlay).length} field{Object.keys(overlay).length !== 1 ? 's' : ''} modified from sender's original
          </div>
          <button onClick={() => resetOverlay()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 5, padding: '5px 12px', fontSize: 11, fontFamily: MONO, color: RED }}>
            <RotateCcw size={10} /> Reset all modifications
          </button>
        </div>
      )}
    </div>
  );
}
