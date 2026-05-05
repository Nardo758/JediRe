import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Lock, ChevronDown, ChevronRight, Link, Check, X, Info } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps, F9TaxData, F9TaxYear, F9DealFinancials } from './types';

const MONO = BT.font.mono;

const fmtDlr = (n: number | null | undefined): string => {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};
const fmtMills = (n: number | null | undefined): string =>
  n == null ? '—' : `${Number(n).toFixed(2)} mills`;
const fmtPct = (n: number | null | undefined): string =>
  n == null ? '—' : `${(Number(n) * 100).toFixed(1)}%`;
const fmtPctRaw = (n: number | null | undefined): string =>
  n == null ? '—' : `${(Number(n) * 100).toFixed(2)}%`;

const SEC_COLORS: Record<string, string> = {
  A: BT.text.amber,
  B: BT.text.cyan,
  C: BT.text.purple,
  D: BT.text.teal,
};

function SectionHeader({ id, title, subtitle, collapsed, onToggle }: {
  id: string; title: string; subtitle?: string;
  collapsed: boolean; onToggle: () => void;
}) {
  return (
    <tr
      onClick={onToggle}
      style={{ background: BT.bg.header, cursor: 'pointer', userSelect: 'none' }}
    >
      <td colSpan={6} style={{ padding: '6px 12px', borderBottom: `1px solid ${BT.border.medium}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {collapsed
            ? <ChevronRight style={{ width: 10, height: 10, color: BT.text.muted }} />
            : <ChevronDown  style={{ width: 10, height: 10, color: BT.text.muted }} />
          }
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: SEC_COLORS[id], letterSpacing: 1 }}>
            {id}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, letterSpacing: 0.5 }}>
            {title}
          </span>
          {subtitle && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{subtitle}</span>
          )}
        </span>
      </td>
    </tr>
  );
}

function ColHeader() {
  return (
    <tr style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
      <th style={{ padding: '4px 12px', textAlign: 'left', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.8, minWidth: 220, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 2, borderRight: `1px solid ${BT.border.subtle}` }}>
        METRIC
      </th>
      {(['BROKER / T-12', 'PLATFORM', 'USER', 'RESOLVED'] as const).map(col => (
        <th key={col} style={{ padding: '4px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.8, minWidth: 130, borderRight: `1px solid ${BT.border.subtle}` }}>
          {col}
        </th>
      ))}
    </tr>
  );
}

function TaxRow({ label, broker, platform, user, resolved, userEditable = false, onUserChange, format = fmtDlr, locked = false, sub, platformTooltip }: {
  label: string;
  broker: number | null | undefined;
  platform: number | null | undefined;
  user: number | null;
  resolved: number | null | undefined;
  userEditable?: boolean;
  onUserChange?: (v: number | null) => void;
  format?: (n: number | null | undefined) => string;
  locked?: boolean;
  sub?: string;
  platformTooltip?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (!userEditable || locked) return;
    setDraft(user != null ? String(user) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    setEditing(false);
    const v = parseFloat(draft);
    if (isNaN(v)) { onUserChange?.(null); return; }
    onUserChange?.(v);
  };

  const hasUser = user != null;
  const resolvedDisplay = resolved ?? platform ?? broker;

  return (
    <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, height: 28 }}>
      <td style={{ padding: '3px 12px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary, position: 'sticky', left: 0, background: BT.bg.panel, zIndex: 1, borderRight: `1px solid ${BT.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {locked && <Lock style={{ width: 8, height: 8, color: BT.text.muted, flexShrink: 0 }} />}
          <span>{label}</span>
        </div>
        {sub && <div style={{ fontSize: 7, color: BT.text.muted, marginTop: 1 }}>{sub}</div>}
      </td>
      {/* Broker */}
      <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.amber, borderRight: `1px solid ${BT.border.subtle}` }}>
        {format(broker)}
      </td>
      {/* Platform — LayeredValue tooltip when provenance is available */}
      <td
        title={platformTooltip}
        style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.cyan, borderRight: `1px solid ${BT.border.subtle}`, cursor: platformTooltip ? 'help' : 'default' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {format(platform)}
          {platformTooltip && (
            <Info style={{ width: 8, height: 8, color: `${BT.text.cyan}80`, flexShrink: 0 }} />
          )}
        </span>
      </td>
      {/* User */}
      <td
        style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, borderRight: `1px solid ${BT.border.subtle}`, cursor: userEditable && !locked ? 'pointer' : 'default' }}
        onClick={startEdit}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            style={{ width: 80, background: BT.bg.input, border: `1px solid ${BT.border.bright}`, color: BT.text.white, fontFamily: MONO, fontSize: 10, padding: '1px 4px', borderRadius: 2 }}
          />
        ) : (
          <span style={{ color: hasUser ? BT.text.green : BT.text.muted }}>
            {hasUser ? format(user) : (userEditable ? <span style={{ fontSize: 8, color: BT.text.muted }}>click</span> : '—')}
          </span>
        )}
      </td>
      {/* Resolved */}
      <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: hasUser ? BT.text.green : BT.text.primary, fontWeight: hasUser ? 700 : 400 }}>
        {format(resolvedDisplay)}
        {hasUser && <span style={{ fontSize: 7, color: BT.text.green, marginLeft: 3 }}>USR</span>}
      </td>
    </tr>
  );
}

// ── RATES Modal ───────────────────────────────────────────────────────────────

interface RsSourceCitation { field: string; source_url: string; retrieved_at: string; document_title?: string }
interface RsMillageLine   { authority: string; rate: number; applies_to?: string }
interface RsMillage       { aggregate?: number; breakdown?: RsMillageLine[] }
interface RsTpp           { taxed: boolean; millage?: number | 'same_as_re'; exemption_amount?: number; filing_form?: string; filing_deadline?: string; name?: string }
interface RsTransferTax   { deed_rate_per_100?: number; deed_rate_per_1000?: number; intangible_rate_per_100?: number; mortgage_stamp_rate_per_100?: number; recording_fee_per_page?: number }
interface RsBonusDepEntry { year: number; pct: number }
interface RsStateIncomeTaxRate { entity_type: string; rate: number }
interface RateSheetData {
  jurisdiction: string; level: string; year: number; version: string;
  as_of: string; valid_through: string;
  source_citations: RsSourceCitation[];
  millage?: RsMillage;
  assessment_ratio?: number;
  tpp?: RsTpp;
  transfer_tax?: RsTransferTax;
  bonus_depreciation?: RsBonusDepEntry[];
  cost_seg_available_pct?: number;
  state_income_tax_rate?: RsStateIncomeTaxRate[];
  conforms_to_bonus_dep?: boolean;
  conforms_to_cost_seg?: boolean;
}

function staleBadge(validThrough: string) {
  const ms = new Date(validThrough).getTime() - Date.now();
  const d  = Math.max(0, Math.floor(ms / 86400000));
  if (d <= 0)  return { label: 'EXPIRED',   color: '#FF4757' };
  if (d <= 14) return { label: `${d}d LEFT`, color: '#FF6B35' };
  if (d <= 30) return { label: `${d}d LEFT`, color: '#FFB300' };
  return { label: `${d}d LEFT`, color: '#10B981' };
}

function RateFieldRow({ label, value, fieldKey, citations }: {
  label: string; value: React.ReactNode; fieldKey: string; citations: RsSourceCitation[];
}) {
  const cite = citations.find(c => c.field === fieldKey);
  return (
    <tr style={{ borderBottom: `1px solid ${BT.border.subtle}`, height: 24 }}>
      <td style={{ padding: '3px 10px', fontSize: 9, color: BT.text.muted, whiteSpace: 'nowrap', width: 220 }}>{label}</td>
      <td style={{ padding: '3px 10px', fontSize: 9, color: BT.text.cyan, fontWeight: 600, fontFamily: MONO }}>{value}</td>
      <td style={{ padding: '3px 10px', fontSize: 8 }}>
        {cite ? (
          <a href={cite.source_url} target="_blank" rel="noreferrer"
            style={{ color: BT.text.secondary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
            title={cite.document_title ?? cite.source_url}
          >
            <Link style={{ width: 8, height: 8 }} />
            {cite.document_title ?? new URL(cite.source_url).hostname}
          </a>
        ) : (
          <span style={{ color: BT.text.muted }}>—</span>
        )}
      </td>
    </tr>
  );
}

function RatesSheetPanel({ sheet }: { sheet: RateSheetData }) {
  const cites = sheet.source_citations ?? [];
  const badge = staleBadge(sheet.valid_through);
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Sheet header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, borderTop: `1px solid ${BT.border.medium}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.6 }}>
          {sheet.level.toUpperCase()} — {sheet.jurisdiction.toUpperCase()}
        </span>
        <span style={{ fontSize: 8, color: BT.text.muted }}>v{sheet.version} · {sheet.year}</span>
        <span style={{ fontSize: 8, color: BT.text.muted }}>as of {new Date(sheet.as_of).toLocaleDateString()}</span>
        <span style={{ fontSize: 7, padding: '1px 6px', background: `${badge.color}25`, border: `1px solid ${badge.color}50`, borderRadius: 3, color: badge.color, fontWeight: 700, marginLeft: 'auto' }}>
          {badge.label}
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr style={{ background: BT.bg.panelAlt }}>
            <th style={{ padding: '4px 10px', textAlign: 'left', color: BT.text.muted, fontSize: 7, fontWeight: 700, letterSpacing: 0.5, width: 220 }}>FIELD</th>
            <th style={{ padding: '4px 10px', textAlign: 'left', color: BT.text.muted, fontSize: 7, fontWeight: 700, letterSpacing: 0.5 }}>VALUE</th>
            <th style={{ padding: '4px 10px', textAlign: 'left', color: BT.text.muted, fontSize: 7, fontWeight: 700, letterSpacing: 0.5 }}>SOURCE</th>
          </tr>
        </thead>
        <tbody>
          {/* Section A */}
          {(sheet.millage?.aggregate != null || sheet.assessment_ratio != null) && (<>
            <tr><td colSpan={3} style={{ padding: '5px 10px 2px', fontSize: 7, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.8, background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>A · REAL ESTATE TAX</td></tr>
            {sheet.millage?.aggregate != null && (
              <RateFieldRow label="Millage rate (aggregate)" value={`${sheet.millage.aggregate.toFixed(4)} mills`} fieldKey="millage.aggregate" citations={cites} />
            )}
            {sheet.millage?.breakdown?.map((line, i) => (
              <RateFieldRow key={i} label={`  ${line.authority}${line.applies_to && line.applies_to !== 'all' ? ` (${line.applies_to})` : ''}`} value={`${line.rate.toFixed(4)} mills`} fieldKey={`millage.breakdown.${i}`} citations={cites} />
            ))}
            {sheet.assessment_ratio != null && (
              <RateFieldRow label="Assessment ratio" value={`${(sheet.assessment_ratio * 100).toFixed(0)}%`} fieldKey="assessment_ratio" citations={cites} />
            )}
          </>)}

          {/* Section B */}
          {sheet.tpp && (<>
            <tr><td colSpan={3} style={{ padding: '5px 10px 2px', fontSize: 7, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.8, background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>B · TANGIBLE PERSONAL PROPERTY</td></tr>
            <RateFieldRow label="TPP taxed" value={sheet.tpp.taxed ? 'YES' : 'NO'} fieldKey="tpp.taxed" citations={cites} />
            {sheet.tpp.millage != null && (
              <RateFieldRow label="TPP millage" value={sheet.tpp.millage === 'same_as_re' ? 'same as RE' : `${sheet.tpp.millage} mills`} fieldKey="tpp.millage" citations={cites} />
            )}
            {sheet.tpp.exemption_amount != null && (
              <RateFieldRow label="Exemption threshold" value={`$${sheet.tpp.exemption_amount.toLocaleString()}`} fieldKey="tpp.exemption_amount" citations={cites} />
            )}
            {sheet.tpp.filing_form && (
              <RateFieldRow label="Filing form" value={`${sheet.tpp.filing_form}${sheet.tpp.filing_deadline ? ` · due ${sheet.tpp.filing_deadline}` : ''}`} fieldKey="tpp.filing_form" citations={cites} />
            )}
          </>)}

          {/* Section C — federal fields */}
          {(sheet.bonus_depreciation?.length || sheet.cost_seg_available_pct != null || sheet.conforms_to_bonus_dep != null) && (<>
            <tr><td colSpan={3} style={{ padding: '5px 10px 2px', fontSize: 7, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.8, background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>C · INCOME TAX &amp; DEPRECIATION</td></tr>
            {sheet.cost_seg_available_pct != null && (
              <RateFieldRow label="Cost seg available %" value={`${(sheet.cost_seg_available_pct * 100).toFixed(0)}%`} fieldKey="cost_seg_available_pct" citations={cites} />
            )}
            {sheet.bonus_depreciation?.map(bd => (
              <RateFieldRow key={bd.year} label={`Bonus depreciation ${bd.year}`} value={`${(bd.pct * 100).toFixed(0)}%`} fieldKey={`bonus_depreciation.${bd.year}`} citations={cites} />
            ))}
            {sheet.conforms_to_bonus_dep != null && (
              <RateFieldRow label="Conforms to federal bonus dep" value={sheet.conforms_to_bonus_dep ? 'YES' : 'NO'} fieldKey="conforms_to_bonus_dep" citations={cites} />
            )}
            {sheet.conforms_to_cost_seg != null && (
              <RateFieldRow label="Conforms to cost segregation" value={sheet.conforms_to_cost_seg ? 'YES' : 'NO'} fieldKey="conforms_to_cost_seg" citations={cites} />
            )}
            {sheet.state_income_tax_rate?.map(s => (
              <RateFieldRow key={s.entity_type} label={`State income tax (${s.entity_type})`} value={`${(s.rate * 100).toFixed(2)}%`} fieldKey={`state_income_tax_rate.${s.entity_type}`} citations={cites} />
            ))}
          </>)}

          {/* Section D */}
          {sheet.transfer_tax && (<>
            <tr><td colSpan={3} style={{ padding: '5px 10px 2px', fontSize: 7, color: BT.text.muted, fontWeight: 700, letterSpacing: 0.8, background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>D · TRANSFER TAX</td></tr>
            {sheet.transfer_tax.deed_rate_per_100 != null && (
              <RateFieldRow label="Deed rate per $100" value={`$${sheet.transfer_tax.deed_rate_per_100.toFixed(4)}`} fieldKey="transfer_tax.deed_rate_per_100" citations={cites} />
            )}
            {sheet.transfer_tax.deed_rate_per_1000 != null && (
              <RateFieldRow label="Deed rate per $1,000" value={`$${sheet.transfer_tax.deed_rate_per_1000.toFixed(4)}`} fieldKey="transfer_tax.deed_rate_per_1000" citations={cites} />
            )}
            {sheet.transfer_tax.intangible_rate_per_100 != null && (
              <RateFieldRow label="Intangible tax per $100" value={`$${sheet.transfer_tax.intangible_rate_per_100.toFixed(4)}`} fieldKey="transfer_tax.intangible_rate_per_100" citations={cites} />
            )}
            {sheet.transfer_tax.mortgage_stamp_rate_per_100 != null && (
              <RateFieldRow label="Mortgage stamp per $100" value={`$${sheet.transfer_tax.mortgage_stamp_rate_per_100.toFixed(4)}`} fieldKey="transfer_tax.mortgage_stamp_rate_per_100" citations={cites} />
            )}
            {sheet.transfer_tax.recording_fee_per_page != null && (
              <RateFieldRow label="Recording fee / page" value={`$${sheet.transfer_tax.recording_fee_per_page.toFixed(2)}`} fieldKey="transfer_tax.recording_fee_per_page" citations={cites} />
            )}
          </>)}
        </tbody>
      </table>
    </div>
  );
}

function RatesModal({ open, onClose, jurisdiction }: {
  open: boolean;
  onClose: () => void;
  jurisdiction: string;
}) {
  const [sheets, setSheets]   = useState<RateSheetData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Normalize jurisdiction for API (lowercase, replace spaces with dashes)
  const normalizedJur = jurisdiction.toLowerCase().replace(/\s+/g, '-').split('-')[0];

  useEffect(() => {
    if (!open || sheets !== null) return;
    setLoading(true);
    setError(null);

    // Fetch both the state sheet and (optionally) the county overlay in parallel
    const stateJur = normalizedJur;
    const countyJur = jurisdiction.toLowerCase().replace(/\s+/g, '-');

    const fetchSheet = (jur: string) => apiClient
      .get(`/api/v1/tax/rate-sheets/${jur}`)
      .then((res: any) => res.data?.data as RateSheetData)
      .catch(() => null);

    Promise.all([
      fetchSheet(stateJur),
      countyJur !== stateJur ? fetchSheet(countyJur) : Promise.resolve(null),
    ]).then(([stateSheet, countySheet]) => {
      const loaded: RateSheetData[] = [];
      if (stateSheet) loaded.push(stateSheet);
      if (countySheet) loaded.push(countySheet);
      if (!loaded.length) setError('No rate sheet found for this jurisdiction.');
      else setSheets(loaded);
    }).catch((e: any) => setError(e?.message ?? 'Failed to load rate sheets'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: '#00000085', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: BT.bg.panel, border: `1px solid ${BT.border.medium}`, borderRadius: 6, width: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: MONO }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0, borderRadius: '6px 6px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8 }}>F9 · RATE SHEETS</span>
            <span style={{ fontSize: 8, color: BT.text.muted }}>Active jurisdiction: {jurisdiction.toUpperCase()}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.muted, padding: 2 }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 24, fontSize: 10, color: BT.text.muted }}>Loading rate sheets…</div>
          )}
          {error && (
            <div style={{ padding: 12, background: '#FF475715', border: `1px solid #FF475740`, borderRadius: 4, fontSize: 9, color: BT.text.red }}>
              {error}
            </div>
          )}
          {sheets && sheets.map((s, i) => (
            <RatesSheetPanel key={`${s.jurisdiction}-${i}`} sheet={s} />
          ))}
        </div>

        {/* Modal footer */}
        <div style={{ padding: '7px 16px', borderTop: `1px solid ${BT.border.medium}`, fontSize: 8, color: BT.text.muted, flexShrink: 0, borderRadius: '0 0 6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Loaded from <span style={{ color: BT.text.cyan }}>services/tax/rateSheets/*.json</span> at server boot. Re-deploy to refresh.</span>
          {sheets && <span style={{ color: BT.text.muted }}>{sheets.reduce((a, s) => a + (s.source_citations?.length ?? 0), 0)} source citations</span>}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 14px', background: BT.bg.panel, borderRight: `1px solid ${BT.border.subtle}` }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: color ?? BT.text.amber }}>{value}</span>
    </div>
  );
}

function AssessmentGrid({ perYear, hasCap, capPct }: { perYear: F9TaxYear[]; hasCap: boolean; capPct: number }) {
  if (!perYear.length) return null;
  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto', borderBottom: `1px solid ${BT.border.medium}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                {(['YEAR', 'ASSESSED VALUE', 'MILLAGE', 'RE TAX', hasCap ? 'CAP' : 'GROWTH', 'EVENT'] as const).map(h => (
                  <th key={h} style={{ padding: '4px 10px', textAlign: 'center', color: BT.text.muted, letterSpacing: 0.5, fontWeight: 700, borderRight: `1px solid ${BT.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perYear.map(row => (
                <tr
                  key={row.year}
                  style={{
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    borderLeft: row.reassessmentEvent ? `3px solid ${BT.text.red}` : undefined,
                    background: row.reassessmentEvent ? '#FF475710' : undefined,
                  }}
                >
                  <td style={{ padding: '3px 10px', textAlign: 'center', color: BT.text.secondary, fontWeight: 700 }}>Y{row.year}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.primary }}>{fmtDlr(row.assessedValue)}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'center', color: BT.text.muted }}>{fmtMills(row.millageRate)}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.amber, fontWeight: 700 }}>{fmtDlr(row.taxAmount)}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'center' }}>
                    {hasCap
                      ? row.sohCapBinding
                        ? (
                          <span
                            title={`${(capPct * 100).toFixed(0)}% annual cap binding — assessed value growth is limited`}
                            style={{ color: BT.text.red, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'help' }}
                          >
                            <Lock style={{ width: 8, height: 8 }} />CAP
                          </span>
                        )
                        : <span style={{ color: BT.text.green }}>—</span>
                      : <span style={{ color: BT.text.muted }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '3px 10px', textAlign: 'center' }}>
                    {row.reassessmentEvent
                      ? <span style={{ color: BT.text.red, fontSize: 8, fontWeight: 700 }}>REASSESS</span>
                      : <span style={{ color: BT.text.muted }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function DeprecSchedule({ taxes, costSeg, f9Financials }: {
  taxes: F9TaxData;
  costSeg: boolean;
  f9Financials: F9DealFinancials | null | undefined;
}) {
  const { incomeTax } = taxes;
  const holdYears = taxes.reTax.perYear.length || 5;
  const { annualDepreciation, depreciableBase, costSegAvailablePct } = incomeTax;

  const y1NoiRow = f9Financials?.proforma?.year1?.find(r => r.field === 'noi');
  const y1Noi = y1NoiRow?.resolved ?? y1NoiRow?.platform ?? null;
  const rentGrowth = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const loanAmount = f9Financials?.capitalStack?.loanAmount ?? null;
  const interestRate = f9Financials?.capitalStack?.interestRate ?? null;
  const annualInterest = loanAmount != null && interestRate != null ? Math.round(loanAmount * interestRate) : null;
  const bonusDepPct = incomeTax.bonusDepreciationCurrentYearPct ?? 0.20;
  const bonusBasis = (costSeg && depreciableBase != null)
    ? Math.round(depreciableBase * costSegAvailablePct * bonusDepPct)
    : 0;

  const rows = useMemo(() => {
    if (!depreciableBase || !annualDepreciation) return [];
    return Array.from({ length: holdYears }, (_, i) => {
      const yr = i + 1;
      const deprec = yr === 1
        ? Math.round(annualDepreciation + bonusBasis)
        : annualDepreciation;
      const cumDepreciation = Math.min(
        annualDepreciation * yr + bonusBasis,
        depreciableBase,
      );
      const noi = y1Noi != null ? Math.round(y1Noi * Math.pow(1 + rentGrowth, yr - 1)) : null;
      const taxableIncome = noi != null && annualInterest != null
        ? noi - annualInterest - deprec
        : null;
      const marginalRate = taxes.incomeTax.marginalTaxRate > 0 ? taxes.incomeTax.marginalTaxRate : 0.37;
      const taxPayable = taxableIncome != null ? Math.round(Math.max(0, taxableIncome) * marginalRate) : null;
      const taxShield = Math.round(deprec * marginalRate);
      return {
        yr,
        noi,
        annualInterest,
        deprec,
        taxableIncome,
        taxPayable,
        taxShield,
        cumDepreciation: Math.round(cumDepreciation),
      };
    });
  }, [depreciableBase, annualDepreciation, bonusBasis, holdYears, y1Noi, rentGrowth, annualInterest]);

  if (!rows.length) return (
    <tr><td colSpan={6} style={{ padding: '12px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No purchase price — depreciation unavailable.</td></tr>
  );

  const displayRatePct = Math.round((taxes.incomeTax.marginalTaxRate > 0 ? taxes.incomeTax.marginalTaxRate : 0.37) * 100);
  const COLS = ['YR', 'NOI (EST)', 'INTEREST EXP', 'DEPRECIATION', 'TAXABLE INCOME', `TAX PAYABLE (${displayRatePct}%)`, 'CUMUL DEPREC'];

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto', borderBottom: `1px solid ${BT.border.medium}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                {COLS.map(h => (
                  <th key={h} style={{ padding: '4px 10px', textAlign: 'center', color: BT.text.muted, letterSpacing: 0.5, fontWeight: 700, borderRight: `1px solid ${BT.border.subtle}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.yr} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '3px 10px', textAlign: 'center', color: BT.text.secondary, fontWeight: 700 }}>Y{r.yr}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.cyan }}>{fmtDlr(r.noi)}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.amber }}>{fmtDlr(r.annualInterest)}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.purple }}>{fmtDlr(r.deprec)}{r.yr === 1 && bonusBasis > 0 ? <span style={{ fontSize: 7, color: BT.text.muted, marginLeft: 3 }}>+BONUS</span> : null}</td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: r.taxableIncome == null ? BT.text.muted : r.taxableIncome < 0 ? BT.text.green : BT.text.red, fontWeight: 700 }}>
                    {r.taxableIncome != null ? fmtDlr(r.taxableIncome) : '—'}
                    {r.taxableIncome != null && r.taxableIncome < 0 && <span style={{ fontSize: 7, marginLeft: 3 }}>LOSS</span>}
                  </td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: r.taxPayable == null ? BT.text.muted : r.taxPayable > 0 ? BT.text.red : BT.text.green, fontWeight: 700 }}>
                    {r.taxPayable != null ? (r.taxPayable === 0 ? '$0 (LOSS)' : fmtDlr(r.taxPayable)) : '—'}
                  </td>
                  <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted }}>{fmtDlr(r.cumDepreciation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

// ── Jurisdiction helpers ──────────────────────────────────────────────────────

/** Extract the state code from the jurisdiction string (e.g. "GA-Fulton" → "GA") */
function parseState(jurisdiction: string | undefined): string {
  if (!jurisdiction) return '';
  return jurisdiction.split('-')[0].toUpperCase();
}

/** True only for FL deals — county toggle and SOH cap UI are FL-specific */
function isFL(state: string): boolean { return state === 'FL'; }

/**
 * Build a short county display label for the KPI tile and header badge.
 * Examples:
 *   GA-Fulton       → "Fulton Co."
 *   FL-Miami-Dade   → "Miami-Dade"
 *   TX-Harris       → "Harris Co."
 *   FL (statewide)  → "FL Statewide"
 */
function countyDisplayLabel(taxes: F9TaxData | null, isMiamiDadeEffective: boolean, state: string): string {
  if (!taxes) return '—';
  if (isFL(state)) {
    return isMiamiDadeEffective ? 'Miami-Dade' : 'FL Statewide';
  }
  const county = taxes.countyLabel;
  if (county) {
    // countyLabel is e.g. "Fulton County" — shorten to "Fulton Co."
    return county.replace(/ County$/i, ' Co.');
  }
  return state ? `${state} Statewide` : '—';
}

/**
 * Default millage rate for client-side override preview.
 * Use the backend-computed Y1 millage from perYear[0] when available
 * (this is always jurisdiction-correct), falling back to 0.
 */
function defaultMillageFromBackend(taxes: F9TaxData | null): number {
  return taxes?.reTax.perYear[0]?.millageRate ?? 0;
}

export function TaxesTab({ dealId, f9Financials, onTabChange, onF9Refresh }: FinancialEngineTabProps) {
  const taxes = f9Financials?.taxes ?? null;
  const dealName = f9Financials?.dealName ?? 'Deal';

  const state = parseState(taxes?.jurisdiction);
  const isFlDeal = isFL(state);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [costSeg, setCostSeg] = useState(true);
  const [ratesOpen, setRatesOpen] = useState(false);
  // countyOverride: FL-only toggle (null = auto, true = Miami-Dade, false = statewide)
  const [countyOverride, setCountyOverride] = useState<boolean | null>(taxes?.userOverrides?.taxCounty ?? null);

  const [userAssessedValue, setUserAssessedValue] = useState<number | null>(taxes?.userOverrides?.taxAssessedValue ?? null);
  const [userMillageRate, setUserMillageRate]       = useState<number | null>(taxes?.userOverrides?.taxMillageRate   ?? null);
  const [userTppAmount, setUserTppAmount]           = useState<number | null>(taxes?.userOverrides?.tppAmount ?? null);

  // Sync local state when async f9Financials arrives after mount
  useEffect(() => {
    if (taxes?.userOverrides) {
      setCountyOverride(prev        => prev ?? (taxes.userOverrides.taxCounty        ?? null));
      setUserAssessedValue(prev     => prev ?? (taxes.userOverrides.taxAssessedValue ?? null));
      setUserMillageRate(prev       => prev ?? (taxes.userOverrides.taxMillageRate   ?? null));
      setUserTppAmount(prev         => prev ?? (taxes.userOverrides.tppAmount        ?? null));
    }
  }, [taxes?.userOverrides]);

  // isMiamiDade: only meaningful for FL deals
  const isMiamiDade = isFlDeal
    ? (countyOverride ?? taxes?.reTax.isMiamiDade ?? false)
    : false;

  // Effective millage: user override → backend Y1 millage (jurisdiction-correct)
  // For FL, adjust between Miami-Dade and statewide when user hasn't locked a rate
  const backendMillage = defaultMillageFromBackend(taxes);
  const effMillageRate: number = userMillageRate ?? (
    isFlDeal
      ? (isMiamiDade ? 23.09 : 20.00)
      : backendMillage
  );

  const effAssessedValue = userAssessedValue ?? taxes?.reTax.platformAssessedValue ?? null;
  const effAnnualTax = effAssessedValue != null ? Math.round(effAssessedValue * (effMillageRate / 1000)) : null;

  const effectiveTaxRate = effAnnualTax != null && f9Financials?.capitalStack?.purchasePrice != null
    ? effAnnualTax / f9Financials.capitalStack.purchasePrice : null;

  // Client-side assessment projection — uses jurisdiction-correct growth from backend.
  // For FL: SOH cap applies (market growth exceeds cap so cap binds after Y1).
  // For GA/TX/others: no cap — just use the ruleset's assessment growth rate.
  const sohCapPct   = taxes?.reTax.sohCapPct ?? 0;
  const hasCap      = sohCapPct > 0;
  // assessmentGrowthPct: comes from backend (derived from ruleset Y1→Y2 ratio).
  // For FL we use the known 12% market assumption (cap-limited to sohCapPct).
  const FL_MARKET_GROWTH = 0.12;
  const assessGrowth = isFlDeal
    ? FL_MARKET_GROWTH
    : (taxes?.assessmentGrowthPct ?? 0);

  const computedPerYear: F9TaxYear[] = useMemo(() => {
    const baseAssessed = effAssessedValue;
    if (!baseAssessed) return taxes?.reTax.perYear ?? [];
    const numYears = Math.max(taxes?.reTax.perYear.length ?? 10, 10);
    const rows: F9TaxYear[] = [];
    let prevCapped = baseAssessed;

    for (let yr = 1; yr <= numYears; yr++) {
      let assessedValue: number;
      let sohCapBinding = false;

      if (yr === 1) {
        assessedValue = baseAssessed;
        prevCapped = baseAssessed;
      } else if (hasCap) {
        // FL-style cap
        const marketValue = baseAssessed * Math.pow(1 + assessGrowth, yr - 1);
        const capLimited = Math.min(marketValue, prevCapped * (1 + sohCapPct));
        sohCapBinding = marketValue > capLimited + 1;
        assessedValue = Math.round(capLimited);
        prevCapped = capLimited;
      } else {
        // No cap — simple annual growth (GA 4%, TX full-reassess, etc.)
        assessedValue = Math.round(prevCapped * (1 + assessGrowth));
        prevCapped = assessedValue;
      }

      rows.push({
        year: yr,
        assessedValue,
        millageRate: effMillageRate,
        taxAmount: Math.round(assessedValue * (effMillageRate / 1000)),
        sohCapBinding,
        reassessmentEvent: yr === 1,
      });
    }
    return rows;
  }, [effAssessedValue, effMillageRate, hasCap, sohCapPct, assessGrowth, taxes?.reTax.perYear]);

  // Debounced PATCH helper
  const patchTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const patchField = useCallback((field: string, value: number | null) => {
    clearTimeout(patchTimeouts.current[field]);
    patchTimeouts.current[field] = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field, year: 1, value });
        onF9Refresh?.();
      } catch { /* non-fatal */ }
    }, 600);
  }, [dealId, onF9Refresh]);

  const handleAssessedValue = (v: number | null) => { setUserAssessedValue(v); patchField('taxAssessedValue', v); };
  const handleMillageRate   = (v: number | null) => { setUserMillageRate(v);   patchField('taxMillageRate', v); };
  const handleTppAmount     = (v: number | null) => { setUserTppAmount(v);     patchField('tppAmount', v); };

  const toggle = (id: string) => setCollapsed(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // Transfer tax — use backend values directly (they are jurisdiction-correct from the ruleset)
  const backendDocStamps   = taxes?.transferTax.docStampAmount ?? null;
  const backendIntangible  = taxes?.transferTax.intangibleTaxAmount ?? null;
  const backendTransferTotal = taxes?.transferTax.totalTransferTax ?? null;
  const appliedTransferRate  = taxes?.transferTax.appliedRatePct ?? null;

  // Delta vs T-12
  const t12AnnualTax = taxes?.reTax.t12AnnualTax ?? null;
  const deltaVsT12 = effAnnualTax != null && t12AnnualTax != null && t12AnnualTax > 0
    ? (effAnnualTax - t12AnnualTax) / t12AnnualTax
    : taxes?.reTax.deltaVsT12Pct ?? null;
  const largeDelta = deltaVsT12 != null && Math.abs(deltaVsT12) > 0.30;

  // Header badge and county KPI label
  const countyKpiLabel = countyDisplayLabel(taxes, isMiamiDade, state);

  // Badge: FL shows Miami-Dade/Statewide; other states show county or state
  const badgeLabel = isFlDeal
    ? (isMiamiDade ? 'MIAMI-DADE RATES' : 'FL STATEWIDE')
    : (taxes?.countyLabel ? taxes.countyLabel.toUpperCase() : (state ? `${state} RATES` : 'RATES'));
  const badgeIsMiamiDade = isFlDeal && isMiamiDade;

  // Section A subtitle — jurisdiction-aware cap language
  const capLabel = hasCap
    ? `${state} ${(sohCapPct * 100).toFixed(0)}% Cap`
    : 'No Assessment Cap';
  const reassessLabel = 'Reassessment at acquisition';
  const millageLabel = `${state || 'County'} millage ${effMillageRate.toFixed(2)} mills`;
  const sectionASubtitle = `${capLabel} · ${reassessLabel} · ${millageLabel}`;

  // Section D subtitle — jurisdiction-aware transfer tax language
  const sectionDSubtitle = state === 'GA'
    ? 'GA deed transfer tax ($1.00 per $1,000 of purchase price)'
    : state === 'TX'
      ? 'TX — no state deed transfer tax (county recording fee only)'
      : isFlDeal
        ? 'FL documentary stamp tax on deed + intangible tax on mortgage'
        : `${state || 'State'} deed transfer tax`;

  if (!taxes && !f9Financials) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: BT.bg.terminal }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>Loading tax data…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal, color: BT.text.primary, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8 }}>F9 · TAXES</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{dealName}</span>
          <span style={{ fontFamily: MONO, fontSize: 8, padding: '2px 6px', background: badgeIsMiamiDade ? '#1A1A2E' : '#0A1A0A', border: `1px solid ${badgeIsMiamiDade ? '#3B3B8B' : '#1A3B1A'}`, borderRadius: 3, color: badgeIsMiamiDade ? BT.text.purple : BT.text.green }}>
            {badgeLabel}
          </span>
          {taxes?.millageSource === 'live' && (
            <span style={{ fontFamily: MONO, fontSize: 7, padding: '1px 5px', background: '#0A1F1A', border: '1px solid #1A5C3A', borderRadius: 3, color: '#4AE8A0', letterSpacing: 0.5 }}>
              LIVE DATA
            </span>
          )}
          {taxes?.millageSource === 'user' && (
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>user override</span>
          )}
          {isFlDeal && countyOverride == null && taxes?.reTax.isMiamiDade && (
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>auto-detected</span>
          )}
          {isFlDeal && countyOverride != null && (
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>overridden</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* RATES pill — opens rate sheet coverage modal */}
          <button
            onClick={() => setRatesOpen(true)}
            style={{ padding: '2px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, background: '#0A1A2A', border: `1px solid #1A5C8A`, color: '#4A9FD0', borderRadius: 3, cursor: 'pointer', letterSpacing: 0.5 }}
            title="View active rate sheets and jurisdictions"
          >
            RATES
          </button>
          {isFlDeal ? (
            <>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>COUNTY:</span>
              <button
                onClick={() => { setCountyOverride(false); patchField('taxCounty', 0); }}
                style={{ padding: '2px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, background: !isMiamiDade ? BT.bg.active : BT.bg.panel, border: `1px solid ${!isMiamiDade ? BT.border.bright : BT.border.subtle}`, color: !isMiamiDade ? BT.text.white : BT.text.muted, borderRadius: 3, cursor: 'pointer' }}
              >
                STATEWIDE
              </button>
              <button
                onClick={() => { setCountyOverride(true); patchField('taxCounty', 1); }}
                style={{ padding: '2px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, background: isMiamiDade ? BT.bg.active : BT.bg.panel, border: `1px solid ${isMiamiDade ? BT.border.bright : BT.border.subtle}`, color: isMiamiDade ? BT.text.white : BT.text.muted, borderRadius: 3, cursor: 'pointer' }}
              >
                MIAMI-DADE
              </button>
              {countyOverride != null && (
                <button
                  onClick={() => { setCountyOverride(null); patchField('taxCounty', null); }}
                  title="Reset to auto-detected county"
                  style={{ padding: '2px 6px', fontFamily: MONO, fontSize: 8, fontWeight: 700, background: 'transparent', border: `1px solid ${BT.border.subtle}`, color: BT.text.amber, borderRadius: 3, cursor: 'pointer' }}
                >
                  ↺ AUTO
                </button>
              )}
            </>
          ) : (
            // Non-FL: show resolved county as read-only label
            taxes?.countyLabel && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                COUNTY: <span style={{ color: BT.text.green, fontWeight: 700 }}>{taxes.countyLabel.toUpperCase()}</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0 }}>
        <KpiTile label="Y1 RE TAX"          value={fmtDlr(effAnnualTax)}                          color={BT.text.amber} />
        <KpiTile label="EFFECTIVE TAX RATE"  value={fmtPct(effectiveTaxRate)}                      color={BT.text.orange} />
        <KpiTile label="DOC STAMPS"          value={fmtDlr(backendDocStamps)}                      color={BT.text.red} />
        <KpiTile label="ANNUAL DEPRECIATION" value={fmtDlr(taxes?.incomeTax.annualDepreciation)}   color={BT.text.purple} />
        <KpiTile label="TPP ESTIMATE"        value={fmtDlr(userTppAmount ?? taxes?.tpp.platform)}  color={BT.text.cyan} />
        <KpiTile label="COUNTY"              value={countyKpiLabel}                                color={badgeIsMiamiDade ? BT.text.purple : BT.text.green} />
      </div>

      {/* Red banner: Y1 RE tax spike > 30% vs T-12 */}
      {largeDelta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#FF475720', borderBottom: `1px solid ${BT.text.red}40`, flexShrink: 0 }}>
          <AlertTriangle style={{ width: 13, height: 13, color: BT.text.red, flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.red, fontWeight: 700 }}>
            ⚠ Y1 RE TAX DELTA: {deltaVsT12 != null ? ((deltaVsT12 >= 0 ? '+' : '') + (deltaVsT12 * 100).toFixed(1) + '%') : '—'} vs T-12 — POST-ACQUISITION REASSESSMENT. Review assessed value override.
          </span>
        </div>
      )}

      {/* Main table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <ColHeader />
          </thead>
          <tbody>
            {/* ── Section A: Real Estate Tax ──────────────────────────────────── */}
            <SectionHeader
              id="A" title="REAL ESTATE TAX"
              subtitle={sectionASubtitle}
              collapsed={collapsed.has('A')} onToggle={() => toggle('A')}
            />
            {!collapsed.has('A') && (
              <>
                <TaxRow
                  label="Assessed Value"
                  sub="T-12 = prior owner; Platform = post-acquisition reassessment"
                  broker={taxes?.reTax.t12AssessedValue}
                  platform={effAssessedValue}
                  user={userAssessedValue}
                  resolved={userAssessedValue ?? effAssessedValue}
                  userEditable
                  onUserChange={handleAssessedValue}
                  format={fmtDlr}
                  platformTooltip={taxes ? [
                    `Source: ${taxes.millageSource === 'live' ? 'live millage service' : taxes.millageSource === 'user' ? 'user override' : 'ruleset default'}`,
                    `Jurisdiction: ${taxes.jurisdiction ?? 'unknown'}`,
                    `Formula: purchasePrice used as post-acquisition assessed value`,
                    `Confidence: ${taxes.millageSource === 'live' ? 'high' : taxes.millageSource === 'user' ? 'high' : 'medium'}`,
                  ].join('\n') : undefined}
                />
                <TaxRow
                  label="Millage Rate"
                  sub={isFlDeal
                    ? (isMiamiDade ? 'Miami-Dade county: 23.09 mills' : 'FL statewide average: 20.00 mills')
                    : (taxes?.countyLabel ? `${taxes.countyLabel}: ${backendMillage.toFixed(2)} mills` : `${state} millage: ${backendMillage.toFixed(2)} mills`)
                  }
                  broker={taxes?.reTax.t12MillageRate}
                  platform={effMillageRate}
                  user={userMillageRate}
                  resolved={userMillageRate ?? effMillageRate}
                  userEditable
                  onUserChange={handleMillageRate}
                  format={fmtMills}
                  platformTooltip={taxes ? [
                    `Source: ${taxes.millageSource === 'live' ? 'live millage service (TX Comptroller / county PA)' : taxes.millageSource === 'user' ? 'user override' : 'ruleset hardcoded default'}`,
                    `Jurisdiction: ${taxes.jurisdiction ?? 'unknown'}`,
                    `Formula: ${taxes.reTax.isMiamiDade ? 'Miami-Dade overlay millage' : `${state} state ruleset millage`}`,
                    `Rate: ${effMillageRate.toFixed(2)} mills per $1,000 assessed value`,
                  ].join('\n') : undefined}
                />
                <TaxRow
                  label="Annual RE Tax (Y1)"
                  sub="Assessed Value × Millage / 1,000"
                  broker={taxes?.reTax.t12AnnualTax}
                  platform={effAnnualTax}
                  user={null}
                  resolved={effAnnualTax}
                  locked
                  format={fmtDlr}
                  platformTooltip={taxes && effAssessedValue != null ? [
                    `Formula: assessedValue × millageRate / 1,000`,
                    `Inputs: ${fmtDlr(effAssessedValue)} × ${effMillageRate.toFixed(2)} mills`,
                    `Source: tax_service_computed`,
                    taxes.reTax.deltaVsT12Pct != null
                      ? `Delta vs T-12: ${taxes.reTax.deltaVsT12Pct >= 0 ? '+' : ''}${(taxes.reTax.deltaVsT12Pct * 100).toFixed(1)}% (post-acquisition reassessment)`
                      : '',
                  ].filter(Boolean).join('\n') : undefined}
                />
                {/* Assessment Projection Grid */}
                <tr>
                  <td colSpan={6} style={{ padding: '4px 12px 2px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6, background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    {hasCap
                      ? `${state} ${(sohCapPct * 100).toFixed(0)}% CAP ENGINE`
                      : `${state || 'STATE'} ASSESSMENT GROWTH (${assessGrowth > 0 ? `+${(assessGrowth * 100).toFixed(0)}%/yr` : 'FULL REASSESS'})`
                    }
                    {' '}— Y1–Y{computedPerYear.length || 10} PROJECTION &nbsp;
                    <span style={{ color: BT.text.red }}>█ REASSESSMENT</span>
                    {hasCap && <>&nbsp;&nbsp;<span style={{ color: BT.text.muted }}>🔒 CAP BINDING</span></>}
                  </td>
                </tr>
                {computedPerYear.length > 0 ? (
                  <AssessmentGrid perYear={computedPerYear} hasCap={hasCap} capPct={sohCapPct} />
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                      No purchase price data — enter assessed value to generate projection.
                    </td>
                  </tr>
                )}
              </>
            )}

            {/* ── Section B: TPP ──────────────────────────────────────────────── */}
            <SectionHeader
              id="B" title="TANGIBLE PERSONAL PROPERTY (TPP)"
              subtitle={taxes?.tpp.tppTaxed === false
                ? 'Not taxed in this jurisdiction'
                : taxes?.tpp.tppFilingRequirement
                  ? `${taxes.tpp.tppFilingRequirement.formName} due ${taxes.tpp.tppFilingRequirement.deadline} · $${taxes.tpp.tppExemption?.toLocaleString() ?? '0'} exemption`
                  : 'Personal property tax on FF&E and appliances'}
              collapsed={collapsed.has('B')} onToggle={() => toggle('B')}
            />
            {!collapsed.has('B') && (
              <>
                {/* Section B metadata strip */}
                {taxes?.tpp.tppTaxed !== undefined && (
                  <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td colSpan={6} style={{ padding: '5px 12px', background: BT.bg.panelAlt }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontSize: 8 }}>
                        <span style={{ color: BT.text.muted }}>TPP TAXED:</span>
                        <span style={{ color: taxes.tpp.tppTaxed ? BT.text.amber : BT.text.green, fontWeight: 700 }}>
                          {taxes.tpp.tppTaxed ? 'YES' : 'NO — exempt jurisdiction'}
                        </span>
                        {taxes.tpp.tppExemption != null && taxes.tpp.tppExemption > 0 && (
                          <>
                            <span style={{ color: BT.text.muted }}>EXEMPTION THRESHOLD:</span>
                            <span style={{ color: BT.text.cyan }}>${taxes.tpp.tppExemption.toLocaleString()}</span>
                          </>
                        )}
                        {taxes.tpp.tppFilingRequirement && (
                          <>
                            <span style={{ color: BT.text.muted }}>FILING:</span>
                            <span style={{ color: BT.text.amber }}>
                              {taxes.tpp.tppFilingRequirement.formName} · due {taxes.tpp.tppFilingRequirement.deadline}
                              {taxes.tpp.tppFilingRequirement.penaltyPct > 0 && (
                                <span style={{ color: BT.text.red, marginLeft: 4 }}>
                                  ({(taxes.tpp.tppFilingRequirement.penaltyPct * 100).toFixed(0)}% late penalty)
                                </span>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                <TaxRow
                  label="TPP Annual Tax Estimate"
                  sub={taxes?.tpp.tppTaxed
                    ? `State ruleset tppTax() — ${taxes.tpp.tppExemption ? `$${taxes.tpp.tppExemption.toLocaleString()} exemption applied` : 'no exemption'}. Override with actual assessor bill.`
                    : 'FF&E + appliances × estimated millage. Override with actual assessor bill.'}
                  broker={taxes?.tpp.broker}
                  platform={taxes?.tpp.platform}
                  user={userTppAmount}
                  resolved={userTppAmount ?? taxes?.tpp.platform ?? taxes?.tpp.broker}
                  userEditable
                  onUserChange={handleTppAmount}
                  format={fmtDlr}
                  platformTooltip={taxes?.tpp.tppTaxed != null ? [
                    `Source: tax_service_computed (stateRuleset.tppTax())`,
                    `Jurisdiction taxes TPP: ${taxes.tpp.tppTaxed ? 'Yes' : 'No'}`,
                    taxes.tpp.tppExemption != null ? `Exemption threshold: $${taxes.tpp.tppExemption.toLocaleString()}` : '',
                    taxes.tpp.tppAnnualTax != null ? `Engine estimate: ${fmtDlr(taxes.tpp.tppAnnualTax)}` : '',
                  ].filter(Boolean).join('\n') : undefined}
                />
              </>
            )}

            {/* ── Section C: Income Tax / Depreciation ────────────────────────── */}
            <SectionHeader
              id="C" title="INCOME TAX & DEPRECIATION"
              subtitle="27.5-yr straight-line + bonus depreciation + cost segregation"
              collapsed={collapsed.has('C')} onToggle={() => toggle('C')}
            />
            {!collapsed.has('C') && (
              <>
                {/* Toggles row */}
                <tr style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
                  <td colSpan={6} style={{ padding: '6px 12px', background: BT.bg.panelAlt }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>COST SEG:</span>
                        {(['ON', 'OFF'] as const).map(v => (
                          <button key={v} onClick={() => setCostSeg(v === 'ON')}
                            style={{ padding: '2px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, background: (costSeg === (v === 'ON')) ? BT.bg.active : BT.bg.panel, border: `1px solid ${(costSeg === (v === 'ON')) ? BT.border.bright : BT.border.subtle}`, color: (costSeg === (v === 'ON')) ? BT.text.white : BT.text.muted, borderRadius: 3, cursor: 'pointer' }}>
                            {v}
                          </button>
                        ))}
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                        BONUS DEPREC: <span style={{ color: BT.text.purple, fontWeight: 700 }}>
                          {taxes?.incomeTax.bonusDepreciationCurrentYearPct != null
                            ? `${(taxes.incomeTax.bonusDepreciationCurrentYearPct * 100).toFixed(0)}%`
                            : '—'}
                        </span>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                        Depreciable Base: <span style={{ color: BT.text.purple }}>{fmtDlr(taxes?.incomeTax.depreciableBase)}</span>
                        &nbsp;({taxes?.incomeTax.landValuePct != null ? `${((1 - taxes.incomeTax.landValuePct) * 100).toFixed(0)}% of purchase price — ${(taxes.incomeTax.landValuePct * 100).toFixed(0)}% land excluded` : '80% of purchase price — 20% land excluded'})
                      </span>
                    </div>
                  </td>
                </tr>
                <TaxRow
                  label="Purchase Price"
                  broker={null}
                  platform={taxes?.incomeTax.purchasePrice}
                  user={null}
                  resolved={taxes?.incomeTax.purchasePrice}
                  locked
                  format={fmtDlr}
                />
                <TaxRow
                  label="Land Value (non-depreciable)"
                  sub={`${(taxes?.incomeTax.landValuePct ?? 0.20) * 100}% of purchase price excluded from depreciation`}
                  broker={null}
                  platform={taxes?.incomeTax.purchasePrice != null ? Math.round(taxes.incomeTax.purchasePrice * (taxes.incomeTax.landValuePct ?? 0.20)) : null}
                  user={null}
                  resolved={taxes?.incomeTax.purchasePrice != null ? Math.round(taxes.incomeTax.purchasePrice * (taxes.incomeTax.landValuePct ?? 0.20)) : null}
                  locked
                  format={fmtDlr}
                />
                <TaxRow
                  label="Depreciable Basis"
                  sub="Purchase Price × 80% — straight-line over 27.5 years"
                  broker={null}
                  platform={taxes?.incomeTax.depreciableBase}
                  user={null}
                  resolved={taxes?.incomeTax.depreciableBase}
                  locked
                  format={fmtDlr}
                />
                <TaxRow
                  label="Annual Straight-Line Depreciation"
                  sub="Depreciable basis ÷ 27.5 years"
                  broker={null}
                  platform={taxes?.incomeTax.annualDepreciation}
                  user={null}
                  resolved={taxes?.incomeTax.annualDepreciation}
                  locked
                  format={fmtDlr}
                />
                <TaxRow
                  label="Bonus Depreciation (Y1 cost seg)"
                  sub={`${costSeg ? `${taxes?.incomeTax.costSegAvailablePct != null ? (taxes.incomeTax.costSegAvailablePct * 100).toFixed(0) : 30}% of basis eligible × ${((taxes?.incomeTax.bonusDepreciationCurrentYearPct ?? 0.20) * 100).toFixed(0)}% bonus rate` : 'Cost seg OFF'}`}
                  broker={null}
                  platform={costSeg && taxes?.incomeTax.depreciableBase != null
                    ? Math.round(taxes.incomeTax.depreciableBase * (taxes.incomeTax.costSegAvailablePct ?? 0.30) * (taxes.incomeTax.bonusDepreciationCurrentYearPct ?? 0.20))
                    : null}
                  user={null}
                  resolved={costSeg && taxes?.incomeTax.depreciableBase != null
                    ? Math.round(taxes.incomeTax.depreciableBase * (taxes.incomeTax.costSegAvailablePct ?? 0.30) * (taxes.incomeTax.bonusDepreciationCurrentYearPct ?? 0.20))
                    : null}
                  locked
                  format={fmtDlr}
                />
                {/* Depreciation schedule sub-table */}
                <tr>
                  <td colSpan={6} style={{ padding: '4px 12px 2px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6, background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    DEPRECIATION SCHEDULE — HOLD PERIOD
                  </td>
                </tr>
                {taxes ? (
                  <DeprecSchedule taxes={taxes} costSeg={costSeg} f9Financials={f9Financials} />
                ) : (
                  <tr><td colSpan={6} style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No data.</td></tr>
                )}
              </>
            )}

            {/* ── Section D: Transfer Taxes & Doc Stamps ──────────────────────── */}
            <SectionHeader
              id="D" title="TRANSFER TAXES & DOC STAMPS"
              subtitle={sectionDSubtitle}
              collapsed={collapsed.has('D')} onToggle={() => toggle('D')}
            />
            {!collapsed.has('D') && (
              <>
                {/* Transfer tax summary row */}
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td colSpan={6} style={{ padding: '6px 12px', background: BT.bg.panelAlt }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontSize: 9 }}>
                      <span style={{ color: BT.text.muted }}>Transfer Rate:</span>
                      <span style={{ color: BT.text.green, fontWeight: 700 }}>
                        {appliedTransferRate != null ? fmtPctRaw(appliedTransferRate) : '—'}
                        {isFlDeal && (
                          isMiamiDade
                            ? ' (Miami-Dade — includes 0.35% surtax)'
                            : ' (FL Statewide — $0.70 per $100)'
                        )}
                        {state === 'GA' && ' (GA — $1.00 per $1,000)'}
                        {state === 'TX' && ' (TX — no state transfer tax)'}
                      </span>
                      {backendIntangible != null && backendIntangible > 0 && (
                        <>
                          <span style={{ color: BT.text.muted }}>Intangible Tax on Mortgage:</span>
                          <span style={{ color: BT.text.amber, fontWeight: 700 }}>0.20% ({fmtDlr(backendIntangible)})</span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                <TaxRow
                  label="Documentary Stamp Tax (deed)"
                  sub={`Purchase Price × ${appliedTransferRate != null ? fmtPctRaw(appliedTransferRate) : '—'}`}
                  broker={null}
                  platform={backendDocStamps}
                  user={null}
                  resolved={backendDocStamps}
                  locked
                  format={fmtDlr}
                />
                {backendIntangible != null && backendIntangible > 0 && (
                  <TaxRow
                    label="Intangible Tax (new mortgage)"
                    sub={isFlDeal ? '0.20% of loan amount (FL intangible tax on new mortgages)' : '0.20% of loan amount'}
                    broker={null}
                    platform={backendIntangible}
                    user={null}
                    resolved={backendIntangible}
                    locked
                    format={fmtDlr}
                  />
                )}
                <TaxRow
                  label="Total Transfer Taxes"
                  sub="Deed transfer + intangible tax — feeds Sources & Uses tab"
                  broker={null}
                  platform={backendTransferTotal}
                  user={null}
                  resolved={backendTransferTotal}
                  locked
                  format={fmtDlr}
                />
                {/* Refi event taxes */}
                {taxes?.transferTax.refi?.enabled && (
                  <>
                    <tr style={{ borderTop: `1px dashed ${BT.border.medium}` }}>
                      <td colSpan={6} style={{ padding: '4px 12px', background: BT.bg.panelAlt }}>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, fontWeight: 700 }}>
                          REFI EVENT · Y{taxes.transferTax.refi.triggerYear} — {taxes.transferTax.refi.newLoanType ?? 'N/A'}
                        </span>
                      </td>
                    </tr>
                    <TaxRow
                      label="Refi Mortgage Doc Stamps"
                      sub={isFlDeal ? '$0.35 per $100 of new note (FL F.S. 201.08)' : 'Refi transfer tax on new note'}
                      broker={null}
                      platform={taxes.transferTax.refi.refiDocStampAmount}
                      user={null}
                      resolved={taxes.transferTax.refi.refiDocStampAmount}
                      locked
                      format={fmtDlr}
                    />
                    <TaxRow
                      label="Refi Intangible Tax"
                      sub="0.20% of new loan amount on refinance"
                      broker={null}
                      platform={taxes.transferTax.refi.refiIntangibleTaxAmount}
                      user={null}
                      resolved={taxes.transferTax.refi.refiIntangibleTaxAmount}
                      locked
                      format={fmtDlr}
                    />
                    <TaxRow
                      label="Total Refi Tax Cost"
                      sub="Refi doc stamps + intangible tax"
                      broker={null}
                      platform={taxes.transferTax.refi.refiTotalTax}
                      user={null}
                      resolved={taxes.transferTax.refi.refiTotalTax}
                      locked
                      format={fmtDlr}
                    />
                  </>
                )}
                {/* Cross-tab link badge */}
                <tr>
                  <td colSpan={6} style={{ padding: '6px 12px', borderBottom: `1px solid ${BT.border.medium}` }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onTabChange?.(7)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onTabChange?.(7); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#065f4630', border: `1px solid #10b981`, borderRadius: 4, cursor: onTabChange ? 'pointer' : 'default' }}
                      title="Click to open Sources & Uses tab"
                    >
                      <Link style={{ width: 10, height: 10, color: '#10b981' }} />
                      <span style={{ fontFamily: MONO, fontSize: 8, color: '#10b981', fontWeight: 700 }}>
                        → SOURCES & USES — Transfer taxes ({fmtDlr(backendTransferTotal)}) included in total uses
                      </span>
                      <Check style={{ width: 10, height: 10, color: '#10b981' }} />
                    </div>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', background: BT.bg.header, borderTop: `1px solid ${BT.border.medium}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontSize: 9 }}>
          <span style={{ color: BT.text.muted }}>LEGEND:</span>
          <span style={{ color: BT.text.amber }}>■ BROKER/T-12</span>
          <span style={{ color: BT.text.cyan  }}>■ PLATFORM</span>
          <span style={{ color: BT.text.green }}>■ USER / RESOLVED</span>
          <span style={{ color: BT.text.red   }}>█ REASSESSMENT EVENT</span>
          {hasCap && <span style={{ color: BT.text.muted }}>🔒 CAP BINDING</span>}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          {hasCap
            ? `${state} ${(sohCapPct * 100).toFixed(0)}% CAP · MAX ASSESSED VALUE INCREASE POST-ACQUISITION`
            : `${state || 'STATE'} · FULL REASSESSMENT AT ACQUISITION · ${assessGrowth > 0 ? `+${(assessGrowth * 100).toFixed(0)}%/yr ASSESSMENT GROWTH` : 'ANNUAL REASSESSMENT'}`
          }
        </div>
      </div>

      {/* RATES modal — mounts outside the scrollable area */}
      <RatesModal
        open={ratesOpen}
        onClose={() => setRatesOpen(false)}
        jurisdiction={taxes?.jurisdiction ?? 'fl'}
      />
    </div>
  );
}

export default TaxesTab;
