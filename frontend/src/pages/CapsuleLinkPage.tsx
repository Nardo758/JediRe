/**
 * CapsuleLinkPage — Task #899 + #900
 *
 * Full Bloomberg dark-mode deal-book landing page for the legacy token-format URL:
 *   /capsule-links/:accessToken
 *
 * Backend endpoints consumed:
 *   GET  /api/v1/capsule-links/:accessToken/deal-book  — full capsule payload
 *   POST /api/v1/capsule-links/:accessToken/connect_api — connect provider API key
 *   POST /api/v1/capsule-links/:accessToken/query       — send AI query
 *
 * No platform auth required. Share token is the credential.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, ChevronDown, ChevronRight, Loader2, Bot, User, AlertCircle, ShieldOff, Download, FileSpreadsheet, FileText } from 'lucide-react';

// ─── Design tokens ───────────────────────────────────────────────────────────
const BG       = '#0A0E17';
const BG_NAV   = '#0D1117';
const BG_CARD  = '#0F1319';
const BORDER   = '#1E2A3B';
const AMBER    = '#F0B429';
const GREEN    = '#3FB950';
const CYAN     = '#06B6D4';
const TEXT     = '#C9D1D9';
const TEXT_MID = '#8B9CB0';
const TEXT_DIM = '#5A6A7E';
const MONO     = '"JetBrains Mono","Fira Mono",monospace';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DealBookShare {
  share_type: string;
  agent_enabled: boolean;
  allow_document_download: boolean;
  allow_agent_interaction: boolean;
  expires_at: string | null;
  preview_text: string | null;
  preview_metadata: Record<string, unknown> | null;
  recipient_email: string | null;
}

interface DealBookCapsule {
  id: string;
  property_address: string | null;
  asset_class: string | null;
  status: string | null;
  jedi_score: number | null;
  collision_score: number | null;
  deal_data: Record<string, unknown>;
  platform_intel: Record<string, unknown>;
  user_adjustments: Record<string, unknown>;
  module_outputs: Record<string, unknown>;
  created_at: string;
}

interface DealBook {
  share: DealBookShare;
  capsule: DealBookCapsule;
  overlay: Record<string, unknown>;
  attribution_visible: boolean;
  sender_branding: { company_name: string | null; logo_url: string | null };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `$${val.toLocaleString()}`;
    return String(val);
  }
  if (typeof val === 'string') {
    // Detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try { return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return val; }
    }
    return val.length > 80 ? val.slice(0, 80) + '…' : val;
  }
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 120) + (JSON.stringify(val).length > 120 ? '…' : '');
  return String(val);
}

function humanKey(key: string): string {
  return key
    .replace(/_lv$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Flatten nested LV objects to their .resolved value for display */
function flattenForDisplay(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      'resolved' in (val as Record<string, unknown>)
    ) {
      result[key] = (val as Record<string, unknown>).resolved;
    } else {
      result[key] = val;
    }
  }
  return result;
}

/** Extract a numeric metric from nested paths */
function dig(obj: Record<string, unknown>, ...keys: string[]): number | null {
  let cur: unknown = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  const n = parseFloat(String(cur));
  return isNaN(n) ? null : n;
}

function fmtScore(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(1);
}

function fmtExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const d = new Date(expiresAt);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `${daysLeft}d`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataLayerTable({ data, label }: { data: Record<string, unknown>; label: string }) {
  const [expanded, setExpanded] = useState(true);
  const flat = flattenForDisplay(data);
  const entries = Object.entries(flat).filter(([, v]) =>
    v !== null && v !== undefined && v !== '' &&
    !['forked_from_share', 'forked_from_capsule', 'forked_at'].includes('')
  );

  if (entries.length === 0) {
    return (
      <div style={{ padding: '12px 0', fontSize: 10, color: TEXT_DIM, fontFamily: MONO }}>
        No {label.toLowerCase()} data available.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px 0', borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {expanded ? <ChevronDown size={12} color={TEXT_DIM} /> : <ChevronRight size={12} color={TEXT_DIM} />}
        <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT_DIM, fontWeight: 700, letterSpacing: 1 }}>
          {label.toUpperCase()} ({entries.length} fields)
        </span>
      </button>
      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {entries.map(([key, val], i) => (
            <div
              key={key}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px',
                background: i % 2 === 0 ? `${BG_NAV}80` : 'transparent',
                borderBottom: `1px solid ${BORDER}22`,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '48%' }}>
                {humanKey(key)}
              </span>
              <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT, textAlign: 'right', maxWidth: '48%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmt(val)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricsBadge({ label, value, accent }: { label: string; value: string | null; accent?: string }) {
  const color = accent ?? TEXT_MID;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '10px 18px', background: BG_CARD, border: `1px solid ${BORDER}`,
      minWidth: 100, flex: '1 1 100px',
    }}>
      <span style={{ fontSize: 14, fontFamily: MONO, fontWeight: 700, color, letterSpacing: 0.5 }}>
        {value ?? '—'}
      </span>
      <span style={{ fontSize: 8, fontFamily: MONO, color: TEXT_DIM, letterSpacing: 1, marginTop: 3 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Agent Connect Panel ──────────────────────────────────────────────────────

function AgentConnectPanel({ accessToken }: { accessToken: string }) {
  const [connected, setConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const resp = await fetch(`/api/v1/capsule-links/${accessToken}/connect_api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey.trim() }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? body.detail ?? 'Connection failed');
      setConnectionId(body.connection_id);
      setConnected(true);
      setMessages([{
        role: 'assistant',
        content: `Connected via ${provider === 'anthropic' ? 'Claude' : 'GPT-4'}. I have full context on this deal — ask me anything about the numbers, assumptions, or investment thesis.`,
      }]);
    } catch (err: any) {
      setConnectError(err.message ?? 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleQuery = async () => {
    const msg = input.trim();
    if (!msg || querying) return;
    setInput('');
    setQueryError(null);
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setQuerying(true);
    try {
      const resp = await fetch(`/api/v1/capsule-links/${accessToken}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? 'Query failed');
      setMessages(prev => [...prev, { role: 'assistant', content: body.response }]);
    } catch (err: any) {
      setQueryError(err.message ?? 'Query failed');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setQuerying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderTop: `2px solid ${CYAN}` }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <Bot size={14} color={CYAN} />
        <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: CYAN, letterSpacing: 1 }}>
          DEAL AGENT
        </span>
        {connected && connectionId && (
          <span style={{
            marginLeft: 'auto', fontSize: 8, fontFamily: MONO, color: GREEN,
            padding: '2px 8px', border: `1px solid ${GREEN}40`, letterSpacing: 1,
          }}>
            ● CONNECTED
          </span>
        )}
      </div>

      {!connected ? (
        /* Connect form */
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 11, fontFamily: MONO, color: TEXT_DIM, margin: 0, lineHeight: 1.6 }}>
            Connect your AI API key to query the deal agent. Your key is validated then stored encrypted (AES-256-GCM).
          </p>

          {/* Provider selector */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['anthropic', 'openai'] as const).map(p => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                style={{
                  flex: 1, padding: '8px 12px', fontFamily: MONO, fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, border: `1px solid ${provider === p ? CYAN : BORDER}`,
                  background: provider === p ? `${CYAN}12` : 'transparent',
                  color: provider === p ? CYAN : TEXT_DIM, cursor: 'pointer',
                }}
              >
                {p === 'anthropic' ? 'CLAUDE (ANTHROPIC)' : 'GPT-4 (OPENAI)'}
              </button>
            ))}
          </div>

          {/* API key input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 9, fontFamily: MONO, color: TEXT_DIM, letterSpacing: 1 }}>
              {provider === 'anthropic' ? 'ANTHROPIC API KEY' : 'OPENAI API KEY'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              style={{
                background: BG, border: `1px solid ${BORDER}`, borderRadius: 4,
                padding: '9px 12px', fontFamily: MONO, fontSize: 11, color: TEXT,
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
            />
          </div>

          {connectError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
              background: '#2A1218', border: '1px solid #F8514940', borderRadius: 4,
              fontSize: 10, fontFamily: MONO, color: '#F85149',
            }}>
              <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              {connectError}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting || !apiKey.trim()}
            style={{
              padding: '10px 20px', background: !apiKey.trim() ? BORDER : CYAN,
              color: !apiKey.trim() ? TEXT_DIM : '#000', border: 'none',
              fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1,
              cursor: connecting || !apiKey.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: connecting ? 0.7 : 1, transition: 'background 0.15s',
            }}
          >
            {connecting
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> VALIDATING KEY…</>
              : 'CONNECT API KEY →'
            }
          </button>
        </div>
      ) : (
        /* Conversation thread */
        <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.role === 'user' ? `${AMBER}20` : `${CYAN}20`,
                  border: `1px solid ${msg.role === 'user' ? AMBER : CYAN}40`,
                }}>
                  {msg.role === 'user'
                    ? <User size={12} color={AMBER} />
                    : <Bot size={12} color={CYAN} />
                  }
                </div>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px',
                  background: msg.role === 'user' ? `${AMBER}08` : BG_NAV,
                  border: `1px solid ${msg.role === 'user' ? AMBER + '30' : BORDER}`,
                  fontSize: 11, fontFamily: MONO, color: TEXT, lineHeight: 1.65,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {querying && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${CYAN}20`, border: `1px solid ${CYAN}40`,
                }}>
                  <Loader2 size={12} color={CYAN} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT_DIM }}>Thinking…</span>
              </div>
            )}
            {queryError && (
              <div style={{
                padding: '8px 12px', background: '#2A1218', border: '1px solid #F8514940',
                fontSize: 10, fontFamily: MONO, color: '#F85149',
              }}>
                {queryError}
              </div>
            )}
          </div>

          {/* Input row */}
          <div style={{
            padding: '10px 12px', borderTop: `1px solid ${BORDER}`,
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent about this deal… (Enter to send)"
              rows={2}
              style={{
                flex: 1, background: BG, border: `1px solid ${BORDER}`,
                padding: '8px 10px', fontFamily: MONO, fontSize: 11, color: TEXT,
                outline: 'none', resize: 'none', lineHeight: 1.5,
              }}
            />
            <button
              onClick={handleQuery}
              disabled={!input.trim() || querying}
              style={{
                padding: '10px 14px', background: input.trim() && !querying ? CYAN : BORDER,
                color: input.trim() && !querying ? '#000' : TEXT_DIM,
                border: 'none', cursor: input.trim() && !querying ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CapsuleLinkPage() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [data, setData] = useState<DealBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<'deal' | 'intel' | 'adjustments'>('deal');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingFmt, setExportingFmt] = useState<'excel' | 'pdf' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const downloadExport = useCallback(async (format: 'excel' | 'pdf', propertyAddress: string | null) => {
    if (!accessToken) return;
    setExportOpen(false);
    setExportingFmt(format);
    try {
      const res = await fetch(`/api/v1/capsule-links/${accessToken}/export/${format}`);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const safeName = (propertyAddress ?? 'deal').replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 50);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeName}_capsule.${ext}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExportingFmt(null);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) { setError('Missing access token.'); setLoading(false); return; }
    fetch(`/api/v1/capsule-links/${accessToken}/deal-book`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? 'Deal link is invalid or has expired.');
        }
        return r.json() as Promise<DealBook>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message ?? 'Failed to load deal.'); setLoading(false); });
  }, [accessToken]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Loader2 size={24} color={AMBER} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT_DIM, letterSpacing: 1 }}>LOADING DEAL BOOK…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
        <ShieldOff size={36} color={TEXT_DIM} />
        <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT, fontWeight: 700, textAlign: 'center' }}>
          {error ?? 'Deal not found'}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT_DIM, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
          This link may have expired or been revoked by the sender.
        </div>
      </div>
    );
  }

  const { share, capsule, attribution_visible, sender_branding } = data;

  // Extract key metrics
  const dd = flattenForDisplay(capsule.deal_data);
  const mo = capsule.module_outputs as Record<string, unknown>;
  const pi = capsule.platform_intel as Record<string, unknown>;

  const purchasePrice = dig(dd as Record<string, unknown>, 'purchase_price') ?? dig(dd as Record<string, unknown>, 'purchasePrice');
  const noi = dig(dd as Record<string, unknown>, 'noi') ?? dig(dd as Record<string, unknown>, 'annual_noi');
  const capRate = dig(dd as Record<string, unknown>, 'cap_rate') ?? dig(dd as Record<string, unknown>, 'going_in_cap_rate');
  const holdPeriod = dig(dd as Record<string, unknown>, 'hold_period') ?? dig(dd as Record<string, unknown>, 'holdPeriod');
  const exitCap = dig(dd as Record<string, unknown>, 'exit_cap_rate') ?? dig(dd as Record<string, unknown>, 'exitCapRate');
  const ltv = dig(dd as Record<string, unknown>, 'ltv') ?? dig(dd as Record<string, unknown>, 'loan_to_value');

  // Format metric values
  const fmtPrice = purchasePrice ? `$${(purchasePrice / 1_000_000).toFixed(1)}M` : null;
  const fmtNoi = noi ? `$${Math.round(noi).toLocaleString()}` : null;
  const fmtCap = capRate ? `${(capRate > 1 ? capRate : capRate * 100).toFixed(2)}%` : null;
  const fmtHold = holdPeriod ? `${holdPeriod}yr` : null;
  const fmtExit = exitCap ? `${(exitCap > 1 ? exitCap : exitCap * 100).toFixed(2)}%` : null;
  const fmtLtv = ltv ? `${(ltv > 1 ? ltv : ltv * 100).toFixed(0)}%` : null;

  const expiryLabel = fmtExpiry(share.expires_at);
  const expiryColor = expiryLabel === 'EXPIRED' ? '#F85149' : expiryLabel.includes('SOON') ? AMBER : TEXT_DIM;

  const layerTabs = [
    { key: 'deal' as const, label: 'DEAL DATA', data: capsule.deal_data },
    { key: 'intel' as const, label: 'PLATFORM INTEL', data: capsule.platform_intel },
    { key: 'adjustments' as const, label: 'USER INPUTS', data: capsule.user_adjustments },
  ];

  const activeData = layerTabs.find(t => t.key === activeLayer)?.data ?? {};

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: MONO }}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: BG_NAV, borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 40, flexShrink: 0,
      }}>
        {/* Left: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {attribution_visible && sender_branding.logo_url ? (
            <img src={sender_branding.logo_url} alt="logo" style={{ height: 22, maxWidth: 80, objectFit: 'contain' }} />
          ) : attribution_visible ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: AMBER, letterSpacing: 2 }}>
              {sender_branding.company_name ?? 'JEDI RE'}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 800, color: AMBER, letterSpacing: 2 }}>JEDI RE</span>
          )}
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 1.2, padding: '2px 8px',
            background: `${CYAN}14`, color: CYAN, border: `1px solid ${CYAN}30`,
          }}>
            SHARED VIEW
          </span>
        </div>

        {/* Right: share type + expiry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {share.agent_enabled && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 1, padding: '2px 8px',
              background: '#1A2A3A', color: '#58A6FF', border: '1px solid #58A6FF40',
            }}>
              ⚡ AGENT-ENABLED
            </span>
          )}
          <span style={{ fontSize: 9, color: expiryColor, letterSpacing: 0.5 }}>
            EXPIRES: {expiryLabel}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Property hero ──────────────────────────────────────────────────── */}
        <div style={{
          background: BG_CARD, border: `1px solid ${BORDER}`,
          borderTop: `2px solid ${AMBER}`, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: 0.5, marginBottom: 6 }}>
                {capsule.property_address ?? 'UNDISCLOSED ADDRESS'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {capsule.asset_class && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '2px 8px',
                    background: `${AMBER}14`, color: AMBER, border: `1px solid ${AMBER}30`,
                  }}>
                    {capsule.asset_class.toUpperCase()}
                  </span>
                )}
                {capsule.status && (
                  <span style={{ fontSize: 10, color: TEXT_DIM }}>{capsule.status}</span>
                )}
                {share.preview_text && (
                  <span style={{ fontSize: 10, color: TEXT_DIM, fontStyle: 'italic' }}>
                    "{share.preview_text}"
                  </span>
                )}
              </div>
            </div>

            {/* JEDI Score + Export */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {capsule.jedi_score !== null && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '12px 20px', background: BG_NAV, border: `2px solid ${AMBER}40`,
                }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: AMBER }}>
                    {fmtScore(capsule.jedi_score)}
                  </span>
                  <span style={{ fontSize: 8, color: TEXT_DIM, letterSpacing: 1.5 }}>JEDI SCORE</span>
                </div>
              )}

              {/* Export dropdown */}
              <div ref={exportRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setExportOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', background: exportOpen ? '#1A2A3A' : BG_NAV,
                    border: `1px solid ${exportOpen ? AMBER + '60' : BORDER}`,
                    color: AMBER, fontSize: 9, fontWeight: 700, fontFamily: MONO,
                    cursor: 'pointer', letterSpacing: 0.8,
                  }}
                >
                  <Download size={12} />
                  EXPORT
                  <ChevronDown size={9} />
                </button>
                {exportOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                    background: '#0F1319', border: `1px solid ${BORDER}`,
                    minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}>
                    <button
                      onClick={() => downloadExport('excel', capsule.property_address)}
                      disabled={!!exportingFmt}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                        color: TEXT, fontSize: 10, fontFamily: MONO,
                        cursor: exportingFmt ? 'not-allowed' : 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!exportingFmt) e.currentTarget.style.background = '#1A2A3A'; }}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {exportingFmt === 'excel'
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} color="#3FB950" />
                        : <FileSpreadsheet size={13} color="#3FB950" />
                      }
                      Excel Workbook (.xlsx)
                    </button>
                    <div style={{ height: 1, background: BORDER, margin: '0 14px' }} />
                    <button
                      onClick={() => downloadExport('pdf', capsule.property_address)}
                      disabled={!!exportingFmt}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                        color: TEXT, fontSize: 10, fontFamily: MONO,
                        cursor: exportingFmt ? 'not-allowed' : 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!exportingFmt) e.currentTarget.style.background = '#1A2A3A'; }}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {exportingFmt === 'pdf'
                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} color="#F85149" />
                        : <FileText size={13} color="#F85149" />
                      }
                      Pitch Deck (.pdf)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Metrics strip ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <MetricsBadge label="PURCHASE PRICE" value={fmtPrice} accent={AMBER} />
          <MetricsBadge label="NOI" value={fmtNoi} accent={GREEN} />
          <MetricsBadge label="GOING-IN CAP" value={fmtCap} />
          <MetricsBadge label="HOLD PERIOD" value={fmtHold} />
          <MetricsBadge label="EXIT CAP" value={fmtExit} />
          <MetricsBadge label="LTV" value={fmtLtv} />
          {capsule.collision_score !== null && (
            <MetricsBadge label="COLLISION SCORE" value={fmtScore(capsule.collision_score)} accent={CYAN} />
          )}
        </div>

        {/* ── Three-layer data table ─────────────────────────────────────────── */}
        <div style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
          {/* Layer tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: BG_NAV }}>
            {layerTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveLayer(tab.key)}
                style={{
                  padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  color: activeLayer === tab.key ? AMBER : TEXT_DIM,
                  borderBottom: activeLayer === tab.key ? `2px solid ${AMBER}` : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Layer content */}
          <div style={{ padding: '12px 16px' }}>
            <DataLayerTable data={activeData as Record<string, unknown>} label={layerTabs.find(t => t.key === activeLayer)?.label ?? ''} />
          </div>
        </div>

        {/* ── Module outputs (financial summary) ──────────────────────────────── */}
        {Object.keys(mo).length > 0 && (
          <div style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
            <div style={{
              padding: '10px 16px', borderBottom: `1px solid ${BORDER}`, background: BG_NAV,
              fontSize: 9, fontWeight: 700, color: TEXT_DIM, letterSpacing: 1,
            }}>
              FINANCIAL MODEL OUTPUTS
            </div>
            <div style={{ padding: '12px 16px' }}>
              <DataLayerTable data={mo} label="Outputs" />
            </div>
          </div>
        )}

        {/* ── Agent connect panel ────────────────────────────────────────────── */}
        {share.agent_enabled && accessToken && (
          <AgentConnectPanel accessToken={accessToken} />
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${BORDER}`, paddingTop: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 9, color: TEXT_DIM, letterSpacing: 0.5 }}>
            Shared{' '}
            {capsule.created_at
              ? new Date(capsule.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
            {attribution_visible && sender_branding.company_name
              ? ` · ${sender_branding.company_name}`
              : ''}
          </span>
          {attribution_visible && (
            <span style={{ fontSize: 9, color: TEXT_DIM }}>
              Powered by <span style={{ color: AMBER, fontWeight: 700 }}>JEDI RE</span>
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
