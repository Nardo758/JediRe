import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Lock, ChevronDown, ChevronRight, Link, Check } from 'lucide-react';
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

function TaxRow({ label, broker, platform, user, resolved, userEditable = false, onUserChange, format = fmtDlr, locked = false, sub }: {
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
      {/* Platform */}
      <td style={{ padding: '3px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.cyan, borderRight: `1px solid ${BT.border.subtle}` }}>
        {format(platform)}
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

function KpiTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 14px', background: BT.bg.panel, borderRight: `1px solid ${BT.border.subtle}` }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: color ?? BT.text.amber }}>{value}</span>
    </div>
  );
}

function SohGrid({ perYear }: { perYear: F9TaxYear[] }) {
  if (!perYear.length) return null;
  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto', borderBottom: `1px solid ${BT.border.medium}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                {(['YEAR', 'ASSESSED VALUE', 'MILLAGE', 'RE TAX', 'SOH CAP', 'EVENT'] as const).map(h => (
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
                    {row.sohCapBinding
                      ? (
                        <span
                          title="FL Save Our Homes 10% annual cap binding — market value growth exceeds the 10% cap, so assessed value is limited to prior year + 10%. RE tax liability is lower than market-value-based assessment."
                          style={{ color: BT.text.red, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'help' }}
                        >
                          <Lock style={{ width: 8, height: 8 }} />CAP
                        </span>
                      )
                      : <span style={{ color: BT.text.green }}>—</span>}
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

function DeprecSchedule({ taxes, costSeg, bonusYear, f9Financials }: {
  taxes: F9TaxData;
  costSeg: boolean;
  bonusYear: 2026 | 2027;
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
  const bonusBasis = (costSeg && depreciableBase != null)
    ? Math.round(depreciableBase * costSegAvailablePct * (bonusYear === 2026 ? 0.40 : 0.20))
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
      const taxPayable = taxableIncome != null ? Math.round(Math.max(0, taxableIncome) * 0.37) : null;
      const taxShield = Math.round(deprec * 0.37);
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

  const COLS = ['YR', 'NOI (EST)', 'INTEREST EXP', 'DEPRECIATION', 'TAXABLE INCOME', 'TAX PAYABLE (37%)', 'CUMUL DEPREC'];

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

export function TaxesTab({ dealId, f9Financials }: FinancialEngineTabProps) {
  const taxes = f9Financials?.taxes ?? null;
  const dealName = f9Financials?.dealName ?? 'Deal';

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [costSeg, setCostSeg] = useState(true);
  const [bonusYear, setBonusYear] = useState<2026 | 2027>(2026);
  // County: null = use server-resolved value; true/false = user explicit override (persisted)
  const [countyOverride, setCountyOverride] = useState<boolean | null>(taxes?.userOverrides?.taxCounty ?? null);

  const [userAssessedValue, setUserAssessedValue] = useState<number | null>(taxes?.userOverrides?.taxAssessedValue ?? null);
  const [userMillageRate, setUserMillageRate]       = useState<number | null>(taxes?.userOverrides?.taxMillageRate   ?? null);
  const [userTppAmount, setUserTppAmount]           = useState<number | null>(taxes?.userOverrides?.tppAmount ?? null);

  // Sync local state when async f9Financials arrives after mount (e.g. on initial load).
  // Only hydrate once (when local state is still null) to avoid clobbering live user edits.
  useEffect(() => {
    if (taxes?.userOverrides) {
      setCountyOverride(prev        => prev ?? (taxes.userOverrides.taxCounty        ?? null));
      setUserAssessedValue(prev     => prev ?? (taxes.userOverrides.taxAssessedValue ?? null));
      setUserMillageRate(prev       => prev ?? (taxes.userOverrides.taxMillageRate   ?? null));
      setUserTppAmount(prev         => prev ?? (taxes.userOverrides.tppAmount        ?? null));
    }
  }, [taxes?.userOverrides]);

  const isMiamiDade = countyOverride ?? taxes?.reTax.isMiamiDade ?? false;
  const effMillageRate = userMillageRate ?? (isMiamiDade ? 23.09 : 20.00);
  const effAssessedValue = userAssessedValue ?? taxes?.reTax.platformAssessedValue ?? null;
  const effAnnualTax = effAssessedValue != null ? Math.round(effAssessedValue * (effMillageRate / 1000)) : null;

  const effectiveTaxRate = effAnnualTax != null && f9Financials?.capitalStack?.purchasePrice != null
    ? effAnnualTax / f9Financials.capitalStack.purchasePrice : null;

  // Client-side SOH projection — recomputed whenever assessed value or millage changes
  // so the grid reflects user overrides immediately without waiting for a server round-trip.
  const FL_SOH_CAP = 0.10;
  const MKT_GROWTH = 0.12;  // FL market appreciation (12%/yr) — exceeds 10% SOH cap so cap binds after Y1
  const computedPerYear: F9TaxYear[] = useMemo(() => {
    const baseAssessed = effAssessedValue;
    if (!baseAssessed) return taxes?.reTax.perYear ?? [];
    const numYears = Math.max(taxes?.reTax.perYear.length ?? 10, 10);
    const rows: F9TaxYear[] = [];
    let prevCapped = baseAssessed;
    for (let yr = 1; yr <= numYears; yr++) {
      const marketValue = baseAssessed * Math.pow(1 + MKT_GROWTH, yr - 1);
      const capLimited = yr === 1 ? baseAssessed : Math.min(marketValue, prevCapped * (1 + FL_SOH_CAP));
      const sohCapBinding = yr > 1 && marketValue > capLimited + 1;
      const assessedValue = Math.round(capLimited);
      const taxAmount = Math.round(assessedValue * (effMillageRate / 1000));
      rows.push({ year: yr, assessedValue, millageRate: effMillageRate, taxAmount, sohCapBinding, reassessmentEvent: yr === 1 });
      prevCapped = capLimited;
    }
    return rows;
  }, [effAssessedValue, effMillageRate, taxes?.reTax.perYear]);

  // Debounced PATCH helper — uses apiClient for consistent auth/error handling
  const patchTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const patchField = useCallback((field: string, value: number | null) => {
    clearTimeout(patchTimeouts.current[field]);
    patchTimeouts.current[field] = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, { field, year: 1, value });
      } catch { /* non-fatal override failure */ }
    }, 600);
  }, [dealId]);

  const handleAssessedValue = (v: number | null) => { setUserAssessedValue(v); patchField('taxAssessedValue', v); };
  const handleMillageRate   = (v: number | null) => { setUserMillageRate(v);   patchField('taxMillageRate', v); };
  const handleTppAmount     = (v: number | null) => { setUserTppAmount(v);     patchField('tppAmount', v); };

  const toggle = (id: string) => setCollapsed(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // Resolve transfer tax with Miami-Dade toggle
  const txRate = isMiamiDade ? 0.0105 : 0.0070;
  const pp = taxes?.transferTax.purchasePrice ?? null;
  const loan = taxes?.transferTax.loanAmount ?? null;
  const docStamps = pp != null ? Math.round(pp * txRate) : null;
  const intangible = loan != null ? Math.round(loan * 0.002) : null;
  const totalTransfer = ((docStamps ?? 0) + (intangible ?? 0)) || null;

  // Recompute delta vs T-12 from effective (potentially user-overridden) values
  const t12AnnualTax = taxes?.reTax.t12AnnualTax ?? null;
  const deltaVsT12 = effAnnualTax != null && t12AnnualTax != null && t12AnnualTax > 0
    ? (effAnnualTax - t12AnnualTax) / t12AnnualTax
    : taxes?.reTax.deltaVsT12Pct ?? null;
  const largeDelta = deltaVsT12 != null && Math.abs(deltaVsT12) > 0.30;

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
          <span style={{ fontFamily: MONO, fontSize: 8, padding: '2px 6px', background: isMiamiDade ? '#1A1A2E' : '#0A1A0A', border: `1px solid ${isMiamiDade ? '#3B3B8B' : '#1A3B1A'}`, borderRadius: 3, color: isMiamiDade ? BT.text.purple : BT.text.green }}>
            {isMiamiDade ? 'MIAMI-DADE RATES' : 'STATEWIDE RATES'}
          </span>
          {countyOverride == null && taxes?.reTax.isMiamiDade && (
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>auto-detected</span>
          )}
          {countyOverride != null && (
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>overridden</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border.medium}`, flexShrink: 0 }}>
        <KpiTile label="Y1 RE TAX"          value={fmtDlr(effAnnualTax)}                          color={BT.text.amber} />
        <KpiTile label="EFFECTIVE TAX RATE"  value={fmtPct(effectiveTaxRate)}                      color={BT.text.orange} />
        <KpiTile label="DOC STAMPS"          value={fmtDlr(docStamps)}                             color={BT.text.red} />
        <KpiTile label="ANNUAL DEPRECIATION" value={fmtDlr(taxes?.incomeTax.annualDepreciation)}   color={BT.text.purple} />
        <KpiTile label="TPP ESTIMATE"        value={fmtDlr(userTppAmount ?? taxes?.tpp.platform)}  color={BT.text.cyan} />
        <KpiTile label="COUNTY"              value={isMiamiDade ? 'MIAMI-DADE' : 'FL STATEWIDE'}   color={isMiamiDade ? BT.text.purple : BT.text.green} />
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
              subtitle={`FL SOH 10% Cap · Reassessment at acquisition · ${isMiamiDade ? 'Miami-Dade' : 'Statewide'} millage ${effMillageRate.toFixed(2)} mills`}
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
                />
                <TaxRow
                  label="Millage Rate"
                  sub={isMiamiDade ? 'Miami-Dade county: 23.09 mills' : 'FL statewide average: 20.00 mills'}
                  broker={taxes?.reTax.t12MillageRate}
                  platform={effMillageRate}
                  user={userMillageRate}
                  resolved={userMillageRate ?? effMillageRate}
                  userEditable
                  onUserChange={handleMillageRate}
                  format={fmtMills}
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
                />
                {/* SOH Projection Grid — uses client-side computed values so overrides show immediately */}
                <tr>
                  <td colSpan={6} style={{ padding: '4px 12px 2px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6, background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    FL SOH 10% CAP ENGINE — Y1–Y{computedPerYear.length || 10} PROJECTION (12% mkt growth assumed) &nbsp;
                    <span style={{ color: BT.text.red }}>█ REASSESSMENT</span>
                    &nbsp;&nbsp;
                    <span style={{ color: BT.text.muted }}>🔒 SOH CAP BINDING</span>
                  </td>
                </tr>
                {computedPerYear.length > 0 ? (
                  <SohGrid perYear={computedPerYear} />
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
              subtitle="FL TPP tax on FF&E and appliances"
              collapsed={collapsed.has('B')} onToggle={() => toggle('B')}
            />
            {!collapsed.has('B') && (
              <TaxRow
                label="TPP Annual Tax Estimate"
                sub="FF&E + appliances × TPP millage (~6 mills). Override with actual assessor bill."
                broker={taxes?.tpp.broker}
                platform={taxes?.tpp.platform}
                user={userTppAmount}
                resolved={userTppAmount ?? taxes?.tpp.platform ?? taxes?.tpp.broker}
                userEditable
                onUserChange={handleTppAmount}
                format={fmtDlr}
              />
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>BONUS DEPREC YEAR:</span>
                        {([2026, 2027] as const).map(yr => (
                          <button key={yr} onClick={() => setBonusYear(yr)}
                            style={{ padding: '2px 8px', fontFamily: MONO, fontSize: 8, fontWeight: 700, background: bonusYear === yr ? BT.bg.active : BT.bg.panel, border: `1px solid ${bonusYear === yr ? BT.border.bright : BT.border.subtle}`, color: bonusYear === yr ? BT.text.white : BT.text.muted, borderRadius: 3, cursor: 'pointer' }}>
                            {yr} ({yr === 2026 ? '40%' : '20%'})
                          </button>
                        ))}
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                        Depreciable Base: <span style={{ color: BT.text.purple }}>{fmtDlr(taxes?.incomeTax.depreciableBase)}</span>
                        &nbsp;(80% of purchase price — 20% land excluded)
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
                  sub={`${costSeg ? `${taxes?.incomeTax.costSegAvailablePct != null ? (taxes.incomeTax.costSegAvailablePct * 100).toFixed(0) : 30}% of basis eligible × ${bonusYear === 2026 ? '40%' : '20%'} bonus rate` : 'Cost seg OFF'}`}
                  broker={null}
                  platform={costSeg && taxes?.incomeTax.depreciableBase != null
                    ? Math.round(taxes.incomeTax.depreciableBase * (taxes.incomeTax.costSegAvailablePct ?? 0.30) * (bonusYear === 2026 ? 0.40 : 0.20))
                    : null}
                  user={null}
                  resolved={costSeg && taxes?.incomeTax.depreciableBase != null
                    ? Math.round(taxes.incomeTax.depreciableBase * (taxes.incomeTax.costSegAvailablePct ?? 0.30) * (bonusYear === 2026 ? 0.40 : 0.20))
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
                  <DeprecSchedule taxes={taxes} costSeg={costSeg} bonusYear={bonusYear} f9Financials={f9Financials} />
                ) : (
                  <tr><td colSpan={6} style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No data.</td></tr>
                )}
              </>
            )}

            {/* ── Section D: Transfer Taxes & Doc Stamps ──────────────────────── */}
            <SectionHeader
              id="D" title="TRANSFER TAXES & DOC STAMPS"
              subtitle="FL documentary stamp tax on deed + intangible tax on mortgage"
              collapsed={collapsed.has('D')} onToggle={() => toggle('D')}
            />
            {!collapsed.has('D') && (
              <>
                {/* Miami-Dade vs Statewide summary row */}
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <td colSpan={6} style={{ padding: '6px 12px', background: BT.bg.panelAlt }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontSize: 9 }}>
                      <span style={{ color: BT.text.muted }}>Doc Stamp Rate:</span>
                      <span style={{ color: isMiamiDade ? BT.text.purple : BT.text.green, fontWeight: 700 }}>
                        {isMiamiDade ? '1.05%' : '0.70%'}
                        {isMiamiDade ? ' (Miami-Dade — includes 0.35% surtax)' : ' (Statewide — $0.70 per $100)'}
                      </span>
                      <span style={{ color: BT.text.muted }}>Intangible Tax on Mortgage:</span>
                      <span style={{ color: BT.text.amber, fontWeight: 700 }}>0.20% ({fmtDlr(intangible)})</span>
                    </div>
                  </td>
                </tr>
                <TaxRow
                  label="Documentary Stamp Tax (deed)"
                  sub={`Purchase Price × ${fmtPctRaw(txRate)} — ${isMiamiDade ? 'Miami-Dade incl. 0.35% surtax' : 'FL statewide rate'}`}
                  broker={null}
                  platform={docStamps}
                  user={null}
                  resolved={docStamps}
                  locked
                  format={fmtDlr}
                />
                <TaxRow
                  label="Intangible Tax (new mortgage)"
                  sub="0.20% of loan amount (FL intangible tax on new mortgages)"
                  broker={null}
                  platform={intangible}
                  user={null}
                  resolved={intangible}
                  locked
                  format={fmtDlr}
                />
                <TaxRow
                  label="Total Transfer Taxes"
                  sub="Doc stamps + intangible tax — feeds Sources & Uses tab"
                  broker={null}
                  platform={totalTransfer}
                  user={null}
                  resolved={totalTransfer}
                  locked
                  format={fmtDlr}
                />
                {/* Cross-tab link badge → Sources & Uses */}
                <tr>
                  <td colSpan={6} style={{ padding: '6px 12px', borderBottom: `1px solid ${BT.border.medium}` }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#065f4630', border: `1px solid #10b981`, borderRadius: 4 }}>
                      <Link style={{ width: 10, height: 10, color: '#10b981' }} />
                      <span style={{ fontFamily: MONO, fontSize: 8, color: '#10b981', fontWeight: 700 }}>
                        → SOURCES & USES TAB — Transfer taxes ({fmtDlr(totalTransfer)}) auto-populate closing costs line
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
          <span style={{ color: BT.text.muted }}>🔒 SOH CAP BINDING</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          FL SOH CAP · 10%/YR MAX ASSESSED VALUE INCREASE POST-ACQUISITION
        </div>
      </div>
    </div>
  );
}

export default TaxesTab;
