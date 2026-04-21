/**
 * MonthlyActualsSection — M22 Post-Close Actuals Write Path
 *
 * Lets operators enter monthly performance data for closed deals.
 * Data flows into deal_monthly_actuals → feeds Tier-2 CashFlow Agent evidence
 * and the nightly archive-aggregation job that powers underwriting benchmarks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Plus, TrendingUp, AlertCircle, CheckCircle2, ChevronDown,
  ChevronUp, Loader2, X, Activity, DollarSign, Home, BarChart3
} from 'lucide-react';
import { apiClient } from '../../../services/api.client';
import { BT, MONO } from '../bloomberg-ui';

interface MonthlyActual {
  id: string;
  deal_id: string;
  property_id: string | null;
  report_month: string;
  is_budget: boolean;
  occupied_units: number | null;
  total_units: number | null;
  occupancy_rate: number | null;
  gross_potential_rent: number | null;
  avg_effective_rent: number | null;
  effective_gross_income: number | null;
  noi: number | null;
  expenses: number | null;
  payroll: number | null;
  repairs_maintenance: number | null;
  utilities: number | null;
  marketing: number | null;
  admin_general: number | null;
  management_fee: number | null;
  management_fee_pct: number | null;
  turnover_costs: number | null;
  real_estate_taxes: number | null;
  insurance: number | null;
  capex: number | null;
  source: string;
  notes: string | null;
  created_at: string;
}

interface FormState {
  report_month: string;
  occupied_units: string;
  total_units: string;
  gross_potential_rent: string;
  avg_effective_rent: string;
  effective_gross_income: string;
  noi: string;
  payroll: string;
  repairs_maintenance: string;
  utilities: string;
  marketing: string;
  admin_general: string;
  management_fee: string;
  management_fee_pct: string;
  turnover_costs: string;
  real_estate_taxes: string;
  insurance: string;
  capex: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  report_month: '',
  occupied_units: '',
  total_units: '',
  gross_potential_rent: '',
  avg_effective_rent: '',
  effective_gross_income: '',
  noi: '',
  payroll: '',
  repairs_maintenance: '',
  utilities: '',
  marketing: '',
  admin_general: '',
  management_fee: '',
  management_fee_pct: '',
  turnover_costs: '',
  real_estate_taxes: '',
  insurance: '',
  capex: '',
  notes: '',
};

const fmt$ = (v: number | null | undefined) =>
  v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`;
const fmtMonth = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

interface Props {
  dealId: string;
  deal?: Record<string, unknown>;
}

const MonthlyActualsSection: React.FC<Props> = ({ dealId, deal }) => {
  const [actuals, setActuals] = useState<MonthlyActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=36`);
      setActuals(res.data?.data ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load actuals';
      const apiErr = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(apiErr ?? msg);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.report_month) {
      setSubmitError('Report month is required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const row: Record<string, unknown> = {
        report_month: form.report_month + '-01',
      };
      const parseNum = (v: string) => v.trim() ? parseFloat(v) : null;
      const parseInt2 = (v: string) => v.trim() ? parseInt(v, 10) : null;

      if (form.occupied_units) row.occupied_units = parseInt2(form.occupied_units);
      if (form.total_units) row.total_units = parseInt2(form.total_units);
      if (form.gross_potential_rent) row.gross_potential_rent = parseNum(form.gross_potential_rent);
      if (form.avg_effective_rent) row.avg_effective_rent = parseNum(form.avg_effective_rent);
      if (form.effective_gross_income) row.effective_gross_income = parseNum(form.effective_gross_income);
      if (form.noi) row.noi = parseNum(form.noi);
      if (form.payroll) row.payroll = parseNum(form.payroll);
      if (form.repairs_maintenance) row.repairs_maintenance = parseNum(form.repairs_maintenance);
      if (form.utilities) row.utilities = parseNum(form.utilities);
      if (form.marketing) row.marketing = parseNum(form.marketing);
      if (form.admin_general) row.admin_general = parseNum(form.admin_general);
      if (form.management_fee) row.management_fee = parseNum(form.management_fee);
      if (form.management_fee_pct.trim()) {
        const pct = parseFloat(form.management_fee_pct);
        row.management_fee_pct = !isNaN(pct) ? pct / 100 : null;
      }
      if (form.turnover_costs) row.turnover_costs = parseNum(form.turnover_costs);
      if (form.real_estate_taxes) row.real_estate_taxes = parseNum(form.real_estate_taxes);
      if (form.insurance) row.insurance = parseNum(form.insurance);
      if (form.capex) row.capex = parseNum(form.capex);
      if (form.notes.trim()) row.notes = form.notes.trim();

      await apiClient.post(`/api/v1/operations/${dealId}/monthly-actuals`, { actuals: [row] });
      setSubmitSuccess(true);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save actuals';
      const apiErr = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSubmitError(apiErr ?? msg);
    } finally {
      setSubmitting(false);
    }
  };

  const tierStatus = actuals.length >= 3
    ? { label: 'TIER 2 ACTIVE', color: BT.text.green, icon: <CheckCircle2 size={12} /> }
    : actuals.length > 0
    ? { label: `${actuals.length}/3 MONTHS — TIER 2 PENDING`, color: BT.text.amber, icon: <Activity size={12} /> }
    : { label: 'NO ACTUALS — TIER 3/4 ONLY', color: BT.text.muted, icon: <AlertCircle size={12} /> };

  const inputStyle: React.CSSProperties = {
    background: BT.bg.input,
    border: `1px solid ${BT.border.subtle}`,
    color: BT.text.primary,
    fontFamily: MONO,
    fontSize: 11,
    padding: '4px 8px',
    borderRadius: 2,
    width: '100%',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: BT.text.muted,
    fontFamily: MONO,
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: 'uppercase' as const,
    display: 'block',
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={14} color={BT.text.cyan} />
          <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, fontFamily: MONO, letterSpacing: 1 }}>
            POST-CLOSE ACTUALS — M22
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: tierStatus.color, fontSize: 9, fontFamily: MONO, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
            {tierStatus.icon} {tierStatus.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        padding: 12,
        fontSize: 11,
        color: BT.text.secondary,
        fontFamily: MONO,
        lineHeight: 1.5,
      }}>
        Monthly actuals feed the CashFlow Agent's <span style={{ color: BT.text.cyan }}>Tier 2 evidence layer</span> —
        owned-portfolio comparables that improve future underwriting accuracy.
        Once <span style={{ color: BT.text.amber }}>3+ months</span> are recorded, this deal's data
        appears as a comparable for similar assets and the nightly benchmark aggregation produces
        non-empty percentile chips on ProForma fields.
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => { setShowForm(!showForm); setSubmitError(null); }}
          style={{
            background: showForm ? BT.bg.hover : BT.accent.blue,
            color: BT.text.primary,
            border: `1px solid ${BT.border.accent}`,
            padding: '5px 12px',
            fontSize: 10,
            fontFamily: MONO,
            letterSpacing: 0.5,
            cursor: 'pointer',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {showForm ? <X size={11} /> : <Plus size={11} />}
          {showForm ? 'CANCEL' : 'ADD MONTH'}
        </button>
        {submitSuccess && (
          <span style={{ color: BT.text.green, fontSize: 10, fontFamily: MONO, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={11} /> SAVED
          </span>
        )}
      </div>

      {/* Add Month Form */}
      {showForm && (
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.accent}`,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.cyan, fontFamily: MONO, letterSpacing: 1 }}>
            ENTER MONTHLY DATA
          </div>

          {/* Row 1: Month + Occupancy */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>Period *</label>
              <input
                type="month"
                value={form.report_month}
                onChange={e => setForm(f => ({ ...f, report_month: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Occupied Units</label>
              <input
                type="number"
                placeholder="e.g. 245"
                value={form.occupied_units}
                onChange={e => setForm(f => ({ ...f, occupied_units: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Total Units</label>
              <input
                type="number"
                placeholder="e.g. 260"
                value={form.total_units}
                onChange={e => setForm(f => ({ ...f, total_units: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Avg Eff Rent / Unit ($)</label>
              <input
                type="number"
                placeholder="e.g. 1850"
                value={form.avg_effective_rent}
                onChange={e => setForm(f => ({ ...f, avg_effective_rent: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 2: Revenue */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div>
              <label style={labelStyle}>Gross Potential Rent ($)</label>
              <input
                type="number"
                placeholder="Monthly GPR"
                value={form.gross_potential_rent}
                onChange={e => setForm(f => ({ ...f, gross_potential_rent: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Effective Gross Income ($)</label>
              <input
                type="number"
                placeholder="Monthly EGI"
                value={form.effective_gross_income}
                onChange={e => setForm(f => ({ ...f, effective_gross_income: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Net Operating Income ($)</label>
              <input
                type="number"
                placeholder="Monthly NOI"
                value={form.noi}
                onChange={e => setForm(f => ({ ...f, noi: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 3: Opex line items */}
          <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>
            OPERATING EXPENSES (monthly $, optional)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {(
              [
                { key: 'payroll',            label: 'Payroll' },
                { key: 'repairs_maintenance', label: 'Repairs & Maint' },
                { key: 'utilities',          label: 'Utilities' },
                { key: 'marketing',          label: 'Marketing' },
                { key: 'admin_general',      label: 'Admin & General' },
                { key: 'management_fee',     label: 'Mgmt Fee ($)' },
                { key: 'management_fee_pct', label: 'Mgmt Fee (%)' },
                { key: 'turnover_costs',     label: 'Turnover' },
                { key: 'real_estate_taxes',  label: 'RE Taxes' },
                { key: 'insurance',          label: 'Insurance' },
                { key: 'capex',              label: 'CapEx' },
              ] as { key: keyof FormState; label: string }[]
            ).map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <input
              type="text"
              placeholder="e.g. Partial month — boiler replacement"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>

          {/* Submit */}
          {submitError && (
            <div style={{ color: BT.text.red, fontSize: 10, fontFamily: MONO, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={11} /> {submitError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.report_month}
              style={{
                background: BT.accent.blue,
                color: BT.text.primary,
                border: `1px solid ${BT.border.accent}`,
                padding: '5px 16px',
                fontSize: 10,
                fontFamily: MONO,
                letterSpacing: 0.5,
                cursor: submitting ? 'wait' : 'pointer',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              SAVE MONTH
            </button>
          </div>
        </div>
      )}

      {/* Table of recorded months */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: BT.text.muted, fontSize: 11, fontFamily: MONO, padding: 16 }}>
          <Loader2 size={13} className="animate-spin" /> Loading actuals...
        </div>
      ) : error ? (
        <div style={{ color: BT.text.red, fontSize: 11, fontFamily: MONO, padding: 12 }}>
          <AlertCircle size={12} style={{ display: 'inline', marginRight: 6 }} />{error}
        </div>
      ) : actuals.length === 0 ? (
        <div style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.subtle}`,
          padding: 24,
          textAlign: 'center',
        }}>
          <BarChart3 size={24} color={BT.text.muted} style={{ margin: '0 auto 8px' }} />
          <div style={{ color: BT.text.muted, fontSize: 11, fontFamily: MONO, marginBottom: 4 }}>
            NO ACTUALS RECORDED
          </div>
          <div style={{ color: BT.text.secondary, fontSize: 10, fontFamily: MONO }}>
            Add monthly performance data to activate Tier 2 evidence for future underwriting.
          </div>
        </div>
      ) : (
        <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 80px 70px 90px 90px 90px 70px 1fr',
            padding: '6px 12px',
            borderBottom: `1px solid ${BT.border.subtle}`,
            background: BT.bg.hover,
          }}>
            {['MONTH', 'OCCUPANCY', 'UNITS', 'EGI', 'NOI', 'OPEX', 'SOURCE', 'NOTES'].map(h => (
              <div key={h} style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{h}</div>
            ))}
          </div>

          {actuals.map((a) => {
            const isExpanded = expandedRow === a.id;
            const occ = a.occupancy_rate ??
              (a.occupied_units != null && a.total_units != null && a.total_units !== 0
                ? a.occupied_units / a.total_units : null);
            const expensesVal = a.expenses ??
              (a.effective_gross_income != null && a.noi != null
                ? a.effective_gross_income - a.noi : null);
            const opexRatio = expensesVal != null && a.effective_gross_income != null && a.effective_gross_income !== 0
              ? expensesVal / a.effective_gross_income : null;

            return (
              <div key={a.id} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 80px 70px 90px 90px 90px 70px 1fr',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    background: isExpanded ? BT.bg.hover : 'transparent',
                  }}
                  onClick={() => setExpandedRow(isExpanded ? null : a.id)}
                >
                  <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO }}>{fmtMonth(a.report_month)}</div>
                  <div style={{
                    fontSize: 10,
                    fontFamily: MONO,
                    color: occ == null ? BT.text.muted : occ >= 0.93 ? BT.text.green : occ >= 0.85 ? BT.text.amber : BT.text.red,
                  }}>
                    {fmtPct(occ)}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.secondary, fontFamily: MONO }}>
                    {a.occupied_units != null && a.total_units != null ? `${a.occupied_units}/${a.total_units}` : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.primary, fontFamily: MONO }}>{fmt$(a.effective_gross_income)}</div>
                  <div style={{
                    fontSize: 10,
                    fontFamily: MONO,
                    color: a.noi == null ? BT.text.muted : a.noi > 0 ? BT.text.green : BT.text.red,
                  }}>
                    {fmt$(a.noi)}
                  </div>
                  <div style={{ fontSize: 10, color: BT.text.secondary, fontFamily: MONO }}>
                    {opexRatio != null ? `${(opexRatio * 100).toFixed(0)}% EGI` : fmt$(expensesVal)}
                  </div>
                  <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>
                    {a.source === 'manual' ? 'MANUAL' : (a.source ?? '—').toUpperCase()}
                  </div>
                  <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.notes ?? ''}
                  </div>
                </div>

                {/* Expanded opex breakdown */}
                {isExpanded && (
                  <div style={{
                    padding: '8px 12px 12px',
                    background: BT.bg.input,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 8,
                  }}>
                    {[
                      { label: 'Payroll', val: a.payroll },
                      { label: 'Repairs & Maint', val: a.repairs_maintenance },
                      { label: 'Utilities', val: a.utilities },
                      { label: 'Marketing', val: a.marketing },
                      { label: 'Admin & General', val: a.admin_general },
                      { label: 'Management Fee', val: a.management_fee },
                      { label: 'Turnover', val: a.turnover_costs },
                      { label: 'RE Taxes', val: a.real_estate_taxes },
                      { label: 'Insurance', val: a.insurance },
                      { label: 'CapEx', val: a.capex },
                      { label: 'Avg Eff Rent/Unit', val: a.avg_effective_rent },
                      { label: 'Gross Potential Rent', val: a.gross_potential_rent },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>{label.toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: val != null ? BT.text.primary : BT.text.muted, fontFamily: MONO }}>
                          {label.includes('%') ? fmtPct(val) : fmt$(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      {actuals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            {
              icon: <Home size={12} />,
              label: 'MONTHS RECORDED',
              value: String(actuals.length),
              color: actuals.length >= 3 ? BT.text.green : BT.text.amber,
            },
            {
              icon: <Activity size={12} />,
              label: 'AVG OCCUPANCY',
              value: (() => {
                const valid = actuals
                  .map(a => a.occupancy_rate ??
                    (a.occupied_units != null && a.total_units != null && a.total_units !== 0
                      ? a.occupied_units / a.total_units : null))
                  .filter((v): v is number => v != null);
                return valid.length ? fmtPct(valid.reduce((a, b) => a + b, 0) / valid.length) : '—';
              })(),
              color: BT.text.primary,
            },
            {
              icon: <DollarSign size={12} />,
              label: 'AVG MONTHLY NOI',
              value: (() => {
                const valid = actuals.map(a => a.noi).filter((v): v is number => v != null);
                return valid.length ? fmt$(valid.reduce((a, b) => a + b, 0) / valid.length) : '—';
              })(),
              color: BT.text.primary,
            },
            {
              icon: <TrendingUp size={12} />,
              label: 'TIER 2 STATUS',
              value: actuals.length >= 3 ? 'ACTIVE' : `${actuals.length}/3`,
              color: actuals.length >= 3 ? BT.text.green : BT.text.amber,
            },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              padding: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: BT.text.muted, marginBottom: 4 }}>
                {icon}
                <span style={{ fontSize: 8, fontFamily: MONO, letterSpacing: 0.5 }}>{label}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: MONO }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonthlyActualsSection;
