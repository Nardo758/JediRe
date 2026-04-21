/**
 * InvestorCapitalModule
 * Bloomberg Terminal-style LP/GP investor & capital tracking.
 * Tabs: Investors · Capital Calls · Distributions · Waterfall · Ledger
 * Data sourced entirely from /api/v1/capital/* via useInvestorCapital hook.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BT, BT_CSS, AlertBanner, Bd } from '../bloomberg-ui';
import { mono } from '../bloomberg-tokens';
import {
  useInvestorCapital,
  type Investment, type CapitalCall, type CallItem,
  type Distribution, type DistItem,
  type WaterfallTier, type Waterfall,
  type LedgerEntry, type CapSummary,
} from './useInvestorCapital';

// ─── style constants ──────────────────────────────────────────────────────────

const S = {
  root:        { background: BT.bg.terminal, display: 'flex', flexDirection: 'column' as const, height: '100%', minHeight: 0 },
  tabBar:      { display: 'flex', gap: 0, background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 },
  tabBtn:      (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 9, fontWeight: 700, fontFamily: mono,
    letterSpacing: '0.08em', cursor: 'pointer', border: 'none', background: 'none',
    textTransform: 'uppercase' as const,
    color: active ? BT.text.primary : BT.text.muted,
    borderBottom: active ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
  }),
  kpiRow:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 },
  kpi:         { background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 10px' },
  kpiLabel:    { fontSize: 8, color: BT.text.muted, fontFamily: mono, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 3 },
  kpiValue:    (color?: string): React.CSSProperties => ({ fontSize: 18, fontWeight: 800, fontFamily: mono, color: color ?? BT.text.primary }),
  kpiSub:      { fontSize: 8, color: BT.text.muted, fontFamily: mono, marginTop: 2 },
  content:     { flex: 1, overflow: 'auto', padding: '10px 12px' },
  table:       { width: '100%', borderCollapse: 'collapse' as const, fontSize: 10, fontFamily: mono },
  th:          { textAlign: 'left' as const, fontSize: 8, color: BT.text.muted, fontWeight: 700, letterSpacing: '0.08em', padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}`, whiteSpace: 'nowrap' as const },
  td:          { padding: '5px 8px', borderBottom: `1px solid ${BT.border.subtle}20`, color: BT.text.secondary, verticalAlign: 'middle' as const },
  badge:       (color: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 8, fontWeight: 700, fontFamily: mono,
    color, background: `${color}18`, border: `1px solid ${color}44`, padding: '1px 5px', borderRadius: 2,
  }),
  empty:       { textAlign: 'center' as const, padding: '32px 0', color: BT.text.muted, fontSize: 10, fontFamily: mono },
  err:         { textAlign: 'center' as const, padding: '32px 0', color: BT.text.red, fontSize: 10, fontFamily: mono },
  btn:         (color?: string): React.CSSProperties => ({
    background: `${color ?? BT.text.cyan}18`, border: `1px solid ${color ?? BT.text.cyan}44`,
    color: color ?? BT.text.cyan, fontSize: 9, fontFamily: mono, fontWeight: 700,
    padding: '3px 10px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
  }),
  sectionHdr:  { fontSize: 9, color: BT.text.muted, fontFamily: mono, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8, marginTop: 4 },
  formPanel:   { background: BT.bg.panel, border: `1px solid ${BT.text.cyan}33`, borderRadius: 4, padding: 12, marginBottom: 10 },
  inp:         { width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono },
  formErr:     { marginTop: 8, fontSize: 9, color: BT.text.red, fontFamily: mono },
  expandRow:   { background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` },
  subTable:    { width: '100%', borderCollapse: 'collapse' as const, fontSize: 9, fontFamily: mono },
  subTh:       { textAlign: 'left' as const, fontSize: 8, color: BT.text.muted, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.06em' },
  subTd:       { padding: '3px 8px', color: BT.text.secondary },
};

// ─── formatting helpers ───────────────────────────────────────────────────────

function n(v: number | string | null | undefined): number { return Number(v) || 0; }
function fmtAmt(v: number | string | null | undefined): string {
  const x = Number(v);
  if (!v && v !== 0) return '$—';
  if (isNaN(x)) return '$—';
  if (x >= 1_000_000) return `$${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000)     return `$${(x / 1_000).toFixed(0)}K`;
  return `$${x.toLocaleString()}`;
}
function fmtPct(v: number | string | null | undefined, scale100 = false): string {
  const x = Number(v);
  if (v == null || isNaN(x)) return '—';
  return `${(scale100 ? x : x * 100).toFixed(1)}%`;
}
function statusColor(s: string): string {
  if (['approved','fully_paid','completed','funded'].includes(s)) return BT.text.green;
  if (['sent','partially_paid','processing','committed'].includes(s)) return BT.text.amber;
  if (['defaulted','rejected'].includes(s)) return BT.text.red;
  return BT.text.muted;
}
function kycColor(s: string): string {
  if (s === 'approved') return BT.text.green;
  if (s === 'in_review') return BT.text.amber;
  if (s === 'rejected')  return BT.text.red;
  return BT.text.muted;
}
function entryColor(t: string): string {
  if (t === 'contribution') return BT.text.green;
  if (t === 'distribution') return BT.text.cyan;
  if (t === 'interest')     return BT.text.amber;
  if (t === 'fee')          return BT.text.red;
  return BT.text.muted;
}

// ─── small shared components ──────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue(color)}>{value}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}
function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={S.sectionHdr}>{children}</div>;
}
function RowHdr({ headers }: { headers: string[] }) {
  return <tr>{headers.map(h => <th key={h} style={S.th}>{h}</th>)}</tr>;
}

// ─── INVESTORS TAB ────────────────────────────────────────────────────────────

interface InvestorsTabProps {
  investments: Investment[];
  allInvestors: Array<{ id: string; name: string; type: string; kycStatus: string }>;
  summary: CapSummary | null;
  loading: boolean;
  error: string | null;
  onCreateAndLink: (data: { name: string; type: string; email?: string; commitment_amount: number; ownership_pct?: number }) => Promise<void>;
  onLinkExisting: (data: { investor_id: string; commitment_amount: number; ownership_pct?: number }) => Promise<void>;
}

function InvestorsTab({ investments, allInvestors, summary, loading, error, onCreateAndLink, onLinkExisting }: InvestorsTabProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode]       = useState<'existing' | 'new'>('existing');

  const [existForm, setExist] = useState({ investor_id: '', commitment_amount: '', ownership_pct: '' });
  const [newForm,   setNew]   = useState({ name: '', type: 'lp', email: '', commitment_amount: '', ownership_pct: '' });
  const [saving,    setSaving] = useState(false);
  const [formErr,   setFormErr] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setFormErr(null);
    try {
      if (mode === 'existing') {
        if (!existForm.investor_id || !existForm.commitment_amount) { setFormErr('Select an investor and enter commitment amount.'); setSaving(false); return; }
        await onLinkExisting({
          investor_id: existForm.investor_id,
          commitment_amount: Number(existForm.commitment_amount),
          ownership_pct: existForm.ownership_pct ? Number(existForm.ownership_pct) / 100 : undefined,
        });
        setExist({ investor_id: '', commitment_amount: '', ownership_pct: '' });
      } else {
        if (!newForm.name || !newForm.commitment_amount) { setFormErr('Name and commitment amount are required.'); setSaving(false); return; }
        await onCreateAndLink({
          name: newForm.name, type: newForm.type,
          email: newForm.email || undefined,
          commitment_amount: Number(newForm.commitment_amount),
          ownership_pct: newForm.ownership_pct ? Number(newForm.ownership_pct) / 100 : undefined,
        });
        setNew({ name: '', type: 'lp', email: '', commitment_amount: '', ownership_pct: '' });
      }
      setShowAdd(false);
    } catch { setFormErr('Failed to add investor. Please try again.'); }
    setSaving(false);
  };

  if (loading) return <div style={S.empty}>Loading investor roster…</div>;
  if (error)   return <div style={S.err}>{error}</div>;

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="Total Investors"  value={String(investments.length)} sub="Active commitments" color={BT.text.cyan} />
        <KpiCard label="Total Committed"  value={fmtAmt(summary?.total_committed ?? investments.reduce((s, x) => s + n(x.commitment_amount), 0))} sub="All classes" />
        <KpiCard label="Total Funded"     value={fmtAmt(summary?.total_funded)} sub="Called & received" color={BT.text.green} />
        <KpiCard label="Unfunded"         value={fmtAmt(n(summary?.total_committed) - n(summary?.total_funded))} sub="Remaining" color={BT.text.amber} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SecTitle>Investor Roster</SecTitle>
        <button style={S.btn()} onClick={() => setShowAdd(v => !v)}>{showAdd ? '− CANCEL' : '+ ADD INVESTOR'}</button>
      </div>

      {showAdd && (
        <div style={S.formPanel}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button style={{ ...S.btn(mode === 'existing' ? BT.text.cyan : undefined) }} onClick={() => setMode('existing')}>LINK EXISTING</button>
            <button style={{ ...S.btn(mode === 'new' ? BT.text.green : undefined) }} onClick={() => setMode('new')}>CREATE NEW INVESTOR</button>
          </div>

          {mode === 'existing' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <div style={S.kpiLabel}>Investor</div>
                <select value={existForm.investor_id} onChange={e => setExist(f => ({ ...f, investor_id: e.target.value }))} style={S.inp}>
                  <option value="">— Select —</option>
                  {allInvestors.map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.type.toUpperCase()})</option>)}
                </select>
              </div>
              <div><div style={S.kpiLabel}>Commitment ($)</div><input type="number" placeholder="5000000" value={existForm.commitment_amount} onChange={e => setExist(f => ({ ...f, commitment_amount: e.target.value }))} style={S.inp} /></div>
              <div><div style={S.kpiLabel}>Ownership %</div><input type="number" placeholder="20" min="0" max="100" value={existForm.ownership_pct} onChange={e => setExist(f => ({ ...f, ownership_pct: e.target.value }))} style={S.inp} /></div>
              <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleSave} disabled={saving}>{saving ? 'SAVING…' : 'ADD'}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div><div style={S.kpiLabel}>Name</div><input type="text" placeholder="Acme Capital LLC" value={newForm.name} onChange={e => setNew(f => ({ ...f, name: e.target.value }))} style={S.inp} /></div>
              <div>
                <div style={S.kpiLabel}>Type</div>
                <select value={newForm.type} onChange={e => setNew(f => ({ ...f, type: e.target.value }))} style={S.inp}>
                  {['lp','gp','co_invest','fund_of_funds','other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div><div style={S.kpiLabel}>Email</div><input type="email" placeholder="partner@fund.com" value={newForm.email} onChange={e => setNew(f => ({ ...f, email: e.target.value }))} style={S.inp} /></div>
              <div><div style={S.kpiLabel}>Commitment ($)</div><input type="number" placeholder="5000000" value={newForm.commitment_amount} onChange={e => setNew(f => ({ ...f, commitment_amount: e.target.value }))} style={S.inp} /></div>
              <div><div style={S.kpiLabel}>Ownership %</div><input type="number" placeholder="20" min="0" max="100" value={newForm.ownership_pct} onChange={e => setNew(f => ({ ...f, ownership_pct: e.target.value }))} style={S.inp} /></div>
              <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleSave} disabled={saving}>{saving ? 'SAVING…' : 'CREATE'}</button>
            </div>
          )}
          {formErr && <div style={S.formErr}>{formErr}</div>}
        </div>
      )}

      {investments.length === 0 ? (
        <div style={S.empty}>No investors yet. Add the first LP or GP above.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><RowHdr headers={['Investor','Type','Class','KYC','Commitment','Funded','Unfunded','Own %','Status']} /></thead>
            <tbody>
              {investments.map(inv => (
                <tr key={inv.id}>
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 600 }}>{inv.investor_name}</td>
                  <td style={S.td}><span style={S.badge(BT.text.cyan)}>{inv.investor_type.toUpperCase()}</span></td>
                  <td style={S.td}><span style={S.badge(BT.text.muted)}>{(inv.class ?? 'A').toUpperCase()}</span></td>
                  <td style={S.td}><span style={S.badge(kycColor(inv.kyc_status))}>{inv.kyc_status.replace('_',' ').toUpperCase()}</span></td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtAmt(inv.commitment_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: BT.text.green }}>{fmtAmt(inv.funded_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: BT.text.amber }}>{fmtAmt(inv.unfunded_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{inv.ownership_pct != null ? `${(n(inv.ownership_pct) * 100).toFixed(1)}%` : '—'}</td>
                  <td style={S.td}><span style={S.badge(statusColor(inv.status))}>{inv.status.replace('_',' ').toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── CAPITAL CALLS TAB ────────────────────────────────────────────────────────

interface CallsTabProps {
  calls: CapitalCall[];
  summary: CapSummary | null;
  loading: boolean;
  error: string | null;
  onLoadCallItems: (callId: string) => Promise<CallItem[]>;
  onCreateCall: (d: { call_date: string; due_date: string; total_amount: number; purpose?: string }) => Promise<void>;
  onSendCall: (id: string) => Promise<void>;
}

function CapitalCallsTab({ calls, summary, loading, error, onLoadCallItems, onCreateCall, onSendCall }: CallsTabProps) {
  const [showForm,  setShowForm]   = useState(false);
  const [form,      setForm]       = useState({ call_date: '', due_date: '', total_amount: '', purpose: '' });
  const [saving,    setSaving]     = useState(false);
  const [formErr,   setFormErr]    = useState<string | null>(null);
  const [expanded,  setExpanded]   = useState<string | null>(null);
  const [items,     setItems]      = useState<Record<string, CallItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  const toggleExpand = useCallback(async (callId: string) => {
    if (expanded === callId) { setExpanded(null); return; }
    setExpanded(callId);
    if (items[callId]) return;
    setLoadingItems(prev => ({ ...prev, [callId]: true }));
    try {
      const fetched = await onLoadCallItems(callId);
      setItems(prev => ({ ...prev, [callId]: fetched }));
    } catch { /* silent */ }
    setLoadingItems(prev => ({ ...prev, [callId]: false }));
  }, [expanded, items, onLoadCallItems]);

  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [actionErr, setActionErr] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.call_date || !form.due_date || !form.total_amount) { setFormErr('Call date, due date, and amount are required.'); return; }
    setSaving(true);
    setFormErr(null);
    try {
      await onCreateCall({ call_date: form.call_date, due_date: form.due_date, total_amount: Number(form.total_amount), purpose: form.purpose || undefined });
      setForm({ call_date: '', due_date: '', total_amount: '', purpose: '' });
      setShowForm(false);
    } catch { setFormErr('Failed to create capital call. Please try again.'); }
    setSaving(false);
  };

  const handleSend = async (callId: string) => {
    setActionErr(null);
    setPendingActions(prev => ({ ...prev, [callId]: true }));
    try { await onSendCall(callId); }
    catch { setActionErr('Failed to send call. Please try again.'); }
    setPendingActions(prev => ({ ...prev, [callId]: false }));
  };

  if (loading) return <div style={S.empty}>Loading capital calls…</div>;
  if (error)   return <div style={S.err}>{error}</div>;

  const outstanding = calls.filter(c => !['fully_paid','defaulted'].includes(c.status)).reduce((s, c) => s + n(c.total_amount) - n(c.collected_amount), 0);

  return (
    <div>
      {actionErr && <div style={S.err}>{actionErr}</div>}
      <div style={S.kpiRow}>
        <KpiCard label="Total Calls"   value={String(calls.length)} sub="All time" color={BT.text.cyan} />
        <KpiCard label="Total Called"  value={fmtAmt(summary?.total_called)} sub="Aggregate notified" />
        <KpiCard label="Collected"     value={fmtAmt(summary?.total_collected)} sub="Received" color={BT.text.green} />
        <KpiCard label="Outstanding"   value={fmtAmt(outstanding)} sub="Awaiting payment" color={outstanding > 0 ? BT.text.amber : BT.text.muted} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SecTitle>Capital Call Log</SecTitle>
        <button style={S.btn()} onClick={() => setShowForm(v => !v)}>{showForm ? '− CANCEL' : '+ NEW CALL'}</button>
      </div>

      {showForm && (
        <div style={S.formPanel}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
            {([
              { key: 'call_date', label: 'Call Date', type: 'date' },
              { key: 'due_date',  label: 'Due Date',  type: 'date' },
              { key: 'total_amount', label: 'Amount ($)', type: 'number' },
              { key: 'purpose', label: 'Purpose', type: 'text' },
            ] as const).map(({ key, label, type }) => (
              <div key={key}>
                <div style={S.kpiLabel}>{label}</div>
                <input type={type} placeholder={type === 'number' ? '1000000' : undefined} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={S.inp} />
              </div>
            ))}
            <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleCreate} disabled={saving}>{saving ? 'SAVING…' : 'CREATE'}</button>
          </div>
          {formErr && <div style={S.formErr}>{formErr}</div>}
        </div>
      )}

      {calls.length === 0 ? (
        <div style={S.empty}>No capital calls yet. Create the first call above.</div>
      ) : (
        <table style={S.table}>
          <thead><RowHdr headers={['#','Call Date','Due Date','Total','Collected','Investors','Purpose','Status','']} /></thead>
          <tbody>
            {calls.map(c => (
              <React.Fragment key={c.id}>
                <tr
                  onClick={() => toggleExpand(c.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 700 }}>#{c.call_number}</td>
                  <td style={S.td}>{c.call_date?.slice(0, 10)}</td>
                  <td style={S.td}>{c.due_date?.slice(0, 10)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtAmt(c.total_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: BT.text.green }}>{fmtAmt(c.collected_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'center' as const }}>{String(c.investor_count)}</td>
                  <td style={{ ...S.td, color: BT.text.muted }}>{c.purpose ?? '—'}</td>
                  <td style={S.td}><span style={S.badge(statusColor(c.status))}>{c.status.replace(/_/g,' ').toUpperCase()}</span></td>
                  <td style={S.td} onClick={e => e.stopPropagation()}>
                    {c.status === 'draft' && <button style={S.btn(BT.text.amber)} onClick={() => handleSend(c.id)} disabled={pendingActions[c.id]}>{pendingActions[c.id] ? 'SENDING…' : 'SEND'}</button>}
                    <span style={{ color: BT.text.muted, fontSize: 9, marginLeft: 4 }}>{expanded === c.id ? '▲' : '▼'}</span>
                  </td>
                </tr>

                {expanded === c.id && (
                  <tr style={S.expandRow}>
                    <td colSpan={9} style={{ padding: '8px 16px' }}>
                      {loadingItems[c.id] ? (
                        <div style={{ ...S.empty, padding: '8px 0' }}>Loading items…</div>
                      ) : (items[c.id] ?? []).length === 0 ? (
                        <div style={{ ...S.empty, padding: '8px 0' }}>No investor items yet — investors are allocated when the call is created with committed investors on the deal.</div>
                      ) : (
                        <table style={S.subTable}>
                          <thead>
                            <tr>
                              {['Investor','Email','Allocated','Paid','Outstanding','Days Overdue','Status'].map(h => <th key={h} style={S.subTh}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {(items[c.id] ?? []).map(item => (
                              <tr key={item.id}>
                                <td style={{ ...S.subTd, color: BT.text.primary, fontWeight: 600 }}>{item.investor_name}</td>
                                <td style={{ ...S.subTd, color: BT.text.muted }}>{item.investor_email ?? '—'}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const }}>{fmtAmt(item.allocated_amount)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const, color: BT.text.green }}>{fmtAmt(item.paid_amount)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const, color: n(item.outstanding) > 0 ? BT.text.amber : BT.text.muted }}>{fmtAmt(item.outstanding)}</td>
                                <td style={{ ...S.subTd, textAlign: 'center' as const, color: n(item.days_overdue) > 0 ? BT.text.red : BT.text.muted }}>{n(item.days_overdue) > 0 ? String(n(item.days_overdue)) : '—'}</td>
                                <td style={S.subTd}><span style={S.badge(statusColor(item.status))}>{item.status.toUpperCase()}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── DISTRIBUTIONS TAB ────────────────────────────────────────────────────────

interface DistsTabProps {
  dists: Distribution[];
  summary: CapSummary | null;
  loading: boolean;
  error: string | null;
  onLoadDistItems: (distId: string) => Promise<DistItem[]>;
  onCreate: (d: { distribution_date: string; total_amount: number; distribution_type: string; tax_year: number }) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onProcess: (id: string) => Promise<void>;
}

function DistributionsTab({ dists, summary, loading, error, onLoadDistItems, onCreate, onApprove, onProcess }: DistsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ distribution_date: '', total_amount: '', distribution_type: 'operating', tax_year: String(new Date().getFullYear()) });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [expanded,  setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, DistItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  const toggleExpand = useCallback(async (distId: string) => {
    if (expanded === distId) { setExpanded(null); return; }
    setExpanded(distId);
    if (items[distId]) return;
    setLoadingItems(prev => ({ ...prev, [distId]: true }));
    try {
      const fetched = await onLoadDistItems(distId);
      setItems(prev => ({ ...prev, [distId]: fetched }));
    } catch { /* silent */ }
    setLoadingItems(prev => ({ ...prev, [distId]: false }));
  }, [expanded, items, onLoadDistItems]);

  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [actionErr, setActionErr] = useState<string | null>(null);

  const handleAction = async (id: string, fn: (id: string) => Promise<void>, errMsg: string) => {
    setActionErr(null);
    setPendingActions(prev => ({ ...prev, [id]: true }));
    try { await fn(id); } catch { setActionErr(errMsg); }
    setPendingActions(prev => ({ ...prev, [id]: false }));
  };

  const handleCreate = async () => {
    if (!form.distribution_date || !form.total_amount) { setFormErr('Date and amount are required.'); return; }
    setSaving(true);
    setFormErr(null);
    try {
      await onCreate({ distribution_date: form.distribution_date, total_amount: Number(form.total_amount), distribution_type: form.distribution_type, tax_year: Number(form.tax_year) });
      setForm({ distribution_date: '', total_amount: '', distribution_type: 'operating', tax_year: String(new Date().getFullYear()) });
      setShowForm(false);
    } catch { setFormErr('Failed to create distribution. Please try again.'); }
    setSaving(false);
  };

  if (loading) return <div style={S.empty}>Loading distributions…</div>;
  if (error)   return <div style={S.err}>{error}</div>;

  return (
    <div>
      {actionErr && <div style={S.err}>{actionErr}</div>}
      <div style={S.kpiRow}>
        <KpiCard label="Distributions"   value={String(dists.length)} color={BT.text.cyan} />
        <KpiCard label="Total Distributed" value={fmtAmt(summary?.total_distributed)} sub="Completed" color={BT.text.green} />
        <KpiCard label="Completed"       value={String(dists.filter(d => d.status === 'completed').length)} color={BT.text.green} />
        <KpiCard label="Pending"         value={String(dists.filter(d => d.status !== 'completed').length)} color={dists.some(d => d.status !== 'completed') ? BT.text.amber : BT.text.muted} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SecTitle>Distribution Events</SecTitle>
        <button style={S.btn()} onClick={() => setShowForm(v => !v)}>{showForm ? '− CANCEL' : '+ NEW DISTRIBUTION'}</button>
      </div>

      {showForm && (
        <div style={S.formPanel}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div><div style={S.kpiLabel}>Date</div><input type="date" value={form.distribution_date} onChange={e => setForm(f => ({ ...f, distribution_date: e.target.value }))} style={S.inp} /></div>
            <div><div style={S.kpiLabel}>Amount ($)</div><input type="number" placeholder="250000" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} style={S.inp} /></div>
            <div>
              <div style={S.kpiLabel}>Type</div>
              <select value={form.distribution_type} onChange={e => setForm(f => ({ ...f, distribution_type: e.target.value }))} style={S.inp}>
                {['operating','refinance','sale','return_of_capital','special'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div><div style={S.kpiLabel}>Tax Year</div><input type="number" value={form.tax_year} onChange={e => setForm(f => ({ ...f, tax_year: e.target.value }))} style={S.inp} /></div>
            <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleCreate} disabled={saving}>{saving ? 'SAVING…' : 'CREATE'}</button>
          </div>
          {formErr && <div style={S.formErr}>{formErr}</div>}
        </div>
      )}

      {dists.length === 0 ? (
        <div style={S.empty}>No distributions recorded yet.</div>
      ) : (
        <table style={S.table}>
          <thead><RowHdr headers={['#','Date','Type','Total','Investors','Tax Year','Status','Actions']} /></thead>
          <tbody>
            {dists.map(d => (
              <React.Fragment key={d.id}>
                <tr onClick={() => toggleExpand(d.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 700 }}>#{d.distribution_number}</td>
                  <td style={S.td}>{d.distribution_date?.slice(0, 10)}</td>
                  <td style={S.td}><span style={S.badge(BT.text.cyan)}>{d.distribution_type.replace(/_/g,' ').toUpperCase()}</span></td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtAmt(d.total_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'center' as const }}>{String(d.investor_count)}</td>
                  <td style={S.td}>{d.tax_year}</td>
                  <td style={S.td}><span style={S.badge(statusColor(d.status))}>{d.status.toUpperCase()}</span></td>
                  <td style={{ ...S.td, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    {d.status === 'draft'    && <button style={S.btn(BT.text.amber)} onClick={() => handleAction(d.id, onApprove, 'Failed to approve distribution.')} disabled={pendingActions[d.id]}>{pendingActions[d.id] ? 'APPROVING…' : 'APPROVE'}</button>}
                    {d.status === 'approved' && <button style={S.btn(BT.text.green)} onClick={() => handleAction(d.id, onProcess, 'Failed to process distribution.')} disabled={pendingActions[d.id]}>{pendingActions[d.id] ? 'PROCESSING…' : 'PROCESS'}</button>}
                    <span style={{ color: BT.text.muted, fontSize: 9, marginLeft: 4 }}>{expanded === d.id ? '▲' : '▼'}</span>
                  </td>
                </tr>

                {expanded === d.id && (
                  <tr style={S.expandRow}>
                    <td colSpan={8} style={{ padding: '8px 16px' }}>
                      {loadingItems[d.id] ? (
                        <div style={{ ...S.empty, padding: '8px 0' }}>Loading breakdown…</div>
                      ) : (items[d.id] ?? []).length === 0 ? (
                        <div style={{ ...S.empty, padding: '8px 0' }}>No per-investor items yet — items are allocated on creation.</div>
                      ) : (
                        <table style={S.subTable}>
                          <thead>
                            <tr>
                              {['Investor','Gross','Ret. Capital','Pref Return','Profit','Fed W/H','State W/H','Net','K-1'].map(h => <th key={h} style={S.subTh}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {(items[d.id] ?? []).map(item => (
                              <tr key={item.id}>
                                <td style={{ ...S.subTd, color: BT.text.primary, fontWeight: 600 }}>{item.investor_name}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const }}>{fmtAmt(item.gross_amount)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const }}>{fmtAmt(item.return_of_capital)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const }}>{fmtAmt(item.preferred_return)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const }}>{fmtAmt(item.profit_share)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const, color: BT.text.red }}>{fmtAmt(item.federal_withholding)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const, color: BT.text.red }}>{fmtAmt(item.state_withholding)}</td>
                                <td style={{ ...S.subTd, textAlign: 'right' as const, color: BT.text.green }}>{fmtAmt(item.net_amount)}</td>
                                <td style={S.subTd}><span style={S.badge(item.k1_included ? BT.text.green : BT.text.muted)}>{item.k1_included ? 'YES' : 'NO'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── WATERFALL TAB ────────────────────────────────────────────────────────────

interface WaterfallTabProps {
  waterfall: Waterfall | null;
  defaultTiers: WaterfallTier[];
  loading: boolean;
  error: string | null;
  onUpdate: (d: { pref_rate: number; catchup_pct: number; clawback: boolean; lp_gp_split_base: number; tiers: WaterfallTier[] }) => Promise<void>;
}

function WaterfallTab({ waterfall, defaultTiers, loading, error, onUpdate }: WaterfallTabProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ pref_rate: '8', catchup_pct: '100', clawback: false, lp_gp_split_base: '80' });
  const [editTiers, setEditTiers] = useState<WaterfallTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const startEdit = () => {
    const w = waterfall;
    setForm({
      pref_rate:        String(Math.round(Number(w?.pref_rate ?? 0.08) * 100)),
      catchup_pct:      String(Math.round(Number(w?.catchup_pct ?? 1.0) * 100)),
      clawback:         w?.clawback ?? false,
      lp_gp_split_base: String(Number(w?.lp_gp_split_base ?? 80)),
    });
    setEditTiers((w?.tiers ?? defaultTiers).map(t => ({ ...t })));
    setEditing(true);
    setSaveErr(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      await onUpdate({
        pref_rate:        Number(form.pref_rate) / 100,
        catchup_pct:      Number(form.catchup_pct) / 100,
        clawback:         form.clawback,
        lp_gp_split_base: Number(form.lp_gp_split_base),
        tiers:            editTiers.map((t, i) => ({ ...t, tier_order: i + 1 })),
      });
      setEditing(false);
    } catch { setSaveErr('Failed to save waterfall config. Please try again.'); }
    setSaving(false);
  };

  const updateTier = (i: number, field: keyof WaterfallTier, val: string) => {
    setEditTiers(prev => prev.map((t, j) => j === i ? { ...t, [field]: field.includes('hurdle') ? (val === '' ? null : Number(val) / 100) : Number(val) } : t));
  };
  const addTier = () => setEditTiers(prev => [...prev, { tier_order: prev.length + 1, irr_hurdle_low: null, irr_hurdle_high: null, lp_pct: 70, gp_pct: 30 }]);
  const removeTier = (i: number) => setEditTiers(prev => prev.filter((_, j) => j !== i));

  if (loading) return <div style={S.empty}>Loading waterfall config…</div>;
  if (error)   return <div style={S.err}>{error}</div>;

  const tiers = waterfall?.tiers ?? defaultTiers;

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="Pref Rate"   value={waterfall ? fmtPct(waterfall.pref_rate) : '8.0%'}      sub="LP accrual rate" color={BT.text.cyan} />
        <KpiCard label="Catch-Up"    value={waterfall ? fmtPct(waterfall.catchup_pct) : '100.0%'}   sub="GP catch-up pct" />
        <KpiCard label="Base Split"  value={waterfall ? `${waterfall.lp_gp_split_base}% LP` : '80% LP'} sub="Below first hurdle" />
        <KpiCard label="Clawback"    value={waterfall?.clawback ? 'YES' : 'NO'}                    sub="GP provision" color={waterfall?.clawback ? BT.text.amber : BT.text.muted} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SecTitle>Waterfall Structure</SecTitle>
        {!editing
          ? <button style={S.btn()} onClick={startEdit}>✎ EDIT CONFIG</button>
          : <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.btn(BT.text.muted)} onClick={() => setEditing(false)}>CANCEL</button>
              <button style={S.btn(BT.text.green)} onClick={handleSave} disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</button>
            </div>
        }
      </div>

      {editing ? (
        <div style={S.formPanel}>
          {/* Base config */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
            {([
              { key: 'pref_rate', label: 'Pref Rate (%)' },
              { key: 'catchup_pct', label: 'Catch-Up (%)' },
              { key: 'lp_gp_split_base', label: 'Base LP %' },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <div style={S.kpiLabel}>{label}</div>
                <input type="number" value={form[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={S.inp} />
              </div>
            ))}
            <div>
              <div style={S.kpiLabel}>Clawback</div>
              <select value={form.clawback ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, clawback: e.target.value === 'yes' }))} style={S.inp}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>

          {/* Tier editor */}
          <div style={{ ...S.kpiLabel, marginBottom: 6 }}>WATERFALL TIERS</div>
          {editTiers.map((t, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'end' }}>
              <div>
                <div style={S.kpiLabel}>IRR Hurdle Low (%)</div>
                <input type="number" placeholder="0" value={t.irr_hurdle_low != null ? String(Math.round(Number(t.irr_hurdle_low) * 100)) : ''} onChange={e => updateTier(i, 'irr_hurdle_low', e.target.value)} style={S.inp} />
              </div>
              <div>
                <div style={S.kpiLabel}>IRR Hurdle High (%)</div>
                <input type="number" placeholder="∞" value={t.irr_hurdle_high != null ? String(Math.round(Number(t.irr_hurdle_high) * 100)) : ''} onChange={e => updateTier(i, 'irr_hurdle_high', e.target.value)} style={S.inp} />
              </div>
              <div>
                <div style={S.kpiLabel}>LP %</div>
                <input type="number" min="0" max="100" value={String(t.lp_pct)} onChange={e => updateTier(i, 'lp_pct', e.target.value)} style={S.inp} />
              </div>
              <div>
                <div style={S.kpiLabel}>GP %</div>
                <input type="number" min="0" max="100" value={String(t.gp_pct)} onChange={e => updateTier(i, 'gp_pct', e.target.value)} style={S.inp} />
              </div>
              <button style={S.btn(BT.text.red)} onClick={() => removeTier(i)}>✕</button>
            </div>
          ))}
          <button style={{ ...S.btn(), marginTop: 4 }} onClick={addTier}>+ ADD TIER</button>
          {saveErr && <div style={S.formErr}>{saveErr}</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'RETURN OF CAPITAL', sub: 'LP/GP pro-rata until full return', badge: '100% PRO-RATA', color: BT.text.cyan },
            { label: 'PREFERRED RETURN', sub: 'LP accrual at preferred rate', badge: waterfall ? `${fmtPct(waterfall.pref_rate)} LP PREF` : '8.0% LP PREF', color: BT.text.green },
            { label: 'GP CATCH-UP', sub: 'GP catches up to promote split', badge: waterfall ? `${fmtPct(waterfall.catchup_pct)} GP` : '100.0% GP', color: BT.text.amber },
          ].map((step, i) => (
            <div key={i} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${step.color}22`, border: `1px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: step.color, fontFamily: mono, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono }}>{step.label}</div>
                <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>{step.sub}</div>
              </div>
              <Bd c={step.color}>{step.badge}</Bd>
            </div>
          ))}
          {tiers.map((t, i) => (
            <div key={i} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${BT.met.financial}22`, border: `1px solid ${BT.met.financial}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: BT.met.financial, fontFamily: mono, flexShrink: 0 }}>{4 + i}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono }}>
                  TIER {t.tier_order} — {t.irr_hurdle_low != null ? `${Math.round(Number(t.irr_hurdle_low) * 100)}%` : '0%'} – {t.irr_hurdle_high != null ? `${Math.round(Number(t.irr_hurdle_high) * 100)}%` : '∞'} IRR
                </div>
                <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>Profit split above this hurdle</div>
              </div>
              <Bd c={BT.met.financial}>{String(t.lp_pct)}% LP / {String(t.gp_pct)}% GP</Bd>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LEDGER TAB ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

interface LedgerTabProps {
  entries: LedgerEntry[];
  totalEntries: number;
  loading: boolean;
  error: string | null;
  onFilter: (params: { date_from?: string; date_to?: string; limit?: number; offset?: number }) => void;
}

function LedgerTab({ entries, totalEntries, loading, error, onFilter }: LedgerTabProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page, setPage] = useState(0);

  // On mount, reset data to match default filter controls so tab switches don't
  // leave stale filtered results visible alongside blank filter inputs.
  const onFilterRef = useRef(onFilter);
  onFilterRef.current = onFilter;
  useEffect(() => { onFilterRef.current({ limit: PAGE_SIZE, offset: 0 }); }, []);

  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));

  // Fetch the right server page via limit/offset
  const fetchPage = (p: number, from?: string, to?: string) => {
    setPage(p);
    onFilter({ date_from: from || undefined, date_to: to || undefined, limit: PAGE_SIZE, offset: p * PAGE_SIZE });
  };

  const applyFilter = () => fetchPage(0, dateFrom, dateTo);
  const clearFilter = () => { setDateFrom(''); setDateTo(''); fetchPage(0); };

  // Server always provides running_balance via SQL window function.
  // Entries arrive newest-first (ORDER BY entry_date DESC from backend).
  const withBalance = entries.map(e => ({
    ...e,
    runningBalance: Number(e.running_balance ?? 0),
  }));

  if (loading) return <div style={S.empty}>Loading ledger…</div>;
  if (error)   return <div style={S.err}>{error}</div>;

  return (
    <div>
      {/* Date-range filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' as const, marginBottom: 10, background: BT.bg.panel, padding: 10, borderRadius: 4, border: `1px solid ${BT.border.subtle}` }}>
        <div>
          <div style={S.kpiLabel}>From</div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.inp, width: 130 }} />
        </div>
        <div>
          <div style={S.kpiLabel}>To</div>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.inp, width: 130 }} />
        </div>
        <button style={S.btn(BT.text.cyan)} onClick={applyFilter}>APPLY</button>
        {(dateFrom || dateTo) && <button style={S.btn(BT.text.muted)} onClick={clearFilter}>CLEAR</button>}
        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: mono, marginLeft: 'auto' }}>
          {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
          {totalEntries > PAGE_SIZE ? ` · Page ${page + 1} of ${totalPages}` : ''}
        </span>
      </div>

      {withBalance.length === 0 ? (
        <div style={S.empty}>No ledger entries. Entries are created automatically when capital calls are paid and distributions are processed.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><RowHdr headers={['Date','Investor','Type','Amount','Running Balance','Reference','Description']} /></thead>
              <tbody>
                {withBalance.map(e => (
                  <tr key={e.id}>
                    <td style={S.td}>{e.entry_date?.slice(0, 10)}</td>
                    <td style={{ ...S.td, color: BT.text.primary, fontWeight: 600 }}>{e.investor_name}</td>
                    <td style={S.td}><span style={S.badge(entryColor(e.entry_type))}>{e.entry_type.toUpperCase()}</span></td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: ['contribution','interest','appreciation'].includes(e.entry_type) ? BT.text.green : BT.text.red }}>
                      {['contribution','interest','appreciation'].includes(e.entry_type) ? '+' : '−'}{fmtAmt(Math.abs(n(e.amount)))}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' as const, color: e.runningBalance >= 0 ? BT.text.green : BT.text.amber }}>
                      {fmtAmt(e.runningBalance)}
                    </td>
                    <td style={{ ...S.td, color: BT.text.muted }}>{e.reference_type ?? '—'}</td>
                    <td style={{ ...S.td, color: BT.text.muted }}>{e.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls — server-side: each click fetches the correct page */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: '10px 0', fontSize: 9, fontFamily: mono, color: BT.text.muted }}>
              <button style={S.btn(page === 0 ? BT.text.muted : BT.text.cyan)} onClick={() => fetchPage(0, dateFrom, dateTo)} disabled={page === 0}>«</button>
              <button style={S.btn(page === 0 ? BT.text.muted : BT.text.cyan)} onClick={() => fetchPage(page - 1, dateFrom, dateTo)} disabled={page === 0}>‹ PREV</button>
              <span>Page {page + 1} of {totalPages} · rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalEntries)} of {totalEntries}</span>
              <button style={S.btn(page >= totalPages - 1 ? BT.text.muted : BT.text.cyan)} onClick={() => fetchPage(page + 1, dateFrom, dateTo)} disabled={page >= totalPages - 1}>NEXT ›</button>
              <button style={S.btn(page >= totalPages - 1 ? BT.text.muted : BT.text.cyan)} onClick={() => fetchPage(totalPages - 1, dateFrom, dateTo)} disabled={page >= totalPages - 1}>»</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════════════

export interface InvestorCapitalModuleProps {
  dealId: string;
  deal?: Record<string, unknown>;
}

type TabId = 'investors' | 'calls' | 'distributions' | 'waterfall' | 'ledger';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'investors',     label: 'Investor Roster' },
  { id: 'calls',         label: 'Capital Calls' },
  { id: 'distributions', label: 'Distributions' },
  { id: 'waterfall',     label: 'Waterfall' },
  { id: 'ledger',        label: 'Ledger' },
];

export function InvestorCapitalModule({ dealId }: InvestorCapitalModuleProps) {
  const [activeTab, setActiveTab] = useState<TabId>('investors');

  const {
    summary, summaryErr, investments, allInvestors, calls, dists,
    waterfall, defaultTiers, entries, totalEntries,
    loading, errors,
    reload, loaders,
    mutations,
  } = useInvestorCapital(dealId);

  const pendingCalls   = Number(summary?.pending_calls ?? 0);
  const totalCommitted = Number(summary?.total_committed ?? 0);
  const totalCalled    = Number(summary?.total_called ?? 0);
  const pctCalled      = totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : null;

  return (
    <div style={S.root}>
      <style>{BT_CSS}</style>

      {pendingCalls > 0 && (
        <AlertBanner
          label="PENDING CALLS"
          text={`${pendingCalls} capital call${pendingCalls > 1 ? 's' : ''} awaiting payment.`}
          color={BT.text.amber}
          badge={<Bd c={BT.text.amber}>{pendingCalls} OUTSTANDING</Bd>}
        />
      )}

      {summaryErr && (
        <div style={{ background: `${BT.text.amber}18`, borderBottom: `1px solid ${BT.text.amber}44`, padding: '4px 12px', fontSize: 9, fontFamily: mono, color: BT.text.amber }}>
          ⚠ {summaryErr} — KPI figures may be stale.
        </div>
      )}

      {/* Global KPI summary row */}
      <div style={{ ...S.kpiRow, padding: '8px 12px', margin: 0, borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel }}>
        <KpiCard
          label="Total Committed"
          value={fmtAmt(totalCommitted)}
          sub={`${Number(summary?.investor_count ?? 0)} investor${Number(summary?.investor_count ?? 0) !== 1 ? 's' : ''}`}
          color={BT.text.primary}
        />
        <KpiCard
          label="% Called"
          value={pctCalled != null ? `${pctCalled.toFixed(1)}%` : '—'}
          sub={`${fmtAmt(totalCalled)} called`}
          color={pctCalled != null && pctCalled >= 75 ? BT.text.amber : BT.text.cyan}
        />
        <KpiCard label="Total Distributed" value={fmtAmt(summary?.total_distributed)} sub="Completed payments" color={BT.text.green} />
        <KpiCard
          label="Investors"
          value={String(Number(summary?.investor_count ?? 0))}
          sub={pendingCalls > 0 ? `${pendingCalls} call${pendingCalls > 1 ? 's' : ''} pending` : 'Active'}
          color={pendingCalls > 0 ? BT.text.amber : BT.text.muted}
        />
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tabBtn(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        {activeTab === 'investors' && (
          <InvestorsTab
            investments={investments}
            allInvestors={allInvestors}
            summary={summary}
            loading={loading.investments}
            error={errors.investments ?? null}
            onCreateAndLink={mutations.createAndLink}
            onLinkExisting={mutations.linkInvestment}
          />
        )}
        {activeTab === 'calls' && (
          <CapitalCallsTab
            calls={calls}
            summary={summary}
            loading={loading.calls}
            error={errors.calls ?? null}
            onLoadCallItems={loaders.loadCallItems}
            onCreateCall={mutations.createCall}
            onSendCall={mutations.sendCall}
          />
        )}
        {activeTab === 'distributions' && (
          <DistributionsTab
            dists={dists}
            summary={summary}
            loading={loading.dists}
            error={errors.dists ?? null}
            onLoadDistItems={loaders.loadDistItems}
            onCreate={mutations.createDistribution}
            onApprove={mutations.approveDistribution}
            onProcess={mutations.processDistribution}
          />
        )}
        {activeTab === 'waterfall' && (
          <WaterfallTab
            waterfall={waterfall}
            defaultTiers={defaultTiers}
            loading={loading.waterfall}
            error={errors.waterfall ?? null}
            onUpdate={mutations.updateWaterfall}
          />
        )}
        {activeTab === 'ledger' && (
          <LedgerTab
            entries={entries}
            totalEntries={totalEntries}
            loading={loading.entries}
            error={errors.entries ?? null}
            onFilter={reload.entries}
          />
        )}
      </div>
    </div>
  );
}
