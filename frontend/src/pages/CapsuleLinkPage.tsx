import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Lock, AlertTriangle, Loader2, Copy, CheckCircle,
  Building2, TrendingUp, ChevronRight, Send, Key,
  BarChart3, DollarSign, Activity, Zap, Shield, Clock,
  ArrowRight, Users, FileText, ExternalLink, X,
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
}

interface ConvMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
  usage?: { tokens_input: number; tokens_output: number; total_charged_usd: number };
}

type SectionId = 'overview' | 'proforma' | 'capital' | 'analysis' | 'intel' | 'agent';

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
  if (!n || isNaN(v)) return '—';
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

// ── Helper components ─────────────────────────────────────────────────────────

function KpiTile({ label, value, sub, accent = TEXT }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px', minWidth: 120, flex: '1 1 120px' }}>
      <div style={{ fontSize: 10, fontFamily: MONO, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: MONO, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ label, badge }: { label: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: MONO, color: MUTED, whiteSpace: 'nowrap', marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>── {label}</span>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        {badge && (
          <span style={{ marginLeft: 8, fontSize: 10, fontFamily: MONO, color: BLUE, background: 'rgba(8,145,178,0.1)', border: `1px solid rgba(8,145,178,0.3)`, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{badge}</span>
        )}
      </div>
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
      <div style={{ fontSize: 11, color: AMBER, fontFamily: MONO, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
        → {action}
      </div>
    </div>
  );
}

function SkeletonLine({ w = '100%', h = 14 }: { w?: string; h?: number }) {
  return <div style={{ width: w, height: h, background: BORDER, borderRadius: 4, animation: 'pulse 2s ease-in-out infinite' }} />;
}

// ── Error screen ──────────────────────────────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CapsuleLinkPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<DealBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; msg: string } | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const navRef = useRef<HTMLDivElement>(null);

  // Agent state
  const [connected, setConnected] = useState(false);
  const [connectForm, setConnectForm] = useState({ provider: 'anthropic', api_key: '' });
  const [keyVisible, setKeyVisible] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConvMessage[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryCopied, setQueryCopied] = useState(false);
  const convBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/capsule-links/${token}/deal-book`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError({ status: res.status, msg: body.error ?? 'Failed to load deal book' });
          return;
        }
        const body = await res.json();
        setData(body);
      })
      .catch(() => setError({ status: 500, msg: 'Network error — please try again' }))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    convBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

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
      if (!res.ok) {
        setConnectError(body.error ?? 'Connection failed');
      } else {
        setConnected(true);
      }
    } catch {
      setConnectError('Network error — please try again');
    } finally {
      setConnectLoading(false);
    }
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
      if (!res.ok) {
        setConversation(prev => [...prev, { role: 'assistant', content: `Error: ${body.error ?? 'Query failed'}`, ts: new Date() }]);
      } else {
        setConversation(prev => [...prev, { role: 'assistant', content: body.response, ts: new Date(), usage: body.usage }]);
      }
    } catch {
      setConversation(prev => [...prev, { role: 'assistant', content: 'Network error — please try again', ts: new Date() }]);
    } finally {
      setQueryLoading(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
        <div style={{ height: 48, background: '#0d1117', borderBottom: `1px solid ${BORDER}` }} />
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkeletonLine w="60%" h={28} />
          <SkeletonLine w="40%" h={16} />
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonLine key={i} w="80px" h={72} />)}
          </div>
          <SkeletonLine h={200} />
        </div>
      </div>
    );
  }

  // ── Error states ──────────────────────────────────────────────────────────────

  if (error) {
    if (error.status === 404) {
      return <ErrorScreen title="This link is no longer active" detail="The capsule link you followed has expired, been revoked, or does not exist. Contact the sender to request a new link." />;
    }
    if (error.status === 429) {
      return <ErrorScreen title="Too many requests" detail="Please wait a few minutes before trying again." />;
    }
    return <ErrorScreen title="Unable to load deal book" detail={error.msg} />;
  }

  if (!data) return null;

  const { share, capsule } = data;
  const L1 = capsule.deal_data;
  const L2 = capsule.platform_intel;
  const L3 = capsule.user_adjustments;
  const MO = capsule.module_outputs;

  const fin = (MO.financial ?? MO.proforma) as Record<string, unknown> | undefined;
  const returns = (fin?.returns ?? fin) as Record<string, unknown> | undefined;
  const y1 = (fin?.year1 ?? fin?.proforma_year1) as Array<Record<string, unknown>> | undefined;
  const capitalStack = (fin?.capital_stack ?? fin?.capitalStack) as Record<string, unknown> | undefined;

  const rawCollision = (MO.collision_analysis ?? MO.collision) as Record<string, unknown> | undefined;
  const collisionAnalyses = (rawCollision && 'analyses' in rawCollision ? rawCollision.analyses : rawCollision) as Record<string, { score: number; insight: string; recommended_action: string }> | undefined;

  const expiresAt = share.expires_at;
  const isExpiringSoon = expiresAt && new Date(expiresAt).getTime() - Date.now() < 7 * 86_400_000;

  const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={13} /> },
    { id: 'proforma', label: 'Pro Forma', icon: <DollarSign size={13} /> },
    { id: 'capital', label: 'Capital', icon: <TrendingUp size={13} /> },
    { id: 'analysis', label: 'Analysis', icon: <Activity size={13} /> },
    { id: 'intel', label: 'Intelligence', icon: <Zap size={13} /> },
    ...(share.agent_enabled ? [{ id: 'agent' as SectionId, label: 'Agent', icon: <Key size={13} /> }] : []),
  ];

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
        textarea, input { background: ${SURFACE} !important; color: ${TEXT} !important; border: 1px solid ${BORDER} !important; border-radius: 6px !important; outline: none !important; font-family: inherit !important; }
        textarea:focus, input:focus { border-color: ${BLUE} !important; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>

      {/* ── Sticky Header ───────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0d1117', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: MONO, fontWeight: 700, color: BLUE, letterSpacing: '0.15em', fontSize: 13 }}>JEDI RE</span>
            <span style={{ color: BORDER, fontSize: 16 }}>|</span>
            <span style={{ color: MUTED, fontSize: 11 }}>Deal Intelligence</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={11} color={GREEN} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: '0.12em' }}>SECURED</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div style={{ paddingTop: 32, paddingBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontFamily: MONO, color: BLUE, background: 'rgba(8,145,178,0.12)', border: `1px solid rgba(8,145,178,0.3)`, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.08em' }}>
                  {capsule.asset_class || 'REAL ESTATE'}
                </span>
                {L1.units && <span style={{ fontSize: 10, fontFamily: MONO, color: MUTED }}>{String(L1.units)} UNITS</span>}
                {L1.year_built && <span style={{ fontSize: 10, fontFamily: MONO, color: MUTED }}>BUILT {String(L1.year_built)}</span>}
              </div>
              <h1 style={{ fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 700, color: TEXT, lineHeight: 1.2, marginBottom: 4 }}>
                {capsule.property_address}
              </h1>
              {capsule.snapshot_taken_at && (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
                  Snapshot: {fmtDate(capsule.snapshot_taken_at)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              {capsule.jedi_score != null && capsule.jedi_score > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: `1px solid rgba(16,185,129,0.3)`, borderRadius: 8, padding: '6px 12px' }}>
                  <TrendingUp size={14} color={GREEN} />
                  <span style={{ fontFamily: MONO, fontWeight: 700, color: GREEN, fontSize: 14 }}>
                    JEDI {capsule.jedi_score}
                  </span>
                </div>
              )}
              {isExpiringSoon && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: MONO, color: AMBER }}>
                  <Clock size={10} />
                  Expires {fmtDate(expiresAt)}
                </div>
              )}
            </div>
          </div>

          {/* Preview pitch card */}
          {share.preview_text && (
            <div style={{ marginTop: 20, background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${BLUE}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: MONO, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>From the sender</div>
              <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{share.preview_text}</p>
            </div>
          )}
        </div>

        {/* ── Sticky section nav ─────────────────────────────────────────────── */}
        <div ref={navRef} style={{ position: 'sticky', top: 48, zIndex: 40, background: BG, borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 16px',
                  fontSize: 12, fontFamily: MONO,
                  color: activeSection === s.id ? BLUE : MUTED,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeSection === s.id ? BLUE : 'transparent'}`,
                  transition: 'color .15s, border-color .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.icon} {s.label}
                {s.id === 'agent' && !connected && (
                  <span style={{ fontSize: 9, background: AMBER, color: '#000', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>CONNECT</span>
                )}
                {s.id === 'agent' && connected && (
                  <span style={{ fontSize: 9, background: GREEN, color: '#000', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>LIVE</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Section content ────────────────────────────────────────────────── */}
        <div style={{ paddingTop: 28 }}>

          {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
          {activeSection === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <SectionLabel label="Key Metrics" badge="As Underwritten" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <KpiTile label="Purchase Price" value={fmtM(L1.asking_price)} />
                  <KpiTile label="Going-In Cap" value={fmtPct(L1.broker_cap_rate)} />
                  <KpiTile label="Target IRR" value={fmtPct(L3.target_irr ?? returns?.irr)} accent={GREEN} />
                  <KpiTile label="Hold Period" value={fmtYrs(L3.preferred_hold_period)} />
                  <KpiTile label="Equity Multiple" value={fmtX(returns?.equity_multiple ?? returns?.em)} accent={GREEN} />
                  <KpiTile label="Max LTV" value={fmtPct(L3.max_ltv)} />
                </div>
              </div>

              <div>
                <SectionLabel label="Three-Layer Analysis" badge="Broker · Market · Model" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#0d1117' }}>
                        <th style={{ padding: '10px 12px', fontSize: 10, fontFamily: MONO, color: MUTED, textAlign: 'left', fontWeight: 600, letterSpacing: '0.06em' }}>METRIC</th>
                        <th style={{ padding: '10px 12px', fontSize: 10, fontFamily: MONO, color: '#93C5FD', textAlign: 'right', fontWeight: 600, letterSpacing: '0.06em' }}>BROKER</th>
                        <th style={{ padding: '10px 12px', fontSize: 10, fontFamily: MONO, color: '#C4B5FD', textAlign: 'right', fontWeight: 600, letterSpacing: '0.06em' }}>MARKET</th>
                        <th style={{ padding: '10px 12px', fontSize: 10, fontFamily: MONO, color: GREEN, textAlign: 'right', fontWeight: 600, letterSpacing: '0.06em' }}>MODEL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <LayerRow label="Rent 1BR / mo" broker={fmtDollar(L1.broker_rent_1br)} market={fmtDollar(L2.market_rent_1br)} model={fmtDollar(L3.adjusted_rent_1br)} />
                      <LayerRow label="Rent 2BR / mo" broker={fmtDollar(L1.broker_rent_2br)} market={fmtDollar(L2.market_rent_2br)} model={fmtDollar(L3.adjusted_rent_2br)} />
                      <LayerRow label="Occupancy" broker={fmtPct(L1.broker_occupancy)} market={fmtPct(L2.submarket_vacancy ? 100 - Number(L2.submarket_vacancy) : undefined)} model={fmtPct(L3.adjusted_occupancy)} />
                      <LayerRow label="NOI" broker={fmtM(L1.broker_noi)} market="—" model={fmtM(L3.adjusted_noi ?? fin?.noi ?? fin?.year1_noi)} />
                      <LayerRow label="Cap Rate" broker={fmtPct(L1.broker_cap_rate)} market={fmtPct(L2.market_cap_rate_avg)} model={fmtPct(L3.adjusted_cap_rate)} />
                      <LayerRow label="Exit Cap (projected)" broker="—" market="—" model={fmtPct(L3.exit_cap_assumption)} />
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
                  {[
                    { color: '#93C5FD', label: 'Layer 1 — Broker claims (preserved as-reported)' },
                    { color: '#C4B5FD', label: 'Layer 2 — Platform market data' },
                    { color: GREEN, label: 'Layer 3 — Underwriter model' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: MUTED }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Comp sales */}
              {Array.isArray(L2.comp_sales) && L2.comp_sales.length > 0 && (
                <div>
                  <SectionLabel label="Recent Comparable Sales" />
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

          {/* ── PRO FORMA ─────────────────────────────────────────────────────── */}
          {activeSection === 'proforma' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* Investment returns */}
              <div>
                <SectionLabel label="Investment Returns" badge="Modeled" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <KpiTile label="Levered IRR" value={fmtPct(returns?.irr ?? fin?.irr)} accent={GREEN} />
                  <KpiTile label="Equity Multiple" value={fmtX(returns?.equity_multiple ?? returns?.em ?? fin?.equity_multiple)} accent={GREEN} />
                  <KpiTile label="Cash-on-Cash Y1" value={fmtPct(returns?.coc ?? returns?.cash_on_cash ?? fin?.coc)} />
                  <KpiTile label="Unlevered IRR" value={fmtPct(returns?.unlevered_irr ?? fin?.unlevered_irr)} />
                  <KpiTile label="Y1 NOI" value={fmtM(fin?.noi ?? fin?.year1_noi ?? (y1 as any)?.find?.((r: any) => r.field === 'noi')?.resolved)} />
                  <KpiTile label="Exit Value" value={fmtM(returns?.exit_value ?? fin?.exit_value)} />
                </div>
              </div>

              {/* Year 1 operating statement */}
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
                          const isSubtotal = ['egr', 'egi', 'noi', 'gpr'].includes(String(row.field));
                          return (
                            <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, background: isSubtotal ? 'rgba(8,145,178,0.05)' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', fontSize: 12, color: isSubtotal ? BLUE : TEXT, fontFamily: isSubtotal ? MONO : 'inherit', fontWeight: isSubtotal ? 600 : 400 }}>
                                {String(row.label ?? row.field)}
                              </td>
                              <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{row.broker != null ? fmtM(row.broker) : '—'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{row.platform != null ? fmtM(row.platform) : '—'}</td>
                              <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: isSubtotal ? GREEN : TEXT, fontWeight: isSubtotal ? 700 : 400, textAlign: 'right' }}>
                                {row.resolved != null ? fmtM(row.resolved) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: MONO, color: MUTED, textAlign: 'right' }}>{row.perUnit != null ? fmtDollar(row.perUnit) : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 32, textAlign: 'center' }}>
                  <BarChart3 size={32} color={MUTED} style={{ margin: '0 auto 12px' }} />
                  <div style={{ color: MUTED, fontSize: 13 }}>No Year 1 line-item data in this snapshot.</div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>Returns and capital structure may still be available below.</div>
                </div>
              )}

              {/* Multi-year projections */}
              {Array.isArray(fin?.projections) && (fin.projections as unknown[]).length > 0 && (
                <div>
                  <SectionLabel label="Multi-Year Projections" />
                  <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
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
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>DSCR shown in red when below 1.25x covenant threshold.</div>
                </div>
              )}
            </div>
          )}

          {/* ── CAPITAL ───────────────────────────────────────────────────────── */}
          {activeSection === 'capital' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <SectionLabel label="Capital Structure" badge="At Acquisition" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                  <KpiTile label="Purchase Price" value={fmtM(L1.asking_price ?? capitalStack?.purchasePrice)} />
                  <KpiTile label="LTV" value={fmtPct(L3.max_ltv ?? capitalStack?.ltv)} />
                  <KpiTile label="Loan Amount" value={fmtM(capitalStack?.loanAmount ?? capitalStack?.debt)} />
                  <KpiTile label="Equity" value={fmtM(capitalStack?.equity ?? capitalStack?.equityContribution)} accent={GREEN} />
                  <KpiTile label="Total Capitalization" value={fmtM(capitalStack?.totalCost ?? capitalStack?.total)} />
                </div>

                {/* Sources & Uses */}
                {capitalStack && Object.keys(capitalStack).length > 0 && (
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
                      {[
                        { label: 'Rate', value: fmtPct(capitalStack.rate ?? capitalStack.interestRate) },
                        { label: 'Term', value: capitalStack.term ? `${capitalStack.term} yr` : '—' },
                        { label: 'Amortization', value: capitalStack.amortization ? `${capitalStack.amortization} yr` : '—' },
                        { label: 'DSCR (Y1 est.)', value: capitalStack.dscr ? `${Number(capitalStack.dscr).toFixed(2)}x` : '—' },
                      ].map(r => (
                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderTop: `1px solid ${BORDER}` }}>
                          <span style={{ fontSize: 12, color: MUTED }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontFamily: MONO, color: TEXT }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!capitalStack || Object.keys(capitalStack).length === 0) && (
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 32, textAlign: 'center' }}>
                    <DollarSign size={32} color={MUTED} style={{ margin: '0 auto 12px' }} />
                    <div style={{ color: MUTED, fontSize: 13 }}>Capital structure detail not included in this snapshot.</div>
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>Key metrics above sourced from deal assumptions.</div>
                  </div>
                )}
              </div>

              {/* Waterfall (if available) */}
              {(MO.waterfall || fin?.waterfall) && (
                <div>
                  <SectionLabel label="Waterfall" badge="LP / GP Distribution" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '16px 20px', color: MUTED, fontSize: 12 }}>
                    Waterfall data present in snapshot — connect agent to query distribution details.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYSIS ──────────────────────────────────────────────────────── */}
          {activeSection === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <SectionLabel label="Collision Analysis" badge={`Overall: ${capsule.collision_score ?? '—'}/100`} />
                {collisionAnalyses && Object.keys(collisionAnalyses).length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {Object.entries(collisionAnalyses).map(([key, data]) => (
                      <CollisionCard
                        key={key}
                        name={key}
                        score={data?.score ?? 0}
                        insight={data?.insight ?? 'No data'}
                        action={data?.recommended_action ?? '—'}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 32, textAlign: 'center' }}>
                    <Activity size={32} color={MUTED} style={{ margin: '0 auto 12px' }} />
                    <div style={{ color: MUTED, fontSize: 13 }}>No collision analysis in this snapshot.</div>
                  </div>
                )}
              </div>

              {/* Evidence narrative */}
              {(MO.evidence_narrative ?? MO.evidence) && (
                <div>
                  <SectionLabel label="Evidence Narrative" badge="AI-Generated" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20 }}>
                    <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.8 }}>
                      {String(MO.evidence_narrative ?? (MO.evidence as any)?.narrative ?? 'Evidence detail available — connect agent to explore.')}
                    </p>
                  </div>
                </div>
              )}

              {/* Due diligence */}
              {MO.due_diligence && (
                <div>
                  <SectionLabel label="Due Diligence Summary" />
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 20 }}>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.7 }}>
                      {typeof MO.due_diligence === 'object'
                        ? JSON.stringify(MO.due_diligence, null, 2).slice(0, 800)
                        : String(MO.due_diligence)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INTELLIGENCE ──────────────────────────────────────────────────── */}
          {activeSection === 'intel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <SectionLabel label="Market Indicators" badge="Platform Intelligence" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                  <KpiTile label="Supply Risk" value={L2.supply_risk_score ? `${L2.supply_risk_score}/100` : '—'} accent={Number(L2.supply_risk_score) > 60 ? RED : Number(L2.supply_risk_score) > 40 ? AMBER : GREEN} />
                  <KpiTile label="Employment Growth" value={fmtPct(L2.employment_growth)} accent={GREEN} />
                  <KpiTile label="Submarket Vacancy" value={fmtPct(L2.submarket_vacancy)} />
                  <KpiTile label="Nearby Developments" value={L2.nearby_developments ? String(L2.nearby_developments) : '—'} />
                  <KpiTile label="Units in Pipeline" value={L2.units_under_construction ? String(L2.units_under_construction) : '—'} accent={AMBER} />
                  <KpiTile label="Market Cap Rate" value={fmtPct(L2.market_cap_rate_avg)} />
                </div>

                {/* Market rent comparison */}
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ padding: '10px 14px', background: '#0d1117', fontSize: 10, fontFamily: MONO, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Market Rent Comparison</div>
                  {[
                    { label: '1BR Market Rent', broker: fmtDollar(L1.broker_rent_1br), market: fmtDollar(L2.market_rent_1br), model: fmtDollar(L3.adjusted_rent_1br) },
                    { label: '2BR Market Rent', broker: fmtDollar(L1.broker_rent_2br), market: fmtDollar(L2.market_rent_2br), model: fmtDollar(L3.adjusted_rent_2br) },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, borderTop: `1px solid ${BORDER}`, padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, color: MUTED }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: '#93C5FD', textAlign: 'right' }}>{r.broker}</span>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: '#C4B5FD', textAlign: 'right' }}>{r.market}</span>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: GREEN, textAlign: 'right' }}>{r.model}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intelligence feed (static platform data) */}
              <div>
                <SectionLabel label="Deal & Market Intelligence" badge="M06 Pipeline" />
                <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    { emoji: '📊', headline: 'Platform market data captured at snapshot time', source: 'JEDI RE', age: fmtDate(capsule.snapshot_taken_at), sentiment: 'LIVE', color: GREEN },
                    { emoji: '🏗️', headline: `Supply pipeline: ${L2.units_under_construction ? `${L2.units_under_construction} units under construction` : 'data in snapshot'}`, source: 'Platform', age: '', sentiment: 'NEUTRAL', color: MUTED },
                    { emoji: '💼', headline: `Employment growth: ${fmtPct(L2.employment_growth)} submarket trend`, source: 'Platform', age: '', sentiment: L2.employment_growth && Number(L2.employment_growth) > 2 ? 'POSITIVE' : 'NEUTRAL', color: L2.employment_growth && Number(L2.employment_growth) > 2 ? GREEN : MUTED },
                    { emoji: '🏘️', headline: `Submarket vacancy: ${fmtPct(L2.submarket_vacancy)} | Market cap rate: ${fmtPct(L2.market_cap_rate_avg)}`, source: 'CoStar', age: '', sentiment: 'NEUTRAL', color: MUTED },
                  ].map((item, i, arr) => (
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
          {activeSection === 'agent' && share.agent_enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!connected ? (
                <>
                  <div>
                    <SectionLabel label="Interactive Agent" badge="Bring Your Own Key" />
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24, marginBottom: 20 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Engage with this deal interactively</h3>
                      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
                        The deal book above contains the full static analysis. Connect your own API key to unlock on-demand reasoning: run sensitivities, stress-test assumptions, query the evidence base, and ask follow-on questions the agent answers by reasoning against this exact snapshot.
                      </p>

                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontFamily: MONO, color: BLUE, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Example questions the agent can answer:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            'How would levered IRR change if the exit cap moves 25bps higher at end of hold?',
                            "What's the sensitivity of Year 5 cash-on-cash to rent growth coming in 200bps below base case?",
                            'At what interest rate does DSCR break below 1.25x under a stress scenario?',
                          ].map((q, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', cursor: 'pointer' }}
                              onClick={() => {/* will be enabled post-connect */}}>
                              <ChevronRight size={13} color={BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
                              <span style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{q}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: MUTED, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 24 }}>
                        <DollarSign size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>Priced at your API provider's cost plus a 30% platform fee. Typical analytical query: $0.02–$0.08. Your key is AES-256-GCM encrypted at rest and used only for queries on this capsule.</span>
                      </div>

                      <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: MONO, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Provider</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {['anthropic', 'openai'].map(p => (
                              <label key={p} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: connectForm.provider === p ? 'rgba(8,145,178,0.1)' : SURFACE2, border: `1px solid ${connectForm.provider === p ? BLUE : BORDER}`, borderRadius: 6, padding: '10px 14px', cursor: 'pointer' }}>
                                <input type="radio" name="provider" value={p} checked={connectForm.provider === p}
                                  onChange={() => setConnectForm(f => ({ ...f, provider: p }))}
                                  style={{ accentColor: BLUE, background: 'transparent !important', border: 'none !important' }} />
                                <span style={{ fontSize: 12, color: connectForm.provider === p ? TEXT : MUTED, textTransform: 'capitalize' }}>{p === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI (GPT-4o)'}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontFamily: MONO, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>API Key</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={keyVisible ? 'text' : 'password'}
                              value={connectForm.api_key}
                              onChange={e => setConnectForm(f => ({ ...f, api_key: e.target.value }))}
                              placeholder={connectForm.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                              style={{ width: '100%', padding: '10px 40px 10px 12px', fontSize: 13, fontFamily: MONO }}
                            />
                            <button type="button" onClick={() => setKeyVisible(v => !v)}
                              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: MUTED, padding: 0 }}>
                              {keyVisible ? <X size={14} /> : <Key size={14} />}
                            </button>
                          </div>
                        </div>

                        {connectError && (
                          <div style={{ display: 'flex', gap: 8, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: RED }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            {connectError}
                          </div>
                        )}

                        <button type="submit" disabled={connectLoading || !connectForm.api_key}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', background: connectLoading || !connectForm.api_key ? BORDER : BLUE, color: connectLoading || !connectForm.api_key ? MUTED : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, transition: 'background .15s' }}>
                          {connectLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Key size={15} />}
                          {connectLoading ? 'Validating key...' : 'Connect and Enable Agent'}
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Connected — query interface */}
                  <div>
                    <SectionLabel label="Agent Session" badge="Connected · Snapshot Context" />
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                      {/* Conversation thread */}
                      <div style={{ minHeight: 240, maxHeight: 480, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {conversation.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED }}>
                            <Zap size={28} color={BLUE} style={{ margin: '0 auto 10px' }} />
                            <div style={{ fontSize: 13, marginBottom: 16 }}>Agent connected. Ask anything about this deal.</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480, margin: '0 auto' }}>
                              {[
                                'How would levered IRR change if the exit cap moves 25bps higher at end of hold?',
                                "What's the sensitivity of Year 5 cash-on-cash to rent growth coming in 200bps below base case?",
                                'At what interest rate does DSCR break below 1.25x?',
                              ].map((q, i) => (
                                <button key={i} onClick={() => handleQuery(q)}
                                  style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '9px 14px', fontSize: 12, color: TEXT, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <ArrowRight size={12} color={BLUE} style={{ flexShrink: 0 }} />
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {conversation.map((msg, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div style={{ fontSize: 10, fontFamily: MONO, color: MUTED }}>
                              {msg.role === 'user' ? 'YOU' : 'JEDI AGENT'} · {msg.ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{ maxWidth: '85%', background: msg.role === 'user' ? 'rgba(8,145,178,0.15)' : SURFACE2, border: `1px solid ${msg.role === 'user' ? 'rgba(8,145,178,0.3)' : BORDER}`, borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', padding: '10px 14px', fontSize: 13, color: TEXT, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                              {msg.content}
                            </div>
                            {msg.usage && (
                              <div style={{ fontSize: 10, fontFamily: MONO, color: MUTED }}>
                                {msg.usage.tokens_input + msg.usage.tokens_output} tokens · ${msg.usage.total_charged_usd.toFixed(4)}
                              </div>
                            )}
                          </div>
                        ))}
                        {queryLoading && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 12 }}>
                            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            Agent reasoning...
                          </div>
                        )}
                        <div ref={convBottomRef} />
                      </div>

                      {/* Query input */}
                      <div style={{ borderTop: `1px solid ${BORDER}`, padding: 12, display: 'flex', gap: 8 }}>
                        <textarea
                          value={queryInput}
                          onChange={e => setQueryInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery(); } }}
                          placeholder="Ask about this deal... (Enter to send, Shift+Enter for new line)"
                          rows={2}
                          style={{ flex: 1, padding: '9px 12px', fontSize: 13, resize: 'none', lineHeight: 1.5 }}
                        />
                        <button onClick={() => handleQuery()} disabled={!queryInput.trim() || queryLoading}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, alignSelf: 'flex-end', background: !queryInput.trim() || queryLoading ? BORDER : BLUE, border: 'none', borderRadius: 6, color: !queryInput.trim() || queryLoading ? MUTED : '#fff', flexShrink: 0 }}>
                          <Send size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === 'agent' && !share.agent_enabled && (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 32, textAlign: 'center' }}>
              <Lock size={32} color={MUTED} style={{ margin: '0 auto 12px' }} />
              <div style={{ color: MUTED, fontSize: 13 }}>Agent interaction was not enabled for this share.</div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>Contact the sender to request an agent-enabled link.</div>
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>Powered by JEDI RE</span>
          <span style={{ color: BORDER }}>·</span>
          <span style={{ fontSize: 10, color: MUTED }}>This content reflects a snapshot shared at {fmtDate(capsule.snapshot_taken_at ?? capsule.created_at)}</span>
          {expiresAt && (
            <>
              <span style={{ color: BORDER }}>·</span>
              <span style={{ fontSize: 10, color: MUTED }}>Link expires {fmtDate(expiresAt)}</span>
            </>
          )}
        </div>
      </footer>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
