/**
 * InvestorCapitalModule
 * Bloomberg Terminal-style LP/GP investor & capital tracking for a single deal.
 * Tabs: Investors · Capital Calls · Distributions · Waterfall · Ledger
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.client';
import { BT, BT_CSS, AlertBanner, Bd } from '../bloomberg-ui';
import { mono } from '../bloomberg-tokens';

// ─── types ────────────────────────────────────────────────────────────────────

interface Investment {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_type: string;
  investor_email: string;
  kyc_status: string;
  commitment_amount: number;
  funded_amount: number;
  unfunded_amount: number;
  ownership_pct: number | null;
  status: string;
  class: string;
}

interface CapitalCall {
  id: string;
  call_number: number;
  call_date: string;
  due_date: string;
  total_amount: number;
  collected_amount: number;
  investor_count: number;
  status: string;
  purpose: string | null;
  allocation_method: string;
}

interface Distribution {
  id: string;
  distribution_number: number;
  distribution_date: string;
  total_amount: number;
  allocated_amount: number;
  investor_count: number;
  distribution_type: string;
  status: string;
  tax_year: number;
}

interface WaterfallTier {
  tier_order: number;
  irr_hurdle_low: number | null;
  irr_hurdle_high: number | null;
  lp_pct: number;
  gp_pct: number;
}

interface Waterfall {
  id: string;
  pref_rate: number;
  catchup_pct: number;
  clawback: boolean;
  lp_gp_split_base: number;
  tiers: WaterfallTier[];
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  investor_name: string;
  entry_date: string;
  description: string | null;
  reference_type: string | null;
}

interface CapSummary {
  investor_count: string;
  total_committed: string;
  total_funded: string;
  pending_calls: string;
  total_called: string;
  total_collected: string;
  total_distributions: string;
  total_distributed: string;
}

// ─── style helpers ─────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: mono };

const S = {
  root: { background: BT.bg.terminal, display: 'flex', flexDirection: 'column' as const, height: '100%', minHeight: 0 },
  tabBar: { display: 'flex', gap: 0, background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0 },
  tabBtn: (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 9, fontWeight: 700,
    fontFamily: mono, letterSpacing: '0.08em', cursor: 'pointer',
    border: 'none', background: 'none', textTransform: 'uppercase' as const,
    color: active ? BT.text.primary : BT.text.muted,
    borderBottom: active ? `2px solid ${BT.text.cyan}` : '2px solid transparent',
  }),
  content: { flex: 1, overflow: 'auto', padding: '10px 12px' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 },
  kpi: { background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 10px' },
  kpiLabel: { fontSize: 8, color: BT.text.muted, fontFamily: mono, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 3 },
  kpiValue: (color?: string): React.CSSProperties => ({ fontSize: 18, fontWeight: 800, fontFamily: mono, color: color ?? BT.text.primary }),
  kpiSub: { fontSize: 8, color: BT.text.muted, fontFamily: mono, marginTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 10, fontFamily: mono },
  th: { textAlign: 'left' as const, fontSize: 8, color: BT.text.muted, fontWeight: 700, letterSpacing: '0.08em', padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}`, whiteSpace: 'nowrap' as const },
  td: { padding: '5px 8px', borderBottom: `1px solid ${BT.border.subtle}20`, color: BT.text.secondary, verticalAlign: 'middle' as const },
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 8, fontWeight: 700, fontFamily: mono,
    color, background: `${color}18`, border: `1px solid ${color}44`,
    padding: '1px 5px', borderRadius: 2,
  }),
  sectionHeader: { fontSize: 9, color: BT.text.muted, fontFamily: mono, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 8, marginTop: 4 },
  emptyState: { textAlign: 'center' as const, padding: '32px 0', color: BT.text.muted, fontSize: 10, fontFamily: mono },
  btn: (color?: string): React.CSSProperties => ({
    background: `${color ?? BT.text.cyan}18`, border: `1px solid ${color ?? BT.text.cyan}44`,
    color: color ?? BT.text.cyan, fontSize: 9, fontFamily: mono, fontWeight: 700,
    padding: '3px 10px', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
  }),
};

function fmtAmt(v: number | string | null | undefined): string {
  const n = Number(v);
  if (!v || isNaN(n)) return '$—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(v: number | string | null | undefined, decimals = 1): string {
  const n = Number(v);
  if (v == null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
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

// ─── sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue(color)}>{value}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={S.sectionHeader}>{children}</div>;
}

// ─── INVESTORS TAB ────────────────────────────────────────────────────────────

function InvestorsTab({ dealId, summary, onRefresh }: { dealId: string; summary: CapSummary | null; onRefresh: () => void }) {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [allInvestors, setAllInvestors] = useState<Array<{ id: string; name: string; type: string; kyc_status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ investor_id: '', commitment_amount: '', ownership_pct: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, allRes] = await Promise.all([
        apiClient.get(`/api/v1/capital/deals/${dealId}/investments`),
        apiClient.get('/api/v1/capital/investors'),
      ]);
      setInvestments(invRes.data?.investments ?? []);
      setAllInvestors(allRes.data?.investors ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.investor_id || !form.commitment_amount) return;
    setSaving(true);
    try {
      await apiClient.post(`/api/v1/capital/deals/${dealId}/investments`, {
        investor_id: form.investor_id,
        commitment_amount: Number(form.commitment_amount),
        ownership_pct: form.ownership_pct ? Number(form.ownership_pct) / 100 : undefined,
      });
      setForm({ investor_id: '', commitment_amount: '', ownership_pct: '' });
      setShowAdd(false);
      load();
      onRefresh();
    } catch { /* silent */ }
    setSaving(false);
  };

  if (loading) return <div style={S.emptyState}>Loading investor roster…</div>;

  const totalCommitted = investments.reduce((s, x) => s + Number(x.commitment_amount), 0);

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="Total Investors" value={String(investments.length)} sub="Active commitments" color={BT.text.cyan} />
        <KpiCard label="Total Committed" value={fmtAmt(summary?.total_committed ?? totalCommitted)} sub="All classes" color={BT.text.primary} />
        <KpiCard label="Total Funded" value={fmtAmt(summary?.total_funded)} sub="Capital called & received" color={BT.text.green} />
        <KpiCard label="Unfunded" value={fmtAmt(Number(summary?.total_committed ?? 0) - Number(summary?.total_funded ?? 0))} sub="Remaining to call" color={BT.text.amber} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle>Investor Roster</SectionTitle>
        <button style={S.btn()} onClick={() => setShowAdd(v => !v)}>
          {showAdd ? '− CANCEL' : '+ ADD INVESTOR'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.text.cyan}33`, borderRadius: 4, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={S.kpiLabel}>Investor</div>
              <select
                value={form.investor_id}
                onChange={e => setForm(f => ({ ...f, investor_id: e.target.value }))}
                style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }}
              >
                <option value="">— Select investor —</option>
                {allInvestors.map(inv => <option key={inv.id} value={inv.id}>{inv.name} ({inv.type.toUpperCase()})</option>)}
              </select>
            </div>
            <div>
              <div style={S.kpiLabel}>Commitment ($)</div>
              <input
                type="number" placeholder="5000000"
                value={form.commitment_amount}
                onChange={e => setForm(f => ({ ...f, commitment_amount: e.target.value }))}
                style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }}
              />
            </div>
            <div>
              <div style={S.kpiLabel}>Ownership %</div>
              <input
                type="number" placeholder="20" min="0" max="100"
                value={form.ownership_pct}
                onChange={e => setForm(f => ({ ...f, ownership_pct: e.target.value }))}
                style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }}
              />
            </div>
            <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleAdd} disabled={saving}>
              {saving ? 'SAVING…' : 'ADD'}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 8, color: BT.text.muted, fontFamily: mono }}>
            No investors yet? Create one first via the org-level investor registry.
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <div style={S.emptyState}>No investors on this deal yet. Add the first LP or GP above.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Investor', 'Type', 'KYC', 'Commitment', 'Funded', 'Unfunded', 'Own %', 'Status'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investments.map(inv => (
                <tr key={inv.id}>
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 600 }}>{inv.investor_name}</td>
                  <td style={S.td}><span style={S.badge(BT.text.cyan)}>{inv.investor_type.toUpperCase()}</span></td>
                  <td style={S.td}><span style={S.badge(kycColor(inv.kyc_status))}>{inv.kyc_status.replace('_',' ').toUpperCase()}</span></td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtAmt(inv.commitment_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: BT.text.green }}>{fmtAmt(inv.funded_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: BT.text.amber }}>{fmtAmt(inv.unfunded_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{inv.ownership_pct != null ? `${(Number(inv.ownership_pct) * 100).toFixed(1)}%` : '—'}</td>
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

function CapitalCallsTab({ dealId, summary, onRefresh }: { dealId: string; summary: CapSummary | null; onRefresh: () => void }) {
  const [calls, setCalls] = useState<CapitalCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ call_date: '', due_date: '', total_amount: '', purpose: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/capital-calls`);
      setCalls(r.data?.capitalCalls ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.call_date || !form.due_date || !form.total_amount) return;
    setSaving(true);
    try {
      await apiClient.post(`/api/v1/capital/deals/${dealId}/capital-calls`, {
        call_date: form.call_date, due_date: form.due_date,
        total_amount: Number(form.total_amount), purpose: form.purpose || undefined,
      });
      setForm({ call_date: '', due_date: '', total_amount: '', purpose: '' });
      setShowForm(false);
      load(); onRefresh();
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleSend = async (callId: string) => {
    try {
      await apiClient.post(`/api/v1/capital/deals/${dealId}/capital-calls/${callId}/send`);
      load();
    } catch { /* silent */ }
  };

  if (loading) return <div style={S.emptyState}>Loading capital calls…</div>;

  const pendingAmt = calls.filter(c => !['fully_paid','defaulted'].includes(c.status)).reduce((s, c) => s + (Number(c.total_amount) - Number(c.collected_amount)), 0);

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="Total Calls" value={String(calls.length)} sub="All time" color={BT.text.cyan} />
        <KpiCard label="Total Called" value={fmtAmt(summary?.total_called)} sub="Aggregate notified" />
        <KpiCard label="Collected" value={fmtAmt(summary?.total_collected)} sub="Payments received" color={BT.text.green} />
        <KpiCard label="Outstanding" value={fmtAmt(pendingAmt)} sub="Awaiting payment" color={pendingAmt > 0 ? BT.text.amber : BT.text.muted} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle>Capital Call Log</SectionTitle>
        <button style={S.btn()} onClick={() => setShowForm(v => !v)}>
          {showForm ? '− CANCEL' : '+ NEW CALL'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.text.cyan}33`, borderRadius: 4, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: 8, alignItems: 'end' }}>
            {([
              { key: 'call_date', label: 'Call Date', type: 'date' },
              { key: 'due_date',  label: 'Due Date',  type: 'date' },
              { key: 'total_amount', label: 'Amount ($)', type: 'number' },
              { key: 'purpose', label: 'Purpose', type: 'text' },
            ] as const).map(({ key, label, type }) => (
              <div key={key}>
                <div style={S.kpiLabel}>{label}</div>
                <input
                  type={type} placeholder={type === 'number' ? '1000000' : undefined}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }}
                />
              </div>
            ))}
            <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleCreate} disabled={saving}>
              {saving ? 'SAVING…' : 'CREATE'}
            </button>
          </div>
        </div>
      )}

      {calls.length === 0 ? (
        <div style={S.emptyState}>No capital calls yet. Create the first call above.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['#', 'Call Date', 'Due Date', 'Total Amount', 'Collected', 'Investors', 'Purpose', 'Status', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id}>
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 700 }}>#{c.call_number}</td>
                  <td style={S.td}>{c.call_date?.slice(0, 10)}</td>
                  <td style={S.td}>{c.due_date?.slice(0, 10)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtAmt(c.total_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: BT.text.green }}>{fmtAmt(c.collected_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'center' as const }}>{c.investor_count}</td>
                  <td style={{ ...S.td, color: BT.text.muted }}>{c.purpose ?? '—'}</td>
                  <td style={S.td}><span style={S.badge(statusColor(c.status))}>{c.status.replace(/_/g,' ').toUpperCase()}</span></td>
                  <td style={S.td}>
                    {c.status === 'draft' && (
                      <button style={S.btn(BT.text.amber)} onClick={() => handleSend(c.id)}>SEND</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DISTRIBUTIONS TAB ────────────────────────────────────────────────────────

function DistributionsTab({ dealId, summary, onRefresh }: { dealId: string; summary: CapSummary | null; onRefresh: () => void }) {
  const [dists, setDists] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ distribution_date: '', total_amount: '', distribution_type: 'operating', tax_year: String(new Date().getFullYear()) });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/distributions`);
      setDists(r.data?.distributions ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.distribution_date || !form.total_amount) return;
    setSaving(true);
    try {
      await apiClient.post(`/api/v1/capital/deals/${dealId}/distributions`, {
        distribution_date: form.distribution_date,
        total_amount: Number(form.total_amount),
        distribution_type: form.distribution_type,
        tax_year: Number(form.tax_year),
        allocation_method: 'pro_rata',
      });
      setShowForm(false);
      load(); onRefresh();
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleApprove = async (distId: string) => {
    try {
      await apiClient.post(`/api/v1/capital/deals/${dealId}/distributions/${distId}/approve`);
      load();
    } catch { /* silent */ }
  };

  const handleProcess = async (distId: string) => {
    try {
      await apiClient.post(`/api/v1/capital/deals/${dealId}/distributions/${distId}/process`);
      load(); onRefresh();
    } catch { /* silent */ }
  };

  if (loading) return <div style={S.emptyState}>Loading distributions…</div>;

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="Total Distributions" value={String(dists.length)} sub="All events" color={BT.text.cyan} />
        <KpiCard label="Total Distributed" value={fmtAmt(summary?.total_distributed)} sub="Completed payments" color={BT.text.green} />
        <KpiCard label="Completed" value={String(dists.filter(d => d.status === 'completed').length)} sub="Events processed" color={BT.text.green} />
        <KpiCard label="Pending" value={String(dists.filter(d => d.status !== 'completed').length)} sub="Draft / approved" color={dists.some(d => d.status !== 'completed') ? BT.text.amber : BT.text.muted} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle>Distribution Events</SectionTitle>
        <button style={S.btn()} onClick={() => setShowForm(v => !v)}>
          {showForm ? '− CANCEL' : '+ NEW DISTRIBUTION'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.text.cyan}33`, borderRadius: 4, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div style={S.kpiLabel}>Date</div>
              <input type="date" value={form.distribution_date} onChange={e => setForm(f => ({ ...f, distribution_date: e.target.value }))} style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }} />
            </div>
            <div>
              <div style={S.kpiLabel}>Amount ($)</div>
              <input type="number" placeholder="250000" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }} />
            </div>
            <div>
              <div style={S.kpiLabel}>Type</div>
              <select value={form.distribution_type} onChange={e => setForm(f => ({ ...f, distribution_type: e.target.value }))} style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }}>
                {['operating','refinance','sale','return_of_capital','special'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <div style={S.kpiLabel}>Tax Year</div>
              <input type="number" value={form.tax_year} onChange={e => setForm(f => ({ ...f, tax_year: e.target.value }))} style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }} />
            </div>
            <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleCreate} disabled={saving}>
              {saving ? 'SAVING…' : 'CREATE'}
            </button>
          </div>
        </div>
      )}

      {dists.length === 0 ? (
        <div style={S.emptyState}>No distributions recorded yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['#', 'Date', 'Type', 'Total Amount', 'Investors', 'Tax Year', 'Status', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dists.map(d => (
                <tr key={d.id}>
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 700 }}>#{d.distribution_number}</td>
                  <td style={S.td}>{d.distribution_date?.slice(0, 10)}</td>
                  <td style={S.td}><span style={S.badge(BT.text.cyan)}>{d.distribution_type.replace(/_/g,' ').toUpperCase()}</span></td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>{fmtAmt(d.total_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'center' as const }}>{d.investor_count}</td>
                  <td style={S.td}>{d.tax_year}</td>
                  <td style={S.td}><span style={S.badge(statusColor(d.status))}>{d.status.toUpperCase()}</span></td>
                  <td style={{ ...S.td, display: 'flex', gap: 4 }}>
                    {d.status === 'draft'    && <button style={S.btn(BT.text.amber)} onClick={() => handleApprove(d.id)}>APPROVE</button>}
                    {d.status === 'approved' && <button style={S.btn(BT.text.green)} onClick={() => handleProcess(d.id)}>PROCESS</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── WATERFALL TAB ────────────────────────────────────────────────────────────

function WaterfallTab({ dealId }: { dealId: string }) {
  const [wf, setWf] = useState<Waterfall | null>(null);
  const [defaultTiers, setDefaultTiers] = useState<WaterfallTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ pref_rate: '8', catchup_pct: '100', clawback: false, lp_gp_split_base: '80' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/waterfall`);
      setWf(r.data?.waterfall ?? null);
      setDefaultTiers(r.data?.defaultTiers ?? []);
      if (r.data?.waterfall) {
        const w = r.data.waterfall as Waterfall;
        setForm({
          pref_rate: String(Number(w.pref_rate) * 100),
          catchup_pct: String(Number(w.catchup_pct) * 100),
          clawback: w.clawback,
          lp_gp_split_base: String(w.lp_gp_split_base),
        });
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tiers = (wf?.tiers ?? defaultTiers).map((t, i) => ({
        tier_order: i + 1,
        irr_hurdle_low: t.irr_hurdle_low,
        irr_hurdle_high: t.irr_hurdle_high,
        lp_pct: t.lp_pct,
        gp_pct: t.gp_pct,
      }));
      await apiClient.put(`/api/v1/capital/deals/${dealId}/waterfall`, {
        pref_rate: Number(form.pref_rate) / 100,
        catchup_pct: Number(form.catchup_pct) / 100,
        clawback: form.clawback,
        lp_gp_split_base: Number(form.lp_gp_split_base),
        tiers,
      });
      setEditing(false);
      load();
    } catch { /* silent */ }
    setSaving(false);
  };

  if (loading) return <div style={S.emptyState}>Loading waterfall config…</div>;

  const tiers = wf?.tiers ?? defaultTiers;

  return (
    <div>
      <div style={S.kpiRow}>
        <KpiCard label="Pref Rate" value={wf ? `${(Number(wf.pref_rate) * 100).toFixed(1)}%` : '8.0%'} sub="LP accrual rate" color={BT.text.cyan} />
        <KpiCard label="Catch-Up" value={wf ? `${(Number(wf.catchup_pct) * 100).toFixed(0)}%` : '100%'} sub="GP catch-up pct" />
        <KpiCard label="Base Split" value={wf ? `${wf.lp_gp_split_base}% LP` : '80% LP'} sub="Below first hurdle" />
        <KpiCard label="Clawback" value={wf?.clawback ? 'YES' : 'NO'} sub="GP clawback provision" color={wf?.clawback ? BT.text.amber : BT.text.muted} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle>Waterfall Structure</SectionTitle>
        <button style={S.btn()} onClick={() => setEditing(v => !v)}>
          {editing ? '− CANCEL' : '✎ EDIT CONFIG'}
        </button>
      </div>

      {editing && (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.text.cyan}33`, borderRadius: 4, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr) auto', gap: 8, alignItems: 'end' }}>
            {[
              { key: 'pref_rate', label: 'Pref Rate (%)' },
              { key: 'catchup_pct', label: 'Catch-Up (%)' },
              { key: 'lp_gp_split_base', label: 'Base LP %' },
            ].map(({ key, label }) => (
              <div key={key}>
                <div style={S.kpiLabel}>{label}</div>
                <input type="number" value={(form as Record<string,unknown>)[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }} />
              </div>
            ))}
            <div>
              <div style={S.kpiLabel}>Clawback</div>
              <select value={form.clawback ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, clawback: e.target.value === 'yes' }))}
                style={{ width: '100%', background: BT.bg.terminal, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '4px 6px', fontSize: 10, fontFamily: mono }}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <button style={{ ...S.btn(BT.text.green), marginTop: 14 }} onClick={handleSave} disabled={saving}>{saving ? 'SAVING…' : 'SAVE'}</button>
          </div>
        </div>
      )}

      {/* Waterfall flow visualization */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Step 1 */}
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${BT.text.cyan}22`, border: `1px solid ${BT.text.cyan}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: BT.text.cyan, fontFamily: mono, flexShrink: 0 }}>1</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono }}>RETURN OF CAPITAL</div>
            <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>LP/GP pro-rata until full return</div>
          </div>
          <Bd c={BT.text.cyan}>100% PRO-RATA</Bd>
        </div>
        {/* Step 2 */}
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${BT.text.green}22`, border: `1px solid ${BT.text.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: BT.text.green, fontFamily: mono, flexShrink: 0 }}>2</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono }}>PREFERRED RETURN</div>
            <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>LP accrual at preferred rate</div>
          </div>
          <Bd c={BT.text.green}>{wf ? `${(Number(wf.pref_rate) * 100).toFixed(1)}% LP PREF` : '8.0% LP PREF'}</Bd>
        </div>
        {/* Step 3 */}
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${BT.text.amber}22`, border: `1px solid ${BT.text.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: BT.text.amber, fontFamily: mono, flexShrink: 0 }}>3</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono }}>GP CATCH-UP</div>
            <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>GP catches up to promote split</div>
          </div>
          <Bd c={BT.text.amber}>{wf ? `${(Number(wf.catchup_pct) * 100).toFixed(0)}% GP` : '100% GP'}</Bd>
        </div>
        {/* Tiers */}
        {tiers.map((t, i) => (
          <div key={i} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 4, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${BT.met.financial}22`, border: `1px solid ${BT.met.financial}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: BT.met.financial, fontFamily: mono, flexShrink: 0 }}>{4 + i}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, fontFamily: mono }}>
                TIER {t.tier_order} — {t.irr_hurdle_low != null ? `${(t.irr_hurdle_low * 100).toFixed(0)}%` : '0%'} — {t.irr_hurdle_high != null ? `${(t.irr_hurdle_high * 100).toFixed(0)}%` : '∞'} IRR
              </div>
              <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>Profit split above this hurdle</div>
            </div>
            <Bd c={BT.met.financial}>{t.lp_pct}% LP / {t.gp_pct}% GP</Bd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEDGER TAB ───────────────────────────────────────────────────────────────

function LedgerTab({ dealId }: { dealId: string }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/ledger`);
      setEntries(r.data?.entries ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={S.emptyState}>Loading ledger…</div>;

  const entryTypeColor = (t: string) => {
    if (t === 'contribution') return BT.text.green;
    if (t === 'distribution') return BT.text.cyan;
    if (t === 'interest')     return BT.text.amber;
    if (t === 'fee')          return BT.text.red;
    return BT.text.muted;
  };

  return (
    <div>
      <SectionTitle>Capital Account Ledger · {entries.length} entries</SectionTitle>
      {entries.length === 0 ? (
        <div style={S.emptyState}>No ledger entries yet. Entries are created automatically when capital calls are paid and distributions are processed.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Date', 'Investor', 'Type', 'Amount', 'Reference', 'Description'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={S.td}>{e.entry_date?.slice(0, 10)}</td>
                  <td style={{ ...S.td, color: BT.text.primary, fontWeight: 600 }}>{e.investor_name}</td>
                  <td style={S.td}><span style={S.badge(entryTypeColor(e.entry_type))}>{e.entry_type.toUpperCase()}</span></td>
                  <td style={{ ...S.td, textAlign: 'right' as const, color: e.entry_type === 'distribution' ? BT.text.cyan : e.entry_type === 'contribution' ? BT.text.green : BT.text.secondary }}>
                    {e.entry_type === 'distribution' ? '-' : '+'}{fmtAmt(Math.abs(Number(e.amount)))}
                  </td>
                  <td style={{ ...S.td, color: BT.text.muted }}>{e.reference_type ?? '—'}</td>
                  <td style={{ ...S.td, color: BT.text.muted }}>{e.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [summary, setSummary] = useState<CapSummary | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/summary`);
      setSummary(r.data?.summary ?? null);
    } catch { /* silent */ }
  }, [dealId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const pendingCalls = Number(summary?.pending_calls ?? 0);

  return (
    <div style={S.root}>
      <style>{BT_CSS}</style>

      {/* ── header banner ── */}
      {pendingCalls > 0 && (
        <AlertBanner
          label="PENDING CALLS"
          text={`${pendingCalls} capital call${pendingCalls > 1 ? 's' : ''} awaiting payment. Review the Capital Calls tab to track outstanding amounts.`}
          color={BT.text.amber}
          badge={<Bd c={BT.text.amber}>{pendingCalls} OUTSTANDING</Bd>}
        />
      )}

      {/* ── tab bar ── */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tabBtn(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── content ── */}
      <div style={S.content}>
        {activeTab === 'investors'     && <InvestorsTab dealId={dealId} summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'calls'         && <CapitalCallsTab dealId={dealId} summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'distributions' && <DistributionsTab dealId={dealId} summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'waterfall'     && <WaterfallTab dealId={dealId} />}
        {activeTab === 'ledger'        && <LedgerTab dealId={dealId} />}
      </div>
    </div>
  );
}
