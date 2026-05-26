// ============================================================================
// OtherIncomeTab — Editable ancillary / other income page (Phase 1)
// Task #1145: Split Unit Mix and Other Income into separate ConsoleHubTab pages
// ============================================================================
//
// Hosts the AncillaryPanel content that was previously read-only inside
// UnitMixTab. Categories are now editable inline; user-added custom lines
// can be managed (add / edit / delete) directly here without navigating to
// the Pro Forma tab.
//
// Data flow:
//   READ  — GET /api/v1/deals/:dealId/financials  (otherIncomeBreakdown + otherIncomeUserLines)
//   WRITE — PATCH /api/v1/deals/:dealId/financials/other-income/category-overrides
//           POST/PATCH/DELETE /api/v1/deals/:dealId/financials/other-income/user-lines[/:id]
// ============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  RefreshCw, Loader2, Plus, Edit3, Trash2, Check, X, RotateCcw,
  AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps } from './types';

const MONO  = BT.font.mono;
const LABEL = BT.font.label;

const C = {
  bg:       '#080c12',
  panel:    '#0d1520',
  panelAlt: '#0a1018',
  border:   '#1a2535',
  borderHi: '#1e3a5f',
  cyan:     '#00d4ff',
  cyanDim:  '#0a3040',
  amber:    '#f59e0b',
  amberDim: '#2a1a00',
  green:    '#22c55e',
  greenDim: '#0a2010',
  red:      '#ef4444',
  redDim:   '#2a0808',
  purple:   '#a78bfa',
  purpleDim:'#1a1030',
  text:     '#e2e8f0',
  muted:    '#64748b',
  dim:      '#334155',
};

const fmt$ = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString()}`;

function th(right = false): React.CSSProperties {
  return {
    padding: '5px 8px',
    fontFamily: LABEL, fontSize: 8, fontWeight: 700,
    color: C.muted, textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap', letterSpacing: '0.06em',
  };
}
function td(right = false, bold = false, color?: string): React.CSSProperties {
  return {
    padding: '5px 8px',
    fontFamily: MONO, fontSize: 10,
    color: color ?? C.text,
    fontWeight: bold ? 700 : 400,
    textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };
}

const ANCILLARY_LABELS: Record<string, string> = {
  parking:         'Parking',
  pet:             'Pet Rent',
  storage:         'Storage',
  laundry:         'Laundry',
  rubs:            'RUBS / Utility Reimb.',
  fees:            'Admin / App / Late Fees',
  insurance_admin: 'Renters Insurance',
  other:           'Other Ancillary',
};

const SRC_BADGE: Record<string, { label: string; color: string }> = {
  rent_roll:        { label: 'RR',    color: C.cyan   },
  t12:              { label: 'T-12',  color: C.muted  },
  om:               { label: 'OM',    color: C.amber  },
  override:         { label: 'OVR',   color: C.purple },
  user_override:    { label: 'OVR',   color: C.purple },
  platform_fallback:{ label: '—',     color: C.dim    },
  unseeded:         { label: '—',     color: C.dim    },
};

interface OtherIncomeBreakdownRow {
  category: string;
  rent_roll: number | null;
  t12: number | null;
  om: number | null;
  resolved: number | null;
  resolution: string;
  conflict: boolean;
}

interface OtherIncomeBreakdown {
  rows: OtherIncomeBreakdownRow[];
  total: { rent_roll: number | null; t12: number | null; om: number | null; resolved: number };
}

interface UserLine {
  id: string;
  label: string;
  monthly: number;
  qty?: number;
  rate?: number;
  frequency?: 'monthly' | 'annual';
  note?: string;
  created_at: string;
}

interface FinancialsData {
  totalUnits: number;
  otherIncomeBreakdown?: OtherIncomeBreakdown | null;
  otherIncomeUserLines?: UserLine[];
}

// ── Inline add/edit form ───────────────────────────────────────────────────
interface LineFormState {
  label: string;
  monthly: string;
  qty: string;
  rate: string;
  frequency: 'monthly' | 'annual';
  note: string;
  useQtyRate: boolean;
}
const emptyForm = (): LineFormState => ({
  label: '', monthly: '', qty: '', rate: '',
  frequency: 'monthly', note: '', useQtyRate: false,
});

export function OtherIncomeTab(props: FinancialEngineTabProps) {
  const { dealId, onF9Refresh } = props;

  const [data,    setData]    = useState<FinancialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Category override editing state — keyed by category string
  const [editingCat, setEditingCat]   = useState<string | null>(null);
  const [editVal,    setEditVal]      = useState('');
  const [savingCat,  setSavingCat]    = useState<string | null>(null);
  const [savedCat,   setSavedCat]     = useState<string | null>(null);

  // User-lines state
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [addForm,       setAddForm]       = useState<LineFormState>(emptyForm());
  const [addingLine,    setAddingLine]    = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editForm,      setEditForm]      = useState<LineFormState>(emptyForm());
  const [savingLineId,  setSavingLineId]  = useState<string | null>(null);
  const [deletingLineId,setDeletingLineId]= useState<string | null>(null);

  // Collapse state for the breakdown section
  const [breakdownCollapsed, setBreakdownCollapsed] = useState(false);
  const [userLinesCollapsed,  setUserLinesCollapsed]  = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: FinancialsData }>(
        `/api/v1/deals/${dealId}/financials`
      );
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError('Failed to load other income data');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  // ── Category override commit ────────────────────────────────────────────
  const commitCatOverride = useCallback(async (category: string, value: number | null) => {
    setSavingCat(category);
    try {
      await apiClient.patch(
        `/api/v1/deals/${dealId}/financials/other-income/category-overrides`,
        { category, value }
      );
      await load();
      setSavedCat(category);
      setTimeout(() => setSavedCat(c => c === category ? null : c), 1800);
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error(`Failed to save other income category override (${category}):`, e);
    } finally {
      setSavingCat(null);
    }
  }, [dealId, load, onF9Refresh]);

  // ── User line mutations ─────────────────────────────────────────────────
  const buildLinePayload = (form: LineFormState) => {
    if (form.useQtyRate) {
      return {
        label:     form.label.trim(),
        qty:       parseFloat(form.qty) || 0,
        rate:      parseFloat(form.rate) || 0,
        frequency: form.frequency,
        note:      form.note.trim() || undefined,
      };
    }
    return {
      label:   form.label.trim(),
      monthly: parseFloat(form.monthly) || 0,
      note:    form.note.trim() || undefined,
    };
  };

  const handleAddLine = useCallback(async () => {
    if (!addForm.label.trim()) return;
    setAddingLine(true);
    try {
      await apiClient.post(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines`,
        buildLinePayload(addForm)
      );
      setAddForm(emptyForm());
      setShowAddForm(false);
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to add user line:', e);
    } finally {
      setAddingLine(false);
    }
  }, [dealId, addForm, load, onF9Refresh]);

  const handleEditLine = useCallback(async (lineId: string) => {
    setSavingLineId(lineId);
    try {
      await apiClient.patch(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines/${lineId}`,
        buildLinePayload(editForm)
      );
      setEditingLineId(null);
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to edit user line:', e);
    } finally {
      setSavingLineId(null);
    }
  }, [dealId, editForm, load, onF9Refresh]);

  const handleDeleteLine = useCallback(async (lineId: string) => {
    setDeletingLineId(lineId);
    try {
      await apiClient.delete(
        `/api/v1/deals/${dealId}/financials/other-income/user-lines/${lineId}`
      );
      await load();
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      console.error('Failed to delete user line:', e);
    } finally {
      setDeletingLineId(null);
    }
  }, [dealId, load, onF9Refresh]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: C.bg }}>
        <Loader2 size={20} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: LABEL, fontSize: 11, color: C.muted, marginLeft: 10 }}>Loading other income...</span>
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: 24, color: C.red, fontFamily: LABEL, fontSize: 11 }}>{error}</div>;
  }

  const breakdown   = data?.otherIncomeBreakdown ?? null;
  const userLines   = data?.otherIncomeUserLines ?? [];
  const totalUnits  = data?.totalUnits ?? 0;

  const userLinesAnnual = userLines.reduce((s, l) => s + l.monthly * 12, 0);
  const breakdownTotal  = breakdown?.total.resolved ?? 0;
  const grandTotal      = breakdownTotal + userLinesAnnual;

  return (
    <div style={{ background: C.bg, minHeight: '100%', overflowY: 'auto' }}>

      {/* ── Header bar ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: LABEL, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: '0.1em' }}>F14 · OTHER INCOME</span>
          <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted, marginLeft: 12 }}>
            Ancillary revenue · RR / T-12 / OM reconciliation · custom lines
          </span>
        </div>
        <button
          onClick={load}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontFamily: LABEL, fontSize: 9 }}
        >
          <RefreshCw size={11} /> REFRESH
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}>
        {[
          { label: 'RECONCILED SOURCES', value: fmt$(breakdownTotal), color: C.cyan,   sub: 'RR / T-12 / OM resolved' },
          { label: 'USER-ADDED LINES',   value: fmt$(userLinesAnnual), color: C.purple, sub: `${userLines.length} custom line${userLines.length !== 1 ? 's' : ''}` },
          { label: 'TOTAL ANCILLARY',    value: fmt$(grandTotal),      color: C.amber,  sub: 'feeds EGI in F9' },
          ...(totalUnits > 0 && grandTotal > 0 ? [{ label: '$/UNIT/YR', value: `$${Math.round(grandTotal / totalUnits).toLocaleString()}`, color: C.green, sub: 'blended all sources' }] : []),
        ].map(pill => (
          <div key={pill.label} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', minWidth: 140 }}>
            <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, letterSpacing: '0.06em', marginBottom: 4 }}>{pill.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: pill.color }}>{pill.value}</div>
            <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, marginTop: 2 }}>{pill.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 20px' }}>

        {/* ── Per-Category Breakdown ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
          <div
            onClick={() => setBreakdownCollapsed(c => !c)}
            style={{ padding: '8px 12px', borderBottom: breakdownCollapsed ? undefined : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            {breakdownCollapsed
              ? <ChevronRight size={12} color={C.muted} />
              : <ChevronDown  size={12} color={C.muted} />}
            <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>
              CATEGORY BREAKDOWN · RR · T-12 · OM · RESOLVED
            </span>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginLeft: 4 }}>
              click resolved value to override · OVR badge + reset when overridden
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, marginLeft: 'auto' }}>
              {fmt$(breakdownTotal)}/yr
            </span>
          </div>

          {!breakdownCollapsed && (
            breakdown == null ? (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: LABEL, fontSize: 10, color: C.muted, marginBottom: 4 }}>NO ANCILLARY DATA</div>
                <div style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>
                  Upload a rent roll, T-12, or OM to populate this section. Or add custom lines below.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panelAlt }}>
                      <th style={th()}>CATEGORY</th>
                      <th style={th(true)}>RENT ROLL</th>
                      <th style={th(true)}>T-12</th>
                      <th style={th(true)}>OM</th>
                      <th style={th(true)}>RESOLVED (EDITABLE)</th>
                      <th style={th()}>SOURCE</th>
                      <th style={th(true)}>$/UNIT/YR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.rows.map((row, idx) => {
                      const meta       = SRC_BADGE[row.resolution] ?? SRC_BADGE.unseeded;
                      const isOverridden = row.resolution === 'user_override';
                      const isEditing  = editingCat === row.category;
                      const isSaving   = savingCat  === row.category;
                      const isJustSaved= savedCat   === row.category;
                      const perUnit    = totalUnits > 0 && row.resolved != null
                        ? Math.round(row.resolved / totalUnits)
                        : null;

                      return (
                        <tr key={row.category} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>

                          {/* Category label */}
                          <td style={{ ...td(), color: C.cyan, fontWeight: 700 }}>
                            {ANCILLARY_LABELS[row.category] ?? row.category}
                          </td>

                          {/* RR */}
                          <td style={td(true)}>
                            <span style={{ color: row.rent_roll != null ? C.cyan : C.dim }}>
                              {row.rent_roll != null ? fmt$(row.rent_roll) : '—'}
                            </span>
                          </td>

                          {/* T-12 */}
                          <td style={td(true)}>
                            <span style={{ color: row.t12 != null ? C.muted : C.dim }}>
                              {row.t12 != null ? fmt$(row.t12) : '—'}
                            </span>
                          </td>

                          {/* OM */}
                          <td style={td(true)}>
                            <span style={{ color: row.om != null ? C.amber : C.dim }}>
                              {row.om != null ? fmt$(row.om) : '—'}
                            </span>
                          </td>

                          {/* Resolved — editable */}
                          <td style={{ ...td(true), position: 'relative', minWidth: 140 }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                <input
                                  autoFocus
                                  type="number"
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      const v = parseFloat(editVal);
                                      if (!isNaN(v)) {
                                        void commitCatOverride(row.category, v);
                                        setEditingCat(null);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingCat(null);
                                    }
                                  }}
                                  placeholder="$/yr"
                                  style={{ width: 90, background: C.panelAlt, border: `1px solid ${C.amber}`, borderRadius: 3, color: C.amber, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
                                />
                                <button
                                  onClick={() => {
                                    const v = parseFloat(editVal);
                                    if (!isNaN(v)) {
                                      void commitCatOverride(row.category, v);
                                    }
                                    setEditingCat(null);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.green }}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingCat(null)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.red }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>

                                {/* OVR badge + reset */}
                                {isOverridden && (
                                  <span
                                    style={{ fontFamily: LABEL, fontSize: 7, fontWeight: 700, color: C.purple, background: C.purpleDim, border: `1px solid ${C.purple}55`, borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em', cursor: 'default' }}
                                    title="User override — click ↺ to restore reconciled value"
                                  >
                                    OVR
                                  </span>
                                )}

                                {isSaving ? (
                                  <Loader2 size={12} color={C.amber} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : isJustSaved ? (
                                  <span style={{ fontFamily: LABEL, fontSize: 8, color: C.green }}>SAVED</span>
                                ) : (
                                  <span
                                    style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: row.resolved != null ? C.text : C.dim, cursor: 'text' }}
                                    onClick={() => {
                                      setEditingCat(row.category);
                                      setEditVal(row.resolved != null ? String(Math.round(row.resolved)) : '');
                                    }}
                                    title="Click to edit"
                                  >
                                    {row.resolved != null ? fmt$(row.resolved) : '—'}
                                    {row.conflict && (
                                      <span title="Sources disagree by > 15%" style={{ color: C.red, marginLeft: 4 }}>⚠</span>
                                    )}
                                  </span>
                                )}

                                {/* Edit pencil */}
                                {!isSaving && !isJustSaved && (
                                  <button
                                    onClick={() => {
                                      setEditingCat(row.category);
                                      setEditVal(row.resolved != null ? String(Math.round(row.resolved)) : '');
                                    }}
                                    title="Edit resolved value"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted, opacity: 0.5 }}
                                  >
                                    <Edit3 size={10} />
                                  </button>
                                )}

                                {/* Reset override */}
                                {isOverridden && !isSaving && (
                                  <button
                                    onClick={() => void commitCatOverride(row.category, null)}
                                    title="Reset to reconciled value"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.purple, opacity: 0.7 }}
                                  >
                                    <RotateCcw size={10} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Source badge */}
                          <td style={{ ...td() }}>
                            <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: meta.color, letterSpacing: '0.06em' }}>
                              {meta.label}
                            </span>
                          </td>

                          {/* $/unit/yr */}
                          <td style={{ ...td(true), color: C.dim, fontSize: 9 }}>
                            {perUnit != null ? `$${perUnit.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                      <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTAL RECONCILED</td>
                      <td style={td(true, true, C.cyan)}>{breakdown.total.rent_roll != null ? fmt$(breakdown.total.rent_roll) : '—'}</td>
                      <td style={td(true, true, C.muted)}>{breakdown.total.t12 != null ? fmt$(breakdown.total.t12) : '—'}</td>
                      <td style={td(true, true, C.amber)}>{breakdown.total.om != null ? fmt$(breakdown.total.om) : '—'}</td>
                      <td style={td(true, true, C.green)}>{fmt$(breakdownTotal)}</td>
                      <td style={{ ...td(), color: C.dim, fontSize: 8 }}>resolved</td>
                      <td style={{ ...td(true), color: C.dim, fontSize: 8 }}>
                        {totalUnits > 0 ? `$${Math.round(breakdownTotal / totalUnits).toLocaleString()}/yr` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </div>

        {/* ── User-Added Custom Lines ── */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <div
            onClick={() => setUserLinesCollapsed(c => !c)}
            style={{ padding: '8px 12px', borderBottom: userLinesCollapsed ? undefined : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            {userLinesCollapsed
              ? <ChevronRight size={12} color={C.muted} />
              : <ChevronDown  size={12} color={C.muted} />}
            <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.purple, letterSpacing: '0.06em' }}>
              CUSTOM INCOME LINES
            </span>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginLeft: 4 }}>
              solar revenue, cell towers, vending, co-working memberships…
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.purple, marginLeft: 'auto' }}>
              {fmt$(userLinesAnnual)}/yr
            </span>
          </div>

          {!userLinesCollapsed && (
            <>
              {userLines.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.panelAlt }}>
                        <th style={th()}>LABEL</th>
                        <th style={th()}>BILLING</th>
                        <th style={th(true)}>$/MO</th>
                        <th style={th(true)}>$/YR</th>
                        <th style={th(true)}>$/UNIT/YR</th>
                        <th style={th()}>NOTE</th>
                        <th style={th()}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userLines.map((line, idx) => {
                        const annual  = line.monthly * 12;
                        const perUnit = totalUnits > 0 ? Math.round(annual / totalUnits) : null;
                        const isEditingThis = editingLineId === line.id;
                        const isSavingThis  = savingLineId  === line.id;
                        const isDeletingThis= deletingLineId=== line.id;

                        return (
                          <tr key={line.id} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                            {isEditingThis ? (
                              <>
                                <td style={td()} colSpan={6}>
                                  <InlineLineForm
                                    form={editForm}
                                    setForm={setEditForm}
                                    compact
                                  />
                                </td>
                                <td style={td()}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => void handleEditLine(line.id)}
                                      disabled={isSavingThis}
                                      style={{ background: C.green, border: 'none', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', color: C.bg, fontFamily: LABEL, fontSize: 8, fontWeight: 700 }}
                                    >
                                      {isSavingThis ? '…' : 'SAVE'}
                                    </button>
                                    <button
                                      onClick={() => { setEditingLineId(null); }}
                                      style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 8px', cursor: 'pointer', color: C.muted, fontFamily: LABEL, fontSize: 8 }}
                                    >
                                      CANCEL
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ ...td(), color: C.purple, fontWeight: 700 }}>{line.label}</td>
                                <td style={{ ...td(), color: C.dim, fontSize: 9 }}>
                                  {line.qty != null && line.rate != null
                                    ? `${line.qty.toLocaleString()} × $${line.rate}/${line.frequency === 'annual' ? 'yr' : 'mo'}`
                                    : 'flat monthly'}
                                </td>
                                <td style={td(true, false, C.text)}>${Math.round(line.monthly).toLocaleString()}</td>
                                <td style={td(true, true, C.amber)}>{fmt$(annual)}</td>
                                <td style={{ ...td(true), color: C.dim, fontSize: 9 }}>
                                  {perUnit != null ? `$${perUnit.toLocaleString()}` : '—'}
                                </td>
                                <td style={{ ...td(), color: C.dim, fontSize: 9, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {line.note || '—'}
                                </td>
                                <td style={td()}>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      onClick={() => {
                                        setEditingLineId(line.id);
                                        setEditForm({
                                          label:      line.label,
                                          monthly:    String(Math.round(line.monthly)),
                                          qty:        line.qty != null ? String(line.qty) : '',
                                          rate:       line.rate != null ? String(line.rate) : '',
                                          frequency:  line.frequency ?? 'monthly',
                                          note:       line.note ?? '',
                                          useQtyRate: line.qty != null && line.rate != null,
                                        });
                                      }}
                                      title="Edit line"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.cyan }}
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                    <button
                                      onClick={() => void handleDeleteLine(line.id)}
                                      disabled={isDeletingThis}
                                      title="Delete line"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isDeletingThis ? C.dim : C.red }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    {userLines.length > 1 && (
                      <tfoot>
                        <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                          <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTAL CUSTOM</td>
                          <td style={td()} />
                          <td style={td(true, true, C.text)}>${Math.round(userLinesAnnual / 12).toLocaleString()}/mo</td>
                          <td style={td(true, true, C.purple)}>{fmt$(userLinesAnnual)}</td>
                          <td style={{ ...td(true), color: C.dim, fontSize: 8 }}>
                            {totalUnits > 0 ? `$${Math.round(userLinesAnnual / totalUnits).toLocaleString()}/yr` : '—'}
                          </td>
                          <td style={td()} />
                          <td style={td()} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {userLines.length === 0 && !showAddForm && (
                <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>
                    No custom income lines added yet.
                  </span>
                </div>
              )}

              {/* Add form */}
              {showAddForm ? (
                <div style={{ padding: '12px 14px', background: C.panelAlt, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.purple, marginBottom: 10 }}>
                    ADD CUSTOM LINE
                  </div>
                  <InlineLineForm form={addForm} setForm={setAddForm} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => void handleAddLine()}
                      disabled={addingLine || !addForm.label.trim()}
                      style={{ background: C.purple, border: 'none', borderRadius: 4, padding: '5px 14px', cursor: addingLine || !addForm.label.trim() ? 'not-allowed' : 'pointer', color: C.bg, fontFamily: LABEL, fontSize: 9, fontWeight: 700, opacity: !addForm.label.trim() ? 0.5 : 1 }}
                    >
                      {addingLine ? '…' : 'ADD LINE'}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setAddForm(emptyForm()); }}
                      style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 14px', cursor: 'pointer', color: C.muted, fontFamily: LABEL, fontSize: 9 }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderTop: userLines.length > 0 ? `1px solid ${C.border}` : undefined }}>
                  <button
                    onClick={() => setShowAddForm(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px solid ${C.purple}55`, borderRadius: 4, padding: '5px 12px', cursor: 'pointer', color: C.purple, fontFamily: LABEL, fontSize: 9 }}
                  >
                    <Plus size={11} /> ADD CUSTOM LINE
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── EGI feed footer ── */}
        {grandTotal > 0 && (
          <div style={{ marginTop: 12, background: C.amberDim, border: `1px solid ${C.amber}33`, borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>
                OTHER INCOME → FINANCIAL ENGINE (F9 EGI)
              </span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.amber }}>
              {fmt$(grandTotal)}/yr
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline form sub-component ───────────────────────────────────────────────
function InlineLineForm({
  form, setForm, compact = false,
}: {
  form: LineFormState;
  setForm: React.Dispatch<React.SetStateAction<LineFormState>>;
  compact?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    background: '#0a1018',
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    color: C.text,
    fontFamily: MONO,
    fontSize: 10,
    padding: '4px 6px',
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: LABEL, fontSize: 8, color: C.muted, marginBottom: 3, display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 8 : 12 }}>
      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: compact ? 120 : 160 }}>
        <label style={labelStyle}>LABEL *</label>
        <input
          type="text"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          placeholder="e.g. EV Charging"
          style={{ ...inputStyle, width: '100%' }}
        />
      </div>

      {/* Billing mode toggle */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={labelStyle}>BILLING MODE</label>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, useQtyRate: false }))}
            style={{ fontFamily: LABEL, fontSize: 8, padding: '4px 8px', border: `1px solid ${!form.useQtyRate ? C.amber : C.border}`, borderRadius: 3, background: !form.useQtyRate ? C.amberDim : 'transparent', color: !form.useQtyRate ? C.amber : C.muted, cursor: 'pointer' }}
          >
            FLAT $/MO
          </button>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, useQtyRate: true }))}
            style={{ fontFamily: LABEL, fontSize: 8, padding: '4px 8px', border: `1px solid ${form.useQtyRate ? C.amber : C.border}`, borderRadius: 3, background: form.useQtyRate ? C.amberDim : 'transparent', color: form.useQtyRate ? C.amber : C.muted, cursor: 'pointer' }}
          >
            QTY × RATE
          </button>
        </div>
      </div>

      {form.useQtyRate ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>QTY</label>
            <input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={{ ...inputStyle, width: 70 }} placeholder="e.g. 50" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>RATE</label>
            <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} style={{ ...inputStyle, width: 80 }} placeholder="$/unit" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>FREQ</label>
            <select
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value as 'monthly' | 'annual' }))}
              style={{ ...inputStyle, width: 90 }}
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={labelStyle}>$/MONTH</label>
          <input type="number" value={form.monthly} onChange={e => setForm(f => ({ ...f, monthly: e.target.value }))} style={{ ...inputStyle, width: 90 }} placeholder="e.g. 1200" />
        </div>
      )}

      {/* Note */}
      {!compact && (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200, flex: 1 }}>
          <label style={labelStyle}>NOTE (optional)</label>
          <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Description or source" style={{ ...inputStyle, width: '100%' }} />
        </div>
      )}
    </div>
  );
}
