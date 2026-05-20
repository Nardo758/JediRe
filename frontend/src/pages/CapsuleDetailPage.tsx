/**
 * CapsuleDetailPage — Task #901
 *
 * Mounted at /capsules/:id (authenticated, sender view).
 * Two tabs:
 *   OVERVIEW — capsule metadata summary
 *   SHARES   — external share-link management (list + revoke)
 *
 * Data sources:
 *   GET /api/v1/capsules/:id            → capsule metadata
 *   GET /api/v1/capsules-ext/:id/shares → external share links
 *   POST /api/v1/capsules-ext/:id/shares/:shareId/revoke → revoke a link
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Check, X, ExternalLink, Loader2, AlertTriangle, RefreshCw, Users, FileText, TrendingUp, Clock, Mail, Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { apiClient } from '../services/api.client';
import { useAuthStore } from '../stores/authStore';

// ─── Design tokens ─────────────────────────────────────────────────────────
const T = {
  bg: {
    page:     '#0A0E17',
    nav:      '#0D1117',
    panel:    '#0F1319',
    hover:    '#141B25',
    active:   '#0D1E30',
  },
  border: {
    subtle:   '#1A2535',
    medium:   '#1E2A3B',
    strong:   '#2A3A4B',
  },
  text: {
    primary:  '#C9D1D9',
    secondary:'#8B9CB0',
    muted:    '#5A6A7E',
    cyan:     '#06B6D4',
    amber:    '#F0B429',
    green:    '#3FB950',
    red:      '#F85149',
  },
  font: {
    mono: '"JetBrains Mono","Fira Mono",monospace',
    sans: 'Inter,system-ui,sans-serif',
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface CapsuleMeta {
  id: string;
  property_address?: string | null;
  asset_class?: string | null;
  status?: string | null;
  jedi_score?: number | null;
  deal_data?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

interface ExternalShare {
  share_id: string;
  share_type: string;
  share_mode?: string | null;
  label?: string | null;
  recipient_email?: string | null;
  recipient_name?: string | null;
  created_at: string;
  revoked_at?: string | null;
  expires_at?: string | null;
  preview_text?: string | null;
  share_url?: string | null;
  share_status: 'active' | 'revoked' | 'expired';
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtPrice(v: unknown) {
  const n = Number(v);
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function ShareStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string }> = {
    active:  { bg: '#0F2E1A', color: T.text.green },
    revoked: { bg: '#2E0F0F', color: T.text.red },
    expired: { bg: '#2E2300', color: T.text.amber },
  };
  const cfg = configs[status] ?? { bg: T.bg.panel, color: T.text.muted };
  return (
    <span style={{
      padding: '3px 8px',
      background: cfg.bg,
      color: cfg.color,
      fontSize: 9,
      fontWeight: 700,
      fontFamily: T.font.mono,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

// ─── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy link"
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 7px',
        background: 'none',
        border: `1px solid ${T.border.subtle}`,
        color: copied ? T.text.green : T.text.muted,
        fontSize: 9, fontFamily: T.font.mono,
        cursor: 'pointer',
        transition: 'color 0.2s',
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'COPIED' : 'COPY'}
    </button>
  );
}

// ─── MetaCard ──────────────────────────────────────────────────────────────
function MetaCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1.2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ?? T.text.primary, fontFamily: T.font.mono }}>
        {value}
      </div>
    </div>
  );
}

// ─── SharesTab ───────────────────────────────────────────────────────────────
function SharesTab({ capsuleId }: { capsuleId: string }) {
  const [shares, setShares] = useState<ExternalShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient.get(`/api/v1/capsules-ext/${capsuleId}/shares`)
      .then(r => setShares(r.data?.shares ?? []))
      .catch(() => setError('Failed to load share links.'))
      .finally(() => setLoading(false));
  }, [capsuleId]);

  useEffect(() => { load(); }, [load]);

  const revoke = async (shareId: string) => {
    setRevoking(p => ({ ...p, [shareId]: true }));
    try {
      await apiClient.post(`/api/v1/capsules-ext/${capsuleId}/shares/${shareId}/revoke`);
      setShares(p => p.map(s =>
        s.share_id === shareId ? { ...s, share_status: 'revoked', revoked_at: new Date().toISOString() } : s
      ));
    } catch {
      // silently keep the old state — the row won't change
    } finally {
      setRevoking(p => { const n = { ...p }; delete n[shareId]; return n; });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Loader2 size={16} color={T.text.muted} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: T.text.muted, fontFamily: T.font.mono }}>LOADING SHARES…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: T.text.red }}>
        <AlertTriangle size={14} />
        <span style={{ fontSize: 11, fontFamily: T.font.mono }}>{error}</span>
        <button onClick={load} style={{ marginLeft: 8, background: 'none', border: `1px solid ${T.border.subtle}`, color: T.text.muted, fontSize: 9, fontFamily: T.font.mono, padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={10} /> RETRY
        </button>
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Users size={32} color={T.text.muted} strokeWidth={1} />
        <span style={{ fontSize: 11, color: T.text.muted, fontFamily: T.font.mono }}>NO SHARE LINKS YET</span>
        <span style={{ fontSize: 10, color: T.text.muted }}>Share this capsule from the Deal Capsules list to create links.</span>
      </div>
    );
  }

  const active  = shares.filter(s => s.share_status === 'active').length;
  const revoked = shares.filter(s => s.share_status === 'revoked').length;
  const expired = shares.filter(s => s.share_status === 'expired').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Summary strip */}
      <div style={{
        display: 'flex', gap: 1,
        padding: '10px 0',
        borderBottom: `1px solid ${T.border.subtle}`,
        marginBottom: 0,
      }}>
        {[
          { label: 'TOTAL',   value: shares.length, color: T.text.primary },
          { label: 'ACTIVE',  value: active,         color: T.text.green  },
          { label: 'REVOKED', value: revoked,        color: T.text.red    },
          { label: 'EXPIRED', value: expired,        color: T.text.amber  },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1 }}>{label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: T.font.mono }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 140px 120px 140px 140px 100px',
        gap: 1,
        padding: '8px 16px',
        background: T.bg.nav,
        borderBottom: `1px solid ${T.border.medium}`,
      }}>
        {['RECIPIENT / LABEL', 'TYPE', 'STATUS', 'CREATED', 'EXPIRES', 'ACTIONS'].map(h => (
          <div key={h} style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1 }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {shares.map(share => (
        <div
          key={share.share_id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 120px 140px 140px 100px',
            gap: 1,
            padding: '12px 16px',
            borderBottom: `1px solid ${T.border.subtle}`,
            background: T.bg.panel,
            opacity: share.share_status !== 'active' ? 0.6 : 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (share.share_status === 'active') e.currentTarget.style.background = T.bg.hover; }}
          onMouseLeave={e => e.currentTarget.style.background = T.bg.panel}
        >
          {/* Recipient */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {share.recipient_email && <Mail size={10} color={T.text.muted} />}
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {share.recipient_name || share.recipient_email || share.label || '—'}
              </span>
            </div>
            {share.recipient_email && share.recipient_name && (
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>{share.recipient_email}</span>
            )}
            {share.share_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <a
                  href={share.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 9, color: T.text.cyan, fontFamily: T.font.mono, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <ExternalLink size={9} />
                  VIEW LINK
                </a>
                <CopyButton text={share.share_url} />
              </div>
            )}
          </div>

          {/* Type */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.mono, textTransform: 'uppercase' }}>
              {share.share_type || share.share_mode || '—'}
            </span>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ShareStatusBadge status={share.share_status} />
          </div>

          {/* Created */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.mono }}>
              {fmtDate(share.created_at)}
            </span>
          </div>

          {/* Expires */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: share.expires_at ? T.text.amber : T.text.muted, fontFamily: T.font.mono }}>
              {share.expires_at ? fmtDateTime(share.expires_at) : 'Never'}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {share.share_status === 'active' && (
              <button
                onClick={() => revoke(share.share_id)}
                disabled={!!revoking[share.share_id]}
                title="Revoke this link"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  background: '#2E0F0F',
                  border: `1px solid ${T.text.red}40`,
                  color: revoking[share.share_id] ? T.text.muted : T.text.red,
                  fontSize: 9, fontWeight: 700, fontFamily: T.font.mono,
                  letterSpacing: 0.5,
                  cursor: revoking[share.share_id] ? 'not-allowed' : 'pointer',
                }}
              >
                {revoking[share.share_id]
                  ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                  : <X size={10} />
                }
                REVOKE
              </button>
            )}
            {share.share_status === 'revoked' && share.revoked_at && (
              <span style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>
                {fmtDate(share.revoked_at)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────
function OverviewTab({ capsule }: { capsule: CapsuleMeta }) {
  const dd = (capsule.deal_data ?? {}) as Record<string, unknown>;
  const askingPrice = dd.asking_price ?? dd.purchasePrice ?? dd.purchase_price;
  const noi         = dd.noi ?? dd.annual_noi;
  const capRate     = dd.cap_rate ?? dd.going_in_cap_rate;
  const holdPeriod  = dd.hold_period ?? dd.holdPeriod;
  const ltv         = dd.ltv ?? dd.loan_to_value;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetaCard label="ASKING PRICE" value={fmtPrice(askingPrice)} accent={T.text.cyan} />
        <MetaCard
          label="JEDI SCORE"
          value={capsule.jedi_score ? capsule.jedi_score : '—'}
          accent={capsule.jedi_score ? T.text.amber : T.text.muted}
        />
        <MetaCard label="ASSET CLASS" value={capsule.asset_class || '—'} />
        <MetaCard label="ANNUAL NOI" value={fmtPrice(noi)} accent={T.text.green} />
        <MetaCard label="CAP RATE" value={capRate ? `${Number(capRate).toFixed(2)}%` : '—'} />
        <MetaCard label="HOLD PERIOD" value={holdPeriod ? `${holdPeriod} YRS` : '—'} />
        <MetaCard label="LTV" value={ltv ? `${Number(ltv).toFixed(1)}%` : '—'} />
        <MetaCard label="STATUS" value={capsule.status || '—'} accent={T.text.amber} />
        <MetaCard label="CREATED" value={fmtDate(capsule.created_at)} accent={T.text.secondary} />
      </div>

      {/* Raw deal data section */}
      {Object.keys(dd).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border.subtle}`, fontSize: 9, fontWeight: 700, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1 }}>
            DEAL DATA FIELDS ({Object.keys(dd).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            {Object.entries(dd).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 16px', width: '50%', boxSizing: 'border-box',
                  borderBottom: `1px solid ${T.border.subtle}`,
                }}
              >
                <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
                  {k.replace(/_lv$/, '').replace(/_/g, ' ').toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: T.text.primary, fontFamily: T.font.mono, fontWeight: 600 }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CapsuleDetailPage() {
  const { id: capsuleId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [capsule, setCapsule] = useState<CapsuleMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'shares'>('shares');
  const [exportOpen, setExportOpen]     = useState(false);
  const [exportingFmt, setExportingFmt] = useState<'excel' | 'pdf' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const downloadCapsule = useCallback(async (format: 'excel' | 'pdf') => {
    if (!capsuleId) return;
    setExportOpen(false);
    setExportingFmt(format);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/capsules-ext/${capsuleId}/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const safeName = (capsule?.property_address ?? capsuleId).replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 50);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeName}_capsule.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExportingFmt(null);
    }
  }, [capsuleId, capsule]);

  useEffect(() => {
    if (!capsuleId) { navigate('/capsules', { replace: true }); return; }
    const userId = user?.id || 'demo-user';
    setLoading(true);
    apiClient.get(`/api/v1/capsules/${capsuleId}?user_id=${userId}`)
      .then(r => {
        const c = r.data?.capsule ?? r.data;
        setCapsule(c);
        setError(null);
      })
      .catch(() => setError('Failed to load capsule.'))
      .finally(() => setLoading(false));
  }, [capsuleId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { key: 'overview' | 'shares'; label: string; icon: React.ReactNode }[] = [
    { key: 'shares',   label: 'SHARES',   icon: <Users size={12} /> },
    { key: 'overview', label: 'OVERVIEW', icon: <FileText size={12} /> },
  ];

  if (loading) {
    return (
      <div style={{ height: '100vh', background: T.bg.page, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Loader2 size={18} color={T.text.muted} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 11, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1 }}>LOADING CAPSULE…</span>
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div style={{ height: '100vh', background: T.bg.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <AlertTriangle size={28} color={T.text.red} strokeWidth={1.5} />
        <span style={{ fontSize: 12, color: T.text.red, fontFamily: T.font.mono }}>{error ?? 'Capsule not found'}</span>
        <button
          onClick={() => navigate('/capsules')}
          style={{ marginTop: 8, padding: '8px 20px', background: T.bg.panel, border: `1px solid ${T.border.subtle}`, color: T.text.secondary, fontSize: 10, fontFamily: T.font.mono, cursor: 'pointer' }}
        >
          ← BACK TO CAPSULES
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg.page, color: T.text.primary, fontFamily: T.font.sans }}>

      {/* ── Top nav bar ── */}
      <div style={{
        background: T.bg.nav,
        borderBottom: `1px solid ${T.border.medium}`,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        height: 52,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/capsules')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono, cursor: 'pointer', letterSpacing: 0.8, padding: 0 }}
        >
          <ChevronLeft size={13} />
          CAPSULES
        </button>
        <span style={{ color: T.border.medium }}>›</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.text.primary }}>
          {capsule.property_address ?? capsuleId}
        </span>
        {capsule.status && (
          <span style={{
            marginLeft: 4,
            padding: '3px 8px',
            background: T.bg.active,
            color: T.text.amber,
            fontSize: 8, fontWeight: 700, fontFamily: T.font.mono, letterSpacing: 0.8,
          }}>
            {capsule.status}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {capsule.jedi_score != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={12} color={T.text.amber} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>
              {capsule.jedi_score}
            </span>
            <span style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1 }}>JEDI</span>
          </div>
        )}
        {capsule.created_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 16 }}>
            <Clock size={10} color={T.text.muted} />
            <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
              {fmtDate(capsule.created_at)}
            </span>
          </div>
        )}

        {/* Export dropdown */}
        <div ref={exportRef} style={{ position: 'relative', marginLeft: 16 }}>
          <button
            onClick={() => setExportOpen(o => !o)}
            disabled={!!exportingFmt}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: exportOpen ? T.bg.active : T.bg.panel,
              border: `1px solid ${exportOpen ? T.text.amber + '60' : T.border.subtle}`,
              color: exportingFmt ? T.text.muted : T.text.amber,
              fontSize: 9, fontWeight: 700, fontFamily: T.font.mono,
              cursor: exportingFmt ? 'not-allowed' : 'pointer', letterSpacing: 0.8,
            }}
          >
            {exportingFmt
              ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              : <Download size={11} />
            }
            EXPORT
            <ChevronDown size={9} />
          </button>

          {exportOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 60, marginTop: 4,
              background: T.bg.panel, border: `1px solid ${T.border.medium}`,
              minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
            }}>
              <button
                onClick={() => downloadCapsule('excel')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                  color: T.text.primary, fontSize: 10, fontFamily: T.font.mono, cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.bg.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <FileSpreadsheet size={13} color={T.text.green} />
                Excel Workbook (.xlsx)
              </button>
              <div style={{ height: 1, background: T.border.subtle, margin: '0 14px' }} />
              <button
                onClick={() => downloadCapsule('pdf')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                  color: T.text.primary, fontSize: 10, fontFamily: T.font.mono, cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.bg.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <FileText size={13} color={T.text.red} />
                Pitch Deck (.pdf)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 0,
        borderBottom: `1px solid ${T.border.medium}`,
        padding: '0 24px',
        background: T.bg.nav,
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 16px',
                background: 'none', border: 'none',
                borderBottom: active ? `2px solid ${T.text.amber}` : '2px solid transparent',
                color: active ? T.text.amber : T.text.muted,
                fontSize: 9, fontWeight: 700, fontFamily: T.font.mono,
                letterSpacing: 0.8, cursor: 'pointer',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 64px' }}>
        {activeTab === 'shares'   && <SharesTab capsuleId={capsuleId!} />}
        {activeTab === 'overview' && <OverviewTab capsule={capsule} />}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
