// ============================================================================
// DealTermsTab — Console > DEAL TERMS sub-tab (#XXX, structure-only scaffold)
// ============================================================================
//
// Repurposed from the former Projections > INTERACTIVE slot. Consolidates the
// four operator-decision input groups that today are scattered across F9:
// Acquisition / Entry, Hold & Targets, Exit / Disposition, and (optionally)
// Capital Structure.
//
// SCOPE — STRUCTURE ONLY:
//   - No backend wiring, no apiClient calls, no dealStore reads/writes.
//   - All cells render placeholder values ('--', '$0', 'Not Provided').
//   - Local useState only — values reset on unmount, that's correct.
//   - LayeredValue columns render as static badges, not live data.
//   - Claude Code will wire data in a follow-up task.
//
// COLUMN STRUCTURE (every row):
//   Line Item | Broker | Platform | User Override | Resolved | Source |
//   Derived | Flag
//
// VISUAL CONTRACT:
//   - Token system: BT (bloomberg-ui) — no Tailwind colors.
//   - Section header pattern matches StanceTab.SectionHeader (mono 8px caps,
//     accent color, letterSpacing 1, header bg, subtle border).
//   - Editable input border: BT.text.teal (#00E5A0) — the established
//     "user override / editable cell" convention.
//   - Source badges: amber=Override, agent-teal=Platform, cyan=OM Narrative,
//     purple=Computed, muted=Not Provided.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { useDealStore } from '../../../stores/dealStore';
import type { FinancialEngineTabProps } from './types';
import { SourceBadge } from './SourceBadge';

const MONO  = BT.font.mono;
const TEAL  = BT.text.teal;
const AMBER = BT.text.amber;
const CYAN  = BT.text.cyan;
const GREEN = BT.text.green;

// Existing labels mapped to the canonical SourceBadge source strings.
type SourceKind = 'Override' | 'Platform' | 'OM Narrative' | 'Computed' | 'Not Provided';

const SOURCE_KIND_TO_BADGE: Record<SourceKind, string | null> = {
  'Override':     'override',
  'Platform':     'platform',
  'OM Narrative': 'om',
  'Computed':     'computed',
  'Not Provided': null,
};

// ─── Formatters / parsers ─────────────────────────────────────────────────────

function fmtDollar(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '--';
}
function fmtDollarShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '--';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
function fmtPct(n: number | null | undefined, digits = 2): string {
  return n != null && Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : '--';
}
function fmtMultiple(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? `${n.toFixed(2)}x` : '--';
}

/** Parse a user-typed dollar string. Strips commas, spaces, $. Returns null if non-positive or NaN. */
function parsePositiveDollar(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Parse a user-typed percentage string. "5.5" or "5.5%" → 0.055. Returns null if non-positive or NaN. */
function parsePctDecimal(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[%,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 ? n / 100 : null;
}

/** Add N years to a YYYY-MM-DD date string. Returns null if either input is missing. */
function addYearsToDate(closeIso: string | null | undefined, holdYears: number | null): string | null {
  if (!closeIso || holdYears == null || !Number.isFinite(holdYears)) return null;
  const d = new Date(`${closeIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() + holdYears);
  return d.toISOString().slice(0, 10);
}

// ─── Pending badge — for rows whose persistence path doesn't exist yet ────────

function PendingBadge({ label = 'PENDING' }: { label?: string }) {
  return (
    <span
      title="Override has no persistence path — see TODO_DEAL_TERMS_FOLLOWUP.md"
      style={{
        display: 'inline-block', padding: '0 4px', borderRadius: 2,
        fontFamily: MONO, fontSize: 7, fontWeight: 700,
        color: BT.text.muted, background: `${BT.text.muted}18`,
        border: `1px solid ${BT.text.muted}44`,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </span>
  );
}

// ─── LV cell — placeholder rendering for Broker / Platform / Resolved cols ────

function LvCell({ value, muted = false, accent }: {
  value?: string | null;
  muted?: boolean;
  accent?: string;
}) {
  const v = value ?? '--';
  const isEmpty = v === '--' || v === '';
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9,
      color: isEmpty ? BT.text.muted : (accent ?? (muted ? BT.text.muted : BT.text.primary)),
      fontWeight: isEmpty ? 400 : 600,
      letterSpacing: 0.3,
    }}>
      {v}
    </span>
  );
}

function NaCell() {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, color: BT.text.muted,
      letterSpacing: 0.5, opacity: 0.6,
    }}>
      N/A
    </span>
  );
}

// ─── Editable override input — teal border per spec ───────────────────────────

function OverrideInput({
  value, onChange, onCommit, placeholder = '--', width = 96, type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  width?: number;
  type?: 'text' | 'number' | 'date';
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={() => onCommit?.()}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        color: value ? TEAL : BT.text.muted,
        background: BT.bg.input,
        border: `1px solid ${TEAL}55`,
        padding: '3px 6px', width,
        textAlign: 'right',
        outline: 'none',
        letterSpacing: 0.3,
      }}
    />
  );
}

function DropdownSelect({
  value, options, onChange, width = 110,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 600,
        color: value ? TEAL : BT.text.muted,
        background: BT.bg.input,
        border: `1px solid ${TEAL}55`,
        padding: '3px 6px', width,
        outline: 'none',
        letterSpacing: 0.3,
      }}
    >
      <option value="">--</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
}

// ─── Section header — accent-colored, matches StanceTab pattern ───────────────

function SectionHeader({ label, accent, sub }: { label: string; accent: string; sub?: string }) {
  return (
    <tr>
      <td colSpan={8} style={{
        padding: '10px 14px 5px',
        background: BT.bg.header,
        borderTop: `2px solid ${accent}`,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: accent,
            letterSpacing: 1.2, fontWeight: 700,
          }}>
            {label}
          </span>
          {sub && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>
              {sub}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function SpacerRow() {
  return (
    <tr>
      <td colSpan={8} style={{ height: 8, background: BT.bg.terminal, borderBottom: 'none' }} />
    </tr>
  );
}

// ─── Row primitives ───────────────────────────────────────────────────────────
//
// LvRow renders the canonical 8-column structure. Children pass cell content
// via props; cells default to '--' when null. The Override column owns local
// state via the `override` / `setOverride` props passed from the parent.

interface LvRowProps {
  label: string;
  hint?: string;
  broker?: string;          // null → renders '--'
  platform?: string;
  override: string;         // local state
  setOverride: (v: string) => void;
  /** Optional commit handler — fires on input blur / Enter. */
  onCommit?: () => void;
  resolved?: string;        // null → renders '--' (resolution unwired)
  source: SourceKind;
  derived?: string;
  flag?: React.ReactNode;
  // When true, Broker/Platform render N/A styling (operator-decision rows).
  operatorOnly?: boolean;
  // Override column variant: input | dropdown | passthrough text
  overrideKind?: 'text' | 'number' | 'date' | 'pct';
  overrideOptions?: string[]; // for dropdown rows (Exit Strategy)
  // Display-only row treatment
  readOnly?: boolean;
  readOnlyValue?: string;
  // Bold subtotal/total treatment
  emphasis?: 'subtotal' | 'total' | null;
}

function LvRow({
  label, hint, broker, platform, override, setOverride, onCommit, resolved, source,
  derived, flag, operatorOnly = false, overrideKind = 'text', overrideOptions,
  readOnly = false, readOnlyValue,
  emphasis = null,
}: LvRowProps) {
  const rowBg = emphasis === 'total'
    ? `${AMBER}10`
    : emphasis === 'subtotal'
      ? `${AMBER}06`
      : 'transparent';
  const labelColor = emphasis === 'total'
    ? AMBER
    : emphasis === 'subtotal'
      ? AMBER
      : BT.text.secondary;
  const labelWeight = emphasis ? 700 : 500;

  return (
    <tr style={{ background: rowBg, borderBottom: `1px solid ${BT.border.subtle}` }}>
      {/* Line Item — sticky-left feel (no real sticky in scrollable container) */}
      <td style={{ padding: '6px 14px', minWidth: 220 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: labelWeight,
          color: labelColor, letterSpacing: 0.5,
        }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 1 }}>
            {hint}
          </div>
        )}
      </td>

      {/* Broker */}
      <td style={td()}>
        {operatorOnly ? <NaCell /> : <LvCell value={broker} muted />}
      </td>

      {/* Platform */}
      <td style={td()}>
        {operatorOnly ? <NaCell /> : <LvCell value={platform} muted />}
      </td>

      {/* User Override */}
      <td style={td()}>
        {readOnly ? (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>
        ) : overrideKind === 'date' ? (
          <OverrideInput value={override} onChange={setOverride} onCommit={onCommit} type="date" width={120} />
        ) : overrideOptions ? (
          <DropdownSelect value={override} options={overrideOptions} onChange={(v) => { setOverride(v); onCommit?.(); }} />
        ) : overrideKind === 'pct' ? (
          <OverrideInput value={override} onChange={setOverride} onCommit={onCommit} placeholder="--%" />
        ) : overrideKind === 'number' ? (
          <OverrideInput value={override} onChange={setOverride} onCommit={onCommit} type="number" />
        ) : (
          <OverrideInput value={override} onChange={setOverride} onCommit={onCommit} />
        )}
      </td>

      {/* Resolved — highlighted column */}
      <td style={{ ...td(), background: emphasis ? 'transparent' : `${BT.text.amber}06` }}>
        {readOnly ? (
          <LvCell value={readOnlyValue} accent={emphasis === 'total' ? AMBER : BT.text.primary} />
        ) : (
          <LvCell value={resolved} accent={emphasis === 'total' ? AMBER : BT.text.amber} />
        )}
      </td>

      {/* Source */}
      <td style={td()}>
        <SourceBadge source={SOURCE_KIND_TO_BADGE[source]} />
      </td>

      {/* Derived */}
      <td style={td()}>
        {derived
          ? <LvCell value={derived} muted />
          : <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>}
      </td>

      {/* Flag */}
      <td style={td()}>
        {flag ?? <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>}
      </td>
    </tr>
  );
}

function td(): React.CSSProperties {
  return {
    padding: '6px 10px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };
}

// ─── Column header row ────────────────────────────────────────────────────────

function ColumnHeader() {
  const cells: Array<[string, number, React.CSSProperties?]> = [
    ['LINE ITEM',     220, { textAlign: 'left',  paddingLeft: 14 }],
    ['BROKER',        110],
    ['PLATFORM',      110],
    ['USER OVERRIDE', 120],
    ['RESOLVED',      120, { background: `${BT.text.amber}10` }],
    ['SOURCE',        90],
    ['DERIVED',       110],
    ['FLAG',          70],
  ];
  return (
    <tr style={{
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.medium}`,
    }}>
      {cells.map(([label, width, extra]) => (
        <th key={label} style={{
          padding: '6px 10px',
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          color: BT.text.muted, letterSpacing: 1,
          textAlign: 'right',
          minWidth: width,
          position: 'sticky', top: 0, zIndex: 5,
          backgroundClip: 'padding-box',
          background: BT.bg.header,
          ...extra,
        }}>
          {label}
        </th>
      ))}
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const QUICK_HOLD_CHIPS = [3, 5, 7, 10];

export function DealTermsTab(props: FinancialEngineTabProps) {
  const fin = props.f9Financials ?? null;

  // dealStore emit hooks — additive cross-tab signals; parent's onF9Refresh
  // continues to be the canonical refetch trigger.
  const emitHoldPeriodChanged = useDealStore(s => s.emitHoldPeriodChanged);
  const emitBasisChanged      = useDealStore(s => s.emitBasisChanged);
  const emitExitCapChanged    = useDealStore(s => s.emitExitCapChanged);

  // Header context
  const dealName = fin?.dealName
    ?? (props.assumptions?.dealInfo?.dealName as string | undefined)
    ?? '—';
  const totalUnits = fin?.totalUnits
    ?? (props.assumptions?.dealInfo?.totalUnits as number | undefined)
    ?? null;

  // ── ACQUISITION / ENTRY local draft state ───────────────────────────────────
  const [purchasePrice, setPurchasePrice]       = useState('');
  const [closeBrokerFee, setCloseBrokerFee]     = useState('');
  const [closeLegalDD,   setCloseLegalDD]       = useState('');
  const [closeLender,    setCloseLender]        = useState('');
  const [closeReserves,  setCloseReserves]      = useState('');
  const [closeOther,     setCloseOther]         = useState('');
  const [goingInCap,     setGoingInCap]         = useState('');
  const [stabilizedCap,  setStabilizedCap]      = useState('');
  const [closeDate,      setCloseDate]          = useState('');

  // ── HOLD & TARGETS ─────────────────────────────────────────────────────────
  const [holdYears,      setHoldYears]          = useState('');
  const [targetIrr,      setTargetIrr]          = useState('');
  const [targetEm,       setTargetEm]           = useState('');
  const [targetCoc,      setTargetCoc]          = useState('');

  // ── EXIT / DISPOSITION ─────────────────────────────────────────────────────
  const [exitStrategy,   setExitStrategy]       = useState('');
  const [exitCap,        setExitCap]            = useState('');
  const [sellingCosts,   setSellingCosts]       = useState('');

  // Hydrate draft state once per dealId. Re-fetches won't clobber an in-flight
  // edit; onF9Refresh handlers below trigger a manual sync after a successful
  // save by stashing the new server value into local state directly.
  const hydratedDealId = useRef<string | null>(null);
  useEffect(() => {
    if (!fin || hydratedDealId.current === props.dealId) return;
    hydratedDealId.current = props.dealId;
    if (fin.capitalStack?.purchasePrice != null) setPurchasePrice(String(fin.capitalStack.purchasePrice));
    if (fin.assumptions?.holdYears != null)      setHoldYears(String(fin.assumptions.holdYears));
    if (fin.assumptions?.exitCap != null)        setExitCap((fin.assumptions.exitCap * 100).toFixed(2));
    if (fin.closeDate)                           setCloseDate(fin.closeDate);
    // Items 3/4/5 — return hurdles & disposition
    if ((fin.assumptions as any)?.targetIrr != null)       setTargetIrr(((fin.assumptions as any).targetIrr * 100).toFixed(2));
    if ((fin.assumptions as any)?.targetEm != null)        setTargetEm(String((fin.assumptions as any).targetEm));
    if ((fin.assumptions as any)?.targetCoc != null)       setTargetCoc(((fin.assumptions as any).targetCoc * 100).toFixed(2));
    if ((fin.assumptions as any)?.exitStrategy != null)    setExitStrategy((fin.assumptions as any).exitStrategy);
    if ((fin.assumptions as any)?.sellingCostsPct != null) setSellingCosts(((fin.assumptions as any).sellingCostsPct * 100).toFixed(2));
  }, [props.dealId, fin]);

  // ── Resolved values (server side of truth) ─────────────────────────────────
  const purchasePriceResolved = fin?.capitalStack?.purchasePrice ?? null;
  const pricePerUnitResolved  = fin?.capitalStack?.pricePerUnit ?? null;
  const exitCapResolved       = fin?.assumptions?.exitCap ?? null;
  const platformExitCap       = fin?.trafficProjection?.calibrated?.exitCap ?? null;
  const holdYearsResolved     = fin?.assumptions?.holdYears ?? null;
  const closeDateResolved     = fin?.closeDate ?? null;
  const goingInCapResolved    = fin?.proforma?.valuationSnapshot?.goingInCapT12
    ?? fin?.returns?.valuation?.multiples?.capRate?.goingIn ?? null;
  const stabilizedCapResolved = fin?.returns?.valuation?.multiples?.capRate?.stabilized ?? null;
  // Items 3/4/5 resolved from server
  const targetIrrResolved       = (fin?.assumptions as any)?.targetIrr       ?? null;
  const targetEmResolved        = (fin?.assumptions as any)?.targetEm        ?? null;
  const targetCocResolved       = (fin?.assumptions as any)?.targetCoc       ?? null;
  const exitStrategyResolved    = (fin?.assumptions as any)?.exitStrategy    ?? null;
  const sellingCostsPctResolved = (fin?.assumptions as any)?.sellingCostsPct ?? null;

  // Total closing costs = explicit override (su:closingCosts) ?? benchmarks.closingCostsPct × basis
  const closingCostsOverride  = fin?.sourcesUses?.userOverrides?.closingCosts ?? null;
  const closingCostsPctBench  = fin?.sourcesUses?.benchmarks?.closingCostsPct ?? null;
  const totalClosingCosts: number | null =
    closingCostsOverride != null
      ? closingCostsOverride
      : (purchasePriceResolved != null && closingCostsPctBench != null
         ? Math.round(purchasePriceResolved * closingCostsPctBench)
         : null);
  const closingCostsSource: SourceKind =
    closingCostsOverride != null ? 'Override'
      : closingCostsPctBench != null ? 'Platform'
      : 'Not Provided';

  // All-In Basis — derived
  const allInBasis: number | null =
    purchasePriceResolved != null && totalClosingCosts != null
      ? purchasePriceResolved + totalClosingCosts
      : null;

  // Selling Costs: prefer persisted operator value from DB, then local draft input, then 2% platform default
  const sellingCostsDecimal = sellingCostsPctResolved ?? parsePctDecimal(sellingCosts) ?? 0.02;

  // Returns / KPI strip — null until model has been built
  const irrPct  = fin?.returns?.lpNetIrr ?? fin?.returns?.irr ?? null;
  const emValue = fin?.returns?.lpEquityMultiple ?? fin?.returns?.equityMultiple ?? null;
  const dscrY1  = fin?.returns?.debtMetrics?.coverage?.dscrY1 ?? null;

  // Derived: Exit Date = Close Date + Hold Years
  const exitDateDerived = useMemo(
    () => addYearsToDate(closeDateResolved, holdYearsResolved),
    [closeDateResolved, holdYearsResolved],
  );

  // Exit-year projections row — index into fin.projections by the resolved hold period.
  // projections is 0-indexed and always holdYears long when seeded.
  const holdIndex = (holdYearsResolved ?? 10) - 1;
  const exitYearProj = (fin?.projections && holdIndex >= 0 && holdIndex < fin.projections.length)
    ? fin.projections[holdIndex]
    : null;

  // Stabilized NOI at Exit — forward NOI at hold year from the F9 projections engine.
  const stabilizedNoiAtExit: number | null = exitYearProj?.exitNoi ?? null;

  // Exit Value — already computed by the projections engine as exitNoi / exitCap.
  const exitValueDerived: number | null = exitYearProj?.grossSaleValue ?? null;

  // Gross Sale Proceeds = Exit Value − Selling Costs (no loan payoff — label says Gross, not Net).
  // Prefer projections-engine sellingCosts (which uses operator selling_costs_pct); fall back to
  // local decimal if projection isn't seeded yet.
  const grossProceedsDerived: number | null =
    exitValueDerived != null
      ? exitValueDerived - (exitYearProj?.sellingCosts ?? Math.round(exitValueDerived * sellingCostsDecimal))
      : null;

  // Purchase Price dual-source warning: deal_data.purchase_price shadows
  // deals.budget on read; PATCH only updates budget. Detection is best-effort —
  // we don't have the raw deal_data on this prop, so we rely on dealData
  // when surfaced. See TODO entry "Purchase Price dual-source".
  const dealData = (props.deal as Record<string, unknown> | undefined)?.['deal_data'] as
    Record<string, unknown> | undefined;
  const purchasePriceDualSource =
    dealData?.purchase_price != null
    && (props.deal as Record<string, unknown> | undefined)?.['budget'] != null;

  // ── Save handlers ───────────────────────────────────────────────────────────

  async function savePurchasePrice() {
    const num = parsePositiveDollar(purchasePrice);
    if (num == null) return;
    if (num === purchasePriceResolved) return;
    try {
      // Writes deal_data.purchase_price — the canonical source for
      // financials-composer.buildCapitalStack(). deals.budget is a
      // pipeline-only column and does NOT affect the financial model.
      await apiClient.patch(`/api/v1/deals/${props.dealId}/purchase-price`, { purchasePrice: num });
      emitBasisChanged();
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save purchase price failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveCloseDate() {
    const next = closeDate || null;
    if (next === closeDateResolved) return;
    try {
      // Preserve saleDate — the route nullifies any field not in the body.
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/dates`, {
        closeDate: next,
        saleDate:  fin?.saleDate ?? null,
      });
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save close date failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveExitCap() {
    const dec = parsePctDecimal(exitCap);
    if (dec == null) return;
    if (exitCapResolved != null && Math.abs(dec - exitCapResolved) < 1e-6) return;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/financials/override`, {
        field: 'exitCapRate', year: null, value: dec,
      });
      emitExitCapChanged();
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save exit cap failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveHoldPeriod(yr?: number) {
    const parsed = yr ?? parseInt(holdYears, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    if (parsed === holdYearsResolved) return;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/hold-period`, {
        holdPeriodYears: parsed,
      });
      emitHoldPeriodChanged(parsed);
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save hold period failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveTargetIrr() {
    const dec = parsePctDecimal(targetIrr);
    if (dec == null) return;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/targets`, { targetIrr: dec });
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save target IRR failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveTargetEm() {
    const val = parseFloat(targetEm);
    if (!Number.isFinite(val) || val <= 0) return;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/targets`, { targetEm: val });
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save target EM failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveTargetCoc() {
    const dec = parsePctDecimal(targetCoc);
    if (dec == null) return;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/targets`, { targetCoc: dec });
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save target CoC failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveExitStrategy() {
    const val = exitStrategy || null;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/exit-strategy`, { exitStrategy: val });
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save exit strategy failed:', e instanceof Error ? e.message : e);
    }
  }

  async function saveSellingCosts() {
    const dec = parsePctDecimal(sellingCosts);
    if (dec == null) return;
    try {
      await apiClient.patch(`/api/v1/deals/${props.dealId}/assumptions/selling-costs`, { sellingCostsPct: dec });
      props.onF9Refresh?.();
    } catch (e) {
      console.error('[DealTerms] Save selling costs failed:', e instanceof Error ? e.message : e);
    }
  }

  // Hold-period quick-chip: persists immediately then triggers cross-tab
  // refetch. onHoldChange is kept for ProjectionsTab view-sync.
  function pickHoldChip(yr: number) {
    setHoldYears(String(yr));
    void saveHoldPeriod(yr);
    props.onHoldChange?.(yr);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: BT.bg.terminal, overflow: 'hidden',
    }}>

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 14px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: AMBER, letterSpacing: 1,
        }}>
          DEAL TERMS
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
          {dealName}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
          {totalUnits != null ? `${totalUnits} Units` : '— Units'}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
          At-Acquisition Snapshot
        </span>

        {/* KPI pill set — populated from f9Financials.returns when present */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {[
            { label: 'IRR',  v: fmtPct(irrPct, 1) },
            { label: 'EM',   v: fmtMultiple(emValue) },
            { label: 'DSCR', v: dscrY1 != null ? dscrY1.toFixed(2) : '--' },
          ].map(p => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'baseline', gap: 4,
              padding: '2px 8px',
              background: BT.bg.panelAlt,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 2,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.6 }}>
                {p.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>
                {p.v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hold-period quick chips — sit ABOVE the table per spec ────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px',
        background: BT.bg.panelAlt,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1,
        }}>
          HOLD PERIOD QUICK-SELECT:
        </span>
        {QUICK_HOLD_CHIPS.map(yr => {
          const active = holdYears === String(yr);
          return (
            <button
              key={yr}
              onClick={() => pickHoldChip(yr)}
              style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                color: active ? CYAN : BT.text.muted,
                background: active ? `${CYAN}18` : 'transparent',
                border: `1px solid ${active ? CYAN : BT.border.subtle}`,
                padding: '2px 10px', borderRadius: 2,
                cursor: 'pointer',
                letterSpacing: 0.5,
              }}
            >
              {yr}Y
            </button>
          );
        })}
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          background: BT.bg.panel,
        }}>
          <thead>
            <ColumnHeader />
          </thead>
          <tbody>

            {/* ════════════ SECTION 1 — ACQUISITION / ENTRY ════════════ */}
            <SectionHeader label="ACQUISITION / ENTRY" accent={AMBER} sub="Going-in basis & cap rate" />

            <LvRow label="Purchase Price"
              broker={undefined} platform={undefined}
              override={purchasePrice} setOverride={setPurchasePrice}
              onCommit={savePurchasePrice}
              resolved={fmtDollar(purchasePriceResolved)}
              source={purchasePriceResolved != null ? 'Override' : 'Not Provided'}
              derived={
                purchasePriceResolved != null && totalUnits != null && totalUnits > 0
                  ? `${fmtDollarShort(pricePerUnitResolved ?? Math.round(purchasePriceResolved / totalUnits))}/unit`
                  : undefined
              }
              flag={purchasePriceDualSource ? <PendingBadge label="DUAL-SRC" /> : undefined}
            />
            <LvRow label="Closing Costs — Broker Fee"
              broker={undefined} platform={undefined}
              override={closeBrokerFee} setOverride={setCloseBrokerFee}
              readOnly readOnlyValue="--"
              source="Not Provided"
              flag={<PendingBadge />}
            />
            <LvRow label="Closing Costs — Legal & DD"
              broker={undefined} platform={undefined}
              override={closeLegalDD} setOverride={setCloseLegalDD}
              readOnly readOnlyValue="--"
              source="Not Provided"
              flag={<PendingBadge />}
            />
            <LvRow label="Closing Costs — Lender / Orig"
              broker={undefined} platform={undefined}
              override={closeLender} setOverride={setCloseLender}
              readOnly readOnlyValue="--"
              source="Not Provided"
              flag={<PendingBadge />}
            />
            <LvRow label="Closing Costs — Reserves"
              broker={undefined} platform={undefined}
              override={closeReserves} setOverride={setCloseReserves}
              readOnly readOnlyValue="--"
              source="Not Provided"
              flag={<PendingBadge />}
            />
            <LvRow label="Closing Costs — Other / Cont."
              broker={undefined} platform={undefined}
              override={closeOther} setOverride={setCloseOther}
              readOnly readOnlyValue="--"
              source="Not Provided"
              flag={<PendingBadge />}
            />

            <LvRow label="─── TOTAL CLOSING COSTS ───"
              broker={undefined}
              platform={closingCostsPctBench != null && purchasePriceResolved != null
                ? fmtDollar(Math.round(purchasePriceResolved * closingCostsPctBench))
                : undefined}
              override="" setOverride={() => {}}
              readOnly readOnlyValue={fmtDollar(totalClosingCosts)}
              source={closingCostsSource}
              emphasis="subtotal"
            />
            <LvRow label="═══ ALL-IN BASIS ═══"
              broker={undefined} platform={undefined}
              override="" setOverride={() => {}}
              readOnly readOnlyValue={fmtDollar(allInBasis)}
              source="Computed"
              derived={
                allInBasis != null && totalUnits != null && totalUnits > 0
                  ? `${fmtDollarShort(Math.round(allInBasis / totalUnits))}/unit`
                  : undefined
              }
              emphasis="total"
            />

            <SpacerRow />

            <LvRow label="Going-in Cap Rate"
              hint="T12 NOI / Purchase"
              broker={undefined}
              platform={fmtPct(goingInCapResolved)}
              override={goingInCap} setOverride={setGoingInCap}
              overrideKind="pct"
              readOnly readOnlyValue={fmtPct(goingInCapResolved)}
              source={goingInCapResolved != null ? 'Computed' : 'Not Provided'}
              flag={<PendingBadge />}
            />
            <LvRow label="Stabilized Cap Rate"
              hint="Peak NOI / Purchase"
              broker={undefined}
              platform={fmtPct(stabilizedCapResolved)}
              override={stabilizedCap} setOverride={setStabilizedCap}
              overrideKind="pct"
              readOnly readOnlyValue={fmtPct(stabilizedCapResolved)}
              source={stabilizedCapResolved != null ? 'Computed' : 'Not Provided'}
              flag={<PendingBadge />}
            />
            <LvRow label="Close Date"
              broker={undefined} platform={undefined}
              override={closeDate} setOverride={setCloseDate}
              onCommit={saveCloseDate}
              overrideKind="date"
              resolved={closeDateResolved ?? '--'}
              source={closeDateResolved != null ? 'Override' : 'Not Provided'}
            />

            {/* ════════════ SECTION 2 — HOLD & TARGETS ════════════ */}
            <SectionHeader label="HOLD & TARGETS" accent={CYAN} sub="Operator decisions — N/A in extracted layers" />

            <LvRow label="Hold Period (years)"
              operatorOnly
              override={holdYears} setOverride={setHoldYears}
              overrideKind="number"
              onCommit={() => void saveHoldPeriod()}
              resolved={holdYearsResolved != null ? `${holdYearsResolved} yr` : '--'}
              source={holdYearsResolved != null ? 'Override' : 'Not Provided'}
              derived={holdYearsResolved != null ? `use chips or type + Enter` : undefined}
            />
            <LvRow label="Target Levered IRR"
              operatorOnly
              override={targetIrr} setOverride={setTargetIrr}
              overrideKind="pct"
              onCommit={() => void saveTargetIrr()}
              resolved={targetIrrResolved != null ? `${(targetIrrResolved * 100).toFixed(1)}%` : '--'}
              source={targetIrrResolved != null ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Target Equity Multiple"
              operatorOnly
              override={targetEm} setOverride={setTargetEm}
              overrideKind="number"
              onCommit={() => void saveTargetEm()}
              resolved={targetEmResolved != null ? `${targetEmResolved.toFixed(2)}x` : '--'}
              source={targetEmResolved != null ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Target Cash-on-Cash (Y1)"
              operatorOnly
              override={targetCoc} setOverride={setTargetCoc}
              overrideKind="pct"
              onCommit={() => void saveTargetCoc()}
              resolved={targetCocResolved != null ? `${(targetCocResolved * 100).toFixed(1)}%` : '--'}
              source={targetCocResolved != null ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Investment Strategy"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue="From THESIS §1 — not yet wired"
              source="Not Provided"
              flag={<PendingBadge label="UPSTREAM" />}
            />

            {/* ════════════ SECTION 3 — EXIT / DISPOSITION ════════════ */}
            <SectionHeader label="EXIT / DISPOSITION" accent={GREEN} sub="Disposition assumptions & exit math" />

            <LvRow label="Exit Strategy"
              operatorOnly
              override={exitStrategy} setOverride={setExitStrategy}
              overrideOptions={['Sale', 'Refinance', 'Hold']}
              onCommit={() => void saveExitStrategy()}
              resolved={exitStrategyResolved ?? '--'}
              source={exitStrategyResolved != null ? 'Override' : 'Not Provided'}
            />
            <LvRow label="Exit Cap Rate"
              broker={undefined}
              platform={fmtPct(platformExitCap)}
              override={exitCap} setOverride={setExitCap}
              onCommit={saveExitCap}
              overrideKind="pct"
              resolved={fmtPct(exitCapResolved)}
              source={exitCapResolved != null
                ? (exitCapResolved !== platformExitCap ? 'Override' : 'Platform')
                : 'Not Provided'}
            />
            <LvRow label="Selling Costs %"
              broker={undefined} platform="2.00%"
              override={sellingCosts} setOverride={setSellingCosts}
              overrideKind="pct"
              onCommit={() => void saveSellingCosts()}
              resolved={sellingCostsPctResolved != null ? `${(sellingCostsPctResolved * 100).toFixed(2)}%` : '2.00%'}
              source={sellingCostsPctResolved != null ? 'Override' : 'Platform'}
            />

            <SpacerRow />

            <LvRow label="Exit Date"
              hint="Close Date + Hold Period"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={exitDateDerived ?? '--'}
              source="Computed"
            />
            <LvRow label="Stabilized NOI at Exit"
              hint="Forward NOI at hold year from F9 projections engine (exitNoi)"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={fmtDollar(stabilizedNoiAtExit)}
              source={stabilizedNoiAtExit != null ? 'Computed' : 'Not Provided'}
            />
            <LvRow label="Exit Value"
              hint="Exit NOI / Exit Cap"
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={fmtDollar(exitValueDerived)}
              source="Computed"
              emphasis="total"
            />
            <LvRow label="Gross Sale Proceeds"
              hint="Exit Value × (1 − Selling Costs). Loan payoff at exit pending — not Net."
              operatorOnly
              override="" setOverride={() => {}}
              readOnly readOnlyValue={fmtDollar(grossProceedsDerived)}
              source="Computed"
              emphasis="subtotal"
              flag={<PendingBadge label="GROSS" />}
            />

          </tbody>
        </table>

        {/* Footer note */}
        <div style={{
          padding: '12px 14px 24px',
          fontFamily: MONO, fontSize: 8, color: BT.text.muted,
          letterSpacing: 0.5, lineHeight: 1.5,
        }}>
          Resolved values from F9 /financials · PENDING badges mark rows whose
          override has no persistence path yet (see TODO_DEAL_TERMS_FOLLOWUP.md).
        </div>
      </div>

      {/* TODO: Section 4 (Capital Structure) deliberately omitted pending
          Leon's decision on duplication with F9 Capital tab. See thread.
          If approved, rows: Loan Amount, LTV, LTC, Interest Rate, Loan Term,
          IO Period, Amortization, Origination Fee %, Equity Required,
          LP/GP Split, Preferred Return. */}
    </div>
  );
}

export default DealTermsTab;
