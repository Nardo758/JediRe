import React, { useState, useEffect, useCallback } from 'react';
import { BT } from '../bloomberg-ui';
import { apiClient } from '../../../services/api.client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Disposition {
  id: string;
  closing_date: string;
  sale_price: number;
  buyer_name: string | null;
  actual_exit_cap: number | null;
  net_sale_proceeds: number | null;
  actual_irr: number | null;
  actual_equity_multiple: number | null;
  total_equity_invested: number | null;
  disposition_notes: string | null;
}

interface Reforecast {
  id: string;
  reforecast_date: string;
  trigger_reason: string;
  original_noi_year1: number | null;
  reforecast_noi_year1: number | null;
  noi_year1_delta_pct: number | null;
  original_irr: number | null;
  reforecast_irr: number | null;
  irr_delta_bps: number | null;
  original_em: number | null;
  reforecast_em: number | null;
  status: string;
}

interface DebtPosition {
  id: string;
  loan_name: string | null;
  lender_name: string | null;
  loan_type: string | null;
  current_balance: number | null;
  current_rate: number | null;
  maturity_date: string | null;
  dscr_covenant: number | null;
  ltv_covenant: number | null;
  current_dscr: number | null;
  current_ltv: number | null;
  covenant_status: string | null;
  status: string;
}

interface CapExActual {
  id: string;
  project_name: string;
  category: string | null;
  description: string | null;
  budget_amount: number | null;
  actual_amount: number | null;
  completion_date: string | null;
  status: string;
  vendor: string | null;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const MONO = "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace";

const st = {
  cell: { padding: '5px 8px', fontSize: 10, fontFamily: MONO, borderBottom: `1px solid ${BT.border.subtle}`, color: BT.text.primary } as React.CSSProperties,
  hdr: { padding: '4px 8px', fontSize: 9, fontFamily: MONO, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.8, borderBottom: `1px solid ${BT.border.medium}`, textTransform: 'uppercase' } as React.CSSProperties,
  label: { fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.6, textTransform: 'uppercase' } as React.CSSProperties,
  val: { fontSize: 11, fontFamily: MONO, color: BT.text.primary, fontWeight: 600 } as React.CSSProperties,
  input: {
    background: '#0a0e17', border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
    fontFamily: MONO, fontSize: 10, padding: '4px 8px', width: '100%',
    outline: 'none', borderRadius: 2,
  } as React.CSSProperties,
  btn: {
    background: 'transparent', border: `1px solid ${BT.text.cyan}`,
    color: BT.text.cyan, fontFamily: MONO, fontSize: 9, fontWeight: 700,
    padding: '4px 12px', cursor: 'pointer', letterSpacing: 0.6,
  } as React.CSSProperties,
  btnAmber: {
    background: 'transparent', border: `1px solid #F5A623`,
    color: '#F5A623', fontFamily: MONO, fontSize: 9, fontWeight: 700,
    padding: '4px 12px', cursor: 'pointer', letterSpacing: 0.6,
  } as React.CSSProperties,
};

function fmt$(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—';
  return `${Number(v).toFixed(decimals)}%`;
}
function fmtBps(v: number | null | undefined): string {
  if (v == null) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)} bps`;
}
function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  return v.slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const color = s === 'pass' || s === 'compliant' || s === 'completed' ? BT.text.green
    : s === 'fail' || s === 'breach' || s === 'overdue' ? '#EF4444'
    : s === 'warning' || s === 'watch' || s === 'in_progress' ? '#F5A623'
    : BT.text.secondary;
  return (
    <span style={{ fontSize: 8, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8,
      padding: '1px 5px', border: `1px solid ${color}44`, color, textTransform: 'uppercase' }}>
      {status || '—'}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: BT.text.muted, fontFamily: MONO, fontSize: 10 }}>
      {label}
    </div>
  );
}

// ─── REFORECAST PANEL ─────────────────────────────────────────────────────────

function ReforecastPanel({ dealId }: { dealId: string }) {
  const [history, setHistory] = useState<Reforecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/lifecycle/${dealId}/reforecast/history`) as { data?: { history?: Reforecast[] } };
      setHistory(res.data?.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await apiClient.post(`/api/v1/lifecycle/${dealId}/reforecast`, { triggerReason: 'manual' }) as { data?: { success?: boolean; message?: string } };
      if (res.data?.success === false) {
        setTriggerMsg(res.data?.message ?? 'Insufficient data for reforecast');
      } else {
        setTriggerMsg('Reforecast computed successfully');
        await load();
      }
    } catch {
      setTriggerMsg('Error triggering reforecast');
    } finally {
      setTriggering(false);
    }
  };

  const latest = history[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Trigger bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}` }}>
        <button
          style={{ ...st.btnAmber, opacity: triggering ? 0.6 : 1 }}
          onClick={handleTrigger}
          disabled={triggering}
        >
          {triggering ? '⟳ COMPUTING...' : '⚡ TRIGGER REFORECAST'}
        </button>
        {triggerMsg && (
          <span style={{ fontSize: 9, fontFamily: MONO, color: triggerMsg.includes('success') ? BT.text.green : BT.text.muted }}>
            {triggerMsg}
          </span>
        )}
      </div>

      {/* Latest vs original side-by-side */}
      {latest && (
        <div style={{ padding: '0 12px' }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 8 }}>
            LATEST REFORECAST — {fmtDate(latest.reforecast_date)} · {latest.trigger_reason?.toUpperCase() ?? 'MANUAL'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle }}>
            {[
              { label: 'Metric', orig: 'Original', refr: 'Reforecast' },
              {
                label: 'NOI Year 1',
                orig: fmt$(latest.original_noi_year1),
                refr: fmt$(latest.reforecast_noi_year1),
                delta: latest.noi_year1_delta_pct != null ? fmtPct(latest.noi_year1_delta_pct) : null,
                up: (latest.noi_year1_delta_pct ?? 0) >= 0,
              },
              {
                label: 'IRR',
                orig: fmtPct(latest.original_irr),
                refr: fmtPct(latest.reforecast_irr),
                delta: latest.irr_delta_bps != null ? fmtBps(latest.irr_delta_bps) : null,
                up: (latest.irr_delta_bps ?? 0) >= 0,
              },
              {
                label: 'Equity Multiple',
                orig: latest.original_em != null ? `${Number(latest.original_em).toFixed(2)}x` : '—',
                refr: latest.reforecast_em != null ? `${Number(latest.reforecast_em).toFixed(2)}x` : '—',
                delta: null, up: true,
              },
            ].map((row, i) => (
              <React.Fragment key={i}>
                <div style={{ ...st.cell, background: i === 0 ? BT.bg.header : BT.bg.terminal, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? BT.text.muted : BT.text.primary }}>
                  {row.label}
                </div>
                <div style={{ ...st.cell, background: BT.bg.terminal, color: i === 0 ? BT.text.muted : BT.text.secondary }}>
                  {row.orig}
                </div>
                <div style={{ ...st.cell, background: BT.bg.terminal, color: i === 0 ? BT.text.muted : BT.text.primary }}>
                  {row.refr}
                  {(row as { delta?: string | null; up?: boolean }).delta && (
                    <span style={{ marginLeft: 6, fontSize: 8, color: (row as { up?: boolean }).up ? BT.text.green : '#EF4444' }}>
                      {(row as { delta?: string | null }).delta}
                    </span>
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* History log */}
      <div style={{ padding: '0 12px' }}>
        <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 6 }}>REFORECAST HISTORY</div>
        {loading ? (
          <div style={{ padding: 12, fontSize: 10, fontFamily: MONO, color: BT.text.muted }}>Loading...</div>
        ) : history.length === 0 ? (
          <EmptyState label="No reforecasts recorded yet" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Trigger', 'NOI Δ', 'IRR Orig', 'IRR Refr', 'IRR Δ', 'Status'].map(h => (
                  <th key={h} style={st.hdr}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map(r => (
                <tr key={r.id}>
                  <td style={st.cell}>{fmtDate(r.reforecast_date)}</td>
                  <td style={{ ...st.cell, color: BT.text.secondary }}>{r.trigger_reason ?? '—'}</td>
                  <td style={{ ...st.cell, color: (r.noi_year1_delta_pct ?? 0) >= 0 ? BT.text.green : '#EF4444' }}>{fmtPct(r.noi_year1_delta_pct)}</td>
                  <td style={st.cell}>{fmtPct(r.original_irr)}</td>
                  <td style={st.cell}>{fmtPct(r.reforecast_irr)}</td>
                  <td style={{ ...st.cell, color: (r.irr_delta_bps ?? 0) >= 0 ? BT.text.green : '#EF4444' }}>{fmtBps(r.irr_delta_bps)}</td>
                  <td style={st.cell}><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── DISPOSITION PANEL ────────────────────────────────────────────────────────

const EMPTY_DISP_FORM = {
  closingDate: new Date().toISOString().slice(0, 10),
  salePrice: '',
  buyerName: '',
  actualExitCap: '',
  totalEquityInvested: '',
  netSaleProceeds: '',
  actualIrr: '',
  dispositionNotes: '',
};

function DispositionPanel({ dealId }: { dealId: string }) {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_DISP_FORM });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/lifecycle/${dealId}/dispositions`) as { data?: { dispositions?: Disposition[] } };
      setDispositions(res.data?.dispositions ?? []);
    } catch {
      setDispositions([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.closingDate || !form.salePrice) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await apiClient.post(`/api/v1/lifecycle/${dealId}/disposition`, {
        closingDate: form.closingDate,
        salePrice: Number(form.salePrice),
        buyerName: form.buyerName || undefined,
        actualExitCap: form.actualExitCap ? Number(form.actualExitCap) : undefined,
        totalEquityInvested: form.totalEquityInvested ? Number(form.totalEquityInvested) : undefined,
        netSaleProceeds: form.netSaleProceeds ? Number(form.netSaleProceeds) : undefined,
        actualIrr: form.actualIrr ? Number(form.actualIrr) : undefined,
        dispositionNotes: form.dispositionNotes || undefined,
      });
      setSaveMsg('Disposition recorded');
      setForm({ ...EMPTY_DISP_FORM });
      setShowForm(false);
      await load();
    } catch {
      setSaveMsg('Error recording disposition');
    } finally {
      setSaving(false);
    }
  };

  const F = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={st.label}>{label}</span>
      <input
        type={type}
        style={st.input}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}` }}>
        <button style={st.btn} onClick={() => setShowForm(p => !p)}>
          {showForm ? '✕ CANCEL' : '+ RECORD DISPOSITION'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: 9, fontFamily: MONO, color: saveMsg.includes('Error') ? '#EF4444' : BT.text.green }}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ padding: '12px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}`, margin: '0 12px' }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 10 }}>RECORD DISPOSITION EVENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {F('Closing Date', 'closingDate', 'date')}
            {F('Sale Price ($)', 'salePrice', 'number')}
            {F('Buyer Name', 'buyerName')}
            {F('Exit Cap Rate (%)', 'actualExitCap', 'number')}
            {F('Total Equity Invested ($)', 'totalEquityInvested', 'number')}
            {F('Net Sale Proceeds ($)', 'netSaleProceeds', 'number')}
            {F('Actual IRR (%)', 'actualIrr', 'number')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
            <span style={st.label}>Notes</span>
            <textarea
              style={{ ...st.input, height: 48, resize: 'vertical' }}
              value={form.dispositionNotes}
              onChange={e => setForm(p => ({ ...p, dispositionNotes: e.target.value }))}
            />
          </div>
          <button
            style={{ ...st.btn, opacity: saving ? 0.6 : 1 }}
            onClick={handleSubmit}
            disabled={saving || !form.closingDate || !form.salePrice}
          >
            {saving ? '⟳ SAVING...' : '✓ SUBMIT'}
          </button>
        </div>
      )}

      {/* Past dispositions */}
      <div style={{ padding: '0 12px' }}>
        <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 6 }}>DISPOSITION HISTORY</div>
        {loading ? (
          <div style={{ padding: 12, fontSize: 10, fontFamily: MONO, color: BT.text.muted }}>Loading...</div>
        ) : dispositions.length === 0 ? (
          <EmptyState label="No dispositions recorded yet" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Closing Date', 'Sale Price', 'Buyer', 'Exit Cap', 'Net Proceeds', 'Actual IRR', 'EM'].map(h => (
                  <th key={h} style={st.hdr}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispositions.map(d => (
                <tr key={d.id}>
                  <td style={st.cell}>{fmtDate(d.closing_date)}</td>
                  <td style={st.cell}>{fmt$(d.sale_price)}</td>
                  <td style={{ ...st.cell, color: BT.text.secondary }}>{d.buyer_name || '—'}</td>
                  <td style={st.cell}>{fmtPct(d.actual_exit_cap)}</td>
                  <td style={st.cell}>{fmt$(d.net_sale_proceeds)}</td>
                  <td style={{ ...st.cell, color: BT.text.green }}>{fmtPct(d.actual_irr)}</td>
                  <td style={st.cell}>{d.actual_equity_multiple != null ? `${Number(d.actual_equity_multiple).toFixed(2)}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── DEBT & COVENANTS PANEL ───────────────────────────────────────────────────

const EMPTY_DEBT_FORM = {
  loanName: '',
  lenderName: '',
  loanType: 'senior',
  originalPrincipal: '',
  currentBalance: '',
  currentRate: '',
  originationDate: new Date().toISOString().slice(0, 10),
  maturityDate: '',
  dscrCovenant: '',
  ltvCovenant: '',
  amortizationType: 'interest_only',
};

function DebtPanel({ dealId }: { dealId: string }) {
  const [positions, setPositions] = useState<DebtPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_DEBT_FORM });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/lifecycle/${dealId}/debt`) as { data?: { positions?: DebtPosition[] } };
      setPositions(res.data?.positions ?? []);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.lenderName || !form.maturityDate) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await apiClient.post(`/api/v1/lifecycle/${dealId}/debt`, {
        loanName: form.loanName || undefined,
        lenderName: form.lenderName,
        loanType: form.loanType,
        originalPrincipal: form.originalPrincipal ? Number(form.originalPrincipal) : undefined,
        currentBalance: form.currentBalance ? Number(form.currentBalance) : undefined,
        currentRate: form.currentRate ? Number(form.currentRate) : undefined,
        originationDate: form.originationDate,
        maturityDate: form.maturityDate,
        dscrCovenant: form.dscrCovenant ? Number(form.dscrCovenant) : undefined,
        ltvCovenant: form.ltvCovenant ? Number(form.ltvCovenant) : undefined,
        amortizationType: form.amortizationType,
      });
      setSaveMsg('Debt position saved');
      setForm({ ...EMPTY_DEBT_FORM });
      setShowForm(false);
      await load();
    } catch {
      setSaveMsg('Error saving position');
    } finally {
      setSaving(false);
    }
  };

  const F = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={st.label}>{label}</span>
      <input type={type} style={st.input} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );
  const Sel = (label: string, key: keyof typeof form, opts: string[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={st.label}>{label}</span>
      <select style={{ ...st.input }} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}` }}>
        <button style={st.btn} onClick={() => setShowForm(p => !p)}>
          {showForm ? '✕ CANCEL' : '+ ADD POSITION'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: 9, fontFamily: MONO, color: saveMsg.includes('Error') ? '#EF4444' : BT.text.green }}>
            {saveMsg}
          </span>
        )}
      </div>

      {showForm && (
        <div style={{ padding: '12px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}`, margin: '0 12px' }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 10 }}>ADD DEBT POSITION</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {F('Loan Name', 'loanName')}
            {F('Lender', 'lenderName')}
            {Sel('Loan Type', 'loanType', ['senior', 'mezzanine', 'preferred_equity', 'bridge', 'construction', 'permanent'])}
            {F('Original Principal ($)', 'originalPrincipal', 'number')}
            {F('Current Balance ($)', 'currentBalance', 'number')}
            {F('Current Rate (%)', 'currentRate', 'number')}
            {F('Origination Date', 'originationDate', 'date')}
            {F('Maturity Date', 'maturityDate', 'date')}
            {Sel('Amortization', 'amortizationType', ['interest_only', 'amortizing', 'partial_io'])}
            {F('DSCR Covenant', 'dscrCovenant', 'number')}
            {F('LTV Covenant (%)', 'ltvCovenant', 'number')}
          </div>
          <button style={{ ...st.btn, opacity: saving ? 0.6 : 1 }} onClick={handleSubmit} disabled={saving || !form.lenderName || !form.maturityDate}>
            {saving ? '⟳ SAVING...' : '✓ SAVE POSITION'}
          </button>
        </div>
      )}

      <div style={{ padding: '0 12px' }}>
        <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 6 }}>ACTIVE DEBT POSITIONS</div>
        {loading ? (
          <div style={{ padding: 12, fontSize: 10, fontFamily: MONO, color: BT.text.muted }}>Loading...</div>
        ) : positions.length === 0 ? (
          <EmptyState label="No debt positions recorded" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Lender', 'Type', 'Balance', 'Rate', 'Maturity', 'DSCR', 'LTV', 'Covenant'].map(h => (
                  <th key={h} style={st.hdr}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const dscrOk = p.dscr_covenant == null || p.current_dscr == null || Number(p.current_dscr) >= Number(p.dscr_covenant);
                const ltvOk = p.ltv_covenant == null || p.current_ltv == null || Number(p.current_ltv) <= Number(p.ltv_covenant);
                const covenantStatus = p.covenant_status ?? (dscrOk && ltvOk ? 'pass' : 'fail');
                return (
                  <tr key={p.id}>
                    <td style={st.cell}>{p.lender_name || '—'}</td>
                    <td style={{ ...st.cell, color: BT.text.secondary }}>{p.loan_type ?? '—'}</td>
                    <td style={st.cell}>{fmt$(p.current_balance)}</td>
                    <td style={st.cell}>{fmtPct(p.current_rate)}</td>
                    <td style={{ ...st.cell, color: BT.text.secondary }}>{fmtDate(p.maturity_date)}</td>
                    <td style={{ ...st.cell, color: dscrOk ? BT.text.green : '#EF4444' }}>
                      {p.current_dscr != null ? `${Number(p.current_dscr).toFixed(2)}x` : '—'}
                      {p.dscr_covenant != null && <span style={{ color: BT.text.muted, marginLeft: 3 }}>/ {Number(p.dscr_covenant).toFixed(2)}x</span>}
                    </td>
                    <td style={{ ...st.cell, color: ltvOk ? BT.text.green : '#EF4444' }}>
                      {fmtPct(p.current_ltv)}
                      {p.ltv_covenant != null && <span style={{ color: BT.text.muted, marginLeft: 3 }}>/ {fmtPct(p.ltv_covenant)}</span>}
                    </td>
                    <td style={st.cell}><StatusBadge status={covenantStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── CAPEX PANEL ──────────────────────────────────────────────────────────────

const EMPTY_CAPEX_FORM = {
  projectName: '',
  category: 'unit_interiors',
  description: '',
  budgetAmount: '',
  actualAmount: '',
  startDate: '',
  completionDate: '',
  status: 'in_progress' as string,
  vendor: '',
};

function CapExPanel({ dealId }: { dealId: string }) {
  const [actuals, setActuals] = useState<CapExActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CAPEX_FORM });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/lifecycle/${dealId}/capex/actuals`) as { data?: { actuals?: CapExActual[] } };
      setActuals(res.data?.actuals ?? []);
    } catch {
      setActuals([]);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.projectName) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await apiClient.post(`/api/v1/lifecycle/${dealId}/capex/actuals`, {
        project_name: form.projectName,
        category: form.category || undefined,
        description: form.description || undefined,
        budget_amount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        actual_amount: form.actualAmount ? Number(form.actualAmount) : undefined,
        start_date: form.startDate || undefined,
        completion_date: form.completionDate || undefined,
        status: form.status,
        vendor: form.vendor || undefined,
      });
      setSaveMsg('CapEx item added');
      setForm({ ...EMPTY_CAPEX_FORM });
      setShowForm(false);
      await load();
    } catch {
      setSaveMsg('Error adding item');
    } finally {
      setSaving(false);
    }
  };

  const F = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={st.label}>{label}</span>
      <input type={type} style={st.input} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );
  const Sel = (label: string, key: keyof typeof form, opts: string[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={st.label}>{label}</span>
      <select style={{ ...st.input }} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const totalBudget = actuals.reduce((s, a) => s + Number(a.budget_amount ?? 0), 0);
  const totalActual = actuals.reduce((s, a) => s + Number(a.actual_amount ?? 0), 0);
  const variance = totalActual - totalBudget;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary chips */}
      {actuals.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '8px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}` }}>
          {[
            { l: 'TOTAL BUDGET', v: fmt$(totalBudget), c: BT.text.primary },
            { l: 'TOTAL ACTUAL', v: fmt$(totalActual), c: BT.text.primary },
            { l: 'VARIANCE', v: fmt$(Math.abs(variance)), c: variance <= 0 ? BT.text.green : '#EF4444' },
            { l: 'ITEMS', v: String(actuals.length), c: BT.text.cyan },
          ].map(chip => (
            <div key={chip.l} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={st.label}>{chip.l}</span>
              <span style={{ ...st.val, color: chip.c }}>{chip.v}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}` }}>
        <button style={st.btn} onClick={() => setShowForm(p => !p)}>
          {showForm ? '✕ CANCEL' : '+ ADD CAPEX ITEM'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: 9, fontFamily: MONO, color: saveMsg.includes('Error') ? '#EF4444' : BT.text.green }}>
            {saveMsg}
          </span>
        )}
      </div>

      {showForm && (
        <div style={{ padding: '12px 12px', background: BT.bg.header, border: `1px solid ${BT.border.medium}`, margin: '0 12px' }}>
          <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 10 }}>ADD CAPEX LINE ITEM</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {F('Project Name', 'projectName')}
            {Sel('Category', 'category', ['unit_interiors', 'common_areas', 'building_exterior', 'mechanical_systems', 'roofing', 'parking_paving', 'landscaping', 'amenities', 'safety_security', 'other'])}
            {F('Vendor', 'vendor')}
            {F('Budget ($)', 'budgetAmount', 'number')}
            {F('Actual ($)', 'actualAmount', 'number')}
            {Sel('Status', 'status', ['planned', 'in_progress', 'completed', 'overdue', 'cancelled'])}
            {F('Start Date', 'startDate', 'date')}
            {F('Completion Date', 'completionDate', 'date')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
            <span style={st.label}>Description</span>
            <input type="text" style={st.input} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <button style={{ ...st.btn, opacity: saving ? 0.6 : 1 }} onClick={handleSubmit} disabled={saving || !form.projectName}>
            {saving ? '⟳ SAVING...' : '✓ ADD ITEM'}
          </button>
        </div>
      )}

      <div style={{ padding: '0 12px' }}>
        <div style={{ fontSize: 9, fontFamily: MONO, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 6 }}>CAPEX LINE ITEMS</div>
        {loading ? (
          <div style={{ padding: 12, fontSize: 10, fontFamily: MONO, color: BT.text.muted }}>Loading...</div>
        ) : actuals.length === 0 ? (
          <EmptyState label="No CapEx items recorded yet" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Project', 'Category', 'Vendor', 'Budget', 'Actual', 'Variance', 'Completion', 'Status'].map(h => (
                  <th key={h} style={st.hdr}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actuals.map(a => {
                const bud = Number(a.budget_amount ?? 0);
                const act = Number(a.actual_amount ?? 0);
                const vari = act - bud;
                return (
                  <tr key={a.id}>
                    <td style={st.cell}>{a.project_name}</td>
                    <td style={{ ...st.cell, color: BT.text.secondary }}>{a.category ?? '—'}</td>
                    <td style={{ ...st.cell, color: BT.text.secondary }}>{a.vendor ?? '—'}</td>
                    <td style={st.cell}>{fmt$(a.budget_amount)}</td>
                    <td style={st.cell}>{fmt$(a.actual_amount)}</td>
                    <td style={{ ...st.cell, color: vari <= 0 ? BT.text.green : '#EF4444' }}>
                      {a.budget_amount != null && a.actual_amount != null ? fmt$(Math.abs(vari)) : '—'}
                    </td>
                    <td style={{ ...st.cell, color: BT.text.secondary }}>{fmtDate(a.completion_date)}</td>
                    <td style={st.cell}><StatusBadge status={a.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── MAIN LIFECYCLE SECTION ───────────────────────────────────────────────────

type SubPanel = 'reforecast' | 'disposition' | 'debt' | 'capex';

const SUB_PANELS: { id: SubPanel; label: string }[] = [
  { id: 'reforecast', label: 'REFORECAST' },
  { id: 'disposition', label: 'DISPOSITION' },
  { id: 'debt', label: 'DEBT & COVENANTS' },
  { id: 'capex', label: 'CAPEX' },
];

interface LifecycleSectionProps {
  dealId: string;
  deal?: Record<string, unknown>;
  [k: string]: unknown;
}

export function LifecycleSection({ dealId }: LifecycleSectionProps) {
  const [active, setActive] = useState<SubPanel>('reforecast');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, animation: 'bt-fade 0.15s' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '6px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: BT.text.amber, letterSpacing: 1 }}>LIFECYCLE</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>M22 · REFORECAST · DISPOSITION · DEBT · CAPEX</span>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0, height: 28, alignItems: 'stretch', overflowX: 'auto' }}>
        {SUB_PANELS.map(p => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            style={{
              fontFamily: MONO, fontSize: 9, fontWeight: active === p.id ? 700 : 500,
              padding: '0 16px', background: 'transparent', border: 'none',
              borderBottom: active === p.id ? `2px solid ${BT.text.amber}` : '2px solid transparent',
              color: active === p.id ? BT.text.amber : BT.text.secondary,
              cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: 0.6,
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '12px 0' }}>
          {active === 'reforecast' && <ReforecastPanel dealId={dealId} />}
          {active === 'disposition' && <DispositionPanel dealId={dealId} />}
          {active === 'debt' && <DebtPanel dealId={dealId} />}
          {active === 'capex' && <CapExPanel dealId={dealId} />}
        </div>
      </div>
    </div>
  );
}

export default LifecycleSection;
